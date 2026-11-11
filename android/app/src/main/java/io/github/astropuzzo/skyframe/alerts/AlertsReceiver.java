package io.github.astropuzzo.skyframe.alerts;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/* La sveglia dell'avviso; e dopo un riavvio, un aggiornamento dell'app o un cambio d'ora si rimette tutto in programma. */
public class AlertsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context ctx = context.getApplicationContext();
        final boolean alarm = AlertsEngine.ACTION_ALARM.equals(intent.getAction());
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (!alarm) AlertsEngine.arm(ctx);
                // la sveglia ha pochi secondi: scarica con un limite breve, altrimenti decide con l'ultima previsione
                AlertsEngine.run(ctx, alarm ? "alarm" : "boot", alarm ? 2 : 0);
            } finally { pending.finish(); }
        }).start();
    }
}
