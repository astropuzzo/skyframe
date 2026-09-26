/* Skyframe, l'intro dell'avvio disegnata fuori dal thread principale: mentre la pagina legge gli script dell'app e
   calcola il cielo, qui i fotogrammi continuano ad arrivare allo schermo. Riceve il canvas (OffscreenCanvas) e le misure. */
importScripts('intro-draw.js');
onmessage = (e) => {
  const { canvas, ...P } = e.data, g = canvas.getContext('2d'), F = IntroDraw.field(P), t0 = performance.now();
  const next = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(f, 16);
  const loop = () => {
    const t = performance.now() - t0;
    IntroDraw.frame(g, Math.min(t, IntroDraw.T), P, F);
    if (t < IntroDraw.T) next(loop); else postMessage('done');
  };
  next(loop);
};
