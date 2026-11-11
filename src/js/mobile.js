'use strict';
/* App Android (Capacitor): le funzioni che sul desktop fa il processo principale di Electron qui le fa la pagina.
   Atlante di Lorenz, ricerca dei luoghi (Photon), altitudine (Open-Meteo), aggiornamenti dalle release di GitHub.
   La mappa all-sky automatica di lightpollutionmap non c'è: si importa a mano o arriva col profilo dal desktop. */
(function () {
  const C = window.Capacitor;
  if (window.cielo || !(C && C.isNativePlatform && C.isNativePlatform())) return;
  document.documentElement.classList.add('native');
  const REPO = 'astropuzzo/skyframe';
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  let updUrl = `https://github.com/${REPO}/releases/latest`;
  const plug = (n) => (C.Plugins && C.Plugins[n]) || null;
  window.cielo = {
    platform: 'android',
    lpLookup: (lat, lon) => window.LPAtlas.lookup(+lat, +lon).catch((e) => ({ error: String(e && e.message || e) })),
    async geoSearch(q) {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(String(q).slice(0, 120))}&limit=7`);
        if (!r.ok) return { error: 'HTTP ' + r.status };
        const j = await r.json();
        return (j.features || []).map((f) => { const p = f.properties || {}; return { name: p.name || p.street || p.city || '?', detail: [p.city !== p.name ? p.city : '', p.county, p.state, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }; });
      } catch (e) { return { error: String(e && e.message || e) }; }
    },
    async elevation(lat, lon) {
      try { const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${+lat}&longitude=${+lon}`); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j.elevation) ? Math.round(j.elevation[0]) : null; } catch { return null; }
    },
    copy: (t) => navigator.clipboard.writeText(String(t)),
    // file veri: in Documenti/Skyframe (Android 11+, senza permessi) e poi la condivisione (Drive, mail, «Salva sul dispositivo»)
    async saveFile(name, text) {
      const F = plug('Filesystem'), Sh = plug('Share'); if (!F) return null;
      let where = null; try { where = await writeDoc(name, text); } catch { /* Android 10 o precedente */ }
      if (Sh) try { const { uri } = await F.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }); await Sh.share({ title: name, files: [uri] }); } catch { /* condivisione annullata */ }
      return where;
    },
    async shareText(title, text) { const Sh = plug('Share'); if (!Sh) return navigator.clipboard.writeText(text); try { await Sh.share({ title, text, dialogTitle: title }); } catch { /* condivisione annullata */ } },
    // copia automatica: sempre lo stesso file; se non si può riscrivere (era di un'installazione precedente) se ne fa uno nuovo
    async backup(text) {
      let name = localStorage.getItem('sf.bakName') || 'skyframe-backup.json';
      try { return await writeDoc(name, text); } catch { /* sotto */ }
      name = `skyframe-backup-${new Date().toISOString().slice(0, 10)}.json`;
      try { const w = await writeDoc(name, text); localStorage.setItem('sf.bakName', name); return w; } catch { return null; }
    },
    // aggiornamenti: si avvisa quando esce una versione nuova; l'APK si scarica dalla pagina della release
    onUpdate(cb) {
      const check = async () => {
        try {
          const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
          if (!r.ok) return;
          const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, ''), apk = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
          if (v && window.SKYFRAME_VERSION && newer(v, window.SKYFRAME_VERSION)) { updUrl = apk ? apk.browser_download_url : j.html_url; cb({ state: 'available', version: v }); }
        } catch { /* offline */ }
      };
      setTimeout(check, 5000); setInterval(check, 30 * 60e3);
    },
    openUpdate: () => { window.open(updUrl, '_blank'); },
    async notifyPermission() { const A = plug('SkyframeAlerts'); if (!A) return false; try { return !!(await A.permission()).granted; } catch { return false; } },
    // avvisi: il motore nativo (android/…/alerts) riceve la ricetta delle notti e lavora da solo ad app chiusa
    alerts: plug('SkyframeAlerts') && {
      configure: (cfg) => plug('SkyframeAlerts').configure({ cfg }),
      run: (o) => plug('SkyframeAlerts').run(o || {}),
      status: () => plug('SkyframeAlerts').status().catch(() => null),
      openSettings: (which) => plug('SkyframeAlerts').openSettings({ which }).catch(() => {}),
      consumeOpen: () => plug('SkyframeAlerts').consumeOpen(),
      pinWidget: () => plug('SkyframeAlerts').pinWidget().catch(() => ({ asked: false })),
    },
    // bussola per la misura dell'orizzonte: declinazione magnetica del luogo e quanto è calibrato il magnetometro (0–3)
    compass: plug('SkyframeSensors') && {
      declination: (lat, lon) => plug('SkyframeSensors').declination({ lat, lon }).then((r) => +r.deg).catch(() => null),
      watch(cb) {
        const P = plug('SkyframeSensors'); let h = null;
        try { h = P.addListener('accuracy', (d) => cb(d.level)); P.start().then((r) => { if (r && r.level >= 0) cb(r.level); }).catch(() => {}); } catch { /* resta senza */ }
        return () => { try { P.stop().catch(() => {}); Promise.resolve(h).then((x) => x && x.remove && x.remove()); } catch { /* niente */ } };
      },
    },
  };
  const android11 = () => { const m = /Android (\d+)/.exec(navigator.userAgent); return !!m && +m[1] >= 11; };
  async function writeDoc(name, text) {
    const F = plug('Filesystem'); if (!F || !android11()) throw new Error('no');
    await F.writeFile({ path: 'Skyframe/' + name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    return 'Documenti/Skyframe/' + name;
  }
  // tasto indietro di Android: chiude foglio, dettaglio, editor o guida aperti, riporta a Stanotte; da Stanotte riduce l'app
  const App = C.Plugins && C.Plugins.App;
  if (App && App.addListener) App.addListener('backButton', () => { if (window.onAndroidBack && window.onAndroidBack()) return; if (App.minimizeApp) App.minimizeApp(); else if (App.exitApp) App.exitApp(); });
  // ritorno in primo piano, anche da un avviso toccato (che porta la sua notte)
  const resume = () => { if (window.onAppResume) window.onAppResume(); };
  if (App && App.addListener) App.addListener('resume', resume);
  const AL = plug('SkyframeAlerts'); if (AL && AL.addListener) AL.addListener('open', resume);
})();
