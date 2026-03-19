// ============================================================
//  UTILS  — shared helpers
// ============================================================

const Utils = (() => {
  /** Linear interpolation */
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Clamp a value between min and max */
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /** Return a random integer in [min, max] inclusive */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Convert screen coords to oblique-tile grid coords.
   *  tileW/tileH are the full tile dimensions (e.g. 16x16).
   *  The camera offset (camX, camY) is the world-space position
   *  currently at the top-left of the canvas. */
  function screenToTile(sx, sy, camX, camY, tileW, tileH) {
    const wx = sx + camX;
    const wy = sy + camY;
    return {
      col: Math.floor(wx / tileW),
      row: Math.floor(wy / tileH),
    };
  }

  return { lerp, clamp, randInt, screenToTile };
})();
