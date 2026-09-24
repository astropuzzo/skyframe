'use strict';
/* Aggiornamenti dalle release di GitHub (astropuzzo/skyframe).
   Dove l'installazione si può sostituire da sola (setup di Windows, AppImage su Linux) la nuova versione si scarica in
   background, si installa e l'app si riapre. Dove non si può (macOS senza firma, exe portable, pacchetto .deb) si
   avvisa soltanto, con il link alla pagina della release. Nessun controllo nelle build di sviluppo. */
const { app, ipcMain, net, shell } = require('electron');

const REPO = 'astropuzzo/skyframe', RELEASES = `https://github.com/${REPO}/releases/latest`, EVERY = 6 * 3600e3;
const canInstall = () => (process.platform === 'win32' ? !process.env.PORTABLE_EXECUTABLE_DIR : process.platform === 'linux' ? !!process.env.APPIMAGE : false);
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

let win = null, last = { state: 'idle' };
const send = (m) => { last = m; if (win && !win.isDestroyed()) win.webContents.send('update', m); };

function start(w) {
  win = w;
  w.webContents.on('did-finish-load', () => { if (last.state !== 'idle') send(last); });
  if (!app.isPackaged || process.env.SKYFRAME_SMOKE) return;
  if (canInstall()) auto(); else notifyOnly();
}

function auto() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (i) => send({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => send({ ...last, state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => { if (last.state === 'downloading') send({ state: 'error', version: last.version, message: String(e && e.message || e), url: RELEASES }); });
  const check = () => autoUpdater.checkForUpdates().catch(() => { /* offline: si riprova più tardi */ });
  check(); setInterval(check, EVERY);
  ipcMain.handle('update:install', () => { setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; }); // installa in silenzio e riapre
}

function notifyOnly() {
  const check = async () => {
    try {
      const r = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Skyframe/${app.getVersion()}` } });
      if (!r.ok) return;
      const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
      if (v && newer(v, app.getVersion())) send({ state: 'available', version: v, url: j.html_url || RELEASES });
    } catch { /* offline */ }
  };
  check(); setInterval(check, EVERY);
}

ipcMain.handle('update:open', () => shell.openExternal(last.url || RELEASES));

module.exports = { start };
