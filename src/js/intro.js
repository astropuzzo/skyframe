/* Skyframe, l'avvio: le animazioni (preferenza), l'intro del logo e il caricamento dell'app.
   L'intro (campo stellare, zoom sul target, scatto della cornice) la disegna js/intro-draw.js su un canvas; l'app si
   carica quando è finita. Alla fine il canvas lascia il posto al logo vero (#i-logo), identico all'ultimo fotogramma,
   che vola al suo posto nella barra in alto quando l'app è pronta. */
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

  /* misure per il disegno: canvas e riquadro del logo (px CSS), densità dei pixel, da dove parte la cornice (D) */
  const params = (cv, box, D) => {
    const r = cv.getBoundingClientRect(), b = box.getBoundingClientRect();
    return { W: r.width, H: r.height, dpr: Math.min(window.devicePixelRatio || 1, 2), cx: b.left - r.left + b.width / 2, cy: b.top - r.top + b.height / 2, S: b.width, D };
  };
  const fit = (cv, P) => { cv.width = Math.round(P.W * P.dpr); cv.height = Math.round(P.H * P.dpr); };
  /* l'intro sul thread principale (guida, desktop): onT riceve il tempo di ogni fotogramma */
  window.introPlay = (cv, box, D, onT) => new Promise((res) => {
    const end = () => { box.classList.remove('playing'); cv.classList.add('gone'); res(); };
    if (!window.IntroDraw || !cv.getContext) { end(); return; }
    const P = params(cv, box, D); fit(cv, P); cv.classList.remove('gone'); box.classList.add('playing');
    const g = cv.getContext('2d'), F = IntroDraw.field(P), t0 = performance.now();
    const loop = () => {
      if (!cv.isConnected) { res(); return; }
      const t = performance.now() - t0; IntroDraw.frame(g, Math.min(t, IntroDraw.T), P, F); if (onT) onT(t);
      if (t < IntroDraw.T) requestAnimationFrame(loop); else end();
    };
    requestAnimationFrame(loop); setTimeout(() => { if (box.classList.contains('playing') && !cv.isConnected) res(); }, 3000);
  });

  /* l'app: gli script si eseguono nell'ordine della lista */
  const APP = ['vendor/leaflet/leaflet.js', 'data/sky.js', 'data/dso.js', 'data/filters.js', 'i18n/en.js', 'js/i18n.js', 'js/version.js', 'js/lpatlas.js', 'js/mobile.js',
    'js/astro.js', 'js/model.js', 'js/dome.js', 'js/ui.js', 'js/views.js', 'js/weather.js', 'js/nights.js', 'js/skyview.js', 'js/scenarios.js', 'js/projects.js',
    'js/season.js', 'js/tonight.js', 'js/notify.js', 'js/tour.js', 'js/allsky.js', 'js/editor.js', 'js/main.js'];
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    for (const src of APP) { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); }
  };

  /* sul telefono lo schermo della WebView lo disegna il thread principale dell'app: mentre la pagina legge 1,3 MB di
     script e calcola il cielo non si aggiorna niente (filmato sull'emulatore: 4,5 s di fotogrammi saltati), nemmeno un
     canvas disegnato da un worker. Quindi prima l'intro, a thread libero, poi l'app, col logo fermo e il messaggio. */
  const cv = document.getElementById('bootCv'), box = document.getElementById('bootIntro');
  let doneRes; window.__introDone = new Promise((r) => (doneRes = r));
  const finish = () => { if (box) box.classList.remove('playing'); if (cv) cv.classList.add('gone'); doneRes(); };
  const still = !window.motionOn() || !cv || !box || !!(window.cielo && window.cielo.noTour);
  if (still) { finish(); load(); }
  else {
    box.classList.add('playing');
    // il carico parte a scambio finito (canvas → logo vero): durante il carico lo schermo resta fermo
    window.introPlay(cv, box, 150).then(() => { finish(); setTimeout(load, 300); });
    setTimeout(load, 2900); // (pagina nascosta: niente fotogrammi)
  }

  /* uscita: finita l'intro (e pronta l'app) il logo vola al suo posto nella barra in alto, la schermata sparisce */
  window.introExit = function () {
    const b = document.getElementById('bootScreen'); if (!b) return Promise.resolve();
    const logo = b.querySelector('.intro');
    const ended = Promise.race([window.__introDone.then(() => new Promise((r) => setTimeout(r, still ? 0 : 280))), new Promise((r) => setTimeout(r, 4500))]);
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
