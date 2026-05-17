/* Vercel Serverless Function — 代理 DeepSeek API + 记忆注入 + 用户系统 */

import supabase from '../lib/supabase.js';
import { buildMemoryContext } from '../lib/memory.js';

// ── 简易内存限流 ──
var rateMap = new Map();
var lastCleanup = 0;

function getIP(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function checkRate(ip) {
  var now = Date.now();
  var entry = rateMap.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + 60000 };
    rateMap.set(ip, entry);
    return true;
  }
  if (entry.count >= 15) return false;
  entry.count++;
  return true;
}

function cleanupRateMap() {
  var now = Date.now();
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;
  rateMap.forEach(function (entry, ip) {
    if (now > entry.resetTime) rateMap.delete(ip);
  });
}

// ── Guest 限制（模块级 Map，冷启动清零）──
var guestCounts = new Map();
var GUEST_LIMIT = 5;
var GUEST_WINDOW = 3600000; // 1 小时

function checkGuestLimit(guestId) {
  var now = Date.now();
  var entry = guestCounts.get(guestId);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + GUEST_WINDOW };
    guestCounts.set(guestId, entry);
    return true;
  }
  if (entry.count >= GUEST_LIMIT) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 限流
  var ip = getIP(req);
  cleanupRateMap();
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  var body = req.body || {};
  var messages = body.messages;
  var provider = body.provider;
  var stream = body.stream;
  var authToken = body.auth_token;
  var guestId = body.guest_id;
  var conversationId = body.conversation_id;

  // 输入校验
  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Empty messages' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Too many messages' });
  }
  var hasUser = false;
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }
    if (msg.content.length > 2000) {
      return res.status(400).json({ error: 'Message too long' });
    }
    if (msg.role === 'user') hasUser = true;
  }
  if (!hasUser) {
    return res.status(400).json({ error: 'No user message' });
  }

  // ── 用户认证 ──
  var userId = null;
  if (authToken) {
    try {
      var { data: authData, error: authError } = await supabase.auth.getUser(authToken);
      if (!authError && authData && authData.user) userId = authData.user.id;
    } catch (e) { /* token 无效，按 guest 处理 */ }
  }

  // ── Guest 限制 ──
  if (!userId && guestId) {
    if (!checkGuestLimit(guestId)) {
      return res.status(402).json({ error: 'guest_limit' });
    }
  }

  // ── 记忆注入（仅登录用户）──
  if (userId && messages.length > 0) {
    try {
      // 找到最新的 user 消息用于关键词匹配
      var lastUserMsg = '';
      for (var u = messages.length - 1; u >= 0; u--) {
        if (messages[u].role === 'user') { lastUserMsg = messages[u].content; break; }
      }
      var memoryCtx = await buildMemoryContext(userId, lastUserMsg);
      if (memoryCtx) {
        // 找到 system 消息并追加
        for (var s = 0; s < messages.length; s++) {
          if (messages[s].role === 'system') {
            messages[s] = { role: 'system', content: messages[s].content + memoryCtx };
            break;
          }
        }
      }
    } catch (e) { console.error('Memory injection error:', e); }
  }

  // ── 选择 API 提供商 ──
  var apiKey = provider === 'zhipu'
    ? process.env.ZHIPU_API_KEY
    : process.env.DEEPSEEK_API_KEY;

  var apiUrl = provider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    : 'https://api.deepseek.com/v1/chat/completions';

  var model = provider === 'zhipu' ? 'glm-4-flash' : 'deepseek-chat';

  // ── 在调 AI 前创建 conversation（如需要）──
  var convId = conversationId;
  if (userId && !convId) {
    try {
      var { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (!convErr && newConv) convId = newConv.id;
    } catch (e) { /* 非致命 */ }
  }

  // ── 存储用户消息 ──
  if (userId && convId) {
    var userMsg = messages.filter(function (m) { return m.role === 'user'; }).pop();
    if (userMsg) {
      try {
        await supabase.from('messages').insert({
          conversation_id: convId,
          user_id: userId,
          role: 'user',
          content: userMsg.content
        });
      } catch (e) { /* 非致命 */ }
    }
  }

  // ── 调上游 API ──
  var timeout;
  try {
    var controller = new AbortController();
    timeout = setTimeout(function () { controller.abort(); }, 20000);

    var resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: body.max_tokens || 220,
        temperature: body.temperature != null ? body.temperature : 0.6,
        stream: !!stream
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('API error:', resp.status);
      return res.status(resp.status).json({ error: 'Upstream error' });
    }

    // ── 流式转发 ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 首条数据携带 conversation_id
      if (convId) {
        res.write('data: ' + JSON.stringify({ conversation_id: convId }) + '\n\n');
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var fullReply = '';

      try {
        while (true) {
          var result = await reader.read();
          if (result.done) {
            if (buf.trim()) {
              var lines = buf.split('\n');
              for (var j = 0; j < lines.length; j++) {
                if (lines[j].startsWith('data: ')) {
                  res.write(lines[j] + '\n\n');
                }
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();

            // 存储 assistant 回复
            if (userId && convId && fullReply) {
              try {
                await supabase.from('messages').insert({
                  conversation_id: convId,
                  user_id: userId,
                  role: 'assistant',
                  content: fullReply
                });
              } catch (e) { /* 非致命 */ }
            }
            break;
          }
          var text = decoder.decode(result.value, { stream: true });
          buf += text;
          var parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (var k = 0; k < parts.length; k++) {
            if (parts[k].trim()) {
              // 累积完整回复文本
              try {
                var lines2 = parts[k].split('\n');
                for (var l = 0; l < lines2.length; l++) {
                  if (lines2[l].indexOf('data: ') === 0) {
                    var payload = lines2[l].substring(6);
                    if (payload !== '[DONE]') {
                      var chunk = JSON.parse(payload);
                      var content = chunk.choices[0].delta.content;
                      if (content) fullReply += content;
                    }
                  }
                }
              } catch (e) {}
              res.write(parts[k] + '\n\n');
            }
          }
        }
      } catch (e) {
        console.error('Stream error:', e);
        // 即使流中断也尝试存储已获取的回复
        if (userId && convId && fullReply) {
          try {
            await supabase.from('messages').insert({
              conversation_id: convId,
              user_id: userId,
              role: 'assistant',
              content: fullReply
            });
          } catch (e2) { /* 非致命 */ }
        }
        res.end();
      }
      return;
    }

    // ── 非流式 ──
    var data = await resp.json();
    var reply = data.choices[0].message.content;

    // 存储 assistant 回复
    if (userId && convId) {
      try {
        await supabase.from('messages').insert({
          conversation_id: convId,
          user_id: userId,
          role: 'assistant',
          content: reply
        });
      } catch (e) { /* 非致命 */ }
    }

    return res.status(200).json({ reply: reply, conversation_id: convId });
  } catch (e) {
    if (timeout) clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    console.error('Proxy error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
