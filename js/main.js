/* 精神避难所 v5 — 入口编排 */
(function () {

  ChatSystem.init();

  // 主场景在后台静默渲染（无无人机入场）
  MainScene.start();

  // 睁眼入场
  playEyeEntrance();

  // 海浪声与睁眼同步淡入
  AudioEngine.playOcean();
  AudioEngine.setVolume(0);
  var rampStart = performance.now();
  var rampDuration = 5200;
  var targetVolume = 0.3;
  function rampAudio() {
    var t = Math.min(1, (performance.now() - rampStart) / rampDuration);
    AudioEngine.setVolume(targetVolume * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(rampAudio);
    else AudioEngine.setVolume(targetVolume);
  }
  requestAnimationFrame(rampAudio);

  function playEyeEntrance() {
    var entrance = document.getElementById('eye-entrance');
    if (!entrance) return;

    document.body.classList.add('eye-opening');

    requestAnimationFrame(function () {
      entrance.classList.add('opening');
    });

    setTimeout(function () {
      document.body.classList.remove('eye-opening');
      if (entrance && entrance.parentNode) {
        entrance.parentNode.removeChild(entrance);
      }
    }, 5400);
  }

})();
