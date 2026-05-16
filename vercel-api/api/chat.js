/* Vercel Serverless Function — 代理 DeepSeek/Zhipu API，隐藏 key */

// 简易内存限流（Vercel 热实例复用，冷启动重置）
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

  // 选择 API 提供商
  var apiKey = provider === 'zhipu'
    ? process.env.ZHIPU_API_KEY
    : process.env.DEEPSEEK_API_KEY;

  var apiUrl = provider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    : 'https://api.deepseek.com/v1/chat/completions';

  var model = provider === 'zhipu' ? 'glm-4-flash' : 'deepseek-chat';

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

    // 流式输出：将上游 SSE 逐块转发给前端
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';

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
            break;
          }
          var text = decoder.decode(result.value, { stream: true });
          buf += text;
          var parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (var k = 0; k < parts.length; k++) {
            if (parts[k].trim()) {
              res.write(parts[k] + '\n\n');
            }
          }
        }
      } catch (e) {
        console.error('Stream error:', e);
        res.end();
      }
      return;
    }

    // 非流式
    var data = await resp.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (e) {
    if (timeout) clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    console.error('Proxy error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
