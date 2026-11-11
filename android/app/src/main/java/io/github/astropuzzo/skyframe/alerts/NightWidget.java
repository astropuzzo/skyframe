package io.github.astropuzzo.skyframe.alerts;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

import io.github.astropuzzo.skyframe.MainActivity;
import io.github.astropuzzo.skyframe.R;

/* Widget «Stanotte» della schermata Home: due righe scritte da AlertsEngine a ogni controllo, anche ad app chiusa
   e ad avvisi spenti. Toccato, apre l'app. */
public class NightWidget extends AppWidgetProvider {

    static int count(Context ctx) {
        try { return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, NightWidget.class)).length; } catch (Exception e) { return 0; }
    }

    /* ridisegna tutti i widget con l'ultimo testo salvato */
    static void refresh(Context ctx) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            int[] ids = m.getAppWidgetIds(new ComponentName(ctx, NightWidget.class));
            if (ids.length == 0) return;
            JSONObject w = AlertsEngine.json(AlertsEngine.prefs(ctx), "widget");
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_night);
            if (w != null && !w.optString("t").isEmpty()) { v.setTextViewText(R.id.w_title, w.optString("t")); v.setTextViewText(R.id.w_line, w.optString("l")); }
            Intent open = new Intent(ctx, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 7002, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            m.updateAppWidget(ids, v);
        } catch (Exception e) { android.util.Log.w(AlertsEngine.TAG, "widget non aggiornato: " + e); }
    }

    /* aggiunto, tolto o da ridisegnare: subito l'ultimo testo, poi un controllo vero in un altro thread */
    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        final Context ctx = context.getApplicationContext();
        refresh(ctx);
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try { AlertsEngine.arm(ctx); AlertsEngine.run(ctx, "widget", 1); } finally { pending.finish(); }
        }).start();
    }
}
