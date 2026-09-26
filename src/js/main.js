'use strict';
/* ============================ stato ============================ */
const F_DEFAULT = { types: [], srcs: [], minUse: 0.25, maxNights: 11, maxSb: 26, fill: 'any', band: 'any', con: '', hideClassic: false, showAll: false, mine: false, hideDone: false };
const state = {
  profiles: [], activeId: null, locs: [], locId: null, projects: {}, cfgFilter: '', res: null, cfgs: [], byId: new Map(), filtered: [], page: 60,
  sel: null, selCfg: null, rot: 90, mosaic: true, realSky: LS.get('sf.realSky', true), live: true, playing: false,
  f: Object.assign({}, F_DEFAULT, LS.get('sf.filters', {})), q: '', sort: LS.get('sf.sort', 'score'), computeKey: '', windows: null, nextDarkTxt: '', calKey: '',
};
const activeProfile = () => state.profiles.find((p) => p.id === state.activeId) || state.profiles[0];
const activeLoc = () => state.locs.find((l) => l.id === state.locId) || state.locs[0];
/* profilo attivo nel luogo attivo (è quello che usa il calcolo); si ricrea solo quando cambia uno dei due */
let effMemo = null;
function active() { const p = activeProfile(), l = activeLoc(); if (!effMemo || effMemo.p !== p || effMemo.l !== l) effMemo = { p, l, e: effectiveProfile(p, l) }; return effMemo.e; }
function toast(msg) { $$('.toast').forEach((x) => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
async function copyText(txt) {
  try { if (window.cielo && window.cielo.copy) await window.cielo.copy(txt); else await navigator.clipboard.writeText(txt); toast(tx('Copiato negli appunti')); }
  catch (e) { toast(tx('Copia non riuscita: seleziona il testo e copialo a mano')); }
}

/* ============================ archiviazione ============================ */
const DESK = !!(window.cielo && window.cielo.loadProfiles);
/* Nel file restano anche i campi del formato precedente (primo telescopio, luogo e orizzonte dentro il profilo, presi
   dal luogo attivo): una versione più vecchia, prima di aggiornarsi, legge ancora il profilo invece di scartarlo. */
const withLegacy = (p) => {
  const l = activeLoc(), o = (p.optics || [])[0], out = { ...p, site: l.site, horizon: l.horizon, session: { ...p.session, minAlt: l.minAlt } };
  if (!o) return out; const { id, useNative, accessories, ...optic } = o; return { ...out, optic, useNative, accessories };
};
const validProfile = (p) => p && p.camera && (p.optic || p.optics);
const stripSite = (p) => { delete p.site; delete p.horizon; return p; };
const storeData = () => ({ version: 3, active: state.activeId, activeLoc: state.locId, profiles: state.profiles.filter((p) => !p.unsaved).map(withLegacy), locations: state.locs.filter((l) => !l.unsaved), projects: state.projects });
/* telefono e browser: tutto in un'unica chiave (sf.store, formato 3); le chiavi separate restano per le versioni vecchie */
function saveStore() {
  const d = storeData();
  LS.set('sf.store', d);
  LS.set('sf.profiles', d.profiles); LS.set('sf.active', state.activeId); LS.set('sf.locs', d.locations); LS.set('sf.loc', state.locId);
  if (DESK) window.cielo.saveProfiles(d).catch(() => toast(tx('Salvataggio su file non riuscito')));
}
function persistProfile(p) { p = clone(p); delete p.unsaved; stripSite(p); p.updated = Date.now(); const i = state.profiles.findIndex((x) => x.id === p.id); if (i >= 0) state.profiles[i] = p; else state.profiles.push(p); state.profiles = state.profiles.filter((x) => !x.unsaved); saveStore(); return p; }
function removeProfile(id) { state.profiles = state.profiles.filter((p) => p.id !== id); if (!state.profiles.length) state.profiles = [stripSite(templateProfile())]; if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0].id; saveStore(); }
function persistLoc(l) { l = clone(l); delete l.unsaved; l.updated = Date.now(); const i = state.locs.findIndex((x) => x.id === l.id); if (i >= 0) state.locs[i] = l; else state.locs.push(l); state.locs = state.locs.filter((x) => !x.unsaved); saveStore(); return l; }
function removeLoc(id) { state.locs = state.locs.filter((l) => l.id !== id); if (!state.locs.length) state.locs = [templateLoc()]; if (!state.locs.some((l) => l.id === state.locId)) state.locId = state.locs[0].id; saveStore(); }
/* profili e luoghi da un file: formato 3 con i luoghi a parte, oppure i formati precedenti con il luogo dentro ogni profilo */
function readData(data) {
  const list = (data && Array.isArray(data.profiles) ? data.profiles : []).filter(validProfile).map(migrateProfile);
  let locs, byProfile = new Map();
  if (data && Array.isArray(data.locations)) locs = data.locations.map(migrateLoc).filter(Boolean);
  else ({ locs, byProfile } = locsFromProfiles(list));
  list.forEach(stripSite);
  return { list, locs, byProfile, old: !(data && Array.isArray(data.locations)) };
}
function applyStore(data) {
  const { list, locs, byProfile, old } = readData(data);
  state.profiles = list.length ? list : [stripSite(templateProfile())];
  state.locs = locs.length ? locs : [templateLoc()];
  state.activeId = (data && data.active) || state.profiles[0].id;
  if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0].id;
  state.locId = (data && data.activeLoc) || byProfile.get(state.activeId) || state.locs[0].id;
  if (!state.locs.some((l) => l.id === state.locId)) state.locId = state.locs[0].id;
  state.projects = data && data.projects && typeof data.projects === 'object' && !Array.isArray(data.projects) ? data.projects : {};
  if (old && list.length) saveStore(); // si passa subito al formato con i luoghi
}
async function exportProfiles() {
  const data = storeData();
  if (DESK) { const r = await window.cielo.exportProfiles(data); if (r) toast(tx('Profili e luoghi esportati in {f}', { f: r })); } else copyText(JSON.stringify(data, null, 2));
}
async function importProfiles() {
  let data;
  if (DESK) data = await window.cielo.importProfiles();
  else data = await new Promise((res) => { // telefono e browser: si sceglie il file .json esportato dal desktop
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return res(null); const rd = new FileReader(); rd.onload = () => { try { res(JSON.parse(rd.result)); } catch { res(null); } }; rd.readAsText(f); };
    inp.click();
  });
  if (!data) return;
  const { list, locs } = readData(data);
  if (!list.length && !locs.length) { toast(tx('Il file non contiene profili o luoghi validi')); return; }
  list.forEach((p) => { const i = state.profiles.findIndex((x) => x.id === p.id); if (i >= 0) state.profiles[i] = p; else state.profiles.push(p); });
  // un luogo già presente (stesso id, oppure stesso nome a meno di 500 m) si aggiorna invece di duplicarsi
  locs.forEach((l) => { let i = state.locs.findIndex((x) => x.id === l.id); if (i < 0) i = state.locs.findIndex((x) => !x.unsaved && x.site.name === l.site.name && kmBetween(x.site, l.site) < 0.5); if (i >= 0) state.locs[i] = { ...l, id: state.locs[i].id }; else state.locs.push(l); });
  state.profiles = state.profiles.filter((p) => !p.unsaved); if (!state.profiles.length) state.profiles = [stripSite(templateProfile())];
  state.locs = state.locs.filter((l) => !l.unsaved); if (!state.locs.length) state.locs = [templateLoc()];
  if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0].id;
  if (!state.locs.some((l) => l.id === state.locId)) state.locId = state.locs[0].id;
  mergeProjects(data.projects);
  saveStore(); if (typeof closeEditor === 'function') closeEditor(); refresh(true); toast(tx('{n} profili e {m} luoghi importati', { n: list.length, m: locs.length }));
}

/* ============================ calcolo ============================ */
/* si consiglia solo con il materiale del profilo attivo: le sue ottiche, i loro accessori, la sua camera e i suoi filtri */
function recompute(force) {
  const a = active(), ds = $('#nightDate').value || defaultNightStr();
  const key = JSON.stringify(a) + ds;
  if (!force && key === state.computeKey && state.res) return false;
  state.computeKey = key;
  state.cfgs = profileConfigs(a);
  if (state.cfgFilter && !state.cfgs.some((c) => c.key === state.cfgFilter)) state.cfgFilter = '';
  state.res = computeAll(state.cfgs, a, ds, Date.now());
  state.res.C.progOf = projProgress; state.res.C.mode = moonMode(); applyWeather();
  state.byId = new Map(state.res.results.map((r) => [r.o.id, r]));
  const ck = siteKey(a.site) + a.session.sunThr + defaultNightStr();
  if (ck !== state.calKey) { state.calKey = ck; const cal = moonCalendar(a, defaultNightStr(), 45); state.windows = darkWindows(cal); }
  const w = state.windows && state.windows[0]; state.nextDarkTxt = w ? `${fmtDay(w.from)}–${fmtDay(w.to)}` : '';
  return true;
}
/* Come riprendi con la Luna: consigliato (salta le notti peggiori), tutte le sere, solo senza Luna. Preferenza dell'app;
   finché non la scegli vale quella scritta nel profilo dalle versioni precedenti. */
const moonMode = () => { const m = LS.get('sf.moonMode', null); return MOON_MODES.includes(m) ? m : activeProfile().session.moon === 'dark' ? 'dark' : 'smart'; };
function setMoonMode(m) {
  if (!MOON_MODES.includes(m) || m === moonMode()) return; LS.set('sf.moonMode', m);
  for (const C of [state.res.C, ...[...cmp.cache.values()].map((c) => c.C).filter(Boolean)]) { C.mode = m; }
  applyFilters(); renderList(); renderTonight(); renderTopList(); if (UI.view === 'projects') renderProjects(); if (UI.view === 'setup') renderSetup();
  if (state.sel && !$('#drawer').hidden) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; }
}

/* ============================ confronto fra luoghi ============================ */
/* Stesso profilo e stessa notte negli altri luoghi salvati. Dopo il luogo attivo si calcolano gli altri a pezzi da ~10 ms,
   così l'interfaccia resta libera; i risultati restano in memoria finché non cambiano profilo, notte o luogo. */
const cmp = { cache: new Map(), keys: new Map(), job: 0, pending: 0 };
const cmpSum = (r) => ({ h: hoursOf(r.e.best), nights: r.e.best ? r.e.best.nights : Infinity, usableH: r.usableH, score: r.score, cfg: r.e.cfg.key, maxA: r.maxA });
const cmpSums = (l) => { const c = cmp.cache.get(cmp.keys.get(l.id)); return c && c.sums; };
function scheduleCompare() {
  const job = ++cmp.job, p = activeProfile(), ds = state.res.night.ds, pk = JSON.stringify(p) + ds;
  cmp.keys = new Map(state.locs.map((l) => [l.id, pk + JSON.stringify(l)]));
  const live = new Set(cmp.keys.values()); for (const k of cmp.cache.keys()) if (!live.has(k)) cmp.cache.delete(k);
  const ak = cmp.keys.get(activeLoc().id), ac = cmp.cache.get(ak) || {};
  if (!ac.sums) cmp.cache.set(ak, { ...ac, sums: new Map(state.res.results.map((r) => [r.o.id, cmpSum(r)])) });
  const todo = state.locs.filter((l) => !cmpSums(l));
  cmp.pending = todo.length;
  if (!todo.length) return;
  let li = 0, i = 0, C = null, sums = null;
  const step = () => {
    if (job !== cmp.job) return;
    const t0 = performance.now();
    while (li < todo.length && performance.now() - t0 < 10) {
      const l = todo[li];
      if (!C) { const e = effectiveProfile(p, l); C = computePrep(profileConfigs(e), e, ds, Date.now()); sums = new Map(); i = 0; }
      const r = computeObj(C, CAT[i++]); if (r) sums.set(r.o.id, cmpSum(r));
      if (i >= CAT.length) { cmp.cache.set(cmp.keys.get(l.id), { C, sums }); C = null; li++; cmp.pending = todo.length - li; }
    }
    if (li < todo.length) setTimeout(step, 0); else onCompare();
  };
  setTimeout(step, 200);
}
/* contesto di calcolo di un luogo e un target calcolato per intero in quel luogo (servono al dettaglio) */
function cmpCtx(l) {
  if (l.id === activeLoc().id) return state.res.C;
  const k = cmp.keys.get(l.id); let c = cmp.cache.get(k); if (!c) { c = {}; cmp.cache.set(k, c); }
  if (!c.C) { const e = effectiveProfile(activeProfile(), l); c.C = computePrep(profileConfigs(e), e, state.res.night.ds, Date.now()); }
  c.C.mode = moonMode(); c.C.progOf = projProgress; if (!c.C.wx) c.C.wx = wxAtFor(l.site);
  return c.C;
}
function cmpFull(l, o) { return l.id === activeLoc().id ? state.byId.get(o.id) || null : computeObj(cmpCtx(l), o); }
/* il luogo più rapido per un target, se conviene davvero (almeno il 25% di tempo in meno, o qui non si riprende) */
function betterLoc(r) {
  if (state.locs.length < 2) return null;
  const here = r.usableH >= 0.25 ? hoursOf(r.e.best) : Infinity; let best = null;
  for (const l of state.locs) {
    if (l.id === state.locId) continue; const m = cmpSums(l), s = m && m.get(r.o.id);
    if (!s || s.usableH < 0.25 || !isFinite(s.h)) continue;
    if (!best || s.h < best.s.h) best = { l, s };
  }
  if (!best || (isFinite(here) && best.s.h > here * 0.75)) return null;
  return { ...best, here, gain: isFinite(here) ? 1 - best.s.h / here : null };
}
function onCompare() {
  cmp.pending = 0;
  $$('#list .row[data-id]').forEach((el) => { const r = state.byId.get(el.dataset.id), x = el.querySelector('.lh'); if (r && x) x.innerHTML = locHint(r); });
  renderLocs();
  if (state.sort === 'gain') { applyFilters(); renderList(); pushDome(); }
  if (state.sel && !$('#drawer').hidden) { const r = state.byId.get(state.sel); if (r) renderScenLocs(r); }
}
function setLoc(id) {
  if (!state.locs.some((l) => l.id === id) || id === state.locId) return;
  state.locId = id; saveStore(); refresh(); toast(tx('Luogo: {n}', { n: activeLoc().site.name }));
}
function applyFilters() {
  const f = state.f, q = state.q.trim().toLowerCase().replace(/\s+/g, '');
  let L = state.res.results;
  if (f.mine) L = L.filter((r) => inMyList(r.o.id)); // i miei: anche quelli che stanotte non si riprendono
  else if (!f.showAll && !q) L = L.filter((r) => r.usableH >= Math.max(0.25, f.minUse));
  if (f.hideDone) L = L.filter((r) => !isDone(r.o.id));
  if (f.types.length) L = L.filter((r) => f.types.includes(r.o.type));
  if (f.srcs.length) L = L.filter((r) => f.srcs.includes(r.o.src));
  if (f.hideClassic) L = L.filter((r) => !r.o.classic);
  if (f.con) L = L.filter((r) => r.o.con === f.con);
  if (f.maxSb < 26) L = L.filter((r) => r.o.sb <= f.maxSb);
  if (f.band === 'nb') L = L.filter((r) => LINES[r.o.type]); else if (f.band === 'bb') L = L.filter((r) => !LINES[r.o.type]);
  if (f.fill === 'fits') L = L.filter((r) => r.e.fill.r >= 0.35 && r.e.fill.nx * r.e.fill.ny === 1); else if (f.fill === 'small') L = L.filter((r) => r.e.fill.r < 0.35); else if (f.fill === 'mosaic') L = L.filter((r) => r.e.fill.nx * r.e.fill.ny > 1);
  // notti: dal calendario notte per notte se è già calcolato (righe viste), altrimenti la stima con notti tutte come questa
  const A = state.res.C.ahead, nightsOf = (r) => { const c = A && A.cache.get(calKey(r, r.e, false, calMode(state.res.C))); return c ? (c.done ? c.sessions : Infinity) : r.e.best.nights; };
  if (f.maxNights < 11) L = L.filter((r) => r.e.best && nightsOf(r) <= f.maxNights);
  if (state.cfgFilter) L = L.filter((r) => r.e.cfg.key === state.cfgFilter);
  if (q) L = L.filter((r) => r.o.search.includes(q));
  const hrs = (r) => (r.e.best ? hoursOf(r.e.best) : 1e9); // ore senza Luna lungo il percorso della notte
  // conviene andare altrove: target buoni nell'altro luogo e con molto tempo risparmiato (o che qui non si riprendono)
  const gain = (r) => { const b = betterLoc(r); return b ? b.s.score * (0.5 + (b.gain == null ? 1 : b.gain)) : -1; };
  const t = Dome.time;
  const cmp = {
    score: (a, b) => b.score - a.score || b.usableH - a.usableH, usable: (a, b) => b.usableH - a.usableH, hours: (a, b) => hrs(a) - hrs(b),
    fill: (a, b) => b.e.fill.score - a.e.fill.score || b.score - a.score, transit: (a, b) => (a.maxI < 0 ? 1e9 : a.maxI) - (b.maxI < 0 ? 1e9 : b.maxI),
    now: (a, b) => altAt(b, t)[0] - altAt(a, t)[0], sb: (a, b) => b.o.sb - a.o.sb || b.score - a.score,
    gain: (a, b) => gain(b) - gain(a) || b.score - a.score,
  }[state.sort] || ((a, b) => b.score - a.score);
  state.filtered = L.slice().sort(cmp);
  LS.set('sf.filters', state.f);
  $('#mineBtn').setAttribute('aria-pressed', String(!!f.mine));
  const nAdv = (f.hideDone ? 1 : 0) + (f.srcs.length ? 1 : 0) + (f.minUse > 0.25 ? 1 : 0) + (f.maxNights < 11 ? 1 : 0) + (f.maxSb < 26 ? 1 : 0) + (f.fill !== 'any') + (f.band !== 'any') + (f.con ? 1 : 0) + (f.hideClassic ? 1 : 0) + (f.showAll ? 1 : 0) + (state.cfgFilter ? 1 : 0);
  $('#advCount').hidden = !nAdv; $('#advCount').textContent = nAdv;
}
function pushDome() {
  const a = active(); const top = state.filtered.slice(0, 40);
  const sel = state.sel && state.byId.get(state.sel); if (sel && !top.includes(sel)) top.push(sel);
  Dome.setData({ site: a.site, lut: state.res.lut, sqm: state.res.sqm, sky: state.res.sky, night: state.res.night, targets: top, sel: state.sel, byId: state.byId, minAlt: +a.session.minAlt || 0 });
}
function refresh(force) {
  const changed = recompute(force);
  if (changed) initTime();
  if (changed || cmp.keys.size !== state.locs.length) scheduleCompare();
  applyFilters();
  renderHeader(); renderNightBar(); renderFacts(); renderTonight(); renderSetups(); renderLocs(); renderChips(); state.page = Math.max(60, state.page); renderList(); renderTopList(); pushDome(); drawStrip(); renderClock();
  if (UI.view === 'projects') renderProjects(); else if (UI.view === 'setup') renderSetup(); else if (UI.view === 'sky') renderSky();
  refreshWeather(false); // il meteo del luogo, se non c'è o è vecchio: arriva dopo e ridisegna
  if (state.sel && !$('#drawer').hidden) { if (state.byId.has(state.sel)) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; } else closeDetail(); }
}
function renderHeader() {
  const a = active();
  renderTopbar();
  $('#notice').innerHTML = a.site.example ? `<div class="notice"><span>${tx('Luogo e orizzonte sono di esempio (Milano, Bortle 7). Inserisci coordinate, SQM e orizzonte del tuo terrazzo.')}</span><button class="btn sm" id="noticeEdit">${tx('Imposta il mio luogo')}</button></div>` : '';
  const b = $('#noticeEdit'); if (b) b.onclick = () => openLocEditor(state.locId);
  const gs = $('#sortSel option[value="gain"]'); if (gs) gs.hidden = state.locs.length < 2;
  if (state.sort === 'gain' && state.locs.length < 2) { state.sort = 'score'; $('#sortSel').value = 'score'; }
}
function renderChips() {
  const f = state.f;
  $('#typeChips').innerHTML = `<button class="chip" data-type="" aria-pressed="${!f.types.length}">${tx('Tutti')}</button>` + Object.keys(TYPES_PL).map((t) => `<button class="chip" data-type="${t}" aria-pressed="${f.types.includes(t)}"><i style="background:${TYPE_COLOR[t]}"></i>${tx(TYPES_PL[t])}</button>`).join('')
;
  // setup del profilo: filtro "consigliato con…"
  const cs = $('#cfgSel'); $('#cfgF').hidden = state.cfgs.length < 2;
  cs.innerHTML = `<option value="">${tx('Qualsiasi')}</option>` + state.cfgs.map((c) => `<option value="${esc(c.key)}">${esc(c.label)} · ${c.short}</option>`).join(''); cs.value = state.cfgFilter;
  $('#srcChips').innerHTML = Object.entries(SOURCES).map(([k, l]) => `<button class="chip" data-src="${k}" aria-pressed="${f.srcs.includes(k)}">${tx(l)}</button>`).join('');
}
function syncAdv() {
  const f = state.f;
  $('#minUse').value = f.minUse; $('#minUseV').textContent = f.minUse > 0.25 ? fmtDur(f.minUse) : tx('qualsiasi');
  $('#maxNights').value = f.maxNights; $('#maxNightsV').textContent = f.maxNights >= 11 ? tx('qualsiasi') : f.maxNights === 1 ? tx('1 notte') : tx('{n} notti', { n: f.maxNights });
  $('#maxSb').value = f.maxSb; $('#maxSbV').textContent = f.maxSb >= 26 ? tx('qualsiasi') : it(f.maxSb, 2) + ' mag/″²';
  $('#fillSel').value = f.fill; $('#bandSel').value = f.band; $('#conSel').value = f.con; $('#hideClassic').checked = f.hideClassic; $('#showAll').checked = f.showAll; $('#hideDone').checked = !!f.hideDone;
}

/* filtri avanzati: pannello sotto la barra sul computer, foglio dal basso sul telefono */
function setAdv(open) {
  const a = $('#adv'); if (open === !a.hidden) return;
  a.hidden = !open; $('#advBack').hidden = !open || !PHONE.matches; $('#advBtn').setAttribute('aria-expanded', String(open));
  if (open && PHONE.matches) backPush(closeAdv); else if (!open) backDone(closeAdv);
}
function closeAdv(fromPop) { if (fromPop === true) { $('#adv').hidden = true; $('#advBack').hidden = true; $('#advBtn').setAttribute('aria-expanded', 'false'); } else setAdv(false); }

/* ============================ tempo ============================ */
function initTime() {
  const n = state.res.night, now = Date.now();
  if (state.live && now >= n.t[n.w0] && now <= n.t[n.w1]) Dome.setTime(now);
  else { state.live = false; Dome.setTime(n.first >= 0 ? n.t[n.first] + 3600000 : n.t[n.w0]); }
  $('#liveBtn').setAttribute('aria-pressed', String(state.live));
}
let lastCells = 0;
function onTime() {
  renderClock(); drawStrip(); updateNightCharts();
  const now = performance.now(); if (now - lastCells > 350) { lastCells = now; refreshNowCells(); }
}
function setPlayIcon() { const b = $('#playBtn'); b.setAttribute('aria-pressed', String(!!state.playing)); b.innerHTML = ic(state.playing ? 'pause' : 'play'); }
function setLive() {
  state.playing = false; setPlayIcon(); Dome.setAnimating(false);
  if ($('#nightDate').value !== defaultNightStr()) { $('#nightDate').value = defaultNightStr(); state.live = true; refresh(); }
  state.live = true; $('#liveBtn').setAttribute('aria-pressed', 'true'); Dome.setTime(Date.now()); onTime();
}
function togglePlay() {
  state.playing = !state.playing; state.live = false;
  setPlayIcon(); $('#liveBtn').setAttribute('aria-pressed', 'false');
  Dome.setAnimating(state.playing);
  if (state.playing) { let last = performance.now(); const step = (t) => { if (!state.playing) return; const n = state.res.night, span = n.t[n.w1] - n.t[n.w0]; let x = Dome.time + (t - last) / 18000 * span; last = t; if (x > n.t[n.w1] || x < n.t[n.w0]) x = n.t[n.w0]; Dome.setTime(x); onTime(); requestAnimationFrame(step); }; requestAnimationFrame(step); }
}
function wireStrip() {
  const el = $('#strip'); let down = false;
  const set = (e) => { const n = state.res.night, b = el.getBoundingClientRect(), fr = clamp((e.clientX - b.left) / b.width, 0, 1); Dome.setTime(n.t[n.w0] + fr * (n.t[n.w1] - n.t[n.w0])); onTime(); };
  el.addEventListener('pointerdown', (e) => { down = true; el.setPointerCapture(e.pointerId); state.live = false; state.playing = false; Dome.setAnimating(false); $('#liveBtn').setAttribute('aria-pressed', 'false'); setPlayIcon(); set(e); });
  el.addEventListener('pointermove', (e) => down && set(e));
  ['pointerup', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => { down = false; if (state.sort === 'now') { applyFilters(); renderList(); } }));
}

/* ============================ eventi ============================ */
function wire() {
  $('#nightDate').value = defaultNightStr();
  $('#nightDate').onchange = () => { if (!$('#nightDate').value) $('#nightDate').value = defaultNightStr(); state.live = $('#nightDate').value === defaultNightStr(); refresh(); };
  $('#liveBtn').onclick = setLive; $('#playBtn').onclick = togglePlay;
  $('#nav').onclick = (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); };
  $('#locChip').onclick = openLocSheet; $('#profChip').onclick = openProfSheet; $('#nightChip').onclick = openNightSheet;
  const lp = (v) => { Dome.setLP(v); $('#lpToggle').setAttribute('aria-pressed', String(!!v)); LS.set('sf.lp', !!v); };
  if (window.cielo && window.cielo.onUpdate) window.cielo.onUpdate(showUpdate);
  lp(LS.get('sf.lp', false)); $('#lpToggle').onclick = () => lp($('#lpToggle').getAttribute('aria-pressed') !== 'true');
  $('#locs').onclick = (e) => { const b = e.target.closest('[data-loc]'); if (b) setLoc(b.dataset.loc); };
  $('#typeChips').onclick = (e) => { const b = e.target.closest('[data-type]'); if (!b) return; const t = b.dataset.type, f = state.f; f.types = !t ? [] : f.types.includes(t) ? f.types.filter((x) => x !== t) : f.types.concat(t); state.page = 60; applyFilters(); renderChips(); renderList(); renderSetups(); pushDome(); };
  $('#srcChips').onclick = (e) => { const b = e.target.closest('[data-src]'); if (!b) return; const s = b.dataset.src, f = state.f; f.srcs = f.srcs.includes(s) ? f.srcs.filter((x) => x !== s) : f.srcs.concat(s); state.page = 60; applyFilters(); renderChips(); renderList(); renderSetups(); pushDome(); };
  const upd = () => { state.page = 60; applyFilters(); syncAdv(); renderList(); renderSetups(); pushDome(); };
  $('#minUse').oninput = (e) => { state.f.minUse = +e.target.value; upd(); };
  $('#maxNights').oninput = (e) => { state.f.maxNights = +e.target.value; upd(); };
  $('#maxSb').oninput = (e) => { state.f.maxSb = +e.target.value; upd(); };
  $('#fillSel').onchange = (e) => { state.f.fill = e.target.value; upd(); };
  $('#bandSel').onchange = (e) => { state.f.band = e.target.value; upd(); };
  $('#cfgSel').onchange = (e) => { state.cfgFilter = e.target.value; upd(); };
  $('#conSel').innerHTML = `<option value="">${tx('Tutte')}</option>` + Object.entries(CONST_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#conSel').onchange = (e) => { state.f.con = e.target.value; upd(); };
  $('#hideClassic').onchange = (e) => { state.f.hideClassic = e.target.checked; upd(); };
  $('#hideDone').onchange = (e) => { state.f.hideDone = e.target.checked; upd(); };
  $('#mineBtn').onclick = () => { state.f.mine = !state.f.mine; upd(); };
  setInterval(() => refreshWeather(false), 30 * 60e3);
  $('#showAll').onchange = (e) => { state.f.showAll = e.target.checked; upd(); };
  $('#resetF').onclick = () => { state.f = Object.assign({}, F_DEFAULT); state.cfgFilter = ''; renderChips(); upd(); };
  $('#advBtn').onclick = () => setAdv($('#adv').hidden);
  $('#advDone').onclick = () => setAdv(false); $('#advBack').onclick = () => setAdv(false);
  $('#sortSel').value = state.sort; $('#sortSel').onchange = (e) => { state.sort = e.target.value; LS.set('sf.sort', state.sort); applyFilters(); renderList(); pushDome(); };
  let qt; $('#q').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; state.page = 60; applyFilters(); renderList(); pushDome(); }, 120); };
  $('#list').addEventListener('click', (e) => { const fv = e.target.closest('[data-fav]'); if (fv) { e.stopPropagation(); toggleFav(fv.dataset.fav); return; } const r = e.target.closest('.row[data-id]'); if (r) openDetail(r.dataset.id); });
  $('#list').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.closest('.row[data-id]'); if (r) { e.preventDefault(); openDetail(r.dataset.id); } } });
  $('#list').addEventListener('mouseover', (e) => { const r = e.target.closest('.row[data-id]'); $$('#list .row.hl').forEach((x) => x !== r && x.classList.remove('hl')); });
  $('#backdrop').onclick = () => closeDetail();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#editor').hidden) askCloseEditor(); else if (!$('#drawer').hidden) closeDetail(); else if (!$('#adv').hidden) setAdv(false); } });
  setRed(LS.get('sf.red', false)); $('#nightBtn').onclick = () => setRed($('#veil').hidden);
  wireDrawerDrag();
  window.addEventListener('resize', () => { drawStrip(); if (state.sel && !$('#drawer').hidden) drawPreview(); });
  setPlayIcon();
  Dome.onPick((id) => openDetail(id));
  wireStrip(); wireEditor(); syncAdv();
  setInterval(() => { if (state.live) { Dome.setTime(Date.now()); onTime(); } }, 1000);
  setInterval(() => { if (state.live && $('#nightDate').value !== defaultNightStr()) { $('#nightDate').value = defaultNightStr(); refresh(); } }, 300000);
}

async function boot() {
  // prima si disegna la schermata d'avvio (l'intro parte), poi i calcoli
  await new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); }); // (pagina nascosta: niente fotogrammi)
  Dome.init($('#dome'), $('#domeTip'));
  if (DESK) { try { applyStore(await window.cielo.loadProfiles()); } catch (e) { applyStore(null); } }
  // fino alla 0.5.0 qui si rileggevano solo i profili: i luoghi si ricostruivano da quello attivo e gli altri si perdevano
  else applyStore(LS.get('sf.store', null) || { profiles: LS.get('sf.profiles', []), active: LS.get('sf.active', null), locations: LS.get('sf.locs', undefined), activeLoc: LS.get('sf.loc', null) });
  wire(); refresh(true);
  window.__bootMs = Math.round(performance.now());
  // guida al primo avvio e novità dopo un aggiornamento: quando il logo è arrivato al suo posto
  Promise.resolve(window.introExit ? introExit() : $('#bootScreen') && $('#bootScreen').remove()).then(() => setTimeout(tourBoot, 250));
}
boot();

/* aggiornamenti: il processo principale scarica e installa dove può, altrimenti avvisa con il link alla release */
function showUpdate(m) {
  const el = $('#upd'), v = esc(m.version || '');
  el.hidden = false; el.dataset.state = m.state;
  if (m.state === 'downloading') el.innerHTML = `<span>${tx('Scarico Skyframe {v}', { v })}</span><i class="pbar"><b style="width:${m.percent || 0}%"></b></i><span class="num">${m.percent || 0}%</span>`;
  else if (m.state === 'ready') el.innerHTML = `<span>${tx('Skyframe {v} è pronto: si installa alla chiusura, oppure', { v })}</span><button class="btn sm primary" id="updGo">${tx('Riavvia e aggiorna')}</button>`;
  else if (m.state === 'available') el.innerHTML = `<span>${tx('È uscito Skyframe {v}', { v })}</span><button class="btn sm" id="updGo">${tx('Scarica')}</button>`;
  else if (m.state === 'error') el.innerHTML = `<span>${tx('Aggiornamento a {v} non riuscito', { v })}</span><button class="btn sm" id="updGo">${tx('Scaricalo a mano')}</button>`;
  else { el.hidden = true; return; }
  const b = $('#updGo'); if (b) b.onclick = () => { if (m.state === 'ready') { b.disabled = true; b.textContent = tx('Riavvio…'); window.cielo.installUpdate(); } else window.cielo.openUpdate(); };
}
