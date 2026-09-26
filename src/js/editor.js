'use strict';
/* ============================ editor del profilo ============================ */
let draft = null;
const F = (id) => document.getElementById(id);
let OPTIC_OPTIONS = '';
function fillEditorSelects() {
  F('f_cam').innerHTML = CAMERAS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  // ottiche raggruppate per marca (in ordine alfabetico), "Personalizzato" in fondo
  const brandOf = (n) => (n.match(/^(William Optics|Sky-Watcher|Explore Scientific|TS-Optics|TS-Photon|GSO \/ TS|Obiettivo)/) || [n.split(' ')[0]])[0].replace(/^TS-Photon|^GSO \/ TS/, 'TS-Optics');
  const groups = new Map(); OPTICS.filter((c) => c.id !== 'custom').forEach((c) => { const b = brandOf(c.name); if (!groups.has(b)) groups.set(b, []); groups.get(b).push(c); });
  OPTIC_OPTIONS = [...groups.keys()].sort((a, b) => a.localeCompare(b)).map((b) => `<optgroup label="${esc(b === 'Obiettivo' ? tx('Obiettivi fotografici') : b)}">${groups.get(b).map((c) => `<option value="${c.id}">${esc(txName(c.name))}</option>`).join('')}</optgroup>`).join('') + `<option value="custom">${tx('Personalizzato')}</option>`;
  F('f_bortle').innerHTML = Object.keys(BORTLE_SQM).map((b) => `<option value="${b}">${b} · SQM ≈ ${it(BORTLE_SQM[b], 1)}</option>`).join('');
}
function bandTxt(f) {
  const C = { Ha: 656.3, OIII: 500.7, SII: 672.4 };
  if (f.kind === 'nb' || f.kind === 'multi') return f.bands.map(([lo, hi]) => { const c = (lo + hi) / 2; const k = Object.keys(C).find((x) => Math.abs(C[x] - c) < 12) || (c < 510 ? 'Hβ+OIII' : '?'); return `${k === 'Ha' ? 'Hα' : k} ${it(hi - lo, 1)} nm`; }).join(' · ');
  if (f.kind === 'lp') return tx('{n} bande · {w} nm utili', { n: f.bands.length, w: Math.round(f.bands.reduce((a, b) => a + b[1] - b[0], 0)) });
  return `${f.bands[0][0]}–${f.bands[0][1]} nm`;
}
function renderFilterPick() {
  const type = F('f_ctype').value, owned = new Set(ownedFilters(draft));
  const ok = FDB.filter((f) => (type === 'mono' ? f.for !== 'osc' : f.for !== 'mono'));
  const groups = {};
  ok.forEach((f) => { const g = f.kind === 'nb' ? `${f.series}` : f.kind === 'bb' ? (type === 'mono' ? tx('Banda larga (L, R, G, B)') : tx('Banda larga')) : f.kind === 'lp' ? tx('Anti-inquinamento a banda larga') : tx('Multibanda stretti'); (groups[g] = groups[g] || []).push(f); });
  F('filterPick').innerHTML = Object.entries(groups).map(([g, fs]) => `<div class="fgrp"><span class="lbl">${esc(g)}</span><div class="fpick">${fs.map((f) => `<label class="fbox" title="${esc(f.note || '')}"><input type="checkbox" data-fid="${f.id}" ${owned.has(f.id) ? 'checked' : ''}> ${esc(f.kind === 'nb' ? f.name.split(' ')[0] : fname(f))} <small>${esc(bandTxt(f))}</small>${f.approx ? `<small class="ap">${tx('stima')}</small>` : ''}${f.src ? ` <a href="${esc(f.src)}" target="_blank" rel="noopener" title="${tx('Fonte dei dati')}">↗</a>` : ''}</label>`).join('')}</div></div>`).join('');
}
/* ---------- telescopi del profilo, ognuno con i suoi accessori ---------- */
const KIND_LABEL = { newton: 'Newton', refr: 'rifrattore', sct: 'Schmidt-Cassegrain', rc: 'Ritchey-Chrétien', fixed: 'astrografo con correttore integrato', lens: 'obiettivo fotografico' };
function renderOptics() {
  const list = draft.optics;
  F('optics').innerHTML = list.map((o, i) => {
    const kind = opticKind(o), pres = presetsFor(o);
    const accs = (o.accessories || []).map((a, j) => { const fl = o.fl * (+a.fac || 1); return `<div class="acc"><input data-k="aname" data-j="${j}" value="${esc(a.name)}" aria-label="${tx('Nome accessorio')}"><input data-k="afac" data-j="${j}" type="number" step="0.01" min="0.3" max="4" value="${a.fac}" aria-label="${tx('Fattore')}"><span class="res">${Math.round(fl)} mm · f/${it(fl / o.ap, 1)}</span><button class="btn sm ghost" data-act="adel" data-j="${j}" type="button">${tx('Togli')}</button></div>`; }).join('');
    return `<div class="optic" data-oi="${i}">
      <div class="optic-head"><span class="lbl">${tx('Telescopio {n}', { n: i + 1 })}</span><span class="kind">${tx(KIND_LABEL[kind])}</span>${list.length > 1 ? `<button class="btn sm ghost" data-act="odel" type="button">${tx('Togli telescopio')}</button>` : ''}</div>
      <div class="grid">
        <label class="field w2"><span>${tx('Modello')}</span><select data-k="preset">${OPTIC_OPTIONS}</select></label>
        <label class="field w2"><span>${tx('Nome')}</span><input data-k="name" value="${esc(o.name)}" maxlength="60"></label>
        <label class="field"><span>${tx('Apertura (mm)')}</span><input data-k="ap" type="number" min="10" step="1" value="${o.ap}"></label>
        <label class="field"><span>${tx('Focale nativa (mm)')}</span><input data-k="fl" type="number" min="10" step="1" value="${o.fl}"></label>
        <label class="field"><span>${tx('Ostruzione (% diametro)')}</span><input data-k="obs" type="number" min="0" max="60" step="1" value="${o.obs || 0}"></label>
        <div class="field"><span>${tx('Nativo')}</span><div class="res">${Math.round(o.fl)} mm · f/${it(o.fl / o.ap, 1)}</div></div>
        <label class="field w2" title="${tx('La posa oltre cui le stelle saturano con questo telescopio senza accessori, in banda larga. Con riduttori e Barlow si scala da sola.')}"><span>${tx('Posa più lunga in banda larga (s)')}</span><input data-k="subMax" type="number" min="5" max="1800" step="5" value="${+o.subMax > 0 ? o.subMax : ''}" placeholder="${tx('automatica')}"></label>
      </div>
      <label class="chk"><input type="checkbox" data-k="native" ${o.useNative !== false ? 'checked' : ''}> ${tx('Uso anche questo telescopio senza accessori')}</label>
      <div class="accs">${accs || `<p class="hint" style="margin:0">${tx('Nessun accessorio: si usa solo l’ottica nativa.')}</p>`}</div>
      ${kind === 'fixed' ? `<p class="hint" style="margin:0">${tx('Ha già il correttore integrato: niente correttori esterni.')}</p>` : ''}
      <div class="hzbar"><select class="sel" data-k="accPreset">${pres.map((x) => `<option value="${ACCESSORY_PRESETS.indexOf(x)}">${esc(txName(x[0]))}</option>`).join('')}<option value="custom">${tx('Personalizzato…')}</option></select><button class="btn sm" data-act="aadd" type="button">${tx('Aggiungi accessorio')}</button></div>
    </div>`;
  }).join('');
  list.forEach((o, i) => { const sel = F('optics').querySelector(`.optic[data-oi="${i}"] select[data-k="preset"]`); sel.value = OPTICS.some((c) => c.id === o.preset) ? o.preset : 'custom'; });
}
function wireOptics() {
  const box = F('optics'), at = (e) => { const el = e.target.closest('.optic'); return el ? draft.optics[+el.dataset.oi] : null; };
  const res = (el, o, fac) => { const r = el.parentElement.querySelector('.res'); const fl = o.fl * fac; if (r) r.textContent = `${Math.round(fl)} mm · f/${it(fl / o.ap, 1)}`; };
  box.addEventListener('input', (e) => {
    const o = at(e), k = e.target.dataset.k; if (!o || !k) return;
    if (k === 'name') o.name = e.target.value;
    else if (k === 'ap' || k === 'fl' || k === 'obs') { const v = parseFloat(e.target.value); if (isFinite(v)) o[k] = v; o.preset = 'custom'; const sel = e.target.closest('.optic').querySelector('select[data-k="preset"]'); if (sel) sel.value = 'custom'; }
    else if (k === 'subMax') { const v = parseFloat(e.target.value); if (isFinite(v) && v > 0) o.subMax = Math.round(v); else delete o.subMax; }
    else if (k === 'aname') o.accessories[+e.target.dataset.j].name = e.target.value;
    else if (k === 'afac') { const a = o.accessories[+e.target.dataset.j]; a.fac = parseFloat(e.target.value) || 1; res(e.target, o, a.fac); }
  });
  box.addEventListener('change', (e) => {
    const o = at(e), k = e.target.dataset.k; if (!o || !k) return;
    if (k === 'preset') {
      const c = OPTICS.find((x) => x.id === e.target.value); o.preset = e.target.value;
      if (c && c.id !== 'custom') {
        Object.assign(o, { name: txName(c.name), ap: c.ap, fl: c.fl, obs: c.obs });
        // gli accessori del modello precedente probabilmente non ci vanno: si ripartono da quelli del nuovo
        o.accessories = (c.acc || []).map(([nm, f]) => ({ id: accId(), name: txName(nm), fac: f }));
      }
      renderOptics();
    } else if (k === 'native') o.useNative = e.target.checked;
    else if (k === 'ap' || k === 'fl' || k === 'obs') renderOptics();
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return; const o = at(e); if (!o) return;
    if (b.dataset.act === 'odel') { draft.optics = draft.optics.filter((x) => x !== o); renderOptics(); }
    else if (b.dataset.act === 'adel') { o.accessories.splice(+b.dataset.j, 1); renderOptics(); }
    else if (b.dataset.act === 'aadd') { const v = b.parentElement.querySelector('select').value; const [nm, f] = v === 'custom' ? [tx('Accessorio'), 1] : ACCESSORY_PRESETS[+v]; o.accessories.push({ id: accId(), name: txName(nm), fac: f }); renderOptics(); }
    edDirty = true;
  });
  F('opticAdd').onclick = () => { draft.optics.push({ id: 'o' + Date.now().toString(36), preset: 'custom', name: tx('Nuovo telescopio'), ap: 80, fl: 480, obs: 0, useNative: true, accessories: [] }); renderOptics(); edDirty = true; F('optics').lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
}
/* Un solo pannello per due cose: il profilo (attrezzatura e sessione) e il luogo (cielo, mappa, orizzonte, altezza minima) */
let edMode = 'prof';
function showEditor(asNew) {
  F('editor').dataset.mode = edMode;
  F('edSave').textContent = tx(edMode === 'loc' ? 'Salva luogo' : 'Salva profilo');
  F('delConfirm').hidden = true; F('leaveConfirm').hidden = true;
  if (F('editor').hidden) backPush(editorBack);
  F('editor').hidden = false; edDirty = !!asNew;
  F('editor').querySelector('.sheet-body').scrollTop = 0;
}
function openEditor(id, asNew) {
  edMode = 'prof';
  const src = id ? state.profiles.find((p) => p.id === id) : null;
  draft = stripSite(migrateProfile(clone(src || activeProfile())));
  if (asNew) { draft.id = 'p-' + Date.now().toString(36); draft.name = draft.name.replace(/ \((copia|copy)\)$/, '') + ' (' + tx('copia') + ')'; delete draft.unsaved; }
  F('edTitle').textContent = asNew ? tx('Nuovo profilo') : tx('Profilo');
  const d = draft;
  F('f_name').value = d.name; F('f_cam').value = CAMERAS.some((c) => c.id === d.camera.preset) ? d.camera.preset : 'custom'; F('f_ctype').value = d.camera.type; F('f_bin').value = String(d.bin || 1);
  F('f_cw').value = d.camera.w; F('f_ch').value = d.camera.h; F('f_pix').value = d.camera.pix; F('f_qe').value = d.camera.qe; F('f_rn').value = d.camera.rn;
  F('f_thr').value = String(d.session.sunThr); F('f_from').value = d.session.from || ''; F('f_to').value = d.session.to || ''; F('f_quality').value = d.session.quality || 'good'; F('f_moon').value = d.session.moon === 'dark' ? 'dark' : 'any';
  F('edDelete').hidden = !!asNew || !!(src && src.unsaved);
  renderOptics(); renderFilterPick();
  showEditor(asNew); F('f_name').focus();
}
/* nuovo luogo: si parte dal punto attuale, da spostare con la ricerca o sulla mappa; cielo e orizzonte arrivano da soli */
function newLocDraft() {
  const c = activeLoc();
  return { id: locId(), site: { name: tx('Nuovo luogo'), lat: c.site.lat, lon: c.site.lon, bortle: c.site.bortle, sqm: c.site.sqm }, horizon: [], hzSrc: 'none', minAlt: c.minAlt };
}
function openLocEditor(id, asNew) {
  edMode = 'loc';
  const src = id ? state.locs.find((l) => l.id === id) : null;
  draft = asNew ? newLocDraft() : migrateLoc(clone(src || activeLoc()));
  F('edTitle').textContent = asNew ? tx('Nuovo luogo') : tx('Luogo');
  const d = draft;
  F('f_site').value = d.site.name; F('f_lat').value = d.site.lat; F('f_lon').value = d.site.lon; F('f_bortle').value = String(d.site.bortle || sqmToBortle(d.site.sqm)); F('f_sqm').value = d.site.sqm;
  F('f_elev').value = d.site.elev != null ? d.site.elev : ''; F('f_minalt').value = d.minAlt;
  F('edDelete').hidden = !!asNew || !!(src && src.unsaved);
  F('hzPaste').hidden = true; F('hzMsg').textContent = ''; F('skyImp').hidden = true; F('skyMsg').textContent = asNew ? tx('Cerca il luogo o clicca sulla mappa: atlante, mappa all-sky, altitudine e orizzonte arrivano da soli.') : '';
  F('lpBtn').hidden = !(window.cielo && window.cielo.lpLookup);
  lpStatus(); drawHz(); drawLpPreview(F('lpSky'), d.site, d.horizon);
  showEditor(asNew);
  initGeoMap();
  // centratura dopo il layout: legge i campi (nel frattempo il punto potrebbe essere già cambiato)
  if (geoMap) requestAnimationFrame(() => { const la = +F('f_lat').value, lo = +F('f_lon').value; geoMap.invalidateSize(); geoPin.setLatLng([la, lo]); geoMap.setView([la, lo], asNew ? 8 : d.site.example && la === d.site.lat ? 6 : Math.max(geoMap.getZoom(), 12)); });
  (asNew && DESK_GEO() ? F('geoQ') : F('f_site')).focus();
}
function closeEditor(fromPop) { if (F('editor').hidden) return; F('editor').hidden = true; F('leaveConfirm').hidden = true; draft = null; edDirty = false; if (fromPop !== true) backDone(editorBack); }
/* tasto indietro: con modifiche non salvate si resta e si chiede cosa fare */
function editorBack(fromPop) { if (fromPop !== true) return; if (edDirty) { backPush(editorBack); F('leaveConfirm').hidden = false; F('leaveNo').focus(); return; } closeEditor(true); }
/* chiusura richiesta dall'utente (Chiudi, Esc): con modifiche non salvate si chiede prima cosa fare */
let edDirty = false;
function askCloseEditor() {
  if (!edDirty) { closeEditor(); return; }
  F('leaveConfirm').hidden = false; F('leaveNo').focus();
}
function readForm() { return edMode === 'loc' ? readLocForm() : readProfForm(); }
function readProfForm() {
  const d = draft, n = (id) => parseFloat(F(id).value);
  d.name = F('f_name').value.trim() || tx('Profilo senza nome');
  d.camera = { preset: F('f_cam').value, name: (CAMERAS.find((c) => c.id === F('f_cam').value) || {}).name || tx('Personalizzata'), w: n('f_cw') || 4000, h: n('f_ch') || 3000, pix: n('f_pix') || 3.76, type: F('f_ctype').value, qe: n('f_qe') || 70, rn: n('f_rn') || 2 };
  d.bin = +F('f_bin').value || 1;
  d.optics = (d.optics || []).map((o) => ({ ...o, name: String(o.name || '').trim() || 'Telescopio', ap: +o.ap > 0 ? +o.ap : 60, fl: +o.fl > 0 ? +o.fl : 300, obs: clamp(+o.obs || 0, 0, 60), accessories: (o.accessories || []).map((a) => ({ ...a, fac: +a.fac > 0 ? +a.fac : 1 })) }));
  if (!d.optics.length) d.optics = [{ id: 'o1', preset: 'custom', name: tx('Telescopio'), ap: 80, fl: 480, obs: 0, useNative: true, accessories: [] }];
  const owned = $$('#filterPick input[data-fid]').filter((x) => x.checked).map((x) => x.dataset.fid);
  const type = d.camera.type; d.filters = { owned: owned.filter((id) => { const f = FDB_BY_ID.get(id); return f && (type === 'mono' ? f.for !== 'osc' : f.for !== 'mono'); }) };
  // l'altezza minima ora sta nel luogo; nel profilo resta quella di prima per le versioni vecchie
  d.session = { minAlt: d.session && isFinite(+d.session.minAlt) ? +d.session.minAlt : 25, sunThr: +F('f_thr').value, from: F('f_from').value, to: F('f_to').value, quality: F('f_quality').value, moon: F('f_moon').value };
  return d;
}
function readLocForm() {
  const d = draft, n = (id) => parseFloat(F(id).value);
  const sqm = n('f_sqm'), lat = n('f_lat'), lon = n('f_lon'), prev = d.site;
  d.site = { name: F('f_site').value.trim() || tx('Il mio terrazzo'), lat: isFinite(lat) ? clamp(lat, -89.9, 89.9) : 45, lon: isFinite(lon) ? clamp(lon, -180, 180) : 9, bortle: +F('f_bortle').value, sqm: isFinite(sqm) ? clamp(sqm, 16, 22.2) : BORTLE_SQM[F('f_bortle').value] };
  if (prev.example && prev.lat === d.site.lat && prev.lon === d.site.lon && prev.name === d.site.name) d.site.example = true;
  const elev = n('f_elev'); if (isFinite(elev)) d.site.elev = Math.round(elev);
  // dati della luce: validi solo per le coordinate con cui sono stati ottenuti (entro ~1 km)
  const near = (at) => at && Math.abs(at[0] - d.site.lat) < 0.01 && Math.abs(at[1] - d.site.lon) < 0.01;
  if ((prev.lpGrid || prev.lpAz) && near(prev.lpAt)) {
    Object.assign(d.site, { lpGrid: prev.lpGrid, lpAz: prev.lpAz, lpAt: prev.lpAt, lpZen: prev.lpZen, lpSrcAtlas: prev.lpSrcAtlas });
    d.site.lpSrc = Math.abs(d.site.sqm - prev.lpZen) < 0.01 ? prev.lpSrcAtlas : tx('SQM inserito, forma dall’atlante');
  }
  if (prev.skyMap && near(prev.skyMap.at)) {
    d.site.skyMap = prev.skyMap;
    d.site.lpSrc = Math.abs(d.site.sqm - prev.skyMap.zenith) < 0.01 ? 'Mappa all-sky di lightpollutionmap' : tx('Mappa all-sky, zenit corretto a mano');
  } else if (prev.skyMap && d.hzSrc === 'map') { d.horizon = []; d.hzSrc = 'none'; } // il terreno era quello di un altro punto
  d.minAlt = clamp(n('f_minalt') || 0, 0, 80);
  return d;
}
/* SQM e direzioni delle luci dall'atlante di Lorenz (solo nell'app desktop: il download lo fa il processo principale) */
function lpStatus(txt) {
  const s = draft && draft.site; if (!s) return;
  F('skyRemove').hidden = !s.skyMap;
  if (!txt && s.skyMap) { F('lpMsg').textContent = tx('In uso la mappa all-sky importata ({f}, {d}): zenit {z}.', { f: s.skyMap.file || 'lightpollutionmap', d: s.skyMap.date || '', z: it(s.skyMap.zenith, 2) }); return; }
  F('lpMsg').textContent = txt || (s.lpZen != null ? `${tx(s.lpSrcAtlas || 'Atlante')}: ${tx('zenit')} ${it(s.lpZen, 2)} (Bortle ${sqmToBortle(s.lpZen)})${Math.abs(s.sqm - s.lpZen) >= 0.01 ? ' · ' + tx('in uso il tuo {v}', { v: it(s.sqm, 2) }) : ''}` : tx(window.cielo && window.cielo.lpLookup ? 'Non ancora calcolato per queste coordinate.' : 'Disponibile nell’app desktop: qui inserisci l’SQM a mano.'));
}
let lpTimer = null;
async function lpFetch() {
  if (!(window.cielo && window.cielo.lpLookup)) return;
  const lat = parseFloat(F('f_lat').value), lon = parseFloat(F('f_lon').value);
  if (!isFinite(lat) || !isFinite(lon)) return;
  lpStatus(tx('Scarico l’atlante per queste coordinate…'));
  const r = await window.cielo.lpLookup(lat, lon);
  if (!draft) return;
  if (!r || r.error) { lpStatus(tx('Atlante non raggiungibile (sei offline?): inserisci l’SQM a mano.')); return; }
  readForm();
  Object.assign(draft.site, { lpZen: r.sqm, lpGrid: r.lpGrid, lpAz: null, lpAt: [lat, lon], lpSrcAtlas: r.src });
  delete draft.site.example;
  if (!draft.site.skyMap) { // una mappa all-sky importata ha la precedenza sulla stima
    Object.assign(draft.site, { sqm: r.sqm, lpSrc: r.src, bortle: sqmToBortle(r.sqm) });
    F('f_sqm').value = r.sqm; F('f_bortle').value = String(sqmToBortle(r.sqm));
  }
  lpStatus(); drawHz(); drawLpPreview(F('lpSky'), draft.site, draft.horizon);
}
/* ============================ mappa all-sky di lightpollutionmap (importata) ============================ */
let skyImport = null;
function lpmUrl() { // apre lightpollutionmap sul punto del profilo, livello "Sky brightness" dell'anno corrente
  const lat = +F('f_lat').value, lon = +F('f_lon').value;
  return `https://www.lightpollutionmap.info/#zoom=14.00&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}
async function skyFileChosen(file) {
  if (!file) return;
  try {
    const img = await AllSky.load(file), det = AllSky.detect(img);
    skyImport = { det, name: file.name };
    // ritaglio della barra colori, così i due valori si leggono accanto ai campi
    const cv = F('skyBar'), { x, w, yt, yb } = det.bar, sc = 150 / (yb - yt);
    cv.width = Math.max(1, Math.round(w * sc)); cv.height = 150; const c = cv.getContext('2d');
    c.drawImage(img, x, yt, w, yb - yt, 0, 0, cv.width, cv.height);
    F('skyImp').hidden = false; F('skyTop').focus();
    // proposta dei due valori: tacche regolari della barra più l'SQM del luogo; vanno solo confermati
    const as = AllSky.autoScale(det, parseFloat(String(F('f_sqm').value).replace(',', '.')));
    if (as) { F('skyTop').value = it(as.top, 2); F('skyBot').value = it(as.bottom, 2); }
    F('skyMsg').textContent = tx(det.kind === 'fisheye' ? 'Mappa all-sky (fisheye) riconosciuta.' : 'Panoramica riconosciuta.') + ' ' + tx(as ? 'Controlla i due valori proposti con quelli stampati ai capi della barra colori e premi Importa la mappa.' : 'Scrivi i due numeri stampati ai capi della barra colori.');
  } catch (e) { F('skyImp').hidden = true; toast(tx('Immagine non riconosciuta: {e}', { e: e.message })); }
}
function skyApply() {
  if (!skyImport || !draft) return;
  const top = parseFloat(F('skyTop').value.replace(',', '.')), bot = parseFloat(F('skyBot').value.replace(',', '.'));
  if (!isFinite(top) || !isFinite(bot) || top <= bot) { F('skyMsg').textContent = tx('Servono i due valori della barra: quello in alto (cielo più buio) è il più grande, es. 19,3 e 17,9.'); return; }
  readForm(); applySkyMap(skyImport.det, top, bot, skyImport.name);
  F('skyMsg').textContent = tx('Mappa importata da {f} alle {t}: barra {a} → {b}, zenit {z}. Ricordati di salvare il profilo.', { f: skyImport.name, t: fmtT(Date.now()), a: it(top, 2), b: it(bot, 2), z: it(draft.site.skyMap.zenith, 2) });
  F('skyImp').hidden = true; skyImport = null;
}
/* griglia di luminosità dal lettore → profilo (SQM, mappa del cielo, orizzonte minimo dal terreno) */
function applySkyMap(det, top, bot, name, year) {
  const g = AllSky.build(det, top, bot), terr = AllSky.terrain(det);
  draft.site.skyMap = { ...g, terr, at: [draft.site.lat, draft.site.lon], file: name, year: year || null, date: new Date().toISOString().slice(0, 10) };
  Object.assign(draft.site, { sqm: g.zenith, lpSrc: 'Mappa all-sky di lightpollutionmap', bortle: sqmToBortle(g.zenith) });
  F('f_sqm').value = g.zenith; F('f_bortle').value = String(sqmToBortle(g.zenith));
  if (F('skyTerr').checked) {
    // orizzonte tuo (disegnato o importato): il terreno lo alza soltanto dove è più alto; altrimenti è la sagoma della mappa
    if (draft.hzSrc === 'user') { const cur = horizonLUT(draft.horizon); draft.horizon = terr.map(([az, alt]) => [az, Math.round(Math.max(alt, cur[az]) * 10) / 10]); }
    else { draft.horizon = terr.map((q) => q.slice()); draft.hzSrc = 'map'; }
    drawHz();
  }
  drawLpPreview(F('lpSky'), draft.site, draft.horizon); lpStatus();
  toast(tx('Mappa all-sky: zenit {z} mag/″²', { z: it(g.zenith, 2) }));
}
/* automatico: fa sul sito quello che faresti tu (punto, All-sky) e legge l'immagine generata */
let lpmBusy = false;
async function lpmFetch() {
  if (!(window.cielo && window.cielo.lpmAllSky) || lpmBusy || !draft) return;
  const lat = parseFloat(F('f_lat').value), lon = parseFloat(F('f_lon').value);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const sm = draft.site.skyMap; if (sm && sm.at && Math.abs(sm.at[0] - lat) < 0.002 && Math.abs(sm.at[1] - lon) < 0.002) return; // già fatta qui
  lpmBusy = true; F('skyMsg').textContent = tx('Chiedo a lightpollutionmap la mappa all-sky di questo punto (10–20 s)…');
  const btn = F('lpmBtn'), label = btn.textContent; btn.disabled = true; btn.textContent = tx('Scarico la mappa…');
  try {
    const r = await window.cielo.lpmAllSky(lat, lon);
    if (!draft) return;
    if (!r || r.error || !r.images || !r.images.length) throw new Error(r && r.error || tx('nessuna immagine'));
    if (!(Math.abs(+F('f_lat').value - lat) < 1e-6 && Math.abs(+F('f_lon').value - lon) < 1e-6)) return; // nel frattempo il punto è cambiato
    let done = false;
    for (const url of [r.images[1], r.images[0]].filter(Boolean)) { // prima la panoramica, poi la fisheye
      const det = AllSky.detect(await AllSky.fromDataUrl(url)), sc = r.nelm ? null : AllSky.autoScale(det, r.sqm);
      if (!sc) continue;
      readForm(); applySkyMap(det, sc.top, sc.bottom, `lightpollutionmap ${r.year}`, r.year);
      if (isFinite(r.elev) && !F('f_elev').value) F('f_elev').value = Math.round(r.elev);
      F('skyMsg').textContent = tx('Mappa all-sky {y} di lightpollutionmap aggiornata alle {t}: barra {a} → {b}, zenit {z}. Ricordati di salvare il profilo.', { y: r.year, t: fmtT(Date.now()), a: it(sc.top, 2), b: it(sc.bottom, 2), z: it(r.sqm, 2) });
      done = true; break;
    }
    if (!done) { // scala non ricavabile: si chiede di leggere i due valori della barra
      const det = AllSky.detect(await AllSky.fromDataUrl(r.images[1] || r.images[0])); skyImport = { det, name: `lightpollutionmap ${r.year}` };
      const cv = F('skyBar'), { x, w, yt, yb } = det.bar; cv.width = Math.max(1, Math.round(w * 150 / (yb - yt))); cv.height = 150;
      cv.getContext('2d').drawImage(await AllSky.fromDataUrl(r.images[1] || r.images[0]), x, yt, w, yb - yt, 0, 0, cv.width, 150);
      F('skyImp').hidden = false; F('skyMsg').textContent = tx('Immagine scaricata, ma la scala non si ricava da sola: scrivi i due valori ai capi della barra.');
    }
  } catch (e) {
    F('skyMsg').textContent = tx('Mappa all-sky non ottenuta ({e}). Puoi importarla a mano coi passi qui sopra.', { e: e.message });
  } finally { lpmBusy = false; btn.disabled = false; btn.textContent = label; }
}
function skyRemove() { if (!draft) return; readForm(); delete draft.site.skyMap; if (draft.site.lpZen != null) { draft.site.sqm = draft.site.lpZen; F('f_sqm').value = draft.site.lpZen; } draft.site.lpSrc = draft.site.lpSrcAtlas || ''; drawLpPreview(F('lpSky'), draft.site, draft.horizon); lpStatus(); }
/* ============================ luogo: mappa, ricerca, altitudine ============================ */
let geoMap = null, geoPin = null, geoTimer = null, elevTimer = null;
const DESK_GEO = () => !!(window.cielo && window.cielo.geoSearch);
function initGeoMap() {
  if (geoMap || !window.L) return;
  geoMap = L.map('geoMap', { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([42, 12.5], 6);
  // tile standard di OpenStreetMap (l'app si identifica con uno User-Agent proprio, come chiede la loro policy), scurite via CSS
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, className: 'basemap', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(geoMap);
  L.tileLayer('https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png', { maxNativeZoom: 8, maxZoom: 18, opacity: 0.55, attribution: tx('Inquinamento luminoso 2025') + ' © David Lorenz' }).addTo(geoMap);
  geoPin = L.marker([42, 12.5], { draggable: true, keyboard: true, title: tx('Il tuo punto di osservazione') }).addTo(geoMap);
  geoPin.on('dragend', () => { const p = geoPin.getLatLng(); setGeo(p.lat, p.lng); });
  geoMap.on('click', (e) => setGeo(e.latlng.lat, e.latlng.lng));
}
/* nuovo punto: aggiorna campi, spillo, altitudine e atlante */
function setGeo(lat, lon, name, zoom) {
  lat = Math.round(lat * 1e5) / 1e5; lon = Math.round((((lon + 540) % 360) - 180) * 1e5) / 1e5;
  F('f_lat').value = lat; F('f_lon').value = lon;
  if (name) F('f_site').value = name;
  if (geoPin) { geoPin.setLatLng([lat, lon]); if (zoom) geoMap.setView([lat, lon], zoom); }
  clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpFetch(); lpmFetch(); }, 600);
  if (window.cielo && window.cielo.elevation) { clearTimeout(elevTimer); elevTimer = setTimeout(async () => { const h = await window.cielo.elevation(lat, lon); if (h != null && draft) F('f_elev').value = h; }, 300); }
}
async function geoSearch(q) {
  const list = F('geoList');
  if (!DESK_GEO() || q.trim().length < 3) { list.hidden = true; return; }
  const res = await window.cielo.geoSearch(q.trim());
  if (!draft || F('geoQ').value !== q) return;
  if (!Array.isArray(res) || !res.length) { list.innerHTML = `<button disabled>${tx(res && res.error ? 'Ricerca non disponibile (sei offline?)' : 'Nessun luogo trovato')}</button>`; list.hidden = false; return; }
  list.innerHTML = res.map((r, i) => `<button data-i="${i}">${esc(r.name)}<small>${esc(r.detail)}</small></button>`).join('');
  list.hidden = false;
  list.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const r = res[+b.dataset.i]; list.hidden = true; F('geoQ').value = ''; setGeo(r.lat, r.lon, r.name, 13); };
}
function wireGeo() {
  F('geoQ').addEventListener('input', (e) => { clearTimeout(geoTimer); geoTimer = setTimeout(() => geoSearch(e.target.value), 350); });
  F('geoQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = F('geoList').querySelector('[data-i]'); if (b) b.click(); } if (e.key === 'Escape') F('geoList').hidden = true; });
  if (!DESK_GEO()) { F('geoQ').disabled = true; F('geoQ').placeholder = tx('Ricerca dei luoghi disponibile nell’app desktop'); }
}
function lpRedraw() { if (!draft) return; readForm(); drawLpPreview(F('lpSky'), draft.site, draft.horizon); lpStatus(); }
function wireEditor() {
  fillEditorSelects();
  F('f_cam').onchange = () => { const c = CAMERAS.find((x) => x.id === F('f_cam').value); if (c && c.id !== 'custom') { F('f_cw').value = c.w; F('f_ch').value = c.h; F('f_pix').value = c.pix; F('f_ctype').value = c.type; F('f_qe').value = c.qe; F('f_rn').value = c.rn; readForm(); renderFilterPick(); } };
  F('f_ctype').onchange = () => { readForm(); renderFilterPick(); };
  ['f_cw', 'f_ch', 'f_pix', 'f_qe', 'f_rn'].forEach((id) => F(id).addEventListener('input', () => { F('f_cam').value = 'custom'; }));
  wireOptics();
  F('f_minalt').addEventListener('input', drawHz);
  F('f_bortle').onchange = () => { F('f_sqm').value = BORTLE_SQM[F('f_bortle').value]; lpRedraw(); };
  F('f_sqm').addEventListener('input', () => { const s = parseFloat(F('f_sqm').value); if (isFinite(s)) F('f_bortle').value = String(sqmToBortle(s)); lpRedraw(); });
  ['f_lat', 'f_lon'].forEach((id) => F(id).addEventListener('change', () => { const la = parseFloat(F('f_lat').value), lo = parseFloat(F('f_lon').value); if (isFinite(la) && isFinite(lo)) setGeo(la, lo, null, geoMap ? geoMap.getZoom() : 0); }));
  F('lpBtn').onclick = lpFetch;
  F('lpmOpen').onclick = (e) => { e.currentTarget.href = lpmUrl(); };
  F('skyFile').onchange = (e) => { skyFileChosen(e.target.files[0]); e.target.value = ''; };
  const dz = F('skyDrop');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => skyFileChosen(e.dataTransfer.files[0]));
  F('skyApply').onclick = skyApply; F('skyRemove').onclick = skyRemove;
  F('lpmBtn').onclick = () => { if (draft && draft.site.skyMap) delete draft.site.skyMap.at; lpmFetch(); };
  F('lpmBtn').hidden = !(window.cielo && window.cielo.lpmAllSky);
  [F('skyTop'), F('skyBot')].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); skyApply(); } }));
  wireGeo();
  // un clic fuori dal pannello non chiude più nulla: si esce solo con Chiudi, Esc o Salva
  F('edClose').onclick = () => askCloseEditor();
  ['input', 'change'].forEach((ev) => F('editor').addEventListener(ev, () => { edDirty = true; }));
  F('editor').querySelector('.sheet-body, .sheet > div, form')?.addEventListener('pointerdown', () => { edDirty = true; });
  F('leaveNo').onclick = () => { F('leaveConfirm').hidden = true; };
  F('leaveYes').onclick = () => closeEditor();
  F('leaveSave').onclick = () => F('edSave').click();
  F('edSave').onclick = () => {
    const d = readForm(), loc = edMode === 'loc';
    if (loc) { persistLoc(d); state.locId = d.id; } else { persistProfile(d); state.activeId = d.id; }
    saveStore(); closeEditor(); refresh(true); toast(tx(loc ? 'Luogo salvato' : 'Profilo salvato'));
  };
  F('edDup').onclick = () => {
    readForm(); draft = clone(draft); delete draft.unsaved; edDirty = true;
    if (edMode === 'loc') { draft.id = locId(); draft.site.name += ' (' + tx('copia') + ')'; delete draft.site.example; F('f_site').value = draft.site.name; F('edTitle').textContent = tx('Nuovo luogo'); }
    else { draft.id = 'p-' + Date.now().toString(36); draft.name += ' (' + tx('copia') + ')'; F('f_name').value = draft.name; F('edTitle').textContent = tx('Nuovo profilo'); }
    F('edDelete').hidden = true;
  };
  F('edDelete').onclick = () => { F('delConfirm').hidden = false; F('edDelete').hidden = true; };
  F('delNo').onclick = () => { F('delConfirm').hidden = true; F('edDelete').hidden = false; };
  F('delYes').onclick = () => { const id = draft.id, loc = edMode === 'loc'; closeEditor(); if (loc) removeLoc(id); else removeProfile(id); refresh(true); toast(tx(loc ? 'Luogo eliminato' : 'Profilo eliminato')); };

  // orizzonte
  const svg = F('hzSvg'); let down = false;
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('pointerdown', (e) => { const q = hzPoint(e); if (e.shiftKey || e.button === 2) { hzDel(q.az); drawHz(); return; } down = true; svg.setPointerCapture(e.pointerId); hzSet(q.az, q.alt); drawHz(); });
  svg.addEventListener('pointermove', (e) => { if (!down) return; const q = hzPoint(e); hzSet(q.az, q.alt); drawHz(); });
  ['pointerup', 'pointercancel'].forEach((ev) => svg.addEventListener(ev, () => (down = false)));
  F('hzFlat').onclick = () => { draft.horizon = []; draft.hzSrc = 'none'; drawHz(); };
  F('hzUseMap').onclick = () => { const t = draft.site.skyMap && draft.site.skyMap.terr; if (!t) return; draft.horizon = t.map((q) => q.slice()); draft.hzSrc = 'map'; edDirty = true; drawHz(); };
  F('hzPasteBtn').onclick = () => { F('hzPaste').hidden = !F('hzPaste').hidden; if (!F('hzPaste').hidden) { F('hzText').value = (draft.horizon || []).map((p) => p[0] + ' ' + p[1]).join('\n'); F('hzText').focus(); } };
  F('hzApply').onclick = () => { const pts = parseHorizon(F('hzText').value); if (!pts.length) { F('hzMsg').textContent = tx('Nessun punto valido: servono righe “azimut altezza”.'); return; } draft.horizon = pts; draft.hzSrc = 'user'; drawHz(); F('hzMsg').textContent = tx('{n} punti importati.', { n: pts.length }); };
  F('hzFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const pts = parseHorizon(rd.result); if (!pts.length) { toast(tx('Il file non contiene righe “azimut altezza” valide.')); return; } draft.horizon = pts; draft.hzSrc = 'user'; drawHz(); toast(tx('{n} punti importati da {f}', { n: pts.length, f: f.name })); }; rd.readAsText(f); e.target.value = ''; };
  const hzText = () => (draft.horizon || []).slice().sort((a, b) => a[0] - b[0]).map((p) => `${p[0]} ${p[1]}`).join('\n');
  F('hzCopyNina').onclick = () => copyText(hzText());
  F('hzCopyStel').onclick = () => copyText(tx('# Orizzonte poligonale per Stellarium (polygonal_horizon_list): azimut altezza, gradi') + '\n' + hzText());
}
const HZ = { x0: 34, x1: 712, y0: 10, y1: 166, max: 75 };
const hx = (az) => HZ.x0 + az / 360 * (HZ.x1 - HZ.x0), hy = (alt) => HZ.y1 - clamp(alt, 0, HZ.max) / HZ.max * (HZ.y1 - HZ.y0);
function drawHz() {
  if (!draft) return; const pts = (draft.horizon || []).slice().sort((a, b) => a[0] - b[0]), lut = horizonLUT(pts);
  let s = ''; [15, 30, 45, 60, 75].forEach((a) => { s += `<line x1="${HZ.x0}" x2="${HZ.x1}" y1="${hy(a)}" y2="${hy(a)}" stroke="var(--line)" stroke-width=".7"/><text x="${HZ.x0 - 5}" y="${hy(a) + 4}" fill="var(--ink-3)" font-size="10" text-anchor="end" font-family="IBM Plex Mono">${a}°</text>`; });
  AZN.concat(['N']).forEach((l, i) => { const x = hx(i * 45); s += `<line x1="${x}" x2="${x}" y1="${HZ.y0}" y2="${HZ.y1}" stroke="var(--line)" stroke-width=".7"/><text x="${x}" y="${HZ.y1 + 18}" fill="var(--ink-2)" font-size="11" text-anchor="middle" font-family="Saira Condensed" font-weight="600">${l}</text>`; });
  let d = `M${HZ.x0},${HZ.y1}`; for (let a = 0; a <= 360; a++) d += `L${hx(a).toFixed(1)},${hy(lut[a]).toFixed(1)}`; d += `L${HZ.x1},${HZ.y1}Z`;
  s += `<path d="${d}" fill="rgba(228,87,75,.2)" stroke="var(--ha)" stroke-width="1.4"/>`;
  const ma = +F('f_minalt').value || 0; s += `<line x1="${HZ.x0}" x2="${HZ.x1}" y1="${hy(ma)}" y2="${hy(ma)}" stroke="var(--oiii)" stroke-dasharray="5 4" stroke-width="1.2"/>`;
  pts.forEach((p) => (s += `<circle cx="${hx(p[0]).toFixed(1)}" cy="${hy(p[1]).toFixed(1)}" r="3.4" fill="var(--ground)" stroke="var(--ha)" stroke-width="1.4"/>`));
  s += `<text x="${HZ.x0}" y="${HZ.y1 + 32}" fill="var(--ink-3)" font-size="10" font-family="IBM Plex Mono">${tx('{n} punti · azimut da nord verso est', { n: pts.length })}</text>`;
  F('hzSvg').innerHTML = s;
  // da dove viene l'orizzonte e cosa succede quando arriva una mappa all-sky nuova
  const terr = draft.site && draft.site.skyMap && draft.site.skyMap.terr;
  F('hzSrc').textContent = tx({
    map: 'Orizzonte preso dal terreno della mappa all-sky: si aggiorna da solo quando cambia la mappa. Se lo modifichi diventa tuo.',
    user: 'Orizzonte tuo (disegnato o importato): una nuova mappa all-sky non lo sostituisce, lo alza soltanto dove il terreno è più alto.',
    example: 'Orizzonte di esempio: disegnalo, importalo o prendi la mappa all-sky, che lo ricava dal terreno.',
    none: 'Nessun orizzonte: conta solo l’altezza minima. La mappa all-sky, se la prendi, lo ricava dal terreno.',
  }[draft.hzSrc] || '');
  F('hzUseMap').hidden = !(terr && draft.hzSrc !== 'map');
}
function hzPoint(e) { const svg = F('hzSvg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return { az: clamp((q.x - HZ.x0) / (HZ.x1 - HZ.x0) * 360, 0, 359.9), alt: clamp((HZ.y1 - q.y) / (HZ.y1 - HZ.y0) * HZ.max, 0, HZ.max) }; }
function hzSet(az, alt) { draft.hzSrc = 'user'; az = Math.round(az / 5) * 5 % 360; alt = Math.round(alt); const H = draft.horizon || (draft.horizon = []); const i = H.findIndex((p) => Math.abs(((p[0] - az + 540) % 360) - 180) < 2.5); if (i >= 0) H[i] = [az, alt]; else H.push([az, alt]); H.sort((a, b) => a[0] - b[0]); }
function hzDel(az) { const H = draft.horizon || []; if (!H.length) return; draft.hzSrc = 'user'; let bi = 0, bd = 999; H.forEach((p, i) => { const d = Math.abs(((p[0] - az + 540) % 360) - 180); if (d < bd) { bd = d; bi = i; } }); if (bd < 8) H.splice(bi, 1); }
