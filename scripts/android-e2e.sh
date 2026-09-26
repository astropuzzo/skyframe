#!/usr/bin/env bash
# Prova dell'APK su un emulatore già avviato (lo lancia .github/workflows/android-e2e.yml).
set -u
PKG=io.github.astropuzzo.skyframe
APK=android/app/build/outputs/apk/debug/app-debug.apk
mkdir -p e2e
adb wait-for-device
adb shell cmd alarm set-timezone Europe/Rome || true
adb shell settings put global package_verifier_enable 0 || true
# al primo avvio l'emulatore aggiorna i servizi Google e chiude le app che usano la WebView: si aspetta che si calmi
sleep 60
adb install -r "$APK"
# permessi che un utente darebbe: notifiche e sveglie esatte (per l'avviso a orario)
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true
adb logcat -c || true
adb shell am start -n $PKG/.MainActivity
sleep 20
node scripts/android-e2e.mjs
code=$?
adb logcat -d > e2e/logcat-all.txt || true
grep -iE "capacitor|runner|skyframe|chromium|console" e2e/logcat-all.txt > e2e/logcat.txt || true
adb shell dumpsys notification --noredact > e2e/notifications.txt || true
exit $code
