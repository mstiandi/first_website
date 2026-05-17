import supabase from './supabase.js';

var MEMORY_SUMMARY_PROMPT = '你是一个记忆提取工具。根据以下对话，提取出2-3条简洁的记忆碎片，每条不超过50个中文字。\n' +
  '关注：用户表达了什么情绪、聊了什么话题、有什么偏好或习惯。\n' +
  '直接输出记忆碎片，每行一条，不要编号，不要解释。\n\n' +
  '对话内容：\n';

var PROFILE_PROMPT = '你是一个用户画像生成工具。根据以下用户的记忆碎片，生成一段简洁的用户画像。\n' +
  '用"你"开头（你在对用户说话），描述用户的主要性格特点、常聊话题、情绪模式、表达风格。\n' +
  '不超过180字。语言温柔平实，像朋友间的观察。\n\n' +
  '记忆碎片：\n';

var DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
var DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

function callDeepSeek(prompt, maxTokens) {
  if (!DEEPSEEK_KEY) return Promise.reject(new Error('No API key'));
  return fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_KEY
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 300,
      temperature: 0.3,
      stream: false
    })
  }).then(function (r) { return r.json(); })
    .then(function (data) { return data.choices[0].message.content.trim(); });
}

// ── 记忆注入：构建附加到 system prompt 的上下文 ──
export async function buildMemoryContext(userId, currentMessage) {
  if (!userId) return '';

  try {
    var parts = [];

    // 用户画像
    var { data: profile } = await supabase
      .from('user_profiles')
      .select('summary')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile && profile.summary) {
      parts.push('[关于你正在交谈的人]\n' + profile.summary);
    }

    // 近 3 次会话摘要
    var { data: recentConvs } = await supabase
      .from('conversations')
      .select('summary')
      .eq('user_id', userId)
      .not('summary', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(3);
    if (recentConvs && recentConvs.length) {
      var summaries = recentConvs.map(function (c) { return '- ' + c.summary; }).join('\n');
      parts.push('[你们最近的对话]\n' + summaries);
    }

    // 记忆碎片：最近5条 + 关键词匹配3条
    var { data: allMemories } = await supabase
      .from('memories')
      .select('id, content, importance')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (allMemories && allMemories.length) {
      var recent = allMemories.slice(0, 5);
      // 简单关键词匹配
      var keywords = tokenize(currentMessage || '');
      var scored = allMemories.map(function (m) {
        var score = keywordOverlap(keywords, tokenize(m.content));
        return { content: m.content, score: score, importance: m.importance };
      });
      scored.sort(function (a, b) { return (b.score + b.importance) - (a.score + a.importance); });
      var relevant = scored.slice(0, 3).filter(function (s) { return s.score > 0; });

      // 合并去重
      var seen = {};
      var merged = [];
      [recent, relevant].forEach(function (group) {
        group.forEach(function (m) {
          var key = (m.content || '').substring(0, 20);
          if (!seen[key]) { seen[key] = true; merged.push(m.content); }
        });
      });

      if (merged.length) {
        var memoryText = merged.slice(0, 6).map(function (c) { return '- ' + c; }).join('\n');
        parts.push('[与当前话题相关的回忆]\n' + memoryText);
      }
    }

    return parts.length ? '\n\n' + parts.join('\n\n') : '';
  } catch (e) {
    console.error('buildMemoryContext error:', e);
    return '';
  }
}

// ── 总结对话 → 记忆碎片 ──
export async function summarizeConversation(conversationId, userId) {
  try {
    // 标记会话结束
    await supabase.from('conversations')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId);

    // 读消息
    var { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 3) return;

    var dialog = messages.map(function (m) { return (m.role === 'user' ? '用户' : '静静') + '：' + m.content; }).join('\n');
    var result = await callDeepSeek(MEMORY_SUMMARY_PROMPT + '\n' + dialog.substring(0, 3000), 250);

    var fragments = result.split('\n').filter(function (l) { return l.trim(); }).slice(0, 3);
    if (!fragments.length) return;

    var rows = fragments.map(function (f) {
      return { user_id: userId, content: f.trim(), source_conversation_id: conversationId };
    });
    await supabase.from('memories').insert(rows);

    // 会话摘要
    var summary = fragments.map(function (f) { return f.trim(); }).join('；');
    await supabase.from('conversations')
      .update({ summary: summary })
      .eq('id', conversationId);

    console.log('Memory: stored', fragments.length, 'fragments for user', userId);
  } catch (e) {
    console.error('summarizeConversation error:', e);
  }
}

// ── 用户画像更新（每5次会话触发一次）──
export async function maybeUpdateProfile(userId) {
  try {
    // 更新 session 计数
    var { data: prof } = await supabase
      .from('user_profiles')
      .select('session_count')
      .eq('user_id', userId)
      .maybeSingle();

    var count = (prof ? prof.session_count : 0) + 1;

    if (count % 5 !== 0 && prof) {
      // 仅更新计数
      await supabase.from('user_profiles')
        .update({ session_count: count, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      return;
    }

    // 每 5 次生成/更新画像
    var { data: memories } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!memories || !memories.length) return;

    var memoryText = memories.map(function (m) { return '- ' + m.content; }).join('\n');
    var summary = await callDeepSeek(PROFILE_PROMPT + '\n' + memoryText, 350);

    await supabase.from('user_profiles').upsert({
      user_id: userId,
      summary: summary,
      session_count: count,
      last_summarized_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log('Memory: updated profile for user', userId);
  } catch (e) {
    console.error('maybeUpdateProfile error:', e);
  }
}

// ── 处理未总结的会话（在新会话开始时调用）──
export async function summarizePendingConversations(userId, excludeConversationId) {
  try {
    var query = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .is('ended_at', null);
    if (excludeConversationId) {
      query = query.neq('id', excludeConversationId);
    }
    var { data: pending } = await query.order('started_at', { ascending: true });

    if (!pending || !pending.length) return;

    for (var i = 0; i < pending.length; i++) {
      await summarizeConversation(pending[i].id, userId);
    }
  } catch (e) {
    console.error('summarizePendingConversations error:', e);
  }
}

function tokenize(text) {
  if (!text) return [];
  // 混合中英文分词：英文按空格，中文取双字组合
  var tokens = [];
  var cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, ' ');
  var enTokens = cleaned.match(/[a-zA-Z]+/g) || [];
  tokens = tokens.concat(enTokens.map(function (t) { return t.toLowerCase(); }));
  var cnChars = cleaned.replace(/[a-zA-Z0-9\s]/g, '');
  for (var i = 0; i < cnChars.length - 1; i++) {
    tokens.push(cnChars.substring(i, i + 2));
  }
  return tokens;
}

function keywordOverlap(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  var setB = {};
  for (var i = 0; i < tokensB.length; i++) setB[tokensB[i]] = true;
  var hits = 0;
  for (var j = 0; j < tokensA.length; j++) {
    if (setB[tokensA[j]]) hits++;
  }
  return hits / Math.max(tokensA.length, 1);
}
