/* 入场仪式 — Three.js 眼镜动画，~3.5秒 */
var EntranceAnimation = (function () {
  var scene, camera, renderer, glasses;
  var animId = null;
  var container = null;
  var onComplete = null;

  function start(onDone) {
    onComplete = onDone;
    container = document.body;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 0.2, 5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lighting
    var ambient = new THREE.AmbientLight(0x333333, 0.6);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x8899cc, 0.5);
    rim.position.set(-1, 1, -2);
    scene.add(rim);

    // Build glasses
    buildGlasses();

    // Fog for depth
    scene.fog = new THREE.Fog(0x000000, 3, 12);

    // Start animation loop
    var startTime = performance.now();
    function animate(now) {
      animId = requestAnimationFrame(animate);
      var t = (now - startTime) / 1000; // seconds

      if (t < 3.8) {
        updateGlasses(t);
        renderer.render(scene, camera);
      } else {
        // Done — crossfade to main scene
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity 0.8s';
        setTimeout(function () {
          cancelAnimationFrame(animId);
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          renderer.dispose();
          scene.clear();
          if (onComplete) onComplete();
        }, 800);
      }
    }
    animId = requestAnimationFrame(animate);
    return renderer;
  }

  function buildGlasses() {
    glasses = new THREE.Group();

    var frameMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.4,
      metalness: 0.3
    });
    var lensMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.25
    });
    var armMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a,
      roughness: 0.5,
      metalness: 0.2
    });

    // Left lens ring
    var leftRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 16, 48), frameMat);
    leftRing.position.set(-0.33, 0, 0);
    glasses.add(leftRing);

    // Right lens ring
    var rightRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 16, 48), frameMat);
    rightRing.position.set(0.33, 0, 0);
    glasses.add(rightRing);

    // Bridge
    var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), frameMat);
    bridge.position.set(0, 0.08, 0);
    glasses.add(bridge);

    // Left lens glass
    var leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.29, 32), lensMat);
    leftLens.position.set(-0.33, 0, -0.01);
    glasses.add(leftLens);

    // Right lens glass
    var rightLens = new THREE.Mesh(new THREE.CircleGeometry(0.29, 32), lensMat);
    rightLens.position.set(0.33, 0, -0.01);
    glasses.add(rightLens);

    // Left arm
    var leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.03), armMat);
    leftArm.position.set(-0.62, 0.02, -0.03);
    leftArm.rotation.set(0, 0.15, -0.08);
    glasses.add(leftArm);

    // Right arm
    var rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.03), armMat);
    rightArm.position.set(0.62, 0.02, -0.03);
    rightArm.rotation.set(0, -0.15, 0.08);
    glasses.add(rightArm);

    // Subtle warm point light near glasses
    var glowLight = new THREE.PointLight(0xffddaa, 0.4, 3);
    glowLight.position.set(0, 0, 1);
    glasses.add(glowLight);

    scene.add(glasses);
  }

  function updateGlasses(t) {
    if (t < 0.8) {
      // Phase 1: fade in
      glasses.position.set(0, 0.4, -2);
      glasses.rotation.set(0.15, 0.3, -0.05);
      glasses.scale.setScalar(0.6);
      setOpacity(glasses, Math.min(1, t / 0.8));
    } else if (t < 2.8) {
      // Phase 2: move toward face
      var p = (t - 0.8) / 2.0;
      var ease = easeInOutCubic(p);
      glasses.position.set(0, 0.4 + ease * -0.1, -2 + ease * 1.0);
      glasses.rotation.set(0.15 * (1 - ease), 0.3 * (1 - ease), -0.05 * (1 - ease));
      glasses.scale.setScalar(0.6 + ease * 1.6);
    } else {
      // Phase 3: hold at face, slight breathing
      var b = Math.sin((t - 2.8) * 2.5) * 0.003;
      glasses.position.set(0, 0.3 + b, -1.0 + b * 2);
      glasses.rotation.set(0, 0, 0);
      glasses.scale.setScalar(2.2);
    }
  }

  function setOpacity(group, opacity) {
    group.traverse(function (child) {
      if (child.material && child.material.opacity !== undefined) {
        child.material.transparent = true;
        child.material.opacity = Math.min(child.material.userData?.baseOpacity || 1, opacity);
      }
    });
  }

  function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

  return { start: start };
})();
