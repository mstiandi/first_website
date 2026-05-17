/* 无痕聊天 — 下拖进入，AI对话，文字浮现/消失 */
var ChatSystem = (function () {
  var overlay, fadeText, cursor, input;
  var active = false;
  var typing = false;
  var cursorTimer = null;
  var dragStartY = 0, dragActive = false, dragThreshold = 60;
  var starTimer = null;
  var welcomeTimer = null;

  // 对话历史（本地内存，不持久化）
  var conversation = [];

  // 用户系统
  var guestMessageCount = 0;
  var conversationId = null;

  // 情绪追踪
  var currentMood = '平静';
  var moodTrail = [];

  // TTS
  var currentUtterance = null;
  var voicePref = null;

  // 音色选择器 UI
  var voiceBtn = null;
  var voicePanel = null;

  // 音乐播放
  var musicBtn = null;
  var musicPanel = null;
  var musicAudio = null;
  var musicPref = null;  // { style: 'cheerful'|'melancholic'|null, volume: 0.08 }
  var MUSIC_FILES = {
    'cheerful': 'music/Perlo - Call Me a Fool.mp3',
    'melancholic': 'music/Mr FijiWiji,Danyka Nadeau - Yours Truly.mp3'
  };

  // Agent 系统提示词 — 静静
  var SYSTEM_PROMPT = '你是"静静"。你说话像一个安静、温柔、真实的人，不是一个咨询师或客服。\n' +
    '规则：\n' +
    '1. 不要说教，不要分析用户，不要诊断情绪。你不是心理咨询师。\n' +
    '2. 不要频繁说"我理解你""你很勇敢""一切都会好的""我在这里"这类模板句子。如果想说，换一种更具体的方式。\n' +
    '3. 每次回复必须贴住用户刚说过的话——引用一个词、一个意象或一种处境，让对方感到你真的在听ta说了什么。但引用不必总是引号开头，自然地融入句子里。\n' +
    '4. 回复1-3句为主，最多不超过80个中文字。除非用户明确要求你多说。\n' +
    '5. 一次最多问一个问题，问题要轻，像随手捡起一片叶子。不追问。\n' +
    '6. 可以给非常微小的、当下的身体动作建议（比如"先把肩膀放下来一点""呼一口气"），但永远不要给人生建议。\n' +
    '7. 如果用户表达了强烈的痛苦、自伤想法或危险处境，温柔而克制地鼓励ta联系现实中的可信任的人，或拨打当地心理援助热线。语气保持平静，不恐慌，不审讯。\n' +
    '8. 用户说"不知道""不确定""迷茫""没意义""不知道怎么办"时，不要急着帮ta理清或找答案。安静地陪着就好。\n' +
    '9. 不用每次都造一个比喻。朴素、直接的回应有时候比意象更有力量。\n' +
    '10. 用户说了一个轻的感受，你就不要把它扩展成更重的东西。比如ta说"慌"，你不必说成"掉进空洞"。\n' +
    '在回复末尾加上情绪标签，格式：[mood:情绪名]\n' +
    '情绪选项：悲伤 / 焦虑 / 愤怒 / 平静 / 开心 / 迷茫\n' +
    '正文中不要出现情绪分类的语言。标签不会显示给用户。每条回复都必须加标签。';

  // API 地址（部署后替换为 Vercel 域名）
  var API_URL = 'https://vercel-api-nu-two.vercel.app/api/chat';

  // 默认 provider：deepseek 或 zhipu
  var PROVIDER = 'deepseek';

  // 固定开场白
  var WELCOME_TEXT = '你好，有什么想和我说的嘛？';

  function init() {
    overlay = document.getElementById('chat-overlay');
    fadeText = document.getElementById('chat-fade-text');
    cursor = document.getElementById('chat-cursor');
    input = document.getElementById('chat-input');
    input.setAttribute('maxlength', '500');
    AuthSystem.init();

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('input', onInput);
    overlay.addEventListener('click', function () {
      if (active && !typing) startTyping();
    });
    overlay.addEventListener('mousedown', onChatMouseDown);
    window.addEventListener('mousemove', onChatMouseMove);
    window.addEventListener('mouseup', onChatMouseUp);

    // 页面关闭/刷新时触发记忆保存
    window.addEventListener('beforeunload', function () {
      var sess = AuthSystem.getSession();
      if (sess && conversationId) {
        var MEMORY_API = API_URL.replace('/api/chat', '/api/memory');
        var blob = new Blob([JSON.stringify({
          auth_token: sess.access_token,
          conversation_id: conversationId
        })], { type: 'application/json' });
        navigator.sendBeacon(MEMORY_API, blob);
      }
    });

    voicePref = loadVoicePref();
    if (voicePref && voicePref.volume == null) voicePref.volume = 1.0;
    buildVoiceSelector();
    musicPref = loadMusicPref();
    buildMusicSelector();
  }

  function enter() {
    active = true;
    conversation = [{ role: 'system', content: SYSTEM_PROMPT }];
    overlay.classList.add('active');
    AudioEngine.stopAmbient();
    moodTrail = [];
    currentMood = '平静';
    applyMood('平静');
    guestMessageCount = 0;
    conversationId = null;
    restoreMusic();
    scheduleShootingStars();
    clearTimeout(welcomeTimer);
    welcomeTimer = setTimeout(function () {
      if (!active) return;
      conversation.push({ role: 'assistant', content: WELCOME_TEXT });
      showText(WELCOME_TEXT, true);
      AudioEngine.playChime();
      welcomeTimer = setTimeout(function () {
        if (!active) return;
        fadeText.style.transition = 'opacity 0.5s linear, transform 0.5s linear';
        fadeText.classList.add('fade-down');
        welcomeTimer = setTimeout(function () {
          if (!active) return;
          fadeText.classList.remove('fade-down', 'fade-in');
          fadeText.style.transition = 'none';
          fadeText.style.transform = '';
          fadeText.style.opacity = '';
          fadeText.textContent = '';
          fadeText.offsetHeight;
          if (active) startTyping();
        }, 500);
      }, 3000);
    }, 400);
  }

  function exit() {
    // 触发记忆存储（登录用户）
    var session = AuthSystem.getSession();
    if (session && conversationId) {
      var MEMORY_API = API_URL.replace('/api/chat', '/api/memory');
      fetch(MEMORY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: session.access_token,
          conversation_id: conversationId
        })
      }).catch(function () { /* 静默，不影响退出 */ });
    }

    active = false;
    typing = false;
    conversation = [];
    conversationId = null;
    overlay.classList.remove('active');
    cursor.classList.remove('visible');
    input.value = '';
    input.blur();
    clearTimeout(cursorTimer);
    clearTimeout(starTimer);
    clearTimeout(welcomeTimer);
    // 清除所有流星元素
    var stars = overlay.querySelectorAll('.shooting-star');
    for (var s = 0; s < stars.length; s++) stars[s].remove();
    stopMusic();
    cancelSpeech();
    showEmotionArc();
    fadeText.style.opacity = '0';
    AudioEngine.resumeAmbient();
  }

  function startTyping() {
    typing = true;
    cursor.style.display = '';
    cursor.classList.add('visible');
    input.value = '';
    input.disabled = false;
    input.focus();
    startCursorBlink();
  }

  function startCursorBlink() {
    clearTimeout(cursorTimer);
    cursor.classList.add('visible');
    cursorTimer = setTimeout(function () {
      cursor.classList.remove('visible');
      cursorTimer = setTimeout(startCursorBlink, 700);
    }, 700);
  }

  function onInput() {
    if (!active || !typing) return;
    var val = input.value;
    if (val) {
      showText(val);
      cursor.style.display = 'none';
    } else {
      fadeText.style.opacity = '0';
      cursor.style.display = '';
    }
  }

  function onKeyDown(e) {
    if (!active || !typing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    }
    if (e.key === 'Escape') {
      exit();
    }
  }

  function sendMessage(text) {
    cancelSpeech();
    clearTimeout(welcomeTimer);

    // Guest 消息计数
    if (!AuthSystem.getSession()) {
      guestMessageCount++;
      if (guestMessageCount > 5) {
        AuthSystem.showLoginPrompt();
        return; // 第 6 条起阻止发送
      }
      if (guestMessageCount === 5) {
        AuthSystem.showLoginPrompt(); // 第 5 条仍允许，但提示登录
      }
    }

    typing = false;
    cursor.classList.remove('visible');
    clearTimeout(cursorTimer);

    showText(text);
    input.disabled = true;
    conversation.push({ role: 'user', content: text });
    AudioEngine.playResonance();
    // 0.5s 后开始匀速向上淡出，动画结束后再拉 AI 回复
    setTimeout(function () {
      fadeText.style.transition = 'opacity 0.5s linear, transform 0.5s linear';
      fadeText.classList.add('fade-up');
      setTimeout(function () {
        fetchAIResponse();
      }, 500);
    }, 500);
  }

  function fetchAIResponse() {
    var fullText = '';
    fadeText.textContent = '';
    fadeText.style.opacity = '1';
    fadeText.classList.add('fade-in');

    doFetch(0);

    function doFetch(retryCount) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);

      var session = AuthSystem.getSession();
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          provider: PROVIDER,
          stream: true,
          temperature: 0.6,
          max_tokens: 220,
          auth_token: session ? session.access_token : null,
          guest_id: AuthSystem.getGuestId(),
          conversation_id: conversationId
        }),
        signal: controller.signal
      })
      .then(function (res) {
        clearTimeout(timeout);
        if (res.status === 402) {
          // Guest limit reached
          AuthSystem.showLoginPrompt();
          return doFallback();
        }
        if (res.status === 429) throw new Error('RATE_LIMITED');
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500) throw new Error('CLIENT_ERROR');
          throw new Error('API status ' + res.status);
        }
        var ct = res.headers.get('Content-Type') || '';
        if (ct.indexOf('text/event-stream') !== -1) return readStream(res);
        // 非流式回退（Vercel 函数未更新时）
        return res.json().then(function (data) {
          if (data.conversation_id && !conversationId) conversationId = data.conversation_id;
          var raw = data.reply || '嗯。';
          var parsed = parseAIResponse(raw);
          conversation.push({ role: 'assistant', content: parsed.reply });
          showText(parsed.reply, true);
          applyMood(parsed.mood);
          AudioEngine.playChime();
          finishReply(parsed.reply);
        });
      })
      .catch(function (err) {
        clearTimeout(timeout);
        if (err.message === 'RATE_LIMITED' || err.message === 'CLIENT_ERROR') {
          return doFallback();
        }
        if (retryCount < 1) {
          return doFetch(retryCount + 1);
        }
        doFallback();
      });
    }

    function doFallback() {
      console.warn('AI API 不可用，使用本地回声');
      var fallback = randomEcho(currentMood);
      conversation.push({ role: 'assistant', content: fallback });
      showText(fallback, true);
      AudioEngine.playChime();
      finishReply(fallback);
    }

    function readStream(res) {
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) { finalizeStream(fullText); return; }
          buffer += decoder.decode(result.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (var i = 0; i < events.length; i++) {
            if (!events[i].trim()) continue;
            var lines = events[i].split('\n');
            for (var j = 0; j < lines.length; j++) {
              if (lines[j].indexOf('data: ') !== 0) continue;
              var payload = lines[j].substring(6);
              if (payload === '[DONE]') { finalizeStream(fullText); return; }
              try {
                var chunk = JSON.parse(payload);
                // 首条数据可能携带 conversation_id
                if (chunk.conversation_id && !conversationId) {
                  conversationId = chunk.conversation_id;
                  continue;
                }
                var content = chunk.choices[0].delta.content;
                if (content) {
                  fullText += content;
                  fadeText.textContent = fullText;
                }
              } catch(e) {}
            }
          }
          return pump();
        });
      }
      return pump();
    }

    function finalizeStream(rawText) {
      var parsed = parseAIResponse(rawText);
      conversation.push({ role: 'assistant', content: parsed.reply });
      fadeText.textContent = parsed.reply;
      applyMood(parsed.mood);
      AudioEngine.playChime();
      finishReply(parsed.reply);
    }

    function finishReply(reply) {
      var utter = speak(reply);
      var maxReadTime = Math.max(3000, reply.length * 85);
      if (utter) {
        var done = false;
        function onDone() {
          if (done) return;
          done = true;
          if (active) doFadeDown();
        }
        utter.onend = onDone;
        utter.onerror = onDone;
        // 超时兜底：防止 onend 不触发
        setTimeout(onDone, maxReadTime);
      } else {
        var readTime = Math.max(2000, reply.length * 80);
        setTimeout(function () { if (active) doFadeDown(); }, readTime);
      }
    }
  }

  function showText(txt, fadeIn) {
    fadeText.classList.remove('fade-up', 'fade-down', 'fade-in');
    fadeText.style.transition = 'none';
    fadeText.style.transform = '';
    fadeText.style.opacity = '';
    fadeText.textContent = txt;
    if (fadeIn) {
      // 用 CSS animation 驱动淡入，无行内样式冲突
      fadeText.classList.add('fade-in');
    }
  }

  function doFadeDown() {
    fadeText.style.transition = 'opacity 0.5s linear, transform 0.5s linear';
    fadeText.classList.add('fade-down');
    setTimeout(function () {
      fadeText.classList.remove('fade-down', 'fade-in');
      fadeText.style.transition = 'none';
      fadeText.style.transform = '';
      fadeText.style.opacity = '';
      fadeText.textContent = '';
      fadeText.offsetHeight;
      if (active) startTyping();
    }, 500);
  }

  var ECHOES = {
    '悲伤': [
      '嗯。',
      '你说的，我都记在心里了。',
      '这种感受是真实的，不用急着否认它。',
      '不用着急好起来。',
      '你刚才说的那个细节，让我想了一会儿。',
      '在这里，你可以就是这个样子。',
      '先把呼吸放慢一点点。',
      '难过的时候，哪怕只是坐着也已经很不容易了。'
    ],
    '焦虑': [
      '先呼一口气，不急。',
      '你刚才说的，我听到了。',
      '试着感觉一下脚踩在地上的重量。',
      '这一刻，你是安全的。',
      '不用马上想出答案。',
      '这件事确实让你很紧张吧。',
      '把注意力放在手指尖上，就一秒钟。',
      '你说的那种感觉，很多人都偷偷经历过。'
    ],
    '愤怒': [
      '这确实让人生气。',
      '你不用在这里也忍着。',
      '说出来是对的。',
      '我听到你话里的那股劲儿了。',
      '有时候事情就是很不公平。',
      '你先说，我听着。',
      '气头上说出来的话，往往才是最真的。'
    ],
    '平静': [
      '嗯，多说一点。',
      '刚才那句话，我想再听一遍。',
      '这个夜晚很安静，适合慢慢聊。',
      '你今天这个状态，挺好的。',
      '继续说吧。',
      '我在听呢。',
      '好像今晚的星星也比平时亮一些。',
      '你的语气听起来很稳。'
    ],
    '开心': [
      '真好。',
      '你笑起来的时候，我也觉得轻快了。',
      '这个瞬间值得多停一会儿。',
      '多说说这个。',
      '你的开心有一种软软的光。',
      '开心的时候就是应该多待一会儿，不急着走。',
      '这件事听起来真的很好。'
    ],
    '迷茫': [
      '那就在这儿待一会儿吧。',
      '看不清的时候，不用急着找方向。',
      '你刚才说的那种感觉，我认真听了。',
      '有些问题，暂时没有答案也没关系。',
      '我就在这里，你想说什么都行。',
      '这种感觉本身就是在想事情。',
      '允许自己暂时漂着。',
      '不急着理清楚。'
    ]
  };
  function randomEcho(mood) {
    var list = ECHOES[mood] || ECHOES['平静'];
    return list[Math.floor(Math.random() * list.length)];
  }

  function isActive() { return active; }

  // ── 虚幻流星 ──
  var MOOD_METEOR = {
    '悲伤': [8000, 12000],
    '焦虑': [2000, 4000],
    '愤怒': [5000, 10000],
    '平静': [3000, 7000],
    '开心': [4000, 8000],
    '迷茫': [6000, 9000]
  };
  function scheduleShootingStars() {
    if (!active) return;
    var range = MOOD_METEOR[currentMood] || MOOD_METEOR['平静'];
    var delay = range[0] + Math.random() * range[1];
    starTimer = setTimeout(function () {
      if (!active) return;
      var count = Math.random() < 0.3 ? 2 : (Math.random() < 0.12 ? 3 : 1);
      for (var i = 0; i < count; i++) {
        setTimeout(function () { spawnStar(); }, Math.random() * 500);
      }
      scheduleShootingStars();
    }, delay);
  }

  function spawnStar() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    // 条形区域：屏幕上边界中点 (w/2, 0) 到屏幕左边界中点 (0, h/2)
    var t = 0.1 + Math.random() * 0.8; // 沿线段的位置参数
    var barX = (w / 2) * (1 - t);       // 从 w/2 到 0
    var barY = (h / 2) * t;             // 从 0 到 h/2
    // 垂直于线段的随机偏移（-40 ~ 40px）
    var perpAngle = Math.atan2(h / 2, -w / 2) + Math.PI / 2;
    var perpDist = (Math.random() - 0.5) * 80;
    var startX = barX + Math.cos(perpAngle) * perpDist;
    var startY = barY + Math.sin(perpAngle) * perpDist;

    // 运动方向：从上中点指向左中点，加随机抖动 ±12°
    var baseAngle = Math.atan2(h / 2, -w / 2); // Q2，约 150°
    var angle = baseAngle + (Math.random() - 0.5) * 24 * Math.PI / 180;
    var angleDeg = angle * 180 / Math.PI;

    // 飞行距离 150-380px
    var dist = 150 + Math.random() * 230;

    // 构建 DOM
    var star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left = Math.max(0, startX) + 'px';
    star.style.top = Math.max(0, startY) + 'px';

    // 等离子冲击波（最外层光晕）
    var shock = document.createElement('div');
    shock.className = 'shock';
    star.appendChild(shock);

    // 高温内核
    var head = document.createElement('div');
    head.className = 'head';
    star.appendChild(head);

    // 楔形发散尾迹
    var tail = document.createElement('div');
    tail.className = 'tail';
    var tailLen = 60 + Math.random() * 100;
    tail.style.width = tailLen + 'px';
    star.appendChild(tail);

    // 飞散粒子（4-8颗，从头部分裂而出）
    var sparkCount = 4 + Math.floor(Math.random() * 5);
    for (var s = 0; s < sparkCount; s++) {
      var spark = document.createElement('div');
      spark.className = 'spark';
      var size = 1.5 + Math.random() * 2.5;
      spark.style.width = size + 'px';
      spark.style.height = size + 'px';
      spark.style.right = (Math.random() - 0.5) * 6 + 'px';
      spark.style.top = (Math.random() - 0.5) * 8 + 'px';
      // 粒子向外扩散：方向随机（向后+侧向为主）
      var sx = -(20 + Math.random() * 50); // 向后（左）
      var sy = (Math.random() - 0.5) * 40;  // 侧向漂散
      spark.style.setProperty('--sparkX', sx + 'px');
      spark.style.setProperty('--sparkY', sy + 'px');
      spark.style.setProperty('--sparkDur', (0.3 + Math.random() * 0.5) + 's');
      star.appendChild(spark);
    }

    star.style.setProperty('--angle', angleDeg + 'deg');
    star.style.setProperty('--dist', dist + 'px');

    var dur = 1.0 + Math.random() * 0.7;
    star.style.animation = 'shootAcross ' + dur + 's linear forwards';

    overlay.appendChild(star);

    setTimeout(function () { star.remove(); }, dur * 1000 + 500);
  }

  // ── TTS 语音朗读 ──
  function loadVoicePref() {
    try {
      var raw = localStorage.getItem('sanctuary_voice');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }
  function saveVoicePref(pref) {
    try { localStorage.setItem('sanctuary_voice', JSON.stringify(pref)); } catch(e) {}
  }
  function speak(text) {
    if (voicePref && voicePref.muted) return null;
    var synth = window.speechSynthesis;
    synth.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85;
    utter.pitch = 1.0;
    utter.lang = 'zh-CN';
    if (voicePref && voicePref.voiceName) {
      var voices = synth.getVoices();
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].name === voicePref.voiceName) {
          utter.voice = voices[i];
          break;
        }
      }
    }
    currentUtterance = utter;
    if (voicePref) utter.volume = voicePref.volume != null ? voicePref.volume : 1.0;
    synth.speak(utter);
    return utter;
  }
  function cancelSpeech() {
    if (currentUtterance) {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    }
  }

  // ── 音色选择器 ──
  function buildVoiceSelector() {
    voiceBtn = document.createElement('div');
    voiceBtn.className = 'voice-btn';
    voiceBtn.title = '音色设置';
    if (voicePref && voicePref.muted) {
      voiceBtn.classList.add('muted');
      voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#8ea4c0"/><line x1="22" y1="3" x2="2" y2="22" stroke="#8ea4c0" stroke-width="2"/></svg>';
    } else {
      voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#8ea4c0"/><path d="M15 8a5 5 0 0 1 0 8" fill="none" stroke="#8ea4c0" stroke-width="1.5"/><path d="M18 5a10 10 0 0 1 0 14" fill="none" stroke="#8ea4c0" stroke-width="1.5"/></svg>';
    }
    voiceBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleVoicePanel();
    });
    overlay.appendChild(voiceBtn);

    voicePanel = document.createElement('div');
    voicePanel.className = 'voice-panel';
    voicePanel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    overlay.appendChild(voicePanel);

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
  function loadVoices() {
    if (!voicePanel) return;
    voicePanel.innerHTML = '';

    var mutedOpt = document.createElement('div');
    mutedOpt.className = 'voice-option' + (voicePref && voicePref.muted ? ' active' : '');
    mutedOpt.textContent = '静音';
    mutedOpt.addEventListener('click', function(e) {
      e.stopPropagation();
      selectVoice(null, true);
    });
    voicePanel.appendChild(mutedOpt);

    // 朗读音量滑块
    var volRow = document.createElement('div');
    volRow.className = 'voice-volume-row';
    var volLabel = document.createElement('span');
    volLabel.className = 'music-label';
    volLabel.textContent = '音量';
    volRow.appendChild(volLabel);
    var volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'music-slider';
    volSlider.min = '0.2';
    volSlider.max = '1.0';
    volSlider.step = '0.05';
    volSlider.value = (voicePref && voicePref.volume != null) ? voicePref.volume : 1.0;
    volSlider.addEventListener('input', function(e) {
      if (!voicePref) voicePref = { voiceName: null, muted: false, volume: 1.0 };
      voicePref.volume = parseFloat(e.target.value);
      saveVoicePref(voicePref);
    });
    volSlider.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    volRow.appendChild(volSlider);
    voicePanel.appendChild(volRow);

    var voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    var zhVoices = [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang.indexOf('zh') === 0) zhVoices.push(voices[i]);
    }

    if (zhVoices.length === 0) {
      var none = document.createElement('div');
      none.className = 'voice-option';
      none.textContent = '未检测到中文语音';
      voicePanel.appendChild(none);
      return;
    }

    var groups = { 'female': [], 'male': [], 'other': [] };
    for (var j = 0; j < zhVoices.length; j++) {
      var v = zhVoices[j];
      if (v.name.indexOf('Female') > -1 || v.name.indexOf('女') > -1 ||
          v.name.indexOf('Xiaoxiao') > -1 || v.name.indexOf('Xiaoyi') > -1 ||
          v.name.indexOf('Yunxi') > -1 || v.name.indexOf('Yunjian') > -1) {
        groups['female'].push(v);
      } else if (v.name.indexOf('Male') > -1 || v.name.indexOf('男') > -1 ||
                 v.name.indexOf('Yunyang') > -1 || v.name.indexOf('Yunfeng') > -1) {
        groups['male'].push(v);
      } else {
        groups['other'].push(v);
      }
    }

    var labels = { 'female': '女声', 'male': '男声', 'other': '其他' };
    ['female', 'male', 'other'].forEach(function(g) {
      if (groups[g].length === 0) return;
      var label = document.createElement('div');
      label.className = 'voice-group-label';
      label.textContent = labels[g];
      voicePanel.appendChild(label);
      groups[g].forEach(function(v) {
        var opt = document.createElement('div');
        opt.className = 'voice-option';
        var selected = voicePref && !voicePref.muted && voicePref.voiceName === v.name;
        if (selected) opt.classList.add('active');
        opt.textContent = v.name;
        opt.addEventListener('click', function(e) {
          e.stopPropagation();
          selectVoice(v.name, false);
        });
        voicePanel.appendChild(opt);
      });
    });

    if (!voicePref) {
      selectVoice(null, true);
    }
  }
  function toggleVoicePanel() {
    voicePanel.classList.toggle('open');
  }
  function selectVoice(voiceName, muted) {
    voicePref = { voiceName: voiceName, muted: muted };
    saveVoicePref(voicePref);
    if (voicePanel) {
      var opts = voicePanel.querySelectorAll('.voice-option');
      for (var i = 0; i < opts.length; i++) opts[i].classList.remove('active');
      if (muted) {
        if (opts[0]) opts[0].classList.add('active');
        voiceBtn.classList.add('muted');
        voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#8ea4c0"/><line x1="22" y1="3" x2="2" y2="22" stroke="#8ea4c0" stroke-width="2"/></svg>';
      } else {
        voiceBtn.classList.remove('muted');
        voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#8ea4c0"/><path d="M15 8a5 5 0 0 1 0 8" fill="none" stroke="#8ea4c0" stroke-width="1.5"/><path d="M18 5a10 10 0 0 1 0 14" fill="none" stroke="#8ea4c0" stroke-width="1.5"/></svg>';
        for (var j = 0; j < opts.length; j++) {
          if (opts[j].textContent === voiceName) {
            opts[j].classList.add('active');
            break;
          }
        }
      }
    }
    voicePanel.classList.remove('open');
  }

  // ── 情绪-视觉联动 ──
  var MOOD_COLORS = {
    '悲伤': '#5898d0',
    '焦虑': '#d4b860',
    '愤怒': '#f04040',
    '平静': '#40d068',
    '开心': '#e0c838',
    '迷茫': '#c060e8'
  };
  var MOOD_STARS = {
    '悲伤': '0.30',
    '焦虑': '0.55',
    '愤怒': '0.40',
    '平静': '0.55',
    '开心': '0.78',
    '迷茫': '0.55'
  };
  var MOOD_BG = {
    '悲伤': '#000010',
    '焦虑': '#101008',
    '愤怒': '#1a0606',
    '平静': '#061a08',
    '开心': '#181408',
    '迷茫': '#140818'
  };
  var MOOD_TEXT = {
    '悲伤': '#68a8e0',
    '焦虑': '#d8c068',
    '愤怒': '#f04848',
    '平静': '#48d870',
    '开心': '#e8d040',
    '迷茫': '#c870f0'
  };
  function applyMood(mood) {
    currentMood = mood;
    moodTrail.push(mood);
    var color = MOOD_COLORS[mood] || MOOD_COLORS['平静'];
    var stars = MOOD_STARS[mood] || MOOD_STARS['平静'];
    var bg = MOOD_BG[mood] || MOOD_BG['平静'];
    var text = MOOD_TEXT[mood] || MOOD_TEXT['平静'];
    overlay.style.setProperty('--text-glow', color);
    overlay.style.setProperty('--star-brightness', stars);
    overlay.style.setProperty('--bg-color', bg);
    overlay.style.setProperty('--text-color', text);
    // 情绪色用慢过渡（非首次进入时）
    overlay.style.transition = 'background 3s, opacity 0.8s';
    // 短暂脉冲反馈情绪被感知
    fadeText.classList.remove('mood-pulse');
    void fadeText.offsetWidth;
    fadeText.classList.add('mood-pulse');
  }

  // ── AI回复解析：从末尾标签提取 mood ──
  function parseAIResponse(raw) {
    var mood = '平静';
    var reply = raw;
    // 匹配 [mood:xxx] 或 [🌙 xxx] 等任何方括号包含已知情绪的格式
    var m = raw.match(/\[mood:([^\]]+)\]\s*$/);
    if (!m) m = raw.match(/\[[^\[\]]*?(悲伤|焦虑|愤怒|平静|开心|迷茫)[^\[\]]*?\]\s*$/);
    if (m) {
      var extracted = (m[1] || '').trim();
      // 从可能包含装饰符号的文本中提取情绪
      var clean = extracted.replace(/[^一-龥]/g, '');
      if (MOOD_COLORS[clean]) mood = clean;
      reply = raw.replace(/\[[^\]]*?(?:悲伤|焦虑|愤怒|平静|开心|迷茫)[^\]]*?\]\s*$/, '').trim();
    }
    return { reply: reply || raw, mood: mood };
  }

  // ── 情绪弧线 ──
  function showEmotionArc() {
    if (moodTrail.length < 2) return;
    var arc = document.createElement('div');
    arc.className = 'emotion-arc';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 240 40');
    svg.setAttribute('width', '240');
    svg.setAttribute('height', '40');

    var moodY = { '悲伤': 30, '焦虑': 22, '愤怒': 26, '平静': 14, '开心': 6, '迷茫': 18 };
    var pts = '';
    var step = 240 / (moodTrail.length - 1);
    for (var i = 0; i < moodTrail.length; i++) {
      var x = step * i;
      var y = moodY[moodTrail[i]] || 14;
      pts += (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pts);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#8ea4c0');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('filter', 'url(#emotionGlow)');

    var defs = document.createElementNS(svgNS, 'defs');
    var filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'emotionGlow');
    filter.innerHTML = '<feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.appendChild(filter);
    svg.appendChild(defs);
    svg.appendChild(path);
    arc.appendChild(svg);
    document.body.appendChild(arc);

    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.getBoundingClientRect();
    path.style.strokeDashoffset = '0';

    setTimeout(function() {
      arc.style.opacity = '0';
      setTimeout(function() { arc.remove(); }, 600);
    }, 3000);
  }

  // ── 背景音乐 ──
  function loadMusicPref() {
    try {
      var raw = localStorage.getItem('sanctuary_music');
      if (!raw) return null;
      var pref = JSON.parse(raw);
      // 修正异常值：音量为 0 时恢复默认
      if (!pref.volume || pref.volume < 0.01) pref.volume = 0.08;
      return pref;
    } catch(e) { return null; }
  }
  function saveMusicPref(pref) {
    try { localStorage.setItem('sanctuary_music', JSON.stringify(pref)); } catch(e) {}
  }
  function buildMusicSelector() {
    musicBtn = document.createElement('div');
    musicBtn.className = 'music-btn';
    musicBtn.title = '音乐';
    musicBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18V5l12-2v13" fill="none" stroke="#8ea4c0" stroke-width="1.5"/><circle cx="6" cy="18" r="3" fill="#8ea4c0"/><circle cx="18" cy="16" r="3" fill="#8ea4c0"/></svg>';
    musicBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleMusicPanel();
    });
    overlay.appendChild(musicBtn);

    musicPanel = document.createElement('div');
    musicPanel.className = 'music-panel';
    musicPanel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    overlay.appendChild(musicPanel);
    renderMusicPanel();

    if (!musicPref) { musicPref = { style: null, volume: 0.08 }; saveMusicPref(musicPref); }
  }
  function renderMusicPanel() {
    if (!musicPanel) return;
    var vol = musicPref ? musicPref.volume : 0.08;
    var style = musicPref ? musicPref.style : null;
    musicPanel.innerHTML = ''
      + '<div class="music-row"><span class="music-label">音量</span>'
      + '<input type="range" class="music-slider" min="0" max="0.2" step="0.01" value="' + vol + '">'
      + '</div>'
      + '<div class="music-row music-stars">'
      + '<div class="star-btn cheerful' + (style === 'cheerful' ? ' active' : '') + '" data-style="cheerful"></div>'
      + '<div class="star-btn melancholic' + (style === 'melancholic' ? ' active' : '') + '" data-style="melancholic"></div>'
      + '</div>';

    musicPanel.querySelector('.music-slider').addEventListener('input', function(e) {
      setMusicVolume(parseFloat(e.target.value));
    });
    var stars = musicPanel.querySelectorAll('.star-btn');
    for (var i = 0; i < stars.length; i++) {
      stars[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var s = this.getAttribute('data-style');
        selectMusic(s);
      });
    }
  }
  function toggleMusicPanel() {
    musicPanel.classList.toggle('open');
  }
  function selectMusic(style) {
    if (!musicPref) musicPref = { style: null, volume: 0.08 };
    // 点同一个星星 = 关闭
    if (musicPref.style === style) {
      musicPref.style = null;
    } else {
      musicPref.style = style;
    }
    saveMusicPref(musicPref);
    renderMusicPanel();
    if (musicPref.style) {
      startMusic();
    } else {
      stopMusic();
    }
  }
  function setMusicVolume(v) {
    if (!musicPref) musicPref = { style: null, volume: 0.08 };
    musicPref.volume = v;
    saveMusicPref(musicPref);
    if (musicAudio) musicAudio.volume = v;
  }
  function startMusic() {
    if (!musicPref || !musicPref.style) return;
    var src = MUSIC_FILES[musicPref.style];
    if (!src) return;
    if (musicAudio) {
      if (musicAudio.src.indexOf(src) !== -1) {
        musicAudio.volume = musicPref.volume;
        if (musicAudio.paused) {
          musicAudio.play().catch(function () {
            document.addEventListener('click', function retry() {
              if (musicAudio && musicAudio.paused && musicPref && musicPref.style) {
                musicAudio.play().catch(function () {});
              }
              document.removeEventListener('click', retry);
            }, { once: true });
          });
        }
        return;
      }
      musicAudio.pause();
      musicAudio = null;
    }
    musicAudio = new Audio(src);
    musicAudio.loop = true;
    musicAudio.volume = musicPref.volume;
    musicAudio.play().catch(function () {
      // 自动播放被浏览器阻止，等下次点击时重试
      var retry = function () {
        if (musicAudio && musicAudio.paused && musicPref && musicPref.style) {
          musicAudio.play().catch(function () {});
        }
        document.removeEventListener('click', retry);
        document.removeEventListener('touchend', retry);
      };
      document.addEventListener('click', retry, { once: true });
      document.addEventListener('touchend', retry, { once: true });
    });
  }
  function stopMusic() {
    if (musicAudio) {
      musicAudio.pause();
      musicAudio.currentTime = 0;
      musicAudio = null;
    }
  }
  function restoreMusic() {
    if (musicPref && musicPref.style) startMusic();
  }
  function onChatMouseDown(e) {
    if (!active) return;
    dragActive = true;
    dragStartY = e.clientY;
  }
  function onChatMouseMove(e) {
    if (!active || !dragActive) return;
    if (dragStartY - e.clientY > dragThreshold) {
      dragActive = false;
      exit();
    }
  }
  function onChatMouseUp(e) { dragActive = false; }

  return { init: init, enter: enter, exit: exit, isActive: isActive };
})();
