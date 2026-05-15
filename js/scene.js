/* 主场景 — CSS 3D 全景：零 WebGL，纯 CSS transform */
var MainScene = (function () {
  var container, wrapper;
  var currentRot = 0;
  var targetRot = 0;
  var minRot = -75;
  var maxRot = 75;
  var animId = null;

  var mouseX = 0.5;
  var dragStartX = 0;
  var dragActive = false;
  var dragThreshold = 70;

  function start() {
    // Remove Three.js canvas from entrance
    var oldCanvas = document.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();

    // Create CSS scene container
    container = document.createElement('div');
    container.id = 'scene-container';
    container.innerHTML = [
      '<div id="scene-wrapper">',
        '<div class="scene-panel scene-panel-left"></div>',
        '<div class="scene-panel scene-panel-center"></div>',
        '<div class="scene-panel scene-panel-right"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(container);

    wrapper = document.getElementById('scene-wrapper');

    // Events
    document.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    // Hint
    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景  |  左拖进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    // Hide loading
    var loading = document.getElementById('loading');
    if (loading) loading.style.opacity = '0';

    // Set background images directly — no canvas, no WebGL
    var panels = document.querySelectorAll('.scene-panel');
    if (panels[1]) panels[1].style.backgroundImage = 'url(images/True海崖.png)';
    if (panels[2]) panels[2].style.backgroundImage = 'url(images/true海草坪.png)';
    // Left panel uses same image for now
    if (panels[0]) panels[0].style.backgroundImage = 'url(images/True海崖.png)';

    loop();
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    if (!dragActive) {
      targetRot = (mouseX - 0.5) * 2 * maxRot;
      targetRot = Math.max(minRot, Math.min(maxRot, targetRot));
    }

    currentRot += (targetRot - currentRot) * 0.06;
    if (Math.abs(currentRot - targetRot) < 0.01) {
      currentRot = targetRot;
    }

    // Apply CSS transform — rotateY + slight scale for depth
    wrapper.style.transform = 'rotateY(' + (-currentRot) + 'deg)';
  }

  function onMouseMove(e) {
    mouseX = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
    if (dragActive) {
      if (e.clientX - dragStartX < -dragThreshold) {
        dragActive = false;
        ChatSystem.enter();
      }
    }
  }

  function onMouseDown(e) {
    if (ChatSystem.isActive()) return;
    dragActive = true;
    dragStartX = e.clientX;
  }

  function onMouseUp(e) { dragActive = false; }

  function onResize() {
    // CSS handles responsiveness automatically
  }

  return { start: start };
})();
