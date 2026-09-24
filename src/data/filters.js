// Database filtri. Bande = [da nm, a nm, trasmissione di picco] (modello a gradino sulla FWHM).
// "for": camera per cui ha senso (osc | mono | both). "approx": dato non pubblicato in forma numerica dal produttore.
// Fonti: pagine prodotto dei produttori o dei rivenditori ufficiali, grafici di trasmissione letti a mano (vedi "src").
window.FILTER_DB = [
  // ---------------- banda larga per OSC ----------------
  { id: 'uvir', brand: 'Generico', name: 'UV/IR cut', for: 'osc', kind: 'bb', bands: [[400, 690, 0.95]], src: '' },
  { id: 'poahuvir', brand: 'Player One', name: 'Anti-Halo UV/IR-Cut', for: 'osc', kind: 'bb', bands: [[400, 690, 0.95]], approx: true, src: 'https://player-one-astronomy.com/product/anti-halo-pro-dual-band-2-haoiii-filter/', note: 'banda standard UV/IR: taglio esatto non pubblicato in numeri' },
  { id: 'lpro', brand: 'Optolong', name: 'L-Pro', for: 'osc', kind: 'lp', bands: [[415, 427, 0.89], [451, 530, 0.96], [560, 568, 0.93], [601, 610, 0.93], [649, 706, 0.97]], src: 'https://www.optolong.com/cms/document/detail/id/13.html', note: 'bande lette dal grafico ufficiale' },
  { id: 'lqef', brand: 'Optolong', name: 'L-QEF (L-Quad Enhance)', for: 'osc', kind: 'lp', bands: [[383, 419, 0.92], [442, 528, 0.96], [561, 568, 0.93], [633, 709, 0.96]], src: 'https://optolong.com/cms/document/detail/id/286.html', note: 'bande lette dal grafico ufficiale' },
  // Antlia dichiara le righe trasmesse (Hα 656,3; SII 671,6/672,4; OIII 495,9/500,7; NII 654,8/658,3) e il picco del 92%,
  // non le bande in numeri: ampiezze ~25 nm da recensione, posizione della banda blu stimata.
  { id: 'triband', brand: 'Antlia', name: 'Triband RGB Ultra', for: 'osc', kind: 'lp', bands: [[446, 471, 0.92], [490, 515, 0.92], [650, 676, 0.92]], approx: true, src: 'https://www.cloudynights.com/articles/astro-gear-today/reviews/a-hybrid-light-pollution-filter-for-color-imaging-antlia-triband-rgb-ultra-review-r4632/', note: 'righe Hα, NII, SII, OIII, picco 92% (Antlia); bande ~25 nm stimate' },
  { id: 'triband2', brand: 'Antlia', name: 'Triband RGB Ultra II', for: 'osc', kind: 'lp', bands: [[446, 471, 0.92], [483, 508, 0.92], [650, 676, 0.92]], approx: true, src: 'https://starizona.com/products/antlia-triband-rgb-ultra-filter-2-mounted', note: 'come la prima versione più Hβ 486,1; bande ~25 nm stimate' },
  // ---------------- multibanda stretti per OSC ----------------
  { id: 'lextreme', brand: 'Optolong', name: 'L-eXtreme', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [652.8, 659.8, 0.9]], src: 'https://agenaastro.com/optolong-l-extreme-dual-bandpass-light-pollution-reduction-imaging-filter-2.html', note: 'Hα 7 nm + OIII 7 nm' },
  { id: 'lenhance', brand: 'Optolong', name: 'L-eNhance', for: 'osc', kind: 'multi', bands: [[484, 508, 0.9], [651.3, 661.3, 0.9]], src: 'https://ontariotelescope.com/blogs/news/navigating-optolong-filters-lenhance-lextreme-and-lultimate-for-astrophotography', note: 'Hβ+OIII 24 nm + Hα 10 nm' },
  { id: 'lultimate', brand: 'Optolong', name: 'L-Ultimate', for: 'osc', kind: 'multi', bands: [[499.2, 502.2, 0.9], [654.8, 657.8, 0.9]], src: 'https://agenaastro.com/optolong-l-ultimate-dual-bandpass-light-pollution-reduction-imaging-filter-1-25in.html', note: 'Hα 3 nm + OIII 3 nm' },
  { id: 'lsynergy', brand: 'Optolong', name: 'L-Synergy', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [668.9, 675.9, 0.9]], src: 'https://agenaastro.com/optolong-filters-l2-dual-combo-filter-set-l-extreme-l-synergy-filters-2-mounted.html', note: 'SII 7 nm + OIII 7 nm' },
  { id: 'alpt5', brand: 'Antlia', name: 'ALP-T 5 nm', for: 'both', kind: 'multi', bands: [[498.2, 503.2, 0.82], [653.8, 658.8, 0.88]], src: 'https://starizona.com/products/antlia-alp-t-high-speed-filter', note: 'Hα 88%, OIII 82%' },
  { id: 'askard1', brand: 'Askar', name: 'ColorMagic D1', for: 'osc', kind: 'multi', bands: [[497.45, 503.95, 0.85], [652.05, 660.55, 0.85]], src: 'https://www.highpointscientific.com/askar-color-magic-super-d1-duo-narrowband-filter-oiii-and-ha-2-inch', note: 'Hα 8,5 nm + OIII 6,5 nm' },
  { id: 'askard2', brand: 'Askar', name: 'ColorMagic D2', for: 'osc', kind: 'multi', bands: [[497.45, 503.95, 0.85], [667.75, 676.25, 0.85]], src: 'https://www.highpointscientific.com/askar-color-magic-super-d2-duo-narrowband-filter-oiii-and-sii-2-inch', note: 'SII 8,5 nm + OIII 6,5 nm' },
  { id: 'nbz2', brand: 'IDAS', name: 'NBZ-II', for: 'osc', kind: 'multi', bands: [[496.7, 504.7, 0.9], [651.3, 661.3, 0.9]], src: 'https://agenaastro.com/idas-nbz-ii-high-speed-imaging-filter-2-inch-mounted-m48.html', note: 'Hα 10 nm + OIII 8 nm' },
  { id: 'stcduo', brand: 'STC', name: 'Astro Duo-NB', for: 'osc', kind: 'multi', bands: [[495.7, 505.7, 0.85], [651.3, 661.3, 0.85]], approx: true, src: 'https://www.stcoptics.com/products/astro-duo-narrowband-duo-nb-filter', note: 'il produttore dichiara 7–12 nm: usati 10 nm' },
  { id: 'zwoduo', brand: 'ZWO', name: 'Duo-Band', for: 'osc', kind: 'multi', bands: [[483.2, 518.2, 0.9], [648.8, 663.8, 0.9]], src: 'https://agenaastro.com/zwo-duo-band-narrowband-light-pollution-reduction-imaging-filter-2.html', note: 'Hα 15 nm + OIII 35 nm' },
  { id: 'poahpro', brand: 'Player One', name: 'Anti-Halo PRO Dual-Band', for: 'osc', kind: 'multi', bands: [[499.1, 502.3, 0.85], [654.45, 658.15, 0.85]], src: 'https://player-one-astronomy.com/product/anti-halo-pro-dual-band-2-haoiii-filter/', note: 'Hα 3,7 nm + OIII 3,2 nm, ≥85%' },
  { id: 'duo7', brand: 'Generico', name: 'Dual-band 7 nm', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [652.8, 659.8, 0.9]], src: '' },
  // ---------------- banda larga per mono ----------------
  { id: 'L', brand: 'Generico', name: 'L', for: 'mono', kind: 'bb', ch: 'L', bands: [[400, 700, 0.97]], src: '' },
  { id: 'R', brand: 'Generico', name: 'R', for: 'mono', kind: 'bb', ch: 'R', bands: [[595, 700, 0.95]], src: '' },
  { id: 'G', brand: 'Generico', name: 'G', for: 'mono', kind: 'bb', ch: 'G', bands: [[500, 575, 0.95]], src: '' },
  { id: 'B', brand: 'Generico', name: 'B', for: 'mono', kind: 'bb', ch: 'B', bands: [[400, 500, 0.95]], src: '' },
  // ---------------- banda stretta per mono ----------------
  ...nbSet('bd65', 'Baader', 'CMOS 6,5 nm', { Ha: 6.5, OIII: 6.5, SII: 6.5 }, 0.9, 'https://www.highpointscientific.com/baader-6-5nm-narrowband-2-inch-cmos-optimized-filter-set-ha-oiii-sii-fcsetn-2'),
  ...nbSet('bdunb', 'Baader', 'Ultra-Narrowband 3,5/4 nm', { Ha: 3.5, OIII: 4, SII: 4 }, 0.9, 'https://www.baader-planetarium.com/en/baader-3.5--4nm-ultra-narrowband-filter-set-%E2%80%93-cmos-optimized-(h-alpha--o-iii--s-ii).html'),
  ...nbSet('ast6', 'Astronomik', '6 nm', { Ha: 6, OIII: 6, SII: 6 }, { Ha: 0.96, OIII: 0.93, SII: 0.94 }, 'https://www.astronomik.com/en/Narrowband-Filters/'),
  ...nbSet('ast12', 'Astronomik', '12 nm', { Ha: 12, OIII: 12, SII: 12 }, { Ha: 0.96, OIII: 0.93, SII: 0.94 }, 'https://www.astronomik.com/en/Narrowband-Filters/'),
  ...nbSet('chr3', 'Chroma', '3 nm', { Ha: 3, OIII: 3, SII: 3 }, 0.9, 'https://www.chroma.com/products/filters/astronomy/narrowband/'),
  ...nbSet('chr5', 'Chroma', '5 nm', { Ha: 5, OIII: 5, SII: 5 }, 0.9, 'https://www.chroma.com/products/filters/astronomy/narrowband/'),
  ...nbSet('ant3', 'Antlia', '3 nm Pro', { Ha: 3, OIII: 3, SII: 3 }, 0.9, 'https://starizona.com/collections/antlia'),
  ...nbSet('opt7', 'Optolong', '7 nm', { Ha: 7, OIII: 6.5, SII: 6.5 }, 0.9, 'https://www.optolong.com/'),
  ...nbSet('opt3', 'Optolong', '3 nm', { Ha: 3, OIII: 3, SII: 3 }, 0.9, 'https://www.optolong.com/'),
  ...nbSet('zwo7', 'ZWO', '7 nm', { Ha: 7, OIII: 7, SII: 7 }, 0.9, 'https://www.zwoastro.com/'),
];
function nbSet(prefix, brand, series, fwhm, T, src) {
  const C = { Ha: 656.3, OIII: 500.7, SII: 672.4 }, lab = { Ha: 'Hα', OIII: 'OIII', SII: 'SII' };
  return Object.keys(C).map((k) => {
    const t = typeof T === 'number' ? T : T[k];
    return { id: `${prefix}-${k}`, brand, name: `${lab[k]} ${series}`, series: `${brand} ${series}`, for: 'mono', kind: 'nb', ch: k, bands: [[C[k] - fwhm[k] / 2, C[k] + fwhm[k] / 2, t]], src };
  });
}
