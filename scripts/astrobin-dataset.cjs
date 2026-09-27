// Dal file dello script di raccolta per Firefox (skyframe-astrobin-dataset-*.json, formato v5, locale in scripts/raw)
// alle righe per calibrate.cjs, con l'attrezzatura vera di ogni foto: telescopio, camera e ogni filtro con le sue ore.
//   node scripts/astrobin-dataset.cjs          → scripts/raw/astrobin-calib3.jsonl e, a schermo, cosa non si è riconosciuto
// Una riga: { t, ds: raccolta, id, au: autore, likes, ap, fl, obs, pix, cw, ch, qe, rn, bin, cam: osc | dslr | dslrmod | mono,
//   own: [id filtri], split: { id: ore }, h: ore totali, bortle, sqm (dichiarato dall'autore, se plausibile), scope, camera, filters }
// Le camere mono usano i filtri generici «nbg-riga-ampiezza» e L, R, G, B (gear.cjs, monoFilterOf).
const fs = require('fs'), path = require('path');
const { scopeOf, camOf, filterOf, monoFilterOf } = require('./gear.cjs');
const RAW = path.join(__dirname, 'raw'), OUT = path.join(RAW, 'astrobin-calib3.jsonl');
// in ordine di data: ogni foto porta l'etichetta della prima raccolta in cui compare (ds), per separare taratura e verifica
const files = fs.readdirSync(RAW).filter((f) => /^skyframe-astrobin-dataset-.*\.json$/.test(f)).sort().map((f) => path.join(RAW, f));
const ALIAS = { 'Barnard 150': 'B 150', 'Barnard 142': 'B 142', 'Barnard 33': 'B 33' };
// nome che la raccolta attribuisce per errore a molte foto (il fondatore di AstroBin, dal piè di pagina): autore sconosciuto
const BAD_AUTHOR = /Salvatore Iovene/i;
const seen = new Set(), out = [], miss = { scope: {}, cam: {}, filter: {} }, drop = {};
const count = (m, k) => (m[k] = (m[k] || 0) + 1);
for (const file of files) {
  const ds = path.basename(file).replace(/^skyframe-astrobin-dataset-|\.json$/g, '').slice(0, 16);
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8')).rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    const q = r.acquisition || {}, e = r.equipment || {};
    const why = (k) => { count(drop, k); };
    if ((e.telescopes || []).length !== 1) { why('più telescopi o nessuno'); continue; }
    if ((e.cameras || []).length !== 1) { why('più camere o nessuna'); continue; }
    const sc = scopeOf(e.telescopes[0]); if (!sc) { count(miss.scope, e.telescopes[0]); why('telescopio sconosciuto'); continue; }
    const c0 = e.cameras[0], cam = camOf(c0.name, c0.sensor, c0.colorMode); if (!cam) { count(miss.cam, c0.name + (c0.sensor ? ' [' + c0.sensor + ']' : '')); why('camera sconosciuta'); continue; }
    const split = {}, binH = {}; let bad = false, fr = null;
    for (const f of q.frames || []) {
      // camera a colori con un filtro singolo a banda stretta (Hα, OIII, SII): il filtro generico della sua ampiezza
      const nb = monoFilterOf(f.filter), id = cam.type === 'mono' ? nb : filterOf(f.filter || '') || (nb && nb.startsWith('nbg-') ? nb : null);
      if (!id) { count(miss.filter, f.filter); bad = true; break; }
      const h = (f.integration_s || (f.frames || 0) * (f.exposure_s || 0)) / 3600;
      split[id] = (split[id] || 0) + h;
      const bn = +String(f.binning || '1').charAt(0) || 1; binH[bn] = (binH[bn] || 0) + h;
      const m = String(f.raw || '').match(/f\/(\d+(?:\.\d+)?)/); if (m && +m[1] >= 1.5 && +m[1] <= 16) fr = +m[1];
    }
    if (bad) { why('filtro sconosciuto'); continue; }
    const h = (q.integration_s || 0) / 3600;
    if (!(h > 0.2)) { why('integrazione mancante'); continue; }
    if (!sc.fl && !fr) { why('focale sconosciuta'); continue; }
    const bortle = +q.bortle || null, sqm = +q.sqm >= 16 && +q.sqm <= 22.3 ? +q.sqm : null;
    // binning prevalente (per ore); il sensore IMX492 si usa già in bin 2 (pixel 4,63 µm)
    const bin = /IMX492/i.test(c0.sensor || '') ? 1 : +Object.entries(binH).sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
    out.push({ t: ALIAS[r.target] || r.target, ds, id: r.id, au: r.author && !BAD_AUTHOR.test(r.author) ? r.author : null, likes: r.likes, ap: sc.ap, fl: fr ? Math.round(fr * sc.ap) : sc.fl, obs: sc.obs, pix: +(cam.pix * bin).toFixed(2), cw: Math.round(cam.w / bin), ch: Math.round(cam.h / bin), qe: cam.qe, rn: cam.rn, bin, cam: cam.type, sqm,
      own: Object.keys(split), split: Object.fromEntries(Object.entries(split).map(([k, v]) => [k, +v.toFixed(2)])), h: +h.toFixed(2), bortle,
      date: (q.dates || []).slice(-1)[0] || null, scope: e.telescopes[0], camera: e.cameras[0].name, filters: (q.frames || []).map((f) => f.filter).join(' | ') });
  }
}
fs.writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `  ${v} ${k}`).join('\n');
console.log(`${out.length} foto utili su ${seen.size} → ${path.relative(process.cwd(), OUT)}`);
console.log('scartate:', JSON.stringify(drop));
for (const k of ['scope', 'cam', 'filter']) if (Object.keys(miss[k]).length) console.log(`${k} non riconosciuti:\n${top(miss[k])}`);
