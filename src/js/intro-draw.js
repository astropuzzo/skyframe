/* Skyframe, l'intro del logo disegnata fotogramma per fotogramma su un canvas: un campo stellare largo, lo zoom sul
   target, la cornice che si chiude con uno scatto, il logo fermo. Tutto è una funzione del tempo t (ms): lo stesso
   fotogramma esce sempre uguale, e l'ultimo è il logo (#i-logo) con gli stessi tracciati.
   Lo usano la schermata d'avvio (js/intro.js) e la guida.
   Lo zoom è un ingrandimento vero: le stelle restano puntini, si allontanano dal centro e ne compaiono di più deboli. */
self.IntroDraw = (function () {
  const T = 1900, Z0 = 250, Z1 = 1250, ZMAX = 30, LOCK = 1250;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const inOut3 = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const out3 = (u) => 1 - Math.pow(1 - u, 3), in3 = (u) => u * u * u;
  const seg = (t, a, b, from, to, f) => from + (to - from) * f(clamp((t - a) / (b - a), 0, 1));
  const uZ = (t) => clamp((t - Z0) / (Z1 - Z0), 0, 1);
  const Z = (t) => Math.pow(ZMAX, inOut3(uZ(t)));
  // velocità dello zoom (d ln Z / dt, per ms): serve alle scie delle stelle quando si corre
  const V = (t) => { const u = uZ(t); if (u <= 0 || u >= 1) return 0; const d = u < 0.5 ? 12 * u * u : 3 * Math.pow(-2 * u + 2, 2); return Math.log(ZMAX) * d / (Z1 - Z0); };
  // la cornice: distanza degli angoli dalla posizione finale (px) e rotazione (gradi) nel tempo
  function cornerOff(t, D, o) {
    if (t < 500) return D;
    if (t < 1000) return seg(t, 500, 1000, D, 4 * o, out3);           // vola dentro
    if (t < 1102) return seg(t, 1000, 1102, 4 * o, 4.8 * o, inOut3);  // si ferma poco più larga e cerca
    if (t < 1180) return seg(t, 1102, 1180, 4.8 * o, 4 * o, inOut3);
    if (t < LOCK) return seg(t, 1180, LOCK, 4 * o, -o, in3);          // scatta stretta
    if (t < 1358) return seg(t, LOCK, 1358, -o, 0.25 * o, out3);      // rimbalzo
    if (t < 1453) return seg(t, 1358, 1453, 0.25 * o, 0, inOut3);
    return 0;
  }
  const frameRot = (t) => (t < 500 ? -10 : t < 1000 ? seg(t, 500, 1000, -10, 0.8, out3) : t < 1140 ? seg(t, 1000, 1140, 0.8, 0, inOut3) : 0);
  const starPop = (t) => (t < LOCK ? 0 : t < 1340 ? seg(t, LOCK, 1340, 0, 1.8, out3) : seg(t, 1340, 1500, 1.8, 1, inOut3));

  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TINT = [[220, 228, 242], [220, 228, 242], [220, 228, 242], [196, 213, 255], [255, 230, 194], [255, 210, 168]];
  const BAND = -32 * Math.PI / 180;

  /* il campo: le stelle della prima generazione riempiono lo schermo all'inizio; le altre compaiono quando lo zoom
     arriva alla loro soglia z, sparse su tutto lo schermo in quel momento (sono più deboli, più vicine al target) */
  function field(P) {
    const r = rng(20260926), R = Math.max(Math.hypot(P.cx, P.cy), Math.hypot(P.W - P.cx, P.cy), Math.hypot(P.cx, P.H - P.cy), Math.hypot(P.W - P.cx, P.H - P.cy)) * 1.03;
    const k = (P.W * P.H) / (390 * 844), n0 = Math.round(760 * k), n1 = Math.round(2300 * k), stars = [];
    const add = (z, first) => {
      const rr = R / z; let x, y;
      if (first && r() < 0.42) { const u = (r() - 0.5) * 2 * rr, v = (r() + r() + r() - 1.5) * rr * 0.1; x = u * Math.cos(BAND) - v * Math.sin(BAND); y = u * Math.sin(BAND) + v * Math.cos(BAND); }
      else { const a = r() * Math.PI * 2, d = rr * Math.sqrt(r()); x = Math.cos(a) * d; y = Math.sin(a) * d; }
      const m = Math.pow(r(), first ? 2.8 : 3.4);
      stars.push({ x, y, z, rad: 0.42 + m * (first ? 1.7 : 1.3), a: 0.32 + m * 0.68, c: TINT[Math.floor(r() * TINT.length)] });
    };
    for (let i = 0; i < n0; i++) add(1, true);
    for (let i = 0; i < n1; i++) add(Math.exp((0.04 + r() * 0.96) * Math.log(ZMAX * 1.1)), false);
    return { stars, R, sprites: new Map() };
  }
  // una stella già disegnata (nucleo e alone) per ogni colore e grandezza: disegnarne tremila a fotogramma resta leggero
  function sprite(F, c, rad, dpr) {
    const key = c.join() + '|' + Math.round(rad * dpr * 4);
    let s = F.sprites.get(key); if (s) return s;
    const R = Math.max(2, Math.ceil(rad * dpr * 4.5)), cv = new OffscreenCanvas(R * 2, R * 2), g = cv.getContext('2d');
    const gr = g.createRadialGradient(R, R, 0, R, R, R), col = (a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const core = (rad * dpr) / R;
    gr.addColorStop(0, col(1)); gr.addColorStop(clamp(core * 0.7, 0.02, 0.9), col(0.95)); gr.addColorStop(clamp(core * 1.3, 0.05, 0.95), col(0.2)); gr.addColorStop(1, col(0));
    g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
    s = { cv, R }; F.sprites.set(key, s); return s;
  }
  const CORNERS = [[-1, -1, [[5.5, 11], [5.5, 7.5], [9.5, 7.5]]], [1, -1, [[22.5, 7.5], [26.5, 7.5], [26.5, 11]]], [1, 1, [[26.5, 21], [26.5, 24.5], [22.5, 24.5]]], [-1, 1, [[9.5, 24.5], [5.5, 24.5], [5.5, 21]]]];

  /* il logo (unità della griglia 32 del logo, centro in 16,16) */
  function nebula(g, P, d, k, blur, alpha) {
    if (alpha <= 0.003 || k <= 0) return;
    g.save(); g.globalAlpha = alpha; if (blur > 0.2) g.filter = `blur(${blur.toFixed(2)}px)`;
    g.translate(P.cx * d, P.cy * d); g.scale(P.S / 32 * d * k, P.S / 32 * d * k); g.rotate(-24 * Math.PI / 180);
    const gr = g.createLinearGradient(-7.2, -5.6, 7.2, 5.6); gr.addColorStop(0, '#FF7A5E'); gr.addColorStop(1, '#D8353F');
    g.beginPath(); g.ellipse(0, 0, 7.2, 5.6, 0, 0, Math.PI * 2); g.strokeStyle = gr; g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.ellipse(0, 0, 3.9, 2.9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(76,207,188,.85)'; g.fill();
    g.restore();
  }
  function corners(g, P, d, t, glow) {
    const o = P.S * 3 / 112, off = cornerOff(t, P.D, o), rot = frameRot(t) * Math.PI / 180, op = sm(500, 684, t);
    if (op <= 0) return;
    g.save(); g.translate(P.cx * d, P.cy * d); g.rotate(rot);
    for (const [sx, sy, pts] of CORNERS) {
      g.save(); g.translate(sx * off * d, sy * off * d); g.scale(P.S / 32 * d, P.S / 32 * d); g.translate(-16, -16);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.2; g.globalAlpha = op; g.strokeStyle = '#EEF3F9';
      if (glow > 0) { g.shadowColor = `rgba(255,255,255,${glow})`; g.shadowBlur = P.S * 0.16 * d; g.strokeStyle = '#FFFFFF'; }
      g.stroke(); g.restore();
    }
    g.restore();
  }

  /* un fotogramma */
  function frame(g, t, P, F) {
    const d = P.dpr, W = P.W * d, H = P.H * d, z = Z(t), v = V(t);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const gA = sm(0, 250, t) * (1 - sm(1320, 1800, t));
    // la Via Lattea del campo largo: si allarga con lo zoom e sfuma
    const bA = gA * (1 - sm(1.5, 3.4, z));
    if (bA > 0.01) {
      g.save(); g.translate(P.cx * d, P.cy * d); g.rotate(BAND); g.scale(z, z * 0.2);
      const rr = F.R * d, gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      gr.addColorStop(0, `rgba(183,198,230,${0.12 * bA})`); gr.addColorStop(0.5, `rgba(130,149,196,${0.05 * bA})`); gr.addColorStop(1, 'rgba(124,143,192,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // stelle: puntini che si allontanano dal centro; quando lo zoom corre lasciano una scia
    if (gA > 0.003) {
      const cx = P.cx * d, cy = P.cy * d, ex = 7; // «esposizione» della scia (ms): un filo di mosso, non l'iperspazio
      g.lineCap = 'round';
      for (const s of F.stars) {
        const ap = s.z <= 1 ? 1 : sm(s.z, s.z * 1.45, z); if (ap <= 0) continue;
        const X = cx + s.x * z * d, Y = cy + s.y * z * d;
        if (X < -8 || Y < -8 || X > W + 8 || Y > H + 8) continue;
        const a = s.a * ap * gA, len = Math.hypot(s.x, s.y) * z * v * ex * d;
        if (len > 1.6 * d) {
          const k = len / (Math.hypot(s.x, s.y) * z * d);
          g.globalAlpha = a * 0.7; g.strokeStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`; g.lineWidth = s.rad * 1.6 * d;
          g.beginPath(); g.moveTo(cx + (X - cx) * (1 - k), cy + (Y - cy) * (1 - k)); g.lineTo(X, Y); g.stroke();
        } else {
          const sp = sprite(F, s.c, s.rad, d); g.globalAlpha = a; g.drawImage(sp.cv, X - sp.R, Y - sp.R);
        }
      }
      g.globalAlpha = 1;
    }
    // lampo dello scatto
    if (t > LOCK && t < 1520) {
      const p = (t - LOCK) / (1520 - LOCK), a = (p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88) * 0.5, rr = P.S * 1.1 * (0.45 + 0.9 * out3(p)) * d;
      const gr = g.createRadialGradient(P.cx * d, P.cy * d, 0, P.cx * d, P.cy * d, rr);
      gr.addColorStop(0, `rgba(255,255,255,${0.55 * a})`); gr.addColorStop(0.38, `rgba(190,240,232,${0.18 * a})`); gr.addColorStop(1, 'rgba(190,240,232,0)');
      g.fillStyle = gr; g.fillRect(P.cx * d - rr, P.cy * d - rr, rr * 2, rr * 2);
    }
    // il target: sfocato finché la cornice non aggancia, poi a fuoco
    const k = z / ZMAX, nA = 0.35 + 0.65 * sm(0.03, 0.2, k), f = sm(1180, 1300, t);
    nebula(g, P, d, k, P.S * 0.05 * d * (0.4 + 0.6 * k), nA * (1 - f));
    nebula(g, P, d, k, 0, nA * f);
    // cornice, e il suo bagliore allo scatto
    const glow = t > LOCK && t < 1600 ? (t < 1280 ? (t - LOCK) / 30 : 1 - (t - 1280) / 320) * 0.9 : 0;
    if (glow > 0.01) corners(g, P, d, t, glow);
    corners(g, P, d, t, 0);
    // la stella al centro
    const sp = starPop(t);
    if (sp > 0) { g.save(); g.globalAlpha = sm(LOCK, 1273, t); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(P.cx * d, P.cy * d, P.S / 32 * d * sp, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  return { T, LOCK, Z, V, cornerOff, frameRot, starPop, field, frame };
})();
