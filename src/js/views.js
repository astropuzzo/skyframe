'use strict';
/* ============================ pannello di sinistra ============================ */
function moonSvg(k, waxing, r = 9) {
  const rx = r * Math.abs(1 - 2 * k), so = waxing ? 1 : 0, st = ((k > 0.5) === waxing) ? 1 : 0;
  return `<svg width="${2 * r + 2}" height="${2 * r + 2}" viewBox="${-r - 1} ${-r - 1} ${2 * r + 2} ${2 * r + 2}" aria-hidden="true"><circle r="${r}" fill="#1B2230" stroke="#3A4558" stroke-width=".8"/><path d="M0,${-r} A${r},${r} 0 0 ${so} 0,${r} A${rx},${r} 0 0 ${st} 0,${-r}Z" fill="#E9E4D4"/></svg>`;
}
function renderFacts() {
  const p = active(), n = state.res.night, sqm = state.res.sqm;
  const dark = n.first >= 0 ? `${fmtT(n.t[n.first])} – ${fmtT(n.t[n.last] + DT)}` : 'nessuno';
  let moonS; if (n.moonUpFrac < 0.02) moonS = 'sotto l’orizzonte col buio'; else { const p2 = []; if (n.mRise) p2.push('sorge ' + fmtT(n.mRise)); if (n.mSet) p2.push('tramonta ' + fmtT(n.mSet)); moonS = `alta per il ${Math.round(n.moonUpFrac * 100)}% del buio` + (p2.length ? ' · ' + p2.join(', ') : ''); }
  const win = state.windows && state.windows[0];
  const nextDark = win ? (win.from <= n.t0 + 43200000 ? `adesso, fino al ${fmtDay(win.to)}` : `${fmtDay(win.from)} → ${fmtDay(win.to)}`) : 'oltre 6 settimane';
  $('#facts').innerHTML = `
    <div class="fact"><div class="lbl">Buio</div><div class="v num">${dark}</div><div class="s">${fmtDur(n.darkH)} · sole sotto ${n.thr}°</div></div>
    <div class="fact"><div class="lbl">Luna</div><div class="v">${moonSvg(n.moonIll, n.waxing)}<span class="num">${Math.round(n.moonIll * 100)}%</span></div><div class="s">${moonS}</div></div>
    <div class="fact"><div class="lbl">Cielo allo zenit</div><div class="v num">SQM ${it(sqm, 2)}</div><div class="s">Bortle ${sqmToBortle(sqm)} · ${p.site.lpSrc ? esc(p.site.lpSrc) + (p.site.lpAz ? ', per direzione' : '') : 'valore inserito a mano'}</div></div>
    <div class="fact"><div class="lbl">Notti senza Luna</div><div class="v" style="font-size:16px">${nextDark}</div><div class="s">prossima finestra buia</div></div>`;
}
function renderSetups() {
  const el = $('#setups'); const cfgs = state.cfgs;
  if (cfgs.length < 2) { el.hidden = true; return; }
  const top = state.filtered.slice(0, 30); const wins = new Map(cfgs.map((c) => [c.key, 0]));
  top.forEach((r) => wins.set(r.e.cfg.key, wins.get(r.e.cfg.key) + 1));
  const max = Math.max(1, ...wins.values());
  el.hidden = false;
  el.innerHTML = `<h3 class="lbl">Quale setup stanotte</h3><div class="note" style="margin:-4px 0 8px">Su quanti dei primi ${top.length} target vince ogni configurazione.</div>` + cfgs.map((c) => `<div class="su"><div><div class="n">${esc(c.label)}</div><div class="d">${c.short} · ${fmtDeg(c.geom.W)}×${fmtDeg(c.geom.H)} · ${it(c.geom.px, 2)}″/px${c.profile.id !== state.activeId ? ' · ' + esc(c.profile.name) : ''}</div></div><div class="w">${wins.get(c.key)}</div><div class="bar"><i style="width:${(wins.get(c.key) / max) * 100}%"></i></div></div>`).join('');
}
/* striscia della notte: crepuscoli, Luna, finestra di ripresa, altezza del target selezionato, cursore */
function drawStrip() {
  const cv = $('#stripCv'), n = state.res && state.res.night; if (!n) return;
  const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const i0 = n.w0, i1 = n.w1, X = (i) => (i - i0) / (i1 - i0) * w, bh = h - 16;
  const col = (s) => (s >= -0.833 ? '#243048' : s >= -6 ? '#1A2436' : s >= -12 ? '#121A28' : s >= n.thr ? '#0D131E' : '#070A10');
  for (let i = i0; i < i1; i++) { c.fillStyle = col(n.sun[i]); c.fillRect(X(i), 0, X(i + 1) - X(i) + 0.6, bh); }
  for (let i = i0; i < i1; i++) if (n.mAlt[i] > 0) { c.fillStyle = `rgba(230,225,205,${0.12 + 0.35 * n.mIll[i]})`; c.fillRect(X(i), bh - 5, X(i + 1) - X(i) + 0.6, 3); }
  for (let i = i0; i < i1; i++) if (n.dark[i]) { c.fillStyle = 'rgba(69,200,180,.8)'; c.fillRect(X(i), bh - 1.5, X(i + 1) - X(i) + 0.6, 1.5); }
  const sel = state.sel && state.byId.get(state.sel);
  if (sel) { c.lineWidth = 1.5; c.beginPath(); for (let i = i0; i <= i1; i++) { const y = bh - 4 - clamp(sel.alt[i], 0, 90) / 90 * (bh - 8); i === i0 ? c.moveTo(X(i), y) : c.lineTo(X(i), y); } c.strokeStyle = 'rgba(69,200,180,.85)'; c.stroke(); }
  c.font = '500 10px "IBM Plex Mono", monospace'; c.fillStyle = '#697588'; c.textAlign = 'center';
  const h0 = new Date(n.t[i0]); h0.setMinutes(0, 0, 0);
  for (let ms = h0.getTime() + 3600000; ms < n.t[i1]; ms += 3600000) { const x = (ms - n.t[i0]) / (n.t[i1] - n.t[i0]) * w; c.fillText(String(new Date(ms).getHours()).padStart(2, '0'), x, h - 3); c.fillStyle = 'rgba(105,117,136,.35)'; c.fillRect(x, 0, 1, 4); c.fillStyle = '#697588'; }
  const t = Dome.time; if (t >= n.t[i0] && t <= n.t[i1]) { const x = (t - n.t[i0]) / (n.t[i1] - n.t[i0]) * w; c.fillStyle = '#fff'; c.fillRect(x - 1, 0, 2, bh); c.beginPath(); c.moveTo(x - 5, 0); c.lineTo(x + 5, 0); c.lineTo(x, 6); c.fill(); }
}
function renderClock() {
  const t = Dome.time, n = state.res && state.res.night; if (!n) return;
  $('#clockTime').textContent = fmtT(t);
  const p = active(), lat = p.site.lat * D2R, J = jd(t), lst = lstDeg(t, +p.site.lon), s = sunPos(J);
  const sAlt = altaz(s.ra, s.dec, lst, Math.sin(lat), Math.cos(lat))[0];
  const phase = sAlt > -0.833 ? 'giorno' : sAlt > -6 ? 'crepuscolo civile' : sAlt > -12 ? 'crepuscolo nautico' : sAlt > -18 ? 'crepuscolo astronomico' : 'buio';
  $('#clockWhen').innerHTML = `${new Date(t).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}<br>Sole ${Math.round(sAlt)}° · ${phase}`;
}

/* ============================ mappa della luminosità del cielo ============================ */
/* Scala adattata al luogo: dal punto più buio (verso lo zenit) al più brillante (verso l'orizzonte e le luci). */
const LP_RAMP = [[0, [10, 14, 34]], [0.22, [38, 52, 128]], [0.45, [108, 70, 170]], [0.65, [196, 92, 160]], [0.82, [236, 150, 120]], [1, [255, 236, 206]]];
function lpColor(m, rg) {
  const t = clamp((rg.hi - m) / (rg.hi - rg.lo), 0, 1);
  for (let i = 1; i < LP_RAMP.length; i++) if (t <= LP_RAMP[i][0]) { const [t0, c0] = LP_RAMP[i - 1], [t1, c1] = LP_RAMP[i], f = (t - t0) / (t1 - t0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * f)); }
  return LP_RAMP[LP_RAMP.length - 1][1];
}
/* valori chiave della mappa: zenit, media sopra 30°, punti più brillante e più buio (con direzione) */
function lpStats(sky) {
  let min = { m: 99 }, max = { m: -99 }, sum = 0, n = 0;
  for (let h = 3; h <= 90; h += 1) for (let az = 0; az < 360; az += 5) {
    const m = sky.mag(h, az); if (m < min.m) min = { m, h, az }; if (m > max.m) max = { m, h, az };
    if (h >= 30) { sum += Math.pow(10, -0.4 * m) * Math.cos(h * D2R); n += Math.cos(h * D2R); }
  }
  const mean30 = -2.5 * Math.log10(sum / n), lo = min.m, hi = Math.max(max.m, lo + 0.4);
  return { zen: sky.mag(90, 0), mean30, bright: min, dark: max, lo, hi };
}
/* disegna il cielo visto da sotto (nord in alto, est a sinistra): raggio pieno = hmax gradi dallo zenit */
function lpImage(sky, size, hmax, lut, rg) {
  rg = rg || lpStats(sky);
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const c = cv.getContext('2d'), img = c.createImageData(size, size), R = size / 2, d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = R - x, dy = R - y, r = Math.hypot(dx, dy) / R * hmax, alt = 90 - r; if (alt < 0) continue;
    const az = (Math.atan2(dx, dy) * R2D + 360) % 360, col = lpColor(sky.mag(alt, az), rg), k = (y * size + x) * 4;
    const blocked = lut && alt < lut[Math.round(az) % 360];
    d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = blocked ? 185 : 255;
  }
  c.putImageData(img, 0, 0);
  if (lut) { // profilo dell'orizzonte come contorno: sotto si legge ancora la luminosità
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, size / 250); c.beginPath();
    for (let az = 0; az <= 360; az += 2) { const r = (90 - Math.max(0, lut[az % 360])) / hmax * R, a = az * D2R, x = R - r * Math.sin(a), y = R - r * Math.cos(a); az ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  return cv;
}
function lpLegendHTML(st) {
  const stops = LP_RAMP.map(([t, c]) => `rgb(${c}) ${Math.round(t * 100)}%`).join(',');
  return `<div class="lpleg"><div class="bar" style="background:linear-gradient(90deg,${stops})"></div><div class="ends"><span>${it(st.hi, 2)}</span><span>${it(st.lo, 2)} mag/″²</span></div></div>
    <dl class="lpstats"><dt>Zenit</dt><dd>${it(st.zen, 2)}</dd><dt>Media sopra 30°</dt><dd>${it(st.mean30, 2)}</dd>
    <dt>Più brillante</dt><dd>${it(st.bright.m, 2)} a ${st.bright.h}° verso ${azName(st.bright.az)} (${st.bright.az}°)</dd><dt>Più buio</dt><dd>${it(st.dark.m, 2)} a ${st.dark.h}° verso ${azName(st.dark.az)}</dd></dl>`;
}
function drawLpPreview(canvas, site, horizon) {
  const sky = skyModel(site), st = lpStats(sky), dpr = Math.min(2, devicePixelRatio || 1), S = 340;
  canvas.width = S * dpr; canvas.height = S * dpr;
  const c = canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(lpImage(sky, Math.round(S * dpr), 90, horizonLUT(horizon), st), 0, 0);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.strokeStyle = 'rgba(255,255,255,.18)'; [30, 60].forEach((a) => { c.beginPath(); c.arc(S / 2, S / 2, S / 2 * (90 - a) / 90, 0, 7); c.stroke(); });
  c.font = '600 13px "Saira Condensed", sans-serif'; c.textAlign = 'center';
  [['N', S / 2, 16], ['S', S / 2, S - 6], ['E', 12, S / 2 + 4], ['O', S - 12, S / 2 + 4]].forEach(([l, x, y]) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(l, x + 1, y + 1); c.fillStyle = '#fff'; c.fillText(l, x, y); });
  const leg = document.getElementById('lpLegend'); if (leg) leg.innerHTML = lpLegendHTML(st);
}

/* ============================ lista ============================ */
const scoreColor = (s) => (s >= 70 ? 'var(--good)' : s >= 45 ? 'var(--oiii)' : s >= 20 ? 'var(--warn)' : 'var(--ink-3)');
function frameGlyph(r) {
  const g = r.e.cfg.geom, o = r.o; const vw = Math.max(g.W * 1.12, o.a * 1.08), vh = Math.max(g.H * 1.12, o.b * 1.08); const k = Math.min(56 / vw, 38 / vh);
  const W = g.W * k, H = g.H * k, A = Math.max(o.a * k / 2, 0.9), B = Math.max(o.b * k / 2, 0.9), col = TYPE_COLOR[o.type];
  return `<svg width="60" height="42" viewBox="-30 -21 60 42" aria-hidden="true"><rect x="${(-W / 2).toFixed(1)}" y="${(-H / 2).toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="none" stroke="var(--ink-3)" stroke-width="1"/><ellipse rx="${A.toFixed(1)}" ry="${B.toFixed(1)}" fill="${col}" fill-opacity="${o.type === 'DN' ? '.15' : '.35'}" stroke="${col}" stroke-width="1"/></svg>`;
}
function spark(r) {
  const n = state.res.night, i0 = n.w0, i1 = n.w1, w = 110, h = 28; const X = (i) => ((i - i0) / (i1 - i0) * w).toFixed(1), Y = (a) => (h - 2 - clamp(a, 0, 90) / 90 * (h - 4)).toFixed(1);
  let base = '', seg = '', cur = [];
  for (let i = i0; i <= i1; i++) { base += (i === i0 ? 'M' : 'L') + X(i) + ',' + Y(r.alt[i]); if (r.use[i]) cur.push(X(i) + ',' + Y(r.alt[i])); if ((!r.use[i] || i === i1) && cur.length) { seg += `<polyline points="${cur.join(' ')}" fill="none" stroke="var(--oiii)" stroke-width="2.2" stroke-linecap="round"/>`; cur = []; } }
  const t = Dome.time; let nl = ''; if (t >= n.t[i0] && t <= n.t[i1]) { const x = ((t - n.t[i0]) / (n.t[i1] - n.t[i0]) * w).toFixed(1); nl = `<line x1="${x}" x2="${x}" y1="0" y2="${h}" stroke="#fff" stroke-opacity=".55"/>`; }
  const dk = n.first >= 0 ? `<rect x="${X(Math.max(n.first, i0))}" y="0" width="${(X(Math.min(n.last, i1)) - X(Math.max(n.first, i0))).toFixed(1)}" height="${h}" fill="#0E1520"/>` : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${dk}<path d="${base}" fill="none" stroke="var(--ink-4)" stroke-width="1"/>${seg}${nl}</svg>`;
}
function altAt(r, t) { const p = active(), lat = p.site.lat * D2R; return altaz(r.pr.ra, r.pr.dec, lstDeg(t, +p.site.lon), Math.sin(lat), Math.cos(lat)); }
function nowCell(r) {
  const [a, z] = altAt(r, Dome.time); const b = Math.max(+active().session.minAlt || 0, state.res.lut[Math.round(z) % 360]);
  return a <= 0 ? `<span style="color:var(--ink-4)">sotto</span><small>orizzonte</small>` : `${Math.round(a)}°<small>${azName(z)} · ${a >= b ? 'libero' : 'coperto'}</small>`;
}
function rowHTML(r, i) {
  const o = r.o, e = r.e, b = e.best, n = state.res.night;
  let plan;
  if (!b) plan = `<span style="color:var(--ink-3)">—</span><small>serve la banda larga</small>`;
  else {
    const h = isFinite(b.tonight) ? b.tonight : b.ideal, nt = b.nights;
    const ntx = !isFinite(nt) ? '' : nt <= 1 ? '1 notte' : (nt < 10 ? it(nt) : Math.round(nt)) + ' notti';
    const cls = nt <= 1 ? 'n1' : nt <= 3 ? 'n2' : 'n3';
    plan = `<b>${fmtH(h)}</b>${ntx ? `<span class="nights ${cls}">${ntx}</span>` : ''}${state.cfgs.length > 1 ? `<span class="cfg">${Math.round(e.cfg.geom.fEff)} mm</span>` : ''}<small>${esc(b.label)}${b.deep ? ` · profondo ${fmtH(isFinite(b.tonightDeep) ? b.tonightDeep : b.idealDeep)}` : ''}</small>`;
  }
  const win = r.first >= 0 ? `${fmtT(n.t[r.first])}–${fmtT(n.t[r.last] + DT)}` : '';
  const vis = r.usableH > 0 ? `${fmtDur(r.usableH)} · max ${Math.round(r.maxA)}°<small>${win}</small>` : `<span style="color:var(--ink-3)">non riprendibile</span><small>coperto o sotto ${active().session.minAlt}°</small>`;
  const size = `${o.a >= 10 ? Math.round(o.a) : it(o.a, 1)}′${o.b !== o.a ? '×' + (o.b >= 10 ? Math.round(o.b) : it(o.b, 1)) + '′' : ''}`;
  return `<div class="row${r.usableH < 0.25 ? ' dim' : ''}${state.sel === o.id ? ' sel' : ''}${i < 24 ? ' enter' : ''}" style="${i < 24 ? `animation-delay:${i * 22}ms` : ''}" role="button" tabindex="0" data-id="${esc(o.id)}">
    <div class="c-score"><div class="score" data-v="${r.score}" style="--c:${scoreColor(r.score)}"><b>${r.score}</b></div></div>
    <div class="c-name"><div class="nm"><span class="id">${esc(o.id)}</span><span class="nick">${esc(o.nick)}</span></div>
      <div class="meta"><span class="tchip" style="color:${TYPE_COLOR[o.type]}">${TYPES_PL[o.type]}</span><span class="num">${size}</span><span>${esc(CONST_NAMES[o.con] || o.con)}</span>${o.classic ? '' : '<span class="gem">fuori dai soliti</span>'}</div></div>
    <div class="c-frame frame">${frameGlyph(r)}<div>${esc(e.fill.label)}<small>${esc(e.fill.sub)}</small></div></div>
    <div class="c-vis vis">${spark(r)}<div>${vis}</div></div>
    <div class="c-plan plan">${plan}</div>
    <div class="c-now now">${nowCell(r)}</div></div>`;
}
function renderList() {
  const L = state.filtered, shown = L.slice(0, state.page);
  const visN = state.res.results.filter((r) => r.usableH >= 0.25).length;
  $('#count').innerHTML = `<span class="num">${L.length}</span> target su ${visN} riprendibili la notte del ${new Date(state.res.night.t0).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  $('#list').innerHTML = shown.length ? shown.map(rowHTML).join('') + (L.length > shown.length ? `<button class="btn more" id="moreBtn">Mostra altri ${Math.min(60, L.length - shown.length)}</button>` : '') : `<div class="empty">Nessun target con questi filtri. Allarga i criteri o azzera i filtri.</div>`;
  requestAnimationFrame(() => $$('#list .score').forEach((el) => el.style.setProperty('--v', el.dataset.v)));
  const mb = $('#moreBtn'); if (mb) mb.onclick = () => { state.page += 60; renderList(); };
}
function refreshNowCells() { $$('#list .row[data-id]').forEach((el) => { const r = state.byId.get(el.dataset.id); if (r) el.querySelector('.c-now').innerHTML = nowCell(r); }); }

/* ============================ dettaglio ============================ */
function openDetail(id) {
  const r = state.byId.get(id); if (!r) return;
  state.sel = id; state.selCfg = r.e.cfg.key; state.rotFor = null;
  renderDetail(); const d = $('#drawer'), bd = $('#backdrop');
  d.hidden = false; bd.hidden = false; requestAnimationFrame(() => { d.classList.add('on'); bd.classList.add('on'); });
  d.scrollTop = 0; d.focus({ preventScroll: true });
  $$('#list .row.sel').forEach((el) => el.classList.remove('sel')); const row = $(`#list .row[data-id="${CSS.escape(id)}"]`); if (row) row.classList.add('sel');
  pushDome(); drawStrip();
}
function closeDetail() {
  const d = $('#drawer'), bd = $('#backdrop'); d.classList.remove('on'); bd.classList.remove('on');
  setTimeout(() => { if (!d.classList.contains('on')) { d.hidden = true; bd.hidden = true; } }, 300);
}
function curEval(r) { return r.evals.find((e) => e.cfg.key === state.selCfg) || r.e; }
function renderDetail() {
  const r = state.byId.get(state.sel); if (!r) { closeDetail(); return; }
  const o = r.o, e = curEval(r), n = state.res.night, p = active(), g = e.cfg.geom, b = e.best;
  // strategie alternative con filtri che non hai (solo per questo target)
  const U = usableSteps(r, n, state.res.sky);
  const altS = alternativeStrategies(e.cfg.profile.camera.type, ownedFilters(e.cfg.profile));
  const altEval = evalStrategies(o, altS, e.K, U, state.res.Q, r.T, r.field).filter((s) => isFinite(s.tonight) || s.ideal);
  const cur = b ? (isFinite(b.tonight) ? b.tonight : b.ideal) : Infinity;
  const bestAlt = altEval.map((s) => ({ name: (s.alt.brand ? s.alt.brand + ' ' : '') + s.alt.name, h: isFinite(s.tonight) ? s.tonight : s.ideal, pen: s.penalty })).filter((x) => x.h < cur * 0.7).sort((x, y) => x.h * x.pen - y.h * y.pen)[0];
  const tips = adviceFor(r, e, { night: n, nextDark: state.nextDarkTxt, alt: bestAlt, sky: state.res.sky, framing: framingFor(o, r.field, e.cfg.geom) });
  const plan = planOf(b, e.cfg, true);
  const planTot = plan ? plan.filter((x) => !x.optional).reduce((a, x) => a + x.h, 0) : 0;
  const planDeep = plan ? plan.filter((x) => !x.optional).reduce((a, x) => a + x.hDeep, 0) : 0;
  const hOf = (s) => (isFinite(s.tonight) ? s.tonight : s.ideal);
  const alts = e.strat.filter((s) => s !== b).sort((x, y) => hOf(x) * x.penalty - hOf(y) * y.penalty).slice(0, 3);
  const aladin = `https://aladin.cds.unistra.fr/AladinLite/?target=${encodeURIComponent((o.ra / 15).toFixed(5) + ' ' + (o.dec >= 0 ? '+' : '') + o.dec.toFixed(5))}&fov=${(Math.max(g.W, o.a) * 1.4 / 60).toFixed(2)}`;
  const stel = `https://stellarium-web.org/skysource/${encodeURIComponent(o.id.replace(/\s+/g, ''))}`;
  const size = `${o.a}′${o.b !== o.a ? ' × ' + o.b + '′' : ''}`;
  // rotazione e centro migliori per questa configurazione (ricalcolati quando cambi setup)
  const fr = framingFor(o, r.field, g), bestRot = fr.free ? 90 : fr.pa;
  if (state.rotFor !== e.cfg.key) { state.rot = bestRot; state.frameOff = [fr.dx, fr.dy]; state.rotFor = e.cfg.key; }
  const tabs = r.evals.length > 1 ? `<div class="tabs" role="tablist">${r.evals.map((x) => `<button class="tab" role="tab" data-cfg="${esc(x.cfg.key)}" aria-selected="${x.cfg.key === e.cfg.key}">${esc(x.cfg.label)}<span class="sc" style="color:${scoreColor(x.score)}">${x.score}</span><small>${x.cfg.short} · ${esc(x.fill.label.toLowerCase())}${x.best ? ' · ' + fmtH(isFinite(x.best.tonight) ? x.best.tonight : x.best.ideal) : ''}</small></button>`).join('')}</div>` : '';
  $('#drawer').innerHTML = `
  <div class="d-head"><div><h2>${esc(o.id)}</h2>${o.nick ? `<div class="nick">${esc(o.nick)}</div>` : ''}
    <div class="sub">${TYPES[o.type]} in ${esc(CONST_NAMES[o.con] || o.con)} · ${size}${o.mag != null ? ' · mag ' + it(o.mag, 1) : ''} · LS ${it(o.sb, 1)} mag/″²${o.alias.length ? ' · ' + esc(o.alias.slice(0, 4).join(', ')) : ''}</div></div>
    <button class="btn ghost x" id="dClose">Chiudi</button></div>
  <div class="d-actions"><button class="btn sm" id="copyCoord">Copia coordinate J2000</button>${Math.hypot(fr.dx, fr.dy) > 2 ? '<button class="btn sm" id="copyFrame">Copia centro inquadratura</button>' : ''}<a class="btn sm ghost" href="${aladin}" target="_blank" rel="noopener">Aladin ↗</a><a class="btn sm ghost" href="${stel}" target="_blank" rel="noopener">Stellarium Web ↗</a></div>
  ${tabs}
  <div class="kpis">
    <div class="kpi"><div class="lbl">Punteggio</div><div class="v" style="color:${scoreColor(e.score)}">${e.score}</div><div class="s">su 100</div></div>
    <div class="kpi"><div class="lbl">Inquadratura</div><div class="v">${Math.round(e.fill.score * 100)}</div><div class="s">${esc(e.fill.label)}</div></div>
    <div class="kpi"><div class="lbl">Visibilità</div><div class="v">${Math.round(r.vis * 100)}</div><div class="s">${fmtDur(r.usableH)} libero col buio</div></div>
    <div class="kpi"><div class="lbl">Impegno</div><div class="v">${Math.round(e.effort * 100)}</div><div class="s">${b && isFinite(b.nights) ? (b.nights <= 1 ? 'si chiude stanotte' : '≈ ' + it(b.nights) + ' notti così') : 'non stanotte'}</div></div>
  </div>
  <div class="sec"><h3>Piano di ripresa <small>qualità ${QLABEL[p.session.quality] || 'buona'} · ${esc(e.cfg.label)} a ${e.cfg.short} · con il cielo di stanotte</small></h3>
    ${plan ? `<div class="plan-card"><div class="head"><span class="t">${esc(b.label)}</span><span class="h">${fmtH(planTot)}</span></div>
      ${b.deep ? `<div class="deep">Per far uscire anche l’Hα diffuso attorno (${it(o.ha, 1)} R nella mappa all-sky di Finkbeiner) servono <b>${fmtH(planDeep)}</b> in tutto.</div>` : ''}
      <div class="steps">${plan.map((s) => `<div class="step${s.optional ? ' opt' : ''}"><div class="f">${esc(s.filter)}<small>${esc(s.what)}${s.optional ? ' · facoltativo' : s.drive ? ' · il tempo lo decidono: ' + esc(s.drive) : ''}</small></div><div class="h">${fmtH(s.h)}${s.hDeep > s.h * 1.15 ? `<small>${fmtH(s.hDeep)} profondo</small>` : ''}</div><div class="sb">sub ${s.sub} s</div></div>`).join('')}</div>
      ${b.panels > 1 ? `<div class="note">Tempi totali per ${b.panels} pannelli di mosaico.</div>` : ''}
      ${alts.length ? `<div class="alts"><span class="lbl">Altre strade, non da sommare</span>${alts.map((s) => `<div class="a"><span>${esc(s.label)}</span><b>${fmtH(hOf(s))}${isFinite(s.nights) ? ` · ${s.nights <= 1 ? '1 notte' : it(s.nights) + ' notti'}` : ''}</b></div>`).join('')}</div>` : ''}
      <div class="note">Senza Luna e al transito servirebbero ${fmtH(b.ideal)}. Sub scelti filtro per filtro: coprono il rumore di lettura con il cielo di stanotte (Luna compresa) e restano nei valori pratici di quel tipo di filtro.</div></div>`
    : `<p class="hint">Con i filtri di questo profilo non c’è una strategia adatta a ${TYPES_PL[o.type].toLowerCase()}.</p>`}
  </div>
  <div class="sec"><h3>Consigli</h3><div class="tips">${tips.map((t) => `<div class="tip k-${esc(t.k.replace(/[^\w]/g, ''))}"><div class="k">${esc(t.k)}</div><div>${esc(t.t)}</div></div>`).join('')}</div></div>
  <div class="sec"><h3>Campo inquadrato <small>${fmtDeg(g.W)} × ${fmtDeg(g.H)} · ${Math.round(g.fEff)} mm · nord in alto, est a sinistra</small></h3>
    <div class="fovbox"><canvas id="fov" aria-label="Anteprima del campo"></canvas>
    <div class="fovctl"><label for="rot">Lato lungo a PA</label><input id="rot" type="range" min="0" max="179" step="1" value="${Math.round(state.rot)}"><span class="num" id="rotV">${Math.round(state.rot)}°</span>
      <button class="btn sm ghost" id="rotBest">Allinea (${bestRot}°)</button>
      ${e.fill.nx * e.fill.ny > 1 ? `<label class="chk"><input type="checkbox" id="mos" ${state.mosaic ? 'checked' : ''}> Mosaico ${e.fill.nx}×${e.fill.ny}</label>` : ''}
      <label class="chk"><input type="checkbox" id="realSky" ${state.realSky ? 'checked' : ''}> Foto reale</label></div></div>
    <p class="note"><span id="skyNote"></span>. Rettangolo, scala e orientamento sono calcolati sul tuo sensore.</p></div>
  <div class="sec"><h3>La notte <small>zona rossa: coperto dall’orizzonte o sotto ${p.session.minAlt}°</small></h3><div class="charts"><div class="chartbox draw">${altChart(r)}</div><div class="chartbox draw">${polar(r)}</div></div></div>
  <div class="sec"><h3>Nei prossimi 12 mesi <small>ore libere col buio, senza contare la Luna</small></h3><div class="chartbox season" id="season"></div></div>
  <details class="how"><summary>Come vengono stimati i tempi</summary>
    <p>Ogni filtro è modellato con le sue bande reali (schede dei produttori). Per ogni banda calcolo quanta luce dell’oggetto passa (continuo più le righe Hα, [NII], Hβ, OIII, SII, pesate dalla risposta dei pixel rossi, verdi e blu se la camera è a colori) e quanto fondo cielo: il tuo SQM, diviso tra un continuo tipo LED e le righe di mercurio e sodio, più la luce lunare di ogni 5 minuti.</p>
    <p>Il fondo cielo cambia con la direzione: SQM allo zenit dall’atlante di Lorenz 2025 (o dal tuo valore), più brillante verso l’orizzonte e verso le luci con i pesi per azimut calcolati dall’atlante.</p>
    <p>La qualità è un SNR per elemento di risoluzione (il più grande tra pixel e 2″, la scala del seeing) su tre livelli: la luminosità media del catalogo, le parti deboli (aloni, bracci esterni) e, se ci sono, le polveri estese attorno (a LS ≥ 25). Il tempo “profondo” aggiunge l’Hα diffuso misurato attorno all’oggetto nella mappa all-sky di Finkbeiner (2003). Le righe deboli (OIII e SII in una regione HII) sono chieste in proporzione alla loro intensità, come fai in elaborazione.</p>
    <p>Taratura: con 800 mm f/5, OSC e SQM 19,3 la Cocoon esce a 56 h (base) e 95 h (profondo); un’immagine reale con quel campo ne ha richieste 100. Sono stime per scegliere, non promesse: seeing, trasparenza ed elaborazione contano molto.</p></details>`;
  $('#dClose').onclick = closeDetail;
  $('#copyCoord').onclick = () => copyText(`${o.id} ${raStr(o.ra)} ${decStr(o.dec).replace('−', '-')}`);
  $$('#drawer .tab').forEach((t) => (t.onclick = () => { state.selCfg = t.dataset.cfg; const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; }));
  $('#rot').oninput = (ev) => { state.rot = +ev.target.value; $('#rotV').textContent = state.rot + '°'; drawPreview(); };
  $('#rotBest').onclick = () => { state.rot = bestRot; state.frameOff = [fr.dx, fr.dy]; $('#rot').value = bestRot; $('#rotV').textContent = bestRot + '°'; drawPreview(); };
  const cf = $('#copyFrame'); if (cf) cf.onclick = () => copyText(`${o.id} (centro inquadratura) ${raStr(fr.ra)} ${decStr(fr.dec).replace('−', '-')} · PA lato lungo ${bestRot}°`);
  const m = $('#mos'); if (m) m.onchange = (ev) => { state.mosaic = ev.target.checked; drawPreview(); };
  $('#realSky').onchange = (ev) => { state.realSky = ev.target.checked; LS.set('sf.realSky', state.realSky); drawPreview(); };
  requestAnimationFrame(() => { drawPreview(); renderSeason(r); });
}
function renderSeason(r) {
  const el = $('#season'); if (!el) return;
  const s = seasonality(r.o, active(), state.res.lut); const W = 640, H = 150, pad = 26, bw = (W - pad * 2) / 12, max = Math.max(4, ...s.map((x) => x.h));
  const Y = (h) => H - 24 - h / max * (H - 44);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ore utili per mese">`;
  [0, Math.round(max / 2), Math.round(max)].forEach((v) => { svg += `<line x1="${pad}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pad - 5}" y="${Y(v) + 4}" fill="var(--ink-3)" font-size="10" text-anchor="end" font-family="IBM Plex Mono">${v}h</text>`; });
  const best = s.reduce((a, x) => (x.h > a.h ? x : a), s[0]);
  s.forEach((x, i) => { const hgt = H - 24 - Y(x.h); svg += `<rect class="b" style="animation-delay:${i * 40}ms" x="${pad + i * bw + 5}" y="${Y(x.h)}" width="${bw - 10}" height="${Math.max(0, hgt)}" rx="3" fill="${x === best ? 'var(--oiii)' : i === 0 ? '#5d6a80' : '#2b3647'}"/><text x="${pad + i * bw + bw / 2}" y="${H - 8}" fill="${i === 0 ? 'var(--ink)' : 'var(--ink-3)'}" font-size="11" text-anchor="middle" font-family="IBM Plex Sans">${x.label.replace('.', '')}</text>`; if (x.h > 0.2) svg += `<text x="${pad + i * bw + bw / 2}" y="${Y(x.h) - 4}" fill="var(--ink-2)" font-size="10" text-anchor="middle" font-family="IBM Plex Mono">${it(x.h, 1)}</text>`; });
  el.innerHTML = svg + '</svg>';
}
function altChart(r) {
  const n = state.res.night, p = active(), i0 = n.w0, i1 = n.w1; const W = 640, H = 230, l = 34, rr = 10, t = 10, b = 26, pw = W - l - rr, ph = H - t - b;
  const X = (i) => (l + (i - i0) / (i1 - i0) * pw).toFixed(1), Y = (a) => (t + ph - clamp(a, 0, 90) / 90 * ph).toFixed(1);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Altezza nella notte">`;
  const col = (v) => (v >= -0.833 ? '#1C2433' : v >= -6 ? '#161E2B' : v >= -12 ? '#121925' : v >= n.thr ? '#0E141E' : null);
  for (let i = i0; i < i1; i++) { const c = col(n.sun[i]); if (c) s += `<rect x="${X(i)}" y="${t}" width="${(X(i + 1) - X(i) + 0.5).toFixed(1)}" height="${ph}" fill="${c}"/>`; }
  let blk = `M${X(i0)},${Y(0)}`; for (let i = i0; i <= i1; i++) blk += `L${X(i)},${Y(r.blk[i])}`; blk += `L${X(i1)},${Y(0)}Z`;
  s += `<path d="${blk}" fill="rgba(228,87,75,.14)" stroke="rgba(228,87,75,.5)"/>`;
  [0, 30, 60, 90].forEach((a) => { s += `<line x1="${l}" x2="${W - rr}" y1="${Y(a)}" y2="${Y(a)}" stroke="var(--line-2)" stroke-width=".6"/><text x="${l - 6}" y="${+Y(a) + 4}" fill="var(--ink-3)" font-size="11" text-anchor="end" font-family="IBM Plex Mono">${a}°</text>`; });
  const h0 = new Date(n.t[i0]); h0.setMinutes(0, 0, 0);
  for (let ms = h0.getTime() + 3600000; ms < n.t[i1]; ms += 3600000) { const i = i0 + (ms - n.t[i0]) / DT; s += `<text x="${X(i)}" y="${H - 8}" fill="var(--ink-3)" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">${String(new Date(ms).getHours()).padStart(2, '0')}</text>`; }
  let mp = '', on = false; for (let i = i0; i <= i1; i++) { if (n.mAlt[i] > 0) { mp += (on ? 'L' : 'M') + X(i) + ',' + Y(n.mAlt[i]); on = true; } else on = false; }
  if (mp) s += `<path d="${mp}" fill="none" stroke="#CFC8B4" stroke-width="1.2" stroke-dasharray="4 4" opacity=".7"/><text x="${W - rr}" y="${t + 12}" fill="#CFC8B4" font-size="11" text-anchor="end" opacity=".8" font-family="IBM Plex Sans">- - Luna ${Math.round(n.moonIll * 100)}%</text>`;
  let op = ''; for (let i = i0; i <= i1; i++) op += (i === i0 ? 'M' : 'L') + X(i) + ',' + Y(r.alt[i]);
  s += `<path class="trace" d="${op}" fill="none" stroke="var(--ink-3)" stroke-width="1.3"/>`;
  let seg = []; for (let i = i0; i <= i1 + 1; i++) { if (i <= i1 && r.use[i]) seg.push(X(i) + ',' + Y(r.alt[i])); else if (seg.length) { s += `<polyline class="trace" points="${seg.join(' ')}" fill="none" stroke="var(--oiii)" stroke-width="3" stroke-linecap="round"/>`; seg = []; } }
  const tt = Dome.time; if (tt >= n.t[i0] && tt <= n.t[i1]) { const i = i0 + (tt - n.t[i0]) / DT; s += `<line x1="${X(i)}" x2="${X(i)}" y1="${t}" y2="${t + ph}" stroke="#fff" stroke-width="1.2"/>`; }
  return s + '</svg>';
}
function polar(r) {
  const n = state.res.night, p = active(), R = 96, c = 110; const P = (alt, az) => { const rr = (90 - clamp(alt, 0, 90)) / 90 * R, a = az * D2R; return [c - rr * Math.sin(a), c - rr * Math.cos(a)]; };
  const lut = state.res.lut; let hp = ''; for (let a = 0; a <= 360; a += 3) { const q = P(lut[a % 360], a); hp += (a ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }
  let s = `<svg viewBox="0 0 220 236" role="img" aria-label="Percorso nel cielo"><circle cx="${c}" cy="${c}" r="${R}" fill="rgba(228,87,75,.16)"/><path d="${hp}Z" fill="#070A10"/>`;
  s += `<circle cx="${c}" cy="${c}" r="${(90 - (+p.session.minAlt || 0)) / 90 * R}" fill="none" stroke="rgba(69,200,180,.4)" stroke-dasharray="3 3"/>`;
  [30, 60].forEach((a) => (s += `<circle cx="${c}" cy="${c}" r="${(90 - a) / 90 * R}" fill="none" stroke="var(--line-2)" stroke-width=".6"/>`));
  s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--line-2)"/>`;
  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([l, a]) => { const q = P(-10, a); s += `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" fill="var(--ink-2)" font-size="11" text-anchor="middle" font-family="Saira Condensed" font-weight="600">${l}</text>`; });
  let tr = '', on = false; for (let i = n.w0; i <= n.w1; i++) { if (r.alt[i] > 0 && n.darkAll[i]) { const q = P(r.alt[i], r.az[i]); tr += (on ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); on = true; } else on = false; }
  s += `<path class="trace" d="${tr}" fill="none" stroke="var(--ink-3)" stroke-width="1.2"/>`;
  let seg = []; for (let i = n.w0; i <= n.w1 + 1; i++) { if (i <= n.w1 && r.use[i]) { const q = P(r.alt[i], r.az[i]); seg.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); } else if (seg.length) { s += `<polyline class="trace" points="${seg.join(' ')}" fill="none" stroke="var(--oiii)" stroke-width="2.6" stroke-linecap="round"/>`; seg = []; } }
  const [a, z] = altAt(r, Dome.time); if (a > 0) { const q = P(a, z); s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4" fill="#fff"/>`; }
  return s + `<text x="110" y="232" fill="var(--ink-3)" font-size="10" text-anchor="middle" font-family="IBM Plex Sans">come la cupola · pallino = ora scelta</text></svg>`;
}

/* ============================ anteprima del campo ============================ */
const skyCache = new Map();
function setSkyNote(t) { const el = $('#skyNote'); if (el) el.textContent = t; }
function realSkyImage(o, w, h, k, dpr) {
  const pw = Math.min(1400, Math.round(w * dpr)), ph = Math.round(pw * h / w), fw = (w / k) / 60, fh = (h / k) / 60, key = `${o.id}|${pw}|${fw.toFixed(4)}`;
  const c = skyCache.get(key); if (c) return c.ok ? c : null;
  const srcs = [
    { url: `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=${encodeURIComponent('CDS/P/DSS2/color')}&width=${pw}&height=${ph}&fov=${fw.toFixed(4)}&projection=TAN&coordsys=icrs&ra=${o.ra.toFixed(5)}&dec=${o.dec.toFixed(5)}&format=jpg`, label: 'Foto reale DSS2 a colori (CDS)' },
    { url: `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?Survey=${encodeURIComponent('DSS2 Red')}&position=${o.ra.toFixed(5)},${o.dec.toFixed(5)}&Size=${fw.toFixed(4)},${fh.toFixed(4)}&Pixels=${Math.min(pw, 900)},${Math.round(Math.min(pw, 900) * h / w)}&Return=JPEG&Scaling=Log`, label: 'Foto reale DSS2 rosso (NASA SkyView)' }];
  const ent = { img: null, ok: false, label: '' }; skyCache.set(key, ent);
  const tryN = (i) => { if (i >= srcs.length) { setTimeout(() => skyCache.delete(key), 60000); if (state.sel === o.id) setSkyNote('Foto reale non disponibile (sei offline?): anteprima schematica'); return; }
    const img = new Image(); img.onload = () => { ent.img = img; ent.ok = true; ent.label = srcs[i].label; if (state.sel === o.id) drawPreview(); }; img.onerror = () => tryN(i + 1); img.src = srcs[i].url; };
  tryN(0); return null;
}
function drawPreview() {
  const cv = $('#fov'); if (!cv || !state.sel) return; const r = state.byId.get(state.sel); if (!r) return;
  const e = curEval(r), o = r.o, g = e.cfg.geom, f = e.fill;
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 700, h = Math.round(w * 0.62);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mos = state.mosaic && f.nx * f.ny > 1, spanW = mos ? g.W * (0.9 * f.nx + 0.1) : g.W, spanH = mos ? g.H * (0.9 * f.ny + 0.1) : g.H, diag = Math.hypot(spanW, spanH);
  const off = state.frameOff || [0, 0], hasCtx = r.field.ctx.length > 0;
  const needW = Math.max(g.W * 1.45, o.a * 1.25, mos ? diag * 1.05 : 0, hasCtx ? r.field.a * 1.05 : 0, (2 * Math.abs(off[0]) + diag) * 1.05);
  const needH = Math.max(g.H * 1.45, o.a * 1.25, mos ? diag * 1.05 : 0, hasCtx ? r.field.a * 0.8 : 0, (2 * Math.abs(off[1]) + diag) * 1.05);
  const k = Math.min(w / needW, h / needH);
  const cx = w / 2, cy = h / 2, R = rng(hash(o.id));
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7); bg.addColorStop(0, '#0A0E16'); bg.addColorStop(1, '#03050A'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const real = state.realSky ? realSkyImage(o, w, h, k, dpr) : null;
  if (real) { if (/SkyView/.test(real.label)) ctx.filter = 'brightness(0.62) contrast(2.1)'; ctx.drawImage(real.img, 0, 0, w, h); ctx.filter = 'none'; frameOverlay(ctx, e, g, k, w, h, mos); setSkyNote(real.label); return; }
  setSkyNote(state.realSky ? 'Scarico la foto reale DSS2… intanto anteprima schematica' : 'Anteprima schematica: stelle e dettagli illustrativi');
  const A = Math.max(o.a / 2 * k, 2), B = Math.max(o.b / 2 * k, 2), pa = o.pa * D2R;
  const inObj = (x, y) => { const dx = x - cx, dy = y - cy, u = dx * Math.cos(pa) - dy * Math.sin(pa), v = dx * Math.sin(pa) + dy * Math.cos(pa); return Math.sqrt((u / B) ** 2 + (v / A) ** 2); };
  const ns = Math.round(clamp((w / k) * (h / k) * 0.05, 140, 1900));
  for (let i = 0; i < ns; i++) { const x = R() * w, y = R() * h, m = R(); if (o.type === 'DN' && inObj(x, y) < 1 && R() < 0.85) continue; const rad = 0.35 + Math.pow(m, 7) * 2.4, al = 0.25 + 0.75 * Math.pow(m, 2.2); const tt = R(); const col = tt < 0.15 ? '200,215,255' : tt < 0.3 ? '255,225,190' : '240,242,250'; ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); }
  const pal = e.best ? e.best.pal : 'natural', bright = clamp((24.8 - o.sb) / 4, 0.3, 1.1);
  const PAL = { natural: [[235, 85, 115], [245, 120, 140], [205, 75, 95]], hoo: [[230, 70, 58], [230, 90, 70], [70, 205, 195]], sho: [[232, 178, 72], [90, 170, 215], [215, 125, 60]], ha: [[230, 80, 70], [240, 100, 90]], mono: [[225, 225, 230]] };
  const blob = (x, y, rad, rgb, al) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); };
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-pa); ctx.globalCompositeOperation = 'lighter';
  const ell = (fn) => { ctx.save(); ctx.scale(B / A, 1); fn(); ctx.restore(); };
  if (o.type === 'Gx') ell(() => { const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, A * 1.05), a = 0.95 * bright; gr.addColorStop(0, `rgba(255,246,225,${a})`); gr.addColorStop(0.07, `rgba(248,228,195,${a * 0.8})`); gr.addColorStop(0.3, `rgba(205,190,170,${a * 0.34})`); gr.addColorStop(0.65, `rgba(150,165,210,${a * 0.14})`); gr.addColorStop(1, 'rgba(120,140,200,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, A * 1.05, 0, 7); ctx.fill();
    if (o.b / o.a < 0.3) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(18,12,8,.55)'; ctx.lineWidth = A * 0.22; ctx.beginPath(); ctx.moveTo(A * 0.04, -A * 0.85); ctx.lineTo(A * 0.04, A * 0.85); ctx.stroke(); } });
  else if (o.type === 'EN') { const cols = PAL[pal] || PAL.natural; ell(() => { for (let i = 0; i < 80; i++) { const u = gauss(R) * 0.42, v = gauss(R) * 0.42, d = Math.hypot(u, v); const c = (pal === 'hoo' || pal === 'sho') && d < 0.35 && R() < 0.6 ? cols[cols.length - 1] : cols[Math.floor(R() * (cols.length - 1 || 1))]; blob(u * A, v * A, (0.1 + R() * 0.28) * A, c.join(','), (0.05 + R() * 0.11) * bright); } ctx.globalCompositeOperation = 'source-over'; for (let i = 0; i < 9; i++) blob(gauss(R) * 0.4 * A, gauss(R) * 0.4 * A, (0.06 + R() * 0.14) * A, '4,6,10', 0.35); }); }
  else if (o.type === 'SNR') { ctx.lineCap = 'round'; const cols = pal === 'sho' ? [[232, 178, 72], [90, 170, 215]] : [[230, 75, 62], [70, 205, 195]]; for (let i = 0; i < 22; i++) { const rr = 0.55 + R() * 0.45, st = R() * Math.PI * 2, len = 0.3 + R() * 1.1; for (let cI = 0; cI < 2; cI++) { ctx.beginPath(); for (let tt = 0; tt <= len; tt += 0.02) { const q = rr * (cI ? 0.965 : 1) + (R() - 0.5) * 0.015, x = B * q * Math.cos(st + tt), y = A * q * Math.sin(st + tt); tt ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = `rgba(${cols[cI].join(',')},${(0.25 + R() * 0.35) * bright})`; ctx.lineWidth = 0.8 + R() * 2.2; ctx.stroke(); } } }
  else if (o.type === 'PN') { ell(() => { const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, A); gr.addColorStop(0, 'rgba(80,210,200,.15)'); gr.addColorStop(0.55, 'rgba(80,210,200,.7)'); gr.addColorStop(0.8, 'rgba(230,90,80,.55)'); gr.addColorStop(1, 'rgba(230,90,80,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, A, 0, 7); ctx.fill(); }); }
  else if (o.type === 'RN') { ell(() => { blob(0, 0, A, '110,150,235', 0.14 * bright); for (let i = 0; i < 6; i++) blob(gauss(R) * 0.35 * A, gauss(R) * 0.35 * A, (0.25 + R() * 0.35) * A, '120,160,245', 0.2 * bright); }); }
  else if (o.type === 'OC') { const nn = Math.round(clamp(40 + A * 0.9, 40, 260)); for (let i = 0; i < nn; i++) { const x = gauss(R) * 0.42 * B, y = gauss(R) * 0.42 * A, m = R(), rad = 0.6 + Math.pow(m, 3) * 2.4; blob(x, y, rad * 2.2, '215,228,255', 0.35 + m * 0.6); } }
  else if (o.type === 'GC') { blob(0, 0, A * 0.5, '255,235,205', 0.5); for (let i = 0; i < 650; i++) { ctx.fillStyle = `rgba(255,240,215,${0.3 + R() * 0.6})`; ctx.beginPath(); ctx.arc(gauss(R) * 0.28 * A, gauss(R) * 0.28 * A, 0.4 + Math.pow(R(), 4) * 1.4, 0, 7); ctx.fill(); } }
  else if (o.type === 'DN') { ctx.globalCompositeOperation = 'source-over'; ell(() => { blob(0, 0, A * 1.25, '150,120,95', 0.1); const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, A); gr.addColorStop(0, 'rgba(6,5,5,.85)'); gr.addColorStop(0.75, 'rgba(6,5,5,.55)'); gr.addColorStop(1, 'rgba(6,5,5,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, A, 0, 7); ctx.fill(); }); }
  ctx.restore();
  frameOverlay(ctx, e, g, k, w, h, mos);
}
function frameOverlay(ctx, e, g, k, w, h, mos) {
  const cx = w / 2, cy = h / 2, W = g.W * k, H = g.H * k, f = e.fill, r = state.byId.get(state.sel), off = state.frameOff || [0, 0];
  // contesto: polveri e nebulosità attorno (contorni tratteggiati), così si vede cosa entra nel campo
  if (r) r.field.ctx.forEach((c) => {
    const [x, y] = offsetOf(r.o, c), px = cx - x * k, py = cy - y * k;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-(c.pa || 0) * D2R); ctx.setLineDash([3, 4]); ctx.strokeStyle = c.type === 'EN' ? 'rgba(228,87,75,.7)' : 'rgba(227,167,62,.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(3, c.b / 2 * k), Math.max(3, c.a / 2 * k), 0, 0, 7); ctx.stroke(); ctx.restore();
    ctx.setLineDash([]); ctx.font = '600 11px "Saira Condensed", sans-serif'; ctx.fillStyle = c.type === 'EN' ? 'rgba(240,140,130,.95)' : 'rgba(240,195,110,.95)'; ctx.textAlign = 'center'; ctx.fillText(c.id, px, py + 4); ctx.textAlign = 'left';
  });
  ctx.save(); ctx.translate(cx - off[0] * k, cy - off[1] * k); ctx.rotate(-(state.rot - 90) * D2R);
  if (mos) { ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(69,200,180,.8)'; ctx.lineWidth = 1; for (let ix = 0; ix < f.nx; ix++) for (let iy = 0; iy < f.ny; iy++) { const x = (ix - (f.nx - 1) / 2) * W * 0.9, y = (iy - (f.ny - 1) / 2) * H * 0.9; ctx.strokeRect(x - W / 2, y - H / 2, W, H); } ctx.setLineDash([]); }
  else { ctx.strokeStyle = 'rgba(69,200,180,.95)'; ctx.lineWidth = 1.6; ctx.strokeRect(-W / 2, -H / 2, W, H); ctx.lineWidth = 3; const t = Math.min(14, W * 0.08); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(sx * W / 2, sy * H / 2 - sy * t); ctx.lineTo(sx * W / 2, sy * H / 2); ctx.lineTo(sx * W / 2 - sx * t, sy * H / 2); ctx.stroke(); }); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(225,230,238,.85)'; ctx.fillStyle = 'rgba(225,230,238,.9)'; ctx.lineWidth = 1.2; ctx.font = '600 12px "Saira Condensed", sans-serif';
  const bx = w - 34, by = 38; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 22); ctx.moveTo(bx, by); ctx.lineTo(bx - 22, by); ctx.stroke(); ctx.fillText('N', bx - 3, by - 26); ctx.fillText('E', bx - 34, by + 4);
  const nice = [1, 2, 5, 10, 15, 30, 60, 120, 180, 300, 600]; let len = nice[0]; for (const v of nice) if (v * k <= w * 0.22) len = v;
  const sx = 16, sy = h - 18; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len * k, sy); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.moveTo(sx + len * k, sy - 4); ctx.lineTo(sx + len * k, sy + 4); ctx.stroke();
  ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillText(len >= 60 ? (len / 60) + '°' : len + '′', sx, sy - 8);
}
