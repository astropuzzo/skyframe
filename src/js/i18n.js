'use strict';
/* Lingue. L'italiano è la lingua del codice: le frasi si scrivono in italiano dentro t('…', { segnaposto }) e ogni altra
   lingua è un dizionario "frase italiana → traduzione" (src/i18n/<lingua>.js). Una frase che manca resta in italiano. */
const LANGS = { it: 'Italiano', en: 'English' };
const I18N = window.I18N || {};
const LANG = (() => {
  try { const v = JSON.parse(localStorage.getItem('sf.lang') || 'null'); if (LANGS[v]) return v; } catch (e) { /* storage non disponibile */ }
  const nav = String(navigator.language || '').slice(0, 2).toLowerCase();
  return LANGS[nav] ? nav : 'en';
})();
const LOCALE = { it: 'it-IT', en: 'en-GB' }[LANG] || 'en-GB';
document.documentElement.lang = LANG;
function tx(s, p) {
  const d = I18N[LANG];
  let r = (d && d[s]) || s;
  if (p) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m));
  return r;
}
/* Testi fissi della pagina: nodi di solo testo e attributi (placeholder, title, aria-label) si traducono per frase intera;
   gli elementi con data-t si traducono come HTML (per le frasi con link o corsivi dentro). */
function translateDom(root) {
  if (LANG === 'it') return;
  const d = I18N[LANG] || {}, norm = (x) => x.replace(/\s+/g, ' ').trim();
  root.querySelectorAll('[data-t]').forEach((el) => { const k = norm(el.innerHTML); if (d[k]) el.innerHTML = d[k]; });
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentElement && n.parentElement.closest('[data-t], script, style')) continue;
    const k = norm(n.nodeValue); if (!k || !d[k]) continue;
    const lead = n.nodeValue.match(/^\s*/)[0], tail = n.nodeValue.match(/\s*$/)[0];
    n.nodeValue = lead + d[k] + tail;
  }
  root.querySelectorAll('[placeholder], [title], [aria-label]').forEach((el) => ['placeholder', 'title', 'aria-label'].forEach((a) => { const v = el.getAttribute(a); if (v && d[norm(v)]) el.setAttribute(a, d[norm(v)]); }));
}
/* nomi di catalogo (ottiche, accessori): si traducono le parole, non la frase intera. I nomi scritti dall'utente restano. */
function txName(n) {
  const T = LANG !== 'it' && I18N[LANG] && I18N[LANG].__terms;
  return T ? T.reduce((s, [re, r]) => s.replace(re, r), String(n)) : n;
}
function setLang(l) { try { localStorage.setItem('sf.lang', JSON.stringify(l)); } catch (e) { /* ignora */ } location.reload(); }
translateDom(document.body); // gli script stanno in fondo al body: la pagina è già tutta lì
