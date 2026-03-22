// ============================================================
//  MENU  — animated background: stars + rotating pixel planet
// ============================================================

const Menu = (() => {
  const STAR_COUNT = 150;

  let bgCanvas, bgCtx;
  let stars  = [];
  let rafId  = null;
  let time   = 0;

  // ---- hash for procedural planet texture ----
  function hash(a, b) {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise2d(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y) {
    return noise2d(x, y) * 0.5 +
           noise2d(x * 2.1, y * 2.1) * 0.3 +
           noise2d(x * 4.3, y * 4.3) * 0.2;
  }

  // ---- stars ----
  function initParticles(w, h) {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Utils.randInt(1, 2),
      blinkSpeed: Math.random() * 1.5 + 0.3,
      blinkOffset: Math.random() * Math.PI * 2,
    }));
  }

  // ---- planet palettes ----
  const LAND_COLORS = [
    [126, 200, 80],   // light green
    [168, 216, 72],   // yellow-green
    [200, 232, 120],  // pale green
    [100, 170, 60],   // darker green
    [80, 145, 50],    // deep green
  ];
  const OCEAN_COLORS = [
    [40, 80, 50],     // dark green-blue
    [50, 95, 60],     // muted green
    [35, 70, 45],     // deep dark
  ];
  const HIGHLIGHT_COLORS = [
    [216, 208, 64],   // yellow
    [232, 224, 104],  // pale yellow
    [240, 230, 140],  // light yellow
  ];

  // ---- planet config ----
  const PLANET_RADIUS = 60;
  const PIXEL_SIZE    = 3;

  function drawPlanet(cx, cy) {
    const r = PLANET_RADIUS;
    // Rotation: shift longitude over time (clockwise = negative direction)
    const rot = -time * 0.15;

    for (let py = -r; py <= r; py += PIXEL_SIZE) {
      for (let px = -r; px <= r; px += PIXEL_SIZE) {
        const dist = Math.sqrt(px * px + py * py);
        if (dist > r) continue;

        // Map pixel to sphere coordinates
        const nx = px / r;
        const ny = py / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

        // Convert to longitude/latitude for texture
        const lon = Math.atan2(nx, nz) + rot;
        const lat = Math.asin(ny);

        // Sample procedural texture
        const texX = lon * 2.5;
        const texY = lat * 2.5;
        const n = fbm(texX, texY);

        let col;
        if (n < 0.35) {
          // Ocean
          const ci = Math.floor(hash(Math.floor(texX * 3), Math.floor(texY * 3)) * OCEAN_COLORS.length);
          col = OCEAN_COLORS[Math.min(ci, OCEAN_COLORS.length - 1)];
        } else if (n > 0.7) {
          // Highlights (mountain/desert)
          const ci = Math.floor(hash(Math.floor(texX * 4), Math.floor(texY * 4)) * HIGHLIGHT_COLORS.length);
          col = HIGHLIGHT_COLORS[Math.min(ci, HIGHLIGHT_COLORS.length - 1)];
        } else {
          // Land
          const ci = Math.floor(hash(Math.floor(texX * 3), Math.floor(texY * 3)) * LAND_COLORS.length);
          col = LAND_COLORS[Math.min(ci, LAND_COLORS.length - 1)];
        }

        // Lighting: simple diffuse from top-right
        const light = Math.max(0.3, nz * 0.6 + nx * 0.2 + 0.4);
        const lr = Math.floor(col[0] * light);
        const lg = Math.floor(col[1] * light);
        const lb = Math.floor(col[2] * light);

        // Edge darkening (atmosphere rim)
        const edge = 1 - Math.pow(dist / r, 3);
        const fr = Math.floor(lr * edge);
        const fg = Math.floor(lg * edge);
        const fb = Math.floor(lb * edge);

        bgCtx.fillStyle = `rgb(${fr},${fg},${fb})`;
        bgCtx.fillRect(cx + px, cy + py, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Atmosphere glow
    const gradient = bgCtx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 12);
    gradient.addColorStop(0, 'rgba(120,220,100,0.0)');
    gradient.addColorStop(0.5, 'rgba(120,220,100,0.08)');
    gradient.addColorStop(1, 'rgba(120,220,100,0.0)');
    bgCtx.fillStyle = gradient;
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, r + 12, 0, Math.PI * 2);
    bgCtx.fill();
  }

  function drawBg(w, h) {
    // Solid black background
    bgCtx.fillStyle = '#000';
    bgCtx.fillRect(0, 0, w, h);

    // Blinking stars
    stars.forEach(s => {
      const blink = Math.sin(time * s.blinkSpeed + s.blinkOffset);
      // Blink fully out when sin < -0.3
      const a = Math.max(0, (blink + 0.3) / 1.3);
      if (a > 0.01) {
        bgCtx.fillStyle = `rgba(255,255,240,${a.toFixed(2)})`;
        bgCtx.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
      }
    });

    // Rotating pixel planet in center
    drawPlanet(Math.floor(w / 2), Math.floor(h / 2));
  }

  function animateBg() {
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    time += 0.016;
    drawBg(w, h);
    rafId = requestAnimationFrame(animateBg);
  }

  // ---- keyboard navigation ----
  const BTNS = ['btn-new-game', 'btn-load'];
  let selectedIdx = 0;

  function updateSelection() {
    BTNS.forEach((id, i) => {
      document.getElementById(id).classList.toggle('selected', i === selectedIdx);
    });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      selectedIdx = (selectedIdx + 1) % BTNS.length;
      updateSelection();
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      selectedIdx = (selectedIdx - 1 + BTNS.length) % BTNS.length;
      updateSelection();
    } else if (e.key === 'Enter' || e.key === ' ') {
      document.getElementById(BTNS[selectedIdx]).click();
    }
  }

  // ---- public API ----

  function show() {
    document.getElementById('main-menu').classList.remove('hidden');
    bgCanvas = document.getElementById('menu-bg-canvas');
    bgCtx    = bgCanvas.getContext('2d');
    resize();
    if (!rafId) animateBg();
    updateSelection();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
  }

  function hide() {
    document.getElementById('main-menu').classList.add('hidden');
    cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
  }

  function resize() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    initParticles(bgCanvas.width, bgCanvas.height);
  }

  return { show, hide };
})();
