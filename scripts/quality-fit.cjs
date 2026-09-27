// Livello di qualità per oggetto, dalle foto vere → src/data/quality.js
//   node scripts/quality-fit.cjs              adatta su tutte le foto e scrive il file
//   CAL_SET=taratura node scripts/quality-fit.cjs   adatta solo sulla prima raccolta (per verificare sulla seconda)
//
// 1. Difficoltà fisica di ogni oggetto del catalogo, D: ore a SNR di riferimento con un setup fisso (rifrattore 100 mm
//    f/5,5, camera a colori IMX571, UV/IR e L-eXtreme, cielo SQM 19,0, latitudine 45°, la notte in cui l'oggetto passa al
//    meridiano verso mezzanotte, senza Luna). Serve solo come misura della difficoltà, uguale per tutti.
// 2. Per ogni foto (scripts/calibrate.cjs con CAL_NOQ=1): g = ore vere / ore fisiche a SNR di riferimento con la SUA
//    attrezzatura e il SUO cielo. g dice a che SNR è arrivata la foto: SNR = SNR_rif · √g.
// 3. Per ogni oggetto con foto: g_o = mediana delle sue foto (solo camere a colori). Adattamento pesato (√foto):
//    log g_o = a + b · log D. Per gli oggetti senza foto si usa la previsione; per quelli con n foto la media pesata
//    (n · g_o + K · previsione) / (n + K), K = 6 (scelto verificando su metà delle foto: errore minimo).
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..'), src = (f) => path.join(root, 'src', f), OUT = src('data/quality.js');
const K = 6, L = Math.log10;
global.window = {};
['data/filters.js', 'data/dso.js', 'data/sky.js'].forEach((f) => require(src(f)));
const I18N_STUB = "const LANG = 'it', LOCALE = 'it-IT', txName = (n) => n, tx = (s, p) => (p ? s.replace(/[{](\\w+)[}]/g, (m, k) => (k in p ? p[k] : m)) : s);";
vm.runInThisContext(I18N_STUB + ';' + fs.readFileSync(src('js/astro.js'), 'utf8') + '\n' + fs.readFileSync(src('js/model.js'), 'utf8') +
  '\n;globalThis.__m={templateProfile,profileConfigs,computePrep,computeObj,hoursOf,pickBest,CAT,refDifficulty};');
const M = globalThis.__m;

// ---- 1. difficoltà: la stessa funzione dell'app (model.js, refDifficulty) ----
const difficulty = (o) => M.refDifficulty(o);
const D = new Map(); let t0 = Date.now();
for (const o of M.CAT) { const d = difficulty(o); if (d != null) D.set(o.id, d); }
console.log(`difficoltà calcolata per ${D.size} oggetti su ${M.CAT.length} (${Date.now() - t0} ms)`);

// ---- 2. foto: g per foto, con la fisica pura ----
const tmp = path.join(require('os').tmpdir(), 'sf-quality-rows.json');
cp.execFileSync(process.execPath, [path.join(__dirname, 'calibrate.cjs')], { env: { ...process.env, CAL_NOQ: '1', CAL_DUMP: tmp }, stdio: 'ignore' });
const rows = JSON.parse(fs.readFileSync(tmp, 'utf8')).filter((r) => !r.skip && !r.mono && r.model > 0);
const by = {}; rows.forEach((r) => (by[r.t] = by[r.t] || []).push(r.lr));
const med = (a) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor((v.length - 1) / 2)]; };
const O = Object.entries(by).filter(([t]) => D.has(t)).map(([t, v]) => ({ t, n: v.length, g: med(v), d: D.get(t) }));

// ---- 3. adattamento ----
function fit(list) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const o of list) { const w = Math.sqrt(o.n); sw += w; sx += w * o.d; sy += w * o.g; sxx += w * o.d * o.d; sxy += w * o.d * o.g; }
  const b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), a = (sy - b * sx) / sw; return { a, b };
}
const F = fit(O), pred = (d) => F.a + F.b * d;
// errore lasciando fuori l'oggetto (solo previsione)
const loo = O.map((o) => { const f = fit(O.filter((x) => x !== o)); return Math.abs(o.g - (f.a + f.b * o.d)); });
console.log(`${O.length} oggetti, ${rows.length} foto · log g = ${F.a.toFixed(3)} ${F.b.toFixed(3)}·log D · errore sull'oggetto lasciato fuori: mediana ×${Math.pow(10, med(loo)).toFixed(2)}`);
const dv = [...D.values()], d0 = med(dv), typeD = {};
for (const t of ['EN', 'PN', 'SNR', 'RN', 'DN', 'Gx', 'OC', 'GC']) { const v = M.CAT.filter((o) => o.type === t && D.has(o.id)).map((o) => D.get(o.id)); if (v.length) typeD[t] = +med(v).toFixed(3); }
const out = {};
for (const o of M.CAT) {
  const d = D.has(o.id) ? D.get(o.id) : null, p = d != null ? pred(d) : pred(typeD[o.type] != null ? typeD[o.type] : d0), ob = O.find((x) => x.t === o.id);
  const g = ob ? (ob.n * ob.g + K * p) / (ob.n + K) : p;
  out[o.id] = [d != null ? Math.round(d * 100) : null, Math.round(g * 100), ob ? ob.n : 0];
}
const head = `// Livello di qualità per oggetto, dalle foto vere (scripts/quality-fit.cjs; ${new Date().toISOString().slice(0, 10)}, ${rows.length} foto a colori di ${O.length} oggetti).
// a, b: log10 g = a + b · log10 D (D = ore a SNR di riferimento col setup di riferimento); o[id] = [100·log10 D, 100·log10 g, foto dell'oggetto].
// g moltiplica le ore fisiche a SNR di riferimento: è il SNR² relativo che raggiunge la foto mediana apprezzata di quell'oggetto.\n`;
fs.writeFileSync(OUT, head + 'window.QUALITY_OBJ = ' + JSON.stringify({ a: +F.a.toFixed(4), b: +F.b.toFixed(4), k: K, d0: +d0.toFixed(3), typeD, set: process.env.CAL_SET || 'tutte', o: out }) + ';\n');
console.log(`→ ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} byte)`);
