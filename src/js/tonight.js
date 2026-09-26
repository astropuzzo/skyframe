'use strict';
/* ============================ piano di stanotte ============================
   I tuoi target (progetti in corso e preferiti; senza, i primi della lista) messi in fila nelle ore buie. A ogni passo
   di 5 minuti va il target che lì rende di più rispetto al suo meglio (altezza sul suo percorso), con una spinta a chi
   sta per tramontare, blocchi di almeno 45 minuti per non cambiare di continuo, e chi ha finito il suo lavoro lascia il
   posto. Le ore contano col meteo: un'ora al 50% di cielo sgombro vale mezz'ora, e dove è coperto non si mette niente. */
const PLAN_MIN = 9; // passi da 5 min: 45 minuti
const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const planOk = (r) => r.usableH >= 0.25 && r.e.best && isFinite(r.e.best.tonight) && !isDone(r.o.id);
function tonightPlan() {
  const res = state.res; if (res.night.first < 0) return { blocks: [], mine: false, none: 'dark' };
  let cand = res.results.filter((r) => planOk(r) && inMyList(r.o.id)), mine = cand.length > 0;
  if (!mine) cand = state.filtered.filter(planOk).slice(0, 6);
  return planNight(res.night, cand, mine);
}
/* la stessa cosa per un'altra notte, solo coi tuoi target (serve agli avvisi di domani sera) */
function planOtherNight(ds) {
  const a = active(), ids = Object.keys(state.projects).filter((id) => inMyList(id) && !isDone(id)); if (!ids.length) return null;
  const C = computePrep(profileConfigs(a), a, ds, Date.now()); if (C.night.first < 0) return null;
  const cand = ids.map((id) => CAT_BY_ID.get(id)).filter(Boolean).map((o) => computeObj(C, o)).filter((r) => r && planOk(r));
  return { night: C.night, plan: planNight(C.night, cand, true) };
}
function planNight(n, cand, mine) {
  if (n.first < 0) return { blocks: [], mine, none: 'dark' };
  cand = cand.slice().sort((a, b) => b.score - a.score).slice(0, 14);
  if (!cand.length) return { blocks: [], mine, none: 'targets' };
  const T = cand.map((r) => {
    const id = r.o.id, prio = hasSessions(id) ? 1.3 : isFav(id) ? 1.15 : 1;
    let lastUse = -1; for (let i = n.first; i <= n.last; i++) if (r.use[i]) lastUse = i;
    const sinMax = Math.sin(Math.max(5, r.maxA) * D2R);
    return { r, id, prio: prio * (0.6 + r.score / 250), need: (1 - projProgress(id)) * r.e.best.tonight, got: 0, lastUse, sinMax };
  });
  const val = (t, i) => { const a = t.r.alt[i]; const urg = 1 + 0.6 * clamp(1 - (t.lastUse - i) / 24, 0, 1); return t.prio * (Math.sin(Math.max(a, 1) * D2R) / t.sinMax) * urg; };
  const asg = new Array(N + 1).fill(-1);
  let cur = -1, len = 0;
  for (let i = n.first; i <= n.last; i++) {
    if (!n.dark[i]) { cur = -1; len = 0; continue; }
    const f = wxAt(n.t[i]), w = f == null ? 1 : f;
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
    const t = T[bl.k]; let hw = 0, hs = 0; for (let i = bl.i0; i <= bl.i1; i++) { const f = wxAt(n.t[i]); hw += (f == null ? 1 : f) * STEP / 60; hs += STEP / 60; }
    Object.assign(bl, { r: t.r, id: t.id, t0: n.t[bl.i0], t1: n.t[bl.i1] + DT, h: hs, hClear: hw, frac: t.r.e.best.tonight > 0 ? hw / t.r.e.best.tonight : 0 });
  }
  return { blocks: out, mine };
}
function renderTonight() {
  const el = $('#tonight'); if (!el || !state.res) return;
  const n = state.res.night, P = tonightPlan(), wn = wxNight(n);
  const on = notifyOn(), today = n.ds === defaultNightStr();
  const bell = `<button type="button" class="icon-btn tn-bell" id="notifyBtn" aria-pressed="${on}" title="${tx(on ? 'Avvisi attivi: un’ora prima del buio, quando il meteo dà sereno per i tuoi target' : 'Avvisami le sere serene per i miei target')}" aria-label="${tx('Avvisi')}">${ic(on ? 'bell-on' : 'bell')}</button>`;
  const head = `<div class="card-h"><h3>${today ? tx('Piano di stanotte') : tx('Piano della notte')}</h3><small>${P.mine ? tx('i tuoi preferiti e progetti') : tx('i primi della lista')}</small><span class="acts">${bell}</span></div>`;
  const wire = () => { el.onclick = (ev) => { if (ev.target.closest('#notifyBtn')) { toggleNotify(); return; } const x = ev.target.closest('[data-id]'); if (x) openDetail(x.dataset.id); }; };
  if (!P.blocks.length) { el.innerHTML = head + `<div class="note">${P.none === 'dark' ? tx('Stanotte non c’è buio astronomico.') : WX.d && wn && wn.clear < 0.15 ? tx('Previsto coperto: niente da mettere in fila.') : tx('Nessun target da mettere in fila stanotte.')}</div>`; wire(); return; }
  // la notte in orizzontale: buio, nuvole previste (in alto), i blocchi coi nomi, l'ora scelta
  const i0 = n.w0, i1 = n.w1, P0 = n.t[i0], span = n.t[i1] - P0, X = (ms) => ((ms - P0) / span * 100).toFixed(2);
  let track = n.first >= 0 ? `<div class="tn-dark" style="left:${X(n.t[n.first])}%;width:${(X(n.t[n.last] + DT) - X(n.t[n.first])).toFixed(2)}%"></div>` : '';
  if (WX.d) for (let i = i0; i < i1; i += 3) { const f = wxAt(n.t[i]); if (f != null && f < 0.95) track += `<i class="tn-cl" style="left:${X(n.t[i])}%;width:${(300 / (i1 - i0) * 1.02).toFixed(2)}%;opacity:${(0.8 * (1 - f)).toFixed(2)}"></i>`; }
  track += P.blocks.map((b) => { const c = TYPE_COLOR[b.r.o.type]; return `<button type="button" class="tn-b" data-id="${esc(b.id)}" style="left:${X(b.t0)}%;width:calc(${(X(b.t1) - X(b.t0)).toFixed(2)}% - 2px);background:${hexA(c, 0.28)};border-color:${c}" title="${esc(b.id)} ${fmtT(b.t0)}–${fmtT(b.t1)}"><span>${esc(b.id)}</span></button>`; }).join('');
  const t = Dome.time; if (t >= P0 && t <= n.t[i1]) track += `<i class="tn-now" style="left:${X(t)}%"></i>`;
  const ticks = []; const h0 = new Date(P0); h0.setMinutes(0, 0, 0);
  for (let ms = h0.getTime() + 3600000; ms < n.t[i1]; ms += 3600000) { if (new Date(ms).getHours() % 2) continue; ticks.push(`<span style="left:${X(ms)}%">${String(new Date(ms).getHours()).padStart(2, '0')}</span>`); }
  const wtxt = wn ? (wn.clear >= 0.85 ? tx('Previsto sereno') : wn.clear < 0.15 ? tx('Previsto coperto') : wn.win && wn.winH >= 1 ? tx('Sereno {a}–{b}, altrove nuvole', { a: fmtT(wn.win[0]), b: fmtT(wn.win[1]) }) : tx('Nuvole a tratti ({p}% sereno)', { p: Math.round(wn.clear * 100) })) : '';
  el.innerHTML = head + `<div class="tn-g"><div class="tn-track">${track}</div><div class="tn-ax">${ticks.join('')}</div></div>
    <ol class="tn-l">${P.blocks.map((b) => `<li><button type="button" data-id="${esc(b.id)}"><i style="background:${TYPE_COLOR[b.r.o.type]}"></i><span class="nm"><span class="l1"><b>${esc(b.id)}</b>${b.r.o.nick ? `<small>${esc(b.r.o.nick)}</small>` : ''}</span><span class="tm num">${fmtT(b.t0)}–${fmtT(b.t1)}</span></span><span class="hh num">${fmtH(b.hClear)}${b.frac > 0.005 ? `<b>+${Math.round(Math.min(1, b.frac) * 100)}% ${tx('del lavoro')}</b>` : ''}</span></button></li>`).join('')}</ol>
    ${wtxt ? `<div class="note">${esc(wtxt)}${WX.d ? ' · ' + tx('meteo Open-Meteo') : ''}</div>` : ''}`;
  wire();
}
