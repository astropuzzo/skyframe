// Dalle schede lette su AstroBin (scripts/raw/astrobin-raw.jsonl, locale) alle righe per calibrate.cjs.
//   node scripts/astrobin-convert.cjs            legge scripts/raw/astrobin-raw.jsonl e skyframe-astrobin-*.jsonl, scrive astrobin-calib2.jsonl
// Una scheda: { t, id, lk, bo, sc, raw: [righe dell'integrazione, poi Telescopio/Ottica/Lente, Fotocamera, Filtri], note }.
// Qui si riconoscono telescopio (apertura, ostruzione), camera (pixel, mono o a colori) e filtri (tipo di ripresa).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), RAW = path.join(root, 'scripts/raw'), OUT = path.join(RAW, 'astrobin-calib2.jsonl');
// le schede lette a mano (astrobin-raw.jsonl) e i file dello script per Firefox (skyframe-astrobin-*.jsonl), senza doppioni
const FILES = fs.readdirSync(RAW).filter((f) => f === 'astrobin-raw.jsonl' || /^skyframe-astrobin-.*\.jsonl$/.test(f)).map((f) => path.join(RAW, f));
const BORTLE_SQM = { 1: 21.95, 2: 21.7, 3: 21.45, 4: 20.8, 5: 20.0, 6: 19.2, 7: 18.6, 8: 18.1, 9: 17.6 };
// [regola, apertura mm, ostruzione % del diametro]
const SCOPES = [
  [/HyperStar/i, (s) => (/C14/.test(s) ? 356 : /11/.test(s) ? 280 : 203), 45], [/RASA 8/i, 203, 40], [/RASA 11/i, 279, 40],
  [/EdgeHD 9\.25/i, 235, 36], [/EdgeHD 11/i, 280, 36], [/EdgeHD 8/i, 203, 36], [/Celestron C14/i, 356, 34],
  [/Epsilon-130/i, 130, 36], [/Epsilon-180/i, 180, 35], [/PHOTON 250/i, 250, 33], [/Quattro 200/i, 200, 35],
  [/200PDS|Explorer 200P\b|Explorer 200P /i, 200, 25], [/130PDS/i, 130, 36],
  [/Fluorostar 132|FLT132/i, 132], [/APM Apo 107/i, 107], [/FSQ-106/i, 106], [/FSQ-85/i, 85], [/FF65/i, 65], [/FF107/i, 107], [/103APO/i, 103],
  [/LZOS.*152|152\/1200/i, 152], [/Photoline 130/i, 130], [/CFF.*180/i, 180], [/RedCat 91/i, 91], [/RedCat 71/i, 71], [/SVX130T/i, 130],
  [/FRA500/i, 90], [/FRA400/i, 72], [/SQA85/i, 85], [/SV80ST/i, 80], [/Askar 91F/i, 91], [/65PHQ/i, 65], [/107PHQ/i, 107], [/TSA-120/i, 120],
  [/Esprit 120/i, 120], [/Esprit 100/i, 100], [/Esprit 150/i, 150], [/61\/335/i, 61], [/ProED 80/i, 80], [/Photoline 80/i, 80], [/CF-APO 80/i, 80],
  [/61EDPH/i, 61], [/Imaging Star 102/i, 102], [/TOA-130/i, 130], [/TOA-150/i, 150], [/Samyang 135/i, 67.5], [/Seestar S50/i, 50], [/Seestar S30/i, 30],
  [/RASA 36|RASA 14/i, 356, 40], [/\bC11\b|Celestron C11|CPC 1100/i, 280, 34], [/\bC9\.25\b|Celestron C9/i, 235, 34], [/\bC8\b|Celestron C8|EdgeHD 800/i, 203, 34], [/\bC6\b/i, 150, 35],
  [/RC ?6|RC6/i, 152, 50], [/RC ?8|RC8/i, 203, 47], [/RC ?10|RC10/i, 254, 47], [/CDK ?12/i, 318, 49], [/CDK ?17/i, 432, 45], [/Epsilon-160/i, 160, 37],
  [/FSQ-130/i, 130], [/FSQ-106/i, 106], [/TOA-130/i, 130], [/TSA-102/i, 102], [/FC-100/i, 100], [/FOA-60/i, 60],
  [/Esprit 80/i, 80], [/RedCat 51/i, 51], [/RedCat 61|Redcat 61/i, 61], [/ZenithStar 61|Z61/i, 61], [/ZenithStar 73|Z73/i, 73], [/ZenithStar 81|Z81/i, 81], [/GT81/i, 81], [/GT71/i, 71], [/FLT ?120/i, 120], [/FLT ?91/i, 91], [/Pleiades 111/i, 111], [/Pleiades 68/i, 68],
  [/Askar 120APO/i, 120], [/Askar 140APO/i, 140], [/151PHQ/i, 151], [/130PHQ/i, 130], [/Askar V\b/i, 60], [/ACL200/i, 200],
  [/Evostar 72/i, 72], [/Evostar 80|ED80/i, 80], [/Evostar 100|ED100/i, 100], [/Evostar 120|ED120/i, 120], [/Evostar 150/i, 150],
  [/150PDS|Explorer 150P|150\/750/i, 150, 30], [/250PDS|Explorer 250/i, 250, 25], [/Quattro 150/i, 150, 37], [/Quattro 250/i, 250, 34], [/Quattro 300/i, 300, 33],
  [/SVX80|SVX 80/i, 80], [/SVX102/i, 102], [/SVX152/i, 152], [/SVX140/i, 140], [/SV70T/i, 70], [/SV102/i, 102],
  [/Dwarf ?(II|2)/i, 24], [/Dwarf ?(III|3)/i, 35], [/Vespera/i, 50],
];
/* apertura dal nome, quando il telescopio non è in tabella: «200/1000», «135mm f/2» (obiettivo), «80mm APO» */
function apFromName(s) {
  let m = s.match(/\b(\d{2,3})\s?\/\s?(\d{3,4})\b/); if (m && +m[1] >= 40 && +m[2] > +m[1]) return { ap: +m[1], obs: /newton|pds|reflector|riflettore/i.test(s) ? 25 : 0 };
  m = s.match(/\b(\d{2,3})\s?mm\b[^/]*f\s?\/\s?(\d+(?:\.\d+)?)/i); if (m && /samyang|rokinon|canon|nikon|sigma|sony|tamron|lens|obiettivo/i.test(s)) return { ap: +(+m[1] / +m[2]).toFixed(1), obs: 0 };
  m = s.match(/\b(\d{2,3})\s?mm\b/i); if (m && +m[1] >= 40 && +m[1] <= 400 && /apo|ed\b|refractor|rifrattore|triplet|doublet|quadruplet|quintuplet|petzval|newton|reflector/i.test(s)) return { ap: +m[1], obs: /newton|reflector/i.test(s) ? 25 : 0 };
  return null;
}
// [regola, pixel µm, mono]
const CAMS = [
  [/Seestar/i, 2.9, false], [/2600MM|2600 MM|268 ?M\b|QHY268 M|QHY600|6200MM|533MM|1600MM|183GT|183MM|Poseidon-M|26000 KMA|DS26m|MM Pro/i, null, true],
  [/16200|FM16200/i, 6.0, true], [/Atik One 6/i, 4.54, true], [/QSI 683/i, 5.4, true],
  [/Canon|Nikon|EOS/i, 4.3, false],
];
const PIX = [[/2600|268|6200|533|571|26000|DS26|TS2600|DeepSkyPro2600|QHY600|Poseidon/i, 3.76], [/1600MM/i, 3.8], [/183/i, 2.4], [/294/i, 4.63], [/071/i, 4.78], [/585/i, 2.9]];
const dur = (s) => { let h = 0; const m = String(s).match(/(\d+)h/); const mi = String(s).match(/(\d+)′/); if (m) h += +m[1]; if (mi) h += +mi[1] / 60; return m || mi ? h : null; };
// etichette in italiano e in inglese (la lingua di AstroBin di chi raccoglie)
const LABEL = /^(Lum\/Clear|L|LP|R|G|B|Hα|OIII|SII|Nessun filtro|No filter|UV\/IR Cut|Multiband)$/;
const EQUIP = /^(Telescopio|Telescopi|Ottica|Lente|Fotocamera|Filtri|Filtro|Camere|Telescope|Telescopes|Optics|Lens|Lenses|Camera|Cameras|Filter|Filters)$/;
const STOP = /^(Montatura|Montature|Accessorio|Accessori|Software|Strumentazione di guida|Ottica di guida|Ottiche di guida|Fotocamera di guida|Riduttore focale|Mount|Mounts|Accessory|Accessories|Guiding equipment|Guiding telescopes|Guiding cameras)$/;
function parse(raw) {
  const rows = []; let lab = null, i = 0, total = null;
  for (; i < raw.length; i++) {
    const x = raw[i];
    if (EQUIP.test(x)) break;
    if (x === 'Totale' || x === 'Total') { total = dur(raw[i + 1]); i++; continue; }
    if (LABEL.test(x)) { lab = x; continue; }
    if (/×/.test(x)) continue;
    const h = dur(x); if (h != null) { rows.push([lab || '?', h]); lab = null; }
  }
  const eq = {}; let k = null;
  for (; i < raw.length; i++) { const x = raw[i]; if (STOP.test(x)) { k = null; continue; } if (EQUIP.test(x)) { k = x; eq[k] = eq[k] || []; continue; } if (k) eq[k].push(x); }
  const sum = rows.reduce((a, r) => a + r[1], 0), pick = (...ks) => ks.map((k) => eq[k] || []).flat();
  return { rows, h: total || sum, scope: pick('Telescopio', 'Telescopi', 'Ottica', 'Lente', 'Telescope', 'Telescopes', 'Optics', 'Lens', 'Lenses')[0] || '', cam: pick('Fotocamera', 'Camere', 'Camera', 'Cameras')[0] || '', filt: pick('Filtri', 'Filtro', 'Filters', 'Filter').join(' | ') };
}
function kindOf(rows, mono, filt, dslr) {
  const hs = {}; rows.forEach(([l, h]) => (hs[l] = (hs[l] || 0) + h));
  const has = (l) => (hs[l] || 0) > 0, tot = rows.reduce((a, r) => a + r[1], 0) || 1;
  if (!mono) {
    const bb = has('Nessun filtro') || has('UV/IR Cut') || has('Lum/Clear') || has('LP'), mb = has('Multiband');
    const f = filt.toLowerCase(), d3 = /l-ultimate|3nm|3 nm/.test(f) && !/sii|s2/.test(f.replace(/l-ultimate/g, '')), so = /sii\+oiii|sii-oiii|l-synergy|colour ?magic|sii & hb|sii\/hb/.test(f);
    const tri = /enhance|triad|triband|tri-band/.test(f);
    if (mb && bb) return { kind: d3 ? 'bb+dual3' : 'bb+dual' };
    if (mb) return { kind: so && /(ha|h-alpha|alp-t dualband 3nm ha)/.test(f) ? 'sho-osc' : so ? 'dual-so' : tri ? 'multi' : d3 ? 'dual3' : 'dual' };
    return { kind: dslr ? 'bb-dslr' : 'bb' };
  }
  const L = (hs['Lum/Clear'] || 0) + (hs.L || 0) + (hs.LP || 0), RGB = (hs.R || 0) + (hs.G || 0) + (hs.B || 0), Ha = hs['Hα'] || 0, O = hs.OIII || 0, S = hs.SII || 0;
  const nb = Ha + O + S, split = { L, R: hs.R || 0, G: hs.G || 0, B: hs.B || 0, Ha, OIII: O, SII: S };
  if (nb && RGB + L > 0.25 * tot && (O || S)) return { kind: S ? 'mono-sho' : 'mono-hoo-rgb', note: 'misto', split };
  if (S && O) return { kind: 'mono-sho', split };
  if (O && Ha) return { kind: RGB > 0.1 * tot ? 'mono-hoo-rgb' : 'mono-hoo', split };
  if (Ha && (L || RGB)) return { kind: 'mono-hargb', split };
  if (Ha) return { kind: 'mono-ha', split };
  if (L) return { kind: 'mono-lrgb', split };
  return { kind: 'mono-rgb', split };
}
const out = [], drop = [];
const seenId = new Set();
for (const line of FILES.flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n')).filter(Boolean)) {
  const r = JSON.parse(line), why = (w) => drop.push(`${r.t} ${r.id}: ${w}`);
  if (seenId.has(r.t + '|' + r.id)) continue; seenId.add(r.t + '|' + r.id);
  // schede del primo formato: integrazione, telescopio, camera e filtri in campi separati
  if (!r.raw && r.ig) r.raw = [...r.ig, 'Telescopio', ...(r.te || []).slice(0, 1), 'Fotocamera', ...(r.ca || []).slice(0, 1), 'Filtri', ...(r.fi || [])];
  if (r.ca && r.ca.length > 1) r.note = ((r.note || '') + ' misto').trim(); // camere diverse insieme
  if (/senza dati|collaborazione|JWST|non indicato|duplicato/.test(r.note || '') || !r.raw || !r.raw.length) { why(r.note || 'senza dati'); continue; }
  const p = parse(r.raw); if (!p.h || !p.rows.length) { why('integrazione illeggibile'); continue; }
  const sc = SCOPES.find(([re]) => re.test(p.scope)) || SCOPES.find(([re]) => re.test(r.ti || '')), gen = sc ? null : apFromName(p.scope);
  if ((!sc && !gen) || !r.sc) { why(r.sc ? `telescopio sconosciuto: ${p.scope}` : 'scala mancante'); continue; }
  const ap = sc ? (typeof sc[1] === 'function' ? sc[1](p.scope) : sc[1]) : gen.ap, obs = sc ? sc[2] || 0 : gen.obs;
  const camRule = CAMS.find(([re]) => re.test(p.cam)), dslr = /Canon|Nikon|EOS/i.test(p.cam);
  let mono = camRule ? camRule[2] : /\bMM\b|mono/i.test(p.cam);
  if (!p.cam) mono = p.rows.some(([l]) => /^(R|G|B|Hα|OIII|SII)$/.test(l)); // camera non letta: la deduco dai filtri
  let pix = (camRule && camRule[1]) || (PIX.find(([re]) => re.test(p.cam)) || [])[1];
  const est = (r.note || '').match(/pixel[^0-9]*([\d,]+) µm/); if (!pix && est) pix = +est[1].replace(',', '.');
  if (!pix) pix = 3.76;
  const k = kindOf(p.rows, mono, p.filt, dslr);
  const rec = { t: r.t, id: r.id, likes: r.lk, ap, obs, scale: r.sc, pix, kind: k.kind, h: +p.h.toFixed(2), scope: p.scope, cam: p.cam, filters: p.filt };
  if (r.bo) { if (Number.isInteger(r.bo)) rec.bortle = r.bo; else rec.sqm = +((BORTLE_SQM[Math.floor(r.bo)] + BORTLE_SQM[Math.ceil(r.bo)]) / 2).toFixed(2); }
  if (dslr) rec.dslr = true;
  if (k.split) rec.split = Object.fromEntries(Object.entries(k.split).filter(([, v]) => v > 0).map(([a, v]) => [a, +v.toFixed(2)]));
  const notes = [k.note, /IFN/i.test(r.ti || '') || /IFN/.test(r.de || '') ? 'IFN' : null, /misto|clip/.test(r.note || '') ? 'misto' : null, /mosaico/.test(r.note || '') ? 'parte' : null].filter(Boolean);
  if (notes.length) rec.note = [...new Set(notes)].join(', ');
  out.push(rec);
}
fs.writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
const by = {}; out.forEach((x) => (by[x.t] = (by[x.t] || 0) + (x.note ? 0 : 1)));
console.log(`${out.length} righe in ${path.relative(root, OUT)} · utili per oggetto:`, by);
if (drop.length) console.log('scartate:\n  ' + drop.join('\n  '));
