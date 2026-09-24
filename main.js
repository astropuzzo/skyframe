'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { lookup: lpLookup } = require('./src/js/lpatlas');
const updater = require('./updater');

app.setName('Skyframe');
// prove: SKYFRAME_USERDATA usa una cartella dati separata (profili di prova senza toccare quelli veri)
if (process.env.SKYFRAME_USERDATA) app.setPath('userData', process.env.SKYFRAME_USERDATA);
else if (process.env.SKYFRAME_SMOKE) { // lo smoke test lavora su una copia dei profili veri
  const fsS = require('fs'), src = path.join(app.getPath('userData'), 'profili.json'), dir = path.join(app.getPath('temp'), 'skyframe-smoke');
  fsS.mkdirSync(dir, { recursive: true }); try { fsS.copyFileSync(src, path.join(dir, 'profili.json')); } catch { /* nessun profilo: si parte dall'esempio */ }
  app.setPath('userData', dir);
}
const dataFile = () => path.join(app.getPath('userData'), 'profili.json');
/* profili salvati con il nome precedente dell'app */
async function migrateOldProfiles() {
  try { await fs.access(dataFile()); return; } catch { /* non c'è ancora: si cerca il vecchio */ }
  for (const old of ['Cielo dal Terrazzo', 'cielo-dal-terrazzo']) {
    const f = path.join(app.getPath('appData'), old, 'profili.json');
    try { const txt = await fs.readFile(f, 'utf8'); await fs.mkdir(path.dirname(dataFile()), { recursive: true }); await fs.writeFile(dataFile(), txt, 'utf8'); return; } catch { /* prossimo */ }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    show: false, // si mostra quando la pagina (con la schermata di avvio) è pronta: niente finestra bianca
    backgroundColor: '#06080D',
    width: 1360,
    height: 900,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: '#080B11',
    title: 'Skyframe',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: !!(process.env.SKYFRAME_SMOKE || process.env.SKYFRAME_EVAL), // lo smoke test cattura la pagina senza bisogno di un desktop visibile
    },
  });
  if (process.env.SKYFRAME_SMOKE || process.env.SKYFRAME_EVAL) { const [ew, eh] = (process.env.SKYFRAME_EVAL_SIZE || '1440x900').split('x').map(Number); win.setMinimumSize(300, 400); win.setSize(ew, eh); win.webContents.setFrameRate(30); }

  // I link esterni (Aladin, Stellarium Web, lightpollutionmap) si aprono nel browser di sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  updater.start(win);
  if (process.env.SKYFRAME_SMOKE) smokeTest(win, process.env.SKYFRAME_SMOKE);
  if (process.env.SKYFRAME_EVAL) evalScript(win, process.env.SKYFRAME_EVAL);
}

// sviluppo: SKYFRAME_EVAL=script.js esegue lo script nella pagina (async, ritorna un valore), stampa il risultato ed esce
function evalScript(win, file) {
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 3) console.log('[renderer]', e.message); });
  win.webContents.once('did-finish-load', async () => {
    try { await sleep(2500); const code = await fs.readFile(file, 'utf8'); console.log(JSON.stringify(await win.webContents.executeJavaScript(`(async () => { ${code} })()`, true))); }
    catch (e) { console.error('EVAL FAIL', e.message); process.exitCode = 1; }
    if (process.env.SKYFRAME_EVAL_SHOT) await fs.writeFile(process.env.SKYFRAME_EVAL_SHOT, (await win.webContents.capturePage()).toPNG());
    app.quit();
  });
}
// `npm run smoke`: apre un target, aspetta l'anteprima e salva uno screenshot. Serve a verificare le build.
function smokeTest(win, out) {
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 3) console.log('[renderer]', e.message); });
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await wait(2500);
      await fs.writeFile(out.replace(/\.png$/, '-main.png'), (await win.webContents.capturePage()).toPNG());
      // livello Luci e SQM al passaggio del mouse sulla cupola
      const domeTip = await win.webContents.executeJavaScript(`(() => { Dome.setLP(true); const c = document.querySelector('#dome'), b = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('mousemove', { clientX: b.left + b.width * 0.2, clientY: b.top + b.height * 0.3, bubbles: true })); return document.querySelector('#domeTip').textContent; })()`);
      await wait(700);
      await fs.writeFile(out.replace(/[.]png$/, '-lp.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`Dome.setLP(false); document.querySelector('#domeTip').hidden = true`);
      await wait(300);
      await fs.writeFile(out.replace(/[.]png$/, '-glow.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('.main').style.scrollBehavior = 'auto'; document.querySelector('.work').scrollIntoView()`);
      await wait(600);
      await fs.writeFile(out.replace(/\.png$/, '-list.png'), (await win.webContents.capturePage()).toPNG());
      // banner degli aggiornamenti, con un messaggio simulato
      await win.webContents.executeJavaScript(`showUpdate({ state: 'ready', version: '9.9.9' })`);
      await wait(700);
      await fs.writeFile(out.replace(/\.png$/, '-update.png'), (await win.webContents.capturePage({ x: 0, y: 0, width: 1440, height: 110 })).toPNG());
      await win.webContents.executeJavaScript(`showUpdate({ state: 'idle' })`);
      const info = await win.webContents.executeJavaScript(
        `openDetail('M 31'); ({catalogo: CAT.length, calcolati: state.res.results.length, visibili: state.res.results.filter(r=>r.usableH>=0.25).length, configurazioni: state.cfgs.length, file: DESK})`
      );
      await wait(500);
      await win.webContents.executeJavaScript(`document.querySelector('#fov').scrollIntoView({block:'center'})`);
      let note = '';
      for (let i = 0; i < 60; i++) {
        await wait(1000);
        note = await win.webContents.executeJavaScript(`document.getElementById('skyNote')?.textContent || ''`);
        if (!note.startsWith('Scarico')) break;
      }
      const img = await win.webContents.capturePage();
      await fs.writeFile(out, img.toPNG());
      // editor del profilo: luogo reale via mappa, atlante, altitudine
      // periodo giusto di un target fuori stagione e grafici interattivi
      await win.webContents.executeJavaScript(`(() => { try { closeDetail(); state.byId.has('M 51') ? openDetail('M 51') : openDetail(state.res.results.find((x) => x.usableH < 0.5).o.id); return 1; } catch (e) { return e.stack; } })()`).then((v) => { if (v !== 1) console.log('ERR1', v); });
      await wait(1500);
      const period = await win.webContents.executeJavaScript(`(() => { try { document.querySelector('#altBox').scrollIntoView({ block: 'center' }); const b = document.querySelector('#altBox svg').getBoundingClientRect(); document.querySelector('#altBox').dispatchEvent(new PointerEvent('pointermove', { clientX: b.left + b.width * 0.6, clientY: b.top + 40, bubbles: true })); return { periodo: document.querySelector('#period').textContent, tip: (document.querySelector('#altBox .ctip') || {}).textContent }; } catch (e) { return { err: e.stack }; } })()`);
      await wait(400);
      await fs.writeFile(out.replace(/\.png$/, '-period.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('#period').scrollIntoView({ block: 'center' })`);
      await wait(300);
      await fs.writeFile(out.replace(/\.png$/, '-period2.png'), (await win.webContents.capturePage()).toPNG());
      // un clic fuori dal pannello e "Chiudi" con modifiche non devono perdere il profilo
      const guard = await win.webContents.executeJavaScript(`closeDetail(); openEditor(state.activeId); F('f_name').value = 'prova'; F('f_name').dispatchEvent(new Event('input', { bubbles: true })); F('editor').click(); F('edClose').click(); const r = { aperto: !F('editor').hidden, conferma: !F('leaveConfirm').hidden, lacerta: OPTICS.some((o) => o.id === 'lacerta2008') }; F('leaveYes').click(); r`);
      if (!guard.aperto || !guard.conferma) throw new Error('editor chiuso senza conferma ' + JSON.stringify(guard));
      await win.webContents.executeJavaScript(`closeDetail(); openEditor(state.activeId); setGeo(41.9109, 12.4764, 'Roma, Piazza del Popolo', 12);`);
      // la mappa all-sky di lightpollutionmap arriva in 10–20 s
      for (let i = 0; i < 60; i++) { await wait(1000); if (await win.webContents.executeJavaScript(`!lpmBusy && !!draft.site.skyMap`)) break; }
      const geo = await win.webContents.executeJavaScript(`document.querySelector('#lpSky').scrollIntoView({block:'center'}); ({ sqm: F('f_sqm').value, quota: F('f_elev').value, atlante: F('lpMsg').textContent, allsky: F('skyMsg').textContent })`);
      await wait(600);
      // tutte e due le immagini del sito (fisheye e panoramica) devono dare una mappa completa, con scala ricavata da sola
      geo.letture = await win.webContents.executeJavaScript(`(async () => { const r = await window.cielo.lpmAllSky(41.9109, 12.4764); const out = [];
        for (const url of r.images) { const det = AllSky.detect(await AllSky.fromDataUrl(url)), sc = AllSky.autoScale(det, r.sqm); if (!sc) { out.push(det.kind + ': scala non trovata'); continue; }
          const g = AllSky.build(det, sc.top, sc.bottom), bad = g.mag.filter((v) => !(v > 5)).length; out.push(det.kind + ' ' + sc.top + '→' + sc.bottom + ' zenit ' + g.zenith + (bad ? ' BUCHI ' + bad : ' ok')); }
        return out; })()`);
      if (geo.letture.some((x) => /BUCHI|non trovata/.test(x))) throw new Error('lettura all-sky: ' + geo.letture.join(' | '));
      await fs.writeFile(out.replace(/\.png$/, '-editor.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('#geoMap').scrollIntoView({block:'center'})`);
      await wait(1500);
      await fs.writeFile(out.replace(/\.png$/, '-map.png'), (await win.webContents.capturePage()).toPNG());
      console.log(JSON.stringify({ ...info, anteprima: note, geo, guard, period, domeTip }));
    } catch (e) {
      console.error('SMOKE FAIL', e);
      process.exitCode = 1;
    }
    app.quit();
  });
}

ipcMain.handle('lp:lookup', async (_e, lat, lon) => {
  try { return await lpLookup(+lat, +lon, path.join(app.getPath('userData'), 'lp-cache')); } catch (err) { return { error: String(err && err.message || err) }; }
});

/* Mappa all-sky di lightpollutionmap.info: in una finestra nascosta si fa quello che farebbe l'utente sul sito
   (apre la mappa sul punto col livello Sky brightness dell'anno, clicca il punto, legge l'SQM nel riquadro, preme
   "All-sky") e si prendono le immagini che il sito stesso genera. Una sola volta per luogo, su richiesta. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, every = 400) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch { /* la pagina si sta ancora caricando */ } await sleep(every); } throw new Error('tempo scaduto'); }
async function lpmAllSky(lat, lon, year) { // year può essere corretto dal riquadro del sito
  const state = Buffer.from(JSON.stringify({ basemap: 'LayerOSM', overlay: `sb_${year}`, overlaycolor: false, overlayopacity: '60', featuresopacity: '85' })).toString('base64');
  const url = `https://www.lightpollutionmap.info/#zoom=15.00&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&state=${state}`;
  // offscreen: la pagina viene disegnata anche senza finestra visibile (serve alla mappa per rispondere al clic)
  const w = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: 'persist:lightpollutionmap', sandbox: true, contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  w.webContents.setFrameRate(15);
  const js = (code) => w.webContents.executeJavaScript(code, true);
  const log = (m) => { if (process.env.SKYFRAME_LPM_TEST) console.log('[lpm]', m); };
  const shot = async (n) => { if (process.env.SKYFRAME_LPM_TEST) require('fs').writeFileSync(path.join(app.getPath('temp'), `lpm-step-${n}.png`), (await w.webContents.capturePage()).toPNG()); };
  try {
    log('carico ' + url);
    // gli alert del sito ("Failed to render all-sky image") non devono aprire finestre: si registrano e basta
    const muteAlerts = () => js(`(() => { window.__lpmAlerts = window.__lpmAlerts || []; window.alert = (m) => { window.__lpmAlerts.push(String(m)); }; return true; })()`).catch(() => {});
    w.webContents.on('dom-ready', muteAlerts);
    await w.loadURL(url); await muteAlerts();
    await waitFor(() => js(`!!document.querySelector('#map canvas') && typeof $ === 'function'`), 30000).catch(async (e) => { await shot('load'); log(await js(`document.title + ' | canvas ' + document.querySelectorAll('canvas').length + ' | $ ' + typeof $`)); throw e; });
    log('mappa pronta');
    await sleep(2500);
    // eventuale banner del consenso (Google Funding Choices): si rifiuta, oppure "More options" → conferma senza consensi
    const consent = (re) => js(`(() => { const b = [...document.querySelectorAll('button, a, .fc-button')].find((x) => x.offsetParent && ${re}.test((x.textContent || '').trim())); if (b) b.click(); return !!b; })()`);
    for (let k = 0; k < 3; k++) {
      if (await consent('/^(do not consent|non acconsento|rifiuta|reject all|decline)/i')) break;
      if (await consent('/^(more options|manage options|altre opzioni|gestisci opzioni)/i')) { await sleep(1500); await consent('/^(reject all|rifiuta tutto)/i'); await sleep(500); if (await consent('/^(confirm choices|conferma le scelte|save|salva)/i')) break; }
      await sleep(1000);
    }
    await sleep(800);
    const p = await js(`(() => { const b = document.querySelector('#map').getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    for (let attempt = 0; attempt < 3; attempt++) {
      w.webContents.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
      w.webContents.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      w.webContents.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      try { await waitFor(() => js(`!!document.querySelector('#lp_sb_point_info_value1') && !!document.querySelector('.allsky-inline-btn')`), 12000); break; } catch (e) { await shot('click' + attempt); if (attempt === 2) throw new Error('il riquadro del punto non si è aperto'); }
    }
    log('riquadro aperto');
    const info = await js(`(() => { const t = (s) => (document.querySelector(s) || {}).textContent || ''; const yr = (document.body.innerText.match(/Sky brightness\\) info \\((\\d{4})\\)/) || [])[1]; return { sqm: parseFloat(t('#lp_sb_point_info_value1')), unit: t('#lp_sb_unit'), elev: parseFloat(t('#lp_elevation_val')), year: yr ? +yr : null }; })()`);
    if (info.year && info.year !== year) { log('anno della mappa: ' + info.year); year = info.year; }
    // l'all-sky usa l'anno scelto nel selettore del sito: si allinea a quello del riquadro; gli alert non devono bloccare
    // se il sito non riesce a generare l'all-sky di un anno si riprova con l'anno prima
    let ok = false;
    for (const y of [year, year - 1]) {
      await muteAlerts();
      await js(`(() => { window.__lpmAlerts = []; if ($('#overlaySelectSB').length) $('#overlaySelectSB').val('${y}').trigger('change'); return true; })()`);
      await js(`document.querySelector('.allsky-inline-btn').click()`);
      log('all-sky richiesto ' + y);
      const r = await waitFor(() => js(`document.querySelector('#sqc_main_img, #lp_full_screen_image') ? 'img' : (window.__lpmAlerts.length ? 'alert' : '')`), 90000, 700).catch(async (e) => { await shot('allsky'); throw e; });
      if (r === 'img') { year = y; ok = true; break; }
      log(`il sito non ha generato l'all-sky ${y}`);
    }
    if (!ok) throw new Error("il sito non è riuscito a generare l'immagine all-sky per questo punto");
    log('immagini pronte');
    const images = await js(`(async () => {
      const toData = async (src) => { const b = await (await fetch(src)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); };
      const img = () => document.querySelector('#sqc_main_img, #lp_full_screen_image');
      const out = [await toData(img().src)];
      const pan = document.querySelector('input[name="sqc_view"][value="1"]');
      if (pan) { $(pan).prop('checked', true).trigger('change'); await new Promise((r) => setTimeout(r, 400)); if (img().src) out.push(await toData(img().src)); }
      return out;
    })()`);
    return { sqm: info.sqm, nelm: /nelm/i.test(info.unit), elev: info.elev, images, year };
  } finally { const ses = w.webContents.session; w.destroy(); ses.clearCache().catch(() => {}); } // la cache delle tile del sito non serve e non deve accumularsi
}
ipcMain.handle('lpm:allsky', async (_e, lat, lon) => {
  // la mappa di un anno esce l'anno dopo: si parte dall'anno scorso (il riquadro del sito conferma quello disponibile)
  try { return await lpmAllSky(+lat, +lon, new Date().getFullYear() - 1); } catch (err) { return { error: String(err && err.message || err) }; }
});

// Ricerca del luogo mentre scrivi: Photon (komoot, dati OpenStreetMap), pensato per l'autocompletamento.
ipcMain.handle('geo:search', async (_e, q) => {
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(String(q).slice(0, 120))}&limit=7`, { headers: { 'User-Agent': 'Skyframe (https://github.com/astropuzzo/skyframe)' } });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    const j = await r.json();
    return (j.features || []).map((f) => {
      const p = f.properties || {};
      return { name: p.name || p.street || p.city || '?', detail: [p.city !== p.name ? p.city : '', p.county, p.state, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    });
  } catch (err) { return { error: String(err && err.message || err) }; }
});
// Altitudine del punto: Open-Meteo (modello digitale del terreno Copernicus, 90 m).
ipcMain.handle('geo:elevation', async (_e, lat, lon) => {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${+lat}&longitude=${+lon}`);
    const j = await r.json();
    return Array.isArray(j.elevation) ? Math.round(j.elevation[0]) : null;
  } catch { return null; }
});

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text));
  return true;
});

ipcMain.handle('profiles:load', async () => {
  try {
    return JSON.parse(await fs.readFile(dataFile(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('profiles:save', async (_e, data) => {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
  return true;
});

ipcMain.handle('profiles:export', async (e, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Esporta profili',
    defaultPath: path.join(app.getPath('documents'), 'skyframe-profili.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle('profiles:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Importa profili',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return null;
  try {
    return JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
  } catch {
    return null;
  }
});

app.whenReady().then(async () => {
  // prova dell'automazione all-sky: SKYFRAME_LPM_TEST="lat,lon" salva le immagini nella cartella temporanea
  if (process.env.SKYFRAME_LPM_TEST) {
    const [la, lo] = process.env.SKYFRAME_LPM_TEST.split(',').map(Number), t0 = Date.now();
    try {
      const r = await lpmAllSky(la, lo, new Date().getFullYear() - 1);
      r.images.forEach((d, i) => require('fs').writeFileSync(path.join(app.getPath('temp'), `lpm-allsky-${i}.png`), Buffer.from(d.split(',')[1], 'base64')));
      console.log(JSON.stringify({ sqm: r.sqm, nelm: r.nelm, elev: r.elev, year: r.year, images: r.images.map((d) => d.length), s: (Date.now() - t0) / 1000 }));
    } catch (e) { console.error('LPM FAIL', e.message); }
    app.quit(); return;
  }
  await migrateOldProfiles();
  // la policy delle tile di OpenStreetMap chiede che l'applicazione si identifichi
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://tile.openstreetmap.org/*'] }, (d, cb) => {
    d.requestHeaders['User-Agent'] = `Skyframe/${app.getVersion()} (+https://github.com/astropuzzo/skyframe)`;
    cb({ requestHeaders: d.requestHeaders });
  });
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  // cache delle tile di lightpollutionmap lasciata dalle versioni precedenti: si svuota a app già aperta
  setTimeout(() => session.fromPartition('persist:lightpollutionmap').clearCache().catch(() => {}), 15000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
