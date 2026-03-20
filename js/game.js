// ============================================================
//  GAME  — core loop, camera, save/load
// ============================================================

const Game = (() => {
  // ---- config ----
  const MAP_COLS  = 50;
  const MAP_ROWS  = 50;
  const SCALE     = 4;   // pixel scale multiplier (16px tiles × 4 = 64px on screen)
  const CAM_EASE  = 6;   // camera smoothing factor

  // ---- state ----
  let canvas, ctx;
  let camX = 0, camY = 0;
  let targetCamX = 0, targetCamY = 0;
  let lastTime = 0;
  let gameTime = 0;
  let rafId    = null;
  let running  = false;

  // ---- init ----
  function start(fromSave) {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    resize();
    window.addEventListener('resize', resize);

    if (fromSave) {
      load(fromSave);
    } else {
      World.generate(MAP_COLS, MAP_ROWS);
      // Place player on a walkable tile near center
      const startCol = Math.floor(MAP_COLS / 2);
      const startRow = Math.floor(MAP_ROWS / 2);
      Player.init(startCol, startRow);
      snapCamera();
    }

    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
  }

  // ---- camera ----
  function snapCamera() {
    const pw = canvas.width;
    const ph = canvas.height;
    camX = targetCamX = Player.worldX * SCALE - pw / 2;
    camY = targetCamY = Player.worldY * SCALE - ph / 2;
  }

  function updateCamera(dt) {
    const pw = canvas.width;
    const ph = canvas.height;

    targetCamX = Player.worldX * SCALE - pw / 2;
    targetCamY = Player.worldY * SCALE - ph / 2;

    // Clamp to world bounds
    const maxCamX = MAP_COLS * World.TILE_W * SCALE - pw;
    const maxCamY = MAP_ROWS * World.TILE_H * SCALE - ph;
    targetCamX = Utils.clamp(targetCamX, 0, Math.max(0, maxCamX));
    targetCamY = Utils.clamp(targetCamY, 0, Math.max(0, maxCamY));

    // Smooth follow
    camX += (targetCamX - camX) * Math.min(1, CAM_EASE * dt);
    camY += (targetCamY - camY) * Math.min(1, CAM_EASE * dt);
  }

  // ---- main loop ----
  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    gameTime += dt;

    Player.update(dt);
    updateCamera(dt);
    render(dt);

    rafId = requestAnimationFrame(loop);
  }

  // ---- render ----
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tilemap
    World.render(ctx, camX, camY, SCALE, gameTime);

    // Player
    Player.draw(ctx, camX, camY, SCALE);
  }

  // ---- resize ----
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }

  // ---- save / load ----
  const SAVE_KEY = 'spacevoids_saves';

  function save(slotIndex) {
    const saves = getSaves();
    saves[slotIndex] = {
      playerX: Player.worldX,
      playerY: Player.worldY,
      seed: 42, // static seed for now
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  function load(slotData) {
    World.generate(MAP_COLS, MAP_ROWS);
    const col = Math.floor(slotData.playerX / World.TILE_W);
    const row = Math.floor(slotData.playerY / World.TILE_H);
    Player.init(col, row);
    snapCamera();
  }

  function getSaves() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || [null, null, null];
    } catch { return [null, null, null]; }
  }

  return { start, stop, save, getSaves };
})();
