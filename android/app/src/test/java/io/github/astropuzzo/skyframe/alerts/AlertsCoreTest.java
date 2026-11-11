package io.github.astropuzzo.skyframe.alerts;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/* Le decisioni degli avvisi con previsioni costruite a mano: notte dalle 19:00 alle 05:00 UTC, fuso +60 minuti. */
public class AlertsCoreTest {
    static final long H = AlertsCore.HOUR, M = AlertsCore.MIN;
    static final long NOON = 1_797_422_400_000L - (1_797_422_400_000L % (24 * H)) + 12 * H; // un mezzogiorno UTC
    static final long D0 = NOON + 7 * H, D1 = NOON + 17 * H;

    static JSONObject night(long noon, String ds) throws Exception {
        JSONObject n = new JSONObject();
        n.put("ds", ds); n.put("t0", noon); n.put("d0", noon + 7 * H); n.put("d1", noon + 17 * H); n.put("tz", 60); n.put("ill", 0.05); n.put("day", "Giovedì");
        n.put("moon", new JSONArray());
        JSONArray b = new JSONArray();
        b.put(new JSONObject().put("id", "NGC 7000").put("a", noon + 7 * H).put("b", noon + 11 * H));
        b.put(new JSONObject().put("id", "M 31").put("a", noon + 11 * H).put("b", noon + 17 * H));
        n.put("blocks", b);
        return n;
    }

    static JSONObject cfg() throws Exception {
        JSONObject c = new JSONObject();
        c.put("on", true); c.put("evening", true); c.put("change", true); c.put("top", false);
        c.put("lead", 60); c.put("minR", 3); c.put("minH", 1.5); c.put("at", NOON);
        c.put("nights", new JSONArray().put(night(NOON, "2026-12-16")).put(night(NOON + 24 * H, "2026-12-17")));
        c.put("txt", new JSONObject().put("title", "Stanotte sereno: {w}").put("all", "sereno tutta la notte").put("win", "sereno {a}–{b}").put("pct", "{p}% del buio sereno")
                .put("open", "Schiarita prevista: {w}").put("bad", "Cambio di programma: nuvole").put("badBody", "Solo il {p}% del buio è sereno.")
                .put("topTitle", "{d}: notte ottima").put("topBody", "Senza Luna, sereno al {p}%").put("forT", "Per {t}").put("moon", "Luna {p}%").put("gust", "raffiche {v} km/h").put("dew", "condensa"));
        return c;
    }

    /* previsione oraria da NOON − 24 h per 120 ore: clear(ora da NOON) → frazione di cielo sgombro */
    interface F { double at(double h); }

    static AlertsCore.Wx wx(F f) {
        AlertsCore.Wx w = new AlertsCore.Wx();
        int n = 120; w.at = NOON; w.t0 = (NOON - 24 * H) / 1000;
        w.clear = new double[n]; w.low = new double[n]; w.dew = new double[n]; w.gust = new double[n];
        for (int i = 0; i < n; i++) { w.clear[i] = f.at(i - 24); w.low[i] = w.clear[i]; w.dew[i] = 8; w.gust[i] = 10; }
        return w;
    }

    static final Set<Integer> NONE = Collections.emptySet();

    @Test
    public void mediaPesataDeiModelli() throws Exception {
        JSONObject h = new JSONObject();
        h.put("time", new JSONArray().put(1000).put(4600));
        h.put("cloud_cover_low_a", new JSONArray().put(0).put(100)); h.put("cloud_cover_mid_a", new JSONArray().put(0).put(0)); h.put("cloud_cover_high_a", new JSONArray().put(0).put(0));
        h.put("cloud_cover_low_b", new JSONArray().put(75).put(JSONObject.NULL)); h.put("cloud_cover_mid_b", new JSONArray().put(0).put(JSONObject.NULL)); h.put("cloud_cover_high_b", new JSONArray().put(0).put(JSONObject.NULL));
        h.put("temperature_2m_b", new JSONArray().put(5).put(4)); h.put("dew_point_2m_b", new JSONArray().put(4).put(4)); h.put("wind_gusts_10m_a", new JSONArray().put(42).put(10));
        JSONArray models = new JSONArray().put(new JSONArray().put("a").put(3)).put(new JSONArray().put("b").put(1));
        AlertsCore.Wx w = AlertsCore.Wx.parse(new JSONObject().put("hourly", h), models, 5);
        assertNotNull(w);
        assertEquals(0.75, w.clear[0], 1e-9);   // (3·1 + 1·0) / 4
        assertEquals(0, w.low[0], 1e-9);        // il più pessimista
        assertEquals(0, w.clear[1], 1e-9);      // il modello b lì non c'è: resta solo a
        assertEquals(1, w.dew[0], 1e-9); assertEquals(42, w.gust[0], 1e-9);
        AlertsCore.Wx back = AlertsCore.Wx.fromJson(w.toJson());
        assertEquals(w.clear[0], back.clear[0], 1e-9); assertEquals(1000, back.t0);
        // un solo modello: serie senza nome in coda; nubi alte al 60%
        JSONObject one = new JSONObject().put("time", new JSONArray().put(0).put(3600)).put("cloud_cover_low", new JSONArray().put(15).put(0)).put("cloud_cover_high", new JSONArray().put(0).put(100));
        AlertsCore.Wx s = AlertsCore.Wx.parse(new JSONObject().put("hourly", one), null, 0);
        assertEquals(1, s.clear[0], 1e-9); assertEquals(0.25, s.clear[1], 1e-9);
        assertNull(AlertsCore.Wx.parse(new JSONObject(), null, 0));
    }

    @Test
    public void votoDellaNotte() throws Exception {
        JSONObject n = night(NOON, "x");
        AlertsCore.Eval e = AlertsCore.eval(n, wx((h) -> 1), D0, D1);
        assertTrue(e.ok); assertEquals(4, e.r); assertEquals(10, e.hours, 1e-6); assertEquals(2, e.blocks.size());
        assertEquals("sereno tutta la notte", AlertsCore.when(cfg().getJSONObject("txt"), e, 60));
        // sereno solo da mezzanotte UTC: cinque ore e mezza su dieci, finestra nell'ora del luogo, primo blocco sotto le nuvole
        e = AlertsCore.eval(n, wx((h) -> h >= 12 ? 1 : 0), D0, D1);
        assertEquals(3, e.r);
        assertEquals("sereno 00:50–06:00", AlertsCore.when(cfg().getJSONObject("txt"), e, 60));
        assertEquals(1, e.blocks.size()); assertEquals(1, e.blocks.get(0)[0]);
        // Luna alta tutta la notte: le ore valgono un terzo
        n.put("moon", new JSONArray().put(new JSONArray().put(D0).put(D1))); n.put("ill", 0.9);
        e = AlertsCore.eval(n, wx((h) -> 1), D0, D1);
        assertEquals(2, e.r); assertEquals(1, e.moonFrac, 1e-9);
        // coperto
        e = AlertsCore.eval(n, wx((h) -> 0.05), D0, D1);
        assertEquals(0, e.r);
        // senza previsione non c'è giudizio
        assertFalse(AlertsCore.eval(n, null, D0, D1).ok);
    }

    @Test
    public void avvisoDellaSera() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        AlertsCore.Wx clear = wx((h) -> 1);
        // nel pomeriggio: niente, la sveglia è un'ora prima del buio
        AlertsCore.Out o = AlertsCore.decide(c, st, clear, NOON + 2 * H, NONE);
        assertTrue(o.post.isEmpty()); assertEquals(D0 - H, o.nextAlarm);
        // all'ora dell'avviso
        o = AlertsCore.decide(c, st, clear, D0 - H, NONE);
        assertEquals(1, o.post.size()); assertEquals("sera", o.log);
        assertEquals("Stanotte sereno: sereno tutta la notte", o.post.get(0).title);
        assertEquals("NGC 7000 20:00–00:00 · M 31 00:00–06:00", o.post.get(0).body);
        assertEquals("2026-12-16", o.post.get(0).ds);
        // una volta sola
        o = AlertsCore.decide(c, st, clear, D0 - 30 * M, NONE);
        assertTrue(o.post.isEmpty());
        // la sveglia successiva è quella di domani sera
        assertEquals(D0 + 24 * H - H, o.nextAlarm);
    }

    @Test
    public void nuvoleCheTornanoEPoiSiRiapre() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        Set<Integer> shown = new HashSet<>(); shown.add(AlertsCore.ID_NIGHT);
        assertEquals("sera", AlertsCore.decide(c, st, wx((h) -> 1), D0 - H, NONE).log);
        // finestra che si sposta, avviso ancora visibile: si aggiorna in silenzio
        AlertsCore.Out o = AlertsCore.decide(c, st, wx((h) -> h >= 9 ? 1 : 0.4), D0 + 10 * M, shown);
        assertEquals("aggiornato", o.log); assertTrue(o.post.get(0).quiet);
        // se l'avviso è stato tolto non si rimette
        st.getJSONObject("nights").getJSONObject("2026-12-16").put("t", "altro");
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> h >= 9 ? 1 : 0.4), D0 + 20 * M, NONE).log);
        // coperto: cambio di programma, una volta
        o = AlertsCore.decide(c, st, wx((h) -> 0.1), D0 + H, NONE);
        assertEquals("cambio", o.log); assertEquals("Cambio di programma: nuvole", o.post.get(0).title); assertEquals("Solo il 10% del buio è sereno.", o.post.get(0).body);
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 0.1), D0 + 2 * H, NONE).log);
        // si riapre
        o = AlertsCore.decide(c, st, wx((h) -> 1), D0 + 3 * H, NONE);
        assertEquals("si apre", o.log); assertEquals("Schiarita prevista: sereno tutta la notte", o.post.get(0).title);
        assertEquals("NGC 7000 23:00–00:00 · M 31 00:00–06:00", o.post.get(0).body);
        // e poi basta: né un secondo cambio né una seconda schiarita
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 0.1), D0 + 4 * H, NONE).log);
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 1), D0 + 5 * H, NONE).log);
    }

    @Test
    public void seraCopertaPoiSchiarita() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        AlertsCore.Out o = AlertsCore.decide(c, st, wx((h) -> 0.1), D0 - H, NONE);
        assertTrue(o.post.isEmpty());
        // senza un avviso di sereno prima, niente «cambio di programma»
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 0.05), D0, NONE).log);
        o = AlertsCore.decide(c, st, wx((h) -> 1), D0 + 2 * H, NONE);
        assertEquals("si apre", o.log);
        // nelle ultime due ore non si disturba più
        st = new JSONObject();
        AlertsCore.decide(c, st, wx((h) -> 0.1), D0 - H, NONE);
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 1), D1 - 90 * M, NONE).log);
    }

    @Test
    public void sogliaEPiano() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        // voto minimo «ottima» con una notte solo buona: niente
        c.put("minR", 4);
        assertTrue(AlertsCore.decide(c, st, wx((h) -> h >= 12 ? 1 : 0), D0 - H, NONE).post.isEmpty());
        // sereno a inizio notte, ma l'unico target del piano passa dopo, sotto le nuvole
        c = cfg(); st = new JSONObject(); c.put("minR", 2); c.put("minH", 0.5);
        c.getJSONArray("nights").getJSONObject(0).put("blocks", new JSONArray().put(new JSONObject().put("id", "M 31").put("a", NOON + 14 * H).put("b", NOON + 17 * H)));
        assertTrue(AlertsCore.eval(c.getJSONArray("nights").getJSONObject(0), wx((h) -> h <= 12 ? 1 : 0), D0, D1).r >= 2);
        assertTrue(AlertsCore.decide(c, st, wx((h) -> h <= 12 ? 1 : 0), D0 - H, NONE).post.isEmpty());
        // senza piano (nessun preferito) decide solo il cielo
        c = cfg(); st = new JSONObject();
        for (int i = 0; i < 2; i++) c.getJSONArray("nights").getJSONObject(i).remove("blocks");
        AlertsCore.Out o = AlertsCore.decide(c, st, wx((h) -> 1), D0 - H, NONE);
        assertEquals(1, o.post.size()); assertEquals("", o.post.get(0).body);
        // avvisi della sera spenti: nessun avviso, e neanche il «cambio»
        c = cfg(); st = new JSONObject(); c.put("evening", false);
        assertTrue(AlertsCore.decide(c, st, wx((h) -> 1), D0 - H, NONE).post.isEmpty());
        assertEquals("niente", AlertsCore.decide(c, st, wx((h) -> 0.05), D0 + H, NONE).log);
        // tutto spento
        c.put("on", false);
        assertEquals("spenti", AlertsCore.decide(c, new JSONObject(), wx((h) -> 1), D0, NONE).log);
    }

    @Test
    public void senzaRete() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        // nessuna previsione e nessun giudizio dell'app: si riprova fra dieci minuti
        AlertsCore.Out o = AlertsCore.decide(c, st, null, D0 - H, NONE);
        assertTrue(o.needWx); assertTrue(o.post.isEmpty()); assertEquals(D0 - H + 10 * M, o.nextAlarm);
        // con il giudizio dell'app di oggi si usa quello
        JSONObject n = c.getJSONArray("nights").getJSONObject(0);
        n.put("good", true); n.put("when", "sereno tutta la notte"); n.put("body", "NGC 7000 20:00–00:00");
        o = AlertsCore.decide(c, st, null, D0 - H, NONE);
        assertEquals("sera", o.log); assertEquals("NGC 7000 20:00–00:00", o.post.get(0).body);
        // ricetta vecchia di giorni: non ci si fida
        c = cfg(); st = new JSONObject(); c.put("at", NOON - 48 * H);
        c.getJSONArray("nights").getJSONObject(0).put("good", true).put("when", "x").put("body", "y");
        assertTrue(AlertsCore.decide(c, st, null, D0 - H, NONE).post.isEmpty());
        // telefono acceso a notte fonda: niente avviso della sera in ritardo
        st = new JSONObject();
        assertTrue(AlertsCore.decide(cfg(), st, wx((h) -> 1), D0 + 3 * H, NONE).post.isEmpty());
    }

    @Test
    public void notteOttimaIlGiornoPrima() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        c.put("evening", false); c.put("change", false); c.put("top", true);
        AlertsCore.Wx clear = wx((h) -> 1);
        // alle 13:30 locali: stanotte e domani notte, una per avviso
        AlertsCore.Out o = AlertsCore.decide(c, st, clear, NOON + 30 * M, NONE);
        assertEquals("notte ottima", o.log); assertEquals(2, o.post.size());
        assertTrue(o.post.get(0).id != o.post.get(1).id);
        AlertsCore.Note n = o.post.get(1);
        assertEquals("Giovedì: notte ottima", n.title); assertEquals("Senza Luna, sereno al 100%\nPer NGC 7000, M 31", n.body); assertEquals("2026-12-17", n.ds);
        assertTrue(n.id >= AlertsCore.ID_TOP && n.id < AlertsCore.ID_TOP + 7);
        assertTrue(AlertsCore.decide(c, st, clear, NOON + 2 * H, NONE).post.isEmpty()); // una volta sola
        // di notte non si avvisa
        st = new JSONObject();
        assertTrue(AlertsCore.decide(c, st, clear, NOON + 11 * H, NONE).post.isEmpty());
        // modelli in disaccordo (il più pessimista dà coperto): niente
        AlertsCore.Wx split = wx((h) -> 1); java.util.Arrays.fill(split.low, 0.2);
        assertTrue(AlertsCore.decide(c, new JSONObject(), split, NOON + 30 * M, NONE).post.isEmpty());
        // Luna alta: non è una notte ottima
        for (int i = 0; i < 2; i++) c.getJSONArray("nights").getJSONObject(i).put("moon", new JSONArray().put(new JSONArray().put(D0).put(D1 + 24 * H)));
        assertTrue(AlertsCore.decide(c, new JSONObject(), clear, NOON + 30 * M, NONE).post.isEmpty());
    }

    @Test
    public void avvisiAOrario() throws Exception {
        JSONObject c = cfg(), st = new JSONObject();
        c.put("evening", false); c.put("change", false); c.put("top", false);
        c.put("timed", new JSONArray().put(new JSONObject().put("id", 300).put("key", "NGC 281|2026-12").put("at", NOON + 6 * H).put("title", "NGC 281: ultime settimane").put("body", "fino al 3 gen")));
        AlertsCore.Out o = AlertsCore.decide(c, st, null, NOON, NONE);
        assertTrue(o.post.isEmpty()); assertEquals(NOON + 6 * H, o.nextAlarm);
        o = AlertsCore.decide(c, st, null, NOON + 6 * H + M, NONE);
        assertEquals(1, o.post.size()); assertEquals(300, o.post.get(0).id);
        assertTrue(AlertsCore.decide(c, st, null, NOON + 7 * H, NONE).post.isEmpty());
        assertEquals(0, AlertsCore.decide(c, st, null, NOON + 7 * H, NONE).nextAlarm);
    }

    @Test
    public void testiEOrari() throws Exception {
        assertEquals("23:05", AlertsCore.hhmm(NOON + 10 * H + 5 * M, 60));
        assertEquals("16:30", AlertsCore.hhmm(NOON, 270));
        assertEquals("05:00", AlertsCore.hhmm(NOON, -420));
        // extra dell'app finché la ricetta è fresca, Luna, raffiche e condensa
        JSONObject c = cfg(), n = c.getJSONArray("nights").getJSONObject(0);
        n.put("extra", "seeing buono"); n.put("ill", 0.8); n.put("moon", new JSONArray().put(new JSONArray().put(D0).put(D1)));
        AlertsCore.Wx w = wx((h) -> 1); java.util.Arrays.fill(w.gust, 45); java.util.Arrays.fill(w.dew, 1);
        AlertsCore.Eval e = AlertsCore.eval(n, w, D0, D1);
        assertEquals("NGC 7000 20:00–00:00 · M 31 00:00–06:00\nLuna 80% · seeing buono · condensa · raffiche 45 km/h", AlertsCore.body(c, n, e, NOON + H));
        assertFalse(AlertsCore.body(c, n, e, NOON + 13 * H).contains("seeing"));
        // prova da Setup
        assertEquals("Stanotte sereno: sereno tutta la notte", AlertsCore.test(cfg(), wx((h) -> 1), NOON).title);
        assertEquals("Skyframe", AlertsCore.test(null, null, NOON).title);
        // ritmo degli scaricamenti
        assertEquals(3 * H, AlertsCore.maxAge(cfg(), NOON));
        assertEquals(25 * M, AlertsCore.maxAge(cfg(), D0 - 2 * H));
        assertEquals(55 * M, AlertsCore.maxAge(cfg(), D0 + 4 * H));
        assertEquals(Long.MAX_VALUE, AlertsCore.maxAge(cfg(), NOON + 60 * 24 * H)); // ricetta finita: non si scarica più
    }
}
