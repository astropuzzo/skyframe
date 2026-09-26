'use strict';
/* ============================ quanto ci vuole ============================
   La risposta a «quante ore e quante notti mi servono?» per un target, in un colpo d'occhio:
   - in cima le ore di posa col cielo senza Luna da qui (il minimo, il numero da confrontare);
   - sotto, i tre modi di riprendere (consigliato, tutte le sere, solo senza Luna) e gli altri luoghi salvati: per
     ognuno le ore di posa da raccogliere davvero (con la Luna ne servono di più), le notti, il giorno in cui finisci e
     una striscia dei giorni che dice quali notti si usano;
   - una frase che spiega la differenza.
   Nella scheda Quando lo stesso calendario si vede a mese, notte per notte. */
const MODE_TXT = {
  smart: ['Consigliato', 'tutte le notti utili, salta quelle con troppa Luna'],
  all: ['Tutte le sere', 'ogni notte in cui si vede, anche con la Luna piena'],
  dark: ['Solo senza Luna', 'solo le ore con la Luna tramontata o sottile'],
};
const SC_DAYS_MIN = 14, SC_DAYS_MAX = 60;
const endTxt = (cal) => (!cal ? '—' : cal.complete ? tx('già fatto') : !cal.done ? tx('oltre un anno') : dateStr(new Date(cal.done)) === defaultNightStr() ? tx('stanotte') : tx('fino al {d}', { d: fmtDay(cal.done) }));
const nightsTxt2 = (cal) => (!cal || cal.complete ? '' : cal.done ? nNights(cal.sessions) : tx('{p}% in un anno', { p: Math.round(cal.prog * 100) }));
/* la striscia dei giorni: ogni notte usata è piena quanto il lavoro che fa; nuvole, Luna e "non si vede" hanno il loro segno */
function dayStrip(cal, D) {
  const byK = new Map((cal ? cal.nights : []).map((x) => [x.k, x])); let out = '';
  const lastK = cal && cal.done != null ? (cal.nights.find((x) => x.t0 === cal.done) || {}).k : -1;
  for (let k = 0; k < D; k++) {
    const x = byK.get(k); let cls = 'no', st = '';
    if (x) {
      if (x.use && !x.deepOnly) { cls = k === lastK ? 'use end' : 'use'; st = `--f:${(0.35 + 0.65 * clamp((x.frac || 0) * 2.5, 0, 1)).toFixed(2)}`; }
      else if (x.use) cls = 'deep';
      else if (x.hGeo >= CAL_MIN_H && x.h < CAL_MIN_H) cls = 'cloud';
      else if (x.h >= CAL_MIN_H) cls = 'skip';
    } else if (cal && cal.done && k > lastK) cls = 'after';
    out += `<i class="${cls}"${st ? ` style="${st}"` : ''}></i>`;
  }
  return `<span class="sc-tl" style="--d:${D}">${out}</span>`;
}
/* asse dei giorni: date ogni settimana e la Luna di ogni notte (più chiara = più luminosa) */
function dayAxis(C, D) {
  let moon = '', lab = ''; const stp = D > 45 ? 14 : 7;
  for (let k = 0; k < D; k++) {
    const nk = aheadNight(C, k), d = new Date(nk.t0);
    moon += `<i style="opacity:${(0.12 + 0.88 * nk.moon).toFixed(2)}" title="${tx('Luna {p}%', { p: Math.round(nk.moon * 100) })}"></i>`;
    lab += `<span>${k === 0 ? tx('oggi') : k % stp === 0 ? d.getDate() + ' ' + d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '') : ''}</span>`;
  }
  return `<div class="sc-ax"><span class="sc-tl moon" style="--d:${D}">${moon}</span><span class="sc-tl lab" style="--d:${D}">${lab}</span></div>`;
}
function scenCals(r, e) {
  const C = state.res.C; return e.best ? Object.fromEntries(MOON_MODES.map((m) => [m, shootCalendar(C, r, e, false, m)])) : null;
}
function scenDays(list) {
  let D = SC_DAYS_MIN;
  for (const cal of list) if (cal && cal.done) { const x = cal.nights.find((q) => q.t0 === cal.done); if (x) D = Math.max(D, x.k + 3); }
  return Math.min(SC_DAYS_MAX, D);
}
/* ore di posa che mancano col cielo senza Luna: dal calendario "solo senza Luna" se si chiude, se no lungo il percorso di stanotte */
function needNow(r, e) {
  const b = e.best; if (!b) return null; const prog = projProgress(r.o.id); if (prog >= 1) return 0;
  const d = shootCalendar(state.res.C, r, e, false, 'dark'); return d && d.done ? d.hours : hoursOf(b) * (1 - prog);
}
function scenHTML(r, e) {
  const b = e.best; if (!b) return '';
  const cals = scenCals(r, e), mode = moonMode(), D = scenDays(Object.values(cals)), prog = projProgress(r.o.id);
  const rows = MOON_MODES.map((m) => {
    const c = cals[m], [t, sub] = MODE_TXT[m];
    return `<button type="button" class="sc-row" data-mode="${m}" aria-pressed="${m === mode}"><span class="sc-h"><span class="radio${m === mode ? ' on' : ''}"></span><span class="sc-t"><b>${tx(t)}</b><small>${tx(sub)}</small></span><span class="sc-v"><b class="num">${c && isFinite(c.hours) && c.done ? fmtH(c.hours) : c && c.complete ? '—' : '—'}</b><small>${nightsTxt2(c)}${c && !c.complete ? ' · ' + endTxt(c) : ''}</small></span></span>${dayStrip(c, D)}</button>`;
  }).join('');
  return `<div class="scen" id="scen" data-d="${D}">
    <div class="sc-top"><div class="sc-need"><span>${tx(prog > 0 && prog < 1 ? 'Ti mancano' : 'Ti servono')}</span><b class="num">≈ ${fmtH(needNow(r, e))}</b><small>${tx('di posa col cielo senza Luna di {l}', { l: esc(activeLoc().site.name) })}</small></div>
      <button type="button" class="icon-btn" data-scinfo title="${tx('Come leggere i tempi')}" aria-label="${tx('Come leggere i tempi')}">${ic('info')}</button></div>
    ${dayAxis(state.res.C, D)}
    <div class="sc-rows">${rows}<div id="scLocs"></div></div>
    <div class="sc-leg"><span><i class="use"></i>${tx('si riprende')}</span><span><i class="skip"></i>${tx('saltata per la Luna')}</span><span><i class="cloud"></i>${tx('nuvole previste')}</span><span><i class="no"></i>${tx('non si vede')}</span></div>
    <p class="sc-say">${scenSay(cals)}</p></div>`;
}
/* la frase: quanto costa la Luna, e se un altro luogo conviene lo dice la riga del luogo */
function scenSay(c, loc) {
  const a = c.all, d = c.dark, s = c.smart, out = [];
  if (s && s.complete) return tx('Hai già raccolto tutto il tempo stimato.');
  if (a && d && a.done && d.done) {
    if (d.hours < a.hours * 0.8 && d.done > a.done) out.push(tx('La Luna costa: tutte le sere servono {ha} di posa in {na}, aspettando il buio bastano {hd} in {nd}, ma finisci il {dd} invece del {da}.', { ha: fmtH(a.hours), na: nNights(a.sessions), hd: fmtH(d.hours), nd: nNights(d.sessions), dd: fmtDay(d.done), da: fmtDay(a.done) }));
    else if (d.hours < a.hours * 0.8) out.push(tx('Aspettare il buio conviene in tutto: meno ore ({hd} invece di {ha}) e finisci prima.', { hd: fmtH(d.hours), ha: fmtH(a.hours) }));
    else out.push(tx('La Luna qui pesa poco: tutte le sere {ha} in {na}.', { ha: fmtH(a.hours), na: nNights(a.sessions) }));
  } else if (a && a.done && d && !d.done) out.push(tx('Solo senza Luna in un anno non si chiude: bisogna riprendere anche con la Luna.'));
  if (s && s.cloudy) out.push(tx('Le previsioni danno nuvole in {n}: le salto.', { n: nNights(s.cloudy) }));
  if (loc) out.push(loc);
  return out.join(' ');
}
/* gli altri luoghi salvati, nel modo scelto; col meteo del luogo se è arrivato */
function renderScenLocs(r) {
  const box = $('#scLocs'), sc = $('#scen'); if (!box || !sc || state.locs.length < 2) return;
  const D = +sc.dataset.d, mode = moonMode(), here = shootCalendar(state.res.C, r, r.e, false, mode);
  let best = null;
  box.innerHTML = state.locs.filter((l) => l.id !== state.locId).map((l) => {
    const x = cmpFull(l, r.o), C = x && cmpCtx(l), c = x && x.e.best ? shootCalendar(C, x, x.e, false, mode) : null;
    if (c && c.done && here && (!here.done || c.hours < here.hours * 0.6) && (!best || c.hours < best.c.hours)) best = { l, c };
    return `<div class="sc-row loc"><span class="sc-h">${ic('pin')}<span class="sc-t" title="${x && x.skyMag != null ? tx('cielo sul target {m}', { m: it(x.skyMag, 2) }) : ''}"><b>${esc(l.site.name)}</b><small>SQM ${it(+l.site.sqm, 2)} · ${Math.round(kmBetween(activeLoc().site, l.site))} km</small></span><span class="sc-v"><b class="num">${c && c.done ? fmtH(c.hours) : '—'}</b><small>${c ? nightsTxt2(c) + (c.complete ? '' : ' · ' + endTxt(c)) : tx('non si vede')}</small></span><button type="button" class="btn sm" data-loc="${esc(l.id)}">${tx('Passa qui')}</button></span>${dayStrip(c, D)}</div>`;
  }).join('');
  if (best) { const say = $('#scen .sc-say'); if (say) say.textContent = scenSay(scenCals(r, r.e), tx('Da {l} bastano {h} ({n}): {x} volte meno ore che da qui.', { l: best.l.site.name, h: fmtH(best.c.hours), n: nNights(best.c.sessions), x: it(here.done ? here.hours / best.c.hours : 99, 1) })); }
}
function wireScen(r) {
  const sc = $('#scen'); if (!sc) return;
  sc.onclick = (e) => {
    if (e.target.closest('[data-scinfo]')) { openScenInfo(); return; }
    const l = e.target.closest('[data-loc]'); if (l) { setLoc(l.dataset.loc); return; }
    const m = e.target.closest('[data-mode]'); if (m) { setMoonMode(m.dataset.mode); toast(tx('Modo di riprendere: {m}', { m: tx(MODE_TXT[m.dataset.mode][0]).toLowerCase() })); }
  };
  // meteo degli altri luoghi (solo nuvole), poi i loro calendari
  setTimeout(() => {
    renderScenLocs(r);
    const others = state.locs.filter((l) => l.id !== state.locId && !WX.other.has(wxKey(l.site)));
    if (others.length) Promise.all(others.map((l) => loadWeatherLite(l.site))).then(() => {
      for (const l of others) { const c = cmp.cache.get(cmp.keys.get(l.id)); if (c && c.C) { c.C.wx = wxAtFor(l.site); if (c.C.ahead) c.C.ahead.cache.clear(); } }
      if (state.sel === r.o.id) renderScenLocs(r);
    });
  }, 30);
}
function openScenInfo() {
  openSheet({
    title: tx('Come leggere i tempi'),
    body: `<div class="info-txt">
      <p><b>${tx('Ore di posa')}</b>: ${tx('la somma delle esposizioni che servono per un risultato di qualità «buona» (la mediana delle foto pubblicate su AstroBin con strumenti e cieli simili). Il numero in alto è il minimo: col cielo senza Luna del luogo attivo.')}</p>
      <p><b>${tx('Con la Luna')}</b> ${tx('il fondo cielo è più chiaro e ogni ora rende meno: per lo stesso risultato servono più ore. Per questo i tre modi danno ore diverse.')}</p>
      <p><b>${tx('Consigliato')}</b>: ${tx('usa tutte le notti utili, ma salta quelle in cui il target rende più di 2,5 volte meno che nella notte migliore del mese (quasi sempre per la Luna piena).')} <b>${tx('Tutte le sere')}</b>: ${tx('ogni notte, anche con la Luna piena: finisci prima ma raccogli più ore.')} <b>${tx('Solo senza Luna')}</b>: ${tx('meno ore in tutto, ma aspetti le notti buie.')}</p>
      <p><b>${tx('Notti e date')}</b>: ${tx('ogni notte conta le ore in cui il target è sopra il tuo orizzonte col buio, la Luna di quella notte e, per la prossima settimana, solo le ore serene previste. Oltre, si assume sereno.')}</p>
      <p><b>${tx('Stime indicative')}</b>: ${tx('seeing, trasparenza, calibrazione ed elaborazione possono cambiare le ore anche del doppio. Servono a scegliere e organizzare, non sono promesse.')}</p></div>`,
  });
}

/* ---------- scheda Quando: il calendario del target, sei settimane ---------- */
function targetCalHTML(r, e) {
  if (!e.best) return '';
  const C = state.res.C, mode = moonMode(), cal = shootCalendar(C, r, e, false, mode), darkOnly = mode === 'dark';
  const t00 = aheadNight(C, 0).t0, lead = (new Date(t00).getDay() + 6) % 7, byK = new Map(cal.nights.map((x) => [x.k, x]));
  const lastK = cal.done != null ? (cal.nights.find((x) => x.t0 === cal.done) || {}).k : -1, sel = $('#nightDate').value || defaultNightStr();
  const head = [...Array(7)].map((_, i) => `<span class="h">${new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '')}</span>`).join('');
  let cells = '<span></span>'.repeat(lead);
  for (let k = 0; k < 42 - lead; k++) {
    const x = nightRec(C, r, e, k, darkOnly), u = byK.get(k), d = new Date(x.t0), mi = moonIllum(jd(x.t0 + 11 * 3600e3)), ds = dateStr(d);
    let cls = x.hGeo < CAL_MIN_H ? 'no' : x.h < CAL_MIN_H ? 'cloud' : 'ok', f = 0;
    if (u && u.use && !u.deepOnly) { cls = 'use'; f = clamp((u.frac || 0) * 2.5, 0, 1); } else if (u && !u.use && x.h >= CAL_MIN_H) cls = 'skip';
    const tip = [d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }), x.hGeo >= CAL_MIN_H ? tx('{d} utili', { d: fmtDur(x.h) }) : tx('non si vede col buio'), tx('Luna {p}%', { p: Math.round(x.moon * 100) }), x.clear != null ? tx('meteo: {p}% sereno', { p: Math.round(x.clear * 100) }) : '', cls === 'use' ? tx('fa il {p}% del lavoro', { p: Math.max(1, Math.round((u.frac || 0) * 100)) }) : cls === 'skip' ? tx('saltata: rende troppo poco') : ''].filter(Boolean).join(' · ');
    cells += `<button type="button" class="tc ${cls}${k === lastK ? ' end' : ''}${ds === sel ? ' sel' : ''}${k === 0 && ds === defaultNightStr() ? ' today' : ''}" data-t0="${x.t0}" style="--f:${(0.25 + 0.75 * f).toFixed(2)}" title="${esc(tip)}" aria-label="${esc(tip)}">
      <span class="d">${d.getDate()}${d.getDate() === 1 || k === 0 ? `<small>${d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '')}</small>` : ''}</span><span class="mo">${moonSvg(mi.k, mi.waxing, 5)}</span>
      <span class="hh">${x.hGeo < CAL_MIN_H ? '—' : cls === 'cloud' ? ic('cloud') : fmtH(x.h)}</span>${k === lastK ? `<span class="ok">${ic('check')}</span>` : ''}</button>`;
  }
  const seg = `<div class="seg" role="radiogroup">${MOON_MODES.map((m) => `<button type="button" data-mode="${m}" aria-pressed="${m === mode}">${tx(MODE_TXT[m][0])}</button>`).join('')}</div>`;
  return `<div class="sec first"><h3>${tx('Le notti di {t}', { t: esc(r.o.id) })} <small>${tx('tocca una notte per aprirla')}</small></h3>${seg}
    <p class="calsum">${calSay(cal)}</p>
    <div class="tcal">${head}${cells}</div>
    <div class="sc-leg"><span><i class="use"></i>${tx('si riprende (più pieno = più lavoro)')}</span><span><i class="skip"></i>${tx('saltata per la Luna')}</span><span>${ic('cloud')}${tx('nuvole previste')}</span><span>${ic('check')}${tx('ultima notte')}</span></div></div>`;
}
function calSay(cal) {
  if (cal.complete) return tx('Progetto completato: hai già raccolto tutto il tempo stimato.');
  let t = cal.start > 0 ? tx('Parto dal {p}% già fatto.', { p: Math.round(cal.start * 100) }) + ' ' : '';
  if (!cal.done) t += tx('In un anno ne fai il {p}%: è un progetto da più stagioni.', { p: Math.round(cal.prog * 100) });
  else t += tx('<b>{h}</b> di posa in <b>{n}</b>: finisci <b>{d}</b>.', { h: fmtH(cal.hours), n: nNights(cal.sessions), d: dateStr(new Date(cal.done)) === defaultNightStr() ? tx('stanotte') : fmtDayLong(cal.done) });
  if (cal.cloudy) t += ' ' + tx('Salto {n} per le nuvole previste.', { n: nNights(cal.cloudy) });
  if (cal.skipped) t += ' ' + tx('Salto {n} con troppa Luna.', { n: nNights(cal.skipped) });
  return t;
}
function wireTargetCal() {
  const box = $('#drawer .tabp[data-tab="quando"]'); if (!box) return;
  box.addEventListener('click', (e) => {
    const m = e.target.closest('.seg [data-mode]'); if (m) { setMoonMode(m.dataset.mode); return; }
    const c = e.target.closest('.tc[data-t0]'); if (c) goNight(+c.dataset.t0);
  });
}
