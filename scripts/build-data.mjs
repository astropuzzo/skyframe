// Costruisce src/data/dso.js e src/data/sky.js dai cataloghi originali.
//   node scripts/build-data.mjs            (usa scripts/raw/, scarica ciò che manca)
// Fonti: OpenNGC (CC-BY-SA 4.0), VizieR (Sharpless VII/20, Lynds VII/7A, Barnard VII/220A,
// van den Bergh VII/21, Strasbourg-ESO PN V/84, Green SNR VII/297), d3-celestial (BSD-3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NICK, NICK_NGC, EXTRA, SNR_OPTICAL, CLASSIC, TIPS, LINE_KEY } from './curated.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, 'raw');
const OUT = path.join(here, '..', 'src', 'data');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const VIZ = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?-out.max=unlimited&-out.add=_RAJ2000,_DEJ2000&-out.all&-oc.form=d&-source=';
const SOURCES = {
  'NGC.csv': 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
  'addendum.csv': 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv',
  'stars.6.json': 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json',
  'constellations.lines.json': 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json',
  'constellations.json': 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json',
  'constellations.bounds.json': 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.bounds.json',
  'mw.json': 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/mw.json',
  'sh2.tsv': VIZ + 'VII/20', 'ldn.tsv': VIZ + 'VII/7A', 'barnard.tsv': VIZ + 'VII/220A', 'vdb.tsv': VIZ + 'VII/21',
  'pn.tsv': VIZ + 'V/84', 'snr.tsv': VIZ + 'VII/297',
  'pndiam.tsv': 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?-out.max=unlimited&-out.all&-source=V/84/diam',
  'halpha_0512.fits': 'https://lambda.gsfc.nasa.gov/data/foregrounds/halpha/lambda_halpha_fwhm06_0512.fits',
};
for (const [f, url] of Object.entries(SOURCES)) {
  const p = path.join(RAW, f);
  if (fs.existsSync(p)) continue;
  console.log('scarico', f);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
}
const raw = (f) => fs.readFileSync(path.join(RAW, f), 'utf8');
const json = (f) => JSON.parse(raw(f));

/* ---------- utilità ---------- */
const num = (s) => { const v = parseFloat(String(s ?? '').trim()); return Number.isFinite(v) ? v : null; };
const hms = (s) => { const p = s.trim().split(/[: ]+/).map(Number); return (p[0] + p[1] / 60 + (p[2] || 0) / 3600) * 15; };
const dms = (s) => { const t = s.trim(); const sg = t[0] === '-' ? -1 : 1; const p = t.replace(/^[+-]/, '').split(/[: ]+/).map(Number); return sg * (p[0] + p[1] / 60 + (p[2] || 0) / 3600); };
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r1 = (x) => Math.round(x * 10) / 10;
const D2R = Math.PI / 180;
function sep(ra1, de1, ra2, de2) { // gradi
  const c = Math.sin(de1 * D2R) * Math.sin(de2 * D2R) + Math.cos(de1 * D2R) * Math.cos(de2 * D2R) * Math.cos((ra1 - ra2) * D2R);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
}
function tsv(f) { // tabella VizieR → array di oggetti
  const lines = raw(f).split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  const head = lines[0].split('\t').map((h) => h.trim());
  return lines.slice(3).map((l) => { const c = l.split('\t'); const o = {}; head.forEach((h, i) => (o[h] = (c[i] ?? '').trim())); return o; }).filter((o) => o._RAJ2000 !== '' || o.RAJ2000);
}
function csv(f) {
  const lines = raw(f).split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(';');
  return lines.slice(1).map((l) => { const c = l.split(';'); const o = {}; head.forEach((h, i) => (o[h] = c[i] ?? '')); return o; });
}
// OpenNGC per alcune grandi HII riporta la dimensione dell'ammasso centrale: correggo con quella della nebulosa.
// [asse maggiore′, minore′, LS mag/″²]
const SIZE_FIX = {
  'IC 1396': [170, 140, 23.4], 'NGC 7000': [120, 100, 22.6], 'IC 1805': [150, 150, 23.0], 'IC 1848': [150, 75, 23.0],
  'IC 1318': [180, 120, 23.3], 'IC 5070': [60, 50, 22.8], 'NGC 2264': [60, 30, 23.0], 'NGC 281': [35, 30, 22.5],
  'IC 405': [37, 19, 23.0], 'IC 410': [40, 30, 23.0], 'NGC 1499': [145, 40, 23.2], 'NGC 2174': [40, 30, 22.8],
  'NGC 7380': [25, 25, 22.8], 'NGC 6888': [18, 12, 22.4], 'IC 5146': [12, 12, 22.6], 'NGC 7635': [15, 8, 22.4],
  'NGC 2237': [80, 60, 22.6], 'IC 434': [60, 10, 23.0], 'NGC 2024': [30, 30, 22.2], 'IC 2118': [180, 60, 24.2],
  'NGC 6960': [70, 10, 22.8], 'NGC 6992': [60, 10, 22.8], 'NGC 7293': [16, 12, 22.4], 'IC 443': [50, 40, 23.6],
  'NGC 1976': [85, 60, 20.3], 'NGC 6523': [90, 40, 21.6], 'NGC 6618': [40, 30, 21.0], 'NGC 6514': [28, 28, 21.8], 'NGC 1952': [6, 4, 21.0],
  'NGC 6611': [35, 28, 21.8],
};
// Nebulose oscure il cui "diametro" di catalogo non rende l'estensione reale della polvere. [asse maggiore′, minore′, PA°, RA°, Dec°]
// B 168: Barnard dà la posizione della testa (sulla Cocoon); la scia va ~1° verso ONO. Centro e PA stimati dalle immagini.
const DUST_FIX = { 'B 168': [110, 15, 106, 327.12, 47.5], 'B 142': [40, 25, 0], 'B 143': [30, 20, 0], 'B 72': [30, 20, 0] };
const areaSB = (mag, a, b) => mag + 2.5 * Math.log10(Math.PI / 4 * a * b * 3600);

/* ---------- costellazioni (per gli oggetti fuori da OpenNGC) ---------- */
const bounds = json('constellations.bounds.json').features.map((f) => ({ id: f.id, rings: f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]) }));
// d3-celestial: lon = RA in gradi su [-180,180]. Srotolo l'anello in longitudine continua e provo il punto
// anche spostato di ±360°. Gli anelli attorno ai poli si chiudono aggiungendo il polo stesso.
const unwrapped = new Map();
function unwrap(ring) {
  if (unwrapped.has(ring)) return unwrapped.get(ring);
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) { let x = ring[i][0]; const px = out[i - 1][0]; while (x - px > 180) x -= 360; while (x - px < -180) x += 360; out.push([x, ring[i][1]]); }
  const span = out[out.length - 1][0] - out[0][0];
  if (Math.abs(span) > 300) { const pole = out.reduce((s, p) => s + p[1], 0) > 0 ? 90 : -90; const x0 = out[0][0], x1 = out[out.length - 1][0]; out.push([x1, pole], [x0, pole]); }
  unwrapped.set(ring, out);
  return out;
}
function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inRing(ra, dec, ring) {
  const P = unwrap(ring), x = ra > 180 ? ra - 360 : ra;
  return [x, x + 360, x - 360, x + 720, x - 720].some((xx) => inPoly(xx, dec, P));
}
function constellation(ra, dec) {
  for (const b of bounds) for (const r of b.rings) if (inRing(ra, dec, r)) return b.id;
  let best = '', bd = 1e9; // ripiego: costellazione il cui confine ha un vertice più vicino
  for (const b of bounds) for (const r of b.rings) for (const p of r) { const d = sep(ra, dec, p[0] < 0 ? p[0] + 360 : p[0], p[1]); if (d < bd) { bd = d; best = b.id; } }
  return best;
}

/* ---------- 1. OpenNGC ---------- */
const TYPE_MAP = { G: 'Gx', GPair: 'Gx', GTrpl: 'Gx', GGroup: 'Gx', PN: 'PN', HII: 'EN', EmN: 'EN', Neb: 'EN', 'Cl+N': 'EN', RfN: 'RN', SNR: 'SNR', OCl: 'OC', GCl: 'GC', DrkN: 'DN' };
const list = [];
function pretty(name) {
  let m;
  if ((m = name.match(/^(NGC|IC)0*(\d+)(.*)$/))) return `${m[1]} ${m[2]}${m[3] ? m[3].replace(/^_/, '').trim() : ''}`;
  if ((m = name.match(/^M0*(\d+)$/))) return `M ${m[1]}`;
  if ((m = name.match(/^B0*(\d+)$/))) return `B ${m[1]}`;
  if ((m = name.match(/^C0*(\d+)$/))) return `Caldwell ${m[1]}`;
  return name;
}
for (const row of [...csv('NGC.csv'), ...csv('addendum.csv')]) {
  const type = TYPE_MAP[row.Type];
  if (!type || !row.RA) continue;
  const ra = hms(row.RA), dec = dms(row.Dec);
  if (dec < -45) continue;
  let a = num(row.MajAx), b = num(row.MinAx) ?? a;
  const v = num(row['V-Mag']) ?? (num(row['B-Mag']) != null ? num(row['B-Mag']) - 0.7 : null);
  if (type === 'PN') { if (a == null) a = 0.3; }
  if (type === 'GC' && a == null) a = 5;
  if (a == null) continue;
  if (b == null || b <= 0) b = a;
  if (type === 'Gx') { const grp = row.Type !== 'G'; if (v == null || v > (grp ? 13 : 12) || a < 1.5) continue; }
  if (type === 'OC' && (v == null || v > 8.5) && a < 20) continue;
  if (type === 'GC' && (v == null || v > 10)) continue;
  if (type === 'EN' && row.Type === 'Neb' && a < 2) continue;
  const id0 = pretty(row.Name);
  const messier = num(row.M);
  const id = messier ? `M ${messier}` : id0;
  const alias = [];
  if (messier && id0 !== id) alias.push(id0);
  if (row.NGC) alias.push(...row.NGC.split(',').map((x) => 'NGC ' + x.replace(/^0+/, '')));
  if (row.IC) alias.push(...row.IC.split(',').map((x) => 'IC ' + x.replace(/^0+/, '')));
  let nick = (row['Common names'] || '').split(',')[0].trim();
  if (NICK_NGC[id0] !== undefined) nick = NICK_NGC[id0];
  let sb;
  const sbc = num(row.SurfBr);
  // LS media dalla magnitudine V sull'ellisse del catalogo; la SurfBr di OpenNGC (banda B) solo se manca la V
  if (v != null) sb = areaSB(v, a, b);
  else if (type === 'Gx' && sbc != null) sb = sbc - 0.8;
  else sb = { EN: 22.8, RN: 23.0, SNR: 23.8, DN: 24.5, PN: 21.5, OC: 21.5, GC: 20.5, Gx: 22.5 }[type];
  if (type === 'DN') sb = 24.5;
  // La magnitudine visuale delle HII include l'ammasso che le eccita: la LS media reale è più bassa.
  if (type === 'EN' && messier == null) sb = Math.max(sb, 21.8);
  const fix = SIZE_FIX[id0];
  if (fix) { a = fix[0]; b = fix[1]; if (fix[2] != null) sb = fix[2]; }
  // "Neb" e "Cl+N" sono generiche: il tipo vero lo decide un catalogo specialistico che si fonde qui (vdB → riflessione)
  list.push({ id, alias, nick, type, ra, dec, a, b, pa: num(row.PosAng) ?? 0, mag: v, sb, con: row.Const, src: messier ? 'M' : id.split(' ')[0], generic: row.Type === 'Neb' || row.Type === 'Cl+N' });
}

/* ---------- aggiunta con deduplica ---------- */
const GROUP = { EN: 'neb', SNR: 'neb', RN: 'neb', PN: 'neb', DN: 'dark', Gx: 'gx', OC: 'cl', GC: 'cl' };
function addOrMerge(o, { mergeInto = true } = {}) {
  if (mergeInto) {
    let best = null, bd = 1e9;
    for (const e of list) {
      if (GROUP[e.type] !== GROUP[o.type]) continue;
      const d = sep(e.ra, e.dec, o.ra, o.dec) * 60;
      const lim = Math.max(2.5, 0.35 * Math.max(e.a, o.a));
      const ratio = e.a / o.a;
      if (d < lim && ratio > 0.33 && ratio < 3 && d < bd) { best = e; bd = d; }
    }
    if (best) {
      if (!best.alias.includes(o.id) && best.id !== o.id) best.alias.push(o.id);
      if (!best.nick && o.nick) best.nick = o.nick;
      if (o.forceType || (o.type === 'PN' && best.type === 'EN') || (o.type === 'RN' && (best.src === 'Sh2' || best.generic))) { best.type = o.type; best.sb = Math.max(best.sb, o.sb); }
      if (o.type === 'EN' && best.generic) best.generic = false; // una Sharpless conferma che è emissione
      if (o.type === 'PN' && best.src === 'Sh2') { best.alias = best.alias.filter((x) => x !== o.id).concat(best.id); best.id = o.id; best.src = 'PN'; }
      return best;
    }
  }
  if (!o.con) o.con = constellation(o.ra, o.dec);
  o.alias = o.alias || [];
  list.push(o);
  return o;
}

/* ---------- 2. Sharpless ---------- */
for (const r of tsv('sh2.tsv')) {
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000), d = num(r.Diam);
  if (ra == null || dec < -45 || !d || d < 3) continue;
  const bright = num(r.Bright) || 1;
  const id = `Sh2-${parseInt(r.Sh2, 10)}`;
  // Classi di luminosità Sharpless calibrate sugli oggetti che hanno anche una LS misurata:
  // NGC 7000, IC 1805, NGC 281, NGC 2237, NGC 7635, IC 1396 (tutte classe 3) stanno fra 22,4 e 23,4.
  addOrMerge({ id, nick: NICK[id] || '', type: 'EN', ra, dec, a: Math.min(d, 900), b: Math.min(d, 900) * (num(r.Form) === 2 ? 0.7 : 1), pa: 0, mag: null, sb: 22.7 + (3 - bright) + (d > 60 ? 0.3 : 0), src: 'Sh2', extra: { bright } });
}

/* ---------- 3. van den Bergh ---------- */
for (const r of tsv('vdb.tsv')) {
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000);
  const rad = Math.max(num(r.BRadMax) || 0, num(r.RRadMax) || 0);
  if (ra == null || dec < -45 || rad < 1.5) continue;
  const id = `vdB ${parseInt(r.VdB, 10)}`;
  addOrMerge({ id, nick: NICK[id] || '', type: 'RN', ra, dec, a: 2 * rad, b: 2 * rad, pa: 0, mag: null, sb: 23.0, src: 'vdB' });
}

/* ---------- 4. Nebulose oscure: Lynds (opacità 5–6) e Barnard ---------- */
for (const r of tsv('ldn.tsv')) {
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000), area = num(r.Area), op = num(r.Opacity);
  if (ra == null || dec < -35 || !area || op < 5) continue;
  const d = 2 * Math.sqrt(area / Math.PI) * 60;
  if (d < 6 || d > 300) continue;
  const id = `LDN ${parseInt(r.LDN, 10)}`;
  addOrMerge({ id, nick: NICK[id] || '', type: 'DN', ra, dec, a: r1(d), b: r1(d * 0.7), pa: 0, mag: null, sb: op === 6 ? 24.3 : 24.8, src: 'LDN', extra: { opacity: op } });
}
for (const r of tsv('barnard.tsv')) {
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000), d = num(r.Diam);
  if (ra == null || dec < -35 || !d || d < 4) continue;
  const id = `B ${r.Barn.replace(/^0+/, '')}`, fx = DUST_FIX[id];
  addOrMerge({ id, nick: NICK[id] || '', type: 'DN', ra: fx && fx[3] != null ? fx[3] : ra, dec: fx && fx[4] != null ? fx[4] : dec, a: fx ? fx[0] : d, b: fx ? fx[1] : d, pa: fx ? fx[2] : 0, mag: null, sb: 24.5, src: 'B' }, { mergeInto: !fx });
}

/* ---------- 5. Planetarie grandi (Abell, Jones-Emberson, …) ---------- */
const pnd = new Map(tsv('pndiam.tsv').map((r) => [r.PNG, num(r.oDiam)]));
for (const r of tsv('pn.tsv')) {
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000);
  const nm = r.Name.replace(/\s+/g, ' ').trim();
  if (ra == null || dec < -35 || !nm || /^(NGC|IC|M |Sh ?2)/.test(nm) || /^\d+$/.test(nm)) continue;
  const dia = pnd.get(r.PNG);
  if (!dia || dia < 90) continue;
  const id = nm.replace(/^A (\d+)$/, 'Abell $1');
  const am = dia / 60;
  addOrMerge({ id, nick: NICK[id] || '', type: 'PN', ra, dec, a: r1(am), b: r1(am), pa: 0, mag: null, sb: am > 5 ? 24.5 : 24.0, src: 'PN' });
}

/* ---------- 6. Resti di supernova ottici (Green) ---------- */
for (const r of tsv('snr.tsv')) {
  const cur = SNR_OPTICAL[r.SNR];
  if (!cur) continue;
  const ra = num(r._RAJ2000), dec = num(r._DEJ2000), a = num(r.MajDiam), b = num(r.MinDiam) || a;
  addOrMerge({ id: cur.id, nick: cur.nick, type: 'SNR', forceType: true, ra, dec, a, b, pa: 0, mag: null, sb: cur.sb, src: 'SNR' });
}

/* ---------- 7. Gruppi composti ---------- */
for (const e of EXTRA) addOrMerge({ ...e, ra: e.ra * 15, alias: [], mag: null, src: 'X' }, { mergeInto: false });

/* ---------- correzioni di tipo: ciò che conta per la ripresa ---------- */
// le Pleiadi si fotografano per la nebulosa a riflessione; la Merope è riflessione; la Gabbiano è soprattutto emissione
// (la testa vdB 93 è riflessione, ma il grosso è Sh2-292)
const TYPE_FIX = { 'M 45': ['RN', 22.8], 'NGC 1435': ['RN', 22.5], 'IC 2177': ['EN', 23.0] };
for (const o of list) { const f = TYPE_FIX[o.id]; if (f) { o.type = f[0]; o.sb = f[1]; } }
/* Nebulose a riflessione: la magnitudine dei cataloghi è quella della stella che le illumina, non della nebulosa, e le
   dimensioni di OpenNGC per gli "ammassi + nebulosa" sono quelle dell'ammasso. Da lì uscivano LS assurde in entrambe le
   direzioni (NGC 1788 a 15,2, NGC 1333 a 25,3). La LS media viene quindi da questa tabella per le più riprese, stimata
   dalle immagini (parte luminosa ben visibile, non le polveri attorno), e altrimenti da un valore tipico di 23,0.
   [asse maggiore′ o null, minore′, LS mag/″²] */
const RN_FIX = {
  'NGC 1333': [10, 7, 21.8], 'M 78': [8, 6, 21.0], 'NGC 7023': [null, null, 22.0], 'NGC 2023': [null, null, 21.8],
  'NGC 2071': [null, null, 21.8], 'NGC 1999': [null, null, 20.5], 'NGC 1788': [null, null, 22.3], 'NGC 2247': [null, null, 22.8],
  'NGC 1555': [null, null, 21.5], 'NGC 2261': [null, null, 20.8], 'NGC 2245': [null, null, 21.5], 'NGC 6589': [null, null, 22.2],
  'NGC 6590': [null, null, 22.2], 'NGC 2182': [null, null, 22.0], 'NGC 1985': [null, null, 21.5], 'IC 4592': [null, null, 23.8],
  'IC 1287': [null, null, 23.3], 'IC 444': [null, null, 23.2], 'IC 4604': [null, null, 22.8], 'IC 4605': [null, null, 23.3],
  'IC 349': [3, 3, 21.5], 'NGC 1435': [null, null, 22.5], 'M 45': [null, null, 22.8],
};
for (const o of list) {
  if (o.type !== 'RN') continue;
  const f = RN_FIX[o.id]; o.sb = f ? f[2] : 23.0;
  if (f && f[0]) { o.a = f[0]; o.b = f[1]; }
}

/* ---------- contesto: polveri, riflessione e Hα deboli che circondano l'oggetto ----------
   Servono a stimare il campo vero (la Cocoon non è un oggetto da 12′) e il tempo per far uscire le parti deboli. */
const CTX_OF = new Set(['EN', 'RN', 'PN', 'SNR', 'OC']);
for (const o of list) {
  if (!CTX_OF.has(o.type)) continue;
  const near = [];
  for (const c of list) {
    if (c === o || c.a < 6 || c.sb < o.sb + 0.8) continue;
    const dust = c.type === 'DN' || c.type === 'RN', faintHa = c.type === 'EN' && c.a > o.a * 1.5;
    if (!dust && !faintHa) continue;
    const d = sep(o.ra, o.dec, c.ra, c.dec) * 60;
    if (d < o.a / 2 + c.a / 2 + 10 && d < 120) near.push([c, d]);
  }
  o.ctx = near.sort((x, y) => y[0].a - x[0].a).slice(0, 4).map(([c]) => c.id);
}

/* ---------- Hα diffuso attorno a ogni oggetto ----------
   Mappa composita di Finkbeiner (2003, WHAM + VTSS + SHASSA) da NASA LAMBDA: HEALPix NESTED, nside 512, Rayleigh,
   coordinate galattiche, risoluzione 6′. Per ogni oggetto: mediana in una corona attorno (fuori dal nucleo). */
const HA = (() => {
  const buf = fs.readFileSync(path.join(RAW, 'halpha_0512.fits'));
  let off = 0, ends = 0;
  while (ends < 2) { const block = buf.toString('ascii', off, off + 2880); off += 2880; for (let i = 0; i < 2880; i += 80) if (block.slice(i, i + 8) === 'END     ') { ends++; break; } }
  const nside = 512, npix = 12 * nside * nside, map = new Float32Array(npix);
  for (let i = 0; i < npix; i++) map[i] = buf.readFloatBE(off + 4 * i);
  return { nside, map };
})();
function spreadBits(x) { let r = 0; for (let b = 0; b < 10; b++) r |= ((x >> b) & 1) << (2 * b); return r; }
function ang2pixNest(nside, theta, phi) { // algoritmo standard HEALPix
  const z = Math.cos(theta), za = Math.abs(z), tt = ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 2);
  let face, ix, iy;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt), t2 = nside * z * 0.75, jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside), ifm = Math.floor(jm / nside);
    face = ifp === ifm ? (ifp | 4) : ifp < ifm ? ifp : ifm + 8; ix = jm & (nside - 1); iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt, tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp)), jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; } else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return face * nside * nside + spreadBits(ix) + 2 * spreadBits(iy);
}
function toGal(ra, dec) { // J2000 → galattiche
  const aG = 192.85948 * D2R, dG = 27.12825 * D2R, lN = 122.93192, a = ra * D2R, d = dec * D2R;
  const sb = Math.sin(d) * Math.sin(dG) + Math.cos(d) * Math.cos(dG) * Math.cos(a - aG);
  const l = lN - Math.atan2(Math.cos(d) * Math.sin(a - aG), Math.sin(d) * Math.cos(dG) - Math.cos(d) * Math.sin(dG) * Math.cos(a - aG)) / D2R;
  return [((l % 360) + 360) % 360, Math.asin(sb) / D2R];
}
function haAt(ra, dec) { const [l, b] = toGal(ra, dec); return HA.map[ang2pixNest(HA.nside, (90 - b) * D2R, l * D2R)]; }
function diffuseHa(o) {
  const r0 = Math.max(o.a / 2 + 4, 8) / 60, r1 = Math.max(o.a, 50) / 60, vals = [];
  for (let k = 0; k < 3; k++) { const r = r0 + (r1 - r0) * (k + 0.5) / 3; for (let j = 0; j < 12; j++) { const t = j * Math.PI / 6 + k * 0.5; const dd = o.dec + r * Math.cos(t); vals.push(haAt(o.ra + r * Math.sin(t) / Math.cos(o.dec * D2R), clamp(dd, -89.9, 89.9))); } }
  vals.sort((x, y) => x - y); return Math.max(0, vals[Math.floor(vals.length / 2)]);
}
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
for (const o of list) o.ha = diffuseHa(o);

/* ---------- uscita ---------- */
const typeCount = {};
const tipIds = new Set(Object.keys(TIPS));
const rows = list.map((o) => {
  typeCount[o.type] = (typeCount[o.type] || 0) + 1;
  const all = [o.id, ...o.alias];
  const classic = o.src === 'M' || all.some((x) => CLASSIC.has(x)) ? 1 : 0;
  const tipKey = all.find((x) => tipIds.has(x)) || '';
  return [o.id, o.alias.join('|'), o.nick || '', o.type, r4(o.ra), r4(o.dec), r1(o.a), r1(o.b), Math.round(o.pa || 0), o.mag == null ? null : r1(o.mag), r1(Math.min(26, Math.max(15, o.sb))), o.con || '', o.src, classic, tipKey, (o.ctx || []).join('|'), r1(o.ha), all.map((x) => LINE_KEY[x]).find(Boolean) || ''];
});
fs.writeFileSync(path.join(OUT, 'dso.js'),
  '// Generato da scripts/build-data.mjs — non modificare a mano.\n' +
  '// [id, alias, soprannome, tipo, RA°, Dec°, asse maggiore′, minore′, PA°, mag, LS mag/″², costellazione, catalogo, classico, chiave note, contesto, Hα diffuso attorno (Rayleigh, Finkbeiner 2003), profilo di righe]\n' +
  'window.DSO=' + JSON.stringify(rows) + ';\nwindow.TIPS=' + JSON.stringify(TIPS) + ';\n');
console.log('oggetti:', rows.length, typeCount);

/* ---------- cielo: stelle, costellazioni, Via Lattea ---------- */
const stars = json('stars.6.json').features.filter((f) => f.properties.mag <= 6.2).map((f) => {
  let [lon, lat] = f.geometry.coordinates; const ra = lon < 0 ? lon + 360 : lon;
  return [r1(ra * 10) / 10, r1(lat * 10) / 10, r1(f.properties.mag * 10) / 10, f.properties.bv === '' ? 0.6 : r1(parseFloat(f.properties.bv) * 10) / 10];
}).sort((a, b) => a[2] - b[2]);
const lines = json('constellations.lines.json').features.map((f) => ({ id: f.id, l: f.geometry.coordinates.map((ln) => ln.map(([x, y]) => [r1(x < 0 ? x + 360 : x), r1(y)])) }));
const names = json('constellations.json').features.map((f) => ({ id: f.id, n: f.properties.it || f.properties.name, la: f.properties.name, r: +f.properties.rank, p: [r1(f.geometry.coordinates[0] < 0 ? f.geometry.coordinates[0] + 360 : f.geometry.coordinates[0]), r1(f.geometry.coordinates[1])] }));
function simplify(ring, step) { const out = []; for (let i = 0; i < ring.length; i += step) out.push(ring[i]); return out; }
const mw = json('mw.json').features.map((f, lvl) => f.geometry.coordinates.map((poly) => poly.map((ring) => simplify(ring, lvl < 2 ? 3 : 2).map(([x, y]) => [r1(x < 0 ? x + 360 : x), r1(y)]))));
fs.writeFileSync(path.join(OUT, 'sky.js'),
  '// Generato da scripts/build-data.mjs da d3-celestial (BSD-3-Clause) — non modificare a mano.\n' +
  'window.SKY=' + JSON.stringify({ stars, lines, names, mw }) + ';\n');
console.log('stelle:', stars.length, 'linee:', lines.length, 'Via Lattea livelli:', mw.length);
