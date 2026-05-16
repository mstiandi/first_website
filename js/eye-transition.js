/* 软边人眼过渡 — 入场 + 场景切换共用 */
var EyeTransition = (function () {

  // ── 生成人眼形状 SVG path ──
  function buildEyePath(openness, scale) {
    var W = window.innerWidth;
    var H = window.innerHeight;
    var cx = W / 2;
    var cy = H / 2;

    var baseW = W * 0.82;
    var baseH = H * 0.24;

    var w = baseW * scale;
    var h = baseH * openness * scale;
    if (h < 0.4) h = 0;

    var left   = cx - w / 2;
    var right  = cx + w / 2;
    var top    = cy - h / 2;
    var bottom = cy + h / 2;

    return 'M ' + left.toFixed(1) + ',' + cy.toFixed(1) + ' ' +
      'C ' + (cx - w * 0.38).toFixed(1) + ',' + (top - h * 0.06).toFixed(1) + ' ' +
           (cx + w * 0.30).toFixed(1) + ',' + (top - h * 0.02).toFixed(1) + ' ' +
           right.toFixed(1) + ',' + (cy + h * 0.02).toFixed(1) + ' ' +
      'C ' + (cx + w * 0.32).toFixed(1) + ',' + (bottom + h * 0.10).toFixed(1) + ' ' +
           (cx - w * 0.34).toFixed(1) + ',' + (bottom + h * 0.06).toFixed(1) + ' ' +
           left.toFixed(1) + ',' + cy.toFixed(1) + ' Z';
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 2.5);
  }

  // ── 等待视频就绪 ──
  function waitForVideo(video, timeout) {
    return new Promise(function (resolve) {
      if (!video) return resolve();
      if (video.readyState >= 2) return resolve();
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('canplay', finish);
        resolve();
      }
      video.addEventListener('loadeddata', finish);
      video.addEventListener('canplay', finish);
      setTimeout(finish, timeout || 1200);
    });
  }

  // ── 动态创建场景切换过渡层 ──
  function createOverlay() {
    var el = document.getElementById('eye-transition');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'eye-transition';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<svg width="0" height="0" style="position:absolute">' +
        '<defs>' +
          '<filter id="eye-trans-feather" x="-20%" y="-80%" width="140%" height="260%">' +
            '<feGaussianBlur stdDeviation="18" />' +
          '</filter>' +
          '<mask id="eye-trans-mask" maskUnits="userSpaceOnUse">' +
            '<rect id="eye-trans-mask-bg" x="0" y="0" width="1920" height="1080" fill="white" />' +
            '<path id="eye-trans-hole" fill="black" filter="url(#eye-trans-feather)"></path>' +
          '</mask>' +
        '</defs>' +
      '</svg>';
    document.body.appendChild(el);
    return el;
  }

  function removeOverlay() {
    var el = document.getElementById('eye-transition');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ═══════════ 场景切换动画 ═══════════
  // options: { canvas, onClosed, onDone }
  //   onClosed: called when eyes fully closed — swap video here, can return a <video>
  //   onDone:   called after animation completes and overlay is removed
  function playSceneSwitch(options) {
    var canvas    = options.canvas;
    var onClosed  = options.onClosed;
    var onDone    = options.onDone;

    var overlay = createOverlay();
    var hole    = document.getElementById('eye-trans-hole');
    var maskBg  = document.getElementById('eye-trans-mask-bg');
    if (!hole || !maskBg) return;

    maskBg.setAttribute('width',  window.innerWidth);
    maskBg.setAttribute('height', window.innerHeight);

    // 音频 duck
    var prevVolume = AudioEngine.getVolume ? AudioEngine.getVolume() : 0.3;
    var duckVolume = Math.max(0.02, prevVolume * 0.18);
    AudioEngine.setVolume(duckVolume);

    var phase    = 'A';       // A=closing, B=black+wait, C=opening, D=fading
    var phaseStart = performance.now();
    var videoReady = false;
    var videoPromise = null;

    function animate(now) {
      var elapsed = (now - phaseStart) / 1000;
      var openness, scale, blur, brightness, saturate;

      if (phase === 'A') {
        // ═══ 闭眼 0→0.65s ═══
        var tA = Math.min(1, elapsed / 0.65);
        var p  = easeOut(tA);
        openness   = 1 - p;
        scale      = 1 + 1.15 * (1 - p);
        blur       = 18 * p;
        brightness = 1 - 0.82 * p;
        saturate   = 1 - 0.4 * p;

        if (tA >= 1) {
          // 进入黑屏
          openness = 0; scale = 1;
          blur = 18; brightness = 0.18; saturate = 0.6;
          phase = 'B';
          phaseStart = now;

          // 黑屏时执行视频替换
          if (onClosed) {
            var result = onClosed();
            if (result && result.tagName === 'VIDEO') {
              videoPromise = waitForVideo(result, 1200);
            } else {
              videoPromise = Promise.resolve();
            }
            videoPromise.then(function () { videoReady = true; });
          } else {
            videoReady = true;
          }
        }
      } else if (phase === 'B') {
        // ═══ 黑屏等待（最少 0.3s） ═══
        openness = 0; scale = 1;
        blur = 18; brightness = 0.18; saturate = 0.6;

        if (videoReady && elapsed >= 0.3) {
          phase = 'C';
          phaseStart = now;
        }
      } else if (phase === 'C') {
        // ═══ 睁眼看新场景 0→1.7s ═══
        var tC = Math.min(1, elapsed / 1.7);
        var p  = easeOut(tC);

        if (p < 0.55) {
          var p1 = easeOut(p / 0.55);
          openness = p1; scale = 1;
          blur       = 18 - 12 * p1;
          brightness = 0.18 + 0.42 * p1;
          saturate   = 0.6 + 0.25 * p1;
        } else {
          var p2  = (p - 0.55) / 0.45;
          openness = 1;
          scale    = 1 + p2 * 1.15;
          blur       = 6 * (1 - p2);
          brightness = 0.6 + 0.4 * p2;
          saturate   = 0.85 + 0.15 * p2;
        }

        // 音频渐恢复
        var audioP = Math.min(1, elapsed / 1.4);
        AudioEngine.setVolume(duckVolume + (prevVolume - duckVolume) * easeOut(audioP));

        if (tC >= 1) {
          openness = 1; scale = 2.15;
          blur = 0; brightness = 1; saturate = 1;
          phase = 'D';
          phaseStart = now;
        }
      } else if (phase === 'D') {
        // ═══ 淡出 0→0.55s ═══
        var tD = Math.min(1, elapsed / 0.55);
        openness = 1; scale = 2.15;
        blur = 0; brightness = 1; saturate = 1;
        overlay.style.opacity = Math.max(0, 1 - tD);

        if (tD >= 1) {
          // 清理
          if (canvas) canvas.style.filter = '';
          AudioEngine.setVolume(prevVolume);
          removeOverlay();
          if (onDone) onDone();
          return; // 停止动画循环
        }
      }

      var path = (openness > 0.001 || scale > 1)
        ? buildEyePath(openness, scale) : '';
      hole.setAttribute('d', path);

      if (canvas) {
        canvas.style.filter =
          'brightness(' + brightness.toFixed(2) + ') ' +
          'blur(' + blur.toFixed(1) + 'px) ' +
          'saturate(' + saturate.toFixed(2) + ')';
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  return {
    buildEyePath: buildEyePath,
    playSceneSwitch: playSceneSwitch,
    createOverlay: createOverlay,
    removeOverlay: removeOverlay
  };
})();
