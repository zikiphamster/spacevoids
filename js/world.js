// ============================================================
//  WORLD  — single world canvas + Three.js mesh, Stardew-style
// ============================================================

const World = (() => {
  // ---- tile types ----
  const T = { GRASS: 0, DIRT: 1, WATER: 2, TREE: 3, STONE: 4, FLOWER: 5, PATH: 6 };

  const TILE_W = 16;
  const TILE_H = 16;

  // Tree sprite world-unit size
  const TREE_W = 28;
  const TREE_H = 36;

  // ---- Stardew-inspired palettes: 5 shades dark→bright [R,G,B] ----
  const PAL = {
    [T.GRASS]:  [[40,90,18],[56,116,28],[76,148,44],[96,172,60],[120,200,76]],
    [T.DIRT]:   [[140,100,46],[164,126,64],[190,152,84],[212,174,104],[230,196,124]],
    [T.WATER]:  [[18,52,112],[28,74,152],[40,102,186],[60,136,218],[88,170,244]],
    [T.STONE]:  [[72,72,84],[92,94,110],[116,118,136],[140,142,162],[164,166,188]],
    [T.PATH]:   [[160,128,72],[184,152,92],[206,174,112],[226,196,134],[244,214,154]],
  };
  PAL[T.FLOWER] = PAL[T.GRASS];
  PAL[T.TREE]   = PAL[T.GRASS];

  // Palette index selection per tile type
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

  // Per-pixel hash (deterministic pseudo-random)
  function pxHash(a, b, c, d) {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + (d || 0) * 531.3) * 43758.5453;
    return x - Math.floor(x);
  }

  function clampByte(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

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

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a  = hash(ix,     iy    ), b  = hash(ix + 1, iy    );
    const c2 = hash(ix,     iy + 1), d  = hash(ix + 1, iy + 1);
    const u  = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d, u), v);
  }

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- Three.js state ----
  const createdObjects = [];
  let waterMesh = null, waterTex = null, waterCanvas = null, waterCtx = null;

  function disposeAll() {
    createdObjects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    createdObjects.length = 0;
    waterMesh = waterTex = waterCanvas = waterCtx = null;
  }

  // ---- scene building ----
  function buildScene(scene) {
    disposeAll();

    const worldW = mapCols * TILE_W;
    const worldH = mapRows * TILE_H;

    // Separate water and tree positions
    const waterPos = [];
    const treePos  = [];

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER) waterPos.push({ c, r });
        if (type === T.TREE)  treePos.push({ c, r });
      }
    }

    // ---- Single world canvas (all non-water ground tiles) ----
    const worldCanvas        = document.createElement('canvas');
    worldCanvas.width  = worldW;
    worldCanvas.height = worldH;
    const worldCtx = worldCanvas.getContext('2d');

    // Pass 1: Base pixel colors for every tile
    _paintBaseLayer(worldCtx);

    // Pass 2: Terrain edge transitions (grass fringe over dirt/path)
    _paintTransitions(worldCtx);

    // Pass 3: Flower decorations
    _paintFlowers(worldCtx);

    const worldTex = new THREE.CanvasTexture(worldCanvas);
    worldTex.magFilter = THREE.NearestFilter;
    worldTex.minFilter = THREE.NearestFilter;

    const worldMat  = new THREE.MeshBasicMaterial({ map: worldTex });
    const worldMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      worldMat
    );
    // Center the plane on the world: world coords go 0→worldW (x), 0→worldH (y down)
    // Three.js Y is up, so center = (worldW/2, -worldH/2, 0)
    worldMesh.position.set(worldW / 2, -worldH / 2, 0);
    worldMesh.renderOrder = 0;
    scene.add(worldMesh);
    createdObjects.push(worldMesh);

    // ---- Animated water ----
    _buildWaterMesh(scene, waterPos);

    // ---- Tree canopy sprites ----
    _buildTreeMesh(scene, treePos);
  }

  // ---- Pass 1: Base layer ----
  function _paintBaseLayer(ctx) {
    const imgData = ctx.createImageData(mapCols * TILE_W, mapRows * TILE_H);
    const d = imgData.data;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        // Water gets painted as deep-water placeholder (overwritten by animated water mesh)
        const drawType = (type === T.WATER) ? T.WATER : (type === T.TREE ? T.GRASS : type);
        const pal = PAL[drawType] || PAL[T.GRASS];

        for (let py = 0; py < TILE_H; py++) {
          for (let px = 0; px < TILE_W; px++) {
            const wx = c * TILE_W + px;
            const wy = r * TILE_H + py;
            const i  = (wy * mapCols * TILE_W + wx) * 4;

            // Smooth (medium-scale) noise for terrain cluster feeling
            const ns = smoothNoise(c + px / TILE_W, r + py / TILE_H, 0.35);
            // Fine hash noise for pixel micro-variation
            const nf = pxHash(px, py, c * 17 + r * 31, drawType);
            // Blend: 60% smooth + 40% fine
            const n = ns * 0.6 + nf * 0.4;

            const ci = palIdx(n, drawType);
            let [rv, gv, bv] = pal[ci];

            // Tiny per-pixel brightness jitter for organic look
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

  // Smooth value noise at arbitrary fractional tile coords
  function smoothNoise(x, y, scale) {
    const sx = x * scale, sy = y * scale;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const fx = sx - ix, fy = sy - iy;
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c2 = hash(ix, iy + 1), d2 = hash(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d2, u), v);
  }

  // ---- Pass 2: Terrain transitions ----
  // Paints small grass fringe pixels at the edge of grass tiles bordering dirt/path.
  function _paintTransitions(ctx) {
    const grassPal = PAL[T.GRASS];
    const darkGrass = `rgb(${grassPal[1][0]},${grassPal[1][1]},${grassPal[1][2]})`;
    const midGrass  = `rgb(${grassPal[2][0]},${grassPal[2][1]},${grassPal[2][2]})`;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER || type === T.GRASS || type === T.FLOWER || type === T.TREE) continue;

        // For dirt/path/stone tiles — check if a grass tile is directly above or to the left
        const above = r > 0 ? tileMap[r - 1][c] : null;
        const left  = c > 0 ? tileMap[r][c - 1] : null;
        const below = r < mapRows - 1 ? tileMap[r + 1][c] : null;
        const right = c < mapCols - 1 ? tileMap[r][c + 1] : null;

        const isGrassy = t => t === T.GRASS || t === T.FLOWER || t === T.TREE;

        const tx = c * TILE_W;
        const ty = r * TILE_H;

        // Top edge: grass above → paint fringe pixels at top of this tile
        if (isGrassy(above)) {
          ctx.fillStyle = midGrass;
          for (let px = 1; px < TILE_W - 1; px++) {
            if (pxHash(px, r, c, 1) > 0.38) {
              ctx.fillRect(tx + px, ty, 1, 1);
            }
          }
          ctx.fillStyle = darkGrass;
          for (let px = 1; px < TILE_W - 1; px++) {
            if (pxHash(px, r, c, 2) > 0.55) {
              ctx.fillRect(tx + px, ty + 1, 1, 1);
            }
          }
        }

        // Left edge: grass to the left → fringe on left side
        if (isGrassy(left)) {
          ctx.fillStyle = midGrass;
          for (let py = 1; py < TILE_H - 1; py++) {
            if (pxHash(c, py, r, 3) > 0.38) {
              ctx.fillRect(tx, ty + py, 1, 1);
            }
          }
          ctx.fillStyle = darkGrass;
          for (let py = 1; py < TILE_H - 1; py++) {
            if (pxHash(c, py, r, 4) > 0.55) {
              ctx.fillRect(tx + 1, ty + py, 1, 1);
            }
          }
        }

        // Bottom edge shadow: grass below this tile → dark strip at tile bottom
        if (isGrassy(below)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx, ty + TILE_H - 2, TILE_W, 2);
        }

        // Right edge shadow: grass to the right
        if (isGrassy(right)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx + TILE_W - 2, ty, 2, TILE_H);
        }
      }
    }
  }

  // ---- Pass 3: Flower decorations ----
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

  // ---- Animated water ----
  function _buildWaterMesh(scene, tiles) {
    if (!tiles.length) return;

    waterCanvas        = document.createElement('canvas');
    waterCanvas.width  = TILE_W;
    waterCanvas.height = TILE_H;
    waterCtx           = waterCanvas.getContext('2d');
    _drawWaterFrame(0);

    waterTex           = new THREE.CanvasTexture(waterCanvas);
    waterTex.magFilter = THREE.NearestFilter;
    waterTex.minFilter = THREE.NearestFilter;

    const mat  = new THREE.MeshBasicMaterial({ map: waterTex });
    waterMesh  = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(TILE_W, TILE_H), mat, tiles.length
    );
    waterMesh.frustumCulled = false;
    waterMesh.renderOrder   = 0;

    const dummy = new THREE.Object3D();
    tiles.forEach(({ c, r }, i) => {
      dummy.position.set(c * TILE_W + TILE_W / 2, -(r * TILE_H + TILE_H / 2), 0.001);
      dummy.updateMatrix();
      waterMesh.setMatrixAt(i, dummy.matrix);
    });
    waterMesh.instanceMatrix.needsUpdate = true;
    scene.add(waterMesh);
    createdObjects.push(waterMesh);
  }

  function _drawWaterFrame(time) {
    const w   = PAL[T.WATER];
    const ctx = waterCtx;
    ctx.fillStyle = `rgb(${w[2][0]},${w[2][1]},${w[2][2]})`;
    ctx.fillRect(0, 0, TILE_W, TILE_H);

    // Animated shimmer lines
    const spacing = Math.ceil(TILE_H * 0.38);
    const offset  = (time * 3) % spacing;
    ctx.fillStyle = `rgba(${w[4][0]},${w[4][1]},${w[4][2]},0.30)`;
    for (let ly = -spacing + offset; ly < TILE_H + spacing; ly += spacing) {
      ctx.fillRect(1, Math.floor(ly), TILE_W - 2, 1);
    }

    // Deep-water tint at bottom
    ctx.fillStyle = `rgba(${w[0][0]},${w[0][1]},${w[0][2]},0.25)`;
    ctx.fillRect(0, Math.round(TILE_H * 0.72), TILE_W, Math.round(TILE_H * 0.28));

    // Soft foam highlight at top
    ctx.fillStyle = `rgba(${w[3][0]},${w[3][1]},${w[3][2]},0.20)`;
    ctx.fillRect(2, 0, TILE_W - 4, 2);
  }

  function updateWater(time) {
    if (!waterCtx || !waterTex) return;
    _drawWaterFrame(time);
    waterTex.needsUpdate = true;
  }

  // ---- Round tree canopy sprites ----
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
    // Trunk highlight
    ctx.fillStyle = '#7a4820';
    ctx.fillRect(Math.floor(cw * 0.39), Math.floor(ch * 0.70), 2, Math.floor(ch * 0.30));

    // Round canopy — draw pixel by pixel using circle equation
    const cx = cw / 2;
    const cy = ch * 0.40;
    const radius = cw * 0.44;

    // Canopy shading layers (5 shades of green, N=bright, S=dark)
    const canopyShades = [
      '#1e4a1a',  // darkest (south/shadow)
      '#286428',
      '#349640',
      '#46b84e',
      '#5cd468',  // brightest (north/highlight)
    ];

    // Use ImageData for per-pixel drawing
    const imgData = ctx.createImageData(cw, ch);
    const d = imgData.data;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Ragged edge via hash
        const edgeHash = pxHash(px, py, 7, 3);
        const r = radius + (edgeHash - 0.5) * 3.5;

        if (dist > r) continue;

        // Y-based shade: top = bright (index 4), bottom = dark (index 0)
        const yFrac = (py - (cy - radius)) / (radius * 2);  // 0=top, 1=bottom
        // Add slight radial falloff to make edges darker
        const radialFrac = dist / radius;
        const shadeFrac = yFrac * 0.6 + radialFrac * 0.4;
        // Invert: bright at top (yFrac≈0 → high index), dark at bottom
        const shadeIdx = Math.max(0, 4 - Math.floor(shadeFrac * 5));

        const hex = canopyShades[shadeIdx];
        const rv = parseInt(hex.slice(1, 3), 16);
        const gv = parseInt(hex.slice(3, 5), 16);
        const bv = parseInt(hex.slice(5, 7), 16);

        // Micro jitter
        const jitter = Math.round((pxHash(px + 3, py + 9, 5, 2) - 0.5) * 10);

        const i = (py * cw + px) * 4;
        d[i]   = clampByte(rv + jitter);
        d[i+1] = clampByte(gv + jitter);
        d[i+2] = clampByte(bv + jitter);
        d[i+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Bright highlight cluster at top of canopy
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
