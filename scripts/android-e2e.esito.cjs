// Esito della prova su emulatore, dai controlli dell'ultimo tentativo (e2e/risultati.json). La prova in sé non ferma il
// job, perché se l'emulatore sparisce deve poter partire il secondo tentativo: il rosso o il verde si decide qui.
const fs = require('fs');
const fail = (msg) => { console.error(msg); process.exit(1); };
if (!fs.existsSync('e2e/risultati.json')) fail('nessun risultato: la prova non è partita');
if (fs.existsSync('e2e/emulatore-sparito')) fail('emulatore sparito anche all’ultimo tentativo');
const r = JSON.parse(fs.readFileSync('e2e/risultati.json', 'utf8'));
const bad = Object.entries(r.checks || {}).filter(([, v]) => !v).map(([k]) => k);
if (!r.checks || !r.checks.avvio || bad.length) fail('controlli falliti: ' + (bad.join(', ') || 'avvio'));
console.log(Object.keys(r.checks).length + ' controlli passati');
