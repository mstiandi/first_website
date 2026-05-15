/* 主场景 — Three.js 圆柱全景 + 海洋 Shader + 视角旋转 */
var MainScene = (function () {
  var scene, camera, renderer, cylinder;
  var oceanMaterial = null;
  var currentRotation = 0;    // radians
  var targetRotation = 0;
  var minRot = -75 * Math.PI / 180;
  var maxRot = 75 * Math.PI / 180;
  var animId = null;

  // Drag state
  var isDragging = false;
  var dragStartX = 0;
  var dragStartRot = 0;
  var dragMovedLeft = false;
  var dragThreshold = 50;     // px for left-drag to trigger chat
  var dragTotalX = 0;

  // Composited texture
  var compositeCanvas = null;

  function start() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 8, 30);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 50);
    camera.position.set(0, 0.8, 0);
    camera.lookAt(0, 0.3, -5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 0.8s';
    document.body.appendChild(renderer.domElement);

    // Show renderer
    requestAnimationFrame(function () {
      renderer.domElement.style.opacity = '1';
    });

    // Load textures and build cylinder
    loadTexturesAndBuild();

    // Events
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    // Hint text
    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '→ 转动视角  |  ← 进入对话';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    // Start loop
    loop();
  }

  function loadTexturesAndBuild() {
    var loader = new THREE.TextureLoader();
    var imgBase = 'images/';

    // We'll build the composite on a canvas
    var mainImg = new Image();
    var grassImg = new Image();
    var maskImg = new Image();

    var loaded = 0;
    function checkAll() {
      loaded++;
      if (loaded === 3) buildComposite();
    }

    mainImg.onload = checkAll;
    grassImg.onload = checkAll;
    maskImg.onload = checkAll;

    mainImg.src = imgBase + 'True海崖.png';
    grassImg.src = imgBase + 'true海草坪.png';
    maskImg.src = imgBase + 'ocean_mask.png';

    function buildComposite() {
      // Canvas dimensions
      var h = 1045;
      var centerW = 1506;  // main image width
      var sideW = 1000;    // side image width
      var totalW = sideW + centerW + sideW;  // ~3506

      compositeCanvas = document.createElement('canvas');
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

      // Create mask composite (same layout)
      var maskCanvas = document.createElement('canvas');
      maskCanvas.width = totalW;
      maskCanvas.height = h;
      var mctx = maskCanvas.getContext('2d');

      // Left: black
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, sideW, h);
      // Center: mask image
      mctx.drawImage(maskImg, 0, 0, centerW, h, sideW, 0, centerW, h);
      // Right: black
      mctx.fillStyle = '#000';
      mctx.fillRect(sideW + centerW, 0, sideW, h);

      // Create textures
      var colorTex = new THREE.CanvasTexture(compositeCanvas);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      var maskTex = new THREE.CanvasTexture(maskCanvas);

      // Build cylinder
      buildCylinder(colorTex, maskTex, totalW, h);

      // Hide loading
      var loading = document.getElementById('loading');
      if (loading) loading.style.opacity = '0';
    }
  }

  function buildCylinder(colorTex, maskTex, texW, texH) {
    var radius = 12;
    var height = 7;
    var totalAngle = 150 * Math.PI / 180;  // 150 degrees in radians
    var thetaStart = Math.PI - totalAngle / 2; // center the arc

    // Shader material with ocean displacement
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

    // Subtle ground plane for depth
    var groundGeo = new THREE.PlaneGeometry(30, 8);
    var groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -2.5, -3);
    scene.add(ground);

    // Ambient light
    var ambient = new THREE.AmbientLight(0x334455, 0.8);
    scene.add(ambient);

    // Key light (warm, from sun direction)
    var key = new THREE.DirectionalLight(0xffddbb, 1.0);
    key.position.set(5, 8, -3);
    scene.add(key);
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    // Smooth rotation
    currentRotation += (targetRotation - currentRotation) * 0.08;
    camera.rotation.y = currentRotation;

    // Clamp
    if (Math.abs(currentRotation - targetRotation) < 0.0001) {
      currentRotation = targetRotation;
    }

    // Update ocean time
    if (oceanMaterial) {
      oceanMaterial.uniforms.uTime.value = performance.now() / 1000;
    }

    renderer.render(scene, camera);
  }

  // ── Mouse / Drag ──
  function onMouseDown(e) {
    if (ChatSystem.isActive()) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartRot = targetRotation;
    dragMovedLeft = false;
    dragTotalX = 0;
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    var dx = e.clientX - dragStartX;
    dragTotalX = dx;

    if (dx < -dragThreshold && !dragMovedLeft) {
      // Left drag detected — enter chat
      dragMovedLeft = true;
      isDragging = false;
      ChatSystem.enter();
      return;
    }

    if (!dragMovedLeft) {
      // Right or neutral drag — rotate view
      var sensitivity = 0.005;
      targetRotation = dragStartRot - dx * sensitivity;
      targetRotation = Math.max(minRot, Math.min(maxRot, targetRotation));
    }
  }

  function onMouseUp(e) {
    isDragging = false;
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
