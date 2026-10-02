// Prove di base (npm test): ora del luogo, migrazione dei dati salvati, archivio dei profili sul computer.
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
vm.runInContext("const LANG='it',LOCALE='it-IT',txName=(s)=>s,tx=(s,p)=>p?s.replace(/[{](\\w+)[}]/g,(_,k)=>p[k]??_):s;" + file('js/astro.js') + '\n' + file('js/model.js') +
  '\n;this.M={siteTz,tzOff,wall,wallMs,dsOf,TZ,setDisplayTz,defaultNightStr,computeNight,moonCalendar,templateProfile,migrateProfile,migrateLoc,locsFromProfiles,moonFlux,unit,mosaicPanes,ninaCsv};', ctx);
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
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
