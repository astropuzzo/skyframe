'use strict';
/* ============================ orizzonte misurato col telefono ============================
   La fotocamera fa da mirino e i sensori di orientamento dicono dove punta: azimut e altezza del centro dell'immagine.
   Si segue il profilo degli ostacoli (tenendo premuto: una traccia; un tocco sul pulsante o sull'immagine: un punto) e i
   punti diventano l'orizzonte del luogo. Dalla fotocamera non si salva e non si manda niente.
   Quello che si è segnato resta disegnato sul paesaggio mentre il telefono si muove, insieme alla linea dell'orizzonte coi
   punti cardinali, all'orizzonte di prima e al Sole: serve il campo inquadrato, che arriva dai dati della fotocamera.
   I punti si tengono nel riferimento del giroscopio, che è fermo rispetto al paesaggio; il nord è un numero solo per tutta
   la misura. Vicino a ringhiere e cemento armato la bussola del telefono sbaglia anche di 10°: il mirino si può allineare
   al Sole o alla Luna, di cui si conosce l'azimut vero. Senza allineamento vale la media della bussola su tutto il giro,
   corretta della declinazione magnetica dove il telefono la sa calcolare (Android). */
const HZS_GAP = 60, HZS_STEP = 1.5; // oltre 60° senza punti resta l'orizzonte di prima; passo della traccia (gradi)
const HZS_FOV = 66;                 // campo sul lato lungo di una fotocamera principale tipica, quando il telefono non lo dice
const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

/* Rotazione dal telefono al mondo (est, nord, su) dagli angoli di DeviceOrientation, come la definisce il W3C:
   Rz(alpha)·Rx(beta)·Ry(gamma). Assi del telefono: x verso la destra dello schermo, y verso l'alto, z verso chi guarda. */
function hzRot(alpha, beta, gamma) {
  const a = alpha * D2R, b = beta * D2R, g = gamma * D2R, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b), sg = Math.sin(g), cg = Math.cos(g);
  return [[ca * cg - sa * sb * sg, -cb * sa, cg * sa * sb + ca * sg], [cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb], [-cb * sg, sb, cb * cg]];
}
/* dove guarda la fotocamera posteriore: lungo −z del telefono, comunque lo si tenga */
function aimVec(alpha, beta, gamma) { const R = hzRot(alpha, beta, gamma); return [-R[0][2], -R[1][2], -R[2][2]]; }
const aimOf = (v) => ({ az: norm360(Math.atan2(v[0], v[1]) * R2D), alt: Math.asin(clamp(v[2], -1, 1)) * R2D });
/* distanza in cielo fra due puntamenti vicini, gradi */
const aimSep = (a, b) => Math.hypot(wrap180(a.az - b.az) * Math.cos(a.alt * D2R), a.alt - b.alt);

/* Dal cielo allo schermo e ritorno. V è la vista del momento: R (hzRot), off = gradi da aggiungere all'azimut dei sensori
   per avere quello vero, ang = rotazione dello schermo (screen.orientation.angle: 90 = telefono girato in senso antiorario),
   f = focale in pixel dello schermo, cx e cy = centro dell'immagine.
   hzProject: [x, y] di un punto (azimut vero, altezza), o null se sta dietro la fotocamera. */
function hzProject(V, az, alt) {
  const A = (az - V.off) * D2R, h = alt * D2R, ch = Math.cos(h), e = Math.sin(A) * ch, n = Math.cos(A) * ch, u = Math.sin(h), R = V.R;
  const x = R[0][0] * e + R[1][0] * n + R[2][0] * u, y = R[0][1] * e + R[1][1] * n + R[2][1] * u, z = R[0][2] * e + R[1][2] * n + R[2][2] * u;
  if (z > -0.08) return null;
  const t = V.ang * D2R, c = Math.cos(t), s = Math.sin(t);
  return [V.cx + V.f * (c * x - s * y) / -z, V.cy - V.f * (s * x + c * y) / -z];
}
/* hzUnproject: azimut vero e altezza del punto dello schermo (x, y) */
function hzUnproject(V, px, py) {
  const sx = (px - V.cx) / V.f, sy = (V.cy - py) / V.f, t = V.ang * D2R, c = Math.cos(t), s = Math.sin(t), x = c * sx + s * sy, y = -s * sx + c * sy, R = V.R;
  const e = R[0][0] * x + R[0][1] * y - R[0][2], n = R[1][0] * x + R[1][1] * y - R[1][2], u = R[2][0] * x + R[2][1] * y - R[2][2], k = Math.hypot(e, n, u), a = aimOf([e / k, n / k, u / k]);
  return { az: norm360(a.az + V.off), alt: a.alt };
}
/* Campo inquadrato sul lato lungo dell'immagine, dai dati della fotocamera: focale e lato del sensore in millimetri,
   use = quanta parte del sensore lavora. Fuori da 35°–100° il dato non è credibile: vale quello tipico, segnato come non noto. */
function hzFov(cam) {
  const f = cam ? +cam.focal : 0, side = cam ? Math.max(+cam.w, +cam.h) * (cam.use > 0.5 && cam.use <= 1 ? +cam.use : 1) : 0;
  const deg = f > 0 && side > 0 ? 2 * Math.atan(side / (2 * f)) * R2D : NaN, known = deg >= 35 && deg <= 100;
  return { deg: known ? deg : HZS_FOV, known };
}

/* Sole e Luna adesso visti dal luogo: azimut vero e altezza */
function skyRefs(site, ms) {
  const lat = +site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), J = jd(ms), lst = lstDeg(ms, +site.lon);
  const s = sunPos(J), m = moonPos(J), sa = altaz(s.ra, s.dec, lst, sL, cL), ma = altaz(m.ra, m.dec, lst, sL, cL);
  return { sun: { alt: sa[0], az: sa[1] }, moon: { alt: moonTopo(ma[0]), az: ma[1], ill: moonIllum(J).k } };
}
/* a cosa allineare il mirino: il Sole se è alto almeno 3°, altrimenti la Luna se è alta e si vede bene */
function skyRef(site, ms) {
  const r = skyRefs(site, ms);
  return r.sun.alt >= 3 ? { who: 'sun', ...r.sun } : r.moon.alt >= 5 && r.moon.ill >= 0.15 ? { who: 'moon', ...r.moon } : null;
}

/* toglie i punti che stanno già sulla retta fra i vicini (Douglas-Peucker sull'altezza) */
function hzThin(P, tol) {
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length), st = [[0, P.length - 1]]; keep[0] = keep[P.length - 1] = 1;
  while (st.length) {
    const [i, j] = st.pop(); let worst = 0, k = -1;
    for (let m = i + 1; m < j; m++) { const t = (P[m][0] - P[i][0]) / ((P[j][0] - P[i][0]) || 1), d = Math.abs(P[m][1] - (P[i][1] + (P[j][1] - P[i][1]) * t)); if (d > worst) { worst = d; k = m; } }
    if (worst > tol) { keep[k] = 1; st.push([i, k], [k, j]); }
  }
  return P.filter((_, m) => keep[m]);
}
/* I punti misurati diventano il profilo: per ogni grado di azimut vale il più alto (un ostacolo copre quello che ha
   sotto) e due punti si uniscono solo se distano meno di HZS_GAP. Dove non si è misurato resta l'orizzonte di prima.
   Ritorna { pts: [[azimut, altezza]], measured: un 1 per ogni grado misurato }. */
function scanToHorizon(points, old) {
  const bin = new Float32Array(360).fill(-1), measured = new Uint8Array(360);
  for (const p of points) { const a = Math.round(norm360(p.az)) % 360; bin[a] = Math.max(bin[a], clamp(p.alt, 0, 90)); }
  const idx = []; for (let a = 0; a < 360; a++) if (bin[a] >= 0) idx.push(a);
  const prev = (old || []).filter((p) => isFinite(p[0]) && isFinite(p[1])).map((p) => [norm360(+p[0]), +p[1]]);
  if (!idx.length) return { pts: prev, measured };
  const lut = horizonLUT(prev), out = [];
  idx.forEach((a, i) => {
    const b = idx[(i + 1) % idx.length], gap = idx.length > 1 ? (b - a + 360) % 360 : 360;
    out.push([a, bin[a]]); measured[a] = 1;
    if (gap <= HZS_GAP) { for (let k = 1; k < gap; k++) measured[(a + k) % 360] = 1; return; }
    // tratto non misurato: l'orizzonte di prima, agganciato a un grado dai punti misurati perché non si mescoli con loro
    const a1 = (a + 1) % 360, b1 = (b + 359) % 360, span = (b1 - a1 + 360) % 360;
    out.push([a1, lut[a1]]);
    for (const p of prev) { const d = (p[0] - a1 + 360) % 360; if (d > 0 && d < span) out.push(p); }
    if (span > 0) out.push([b1, lut[b1]]);
  });
  const byAz = new Map(); for (const p of out) byAz.set(Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10);
  return { pts: hzThin([...byAz.entries()].sort((x, y) => x[0] - y[0]), 0.35), measured };
}

/* ---------- la schermata ---------- */
const HZS = { el: null, saved: null }; // saved: i punti di una misura chiusa senza «Fine», per riprenderla
/* nell'app Android c'è sempre; nel browser solo dove lo schermo si tocca (un telefono con un mouse collegato dichiara un
   puntatore fine: per questo non si guarda quello) */
const hzScanAvailable = () => !DESK && 'DeviceOrientationEvent' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && (!!(window.cielo && window.cielo.platform === 'android') || navigator.maxTouchPoints > 0);

async function hzScanOpen() {
  if (HZS.el || !draft) return;
  readForm();
  const site = { lat: +draft.site.lat, lon: +draft.site.lon }, old = (draft.horizon || []).map((p) => p.slice()), opener = document.activeElement;
  const el = document.createElement('div'); el.className = 'hzs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', tx('Misura dell’orizzonte'));
  el.innerHTML = `<div class="hzs-view" data-view>
      <video class="hzs-video" playsinline muted autoplay></video>
      <canvas class="hzs-ar" data-ar aria-hidden="true"></canvas>
      <svg class="hzs-aim" viewBox="0 0 120 120" aria-hidden="true"><g class="halo"><path d="M8 60h40M72 60h40M60 8v40M60 72v40"/><circle cx="60" cy="60" r="4"/></g><g><path d="M8 60h40M72 60h40M60 8v40M60 72v40"/><circle cx="60" cy="60" r="4"/></g></svg>
      <div class="hzs-read" data-read hidden><b class="num" data-az></b><span data-dir></span><b class="num" data-alt></b></div>
      <div class="hzs-top">
        <button type="button" class="hzs-x" data-x aria-label="${tx('Chiudi')}">${ic('x')}</button>
        <div class="hzs-refs"><button type="button" class="hzs-cal" data-cal hidden></button><span class="hzs-ref" data-ref></span></div>
      </div>
    </div>
    <div class="hzs-bot">
      <p class="hzs-msg" data-msg role="status"></p>
      <button type="button" class="btn sm" data-retry hidden>${tx('Riprova')}</button>
      <canvas class="hzs-strip" data-strip aria-hidden="true"></canvas>
      <div class="hzs-row">
        <button type="button" class="btn ghost" data-undo disabled>${tx('Annulla')}</button>
        <button type="button" class="hzs-mark" data-mark aria-label="${tx('Segna')}"><i></i></button>
        <button type="button" class="btn primary" data-done disabled>${tx('Fine')}</button>
      </div>
    </div>`;
  const q = (s) => el.querySelector(s), video = q('video'), strip = q('[data-strip]'), mark = q('[data-mark]'), ar = q('[data-ar]'), viewEl = q('[data-view]');
  const keep = HZS.saved && HZS.saved.id === draft.id && Date.now() - HZS.saved.at < 30 * 60e3 ? HZS.saved.strokes : [];
  const S = Object.assign(HZS, { el, site, old, strokes: keep, saved: null, rel: null, abs: null, relR: null, absR: null, v: null, offS: 0, offC: 0, offN: 0, offOk: false, offT: 0, decl: null, acc: -1, cal: null, hold: false, last: null, cam: 'wait', stream: null, fov: hzFov(null), raf: 0, t0: Date.now(), evN: 0, say: '', sayAt: 0, res: null, resOff: null, rev: 0, shown: {}, ref: null, refAt: 0, vAt: 0, vSrc: null, applied: false });
  const css = getComputedStyle(document.documentElement), col = (n) => css.getPropertyValue(n).trim();
  const C = { ink2: col('--ink-2'), line: col('--line-3'), dim: col('--ink-3'), acc: col('--accent'), sun: col('--sii') };
  const oldLut = old.length ? horizonLUT(old) : null;
  const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* niente */ } };

  /* ---- sensori ---- */
  const onOri = (e) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    const R = hzRot(e.alpha, e.beta, e.gamma), v = [-R[0][2], -R[1][2], -R[2][2]], abs = e.type === 'deviceorientationabsolute' || e.absolute === true; S.evN++;
    if (abs) { S.abs = v; S.absR = R; } else { S.rel = v; S.relR = R; }
    // Di quanto la bussola è ruotata rispetto al giroscopio: media nel tempo, lontano dallo zenit dove l'azimut non si legge.
    // Il browser manda un evento solo quando l'orientamento cambia: a telefono fermo ne arrivano pochi, la prima coppia si
    // prende da qualunque dei due.
    if (S.rel && S.abs && (abs || !S.offOk) && Math.abs(S.abs[2]) < 0.9 && Math.abs(S.rel[2]) < 0.9) {
      // appena accesa la bussola si sta ancora assestando: dopo un secondo e mezzo la media riparte da capo
      const now = Date.now(); if (!S.offT) S.offT = now; else if (S.offT > 0 && now - S.offT > 1500) { S.offT = -1; S.offN = 0; }
      const d = (aimOf(S.abs).az - aimOf(S.rel).az) * D2R, k = Math.max(1 / 4000, 1 / ++S.offN); S.offS += (Math.sin(d) - S.offS) * k; S.offC += (Math.cos(d) - S.offC) * k; S.offOk = true;
    }
  };
  const src = () => (S.rel ? 'rel' : S.abs ? 'abs' : null);
  /* il nord: { off = gradi da aggiungere all'azimut dei sensori (null se non c'è un riferimento), ref = da dove viene } */
  const north = () => {
    const s = src(), mag = S.decl == null ? 'mag' : 'compass'; if (!s) return null;
    if (S.cal && S.cal.src === s) return { off: S.cal.off, ref: S.cal.who };
    if (s === 'abs') return { off: S.decl || 0, ref: mag };
    if (S.abs && S.offOk) return { off: Math.atan2(S.offS, S.offC) * R2D + (S.decl || 0), ref: mag };
    return { off: null, ref: 'none' };
  };
  /* il puntamento: quello dei sensori così com'è per i punti, la media corta (S.v) per i numeri sullo schermo */
  const aimFrom = (v) => { const nn = north(); if (!nn || !v) return null; const a = aimOf(v); return { az: nn.off == null ? null : norm360(a.az + nn.off), alt: a.alt, ref: nn.ref }; };
  const aimNow = () => aimFrom(S.v), aimRaw = () => aimFrom(S.rel || S.abs);
  /* I punti stanno nel riferimento dei sensori (b = azimut lì): restano fermi sul paesaggio anche mentre la stima del nord
     si aggiusta. L'azimut vero si calcola quando serve; quelli ripresi da una misura chiusa arrivano già col loro (az). */
  const offNow = () => { const nn = north(); return nn ? nn.off : null; };
  const truePts = (off) => S.strokes.map((st) => st.map((p) => (p.b == null ? { az: p.az, alt: p.alt } : off == null ? null : { az: norm360(p.b + off), alt: p.alt })).filter(Boolean));
  const refresh = () => { S.resOff = offNow(); S.res = scanToHorizon(truePts(S.resOff).flat(), S.old); S.rev++; };
  /* la vista per disegnare sull'immagine; null finché manca il nord */
  const view = () => {
    const nn = north(), R = S.rel ? S.relR : S.absR, W = viewEl.clientWidth, H = viewEl.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
    if (!nn || nn.off == null || !R || !W || !H) return null;
    // l'immagine riempie il riquadro tagliando il lato che avanza: il suo lato lungo, in pixel dello schermo
    const long = vw && vh ? Math.max(vw, vh) * Math.max(W / vw, H / vh) : Math.max(W, H);
    return { R, off: nn.off, ang: (screen.orientation && screen.orientation.angle) || 0, f: long / 2 / Math.tan(S.fov.deg * D2R / 2), cx: W / 2, cy: H / 2, W, H };
  };
  const say = (t) => { S.say = t; S.sayAt = Date.now(); };
  const align = () => {
    const ref = skyRef(S.site, Date.now()), s = src(), base = S.rel || S.abs; if (!ref || !s || !base) return;
    const a = aimOf(base);
    // l'altezza non dipende dalla bussola: se non torna, nel mirino non c'è il Sole
    if (Math.abs(a.alt - ref.alt) > 6) { say(tx(ref.who === 'sun' ? 'Il Sole è a {h}° di altezza, il mirino a {a}°' : 'La Luna è a {h}° di altezza, il mirino a {a}°', { h: Math.round(ref.alt), a: Math.round(a.alt) })); return; }
    S.cal = { off: wrap180(ref.az - a.az), who: ref.who, src: s };
    S.say = ''; refresh(); buzz();
  };

  /* ---- punti ---- */
  const add = (start) => {
    const a = aimRaw(); if (!a || a.az == null || a.alt > 80) return false;
    const b = aimOf(S.rel || S.abs);
    if (start) S.strokes.push([]);
    S.strokes[S.strokes.length - 1].push({ b: b.az, alt: b.alt }); S.last = b; refresh();
    return true;
  };
  let pressed = false;
  mark.addEventListener('pointerdown', (e) => { e.preventDefault(); try { mark.setPointerCapture(e.pointerId); } catch { /* niente */ } pressed = true; if (add(true)) { S.hold = true; buzz(); mark.classList.add('on'); } });
  const release = () => { S.hold = false; mark.classList.remove('on'); setTimeout(() => { pressed = false; }, 350); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => mark.addEventListener(n, release));
  // da tastiera (Invio, Spazio) arriva solo il click: un punto
  mark.addEventListener('click', () => { if (pressed) { pressed = false; return; } if (add(true)) buzz(); });
  // un tocco sull'immagine mette il punto lì: fuori dal centro serve il campo inquadrato vero, non quello tipico
  viewEl.addEventListener('click', (e) => {
    if (e.target.closest('button') || !S.fov.known) return;
    const V = view(); if (!V) return;
    const r = viewEl.getBoundingClientRect(), p = hzUnproject(V, e.clientX - r.left, e.clientY - r.top); if (p.alt > 80) return;
    S.strokes.push([{ b: norm360(p.az - V.off), alt: p.alt }]); S.last = null; refresh(); buzz();
  });
  q('[data-undo]').onclick = () => { S.strokes.pop(); S.last = null; refresh(); };
  q('[data-cal]').onclick = align;

  /* ---- fotocamera ---- */
  const stopCam = () => { if (S.stream) S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; video.srcObject = null; };
  /* il campo inquadrato della fotocamera che il browser ha scelto: la chiama «camera2 0, facing back», dove il numero è
     la posizione nell'elenco delle fotocamere di Android */
  const readFov = async (label) => {
    const cp = window.cielo && window.cielo.compass; if (!cp || !cp.cameras) return;
    const list = await cp.cameras(), n = (/camera2?\s+(\d+)/i.exec(label || '') || [])[1], cam = list.find((c) => String(c.index) === n) || list.find((c) => c.back);
    if (HZS.el === el && cam) S.fov = hzFov(cam);
  };
  const startCam = async () => {
    S.cam = 'wait';
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (HZS.el !== el || document.hidden) { st.getTracks().forEach((t) => t.stop()); return; }
      S.stream = st; video.srcObject = st; try { await video.play(); } catch { /* parte da sola con autoplay */ }
      S.cam = 'on'; S.label = (st.getVideoTracks()[0] || {}).label || ''; readFov(S.label).catch(() => {});
    } catch { S.cam = 'off'; }
  };
  q('[data-retry]').onclick = startCam;

  /* ---- disegno ---- */
  const set = (key, val, fn) => { if (S.shown[key] !== val) { S.shown[key] = val; fn(val); } };
  const drawStrip = (a) => {
    const w = strip.clientWidth, h = strip.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1); if (!w || !h) return;
    if (strip.width !== Math.round(w * dpr) || strip.height !== Math.round(h * dpr)) { strip.width = Math.round(w * dpr); strip.height = Math.round(h * dpr); }
    const c = strip.getContext('2d'), H = h - 17, X = (az) => az / 360 * w, Y = (alt) => H - clamp(alt, 0, 60) / 60 * (H - 5);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.font = '600 11px "Saira Condensed", "Arial Narrow", sans-serif'; c.textBaseline = 'alphabetic';
    for (let i = 0; i <= 8; i++) {
      const x = Math.min(w - 1, Math.round(X(i * 45))); c.fillStyle = C.line; c.fillRect(x, 0, 1, H);
      c.fillStyle = C.ink2; c.textAlign = i === 0 ? 'left' : i === 8 ? 'right' : 'center'; c.fillText(AZN[i % 8], x + (i === 0 ? 2 : i === 8 ? -2 : 0), h - 3);
    }
    // il profilo che ne uscirebbe: il tratto misurato nel colore dell'app, il resto com'era
    const lut = horizonLUT(S.res.pts), M = S.res.measured;
    c.beginPath(); c.moveTo(0, H); for (let d = 0; d <= 360; d++) c.lineTo(X(d), Y(lut[d])); c.lineTo(w, H); c.closePath(); c.globalAlpha = 0.16; c.fillStyle = C.dim; c.fill(); c.globalAlpha = 1;
    c.lineWidth = 1.5; c.lineJoin = 'round';
    for (const on of [0, 1]) {
      c.strokeStyle = on ? C.acc : C.dim; c.beginPath();
      for (let d = 0; d < 360; d++) if ((M[d] && M[(d + 1) % 360] ? 1 : 0) === on) { c.moveTo(X(d), Y(lut[d])); c.lineTo(X(d + 1), Y(lut[d + 1])); }
      c.stroke();
    }
    c.fillStyle = C.acc; for (const p of truePts(S.resOff).flat()) c.fillRect(X(p.az) - 1, Y(p.alt) - 1, 2, 2);
    if (a && a.az != null) { const x = X(a.az); c.fillStyle = '#fff'; c.fillRect(Math.round(x), 0, 1, H); c.beginPath(); c.arc(x, Y(Math.max(0, a.alt)), 3, 0, 2 * Math.PI); c.fill(); }
  };
  /* Sull'immagine, ancorati al paesaggio: la linea dell'orizzonte coi cardinali, l'orizzonte di prima (tratteggiato), quello
     che si è segnato, il Sole o la Luna. Ogni tratto ha un bordo scuro: si deve leggere sul cielo chiaro e sui palazzi. */
  const drawAr = (V, a) => {
    const W = viewEl.clientWidth, H = viewEl.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if (!W || !H) return;
    if (ar.width !== Math.round(W * dpr) || ar.height !== Math.round(H * dpr)) { ar.width = Math.round(W * dpr); ar.height = Math.round(H * dpr); }
    const c = ar.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (!V || !a || a.az == null) return;
    const P = (az, alt) => { const p = hzProject(V, az, alt); return p && p[0] > -W && p[0] < 2 * W && p[1] > -H && p[1] < 2 * H ? p : null; };
    const ink = (color, width, dash) => { c.setLineDash(dash || []); c.lineJoin = c.lineCap = 'round'; c.strokeStyle = 'rgba(0, 0, 0, .7)'; c.lineWidth = width + 2.5; c.stroke(); c.strokeStyle = color; c.lineWidth = width; c.stroke(); c.setLineDash([]); };
    const line = (pts) => { c.beginPath(); let pen = false; for (const q2 of pts) { const p = q2 && P(q2[0], q2[1]); if (!p) { pen = false; continue; } if (pen) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); pen = true; } };
    const a0 = Math.round(a.az), around = (fn) => { const o = []; for (let d = -84; d <= 84; d += 2) o.push([a0 + d, fn(norm360(a0 + d))]); return o; };
    // la linea ad altezza zero, con una tacca ogni 15° e il nome ogni 45°
    line(around(() => 0)); ink('rgba(255, 255, 255, .85)', 1);
    c.beginPath(); for (let az = Math.ceil((a0 - 84) / 15) * 15; az <= a0 + 84; az += 15) { const p = P(az, 0), t = P(az, az % 45 ? 0.9 : 1.8); if (p && t) { c.moveTo(p[0], p[1]); c.lineTo(t[0], t[1]); } } ink('rgba(255, 255, 255, .85)', 1);
    c.font = '600 14px "Saira Condensed", "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    const label = (txt, x, y, color) => { c.lineWidth = 3.5; c.strokeStyle = 'rgba(0, 0, 0, .8)'; c.strokeText(txt, x, y); c.fillStyle = color; c.fillText(txt, x, y); };
    for (let az = Math.ceil((a0 - 84) / 45) * 45; az <= a0 + 84; az += 45) { const p = P(az, 2.6); if (p) label(AZN[Math.round(norm360(az) / 45) % 8], p[0], p[1], '#fff'); }
    // l'orizzonte di prima, dove non si è ancora misurato
    if (oldLut) { const M = S.res.measured; line(around((d) => (M[Math.round(d) % 360] ? null : oldLut[Math.round(d) % 360])).map((q2) => (q2[1] == null ? null : q2))); ink('rgba(255, 255, 255, .8)', 1.5, [6, 6]); }
    // quello che si è segnato: le tracce, e un punto per ogni lettura
    const mine = truePts(V.off);
    for (const st of mine) if (st.length > 1) { line(st.map((p) => [p.az, p.alt])); ink(C.acc, 2.5); }
    for (const st of mine) for (const p of st) { const s = P(p.az, p.alt); if (!s) continue; c.beginPath(); c.arc(s[0], s[1], st.length > 1 ? 2.5 : 5, 0, 2 * Math.PI); c.fillStyle = C.acc; c.fill(); c.strokeStyle = 'rgba(0, 0, 0, .75)'; c.lineWidth = 1.5; c.stroke(); }
    // dove stanno il Sole o la Luna secondo l'app: se il cerchio non cade sull'astro, la bussola sbaglia di quel tanto
    if (S.ref) { const s = P(S.ref.az, S.ref.alt); if (s) { c.beginPath(); c.arc(s[0], s[1], 17, 0, 2 * Math.PI); ink(S.ref.who === 'sun' ? C.sun : '#fff', 2); label(tx(S.ref.who === 'sun' ? 'Sole' : 'Luna'), s[0], s[1] - 24, '#fff'); } }
  };
  let stripAt = 0, stripKey = '';
  const frame = () => {
    if (HZS.el !== el) return;
    S.raf = requestAnimationFrame(frame);
    const now = Date.now(), base = S.rel || S.abs;
    // la mano trema: i numeri sullo schermo si leggono su una media di 50 ms (che riparte se cambia la sorgente)
    if (src() !== S.vSrc) { S.vSrc = src(); S.v = null; }
    if (base) { const k = S.v ? 1 - Math.exp(-Math.min(200, now - S.vAt) / 50) : 1, v = S.v || base, x = v[0] + (base[0] - v[0]) * k, y = v[1] + (base[1] - v[1]) * k, z = v[2] + (base[2] - v[2]) * k, n = Math.hypot(x, y, z) || 1; S.v = [x / n, y / n, z / n]; S.vAt = now; }
    if (now - S.refAt > 2000) { S.refAt = now; S.ref = skyRef(S.site, now); }
    // punti arrivati col loro azimut vero (ripresi da prima): appena c'è il nord passano nel riferimento dei sensori
    const off = offNow();
    if (off != null) { let moved = false; for (const st of S.strokes) for (const p of st) if (p.b == null) { p.b = norm360(p.az - off); delete p.az; moved = true; } if (moved || S.resOff == null || Math.abs(wrap180(off - S.resOff)) > 0.3) refresh(); }
    const a = aimNow(), raw = aimRaw(), ref = S.ref, n = S.strokes.reduce((t, st) => t + st.length, 0);
    const noNorth = !!a && a.ref === 'none' && now - S.t0 > 1500; // nel primo secondo la bussola deve ancora arrivare
    if (S.hold && raw && raw.az != null && raw.alt <= 80 && S.last && aimSep(aimOf(base), S.last) >= HZS_STEP) add(false);
    set('read', a ? `${a.az == null ? '' : Math.round(a.az) % 360}|${Math.round(a.alt)}` : '', () => {
      q('[data-read]').hidden = !a; if (!a) return;
      q('[data-az]').textContent = a.az == null ? '—' : (Math.round(a.az) % 360) + '°'; q('[data-dir]').textContent = a.az == null ? '' : azName(a.az);
      q('[data-alt]').textContent = (a.alt < -0.5 ? '−' : '') + Math.abs(Math.round(a.alt)) + '°';
    });
    // quanto sbagliava la bussola, dopo l'allineamento: si vede se conviene fidarsene la prossima volta
    let refTxt = '';
    if (a) {
      if (a.ref === 'sun' || a.ref === 'moon') { const s = S.abs && S.rel && S.offOk ? Math.round(wrap180(Math.atan2(S.offS, S.offC) * R2D + (S.decl || 0) - S.cal.off)) : null; refTxt = tx(a.ref === 'sun' ? 'Allineato al Sole' : 'Allineato alla Luna') + (s == null || S.cal.src !== 'rel' ? '' : ' · ' + tx('bussola {d}°', { d: (s > 0 ? '+' : s < 0 ? '−' : '') + Math.abs(s) })); }
      else if (a.ref !== 'none' || noNorth) refTxt = tx({ compass: 'Bussola', mag: 'Nord magnetico', none: 'Bussola assente' }[a.ref]);
    }
    set('ref', refTxt, (v) => { q('[data-ref]').textContent = v; });
    const aligned = !!(a && (a.ref === 'sun' || a.ref === 'moon'));
    set('cal', !a || !ref ? '' : aligned ? tx('Riallinea') : tx(ref.who === 'sun' ? 'Allinea al Sole' : 'Allinea alla Luna'), (v) => { const b = q('[data-cal]'); b.hidden = !v; b.textContent = v; });
    let msg;
    if (!base && now - S.t0 > 2500) msg = tx('Sensori di orientamento non disponibili');
    else if (S.cam === 'off') msg = tx('Fotocamera non disponibile');
    else if (S.say && now - S.sayAt < 4500) msg = S.say;
    else if (noNorth) msg = !ref ? tx('Bussola assente: serve il Sole o la Luna sopra l’orizzonte') : tx(ref.who === 'sun' ? 'Bussola assente: allinea al Sole' : 'Bussola assente: allinea alla Luna');
    else if (!aligned && S.acc >= 0 && S.acc < 2) msg = tx('Bussola imprecisa: muovi il telefono a otto');
    else if (!n) msg = S.fov.known ? tx('Tieni premuto e segui il profilo col mirino, oppure tocca un punto dell’immagine.') : tx('Mirino sul profilo degli ostacoli. Tocca: un punto. Tieni premuto: segui il profilo.');
    else msg = tx('{n} punti · {c}° su 360', { n, c: S.res.measured.reduce((t, x) => t + x, 0) });
    set('msg', msg, (v) => { q('[data-msg]').textContent = v; });
    set('retry', S.cam === 'off', (v) => { q('[data-retry]').hidden = !v; });
    set('undo', n > 0, (v) => { q('[data-undo]').disabled = !v; });
    set('done', n >= 2, (v) => { q('[data-done]').disabled = !v; });
    set('ready', !!(a && a.az != null), (v) => { mark.disabled = !v; });
    drawAr(view(), raw);
    const sk = `${S.rev}|${a && a.az != null ? Math.round(a.az * 2) : ''}|${a ? Math.round(a.alt) : ''}|${strip.clientWidth}`;
    if (sk !== stripKey && now - stripAt > 80) { stripKey = sk; stripAt = now; drawStrip(a); }
  };

  /* ---- apertura e chiusura ---- */
  let unwatch = null;
  const sensors = (on) => {
    for (const n of ['deviceorientation', 'deviceorientationabsolute']) window[on ? 'addEventListener' : 'removeEventListener'](n, onOri, true);
    const cp = window.cielo && window.cielo.compass; if (!cp) return;
    if (on && !unwatch) unwatch = cp.watch((lv) => { S.acc = lv; }); else if (!on && unwatch) { unwatch(); unwatch = null; }
  };
  // In secondo piano fotocamera e sensori si spengono. Al ritorno il riferimento del giroscopio può essere un altro: i punti
  // si fermano sul loro azimut vero e il nord si ricalcola (l'allineamento al Sole va rifatto).
  const freeze = () => { S.strokes = truePts(offNow()); Object.assign(S, { cal: null, offOk: false, offN: 0, offT: 0, rel: null, abs: null, relR: null, absR: null, v: null, hold: false, last: null }); refresh(); };
  const vis = () => { if (document.hidden) { freeze(); stopCam(); sensors(false); } else { sensors(true); startCam(); } };
  const key = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button:not([disabled]):not([hidden])')], i = f.indexOf(document.activeElement); if (!f.length) return;
    e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
  };
  const close = (fromPop) => {
    if (HZS.el !== el) return;
    cancelAnimationFrame(S.raf); stopCam(); sensors(false); document.removeEventListener('visibilitychange', vis); document.removeEventListener('keydown', key, true);
    if (S.strokes.length && !S.applied && draft) HZS.saved = { id: draft.id, at: Date.now(), strokes: truePts(offNow()).filter((st) => st.length) };
    el.remove(); HZS.el = null; if (fromPop !== true) backDone(close);
    if (opener && opener.isConnected) try { opener.focus(); } catch { /* niente */ }
  };
  q('[data-x]').onclick = () => close();
  q('[data-done]').onclick = () => {
    if (!draft || S.strokes.reduce((t, st) => t + st.length, 0) < 2) return;
    draft.horizon = scanToHorizon(truePts(offNow()).flat(), S.old).pts; draft.hzSrc = 'user'; edDirty = true; S.applied = true;
    close(); drawHz(); drawLpPreview(F('lpSky'), draft.site, draft.horizon); toast(tx('Orizzonte misurato: {n} punti', { n: draft.horizon.length }));
  };
  refresh();
  S.add = add; S.aimNow = aimNow; S.align = align; S.close = close; S.view = view; S.points = () => truePts(offNow()).flat();
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // tenendo premuto «Segna» non deve uscire il menu del sistema
  document.body.appendChild(el); backPush(close);
  document.addEventListener('keydown', key, true); document.addEventListener('visibilitychange', vis);
  // iPhone: i sensori vanno chiesti, e solo dentro un tocco (questo)
  try { const D = window.DeviceOrientationEvent; if (D && typeof D.requestPermission === 'function') await D.requestPermission(); } catch { /* resta il messaggio sui sensori */ }
  if (HZS.el !== el) return;
  sensors(true); startCam(); S.raf = requestAnimationFrame(frame); q('[data-x]').focus({ preventScroll: true });
  const cp = window.cielo && window.cielo.compass;
  if (cp) cp.declination(site.lat, site.lon).then((d) => { if (HZS.el === el && isFinite(d)) S.decl = d; });
}
