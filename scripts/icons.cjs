/* Icone dell'app da build/icon.svg, disegnate da Chromium (Electron, già tra le dipendenze): npx electron scripts/icons.cjs
   - build/icon.png (1024): electron-builder ne ricava .ico, .icns e le icone Linux
   - src/favicon.png: finestra del browser
   - Android: icona classica, tonda, adattiva (fondo e primo piano separati, il disegno nella zona sicura di 72 dp su 108),
     monocromatica (icone a tema di Android 13), avvisi e schermata di avvio.
   L'SVG ha i livelli con id: sky, glow, ground (fondo) e fg (nebulosa, stelle e cornice). */
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), RES = path.join(ROOT, 'android/app/src/main/res');
const SVG = fs.readFileSync(path.join(ROOT, 'build/icon.svg'), 'utf8');

const hide = (svg, ids) => svg.replace('</defs>', `</defs><style>${ids.map((i) => '#' + i).join(',')}{display:none}</style>`);
const noClip = (svg) => svg.replace('clip-path="url(#sq)"', '');
const round = (svg) => svg.replace(/<clipPath id="sq">.*?<\/clipPath>/, '<clipPath id="sq"><circle cx="512" cy="512" r="512"/></clipPath>');
const V = {
  full: SVG,
  round: round(SVG),
  bg: noClip(hide(SVG, ['fg'])),
  fg: noClip(hide(SVG, ['sky', 'glow', 'ground'])),
};

/* disegna la variante nel riquadro (x, y, s) di una tela w×h, con un fondo pieno facoltativo */
async function png(win, svg, w, h, box, bg) {
  const url = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const data = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image(); img.src = ${JSON.stringify(url)}; await img.decode();
    const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h};
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    ${bg ? `x.fillStyle = ${JSON.stringify(bg)}; x.fillRect(0, 0, ${w}, ${h});` : ''}
    x.drawImage(img, ${box.x}, ${box.y}, ${box.s}, ${box.s});
    return c.toDataURL('image/png');
  })()`);
  return Buffer.from(data.split(',')[1], 'base64');
}
const put = (rel, buf) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); console.log(rel, buf.length); };

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<body></body>');
  const sq = (s) => ({ x: 0, y: 0, s });
  put('build/icon.png', await png(win, V.full, 1024, 1024, sq(1024)));
  put('src/favicon.png', await png(win, V.full, 256, 256, sq(256)));
  const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(D)) {
    const L = Math.round(48 * k), A = Math.round(108 * k), inner = { x: 18 * k, y: 18 * k, s: 72 * k };
    put(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, await png(win, V.full, L, L, sq(L)));
    put(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, await png(win, V.round, L, L, sq(L)));
    put(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, await png(win, V.fg, A, A, inner));
    put(`android/app/src/main/res/mipmap-${d}/ic_launcher_background.png`, await png(win, V.bg, A, A, inner));
  }
  // schermata di avvio (Android fino all'11; dal 12 il sistema mostra l'icona adattiva): il disegno al centro sul nero
  for (const dir of fs.readdirSync(RES).filter((x) => /^drawable/.test(x))) {
    const f = path.join(RES, dir, 'splash.png'); if (!fs.existsSync(f)) continue;
    const b = fs.readFileSync(f), w = b.readUInt32BE(16), h = b.readUInt32BE(20), s = Math.round(Math.min(w, h) * 0.62);
    put(`android/app/src/main/res/${dir}/splash.png`, await png(win, V.fg, w, h, { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), s }, '#05070C'));
  }
  app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
