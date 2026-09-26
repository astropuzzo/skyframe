'use strict';
/* ============================ preferiti e progetti ============================
   Per ogni target: preferito sì/no, le sessioni fatte e "fatto". Ogni sessione ricorda quanta parte del lavoro valeva
   quando l'hai registrata (ore fatte / ore che servivano allora con quel profilo, quel luogo e quella strategia): così
   l'avanzamento non cambia se poi cambi attrezzatura, e sessioni fatte in luoghi diversi si sommano nel modo giusto
   (un'ora sotto un cielo buio vale più di un'ora dal terrazzo). Il calendario delle notti parte dal lavoro già fatto. */
function projOf(id, make) {
  let p = state.projects[id];
  if (!p && make) p = state.projects[id] = { fav: false, done: false, sessions: [], created: Date.now() };
  return p || null;
}
const isFav = (id) => !!(state.projects[id] && state.projects[id].fav);
const isDone = (id) => !!(state.projects[id] && state.projects[id].done);
const hasSessions = (id) => !!(state.projects[id] && (state.projects[id].sessions || []).length);
const inMyList = (id) => isFav(id) || hasSessions(id) || isDone(id);
function projProgress(id) {
  const p = state.projects[id]; if (!p) return 0; if (p.done) return 1;
  return Math.min(1, (p.sessions || []).reduce((a, s) => a + (+s.frac || 0), 0));
}
const projHoursDone = (id) => { const p = state.projects[id]; return p ? (p.sessions || []).reduce((a, s) => a + (+s.h || 0), 0) : 0; };
/* dopo ogni modifica: si salva, i calendari ripartono dal lavoro fatto, si ridisegna quello che si vede */
function projTouched() {
  saveStore();
  const A = state.res && state.res.C && state.res.C.ahead; if (A) A.cache.clear();
  applyFilters(); renderList(); renderTonight(); pushDome(); planNotifications();
  if (state.sel && !$('#drawer').hidden) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; }
}
function tidyProj(id) { const p = state.projects[id]; if (p && !p.fav && !p.done && !(p.sessions || []).length) delete state.projects[id]; }
function toggleFav(id) {
  const p = projOf(id, true); p.fav = !p.fav; p.updated = Date.now(); tidyProj(id); projTouched();
  toast(tx(p.fav ? '{t} è tra i preferiti' : '{t} tolto dai preferiti', { t: id }));
}
function setDone(id, v) { const p = projOf(id, true); p.done = !!v; p.doneAt = v ? Date.now() : undefined; p.updated = Date.now(); tidyProj(id); projTouched(); }
function addSession(id, s) {
  const p = projOf(id, true); p.sessions = (p.sessions || []).concat({ ...s, ts: Date.now() });
  p.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts)); p.updated = Date.now(); projTouched();
}
function removeSession(id, ts) { const p = projOf(id); if (!p) return; p.sessions = p.sessions.filter((s) => s.ts !== ts); p.updated = Date.now(); tidyProj(id); projTouched(); }
/* ore che servono a un target con una strategia in un luogo (profilo attivo): la base per pesare una sessione */
function needHours(id, cfgKey, stratId, locId) {
  const l = state.locs.find((x) => x.id === locId) || activeLoc(), o = CAT_BY_ID.get(id);
  const r = l.id === activeLoc().id ? state.byId.get(id) : o ? cmpFull(l, o) : null; if (!r) return null;
  const e = r.evals.find((x) => x.cfg.key === cfgKey) || r.e, s = e.strat.find((x) => x.id === stratId) || e.best;
  const h = s ? hoursOf(s) : Infinity; return isFinite(h) ? h : null;
}
/* progetti e preferiti nel file importato: si uniscono a quelli che ci sono (sessioni riconosciute dall'istante in cui
   sono state registrate) */
function mergeProjects(inc) {
  if (!inc || typeof inc !== 'object') return;
  for (const [id, q] of Object.entries(inc)) {
    if (!q || typeof q !== 'object') continue;
    const p = projOf(id, true), have = new Set((p.sessions || []).map((s) => s.ts));
    p.fav = p.fav || !!q.fav; p.done = p.done || !!q.done;
    p.sessions = (p.sessions || []).concat((q.sessions || []).filter((s) => s && !have.has(s.ts))).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));
    tidyProj(id);
  }
}

/* ---------- nel dettaglio: la scheda del progetto ---------- */
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
function projHTML(r, e, b) {
  const id = r.o.id, p = state.projects[id], fav = isFav(id), done = isDone(id), prog = projProgress(id), hd = projHoursDone(id);
  const need = b ? hoursOf(b) : Infinity, rem = isFinite(need) ? need * (1 - prog) : null;
  const status = done ? `<span class="pst done">✓ ${tx('fatto')}</span>` : hd > 0 ? `<span class="pst wip">${tx('in corso')}</span>` : fav ? `<span class="pst fav">★ ${tx('preferito')}</span>` : '';
  const sess = p && (p.sessions || []).length ? `<ul class="sess">${p.sessions.map((s) => `<li><span class="d">${fmtDate(s.date)}<small>${esc(s.locName || '')}</small></span><span class="s">${esc(s.stratLabel || '')}</span><b class="num">${fmtH(+s.h)}</b><em class="num">${s.frac ? '+' + Math.round(s.frac * 100) + '%' : ''}</em><button class="btn sm ghost" data-del="${s.ts}" aria-label="${tx('Elimina la sessione')}" title="${tx('Elimina la sessione')}">✕</button></li>`).join('')}</ul>` : '';
  const bar = hd > 0 || done ? `<div class="pbar big"><b style="width:${Math.round(prog * 100)}%"></b></div>
    <div class="pnum">${done ? tx('Segnato come fatto') : tx('{p}% del lavoro · {h} fatte', { p: Math.round(prog * 100), h: fmtH(hd) })}${!done && rem != null ? ' · ' + (prog >= 1 ? tx('tempo stimato raccolto') : tx('mancano ≈ {h} qui', { h: fmtH(rem) })) : ''}</div>` : `<div class="pnum">${tx('Registra le notti che fai: Skyframe tiene il conto e ricalcola quante ne mancano.')}</div>`;
  const today = $('#nightDate').value || defaultNightStr();
  const strats = e.strat.filter((s) => isFinite(hoursOf(s)));
  const form = `<form class="sform" id="sForm" hidden>
      <label class="field"><span>${tx('Notte del')}</span><input type="date" id="sDate" value="${today}" required></label>
      <label class="field"><span>${tx('Ore di posa')}</span><input type="number" id="sH" min="0.05" step="any" inputmode="decimal" required></label>
      <label class="field w2"><span>${tx('Con')}</span><select id="sStrat">${strats.map((s) => `<option value="${esc(s.id)}" ${b && s.id === b.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
      <label class="field w2"><span>${tx('Dove')}</span><select id="sLoc">${state.locs.map((l) => `<option value="${esc(l.id)}" ${l.id === state.locId ? 'selected' : ''}>${esc(l.site.name)}</option>`).join('')}</select></label>
      <div class="acts"><button class="btn sm primary" type="submit">${tx('Salva la sessione')}</button><button class="btn sm ghost" type="button" id="sCancel">${tx('Annulla')}</button></div>
    </form>`;
  return `<div class="proj${done ? ' is-done' : ''}" id="proj">
    <div class="ph"><span class="lbl">${tx('Il tuo progetto')}</span>${status}
      <div class="acts"><button class="btn sm${fav ? ' on' : ''}" id="pFav" aria-pressed="${fav}">${fav ? '★ ' + tx('Preferito') : '☆ ' + tx('Aggiungi ai preferiti')}</button>
      ${done ? `<button class="btn sm ghost" id="pDone">${tx('Riapri')}</button>` : `<button class="btn sm" id="pAdd">＋ ${tx('Registra una sessione')}</button>${hd > 0 ? `<button class="btn sm ghost" id="pDone">✓ ${tx('Segna come fatto')}</button>` : ''}`}</div></div>
    ${bar}${sess}${form}</div>`;
}
function wireProj(r, e) {
  const id = r.o.id, box = $('#proj'); if (!box) return;
  $('#pFav').onclick = () => toggleFav(id);
  const pd = $('#pDone'); if (pd) pd.onclick = () => setDone(id, !isDone(id));
  const pa = $('#pAdd'), f = $('#sForm');
  if (pa) pa.onclick = () => { f.hidden = false; pa.hidden = true; $('#sH').focus(); };
  $('#sCancel').onclick = () => { f.hidden = true; if (pa) pa.hidden = false; };
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const h = +String($('#sH').value).replace(',', '.'), date = $('#sDate').value, stratId = $('#sStrat').value, locId = $('#sLoc').value;
    if (!(h > 0) || !date) return;
    const s = e.strat.find((x) => x.id === stratId), l = state.locs.find((x) => x.id === locId);
    const need = needHours(id, e.cfg.key, stratId, locId);
    addSession(id, { date, h, loc: locId, locName: l ? l.site.name : '', cfg: e.cfg.key, cfgLabel: e.cfg.label, strat: stratId, stratLabel: s ? s.label : '', need, frac: need ? h / need : 0 });
    toast(need ? tx('Sessione salvata: +{p}% del lavoro', { p: Math.round(h / need * 100) }) : tx('Sessione salvata'));
    if (projProgress(id) >= 1 && !isDone(id)) toast(tx('Hai raccolto tutto il tempo stimato: segnalo come fatto quando ti piace il risultato'));
  };
  box.onclick = (ev) => { const d = ev.target.closest('[data-del]'); if (d) removeSession(id, +d.dataset.del); };
}

/* ---------- nella lista ---------- */
function favBtn(id) { const f = isFav(id); return `<button class="fav${f ? ' on' : ''}" data-fav="${esc(id)}" aria-pressed="${f}" title="${tx(f ? 'Togli dai preferiti' : 'Aggiungi ai preferiti')}" aria-label="${tx(f ? 'Togli dai preferiti' : 'Aggiungi ai preferiti')}">${f ? '★' : '☆'}</button>`; }
function rowProgress(r) {
  const id = r.o.id; if (isDone(id)) return `<span class="rdone">✓ ${tx('fatto')}</span>`;
  const prog = projProgress(id); if (!(prog > 0)) return '';
  const b = r.e.best, rem = b && isFinite(hoursOf(b)) ? hoursOf(b) * (1 - prog) : null;
  return `<span class="rprog" title="${tx('{p}% del lavoro fatto', { p: Math.round(prog * 100) })}"><i style="width:${Math.round(prog * 100)}%"></i></span><small>${Math.round(prog * 100)}%${prog >= 1 ? ' · ' + tx('tempo stimato raccolto') : rem != null ? ' · ' + tx('mancano ≈ {h}', { h: fmtH(rem) }) : ''}</small>`;
}
