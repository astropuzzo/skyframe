'use strict';
/* Lettura delle mappe "All-sky" (fisheye) e "Panoramic" di lightpollutionmap.info (livello Sky brightness): il sito le
   genera come immagini, quindi i valori si ricostruiscono dai colori con la barra colori della stessa immagine.
   - la barra è la striscia stretta più a destra; il grafico è l'area grande a sinistra
   - dentro il grafico: terreno = grigio molto scuro, tutto il resto è cielo (la scala va dal rosso al viola al bianco)
   - fisheye: proiezione equidistante, nord in alto, est a sinistra; panoramica: azimut 0→360 da sinistra, altezza 0→90 dal basso
   - scala: le tacche regolari della barra danno la pendenza, l'SQM allo zenit del sito dà il valore assoluto */
const AllSky = (() => {
  const nonDark = (r, g, b) => Math.max(r, g, b) >= 70;
  const isTerrain = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx >= 8 && mx <= 50 && mx - mn <= 12; };

  function pixels(img) {
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
    return { W: cv.width, H: cv.height, d: c.getImageData(0, 0, cv.width, cv.height).data };
  }
  function detect(img) {
    const P = pixels(img), { W, H, d } = P;
    const cls = new Uint8Array(W * H); // 0 sfondo/testo scuro, 1 terreno, 2 chiaro
    for (let i = 0, k = 0; i < W * H; i++, k += 4) cls[i] = nonDark(d[k], d[k + 1], d[k + 2]) ? 2 : isTerrain(d[k], d[k + 1], d[k + 2]) ? 1 : 0;
    const col = new Int32Array(W); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cls[y * W + x] === 2) col[x]++;
    const runs = []; let s = -1;
    for (let x = 0; x <= W; x++) { const on = x < W && col[x] > 0.25 * H; if (on && s < 0) s = x; if (!on && s >= 0) { runs.push([s, x - 1]); s = -1; } }
    const bars = runs.filter(([a, b]) => b - a + 1 >= 6 && b - a + 1 < 0.09 * W);
    if (!bars.length) throw new Error('barra colori non trovata: serve l’immagine intera salvata da lightpollutionmap');
    const bar = bars[bars.length - 1], plot = runs.filter((r) => r[1] < bar[0]).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    if (!plot) throw new Error('area del cielo non trovata');
    // barra: colonna centrale, dall'alto al basso
    const xc = Math.round((bar[0] + bar[1]) / 2), bx0 = bar[0] + Math.round((bar[1] - bar[0]) * 0.25), bx1 = bar[1] - Math.round((bar[1] - bar[0]) * 0.25);
    // la striscia continua più lunga nella colonna centrale (sotto può esserci testo)
    let yt = -1, yb = -1; { let s0 = -1; for (let y = 0; y <= H; y++) { const on = y < H && cls[y * W + xc] === 2; if (on && s0 < 0) s0 = y; if (!on && s0 >= 0) { if (y - 1 - s0 > yb - yt) { yt = s0; yb = y - 1; } s0 = -1; } } }
    const cb = [];
    for (let y = yt; y <= yb; y++) { let r = 0, g = 0, b = 0, n = 0; for (let x = bx0; x <= bx1; x++) { const k = (y * W + x) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; } cb.push([r / n, g / n, b / n]); }
    // cielo = colore che sta sulla barra colori (anche il bianco dell'estremo brillante); bordi, etichette e griglia no
    const near = new Map(), onBar = (r, g, b) => {
      const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2); let v = near.get(key);
      if (v === undefined) { let bd = 1e9; for (let i = 0; i < cb.length; i += 2) { const q = cb[i], dd = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (dd < bd) bd = dd; } v = bd < 30 * 30; near.set(key, v); }
      return v;
    };
    for (let i = 0, k = 0; i < W * H; i++, k += 4) cls[i] = isTerrain(d[k], d[k + 1], d[k + 2]) ? 1 : cls[i] === 2 && onBar(d[k], d[k + 1], d[k + 2]) ? 2 : 0;
    // righe del grafico con molta copertura chiara
    const [px0, px1] = plot, pw = px1 - px0 + 1, rcov = new Float32Array(H);
    for (let y = 0; y < H; y++) { let n = 0; for (let x = px0; x <= px1; x++) if (cls[y * W + x] === 2) n++; rcov[y] = n / pw; }
    let ry0 = -1, ry1 = -1; for (let y = 0; y < H; y++) if (rcov[y] > 0.35) { if (ry0 < 0) ry0 = y; ry1 = y; }
    const kind = pw / Math.max(1, ry1 - ry0) > 1.6 ? 'panoramic' : 'fisheye';
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cls[y * W + x] > 0;
    const walk = (x, y, ux, uy, max) => { let last = 0, gap = 0; for (let t = 0; t < max; t++) { if (inside(Math.round(x + ux * t), Math.round(y + uy * t))) { last = t; gap = 0; } else if (++gap > 4) break; } return last; };
    let box;
    if (kind === 'panoramic') {
      let x0 = px0, x1 = px1; const ym = Math.round((ry0 + ry1) / 2);
      while (x0 < px1 && cls[ym * W + x0] !== 2) x0++; while (x1 > px0 && cls[ym * W + x1] !== 2) x1--;
      let y1 = ry1; for (let x = x0 + 2; x < x1 - 2; x += 3) { let yy = -1; for (let y = ry1 + 40; y >= ry0; y--) if (y < H && cls[y * W + x] === 2) { yy = y; break; } if (yy >= 0) y1 = Math.max(y1, yy + walk(x, yy, 0, 1, H)); }
      let y0 = ry0; while (y0 > 0 && rcov[y0 - 1] > 0.2) y0--;
      box = { x0, x1, y0, y1 };
    } else {
      // centro iniziale dalla copertura, poi bordo esterno (cielo + terreno) su 72 raggi e cerchio ai minimi quadrati
      let cx = (px0 + px1) / 2, cy = (ry0 + ry1) / 2, R = pw / 2;
      for (let it = 0; it < 3; it++) {
        const pts = [];
        for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a), r0 = R * 0.5; const t = walk(cx + ux * r0, cy + uy * r0, ux, uy, R * 0.8); pts.push([cx + ux * (r0 + t), cy + uy * (r0 + t)]); }
        let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0, Sz = 0; const n2 = pts.length;
        pts.forEach(([x, y]) => { const z = x * x + y * y; Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y; Sxz += x * z; Syz += y * z; Sz += z; });
        const M = [[Sxx, Sxy, Sx, Sxz], [Sxy, Syy, Sy, Syz], [Sx, Sy, n2, Sz]];
        for (let c2 = 0; c2 < 3; c2++) { let p2 = c2; for (let r2 = c2 + 1; r2 < 3; r2++) if (Math.abs(M[r2][c2]) > Math.abs(M[p2][c2])) p2 = r2; [M[c2], M[p2]] = [M[p2], M[c2]]; for (let r2 = 0; r2 < 3; r2++) if (r2 !== c2) { const f = M[r2][c2] / M[c2][c2]; for (let k2 = c2; k2 < 4; k2++) M[r2][k2] -= f * M[c2][k2]; } }
        cx = M[0][3] / M[0][0] / 2; cy = M[1][3] / M[1][1] / 2; R = Math.sqrt(M[2][3] / M[2][2] + cx * cx + cy * cy);
      }
      box = { x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R };
    }
    return { P, cls, cb, bar: { x: bar[0], w: bar[1] - bar[0] + 1, yt, yb }, box, kind };
  }
  function toSky(det, x, y) {
    const { x0, x1, y0, y1 } = det.box;
    if (det.kind === 'panoramic') { if (x < x0 || x > x1 || y < y0 || y > y1) return null; return [90 * (y1 - y) / (y1 - y0), 360 * (x - x0) / (x1 - x0)]; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = (x1 - x0) / 2, dx = x - cx, dy = cy - y, r = Math.hypot(dx, dy) / R;
    if (r > 1) return null;
    return [90 - 90 * r, (Math.atan2(-dx, dy) * 180 / Math.PI + 360) % 360];
  }
  /* griglia di magnitudini: 46 fasce d'altezza (2°) × 72 settori (5°); top = valore in alto sulla barra (cielo più buio) */
  function build(det, top, bottom) {
    const { W, H, d } = det.P, NB = 46, NAZ = 72, sum = new Float64Array(NB * NAZ), cnt = new Int32Array(NB * NAZ);
    const cb = det.cb, n = cb.length, cache = new Map();
    const tOf = (r, g, b) => {
      const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2); const c = cache.get(key); if (c !== undefined) return c;
      let bi = -1, bd = 1e9; for (let i = 0; i < n; i++) { const q = cb[i], dd = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      const t = bd < 30 * 30 ? bi / (n - 1) : -1; cache.set(key, t); return t;
    };
    const { x0, x1, y0, y1 } = det.box;
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y += 2) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x += 2) {
      if (det.cls[y * W + x] !== 2) continue;
      const s = toSky(det, x, y); if (!s) continue; const k = (y * W + x) * 4, t = tOf(d[k], d[k + 1], d[k + 2]); if (t < 0) continue;
      const hb = Math.min(NB - 1, Math.max(0, Math.floor(s[0] / 2))), ab = Math.floor(s[1] / 5) % NAZ;
      sum[hb * NAZ + ab] += top + (bottom - top) * t; cnt[hb * NAZ + ab]++;
    }
    const mag = new Array(NB * NAZ).fill(null);
    for (let i = 0; i < NB * NAZ; i++) if (cnt[i]) mag[i] = Math.round(sum[i] / cnt[i] * 100) / 100;
    for (let a = 0; a < NAZ; a++) { let last = null; for (let h = NB - 1; h >= 0; h--) { const i = h * NAZ + a; if (mag[i] == null) mag[i] = last; else last = mag[i]; } }
    for (let h = 0; h < NB; h++) for (let a = 0; a < NAZ; a++) { const i = h * NAZ + a; if (mag[i] == null) { for (let dd = 1; dd < NAZ; dd++) { const v = mag[h * NAZ + (a + dd) % NAZ] ?? mag[h * NAZ + (a - dd + NAZ) % NAZ]; if (v != null) { mag[i] = v; break; } } } }
    const zen = mag.slice((NB - 2) * NAZ).filter((v) => v != null), zenith = zen.reduce((s2, v) => s2 + v, 0) / (zen.length || 1);
    return { alts: Array.from({ length: NB }, (_, i) => Math.min(90, i * 2 + 1)), naz: NAZ, mag, zenith: Math.round(zenith * 100) / 100, top, bottom, kind: det.kind };
  }
  /* sagoma del terreno: per ogni 2° di azimut, altezza del primo pixel di cielo sopra il terreno */
  function terrain(det) {
    const { W, H } = det.P, out = [], sky = (x, y) => x >= 0 && y >= 0 && x < W && y < H && det.cls[y * W + x] === 2;
    const { x0, x1, y0, y1 } = det.box;
    for (let az = 0; az < 360; az += 2) {
      let alt = 0;
      if (det.kind === 'panoramic') { const x = Math.round(x0 + (x1 - x0) * az / 360); for (let y = Math.round(y1); y >= y0; y--) if (sky(x, y)) { alt = 90 * (y1 - y) / (y1 - y0); break; } }
      else {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = (x1 - x0) / 2, a = az * Math.PI / 180;
        for (let r = R - 1; r > 0; r -= 0.5) { if (sky(Math.round(cx - r * Math.sin(a)), Math.round(cy - r * Math.cos(a)))) { alt = 90 - 90 * r / R; break; } }
      }
      out.push([az, Math.round(alt * 10) / 10]);
    }
    return out;
  }
  /* scala automatica: tacche regolari della barra + SQM allo zenit come valore noto */
  function ticks(det) {
    const { W, d } = det.P, { x, w, yt, yb } = det.bar, xs = [x + w + 1, x + w + 2, x + w + 3, x + w + 4];
    const on = []; for (let y = yt - 4; y <= yb + 4; y++) on.push(xs.some((xx) => { const k = (y * W + xx) * 4; return d[k] > 170 && d[k + 1] > 170 && d[k + 2] > 170; }));
    const c = []; let s = -1; on.forEach((v, i) => { if (v && s < 0) s = i; if (!v && s >= 0) { c.push(yt - 4 + (s + i - 1) / 2); s = -1; } });
    return c;
  }
  function zenithColor(det) {
    const { W, d } = det.P, { x0, x1, y0, y1 } = det.box, px = [];
    const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
    for (let i = -6; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const X = det.kind === 'fisheye' ? cx + i : Math.round(x0 + (x1 - x0) * (i + 6) / 12), Y = det.kind === 'fisheye' ? cy + j - 3 : Math.round(y0) + 1 + j;
      if (det.cls[Y * W + X] === 2) { const k = (Y * W + X) * 4; px.push([d[k], d[k + 1], d[k + 2]]); }
    }
    if (!px.length) return null;
    px.sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]); return px[Math.floor(px.length / 2)];
  }
  function autoScale(det, zenSqm) {
    const T = ticks(det), { yt, yb } = det.bar, zc = zenithColor(det);
    if (!zc || T.length < 4) return null;
    let iz = 0, bd = 1e9; det.cb.forEach((q, i) => { const dd = (q[0] - zc[0]) ** 2 + (q[1] - zc[1]) ** 2 + (q[2] - zc[2]) ** 2; if (dd < bd) { bd = dd; iz = i; } });
    const yz = yt + iz, inner = T.filter((y) => y > yt + 4 && y < yb - 4);
    if (inner.length < 3) return null;
    const diffs = inner.slice(1).map((y, i) => y - inner[i]).sort((a, b) => a - b), dpx = diffs[Math.floor(diffs.length / 2)];
    let best = null;
    for (const step of [0.05, 0.1, 0.2, 0.25, 0.5, 1]) {
      const s = step / dpx, mag = (y) => zenSqm - (y - yz) * s;
      const err = inner.reduce((e, y) => { const q = mag(y) / step; return e + Math.abs(q - Math.round(q)); }, 0) / inner.length;
      if (!best || err < best.err) best = { err, step, top: mag(yt), bottom: mag(yb) };
    }
    if (!best || best.err > 0.12) return null;
    const r1 = (v) => (Math.abs(v * 10 - Math.round(v * 10)) < 0.25 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
    return { top: r1(best.top), bottom: r1(best.bottom), step: best.step, fit: best.err };
  }
  function fromDataUrl(url) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('immagine non leggibile')); img.src = url; }); }
  function load(file) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('immagine non leggibile')); img.src = url; });
  }
  return { detect, build, terrain, load, autoScale, ticks, fromDataUrl };
})();
