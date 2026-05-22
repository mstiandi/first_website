/* Vercel Serverless — AI 聊天 API v2（无登录、免费、每日20轮限制、流式 SSE）*/

// ── 简易内存限流 ──
var rateMap = new Map();
var dailyMap = new Map();
var lastCleanup = 0;
var DAILY_LIMIT = 20;
var DAILY_WINDOW = 86400000;

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

function checkDaily(key) {
  if (!key) return true;
  var now = Date.now();
  var entry = dailyMap.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + DAILY_WINDOW };
    dailyMap.set(key, entry);
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

function cleanupMaps() {
  var now = Date.now();
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;
  rateMap.forEach(function (entry, k) { if (now > entry.resetTime) rateMap.delete(k); });
  dailyMap.forEach(function (entry, k) { if (now > entry.resetTime) dailyMap.delete(k); });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var ip = getIP(req);
  cleanupMaps();
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    var body = req.body || {};
    var messages = body.messages;

    if (!messages || !Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'Empty messages' });
    }
    if (messages.length > 20) {
      messages = messages.slice(-20);
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
    if (!hasUser) return res.status(400).json({ error: 'No user message' });

    // 每日限额
    var guestId = (body.guest_id) || null;
    if (!checkDaily(guestId || ip)) {
      return res.status(402).json({ error: 'daily_limit' });
    }

    var provider = body.provider || 'deepseek';
    var apiKey = provider === 'zhipu'
      ? process.env.ZHIPU_API_KEY
      : process.env.DEEPSEEK_API_KEY;
    var apiUrl = provider === 'zhipu'
      ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      : 'https://api.deepseek.com/v1/chat/completions';
    var model = provider === 'zhipu' ? 'glm-4-flash' : 'deepseek-chat';
    var stream = body.stream !== false;

    // 带重试
    var maxRetries = 2;
    var upstreamRes = null;
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        var backoff = Math.pow(2, attempt) * 1000;
        await new Promise(function (r) { setTimeout(r, backoff); });
      }
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 25000);
      try {
        upstreamRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: Math.min(body.max_tokens || 220, 500),
            temperature: body.temperature != null ? Math.min(body.temperature, 1.0) : 0.6,
            stream: stream
          }),
          signal: controller.signal
        });
      } catch (e) {
        if (e.name === 'AbortError') console.error('Upstream timeout (attempt ' + (attempt + 1) + ')');
        upstreamRes = null;
      }
      clearTimeout(timeout);
      if (!upstreamRes) continue;
      if (upstreamRes.ok || (upstreamRes.status !== 503 && upstreamRes.status !== 502 && upstreamRes.status !== 504 && upstreamRes.status !== 429)) break;
    }

    if (!upstreamRes || !upstreamRes.ok) {
      var sc = upstreamRes ? upstreamRes.status : 504;
      if (stream) {
        try { res.write('data: ' + JSON.stringify({ error: 'ai_error', code: sc }) + '\n\n'); } catch (e) {}
        return res.end();
      }
      return res.status(sc).json({ error: 'Upstream error' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(': heartbeat\n\n');

      var reader = upstreamRes.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      try {
        while (true) {
          var result = await reader.read();
          if (result.done) {
            if (buf.trim()) {
              var lines = buf.split('\n');
              for (var j = 0; j < lines.length; j++) {
                if (lines[j].startsWith('data: ')) res.write(lines[j] + '\n\n');
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            break;
          }
          var text = decoder.decode(result.value, { stream: true });
          buf += text;
          var parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (var k = 0; k < parts.length; k++) {
            if (parts[k].trim()) res.write(parts[k] + '\n\n');
          }
        }
      } catch (e) {
        console.error('Stream error:', e);
        res.end();
      }
      return;
    }

    var data = await upstreamRes.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error('Chat API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
