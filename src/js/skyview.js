'use strict';
/* ============================ la sezione Cielo ============================
   Le prossime notti una per una (voto, sereno ora per ora, probabilità, seeing, trasparenza, condensa, vento), poi la
   notte scelta ora per ora come una tabella da osservatorio, i modelli a confronto e gli altri luoghi salvati.
   I dati vengono da weather.js; qui solo il disegno. */
const SK = { k: 0 };
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
/* colore del cielo: blu notte se sereno, grigio chiaro se coperto */
const skyCol = (f) => { const c = clamp(f, 0, 1), a = [14, 38, 72], b = [196, 204, 218], m = a.map((v, i) => Math.round(b[i] + (v - b[i]) * c)); return `rgb(${m})`; };
const cloudCol = (p) => `rgba(200,210,226,${(clamp(p, 0, 100) / 100 * 0.9).toFixed(2)})`;
const LVL_BG = ['rgba(90,205,139,.2)', 'rgba(76,207,188,.2)', 'rgba(230,180,75,.2)', 'rgba(232,131,74,.22)', 'rgba(238,90,76,.22)'];
const lvlBg = (l) => (l ? `background:${LVL_BG[l.i]};color:${LVL_COL[l.i]}` : '');
const mbUrl = (s) => `https://www.meteoblue.com/${LANG === 'it' ? 'it/tempo' : 'en/weather'}/outdoorsports/seeing/${Math.abs(+s.lat).toFixed(3)}${+s.lat >= 0 ? 'N' : 'S'}${Math.abs(+s.lon).toFixed(3)}${+s.lon >= 0 ? 'E' : 'W'}`;
const coUrl = (s) => `https://clearoutside.com/forecast/${(+s.lat).toFixed(2)}/${(+s.lon).toFixed(2)}`;

/* ore intere della notte (dal tramonto all'alba) con il buio segnato */
function nightHours(x) {
  const p = active(), lat = p.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lon = +p.site.lon, out = [];
  const d0 = x.samples.length ? x.samples[0].ms : x.t0 + 8 * 3600e3, d1 = x.samples.length ? x.samples[x.samples.length - 1].ms : x.t0 + 16 * 3600e3;
  const h0 = new Date(d0 - 2 * 3600e3); h0.setMinutes(0, 0, 0);
  for (let t = h0.getTime(); t <= d1 + 2 * 3600e3; t += 3600e3) {
    const J = jd(t), lst = lstDeg(t, lon), mo = moonPos(J), ma = altaz(mo.ra, mo.dec, lst, sL, cL)[0];
    out.push({ t, dark: x.samples.some((s) => Math.abs(s.ms - t - 1800e3) <= 1800e3), moon: ma > 0 ? ma : null });
  }
  return out;
}
function skyNightCard(x, k) {
  const L = nightsAhead(), ref = Math.max(...L.map((q) => q.samples.length / 6)), q = rateNight(x.samples, 1 / 6, x.ill, ref);
  const w = wxSpan(x.samples.map((s) => s.ms), 10), d = new Date(x.t0), hrs = nightHours(x).filter((h) => h.dark);
  const sl = w && seeLvl(w.see), tl = w && traLvl(w.aod), dl = w && w.dew != null ? (w.dew <= 1.5 ? 4 : w.dew <= 3 ? 2 : 0) : null, gl = w && windLvl(w.gust);
  const cells = hrs.map((h) => { const f = wxAt(h.t + 1800e3); return `<i style="background:${f == null ? 'var(--line-2)' : skyCol(f)}"></i>`; }).join('');
  const title = k === 0 ? tx('Stanotte') : d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  const warn = [dl >= 2 ? `<span class="w" style="color:${LVL_COL[dl]}" title="${tx('Rischio condensa: {t}', { t: tx(dl >= 4 ? 'alto' : 'medio') })}">${ic('drop')}</span>` : '', gl && gl.i >= 2 ? `<span class="w" style="color:${LVL_COL[gl.i]}" title="${tx('Raffiche fino a {v} km/h', { v: w.gust })}">${ic('wind')}</span>` : ''].join('');
  return `<button type="button" class="sk-n" data-k="${k}" aria-pressed="${k === SK.k}">
    <span class="h"><b>${esc(title)}</b><span class="mo">${moonSvg(x.ill, x.waxing, 6)}${Math.round(x.ill * 100)}%</span><span class="rate r${q.r}"><i></i>${tx(q.label)}</span></span>
    <span class="cells">${cells || `<em>${tx('niente buio')}</em>`}</span>
    <span class="kv">${w ? `<span><small>${tx('Sereno')}</small><b>${pct(w.clear)}</b></span><span><small>${tx('Probabilità')}</small><b>${pct(w.prob)}</b></span><span><small>${tx('Seeing')}</small><b style="color:${sl ? LVL_COL[sl.i] : 'inherit'}">${sl ? tx(sl.t) : '—'}</b></span><span><small>${tx('Trasparenza')}</small><b style="color:${tl ? LVL_COL[tl.i] : 'inherit'}">${tl ? tx(tl.t) : '—'}</b></span>` : `<span class="far">${tx('Oltre le previsioni: contano Luna e buio')}</span>`}${warn}</span></button>`;
}
function skyGrid(x) {
  const H = nightHours(x), s = active().site;
  const col = (h, fn) => H.map((q) => { const w = wxHour(q.t + 1800e3); return `<span class="c${q.dark ? ' dk' : ''}"${fn(w, q)}</span>`; }).join('');
  const row = (label, sub, fn) => `<span class="rl"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>${col(null, fn)}`;
  const hh = H.map((q) => `<span class="c hd${q.dark ? ' dk' : ''}">${String(new Date(q.t).getHours()).padStart(2, '0')}</span>`).join('');
  const txt = (v) => (v == null ? '' : v);
  const rows = [
    row(tx('Nubi basse'), '', (w) => (w && w.lo != null ? ` style="background:${cloudCol(w.lo)}">${w.lo >= 5 ? w.lo : ''}` : '>')),
    row(tx('Nubi medie'), '', (w) => (w && w.mi != null ? ` style="background:${cloudCol(w.mi)}">${w.mi >= 5 ? w.mi : ''}` : '>')),
    row(tx('Nubi alte'), '', (w) => (w && w.hi != null ? ` style="background:${cloudCol(w.hi)}">${w.hi >= 5 ? w.hi : ''}` : '>')),
    row(tx('Sereno'), tx('media dei modelli'), (w) => (w && w.clear != null ? ` style="background:${skyCol(w.clear)};color:${w.clear > 0.5 ? '#E6EBF2' : '#0B1018'}">${Math.round(w.clear * 100)}` : '>')),
    row(tx('Probabilità'), tx('51 scenari ECMWF'), (w) => (w && w.prob != null ? ` style="background:${skyCol(w.prob)};color:${w.prob > 0.5 ? '#E6EBF2' : '#0B1018'}">${Math.round(w.prob * 100)}` : '>')),
    row(tx('Accordo'), tx('fra i modelli'), (w) => { const l = w && agreeLvl(w.spread); return l ? ` title="${tx(l.t)}"><i class="dot" style="background:${LVL_COL[l.i]}"></i>` : '>'; }),
    row(tx('Seeing'), '″', (w) => { const l = w && seeLvl(w.see); return l ? ` style="${lvlBg(l)}">${it(w.see, 1)}` : '>'; }),
    row(tx('Getto'), 'm/s', (w) => (w && w.jet != null ? ` style="${w.jet >= 30 ? 'color:var(--warn)' : ''}">${w.jet}` : '>')),
    row(tx('Trasparenza'), 'AOD', (w) => { const l = w && traLvl(w.aod); return l ? ` style="${lvlBg(l)}">${String(w.aod).replace(/^0/, '')}` : '>'; }),
    row(tx('Umidità'), '%', (w) => (w && w.rh != null ? ` style="${w.t != null && w.td != null && w.t - w.td <= 2 ? 'color:var(--warn);font-weight:600' : ''}">${w.rh}` : '>')),
    row(tx('Raffiche'), 'km/h', (w) => (w && w.gust != null ? ` style="${w.gust >= 25 ? `color:${LVL_COL[w.gust >= 40 ? 4 : 2]}` : ''}">${w.gust}` : '>')),
    row(tx('Pioggia'), '%', (w) => (w && w.pp != null ? ` style="${w.pp >= 30 ? 'color:var(--warn)' : ''}">${w.pp >= 5 ? w.pp : ''}` : '>')),
    row(tx('Luna'), tx('altezza'), (w, q) => (q.moon != null ? ` style="color:#E9E4D4">${Math.round(q.moon)}°` : '>')),
  ].map((r) => `<div class="hr">${r}</div>`).join('');
  return `<div class="hg" style="--n:${H.length}"><div class="hr head"><span class="rl"></span>${hh}</div>${rows}</div>`;
}
/* i modelli uno sopra l'altro: una riga per modello, ora per ora */
const MODEL_COL = { italia_meteo_arpae_icon_2i: '#4CCFBC', icon_d2: '#7FA8F0', meteofrance_seamless: '#B58CF0', ecmwf_ifs025: '#E6AA45', icon_seamless: '#5ACD8B', ukmo_seamless: '#E88A6E', gfs_seamless: '#C3CCDC', ens: '#F0D264' };
function skyModels(x) {
  const d = WX.d, H = nightHours(x).filter((h) => h.dark); if (!H.length) return '';
  const names = Object.fromEntries([...WX_MODELS, WX_ENS].map((m) => [m[0], m[1]]));
  const ids = Object.keys(d.models).filter((id) => H.some((h) => { const i = Math.round(((h.t + 1800e3) / 1000 - d.t0) / 3600); return d.models[id][i] != null; }));
  if (!ids.length) return '';
  const rows = ids.map((id) => `<div class="mr"><span class="mn"><i style="background:${MODEL_COL[id]}"></i>${esc(names[id] || id)}</span>${H.map((h) => { const i = Math.round(((h.t + 1800e3) / 1000 - d.t0) / 3600), f = d.models[id][i]; return `<span class="mc" style="background:${f == null ? 'transparent' : skyCol(f)}" title="${f == null ? '' : Math.round(f * 100) + '%'}"></span>`; }).join('')}</div>`).join('');
  const ax = `<div class="mr ax"><span class="mn"></span>${H.map((h) => `<span class="mc">${new Date(h.t).getHours() % 2 ? '' : String(new Date(h.t).getHours()).padStart(2, '0')}</span>`).join('')}</div>`;
  return `<div class="card"><div class="card-h"><h3>${tx('Modelli a confronto')}</h3><small>${tx('sereno ora per ora secondo ognuno: blu sereno, grigio coperto')}</small></div><div class="mgrid" style="--n:${H.length}">${rows}${ax}</div></div>`;
}
async function skyOther(box) {
  const others = state.locs.filter((l) => l.id !== state.locId); if (!others.length || !box) return;
  const x = nightsAhead()[0], ts = x.samples.map((s) => s.ms);
  const rows = await Promise.all(others.map(async (l) => {
    const d = await loadWeatherLite(l.site); if (!d) return { l, c: null };
    let sum = 0, n = 0; for (const t of ts) { const i = Math.round((t / 1000 - d.t0) / 3600); if (i >= 0 && i < d.clear.length && d.clear[i] != null) { sum += d.clear[i]; n++; } }
    return { l, c: n ? sum / n : null };
  }));
  const me = wxSpan(ts, 10);
  box.innerHTML = `<div class="card-h"><h3>${tx('Gli altri tuoi luoghi stanotte')}</h3><small>${tx('quanto del buio è sereno')}</small></div>` +
    `<div class="st-list">${[{ l: activeLoc(), c: me ? me.clear : null, me: true }, ...rows].map(({ l, c, me: m }) => `<button type="button" class="st-item" data-loc="${esc(l.id)}"><span class="clbar"><b style="width:${c == null ? 0 : Math.round(c * 100)}%;background:${c == null ? 'transparent' : skyCol(c)}"></b></span><span class="tx"><b>${esc(l.site.name)}</b><small>${m ? tx('luogo attivo') : Math.round(kmBetween(activeLoc().site, l.site)) + ' km'} · SQM ${it(+l.site.sqm, 2)}</small></span><b class="num">${pct(c)}</b></button>`).join('')}</div>`;
  box.onclick = (e) => { const b = e.target.closest('[data-loc]'); if (b && b.dataset.loc !== state.locId) setLoc(b.dataset.loc); };
}
function renderSky() {
  const el = $('#skyView'); if (!el || !state.res) return;
  const s = activeLoc().site;
  const head = `<div class="view-h tight"><h2>${tx('Cielo')}</h2><span class="grow"></span><button type="button" class="icon-btn" data-refresh title="${tx('Aggiorna le previsioni')}" aria-label="${tx('Aggiorna le previsioni')}">${ic('refresh')}</button></div><p class="view-sub">${esc(s.name)}${wxOk() ? ' · ' + tx('aggiornato alle {t}', { t: fmtT(WX.d.at) }) : ''}</p>`;
  if (!wxOk()) {
    el.innerHTML = head + `<div class="card sk-wait">${WX.busy || !WX.err ? `<div class="spin"></div><p>${tx('Scarico le previsioni da sette modelli meteo…')}</p>` : `<p>${tx('Previsioni non disponibili: controlla la connessione.')}</p><button type="button" class="btn" data-refresh>${ic('refresh')}${tx('Riprova')}</button>`}</div>`;
    el.onclick = (e) => { if (e.target.closest('[data-refresh]')) refreshWeather(true); };
    if (!WX.busy && !WX.err) refreshWeather(false);
    return;
  }
  const L = nightsAhead().slice(0, 8); SK.k = clamp(SK.k, 0, L.length - 1);
  const x = L[SK.k], d = new Date(x.t0), p = WX.d.parts;
  const title = SK.k === 0 ? tx('Stanotte, ora per ora') : tx('{d}, ora per ora', { d: d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) });
  el.innerHTML = head + `
    <div class="sk-nights">${L.map(skyNightCard).join('')}</div>
    <div class="card"><div class="card-h"><h3>${esc(title)}</h3><small>${tx('ore di buio evidenziate')}</small></div>${skyGrid(x)}
      <div class="sk-legend"><span>${ic('info')}${tx('Seeing: stima dalla turbolenza nei livelli in quota di GFS ed ECMWF, in secondi d’arco come meteoblue (sotto 1,2″ buono). Trasparenza: aerosol CAMS (sotto 0,15 buona). Umidità in giallo: rischio condensa.')}</span></div></div>
    ${skyModels(x)}
    <div class="card" id="skOther"${state.locs.length > 1 ? '' : ' hidden'}></div>
    <p class="st-foot sk-src">${tx('Fonti')}: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (${Object.keys(WX.d.models).length} ${tx('modelli')}${p.ens ? ', ECMWF ensemble' : ''}${p.aq ? ', CAMS' : ''}) · ItaliaMeteo-ARPAE, DWD, Météo-France, ECMWF, UK Met Office, NOAA · Copernicus Atmosphere Monitoring Service<br>
      ${tx('Confronta con')} <a href="${mbUrl(s)}" target="_blank" rel="noopener">meteoblue seeing</a> · <a href="${coUrl(s)}" target="_blank" rel="noopener">Clear Outside</a></p>`;
  el.onclick = (e) => {
    if (e.target.closest('[data-refresh]')) { refreshWeather(true); toast(tx('Aggiorno le previsioni…')); return; }
    const b = e.target.closest('.sk-n[data-k]'); if (b) { SK.k = +b.dataset.k; renderSky(); const g = $('#skyView .hg'); if (g && PHONE.matches) g.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  // la tabella parte dal buio
  const g = $('#skyView .hg'); if (g) { const dk = g.querySelector('.c.dk'); if (dk) g.scrollLeft = Math.max(0, dk.offsetLeft - 120); }
  skyOther($('#skOther'));
}
