/* Vercel Serverless Function — 代理 DeepSeek/Zhipu API，隐藏 key */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, provider } = req.body || {};
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
        temperature: 0.8
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('API error:', resp.status, err);
      return res.status(resp.status).json({ error: 'API request failed' });
    }

    const data = await resp.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error('Proxy error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
