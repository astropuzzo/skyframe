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
| Risposta dei pixel R, G, B della matrice di Bayer | modello a gradini (`bayer()`) | approssimazione |
| Spettro dell'oggetto: continuo e righe Hα, [NII], Hβ, OIII, [SII] | rapporti tipici per tipo (`LINES`); Hα misurato (NSNS, SHASSA) per molte nebulose | misura per l'Hα, ipotesi per i rapporti fra righe |
| Luminosità superficiale e dimensioni | OpenNGC, Sharpless, Lynds, tabelle di correzione | misura (dalla magnitudine) o stima (classe, opacità, valore tipico): vedi [CATALOGO.md](CATALOGO.md) |
| Polvere attorno all'oggetto | mappa SFD 1998 di E(B−V) | misura |
| Hα diffuso attorno | mappa di Finkbeiner 2003 | misura |
| Fondo cielo allo zenit (SQM) | misura con fotometro, mappa all-sky, atlante di Lorenz, classe di Bortle | misura o stima con incertezza dichiarata (§ 6) |
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

1. **Segnale e fondo per canale.** Per ogni banda del filtro si integrano spettro dell'oggetto, spettro del cielo, trasmissione del filtro, risposta del pixel, area efficace (apertura, ostruzione, QE, 85% di trasmissione dell'ottica).
2. **Elemento di risoluzione.** Il SNR si misura su un elemento di dimensione max(pixel, 468″·mm / D): quattro volte il limite di diffrazione. Scelta tarata sulle foto (prima taratura): con un elemento fisso le foto reali divergevano dal modello come D^2,6.
3. **Tempo.** t = SNR² × (S + B + N) / S², con S segnale, B fondo cielo, N rumore di lettura e termico per elemento. È rumore fotonico: vale per ogni camera, filtro e cielo.
4. **Pose singole.** La posa minima è quella per cui il fondo cielo per pixel vale 10 volte il rumore di lettura al quadrato; il valore proposto è quello più usato nelle foto di riferimento (evidenza, § 5), mai sotto il minimo fisico.
5. **Mosaici.** Ogni pannello richiede lo stesso tempo.

Filtri, cielo, telescopio e Luna cambiano i tempi **solo** attraverso queste relazioni.

## 5. Livello di qualità: dalle foto

**Evidenza.** Per ogni foto di AstroBin con attrezzatura riconosciuta il modello rifà il conto con il telescopio, la camera, i filtri e il cielo (classe Bortle dichiarata) di quella foto e ottiene il tempo fisico a un SNR di riferimento, t_fis. Il rapporto g = ore dichiarate / t_fis dice quale SNR ha raggiunto la foto: SNR = SNR_rif · √g.

Tre osservazioni:

- Le ore dichiarate dipendono poco dal tempo fisico: fra oggetti crescono come t_fis^0,2–0,3; per lo stesso oggetto quasi per niente (chi riprende non adegua le ore al proprio cielo o filtro). Le ore delle foto misurano quindi un'abitudine, non il tempo necessario.
- Il SNR raggiunto dipende dall'oggetto: sugli oggetti difficili si accetta un SNR più basso. Fra oggetti, log g = a + b · log D con b = −0,71, dove D è la difficoltà fisica (ore a SNR di riferimento con un setup fisso: rifrattore 100 mm f/5,5, IMX571 a colori, UV/IR e L-eXtreme, SQM 19,0, latitudine 45°).
- Le camere mono e i cieli bui raggiungono SNR molto più alti (g ×5–16), ma con pochi dati (90 e 80 foto).

**Uso nel modello.** Il livello «buona» di un oggetto è il SNR della sua foto mediana: per gli oggetti con foto, la mediana delle loro g unita alla previsione con peso 6 foto; per gli altri la previsione da D. Il tempo mostrato è t_fis (con la tua attrezzatura, il tuo cielo, la tua Luna) × g × k, con k = 0,47 / 1 / 2 / 3,3 per rapida / buona / eccellente / profonda (25°, 50°, 75°, 90° percentile delle foto dello stesso oggetto). Nel dettaglio si vede se il livello viene dalle foto dell'oggetto o dalla previsione.

**Differenza dalle versioni precedenti.** La 0.16–0.18 comprimeva il tempo fisico (ore ∝ √t_fis) per somigliare alle ore dichiarate: si avvicinava alle foto, ma attenuava anche le differenze fisiche fra filtri e cieli, quindi rendeva meno affidabile il confronto fra combinazioni. Ora la dipendenza dall'oggetto (evidenza) e la fisica (strumenti, cielo, filtri, Luna) sono separate.

### Dati usati

| Insieme | Contenuto | Uso |
| --- | --- | --- |
| Prima raccolta (2026-09-25) | 190 foto di 23 oggetti, schede lette a mano, cieli e camere di ogni tipo | taratura della struttura del modello (elemento di risoluzione, dipendenza dalla luminosità superficiale, galassie) |
| Seconda raccolta (2026-09-26, 1ª parte) | 1205 foto, 101 oggetti; camere a colori, Bortle 6–8, ≥30 apprezzamenti, dal 2024 | taratura dei livelli di qualità e delle pose singole |
| Terza raccolta (2026-09-26, 2ª parte) | 2241 foto, 559 target cercati; 972 foto nuove, 192 target nuovi | **verifica** (i 160 oggetti confrontabili mai usati per tarare), poi inclusa nella taratura finale |
| Foto scartate | attrezzatura non riconosciuta (21 telescopi, 4 camere, 75 filtri), più telescopi o camere, integrazione mancante | escluse: dati insufficienti |
| Camere mono (90 foto), cieli Bortle 1–5 (80 foto) | dalla prima raccolta | insufficienti per tarare un livello proprio; mostrano solo che quelle foto raggiungono SNR più alti |
| Foto con SQM misurato | nessuna nella seconda e terza raccolta | assenti: il cielo delle foto viene dalla classe Bortle (§ 6) |

## 6. SQM e classe di Bortle

La scala di Bortle è una classificazione visuale; non ha una conversione esatta in SQM. Si usano gli intervalli di Dark Skies Awareness (riportati in «Bortle scale», Wikipedia; la classe 4,5 è unita alla 4): 1: 21,76–22,0 · 2: 21,6–21,76 · 3: 21,3–21,6 · 4: 20,3–21,3 · 5: 19,25–20,3 · 6: 18,5–19,25 · 7: 18,0–18,5 · 8: 17,5–18,0 (estremo inferiore ipotizzato) · 9: < 17,5. Altre tabelle differiscono fino a ~0,5 mag.

Ogni luogo porta l'origine del suo SQM e un'incertezza: misura con fotometro ±0,1; mappa all-sky o atlante ±0,3 (ordine di grandezza dello scarto fra modelli satellitari e misure a terra: da verificare con misure); classe di Bortle: mezzo intervallo più 0,25; valore inserito senza origine ±0,3. Il piano mostra l'intervallo di ore che ne deriva (la parte artificiale del fondo scala come 10^(0,4 ΔSQM)).

Nelle foto di riferimento il cielo è la classe Bortle dichiarata dall'autore, portata al centro dell'intervallo. Spostare tutti i centri di ±0,3 mag sposta il livello di qualità di −20% / +24%: è l'incertezza principale della taratura.

## 7. Scelta dei filtri

**Criterio.** Fra le combinazioni ammesse dall'obiettivo del profilo si sceglie quella con il tempo più breve per il SNR richiesto, senza pesi. Il SNR richiesto incorpora già contrasto (segnale rispetto al fondo) e tempo.

**Obiettivi** (profilo, «Obiettivo della ripresa»):

- *Minor tempo per il SNR richiesto* (predefinito): su un oggetto a righe la combinazione deve raccogliere Hα e OIII quando sono importanti (almeno il 12% della riga più forte), perché altrimenti il SNR si misurerebbe su meno segnale e una combinazione incompleta sembrerebbe più rapida.
- *Tutte le righe (SHO)*: raccoglie anche la SII dove è importante (palette SHO).
- *Colori naturali*: solo banda larga (in mono anche RGB con un canale Hα).

**Regole.** Il risultato dev'essere a colori quando è possibile (solo L o solo Hα restano alternative). Gli oggetti a spettro continuo (galassie, nebulose a riflessione, oscure, ammassi) si riprendono in banda larga: la banda stretta non raccoglie il loro segnale e il calcolo lo mostra da solo. Quando la combinazione scelta è a banda stretta, il colore delle stelle viene da una ripresa a banda larga separata: il segnale di una stella di magnitudine 16 arriva a SNR 10 in secondi o minuti, quindi il tempo proposto è quello di 20 pose (il minimo per scartare pixel anomali con il clipping statistico). Ogni passo del piano indica il suo ruolo (corpo dell'oggetto, parti deboli, polveri, guscio OIII, colore delle stelle).

## 8. Precisione di guida consigliata

Scala d'immagine p = 206,265 · pixel (µm) · binning / focale (mm). FWHM attesa delle stelle F = √(seeing² + diffrazione² + (0,68 p)²), con diffrazione 1,03 λ/D a 550 nm e 0,68 p la larghezza equivalente del pixel. Un errore di guida gaussiano con RMS σ per asse aggiunge (2,355 σ)².

Criterio: la guida non deve allargare le stelle più del 10%, cioè σ ≤ 0,195 F per asse, RMS totale (RA e Dec) ≤ 0,276 F; fino a 0,40 F l'allargamento resta sotto il 20%. Il seeing è la mediana della previsione per le ore di buio della notte, allo zenit; senza previsione si assume 2,5″ (dichiarato come ipotesi). Il campionamento (F senza pixel diviso p) classifica l'immagine: sotto 1,5 pixel per FWHM sottocampionata, sopra 3,5 sovracampionata. Il sovracampionamento si corregge con binning o riduttore, non con una guida migliore.

Ipotesi e limiti: profili gaussiani, ottica limitata dalla diffrazione, errore uguale sui due assi, seeing allo zenit (peggiora con la massa d'aria).

## 9. Verifiche

**Fuori campione.** Livelli adattati solo sulla prima parte della seconda raccolta, verificati sulle foto della terza raccolta di 160 oggetti mai usati (720 foto):

| Modello | rapporto mediano ore vere / modello | errore mediano sull'oggetto | oggetti entro ×2 | entro ×3 |
| --- | --- | --- | --- | --- |
| 0.15 (fisica, livello unico) | ×0,27 | ×4,07 | 26% | 40% |
| 0.16–0.18 (tempo fisico compresso) | ×0,80 | ×1,76 | 57% | 81% |
| attuale (fisica + livello per oggetto) | ×0,75 | ×1,66 | 59% | 76% |

Il modello attuale prevede le ore delle foto come la 0.18, pur restando fisicamente coerente nel confronto fra filtri e cieli. Sulla verifica i globulari restavano sovrastimati (×0,45): nella taratura c'erano solo tre globulari celebri; con la taratura finale (23 globulari) il livello si corregge.

**Taratura finale** (tutte le foto, 258 oggetti, 1990 foto a colori): log g = 0,069 − 0,710 · log D; errore sull'oggetto lasciato fuori ×1,60; per gli oggetti con foto, previsione unita a metà delle foto e verificata sull'altra metà: ×1,48. La stessa foto fatta da persone diverse varia di un fattore 2,7 (0,44 dex): nessun modello può fare molto meglio sulla singola foto.

**Casi rappresentativi.** Camera a colori e mono, SQM 18,0 / 19,3 / 21,3, emissione e spettro continuo, un filtro o combinazioni, con il confronto con la 0.18: [VERIFICA-casi.md](VERIFICA-casi.md). Principali differenze: con due duo-band (L-eXtreme + L-Synergy) la 0.18 imponeva lo SHO con penalità arbitrarie (11–76 h), ora si sceglie la combinazione più rapida e lo SHO resta un obiettivo esplicito; con cielo buio la banda larga diventa competitiva sulle nebulose luminose, come previsto dalla fisica.

**Riferimenti dell'autore.** Cocoon (IC 5146) e WR 134 dal terrazzo (SQM ~19,3, 800 mm f/5, camera a colori): ~100 h e ~95 h per un SNR ritenuto discreto. Il livello «buona» (foto mediana) dà 4 h e 9 h, «profonda» (90° percentile) 14 h e 28 h: lo standard dell'autore è molto sopra quello delle foto apprezzate su AstroBin; per questo ci sono i livelli superiori.

## 10. Limiti e dati che servono

| Dati | Intervallo e metadati | Cosa migliorerebbero |
| --- | --- | --- |
| Foto con **camera monocromatica** | SQM 18–21,5 (Bortle 2–8); nebulose a emissione, resti di SN, planetarie, galassie; filtri Hα/OIII/SII 3–7 nm e LRGB; per ogni filtro integrazione e posa singola; guadagno; telescopio (apertura, focale, riduttore); Bortle o SQM misurato | un livello di qualità proprio per le camere mono (oggi solo 90 foto) |
| Foto a colori da **cieli bui** | Bortle 1–5 (SQM ≥ 19,25), stessi metadati | capire se il SNR accettato dipende dal cielo e tarare il livello per chi riprende da siti bui (oggi 80 foto) |
| Foto con **SQM misurato** | qualsiasi cielo, valore SQM-L o simile | ridurre l'incertezza della conversione Bortle → SQM (oggi ±20% sul livello) |
| **Confronti dello stesso autore** | stesso oggetto e stessa attrezzatura con due filtri o due cieli, con un giudizio sul risultato (come la Cocoon 60 h dal terrazzo e 6 h da un sito buio) | l'unico modo di verificare i rapporti fisici fra filtri e fra cieli: le ore delle foto sono abitudini, non tempi necessari |
| Più foto di **ammassi e galassie deboli** | galassie oltre mag 11, ammassi aperti e globulari meno fotografati | il livello degli oggetti oggi previsto dalla sola difficoltà |
| **Sessioni registrate** in Skyframe con un giudizio sul risultato | le tue notti, con filtri e ore | una taratura personale del livello di qualità |
| Misure di **trasmissione dei filtri** «stima» | Antlia Quad Band, Seestar LP, ALP-T 3 nm, SV220 3 nm e SII | bande reali al posto di quelle stimate |

Ipotesi ancora da verificare: rapporti fra righe tipici per tipo; spettro della luce artificiale (75% continuo); incertezza ±0,3 mag degli atlanti; livello «buona» uguale per camere a colori e mono.
