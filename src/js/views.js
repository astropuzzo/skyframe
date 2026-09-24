'use strict';
/* ============================ pannello di sinistra ============================ */
function moonSvg(k, waxing, r = 9) {
  const rx = r * Math.abs(1 - 2 * k), so = waxing ? 1 : 0, st = ((k > 0.5) === waxing) ? 1 : 0;
  return `<svg width="${2 * r + 2}" height="${2 * r + 2}" viewBox="${-r - 1} ${-r - 1} ${2 * r + 2} ${2 * r + 2}" aria-hidden="true"><circle r="${r}" fill="#1B2230" stroke="#3A4558" stroke-width=".8"/><path d="M0,${-r} A${r},${r} 0 0 ${so} 0,${r} A${rx},${r} 0 0 ${st} 0,${-r}Z" fill="#E9E4D4"/></svg>`;
}
function renderFacts() {
  const p = active(), n = state.res.night, sqm = state.res.sqm;
  const dark = n.first >= 0 ? `${fmtT(n.t[n.first])} – ${fmtT(n.t[n.last] + DT)}` : tx('nessuno');
  let moonS; if (n.moonUpFrac < 0.02) moonS = tx('sotto l’orizzonte col buio'); else { const p2 = []; if (n.mRise) p2.push(tx('sorge {t}', { t: fmtT(n.mRise) })); if (n.mSet) p2.push(tx('tramonta {t}', { t: fmtT(n.mSet) })); moonS = tx('alta per il {p}% del buio', { p: Math.round(n.moonUpFrac * 100) }) + (p2.length ? ' · ' + p2.join(', ') : ''); }
  const win = state.windows && state.windows[0];
  const nextDark = win ? (win.from <= n.t0 + 43200000 ? tx('adesso, fino al {d}', { d: fmtDay(win.to) }) : `${fmtDay(win.from)} → ${fmtDay(win.to)}`) : tx('oltre 6 settimane');
  $('#facts').innerHTML = `
    <div class="fact"><div class="lbl">${tx('Buio')}</div><div class="v num">${dark}</div><div class="s">${fmtDur(n.darkH)} · ${tx('sole sotto {d}°', { d: n.thr })}</div></div>
    <div class="fact"><div class="lbl">${tx('Luna')}</div><div class="v">${moonSvg(n.moonIll, n.waxing)}<span class="num">${Math.round(n.moonIll * 100)}%</span></div><div class="s">${moonS}</div></div>
    <div class="fact"><div class="lbl">${tx('Cielo allo zenit')}</div><div class="v num">SQM ${it(sqm, 2)}</div><div class="s">Bortle ${sqmToBortle(sqm)} · ${p.site.lpSrc ? esc(tx(p.site.lpSrc)) + (p.site.lpAz ? tx(', per direzione') : '') : tx('valore inserito a mano')}</div></div>
    <div class="fact"><div class="lbl">${tx('Notti senza Luna')}</div><div class="v" style="font-size:16px">${nextDark}</div><div class="s">${tx('prossima finestra buia')}</div></div>`;
}
function renderSetups() {
  const el = $('#setups'); const cfgs = state.cfgs;
  if (cfgs.length < 2) { el.hidden = true; return; }
  const top = state.filtered.slice(0, 30); const wins = new Map(cfgs.map((c) => [c.key, 0]));
  top.forEach((r) => wins.set(r.e.cfg.key, wins.get(r.e.cfg.key) + 1));
  const max = Math.max(1, ...wins.values());
  el.hidden = false;
  el.innerHTML = `<h3 class="lbl">${tx('Quale setup stanotte')}</h3><div class="note" style="margin:-4px 0 8px">${tx('Su quanti dei primi {n} target vince ogni configurazione.', { n: top.length })}</div>` + cfgs.map((c) => `<div class="su"><div><div class="n">${esc(c.label)}</div><div class="d">${c.short} · ${fmtDeg(c.geom.W)}×${fmtDeg(c.geom.H)} · ${it(c.geom.px, 2)}″/px</div></div><div class="w">${wins.get(c.key)}</div><div class="meter"><i style="width:${(wins.get(c.key) / max) * 100}%"></i></div></div>`).join('');
}
/* Luoghi a confronto sui primi target della lista: tempo tipico rispetto al luogo attivo e su quanti è il più rapido */
function renderLocs() {
  const el = $('#locs'); if (!el) return;
  if (state.locs.length < 2 || !state.res) { el.hidden = true; return; }
  el.hidden = false;
  const top = state.filtered.slice(0, 30), cur = activeLoc(), all = state.locs.map((l) => ({ l, m: cmpSums(l) })), ready = all.every((x) => x.m);
  const ok = (s) => s && s.usableH >= 0.25 && isFinite(s.h);
  const wins = new Map(), ratio = new Map(), vis = new Map();
  if (ready) {
    for (const r of top) {
      let bl = null, bh = Infinity; for (const { l, m } of all) { const s = m.get(r.o.id); if (ok(s) && s.h < bh) { bh = s.h; bl = l.id; } }
      if (bl) wins.set(bl, (wins.get(bl) || 0) + 1);
    }
    for (const { l, m } of all) {
      const q = top.map((r) => { const s = m.get(r.o.id), h = hoursOf(r.e.best); return ok(s) && r.usableH >= 0.25 && isFinite(h) ? s.h / h : null; }).filter((x) => x != null).sort((a, b) => a - b);
      ratio.set(l.id, q.length ? q[Math.floor(q.length / 2)] : null);
      let n = 0; for (const s of m.values()) if (s.usableH >= 0.25) n++; vis.set(l.id, n);
    }
  }
  const rel = (x) => (x == null ? '' : Math.abs(x - 1) < 0.05 ? tx('tempi simili') : x < 1 ? tx('tempi −{p}%', { p: Math.round((1 - x) * 100) }) : tx('tempi +{p}%', { p: Math.round((x - 1) * 100) }));
  el.innerHTML = `<h3 class="lbl">${tx('Luoghi a confronto')}</h3><div class="note" style="margin:-4px 0 8px">${tx('Stanotte, con questo profilo, sui primi {n} target: tempo tipico rispetto a {l} e su quanti ogni luogo è il più rapido. Clicca per passarci.', { n: top.length, l: esc(cur.site.name) })}</div>` +
    all.map(({ l }) => {
      const me = l.id === cur.id, km = me ? '' : ` · ${Math.round(kmBetween(cur.site, l.site))} km`;
      return `<button class="lc${me ? ' on' : ''}" data-loc="${esc(l.id)}" aria-pressed="${me}"><div class="n">${esc(l.site.name)}<small>SQM ${it(+l.site.sqm, 2)}${km}${ready ? ' · ' + tx('{n} riprendibili', { n: vis.get(l.id) }) : ''}</small></div>` +
        (ready ? `<div class="r">${me ? tx('luogo attivo') : rel(ratio.get(l.id))}</div><div class="w" title="${tx('Target su cui è il luogo più rapido')}">${wins.get(l.id) || 0}</div>` : `<div class="r">${tx('calcolo…')}</div><div class="w"></div>`) + '</button>';
    }).join('');
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
  const tm = Dome.time, n = state.res && state.res.night; if (!n) return;
  $('#clockTime').textContent = fmtT(tm);
  const p = active(), lat = p.site.lat * D2R, J = jd(tm), lst = lstDeg(tm, +p.site.lon), s = sunPos(J);
  const sAlt = altaz(s.ra, s.dec, lst, Math.sin(lat), Math.cos(lat))[0];
  const phase = tx(sAlt > -0.833 ? 'giorno' : sAlt > -6 ? 'crepuscolo civile' : sAlt > -12 ? 'crepuscolo nautico' : sAlt > -18 ? 'crepuscolo astronomico' : 'buio');
  $('#clockWhen').innerHTML = `${new Date(tm).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}<br>${tx('Sole')} ${Math.round(sAlt)}° · ${phase}`;
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
/* bagliore delle luci per la cupola: ambra, intensità dalla parte artificiale del fondo cielo in ogni direzione */
function lpGlow(sky, size, hmax) {
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const c = cv.getContext('2d'), img = c.createImageData(size, size), R = size / 2, d = img.data;
  let lo = Infinity, hi = 0; for (let h = 0; h <= 90; h += 2) for (let az = 0; az < 360; az += 5) { const v = sky.art(h, az); if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, hi * 0.05);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = R - x, dy = R - y, alt = 90 - Math.hypot(dx, dy) / R * hmax; if (alt < -4) continue;
    const az = (Math.atan2(dx, dy) * R2D + 360) % 360, t = clamp((sky.art(Math.max(0, alt), az) - lo) / span, 0, 1), k = (y * size + x) * 4;
    d[k] = 236; d[k + 1] = 160 + Math.round(40 * t); d[k + 2] = 92 + Math.round(50 * t); d[k + 3] = Math.round(255 * (0.03 + 0.5 * Math.pow(t, 1.4)));
  }
  c.putImageData(img, 0, 0); return cv;
}
function lpLegendHTML(st) {
  const stops = LP_RAMP.map(([t, c]) => `rgb(${c}) ${Math.round(t * 100)}%`).join(',');
  return `<div class="lpleg"><div class="bar" style="background:linear-gradient(90deg,${stops})"></div><div class="ends"><span>${it(st.hi, 2)}</span><span>${it(st.lo, 2)} mag/″²</span></div></div>
    <dl class="lpstats"><dt>${tx('Zenit')}</dt><dd>${it(st.zen, 2)}</dd><dt>${tx('Media sopra 30°')}</dt><dd>${it(st.mean30, 2)}</dd>
    <dt>${tx('Più brillante')}</dt><dd>${tx('{m} a {h}° verso {dir} ({az}°)', { m: it(st.bright.m, 2), h: st.bright.h, dir: azName(st.bright.az), az: st.bright.az })}</dd><dt>${tx('Più buio')}</dt><dd>${tx('{m} a {h}° verso {dir}', { m: it(st.dark.m, 2), h: st.dark.h, dir: azName(st.dark.az) })}</dd></dl>`;
}
function drawLpPreview(canvas, site, horizon) {
  const sky = skyModel(site), st = lpStats(sky), dpr = Math.min(2, devicePixelRatio || 1), S = 340;
  canvas.width = S * dpr; canvas.height = S * dpr;
  const c = canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(lpImage(sky, Math.round(S * dpr), 90, horizonLUT(horizon), st), 0, 0);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.strokeStyle = 'rgba(255,255,255,.18)'; [30, 60].forEach((a) => { c.beginPath(); c.arc(S / 2, S / 2, S / 2 * (90 - a) / 90, 0, 7); c.stroke(); });
  c.font = '600 13px "Saira Condensed", sans-serif'; c.textAlign = 'center';
  [['N', S / 2, 16], ['S', S / 2, S - 6], [tx('E'), 12, S / 2 + 4], [tx('O'), S - 12, S / 2 + 4]].forEach(([l, x, y]) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(l, x + 1, y + 1); c.fillStyle = '#fff'; c.fillText(l, x, y); });
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
  return a <= 0 ? `<span style="color:var(--ink-4)">${tx('sotto')}</span><small>${tx('orizzonte')}</small>` : `${Math.round(a)}°<small>${azName(z)} · ${tx(a >= b ? 'libero' : 'coperto')}</small>`;
}
function rowHTML(r, i) {
  const o = r.o, e = r.e, b = e.best, n = state.res.night;
  let plan;
  if (!b) plan = `<span style="color:var(--ink-3)">—</span><small>${tx('serve la banda larga')}</small>`;
  else {
    const h = hoursOf(b), hm = moonHoursOf(b);
    plan = `<b title="${tx('Ore di posa senza Luna, lungo il percorso del target in questa notte')}">${fmtH(h)}</b><span class="nt">${nightsTag(r, e)}</span>${state.cfgs.length > 1 ? `<span class="rig" title="${tx('Setup consigliato')}: ${esc(e.cfg.label)} · ${e.cfg.short}"><i></i><span>${esc(e.cfg.tag)}</span><em>${e.cfg.short}</em></span>` : ''}<small>${esc(b.label)}${b.deep ? ` · ${tx('profondo')} ${fmtH(deepHoursOf(b))}` : ''}${isFinite(hm) && hm > h * 1.15 ? ` · <span class="moonh">${tx('con la Luna di stanotte {h}', { h: fmtH(hm) })}</span>` : ''}</small>`;
  }
  plan += `<span class="lh">${locHint(r)}</span>`;
  const win = r.first >= 0 ? `${fmtT(n.t[r.first])}–${fmtT(n.t[r.last] + DT)}` : '';
  const vis = r.usableH > 0 ? `${fmtDur(r.usableH)} · max ${Math.round(r.maxA)}°<small>${win}</small>` : `<span style="color:var(--ink-3)">${tx('non riprendibile')}</span><small>${tx('coperto o sotto {a}°', { a: active().session.minAlt })}</small>`;
  const size = `${o.a >= 10 ? Math.round(o.a) : it(o.a, 1)}′${o.b !== o.a ? '×' + (o.b >= 10 ? Math.round(o.b) : it(o.b, 1)) + '′' : ''}`;
  return `<div class="row${r.usableH < 0.25 ? ' dim' : ''}${state.sel === o.id ? ' sel' : ''}${i < 24 ? ' enter' : ''}" style="${i < 24 ? `animation-delay:${i * 22}ms` : ''}" role="button" tabindex="0" data-id="${esc(o.id)}">
    <div class="c-score"><div class="score" data-v="${r.score}" style="--c:${scoreColor(r.score)}"><b>${r.score}</b></div></div>
    <div class="c-name"><div class="nm"><span class="id">${esc(o.id)}</span><span class="nick">${esc(o.nick)}</span></div>
      <div class="meta"><span class="tchip" style="color:${TYPE_COLOR[o.type]}">${tx(TYPES_PL[o.type])}</span><span class="num">${size}</span><span>${esc(CONST_NAMES[o.con] || o.con)}</span>${o.classic ? '' : `<span class="gem">${tx('fuori dai soliti')}</span>`}</div></div>
    <div class="c-frame frame">${frameGlyph(r)}<div>${esc(tx(e.fill.label))}<small>${esc(e.fill.sub)}</small></div></div>
    <div class="c-vis vis">${spark(r)}<div>${vis}</div></div>
    <div class="c-plan plan">${plan}</div>
    <div class="c-now now">${nowCell(r)}</div></div>`;
}
/* Notti di ripresa: dal calendario notte per notte quando è pronto, altrimenti (per un attimo) la stima con notti
   tutte come questa, in grigio. Se basta questa notte il calendario è immediato. */
const nNights = (n) => (n <= 1 ? tx('1 notte') : tx('{n} notti', { n }));
function nightsTag(r, e, C) {
  const b = e.best; if (!b) return ''; C = C || state.res.C;
  const A = C.ahead; let cal = A && (A.cache.get(calKey(r, e, false)) || A.cache.get(calKey(r, e, true)));
  if (!cal && C.active.session.moon !== 'dark' && r.usableH >= CAL_MIN_H && b.tonight <= r.usableH) cal = shootCalendar(C, r, e, false);
  if (!cal) return isFinite(b.nights) ? `<span class="nights est" title="${tx('Stima con notti tutte come questa: il conto notte per notte arriva tra un attimo')}">≈ ${Math.max(1, Math.ceil(b.nights))}</span>` : '';
  return calBadge(cal);
}
function calBadge(cal) {
  if (!cal.done) return `<span class="nights n3" title="${tx('Con cielo sereno, in un anno se ne fa il {p}%', { p: Math.round(cal.prog * 100) })}">${tx('oltre un anno')}</span>`;
  const n = cal.sessions, cls = n <= 1 ? 'n1' : n <= 3 ? 'n2' : 'n3';
  return `<span class="nights ${cls}" title="${tx('Con cielo sereno: {n} di ripresa, l’ultima {d}', { n: nNights(n), d: fmtDayLong(cal.done) })}">${nNights(n)}</span>`;
}
/* calendari delle righe visibili, a pezzi, dopo che la lista è disegnata */
let ntJob = 0;
function fillNights() {
  const job = ++ntJob, C = state.res.C, rows = $$('#list .row[data-id]'); let i = 0;
  const step = () => {
    if (job !== ntJob || C !== state.res.C) return;
    const t0 = performance.now();
    while (i < rows.length && performance.now() - t0 < 12) {
      const el = rows[i++], r = state.byId.get(el.dataset.id), x = el.querySelector('.nt');
      if (!r || !x || !x.querySelector('.est')) continue;
      shootCalendar(C, r, r.e, false); x.innerHTML = nightsTag(r, r.e);
    }
    if (i < rows.length) setTimeout(step, 0);
  };
  setTimeout(step, 60);
}
/* un altro luogo salvato dove il target costa molto meno tempo (o dove si riprende, se qui no) */
function locHint(r) {
  const b = betterLoc(r); if (!b) return '';
  const name = esc(b.l.site.name), h = fmtH(b.s.h);
  const title = b.gain == null ? tx('Da qui stanotte non si riprende; a {l} bastano {h}', { l: name, h }) : tx('A {l} basterebbero {h} invece di {x}', { l: name, h, x: fmtH(b.here) });
  return `<span class="lochint" title="${title}"><i aria-hidden="true"></i>${name} ${h}${b.gain != null ? ` <em>−${Math.round(b.gain * 100)}%</em>` : ''}</span>`;
}
function renderList() {
  const L = state.filtered, shown = L.slice(0, state.page);
  const visN = state.res.results.filter((r) => r.usableH >= 0.25).length;
  $('#toListN').textContent = L.length;
  $('#count').innerHTML = tx('{n} target su {v} riprendibili la notte del {d}', { n: `<span class="num">${L.length}</span>`, v: visN, d: new Date(state.res.night.t0).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) });
  $('#list').innerHTML = shown.length ? shown.map(rowHTML).join('') + (L.length > shown.length ? `<button class="btn more" id="moreBtn">${tx('Mostra altri {n}', { n: Math.min(60, L.length - shown.length) })}</button>` : '') : `<div class="empty">${tx('Nessun target con questi filtri. Allarga i criteri o azzera i filtri.')}</div>`;
  requestAnimationFrame(() => $$('#list .score').forEach((el) => el.style.setProperty('--v', el.dataset.v)));
  const mb = $('#moreBtn'); if (mb) mb.onclick = () => { state.page += 60; renderList(); };
  fillNights();
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
/* Dettaglio di un target: in alto (fisso) nome, punteggio, riassunto e quattro schede; sotto solo la scheda scelta.
   Piano = la risposta (quanto, con cosa, dove conviene); Quando = notti, periodo, la notte, l'anno; Campo = anteprima e
   coordinate; Consigli. La scheda scelta resta quella quando si apre un altro target. */
/* ============================ immagini del target ============================ */
/* In cima al dettaglio: il target visto da diverse survey (servizio hips2fits del CDS) e le foto con licenza libera di
   Wikimedia Commons, prima quelle degli astrofili. Una striscia sola: si tocca e si vede nel riquadro. */
const SURVEYS = [
  { id: 'nsns', hips: 'simg.de/P/NSNS/DR0_1/tc8', label: 'NSNS colori', credit: 'Northern Sky Narrowband Survey, S. Ziegenbalg · CC BY-NC-SA 4.0', ok: (o) => o.dec > -15 },
  { id: 'dss', hips: 'CDS/P/DSS2/color', label: 'DSS2 colori', credit: 'DSS2 · CDS', ok: () => true },
  { id: 'ps', hips: 'CDS/P/PanSTARRS/DR1/color-z-zg-g', label: 'Pan-STARRS', credit: 'Pan-STARRS1 · CDS', ok: (o) => o.dec > -29 },
  { id: 'ha', hips: 'simg.de/P/NSNS/DR0_1/halpha8', label: 'Hα (NSNS)', credit: 'Northern Sky Narrowband Survey, S. Ziegenbalg · CC BY-NC-SA 4.0', ok: (o) => o.dec > -15 && !!LINES[o.lk] },
];
const gal = { src: LS.get('sf.galSrc', ''), zoom: 1, for: '', photo: null };
/* campo della vista: l'oggetto con un po' di contesto, mai più largo del campo del setup */
function galFov(r, e) {
  const g = e.cfg.geom, o = r.o;
  return clamp(Math.max(o.a * 2.2, r.field.a * 1.25, 8) / 60, 0.13, Math.max(0.3, g.W / 60)) * gal.zoom;
}
/* survey proposta: a grande campo la NSNS (sembra una foto amatoriale), da vicino Pan-STARRS, altrimenti DSS2 */
function galSurvey(o, fov) {
  const pick = SURVEYS.find((s) => s.id === gal.src && s.ok(o));
  if (pick) return pick;
  const id = fov >= 0.6 && o.dec > -15 && o.type !== 'Gx' && o.type !== 'GC' ? 'nsns' : o.dec > -29 && fov < 0.6 ? 'ps' : 'dss';
  return SURVEYS.find((s) => s.id === id);
}
const hipsUrl = (hips, o, fov, w, h) => `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=${encodeURIComponent(hips)}&width=${w}&height=${h}&fov=${fov.toFixed(4)}&projection=TAN&coordsys=icrs&ra=${o.ra.toFixed(5)}&dec=${o.dec.toFixed(5)}&format=jpg`;

/* foto con licenza libera da Wikimedia Commons: autore e licenza sempre in vista */
const photoCache = new Map();
const PRO_RX = /NASA|\bESA\b|\bESO\b|NOIRLab|NOAO|KPNO|Spitzer|JPL|Webb|Hubble|Chandra|CFHT|Subaru|AURA|STScI|Caltech|\bWISE\b|2MASS|SDSS|Gemini|Herschel|Planck|Observatory|Osservatorio/i;
const SKIP_RX = /\b(map|chart|finder|finding|diagram|spectr|plot|graph|logo|stamp|locator|constellation|sketch|drawing|poster|label|annotated|location|position|orbit|star ?chart)/i;
function commonsPhotos(o) {
  if (photoCache.has(o.id)) return photoCache.get(o.id);
  const job = (async () => {
    const terms = new Set();
    if (/^M \d+$/.test(o.id)) terms.add('Messier ' + o.id.slice(2)); else terms.add(o.id);
    if (o.nick) terms.add(o.nick);
    o.alias.filter((a) => /^(NGC|IC) \d+$/.test(a)).slice(0, 2).forEach((a) => terms.add(a));
    const q = 'filetype:bitmap ' + [...terms].map((t) => `"${t}"`).join(' OR ');
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=40&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=320&iiextmetadatafilter=Artist|LicenseShortName`;
    const res = await fetch(url, { headers: { 'Api-User-Agent': `Skyframe/${window.SKYFRAME_VERSION || ''} (https://github.com/astropuzzo/skyframe)` } });
    if (!res.ok) return [];
    const pages = Object.values(((await res.json()).query || {}).pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const out = [];
    for (const p of pages) {
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !/jpeg|png/.test(ii.mime) || ii.width < 500 || ii.height < 350 || !ii.thumburl) continue;
      const title = p.title.replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, '');
      if (SKIP_RX.test(title)) continue;
      const m = ii.extmetadata || {}, artist = String((m.Artist || {}).value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      // Wikimedia serve le miniature solo in larghezze standard (330, 960, 1280…): la grande è da 1280
      const big = ii.width > 1280 ? ii.thumburl.replace(/\/\d+px-/, '/1280px-') : ii.url;
      out.push({ title, thumb: ii.thumburl, big, page: ii.descriptionurl, artist: artist || tx('autore sconosciuto'), license: String((m.LicenseShortName || {}).value || '').replace(/<[^>]+>/g, ''), pro: PRO_RX.test(artist + ' ' + title) });
    }
    // prima le foto degli astrofili, poi quelle degli osservatori; niente doppioni (stessa foto in jpg e png)
    const seen = new Set();
    return out.sort((a, b) => a.pro - b.pro).filter((x) => { const k = x.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16);
  })().catch(() => []);
  photoCache.set(o.id, job); return job;
}

function galHTML(r, e) {
  const o = r.o;
  return `<div class="dgal">
    <div class="gview" id="gView"><img id="gImg" alt="${esc(o.id)}" decoding="async"><div class="gload" id="gLoad">${tx('Carico l’immagine…')}</div>
      <div class="gzoom" id="gZoom"><button class="gz" data-z="0.5" aria-label="${tx('Allarga il campo')}" title="${tx('Allarga il campo')}">−</button><button class="gz" data-z="2" aria-label="${tx('Stringi sul target')}" title="${tx('Stringi sul target')}">+</button></div></div>
    <div class="gcap" id="gCap"></div>
    <div class="gstrip" id="gStrip">${SURVEYS.filter((s) => s.ok(o)).map((s) => `<button class="gs" data-sv="${s.id}">${esc(tx(s.label))}</button>`).join('')}<span class="gph" id="gPh"><span class="gsp">${tx('Cerco foto…')}</span></span></div>
  </div>`;
}
function galShow(r, e) {
  const o = r.o, img = $('#gImg'), box = $('#gView'); if (!img || !box) return;
  if (gal.for !== o.id) { gal.for = o.id; gal.zoom = 1; gal.photo = null; }
  const load = $('#gLoad'), cap = $('#gCap'), zoom = $('#gZoom');
  const w = Math.max(320, box.clientWidth || 600), h = Math.round(w * (w < 500 ? 0.66 : 0.46));
  box.style.height = h + 'px';
  let src, capHTML;
  if (gal.photo) {
    const p = gal.photo; src = p.big;
    capHTML = `${esc(p.artist)}${p.license ? ' · ' + esc(p.license) : ''} · <a href="${esc(p.page)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a>`;
    zoom.hidden = true; box.classList.add('photo');
    $$('#gStrip .gs').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  } else {
    const fov = galFov(r, e), s = galSurvey(o, fov), dpr = Math.min(2, devicePixelRatio || 1), pw = Math.min(1400, Math.round(w * dpr)), ph = Math.round(pw * h / w);
    src = hipsUrl(s.hips, o, fov, pw, ph);
    capHTML = `${esc(tx(s.label))} · ${tx('campo {f}', { f: fmtDeg(fov * 60) })} · ${esc(s.credit)}`;
    zoom.hidden = false; box.classList.remove('photo');
    $$('#gStrip .gs').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sv === s.id)));
  }
  $$('#gStrip .gt').forEach((b) => b.setAttribute('aria-pressed', String(!!gal.photo && b.dataset.i != null && gal.list && gal.list[+b.dataset.i] === gal.photo)));
  cap.innerHTML = capHTML;
  if (img.dataset.src === src) return;
  img.dataset.src = src; load.hidden = false; load.textContent = tx('Carico l’immagine…'); img.classList.add('wait');
  img.onload = () => { if (img.dataset.src === src) { load.hidden = true; img.classList.remove('wait'); } };
  img.onerror = () => { if (img.dataset.src === src) load.textContent = tx('Immagine non disponibile (sei offline o il target è fuori da questa survey)'); };
  img.src = src;
}
function wireGallery(r, e) {
  const o = r.o;
  galShow(r, e);
  $('#gStrip').onclick = (ev) => {
    const s = ev.target.closest('.gs'), t = ev.target.closest('.gt');
    if (s) { gal.src = s.dataset.sv; gal.photo = null; LS.set('sf.galSrc', gal.src); galShow(r, e); }
    else if (t && gal.list) { gal.photo = gal.list[+t.dataset.i]; galShow(r, e); }
  };
  $('#gZoom').onclick = (ev) => { ev.stopPropagation(); const b = ev.target.closest('.gz'); if (!b) return; gal.zoom = clamp(gal.zoom * +b.dataset.z, 0.25, 8); galShow(r, e); };
  // tocco sull'immagine: a tutto schermo (sul telefono si guarda meglio); un altro tocco o Esc chiude
  $('#gView').onclick = () => {
    const img = $('#gImg'); if (!img || !img.src || img.classList.contains('wait')) return;
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog');
    lb.innerHTML = `<img src="${esc(img.src)}" alt="${esc(o.id)}"><div class="lbcap">${$('#gCap').innerHTML}</div>`;
    const close = () => { lb.remove(); document.removeEventListener('keydown', key, true); };
    const key = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    lb.onclick = (ev) => { if (!ev.target.closest('a')) close(); };
    document.addEventListener('keydown', key, true); document.body.appendChild(lb);
  };
  commonsPhotos(o).then((list) => {
    const ph = $('#gPh'); if (!ph || state.sel !== o.id) return;
    gal.list = list;
    const more = `<a class="gs ext" href="https://www.astrobin.com/search/?q=${encodeURIComponent(o.id)}" target="_blank" rel="noopener">${tx('Altre su AstroBin ↗')}</a>`;
    ph.innerHTML = list.length
      ? list.map((p, i) => `<button class="gt${p.pro ? ' pro' : ''}" data-i="${i}" title="${esc(p.artist)}${p.license ? ' · ' + esc(p.license) : ''}"><img src="${esc(p.thumb)}" alt="" loading="lazy"></button>`).join('') + more
      : `<span class="gsp">${tx('Nessuna foto libera trovata')}</span>` + more;
  });
}

const D_TABS = [['piano', 'Piano'], ['quando', 'Quando'], ['campo', 'Campo'], ['consigli', 'Consigli']];
function setDTab(t) {
  if (!D_TABS.some(([k]) => k === t)) t = 'piano';
  state.dTab = t; LS.set('sf.dTab', t);
  $$('#drawer .dtab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $$('#drawer .tabp').forEach((p) => { p.hidden = p.dataset.tab !== t; });
  // la scheda nuova parte subito sotto la testata fissa
  const d = $('#drawer'), top = $('#drawer .tabp:not([hidden])'), head = $('#drawer .d-top'), tabs = $('#drawer .dtabs');
  const stick = (head ? head.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
  if (d && top && d.scrollTop > top.offsetTop - stick) d.scrollTop = top.offsetTop - stick;
  if (t === 'campo') requestAnimationFrame(drawPreview);
}
function renderDetail() {
  const r = state.byId.get(state.sel); if (!r) { closeDetail(); return; }
  const o = r.o, e = curEval(r), n = state.res.night, p = active(), g = e.cfg.geom, b = e.best;
  // strategie alternative con filtri che non hai (solo per questo target)
  const U = usableSteps(r, n, state.res.sky);
  const altS = alternativeStrategies(e.cfg.profile.camera.type, ownedFilters(e.cfg.profile));
  const altEval = evalStrategies(o, altS, e.K, U, state.res.Q, r.T, r.field).filter((s) => isFinite(s.dark) || s.ideal);
  const cur = hoursOf(b);
  const bestAlt = altEval.map((s) => ({ name: (s.alt.brand ? s.alt.brand + ' ' : '') + s.alt.name, h: hoursOf(s) * (b ? b.panels || 1 : 1), pen: s.penalty })).filter((x) => x.h < cur * 0.7).sort((x, y) => x.h * x.pen - y.h * y.pen)[0];
  // con le polveri attorno: quanto basterebbe per la sola parte luminosa (stessa strategia, senza il requisito delle polveri)
  let coreH = null;
  if (b && dustOf(o, r.field)) {
    const s2 = evalStrategies({ ...o, dust: 0 }, e.cfg.strategies, e.K, U, state.res.Q, r.T, { ...r.field, ctx: r.field.ctx.filter((c) => !bigDust(o, c)) }).find((x) => x.id === b.id);
    if (s2) coreH = hoursOf(s2) * (b.panels || 1);
  }
  const tips = adviceFor(r, e, { night: n, nextDark: state.nextDarkTxt, alt: bestAlt, sky: state.res.sky, framing: framingFor(o, r.field, e.cfg.geom), coreH });
  const plan = planOf(b, e.cfg, 'dark'), cal = b ? shootCalendar(state.res.C, r, e, true) : null;
  const planTot = plan ? plan.filter((x) => !x.optional).reduce((a, x) => a + x.h, 0) : 0;
  const planDeep = plan ? plan.filter((x) => !x.optional).reduce((a, x) => a + x.hDeep, 0) : 0;
  const alts = e.strat.filter((s) => s !== b).sort((x, y) => hoursOf(x) * x.penalty - hoursOf(y) * y.penalty).slice(0, 3);
  const aladin = `https://aladin.cds.unistra.fr/AladinLite/?target=${encodeURIComponent((o.ra / 15).toFixed(5) + ' ' + (o.dec >= 0 ? '+' : '') + o.dec.toFixed(5))}&fov=${(Math.max(g.W, o.a) * 1.4 / 60).toFixed(2)}`;
  const stel = `https://stellarium-web.org/skysource/${encodeURIComponent(o.id.replace(/\s+/g, ''))}`;
  const size = `${o.a}′${o.b !== o.a ? ' × ' + o.b + '′' : ''}`;
  // rotazione e centro migliori per questa configurazione (ricalcolati quando cambi setup)
  const fr = framingFor(o, r.field, g), bestRot = fr.free ? 90 : fr.pa;
  if (state.rotFor !== e.cfg.key) { state.rot = bestRot; state.frameOff = [fr.dx, fr.dy]; state.rotFor = e.cfg.key; }
  const tab = state.dTab || LS.get('sf.dTab', 'piano');

  // riassunto sempre visibile: ore senza Luna, notti e fine, strategia
  const nightsTxt = !cal ? '' : !cal.done ? tx('oltre un anno') : cal.sessions <= 1 && cal.done === cal.nights[0].t0 ? tx('si chiude stanotte') : `${nNights(cal.sessions)} · ${tx('fino a {d}', { d: fmtDay(cal.done) })}`;
  const summary = b ? `<b>${fmtH(planTot)}</b> ${tx('senza Luna')}${nightsTxt ? ` · <b>${nightsTxt}</b>` : ''}<span class="strat"> · ${esc(b.label)}</span>` : `<span class="strat">${tx('Con i filtri di questo profilo non c’è una strategia adatta a {t}.', { t: tx(TYPES_PL[o.type]).toLowerCase() })}</span>`;
  const scoreTip = `${tx('Punteggio')} ${e.score}/100 · ${tx('Inquadratura')} ${Math.round(e.fill.score * 100)} · ${tx('Visibilità')} ${Math.round(r.vis * 100)} · ${tx('Impegno')} ${Math.round(e.effort * 100)}`;

  // fatti rapidi della scheda Piano
  const win = r.first >= 0 ? `${fmtT(n.t[r.first])}–${fmtT(n.t[r.last] + DT)}` : '';
  const hm = moonHoursOf(b), moonCost = b && isFinite(hm) && hm > cur * 1.15;
  const bl = betterLoc(r);
  const chips = [
    r.usableH >= 0.25 ? `<span class="hc">${tx('Stanotte libero {w} · max {a}°', { w: win, a: Math.round(r.maxA) })}</span>` : `<span class="hc bad">${tx('Stanotte non si riprende')}</span>`,
    moonCost ? `<span class="hc warn">${tx('Luna {p}%: stanotte {h}', { p: Math.round(n.moonIll * 100), h: fmtH(hm) })}</span>` : '',
    `<span class="hc" id="periodChip">${tx('Periodo…')}</span>`,
    `<span class="hc">${esc(tx(e.fill.label))}${e.fill.sub ? ` · ${esc(e.fill.sub)}` : ''}</span>`,
    bl ? `<span class="hc loc">${esc(bl.l.site.name)} ${fmtH(bl.s.h)}${bl.gain != null ? ` (−${Math.round(bl.gain * 100)}%)` : ''}</span>` : '',
  ].join('');
  // setup del profilo: scelta compatta
  const cfgs = r.evals.length > 1 ? `<div class="cfgs" role="radiogroup" aria-label="${tx('Setup')}">${r.evals.map((x) => `<button class="cfg" role="radio" data-cfg="${esc(x.cfg.key)}" aria-checked="${x.cfg.key === e.cfg.key}"><span class="t">${esc(x.cfg.tag)}</span><span class="d">${x.cfg.short} · ${x.best ? fmtH(hoursOf(x.best)) : '—'}</span><span class="sc" style="color:${scoreColor(x.score)}">${x.score}</span></button>`).join('')}</div>` : '';

  const planHTML = plan ? `<div class="plan-card"><div class="head"><span class="t">${esc(b.label)}</span><span class="h">${fmtH(planTot)}</span></div>
      <div class="pc-sub">${tx('qualità {q} · {cfg} a {f} · senza Luna, lungo il percorso del target in questa notte', { q: tx(QLABEL[p.session.quality] || 'buona'), cfg: esc(e.cfg.label), f: e.cfg.short })}</div>
      ${b.deep ? `<div class="deep">${tx('Per far uscire anche l’Hα diffuso attorno ({r} R nella mappa all-sky di Finkbeiner) servono <b>{h}</b> in tutto.', { r: it(o.ha, 1), h: fmtH(planDeep) })}</div>` : ''}
      <div class="steps">${plan.map((s) => `<div class="step${s.optional ? ' opt' : ''}"><div class="f">${esc(s.filter)}<small>${esc(s.what)}${s.optional ? ' · ' + tx('facoltativo') : s.drive ? ' · ' + tx('il tempo lo decidono:') + ' ' + esc(s.drive) : ''}</small></div><div class="h">${fmtH(s.h)}${s.hDeep > s.h * 1.15 ? `<small>${fmtH(s.hDeep)} ${tx('profondo')}</small>` : ''}</div><div class="sb">sub ${s.sub} s</div></div>`).join('')}</div>
      ${b.panels > 1 ? `<div class="note">${tx('Tempi totali per {n} pannelli di mosaico.', { n: b.panels })}</div>` : ''}
      <div class="note">${moonCost ? tx('Con la Luna di stanotte ne servirebbero {m}: le notti di ripresa (scheda Quando) tengono conto della Luna notte per notte.', { m: fmtH(hm) }) + ' ' : ''}${tx('Sub scelti filtro per filtro: coprono il rumore di lettura con il cielo di stanotte (Luna compresa) e restano nei valori pratici di quel tipo di filtro.')}</div>
      ${alts.length ? `<details class="alts"><summary>${tx('Altre strade, non da sommare')} <span class="num">(${alts.length})</span></summary>${alts.map((s) => { const c = shootCalendar(state.res.C, r, { ...e, best: s }, false); return `<div class="a"><span>${esc(s.label)}</span><b>${fmtH(hoursOf(s))}${c ? ` · ${c.done ? nNights(c.sessions) : tx('oltre un anno')}` : ''}</b></div>`; }).join('')}</details>` : ''}</div>`
    : `<p class="hint">${tx('Con i filtri di questo profilo non c’è una strategia adatta a {t}.', { t: tx(TYPES_PL[o.type]).toLowerCase() })}</p>`;

  $('#drawer').innerHTML = `
  <div class="d-top">
    <div class="d-head">
      <div class="score" data-v="${e.score}" style="--c:${scoreColor(e.score)};--v:${e.score}" title="${esc(scoreTip)}"><b>${e.score}</b></div>
      <div class="d-title"><h2>${esc(o.id)}</h2>${o.nick ? `<span class="nick">${esc(o.nick)}</span>` : ''}</div>
      <button class="btn ghost x" id="dClose" aria-label="${tx('Chiudi')}"><span class="xl">${tx('Chiudi')}</span><span class="xs" aria-hidden="true">✕</span></button>
    </div>
    <div class="d-sum">${summary}</div>
  </div>
  ${galHTML(r, e)}
  <nav class="dtabs" role="tablist">${D_TABS.map(([k, l]) => `<button class="dtab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${tx(l)}</button>`).join('')}</nav>

  <section class="tabp" data-tab="piano" ${tab === 'piano' ? '' : 'hidden'}>
    <div class="d-meta">${tx('{type} in {con}', { type: tx(TYPES[o.type]), con: esc(CONST_NAMES[o.con] || o.con) })} · ${size}${o.mag != null ? ' · mag ' + it(o.mag, 1) : ''} · ${tx('LS')} ${it(o.sb, 1)} mag/″²${o.alias.length ? ' · ' + esc(o.alias.slice(0, 4).join(', ')) : ''}</div>
    <div class="hchips">${chips}</div>
    ${cfgs}
    ${planHTML}
    ${state.locs.length > 1 ? `<div class="sec"><h3>${tx('Dove conviene')} <small>${tx('stanotte, con questo profilo e il setup migliore in ogni luogo')}</small></h3><div class="loccmp" id="locCmp"></div></div>` : ''}
  </section>

  <section class="tabp" data-tab="quando" ${tab === 'quando' ? '' : 'hidden'}>
    ${cal ? `<div class="sec first"><h3>${tx('Notti di ripresa')} <small>${tx('una per una da questa in avanti, con il cielo sempre sereno')}</small></h3><p class="calsum">${calSummary(cal, b)}</p><div class="chartbox calchart" id="calChart"></div></div>` : ''}
    <div class="period" id="period"><span class="lbl">${tx('Periodo giusto')}</span><span class="pt">${tx('Calcolo quando conviene…')}</span></div>
    <div class="sec"><h3>${tx('La notte')} <small>${tx('zona rossa: coperto dall’orizzonte o sotto {a}°', { a: p.session.minAlt })}</small></h3><div class="charts"><div class="chartbox draw ia" id="altBox">${altChart(r)}</div><div class="chartbox draw ia" id="polBox">${polar(r)}</div></div><p class="note">${tx('Passa sopra i grafici per leggere ora e altezza; clicca o trascina per spostare l’ora (si muove anche la cupola).')}</p></div>
    <div class="sec"><h3>${tx('Nei prossimi 12 mesi')} <small>${tx('ore libere col buio, senza contare la Luna · clicca un mese per aprirne la notte più buia')}</small></h3><div class="chartbox season" id="season"></div></div>
  </section>

  <section class="tabp" data-tab="campo" ${tab === 'campo' ? '' : 'hidden'}>
    <div class="sec first"><h3>${tx('Campo inquadrato')} <small>${fmtDeg(g.W)} × ${fmtDeg(g.H)} · ${Math.round(g.fEff)} mm · ${tx('nord in alto, est a sinistra')}</small></h3>
      <div class="fovbox"><canvas id="fov" aria-label="${tx('Anteprima del campo')}"></canvas>
      <div class="fovctl"><label for="rot">${tx('Lato lungo a PA')}</label><input id="rot" type="range" min="0" max="179" step="1" value="${Math.round(state.rot)}"><span class="num" id="rotV">${Math.round(state.rot)}°</span>
        <button class="btn sm ghost" id="rotBest">${tx('Allinea')} (${bestRot}°)</button>
        ${e.fill.nx * e.fill.ny > 1 ? `<label class="chk"><input type="checkbox" id="mos" ${state.mosaic ? 'checked' : ''}> ${tx('Mosaico')} ${e.fill.nx}×${e.fill.ny}</label>` : ''}
        <label class="chk"><input type="checkbox" id="realSky" ${state.realSky ? 'checked' : ''}> ${tx('Foto reale')}</label></div></div>
      <p class="note"><span id="skyNote"></span>. ${tx('Rettangolo, scala e orientamento sono calcolati sul tuo sensore.')}</p></div>
    <div class="d-actions"><button class="btn sm" id="copyCoord">${tx('Copia coordinate J2000')}</button>${Math.hypot(fr.dx, fr.dy) > 2 ? `<button class="btn sm" id="copyFrame">${tx('Copia centro inquadratura')}</button>` : ''}<a class="btn sm ghost" href="${aladin}" target="_blank" rel="noopener">Aladin ↗</a><a class="btn sm ghost" href="${stel}" target="_blank" rel="noopener">Stellarium Web ↗</a></div>
  </section>

  <section class="tabp" data-tab="consigli" ${tab === 'consigli' ? '' : 'hidden'}>
    <div class="tips first">${tips.map((q) => `<div class="tip k-${esc(q.k.replace(/[^\w]/g, ''))}"><div class="k">${esc(tx(q.k))}</div><div>${esc(q.t)}</div></div>`).join('')}</div>
    <details class="how"><summary>${tx('Come vengono stimati i tempi')}</summary>
      <p>${tx('HOW1')}</p>
      <p>${tx('HOW2')}</p>
      <p>${tx('HOW3')}</p>
      <p>${tx('HOW4')}</p></details>
  </section>`;
  const HOW_IT = `<p>Ogni filtro è modellato con le sue bande reali (schede dei produttori). Per ogni banda calcolo quanta luce dell’oggetto passa (continuo più le righe Hα, [NII], Hβ, OIII, SII, pesate dalla risposta dei pixel rossi, verdi e blu se la camera è a colori) e quanto fondo cielo: il tuo SQM, diviso tra un continuo tipo LED e le righe di mercurio e sodio, più la luce lunare di ogni 5 minuti. Il target si segue lungo il suo percorso nella notte scelta: a ogni passo cambiano altezza, estinzione e cielo nella sua direzione. Il tempo mostrato è quello <b>senza Luna</b> su quel percorso, cioè quanto chiede il target sotto quel cielo, confrontabile fra luoghi e filtri; quanto costerebbe con la Luna di stanotte è indicato a parte, e il calendario delle notti mette la Luna di ogni notte (o conta solo le ore senza Luna, se lo scegli nel profilo).</p>
    <p>Il fondo cielo cambia con la direzione: SQM allo zenit dall’atlante di Lorenz 2025 (o dal tuo valore), più brillante verso l’orizzonte e verso le luci con i pesi per azimut calcolati dall’atlante.</p>
    <p>La qualità è un SNR per elemento di risoluzione (il più grande tra pixel e 2″, la scala del seeing) su tre livelli: la luminosità media del catalogo, le parti deboli (aloni, bracci esterni) e, se ci sono, le polveri estese attorno (a LS ≥ 25). Il tempo “profondo” aggiunge l’Hα diffuso misurato attorno all’oggetto nella mappa all-sky di Finkbeiner (2003). Le righe deboli (OIII e SII in una nebulosa a emissione, dove domina l’Hα) sono chieste in proporzione alla loro intensità, come fai in elaborazione. Nelle bolle di Wolf-Rayet conta anche il guscio esterno in OIII, molto più debole dei filamenti. Se due filtri lasciano passare la stessa riga (l’OIII di L-eXtreme e L-Synergy), il segnale si somma e le ore si dividono tra i due.</p>
    <p>Taratura: con 800 mm f/5, OSC e SQM 19,3 la Cocoon esce a 56 h (base) e 95 h (profondo); un’immagine reale con quel campo ne ha richieste 100. Sono stime per scegliere, non promesse: seeing, trasparenza ed elaborazione contano molto.</p>`;
  if (LANG === 'it') $('#drawer details.how').innerHTML = `<summary>${tx('Come vengono stimati i tempi')}</summary>` + HOW_IT;
  $('#dClose').onclick = closeDetail;
  $$('#drawer .dtab').forEach((t) => (t.onclick = () => setDTab(t.dataset.tab)));
  const lc = $('#locCmp'); if (lc) { renderLocCmp(); lc.onclick = (ev) => { const x = ev.target.closest('[data-loc]'); if (x) setLoc(x.dataset.loc); }; }
  $('#copyCoord').onclick = () => copyText(`${o.id} ${raStr(o.ra)} ${decStr(o.dec).replace('−', '-')}`);
  $$('#drawer .cfg').forEach((t) => (t.onclick = () => { state.selCfg = t.dataset.cfg; const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; }));
  $('#rot').oninput = (ev) => { state.rot = +ev.target.value; $('#rotV').textContent = state.rot + '°'; drawPreview(); };
  $('#rotBest').onclick = () => { state.rot = bestRot; state.frameOff = [fr.dx, fr.dy]; $('#rot').value = bestRot; $('#rotV').textContent = bestRot + '°'; drawPreview(); };
  const cf = $('#copyFrame'); if (cf) cf.onclick = () => copyText(`${o.id} (${tx('centro inquadratura')}) ${raStr(fr.ra)} ${decStr(fr.dec).replace('−', '-')} · ${tx('PA lato lungo')} ${bestRot}°`);
  const m = $('#mos'); if (m) m.onchange = (ev) => { state.mosaic = ev.target.checked; drawPreview(); };
  $('#realSky').onchange = (ev) => { state.realSky = ev.target.checked; LS.set('sf.realSky', state.realSky); drawPreview(); };
  state.dTab = tab;
  // le schede restano ferme sotto la testata (che cambia altezza col riassunto)
  const setStick = () => { const d = $('#drawer'), h = $('#drawer .d-top'); if (d && h) d.style.setProperty('--dtop-h', h.offsetHeight + 'px'); };
  setStick();
  // al primo disegno il pannello poteva essere ancora nascosto: i grafici della notte si rifanno con la larghezza vera
  requestAnimationFrame(() => { setStick(); wireGallery(r, e); if (tab === 'campo') drawPreview(); nightChartsT = 0; updateNightCharts(); renderSeason(r); if (cal) renderCalChart(cal); wireNightCharts(); setTimeout(() => renderPeriod(r), 30); });
}
/* ---------- quando conviene ---------- */
/* lo stesso target in ogni luogo salvato: cielo nella sua direzione, ore libere, tempo e setup consigliato */
function renderLocCmp() {
  const box = $('#locCmp'), r = state.byId.get(state.sel); if (!box || !r) return;
  const rows = state.locs.map((l) => { const x = cmpFull(l, r.o), ok = x && x.usableH >= 0.25; return { l, x, h: ok ? hoursOf(x.e.best) : Infinity, cal: ok && x.e.best ? shootCalendar(cmpCtx(l), x, x.e, false) : null }; });
  const bestH = Math.min(...rows.map((q) => q.h));
  box.innerHTML = rows.map(({ l, x, h, cal }) => {
    const cur = l.id === state.locId;
    const vis = !x ? tx('non sale sopra {a}°', { a: l.minAlt }) : x.usableH >= 0.25 ? `${fmtDur(x.usableH)} · max ${Math.round(x.maxA)}°` : tx('coperto stanotte');
    const bb = x && x.e.best, deep = bb && bb.deep ? deepHoursOf(bb) : null;
    const plan = isFinite(h) ? `<b>${fmtH(h)}</b>${cal ? ` · ${cal.done ? nNights(cal.sessions) : tx('oltre un anno')}` : ''}${deep ? `<small>${tx('profondo')} ${fmtH(deep)}</small>` : ''}${state.cfgs.length > 1 ? `<small>${esc(x.e.cfg.tag)}</small>` : ''}` : '<b>—</b>';
    return `<div class="lr${cur ? ' cur' : ''}${isFinite(h) && h === bestH && rows.length > 1 ? ' best' : ''}"><div class="n">${esc(l.site.name)}<small>SQM ${it(+l.site.sqm, 2)}${x && x.skyMag != null ? ' · ' + tx('cielo sul target {m}', { m: it(x.skyMag, 2) }) : ''}</small></div><div class="v">${vis}</div><div class="p">${plan}</div>${cur ? `<span class="here">${tx('attivo')}</span>` : `<button class="btn sm" data-loc="${esc(l.id)}">${tx('Passa qui')}</button>`}</div>`;
  }).join('');
}
const periodCache = new Map();
const fmtDayLong = (t) => new Date(t).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'long' });
function renderPeriod(r) {
  const el = $('#period'); if (!el || state.sel !== r.o.id) return;
  const p = active(), ds = state.res.night.ds, key = [r.o.id, siteKey(p.site), ds, p.session.minAlt, p.session.sunThr, JSON.stringify(p.horizon)].join('|');
  let bp = periodCache.get(key); if (!bp) { bp = bestPeriod(r.o, p, state.res.lut, ds); periodCache.set(key, bp); }
  let msg, go = null;
  if (bp.none) msg = tx('Da qui non ha ore utili in nessun periodo dell’anno: col buio non supera {a}° o resta dietro l’orizzonte.', { a: p.session.minAlt });
  else if (bp.inNow) {
    msg = tx('<b>È il suo periodo.</b> Stanotte {now} libere col buio (il massimo dell’anno è {max}); resta così fino a {to}.', { now: fmtDur(bp.now), max: fmtDur(bp.max), to: fmtDayLong(bp.to) });
    if (bp.dark) { msg += ' ' + tx('Prima notte senza Luna: <b>{d}</b> ({h}).', { d: fmtDayLong(bp.dark), h: fmtDur(bp.darkH) }); go = bp.dark; }
  } else {
    msg = tx('<b>Non è ancora il suo periodo.</b> Stanotte {now}. Il periodo giusto va da <b>{from}</b> a {to}, con fino a {peak} per notte verso {pk}.', { now: bp.now > 0.05 ? tx('{d} libere', { d: fmtDur(bp.now) }) : tx('non è libero col buio'), from: fmtDayLong(bp.from), to: fmtDayLong(bp.to), peak: fmtDur(bp.peakH), pk: fmtDayLong(bp.peak) });
    if (bp.dark) { msg += ' ' + tx('Prima notte senza Luna in quel periodo: <b>{d}</b>.', { d: fmtDayLong(bp.dark) }); go = bp.dark; }
  }
  el.dataset.state = bp.none ? 'none' : bp.inNow ? 'now' : 'later';
  const chip = $('#periodChip');
  if (chip) {
    chip.className = 'hc ' + (bp.none ? 'bad' : bp.inNow ? 'ok' : 'warn');
    chip.textContent = bp.none ? tx('Mai libero col buio da qui') : bp.inNow ? tx('È il suo periodo, fino a {d}', { d: fmtDay(bp.to) }) : tx('Periodo giusto da {d}', { d: fmtDay(bp.from) });
    chip.title = tx('Apri la scheda Quando'); chip.onclick = () => setDTab('quando');
  }
  el.innerHTML = `<span class="lbl">${tx('Periodo giusto')}</span><span class="pt">${msg}</span>${go ? `<button class="btn sm" id="periodGo">${tx('Apri quella notte')}</button>` : ''}`;
  const b = $('#periodGo'); if (b) b.onclick = () => goNight(go);
}
/* porta l'app su un'altra notte lasciando aperto il target */
function goNight(t0) {
  const d = new Date(t0), ds = dateStr(d);
  $('#nightDate').value = ds; state.live = ds === defaultNightStr(); state.playing = false;
  $('#liveBtn').setAttribute('aria-pressed', String(state.live)); $('#playBtn').setAttribute('aria-pressed', 'false');
  refresh(); toast(tx('Notte del {d}', { d: d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) }));
}
/* ---------- grafici della notte: lettura al passaggio, clic/trascina per l'ora ---------- */
function setTimeFromChart(i) {
  const n = state.res.night; state.live = false; state.playing = false; Dome.setAnimating(false);
  $('#liveBtn').setAttribute('aria-pressed', 'false'); $('#playBtn').setAttribute('aria-pressed', 'false');
  Dome.setTime(n.t[clamp(i, n.w0, n.w1)]); onTime();
}
function chartTip(box, html, x, y) {
  let tip = box.querySelector('.ctip'); if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; box.appendChild(tip); }
  if (!html) { tip.hidden = true; return; } tip.hidden = false; tip.innerHTML = html;
  const hw = tip.offsetWidth / 2 + 4; tip.style.left = clamp(x, hw, Math.max(hw, box.clientWidth - hw)) + 'px'; tip.style.top = y + 'px';
}
function stepInfo(r, i) {
  const n = state.res.night, a = r.alt[i], minAlt = +active().session.minAlt || 0;
  const stk = !n.darkAll[i] ? 'cielo non buio' : a <= 0 ? 'sotto l’orizzonte' : a < minAlt ? 'troppo basso' : a < r.blk[i] ? 'coperto dall’orizzonte' : 'libero', st = tx(stk);
  return `<b>${fmtT(n.t[i])}</b> · ${Math.round(a)}° ${azName(r.az[i])} · <span class="${stk === 'libero' ? 'ok' : 'ko'}">${st}</span>${n.mAlt[i] > 0 ? `<small>${tx('Luna a {a}°', { a: Math.round(n.mAlt[i]) })}</small>` : ''}`;
}
/* larghezza di disegno dei grafici del dettaglio: quella disponibile (fino a 640), così sul telefono non si rimpiccioliscono */
function chartW() { const d = $('#drawer'), w = d && d.clientWidth ? d.clientWidth - 40 : 640; return clamp(Math.round(w), 330, 640); }
function wireNightCharts() {
  const r = state.byId.get(state.sel), n = state.res.night; if (!r) return;
  const ab = $('#altBox'), pb = $('#polBox'); if (!ab || !pb) return;
  const sv = () => ab.querySelector('svg'), vbW = () => sv().viewBox.baseVal.width || 640;
  const idxAlt = (e) => { const b = sv().getBoundingClientRect(), W = vbW(), x = (e.clientX - b.left) / b.width * W; return clamp(Math.round(n.w0 + (x - 34) / (W - 44) * (n.w1 - n.w0)), n.w0, n.w1); };
  const idxPol = (e) => {
    const b = pb.querySelector('svg').getBoundingClientRect(), k = 220 / b.width, x = (e.clientX - b.left) * k, y = (e.clientY - b.top) * k; let best = -1, bd = 14 * 14;
    for (let i = n.w0; i <= n.w1; i++) { if (!(r.alt[i] > 0 && n.darkAll[i])) continue; const rr = (90 - r.alt[i]) / 90 * 96, az = r.az[i] * D2R, dx = 110 - rr * Math.sin(az) - x, dy = 110 - rr * Math.cos(az) - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const hover = (box, i) => {
    const h = box.querySelector('.hov'); if (!h) return; h.setAttribute('opacity', 1);
    if (box === ab) { const x = (34 + (i - n.w0) / (n.w1 - n.w0) * (vbW() - 44)).toFixed(1); h.setAttribute('x1', x); h.setAttribute('x2', x); }
    else { const rr = (90 - clamp(r.alt[i], 0, 90)) / 90 * 96, az = r.az[i] * D2R; h.setAttribute('cx', (110 - rr * Math.sin(az)).toFixed(1)); h.setAttribute('cy', (110 - rr * Math.cos(az)).toFixed(1)); }
  };
  const wire = (box, idx, tipY) => {
    let down = false;
    const off = () => { chartTip(box, null); const h = box.querySelector('.hov'); if (h) h.setAttribute('opacity', 0); };
    box.onpointermove = (e) => { const i = idx(e), b = box.getBoundingClientRect(); if (i < 0) { off(); return; } chartTip(box, stepInfo(r, i), e.clientX - b.left, tipY(e, b)); hover(box, i); if (down) setTimeFromChart(i); };
    box.onpointerleave = off;
    box.onpointerdown = (e) => { const i = idx(e); if (i < 0) return; down = true; box.setPointerCapture(e.pointerId); setTimeFromChart(i); };
    box.onpointerup = () => { down = false; };
  };
  wire(ab, idxAlt, () => 8); wire(pb, idxPol, (e, b) => Math.max(4, e.clientY - b.top - 52));
}
/* l'ora scelta si muove anche nei grafici del dettaglio */
let nightChartsT = 0;
function updateNightCharts() {
  const now = performance.now(); if (now - nightChartsT < 90) return; nightChartsT = now;
  const r = state.sel && state.byId.get(state.sel), ab = $('#altBox'), pb = $('#polBox');
  if (!r || !ab || $('#drawer').hidden) return;
  const keep = (box, html) => { const tip = box.querySelector('.ctip'); box.innerHTML = html; if (tip) box.appendChild(tip); };
  keep(ab, altChart(r)); keep(pb, polar(r));
}
/* Notti di ripresa del target: quante, fino a quando, quali si saltano */
function calSummary(cal, b) {
  let t = cal.darkOnly ? tx('Contando solo le ore senza Luna (Luna sotto l’orizzonte o sottile), come hai scelto nel profilo.') + ' ' : '';
  if (!cal.done) t += tx('In un anno di notti serene ne fai il {p}%: è un progetto da più stagioni.', { p: Math.round(cal.prog * 100) });
  else if (cal.sessions <= 1 && cal.done === cal.nights[0].t0 && !cal.darkOnly) t += tx('Basta questa notte: servono {h} e il target è libero per {u}.', { h: fmtH(b.tonight), u: fmtDur(cal.nights[0].h) });
  else t += tx('Con il cielo sereno finisci in <b>{n}</b> di ripresa, l’ultima <b>{d}</b>.', { n: nNights(cal.sessions), d: fmtDayLong(cal.done) });
  if (cal.skipped) t += ' ' + tx('Ne salto {n} in cui il target rende più di 2,5 volte meno che nella notte migliore del mese (di solito per la Luna): meglio dedicarle ad altro.', { n: cal.skipped });
  if (cal.deep) t += ' ' + (cal.deep.done ? tx('Per il profondo: <b>{n}</b>, fino a {d}.', { n: nNights(cal.deep.sessions), d: fmtDayLong(cal.deep.done) }) : tx('Per il profondo: in un anno arrivi al {p}%.', { p: Math.round(cal.deep.prog * 100) }));
  return t;
}
/* Grafico delle notti: ore libere di ogni notte (a settimane se il progetto è lungo); colore = usata per il lavoro,
   usata solo per il profondo, saltata. Clic: apre quella notte. */
function renderCalChart(cal) {
  const el = $('#calChart'); if (!el) return;
  const N0 = cal.nights, weekly = N0.length > 62;
  const bars = weekly ? [] : N0.map((x) => ({ t0: x.t0, h: x.h, kind: x.use ? (x.deepOnly ? 'deep' : 'base') : x.h >= CAL_MIN_H ? 'skip' : 'none', x }));
  if (weekly) for (let i = 0; i < N0.length; i += 7) {
    const w = N0.slice(i, i + 7), used = w.filter((x) => x.use);
    bars.push({ t0: w[0].t0, h: used.reduce((a, x) => a + x.h, 0), n: used.length, kind: used.some((x) => !x.deepOnly) ? 'base' : used.length ? 'deep' : w.some((x) => x.h >= CAL_MIN_H) ? 'skip' : 'none', w });
  }
  if (weekly) bars.forEach((q) => { if (q.kind === 'skip') q.h = q.w.reduce((a, x) => a + (x.h >= CAL_MIN_H ? x.h : 0), 0); });
  const W = chartW(), H = 150, pad = 30, bw = (W - pad - 8) / bars.length, max = Math.max(weekly ? 8 : 4, ...bars.map((q) => q.h));
  const Y = (h) => H - 24 - h / max * (H - 44), col = { base: 'var(--oiii)', deep: 'var(--ha)', skip: '#3a4558', none: 'transparent' };
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx('Notti di ripresa')}">`;
  [0, max / 2, max].forEach((v) => { svg += `<line x1="${pad}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pad - 5}" y="${Y(v) + 4}" fill="var(--ink-3)" font-size="10" text-anchor="end" font-family="IBM Plex Mono">${Math.round(v)}h</text>`; });
  let lastM = -1;
  bars.forEach((q, i) => {
    const x = pad + i * bw, hgt = Math.max(q.h > 0 ? 2 : 0, H - 24 - Y(q.h));
    svg += `<rect class="b" style="animation-delay:${Math.min(i, 40) * 15}ms" x="${(x + bw * 0.14).toFixed(1)}" y="${(H - 24 - hgt).toFixed(1)}" width="${Math.max(1, bw * 0.72).toFixed(1)}" height="${hgt.toFixed(1)}" rx="${bw > 8 ? 2 : 1}" fill="${col[q.kind]}" opacity="${q.kind === 'deep' ? 0.75 : 1}"/>`;
    const d = new Date(q.t0), lab = weekly ? (d.getMonth() !== lastM ? d.toLocaleDateString(LOCALE, { month: 'short' }) : '') : (i === 0 || d.getDate() === 1 || (i % 7 === 0 && bars.length > 10) ? d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) : '');
    if (weekly) lastM = d.getMonth();
    if (lab) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" fill="var(--ink-3)" font-size="10.5" text-anchor="${i === 0 ? 'start' : 'middle'}" font-family="IBM Plex Sans">${lab.replace('.', '')}</text>`;
  });
  // fine del lavoro e del profondo
  const mark = (t, lbl, c) => { const i = bars.findIndex((q, j) => q.t0 <= t && (j === bars.length - 1 || bars[j + 1].t0 > t)); if (i < 0) return; const x = pad + (i + 1) * bw; svg += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="10" y2="${H - 24}" stroke="${c}" stroke-dasharray="3 3"/><text x="${(x - 3).toFixed(1)}" y="18" fill="${c}" font-size="10.5" text-anchor="end" font-family="IBM Plex Sans">${lbl}</text>`; };
  if (cal.done) mark(cal.done, tx('fatto'), 'var(--oiii)');
  if (cal.deep && cal.deep.done && cal.deep.done !== cal.done) mark(cal.deep.done, tx('profondo'), 'var(--ha)');
  bars.forEach((q, i) => { svg += `<rect class="hit" data-k="${i}" x="${(pad + i * bw).toFixed(1)}" y="4" width="${bw.toFixed(2)}" height="${H - 8}" fill="transparent"/>`; });
  el.innerHTML = svg + '</svg>';
  const sv = el.querySelector('svg'), rects = $$('#calChart rect.b');
  sv.onpointermove = (ev) => {
    const k = ev.target.dataset && ev.target.dataset.k; rects.forEach((b, i) => b.classList.toggle('hl', String(i) === k));
    if (k == null) { chartTip(el, null); return; }
    const q = bars[+k], bx = el.getBoundingClientRect(); let html;
    if (weekly) html = `<b>${tx('settimana dal {d}', { d: fmtDayLong(q.t0) })}</b> · ${q.n ? tx('{n} usate, {h} utili', { n: nNights(q.n), h: fmtDur(q.h) }) : tx('nessuna notte usata')}`;
    else {
      const x = q.x, why = x.use ? (x.deepOnly ? tx('solo per il profondo') : tx('fa il {p}% del lavoro', { p: Math.max(1, Math.round((x.frac || 0) * 100)) })) : x.h >= CAL_MIN_H ? tx('saltata: rende {k} volte meno della notte migliore del mese', { k: it(x.slow, 1) }) : tx('non si riprende: sotto l’orizzonte o col chiaro');
      html = `<b>${fmtDayLong(x.t0)}</b> · ${x.h >= CAL_MIN_H ? tx('{d} utili', { d: fmtDur(x.h) }) : '—'} · ${tx('Luna {p}%', { p: Math.round(x.moon * 100) })}<small>${why}</small>`;
    }
    chartTip(el, html + `<small>${tx('clicca per aprire la notte')}</small>`, ev.clientX - bx.left, 6);
  };
  sv.onpointerleave = () => { chartTip(el, null); rects.forEach((b) => b.classList.remove('hl')); };
  sv.onclick = (ev) => { const k = ev.target.dataset && ev.target.dataset.k; if (k == null) return; const q = bars[+k]; goNight(weekly ? (q.w.find((x) => x.use) || q.w[0]).t0 : q.t0); };
}
function renderSeason(r) {
  const el = $('#season'); if (!el) return;
  const s = seasonality(r.o, active(), state.res.lut); const W = chartW(), H = 150, pad = 26, bw = (W - pad * 2) / 12, max = Math.max(4, ...s.map((x) => x.h));
  const Y = (h) => H - 24 - h / max * (H - 44);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx('Ore utili per mese')}">`;
  [0, Math.round(max / 2), Math.round(max)].forEach((v) => { svg += `<line x1="${pad}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pad - 5}" y="${Y(v) + 4}" fill="var(--ink-3)" font-size="10" text-anchor="end" font-family="IBM Plex Mono">${v}h</text>`; });
  const best = s.reduce((a, x) => (x.h > a.h ? x : a), s[0]);
  s.forEach((x, i) => { const hgt = H - 24 - Y(x.h); svg += `<rect class="b" style="animation-delay:${i * 40}ms" x="${pad + i * bw + 5}" y="${Y(x.h)}" width="${bw - 10}" height="${Math.max(0, hgt)}" rx="3" fill="${x === best ? 'var(--oiii)' : i === 0 ? '#5d6a80' : '#2b3647'}"/><text x="${pad + i * bw + bw / 2}" y="${H - 8}" fill="${i === 0 ? 'var(--ink)' : 'var(--ink-3)'}" font-size="11" text-anchor="middle" font-family="IBM Plex Sans">${x.label.replace('.', '')}</text>`; if (x.h > 0.2) svg += `<text x="${pad + i * bw + bw / 2}" y="${Y(x.h) - 4}" fill="var(--ink-2)" font-size="10" text-anchor="middle" font-family="IBM Plex Mono">${it(x.h, 1)}</text>`; });
  s.forEach((x, i) => { svg += `<rect class="hit" data-k="${i}" x="${pad + i * bw}" y="4" width="${bw}" height="${H - 8}" fill="transparent"/>`; });
  el.innerHTML = svg + '</svg>';
  const sv = el.querySelector('svg');
  sv.onpointermove = (e) => {
    const k = e.target.dataset && e.target.dataset.k; $$('#season rect.b').forEach((b, i) => b.classList.toggle('hl', String(i) === k));
    if (k == null) { chartTip(el, null); return; }
    const x = s[+k], b = el.getBoundingClientRect(), mon = new Date(x.t0).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
    chartTip(el, `<b>${mon}</b> · ${x.h > 0.05 ? tx('{d} libere col buio', { d: fmtDur(x.h) }) : tx('nessuna ora utile')}<small>${tx('clicca per aprire la notte più buia del mese')}</small>`, e.clientX - b.left, 6);
  };
  sv.onpointerleave = () => { chartTip(el, null); $$('#season rect.b').forEach((b) => b.classList.remove('hl')); };
  sv.onclick = (e) => {
    const k = e.target.dataset && e.target.dataset.k; if (k == null) return;
    const x = s[+k], days = new Date(x.y, x.m + 1, 0).getDate(), today = new Date();
    const start = x.y === today.getFullYear() && x.m === today.getMonth() ? today.getDate() : 1;
    const cal = moonCalendar(active(), `${x.y}-${String(x.m + 1).padStart(2, '0')}-${String(start).padStart(2, '0')}`, days - start + 1);
    const mid = (c) => Math.abs(new Date(c.t0).getDate() - 15);
    const best = cal.reduce((a, c) => (c.moon < a.moon - 0.02 || (Math.abs(c.moon - a.moon) <= 0.02 && mid(c) < mid(a)) ? c : a), cal[0]);
    goNight(best.t0);
  };
}
function altChart(r) {
  const n = state.res.night, p = active(), i0 = n.w0, i1 = n.w1; const W = state.sel && !$('#drawer').hidden ? chartW() : 640, H = W < 500 ? 200 : 230, l = 34, rr = 10, t = 10, b = 26, pw = W - l - rr, ph = H - t - b;
  const X = (i) => (l + (i - i0) / (i1 - i0) * pw).toFixed(1), Y = (a) => (t + ph - clamp(a, 0, 90) / 90 * ph).toFixed(1);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx('Altezza nella notte')}">`;
  const col = (v) => (v >= -0.833 ? '#1C2433' : v >= -6 ? '#161E2B' : v >= -12 ? '#121925' : v >= n.thr ? '#0E141E' : null);
  for (let i = i0; i < i1; i++) { const c = col(n.sun[i]); if (c) s += `<rect x="${X(i)}" y="${t}" width="${(X(i + 1) - X(i) + 0.5).toFixed(1)}" height="${ph}" fill="${c}"/>`; }
  let blk = `M${X(i0)},${Y(0)}`; for (let i = i0; i <= i1; i++) blk += `L${X(i)},${Y(r.blk[i])}`; blk += `L${X(i1)},${Y(0)}Z`;
  s += `<path d="${blk}" fill="rgba(228,87,75,.14)" stroke="rgba(228,87,75,.5)"/>`;
  [0, 30, 60, 90].forEach((a) => { s += `<line x1="${l}" x2="${W - rr}" y1="${Y(a)}" y2="${Y(a)}" stroke="var(--line-2)" stroke-width=".6"/><text x="${l - 6}" y="${+Y(a) + 4}" fill="var(--ink-3)" font-size="11" text-anchor="end" font-family="IBM Plex Mono">${a}°</text>`; });
  const h0 = new Date(n.t[i0]); h0.setMinutes(0, 0, 0);
  for (let ms = h0.getTime() + 3600000; ms < n.t[i1]; ms += 3600000) { const i = i0 + (ms - n.t[i0]) / DT; s += `<text x="${X(i)}" y="${H - 8}" fill="var(--ink-3)" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">${String(new Date(ms).getHours()).padStart(2, '0')}</text>`; }
  let mp = '', on = false; for (let i = i0; i <= i1; i++) { if (n.mAlt[i] > 0) { mp += (on ? 'L' : 'M') + X(i) + ',' + Y(n.mAlt[i]); on = true; } else on = false; }
  if (mp) s += `<path d="${mp}" fill="none" stroke="#CFC8B4" stroke-width="1.2" stroke-dasharray="4 4" opacity=".7"/><text x="${W - rr}" y="${t + 12}" fill="#CFC8B4" font-size="11" text-anchor="end" opacity=".8" font-family="IBM Plex Sans">- - ${tx('Luna')} ${Math.round(n.moonIll * 100)}%</text>`;
  let op = ''; for (let i = i0; i <= i1; i++) op += (i === i0 ? 'M' : 'L') + X(i) + ',' + Y(r.alt[i]);
  s += `<path class="trace" d="${op}" fill="none" stroke="var(--ink-3)" stroke-width="1.3"/>`;
  let seg = []; for (let i = i0; i <= i1 + 1; i++) { if (i <= i1 && r.use[i]) seg.push(X(i) + ',' + Y(r.alt[i])); else if (seg.length) { s += `<polyline class="trace" points="${seg.join(' ')}" fill="none" stroke="var(--oiii)" stroke-width="3" stroke-linecap="round"/>`; seg = []; } }
  const tt = Dome.time; if (tt >= n.t[i0] && tt <= n.t[i1]) { const i = i0 + (tt - n.t[i0]) / DT; s += `<line x1="${X(i)}" x2="${X(i)}" y1="${t}" y2="${t + ph}" stroke="#fff" stroke-width="1.2"/>`; }
  s += `<line class="hov" x1="0" x2="0" y1="${t}" y2="${t + ph}" stroke="var(--oiii)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>`;
  return s + '</svg>';
}
function polar(r) {
  const n = state.res.night, p = active(), R = 96, c = 110; const P = (alt, az) => { const rr = (90 - clamp(alt, 0, 90)) / 90 * R, a = az * D2R; return [c - rr * Math.sin(a), c - rr * Math.cos(a)]; };
  const lut = state.res.lut; let hp = ''; for (let a = 0; a <= 360; a += 3) { const q = P(lut[a % 360], a); hp += (a ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }
  let s = `<svg viewBox="0 0 220 236" role="img" aria-label="${tx('Percorso nel cielo')}"><circle cx="${c}" cy="${c}" r="${R}" fill="rgba(228,87,75,.16)"/><path d="${hp}Z" fill="#070A10"/>`;
  s += `<circle cx="${c}" cy="${c}" r="${(90 - (+p.session.minAlt || 0)) / 90 * R}" fill="none" stroke="rgba(69,200,180,.4)" stroke-dasharray="3 3"/>`;
  [30, 60].forEach((a) => (s += `<circle cx="${c}" cy="${c}" r="${(90 - a) / 90 * R}" fill="none" stroke="var(--line-2)" stroke-width=".6"/>`));
  s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--line-2)"/>`;
  [['N', 0], [tx('E'), 90], ['S', 180], [tx('O'), 270]].forEach(([l, a]) => { const q = P(-10, a); s += `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" fill="var(--ink-2)" font-size="11" text-anchor="middle" font-family="Saira Condensed" font-weight="600">${l}</text>`; });
  let tr = '', on = false; for (let i = n.w0; i <= n.w1; i++) { if (r.alt[i] > 0 && n.darkAll[i]) { const q = P(r.alt[i], r.az[i]); tr += (on ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); on = true; } else on = false; }
  s += `<path class="trace" d="${tr}" fill="none" stroke="var(--ink-3)" stroke-width="1.2"/>`;
  let seg = []; for (let i = n.w0; i <= n.w1 + 1; i++) { if (i <= n.w1 && r.use[i]) { const q = P(r.alt[i], r.az[i]); seg.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); } else if (seg.length) { s += `<polyline class="trace" points="${seg.join(' ')}" fill="none" stroke="var(--oiii)" stroke-width="2.6" stroke-linecap="round"/>`; seg = []; } }
  const [a, z] = altAt(r, Dome.time); if (a > 0) { const q = P(a, z); s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4" fill="#fff"/>`; }
  s += `<circle class="hov" cx="0" cy="0" r="5" fill="none" stroke="var(--oiii)" stroke-width="1.5" opacity="0"/>`;
  return s + `<text x="110" y="232" fill="var(--ink-3)" font-size="10" text-anchor="middle" font-family="IBM Plex Sans">${tx('come la cupola · pallino = ora scelta')}</text></svg>`;
}

/* ============================ anteprima del campo ============================ */
const skyCache = new Map();
function setSkyNote(t) { const el = $('#skyNote'); if (el) el.textContent = t; }
function realSkyImage(o, w, h, k, dpr) {
  const pw = Math.min(1400, Math.round(w * dpr)), ph = Math.round(pw * h / w), fw = (w / k) / 60, fh = (h / k) / 60, sv = galSurvey(o, fw), key = `${o.id}|${pw}|${fw.toFixed(4)}|${sv.id}`;
  const c = skyCache.get(key); if (c) return c.ok ? c : null;
  const srcs = [
    ...(sv.id !== 'dss' ? [{ url: hipsUrl(sv.hips, o, fw, pw, ph), label: tx('Foto reale {s}', { s: tx(sv.label) }) + ` (${sv.credit})` }] : []),
    { url: hipsUrl('CDS/P/DSS2/color', o, fw, pw, ph), label: 'Foto reale DSS2 a colori (CDS)' },
    { url: `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?Survey=${encodeURIComponent('DSS2 Red')}&position=${o.ra.toFixed(5)},${o.dec.toFixed(5)}&Size=${fw.toFixed(4)},${fh.toFixed(4)}&Pixels=${Math.min(pw, 900)},${Math.round(Math.min(pw, 900) * h / w)}&Return=JPEG&Scaling=Log`, label: 'Foto reale DSS2 rosso (NASA SkyView)' }];
  const ent = { img: null, ok: false, label: '' }; skyCache.set(key, ent);
  const tryN = (i) => { if (i >= srcs.length) { setTimeout(() => skyCache.delete(key), 60000); if (state.sel === o.id) setSkyNote(tx('Foto reale non disponibile (sei offline?): anteprima schematica')); return; }
    const img = new Image(); img.onload = () => { ent.img = img; ent.ok = true; ent.label = tx(srcs[i].label); if (state.sel === o.id) drawPreview(); }; img.onerror = () => tryN(i + 1); img.src = srcs[i].url; };
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
  setSkyNote(tx(state.realSky ? 'Scarico la foto reale DSS2… intanto anteprima schematica' : 'Anteprima schematica: stelle e dettagli illustrativi'));
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
