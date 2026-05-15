/* 精神避难所 v5 — 入口编排 */
(function () {

  // Initialize chat system (needs DOM ready)
  ChatSystem.init();

  // Start entrance animation
  EntranceAnimation.start(function () {
    // Entrance complete → start main scene
    MainScene.start();
    // Start ambient audio (after user interaction)
    AudioEngine.playOcean();
  });

})();
