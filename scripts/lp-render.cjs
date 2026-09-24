// Disegna in PNG la luminosità del cielo per direzione stimata per un luogo, per confrontarla con mappe all-sky reali.
//   node scripts/lp-render.cjs <lat> <lon> <file.png> [sqm_zenit]
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const { lookup, fAt } = require('../lpatlas');

function png(file, w, h, rgba) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const RAMP = [[0, [10, 14, 34]], [0.22, [38, 52, 128]], [0.45, [108, 70, 170]], [0.65, [196, 92, 160]], [0.82, [236, 150, 120]], [1, [255, 236, 206]]];
const col = (t) => { for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) { const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i], f = (t - t0) / (t1 - t0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * f)); } return RAMP[5][1]; };

(async () => {
  const [lat, lon] = [+process.argv[2], +process.argv[3]], out = process.argv[4];
  const r = await lookup(lat, lon, path.join(process.env.TEMP || '/tmp', 'lpcache'));
  const sqm = +process.argv[5] || r.sqm, art0 = Math.pow(10, -0.4 * sqm) - Math.pow(10, -0.4 * 22);
  const mag = (h, az) => -2.5 * Math.log10(art0 * fAt(r.lpGrid, h, az) + Math.pow(10, -0.4 * 22) * (1 + 0.9 * Math.exp(-h / 14)));
  let lo = 99, hi = -99, best = null, dark = null;
  for (let h = 3; h <= 90; h++) for (let az = 0; az < 360; az += 3) { const m = mag(h, az); if (m < lo) { lo = m; best = [h, az]; } if (m > hi) { hi = m; dark = [h, az]; } }
  const S = 400, R = S / 2, buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = R - x, dy = R - y, rr = Math.hypot(dx, dy) / R * 90, h = 90 - rr, k = (y * S + x) * 4; if (h < 0) continue;
    const az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, c = col(Math.min(1, Math.max(0, (hi - mag(h, az)) / (hi - lo))));
    buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]; buf[k + 3] = 255;
  }
  png(out, S, S, buf);
  console.log(`zenit ${mag(90, 0).toFixed(2)} | più brillante ${lo.toFixed(2)} a ${best[0]}° az ${best[1]} | più buio ${hi.toFixed(2)} a ${dark[0]}° az ${dark[1]} | fonte ${r.src} SQM atlante ${r.sqm}`);
})();
