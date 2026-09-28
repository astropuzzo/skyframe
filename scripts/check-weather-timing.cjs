// Regressione: il meteo deve pesare le ore in cui il target rende davvero.
// BASELINE_REV=<git-rev> node scripts/check-weather-timing.cjs confronta anche una revisione precedente.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

process.env.TZ = 'Europe/Rome';
const root = path.join(__dirname, '..');
const file = (p) => fs.readFileSync(path.join(root, 'src', p), 'utf8');
const current = file('js/model.js');
const old = process.env.BASELINE_REV ? execFileSync('git', ['show', `${process.env.BASELINE_REV}:src/js/model.js`], { cwd: root, encoding: 'utf8' }) : null;

function load(model) {
  const ctx = { window: {}, console, Date, Math, Map, Set, Float32Array, Float64Array, Uint8Array, performance };
  vm.createContext(ctx);
  for (const name of ['filters', 'dso', 'sky', 'quality', 'real']) vm.runInContext(file(`data/${name}.js`), ctx);
  vm.runInContext("const LANG='it',LOCALE='it-IT',txName=(s)=>s,tx=(s,p)=>p?s.replace(/[{](\\w+)[}]/g,(_,k)=>p[k]??_):s;" + file('js/astro.js') + '\n' + model + '\n;this.M={templateProfile,profileConfigs,computeAll,computeNight,nightRec,CAT_BY_ID};', ctx);
  return ctx.M;
}

const ids = ['NGC 7000', 'M 31', 'M 27', 'NGC 7023', 'M 56'];
function run(M, model) {
  const p = M.templateProfile();
  p.site = { name: 'Roma', lat: 41.9, lon: 12.5, sqm: 19.26, bortle: 6 };
  p.optics = [{ id: 'o1', name: '800 mm f/5', ap: 160, fl: 800, obs: 0, useNative: true, accessories: [] }];
  p.filters.owned = ['uvir', 'lextreme'];
  const R = M.computeAll(M.profileConfigs(p), p, '2026-10-10', new Date('2026-10-10T12:00:00+02:00').getTime());
  // Previsione artificiale dichiarata: sereno a tratti, identica per ogni target.
  const clear = [1, 1, 1, 1, 0.8, 0.4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
  R.C.wx = (t) => clear[(new Date(t).getHours() - 18 + 24) % 24] ?? 0.5;
  const rows = ids.map((id) => {
    const r = R.results.find((x) => x.o.id === id);
    assert(r && r.e.best, `${id} non valutabile`);
    const x = M.nightRec(R.C, r, r.e, 0, false);
    return { id, type: r.o.type, strategy: r.e.best.id, h: x.h, hGeo: x.hGeo, T: x.T, work: 100 * x.h / x.T };
  });
  const r = R.results.find((x) => x.o.id === 'M 56');
  const use = [...r.use.keys()].filter((i) => r.use[i]), half = Math.floor(use.length / 2);
  function timed(sel) {
    const ts = new Set(sel.map((i) => R.night.t[i]));
    R.C.wx = (t) => ts.has(t) ? 1 : 0;
    R.C.ahead.cache.clear();
    const x = M.nightRec(R.C, r, r.e, 0, false);
    return x.h / x.T;
  }
  const early = timed(use.slice(0, half)), late = timed(use.slice(use.length - half));
  if (model === current) {
    R.C.wx = () => 0; R.C.ahead.cache.clear();
    const overcast = M.nightRec(R.C, r, r.e, 0, false);
    assert(overcast.h === 0 && !isFinite(overcast.T), 'Una notte coperta produce lavoro');
    R.C.wx = null; R.C.ahead.cache.clear();
    const clearNight = M.nightRec(R.C, r, r.e, 0, false);
    assert(Math.abs(clearNight.T - r.e.best.tonight) < 1e-8, 'La notte senza previsione è cambiata');
  }
  return { rows, early, late };
}

const now = run(load(current), current);
assert(Math.abs(now.early - now.late) > 0.02, 'Il rendimento ignora quando il cielo è sereno');
const M = load(current), p = M.templateProfile();
p.site = { name: 'Roma', lat: 41.9, lon: 12.5, sqm: 19.26, bortle: 6 };
p.session.from = '20:00'; p.session.to = '04:00';
for (const [day, offset] of [['2026-03-29', '+02:00'], ['2026-10-25', '+01:00']]) {
  const previous = new Date(`${day}T12:00:00${offset}`); previous.setDate(previous.getDate() - 1);
  const n = M.computeNight(p, `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`);
  const atFour = new Date(`${day}T04:00:00${offset}`).getTime(), i = n.t.indexOf(atFour);
  assert(i >= 0 && n.dark[i] === 1 && n.dark[i + 1] === 0, `Orario locale errato nel cambio d'ora ${day}`);
}
if (old) {
  const prev = run(load(old), old);
  console.log('Target\tTipo\tStrategia\tOre serene eff.\tOre prima\tOre dopo\tLavoro prima %\tLavoro dopo %');
  now.rows.forEach((r, i) => {
    const q = prev.rows[i];
    console.log([r.id, r.type, r.strategy, r.h.toFixed(2), q.T.toFixed(2), r.T.toFixed(2), q.work.toFixed(1), r.work.toFixed(1)].join('\t'));
  });
  console.log(`M 56, uguali ore serene nella prima/seconda metà della finestra utile: ${(now.early * 100).toFixed(1)}% / ${(now.late * 100).toFixed(1)}% (prima: ${(prev.early * 100).toFixed(1)}% / ${(prev.late * 100).toFixed(1)}%)`);
} else {
  console.log(`M 56, uguali ore serene nella prima/seconda metà della finestra utile: ${(now.early * 100).toFixed(1)}% / ${(now.late * 100).toFixed(1)}%`);
}
