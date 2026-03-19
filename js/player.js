// ============================================================
//  PLAYER  — movement, sprite, input
// ============================================================

const Player = (() => {
  const SPEED   = 80;   // pixels/sec in world space
  const SIZE_W  = 10;   // sprite width  (world pixels)
  const SIZE_H  = 14;   // sprite height (world pixels)

  let x, y;             // world position (tile-space, decimal)
  let vx = 0, vy = 0;
  let facing = 'down';  // 'up' | 'down' | 'left' | 'right'
  let frame  = 0;       // walk frame 0..3
  let frameTimer = 0;
  const FRAME_RATE = 0.14; // seconds per frame

  const keys = {};

  function init(startCol, startRow) {
    x = startCol * World.TILE_W + World.TILE_W / 2;
    y = startRow * World.TILE_H + World.TILE_H / 2;
    vx = vy = 0;
    frame = 0;
    frameTimer = 0;
    window.addEventListener('keydown', e => { keys[e.key] = true;  });
    window.addEventListener('keyup',   e => { keys[e.key] = false; });
  }

  function update(dt) {
    vx = 0;
    vy = 0;

    if (keys['ArrowLeft']  || keys['a'] || keys['A']) { vx = -SPEED; facing = 'left';  }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) { vx =  SPEED; facing = 'right'; }
    if (keys['ArrowUp']    || keys['w'] || keys['W']) { vy = -SPEED; facing = 'up';    }
    if (keys['ArrowDown']  || keys['s'] || keys['S']) { vy =  SPEED; facing = 'down';  }

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    const nx = x + vx * dt;
    const ny = y + vy * dt;

    // Collision: don't walk into water or trees
    const col = Math.floor(nx / World.TILE_W);
    const row = Math.floor(ny / World.TILE_H);
    const tile = World.tileAt(col, row);
    const blocked = tile === World.T.WATER || tile === undefined;

    if (!blocked) {
      x = nx;
      y = ny;
    }

    // Walk animation
    if (vx !== 0 || vy !== 0) {
      frameTimer += dt;
      if (frameTimer >= FRAME_RATE) {
        frameTimer -= FRAME_RATE;
        frame = (frame + 1) % 4;
      }
    } else {
      frame = 0;
      frameTimer = 0;
    }
  }

  // Draw a simple pixel character
  function draw(ctx, camX, camY, scale) {
    const sx = Math.round(x * scale - camX - (SIZE_W * scale) / 2);
    const sy = Math.round(y * scale - camY - (SIZE_H * scale) / 2);

    const w = SIZE_W * scale;
    const h = SIZE_H * scale;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(sx + w * 0.1, sy + h * 0.9, w * 0.8, h * 0.12);

    // Body (tunic)
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(sx + w * 0.2, sy + h * 0.4, w * 0.6, h * 0.42);

    // Legs — alternate per frame
    const legOff = (frame === 1 || frame === 3) ? 1 : 0;
    ctx.fillStyle = '#2a2a3d';
    ctx.fillRect(sx + w * 0.2, sy + h * 0.78, w * 0.28, h * 0.22 - legOff * scale);
    ctx.fillRect(sx + w * 0.52, sy + h * 0.78, w * 0.28, h * 0.22 + legOff * scale);

    // Head
    ctx.fillStyle = '#f0c890';
    ctx.fillRect(sx + w * 0.2, sy, w * 0.6, h * 0.42);

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    if (facing === 'down' || facing === 'right' || facing === 'left') {
      ctx.fillRect(sx + w * 0.28, sy + h * 0.18, w * 0.12, h * 0.12);
      ctx.fillRect(sx + w * 0.56, sy + h * 0.18, w * 0.12, h * 0.12);
    }

    // Hair
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(sx + w * 0.18, sy, w * 0.64, h * 0.12);

    // Arms
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(sx,           sy + h * 0.42, w * 0.2, h * 0.3);
    ctx.fillRect(sx + w * 0.8, sy + h * 0.42, w * 0.2, h * 0.3);
  }

  return {
    init,
    update,
    draw,
    get worldX() { return x; },
    get worldY() { return y; },
  };
})();
