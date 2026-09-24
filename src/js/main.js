'use strict';
/* ============================ stato ============================ */
const F_DEFAULT = { types: [], srcs: [], minUse: 0.25, maxNights: 11, maxSb: 26, fill: 'any', band: 'any', con: '', hideClassic: false, showAll: false };
const state = {
  profiles: [], activeId: null, compare: LS.get('sf.compare', true), res: null, cfgs: [], byId: new Map(), filtered: [], page: 60,
  sel: null, selCfg: null, rot: 90, mosaic: true, realSky: LS.get('sf.realSky', true), live: true, playing: false,
  f: Object.assign({}, F_DEFAULT, LS.get('sf.filters', {})), q: '', sort: LS.get('sf.sort', 'score'), computeKey: '', windows: null, nextDarkTxt: '', calKey: '',
};
const active = () => state.profiles.find((p) => p.id === state.activeId) || state.profiles[0];
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
async function copyText(txt) {
  try { if (window.cielo && window.cielo.copy) await window.cielo.copy(txt); else await navigator.clipboard.writeText(txt); toast('Copiato negli appunti'); }
  catch (e) { toast('Copia non riuscita: seleziona il testo e copialo a mano'); }
}

/* ============================ archiviazione ============================ */
const DESK = !!(window.cielo && window.cielo.loadProfiles);
function saveStore() {
  const saved = state.profiles.filter((p) => !p.unsaved);
  LS.set('sf.profiles', saved); LS.set('sf.active', state.activeId);
  if (DESK) window.cielo.saveProfiles({ version: 2, active: state.activeId, profiles: saved }).catch(() => toast('Salvataggio su file non riuscito'));
}
function persistProfile(p) { p = clone(p); delete p.unsaved; p.updated = Date.now(); const i = state.profiles.findIndex((x) => x.id === p.id); if (i >= 0) state.profiles[i] = p; else state.profiles.push(p); state.profiles = state.profiles.filter((x) => !x.unsaved); saveStore(); return p; }
function removeProfile(id) { state.profiles = state.profiles.filter((p) => p.id !== id); if (!state.profiles.length) state.profiles = [templateProfile()]; if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0].id; saveStore(); }
function applyStore(data) {
  const list = (data && Array.isArray(data.profiles) ? data.profiles : []).filter((p) => p && p.camera && p.optic && p.site).map(migrateProfile);
  state.profiles = list.length ? list : [templateProfile()];
  state.activeId = (data && data.active) || state.profiles[0].id;
  if (!state.profiles.some((p) => p.id === state.activeId)) state.activeId = state.profiles[0].id;
}
async function exportProfiles() {
  const data = { version: 2, active: state.activeId, profiles: state.profiles.filter((p) => !p.unsaved) };
  if (DESK) { const r = await window.cielo.exportProfiles(data); if (r) toast('Profili esportati in ' + r); } else copyText(JSON.stringify(data, null, 2));
}
async function importProfiles() {
  if (!DESK) { toast('L’importazione da file è disponibile nell’app desktop'); return; }
  const data = await window.cielo.importProfiles(); if (!data) return;
  const list = (data.profiles || []).filter((p) => p && p.camera && p.optic && p.site).map(migrateProfile);
  if (!list.length) { toast('Il file non contiene profili validi'); return; }
  list.forEach((p) => { const i = state.profiles.findIndex((x) => x.id === p.id); if (i >= 0) state.profiles[i] = p; else state.profiles.push(p); });
  state.profiles = state.profiles.filter((p) => !p.unsaved); saveStore(); if (typeof closeEditor === 'function') closeEditor(); refresh(true); toast(list.length + ' profili importati');
}

/* ============================ calcolo ============================ */
function compareProfiles() { const a = active(); return state.compare ? state.profiles.filter((p) => p.id === a.id || (!p.unsaved && siteKey(p.site) === siteKey(a.site))) : [a]; }
function recompute(force) {
  const a = active(), ds = $('#nightDate').value || defaultNightStr(), profs = compareProfiles();
  const key = JSON.stringify(profs) + ds + a.id;
  if (!force && key === state.computeKey && state.res) return false;
  state.computeKey = key;
  state.cfgs = profs.sort((x, y) => (x.id === a.id ? -1 : y.id === a.id ? 1 : 0)).flatMap(profileConfigs);
  state.res = computeAll(state.cfgs, a, ds, Date.now());
  state.byId = new Map(state.res.results.map((r) => [r.o.id, r]));
  const ck = siteKey(a.site) + a.session.sunThr + defaultNightStr();
  if (ck !== state.calKey) { state.calKey = ck; const cal = moonCalendar(a, defaultNightStr(), 45); state.windows = darkWindows(cal); }
  const w = state.windows && state.windows[0]; state.nextDarkTxt = w ? `${fmtDay(w.from)}–${fmtDay(w.to)}` : '';
  return true;
}
function applyFilters() {
  const f = state.f, q = state.q.trim().toLowerCase().replace(/\s+/g, '');
  let L = state.res.results;
  if (!f.showAll && !q) L = L.filter((r) => r.usableH >= Math.max(0.25, f.minUse));
  if (f.types.length) L = L.filter((r) => f.types.includes(r.o.type));
  if (f.srcs.length) L = L.filter((r) => f.srcs.includes(r.o.src));
  if (f.hideClassic) L = L.filter((r) => !r.o.classic);
  if (f.con) L = L.filter((r) => r.o.con === f.con);
  if (f.maxSb < 26) L = L.filter((r) => r.o.sb <= f.maxSb);
  if (f.band === 'nb') L = L.filter((r) => LINES[r.o.type]); else if (f.band === 'bb') L = L.filter((r) => !LINES[r.o.type]);
  if (f.fill === 'fits') L = L.filter((r) => r.e.fill.r >= 0.35 && r.e.fill.nx * r.e.fill.ny === 1); else if (f.fill === 'small') L = L.filter((r) => r.e.fill.r < 0.35); else if (f.fill === 'mosaic') L = L.filter((r) => r.e.fill.nx * r.e.fill.ny > 1);
  if (f.maxNights < 11) L = L.filter((r) => r.e.best && r.e.best.nights <= f.maxNights);
  if (q) L = L.filter((r) => r.o.search.includes(q));
  const hrs = (r) => (r.e.best && isFinite(r.e.best.tonight) ? r.e.best.tonight : 1e9);
  const t = Dome.time;
  const cmp = {
    score: (a, b) => b.score - a.score || b.usableH - a.usableH, usable: (a, b) => b.usableH - a.usableH, hours: (a, b) => hrs(a) - hrs(b),
    fill: (a, b) => b.e.fill.score - a.e.fill.score || b.score - a.score, transit: (a, b) => (a.maxI < 0 ? 1e9 : a.maxI) - (b.maxI < 0 ? 1e9 : b.maxI),
    now: (a, b) => altAt(b, t)[0] - altAt(a, t)[0], sb: (a, b) => b.o.sb - a.o.sb || b.score - a.score,
  }[state.sort] || ((a, b) => b.score - a.score);
  state.filtered = L.slice().sort(cmp);
  LS.set('sf.filters', state.f);
  const nAdv = (f.srcs.length ? 1 : 0) + (f.minUse > 0.25 ? 1 : 0) + (f.maxNights < 11 ? 1 : 0) + (f.maxSb < 26 ? 1 : 0) + (f.fill !== 'any') + (f.band !== 'any') + (f.con ? 1 : 0) + (f.hideClassic ? 1 : 0) + (f.showAll ? 1 : 0);
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
  applyFilters();
  renderHeader(); renderFacts(); renderSetups(); renderChips(); state.page = Math.max(60, state.page); renderList(); pushDome(); drawStrip(); renderClock();
  if (state.sel && !$('#drawer').hidden) { if (state.byId.has(state.sel)) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; } else closeDetail(); }
}
function renderHeader() {
  const a = active();
  $('#profileSel').innerHTML = state.profiles.map((p) => `<option value="${esc(p.id)}" ${p.id === state.activeId ? 'selected' : ''}>${esc(p.name)}${p.unsaved ? ' (esempio)' : ''}</option>`).join('');
  $('#brandSub').textContent = `${a.site.name} · ${it(a.site.lat, 2)}°, ${it(a.site.lon, 2)}°`;
  $('#sync').querySelector('span').textContent = DESK ? 'profili salvati su file' : 'profili nel browser';
  $('#notice').innerHTML = a.site.example ? `<div class="notice"><span>Luogo e orizzonte sono di esempio (Milano, Bortle 7). Inserisci coordinate, SQM e orizzonte del tuo terrazzo.</span><button class="btn sm" id="noticeEdit">Imposta il mio luogo</button></div>` : '';
  const b = $('#noticeEdit'); if (b) b.onclick = () => openEditor(a.id);
}
function renderChips() {
  const f = state.f;
  $('#typeChips').innerHTML = `<button class="chip" data-type="" aria-pressed="${!f.types.length}">Tutti</button>` + Object.keys(TYPES_PL).map((t) => `<button class="chip" data-type="${t}" aria-pressed="${f.types.includes(t)}"><i style="background:${TYPE_COLOR[t]}"></i>${TYPES_PL[t]}</button>`).join('')
    + (state.cfgs.length > 1 || state.profiles.length > 1 ? `<label class="chk" style="margin-left:auto"><input type="checkbox" id="cmpChk" ${state.compare ? 'checked' : ''}> Confronta i setup dello stesso luogo</label>` : '');
  $('#srcChips').innerHTML = Object.entries(SOURCES).map(([k, l]) => `<button class="chip" data-src="${k}" aria-pressed="${f.srcs.includes(k)}">${l}</button>`).join('');
  const c = $('#cmpChk'); if (c) c.onchange = (e) => { state.compare = e.target.checked; LS.set('sf.compare', state.compare); refresh(true); };
}
function syncAdv() {
  const f = state.f;
  $('#minUse').value = f.minUse; $('#minUseV').textContent = f.minUse > 0.25 ? fmtDur(f.minUse) : 'qualsiasi';
  $('#maxNights').value = f.maxNights; $('#maxNightsV').textContent = f.maxNights >= 11 ? 'qualsiasi' : f.maxNights === 1 ? '1 notte' : f.maxNights + ' notti';
  $('#maxSb').value = f.maxSb; $('#maxSbV').textContent = f.maxSb >= 26 ? 'qualsiasi' : it(f.maxSb, 2) + ' mag/″²';
  $('#fillSel').value = f.fill; $('#bandSel').value = f.band; $('#conSel').value = f.con; $('#hideClassic').checked = f.hideClassic; $('#showAll').checked = f.showAll;
}

/* ============================ tempo ============================ */
function initTime() {
  const n = state.res.night, now = Date.now();
  if (state.live && now >= n.t[n.w0] && now <= n.t[n.w1]) Dome.setTime(now);
  else { state.live = false; Dome.setTime(n.first >= 0 ? n.t[n.first] + 3600000 : n.t[n.w0]); }
  $('#liveBtn').setAttribute('aria-pressed', String(state.live));
}
let lastCells = 0;
function onTime() {
  renderClock(); drawStrip();
  const now = performance.now(); if (now - lastCells > 350) { lastCells = now; refreshNowCells(); }
}
function setLive() {
  state.playing = false; $('#playBtn').setAttribute('aria-pressed', 'false'); Dome.setAnimating(false);
  if ($('#nightDate').value !== defaultNightStr()) { $('#nightDate').value = defaultNightStr(); state.live = true; refresh(); }
  state.live = true; $('#liveBtn').setAttribute('aria-pressed', 'true'); Dome.setTime(Date.now()); onTime();
}
function togglePlay() {
  state.playing = !state.playing; state.live = false;
  $('#playBtn').setAttribute('aria-pressed', String(state.playing)); $('#liveBtn').setAttribute('aria-pressed', 'false');
  Dome.setAnimating(state.playing);
  if (state.playing) { let last = performance.now(); const step = (t) => { if (!state.playing) return; const n = state.res.night, span = n.t[n.w1] - n.t[n.w0]; let x = Dome.time + (t - last) / 18000 * span; last = t; if (x > n.t[n.w1] || x < n.t[n.w0]) x = n.t[n.w0]; Dome.setTime(x); onTime(); requestAnimationFrame(step); }; requestAnimationFrame(step); }
}
function wireStrip() {
  const el = $('#strip'); let down = false;
  const set = (e) => { const n = state.res.night, b = el.getBoundingClientRect(), fr = clamp((e.clientX - b.left) / b.width, 0, 1); Dome.setTime(n.t[n.w0] + fr * (n.t[n.w1] - n.t[n.w0])); onTime(); };
  el.addEventListener('pointerdown', (e) => { down = true; el.setPointerCapture(e.pointerId); state.live = false; state.playing = false; Dome.setAnimating(false); $('#liveBtn').setAttribute('aria-pressed', 'false'); $('#playBtn').setAttribute('aria-pressed', 'false'); set(e); });
  el.addEventListener('pointermove', (e) => down && set(e));
  ['pointerup', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => { down = false; if (state.sort === 'now') { applyFilters(); renderList(); } }));
}

/* ============================ eventi ============================ */
function wire() {
  $('#nightDate').value = defaultNightStr();
  $('#nightDate').onchange = () => { if (!$('#nightDate').value) $('#nightDate').value = defaultNightStr(); state.live = $('#nightDate').value === defaultNightStr(); refresh(); };
  $('#todayBtn').onclick = setLive; $('#liveBtn').onclick = setLive; $('#playBtn').onclick = togglePlay;
  const lp = (v) => { Dome.setLP(v); $('#lpToggle').setAttribute('aria-pressed', String(!!v)); LS.set('sf.lp', !!v); };
  lp(LS.get('sf.lp', false)); $('#lpToggle').onclick = () => lp($('#lpToggle').getAttribute('aria-pressed') !== 'true');
  $('#profileSel').onchange = (e) => { state.activeId = e.target.value; saveStore(); closeDetail(); state.sel = null; refresh(); };
  $('#editBtn').onclick = () => openEditor(state.activeId); $('#newBtn').onclick = () => openEditor(state.activeId, true);
  $('#typeChips').onclick = (e) => { const b = e.target.closest('[data-type]'); if (!b) return; const t = b.dataset.type, f = state.f; f.types = !t ? [] : f.types.includes(t) ? f.types.filter((x) => x !== t) : f.types.concat(t); state.page = 60; applyFilters(); renderChips(); renderList(); renderSetups(); pushDome(); };
  $('#srcChips').onclick = (e) => { const b = e.target.closest('[data-src]'); if (!b) return; const s = b.dataset.src, f = state.f; f.srcs = f.srcs.includes(s) ? f.srcs.filter((x) => x !== s) : f.srcs.concat(s); state.page = 60; applyFilters(); renderChips(); renderList(); renderSetups(); pushDome(); };
  const upd = () => { state.page = 60; applyFilters(); syncAdv(); renderList(); renderSetups(); pushDome(); };
  $('#minUse').oninput = (e) => { state.f.minUse = +e.target.value; upd(); };
  $('#maxNights').oninput = (e) => { state.f.maxNights = +e.target.value; upd(); };
  $('#maxSb').oninput = (e) => { state.f.maxSb = +e.target.value; upd(); };
  $('#fillSel').onchange = (e) => { state.f.fill = e.target.value; upd(); };
  $('#bandSel').onchange = (e) => { state.f.band = e.target.value; upd(); };
  $('#conSel').innerHTML = '<option value="">Tutte</option>' + Object.entries(CONST_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#conSel').onchange = (e) => { state.f.con = e.target.value; upd(); };
  $('#hideClassic').onchange = (e) => { state.f.hideClassic = e.target.checked; upd(); };
  $('#showAll').onchange = (e) => { state.f.showAll = e.target.checked; upd(); };
  $('#resetF').onclick = () => { state.f = Object.assign({}, F_DEFAULT); renderChips(); upd(); };
  $('#advBtn').onclick = () => { const a = $('#adv'); a.hidden = !a.hidden; $('#advBtn').setAttribute('aria-expanded', String(!a.hidden)); };
  $('#sortSel').value = state.sort; $('#sortSel').onchange = (e) => { state.sort = e.target.value; LS.set('sf.sort', state.sort); applyFilters(); renderList(); pushDome(); };
  let qt; $('#q').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; state.page = 60; applyFilters(); renderList(); pushDome(); }, 120); };
  $('#list').addEventListener('click', (e) => { const r = e.target.closest('.row[data-id]'); if (r) openDetail(r.dataset.id); });
  $('#list').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.closest('.row[data-id]'); if (r) { e.preventDefault(); openDetail(r.dataset.id); } } });
  $('#list').addEventListener('mouseover', (e) => { const r = e.target.closest('.row[data-id]'); $$('#list .row.hl').forEach((x) => x !== r && x.classList.remove('hl')); });
  $('#backdrop').onclick = closeDetail;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#editor').hidden) closeEditor(); else if (!$('#drawer').hidden) closeDetail(); } });
  const red = (v) => { $('#veil').hidden = !v; $('#nightBtn').setAttribute('aria-pressed', String(!!v)); LS.set('sf.red', !!v); };
  red(LS.get('sf.red', false)); $('#nightBtn').onclick = () => red($('#veil').hidden);
  window.addEventListener('resize', () => { drawStrip(); if (state.sel && !$('#drawer').hidden) drawPreview(); });
  Dome.onPick((id) => openDetail(id));
  wireStrip(); wireEditor(); syncAdv();
  setInterval(() => { if (state.live) { Dome.setTime(Date.now()); onTime(); } }, 1000);
  setInterval(() => { if (state.live && $('#nightDate').value !== defaultNightStr()) { $('#nightDate').value = defaultNightStr(); refresh(); } }, 300000);
}

async function boot() {
  Dome.init($('#dome'), $('#domeTip'));
  if (DESK) { try { applyStore(await window.cielo.loadProfiles()); } catch (e) { applyStore(null); } }
  else applyStore({ profiles: LS.get('sf.profiles', []), active: LS.get('sf.active', null) });
  wire(); refresh(true);
}
boot();
