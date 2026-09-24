'use strict';
/* ============================ editor del profilo ============================ */
let draft = null;
const F = (id) => document.getElementById(id);
function fillEditorSelects() {
  F('f_cam').innerHTML = CAMERAS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  F('f_opt').innerHTML = OPTICS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  F('f_bortle').innerHTML = Object.keys(BORTLE_SQM).map((b) => `<option value="${b}">${b} · SQM ≈ ${it(BORTLE_SQM[b], 1)}</option>`).join('');
  F('accPreset').innerHTML = ACCESSORY_PRESETS.map(([n, f], i) => `<option value="${i}">${esc(n)}</option>`).join('') + '<option value="custom">Personalizzato…</option>';
}
function bandTxt(f) {
  const C = { Ha: 656.3, OIII: 500.7, SII: 672.4 };
  if (f.kind === 'nb' || f.kind === 'multi') return f.bands.map(([lo, hi]) => { const c = (lo + hi) / 2; const k = Object.keys(C).find((x) => Math.abs(C[x] - c) < 12) || (c < 510 ? 'Hβ+OIII' : '?'); return `${k === 'Ha' ? 'Hα' : k} ${it(hi - lo, 1)} nm`; }).join(' · ');
  if (f.kind === 'lp') return `${f.bands.length} bande · ${Math.round(f.bands.reduce((a, b) => a + b[1] - b[0], 0))} nm utili`;
  return `${f.bands[0][0]}–${f.bands[0][1]} nm`;
}
function renderFilterPick() {
  const type = F('f_ctype').value, owned = new Set(ownedFilters(draft));
  const ok = FDB.filter((f) => (type === 'mono' ? f.for !== 'osc' : f.for !== 'mono'));
  const groups = {};
  ok.forEach((f) => { const g = f.kind === 'nb' ? `${f.series}` : f.kind === 'bb' ? (type === 'mono' ? 'Banda larga (L, R, G, B)' : 'Banda larga') : f.kind === 'lp' ? 'Anti-inquinamento a banda larga' : 'Multibanda stretti'; (groups[g] = groups[g] || []).push(f); });
  F('filterPick').innerHTML = Object.entries(groups).map(([g, fs]) => `<div class="fgrp"><span class="lbl">${esc(g)}</span><div class="fpick">${fs.map((f) => `<label class="fbox" title="${esc(f.note || '')}"><input type="checkbox" data-fid="${f.id}" ${owned.has(f.id) ? 'checked' : ''}> ${esc(f.kind === 'nb' ? f.name.split(' ')[0] : fname(f))} <small>${esc(bandTxt(f))}</small>${f.approx ? '<small class="ap">stima</small>' : ''}${f.src ? ` <a href="${esc(f.src)}" target="_blank" rel="noopener" title="Fonte dei dati">↗</a>` : ''}</label>`).join('')}</div></div>`).join('');
}
function renderAccs() {
  const g0 = { ap: +F('f_ap').value || 60, fl: +F('f_fl').value || 300 };
  F('accs').innerHTML = (draft.accessories || []).map((a, i) => { const fl = g0.fl * (+a.fac || 1); return `<div class="acc"><input data-ai="${i}" data-k="name" value="${esc(a.name)}" aria-label="Nome accessorio"><input data-ai="${i}" data-k="fac" type="number" step="0.01" min="0.3" max="4" value="${a.fac}" aria-label="Fattore"><span class="res">${Math.round(fl)} mm · f/${it(fl / g0.ap, 1)}</span><button class="btn sm ghost" data-del="${i}">Togli</button></div>`; }).join('') || '<p class="hint" style="margin:0">Nessun accessorio: si usa solo l’ottica nativa.</p>';
}
function openEditor(id, asNew) {
  const src = id ? state.profiles.find((p) => p.id === id) : null;
  draft = migrateProfile(clone(src || active()));
  if (asNew) { draft.id = 'p-' + Date.now().toString(36); draft.name = draft.name.replace(/ \(copia\)$/, '') + ' (copia)'; delete draft.unsaved; }
  F('edTitle').textContent = asNew ? 'Nuovo profilo' : 'Profilo';
  const d = draft;
  F('f_name').value = d.name; F('f_cam').value = CAMERAS.some((c) => c.id === d.camera.preset) ? d.camera.preset : 'custom'; F('f_ctype').value = d.camera.type; F('f_bin').value = String(d.bin || 1);
  F('f_cw').value = d.camera.w; F('f_ch').value = d.camera.h; F('f_pix').value = d.camera.pix; F('f_qe').value = d.camera.qe; F('f_rn').value = d.camera.rn;
  F('f_opt').value = OPTICS.some((c) => c.id === d.optic.preset) ? d.optic.preset : 'custom'; F('f_ap').value = d.optic.ap; F('f_fl').value = d.optic.fl; F('f_obs').value = d.optic.obs || 0;
  F('f_native').checked = d.useNative !== false;
  F('f_site').value = d.site.name; F('f_lat').value = d.site.lat; F('f_lon').value = d.site.lon; F('f_bortle').value = String(d.site.bortle || sqmToBortle(d.site.sqm)); F('f_sqm').value = d.site.sqm;
  F('f_minalt').value = d.session.minAlt; F('f_thr').value = String(d.session.sunThr); F('f_from').value = d.session.from || ''; F('f_to').value = d.session.to || ''; F('f_quality').value = d.session.quality || 'good';
  F('delConfirm').hidden = true; F('edDelete').hidden = !!asNew; F('hzPaste').hidden = true; F('hzMsg').textContent = '';
  F('f_elev').value = d.site.elev != null ? d.site.elev : '';
  F('lpBtn').hidden = !(window.cielo && window.cielo.lpLookup);
  lpStatus(); renderAccs(); renderFilterPick(); drawHz(); drawLpPreview(F('lpSky'), d.site, d.horizon);
  F('editor').hidden = false;
  initGeoMap();
  // centratura dopo il layout: legge i campi (nel frattempo il punto potrebbe essere già cambiato)
  if (geoMap) requestAnimationFrame(() => { const la = +F('f_lat').value, lo = +F('f_lon').value; geoMap.invalidateSize(); geoPin.setLatLng([la, lo]); geoMap.setView([la, lo], d.site.example && la === d.site.lat ? 6 : Math.max(geoMap.getZoom(), 12)); });
  F('editor').hidden = false; F('f_name').focus();
}
function closeEditor() { F('editor').hidden = true; draft = null; }
function readForm() {
  const d = draft, n = (id) => parseFloat(F(id).value);
  d.name = F('f_name').value.trim() || 'Profilo senza nome';
  d.camera = { preset: F('f_cam').value, name: (CAMERAS.find((c) => c.id === F('f_cam').value) || {}).name || 'Personalizzata', w: n('f_cw') || 4000, h: n('f_ch') || 3000, pix: n('f_pix') || 3.76, type: F('f_ctype').value, qe: n('f_qe') || 70, rn: n('f_rn') || 2 };
  d.bin = +F('f_bin').value || 1;
  d.optic = { preset: F('f_opt').value, name: (OPTICS.find((c) => c.id === F('f_opt').value) || {}).name || 'Personalizzato', ap: n('f_ap') || 60, fl: n('f_fl') || 300, obs: n('f_obs') || 0 };
  d.useNative = F('f_native').checked;
  const owned = $$('#filterPick input[data-fid]').filter((x) => x.checked).map((x) => x.dataset.fid);
  const type = d.camera.type; d.filters = { owned: owned.filter((id) => { const f = FDB_BY_ID.get(id); return f && (type === 'mono' ? f.for !== 'osc' : f.for !== 'mono'); }) };
  const sqm = n('f_sqm'), lat = n('f_lat'), lon = n('f_lon'), prev = d.site;
  d.site = { name: F('f_site').value.trim() || 'Il mio terrazzo', lat: isFinite(lat) ? clamp(lat, -89.9, 89.9) : 45, lon: isFinite(lon) ? clamp(lon, -180, 180) : 9, bortle: +F('f_bortle').value, sqm: isFinite(sqm) ? clamp(sqm, 16, 22.2) : BORTLE_SQM[F('f_bortle').value] };
  if (prev.example && prev.lat === d.site.lat && prev.lon === d.site.lon && prev.name === d.site.name) d.site.example = true;
  const elev = n('f_elev'); if (isFinite(elev)) d.site.elev = Math.round(elev);
  // dati della luce: validi solo per le coordinate con cui sono stati ottenuti (entro ~1 km)
  const near = (at) => at && Math.abs(at[0] - d.site.lat) < 0.01 && Math.abs(at[1] - d.site.lon) < 0.01;
  if ((prev.lpGrid || prev.lpAz) && near(prev.lpAt)) {
    Object.assign(d.site, { lpGrid: prev.lpGrid, lpAz: prev.lpAz, lpAt: prev.lpAt, lpZen: prev.lpZen, lpSrcAtlas: prev.lpSrcAtlas });
    d.site.lpSrc = Math.abs(d.site.sqm - prev.lpZen) < 0.01 ? prev.lpSrcAtlas : 'SQM inserito, forma dall’atlante';
  }
  if (prev.skyMap && near(prev.skyMap.at)) {
    d.site.skyMap = prev.skyMap;
    d.site.lpSrc = Math.abs(d.site.sqm - prev.skyMap.zenith) < 0.01 ? 'Mappa all-sky di lightpollutionmap' : 'Mappa all-sky, zenit corretto a mano';
  }
  d.session = { minAlt: clamp(n('f_minalt') || 0, 0, 80), sunThr: +F('f_thr').value, from: F('f_from').value, to: F('f_to').value, quality: F('f_quality').value };
  return d;
}
/* SQM e direzioni delle luci dall'atlante di Lorenz (solo nell'app desktop: il download lo fa il processo principale) */
function lpStatus(txt) {
  const s = draft && draft.site; if (!s) return;
  F('skyRemove').hidden = !s.skyMap;
  if (!txt && s.skyMap) { F('lpMsg').textContent = `In uso la mappa all-sky importata (${s.skyMap.file || 'lightpollutionmap'}, ${s.skyMap.date || ''}): zenit ${it(s.skyMap.zenith, 2)}.`; return; }
  F('lpMsg').textContent = txt || (s.lpZen != null ? `${s.lpSrcAtlas || 'Atlante'}: zenit ${it(s.lpZen, 2)} (Bortle ${sqmToBortle(s.lpZen)})${Math.abs(s.sqm - s.lpZen) >= 0.01 ? ` · in uso il tuo ${it(s.sqm, 2)}` : ''}` : (window.cielo && window.cielo.lpLookup ? 'Non ancora calcolato per queste coordinate.' : 'Disponibile nell’app desktop: qui inserisci l’SQM a mano.'));
}
let lpTimer = null;
async function lpFetch() {
  if (!(window.cielo && window.cielo.lpLookup)) return;
  const lat = parseFloat(F('f_lat').value), lon = parseFloat(F('f_lon').value);
  if (!isFinite(lat) || !isFinite(lon)) return;
  lpStatus('Scarico l’atlante per queste coordinate…');
  const r = await window.cielo.lpLookup(lat, lon);
  if (!draft) return;
  if (!r || r.error) { lpStatus('Atlante non raggiungibile (sei offline?): inserisci l’SQM a mano.'); return; }
  readForm();
  Object.assign(draft.site, { lpZen: r.sqm, lpGrid: r.lpGrid, lpAz: null, lpAt: [lat, lon], lpSrcAtlas: r.src });
  delete draft.site.example;
  if (!draft.site.skyMap) { // una mappa all-sky importata ha la precedenza sulla stima
    Object.assign(draft.site, { sqm: r.sqm, lpSrc: r.src, bortle: sqmToBortle(r.sqm) });
    F('f_sqm').value = r.sqm; F('f_bortle').value = String(sqmToBortle(r.sqm));
  }
  lpStatus(); drawLpPreview(F('lpSky'), draft.site, draft.horizon);
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
    F('skyMsg').textContent = `${det.kind === 'fisheye' ? 'Mappa all-sky (fisheye)' : 'Panoramica'} riconosciuta. Scrivi i due numeri stampati ai capi della barra colori.`;
  } catch (e) { F('skyImp').hidden = true; toast('Immagine non riconosciuta: ' + e.message); }
}
function skyApply() {
  if (!skyImport || !draft) return;
  const top = parseFloat(F('skyTop').value.replace(',', '.')), bot = parseFloat(F('skyBot').value.replace(',', '.'));
  if (!isFinite(top) || !isFinite(bot) || top <= bot) { F('skyMsg').textContent = 'Servono i due valori della barra: quello in alto (cielo più buio) è il più grande, es. 19,3 e 17,9.'; return; }
  readForm(); applySkyMap(skyImport.det, top, bot, skyImport.name);
  F('skyImp').hidden = true; skyImport = null;
}
/* griglia di luminosità dal lettore → profilo (SQM, mappa del cielo, orizzonte minimo dal terreno) */
function applySkyMap(det, top, bot, name, year) {
  const g = AllSky.build(det, top, bot), terr = AllSky.terrain(det);
  draft.site.skyMap = { ...g, at: [draft.site.lat, draft.site.lon], file: name, year: year || null, date: new Date().toISOString().slice(0, 10) };
  Object.assign(draft.site, { sqm: g.zenith, lpSrc: 'Mappa all-sky di lightpollutionmap', bortle: sqmToBortle(g.zenith) });
  F('f_sqm').value = g.zenith; F('f_bortle').value = String(sqmToBortle(g.zenith));
  if (F('skyTerr').checked) { // il terreno della mappa diventa l'orizzonte minimo: si tiene il più alto fra i due
    const cur = horizonLUT(draft.horizon);
    draft.horizon = terr.map(([az, alt]) => [az, Math.round(Math.max(alt, cur[az]) * 10) / 10]);
    drawHz();
  }
  drawLpPreview(F('lpSky'), draft.site, draft.horizon); lpStatus();
  toast(`Mappa all-sky: zenit ${it(g.zenith, 2)} mag/″²`);
}
/* automatico: fa sul sito quello che faresti tu (punto, All-sky) e legge l'immagine generata */
let lpmBusy = false;
async function lpmFetch() {
  if (!(window.cielo && window.cielo.lpmAllSky) || lpmBusy || !draft) return;
  const lat = parseFloat(F('f_lat').value), lon = parseFloat(F('f_lon').value);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const sm = draft.site.skyMap; if (sm && sm.at && Math.abs(sm.at[0] - lat) < 0.002 && Math.abs(sm.at[1] - lon) < 0.002) return; // già fatta qui
  lpmBusy = true; F('skyMsg').textContent = 'Chiedo a lightpollutionmap la mappa all-sky di questo punto (10–20 s)…';
  try {
    const r = await window.cielo.lpmAllSky(lat, lon);
    if (!draft) return;
    if (!r || r.error || !r.images || !r.images.length) throw new Error(r && r.error || 'nessuna immagine');
    if (!(Math.abs(+F('f_lat').value - lat) < 1e-6 && Math.abs(+F('f_lon').value - lon) < 1e-6)) return; // nel frattempo il punto è cambiato
    let done = false;
    for (const url of [r.images[1], r.images[0]].filter(Boolean)) { // prima la panoramica, poi la fisheye
      const det = AllSky.detect(await AllSky.fromDataUrl(url)), sc = r.nelm ? null : AllSky.autoScale(det, r.sqm);
      if (!sc) continue;
      readForm(); applySkyMap(det, sc.top, sc.bottom, `lightpollutionmap ${r.year}`, r.year);
      if (isFinite(r.elev) && !F('f_elev').value) F('f_elev').value = Math.round(r.elev);
      F('skyMsg').textContent = `Mappa all-sky ${r.year} di lightpollutionmap letta: barra ${it(sc.top, 2)} → ${it(sc.bottom, 2)}, zenit ${it(r.sqm, 2)}.`;
      done = true; break;
    }
    if (!done) { // scala non ricavabile: si chiede di leggere i due valori della barra
      const det = AllSky.detect(await AllSky.fromDataUrl(r.images[1] || r.images[0])); skyImport = { det, name: `lightpollutionmap ${r.year}` };
      const cv = F('skyBar'), { x, w, yt, yb } = det.bar; cv.width = Math.max(1, Math.round(w * 150 / (yb - yt))); cv.height = 150;
      cv.getContext('2d').drawImage(await AllSky.fromDataUrl(r.images[1] || r.images[0]), x, yt, w, yb - yt, 0, 0, cv.width, 150);
      F('skyImp').hidden = false; F('skyMsg').textContent = 'Immagine scaricata, ma la scala non si ricava da sola: scrivi i due valori ai capi della barra.';
    }
  } catch (e) {
    F('skyMsg').textContent = `Mappa all-sky non ottenuta (${e.message}). Puoi importarla a mano coi passi qui sopra.`;
  } finally { lpmBusy = false; }
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
  L.tileLayer('https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png', { maxNativeZoom: 8, maxZoom: 18, opacity: 0.55, attribution: 'Inquinamento luminoso 2025 © David Lorenz' }).addTo(geoMap);
  geoPin = L.marker([42, 12.5], { draggable: true, keyboard: true, title: 'Il tuo punto di osservazione' }).addTo(geoMap);
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
  if (!Array.isArray(res) || !res.length) { list.innerHTML = `<button disabled>${res && res.error ? 'Ricerca non disponibile (sei offline?)' : 'Nessun luogo trovato'}</button>`; list.hidden = false; return; }
  list.innerHTML = res.map((r, i) => `<button data-i="${i}">${esc(r.name)}<small>${esc(r.detail)}</small></button>`).join('');
  list.hidden = false;
  list.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const r = res[+b.dataset.i]; list.hidden = true; F('geoQ').value = ''; setGeo(r.lat, r.lon, r.name, 13); };
}
function wireGeo() {
  F('geoQ').addEventListener('input', (e) => { clearTimeout(geoTimer); geoTimer = setTimeout(() => geoSearch(e.target.value), 350); });
  F('geoQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = F('geoList').querySelector('[data-i]'); if (b) b.click(); } if (e.key === 'Escape') F('geoList').hidden = true; });
  if (!DESK_GEO()) { F('geoQ').disabled = true; F('geoQ').placeholder = 'Ricerca dei luoghi disponibile nell’app desktop'; }
}
function lpRedraw() { if (!draft) return; readForm(); drawLpPreview(F('lpSky'), draft.site, draft.horizon); lpStatus(); }
function wireEditor() {
  fillEditorSelects();
  F('f_cam').onchange = () => { const c = CAMERAS.find((x) => x.id === F('f_cam').value); if (c && c.id !== 'custom') { F('f_cw').value = c.w; F('f_ch').value = c.h; F('f_pix').value = c.pix; F('f_ctype').value = c.type; F('f_qe').value = c.qe; F('f_rn').value = c.rn; readForm(); renderFilterPick(); } };
  F('f_ctype').onchange = () => { readForm(); renderFilterPick(); };
  F('f_opt').onchange = () => { const o = OPTICS.find((x) => x.id === F('f_opt').value); if (o && o.id !== 'custom') { F('f_ap').value = o.ap; F('f_fl').value = o.fl; F('f_obs').value = o.obs; if (o.acc && !(draft.accessories || []).length) draft.accessories = o.acc.map(([nm, f]) => ({ id: accId(), name: nm, fac: f })); } renderAccs(); };
  ['f_cw', 'f_ch', 'f_pix', 'f_qe', 'f_rn'].forEach((id) => F(id).addEventListener('input', () => { F('f_cam').value = 'custom'; }));
  ['f_ap', 'f_fl'].forEach((id) => F(id).addEventListener('input', () => { F('f_opt').value = 'custom'; renderAccs(); }));
  F('accs').addEventListener('input', (e) => { const i = e.target.dataset.ai; if (i == null) return; const a = draft.accessories[+i]; if (e.target.dataset.k === 'fac') { a.fac = parseFloat(e.target.value) || 1; const fl = (+F('f_fl').value || 300) * a.fac; e.target.parentElement.querySelector('.res').textContent = `${Math.round(fl)} mm · f/${it(fl / (+F('f_ap').value || 60), 1)}`; } else a.name = e.target.value; });
  F('accs').addEventListener('click', (e) => { const i = e.target.dataset.del; if (i == null) return; draft.accessories.splice(+i, 1); renderAccs(); });
  F('accAdd').onclick = () => { const v = F('accPreset').value; const [nm, f] = v === 'custom' ? ['Accessorio', 1] : ACCESSORY_PRESETS[+v]; (draft.accessories = draft.accessories || []).push({ id: accId(), name: nm, fac: f }); renderAccs(); };
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
  F('edClose').onclick = closeEditor;
  F('editor').addEventListener('click', (e) => { if (e.target.id === 'editor') closeEditor(); });
  F('edSave').onclick = () => { const d = readForm(); persistProfile(d); state.activeId = d.id; saveStore(); closeEditor(); refresh(true); toast('Profilo salvato'); };
  F('edDup').onclick = () => { readForm(); draft = clone(draft); draft.id = 'p-' + Date.now().toString(36); draft.name += ' (copia)'; delete draft.unsaved; F('f_name').value = draft.name; F('edTitle').textContent = 'Nuovo profilo'; F('edDelete').hidden = true; };
  F('edDelete').onclick = () => { F('delConfirm').hidden = false; F('edDelete').hidden = true; };
  F('delNo').onclick = () => { F('delConfirm').hidden = true; F('edDelete').hidden = false; };
  F('delYes').onclick = () => { const id = draft.id; closeEditor(); removeProfile(id); refresh(true); toast('Profilo eliminato'); };
  F('edExport').onclick = exportProfiles; F('edImport').onclick = importProfiles;
  // orizzonte
  const svg = F('hzSvg'); let down = false;
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('pointerdown', (e) => { const q = hzPoint(e); if (e.shiftKey || e.button === 2) { hzDel(q.az); drawHz(); return; } down = true; svg.setPointerCapture(e.pointerId); hzSet(q.az, q.alt); drawHz(); });
  svg.addEventListener('pointermove', (e) => { if (!down) return; const q = hzPoint(e); hzSet(q.az, q.alt); drawHz(); });
  ['pointerup', 'pointercancel'].forEach((ev) => svg.addEventListener(ev, () => (down = false)));
  F('hzFlat').onclick = () => { draft.horizon = []; drawHz(); };
  F('hzPasteBtn').onclick = () => { F('hzPaste').hidden = !F('hzPaste').hidden; if (!F('hzPaste').hidden) { F('hzText').value = (draft.horizon || []).map((p) => p[0] + ' ' + p[1]).join('\n'); F('hzText').focus(); } };
  F('hzApply').onclick = () => { const pts = parseHorizon(F('hzText').value); if (!pts.length) { F('hzMsg').textContent = 'Nessun punto valido: servono righe “azimut altezza”.'; return; } draft.horizon = pts; drawHz(); F('hzMsg').textContent = pts.length + ' punti importati.'; };
  F('hzFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const pts = parseHorizon(rd.result); if (!pts.length) { toast('Il file non contiene righe “azimut altezza” valide.'); return; } draft.horizon = pts; drawHz(); toast(pts.length + ' punti importati da ' + f.name); }; rd.readAsText(f); e.target.value = ''; };
  const hzText = () => (draft.horizon || []).slice().sort((a, b) => a[0] - b[0]).map((p) => `${p[0]} ${p[1]}`).join('\n');
  F('hzCopyNina').onclick = () => copyText(hzText());
  F('hzCopyStel').onclick = () => copyText('# Orizzonte poligonale per Stellarium (polygonal_horizon_list): azimut altezza, gradi\n' + hzText());
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
  s += `<text x="${HZ.x0}" y="${HZ.y1 + 32}" fill="var(--ink-3)" font-size="10" font-family="IBM Plex Mono">${pts.length} punti · azimut da nord verso est</text>`;
  F('hzSvg').innerHTML = s;
}
function hzPoint(e) { const svg = F('hzSvg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return { az: clamp((q.x - HZ.x0) / (HZ.x1 - HZ.x0) * 360, 0, 359.9), alt: clamp((HZ.y1 - q.y) / (HZ.y1 - HZ.y0) * HZ.max, 0, HZ.max) }; }
function hzSet(az, alt) { az = Math.round(az / 5) * 5 % 360; alt = Math.round(alt); const H = draft.horizon || (draft.horizon = []); const i = H.findIndex((p) => Math.abs(((p[0] - az + 540) % 360) - 180) < 2.5); if (i >= 0) H[i] = [az, alt]; else H.push([az, alt]); H.sort((a, b) => a[0] - b[0]); }
function hzDel(az) { const H = draft.horizon || []; if (!H.length) return; let bi = 0, bd = 999; H.forEach((p, i) => { const d = Math.abs(((p[0] - az + 540) % 360) - 180); if (d < bd) { bd = d; bi = i; } }); if (bd < 8) H.splice(bi, 1); }
