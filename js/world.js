// ============================================================
//  WORLD  — 16×16 pixel-art tiles, Three.js InstancedMesh
// ============================================================

const World = (() => {
  // ---- tile types ----
  const T = { GRASS: 0, DIRT: 1, WATER: 2, TREE: 3, STONE: 4, FLOWER: 5, PATH: 6 };

  const TILE_W = 16;
  const TILE_H = 16;

  // Tree sprite world-unit size (taller than one tile to include canopy)
  const TREE_W = 26;
  const TREE_H = 32;

  // ---- 5-shade palettes: dark → bright [R, G, B] ----
  const PAL = {
    [T.GRASS]:  [[40,74,32],[54,96,42],[66,118,52],[82,142,66],[98,164,80]],
    [T.DIRT]:   [[88,56,30],[112,76,46],[136,96,60],[158,118,78],[178,140,96]],
    [T.WATER]:  [[16,48,104],[24,68,144],[34,94,178],[52,126,210],[80,164,238]],
    [T.STONE]:  [[66,66,80],[86,88,104],[108,110,128],[130,132,152],[154,156,176]],
    [T.PATH]:   [[108,82,48],[136,106,66],[160,128,82],[184,152,104],[204,174,124]],
  };
  PAL[T.FLOWER] = PAL[T.GRASS];
  PAL[T.TREE]   = PAL[T.GRASS];

  function palIdx(n, type) {
    switch (type) {
      case T.GRASS: case T.FLOWER: case T.TREE:
        if (n < 0.05) return 0; if (n < 0.20) return 1;
        if (n < 0.64) return 2; if (n < 0.86) return 3; return 4;
      case T.DIRT:
        if (n < 0.06) return 0; if (n < 0.22) return 1;
        if (n < 0.68) return 2; if (n < 0.88) return 3; return 4;
      case T.WATER:
        if (n < 0.12) return 0; if (n < 0.32) return 1;
        if (n < 0.65) return 2; if (n < 0.85) return 3; return 4;
      case T.STONE:
        if (n < 0.08) return 0; if (n < 0.26) return 1;
        if (n < 0.64) return 2; if (n < 0.84) return 3; return 4;
      case T.PATH:
        if (n < 0.05) return 0; if (n < 0.18) return 1;
        if (n < 0.60) return 2; if (n < 0.82) return 3; return 4;
      default: return 2;
    }
  }

  function pxHash(a, b, c, d) {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + d * 531.3) * 43758.5453;
    return x - Math.floor(x);
  }

  function clampByte(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  // ---- tile texture cache (plain 2D canvases, 16×16) ----
  const tileCache   = new Map();
  const NUM_VARIANTS = 8;

  function getTileCanvas(type, variant) {
    const key = type * 100 + variant;
    if (tileCache.has(key)) return tileCache.get(key);
    const cv  = document.createElement('canvas');
    cv.width  = TILE_W;
    cv.height = TILE_H;
    buildTexture(cv.getContext('2d'), type, variant);
    tileCache.set(key, cv);
    return cv;
  }

  function buildTexture(ctx, type, variant) {
    const img = ctx.createImageData(TILE_W, TILE_H);
    const d   = img.data;
    const pal = PAL[type] || PAL[T.GRASS];
    for (let py = 0; py < TILE_H; py++) {
      for (let px = 0; px < TILE_W; px++) {
        const i  = (py * TILE_W + px) * 4;
        const n  = pxHash(px, py, variant, type);
        const ci = palIdx(n, type);
        let [r, g, b] = pal[ci];
        const n2 = pxHash(px + 17, py + 31, variant ^ 5, type ^ 3);
        const v  = Math.round((n2 - 0.5) * 10);
        d[i]   = clampByte(r + v);
        d[i+1] = clampByte(g + v);
        d[i+2] = clampByte(b + v);
        d[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (type === T.FLOWER) addFlowerDecal(ctx, variant);
  }

  function addFlowerDecal(ctx, variant) {
    const cols = ['#f5c842','#e84393','#ff6688','#42d9f5','#ff8c42','#cc66ff'];
    const fc   = cols[variant % cols.length];
    const fx   = 3 + (variant % 4) * 3;
    const fy   = 2 + Math.floor(variant / 4) * 3;
    ctx.fillStyle = fc;
    ctx.fillRect(fx, fy, 2, 2);
    ctx.fillStyle = '#235a23';
    ctx.fillRect(fx, fy + 2, 1, 3);
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
          const n = noise(c * 0.18, r * 0.18);
          if      (n < 0.22) t = T.WATER;
          else if (n < 0.34) t = T.DIRT;
          else if (n < 0.50) t = T.STONE;
          else if (n < 0.68) t = T.GRASS;
          else if (n < 0.75) t = T.FLOWER;
          else if (n < 0.82) t = T.PATH;
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

  // ---- Three.js scene building ----
  // Track every Three.js object we create so we can dispose them properly.
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

  function buildScene(scene) {
    disposeAll();

    // Group tile positions by (groundType, variant) for InstancedMesh batching.
    // TREE tiles: render GRASS underneath + add to treePos for sprite layer.
    const groups  = new Map(); // key → Array<{c, r}>
    const waterPos = [];
    const treePos  = [];

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];

        if (type === T.WATER) { waterPos.push({ c, r }); continue; }

        // For TREE: render as GRASS with its own per-tile grass variant
        const gType    = type === T.TREE ? T.GRASS : type;
        const gVariant = Math.floor(pxHash(c, r, gType, 99) * NUM_VARIANTS);
        const key      = gType * 100 + gVariant;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ c, r });

        if (type === T.TREE) treePos.push({ c, r });
      }
    }

    const dummy = new THREE.Object3D();

    // ---- static ground tiles (one InstancedMesh per type+variant group) ----
    for (const [key, tiles] of groups) {
      const gType    = Math.floor(key / 100);
      const gVariant = key % 100;

      const cv  = getTileCanvas(gType, gVariant);
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;

      const mat  = new THREE.MeshBasicMaterial({ map: tex });
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(TILE_W, TILE_H), mat, tiles.length
      );
      mesh.frustumCulled = false;
      mesh.renderOrder   = 0;

      tiles.forEach(({ c, r }, i) => {
        // Three.js Y is up; game Y is down → negate
        dummy.position.set(c * TILE_W + TILE_W / 2, -(r * TILE_H + TILE_H / 2), 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      createdObjects.push(mesh);
    }

    // ---- water (animated shared texture) ----
    _buildWaterMesh(scene, waterPos, dummy);

    // ---- tree sprites (layer above ground) ----
    _buildTreeMesh(scene, treePos, dummy);
  }

  function _buildWaterMesh(scene, tiles, dummy) {
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

    tiles.forEach(({ c, r }, i) => {
      dummy.position.set(c * TILE_W + TILE_W / 2, -(r * TILE_H + TILE_H / 2), 0);
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

    // Animated shimmer lines moving upward (in tile-space pixels/sec)
    const spacing = Math.ceil(TILE_H * 0.38);
    const offset  = (time * 3) % spacing;
    ctx.fillStyle = `rgba(${w[4][0]},${w[4][1]},${w[4][2]},0.32)`;
    for (let ly = -spacing + offset; ly < TILE_H + spacing; ly += spacing) {
      ctx.fillRect(1, Math.floor(ly), TILE_W - 2, 1);
    }

    // Deep-water tint at bottom
    ctx.fillStyle = `rgba(${w[0][0]},${w[0][1]},${w[0][2]},0.28)`;
    ctx.fillRect(0, Math.round(TILE_H * 0.75), TILE_W, Math.round(TILE_H * 0.25));
  }

  function updateWater(time) {
    if (!waterCtx || !waterTex) return;
    _drawWaterFrame(time);
    waterTex.needsUpdate = true;
  }

  function _buildTreeMesh(scene, tiles, dummy) {
    if (!tiles.length) return;

    // Draw the tree sprite onto a TREE_W × TREE_H canvas (transparent bg)
    const cv  = document.createElement('canvas');
    cv.width  = TREE_W;
    cv.height = TREE_H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, TREE_W, TREE_H);

    // Trunk (bottom center)
    ctx.fillStyle = '#4a2808';
    ctx.fillRect(11, 23, 4, 9);

    // Canopy — 3 stacked layers, darkest at bottom
    ctx.fillStyle = '#1c4820';
    ctx.fillRect(4,  15, 18, 12);
    ctx.fillStyle = '#2a6e30';
    ctx.fillRect(2,  8,  22, 12);
    ctx.fillStyle = '#3a9040';
    ctx.fillRect(5,  2,  16, 10);

    // Bright highlight pixels at top
    ctx.fillStyle = '#50b456';
    ctx.fillRect(9,  0, 3, 2);
    ctx.fillRect(15, 1, 3, 2);

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(TREE_W, TREE_H), mat, tiles.length
    );
    mesh.frustumCulled = false;
    mesh.renderOrder   = 1;

    // Position so the sprite's bottom aligns with the tile's bottom edge.
    // tileCenter.y = -(r * TILE_H + TILE_H / 2)
    // tileBottom   = tileCenter.y - TILE_H / 2
    // treeCenter.y = tileBottom + TREE_H / 2 = tileCenter.y + (TREE_H - TILE_H) / 2
    const offsetY = (TREE_H - TILE_H) / 2;

    tiles.forEach(({ c, r }, i) => {
      const ty = -(r * TILE_H + TILE_H / 2);
      dummy.position.set(c * TILE_W + TILE_W / 2, ty + offsetY, 0.001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    createdObjects.push(mesh);
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
