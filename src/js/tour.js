'use strict';
/* ============================ guida ============================
   Un giro passo passo delle funzioni: una scheda con due righe di testo e, sotto, l'elemento dell'app illuminato (il
   resto si scurisce). Parte da sola al primo avvio; chi aveva già Skyframe riceve la proposta del giro; a ogni
   aggiornamento con funzioni nuove, le «Novità» e un giro solo dei passi nuovi. Si riprende da Setup → Guida.
   Ogni passo dice in quale sezione sta, cosa illuminare e, se serve, apre il dettaglio di un target d'esempio.
   v = versione in cui il passo è comparso: il giro delle novità mostra quelli più nuovi dell'ultima versione vista. */
const TOUR_STEPS = [
  { v: '0.13.0', hero: true, t: 'Benvenuto in Skyframe', d: 'Ti dice cosa riprendere stanotte dal tuo luogo e con la tua attrezzatura, quante ore servono e in quali notti. Un giro di due minuti: puoi saltarlo e riprenderlo da Setup.' },
  { v: '0.13.0', view: 'tonight', sel: '#locChip', t: 'Il tuo luogo', d: 'Tutto parte da qui: cielo, orizzonte e meteo del punto da cui riprendi. Puoi salvarne più d’uno (terrazzo, sito buio) e Skyframe li confronta.', cta: ['Imposta il mio luogo', () => openLocEditor(state.locId)], when: () => activeLoc().site.example },
  { v: '0.13.0', view: 'tonight', sel: '#profChip', t: 'La tua attrezzatura', d: 'Camera, telescopi con correttori e riduttori, e i filtri che hai davvero: le ore si calcolano su questi.', cta: ['Imposta l’attrezzatura', () => openEditor(state.activeId)], when: () => activeProfile().unsaved },
  { v: '0.13.0', view: 'tonight', sel: '#nightBar', t: 'Le prossime notti', d: 'Per ognuna la Luna, il meteo previsto e un voto. Tocca una notte per vederla; «Altre» apre il calendario con le fasi.' },
  { v: '0.13.0', view: 'tonight', sel: '#facts', t: 'La notte in breve', d: 'Il voto, cosa conviene fare e i dati che contano: buio, Luna, meteo, cielo. Tocca il meteo per vederlo ora per ora.' },
  { v: '0.13.0', view: 'tonight', sel: '.skycard', t: 'Il cielo dal tuo luogo', d: 'I target migliori sulla cupola, col tuo orizzonte. Trascina la striscia sotto per cambiare ora, o scorri tutta la notte.' },
  { v: '0.13.0', view: 'tonight', sel: '#tonight', t: 'Il piano della notte', d: 'I tuoi target in fila nelle ore buie e serene, ognuno quando è più alto. Puoi togliere un target, e a notte iniziata registrare la sessione con un tocco.' },
  { v: '0.13.0', view: 'targets', sel: '.bar', t: 'Tutti i target', d: 'Oltre duemila oggetti: cerca, ordina e filtra per tipo, catalogo, ore, inquadratura. La stella accanto al nome li mette nei tuoi preferiti.' },
  { v: '0.13.0', detail: 'piano', sel: '#scen', t: 'Quanto ci vuole', d: 'Le ore di posa col cielo senza Luna e, per ogni modo di riprendere e per ogni tuo luogo, quante ore, quante notti e quando finisci. Il modo che scegli vale in tutta l’app.' },
  { v: '0.13.0', detail: 'quando', sel: '.tcal', t: 'Le notti del target', d: 'Sei settimane: quali notti usare, quanto lavoro fa ognuna e quando finisci. Tocca una notte per aprirla.' },
  { v: '0.13.0', detail: 'piano', sel: '#proj', t: 'Il tuo progetto', d: 'Mettilo tra i preferiti e registra le notti che fai: Skyframe tiene il conto e ricalcola quanto manca.' },
  { v: '0.13.0', view: 'sky', sel: '#skyView .sk-nights', t: 'Il meteo astronomico', d: 'Nuvole da sette modelli insieme, probabilità di sereno, seeing, trasparenza, condensa e vento. Sotto: la notte ora per ora e i modelli a confronto.' },
  { v: '0.13.0', view: 'projects', sel: '#projView', t: 'I tuoi progetti', d: 'Il piano di stagione divide le prossime notti fra tutti i tuoi preferiti; il calendario mostra chi riprendere ogni notte; le stagioni dicono quando rende ognuno.' },
  { v: '0.13.0', view: 'setup', sel: '#stAlerts', t: 'Avvisi', d: 'Stasera si scatta, notte ottima in arrivo, il meteo è cambiato, fine stagione: scegli quali ricevere e con quanto anticipo.' },
  { v: '0.13.0', view: 'setup', sel: '#stGuide', hero: true, t: 'Buone notti serene', d: 'Questa guida e le novità di ogni versione le ritrovi qui, in Setup.' },
];
/* novità per versione (le più recenti in cima) */
const NEWS = [
  { v: '0.13.0', items: ['Questa guida passo passo, e le novità a ogni aggiornamento', 'Niente più collegamenti a siti meteo esterni: tutto dentro l’app'] },
  { v: '0.12.1', items: ['Registri la sessione con un tocco dal piano della notte', 'Le ore fatte con la Luna piena valgono per quello che rendono'] },
  { v: '0.11.0', items: ['Quattro avvisi da scegliere in Setup, anche ad app chiusa su Android'] },
  { v: '0.10.0', items: ['Progetti: piano di stagione, calendario con chi riprendere ogni notte, le stagioni'] },
  { v: '0.9.0', items: ['«Quanto ci vuole»: ore, notti e data di fine per ogni modo di riprendere e ogni luogo', 'Calendario di sei settimane per ogni target'] },
  { v: '0.8.0', items: ['Sezione Cielo: sette modelli meteo, probabilità, seeing, trasparenza'] },
  { v: '0.7.0', items: ['Interfaccia nuova a sezioni, le prossime 14 notti, icona nuova'] },
];
const verNum = (v) => String(v || '0').split('.').reduce((a, x) => a * 1000 + (+x || 0), 0);
const TOUR = { steps: [], i: 0, el: null, raf: 0, resume: null, target: null };

function tourStart(steps, i0 = 0) {
  steps = steps.filter((s) => !s.when || s.when()); if (!steps.length) return;
  if (TOUR.el) tourClose();
  const el = document.createElement('div'); el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="tour-hole" hidden></div><div class="tour-card"></div>`;
  document.body.appendChild(el); TOUR.el = el; TOUR.steps = steps;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const a = b.dataset.t;
    if (a === 'next') tourGo(TOUR.i + 1); else if (a === 'prev') tourGo(TOUR.i - 1); else if (a === 'skip') tourEnd();
    else if (a === 'cta') { const st = TOUR.steps[TOUR.i]; TOUR.resume = { steps: TOUR.steps, i: TOUR.i + 1 }; tourClose(); st.cta[1](); }
  });
  document.addEventListener('keydown', tourKey, true);
  backPush(tourBack);
  tourGo(i0);
  const loop = () => { if (!TOUR.el) return; tourPlace(); TOUR.raf = requestAnimationFrame(loop); }; TOUR.raf = requestAnimationFrame(loop);
}
function tourKey(e) {
  if (!TOUR.el) return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); tourEnd(); } else if (e.key === 'ArrowRight') tourGo(TOUR.i + 1); else if (e.key === 'ArrowLeft') tourGo(TOUR.i - 1);
}
function tourBack(fromPop) { if (fromPop === true) tourEnd(true); }
/* chiude senza segnare la guida come vista (per riprenderla dopo l'editor) */
function tourClose(silent) {
  if (!TOUR.el) return; cancelAnimationFrame(TOUR.raf); TOUR.el.remove(); TOUR.el = null; TOUR.target = null;
  document.removeEventListener('keydown', tourKey, true); if (!silent) backDone(tourBack);
}
function tourEnd(fromPop) {
  LS.set('sf.tourV', window.SKYFRAME_VERSION || '0'); TOUR.resume = null;
  if (fromPop === true) { if (TOUR.el) { cancelAnimationFrame(TOUR.raf); TOUR.el.remove(); TOUR.el = null; document.removeEventListener('keydown', tourKey, true); } } else tourClose();
  if (!$('#drawer').hidden) closeDetail();
  if (UI.view !== 'tonight') setView('tonight');
}
/* dopo l'editor aperto da un passo, la guida riparte dal successivo */
function tourAfterEditor() { const r = TOUR.resume; if (!r) return; TOUR.resume = null; setTimeout(() => tourStart(r.steps, r.i), 400); }
const tourSample = () => { const L = state.filtered.filter((r) => r.e.best && r.usableH >= 1); return (L.find((r) => inMyList(r.o.id)) || L[0] || state.res.results.find((r) => r.e.best) || {}).o; };
async function tourGo(i) {
  if (!TOUR.el) return; if (i >= TOUR.steps.length) { tourEnd(); return; } i = Math.max(0, i); TOUR.i = i;
  const st = TOUR.steps[i], card = TOUR.el.querySelector('.tour-card');
  // prepara la scena: sezione, dettaglio aperto o chiuso
  if (st.detail) {
    const o = tourSample();
    if (o && (state.sel !== o.id || $('#drawer').hidden)) openDetail(o.id);
    setDTab(st.detail);
  } else if (!$('#drawer').hidden) closeDetail();
  if (st.view) setView(st.view);
  TOUR.target = null; card.classList.remove('on');
  await new Promise((r) => setTimeout(r, st.detail || st.view ? 380 : 60));
  const t = st.sel ? $(st.sel) : null;
  if (t && t.offsetParent) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); TOUR.target = t; }
  const n = TOUR.steps.length, last = i === n - 1;
  card.innerHTML = `<div class="tour-top"><span class="tour-n">${i + 1} / ${n}</span><button type="button" class="link" data-t="skip">${tx(last ? 'Chiudi' : 'Salta la guida')}</button></div>
    ${st.hero ? `<div class="tour-hero"><span class="tw" style="--x:12%;--y:22%;--d:.1s"></span><span class="tw" style="--x:84%;--y:18%;--d:.7s"></span><span class="tw" style="--x:70%;--y:52%;--d:1.2s"></span><span class="tw" style="--x:24%;--y:60%;--d:.4s"></span><span class="tw" style="--x:52%;--y:12%;--d:1.6s"></span>${LOGO_ANIM}<svg class="th-hz" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 28 C 90 6, 210 6, 300 28"/></svg></div>` : ''}
    <h3>${tx(st.t)}</h3><p>${tx(st.d)}</p>
    <div class="tour-dots">${TOUR.steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('')}</div>
    <div class="tour-acts${st.cta ? ' cta' : ''}">${i > 0 ? `<button type="button" class="btn ghost" data-t="prev" aria-label="${tx('Indietro')}">${ic('chev-l')}<span>${tx('Indietro')}</span></button>` : '<span></span>'}
      ${st.cta ? `<button type="button" class="btn" data-t="next">${tx('Dopo')}</button><button type="button" class="btn primary" data-t="cta">${tx(st.cta[0])}</button>` : `<button type="button" class="btn primary" data-t="next">${tx(last ? 'Fine' : i === 0 ? 'Iniziamo' : 'Avanti')}${last ? '' : ic('chev-r')}</button>`}</div>`;
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  requestAnimationFrame(() => { tourPlace(); card.classList.add('on'); const f = card.querySelector('.btn.primary'); if (f) f.focus({ preventScroll: true }); });
}
/* il riquadro illuminato segue l'elemento; la scheda gli sta accanto (sul telefono in basso, o in alto se l'elemento è giù) */
function tourPlace() {
  const el = TOUR.el; if (!el) return;
  const hole = el.querySelector('.tour-hole'), card = el.querySelector('.tour-card'), t = TOUR.target, W = innerWidth, H = innerHeight;
  if (!t || !t.offsetParent) { hole.hidden = true; el.classList.add('dim'); card.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }
  el.classList.remove('dim'); hole.hidden = false;
  const r = t.getBoundingClientRect(), pad = 8, x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - 8, r.right + pad) - x, h = Math.min(H - 8, r.bottom + pad) - y;
  Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
  const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
  if (PHONE.matches) {
    const tabH = ($('#nav') || {}).offsetHeight || 60, bottomTop = H - tabH - ch - 12, low = y + h > bottomTop - 8 && y > ch + 80;
    card.style.cssText = low ? `left:12px;right:12px;top:${Math.max(12, Math.min(y - ch - gap, 70))}px` : `left:12px;right:12px;top:${bottomTop}px`;
    return;
  }
  let left, top;
  if (x + w + gap + cw < W - 12) { left = x + w + gap; top = clamp(y, 12, H - ch - 12); }
  else if (x - gap - cw > 12) { left = x - gap - cw; top = clamp(y, 12, H - ch - 12); }
  else if (y + h + gap + ch < H - 12) { left = clamp(x, 12, W - cw - 12); top = y + h + gap; }
  else if (y - gap - ch > 12) { left = clamp(x, 12, W - cw - 12); top = y - gap - ch; }
  else { left = (W - cw) / 2; top = H - ch - 24; }
  card.style.cssText = `left:${left}px;top:${top}px`;
}
/* al primo avvio: chi arriva nuovo fa il giro; chi aveva già Skyframe riceve la proposta; dopo un aggiornamento, le novità */
function tourBoot() {
  if (window.cielo && window.cielo.noTour) return;
  const seen = LS.get('sf.tourV', null), cur = window.SKYFRAME_VERSION || '0';
  const known = state.profiles.some((p) => !p.unsaved) || state.locs.some((l) => !l.unsaved);
  if (!seen) {
    if (!known) { setTimeout(() => tourStart(TOUR_STEPS), 700); return; }
    openSheet({
      title: tx('Skyframe è cambiato'), body: `<p class="info-txt">${tx('Sezioni nuove, meteo astronomico, tempi per ogni modo di riprendere, progetti con piano di stagione e avvisi. Ti faccio fare un giro di due minuti?')}</p>`,
      foot: `<button type="button" class="btn" data-later>${tx('Più tardi')}</button><button type="button" class="btn primary" data-go>${tx('Fai il giro')}</button>`,
      onMount: (el, close) => el.addEventListener('click', (e) => {
        if (e.target.closest('[data-go]')) { close(); setTimeout(() => tourStart(TOUR_STEPS), 300); }
        else if (e.target.closest('[data-later]')) { LS.set('sf.tourV', cur); close(); toast(tx('La guida è in Setup, quando vuoi')); }
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
    foot: steps && steps.length ? `<button type="button" class="btn" data-close2>${tx('Chiudi')}</button><button type="button" class="btn primary" data-go>${tx('Mostramele')}</button>` : `<button type="button" class="btn primary" data-close2>${tx('Chiudi')}</button>`,
    onMount: (el, close) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-go]')) { close(); setTimeout(() => tourStart(steps), 300); } else if (e.target.closest('[data-close2]')) close();
    }),
  });
}
