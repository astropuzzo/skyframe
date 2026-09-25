// Confronto del modello con foto reali: per ogni foto rifà i conti con il suo strumento, i suoi filtri e il suo cielo e
// confronta le ore del modello (qualità "buona", senza Luna, per pannello) con l'integrazione dichiarata.
//   node scripts/calibrate.cjs [file.jsonl]      (predefinito: scripts/raw/astrobin-calib.jsonl, non nel repository)
// Una riga per foto: { t: id del target, ap: apertura mm, scale: ″/px, pix: µm, obs: % ostruzione, kind, h: ore,
//   bortle | sqm, qe?, dslr?, split?: ore per filtro, note? } — kind: bb, bb-dslr, dual, dual3, dual-so, multi, sho-osc,
//   bb+dual, bb+dual3, mono-lrgb, mono-rgb, mono-hargb, mono-hoo, mono-hoo-rgb, mono-sho, mono-ha.
// Le note "solo il centro", "parte", "prova", "IFN", "alone", "misto" escludono la foto dalle statistiche.
const path = require('path'), fs = require('fs'), vm = require('vm');
const root = path.join(__dirname, '..'), src = (f) => path.join(root, 'src', f);
global.window = {};
['data/filters.js', 'data/dso.js', 'data/sky.js'].forEach((f) => require(src(f)));
const I18N_STUB = "const LANG = 'it', LOCALE = 'it-IT', txName = (n) => n, tx = (s, p) => (p ? s.replace(/[{](\\w+)[}]/g, (m, k) => (k in p ? p[k] : m)) : s);";
vm.runInThisContext(I18N_STUB + ';' + fs.readFileSync(src('js/astro.js'), 'utf8') + '\n' + fs.readFileSync(src('js/model.js'), 'utf8') +
  '\n;globalThis.__m={templateProfile,profileConfigs,computePrep,computeObj,hoursOf,BORTLE_SQM,CAT_BY_ID};');
const M = globalThis.__m;
const OWN = {
  bb: ['uvir'], 'bb-dslr': ['uvir'], dual: ['lextreme'], dual3: ['lultimate'], 'dual-so': ['lsynergy'], multi: ['triband'], 'sho-osc': ['lextreme', 'lsynergy'],
  'bb+dual': ['uvir', 'lextreme'], 'bb+dual3': ['uvir', 'lultimate'],
  'mono-lrgb': ['L', 'R', 'G', 'B'], 'mono-rgb': ['R', 'G', 'B'], 'mono-hargb': ['L', 'R', 'G', 'B', 'opt3-Ha'],
  'mono-hoo': ['opt3-Ha', 'opt3-OIII'], 'mono-hoo-rgb': ['R', 'G', 'B', 'opt3-Ha', 'opt3-OIII'], 'mono-sho': ['opt3-Ha', 'opt3-OIII', 'opt3-SII'], 'mono-ha': ['opt3-Ha'],
};
const PICK = {
  bb: 'bb-uvir', 'bb-dslr': 'bb-uvir', dual: 'nb-lextreme', dual3: 'nb-lultimate', 'dual-so': 'nb-lsynergy', multi: 'bb-triband', 'sho-osc': 'sho-', 'bb+dual': 'nb-lextreme', 'bb+dual3': 'nb-lultimate',
  'mono-lrgb': 'lrgb', 'mono-rgb': 'rgb', 'mono-hargb': 'hargb', 'mono-hoo': 'hoo', 'mono-hoo-rgb': 'hoo', 'mono-sho': 'sho', 'mono-ha': 'ha',
};
const file = process.argv[2] || path.join(root, 'scripts', 'raw', 'astrobin-calib.jsonl');
const recs = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const L = Math.log10, rows = [];
for (const r of recs) {
  const o = M.CAT_BY_ID.get(r.t); if (!o || !OWN[r.kind]) continue;
  const sqm = r.sqm || M.BORTLE_SQM[r.bortle || 4]; // senza dato: Bortle 4
  const mono = r.kind.startsWith('mono'), pix = r.pix || 3.76, p = M.templateProfile();
  p.camera = { preset: 'x', name: 'x', w: 6000, h: 4000, pix, type: mono ? 'mono' : r.kind === 'bb-dslr' || r.dslr ? 'dslr' : 'osc', qe: r.qe || (mono ? 85 : 80), rn: 1.5 };
  p.optics = [{ id: 'o1', name: 'x', ap: r.ap, fl: 206.265 * pix / r.scale, obs: r.obs || 0, useNative: true, accessories: [] }];
  p.filters.owned = OWN[r.kind]; p.site = { name: 'x', lat: 45, lon: 10, bortle: 4, sqm }; p.horizon = []; p.session.minAlt = 20; p.session.quality = 'good';
  // la notte in cui l'oggetto passa al meridiano verso mezzanotte
  const mon = ((Math.round(3 + (o.ra / 15 - 12) / 2) % 12) + 12) % 12, ds = `2026-${String(mon + 1).padStart(2, '0')}-10`;
  const x = M.computeObj(M.computePrep(M.profileConfigs(p), p, ds, Date.now()), o); if (!x) continue;
  let pick = PICK[r.kind], real = r.h;
  if (r.kind === 'mono-hargb' && o.type === 'Gx') { pick = 'lrgb'; if (r.split && r.split.Ha) real -= r.split.Ha; } // nelle galassie l'Hα serve alle regioni HII
  const s = x.evals[0].strat.find((z) => (pick.endsWith('-') ? z.id.startsWith(pick) : z.id === pick)); if (!s) continue;
  const model = M.hoursOf(s) / (s.panels || 1);
  if (!isFinite(model)) continue;
  rows.push({ r, o, sqm, model, lr: L(real / model), mono, sky: !!(r.sqm || r.bortle), skip: /solo|parte|prova|IFN|alone|misto|Ou4/.test(r.note || '') });
}
const ok = rows.filter((x) => !x.skip);
const q = (a, p) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(p * (v.length - 1))]; };
const f = (lr) => '×' + Math.pow(10, lr).toFixed(2);
const byO = {}; ok.forEach((x) => (byO[x.o.id] = byO[x.o.id] || []).push(x.lr));
const om = Object.fromEntries(Object.entries(byO).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
const mean = Object.values(om).reduce((a, b) => a + b, 0) / Object.keys(om).length;
const within = Math.sqrt(ok.reduce((s, x) => s + (x.lr - om[x.o.id]) ** 2, 0) / ok.length);
const between = Math.sqrt(Object.values(om).reduce((s, v) => s + (v - mean) ** 2, 0) / Object.keys(om).length);
console.log(`${ok.length} foto di ${Object.keys(om).length} oggetti (${rows.length - ok.length} escluse perché parziali o speciali)`);
console.log(`reale/modello a qualità "buona": media per oggetto ${f(mean)} · quartili ${f(q(ok.map((x) => x.lr), 0.25))} / ${f(q(ok.map((x) => x.lr), 0.5))} / ${f(q(ok.map((x) => x.lr), 0.75))}`);
console.log(`scarto fra oggetti ${between.toFixed(2)} dex, dentro lo stesso oggetto ${within.toFixed(2)} dex (quanto variano le scelte delle persone)`);
const grp = (name, fn) => { const v = ok.filter(fn).map((x) => x.lr); if (v.length) console.log(`  ${name.padEnd(28)} ${f(q(v, 0.5))} (${v.length})`); };
console.log('mediane per gruppo:');
grp('camera a colori', (x) => !x.mono); grp('mono', (x) => x.mono);
grp('cielo SQM < 20,4', (x) => x.sky && x.sqm < 20.4); grp('cielo SQM 20,4–21,3', (x) => x.sky && x.sqm >= 20.4 && x.sqm < 21.3); grp('cielo SQM ≥ 21,3', (x) => x.sky && x.sqm >= 21.3);
grp('apertura < 80 mm', (x) => x.r.ap < 80); grp('apertura 80–200 mm', (x) => x.r.ap >= 80 && x.r.ap < 200); grp('apertura ≥ 200 mm', (x) => x.r.ap >= 200);
console.log('per oggetto (rispetto alla media):');
console.log('  ' + Object.entries(om).map(([k, v]) => `${k} ${f(v - mean)} (${byO[k].length})`).join(' · '));
