// Indice completo dei cataloghi Messier, NGC, IC, Sharpless (Sh2) e Lynds (LDN) → src/data/index.js, e rapporto di
// copertura → docs/CATALOGO.md. Fonti (in scripts/raw, scaricate da npm run data):
//   OpenNGC (NGC.csv, addendum.csv; M. Verga, CC BY-SA 4.0): tutte le voci NGC 1–7840 e IC 1–5386, con i Messier
//   Sharpless 1959 (sh2.tsv, VizieR VII/20), Lynds 1962 (ldn.tsv, VizieR VII/7A)
// Ogni voce ha uno stato:
//   L  nella lista di Skyframe (src/data/dso.js: dati completi, classificata ogni notte)
//   C  calcolabile a richiesta: tipo gestito dal modello e dimensioni note; la luminosità superficiale è misurata
//      (dalla magnitudine: m) oppure stimata (classe Sharpless: c, opacità Lynds: o, valore tipico del tipo: t)
//   X  presente nel catalogo ma senza dati sufficienti per una stima (motivo: stella, asterismo, inesistente, …)
// Le voci doppie di OpenNGC (tipo Dup) diventano alias dell'oggetto a cui rimandano.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), RAW = path.join(__dirname, 'raw');
global.window = {}; require(path.join(root, 'src/data/dso.js'));
const DSO = window.DSO;
const raw = (f) => fs.readFileSync(path.join(RAW, f), 'utf8');
function csv(f) { const L = raw(f).split(/\r?\n/).filter(Boolean), h = L[0].split(';'); return L.slice(1).map((l) => { const c = l.split(';'), o = {}; h.forEach((k, i) => (o[k] = (c[i] ?? '').trim())); return o; }); }
function tsv(f) {
  const L = raw(f).split(/\r?\n/).filter((l) => l && !l.startsWith('#')), h = L[0].split('\t').map((x) => x.trim());
  return L.slice(3).map((l) => { const c = l.split('\t'), o = {}; h.forEach((k, i) => (o[k] = (c[i] ?? '').trim())); return o; });
}
const num = (x) => (x === '' || x == null || isNaN(+x) ? null : +x);
const hms = (s) => { const [h, m, x] = s.split(':').map(Number); return (h + m / 60 + x / 3600) * 15; };
const dms = (s) => { const g = s[0] === '-' ? -1 : 1, [d, m, x] = s.replace(/^[+-]/, '').split(':').map(Number); return g * (d + m / 60 + x / 3600); };
const areaSB = (mag, a, b) => mag + 2.5 * Math.log10((Math.PI / 4) * a * b * 3600);
const r2 = (x) => Math.round(x * 100) / 100, r1 = (x) => Math.round(x * 10) / 10;
function pretty(name) {
  let m;
  if ((m = name.match(/^(NGC|IC)0*(\d+)(.*)$/))) return `${m[1]} ${m[2]}${m[3] ? m[3].replace(/^_/, '').trim() : ''}`;
  if ((m = name.match(/^M0*(\d+)$/))) return `M ${m[1]}`;
  return name;
}
const TYPE_MAP = { G: 'Gx', GPair: 'Gx', GTrpl: 'Gx', GGroup: 'Gx', PN: 'PN', HII: 'EN', EmN: 'EN', Neb: 'EN', 'Cl+N': 'EN', RfN: 'RN', SNR: 'SNR', OCl: 'OC', GCl: 'GC', DrkN: 'DN' };
const WHY = { '*': 'stella', '**': 'stella doppia', '*Ass': 'associazione stellare o asterismo', Other: 'oggetto non classificato', Nova: 'nova', NonEx: 'oggetto inesistente (errore del catalogo originale)' };
const SB_TYPE = { EN: 22.8, RN: 23.0, SNR: 23.8, DN: 24.5, PN: 21.5, OC: 21.5, GC: 20.5, Gx: 22.5 };

// ---- la lista attuale: id e alias ----
const inList = new Map(); // nome → id nella lista
for (const r of DSO) { inList.set(r[0], r[0]); if (r[1]) r[1].split('|').forEach((a) => inList.set(a, r[0])); }

// ---- 1. OpenNGC ----
const entries = new Map(), alias = new Map(); // id → voce; nome secondario → id
const dup = [];
for (const row of [...csv('NGC.csv'), ...csv('addendum.csv')]) {
  const id0 = pretty(row.Name), M = num(row.M), id = M ? `M ${M}` : id0;
  const al = new Set();
  if (M && id0 !== id) al.add(id0);
  if (row.NGC) row.NGC.split(',').forEach((x) => al.add('NGC ' + x.replace(/^0+/, '')));
  if (row.IC) row.IC.split(',').forEach((x) => al.add('IC ' + x.replace(/^0+/, '')));
  const nick = (row['Common names'] || '').split(',')[0].trim();
  if (row.Type === 'Dup') { dup.push({ id: id0, to: [...(M ? [`M ${M}`] : []), ...al].filter((x) => x !== id0) }); continue; }
  const e = { id, al, nick, src: /^(NGC|IC)\s/.test(id0) ? id0.split(' ')[0] : M ? 'M' : 'altro', otype: row.Type, con: row.Const || '' };
  if (row.RA && row.Dec) { e.ra = hms(row.RA); e.dec = dms(row.Dec); }
  const t = TYPE_MAP[row.Type];
  let a = num(row.MajAx), b = num(row.MinAx); const v = num(row['V-Mag']) ?? (num(row['B-Mag']) != null ? num(row['B-Mag']) - 0.7 : null);
  if (t === 'PN' && a == null) a = 0.3;
  if (t === 'GC' && a == null) a = 5;
  if (!t) { e.st = 'X'; e.why = WHY[row.Type] || 'tipo non gestito'; }
  else if (e.ra == null) { e.st = 'X'; e.why = 'coordinate mancanti'; }
  else if (a == null) { e.st = 'X'; e.why = 'dimensioni non note'; e.type = t; }
  else {
    if (b == null || b <= 0) b = a;
    e.type = t; e.a = r1(a); e.b = r1(b); e.pa = num(row.PosAng) ?? 0; e.mag = v;
    if (v != null && t !== 'DN') { e.sb = r2(areaSB(v, a, b)); e.sbq = 'm'; } else { e.sb = SB_TYPE[t]; e.sbq = 't'; }
    if (t === 'EN' && M == null && e.sbq === 'm') e.sb = Math.max(e.sb, 21.8); // come in build-data: la magnitudine delle HII include le stelle
    e.st = 'C';
  }
  entries.set(id, e);
}
// le doppie: alias dell'oggetto a cui rimandano (se esiste), altrimenti voce senza dati
for (const d of dup) {
  const to = d.to.find((x) => entries.has(x) || [...entries.values()].some((e) => e.al.has(x)));
  const tgt = to && (entries.get(to) || [...entries.values()].find((e) => e.al.has(to)));
  if (tgt) tgt.al.add(d.id); else entries.set(d.id, { id: d.id, al: new Set(d.to), st: 'X', why: 'voce doppia di un altro oggetto', src: d.id.split(' ')[0] });
}
// ---- 2. Sharpless ----
for (const r of tsv('sh2.tsv')) {
  const n = parseInt(r.Sh2, 10); if (!n) continue;
  const id = `Sh2-${n}`, ra = num(r._RAJ2000), dec = num(r._DEJ2000), d = num(r.Diam), bright = num(r.Bright) || 1;
  if (ra == null) { entries.set(id, { id, al: new Set(), src: 'Sh2', st: 'X', why: 'coordinate mancanti' }); continue; }
  if (!d) { entries.set(id, { id, al: new Set(), src: 'Sh2', st: 'X', why: 'dimensioni non note', ra, dec, type: 'EN' }); continue; }
  entries.set(id, { id, al: new Set(), src: 'Sh2', st: 'C', type: 'EN', ra, dec, a: Math.min(d, 900), b: Math.min(d, 900) * (num(r.Form) === 2 ? 0.7 : 1), pa: 0, mag: null, sb: r2(22.7 + (3 - bright) + (d > 60 ? 0.3 : 0)), sbq: 'c', nick: '' });
}
// ---- 3. Lynds ----
const ldnRaw = new Set(tsv('ldn.tsv').map((r) => parseInt(r.LDN, 10)).filter(Boolean));
for (const r of tsv('ldn.tsv')) {
  const n = parseInt(r.LDN, 10); if (!n) continue;
  const id = `LDN ${n}`, ra = num(r._RAJ2000), dec = num(r._DEJ2000), area = num(r.Area), op = num(r.Opacity);
  if (ra == null) { entries.set(id, { id, al: new Set(), src: 'LDN', st: 'X', why: 'coordinate mancanti' }); continue; }
  if (!area) { entries.set(id, { id, al: new Set(), src: 'LDN', st: 'X', why: 'dimensioni non note', ra, dec, type: 'DN' }); continue; }
  const dd = 2 * Math.sqrt(area / Math.PI) * 60;
  // LS della polvere: 24,3 (opacità 6), 24,8 (5) come nella lista; più trasparenti: meno contrasto, 25,3 (ipotesi)
  entries.set(id, { id, al: new Set(), src: 'LDN', st: 'C', type: 'DN', ra, dec, a: r1(dd), b: r1(dd * 0.7), pa: 0, mag: null, sb: op === 6 ? 24.3 : op === 5 ? 24.8 : 25.3, sbq: 'o', nick: '', op });
}
// ---- stato L: nella lista (per id o alias) ----
for (const e of entries.values()) {
  const hit = inList.get(e.id) || [...e.al].map((x) => inList.get(x)).find(Boolean);
  if (hit) { e.st = 'L'; e.list = hit; }
}
// ---- file per l'app ----
const tcode = { Gx: 'G', EN: 'E', PN: 'P', SNR: 'S', RN: 'R', DN: 'D', OC: 'O', GC: 'C' };
const out = [];
for (const e of entries.values()) {
  const al = [...e.al].filter((x) => x !== e.id).join('|');
  if (e.st === 'L') out.push([e.id, al, 'L', e.list === e.id ? '' : e.list]);
  else if (e.st === 'C') out.push([e.id, al, 'C', tcode[e.type], r2(e.ra), r2(e.dec), e.a, e.b, e.pa || 0, e.mag != null ? r1(e.mag) : null, e.sb, e.sbq, e.con || '', e.nick || '']);
  else out.push([e.id, al, 'X', e.why, e.ra != null ? r2(e.ra) : null, e.dec != null ? r2(e.dec) : null, e.otype || '']);
}
const OUT = path.join(root, 'src/data/index.js');
fs.writeFileSync(OUT, `// Indice dei cataloghi Messier, NGC, IC, Sharpless, Lynds (scripts/build-index.cjs; fonti e stati in docs/CATALOGO.md).
// [id, alias, 'L', id nella lista] · [id, alias, 'C', tipo, ra, dec, a′, b′, pa, mag, LS, qualità LS (m misurata, c classe Sh2, o opacità LDN, t tipica), cost., nome] · [id, alias, 'X', motivo, ra, dec, tipo OpenNGC]
window.CAT_INDEX = ${JSON.stringify(out)};\n`);
console.log(`indice: ${out.length} voci → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);

// ---- rapporto di copertura ----
// ogni nome di ogni voce (anche gli alias, per esempio le voci doppie) conta per il suo catalogo
const cats = { Messier: /^M (\d+)$/, NGC: /^NGC (\d+)$/, IC: /^IC (\d+)$/, Sharpless: /^Sh2-(\d+)$/, LDN: /^LDN (\d+)$/ };
const EXPECT = { Messier: [1, 110], NGC: [1, 7840], IC: [1, 5386], Sharpless: [1, 313], LDN: [1, 1802] };
const rep = {};
for (const [c, re] of Object.entries(cats)) {
  const got = new Map();
  for (const e of entries.values()) for (const nm of [e.id, ...e.al]) { const m = nm.match(re); if (!m) continue; const n = +m[1], prev = got.get(n); if (!prev || (prev.st !== 'L' && e.st === 'L')) got.set(n, e); }
  const [lo, hi] = EXPECT[c], missing = []; for (let i = lo; i <= hi; i++) if (!got.has(i)) missing.push(i);
  const st = { L: 0, C: 0, X: 0 }, why = {}, sbq = {};
  for (const e of got.values()) { st[e.st]++; if (e.st === 'X') why[e.why] = (why[e.why] || 0) + 1; if (e.st === 'C') sbq[e.sbq] = (sbq[e.sbq] || 0) + 1; }
  rep[c] = { expect: hi - lo + 1, found: got.size, missing, st, why, sbq };
}
const SBQ = { m: 'dalla magnitudine misurata', c: 'dalla classe di luminosità Sharpless', o: 'dall’opacità Lynds', t: 'valore tipico del tipo (non misurata)' };
let md = `# Copertura del catalogo

Generato da \`scripts/build-index.cjs\` il ${new Date().toISOString().slice(0, 10)}. Confronto fra le fonti e il catalogo di Skyframe.

**Fonti.** NGC e IC: OpenNGC (M. Verga, CC BY-SA 4.0), compilazione aggiornata dei cataloghi di Dreyer con dati da NED, HyperLEDA e SIMBAD, qui controllata sulla numerazione completa (NGC 1–7840, IC 1–5386). Messier: le identificazioni di OpenNGC (colonna M e addendum). Sharpless: VizieR VII/20 (Sharpless 1959, 313 regioni). Lynds: VizieR VII/7A (Lynds 1962, 1802 nubi; il file VizieR elenca ${[...entries.values()].filter((e) => e.src === 'LDN').length} righe).

**Stati.** *Nella lista*: dati completi, l'oggetto è classificato ogni notte. *Calcolabile*: tipo gestito e dimensioni note, i tempi si calcolano quando lo apri; la luminosità superficiale può essere misurata o stimata (vedi sotto). *Dati insufficienti*: è nel catalogo, lo trovi cercandolo, ma non c'è una stima (per esempio stelle, asterismi, voci inesistenti).

| Catalogo | voci attese | trovate | nella lista | calcolabili | dati insufficienti | mancanti |
| --- | --- | --- | --- | --- | --- | --- |
`;
for (const [c, r] of Object.entries(rep)) md += `| ${c} | ${r.expect} | ${r.found} | ${r.st.L} | ${r.st.C} | ${r.st.X} | ${r.missing.length ? r.missing.slice(0, 12).join(', ') + (r.missing.length > 12 ? ` … (${r.missing.length})` : '') : '—'} |\n`;
md += `\n## Motivi dei dati insufficienti\n\n`;
for (const [c, r] of Object.entries(rep)) if (Object.keys(r.why).length) md += `- **${c}**: ${Object.entries(r.why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}\n`;
md += `\n## Luminosità superficiale degli oggetti calcolabili\n\n`;
for (const [c, r] of Object.entries(rep)) if (Object.keys(r.sbq).length) md += `- **${c}**: ${Object.entries(r.sbq).map(([k, v]) => `${SBQ[k]} ${v}`).join(' · ')}\n`;
md += `\n## Note\n
- **M 102** ha un'identificazione controversa: OpenNGC, seguendo NED, la tratta come doppione di M 101 (altri la identificano con NGC 5866). Cercando M 102 si apre M 101.
- **LDN**: il file VizieR VII/7A contiene ${ldnRaw.size} numeri distinti su 1802; mancano già nella fonte ${(() => { const m = []; for (let i = 1; i <= 1802; i++) if (!ldnRaw.has(i)) m.push(i); return m.join(', '); })()}.
- Le voci doppie di OpenNGC (${dup.length}) non sono oggetti a sé: sono state aggiunte come nomi alternativi dell'oggetto a cui rimandano, così la ricerca le trova senza duplicati.
- La lista classificata ogni notte (${DSO.length} oggetti) è una selezione: galassie più deboli di mag 12 o più piccole di 1,5′, globulari più deboli di mag 10, ammassi aperti deboli e piccoli, oggetti a sud di −45° (−35° per le nubi oscure) restano fuori dalla classifica per non riempirla di oggetti poco fotografati, ma sono nell'indice e si calcolano a richiesta.
- Una luminosità superficiale **stimata** (classe Sharpless, opacità Lynds, valore tipico) rende il tempo indicativo: il dettaglio lo segnala.
`;
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/CATALOGO.md'), md);
console.log(JSON.stringify(Object.fromEntries(Object.entries(rep).map(([c, r]) => [c, { attese: r.expect, trovate: r.found, ...r.st, mancanti: r.missing.length }]))));
