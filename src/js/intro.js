/* Skyframe, l'intro del logo: un campo stellare largo, lo zoom sul target, la cornice che si chiude con uno scatto e il
   logo che resta. Tutto con trasformazioni e trasparenze (le anima la scheda grafica, fluide anche mentre l'app calcola il
   cielo); i tempi sono nei keyframe di app.css. Si carica subito dopo la schermata d'avvio, prima di tutto il resto.
   L'ultimo fotogramma è identico al logo fermo (#i-logo): stessi tracciati, nessuna trasformazione rimasta. */
(function () {
  /* animazioni: «auto» segue il sistema (riduci animazioni), «on» sempre, «off» ridotte. La classe .motion su <html>
     accende tutti i movimenti dell'app (app.css); si decide qui, prima che la pagina si disegni. */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const pref = () => { try { return JSON.parse(localStorage.getItem('sf.motion') || 'null') || 'auto'; } catch (e) { return 'auto'; } };
  const apply = () => { const p = pref(); document.documentElement.classList.toggle('motion', p === 'on' || (p === 'auto' && !reduce.matches)); };
  apply(); if (reduce.addEventListener) reduce.addEventListener('change', apply);
  window.motionPref = pref;
  window.motionOn = () => document.documentElement.classList.contains('motion');
  window.setMotionPref = (p) => { try { localStorage.setItem('sf.motion', JSON.stringify(p)); } catch (e) { /* storage non disponibile */ } apply(); };
  // stelle sempre uguali (generatore con seme fisso)
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TINT = ['#DCE4F2', '#DCE4F2', '#DCE4F2', '#C4D5FF', '#FFE6C2', '#FFD2A8'];
  /* uno strato: n stelle in un disco di raggio R (px a scala 1); le poche luminose con un alone */
  function layer(cls, seed, n, R, band) {
    const r = rng(seed); let s = '';
    // la Via Lattea: un velo largo e un nucleo più chiaro
    if (band) s += `<g transform="rotate(-32)"><ellipse rx="${R}" ry="${R * 0.2}" fill="url(#inBand)"/><ellipse rx="${R * 0.7}" ry="${R * 0.075}" fill="url(#inBand)"/></g>`;
    for (let i = 0; i < n; i++) {
      // più stelle verso la banda, come nel cielo vero
      const a = r() * Math.PI * 2, d = R * Math.sqrt(r()); let x = Math.cos(a) * d, y = Math.sin(a) * d * 1.1;
      if (band && r() < 0.45) { const u = (r() - 0.5) * 2 * R, v = (r() + r() + r() - 1.5) * R * 0.09, c = Math.cos(-0.5585), sn = Math.sin(-0.5585); x = u * c - v * sn; y = u * sn + v * c; }
      const m = Math.pow(r(), 3.4), rad = 0.35 + m * 1.6, op = 0.3 + m * 0.7, c = TINT[Math.floor(r() * TINT.length)];
      if (m > 0.6) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad * 4.5).toFixed(1)}" fill="url(#inHalo)" opacity="${(0.35 + m * 0.4).toFixed(2)}"/>`;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="${c}" opacity="${op.toFixed(2)}"/>`;
    }
    const W = Math.round(R * 2 + 20);
    return `<svg class="in-l ${cls}" viewBox="${-W / 2} ${-W / 2} ${W} ${W}" style="width:${W}px;height:${W}px;margin:${-W / 2}px 0 0 ${-W / 2}px">${s}</svg>`;
  }
  const NEB = '<ellipse cx="16" cy="16" rx="7.2" ry="5.6" transform="rotate(-24 16 16)" fill="none" stroke="url(#lgRing)" stroke-width="2.6"/><ellipse cx="16" cy="16" rx="3.9" ry="2.9" transform="rotate(-24 16 16)" fill="#4CCFBC" fill-opacity=".85"/>';
  const CORNERS = ['M5.5 11V7.5H9.5', 'M22.5 7.5h4V11', 'M26.5 21v3.5h-4', 'M9.5 24.5h-4V21'];
  const svg = (cls, body, extra = '') => `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true"${extra}>${body}</svg>`;
  const corner = (d, k) => svg(`in-c c${k + 1}`, `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`);
  let stars = null;
  /* il markup dell'intro (senza il riquadro che lo contiene): lo usano la schermata d'avvio e la guida */
  window.introHTML = function () {
    if (!stars) stars = layer('in-l1', 7, 900, 640, true) + layer('in-l2', 11, 520, 620) + layer('in-l3', 23, 520, 600);
    return `<div class="in-sky" aria-hidden="true"><svg width="0" height="0" style="position:absolute"><defs>
        <radialGradient id="inBand"><stop offset="0" stop-color="#B7C6E6" stop-opacity=".11"/><stop offset=".55" stop-color="#8295C4" stop-opacity=".045"/><stop offset="1" stop-color="#7C8FC0" stop-opacity="0"/></radialGradient>
        <radialGradient id="inHalo"><stop offset="0" stop-color="#E8EEFA" stop-opacity=".5"/><stop offset=".3" stop-color="#C9D6F2" stop-opacity=".14"/><stop offset="1" stop-color="#C9D6F2" stop-opacity="0"/></radialGradient>
        <filter id="inSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>
        <filter id="inGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter></defs></svg>${stars}</div>
      <div class="in-flash"></div>
      <div class="in-nebw">${svg('in-neb soft', `<g filter="url(#inSoft)">${NEB}</g>`)}${svg('in-neb sharp', NEB)}</div>
      <div class="in-frame">${svg('in-cg', `<path d="${CORNERS.join('')}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#inGlow)"/>`)}${CORNERS.map(corner).join('')}</div>
      ${svg('in-star', '<circle cx="16" cy="16" r="1" fill="#fff"/>')}`;
  };
  const el = document.getElementById('bootIntro');
  if (el) el.innerHTML = window.introHTML();

  /* l'app si carica solo dopo che l'intro è partita: leggere 1,3 MB di script tiene occupato il telefono per qualche
     secondo e, se succede prima, l'intro resta ferma e poi riparte a metà. Due fotogrammi disegnati bastano: da lì le
     animazioni le porta avanti la scheda grafica da sola. Gli script si eseguono nell'ordine della lista. */
  const APP = ['vendor/leaflet/leaflet.js', 'data/sky.js', 'data/dso.js', 'data/filters.js', 'i18n/en.js', 'js/i18n.js', 'js/version.js', 'js/lpatlas.js', 'js/mobile.js',
    'js/astro.js', 'js/model.js', 'js/dome.js', 'js/ui.js', 'js/views.js', 'js/weather.js', 'js/nights.js', 'js/skyview.js', 'js/scenarios.js', 'js/projects.js',
    'js/season.js', 'js/tonight.js', 'js/notify.js', 'js/tour.js', 'js/allsky.js', 'js/editor.js', 'js/main.js'];
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    for (const src of APP) { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); }
  };
  requestAnimationFrame(() => requestAnimationFrame(load)); setTimeout(load, 250); // (pagina nascosta: niente fotogrammi)

  /* uscita: finita l'intro (e pronta l'app) il logo vola al suo posto nella barra in alto, la schermata sparisce */
  window.introExit = function () {
    const b = document.getElementById('bootScreen'); if (!b) return Promise.resolve();
    // prove automatiche (smoke, schermate): niente attesa né volo
    const logo = b.querySelector('.intro'), still = !window.motionOn() || !!(window.cielo && window.cielo.noTour);
    // si aspetta la fine vera dell'intro (non un tempo fisso: su un telefono lento può essere partita tardi)
    const anims = still || !b.getAnimations ? [] : b.getAnimations({ subtree: true }).filter((a) => { const t = a.effect && a.effect.getComputedTiming(); return t && isFinite(t.endTime); });
    const ended = Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 4000))]);
    return new Promise((ok) => ended.then(() => {
      const to = document.querySelector('.brand .logo'), r1 = to && to.getBoundingClientRect(), r0 = logo.getBoundingClientRect();
      let fin = false; const done = () => { if (fin) return; fin = true; if (to) to.style.visibility = ''; b.remove(); ok(); };
      b.classList.add('leaving');
      if (still || !r1 || !r1.width || !logo.animate) { setTimeout(done, 450); return; }
      to.style.visibility = 'hidden';
      const dx = r1.left + r1.width / 2 - (r0.left + r0.width / 2), dy = r1.top + r1.height / 2 - (r0.top + r0.height / 2);
      logo.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${r1.width / r0.width})` }], { duration: 620, easing: 'cubic-bezier(.45, 0, .15, 1)', fill: 'forwards' }).finished.then(done, done);
      setTimeout(done, 1200); // pagina nascosta: le animazioni non vanno avanti
    }));
  };
})();
