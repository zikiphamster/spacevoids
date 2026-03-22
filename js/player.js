// ============================================================
//  PLAYER  — movement, Three.js canvas-texture sprite
// ============================================================

const Player = (() => {
  const SPEED      = 50;    // world pixels / sec
  const SIZE_W     = 10;    // sprite logical width  (world units)
  const SIZE_H     = 14;    // sprite logical height (world units)
  const SPR_SCALE  = 2;     // canvas draw scale → 20×28 px canvas
  const SPR_W      = SIZE_W * SPR_SCALE;
  const SPR_H      = SIZE_H * SPR_SCALE;

  let x, y;
  let vx = 0, vy = 0;
  let facing = 'down';
  let frame  = 0, frameTimer = 0;
  const FRAME_RATE = 0.14;

  const keys = {};

  // Three.js objects
  let sprCanvas, sprCtx, sprTex, mesh;

  function init(scene, startCol, startRow) {
    x = startCol * World.TILE_W + World.TILE_W / 2;
    y = startRow * World.TILE_H + World.TILE_H / 2;
    vx = vy = 0;
    frame = 0;
    frameTimer = 0;

    window.addEventListener('keydown', e => { keys[e.key] = true;  });
    window.addEventListener('keyup',   e => { keys[e.key] = false; });

    // Dispose old mesh if reinitialising
    if (mesh) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh = null;
    }

    // Sprite canvas (drawn at SPR_SCALE for crispness, displayed at SIZE_W×SIZE_H world units)
    sprCanvas        = document.createElement('canvas');
    sprCanvas.width  = SPR_W;
    sprCanvas.height = SPR_H;
    sprCtx           = sprCanvas.getContext('2d');

    sprTex           = new THREE.CanvasTexture(sprCanvas);
    sprTex.magFilter = THREE.NearestFilter;
    sprTex.minFilter = THREE.NearestFilter;

    const geo = new THREE.PlaneGeometry(SIZE_W, SIZE_H);
    const mat = new THREE.MeshBasicMaterial({ map: sprTex, transparent: true, alphaTest: 0.05, depthWrite: false });
    mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    scene.add(mesh);

    updateMesh();
  }

  function update(dt) {
    vx = 0; vy = 0;

    if (keys['ArrowLeft']  || keys['a'] || keys['A']) { vx = -SPEED; facing = 'left';  }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) { vx =  SPEED; facing = 'right'; }
    if (keys['ArrowUp']    || keys['w'] || keys['W']) { vy = -SPEED; facing = 'up';    }
    if (keys['ArrowDown']  || keys['s'] || keys['S']) { vy =  SPEED; facing = 'down';  }

    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

    // Hitbox at player's feet only (bottom quarter of sprite)
    const HBW = SIZE_W * 0.4;   // half-width (slightly narrower than sprite)
    const HBH = SIZE_H * 0.2;   // half-height (short — just feet)
    const HB_OFFSET = SIZE_H * 0.3; // offset downward from center to feet

    function blocked(px, py) {
      const feetY = py + HB_OFFSET; // shift hitbox to feet
      const corners = [
        [px - HBW, feetY - HBH],
        [px + HBW, feetY - HBH],
        [px - HBW, feetY + HBH],
        [px + HBW, feetY + HBH],
      ];
      for (const [cx, cy] of corners) {
        const c = Math.floor(cx / World.TILE_W);
        const r = Math.floor(cy / World.TILE_H);
        const t = World.tileAt(c, r);
        if (t === World.T.WATER || t === undefined) return true;
      }
      // Check against tree trunk colliders (bottom half only)
      if (World.isTreeBlocked(px, feetY, HBW, HBH)) return true;
      return false;
    }

    // Try X and Y separately for wall-sliding
    const nx = x + vx * dt;
    const ny = y + vy * dt;
    if (!blocked(nx, y))       x = nx;
    if (!blocked(x,  ny))      y = ny;

    if (vx !== 0 || vy !== 0) {
      frameTimer += dt;
      if (frameTimer >= FRAME_RATE) { frameTimer -= FRAME_RATE; frame = (frame + 1) % 4; }
    } else { frame = 0; frameTimer = 0; }
  }

  // Called every frame from the game loop — redraws sprite + syncs mesh position
  function updateMesh() {
    if (!mesh) return;
    _drawSprite();
    sprTex.needsUpdate = true;
    // Snap to pixel grid (SCALE=4 → 0.25 world units) to prevent sub-pixel jitter
    const sx = Math.round(x * 4) / 4;
    const sy = Math.round(y * 4) / 4;
    mesh.position.set(sx, -sy, 0.002);
  }

  function _drawSprite() {
    const ctx = sprCtx;
    const s   = SPR_SCALE;
    const w   = SIZE_W * s;
    const h   = SIZE_H * s;

    ctx.clearRect(0, 0, SPR_W, SPR_H);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(w * 0.1, h * 0.9, w * 0.8, h * 0.12);

    // Body (tunic)
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(w * 0.2, h * 0.4, w * 0.6, h * 0.42);

    // Legs — alternate per walk frame
    const lo = (frame === 1 || frame === 3) ? s : 0;
    ctx.fillStyle = '#2a2a3d';
    ctx.fillRect(w * 0.2,  h * 0.78, w * 0.28, h * 0.22 - lo);
    ctx.fillRect(w * 0.52, h * 0.78, w * 0.28, h * 0.22 + lo);

    // Head
    ctx.fillStyle = '#f0c890';
    ctx.fillRect(w * 0.2, 0, w * 0.6, h * 0.42);

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    if (facing !== 'up') {
      ctx.fillRect(w * 0.28, h * 0.18, w * 0.12, h * 0.12);
      ctx.fillRect(w * 0.56, h * 0.18, w * 0.12, h * 0.12);
    }

    // Hair
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(w * 0.18, 0, w * 0.64, h * 0.12);

    // Arms
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(0,      h * 0.42, w * 0.2, h * 0.3);
    ctx.fillRect(w * 0.8, h * 0.42, w * 0.2, h * 0.3);
  }

  return {
    init,
    update,
    updateMesh,
    get worldX() { return x; },
    get worldY() { return y; },
  };
})();
