'use strict';
/* ============================ catalogo completo ============================
   La lista classificata ogni notte (src/data/dso.js) è una selezione. L'indice (src/data/index.js, scripts/build-index.cjs)
   contiene tutte le voci Messier, NGC, IC, Sharpless e Lynds con uno stato: nella lista, calcolabile a richiesta, oppure
   presente ma senza dati sufficienti. Si carica solo quando serve (una ricerca, un oggetto fuori lista salvato) perché
   pesa quasi 1 MB. Un oggetto calcolabile aperto o salvato entra nel catalogo dell'app e da lì si calcola come gli altri;
   gli id restano in sf.extra per ritrovarli al prossimo avvio. */
const IDX = { rows: null, loading: null, byName: null };
const TYPE_OF = { G: 'Gx', E: 'EN', P: 'PN', S: 'SNR', R: 'RN', D: 'DN', O: 'OC', C: 'GC' };
const SBQ_TXT = { m: 'luminosità superficiale dalla magnitudine misurata', c: 'luminosità superficiale stimata dalla classe Sharpless: tempo indicativo', o: 'luminosità superficiale stimata dall’opacità Lynds: tempo indicativo', t: 'luminosità superficiale non misurata (valore tipico del tipo): tempo indicativo' };
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
function loadIndex() {
  if (IDX.rows) return Promise.resolve(IDX.rows);
  if (IDX.loading) return IDX.loading;
  IDX.loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'data/index.js';
    s.onload = () => { IDX.rows = window.CAT_INDEX || []; IDX.byName = new Map(); for (const r of IDX.rows) { IDX.byName.set(norm(r[0]), r); if (r[1]) r[1].split('|').forEach((a) => IDX.byName.set(norm(a), r)); } res(IDX.rows); };
    s.onerror = () => { IDX.loading = null; rej(new Error('indice non caricato')); };
    document.head.appendChild(s);
  });
  return IDX.loading;
}
/* voce calcolabile → oggetto del catalogo (gli stessi campi della lista; senza contesto, polveri o Hα misurati) */
function objFromRow(r) {
  const [id, alias, , t, ra, dec, a, b, pa, mag, sb, sbq, con, nick] = r, type = TYPE_OF[t];
  return { id, alias: alias ? alias.split('|') : [], nick: nick || '', type, ra, dec, a, b: b || a, pa: pa || 0, mag, sb, con: con || '', src: id.split(/[\s-]/)[0], classic: false, tip: '', ctx: [], ha: 0, lk: type, dust: 0, haM: 0, haF: 0, extra: true, sbq, search: norm(id + ' ' + (alias || '') + ' ' + (nick || '')) };
}
const extraIds = () => LS.get('sf.extra', []);
/* aggiunge un oggetto dell'indice al catalogo dell'app (una volta); true se è calcolabile */
function adoptExtra(id) {
  if (CAT_BY_ID.has(id)) return true;
  const r = IDX.byName && IDX.byName.get(norm(id)); if (!r || r[2] !== 'C') return false;
  const o = objFromRow(r); CAT.push(o); CAT_BY_ID.set(o.id, o);
  const L = extraIds(); if (!L.includes(o.id)) LS.set('sf.extra', L.concat(o.id).slice(-200));
  return true;
}
/* all'avvio: gli oggetti fuori lista salvati (o nei progetti) rientrano prima del primo calcolo */
async function restoreExtras(projects) {
  const want = [...new Set(extraIds().concat(Object.keys(projects || {})))].filter((id) => !CAT_BY_ID.has(id));
  if (!want.length) return;
  try { await loadIndex(); want.forEach(adoptExtra); } catch (e) { /* senza indice restano fuori */ }
}
/* apre un oggetto dell'indice: calcolabile → dettaglio; senza dati → foglio con il motivo */
async function openIndexEntry(name) {
  await loadIndex();
  const r = IDX.byName.get(norm(name)); if (!r) return;
  if (r[2] === 'L') { openDetail(r[3] || r[0]); return; }
  if (r[2] === 'C') {
    adoptExtra(r[0]);
    const o = CAT_BY_ID.get(r[0]), x = computeObj(state.res.C, o);
    if (!x) { toast(tx('{t} non sale mai sopra l’altezza minima da questo luogo', { t: o.id })); return; }
    state.res.results.push(x); state.byId.set(o.id, x); openDetail(o.id); return;
  }
  openSheet({ title: r[0], body: `<p class="info-txt">${esc(tx('Presente nel catalogo, ma senza dati sufficienti per stimare i tempi: {w}.', { w: tx(r[3]) }))}</p>${r[1] ? `<p class="hint">${tx('Altri nomi')}: ${esc(r[1].split('|').join(', '))}</p>` : ''}${r[4] != null ? `<p class="hint">RA ${raStr(r[4])} · Dec ${decStr(r[5])}</p>` : ''}` });
}
/* ricerca nell'indice: voci che non sono già nei risultati della lista (massimo 30) */
function indexHits(q, shown) {
  if (!IDX.rows || !q) return [];
  const out = [], seen = new Set(shown);
  for (const r of IDX.rows) {
    const id = r[2] === 'L' ? r[3] || r[0] : r[0];
    if (seen.has(id)) continue;
    const hay = norm(r[0] + ' ' + (r[1] || '') + ' ' + (r[2] === 'C' ? r[13] || '' : ''));
    if (!hay.includes(q)) continue;
    // nella lista ma non trovato dalla ricerca della lista (un nome che solo l'indice conosce, come M 102 → M 101)
    if (r[2] === 'L' && (!state.byId.has(id) || (state.byId.get(id).o.search || '').includes(q))) continue;
    seen.add(id); out.push(r); if (out.length >= 30) break;
  }
  return out;
}
function indexHitsHTML(hits) {
  if (!hits.length) return '';
  return `<div class="idx"><div class="idx-h">${tx('Nel catalogo, fuori dalla lista di stanotte')}</div>${hits.map((r) => `<button type="button" class="idx-row" data-idx="${esc(r[0])}"><span class="t">${esc(r[0])}${r[1] ? `<small>${esc(r[1].split('|').slice(0, 3).join(', '))}</small>` : ''}</span><span class="s ${r[2] === 'X' ? 'no' : 'ok'}">${r[2] === 'C' ? `${tx(TYPES[TYPE_OF[r[3]]])} · ${tx('calcolabile')}` : r[2] === 'L' ? tx('nella lista come {id}', { id: r[3] || r[0] }) : tx(r[3])}</span></button>`).join('')}</div>`;
}
