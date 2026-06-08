// Supabase Edge Function — 代理 DeepSeek API + 记忆注入
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY')!;

const GUEST_LIMIT = 5;
const GUEST_WINDOW = 3600000;
const guestCounts = new Map<string, { count: number; resetTime: number }>();

function checkGuestLimit(guestId: string): boolean {
  const now = Date.now();
  const entry = guestCounts.get(guestId);
  if (!entry || now > entry.resetTime) {
    guestCounts.set(guestId, { count: 1, resetTime: now + GUEST_WINDOW });
    return true;
  }
  if (entry.count >= GUEST_LIMIT) return false;
  entry.count++;
  return true;
}

// ── 记忆注入 ──
async function buildMemoryContext(supabaseAdmin: any, userId: string, currentMessage: string) {
  try {
    const parts: string[] = [];

    const { data: profile } = await supabaseAdmin.from('user_profiles').select('summary').eq('user_id', userId).maybeSingle();
    if (profile?.summary) parts.push('[关于你正在交谈的人]\n' + profile.summary);

    const { data: recentConvs } = await supabaseAdmin.from('conversations').select('summary').eq('user_id', userId).not('summary', 'is', null).order('ended_at', { ascending: false }).limit(3);
    if (recentConvs?.length) {
      parts.push('[你们最近的对话]\n' + recentConvs.map((c: any) => '- ' + c.summary).join('\n'));
    }

    const { data: allMemories } = await supabaseAdmin.from('memories').select('id, content, importance').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (allMemories?.length) {
      const recent = allMemories.slice(0, 5);
      const keywords = tokenize(currentMessage);
      const scored = allMemories.map((m: any) => ({ content: m.content, score: keywordOverlap(keywords, tokenize(m.content)), importance: m.importance }));
      scored.sort((a: any, b: any) => (b.score + b.importance) - (a.score + a.importance));
      const relevant = scored.slice(0, 3).filter((s: any) => s.score > 0);

      const seen = new Set<string>();
      const merged: string[] = [];
      for (const group of [recent, relevant]) {
        for (const m of group) {
          const key = (m.content || '').substring(0, 20);
          if (!seen.has(key)) { seen.add(key); merged.push(m.content); }
        }
      }
      if (merged.length) {
        parts.push('[与当前话题相关的回忆]\n' + merged.slice(0, 6).map((c: string) => '- ' + c).join('\n'));
      }
    }
    return parts.length ? '\n\n' + parts.join('\n\n') : '';
  } catch (e) {
    console.error('buildMemoryContext error:', e);
    return '';
  }
}

function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, ' ');
  const enTokens = cleaned.match(/[a-zA-Z]+/g) || [];
  tokens.push(...enTokens.map(t => t.toLowerCase()));
  const cnChars = cleaned.replace(/[a-zA-Z0-9\s]/g, '');
  for (let i = 0; i < cnChars.length - 1; i++) tokens.push(cnChars.substring(i, i + 2));
  return tokens;
}

function keywordOverlap(tokensA: string[], tokensB: string[]): number {
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let hits = 0;
  for (const t of tokensA) if (setB.has(t)) hits++;
  return hits / Math.max(tokensA.length, 1);
}

// ── 处理未总结的会话 ──
async function summarizePendingConversations(supabaseAdmin: any, userId: string) {
  const { data: pending } = await supabaseAdmin.from('conversations').select('id').eq('user_id', userId).is('ended_at', null).order('started_at', { ascending: true });
  if (!pending?.length) return;
  for (const conv of pending) {
    await summarizeConversation(supabaseAdmin, conv.id, userId);
  }
}

async function summarizeConversation(supabaseAdmin: any, conversationId: number, userId: string) {
  const { data: existing } = await supabaseAdmin.from('conversations').select('ended_at').eq('id', conversationId).eq('user_id', userId).maybeSingle();
  if (!existing || existing.ended_at) return;

  const { data: messages } = await supabaseAdmin.from('messages').select('role, content').eq('conversation_id', conversationId).eq('user_id', userId).order('created_at', { ascending: true });
  if (!messages || messages.length < 3) {
    await supabaseAdmin.from('conversations').update({ ended_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', userId);
    return;
  }

  const dialog = messages.map((m: any) => (m.role === 'user' ? '用户' : '静静') + '：' + m.content).join('\n');
  const summaryPrompt = '你是一个记忆提取工具。根据以下对话，提取出2-4条简洁的记忆碎片，每条不超过40个中文字。\n必须提取用户说的个人信息（名字、年龄、地点、职业、喜好等具体事实）。同时关注情绪、话题、偏好或习惯。\n直接输出记忆碎片，每行一条，不要编号，不要解释。\n\n对话内容：\n';

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: summaryPrompt + dialog.substring(0, 3000) }], max_tokens: 250, temperature: 0.3, stream: false })
    });
    const data = await resp.json();
    const result = data.choices[0].message.content.trim();
    const fragments = result.split('\n').filter((l: string) => l.trim()).slice(0, 4);
    if (!fragments.length) {
      await supabaseAdmin.from('conversations').update({ ended_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', userId);
      return;
    }

    const rows = fragments.map((f: string) => ({ user_id: userId, content: f.trim(), source_conversation_id: conversationId }));
    await supabaseAdmin.from('memories').insert(rows);
    const summary = fragments.map((f: string) => f.trim()).join('；');
    await supabaseAdmin.from('conversations').update({ summary, ended_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', userId);
  } catch (e) {
    console.error('summarizeConversation error:', e);
  }
}

// ── 主处理 ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const body = await req.json();
  const { messages, provider, stream, auth_token, guest_id, conversation_id, max_tokens, temperature } = body;

  if (!messages || !Array.isArray(messages) || !messages.length) {
    return new Response(JSON.stringify({ error: 'Empty messages' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  // JWT 验证
  let userId: string | null = null;
  if (auth_token) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(auth_token);
    if (!authError && authData?.user) userId = authData.user.id;
  }

  // Guest 限制
  if (!userId && guest_id) {
    if (!checkGuestLimit(guest_id)) {
      return new Response(JSON.stringify({ error: 'guest_limit' }), { status: 402, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // 总结上次未处理的对话
  if (userId && !conversation_id) {
    summarizePendingConversations(supabaseAdmin, userId).catch(e => console.error(e));
  }

  // 记忆注入
  if (userId && messages.length > 0) {
    try {
      let lastUserMsg = '';
      for (let u = messages.length - 1; u >= 0; u--) {
        if (messages[u].role === 'user') { lastUserMsg = messages[u].content; break; }
      }
      const memoryCtx = await buildMemoryContext(supabaseAdmin, userId, lastUserMsg);
      if (memoryCtx) {
        for (let s = 0; s < messages.length; s++) {
          if (messages[s].role === 'system') {
            messages[s] = { role: 'system', content: messages[s].content + memoryCtx };
            break;
          }
        }
      }
    } catch (e) { console.error('Memory injection error:', e); }
  }

  // 会话创建
  let convId = conversation_id;
  if (userId && !convId) {
    const { data: newConv } = await supabaseAdmin.from('conversations').insert({ user_id: userId }).select('id').single();
    if (newConv) convId = newConv.id;
  }

  // 存储用户消息
  if (userId && convId) {
    const userMsg = messages.filter((m: any) => m.role === 'user').pop();
    if (userMsg) {
      supabaseAdmin.from('messages').insert({ conversation_id: convId, user_id: userId, role: 'user', content: userMsg.content }).then(() => {}, () => {});
    }
  }

  // 调 DeepSeek
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({
        model: provider === 'zhipu' ? 'glm-4-flash' : 'deepseek-chat',
        messages,
        max_tokens: max_tokens || 220,
        temperature: temperature != null ? temperature : 0.6,
        stream: !!stream
      })
    });

    if (stream) {
      // 流式转发
      const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // 首条携带 conversation_id
      if (convId) {
        writer.write(encoder.encode('data: ' + JSON.stringify({ conversation_id: convId }) + '\n\n'));
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullReply = '';

      (async () => {
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) {
              if (buf.trim()) {
                const lines = buf.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) writer.write(encoder.encode(line + '\n\n'));
                }
              }
              writer.write(encoder.encode('data: [DONE]\n\n'));
              writer.close();

              if (userId && convId && fullReply) {
                supabaseAdmin.from('messages').insert({ conversation_id: convId, user_id: userId, role: 'assistant', content: fullReply }).then(() => {}, () => {});
              }
              return;
            }
            const text = decoder.decode(result.value, { stream: true });
            buf += text;
            const parts = buf.split('\n\n');
            buf = parts.pop() || '';
            for (const part of parts) {
              if (!part.trim()) continue;
              writer.write(encoder.encode(part + '\n\n'));
              try {
                const lines = part.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const payload = line.substring(6);
                    if (payload !== '[DONE]') {
                      const chunk = JSON.parse(payload);
                      const content = chunk.choices[0].delta.content;
                      if (content) fullReply += content;
                    }
                  }
                }
              } catch (_) {}
            }
          }
        } catch (e) {
          console.error('Stream error:', e);
          writer.close();
        }
      })();

      return new Response(readable, { status: 200, headers });
    }

    // 非流式
    const data = await resp.json();
    const reply = data.choices[0].message.content;

    if (userId && convId) {
      supabaseAdmin.from('messages').insert({ conversation_id: convId, user_id: userId, role: 'assistant', content: reply }).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ reply, conversation_id: convId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    console.error('API error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});
