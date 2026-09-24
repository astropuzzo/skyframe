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

/* Pesi per settori di 10° di azimut: ogni cella entro 200 km conta come sorgente (rapporto^1,5, così pesano i centri
   abitati più dei loro aloni) attenuata con la distanza come d^−2,5 (legge di Walker); una sorgente vicina illumina un
   arco ampio di orizzonte, una lontana un arco stretto. Il risultato è normalizzato a media 1. */
async function lookup(lat, lon, cacheDir) {
  const ratio = await ratioAt(lat, lon, cacheDir);
  const G = new Float64Array(36), step = 1 / 60, kmLat = 111.2, kmLon = 111.2 * Math.cos(lat * Math.PI / 180);
  for (let dy = -1.8; dy <= 1.8; dy += step) {
    for (let dx = -1.8 * 111.2 / kmLon; dx <= 1.8 * 111.2 / kmLon; dx += step) {
      const n = dy * kmLat, e = dx * kmLon, d = Math.hypot(n, e);
      if (d < 2 || d > 200) continue;
      const r = await ratioAt(lat + dy, lon + dx, cacheDir);
      if (r < 0.05) continue;
      const w = Math.pow(r, 1.5) * Math.pow(d, -2.5);
      const az = (Math.atan2(e, n) * 180 / Math.PI + 360) % 360, sig = Math.min(40, Math.max(6, 35 * 8 / d));
      for (let k = 0; k < 36; k++) { let da = Math.abs(k * 10 + 5 - az); if (da > 180) da = 360 - da; if (da < 3 * sig) G[k] += w * Math.exp(-0.5 * (da / sig) ** 2); }
    }
  }
  const mean = G.reduce((a, b) => a + b, 0) / 36;
  const lpAz = Array.from(G, (x) => (mean > 0 ? Math.round(Math.min(2.5, Math.max(0.4, 1 + 0.8 * (x / mean - 1))) * 100) / 100 : 1));
  return { year: YEAR, ratio: Math.round(ratio * 100) / 100, sqm: Math.round((22 - 2.5 * Math.log10(1 + ratio)) * 100) / 100, lpAz, src: `Atlante Lorenz ${YEAR}` };
}
module.exports = { lookup };
