// Pilota Skyframe su un emulatore Android (DevTools della WebView dell'APK di debug) e ne fa le schermate.
// Lanciato da scripts/android-e2e.sh; tutto finisce in e2e/ (schermate, risultati.json).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PKG = 'io.github.astropuzzo.skyframe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (a) => execSync(`adb ${a}`, { encoding: 'utf8', maxBuffer: 64e6 });
const out = { checks: {}, notes: [] };
const T0 = Date.now(), log = (m) => { const l = `[${Math.round((Date.now() - T0) / 1000)} s] ${m}`; console.log(l); out.notes.push(l); try { fs.writeFileSync('e2e/risultati.json', JSON.stringify(out, null, 2)); } catch { /* niente */ } };
// limite generale: dopo 20 minuti si scrive quello che c'è e si esce
setTimeout(() => { log('limite di tempo raggiunto'); process.exit(3); }, 20 * 60000);
const shot = (name, shade) => { if (!shade) try { execSync('adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS', { stdio: 'ignore' }); } catch { /* niente */ } try { fs.writeFileSync(`e2e/${name}.png`, execSync('adb exec-out screencap -p', { maxBuffer: 64e6 })); } catch (e) { out.notes.push(`schermata ${name}: ${e.message}`); } };
const notifs = () => { try { return adb('shell dumpsys notification --noredact'); } catch { return ''; } };

async function devtools() {
  for (let i = 0; i < 60; i++) {
    const pid = (() => { try { return adb(`shell pidof ${PKG}`).trim().split(/\s+/)[0]; } catch { return ''; } })();
    const socks = adb('shell cat /proc/net/unix').match(/@webview_devtools_remote_\d+/g) || [];
    const m = socks.find((x) => pid && x.endsWith('_' + pid)) || socks[0];
    if (m) { try { execSync('adb forward --remove-all', { stdio: 'ignore' }); } catch { /* niente */ } adb(`forward tcp:9222 localabstract:${m.slice(1)}`); break; }
    await sleep(2000);
  }
  for (let i = 0; i < 30; i++) {
    try { const j = await (await fetch('http://127.0.0.1:9222/json')).json(); const p = j.find((x) => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* non ancora */ }
    await sleep(1000);
  }
  throw new Error('DevTools della WebView non raggiungibili');
}
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.cb = new Map(); this.open = false;
    this.ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.cb.has(d.id)) { this.cb.get(d.id)(d); this.cb.delete(d.id); } };
    this.ws.onclose = () => { this.open = false; for (const f of this.cb.values()) f({ closed: true }); this.cb.clear(); };
    this.ready = new Promise((r, j) => { this.ws.onopen = () => { this.open = true; r(); }; this.ws.onerror = (e) => j(new Error('WebSocket: ' + (e && e.message || 'errore'))); setTimeout(() => j(new Error('WebSocket: nessuna risposta')), 10000); });
  }
  send(method, params = {}, ms = 25000) {
    if (!this.open) return Promise.resolve({ closed: true });
    const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => { this.cb.set(id, r); setTimeout(() => { if (this.cb.has(id)) { this.cb.delete(id); r({ timeout: true }); } }, ms); });
  }
  async eval(body, ms) {
    const r = await this.send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }, ms);
    if (r.closed || r.timeout) throw new Error(r.closed ? 'collegamento chiuso' : 'tempo scaduto');
    const x = r.result || {}; if (x.exceptionDetails) throw new Error(JSON.stringify(x.exceptionDetails).slice(0, 400)); return x.result && x.result.value;
  }
}
/* se l'app viene chiusa (l'emulatore aggiorna i servizi Google al primo avvio), la si riapre e ci si ricollega */
let cdp;
async function reconnect() {
  let alive = ''; try { alive = adb(`shell pidof ${PKG}`).trim(); } catch { /* niente */ }
  if (!alive) { out.notes.push('app chiusa dal sistema: la riapro'); adb(`shell am start -n ${PKG}/.MainActivity`); await sleep(15000); }
  if (cdp && cdp.ws) try { cdp.ws.close(); } catch { /* niente */ }
  const url = await devtools(); log('DevTools: ' + url);
  cdp = new CDP(url); await cdp.ready; log('collegato alla WebView');
}
async function ev(body, ms) {
  for (let k = 0; k < 3; k++) { try { return await cdp.eval(body, ms); } catch (e) { out.notes.push(`comando ripetuto (${e.message})`); await reconnect(); } }
  throw new Error('comando non riuscito: ' + body.slice(0, 80));
}
const until = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(`return !!(${cond})`, 10000)) return true; } catch { /* riprova */ } await sleep(800); } return false; };
const keep = setInterval(() => {}, 1000); // il processo resta vivo mentre si aspetta la WebView

try {
  await reconnect();
  log('attendo avvio'); out.checks.avvio = await until('typeof state !== "undefined" && state.res && state.filtered && state.filtered.length && document.querySelector("#v-tonight")', 90000); // la lista dei target si disegna quando si apre la sezione
  shot('01-avvio');
  // guida al primo avvio: parte da sola
  out.checks.guida_parte = await until('typeof TOUR !== "undefined" && TOUR.el', 8000);
  await sleep(1500); shot('02-guida-benvenuto');
  // italiano (l'emulatore è in inglese), poi di nuovo la guida da capo
  await ev(`localStorage.setItem('sf.lang', JSON.stringify('it')); location.reload(); return 1`).catch(() => {});
  await sleep(4000); await until('typeof state !== "undefined" && state.res && document.querySelector("#list .row")', 90000);
  // la guida ripartita da sola al riavvio viene sostituita da quella avviata qui (una sopra l'altra: non deve sparire)
  await until('TOUR.el', 8000);
  await ev(`tourStart(TOUR_STEPS, 0); return 1`); await sleep(2200); shot('03-guida-it');
  const setupBefore = await ev(`return JSON.stringify([state.locs, state.profiles])`);
  const seen = [await ev(`return !!TOUR.el && TOUR.i === 0`)];
  const visual = ['luogo', 'mappa', 'sqm', 'allsky', 'orizzonte', 'setup-profili', 'attrezzatura', 'ottica', 'filtri', 'sessione'];
  out.tourGeometry = [];
  const names = await ev(`return TOUR.steps.map((s) => s.id)`);
  for (const name of names.slice(1)) {
    const k = await ev(`return TOUR.steps.findIndex((s) => s.id === '${name}')`); if (k < 0) continue;
    // ogni passo prepara la schermata sotto il faro, senza aprire un editor modificabile
    await ev(`tourGo(Math.min(${k}, TOUR.steps.length - 1)); return 1`);
    await until(`TOUR.el && TOUR.ready && (TOUR.el.querySelector('.tour-card.on .tour-n') || {}).textContent === (TOUR.i + 1) + ' / ' + TOUR.steps.length`, 20000);
    await sleep(1100); shot(`04-guida-${String(k).padStart(2, '0')}-${name}`);
    const g = await ev(`const st = TOUR.steps[TOUR.i], els = tourEls(st), z = freeZone(els), r = els.length ? unionRect(els) : null;
      const room = z.bottom - z.top, overlap = r ? Math.max(0, Math.min(r.bottom, z.bottom) - Math.max(r.top, z.top)) : 0;
      const pad = 8, x = r ? Math.max(4, r.left - pad) : 0, y = r ? Math.max(z.top - 4, r.top - pad) : 0;
      const box = r ? [x, y, Math.max(0, Math.min(innerWidth - 4, r.right + pad) - x), Math.max(0, Math.min(z.bottom + 12, r.bottom + pad) - y)] : [];
      return { id: st.id, view: UI.view, expectedView: st.view || 'targets', target: !!r,
        top: r && Math.round(r.top), bottom: r && Math.round(r.bottom), zone: [Math.round(z.top), Math.round(z.bottom)],
        overlap: Math.round(overlap), visible: !!r && (r.height > room ? overlap >= Math.min(40, room * 0.3) : r.top >= z.top - 5 && r.bottom <= z.bottom + 5),
        holeAligned: !!r && !TOUR.el.querySelector('.tour-hole').hidden && box.every((n, j) => Math.abs(n - TOUR.hole.x[j]) < 12),
        textVisible: !!TOUR.el.querySelector('.tour-card h3')?.textContent && +getComputedStyle(TOUR.el.querySelector('.tour-body')).opacity > 0.95,
        tab: document.querySelector('#nav [data-view="' + UI.view + '"]')?.getAttribute('aria-current'),
        drawer: !document.getElementById('drawer').hidden };`);
    out.tourGeometry.push(g);
    seen.push(g.target && g.visible && g.holeAligned && g.textVisible && g.tab === 'page' && g.view === g.expectedView && (['preferito', 'quanto', 'registra', 'fotovere', 'quando', 'campo'].includes(name) === g.drawer));
  }
  out.checks.guida_passi = seen.every(Boolean);
  out.checks.guida_sessione_visibile = out.tourGeometry.find((g) => g.id === 'sessione')?.visible === true;
  out.checks.guida_tutte_schede = ['setup', 'tonight', 'targets', 'sky', 'projects'].every((v) => out.tourGeometry.some((g) => g.view === v && g.visible));
  // Avanti e Indietro attraversano i campi visibili mantenendo la guida; l'editor è inerte e non salva dati.
  const kl = await ev(`return TOUR.steps.findIndex((s) => s.id === 'luogo')`);
  await ev(`tourGo(${kl}); return 1`);
  await until(`TOUR.el && TOUR.ready && TOUR.i === ${kl} && document.getElementById('editor').dataset.preview === 'loc'`, 20000);
  const continuity = [];
  for (const name of visual) {
    const k = await ev(`return TOUR.steps.findIndex((s) => s.id === '${name}')`);
    await until(`TOUR.el && TOUR.ready && TOUR.i === ${k} && (TOUR.el.querySelector('.tour-n') || {}).textContent === '${k + 1} / ' + TOUR.steps.length`, 20000);
    continuity.push(await ev(`return !!TOUR.el && !edDirty && !document.querySelector('.tour [data-t=cta]') && ${name === 'setup-profili' ? "document.getElementById('editor').hidden" : `document.getElementById('editor').inert && document.getElementById('editor').dataset.preview === '${['attrezzatura', 'ottica', 'filtri', 'sessione'].includes(name) ? 'prof' : 'loc'}'`}`));
    if (name === 'luogo') {
      // un evento touch nella WebView deve avanzare; i .click() JS non rilevano i problemi del tocco
      await sleep(600);
      const p = await ev(`const r = document.querySelector('.tour [data-t=next]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      out.checks.guida_touch = await until(`TOUR.el && TOUR.ready && TOUR.steps[TOUR.i].id === 'mappa'`, 12000);
    } else await ev(`document.querySelector('.tour [data-t=next]').click(); return 1`);
  }
  out.checks.guida_visiva_continua = continuity.every(Boolean) && await until(`TOUR.el && TOUR.ready && TOUR.steps[TOUR.i].id === 'notti' && document.getElementById('editor').hidden`, 20000);
  await ev(`tourGo(TOUR.steps.findIndex((s) => s.id === 'sqm')); return 1`);
  await until(`TOUR.el && TOUR.steps[TOUR.i].id === 'sqm'`, 20000);
  await ev(`document.querySelector('.tour [data-t=prev]').click(); return 1`);
  out.checks.guida_indietro = await until(`TOUR.el && TOUR.steps[TOUR.i].id === 'mappa' && document.getElementById('editor').dataset.preview === 'loc'`, 20000);
  const ka = await ev(`return TOUR.steps.findIndex((s) => s.id === 'allsky')`);
  if (ka >= 0) {
    await ev(`tourGo(${ka}); return 1`); await until(`TOUR.el && TOUR.i === ${ka} && !!document.querySelector('.tour-card.on h3')`, 20000);
    out.allskyAndroid = await ev(`return {
      guida: !!TOUR.el && document.getElementById('editor').inert && document.getElementById('editor').dataset.preview === 'loc',
      mappaManuale: document.getElementById('lpmBtn').hidden && !!document.getElementById('skyFile') && !!document.getElementById('lpmOpen').href,
      ricercaLuoghi: !document.getElementById('geoQ').disabled,
      atlante: !document.getElementById('lpBtn').hidden
    }`);
    out.checks.android_allsky_manuale = Object.values(out.allskyAndroid).every(Boolean);
    shot('04-guida-allsky-android');
  }
  adb('shell input keyevent KEYCODE_BACK'); await sleep(2000);
  out.checks.guida_esce_con_indietro = await ev(`return !TOUR.el && document.getElementById('editor').hidden && document.getElementById('leaveConfirm').hidden`);
  await ev(`tourStart(TOUR_STEPS, ${kl}); return 1`);
  await until(`TOUR.el && TOUR.ready && TOUR.i === ${kl} && document.getElementById('editor').dataset.preview === 'loc'`, 20000);
  await sleep(600);
  const skip = await ev(`const r = document.querySelector('.tour [data-t=skip]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [skip] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  out.checks.guida_esce_con_salta = await until(`!TOUR.el && document.getElementById('editor').hidden && document.getElementById('leaveConfirm').hidden`, 12000);
  out.checks.guida_senza_modifiche = setupBefore === await ev(`return JSON.stringify([state.locs, state.profiles])`);
  await sleep(1200);
  // meteo, preferiti, sezioni
  out.checks.meteo = await until('wxOk()', 60000);
  await ev(`for (const id of ['NGC 7000','IC 1396','NGC 281','IC 1805','NGC 6960']) if (state.byId.has(id) && !isFav(id)) toggleFav(id); return 1`);
  log('sezioni'); const views = [['tonight', 'stanotte'], ['targets', 'target'], ['sky', 'cielo'], ['projects', 'progetti'], ['setup', 'setup']];
  for (const [v, name] of views) { await ev(`setView('${v}'); return 1`); await sleep(v === 'projects' ? 4500 : 2500); shot(`05-${name}`); if (v === 'targets') out.checks.lista_target = await until('document.querySelector("#list .row")', 10000); }
  await ev(`setView('tonight'); document.getElementById('v-tonight').scrollTop = 900; return 1`); await sleep(1200); shot('05-stanotte-giu');
  // dettaglio di un target: tempi e calendario
  await ev(`const id = state.byId.has('NGC 7000') ? 'NGC 7000' : state.filtered[0].o.id; openDetail(id); setDTab('piano'); return 1`); await sleep(2500);
  await ev(`const d = document.getElementById('drawer'); d.scrollTop = document.getElementById('scen').offsetTop - 120; return 1`); await sleep(1500); shot('06-dettaglio-tempi');
  await ev(`setDTab('quando'); return 1`); await sleep(2000); shot('07-dettaglio-quando');
  // tasto indietro di Android: chiude il dettaglio
  adb('shell input keyevent KEYCODE_BACK'); await sleep(1500);
  out.checks.indietro_chiude_dettaglio = await ev(`return document.getElementById('drawer').hidden`);
  await ev(`setView('targets'); return 1`); await sleep(800); adb('shell input keyevent KEYCODE_BACK'); await sleep(1500);
  out.checks.indietro_torna_a_stanotte = await ev(`return UI.view === 'tonight'`);
  shot('08-dopo-indietro');

  log('file'); // esportazione (Documenti/Skyframe + condivisione) e copia automatica dei dati
  const docs = () => { try { return adb('shell ls /sdcard/Documents/Skyframe'); } catch { return ''; } };
  await ev(`window.__sf = window.cielo.saveFile('e2e-nina.csv', 'Pane,RA,DEC\\r\\nNGC 7000,20 59 17.14,+44 31 43.6\\r\\n'); return 1`); await sleep(4000);
  shot('10-condivisione');
  adb('shell input keyevent KEYCODE_BACK'); await sleep(1500);
  out.salvataggio = await ev(`return await window.__sf`, 15000).catch((e) => 'errore: ' + e.message);
  out.checks.file_in_documenti = out.salvataggio === 'Documenti/Skyframe/e2e-nina.csv' && /e2e-nina\.csv/.test(docs());
  await ev(`backupSoon({ ...storeData(), locations: [{ id: 'e2e' }] }); return 1`);
  out.checks.copia_automatica = await until(`(LS.get('sf.bak', null) || {}).where === 'Documenti/Skyframe/skyframe-backup.json'`, 15000) && /skyframe-backup\.json/.test(docs());
  await ev(`setView('setup'); return 1`); await sleep(1200); await ev(`document.querySelector('[data-export]').scrollIntoView({ block: 'center' }); return 1`); await sleep(800); shot('11-setup-dati');

  out.errori_console = await ev(`return (window.__errs || []).slice(0, 10)`).catch(() => null);

  log('avvisi'); // il motore nativo: prova di Setup, poi una notte finta con una previsione finta (build di debug)
  const AL = 'Capacitor.Plugins.SkyframeAlerts';
  const logcat = (re) => { try { return adb('logcat -d -s SkyframeAlerts:D').split('\n').filter((l) => re.test(l)); } catch { return []; } };
  const notified = async (re, ms) => { for (let t = 0; t < ms; t += 2000) { if (re.test(notifs())) return true; await sleep(2000); } return re.test(notifs()); };
  out.checks.avvisi_plugin = await ev(`return !!(window.cielo.alerts && ${AL})`);
  await ev(`LS.set('sf.notify', true); await planNotifications(); return 1`);
  out.checks.avvisi_ricetta = await until(`RCP.sent && RCP.map.size >= 20`, 60000);
  out.ricetta = await ev(`const c = JSON.parse(RCP.sent); return { notti: c.nights.length, conPiano: c.nights.filter((n) => n.blocks && n.blocks.length).length, primo: c.nights[0] && { ds: c.nights[0].ds, blocchi: (c.nights[0].blocks || []).length, luna: c.nights[0].moon.length }, modelli: c.models.length }`).catch((e) => String(e));
  await ev(`await testNotify(); return 1`, 30000);
  out.checks.avviso_di_prova = await notified(/Stanotte sereno|Prova degli avvisi/, 15000);
  await ev(`setView('setup'); renderSetup(); return 1`); await sleep(1200); await ev(`document.getElementById('stAlerts').scrollIntoView({ block: 'start' }); return 1`); await sleep(1500); shot('12-setup-avvisi');
  out.checks.setup_avvisi = await ev(`return !!document.querySelector('#stAlerts [data-test]') && !document.getElementById('stAlertSt').hidden && document.getElementById('stBlocked').hidden`);
  out.stato_avvisi = await ev(`return await ${AL}.status()`).catch((e) => String(e));
  // widget «Stanotte»: l'app chiede alla schermata Home di aggiungerlo, qui si conferma come farebbe chi usa il telefono
  const ui = () => { try { adb('shell uiautomator dump /sdcard/ui.xml'); return adb('shell cat /sdcard/ui.xml'); } catch { return ''; } };
  const tapText = (re) => { const nodes = [...ui().matchAll(/<node [^>]*>/g)].map((m) => m[0]).filter((n) => re.test((/ text="([^"]*)"/.exec(n) || [])[1] || '')); const n = nodes.find((x) => /Button/.test(x)) || nodes[nodes.length - 1]; const b = n && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(n); if (!b) return false; adb(`shell input tap ${(+b[1] + +b[3]) >> 1} ${(+b[2] + +b[4]) >> 1}`); return true; };
  out.widget_chiesto = await ev(`return await ${AL}.pinWidget()`).catch((e) => String(e));
  await sleep(2500); shot('13-widget-conferma');
  out.widget_conferma = tapText(/^add( to home screen| automatically)?$/i); await sleep(3000);
  out.checks.widget_aggiunto = await until(`(await ${AL}.status()).widgets > 0`, 15000);
  // da qui l'app non deve più mandare la sua ricetta: si prova con notti finte
  await ev(`window.planNotifications = async () => {}; window.recipeSend = async () => {}; clearTimeout(RCP.t); RCP.job++; return 1`);
  const txt = `{ title: 'E2E sera: {w}', all: 'sereno tutta la notte', win: 'sereno {a}–{b}', pct: '{p}% del buio sereno', open: 'E2E si apre: {w}', bad: 'E2E cambio', badBody: '{p}%', test: 'prova', channel: 'Avvisi della notte', wTonight: 'E2E stanotte', wNext: 'prossima {d}', wNoWx: 'senza meteo', wOpen: 'apri', wMoon: 'Luna', wNoDark: 'senza buio', rate: ['coperta', 'scarsa', 'discreta', 'buona', 'ottima'] }`;
  const fake = (ds, startMin, extra) => `{ cfg: { v: 1, on: true, at: Date.now(), evening: true, change: true, top: false, lead: 60, minR: 3, minH: 1.5, lat: 45.464, lon: 9.19, models: [], mock: 1, txt: ${txt}, timed: [], ${extra || ''}
    nights: [{ ds: '${ds}', t0: Date.now() - 6 * 3600e3, d0: Date.now() + ${startMin} * 60000, d1: Date.now() + ${startMin} * 60000 + 5 * 3600e3, tz: 60, ill: 0, moon: [], day: 'E2E', blocks: [{ id: '${ds}', a: Date.now() + ${startMin} * 60000, b: Date.now() + ${startMin} * 60000 + 4 * 3600e3 }] }] } }`;
  // 1) ad app aperta: l'ora dell'avviso è già passata, arriva subito
  await ev(`await ${AL}.configure(${fake('E2E-A', 30)}); return 1`, 30000);
  out.checks.avviso_sera = await notified(/E2E sera: sereno tutta la notte/, 20000) && /E2E-A \d\d:\d\d/.test(notifs());
  // 2) nuvole che tornano dopo l'avviso: lo stesso avviso diventa «cambio»
  await ev(`await ${AL}.configure(${fake('E2E-A', 30).replace('mock: 1', 'mock: 0.05')}); await ${AL}.run({}); return 1`, 30000);
  out.checks.avviso_cambio = await notified(/E2E cambio/, 20000);
  // 3) ad app chiusa: sveglia fra un minuto e mezzo, poi l'app va in secondo piano e il suo processo viene chiuso
  await ev(`await ${AL}.configure(${fake('E2E-B', 61.5)}); return 1`, 30000);
  out.stato_prima = await ev(`return await ${AL}.status()`).catch((e) => String(e));
  out.checks.sveglia_programmata = !!(out.stato_prima && out.stato_prima.next > Date.now());
  try { out.jobs = adb('shell dumpsys jobscheduler').split('\n').filter((l) => l.includes(PKG)).slice(0, 12); } catch { /* niente */ }
  adb('shell input keyevent KEYCODE_HOME'); await sleep(3000);
  try { adb(`shell am kill ${PKG}`); } catch { /* niente */ }
  await sleep(2000);
  let pid = ''; try { pid = adb(`shell pidof ${PKG}`).trim(); } catch { /* nessun processo */ }
  out.checks.app_chiusa = !pid; log('app chiusa: ' + (!pid));
  out.checks.avviso_ad_app_chiusa = await notified(/E2E sera: sereno tutta la notte[\s\S]*E2E-B|E2E-B[\s\S]*E2E sera: sereno tutta la notte/, 240000);
  // il widget sulla schermata Home, riempito dal motore ad app chiusa (la notte finta è serena: «ottima»)
  await sleep(1500); shot('14-widget-home', true);
  const home = ui(); out.widget_testo = (home.match(/text="(E2E stanotte[^"]*)"/) || [])[1] || null;
  out.checks.widget_sulla_home = /E2E stanotte · ottima/.test(home);
  out.log_sveglia = logcat(/alarm: /).slice(-3);
  out.checks.sveglia_scattata = out.log_sveglia.length > 0;
  // 4) il lavoro periodico (WorkManager), forzato dal sistema ad app chiusa
  try {
    // Android 14: «JOB androidx.work.systemjobscheduler:u0a192/1: …» (con lo spazio di nomi di WorkManager); prima «JOB #u0a192/1: …»
    const line = adb('shell dumpsys jobscheduler').split('\n').find((l) => /^\s*JOB /.test(l) && l.includes(PKG + '/androidx.work')), m = line && /JOB (?:#|([\w.]+):)u\d+a\d+\/(\d+):/.exec(line);
    if (m) { const before = logcat(/work: /).length; adb(`shell cmd jobscheduler run -f ${m[1] ? '-n ' + m[1] + ' ' : ''}${PKG} ${m[2]}`); await sleep(15000); const L = logcat(/work: /); out.log_lavoro = L.slice(-3); out.checks.lavoro_periodico = L.length > before; }
    else { out.notes.push('lavoro periodico non trovato in jobscheduler'); out.checks.lavoro_periodico = false; }
  } catch (e) { out.notes.push('lavoro periodico: ' + e.message); out.checks.lavoro_periodico = false; }
  try { adb('shell cmd statusbar expand-notifications'); await sleep(2500); shot('09-notifiche', true); adb('shell cmd statusbar collapse'); } catch (e) { out.notes.push('tendina: ' + e.message); }
} catch (e) {
  log('errore: ' + (e && e.stack || e));
}
log('fine');
fs.writeFileSync('e2e/risultati.json', JSON.stringify(out, null, 2));
const bad = Object.entries(out.checks).filter(([, v]) => !v).map(([k]) => k);
const summary = `### Skyframe su Android 14 (emulatore)\n\n${Object.entries(out.checks).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`).join('\n')}\n\nAvvisi nativi: ricetta ${JSON.stringify(out.ricetta)}, stato ${JSON.stringify(out.stato_avvisi)}, widget ${JSON.stringify(out.widget_testo)}\n`;
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary, out.notes.join('\n'));
clearInterval(keep);
process.exit(out.checks.avvio && !bad.length ? 0 : 1);
