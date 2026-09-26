'use strict';
/* ============================ avvisi ============================
   "Stanotte si riprende": per stanotte e domani sera, un'ora prima del buio, se le previsioni danno almeno un'ora e
   mezza di cielo sgombro col buio e almeno uno dei tuoi target (preferiti e progetti; senza, i primi della lista) ha
   un posto nel piano. Si ripreparano ogni volta che l'app si apre o aggiorna il meteo. Su Android sono programmati nel
   sistema e arrivano anche ad app chiusa; sul computer e nel browser arrivano se l'app è aperta. */
const NOTIFY_LEAD = 60; // minuti prima del buio
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
    const d = n.at - Date.now(); if (d <= 0 || d > 2 ** 31 - 1) continue;
    nbridge.timers.push(setTimeout(() => { try { new Notification(n.title, { body: n.body, tag: 'skyframe-' + n.id }); } catch { /* niente */ } }, d));
  }
}
function nightNote(n, plan) {
  const w = wxNight(n); if (!w || !plan || !plan.blocks.length) return null;
  const clearH = w.clear * n.darkH; if (clearH < 1.5) return null;
  const good = plan.blocks.filter((b) => b.hClear >= 0.75); if (!good.length) return null;
  const when = w.clear >= 0.85 ? tx('sereno tutta la notte') : w.win && w.winH >= 1 ? tx('sereno {a}–{b}', { a: fmtT(w.win[0]), b: fmtT(w.win[1]) }) : tx('{p}% del buio sereno', { p: Math.round(w.clear * 100) });
  const moon = n.moonIll >= 0.5 && n.moonUpFrac > 0.3 ? ' · ' + tx('Luna {p}%', { p: Math.round(n.moonIll * 100) }) : '';
  return { title: tx('Stanotte si riprende: {w}', { w: when }), body: good.slice(0, 3).map((b) => `${b.id} ${fmtT(b.t0)}–${fmtT(b.t1)}`).join(' · ') + moon };
}
async function planNotifications() {
  if (!notifyOn() || !state.res || !WX.d) { if (!notifyOn()) notifySchedule([]); return; }
  const out = [], n0 = state.res.night, today = defaultNightStr();
  const add = (n, plan, id) => { if (n.first < 0) return; const at = n.t[n.first] - NOTIFY_LEAD * 60000; if (at <= Date.now()) return; const x = nightNote(n, plan); if (x) out.push({ id, at, ...x }); };
  if (n0.ds === today) add(n0, tonightPlan(), 1);
  else { const t = planOtherNight(today); if (t) add(t.night, t.plan, 1); }
  const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 1);
  const tom = planOtherNight(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); if (tom) add(tom.night, tom.plan, 2);
  try { await notifySchedule(out); } catch { /* niente */ }
}
async function toggleNotify() {
  if (notifyOn()) { LS.set('sf.notify', false); await notifySchedule([]); toast(tx('Avvisi spenti')); renderTonight(); return; }
  const ok = await notifyPermission();
  if (!ok) { toast(tx('Le notifiche non sono permesse: abilitale nelle impostazioni del sistema')); return; }
  LS.set('sf.notify', true); await planNotifications(); renderTonight();
  toast(tx('Ti avviso un’ora prima del buio quando il meteo dà sereno per i tuoi target'));
}
