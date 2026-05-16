/* 主场景 — 单视频面板 + 左侧黑面板（聊天入口）+ 随机场景 + 圆柱选择器（点击选择） */
var SCENES = [
  { path: 'videos/海崖_web.mp4',        name: '海崖',   meaning: '孤独与辽阔' },
  { path: 'videos/篝火旁视角_web.mp4',   name: '篝火旁', meaning: '温暖与陪伴' },
  { path: 'videos/草田视角_web.mp4',     name: '草田',   meaning: '自由与生长' },
  { path: 'videos/森林_web.mp4',        name: '森林',   meaning: '静谧与深邃' }
];
var pickedScene = SCENES[Math.floor(Math.random() * SCENES.length)];

var MainScene = (function () {
  var scene, camera, renderer;
  var currentRotation = 0, targetRotation = 0;
  var mouseX = 0.5;
  var dragStartY = 0, dragActive = false, dragThreshold = 70;
  var transitionActive = false;
  var maxRotRight = 30 * Math.PI / 180;
  var maxRotLeft  = -30 * Math.PI / 180;

  // 入场动画
  var entranceStartTime = 0;
  var entranceDuration = 4.5;
  var entranceStartY = 3.4;
  var entrancePlaying = true;
  var entranceWaiting = true;
  var entranceVideo = null;

  // 当前场景视频纹理
  var videoTex;
  var videoMat;

  // ── 圆柱选择器 ──
  var currentMode = 'main'; // 'main' | 'selector'
  var selectorScene = null;
  var selectorCamera = null;
  var selectorVideos = [];
  var selectorRotation = 0;
  var selectorTargetRotation = 0;
  var selectorBuilt = false;

  // 选择器交互
  var raycaster = new THREE.Raycaster();
  var mouseNDC = new THREE.Vector2();
  var hoveredIdx = -1;
  var selectorPanels = [];   // { mesh, frame, sceneIndex }
  var clickStartX = 0, clickStartY = 0;

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
    buildSelectorWorld();

    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('keydown', onKeyDown);

    function beginEntrance() {
      if (!entranceWaiting) return;
      entranceWaiting = false;
      entrancePlaying = false;
      camera.position.set(0, 0, 0);
      window.dispatchEvent(new Event('main-scene-ready'));
    }
    if (entranceVideo && entranceVideo.readyState >= 2) {
      beginEntrance();
    } else if (entranceVideo) {
      entranceVideo.addEventListener('canplay', function onReady() {
        entranceVideo.removeEventListener('canplay', onReady);
        beginEntrance();
      });
      setTimeout(function () { beginEntrance(); }, 2000);
    } else {
      beginEntrance();
    }

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景 | 下拖对话 · 上拖返回';
    document.body.appendChild(hint);
    setTimeout(function () { hint.style.opacity = '0'; }, 8000);

    var loading = document.getElementById('loading');
    if (loading) loading.style.opacity = '0';

    loop();
  }

  function buildScene() {
    var radius = 8;
    var height = 7;
    var videoArc = 90 * Math.PI / 180;
    var blackArc = 35 * Math.PI / 180;

    var thetaStart = Math.PI - videoArc / 2;

    // ── 随机场景视频 ──
    var video = document.createElement('video');
    video.src = pickedScene.path;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    video.play();
    entranceVideo = video;

    videoTex = new THREE.VideoTexture(video);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;

    // ── 圆柱视频面板 ──
    var videoGeo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, thetaStart, videoArc);
    var uv = videoGeo.attributes.uv;
    for (var i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i));
    }
    videoMat = new THREE.MeshBasicMaterial({ map: videoTex, side: THREE.BackSide });
    scene.add(new THREE.Mesh(videoGeo, videoMat));

    // ── 左侧黑面板 ──
    var blackStart = thetaStart - blackArc;
    var blackMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide });
    var blackGeo = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true, blackStart, blackArc);
    scene.add(new THREE.Mesh(blackGeo, blackMat));
  }

  // ═══════════ 圆柱选择器 ═══════════
  function buildSelectorWorld() {
    if (selectorBuilt) return;
    selectorBuilt = true;

    selectorScene = new THREE.Scene();
    selectorScene.background = new THREE.Color(0x040408);

    selectorCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 50);
    selectorCamera.position.set(0, 0.15, 0);

    // 黑暗圆室
    var roomR = 7.5;
    var roomH = 6.5;
    var roomGeo = new THREE.CylinderGeometry(roomR, roomR, roomH, 64, 1, true);
    var roomMat = new THREE.MeshBasicMaterial({ color: 0x05050a, side: THREE.BackSide });
    selectorScene.add(new THREE.Mesh(roomGeo, roomMat));

    // 四块视频面板
    var panelR = roomR - 0.5;
    var panelH = 4.2;
    var panelArc = 55 * Math.PI / 180;
    var frontCenter = Math.PI;

    for (var i = 0; i < 4; i++) {
      var centerAngle = frontCenter + i * Math.PI * 0.5;
      var startAngle = centerAngle - panelArc / 2;

      var video = document.createElement('video');
      video.src = SCENES[i].path;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      video.play();
      selectorVideos.push(video);

      var tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      var panelGeo = new THREE.CylinderGeometry(panelR, panelR, panelH, 36, 1, true, startAngle, panelArc);
      var uv = panelGeo.attributes.uv;
      for (var j = 0; j < uv.count; j++) {
        uv.setX(j, 1 - uv.getX(j));
      }
      var panelMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
      var panelMesh = new THREE.Mesh(panelGeo, panelMat);
      selectorScene.add(panelMesh);

      // 微光边框
      var frameGeo = new THREE.CylinderGeometry(panelR + 0.03, panelR + 0.03, panelH + 0.12, 36, 1, true, startAngle - 0.03, panelArc + 0.06);
      var frameMat = new THREE.MeshBasicMaterial({ color: 0x1a1a24, side: THREE.BackSide, transparent: true, opacity: 0.45 });
      var frameMesh = new THREE.Mesh(frameGeo, frameMat);
      selectorScene.add(frameMesh);

      selectorPanels.push({ mesh: panelMesh, frame: frameMesh, sceneIndex: i });
    }
  }

  function enterSelector() {
    if (currentMode === 'selector') return;
    currentMode = 'selector';
    selectorRotation = 0;
    selectorTargetRotation = 0;
    selectorCamera.rotation.y = 0;
    hoveredIdx = -1;

    var hint = document.getElementById('hint-text');
    if (hint) {
      hint.textContent = '移动鼠标查看四个场景 · 点击选择 · Esc 返回';
      hint.style.opacity = '0.5';
    }
  }

  function exitSelector() {
    if (currentMode !== 'selector') return;
    currentMode = 'main';
    currentRotation = 0;
    targetRotation = 0;
    camera.rotation.y = 0;
    exitSelectorCleanup();
  }

  function exitSelectorCleanup() {
    clearHover();
    var hint = document.getElementById('hint-text');
    if (hint) {
      hint.textContent = '移动鼠标看风景 | 下拖对话 · 上拖返回';
      hint.style.opacity = '0.2';
    }
    var label = document.getElementById('selector-label');
    if (label) label.style.opacity = '0';
  }

  // ── 悬停 ──
  function updateHover(idx) {
    if (hoveredIdx === idx) return;

    // 还原上一个
    if (hoveredIdx >= 0 && hoveredIdx < selectorPanels.length) {
      var prev = selectorPanels[hoveredIdx];
      prev.frame.material.opacity = 0.45;
      prev.frame.material.color.setHex(0x1a1a24);
    }

    hoveredIdx = idx;

    if (idx >= 0 && idx < selectorPanels.length) {
      var cur = selectorPanels[idx];
      cur.frame.material.opacity = 0.72;
      cur.frame.material.color.setHex(0x2e2e40);

      var label = document.getElementById('selector-label');
      if (!label) {
        label = document.createElement('div');
        label.id = 'selector-label';
        document.body.appendChild(label);
      }
      label.textContent = SCENES[idx].name;
      label.style.opacity = '0.42';
    } else {
      var label = document.getElementById('selector-label');
      if (label) label.style.opacity = '0';
    }
  }

  function clearHover() {
    if (hoveredIdx >= 0 && hoveredIdx < selectorPanels.length) {
      var prev = selectorPanels[hoveredIdx];
      prev.frame.material.opacity = 0.45;
      prev.frame.material.color.setHex(0x1a1a24);
    }
    hoveredIdx = -1;
    var label = document.getElementById('selector-label');
    if (label) label.style.opacity = '0';
  }

  // ── 点击选择（眼过渡动画）──
  function selectScene(idx) {
    if (transitionActive || idx < 0 || idx >= SCENES.length) return;
    transitionActive = true;
    clearHover();

    EyeTransition.playSceneSwitch({
      canvas: renderer.domElement,
      onClosed: function () {
        // 黑屏时换视频 + 切回主模式
        var newVideo = replaceMainVideo(idx);
        currentMode = 'main';
        currentRotation = 0;
        targetRotation = 0;
        camera.rotation.y = 0;
        return newVideo;
      },
      onDone: function () {
        transitionActive = false;
        exitSelectorCleanup();
      }
    });
  }

  function replaceMainVideo(idx) {
    pickedScene = SCENES[idx];

    // 清理旧视频
    if (entranceVideo) {
      entranceVideo.pause();
      entranceVideo.removeAttribute('src');
      entranceVideo.load();
      if (entranceVideo.parentNode) entranceVideo.parentNode.removeChild(entranceVideo);
    }

    // 清理旧纹理
    if (videoTex) {
      videoTex.dispose();
      videoTex = null;
    }

    // 创建新视频
    var newVideo = document.createElement('video');
    newVideo.src = pickedScene.path;
    newVideo.autoplay = true;
    newVideo.loop = true;
    newVideo.muted = true;
    newVideo.playsInline = true;
    newVideo.style.display = 'none';
    document.body.appendChild(newVideo);
    newVideo.play();
    entranceVideo = newVideo;

    // 创建新纹理并更新材质
    videoTex = new THREE.VideoTexture(newVideo);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;

    if (videoMat) {
      videoMat.map = videoTex;
      videoMat.needsUpdate = true;
    }

    return newVideo;
  }

  function triggerExitTransition() {
    if (transitionActive) return;
    if (currentMode !== 'selector') return;

    var overlay = document.getElementById('scene-transition');
    if (!overlay) { exitSelector(); return; }

    transitionActive = true;
    overlay.classList.add('active');

    overlay.addEventListener('animationend', function handler() {
      overlay.removeEventListener('animationend', handler);
      overlay.classList.remove('active');
      transitionActive = false;
      exitSelector();
    });

    setTimeout(function () {
      if (!transitionActive) return;
      overlay.classList.remove('active');
      transitionActive = false;
      exitSelector();
    }, 3200);
  }

  // ═══════════ 渲染循环 ═══════════
  function loop() {
    requestAnimationFrame(loop);

    if (entranceWaiting) {
      renderer.render(scene, camera);
      return;
    }

    if (entrancePlaying) {
      updateEntrance();
      renderer.render(scene, camera);
      return;
    }

    if (currentMode === 'selector') {
      if (!dragActive) {
        selectorTargetRotation = (mouseX - 0.5) * 2 * Math.PI;
      }
      selectorRotation += (selectorTargetRotation - selectorRotation) * 0.08;
      if (Math.abs(selectorRotation - selectorTargetRotation) < 0.0005) {
        selectorRotation = selectorTargetRotation;
      }
      selectorCamera.rotation.y = selectorRotation;
      renderer.render(selectorScene, selectorCamera);
      return;
    }

    // 主场景
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

    camera.rotation.y = currentRotation;
    renderer.render(scene, camera);
  }

  // ═══════════ 事件 ═══════════
  function onDoubleClick(e) {
    if (entrancePlaying || entranceWaiting) return;
    if (ChatSystem.isActive()) return;
    if (transitionActive) return;
    if (currentMode === 'selector') return;

    var overlay = document.getElementById('scene-transition');
    if (!overlay) return;

    transitionActive = true;
    var prevVolume = AudioEngine.getVolume();
    AudioEngine.setVolume(Math.max(0.02, prevVolume * 0.15));

    overlay.classList.add('active');

    overlay.addEventListener('animationend', function handler() {
      overlay.removeEventListener('animationend', handler);
      overlay.classList.remove('active');
      AudioEngine.setVolume(prevVolume);
      transitionActive = false;
      if (currentMode === 'main') enterSelector();
    });

    setTimeout(function () {
      if (!transitionActive) return;
      overlay.classList.remove('active');
      AudioEngine.setVolume(prevVolume);
      transitionActive = false;
      if (currentMode === 'main') enterSelector();
    }, 3200);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && currentMode === 'selector') {
      if (transitionActive) return;
      triggerExitTransition();
    }
  }

  function onMouseMove(e) {
    if (entrancePlaying) return;

    if (currentMode === 'selector') {
      mouseX = Math.max(0, Math.min(1, e.clientX / window.innerWidth));

      // 射线悬停检测
      mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouseNDC, selectorCamera);
      var hits = raycaster.intersectObjects(selectorPanels.map(function (p) { return p.mesh; }));
      if (hits.length > 0) {
        for (var i = 0; i < selectorPanels.length; i++) {
          if (selectorPanels[i].mesh === hits[0].object) {
            updateHover(i);
            break;
          }
        }
      } else {
        updateHover(-1);
      }

      if (dragActive && dragStartY - e.clientY > dragThreshold) {
        dragActive = false;
        triggerExitTransition();
      }
      return;
    }

    mouseX = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
    if (dragActive && e.clientY - dragStartY > dragThreshold) {
      dragActive = false;
      ChatSystem.enter();
    }
  }

  function onMouseDown(e) {
    if (entrancePlaying) return;
    if (currentMode === 'selector') {
      dragActive = true;
      dragStartY = e.clientY;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      return;
    }
    if (ChatSystem.isActive()) return;
    dragActive = true;
    dragStartY = e.clientY;
  }

  function onMouseUp(e) {
    if (currentMode === 'selector' && dragActive) {
      var dx = e.clientX - clickStartX;
      var dy = e.clientY - clickStartY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && hoveredIdx >= 0) {
        dragActive = false;
        selectScene(hoveredIdx);
        return;
      }
    }
    dragActive = false;
  }

  function onResize() {
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (selectorCamera) {
      selectorCamera.aspect = window.innerWidth / window.innerHeight;
      selectorCamera.updateProjectionMatrix();
    }
    if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updateEntrance() {
    var elapsed = (performance.now() - entranceStartTime) / 1000;
    var t = Math.min(1, elapsed / entranceDuration);

    var ease = 1 - Math.pow(1 - t, 2.5);
    var descendY = entranceStartY * (1 - ease);

    var hoverFade = t < 0.15 ? (1 - t / 0.15) : 0;
    var hoverBuzz = Math.sin(elapsed * 12) * 0.025 * hoverFade;

    var bounceT = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    var bounceDecay = Math.exp(-bounceT * 7);
    var bounceWave = bounceDecay * Math.sin(bounceT * 12) * 0.12;

    camera.position.y = descendY + hoverBuzz + bounceWave;

    var sway = 1 - t;
    camera.position.x = 0.6 * sway + Math.sin(elapsed * 1.3) * 0.18 * sway;
    camera.position.z = -0.35 * sway + Math.cos(elapsed * 1.6) * 0.12 * sway;

    camera.rotation.x = 0.28 * sway;
    camera.rotation.y = 0.2 * sway + Math.sin(elapsed * 0.8) * 0.15 * sway;

    camera.rotation.y += Math.sin(elapsed * 9) * 0.04 * hoverFade;

    if (t >= 1) {
      entrancePlaying = false;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      currentRotation = 0;
      targetRotation = 0;
    }
  }

  return { start: start };
})();
