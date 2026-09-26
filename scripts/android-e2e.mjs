// Pilota Skyframe su un emulatore Android (DevTools della WebView dell'APK di debug) e ne fa le schermate.
// Lanciato da scripts/android-e2e.sh; tutto finisce in e2e/ (schermate, risultati.json).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PKG = 'io.github.astropuzzo.skyframe', LABEL = 'io.github.astropuzzo.skyframe.check';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (a) => execSync(`adb ${a}`, { encoding: 'utf8', maxBuffer: 64e6 });
const out = { checks: {}, notes: [] };
const shot = (name) => { try { fs.writeFileSync(`e2e/${name}.png`, execSync('adb exec-out screencap -p', { maxBuffer: 64e6 })); } catch (e) { out.notes.push(`schermata ${name}: ${e.message}`); } };
const notifs = () => { try { return adb('shell dumpsys notification --noredact'); } catch { return ''; } };

async function devtools() {
  for (let i = 0; i < 60; i++) {
    const pid = (() => { try { return adb(`shell pidof ${PKG}`).trim().split(/\s+/)[0]; } catch { return ''; } })();
    const socks = adb('shell cat /proc/net/unix').match(/@webview_devtools_remote_\d+/g) || [];
    const m = socks.find((x) => pid && x.endsWith('_' + pid)) || socks[0];
    if (m) { try { adb('forward --remove tcp:9222'); } catch { /* niente */ } adb(`forward tcp:9222 localabstract:${m.slice(1)}`); break; }
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
    this.ready = new Promise((r, j) => { this.ws.onopen = () => { this.open = true; r(); }; this.ws.onerror = j; });
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
  cdp = new CDP(await devtools()); await cdp.ready;
}
async function ev(body, ms) {
  for (let k = 0; k < 3; k++) { try { return await ev(body, ms); } catch (e) { out.notes.push(`comando ripetuto (${e.message})`); await reconnect(); } }
  throw new Error('comando non riuscito: ' + body.slice(0, 80));
}
const until = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(`return !!(${cond})`, 10000)) return true; } catch { /* riprova */ } await sleep(800); } return false; };
const keep = setInterval(() => {}, 1000); // il processo resta vivo mentre si aspetta la WebView

try {
  await reconnect();
  out.checks.avvio = await until('window.state && state.res && document.querySelector("#list .row")', 90000);
  shot('01-avvio');
  // guida al primo avvio: parte da sola
  out.checks.guida_parte = await until('window.TOUR && TOUR.el', 8000);
  await sleep(1500); shot('02-guida-benvenuto');
  // italiano (l'emulatore è in inglese), poi di nuovo la guida da capo
  await ev(`localStorage.setItem('sf.lang', JSON.stringify('it')); location.reload(); return 1`).catch(() => {});
  await sleep(4000); await until('window.state && state.res && document.querySelector("#list .row")', 90000);
  await ev(`if (window.TOUR && TOUR.el) tourClose(); tourStart(TOUR_STEPS, 0); return 1`); await sleep(2200); shot('03-guida-it');
  for (const [k, name] of [[1, 'luogo'], [3, 'notti'], [8, 'quanto-ci-vuole'], [11, 'cielo'], [12, 'progetti']]) {
    await ev(`tourGo(Math.min(${k}, TOUR.steps.length - 1)); return 1`); await sleep(2000); shot(`04-guida-${String(k).padStart(2, '0')}-${name}`);
  }
  await ev(`tourEnd(); return 1`); await sleep(1200);
  // meteo, preferiti, sezioni
  out.checks.meteo = await until('wxOk()', 60000);
  await ev(`for (const id of ['NGC 7000','IC 1396','NGC 281','IC 1805','NGC 6960']) if (state.byId.has(id) && !isFav(id)) toggleFav(id); return 1`);
  const views = [['tonight', 'stanotte'], ['targets', 'target'], ['sky', 'cielo'], ['projects', 'progetti'], ['setup', 'setup']];
  for (const [v, name] of views) { await ev(`setView('${v}'); return 1`); await sleep(v === 'projects' ? 4500 : 2500); shot(`05-${name}`); }
  await ev(`setView('tonight'); document.getElementById('v-tonight').scrollTop = 900; return 1`); await sleep(1200); shot('05-stanotte-giu');
  // dettaglio di un target: tempi e calendario
  await ev(`const id = state.byId.has('NGC 7000') ? 'NGC 7000' : state.filtered[0].o.id; openDetail(id); setDTab('piano'); return 1`); await sleep(2500);
  await ev(`const d = document.getElementById('drawer'); d.scrollTop = document.getElementById('scen').offsetTop - 120; return 1`); await sleep(1500); shot('06-dettaglio-tempi');
  await ev(`setDTab('quando'); return 1`); await sleep(2000); shot('07-dettaglio-quando');
  // tasto indietro di Android: chiude il dettaglio
  adb('shell input keyevent KEYCODE_BACK'); await sleep(1200);
  out.checks.indietro_chiude_dettaglio = await ev(`return document.getElementById('drawer').hidden`);
  shot('08-dopo-indietro');

  // avviso programmato (LocalNotifications): la prova di Setup
  await ev(`LS.set('sf.notify', true); await testNotify(); return 1`);
  await sleep(12000);
  const n1 = notifs();
  out.checks.avviso_programmato = /skyframe/i.test(n1) && /(Stasera si scatta|Prova degli avvisi)/.test(n1);
  // script in background: una notte finta che parte ora, poi il suo controllo (a app aperta con selftest)
  const cfg = `{ on: true, evening: true, change: true, lat: '45.464', lon: '9.190', tz: 60, nights: [{ id: 7, ds: 'e2e', d0: Date.now() + 30 * 60000, d1: Date.now() + 5 * 3600e3, alertAt: Date.now() - 60000, minH: 0, minClear: 0, good: false, appScheduled: false, body: 'prova e2e dallo script in background' }], txt: { title: 'Stasera si scatta: {w}', all: 'sereno tutta la notte', win: 'sereno {a}–{b}', pct: '{p}% del buio sereno', open: 'Si apre: {w}', bad: 'Cambio di programma', badBody: '{p}%' } }`;
  const BR = `(Capacitor.Plugins.BackgroundRunner || Capacitor.registerPlugin('BackgroundRunner'))`;
  out.runner_config = await ev(`try { await ${BR}.dispatchEvent({ label: '${LABEL}', event: 'config', details: ${cfg} }); return 'ok'; } catch (e) { return 'errore: ' + e.message; }`);
  out.runner_selftest = await ev(`try { return await ${BR}.dispatchEvent({ label: '${LABEL}', event: 'selftest', details: {} }); } catch (e) { return 'errore: ' + e.message; }`);
  await sleep(4000);
  const n2 = notifs();
  out.checks.avviso_da_script = /prova e2e dallo script in background/.test(n2);
  out.runner_status = await ev(`try { return await ${BR}.dispatchEvent({ label: '${LABEL}', event: 'status', details: {} }); } catch (e) { return 'errore: ' + e.message; }`);
  // il lavoro periodico registrato nel sistema (WorkManager)
  try { out.jobs = adb('shell dumpsys jobscheduler').split('\n').filter((l) => l.includes(PKG)).slice(0, 12); } catch { /* niente */ }
  try { adb('shell cmd statusbar expand-notifications'); await sleep(1500); shot('09-notifiche'); adb('shell cmd statusbar collapse'); } catch (e) { out.notes.push('tendina: ' + e.message); }
  out.errori_console = await ev(`return (window.__errs || []).slice(0, 10)`).catch(() => null);
} catch (e) {
  out.notes.push('errore: ' + (e && e.stack || e));
}
fs.writeFileSync('e2e/risultati.json', JSON.stringify(out, null, 2));
const bad = Object.entries(out.checks).filter(([, v]) => !v).map(([k]) => k);
const summary = `### Skyframe su Android 14 (emulatore)\n\n${Object.entries(out.checks).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`).join('\n')}\n\nScript in background: config ${JSON.stringify(out.runner_config)}, selftest ${JSON.stringify(out.runner_selftest)}\n`;
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary, out.notes.join('\n'));
clearInterval(keep);
process.exit(out.checks.avvio && !bad.length ? 0 : 1);
