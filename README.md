# Skyframe

Pianificatore di target per astrofotografia. Gli dai il tuo setup, i tuoi filtri e il tuo cielo; lui ti dice **cosa conviene riprendere stanotte**, con quale configurazione, quali filtri, quante ore e con che sub.

![icona](build/icon.png)

## Cosa fa

- **Cupola del cielo animata e grande**, con i target sotto, vista dal tuo luogo: stelle reali fino a mag 6, Via Lattea che si spegne con l'inquinamento luminoso e con la Luna, il tuo orizzonte, la Luna con la fase, i target migliori. Puoi scorrere la notte o trascinare l'ora; il livello *Luci* mostra la luminosità del cielo per direzione.
- **Catalogo di 2.366 oggetti**, non solo i soliti: Messier, NGC/IC, Sharpless, Lynds e Barnard (nebulose oscure), van den Bergh (riflessione), planetarie deboli (Abell…), resti di supernova visibili in ottico, gruppi di galassie. Filtri per tipo, catalogo, dimensione, tecnica, ore utili, notti necessarie, luminosità superficiale, costellazione, “nascondi i classici”.
- **Profili** con camera, ottica, **accessori** (correttore di coma 0,9×, riduttori, Barlow…) e **filtri reali** scelti da un database con le bande dichiarate dai produttori (Optolong, Antlia, Askar, IDAS, STC, ZWO, Player One, Baader, Astronomik, Chroma…). Ottiche da catalogo raggruppate per marca, tra cui tutta la gamma TS-Optics (ONTC/UNC, Hypergraph, Astrograph, Photon, RC, Photoline), Lacerta, Sky-Watcher, Takahashi, William Optics, Askar, Celestron; correttori e riduttori come Starizona Nexus 0,75×, GPU, MPCC, Paracorr. Ogni accessorio è una configurazione: per ogni target Skyframe dice quale conviene, e confronta anche gli altri profili nello stesso luogo.
- **Luogo** scelto su mappa (ricerca mentre scrivi, spillo trascinabile, atlante dell'inquinamento sovrapposto) con altitudine automatica.
- **Luminosità del cielo per direzione** dalla mappa *All-sky* di [lightpollutionmap.info](https://www.lightpollutionmap.info): quando fissi il punto, Skyframe apre il sito in una finestra nascosta e fa quello che faresti tu (punto sulla mappa, livello Sky brightness dell'anno, pulsante *All-sky*), poi legge l'immagine che il sito genera: barra dei colori, orizzonte e terreno, magnitudine per ogni direzione. La stessa immagine si può anche trascinare a mano nell'editor. Senza rete, o finché non arriva, si usa una stima dall'atlante di David Lorenz 2025.
- **Piano di ripresa** per ogni target: una strategia sola (non “usa tutti i filtri”), per esempio *L-eXtreme 12 h (sub 600 s) + UV/IR 1,5 h per le stelle*, oppure *banda stretta per l'emissione + banda larga per le polveri*. Tempo **base** e tempo **profondo** (con l'Hα diffuso misurato attorno all'oggetto), costo della Luna di stanotte, prossime notti buie, alternative.
- **Periodo giusto** per ogni target, anche se stanotte non è il momento: da quando a quando conviene, il picco di ore per notte e la prima notte senza Luna, con un clic per aprirla. Grafici della notte e dei 12 mesi interattivi: passa sopra per leggere, clicca per spostare l'ora o aprire la notte più buia del mese.
- **Inquadratura**: anteprima con foto reale DSS2 e sensore in scala, **rotazione e centro migliori** (per esempio la Cocoon spostata di 42′ verso B 168), mosaici, consigli concreti.
- **Aggiornamenti automatici**: all'avvio e ogni 6 ore Skyframe controlla le release. Con l'installer di Windows e con l'AppImage scarica la nuova versione, la installa e si riapre (subito dal banner, o da solo alla chiusura). Con macOS, l'exe portable e il `.deb` avvisa e porta alla pagina della release.

## Scaricare

Dalla pagina [Releases](https://github.com/astropuzzo/skyframe/releases):

| Sistema | File |
| --- | --- |
| Windows | `Skyframe-…-setup.exe` (installer) oppure `Skyframe-…-portable.exe` |
| macOS (Intel e Apple Silicon) | `.dmg` |
| Linux | `.AppImage` oppure `.deb` |

Le build non sono firmate: su Windows SmartScreen chiede conferma (*Ulteriori informazioni → Esegui comunque*), su macOS la prima volta apri l'app con clic destro → *Apri*.

## Sviluppo

```bash
npm install
npm start          # avvia l'app
npm run check      # stampa i piani di ripresa di alcuni scenari di riferimento
npm run smoke      # avvia l'app senza finestra: dettaglio, editor, mappa all-sky su Roma; salva screenshot
npm run data       # ricostruisce src/data/ dai cataloghi originali (scarica ciò che manca in scripts/raw/)
npm run dist       # crea i pacchetti per il sistema corrente in dist/
```

GitHub Actions compila Windows, macOS e Linux a ogni push su `main`; con un tag `v*` pubblica una release, insieme ai file `latest*.yml` che servono agli aggiornamenti automatici. Per pubblicare: alza `version` in `package.json`, poi `git tag vX.Y.Z && git push --tags`.

## Come vengono stimati i tempi

Per ogni filtro si usano le sue bande reali. Per ogni banda si calcola quanta luce dell'oggetto passa (continuo più le righe Hα, [NII], Hβ, OIII, SII, pesate dalla risposta dei pixel R/G/B se la camera è a colori) e quanto fondo cielo: SQM del luogo per direzione (continuo tipo LED più righe di mercurio e sodio), luminescenza naturale, Luna ogni 5 minuti, estinzione ridotta con l'altitudine.

La qualità è un SNR per elemento di risoluzione (il più grande tra pixel e 2″, la scala del seeing) su tre livelli: luminosità media dell'oggetto, parti deboli (aloni, bracci esterni) e polveri estese attorno (LS ≥ 25). Il tempo profondo aggiunge l'Hα diffuso attorno all'oggetto misurato nella mappa all-sky di Finkbeiner.

Le bolle di Wolf-Rayet (NGC 6888, WR 134, NGC 2359, Sh2-308) hanno un profilo di righe proprio, con OIII forte, e un guscio esterno quasi solo in OIII 3,2 mag/″² più debole dei filamenti in Hα. Quando due multibanda lasciano passare la stessa riga (L-eXtreme e L-Synergy con l'OIII) i due segnali si sommano, e le ore si dividono tra i due filtri.

Riferimenti di taratura, tutti con OSC e 800 mm f/5 sotto SQM 19,3 salvo dove indicato:

| Target | Skyframe | Immagine reale |
| --- | --- | --- |
| Cocoon (IC 5146 + B 168), L-eXtreme + banda larga | 56 h base, 95 h profondo | 100 h (65 banda larga + 35 banda stretta) |
| WR 134, L-eXtreme + L-Synergy | 101 h (50 + 50), guidate dal guscio OIII | ≈ 95 h tra HOO e SII+OIII per un SNR discreto |
| M 31, RedCat 51, SQM 18,6–19,3 | 10–18 h | — |
| NGC 7000, L-eXtreme | 7–12 h | — |

Sono stime per scegliere, non promesse.

## Dove finiscono i dati

I profili sono in `profili.json` nella cartella dati dell'app (`%APPDATA%\Skyframe` su Windows, `~/Library/Application Support/Skyframe` su macOS, `~/.config/Skyframe` su Linux) e si possono esportare/importare in JSON. Le tile dell'atlante scaricate restano in cache nella stessa cartella.

## Fonti dei dati e licenze

| Dati | Fonte | Licenza / citazione |
| --- | --- | --- |
| NGC/IC, Messier, soprannomi | [OpenNGC](https://github.com/mattiaverga/OpenNGC) (Mattia Verga) | CC-BY-SA 4.0 — per questo `src/data/dso.js` è distribuito sotto CC-BY-SA 4.0 |
| Sharpless, Lynds, Barnard, van den Bergh, planetarie, resti di supernova | VizieR: VII/20, VII/7A, VII/220A, VII/21, V/84, VII/297 (Green) | citare i cataloghi originali |
| Hα diffuso | Finkbeiner 2003, ApJS 146, 407 (WHAM + VTSS + SHASSA), da [NASA LAMBDA](https://lambda.gsfc.nasa.gov/product/foreground/fg_halpha_get.html) | dati pubblici NASA |
| Cielo per direzione | Mappa *All-sky* di [lightpollutionmap.info](https://www.lightpollutionmap.info) (Jurij Stare), dati VIIRS | letta dal sito su richiesta per il tuo punto, non ridistribuita |
| Inquinamento luminoso | [Atlante di David Lorenz](https://djlorenz.github.io/astronomy/lp/) (VIIRS 2025) | scaricato al bisogno, non ridistribuito |
| Stelle, costellazioni, Via Lattea | [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn) | BSD-3-Clause |
| Foto del campo | DSS2 via CDS hips2fits / NASA SkyView | uso online |
| Mappa, ricerca, altitudine | OpenStreetMap, Photon (komoot), Open-Meteo | ODbL / servizi pubblici |
| Mappa interattiva | [Leaflet](https://leafletjs.com) | BSD-2-Clause (`src/vendor/leaflet/LICENSE`) |
| Filtri | schede dei produttori (link a ogni filtro in `src/data/filters.js`) | — |
| Caratteri | IBM Plex Sans/Mono, Saira Condensed (Google Fonts) | SIL Open Font License 1.1 |

Codice: MIT.
