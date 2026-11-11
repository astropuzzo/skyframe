'use strict';
/* ============================ piano di stanotte ============================
   I tuoi target (progetti in corso e preferiti; senza, i primi della lista) messi in fila nelle ore buie. A ogni passo
   di 5 minuti va il target che lì rende di più rispetto al suo meglio (altezza sul suo percorso), con una spinta a chi
   sta per tramontare, blocchi di almeno 45 minuti per non cambiare di continuo, e chi ha finito il suo lavoro lascia il
   posto. Le ore contano col meteo: un'ora al 50% di cielo sgombro vale mezz'ora, e dove è coperto non si mette niente. */
const PLAN_MIN = 9; // passi da 5 min: 45 minuti
const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const planOk = (r) => r.usableH >= 0.25 && tonightStrat(r.e) && isFinite(tonightStrat(r.e).tonight) && !isDone(r.o.id);
/* il piano si corregge a mano: per ogni notte i target aggiunti (dal dettaglio) e quelli tolti (dal piano) */
const planEd = (ds) => { const e = LS.get('sf.planEd', {})[ds]; return { pin: (e && e.pin) || [], skip: (e && e.skip) || [] }; };
function setPlanEd(ds, fn) {
  const all = LS.get('sf.planEd', {}), today = defaultNightStr(); for (const k of Object.keys(all)) if (k < today) delete all[k];
  const e = planEd(ds); fn(e); all[ds] = e; LS.set('sf.planEd', all);
  renderTonight(); planNotifications(); if (state.sel && !$('#drawer').hidden) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; }
}
const planPin = (id) => setPlanEd(state.res.night.ds, (e) => { e.skip = e.skip.filter((x) => x !== id); if (!e.pin.includes(id)) e.pin.push(id); });
const planSkip = (id) => setPlanEd(state.res.night.ds, (e) => { e.pin = e.pin.filter((x) => x !== id); if (!e.skip.includes(id)) e.skip.push(id); });
const planReset = () => setPlanEd(state.res.night.ds, (e) => { e.pin = []; e.skip = []; });
/* noWx: il piano a cielo sereno (per gli avvisi di Android, che le nuvole le guardano all'ultimo); plain: senza i tuoi
   target si prendono i migliori della notte e non quelli che la lista sta mostrando (filtri, ricerca) */
function tonightPlan(noWx, plain) {
  const res = state.res; if (res.night.first < 0) return { blocks: [], mine: false, none: 'dark' };
  const ed = planEd(res.night.ds);
  let cand = res.results.filter((r) => planOk(r) && (inMyList(r.o.id) || ed.pin.includes(r.o.id)) && !ed.skip.includes(r.o.id)), mine = cand.length > 0;
  if (!mine) cand = (plain ? res.results.slice().sort((a, b) => b.score - a.score) : state.filtered).filter((r) => planOk(r) && !ed.skip.includes(r.o.id)).slice(0, 6);
  return { ...planNight(res.night, cand, mine, ed.pin, noWx), edited: ed.pin.length + ed.skip.length };
}
/* la stessa cosa per un'altra notte, solo coi tuoi target (serve agli avvisi di domani sera) */
function planOtherNight(ds, noWx) {
  const a = active(), ids = Object.keys(state.projects).filter((id) => inMyList(id) && !isDone(id)); if (!ids.length) return null;
  const C = computePrep(profileConfigs(a), a, ds, Date.now()); if (C.night.first < 0) return null;
  const ed = planEd(ds), cand = [...new Set(ids.concat(ed.pin))].filter((id) => !ed.skip.includes(id)).map((id) => CAT_BY_ID.get(id)).filter(Boolean).map((o) => computeObj(C, o)).filter((r) => r && planOk(r));
  return { night: C.night, plan: planNight(C.night, cand, true, ed.pin, noWx) };
}
function planNight(n, cand, mine, pins = [], noWx = false) {
  if (n.first < 0) return { blocks: [], mine, none: 'dark' };
  cand = cand.slice().sort((a, b) => b.score - a.score).slice(0, 14);
  if (!cand.length) return { blocks: [], mine, none: 'targets' };
  const T = cand.map((r) => {
    const id = r.o.id, prio = pins.includes(id) ? 1.6 : hasSessions(id) ? 1.3 : isFav(id) ? 1.15 : 1;
    let lastUse = -1; for (let i = n.first; i <= n.last; i++) if (r.use[i]) lastUse = i;
    const sinMax = Math.sin(Math.max(5, r.maxA) * D2R);
    return { r, id, prio: prio * (0.6 + r.score / 250), need: (1 - projProgress(id)) * tonightStrat(r.e).tonight, got: 0, lastUse, sinMax };
  });
  const val = (t, i) => { const a = t.r.alt[i]; const urg = 1 + 0.6 * clamp(1 - (t.lastUse - i) / 24, 0, 1); return t.prio * (Math.sin(Math.max(a, 1) * D2R) / t.sinMax) * urg; };
  const asg = new Array(N + 1).fill(-1);
  let cur = -1, len = 0;
  for (let i = n.first; i <= n.last; i++) {
    if (!n.dark[i]) { cur = -1; len = 0; continue; }
    const f = noWx ? null : wxAt(n.t[i]), w = f == null ? 1 : f;
    if (w < 0.3) { cur = -1; len = 0; continue; } // coperto: niente
    const free = (k) => T[k].r.use[i] && T[k].got < T[k].need;
    let best = -1, bv = 0; for (let k = 0; k < T.length; k++) if (free(k)) { const v = val(T[k], i); if (v > bv) { bv = v; best = k; } }
    if (cur >= 0 && free(cur) && (len < PLAN_MIN || val(T[cur], i) >= 0.85 * bv)) best = cur;
    if (best !== cur) { cur = best; len = 0; }
    if (best >= 0) { asg[i] = best; len++; T[best].got += w * STEP / 60; }
  }
  // spezzoni sotto i 20 minuti: al vicino
  const blocks = [];
  for (let i = n.first; i <= n.last; i++) {
    if (asg[i] < 0) continue; const k = asg[i]; let j = i; while (j + 1 <= n.last && asg[j + 1] === k) j++;
    blocks.push({ k, i0: i, i1: j }); i = j;
  }
  const out = [];
  for (const bl of blocks) { const prev = out[out.length - 1]; if (bl.i1 - bl.i0 + 1 < 4 && prev && prev.i1 === bl.i0 - 1) prev.i1 = bl.i1; else if (prev && prev.k === bl.k && prev.i1 === bl.i0 - 1) prev.i1 = bl.i1; else out.push({ ...bl }); }
  for (const bl of out) {
    const t = T[bl.k]; let hw = 0, hs = 0; for (let i = bl.i0; i <= bl.i1; i++) { const f = noWx ? null : wxAt(n.t[i]); hw += (f == null ? 1 : f) * STEP / 60; hs += STEP / 60; }
    Object.assign(bl, { r: t.r, id: t.id, t0: n.t[bl.i0], t1: n.t[bl.i1] + DT, h: hs, hClear: hw, frac: tonightStrat(t.r.e).tonight > 0 ? hw / tonightStrat(t.r.e).tonight : 0, s: tonightStrat(t.r.e) });
  }
  return { blocks: out, mine };
}
/* il piano come testo, da mandare a chi riprende con te o da tenere negli appunti */
function planText() {
  const n = state.res.night, P = tonightPlan(), day = fmtNight(n.t0, { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = P.blocks.map((b) => `${fmtT(b.t0)}–${fmtT(b.t1)}  ${b.id}${b.r.o.nick ? ' (' + b.r.o.nick + ')' : ''} · ${b.s.label} · ${fmtH(b.hClear)}${b.r.transit > b.t0 && b.r.transit < b.t1 ? ' · ' + tx('meridiano {t}', { t: fmtT(b.r.transit) }) : ''}`);
  return [`${activeLoc().site.name} · ${day}`, n.first >= 0 ? tx('Buio {a}–{b}', { a: fmtT(n.t[n.first]), b: fmtT(n.t[n.last] + DT) }) + ' · ' + tx('Luna {p}%', { p: Math.round(n.moonIll * 100) }) : '', ...rows, 'Skyframe'].filter(Boolean).join('\n');
}
async function sharePlan() {
  const text = planText();
  if (window.cielo && window.cielo.shareText) { await window.cielo.shareText(tx('Il piano della notte'), text); return; }
  if (navigator.share) try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(text);
}
/* N.I.N.A.: tutti i target del piano in un solo CSV (formato Telescopius, come dal dettaglio), nell'ordine della notte e
   con l'inquadratura consigliata; i mosaici con i loro pannelli */
function ninaPlanCsv(blocks) {
  const seen = new Set(), rows = []; let head = '';
  for (const b of blocks) {
    if (seen.has(b.id)) continue; seen.add(b.id);
    const e = b.r.e, g = e.cfg.geom, fr = framingFor(b.r.o, b.r.field, g);
    const L = ninaCsv(b.id, mosaicPanes(b.r.o, g, e.fill.nx, e.fill.ny, fr.free ? 90 : fr.pa, [fr.dx, fr.dy]), g, tx('Pannello')).trim().split('\n');
    head = L[0]; rows.push(...L.slice(1));
  }
  return rows.length ? [head, ...rows].join('\n') + '\n' : '';
}
function openPlanExport() {
  const item = (k, t, d) => `<button type="button" class="st-item" data-x="${k}"><span class="tx"><b>${tx(t)}</b><small>${tx(d)}</small></span>${ic('chev-r')}</button>`;
  openSheet({
    title: tx('Esporta il piano'), body: `<div class="st-list">${item('text', 'Testo', 'orari, target e filtri')}${item('nina', 'CSV per N.I.N.A.', 'tutti i target con l’inquadratura consigliata')}</div>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return; close();
      if (b.dataset.x === 'text') sharePlan(); else saveText(`skyframe-piano-${state.res.night.ds}-nina.csv`, ninaPlanCsv(tonightPlan().blocks));
    }),
  });
}
/* a notte iniziata, ogni blocco del piano si registra come sessione con un tocco (ore serene del blocco; si corregge
   nel dettaglio del target) */
const loggedOn = (id, ds) => !!(state.projects[id] && (state.projects[id].sessions || []).some((q) => q.date === ds));
function logBtn(n, b) {
  if (Date.now() < b.t0 - 10 * 60000) return '';
  const done = loggedOn(b.id, n.ds);
  return `<button type="button" class="icon-btn tn-log${done ? ' on' : ''}" ${done ? 'disabled' : `data-log="${esc(b.id)}"`} title="${tx(done ? 'Sessione già registrata' : 'Registra la sessione')}" aria-label="${tx(done ? 'Sessione già registrata' : 'Registra la sessione')}">${ic('check', 'sm')}</button>`;
}
function logFromPlan(id) {
  const n = state.res.night, P = tonightPlan(), b = P.blocks.find((x) => x.id === id); if (!b) return;
  // quanto vale: le ore che servirebbero con notti come questa (Luna compresa), come nel piano
  const r = b.r, e = r.e, s = tonightStrat(e), l = activeLoc(), need = isFinite(s.tonight) && s.tonight > 0 ? s.tonight : needHours(id, e.cfg.key, s.id, l.id), h = Math.max(0.25, Math.round(b.hClear * 4) / 4);
  addSession(id, { date: n.ds, h, loc: l.id, locName: l.site.name, cfg: e.cfg.key, cfgLabel: e.cfg.label, strat: s.id, stratLabel: s.label, need, frac: need ? h / need : 0 });
  toast(need ? tx('{t}: {h} registrate, +{p}% dell’integrazione', { t: id, h: fmtH(h), p: Math.round(h / need * 100) }) : tx('Sessione salvata'));
}
function renderTonight() {
  const el = $('#tonight'); if (!el || !state.res) return;
  const n = state.res.night, P = tonightPlan(), wn = wxNight(n);
  const on = notifyOn(), today = n.ds === defaultNightStr();
  const bell = `<button type="button" class="icon-btn tn-bell" id="notifyBtn" aria-pressed="${on}" title="${tx(on ? 'Avviso attivo: un’ora prima del buio, se la previsione è serena' : 'Avvisami se la notte è serena')}" aria-label="${tx('Avvisi')}">${ic(on ? 'bell-on' : 'bell')}</button>`;
  const share = P.blocks.length ? `<button type="button" class="icon-btn" id="planShare" title="${tx('Esporta il piano')}" aria-label="${tx('Esporta il piano')}">${ic('upload')}</button>` : '';
  const head = `<div class="card-h"><h3>${tx('Il piano della notte')}</h3><span class="acts">${share}${bell}</span></div>`;
  const wire = () => { el.onclick = (ev) => {
    if (ev.target.closest('#notifyBtn')) { toggleNotify(); return; }
    if (ev.target.closest('#planShare')) { openPlanExport(); return; }
    const lg = ev.target.closest('[data-log]'); if (lg) { logFromPlan(lg.dataset.log); return; }
    const k = ev.target.closest('[data-skip]'); if (k) { planSkip(k.dataset.skip); toast(tx('{t} tolto dal piano', { t: k.dataset.skip })); return; }
    if (ev.target.closest('[data-reset]')) { planReset(); return; }
    const x = ev.target.closest('[data-id]'); if (x) openDetail(x.dataset.id, x);
  }; };
  if (!P.blocks.length) { el.innerHTML = head + `<div class="note">${P.none === 'dark' ? tx('Stanotte niente buio astronomico.') : WX.d && wn && wn.clear < 0.15 ? tx('Previsto coperto: nessuna ripresa possibile.') : tx('Nessun target riprendibile stanotte.')}${P.edited ? ` · <button type="button" class="link" data-reset>${tx('Ripristina')}</button>` : ''}</div>`; wire(); return; }
  // la notte in orizzontale: buio, nuvole previste (in alto), i blocchi coi nomi, l'ora scelta
  const i0 = n.w0, i1 = n.w1, P0 = n.t[i0], span = n.t[i1] - P0, X = (ms) => ((ms - P0) / span * 100).toFixed(2);
  let track = n.first >= 0 ? `<div class="tn-dark" style="left:${X(n.t[n.first])}%;width:${(X(n.t[n.last] + DT) - X(n.t[n.first])).toFixed(2)}%"></div>` : '';
  if (WX.d) for (let i = i0; i < i1; i += 3) { const f = wxAt(n.t[i]); if (f != null && f < 0.95) track += `<i class="tn-cl" style="left:${X(n.t[i])}%;width:${(300 / (i1 - i0) * 1.02).toFixed(2)}%;opacity:${(0.8 * (1 - f)).toFixed(2)}"></i>`; }
  track += P.blocks.map((b) => { const c = TYPE_COLOR[b.r.o.type]; return `<button type="button" class="tn-b" data-id="${esc(b.id)}" style="left:${X(b.t0)}%;width:calc(${(X(b.t1) - X(b.t0)).toFixed(2)}% - 2px);background:${hexA(c, 0.28)};border-color:${c}" title="${esc(b.id)} ${fmtT(b.t0)}–${fmtT(b.t1)}"><span>${esc(b.id)}</span></button>`; }).join('');
  const t = Dome.time; if (t >= P0 && t <= n.t[i1]) track += `<i class="tn-now" style="left:${X(t)}%"></i>`;
  const ticks = []; const h0 = hourFloor(P0);
  for (let ms = h0 + 3600000; ms < n.t[i1]; ms += 3600000) { if (hourOf(ms) % 2) continue; ticks.push(`<span style="left:${X(ms)}%">${pad2(hourOf(ms))}</span>`); }
  const wtxt = wn ? (wn.clear >= 0.85 ? tx('Previsto sereno') : wn.clear < 0.15 ? tx('Previsto coperto') : wn.win && wn.winH >= 1 ? tx('Sereno solo {a}–{b}', { a: fmtT(wn.win[0]), b: fmtT(wn.win[1]) }) : tx('Nuvolosità variabile · {p}% del buio sereno', { p: Math.round(wn.clear * 100) })) : '';
  el.innerHTML = head + `<div class="tn-g"><div class="tn-track">${track}</div><div class="tn-ax">${ticks.join('')}</div></div>
    <ol class="tn-l">${P.blocks.map((b) => `<li><button type="button" class="tn-row" data-id="${esc(b.id)}"><i style="background:${TYPE_COLOR[b.r.o.type]}"></i><span class="nm"><span class="l1"><b>${esc(b.id)}</b>${b.r.o.nick ? `<small>${esc(b.r.o.nick)}</small>` : ''}</span><span class="tm num">${fmtT(b.t0)}–${fmtT(b.t1)}<span class="fs">${esc(b.s.short)}${b.r.e.moonBest ? ' ' + ic('moon', 'sm') : ''}${b.r.transit > b.t0 + 10 * 60000 && b.r.transit < b.t1 - 10 * 60000 ? `<span class="mer">${tx('meridiano {t}', { t: fmtT(b.r.transit) })}</span>` : ''}</span></span></span><span class="hh num">${fmtH(b.hClear)}${b.frac > 0.005 ? `<b>+${Math.round(Math.min(1, b.frac) * 100)}% ${tx('del lavoro')}</b>` : ''}</span></button>${logBtn(n, b)}<button type="button" class="icon-btn tn-x" data-skip="${esc(b.id)}" title="${tx('Togli dal piano')}" aria-label="${tx('Togli {t} dal piano', { t: b.id })}">${ic('x', 'sm')}</button></li>`).join('')}</ol>
    ${P.edited ? `<div class="note">${tx('Modificato da te')} · <button type="button" class="link" data-reset>${tx('ripristina')}</button></div>` : ''}
    ${wtxt ? `<div class="note">${esc(wtxt)}${WX.d ? ' · ' + tx('meteo Open-Meteo') : ''}</div>` : ''}`;
  wire();
}
