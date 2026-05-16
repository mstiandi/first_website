/* 主场景 — 单视频面板 + 左侧黑面板（聊天入口）+ 双击换场景 + 坠落漂浮入场 */
var MainScene = (function () {
  var scene, camera, renderer;
  var currentRotation = 0, targetRotation = 0;
  var animId = null;
  var mouseX = 0.5;
  var dragStartX = 0, dragStartY = 0, dragActive = false, dragThreshold = 70;
  var isLying = false;

  var maxRotRight = 30 * Math.PI / 180;
  var maxRotLeft  = -30 * Math.PI / 180;

  // 入场动画 — 无人机落位
  var entranceStartTime = 0;
  var entranceDuration = 4.5;
  var entranceStartY = 3.4;
  var entrancePlaying = true;
  var entranceWaiting = true; // 等视频就绪
  var entranceVideo = null;

  // 两个视频纹理，双击切换
  var seaTex, homeTex;
  var videoMat;

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

    // 先静默渲染等视频就绪，shader 编译在此时完成，入场无卡顿
    function beginEntrance() {
      if (!entranceWaiting) return;
      entranceWaiting = false;
      // 睁眼入场取代无人机落位：场景直接在背后稳定渲染
      entrancePlaying = false;
      camera.position.set(0, 0, 0);
    }
    if (entranceVideo && entranceVideo.readyState >= 2) {
      beginEntrance();
    } else if (entranceVideo) {
      entranceVideo.addEventListener('canplay', function onReady() {
        entranceVideo.removeEventListener('canplay', onReady);
        beginEntrance();
      });
      // 兜底：2秒后无论如何启动
      setTimeout(function () { beginEntrance(); }, 2000);
    } else {
      // 无视频也直接启动
      beginEntrance();
    }

    var hint = document.createElement('div');
    hint.id = 'hint-text';
    hint.textContent = '移动鼠标看风景 | 双击换场景 | 下拖对话 · 上拖返回';
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

    // ── 海崖视频 ──
    var video1 = document.createElement('video');
    video1.src = 'videos/海崖_web.mp4';
    video1.autoplay = true;
    video1.loop = true;
    video1.muted = true;
    video1.playsInline = true;
    video1.style.display = 'none';
    document.body.appendChild(video1);
    video1.play();
    entranceVideo = video1;

    seaTex = new THREE.VideoTexture(video1);
    seaTex.colorSpace = THREE.SRGBColorSpace;
    seaTex.minFilter = THREE.LinearFilter;
    seaTex.magFilter = THREE.LinearFilter;

    // ── 家乡视频 ──
    var video2 = document.createElement('video');
    video2.src = 'videos/家乡.mp4';
    video2.autoplay = true;
    video2.loop = true;
    video2.muted = true;
    video2.playsInline = true;
    video2.style.display = 'none';
    document.body.appendChild(video2);
    video2.play();

    homeTex = new THREE.VideoTexture(video2);
    homeTex.colorSpace = THREE.SRGBColorSpace;
    homeTex.minFilter = THREE.LinearFilter;
    homeTex.magFilter = THREE.LinearFilter;

    // ── 圆柱视频面板（默认显示海崖）──
    var videoGeo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, thetaStart, videoArc);
    var uv = videoGeo.attributes.uv;
    for (var i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i));
    }
    videoMat = new THREE.MeshBasicMaterial({ map: seaTex, side: THREE.BackSide });
    scene.add(new THREE.Mesh(videoGeo, videoMat));

    // ── 左侧黑面板 ──
    var blackStart = thetaStart - blackArc;
    var blackMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide });
    var blackGeo = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true, blackStart, blackArc);
    scene.add(new THREE.Mesh(blackGeo, blackMat));
  }

  function loop() {
    animId = requestAnimationFrame(loop);

    if (entranceWaiting) {
      renderer.render(scene, camera);
      return;
    }

    if (entrancePlaying) {
      updateEntrance();
      renderer.render(scene, camera);
      return;
    }

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

  function updateEntrance() {
    var elapsed = (performance.now() - entranceStartTime) / 1000;
    var t = Math.min(1, elapsed / entranceDuration);

    // 主下降曲线 — 一条连续 ease-out
    var ease = 1 - Math.pow(1 - t, 2.5);
    var descendY = entranceStartY * (1 - ease);

    // 高处悬停微颤（前 15% 叠加，渐消）
    var hoverFade = t < 0.15 ? (1 - t / 0.15) : 0;
    var hoverBuzz = Math.sin(elapsed * 12) * 0.025 * hoverFade;

    // 着地震颤（后 18% 叠加，从 0 开始连续）
    var bounceT = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    var bounceDecay = Math.exp(-bounceT * 7);
    var bounceWave = bounceDecay * Math.sin(bounceT * 12) * 0.12;

    camera.position.y = descendY + hoverBuzz + bounceWave;

    // 横向偏移 + 圆形飘摆，连续衰减无跳跃
    var sway = 1 - t;
    camera.position.x = 0.6 * sway + Math.sin(elapsed * 1.3) * 0.18 * sway;
    camera.position.z = -0.35 * sway + Math.cos(elapsed * 1.6) * 0.12 * sway;

    // 旋转连续归正
    camera.rotation.x = 0.28 * sway;
    camera.rotation.y = 0.2 * sway + Math.sin(elapsed * 0.8) * 0.15 * sway;

    // 悬停微颤叠加到旋转
    camera.rotation.y += Math.sin(elapsed * 9) * 0.04 * hoverFade;

    if (t >= 1) {
      entrancePlaying = false;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      currentRotation = 0;
      targetRotation = 0;
    }
  }

  function onDoubleClick(e) {
    if (entrancePlaying) return;
    if (ChatSystem.isActive()) return;
    isLying = !isLying;
    videoMat.map = isLying ? homeTex : seaTex;
    videoMat.needsUpdate = true;
    console.log('双击:', isLying ? '家乡' : '海崖');
  }

  function onMouseMove(e) {
    if (entrancePlaying) return;
    mouseX = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
    if (dragActive && e.clientY - dragStartY > dragThreshold) {
      dragActive = false;
      ChatSystem.enter();
    }
  }
  function onMouseDown(e) {
    if (entrancePlaying) return;
    if (ChatSystem.isActive()) return;
    dragActive = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
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
