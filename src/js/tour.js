'use strict';
/* ============================ guida ============================
   Un giro breve: una scheda ancorata (in basso sul telefono, in un angolo sul computer) e un faro che illumina un
   elemento dell'app. Coreografia fissa, un solo movimento per passo:
     1. il testo esce, sotto un velo la scena si prepara (sezione, dettaglio, scorrimento: tutto istantaneo);
     2. appena l'elemento sta fermo il faro ci scivola sopra con una molla critica (senza rimbalzi né ritorni),
        e il testo nuovo entra;
     3. dove serve un gesto (toccare, trascinare) un dito lo mostra, due volte.
   Parte da sola al primo avvio; chi aveva già Skyframe riceve la proposta; dopo un aggiornamento le «Novità» e i passi
   nuovi. Si riprende da Setup → Guida. v = versione in cui il passo è comparso. */
const TOUR_STEPS = [
  { id: 'benvenuto', v: '0.13.0', view: 'tonight', hero: true, t: 'Skyframe', d: 'Prima inserisci luogo e attrezzatura. Poi confronta i target con le condizioni della notte.' },
  { id: 'luogo', v: '0.25.0', view: 'setup', sel: '#stLocations h3', t: '1. Luogo di osservazione', d: 'Apri il luogo in Setup. Cerca un indirizzo o posiziona il punto sulla mappa; controlla le coordinate, assegna un nome e salva.',
    cta: () => ['Apri il luogo', () => tourOpenEditor('loc', 'edSite')] },
  { id: 'allsky', v: '0.25.0', view: 'setup', sel: '#stLocations h3', t: '2. Cielo e mappa all-sky',
    d: () => window.cielo && window.cielo.lpmAllSky
      ? 'Fissa prima il punto sulla mappa. La mappa all-sky si carica da sola; puoi riprovare con «Prendi la mappa all-sky dal sito». Controlla lo SQM e salva il luogo.'
      : 'Nel luogo apri lightpollutionmap, scegli «Sky brightness» e scarica l’immagine All-sky. Importala qui, verifica i valori della barra dei colori e salva il luogo.',
    cta: () => ['Apri la mappa all-sky', () => tourOpenEditor('loc', 'skyDrop')] },
  { id: 'orizzonte', v: '0.25.0', view: 'setup', sel: '#stLocations h3', t: '3. Orizzonte', d: 'Imposta l’altezza minima. Per gli ostacoli locali disegna il profilo o importa un file .hrz. Se hai una mappa all-sky, puoi usare il terreno incluso.',
    cta: () => ['Apri l’orizzonte', () => tourOpenEditor('loc', 'edHorizon')] },
  { id: 'attrezzatura', v: '0.25.0', view: 'setup', sel: '#stEquipment h3', t: '4. Camera e telescopio', d: 'Scegli la camera e verifica pixel, QE e rumore di lettura. Seleziona il telescopio oppure inserisci apertura e focale; aggiungi gli accessori che usi.',
    cta: () => ['Apri il profilo', () => tourOpenEditor('prof', 'edCamera')] },
  { id: 'filtri', v: '0.25.0', view: 'setup', sel: '#stEquipment h3', t: '5. Filtri e sessione', d: 'Spunta solo i filtri disponibili per quella camera. In Sessione imposta la fascia oraria, se vuoi limitarla, e il livello di qualità. Poi salva il profilo.',
    cta: () => ['Apri i filtri', () => tourOpenEditor('prof', 'edFilters')] },
  { id: 'notti', v: '0.13.0', view: 'tonight', sel: '#nightBar', hint: ['#nightBar > :nth-child(2)', 'tap'], t: 'Scegli la notte', d: 'La striscia mostra buio, Luna e nuvole previste. Tocca una data per aggiornare target e piano.' },
  { id: 'cielo', v: '0.13.0', view: 'tonight', sel: '.skycard', anchor: 'bottom', hint: ['.skycard .clock', 'drag'], t: 'Ora della ripresa', d: 'Trascina la barra del tempo per vedere posizione dei target e condizioni durante la notte.' },
  { id: 'piano', v: '0.13.0', view: 'tonight', sel: '#tonight', t: 'Piano della notte', d: 'I blocchi indicano quando riprendere ciascun target. Apri un target per controllare filtri, ore e inquadratura.' },
  { id: 'catalogo', v: '0.19.0', view: 'targets', sel: '.searchbox', t: 'Cerca un target', d: 'Cerca per sigla o nome. Usa i filtri per limitare ore utili, tecnica e inquadratura.' },
  { id: 'quanto', v: '0.13.0', detail: 'piano', sel: '#scen', t: 'Tempi stimati', d: 'Qui trovi integrazione, notti previste e data di fine per il luogo e il profilo attivi.' },
  { id: 'fotovere', v: '0.16.0', detail: 'piano', sel: '.real-card', hint: ['.real-card .rbar .me', 'ping'], when: () => !!(window.REAL && REAL.o[(tourSample() || {}).id]), t: 'Foto di riferimento', d: 'Confronta la stima con le ore dichiarate per foto dello stesso target. Il punto verde indica il tuo setup.' },
  { id: 'meteo', v: '0.13.0', view: 'sky', sel: '#skyView .sk-nights', t: 'Previsioni', d: 'Nuvole, seeing e aerosol cambiano ora per ora. Il calendario pesa le ore serene previste.' },
  { id: 'progetti', v: '0.13.0', view: 'projects', sel: '#projView', t: 'Progetti', d: 'Aggiungi un target ai preferiti o registra una sessione. Il piano tiene conto del lavoro già svolto.' },
  { id: 'autoguida', v: '0.19.0', view: 'setup', sel: '#stGuiding', t: 'Autoguida', d: 'Il limite RMS consigliato dipende dalla scala d’immagine e dal seeing previsto.' },
];
/* novità per versione (le più recenti in cima) */
const NEWS = [
  { v: '0.25.0', items: ['Guida operativa per luogo, mappa all-sky, orizzonte e attrezzatura, anche su Android', 'Modello aggiornato per tempi di posa, Luna e previsioni; descrizioni dei target riviste'] },
  { v: '0.24.0', items: ['Sei livelli di qualità con stima delle ore per i tuoi target'] },
  { v: '0.23.0', items: ['Regolazione della qualità in Setup con aggiornamento delle ore stimate'] },
  { v: '0.22.0', items: ['SHO consigliato sui soggetti adatti, se hai i filtri', 'Descrizioni più concise'] },
  { v: '0.21.0', items: ['Tempi tarati su 6918 foto, anche mono e da cieli bui', 'Bortle → SQM dai valori reali degli astrofotografi', 'Foto di riferimento con camera e cielo come i tuoi', 'Più camere, telescopi e filtri mono'] },
  { v: '0.20.0', items: ['Sensibilità del sensore per colore; 16 filtri, 2 camere, 6 telescopi', 'Filtri consigliati anche con la Luna'] },
  { v: '0.19.0', items: ['Tempi tarati per ogni oggetto su foto reali', 'Obiettivo della ripresa nel profilo', 'Catalogo completo nella ricerca; autoguida in Setup'] },
  { v: '0.18.0', items: ['Il dettaglio si apre dal target toccato e vi ritorna alla chiusura', 'Sezioni e notti: l’indicatore si sposta con continuità; la cupola ruota fino all’ora scelta', 'Fogli e dettaglio si chiudono trascinandoli verso il basso'] },
  { v: '0.17.0', items: ['Guida rifatta: nove passi, un solo spostamento per passo, i gesti mostrati sullo schermo'] },
  { v: '0.16.0', items: ['Tempi ritarati su 1205 foto reali da cieli Bortle 6–8', 'Foto di riferimento: per 93 target, integrazione, filtri e pose singole delle foto riprese da Bortle 6–8', '20 camere, 30 telescopi e 13 filtri aggiunti al catalogo; livello di qualità «profonda»'] },
  { v: '0.15.0', items: ['Testi riscritti in italiano e in inglese'] },
  { v: '0.14.0', items: ['Animazione del logo all’avvio', 'Animazioni: in Setup si può seguire l’impostazione del sistema o tenerle sempre attive'] },
  { v: '0.13.1', items: ['Android: il tasto indietro chiude fogli, dettaglio e guida invece di uscire', 'Android: gli avvisi ad app chiusa ora ricevono le notti da controllare'] },
  { v: '0.13.0', items: ['Guida passo per passo e novità a ogni aggiornamento', 'Previsioni meteo consultabili nell’app, senza collegamenti a siti esterni'] },
  { v: '0.12.1', items: ['Sessioni registrabili con un tocco dal piano della notte', 'Le ore riprese con la Luna contano per il segnale che raccolgono'] },
  { v: '0.11.0', items: ['Quattro tipi di avviso, attivabili in Setup; su Android funzionano anche ad app chiusa'] },
  { v: '0.10.0', items: ['Progetti: piano di stagione, calendario con chi riprendere ogni notte, le stagioni'] },
  { v: '0.9.0', items: ['«Quanto ci vuole»: ore, notti e data di fine per ogni modo di riprendere e ogni luogo', 'Calendario di sei settimane per ogni target'] },
  { v: '0.8.0', items: ['Sezione Cielo: sette modelli meteo, probabilità, seeing, trasparenza'] },
  { v: '0.7.0', items: ['Interfaccia divisa in sezioni, riepilogo delle prossime 14 notti, nuova icona'] },
];
const verNum = (v) => String(v || '0').split('.').reduce((a, x) => a * 1000 + (+x || 0), 0);
/* target: gli elementi da illuminare (null = nessuno, scheda al centro); ready: la scena è pronta e il faro può muoversi;
   rec: registro dei fotogrammi per le prove (faro e scheda, uno per fotogramma) */
const TOUR = { steps: [], i: 0, el: null, raf: 0, resume: null, target: null, ready: false, seq: 0, hole: null, card: null, rec: null, t0: 0 };
function tourOpenEditor(kind, section) {
  if (kind === 'loc') openLocEditor(state.locId); else openEditor(state.activeId);
  const el = F(section), st = TOUR.steps[TOUR.i];
  if (!el || !st) return;
  const note = document.createElement('div'); note.className = 'ed-tour-note';
  const title = document.createElement('b'), body = document.createElement('p');
  title.textContent = tx(st.t); body.textContent = tx(typeof st.d === 'function' ? st.d() : st.d);
  note.append(title, body); el.prepend(note);
  requestAnimationFrame(() => note.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

function tourStart(steps, i0 = 0) {
  steps = steps.filter((s) => !s.when || s.when()); if (!steps.length) return;
  if (TOUR.el) tourClose();
  const el = document.createElement('div'); el.className = 'tour veil'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="tour-hole" hidden></div><div class="tour-veil"></div><div class="tour-finger" hidden><i></i></div>
    <div class="tour-card"><div class="tour-top"><span class="tour-n"></span><button type="button" class="link" data-t="skip"></button></div><div class="tour-body"></div>
    <div class="tour-bar"><i></i></div><div class="tour-acts"></div></div>`;
  document.body.appendChild(el); TOUR.el = el; TOUR.steps = steps; TOUR.i = -1;
  TOUR.hole = Motion.follower(4, 'glide'); TOUR.card = Motion.follower(2, 'glide'); TOUR.last = 0;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const a = b.dataset.t;
    if (a === 'next') tourGo(TOUR.i + 1); else if (a === 'prev') tourGo(TOUR.i - 1); else if (a === 'skip') tourEnd();
    else if (a === 'cta') { const c = tourCta(TOUR.steps[TOUR.i]); TOUR.resume = { steps: TOUR.steps, i: TOUR.i + 1 }; tourClose(); if (c) c[1](); }
  });
  tourSwipe(el.querySelector('.tour-card'));
  document.addEventListener('keydown', tourKey, true);
  backPush(tourBack);
  UI.noVT = true; // durante la guida le sezioni cambiano all'istante, sotto il velo
  tourGo(i0);
  const loop = (t) => { if (!TOUR.el) return; tourFrame(t); TOUR.raf = requestAnimationFrame(loop); }; TOUR.raf = requestAnimationFrame(loop);
}
const tourCta = (st) => (st && st.cta ? (typeof st.cta === 'function' ? st.cta() : st.cta) : null);
function tourKey(e) {
  if (!TOUR.el) return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); tourEnd(); } else if (e.key === 'ArrowRight') tourGo(TOUR.i + 1); else if (e.key === 'ArrowLeft') tourGo(TOUR.i - 1);
}
/* sul telefono: scorrere la scheda di lato va avanti o indietro */
function tourSwipe(card) {
  let x0 = null, y0 = 0;
  card.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; });
  card.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) tourGo(TOUR.i + (dx < 0 ? 1 : -1)); });
}
function tourBack(fromPop) { if (fromPop === true) tourEnd(true); }
/* chiude senza segnare la guida come vista (per riprenderla dopo l'editor) */
function tourClose(silent) {
  if (!TOUR.el) return; cancelAnimationFrame(TOUR.raf); TOUR.el.remove(); TOUR.el = null; TOUR.target = null; TOUR.seq++; UI.noVT = false;
  document.removeEventListener('keydown', tourKey, true); if (!silent) backDone(tourBack);
}
function tourEnd(fromPop) {
  LS.set('sf.tourV', window.SKYFRAME_VERSION || '0'); TOUR.resume = null;
  if (fromPop === true) { if (TOUR.el) { cancelAnimationFrame(TOUR.raf); TOUR.el.remove(); TOUR.el = null; TOUR.seq++; UI.noVT = false; document.removeEventListener('keydown', tourKey, true); } } else tourClose();
  if (!$('#drawer').hidden) closeDetail();
  if (UI.view !== 'tonight') setView('tonight');
}
/* dopo l'editor aperto da un passo, la guida riparte dal successivo */
function tourAfterEditor() { const r = TOUR.resume; if (!r) return; TOUR.resume = null; setTimeout(() => tourStart(r.steps, r.i), 400); }
/* il target d'esempio del dettaglio: fra quelli visibili stanotte, prima uno dei tuoi, poi uno con le foto vere */
const tourSample = () => {
  const L = state.filtered.filter((r) => r.e.best && r.usableH >= 1), real = (r) => !!(window.REAL && REAL.o[r.o.id]);
  return (L.find((r) => inMyList(r.o.id) && real(r)) || L.find(real) || L.find((r) => inMyList(r.o.id)) || L[0] || state.res.results.find((r) => r.e.best) || {}).o;
};
const tourEls = (st) => (st.sel ? [].concat(st.sel).map((s) => $(s)).filter((t) => t && t.offsetParent) : []);
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* rettangolo che contiene tutti gli elementi del passo */
function unionRect(els) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const e of els) { const q = e.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}
/* la scena è pronta quando gli elementi restano fermi per tre fotogrammi (al massimo 900 ms: il dettaglio che entra) */
async function settle(els, seq) {
  let prev = null, same = 0; const t0 = performance.now();
  while (performance.now() - t0 < 900) {
    await frame(); if (seq !== TOUR.seq) return false;
    const r = unionRect(els), k = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    same = k === prev ? same + 1 : 0; prev = k; if (same >= 3) break;
  }
  return true;
}
/* zona libera per il faro: sotto la barra in alto (e la striscia delle notti, che resta ferma in cima a Stanotte), sopra
   la scheda ancorata e la barra delle sezioni del telefono */
function freeZone(els) {
  const H = innerHeight, card = TOUR.el && TOUR.el.querySelector('.tour-card'), tb = $('.topbar'), nb = $('#nightBar');
  let top = 8;
  if (els && els.length && !els.some((e) => e.closest('.topbar'))) {
    if (tb && tb.offsetParent) top = Math.max(top, tb.getBoundingClientRect().bottom + 6);
    if (nb && nb.offsetParent && !els.includes(nb) && !els[0].closest('#drawer') && els[0].closest('#v-tonight')) top = Math.max(top, nb.getBoundingClientRect().bottom + 6);
  }
  if (PHONE.matches) return { top, bottom: H - (card ? card.offsetHeight : 220) - navH() - 24 };
  return { top, bottom: H - 8 };
}
const navH = () => (PHONE.matches ? ($('#nav') || {}).offsetHeight || 60 : 0);
/* porta gli elementi nella zona libera scorrendo il contenitore giusto, subito (sotto il velo) */
function bringIntoZone(els, anchor) {
  if (!els.length) return;
  const z = freeZone(els), r = unionRect(els), sc = scrollParent(els[0]); if (!sc) return;
  const room = z.bottom - z.top;
  let d = 0;
  if (r.height > room) d = anchor === 'bottom' ? r.bottom - z.bottom : r.top - z.top; // più alto della zona: si vede la cima (o il fondo)
  else if (r.top < z.top || r.bottom > z.bottom) d = r.top - (z.top + (room - r.height) / 2);
  if (Math.abs(d) > 1) sc.scrollTo({ top: sc.scrollTop + d, behavior: 'instant' }); // mai lo scorrimento morbido: il faro insegue un bersaglio fermo
}
function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p; }
  return document.scrollingElement;
}
async function tourGo(i) {
  if (!TOUR.el) return; if (i >= TOUR.steps.length) { tourEnd(); return; } i = Math.max(0, i);
  const back = i < TOUR.i, seq = ++TOUR.seq; TOUR.i = i; TOUR.ready = false; // il faro resta fermo finché la scena nuova non è pronta
  const st = TOUR.steps[i], el = TOUR.el, card = el.querySelector('.tour-card'), body = card.querySelector('.tour-body');
  el.querySelector('.tour-finger').hidden = true;
  // 1. esce il testo; se la scena cambia (sezione o dettaglio) scende il velo
  const moveScene = !!(st.detail ? $('#drawer').hidden || state.dTab !== st.detail : st.view && (UI.view !== st.view || !$('#drawer').hidden));
  if (moveScene) el.classList.add('veil');
  if (TOUR.out) TOUR.out.cancel();
  TOUR.out = body.firstChild && Motion.on() ? Motion.animate(body, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${back ? 18 : -18}px)` }], 'snap', { duration: 110, fill: 'forwards' }) : null;
  if (TOUR.out) await TOUR.out.finished.catch(() => {});
  if (seq !== TOUR.seq) return;
  // 2. la scena: sezione, dettaglio del target d'esempio con la sua scheda
  if (st.detail) {
    const o = tourSample();
    if (o && (state.sel !== o.id || $('#drawer').hidden)) openDetail(o.id);
    setDTab(st.detail);
  } else if (!$('#drawer').hidden) closeDetail();
  if (st.view) setView(st.view);
  // il testo nuovo (serve la sua altezza per la zona libera)
  const n = TOUR.steps.length, last = i === n - 1, cta = tourCta(st);
  card.classList.toggle('hero', !!st.hero);
  card.querySelector('.tour-n').textContent = `${i + 1} / ${n}`;
  card.querySelector('[data-t=skip]').textContent = tx(last ? 'Chiudi' : 'Salta');
  body.innerHTML = `${st.hero ? `<div class="tour-hero"><canvas class="in-cv" aria-hidden="true"></canvas><div class="intro"><svg class="in-final" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-logo"/></svg></div></div>` : ''}<h3>${tx(st.t)}</h3><p>${tx(typeof st.d === 'function' ? st.d() : st.d)}</p>`;
  card.querySelector('.tour-acts').innerHTML = `${i > 0 ? `<button type="button" class="btn ghost" data-t="prev" aria-label="${tx('Indietro')}">${ic('chev-l')}</button>` : '<span></span>'}
    ${cta ? `<button type="button" class="btn" data-t="next">${tx('Avanti')}</button><button type="button" class="btn primary" data-t="cta">${tx(cta[0])}</button>` : `<button type="button" class="btn primary" data-t="next">${tx(last ? 'Fine' : i === 0 ? 'Inizia' : 'Avanti')}${last ? '' : ic('chev-r')}</button>`}`;
  card.querySelector('.tour-bar i').style.transform = `scaleX(${(i + 1) / n})`;
  // 3. si aspetta che la scena stia ferma, poi la si porta nella zona libera
  await frame(); if (seq !== TOUR.seq) return;
  let els = tourEls(st);
  if (st.sel && !els.length) { const t0 = performance.now(); while (!els.length && performance.now() - t0 < 1500) { await frame(); if (seq !== TOUR.seq) return; els = tourEls(st); } }
  if (els.length) { if (!(await settle(els, seq))) return; bringIntoZone(els, st.anchor); await frame(); if (seq !== TOUR.seq) return; }
  // 4. il faro parte (una volta), il velo si alza, entra il testo
  TOUR.target = els.length ? els : null; TOUR.ready = true; TOUR.t0 = performance.now();
  el.classList.remove('veil'); el.classList.toggle('dim', !els.length);
  card.classList.add('on');
  if (TOUR.out) { TOUR.out.cancel(); TOUR.out = null; }
  Motion.animate(body, [{ opacity: 0, transform: `translateX(${back ? -22 : 22}px)` }, { opacity: 1, transform: 'none' }], 'soft', { fill: 'backwards' });
  const f = card.querySelector('.btn.primary'); if (f) f.focus({ preventScroll: true });
  // l'intro del logo nel riquadro del benvenuto
  const hero = body.querySelector('.tour-hero'); if (hero && motionOn()) { hero.querySelector('.intro').classList.add('playing'); requestAnimationFrame(() => introPlay(hero.querySelector('.in-cv'), hero.querySelector('.intro'), 105)); }
  // 5. il gesto, quando il faro è arrivato
  if (st.hint && Motion.on()) { await wait(520); if (seq === TOUR.seq) tourHint(st.hint); }
}
/* il dito: tocca (tap), trascina (drag) o segnala (ping) un punto dentro l'elemento illuminato; due volte */
function tourHint([sel, kind]) {
  const t = $(sel), f = TOUR.el && TOUR.el.querySelector('.tour-finger'); if (!t || !f || !t.offsetParent) return;
  const r = t.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  f.hidden = false; f.className = 'tour-finger ' + kind; f.style.left = x + 'px'; f.style.top = y + 'px';
  const i = f.querySelector('i');
  const reps = 2, gap = 380;
  if (kind === 'tap') Motion.animate(i, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.25 }, { opacity: 1, transform: 'scale(.82)', offset: 0.45 }, { opacity: 1, transform: 'scale(1)', offset: 0.6 }, { opacity: 0, transform: 'scale(1)' }], 'snap', { duration: 1100 }).effect.updateTiming({ iterations: reps, endDelay: gap, easing: 'ease-in-out' });
  else if (kind === 'drag') { const w = Math.min(90, r.width * 0.3); Motion.animate(i, [{ opacity: 0, transform: `translateX(${-w}px) scale(1.3)` }, { opacity: 1, transform: `translateX(${-w}px) scale(.85)`, offset: 0.2 }, { opacity: 1, transform: `translateX(${w}px) scale(.85)`, offset: 0.75 }, { opacity: 0, transform: `translateX(${w}px) scale(1.2)` }], 'snap', { duration: 1500 }).effect.updateTiming({ iterations: reps, endDelay: gap, easing: 'ease-in-out' }); }
  else Motion.animate(i, [{ opacity: 0.9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.6)' }], 'snap', { duration: 1000 }).effect.updateTiming({ iterations: reps + 1, endDelay: 150, easing: 'ease-out' });
}
/* a ogni fotogramma: il faro insegue gli elementi con la molla, la scheda il suo ancoraggio */
function tourFrame(now) {
  const el = TOUR.el; if (!el) return;
  const dt = TOUR.last ? (now - TOUR.last) / 1000 : 1 / 60; TOUR.last = now;
  const hole = el.querySelector('.tour-hole'), card = el.querySelector('.tour-card'), W = innerWidth, H = innerHeight;
  const cw = card.offsetWidth, ch = card.offsetHeight;
  // il faro
  let hr = null;
  if (TOUR.ready && TOUR.target) {
    // il faro resta nella zona libera: mai sotto la scheda o sotto le barre ferme
    const r = unionRect(TOUR.target), z = freeZone(TOUR.target), pad = 8, x = Math.max(4, r.left - pad), y = Math.max(z.top - 4, r.top - pad);
    hr = [x, y, Math.max(0, Math.min(W - 4, r.right + pad) - x), Math.max(0, Math.min(z.bottom + 12, r.bottom + pad) - y)];
    if (hole.hidden) { TOUR.hole.set([x + hr[2] / 2, y + hr[3] / 2, 0, 0]); hole.hidden = false; }
    TOUR.hole.step(hr, dt);
    const [hx, hy, hw, hh] = TOUR.hole.x;
    hole.style.transform = `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px)`; hole.style.width = hw.toFixed(1) + 'px'; hole.style.height = hh.toFixed(1) + 'px';
    hole.style.borderRadius = Math.min(14, hh / 2, hw / 2).toFixed(1) + 'px';
  } else if (TOUR.ready) hole.hidden = true;
  // la scheda: al centro nei passi senza elemento; ancorata altrove
  let cx, cy;
  if (!TOUR.target || card.classList.contains('hero')) { cx = (W - cw) / 2; cy = (H - ch) / 2; }
  else if (PHONE.matches) { cx = 12; cy = H - navH() - ch - 12; }
  else {
    const r = unionRect(TOUR.target), right = r.left + r.width / 2 < W / 2 && r.width < W * 0.6;
    cx = right ? W - cw - 24 : ($('#nav') || {}).offsetWidth + 24 || 24; cy = H - ch - 24;
  }
  TOUR.card.step([cx, cy], dt);
  card.style.transform = `translate(${TOUR.card.x[0].toFixed(1)}px, ${TOUR.card.x[1].toFixed(1)}px)`;
  if (TOUR.rec) TOUR.rec.push([TOUR.ready ? now - TOUR.t0 : -1, TOUR.i, ...(TOUR.target ? Array.from(TOUR.hole.x, (v) => +v.toFixed(1)) : [0, 0, 0, 0]), +TOUR.card.x[0].toFixed(1), +TOUR.card.x[1].toFixed(1), hr ? hr.map((v) => +v.toFixed(1)) : null]);
}
/* al primo avvio: chi arriva nuovo fa il giro; chi aveva già Skyframe riceve la proposta; dopo un aggiornamento, le novità */
function tourBoot() {
  if (window.cielo && window.cielo.noTour) return;
  const seen = LS.get('sf.tourV', null), cur = window.SKYFRAME_VERSION || '0';
  const known = state.profiles.some((p) => !p.unsaved) || state.locs.some((l) => !l.unsaved);
  if (!seen) {
    if (!known) { setTimeout(() => tourStart(TOUR_STEPS), 700); return; }
    openSheet({
      title: tx('Skyframe è stato aggiornato'), body: `<p class="info-txt">${tx('Vuoi vedere la guida?')}</p>`,
      foot: `<button type="button" class="btn" data-later>${tx('Più tardi')}</button><button type="button" class="btn primary" data-go>${tx('Apri la guida')}</button>`,
      onMount: (el, close) => el.addEventListener('click', (e) => {
        if (e.target.closest('[data-go]')) { close(); setTimeout(() => tourStart(TOUR_STEPS), 300); }
        else if (e.target.closest('[data-later]')) { LS.set('sf.tourV', cur); close(); toast(tx('La guida si riapre da Setup')); }
      }),
    });
    return;
  }
  if (verNum(seen) >= verNum(cur)) return;
  const news = NEWS.filter((n) => verNum(n.v) > verNum(seen) && verNum(n.v) <= verNum(cur)); LS.set('sf.tourV', cur);
  if (news.length) openNews(news, TOUR_STEPS.filter((s) => verNum(s.v) > verNum(seen)));
}
function openNews(news, steps) {
  news = news || NEWS.slice(0, 4);
  openSheet({
    title: tx('Novità in Skyframe'),
    body: news.map((n) => `<div class="news"><b>${esc(n.v)}</b><ul>${n.items.map((x) => `<li>${tx(x)}</li>`).join('')}</ul></div>`).join(''),
    foot: steps && steps.length ? `<button type="button" class="btn" data-close2>${tx('Chiudi')}</button><button type="button" class="btn primary" data-go>${tx('Mostra')}</button>` : `<button type="button" class="btn primary" data-close2>${tx('Chiudi')}</button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-go]')) { close(); setTimeout(() => tourStart(steps), 300); } else if (e.target.closest('[data-close2]')) close();
    }),
  });
}
