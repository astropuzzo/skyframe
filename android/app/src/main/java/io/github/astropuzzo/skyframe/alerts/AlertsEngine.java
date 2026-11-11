package io.github.astropuzzo.skyframe.alerts;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import io.github.astropuzzo.skyframe.MainActivity;
import io.github.astropuzzo.skyframe.R;

/* Gli avvisi ad app chiusa: un lavoro periodico (WorkManager) e una sveglia all'ora dell'avviso riscaricano le nuvole da
   Open-Meteo, chiedono ad AlertsCore cosa dire e lo mostrano. Niente posizione: solo le coordinate del luogo attivo. */
public final class AlertsEngine {
    static final String TAG = "SkyframeAlerts", PREFS = "sf.alerts", CHANNEL = "sf_alerts";
    static final String WORK = "sf-alerts", WORK_NOW = "sf-alerts-now", OLD_WORK = "io.github.astropuzzo.skyframe.check";
    static final String ACTION_ALARM = "io.github.astropuzzo.skyframe.ALERTS_ALARM", EXTRA_NIGHT = "sf_night";

    private AlertsEngine() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static JSONObject json(SharedPreferences p, String key) {
        try { String s = p.getString(key, null); return s == null ? null : new JSONObject(s); } catch (Exception e) { return null; }
    }

    /* lavoro periodico e sveglia secondo la ricetta salvata; con gli avvisi spenti e nessun widget si toglie tutto */
    static void arm(Context ctx) {
        JSONObject cfg = json(prefs(ctx), "cfg");
        WorkManager wm = WorkManager.getInstance(ctx);
        wm.cancelUniqueWork(OLD_WORK); wm.cancelAllWorkByTag(OLD_WORK); // lo script delle versioni fino alla 0.30
        if (cfg == null || (!cfg.optBoolean("on") && NightWidget.count(ctx) == 0)) { wm.cancelUniqueWork(WORK); wm.cancelUniqueWork(WORK_NOW); setAlarm(ctx, 0); return; }
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(AlertsWorker.class, 30, TimeUnit.MINUTES).setConstraints(net).build();
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /* un controllo. why: "work", "alarm", "app", "boot", "widget"; fetch: 0 mai, 1 se la previsione è vecchia, 2 sempre.
       Con gli avvisi spenti gira lo stesso se sulla schermata Home c'è il widget: AlertsCore non manda niente, il widget si aggiorna. */
    static synchronized String run(Context ctx, String why, int fetch) {
        SharedPreferences p = prefs(ctx);
        long now = System.currentTimeMillis();
        String log;
        try {
            JSONObject cfg = json(p, "cfg");
            int widgets = NightWidget.count(ctx);
            if (cfg == null || (!cfg.optBoolean("on") && widgets == 0)) { setAlarm(ctx, 0); return "spenti"; }
            JSONObject st = json(p, "st"); if (st == null) st = new JSONObject();
            AlertsCore.Wx wx = AlertsCore.Wx.fromJson(st.optJSONObject("wx"));
            long maxAge = AlertsCore.maxAge(cfg, now);
            boolean old = maxAge != Long.MAX_VALUE && (wx == null || now - wx.at > maxAge);
            // prove automatiche: la previsione finta vale subito, anche se in memoria c'è quella vera di un minuto prima
            boolean mock = cfg.has("mock") && (ctx.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            if (fetch == 2 || (fetch == 1 && (old || mock))) {
                // sveglia e widget girano dentro un ricevitore, che ha pochi secondi: limite breve
                AlertsCore.Wx fresh = download(ctx, cfg, now, "alarm".equals(why) || "widget".equals(why) ? 3500 : 12000);
                if (fresh != null) { wx = fresh; st.put("wx", fresh.toJson()); st.put("ok", now); }
            }
            if (wx != null && now - wx.at > 6 * AlertsCore.HOUR) wx = null; // troppo vecchia per decidere
            AlertsCore.Out out = AlertsCore.decide(cfg, st, wx, now, activeIds(ctx));
            for (AlertsCore.Note n : out.post) show(ctx, cfg, n);
            // sveglia mancata per la rete: appena torna si riprova
            if (out.needWx && fetch > 0) WorkManager.getInstance(ctx).enqueueUniqueWork(WORK_NOW, ExistingWorkPolicy.KEEP,
                    new OneTimeWorkRequest.Builder(AlertsWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
            setAlarm(ctx, out.nextAlarm);
            log = out.log;
            st.put("run", now); st.put("why", why); st.put("log", log); st.put("next", out.nextAlarm);
            if (!"app".equals(why)) st.put("bg", now); // l'ultimo controllo fatto senza l'app: in Setup si vede se il telefono li lascia girare
            SharedPreferences.Editor ed = p.edit().putString("st", st.toString());
            if (widgets > 0) { String[] s = AlertsCore.summary(cfg, wx, now); ed.putString("widget", new JSONObject().put("t", s[0]).put("l", s[1]).put("at", now).toString()); }
            ed.commit(); // il widget rilegge subito
            if (widgets > 0) NightWidget.refresh(ctx);
        } catch (Exception e) {
            Log.e(TAG, "controllo non riuscito", e);
            log = "errore: " + e;
        }
        Log.d(TAG, why + ": " + log);
        return log;
    }

    /* prova da Setup: l'avviso com'è adesso */
    static String test(Context ctx) {
        try {
            SharedPreferences p = prefs(ctx);
            JSONObject cfg = json(p, "cfg"), st = json(p, "st");
            long now = System.currentTimeMillis();
            AlertsCore.Wx wx = cfg == null ? null : download(ctx, cfg, now, 8000);
            if (wx == null && st != null) wx = AlertsCore.Wx.fromJson(st.optJSONObject("wx"));
            AlertsCore.Note n = AlertsCore.test(cfg, wx, now);
            show(ctx, cfg, n);
            return n.title;
        } catch (Exception e) { Log.e(TAG, "prova non riuscita", e); return "errore: " + e; }
    }

    private static AlertsCore.Wx download(Context ctx, JSONObject cfg, long now, int timeoutMs) {
        // prove automatiche (solo nelle build di debug): una previsione finta al posto della rete
        if ((ctx.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 && cfg.has("mock")) {
            double f = cfg.optDouble("mock", 1); int n = 144; AlertsCore.Wx w = new AlertsCore.Wx();
            w.at = now; w.t0 = (now / 3600000L - 24) * 3600; w.clear = new double[n]; w.low = new double[n]; w.dew = new double[n]; w.gust = new double[n];
            for (int i = 0; i < n; i++) { w.clear[i] = f; w.low[i] = f; w.dew[i] = Double.NaN; w.gust[i] = Double.NaN; }
            return w;
        }
        HttpURLConnection c = null;
        try {
            JSONArray models = cfg.optJSONArray("models");
            StringBuilder m = new StringBuilder();
            if (models != null) for (int i = 0; i < models.length(); i++) { if (i > 0) m.append(','); m.append(models.optJSONArray(i).optString(0)); }
            String url = String.format(Locale.ROOT, "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f&past_days=1&forecast_days=3&timeformat=unixtime&timezone=GMT"
                    + "&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,temperature_2m,dew_point_2m,wind_gusts_10m%s",
                    cfg.optDouble("lat"), cfg.optDouble("lon"), m.length() > 0 ? "&models=" + m : "");
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(timeoutMs); c.setReadTimeout(timeoutMs);
            if (c.getResponseCode() != 200) return null;
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) { byte[] b = new byte[8192]; for (int k; (k = in.read(b)) > 0; ) buf.write(b, 0, k); }
            return AlertsCore.Wx.parse(new JSONObject(buf.toString("UTF-8")), models, now);
        } catch (Exception e) {
            Log.w(TAG, "meteo non scaricato: " + e);
            return null;
        } finally { if (c != null) c.disconnect(); }
    }

    private static Set<Integer> activeIds(Context ctx) {
        Set<Integer> ids = new HashSet<>();
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            for (StatusBarNotification s : nm.getActiveNotifications()) ids.add(s.getId());
        } catch (Exception e) { return null; }
        return ids;
    }

    static void channel(Context ctx, JSONObject cfg) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        JSONObject txt = cfg == null ? null : cfg.optJSONObject("txt");
        NotificationChannel ch = new NotificationChannel(CHANNEL, txt == null ? "Skyframe" : txt.optString("channel", "Skyframe"), NotificationManager.IMPORTANCE_DEFAULT);
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
    }

    private static void show(Context ctx, JSONObject cfg, AlertsCore.Note n) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) { Log.w(TAG, "notifiche non consentite"); return; }
        channel(ctx, cfg);
        Intent open = new Intent(ctx, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_NIGHT, n.ds);
        PendingIntent tap = PendingIntent.getActivity(ctx, n.id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_skyframe).setColor(0xFF4CCFBC)
                .setContentTitle(n.title).setContentText(n.body).setStyle(new NotificationCompat.BigTextStyle().bigText(n.body))
                .setContentIntent(tap).setAutoCancel(true).setWhen(System.currentTimeMillis())
                .setCategory(NotificationCompat.CATEGORY_EVENT).setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOnlyAlertOnce(n.quiet).setSilent(n.quiet);
        try { nm.notify(n.id, b.build()); } catch (SecurityException e) { Log.w(TAG, "notifica rifiutata: " + e); }
    }

    static boolean exactAllowed(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
    }

    /* una sola sveglia, la prossima; resiste alla pausa del telefono (Doze). at = 0 la toglie */
    static void setAlarm(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 7001, new Intent(ctx, AlertsReceiver.class).setAction(ACTION_ALARM), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (at <= 0) { am.cancel(pi); return; }
            at = Math.max(at, System.currentTimeMillis() + 5000);
            if (exactAllowed(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }
}
