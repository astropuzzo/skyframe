'use strict';
/* Profili sul computer (profili.json nella cartella dati dell'app).
   - Scrittura atomica: file .tmp e poi rinomina; i salvataggi arrivano anche a pochi millisecondi di distanza (per esempio
     dopo aver scelto un luogo) e vanno in fila, così l'ordine resta quello giusto e due chiamate non condividono il .tmp.
   - Prima di passare a un formato nuovo si tiene il file com'era (profili-v<n>-backup.json).
   - Copie di sicurezza profili.bak1..3.json (bak1 la più recente), al massimo una ogni 6 ore.
   - Un file illeggibile non si sovrascrive: si mette da parte (profili-illeggibile-<data>.json) e si riparte dalla copia
     più recente che si legge; il dato restituito ha restored = data della copia. */
const fs = require('fs/promises');
const path = require('path');

const BAK_N = 3, BAK_EVERY = 6 * 3600e3;

async function readJson(f) {
  const j = JSON.parse(await fs.readFile(f, 'utf8'));
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('formato');
  return j;
}

function createStore(fileOf) {
  const bak = (i) => fileOf().replace(/\.json$/, `.bak${i}.json`);
  async function load() {
    const file = fileOf();
    try { return await readJson(file); } catch (e) {
      if (e.code === 'ENOENT') return null;
      try { await fs.rename(file, file.replace(/\.json$/, `-illeggibile-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)); } catch { /* niente */ }
      for (let i = 1; i <= BAK_N; i++) {
        try { const j = await readJson(bak(i)); j.restored = (await fs.stat(bak(i))).mtimeMs; return j; } catch { /* la prossima */ }
      }
      return null;
    }
  }
  async function write(data) {
    const file = fileOf();
    await fs.mkdir(path.dirname(file), { recursive: true });
    let txt = null; try { txt = await fs.readFile(file, 'utf8'); JSON.parse(txt); } catch { txt = null; } // file com'era, se si legge
    if (txt) {
      const old = JSON.parse(txt);
      if ((old.version || 1) < (data.version || 1)) await fs.writeFile(file.replace(/\.json$/, `-v${old.version || 1}-backup.json`), txt, 'utf8');
      let last = 0; try { last = (await fs.stat(bak(1))).mtimeMs; } catch { /* nessuna copia */ }
      if (Date.now() - last > BAK_EVERY) { // scritta, non copiata: la data del file è quella della copia
        for (let i = BAK_N; i > 1; i--) { try { await fs.rename(bak(i - 1), bak(i)); } catch { /* manca */ } }
        await fs.writeFile(bak(1), txt, 'utf8');
      }
    }
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
    return true;
  }
  let queue = Promise.resolve();
  const save = (data) => (queue = queue.catch(() => {}).then(() => write(data)));
  return { load, save, bak };
}

module.exports = { createStore, BAK_EVERY };
