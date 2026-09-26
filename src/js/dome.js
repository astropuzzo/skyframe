'use strict';
/* Cupola del cielo: proiezione azimutale equidistante dallo zenit (nord in alto, est a sinistra, come guardando in su). */
const Dome = (() => {
  const SKY = window.SKY || { stars: [], lines: [], names: [], mw: [] };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ST = SKY.stars.map((s, i) => { const d = s[1] * D2R; const c = bvColor(s[3]); return { ra: s[0], sd: Math.sin(d), cd: Math.cos(d), mag: s[2], rgb: `${c[0]},${c[1]},${c[2]}`, ph: (i * 2.399) % 6.283 }; });
  const MW = SKY.mw; const LINES_ = SKY.lines; const NAMES = SKY.names.filter((n) => n.r <= 2);
  let cv, ctx, tipEl, mw, mwx, S = 600, dpr = 1, R = 280, cx = 300, cy = 300;
  let data = null, time = Date.now(), hover = null, pick = () => {}, dirty = true, t0 = performance.now(), lastDraw = 0, anim = false, markers = [], lpOn = false, lpCache = null; let glowCache = null, mwCache = null;
  const HMAX = 96; // raggio del disco = 96° dallo zenit (6° sotto l'orizzonte)

  function init(canvas, tip) {
    cv = canvas; ctx = cv.getContext('2d'); tipEl = tip;
    mw = document.createElement('canvas'); mwx = mw.getContext('2d');
    new ResizeObserver(resize).observe(cv.parentElement); resize();
    cv.addEventListener('mousemove', onMove); cv.addEventListener('mouseleave', () => { hover = null; tipEl.hidden = true; dirty = true; });
    cv.addEventListener('click', (e) => { const m = hit(e); if (m) pick(m.r.o.id); });
    requestAnimationFrame(loop);
  }
  function resize() {
    const w = cv.parentElement.clientWidth; if (!w) return;
    dpr = Math.min(2, window.devicePixelRatio || 1); S = w;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
    R = w / 2 - 22; cx = w / 2; cy = w / 2;
    mw.width = Math.round(w / 3); mw.height = Math.round(w / 3);
    dirty = true;
  }
  const proj = (alt, az) => { const r = R * (90 - alt) / HMAX, a = az * D2R; return [cx - r * Math.sin(a), cy - r * Math.cos(a)]; };
  function lstNow() { return lstDeg(time, +data.site.lon); }
  function starAltAz(ra, sd, cd, lst, sL, cL) { const H = (lst - ra) * D2R, cH = Math.cos(H); const sa = sd * sL + cd * cL * cH; const alt = Math.asin(clamp(sa, -1, 1)); let az = Math.atan2(-cd * Math.sin(H), sd * cL - cd * sL * cH) * R2D; return [alt * R2D, az < 0 ? az + 360 : az]; }

  function draw(now) {
    if (!data) return;
    const lat = data.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lst = lstNow(), J = jd(time);
    const intro = reduced ? 1 : clamp((now - t0) / 1600, 0, 1);
    const sun = sunPos(J), [sAlt, sAz] = altaz(sun.ra, sun.dec, lst, sL, cL);
    const mo = moonPos(J), [mAlt0, mAz] = altaz(mo.ra, mo.dec, lst, sL, cL), mAlt = mAlt0 - 0.95 * Math.cos(mAlt0 * D2R);
    const mi = moonIllum(J);
    const sqm = data.sqm, tw = clamp((sAlt + 18) / 18, 0, 1), day = clamp((sAlt + 2) / 8, 0, 1);
    const moonWash = mAlt > 0 ? mi.k * clamp(Math.sin(mAlt * D2R) * 1.5, 0, 1) : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    // cielo
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    let zen = mix([5, 7, 13], [22, 38, 70], tw); zen = mix(zen, [48, 92, 150], day); zen = mix(zen, [16, 24, 40], moonWash * 0.6 * (1 - day));
    let hor = mix([9, 12, 20], [70, 60, 80], tw); hor = mix(hor, [120, 160, 205], day);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgb(${zen})`); g.addColorStop(0.75, `rgb(${mix(zen, hor, 0.45)})`); g.addColorStop(1, `rgb(${hor})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    if (sAlt > -18 && sAlt < 4) { const [sx, sy] = proj(Math.max(sAlt, -5), sAz); const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 1.1); sg.addColorStop(0, `rgba(255,150,80,${0.45 * tw})`); sg.addColorStop(0.35, `rgba(200,110,110,${0.18 * tw})`); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, S, S); }
    // inquinamento luminoso: bagliore ambrato che sale dall'orizzonte
    const lp = clamp((21.9 - sqm) / 4.2, 0, 1);
    // con la mappa del luogo il bagliore ha la sua forma vera (dove le luci sono, lì è più forte); senza, un anello uniforme
    if (lp > 0 && data.sky && data.sky.dir) {
      const key = `${S}|${dpr}`;
      if (!glowCache || glowCache.sky !== data.sky || glowCache.key !== key) glowCache = { sky: data.sky, key, cv: lpGlow(data.sky, Math.round(Math.min(900, 2 * R * dpr * HMAX / 90)), 90) };
      const rr = R * 90 / HMAX; ctx.globalAlpha = 0.35 + 0.65 * lp; ctx.drawImage(glowCache.cv, cx - rr, cy - rr, 2 * rr, 2 * rr); ctx.globalAlpha = 1;
    } else if (lp > 0) { const lg = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.7, `rgba(210,150,90,${0.10 * lp})`); lg.addColorStop(1, `rgba(235,165,95,${0.42 * lp})`); ctx.fillStyle = lg; ctx.fillRect(0, 0, S, S); }
    // livello "Luci": luminosità del cielo per direzione dal modello del luogo (non dipende dall'ora)
    if (lpOn && data.sky) {
      const key = `${S}|${dpr}`;
      if (!lpCache || lpCache.sky !== data.sky || lpCache.key !== key) { const st = lpStats(data.sky); lpCache = { sky: data.sky, key, st, cv: lpImage(data.sky, Math.round(2 * R * dpr * HMAX / 90), 90, null, st) }; }
      const rr = R * 90 / HMAX; ctx.globalAlpha = 0.92; ctx.drawImage(lpCache.cv, cx - rr, cy - rr, 2 * rr, 2 * rr); ctx.globalAlpha = 1;
    }
    // magnitudine limite: cielo, crepuscolo, Luna
    const lim = clamp(sqm - 15.2, 2.2, 6.4) - tw * 3.5 - moonWash * 1.2 - day * 5;
    // Via Lattea
    const mwVis = clamp((sqm - 17.6) / 3.8, 0, 1) * (1 - tw) * (1 - moonWash * 0.8) * intro;
    if (mwVis > 0.02 && MW.length) {
      // la Via Lattea (poligoni + sfocatura) è la parte più cara del disegno: si rifà solo quando il cielo ruota di 0,25°
      const key = `${Math.round(lst * 4)}|${S}|${dpr}|${data.site.lat}`;
      if (!mwCache || mwCache.key !== key) {
        const k = mw.width / S; mwx.setTransform(1, 0, 0, 1, 0, 0); mwx.clearRect(0, 0, mw.width, mw.height); mwx.globalCompositeOperation = 'lighter';
        MW.forEach((lvl, li) => { mwx.fillStyle = `rgba(190,200,235,${0.045 + li * 0.012})`; lvl.forEach((poly) => { mwx.beginPath(); poly.forEach((ring) => { ring.forEach(([ra, de], i) => { const [a, z] = altaz(ra, de, lst, sL, cL); const [x, y] = proj(Math.max(a, -40), z); i ? mwx.lineTo(x * k, y * k) : mwx.moveTo(x * k, y * k); }); mwx.closePath(); }); mwx.fill('evenodd'); }); });
        const cv2 = (mwCache && mwCache.cv) || document.createElement('canvas'); cv2.width = Math.round(S * dpr); cv2.height = Math.round(S * dpr);
        const c2 = cv2.getContext('2d'); c2.clearRect(0, 0, cv2.width, cv2.height); c2.filter = `blur(${Math.max(2, S / 160) * dpr}px)`; c2.drawImage(mw, 0, 0, cv2.width, cv2.height);
        mwCache = { key, cv: cv2 };
      }
      ctx.save(); ctx.globalAlpha = mwVis; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(mwCache.cv, 0, 0, S, S); ctx.restore();
    }
    // linee delle costellazioni
    ctx.strokeStyle = `rgba(120,150,205,${0.16 * intro * (1 - day)})`; ctx.lineWidth = 1;
    LINES_.forEach((c) => c.l.forEach((ln) => { ctx.beginPath(); let pen = false; ln.forEach(([ra, de]) => { const [a, z] = altaz(ra, de, lst, sL, cL); if (a < -3) { pen = false; return; } const [x, y] = proj(a, z); pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }); ctx.stroke(); }));
    // stelle
    const sc = S / 620, tsec = now / 1000;
    for (let i = 0; i < ST.length; i++) {
      const s = ST[i]; if (s.mag > lim + 0.6 || s.mag > intro * 7 - 0.5) continue;
      const [a, z] = starAltAz(s.ra, s.sd, s.cd, lst, sL, cL); if (a < -1) continue;
      const [x, y] = proj(a, z);
      const fade = clamp((lim + 0.6 - s.mag) / 1.2, 0, 1) * clamp((a + 1) / 8, 0.25, 1);
      const tw2 = reduced ? 1 : 0.82 + 0.18 * Math.sin(tsec * (1.3 + (i % 7) * 0.31) + s.ph);
      const rad = Math.max(0.55, (6.4 - s.mag) * 0.52) * sc;
      if (s.mag < 1.6) { const gg = ctx.createRadialGradient(x, y, 0, x, y, rad * 4); gg.addColorStop(0, `rgba(${s.rgb},${0.35 * fade})`); gg.addColorStop(1, `rgba(${s.rgb},0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, rad * 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = `rgba(${s.rgb},${Math.min(1, fade * tw2 * (0.45 + 0.55 * clamp((4.5 - s.mag) / 4, 0, 1)))})`;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    }
    // nomi delle costellazioni
    ctx.font = `500 ${Math.round(10 * sc + 2)}px "Saira Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(150,170,210,${0.33 * intro * (1 - day)})`;
    NAMES.forEach((n) => { const [a, z] = altaz(n.p[0], n.p[1], lst, sL, cL); if (a < 8) return; const [x, y] = proj(a, z); ctx.fillText(n.n.toUpperCase(), x, y); });
    // Luna e Sole
    if (mAlt > -1) {
      const [x, y] = proj(mAlt, mAz), mr = 7 * sc + 2;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, mr * (3 + 6 * mi.k)); gl.addColorStop(0, `rgba(235,230,210,${0.35 * mi.k + 0.05})`); gl.addColorStop(1, 'rgba(235,230,210,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, mr * (3 + 6 * mi.k), 0, 7); ctx.fill();
      moonDisc(ctx, x, y, mr, mi.k, mi.waxing);
    }
    if (sAlt > -1) { const [x, y] = proj(sAlt, sAz); const gs = ctx.createRadialGradient(x, y, 0, x, y, 60 * sc); gs.addColorStop(0, 'rgba(255,245,220,.95)'); gs.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gs; ctx.beginPath(); ctx.arc(x, y, 60 * sc, 0, 7); ctx.fill(); }
    // percorso del target selezionato
    const sel = data.sel && data.byId.get(data.sel);
    if (sel) {
      const n = data.night; ctx.lineCap = 'round';
      const seg = (cond, style, wdt) => { ctx.strokeStyle = style; ctx.lineWidth = wdt; ctx.beginPath(); let pen = false; for (let i = n.w0; i <= n.w1; i++) { if (!cond(i) || sel.alt[i] < -2) { pen = false; continue; } const [x, y] = proj(sel.alt[i], sel.az[i]); pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } ctx.stroke(); };
      seg(() => true, 'rgba(220,230,245,.28)', 1.2 * sc + 0.4); seg((i) => sel.use[i], 'rgba(69,200,180,.9)', 2.6 * sc + 0.6);
      for (let i = n.w0; i <= n.w1; i += 12) { if (sel.alt[i] < 0) continue; const [x, y] = proj(sel.alt[i], sel.az[i]); ctx.fillStyle = 'rgba(220,230,245,.5)'; ctx.beginPath(); ctx.arc(x, y, 1.6 * sc + 0.5, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    // orizzonte del luogo (fuori dalla clip per chiudere il bordo)
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.beginPath(); for (let az = 0; az <= 360; az += 2) { const h = Math.max(0, data.lut[az % 360]); const [x, y] = proj(h, az); az ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.moveTo(cx + R + 2, cy); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2, true);
    ctx.fillStyle = day > 0.5 ? '#1d2a1f' : '#04060A'; ctx.fill('evenodd');
    // con "Luci" la mappa continua, attenuata, anche dietro l'orizzonte: si vedono le sorgenti basse come nell'all-sky
    if (lpOn && lpCache) { ctx.save(); ctx.clip('evenodd'); ctx.globalAlpha = 0.45; const rr = R * 90 / HMAX; ctx.drawImage(lpCache.cv, cx - rr, cy - rr, 2 * rr, 2 * rr); ctx.restore(); }
    ctx.beginPath(); for (let az = 0; az <= 360; az += 2) { const h = Math.max(0, data.lut[az % 360]); const [x, y] = proj(h, az); az ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = `rgba(${lp > 0.3 ? '235,170,100' : '170,190,220'},${0.35 + 0.3 * lp})`; ctx.lineWidth = 1.2; ctx.stroke();
    // altezza minima
    ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(69,200,180,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R * (90 - data.minAlt) / HMAX, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // target
    markers = [];
    const pulse = reduced ? 0 : (Math.sin(now / 380) + 1) / 2;
    ctx.font = `600 ${Math.round(10 * sc + 3)}px "Saira Condensed", sans-serif`; ctx.textAlign = 'left';
    const labels = []; // rettangoli delle etichette già scritte: niente sovrapposizioni
    const freeFor = (x, y, w, h) => !labels.some((b) => x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]);
    data.targets.forEach((r, rank) => {
      const [a, z] = altaz(r.pr.ra, r.pr.dec, lst, sL, cL); if (a < -1) return;
      const [x, y] = proj(a, z), o = r.o;
      const blocked = a < Math.max(data.minAlt, data.lut[Math.round(z) % 360]);
      const pxDeg = R / HMAX, rad = Math.max(3 * sc + 1.5, (o.a / 60) * pxDeg / 2);
      const col = TYPE_COLOR[o.type], isSel = data.sel === o.id, isHov = hover && hover.r === r;
      ctx.globalAlpha = (blocked ? 0.35 : 1) * intro;
      ctx.strokeStyle = col; ctx.lineWidth = isSel || isHov ? 2 : 1.2;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke();
      ctx.fillStyle = col + '33'; ctx.fill();
      if (isSel) { ctx.strokeStyle = `rgba(69,200,180,${0.35 + 0.5 * pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rad + 5 + 3 * pulse, 0, 7); ctx.stroke(); }
      if (rank < 14 || isSel || isHov) {
        const tw = ctx.measureText(o.id).width, lx = x + rad + 4, ly = y - 7, lh = 13 * sc + 2;
        if (isSel || isHov || freeFor(lx, ly, tw, lh)) { labels.push([lx, ly, tw, lh]); ctx.fillStyle = isSel || isHov ? '#fff' : 'rgba(225,230,238,.82)'; ctx.fillText(o.id, lx, y + 4); }
      }
      ctx.globalAlpha = 1;
      markers.push({ r, x, y, rad, a, z, blocked });
    });
    // anelli e punti cardinali
    ctx.strokeStyle = 'rgba(160,175,200,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.font = `600 ${Math.round(11 * sc + 3)}px "Saira Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(200,210,225,.8)';
    [['N', 0], [tx('E'), 90], ['S', 180], [tx('O'), 270]].forEach(([l, az]) => { const r = R + 12, a = az * D2R; ctx.fillText(l, cx - r * Math.sin(a), cy - r * Math.cos(a) + 4); });
    if (lpOn && lpCache) { // legenda della scala mag/″² del luogo
      const st = lpCache.st, lx = S - 128, ly = S - 26, w = 110;
      for (let i = 0; i < w; i++) { const c = lpColor(st.hi - (st.hi - st.lo) * i / w, st); ctx.fillStyle = `rgb(${c})`; ctx.fillRect(lx + i, ly, 1, 7); }
      ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(200,210,225,.85)'; ctx.textAlign = 'left'; ctx.fillText(it(st.hi, 2), lx, ly + 18); ctx.textAlign = 'right'; ctx.fillText(it(st.lo, 2) + ' mag/″²', lx + w, ly + 18);
    }
  }
  function moonDisc(c, x, y, r, k, waxing) {
    c.fillStyle = '#2A2F3A'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = '#EEE9DA'; c.beginPath();
    const rx = r * Math.abs(1 - 2 * k);
    c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
    c.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0.5) === waxing ? !waxing : waxing);
    c.fill();
  }
  function hit(e) {
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, bd = 1e9; markers.forEach((m) => { const d = Math.hypot(m.x - x, m.y - y); if (d < Math.max(12, m.rad + 4) && d < bd) { bd = d; best = m; } });
    return best;
  }
  /* punto del cielo sotto il mouse: altezza, azimut e luminosità del fondo cielo in quella direzione */
  function skyAt(e) {
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, dx = cx - x, dy = cy - y, r = Math.hypot(dx, dy);
    const alt = 90 - r / R * HMAX; if (alt < 0 || !data.sky) return null;
    return { x, y, alt, az: (Math.atan2(dx, dy) * R2D + 360) % 360 };
  }
  function onMove(e) {
    const m = hit(e); if ((m && m.r) !== (hover && hover.r)) dirty = true; hover = m;
    if (!m) {
      cv.style.cursor = 'crosshair';
      const q = skyAt(e); if (!q) { tipEl.hidden = true; return; }
      const mag = data.sky.mag(q.alt, q.az), blk = data.lut && q.alt < Math.max(data.lut[Math.round(q.az) % 360], 0);
      tipEl.hidden = false; tipEl.style.left = q.x + 'px'; tipEl.style.top = (q.y - 6) + 'px';
      tipEl.innerHTML = `<b>SQM ${it(mag, 2)}</b> mag/″²<small>${Math.round(q.alt)}° ${azName(q.az)} (${Math.round(q.az)}°)${blk ? ' · ' + tx('dietro l’orizzonte') : ''} · ${tx('senza Luna')}${data.sky.source === 'allsky' ? ' · all-sky lightpollutionmap' : data.sky.dir ? ' · ' + tx('stima atlante') : ''}</small>`;
      return;
    }
    cv.style.cursor = 'pointer';
    const o = m.r.o; tipEl.hidden = false; tipEl.style.left = m.x + 'px'; tipEl.style.top = (m.y - m.rad) + 'px';
    tipEl.innerHTML = `<b>${esc(o.id)}</b>${o.nick ? ' · ' + esc(o.nick) : ''}<small>${Math.round(m.a)}° ${azName(m.z)} · ${tx(m.blocked ? 'coperto' : 'libero')} · ${tx('punti')} ${m.r.score}</small>`;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || !cv.offsetParent) return; // sezione nascosta: niente disegni
    const introOn = now - t0 < 1800, twinkle = !reduced && now - lastDraw > 66;
    if (dirty || anim || introOn || twinkle) { draw(now); lastDraw = now; dirty = false; }
  }
  return {
    init, onPick(fn) { pick = fn; },
    setData(d) { data = d; dirty = true; },
    setTime(ms) { time = ms; dirty = true; },
    get time() { return time; },
    setAnimating(v) { anim = v; },
    setLP(v) { lpOn = !!v; dirty = true; },
    refresh() { dirty = true; },
    replayIntro() { t0 = performance.now(); },
  };
})();
