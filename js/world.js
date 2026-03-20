// ============================================================
//  WORLD  — 16×16 pixel-art tiles, texture cache, Stardew-style
// ============================================================

const World = (() => {
  // ---- tile type constants ----
  const T = { GRASS: 0, DIRT: 1, WATER: 2, TREE: 3, STONE: 4, FLOWER: 5, PATH: 6 };

  // ---- tile dimensions (logical pixels before scale) ----
  const TILE_W = 16;
  const TILE_H = 16;

  // ---- 5-shade palettes  [dark → bright]  [R, G, B] ----
  const PAL = {
    [T.GRASS]:  [[40, 74, 32], [54, 96, 42], [66, 118, 52], [82, 142, 66], [98, 164, 80]],
    [T.DIRT]:   [[88, 56, 30], [112, 76, 46], [136, 96, 60], [158, 118, 78], [178, 140, 96]],
    [T.WATER]:  [[16, 48, 104], [24, 68, 144], [34, 94, 178], [52, 126, 210], [80, 164, 238]],
    [T.STONE]:  [[66, 66, 80], [86, 88, 104], [108, 110, 128], [130, 132, 152], [154, 156, 176]],
    [T.PATH]:   [[108, 82, 48], [136, 106, 66], [160, 128, 82], [184, 152, 104], [204, 174, 124]],
  };
  PAL[T.FLOWER] = PAL[T.GRASS];
  PAL[T.TREE]   = PAL[T.GRASS];

  // ---- noise → palette index distributions ----
  function palIdx(n, type) {
    switch (type) {
      case T.GRASS: case T.FLOWER: case T.TREE:
        if (n < 0.05) return 0;
        if (n < 0.20) return 1;
        if (n < 0.64) return 2;
        if (n < 0.86) return 3;
        return 4;
      case T.DIRT:
        if (n < 0.06) return 0;
        if (n < 0.22) return 1;
        if (n < 0.68) return 2;
        if (n < 0.88) return 3;
        return 4;
      case T.WATER:
        if (n < 0.12) return 0;
        if (n < 0.32) return 1;
        if (n < 0.65) return 2;
        if (n < 0.85) return 3;
        return 4;
      case T.STONE:
        if (n < 0.08) return 0;
        if (n < 0.26) return 1;
        if (n < 0.64) return 2;
        if (n < 0.84) return 3;
        return 4;
      case T.PATH:
        if (n < 0.05) return 0;
        if (n < 0.18) return 1;
        if (n < 0.60) return 2;
        if (n < 0.82) return 3;
        return 4;
      default: return 2;
    }
  }

  // Deterministic per-pixel hash → [0, 1)
  function pxHash(a, b, c, d) {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + d * 531.3) * 43758.5453;
    return x - Math.floor(x);
  }

  function clampByte(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  // ---- tile texture cache ----
  const tileCache  = new Map();
  const NUM_VARIANTS = 8;

  function getTileCanvas(type, variant) {
    const key = type * 100 + variant;
    if (tileCache.has(key)) return tileCache.get(key);

    const cv  = document.createElement('canvas');
    cv.width  = TILE_W;
    cv.height = TILE_H;
    const cx  = cv.getContext('2d');

    buildTexture(cx, type, variant);
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

        // Primary noise for colour index
        const n  = pxHash(px, py, variant, type);
        const ci = palIdx(n, type);
        let [r, g, b] = pal[ci];

        // Secondary fine-grain noise for micro-variation (±5 per channel)
        const n2 = pxHash(px + 17, py + 31, variant ^ 5, type ^ 3);
        const v  = Math.round((n2 - 0.5) * 10);
        r = clampByte(r + v);
        g = clampByte(g + v);
        b = clampByte(b + v);

        d[i]   = r;
        d[i+1] = g;
        d[i+2] = b;
        d[i+3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    if (type === T.FLOWER) addFlowerDecal(ctx, variant);
  }

  function addFlowerDecal(ctx, variant) {
    const cols = ['#f5c842', '#e84393', '#ff6688', '#42d9f5', '#ff8c42', '#cc66ff'];
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
    mapCols = cols;
    mapRows = rows;
    tileMap = [];
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
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a  = hash(ix,     iy    );
    const b  = hash(ix + 1, iy    );
    const c2 = hash(ix,     iy + 1);
    const d  = hash(ix + 1, iy + 1);
    const u  = fx * fx * (3 - 2 * fx);
    const v  = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d, u), v);
  }

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- tile rendering ----
  function tileToScreen(col, row, camX, camY, scale) {
    return { sx: col * TILE_W * scale - camX, sy: row * TILE_H * scale - camY };
  }

  function drawTile(ctx, col, row, camX, camY, scale, time) {
    const type = tileMap[row]?.[col];
    if (type === undefined) return;

    const { sx, sy } = tileToScreen(col, row, camX, camY, scale);
    const dw = TILE_W * scale;
    const dh = TILE_H * scale;

    if (sx + dw < 0 || sx > ctx.canvas.width)  return;
    if (sy + dh < 0 || sy > ctx.canvas.height) return;

    if (type === T.WATER) {
      drawWater(ctx, sx, sy, dw, dh, scale, time);
    } else {
      const variant = Math.floor(pxHash(col, row, 0, type) * NUM_VARIANTS);
      ctx.drawImage(getTileCanvas(type, variant), sx, sy, dw, dh);
    }

    if (type === T.TREE) drawTree(ctx, sx, sy, dw, dh, scale);
  }

  function drawWater(ctx, sx, sy, dw, dh, scale, time) {
    const w = PAL[T.WATER];
    // Base fill
    ctx.fillStyle = `rgb(${w[2][0]},${w[2][1]},${w[2][2]})`;
    ctx.fillRect(sx, sy, dw, dh);

    // Animated shimmer lines (horizontal, move upward)
    const spacing = Math.max(4, Math.round(dh * 0.38));
    const offset  = (time * 14 * scale) % spacing;
    ctx.fillStyle = `rgba(${w[4][0]},${w[4][1]},${w[4][2]},0.30)`;
    const lineH   = Math.max(1, scale);
    for (let ly = -spacing + offset; ly < dh + spacing; ly += spacing) {
      const ry = Math.round(sy + ly);
      ctx.fillRect(sx + dw * 0.08, ry, dw * 0.84, lineH);
    }

    // Deep-water tint at bottom
    ctx.fillStyle = `rgba(${w[0][0]},${w[0][1]},${w[0][2]},0.28)`;
    ctx.fillRect(sx, sy + dh * 0.75, dw, dh * 0.25);
  }

  function drawTree(ctx, sx, sy, dw, dh, scale) {
    const p = Math.round;
    // Trunk
    const tw = Math.max(3, p(4 * scale));
    const th = Math.max(4, p(7 * scale));
    const tx = sx + (dw - tw) / 2;
    const ty = sy + dh - th;
    ctx.fillStyle = '#4a2808';
    ctx.fillRect(tx, ty, tw, th);

    // Canopy — 3 rectangular layers (darkest bottom → brightest top)
    const cw = p(26 * scale);
    const ch = p(20 * scale);
    const cx = sx + (dw - cw) / 2;
    const cy = sy - p(ch * 0.6);

    ctx.fillStyle = '#1c4820';   // shadow base
    ctx.fillRect(cx + scale, cy + p(ch * 0.3), cw - scale * 2, p(ch * 0.7));

    ctx.fillStyle = '#2a6e30';   // mid
    ctx.fillRect(cx, cy + p(ch * 0.14), cw, p(ch * 0.62));

    ctx.fillStyle = '#3a9040';   // top highlight
    ctx.fillRect(cx + scale * 2, cy, cw - scale * 4, p(ch * 0.5));

    // Bright accent pixels
    ctx.fillStyle = '#50b456';
    ctx.fillRect(cx + p(cw * 0.28), cy + scale, p(scale * 3), p(scale * 2));
    ctx.fillRect(cx + p(cw * 0.56), cy, p(scale * 2), p(scale * 2));
  }

  // ---- render loop ----
  function render(ctx, camX, camY, scale, time) {
    const startCol = Math.max(0, Math.floor(camX / (TILE_W * scale)) - 1);
    const startRow = Math.max(0, Math.floor(camY / (TILE_H * scale)) - 1);
    const endCol   = Math.min(mapCols - 1, startCol + Math.ceil(ctx.canvas.width  / (TILE_W * scale)) + 2);
    const endRow   = Math.min(mapRows - 1, startRow + Math.ceil(ctx.canvas.height / (TILE_H * scale)) + 2);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        drawTile(ctx, c, r, camX, camY, scale, time);
      }
    }
  }

  // ---- public API ----
  return {
    T,
    TILE_W, TILE_H,
    generate,
    render,
    tileAt:       (col, row) => tileMap[row]?.[col],
    cols:         () => mapCols,
    rows:         () => mapRows,
    tileToScreen,
  };
})();
