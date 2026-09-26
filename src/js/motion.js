'use strict';
/* ============================ movimento ============================
   Una sola fisica per tutta l'app: molle. Ogni molla (rigidità k, smorzamento c, massa 1) si simula una volta e diventa
   una curva CSS linear(): le animazioni vanno con Web Animations sul compositore, fluide anche su un telefono lento, e
   si possono interrompere e riprendere da dove sono. Con le animazioni ridotte tutto arriva subito alla fine.
     snap  critica, senza rimbalzo: spostamenti e indicatori (99,5% in 0,4 s)
     glide come snap ma più rapida (0,35 s): il faro della guida
     soft  un filo di rimbalzo (≈3%): fogli, dettaglio, schede
     pop   rimbalzo visibile (≈20%): piccoli elementi appena toccati
   Le stesse molle, come variabili CSS (--sp-snap e --sd-snap: curva e durata), servono alle transizioni del foglio di stile. */
const SPRINGS = { snap: [320, 36], glide: [420, 41], soft: [200, 21], pop: [440, 17] };
const Motion = (() => {
  const cache = {}, lin = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)');
  const FALLBACK = { snap: 'cubic-bezier(.2, .9, .25, 1)', soft: 'cubic-bezier(.3, 1.15, .45, 1)', pop: 'cubic-bezier(.34, 1.56, .64, 1)' };
  // la molla da 0 a 1, con velocità iniziale v0 (distanze al secondo), campionata a 60 Hz fino a fermarsi entro lo 0,2%
  function curve(k, c, v0 = 0) {
    const dt = 1 / 240, out = [0]; let x = 0, v = v0, t = 0, n = 0;
    while (t < 2.5) {
      const a = k * (1 - x) - c * v; v += a * dt; x += v * dt; t += dt; n++;
      if (n % 4 === 0) out.push(x);
      if (t > 0.08 && Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.05) break;
    }
    out.push(1);
    return { points: out, easing: `linear(${out.map((p) => +p.toFixed(4)).join(', ')})`, duration: Math.round(((out.length - 1) * 1000) / 60) };
  }
  function spring(name = 'snap', v0 = 0) {
    const [k, c] = SPRINGS[name] || SPRINGS.snap;
    const s = v0 ? curve(k, c, v0) : cache[name] || (cache[name] = curve(k, c));
    return lin ? s : { ...s, easing: FALLBACK[name] || FALLBACK.snap, duration: Math.min(s.duration, 520) };
  }
  const on = () => (window.motionOn ? window.motionOn() : true);
  /* anima un elemento con una molla: frames come in Element.animate; o.v0 velocità iniziale, o.delay, o.fill */
  function animate(el, frames, name = 'snap', o = {}) {
    if (!el || !el.animate) return null;
    const sp = spring(name, o.v0 || 0);
    const a = el.animate(frames, { duration: o.duration || sp.duration, easing: sp.easing, delay: o.delay || 0, fill: o.fill || 'none' });
    if (!on()) a.finish();
    return a;
  }
  /* FLIP: l'elemento è già al suo posto; parte dal rettangolo "from" (posizione e dimensione) e ci arriva con la molla */
  function flipFrom(el, from, name = 'snap', o = {}) {
    if (!el || !from) return null;
    const to = el.getBoundingClientRect(); if (!to.width || !to.height) return null;
    const dx = from.left - to.left, dy = from.top - to.top, sx = from.width / to.width, sy = o.keepAspect ? from.width / to.width : from.height / to.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return null;
    return animate(el, [{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }], name, o);
  }
  /* molla numerica per il thread principale (oggetti che seguono un bersaglio che si muove, come il faro della guida) */
  function follower(n, name = 'snap') {
    const [k, c] = SPRINGS[name] || SPRINGS.snap, x = new Float64Array(n), v = new Float64Array(n); let init = false;
    return {
      x,
      set(to) { for (let i = 0; i < n; i++) { x[i] = to[i]; v[i] = 0; } init = true; },
      step(to, dt) {
        if (!init || !on()) { this.set(to); return true; }
        const h = Math.min(dt, 0.05) / 4; let still = true;
        for (let s = 0; s < 4; s++) for (let i = 0; i < n; i++) { const a = k * (to[i] - x[i]) - c * v[i]; v[i] += a * h; x[i] += v[i] * h; }
        for (let i = 0; i < n; i++) if (Math.abs(to[i] - x[i]) > 0.3 || Math.abs(v[i]) > 3) still = false;
        if (still) this.set(to);
        return still;
      },
    };
  }
  // le molle anche per il CSS
  const root = document.documentElement.style;
  for (const k of Object.keys(SPRINGS)) { const s = spring(k); root.setProperty('--sp-' + k, s.easing); root.setProperty('--sd-' + k, s.duration + 'ms'); }
  return { spring, animate, flipFrom, follower, on };
})();
