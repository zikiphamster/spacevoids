// ============================================================
//  GAME  — Three.js renderer/scene/camera, core loop, save/load
// ============================================================

const Game = (() => {
  // ---- config ----
  const MAP_COLS = 50;
  const MAP_ROWS = 50;
  // SCALE: how many screen pixels represent one world pixel.
  // Tiles are 16 world units wide → appear as 16 * SCALE = 64 px on screen at SCALE=4.
  const SCALE    = 4;
  const CAM_EASE = 6;

  // ---- Three.js singletons (created once, reused across games) ----
  let renderer = null;
  let camera   = null;

  // ---- per-game state ----
  let scene    = null;
  let camX = 0, camY = 0;
  let targetCamX = 0, targetCamY = 0;
  let gameTime = 0, lastTime = 0;
  let running  = false, rafId = null;

  // ---- init ----
  function start(fromSave) {
    const canvas = document.getElementById('game-canvas');

    // Create renderer once; reuse for subsequent games
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      renderer.setPixelRatio(1);  // keep at 1 for crisp pixel art
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0d0d1a, 1);

    // Create camera once; frustum is updated every frame
    if (!camera) {
      camera = new THREE.OrthographicCamera(0, 0, 0, 0, -100, 100);
      camera.position.z = 10;
    }

    // Fresh scene for each game
    if (scene) scene = null;
    scene = new THREE.Scene();

    window.addEventListener('resize', resize);

    // Generate world and place player
    World.generate(MAP_COLS, MAP_ROWS);

    const startCol = fromSave ? Math.floor(fromSave.playerX / World.TILE_W) : Math.floor(MAP_COLS / 2);
    const startRow = fromSave ? Math.floor(fromSave.playerY / World.TILE_H) : Math.floor(MAP_ROWS / 2);

    Player.init(scene, startCol, startRow);
    World.buildScene(scene);

    snapCamera();

    gameTime = 0;
    running  = true;
    lastTime = performance.now();
    rafId    = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);

    // Dispose GPU resources for tiles and player
    World.disposeAll();
    scene = null;
  }

  // ---- camera ----
  function snapCamera() {
    const worldW = MAP_COLS * World.TILE_W;
    const worldH = MAP_ROWS * World.TILE_H;
    const halfW  = window.innerWidth  / (2 * SCALE);
    const halfH  = window.innerHeight / (2 * SCALE);

    camX = targetCamX = Utils.clamp(Player.worldX, halfW, worldW - halfW);
    camY = targetCamY = Utils.clamp(Player.worldY, halfH, worldH - halfH);
    _applyFrustum();
  }

  function updateCamera(dt) {
    const worldW = MAP_COLS * World.TILE_W;
    const worldH = MAP_ROWS * World.TILE_H;
    const halfW  = window.innerWidth  / (2 * SCALE);
    const halfH  = window.innerHeight / (2 * SCALE);

    targetCamX = Utils.clamp(Player.worldX, halfW, worldW - halfW);
    targetCamY = Utils.clamp(Player.worldY, halfH, worldH - halfH);

    camX += (targetCamX - camX) * Math.min(1, CAM_EASE * dt);
    camY += (targetCamY - camY) * Math.min(1, CAM_EASE * dt);

    _applyFrustum();
  }

  // Update the orthographic frustum so the camera is centred on (camX, camY).
  // Three.js Y is up; game Y is down — negate Y when converting.
  // Snap to screen-pixel increments (1/SCALE world units) to eliminate sub-pixel jitter.
  function _applyFrustum() {
    const halfW = window.innerWidth  / (2 * SCALE);
    const halfH = window.innerHeight / (2 * SCALE);

    const sx = Math.round(camX * SCALE) / SCALE;
    const sy = Math.round(camY * SCALE) / SCALE;

    camera.left   =  sx - halfW;
    camera.right  =  sx + halfW;
    camera.top    = -sy + halfH;   // flip Y
    camera.bottom = -sy - halfH;   // flip Y
    camera.updateProjectionMatrix();
  }

  // ---- resize ----
  function resize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    _applyFrustum();
  }

  // ---- main loop ----
  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime  = ts;
    gameTime += dt;

    Player.update(dt);
    updateCamera(dt);
    World.updateWater(gameTime);
    Player.updateMesh();

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  // ---- save / load ----
  const SAVE_KEY = 'spacevoids_saves';

  function save(slotIndex) {
    const saves = getSaves();
    saves[slotIndex] = {
      playerX:   Player.worldX,
      playerY:   Player.worldY,
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  function getSaves() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || [null, null, null]; }
    catch { return [null, null, null]; }
  }

  return { start, stop, save, getSaves };
})();
