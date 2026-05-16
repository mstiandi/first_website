/* 无痕聊天 — 下拖进入，AI对话，文字浮现/消失 */
var ChatSystem = (function () {
  var overlay, fadeText, cursor, input;
  var active = false;
  var typing = false;
  var fadeTimer = null;
  var cursorTimer = null;
  var dragStartY = 0, dragActive = false, dragThreshold = 60;

  // 对话历史（本地内存，不持久化）
  var conversation = [];

  // Agent 系统提示词
  var SYSTEM_PROMPT = '你是一位温暖、安静、不带评判的倾听者。你叫"静静"。' +
    '用户来到这个黑暗的星空下，想和你说一些心里话。' +
    '你的回复要简短（2-4句话），温柔但有力量。' +
    '不要给建议，不要分析问题，只需要倾听和陪伴。' +
    '偶尔可以问一个简单的问题帮助用户继续说下去。' +
    '用中文回复，语气自然，像深夜和好朋友轻声聊天。';

  // API 地址（部署后替换为 Vercel 域名）
  var API_URL = 'https://first-website-lovat-delta.vercel.app/api/chat';

  // 默认 provider：deepseek 或 zhipu
  var PROVIDER = 'deepseek';

  // 开场白（API 不可用时作为兜底）
  var greetings = [
    '有什么想和我说的吗？',
    '这里很安静，只有你和我。',
    '不用着急，慢慢说。',
    '我在听。',
    '今天过得怎么样？',
    '你可以说任何话，它们都会消失。'
  ];

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
  }

  function enter() {
    active = true;
    conversation = [{ role: 'system', content: SYSTEM_PROMPT }];
    overlay.classList.add('active');
    setTimeout(function () {
      showText(randomFrom(greetings));
      setTimeout(function () {
        fadeText.style.opacity = '0';
        setTimeout(function () {
          if (active) startTyping();
        }, 2000);
      }, 3000);
    }, 600);
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
    fadeText.style.opacity = '0';
  }

  function startTyping() {
    typing = true;
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
    typing = false;
    cursor.classList.remove('visible');
    clearTimeout(cursorTimer);

    // 显示用户文字
    fadeText.style.opacity = '0';
    setTimeout(function () {
      showText(text);
      // 保存到对话历史
      conversation.push({ role: 'user', content: text });

      // 请求 AI 回复
      setTimeout(function () {
        fadeText.style.opacity = '0';
        fetchAIResponse();
      }, 2000);
    }, 400);
  }

  function fetchAIResponse() {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversation,
        provider: PROVIDER
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API status ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var reply = data.reply || '嗯。';
      conversation.push({ role: 'assistant', content: reply });
      showText(reply);
      setTimeout(function () {
        fadeText.style.opacity = '0';
        setTimeout(function () {
          if (active) startTyping();
        }, 2000);
      }, Math.max(2000, reply.length * 80));
    })
    .catch(function (err) {
      console.warn('AI API 不可用，使用本地回声:', err);
      // 兜底：本地回声
      var fallback = randomFrom([
        '嗯，我在听。',
        '多说一点。',
        '我明白。',
        '这种感觉是很真实的。',
        '你在这里是安全的。'
      ]);
      conversation.push({ role: 'assistant', content: fallback });
      showText(fallback);
      setTimeout(function () {
        fadeText.style.opacity = '0';
        setTimeout(function () {
          if (active) startTyping();
        }, 2000);
      }, 2500);
    });
  }

  function showText(txt) {
    fadeText.textContent = txt;
    fadeText.style.opacity = '1';
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function isActive() { return active; }

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
