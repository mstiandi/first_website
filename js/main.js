/* ===== 精神避难所 · 核心脚本 ===== */

// ── 时钟 ──
(function tick() {
  var now = new Date();
  var h = ('0' + now.getHours()).slice(-2);
  var m = ('0' + now.getMinutes()).slice(-2);
  document.getElementById('clock').textContent = h + ':' + m;

  var days = ['周日','周一','周二','周三','周四','周五','周六'];
  var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 ' + days[now.getDay()];
  document.getElementById('dateText').textContent = dateStr;

  setTimeout(tick, 1000);
})();

// ── 箴言轮换 ──
(function () {
  var quotes = [
    '停下来，呼吸。',
    '你不需要赶去任何地方。',
    '此刻，只有你和你自己。',
    '世界很吵，但这里很安静。',
    '允许自己什么都不做。',
    '你已经做得足够好了。',
    '深呼——吸——',
    '没有什么需要解决的。',
    '让思绪像云一样飘过。',
    '你值得这样一个瞬间。',
    '安静不是空虚，是养分。',
    '不需要成为任何人。'
  ];
  var el = document.getElementById('quote');
  var i = Math.floor(Math.random() * quotes.length);

  function show(idx) {
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = quotes[idx];
      el.style.opacity = '1';
    }, 1500);
  }

  show(i);
  setInterval(function () {
    i = (i + 1) % quotes.length;
    show(i);
  }, 12000);
})();

// ── 场景切换 ──
(function () {
  var currentScene = 'forest';
  var scenes = {};
  ['forest','ocean','stars','rain'].forEach(function (name) {
    scenes[name] = document.getElementById('scene-' + name);
  });

  document.querySelectorAll('.scene-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = this.dataset.scene;
      if (target === currentScene) return;

      scenes[currentScene].classList.remove('active');
      scenes[target].classList.add('active');
      currentScene = target;

      document.querySelectorAll('.scene-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');

      switchAmbient(target);
    });
  });
})();

// ── 粒子生成 ──

// 森林萤火虫
(function () {
  var container = document.getElementById('particles-forest');
  for (var i = 0; i < 30; i++) {
    var p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 6 + 's';
    p.style.animationDuration = (4 + Math.random() * 8) + 's';
    container.appendChild(p);
  }
})();

// 深海光线 + 气泡
(function () {
  var rays = document.getElementById('rays-ocean');
  for (var i = 0; i < 8; i++) {
    var r = document.createElement('div');
    r.className = 'light-ray';
    r.style.left = (5 + Math.random() * 90) + '%';
    r.style.height = (60 + Math.random() * 100) + 'px';
    r.style.animationDelay = Math.random() * 8 + 's';
    r.style.animationDuration = (6 + Math.random() * 10) + 's';
    rays.appendChild(r);
  }

  var bubbles = document.getElementById('bubbles-ocean');
  for (var j = 0; j < 25; j++) {
    var b = document.createElement('div');
    b.className = 'bubble';
    b.style.left = Math.random() * 100 + '%';
    b.style.animationDelay = Math.random() * 10 + 's';
    b.style.animationDuration = (8 + Math.random() * 12) + 's';
    b.style.width = b.style.height = (2 + Math.random() * 8) + 'px';
    bubbles.appendChild(b);
  }
})();

// 星空
(function () {
  var container = document.getElementById('starfield');
  for (var i = 0; i < 120; i++) {
    var s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.width = s.style.height = (1 + Math.random() * 2.5) + 'px';
    s.style.animationDelay = Math.random() * 3 + 's';
    s.style.animationDuration = (2 + Math.random() * 4) + 's';
    container.appendChild(s);
  }
})();

// 雨夜雨滴
(function () {
  var container = document.getElementById('rainfield');
  function addDrop() {
    var d = document.createElement('div');
    d.className = 'drop';
    d.style.left = Math.random() * 100 + '%';
    d.style.height = (10 + Math.random() * 25) + 'px';
    d.style.animationDuration = (0.6 + Math.random() * 1) + 's';
    container.appendChild(d);
    setTimeout(function () { d.remove(); }, 1200);
  }
  for (var i = 0; i < 80; i++) {
    setTimeout(function () { addDrop(); }, Math.random() * 1000);
  }
  setInterval(addDrop, 80);
})();

// ── 环境音 ──
var audioCtx = null;
var ambientNode = null;
var ambientGain = null;
var soundOn = true;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.08;
  ambientGain.connect(audioCtx.destination);
}

function stopAmbient() {
  if (ambientNode) { ambientNode.stop(); ambientNode = null; }
}

function switchAmbient(scene) {
  if (!audioCtx || !soundOn) return;
  stopAmbient();
  if (scene === 'rain') playRain();
  else if (scene === 'ocean') playOcean();
  else if (scene === 'forest') playForest();
  else playWind();
}

function playForest() {
  initAudio();
  stopAmbient();
  // 柔和白噪声模拟树叶沙沙 + 偶发鸟鸣
  var dur = 60;
  var sampleRate = audioCtx.sampleRate;
  var len = dur * sampleRate;
  var buf = audioCtx.createBuffer(1, len, sampleRate);
  var data = buf.getChannelData(0);

  // 滤波后的柔和噪声
  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf = lpf + 0.003 * (white - lpf); // 低通滤波
    data[i] = lpf * 0.3 + Math.sin(i * 0.0004 + Math.sin(i * 0.00007) * 2) * 0.08;
  }

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf;
  ambientNode.loop = true;
  ambientNode.connect(ambientGain);
  ambientNode.start();
}

function playOcean() {
  initAudio();
  stopAmbient();
  var dur = 60;
  var sampleRate = audioCtx.sampleRate;
  var len = dur * sampleRate;
  var buf = audioCtx.createBuffer(1, len, sampleRate);
  var data = buf.getChannelData(0);

  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf = lpf + 0.01 * (white - lpf);
    // 潮汐起伏
    var tide = Math.sin(i * 0.00003) * 0.5 + 0.5;
    data[i] = lpf * 0.5 * tide;
  }

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf;
  ambientNode.loop = true;
  ambientNode.connect(ambientGain);
  ambientNode.start();
}

function playRain() {
  initAudio();
  stopAmbient();
  var dur = 30;
  var sampleRate = audioCtx.sampleRate;
  var len = dur * sampleRate;
  var buf = audioCtx.createBuffer(1, len, sampleRate);
  var data = buf.getChannelData(0);

  for (var i = 0; i < len; i++) {
    var r = Math.random() * 2 - 1;
    // 模拟雨声：滤过的噪声加滴答
    var drip = (Math.sin(i * 0.3) > 0.99) ? Math.random() * 0.5 : 0;
    data[i] = r * 0.25 + drip;
  }

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf;
  ambientNode.loop = true;
  ambientNode.connect(ambientGain);
  ambientNode.start();
}

function playWind() {
  initAudio();
  stopAmbient();
  var dur = 60;
  var sampleRate = audioCtx.sampleRate;
  var len = dur * sampleRate;
  var buf = audioCtx.createBuffer(1, len, sampleRate);
  var data = buf.getChannelData(0);

  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf = lpf + 0.0005 * (white - lpf);
    data[i] = lpf * 0.4;
  }

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf;
  ambientNode.loop = true;
  ambientNode.connect(ambientGain);
  ambientNode.start();
}

// 声音开关
var soundBtn = document.getElementById('soundToggle');
soundBtn.addEventListener('click', function () {
  soundOn = !soundOn;
  if (soundOn) {
    soundBtn.classList.add('on');
    soundBtn.innerHTML = '&#9834;';
    initAudio();
    ambientGain.gain.value = 0.08;
    // 重启当前场景的声音
    var activeScene = document.querySelector('.scene.active');
    if (activeScene) {
      var id = activeScene.id.replace('scene-', '');
      switchAmbient(id);
    }
  } else {
    soundBtn.classList.remove('on');
    soundBtn.innerHTML = '&#9835;';
    if (ambientGain) ambientGain.gain.value = 0;
    stopAmbient();
  }
});

// 初始化森林音效
soundBtn.addEventListener('click', function init() {
  initAudio();
  switchAmbient('forest');
}, { once: true });

// 首次用户交互后初始化音频
document.addEventListener('click', function start() {
  initAudio();
  if (soundOn && !ambientNode) switchAmbient('forest');
}, { once: true });
