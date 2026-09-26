'use strict';
/* ============================ interfaccia: sezioni, fogli, indietro ============================
   Cinque sezioni (Stanotte, Target, Cielo, Progetti, Setup): sul telefono una barra in basso, dal tablet in su una colonna a
   sinistra. Ogni sezione scorre per conto suo e ritrova il punto dove l'avevi lasciata.
   Fogli dal basso (luogo, attrezzatura, notte, filtri) e dettaglio del target si chiudono anche col tasto indietro di
   Android o del browser: ogni apertura mette un passo nella cronologia. */
const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const PHONE = window.matchMedia('(max-width: 759px)');

/* ---------- indietro ---------- */
const Back = { stack: [], skip: 0, view: false };
function backPush(close) { Back.stack.push(close); try { history.pushState({ sf: Back.stack.length }, ''); } catch { /* niente */ } }
/* chiuso dall'interfaccia: si toglie il suo passo dalla cronologia senza richiamarlo */
function backDone(close) {
  const i = Back.stack.lastIndexOf(close); if (i < 0) return;
  Back.stack.splice(i, 1); Back.skip++; try { history.back(); } catch { Back.skip--; }
}
window.addEventListener('popstate', () => {
  if (Back.skip) { Back.skip--; return; }
  const c = Back.stack.pop(); if (c) { c(true); return; }
  if (Back.view) { Back.view = false; setView('tonight', true); }
});

/* ---------- sezioni ---------- */
const VIEWS = ['tonight', 'targets', 'sky', 'projects', 'setup'];
const UI = { view: 'tonight' };
function setView(v, fromPop) {
  if (!VIEWS.includes(v)) v = 'tonight';
  const el = $('#v-' + v);
  if (v === UI.view) { if (el && !fromPop) el.scrollTo({ top: 0, behavior: 'smooth' }); return; } // di nuovo la stessa: in cima
  UI.view = v; $('#app').dataset.view = v;
  $$('#nav [data-view]').forEach((b) => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $$('.views > .view').forEach((s) => { const on = s.dataset.view === v; s.hidden = !on; if (on) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); } });
  // indietro da una sezione qualsiasi riporta a Stanotte (e da Stanotte esce)
  if (!fromPop) {
    if (v !== 'tonight' && !Back.view) { Back.view = true; try { history.pushState({ sfv: 1 }, ''); } catch { /* niente */ } }
    else if (v === 'tonight' && Back.view && !Back.stack.length) { Back.view = false; Back.skip++; try { history.back(); } catch { Back.skip--; } }
  }
  if (v === 'tonight') { Dome.refresh(); requestAnimationFrame(drawStrip); }
  if (v === 'projects') renderProjects();
  if (v === 'sky') renderSky();
  if (v === 'setup') renderSetup();
  if (v === 'targets') requestAnimationFrame(() => { const s = state.sel && $(`#list .row[data-id="${CSS.escape(state.sel)}"]`); if (s) s.scrollIntoView({ block: 'nearest' }); });
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
    if (!open) return; open = false; if (fromPop !== true) backDone(close);
    document.removeEventListener('keydown', key, true); w.classList.remove('on'); setTimeout(() => w.remove(), 280);
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
/* sul telefono si chiude trascinando verso il basso dalla testata (se il contenuto è già in cima) */
function dragToClose(panel, handle, close, scrollTop) {
  let y0 = null, dy = 0;
  handle.addEventListener('pointerdown', (e) => { if (!PHONE.matches || e.target.closest('button, a, input, select') || scrollTop() > 2) return; y0 = e.clientY; dy = 0; panel.style.transition = 'none'; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 == null) return; y0 = null; panel.style.transition = ''; if (dy > 90) close(); else panel.style.transform = ''; };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}

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
  el.innerHTML = `<div class="card-h"><h3>${tx('I migliori stanotte')}</h3><small>${tx('per punteggio, con i tuoi filtri')}</small></div>` +
    L.map((r) => {
      const b = r.e.best, h = b ? hoursOf(b) : Infinity;
      return `<button type="button" class="tl-row" data-id="${esc(r.o.id)}"><span class="score" style="--c:${scoreColor(r.score)};--v:${r.score}"><b>${r.score}</b></span>
        <span class="n"><span class="l1"><b>${esc(r.o.id)}</b>${r.o.nick ? `<span class="nick">${esc(r.o.nick)}</span>` : ''}</span><small>${tx(TYPES_PL[r.o.type])} · ${r.first >= 0 ? `${fmtT(n.t[r.first])}–${fmtT(n.t[r.last] + DT)}` : ''} · max ${Math.round(r.maxA)}°</small></span>
        <span class="h">${isFinite(h) ? '≈ ' + fmtH(h) : '—'}<small>${b ? esc(b.label) : ''}</small></span></button>`;
    }).join('') + `<button type="button" class="btn tl-more" data-all>${tx('Tutti i {n} target di stanotte', { n: state.filtered.length })}${ic('arrow-r', 'sm')}</button>`;
  el.onclick = (e) => { if (e.target.closest('[data-all]')) { setView('targets'); return; } const r = e.target.closest('[data-id]'); if (r) openDetail(r.dataset.id); };
}

/* ---------- Setup ---------- */
function renderSetup() {
  const el = $('#setupView'); if (!el) return;
  const prof = state.profiles.map((p) => `<div class="st-item"><button type="button" class="st-main" data-prof="${esc(p.id)}"><span class="radio${p.id === state.activeId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(p.name, p.unsaved))}</b><small>${esc(profLine(p))}</small></span></button><button type="button" class="icon-btn" data-editp="${esc(p.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  const locs = state.locs.map((l) => `<div class="st-item"><button type="button" class="st-main" data-loc="${esc(l.id)}"><span class="radio${l.id === state.locId ? ' on' : ''}"></span><span class="tx"><b>${esc(exName(l.site.name, l.unsaved))}</b><small>${locLine(l)}</small></span></button><button type="button" class="icon-btn" data-editl="${esc(l.id)}" aria-label="${tx('Modifica')}" title="${tx('Modifica')}">${ic('edit')}</button></div>`).join('');
  const red = !$('#veil').hidden, on = notifyOn(), v = window.SKYFRAME_VERSION || '';
  el.innerHTML = `<div class="view-h"><h2>${tx('Setup')}</h2><small>${tx('attrezzatura, luoghi e preferenze')}</small></div>
    <div class="st-sec"><h3>${tx('Attrezzatura')}</h3><div class="st-list">${prof}<button type="button" class="st-item" data-newp>${ic('plus')}<span class="tx"><b>${tx('Nuovo profilo')}</b><small>${tx('un altro telescopio, un’altra camera o altri filtri')}</small></span></button></div></div>
    <div class="st-sec"><h3>${tx('Luoghi')}</h3><div class="st-list">${locs}<button type="button" class="st-item" data-newl>${ic('plus')}<span class="tx"><b>${tx('Nuovo luogo')}</b><small>${tx('cielo, mappa all-sky e orizzonte arrivano da soli')}</small></span></button></div></div>
    <div class="st-sec"><h3>${tx('Preferenze')}</h3><div class="st-list">
      <div class="st-item wrap">${ic('moon')}<span class="tx"><b>${tx('Con la Luna')}</b><small>${tx(MODE_TXT[moonMode()][1])}</small></span><div class="seg" id="moonSeg">${MOON_MODES.map((m) => `<button type="button" data-mode="${m}" aria-pressed="${m === moonMode()}">${tx(MODE_TXT[m][0])}</button>`).join('')}</div></div>
      <label class="st-item tap">${ic('bell')}<span class="tx"><b>${tx('Avvisi')}</b><small>${tx('un’ora prima del buio, quando il meteo dà sereno per i tuoi target')}</small></span><span class="switch"><input type="checkbox" id="swNotify" ${on ? 'checked' : ''}><i></i></span></label>
      <label class="st-item tap">${ic('eye')}<span class="tx"><b>${tx('Luce rossa')}</b><small>${tx('tinge tutto di rosso per non perdere l’adattamento al buio')}</small></span><span class="switch"><input type="checkbox" id="swRed" ${red ? 'checked' : ''}><i></i></span></label>
      <div class="st-item">${ic('globe')}<span class="tx"><b>${tx('Lingua')}</b></span><select class="sel" id="langSel" aria-label="${tx('Lingua')}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div></div>
    <div class="st-sec"><h3>${tx('Dati')}</h3><div class="st-list">
      <button type="button" class="st-item" data-export>${ic('upload')}<span class="tx"><b>${tx('Esporta')}</b><small>${tx(DESK ? 'profili, luoghi e progetti in un file' : 'profili, luoghi e progetti: si copiano negli appunti')}</small></span></button>
      <button type="button" class="st-item" data-import>${ic('download')}<span class="tx"><b>${tx('Importa')}</b><small>${tx('da un file esportato da Skyframe (anche dal computer al telefono)')}</small></span></button>
    </div><p class="st-foot">${tx(DESK ? 'Profili e progetti sono salvati su file in questo computer.' : 'Profili e progetti sono salvati in questo dispositivo.')}</p></div>
    <div class="st-sec"><h3>${tx('Informazioni')}</h3><p class="st-foot">Skyframe ${esc(v)} · <a href="https://github.com/astropuzzo/skyframe" target="_blank" rel="noopener">GitHub</a><br>${tx('Meteo')}: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · ${tx('Immagini')}: NSNS (S. Ziegenbalg), DSS2, Pan-STARRS (CDS), Wikimedia Commons · ${tx('Inquinamento luminoso')}: D. Lorenz, lightpollutionmap.info</p></div>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-prof],[data-loc],[data-editp],[data-editl],[data-newp],[data-newl],[data-export],[data-import]'); if (!b) return;
    const d = b.dataset;
    if (d.prof) setProfile(d.prof); else if (d.loc) setLoc(d.loc); else if (d.editp) openEditor(d.editp); else if (d.editl) openLocEditor(d.editl);
    else if ('newp' in d) openEditor(state.activeId, true); else if ('newl' in d) openLocEditor(null, true);
    else if ('export' in d) exportProfiles(); else if ('import' in d) importProfiles();
  };
  $('#moonSeg').onclick = (e) => { const m = e.target.closest('[data-mode]'); if (m) setMoonMode(m.dataset.mode); };
  $('#swNotify').onchange = () => toggleNotify();
  $('#swRed').onchange = (e) => setRed(e.target.checked);
  $('#langSel').onchange = (e) => setLang(e.target.value);
}
function setRed(v) { $('#veil').hidden = !v; $('#nightBtn').setAttribute('aria-pressed', String(!!v)); LS.set('sf.red', !!v); const s = $('#swRed'); if (s) s.checked = !!v; }

/* ---------- dettaglio: sul telefono si chiude trascinando giù ---------- */
function wireDrawerDrag() {
  const d = $('#drawer');
  let y0 = null, dy = 0;
  d.addEventListener('pointerdown', (e) => {
    if (!PHONE.matches || d.scrollTop > 2 || !e.target.closest('.d-top') || e.target.closest('button, a, input, select')) return;
    y0 = e.clientY; dy = 0;
  });
  d.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); if (dy > 4) { d.classList.add('drag'); d.style.transform = `translateY(${dy}px)`; } });
  const end = () => { if (y0 == null) return; y0 = null; d.classList.remove('drag'); if (dy > 110) closeDetail(); d.style.transform = ''; };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
}
