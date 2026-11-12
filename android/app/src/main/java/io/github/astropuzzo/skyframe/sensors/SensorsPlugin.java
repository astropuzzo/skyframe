package io.github.astropuzzo.skyframe.sensors;

import android.content.Context;
import android.graphics.Rect;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Size;
import android.util.SizeF;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Per la misura dell'orizzonte: la declinazione magnetica del luogo (modello mondiale di Android), quanto è calibrato
   il magnetometro, e focale e sensore delle fotocamere (da lì il campo inquadrato, per disegnare sull'immagine). L'orientamento del telefono lo legge la pagina (DeviceOrientation). Finché la misura è
   aperta lo schermo resta acceso: si guarda il profilo degli ostacoli, non si tocca il telefono. */
@CapacitorPlugin(name = "SkyframeSensors")
public class SensorsPlugin extends Plugin implements SensorEventListener {
    private SensorManager sm;
    private boolean on;
    private int level = -1;

    /* gradi da aggiungere all'azimut magnetico per avere quello vero (est positivo) */
    @PluginMethod
    public void declination(PluginCall call) {
        Double lat = call.getDouble("lat"), lon = call.getDouble("lon");
        if (lat == null || lon == null) { call.reject("lat, lon"); return; }
        GeomagneticField f = new GeomagneticField(lat.floatValue(), lon.floatValue(), 0f, System.currentTimeMillis());
        JSObject r = new JSObject();
        r.put("deg", (double) f.getDeclination());
        call.resolve(r);
    }

    /* Le fotocamere: posizione nell'elenco di Android (index), focale e lati del sensore in millimetri, quanta parte del
       sensore lavora (use). Sono dati del telefono: non serve il permesso della fotocamera. */
    @PluginMethod
    public void cameras(PluginCall call) {
        JSArray list = new JSArray();
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            String[] ids = cm.getCameraIdList();
            for (int i = 0; i < ids.length; i++) {
                String id = ids[i];
                CameraCharacteristics c = cm.getCameraCharacteristics(id);
                float[] focal = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
                SizeF mm = c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
                if (focal == null || focal.length == 0 || mm == null) continue;
                Integer facing = c.get(CameraCharacteristics.LENS_FACING);
                Size px = c.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE);
                Rect active = c.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("index", i);
                o.put("back", facing != null && facing == CameraCharacteristics.LENS_FACING_BACK);
                o.put("focal", (double) focal[0]);
                o.put("w", (double) mm.getWidth());
                o.put("h", (double) mm.getHeight());
                if (px != null && active != null && px.getWidth() > 0 && px.getHeight() > 0)
                    o.put("use", (double) Math.max(active.width(), active.height()) / Math.max(px.getWidth(), px.getHeight()));
                list.put(o);
            }
        } catch (Exception e) { /* senza questi dati vale il campo tipico */ }
        JSObject r = new JSObject();
        r.put("list", list);
        call.resolve(r);
    }

    /* da qui arriva l'evento «accuracy» a ogni cambio: 0 inaffidabile, 1 bassa, 2 media, 3 alta */
    @PluginMethod
    public void start(PluginCall call) {
        try {
            if (sm == null) sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            Sensor mag = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (mag != null && !on) on = sm.registerListener(this, mag, SensorManager.SENSOR_DELAY_UI);
        } catch (Exception e) { /* senza magnetometro la misura va avanti allineando al Sole o alla Luna */ }
        screenOn(true);
        JSObject r = new JSObject();
        r.put("on", on);
        r.put("level", level);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) { off(); call.resolve(); }

    private void off() {
        if (on && sm != null) sm.unregisterListener(this);
        on = false;
        screenOn(false);
    }

    private void screenOn(boolean keep) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            try {
                if (keep) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } catch (Exception e) { /* finestra già chiusa */ }
        });
    }

    @Override
    protected void handleOnPause() { off(); super.handleOnPause(); }

    @Override
    protected void handleOnDestroy() { off(); super.handleOnDestroy(); }

    @Override
    public void onSensorChanged(SensorEvent e) { report(e.accuracy); }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { report(accuracy); }

    private void report(int a) {
        if (a == level) return;
        level = a;
        JSObject d = new JSObject();
        d.put("level", a);
        notifyListeners("accuracy", d);
    }
}
