'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { lookup: lpLookup } = require('./lpatlas');

app.setName('Skyframe');
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
      offscreen: !!process.env.SKYFRAME_SMOKE, // lo smoke test cattura la pagina senza bisogno di un desktop visibile
    },
  });
  if (process.env.SKYFRAME_SMOKE) { win.setSize(1440, 900); win.webContents.setFrameRate(30); }

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

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (process.env.SKYFRAME_SMOKE) smokeTest(win, process.env.SKYFRAME_SMOKE);
}

// `npm run smoke`: apre un target, aspetta l'anteprima e salva uno screenshot. Serve a verificare le build.
function smokeTest(win, out) {
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await wait(2500);
      await fs.writeFile(out.replace(/\.png$/, '-main.png'), (await win.webContents.capturePage()).toPNG());
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
      await win.webContents.executeJavaScript(`closeDetail(); openEditor(state.activeId); setGeo(41.9109, 12.4764, 'Roma, Piazza del Popolo', 12);`);
      await wait(7000);
      const geo = await win.webContents.executeJavaScript(`document.querySelector('#lpSky').scrollIntoView({block:'center'}); ({ sqm: F('f_sqm').value, quota: F('f_elev').value, atlante: F('lpMsg').textContent })`);
      await wait(600);
      await fs.writeFile(out.replace(/\.png$/, '-editor.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('#geoMap').scrollIntoView({block:'center'})`);
      await wait(1500);
      await fs.writeFile(out.replace(/\.png$/, '-map.png'), (await win.webContents.capturePage()).toPNG());
      console.log(JSON.stringify({ ...info, anteprima: note, geo }));
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
  await migrateOldProfiles();
  // la policy delle tile di OpenStreetMap chiede che l'applicazione si identifichi
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://tile.openstreetmap.org/*'] }, (d, cb) => {
    d.requestHeaders['User-Agent'] = `Skyframe/${app.getVersion()} (+https://github.com/astropuzzo/skyframe)`;
    cb({ requestHeaders: d.requestHeaders });
  });
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
