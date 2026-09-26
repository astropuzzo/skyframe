// Confronto del modello con foto reali: per ogni foto rifà i conti con il suo strumento, i suoi filtri e il suo cielo e
// confronta le ore del modello (qualità "buona", senza Luna, per pannello) con l'integrazione dichiarata.
//   node scripts/calibrate.cjs [file.jsonl]      (predefinito: scripts/raw/astrobin-calib*.jsonl, non nel repository)
//   CAL_OBJ="M 82" node scripts/calibrate.cjs    anche il dettaglio foto per foto di un oggetto
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
  '\n;globalThis.__m={templateProfile,profileConfigs,computePrep,computeObj,hoursOf,BORTLE_SQM,CAT_BY_ID,FDB_BY_ID,LINES};');
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
// senza argomento: le foto della prima raccolta e quelle convertite da scripts/astrobin-convert.cjs
const files = process.argv[2] ? [process.argv[2]] : ['astrobin-calib.jsonl', 'astrobin-calib2.jsonl', 'astrobin-calib3.jsonl'].map((n) => path.join(root, 'scripts', 'raw', n)).filter((p) => fs.existsSync(p));
const recs = files.flatMap((p) => fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const L = Math.log10, rows = [];
// Bortle con decimali (6,87): interpolato fra i valori interi
const sqmOf = (b) => { const lo = Math.floor(b), hi = Math.ceil(b), a = M.BORTLE_SQM[lo], z = M.BORTLE_SQM[hi]; return a + (z - a) * (b - lo); };
/* foto con l'attrezzatura vera (scripts/astrobin-dataset.cjs): filtri usati, camera, telescopio. Si confronta la strada che la
   persona ha scelto davvero: solo banda larga, un multibanda, due multibanda (SHO) o i due insieme (banda larga + stretta). */
function ownRow(r, o) {
  const kinds = r.own.map((id) => M.FDB_BY_ID.get(id)), bbs = kinds.filter((f) => f.kind === 'bb' || f.kind === 'lp'), multis = kinds.filter((f) => f.kind === 'multi');
  const most = (list) => list.slice().sort((a, b) => (r.split[b.id] || 0) - (r.split[a.id] || 0))[0];
  const hasG = (f, g) => f.bands.some(([lo, hi]) => (g === 'Ha' ? lo <= 656.3 && hi >= 656.3 : lo <= 672.4 && hi >= 671.6));
  const line = !!M.LINES[o.lk];
  let pick, real = r.h, kind;
  if (!line || !multis.length) { if (!bbs.length) return null; const b = most(bbs); pick = 'bb-' + b.id; real = bbs.reduce((a, f) => a + (r.split[f.id] || 0), 0); kind = multis.length ? 'bb (+nb)' : 'bb'; }
  else if (multis.length === 1) { pick = 'nb-' + multis[0].id; kind = bbs.length ? 'nb+bb' : 'nb'; if (bbs.length) real = r.split[multis[0].id]; }
  else { const a = multis.find((f) => hasG(f, 'Ha')), b = multis.find((f) => f !== a && hasG(f, 'SII'));
    if (a && b) { pick = `sho-${a.id}-${b.id}`; real = (r.split[a.id] || 0) + (r.split[b.id] || 0); kind = 'sho'; } else { const m = most(multis); pick = 'nb-' + m.id; real = multis.reduce((x, f) => x + (r.split[f.id] || 0), 0); kind = 'nb'; } }
  if (!(real > 0.2)) return null;
  const p = M.templateProfile();
  p.camera = { preset: 'x', name: 'x', w: r.cw, h: r.ch, pix: r.pix, type: r.cam, qe: r.qe, rn: r.rn };
  p.optics = [{ id: 'o1', name: 'x', ap: r.ap, fl: r.fl, obs: r.obs || 0, useNative: true, accessories: [] }];
  p.filters.owned = r.own;
  return { p, pick, real, kind };
}
for (const r of recs) {
  const o = M.CAT_BY_ID.get(r.t); if (!o || (!OWN[r.kind] && !r.own)) continue;
  if (r.own) {
    const w = ownRow(r, o); if (!w) continue;
    const sqm = r.bortle ? sqmOf(r.bortle) : M.BORTLE_SQM[4], p = w.p;
    p.site = { name: 'x', lat: 45, lon: 10, bortle: Math.round(r.bortle || 4), sqm }; p.horizon = []; p.session.minAlt = 20; p.session.quality = 'good';
    const mon = ((Math.round(3 + (o.ra / 15 - 12) / 2) % 12) + 12) % 12, ds = `2026-${String(mon + 1).padStart(2, '0')}-10`;
    const x = M.computeObj(M.computePrep(M.profileConfigs(p), p, ds, Date.now()), o); if (!x) continue;
    const st = x.evals[0].strat.find((z) => z.id === w.pick); if (!st) continue; // SHO: già ×2 nel modello (SHO_TIME)
    const model = M.hoursOf(st) / (st.panels || 1); if (!isFinite(model)) continue;
    r.kind = w.kind; r.scale = +(206.265 * r.pix / r.fl).toFixed(2); r.drive = st.steps.map((z) => z.drive).join('+');
    rows.push({ r, o, sqm, model, lr: L(w.real / model), mono: false, sky: !!r.bortle, own: true, skip: false });
    continue;
  }
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
// CAL_OBJ="M 82": il dettaglio foto per foto di un oggetto (strumento, cielo, ore vere e del modello)
if (process.env.CAL_OBJ) rows.filter((x) => x.o.id === process.env.CAL_OBJ).forEach((x) => console.log(`${x.r.id} ${x.r.kind.padEnd(12)} ${String(x.r.ap).padStart(4)} mm ${String(x.r.scale).padStart(5)}″/px SQM ${x.sqm.toFixed(2)}  vere ${String(x.r.h).padStart(6)} h  modello ${x.model.toFixed(1).padStart(6)} h  ×${Math.pow(10, x.lr).toFixed(2)}${x.skip ? '  (esclusa: ' + x.r.note + ')' : ''}`));
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
// CAL_DUMP=file.json: tutte le righe confrontate, per analisi a parte
if (process.env.CAL_DUMP) fs.writeFileSync(process.env.CAL_DUMP, JSON.stringify(rows.map((x) => ({ ...x.r, type: x.o.type, lk: x.o.lk, sb: x.o.sb, a: x.o.a, sqm: x.sqm, model: x.model, lr: x.lr, mono: x.mono, skip: x.skip }))));
