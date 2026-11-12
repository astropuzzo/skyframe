'use strict';
/* Immagini delle survey. Il ritaglio pronto arriva dal servizio hips2fits del CDS; quando non risponde, l'immagine si
   compone qui dalle tessere HiPS (HEALPix) che altri server tengono in copia. */

/* i server delle tessere, per ogni survey; Pan-STARRS in copia esiste nei colori i-r-g */
const HIPS_SRC = {
  'CDS/P/DSS2/color': { max: 9, ext: 'jpg', cap: 24, urls: ['https://skies.esac.esa.int/DSSColor', 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color', 'https://stpubdata.s3.us-east-1.amazonaws.com/mast/skybackgrounds/DSSColor'] },
  'CDS/P/PanSTARRS/DR1/color-z-zg-g': { max: 11, ext: 'jpg', cap: 24, urls: ['https://stpubdata.s3.us-east-1.amazonaws.com/mast/skybackgrounds/PanSTARRS'] },
  // le tessere della NSNS sono PNG da 600 kB l'una: poche per immagine
  'simg.de/P/NSNS/DR0_1/tc8': { max: 5, ext: 'png', cap: 6, urls: ['https://www.simg.de/nebulae3/dr0_1/tc8'] },
  'simg.de/P/NSNS/DR0_1/halpha8': { max: 6, ext: 'png', cap: 6, urls: ['https://www.simg.de/nebulae3/dr0_1/halpha8'] },
};
const HIPS_TILE = 512;
const HIPS_ARCSEC0 = Math.sqrt(Math.PI / 3) * R2D * 3600 / HIPS_TILE; // secondi d'arco per pixel di tessera all'ordine 0

/* ---------- HEALPix, schema annidato ---------- */
const HPX_JR = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], HPX_JP = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];
const hpxSpread = (v) => { let r = 0; for (let i = 0; v >> i; i++) r += ((v >> i) & 1) * 4 ** i; return r; };
/* il pixel che contiene un punto del cielo (gradi) */
function hpxNest(order, ra, dec) {
  const ns = 2 ** order, z = Math.sin(dec * D2R), za = Math.abs(z), tt = (((ra / 90) % 4) + 4) % 4;
  let f, ix, iy;
  if (za <= 2 / 3) {
    const t1 = ns * (0.5 + tt), t2 = ns * z * 0.75, jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2), ifp = Math.floor(jp / ns), ifm = Math.floor(jm / ns);
    f = ifp === ifm ? (ifp | 4) : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (ns - 1); iy = ns - (jp & (ns - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt, tmp = ns * Math.sqrt(3 * (1 - za));
    const jp = Math.min(ns - 1, Math.floor(tp * tmp)), jm = Math.min(ns - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) { f = ntt; ix = ns - jm - 1; iy = ns - jp - 1; } else { f = ntt + 8; ix = jp; iy = jm; }
  }
  return f * ns * ns + hpxSpread(ix) + 2 * hpxSpread(iy);
}
/* un punto dentro un pixel: fx cresce verso nord-est, fy verso nord-ovest, da 0 a 1 → [ra, dec] */
function hpxLoc(order, n, fx, fy) {
  const ns = 2 ** order, f = Math.floor(n / (ns * ns)), p = n - f * ns * ns;
  let ix = 0, iy = 0;
  for (let i = 0; i < order; i++) { ix += (Math.floor(p / 4 ** i) & 1) << i; iy += (Math.floor(p / (2 * 4 ** i)) & 1) << i; }
  const x = (ix + fx) / ns, y = (iy + fy) / ns, jr = HPX_JR[f] - x - y;
  let nr, z;
  if (jr < 1) { nr = jr; z = 1 - nr * nr / 3; } else if (jr > 3) { nr = 4 - jr; z = nr * nr / 3 - 1; } else { nr = 1; z = (2 - jr) * 2 / 3; }
  let t = HPX_JP[f] * nr + x - y; if (t < 0) t += 8; if (t >= 8) t -= 8;
  return [nr < 1e-12 ? 0 : 45 * t / nr, Math.asin(clamp(z, -1, 1)) * R2D];
}

/* ---------- proiezione gnomonica attorno al centro dell'immagine ---------- */
/* [xi, eta] in radianti, xi verso est; null per i punti a più di 80° dal centro */
function tanXY(ra0, dec0, ra, dec) {
  const d = (ra - ra0) * D2R, s0 = Math.sin(dec0 * D2R), c0 = Math.cos(dec0 * D2R), s = Math.sin(dec * D2R), c = Math.cos(dec * D2R), cc = s0 * s + c0 * c * Math.cos(d);
  return cc < 0.17 ? null : [c * Math.sin(d) / cc, (c0 * s - s0 * c * Math.cos(d)) / cc];
}
function tanSky(ra0, dec0, xi, eta) {
  const s0 = Math.sin(dec0 * D2R), c0 = Math.cos(dec0 * D2R);
  return [norm360(ra0 + Math.atan2(xi, c0 - eta * s0) * R2D), Math.asin(clamp((s0 + eta * c0) / Math.sqrt(1 + xi * xi + eta * eta), -1, 1)) * R2D];
}

/* le tessere di un ordine che toccano l'immagine: il bordo campionato fitto, l'interno a griglia */
function hipsCover(order, ra0, dec0, fov, w, h) {
  const F = w / (fov * D2R), set = new Set();
  const at = (x, y) => { const s = tanSky(ra0, dec0, (w / 2 - x) / F, (h / 2 - y) / F); set.add(hpxNest(order, s[0], s[1])); };
  for (let x = 0; x <= w; x += 2) { at(x, 0); at(x, h); }
  for (let y = 0; y <= h; y += 2) { at(0, y); at(w, y); }
  for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) at(x, y);
  return [...set];
}
/* l'ordine più fine che serve (la tessera ingrandita al massimo una volta e mezza) senza superare il numero di tessere */
function hipsPlan(S, ra0, dec0, fov, w, h) {
  let order = clamp(Math.ceil(Math.log2(HIPS_ARCSEC0 / (fov * 3600 / w * 1.5))), 0, S.max), tiles = hipsCover(order, ra0, dec0, fov, w, h);
  while (tiles.length > S.cap && order > 0) tiles = hipsCover(--order, ra0, dec0, fov, w, h);
  return { order, tiles };
}
const hipsPath = (order, n, ext) => `/Norder${order}/Dir${Math.floor(n / 10000) * 10000}/Npix${n}.${ext}`;

/* ---------- disegno ---------- */
/* un triangolo dell'immagine della tessera portato su tre punti dello schermo; il ritaglio sborda di poco per non lasciare fessure */
function hipsTri(ctx, img, P, U) {
  const [x0, y0, x1, y1, x2, y2] = P, [u0, v0, u1, v1, u2, v2] = U, d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0); if (!d) return;
  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d, b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d;
  const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d, e = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d;
  const gx = (x0 + x1 + x2) / 3, gy = (y0 + y1 + y2) / 3, out = (x, y) => { const k = 0.75 / (Math.hypot(x - gx, y - gy) || 1); return [x + (x - gx) * k, y + (y - gy) * k]; };
  ctx.save(); ctx.beginPath(); ctx.moveTo(...out(x0, y0)); ctx.lineTo(...out(x1, y1)); ctx.lineTo(...out(x2, y2)); ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c, e, x0 - a * u0 - c * v0, y0 - b * u0 - e * v0); ctx.drawImage(img, 0, 0); ctx.restore();
}
/* Nell'immagine di una tessera il sud è in alto a sinistra e il nord in basso a destra: la colonna segue fy, la riga fx.
   img è la tessera con il suo pixel di bordo (hipsPad). */
function hipsDrawTile(ctx, img, order, n, proj) {
  const N = order < 2 ? 16 : order < 4 ? 8 : 4, S = img.width - 2, G = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const s = hpxLoc(order, n, i / N, j / N); G.push(proj(s[0], s[1])); }
  const uv = (i, j) => [j / N * S + 1, i / N * S + 1];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const A = G[i * (N + 1) + j], B = G[(i + 1) * (N + 1) + j], C = G[i * (N + 1) + j + 1], D = G[(i + 1) * (N + 1) + j + 1];
    if (!A || !B || !C || !D) continue;
    hipsTri(ctx, img, [...A, ...B, ...C], [...uv(i, j), ...uv(i + 1, j), ...uv(i, j + 1)]);
    hipsTri(ctx, img, [...B, ...D, ...C], [...uv(i + 1, j), ...uv(i + 1, j + 1), ...uv(i, j + 1)]);
  }
}

/* la tessera con un pixel di bordo in più per lato, perché tra due tessere vicine non resti una riga scura */
function hipsPad(im) {
  const S = im.naturalWidth, cv = document.createElement('canvas'); cv.width = cv.height = S + 2;
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0, S + 2, S + 2); g.drawImage(im, 1, 1);
  return cv;
}

/* ---------- caricamento ---------- */
const imgLoad = (url, ms, cors) => new Promise((res) => {
  const im = new Image(); let t = 0; const end = (ok) => { clearTimeout(t); im.onload = im.onerror = null; res(ok ? im : null); };
  if (cors) im.crossOrigin = 'anonymous';
  im.onload = () => end(im.naturalWidth > 0); im.onerror = () => end(false); t = setTimeout(() => { end(false); im.src = ''; }, ms); im.src = url;
});
const hipsTiles = new Map();
function hipsTile(id, S, order, n) {
  const key = id + '/' + order + '/' + n; let job = hipsTiles.get(key);
  if (job) { hipsTiles.delete(key); hipsTiles.set(key, job); return job; }
  job = (async () => {
    for (let k = S.urls.length; k--;) {
      const base = S.urls[0], im = await imgLoad(base + hipsPath(order, n, S.ext), 15000, true); if (im) return hipsPad(im);
      // un server che non dà la tessera passa in fondo alla lista
      if (S.urls.length > 1 && S.urls[0] === base) S.urls.push(S.urls.shift());
    }
    hipsTiles.delete(key); return null;
  })();
  hipsTiles.set(key, job);
  if (hipsTiles.size > 32) hipsTiles.delete(hipsTiles.keys().next().value);
  return job;
}
/* l'immagine composta dalle tessere, su un canvas; errore se nessuna tessera arriva */
async function hipsCompose(hips, ra0, dec0, fov, w, h) {
  const S = HIPS_SRC[hips]; if (!S) throw new Error('survey senza copie');
  const { order, tiles } = hipsPlan(S, ra0, dec0, fov, w, h), imgs = await Promise.all(tiles.map((n) => hipsTile(hips, S, order, n)));
  if (!imgs.some(Boolean)) throw new Error('nessuna tessera');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), F = w / (fov * D2R);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high';
  const proj = (ra, dec) => { const p = tanXY(ra0, dec0, ra, dec); return p && [w / 2 - p[0] * F, h / 2 - p[1] * F]; };
  tiles.forEach((n, i) => { if (imgs[i]) hipsDrawTile(ctx, imgs[i], order, n, proj); });
  return cv;
}

/* ---------- l'immagine da mostrare ---------- */
const hipsUrl = (hips, o, fov, w, h) => `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=${encodeURIComponent(hips)}&width=${w}&height=${h}&fov=${fov.toFixed(4)}&projection=TAN&coordsys=icrs&ra=${o.ra.toFixed(5)}&dec=${o.dec.toFixed(5)}&format=jpg`;
const SKY = { down: 0, jobs: new Map(), done: new Map(), args: new Map(), big: [] };
const SKY_RETRY = 600000; // dopo un mancato arrivo dal CDS, per dieci minuti si va diretti alle copie
const SKY_BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const skyDirect = () => Date.now() - SKY.down > SKY_RETRY;
/* un indirizzo che l'<img> può caricare: il ritaglio del CDS, oppure l'immagine composta dalle copie */
function skyUrl(hips, o, fov, w, h) {
  const direct = hipsUrl(hips, o, fov, w, h); let job = SKY.jobs.get(direct); if (job) return job;
  job = (async () => {
    if (skyDirect()) { if (await imgLoad(direct, 8000)) return direct; SKY.down = Date.now(); }
    const cv = await hipsCompose(hips, o.ra, o.dec, fov, w, h), blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) throw new Error('immagine non composta');
    const url = URL.createObjectURL(blob);
    if (w > 200) { SKY.big.push(direct); if (SKY.big.length > 24) { const old = SKY.big.shift(); URL.revokeObjectURL(SKY.done.get(old)); SKY.jobs.delete(old); SKY.done.delete(old); } }
    return url;
  })();
  SKY.jobs.set(direct, job); job.then((url) => SKY.done.set(direct, url), () => SKY.jobs.delete(direct));
  return job;
}
/* un ritaglio del CDS che non si carica più: la prossima richiesta va alle copie */
function skyDrop(direct) { SKY.down = Date.now(); SKY.jobs.delete(direct); SKY.done.delete(direct); }
/* per le miniature scritte nell'HTML: gli attributi src e data-sky; se il ritaglio non arriva, skyRescue mette la copia */
function skyAttrs(hips, o, fov, w, h) {
  const direct = hipsUrl(hips, o, fov, w, h), done = SKY.done.get(direct);
  if (done && done !== direct) return `src="${esc(done)}"`;
  // le miniature si compongono dalla DSS2: le tessere della NSNS pesano troppo per un'immagine così piccola
  SKY.args.set(direct, [w > 200 ? hips : 'CDS/P/DSS2/color', o, fov, w, h]);
  return `src="${esc(skyDirect() ? direct : SKY_BLANK)}" data-sky="${esc(direct)}"`;
}
function skyRescue(ev) {
  const im = ev.target, key = im && im.dataset && im.dataset.sky, args = key && SKY.args.get(key); if (!args || im.tagName !== 'IMG') return;
  const failed = ev.type === 'error' && im.getAttribute('src') === key;
  if (!failed && im.getAttribute('src') !== SKY_BLANK) return;
  if (failed) { skyDrop(key); skyDrop(hipsUrl(...args)); }
  delete im.dataset.sky;
  skyUrl(...args).then((url) => { SKY.done.set(key, url); im.src = url; }, () => {});
}
if (typeof document !== 'undefined') { document.addEventListener('error', skyRescue, true); document.addEventListener('load', skyRescue, true); }
