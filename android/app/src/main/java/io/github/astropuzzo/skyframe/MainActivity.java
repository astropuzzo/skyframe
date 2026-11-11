package io.github.astropuzzo.skyframe;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import io.github.astropuzzo.skyframe.alerts.AlertsPlugin;
import io.github.astropuzzo.skyframe.sensors.SensorsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlertsPlugin.class);
        registerPlugin(SensorsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
