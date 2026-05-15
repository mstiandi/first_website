/* 主场景 — 轻量版：无 shader，纯静态纹理 + 自由凝视 */
var MainScene = (function () {
  var scene, camera, renderer, cylinder;
  var currentRotation = 0;
  var targetRotation = 0;
  var minRot = -75 * Math.PI / 180;
  var maxRot = 75 * Math.PI / 180;
  var animId = null;

  var mouseX = 0.5;
  var dragStartX = 0;
  var dragActive = false;
  var dragThreshold = 70;

  function start() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 60);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -8);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    document.body.appendChild(renderer.domElement);

    loadTexturesAndBuild();

    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景  |  左拖进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    loop();
  }

  function loadTexturesAndBuild() {
    var imgBase = 'images/';
    var mainImg = new Image();
    var grassImg = new Image();

    var loaded = 0;
    function checkAll() { loaded++; if (loaded === 2) buildComposite(); }

    mainImg.onload = checkAll;
    grassImg.onload = checkAll;
    mainImg.src = imgBase + 'True海崖.png';
    grassImg.src = imgBase + 'true海草坪.png';

    function buildComposite() {
      // Much smaller composite — power-of-2 friendly
      var canvasW = 2048;
      var canvasH = 1024;

      var compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = canvasW;
      compositeCanvas.height = canvasH;
      var ctx = compositeCanvas.getContext('2d');

      // Divide into 3 equal sections
      var secW = canvasW / 3;

      // Left: left portion of main image (left cliff)
      var leftSrcW = 400;
      ctx.drawImage(mainImg, 0, 0, leftSrcW, mainImg.height, 0, 0, secW, canvasH);

      // Center: main image
      ctx.drawImage(mainImg, 0, 0, mainImg.width, mainImg.height, secW, 0, secW, canvasH);

      // Right: grassland
      var grassScale = canvasH / grassImg.height;
      var grassDrawW = grassImg.width * grassScale;
      ctx.drawImage(grassImg, secW * 2 + (secW - grassDrawW) / 2, 0, grassDrawW, canvasH);

      var tex = new THREE.CanvasTexture(compositeCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      buildCylinder(tex);

      var loading = document.getElementById('loading');
      if (loading) loading.style.opacity = '0';
    }
  }

  function buildCylinder(tex) {
    var radius = 16;
    var height = 10.5;
    var totalAngle = 150 * Math.PI / 180;
    var thetaStart = Math.PI - totalAngle / 2;

    // Simple material — no shader
    var material = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide
    });

    var geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, thetaStart, totalAngle);
    cylinder = new THREE.Mesh(geometry, material);
    scene.add(cylinder);
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
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (renderer) {
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  return { start: start };
})();
