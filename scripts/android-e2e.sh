#!/usr/bin/env bash
# Prova dell'APK su un emulatore già avviato (lo lancia .github/workflows/android-e2e.yml).
set -u
PKG=io.github.astropuzzo.skyframe
APK=android/app/build/outputs/apk/debug/app-debug.apk
# il tentativo di prima resta in e2e/primo-tentativo: serve a capire perché è fallito
rm -rf e2e-prima; [ -d e2e ] && mv e2e e2e-prima; mkdir -p e2e; [ -d e2e-prima ] && mv e2e-prima e2e/primo-tentativo
# L'emulatore dei runner ogni tanto sparisce senza dire niente: memoria e carico della macchina ogni 10 secondi, per
# distinguere la memoria finita (il sistema lo chiude) da un suo crash
{ nproc; grep -m1 'model name' /proc/cpuinfo; free -m; df -h / | tail -1; } > e2e/macchina.txt 2>&1 || true
( while sleep 10; do echo "$(date -u +%T) $(free -m | awk '/Mem:/{print "usata " $3 " MB, disponibile " $7 " MB"}'), emulatore $(ps -o rss= -p "$(pgrep -f qemu-system | head -1)" 2>/dev/null | awk '{print int($1/1024)}') MB, carico $(cut -d' ' -f1 /proc/loadavg)"; done > e2e/memoria.txt 2>/dev/null ) &
MEM=$!
adb wait-for-device
adb shell cmd alarm set-timezone Europe/Rome || true
adb shell settings put global package_verifier_enable 0 || true
adb shell settings put global hide_error_dialogs 1 || true   # niente finestre «... isn't responding» dell'emulatore sopra l'app
# al primo avvio l'emulatore aggiorna i servizi Google e chiude le app che usano la WebView: si aspetta che si calmi
sleep 60
adb install -r "$APK"
# permessi che un utente darebbe: notifiche e sveglie esatte (per l'avviso a orario)
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell pm grant $PKG android.permission.CAMERA || true   # il mirino della misura dell'orizzonte
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true
adb logcat -c || true
# il log si salva mentre la prova gira: se l'emulatore sparisce, alla fine non si può più chiedere
adb logcat -v threadtime > e2e/logcat-live.txt 2>/dev/null &
LOGCAT=$!
# animazioni del sistema accese (l'emulatore parte senza, e l'app le rispetta): l'avvio si filma come su un telefono vero
for k in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global $k 1 || true; done
adb shell screenrecord --time-limit 12 --bit-rate 12000000 /sdcard/avvio.mp4 &
REC=$!
sleep 1
adb shell am start -n $PKG/.MainActivity
wait $REC || true
adb pull /sdcard/avvio.mp4 e2e/avvio.mp4 || true
# filmato fatto, animazioni di nuovo spente: col disegno software dell'emulatore l'app andrebbe a 3 fotogrammi al secondo
# per tutta la prova, e sotto quel carico l'emulatore ogni tanto si blocca (resta acceso ma non risponde più)
for k in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global $k 0 || true; done
# fotogrammi dell'avvio (10 al secondo) da guardare uno per uno
if [ -s e2e/avvio.mp4 ] && command -v ffmpeg >/dev/null; then mkdir -p e2e/avvio && ffmpeg -loglevel error -i e2e/avvio.mp4 -vf "fps=10,scale=360:-1" e2e/avvio/f%03d.png || true; fi
sleep 8
node scripts/android-e2e.mjs
code=$?
kill $LOGCAT $MEM 2>/dev/null || true
{ echo '--- fine'; free -m; uptime; sudo dmesg -T | grep -iE 'oom|out of memory|killed process|qemu|segfault|kvm' | tail -40; } >> e2e/macchina.txt 2>&1 || true
# se l'emulatore è sparito questi comandi resterebbero in attesa fino al limite del job
timeout 60 adb logcat -d > e2e/logcat-all.txt || true
[ -s e2e/logcat-all.txt ] || cp e2e/logcat-live.txt e2e/logcat-all.txt 2>/dev/null || true
[ "$code" -eq 4 ] && touch e2e/emulatore-sparito
grep -iE "capacitor|skyframe|chromium|console|WM-|AlarmManager" e2e/logcat-all.txt > e2e/logcat.txt || true
timeout 30 adb shell dumpsys notification --noredact > e2e/notifications.txt || true
exit $code
