# Skyframe

Pianificatore di target per astrofotografia. Gli dai il tuo setup, i tuoi filtri e il tuo cielo; lui ti dice **cosa conviene riprendere stanotte**, con quale configurazione, quali filtri, quante ore e con che sub.

![icona](build/icon.png)

## Cosa fa

- **Cupola del cielo animata e grande**, con i target sotto, vista dal tuo luogo: stelle reali fino a mag 6, Via Lattea che si spegne con l'inquinamento luminoso e con la Luna, il tuo orizzonte, la Luna con la fase, i target migliori. Puoi scorrere la notte o trascinare l'ora; il livello *Luci* mostra la luminosità del cielo per direzione.
- **Catalogo di 2.366 oggetti**, non solo i soliti: Messier, NGC/IC, Sharpless, Lynds e Barnard (nebulose oscure), van den Bergh (riflessione), planetarie deboli (Abell…), resti di supernova visibili in ottico, gruppi di galassie. Filtri per tipo, catalogo, dimensione, tecnica, ore utili, notti necessarie, luminosità superficiale, costellazione, “nascondi i classici”.
- **Profili** con una camera, **più telescopi** e i **filtri reali** che possiedi (database con le bande dichiarate dai produttori: Optolong, Antlia, Askar, IDAS, STC, ZWO, Player One, Baader, Astronomik, Chroma…). Ogni telescopio ha i suoi **accessori** (correttori di coma, riduttori, spianatori, Barlow) e l'editor propone solo quelli adatti alla sua famiglia: Newton, rifrattore, SCT, RC. Ogni combinazione telescopio + accessorio è una configurazione: per ogni target Skyframe sceglie la migliore **fra quelle del profilo attivo** e la mostra nella lista, dove puoi anche filtrare i target per setup. Ottiche da catalogo raggruppate per marca, tra cui tutta la gamma TS-Optics (ONTC/UNC, Hypergraph, Astrograph, Photon, RC, Photoline), Lacerta, Sky-Watcher, Takahashi, William Optics, Askar, Celestron.
- **Luogo** scelto su mappa (ricerca mentre scrivi, spillo trascinabile, atlante dell'inquinamento sovrapposto) con altitudine automatica.
- **Più luoghi di ripresa**, separati dai profili: ognuno ha il suo cielo (SQM, atlante, mappa all-sky), il suo orizzonte e la sua altezza minima, e si cambia dall'intestazione. Mentre guardi il luogo attivo, Skyframe calcola in sottofondo gli stessi target, con lo stesso profilo e la stessa notte, negli altri luoghi salvati: nella lista compare il luogo dove un target costa molto meno tempo (o dove si riprende, se da qui no), il pannello *Luoghi a confronto* dice quanto è più rapido ogni luogo sui primi target, e nel dettaglio *Dove conviene* mette a confronto cielo sul target, ore libere, tempo e setup di ogni luogo. Si può anche ordinare la lista per *Più rapidi in un altro luogo*.

- **Luminosità del cielo per direzione** dalla mappa *All-sky* di [lightpollutionmap.info](https://www.lightpollutionmap.info): quando fissi il punto, Skyframe apre il sito in una finestra nascosta e fa quello che faresti tu (punto sulla mappa, livello Sky brightness dell'anno, pulsante *All-sky*), poi legge l'immagine che il sito genera: barra dei colori, orizzonte e terreno, magnitudine per ogni direzione. Il terreno dell'immagine diventa l'orizzonte del luogo e si aggiorna quando cambia la mappa; se l'orizzonte lo disegni o lo importi tu, la mappa lo alza soltanto dove il terreno è più alto. La stessa immagine si può anche trascinare a mano nell'editor. Senza rete, o finché non arriva, si usa una stima dall'atlante di David Lorenz 2025.
- **Piano di ripresa** per ogni target: una strategia sola (non “usa tutti i filtri”), per esempio *L-eXtreme 12 h (sub 600 s) + UV/IR 1,5 h per le stelle*, oppure *banda stretta per l'emissione + banda larga per le polveri*. Tempo **base** e tempo **profondo** (con l'Hα diffuso misurato attorno all'oggetto), costo della Luna di stanotte, prossime notti buie, alternative.
- **Periodo giusto** per ogni target, anche se stanotte non è il momento: da quando a quando conviene, il picco di ore per notte e la prima notte senza Luna, con un clic per aprirla. Grafici della notte e dei 12 mesi interattivi: passa sopra per leggere, clicca per spostare l'ora o aprire la notte più buia del mese.
- **Il target a colpo d'occhio**: in cima al dettaglio l'immagine del target da diverse survey (NSNS a colori, che a grande campo somiglia a una foto amatoriale, DSS2, Pan-STARRS, Hα) con + e − per allargare, e le foto con licenza libera di Wikimedia Commons, prima quelle degli astrofili, con autore e licenza; a tutto schermo con un tocco. In fondo alla striscia, il collegamento alle foto di AstroBin.
- **Inquadratura**: anteprima con foto reale e sensore in scala, **rotazione e centro migliori** (per esempio la Cocoon spostata di 42′ verso B 168), mosaici, consigli concreti.
- **Aggiornamenti automatici**: all'avvio e ogni 6 ore Skyframe controlla le release. Con l'installer di Windows e con l'AppImage scarica la nuova versione, la installa e si riapre (subito dal banner, o da solo alla chiusura). Con macOS, l'exe portable e il `.deb` avvisa e porta alla pagina della release.

- **Lingue**: italiano e inglese (scelta nell'intestazione, di default quella del sistema). Ogni lingua è un dizionario in `src/i18n/`: per aggiungerne una basta un file nuovo.

## Scaricare

Dalla pagina [Releases](https://github.com/astropuzzo/skyframe/releases):

| Sistema | File |
| --- | --- |
| Windows | `Skyframe-…-setup.exe` (installer) oppure `Skyframe-…-portable.exe` |
| macOS (Intel e Apple Silicon) | `.dmg` |
| Linux | `.AppImage` oppure `.deb` |
| Android (7.0 o più recente) | `Skyframe-…-android.apk`: aprilo dal telefono e consenti l'installazione da questa fonte |

Le build non sono firmate: su Windows SmartScreen chiede conferma (*Ulteriori informazioni → Esegui comunque*), su macOS la prima volta apri l'app con clic destro → *Apri*.

Sull'app Android la mappa all-sky di lightpollutionmap non si scarica da sola: esporta profili e luoghi dal desktop (con le mappe già lette) e importali sul telefono, oppure importa l'immagine a mano. Quando esce una versione nuova l'app lo segnala e apre il download dell'APK.

## Sviluppo

```bash
npm install
npm start          # avvia l'app
npm run check      # stampa i piani di ripresa di alcuni scenari di riferimento
node scripts/calibrate.cjs   # confronta il modello con le foto reali (dati in scripts/raw/, non nel repository)
npm run smoke      # avvia l'app senza finestra: dettaglio, editor, mappa all-sky su Roma; salva screenshot
npm run data       # ricostruisce src/data/ dai cataloghi originali (scarica ciò che manca in scripts/raw/)
npm run dist       # crea i pacchetti per il sistema corrente in dist/
npm run android:sync   # copia l'app nel progetto Android (android/), poi si compila con Gradle o Android Studio
```

GitHub Actions compila Windows, macOS e Linux a ogni push su `main`; con un tag `v*` pubblica una release, insieme ai file `latest*.yml` che servono agli aggiornamenti automatici. Per pubblicare: alza `version` in `package.json`, poi `git tag vX.Y.Z && git push --tags`.

## Come vengono stimati i tempi

Per ogni filtro si usano le sue bande reali. Per ogni banda si calcola quanta luce dell'oggetto passa (continuo più le righe Hα, [NII], Hβ, OIII, SII, pesate dalla risposta dei pixel R/G/B se la camera è a colori) e quanto fondo cielo: SQM del luogo per direzione (continuo tipo LED più righe di mercurio e sodio), luminescenza naturale, Luna ogni 5 minuti, estinzione ridotta con l'altitudine.

La qualità è un SNR per elemento di risoluzione su tre livelli: il corpo dell'oggetto, le parti deboli (aloni, bracci esterni) e le polveri estese attorno (LS ≥ 26,5). L'elemento è proporzionale al diametro, 4 volte il limite di diffrazione (2,3″ a 200 mm, 4,7″ a 100 mm, o il pixel se è più grande): ogni telescopio si guarda al dettaglio che sa dare. Lo SNR richiesto cresce con la luminosità superficiale e scende piano con la dimensione: sugli oggetti luminosi e piccoli si pretende più pulizia, su quelli deboli e grandi si accetta più rumore. Per le nebulose a emissione il corpo viene dall'Hα misurato nell'oggetto (NSNS e SHASSA, in Rayleigh; mediana dell'ellisse, 75° percentile nei resti di supernova che sono filamenti), non dalla magnitudine di catalogo, che per molte nebulose è 2–10 volte troppo luminosa. Le polveri si riconoscono in due modi: una nube oscura grande dei cataloghi collegata all'oggetto (B 168 per la Cocoon), oppure la polvere misurata attorno all'oggetto nella mappa di Schlegel, Finkbeiner & Davis (1998), che vede anche le nubi spezzate in tanti pezzi piccoli (NGC 1333, Iris, M 78, Sh2-136). Nel dettaglio i consigli dicono anche quanto basterebbe per la sola parte luminosa. Il tempo profondo aggiunge l'Hα diffuso attorno all'oggetto misurato nella mappa all-sky di Finkbeiner.

Le bolle di Wolf-Rayet (NGC 6888, WR 134, NGC 2359, Sh2-308) hanno un profilo di righe proprio, con OIII forte, e un guscio esterno quasi solo in OIII, molto più debole dei filamenti in Hα. Quando due multibanda lasciano passare la stessa riga (L-eXtreme e L-Synergy con l'OIII) i due segnali si sommano, e le ore si dividono tra i due filtri.

### Taratura

I livelli di qualità e le regole qui sopra sono tarati su **190 foto pubbliche di AstroBin** di 23 oggetti: nebulose a emissione (NGC 281, NGC 7635, NGC 7000, IC 1396, NGC 2237, Sh2-129, IC 1805), bolle di Wolf-Rayet (WR 134, NGC 6888), resti di supernova (i due Veli), planetarie (M 27, M 57, M 97, Helix), nebulose a riflessione e polveri (Cocoon, Iris, NGC 1333, M 78, Pleiadi) e galassie (M 31, M 33, M 51, M 81, M 101). Ogni foto ha dichiarati telescopio, camera, filtri, integrazione per filtro e, in circa metà dei casi, il cielo (Bortle o SQM). Sono state lette una per una dalle pagine pubbliche, una volta sola; nel repository ci sono solo il metodo e i risultati. Per ogni foto Skyframe rifà i conti con quell'attrezzatura e quel cielo (`scripts/calibrate.cjs`) e confronta le sue ore con quelle vere.

Cosa è emerso:

- **L'apertura quasi non conta nelle foto reali.** Con un elemento di risoluzione fisso (2″) i tempi reali uscivano come D^2,6 rispetto al previsto: un Seestar da 30 mm previsto a 359 h contro 9 reali, un 610 mm a 0,1 h contro 18. Con l'elemento proporzionale al diametro lo scarto non dipende più né dall'apertura né dalla scala dell'immagine.
- **Le persone chiedono più pulizia agli oggetti luminosi e piccoli** e accettano più rumore su quelli deboli e grandi: M 57 usciva 20 volte troppo breve, il Velo e la Helix 7–100 volte troppo lunghi. Con lo SNR che cresce con la luminosità superficiale (esponente 0,45) l'errore su un oggetto lasciato fuori dalla taratura scende da un fattore 4,6 a un fattore 2,7.
- **Galassie:** una buona foto mostra il disco ben oltre l'isofota 25 (parti deboli a +3,5 mag sulla media di catalogo); prima uscivano 5 volte troppo brevi.
- **Cielo, filtri e camera restano pura fisica.** A parità di oggetto chi fotografa da cielo buio o in mono raccoglie molte più ore di quelle che servirebbero (punta più in alto), chi fotografa da città con la camera a colori meno: la differenza fra i due gruppi è la qualità, non il tempo che serve. Lo conferma la Cocoon ripresa dallo stesso astrofilo: circa lo stesso segnale in 6 h da un sito buio e in 60 h dal terrazzo.
- La stessa foto fatta da persone diverse varia già di un fattore 3 circa: nessun modello può fare meglio di così sul singolo scatto.

I livelli: **buona** = la mediana delle foto; **rapida** ≈ il quartile basso (≈ 0,4 volte il tempo, tipico da città con camera a colori); **eccellente** ≈ il quartile alto (≈ 2,5 volte il tempo, tipico da cielo buio o in mono).

| Rapporto ore reali / modello (qualità buona) | mediana | foto |
| --- | --- | --- |
| tutte | 0,91 (quartili 0,37 – 2,96) | 173 |
| camera a colori / mono | 0,48 / 3,15 | 106 / 67 |
| cielo SQM < 20,4 / 20,4–21,3 / ≥ 21,3 | 0,44 / 0,84 / 2,32 | 45 / 27 / 28 |
| apertura < 80 / 80–200 / ≥ 200 mm | 0,57 / 0,84 / 1,07 | 26 / 68 / 79 |

Riferimenti con un solo telescopio e camera a colori:

| Target | Skyframe (qualità buona) | Immagine reale |
| --- | --- | --- |
| Cocoon (IC 5146), 200/800, quad-band, SQM 19,25 | 93 h (16 h da SQM 21,3) | 60 h dal terrazzo ≈ 6 h da un sito buio, stesso astrofilo |
| Cocoon, 800 mm f/5, L-eXtreme + L-Synergy + banda larga, SQM 19,3 | 118 h | 100 h |
| WR 134, 800 mm f/5, L-eXtreme + L-Synergy, SQM 19,3 | 56 h | ≈ 95 h per un SNR discreto |
| NGC 281, 200/800 f/4, dual-band + D2, SQM 19,25 | 8 h col solo dual-band, 35 h in SHO | almeno 4–5 h per il corpo centrale |
| NGC 281 sotto cieli fra SQM 18,6 e 21,9 | — | mediana 5,6 h su 21 foto |

Nelle galassie la parte principale è il corpo (0,5 mag sopra la media di catalogo). Le righe deboli (SII in una nebulosa a emissione, Hα in una planetaria) si accettano più rumorose, in proporzione alla loro intensità. Per gli oggetti a emissione si consiglia la banda stretta anche sotto un cielo buio, e fra le combinazioni quella che raccoglie tutte le righe importanti (SHO dove c'è SII) purché non costi più di 8 volte la più rapida; un po' di banda larga per il colore delle stelle è facoltativa.

Sono stime per scegliere, non promesse.

Il **punteggio** della lista combina l'inquadratura (quanto l'oggetto riempie il campo, o se serve un mosaico), le ore libere col buio stanotte, l'impegno (quante notti servono) e l'interesse fotografico: a parità del resto una nebulosa vale più di un ammasso aperto, che si fa in un'ora ma raramente è il soggetto di una foto (nebulose e resti di supernova 1, planetarie e galassie 0,9, nebulose oscure 0,8, ammassi globulari 0,7, aperti 0,45; ×0,85 per gli oggetti senza un nome proprio e fuori dai classici).

Le **pose singole** in banda larga: oltre il minimo che copre il rumore di lettura (pochi secondi sotto un cielo cittadino) l'SNR finale dipende solo dal tempo totale, quindi decide quanto reggono le stelle. In ogni telescopio puoi scrivere la posa più lunga che usi in banda larga senza saturare: Skyframe la propone (scalata col quadrato del fattore di riduttori e Barlow); se il campo è vuoto propone il minimo della fascia pratica del filtro.

**Senza Luna e con la Luna sono due numeri diversi.** Il tempo di posa mostrato per ogni target è quello senza Luna lungo il suo percorso reale nella notte scelta (altezza, estinzione, cielo e luci nella sua direzione a ogni passo di 5 minuti): è quanto chiede il target sotto quel cielo, e si confronta fra luoghi e filtri. Con lo stesso profilo (200/800 e camera a colori), un terrazzo di città (SQM 19,25) contro un sito a SQM 21,3, la Cocoon in quad-band passa da 93 h a 16 h (×6, in linea con 60 h contro 6 h misurate davvero), mentre in banda stretta NGC 281 passa solo da 8 a 5 h. Quanto costerebbe con la Luna della notte scelta è indicato a parte (con la Luna piena i due cieli si somigliano: ×1,3). Nel profilo si sceglie se il calendario delle notti usa anche le notti con la Luna, col loro rallentamento, o solo le ore senza Luna.

Le **notti di ripresa** non sono le ore divise per le ore di stanotte: Skyframe scorre le notti una per una, da quella scelta in avanti (fino a un anno), e per ognuna calcola quante ore il target è libero sopra orizzonte e altezza minima col buio, e quanto rende in quelle ore con la Luna, l'altezza e il cielo di quella notte. Somma il lavoro fatto finché basta. Le notti in cui il target rende più di 2,5 volte meno che nella notte migliore del mese (di solito per la Luna) si saltano, perché conviene dedicarle ad altro. Si assume il cielo sempre sereno. Nel dettaglio un grafico mostra le notti usate, quelle saltate e quando finisci (anche per il tempo profondo).

## Dove finiscono i dati

Profili e luoghi sono in `profili.json` nella cartella dati dell'app (`%APPDATA%\Skyframe` su Windows, `~/Library/Application Support/Skyframe` su macOS, `~/.config/Skyframe` su Linux) e si possono esportare/importare in JSON. Le tile dell'atlante scaricate restano in cache nella stessa cartella.

## Fonti dei dati e licenze

| Dati | Fonte | Licenza / citazione |
| --- | --- | --- |
| NGC/IC, Messier, soprannomi | [OpenNGC](https://github.com/mattiaverga/OpenNGC) (Mattia Verga) | CC-BY-SA 4.0 — per questo `src/data/dso.js` è distribuito sotto CC-BY-SA 4.0 |
| Sharpless, Lynds, Barnard, van den Bergh, planetarie, resti di supernova | VizieR: VII/20, VII/7A, VII/220A, VII/21, V/84, VII/297 (Green) | citare i cataloghi originali |
| Hα diffuso | Finkbeiner 2003, ApJS 146, 407 (WHAM + VTSS + SHASSA), da [NASA LAMBDA](https://lambda.gsfc.nasa.gov/product/foreground/fg_halpha_get.html) | dati pubblici NASA |
| Polveri attorno ai target | Schlegel, Finkbeiner & Davis 1998, ApJ 500, 525 (E(B−V) da IRAS/DIRBE), da [NASA LAMBDA](https://lambda.gsfc.nasa.gov/product/foreground/fg_sfd_get.html) | dati pubblici NASA |
| Cielo per direzione | Mappa *All-sky* di [lightpollutionmap.info](https://www.lightpollutionmap.info) (Jurij Stare), dati VIIRS | letta dal sito su richiesta per il tuo punto, non ridistribuita |
| Inquinamento luminoso | [Atlante di David Lorenz](https://djlorenz.github.io/astronomy/lp/) (VIIRS 2025) | scaricato al bisogno, non ridistribuito |
| Stelle, costellazioni, Via Lattea | [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn) | BSD-3-Clause |
| Immagini del target | DSS2, Pan-STARRS1 via [CDS hips2fits](https://alasky.cds.unistra.fr/hips-image-services/hips2fits) / NASA SkyView | uso online |
| Immagini a grande campo e Hα | [Northern Sky Narrowband Survey](http://www.simg.de/nebulae3/dr0_1), Stefan Ziegenbalg, via CDS hips2fits | CC BY-NC-SA 4.0 |
| Foto degli astrofili e degli osservatori | [Wikimedia Commons](https://commons.wikimedia.org), cercate per nome del target | licenza e autore di ogni foto, mostrati nell'app |
| Mappa, ricerca, altitudine | OpenStreetMap, Photon (komoot), Open-Meteo | ODbL / servizi pubblici |
| Mappa interattiva | [Leaflet](https://leafletjs.com) | BSD-2-Clause (`src/vendor/leaflet/LICENSE`) |
| Filtri | schede dei produttori (link a ogni filtro in `src/data/filters.js`) | — |
| Caratteri | IBM Plex Sans/Mono, Saira Condensed (Google Fonts) | SIL Open Font License 1.1 |

Codice: MIT.
