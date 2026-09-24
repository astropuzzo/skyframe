// Controllo del modello fuori dall'interfaccia: stampa i piani di ripresa per alcuni scenari tipici.
//   npm run check
const path = require('path'), fs = require('fs'), vm = require('vm');
const src = (f) => path.join(__dirname, '..', 'src', f);
global.window = {};
['data/filters.js', 'data/dso.js', 'data/sky.js'].forEach((f) => require(src(f)));
vm.runInThisContext(fs.readFileSync(src('js/astro.js'), 'utf8') + '\n' + fs.readFileSync(src('js/model.js'), 'utf8') +
  '\n;globalThis.__m={templateProfile,profileConfigs,computeAll,planOf};');
const M = globalThis.__m;

function run(title, p, ids, ds) {
  const t0 = Date.now(), R = M.computeAll(M.profileConfigs(p), p, ds || '2026-10-10', Date.now());
  console.log(`\n== ${title} (${Date.now() - t0} ms, ${R.results.length} oggetti)`);
  for (const id of ids) {
    const r = R.results.find((x) => x.o.id === id || x.o.alias.includes(id));
    if (!r) { console.log('  ' + id, 'non visibile'); continue; }
    const e = r.e, b = e.best, plan = M.planOf(b, e.cfg, false) || [];
    const tot = plan.filter((s) => !s.optional).reduce((a, s) => a + s.h, 0), deep = plan.filter((s) => !s.optional).reduce((a, s) => a + s.hDeep, 0);
    console.log(`  ${r.o.id.padEnd(9)} LS ${r.o.sb} Hα ${String(r.o.ha).padStart(5)}R  campo ${String(Math.round(r.field.a)).padStart(3)}′  ${e.fill.label.padEnd(22)} base ${String(tot.toFixed(1)).padStart(6)} h  profondo ${String(deep.toFixed(1)).padStart(6)} h  ` +
      plan.map((s) => `${s.filter} ${s.h.toFixed(1)}/${s.hDeep.toFixed(1)}h@${s.sub}s${s.drive ? ' [' + s.drive + (s.driveDeep && s.driveDeep !== s.drive ? ' → ' + s.driveDeep : '') + ']' : ''}${s.optional ? ' (facolt.)' : ''}`).join(' + '));
  }
}
const base = (sqm) => { const p = M.templateProfile(); p.site = { name: 'test', lat: 41.9, lon: 12.5, bortle: 7, sqm }; p.session.quality = 'good'; return p; };
const mono = { preset: 'asi2600mm', name: 'ASI2600MM', w: 6248, h: 4176, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 };
const lens800 = { name: '800 mm f/5', ap: 160, fl: 800, obs: 0 };

let p = base(19.26); p.optic = lens800; p.filters.owned = ['uvir', 'lextreme', 'triband2', 'lpro'];
run('OSC 2600MC · 800 mm f/5 · SQM 19,26', p, ['IC 5146', 'Sh2-206', 'M 31', 'NGC 7000', 'M 27', 'NGC 7635', 'M 51', 'LDN 1235']);
p = base(19.26); p.optic = lens800; p.filters.owned = ['uvir', 'lextreme', 'lsynergy'];
run('OSC 2600MC · 800 mm f/5 · SQM 19,26 · L-eXtreme + L-Synergy (rif. reali: WR 134 ≈ 95 h, Cocoon ≈ 100 h)', p, ['WR 134', 'IC 5146', 'NGC 6888', 'Sh2-129']);
p = base(19.26); p.filters.owned = ['uvir', 'lextreme'];
run('OSC 2600MC · RedCat 51 · SQM 19,26', p, ['M 31', 'NGC 7000', 'IC 1805', 'Sh2-206', 'M 45']);
p = base(18.6); p.filters.owned = ['uvir', 'lextreme'];
run('OSC 2600MC · RedCat 51 · SQM 18,6', p, ['M 31', 'NGC 7000', 'IC 1805']);
p = base(19.26); p.camera = mono; p.optic = lens800; p.filters.owned = ['L', 'R', 'G', 'B', 'bd65-Ha', 'bd65-OIII', 'bd65-SII'];
run('Mono 2600MM · 800 mm f/5 · SQM 19,26', p, ['IC 5146', 'NGC 7000', 'M 31', 'M 27']);
