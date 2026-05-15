/* 无痕聊天 — 左拖进入，黑屏对话，文字浮现/消失 */
var ChatSystem = (function () {
  var overlay, fadeText, cursor, input;
  var active = false;
  var typing = false;
  var currentText = '';
  var fadeTimer = null;
  var cursorTimer = null;

  // Agent greetings pool
  var greetings = [
    '有什么想和我说的吗？',
    '这里很安静，只有你和我。',
    '不用着急，慢慢说。',
    '我在听。',
    '今天过得怎么样？',
    '你可以说任何话，它们都会消失。'
  ];

  // Echo responses (placeholder until AI is wired)
  var echoes = [
    '嗯，我在听。',
    '多说一点。',
    '我明白。',
    '这种感觉是很真实的。',
    '不需要急着解决什么。',
    '你在这里是安全的。',
    '继续说，我不会忘记。'
  ];

  function init() {
    overlay = document.getElementById('chat-overlay');
    fadeText = document.getElementById('chat-fade-text');
    cursor = document.getElementById('chat-cursor');
    input = document.getElementById('chat-input');

    input.addEventListener('keydown', onKeyDown);
    // Click on overlay to focus input
    overlay.addEventListener('click', function () {
      if (active && !typing) startTyping();
    });
  }

  function enter() {
    active = true;
    overlay.classList.add('active');
    // Show greeting after a short pause
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

    // Show user text, then fade
    fadeText.style.opacity = '0';
    setTimeout(function () {
      showText(text);
      setTimeout(function () {
        fadeText.style.opacity = '0';
        // Show echo response
        setTimeout(function () {
          showText(randomFrom(echoes));
          setTimeout(function () {
            fadeText.style.opacity = '0';
            setTimeout(function () {
              if (active) startTyping();
            }, 2000);
          }, 3000);
        }, 1500);
      }, 2500);
    }, 400);
  }

  function showText(txt) {
    fadeText.textContent = txt;
    fadeText.style.opacity = '1';
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function isActive() { return active; }

  return { init: init, enter: enter, exit: exit, isActive: isActive };
})();
