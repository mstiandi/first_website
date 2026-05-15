/* 主场景 — Three.js 圆柱全景：VideoTexture 直贴，零 shader，零 canvas */
var MainScene = (function () {
  var scene, camera, renderer;
  var currentRotation = 0, targetRotation = 0;
  var minRot = -75 * Math.PI / 180, maxRot = 75 * Math.PI / 180;
  var animId = null;
  var mouseX = 0.5;
  var dragStartX = 0, dragActive = false, dragThreshold = 70;
  var videoTextures = [];

  function start() {
    // 清理入场 canvas
    var oldCanvases = document.querySelectorAll('canvas');
    oldCanvases.forEach(function (c) { c.remove(); });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 40);
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    document.body.appendChild(renderer.domElement);

    buildCylinderWithVideos();

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

  function buildCylinderWithVideos() {
    var radius = 8;
    var height = 9;
    var arcAngle = 50 * Math.PI / 180; // each panel = 50°
    var totalArc = 150 * Math.PI / 180; // full visible arc
    var thetaStart = Math.PI - totalArc / 2;

    var videoFiles = ['videos/right.mp4', 'videos/middle.mp4', 'videos/left.mp4'];

    videoFiles.forEach(function (file, i) {
      var video = document.createElement('video');
      video.src = file;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.style.display = 'none';
      document.body.appendChild(video);
      video.play();

      var tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      videoTextures.push(tex);

      var material = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.BackSide
      });

      var segStart = thetaStart + i * arcAngle;
      var geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true, segStart, arcAngle);

      var segment = new THREE.Mesh(geometry, material);
      scene.add(segment);
    });
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    if (!dragActive) {
      targetRotation = (mouseX - 0.5) * 2 * maxRot;
      targetRotation = Math.max(minRot, Math.min(maxRot, targetRotation));
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
