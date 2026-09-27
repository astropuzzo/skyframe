// Casi rappresentativi: camera a colori e mono, cieli di diversa luminosità, oggetti a emissione e a spettro continuo,
// un filtro o combinazioni. Confronta il modello attuale con un'altra versione (CASES_OLD=percorso di un model.js,
// CASES_OLD_Q=il suo quality.js, se ne aveva uno).
//   node scripts/check-cases.cjs [> docs/VERIFICA-casi.md]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), src = (f) => path.join(root, 'src', f);
function load(modelPath, qualityPath) {
  const ctx = { window: {}, console, Math, Date, JSON, Map, Set, Float32Array, Float64Array, Uint8Array, Array, Object, Number, String, isFinite, isNaN, parseFloat, parseInt, Infinity, NaN };
  vm.createContext(ctx);
  for (const f of ['data/filters.js', 'data/dso.js', 'data/sky.js']) vm.runInContext(fs.readFileSync(src(f), 'utf8'), ctx);
  if (qualityPath) vm.runInContext(fs.readFileSync(qualityPath, 'utf8'), ctx);
  vm.runInContext("const LANG = 'it', LOCALE = 'it-IT', txName = (n) => n, tx = (s, p) => (p ? s.replace(/[{](\\w+)[}]/g, (m, k) => (k in p ? p[k] : m)) : s);" + fs.readFileSync(src('js/astro.js'), 'utf8') + '\n' + fs.readFileSync(modelPath, 'utf8') + "\n;this.__m={templateProfile,profileConfigs,computePrep,computeObj,hoursOf,CAT_BY_ID,moonHoursOf:typeof moonHoursOf==='function'?moonHoursOf:null};", ctx);
  return ctx.__m;
}
const NEW = load(src('js/model.js'), src('data/quality.js')), OLD = process.env.CASES_OLD ? load(process.env.CASES_OLD, process.env.CASES_OLD_Q) : null;
global.window = {}; require(src('data/real.js')); const REAL = window.REAL.o;
function profile(M, cam, filters, sqm) {
  const p = M.templateProfile();
  p.camera = { preset: 'x', name: cam, w: 6248, h: 4176, pix: 3.76, type: cam === 'mono' ? 'mono' : 'osc', qe: cam === 'mono' ? 87 : 80, rn: 1.5 };
  p.optics = [{ id: 'o1', name: 'rifrattore 100/550', ap: 100, fl: 550, obs: 0, useNative: true, accessories: [] }];
  p.filters.owned = filters; p.site = { name: 'x', lat: 45, lon: 10, bortle: 6, sqm }; p.horizon = []; p.session.minAlt = 20; p.session.quality = 'good'; p.session.goal = 'snr';
  return p;
}
function run(M, cam, filters, sqm, id) {
  const o = M.CAT_BY_ID.get(id); if (!o) return null;
  const p = profile(M, cam, filters, sqm), mon = ((Math.round(3 + (o.ra / 15 - 12) / 2) % 12) + 12) % 12, ds = `2026-${String(mon + 1).padStart(2, '0')}-10`;
  const x = M.computeObj(M.computePrep(M.profileConfigs(p), p, ds, Date.now()), o), b = x && x.evals[0].best; if (!b) return { h: null, s: '—' };
  return { h: M.hoursOf(b), s: b.label };
}
const OSC_SETS = [['UV/IR', ['uvir']], ['L-eXtreme', ['lextreme']], ['UV/IR + L-eXtreme', ['uvir', 'lextreme']], ['L-eXtreme + L-Synergy', ['lextreme', 'lsynergy']]];
const MONO_SETS = [['LRGB', ['L', 'R', 'G', 'B']], ['LRGB + Hα/OIII/SII 3 nm', ['L', 'R', 'G', 'B', 'opt3-Ha', 'opt3-OIII', 'opt3-SII']]];
const OBJ = [['NGC 7000', 'emissione'], ['IC 1396', 'emissione'], ['M 27', 'planetaria'], ['NGC 6992', 'resto di SN'], ['M 31', 'galassia'], ['M 51', 'galassia'], ['NGC 7023', 'riflessione'], ['M 13', 'globulare']];
const SKIES = [18.0, 19.3, 21.3];
const f = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
let out = `# Casi rappresentativi\n\nGenerato da \`scripts/check-cases.cjs\` il ${new Date().toISOString().slice(0, 10)}. Rifrattore 100 mm f/5,5, sensore IMX571 (3,76 µm, a colori: QE 80%, mono: QE 87%), latitudine 45°, notte in cui l'oggetto passa al meridiano verso mezzanotte, senza Luna, livello «buona», obiettivo «minor tempo per il SNR». Colonne: combinazione scelta e integrazione; fra parentesi il modello della versione precedente (${process.env.CASES_OLD_V || 'CASES_OLD'}).${OLD ? '' : ' (Versione precedente non caricata: CASES_OLD non impostato.)'}\n`;
for (const [cam, sets] of [['osc', OSC_SETS], ['mono', MONO_SETS]]) {
  for (const sqm of SKIES) {
    out += `\n## Camera ${cam === 'osc' ? 'a colori' : 'monocromatica'}, SQM ${String(sqm).replace('.', ',')}\n\n| Oggetto | ${sets.map(([n]) => n).join(' | ')} |\n| --- | ${sets.map(() => '---').join(' | ')} |\n`;
    for (const [id, kind] of OBJ) {
      const cells = sets.map(([, fl]) => { const a = run(NEW, cam, fl, sqm, id), b = OLD ? run(OLD, cam, fl, sqm, id) : null; return `${a ? a.s + ': ' + f(a.h) : '—'}${b ? ` (${f(b.h)})` : ''}`; });
      out += `| ${id} (${kind}) | ${cells.join(' | ')} |\n`;
    }
  }
}
// con la Luna: la notte più illuminata del mese in cui l'oggetto passa al meridiano verso mezzanotte
function runMoon(M, cam, filters, sqm, id) {
  const o = M.CAT_BY_ID.get(id); if (!o) return null;
  const p = profile(M, cam, filters, sqm), cfgs = M.profileConfigs(p), mon = ((Math.round(3 + (o.ra / 15 - 12) / 2) % 12) + 12) % 12;
  let C = null; for (let d = 1; d <= 28; d++) { const c = M.computePrep(cfgs, p, `2026-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, Date.now()); if (!C || c.night.moonIll > C.night.moonIll) C = c; }
  const x = M.computeObj(C, o), e = x && x.evals[0]; if (!e || !e.best) return null;
  return { ill: C.night.moonIll, sep: x.minSep, dark: `${e.best.label}: ${f(M.hoursOf(e.best))}`, same: f(M.moonHoursOf(e.best)), moon: e.moonBest ? `${e.moonBest.label}: ${f(M.moonHoursOf(e.moonBest))}` : 'la stessa' };
}
if (NEW.moonHoursOf) {
  out += `
## Con la Luna

Stessi casi nella notte più illuminata del mese, con cielo SQM 19,3 (città) e 21,3 (sito buio). La combinazione senza Luna serve al confronto fra luoghi e filtri; con la Luna della notte si ricalcola la più rapida, con le stesse regole di ammissione, e si propone solo se riduce il tempo di almeno il 15%. Tempi con la Luna: integrazione necessaria con notti come quella.

| Camera e filtri | SQM | Oggetto | Luna (illuminazione, distanza minima) | Senza Luna | Stessa combinazione con la Luna | Più rapida con la Luna |
| --- | --- | --- | --- | --- | --- | --- |
`;
  for (const [cam, name, fl] of [['osc', 'colori, UV/IR + L-eXtreme', ['uvir', 'lextreme']], ['mono', 'mono, LRGB + Hα/OIII/SII 3 nm', ['L', 'R', 'G', 'B', 'opt3-Ha', 'opt3-OIII', 'opt3-SII']]])
    for (const sqm of [19.3, 21.3]) for (const [id] of OBJ) { const a = runMoon(NEW, cam, fl, sqm, id); if (a) out += `| ${name} | ${String(sqm).replace('.', ',')} | ${id} | ${Math.round(a.ill * 100)}%, ${Math.round(a.sep)}° | ${a.dark} | ${a.same} | ${a.moon} |\n`; }
}
// confronto con le foto, ognuna con la SUA attrezzatura e il SUO cielo (scripts/calibrate.cjs, CAL_DUMP): rapporto ore vere / modello
if (process.env.CASES_CAL) {
  const R = JSON.parse(fs.readFileSync(process.env.CASES_CAL, 'utf8')).filter((r) => !r.skip && !r.mono);
  const med = (v) => { const x = [...v].sort((p, q) => p - q); return x[Math.floor((x.length - 1) / 2)]; };
  out += `
## Confronto con le foto di riferimento

Per ogni foto il modello rifà il conto con il telescopio, la camera, i filtri e il cielo (classe Bortle dichiarata) di quella foto, e lo confronta con le ore dichiarate. Rapporto ore vere / modello al livello «buona»: 1 = il modello coincide con la foto mediana.

| Oggetto | foto | rapporto mediano | metà centrale |
| --- | --- | --- | --- |
`;
  for (const [id] of OBJ) { const v = R.filter((r) => r.t === id).map((r) => Math.pow(10, r.lr)).sort((p, q) => p - q); if (!v.length) { out += `| ${id} | 0 | — | — |
`; continue; } out += `| ${id} | ${v.length} | ×${med(v).toFixed(2)} | ×${v[Math.floor(v.length * 0.25)].toFixed(2)} – ×${v[Math.floor(v.length * 0.75)].toFixed(2)} |
`; }
}
process.stdout.write(out);
