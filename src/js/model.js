'use strict';
/* ============================ catalogo ============================ */
const TYPES = { Gx: 'Galassia', EN: 'Nebulosa a emissione', PN: 'Nebulosa planetaria', SNR: 'Resto di supernova', RN: 'Nebulosa a riflessione', DN: 'Nebulosa oscura', OC: 'Ammasso aperto', GC: 'Ammasso globulare' };
const TYPES_PL = { Gx: 'Galassie', EN: 'Emissione', PN: 'Planetarie', SNR: 'Resti di SN', RN: 'Riflessione', DN: 'Oscure', OC: 'Ammassi aperti', GC: 'Globulari' };
const TYPE_COLOR = { Gx: '#D8C49A', EN: '#E4574B', PN: '#45C8B4', SNR: '#E88A6E', RN: '#7FA8F0', DN: '#A88B6C', OC: '#C3CCDC', GC: '#E8DFC8' };
const SOURCES = { M: 'Messier', NGC: 'NGC', IC: 'IC', Caldwell: 'Caldwell', Sh2: 'Sharpless', vdB: 'van den Bergh', LDN: 'Lynds (oscure)', B: 'Barnard (oscure)', PN: 'Planetarie deboli', SNR: 'Resti di SN (Green)', X: 'Gruppi e campi' };
/* intensità delle righe di emissione rispetto al flusso equivalente in banda V */
const LINES = { EN: { Ha: 1.5, OIII: 0.3, SII: 0.25, cont: 0.3 }, PN: { Ha: 0.8, OIII: 2.0, SII: 0.05, cont: 0.2 }, SNR: { Ha: 1.0, OIII: 0.6, SII: 0.6, cont: 0.3 }, WR: { Ha: 0.9, OIII: 1.4, SII: 0.2, cont: 0.2 }, WRS: { Ha: 0.25, OIII: 1.4, SII: 0.03, cont: 0.05 } }; // WR: bolle di Wolf-Rayet (NGC 6888, WR 134, Sh2-308, NGC 2359); WRS: il loro guscio esterno, quasi solo OIII
const TYPE_SNR = { OC: 0.4, GC: 0.45 };
const CAT = (window.DSO || []).map((r) => {
  const [id, alias, nick, type, ra, dec, a, b, pa, mag, sb, con, src, classic, tip, ctx, ha, lk] = r;
  return { id, alias: alias ? alias.split('|') : [], nick, type, ra, dec, a, b: b || a, pa, mag, sb, con, src, classic: !!classic, tip, ctx: ctx ? ctx.split('|') : [], ha: ha || 0, lk: lk || type, search: (id + ' ' + alias + ' ' + nick).toLowerCase().replace(/\s+/g, '') };
});
const CAT_BY_ID = new Map(CAT.map((o) => [o.id, o]));
const CONST_NAMES = Object.fromEntries(((window.SKY && window.SKY.names) || []).map((n) => [n.id, LANG === 'it' ? n.n : n.la || n.n]));

/* ============================ attrezzatura ============================ */
const CAMERAS = [
  { id: 'asi2600mc', name: 'ZWO ASI2600MC Pro', w: 6248, h: 4176, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 },
  { id: 'asi2600mm', name: 'ZWO ASI2600MM Pro', w: 6248, h: 4176, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 },
  { id: 'asi533mc', name: 'ZWO ASI533MC Pro', w: 3008, h: 3008, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 },
  { id: 'asi533mm', name: 'ZWO ASI533MM Pro', w: 3008, h: 3008, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 },
  { id: 'asi294mc', name: 'ZWO ASI294MC Pro', w: 4144, h: 2822, pix: 4.63, type: 'osc', qe: 75, rn: 1.8 },
  { id: 'asi294mm', name: 'ZWO ASI294MM Pro (bin 2)', w: 4144, h: 2822, pix: 4.63, type: 'mono', qe: 85, rn: 1.8 },
  { id: 'asi183mm', name: 'ZWO ASI183MM Pro', w: 5496, h: 3672, pix: 2.4, type: 'mono', qe: 84, rn: 1.6 },
  { id: 'asi183mc', name: 'ZWO ASI183MC Pro', w: 5496, h: 3672, pix: 2.4, type: 'osc', qe: 80, rn: 1.6 },
  { id: 'asi585mc', name: 'ZWO ASI585MC Pro', w: 3840, h: 2160, pix: 2.9, type: 'osc', qe: 80, rn: 1.0 },
  { id: 'asi071mc', name: 'ZWO ASI071MC Pro', w: 4944, h: 3284, pix: 4.78, type: 'osc', qe: 50, rn: 2.3 },
  { id: 'asi1600mm', name: 'ZWO ASI1600MM Pro', w: 4656, h: 3520, pix: 3.8, type: 'mono', qe: 60, rn: 1.2 },
  { id: 'asi6200mm', name: 'ZWO ASI6200MM Pro', w: 9576, h: 6388, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 },
  { id: 'asi6200mc', name: 'ZWO ASI6200MC Pro', w: 9576, h: 6388, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 },
  { id: 'qhy268c', name: 'QHY268C', w: 6280, h: 4210, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 },
  { id: 'qhy268m', name: 'QHY268M', w: 6280, h: 4210, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 },
  { id: 'qhy600m', name: 'QHY600M', w: 9576, h: 6388, pix: 3.76, type: 'mono', qe: 87, rn: 1.5 },
  { id: 'poseidonc', name: 'Player One Poseidon-C Pro', w: 6244, h: 4168, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 },
  { id: 'canon6d', name: 'Canon EOS 6D', w: 5472, h: 3648, pix: 6.55, type: 'dslr', qe: 50, rn: 3 },
  { id: 'canonr6', name: 'Canon EOS R6', w: 5472, h: 3648, pix: 6.56, type: 'dslr', qe: 55, rn: 2 },
  { id: 'canon600d', name: 'Canon EOS 600D', w: 5184, h: 3456, pix: 4.3, type: 'dslr', qe: 40, rn: 3.5 },
  { id: 'nikond5300', name: 'Nikon D5300', w: 6000, h: 4000, pix: 3.9, type: 'dslr', qe: 45, rn: 2.5 },
  { id: 'nikonz6', name: 'Nikon Z6 II', w: 6048, h: 4024, pix: 5.9, type: 'dslr', qe: 50, rn: 2 },
  { id: 'sonya7iii', name: 'Sony α7 III', w: 6000, h: 4000, pix: 5.9, type: 'dslr', qe: 50, rn: 2.5 },
  { id: 'custom', name: 'Personalizzata' }];
const OPTICS = [
  { id: 'redcat51', name: 'William Optics RedCat 51', ap: 51, fl: 250, obs: 0 },
  { id: 'redcat61', name: 'William Optics RedCat 61', ap: 61, fl: 300, obs: 0 },
  { id: 'redcat71', name: 'William Optics RedCat 71', ap: 71, fl: 350, obs: 0 },
  { id: 'zs73', name: 'William Optics ZenithStar 73', ap: 73, fl: 430, obs: 0, acc: [['Spianatore/riduttore 0,8×', 0.8]] },
  { id: 'evo72', name: 'Sky-Watcher Evostar 72ED', ap: 72, fl: 420, obs: 0, acc: [['Riduttore 0,85×', 0.85]] },
  { id: 'evo80', name: 'Sky-Watcher Evostar 80ED', ap: 80, fl: 600, obs: 0, acc: [['Riduttore 0,85×', 0.85]] },
  { id: 'esprit80', name: 'Sky-Watcher Esprit 80ED', ap: 80, fl: 400, obs: 0 },
  { id: 'esprit100', name: 'Sky-Watcher Esprit 100ED', ap: 100, fl: 550, obs: 0, acc: [['Riduttore 0,77×', 0.77]] },
  { id: 'esprit120', name: 'Sky-Watcher Esprit 120ED', ap: 120, fl: 840, obs: 0, acc: [['Riduttore 0,77×', 0.77]] },
  { id: 'fra400', name: 'Askar FRA400', ap: 72, fl: 400, obs: 0, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'fra600', name: 'Askar FRA600', ap: 108, fl: 600, obs: 0, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'askar107', name: 'Askar 107PHQ', ap: 107, fl: 749, obs: 0, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'fsq106', name: 'Takahashi FSQ-106EDX4', ap: 106, fl: 530, obs: 0, acc: [['Riduttore 0,73×', 0.73], ['Extender 1,6×', 1.6]] },
  { id: 'sw150pds', name: 'Sky-Watcher 150PDS', ap: 150, fl: 750, obs: 33, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'sw200pds', name: 'Sky-Watcher 200PDS', ap: 200, fl: 1000, obs: 29, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'quattro200', name: 'Sky-Watcher Quattro 200P', ap: 200, fl: 800, obs: 35, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'edgehd8', name: 'Celestron EdgeHD 8', ap: 203, fl: 2032, obs: 34, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'c8', name: 'Celestron C8', ap: 203, fl: 2032, obs: 34, acc: [['Riduttore 0,63×', 0.63]] },
  { id: 'rasa8', name: 'Celestron RASA 8', ap: 203, fl: 400, obs: 45 },
  { id: 'rasa11', name: 'Celestron RASA 11', ap: 279, fl: 620, obs: 41 },
  { id: 'edgehd11', name: 'Celestron EdgeHD 11', ap: 280, fl: 2800, obs: 34, acc: [['Riduttore 0,7×', 0.7]] },
  // Lacerta Photonewton in carbonio (lacerta-optics.com): secondario 70 mm sul 200/800; correttore GPU 4 lenti a 1,0×
  { id: 'lacerta1506', name: 'Lacerta Photonewton 150/600 carbon', ap: 150, fl: 600, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0]] },
  { id: 'lacerta2008', name: 'Lacerta Photonewton 200/800 carbon', ap: 200, fl: 800, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0]] },
  { id: 'lacerta25010', name: 'Lacerta Photonewton 250/1000 carbon', ap: 250, fl: 1000, obs: 33, acc: [['Correttore di coma GPU 1,0×', 1.0]] },
  { id: 'sw130pds', name: 'Sky-Watcher 130PDS', ap: 130, fl: 650, obs: 36, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'quattro150', name: 'Sky-Watcher Quattro 150P', ap: 150, fl: 600, obs: 42, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'quattro250', name: 'Sky-Watcher Quattro 250P', ap: 254, fl: 1000, obs: 32, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'quattro300', name: 'Sky-Watcher Quattro 300P', ap: 305, fl: 1200, obs: 33, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'gso8f4', name: 'GSO / TS Photon 8" f/4', ap: 200, fl: 800, obs: 35, acc: [['Correttore di coma 0,9×', 0.9]] },
  { id: 'tsontc6f4', name: 'TS-Optics ONTC/UNC 6" f/4', ap: 150, fl: 600, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc6f5', name: 'TS-Optics ONTC/UNC 6" f/5', ap: 150, fl: 750, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc8', name: 'TS-Optics ONTC/UNC 8" f/4', ap: 203, fl: 812, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc8f45', name: 'TS-Optics ONTC/UNC 8" f/4,5', ap: 203, fl: 914, obs: 32, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc8f5', name: 'TS-Optics ONTC/UNC 8" f/5', ap: 203, fl: 1015, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc8f6', name: 'TS-Optics ONTC/UNC 8" f/6', ap: 203, fl: 1218, obs: 25, acc: [['Correttore di coma GPU 1,0×', 1.0]] },
  { id: 'tsontc10f4', name: 'TS-Optics ONTC/UNC 10" f/4', ap: 254, fl: 1016, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc10f47', name: 'TS-Optics ONTC/UNC 10" f/4,7', ap: 254, fl: 1194, obs: 32, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc10f5', name: 'TS-Optics ONTC/UNC 10" f/5 (UNC)', ap: 254, fl: 1270, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc10f64', name: 'TS-Optics ONTC/UNC 10" f/6,4', ap: 254, fl: 1626, obs: 25, acc: [['Correttore di coma GPU 1,0×', 1.0]] },
  { id: 'tsontc12f4', name: 'TS-Optics ONTC/UNC 12" f/4', ap: 305, fl: 1220, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc12f5', name: 'TS-Optics ONTC/UNC 12" f/5', ap: 305, fl: 1525, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc12f53', name: 'TS-Optics ONTC/UNC 12" f/5,3', ap: 305, fl: 1616, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsontc14', name: 'TS-Optics ONTC/UNC 14" f/4,6', ap: 355, fl: 1633, obs: 32, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tshg8', name: 'TS-Optics Hypergraph 8" f/3,4 (correttore integrato)', ap: 203, fl: 690, obs: 43 },
  { id: 'tshg10', name: 'TS-Optics Hypergraph 10" f/3,4 (correttore integrato)', ap: 254, fl: 864, obs: 40 },
  { id: 'tshg12', name: 'TS-Optics Hypergraph 12" f/3,4 (correttore integrato)', ap: 305, fl: 1037, obs: 37 },
  { id: 'tsag8', name: 'TS-Optics Astrograph 8" f/4,56 (correttore integrato)', ap: 203, fl: 926, obs: 30 },
  { id: 'tsag10', name: 'TS-Optics Astrograph 10" f/4,56 (correttore integrato)', ap: 254, fl: 1158, obs: 30 },
  { id: 'tsag12', name: 'TS-Optics Astrograph 12" f/4,56 (correttore integrato)', ap: 305, fl: 1391, obs: 30 },
  { id: 'tsag14', name: 'TS-Optics Astrograph 14" f/5,13 (correttore integrato)', ap: 355, fl: 1821, obs: 30 },
  { id: 'tsag16', name: 'TS-Optics Astrograph 16" f/5,13 (correttore integrato)', ap: 406, fl: 2083, obs: 30 },
  { id: 'tsag8f38', name: 'TS-Optics Astrograph 8" f/3,8', ap: 203, fl: 760, obs: 38, acc: [['Correttore/riduttore 0,95×', 0.95]] },
  { id: 'tsphoton6', name: 'TS-Photon 6" f/4', ap: 150, fl: 600, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'gso8f4', name: 'TS-Photon 8" f/4', ap: 200, fl: 800, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsphoton10f4', name: 'TS-Photon 10" f/4', ap: 254, fl: 1016, obs: 35, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tsphoton10f5', name: 'TS-Photon 10" f/5', ap: 254, fl: 1270, obs: 30, acc: [['Correttore di coma GPU 1,0×', 1.0], ['Starizona Nexus 0,75×', 0.75]] },
  { id: 'tshnt130', name: 'TS-Optics 130 mm f/2,8 iperbolico (correttore integrato)', ap: 130, fl: 364, obs: 48 },
  { id: 'tshnt150', name: 'TS-Optics 150 mm f/2,8 iperbolico (correttore integrato)', ap: 150, fl: 420, obs: 47 },
  { id: 'tsrc6', name: 'TS-Optics Ritchey-Chrétien 6" f/9', ap: 154, fl: 1370, obs: 47, acc: [['Riduttore/spianatore RC 0,75×', 0.75]] },
  { id: 'tsrc8', name: 'TS-Optics Ritchey-Chrétien 8" f/8', ap: 203, fl: 1624, obs: 45, acc: [['Riduttore/spianatore RC 0,75×', 0.75]] },
  { id: 'tsrc10', name: 'TS-Optics Ritchey-Chrétien 10" f/8', ap: 254, fl: 2000, obs: 45, acc: [['Riduttore/spianatore RC 0,75×', 0.75]] },
  { id: 'tsrc12', name: 'TS-Optics Ritchey-Chrétien 12" f/8', ap: 304, fl: 2432, obs: 45, acc: [['Riduttore/spianatore RC 0,75×', 0.75]] },
  // quadrupletti TS (campo spianato già nel tubo)
  { id: 'ts60q', name: 'TS-Optics 60 mm f/5 quadrupletto', ap: 60, fl: 300, obs: 0 },
  { id: 'ts70q', name: 'TS-Optics 70 mm f/5 quadrupletto', ap: 70, fl: 350, obs: 0 },
  { id: 'ts71sdq', name: 'TS-Optics 71 mm f/6,3 SDQ quadrupletto', ap: 71, fl: 450, obs: 0 },
  { id: 'ts65q', name: 'TS-Optics Imaging Star 65 mm f/6,5 quadrupletto', ap: 65, fl: 420, obs: 0 },
  { id: 'ts100q', name: 'TS-Optics Imaging Star 100 mm f/5,8 quadrupletto', ap: 100, fl: 580, obs: 0 },
  { id: 'tspl60', name: 'TS-Optics Photoline 60 mm f/6', ap: 60, fl: 360, obs: 0, acc: [['Spianatore 1,0×', 1.0]] },
  { id: 'tspl72', name: 'TS-Optics Photoline 72 mm f/6', ap: 72, fl: 432, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl80', name: 'TS-Optics Photoline 80 mm f/6 tripletto', ap: 80, fl: 480, obs: 0, acc: [['Riduttore TS 0,8×', 0.8]] },
  { id: 'tspl90', name: 'TS-Optics Photoline 90 mm f/6,7', ap: 90, fl: 600, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl102', name: 'TS-Optics Photoline 102 mm f/7', ap: 102, fl: 714, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl107', name: 'TS-Optics Photoline 107 mm f/6,5 tripletto', ap: 107, fl: 700, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl115', name: 'TS-Optics Photoline 115 mm f/7 tripletto', ap: 115, fl: 800, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tscf130', name: 'TS-Optics CF-APO 130 mm f/7 tripletto', ap: 130, fl: 910, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl140', name: 'TS-Optics Photoline 140 mm f/6,5 tripletto', ap: 140, fl: 910, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'tspl155', name: 'TS-Optics Photoline 155 mm f/8 tripletto', ap: 155, fl: 1240, obs: 0, acc: [['Riduttore TS 0,79×', 0.79]] },
  { id: 'ts110ff', name: 'TS-Optics 110 mm f/4,8 Flatfield APO', ap: 110, fl: 528, obs: 0 },
  { id: 'ts152ed', name: 'TS-Optics 152 mm f/5 ED rich field', ap: 152, fl: 760, obs: 0 },
  { id: 'eps130', name: 'Takahashi Epsilon-130D', ap: 130, fl: 430, obs: 48 },
  { id: 'eps160', name: 'Takahashi Epsilon-160ED', ap: 160, fl: 530, obs: 44 },
  { id: 'fsq85', name: 'Takahashi FSQ-85EDP', ap: 85, fl: 450, obs: 0, acc: [['Riduttore 0,73×', 0.73]] },
  { id: 'gt81', name: 'William Optics GT81', ap: 81, fl: 478, obs: 0, acc: [['Spianatore/riduttore 0,8×', 0.8]] },
  { id: 'flt91', name: 'William Optics FLT 91', ap: 91, fl: 540, obs: 0, acc: [['Spianatore/riduttore 0,8×', 0.8]] },
  { id: 'pleiades68', name: 'William Optics Pleiades 68', ap: 68, fl: 250, obs: 0 },
  { id: 'askar71f', name: 'Askar 71F', ap: 71, fl: 490, obs: 0 },
  { id: 'askar103', name: 'Askar 103APO', ap: 103, fl: 700, obs: 0, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'askar120', name: 'Askar 120APO', ap: 120, fl: 840, obs: 0, acc: [['Riduttore 0,8×', 0.8]] },
  { id: 'sqa55', name: 'Askar SQA55', ap: 55, fl: 264, obs: 0 },
  { id: 'evo100', name: 'Sky-Watcher Evostar 100ED', ap: 100, fl: 900, obs: 0, acc: [['Riduttore 0,85×', 0.85]] },
  { id: 'esprit150', name: 'Sky-Watcher Esprit 150ED', ap: 150, fl: 1050, obs: 0 },
  { id: 'ed102', name: 'Explore Scientific ED102', ap: 102, fl: 714, obs: 0, acc: [['Riduttore 0,7×', 0.7]] },
  { id: 'lens200', name: 'Obiettivo 200 mm f/2,8', ap: 71.4, fl: 200, obs: 0 },
  { id: 'samyang135', name: 'Samyang 135 mm f/2', ap: 67.5, fl: 135, obs: 0 },
  { id: 'lens85', name: 'Obiettivo 85 mm f/1,8 (a f/2,8)', ap: 30.4, fl: 85, obs: 0 },
  { id: 'lens50', name: 'Obiettivo 50 mm (a f/2,8)', ap: 17.9, fl: 50, obs: 0 },
  { id: 'custom', name: 'Personalizzato' }];
/* accessori da catalogo: [nome, fattore, ottica su cui si montano] (newton, refr = rifrattore, sct, rc, any = qualsiasi) */
const ACCESSORY_PRESETS = [
  ['Correttore di coma 0,9×', 0.9, 'newton'], ['Correttore di coma GPU 1,0×', 1.0, 'newton'], ['Correttore di coma 0,95×', 0.95, 'newton'],
  ['Starizona Nexus 0,75×', 0.75, 'newton'], ['Baader MPCC Mk III 1,0×', 1.0, 'newton'], ['Tele Vue Paracorr 1,15×', 1.15, 'newton'],
  ['Spianatore 1,0×', 1.0, 'refr'], ['Riduttore 0,85×', 0.85, 'refr'], ['Riduttore 0,8×', 0.8, 'refr'], ['Riduttore TS 0,79×', 0.79, 'refr'],
  ['Riduttore 0,77×', 0.77, 'refr'], ['Riduttore 0,7×', 0.7, 'refr'],
  ['Riduttore/spianatore RC 0,75×', 0.75, 'rc'],
  ['Riduttore EdgeHD 0,7×', 0.7, 'sct'], ['Riduttore f/6,3 (0,63×)', 0.63, 'sct'], ['Starizona Apex 0,65×', 0.65, 'sct'], ['Starizona SCT Corrector LF 0,63×', 0.63, 'sct'],
  ['Extender 1,4×', 1.4, 'any'], ['Barlow 2×', 2, 'any']];
/* famiglia di un'ottica, per proporre solo gli accessori che ci vanno */
function opticKind(o) {
  const n = String(o.name || '');
  if (/Ritchey|\bRC\b/.test(n)) return 'rc';
  if (/EdgeHD|\bC8\b|\bC9|\bC11|\bC14|SCT|Schmidt/i.test(n)) return 'sct';
  if (/RASA|Hypergraph|correttore integrato|iperbolico|Epsilon/i.test(n)) return 'fixed';
  if (/^Obiettivo|Samyang|mm f\/\d.*obiettivo/i.test(n)) return 'lens';
  return (+o.obs || 0) > 0 ? 'newton' : 'refr';
}
const presetsFor = (o) => { const k = opticKind(o); return ACCESSORY_PRESETS.filter((x) => x[2] === 'any' || x[2] === k); };
const BORTLE_SQM = { 1: 21.95, 2: 21.7, 3: 21.45, 4: 20.8, 5: 20.0, 6: 19.2, 7: 18.6, 8: 18.1, 9: 17.6 };
const sqmToBortle = (s) => (s >= 21.9 ? 1 : s >= 21.6 ? 2 : s >= 21.3 ? 3 : s >= 20.4 ? 4 : s >= 19.5 ? 5 : s >= 18.9 ? 6 : s >= 18.4 ? 7 : s >= 17.8 ? 8 : 9);
const QLABEL = { quick: 'rapida', good: 'buona', great: 'eccellente' };
const accId = () => 'a' + Math.random().toString(36).slice(2, 8);

function templateProfile() {
  return {
    id: 'esempio', unsaved: true, name: 'RedCat 51 + ASI2600MC',
    camera: { preset: 'asi2600mc', name: 'ZWO ASI2600MC Pro', w: 6248, h: 4176, pix: 3.76, type: 'osc', qe: 80, rn: 1.5 }, bin: 1,
    optics: [{ id: 'o1', preset: 'redcat51', name: 'William Optics RedCat 51', ap: 51, fl: 250, obs: 0, useNative: true, accessories: [] }],
    filters: { owned: ['uvir', 'lextreme'] },
    site: { name: 'Milano (esempio)', lat: 45.4642, lon: 9.19, bortle: 7, sqm: 18.6, example: true },
    session: { minAlt: 25, sunThr: -18, from: '', to: '', sub: 180, quality: 'good' },
    horizon: [[0, 18], [30, 24], [60, 32], [90, 28], [110, 14], [150, 10], [180, 8], [210, 9], [240, 16], [270, 22], [300, 35], [330, 26]],
  };
}
/* profili salvati con le versioni precedenti: fattore unico in optic.fac, poi un'ottica sola con accessori a livello di profilo */
function migrateProfile(p) {
  if (!p) return p;
  if (!Array.isArray(p.optics)) {
    const o = p.optic || { name: 'Personalizzato', ap: 60, fl: 300, obs: 0 };
    let acc = p.accessories, nat = p.useNative;
    if (!acc) { const fac = +o.fac || 1; acc = fac !== 1 ? [{ id: accId(), name: fac < 1 ? `Riduttore ${it(fac, 2)}×` : `Barlow ${it(fac, 1)}×`, fac }] : []; nat = fac === 1; }
    const { fac, ...clean } = o;
    p.optics = [{ id: 'o1', ...clean, useNative: nat !== false, accessories: acc }];
    delete p.optic; delete p.accessories; delete p.useNative;
  }
  p.optics.forEach((o, i) => { if (!o.id) o.id = 'o' + (i + 1); if (!Array.isArray(o.accessories)) o.accessories = []; });
  if (p.filters && !Array.isArray(p.filters.owned)) { // vecchio formato sì/no → filtri generici
    const f = p.filters, nb = +f.nbw || 7, set = nb <= 3.5 ? 'chr3' : nb <= 5 ? 'chr5' : nb <= 6.5 ? 'bd65' : nb <= 7 ? 'zwo7' : 'ast12';
    const owned = [];
    if (f.uvir) owned.push('uvir'); if (f.duo) owned.push('duo7');
    ['L', 'R', 'G', 'B'].forEach((k) => f[k] && owned.push(k));
    ['Ha', 'OIII', 'SII'].forEach((k) => f[k] && owned.push(`${set}-${k}`));
    p.filters = { owned };
  }
  if (!p.filters) p.filters = { owned: [] };
  return p;
}
const ownedFilters = (p) => (p.filters && p.filters.owned) || [];

/* ============================ luoghi ============================ */
/* Il profilo è l'attrezzatura; il luogo ha il suo cielo (SQM, atlante, mappa all-sky), il suo orizzonte e la sua
   altezza minima. Il calcolo usa il profilo attivo nel luogo attivo. */
const EXAMPLE_HZ = JSON.stringify(templateProfile().horizon);
const locId = () => 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function templateLoc() { const p = templateProfile(); return { id: 'luogo-esempio', unsaved: true, site: p.site, horizon: p.horizon, hzSrc: 'example', minAlt: p.session.minAlt }; }
/* origine di un orizzonte salvato prima che la si annotasse: esempio, sagoma del terreno di una mappa all-sky
   (180 punti ogni 2°) oppure tuo (disegnato o importato) */
function hzOrigin(h, site) {
  if (!Array.isArray(h) || !h.length) return 'none';
  if (JSON.stringify(h) === EXAMPLE_HZ) return 'example';
  if (site && site.skyMap && h.length === 180 && h.every((q, i) => q[0] === i * 2)) return 'map';
  return 'user';
}
function migrateLoc(l) {
  if (!l || !l.site || !isFinite(+l.site.lat) || !isFinite(+l.site.lon)) return null;
  if (!l.id) l.id = locId();
  if (!Array.isArray(l.horizon)) l.horizon = [];
  if (!l.hzSrc) l.hzSrc = hzOrigin(l.horizon, l.site);
  if (!isFinite(+l.minAlt)) l.minAlt = 25;
  return l;
}
const kmBetween = (a, b) => Math.hypot((a.lat - b.lat) * 111.2, (a.lon - b.lon) * 111.2 * Math.cos(a.lat * D2R));
/* il profilo attivo nel luogo attivo, nella forma che si aspetta il calcolo */
function effectiveProfile(p, l) {
  return { ...p, site: l.site, horizon: l.horizon || [], session: { ...p.session, minAlt: +l.minAlt || 0 }, locId: l.id };
}
/* Profili salvati prima dei luoghi: ognuno aveva il suo luogo. Si raccolgono i luoghi distinti (entro 500 m è lo stesso),
   tenendo il cielo più completo e recente e, se c'è, l'orizzonte inserito da te; la sagoma della mappa resta a parte. */
function locsFromProfiles(list) {
  const out = [], byProfile = new Map(), rank = { user: 3, map: 2, example: 1, none: 0 };
  const skyRank = (s) => (s.skyMap ? 2e13 + Date.parse(s.skyMap.date || 0) / 1e3 : s.lpGrid ? 1e13 : 0);
  for (const p of list) {
    if (!p.site || !isFinite(+p.site.lat) || !isFinite(+p.site.lon)) continue;
    const c = { site: clone(p.site), horizon: clone(p.horizon || []), hzSrc: hzOrigin(p.horizon, p.site), minAlt: p.session && isFinite(+p.session.minAlt) ? +p.session.minAlt : 25, t: p.updated || 0 };
    let l = out.find((x) => kmBetween(x.site, c.site) < 0.5);
    if (!l) { l = { id: locId(), site: c.site, horizon: c.horizon, hzSrc: c.hzSrc, minAlt: c.minAlt, t: c.t, terr: null }; out.push(l); }
    else {
      if (skyRank(c.site) > skyRank(l.site) || (skyRank(c.site) === skyRank(l.site) && c.t > l.t)) l.site = c.site;
      if (rank[c.hzSrc] > rank[l.hzSrc] || (rank[c.hzSrc] === rank[l.hzSrc] && c.t > l.t)) Object.assign(l, { horizon: c.horizon, hzSrc: c.hzSrc, minAlt: c.minAlt });
      l.t = Math.max(l.t, c.t);
    }
    if (c.hzSrc === 'map') l.terr = c.horizon;
    byProfile.set(p.id, l.id);
  }
  out.forEach((l) => { if (l.terr && l.site.skyMap && !l.site.skyMap.terr) l.site.skyMap.terr = l.terr; delete l.terr; delete l.t; });
  return { locs: out, byProfile };
}

/* ============================ configurazioni ============================ */
function setupGeom(cam, optic, fac, bin) {
  const fEff = optic.fl * fac, D = optic.ap, fr = fEff / D, px = 206.265 * cam.pix * bin / fEff;
  let W = 206.265 * cam.pix * cam.w / fEff / 60, H = 206.265 * cam.pix * cam.h / fEff / 60; if (W < H) [W, H] = [H, W];
  return { fEff, D, fr, px, W, H };
}
const siteKey = (s) => `${(+s.lat).toFixed(2)},${(+s.lon).toFixed(2)}`;
function shortOptic(o) { return o.name.replace(/^(William Optics|Sky-Watcher|Celestron|Takahashi|Askar|Lacerta|TS-Optics|Explore Scientific|Obiettivo)\s+/, '').replace(/\s*\(.*\)/, ''); }
/* nome compatto di un setup per la lista: "Photonewton 200/800 + CC GPU 1,0×" */
const abbrAcc = (n) => String(n).replace(/Correttore di coma/i, 'CC').replace(/Riduttore\/spianatore/i, 'rid.').replace(/^Riduttore/i, 'rid.').replace(/^Spianatore/i, 'spian.').replace(/^Starizona\s+/i, '').replace(/Baader\s+/i, '').replace(/Tele Vue\s+/i, '').replace(/\s*\((Newton|SCT)\)/, '');
const abbrOptic = (o) => shortOptic(o).replace(/\s+(carbon|Pro|Deluxe)\b/gi, '').replace(/\s*tripletto/i, '');
/* un profilo produce, per ogni telescopio, una configurazione nativa (se usata) e una per ciascuno dei suoi accessori */
function profileConfigs(p) {
  const out = [], bin = +p.bin || 1, strategies = buildStrategies(p.camera.type, ownedFilters(p));
  for (const o of p.optics || []) {
    const opts = [];
    if (o.useNative !== false || !(o.accessories || []).length) opts.push({ id: 'nat', name: 'nativo', fac: 1 });
    (o.accessories || []).forEach((a) => opts.push({ id: a.id, name: a.name, fac: +a.fac || 1 }));
    for (const a of opts) {
      const g = setupGeom(p.camera, o, a.fac, bin);
      out.push({
        key: p.id + ':' + o.id + ':' + a.id, profileId: p.id, profile: p, optic: o, acc: a, geom: g, strategies,
        label: txName(`${shortOptic(o)}${a.id === 'nat' ? '' : ' + ' + a.name}`),
        tag: txName(`${abbrOptic(o)}${a.id === 'nat' ? '' : ' + ' + abbrAcc(a.name)}`),
        short: `${Math.round(g.fEff)} mm f/${it(g.fr, 1)}`,
      });
    }
  }
  return out;
}

/* ============================ filtri e strategie di ripresa ============================ */
const FDB = window.FILTER_DB || [];
const FDB_BY_ID = new Map(FDB.map((f) => [f.id, f]));
/* righe di emissione: lunghezza d'onda nm, gruppo di appartenenza */
const LINE_WL = [[656.28, 'Ha', 'Ha'], [654.8, 'Ha', 'NIIa'], [658.35, 'Ha', 'NIIb'], [486.13, 'Hb', 'Hb'], [495.9, 'OIII', 'O1'], [500.7, 'OIII', 'O2'], [671.6, 'SII', 'S1'], [673.1, 'SII', 'S2']];
/* righe dell'illuminazione urbana (mercurio e sodio): 25% del fondo cielo, il resto è continuo (LED) */
const LP_LINES = [435.8, 546.1, 577.0, 589.0, 615.0];
function objLines(type) { // flusso di ogni riga in unità di (flusso V-equivalente per 880 Å)
  const L = LINES[type]; if (!L) return [];
  return [[656.28, 'Ha', L.Ha], [654.8, 'Ha', L.Ha * L.NII * 0.25], [658.35, 'Ha', L.Ha * L.NII * 0.75], [486.13, 'Hb', L.Ha / 2.86],
    [495.9, 'OIII', L.OIII * 0.25], [500.7, 'OIII', L.OIII * 0.75], [671.6, 'SII', L.SII * 0.55], [673.1, 'SII', L.SII * 0.45]];
}
LINES.EN.NII = 0.3; LINES.PN.NII = 0.4; LINES.SNR.NII = 0.8; LINES.WR.NII = 0.9; LINES.WRS.NII = 0.3;
function bayer(l) {
  const R = l >= 590 ? 0.9 : l >= 570 ? 0.5 : l >= 540 ? 0.12 : 0.04;
  const G = l >= 490 && l <= 580 ? 0.9 : l >= 470 && l < 490 ? 0.55 : l > 580 && l <= 610 ? 0.35 : 0.05;
  const B = l <= 490 ? 0.9 : l <= 515 ? 0.45 : 0.04;
  return { R, G, B };
}
const PIX_FRAC = { mono: 1, all: 1, R: 0.25, GB: 0.75 };
function wAt(w, l) { if (w === 'mono') return 1; const b = bayer(l); return w === 'R' ? 0.25 * b.R : w === 'GB' ? 0.5 * b.G + 0.25 * b.B : 0.25 * b.R + 0.5 * b.G + 0.25 * b.B; }
const TAt = (f, l) => { for (const [lo, hi, t] of f.bands) if (l >= lo && l <= hi) return t; return 0; };
/* integrali di un canale (filtro × risposta pixel), calcolati una volta */
function channelSpec(f, w, target, extra) {
  let I = 0, lc = 0;
  for (const [lo, hi, t] of f.bands) for (let l = Math.ceil(lo); l <= Math.floor(hi); l++) { const v = t * wAt(w, l); I += v * 10; lc += v * l; }
  const center = I > 0 ? lc * 10 / I : 550;
  const skyL = LP_LINES.reduce((s, l) => s + TAt(f, l) * wAt(w, l), 0);
  const lineW = {}; LINE_WL.forEach(([l, g, k]) => (lineW[k] = TAt(f, l) * wAt(w, l)));
  return { f, w, target, I, skyL, lineW, ext: clamp(0.1 + (656 - center) * 0.0011, 0.08, 0.35), center, mult: 1, snr: 1, ...extra };
}
const CH_LABEL = { all: 'banda larga', L: 'L', R: 'R', G: 'G', B: 'B', Ha: 'Hα', OIII: 'OIII', SII: 'SII', HaO: 'Hα+OIII' };
const fname = (f) => (f.brand && f.brand !== 'Generico' ? f.brand + ' ' : '') + f.name;
const groupsIn = (f) => { const g = new Set(); LINE_WL.forEach(([l, grp]) => { if (TAt(f, l) > 0) g.add(grp); }); return g; };

/* Strategie possibili con un certo insieme di filtri. Ogni strategia è una sequenza di "passi" (un filtro ciascuno);
   dentro un passo le righe arrivano insieme (OSC multibanda) e il tempo è quello del canale più lento. */
function buildStrategies(camType, ownedIds) {
  const owned = ownedIds.map((id) => FDB_BY_ID.get(id)).filter(Boolean);
  const S = [];
  if (camType !== 'mono') {
    const bbs = owned.filter((f) => (f.kind === 'bb' || f.kind === 'lp') && f.for !== 'mono');
    if (!bbs.length) bbs.push(FDB_BY_ID.get('uvir'));
    const multis = owned.filter((f) => f.kind === 'multi' && f.for !== 'mono');
    for (const f of bbs) S.push({ id: 'bb-' + f.id, label: fname(f), short: f.kind === 'lp' ? f.name : 'RGB', suits: 'all', pal: 'natural', penalty: 1, steps: [{ f, ch: [channelSpec(f, 'all', 'all', { key: 'all' })] }] });
    const stepOf = (f) => { const g = groupsIn(f), ch = [];
      if (g.has('Ha')) ch.push(channelSpec(f, 'R', ['Ha'], { key: 'Ha' }));
      if (g.has('SII')) ch.push(channelSpec(f, 'R', ['SII'], { key: 'SII' }));
      if (g.has('OIII')) ch.push(channelSpec(f, 'GB', ['OIII', 'Hb'], { key: 'OIII' }));
      return { f, ch }; };
    for (const f of multis) { const st = stepOf(f); if (st.ch.length) S.push({ id: 'nb-' + f.id, label: fname(f), short: f.name, suits: 'line', pal: groupsIn(f).has('SII') ? 'sho' : 'hoo', penalty: groupsIn(f).has('Ha') ? 1 : 1.5, steps: [st] }); }
    const withHa = multis.filter((f) => groupsIn(f).has('Ha')), withS = multis.filter((f) => groupsIn(f).has('SII'));
    for (const a of withHa) for (const b of withS) if (a !== b) {
      const sa = stepOf(a), sb = stepOf(b); sb.ch = sb.ch.filter((c) => c.key !== 'Ha'); // l'OIII arriva con tutti e due i filtri e si somma
      S.push({ id: `sho-${a.id}-${b.id}`, label: `${fname(a)} + ${fname(b)}`, short: 'SHO', suits: 'line', pal: 'sho', penalty: 0.95, steps: [sa, sb] });
    }
    S.starFilter = bbs[0];
  } else {
    const pick = (ch) => owned.filter((f) => f.for !== 'osc' && f.ch === ch).sort((x, y) => (x.bands[0][1] - x.bands[0][0]) - (y.bands[0][1] - y.bands[0][0]))[0];
    const L = pick('L'), R = pick('R'), G = pick('G'), B = pick('B'), Ha = pick('Ha'), O = pick('OIII'), Si = pick('SII');
    const one = (f, key, target, snr) => ({ f, ch: [channelSpec(f, 'mono', target, { key, snr })] });
    const rgb = R && G && B ? [one(R, 'R', 'all', 0.6 / Math.sqrt(3)), one(G, 'G', 'all', 0.6 / Math.sqrt(3)), one(B, 'B', 'all', 0.6 / Math.sqrt(3))] : null;
    if (L && rgb) S.push({ id: 'lrgb', label: 'LRGB', short: 'LRGB', suits: 'all', pal: 'natural', penalty: 1, steps: [one(L, 'L', 'all', 1), ...rgb] });
    else if (rgb) S.push({ id: 'rgb', label: 'RGB', short: 'RGB', suits: 'all', pal: 'natural', penalty: 1, steps: [R, G, B].map((f, i) => one(f, 'RGB'[i], 'all', 1 / Math.sqrt(3))) });
    else if (L) S.push({ id: 'lum', label: tx('Solo L'), short: 'L', suits: 'all', pal: 'mono', penalty: 1.35, steps: [one(L, 'L', 'all', 1)] });
    if (Ha) S.push({ id: 'ha', label: tx('Solo Hα'), short: 'Hα', suits: 'line', pal: 'ha', penalty: O ? 10 : 1.35, steps: [one(Ha, 'Ha', ['Ha'], 1)] }); // con OIII disponibile resta un'alternativa: si preferisce il colore
    if (Ha && rgb) S.push({ id: 'hargb', label: L ? 'HaLRGB' : 'HaRGB', short: L ? 'HaLRGB' : 'HaRGB', suits: 'line', pal: 'natural', penalty: 1.05, steps: [one(Ha, 'Ha', ['Ha'], 1), ...(L ? [one(L, 'L', 'all', 0.7)] : []), ...rgb] });
    if (Ha && O) S.push({ id: 'hoo', label: 'HOO', short: 'HOO', suits: 'line', pal: 'hoo', penalty: 1, steps: [one(Ha, 'Ha', ['Ha']), one(O, 'OIII', ['OIII'])] });
    if (Ha && O && Si) S.push({ id: 'sho', label: 'SHO', short: 'SHO', suits: 'line', pal: 'sho', penalty: 0.95, steps: [one(Si, 'SII', ['SII']), one(Ha, 'Ha', ['Ha']), one(O, 'OIII', ['OIII'])] });
    const duo = owned.find((f) => f.kind === 'multi' && f.for === 'both');
    if (duo) S.push({ id: 'duo-mono', label: `${fname(duo)} (${tx('Hα+OIII insieme')})`, short: 'HO', suits: 'line', pal: 'ha', penalty: 1.3, steps: [{ f: duo, ch: [channelSpec(duo, 'mono', ['Ha', 'OIII', 'Hb'], { key: 'HaO' })] }] });
    if (!S.length) { const f = { id: 'nofilter', name: tx('senza filtri'), brand: 'Generico', bands: [[400, 700, 1]] }; S.push({ id: 'none', label: tx('Senza filtri'), short: 'L', suits: 'all', pal: 'mono', penalty: 1.35, steps: [one(f, 'L', 'all', 1)] }); }
    S.starFilter = null;
  }
  S.forEach((s) => { s.chs = s.steps.flatMap((st) => st.ch); });
  return S;
}
/* filtri che non possiedi ma che potresti usare con questa camera: servono per il "e se avessi…" */
function alternativeStrategies(camType, ownedIds) {
  const out = [];
  if (camType !== 'mono') {
    FDB.filter((f) => f.for !== 'mono' && !ownedIds.includes(f.id) && f.brand !== 'Generico').forEach((f) => { const s = buildStrategies(camType, [f.id]).find((x) => x.id !== 'bb-uvir'); if (s) { s.alt = f; out.push(s); } });
  } else {
    const series = [...new Set(FDB.filter((f) => f.kind === 'nb' && f.series).map((f) => f.series))];
    series.forEach((se) => { const ids = FDB.filter((f) => f.series === se).map((f) => f.id); if (ids.every((id) => ownedIds.includes(id))) return; const s = buildStrategies('mono', [...ownedIds.filter((id) => !/-(Ha|OIII|SII)$/.test(id)), ...ids]).find((x) => x.id === 'sho' || x.id === 'hoo'); if (s) { s.alt = { name: se, brand: '' }; out.push(s); } });
  }
  return out;
}

/* ============================ orizzonte ============================ */
function horizonLUT(pts) {
  const lut = new Float32Array(361);
  const P = (pts || []).filter((x) => isFinite(x[0]) && isFinite(x[1])).map((x) => [norm360(+x[0]), +x[1]]).sort((a, b) => a[0] - b[0]);
  if (!P.length) return lut; if (P.length === 1) { lut.fill(P[0][1]); return lut; }
  for (let a = 0; a <= 360; a++) {
    const i = P.findIndex((p) => p[0] >= a); let p1, p2;
    if (i === -1) { p1 = P[P.length - 1]; p2 = [P[0][0] + 360, P[0][1]]; } else if (i === 0) { p1 = [P[P.length - 1][0] - 360, P[P.length - 1][1]]; p2 = P[0]; } else { p1 = P[i - 1]; p2 = P[i]; }
    const t = p2[0] === p1[0] ? 0 : (a - p1[0]) / (p2[0] - p1[0]); lut[a] = p1[1] + (p2[1] - p1[1]) * t;
  }
  return lut;
}
function parseHorizon(txt) {
  const out = [];
  for (let line of String(txt).split(/\r?\n/)) {
    line = line.replace(/(#|;|\/\/).*$/, '').trim(); if (!line || /^[a-z_]+\s*=/i.test(line)) continue;
    const n = line.split(/[\s,\t]+/).map(Number).filter((x) => isFinite(x)); if (n.length < 2) continue;
    const az = n[0], alt = n[1]; if (az < -0.01 || az > 360.01 || alt < -10 || alt > 90) continue;
    out.push([Math.round(norm360(az) * 10) / 10, Math.round(clamp(alt, 0, 90) * 10) / 10]);
  }
  const m = new Map(); out.forEach((p) => m.set(p[0], p)); return [...m.values()].sort((a, b) => a[0] - b[0]);
}

/* ============================ notte ============================ */
const STEP = 5, N = 288, DT = STEP * 60000;
function defaultNightStr() { const n = new Date(); const d = new Date(n); if (n.getHours() < 12) d.setDate(d.getDate() - 1); return dateStr(d); }
const dateStr = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function hmToOff(s) { if (!s) return null; const [h, m] = s.split(':').map(Number); return ((h * 60 + m - 720) + 1440) % 1440; }
function computeNight(p, ds, withMoon = true) {
  const [y, m, d] = ds.split('-').map(Number); const t0 = new Date(y, m - 1, d, 12, 0, 0).getTime();
  const lat = p.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lon = +p.site.lon, thr = +p.session.sunThr;
  const t = new Float64Array(N + 1), lst = new Float64Array(N + 1), sun = new Float32Array(N + 1), mAlt = new Float32Array(N + 1), mAz = new Float32Array(N + 1), mIll = new Float32Array(N + 1), mV = [], dark = new Uint8Array(N + 1), darkAll = new Uint8Array(N + 1);
  const f = hmToOff(p.session.from), to = hmToOff(p.session.to);
  let waxing = true;
  for (let i = 0; i <= N; i++) {
    const ms = t0 + i * DT, J = jd(ms); t[i] = ms; lst[i] = lstDeg(ms, lon);
    const s = sunPos(J); sun[i] = altaz(s.ra, s.dec, lst[i], sL, cL)[0];
    if (withMoon) {
      const mo = moonPos(J); const aa = altaz(mo.ra, mo.dec, lst[i], sL, cL);
      mAlt[i] = aa[0] - 0.95 * Math.cos(aa[0] * D2R); mAz[i] = aa[1]; mV.push(unit(mo.ra, mo.dec));
      const el = Math.acos(clamp(Math.cos(mo.lat * D2R) * Math.cos((mo.lon - s.lon) * D2R), -1, 1)); mIll[i] = (1 - Math.cos(el)) / 2; if (i === N / 2) waxing = norm360(mo.lon - s.lon) < 180;
    }
    darkAll[i] = sun[i] < thr ? 1 : 0;
    let inS = true; const off = i * STEP;
    if (f != null && to != null) inS = f <= to ? (off >= f && off <= to) : (off >= f || off <= to); else if (f != null) inS = off >= f; else if (to != null) inS = off <= to;
    dark[i] = darkAll[i] && inS ? 1 : 0;
  }
  const cross = (arr, v, down) => { for (let i = 1; i <= N; i++) { if (down ? (arr[i - 1] >= v && arr[i] < v) : (arr[i - 1] < v && arr[i] >= v)) { return i - 1 + (arr[i - 1] - v) / (arr[i - 1] - arr[i]); } } return null; };
  const sunset = cross(sun, -0.833, true), sunrise = cross(sun, -0.833, false);
  const w0 = sunset != null ? Math.max(0, Math.floor(sunset) - 6) : 0, w1 = sunrise != null ? Math.min(N, Math.ceil(sunrise) + 6) : N;
  let dc = 0, mUp = 0, first = -1, last = -1;
  for (let i = 0; i <= N; i++) if (dark[i]) { dc++; if (first < 0) first = i; last = i; if (mAlt[i] > 0) mUp++; }
  const idxT = (x) => (x == null ? null : t0 + x * DT);
  const mid = first >= 0 ? Math.round((first + last) / 2) : N / 2;
  return {
    t0, t, lst, sun, mAlt, mAz, mIll, mV, dark, darkAll, sL, cL, thr, w0, w1, sunset: idxT(sunset), sunrise: idxT(sunrise),
    darkH: dc * STEP / 60, moonUpFrac: dc ? mUp / dc : 0, moonIll: mIll[mid], waxing, mRise: idxT(cross(mAlt, 0, false)), mSet: idxT(cross(mAlt, 0, true)),
    first, last, ds, J: jd(t0 + N / 2 * DT),
  };
}

/* ============================ cielo del luogo ============================ */
/* Luminosità del cielo per direzione, in unità di 10^(−0,4·mag/″²).
   Zenit: SQM del luogo (atlante Lorenz 2025 o misura). Verso l'orizzonte la parte artificiale cresce con un profilo
   calibrato su una mappa all-sky reale (≈ +1 mag a 3°, +0,1 a 30°) e si concentra verso le sorgenti di luce
   (pesi per settori di 10° di azimut calcolati dall'atlante). La luminescenza naturale parte da 22,0 allo zenit. */
const NAT_ZEN = Math.pow(10, -0.4 * 22.0);
/* griglia (altezze × settori di azimut): interpolazione bilineare, con giro completo in azimut */
function gridAt(alts, naz, vals, h, az) {
  h = clamp(h, alts[0], alts[alts.length - 1]);
  let a = 0; while (a < alts.length - 2 && h > alts[a + 1]) a++;
  const ta = alts[a + 1] === alts[a] ? 0 : clamp((h - alts[a]) / (alts[a + 1] - alts[a]), 0, 1);
  const w = 360 / naz, x = norm360(az) / w - 0.5, k0 = ((Math.floor(x) % naz) + naz) % naz, k1 = (k0 + 1) % naz, tk = x - Math.floor(x);
  const V = (ai, k) => vals[ai * naz + k];
  return (V(a, k0) * (1 - tk) + V(a, k1) * tk) * (1 - ta) + (V(a + 1, k0) * (1 - tk) + V(a + 1, k1) * tk) * ta;
}
/* Tre fonti, dalla più precisa: 1) mappa all-sky importata da lightpollutionmap (magnitudini per direzione, terreno
   compreso); 2) forma stimata dall'atlante Lorenz (griglia relativa allo zenit); 3) solo SQM, profilo medio. */
/* mappe salvate con buchi (valori nulli, per esempio lo zenit delle prime importazioni fisheye): si riempiono dai vicini */
function cleanSkyMap(m) {
  if (m.mag.every((v) => Number.isFinite(v) && v > 5)) return m;
  const nb = m.alts.length, naz = m.naz, mag = m.mag.map((v) => (Number.isFinite(v) && v > 5 ? v : null));
  for (let a = 0; a < naz; a++) {
    let last = null; for (let h = nb - 1; h >= 0; h--) { const i = h * naz + a; if (mag[i] == null) mag[i] = last; else last = mag[i]; }
    last = null; for (let h = 0; h < nb; h++) { const i = h * naz + a; if (mag[i] == null) mag[i] = last; else last = mag[i]; }
  }
  const z = m.zenith || 19; return { ...m, mag: mag.map((v) => (v == null ? z : v)) };
}
function skyModel(site) {
  const map = site.skyMap && Array.isArray(site.skyMap.mag) && Array.isArray(site.skyMap.alts) ? cleanSkyMap(site.skyMap) : null;
  const rel = !map && site.lpGrid && Array.isArray(site.lpGrid.v) ? site.lpGrid : null;
  const g = !map && !rel && Array.isArray(site.lpAz) && site.lpAz.length === 36 ? site.lpAz : null;
  const sqm = +site.sqm || (map && map.zenith) || BORTLE_SQM[site.bortle] || 19;
  // mappa importata: se l'SQM dello zenit è stato corretto a mano, la mappa si sposta dello stesso scarto
  const shift = map ? sqm - map.zenith : 0;
  const art0 = Math.max(0, Math.pow(10, -0.4 * sqm) - NAT_ZEN);
  const NA = 72, A = new Float32Array(91 * NA), Nt = new Float32Array(91);
  for (let h = 0; h <= 90; h++) {
    Nt[h] = NAT_ZEN * (1 + 0.9 * Math.exp(-h / 14));
    for (let k = 0; k < NA; k++) {
      const az = k * 5 + 2.5; let v;
      if (map) v = Math.max(0, Math.pow(10, -0.4 * (gridAt(map.alts, map.naz, map.mag, h, az) + shift)) - Nt[h]);
      else if (rel) v = art0 * gridAt(rel.alts, rel.naz, rel.v, h, az);
      else { const gk = g ? g[Math.floor(az / 10) % 36] : 1, F = 1 + 2.4 * Math.exp(-h / 9); v = art0 * (1 + (F - 1) * gk) * (1 + 0.15 * (gk - 1) * Math.cos(h * D2R)); }
      A[h * NA + k] = v;
    }
  }
  const hi = (h) => clamp(Math.round(h), 0, 90);
  // interpolazione bilineare sulla griglia 1° × 5° (centri dei settori a k·5 + 2,5), con giro completo in azimut
  const art = (h, az) => {
    h = clamp(h, 0, 90); const h0 = Math.min(89, Math.floor(h)), th = h - h0, x = norm360(az) / 5 - 0.5, k0 = ((Math.floor(x) % NA) + NA) % NA, k1 = (k0 + 1) % NA, tk = x - Math.floor(x);
    const r0 = A[h0 * NA + k0] * (1 - tk) + A[h0 * NA + k1] * tk, r1 = A[(h0 + 1) * NA + k0] * (1 - tk) + A[(h0 + 1) * NA + k1] * tk;
    return r0 * (1 - th) + r1 * th;
  };
  return {
    sqm, art0, dir: !!(map || rel || g), source: map ? 'allsky' : rel ? 'atlas' : g ? 'atlas-old' : 'sqm',
    art, nat: (h) => Nt[hi(h)],
    mag: (h, az) => -2.5 * Math.log10(art(h, az) + Nt[hi(h)]),
  };
}

/* ============================ calcolo target ============================ */
const F0 = 1000, MOON0 = Math.pow(10, -0.4 * 17.8);
/* Qualità = SNR per elemento di risoluzione (il più grande tra pixel e 2″) sulla luminosità media dell'oggetto
   e sulle sue parti deboli (FAINT_DELTA mag più deboli); il contesto di polveri va portato al SNR "debole". */
const QUALITY = { quick: { main: 12, faint: 3 }, good: { main: 20, faint: 5 }, great: { main: 30, faint: 8 } };
const FAINT_DELTA = { Gx: 1.5, EN: 1.0, PN: 4.5, SNR: 0.7, RN: 1.0, DN: 0, OC: 0, GC: 0 }; // PN: gli aloni esterni sono 4–5 mag sotto il corpo
/* la polvere è una struttura grande e liscia: si valuta a LS ≥ 25 e con 1,6× il SNR "debole" per non uscire a chiazze */
const DUST_SB = 25.0, DUST_SNR = 1.6;
/* Hα diffuso misurato attorno all'oggetto (mappa Finkbeiner 2003, Rayleigh): 1 R = 10⁶/4π fotoni/s/cm²/sr in Hα
   = 1,87·10⁻⁶ fotoni/s/cm²/″². Conta per nebulose, polveri e ammassi della Via Lattea, non per galassie e globulari. */
const R_TO_PH = 1.87e-6, DIFF_MIN_R = 3, DIFF_REL = 0.02, NO_DIFF = { Gx: 1, GC: 1, PN: 1 };
/* Bolle di Wolf-Rayet: oltre ai filamenti in Hα c'è un guscio esterno quasi solo in OIII, SHELL mag/″² più debole.
   Calibrato su WR 134 (≈ 95 h tra Hα+OIII e SII+OIII a 800 mm f/5 sotto SQM 19,3 per un SNR discreto). */
const SHELL = { WR: 3.2 };
/* polveri che contano davvero per il campo e i tempi: estese rispetto all'oggetto */
const bigDust = (o, c) => (c.type === 'DN' || c.type === 'RN') && c.a >= Math.max(20, 0.5 * o.a);
/* limiti pratici dei sub per tipo di filtro [min, max] s: il minimo fisico lo decide il fondo cielo */
function subLimits(f, fr) {
  if (f.kind === 'nb') { const w = f.bands[0][1] - f.bands[0][0]; return w <= 4.5 ? [300, 900] : [300, 600]; }
  if (f.kind === 'multi') return [180, 600];
  return fr < 4 ? [30, 120] : [60, 180];
}
const moonFlux = (night, i, v) => {
  if (night.mAlt[i] <= 0) return [0, 180];
  const mv = night.mV[i], sp = Math.acos(clamp(mv[0] * v[0] + mv[1] * v[1] + mv[2] * v[2], -1, 1)) * R2D;
  return [MOON0 * Math.pow(night.mIll[i], 3.3) * (0.8 + 3 * Math.exp(-sp / 18)) * clamp(Math.sin(night.mAlt[i] * D2R) * 1.6, 0, 1), sp];
};
/* campo da inquadrare: oggetto più le polveri/nebulosità deboli che lo circondano */
/* Estensione reale di oggetto + contesto: punti delle ellissi (il contesto all'85%, i bordi sono i più deboli),
   asse principale dalla loro distribuzione, lunghezze lungo e attraverso quell'asse. */
function fieldOf(o) {
  if (!o.ctx.length) return { a: o.a, b: o.b, ctx: [] };
  const ctx = [], pts = ellipsePts(0, 0, o.a, o.b, o.pa || 0, 12);
  for (const id of o.ctx) {
    const c = CAT_BY_ID.get(id); if (!c) continue;
    if ((c.type === 'DN' || c.type === 'RN') && !bigDust(o, c)) continue;
    ctx.push(c); const [x, y] = offsetOf(o, c); ellipsePts(x, y, c.a * 0.85, c.b * 0.85, c.pa || 0, 12).forEach((p) => pts.push(p));
  }
  if (!ctx.length) return { a: o.a, b: o.b, ctx: [] };
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0; pts.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)], v = [-u[1], u[0]];
  const along = pts.map(([x, y]) => x * u[0] + y * u[1]), across = pts.map(([x, y]) => x * v[0] + y * v[1]);
  const a = Math.min(300, Math.max(...along) - Math.min(...along)), b = Math.min(300, Math.max(...across) - Math.min(...across));
  return { a: Math.max(a, b, o.a), b: Math.max(Math.min(a, b), o.b), ctx };
}
function fillInfo(o, g, field) {
  const F = field && field.ctx.length ? field : { a: o.a, b: o.b, ctx: [] };
  const r = Math.max(F.a / g.W, F.b / g.H), objPx = o.a * 60 / g.px, withCtx = F.ctx.length > 0;
  if (withCtx && r > 1.05 && r <= 1.8) return { r, objPx, score: 0.9, label: tx('Riempie il campo'), sub: tx('le polveri escono dal bordo'), nx: 1, ny: 1, field: F };
  if (r > 1.05) {
    const nx = Math.max(1, Math.ceil((F.a * 1.05 - g.W * 0.1) / (g.W * 0.9))), ny = Math.max(1, Math.ceil((F.b * 1.05 - g.H * 0.1) / (g.H * 0.9))), n = nx * ny;
    if (n === 1) return { r, objPx, score: 0.8, label: tx('Riempie tutto'), sub: tx('bordi al limite'), nx, ny, field: F };
    return { r, objPx, score: 0.75 / Math.pow(n, 0.8), label: tx('Mosaico {n}', { n: `${nx}×${ny}` }), sub: tx(withCtx ? 'con le polveri attorno' : 'più grande del campo'), nx, ny, field: F };
  }
  if (r >= 0.9) return { r, objPx, score: 0.88, label: tx('Riempie il campo'), sub: tx('{p}% del lato', { p: Math.round(r * 100) }), nx: 1, ny: 1, field: F };
  if (r >= 0.35) return { r, objPx, score: 1, label: tx('Inquadratura ideale'), sub: withCtx ? tx('con le polveri attorno') : tx('{p}% del lato', { p: Math.round(r * 100) }), nx: 1, ny: 1, field: F };
  const base = Math.pow(r / 0.35, 0.9), crop = clamp(objPx / 900, 0, 0.8);
  if (crop > base) return { r, objPx, score: crop, label: tx('Piccolo, da ritagliare'), sub: tx('{n} px di diametro', { n: Math.round(objPx) }), nx: 1, ny: 1, field: F };
  return { r, objPx, score: base, label: tx(r < 0.1 ? 'Molto piccolo' : 'Piccolo'), sub: r < 0.1 ? tx('{n} px di diametro', { n: Math.round(objPx) }) : tx('{p}% del lato', { p: Math.round(r * 100) }), nx: 1, ny: 1, field: F };
}
/* costanti di una configurazione, indipendenti dall'oggetto */
function configConst(cfg) {
  const p = cfg.profile, g = cfg.geom;
  const qe = (+p.camera.qe || 70) / 100, rn = +p.camera.rn || 2, dark = p.camera.type === 'dslr' ? 0.05 : 0.003;
  const Dcm = g.D / 10, obs = (+cfg.optic.obs || 0) / 100, Aeff0 = Math.PI * Dcm * Dcm / 4 * (1 - obs * obs) * 0.85 * qe;
  const res = Math.max(g.px, 2.0), area = res * res, npix = Math.pow(res / g.px, 2);
  return { Aeff0, geo: Aeff0 * area, npix, rn, dark, fr: g.fr, pxArea: g.px * g.px, haMul: p.camera.type === 'dslr' ? 0.3 : 1 };
}
/* segnale di un canale da un "livello" di oggetto (tipo, LS), fotoni/s per elemento di risoluzione a massa d'aria 1 */
function chanSignal(c, type, sb, K) {
  const L = LINES[type], base = F0 * Math.pow(10, -0.4 * sb), cont = L ? L.cont : 1;
  let lines = 0; const tg = c.target;
  if (L) for (const [, g, fl, key] of OBJ_LINES[type]) if (tg === 'all' || tg.includes(g)) lines += fl * (g === 'Ha' ? K.haMul : 1) * c.lineW[key];
  return base * (cont * c.I + 880 * lines) * K.geo;
}
function chanStrength(c, type) { // intensità delle righe che il filtro lascia passare: decide quanto SNR chiedere al canale
  const L = LINES[type]; if (!L || c.target === 'all') return 1;
  return OBJ_LINES[type].filter((x) => c.target.includes(x[1]) && c.lineW[x[3]] > 0.02).reduce((s, x) => s + x[2], 0);
}
const OBJ_LINES = {};
for (const t of Object.keys(LINES)) OBJ_LINES[t] = objLines(t).map((x, i) => [x[0], x[1], x[2], ['Ha', 'NIIa', 'NIIb', 'Hb', 'O1', 'O2', 'S1', 'S2'][i]]);

/* Valuta le strategie su un oggetto. U: passi utili della notte (massa d'aria, cielo artificiale e naturale nella direzione
   dell'oggetto, luce lunare). T: cielo al transito senza Luna, per il tempo "ideale". */
function evalStrategies(o, S, K, U, Q, T, field) {
  const lines = LINES[o.lk];
  const qMain = o.type === 'DN' ? Q.faint * DUST_SNR : Q.main * (TYPE_SNR[o.type] || 1), sbMain = o.type === 'DN' ? Math.max(o.sb, DUST_SB) : o.sb;
  const dust = field.ctx.filter((c) => bigDust(o, c)).sort((a, b) => a.sb - b.sb)[0];
  const faintHa = field.ctx.filter((c) => c.type === 'EN').sort((a, b) => a.sb - b.sb)[0];
  const bbS = S.find((s) => s.suits === 'all');
  const ef = T.ef || 1; // estinzione ridotta con la quota del luogo
  const haObj = lines ? F0 * Math.pow(10, -0.4 * o.sb) * 880 * LINES[o.lk].Ha : 0;
  const diffOn = o.ha >= DIFF_MIN_R && !NO_DIFF[o.type] && lines && R_TO_PH * o.ha >= DIFF_REL * haObj;
  const smax = lines ? Math.max(...['Ha', 'OIII', 'SII'].map((g) => OBJ_LINES[o.lk].filter((x) => x[1] === g).reduce((a, x) => a + x[2], 0))) : 1;
  const avg = { art: 0, nat: 0, mf: 0 }; for (let u = 0; u < U.n; u++) { avg.art += U.art[u]; avg.nat += U.nat[u]; avg.mf += U.mf[u]; }
  if (U.n) { avg.art /= U.n; avg.nat /= U.n; avg.mf /= U.n; } else { avg.art = T.art; avg.nat = T.nat; }
  return S.filter((s) => s.suits === 'all' || lines).map((s0) => {
    // banda stretta su un oggetto con polveri attorno: si aggiunge la banda larga per le polveri
    let s = s0;
    if (s0.suits === 'line' && dust && bbS && !s0.chs.some((c) => c.target === 'all')) s = { ...s0, label: `${s0.label} + ${bbS.label}`, short: s0.short + '+RGB', steps: s0.steps.concat(bbS.steps.map((st) => ({ ...st, purpose: 'dust' }))) };
    const reqs = []; // per canale: [{ S, snr, what }]
    const chans = [];
    s.steps.forEach((st) => st.ch.forEach((c) => {
      const R = [];
      if (st.purpose !== 'dust') {
        const w = c.target === 'all' ? 1 : clamp(Math.sqrt(chanStrength(c, o.lk) / smax), 0.35, 1);
        R.push({ S: chanSignal(c, o.lk, sbMain, K), snr: qMain * w * (c.snr || 1), what: 'main' });
        if (FAINT_DELTA[o.type] > 0) R.push({ S: chanSignal(c, o.lk, o.sb + FAINT_DELTA[o.type], K), snr: Q.faint * w * (c.snr || 1), what: 'faint' });
        if (faintHa && (c.target === 'all' || c.target.includes('Ha'))) R.push({ S: chanSignal(c, 'EN', faintHa.sb, K), snr: Q.faint * (c.snr || 1), what: 'ctxHa' });
        if (SHELL[o.lk] && (c.target === 'all' || c.target.includes('OIII'))) R.push({ S: chanSignal(c, 'WRS', o.sb + SHELL[o.lk], K), snr: Q.faint * (c.snr || 1), what: 'shell' });
        // Hα diffuso: solo sui canali a banda stretta e solo se nel campo si vede (≥ 2% dell'Hα dell'oggetto). Va nel tempo "profondo".
        if (diffOn && c.target !== 'all' && c.target.includes('Ha') && c.lineW.Ha > 0.02)
          R.push({ S: R_TO_PH * o.ha * K.haMul * (c.lineW.Ha + 0.3 * (0.25 * c.lineW.NIIa + 0.75 * c.lineW.NIIb)) * K.geo, snr: Q.faint * (c.snr || 1), what: 'diffHa', deep: true });
      }
      if (dust && c.target === 'all') R.push({ S: chanSignal(c, 'DN', Math.max(dust.sb, DUST_SB), K), snr: Q.faint * DUST_SNR * (c.snr || 1), what: 'dust' });
      // sub: minimo perché il fondo cielo (con la Luna di stanotte) copra 10× il rumore di lettura; poi limiti pratici del filtro
      const skyPx = F0 * K.Aeff0 * K.pxArea * ((0.75 * c.I + 44 * c.skyL) * avg.art + c.I * (avg.nat + avg.mf)) / PIX_FRAC[c.w];
      const minSub = 10 * K.rn * K.rn / Math.max(1e-9, skyPx), [lo, hi] = subLimits(c.f || st.f, K.fr);
      const sub = niceSub(clamp(minSub * 6, lo, hi));
      const Nc = K.dark * K.npix + K.npix * K.rn * K.rn / sub;
      const Blp = F0 * K.geo * (0.75 * c.I + 44 * c.skyL), Bc = F0 * K.geo * c.I;
      chans.push({ c, st, R, sub, minSub, Nc, Blp, Bc, acc: new Float64Array(R.length) });
    }));
    for (let u = 0; u < U.n; u++) {
      const X = U.X[u];
      for (const ch of chans) {
        const B = ch.Blp * U.art[u] + ch.Bc * (U.nat[u] + U.mf[u]) + ch.Nc, ex = Math.pow(10, -0.4 * ch.c.ext * ef * (X - 1));
        for (let q = 0; q < ch.R.length; q++) { const Sg = ch.R[q].S * ex; ch.acc[q] += Sg * Sg / (Sg + B); }
      }
    }
    // ore per requisito: [ideale, stanotte]
    const hours = (ch, k) => {
      const q = ch.R[k], exT = Math.pow(10, -0.4 * ch.c.ext * ef * (T.X - 1)), BT = ch.Blp * T.art + ch.Bc * T.nat + ch.Nc;
      const Sg = q.S * exT, rI = Sg * Sg / (Sg + BT), need = q.snr * q.snr, rT = U.n ? ch.acc[k] / U.n : 0;
      return [need / rI / 3600 * ch.c.mult, rT > 0 ? need / rT / 3600 * ch.c.mult : Infinity];
    };
    let ci = 0;
    const X = s.steps.map((st) => ({ st, chs: st.ch.map(() => chans[ci++]), hI: 0, hT: 0, hID: 0, hTD: 0, drive: '', driveDeep: '' }));
    // requisiti raggruppati per canale: lo stesso canale può comparire in più passi (l'OIII di due multibanda)
    const groups = new Map();
    X.forEach((x) => x.chs.forEach((ch) => ch.R.forEach((q, k) => {
      const id = ch.c.key + '|' + q.what; if (!groups.has(id)) groups.set(id, { q, on: [] });
      groups.get(id).on.push([x, hours(ch, k)]);
    })));
    // requisito di un solo passo: il passo dura quanto il requisito più lento
    for (const { q, on } of groups.values()) {
      if (on.length > 1) continue;
      const [x, [hi, ht]] = on[0];
      if (!q.deep) { if (hi > x.hI) { x.hI = hi; x.drive = q.what; } x.hT = Math.max(x.hT, ht); }
      if (hi > x.hID) { x.hID = hi; x.driveDeep = q.what; } x.hTD = Math.max(x.hTD, ht);
    }
    // requisito in più passi: i segnali si sommano. Il tempo che ancora manca va ai passi che raccolgono quel canale
    // più in fretta (entro il 15%), pareggiandone le ore.
    for (const { q, on } of groups.values()) {
      if (on.length < 2) continue;
      const fill = (f, j, dr) => {
        let deficit = 1 - on.reduce((a, [x, t]) => a + x[f] / t[j], 0);
        if (!(deficit > 0)) return;
        const tMin = Math.min(...on.map(([, t]) => t[j])); if (!isFinite(tMin)) { on.forEach(([x]) => (x[f] = Infinity)); return; }
        const cand = on.filter(([, t]) => t[j] <= tMin * 1.15);
        for (let it = 0; it < 8 && deficit > 1e-9; it++) {
          const lvl = Math.min(...cand.map(([x]) => x[f])), low = cand.filter(([x]) => x[f] <= lvl + 1e-9);
          const next = Math.min(...cand.filter(([x]) => x[f] > lvl + 1e-9).map(([x]) => x[f]));
          const rate = low.reduce((a, [, t]) => a + 1 / t[j], 0), d = Math.min(deficit / rate, next - lvl);
          low.forEach(([x]) => { x[f] += d; if (dr) x[dr] = q.what; }); deficit -= d * rate;
        }
      };
      if (!q.deep) { fill('hI', 0, 'drive'); fill('hT', 1); }
      fill('hID', 0, 'driveDeep'); fill('hTD', 1);
    }
    let ideal = 0, tonight = 0, idealDeep = 0, tonightDeep = 0;
    const steps = X.map((x) => {
      x.hID = Math.max(x.hID, x.hI); x.hTD = Math.max(x.hTD, x.hT);
      ideal += x.hI; tonight += x.hT; idealDeep += x.hID; tonightDeep += x.hTD;
      return { f: x.st.f, keys: x.st.ch.map((c) => c.key), hI: x.hI, hT: x.hT, hID: x.hID, hTD: x.hTD, subs: x.chs.map((ch) => ({ key: ch.c.key, s: ch.sub, min: Math.round(ch.minSub) })), purpose: x.st.purpose || '', drive: x.drive, driveDeep: x.driveDeep };
    });
    const nights = U.h > 0 ? tonight / U.h : Infinity;
    return { id: s.id, label: s.label, short: s.short, pal: s.pal, penalty: s.penalty, steps, ideal, tonight, nights, idealDeep, tonightDeep, deep: idealDeep > ideal * 1.15, alt: s0.alt, lineOnly: s0.suits === 'line', hybrid: s !== s0 };
  });
}
/* Sotto un cielo non buio l'emissione si riprende in banda stretta (la banda larga resta per stelle e polveri):
   il solo SNR premierebbe la banda larga quando le polveri la rendono comunque necessaria, ma il contrasto delle
   strutture in Hα/OIII sotto l'inquinamento luminoso non lo misura. */
function pickBest(strat, preferLine) {
  const pool = preferLine && strat.some((s) => s.lineOnly) ? strat.filter((s) => s.lineOnly) : strat;
  let best = null; for (const s of pool) { const k = (isFinite(s.tonight) ? s.tonight : s.ideal) * s.penalty; if (!best || k < best._k) { best = s; best._k = k; } } return best;
}
/* mosaico: ogni pannello richiede lo stesso tempo */
function scalePanels(strat, n) {
  if (n <= 1) return strat;
  strat.forEach((s) => { s.panels = n; s.ideal *= n; s.tonight *= n; s.nights *= n; s.idealDeep *= n; s.tonightDeep *= n; s.steps.forEach((st) => { st.hI *= n; st.hT *= n; st.hID *= n; st.hTD *= n; }); });
  return strat;
}

/* Il calcolo di una notte si prepara una volta (notte, orizzonte, cielo, configurazioni) e poi si fa oggetto per oggetto:
   così il confronto con gli altri luoghi può girare a piccoli pezzi senza bloccare l'interfaccia. */
function computePrep(cfgs, active, ds, now) {
  const night = computeNight(active, ds);
  const lut = horizonLUT(active.horizon), minAlt = +active.session.minAlt || 0;
  const sky = skyModel(active.site);
  const nowIn = now >= night.t[0] && now <= night.t[N];
  return {
    cfgs, active, night, lut, minAlt, sky, Q: QUALITY[active.session.quality] || QUALITY.good, consts: cfgs.map(configConst),
    nowIn, nowLst: lstDeg(now, +active.site.lon), minDec: active.site.lat - 90 + minAlt,
    alt: new Float32Array(N + 1), az: new Float32Array(N + 1),
    U: { X: new Float32Array(N + 1), art: new Float32Array(N + 1), nat: new Float32Array(N + 1), mf: new Float32Array(N + 1), n: 0, h: 0 },
  };
}
function computeObj(C, o) {
  const { cfgs, active, night, lut, minAlt, sky, Q, consts, alt, az, U } = C;
  if (active.site.lat >= 0 ? o.dec < C.minDec - 0.5 : o.dec > -C.minDec + 0.5) return null; // non sale mai sopra l'altezza minima
  const pr = precess(o.ra, o.dec, night.J), v = unit(pr.ra, pr.dec);
  const use = new Uint8Array(N + 1), blk = new Float32Array(N + 1);
  let maxA = -99, maxI = -1, first = -1, last = -1, minSep = 180, maxAll = -99, riseBlocked = -1; U.n = 0;
  for (let i = 0; i <= N; i++) {
    const aa = altaz(pr.ra, pr.dec, night.lst[i], night.sL, night.cL), a = aa[0], z = aa[1];
    alt[i] = a; az[i] = z; if (a > maxAll) maxAll = a;
    const b = Math.max(minAlt, lut[Math.round(z) % 360]); blk[i] = b;
    if (i >= night.w0 && i <= night.w1 && night.darkAll[i] && a > maxA) { maxA = a; maxI = i; }
    if (night.dark[i] && a >= minAlt && a < b && first < 0 && riseBlocked < 0) riseBlocked = i;
    if (night.dark[i] && a >= b) {
      use[i] = 1; if (first < 0) first = i; last = i;
      const [mf, sp] = moonFlux(night, i, v); if (mf > 0 && sp < minSep) minSep = sp;
      U.X[U.n] = airmass(a); U.art[U.n] = sky.art(a, z); U.nat[U.n] = sky.nat(a); U.mf[U.n] = mf; U.n++;
    }
  }
  if (maxAll < minAlt) return null;
  if (maxI < 0) for (let i = night.w0; i <= night.w1; i++) if (alt[i] > maxA) { maxA = alt[i]; maxI = i; }
  U.h = U.n * STEP / 60;
  const usableH = U.h, altT = clamp(maxA, 20, 90), azT = maxI >= 0 ? az[maxI] : 180;
  const T = { X: airmass(altT), art: sky.art(altT, azT), nat: sky.nat(altT), ef: Math.exp(-(+active.site.elev || 0) / 8000) };
  const field = fieldOf(o);
  const vis = usableH > 0 ? Math.pow(Math.min(1, usableH / 4.5), 0.7) : 0;
  const evals = cfgs.map((cfg, ci) => {
    const fill = fillInfo(o, cfg.geom, field);
    const strat = scalePanels(evalStrategies(o, cfg.strategies, consts[ci], U, Q, T, field), fill.nx * fill.ny);
    const best = pickBest(strat, !!LINES[o.lk] && sky.sqm < 21);
    let effort = 0.05; if (best) { const n = isFinite(best.nights) ? best.nights : 99; effort = n <= 1 ? 1 : 1 / Math.sqrt(n); }
    const score = vis > 0 ? Math.round(100 * Math.pow(fill.score, 0.45) * Math.pow(vis, 0.35) * Math.pow(effort, 0.3)) : 0;
    return { cfg, ci, strat, best, fill, effort, score, K: consts[ci] };
  });
  let bestE = evals[0]; for (const e of evals) if (e.score > bestE.score) bestE = e;
  let nowAlt = null, nowAz = null, nowUse = false;
  if (C.nowIn) { const aa = altaz(pr.ra, pr.dec, C.nowLst, night.sL, night.cL); nowAlt = aa[0]; nowAz = aa[1]; nowUse = nowAlt >= Math.max(minAlt, lut[Math.round(nowAz) % 360]); }
  const skyMag = U.n ? -2.5 * Math.log10(U.art.slice(0, U.n).reduce((a, x) => a + x, 0) / U.n + U.nat.slice(0, U.n).reduce((a, x) => a + x, 0) / U.n) : null;
  return { o, pr, v, alt: alt.slice(), az: az.slice(), use, blk, usableH, maxA, maxI, maxAll, first, last, minSep, riseBlocked, vis, evals, e: bestE, score: bestE.score, nowAlt, nowAz, nowUse, T, field, skyMag };
}
function computeAll(cfgs, active, ds, now) {
  const C = computePrep(cfgs, active, ds, now), out = [];
  for (const o of CAT) { const r = computeObj(C, o); if (r) out.push(r); }
  return { night: C.night, results: out, lut: C.lut, sky: C.sky, sqm: C.sky.sqm, Q: C.Q };
}
/* ore per un target in una configurazione: quelle con le condizioni di stanotte, altrimenti senza Luna e al transito */
const hoursOf = (b) => (b ? (isFinite(b.tonight) ? b.tonight : b.ideal) : Infinity);
/* ricostruisce i passi utili di un oggetto (per le valutazioni "e se…" nel dettaglio) */
function usableSteps(r, night, sky) {
  const U = { X: new Float32Array(N + 1), art: new Float32Array(N + 1), nat: new Float32Array(N + 1), mf: new Float32Array(N + 1), n: 0, h: 0 };
  for (let i = 0; i <= N; i++) if (r.use[i]) { U.X[U.n] = airmass(r.alt[i]); U.art[U.n] = sky.art(r.alt[i], r.az[i]); U.nat[U.n] = sky.nat(r.alt[i]); U.mf[U.n] = moonFlux(night, i, r.v)[0]; U.n++; }
  U.h = U.n * STEP / 60; return U;
}

/* ============================ finestre senza Luna e stagionalità ============================ */
/* Per le prossime notti: frazione del buio con la Luna sopra l'orizzonte, pesata per la fase. */
function moonCalendar(p, fromDs, nights) {
  const out = []; const [y, m, d] = fromDs.split('-').map(Number);
  const lat = p.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lon = +p.site.lon, thr = +p.session.sunThr;
  for (let k = 0; k < nights; k++) {
    const t0 = new Date(y, m - 1, d + k, 12, 0, 0).getTime(); let dark = 0, moonW = 0, ill = 0;
    for (let i = 0; i <= 144; i++) {
      const ms = t0 + i * 600000, J = jd(ms), lst = lstDeg(ms, lon), s = sunPos(J);
      if (altaz(s.ra, s.dec, lst, sL, cL)[0] >= thr) continue;
      dark++; const mo = moonPos(J); const ma = altaz(mo.ra, mo.dec, lst, sL, cL)[0];
      if (ma > 0) { const el = Math.acos(clamp(Math.cos(mo.lat * D2R) * Math.cos((mo.lon - s.lon) * D2R), -1, 1)); ill = (1 - Math.cos(el)) / 2; moonW += ill; }
    }
    out.push({ t0, ds: dateStr(new Date(t0)), darkH: dark / 6, moon: dark ? moonW / dark : 0 });
  }
  return out;
}
function darkWindows(cal) { // notti consecutive in cui la Luna pesa poco
  const w = []; let cur = null;
  cal.forEach((n) => { const good = n.moon < 0.12 && n.darkH > 0.5; if (good) { if (!cur) cur = { from: n.t0, to: n.t0, n: 0 }; cur.to = n.t0; cur.n++; } else if (cur) { w.push(cur); cur = null; } });
  if (cur) w.push(cur); return w;
}
/* ore utili (buio, sopra altezza minima e orizzonte, senza Luna) nella notte che inizia a mezzogiorno t0 */
function nightHoursFor(o, p, lut, t0) {
  const lat = p.site.lat * D2R, sL = Math.sin(lat), cL = Math.cos(lat), lon = +p.site.lon, thr = +p.session.sunThr, minAlt = +p.session.minAlt || 0;
  const pr = precess(o.ra, o.dec, jd(t0)); let h = 0;
  for (let i = 0; i <= 144; i++) {
    const ms = t0 + i * 600000, J = jd(ms), lst = lstDeg(ms, lon), s = sunPos(J);
    if (altaz(s.ra, s.dec, lst, sL, cL)[0] >= thr) continue;
    const [a, z] = altaz(pr.ra, pr.dec, lst, sL, cL);
    if (a >= Math.max(minAlt, lut[Math.round(z) % 360])) h += 1 / 6;
  }
  return h;
}
/* per il 15 di ogni mese dei prossimi 12 */
function seasonality(o, p, lut) {
  const now = new Date(), res = [];
  for (let k = 0; k < 12; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 15, 12, 0, 0), t0 = d.getTime();
    res.push({ t0, y: d.getFullYear(), m: d.getMonth(), h: nightHoursFor(o, p, lut, t0), label: d.toLocaleDateString(LOCALE, { month: 'short' }) });
  }
  return res;
}
/* Periodo giusto di un target: le notti (campionate ogni 3 giorni per un anno) con almeno il 75% delle ore massime.
   Restituisce il primo periodo da oggi in avanti (o quello in corso) e la prima notte senza Luna al suo interno. */
function bestPeriod(o, p, lut, fromDs) {
  const [y, m, d] = fromDs.split('-').map(Number), pts = [];
  for (let k = 0; k <= 366; k += 3) { const t0 = new Date(y, m - 1, d + k, 12, 0, 0).getTime(); pts.push({ t0, k, h: nightHoursFor(o, p, lut, t0) }); }
  const max = Math.max(...pts.map((x) => x.h)), now = pts[0].h;
  if (max < 0.5) return { max, now, none: true };
  const thr = Math.max(0.5, 0.75 * max);
  let i = pts.findIndex((x) => x.h >= thr); const inNow = i === 0;
  let j = i; while (j + 1 < pts.length && pts[j + 1].h >= thr) j++;
  // dentro il periodo in corso si guarda anche fino a quando dura; se inizia fra poco si affina al giorno
  let fromT = pts[i].t0;
  if (!inNow) for (let k = pts[i].k - 2; k < pts[i].k; k++) { const t0 = new Date(y, m - 1, d + k, 12, 0, 0).getTime(); if (nightHoursFor(o, p, lut, t0) >= thr) { fromT = t0; break; } }
  const toT = pts[j].t0, peak = pts.slice(i, j + 1).reduce((a, x) => (x.h > a.h ? x : a), pts[i]);
  const cal = moonCalendar(p, dateStr(new Date(fromT)), Math.min(45, Math.round((toT - fromT) / 864e5) + 1));
  const dark = cal.find((n) => n.moon < 0.03 && n.darkH > 0.5); // Luna assente o quasi (sotto l'orizzonte o sottile)
  return { max, now, inNow, thr, from: fromT, to: toT, peak: peak.t0, peakH: peak.h, dark: dark ? dark.t0 : null, darkH: dark ? nightHoursFor(o, p, lut, dark.t0) : 0 };
}
const NICE_SUBS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900];
const niceSub = (s) => NICE_SUBS.reduce((b, v) => (Math.abs(Math.log(v / s)) < Math.abs(Math.log(b / s)) ? v : b), 180);

/* ============================ inquadratura: rotazione e centro migliori ============================ */
/* Piano tangente in primi d'arco: x verso est, y verso nord. PA da nord verso est. */
function offsetOf(o, c) { const d = Math.cos(o.dec * D2R); return [((c.ra - o.ra + 540) % 360 - 180) * d * 60, (c.dec - o.dec) * 60]; }
function ellipsePts(cx, cy, a, b, pa, n) {
  const u = [Math.sin(pa * D2R), Math.cos(pa * D2R)], v = [u[1], -u[0]], out = [[cx, cy]];
  for (const f of [0.35, 0.7, 1]) for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI, p = a / 2 * f * Math.cos(t), q = b / 2 * f * Math.sin(t); out.push([cx + p * u[0] + q * v[0], cy + p * u[1] + q * v[1]]); }
  return out;
}
/* Prova tutte le rotazioni (passo 1°) e alcuni centri fra l'oggetto e le sue polveri; massimizza quanta parte di oggetto
   (peso pieno, deve restare tutto dentro) e di contesto (peso minore) cade nel sensore. */
function framingFor(o, field, g) {
  const main = ellipsePts(0, 0, o.a, o.b, o.pa || 0, 16).map((p) => [...p, 1]);
  const ctxPts = [];
  (field.ctx || []).forEach((c) => { const [x, y] = offsetOf(o, c); ellipsePts(x, y, c.a, c.b, c.pa || 0, 12).forEach((p) => ctxPts.push([...p, 0.5 / Math.max(1, field.ctx.length)])); });
  const all = main.concat(ctxPts);
  const cen = ctxPts.length ? [ctxPts.reduce((s, p) => s + p[0], 0) / ctxPts.length, ctxPts.reduce((s, p) => s + p[1], 0) / ctxPts.length] : [0, 0];
  const elong = o.a / o.b > 1.12 || ctxPts.length;
  let best = null;
  for (const f of ctxPts.length ? [0, 0.2, 0.35, 0.5, 0.65, 0.8] : [0]) {
    const c0 = [cen[0] * f, cen[1] * f];
    for (let th = 0; th < 180; th += elong ? 1 : 90) {
      const u = [Math.sin(th * D2R), Math.cos(th * D2R)], v = [u[1], -u[0]];
      let s = 0, mIn = 0, cIn = 0, margin = Infinity, cMargin = Infinity;
      for (const [x, y, w] of all) {
        const dx = x - c0[0], dy = y - c0[1], mu = g.W / 2 - Math.abs(dx * u[0] + dy * u[1]), mv = g.H / 2 - Math.abs(dx * v[0] + dy * v[1]);
        if (mu >= 0 && mv >= 0) { s += w; if (w === 1) mIn++; else cIn++; }
        if (w === 1) margin = Math.min(margin, mu, mv); else cMargin = Math.min(cMargin, mu, mv);
      }
      // a parità di copertura vince il margine dai bordi (oggetto, poi contesto): l'asse maggiore va sul lato lungo
      const mainFrac = mIn / main.length, score = s - (mainFrac < 0.98 ? (1 - mainFrac) * 20 : 0) + 0.02 * clamp(margin / g.H, -1, 1) + (ctxPts.length ? 0.01 * clamp(cMargin / g.H, -1, 1) : 0);
      if (!best || score > best.score + 1e-9) best = { score, pa: th, dx: c0[0], dy: c0[1], mainFrac, ctxFrac: ctxPts.length ? cIn / ctxPts.length : null };
    }
  }
  const ra = o.ra + best.dx / 60 / Math.cos(o.dec * D2R), dec = o.dec + best.dy / 60;
  return { ...best, ra: (ra + 360) % 360, dec, free: !elong };
}
function framingTip(o, fr, field) {
  if (fr.free) return tx('Oggetto quasi rotondo: la rotazione è libera, scegli quella che mette le stelle brillanti fuori dal campo.');
  const dist = Math.hypot(fr.dx, fr.dy), dir = azName((Math.atan2(fr.dx, fr.dy) * R2D + 360) % 360);
  let t = tx('Lato lungo del sensore a PA {pa}° (da nord verso est)', { pa: fr.pa });
  if (field.ctx.length && dist > 2) t += tx(', centro spostato di {d}′ verso {dir} ({ra} {dec})', { d: Math.round(dist), dir, ra: raStr(fr.ra), dec: decStr(fr.dec) });
  t += tx(': entra il {p}% dell’oggetto', { p: Math.round(fr.mainFrac * 100) });
  if (fr.ctxFrac != null) t += tx(' e il {p}% di {ids}', { p: Math.round(fr.ctxFrac * 100), ids: field.ctx.map((c) => c.id).join(', ') });
  return t + tx('. Se il tuo software indica l’angolo del lato corto, aggiungi 90°.');
}

/* ============================ piano e consigli ============================ */
const KEY_LABEL = { all: 'banda larga', L: 'L', R: 'R', G: 'G', B: 'B', Ha: 'Hα', OIII: 'OIII', SII: 'SII', HaO: 'Hα+OIII' };
const DRIVE_LABEL = { main: 'parte principale', faint: 'parti deboli', dust: 'polveri attorno', ctxHa: 'nebulosità deboli attorno', diffHa: 'Hα diffuso attorno', shell: 'guscio OIII' };
/* Piano di ripresa: un passo per filtro con ore e sub. Si usa una sola strategia, non tutti i filtri che hai:
   l'unica aggiunta è la banda larga per le stelle quando il piano OSC è solo in banda stretta. */
function planOf(s, cfg, useTonight) {
  if (!s) return null;
  const rows = s.steps.map((st) => ({
    filter: fname(st.f), what: st.purpose === 'dust' ? tx('polveri e stelle') : st.keys.map((k) => tx(KEY_LABEL[k])).join(' + '),
    h: useTonight && isFinite(st.hT) ? st.hT : st.hI, hDeep: useTonight && isFinite(st.hTD) ? st.hTD : st.hID,
    sub: st.subs.map((x) => x.s).reduce((a, b) => Math.max(a, b), 0), drive: tx(DRIVE_LABEL[st.drive] || ''), driveDeep: tx(DRIVE_LABEL[st.driveDeep] || ''),
  }));
  const star = cfg.strategies.starFilter;
  if (s.lineOnly && !s.hybrid && star && cfg.profile.camera.type !== 'mono') {
    const tot = rows.reduce((a, r) => a + r.h, 0);
    const h = clamp(tot * 0.1, 1, 4); rows.push({ filter: fname(star), what: tx('stelle a colori'), h, hDeep: h, sub: 60, optional: true, drive: '' });
  }
  return rows;
}
function adviceFor(r, e, ctx) {
  const o = r.o, n = ctx.night, tips = [];
  const b = e.best, g = e.cfg.geom;
  if (b && isFinite(b.tonight) && b.ideal > 0) {
    const extra = b.tonight / b.ideal - 1;
    if (extra > 0.4 && r.minSep < 180) {
      let t = tx('Stanotte la Luna ({ill}%, a {sep}° dal target) ti costa +{x}% di tempo.', { ill: Math.round(n.moonIll * 100), sep: Math.round(r.minSep), x: Math.round(extra * 100) });
      const nbAlt = e.strat.filter((s) => s.lineOnly && s !== b).sort((x, y) => x.tonight - y.tonight)[0];
      if (!b.lineOnly && nbAlt) t += ' ' + tx('Con {s} il costo stanotte è {h}.', { s: nbAlt.label, h: fmtH(nbAlt.tonight) });
      if (b.hybrid) t += ' ' + tx('La parte in banda larga (polveri) conviene farla nelle notti senza Luna, la banda stretta anche adesso.');
      if (ctx.nextDark) t += ' ' + tx('Prossime notti buie: {d}.', { d: ctx.nextDark });
      tips.push({ k: 'Luna', t });
    }
  }
  const dust = r.field.ctx.filter((c) => c.type === 'DN' || c.type === 'RN');
  if (dust.length) tips.push({ k: 'Polveri', t: tx('Attorno c’è {ids}: polvere a LS ≈ {sb} mag/″². È lei a decidere il tempo in banda larga ed è per questo che il campo da inquadrare è {f} e non {o}.', { ids: dust.map((c) => `${c.id}${c.nick ? ' (' + c.nick + ')' : ''}`).join(', '), sb: it(Math.max(dust[0].sb, DUST_SB), 1), f: fmtDeg(r.field.a), o: fmtDeg(o.a) }) });
  if (b && b.ideal > 150 && ctx.sky && ctx.sky.sqm < 20.8) {
    // con il fondo cielo dominante il tempo scala con la sua luminosità: stima per un sito con SQM 21,3
    const dark = b.ideal * Math.pow(10, -0.4 * (21.3 - ctx.sky.sqm));
    tips.push({ k: 'Cielo', t: tx('Da qui servono {h} anche senza Luna: con questo cielo le parti deboli sono quasi fuori portata. Da un sito con SQM 21,3 lo stesso risultato arriverebbe in circa {d}.', { h: fmtH(b.ideal), d: fmtH(dark) }) });
  }
  if (r.skyMag != null && e.cfg && r.skyMag < ctx.sky.sqm - 0.25) tips.push({ k: 'Cielo', t: tx('Nella sua direzione il fondo cielo medio stanotte è {m} mag/″² contro {z} allo zenit: {why}, e i tempi ne tengono conto.', { m: it(r.skyMag, 2), z: it(ctx.sky.sqm, 2), why: tx(r.maxA < 45 ? 'resta basso verso le luci' : 'passa vicino al bagliore delle luci') }) });
  if (r.first >= 0) {
    let t = tx('Libero dalle {a} alle {b}', { a: fmtT(n.t[r.first]), b: fmtT(n.t[r.last] + DT) });
    if (r.maxI >= 0) t += tx(', culmina alle {t} a {a}°', { t: fmtT(n.t[r.maxI]), a: Math.round(r.maxA) });
    if (r.riseBlocked >= 0 && r.riseBlocked < r.first) t += tx('. Prima è dietro l’ostacolo a {dir}', { dir: azName(r.az[r.riseBlocked]) });
    tips.push({ k: 'Quando', t: t + '.' });
    if (b && b.steps.some((s) => s.keys.includes('OIII')) && b.steps.length > 1) tips.push({ k: 'Quando', t: tx('Tieni l’OIII per le ore vicine al transito: soffre la massa d’aria più di Hα e SII.') });
  }
  if (r.maxA < 32 && r.usableH > 0) tips.push({ k: 'Quota', t: tx('Massimo {a}°: foschia e turbolenza pesano, concentra le pose attorno al transito.', { a: Math.round(r.maxA) }) });
  const f = e.fill;
  if (f.nx * f.ny > 1) tips.push({ k: 'Campo', t: tx('Mosaico {n} a {fl} mm: circa {p} per pannello, {t} in tutto. Con un riduttore o un’ottica più corta potresti farlo in un colpo.', { n: `${f.nx}×${f.ny}`, fl: Math.round(g.fEff), p: fmtH(b ? b.ideal / (f.nx * f.ny) : NaN), t: fmtH(b ? b.ideal : NaN) }) });
  if (ctx.framing) tips.push({ k: 'Rotazione', t: framingTip(o, ctx.framing, r.field) });
  if (f.objPx < 160) tips.push({ k: 'Campo', t: tx('A {fl} mm misura {px} px: per i dettagli serve una focale più lunga.', { fl: Math.round(g.fEff), px: Math.round(f.objPx) }) });
  if (r.evals.length > 1) {
    const o2 = r.evals.filter((x) => x !== e).sort((a, c) => c.score - a.score)[0];
    if (o2 && e.score - o2.score >= 6) tips.push({ k: 'Setup', t: tx('Meglio {a} a {fa} che {b} a {fb}: {la} contro {lb}', { a: e.cfg.label, fa: e.cfg.short, b: o2.cfg.label, fb: o2.cfg.short, la: f.label.toLowerCase(), lb: o2.fill.label.toLowerCase() }) + (b && o2.best && isFinite(b.tonight) && isFinite(o2.best.tonight) ? tx(', {a} contro {b} stanotte', { a: fmtH(b.tonight), b: fmtH(o2.best.tonight) }) : '') + '.' });
  }
  if (b) {
    const subs = b.steps.map((s) => `${fname(s.f)} ${Math.max(...s.subs.map((x) => x.s))} s`);
    const mins = b.steps.map((s) => Math.max(...s.subs.map((x) => x.min)));
    tips.push({ k: 'Sub', t: tx('Esposizioni singole: {subs}. Sotto {mins} il rumore di lettura pesa; oltre, decidono inseguimento, stelle sature e quante pose puoi permetterti di buttare.', { subs: subs.join(', '), mins: mins.map((m) => Math.max(1, m) + ' s').join(' / ') }) });
  }
  if (!b) tips.push({ k: 'Filtri', t: tx('Con i filtri di questo profilo non c’è una strategia adatta: per {t} serve la banda larga.', { t: tx(TYPES_PL[o.type]).toLowerCase() }) });
  if (o.type === 'DN' || o.type === 'RN') tips.push({ k: 'Filtri', t: tx('Luce riflessa o polvere: la banda stretta non serve. Rende davvero solo sotto un cielo buio.') });
  if (ctx.alt && b) tips.push({ k: 'E se…', t: tx('Con {n} ci vorrebbero {a} invece di {b}.', { n: ctx.alt.name, a: fmtH(ctx.alt.h), b: fmtH(isFinite(b.tonight) ? b.tonight : b.ideal) }) });
  ((window.TIPS && o.tip && window.TIPS[o.tip]) || []).forEach((t) => tips.push({ k: 'Nota', t: tx(t) }));
  return tips;
}