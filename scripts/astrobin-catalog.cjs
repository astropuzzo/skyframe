// Catalogo attrezzatura dai file dello script di raccolta (skyframe-astrobin-dataset-*.json, formato v5): solo i NOMI
// come li scrive AstroBin, senza doppioni, con quante foto li usano. Serve a trovare filtri, camere, telescopi e accessori
// da completare poi con i dati dei produttori (bande, aperture, focali) in src/data/filters.js e scripts/gear.cjs.
//   node scripts/astrobin-catalog.cjs [cartella]   (default scripts/raw) → scripts/data/astrobin-equipment.json
// Voci: filters { name, astrobin_id, channels, bandwidth_nm, bandwidth_source, count }, cameras { name, id, colorMode,
//   sensor, type, count }, telescopes / mounts { name, count }, accessories { name, kind: reducer_flattener | other, count }.
// bandwidth_nm c'è solo quando la raccolta l'ha letta dal nome; kind è una regola sul nome, non un dato AstroBin.
const fs = require('fs'), path = require('path');
const RAW = process.argv[2] || path.join(__dirname, 'raw'), OUT = path.join(__dirname, 'data', 'astrobin-equipment.json');
// i file più grandi per primi: a parità di foto vince la raccolta più recente e completa
const files = fs.readdirSync(RAW).filter((f) => /^skyframe-astrobin-dataset-.*\.json$/.test(f))
  .map((f) => path.join(RAW, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
const REDUCER = /reducer|flattener|corrector|riduttore|spianatore|barlow|extender|\b\d?[.,]\d+ ?x\b|TSFLAT|field flat|coma/i;
const seen = new Set(), cat = { filters: new Map(), cameras: new Map(), telescopes: new Map(), mounts: new Map(), accessories: new Map() };
const add = (k, name, make) => {
  const m = cat[k], cur = m.get(name);
  if (cur) cur.count++; else m.set(name, { ...make(), count: 1 });
  return m.get(name);
};
for (const file of files) {
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8')).rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    const e = r.equipment || {}, fd = new Map((e.filter_details || []).map((d) => [d.name, d]));
    for (const c of e.cameras || []) add('cameras', c.name, () => ({ name: c.name, id: c.id ?? null, colorMode: c.colorMode ?? null, sensor: c.sensor ?? null, type: c.type ?? null }));
    for (const n of e.filters || []) {
      const d = fd.get(n), f = add('filters', n, () => ({ name: n, astrobin_id: null, channels: [], bandwidth_nm: null, bandwidth_source: null }));
      if (d && !f.astrobin_id) Object.assign(f, { astrobin_id: d.id ?? null, channels: d.channels || [], bandwidth_nm: d.bandwidth_nm ?? null, bandwidth_source: d.bandwidth_source ?? null });
    }
    for (const n of e.telescopes || []) add('telescopes', n, () => ({ name: n }));
    for (const n of e.mounts || []) add('mounts', n, () => ({ name: n }));
    for (const n of e.accessories || []) add('accessories', n, () => ({ name: n, kind: REDUCER.test(n) ? 'reducer_flattener' : 'other' }));
  }
}
const lists = Object.fromEntries(Object.entries(cat).map(([k, m]) => [k, [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))]));
const meta = { source: 'AstroBin, pagine delle foto lette dallo script di raccolta Skyframe (collector 5.4–5.6)', images: seen.size, files: files.length,
  counts: Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, l.length])) };
// una voce per riga: diff leggibili
const body = Object.entries(lists).map(([k, l]) => `"${k}":[\n${l.map((x) => JSON.stringify(x)).join(',\n')}\n]`).join(',\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `{"__meta__":${JSON.stringify(meta)},\n${body}}\n`);
console.log(OUT, meta);
