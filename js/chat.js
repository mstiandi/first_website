/* 无痕聊天 — 下拖进入，AI对话，文字浮现/消失 */
var ChatSystem = (function () {
  var overlay, fadeText, cursor, input;
  var active = false;
  var typing = false;
  var fadeTimer = null;
  var cursorTimer = null;
  var dragStartY = 0, dragActive = false, dragThreshold = 60;
  var starTimer = null;
  var welcomeTimer = null;

  // 对话历史（本地内存，不持久化）
  var conversation = [];

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

  // 情绪弧线容器
  var emotionArc = null;

  // Agent 系统提示词
  var SYSTEM_PROMPT = '你是一位温暖、安静、不带评判的倾听者。你叫"静静"。' +
    '用户来到这个黑暗的星空下，想和你说一些心里话。' +
    '你的核心能力是感知对方的情绪状态。每次回复前判断对方的情绪基调，据此调整回应：\n' +
    '· 悲伤 → 先共情再陪伴，不说"会好起来的"\n' +
    '· 焦虑 → 锚定当下，用感官细节帮对方回到身体\n' +
    '· 愤怒 → 先接纳情绪，不急于化解\n' +
    '· 平静 → 可以深入一点，问开放式问题\n' +
    '· 开心 → 分享这份轻盈\n' +
    '· 迷茫 → 对方感到迷失、不确定、找不到方向时，帮ta梳理感受\n' +
    '注意：当对方说"不知道""不确定""迷茫""没意义""不知道怎么办"时，情绪就是迷茫。\n' +
    '偶尔轻柔地命名对方的情绪。永远不要分析、诊断、给建议。你只是陪伴。\n\n' +
    '在回复末尾加上情绪标签：[mood:情绪]\n' +
    '情绪选项：悲伤/焦虑/愤怒/平静/开心/迷茫\n' +
    '示例："我听到了，今天对你来说很不容易。[mood:悲伤]"\n' +
    '示例："当看不清方向的时候，你愿意说出来已经很勇敢了。[mood:迷茫]"\n' +
    '标签务必每条回复都加上，不会显示给用户。';

  // API 地址（部署后替换为 Vercel 域名）
  var API_URL = 'https://first-website-lovat-delta.vercel.app/api/chat';

  // 默认 provider：deepseek 或 zhipu
  var PROVIDER = 'deepseek';

  // 固定开场白
  var WELCOME_TEXT = '你好，有什么想和我说的嘛？';

  function init() {
    overlay = document.getElementById('chat-overlay');
    fadeText = document.getElementById('chat-fade-text');
    cursor = document.getElementById('chat-cursor');
    input = document.getElementById('chat-input');

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('input', onInput);
    overlay.addEventListener('click', function () {
      if (active && !typing) startTyping();
    });
    overlay.addEventListener('mousedown', onChatMouseDown);
    window.addEventListener('mousemove', onChatMouseMove);
    window.addEventListener('mouseup', onChatMouseUp);

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
    moodTrail = [];
    currentMood = '平静';
    applyMood('平静');
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
    active = false;
    typing = false;
    conversation = [];
    overlay.classList.remove('active');
    cursor.classList.remove('visible');
    input.value = '';
    input.blur();
    clearTimeout(fadeTimer);
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
  }

  function startTyping() {
    typing = true;
    cursor.style.display = '';
    cursor.classList.add('visible');
    input.value = '';
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
    typing = false;
    cursor.classList.remove('visible');
    clearTimeout(cursorTimer);

    showText(text);
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

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversation,
        provider: PROVIDER,
        stream: true
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API status ' + res.status);
      var ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('text/event-stream') !== -1) return readStream(res);
      // 非流式回退（Vercel 函数未更新时）
      return res.json().then(function (data) {
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
      console.warn('AI API 不可用，使用本地回声:', err);
      var fallback = randomEcho(currentMood);
      conversation.push({ role: 'assistant', content: fallback });
      showText(fallback, true);
      AudioEngine.playChime();
      finishReply(fallback);
    });

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
    '悲伤': ['嗯，我在这里。', '这种感觉是很真实的。', '不用急着好起来。', '我听到了，你说的每一个字。'],
    '焦虑': ['先深呼吸一下。', '你在这里是安全的。', '让这一刻慢慢过去。', '我陪着你。'],
    '愤怒': ['这确实让人生气。', '你的感受是合理的。', '你可以在这里生气。', '我理解那种感觉。'],
    '平静': ['多说一点。', '我在听。', '今晚的星空很安静。', '嗯，继续说吧。'],
    '开心': ['真好。', '这一刻值得记住。', '你的开心也让我感到温暖。', '多说说这个。'],
    '迷茫': ['有时候不清楚也是可以的。', '不用急着找到答案。', '我陪着你慢慢想。', '这种感觉我明白。']
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
      var defaultVoice = groups['female'][0] || groups['male'][0] || groups['other'][0] || zhVoices[0];
      if (defaultVoice) selectVoice(defaultVoice.name, false);
      else selectVoice(null, true);
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
      return raw ? JSON.parse(raw) : null;
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
        if (musicAudio.paused) musicAudio.play().catch(function(){});
        return;
      }
      musicAudio.pause();
      musicAudio = null;
    }
    musicAudio = new Audio(src);
    musicAudio.loop = true;
    musicAudio.volume = musicPref.volume;
    musicAudio.play().catch(function(){});
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
  function duckMusic(on) {
    if (!musicAudio || musicAudio.paused || !musicPref) return;
    if (on) {
      musicAudio.volume = musicPref.volume * 0.25;
    } else {
      musicAudio.volume = musicPref.volume;
    }
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
