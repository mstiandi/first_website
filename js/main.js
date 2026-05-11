/* ===== 精神避难所 v2 ===== */

// ── 工具函数 ──
function $(id) { return document.getElementById(id); }

// ── 时钟 ──
(function tick() {
  var now = new Date();
  var h = ('0' + now.getHours()).slice(-2);
  var m = ('0' + now.getMinutes()).slice(-2);
  $('clock').textContent = h + ':' + m;
  var days = ['周日','周一','周二','周三','周四','周五','周六'];
  $('dateText').textContent = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 ' + days[now.getDay()];
  setTimeout(tick, 1000);
})();

// ── 箴言 ──
(function () {
  var quotes = [
    '停下来，呼吸。',
    '你不需要赶去任何地方。',
    '此刻，只有你和你自己。',
    '世界很吵，但这里很安静。',
    '允许自己什么都不做。',
    '你已经做得足够好了。',
    '深深——呼吸——',
    '没有什么需要解决的。',
    '让思绪像云一样飘过。',
    '你值得这样一个瞬间。',
    '安静不是空虚，是养分。',
    '不需要成为任何人。',
    '你是自然的一部分。',
    '雨会停，夜会明。'
  ];
  var el = $('quote');
  var i = Math.floor(Math.random() * quotes.length);

  function show(idx) {
    el.style.opacity = '0';
    setTimeout(function () { el.textContent = quotes[idx]; el.style.opacity = '1'; }, 1800);
  }
  show(i);
  setInterval(function () { i = (i + 1) % quotes.length; show(i); }, 14000);
})();

// ── 场景切换 ──
var currentScene = 'forest';
var scenes = {};
['forest','ocean','stars','rain'].forEach(function (name) {
  scenes[name] = $('scene-' + name);
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

// ══════════════════════════════════════
// 森林 · 萤火虫
// ══════════════════════════════════════
(function () {
  var container = $('particles-forest');
  function spawnFirefly() {
    var p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = (40 + Math.random() * 60) + '%';
    p.style.animationDuration = (6 + Math.random() * 12) + 's';
    p.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(p);
    setTimeout(function () { p.remove(); }, 14000);
  }
  for (var i = 0; i < 30; i++) spawnFirefly();
  setInterval(spawnFirefly, 1800);
})();

// ══════════════════════════════════════
// 深海 · 光线 + 气泡 + 鱼 + 鲸鱼
// ══════════════════════════════════════

// 光线
(function () {
  var rays = $('rays-ocean');
  for (var i = 0; i < 8; i++) {
    var r = document.createElement('div');
    r.className = 'light-ray';
    r.style.left = (5 + Math.random() * 90) + '%';
    r.style.height = (50 + Math.random() * 110) + 'px';
    r.style.animationDelay = Math.random() * 10 + 's';
    r.style.animationDuration = (7 + Math.random() * 12) + 's';
    rays.appendChild(r);
  }
})();

// 气泡
(function () {
  var container = $('bubbles-ocean');
  function spawnBubble() {
    var b = document.createElement('div');
    b.className = 'bubble';
    b.style.left = Math.random() * 100 + '%';
    b.style.width = b.style.height = (2 + Math.random() * 7) + 'px';
    b.style.animationDuration = (9 + Math.random() * 14) + 's';
    container.appendChild(b);
    setTimeout(function () { b.remove(); }, 24000);
  }
  for (var j = 0; j < 20; j++) spawnBubble();
  setInterval(spawnBubble, 2000);
})();

// 鱼群
(function () {
  var container = $('ocean-fish');
  function spawnFish() {
    var school = document.createElement('div');
    school.className = 'fish';
    school.style.top = (15 + Math.random() * 75) + '%';
    var dur = 14 + Math.random() * 22;
    school.style.animationDuration = dur + 's';

    var count = 2 + Math.floor(Math.random() * 4);
    for (var i = 0; i < count; i++) {
      var body = document.createElement('div');
      body.className = 'fish-body';
      body.style.marginTop = (i * 16 - count * 8) + 'px';
      body.style.marginLeft = (i * 10) + 'px';
      body.style.opacity = (0.5 + Math.random() * 0.4);
      body.style.borderLeftWidth = (10 + Math.random() * 16) + 'px';
      body.style.borderTopWidth = (3 + Math.random() * 5) + 'px';
      body.style.borderBottomWidth = (3 + Math.random() * 5) + 'px';
      school.appendChild(body);
    }
    container.appendChild(school);
    setTimeout(function () { school.remove(); }, (dur + 2) * 1000);
  }
  spawnFish();
  setInterval(spawnFish, 5000);
})();

// 鲸鱼
(function () {
  var container = $('ocean-whale');
  var whaleTimer;

  function spawnWhale() {
    var w = document.createElement('div');
    w.className = 'whale';
    w.style.top = (10 + Math.random() * 50) + '%';
    container.appendChild(w);

    var body = document.createElement('div');
    body.className = 'whale-body';
    w.appendChild(body);

    playWhaleCall();

    setTimeout(function () { w.remove(); }, 30000);
    scheduleWhale();
  }

  function scheduleWhale() {
    clearTimeout(whaleTimer);
    whaleTimer = setTimeout(spawnWhale, 30000 + Math.random() * 50000);
  }

  // 只在深海场景激活时生成
  var origSwitch = null;
  document.querySelectorAll('.scene-btn').forEach(function (btn) {
    if (btn.dataset.scene === 'ocean') {
      btn.addEventListener('click', function () { scheduleWhale(); });
    }
  });

  scheduleWhale();
})();

// ══════════════════════════════════════
// 极光 · Canvas 动画
// ══════════════════════════════════════
(function () {
  var canvas = $('auroraCanvas');
  var ctx = canvas.getContext('2d');
  var time = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    if (currentScene !== 'stars') { requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 0.008;

    var ribbons = [
      { y: 0.22, color: 'rgba(100, 220, 140, 0.08)', amp: 60, freq: 0.003, phase: 0, thick: 80 },
      { y: 0.28, color: 'rgba(80, 200, 180, 0.07)', amp: 70, freq: 0.0025, phase: 1.5, thick: 85 },
      { y: 0.25, color: 'rgba(60, 180, 220, 0.05)', amp: 55, freq: 0.0032, phase: 0.8, thick: 70 },
      { y: 0.30, color: 'rgba(120, 160, 220, 0.06)', amp: 65, freq: 0.0028, phase: 2.2, thick: 90 },
      { y: 0.20, color: 'rgba(140, 210, 160, 0.04)', amp: 50, freq: 0.0035, phase: 1.1, thick: 65 },
    ];

    ribbons.forEach(function (r) {
      ctx.beginPath();
      var startX = 0;
      var y = canvas.height * r.y + Math.sin(time + r.phase) * 30;
      ctx.moveTo(startX, y);

      for (var x = 0; x <= canvas.width; x += 4) {
        var dy = Math.sin(x * r.freq + time + r.phase) * r.amp
               + Math.sin(x * r.freq * 2.3 + time * 1.4 + r.phase) * r.amp * 0.4
               + Math.sin(x * r.freq * 0.5 + time * 0.7) * r.amp * 0.3;
        ctx.lineTo(x, y + dy);
      }

      // 画完底部再回来形成填充带
      ctx.lineTo(canvas.width, y + r.thick);
      for (var x2 = canvas.width; x2 >= 0; x2 -= 4) {
        var dy2 = Math.sin(x2 * r.freq + time + r.phase) * r.amp
                + Math.sin(x2 * r.freq * 2.3 + time * 1.4 + r.phase) * r.amp * 0.4
                + Math.sin(x2 * r.freq * 0.5 + time * 0.7) * r.amp * 0.3;
        ctx.lineTo(x2, y + dy2 + r.thick);
      }
      ctx.closePath();
      ctx.fillStyle = r.color;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  draw();
})();

// ══════════════════════════════════════
// 星空渲染
// ══════════════════════════════════════
(function () {
  var container = $('starfield');
  for (var i = 0; i < 150; i++) {
    var s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 75 + '%';
    s.style.width = s.style.height = (0.8 + Math.random() * 2.5) + 'px';
    s.style.animationDelay = Math.random() * 4 + 's';
    s.style.animationDuration = (2.5 + Math.random() * 5) + 's';
    container.appendChild(s);
  }
})();

// ══════════════════════════════════════
// 雨夜 · 窗上雨滴 + 背景雨
// ══════════════════════════════════════
(function () {
  // 背景雨
  var rainBg = $('rainBg');
  function addBgDrop() {
    var d = document.createElement('div');
    d.className = 'drop';
    d.style.left = Math.random() * 100 + '%';
    d.style.height = (8 + Math.random() * 20) + 'px';
    d.style.animationDuration = (0.7 + Math.random() * 0.9) + 's';
    rainBg.appendChild(d);
    setTimeout(function () { d.remove(); }, 1800);
  }
  for (var i = 0; i < 60; i++) {
    setTimeout(function () { addBgDrop(); }, Math.random() * 1200);
  }
  setInterval(addBgDrop, 100);

  // 窗上雨滴
  var glass = $('windowGlass');
  function addGlassDrop() {
    var g = document.createElement('div');
    g.className = 'glass-drop';
    g.style.left = Math.random() * 95 + '%';
    g.style.top = Math.random() * 85 + '%';
    g.style.width = g.style.height = (3 + Math.random() * 5) + 'px';
    g.style.animationDuration = (2 + Math.random() * 3) + 's';
    var blur = 0.8 + Math.random() * 1.5;
    g.style.filter = 'blur(' + blur + 'px)';
    glass.appendChild(g);
    setTimeout(function () { g.remove(); }, 3500);
  }
  for (var j = 0; j < 15; j++) {
    setTimeout(function () { addGlassDrop(); }, Math.random() * 3000);
  }
  setInterval(addGlassDrop, 400);
})();

// ══════════════════════════════════════
// 环境音系统
// ══════════════════════════════════════
var audioCtx = null;
var ambientNode = null;
var ambientGain = null;
var soundOn = true;
var masterVolume = 0.3;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = masterVolume;
  ambientGain.connect(audioCtx.destination);
}

function stopAmbient() {
  if (ambientNode) { try { ambientNode.stop(); } catch(e){} ambientNode = null; }
}

function switchAmbient(scene) {
  if (!audioCtx || !soundOn) return;
  stopAmbient();
  if (scene === 'rain') playRain();
  else if (scene === 'ocean') playOcean();
  else if (scene === 'forest') playForest();
  else if (scene === 'stars') playStars();
}

// ── 森林音：柔和风 + 鸟鸣 ──
function playForest() {
  initAudio(); stopAmbient();
  var dur = 60;
  var sr = audioCtx.sampleRate;
  var len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0);
  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.002 * (white - lpf);
    // 微风 + 偶尔鸟鸣似的短促高音
    var bird = (Math.sin(i * 0.7) > 0.998) ? Math.sin(i * 0.06) * 0.15 : 0;
    data[i] = lpf * 0.25 + bird;
  }
  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf; ambientNode.loop = true;
  ambientNode.connect(ambientGain); ambientNode.start();
}

// ── 海洋音：低频潮汐 ──
function playOcean() {
  initAudio(); stopAmbient();
  var dur = 60;
  var sr = audioCtx.sampleRate;
  var len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0);
  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.008 * (white - lpf);
    var tide = Math.sin(i * 0.00003) * 0.5 + 0.5;
    data[i] = lpf * 0.45 * tide;
  }
  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf; ambientNode.loop = true;
  ambientNode.connect(ambientGain); ambientNode.start();
}

// ── 极光音：极低风声（接近寂静） ──
function playStars() {
  initAudio(); stopAmbient();
  var dur = 60;
  var sr = audioCtx.sampleRate;
  var len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0);
  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.0003 * (white - lpf);
    data[i] = lpf * 0.18;
  }
  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf; ambientNode.loop = true;
  ambientNode.connect(ambientGain); ambientNode.start();
}

// ── 雨天音：淅沥沥、孤寂的雨声 ──
function playRain() {
  initAudio(); stopAmbient();
  var dur = 30;
  var sr = audioCtx.sampleRate;
  var len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0);

  var lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    // 强低通滤波 → 柔和的沙沙声
    lpf += 0.003 * (white - lpf);

    // 低频的淅沥滴答
    var tick = 0;
    var t = i / sr;
    // 随机滴答节奏
    if (Math.random() < 0.0008) tick = Math.random() * 0.6;

    // 偶尔远处闷雷
    var thunder = 0;
    if (Math.random() < 0.000003) {
      var phase = Math.random() * Math.PI * 2;
      thunder = Math.sin(t * 0.5 + phase) * Math.exp(-t * 0.01 % 1 * 10) * 0.2;
    }

    data[i] = lpf * 0.28 + tick * 0.5 + thunder;
  }

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf; ambientNode.loop = true;
  ambientNode.connect(ambientGain); ambientNode.start();
}

// ── 鲸鱼鸣叫 ──
function playWhaleCall() {
  if (!audioCtx || !soundOn) return;
  var now = audioCtx.currentTime;
  var dur = 3.5;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';

  // 鲸歌：从低到高再滑落
  var baseFreq = 120 + Math.random() * 80;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 1.8, now + 1.2);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.6, now + 2.5);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.3, now + dur);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.6);
  gain.gain.linearRampToValueAtTime(0.08, now + 2.0);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain);
  gain.connect(ambientGain);
  osc.start(now);
  osc.stop(now + dur);
}

// ── 音量控制 ──
var volumeSlider = $('volumeSlider');
var volumeWrap = $('volumeWrap');

var soundBtn = $('soundToggle');
soundBtn.addEventListener('click', function () {
  if (soundOn) {
    // 切换音量滑块显隐
    if (volumeWrap.classList.contains('show')) {
      volumeWrap.classList.remove('show');
    } else {
      volumeWrap.classList.add('show');
    }
  }
});

volumeSlider.addEventListener('input', function () {
  masterVolume = this.value / 100;
  if (ambientGain) ambientGain.gain.value = masterVolume;
});

soundBtn.addEventListener('dblclick', function () {
  soundOn = !soundOn;
  if (soundOn) {
    soundBtn.classList.add('on');
    soundBtn.innerHTML = '&#9834;';
    initAudio();
    if (ambientGain) ambientGain.gain.value = masterVolume;
    var activeScene = document.querySelector('.scene.active');
    if (activeScene) switchAmbient(activeScene.id.replace('scene-', ''));
  } else {
    soundBtn.classList.remove('on');
    soundBtn.innerHTML = '&#9835;';
    if (ambientGain) ambientGain.gain.value = 0;
    stopAmbient();
  }
});

// ── 初始化 ──
document.addEventListener('click', function start() {
  initAudio();
  if (soundOn && !ambientNode) switchAmbient('forest');
}, { once: true });
