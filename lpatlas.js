'use strict';
/* Atlante dell'inquinamento luminoso di David Lorenz (dati VIIRS, anno 2025): https://djlorenz.github.io/astronomy/lp/
   Tile binarie da 5°×5° a 1/120° (600×600): il primo valore (2 byte) è l'angolo in basso a sinistra, gli altri sono
   variazioni di 1 byte (prima lungo la colonna 0, poi lungo ogni riga). Formato ricavato dal codice della pagina
   dell'atlante: rapporto artificiale/naturale = (5/195)·(e^(0,0195·x) − 1), SQM = 22 − 2,5·log10(1 + rapporto). */
const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');

const YEAR = 2025;
const mem = new Map();

async function tile(tx, ty, cacheDir) {
  const key = `${tx}_${ty}`;
  if (mem.has(key)) return mem.get(key);
  const file = path.join(cacheDir, String(YEAR), `binary_tile_${key}.dat.gz`);
  let gz;
  try { gz = await fs.readFile(file); } catch {
    const r = await fetch(`https://djlorenz.github.io/astronomy/binary_tiles/${YEAR}/binary_tile_${key}.dat.gz`);
    if (!r.ok) { mem.set(key, null); return null; }
    gz = Buffer.from(await r.arrayBuffer());
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, gz);
  }
  const b = zlib.gunzipSync(gz), d = new Int8Array(b.buffer, b.byteOffset, b.length), g = new Float32Array(360000);
  let row0 = 128 * d[0] + d[1];
  for (let r = 0; r < 600; r++) {
    if (r > 0) row0 += d[600 * r + 1];
    let v = row0; g[r * 600] = v;
    for (let c = 1; c < 600; c++) { v += d[600 * r + 1 + c]; g[r * 600 + c] = v; }
  }
  mem.set(key, g);
  return g;
}
const ratioOf = (x) => (5 / 195) * (Math.exp(0.0195 * x) - 1);
async function ratioAt(lat, lon, cacheDir) {
  const lfd = ((lon + 180) % 360 + 360) % 360, lfs = lat + 65;
  const tx = Math.floor(lfd / 5) + 1, ty = Math.floor(lfs / 5) + 1;
  if (ty < 1 || ty > 28) return 0;
  const g = await tile(tx, ty, cacheDir); if (!g) return 0;
  const ix = Math.min(600, Math.max(1, Math.round(120 * (lfd - 5 * (tx - 1) + 1 / 240))));
  const iy = Math.min(600, Math.max(1, Math.round(120 * (lfs - 5 * (ty - 1) + 1 / 240))));
  return ratioOf(g[(iy - 1) * 600 + (ix - 1)]);
}

/* Forma del cielo per direzione. Ogni cella dell'atlante entro 250 km è una sorgente (rapporto^1,5: pesano i centri
   abitati più dei loro aloni). Allo zenit contribuisce come d^−2,5 (legge di Walker); verso di lei produce una cupola
   che è A(d) volte più brillante vicino all'orizzonte, alta h0(d) e larga σ(d): bassa e stretta se lontana, alta e larga
   se vicina. Le luci entro 1,5 km sono l'illuminazione locale: uniforme, più brillante verso l'orizzonte per la massa d'aria.
   Risultato: griglia (altezze × 72 settori da 5°) del rapporto fra la parte artificiale in quella direzione e allo zenit. */
const ALTS = [0, 2, 4, 7, 10, 15, 20, 30, 45, 60, 75, 90];
const NAZ = 72;
/* Parametri tarati (ricerca casuale + raffinamento) sulla mappa all-sky reale di lightpollutionmap per un sito urbano
   (Terni, 2025): massimo 18,18 a 3° verso 321°, media 19,05, media sopra 30° 19,20 → il modello dà 18,18 a 3° verso 321°,
   19,03 e 19,21. È una stima: per la forma esatta di un luogo si importa la sua mappa all-sky. */
const K = { EXP: 1.589, LOCAL_KM: 2.4, A0: 3.124, AEXP: 0.838, HSCALE: 3.364, SIGD: 1.607, SIG0: 12.28, ZA: 0.908, ZH: 2.49, LA: 4.562, LH: 5.554, MAX_KM: 250 };
async function lookup(lat, lon, cacheDir) {
  const ratio = await ratioAt(lat, lon, cacheDir);
  const G = new Float64Array(ALTS.length * NAZ);
  let Zsum = 0, local = 0;
  const kmLat = 111.2, kmLon = 111.2 * Math.cos(lat * Math.PI / 180), step = 1 / 60;
  const dLat = K.MAX_KM / kmLat, dLon = K.MAX_KM / kmLon;
  for (let dy = -dLat; dy <= dLat; dy += step) {
    for (let dx = -dLon; dx <= dLon; dx += step) {
      const n = dy * kmLat, e = dx * kmLon, d = Math.hypot(n, e);
      if (d > K.MAX_KM) continue;
      const r = await ratioAt(lat + dy, lon + dx, cacheDir);
      if (r < 0.2) continue;
      const E = Math.pow(r, K.EXP);
      if (d < K.LOCAL_KM) { local += E * Math.pow(K.LOCAL_KM, -2.5); continue; }
      const Z = E * Math.pow(d, -2.5); Zsum += Z;
      const A = K.A0 * Math.pow(d / 5, K.AEXP), h0 = Math.min(60, Math.max(1.5, Math.atan(K.HSCALE / d) * 180 / Math.PI));
      const sig = Math.min(70, Math.atan(K.SIGD / d) * 180 / Math.PI + K.SIG0);
      const az = (Math.atan2(e, n) * 180 / Math.PI + 360) % 360, span = Math.ceil(3 * sig / 5) + 1;
      const k0 = Math.floor(az / 5); // settori da 5°, centro a k·5 + 2,5
      for (let a = 0; a < ALTS.length; a++) {
        const ph = Math.exp(-ALTS[a] / h0); if (ph < 1e-4) continue;
        for (let j = -span; j <= span; j++) {
          const k = ((k0 + j) % NAZ + NAZ) % NAZ, da = Math.abs(((k * 5 + 2.5 - az + 540) % 360) - 180);
          G[a * NAZ + k] += Z * A * ph * Math.exp(-0.5 * (da / sig) ** 2);
        }
      }
    }
  }
  // somma: parte uniforme (sorgenti lontane allo zenit + luci locali con massa d'aria) + cupole direzionali
  const U = (h) => Zsum * (1 + K.ZA * Math.exp(-h / K.ZH)) + local * (1 + K.LA * Math.exp(-h / K.LH));
  const tot = ALTS.map((h, a) => Array.from({ length: NAZ }, (_, k) => U(h) + G[a * NAZ + k]));
  const zen = tot[ALTS.length - 1].reduce((s, x) => s + x, 0) / NAZ || 1;
  const v = [];
  tot.forEach((row) => row.forEach((x) => v.push(Math.round((x / zen) * 1000) / 1000)));
  const lpGrid = { alts: ALTS, naz: NAZ, v, localShare: Math.round((local / (local + Zsum || 1)) * 100) / 100 };
  return { year: YEAR, ratio: Math.round(ratio * 100) / 100, sqm: Math.round((22 - 2.5 * Math.log10(1 + ratio)) * 100) / 100, lpGrid, src: `Atlante Lorenz ${YEAR}` };
}
/* interpolazione bilineare della griglia: rapporto artificiale(h, az) / artificiale(zenit) */
function fAt(g, h, az) {
  const A = g.alts, n = g.naz, w = 360 / n;
  h = Math.min(90, Math.max(0, h));
  let a = 0; while (a < A.length - 2 && h > A[a + 1]) a++;
  const ta = (h - A[a]) / (A[a + 1] - A[a]);
  const x = (((az % 360) + 360) % 360) / w - 0.5, k0 = ((Math.floor(x) % n) + n) % n, k1 = (k0 + 1) % n, tk = x - Math.floor(x);
  const V = (ai, k) => g.v[ai * n + k];
  const r0 = V(a, k0) * (1 - tk) + V(a, k1) * tk, r1 = V(a + 1, k0) * (1 - tk) + V(a + 1, k1) * tk;
  return r0 * (1 - ta) + r1 * ta;
}
module.exports = { lookup, fAt, ALTS, _ratioAt: ratioAt };
