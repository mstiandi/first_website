/* 主场景 — Three.js 圆柱全景 + 海洋 Shader + 自由凝视 */
var MainScene = (function () {
  var scene, camera, renderer, cylinder;
  var oceanMaterial = null;
  var currentRotation = 0;
  var targetRotation = 0;
  var minRot = -75 * Math.PI / 180;
  var maxRot = 75 * Math.PI / 180;
  var animId = null;

  // Free gaze: mouse position maps to view rotation
  var mouseX = 0.5; // normalized 0-1

  // Left-drag state for chat
  var dragStartX = 0;
  var dragActive = false;
  var dragThreshold = 70;

  function start() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 15, 50);

    // Wider FOV + full-frame camera
    camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 60);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 0.8s';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    document.body.appendChild(renderer.domElement);

    requestAnimationFrame(function () {
      renderer.domElement.style.opacity = '1';
    });

    loadTexturesAndBuild();

    // Events — free gaze + left-drag-to-chat
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    // Hint
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
    var maskImg = new Image();

    var loaded = 0;
    function checkAll() { loaded++; if (loaded === 3) buildComposite(); }

    mainImg.onload = checkAll;
    grassImg.onload = checkAll;
    maskImg.onload = checkAll;

    mainImg.src = imgBase + 'True海崖.png';
    grassImg.src = imgBase + 'true海草坪.png';
    maskImg.src = imgBase + 'ocean_mask.png';

    function buildComposite() {
      var h = 1045;
      var centerW = 1506;
      var sideW = 1000;
      var totalW = sideW + centerW + sideW;

      var compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = totalW;
      compositeCanvas.height = h;
      var ctx = compositeCanvas.getContext('2d');

      // Left: left portion of main image
      ctx.drawImage(mainImg, 0, 0, 300, h, 0, 0, sideW, h);
      // Center: full main image
      ctx.drawImage(mainImg, 0, 0, centerW, h, sideW, 0, centerW, h);
      // Right: grassland
      var grassScale = h / grassImg.height;
      var grassDrawW = grassImg.width * grassScale;
      var grassX = sideW + centerW + (sideW - grassDrawW) / 2;
      ctx.drawImage(grassImg, grassX, 0, grassDrawW, h);

      // Mask composite
      var maskCanvas = document.createElement('canvas');
      maskCanvas.width = totalW;
      maskCanvas.height = h;
      var mctx = maskCanvas.getContext('2d');
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, sideW, h);
      mctx.drawImage(maskImg, 0, 0, centerW, h, sideW, 0, centerW, h);
      mctx.fillStyle = '#000';
      mctx.fillRect(sideW + centerW, 0, sideW, h);

      var colorTex = new THREE.CanvasTexture(compositeCanvas);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      var maskTex = new THREE.CanvasTexture(maskCanvas);

      buildCylinder(colorTex, maskTex);

      var loading = document.getElementById('loading');
      if (loading) loading.style.opacity = '0';
    }
  }

  function buildCylinder(colorTex, maskTex) {
    // Bigger cylinder to fill the viewport
    var radius = 16;
    var height = 10.5;
    var totalAngle = 150 * Math.PI / 180;
    var thetaStart = Math.PI - totalAngle / 2;

    oceanMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTexture: { value: colorTex },
        uMask: { value: maskTex },
        uTime: { value: 0 },
        uMaskStrength: { value: 1.0 }
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        in vec2 vUv;
        uniform sampler2D uTexture;
        uniform sampler2D uMask;
        uniform float uTime;
        uniform float uMaskStrength;

        void main() {
          float mask = texture(uMask, vUv).r;

          float wave1 = sin(vUv.y * 18.0 + uTime * 1.8) * cos(vUv.x * 12.0 + uTime * 1.3) * 0.006;
          float wave2 = sin(vUv.y * 27.0 + uTime * 2.4) * cos(vUv.x * 20.0 - uTime * 1.6) * 0.004;
          float wave3 = cos(vUv.y * 35.0 + uTime * 3.1) * sin(vUv.x * 16.0 + uTime * 2.1) * 0.003;
          float foam = sin(vUv.y * 55.0 + uTime * 4.0) * cos(vUv.x * 60.0 - uTime * 3.5) * 0.002;

          vec2 disp = vec2(wave1 + wave2, wave3 + foam) * mask * uMaskStrength;
          vec2 uvDisp = clamp(vUv + disp, 0.001, 0.999);

          vec4 color = texture(uTexture, uvDisp);

          float sparkle = sin(vUv.y * 70.0 + uTime * 5.0) * cos(vUv.x * 55.0 + uTime * 4.0);
          sparkle = max(0.0, sparkle) * 0.025 * mask;
          color.rgb += sparkle;
          color.rgb += vec3(-0.01, 0.0, 0.02) * mask * 0.3;

          gl_FragColor = color;
        }
      `
    });

    var geometry = new THREE.CylinderGeometry(radius, radius, height, 80, 1, true, thetaStart, totalAngle);
    cylinder = new THREE.Mesh(geometry, oceanMaterial);
    scene.add(cylinder);

    // Ambient
    scene.add(new THREE.AmbientLight(0x445566, 0.9));
    var key = new THREE.DirectionalLight(0xffddbb, 1.0);
    key.position.set(5, 8, -3);
    scene.add(key);
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    // Free gaze: map mouse position to target rotation
    if (!dragActive) {
      // mouseX 0 = left edge, 1 = right edge → map to -75° to +75°
      targetRotation = (mouseX - 0.5) * 2 * maxRot;
      targetRotation = Math.max(minRot, Math.min(maxRot, targetRotation));
    }

    // Smooth interpolation
    currentRotation += (targetRotation - currentRotation) * 0.06;
    if (Math.abs(currentRotation - targetRotation) < 0.0002) {
      currentRotation = targetRotation;
    }
    camera.rotation.y = currentRotation;

    if (oceanMaterial) {
      oceanMaterial.uniforms.uTime.value = performance.now() / 1000;
    }

    renderer.render(scene, camera);
  }

  // ── Free gaze: mouse position → view direction ──
  function onMouseMove(e) {
    mouseX = e.clientX / window.innerWidth;
    mouseX = Math.max(0, Math.min(1, mouseX)); // clamp

    // Left-drag detection
    if (dragActive) {
      var dx = e.clientX - dragStartX;
      if (dx < -dragThreshold) {
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

  function onMouseUp(e) {
    dragActive = false;
  }

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
