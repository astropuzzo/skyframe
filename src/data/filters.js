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
  // Antlia non pubblica le bande in numeri: «semi-narrowband» a banda larga per ottiche fino a f/2, senza banda blu.
  { id: 'aquad', brand: 'Antlia', name: 'Quad Band', for: 'osc', kind: 'lp', bands: [[481, 508, 0.92], [650, 678, 0.92]], approx: true, src: 'https://shop.antliafilter.com/products/antlia-quad-band-anti-light-pollution-filter-2-mounted', note: 'Hβ, OIII, Hα, NII, SII al 92% (Antlia); bande ~27 nm stimate' },
  // Astronomik dichiara 465–530 nm e «sopra 645 nm» (Hβ 94%, OIII 95%, Hα 94%): il limite rosso a 700 nm è stimato
  { id: 'uhce', brand: 'Astronomik', name: 'UHC-E', for: 'osc', kind: 'lp', bands: [[465, 530, 0.94], [645, 700, 0.94]], approx: true, src: 'https://www.astronomik.com/en/Visual-Filters/UHC-E/', note: 'Hβ 94%, OIII 95%, Hα 94%; limite rosso stimato' },
  // Optolong dichiara le righe trasmesse al 95% (Hβ, OIII, NII, Hα, SII), non le bande in numeri: bande stimate attorno alle righe
  { id: 'ouhc', brand: 'Optolong', name: 'UHC', for: 'osc', kind: 'lp', bands: [[484, 506, 0.95], [649, 676, 0.95]], approx: true, src: 'https://www.optolong.com/cms/document/detail/id/73.html', note: 'Hβ, OIII, NII, Hα, SII al 95%; ampiezze stimate' },
  // Baader: circa 100 nm di banda in tutto fra 400 e 700 nm, Hα oltre il 99%; la divisione fra le due bande è stimata
  { id: 'buhcs', brand: 'Baader', name: 'UHC-S', for: 'osc', kind: 'lp', bands: [[470, 530, 0.97], [640, 680, 0.97]], approx: true, src: 'http://www.company7.com/baader/options/uhc-s.html', note: '~100 nm in tutto; bande stimate' },
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
  { id: 'triad', brand: 'Radian', name: 'Triad Ultra', for: 'osc', kind: 'multi', bands: [[483.6, 488.6, 0.79], [498.7, 502.7, 0.97], [654.3, 658.3, 0.87], [670.4, 674.4, 0.9]], src: 'https://optcorp.com/products/radian-telescopes-2-inch-triad-ultra-filter', note: 'quattro bande: Hβ 5 nm, OIII, Hα e SII 4 nm' },
  { id: 'lpara', brand: 'Optolong', name: 'L-Para', for: 'osc', kind: 'multi', bands: [[495.7, 505.7, 0.85], [651.3, 661.3, 0.85]], src: 'https://agenaastro.com/optolong-l-para-dual-band-oiii-10nm-h-a-10nm-filter-2-mounted.html', note: 'Hα 10 nm + OIII 10 nm, ≥85% fino a f/2' },
  { id: 'alpt3', brand: 'Antlia', name: 'ALP-T 3 nm', for: 'both', kind: 'multi', bands: [[499.2, 502.2, 0.85], [654.8, 657.8, 0.88]], approx: true, src: 'https://starizona.com/collections/antlia', note: 'Hα 3 nm + OIII 3 nm; trasmissione come la versione 5 nm' },
  { id: 'nbz', brand: 'IDAS', name: 'NBZ', for: 'osc', kind: 'multi', bands: [[495.7, 505.7, 0.9], [651.3, 661.3, 0.9]], src: 'https://optcorp.com/products/idas-nbz-nebula-booster-filter-52mm', note: 'Hα 10 nm + OIII 10 nm' },
  { id: 'askarc1', brand: 'Askar', name: 'ColorMagic C1', for: 'osc', kind: 'multi', bands: [[483.2, 518.2, 0.9], [649.1, 664.1, 0.9]], src: 'https://www.highpointscientific.com/askar-c1-colourmagic-2-duo-band-filter-ha-and-oiii', note: 'Hα 15 nm + OIII 35 nm' },
  { id: 'askarc2', brand: 'Askar', name: 'ColorMagic C2', for: 'osc', kind: 'multi', bands: [[483.2, 518.2, 0.9], [664.5, 679.5, 0.9]], src: 'https://www.highpointscientific.com/colour-magic-c-2-duo-band-filter-package', note: 'SII 15 nm + OIII 35 nm' },
  { id: 'sv220', brand: 'SVBony', name: 'SV220 7 nm', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [652.8, 659.8, 0.94]], src: 'https://www.svbony.com/products/sv220-dual-band-7nm-nebula-filter', note: 'Hα 7 nm (94%) + OIII 7 nm (90%)' },
  { id: 'sv220-3', brand: 'SVBony', name: 'SV220 3 nm', for: 'osc', kind: 'multi', bands: [[499.2, 502.2, 0.85], [654.8, 657.8, 0.88]], approx: true, src: 'https://www.svbony.com/blog/review-of-svbony-sv220-3nm-filter', note: 'Hα 3 nm + OIII 3 nm; trasmissione stimata' },
  { id: 'sv220s', brand: 'SVBony', name: 'SV220 SII+OIII 7 nm', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [668.9, 675.9, 0.9]], approx: true, src: 'https://www.svbony.com/products/7nm-oiii-sii-narrowband-filter', note: 'SII 7 nm + OIII 7 nm; trasmissione stimata' },
  { id: 'altair4', brand: 'Altair', name: 'DualBand Ultra 4 nm Hα+OIII', for: 'osc', kind: 'multi', bands: [[498.7, 502.7, 0.89], [654.3, 658.3, 0.92]], src: 'https://altairastro.com/altair-ha-oiii-dualband-ultra-4nm-certified-cmos-filter-2x22-w-test-report-11468-p.asp', note: 'Hα 4 nm (90–94%) + OIII 4 nm (88–91%)' },
  { id: 'altair4s', brand: 'Altair', name: 'DualBand Ultra 4 nm SII+OIII', for: 'osc', kind: 'multi', bands: [[498.7, 502.7, 0.89], [670.4, 674.4, 0.9]], approx: true, src: 'https://altairastro.com/altair-sii-oiii--dualband-ultra-4nm-certified-cmos-filter-2x22-w-test-report-13147-p.asp', note: 'SII 4 nm + OIII 4 nm' },
  { id: 'altair6s', brand: 'Altair', name: 'DualBand Ultra 6 nm SII+OIII', for: 'osc', kind: 'multi', bands: [[497.7, 503.7, 0.9], [669.4, 675.4, 0.9]], approx: true, src: '', note: 'SII 6 nm + OIII 6 nm dal nome del prodotto; trasmissione stimata' },
  { id: 'askare2', brand: 'Askar', name: 'ColorMagic E2', for: 'osc', kind: 'multi', bands: [[498.85, 502.55, 0.85], [670, 674, 0.85]], src: 'https://www.firstlightoptics.com/narrowband/askar-colour-magic-e2-2-dual-narrow-band-filter-siioiii.html', note: 'SII 4 nm + OIII 3,7 nm, oltre l’85%' },
  // Antlia non pubblica la trasmissione di questa versione: come la ALP-T 5 nm Hα+OIII
  { id: 'alpt3s', brand: 'Antlia', name: 'ALP-T 3 nm SII+OIII', for: 'osc', kind: 'multi', bands: [[499.2, 502.2, 0.85], [670.9, 673.9, 0.85]], approx: true, src: 'https://starizona.com/collections/antlia', note: 'SII 3 nm + OIII 3 nm; trasmissione stimata come la ALP-T 3 nm Hα+OIII' },
  { id: 'alptsh', brand: 'Antlia', name: 'ALP-T 5 nm SII+Hβ', for: 'osc', kind: 'multi', bands: [[483.6, 488.6, 0.85], [669.9, 674.9, 0.85]], approx: true, src: 'https://shop.antliafilter.com/products/antlia-alp-t-dual-band-5nm-sii-h-beta-filter-2-inch-mounted', note: 'Hβ 5 nm + SII 5 nm; trasmissione stimata' },
  // SVBony dichiara le ampiezze (Hα 24 nm, Hβ+OIII 20 nm) e la trasmissione alle righe (Hβ 95%, OIII 85–92%, Hα 95%);
  // la finestra nel vicino infrarosso (830–870 nm) non è modellata
  { id: 'sv240', brand: 'SVBony', name: 'SV240', for: 'osc', kind: 'multi', bands: [[482, 502, 0.9], [644.3, 668.3, 0.95]], approx: true, src: 'https://www.svbony.com/products/sv240-multi-narrowband-filter', note: 'posizione delle bande stimata dalle ampiezze; infrarosso escluso' },
  // IDAS dichiara solo le ampiezze (NB1: ~20 nm e ~32 nm; NB3: ~21 nm e ~19 nm): bande centrate sulle righe
  { id: 'nb1', brand: 'IDAS', name: 'Nebula Booster NB1', for: 'osc', kind: 'multi', bands: [[483, 503, 0.9], [641, 671, 0.9]], approx: true, src: 'https://idas.uno/space/en/IDAS/nb1.htm', note: 'Hβ+OIII ~20 nm, Hα+NII ~32 nm; posizione e trasmissione stimate' },
  { id: 'nb3', brand: 'IDAS', name: 'Nebula Booster NB3', for: 'osc', kind: 'multi', bands: [[490, 511, 0.9], [662.5, 681.5, 0.9]], approx: true, src: 'https://cloudbreakoptics.com/products/nebula-booster-nb3', note: 'OIII ~21 nm, SII ~19 nm; posizione e trasmissione stimate' },
  { id: 'seestar', brand: 'ZWO', name: 'Seestar LP (integrato)', for: 'osc', kind: 'multi', bands: [[485.7, 515.7, 0.9], [646.3, 666.3, 0.9]], approx: true, src: 'https://www.seestar.com/blogs/tutorial/seestar-light-pollution-filter-guide', note: 'Hα 20 nm + OIII 30 nm, nei Seestar S50 e S30' },
  { id: 'duo7', brand: 'Generico', name: 'Dual-band 7 nm', for: 'osc', kind: 'multi', bands: [[497.2, 504.2, 0.9], [652.8, 659.8, 0.9]], src: '' },
  // ---------------- banda stretta singoli, anche per camere a colori (Hα e SII solo sui pixel rossi) ----------------
  { id: 'edge-SII', brand: 'Antlia', name: 'SII EDGE 4,5 nm', series: 'Antlia EDGE', for: 'both', kind: 'nb', ch: 'SII', bands: [[670.15, 674.65, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
  { id: 'sv227-OIII', brand: 'SVBony', name: 'OIII SV227 5 nm', series: 'SVBony SV227', for: 'both', kind: 'nb', ch: 'OIII', bands: [[498.2, 503.2, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
  { id: 'ant35-Ha', brand: 'Antlia', name: 'Hα 3,5 nm', series: 'Antlia 3,5 nm', for: 'both', kind: 'nb', ch: 'Ha', bands: [[654.55, 658.05, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
  { id: 'ant35-OIII', brand: 'Antlia', name: 'OIII 3,5 nm', series: 'Antlia 3,5 nm', for: 'both', kind: 'nb', ch: 'OIII', bands: [[498.95, 502.45, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
  { id: 'ant35-SII', brand: 'Antlia', name: 'SII 3,5 nm', series: 'Antlia 3,5 nm', for: 'both', kind: 'nb', ch: 'SII', bands: [[670.65, 674.15, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
  { id: 'sv227-SII', brand: 'SVBony', name: 'SII SV227 5 nm', series: 'SVBony SV227', for: 'both', kind: 'nb', ch: 'SII', bands: [[669.9, 674.9, 0.9]], approx: true, src: '', note: 'ampiezza dal nome del prodotto; trasmissione stimata' },
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
