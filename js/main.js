/* 精神避难所 v5 — 入口编排 */
(function () {

  ChatSystem.init();

  // 主场景在后台静默渲染（等待 video ready 后再睁眼）
  MainScene.start();

  var entranceStarted = false;
  var rampStart = 0;

  function startEyeEntrance() {
    if (entranceStarted) return;
    entranceStarted = true;

    AudioEngine.playOcean();
    AudioEngine.setVolume(0);
    rampStart = performance.now();
    rampAudio();

    playEyeEntrance();
  }

  // 等主视频就绪再睁眼
  window.addEventListener('main-scene-ready', startEyeEntrance);
  // 2200ms 兜底
  setTimeout(function () {
    if (!entranceStarted) startEyeEntrance();
  }, 2200);

  var rampDuration = 6200;
  var targetVolume = 0.3;
  function rampAudio() {
    var t = Math.min(1, (performance.now() - rampStart) / rampDuration);
    AudioEngine.setVolume(targetVolume * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(rampAudio);
    else AudioEngine.setVolume(targetVolume);
  }

  // ── 睁眼入场动画（复用 EyeTransition.buildEyePath）──
  function playEyeEntrance() {
    var entrance = document.getElementById('eye-entrance');
    var hole     = document.getElementById('eye-hole');
    var maskBg   = document.getElementById('eye-mask-bg');
    if (!entrance || !hole) return;

    // userSpaceOnUse 需要像素尺寸
    if (maskBg) {
      maskBg.setAttribute('width',  window.innerWidth);
      maskBg.setAttribute('height', window.innerHeight);
    }

    var canvas    = document.querySelector('canvas');
    var startTime = performance.now();
    var total     = 6.2;

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 2.5);
    }

    function animate(now) {
      var elapsed = (now - startTime) / 1000;
      var t = elapsed / total;

      var openness, scale, blur, brightness, saturate;

      if (t < 0.056) {
        // ═══ A: 0–0.35s 全黑 ═══
        openness = 0; scale = 1;
        blur = 18; brightness = 0.12; saturate = 0.55;
      } else if (t < 0.282) {
        // ═══ B: 0.35–1.75s 第一睁 —— 朦胧梦境 ═══
        var p = easeOut((t - 0.056) / 0.226);
        openness = p; scale = 1;
        blur       = 18 - 2 * p;       // 18 → 16
        brightness = 0.12 + 0.22 * p;  // 0.12 → 0.34
        saturate   = 0.55 + 0.10 * p;  // 0.55 → 0.65
      } else if (t < 0.363) {
        // ═══ C: 1.75–2.25s 眨眼闭合 ═══
        var p = (t - 0.282) / 0.081;
        openness = 1 - p; scale = 1;
        blur       = 16;
        brightness = 0.34 - 0.22 * p;
        saturate   = 0.65 - 0.10 * p;
      } else if (t < 0.411) {
        // ═══ D: 2.25–2.55s 黑屏停顿 ═══
        openness = 0; scale = 1;
        blur = 18; brightness = 0.12; saturate = 0.55;
      } else if (t < 0.879) {
        // ═══ E: 2.55–5.45s 第二睁 —— 人眼→全屏 ═══
        var p = (t - 0.411) / 0.468; // 0 → 1
        if (p < 0.55) {
          // E1: 正常眼型睁大
          var p1 = easeOut(p / 0.55);
          openness = p1; scale = 1;
          blur       = 18 - 12 * p1;   // 18 → 6
          brightness = 0.18 + 0.42 * p1; // 0.18 → 0.6
          saturate   = 0.60 + 0.25 * p1; // 0.60 → 0.85
        } else {
          // E2: 扩至覆盖全屏
          var p2 = (p - 0.55) / 0.45;
          openness = 1;
          scale      = 1 + p2 * 1.15;   // 1 → 2.15
          blur       = 6 * (1 - p2);    // 6 → 0
          brightness = 0.60 + 0.40 * p2; // 0.6 → 1
          saturate   = 0.85 + 0.15 * p2; // 0.85 → 1
        }
      } else {
        // ═══ F: 5.45–6.2s 遮罩淡出 ═══
        var p = (t - 0.879) / 0.121;
        openness = 1; scale = 2.15;
        blur = 0; brightness = 1; saturate = 1;
        entrance.style.opacity = Math.max(0, 1 - p);
      }

      var path = (openness > 0.001 || scale > 1)
        ? EyeTransition.buildEyePath(openness, scale) : '';
      hole.setAttribute('d', path);

      if (canvas) {
        canvas.style.filter =
          'brightness(' + brightness.toFixed(2) + ') ' +
          'blur(' + blur.toFixed(1) + 'px) ' +
          'saturate(' + saturate.toFixed(2) + ')';
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        if (canvas) canvas.style.filter = '';
        if (entrance && entrance.parentNode) {
          entrance.parentNode.removeChild(entrance);
        }
      }
    }

    requestAnimationFrame(animate);
  }

})();
