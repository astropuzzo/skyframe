'use strict';
/* Utilità generiche e astronomia a bassa precisione (sufficiente per pianificare: ~1′ per Sole/stelle, ~0,3° per la Luna). */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const norm360 = (x) => { x %= 360; return x < 0 ? x + 360 : x; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
};
const it = (x, d = 1) => (LANG === 'it' ? Number(x).toFixed(d).replace('.', ',') : Number(x).toFixed(d)); // numero con i decimali della lingua

/* ============================ ora del luogo ============================
   Notti, orari e date si contano nell'ora civile del luogo. Il fuso viene dal luogo (site.tz, nome IANA dato da
   Open-Meteo); se manca si usa quello del dispositivo quando la longitudine è compatibile (entro 3 ore), altrimenti il
   fuso teorico della longitudine (15° per ora). null = fuso del dispositivo. */
const DEV_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } })();
const TZ_OFF = new Map();
/* minuti a est di UTC nell'istante ms */
function tzOff(ms, tz) {
  if (!tz) return -new Date(ms).getTimezoneOffset();
  let c = TZ_OFF.get(tz); if (!c) TZ_OFF.set(tz, (c = { f: null, h: new Map() }));
  const h = Math.floor(ms / 3600e3); let v = c.h.get(h);
  if (v === undefined) {
    try {
      if (!c.f) c.f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
      const p = {}; for (const x of c.f.formatToParts(new Date(h * 3600e3))) p[x.type] = +x.value;
      v = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - h * 3600e3) / 60000);
    } catch (e) { v = -new Date(ms).getTimezoneOffset(); }
    c.h.set(h, v);
  }
  return v;
}
function siteTz(site) {
  if (!site) return null;
  if (site.tz) return site.tz === DEV_TZ ? null : site.tz;
  const lon = +site.lon; if (!isFinite(lon)) return null;
  const h = clamp(Math.round(lon / 15), -12, 14);
  return Math.abs(h - tzOff(Date.now(), null) / 60) <= 3 ? null : h === 0 ? 'Etc/GMT' : `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}`;
}
/* fuso in cui si mostrano orari e date: quello del luogo attivo */
const TZ = { id: null };
const setDisplayTz = (site) => { TZ.id = siteTz(site); };
/* data con i campi UTC uguali all'ora del luogo; istante dell'ora locale y-m-d h:mi (mese da 0, giorni oltre il mese ammessi) */
const wall = (ms, tz = TZ.id) => new Date(ms + tzOff(ms, tz) * 60000);
function wallMs(y, mo, d, h = 12, mi = 0, tz = TZ.id) { const g = Date.UTC(y, mo, d, h, mi); return g - tzOff(g - tzOff(g, tz) * 60000, tz) * 60000; }
const pad2 = (n) => String(n).padStart(2, '0');
const dsOf = (ms, tz = TZ.id) => { const w = wall(ms, tz); return w.getUTCFullYear() + '-' + pad2(w.getUTCMonth() + 1) + '-' + pad2(w.getUTCDate()); };
const hourOf = (ms) => wall(ms).getUTCHours();
const hourFloor = (ms) => { const w = wall(ms); return ms - (w.getUTCMinutes() * 60 + w.getUTCSeconds()) * 1000 - w.getUTCMilliseconds(); };
const tzOpt = () => (TZ.id ? { timeZone: TZ.id } : {});
const fmtT = (ms) => new Date(ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', ...tzOpt() });
const fmtDay = (ms) => new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', ...tzOpt() });
const fmtNight = (ms, o) => new Date(ms).toLocaleDateString(LOCALE, { ...o, ...tzOpt() });
/* sigla del fuso del luogo, solo se è diverso da quello del dispositivo */
const tzLabel = () => {
  if (!TZ.id) return ''; if (TZ.lab && TZ.lab[0] === TZ.id) return TZ.lab[1];
  let v = ''; try { const p = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ.id, timeZoneName: 'short' }).formatToParts(new Date()); v = (p.find((x) => x.type === 'timeZoneName') || {}).value || ''; } catch (e) { /* niente */ }
  TZ.lab = [TZ.id, v]; return v;
};
function fmtDur(h) { if (!isFinite(h)) return '—'; const m = Math.round(h * 60); if (m < 60) return m + ' min'; const hh = Math.floor(m / 60), mm = m % 60; return hh + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') : ''); }
function fmtH(h) { if (h == null || !isFinite(h)) return '—'; if (h < 1) return Math.max(5, Math.round(h * 12) * 5) + ' min'; if (h < 10) return it(h) + ' h'; return Math.round(h) + ' h'; }
const fmtDeg = (am) => (am >= 60 ? it(am / 60, 2) + '°' : Math.round(am) + '′');
const AZN = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'].map((x) => tx(x));
const azName = (a) => AZN[Math.round(norm360(a) / 45) % 8];
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(R) { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
function raStr(ra) { const h = ra / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = ((h - hh) * 60 - mm) * 60; return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(0).padStart(2, '0')}s`; }
function decStr(d) { const s = d < 0 ? '−' : '+'; d = Math.abs(d); const dd = Math.floor(d), mm = Math.floor((d - dd) * 60), ss = Math.round(((d - dd) * 60 - mm) * 60); return `${s}${String(dd).padStart(2, '0')}° ${String(mm).padStart(2, '0')}′ ${String(ss).padStart(2, '0')}″`; }

const jd = (ms) => ms / 86400000 + 2440587.5;
function gmst(J) { const d = J - 2451545, T = d / 36525; return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T); }
const lstDeg = (ms, lon) => norm360(gmst(jd(ms)) + lon);
/* altezza e azimut (da nord verso est), gradi */
function altaz(ra, dec, lst, sL, cL) {
  const H = (lst - ra) * D2R, d = dec * D2R, sd = Math.sin(d), cd = Math.cos(d), cH = Math.cos(H);
  const alt = Math.asin(clamp(sd * sL + cd * cL * cH, -1, 1));
  let az = Math.atan2(-cd * Math.sin(H), sd * cL - cd * sL * cH) * R2D; if (az < 0) az += 360;
  return [alt * R2D, az];
}
function precess(ra, dec, J) {
  const T = (J - 2451545) / 36525, as = 1 / 3600;
  const z0 = (2306.2181 * T + 0.30188 * T * T) * as * D2R, z = (2306.2181 * T + 1.09468 * T * T) * as * D2R, th = (2004.3109 * T - 0.42665 * T * T) * as * D2R;
  const r = ra * D2R, d = dec * D2R;
  const A = Math.cos(d) * Math.sin(r + z0), B = Math.cos(th) * Math.cos(d) * Math.cos(r + z0) - Math.sin(th) * Math.sin(d), C = Math.sin(th) * Math.cos(d) * Math.cos(r + z0) + Math.cos(th) * Math.sin(d);
  return { ra: norm360((Math.atan2(A, B) + z) * R2D), dec: Math.asin(clamp(C, -1, 1)) * R2D };
}
function sunPos(J) {
  const n = J - 2451545, L = norm360(280.460 + 0.9856474 * n), g = (357.528 + 0.9856003 * n) * D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R, e = (23.439 - 0.0000004 * n) * D2R;
  return { ra: norm360(Math.atan2(Math.cos(e) * Math.sin(lam), Math.cos(lam)) * R2D), dec: Math.asin(Math.sin(e) * Math.sin(lam)) * R2D, lon: lam * R2D };
}
function moonPos(J) {
  const d = J - 2451545, s = (x) => Math.sin(x * D2R);
  const Lp = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, Ms = 357.529 + 0.98560028 * d, D = 297.850 + 12.190749 * d, F = 93.272 + 13.229350 * d;
  const lon = Lp + 6.289 * s(M) + 1.274 * s(2 * D - M) + 0.658 * s(2 * D) + 0.214 * s(2 * M) - 0.186 * s(Ms) - 0.114 * s(2 * F) - 0.059 * s(2 * M - 2 * D) - 0.057 * s(M - 2 * D + Ms);
  const lat = 5.128 * s(F) + 0.2806 * s(M + F) + 0.2777 * s(M - F) + 0.1732 * s(2 * D - F);
  const e = (23.439 - 0.0000004 * d) * D2R, l = lon * D2R, b = lat * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm360(ra * R2D), dec: dec * R2D, lon: norm360(lon), lat };
}
function moonIllum(J) { const s = sunPos(J), m = moonPos(J); const el = Math.acos(clamp(Math.cos(m.lat * D2R) * Math.cos((m.lon - s.lon) * D2R), -1, 1)); return { k: (1 - Math.cos(el)) / 2, waxing: norm360(m.lon - s.lon) < 180 }; }
const unit = (ra, dec) => { const r = ra * D2R, d = dec * D2R; return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]; };
const airmass = (h) => 1 / (Math.sin(Math.max(h, 1) * D2R) + 0.50572 * Math.pow(Math.max(h, 1) + 6.07995, -1.6364));

/* colore approssimato di una stella dall'indice B−V */
function bvColor(bv) {
  const t = clamp((bv + 0.3) / 2.3, 0, 1);
  const stops = [[155, 180, 255], [202, 216, 255], [255, 244, 234], [255, 210, 161], [255, 166, 81]];
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return stops[i].map((c, j) => Math.round(c + (stops[i + 1][j] - c) * f));
}
