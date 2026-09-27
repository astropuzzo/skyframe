// Livello di qualità per oggetto, dalle foto vere → src/data/quality.js
//   node scripts/quality-fit.cjs              adatta su tutte le foto e scrive il file
//   CAL_SET=taratura node scripts/quality-fit.cjs   adatta solo sulla prima raccolta (per verificare sulla seconda)
//
// 1. Difficoltà fisica di ogni oggetto del catalogo, D: ore a SNR di riferimento con un setup fisso (rifrattore 100 mm
//    f/5,5, camera a colori IMX571, UV/IR e L-eXtreme, cielo SQM 19,0, latitudine 45°, la notte in cui l'oggetto passa al
//    meridiano verso mezzanotte, senza Luna). Serve solo come misura della difficoltà, uguale per tutti.
// 2. Per ogni foto (scripts/calibrate.cjs con CAL_NOQ=1): g = ore vere / ore fisiche a SNR di riferimento con la SUA
//    attrezzatura e il SUO cielo. g dice a che SNR è arrivata la foto: SNR = SNR_rif · √g.
// 3. Le foto vengono da camere e cieli diversi. In log g: effetto dell'oggetto + camera (mono, reflex, reflex modificata,
//    rispetto a una camera a colori astronomica; per la mono separato fra oggetti a righe e a spettro continuo) + cielo (pendenza per magnitudine di SQM), stimati insieme (effetti fissi,
//    minimi quadrati). Ogni foto si riporta al riferimento (camera a colori, SQM 19,0) togliendo gli effetti di camera e
//    cielo; g_o = mediana delle foto riportate. Evidenza, non fisica: le ore dichiarate cambiano poco con camera e cielo,
//    quindi chi ha un setup più efficiente arriva a un SNR più alto.
// 4. Adattamento pesato (√foto): log g_o = a + b · log D. Per gli oggetti senza foto si usa la previsione; per quelli con n
//    foto la media pesata (n · g_o + K · previsione) / (n + K), K = 6 (scelto verificando su metà delle foto: errore minimo).
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..'), src = (f) => path.join(root, 'src', f), OUT = src('data/quality.js');
const K = 6, L = Math.log10;
global.window = {};
['data/filters.js', 'data/dso.js', 'data/sky.js'].forEach((f) => require(src(f)));
const I18N_STUB = "const LANG = 'it', LOCALE = 'it-IT', txName = (n) => n, tx = (s, p) => (p ? s.replace(/[{](\\w+)[}]/g, (m, k) => (k in p ? p[k] : m)) : s);";
vm.runInThisContext(I18N_STUB + ';' + fs.readFileSync(src('js/astro.js'), 'utf8') + '\n' + fs.readFileSync(src('js/model.js'), 'utf8') +
  '\n;globalThis.__m={templateProfile,profileConfigs,computePrep,computeObj,hoursOf,pickBest,CAT,refDifficulty,LINES};');
const M = globalThis.__m;

// ---- 1. difficoltà: la stessa funzione dell'app (model.js, refDifficulty) ----
const difficulty = (o) => M.refDifficulty(o);
const D = new Map(); let t0 = Date.now();
for (const o of M.CAT) { const d = difficulty(o); if (d != null) D.set(o.id, d); }
console.log(`difficoltà calcolata per ${D.size} oggetti su ${M.CAT.length} (${Date.now() - t0} ms)`);

// ---- 2. foto: g per foto, con la fisica pura ----
const tmp = path.join(require('os').tmpdir(), 'sf-quality-rows.json');
cp.execFileSync(process.execPath, [path.join(__dirname, 'calibrate.cjs')], { env: { ...process.env, CAL_NOQ: '1', CAL_DUMP: tmp }, stdio: 'ignore' });
const rows = JSON.parse(fs.readFileSync(tmp, 'utf8')).filter((r) => !r.skip && r.model > 0 && isFinite(r.lr) && r.sqm > 0);
const med = (a) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor((v.length - 1) / 2)]; };
const REF_SQM = 19.0;
const camK = (r) => (r.mono ? 'mono' : r.cam === 'dslr' || r.kind === 'bb-dslr' || r.dslr ? 'reflex' : r.cam === 'dslrmod' ? 'reflexMod' : 'colori');
// l'effetto della camera mono è diverso sugli oggetti a righe (banda stretta) e a spettro continuo
const righe = (r) => !!M.LINES[r.lk];
const COV = [['monoRighe', (r) => (camK(r) === 'mono' && righe(r) ? 1 : 0)], ['monoContinuo', (r) => (camK(r) === 'mono' && !righe(r) ? 1 : 0)], ['reflex', (r) => (camK(r) === 'reflex' ? 1 : 0)], ['reflexMod', (r) => (camK(r) === 'reflexMod' ? 1 : 0)], ['sky', (r) => r.sqm - REF_SQM]];
const beta = Object.fromEntries(COV.map(([k]) => [k, 0])), fe = new Map(), covOf = (r) => COV.reduce((a, [k, f]) => a + beta[k] * f(r), 0);
for (let it = 0; it < 300; it++) { // effetti fissi dell'oggetto e coefficienti, a turno (backfitting)
  const sm = new Map(), n = new Map(); rows.forEach((r) => { sm.set(r.t, (sm.get(r.t) || 0) + r.lr - covOf(r)); n.set(r.t, (n.get(r.t) || 0) + 1); }); sm.forEach((v, k) => fe.set(k, v / n.get(k)));
  for (const [k, f] of COV) { let sxy = 0, sxx = 0; rows.forEach((r) => { const x = f(r); if (!x) return; sxy += x * (r.lr - fe.get(r.t) - covOf(r) + beta[k] * x); sxx += x * x; }); if (sxx) beta[k] = sxy / sxx; }
}
const cnt = (k) => rows.filter((r) => camK(r) === k).length;
console.log(`effetti (log10): ${COV.map(([k]) => `${k} ${beta[k] >= 0 ? '+' : ''}${beta[k].toFixed(3)} (×${Math.pow(10, beta[k]).toFixed(2)})`).join(' · ')} · foto: colori ${cnt('colori')}, reflex ${cnt('reflex')}, reflex mod. ${cnt('reflexMod')}, mono ${cnt('mono')}`);
const by = {}; rows.forEach((r) => (by[r.t] = by[r.t] || []).push(r.lr - covOf(r)));
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
const head = `// Livello di qualità per oggetto, dalle foto vere (scripts/quality-fit.cjs; ${new Date().toISOString().slice(0, 10)}, ${rows.length} foto di ${O.length} oggetti).
// a, b: log10 g = a + b · log10 D (D = ore a SNR di riferimento col setup di riferimento); o[id] = [100·log10 D, 100·log10 g, foto dell'oggetto].
// g moltiplica le ore fisiche a SNR di riferimento: è il SNR² relativo che raggiunge la foto mediana apprezzata di quell'oggetto,
// riportata al riferimento ref (camera a colori, SQM ref.sqm). grp: di quanto è più alto (log10) il SNR² delle foto fatte con
// camera mono o reflex e, per magnitudine di cielo più buio, rispetto al riferimento (evidenza, non fisica).\n`;
fs.writeFileSync(OUT, head + 'window.QUALITY_OBJ = ' + JSON.stringify({ a: +F.a.toFixed(4), b: +F.b.toFixed(4), k: K, d0: +d0.toFixed(3), typeD, set: process.env.CAL_SET || 'tutte', ref: { sqm: REF_SQM, cam: 'osc' }, grp: Object.fromEntries(COV.map(([k]) => [k, +beta[k].toFixed(3)])), o: out }) + ';\n');
console.log(`→ ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} byte)`);
