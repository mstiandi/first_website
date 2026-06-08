/* Vercel Serverless — TTS 语音合成 (Edge TTS) */

var EDGE_TTS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var text = (body.text || '').trim();

    if (!text) return res.status(400).json({ error: 'empty_text' });
    if (text.length > 300) text = text.substring(0, 300);

    // 构建 SSML
    var ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">' +
      '<voice name="zh-CN-XiaoxiaoNeural">' +
      '<prosody rate="0.9" pitch="+0Hz">' +
      escapeXml(text) +
      '</prosody>' +
      '</voice>' +
      '</speak>';

    var ttsResp = await fetch(EDGE_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: ssml
    });

    if (!ttsResp.ok) {
      console.error('Edge TTS error:', ttsResp.status);
      return res.status(502).json({ error: 'tts_upstream_error' });
    }

    var audioBuffer = await ttsResp.arrayBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
