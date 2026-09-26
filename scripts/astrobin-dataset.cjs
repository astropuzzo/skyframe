// Dal file dello script di raccolta per Firefox (skyframe-astrobin-dataset-*.json, formato v5, locale in scripts/raw)
// alle righe per calibrate.cjs, con l'attrezzatura vera di ogni foto: telescopio, camera e ogni filtro con le sue ore.
//   node scripts/astrobin-dataset.cjs          → scripts/raw/astrobin-calib3.jsonl e, a schermo, cosa non si è riconosciuto
// Una riga: { t, id, likes, ap, fl, obs, pix, cw, ch, qe, rn, cam: osc | dslr | dslrmod, own: [id filtri], split: { id: ore },
//   h: ore totali, bortle, scope, camera, filters }
const fs = require('fs'), path = require('path');
const { scopeOf, camOf, filterOf } = require('./gear.cjs');
const RAW = path.join(__dirname, 'raw'), OUT = path.join(RAW, 'astrobin-calib3.jsonl');
const files = fs.readdirSync(RAW).filter((f) => /^skyframe-astrobin-dataset-.*\.json$/.test(f)).map((f) => path.join(RAW, f));
const ALIAS = { 'Barnard 150': 'B 150', 'Barnard 142': 'B 142', 'Barnard 33': 'B 33' };
const seen = new Set(), out = [], miss = { scope: {}, cam: {}, filter: {} }, drop = {};
const count = (m, k) => (m[k] = (m[k] || 0) + 1);
for (const file of files) {
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8')).rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    const q = r.acquisition || {}, e = r.equipment || {};
    const why = (k) => { count(drop, k); };
    if ((e.telescopes || []).length !== 1) { why('più telescopi o nessuno'); continue; }
    if ((e.cameras || []).length !== 1) { why('più camere o nessuna'); continue; }
    const sc = scopeOf(e.telescopes[0]); if (!sc) { count(miss.scope, e.telescopes[0]); why('telescopio sconosciuto'); continue; }
    const cam = camOf(e.cameras[0].name); if (!cam) { count(miss.cam, e.cameras[0].name); why('camera sconosciuta'); continue; }
    if (e.cameras[0].colorMode && e.cameras[0].colorMode !== 'color') { why('camera mono'); continue; }
    const split = {}; let bad = false, fr = null;
    for (const f of q.frames || []) {
      const id = filterOf(f.filter || '');
      if (!id) { count(miss.filter, f.filter); bad = true; break; }
      const h = (f.integration_s || (f.frames || 0) * (f.exposure_s || 0)) / 3600;
      split[id] = (split[id] || 0) + h;
      const m = String(f.raw || '').match(/f\/(\d+(?:\.\d+)?)/); if (m && +m[1] >= 1.5 && +m[1] <= 16) fr = +m[1];
    }
    if (bad) { why('filtro sconosciuto'); continue; }
    const h = (q.integration_s || 0) / 3600;
    if (!(h > 0.2)) { why('integrazione mancante'); continue; }
    const bortle = +q.bortle || null;
    out.push({ t: ALIAS[r.target] || r.target, id: r.id, likes: r.likes, ap: sc.ap, fl: fr ? Math.round(fr * sc.ap) : sc.fl, obs: sc.obs, pix: cam.pix, cw: cam.w, ch: cam.h, qe: cam.qe, rn: cam.rn, cam: cam.type,
      own: Object.keys(split), split: Object.fromEntries(Object.entries(split).map(([k, v]) => [k, +v.toFixed(2)])), h: +h.toFixed(2), bortle,
      date: (q.dates || []).slice(-1)[0] || null, scope: e.telescopes[0], camera: e.cameras[0].name, filters: (q.frames || []).map((f) => f.filter).join(' | ') });
  }
}
fs.writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `  ${v} ${k}`).join('\n');
console.log(`${out.length} foto utili su ${seen.size} → ${path.relative(process.cwd(), OUT)}`);
console.log('scartate:', JSON.stringify(drop));
for (const k of ['scope', 'cam', 'filter']) if (Object.keys(miss[k]).length) console.log(`${k} non riconosciuti:\n${top(miss[k])}`);
