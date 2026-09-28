# Confronto del calcolo meteo per i target

Calcolo riproducibile con `node scripts/check-weather-timing.cjs`. Per confrontare la versione di partenza:

```powershell
$env:BASELINE_REV='bee94f1d4fba284324822bdbfcaa4d1e0a493424'
node scripts/check-weather-timing.cjs
```

**Scenario comune.** Roma (41,9° N, 12,5° E), SQM 19,26, notte del 10 ottobre 2026; 160/800 f/5, camera e livello di qualità del profilo predefinito, filtri UV/IR e L-eXtreme. Previsione sintetica uguale per tutti: cielo sereno al 100% dalle 18 alle 22, 80% alle 22, 40% alle 23, 10% da mezzanotte alle 06. Trasparenza neutra. Serve a isolare l'effetto dell'**orario** delle schiarite, non è una previsione meteo reale né una taratura su fotografie.

La colonna «ore per il target» è l'integrazione richiesta se le ore utili avessero la distribuzione di altezza, Luna e fondo cielo della notte in esame. Le ore serene effettive sono la somma della frazione serena nelle ore in cui ciascun target è riprendibile. Il lavoro teorico della notte è `ore serene effettive / ore per il target`; oltre il 100% significa che il progetto terminerebbe quella notte.

| Target | Tipo | Ore serene effettive | Ore per il target prima | Ore per il target dopo | Lavoro della notte prima → dopo |
| --- | --- | ---: | ---: | ---: | ---: |
| NGC 7000 | nebulosa a emissione | 3,26 | 11,41 | 11,15 | 28,6% → 29,2% |
| M 31 | galassia | 3,62 | 20,75 | 20,97 | 17,4% → 17,2% |
| M 27 | nebulosa planetaria | 3,13 | 4,14 | 4,04 | 75,6% → 77,4% |
| NGC 7023 | nebulosa a riflessione | 3,62 | 8,04 | 7,22 | 45,0% → 50,1% |
| M 56 | ammasso globulare | 3,07 | 1,34 | 1,28 | completa in entrambi i casi |

**Controllo dell'errore corretto.** Per M 56, due prove con uguale totale di ore serene, concentrate nella prima o nella seconda metà della sua finestra utile, davano entrambe il 155,3% del lavoro richiesto nel vecchio modello. Il nuovo calcolo dà rispettivamente 170,7% e 139,9%, perché le condizioni dell'oggetto cambiano nel frattempo. Il valore sopra 100% è il rendimento grezzo del test: il calendario si ferma quando il progetto è completo.

Il modello ora pesa il rendimento di ciascun intervallo per frazione serena e trasparenza, insieme a massa d'aria, Luna e fondo cielo già calcolati in quell'ora. Questo corregge la coerenza interna del calendario. L'accuratezza assoluta delle ore richiede ancora un confronto indipendente con sessioni osservate e previsioni archiviate.
