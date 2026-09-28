'use strict';
/* ============================ interfaccia: sezioni, fogli, indietro ============================
   Cinque sezioni (Stanotte, Target, Cielo, Progetti, Setup): sul telefono una barra in basso, dal tablet in su una colonna a
   sinistra. Ogni sezione scorre per conto suo e ritrova il punto dove l'avevi lasciata.
   Fogli dal basso (luogo, attrezzatura, notte, filtri) e dettaglio del target si chiudono anche col tasto indietro di
   Android o del browser: ogni apertura mette un passo nella cronologia. */
window.__errs = []; window.addEventListener('error', (e) => { if (window.__errs.length < 20) window.__errs.push(String(e.message)); }); // per le prove automatiche
const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const PHONE = window.matchMedia('(max-width: 759px)');
const MOTION = { get matches() { return motionOn(); } }; // la scelta «Animazioni» di Setup (src/js/intro.js)
/* il logo che si compone (avvio e guida): cornice che scatta in posizione, nebulosa che si accende, stella */
/* ---------- indietro ----------
   Ogni cosa aperta (foglio, dettaglio, editor, guida, una sezione diversa da Stanotte) aggiunge un passo alla cronologia
   e se lo ricorda. Il tasto indietro (Android, browser) torna di un passo e chiude ciò che quel passo aveva aperto.
   Se una cosa si chiude dall'interfaccia non si torna indietro nella cronologia (un ritorno parte sempre un attimo dopo,
   e chiuderebbe quello che nel frattempo si è aperto): il suo passo resta lì, segnato come chiuso; la prossima cosa che
   si apre ne prende il posto, e il tasto indietro lo salta. */
const Back = { entries: [] };
Object.defineProperty(Back, 'stack', { get: () => Back.entries.filter((x) => !x.closed && !x.view).map((x) => x.close) });
function backPush(close, view) {
  const e = Back.entries, top = e[e.length - 1], x = { close, view: !!view, closed: false };
  if (top && top.closed) { e[e.length - 1] = x; try { history.replaceState({ sf: e.length }, ''); } catch { /* niente */ } return; }
  e.push(x); try { history.pushState({ sf: e.length }, ''); } catch { /* niente */ }
}
/* chiuso dall'interfaccia: il suo passo si segna come chiuso */
function backDone(close) {
  const e = Back.entries; let i = e.length - 1; while (i >= 0 && (e[i].close !== close || e[i].closed)) i--;
  if (i >= 0) e[i].closed = true;
}
/* Android (plugin App): il tasto indietro passa di qui; true se c'era qualcosa da chiudere o da cui tornare */
window.onAndroidBack = () => {
  const e = Back.entries; let k = 0; while (k < e.length && e[e.length - 1 - k].closed) k++;
  if (e.length - k > 0) { history.go(-(k + 1)); return true; }
  if (k) history.go(-k);
  return false;
};
window.addEventListener('popstate', (ev) => {
  const d = (ev.state && ev.state.sf) || 0; let shut = false;
  while (Back.entries.length > d) { const x = Back.entries.pop(); if (!x.closed) { x.closed = true; x.close(true); shut = true; } }
  // si è tornati solo su passi già chiusi (browser): non è cambiato niente, si torna ancora di uno
  if (!shut && Back.entries.length) try { history.back(); } catch { /* niente */ }
});
const viewEntry = () => Back.entries.find((x) => x.view && !x.closed);

/* ---------- sezioni ---------- */
const VIEWS = ['tonight', 'targets', 'sky', 'projects', 'setup'];
const UI = { view: 'tonight', noVT: false }; // noVT: sezioni senza transizione (la guida le cambia sotto il velo)
function setView(v, fromPop) {
  if (!VIEWS.includes(v)) v = 'tonight';
  const el = $('#v-' + v);
  if (v === UI.view) { if (el && !fromPop) el.scrollTo({ top: 0, behavior: 'smooth' }); return; } // di nuovo la stessa: in cima
  const from = VIEWS.indexOf(UI.view), to = VIEWS.indexOf(v), vt = !!(document.startViewTransition && MOTION.matches && !UI.noVT);
  const apply = () => {
    UI.view = v; $('#app').dataset.view = v;
    $$('#nav [data-view]').forEach((b) => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    navInd(true);
    $$('.views > .view').forEach((s) => { const on = s.dataset.view === v; s.hidden = !on; if (on && !vt) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); } });
    if (v === 'tonight') { Dome.refresh(); drawStrip(); }
    if (v === 'projects') renderProjects();
    if (v === 'sky') renderSky();
    if (v === 'setup') renderSetup();
  };
  // passaggio fra sezioni: la nuova entra dal lato verso cui si va nella barra (View Transitions, dove c'è)
  if (vt) { document.documentElement.dataset.dir = to < from ? 'back' : 'fwd'; document.startViewTransition(apply); } else apply();
  // indietro da una sezione qualsiasi riporta a Stanotte (e da Stanotte esce)
  if (!fromPop) {
    const ve = viewEntry();
    if (v !== 'tonight' && !ve) backPush(backToTonight, true);
    else if (v === 'tonight' && ve) backDone(backToTonight);
  }
  if (v === 'targets') requestAnimationFrame(() => { const s = state.sel && $(`#list .row[data-id="${CSS.escape(state.sel)}"]`); if (s) s.scrollIntoView({ block: 'nearest' }); });
}
/* indicatore della sezione attiva: sul telefono la pillola sotto l'icona, sul computer lo sfondo del pulsante. Scivola
   con la molla; l'icona appena scelta fa un piccolo scatto. */
function navInd(anim) {
  const ind = $('#navInd'), nav = $('#nav'), b = nav && nav.querySelector('[aria-current="page"]'); if (!ind || !b) return;
  const n = nav.getBoundingClientRect(), r = b.getBoundingClientRect(), ph = PHONE.matches;
  const w = ph ? 54 : r.width, h = ph ? 30 : r.height, x = r.left - n.left + (r.width - w) / 2, y = r.top - n.top + (ph ? 5 : 0);
  const from = ind._at;
  ind.style.width = w + 'px'; ind.style.height = h + 'px'; ind.style.transform = `translate(${x}px, ${y}px)`; ind._at = [x, y];
  if (!anim || !from || (from[0] === x && from[1] === y)) return;
  ind.getAnimations().forEach((a) => a.cancel());
  const mx = (from[0] + x) / 2, my = (from[1] + y) / 2, stretch = ph ? 1 + Math.min(0.6, Math.abs(x - from[0]) / 300) : 1;
  Motion.animate(ind, [{ transform: `translate(${from[0]}px, ${from[1]}px)` }, { transform: `translate(${mx}px, ${my}px) scaleX(${stretch})`, offset: 0.35 }, { transform: `translate(${x}px, ${y}px)` }], 'snap');
  const ic = b.querySelector('.ic'); if (ic) Motion.animate(ic, [{ transform: 'scale(.78)' }, { transform: 'none' }], 'pop');
}
// al primo disegno e quando cambia la misura della barra (font caricati, rotazione, passaggio telefono/computer)
if (window.ResizeObserver && $('#nav')) new ResizeObserver(() => navInd(false)).observe($('#nav'));
function backToTonight(fromPop) { if (fromPop === true) setView('tonight', true); }
/* numeri che salgono fino al valore (ore, conteggi): data-to e il formato dato */
function countUp(root) {
  if (!MOTION.matches) return;
  $$('[data-to]', root).forEach((el) => {
    const to = +el.dataset.to, fmt = el.dataset.fmt === 'h' ? (x) => '≈ ' + fmtH(x) : el.dataset.fmt === 'hh' ? fmtH : (x) => String(Math.round(x));
    if (!(to > 0)) return; const t0 = performance.now(), D = 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(k < 1 ? to * e : to); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- foglio dal basso (al centro sul computer) ---------- */
function openSheet({ title, body, foot, onMount, onClose, cls }) {
  const w = document.createElement('div'); w.className = 'bs-wrap' + (cls ? ' ' + cls : '');
  w.innerHTML = `<div class="bs-back"></div><div class="bsheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="bs-handle"></div>
    <div class="bs-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="${tx('Chiudi')}">${ic('x')}</button></div>
    <div class="bs-body">${body}</div>${foot ? `<div class="bs-foot">${foot}</div>` : ''}</div>`;
  document.body.appendChild(w); translateDom(w);
  requestAnimationFrame(() => w.classList.add('on'));
  let open = true;
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = (fromPop) => {
    if (!open) return; open = false; if (fromPop !== true) backDone(close); // 'drag': già portato fuori col dito
    document.removeEventListener('keydown', key, true); w.classList.remove('on'); if (fromPop === 'drag') { w.classList.add('gone'); w.remove(); } else setTimeout(() => w.remove(), 280);
    if (onClose) onClose();
  };
  document.addEventListener('keydown', key, true);
  w.querySelector('.bs-back').onclick = () => close();
  w.querySelector('[data-close]').onclick = () => close();
  dragToClose(w.querySelector('.bsheet'), w.querySelector('.bs-head'), close, () => 0);
  backPush(close);
  if (onMount) onMount(w.querySelector('.bsheet'), close);
  const f = w.querySelector('.bs-body button, .bs-body select'); if (f && !PHONE.matches) f.focus({ preventScroll: true });
  return close;
}
/* Trascinare giù per chiudere (telefono): il pannello segue il dito; al rilascio conta anche la velocità. Un lancio
   veloce chiude anche se corto, e il pannello esce alla velocità del dito; altrimenti torna su con una molla che parte
   dalla stessa velocità. */
function flingDown(panel, handle, { canStart, onClose, limit = 100 }) {
  let y0 = null, dy = 0, S = [];
  handle.addEventListener('pointerdown', (e) => { if (!PHONE.matches || e.target.closest('button, a, input, select') || !canStart(e)) return; y0 = e.clientY; dy = 0; S = [[e.timeStamp, 0]]; panel.getAnimations().forEach((a) => a.cancel()); });
  handle.addEventListener('pointermove', (e) => {
    if (y0 == null) return; dy = Math.max(0, e.clientY - y0); S.push([e.timeStamp, dy]); if (S.length > 6) S.shift();
    if (dy > 4) { panel.classList.add('drag'); panel.style.transform = `translateY(${dy}px)`; try { handle.setPointerCapture(e.pointerId); } catch { /* niente */ } }
  });
  const end = () => {
    if (y0 == null) return; y0 = null;
    const a = S[0], b = S[S.length - 1], v = b && a && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; // px/ms
    if (dy < 4) { panel.classList.remove('drag'); panel.style.transform = ''; return; }
    if (dy > limit || v > 0.55) {
      const H = innerHeight, rest = Math.max(40, H - dy);
      const an = Motion.animate(panel, [{ transform: `translateY(${dy}px)` }, { transform: `translateY(${H}px)` }], 'snap', { v0: Math.max(0, v * 1000) / rest, fill: 'forwards' });
      panel.style.transform = '';
      const fin = () => { onClose(); panel.classList.remove('drag'); if (an) requestAnimationFrame(() => an.cancel()); };
      if (an && Motion.on()) an.finished.then(fin).catch(() => {}); else fin();
    } else {
      panel.style.transform = '';
      const an = Motion.animate(panel, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], 'soft', { v0: Math.max(0, -v * 1000) / Math.max(dy, 1) });
      // le transizioni CSS restano spente finché la molla non ha finito (non devono rincorrerla)
      if (an && Motion.on()) an.finished.then(() => panel.classList.remove('drag')).catch(() => panel.classList.remove('drag')); else panel.classList.remove('drag');
    }
  };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}
function dragToClose(panel, handle, close, scrollTop) { flingDown(panel, handle, { canStart: () => scrollTop() <= 2, onClose: () => close('drag'), limit: 90 }); }

/* ---------- barra in alto: luogo, notte, attrezzatura ---------- */
function renderTopbar() {
  const l = activeLoc(), p = activeProfile();
  $('#locName').textContent = exName(l.site.name, l.unsaved);
  $('#profName').textContent = exName(p.name, p.unsaved);
  const ds = $('#nightDate').value || defaultNightStr(), d = new Date(ds + 'T12:00:00');
  $('#nightName').textContent = ds === defaultNightStr() ? tx('Stanotte') : d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  $('#nightChip').classList.toggle('other', ds !== defaultNightStr());
}
const exName = (n, ex) => (ex && !/\(esempio\)|\(example\)/i.test(n) ? `${n} (${tx('esempio')})` : n);
const locLine = (l) => `SQM ${it(+l.site.sqm, 2)} · Bortle ${sqmToBortle(+l.site.sqm)}${l.id !== state.locId ? ' · ' + Math.round(kmBetween(activeLoc().site, l.site)) + ' km' : ''}`;
const profLine = (p) => [p.camera && p.camera.name, (p.optics || []).map((o) => txName(o.name)).join(', ')].filter(Boolean).join(' · ');
function openLocSheet() {
  const items = state.locs.map((l) => `<div class="st-item"><button type="button" class="st-main" data-loc="${esc(l.id)}"><span class="radio${l.id === state.locId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(l.site.name, l.unsaved))}</b><small>${locLine(l)}</small></span></button><button type="button" class="icon-btn" data-edit="${esc(l.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  openSheet({
    title: tx('Luogo'), body: `<div class="st-list">${items}</div>`,
    foot: `<button type="button" class="btn" data-new>${ic('plus')}<span>${tx('Nuovo luogo')}</span></button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-loc],[data-edit],[data-new]'); if (!b) return;
      close();
      if (b.dataset.loc) setLoc(b.dataset.loc); else if (b.dataset.edit) openLocEditor(b.dataset.edit); else openLocEditor(null, true);
    }),
  });
}
function openProfSheet() {
  const items = state.profiles.map((p) => `<div class="st-item"><button type="button" class="st-main" data-prof="${esc(p.id)}"><span class="radio${p.id === state.activeId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(p.name, p.unsaved))}</b><small>${esc(profLine(p))}</small></span></button><button type="button" class="icon-btn" data-edit="${esc(p.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  openSheet({
    title: tx('Attrezzatura'), body: `<div class="st-list">${items}</div>`,
    foot: `<button type="button" class="btn" data-new>${ic('plus')}<span>${tx('Nuovo profilo')}</span></button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prof],[data-edit],[data-new]'); if (!b) return;
      close();
      if (b.dataset.prof) setProfile(b.dataset.prof); else if (b.dataset.edit) openEditor(b.dataset.edit); else openEditor(state.activeId, true);
    }),
  });
}
function setProfile(id) {
  if (id === state.activeId || !state.profiles.some((p) => p.id === id)) return;
  state.activeId = id; saveStore(); closeDetail(); state.sel = null; refresh(); toast(tx('Attrezzatura: {n}', { n: activeProfile().name }));
}
/* notte: calendario del mese con la fase della Luna di ogni sera */
function openNightSheet() {
  const sel = $('#nightDate').value || defaultNightStr(), today = defaultNightStr();
  let m0 = new Date(sel + 'T12:00:00'); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1, 12);
  const days = () => {
    const y = m0.getFullYear(), m = m0.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    const head = [...Array(7)].map((_, i) => `<span class="h">${new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '')}</span>`).join('');
    let cells = '<span></span>'.repeat(first);
    for (let d = 1; d <= n; d++) {
      const t = new Date(y, m, d, 23, 0).getTime(), mi = moonIllum(jd(t)), ds = dateStr(new Date(y, m, d));
      cells += `<button type="button" data-ds="${ds}" aria-pressed="${ds === sel}" class="${ds === today ? 'today' : ''}" title="${tx('Luna {p}%', { p: Math.round(mi.k * 100) })}">${d}<span class="mo">${moonSvg(mi.k, mi.waxing, 5)}</span></button>`;
    }
    return `<div class="cal-nav"><button type="button" class="icon-btn" data-m="-1" aria-label="${tx('Mese prima')}">${ic('chev-l')}</button><b>${m0.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })}</b><button type="button" class="icon-btn" data-m="1" aria-label="${tx('Mese dopo')}">${ic('chev-r')}</button></div><div class="cal-pick">${head}${cells}</div>`;
  };
  openSheet({
    title: tx('Scegli la notte'), body: `<div id="calBox">${days()}</div>`,
    foot: `<button type="button" class="btn primary" data-today>${ic('night')}<span>${tx('Stanotte')}</span></button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      const mb = e.target.closest('[data-m]'); if (mb) { m0 = new Date(m0.getFullYear(), m0.getMonth() + +mb.dataset.m, 1, 12); el.querySelector('#calBox').innerHTML = days(); return; }
      const b = e.target.closest('[data-ds]'); if (b) { close(); goNight(new Date(b.dataset.ds + 'T12:00:00').getTime()); return; }
      if (e.target.closest('[data-today]')) { close(); setLive(); }
    }),
  });
}

/* ---------- Stanotte: i migliori della lista ---------- */
function renderTopList() {
  const el = $('#topList'); if (!el || !state.res) return;
  const L = state.filtered.filter((r) => r.usableH >= 0.25).slice(0, 6), n = state.res.night;
  if (!L.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card-h"><h3>${tx('Migliori stanotte')}</h3></div>` +
    L.map((r) => {
      const b = r.e.best, h = b ? hoursOf(b) : Infinity;
      return `<button type="button" class="tl-row" data-id="${esc(r.o.id)}"><span class="score" style="--c:${scoreColor(r.score)};--v:${r.score}"><b>${r.score}</b></span>
        <span class="n"><span class="l1"><b>${esc(r.o.id)}</b>${r.o.nick ? `<span class="nick">${esc(r.o.nick)}</span>` : ''}</span><small>${tx(TYPES_PL[r.o.type])} · ${r.first >= 0 ? `${fmtT(n.t[r.first])}–${fmtT(n.t[r.last] + DT)}` : ''} · max ${Math.round(r.maxA)}°</small></span>
        <span class="h">${isFinite(h) ? '≈ ' + fmtH(h) : '—'}<small>${b ? esc(r.e.moonBest ? b.short : b.label) : ''}${r.e.moonBest ? ` · ${ic('moon', 'sm')} ${esc(r.e.moonBest.short)}` : ''}</small></span></button>`;
    }).join('') + `<button type="button" class="btn tl-more" data-all>${tx('Tutti i {n} di stanotte', { n: state.filtered.length })}${ic('arrow-r', 'sm')}</button>`;
  el.onclick = (e) => { if (e.target.closest('[data-all]')) { setView('targets'); return; } const r = e.target.closest('[data-id]'); if (r) openDetail(r.dataset.id, r); };
}

/* ---------- Setup ---------- */
/* Qualità: sei livelli a parole sul profilo attivo; mentre si sposta lo slider, le ore di alcuni target (i progetti,
   altrimenti i primi di stanotte) si ricalcolano in proporzione, perché le ore sono proporzionali al livello. */
function qkTargets() {
  const ok = (r) => r && r.e.best && isFinite(hoursOf(r.e.best));
  const mine = Object.keys(state.projects || {}).filter((id) => !isDone(id)).map((id) => state.byId.get(id)).filter(ok);
  return (mine.length ? mine : state.filtered.filter(ok)).slice(0, 6);
}
const qCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const qkPreview = (k, k0) => qkTargets().map((r) => `<div class="qk-row"><span>${esc(r.o.id)}${r.o.nick ? ` <small>${esc(r.o.nick)}</small>` : ''}</span><b class="num">${fmtH(hoursOf(r.e.best) * k / k0)}</b></div>`).join('');
function qualityHTML() {
  const p = activeProfile(); if (!p || !state.res) return '';
  const q = QUALITY[p.session.quality] ? p.session.quality : 'good', i = QLEVELS.indexOf(q);
  return `<div class="st-sec" id="stQuality"><h3>${tx('Qualità')}</h3><div class="st-list"><div class="st-item qk">
    <div class="qk-top"><b id="qkV">${qCap(tx(QLABEL[q]))}</b></div><small class="qk-d" id="qkD">${tx(QDESC[q])}</small>
    <input type="range" id="qkR" min="0" max="${QLEVELS.length - 1}" step="1" value="${i}" aria-label="${tx('Qualità')}">
    <div class="qk-ticks">${QLEVELS.map((_, j) => `<i style="left:${(j / (QLEVELS.length - 1)) * 100}%"></i>`).join('')}</div>
    <div class="qk-prev" id="qkP">${qkPreview(1, 1)}</div></div></div></div>`;
}
function wireQuality() {
  const r = $('#qkR'); if (!r) return;
  const k0 = qualityK(activeProfile().session);
  r.oninput = () => { const q = QLEVELS[+r.value]; $('#qkV').textContent = qCap(tx(QLABEL[q])); $('#qkD').textContent = tx(QDESC[q]); $('#qkP').innerHTML = qkPreview(QUALITY[q].k, k0); };
  r.onchange = () => {
    const q = QLEVELS[+r.value], p = activeProfile(); if (q === p.session.quality) return;
    p.session = { ...p.session, quality: q }; delete p.session.qk; p.updated = Date.now();
    effMemo = null; saveStore(); refresh(true);
  };
}
/* precisione di guida consigliata per ogni configurazione del profilo attivo (model.js, guideAdvice) */
const SAMP_TXT = { under: 'sottocampionato', ok: 'campionamento adeguato', over: 'sovracampionato' };
function guideHTML() {
  if (!state.cfgs || !state.cfgs.length) return '';
  const w = state.res && typeof wxNight === 'function' ? wxNight(state.res.night) : null, see = w && w.see > 0 ? w.see : null;
  const rows = state.cfgs.map((c) => { const a = guideAdvice(c, see);
    return `<div class="st-item gd"><span class="tx"><b>${esc(c.label)} · ${c.short}</b>
      <small>${tx('{p}″/pixel · stelle {f}″ FWHM · {n} pixel per stella ({c})', { p: it(a.p, 2), f: it(a.F, 1), n: it(a.samp, 1), c: tx(SAMP_TXT[a.cls]) })}</small>
      <small class="gd-v">${tx('Errore RMS ≤ {t}″ totale, {a}″ per asse', { t: it(a.total, 2), a: it(a.axis, 2) })}</small></span></div>`; }).join('');
  return `<div class="st-sec" id="stGuiding"><h3>${tx('Autoguida')}</h3><div class="st-list">${rows}</div>
    <p class="st-foot">${tx(see ? 'Seeing previsto {s}″' : 'Seeing {s}″ (nessuna previsione)', { s: it(see || GUIDE.see0, 1) })}</p></div>`;
}
function renderSetup() {
  const el = $('#setupView'); if (!el) return;
  const prof = state.profiles.map((p) => `<div class="st-item"><button type="button" class="st-main" data-prof="${esc(p.id)}"><span class="radio${p.id === state.activeId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(p.name, p.unsaved))}</b><small>${esc(profLine(p))}</small></span></button><button type="button" class="icon-btn" data-editp="${esc(p.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  const locs = state.locs.map((l) => `<div class="st-item"><button type="button" class="st-main" data-loc="${esc(l.id)}"><span class="radio${l.id === state.locId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(l.site.name, l.unsaved))}</b><small>${locLine(l)}</small></span></button><button type="button" class="icon-btn" data-editl="${esc(l.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  const red = !$('#veil').hidden, on = notifyOn(), nc = ncfg(), v = window.SKYFRAME_VERSION || '';
  el.innerHTML = `<div class="view-h"><h2>${tx('Setup')}</h2></div>
    <div class="st-sec" id="stEquipment"><h3>${tx('Attrezzatura')}</h3><div class="st-list">${prof}<button type="button" class="st-item" data-newp>${ic('plus')}<span class="tx"><b>${tx('Nuovo profilo')}</b><small>${tx('camera, telescopio e filtri')}</small></span></button></div></div>
    ${qualityHTML()}
    ${guideHTML()}
    <div class="st-sec" id="stLocations"><h3>${tx('Luoghi')}</h3><div class="st-list">${locs}<button type="button" class="st-item" data-newl>${ic('plus')}<span class="tx"><b>${tx('Nuovo luogo')}</b><small>${tx('coordinate, SQM e orizzonte')}</small></span></button></div></div>
    <div class="st-sec"><h3>${tx('Preferenze')}</h3><div class="st-list">
      <div class="st-item wrap">${ic('moon')}<span class="tx"><b>${tx('Con la Luna')}</b><small>${tx(MODE_TXT[moonMode()][1])}</small></span><div class="seg" id="moonSeg">${MOON_MODES.map((m) => `<button type="button" data-mode="${m}" aria-pressed="${m === moonMode()}">${tx(MODE_TXT[m][0])}</button>`).join('')}</div></div>
      <div class="st-item wrap">${ic('motion')}<span class="tx"><b>${tx('Animazioni')}</b></span><div class="seg" id="motionSeg">${[['auto', 'Come il sistema'], ['on', 'Sempre'], ['off', 'Ridotte']].map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${motionPref() === k}">${tx(t)}</button>`).join('')}</div></div>
      <label class="st-item tap">${ic('eye')}<span class="tx"><b>${tx('Luce rossa')}</b><small>${tx('schermo rosso')}</small></span><span class="switch"><input type="checkbox" id="swRed" ${red ? 'checked' : ''}><i></i></span></label>
      <div class="st-item">${ic('globe')}<span class="tx"><b>${tx('Lingua')}</b></span><select class="sel" id="langSel" aria-label="${tx('Lingua')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div></div>
    <div class="st-sec" id="stAlerts"><h3>${tx('Avvisi')}</h3><div class="st-list">
      <label class="st-item tap">${ic(on ? 'bell-on' : 'bell')}<span class="tx"><b>${tx('Avvisi')}</b><small>${tx(on ? 'accesi, anche ad app chiusa' : 'spenti')}</small></span><span class="switch"><input type="checkbox" id="swNotify" ${on ? 'checked' : ''}><i></i></span></label>
      ${on ? [['evening', 'Stanotte sereno', 'prima del buio'], ['top', 'Notte ottima prevista', 'il giorno prima, notte senza Luna e serena'], ['change', 'Il meteo è cambiato', 'se la previsione di stanotte cambia'], ['season', 'Ultime settimane di visibilità', 'un preferito sta per uscire di stagione']].map(([k, t, d]) => `<label class="st-item tap sub"><span class="tx"><b>${tx(t)}</b><small>${tx(d)}</small></span><span class="switch"><input type="checkbox" data-nk="${k}" ${nc[k] ? 'checked' : ''}><i></i></span></label>`).join('') +
        `<div class="st-item wrap sub"><span class="tx"><b>${tx('Quanto prima del buio')}</b></span><div class="seg" id="nLead">${[30, 60, 90, 120].map((m) => `<button type="button" data-v="${m}" aria-pressed="${nc.lead === m}">${fmtDur(m / 60)}</button>`).join('')}</div></div>
        <div class="st-item wrap sub"><span class="tx"><b>${tx('Da quale notte')}</b><small>${tx('voto minimo')}</small></span><div class="seg" id="nMin">${[[2, 'Discreta'], [3, 'Buona'], [4, 'Ottima']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${nc.min === v}">${tx(t)}</button>`).join('')}</div></div>
        <button type="button" class="st-item sub" id="stExact" data-exact hidden><span class="tx"><b>${tx('Orario preciso')}</b><small>${tx('consenti «sveglie e promemoria»')}</small></span>${ic('chev-r')}</button>
        <button type="button" class="st-item sub" data-test><span class="tx"><b>${tx('Prova un avviso')}</b><small>${tx('arriva fra 5 secondi')}</small></span></button>` : ''}
    </div></div>
    <div class="st-sec"><h3>${tx('Dati')}</h3><div class="st-list">
      <button type="button" class="st-item" data-export>${ic('upload')}<span class="tx"><b>${tx('Esporta')}</b><small>${tx(DESK ? 'profili, luoghi e progetti in un file' : 'profili, luoghi e progetti negli appunti')}</small></span></button>
      <button type="button" class="st-item" data-import>${ic('download')}<span class="tx"><b>${tx('Importa')}</b><small>${tx('da un file esportato da Skyframe')}</small></span></button>
    </div><p class="st-foot">${tx(DESK ? 'Tutto resta su questo computer.' : 'Tutto resta su questo dispositivo.')}</p></div>
    <div class="st-sec" id="stGuide"><h3>${tx('Guida')}</h3><div class="st-list">
      <button type="button" class="st-item" data-tour>${ic('info')}<span class="tx"><b>${tx('Rivedi la guida')}</b><small>${tx('configurazione e uso dell’app')}</small></span>${ic('chev-r')}</button>
      <button type="button" class="st-item" data-news>${ic('star')}<span class="tx"><b>${tx('Novità')}</b><small>${tx('le ultime versioni')}</small></span>${ic('chev-r')}</button>
    </div></div>
    <div class="st-sec"><h3>${tx('Informazioni')}</h3><p class="st-foot">Skyframe ${esc(v)} · <a href="https://github.com/astropuzzo/skyframe" target="_blank" rel="noopener">GitHub</a><br>${tx('Meteo')}: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · ${tx('Immagini')}: NSNS (S. Ziegenbalg), DSS2, Pan-STARRS (CDS), Wikimedia Commons · ${tx('Inquinamento luminoso')}: D. Lorenz, lightpollutionmap.info</p></div>`;
  wireQuality();
  el.onclick = (e) => {
    const b = e.target.closest('[data-prof],[data-loc],[data-editp],[data-editl],[data-newp],[data-newl],[data-export],[data-import]'); if (!b) return;
    const d = b.dataset;
    if (d.prof) setProfile(d.prof); else if (d.loc) setLoc(d.loc); else if (d.editp) openEditor(d.editp); else if (d.editl) openLocEditor(d.editl);
    else if ('newp' in d) openEditor(state.activeId, true); else if ('newl' in d) openLocEditor(null, true);
    else if ('export' in d) exportProfiles(); else if ('import' in d) importProfiles();
  };
  el.querySelector('[data-test]') && (el.querySelector('[data-test]').onclick = testNotify);
  el.querySelector('[data-tour]').onclick = () => tourStart(TOUR_STEPS);
  const ex = $('#stExact');
  if (ex && window.cielo && window.cielo.exactStatus) window.cielo.exactStatus().then((st) => { if (st && st !== 'granted') { ex.hidden = false; ex.onclick = async () => { await window.cielo.exactOpen(); setTimeout(renderSetup, 800); }; } });
  el.querySelector('[data-news]').onclick = () => openNews(null, null);
  $$('#setupView [data-nk]').forEach((x) => (x.onchange = () => setNcfg(x.dataset.nk, x.checked)));
  const segv = (id, k) => { const g = $(id); if (g) g.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; setNcfg(k, +b.dataset.v); renderSetup(); }; };
  segv('#nLead', 'lead'); segv('#nMin', 'min');
  $('#moonSeg').onclick = (e) => { const m = e.target.closest('[data-mode]'); if (m) setMoonMode(m.dataset.mode); };
  $('#motionSeg').onclick = (e) => { const m = e.target.closest('[data-v]'); if (m) { setMotionPref(m.dataset.v); renderSetup(); } };
  $('#swNotify').onchange = () => toggleNotify();
  $('#swRed').onchange = (e) => setRed(e.target.checked);
  $('#langSel').onchange = (e) => setLang(e.target.value);
}
function setRed(v) { $('#veil').hidden = !v; $('#nightBtn').setAttribute('aria-pressed', String(!!v)); LS.set('sf.red', !!v); const s = $('#swRed'); if (s) s.checked = !!v; }

/* ---------- dettaglio: sul telefono si chiude trascinando giù ---------- */
function wireDrawerDrag() {
  const d = $('#drawer');
  flingDown(d, d, { canStart: (e) => d.scrollTop <= 2 && !!e.target.closest('.d-top'), onClose: () => closeDetail(false, 'drag'), limit: 110 });
}
