'use strict';
/* ============================ piano di stagione ============================
   Tutti i tuoi target (preferiti e progetti non finiti) nelle prossime notti insieme, come faresti tu: ogni notte ha le
   sue ore di buio (serene, dove c'è la previsione) e le si dà ai target che quella notte rendono di più rispetto alla loro
   notte migliore del mese, con una spinta a chi sta per uscire di stagione e a chi è già in corso. Un target prende al
   massimo le sue ore utili di quella notte e solo quello che gli manca; le notti si dividono quando più target le vogliono.
   Ne esce, per ogni target, quando finisci e con quante notti; per ogni notte, chi riprendere.
   Il calcolo delle notti (nightRec, già in cache per i calendari) va a pezzi per non bloccare l'interfaccia. */
const SEASON_DAYS = 90;
const SP = { key: '', plan: null, job: 0 };
/* ore di buio di una notte, pesate per il meteo */
function nightCapacity(C, k) {
  const nk = aheadNight(C, k), wx = C.wx; let h = 0;
  for (let i = 0; i < CAL_N; i++) if (nk.dark[i]) { const f = wx ? wx(nk.t0 + (i + 0.5) * CAL_STEP * 60000) : null; h += (f == null ? 1 : f) * CAL_STEP / 60; }
  return h;
}
function seasonTargets() {
  return Object.keys(state.projects).filter((id) => inMyList(id) && !isDone(id)).map((id) => state.byId.get(id)).filter((r) => r && r.e.best && isFinite(hoursOf(r.e.best)));
}
const seasonKey = (list) => [state.res.night.ds, moonMode(), WX.d ? WX.d.at : 0, siteKey(activeLoc().site), JSON.stringify(activeProfile()).length, ...list.map((r) => r.o.id + ':' + projProgress(r.o.id).toFixed(3))].join('|');
/* il piano, a pezzi; done(plan) quando è pronto */
function seasonPlan(done) {
  const list = seasonTargets(), key = seasonKey(list);
  if (SP.key === key && SP.plan) { done(SP.plan); return; }
  const job = ++SP.job, C = state.res.C, mode = moonMode(), dark = mode === 'dark';
  let k = 0;
  const step = () => {
    if (job !== SP.job) return; const t0 = performance.now();
    while (k < SEASON_DAYS && performance.now() - t0 < 12) { for (const r of list) nightRec(C, r, r.e, k, dark); k++; }
    if (k < SEASON_DAYS) { setTimeout(step, 0); return; }
    SP.key = key; SP.plan = buildSeason(C, list, mode); if (job === SP.job) done(SP.plan);
  };
  step();
}
function buildSeason(C, list, mode) {
  const dark = mode === 'dark', skipK = mode === 'all' ? Infinity : CAL_SKIP, D = SEASON_DAYS;
  const T = list.map((r) => {
    const recs = [...Array(D)].map((_, k) => nightRec(C, r, r.e, k, dark));
    // la sua notte migliore nei 30 giorni attorno (per giudicare quanto rende una notte) e quando finisce la stagione
    const best = recs.map((x, k) => Math.min(...recs.slice(Math.max(0, k - 15), k + 15).map((q) => q.T)));
    let last = -1; recs.forEach((x, k) => { if (x.hGeo >= 1 && isFinite(x.T)) last = k; });
    return { r, id: r.o.id, recs, best, last, rem: 1 - projProgress(r.o.id), prio: hasSessions(r.o.id) ? 1.2 : 1, nights: [], hours: 0, done: null };
  });
  const nights = [];
  for (let k = 0; k < D; k++) {
    let cap = nightCapacity(C, k); const alloc = [];
    const cand = T.filter((t) => t.rem > 1e-6).map((t) => {
      const x = t.recs[k]; if (!(x.h >= CAL_MIN_H) || !isFinite(x.T)) return null;
      const eff = t.best[k] / x.T; if (1 / eff > skipK) return null;
      const urg = t.last >= 0 ? 1 + 0.8 * clamp(1 - (t.last - k) / 30, 0, 1) : 1; // a fine stagione passa avanti
      return { t, x, v: eff * urg * t.prio };
    }).filter(Boolean).sort((a, b) => b.v - a.v);
    for (const c of cand) {
      if (cap < CAL_MIN_H) break;
      const need = c.t.rem * c.x.T, a = Math.min(c.x.h, need, cap); if (a < CAL_MIN_H && a < need) continue;
      cap -= a; const f = a / c.x.T; c.t.rem = Math.max(0, c.t.rem - f); c.t.hours += a; c.t.nights.push({ k, a, f });
      if (c.t.rem <= 1e-6) c.t.done = k;
      alloc.push({ id: c.t.id, a, f, fin: c.t.rem <= 1e-6 });
    }
    nights.push({ k, t0: aheadNight(C, k).t0, cap: nightCapacity(C, k), alloc });
  }
  const targets = T.map((t) => ({ id: t.id, r: t.r, nights: t.nights, hours: t.hours, done: t.done, rem: t.rem, last: t.last })).sort((a, b) => (a.done == null ? 1e9 : a.done) - (b.done == null ? 1e9 : b.done) || a.rem - b.rem);
  const end = targets.every((t) => t.done != null) ? Math.max(...targets.map((t) => t.done)) : null;
  return { targets, nights, D, mode, end, used: nights.filter((n) => n.alloc.length).length, hours: targets.reduce((a, t) => a + t.hours, 0) };
}

/* ---------- disegno ---------- */
const tThumb = (o, sz = 22) => `<img class="tt" src="${esc(thumbUrl(o))}" alt="" loading="lazy" decoding="async" width="${sz}" height="${sz}" style="--tc:${TYPE_COLOR[o.type]}">`;
function seasonHTML(P) {
  if (!P || !P.targets.length) return '';
  const C = state.res.C, lastK = Math.max(13, ...P.targets.map((t) => (t.done != null ? t.done + 2 : t.nights.length ? t.nights[t.nights.length - 1].k + 2 : 0)));
  const D = Math.min(P.D, lastK + 1);
  const rows = P.targets.map((t) => {
    const byK = new Map(t.nights.map((x) => [x.k, x])); let cells = '';
    for (let k = 0; k < D; k++) { const x = byK.get(k); cells += x ? `<i class="use${k === t.done ? ' end' : ''}" style="--f:${(0.35 + 0.65 * clamp(x.f * 2.5, 0, 1)).toFixed(2)}"></i>` : '<i class="no"></i>'; }
    const when = t.done != null ? (t.done === 0 ? tx('stanotte') : tx('fino al {d}', { d: fmtDay(aheadNight(C, t.done).t0) })) : t.rem < 1 ? tx('{p}% in {n} giorni', { p: Math.round((1 - t.rem) * 100), n: P.D }) : tx('non in questi {n} giorni', { n: P.D });
    return `<button type="button" class="ss-row" data-id="${esc(t.id)}"><span class="ss-h">${tThumb(t.r.o)}<span class="ss-t"><b>${esc(t.id)}</b><small>${esc(t.r.o.nick || tx(TYPES[t.r.o.type]))}</small></span><span class="ss-v"><b class="num">${fmtH(t.hours)}</b><small>${t.nights.length ? nNights(t.nights.length) + ' · ' : ''}${when}</small></span></span><span class="sc-tl" style="--d:${D}">${cells}</span></button>`;
  }).join('');
  const endTxt2 = P.end != null ? tx('Finisci tutto entro il {d}', { d: fmtDayLong(aheadNight(C, P.end).t0) }) : tx('Non tutto si chiude nei prossimi {n} giorni', { n: P.D });
  return `<div class="card season-card"><div class="card-h"><h3>${tx('Piano di stagione')}</h3><small>${tx('tutti i tuoi target insieme, notte per notte · {m}', { m: tx(MODE_TXT[P.mode][0]).toLowerCase() })}</small></div>
    <p class="ss-sum"><b>${endTxt2}</b>: ${tx('{h} di posa in {n} di ripresa.', { h: fmtH(P.hours), n: nNights(P.used) })} ${tx('Ogni notte va ai target che lì rendono di più; quando più target la vogliono, la si divide.')}</p>
    <div class="ss-ax">${dayAxis(C, D)}</div><div class="ss-rows">${rows}</div></div>`;
}
/* il calendario: cinque settimane da questa, in ogni notte le miniature dei target da riprendere (quando sono più d'uno,
   la notte si divide); si scorre a blocchi di cinque settimane fin dove arriva il piano */
const PM = { m: 0 };
function monthHTML(P) {
  if (!P || !P.targets.length) return '';
  const C = state.res.C, t00 = aheadNight(C, 0).t0, lead = (new Date(t00).getDay() + 6) % 7, byId = new Map(P.targets.map((t) => [t.id, t]));
  const k0 = PM.m * 35 - lead, pages = Math.ceil((P.D + lead) / 35);
  const head = [...Array(7)].map((_, i) => `<span class="h">${new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '')}</span>`).join('');
  const L = activeLoc().site, sL = Math.sin(L.lat * D2R), cL = Math.cos(L.lat * D2R);
  let cells = '';
  for (let k = k0; k < k0 + 35; k++) {
    const t0 = new Date(new Date(t00).getFullYear(), new Date(t00).getMonth(), new Date(t00).getDate() + k, 12).getTime(), d = new Date(t0), mi = moonIllum(jd(t0 + 11 * 3600e3)), n = k >= 0 && k < P.D ? P.nights[k] : null;
    const al = n ? n.alloc : [];
    const w = n && k < 8 ? wxSpan([...Array(12)].map((_, i) => t0 + (7 + i) * 3600e3).filter((t) => { const s2 = sunPos(jd(t)); return altaz(s2.ra, s2.dec, lstDeg(t, +L.lon), sL, cL)[0] < -18; }), 60) : null;
    const ths = al.slice(0, 3).map((a) => tThumb(byId.get(a.id).r.o, 20)).join('') + (al.length > 3 ? `<span class="more">+${al.length - 3}</span>` : '');
    const tip = [d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }), tx('Luna {p}%', { p: Math.round(mi.k * 100) }), w ? tx('{p}% sereno', { p: Math.round(w.clear * 100) }) : '', ...al.map((a) => `${a.id} ${fmtH(a.a)}${a.fin ? ' ✓' : ''}`)].filter(Boolean).join(' · ');
    const lab = d.getDate() === 1 || k === k0 || k === 0 ? `<small>${d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '')}</small>` : '';
    cells += `<button type="button" style="--k:${k - k0}" class="pm${k < 0 ? ' past' : ''}${al.length > 1 ? ' multi' : ''}${k === 0 ? ' today' : ''}" data-k="${k}" ${k < 0 || k >= P.D ? 'disabled' : ''} title="${esc(tip)}" aria-label="${esc(tip)}">
      <span class="d">${d.getDate()}${lab}<span class="mo">${moonSvg(mi.k, mi.waxing, 5)}</span>${w && w.clear < 0.4 ? ic('cloud', 'wx') : ''}</span><span class="th">${ths}</span></button>`;
  }
  const a = new Date(t00 + k0 * 864e5), b = new Date(t00 + (k0 + 34) * 864e5), rng = `${fmtDay(a)} – ${fmtDay(b)}`;
  return `<div class="card month-card"><div class="card-h"><h3>${tx('Calendario')}</h3><small>${tx('chi riprendere ogni notte')}</small><span class="acts"><button type="button" class="icon-btn" data-pm="-1" ${PM.m <= 0 ? 'disabled' : ''} aria-label="${tx('Settimane prima')}">${ic('chev-l')}</button><b class="pm-name">${rng}</b><button type="button" class="icon-btn" data-pm="1" ${PM.m >= pages - 1 ? 'disabled' : ''} aria-label="${tx('Settimane dopo')}">${ic('chev-r')}</button></span></div>
    <div class="pmcal">${head}${cells}</div>
    <div class="sc-leg"><span>${tx('Tocca una notte per vedere chi riprendere e quanto')}</span></div></div>`;
}
function openSeasonNight(P, k) {
  const n = P.nights[k]; if (!n) return; const C = state.res.C, t0 = n.t0, byId = new Map(P.targets.map((t) => [t.id, t]));
  const d = new Date(t0).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = n.alloc.length ? n.alloc.map((a) => { const t = byId.get(a.id); return `<button type="button" class="st-item" data-id="${esc(a.id)}">${tThumb(t.r.o, 36)}<span class="tx"><b>${esc(a.id)}</b><small>${esc(t.r.o.nick || tx(TYPES[t.r.o.type]))} · ${tx('fa il {p}% del lavoro', { p: Math.max(1, Math.round(a.f * 100)) })}${a.fin ? ' · ' + tx('ultima notte') : ''}</small></span><b class="num">${fmtH(a.a)}</b></button>`; }).join('') : `<div class="st-item"><span class="tx"><small>${tx('Nessuno dei tuoi target rende abbastanza questa notte.')}</small></span></div>`;
  openSheet({
    title: d.charAt(0).toUpperCase() + d.slice(1), body: `<p class="st-foot" style="margin:0 4px 10px">${tx('{h} di buio sereno', { h: fmtDur(n.cap) })} · ${tx('Luna {p}%', { p: Math.round(aheadNight(C, k).moon * 100) })}</p><div class="st-list">${rows}</div>`,
    foot: `<button type="button" class="btn primary" data-go>${ic('night')}<span>${tx('Apri questa notte')}</span></button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-go]')) { close(); goNight(t0); setView('tonight'); return; }
      const r = e.target.closest('[data-id]'); if (r) { close(); goNight(t0, true); openDetail(r.dataset.id); }
    }),
  });
}
/* le stagioni: una riga per target, una casella per settimana dei prossimi 12 mesi, più piena = più ore senza Luna */
const YR = { key: '', rows: null, job: 0 };
function yearHTML(list) {
  if (!list.length) return '';
  return `<div class="card year-card"><div class="card-h"><h3>${tx('Le stagioni')}</h3><small>${tx('quando ogni target rende di più nei prossimi 12 mesi (più acceso = più ore col buio)')}</small></div><div id="yearBox" class="yr"><div class="spin"></div></div></div>`;
}
function fillYear(list) {
  const box = $('#yearBox'); if (!box) return;
  const p = active(), lut = state.res.lut, key = [siteKey(p.site), p.session.sunThr, p.session.minAlt, JSON.stringify(p.horizon).length, defaultNightStr(), ...list.map((r) => r.o.id)].join('|');
  const draw = () => {
    const now = new Date(), w0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime(), W = 52;
    let months = ''; for (let w = 0; w < W; w++) { const d = new Date(w0 + w * 7 * 864e5), prev = new Date(w0 + (w - 1) * 7 * 864e5), nx = new Date(w0 + (w + 2) * 7 * 864e5); months += `<span>${(w === 0 && nx.getMonth() === d.getMonth()) || (w > 0 && d.getMonth() !== prev.getMonth()) ? d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '') : ''}</span>`; }
    let moons = ''; for (let w = 0; w < W; w++) { let lo = 1; for (let i = 0; i < 7; i++) lo = Math.min(lo, moonIllum(jd(w0 + (w * 7 + i) * 864e5 + 11 * 3600e3)).k); moons += `<i class="${lo < 0.05 ? 'nm' : ''}"></i>`; }
    // ogni riga sul suo massimo: il periodo migliore di ciascun target si vede subito (le ore vere sono nel suggerimento)
    const rows = YR.rows.map((r) => { const mx = Math.max(1, ...r.h); return `<button type="button" class="yr-row" data-id="${esc(r.id)}"><span class="yr-n">${tThumb(r.o, 20)}<b>${esc(r.id)}</b></span><span class="yr-c" style="--w:${W}">${r.h.map((h, w) => `<i style="--a:${Math.pow(h / mx, 1.8).toFixed(2)}" title="${esc(tx('settimana del {d}: {h} col buio', { d: fmtDay(w0 + w * 7 * 864e5), h: fmtDur(h) }))}"></i>`).join('')}</span></button>`; }).join('');
    box.innerHTML = `<div class="yr-row ax"><span class="yr-n"></span><span class="yr-c lab" style="--w:${W}">${months}</span></div><div class="yr-row ax"><span class="yr-n"><small>${tx('Luna nuova')}</small></span><span class="yr-c moon" style="--w:${W}">${moons}</span></div>${rows}`;
  };
  if (YR.key === key && YR.rows) { draw(); return; }
  const job = ++YR.job, rows = list.map((r) => ({ id: r.o.id, o: r.o, h: [] })); let i = 0, w = 0;
  const now = new Date(), w0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  const step = () => {
    if (job !== YR.job) return; const t0 = performance.now();
    while (i < rows.length && performance.now() - t0 < 12) { rows[i].h.push(nightHoursFor(rows[i].o, p, lut, w0 + (w * 7 + 3) * 864e5)); if (++w >= 52) { w = 0; i++; } }
    if (i < rows.length) { setTimeout(step, 0); return; }
    YR.key = key; YR.rows = rows; if ($('#yearBox')) draw();
  };
  step();
}
