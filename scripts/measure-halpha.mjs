// Misura l'Hα vero delle nebulose a emissione dentro l'ellisse di catalogo, da survey calibrate.
//   node scripts/measure-halpha.mjs            (riprende da dove era arrivato: i risultati restano in scripts/raw/)
// Fonti, tramite il servizio hips2fits del CDS (una richiesta alla volta, con una pausa):
//   NSNS DR0.1 (Northern Sky Narrowband Survey, S. Ziegenbalg): Hα calibrato in Rayleigh su WHAM, 6,4″/px, Dec −1°…+76°
//   SHASSA FL (Southern H-Alpha Sky Survey Atlas, continuo sottratto): Hα a 0,8′, per il cielo a sud; la scala si tara sulla NSNS negli oggetti in comune
// Uscita: scripts/raw/halpha-meas.json { id: { nsns: [p25, p50, p75, n], shassa: [p25, p50, p75, n] } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'raw', 'halpha-meas.json');
const win = {}; new Function('window', fs.readFileSync(path.join(here, '..', 'src', 'data', 'dso.js'), 'utf8'))(win);
const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D2R = Math.PI / 180;

async function cutout(hips, ra, dec, fov, n) {
  const q = new URLSearchParams({ hips, width: n, height: n, fov: fov.toFixed(4), projection: 'TAN', coordsys: 'icrs', ra: ra.toFixed(5), dec: dec.toFixed(5), format: 'fits' });
  const r = await fetch('https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' + q, { headers: { 'User-Agent': 'Skyframe-calibration/1 (https://github.com/astropuzzo/skyframe)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  let off = 0; const h = {};
  for (let end = false; !end; off += 2880) for (let i = 0; i < 2880; i += 80) {
    const card = buf.toString('ascii', off + i, off + i + 80), k = card.slice(0, 8).trim();
    if (card[8] === '=') h[k] = card.slice(10).split('/')[0].trim().replace(/'/g, '').trim();
    if (k === 'END') { end = true; break; }
  }
  const bp = +h.BITPIX, nx = +h.NAXIS1, ny = +h.NAXIS2, bs = +(h.BSCALE || 1), bz = +(h.BZERO || 0), sz = Math.abs(bp) / 8;
  const rd = { '-32': (o) => buf.readFloatBE(o), '-64': (o) => buf.readDoubleBE(o), 16: (o) => buf.readInt16BE(o), 32: (o) => buf.readInt32BE(o) }[bp];
  const v = new Float64Array(nx * ny); for (let i = 0; i < nx * ny; i++) v[i] = rd(off + i * sz) * bs + bz;
  return { nx, ny, v };
}
// percentili dei pixel dentro l'ellisse (asse maggiore a, minore b, PA da nord verso est)
async function measure(hips, o, pxArcsec) {
  const fov = Math.max(o.a, 3) * 1.3 / 60, n = Math.min(180, Math.max(24, Math.round(fov * 3600 / pxArcsec)));
  const { nx, ny, v } = await cutout(hips, o.ra, o.dec, fov, n), sc = fov * 60 / nx, t = (o.pa || 0) * D2R, vals = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (nx / 2 - i - 0.5) * sc, y = (j + 0.5 - ny / 2) * sc; // est a sinistra, nord in alto
    const u = x * Math.sin(t) + y * Math.cos(t), w = -x * Math.cos(t) + y * Math.sin(t);
    if ((u / (o.a / 2)) ** 2 + (w / (o.b / 2)) ** 2 <= 1) { const x0 = v[j * nx + i]; if (Number.isFinite(x0)) vals.push(x0); }
  }
  if (vals.length < 6) return null;
  vals.sort((a, b) => a - b); const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  return [q(0.25), q(0.5), q(0.75), vals.length].map((x, i) => (i < 3 ? Math.round(x * 10) / 10 : x));
}

const list = window2objs(win.DSO).filter((o) => ['EN', 'SNR', 'PN'].includes(o.type));
function window2objs(rows) { return rows.map((r) => ({ id: r[0], type: r[3], ra: r[4], dec: r[5], a: r[6], b: r[7] || r[6], pa: r[8] || 0 })); }
const jobs = [];
for (const o of list) {
  if (o.dec >= -1 && o.dec <= 76 && o.a >= 2) jobs.push(['nsns', 'simg.de/P/NSNS/DR0_1/halpha', o, 10]);
  if (o.dec < 15 && o.a >= 8) jobs.push(['shassa', 'CDS/P/SHASSA/FL', o, 48]); // Hα con il continuo sottratto
}
let done = 0, fail = 0;
for (const [key, hips, o, px] of jobs) {
  const c = cache[o.id] || (cache[o.id] = {});
  if (c[key] !== undefined) { done++; continue; }
  try { c[key] = await measure(hips, o, px); } catch (e) { c[key] = null; fail++; console.log(o.id, key, 'errore', e.message); }
  done++;
  if (done % 20 === 0) { fs.writeFileSync(OUT, JSON.stringify(cache)); console.log(`${done}/${jobs.length}`); }
  await sleep(key === 'shassa' ? 800 : 350);
}
fs.writeFileSync(OUT, JSON.stringify(cache));
console.log(`fatto: ${done} misure, ${fail} errori → ${OUT}`);
