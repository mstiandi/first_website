/* Vercel Serverless — 匹配 API */

import supabase from '../lib/supabase.js';
import { scanPool } from '../lib/match-engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    var body = req.body || {};
    var urlParams = new URL(req.url, 'http://localhost').searchParams;
    var userId = body.user_id || urlParams.get('user_id') || null;

    var path = req.url.split('?')[0];
    var segments = path.split('/').filter(Boolean);

    if (req.method === 'GET' || segments[segments.length - 1] === 'status') {
      return handleGetStatus(req, res, userId);
    }
    if (segments[segments.length - 1] === 'cancel') {
      return handleCancel(req, res, userId);
    }
    if (segments[segments.length - 1] === 'break') {
      return handleBreak(req, res, userId);
    }

    return handleStartMatch(req, res, userId);

  } catch (err) {
    console.error('Match API error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function handleStartMatch(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'login_required' });

  var body = req.body || {};

  // 获取用户资料
  var { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return res.json({ status: 'error', message: 'profile_not_found' });

  // 检查是否有活跃匹配
  var { data: existing } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'active')
    .or('user_a.eq.' + userId + ',user_b.eq.' + userId)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.json({ status: 'already_matched' });
  }

  // 获取画像
  var { data: userProfile } = await supabase
    .from('user_profiles')
    .select('emotional_patterns')
    .eq('user_id', userId)
    .maybeSingle();

  // 活跃时段
  var { data: activities } = await supabase
    .from('activity_log')
    .select('hour')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);

  var activeHours = (activities || []).map(function (a) { return a.hour; });

  // 进匹配池
  await supabase.from('match_pool').upsert({
    user_id: userId,
    gender: profile.gender || 'secret',
    tags: profile.tags || [],
    target_gender: 'opposite',
    selected_tags: body.selected_tags || [],
    emotional_pattern: userProfile ? userProfile.emotional_patterns : null,
    active_hours: activeHours,
    joined_at: new Date().toISOString()
  });

  // 扫描匹配
  var { data: pool } = await supabase.from('match_pool').select('*');
  var pair = scanPool(pool || []);

  if (pair) {
    var { data: match } = await supabase
      .from('matches')
      .insert({
        user_a: pair.a.user_id,
        user_b: pair.b.user_id,
        status: 'active'
      })
      .select()
      .maybeSingle();

    await supabase.from('match_pool').delete().in('user_id', [pair.a.user_id, pair.b.user_id]);

    var { data: profileB } = await supabase.from('profiles').select('anonymous_name').eq('id', pair.b.user_id).single();
    var { data: profileA } = await supabase.from('profiles').select('anonymous_name').eq('id', pair.a.user_id).single();

    var tagsA = (pair.a.tags || []).concat(pair.a.selected_tags || []);
    var tagsB = (pair.b.tags || []).concat(pair.b.selected_tags || []);
    var commonTags = tagsA.filter(function (t) { return tagsB.indexOf(t) !== -1; });

    var buddyName = userId === pair.a.user_id
      ? (profileB ? profileB.anonymous_name : '...')
      : (profileA ? profileA.anonymous_name : '...');

    return res.json({
      status: 'matched',
      match: {
        matchId: match.id,
        buddyName: buddyName,
        commonTags: commonTags,
        matchedAt: match.matched_at,
        icebreaker: '你们都在这里，也许是同一个原因。从"今天怎么样"开始试试？'
      }
    });
  }

  return res.json({ status: 'waiting' });
}

async function handleGetStatus(req, res, userId) {
  if (!userId) return res.json({ status: 'idle' });

  var { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'active')
    .or('user_a.eq.' + userId + ',user_b.eq.' + userId)
    .maybeSingle();

  if (match) {
    var buddyId = match.user_a === userId ? match.user_b : match.user_a;
    var { data: buddy } = await supabase.from('profiles').select('anonymous_name').eq('id', buddyId).single();
    return res.json({
      status: 'matched',
      match: {
        matchId: match.id,
        buddyName: buddy ? buddy.anonymous_name : '...',
        matchedAt: match.matched_at
      }
    });
  }

  var { data: poolEntry } = await supabase.from('match_pool').select('*').eq('user_id', userId).maybeSingle();
  if (poolEntry) return res.json({ status: 'waiting' });
  return res.json({ status: 'idle' });
}

async function handleCancel(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'login_required' });
  await supabase.from('match_pool').delete().eq('user_id', userId);
  return res.json({ status: 'cancelled' });
}

async function handleBreak(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'login_required' });
  var body = req.body || {};
  var farewell = body.farewell_message || '';

  var { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'active')
    .or('user_a.eq.' + userId + ',user_b.eq.' + userId)
    .maybeSingle();

  if (!match) return res.json({ status: 'no_active_match' });

  await supabase.from('matches').update({
    status: 'broken',
    broken_at: new Date().toISOString(),
    broken_by: userId,
    farewell_message: farewell
  }).eq('id', match.id);

  return res.json({ status: 'broken' });
}
