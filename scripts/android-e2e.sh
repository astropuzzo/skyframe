#!/usr/bin/env bash
# Prova dell'APK su un emulatore già avviato (lo lancia .github/workflows/android-e2e.yml).
set -u
PKG=io.github.astropuzzo.skyframe
APK=android/app/build/outputs/apk/debug/app-debug.apk
mkdir -p e2e
adb wait-for-device
adb shell cmd alarm set-timezone Europe/Rome || true
adb shell settings put global package_verifier_enable 0 || true
adb shell settings put global hide_error_dialogs 1 || true   # niente finestre «... isn't responding» dell'emulatore sopra l'app
# al primo avvio l'emulatore aggiorna i servizi Google e chiude le app che usano la WebView: si aspetta che si calmi
sleep 60
adb install -r "$APK"
# permessi che un utente darebbe: notifiche e sveglie esatte (per l'avviso a orario)
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true
adb logcat -c || true
# animazioni del sistema accese (l'emulatore parte senza, e l'app le rispetta): l'avvio si filma come su un telefono vero
for k in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global $k 1 || true; done
adb shell screenrecord --time-limit 12 --bit-rate 12000000 /sdcard/avvio.mp4 &
REC=$!
sleep 1
adb shell am start -n $PKG/.MainActivity
wait $REC || true
adb pull /sdcard/avvio.mp4 e2e/avvio.mp4 || true
# fotogrammi dell'avvio (10 al secondo) da guardare uno per uno
if [ -s e2e/avvio.mp4 ] && command -v ffmpeg >/dev/null; then mkdir -p e2e/avvio && ffmpeg -loglevel error -i e2e/avvio.mp4 -vf "fps=10,scale=360:-1" e2e/avvio/f%03d.png || true; fi
sleep 8
node scripts/android-e2e.mjs
code=$?
adb logcat -d > e2e/logcat-all.txt || true
grep -iE "capacitor|runner|skyframe|chromium|console" e2e/logcat-all.txt > e2e/logcat.txt || true
adb shell dumpsys notification --noredact > e2e/notifications.txt || true
exit $code
