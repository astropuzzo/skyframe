'use strict';
/* ============================ le notti che vengono ============================
   Una striscia delle prossime 14 notti: per ognuna il buio, quanto ne resta senza Luna e, dove c'è la previsione, quanto
   è sereno. Il voto conta le ore buone: sereno senza Luna per intero, sereno con la Luna per un terzo (in banda stretta
   si lavora lo stesso), rispetto alla notte più lunga della striscia. Si tocca una notte e l'app ci va.
   Lo stesso voto (rateNight) serve al riquadro della notte scelta. */
const NB_N = 14;
const nb = { key: '', list: null };
/* campioni del buio ogni 10 minuti: istante e Luna alta (sopra l'orizzonte e non sottile) */
function nightSamples(p, t0) {
  const lat = p.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lon = +p.site.lon, thr = +p.session.sunThr;
  const f = hmToOff(p.session.from), to = hmToOff(p.session.to), out = [];
  let ill = 0, waxing = true;
  for (let i = 0; i <= 144; i++) {
    const ms = t0 + i * 600000, J = jd(ms), lst = lstDeg(ms, lon), s = sunPos(J);
    if (i === 72) { const mi = moonIllum(J); ill = mi.k; waxing = mi.waxing; }
    if (!inSession(i * 10, f, to) || altaz(s.ra, s.dec, lst, sL, cL)[0] >= thr) continue;
    const mo = moonPos(J), ma = altaz(mo.ra, mo.dec, lst, sL, cL)[0];
    out.push({ ms, mu: ma > 0 });
  }
  return { t0, samples: out, ill, waxing };
}
function nightsAhead() {
  const p = active(), from = defaultNightStr(), key = [siteKey(p.site), p.session.sunThr, p.session.from, p.session.to, from].join('|');
  if (nb.key !== key) {
    nb.key = key; const [y, m, d] = from.split('-').map(Number);
    nb.list = [...Array(NB_N)].map((_, k) => { const t0 = new Date(y, m - 1, d + k, 12, 0, 0).getTime(); return { ...nightSamples(p, t0), ds: dateStr(new Date(t0)) }; });
  }
  return nb.list;
}
/* la trasparenza pesa sulle ore buone: con molti aerosol il cielo rende meno anche se è sereno */
function transK(ms) { const x = WX.d && wxHour(ms), a = x && x.aod; return a == null ? 1 : a <= 0.08 ? 1 : a <= 0.15 ? 0.95 : a <= 0.25 ? 0.88 : a <= 0.4 ? 0.75 : 0.6; }
/* voto di una notte da campioni {ms, mu} (passo in ore): ore di buio, senza Luna, serene, buone */
function rateNight(samples, step, ill, ref) {
  let dark = 0, free = 0, good = 0, known = 0, clear = 0;
  for (const s of samples) {
    const f = wxAt(s.ms), w = f == null ? 1 : f, moon = s.mu && ill > 0.1;
    dark += step; if (!moon) free += step; if (f != null) { known++; clear += f; }
    good += step * w * transK(s.ms) * (moon ? 0.33 : 1);
  }
  const k = samples.length && known >= samples.length * 0.5, cf = known ? clear / known : null;
  const rel = good / Math.max(ref || dark, 1);
  let r, label;
  if (dark < 0.2) { r = 0; label = 'Senza buio'; }
  else if (k && cf < 0.15) { r = 0; label = 'Coperta'; }
  else if (rel >= 0.68) { r = 4; label = 'Ottima'; }
  else if (rel >= 0.45) { r = 3; label = 'Buona'; }
  else if (rel >= 0.25) { r = 2; label = 'Discreta'; }
  else { r = 1; label = free < dark * 0.3 && (!k || cf >= 0.5) ? 'Luna' : 'Scarsa'; }
  return { r, label, dark, free, good, rel, known: !!k, clear: k ? cf : null };
}
const RATE_COL = ['var(--line-3)', 'var(--ink-3)', 'var(--warn)', 'var(--accent)', 'var(--good)'];
function renderNightBar() {
  const el = $('#nightBar'); if (!el || !state.res) return;
  const L = nightsAhead(), sel = $('#nightDate').value || defaultNightStr(), ref = Math.max(...L.map((x) => x.samples.length / 6));
  el.innerHTML = L.map((x, k) => {
    const q = rateNight(x.samples, 1 / 6, x.ill, ref), d = new Date(x.t0);
    const wd = k === 0 ? tx('Stanotte') : d.toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '');
    const w = q.clear != null ? wxSpan(x.samples.map((s) => s.ms), 10) : null, sl = w && seeLvl(w.see), tl = w && traLvl(w.aod);
    const tip = [d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }), tx(q.label), tx('buio {h}', { h: fmtDur(q.dark) }), tx('senza Luna {h}', { h: fmtDur(q.free) }), q.clear != null ? tx('{p}% sereno', { p: Math.round(q.clear * 100) }) : tx('meteo non ancora previsto'), sl ? tx('seeing {s}', { s: tx(sl.t).toLowerCase() }) : '', tl ? tx('trasparenza {s}', { s: tx(tl.t).toLowerCase() }) : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="nb${q.clear == null ? ' far' : ''}${x.ds === sel && nb.lastSel && nb.lastSel !== sel ? ' pop' : ''}" data-t0="${x.t0}" aria-pressed="${x.ds === sel}" title="${esc(tip)}" aria-label="${esc(tip)}">
      <span class="wd">${esc(wd)}</span><span class="dd">${d.getDate()}</span><span class="mo">${moonSvg(x.ill, x.waxing, 6)}</span>
      <span class="q"><b style="width:${Math.max(8, Math.round(Math.min(1, q.rel) * 100))}%;background:${RATE_COL[q.r]}"></b></span>${q.clear != null && q.clear < 0.5 ? ic('cloud', 'wx') : ''}</button>`;
  }).join('') + `<button type="button" class="nb nbm" data-more title="${tx('Scegli un’altra notte')}">${ic('cal')}<span>${tx('Altre')}</span></button>`;
  nb.lastSel = sel;
  el.onclick = (e) => {
    if (e.target.closest('[data-more]')) { openNightSheet(); return; }
    const b = e.target.closest('[data-t0]'); if (!b) return;
    const t0 = +b.dataset.t0; if (dateStr(new Date(t0)) === defaultNightStr()) setLive(); else goNight(t0, true);
  };
  const on = el.querySelector('[aria-pressed="true"]'); if (on) { const l = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2; if (Math.abs(el.scrollLeft - l) > on.offsetWidth * 2) el.scrollLeft = Math.max(0, l); }
}
/* la notte scelta, dai passi di 5 minuti del calcolo */
function rateSelected(n) {
  const samples = []; for (let i = n.first; i >= 0 && i <= n.last; i++) if (n.dark[i]) samples.push({ ms: n.t[i], mu: n.mAlt[i] > 0 });
  const L = nightsAhead(), ref = Math.max(...L.map((x) => x.samples.length / 6));
  return rateNight(samples, STEP / 60, n.moonIll, Math.max(ref, n.darkH));
}
