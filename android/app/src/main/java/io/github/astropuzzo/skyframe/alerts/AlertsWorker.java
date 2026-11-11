package io.github.astropuzzo.skyframe.alerts;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class AlertsWorker extends Worker {
    public AlertsWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

    @NonNull
    @Override
    public Result doWork() {
        AlertsEngine.run(getApplicationContext(), "work", 1);
        return Result.success();
    }
}
