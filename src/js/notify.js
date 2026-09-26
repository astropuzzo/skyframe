'use strict';
/* ============================ avvisi ============================
   Quattro avvisi, ognuno si accende e spegne da Setup:
   - «Stasera si scatta»: prima del buio (anticipo a scelta), se la notte arriva almeno al voto scelto e il piano ha un
     posto per i tuoi target: finestra serena, probabilità, target con gli orari, seeing, condensa e vento;
   - «Notte ottima in arrivo»: il giorno prima, per una notte dei prossimi tre giorni senza Luna, serena con buona
     probabilità, con i target che il piano di stagione le assegna;
   - «Il meteo è cambiato»: stanotte si apre (o si chiude dopo l'avviso);
   - «Ultime settimane»: un tuo target sta per uscire di stagione e il lavoro non è finito.
   Si ricalcolano quando l'app si apre o aggiorna il meteo. Su Android sono avvisi del sistema e arrivano ad app chiusa;
   in più uno script in background (src/runners/background.js) riscarica le nuvole ogni 15-30 minuti e manda da solo
   l'avviso della sera, «si apre» e «cambio di programma». Sul computer e nel browser arrivano se l'app è aperta. */
const NCFG_DEF = { evening: true, top: true, change: true, season: true, lead: 60, min: 3 };
const ncfg = () => ({ ...NCFG_DEF, ...LS.get('sf.notifyCfg', {}) });
function setNcfg(k, v) { LS.set('sf.notifyCfg', { ...ncfg(), [k]: v }); planNotifications(); }
const notifyOn = () => !!LS.get('sf.notify', false);
const nbridge = { timers: [] };
async function notifyPermission() {
  if (window.cielo && window.cielo.notifyPermission) return window.cielo.notifyPermission();
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
/* programma gli avvisi [{ id, at, title, body }] togliendo quelli di prima */
async function notifySchedule(list) {
  if (window.cielo && window.cielo.notifySchedule) return window.cielo.notifySchedule(list);
  nbridge.timers.forEach(clearTimeout); nbridge.timers = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const n of list) {
    const d = n.at - Date.now(); if (d > 2 ** 31 - 1) continue;
    nbridge.timers.push(setTimeout(() => { try { new Notification(n.title, { body: n.body, tag: 'skyframe-' + n.id, icon: 'favicon.png' }); } catch { /* niente */ } }, Math.max(1000, d)));
  }
}
/* avvisi già mandati (per non ripeterli): chiave → istante */
const sentGet = () => LS.get('sf.notified', {});
function sentMark(k) { const s = sentGet(), now = Date.now(); for (const x of Object.keys(s)) if (now - s[x] > 40 * 864e5) delete s[x]; s[k] = now; LS.set('sf.notified', s); }

/* ---------- una notte: voto, meteo, piano, testi ---------- */
function nightSamples5(n) { const s = []; for (let i = n.first; i >= 0 && i <= n.last; i++) if (n.dark[i]) s.push({ ms: n.t[i], mu: n.mAlt[i] > 0 }); return s; }
function evalNight(n, plan) {
  if (n.first < 0) return null;
  const q = rateNight(nightSamples5(n), STEP / 60, n.moonIll, n.darkH), w = wxNight(n), c = ncfg();
  const clearH = w ? w.clear * n.darkH : n.darkH, blocks = plan ? plan.blocks.filter((b) => b.hClear >= 0.75) : [];
  const good = !!w && q.r >= c.min && clearH >= 1.5 && blocks.length > 0;
  const when = !w ? '' : w.clear >= 0.85 ? tx('sereno tutta la notte') : w.win && w.winH >= 1 ? tx('sereno {a}–{b}', { a: fmtT(w.win[0]), b: fmtT(w.win[1]) }) : tx('{p}% del buio sereno', { p: Math.round(w.clear * 100) });
  const sl = w && seeLvl(w.see), extra = [
    w && w.prob != null ? tx('probabilità {p}%', { p: Math.round(w.prob * 100) }) : '',
    sl ? tx('seeing {s}', { s: tx(sl.t).toLowerCase() }) : '',
    n.moonIll >= 0.3 && n.moonUpFrac > 0.3 ? tx('Luna {p}%', { p: Math.round(n.moonIll * 100) }) : '',
    w && w.dew != null && w.dew <= 2 ? tx('condensa: scalda l’ottica') : '', w && w.gust != null && w.gust >= 30 ? tx('raffiche {v} km/h', { v: w.gust }) : '',
  ].filter(Boolean).join(' · ');
  const body = [blocks.slice(0, 3).map((b) => `${b.id} ${fmtT(b.t0)}–${fmtT(b.t1)}`).join(' · '), extra].filter(Boolean).join('\n');
  return { n, q, w, good, when, body, title: tx('Stasera si scatta: {w}', { w: when }), d0: n.t[n.first], d1: n.t[n.last] + DT };
}
const addDays = (ds, k) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + k); return dateStr(d); };

async function planNotifications() {
  if (!state.res) return;
  const on = notifyOn(), c = ncfg();
  if (!on) { notifySchedule([]); if (window.cielo && window.cielo.bgConfig) window.cielo.bgConfig({ on: false }); return; }
  if (!WX.d) return;
  if ((c.season || c.top) && !SP.plan && !planNotifications.waiting) { planNotifications.waiting = true; seasonPlan(() => { planNotifications.waiting = false; planNotifications(); }); }
  const out = [], today = defaultNightStr(), now = Date.now(), lead = c.lead * 60000, sent = sentGet(), sch = LS.get('sf.nsched', {});
  // avvisi da mandare una volta sola: se l'ora programmata è passata, è già arrivato
  const once = (key, item) => { if (sent[key]) return; if (sch[key] && sch[key] <= now) { sentMark(key); return; } out.push(item); sch[key] = item.at; };
  // stasera e domani sera
  const nights = [];
  for (let k = 0; k < 2; k++) {
    const ds = addDays(today, k), P = ds === state.res.night.ds ? { night: state.res.night, plan: tonightPlan() } : planOtherNight(ds);
    const ev = P ? evalNight(P.night, P.plan) : null; if (ev) nights.push({ k, ds, ev });
  }
  // runner in background (Android): se ha girato nelle ultime 6 ore, gli avvisi della sera li manda lui a ridosso del buio
  let bgOk = false;
  if (window.cielo && window.cielo.bgStatus) { const st = await window.cielo.bgStatus(); bgOk = !!(st && st.lastRun && now - st.lastRun < 6 * 3600e3); }
  for (const x of nights) {
    const at = x.ev.d0 - lead;
    if (c.evening && x.ev.good && at > now && !bgOk) out.push({ id: 1 + x.k, at, title: x.ev.title, body: x.ev.body });
  }
  // il meteo è cambiato (a app aperta): stanotte si apre, o si chiude dopo l'avviso
  const t = nights.find((x) => x.k === 0);
  if (t && c.change && now > t.ev.d0 - 6 * 3600e3 && now < t.ev.d1 - 2 * 3600e3) {
    const prev = LS.get('sf.nstate', {})[t.ds];
    if (prev && !prev.good && t.ev.good && !sent[t.ds + 'o']) { out.push({ id: 41, at: now + 2000, title: tx('Si apre: {w}', { w: t.ev.when }), body: t.ev.body }); sentMark(t.ds + 'o'); }
    else if (prev && prev.good && !t.ev.good && t.ev.w && (sent[t.ds + 'e'] || now > t.ev.d0 - lead) && !sent[t.ds + 'b']) { out.push({ id: 51, at: now + 2000, title: tx('Cambio di programma: nuvole stanotte'), body: tx('Ora è sereno solo il {p}% del buio: tieni le ore per un’altra notte.', { p: Math.round(t.ev.w.clear * 100) }) }); sentMark(t.ds + 'b'); }
    LS.set('sf.nstate', { [t.ds]: { good: t.ev.good } });
    if (t.ev.good && now > t.ev.d0 - lead) sentMark(t.ds + 'e');
  }
  // notti ottime nei prossimi tre giorni: il giorno prima alle 12:30 (o subito, se è già passato)
  if (c.top) {
    const L = nightsAhead(), ref = Math.max(...L.map((x) => x.samples.length / 6));
    for (let k = 1; k <= 3 && k < L.length; k++) {
      const x = L[k], key = x.ds + 't'; if (sent[key]) continue;
      const q = rateNight(x.samples, 1 / 6, x.ill, ref), w = wxSpan(x.samples.map((s) => s.ms), 10);
      if (!w || q.r < 4 || w.clear < 0.7 || (w.prob != null && w.prob < 0.6)) continue;
      const d = new Date(x.t0), noon = new Date(d); noon.setDate(noon.getDate() - 1); noon.setHours(12, 30, 0, 0);
      const at = Math.max(noon.getTime(), now + 3000); if (at > x.t0 + 6 * 3600e3) continue;
      const who = SP.plan ? (SP.plan.nights[k] || { alloc: [] }).alloc.map((a) => a.id).slice(0, 3) : [];
      const day = d.toLocaleDateString(LOCALE, { weekday: 'long' });
      once(key, { id: 10 + k, at, title: tx('{d}: notte ottima in arrivo', { d: day.charAt(0).toUpperCase() + day.slice(1) }), body: [tx('Senza Luna, sereno al {p}%', { p: Math.round(w.clear * 100) }) + (w.prob != null ? ' · ' + tx('probabilità {p}%', { p: Math.round(w.prob * 100) }) : ''), who.length ? tx('Per {t}', { t: who.join(', ') }) : ''].filter(Boolean).join('\n') });
    }
  }
  // ultime settimane: dal piano di stagione (se è pronto)
  if (c.season && SP.plan) {
    for (const tg of SP.plan.targets) {
      if (tg.last < 0 || tg.last > 10 || tg.rem < 0.2) continue;
      const d = new Date(), key = tg.id + '|s|' + d.getFullYear() + '-' + d.getMonth(); if (sent[key]) continue;
      const at6 = new Date(); at6.setHours(18, 0, 0, 0); const at = at6.getTime() > now ? at6.getTime() : now + 3000;
      once(key, { id: 100 + (hash(tg.id) % 800), at, title: tx('{t}: ultime settimane buone', { t: tg.id }), body: tx('In stagione fino al {d} e ti manca il {p}%: il piano di stagione gli dà la precedenza.', { d: fmtDay(aheadNight(state.res.C, tg.last).t0), p: Math.round(tg.rem * 100) }) });
    }
  }
  for (const k of Object.keys(sch)) if (now - sch[k] > 10 * 864e5) delete sch[k];
  LS.set('sf.nsched', sch);
  try { await notifySchedule(out); } catch { /* niente */ }
  // configurazione per lo script in background
  if (window.cielo && window.cielo.bgConfig) {
    const L = activeLoc().site;
    window.cielo.bgConfig({
      on: true, evening: c.evening, change: c.change, lat: (+L.lat).toFixed(3), lon: (+L.lon).toFixed(3), tz: -new Date().getTimezoneOffset(),
      nights: nights.map((x) => ({ id: 1 + x.k, ds: x.ds, d0: x.ev.d0, d1: x.ev.d1, alertAt: x.ev.d0 - lead, minH: 1.5, minClear: c.min >= 4 ? 0.7 : c.min >= 3 ? 0.5 : 0.3, good: x.ev.good, appScheduled: !bgOk && x.ev.good && c.evening, body: x.ev.body })),
      txt: { title: tx('Stasera si scatta: {w}'), all: tx('sereno tutta la notte'), win: tx('sereno {a}–{b}'), pct: tx('{p}% del buio sereno'), open: tx('Si apre: {w}'), bad: tx('Cambio di programma: nuvole stanotte'), badBody: tx('Ora è sereno solo il {p}% del buio: tieni le ore per un’altra notte.') },
    });
  }
}
async function toggleNotify() {
  const sync = () => { renderTonight(); if (UI.view === 'setup') renderSetup(); };
  if (notifyOn()) { LS.set('sf.notify', false); await notifySchedule([]); if (window.cielo && window.cielo.bgConfig) window.cielo.bgConfig({ on: false }); toast(tx('Avvisi spenti')); sync(); return; }
  const ok = await notifyPermission();
  if (!ok) { toast(tx('Le notifiche non sono permesse: abilitale nelle impostazioni del sistema')); sync(); return; }
  LS.set('sf.notify', true); await planNotifications(); sync();
  toast(tx('Avvisi accesi: scegli in Setup quali e con quanto anticipo'));
}
/* prova: un avviso fra 5 secondi con la notte di stanotte */
async function testNotify() {
  const ok = await notifyPermission(); if (!ok) { toast(tx('Le notifiche non sono permesse: abilitale nelle impostazioni del sistema')); return; }
  const ev = evalNight(state.res.night, tonightPlan());
  await notifySchedule([{ id: 99, at: Date.now() + 5000, title: ev && ev.when ? ev.title : tx('Prova degli avvisi di Skyframe'), body: (ev && ev.body) || tx('Prova degli avvisi di Skyframe') }]);
  toast(tx('Arriva fra 5 secondi'));
  setTimeout(() => planNotifications(), 8000);
}
