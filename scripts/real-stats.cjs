// Statistiche delle foto vere per oggetto → src/data/real.js (solo numeri aggregati: nessun autore, titolo o link).
//   node scripts/real-stats.cjs      legge scripts/raw/skyframe-astrobin-dataset-*.json (locale, non nel repository)
// Per oggetto e per gruppo (camera a colori o mono × cielo urbano, di periferia o buio, più i totali per camera): quante
// foto, ore (quartili) e le "ricette" di filtri con quante foto, ore e sub mediani.
const fs = require('fs'), path = require('path');
const { filterOf, monoFilterOf, camOf } = require('./gear.cjs');
global.window = {}; require('../src/data/filters.js');
const FDB = new Map(window.FILTER_DB.map((f) => [f.id, f]));
const RAW = path.join(__dirname, 'raw'), OUT = path.join(__dirname, '..', 'src', 'data', 'real.js');
const ALIAS = { 'Barnard 150': 'B 150', 'Barnard 142': 'B 142', 'Barnard 33': 'B 33' };
const SMART = /Seestar|Celestron Origin|Dwarf|Vespera|Stellina/i;
// classe di Bortle dichiarata → SQM: le mediane fra autori di src/js/model.js (BORTLE_EMP)
const BORTLE_SQM = { 1: 21.85, 2: 21.6, 3: 21.41, 4: 20.9, 5: 19.8, 6: 19.25, 7: 18.6, 8: 18.0, 9: 17.8 };
const sqmOf = (a) => { const s = +a.sqm; if (s >= 16 && s <= 22.3) return s; const b = +a.bortle; if (!(b >= 1 && b <= 9)) return null; const lo = Math.floor(b), hi = Math.ceil(b); return BORTLE_SQM[lo] + (BORTLE_SQM[hi] - BORTLE_SQM[lo]) * (b - lo); };
// fasce di cielo: urbano < 19,25 (Bortle 6 e oltre), periferia 19,25–20,8, buio ≥ 20,8 (Bortle 4 e meno)
const skyOf = (s) => (s < 19.25 ? 'u' : s < 20.8 ? 'p' : 'b');
const has = (f, l) => f.bands.some(([lo, hi]) => lo <= l && hi >= l);
// camera a colori: classe di un filtro: bb (UV/IR o nessuno), lp (anti-inquinamento), duo (Hα+OIII), so (SII+OIII), quad (Hα, Hβ, OIII, SII)
function cls(id) {
  const f = FDB.get(id); if (!f) return null;
  if (f.kind === 'bb') return 'bb'; if (f.kind === 'lp') return 'lp';
  const ha = has(f, 656.3), s2 = has(f, 672.4), o3 = has(f, 500.7);
  return ha && s2 && o3 ? 'quad' : s2 && o3 ? 'so' : ha && o3 ? 'duo' : null;
}
function recipeC(set) {
  const c = [...set];
  if (set.has('duo') && set.has('so')) return 'sho';
  const nb = c.filter((x) => x === 'duo' || x === 'so' || x === 'quad'), bb = c.filter((x) => x === 'bb' || x === 'lp');
  if (nb.length && bb.length) return nb[0] + '+rgb';
  if (nb.length) return nb[0];
  return set.has('lp') ? 'lp' : 'bb';
}
// camera mono: canali usati (Ha, OIII, SII, L, R, G, B)
function recipeM(set) {
  const rgb = set.has('R') && set.has('G') && set.has('B'), nb = set.has('Ha') && set.has('OIII') ? (set.has('SII') ? 'msho' : 'mhoo') : null;
  if (nb) return rgb ? nb + '+rgb' : nb;
  if (set.has('Ha') && rgb) return 'mhargb';
  if (set.has('Ha') && !set.has('OIII') && !set.has('SII') && !rgb && !set.has('L')) return 'mha';
  if (rgb) return set.has('L') ? 'mlrgb' : 'mrgb';
  return null;
}
const MAIN = { msho: 'Ha', mhoo: 'Ha', 'msho+rgb': 'Ha', 'mhoo+rgb': 'Ha', mhargb: 'Ha', mha: 'Ha', mlrgb: 'L', mrgb: 'R', sho: 'duo' };
const q = (a, p) => { const v = [...a].sort((x, y) => x - y); return v[Math.round(p * (v.length - 1))]; };
const r1 = (x) => Math.round(x * 10) / 10;
const files = fs.readdirSync(RAW).filter((f) => /^skyframe-astrobin-dataset-.*\.json$/.test(f)).map((f) => path.join(RAW, f));
const seen = new Set(), by = {};
let first = null;
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const r of d.rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    // telescopi intelligenti a parte: pose di pochi secondi su montatura altazimutale, un altro modo di riprendere
    if ((r.equipment.telescopes || []).some((x) => SMART.test(x))) continue;
    const a = r.acquisition || {}, h = (a.integration_s || 0) / 3600; if (!(h > 0.2)) continue;
    const c0 = (r.equipment.cameras || [])[0]; if (!c0 || (r.equipment.cameras || []).length !== 1) continue;
    const cam = camOf(c0.name, c0.sensor, c0.colorMode); if (!cam) continue;
    const sqm = sqmOf(a); if (sqm == null) continue;
    const mono = cam.type === 'mono', set = new Set(), subs = {}; let bad = false;
    for (const f of a.frames || []) {
      let c;
      if (mono) { const id = monoFilterOf(f.filter); c = id ? (id.startsWith('nbg-') ? id.split('-')[1] : id) : null; }
      else c = cls(filterOf(f.filter || ''));
      if (!c) { bad = true; break; }
      set.add(c); if (f.exposure_s) (subs[c] = subs[c] || []).push(f.exposure_s);
    }
    if (bad || !set.size) continue;
    const rec = mono ? recipeM(set) : recipeC(set); if (!rec) continue;
    const dt = (a.dates || []).slice(-1)[0]; if (dt && (!first || dt < first)) first = dt;
    const t = ALIAS[r.target] || r.target, k = (mono ? 'm' : 'c') + skyOf(sqm);
    (by[t] = by[t] || []).push({ h, rec, subs, k });
  }
}
function stats(v) {
  const g = {};
  v.forEach((x) => (g[x.rec] = g[x.rec] || []).push(x));
  // [ricetta, foto, ore mediane, sub mediano del filtro principale]
  const recs = Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, w]) => {
    const main = MAIN[k] || k.split('+')[0], s = w.flatMap((x) => x.subs[main] || []);
    const sub = s.length ? q(s, 0.5) : 0;
    return [k, w.length, r1(q(w.map((x) => x.h), 0.5)), sub > 60 ? Math.round(sub / 10) * 10 : sub];
  });
  const hs = v.map((x) => x.h);
  return [v.length, r1(q(hs, 0.25)), r1(q(hs, 0.5)), r1(q(hs, 0.75)), recs];
}
const out = {}, tot = { c: 0, m: 0 };
for (const [t, v] of Object.entries(by)) {
  const o = {};
  for (const k of ['cu', 'cp', 'cb', 'mu', 'mp', 'mb']) { const w = v.filter((x) => x.k === k); if (w.length >= 3) o[k] = stats(w); }
  for (const c of ['c', 'm']) { const w = v.filter((x) => x.k[0] === c); if (w.length >= 3) { o[c] = stats(w); tot[c] += w.length; } }
  if (Object.keys(o).length) out[t] = o;
}
const n = tot.c + tot.m, since = first ? +first.slice(0, 4) : 2020;
const head = `// Foto vere: ${n} immagini su AstroBin con telescopio (${tot.c} con camera a colori, ${tot.m} mono), almeno 25 apprezzamenti, riprese dal ${since}, ${Object.keys(out).length} oggetti.
// Generato da scripts/real-stats.cjs. Per oggetto e gruppo: [foto, ore 1° quartile, mediana, 3° quartile, [[ricetta, foto, ore mediane, sub s]]].
// Gruppi: c camera a colori (anche reflex), m mono; u cielo urbano (SQM < 19,25), p periferia (19,25–20,8), b buio (≥ 20,8);
// "c" e "m" da soli: tutti i cieli. SQM dichiarato dall'autore o, in mancanza, dalla classe di Bortle (mediane fra autori).
// Ricette a colori: bb banda larga, lp anti-inquinamento, duo Hα+OIII, so SII+OIII, quad quattro righe, sho duo+so, "+rgb" con
// banda larga. Mono: msho, mhoo (anche "+rgb" per le stelle), mhargb Hα+RGB, mha solo Hα, mlrgb, mrgb.\n`;
fs.writeFileSync(OUT, head + 'window.REAL = ' + JSON.stringify({ n, nc: tot.c, nm: tot.m, since, likes: 25, o: out }) + ';\n');
console.log(`${Object.keys(out).length} oggetti, ${n} foto (colori ${tot.c}, mono ${tot.m}) → ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} byte)`);
