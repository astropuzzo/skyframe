// Statistiche delle foto vere per oggetto → src/data/real.js (solo numeri aggregati: nessun autore, titolo o link).
//   node scripts/real-stats.cjs      legge scripts/raw/skyframe-astrobin-dataset-*.json (locale, non nel repository)
// Per ogni oggetto: quante foto, ore (quartili) e le "ricette" di filtri con quante foto, ore e sub mediani.
const fs = require('fs'), path = require('path');
const { filterOf } = require('./gear.cjs');
global.window = {}; require('../src/data/filters.js');
const FDB = new Map(window.FILTER_DB.map((f) => [f.id, f]));
const RAW = path.join(__dirname, 'raw'), OUT = path.join(__dirname, '..', 'src', 'data', 'real.js');
const ALIAS = { 'Barnard 150': 'B 150', 'Barnard 142': 'B 142', 'Barnard 33': 'B 33' };
const SMART = /Seestar|Celestron Origin|Dwarf|Vespera|Stellina/i;
const has = (f, l) => f.bands.some(([lo, hi]) => lo <= l && hi >= l);
// classe di un filtro: bb (UV/IR o nessuno), lp (anti-inquinamento), duo (Hα+OIII), so (SII+OIII), quad (Hα, Hβ, OIII, SII)
function cls(id) {
  const f = FDB.get(id); if (!f) return null;
  if (f.kind === 'bb') return 'bb'; if (f.kind === 'lp') return 'lp';
  const ha = has(f, 656.3), s2 = has(f, 672.4), o3 = has(f, 500.7);
  return ha && s2 && o3 ? 'quad' : s2 && o3 ? 'so' : ha ? 'duo' : null;
}
// ricetta di una foto dalle classi usate
function recipe(set) {
  const c = [...set];
  if (set.has('duo') && set.has('so')) return 'sho';
  const nb = c.filter((x) => x === 'duo' || x === 'so' || x === 'quad'), bb = c.filter((x) => x === 'bb' || x === 'lp');
  if (nb.length && bb.length) return nb[0] + '+rgb';
  if (nb.length) return nb[0];
  return set.has('lp') ? 'lp' : 'bb';
}
const q = (a, p) => { const v = [...a].sort((x, y) => x - y); return v[Math.round(p * (v.length - 1))]; };
const r1 = (x) => Math.round(x * 10) / 10;
const files = fs.readdirSync(RAW).filter((f) => /^skyframe-astrobin-dataset-.*\.json$/.test(f)).map((f) => path.join(RAW, f));
const seen = new Set(), by = {};
let meta = null;
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8')); meta = meta || d.__dataset__;
  for (const r of d.rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    // telescopi intelligenti a parte: pose di pochi secondi su montatura altazimutale, un altro modo di riprendere
    if ((r.equipment.telescopes || []).some((x) => SMART.test(x))) continue;
    const a = r.acquisition || {}, h = (a.integration_s || 0) / 3600; if (!(h > 0.2)) continue;
    const set = new Set(), subs = {}; let bad = false;
    for (const f of a.frames || []) {
      const c = cls(filterOf(f.filter || '')); if (!c) { bad = true; break; }
      set.add(c); if (f.exposure_s) (subs[c] = subs[c] || []).push(f.exposure_s);
    }
    if (bad || !set.size) continue;
    const t = ALIAS[r.target] || r.target;
    (by[t] = by[t] || []).push({ h, rec: recipe(set), subs });
  }
}
const out = {};
for (const [t, v] of Object.entries(by)) {
  if (v.length < 3) continue;
  const hs = v.map((x) => x.h), g = {};
  v.forEach((x) => (g[x.rec] = g[x.rec] || []).push(x));
  // [ricetta, foto, ore mediane, sub mediano del filtro principale]
  const recs = Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, w]) => {
    const main = k === 'sho' ? 'duo' : k.split('+')[0], s = w.flatMap((x) => x.subs[main] || []);
    const sub = s.length ? q(s, 0.5) : 0;
    return [k, w.length, r1(q(w.map((x) => x.h), 0.5)), sub > 60 ? Math.round(sub / 10) * 10 : sub];
  });
  out[t] = [v.length, r1(q(hs, 0.25)), r1(q(hs, 0.5)), r1(q(hs, 0.75)), recs];
}
const n = Object.values(out).reduce((a, x) => a + x[0], 0);
const head = `// Foto vere: ${n} immagini con telescopio e camera a colori su AstroBin da cieli Bortle 6–8 (almeno 30 like, riprese dal 2024), ${Object.keys(out).length} oggetti.
// Generato da scripts/real-stats.cjs. Per oggetto: [foto, ore 1° quartile, mediana, 3° quartile, [[ricetta, foto, ore mediane, sub s]]]
// Ricette: bb banda larga, lp anti-inquinamento, duo Hα+OIII, so SII+OIII, quad quattro righe, sho duo+so, "+rgb" con banda larga.\n`;
fs.writeFileSync(OUT, head + 'window.REAL = ' + JSON.stringify({ n, bortle: [6, 8], since: 2024, likes: 30, o: out }) + ';\n');
console.log(`${Object.keys(out).length} oggetti, ${n} foto → ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} byte)`);
