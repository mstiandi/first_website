/* Vercel Serverless — 登录 API (微信 code → openid + 用户创建) */

import supabase from '../lib/supabase.js';

var WX_APPID = process.env.WX_APPID || '';
var WX_SECRET = process.env.WX_SECRET || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var code = body.code;
    var guestId = body.guest_id;

    // 微信 code 换 openid
    var openid = null;
    if (code && WX_APPID && WX_SECRET) {
      var wxUrl = 'https://api.weixin.qq.com/sns/jscode2session' +
        '?appid=' + WX_APPID +
        '&secret=' + WX_SECRET +
        '&js_code=' + code +
        '&grant_type=authorization_code';
      var wxRes = await fetch(wxUrl);
      var wxData = await wxRes.json();
      if (wxData.openid) {
        openid = wxData.openid;
      }
    }

    // 兜底: 用 guestId
    var userId = openid || guestId;
    if (!userId) {
      return res.status(400).json({ error: 'missing_identity' });
    }

    return await createOrGetUser(res, userId, openid, body);

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function createOrGetUser(res, userId, isOpenid, body) {
  // 查找已有用户
  var query = supabase
    .from('profiles')
    .select('id, anonymous_name, tags, gender, points, free_soundscapes, free_matches');

  query = query.eq('openid', userId);

  var { data: existing } = await query.limit(1);

  if (existing && existing.length > 0) {
    var user = existing[0];
    // 如果是微信授权登录，更新头像和昵称
    var userInfo = body.user_info;
    var updates = {};
    if (body.guest_id) updates.guest_id = body.guest_id;
    if (userInfo && isOpenid) {
      var nick = (userInfo.nickName && userInfo.nickName !== '微信用户') ? userInfo.nickName : null;
      updates.anonymous_name = user.anonymous_name || nick;
      updates.avatar_url = userInfo.avatarUrl;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
    return res.json({
      user_id: user.id,
      access_token: user.id,
      anonymous_name: userInfo ? (user.anonymous_name || userInfo.nickName) : user.anonymous_name,
      avatar_url: userInfo ? userInfo.avatarUrl : null,
      tags: user.tags,
      gender: user.gender,
      points: user.points,
      free_soundscapes: user.free_soundscapes,
      free_matches: user.free_matches
    });
  }

  // 创建新用户
  var userInfo = body.user_info;
  var rawName = (userInfo && userInfo.nickName) || '';
  var isDefault = !rawName || rawName === '微信用户';
  var name = isDefault ? ('萤火虫' + Math.floor(Math.random() * 9999)) : rawName;
  var avatar = (userInfo && userInfo.avatarUrl) ? userInfo.avatarUrl : null;

  var { data: newUser, error } = await supabase
    .from('profiles')
    .insert({
      openid: userId,
      guest_id: body.guest_id || null,
      anonymous_name: name,
      avatar_url: avatar,
      tags: [],
      gender: 'secret',
      points: 100,
      free_soundscapes: 2,
      free_matches: 1
    })
    .select('id, anonymous_name, tags, gender, points, free_soundscapes, free_matches')
    .single();

  if (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'create_user_failed' });
  }

  return res.json({
    user_id: newUser.id,
    access_token: newUser.id,
    anonymous_name: newUser.anonymous_name,
    tags: newUser.tags,
    gender: newUser.gender,
    points: newUser.points,
    free_soundscapes: newUser.free_soundscapes,
    free_matches: newUser.free_matches
  });
}
