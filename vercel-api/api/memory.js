import { summarizeConversation, maybeUpdateProfile } from '../lib/memory.js';
import supabase from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var body = req.body || {};
  var authToken = body.auth_token;
  var directUserId = body.user_id;
  var conversationId = body.conversation_id;

  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversation_id' });
  }

  var userId = directUserId || null;

  // 兼容 web 端 JWT
  if (!userId && authToken) {
    try {
      var { data: { user }, error } = await supabase.auth.getUser(authToken);
      if (!error && user) userId = user.id;
    } catch (e) { /* invalid token, ignore */ }
  }

  // 解析 guest UUID → 真实 profile ID
  if (userId && body.guest_id) {
    try {
      var { data: idCheck } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (!idCheck) {
        var { data: guestProfile } = await supabase.from('profiles').select('id').eq('guest_id', body.guest_id).maybeSingle();
        if (guestProfile) userId = guestProfile.id;
      }
    } catch (e) {}
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 异步触发，不阻塞响应
  summarizeConversation(conversationId, userId).then(function () {
    return maybeUpdateProfile(userId);
  }).catch(function (e) {
    console.error('Memory processing error:', e);
  });

  return res.status(200).json({ ok: true });
}
