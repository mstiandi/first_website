/* 环境音引擎 — Web Audio API 生成海浪声 */
var AudioEngine = (function () {
  var ctx = null;
  var gainNode = null;
  var sourceNode = null;
  var playing = false;
  var volume = 0.3;

  function init() {
    if (ctx) return;
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
  function toggle() {
    if (playing) { stop(); return false; }
    else { playOcean(); return true; }
  }
  function isPlaying() { return playing; }

  return { init: init, playOcean: playOcean, stop: stop, setVolume: setVolume, toggle: toggle, isPlaying: isPlaying };
})();
