// Attrezzatura come la scrive AstroBin → dati per il modello. Serve a scripts/astrobin-dataset.cjs (taratura).
//   scopeOf(nome)  → { ap, fl, obs } mm, mm, % del diametro (null se sconosciuto)
//   camOf(nome)    → { pix, w, h, qe, rn, type: osc | dslr | dslrmod | mono }
//   filterOf(nome) → id di src/data/filters.js, 'none' (nessun filtro), null (sconosciuto o non adatto a una camera a colori)
// Le regole vanno dalla più specifica alla più generale: vince la prima che combacia.

// [regola, apertura, focale nativa, ostruzione %]
const SCOPES = [
  // telescopi intelligenti (camera e filtro integrati)
  [/Seestar S30 Pro/i, 30, 160, 0], [/Seestar S30/i, 30, 150, 0], [/Seestar S50/i, 50, 250, 0], [/Celestron Origin/i, 152, 335, 45],
  [/Dwarf ?(III|3)/i, 35, 150, 0], [/Dwarf ?(II|2)/i, 24, 100, 0], [/Vespera/i, 50, 250, 0],
  // Schmidt-Cassegrain, RASA, Dall-Kirkham, RC
  [/RASA 8/i, 203, 400, 45], [/RASA 11/i, 279, 620, 41], [/RASA 36|RASA 14/i, 356, 790, 40],
  [/EdgeHD 9\.25/i, 235, 2350, 36], [/EdgeHD 11/i, 280, 2800, 34], [/EdgeHD 14/i, 356, 3910, 32], [/EdgeHD 8/i, 203, 2032, 34],
  [/C9\.25/i, 235, 2350, 36], [/\bC11\b|CPC 1100/i, 280, 2800, 34], [/\bC14\b/i, 356, 3910, 32],
  [/\bC8\b|NexStar 8SE|NexStar Evolution 8|AVX 8|EdgeHD 800/i, 203, 2032, 34], [/\bC6\b|NexStar Evolution 6|NexStar 6SE/i, 150, 1500, 35],
  [/LX200.*12|12".*ACF|ACF.*12"/i, 305, 3048, 37], [/LX200.*10|10".*LX200/i, 254, 2500, 35], [/LX10 8"|Meade.*8" SCT/i, 203, 2000, 34],
  [/Vixen VC200L/i, 200, 1800, 38], [/Meade LXD75 SN10|SN-?10/i, 254, 1000, 30],
  [/10" f\/8 Ritchey|RC ?10|10" RC/i, 254, 2000, 47], [/8" f\/8 Ritchey|RC ?8|8" .*Ritchey|8".*RC\b|203\/1624/i, 203, 1624, 47], [/6" f\/9 Ritchey|RC ?6|6" RC/i, 152, 1370, 47],
  [/CDK ?12/i, 318, 2541, 49], [/CDK ?17/i, 432, 2939, 45],
  [/Epsilon-130/i, 130, 430, 48], [/Epsilon-160/i, 160, 530, 44], [/Epsilon-180/i, 180, 500, 35],
  [/Hypergraph 6/i, 152, 547, 45], [/Hypergraph 8/i, 203, 690, 43], [/Hypergraph 10/i, 254, 864, 40],
  // Newton e Maksutov-Newton
  [/Quattro 150/i, 150, 600, 42], [/Quattro 200/i, 200, 800, 35], [/Quattro 250/i, 254, 1000, 32], [/Quattro 300/i, 305, 1200, 33],
  [/190MN|190\/1000.*Maksutov/i, 190, 1000, 25],
  [/Black Diamond 250\/1200|Explorer 250PDS|250PDS/i, 254, 1200, 25], [/Black Diamond 200\/1000|Explorer 200PDS|200PDS|Explorer 200P\b/i, 200, 1000, 25],
  [/Black Diamond 150\/750|Explorer 150PDS|150PDS|Explorer 150P\b/i, 150, 750, 30], [/130PDS|NexStar 130SLT/i, 130, 650, 36],
  [/Omegon Pro Astrograph Carbon 150\/500/i, 150, 500, 38], [/Orion 8" f\/3\.9/i, 203, 800, 38],
  [/PHOTON 200.*f\/6/i, 200, 1200, 22], [/PHOTON 150.*f\/5/i, 150, 750, 30], [/PHOTON 150.*f\/4/i, 150, 600, 35],
  [/(ONTC|UNC).*250mm.*f\/4|250mm\/10" UNC f\/4/i, 254, 1016, 35], [/200mm\/8" UNC f\/5/i, 203, 1015, 30], [/200mm\/8" ONTC f\/4/i, 203, 812, 35], [/150mm\/6" ONTC f\/4/i, 150, 600, 35],
  [/Watt 8"/i, 203, 812, 35], [/CarbonStar 200/i, 200, 800, 35], [/GSO 8' f\/4|GSO 8" f\/4/i, 203, 800, 35], [/Lacerta 10" f\/4/i, 254, 1000, 33],
  [/Fotonewton 200\/800|Photonewton 200\/800/i, 200, 800, 35], [/Bresser Messier NT-203s\/800/i, 203, 800, 33], [/Bresser Messier NT-130\/1000/i, 130, 1000, 30],
  [/GSO 6" f\/5/i, 150, 750, 30], [/GSO 6" f\/6/i, 150, 900, 25], [/SPX 300 F\/4|VX12/i, 300, 1200, 28], [/SPX 200 F\/6/i, 200, 1200, 22],
  [/Tecnosky Newton 300\/1200/i, 300, 1200, 28], [/XT12g/i, 305, 1500, 23], [/13\.1" F\/4\.5/i, 333, 1500, 25], [/D\.250 - F\/D 4,5/i, 250, 1125, 25],
  // rifrattori
  [/Fluorostar 132|FLT ?132/i, 132, 925, 0], [/Fluorostar 120|FLT ?120/i, 120, 840, 0], [/Fluorostar 91|FLT ?91/i, 91, 540, 0],
  [/Pleiades 111/i, 111, 540, 0], [/Pleiades 68/i, 68, 250, 0], [/Ultra-Cat 108/i, 108, 540, 0], [/RedCat 91/i, 91, 498, 0], [/Mighty-Cat 71|RedCat 71/i, 71, 350, 0],
  [/RedCat 61|Redcat 61|SpaceCat 61/i, 61, 300, 0], [/RedCat 51|Redcat 51|Cat 51|MiniCat 51|SpaceCat 51/i, 51, 250, 0],
  [/ZenithStar 61|ZS61/i, 61, 360, 0], [/ZenithStar 73|ZS73/i, 73, 430, 0], [/ZenithStar 81|ZS81/i, 81, 559, 0], [/Gran Turismo 81|GT81/i, 81, 478, 0], [/Gran Turismo 102|GT102/i, 102, 703, 0],
  [/Askar 140APO/i, 140, 980, 0], [/Askar 120APO/i, 120, 840, 0], [/Askar 103APO/i, 103, 700, 0], [/Askar 107PHQ/i, 107, 749, 0], [/Askar 80PHQ/i, 80, 600, 0], [/Askar 71F/i, 71, 490, 0],
  [/Askar 91F/i, 91, 500, 0], [/Askar 111F/i, 111, 600, 0], [/FRA600/i, 108, 600, 0], [/FRA500/i, 90, 500, 0], [/FRA400/i, 72, 400, 0], [/FRA300/i, 60, 300, 0],
  [/SQA55/i, 55, 264, 0], [/SQA70/i, 70, 315, 0], [/FMA180/i, 40, 180, 0], [/FMA135/i, 30, 135, 0], [/ACL200/i, 50, 200, 0],
  [/Esprit 150/i, 150, 1050, 0], [/Esprit 120/i, 120, 840, 0], [/Esprit 100/i, 100, 550, 0], [/Esprit 80/i, 80, 400, 0],
  [/Evostar 72ED|Evostar 72/i, 72, 420, 0], [/Evostar 80ED|Black Diamond 80ED|ProED 80|Equinox 80/i, 80, 600, 0], [/Evostar 100/i, 100, 900, 0], [/Evoguide 50ED/i, 50, 242, 0],
  [/Evolux 82ED/i, 82, 530, 0], [/Evolux 62ED/i, 62, 400, 0], [/Equinox 66/i, 66, 400, 0], [/Equinox 120/i, 120, 900, 0], [/Startravel 102\/500/i, 102, 500, 0],
  [/FSQ-106/i, 106, 530, 0], [/FSQ-85/i, 85, 450, 0], [/FSQ-130/i, 130, 650, 0], [/TOA-130/i, 130, 1000, 0], [/TSA-120/i, 120, 900, 0], [/TV-85/i, 85, 600, 0],
  [/AT130EDT/i, 130, 910, 0], [/AT115EDT/i, 115, 805, 0], [/AT92/i, 92, 643, 0], [/AT72ED/i, 72, 430, 0],
  [/ZWO FF107/i, 107, 749, 0], [/ZWO FF65/i, 65, 416, 0],
  [/61EDPH III/i, 61, 275, 0], [/61EDPH/i, 61, 335, 0], [/94EDPH/i, 94, 517, 0], [/Sharpstar 100Q/i, 100, 580, 0], [/AL-140PH/i, 140, 672, 0], [/Radian 61/i, 61, 275, 0],
  [/ED102 Essential|ED102|Starwave 102ED|Horizon 102ED|SV503 102ED|APO ED 102\/700|SLD 102\/714/i, 102, 714, 0],
  [/ED APO 127|ED127/i, 127, 952, 0], [/ED APO 152mm f\/8/i, 152, 1216, 0], [/APO 165mm/i, 165, 1155, 0], [/LZOS.*152|152\/1200/i, 152, 1200, 0],
  [/APM Doublet SD Apo 140|APM.*140 f\/7/i, 140, 980, 0], [/SV550 122/i, 122, 854, 0], [/SV550 80/i, 80, 480, 0], [/SV503 70ED/i, 70, 420, 0], [/SV535/i, 80, 480, 0], [/SV555/i, 60, 360, 0],
  [/Photoline 130|APO130f7/i, 130, 910, 0], [/Photoline 106/i, 106, 700, 0], [/CF-APO 90/i, 90, 540, 0], [/TS-Optics 94mm f\/5\.5|94\/517/i, 94, 517, 0],
  [/Imaging Star 65\/420|TSAPO65Q/i, 65, 420, 0], [/SD-APO 72mm f\/6|Lacerta 72\/432/i, 72, 432, 0],
  [/Tecnosky 90\/540|90\/540 FPL55/i, 90, 540, 0], [/EDT 80\/480/i, 80, 480, 0], [/AG70 70\/350/i, 70, 350, 0], [/Series 5000 80mm/i, 80, 480, 0],
  [/SVR90T/i, 90, 495, 0], [/SV125/i, 125, 975, 0], [/Stowaway 92/i, 92, 612, 0], [/StarFire GTX 110/i, 110, 660, 0],
  [/Apertura 75Q/i, 75, 405, 0], [/Apertura 90mm Triplet/i, 90, 540, 0], [/61\/335/i, 61, 335, 0],
  // obiettivi fotografici: apertura = focale / f (tutta aperta)
  [/Samyang 135|Rokinon 135/i, 67.5, 135, 0], [/Sigma 135mm F1\.8/i, 75, 135, 0], [/Sigma 105mm F2\.8/i, 37.5, 105, 0], [/Sigma 40mm F1\.4/i, 28.6, 40, 0],
  [/Sigma 150-600/i, 95, 600, 0], [/Sigma 400mm F\/5\.6/i, 71.4, 400, 0], [/EF 400mm f\/5\.6/i, 71.4, 400, 0], [/EF 600mm f\/4/i, 150, 600, 0],
  [/EF 200mm f\/2\.8/i, 71.4, 200, 0], [/70-200mm f\/2\.8/i, 71.4, 200, 0], [/300mm f\/2\.8/i, 107, 300, 0], [/Sonnar 180 mm f\/2\.8/i, 64, 180, 0], [/55-250mm/i, 44.6, 250, 0],
];
function scopeOf(name) {
  for (const [re, ap, fl, obs] of SCOPES) if (re.test(name)) return { ap, fl, obs };
  const m = String(name).match(/\b(\d{2,3})\s?\/\s?(\d{3,4})\b/); // «200/1000»
  if (m && +m[1] >= 40 && +m[2] > +m[1]) return { ap: +m[1], fl: +m[2], obs: /newton|pds|reflector/i.test(name) ? 25 : 0 };
  return null;
}

// [regola, pixel µm, larghezza, altezza px, QE %, rumore di lettura e⁻, tipo]
const CAMS = [
  [/Seestar S30 Pro/i, 2.9, 3840, 2160, 80, 1.0, 'osc'], [/Seestar S30/i, 2.9, 1920, 1080, 80, 1.0, 'osc'], [/Seestar S50/i, 2.9, 1920, 1080, 80, 1.0, 'osc'],
  [/Origin 678C/i, 2.0, 3840, 2160, 80, 1.0, 'osc'],
  [/2600MC|TS2600CP|DeepSkyPro2600c|26000 ?KPA|26000KPA|571 ?C|QHY268 ?C|Poseidon-C|Hypercam 26C/i, 3.76, 6248, 4176, 80, 1.5, 'osc'],
  [/6200MC/i, 3.76, 9576, 6388, 80, 1.5, 'osc'], [/2400MC|SkyEye24AC/i, 5.94, 6072, 4042, 80, 1.1, 'osc'],
  [/533MC|Ares-C|533 ?C\b|DeepSkyPro533/i, 3.76, 3008, 3008, 80, 1.5, 'osc'],
  [/294MC|Hypercam 294C|Artemis-C|SV405CC|10300 ?KPA/i, 4.63, 4144, 2822, 75, 1.8, 'osc'],
  [/585MC|ATR585C|TS585CP|Uranus-C|SV705C/i, 2.9, 3840, 2160, 80, 1.0, 'osc'],
  [/183MC/i, 2.4, 5496, 3672, 80, 1.6, 'osc'], [/071MC/i, 4.78, 4944, 3284, 50, 2.3, 'osc'], [/1600MC/i, 3.8, 4656, 3520, 60, 1.2, 'osc'],
  [/715MC|715C/i, 1.45, 3840, 2160, 80, 0.9, 'osc'], [/676MC/i, 2.0, 3552, 3552, 80, 0.9, 'osc'], [/662MC/i, 2.9, 1920, 1080, 80, 0.9, 'osc'], [/678MC/i, 2.0, 3840, 2160, 80, 0.9, 'osc'],
  // reflex: con «modificata» il filtro davanti al sensore lascia passare l'Hα
  [/EOS 6D/i, 6.55, 5472, 3648, 50, 3, 'dslr'], [/EOS (2000D|250D|200D|800D|850D|R10)/i, 3.72, 6000, 4000, 45, 2.5, 'dslr'],
  [/EOS (100D|550D|600D|650D|700D|1100D|60D)/i, 4.3, 5184, 3456, 40, 3.5, 'dslr'], [/EOS R6/i, 6.56, 5472, 3648, 55, 2, 'dslr'], [/EOS Ra\b/i, 5.36, 6720, 4480, 50, 2.5, 'dslrmod'],
  [/Nikon D5300|Nikon D5[56]00|Nikon D7500/i, 3.9, 6000, 4000, 45, 2.5, 'dslr'], [/Nikon Z ?6/i, 5.9, 6048, 4024, 50, 2, 'dslr'], [/Nikon D810A/i, 4.9, 7360, 4912, 50, 2.5, 'dslrmod'],
  [/Sony .*(α|a)7 ?I?I?I|ILCE-7M3/i, 5.9, 6000, 4000, 50, 2.5, 'dslr'],
];
function camOf(name) {
  for (const [re, pix, w, h, qe, rn, type] of CAMS) if (re.test(name)) {
    const mod = /modificat|modified|\bmod\b|full spectrum|astro/i.test(name);
    return { pix, w, h, qe, rn, type: type === 'dslr' && mod ? 'dslrmod' : type };
  }
  return null;
}

// nome del filtro → id del catalogo (src/data/filters.js). I «≈» sono filtri senza bande pubblicate in numeri: si usa il
// più vicino del catalogo, solo per la taratura.
const FILTERS = [
  [/^$|^\(nessuno\)$|\d+×\d|Clear|Luminance|L-[123] |UV\/?\s?IR|UV IR|UVIR|V-Pro Luminance|Fringe Killer/i, 'uvir'],
  [/Anti-Halo UV/i, 'poahuvir'],
  [/Triband RGB Ultra Filter II|Triband RGB Ultra II/i, 'triband2'], [/Tri ?band RGB (Ultra|Pro)/i, 'triband'],
  [/Quad Band Anti-Light/i, 'aquad'], [/Radian Triad Ultra|Triad Ultra/i, 'triad'],
  [/L-Quad Enhance|L-QEF/i, 'lqef'], [/L-Pro/i, 'lpro'],
  [/L-eXtreme/i, 'lextreme'], [/L-Ultimate/i, 'lultimate'], [/L-eNhance/i, 'lenhance'], [/L-Synergy/i, 'lsynergy'], [/L-Para/i, 'lpara'],
  [/ALP-T.*3 ?nm.*(Ha|H-alpha).*O/i, 'alpt3'], [/ALP-T.*5 ?nm(?!.*S ?II)/i, 'alpt5'],
  [/NBZ-II/i, 'nbz2'], [/Nebula Booster NBZ|NBZ UHS/i, 'nbz'],
  [/ColourMagic D1|Color Magic D1/i, 'askard1'], [/ColourMagic D2|Color Magic D2/i, 'askard2'], [/Colou?r Magic C1/i, 'askarc1'], [/Colou?r Magic C2/i, 'askarc2'],
  [/SV220 7nm.*(Ha|H-a).*O|SV220.*7nm.*Ha-Oiii|SV220 7nm 2" Ha/i, 'sv220'], [/SV220.*3 ?nm/i, 'sv220-3'], [/7nm SII & OIII SV220|SV220.*SII/i, 'sv220s'],
  [/Altair Ha\+OIII ULTRA DualBand 4nm/i, 'altair4'], [/Altair SII\+OIII ULTRA DualBand 4nm/i, 'altair4s'],
  [/Seestar S(30|50).*LP Filter/i, 'seestar'],
  [/Anti-Halo Pro Dual-Band/i, 'poahpro'], [/ZWO Duo-Band/i, 'zwoduo'], [/STC.*Duo/i, 'stcduo'],
  // anti-inquinamento a banda larga senza bande pubblicate: ≈ L-Pro
  [/IDAS LPS-(D1|D2|P1|P2|P3)|LoGlow|Light Pollution for RASA|Neodymium|Moon (&|and) Skyglow|CLS/i, 'lpro'],
];
function filterOf(name) {
  const n = String(name || '').trim();
  for (const [re, id] of FILTERS) if (re.test(n)) return id;
  return null;
}

module.exports = { scopeOf, camOf, filterOf, SCOPES, CAMS, FILTERS };
