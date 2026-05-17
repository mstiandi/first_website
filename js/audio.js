/* 环境音引擎 — Web Audio API 生成海浪声 */
var AudioEngine = (function () {
  var ctx = null;
  var gainNode = null;
  var sourceNode = null;
  var playing = false;
  var volume = 0.3;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);
  }

  function playOcean() {
    init();
    stop();
    var sr = ctx.sampleRate;
    var dur = 30;
    var len = dur * sr;
    var buf = ctx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);

    // Multi-layer ocean noise
    var lpf1 = 0, lpf2 = 0, lpf3 = 0;
    for (var i = 0; i < len; i++) {
      // Layer 1: deep rumble (very low frequency)
      var white = Math.random() * 2 - 1;
      lpf1 += 0.0003 * (white - lpf1);

      // Layer 2: mid waves
      lpf2 += 0.003 * (white - lpf2);

      // Layer 3: foam/hiss (higher frequency, amplitude modulated by slow wave)
      lpf3 += 0.015 * (white - lpf3);
      var tide = Math.sin(i * 0.00004) * 0.5 + 0.5; // slow tide cycle
      var waveShape = Math.sin(i * 0.0002 + Math.sin(i * 0.00008) * 3) * 0.5 + 0.5;

      data[i] = lpf1 * 0.2 + lpf2 * 0.35 * waveShape + lpf3 * 0.08 * tide;
    }

    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buf;
    sourceNode.loop = true;
    sourceNode.connect(gainNode);
    sourceNode.start();
    playing = true;
  }

  function stop() {
    if (sourceNode) { try { sourceNode.stop(); } catch(e){} sourceNode = null; }
    playing = false;
  }

  function setVolume(v) { volume = v; if (gainNode) gainNode.gain.value = v; }
  function getVolume() { return volume; }
  function toggle() {
    if (playing) { stop(); return false; }
    else { playOcean(); return true; }
  }
  function isPlaying() { return playing; }

  // ── 风铃声（AI回复时触发）──
  function playChime() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var now = ctx.currentTime;
    // 两个快速泛音模拟风铃
    [1200, 1550].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.06);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.55);
    });
  }

  // ── 孤星轻吟（用户发送时触发）──
  function playResonance() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var now = ctx.currentTime;

    // 小三度音程：忧郁但轻盈，不沉闷
    [523, 622].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      // 轻微颤音，有机感
      osc.frequency.setTargetAtTime(freq - 8, now + i * 0.04 + 0.12, 0.15);

      g.gain.setValueAtTime(0, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.045, now + i * 0.04 + 0.04);
      g.gain.setValueAtTime(0.045, now + i * 0.04 + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.75);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.8);
    });
  }

  // ── 场景环境音（Web Audio API，避开 autoplay 限制）──
  var AMBIENT_FILES = [
    'music/海浪.mp3',     // 海崖
    'music/篝火声.mp3',   // 篝火旁
    'music/草田.mp3',     // 草田
    'music/森林.mp3'      // 森林
  ];
  var ambientBuffers = [null, null, null, null];  // 解码后的 AudioBuffer
  var ambientSource = null;
  var ambientGain = null;
  var ambientVolume = 0.0;
  var currentAmbientIdx = -1;
  var ambientEnabled = false;  // 防止竞态：加载完成前已退出场景
  var buffersLoaded = false;

  function loadAmbientBuffers() {
    if (buffersLoaded) return;
    buffersLoaded = true;
    init();
    if (!ambientGain) {
      ambientGain = ctx.createGain();
      ambientGain.gain.value = ambientVolume;
      ambientGain.connect(ctx.destination);
    }
    AMBIENT_FILES.forEach(function (url, i) {
      fetch(url)
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return ctx.decodeAudioData(buf); })
        .then(function (audioBuf) {
          ambientBuffers[i] = audioBuf;
          if (i === currentAmbientIdx && ambientEnabled) startAmbientSource(i);
        })
        .catch(function (e) { console.warn('Ambient load failed: ' + url, e); });
    });
  }

  function startAmbientSource(idx) {
    if (!ambientBuffers[idx]) return;
    if (!ambientEnabled) return;
    stopAmbientSource();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') ctx.resume();
    ambientSource = ctx.createBufferSource();
    ambientSource.buffer = ambientBuffers[idx];
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);
    ambientSource.start();
  }

  function stopAmbientSource() {
    if (ambientSource) {
      try { ambientSource.stop(); } catch (e) {}
      ambientSource = null;
    }
  }

  function playAmbient(idx) {
    if (idx < 0 || idx >= AMBIENT_FILES.length) return;
    if (idx === currentAmbientIdx && ambientSource) return;
    ambientEnabled = true;
    currentAmbientIdx = idx;
    loadAmbientBuffers();
    if (ambientBuffers[idx]) {
      startAmbientSource(idx);
    }
  }

  function stopAmbient() {
    ambientEnabled = false;
    stopAmbientSource();
  }

  function resumeAmbient() {
    if (currentAmbientIdx >= 0) playAmbient(currentAmbientIdx);
  }

  function setAmbientVolume(v) {
    ambientVolume = v;
    if (ambientGain) ambientGain.gain.value = v;
  }

  return { init: init, playOcean: playOcean, stop: stop, setVolume: setVolume, getVolume: getVolume, toggle: toggle, isPlaying: isPlaying, playChime: playChime, playResonance: playResonance, playAmbient: playAmbient, stopAmbient: stopAmbient, resumeAmbient: resumeAmbient, setAmbientVolume: setAmbientVolume };
})();
