// ============================================================
//  WORLD  — static ground canvas + water ShaderMaterial
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
          else if (n < 0.72) t = T.GRASS;
          else if (n < 0.80) t = T.PATH;
          else               t = T.TREE;
        }
        tileMap[r][c] = t;
      }
    }
  }

  // ---- Three.js state ----
  const createdObjects = [];
  let waterMaterial = null;

  function disposeAll() {
    createdObjects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        // dispose uniforms textures
        if (obj.material.uniforms) {
          Object.values(obj.material.uniforms).forEach(u => {
            if (u.value && u.value.isTexture) u.value.dispose();
          });
        }
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    createdObjects.length = 0;
    waterMaterial = null;
  }

  // ---- scene building ----
  function buildScene(scene) {
    disposeAll();

    const worldW = mapCols * TILE_W;
    const worldH = mapRows * TILE_H;

    const treePos = [];
    for (let r = 0; r < mapRows; r++)
      for (let c = 0; c < mapCols; c++)
        if (tileMap[r][c] === T.TREE) treePos.push({ c, r });

    // ---- Static ground canvas (painted once, never updated) ----
    const groundCanvas       = document.createElement('canvas');
    groundCanvas.width  = worldW;
    groundCanvas.height = worldH;
    const gCtx = groundCanvas.getContext('2d');
    _paintBaseLayer(gCtx);
    _paintTransitions(gCtx);

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.magFilter = THREE.NearestFilter;
    groundTex.minFilter = THREE.NearestFilter;

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: groundTex })
    );
    groundMesh.position.set(worldW / 2, -worldH / 2, 0);
    groundMesh.renderOrder = 0;
    scene.add(groundMesh);
    createdObjects.push(groundMesh);

    // ---- Water shader mesh ----
    _buildWaterShaderMesh(scene, worldW, worldH);

    // ---- Tree canopy sprites ----
    _buildTreeMesh(scene, treePos);
  }

  // ---- Pass 1: Base pixel layer (ground tiles only, skip water) ----
  function _paintBaseLayer(ctx) {
    const worldW = mapCols * TILE_W;
    const imgData = ctx.createImageData(worldW, mapRows * TILE_H);
    const d = imgData.data;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER) continue;

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
    const grassPal  = PAL[T.GRASS];
    const midGrass  = `rgb(${grassPal[2][0]},${grassPal[2][1]},${grassPal[2][2]})`;
    const darkGrass = `rgb(${grassPal[1][0]},${grassPal[1][1]},${grassPal[1][2]})`;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        const type = tileMap[r][c];
        if (type === T.WATER || type === T.GRASS || type === T.FLOWER || type === T.TREE) continue;

        const above = r > 0         ? tileMap[r - 1][c] : null;
        const left  = c > 0         ? tileMap[r][c - 1] : null;
        const below = r < mapRows-1 ? tileMap[r + 1][c] : null;
        const right = c < mapCols-1 ? tileMap[r][c + 1] : null;

        const isGrassy = t => t === T.GRASS || t === T.FLOWER || t === T.TREE;

        const tx = c * TILE_W, ty = r * TILE_H;

        if (isGrassy(above)) {
          ctx.fillStyle = midGrass;
          for (let px = 1; px < TILE_W - 1; px++)
            if (pxHash(px, r, c, 1) > 0.38) ctx.fillRect(tx + px, ty, 1, 1);
          ctx.fillStyle = darkGrass;
          for (let px = 1; px < TILE_W - 1; px++)
            if (pxHash(px, r, c, 2) > 0.55) ctx.fillRect(tx + px, ty + 1, 1, 1);
        }

        if (isGrassy(left)) {
          ctx.fillStyle = midGrass;
          for (let py = 1; py < TILE_H - 1; py++)
            if (pxHash(c, py, r, 3) > 0.38) ctx.fillRect(tx, ty + py, 1, 1);
          ctx.fillStyle = darkGrass;
          for (let py = 1; py < TILE_H - 1; py++)
            if (pxHash(c, py, r, 4) > 0.55) ctx.fillRect(tx + 1, ty + py, 1, 1);
        }

        if (isGrassy(below)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx, ty + TILE_H - 2, TILE_W, 2);
        }
        if (isGrassy(right)) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(tx + TILE_W - 2, ty, 2, TILE_H);
        }

        // Shadow on land edges adjacent to water (water shader sits on top)
        if (below === T.WATER) {
          ctx.fillStyle = 'rgba(0,20,60,0.20)';
          ctx.fillRect(tx, ty + TILE_H - 2, TILE_W, 2);
        }
        if (right === T.WATER) {
          ctx.fillStyle = 'rgba(0,20,60,0.20)';
          ctx.fillRect(tx + TILE_W - 2, ty, 2, TILE_H);
        }
      }
    }
  }

  // ---- Water: GPU shader mesh ----
  function _buildWaterShaderMesh(scene, worldW, worldH) {
    // Small mask texture (mapCols × mapRows pixels).
    // R channel: 4-bit edge flags (which neighbors are land).
    // A channel: 255 = water tile, 0 = not water.
    const maskCanvas       = document.createElement('canvas');
    maskCanvas.width  = mapCols;
    maskCanvas.height = mapRows;
    const mCtx = maskCanvas.getContext('2d');
    const imgData = mCtx.createImageData(mapCols, mapRows);
    const md = imgData.data;

    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        if (tileMap[r][c] !== T.WATER) continue;
        const i = (r * mapCols + c) * 4;
        let flags = 0;
        if (r > 0         && tileMap[r-1][c] !== T.WATER) flags |= 1;  // land above
        if (c > 0         && tileMap[r][c-1] !== T.WATER) flags |= 2;  // land left
        if (r < mapRows-1 && tileMap[r+1][c] !== T.WATER) flags |= 4;  // land below
        if (c < mapCols-1 && tileMap[r][c+1] !== T.WATER) flags |= 8;  // land right
        md[i]   = flags;   // R = edge flags (0–15)
        md[i+3] = 255;     // A = 255 means "is water"
      }
    }
    mCtx.putImageData(imgData, 0, 0);

    const maskTex = new THREE.CanvasTexture(maskCanvas);
    maskTex.magFilter = THREE.NearestFilter;
    maskTex.minFilter = THREE.NearestFilter;
    maskTex.flipY     = false;  // row 0 = top of canvas = tile row 0

    waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0.0 },
        uMask:    { value: maskTex },
        uWorldW:  { value: float(worldW) },
        uWorldH:  { value: float(worldH) },
        uMapCols: { value: float(mapCols) },
        uMapRows: { value: float(mapRows) },
        uTileW:   { value: float(TILE_W) },
        uTileH:   { value: float(TILE_H) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform sampler2D uMask;
        uniform float uWorldW;
        uniform float uWorldH;
        uniform float uMapCols;
        uniform float uMapRows;
        uniform float uTileW;
        uniform float uTileH;

        varying vec2 vUv;

        void main() {
          // Game-space pixel coordinates (x right, y down)
          float gx = vUv.x * uWorldW;
          float gy = (1.0 - vUv.y) * uWorldH;

          // Tile grid position
          float col = floor(gx / uTileW);
          float row = floor(gy / uTileH);

          // Sample the water mask (flipY=false, row 0 = UV y=0 = top)
          vec2 maskUv = vec2((col + 0.5) / uMapCols, (row + 0.5) / uMapRows);
          vec4 mask = texture2D(uMask, maskUv);

          // Discard non-water tiles (alpha = 0)
          if (mask.a < 0.5) discard;

          // Decode 4-bit edge flags from R byte
          float ef = floor(mask.r * 255.0 + 0.5);
          float landAbove = step(0.5, mod(ef,              2.0));
          float landLeft  = step(0.5, mod(floor(ef / 2.0), 2.0));
          float landBelow = step(0.5, mod(floor(ef / 4.0), 2.0));
          float landRight = step(0.5, mod(floor(ef / 8.0), 2.0));

          // Screen-pixel coords (SCALE = 4 hardcoded)
          float sx = floor(gx * 4.0);
          float sy = floor(gy * 4.0);

          // Diagonal weave: period 6 screen-px, slow drift
          float drift = floor(uTime * 1.5);
          float p1 = mod(sx + sy + drift,          6.0);
          float p2 = mod(sx - sy + drift + 600.0,  6.0);
          float lc = step(p1, 0.5) + step(p2, 0.5);

          // Base blue; very subtle darkening on weave lines
          vec3 col3 = vec3(74.0, 132.0, 214.0) / 255.0;
          col3 -= lc * vec3(7.0, 10.0, 8.0) / 255.0;

          // Per-pixel micro jitter (±2 levels)
          float jh = fract(sin(sx * 127.1 + sy * 311.7) * 43758.5);
          col3 += (jh - 0.5) * (2.0 / 255.0);
          col3 = clamp(col3, 0.0, 1.0);

          // Foam: 1-world-pixel band at land edges
          float lx = mod(gx, uTileW);
          float ly = mod(gy, uTileH);
          float foam = landAbove * step(ly, 0.99)
                     + landLeft  * step(lx, 0.99)
                     + landBelow * step(uTileH - 1.0, ly)
                     + landRight * step(uTileW - 1.0, lx);
          float isFoam = step(0.5, foam);

          // Sparse scatter: ~30% of foam pixels visible
          float fh = fract(sin(sx * 74.7 + sy * 531.3) * 43758.5);
          isFoam *= step(0.70, fh);

          vec3 foamCol = vec3(200.0, 228.0, 255.0) / 255.0;
          col3 = mix(col3, foamCol, isFoam * 0.75);

          gl_FragColor = vec4(col3, 1.0);
        }
      `,
      transparent: true,
    });

    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      waterMaterial
    );
    waterMesh.position.set(worldW / 2, -worldH / 2, 0.001);
    waterMesh.renderOrder = 0;
    scene.add(waterMesh);
    createdObjects.push(waterMesh);
  }

  // Helper to ensure uniform values are JS floats
  function float(v) { return v + 0.0; }

  // ---- Water animation: just update the time uniform ----
  function updateWater(time) {
    if (waterMaterial) waterMaterial.uniforms.uTime.value = time;
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

    // Round canopy via per-pixel circle with Y-based shading
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

        const yFrac     = (py - (cy - radius)) / (radius * 2);
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
