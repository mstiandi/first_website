/* 主场景 — CSS 3D 全景：支持视频/图片面板，自动降级 */
var MainScene = (function () {
  var container, wrapper;
  var currentRot = 0, targetRot = 0;
  var minRot = -75, maxRot = 75;
  var animId = null;
  var mouseX = 0.5;
  var dragStartX = 0, dragActive = false, dragThreshold = 70;

  // ── 素材配置（替换视频/图片改这里就行）──
  var panels = [
    { src: 'videos/left.mp4',   type: 'video' },
    { src: 'videos/middle.mp4', type: 'video' },
    { src: 'videos/right.mp4',  type: 'video' }
  ];

  // 如果有视频可用，自动替换对应面板
  // 例：panels[1] = { src: 'videos/ocean.mp4', type: 'video' };

  function start() {
    // 清理入场动画的 canvas
    var oldCanvas = document.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();

    // 创建场景容器
    container = document.createElement('div');
    container.id = 'scene-container';
    document.body.appendChild(container);

    wrapper = document.createElement('div');
    wrapper.id = 'scene-wrapper';
    container.appendChild(wrapper);

    // 按配置创建面板（图片或视频）
    panels.forEach(function (panel, i) {
      var el;
      if (panel.type === 'video') {
        el = document.createElement('video');
        el.src = panel.src;
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.playsInline = true;
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        el.style.pointerEvents = 'none';
      } else {
        el = document.createElement('div');
        el.style.backgroundImage = 'url(' + panel.src + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
      el.className = 'scene-panel';
      wrapper.appendChild(el);
    });

    // 交互
    document.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景  |  左拖进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    var loading = document.getElementById('loading');
    if (loading) loading.style.opacity = '0';

    loop();
  }

  function loop() {
    animId = requestAnimationFrame(loop);
    if (!dragActive) {
      targetRot = (mouseX - 0.5) * 2 * maxRot;
      targetRot = Math.max(minRot, Math.min(maxRot, targetRot));
    }
    currentRot += (targetRot - currentRot) * 0.06;
    if (Math.abs(currentRot - targetRot) < 0.01) currentRot = targetRot;
    wrapper.style.transform = 'rotateY(' + (-currentRot) + 'deg)';
  }

  function onMouseMove(e) {
    mouseX = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
    if (dragActive && e.clientX - dragStartX < -dragThreshold) {
      dragActive = false;
      ChatSystem.enter();
    }
  }
  function onMouseDown(e) {
    if (ChatSystem.isActive()) return;
    dragActive = true;
    dragStartX = e.clientX;
  }
  function onMouseUp(e) { dragActive = false; }

  return { start: start };
})();
