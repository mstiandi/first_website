/* Vercel Serverless — AI 音乐创作 API (DeepSeek 作词, 音频待上线) */

import supabase from '../lib/supabase.js';

var DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
var DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

// 积分定价常量（便于统一管理）
var COST = { SOUNDSCAPE: 25 };

var LYRIC_PROMPT = '你是一位词作人。用户现在的心情是「{mood}」{style}。请为ta写一首微音乐的歌词。\n' +
  '\n' +
  '【押韵要求】\n' +
  '- 采用 AABB 韵脚（第1、2行押韵，第3、4行押韵，依此类推）\n' +
  '- ang/eng/ong 适合开阔情绪，i/u 适合细腻情绪，an/en 适合沉静情绪\n' +
  '- 押韵要自然，不能为押而押、生造词语\n' +
  '\n' +
  '【节奏要求】\n' +
  '- 每行 7-10 个字，相邻行字数差不超过 2\n' +
  '\n' +
  '【内涵要求】\n' +
  '- 不直接说出情绪词（如"孤独""悲伤"），用场景暗示\n' +
  '- 要有具体画面：某个时间、某个地方、某个物件\n' +
  '- 四到六行完成一个小叙事：起（场景）→ 承（深入）→ 转（变化）→ 合（落点）\n' +
  '\n' +
  '【示范 1 — 孤独】\n' +
  '{"song_name": "凌晨的窗台",\n' +
  ' "lyrics": ["路灯醒着陪我到三点", "窗台上的灰又厚了一些",\n' +
  '           "手机里歌单循环一遍遍", "只是没等到你的来电",\n' +
  '           "天快亮了城市还在睡", "我和昨天一样没变"]}\n' +
  '\n' +
  '【示范 2 — 温暖】\n' +
  '{"song_name": "旧书店的猫",\n' +
  ' "lyrics": ["推开玻璃门风铃轻轻摇", "书架后面猫伸了个懒腰",\n' +
  '           "阳光正好洒在第三排的角", "你喜欢的书我找到了",\n' +
  '           "老板说这本已经放了很久", "好像在等人来把它带走"]}\n' +
  '\n' +
  '请按以上格式，为「{mood}」创作。严格输出JSON（不要markdown代码块）：\n' +
  '{"song_name":"歌名","lyrics":["第一行","第二行",...]}';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var urlParams = new URL(req.url, 'http://localhost').searchParams;
    var uid = body.user_id || urlParams.get('user_id') || null;
    var guestId = body.guest_id || urlParams.get('guest_id') || null;
    var userId = await resolveUserId(uid, guestId);

    if (req.method === 'GET') return handleGet(req, res, userId, urlParams, body);
    if (req.method === 'PUT') return handleRename(req, res, userId, body);
    if (req.method === 'DELETE') return handleDelete(req, res, userId);

    return handleCreate(req, res, userId, body);

  } catch (err) {
    console.error('Soundscape API error:', err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  }
}

async function resolveUserId(uid, guestId) {
  // 先通过 uid 查（可能是 profile.id）
  if (uid) {
    var { data: profile } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
    if (profile) return profile.id;
  }
  // 通过 guest_id 查
  if (guestId) {
    var { data: guestProfile } = await supabase.from('profiles').select('id').eq('guest_id', guestId).maybeSingle();
    if (guestProfile) return guestProfile.id;
  }
  return null;
}

/* ═══ 创作音乐（纯歌词模式） ═══ */
async function handleCreate(req, res, userId, body) {
  if (!userId) return res.status(401).json({ error: 'login_required' });

  var mood = body.mood || '平静';
  var stylePrompt = (body.style_prompt || '').trim();

  // 预检积分
  var { data: profileCheck } = await supabase
    .from('profiles').select('points').eq('id', userId).maybeSingle();
  var userPoints = profileCheck && profileCheck.points != null ? profileCheck.points : 0;
  if (userPoints < COST.SOUNDSCAPE) {
    return res.status(402).json({ error: '积分不足' });
  }

  // DeepSeek 作词
  var songName = mood + '的微光';
  var lyrics = [];
  var styleSuffix = stylePrompt ? '，用户想要的感觉是：' + stylePrompt : '';

  if (DEEPSEEK_KEY) {
    try {
      var lyricResp = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: LYRIC_PROMPT.replace(/{mood}/g, mood).replace('{style}', styleSuffix) }],
          max_tokens: 300, temperature: 0.7, stream: false
        })
      });
      if (lyricResp.ok) {
        var lyricData = await lyricResp.json();
        var raw = lyricData.choices[0].message.content.trim();
        raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        var parsed = JSON.parse(raw);
        if (parsed.song_name) songName = parsed.song_name;
        if (parsed.lyrics && Array.isArray(parsed.lyrics)) lyrics = parsed.lyrics;
      }
    } catch (e) {
      console.error('Lyric generation error:', e);
      lyrics = [mood + '的夜晚', '风吹过窗台', '我听见', '心底的回声'];
    }
  } else {
    lyrics = [mood + '的夜晚', '风吹过窗台', '我听见', '心底的回声'];
  }

  // 存库（音频待上线）
  var { data: record, error } = await supabase
    .from('user_soundscapes')
    .insert({
      user_id: userId, mood: mood, song_name: songName,
      lyrics: lyrics, style_prompt: stylePrompt || null,
      name: songName, audio_url: '', duration_seconds: 30
    })
    .select('id, song_name, lyrics, mood, style_prompt, created_at')
    .single();

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ error: 'create_failed' });
  }

  // 创作成功后扣积分
  try {
    var { data: profile } = await supabase
      .from('profiles').select('points').eq('id', userId).maybeSingle();
    var userPoints = profile && profile.points != null ? profile.points : 0;
    if (userPoints >= COST.SOUNDSCAPE) {
      await supabase.from('profiles').update({ points: userPoints - COST.SOUNDSCAPE }).eq('id', userId);
    }
  } catch (e) { console.error('Deduction error:', e); }

  return res.json({
    id: record.id, song_name: record.song_name,
    lyrics: record.lyrics, mood: record.mood,
    style_prompt: record.style_prompt, created_at: record.created_at
  });
}

/* ═══ 获取歌单 / 单曲详情 ═══ */
async function handleGet(req, res, userId, urlParams, body) {
  if (!userId) return res.json({ items: [] });

  var songId = body.id || urlParams.get('id') || null;

  if (songId) {
    var { data: song } = await supabase
      .from('user_soundscapes').select('*')
      .eq('id', songId).eq('user_id', userId).maybeSingle();

    var result = song ? {
      id: song.id, song_name: song.song_name || song.name,
      lyrics: song.lyrics || [], audio_url: song.audio_url || '',
      mood: song.mood, style_prompt: song.style_prompt,
      created_at: song.created_at
    } : null;

    if (result && userId) {
      var { data: prof } = await supabase
        .from('profiles').select('anonymous_name')
        .eq('id', userId).maybeSingle();
      result.creator_name = prof ? prof.anonymous_name : '';
    }

    return res.json(result || {});
  }

  var { data: songs } = await supabase
    .from('user_soundscapes')
    .select('id, song_name, name, lyrics, audio_url, mood, style_prompt, created_at, is_chat_bgm')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return res.json({ items: songs || [] });
}

/* ═══ 重命名 ═══ */
async function handleRename(req, res, userId, body) {
  if (!userId) return res.status(401).json({ error: 'login_required' });
  var songId = body.id;
  var newName = (body.song_name || '').trim();
  if (!songId || !newName) return res.status(400).json({ error: 'missing_params' });
  if (newName.length > 20) return res.status(400).json({ error: 'name_too_long' });

  var { data: existing } = await supabase
    .from('user_soundscapes').select('id')
    .eq('user_id', userId).eq('song_name', newName).neq('id', songId).maybeSingle();
  if (existing) return res.status(409).json({ error: 'duplicate_name' });

  await supabase.from('user_soundscapes').update({ song_name: newName, name: newName }).eq('id', songId).eq('user_id', userId);
  return res.json({ status: 'ok', song_name: newName });
}

/* ═══ 删除 ═══ */
async function handleDelete(req, res, userId) {
  if (!userId) return res.status(401).json({ error: 'login_required' });
  var path = req.url.split('?')[0];
  var segments = path.split('/').filter(Boolean);
  var id = parseInt(segments[segments.length - 1]);
  if (!id) return res.status(400).json({ error: 'missing_id' });
  await supabase.from('user_soundscapes').delete().eq('id', id).eq('user_id', userId);
  return res.json({ status: 'deleted' });
}
