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
  };
})();
