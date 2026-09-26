'use strict';
/* ============================ meteo astronomico ============================
   Cinque fonti, tutte da Open-Meteo (dati liberi, CC BY 4.0), per il luogo attivo, tenute 90 minuti:
   1) nuvole basse, medie e alte da sette modelli: ItaliaMeteo ICON-2I (2 km, Italia), DWD ICON-D2 (2 km, Europa
      centrale), Météo-France AROME/ARPEGE, ECMWF IFS, DWD ICON, UK Met Office, NOAA GFS (quelli regionali solo dove
      coprono). Ogni modello dà una frazione di cielo sgombro (1 fino al 15% di nubi, 0 dal 75%; le alte, sottili,
      pesano il 60%); si usa la media pesata (più peso all'alta risoluzione) e la distanza fra il modello più ottimista e
      il più pessimista dice quanto sono d'accordo;
   2) ensemble ECMWF (51 scenari): probabilità di cielo sereno (nubi sotto il 30%), e la sua media entra fra i modelli;
   3) seeing: turbolenza ottica integrata sui livelli di pressione di GFS ed ECMWF (modello di Dewan, come Trinquet e
      Vernin 2006), in secondi d'arco alla scala di meteoblue: su 30 ore a Milano correlazione 0,85 con i loro valori.
      Più la corrente a getto (vento massimo fra 300 e 150 hPa);
   4) trasparenza: spessore ottico degli aerosol a 550 nm e polveri desertiche (CAMS, Copernicus);
   5) al suolo: temperatura e punto di rugiada (condensa), umidità, vento e raffiche, probabilità di pioggia.
   Fuori dalle previsioni i valori sono null e i calcoli assumono sereno. */
const WX = { d: null, busy: false, err: false, other: new Map() };
const wxKey = (s) => `${(+s.lat).toFixed(2)},${(+s.lon).toFixed(2)}`;
const WX_TTL = 90 * 60e3, WX_LS = 'sf.wx3';
try { localStorage.removeItem('sf.wx2'); } catch { /* niente */ } // formato della 0.6
const clearFrac = (lo, mi, hi) => clamp((75 - Math.max(lo || 0, mi || 0, 0.6 * (hi || 0))) / 60, 0, 1);
const clearTot = (cc) => clamp((75 - cc) / 60, 0, 1);
/* modelli per le nuvole: id Open-Meteo, nome, peso nella media */
const WX_MODELS = [
  ['italia_meteo_arpae_icon_2i', 'ItaliaMeteo ICON-2I', 1.6], ['icon_d2', 'DWD ICON-D2', 1.5], ['meteofrance_seamless', 'Météo-France', 1.2],
  ['ecmwf_ifs025', 'ECMWF IFS', 1.3], ['icon_seamless', 'DWD ICON', 1.1], ['ukmo_seamless', 'UK Met Office', 1.0], ['gfs_seamless', 'NOAA GFS', 0.8],
];
const WX_ENS = ['ens', 'ECMWF ensemble', 1.0];
const WX_PL = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 275, 250, 225, 200, 175, 150, 125, 100];
const SEE_K = 1.12; // media del modello portata a quella di meteoblue (1,29″ contro 1,15″ sulle stesse ore)

async function wxGet(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.error) throw new Error(j.reason || 'errore'); return j; }
const wxQ = (s, days) => `latitude=${(+s.lat).toFixed(3)}&longitude=${(+s.lon).toFixed(3)}&past_days=1&forecast_days=${days}&timeformat=unixtime&timezone=GMT`;
/* seeing di un'ora dai livelli di pressione di un modello (suffisso _m), sopra la quota del luogo */
function seeingOf(h, i, sfx, elev) {
  const L = [];
  for (const p of WX_PL) {
    const g = (k) => { const a = h[`${k}_${p}hPa${sfx}`]; return a ? a[i] : null; };
    const z = g('geopotential_height'), T = g('temperature'), ws = g('wind_speed'), wd = g('wind_direction');
    if (z == null || T == null || ws == null || wd == null || z < elev + 30) continue;
    const Tk = T + 273.15, a = wd * D2R; L.push({ p, z, Tk, th: Tk * Math.pow(1000 / p, 0.286), u: -ws * Math.sin(a), v: -ws * Math.cos(a), ws });
  }
  if (L.length < 5) return null;
  let J = 0, jet = 0;
  for (let k = 0; k < L.length - 1; k++) {
    const A = L[k], B = L[k + 1], dz = B.z - A.z; if (dz <= 0) continue;
    const dth = (B.th - A.th) / dz, S = Math.hypot(B.u - A.u, B.v - A.v) / dz, Pm = (A.p + B.p) / 2, Tm = (A.Tk + B.Tk) / 2;
    const M = 79e-6 * Pm / (Tm * Tm) * dth, strat = Pm < 300 && -(B.Tk - A.Tk) / dz * 1000 < 2;
    J += 2.8 * Math.pow(0.1, 4 / 3) * Math.pow(10, strat ? 0.506 + 50 * S : 1.64 + 42 * S) * M * M * dz;
  }
  for (const x of L) if (x.p <= 300 && x.p >= 150) jet = Math.max(jet, x.ws);
  if (!(J > 0)) return null;
  const lam = 5e-7, k = 2 * Math.PI / lam;
  return { e: 0.98 * lam / Math.pow(0.423 * k * k * J, -0.6) * 206265, jet };
}
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const r0 = (x) => (x == null || !isFinite(x) ? null : Math.round(x));
async function loadWeather(force) {
  const s = activeLoc().site, key = wxKey(s);
  if (!force && WX.d && WX.d.key === key && Date.now() - WX.d.at < WX_TTL) return false;
  const c = LS.get(WX_LS, null);
  if (!force && c && c.key === key && Date.now() - c.at < WX_TTL) { WX.d = c; return true; }
  if (WX.busy) return false; WX.busy = true;
  try {
    const cc = 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high';
    const plv = WX_PL.flatMap((p) => [`temperature_${p}hPa`, `wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`]).join(',');
    const [A, B, C, E, Q] = await Promise.allSettled([
      wxGet(`https://api.open-meteo.com/v1/forecast?${wxQ(s, 8)}&hourly=${cc}&models=${WX_MODELS.map((m) => m[0]).join(',')}`),
      wxGet(`https://api.open-meteo.com/v1/forecast?${wxQ(s, 8)}&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability`),
      wxGet(`https://api.open-meteo.com/v1/forecast?${wxQ(s, 8)}&hourly=${plv}&models=gfs_seamless,ecmwf_ifs025&wind_speed_unit=ms`),
      wxGet(`https://ensemble-api.open-meteo.com/v1/ensemble?${wxQ(s, 8)}&hourly=cloud_cover&models=ecmwf_ifs025`),
      wxGet(`https://air-quality-api.open-meteo.com/v1/air-quality?${wxQ(s, 5)}&hourly=aerosol_optical_depth,dust`),
    ]);
    if (A.status !== 'fulfilled') throw A.reason;
    const h = A.value.hourly, T = h.time, n = T.length, t0 = T[0];
    const at = (res, k) => { // serie di un'altra fonte allineata alle ore delle nuvole
      if (res.status !== 'fulfilled') return null; const hh = res.value.hourly, a = hh[k]; if (!a) return null;
      const off = Math.round((hh.time[0] - t0) / 3600); return T.map((_, i) => { const j = i - off; return j >= 0 && j < a.length ? a[j] : null; });
    };
    // ensemble: probabilità di sereno e media dei 51 scenari
    let prob = null, ensClear = null;
    if (E.status === 'fulfilled') {
      const eh = E.value.hourly, mk = Object.keys(eh).filter((k) => /^cloud_cover(_member\d+)?$/.test(k)), off = Math.round((eh.time[0] - t0) / 3600);
      prob = T.map((_, i) => { const j = i - off; if (j < 0 || j >= eh.time.length) return null; let c = 0, m = 0; for (const k of mk) { const v = eh[k][j]; if (v == null) continue; m++; if (v <= 30) c++; } return m >= 10 ? c / m : null; });
      ensClear = T.map((_, i) => { const j = i - off; if (j < 0 || j >= eh.time.length) return null; let s2 = 0, m = 0; for (const k of mk) { const v = eh[k][j]; if (v == null) continue; m++; s2 += clearTot(v); } return m >= 10 ? s2 / m : null; });
    }
    const models = {}, clear = [], lo = [], mi = [], hi = [], spread = [], nm = [];
    for (const [id] of WX_MODELS) { const a = h[`cloud_cover_low_${id}`]; if (a && a.some((v) => v != null)) models[id] = T.map((_, i) => (a[i] == null ? null : r2(clearFrac(a[i], h[`cloud_cover_mid_${id}`][i], h[`cloud_cover_high_${id}`][i])))); }
    if (ensClear) models.ens = ensClear.map(r2);
    const W = Object.fromEntries([...WX_MODELS, WX_ENS].map((m) => [m[0], m[2]]));
    for (let i = 0; i < n; i++) {
      let sw = 0, sc = 0, sl = 0, sm = 0, sh = 0, mn = 1, mx = 0, k = 0;
      for (const [id, arr] of Object.entries(models)) {
        const f = arr[i]; if (f == null) continue; const w = W[id]; sw += w; sc += w * f; k++; mn = Math.min(mn, f); mx = Math.max(mx, f);
        if (id !== 'ens') { const q = (x) => h[`cloud_cover_${x}_${id}`][i] || 0; sl += w * q('low'); sm += w * q('mid'); sh += w * q('high'); }
      }
      const swc = sw - (models.ens && models.ens[i] != null ? W.ens : 0);
      clear.push(sw ? r2(sc / sw) : null); nm.push(k); spread.push(k > 1 ? r2(mx - mn) : null);
      lo.push(swc > 0 ? r0(sl / swc) : null); mi.push(swc > 0 ? r0(sm / swc) : null); hi.push(swc > 0 ? r0(sh / swc) : null);
    }
    if (!clear.some((v) => v != null)) throw new Error('vuoto');
    // seeing: media di GFS ed ECMWF, dove ci sono
    let see = null, jet = null;
    if (C.status === 'fulfilled') {
      const ch = C.value.hourly, off = Math.round((ch.time[0] - t0) / 3600), elev = +s.elev || 0; see = []; jet = [];
      for (let i = 0; i < n; i++) {
        const j = i - off; if (j < 0 || j >= ch.time.length) { see.push(null); jet.push(null); continue; }
        const a = seeingOf(ch, j, '_gfs_seamless', elev), b = seeingOf(ch, j, '_ecmwf_ifs025', elev), L = [a, b].filter(Boolean);
        see.push(L.length ? r2(SEE_K * L.reduce((q, x) => q + x.e, 0) / L.length) : null); jet.push(L.length ? r0(Math.max(...L.map((x) => x.jet))) : null);
      }
    }
    WX.d = {
      key, at: Date.now(), t0, n, clear, lo, mi, hi, spread, nm, models, prob: prob && prob.map(r2), see, jet,
      aod: (at(Q, 'aerosol_optical_depth') || []).map(r2), dust: (at(Q, 'dust') || []).map(r0),
      t: (at(B, 'temperature_2m') || []).map((x) => (x == null ? null : Math.round(x * 10) / 10)), td: (at(B, 'dew_point_2m') || []).map((x) => (x == null ? null : Math.round(x * 10) / 10)),
      rh: (at(B, 'relative_humidity_2m') || []).map(r0), wind: (at(B, 'wind_speed_10m') || []).map(r0), gust: (at(B, 'wind_gusts_10m') || []).map(r0), pp: (at(B, 'precipitation_probability') || []).map(r0),
      parts: { models: Object.keys(models).length, ens: E.status === 'fulfilled', see: C.status === 'fulfilled', aq: Q.status === 'fulfilled', ground: B.status === 'fulfilled' },
    };
    WX.err = false; LS.set(WX_LS, WX.d); return true;
  } catch (e) { WX.err = true; return false; } finally { WX.busy = false; }
}
/* ---------- lettura ---------- */
const wxOk = () => WX.d && WX.d.key === wxKey(activeLoc().site);
function wxAt(ms) {
  if (!wxOk()) return null; const d = WX.d, x = (ms / 1000 - d.t0) / 3600;
  if (!(x >= 0) || x > d.n - 1) return null;
  const i = Math.floor(x), u = x - i, a = d.clear[i], b = i + 1 < d.n ? d.clear[i + 1] : null;
  return a == null ? b : b == null ? a : a * (1 - u) + b * u;
}
/* tutti i dati dell'ora più vicina */
function wxHour(ms) {
  if (!wxOk()) return null; const d = WX.d, i = Math.round((ms / 1000 - d.t0) / 3600); if (i < 0 || i >= d.n || d.clear[i] == null) return null;
  const g = (k) => (d[k] && d[k][i] != null ? d[k][i] : null);
  return { i, clear: g('clear'), lo: g('lo'), mi: g('mi'), hi: g('hi'), spread: g('spread'), nm: g('nm'), prob: g('prob'), see: g('see'), jet: g('jet'), aod: g('aod'), dust: g('dust'), t: g('t'), td: g('td'), rh: g('rh'), wind: g('wind'), gust: g('gust'), pp: g('pp') };
}
const wxCloudAt = (ms) => { const x = wxHour(ms); return x ? Math.max(x.lo || 0, x.mi || 0, x.hi || 0) : null; };
/* livelli: seeing (″, scala meteoblue), trasparenza (spessore ottico degli aerosol), condensa, vento */
const SEE_CL = [[0.9, 'Ottimo'], [1.2, 'Buono'], [1.6, 'Medio'], [2.1, 'Scarso'], [99, 'Pessimo']];
const TRA_CL = [[0.08, 'Ottima'], [0.15, 'Buona'], [0.25, 'Media'], [0.4, 'Scarsa'], [99, 'Pessima']];
const LVL_COL = ['var(--good)', 'var(--accent)', 'var(--warn)', '#E8834A', 'var(--bad)'];
const lvlOf = (v, cl) => { if (v == null) return null; for (let i = 0; i < cl.length; i++) if (v <= cl[i][0]) return { i, t: cl[i][1] }; return null; };
const seeLvl = (e) => lvlOf(e, SEE_CL), traLvl = (a) => lvlOf(a, TRA_CL);
const dewLvl = (t, td) => (t == null || td == null ? null : t - td <= 1.5 ? { i: 4, t: 'alto' } : t - td <= 3 ? { i: 2, t: 'medio' } : { i: 0, t: 'basso' });
const windLvl = (g) => (g == null ? null : g >= 40 ? { i: 4, t: 'forte' } : g >= 25 ? { i: 2, t: 'moderato' } : { i: 0, t: 'debole' });
const agreeLvl = (s) => (s == null ? null : s <= 0.25 ? { i: 0, t: 'alto' } : s <= 0.5 ? { i: 2, t: 'medio' } : { i: 4, t: 'basso' });

/* il meteo entra nel calcolo: calendari da rifare e tutto ciò che mostra le ore */
function applyWeather() {
  if (!state.res) return;
  const C = state.res.C; C.wx = wxOk() ? wxAt : null;
  if (C.ahead) C.ahead.cache.clear();
}
function weatherChanged() { applyWeather(); renderFacts(); drawStrip(); renderNightBar(); renderTonight(); renderList(); renderTopList(); if (UI.view === 'sky') renderSky(); if (state.sel && !$('#drawer').hidden) { const sc = $('#drawer').scrollTop; renderDetail(); $('#drawer').scrollTop = sc; } }
async function refreshWeather(force) { if (await loadWeather(force)) weatherChanged(); else if (force && UI.view === 'sky') renderSky(); planNotifications(); }
/* una notte in breve (buio astronomico): quanto è sereno, la finestra serena più lunga, probabilità, accordo, seeing,
   trasparenza, condensa, vento. wxSpan lavora su istanti a passo regolare (ms, passo in minuti). */
function wxNight(n) {
  if (n.first < 0) return null; const ts = []; for (let i = n.first; i <= n.last; i++) if (n.dark[i]) ts.push(n.t[i]);
  return wxSpan(ts, STEP);
}
function wxSpan(ts, stepMin) {
  if (!WX.d || !wxOk() || !ts.length) return null;
  let sum = 0, run = 0, best = [0, -1, -1], cur = -1, known = 0, lastH = -1, prevT = -Infinity;
  const acc = { prob: [], spread: [], see: [], jet: [], aod: [], dust: [], dew: [], gust: [], rh: [], pp: [] };
  for (let k = 0; k < ts.length; k++) {
    const t = ts[k], f = wxAt(t); if (t - prevT > stepMin * 90000) { run = 0; cur = -1; } prevT = t;
    if (f == null) { run = 0; cur = -1; continue; } known++; sum += f;
    if (f >= 0.7) { if (cur < 0) cur = k; run++; if (run > best[0]) best = [run, cur, k]; } else { run = 0; cur = -1; }
    const x = wxHour(t); if (!x || x.i === lastH) continue; lastH = x.i;
    for (const q of ['prob', 'spread', 'see', 'jet', 'aod', 'dust', 'gust', 'rh', 'pp']) if (x[q] != null) acc[q].push(x[q]);
    if (x.t != null && x.td != null) acc.dew.push(x.t - x.td);
  }
  if (!known || known < ts.length * 0.5) return null;
  const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null), med = (a) => (a.length ? a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)] : null);
  const max = (a) => (a.length ? Math.max(...a) : null), min = (a) => (a.length ? Math.min(...a) : null);
  return {
    clear: sum / known, win: best[1] >= 0 ? [ts[best[1]], ts[best[2]] + stepMin * 60000] : null, winH: best[0] * stepMin / 60,
    prob: mean(acc.prob), spread: mean(acc.spread), see: med(acc.see), jet: max(acc.jet), aod: mean(acc.aod), dust: max(acc.dust), dew: min(acc.dew), gust: max(acc.gust), rh: max(acc.rh), pp: max(acc.pp),
  };
}
/* altri luoghi salvati: solo le nuvole (miglior modello), per dire dove è sereno stanotte */
async function loadWeatherLite(site) {
  const key = wxKey(site), c = WX.other.get(key); if (c && Date.now() - c.at < WX_TTL) return c;
  try {
    const j = await wxGet(`https://api.open-meteo.com/v1/forecast?${wxQ(site, 3)}&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high`), h = j.hourly;
    const d = { key, at: Date.now(), t0: h.time[0], clear: h.time.map((_, i) => clearFrac(h.cloud_cover_low[i], h.cloud_cover_mid[i], h.cloud_cover_high[i])) };
    WX.other.set(key, d); return d;
  } catch { return null; }
}
