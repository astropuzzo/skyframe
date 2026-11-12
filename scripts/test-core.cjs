// Prove di base (npm test): ora del luogo, Luna, filtri, calendario e piano di stagione, migrazione dei dati salvati,
// archivio dei profili sul computer.
process.env.TZ = 'Europe/Rome'; // il dispositivo delle prove è in Italia, come quello di chi ha scritto l'app
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const file = (p) => fs.readFileSync(path.join(root, 'src', p), 'utf8');
const ctx = { window: {}, console, Date, Math, Map, Set, Intl, JSON, Float32Array, Float64Array, Uint8Array, performance };
vm.createContext(ctx);
for (const name of ['filters', 'dso', 'sky', 'quality', 'real']) vm.runInContext(file(`data/${name}.js`), ctx);
// nel piano di stagione il lavoro già fatto e i progetti in corso vengono dall'app: qui nessuno
vm.runInContext("const LANG='it',LOCALE='it-IT',txName=(s)=>s,tx=(s,p)=>p?s.replace(/[{](\\w+)[}]/g,(_,k)=>p[k]??_):s,projProgress=()=>0,hasSessions=()=>false;" + file('js/astro.js') + '\n' + file('js/model.js') + '\n' + file('js/nights.js') + '\n' + file('js/season.js') + '\n' + file('js/hzscan.js') +
  '\n;this.M={siteTz,tzOff,wall,wallMs,dsOf,TZ,setDisplayTz,defaultNightStr,computeNight,moonCalendar,templateProfile,migrateProfile,migrateLoc,locsFromProfiles,moonFlux,unit,mosaicPanes,ninaCsv,' +
  'channelSpec,qeRel,airmass,profileConfigs,computePrep,computeObj,hoursOf,nightRec,shootCalendar,aheadNight,buildSeason,seasonIcs,nightSamples,moonPos,altaz,lstDeg,jd,CAT_BY_ID,MOON_RISE,MOON_PAR,STEP,CAL_N,CAL_STEP,aimVec,aimOf,scanToHorizon,skyRefs,skyRef,horizonLUT,sunPos,hzRot,hzProject,hzUnproject,hzFov};', ctx);
const M = ctx.M;

const SITES = {
  Roma: { lat: 41.9, lon: 12.5 },
  Sydney: { lat: -33.9, lon: 151.2, tz: 'Australia/Sydney' },
  Arizona: { lat: 32, lon: -110.9, tz: 'America/Phoenix' },
  Tokyo: { lat: 35.7, lon: 139.7, tz: 'Asia/Tokyo' },
  Namibia: { lat: -23.2, lon: 16.4, tz: 'Africa/Windhoek' },
};
const night = (site, ds) => { const p = M.templateProfile(); p.site = { ...site, sqm: 21 }; p.session.sunThr = -18; return M.computeNight(p, ds); };
const segments = (n) => { let k = 0; for (let i = 0; i < n.dark.length; i++) if (n.dark[i] && (i === 0 || !n.dark[i - 1])) k++; return k; };

test('fuso del luogo: dal nome IANA, altrimenti dalla longitudine se lontana dal dispositivo', () => {
  assert.equal(M.siteTz({ lat: 41.9, lon: 12.5 }), null);
  assert.equal(M.siteTz({ lat: 41.9, lon: 12.5, tz: 'Europe/Rome' }), null);
  assert.equal(M.siteTz({ lat: 51.5, lon: -0.1 }), null); // un'ora di differenza: si resta sul dispositivo
  assert.equal(M.siteTz({ lat: -33.9, lon: 151.2 }), 'Etc/GMT-10');
  assert.equal(M.siteTz({ lat: 32, lon: -110.9 }), 'Etc/GMT+7');
  assert.equal(M.siteTz(SITES.Sydney), 'Australia/Sydney');
});

test('mezzogiorno locale anche nei giorni del cambio d’ora', () => {
  for (const [tz, days] of [['Europe/Rome', ['2026-03-29', '2026-10-25']], ['Australia/Sydney', ['2026-04-05', '2026-10-04']], ['America/Phoenix', ['2026-03-08']], ['Etc/GMT-10', ['2026-10-04']], [null, ['2026-03-29', '2026-10-25']]]) {
    for (const ds of days) {
      const [y, m, d] = ds.split('-').map(Number);
      for (const h of [0, 12, 23]) {
        const t = M.wallMs(y, m - 1, d, h, 0, tz), w = M.wall(t, tz);
        assert.equal(w.getUTCHours(), h, `${tz} ${ds} ${h}:00`);
        assert.equal(M.dsOf(t, tz), ds, `${tz} ${ds}`);
      }
    }
  }
});

test('la notte dei luoghi lontani è una sola, dal tramonto all’alba', () => {
  for (const [name, site] of Object.entries(SITES)) {
    for (const s of [site, { lat: site.lat, lon: site.lon }]) { // con il fuso e con la stima dalla longitudine
      const n = night(s, '2026-10-10');
      assert.ok(!n.dark[0] && !n.dark[n.dark.length - 1], `${name}: la notte non deve iniziare o finire già al buio`);
      assert.equal(segments(n), 1, `${name}: un solo tratto di buio`);
      assert.ok(n.darkH > 5 && n.darkH < 13, `${name}: ${n.darkH} h di buio`);
      assert.equal(M.wall(n.t0, M.siteTz(s)).getUTCHours(), 12, `${name}: si parte da mezzogiorno`);
    }
  }
});

test('Roma, senza fuso salvato: come prima (mezzogiorno del dispositivo)', () => {
  for (const ds of ['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25']) {
    const [y, m, d] = ds.split('-').map(Number), n = night(SITES.Roma, ds);
    assert.equal(n.t0, new Date(y, m - 1, d, 12).getTime(), ds);
    assert.equal(segments(n), 1, ds);
  }
});

test('calendario della Luna: date consecutive anche con il cambio d’ora del luogo', () => {
  const p = M.templateProfile(); p.site = { ...SITES.Sydney, sqm: 21 }; p.session.sunThr = -18;
  const ds = Array.from(M.moonCalendar(p, '2026-10-01', 8), (x) => x.ds); // array di questo contesto
  assert.deepEqual(ds, ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
});

test('«stanotte» nell’ora del luogo', () => {
  const real = Date.now;
  try {
    Date.now = () => Date.UTC(2026, 9, 10, 1, 0); // 03:00 a Roma, 12:00 a Sydney
    M.setDisplayTz(null); assert.equal(M.defaultNightStr(), '2026-10-09');
    M.setDisplayTz(SITES.Sydney); assert.equal(M.defaultNightStr(), '2026-10-10');
    Date.now = () => Date.UTC(2026, 9, 9, 23, 0); // 01:00 a Roma, 10:00 a Sydney
    assert.equal(M.defaultNightStr(), '2026-10-09');
  } finally { Date.now = real; M.setDisplayTz(null); }
});

test('Luna: Krisciunas & Schaefer 1991', () => {
  // Luna a 30° dallo zenit, target a 45° dallo zenit e a 45° dalla Luna, k = 0,172: conto a mano dalle formule dell'articolo
  const mag = (ill, sep, mAlt = 60, tAlt = 45, kV = 0.172) => {
    const night = { mAlt: [mAlt], mIll: [ill], mV: [M.unit(sep, 0)], kV };
    return -2.5 * Math.log10(M.moonFlux(night, 0, M.unit(0, 0), tAlt)[0]);
  };
  assert.ok(Math.abs(mag(1, 45) - 17.97) < 0.03, String(mag(1, 45)));
  assert.ok(mag(1, 10) < mag(1, 45) && mag(1, 45) < mag(1, 90), 'più luminoso vicino alla Luna');
  const q = mag(0.5, 45) - mag(1, 45); assert.ok(q > 2.4 && q < 2.8, `primo quarto ${q} mag sotto la piena`);
  assert.ok(mag(1, 45, 60, 20) < mag(1, 45, 60, 70), 'più aria verso il target, più luce diffusa');
  assert.equal(M.moonFlux({ mAlt: [-1], mIll: [1], mV: [M.unit(0, 0)], kV: 0.2 }, 0, M.unit(0, 0), 45)[0], 0);
});

test('Luna vista dal luogo: sorge col lembo sull’orizzonte, uguale nella striscia e nella notte', () => {
  const p = M.templateProfile(); p.site = { ...SITES.Roma, sqm: 21 }; p.session.sunThr = -18;
  let checked = 0;
  for (const ds of ['2026-10-02', '2026-10-20', '2026-11-28', '2027-01-15']) {
    const n = M.computeNight(p, ds);
    for (const ev of [n.mRise, n.mSet]) {
      if (ev == null) continue;
      const i = Math.floor((ev - n.t0) / (M.STEP * 60000)), u = (ev - n.t[i]) / (M.STEP * 60000);
      assert.ok(Math.abs(n.mAlt[i] * (1 - u) + n.mAlt[i + 1] * u - M.MOON_RISE) < 0.01, ds); checked++;
    }
    // la striscia delle notti (passi di 10 minuti) e la notte scelta (5 minuti) vedono la stessa Luna
    const s = M.nightSamples(p, n.t0).samples;
    assert.ok(s.length > 30, ds);
    for (const x of s) { const i = Math.round((x.ms - n.t0) / (M.STEP * 60000)); assert.equal(x.mu, n.mAlt[i] > 0, ds + ' ' + new Date(x.ms).toISOString()); }
    // parallasse: all'orizzonte la Luna sta 0,95° più in basso del conto dal centro della Terra, allo zenit uguale
    const lat = SITES.Roma.lat * Math.PI / 180, mo = M.moonPos(M.jd(n.t[100])), geo = M.altaz(mo.ra, mo.dec, n.lst[100], Math.sin(lat), Math.cos(lat))[0];
    assert.ok(Math.abs(geo - n.mAlt[100] - M.MOON_PAR * Math.cos(geo * Math.PI / 180)) < 1e-4, ds);
  }
  assert.ok(checked >= 4);
  // contro un almanacco (Roma, novembre 2026, ora locale): entro tre minuti; prima della 0.31 lo scarto era di 5–9 minuti
  const rome = { ...SITES.Roma, lat: 41.9028, lon: 12.4964, sqm: 21 }, at = (s) => Date.parse(s + ':00+01:00');
  for (const [ds, rise, set] of [['2026-11-12', '2026-11-13T10:59', '2026-11-12T18:43'], ['2026-11-22', '2026-11-22T14:56', '2026-11-23T05:44'], ['2026-11-25', '2026-11-25T17:08', '2026-11-26T09:32']]) {
    const n = M.computeNight({ ...p, site: rome }, ds);
    assert.ok(Math.abs(n.mRise - at(rise)) < 3 * 60000, `${ds}: sorge ${new Date(n.mRise).toISOString()}`);
    assert.ok(Math.abs(n.mSet - at(set)) < 3 * 60000, `${ds}: tramonta ${new Date(n.mSet).toISOString()}`);
  }
});

test('buio e finestra utile al minuto, non al passo di cinque', () => {
  const p = M.templateProfile(); p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = [[0, 0], [90, 30], [180, 10], [270, 0]]; p.session.sunThr = -18; p.session.minAlt = 25;
  const C = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0), n = C.night, step = M.STEP * 60000;
  // il Sole è alla soglia proprio in quegli istanti, dentro il passo che li contiene
  const sunAt = (ms) => { const i = Math.floor((ms - n.t0) / step), u = (ms - n.t[i]) / step; return n.sun[i] * (1 - u) + n.sun[i + 1] * u; };
  assert.ok(Math.abs(sunAt(n.dusk) + 18) < 1e-6 && Math.abs(sunAt(n.dawn) + 18) < 1e-6);
  assert.ok(n.dusk > n.t[n.first] - step && n.dusk <= n.t[n.first] && n.dawn >= n.t[n.last] && n.dawn < n.t[n.last] + step);
  let inside = 0;
  for (const id of ['NGC 7000', 'M 31', 'M 42', 'IC 1396', 'M 45', 'NGC 281']) {
    const r = M.computeObj(C, M.CAT_BY_ID.get(id)); if (!r || r.first < 0) continue;
    assert.ok(r.tIn > n.t[r.first] - step - 1 && r.tIn <= n.t[r.first] + 1 && r.tOut >= n.t[r.last] - 1 && r.tOut < n.t[r.last] + step + 1, id);
    assert.ok(r.tIn >= n.dusk - 1 && r.tOut <= n.dawn + 1 && r.tOut > r.tIn, id);
    if (r.tIn > n.dusk + 1 || r.tOut < n.dawn - 1) inside++;
  }
  assert.ok(inside >= 2, 'almeno due target con sorgere o tramonto dentro la notte');
  // contro un almanacco (Roma, novembre 2026, ora locale): fine e inizio del crepuscolo astronomico, tramonto e alba, entro 90 s
  const rome = M.templateProfile(); rome.site = { lat: 41.9028, lon: 12.4964, tz: 'Europe/Rome', sqm: 19 }; rome.session.sunThr = -18;
  const at = (s) => Date.parse(s + ':30+01:00'); // l'almanacco tronca al minuto
  for (const [ds, dusk, dawn, set, rise] of [['2026-11-11', '2026-11-11T18:28', '2026-11-12T05:19', '2026-11-11T16:53', '2026-11-12T06:55'], ['2026-11-20', '2026-11-20T18:22', '2026-11-21T05:29', '2026-11-20T16:45', '2026-11-21T07:06'], ['2026-11-29', '2026-11-29T18:19', '2026-11-30T05:37', '2026-11-29T16:40', '2026-11-30T07:16']]) {
    const x = M.computeNight(rome, ds);
    for (const [got, want, what] of [[x.dusk, dusk, 'fine crepuscolo'], [x.dawn, dawn, 'inizio crepuscolo'], [x.sunset, set, 'tramonto'], [x.sunrise, rise, 'alba']]) assert.ok(Math.abs(got - at(want)) < 90e3, `${ds} ${what}: ${new Date(got).toISOString()}`);
  }
  // con l'orario della sessione decide lui
  p.session.from = '21:00'; p.session.to = '03:00'; const s = M.computeNight(p, '2026-10-10');
  assert.equal(M.wall(s.dusk, null).getUTCHours() * 60 + M.wall(s.dusk, null).getUTCMinutes(), 21 * 60);
  assert.equal(M.wall(s.dawn, null).getUTCHours() * 60 + M.wall(s.dawn, null).getUTCMinutes(), 3 * 60);
});

test('sessione dalle 20:00 alle 04:00: otto ore giuste', () => {
  const p = M.templateProfile(); p.site = { ...SITES.Roma, sqm: 21 }; p.session.sunThr = -18; p.session.from = '20:00'; p.session.to = '04:00';
  assert.equal(M.computeNight(p, '2026-12-15').darkH, 8);
  let h = 0; const a = M.aheadNight(M.computePrep(M.profileConfigs(p), p, '2026-12-15', 0), 3); for (let i = 0; i < M.CAL_N; i++) h += a.dark[i] * M.CAL_STEP / 60;
  assert.ok(Math.abs(h - 8) < 1e-9, String(h));
});

test('filtri: l’integrale segue i bordi veri della banda', () => {
  const I = (lo, hi) => M.channelSpec({ bands: [[lo, hi, 1]] }, 'mono', ['Ha'], {}).I;
  const near = (a, b, e, m) => assert.ok(Math.abs(a / b - 1) < e, `${m}: ${a} invece di ${b}`);
  near(I(654.55, 658.05), 35 * M.qeRel(656.3), 0.01, '3,5 nm');
  near(I(654.55, 658.05) / I(654.05, 658.55), 3.5 / 4.5, 0.01, '3,5 nm contro 4,5 nm');
  near(I(400, 700) / I(400, 550), 2, 0.25, 'banda larga'); // 300 nm contro 150, col sensore meno sensibile nel rosso
  near(M.channelSpec({ bands: [[500, 501, 0.9]] }, 'mono', ['OIII'], {}).I, 9 * M.qeRel(500.5), 1e-9, 'un nanometro');
});

test('target che stanotte non si riprende: tempo al passaggio in meridiano', () => {
  const p = M.templateProfile(); p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = []; p.session.minAlt = 20;
  const C = M.computePrep(M.profileConfigs(p), p, '2026-07-10', 0), r = M.computeObj(C, M.CAT_BY_ID.get('M 42'));
  assert.equal(r.usableH, 0);
  assert.ok(Math.abs(r.T.X - M.airmass(90 - Math.abs(45 - r.pr.dec))) < 1e-6 && r.T.X < 1.7, `massa d’aria ${r.T.X}`); // a 20° sarebbe 2,9
  assert.ok(isFinite(M.hoursOf(r.e.best)));
  // passaggio in meridiano: l'azimut attraversa il sud e l'altezza è la massima
  const w = M.computeObj(M.computePrep(M.profileConfigs(p), p, '2026-12-15', 0), M.CAT_BY_ID.get('M 42')), n = M.computeNight(p, '2026-12-15');
  const i = Math.floor((w.transit - n.t0) / (M.STEP * 60000));
  assert.ok(w.az[i] <= 180 && w.az[i + 1] >= 180 && Math.abs(w.alt[i] - (90 - Math.abs(45 - w.pr.dec))) < 0.05, `meridiano a ${new Date(w.transit).toISOString()}`);
  // emisfero sud: Orione passa a nord, e la Polare non si calcola nemmeno
  const s = M.templateProfile(); s.site = { ...SITES.Namibia, sqm: 21.5 }; s.horizon = [];
  const Cs = M.computePrep(M.profileConfigs(s), s, '2026-07-10', 0), rs = M.computeObj(Cs, M.CAT_BY_ID.get('M 42'));
  assert.ok(rs && rs.T.X < 1.2);
  assert.equal(M.computeObj(Cs, { ...M.CAT_BY_ID.get('M 42'), dec: 89 }), null);
});

test('calendario: le ore utili non superano mai quelle sopra l’orizzonte', () => {
  const p = M.templateProfile(); p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = [];
  const C = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0), r = M.computeObj(C, M.CAT_BY_ID.get('NGC 7000'));
  const dry = [0, 1, 5, 12].map((k) => ({ ...M.nightRec(C, r, r.e, k, false) }));
  // notti limpide (trasparenza al massimo) e mezze coperte: cambiano le ore di posa che servono, non le ore di cielo
  const C2 = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0), r2 = M.computeObj(C2, M.CAT_BY_ID.get('NGC 7000'));
  C2.wx = () => 0.5; C2.trans = () => 1.15;
  [0, 1, 5, 12].forEach((k, j) => {
    const x = M.nightRec(C2, r2, r2.e, k, false);
    assert.ok(x.h <= x.hGeo + 1e-9 && Math.abs(x.h - 0.5 * x.hGeo) < 0.01, `notte ${k}: ${x.h} h utili su ${x.hGeo}`);
    assert.ok(x.T < dry[j].T, `notte ${k}: con più trasparenza servono meno ore`);
    assert.ok(Math.abs(x.h / x.T - 0.5 * 1.15 * dry[j].h / dry[j].T) < 0.02 * x.h / x.T, `notte ${k}: lavoro della notte`);
    let sum = 0; for (let i = 0; i < M.CAL_N; i++) sum += x.sl[i] * M.CAL_STEP / 60;
    assert.ok(Math.abs(sum - x.h) < 0.1, `notte ${k}: passi ${sum} h, ore utili ${x.h}`);
  });
});

test('piano di stagione: due target nello stesso punto del cielo si dividono la notte', () => {
  const p = M.templateProfile(); p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = [];
  const C = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0), o = M.CAT_BY_ID.get('IC 1396'), r = M.computeObj(C, o), twin = { ...r, o: { ...o, id: 'gemello' } };
  for (const mode of ['smart', 'all', 'dark']) {
    const P = M.buildSeason(C, [r, twin], mode);
    let shared = 0;
    P.nights.forEach((n, k) => {
      const h = M.nightRec(C, r, r.e, k, mode === 'dark').h, tot = n.alloc.reduce((a, x) => a + x.a, 0);
      assert.ok(tot <= h + 1e-6, `${mode}, notte ${k}: ${tot} h assegnate su ${h} disponibili`);
      if (n.alloc.length > 1) shared++;
    });
    assert.ok(P.hours > 1, mode);
    // lo stesso piano come file di calendario: un evento per assegnazione, dentro la sua notte, righe con CRLF
    const ics = M.seasonIcs(P, C), ev = ics.split('BEGIN:VEVENT').slice(1), utc = (s) => Date.parse(s.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/, '$1-$2-$3T$4:$5:$6Z'));
    assert.equal(ev.length, P.nights.reduce((a, n) => a + n.alloc.length, 0), mode);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n') && !/[^\r]\n/.test(ics), mode);
    for (const e of ev.slice(0, 20)) { const a = utc(/DTSTART:(\S+)/.exec(e)[1]), b = utc(/DTEND:(\S+)/.exec(e)[1]); assert.ok(b > a && b - a <= 16 * 3600e3 && /SUMMARY:(IC 1396|gemello) · /.test(e), e); }
    // un target solo: finisce la stessa notte del suo calendario
    const one = M.buildSeason(C, [r], mode), cal = M.shootCalendar(C, r, r.e, false, mode);
    if (one.targets[0].done != null || cal.done) assert.equal(M.aheadNight(C, one.targets[0].done).t0, cal.done, mode);
  }
});

test('notte quasi coperta: niente ritagli di sereno nei calendari e nel piano di stagione', () => {
  const p = M.templateProfile(); p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = [];
  const C = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0), r = M.computeObj(C, M.CAT_BY_ID.get('IC 1396'));
  // le prime due notti al 10% di cielo sgombro (un'ora di «sereno» sparsa su undici), poi sereno
  const t2 = M.aheadNight(C, 2).t0; C.wx = (ms) => (ms < t2 ? 0.1 : 1);
  for (const k of [0, 1]) { const x = M.nightRec(C, r, r.e, k, false); assert.equal(x.h, 0, `notte ${k}`); assert.ok(x.hGeo > 3 && !isFinite(x.T)); }
  assert.ok(M.nightRec(C, r, r.e, 2, false).h > 3);
  const P = M.buildSeason(C, [r], 'all');
  assert.equal(P.nights[0].alloc.length + P.nights[1].alloc.length, 0);
  assert.equal(P.nights[2].alloc.length, 1);
  const cal = M.shootCalendar(C, r, r.e, false, 'all');
  assert.ok(cal.cloudy >= 2 && cal.nights.filter((x) => x.use).every((x) => x.k >= 2));
});

test('pannelli per N.I.N.A.: centro e PA come nell’anteprima', () => {
  const o = { ra: 10.68, dec: 41.27 }, g = { W: 150, H: 100 }, near = (a, b, e, m) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} invece di ${b}`);
  const dRa = (p) => (((p.ra - o.ra + 540) % 360) - 180) * Math.cos(o.dec * Math.PI / 180) * 60; // primi verso est
  const angle = (a) => Math.min(a, 360 - a);
  // un'inquadratura, lato lungo est-ovest: il target al centro, il nord in alto
  let [p] = M.mosaicPanes(o, g, 1, 1, 90, [0, 0]);
  near(p.ra, o.ra, 1e-9, 'RA'); near(p.dec, o.dec, 1e-9, 'Dec'); near(angle(p.pa), 0, 1e-6, 'PA');
  // centro spostato di 20' a est e 10' a nord
  [p] = M.mosaicPanes(o, g, 1, 1, 90, [20, 10]);
  near(dRa(p), 20, 0.3, 'est'); near((p.dec - o.dec) * 60, 10, 0.1, 'nord'); // proiezione gnomonica: a 20' di distanza la Dec cala di 0,05'
  // due pannelli affiancati sul lato lungo: colonna 1 a est, simmetrici, a 0,9 lati di distanza
  let P = M.mosaicPanes(o, g, 2, 1, 90, [0, 0]);
  assert.equal(P.map((x) => `${x.row}.${x.col}`).join(' '), '1.1 1.2');
  near(dRa(P[0]), 67.5, 0.5, 'est'); near(dRa(P[1]), -67.5, 0.5, 'ovest'); near(P[0].dec, P[1].dec, 1e-9, 'stessa Dec');
  near(angle(P[0].pa), angle(P[1].pa), 1e-9, 'PA simmetrici');
  // lato lungo nord-sud: pannelli uno sopra l'altro, PA dell'alto dell'immagine a 270°
  P = M.mosaicPanes(o, g, 2, 1, 0, [0, 0]);
  near(dRa(P[0]), 0, 0.05, 'stessa RA'); near(Math.abs(P[0].dec - P[1].dec) * 60, 135, 0.05, 'distanza'); near(P[0].pa, 270, 1, 'PA');
  // due righe: la prima a nord
  P = M.mosaicPanes(o, g, 1, 2, 90, [0, 0]);
  assert.ok(P[0].dec > o.dec && P[1].dec < o.dec && P[0].row === 1);
});

test('orizzonte col telefono: dove guarda la fotocamera', () => {
  const aim = (a, b, g) => M.aimOf(M.aimVec(a, b, g)), near = (x, y, tol = 1e-6) => assert.ok(Math.abs(((x - y + 540) % 360) - 180) < tol, `${x} ≠ ${y}`);
  // telefono in piedi (beta 90) col retro verso nord, poi girato: alpha cresce in senso antiorario
  let p = aim(0, 90, 0); near(p.az, 0); near(p.alt, 0);
  p = aim(270, 90, 0); near(p.az, 90); near(p.alt, 0);
  p = aim(90, 90, 0); near(p.az, 270);
  // inclinato all'indietro la fotocamera sale: beta 120 = 30° sopra l'orizzonte; in avanti scende
  p = aim(180, 120, 0); near(p.az, 180); near(p.alt, 30);
  p = aim(180, 70, 0); near(p.alt, -20);
  // appoggiato sul tavolo con lo schermo in su guarda in basso; sul fianco destro (gamma 90) guarda a ovest
  near(aim(37, 0, 0).alt, -90);
  p = aim(0, 0, 90); near(p.az, 270); near(p.alt, 0);
  // in orizzontale (ruotato attorno all'asse della fotocamera) la direzione non cambia: alpha 0, beta 0, gamma −90 guarda a est,
  // e lo stesso telefono inclinato di 25° verso l'alto resta a est
  p = aim(0, 0, -90); near(p.az, 90); near(p.alt, 0);
  p = aim(0, 0, -115); near(p.az, 90); near(p.alt, 25);
});

test('orizzonte col telefono: dal cielo allo schermo e ritorno', () => {
  const near = (x, y, tol = 0.01) => assert.ok(Math.abs(x - y) < tol, `${x} ≠ ${y}`), t10 = Math.tan(10 * Math.PI / 180) * 1000;
  // la direzione della fotocamera è −z della rotazione, comunque sia tenuto il telefono
  for (const [a, b, g] of [[10, 80, 5], [200, 120, -30], [330, 45, 60]]) { const R = M.hzRot(a, b, g), v = M.aimVec(a, b, g); for (let i = 0; i < 3; i++) near(v[i], -R[i][2], 1e-12); }
  // in piedi verso nord, schermo dritto: il mirino al centro, l'est a destra, il cielo in alto, quello che sta dietro non si disegna
  let V = { R: M.hzRot(0, 90, 0), off: 0, ang: 0, f: 1000, cx: 500, cy: 800 };
  let p = M.hzProject(V, 0, 0); near(p[0], 500); near(p[1], 800);
  p = M.hzProject(V, 10, 0); near(p[0], 500 + t10); near(p[1], 800);
  p = M.hzProject(V, 0, 10); near(p[0], 500); near(p[1], 800 - t10);
  assert.equal(M.hzProject(V, 180, 0), null); assert.equal(M.hzProject(V, 90, 0), null);
  // il nord corretto: se i sensori leggono 20° in meno del vero, il punto a 30° veri sta 10° a destra del mirino
  p = M.hzProject({ ...V, off: 20 }, 30, 0); near(p[0], 500 + t10); near(p[1], 800);
  // Girato in senso antiorario (la cima a sinistra), sempre verso nord. Con lo schermo bloccato in verticale l'est finisce
  // verso il basso dello schermo; se lo schermo ha ruotato con lui (angolo 90) torna a destra, e il cielo in alto.
  V = { R: M.hzRot(90, 0, -90), off: 0, ang: 0, f: 1000, cx: 500, cy: 800 };
  p = M.hzProject(V, 0, 0); near(p[0], 500); near(p[1], 800);
  p = M.hzProject(V, 10, 0); near(p[0], 500); near(p[1], 800 + t10);
  p = M.hzProject({ ...V, ang: 90 }, 10, 0); near(p[0], 500 + t10); near(p[1], 800);
  p = M.hzProject({ ...V, ang: 90 }, 0, 10); near(p[0], 500); near(p[1], 800 - t10);
  // girato in senso orario (la cima a destra, angolo 270)
  V = { R: M.hzRot(270, 0, 90), off: 0, ang: 270, f: 1000, cx: 500, cy: 800 };
  p = M.hzProject(V, 10, 0); near(p[0], 500 + t10); near(p[1], 800);
  p = M.hzProject(V, 0, 10); near(p[0], 500); near(p[1], 800 - t10);
  // il punto toccato torna dov'era, per orientamenti, rotazioni dello schermo e scarti qualunque; il centro è il puntamento
  for (const [a, b, g, ang, off] of [[33, 95, 4, 0, 12], [250, 20, -70, 90, -8], [120, 100, 30, 270, 0], [5, 150, 10, 180, 3]]) {
    const W = { R: M.hzRot(a, b, g), off, ang, f: 900, cx: 400, cy: 700 };
    for (const [x, y] of [[400, 700], [120, 300], [700, 1200], [40, 60]]) { const s = M.hzUnproject(W, x, y), back = M.hzProject(W, s.az, s.alt); near(back[0], x, 1e-6); near(back[1], y, 1e-6); }
    const c = M.hzUnproject(W, 400, 700), aim = M.aimOf(M.aimVec(a, b, g)); near(c.alt, aim.alt, 1e-9); near(((c.az - aim.az - off + 540) % 360) - 180, 0, 1e-9);
  }
  // campo inquadrato dai dati della fotocamera: focale 4,3 mm su un sensore da 6,4 mm di lato lungo
  let f = M.hzFov({ focal: 4.3, w: 6.4, h: 4.8 }); assert.equal(f.known, true); near(f.deg, 2 * Math.atan(3.2 / 4.3) * 180 / Math.PI, 1e-9);
  f = M.hzFov({ focal: 4.3, w: 4.8, h: 6.4, use: 0.98 }); near(f.deg, 2 * Math.atan(3.2 * 0.98 / 4.3) * 180 / Math.PI, 1e-9);
  // dati assenti o non credibili: il campo tipico, segnato come non noto
  for (const bad of [null, {}, { focal: 0.5, w: 6, h: 4 }, { focal: 30, w: 6, h: 4 }]) { f = M.hzFov(bad); assert.equal(f.known, false); assert.equal(f.deg, 66); }
});

test('orizzonte col telefono: Sole di riferimento', () => {
  // Roma al solstizio d'estate: a mezzogiorno vero il Sole è a sud, alto 90 − latitudine + declinazione
  const site = { lat: 41.9, lon: 12.5 }, t0 = Date.UTC(2026, 5, 21, 9, 0); let best = null;
  for (let m = 0; m <= 240; m++) { const r = M.skyRefs(site, t0 + m * 60000).sun; if (!best || r.alt > best.alt) best = { ...r, m }; }
  assert.ok(Math.abs(best.az - 180) < 0.6, `azimut al culmine ${best.az}`);
  assert.ok(Math.abs(best.alt - (90 - 41.9 + 23.44)) < 0.1, `altezza al culmine ${best.alt}`);
  // di mattina a est del sud, di sera a ovest; la sera di giugno alle 19 UTC è ancora sopra i 3° e fa da riferimento
  assert.ok(M.skyRefs(site, t0).sun.az < 180 && M.skyRefs(site, t0 + 8 * 3600e3).sun.az > 180);
  assert.equal(M.skyRef(site, t0).who, 'sun');
  // a mezzanotte niente Sole: la Luna solo se è alta e illuminata, altrimenti nessun riferimento
  const night = M.skyRef(site, Date.UTC(2026, 5, 21, 23, 0)); assert.ok(night === null || night.who === 'moon');
  const refs = M.skyRefs(site, Date.UTC(2026, 5, 21, 23, 0)); assert.ok(refs.sun.alt < 0);
  if (night) assert.ok(refs.moon.alt >= 5 && refs.moon.ill >= 0.15);
});

test('orizzonte col telefono: dai punti al profilo', () => {
  const arc = (a, b, alt) => { const o = []; for (let x = a; x <= b; x += 1.5) o.push({ az: x % 360, alt: typeof alt === 'function' ? alt(x) : alt }); return o; };
  const lut = (r) => M.horizonLUT(r.pts);
  // una traccia da est a sud a 20°: lì vale 20°, il resto rimane piatto; pochi punti perché la retta si semplifica
  let r = M.scanToHorizon(arc(90, 180, 20), []), L = lut(r);
  assert.ok(Math.abs(L[100] - 20) < 0.01 && Math.abs(L[179] - 20) < 0.01); assert.ok(L[60] < 0.01 && L[250] < 0.01 && L[185] < 0.01);
  assert.equal(r.measured[120], 1); assert.equal(r.measured[60], 0); assert.ok(r.pts.length <= 6, `${r.pts.length} punti`);
  // dove non si è misurato resta l'orizzonte di prima, coi suoi punti
  const old = [[0, 10], [45, 12], [270, 30], [315, 8]];
  r = M.scanToHorizon(arc(90, 180, 20), old); L = lut(r);
  assert.ok(Math.abs(L[270] - 30) < 0.01 && Math.abs(L[45] - 12) < 0.01 && Math.abs(L[0] - 10) < 0.01); assert.ok(Math.abs(L[120] - 20) < 0.01);
  assert.ok(Math.abs(L[225] - M.horizonLUT(old)[225]) < 0.2);
  // nello stesso grado vale il punto più alto (lo spigolo di un palazzo)
  r = M.scanToHorizon([{ az: 100.2, alt: 8 }, { az: 100.4, alt: 35 }, { az: 103, alt: 35 }], []);
  assert.ok(Math.abs(lut(r)[100] - 35) < 0.01);
  // punti sparsi: si uniscono fino a 60° di distanza, oltre no
  r = M.scanToHorizon([{ az: 0, alt: 10 }, { az: 50, alt: 20 }, { az: 200, alt: 40 }], []); L = lut(r);
  assert.ok(Math.abs(L[25] - 15) < 0.01); assert.ok(L[100] < 0.01 && L[300] < 0.01); assert.ok(Math.abs(L[200] - 40) < 0.01);
  assert.equal(r.measured[25], 1); assert.equal(r.measured[120], 0);
  // una traccia a cavallo del nord resta unita
  r = M.scanToHorizon(arc(340, 380, 25), []); L = lut(r);
  assert.ok(Math.abs(L[350] - 25) < 0.01 && Math.abs(L[0] - 25) < 0.01 && Math.abs(L[15] - 25) < 0.01); assert.ok(L[180] < 0.01);
  // un profilo curvo si conserva entro mezzo grado dopo la semplificazione; sotto zero conta zero
  const hill = (x) => 30 * Math.sin((x - 90) / 90 * Math.PI / 2 * 2) ** 2;
  r = M.scanToHorizon(arc(90, 270, hill), []); L = lut(r);
  for (let x = 92; x < 268; x++) assert.ok(Math.abs(L[x] - hill(x)) < 0.9, `a ${x}°: ${L[x]} invece di ${hill(x)}`);
  assert.ok(r.pts.length < 60, `${r.pts.length} punti`);
  assert.equal(lut(M.scanToHorizon([{ az: 10, alt: -4 }, { az: 20, alt: -1 }], []))[15], 0);
  // senza punti torna l'orizzonte di prima; il formato è quello dell'app: [azimut, altezza] in ordine
  assert.deepEqual(JSON.parse(JSON.stringify(M.scanToHorizon([], old).pts)), old);
  r = M.scanToHorizon(arc(90, 180, 20), old); for (let i = 1; i < r.pts.length; i++) assert.ok(r.pts[i][0] > r.pts[i - 1][0]);
});

test('CSV per N.I.N.A. nel formato di Telescopius', () => {
  // come legge N.I.N.A. (AstroUtil.DMSToDegrees): i numeri nell'ordine, segno dal «-»
  const dms = (s) => { const v = (s.match(/[0-9.]+/g) || []).map(Number); return (s.includes('-') ? -1 : 1) * ((v[0] || 0) + (v[1] || 0) / 60 + (v[2] || 0) / 3600); };
  const g = { W: 134.6, H: 89.96 }, near = (a, b, e, m) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} invece di ${b}`);
  const one = M.ninaCsv('NGC 7000', [{ ra: 314.8214, dec: 44.5289, pa: 359.996, row: 1, col: 1 }], g, 'Pannello').split('\n');
  assert.equal(one[0], 'Pane, RA, DEC, Position Angle (East), Pane width (arcmins), Pane height (arcmins), Overlap, Row, Column');
  assert.equal(one[1], 'NGC 7000, 20hr 59\' 17.1", 44º 31\' 44", 0.00, 134.60, 89.96, 0%, 1, 1');
  assert.equal(one[2], '');
  const f = one[1].split(',').map((x) => x.trim());
  near(dms(f[1]) * 15, 314.8214, 0.0005, 'RA'); near(dms(f[2]), 44.5289, 0.0003, 'Dec');
  // riporti (59,97 s → minuto dopo), Dec negativa vicino a zero, mosaico con il nome dei pannelli
  const P = [{ ra: (20 + 59 / 60 + 59.97 / 3600) * 15, dec: -0.30001, pa: 12.345, row: 1, col: 1 }, { ra: 359.99999, dec: -45.9999999, pa: 0, row: 1, col: 2 }];
  const m = M.ninaCsv('M 42, Orione', P, g, 'Pannello').split('\n');
  assert.equal(m[1], 'M 42  Orione Pannello 1, 21hr 00\' 00.0", -0º 18\' 00", 12.35, 134.60, 89.96, 10%, 1, 1');
  assert.equal(m[2], 'M 42  Orione Pannello 2, 0hr 00\' 00.0", -46º 00\' 00", 0.00, 134.60, 89.96, 10%, 1, 2');
  near(dms(m[1].split(',')[2]), -0.3, 1e-9, 'Dec negativa');
});

test('profili importati incompleti: l’app parte lo stesso', () => {
  const p = M.migrateProfile({ camera: { type: 'osc' }, optics: [{ ap: 80 }, null, { name: 7, fl: -3 }] });
  assert.equal(p.optics.length, 2);
  assert.ok(p.optics.every((o) => typeof o.name === 'string' && o.ap > 0 && o.fl > 0 && o.id && Array.isArray(o.accessories)));
  assert.ok(p.id && p.name && p.camera.w > 0 && p.camera.pix > 0 && p.session && Array.isArray(p.filters.owned));
  p.site = { lat: 45, lon: 9, sqm: 19 }; p.horizon = [];
  const C = M.computePrep(M.profileConfigs(p), p, '2026-10-10', 0);
  assert.ok(M.computeObj(C, M.CAT_BY_ID.get('NGC 7000')).e.best);
});

test('profili delle versioni vecchie', () => {
  const old = { id: 'p1', name: 'Vecchio', camera: { w: 6248, h: 4176, pix: 3.76, type: 'osc' }, optic: { name: 'Rifrattore', ap: 80, fl: 480, obs: 0, fac: 0.8 }, filters: { uvir: true, duo: true, nbw: 7 }, session: { sunThr: -18, minAlt: 30 } };
  const p = M.migrateProfile(JSON.parse(JSON.stringify(old)));
  assert.equal(p.optics.length, 1);
  assert.equal(p.optics[0].useNative, false);
  assert.equal(p.optics[0].accessories[0].fac, 0.8);
  assert.ok(!('optic' in p) && !('fac' in p.optics[0]));
  assert.ok(Array.isArray(p.filters.owned) && p.filters.owned.includes('uvir') && p.filters.owned.includes('duo7'));
  // luoghi dentro i profili: entro 500 m è lo stesso
  const a = { ...old, id: 'a', site: { name: 'A', lat: 45, lon: 9 } }, b = { ...old, id: 'b', site: { name: 'B', lat: 45.002, lon: 9.001 } }, c = { ...old, id: 'c', site: { name: 'C', lat: 46, lon: 10 } };
  const { locs, byProfile } = M.locsFromProfiles([a, b, c]);
  assert.equal(locs.length, 2);
  assert.equal(byProfile.get('a'), byProfile.get('b'));
  assert.equal(M.migrateLoc({ site: { lat: 'x', lon: 9 } }), null);
  const l = M.migrateLoc({ site: { lat: 45, lon: 9, tz: 'Europe/Rome' } });
  assert.ok(l.id && Array.isArray(l.horizon) && l.minAlt === 25 && l.site.tz === 'Europe/Rome');
});

test('archivio dei profili: copie di sicurezza e file illeggibile', async () => {
  const { createStore, BAK_EVERY } = require('../profile-store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skyframe-test-')), f = path.join(dir, 'profili.json');
  try {
    const st = createStore(() => f), data = (n) => ({ version: 3, profiles: [{ id: 'p' + n }], locations: [] });
    assert.equal(await st.load(), null); // nessun file: si parte dall'esempio
    await Promise.all([st.save(data(1)), st.save(data(2)), st.save(data(3))]); // in fila, nell'ordine
    assert.equal((await st.load()).profiles[0].id, 'p3');
    assert.equal(JSON.parse(fs.readFileSync(st.bak(1), 'utf8')).profiles[0].id, 'p1'); // una sola copia nelle 6 ore
    assert.ok(!fs.existsSync(st.bak(2)));
    // copia vecchia di più di 6 ore: si ruota
    const past = (Date.now() - BAK_EVERY - 60e3) / 1000; fs.utimesSync(st.bak(1), past, past);
    await st.save(data(4));
    assert.equal(JSON.parse(fs.readFileSync(st.bak(1), 'utf8')).profiles[0].id, 'p3');
    assert.equal(JSON.parse(fs.readFileSync(st.bak(2), 'utf8')).profiles[0].id, 'p1');
    // file rovinato: messo da parte, si riparte dalla copia più recente
    fs.writeFileSync(f, '{"version": 3, "profiles": [');
    await st.save(data(5)); // un salvataggio con il file rovinato non lo copia nelle copie di sicurezza
    fs.writeFileSync(f, '{"version": 3, "profiles": [');
    const r = await st.load();
    assert.equal(r.profiles[0].id, 'p3');
    assert.ok(r.restored > 0);
    assert.ok(fs.readdirSync(dir).some((x) => /^profili-illeggibile-.*\.json$/.test(x)));
    assert.ok(!fs.existsSync(f));
    // passaggio a un formato nuovo: si tiene il file com'era
    await st.save({ version: 2, profiles: [] }); await st.save(data(6));
    assert.ok(fs.existsSync(path.join(dir, 'profili-v2-backup.json')));
    // file che non si apre (qui una cartella al suo posto, come un file occupato): non è rovinato, non si tocca e non si scrive
    const dir2 = path.join(dir, 'occupato'), f2 = path.join(dir2, 'profili.json'); fs.mkdirSync(f2, { recursive: true });
    const st2 = createStore(() => f2), got = await st2.load();
    assert.deepEqual(got, { blocked: true });
    await assert.rejects(st2.save(data(7)));
    assert.ok(fs.statSync(f2).isDirectory() && fs.readdirSync(dir2).length === 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
