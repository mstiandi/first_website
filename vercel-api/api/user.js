/* Vercel Serverless — 用户资料 API */

import supabase from '../lib/supabase.js';

var DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
var DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

var PROFILE_PROMPT = '你是一个用户画像生成工具。根据以下用户的记忆碎片，生成一段简洁的用户画像。' +
  '用"你"开头（你在对用户说话），描述用户的主要性格特点、常聊话题、情绪模式、表达风格。' +
  '不超过180字。语言温柔平实，像朋友间的观察。\n\n记忆碎片：\n';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    // GET 请求从 query string 取参数
    var urlParams = new URL(req.url, 'http://localhost').searchParams;
    var uid = body.user_id || urlParams.get('user_id') || null;
    var guestId = body.guest_id || urlParams.get('guest_id') || null;

    if (req.method === 'GET') return handleGet(req, res, uid, guestId);
    if (req.method === 'PUT') return handlePut(req, res, uid, body, guestId);

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('User API error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function handleGet(req, res, uid, guestId) {
  var realId = await resolveUserId(uid, guestId);
  if (!realId) return res.json({ profile: null });

  var { data: profile } = await supabase
    .from('profiles')
    .select('anonymous_name, gender, tags, points, free_soundscapes, free_matches, avatar_url')
    .eq('id', realId)
    .maybeSingle();

  var { data: userProfile } = await supabase
    .from('user_profiles')
    .select('summary')
    .eq('user_id', realId)
    .maybeSingle();

  var summary = userProfile ? userProfile.summary : '';

  // 没有画像但有记忆时，自动生成
  if (!summary) {
    summary = await generateSummary(realId);
  }

  // 查询活跃匹配
  var { data: match } = await supabase
    .from('matches')
    .select('id, user_a, user_b, matched_at')
    .eq('status', 'active')
    .or('user_a.eq.' + realId + ',user_b.eq.' + realId)
    .maybeSingle();

  var buddy = null;
  if (match) {
    var buddyId = match.user_a === realId ? match.user_b : match.user_a;
    var { data: buddyProfile } = await supabase
      .from('profiles')
      .select('anonymous_name')
      .eq('id', buddyId)
      .maybeSingle();
    buddy = {
      matchId: match.id,
      buddyName: buddyProfile ? buddyProfile.anonymous_name : '...',
      matchedAt: match.matched_at
    };
  }

  // 查询声景数量
  var { count: soundscapeCount } = await supabase
    .from('user_soundscapes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', realId);

  return res.json({
    profile: {
      anonymous_name: profile ? profile.anonymous_name : '',
      gender: profile ? profile.gender : 'secret',
      tags: profile ? profile.tags : [],
      points: profile ? profile.points : 0,
      free_soundscapes: profile ? profile.free_soundscapes : 0,
      free_matches: profile ? profile.free_matches : 0,
      avatar_url: profile ? profile.avatar_url : '',
      summary: summary,
      soundscape_count: soundscapeCount || 0,
      buddy: buddy
    }
  });
}

async function handlePut(req, res, uid, body, guestId) {
  var realId = await resolveUserId(uid, guestId);
  if (!realId) return res.status(401).json({ error: 'login_required' });

  var updates = {};
  if (body.anonymousName) updates.anonymous_name = body.anonymousName;
  if (body.gender) updates.gender = body.gender;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.avatarUrl) updates.avatar_url = body.avatarUrl;

  if (Object.keys(updates).length === 0) {
    return res.json({ status: 'ok' });
  }

  await supabase.from('profiles').update(updates).eq('id', realId);

  return res.json({ status: 'ok' });
}

async function resolveUserId(uid, guestId) {
  // 先按主键查
  if (uid) {
    var { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', uid)
      .maybeSingle();
    if (profile) return profile.id;
  }
  // 兜底: 按 guest_id 查
  if (guestId) {
    var { data: guestProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('guest_id', guestId)
      .maybeSingle();
    if (guestProfile) return guestProfile.id;
  }
  return null;
}

async function generateSummary(realId) {
  try {
    var { data: memories } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', realId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!memories || memories.length < 2) return '';

    var memoryText = memories.map(function (m) { return '- ' + m.content; }).join('\n');

    var resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: PROFILE_PROMPT + '\n' + memoryText }],
        max_tokens: 350,
        temperature: 0.3,
        stream: false
      })
    });

    var data = await resp.json();
    var summary = data.choices[0].message.content.trim();

    // 保存到 user_profiles
    await supabase.from('user_profiles').upsert({
      user_id: realId,
      summary: summary,
      session_count: memories.length,
      last_summarized_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return summary;
  } catch (e) {
    console.error('generateSummary error:', e);
    return '';
  }
}
