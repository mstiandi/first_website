/* ===== 精神避难所 v4 ===== */
function $(id) { return document.getElementById(id); }

/* ══════════════════════════════════════
   Tab 切换
   ══════════════════════════════════════ */
var currentTab = 'meditation';

document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var tab = this.dataset.tab;
    if (tab === currentTab) return;
    // 切换视图
    $('view-' + currentTab).classList.remove('active');
    $('view-' + tab).classList.add('active');
    currentTab = tab;
    // 更新 tab 样式
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    this.classList.add('active');
    // 场景切换器只在冥想 Tab 显示
    var sw = $('sceneSwitcher');
    sw.style.display = (tab === 'meditation') ? 'flex' : 'none';
    // 停止故事播放
    if (tab !== 'stories') stopStory();
    // 切换环境音
    if (tab === 'meditation') switchAmbient(currentScene);
    else if (tab === 'melancholy') switchAmbient('melancholy');
    else stopAmbient();
  });
});

/* ══════════════════════════════════════
   时钟（双视图共用）
   ══════════════════════════════════════ */
(function tick() {
  var now = new Date();
  var h = ('0' + now.getHours()).slice(-2);
  var m = ('0' + now.getMinutes()).slice(-2);
  var days = ['周日','周一','周二','周三','周四','周五','周六'];
  var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 ' + days[now.getDay()];
  $('clock').textContent = h + ':' + m;
  $('dateText').textContent = dateStr;
  var c2 = $('clock2'), d2 = $('dateText2');
  if (c2) c2.textContent = h + ':' + m;
  if (d2) d2.textContent = dateStr;
  setTimeout(tick, 1000);
})();

/* ══════════════════════════════════════
   冥想箴言
   ══════════════════════════════════════ */
(function () {
  var quotes = [
    '停下来，呼吸。','你不需要赶去任何地方。','此刻，只有你和你自己。',
    '世界很吵，但这里很安静。','允许自己什么都不做。','你已经做得足够好了。',
    '深深——呼吸——','没有什么需要解决的。','让思绪像云一样飘过。',
    '你值得这样一个瞬间。','安静不是空虚，是养分。','不需要成为任何人。',
    '你是自然的一部分。','雨会停，夜会明。'
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

/* ══════════════════════════════════════
   冥想场景切换
   ══════════════════════════════════════ */
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
    if (currentTab === 'meditation') switchAmbient(target);
  });
});

/* ══════════════════════════════════════
   森林 · 萤火虫
   ══════════════════════════════════════ */
(function () {
  var container = $('particles-forest');
  function spawn() {
    var p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = (40 + Math.random() * 60) + '%';
    p.style.animationDuration = (6 + Math.random() * 12) + 's';
    p.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(p);
    setTimeout(function () { p.remove(); }, 14000);
  }
  for (var i = 0; i < 30; i++) spawn();
  setInterval(spawn, 1800);
})();

/* ══════════════════════════════════════
   深海 · 光线、气泡、鱼、鲸鱼
   ══════════════════════════════════════ */
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
(function () {
  var container = $('bubbles-ocean');
  function spawn() {
    var b = document.createElement('div');
    b.className = 'bubble';
    b.style.left = Math.random() * 100 + '%';
    b.style.width = b.style.height = (2 + Math.random() * 7) + 'px';
    b.style.animationDuration = (9 + Math.random() * 14) + 's';
    container.appendChild(b);
    setTimeout(function () { b.remove(); }, 24000);
  }
  for (var j = 0; j < 20; j++) spawn();
  setInterval(spawn, 2000);
})();
(function () {
  var container = $('ocean-fish');
  function spawn() {
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
  spawn();
  setInterval(spawn, 5000);
})();
(function () {
  var container = $('ocean-whale');
  var timer;
  function spawn() {
    var w = document.createElement('div');
    w.className = 'whale';
    w.style.top = (10 + Math.random() * 50) + '%';
    var body = document.createElement('div');
    body.className = 'whale-body';
    w.appendChild(body);
    container.appendChild(w);
    playWhaleCall();
    setTimeout(function () { w.remove(); }, 30000);
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(spawn, 30000 + Math.random() * 50000);
  }
  schedule();
})();

/* ══════════════════════════════════════
   极光 · Canvas
   ══════════════════════════════════════ */
(function () {
  var canvas = $('auroraCanvas');
  var ctx = canvas.getContext('2d');
  var time = 0;
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  function draw() {
    if (currentTab !== 'meditation' || currentScene !== 'stars') { requestAnimationFrame(draw); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 0.008;
    var ribbons = [
      { y: 0.22, color: 'rgba(100, 220, 140, 0.06)', amp: 60, freq: 0.003, phase: 0, thick: 80 },
      { y: 0.28, color: 'rgba(80, 200, 180, 0.05)', amp: 70, freq: 0.0025, phase: 1.5, thick: 85 },
      { y: 0.25, color: 'rgba(60, 180, 220, 0.04)', amp: 55, freq: 0.0032, phase: 0.8, thick: 70 },
      { y: 0.30, color: 'rgba(120, 160, 220, 0.05)', amp: 65, freq: 0.0028, phase: 2.2, thick: 90 },
      { y: 0.20, color: 'rgba(140, 210, 160, 0.03)', amp: 50, freq: 0.0035, phase: 1.1, thick: 65 },
    ];
    ribbons.forEach(function (r) {
      ctx.beginPath();
      var y = canvas.height * r.y + Math.sin(time + r.phase) * 30;
      ctx.moveTo(0, y);
      for (var x = 0; x <= canvas.width; x += 4) {
        var dy = Math.sin(x * r.freq + time + r.phase) * r.amp
               + Math.sin(x * r.freq * 2.3 + time * 1.4 + r.phase) * r.amp * 0.4
               + Math.sin(x * r.freq * 0.5 + time * 0.7) * r.amp * 0.3;
        ctx.lineTo(x, y + dy);
      }
      ctx.lineTo(canvas.width, y + r.thick);
      for (var x2 = canvas.width; x2 >= 0; x2 -= 4) {
        var dy2 = Math.sin(x2 * r.freq + time + r.phase) * r.amp
                 + Math.sin(x2 * r.freq * 2.3 + time * 1.4 + r.phase) * r.amp * 0.4
                 + Math.sin(x2 * r.freq * 0.5 + time * 0.7) * r.amp * 0.3;
        ctx.lineTo(x2, y + dy2 + r.thick);
      }
      ctx.closePath(); ctx.fillStyle = r.color; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* 星空 */
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

/* 雨夜 */
(function () {
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
  for (var i = 0; i < 60; i++) setTimeout(function () { addBgDrop(); }, Math.random() * 1200);
  setInterval(addBgDrop, 100);

  var glass = $('windowGlass');
  function addGlassDrop() {
    var g = document.createElement('div');
    g.className = 'glass-drop';
    g.style.left = Math.random() * 95 + '%';
    g.style.top = Math.random() * 85 + '%';
    g.style.width = g.style.height = (3 + Math.random() * 5) + 'px';
    g.style.animationDuration = (2 + Math.random() * 3) + 's';
    g.style.filter = 'blur(' + (0.8 + Math.random() * 1.5) + 'px)';
    glass.appendChild(g);
    setTimeout(function () { g.remove(); }, 3500);
  }
  for (var j = 0; j < 15; j++) setTimeout(function () { addGlassDrop(); }, Math.random() * 3000);
  setInterval(addGlassDrop, 400);
})();

/* ══════════════════════════════════════
   忧郁 · 粒子 + 箴言
   ══════════════════════════════════════ */
(function () {
  var container = $('melancholyParticles');
  function spawn() {
    var p = document.createElement('div');
    p.className = 'mp';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 16) + 's';
    container.appendChild(p);
    setTimeout(function () { p.remove(); }, 25000);
  }
  for (var i = 0; i < 20; i++) spawn();
  setInterval(spawn, 2500);
})();
(function () {
  var quotes = [
    '有些情绪，不必急着赶走。','沉默也是一种语言。','悲伤里有安静的深度。',
    '允许自己不快乐。','夜晚是白天的影子，一样真实。','孤独不是惩罚，是清醒。',
    '没有什么是永远的，包括此刻。','把自己交给时间。','雨落在心上，也是灌溉。',
    '你不需要一直发光。','心碎过的地方，光才能进去。','能流泪，是活着的证据。'
  ];
  var el = $('melancholyQuote');
  var i = 0;
  function show(idx) {
    el.style.opacity = '0';
    setTimeout(function () { el.textContent = quotes[idx]; el.style.opacity = '1'; }, 1500);
  }
  show(0);
  setInterval(function () { i = (i + 1) % quotes.length; show(i); }, 16000);
})();

/* ══════════════════════════════════════
   环境音系统
   ══════════════════════════════════════ */
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
  if (scene === 'forest') playForest();
  else if (scene === 'ocean') playOcean();
  else if (scene === 'stars' || scene === 'melancholy') playStars();
  else if (scene === 'rain') playRain();
}

function genNoise(dur, lpfRate, amp) {
  var sr = audioCtx.sampleRate, len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0), lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += lpfRate * (white - lpf);
    data[i] = lpf * amp;
  }
  return buf;
}
function playBuf(buf) {
  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buf; ambientNode.loop = true;
  ambientNode.connect(ambientGain); ambientNode.start();
}

function playForest() {
  initAudio(); stopAmbient();
  var dur = 60, sr = audioCtx.sampleRate, len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0), lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.002 * (white - lpf);
    var bird = (Math.sin(i * 0.7) > 0.998) ? Math.sin(i * 0.06) * 0.15 : 0;
    data[i] = lpf * 0.25 + bird;
  }
  playBuf(buf);
}
function playOcean() {
  initAudio(); stopAmbient();
  var dur = 60, sr = audioCtx.sampleRate, len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0), lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.008 * (white - lpf);
    var tide = Math.sin(i * 0.00003) * 0.5 + 0.5;
    data[i] = lpf * 0.45 * tide;
  }
  playBuf(buf);
}
function playStars() {
  initAudio(); stopAmbient();
  playBuf(genNoise(60, 0.0003, 0.18));
}
function playRain() {
  initAudio(); stopAmbient();
  var dur = 30, sr = audioCtx.sampleRate, len = dur * sr;
  var buf = audioCtx.createBuffer(1, len, sr);
  var data = buf.getChannelData(0), lpf = 0;
  for (var i = 0; i < len; i++) {
    var white = Math.random() * 2 - 1;
    lpf += 0.003 * (white - lpf);
    var tick = (Math.random() < 0.0008) ? Math.random() * 0.6 : 0;
    var thunder = (Math.random() < 0.000003) ? Math.sin(i / sr * 0.5) * Math.exp(-(i % (sr*5)) / sr) * 0.2 : 0;
    data[i] = lpf * 0.28 + tick * 0.5 + thunder;
  }
  playBuf(buf);
}
function playWhaleCall() {
  if (!audioCtx || !soundOn) return;
  var now = audioCtx.currentTime, dur = 3.5;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  var baseFreq = 120 + Math.random() * 80;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 1.8, now + 1.2);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.6, now + 2.5);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.3, now + dur);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.6);
  gain.gain.linearRampToValueAtTime(0.08, now + 2.0);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(gain); gain.connect(ambientGain);
  osc.start(now); osc.stop(now + dur);
}

// 音量控制
var volumeSlider = $('volumeSlider');
var volumeWrap = $('volumeWrap');
var soundBtn = $('soundToggle');
soundBtn.addEventListener('click', function () {
  volumeWrap.classList.toggle('show');
});
volumeSlider.addEventListener('input', function () {
  masterVolume = this.value / 100;
  if (ambientGain) ambientGain.gain.value = masterVolume;
});
soundBtn.addEventListener('dblclick', function () {
  soundOn = !soundOn;
  if (soundOn) {
    soundBtn.classList.add('on'); soundBtn.innerHTML = '&#9834;';
    initAudio(); ambientGain.gain.value = masterVolume;
    if (currentTab === 'meditation') switchAmbient(currentScene);
    else if (currentTab === 'melancholy') switchAmbient('melancholy');
  } else {
    soundBtn.classList.remove('on'); soundBtn.innerHTML = '&#9835;';
    ambientGain.gain.value = 0; stopAmbient();
  }
});
document.addEventListener('click', function start() {
  initAudio();
  if (soundOn && !ambientNode) switchAmbient('forest');
}, { once: true });

/* ══════════════════════════════════════
   助眠故事
   ══════════════════════════════════════ */
var storyData = {
  nature: {
    name: '自然之声',
    icon: '🌿',
    stories: [
      {
        title: '森林漫步',
        dur: '12分钟',
        text: '现在，请你闭上眼睛。想象自己正站在一片古老的森林边缘。' +
          '脚下是柔软的苔藓，踩上去没有声音，像踩在厚厚的云朵上。空气里有松针和泥土的气息，那是只有深林才有的味道。' +
          '你开始慢慢地走。左边是一排笔直的红杉，它们的树冠高得看不见顶，阳光从叶缝间漏下来，变成金色的细线。' +
          '右边有一条小溪，水声很小，像是有人在远处轻轻哼唱。溪水清澈见底，偶尔有一片落叶漂过去，不紧不慢。' +
          '你继续走。路越来越软，两边开始出现野花——淡紫色的、白色的，小小的，不是那种张扬的花，是那种安安静静开放的花。' +
          '一棵倒下的大树横在路上，树干上长满了青苔和蘑菇。你停下来，摸了摸那些蘑菇，它们是浅褐色的，小小的，像一排小小的伞。' +
          '现在你听到鸟叫了。不是那种尖锐的叫声，是温柔的、断断续续的，仿佛在说：没关系，慢慢来。' +
          '阳光穿过树叶洒在你的手上，暖暖的。你深深吸了一口气——这里是安全的。这里没有截止日期，没有未读消息，没有需要回复的邮件。' +
          '你找到一块大石头坐了下来。石头被太阳晒得温热，你把手掌贴在上面，能感觉到那种沉静的力量。' +
          '远处有风吹过树梢，那声音像是大海的潮汐——一阵一阵，不急不缓。你闭上眼睛，让自己跟着风的节奏呼吸。' +
          '吸气——森林的气息充满你的肺。呼气——所有的紧张都从肩膀滑落。' +
          '你感觉自己正在变小，变得很轻，像一片树叶，正被风轻轻地托着。你不必控制方向，风知道该带你去哪里。' +
          '这片森林已经在这里站了几百年。在它面前，你所有的不安和焦虑都显得微不足道。你只是无数生命中的一个，和其他生命一样，被这片森林温柔地包容着。' +
          '现在天色渐渐暗下来了。不是那种可怕的黑暗，是那种温柔的、像被子一样盖下来的暮色。萤火虫开始在草丛间亮起来，一点一点，像地上的星星。' +
          '你感到困了。这是一种自然而然的困意，就像森林在告诉你：该休息了。你靠在树干上，把身体交给大地。' +
          '今晚不需要思考任何事。今晚你只是一棵树，一棵在古老森林里静静呼吸的树。晚安。',
        narration: '闭上眼睛，深呼吸。你正走在古老的森林里。脚下是柔软的苔藓，空气里有松针的清香。阳光穿过树叶，变成金色的光斑。溪水在右边轻轻流淌。现在，你找到一块温暖的石头坐下来，让森林的气息包围你。萤火虫亮起来了。你感到困了，困了……在这里你是安全的。晚安。'
      },
      {
        title: '海浪轻语',
        dur: '11分钟',
        text: '你正坐在一片安静的沙滩上。面前是海，一望无际的深蓝色。' +
          '现在是傍晚，太阳刚刚沉入海平面，天边还留着一抹淡淡的橘色。海鸥已经归巢，海面上只有浪花的声音。' +
          '你赤着脚，踩在微凉的沙子上。沙子很细，从脚趾间流过，痒痒的。海浪一波一波地涌上来，刚刚碰到你的脚踝，又退回去。' +
          '每一波浪花都是不一样的。这一波大一些，冲到你的小腿上，凉凉的。下一波小一些，只是轻轻地吻了一下沙滩就退了。' +
          '你看着海浪，一个接一个，永不停歇。它们从哪里来？从很远很远的海中央。在到达这里之前，它们已经走了几千公里的路。' +
          '但它们不着急。一波一波，有自己的节奏。你试着让自己的呼吸跟上这个节奏——吸，浪来了。呼，浪退了。' +
          '天完全暗下来了。星星一颗一颗地亮起来。海面上开始出现一条银色的光带，那是月光在海面上铺的路。那条路看起来可以直接走到月亮的故乡。' +
          '你躺了下来。沙子还留着白天的余温，隔着衣服传到你的背上。头顶是星空，身下是大地，耳边是海浪——这世界上最重要的三件事，现在都在你身边。' +
          '你听到远处有渔船的马达声，很低沉，像大提琴的低音。那声音渐渐远了，最后消失在浪声里。' +
          '一只螃蟹从你身边爬过，它看了你一眼，又继续赶路了。在它的世界里，你是它今晚路过的一个温柔的巨人。' +
          '海浪的声音越来越催眠。每一次退潮都带走一些思绪，每一次涨潮都带来一些安宁。' +
          '你感觉自己正在融化——融化成沙滩的一部分，融化成海浪的一部分，融化成月光的一部分。不再有边界，不再有分别。你就是这片海，这片海就是你。' +
          '闭上眼睛吧。让海浪轻拍你的梦。一波，一波。晚安。',
        narration: '放松身体。你正坐在傍晚的海滩上。赤脚踩在细沙上，海浪一波一波涌来，刚碰到脚踝又退回去。天边还有一抹橘色。星星亮了，月光在海面上铺了一条银色的路。你躺下来，身下是温热的沙子。海浪的声音很催眠。每一次退潮都带走思绪，每一次涨潮带来安宁。一波，一波。闭上眼睛，晚安。'
      }
    ]
  },
  history: {
    name: '历史长河',
    icon: '📜',
    stories: [
      {
        title: '长安夜话',
        dur: '12分钟',
        text: '让我们回到一千三百年前的大唐长安。现在是亥时，也就是晚上十点。' +
          '长安城被夜色温柔地包裹着。一百零八坊的灯火次第熄灭，只有皇宫方向还亮着几盏灯。朱雀大街空荡荡的，白天这里车水马龙，商队驼铃不绝于耳，但现在只剩下月光和青石板。' +
          '一个更夫从街角走过，敲了三下梆子。那声音在空旷的街道上回荡，像是时间本身的脚步。' +
          '你正躺在大雁塔附近的一间小阁楼里。窗户半开着，晚风带着槐花的香味飘进来。远处传来大慈恩寺的钟声——一声，两声，三声。僧人还在做晚课。' +
          '楼下有人在弹琵琶。不是那种宴席上的急曲，是很慢很慢的调子，像月光流水。你听不太清旋律，但那不重要。重要的是有人正在这个夜晚，用琴弦说着话。' +
          '现在是开元年间，大唐最安静也最繁华的年代。没有战乱，没有饥荒。人们相信明天会更好。' +
          '你闻到了什么味道？是隔壁西域商人家的香料——安息香、乳香、没药。这些香料从撒马尔罕出发，走过帕米尔高原，走过塔克拉玛干沙漠，走了整整一年才到达这里。它们承载着远方的故事。' +
          '白天，长安城里有来自各个地方的人——波斯商人、日本遣唐使、吐蕃僧侣、突厥武士。他们说着不同的语言，穿着不同的衣服，但都在这座城市里找到了自己的角落。' +
          '但现在夜深了。所有人都睡了。波斯商人梦到了家乡的石榴树。日本僧人在梦里抄写经文。那个抱着琵琶的姑娘，终于也放下了琴，枕着月光睡了。' +
          '你闭上眼睛。一千三百年的时光像水一样流过。在这座曾经最伟大的城市里，在这个普通的夜晚，你和那些早已逝去的人共享着同样温柔的黑暗。' +
          '历史不是课本上的年份和名字。历史就是这个夜晚——安静、深邃、宽厚。它包容了所有人的梦。' +
          '现在，让它也包容你的梦吧。晚安，长安。晚安。',
        narration: '长安，一千三百年前。亥时，一百零八坊的灯火次第熄灭。更夫敲了三下梆子。大慈恩寺的钟声远远传来。楼下有人在弹琵琶，很慢很慢的调子。空气里有槐花和安息香的味道。所有人都在这个夜晚安静地睡了。闭上眼睛。让一千三百年的时光包容你的梦。晚安，长安。晚安。'
      },
      {
        title: '江南旧梦',
        dur: '12分钟',
        text: '现在是南宋的临安，也就是今天的杭州。三月的西湖边，柳絮刚刚开始飘。' +
          '你坐在湖边的茶馆里，面前是一杯刚沏好的龙井。茶叶在热水里慢慢舒展，像跳一支很慢很慢的舞。窗外就是西湖，湖面上有薄薄的雾，远处的苏堤若隐若现。' +
          '有船从雾里划出来。乌篷船，船头挂着一盏小灯笼，橘黄色的光在水面上摇曳。船娘轻声哼着小调，是江南特有的那种软糯的调子，听不懂词，但知道是在唱春天。' +
          '茶馆的老板娘端来一碟桂花糕。糕是温热的，桂花是去年秋天腌的，现在吃起来还是甜的。你咬了一口，粉粉的、糯糯的，桂花的香气在嘴里慢慢散开。' +
          '窗外下起了小雨。江南的雨不是那种激烈的雨，是细细密密的，像绣花针一样落下来。雨水打在梧桐叶上，沙沙的声音像是蚕在吃桑叶。' +
          '雨停了。太阳出来了。湖面上的雾被阳光驱散了，你可以看到对岸的雷峰塔。塔尖上停着一只白鹭，它一动不动，像雕塑一样。' +
          '下午你沿着苏堤走。两边是垂柳，柳条在风里摆，拂过你的肩膀，像老朋友在打招呼。桃花开了，粉红色的一片，映在湖水里，把湖水都染成了粉色。' +
          '你走得很慢。在这里没有人走得快。走快了就错过了柳条的弧度，错过了桃花的颜色，错过了风从湖面上带来的水汽。' +
          '傍晚，你回到湖边。夕阳把雷峰塔的影子拉得很长很长，一直拉到湖中央。有人在远处吹笛子，是《梅花三弄》。那笛声像一缕青烟，在暮色中慢慢升起。' +
          '天黑了。湖上的画舫亮起了灯笼，一盏、两盏、三盏，像水上的星星。有人在画舫上唱曲，隔着水面传过来，幽幽的，听不太清词，但知道是在唱离别。' +
          '你该睡了。在江南的夜晚，连梦都是软的、糯的、甜的。闭上眼睛，让柳条拂过你的额头，让桂花的香气送你去梦乡。晚安，江南。晚安。',
        narration: '南宋临安，西湖边。三月，柳絮开始飘。你坐在茶馆里，面前是一杯龙井。窗外有乌篷船慢慢划出薄雾。下起了小雨，打在梧桐叶上沙沙的。雨后，你沿着苏堤走，桃花把湖水染成了粉色。天黑了，画舫的灯笼亮了。在江南的夜晚，连梦都是软的。闭上眼睛。晚安。'
      }
    ]
  },
  literature: {
    name: '文学经典',
    icon: '📖',
    stories: [
      {
        title: '瓦尔登湖畔',
        dur: '12分钟',
        text: '让我们跟随梭罗的脚步，来到瓦尔登湖畔的一个清晨。' +
          '湖面上飘着淡淡的雾气。水面平滑如镜，偶尔有鱼跃出，留下一圈圈涟漪。太阳刚刚从东边的树林后升起，把湖面染成了淡金色。' +
          '梭罗的木屋就在湖边。很小的一间，里面只有一张床、一张桌子、三把椅子。他说过：一个人的富有程度，与他能放下多少东西成正比。' +
          '现在他正坐在门口，手里拿着一块黑面包，看着湖面。一只潜鸟在远处叫了一声，那声音孤独而清澈，像这面湖水本身发出的叹息。' +
          '他在这里住了两年。两年里，他种豆子、砍柴、读书、写作。他每天都会在湖里游泳，不管天气多冷。他说湖水让他清醒，让他记住自己是谁。' +
          '秋天，树林变成红色和金色。他走在落叶上，每一片叶子踩上去都有不同的声音——橡树叶是脆的，枫叶是软的。他觉得秋天是大地在释放一年的疲惫。' +
          '冬天，湖面结冰了。他在冰上凿一个洞，俯身看冰下的湖水。即使在最冷的时候，湖水也在流动。冰下的世界是安静的，但这种安静不是死寂，是蕴藏。' +
          '春天来了。冰裂开了。那声音是梭罗听过的最动听的音乐——冰层碎裂成千万片，在阳光下闪闪发光。他觉得这像是一场复活。' +
          '晚上，他坐在炉火旁读书。没有电灯，只有蜡烛和炉火。窗外是深沉的黑暗，但屋内是温暖的。他觉得孤独不是惩罚——一个人可以独处，但不感到寂寞。' +
          '他写道：我去到林中，是因为我希望有意识地生活，只面对生活的基本事实，看看我是否能学到它要教给我的东西。' +
          '现在你也在湖边。湖水静静的，月光静静的，整个世界都是静静的。你听到潜鸟又叫了一声——它在说晚安。' +
          '闭上眼睛。让瓦尔登湖的晨雾覆盖你，让松林的香气包围你。你不需要拥有很多。你只需要拥有这一刻。晚安。',
        narration: '瓦尔登湖。清晨的雾气飘在湖面上，水面平滑如镜。太阳把湖面染成淡金色。梭罗坐在门口，看着湖，手里拿着一块黑面包。远处潜鸟在叫。秋天树叶红了一山。冬天湖面结冰了，但冰下的水还在流。春天冰裂了，那是世界上最动听的音乐。晚上他坐在炉火旁，窗外是月光。闭上眼睛，让这片湖水覆盖你的梦。晚安。'
      },
      {
        title: '小王子之梦',
        dur: '12分钟',
        text: '今晚，让我们飞到B612小行星。' +
          '这颗星球很小，小到你只要把椅子挪几步，就可以再看一次日落。小王子曾经在一天里看了四十四次日落。他说：人在难过的时候就会爱上日落。' +
          '他的星球上有三座火山——两座活的，一座已经熄灭了。他每天都会打扫它们。还有一朵玫瑰花。那朵花很骄傲，很任性，但也很脆弱。她告诉小王子，她是宇宙中独一无二的。' +
          '后来小王子离开了他的星球，开始旅行。他到过很多地方，遇到了很多奇怪的大人——一个国王，一个虚荣的人，一个酒鬼，一个商人，一个点灯人，一个地理学家。' +
          '最后他来到了地球。在沙漠里，他遇到了一只狐狸。狐狸教会了他最重要的东西。它说：驯服，就是建立联系。对你驯服过的东西，你永远负有责任。' +
          '狐狸还说：只有用心去看，才能看得清楚。最重要的东西，用眼睛是看不见的。' +
          '小王子想起了他的玫瑰花。他终于明白了——她确实是独一无二的。不是因为她长得和别的玫瑰不同，而是因为他为她浇过水，为她挡过风，为她赶过毛毛虫。他花在她身上的时间，让她变得重要。' +
          '现在他坐在沙漠的沙丘上，看着满天的星星。他笑了。星星很美，因为有一朵花藏在其中一颗星星上。' +
          '你觉得是哪一颗呢？可能是最亮的那一颗。也可能是最不起眼的那一颗。这都没关系。重要的是你知道，在茫茫宇宙的某个角落，有一朵玫瑰花正在想你。' +
          '飞行员说，当他抬头看星星时，他会听到小王子银铃般的笑声。每颗星星都变成了会唱歌的铃铛。' +
          '现在夜很深了。你闭上眼睛。在你的星球上，火山已经打扫干净了，玫瑰花已经用玻璃罩盖好了，猴面包树的幼苗已经拔掉了。一切都好。' +
          '不需要去看四十四次日落。今晚，只看一次就好。一次最温柔的日落。晚安，小王子。晚安。',
        narration: 'B612小行星。非常小。挪几步椅子就可以再看一次日落。上面有三座火山和一朵玫瑰花。后来小王子来到了地球，在沙漠里遇到了一只狐狸。狐狸说：只有用心去看，才能看得清楚。最重要的东西，眼睛是看不见的。现在他坐在沙丘上，看着满天的星星。星星很美，因为有一朵花藏在某一颗星星上。闭上眼睛。你的星球一切都好。晚安，小王子。晚安。'
      }
    ]
  }
};

// ── 渲染主题卡片 ──
(function () {
  var grid = $('topicGrid');
  Object.keys(storyData).forEach(function (key) {
    var topic = storyData[key];
    var card = document.createElement('div');
    card.className = 'topic-card';
    card.dataset.topic = key;
    card.innerHTML = '<div class="topic-icon">' + topic.icon + '</div>' +
      '<div class="topic-name">' + topic.name + '</div>' +
      '<div class="topic-count">' + topic.stories.length + ' 个故事</div>';
    card.addEventListener('click', function () { showStoryList(key); });
    grid.appendChild(card);
  });
})();

// ── 故事列表 ──
var currentTopic = null;
function showStoryList(topicKey) {
  currentTopic = topicKey;
  var topic = storyData[topicKey];
  $('topicTitle').textContent = topic.name;
  var list = $('storyList');
  list.innerHTML = '';
  topic.stories.forEach(function (story, idx) {
    var item = document.createElement('div');
    item.className = 'story-item';
    item.innerHTML = '<span class="story-name">' + story.title + '</span>' +
      '<span class="story-dur">' + story.dur + '</span>';
    item.addEventListener('click', function () { startPlayer(topicKey, idx); });
    list.appendChild(item);
  });
  $('screen-topics').classList.remove('active');
  $('screen-list').classList.add('active');
}
$('backToTopics').addEventListener('click', function () {
  $('screen-list').classList.remove('active');
  $('screen-topics').classList.add('active');
  stopStory();
});

// ── TTS 播放器 ──
var ttsUtterance = null;
var ttsStartTime = 0;
var ttsPausedAt = 0;
var ttsTotalEstimate = 0;
var ttsTimer = null;
var ttsPlaying = false;

function startPlayer(topicKey, storyIdx) {
  stopStory();
  var story = storyData[topicKey].stories[storyIdx];
  $('playerTitle').textContent = story.title;
  $('playerTime').textContent = '00:00';
  $('playerProgress').style.width = '0%';

  $('screen-list').classList.remove('active');
  $('screen-player').classList.add('active');

  // 使用旁白版（narration），约 5 分钟；完整版 text 约 12 分钟
  // 用户可选：默认用完整版 text
  var content = story.text;
  var charsPerMin = 200; // 中文 TTS 约 200 字/分钟
  ttsTotalEstimate = (content.length / charsPerMin) * 60; // 秒

  var utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.75;
  utterance.pitch = 0.9;
  utterance.volume = $('playerVolume').value / 100;

  // 尝试选一个好的中文声音
  var voices = speechSynthesis.getVoices();
  var zhVoice = voices.find(function (v) { return v.lang.startsWith('zh-CN') || v.lang.startsWith('zh-TW'); });
  if (zhVoice) utterance.voice = zhVoice;

  ttsUtterance = utterance;
  ttsStartTime = Date.now() / 1000;
  ttsPausedAt = 0;
  ttsPlaying = true;

  utterance.onend = function () {
    ttsPlaying = false;
    clearInterval(ttsTimer);
    $('playerProgress').style.width = '100%';
    $('playerPlay').innerHTML = '&#9654;';
  };

  utterance.onerror = function () {
    ttsPlaying = false;
    clearInterval(ttsTimer);
  };

  speechSynthesis.speak(utterance);

  // 更新进度条和时间
  clearInterval(ttsTimer);
  ttsTimer = setInterval(function () {
    if (!ttsPlaying) return;
    var elapsed = ttsPausedAt + (Date.now() / 1000 - ttsStartTime);
    var total = ttsTotalEstimate;
    var pct = Math.min(100, (elapsed / total) * 100);
    $('playerProgress').style.width = pct + '%';
    var m = Math.floor(elapsed / 60);
    var s = Math.floor(elapsed % 60);
    $('playerTime').textContent = ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
  }, 500);

  $('playerPlay').innerHTML = '&#10074;&#10074;';
}

function stopStory() {
  speechSynthesis.cancel();
  ttsPlaying = false;
  ttsUtterance = null;
  clearInterval(ttsTimer);
  $('playerPlay').innerHTML = '&#9654;';
}

$('playerPlay').addEventListener('click', function () {
  if (ttsPlaying) {
    // 暂停
    ttsPausedAt += Date.now() / 1000 - ttsStartTime;
    speechSynthesis.cancel();
    ttsPlaying = false;
    $('playerPlay').innerHTML = '&#9654;';
  } else if (ttsUtterance) {
    // 继续播放剩余内容
    var remaining = ttsUtterance.text;
    var newUtterance = new SpeechSynthesisUtterance(remaining);
    newUtterance.lang = 'zh-CN';
    newUtterance.rate = 0.75;
    newUtterance.pitch = 0.9;
    newUtterance.volume = $('playerVolume').value / 100;
    var voices = speechSynthesis.getVoices();
    var zhVoice = voices.find(function (v) { return v.lang.startsWith('zh-CN') || v.lang.startsWith('zh-TW'); });
    if (zhVoice) newUtterance.voice = zhVoice;

    ttsUtterance = newUtterance;
    ttsStartTime = Date.now() / 1000;
    ttsPlaying = true;
    newUtterance.onend = function () {
      ttsPlaying = false;
      clearInterval(ttsTimer);
      $('playerProgress').style.width = '100%';
      $('playerPlay').innerHTML = '&#9654;';
    };
    speechSynthesis.speak(newUtterance);
    $('playerPlay').innerHTML = '&#10074;&#10074;';
  }
});

$('playerRewind').addEventListener('click', function () {
  // 简单处理：重新开始
  if (ttsUtterance) {
    speechSynthesis.cancel();
    var newUtt = new SpeechSynthesisUtterance(ttsUtterance.text);
    newUtt.lang = 'zh-CN'; newUtt.rate = 0.75; newUtt.pitch = 0.9;
    newUtt.volume = $('playerVolume').value / 100;
    ttsUtterance = newUtt;
    ttsStartTime = Date.now() / 1000;
    ttsPausedAt = Math.max(0, ttsPausedAt - 30);
    ttsPlaying = true;
    newUtt.onend = function () { ttsPlaying = false; clearInterval(ttsTimer); };
    speechSynthesis.speak(newUtt);
    $('playerPlay').innerHTML = '&#10074;&#10074;';
  }
});

$('playerForward').addEventListener('click', function () {
  if (ttsUtterance) {
    speechSynthesis.cancel();
    var skipTo = Math.min(ttsTotalEstimate, ttsPausedAt + (Date.now() / 1000 - ttsStartTime) + 30);
    // 估算跳过后的文字位置
    var charsPerSec = ttsUtterance.text.length / ttsTotalEstimate;
    var startChar = Math.floor(skipTo * charsPerSec);
    var remaining = ttsUtterance.text.substring(startChar);
    var newUtt = new SpeechSynthesisUtterance(remaining);
    newUtt.lang = 'zh-CN'; newUtt.rate = 0.75; newUtt.pitch = 0.9;
    newUtt.volume = $('playerVolume').value / 100;
    ttsUtterance = newUtt;
    ttsStartTime = Date.now() / 1000;
    ttsPausedAt = skipTo;
    ttsPlaying = true;
    newUtt.onend = function () { ttsPlaying = false; clearInterval(ttsTimer); };
    speechSynthesis.speak(newUtt);
    $('playerPlay').innerHTML = '&#10074;&#10074;';
  }
});

$('playerVolume').addEventListener('input', function () {
  if (ttsUtterance) ttsUtterance.volume = this.value / 100;
});

$('backToList').addEventListener('click', function () {
  stopStory();
  $('screen-player').classList.remove('active');
  if (currentTopic) {
    $('screen-list').classList.add('active');
  } else {
    $('screen-topics').classList.add('active');
  }
});

// 预加载语音
speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = function () { speechSynthesis.getVoices(); };
