'use strict';
/* ============================ meteo ============================
   Nuvolosità ora per ora dei prossimi 8 giorni da Open-Meteo (il modello migliore per quel punto) per il luogo attivo,
   tenuta 90 minuti. Per ogni istante una frazione di cielo sgombro: 1 fino al 15% di nubi, 0 dal 75%; le nubi basse e
   medie contano per intero, le alte (sottili) per il 60%. Fuori dalle previsioni: null, e lì si assume sereno.
   Serve a: striscia della notte, riquadro Meteo, calendario delle notti (contano le ore serene), piano di stanotte. */
const WX = { d: null, busy: false, err: false };
const wxKey = (s) => `${(+s.lat).toFixed(2)},${(+s.lon).toFixed(2)}`;
const WX_TTL = 90 * 60e3;
const clearFrac = (lo, mi, hi) => clamp((75 - Math.max(lo || 0, mi || 0, 0.6 * (hi || 0))) / 60, 0, 1);
function wxAt(ms) {
  const d = WX.d; if (!d || d.key !== wxKey(activeLoc().site)) return null;
  const x = (ms / 1000 - d.t0) / 3600; if (!(x >= 0) || x > d.f.length - 1) return null;
  const i = Math.floor(x), u = x - i; return i + 1 < d.f.length ? d.f[i] * (1 - u) + d.f[i + 1] * u : d.f[i];
}
function wxCloudAt(ms) {
  const d = WX.d; if (!d || d.key !== wxKey(activeLoc().site)) return null;
  const i = Math.round((ms / 1000 - d.t0) / 3600); return i >= 0 && i < d.cc.length ? d.cc[i] : null;
}
async function loadWeather(force) {
  const s = activeLoc().site, key = wxKey(s);
  if (!force && WX.d && WX.d.key === key && Date.now() - WX.d.at < WX_TTL) return false;
  const c = LS.get('sf.wx2', null);
  if (!force && c && c.key === key && Date.now() - c.at < WX_TTL) { WX.d = c; return true; }
  if (WX.busy) return false; WX.busy = true;
  try {
    const q = `latitude=${(+s.lat).toFixed(3)}&longitude=${(+s.lon).toFixed(3)}&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&past_days=1&forecast_days=8&timeformat=unixtime&timezone=GMT`;
    const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), h = j.hourly || {}, t = h.time || [];
    if (!t.length) throw new Error('vuoto');
    const f = t.map((_, i) => clearFrac(h.cloud_cover_low[i], h.cloud_cover_mid[i], h.cloud_cover_high[i]));
    WX.d = { key, at: Date.now(), t0: t[0], f: f.map((x) => Math.round(x * 100) / 100), cc: (h.cloud_cover || []).map((x) => Math.round(x || 0)) };
    WX.err = false; LS.set('sf.wx2', WX.d); return true;
  } catch (e) { WX.err = true; return false; } finally { WX.busy = false; }
}
/* il meteo entra nel calcolo di stanotte: calendari da rifare e tutto ciò che mostra le ore */
function applyWeather() {
  if (!state.res) return;
  const C = state.res.C; C.wx = WX.d && WX.d.key === wxKey(activeLoc().site) ? wxAt : null;
  if (C.ahead) C.ahead.cache.clear();
}
function weatherChanged() { applyWeather(); renderFacts(); drawStrip(); renderTonight(); renderList(); if (state.sel && !$('#drawer').hidden) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; } }
async function refreshWeather(force) { if (await loadWeather(force)) weatherChanged(); planNotifications(); }
/* stanotte in due parole: la finestra serena più lunga col buio e quanto del buio è sereno */
function wxNight(n) {
  if (!WX.d || n.first < 0) return null;
  let tot = 0, sum = 0, run = 0, best = [0, -1, -1], cur = -1, known = 0;
  for (let i = n.first; i <= n.last; i++) {
    if (!n.dark[i]) continue; const f = wxAt(n.t[i]); tot++;
    if (f == null) { run = 0; cur = -1; continue; } known++; sum += f;
    if (f >= 0.7) { if (cur < 0) cur = i; run++; if (run > best[0]) best = [run, cur, i]; } else { run = 0; cur = -1; }
  }
  if (!known || known < tot * 0.5) return null;
  return { clear: sum / known, win: best[1] >= 0 ? [n.t[best[1]], n.t[best[2]] + DT] : null, winH: best[0] * STEP / 60 };
}
