// ============================================================
//  WORLD  — single world canvas + Three.js mesh, Stardew-style
// ============================================================

const World = (() => {
  // ---- tile types ----
  const T = { GRASS: 0, DIRT: 1, WATER: 2, TREE: 3, STONE: 4, FLOWER: 5, PATH: 6 };

  const TILE_W = 16;
  const TILE_H = 16;

  const TREE_W = 28;
  const TREE_H = 36;

  // ---- Stardew-inspired palettes: 5 shades dark→bright [R,G,B] ----
  const PAL = {
    [T.GRASS]:  [[40,90,18],[56,116,28],[76,148,44],[96,172,60],[120,200,76]],
    [T.DIRT]:   [[140,100,46],[164,126,64],[190,152,84],[212,174,104],[230,196,124]],
    [T.WATER]:  [[28,72,152],[40,96,178],[52,122,200],[70,150,224],[96,182,248]],
    [T.STONE]:  [[72,72,84],[92,94,110],[116,118,136],[140,142,162],[164,166,188]],
    [T.PATH]:   [[160,128,72],[184,152,92],[206,174,112],[226,196,134],[244,214,154]],
  };
  PAL[T.FLOWER] = PAL[T.GRASS];
  PAL[T.TREE]   = PAL[T.GRASS];

  function palIdx(n, type) {
    switch (type) {
      case T.GRASS: case T.FLOWER: case T.TREE:
        return n < 0.08 ? 0 : n < 0.24 ? 1 : n < 0.62 ? 2 : n < 0.84 ? 3 : 4;
      case T.DIRT:
        return n < 0.07 ? 0 : n < 0.22 ? 1 : n < 0.66 ? 2 : n < 0.86 ? 3 : 4;
      case T.WATER:
        return n < 0.14 ? 0 : n < 0.34 ? 1 : n < 0.64 ? 2 : n < 0.84 ? 3 : 4;
      case T.STONE:
        return n < 0.09 ? 0 : n < 0.28 ? 1 : n < 0.62 ? 2 : n < 0.82 ? 3 : 4;
      case T.PATH:
        return n < 0.06 ? 0 : n < 0.20 ? 1 : n < 0.58 ? 2 : n < 0.80 ? 3 : 4;
      default: return 2;
    }
  }

  function pxHash(a, b, c, d) {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + (d || 0) * 531.3) * 43758.5453;
    return x - Math.floor(x);
  }

  function clampByte(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a  = hash(ix,     iy    ), b  = hash(ix + 1, iy    );
    const c2 = hash(ix,     iy + 1), d  = hash(ix + 1, iy + 1);
    const u  = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d, u), v);
  }

  function smoothNoise(x, y, scale) {
    const sx = x * scale, sy = y * scale;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const fx = sx - ix, fy = sy - iy;
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c2 = hash(ix, iy + 1), d2 = hash(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d2, u), v);
  }

  // ---- world generation ----
  let mapCols, mapRows, tileMap;

  function generate(cols, rows) {
    mapCols = cols; mapRows = rows; tileMap = [];
    for (let r = 0; r < rows; r++) {
      tileMap[r] = [];
      for (let c = 0; c < cols; c++) {
        let t = T.GRASS;
        if (r < 2 || r >= rows - 2 || c < 2 || c >= cols - 2) {
          t = T.WATER;
        } else {
          const n = noise(c * 0.16, r * 0.16);
          if      (n < 0.20) t = T.WATER;
          else if (n < 0.30) t = T.DIRT;
          else if (n < 0.46) t = T.STONE;
          else if (n < 0.64) t = T.GRASS;
          else if (n < 0.72) t = T.FLOWER;
          else if (n < 0.80) t = T.PATH;
          else               t = T.TREE;
        }
        tileMap[r][c] = t;
      }
    }
  }

  // ---- Three.js state ----
  const createdObjects = [];

  // World canvas state (persistent across frames for animation)
  let worldCanvas = null, worldCtx = null, worldTex = null;
  let staticCanvas = null; // ground-only, never redrawn
  let waterTileList = [];

  function disposeAll() {
    createdObjects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    createdObjects.length = 0;
    worldCanvas = worldCtx = worldTex = staticCanvas = null;
    waterTileList = [];
  }

  // ---- scene building ----
  function buildScene(scene) {
    disposeAll();

    const worldW = mapCols * TILE_W;
    const worldH = mapRows * TILE_H;

    waterTileList = [];
    const treePos = [];

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        if (tileMap[r][c] === T.WATER) waterTileList.push({ c, r });
        if (tileMap[r][c] === T.TREE)  treePos.push({ c, r });
      }
    }

    // Build static ground canvas (painted once, no water)
    staticCanvas        = document.createElement('canvas');
    staticCanvas.width  = worldW;
    staticCanvas.height = worldH;
    const sCtx = staticCanvas.getContext('2d');
    _paintBaseLayer(sCtx);
    _paintTransitions(sCtx);
    _paintFlowers(sCtx);

    // Build display canvas (static + animated water each frame)
    worldCanvas        = document.createElement('canvas');
    worldCanvas.width  = worldW;
    worldCanvas.height = worldH;
    worldCtx = worldCanvas.getContext('2d');

    // Initial draw
    worldCtx.drawImage(staticCanvas, 0, 0);
    _paintAllWater(worldCtx, 0);

    worldTex           = new THREE.CanvasTexture(worldCanvas);
    worldTex.magFilter = THREE.NearestFilter;
    worldTex.minFilter = THREE.NearestFilter;

    const worldMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: worldTex })
    );
    worldMesh.position.set(worldW / 2, -worldH / 2, 0);
    worldMesh.renderOrder = 0;
    scene.add(worldMesh);
    createdObjects.push(worldMesh);

    _buildTreeMesh(scene, treePos);
  }

  // ---- Pass 1: Base pixel layer (ground tiles) ----
  function _paintBaseLayer(ctx) {
    const worldW = mapCols * TILE_W;
    const imgData = ctx.createImageData(worldW, mapRows * TILE_H);
    const d = imgData.data;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER) continue; // skip — painted each frame

        const drawType = type === T.TREE ? T.GRASS : type;
        const pal = PAL[drawType] || PAL[T.GRASS];

        for (let py = 0; py < TILE_H; py++) {
          for (let px = 0; px < TILE_W; px++) {
            const wx = c * TILE_W + px;
            const wy = r * TILE_H + py;
            const i  = (wy * worldW + wx) * 4;

            const ns = smoothNoise(c + px / TILE_W, r + py / TILE_H, 0.35);
            const nf = pxHash(px, py, c * 17 + r * 31, drawType);
            const n  = ns * 0.6 + nf * 0.4;

            const ci = palIdx(n, drawType);
            let [rv, gv, bv] = pal[ci];
            const jitter = Math.round((pxHash(px + 7, py + 3, c, r) - 0.5) * 8);
            d[i]   = clampByte(rv + jitter);
            d[i+1] = clampByte(gv + jitter);
            d[i+2] = clampByte(bv + jitter);
            d[i+3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // ---- Pass 2: Terrain transitions ----
  function _paintTransitions(ctx) {
    const grassPal = PAL[T.GRASS];
    const midGrass  = `rgb(${grassPal[2][0]},${grassPal[2][1]},${grassPal[2][2]})`;
    const darkGrass = `rgb(${grassPal[1][0]},${grassPal[1][1]},${grassPal[1][2]})`;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER || type === T.GRASS || type === T.FLOWER || type === T.TREE) continue;

        const above = r > 0 ? tileMap[r - 1][c] : null;
        const left  = c > 0 ? tileMap[r][c - 1] : null;
        const below = r < mapRows - 1 ? tileMap[r + 1][c] : null;
        const right = c < mapCols - 1 ? tileMap[r][c + 1] : null;

        const isGrassy = t => t === T.GRASS || t === T.FLOWER || t === T.TREE;

        const tx = c * TILE_W, ty = r * TILE_H;

        if (isGrassy(above)) {
          ctx.fillStyle = midGrass;
          for (let px = 1; px < TILE_W - 1; px++) {
            if (pxHash(px, r, c, 1) > 0.38) ctx.fillRect(tx + px, ty, 1, 1);
          }
          ctx.fillStyle = darkGrass;
          for (let px = 1; px < TILE_W - 1; px++) {
            if (pxHash(px, r, c, 2) > 0.55) ctx.fillRect(tx + px, ty + 1, 1, 1);
          }
        }

        if (isGrassy(left)) {
          ctx.fillStyle = midGrass;
          for (let py = 1; py < TILE_H - 1; py++) {
            if (pxHash(c, py, r, 3) > 0.38) ctx.fillRect(tx, ty + py, 1, 1);
          }
          ctx.fillStyle = darkGrass;
          for (let py = 1; py < TILE_H - 1; py++) {
            if (pxHash(c, py, r, 4) > 0.55) ctx.fillRect(tx + 1, ty + py, 1, 1);
          }
        }

        if (isGrassy(below)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx, ty + TILE_H - 2, TILE_W, 2);
        }
        if (isGrassy(right)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx + TILE_W - 2, ty, 2, TILE_H);
        }
      }
    }
  }

  // ---- Pass 3: Flowers ----
  function _paintFlowers(ctx) {
    const cols = ['#f5c842','#e84393','#ff6688','#42d9f5','#ff8c42','#cc66ff'];
    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        if (tileMap[r][c] !== T.FLOWER) continue;
        const variant = Math.floor(pxHash(c, r, 77, 3) * 6);
        const fx = c * TILE_W + 3 + Math.floor(pxHash(c, r, 11, 1) * 8);
        const fy = r * TILE_H + 2 + Math.floor(pxHash(c, r, 13, 2) * 7);
        ctx.fillStyle = cols[variant];
        ctx.fillRect(fx, fy, 2, 2);
        ctx.fillStyle = '#1e5c1e';
        ctx.fillRect(fx, fy + 2, 1, 3);
      }
    }
  }

  // ---- Animated water (called every frame) ----
  function updateWater(time) {
    if (!worldCtx || !worldTex || !staticCanvas) return;
    // Restore static ground layer (erases previous water frame)
    worldCtx.drawImage(staticCanvas, 0, 0);
    // Paint animated water on top
    _paintAllWater(worldCtx, time);
    worldTex.needsUpdate = true;
  }

  function _paintAllWater(ctx, time) {
    for (const { c, r } of waterTileList) {
      _paintWaterTile(ctx, c, r, time);
    }
  }

  function _paintWaterTile(ctx, c, r, time) {
    const wx = c * TILE_W;
    const wy = r * TILE_H;

    const tileAbove = r > 0         ? tileMap[r - 1][c] : null;
    const tileLeft  = c > 0         ? tileMap[r][c - 1] : null;
    const tileBelow = r < mapRows-1 ? tileMap[r + 1][c] : null;
    const tileRight = c < mapCols-1 ? tileMap[r][c + 1] : null;

    const isLand = t => t !== null && t !== undefined && t !== T.WATER;

    // Per-tile ImageData
    const img = ctx.createImageData(TILE_W, TILE_H);
    const d = img.data;

    for (let py = 0; py < TILE_H; py++) {
      for (let px = 0; px < TILE_W; px++) {
        const i = (py * TILE_W + px) * 4;

        // World pixel coords (for seamless cross-tile ripple pattern)
        const gwx = wx + px;
        const gwy = wy + py;

        // Animated diagonal diamond ripple pattern (Stardew-style)
        const ripple = _waterRipple(gwx, gwy, time);

        // Base water: medium blue
        let rv = 48, gv = 112, bv = 192;

        // Apply ripple highlight (adds lighter shimmer)
        rv = clampByte(rv + Math.round(ripple * 34));
        gv = clampByte(gv + Math.round(ripple * 48));
        bv = clampByte(bv + Math.round(ripple * 56));

        // Slight depth variation via noise
        const depth = pxHash(px + c * 3, py + r * 7, c + r, 2);
        const depthV = Math.round((depth - 0.5) * 14);
        rv = clampByte(rv + depthV);
        gv = clampByte(gv + depthV);
        bv = clampByte(bv + depthV);

        d[i]   = rv;
        d[i+1] = gv;
        d[i+2] = bv;
        d[i+3] = 255;
      }
    }

    ctx.putImageData(img, wx, wy);

    // ---- Foam at land borders ----
    if (isLand(tileAbove)) {
      // Bright foam line at top of water tile (where it meets land)
      ctx.fillStyle = 'rgba(210, 238, 255, 0.92)';
      for (let px = 0; px < TILE_W; px++) {
        if (pxHash(px, c + r * 7, 5, 11) > 0.22) ctx.fillRect(wx + px, wy, 1, 1);
      }
      ctx.fillStyle = 'rgba(140, 200, 248, 0.70)';
      for (let px = 0; px < TILE_W; px++) {
        if (pxHash(px + 3, c * 5 + r, 6, 9) > 0.35) ctx.fillRect(wx + px, wy + 1, 1, 1);
      }
      // Shadow on the land tile above (bottom edge of land)
      ctx.fillStyle = 'rgba(0, 20, 60, 0.22)';
      ctx.fillRect(wx, wy - 2, TILE_W, 2);
    }

    if (isLand(tileLeft)) {
      ctx.fillStyle = 'rgba(210, 238, 255, 0.92)';
      for (let py = 0; py < TILE_H; py++) {
        if (pxHash(c + r * 13, py, 7, 13) > 0.22) ctx.fillRect(wx, wy + py, 1, 1);
      }
      ctx.fillStyle = 'rgba(140, 200, 248, 0.70)';
      for (let py = 0; py < TILE_H; py++) {
        if (pxHash(c * 3 + r, py + 5, 8, 10) > 0.35) ctx.fillRect(wx + 1, wy + py, 1, 1);
      }
      ctx.fillStyle = 'rgba(0, 20, 60, 0.22)';
      ctx.fillRect(wx - 2, wy, 2, TILE_H);
    }

    if (isLand(tileBelow)) {
      // Deep shadow at bottom of water tile (land casts shadow into water)
      ctx.fillStyle = 'rgba(10, 30, 80, 0.28)';
      ctx.fillRect(wx, wy + TILE_H - 3, TILE_W, 3);
    }

    if (isLand(tileRight)) {
      ctx.fillStyle = 'rgba(10, 30, 80, 0.28)';
      ctx.fillRect(wx + TILE_W - 3, wy, 3, TILE_H);
    }
  }

  // Stardew-style animated diagonal diamond ripple pattern
  function _waterRipple(gx, gy, time) {
    // Two crossing diagonal waves create a diamond/net pattern
    const t = time;
    const d1 = (gx + gy) * 0.50 - t * 2.2;
    const d2 = (gx - gy) * 0.50 + t * 1.6;
    const w = (Math.sin(d1) + Math.sin(d2)) * 0.5; // -1…+1
    // Only the bright peaks show as shimmer
    return Math.max(0, w - 0.15) * 0.85;
  }

  // ---- Tree canopy sprites ----
  function _buildTreeMesh(scene, tiles) {
    if (!tiles.length) return;

    const cv       = document.createElement('canvas');
    cv.width  = TREE_W;
    cv.height = TREE_H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, TREE_W, TREE_H);
    _drawTreeSprite(ctx);

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(TREE_W, TREE_H), mat, tiles.length
    );
    mesh.frustumCulled = false;
    mesh.renderOrder   = 1;

    const dummy   = new THREE.Object3D();
    const offsetY = (TREE_H - TILE_H) / 2;

    tiles.forEach(({ c, r }, i) => {
      const ty = -(r * TILE_H + TILE_H / 2);
      dummy.position.set(c * TILE_W + TILE_W / 2, ty + offsetY, 0.002);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    createdObjects.push(mesh);
  }

  function _drawTreeSprite(ctx) {
    const cw = TREE_W, ch = TREE_H;

    // Trunk
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(Math.floor(cw * 0.39), Math.floor(ch * 0.70), Math.floor(cw * 0.22), Math.floor(ch * 0.30));
    ctx.fillStyle = '#7a4820';
    ctx.fillRect(Math.floor(cw * 0.39), Math.floor(ch * 0.70), 2, Math.floor(ch * 0.30));

    // Round canopy via per-pixel circle
    const cx = cw / 2;
    const cy = ch * 0.40;
    const radius = cw * 0.44;

    const canopyShades = [
      '#1e4a1a', '#286428', '#349640', '#46b84e', '#5cd468',
    ];

    const imgData = ctx.createImageData(cw, ch);
    const d = imgData.data;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const edgeHash = pxHash(px, py, 7, 3);
        const r = radius + (edgeHash - 0.5) * 3.5;
        if (dist > r) continue;

        const yFrac = (py - (cy - radius)) / (radius * 2);
        const radialFrac = dist / radius;
        const shadeFrac  = yFrac * 0.6 + radialFrac * 0.4;
        const shadeIdx   = Math.max(0, 4 - Math.floor(shadeFrac * 5));

        const hex = canopyShades[shadeIdx];
        const rv = parseInt(hex.slice(1, 3), 16);
        const gv = parseInt(hex.slice(3, 5), 16);
        const bv = parseInt(hex.slice(5, 7), 16);

        const jitter = Math.round((pxHash(px + 3, py + 9, 5, 2) - 0.5) * 10);

        const idx = (py * cw + px) * 4;
        d[idx]   = clampByte(rv + jitter);
        d[idx+1] = clampByte(gv + jitter);
        d[idx+2] = clampByte(bv + jitter);
        d[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Highlight at top
    ctx.fillStyle = 'rgba(160,240,120,0.45)';
    ctx.fillRect(Math.floor(cx - 3), Math.floor(cy - radius + 2), 4, 2);
    ctx.fillRect(Math.floor(cx + 1), Math.floor(cy - radius + 3), 2, 2);
  }

  // ---- public API ----
  return {
    T,
    TILE_W,
    TILE_H,
    generate,
    buildScene,
    disposeAll,
    updateWater,
    tileAt: (col, row) => tileMap[row]?.[col],
    cols:   () => mapCols,
    rows:   () => mapRows,
  };
})();
