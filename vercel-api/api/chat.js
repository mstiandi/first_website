/* Vercel Serverless Function — 代理 DeepSeek/Zhipu API，隐藏 key */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, provider, stream } = req.body || {};
  if (!messages || !messages.length) {
    return res.status(400).json({ error: 'Empty messages' });
  }

  // 选择 API 提供商
  const apiKey = provider === 'zhipu'
    ? process.env.ZHIPU_API_KEY
    : process.env.DEEPSEEK_API_KEY;

  const apiUrl = provider === 'zhipu'
    ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    : 'https://api.deepseek.com/v1/chat/completions';

  const model = provider === 'zhipu' ? 'glm-4-flash' : 'deepseek-chat';

  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 500,
        temperature: 0.8,
        stream: !!stream
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('API error:', resp.status, err);
      return res.status(resp.status).json({ error: 'API request failed' });
    }

    // 流式输出：将 DeepSeek SSE 逐块转发给前端
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // 处理剩余 buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  res.write(line + '\n\n');
                }
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            break;
          }
          const text = decoder.decode(value, { stream: true });
          buffer += text;
          // SSE 协议：以 \n\n 分隔事件
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || ''; // 保留不完整的最后一个
          for (const part of parts) {
            if (part.trim()) {
              res.write(part + '\n\n');
            }
          }
        }
      } catch (e) {
        console.error('Stream error:', e);
        res.end();
      }
      return;
    }

    // 非流式：原有逻辑
    const data = await resp.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error('Proxy error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
