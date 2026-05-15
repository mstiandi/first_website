/* 主场景 — 单视频面板 + 左侧黑面板（聊天入口）+ 双击仰天 */
var MainScene = (function () {
  var scene, camera, renderer;
  var currentRotation = 0, targetRotation = 0;
  var currentXRotation = 0, targetXRotation = 0;
  var animId = null;
  var mouseX = 0.5;
  var dragStartX = 0, dragActive = false, dragThreshold = 70;
  var isLying = false;

  var maxRotRight = 30 * Math.PI / 180;
  var maxRotLeft  = -30 * Math.PI / 180;

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
    window.addEventListener('dblclick', onDoubleClick);

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景 | 双击仰天躺下 | 左拖进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    var loading = document.getElementById('loading');
    if (loading) loading.style.opacity = '0';

    loop();
  }

  function buildScene() {
    var radius = 8;
    var height = 7;
    var videoArc = 90 * Math.PI / 180;    // 视频面板 90°
    var blackArc = 35 * Math.PI / 180;     // 左侧黑面板 35°

    // 视频面板居中
    var thetaStart = Math.PI - videoArc / 2;

    // ── 视频面板 ──
    var video = document.createElement('video');
    video.src = 'videos/海崖_web.mp4';
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

    var videoGeo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, thetaStart, videoArc);
    var uv = videoGeo.attributes.uv;
    for (var i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i));
    }
    var videoMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
    scene.add(new THREE.Mesh(videoGeo, videoMat));

    // ── 左侧黑面板 ──
    var blackStart = thetaStart - blackArc;
    var blackMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide });
    var blackGeo = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true, blackStart, blackArc);
    scene.add(new THREE.Mesh(blackGeo, blackMat));

    // ── 天空顶盖（双击仰天时可见）──
    var skyTex = new THREE.TextureLoader().load('images/蓝天.png');
    skyTex.colorSpace = THREE.SRGBColorSpace;
    var skyGeo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    var skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.DoubleSide });
    var skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.y = height / 2;
    skyMesh.rotation.x = Math.PI / 2;
    scene.add(skyMesh);
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    if (!dragActive) {
      if (mouseX > 0.5) {
        targetRotation = (mouseX - 0.5) * 2 * maxRotRight;
      } else {
        targetRotation = -(0.5 - mouseX) * 2 * maxRotRight;
      }
      targetRotation = Math.max(maxRotLeft, Math.min(maxRotRight, targetRotation));
    }

    currentRotation += (targetRotation - currentRotation) * 0.06;
    if (Math.abs(currentRotation - targetRotation) < 0.0002) {
      currentRotation = targetRotation;
    }

    currentXRotation += (targetXRotation - currentXRotation) * 0.05;
    if (Math.abs(currentXRotation - targetXRotation) < 0.0005) {
      currentXRotation = targetXRotation;
    }

    camera.rotation.y = currentRotation;
    camera.rotation.x = currentXRotation;
    renderer.render(scene, camera);
  }

  function onDoubleClick(e) {
    if (ChatSystem.isActive()) return;
    isLying = !isLying;
    targetXRotation = isLying ? Math.PI / 2 : 0;
    console.log('双击:', isLying ? '仰天躺下' : '坐起', 'targetXRotation:', targetXRotation);
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
