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
  [/Epsilon[- ]?130/i, 130, 430, 48], [/Epsilon-160/i, 160, 530, 44], [/Epsilon-180/i, 180, 500, 35],
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
  // comparsi nella seconda raccolta
  [/SVX90T/i, 90, 495, 0], [/SVX102T/i, 102, 714, 0], [/SV70T/i, 70, 420, 0], [/Vixen VMC200L/i, 200, 1950, 33], [/ZWO FF80/i, 80, 600, 0], [/71SDQ/i, 71, 450, 0],
  [/SQA85/i, 85, 382, 0], [/Askar 65PHQ/i, 65, 416, 0], [/Photoline 70mm f\/6|TSAPO704/i, 70, 420, 0], [/Evostar 120ED|Black Diamond 120ED/i, 120, 900, 0],
  [/16" F\/4/i, 406, 1624, 25], [/13028HNT/i, 130, 364, 48], [/Planewave CDK14/i, 356, 2563, 48], [/PHOTON 300mm\/12" f\/4/i, 305, 1200, 30], [/BKP 150/i, 150, 750, 30],
  [/Askar 160 APO|160mm f\/7 Triplet/i, 160, 1120, 0], [/SV545/i, 80, 480, 0], [/FS-60/i, 60, 355, 0], [/StellaMira 90/i, 90, 540, 0], [/Askar 50P/i, 50, 250, 0],
  // comparsi nella seconda raccolta, aggiunti con la 0.20
  [/Orion Optics UK IDEAL 8/i, 203, 955, 28], // 8″; il rapporto f/4,7 lo dichiarano le foto (lo usa astrobin-dataset.cjs)
  [/AT60ED/i, 60, 360, 0], [/CarbonStar 150/i, 150, 600, 35], [/AL-107PH/i, 107, 695, 0], [/Skymax 180/i, 180, 2700, 30], [/MK127/i, 127, 1500, 30],
  [/Red Dwarf.*8"|Noctutec.*8"/i, 203, 812, 35], [/Photoline 115/i, 115, 800, 0],
  // quarta raccolta (2026-09-27): valori nominali dei produttori; la focale la corregge il rapporto f dichiarato nelle pose
  [/CDK ?24/i, 610, 3962, 47], [/CDK ?20/i, 508, 3454, 46], [/iDK 17/i, 432, 2939, 43], [/DSI RC ?14/i, 356, 2845, 45],
  [/AT12RC/i, 305, 2432, 45], [/AT10RC/i, 254, 2032, 45], [/AT8RC/i, 203, 1624, 47], [/AT6RC/i, 152, 1370, 47],
  [/TMB.*130/i, 130, 910, 0], [/20032PNT/i, 200, 640, 45], [/15028HNT/i, 150, 420, 48], [/SCA ?260/i, 260, 1300, 38], [/CCA-?250/i, 250, 1250, 38],
  [/NP ?101/i, 101, 540, 0], [/NP ?127/i, 127, 660, 0], [/Askar 151PHQ/i, 151, 1057, 0], [/Askar 130PHQ/i, 130, 1000, 0], [/SQA ?106/i, 106, 385, 0],
  [/FMA ?230/i, 50, 230, 0], [/Askar 185APO/i, 185, 1295, 0], [/SVX ?140/i, 140, 980, 0], [/SVX ?130|SVA ?130/i, 130, 910, 0], [/SVX ?152/i, 152, 1200, 0],
  [/SVQ ?86/i, 86, 464, 0], [/SVX ?080|SVX ?80/i, 80, 480, 0], [/SV102ED/i, 102, 714, 0], [/SV90T/i, 90, 630, 0], [/76EDPH/i, 76, 418, 0],
  [/R200SS/i, 200, 800, 38], [/Gran Turismo 71|GT71/i, 71, 420, 0], [/GT-81/i, 81, 478, 0], [/\bStar 71/i, 71, 350, 0], [/ZS80|ZenithStar 80/i, 80, 545, 0],
  [/\bC ?11\b|Celestron 11"/i, 280, 2800, 34], [/C-?9[¼.,]|9\.25/i, 235, 2350, 36], [/Celestron C8N/i, 203, 1000, 30],
  [/Quattro[- ]?8 ?S/i, 200, 800, 35], [/Quattro 10/i, 254, 1000, 32], [/Quattro 12/i, 305, 1200, 33], [/Orion 250 f\/3\.9/i, 254, 990, 35],
  [/LX200.*8"|8" LX200|2080 8"/i, 203, 2032, 34], [/TEC.*140|APO140/i, 140, 980, 0], [/FLT ?156|Fluorostar 156/i, 156, 1094, 0],
  [/Wave Series 115|Wave 115/i, 115, 805, 0], [/Orion Optics UK CT10/i, 254, 1219, 25], [/ODK ?12/i, 305, 2040, 45], [/Orion optics UK AG12/i, 305, 1150, 40],
  [/Borg 55FL/i, 55, 200, 0], [/AT65EDQ/i, 65, 420, 0], [/AT102EDL/i, 102, 714, 0], [/AT80ED/i, 80, 480, 0], [/FSQ-?\s?106|Taka-106/i, 106, 530, 0], [/FSQ-?\s?85/i, 85, 450, 0],
  [/ED165/i, 165, 1155, 0], [/ED ?127|127mm ED/i, 127, 952, 0], [/ASA N ?10|10N\b/i, 254, 970, 40], [/ASA N ?8|8N\b/i, 203, 760, 40], [/ASA N ?12|12N\b/i, 305, 1160, 40],
  [/Skymax 127/i, 127, 1500, 30], [/Mewlon-?180/i, 180, 2160, 35], [/ED80Sf/i, 80, 600, 0], [/Series 6000 80/i, 80, 480, 0], [/Series 6000 115/i, 115, 805, 0],
  [/UltraWide 180/i, 180, 810, 0], [/Pentax 125 SDP/i, 125, 800, 0], [/Esp[ri]+t 150/i, 150, 1050, 0], [/FC-?100/i, 100, 800, 0], [/FS-?128/i, 128, 1040, 0],
  [/Epsilon[- ]?160/i, 160, 530, 44], [/Epsilon[- ]?180/i, 180, 500, 35], [/MN ?190/i, 190, 1000, 25], [/Orion ST80/i, 80, 400, 0], [/Orion ED80/i, 80, 600, 0],
  [/ProED 100/i, 100, 900, 0], [/TSAPO ?102|APO 102 f5/i, 102, 520, 0], [/Starfire.*155|155 EDF/i, 155, 1085, 0], [/XX16g/i, 406, 1800, 20],
  [/NexStar Evolution 9/i, 235, 2350, 36], [/Starwave 70EDQ/i, 70, 474, 0], [/PHOTOLINE 72/i, 72, 432, 0], [/SV503 80/i, 80, 560, 0],
  // obiettivi fotografici: apertura = focale / f (tutta aperta)
  [/Samyang 135|Rokinon 135/i, 67.5, 135, 0], [/Sigma 135mm F1\.8/i, 75, 135, 0], [/Sigma 105mm F2\.8/i, 37.5, 105, 0], [/Sigma 40mm F1\.4/i, 28.6, 40, 0],
  [/Sigma 150-600/i, 95, 600, 0], [/EF 100-400mm/i, 71, 400, 0], [/75-300mm|70-300mm/i, 53.6, 300, 0], [/Sigma 400mm F\/5\.6/i, 71.4, 400, 0], [/EF 400mm f\/5\.6/i, 71.4, 400, 0], [/EF 600mm f\/4/i, 150, 600, 0],
  [/EF 200mm f\/2\.8/i, 71.4, 200, 0], [/70-200mm f\/2\.8/i, 71.4, 200, 0], [/300mm f\/2\.8/i, 107, 300, 0], [/Sonnar 180 mm f\/2\.8/i, 64, 180, 0], [/55-250mm/i, 44.6, 250, 0],
];
/* Ostruzione per tipo ottico, quando il nome non identifica il modello: valori tipici (ipotesi), non misure. */
const OBS_BY_TYPE = [[/Ritchey|\bRC\b|RC ?\d|\bi?CDK|\biDK\b|\bDK\b|Dall-?Kirkham|Corrected Dall/i, 45], [/RASA|Hyperbolic|HNT|Hypergraph|Houghton|Wright/i, 40],
  [/SCT|Schmidt-?Cass|Maksutov|\bMak\b|Cassegrain|ACF|EdgeHD|XLT|LX200|LX90/i, 34],
  [/Newton|\bNewt|Reflector|Astrograph|PDS|Dobson|\bDOB\b|SkyView|SkyQuest|StarStructure|\bUNC\b|\bONTC\b/i, 30],
  [/APO|\bED\b|Triplet|Doublet|Quadruplet|Quintuplet|Petzval|Refractor|Rifrattore|FPL|\bPH\b|PHQ|Flat ?field|Fluorite|SD\b|StarFire|Starfire|Stellarvue|\bTEC\b|Televue|Tele Vue/i, 0]];
function scopeOf(name) {
  for (const [re, ap, fl, obs] of SCOPES) if (re.test(name)) return { ap, fl, obs };
  const n = String(name);
  const m = n.match(/\b(\d{2,3})\s?\/\s?(\d{3,4})\b/); // «200/1000»
  if (m && +m[1] >= 40 && +m[2] > +m[1]) return { ap: +m[1], fl: +m[2], obs: /newton|pds|reflector/i.test(n) ? 25 : 0 };
  // generico: apertura (mm o pollici), rapporto focale e tipo ottico dal nome. Senza f/ la focale la dà il rapporto
  // dichiarato nelle pose (astrobin-dataset.cjs); senza tipo riconoscibile il telescopio resta sconosciuto.
  // obiettivi fotografici: «200mm f/2», «70-210mm f/4», «105mm F1.4»: apertura = focale / f
  const lens = /Canon EF|Nikkor|Nikon|Sigma|Samyang|Rokinon|Tamron|Pentax SMC|Opteka|Zeiss|Sony FE|Viltrox|Laowa/i.test(n) && n.match(/(?:\d{2,3}-)?(\d{2,3})\s?mm\s?(?:F|f\/?|1:)\s?(\d(?:[.,]\d+)?)/);
  if (lens) { const fl = +lens[1], fr = +lens[2].replace(',', '.'); if (fl >= 24 && fr >= 1) return { ap: Math.round(fl / fr * 10) / 10, fl, obs: 0 }; }
  const t = OBS_BY_TYPE.find(([re]) => re.test(n)); if (!t) return null;
  const mm = n.match(/(\d{2,4})\s?mm\b/i), inch = n.match(/(\d{1,2}(?:[.,]\d+)?)\s?(?:"|''|”|″|-?inch\b|in\b|Zoll\b)/i);
  const ap = mm && +mm[1] >= 40 && +mm[1] <= 1100 ? +mm[1] : inch && +inch[1].replace(',', '.') >= 2 && +inch[1].replace(',', '.') <= 40 ? Math.round(+inch[1].replace(',', '.') * 25.4) : null;
  if (!ap) return null;
  const f = n.match(/\bf\s?\/?\s?(\d{1,2}(?:[.,]\d+)?)\b/i), fr = f ? +f[1].replace(',', '.') : null;
  return { ap, fl: fr >= 1.5 && fr <= 20 ? Math.round(ap * fr) : null, obs: t[1] };
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
  [/QHY ?168 ?C/i, 4.78, 4952, 3288, 50, 2.3, 'osc'], [/SV605CC/i, 3.76, 3008, 3008, 80, 1.5, 'osc'],
  [/183MC/i, 2.4, 5496, 3672, 80, 1.6, 'osc'], [/071MC/i, 4.78, 4944, 3284, 50, 2.3, 'osc'], [/1600MC/i, 3.8, 4656, 3520, 60, 1.2, 'osc'],
  [/ATR2600C/i, 3.76, 6248, 4176, 80, 1.5, 'osc'], [/485MC/i, 2.9, 3840, 2160, 80, 1.0, 'osc'], [/462MC/i, 2.9, 1920, 1080, 80, 1.0, 'osc'], [/DWARF ?3/i, 2.0, 3840, 2160, 80, 1.0, 'osc'],
  [/715MC|715C/i, 1.45, 3840, 2160, 80, 0.9, 'osc'], [/676MC/i, 2.0, 3552, 3552, 80, 0.9, 'osc'], [/662MC/i, 2.9, 1920, 1080, 80, 0.9, 'osc'], [/678MC/i, 2.0, 3840, 2160, 80, 0.9, 'osc'],
  // reflex: con «modificata» il filtro davanti al sensore lascia passare l'Hα
  [/EOS 6D/i, 6.55, 5472, 3648, 50, 3, 'dslr'], [/EOS (2000D|250D|200D|800D|850D|R10)/i, 3.72, 6000, 4000, 45, 2.5, 'dslr'],
  [/EOS 450D/i, 5.2, 4272, 2848, 35, 4, 'dslr'],
  [/EOS (100D|550D|600D|650D|700D|1100D|60D)/i, 4.3, 5184, 3456, 40, 3.5, 'dslr'], [/EOS R6/i, 6.56, 5472, 3648, 55, 2, 'dslr'], [/EOS Ra\b/i, 5.36, 6720, 4480, 50, 2.5, 'dslrmod'],
  [/Nikon D5300|Nikon D5[56]00|Nikon D7500/i, 3.9, 6000, 4000, 45, 2.5, 'dslr'], [/Nikon Z ?6/i, 5.9, 6048, 4024, 50, 2, 'dslr'], [/Nikon D810A/i, 4.9, 7360, 4912, 50, 2.5, 'dslrmod'],
  [/Sony .*(α|a)7 ?I?I?I|ILCE-7M3/i, 5.9, 6000, 4000, 50, 2.5, 'dslr'],
];
// Per sensore (il nome che AstroBin associa alla camera): [regola, pixel µm, larghezza, altezza px, QE mono %, QE colori %,
// rumore di lettura e⁻]. Valori tipici delle schede dei produttori; il tipo (mono o colori) lo dice AstroBin.
const SENSORS = [
  [/IMX571/i, 3.76, 6248, 4176, 87, 80, 1.5], [/IMX455/i, 3.76, 9576, 6388, 87, 80, 1.5], [/IMX461/i, 3.76, 11664, 8750, 87, 80, 1.5],
  [/IMX411/i, 3.76, 14208, 10656, 87, 80, 1.5], [/IMX533/i, 3.76, 3008, 3008, 87, 80, 1.5],
  [/IMX492/i, 4.63, 4144, 2822, 85, 75, 1.8], [/IMX294/i, 4.63, 4144, 2822, 85, 75, 1.8], // IMX492: usato in bin 2 (ASI294MM)
  [/IMX585/i, 2.9, 3840, 2160, 87, 80, 1.0], [/IMX183/i, 2.4, 5496, 3672, 84, 80, 1.6], [/IMX178/i, 2.4, 3096, 2080, 81, 75, 1.4],
  [/IMX410/i, 5.94, 6072, 4042, 80, 80, 1.1], [/IMX462|IMX662|IMX290|IMX385|IMX224|IMX185/i, 2.9, 1920, 1080, 80, 80, 1.0],
  [/IMX678|IMX676/i, 2.0, 3840, 2160, 80, 80, 0.9], [/IMX715/i, 1.45, 3840, 2160, 80, 80, 0.9], [/IMX485/i, 2.9, 3840, 2160, 80, 80, 1.0],
  [/IMX174/i, 5.86, 1936, 1216, 77, 70, 3.5], [/IMX432/i, 9.0, 1608, 1104, 77, 70, 3.5],
  [/MN34230/i, 3.8, 4656, 3520, 60, 60, 1.2], [/IMX071/i, 4.78, 4944, 3284, 50, 50, 2.3], [/IMX193/i, 3.9, 6000, 4000, 45, 45, 2.5],
  [/IMX128/i, 5.97, 6016, 4016, 50, 50, 3], [/IMX094/i, 4.88, 7360, 4912, 50, 50, 2.5],
  [/ICX694|ICX695/i, 4.54, 2750, 2200, 77, 70, 5], [/ICX814|ICX815/i, 3.69, 3388, 2712, 77, 70, 5], [/ICX834/i, 3.1, 4250, 2838, 77, 70, 5],
  [/ICX674/i, 4.54, 1940, 1460, 77, 70, 5], [/ICX285/i, 6.45, 1392, 1040, 65, 60, 6],
  [/KAF-16803/i, 9.0, 4096, 4096, 60, 55, 9], [/KAF-16200/i, 6.0, 4540, 3640, 60, 55, 9], [/KAF-8300/i, 5.4, 3326, 2504, 56, 50, 8],
  [/KAI-04022/i, 7.4, 2048, 2048, 55, 50, 12], [/KAI-11000/i, 9.0, 4008, 2672, 50, 45, 11],
  [/Canon CMOS EOS 6D/i, 6.55, 5472, 3648, 50, 50, 3], [/Canon CMOS EOS R\b/i, 5.36, 6720, 4480, 50, 50, 2.5],
  [/Canon CMOS APS-C 18/i, 4.3, 5184, 3456, 40, 40, 3.5], [/Canon CMOS APS-C 24/i, 3.72, 6000, 4000, 45, 45, 2.5], [/Canon CMOS APS-C 12/i, 5.2, 4272, 2848, 35, 35, 4],
  [/Live MOS 16/i, 3.75, 4608, 3456, 45, 45, 2.5],
];
// camere senza sensore indicato: il sensore dal nome
const CAM_SENSOR = [
  [/QHY600/i, 'IMX455'], [/533MM/i, 'IMX533'], [/2600MM|268 ?M|Poseidon-M|26000 KMA|TS2600MP/i, 'IMX571'], [/Nikon D5100|Nikon D7000|Pentax K-5/i, 'IMX071'],
  [/Nikon D810/i, 'IMX094'], [/Nikon D5500|Nikon D5600/i, 'IMX193'], [/Nikon D610|Nikon D750/i, 'IMX128'],
  [/Canon EOS (80D|77D|M100|750D|760D|800D|200D|250D|2000D)/i, 'Canon CMOS APS-C 24'], [/Canon EOS (600D|60D|60Da|1300D|1200D|550D|650D|700D|100D|1100D)/i, 'Canon CMOS APS-C 18'],
  [/Canon EOS RP/i, 'Canon CMOS EOS 6D'], [/Canon EOS R\b/i, 'Canon CMOS EOS R'], [/Atik 16200/i, 'KAF-16200'], [/Atik 383/i, 'KAF-8300'], [/FLI (PL|ML)16803/i, 'KAF-16803'],
];
const DSLR = /Canon|Nikon|Sony (A|α)\d|Pentax|Olympus|Panasonic|Lumix|Fuji/i;
const MOD = /modificat|modified|\bmod\b|full spectrum|astro|60Da|D810a|EOS Ra\b/i;
/* camOf(nome, sensore, modo): prima le regole sul nome (CAMS), poi il sensore. modo = colorMode di AstroBin (color | mono |
   unknown): se contraddice il nome la foto si scarta (null). */
function camOf(name, sensor, mode) {
  for (const [re, pix, w, h, qe, rn, type] of CAMS) if (re.test(name)) {
    if (mode === 'mono') return null; // nome di una camera a colori con modo mono: dato incoerente
    return { pix, w, h, qe, rn, type: type === 'dslr' && MOD.test(name) ? 'dslrmod' : type };
  }
  let sn = sensor || ''; if (!sn) { const c = CAM_SENSOR.find(([re]) => re.test(name)); if (c) sn = c[1]; }
  const s = SENSORS.find(([re]) => re.test(sn)); if (!s) return null;
  const mono = mode === 'mono' || (/\(mono\)/i.test(sn)) || (mode !== 'color' && /\bmono\b|[0-9]MM\b| M\b|M Pro\b|-M\b/i.test(name));
  const [, pix, w, h, qeM, qeC, rn] = s, dslr = DSLR.test(name) || /^Canon CMOS|Live MOS/i.test(sn);
  if (dslr) return { pix, w, h, qe: qeC, rn, type: MOD.test(name) ? 'dslrmod' : 'dslr' };
  return { pix, w, h, qe: mono ? qeM : qeC, rn, type: mono ? 'mono' : 'osc' };
}
/* filtri di una camera mono: riga e ampiezza dal nome (Hα 3 nm, OIII 6,5 nm…) → filtro generico «nbg-riga-ampiezza»
   (scripts/calibrate.cjs lo crea con la banda centrata sulla riga, trasmissione 90%); banda larga → L, R, G, B. */
function monoFilterOf(name) {
  const n = String(name || '').trim(); if (!n || n === 'null') return null;
  const line = /\bH-?(alpha|a)\b|Hα|H-Alpha|\bHa\d|\bHa\b/i.test(n) ? 'Ha' : /O-?III|\bO3\b|Oxygen/i.test(n) ? 'OIII' : /S-?II|\bS2\b|Sulfur|Sulphur/i.test(n) ? 'SII' : null;
  const two = [/\bH-?(alpha|a)\b|Hα|\bHa\b/i, /O-?III|Oxygen/i, /S-?II|Sulfur/i].filter((re) => re.test(n)).length > 1;
  if (line && !two) { const m = n.match(/(\d+(?:[.,]\d+)?)\s?nm/i); if (!m) return null; const bw = +m[1].replace(',', '.'); return bw >= 2 && bw <= 15 ? `nbg-${line}-${bw}` : null; }
  if (two || /IR[- ]?pass|IR ?\d{3}|Dual|Duo|Tri|Quad|L-eX|L-eN|L-Ult|UHC|CLS|Pro\b.*Pollution/i.test(n)) return null;
  if (/\b(L|Lum|Luminance|Luminanz|Clear|Lumi)\b|L-[123]\b|UV\/?\s?IR|IR\/?\s?UV|IR[- ]?Cut|Luminance/i.test(n)) return 'L';
  if (/\b(R|Red|Rot|Rosso|Rood)\b|R-CCD/i.test(n)) return 'R';
  if (/\b(G|Green|Grün|Verde|Groen)\b|G-CCD/i.test(n)) return 'G';
  if (/\b(B|Blue|Blau|Blu|Blauw)\b|B-CCD/i.test(n)) return 'B';
  return null;
}

// nome del filtro → id del catalogo (src/data/filters.js). I «≈» sono filtri senza bande pubblicate in numeri: si usa il
// più vicino del catalogo, solo per la taratura.
const FILTERS = [
  [/^$|^\(nessuno\)$|\d+×\d|Clear|Luminance|L-[123] |UV\/?\s?IR|UV IR|UV ?& ?IR|UVIR|IR Blocker|HEUIB|V-Pro Luminance|Fringe Killer/i, 'uvir'],
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
  // aggiunti con la 0.20
  [/ALP-T.*S ?II ?(&|and|\+) ?H-?(b|beta)/i, 'alptsh'], [/SV240/i, 'sv240'], [/Nebula Booster NB1|IDAS NB1\b/i, 'nb1'], [/Nebula Booster NB3|IDAS NB3\b/i, 'nb3'],
  [/Altair SII\+OIII ULTRA DualBand 6nm/i, 'altair6s'], [/Colou?r Magic E2/i, 'askare2'], [/Astronomik UHC-E/i, 'uhce'], [/Optolong UHC/i, 'ouhc'], [/UHC-S/i, 'buhcs'],
  [/EDGE S ?II/i, 'edge-SII'], [/SV227 OIII/i, 'sv227-OIII'], [/Antlia 3\.5 ?nm.*H-?alpha/i, 'ant35-Ha'],
  [/Chroma H-?alpha 5 ?nm/i, 'chr5-Ha'], [/Chroma OIII 5 ?nm/i, 'chr5-OIII'], [/Baader S-?II 6[.,]5/i, 'bd65-SII'], [/Optolong H-?Alpha 7 ?nm/i, 'opt7-Ha'],
  [/Antlia 3\.5 ?nm.*Sulfur/i, 'ant35-SII'], [/SV227 SII/i, 'sv227-SII'], [/Antlia 3\.5 ?nm.*Oxygen/i, 'ant35-OIII'], [/ALP-T.*3 ?nm.*S ?II ?(&|and|\+) ?O ?III/i, 'alpt3s'],
  // senza bande pubblicate: il più vicino del catalogo (solo taratura)
  [/Golden Duo-?Band 7 ?nm/i, 'duo7'], [/SV260/i, 'lpro'], [/Contrast Booster|UHC-L Booster|Natural Night/i, 'lpro'],
  // anti-inquinamento a banda larga senza bande pubblicate: ≈ L-Pro
  [/IDAS LPS-(D1|D2|D3|P1|P2|P3)|IDAS GNB|LoGlow|Light Pollution for RASA|Neodymium|Moon (&|and) Skyglow|CLS/i, 'lpro'],
  [/Altair Ha\+OIII ULTRA DualBand 6nm/i, 'askard1'],
];
function filterOf(name) {
  const n = String(name || '').trim();
  for (const [re, id] of FILTERS) if (re.test(n)) return id;
  return null;
}

module.exports = { scopeOf, camOf, filterOf, monoFilterOf, SCOPES, CAMS, FILTERS, SENSORS };
