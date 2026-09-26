/* Skyframe, avvisi in background (Android, plugin Background Runner).
   Gira da solo circa ogni 15-30 minuti ad app chiusa (quando lo decide il sistema), in un motore JavaScript senza pagina.
   L'app, ogni volta che si apre o aggiorna il meteo, gli passa le notti di stasera e domani già calcolate (finestra di
   buio, soglia, piano, testi nella lingua dell'app): qui si riscaricano solo le nuvole (Open-Meteo, miglior modello) e si
   decide se avvisare:
   - «Stasera si scatta» poco prima del buio, se il sereno previsto basta (e l'app non l'ha già programmato lei);
   - «Si apre» se una notte prevista coperta diventa buona;
   - «Cambio di programma» se dopo l'avviso le nuvole tornano.
   Niente posizione, niente altro: solo coordinate del luogo attivo e previsioni. */

function kvGet(k, d) { try { const r = CapacitorKV.get(k); return r && r.value ? JSON.parse(r.value) : d; } catch (e) { return d; } }
function kvSet(k, v) { try { CapacitorKV.set(k, JSON.stringify(v)); } catch (e) { /* niente */ } }
const clearFrac = (lo, mi, hi) => Math.min(1, Math.max(0, (75 - Math.max(lo || 0, mi || 0, 0.6 * (hi || 0))) / 60));
const fill = (s, p) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m));
const hhmm = (ms, tz) => { const d = new Date(ms + (tz || 0) * 60000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

function send(id, title, body) {
  CapacitorNotifications.schedule([{ id, title, body, smallIcon: 'ic_stat_skyframe', autoCancel: true }]);
}
/* sereno nella finestra [a, b] a passi di 10 minuti: frazione, ore serene, finestra serena più lunga */
function span(h, a, b) {
  let n = 0, sum = 0, run = 0, best = [0, -1, -1], cur = -1;
  for (let t = a; t < b; t += 600000) {
    const x = (t / 1000 - h.time[0]) / 3600, i = Math.floor(x); if (i < 0 || i + 1 >= h.time.length) continue;
    const u = x - i, f0 = clearFrac(h.cloud_cover_low[i], h.cloud_cover_mid[i], h.cloud_cover_high[i]), f1 = clearFrac(h.cloud_cover_low[i + 1], h.cloud_cover_mid[i + 1], h.cloud_cover_high[i + 1]), f = f0 * (1 - u) + f1 * u;
    n++; sum += f;
    if (f >= 0.7) { if (cur < 0) cur = t; run++; if (run > best[0]) best = [run, cur, t + 600000]; } else { run = 0; cur = -1; }
  }
  return n ? { clear: sum / n, h: sum / 6, win: best[1] > 0 ? [best[1], best[2]] : null } : null;
}

addEventListener('config', (resolve, reject, args) => { try { kvSet('sf.cfg', args || null); resolve(); } catch (e) { resolve(); } });
addEventListener('status', (resolve) => { try { resolve({ lastRun: kvGet('sf.lastRun', 0), sent: kvGet('sf.sent', {}) }); } catch (e) { resolve({}); } });

/* il controllo periodico; force = anche con l'app aperta (prova dall'app: Setup o test automatico) */
async function check(force) {
    kvSet('sf.lastRun', Date.now());
    const st = CapacitorApp.getState(); if (!force && st && st.isActive) return 'attiva'; // app aperta: ci pensa lei
    const cfg = kvGet('sf.cfg', null); if (!cfg || !cfg.on || !cfg.nights || !cfg.nights.length) return 'spenti';
    const now = Date.now(), n = cfg.nights.find((x) => now < x.d1 && now > x.d0 - 20 * 3600e3); if (!n) return 'nessuna notte';
    const T = cfg.txt || {}, sent = kvGet('sf.sent', {}), k = n.ds;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high&past_days=1&forecast_days=2&timeformat=unixtime&timezone=GMT`);
    const j = await r.json(), h = j && j.hourly; if (!h || !h.time) return 'meteo assente';
    const w = span(h, Math.max(now, n.d0), n.d1); if (!w) return 'meteo fuori finestra';
    const good = w.h >= n.minH && w.clear >= n.minClear;
    const when = w.clear >= 0.85 ? T.all : w.win ? fill(T.win, { a: hhmm(w.win[0], cfg.tz), b: hhmm(w.win[1], cfg.tz) }) : fill(T.pct, { p: Math.round(w.clear * 100) });
    let out = 'niente da dire';
    if (good && cfg.evening && !n.appScheduled && !sent[k + 'e'] && now >= n.alertAt - 20 * 60000 && now < n.d0 + 90 * 60000) {
      send(n.id, fill(T.title, { w: when }), n.body || ''); sent[k + 'e'] = now; out = 'sera';
    } else if (good && cfg.change && !n.good && !sent[k + 'e'] && !sent[k + 'o'] && now > n.d0 - 6 * 3600e3 && now < n.d1 - 2 * 3600e3) {
      send(n.id + 40, fill(T.open, { w: when }), n.body || ''); sent[k + 'o'] = now; sent[k + 'e'] = now; out = 'si apre';
    } else if (!good && cfg.change && (sent[k + 'e'] || (n.appScheduled && now > n.alertAt)) && !sent[k + 'b'] && now < n.d1 - 2 * 3600e3) {
      send(n.id + 50, T.bad, fill(T.badBody, { p: Math.round(w.clear * 100) })); sent[k + 'b'] = now; out = 'cambio';
    }
    for (const x of Object.keys(sent)) if (now - sent[x] > 5 * 864e5) delete sent[x];
    kvSet('sf.sent', sent);
    return out;
}
addEventListener('check', async (resolve) => { try { await check(false); } catch (e) { /* niente */ } resolve(); });
addEventListener('selftest', async (resolve) => { try { resolve({ ok: true, out: await check(true) }); } catch (e) { resolve({ ok: false, err: String(e) }); } });
