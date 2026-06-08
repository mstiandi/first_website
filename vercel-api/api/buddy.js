/* Vercel Serverless — 搭子聊天 API (HTTP 轮询) */

import supabase from '../lib/supabase.js';
import { checkContent } from '../lib/wechat.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var urlParams = new URL(req.url, 'http://localhost').searchParams;
    var userId = body.user_id || urlParams.get('user_id') || null;

    if (!userId) return res.status(401).json({ error: 'login_required' });

    // 查找活跃 match
    var { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'active')
      .or('user_a.eq.' + userId + ',user_b.eq.' + userId)
      .maybeSingle();

    if (!match) return res.status(404).json({ error: 'no_active_match' });

    if (req.method === 'GET') {
      return handleGetMessages(req, res, userId, match);
    }

    if (req.method === 'POST') {
      return handleSendMessage(req, res, userId, match);
    }

    return res.status(405).json({ error: 'method_not_allowed' });

  } catch (err) {
    console.error('Buddy API error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function handleGetMessages(req, res, userId, match) {
  var urlParams = new URL(req.url, 'http://localhost').searchParams;
  var since = urlParams.get('since') || new Date(0).toISOString();

  var { data: messages } = await supabase
    .from('buddy_messages')
    .select('id, sender_id, content, created_at')
    .eq('match_id', match.id)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50);

  return res.json({
    messages: messages || [],
    buddyName: null  // 前端已有
  });
}

async function handleSendMessage(req, res, userId, match) {
  var body = req.body || {};
  var content = (body.content || '').trim();

  if (!content) return res.status(400).json({ error: 'empty_message' });
  if (content.length > 500) return res.status(400).json({ error: 'message_too_long' });

  // 内容安全检测
  if (process.env.WX_APPID && process.env.WX_SECRET) {
    var checkResult = await checkContent(content);
    if (!checkResult.pass) {
      return res.status(400).json({ error: 'content_blocked' });
    }
  }

  var { data: msg, error } = await supabase
    .from('buddy_messages')
    .insert({
      match_id: match.id,
      sender_id: userId,
      content: content
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('Buddy send error:', error);
    return res.status(500).json({ error: 'send_failed' });
  }

  return res.json({ id: msg.id, created_at: msg.created_at });
}
