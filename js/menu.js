// ============================================================
//  MENU  — animated background + button logic
// ============================================================

const Menu = (() => {
  // ---- background canvas particles & stars ----
  const STAR_COUNT   = 120;
  const PIXEL_COUNT  = 40;

  let bgCanvas, bgCtx;
  let stars   = [];
  let pixels  = [];
  let rafId   = null;
  let time    = 0;

  // Floating pixel "dust" for atmosphere
  function initParticles(w, h) {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Utils.randInt(1, 2),
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * 0.7 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    }));

    pixels = Array.from({ length: PIXEL_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Utils.randInt(2, 5),
      color: ['#f5c842', '#e84393', '#42d9f5', '#a66cff'][Utils.randInt(0, 3)],
      vy: -(Math.random() * 0.4 + 0.1),
      alpha: Math.random(),
    }));
  }

  function drawBg(w, h) {
    bgCtx.clearRect(0, 0, w, h);

    // Sky gradient
    const grad = bgCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,   '#050510');
    grad.addColorStop(0.5, '#0d0d1a');
    grad.addColorStop(1,   '#0a1a14');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, w, h);

    // Stars
    stars.forEach(s => {
      const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle + time * 0.8));
      bgCtx.fillStyle = `rgba(255,255,240,${a})`;
      bgCtx.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
      s.twinkle += 0.02;
    });

    // Ground plane — oblique perspective hint
    const horizon = h * 0.62;
    const groundGrad = bgCtx.createLinearGradient(0, horizon, 0, h);
    groundGrad.addColorStop(0, 'rgba(20,45,30,0.0)');
    groundGrad.addColorStop(1, 'rgba(20,45,30,0.85)');
    bgCtx.fillStyle = groundGrad;
    bgCtx.fillRect(0, horizon, w, h - horizon);

    // Pixel grid lines on ground (perspective lines)
    bgCtx.strokeStyle = 'rgba(66,217,100,0.07)';
    bgCtx.lineWidth = 1;
    const COLS = 14;
    const vp = { x: w / 2, y: horizon };
    for (let i = 0; i <= COLS; i++) {
      const bx = (w / COLS) * i;
      bgCtx.beginPath();
      bgCtx.moveTo(vp.x, vp.y);
      bgCtx.lineTo(bx, h);
      bgCtx.stroke();
    }
    const ROWS = 8;
    for (let r = 1; r <= ROWS; r++) {
      const t   = r / ROWS;
      const y   = horizon + (h - horizon) * t;
      const xOff = (1 - t) * (w * 0.45);
      bgCtx.beginPath();
      bgCtx.moveTo(xOff, y);
      bgCtx.lineTo(w - xOff, y);
      bgCtx.stroke();
    }

    // Floating pixel dust
    pixels.forEach(p => {
      bgCtx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(time + p.x));
      bgCtx.fillStyle = p.color;
      bgCtx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      p.y += p.vy;
      if (p.y < -p.size) p.y = h + p.size;
      bgCtx.globalAlpha = 1;
    });
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
