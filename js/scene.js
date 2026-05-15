/* 主场景 — 双视频面板 + 左侧黑面板（聊天入口） */
var MainScene = (function () {
  var scene, camera, renderer;
  var currentRotation = 0, targetRotation = 0;
  var animId = null;
  var mouseX = 0.5;
  var dragStartX = 0, dragActive = false, dragThreshold = 70;

  // 非对称旋转范围
  var maxRotRight = 30 * Math.PI / 180;
  var maxRotLeft  = -70 * Math.PI / 180;

  function start() {
    var oldCanvases = document.querySelectorAll('canvas');
    oldCanvases.forEach(function (c) { c.remove(); });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.5, 50);
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    document.body.appendChild(renderer.domElement);

    buildScene();

    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景  |  左拖进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    var loading = document.getElementById('loading');
    if (loading) loading.style.opacity = '0';

    loop();
  }

  function buildScene() {
    var radius = 12;
    var height = 7;
    var panelArc = 60 * Math.PI / 180;     // 每个视频面板 60°
    var blackArc = 40 * Math.PI / 180;      // 左侧黑面板
    var totalVideoArc = panelArc * 2;        // 两个视频 = 120°
    var thetaStart = Math.PI - totalVideoArc / 2;

    // ── 视频面板：左 + 中 ──
    var videoFiles = ['videos/left.mp4', 'videos/middle.mp4'];
    videoFiles.forEach(function (file, i) {
      var video = document.createElement('video');
      video.src = file;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      video.play();

      var tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      var material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
      var segStart = thetaStart + i * panelArc;
      var geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true, segStart, panelArc);
      scene.add(new THREE.Mesh(geometry, material));
    });

    // ── 左侧黑面板 ──
    var blackStart = thetaStart - blackArc;
    var blackMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide });
    var blackGeo = new THREE.CylinderGeometry(radius, radius, height, 16, 1, true, blackStart, blackArc);
    scene.add(new THREE.Mesh(blackGeo, blackMat));
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    if (!dragActive) {
      if (mouseX > 0.5) {
        targetRotation = (mouseX - 0.5) * 2 * maxRotRight;
      } else {
        targetRotation = (mouseX - 0.5) * 2 * (-maxRotLeft);
      }
      targetRotation = Math.max(maxRotLeft, Math.min(maxRotRight, targetRotation));
    }

    currentRotation += (targetRotation - currentRotation) * 0.06;
    if (Math.abs(currentRotation - targetRotation) < 0.0002) {
      currentRotation = targetRotation;
    }
    camera.rotation.y = currentRotation;
    renderer.render(scene, camera);
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

  function onResize() {
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { start: start };
})();
