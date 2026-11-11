package io.github.astropuzzo.skyframe.alerts;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/* Le decisioni degli avvisi, senza classi Android: si provano sul computer (AlertsCoreTest).
   L'app passa la ricetta delle notti (buio, Luna, piano a cielo sereno); qui si incrocia con le nuvole appena scaricate. */
final class AlertsCore {
    static final long MIN = 60_000L, HOUR = 3_600_000L, STEP = 10 * MIN;
    static final int ID_NIGHT = 1, ID_TOP = 10, ID_TEST = 99;
    /* un blocco del piano conta se restano almeno 45 minuti sereni; sotto il 30% di cielo sgombro non si riprende */
    static final double BLOCK_MIN_H = 0.75, COVERED = 0.3, WINDOW = 0.7;

    private AlertsCore() {}

    /* ---------- previsione: cielo sgombro ora per ora ---------- */
    static final class Wx {
        long at, t0;          // scaricata (ms), prima ora (s UTC)
        double[] clear, low;  // media pesata dei modelli, modello più pessimista
        double[] dew, gust;   // temperatura meno punto di rugiada (°C), raffiche (km/h)
        String site = "";     // il luogo per cui è stata scaricata, come lo scrive site(cfg)

        int n() { return clear.length; }

        private static double pick(double[] a, long ms, long t0) {
            double x = (ms / 1000.0 - t0) / 3600.0;
            if (!(x >= 0) || x > a.length - 1) return Double.NaN;
            int i = (int) Math.floor(x);
            double u = x - i, p = a[i], q = i + 1 < a.length ? a[i + 1] : Double.NaN;
            if (Double.isNaN(p)) return q;
            if (Double.isNaN(q)) return p;
            return p * (1 - u) + q * u;
        }

        double clearAt(long ms) { return pick(clear, ms, t0); }
        double lowAt(long ms) { return pick(low, ms, t0); }

        private double hourly(double[] a, long ms) {
            long i = Math.round((ms / 1000.0 - t0) / 3600.0);
            return i < 0 || i >= a.length ? Double.NaN : a[(int) i];
        }

        static double clearFrac(double lo, double mi, double hi) {
            double c = Math.max(Math.max(nz(lo), nz(mi)), 0.6 * nz(hi));
            return Math.min(1, Math.max(0, (75 - c) / 60));
        }

        private static double nz(double v) { return Double.isNaN(v) ? 0 : v; }

        private static double[] series(JSONObject h, String key, int n) {
            JSONArray a = h.optJSONArray(key);
            if (a == null) return null;
            double[] out = new double[n];
            for (int i = 0; i < n; i++) out[i] = i < a.length() && !a.isNull(i) ? a.optDouble(i, Double.NaN) : Double.NaN;
            return out;
        }

        /* risposta di Open-Meteo: con più modelli ogni serie ha il nome del modello in coda, con uno solo no */
        static Wx parse(JSONObject root, JSONArray models, long at) {
            JSONObject h = root == null ? null : root.optJSONObject("hourly");
            JSONArray time = h == null ? null : h.optJSONArray("time");
            if (time == null || time.length() < 2) return null;
            int n = time.length();
            Wx w = new Wx();
            w.at = at; w.t0 = time.optLong(0);
            w.clear = new double[n]; w.low = new double[n]; w.dew = new double[n]; w.gust = new double[n];
            double[] sw = new double[n], sc = new double[n];
            for (int i = 0; i < n; i++) { w.low[i] = Double.NaN; w.dew[i] = Double.NaN; w.gust[i] = Double.NaN; }
            int count = models == null ? 0 : models.length();
            for (int m = 0; m < Math.max(1, count); m++) {
                JSONArray mm = count > 0 ? models.optJSONArray(m) : null;
                String sfx = mm != null ? "_" + mm.optString(0) : "";
                double wt = mm != null ? mm.optDouble(1, 1) : 1;
                double[] lo = series(h, "cloud_cover_low" + sfx, n);
                if (lo == null && count <= 1) { sfx = ""; lo = series(h, "cloud_cover_low", n); }
                double[] mi = series(h, "cloud_cover_mid" + sfx, n), hi = series(h, "cloud_cover_high" + sfx, n);
                double[] t = series(h, "temperature_2m" + sfx, n), td = series(h, "dew_point_2m" + sfx, n), g = series(h, "wind_gusts_10m" + sfx, n);
                for (int i = 0; i < n; i++) {
                    if (lo != null && !Double.isNaN(lo[i])) {
                        double f = clearFrac(lo[i], mi == null ? Double.NaN : mi[i], hi == null ? Double.NaN : hi[i]);
                        sw[i] += wt; sc[i] += wt * f;
                        w.low[i] = Double.isNaN(w.low[i]) ? f : Math.min(w.low[i], f);
                    }
                    if (Double.isNaN(w.dew[i]) && t != null && td != null && !Double.isNaN(t[i]) && !Double.isNaN(td[i])) w.dew[i] = t[i] - td[i];
                    if (Double.isNaN(w.gust[i]) && g != null && !Double.isNaN(g[i])) w.gust[i] = g[i];
                }
            }
            boolean any = false;
            for (int i = 0; i < n; i++) { w.clear[i] = sw[i] > 0 ? sc[i] / sw[i] : Double.NaN; any |= sw[i] > 0; }
            return any ? w : null;
        }

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("at", at); o.put("t0", t0); o.put("site", site);
            o.put("clear", arr(clear, 100)); o.put("low", arr(low, 100)); o.put("dew", arr(dew, 10)); o.put("gust", arr(gust, 1));
            return o;
        }

        static Wx fromJson(JSONObject o) {
            if (o == null || o.optJSONArray("clear") == null) return null;
            int n = o.optJSONArray("clear").length();
            if (n < 2) return null;
            Wx w = new Wx();
            w.at = o.optLong("at"); w.t0 = o.optLong("t0"); w.site = o.optString("site", "");
            w.clear = series(o, "clear", n); w.low = series(o, "low", n); w.dew = series(o, "dew", n); w.gust = series(o, "gust", n);
            if (w.low == null) w.low = w.clear.clone();
            if (w.dew == null) w.dew = nan(n);
            if (w.gust == null) w.gust = nan(n);
            return w;
        }

        private static double[] nan(int n) { double[] a = new double[n]; java.util.Arrays.fill(a, Double.NaN); return a; }

        private static JSONArray arr(double[] a, double k) throws JSONException {
            JSONArray out = new JSONArray();
            for (double v : a) { if (Double.isNaN(v)) out.put(JSONObject.NULL); else out.put(Math.round(v * k) / k); }
            return out;
        }
    }

    /* il luogo della ricetta: una previsione scaricata per un altro posto non vale, anche se è fresca */
    static String site(JSONObject cfg) {
        return cfg == null ? "" : String.format(java.util.Locale.ROOT, "%.3f,%.3f", cfg.optDouble("lat"), cfg.optDouble("lon"));
    }

    static Wx forSite(Wx wx, JSONObject cfg) { return wx != null && wx.site.equals(site(cfg)) ? wx : null; }

    /* ---------- una notte (o quel che ne resta) contro la previsione ---------- */
    static final class Eval {
        int n, known;
        double dark, clear, hours, good, rel, agree, dew = Double.NaN, gust = Double.NaN, moonFrac;
        int r;
        long winA = -1, winB = -1;
        double winH;
        boolean ok;           // almeno metà del buio ha una previsione
        List<long[]> blocks = new ArrayList<>(); // [indice nel piano, da, a] con almeno 45 minuti sereni
    }

    static double thr(int r) { return r >= 4 ? 0.68 : r == 3 ? 0.45 : 0.25; }

    private static boolean moonUp(JSONArray moon, long t) {
        if (moon == null) return false;
        for (int i = 0; i < moon.length(); i++) { JSONArray m = moon.optJSONArray(i); if (m != null && t >= m.optLong(0) && t < m.optLong(1)) return true; }
        return false;
    }

    /* voto come nell'app: ore serene sul buio della finestra, quelle con la Luna valgono un terzo */
    static Eval eval(JSONObject night, Wx wx, long from, long to) {
        Eval e = new Eval();
        JSONArray moon = night.optJSONArray("moon");
        double sum = 0, agree = 0; int run = 0, best = 0, mu = 0; long cur = -1; double lastH = -1;
        for (long t = from; t < to; t += STEP) {
            double f = wx == null ? Double.NaN : wx.clearAt(t);
            boolean m = moonUp(moon, t);
            e.n++; e.dark += 1 / 6.0; if (m) mu++;
            if (Double.isNaN(f)) { run = 0; cur = -1; e.good += (m ? 0.33 : 1) / 6.0; continue; }
            e.known++; sum += f; e.good += f * (m ? 0.33 : 1) / 6.0;
            double lo = wx.lowAt(t); agree += Double.isNaN(lo) ? f : lo;
            if (f >= WINDOW) { if (cur < 0) cur = t; run++; if (run > best) { best = run; e.winA = cur; e.winB = t + STEP; } } else { run = 0; cur = -1; }
            double hr = Math.rint((t / 1000.0 - wx.t0) / 3600.0);
            if (hr != lastH) {
                lastH = hr;
                double d = wx.hourly(wx.dew, t), g = wx.hourly(wx.gust, t);
                if (!Double.isNaN(d)) e.dew = Double.isNaN(e.dew) ? d : Math.min(e.dew, d);
                if (!Double.isNaN(g)) e.gust = Double.isNaN(e.gust) ? g : Math.max(e.gust, g);
            }
        }
        e.ok = e.n > 0 && e.known * 2 >= e.n;
        e.clear = e.known > 0 ? sum / e.known : Double.NaN;
        e.agree = e.known > 0 ? agree / e.known : Double.NaN;
        e.hours = e.known > 0 ? sum / 6.0 : 0;
        e.winH = best / 6.0;
        e.moonFrac = e.n > 0 ? mu / (double) e.n : 0;
        e.rel = e.good / Math.max(e.dark, 1);
        if (e.dark < 0.2 || (e.ok && e.clear < 0.15)) e.r = 0;
        else e.r = e.rel >= 0.68 ? 4 : e.rel >= 0.45 ? 3 : e.rel >= 0.25 ? 2 : 1;
        JSONArray bl = night.optJSONArray("blocks");
        if (bl != null) for (int i = 0; i < bl.length(); i++) {
            JSONObject b = bl.optJSONObject(i); if (b == null) continue;
            long a = Math.max(b.optLong("a"), from), z = Math.min(b.optLong("b"), to), ca = -1, cb = -1; double h = 0;
            for (long t = a; t < z; t += STEP) {
                double f = wx == null ? Double.NaN : wx.clearAt(t); if (Double.isNaN(f)) f = 1;
                if (f < COVERED) continue;
                h += f / 6.0; if (ca < 0) ca = t; cb = Math.min(z, t + STEP);
            }
            if (h >= BLOCK_MIN_H) e.blocks.add(new long[] { i, ca, cb });
        }
        return e;
    }

    /* ---------- testi ---------- */
    static String fill(String s, String... kv) {
        if (s == null) return "";
        for (int i = 0; i + 1 < kv.length; i += 2) s = s.replace("{" + kv[i] + "}", kv[i + 1]);
        return s;
    }

    static String hhmm(long ms, int tzMin) {
        long m = Math.floorMod(ms / MIN + tzMin, 1440L);
        return String.format(java.util.Locale.ROOT, "%02d:%02d", m / 60, m % 60);
    }

    private static String pct(double v) { return String.valueOf(Math.round(v * 100)); }

    static String when(JSONObject txt, Eval e, int tz) {
        if (e.clear >= 0.85) return txt.optString("all");
        if (e.winA >= 0 && e.winH >= 1) return fill(txt.optString("win"), "a", hhmm(e.winA, tz), "b", hhmm(e.winB, tz));
        return fill(txt.optString("pct"), "p", pct(e.clear));
    }

    static String body(JSONObject cfg, JSONObject night, Eval e, long now) {
        JSONObject txt = cfg.optJSONObject("txt"); if (txt == null) txt = new JSONObject();
        int tz = night.optInt("tz");
        JSONArray bl = night.optJSONArray("blocks");
        StringBuilder a = new StringBuilder();
        for (int i = 0; i < e.blocks.size() && i < 3; i++) {
            long[] b = e.blocks.get(i); JSONObject o = bl.optJSONObject((int) b[0]);
            if (a.length() > 0) a.append(" · ");
            a.append(o.optString("id")).append(' ').append(hhmm(b[1], tz)).append('–').append(hhmm(b[2], tz));
        }
        List<String> x = new ArrayList<>();
        if (night.optDouble("ill", 0) >= 0.3 && e.moonFrac > 0.3) x.add(fill(txt.optString("moon"), "p", pct(night.optDouble("ill", 0))));
        // seeing e altro calcolato dall'app: vale finché la ricetta è fresca
        String extra = night.optString("extra", "");
        if (!extra.isEmpty() && now - cfg.optLong("at") < 12 * HOUR) x.add(extra);
        if (!Double.isNaN(e.dew) && e.dew <= 2 && !txt.optString("dew").isEmpty()) x.add(txt.optString("dew"));
        if (!Double.isNaN(e.gust) && e.gust >= 30) x.add(fill(txt.optString("gust"), "v", String.valueOf(Math.round(e.gust))));
        for (int i = 0; i < x.size(); i++) a.append(i > 0 ? " · " : a.length() > 0 ? "\n" : "").append(x.get(i));
        return a.toString();
    }

    /* ---------- decisioni ---------- */
    static final class Note {
        int id; String title, body, ds; boolean quiet;
        Note(int id, String title, String body, String ds, boolean quiet) { this.id = id; this.title = title; this.body = body; this.ds = ds; this.quiet = quiet; }
    }

    static final class Out {
        final List<Note> post = new ArrayList<>();
        long nextAlarm;      // 0 = nessuna sveglia
        boolean needWx;      // serviva una previsione e non c'era
        String log = "niente";
    }

    private static JSONObject child(JSONObject o, String k) throws JSONException {
        JSONObject c = o.optJSONObject(k); if (c == null) { c = new JSONObject(); o.put(k, c); } return c;
    }

    private static long earlier(long a, long b) { return a == 0 ? b : b == 0 ? a : Math.min(a, b); }

    /* notte ottima: abbastanza buio senza Luna, sereno, e sereno anche per il modello più pessimista */
    static boolean great(Eval e) { return e.ok && e.r >= 4 && e.clear >= 0.7 && e.agree >= 0.5; }

    static Out decide(JSONObject cfg, JSONObject st, Wx wx, long now, Set<Integer> active) throws JSONException {
        Out out = new Out();
        if (cfg == null || !cfg.optBoolean("on")) { out.log = "spenti"; return out; }
        JSONObject txt = cfg.optJSONObject("txt"); if (txt == null) txt = new JSONObject();
        JSONArray nights = cfg.optJSONArray("nights"); if (nights == null) nights = new JSONArray();
        // luogo cambiato: quello che si è detto delle notti valeva per l'altro, e passare a un posto coperto non è un «cambio»
        String site = site(cfg);
        boolean moved = !site.equals(st.optString("site", site));
        if (moved) st.remove("nights");
        st.put("site", site);
        JSONObject sn = child(st, "nights"), sent = child(st, "sent");
        long lead = cfg.optLong("lead", 60) * MIN;
        int minR = cfg.optInt("minR", 3);
        double minH = cfg.optDouble("minH", 1.5);
        boolean evening = cfg.optBoolean("evening", true), change = cfg.optBoolean("change", true), top = cfg.optBoolean("top", true);

        boolean first = true;
        for (int k = 0; k < nights.length(); k++) {
            JSONObject n = nights.optJSONObject(k); if (n == null) continue;
            long d0 = n.optLong("d0"), d1 = n.optLong("d1"), noon = n.optLong("t0"), alertAt = d0 - lead;
            String ds = n.optString("ds");
            if (now >= d1 - 30 * MIN) continue;
            int tz = n.optInt("tz");
            JSONObject s = sn.optJSONObject(ds);
            String phase = s == null ? "" : s.optString("p", "");

            // stanotte (o la prossima), dall'ora dell'avviso: sera, poi schiarite e nuvole che tornano
            if (first && now >= alertAt - MIN) {
                first = false;
                if (!evening && !change) continue;
                boolean before = now < d0;
                Eval e = wx == null ? null : eval(n, wx, Math.max(now, d0), d1);
                Boolean good = null; boolean bad = false;
                String w = null, text = null;
                if (e != null && e.ok) {
                    boolean plan = n.optJSONArray("blocks") == null || !e.blocks.isEmpty();
                    good = e.r >= minR && e.hours >= minH && plan;
                    bad = before ? (e.r == 0 || e.rel < 0.75 * thr(minR) || e.hours < 0.7 * minH || !plan) : (e.clear < COVERED || e.hours < 0.5 * minH);
                    w = when(txt, e, tz); text = body(cfg, n, e, now);
                } else if (phase.isEmpty() && n.has("good") && !n.isNull("good") && now - cfg.optLong("at") < 12 * HOUR) {
                    // senza rete all'ora dell'avviso: vale il giudizio dell'app, se è di oggi
                    good = n.optBoolean("good"); bad = !good; w = n.optString("when"); text = n.optString("body");
                }
                if (good == null) {
                    out.needWx = true;
                    if (phase.isEmpty() && now < d0 + HOUR) out.nextAlarm = earlier(out.nextAlarm, now + 10 * MIN);
                } else if (phase.isEmpty()) {
                    s = new JSONObject(); sn.put(ds, s);
                    s.put("p", good ? "g" : "b"); s.put("at", now);
                    // a notte iniziata da un pezzo (telefono spento la sera) non si annuncia più niente
                    if (good && evening && now < d0 + 90 * MIN) {
                        // il luogo si cambia dall'app, che in quel momento è sullo schermo: l'avviso del nuovo posto non suona
                        out.post.add(new Note(ID_NIGHT, fill(txt.optString("title"), "w", w), text, ds, moved));
                        s.put("t", w); s.put("x", text); out.log = "sera";
                    }
                } else if (change && now < d1 - 2 * HOUR) {
                    if (phase.equals("b") && good && !s.has("o")) {
                        out.post.add(new Note(ID_NIGHT, fill(txt.optString("open"), "w", w), text, ds, false));
                        s.put("p", "g"); s.put("o", now); s.put("t", w); s.put("x", text); out.log = "si apre";
                    } else if (phase.equals("g") && bad && s.has("t") && !s.has("c")) {
                        // «cambio di programma» solo dopo un avviso di sereno
                        out.post.add(new Note(ID_NIGHT, txt.optString("bad"), fill(txt.optString("badBody"), "p", e != null && e.ok ? pct(e.clear) : "0"), ds, false));
                        s.put("p", "b"); s.put("c", now); s.remove("t"); out.log = "cambio";
                    } else if (phase.equals("g") && good && s.has("t") && active != null && active.contains(ID_NIGHT)
                            && (!w.equals(s.optString("t")) || !text.equals(s.optString("x")))) {
                        // l'avviso è ancora lì e la previsione si è spostata: si aggiorna senza suonare
                        String head = s.has("o") ? txt.optString("open") : txt.optString("title");
                        out.post.add(new Note(ID_NIGHT, fill(head, "w", w), text, ds, true));
                        s.put("t", w); s.put("x", text); out.log = "aggiornato";
                    }
                }
                continue;
            }
            first = false;

            // prima dell'ora dell'avviso: la sua sveglia e, dal giorno prima, la notte ottima
            if (evening || change) out.nextAlarm = earlier(out.nextAlarm, alertAt);
            if (!top || sent.has(ds + "|t")) continue;
            long topFrom = noon - 24 * HOUR + 30 * MIN, topTo = noon + 6 * HOUR;
            if (now < topFrom) { out.nextAlarm = earlier(out.nextAlarm, topFrom); continue; }
            long hour = Math.floorMod(now / MIN + tz, 1440L) / 60;
            if (now >= topTo || hour < 8 || hour >= 22 || wx == null) continue;
            Eval e = eval(n, wx, d0, d1);
            if (!great(e)) continue;
            StringBuilder who = new StringBuilder();
            JSONArray bl = n.optJSONArray("blocks");
            for (int i = 0; i < e.blocks.size() && i < 3; i++) { if (who.length() > 0) who.append(", "); who.append(bl.optJSONObject((int) e.blocks.get(i)[0]).optString("id")); }
            String text = fill(txt.optString("topBody"), "p", pct(e.clear)) + (who.length() > 0 ? "\n" + fill(txt.optString("forT"), "t", who.toString()) : "");
            out.post.add(new Note(ID_TOP + (int) Math.floorMod(noon / (24 * HOUR), 7L), fill(txt.optString("topTitle"), "d", n.optString("day")), text, ds, false));
            sent.put(ds + "|t", now); out.log = "notte ottima";
        }

        // avvisi a orario fissati dall'app (un target a fine stagione)
        JSONArray timed = cfg.optJSONArray("timed");
        if (timed != null) for (int i = 0; i < timed.length(); i++) {
            JSONObject t = timed.optJSONObject(i); if (t == null) continue;
            long at = t.optLong("at"); String key = "x|" + t.optString("key", String.valueOf(t.optInt("id")));
            if (sent.has(key)) continue;
            if (now < at) { out.nextAlarm = earlier(out.nextAlarm, at); continue; }
            if (now < at + 18 * HOUR) { out.post.add(new Note(t.optInt("id"), t.optString("title"), t.optString("body"), "", false)); out.log = "a orario"; }
            sent.put(key, now);
        }

        prune(sn, "at", now - 5 * 24 * HOUR);
        for (Iterator<String> it = sent.keys(); it.hasNext(); ) { String key = it.next(); if (now - sent.optLong(key) > 40 * 24 * HOUR) it.remove(); }
        return out;
    }

    private static void prune(JSONObject o, String field, long before) {
        for (Iterator<String> it = o.keys(); it.hasNext(); ) { JSONObject v = o.optJSONObject(it.next()); if (v == null || v.optLong(field) < before) it.remove(); }
    }

    /* Il widget della schermata Home: la notte in arrivo in due righe, con la previsione del momento. Se non vale la pena,
       la seconda riga dice qual è la prossima che vale almeno «discreta». null: nella ricetta non ci sono notti. */
    static String[] summary(JSONObject cfg, Wx wx, long now) {
        JSONObject txt = cfg == null ? null : cfg.optJSONObject("txt"); if (txt == null) txt = new JSONObject();
        JSONArray nights = cfg == null ? null : cfg.optJSONArray("nights");
        int ci = -1;
        if (nights != null) for (int k = 0; k < nights.length() && ci < 0; k++) { JSONObject n = nights.optJSONObject(k); if (n != null && now < n.optLong("d1") - 30 * MIN) ci = k; }
        if (ci < 0) return null;
        JSONObject cur = nights.optJSONObject(ci);
        long d0 = cur.optLong("d0"), d1 = cur.optLong("d1");
        String day = d0 - now < 20 * HOUR ? txt.optString("wTonight", cur.optString("day")) : cur.optString("day");
        Eval e = wx == null ? null : eval(cur, wx, Math.max(now, d0), d1);
        if (e == null || !e.ok) return new String[] { day, txt.optString("wNoWx", "") };
        JSONArray rate = txt.optJSONArray("rate");
        String label = e.dark < 0.2 ? txt.optString("wNoDark", "") : e.r == 1 && e.moonFrac > 0.7 && e.clear >= 0.5 ? txt.optString("wMoon", "") : rate == null ? "" : rate.optString(e.r, "");
        String title = label.isEmpty() ? day : day + " · " + label, line = when(txt, e, cur.optInt("tz"));
        if (e.r >= 2) {
            JSONArray bl = cur.optJSONArray("blocks"); StringBuilder who = new StringBuilder(); String prev = "";
            for (int i = 0; i < e.blocks.size() && i < 2; i++) { String id = bl.optJSONObject((int) e.blocks.get(i)[0]).optString("id"); if (!id.equals(prev)) who.append(who.length() > 0 ? ", " : "").append(id); prev = id; }
            if (who.length() > 0) line += " · " + who;
        } else {
            for (int k = ci + 1; k < nights.length(); k++) {
                JSONObject n = nights.optJSONObject(k); if (n == null) continue;
                Eval x = eval(n, wx, n.optLong("d0"), n.optLong("d1"));
                if (!x.ok) break; // oltre la previsione
                if (x.r >= 2) { line = fill(txt.optString("wNext", "{d}"), "d", n.optString("sd", n.optString("day"))); break; }
            }
        }
        return new String[] { title, line };
    }

    /* prova da Setup: la notte in arrivo com'è adesso, senza soglie e senza segnare niente */
    static Note test(JSONObject cfg, Wx wx, long now) {
        JSONObject txt = cfg == null ? null : cfg.optJSONObject("txt"); if (txt == null) txt = new JSONObject();
        String plain = txt.optString("test", "Skyframe");
        JSONArray nights = cfg == null ? null : cfg.optJSONArray("nights");
        if (nights != null && wx != null) for (int k = 0; k < nights.length(); k++) {
            JSONObject n = nights.optJSONObject(k); if (n == null || now >= n.optLong("d1") - 30 * MIN) continue;
            Eval e = eval(n, wx, Math.max(now, n.optLong("d0")), n.optLong("d1"));
            if (!e.ok) break;
            String w = when(txt, e, n.optInt("tz")), b = body(cfg, n, e, now);
            boolean good = e.r >= cfg.optInt("minR", 3) && e.hours >= cfg.optDouble("minH", 1.5);
            return new Note(ID_TEST, good ? fill(txt.optString("title"), "w", w) : plain, good ? b : w + (b.isEmpty() ? "" : "\n" + b), n.optString("ds"), false);
        }
        return new Note(ID_TEST, plain, plain, "", false);
    }

    /* quanto spesso riscaricare le nuvole: ogni mezz'ora da tre ore prima dell'avviso a due ore dopo il buio, ogni ora nel
       resto della notte, ogni tre ore di giorno. Senza più notti nella ricetta (app chiusa da un mese): mai. */
    static long maxAge(JSONObject cfg, long now) {
        JSONArray nights = cfg == null ? null : cfg.optJSONArray("nights");
        long lead = cfg == null ? 60 * MIN : cfg.optLong("lead", 60) * MIN;
        boolean ahead = false;
        if (nights != null) for (int k = 0; k < nights.length(); k++) {
            JSONObject n = nights.optJSONObject(k); if (n == null) continue;
            long d0 = n.optLong("d0"), d1 = n.optLong("d1");
            if (now >= d0 - lead - 3 * HOUR && now < d0 + 2 * HOUR) return 25 * MIN;
            if (now >= d0 + 2 * HOUR && now < d1 - 2 * HOUR) return 55 * MIN;
            ahead |= d1 > now;
        }
        return ahead ? 3 * HOUR : Long.MAX_VALUE;
    }
}
