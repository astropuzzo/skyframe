# Modello dei tempi di integrazione

Questo documento descrive cosa calcola Skyframe, con quali dati, con quali ipotesi e con quale verifica. Per ogni parte indica se si tratta di una **relazione fisica**, di un'**evidenza osservativa** (ricavata dalle foto) o di un'**ipotesi** (scelta ragionevole non ancora verificata). Codice: `src/js/model.js`; taratura: `scripts/calibrate.cjs`, `scripts/quality-fit.cjs`; casi di verifica: `scripts/check-cases.cjs` → [VERIFICA-casi.md](VERIFICA-casi.md); catalogo: [CATALOGO.md](CATALOGO.md).

## 1. Cosa calcola

Per ogni oggetto, ogni configurazione del profilo (telescopio con o senza accessori) e ogni combinazione di filtri: l'integrazione totale necessaria per raggiungere un livello di qualità, espresso come rapporto segnale/rumore (SNR) su strutture definite dell'oggetto. Da questa derivano le notti necessarie, la data di fine, il piano della notte, il punteggio della lista e la combinazione di filtri consigliata.

## 2. Variabili usate

| Grandezza | Fonte | Stato |
| --- | --- | --- |
| Apertura, focale, ostruzione, fattore di riduttori e Barlow | profilo | dato inserito |
| Pixel, dimensioni del sensore, binning, QE di picco, rumore di lettura, tipo (colori, mono, reflex, reflex modificata) | profilo (catalogo camere) | dati di catalogo, QE e rumore di lettura tipici del sensore |
| Bande passanti e trasmissione dei filtri | `src/data/filters.js`, schede dei produttori | misura pubblicata; «stima» dove il produttore non dà numeri |
| Risposta spettrale del sensore (efficienza relativa al picco) | curva misurata su banco ottico per sensori Sony retroilluminati con pixel da 3,76 µm (IMX455, IMX411; stessa tecnologia di IMX571 e IMX533): Alarcon et al. 2023, PASP 135, 055001; Betoule et al. 2023, A&A (arXiv:2211.04913) | misura per quella famiglia; approssimazione per gli altri sensori (§ 10) |
| Risposta dei pixel R, G, B della matrice di Bayer | modello a gradini (`bayer()`), moltiplicato per la risposta del sensore | approssimazione |
| Spettro dell'oggetto: continuo e righe Hα, [NII], Hβ, OIII, [SII] | rapporti tipici per tipo (`LINES`); Hα misurato (NSNS, SHASSA) per molte nebulose | misura per l'Hα, ipotesi per i rapporti fra righe |
| Luminosità superficiale e dimensioni | OpenNGC, Sharpless, Lynds, tabelle di correzione | misura (dalla magnitudine) o stima (classe, opacità, valore tipico): vedi [CATALOGO.md](CATALOGO.md) |
| Polvere attorno all'oggetto | mappa SFD 1998 di E(B−V) | misura |
| Hα diffuso attorno | mappa di Finkbeiner 2003 | misura |
| Fondo cielo allo zenit (SQM) | misura con fotometro, mappa all-sky, atlante di Lorenz, classe di Bortle (convertita con i valori dichiarati dagli astrofotografi) | misura o stima con incertezza dichiarata (§ 6) |
| Fondo cielo per direzione | mappa all-sky o atlante (forma), altrimenti profilo medio | stima |
| Spettro della luce artificiale | 75% continuo tipo LED + righe di mercurio e sodio | ipotesi |
| Luminescenza naturale | 22,0 mag/″² allo zenit, più chiara verso l'orizzonte | valore tipico |
| Luna | posizione, fase e distanza per ogni passo di 5 minuti | calcolo astronomico; la luminosità diffusa è un modello semplificato |
| Estinzione atmosferica | per lunghezza d'onda del canale, ridotta con l'altitudine del luogo | modello medio |
| Percorso dell'oggetto | altezza e azimut a passi di 5 minuti, orizzonte locale, altezza minima | calcolo astronomico |
| Meteo | copertura nuvolosa (7 modelli), probabilità, seeing, trasparenza (aerosol) | previsione, solo per il calendario e il voto delle notti |

## 3. Variabili non considerate

- Qualità ottica reale (aberrazioni, collimazione), messa a fuoco, errore di inseguimento durante la posa: peggiorano il risultato, non sono nel modello.
- Seeing e trasparenza reali della notte nel calcolo del SNR: il seeing entra solo nella precisione di guida (§ 7), la trasparenza nel voto delle notti.
- Rumore termico delle camere raffreddate (trascurabile) e dei sensori non raffreddati (un valore fisso per le reflex).
- Flat, dark, bias e dithering: si assume una calibrazione corretta.
- Elaborazione (riduzione del rumore, stretching): cambia molto il risultato percepito; è uno dei motivi per cui il livello di qualità si tara sulle foto (§ 5).

## 4. Relazioni fisiche

1. **Segnale e fondo per canale.** Per ogni banda del filtro si integrano spettro dell'oggetto, spettro del cielo, trasmissione del filtro, risposta spettrale del sensore, filtro Bayer del pixel (camere a colori), area efficace (apertura, ostruzione, QE di picco, 85% di trasmissione dell'ottica). La risposta del sensore rende il 58% del picco a Hα (656 nm), il 54% a SII (672 nm), il 100% a OIII (501 nm): fino alla 0.19 si usava un valore costante, che sopravvalutava Hα e SII di 1,7–1,8 volte rispetto all'OIII.
2. **Elemento di risoluzione.** Il SNR si misura su un elemento di dimensione max(pixel, 468″·mm / D): quattro volte il limite di diffrazione. Scelta tarata sulle foto (prima taratura): con un elemento fisso le foto reali divergevano dal modello come D^2,6.
3. **Tempo.** t = SNR² × (S + B + N) / S², con S segnale, B fondo cielo, N rumore di lettura e termico per elemento. È rumore fotonico: vale per ogni camera, filtro e cielo.
4. **Pose singole.** La posa minima è quella per cui il fondo cielo per pixel vale 10 volte il rumore di lettura al quadrato; il valore proposto è quello più usato nelle foto di riferimento (evidenza, § 5), mai sotto il minimo fisico.
5. **Mosaici.** Ogni pannello richiede lo stesso tempo.

Filtri, cielo, telescopio e Luna cambiano i tempi **solo** attraverso queste relazioni.

## 5. Livello di qualità: dalle foto

**Evidenza.** Per ogni foto di AstroBin con attrezzatura riconosciuta il modello rifà il conto con il telescopio, la camera, i filtri e il cielo di quella foto (SQM dichiarato dall'autore o, in mancanza, la classe di Bortle convertita come in § 6) e ottiene il tempo fisico a un SNR di riferimento, t_fis. Il rapporto g = ore dichiarate / t_fis dice quale SNR ha raggiunto la foto: SNR = SNR_rif · √g.

Quattro osservazioni, su 6918 foto di 311 oggetti (camere a colori, reflex e mono; cieli da Bortle 1 a 9):

- **Le ore dichiarate sono soprattutto un'abitudine.** Fra le foto dello stesso autore le ore crescono appena con il tempo fisico (pendenza 0,17 in scala logaritmica: se le ore seguissero il fabbisogno sarebbe 1). In 46 casi lo stesso autore ha ripreso lo stesso oggetto con la stessa camera da cieli diversi (mediana 2,9 mag di differenza): il tempo fisico al cielo più buio è ×0,24, le ore dichiarate ×1,06.
- **Quindi chi ha un setup più efficiente arriva a un SNR più alto.** A parità di oggetto (effetti fissi, minimi quadrati): con camera mono il SNR² raggiunto è ×5,2 sugli oggetti a righe (banda stretta) e ×2,8 su quelli a spettro continuo; con reflex ×0,24 (modificata ×0,40); per ogni magnitudine di cielo più buio ×1,75. Dentro le foto dello stesso autore, per chi ha usato camere o cieli diversi, gli effetti sono simili (mono ×3,3, cielo ×1,6 per magnitudine).
- **Il SNR raggiunto dipende dall'oggetto:** sugli oggetti difficili si accetta un SNR più basso. Fra oggetti, log g = a + b · log D con b = −0,66, dove D è la difficoltà fisica (ore a SNR di riferimento con un setup fisso: rifrattore 100 mm f/5,5, IMX571 a colori, UV/IR e L-eXtreme, SQM 19,0, latitudine 45°).
- **Le pose singole delle foto confermano quelle proposte:** mediana 300 s con i multibanda su camera a colori, 60–180 s in banda larga (60 s sotto f/3), 300 s in banda stretta 5–8 nm su mono, 300–600 s sotto i 4,5 nm.

**Uso nel modello.** Il livello «buona» di un oggetto è il SNR della sua foto mediana **riportata a un riferimento fisso**: camera a colori, cielo SQM 19,0. Ogni foto si riporta togliendo gli effetti di camera e cielo misurati sopra; per gli oggetti con foto si prende la mediana, unita alla previsione con peso 6 foto; per gli altri la previsione da D. Il tempo mostrato è t_fis (con la tua attrezzatura, il tuo cielo, la tua Luna) × g × k, con k = 0,47 / 1 / 2 / 3,3 per rapida / buona / eccellente / profonda. Il livello non dipende dal tuo setup, così il confronto fra luoghi, filtri e camere resta fisico. Con camera mono, reflex o cielo diverso da SQM 19 il piano indica di quanto è più alto (o più basso) il SNR² tipico delle foto fatte così, e il livello dell'app più vicino: è un'informazione, non cambia il tempo. La scheda «Foto di riferimento» mostra le foto con camera e cielo simili ai tuoi (camera a colori o mono; cielo urbano, di periferia o buio).

**Differenza dalle versioni precedenti.** Fino alla 0.20 il livello veniva dalle sole foto a colori da cieli Bortle 6–8 (2054 foto), con la classe convertita con la tabella DSA. Ora usa tutte le foto riportate al riferimento (3,4 volte di più, 311 oggetti invece di 259) e la conversione empirica della classe di Bortle. Molti livelli salgono (M 31 ×2,6, IC 1396 ×1,8): sulla verifica le foto a colori da città risultano ora centrate (rapporto mediano ×0,98, prima ×0,81).

### Dati usati

| Insieme | Contenuto | Uso |
| --- | --- | --- |
| Prima raccolta (2026-09-25) | 190 foto di 23 oggetti, schede lette a mano, cieli e camere di ogni tipo | taratura della struttura del modello (elemento di risoluzione, dipendenza dalla luminosità superficiale, galassie) |
| Seconda raccolta (2026-09-26, 1ª parte) | 1205 foto, 101 oggetti; camere a colori, Bortle 6–8, ≥30 apprezzamenti, dal 2024 | taratura |
| Terza raccolta (2026-09-26, 2ª parte) | 2241 foto, 559 target cercati | verifica della 0.19 e 0.20, poi taratura |
| Quarta raccolta (2026-09-27) | 6124 foto (5833 nuove), 239 oggetti, 57 mai visti; 2533 mono; Bortle 1–9; 1908 con SQM dichiarato | **verifica** sui 52 oggetti nuovi confrontabili, poi taratura; conversione Bortle → SQM (§ 6); verifica delle pose singole |
| Foto utilizzabili | 7286 su 8074 (4608 camere a colori, 435 reflex, 2243 mono) | taratura e verifica |
| Foto scartate | 788: telescopio non identificabile (184), filtri non modellabili (318: integrati nei telescopi intelligenti, infrarosso, set indicati senza distinguere i filtri, bande non pubblicate), più telescopi o camere (157), focale non ricavabile (57), camera sconosciuta o incoerente (37), integrazione mancante (35) | escluse: dati insufficienti |
| Autore delle foto | per 2391 foto la raccolta indica il fondatore di AstroBin (dal piè di pagina) | autore considerato sconosciuto: escluse dalle analisi per autore |

## 6. SQM e classe di Bortle

La scala di Bortle è una classificazione visuale; non ha una conversione esatta in SQM. Due riferimenti:

| Classe | Dark Skies Awareness | Dichiarato su AstroBin: mediana fra autori (metà centrale) | Autori |
| --- | --- | --- | --- |
| 1 | 21,76–22,0 | 21,85 (21,55–22,00) | 20 |
| 2 | 21,6–21,76 | 21,60 (21,30–21,90) | 33 |
| 3 | 21,3–21,6 | 21,41 (21,21–21,60) | 57 |
| 4 | 20,3–21,3 | 20,90 (20,40–21,23) | 79 |
| 5 | 19,25–20,3 | 19,80 (19,50–20,10) | 52 |
| 6 | 18,5–19,25 | 19,25 (18,94–19,43) | 24 |
| 7 | 18,0–18,5 | 18,60 (18,40–18,77) | 26 |
| 8 | 17,5–18,0 | 18,00 (17,90–18,34) | 12 |
| 9 | < 17,5 | 17,80 (17,72–17,85) | 6 |

I valori dichiarati vengono da 1408 foto con classe e SQM; per ogni autore la mediana dei suoi valori in quella classe, così un autore con molte foto dallo stesso sito conta una volta. Per le classi 1–5 i due riferimenti coincidono entro 0,1 mag; le classi 6, 7 e 8 dichiarate corrispondono a cieli più bui della tabella DSA di 0,37, 0,35 e 0,25 mag. Il modello usa i valori dichiarati: è il significato che la classe ha per chi riprende, e per le foto con cui si tara. Spostare di 0,3 mag la conversione delle classi 6–8 cambiava il livello di qualità del 20–25%: era l'incertezza principale della taratura, ora misurata.

Ogni luogo porta l'origine del suo SQM e un'incertezza: misura con fotometro ±0,1; mappa all-sky o atlante ±0,3 (ordine di grandezza dello scarto fra modelli satellitari e misure a terra: da verificare con misure); classe di Bortle: la dispersione fra gli autori (metà centrale / 1,35, almeno 0,25); valore inserito senza origine ±0,3. Il piano mostra l'intervallo di ore che ne deriva (la parte artificiale del fondo scala come 10^(0,4 ΔSQM)). L'SQM dichiarato dagli autori non è sempre una misura: molti valori si ripetono identici (21,94, 18,48), segno che vengono da un atlante.

## 7. Scelta dei filtri

**Criterio.** Fra le combinazioni ammesse dall'obiettivo del profilo si sceglie quella con il tempo più breve per il SNR richiesto, senza pesi. Il SNR richiesto incorpora già contrasto (segnale rispetto al fondo) e tempo.

**Obiettivi** (profilo, «Obiettivo della ripresa»):

- *Minor tempo per il SNR richiesto* (predefinito): su un oggetto a righe la combinazione deve raccogliere Hα e OIII quando sono importanti (almeno il 12% della riga più forte), perché altrimenti il SNR si misurerebbe su meno segnale e una combinazione incompleta sembrerebbe più rapida.
- *Tutte le righe (SHO)*: raccoglie anche la SII dove è importante (palette SHO).
- *Colori naturali*: solo banda larga (in mono anche RGB con un canale Hα).

**Regole.** Il risultato dev'essere a colori quando è possibile (solo L o solo Hα restano alternative). Gli oggetti a spettro continuo (galassie, nebulose a riflessione, oscure, ammassi) si riprendono in banda larga: la banda stretta non raccoglie il loro segnale e il calcolo lo mostra da solo. Quando la combinazione scelta è a banda stretta, il colore delle stelle viene da una ripresa a banda larga separata: il segnale di una stella di magnitudine 16 arriva a SNR 10 in secondi o minuti, quindi il tempo proposto è quello di 20 pose (il minimo per scartare pixel anomali con il clipping statistico). Ogni passo del piano indica il suo ruolo (corpo dell'oggetto, parti deboli, polveri, guscio OIII, colore delle stelle).

**Luna.** La luce lunare è luce solare riflessa: spettro continuo. Un filtro ne lascia passare una quota proporzionale all'integrale della sua banda, come per il continuo del cielo; per questo, a parità di cielo, la Luna pesa di più sulla banda larga, dove il fondo domina già il rumore, che sulla banda stretta. La combinazione senza Luna serve al confronto fra luoghi e filtri. Con la Luna della notte scelta si calcola anche la combinazione più rapida, con le stesse regole di ammissione; se riduce il tempo di almeno il 15% la si mostra nel piano (con i suoi passi) e la usa il piano della notte. La soglia è pratica, non fisica: cambiare combinazione durante un progetto richiede flat e integrazioni separate. Il calendario delle notti usa una sola combinazione per progetto. Esempio (camera a colori, UV/IR + L-eXtreme, SQM 21,3, Luna piena): NGC 7000 passa da UV/IR (13,5 h con quella Luna) a L-eXtreme (3,9 h); a SQM 19,3 la combinazione resta L-eXtreme, già scelta senza Luna ([VERIFICA-casi.md](VERIFICA-casi.md)).

**Filtri singoli su camera a colori.** Un filtro a una sola riga (Hα, OIII, SII) su camera a colori lavora con i soli pixel che vedono quella riga (rossi per Hα e SII, verdi e blu per OIII) e dà un'immagine monocromatica: da solo resta un'alternativa, combinato con un duo-band forma una combinazione SHO. Un filtro che passa Hβ senza OIII (ALP-T SII+Hβ) ha un canale Hβ proprio.

## 8. Precisione di guida consigliata

Scala d'immagine p = 206,265 · pixel (µm) · binning / focale (mm). FWHM attesa delle stelle F = √(seeing² + diffrazione² + (0,68 p)²), con diffrazione 1,03 λ/D a 550 nm e 0,68 p la larghezza equivalente del pixel. Un errore di guida gaussiano con RMS σ per asse aggiunge (2,355 σ)².

Criterio: la guida non deve allargare le stelle più del 10%, cioè σ ≤ 0,195 F per asse, RMS totale (RA e Dec) ≤ 0,276 F; fino a 0,40 F l'allargamento resta sotto il 20%. Il seeing è la mediana della previsione per le ore di buio della notte, allo zenit; senza previsione si assume 2,5″ (dichiarato come ipotesi). Il campionamento (F senza pixel diviso p) classifica l'immagine: sotto 1,5 pixel per FWHM sottocampionata, sopra 3,5 sovracampionata. Il sovracampionamento si corregge con binning o riduttore, non con una guida migliore.

Ipotesi e limiti: profili gaussiani, ottica limitata dalla diffrazione, errore uguale sui due assi, seeing allo zenit (peggiora con la massa d'aria).

## 9. Verifiche

**Fuori campione, oggetti della seconda raccolta** (verifica usata dalla 0.15 alla 0.20: livelli adattati sulla prima raccolta, confronto sugli oggetti che la prima non aveva):

| Modello | foto (oggetti) | rapporto mediano ore vere / modello | errore mediano sull'oggetto | entro ×2 | entro ×3 |
| --- | --- | --- | --- | --- | --- |
| 0.15 (fisica, livello unico) | 720 (160) | ×0,27 | ×4,07 | 26% | 40% |
| 0.16–0.18 (tempo fisico compresso) | 720 (160) | ×0,80 | ×1,76 | 57% | 81% |
| 0.19 (fisica + livello per oggetto) | 720 (160) | ×0,75 | ×1,66 | 59% | 76% |
| 0.20 (risposta spettrale del sensore) | 743 (161) | ×0,80 | ×1,60 | 65% | 78% |
| 0.21, foto a colori da città | 745 (165) | ×0,98 | ×1,59 | 67% | 83% |
| 0.21, tutte le foto riportate al riferimento | 2095 (213) | ×0,84 | ×1,61 | 64% | 85% |

**Fuori campione, oggetti nuovi della quarta raccolta** (livelli adattati sulle raccolte precedenti; 237 foto di 52 oggetti mai visti): 0.20 errore ×2,37, 31% entro ×2 (le foto mono ×13,7); 0.21 ×1,96, 50% entro ×2 (mono ×2,35). Le raccolte precedenti avevano solo 90 foto mono: l'effetto della camera mono stimato lì (×5,6–6,8) è più alto di quello stimato su tutte le foto (×2,8–5,2).

**Verifica incrociata fra oggetti** (metà degli oggetti per tarare, con tutte le loro foto, l'altra metà per verificare, e viceversa): errore sull'oggetto ×1,45 e ×1,47, 74% e 70% entro ×2; foto mono ×1,55 e ×1,58, senza scarto sistematico (×0,99 e ×1,02).

**Taratura finale** (6918 foto di 311 oggetti): log g = 0,104 − 0,657 · log D; errore sull'oggetto lasciato fuori ×1,47. La stessa foto fatta da persone diverse varia di un fattore 2,7 (0,43 dex dopo aver tolto oggetto, camera e cielo): nessun modello può fare molto meglio sulla singola foto.

**Rapporti fra filtri e fra cieli.** Le foto non li verificano: le ore sono in gran parte un'abitudine, quindi una combinazione più efficiente produce un SNR più alto, non meno ore. Restano relazioni fisiche (§ 4) con i loro dati di ingresso (bande dei filtri, risposta del sensore, spettro del cielo).

**Casi rappresentativi.** Camera a colori e mono, SQM 18,0 / 19,3 / 21,3, emissione e spettro continuo, un filtro o combinazioni, con e senza Luna, con il confronto con la 0.20: [VERIFICA-casi.md](VERIFICA-casi.md).

**Riferimenti dell'autore.** Cocoon (IC 5146) e WR 134 dal terrazzo (SQM ~19,3, 800 mm f/5, camera a colori, L-eXtreme + L-Synergy): ~100 h e ~95 h per un SNR ritenuto discreto. Il livello «buona» (foto mediana) dà 3,4 h e 9,4 h, «profonda» (×3,3) 11 h e 31 h: lo standard dell'autore resta sopra quello delle foto apprezzate su AstroBin.

## 10. Limiti e dati che servono

| Dati | Intervallo e metadati | Cosa migliorerebbero |
| --- | --- | --- |
| **Confronti dello stesso autore** con un giudizio sul risultato | stesso oggetto e stessa attrezzatura con due filtri o due cieli, dicendo quale dei due risultati è accettabile (come la Cocoon 60 h dal terrazzo e 6 h da un sito buio) | l'unico modo di verificare i rapporti fisici fra filtri e fra cieli: le ore delle foto sono abitudini, non tempi necessari |
| **Sessioni registrate** in Skyframe con un giudizio sul risultato | le tue notti, con filtri e ore | una taratura personale del livello di qualità (il tuo standard è sopra il 90° percentile delle foto) |
| Foto con **SQM misurato con un fotometro** | qualsiasi cielo, indicando lo strumento | distinguere le misure dai valori copiati da un atlante (oggi non distinguibili) |
| Autore corretto nella raccolta | il nome dell'autore di ogni foto (oggi per 2391 foto compare il fondatore di AstroBin) | più analisi dentro lo stesso autore, che separano abitudini e fisica |
| Più foto di **ammassi e galassie deboli** | galassie oltre mag 11, ammassi aperti e globulari meno fotografati | il livello degli oggetti oggi previsto dalla sola difficoltà |
| Misure di **trasmissione dei filtri** «stima» | Antlia Quad Band, ALP-T 3 nm, ALP-T SII+Hβ, Seestar LP, SV220 3 nm e SII, SV240, IDAS NB1 e NB3, Baader UHC-S, Optolong UHC, Altair 6 nm SII+OIII, filtri singoli Antlia e SVBony | bande reali al posto di quelle stimate |
| **Curve di efficienza** di altri sensori | STARVIS (IMX585, IMX462, IMX678), Panasonic MN34230 (ASI1600), CCD Kodak/ON Semi, reflex: efficienza a 500, 656 e 672 nm relativa al picco, da misure pubblicate | la risposta spettrale oggi è quella dei Sony retroilluminati da 3,76 µm per tutte le camere |
| **Confronti con e senza Luna** dello stesso autore | stesso oggetto, attrezzatura e filtri, una sessione con Luna oltre il 60% e una senza, con ore e giudizio | verificare il modello della luce lunare diffusa e la soglia per cambiare combinazione |

Ipotesi ancora da verificare: rapporti fra righe tipici per tipo; spettro della luce artificiale (75% continuo); incertezza ±0,3 mag degli atlanti; effetti di camera e cielo uguali per tutti gli oggetti dello stesso tipo (righe o continuo); una sola curva di risposta spettrale per tutti i sensori.
