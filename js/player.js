// ============================================================
//  PLAYER  — movement, Three.js canvas-texture sprite
// ============================================================

const Player = (() => {
  const SPEED      = 50;
  const SPR_LOGICAL_W = 16;
  const SPR_LOGICAL_H = 40;
  const SPR_SCALE  = 4;
  const SPR_W      = SPR_LOGICAL_W * SPR_SCALE;
  const SPR_H      = SPR_LOGICAL_H * SPR_SCALE;
  const SIZE_W     = 10;
  const SIZE_H     = 25;

  let x, y;
  let vx = 0, vy = 0;
  let facing = 'down';
  let frame  = 0, frameTimer = 0;
  const FRAME_RATE = 0.13;

  const keys = {};
  let sprCanvas, sprCtx, sprTex, mesh;

  // ---- Embedded sprite RGBA data (16x40 each, base64-encoded) ----
  // Front (down) — from Sprite02.png
  const B64_DOWN = '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';

  // Right side — from Rightsidesprite.png
  const B64_RIGHT = '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';

  // Back — from Backsidesprite.png
  const B64_BACK = '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';

  let sprDataDown = null, sprDataRight = null, sprDataBack = null;

  function _decode(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function _decodeAll() {
    sprDataDown  = _decode(B64_DOWN);
    sprDataRight = _decode(B64_RIGHT);
    sprDataBack  = _decode(B64_BACK);
  }

  function init(scene, startCol, startRow) {
    x = startCol * World.TILE_W + World.TILE_W / 2;
    y = startRow * World.TILE_H + World.TILE_H / 2;
    vx = vy = 0; frame = 0; frameTimer = 0;

    if (!sprDataDown) _decodeAll();

    window.addEventListener('keydown', e => { keys[e.key] = true;  });
    window.addEventListener('keyup',   e => { keys[e.key] = false; });

    if (mesh) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh = null;
    }

    sprCanvas = document.createElement('canvas');
    sprCanvas.width = SPR_W; sprCanvas.height = SPR_H;
    sprCtx = sprCanvas.getContext('2d');

    sprTex = new THREE.CanvasTexture(sprCanvas);
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

    const HBW = SIZE_W * 0.25, HBH = SIZE_H * 0.05, HB_OFF = SIZE_H * 0.44;
    function blocked(bx, by) {
      const fy = by + HB_OFF;
      const pts = [[bx-HBW,fy-HBH],[bx+HBW,fy-HBH],[bx-HBW,fy+HBH],[bx+HBW,fy+HBH]];
      for (const [cx,cy] of pts) {
        const t = World.tileAt(Math.floor(cx/World.TILE_W), Math.floor(cy/World.TILE_H));
        if (t === World.T.WATER || t === undefined) return true;
      }
      return World.isTreeBlocked(bx, fy, HBW, HBH);
    }
    const nx = x + vx * dt, ny = y + vy * dt;
    if (!blocked(nx, y)) x = nx;
    if (!blocked(x, ny)) y = ny;

    if (vx !== 0 || vy !== 0) {
      frameTimer += dt;
      if (frameTimer >= FRAME_RATE) { frameTimer -= FRAME_RATE; frame = (frame + 1) % 4; }
    } else { frame = 0; frameTimer = 0; }
  }

  function updateMesh() {
    if (!mesh) return;
    _drawSprite();
    sprTex.needsUpdate = true;
    mesh.position.set(Math.round(x * 4) / 4, -Math.round(y * 4) / 4, 0.002);
  }

  // ============================================================
  //  SPRITE RENDERING
  // ============================================================
  function _drawSprite() {
    sprCtx.clearRect(0, 0, SPR_W, SPR_H);
    if (!sprDataDown) return;
    const step = (frame === 1) ? -1 : (frame === 3) ? 1 : 0;

    if (facing === 'down')       _blit(sprDataDown, step, false, false);
    else if (facing === 'up')    _blit(sprDataBack, step, false, false);
    else if (facing === 'right') _blit(sprDataRight, step, false, true);
    else                         _blit(sprDataRight, step, true, true);  // left = mirror of right
  }

  // Blit sprite data to canvas with leg-stride animation
  // mirror=true flips horizontally (for left = mirrored right)
  // isSide=true uses horizontal stride; false uses vertical stride
  function _blit(data, step, mirror, isSide) {
    const W = SPR_LOGICAL_W, H = SPR_LOGICAL_H;
    const LEG_TOP = 26, LEG_BOT = 39;
    const MID = W >> 1;

    // Iterate over destination pixels so every position gets filled (no gaps)
    for (let dy = 0; dy < H; dy++) {
      for (let dxRaw = 0; dxRaw < W; dxRaw++) {
        // Map destination x back to logical source x
        const lx = mirror ? (W - 1 - dxRaw) : dxRaw;
        let srcX = lx, srcY = dy;

        if (step !== 0 && dy >= LEG_TOP && dy <= LEG_BOT) {
          const isLeft = lx < MID;
          const fwd = (step === -1) ? isLeft : !isLeft;

          if (isSide) {
            // Side walk: pull source from shifted x position
            let shift = fwd ? 1 : -1;
            if (dy - LEG_TOP >= 6) shift *= 2;
            srcX = mirror ? lx + shift : lx - shift;
            if (srcX < 0 || srcX >= W) continue;
          } else {
            // Front/back walk: pull source from shifted y position
            let shift = fwd ? 1 : -1;
            if (dy - LEG_TOP >= 6) shift *= 2;
            srcY = Math.max(LEG_TOP, Math.min(LEG_BOT, dy - shift));
          }
        }

        const i = (srcY * W + srcX) * 4;
        const a = data[i + 3];
        if (a < 10) continue;

        sprCtx.fillStyle = 'rgba(' + data[i] + ',' + data[i+1] + ',' + data[i+2] + ',' + (a / 255) + ')';
        sprCtx.fillRect(dxRaw * SPR_SCALE, dy * SPR_SCALE, SPR_SCALE, SPR_SCALE);
      }
    }
  }

  return {
    init, update, updateMesh,
    get worldX() { return x; },
    get worldY() { return y; },
  };
})();
