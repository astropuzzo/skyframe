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
    // avvisi della sera: notifiche locali programmate nel sistema (arrivano anche ad app chiusa)
    async notifyPermission() {
      const LN = localNotif(); if (!LN) return false;
      try { let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions(); return p.display === 'granted'; } catch { return false; }
    },
    async notifySchedule(list) {
      const LN = localNotif(); if (!LN) return;
      try {
        const pend = await LN.getPending(); if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
        const items = list.filter((n) => n.at > Date.now()).map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } }));
        if (items.length) await LN.schedule({ notifications: items });
      } catch { /* niente */ }
    },
    // sveglie esatte (Android 12+): senza, l'avviso della sera può arrivare con qualche minuto di ritardo
    async exactStatus() { const LN = localNotif(); if (!LN || !LN.checkExactNotificationSetting) return null; try { return (await LN.checkExactNotificationSetting()).exact_alarm; } catch { return null; } },
    async exactOpen() { const LN = localNotif(); if (LN && LN.changeExactNotificationSetting) try { await LN.changeExactNotificationSetting(); } catch { /* niente */ } },
    // avvisi ad app chiusa: lo script in background (src/runners/background.js) riceve le notti già calcolate
    async bgConfig(details) { const B = bgRunner(); if (!B) return false; try { await B.dispatchEvent({ label: BG_LABEL, event: 'config', details }); return true; } catch { return false; } },
    async bgStatus() { const B = bgRunner(); if (!B) return null; try { return await B.dispatchEvent({ label: BG_LABEL, event: 'status', details: {} }); } catch { return null; } },
  };
  const BG_LABEL = 'io.github.astropuzzo.skyframe.check';
  // il plugin nativo si chiama CapacitorBackgroundRunner (con BackgroundRunner non si trovava: la configurazione non arrivava)
  function bgRunner() { return (C.Plugins && (C.Plugins.CapacitorBackgroundRunner || C.Plugins.BackgroundRunner)) || null; }
  // tasto indietro di Android: chiude foglio, dettaglio, editor o guida aperti, riporta a Stanotte; da Stanotte riduce l'app
  const App = C.Plugins && C.Plugins.App;
  if (App && App.addListener) App.addListener('backButton', () => { if (window.onAndroidBack && window.onAndroidBack()) return; if (App.minimizeApp) App.minimizeApp(); else if (App.exitApp) App.exitApp(); });
  function localNotif() { return (C.Plugins && C.Plugins.LocalNotifications) || (C.registerPlugin ? C.registerPlugin('LocalNotifications') : null); }
})();
