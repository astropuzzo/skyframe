// ==UserScript==
// @name         Skyframe · raccolta AstroBin
// @namespace    https://github.com/astropuzzo/skyframe
// @version      1.0.0
// @description  Per la taratura dei tempi di Skyframe: per 100 oggetti legge le foto apprezzate (integrazione, filtri, telescopio, camera, cielo) e salva un file da passare a Skyframe.
// @match        https://app.astrobin.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

/* Come si usa (Firefox):
   1. installa l'estensione Violentmonkey (o Tampermonkey), poi apri questo file e conferma l'installazione;
   2. entra in AstroBin col tuo account, apri https://app.astrobin.com/search;
   3. nel riquadro «Skyframe» in basso a destra premi «Avvia»: va avanti da solo, una pagina ogni 5–9 secondi
      (100 oggetti × fino a 15 foto: qualche ora; puoi chiudere e riprendere, il punto a cui è arrivato resta salvato);
   4. alla fine scarica da solo skyframe-astrobin-AAAA-MM-GG.jsonl (o premi «Scarica il file» quando vuoi).
   Se AstroBin chiede una verifica («Just a moment…»), lo script si ferma: la completi tu e premi «Riprendi».
   Legge solo le pagine che vedresti tu, con calma; non usa altro. */
(function () {
  'use strict';
  // [id del catalogo di Skyframe, testo da cercare su AstroBin]
  const TARGETS = [
    ['M 31'], ['M 33'], ['M 51'], ['M 63'], ['M 64'], ['M 65'], ['M 66'], ['M 74'], ['M 77'], ['M 81'], ['M 82'], ['M 88'], ['M 94'], ['M 101'], ['M 104'],
    ['M 106'], ['M 108'], ['M 109'], ['NGC 891'], ['NGC 2403'], ['NGC 4565'], ['NGC 4631'], ['NGC 6946'], ['NGC 7331'], ['NGC 3628'], ['NGC 253'], ['IC 342'],
    ['NGC 2841'], ['NGC 5907'], ['NGC 5866'], ['NGC 4216'],
    ['NGC 7000'], ['IC 5070'], ['IC 1805'], ['IC 1848'], ['NGC 281'], ['NGC 7635'], ['IC 1396'], ['NGC 2237'], ['IC 434'], ['NGC 2024'], ['M 42'], ['M 8'],
    ['M 16'], ['M 17'], ['M 20'], ['NGC 6888'], ['Sh2-132'], ['NGC 7380'], ['IC 410'], ['IC 405'], ['Sh2-129'], ['Sh2-101'], ['NGC 1499'], ['IC 2177'],
    ['NGC 2264'], ['NGC 7822'], ['Sh2-157'], ['NGC 6914'], ['Sh2-86'], ['IC 1795'], ['NGC 1491'], ['Sh2-112'], ['Sh2-119'], ['IC 2162'], ['NGC 1579'], ['NGC 2359'],
    ['Sh2-240'], ['IC 443'], ['NGC 6960'], ['NGC 6992'], ['NGC 6979'], ['M 1'],
    ['M 27'], ['M 57'], ['M 97'], ['NGC 7293'], ['NGC 6543'], ['M 76'], ['NGC 7662'], ['NGC 2392'], ['NGC 6857'],
    ['M 45'], ['NGC 7023'], ['M 78'], ['NGC 1333'], ['vdB 152'], ['NGC 7129'], ['Sh2-136'], ['IC 5146'], ['WR 134'],
    ['LDN 1235'], ['LDN 1082', 'Barnard 150'], ['B 33', 'Barnard 33'], ['LDN 1251'], ['LDN 1622'], ['B 142', 'Barnard 142'], ['LDN 673'],
    ['M 13'], ['M 92'], ['M 3'],
  ].map(([t, q]) => ({ t, q: q || t }));
  const PER_TARGET = 15, MIN_LIKES = 25, WAIT = [5000, 9000], WAIT_TARGET = [12000, 20000];

  const S = { get: () => GM_getValue('sf', null), set: (v) => GM_setValue('sf', v) };
  const blank = () => ({ running: false, ti: 0, phase: 'search', cands: [], ci: 0, tries: 0, out: [], seen: {}, msg: '' });
  let st = S.get() || blank();
  const save = () => S.set(st);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = ([a, b]) => a + Math.random() * (b - a);
  const lines = () => document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) { /* riprova */ } await sleep(400); } return null; };
  const challenge = () => /just a moment|ci siamo quasi|attention required|verify you are human|verifica/i.test(document.title) || !!document.querySelector('#challenge-form, .cf-challenge, iframe[src*="challenges.cloudflare"]');

  /* ---------- riquadro ---------- */
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:300px;background:#0B1220;color:#E7EDF7;border:1px solid #2B3A55;border-radius:12px;padding:12px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)';
  document.body.appendChild(box);
  function draw() {
    const T = TARGETS[st.ti], n = st.out.length;
    box.innerHTML = `<b style="color:#4CCFBC">Skyframe</b> · raccolta per la taratura<br>
      <span style="color:#9FB0C8">${st.ti >= TARGETS.length ? 'Finito.' : `Oggetto ${st.ti + 1}/${TARGETS.length}: ${T.t}` + (st.phase === 'images' ? ` · foto ${st.ci + 1}/${st.cands.length}` : ' · ricerca')}</span><br>
      <span>${n} schede raccolte</span>${st.msg ? `<br><span style="color:#F2B84B">${st.msg}</span>` : ''}
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button data-a="go" style="${btn(true)}">${st.running ? 'Pausa' : st.out.length || st.ti ? 'Riprendi' : 'Avvia'}</button>
        <button data-a="file" style="${btn()}">Scarica il file</button>
        <button data-a="reset" style="${btn()}">Azzera</button></div>`;
  }
  const btn = (p) => `border:0;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 12.5px system-ui;${p ? 'background:#4CCFBC;color:#06221E' : 'background:#1B2740;color:#E7EDF7'}`;
  box.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'go') { st.running = !st.running; st.msg = ''; save(); draw(); if (st.running) step(); }
    else if (a.dataset.a === 'file') download();
    else if (a.dataset.a === 'reset' && confirm('Cancello le schede raccolte e ricomincio da capo?')) { st = blank(); save(); draw(); }
  });
  function download() {
    const blob = new Blob([st.out.map((x) => JSON.stringify(x)).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `skyframe-astrobin-${new Date().toISOString().slice(0, 10)}.jsonl`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  const stop = (msg) => { st.running = false; st.msg = msg; save(); draw(); };
  const go = (url) => { save(); location.href = url; };
  function nextTarget() { st.ti++; st.phase = 'search'; st.cands = []; st.ci = 0; st.tries = 0; save(); }

  /* ---------- ricerca: il testo nella casella, come a mano; poi le foto con almeno MIN_LIKES mi piace ---------- */
  async function search() {
    const T = TARGETS[st.ti];
    if (location.pathname !== '/search') return go('https://app.astrobin.com/search');
    const inp = await until(() => document.querySelector('input[type="search"]'), 15000);
    if (!inp) return stop('Non trovo la casella di ricerca: ricarica la pagina e premi Riprendi.');
    inp.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, T.q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    for (const type of ['keydown', 'keypress', 'keyup']) inp.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    inp.dispatchEvent(new Event('search', { bubbles: true }));
    // la pagina di ricerca vuota mostra già immagini d'esempio: conta solo quando compare «N risultati»
    const counted = () => /d[d.,]* (risultati|results)/i.test(document.body.innerText);
    let ok = await until(counted, 9000);
    if (!ok && inp.form) { try { inp.form.requestSubmit(); } catch (e) { /* niente */ } ok = await until(counted, 9000); }
    if (!ok) { if (++st.tries >= 2) { st.msg = `Nessun risultato per ${T.q}: salto.`; nextTarget(); } save(); return setTimeout(step, 3000); }
    await sleep(2500);
    for (let i = 0; i < 3; i++) { window.scrollTo(0, document.body.scrollHeight); await sleep(1800); }
    const seen = new Map();
    for (const a of document.querySelectorAll('a[href*="/i/"]')) {
      const id = (a.getAttribute('href').split('/i/')[1] || '').split(/[/?#]/)[0]; if (!id || seen.has(id) || st.seen[id]) continue;
      let c = a; for (let k = 0; k < 6 && c.parentElement; k++) { c = c.parentElement; if (String(c.className).includes('image-container')) break; }
      const t = (c.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean), nums = t.filter((s) => /^\d+(\.\d+)?k?$/.test(s)).map((s) => (s.endsWith('k') ? parseFloat(s) * 1000 : +s));
      if (t.length >= 5 && nums.length >= 2) seen.set(id, { id, ti: t[0].slice(0, 80), lk: nums[1] });
    }
    st.cands = [...seen.values()].filter((x) => x.lk >= MIN_LIKES).slice(0, PER_TARGET); st.ci = 0;
    if (!st.cands.length) { nextTarget(); return setTimeout(step, rnd(WAIT)); }
    st.phase = 'images'; save();
    await sleep(rnd(WAIT)); go('https://app.astrobin.com/i/' + st.cands[0].id);
  }

  /* ---------- una foto: le righe dall'integrazione agli oggetti, come le vede chi apre la pagina ---------- */
  async function image() {
    const c = st.cands[st.ci];
    if (!location.pathname.startsWith('/i/' + c.id)) return go('https://app.astrobin.com/i/' + c.id);
    await until(() => /Integrazione|Integration|Oggetti|Objects/.test(document.body.innerText), 15000);
    await sleep(1200);
    const T = lines(), val = (k) => { const i = T.indexOf(k); return i < 0 ? null : T[i + 1]; };
    const i0 = T.findIndex((s) => s === 'Integrazione' || s === 'Integration'), i1 = T.findIndex((s, i) => i > i0 && (s === 'Oggetti' || s === 'Objects'));
    const d0 = T.findIndex((s, i) => i > Math.max(i0, i1) && (s === 'Descrizione' || s === 'Description'));
    st.out.push({
      t: TARGETS[st.ti].t, id: c.id, lk: c.lk, ti: document.title.replace(/ - AstroBin$/, '').slice(0, 100), src: 'userscript',
      bo: +val('BORTLE') || null, sq: val('SQM'), sc: +((T.find((s) => /^[\d.]+″\/px$/.test(s)) || '').replace('″/px', '')) || null,
      fov: T.find((s) => /^[\d.]+° × [\d.]+°$/.test(s)) || null,
      raw: i0 < 0 ? [] : T.slice(i0 + 1, i1 > i0 ? i1 : i0 + 80).slice(0, 80), de: d0 < 0 ? '' : T.slice(d0 + 1, d0 + 6).join(' ').slice(0, 300),
    });
    st.seen[c.id] = 1; st.ci++;
    if (st.ci >= st.cands.length) { nextTarget(); save(); if (st.ti >= TARGETS.length) { stop('Finito: scarico il file.'); download(); return; } await sleep(rnd(WAIT_TARGET)); return go('https://app.astrobin.com/search'); }
    save(); await sleep(rnd(WAIT)); go('https://app.astrobin.com/i/' + st.cands[st.ci].id);
  }

  async function step() {
    draw();
    if (!st.running) return;
    if (challenge()) return stop('AstroBin chiede una verifica: completala e premi «Riprendi».');
    if (st.ti >= TARGETS.length) { stop('Finito.'); return; }
    try { if (st.phase === 'search') await search(); else await image(); } catch (e) { stop('Errore: ' + e.message + ' — premi «Riprendi».'); }
  }
  draw();
  if (st.running) setTimeout(step, 1500);
})();
