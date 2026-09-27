# Copertura del catalogo

Generato da `scripts/build-index.cjs` il 2026-09-27. Confronto fra le fonti e il catalogo di Skyframe.

**Fonti.** NGC e IC: OpenNGC (M. Verga, CC BY-SA 4.0), compilazione aggiornata dei cataloghi di Dreyer con dati da NED, HyperLEDA e SIMBAD, qui controllata sulla numerazione completa (NGC 1–7840, IC 1–5386). Messier: le identificazioni di OpenNGC (colonna M e addendum). Sharpless: VizieR VII/20 (Sharpless 1959, 313 regioni). Lynds: VizieR VII/7A (Lynds 1962, 1802 nubi; il file VizieR elenca 1787 righe).

**Stati.** *Nella lista*: dati completi, l'oggetto è classificato ogni notte. *Calcolabile*: tipo gestito e dimensioni note, i tempi si calcolano quando lo apri; la luminosità superficiale può essere misurata o stimata (vedi sotto). *Dati insufficienti*: è nel catalogo, lo trovi cercandolo, ma non c'è una stima (per esempio stelle, asterismi, voci inesistenti).

| Catalogo | voci attese | trovate | nella lista | calcolabili | dati insufficienti | mancanti |
| --- | --- | --- | --- | --- | --- | --- |
| Messier | 110 | 110 | 106 | 1 | 3 | — |
| NGC | 7840 | 7840 | 1319 | 6057 | 464 | — |
| IC | 5386 | 5386 | 190 | 4313 | 883 | — |
| Sharpless | 313 | 313 | 266 | 47 | 0 | — |
| LDN | 1802 | 1787 | 320 | 1459 | 8 | 184, 366, 457, 465, 924, 1025, 1318, 1342, 1344, 1413, 1575, 1592 … (15) |

## Motivi dei dati insufficienti

- **Messier**: associazione stellare o asterismo 1 · oggetto non classificato 1 · stella doppia 1
- **NGC**: oggetto non classificato 159 · stella 119 · stella doppia 102 · associazione stellare o asterismo 44 · dimensioni non note 39 · oggetto inesistente (errore del catalogo originale) 1
- **IC**: stella 427 · oggetto non classificato 260 · stella doppia 142 · dimensioni non note 24 · associazione stellare o asterismo 18 · oggetto inesistente (errore del catalogo originale) 9 · nova 3
- **LDN**: dimensioni non note 8

## Luminosità superficiale degli oggetti calcolabili

- **Messier**: dalla magnitudine misurata 1
- **NGC**: dalla magnitudine misurata 5732 · valore tipico del tipo (non misurata) 325
- **IC**: dalla magnitudine misurata 4169 · valore tipico del tipo (non misurata) 144
- **Sharpless**: dalla classe di luminosità Sharpless 47
- **LDN**: dall’opacità Lynds 1459

## Note

- **M 102** ha un'identificazione controversa: OpenNGC, seguendo NED, la tratta come doppione di M 101 (altri la identificano con NGC 5866). Cercando M 102 si apre M 101.
- **LDN**: il file VizieR VII/7A contiene 1787 numeri distinti su 1802; mancano già nella fonte 184, 366, 457, 465, 924, 1025, 1318, 1342, 1344, 1413, 1575, 1592, 1593, 1603, 1792.
- Le voci doppie di OpenNGC (652) non sono oggetti a sé: sono state aggiunte come nomi alternativi dell'oggetto a cui rimandano, così la ricerca le trova senza duplicati.
- La lista classificata ogni notte (2366 oggetti) è una selezione: galassie più deboli di mag 12 o più piccole di 1,5′, globulari più deboli di mag 10, ammassi aperti deboli e piccoli, oggetti a sud di −45° (−35° per le nubi oscure) restano fuori dalla classifica per non riempirla di oggetti poco fotografati, ma sono nell'indice e si calcolano a richiesta.
- Una luminosità superficiale **stimata** (classe Sharpless, opacità Lynds, valore tipico) rende il tempo indicativo: il dettaglio lo segnala.
