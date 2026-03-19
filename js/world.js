// ============================================================
//  WORLD  — tilemap generation & rendering (Stardew-style oblique)
// ============================================================

const World = (() => {
  // ---- tile type constants ----
  const T = {
    GRASS:  0,
    DIRT:   1,
    WATER:  2,
    TREE:   3,
    STONE:  4,
    FLOWER: 5,
    PATH:   6,
  };

  // Tile draw data: [baseColor, topColor, hasTop, topHeight]
  const TILE_DEF = {
    [T.GRASS]:  { base: '#2d6a2d', top: '#3a8c3a', shadow: '#1a3d1a' },
    [T.DIRT]:   { base: '#7a5230', top: '#9a6840', shadow: '#4a2f18' },
    [T.WATER]:  { base: '#1a4d7a', top: '#2066a8', shadow: '#0a2a44', anim: true },
    [T.STONE]:  { base: '#555567', top: '#6e6e82', shadow: '#33333f' },
    [T.PATH]:   { base: '#9a7a50', top: '#b0925e', shadow: '#5a4428' },
    [T.FLOWER]: { base: '#2d6a2d', top: '#3a8c3a', shadow: '#1a3d1a', deco: true },
    [T.TREE]:   { base: '#2d6a2d', top: '#3a8c3a', shadow: '#1a3d1a', tree: true },
  };

  // ---- world config ----
  const TILE_W  = 32;  // screen pixels per tile (before scale)
  const TILE_H  = 32;
  // Tiles fill the full TILE_W × TILE_H area seamlessly.
  // The "front face" is drawn as the bottom quarter *within* the tile.
  const DRAW_W  = TILE_W;
  const DRAW_H  = TILE_H;                      // full tile height
  const FACE_H  = Math.round(TILE_H * 0.28);   // front-face band inside tile

  let mapCols, mapRows, tileMap;

  // ---- procedural map gen ----
  function generate(cols, rows) {
    mapCols = cols;
    mapRows = rows;
    tileMap = [];

    // simple noise-ish map
    for (let r = 0; r < rows; r++) {
      tileMap[r] = [];
      for (let c = 0; c < cols; c++) {
        let t = T.GRASS;

        // border water
        if (r < 2 || r >= rows - 2 || c < 2 || c >= cols - 2) {
          t = T.WATER;
        } else {
          const n = noise(c * 0.18, r * 0.18);
          if (n < 0.22)       t = T.WATER;
          else if (n < 0.34)  t = T.DIRT;
          else if (n < 0.5)   t = T.STONE;
          else if (n < 0.68)  t = T.GRASS;
          else if (n < 0.75)  t = T.FLOWER;
          else if (n < 0.82)  t = T.PATH;
          else                t = T.TREE;
        }

        tileMap[r][c] = t;
      }
    }
  }

  // Simple value noise substitute (no imports needed)
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix,         fy = y - iy;
    const a = hash(ix,     iy    );
    const b = hash(ix + 1, iy    );
    const c2 = hash(ix,    iy + 1);
    const d = hash(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, u), lerp(c2, d, u), v);
  }

  function hash(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- rendering ----
  // Oblique projection: each tile is drawn as a parallelogram.
  // We render back-to-front (painter's algorithm).

  function tileToScreen(col, row, camX, camY, scale) {
    const sx = col * TILE_W * scale - camX;
    const sy = row * TILE_H * scale - camY;
    return { sx, sy };
  }

  function drawTile(ctx, col, row, camX, camY, scale, time) {
    const type = tileMap[row]?.[col];
    if (type === undefined) return;

    const def  = TILE_DEF[type];
    const { sx, sy } = tileToScreen(col, row, camX, camY, scale);

    const dw = DRAW_W * scale;
    const dh = DRAW_H * scale;
    const fh = FACE_H * scale;   // front-face band height (inside tile)

    // Cull off-screen
    if (sx + dw < 0 || sx > ctx.canvas.width) return;
    if (sy + dh < 0 || sy > ctx.canvas.height) return;

    // ---- top face (upper portion of tile) ----
    let topColor = def.top;
    if (def.anim) {
      const wave = Math.sin(time * 2 + col * 0.7 + row * 0.5) * 0.12;
      topColor = shiftHex(def.top, wave);
    }
    ctx.fillStyle = topColor;
    ctx.fillRect(sx, sy, dw, dh - fh);

    // ---- front face band (bottom portion, same tile rect) ----
    ctx.fillStyle = def.shadow;
    ctx.fillRect(sx, sy + dh - fh, dw, fh);

    // ---- subtle top highlight ----
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(sx, sy, dw, 2 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(sx, sy, 2 * scale, dh - fh);

    // ---- decorations ----
    if (def.deco) drawFlower(ctx, sx, sy, dw, dh, scale, time, col, row);
    if (def.tree) drawTree(ctx, sx, sy, dw, dh, scale);
  }

  function drawFlower(ctx, sx, sy, dw, dh, scale, time, col, row) {
    const colors = ['#f5c842', '#e84393', '#42d9f5', '#ff8c42'];
    const clr = colors[(col * 3 + row * 7) % colors.length];
    const cx  = sx + dw * 0.5;
    const cy  = sy + dh * 0.35;
    const r   = Math.max(2, 3 * scale);
    ctx.fillStyle = clr;
    ctx.fillRect(cx - r / 2, cy - r / 2, r, r);
    // stem
    ctx.fillStyle = '#1e5c1e';
    ctx.fillRect(cx - scale / 2, cy + r / 2, scale, dh * 0.3);
  }

  function drawTree(ctx, sx, sy, dw, dh, scale) {
    // trunk
    const tw = Math.max(4, 6 * scale);
    const th = Math.max(6, 14 * scale);
    const tx = sx + (dw - tw) / 2;
    const ty = sy + dh - th * 0.4;
    ctx.fillStyle = '#5a3210';
    ctx.fillRect(tx, ty, tw, th * 0.5);

    // canopy (two layers for depth)
    const cw = Math.max(18, 28 * scale);
    const ch = Math.max(16, 24 * scale);
    const cx = sx + (dw - cw) / 2;
    const cy = sy - ch * 0.5;

    ctx.fillStyle = '#1a4a1a';
    ctx.fillRect(cx + 2 * scale, cy + 4 * scale, cw - 4 * scale, ch);

    ctx.fillStyle = '#267026';
    ctx.fillRect(cx, cy, cw, ch * 0.75);

    ctx.fillStyle = '#33993a';
    ctx.fillRect(cx + 3 * scale, cy, cw - 6 * scale, ch * 0.5);
  }

  // Shift a hex colour by a lightness offset [-1, 1]
  function shiftHex(hex, delta) {
    const n = parseInt(hex.slice(1), 16);
    const r = Utils.clamp(((n >> 16) & 0xff) + Math.round(delta * 60), 0, 255);
    const g = Utils.clamp(((n >> 8)  & 0xff) + Math.round(delta * 60), 0, 255);
    const b = Utils.clamp(( n        & 0xff) + Math.round(delta * 60), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function render(ctx, camX, camY, scale, time) {
    // Determine visible tile range
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
    TILE_W, TILE_H, DRAW_W, DRAW_H,
    generate,
    render,
    tileAt: (col, row) => tileMap[row]?.[col],
    cols: () => mapCols,
    rows: () => mapRows,
    tileToScreen,
  };
})();
