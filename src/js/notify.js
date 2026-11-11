'use strict';
/* ============================ avvisi ============================
   Quattro avvisi, ognuno si accende e spegne da Setup:
   - «Stanotte sereno»: prima del buio (anticipo a scelta), se la notte arriva almeno al voto scelto e il piano ha un
     posto per i tuoi target: finestra serena, target con gli orari, Luna, condensa e vento;
   - «Notte ottima prevista»: dal giorno prima, per una notte senza Luna e serena secondo tutti i modelli;
   - «Il meteo è cambiato»: stanotte si apre, o si chiude dopo l'avviso;
   - «Ultime settimane di visibilità»: un tuo target sta per uscire di stagione e il lavoro non è finito.
   Android: l'app passa al motore nativo (android/…/alerts) la ricetta delle prossime 30 notti (buio, Luna, piano a cielo
   sereno, testi). Il motore riscarica le nuvole da solo ad app chiusa, con una sveglia all'ora dell'avviso, e decide lui:
   quello che arriva è sempre la previsione del momento. Lo stesso motore riempie il widget «Stanotte» della schermata
   Home, anche ad avvisi spenti. Computer e browser: si programmano qui, ad app aperta. */
const NCFG_DEF = { evening: true, top: true, change: true, season: true, lead: 60, min: 3 };
const ncfg = () => ({ ...NCFG_DEF, ...LS.get('sf.notifyCfg', {}) });
function setNcfg(k, v) { LS.set('sf.notifyCfg', { ...ncfg(), [k]: v }); planNotifications(); }
const notifyOn = () => !!LS.get('sf.notify', false);
const nativeAlerts = () => (window.cielo && window.cielo.alerts) || null;
const nbridge = { timers: [] };
/* Computer: avvisi a finestra chiusa. Chiudendo la finestra Skyframe resta nella barra di sistema (main.js) e continua
   ad aggiornare meteo e avvisi; vale solo con gli avvisi accesi. */
const bgOn = () => DESK && !!(window.cielo && window.cielo.background) && notifyOn() && !!LS.get('sf.bg', false);
async function syncBackground() {
  if (!DESK || !(window.cielo && window.cielo.background)) return false;
  try { return await window.cielo.background(bgOn(), { open: tx('Apri Skyframe'), quit: tx('Esci') }); } catch { return false; }
}
async function notifyPermission() {
  if (window.cielo && window.cielo.notifyPermission) return window.cielo.notifyPermission();
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
/* computer e browser: programma gli avvisi [{ id, at, title, body }] togliendo quelli di prima */
async function notifySchedule(list) {
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
  const sl = w && seeLvl(w.see), see = sl ? tx('seeing {s}', { s: tx(sl.t).toLowerCase() }) : '', extra = [
    w && w.prob != null ? tx('probabilità {p}%', { p: Math.round(w.prob * 100) }) : '', see,
    n.moonIll >= 0.3 && n.moonUpFrac > 0.3 ? tx('Luna {p}%', { p: Math.round(n.moonIll * 100) }) : '',
    w && w.dew != null && w.dew <= 2 ? tx('condensa: riscalda l’ottica') : '', w && w.gust != null && w.gust >= 30 ? tx('raffiche {v} km/h', { v: w.gust }) : '',
  ].filter(Boolean).join(' · ');
  const body = [blocks.slice(0, 3).map((b) => `${b.id} ${fmtT(b.t0)}–${fmtT(b.t1)}`).join(' · '), extra].filter(Boolean).join('\n');
  return { n, q, w, good, when, body, see, title: tx('Stanotte sereno: {w}', { w: when }), d0: n.t[n.first], d1: n.t[n.last] + DT };
}
const BG_N = 30; // notti nella ricetta del motore nativo
const addDays = (ds, k) => { const [y, m, d] = ds.split('-').map(Number), x = new Date(Date.UTC(y, m - 1, d + k)); return x.getUTCFullYear() + '-' + pad2(x.getUTCMonth() + 1) + '-' + pad2(x.getUTCDate()); };
const dayName = (t0) => { const d = fmtNight(t0, { weekday: 'long' }); return d.charAt(0).toUpperCase() + d.slice(1); };
/* ultime settimane di un target: una volta al mese, dalle 18 del giorno in cui gli restano dieci notti */
function seasonAlerts() {
  if (!ncfg().season || !SP.plan || !state.res) return [];
  const C = state.res.C, out = [], w = wall(Date.now()), used = new Set();
  // i giorni si contano dalla notte mostrata: guardandone una passata l'ora non deve finire prima di stasera, o il motore
  // di Android darebbe l'avviso per perso
  const [ty, tm, td] = defaultNightStr().split('-').map(Number), floor = wallMs(ty, tm - 1, td, 18, 0, siteTz(C.active.site));
  for (const tg of SP.plan.targets) {
    if (tg.last < 0 || tg.rem < 0.2) continue;
    const from = Math.max(aheadNight(C, Math.max(0, tg.last - 10)).t0 + 6 * 3600e3, floor);
    let id = 100 + (hash(tg.id) % 800); while (used.has(id)) id = 100 + ((id - 99) % 800); used.add(id); // due target, due avvisi
    out.push({ id, key: tg.id + '|s|' + w.getUTCFullYear() + '-' + w.getUTCMonth(), at: from, title: tx('{t}: ultime settimane', { t: tg.id }), body: tx('Periodo favorevole fino al {d}, manca il {p}%.', { d: fmtDay(aheadNight(C, tg.last).t0), p: Math.round(tg.rem * 100) }) });
  }
  return out;
}

async function planNotifications() {
  if (!state.res) return;
  const on = notifyOn(), c = ncfg(), nat = nativeAlerts();
  syncBackground();
  // ad avvisi spenti la ricetta serve solo se sulla schermata Home c'è il widget. Finché Android non ha detto se c'è
  // (RCP.widgets null) non si spegne niente: la ricetta spenta gli toglierebbe il testo
  if (!on && !(nat && RCP.widgets)) { if (!nat) notifySchedule([]); else if (RCP.widgets != null && RCP.sent !== 'off') { RCP.sent = 'off'; nat.configure({ on: false }); } return; }
  if (on && (c.season || c.top)) {
    const key = seasonKey(seasonTargets());
    if ((!SP.plan || SP.key !== key) && SP.bad !== key) { // piano non riuscito: gli altri avvisi si fanno lo stesso
      if (!planNotifications.waiting) { planNotifications.waiting = true; seasonPlan(() => { planNotifications.waiting = false; planNotifications(); }); }
      if (!nat) return;
    }
  }
  if (nat) { recipeSoon(); return; }
  if (!WX.d) return;
  const out = [], today = defaultNightStr(), now = Date.now(), lead = c.lead * 60000, sent = sentGet(), sch = LS.get('sf.nsched', {});
  // avvisi da mandare una volta sola: se l'ora programmata è passata, è già arrivato
  const once = (key, item) => { if (sent[key]) return; if (sch[key] && sch[key] <= now) { sentMark(key); return; } out.push(item); sch[key] = item.at; };
  // stasera e domani sera
  const nights = [];
  for (let k = 0; k < 2; k++) {
    const ds = addDays(today, k), P = ds === state.res.night.ds ? { night: state.res.night, plan: tonightPlan(false, true) } : planOtherNight(ds);
    const ev = P ? evalNight(P.night, P.plan) : null; if (ev) nights.push({ k, ds, ev });
  }
  for (const x of nights) {
    const at = x.ev.d0 - lead;
    if (c.evening && x.ev.good && at > now) out.push({ id: 1 + x.k, at, title: x.ev.title, body: x.ev.body });
  }
  // il meteo è cambiato: stanotte si apre, o si chiude dopo l'avviso. Si confrontano solo due previsioni diverse dello
  // stesso luogo: cambiare profilo, luogo o finire un target non è un cambio di meteo
  const t = nights.find((x) => x.k === 0);
  if (t && c.change && wxOk() && t.ev.w && now > t.ev.d0 - 6 * 3600e3 && now < t.ev.d1 - 2 * 3600e3) {
    const sk = siteKey(activeLoc().site) + '|' + t.ds, prev = LS.get('sf.nstate', {})[sk], w = t.ev.w;
    const clear = w.clear * t.ev.n.darkH >= 1.5 && w.clear >= (c.min >= 4 ? 0.7 : c.min >= 3 ? 0.5 : 0.3);
    if (prev && prev.at !== WX.d.at) {
      if (!prev.clear && clear && t.ev.good && !sent[sk + 'o']) { out.push({ id: 41, at: now + 2000, title: tx('Schiarita prevista: {w}', { w: t.ev.when }), body: t.ev.body }); sentMark(sk + 'o'); }
      else if (prev.clear && !clear && (sent[sk + 'e'] || now > t.ev.d0 - lead) && !sent[sk + 'b']) { out.push({ id: 51, at: now + 2000, title: tx('Cambio di programma: nuvole'), body: tx('Previsione aggiornata: solo il {p}% del buio è sereno.', { p: Math.round(w.clear * 100) }) }); sentMark(sk + 'b'); }
    }
    LS.set('sf.nstate', { [sk]: { clear, at: WX.d.at } });
    if (t.ev.good && now > t.ev.d0 - lead) sentMark(sk + 'e');
  }
  // notti ottime nei prossimi tre giorni: il giorno prima alle 12:30 (o subito, se è già passato)
  if (c.top) {
    const L = nightsAhead(), ref = Math.max(...L.map((x) => x.samples.length / 6));
    for (let k = 1; k <= 3 && k < L.length; k++) {
      const x = L[k], key = x.ds + 't'; if (sent[key]) continue;
      const q = rateNight(x.samples, 1 / 6, x.ill, ref), w = wxSpan(x.samples.map((s) => s.ms), 10);
      if (!w || q.r < 4 || w.clear < 0.7 || (w.prob != null && w.prob < 0.6)) continue;
      const at = Math.max(x.t0 - 864e5 + 1800e3, now + 3000); if (at > x.t0 + 6 * 3600e3) continue;
      const who = SP.plan ? (SP.plan.nights[k] || { alloc: [] }).alloc.map((a) => a.id).slice(0, 3) : [];
      once(key, { id: 10 + k, at, title: tx('{d}: notte ottima', { d: dayName(x.t0) }), body: [tx('Senza Luna, sereno al {p}%', { p: Math.round(w.clear * 100) }) + (w.prob != null ? ' · ' + tx('probabilità {p}%', { p: Math.round(w.prob * 100) }) : ''), who.length ? tx('Per {t}', { t: who.join(', ') }) : ''].filter(Boolean).join('\n') });
    }
  }
  for (const s of seasonAlerts()) once(s.key, { id: s.id, at: Math.max(s.at, now + 3000), title: s.title, body: s.body });
  for (const k of Object.keys(sch)) if (now - sch[k] > 10 * 864e5) delete sch[k];
  LS.set('sf.nsched', sch);
  try { await notifySchedule(out); } catch { /* niente */ }
}

/* ---------- Android: la ricetta delle notti per il motore nativo ---------- */
const RCP = { key: '', map: new Map(), shown: '', job: 0, sent: '', sentAt: 0, t: 0, widgets: null };
/* quanti widget ci sono sulla schermata Home: lo sa solo Android, lo si chiede all'avvio e al ritorno in primo piano */
async function alertsSync() {
  const nat = nativeAlerts(); if (!nat) return null;
  let st = null; try { st = await nat.status(); } catch { /* niente */ }
  const w = (st && st.widgets) | 0;
  if (w !== RCP.widgets) { RCP.widgets = w; planNotifications(); }
  return st;
}
/* una notte per il motore: buio, intervalli con la Luna alta, blocchi del piano a cielo sereno */
function recipeOf(n, plan) {
  if (n.first < 0) return null;
  const moon = []; let a = -1;
  for (let i = n.first; i <= n.last + 1; i++) {
    const up = i <= n.last && n.dark[i] && n.mAlt[i] > 0 && n.moonIll > 0.1;
    if (up && a < 0) a = n.t[i]; else if (!up && a >= 0) { moon.push([a, n.t[i - 1] + DT]); a = -1; }
  }
  const d0 = n.t[n.first], r = { ds: n.ds, t0: n.t0, d0, d1: n.t[n.last] + DT, tz: tzOff(d0, TZ.id), ill: Math.round(n.moonIll * 1000) / 1000, moon, day: dayName(n.t0), sd: fmtNight(n.t0, { weekday: 'short', day: 'numeric' }) };
  // senza target tuoi e senza niente di riprendibile non c'è un piano da rispettare: decide il cielo
  if (plan && (plan.mine || plan.blocks.length)) r.blocks = plan.blocks.map((b) => ({ id: b.id, a: b.t0, b: b.t1 }));
  return r;
}
function clearPlan(ds) {
  if (ds === state.res.night.ds) return { night: state.res.night, plan: tonightPlan(true, true) };
  return planOtherNight(ds, true) || { night: computeNight(active(), ds), plan: null };
}
function recipeSoon() { clearTimeout(RCP.t); RCP.t = setTimeout(recipeBuild, 300); }
/* le notti si calcolano a pezzi (una costa come un ricalcolo dei preferiti) e restano finché non cambia qualcosa */
function recipeBuild() {
  if (!nativeAlerts() || !state.res || !(notifyOn() || RCP.widgets)) return;
  if (JOB.key) { recipeSoon(); return; } // ricalcolo in corso (luogo o profilo appena cambiati): state.res è ancora quello di prima
  const today = defaultNightStr(), shown = state.res.night.ds, ids = Object.keys(state.projects).filter((id) => inMyList(id) && !isDone(id)).sort();
  const key = [hash(JSON.stringify(active())), today, ids.map((id) => id + ':' + projProgress(id).toFixed(3)).join(','), JSON.stringify(LS.get('sf.planEd', {})), moonMode()].join('|');
  if (RCP.key !== key) { RCP.key = key; RCP.map = new Map(); }
  // la notte mostrata prende il piano dello schermo, le altre un calcolo a parte: cambiando notte si rifanno solo quelle due
  else if (RCP.shown !== shown) { RCP.map.delete(RCP.shown); RCP.map.delete(shown); }
  RCP.shown = shown;
  const job = ++RCP.job; let k = 0;
  const step = () => {
    if (job !== RCP.job) return;
    const t0 = performance.now();
    while (k < BG_N && performance.now() - t0 < 8) { const ds = addDays(today, k++); if (!RCP.map.has(ds)) { const P = clearPlan(ds); RCP.map.set(ds, recipeOf(P.night, P.plan)); } if (k === 2) break; }
    if (k === 2 || k >= BG_N) recipeSend(today); // stasera e domani subito, il resto del mese quando è pronto
    if (k < BG_N) setTimeout(step, 40);
  };
  step();
}
async function recipeSend(today) {
  const nat = nativeAlerts(), c = ncfg(), L = activeLoc().site, now = Date.now(), on = notifyOn(); if (!nat || !(on || RCP.widgets)) return;
  const nights = []; for (let k = 0; k < BG_N; k++) { const r = RCP.map.get(addDays(today, k)); if (r) nights.push({ ...r }); }
  // giudizio dell'app su stasera e domani: serve se all'ora dell'avviso manca la rete
  if (WX.d && wxOk()) for (let k = 0; k < 2; k++) {
    const ds = addDays(today, k), r = nights.find((x) => x.ds === ds); if (!r) continue;
    const P = ds === state.res.night.ds ? { night: state.res.night, plan: tonightPlan(false, true) } : planOtherNight(ds), ev = P ? evalNight(P.night, P.plan) : null;
    if (ev && ev.w) Object.assign(r, { good: ev.good, when: ev.when, body: ev.body, extra: ev.see });
  }
  const cfg = {
    v: 1, on, at: now, evening: c.evening, change: c.change, top: c.top, lead: c.lead, minR: c.min, minH: 1.5,
    lat: +(+L.lat).toFixed(3), lon: +(+L.lon).toFixed(3), models: WX_MODELS.map((m) => [m[0], m[2]]), nights, timed: on ? seasonAlerts() : [],
    txt: {
      title: tx('Stanotte sereno: {w}'), all: tx('sereno tutta la notte'), win: tx('sereno {a}–{b}'), pct: tx('{p}% del buio sereno'), open: tx('Schiarita prevista: {w}'),
      bad: tx('Cambio di programma: nuvole'), badBody: tx('Previsione aggiornata: solo il {p}% del buio è sereno.'), topTitle: tx('{d}: notte ottima'), topBody: tx('Senza Luna, sereno al {p}%'),
      forT: tx('Per {t}'), moon: tx('Luna {p}%'), gust: tx('raffiche {v} km/h'), dew: tx('condensa: riscalda l’ottica'), test: tx('Prova degli avvisi'), channel: tx('Avvisi della notte'),
      // widget della schermata Home
      wTonight: tx('Stanotte'), wNext: tx('prossima utile {d}'), wNoWx: tx('meteo non disponibile'), wMoon: tx('Luna'), wNoDark: tx('Senza buio'),
      rate: ['Coperta', 'Scarsa', 'Discreta', 'Buona', 'Ottima'].map((x) => tx(x)),
    },
  };
  // uguale all'ultima mandata e ancora fresca: non si rimanda
  const sig = JSON.stringify({ ...cfg, at: 0 });
  if (sig === RCP.sent && now - RCP.sentAt < 3600e3) return;
  RCP.sent = sig; RCP.sentAt = now;
  try { await nat.configure(cfg); } catch { RCP.sent = ''; }
  if (typeof renderAlertStatus === 'function') renderAlertStatus();
}
/* l'avviso toccato apre la sua notte */
async function alertsOpen() {
  const nat = nativeAlerts(); if (!nat || !state.res) return;
  let ds = ''; try { ds = ((await nat.consumeOpen()) || {}).night || ''; } catch { /* niente */ }
  if (!/^\d{4}-\d\d-\d\d$/.test(ds) || ds < defaultNightStr()) return;
  setView('tonight'); if (ds === defaultNightStr()) setLive(); else goNight(ds, true);
}

async function toggleNotify() {
  const sync = () => { renderTonight(); if (UI.view === 'setup') renderSetup(); };
  if (notifyOn()) { LS.set('sf.notify', false); await planNotifications(); toast(tx('Avvisi spenti')); sync(); return; }
  const ok = await notifyPermission();
  if (!ok) { toast(tx('Notifiche bloccate: attivale nelle impostazioni del sistema')); sync(); return; }
  LS.set('sf.notify', true); await planNotifications(); sync();
  toast(tx('Avvisi attivi: si regolano in Setup'));
}
/* prova: l'avviso di stanotte com'è adesso (Android: subito, dal motore nativo; altrove fra 5 secondi) */
async function testNotify() {
  const ok = await notifyPermission(); if (!ok) { toast(tx('Notifiche bloccate: attivale nelle impostazioni del sistema')); return; }
  const nat = nativeAlerts();
  if (nat) { try { await nat.run({ test: true }); } catch { /* niente */ } return; }
  const ev = evalNight(state.res.night, tonightPlan());
  await notifySchedule([{ id: 99, at: Date.now() + 5000, title: ev && ev.when ? ev.title : tx('Prova degli avvisi'), body: (ev && ev.body) || tx('Prova degli avvisi') }]);
  toast(tx('Arriva fra 5 secondi'));
  setTimeout(() => planNotifications(), 8000);
}
