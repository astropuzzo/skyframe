package io.github.astropuzzo.skyframe.alerts;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/* Il ponte fra l'app e gli avvisi nativi: riceve la ricetta delle notti, dice come stanno le cose, apre le impostazioni. */
@CapacitorPlugin(name = "SkyframeAlerts", permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "display") })
public class AlertsPlugin extends Plugin {
    private String openNight = null;

    @Override
    public void load() { readIntent(getActivity() == null ? null : getActivity().getIntent()); }

    @Override
    protected void handleOnNewIntent(Intent intent) { super.handleOnNewIntent(intent); readIntent(intent); }

    /* l'avviso toccato porta la notte a cui si riferisce */
    private void readIntent(Intent i) {
        if (i == null || !i.hasExtra(AlertsEngine.EXTRA_NIGHT)) return;
        openNight = i.getStringExtra(AlertsEngine.EXTRA_NIGHT);
        i.removeExtra(AlertsEngine.EXTRA_NIGHT);
        JSObject d = new JSObject(); d.put("night", openNight);
        notifyListeners("open", d, true);
    }

    @PluginMethod
    public void consumeOpen(PluginCall call) {
        JSObject r = new JSObject(); r.put("night", openNight == null ? "" : openNight); openNight = null; call.resolve(r);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        JSObject cfg = call.getObject("cfg");
        AlertsEngine.prefs(ctx).edit().putString("cfg", cfg == null ? "{}" : cfg.toString()).apply();
        new Thread(() -> {
            AlertsEngine.arm(ctx);
            if (cfg != null && cfg.optBoolean("on")) AlertsEngine.channel(ctx, cfg);
            AlertsEngine.run(ctx, "app", 1); // ad avvisi spenti serve solo al widget, se c'è
            call.resolve();
        }).start();
    }

    @PluginMethod
    public void run(PluginCall call) {
        final Context ctx = getContext().getApplicationContext();
        final boolean test = Boolean.TRUE.equals(call.getBoolean("test", false));
        new Thread(() -> {
            JSObject r = new JSObject();
            r.put("out", test ? AlertsEngine.test(ctx) : AlertsEngine.run(ctx, "app", 2));
            call.resolve(r);
        }).start();
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSONObject st = AlertsEngine.json(AlertsEngine.prefs(ctx), "st");
        JSObject r = new JSObject();
        r.put("run", st == null ? 0 : st.optLong("run"));
        r.put("ok", st == null ? 0 : st.optLong("ok"));
        r.put("bg", st == null ? 0 : st.optLong("bg"));
        r.put("why", st == null ? "" : st.optString("why"));
        r.put("log", st == null ? "" : st.optString("log"));
        r.put("next", st == null ? 0 : st.optLong("next"));
        r.put("enabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        r.put("exact", AlertsEngine.exactAllowed(ctx));
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        r.put("widgets", NightWidget.count(ctx));
        r.put("canPin", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(ctx).isRequestPinAppWidgetSupported());
        call.resolve(r);
    }

    /* chiede alla schermata Home di aggiungere il widget «Stanotte» (Android 8+; conferma chi usa il telefono) */
    @PluginMethod
    public void pinWidget(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        boolean asked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            if (m.isRequestPinAppWidgetSupported()) asked = m.requestPinAppWidget(new ComponentName(ctx, NightWidget.class), null, null);
        }
        r.put("asked", asked);
        call.resolve(r);
    }

    @PluginMethod
    public void permission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("display") != PermissionState.GRANTED) {
            requestPermissionForAlias("display", call, "permissionDone");
            return;
        }
        permissionDone(call);
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        JSObject r = new JSObject(); r.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled()); call.resolve(r);
    }

    /* which: "exact" sveglie e promemoria, "battery" uso della batteria, "notify" notifiche dell'app */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        String which = call.getString("which", "notify"), pkg = ctx.getPackageName();
        Intent i;
        if ("exact".equals(which) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + pkg));
        else if ("battery".equals(which)) i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
        else i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        try { ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (Exception e) { try { ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { /* nessuna schermata adatta */ } }
        call.resolve();
    }
}
