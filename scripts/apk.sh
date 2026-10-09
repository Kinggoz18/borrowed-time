#!/usr/bin/env bash
# Builds a debug APK on a Mac (or Linux) with Android Studio installed.
#   bash scripts/apk.sh play   the playable game (npm run apk:play)
#   bash scripts/apk.sh gate   the Phase 0 stress scene for the device perf gate (npm run apk:gate)
# Then: adb install -r <apk>   (or drag the APK onto the phone and open it)
set -euo pipefail
cd "$(dirname "$0")/.."
kind="${1:-play}"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then echo "Node 22+ is needed for the Capacitor CLI (you have $(node -v))."; exit 1; fi
if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then export ANDROID_HOME="$HOME/Library/Android/sdk"; fi
[ -f node_modules/.bin/vite ] || npm ci
case "$kind" in
  play) npm run build ;;
  gate) npm run build:gate ;;
  *) echo "usage: scripts/apk.sh play|gate"; exit 2 ;;
esac
npx cap sync android
(cd android && ./gradlew assembleDebug)
src=android/app/build/outputs/apk/debug/app-debug.apk
out="borrowed-time-$kind.apk"
cp "$src" "$out"
echo "APK: $PWD/$out"
if command -v adb >/dev/null && adb get-state >/dev/null 2>&1; then
  adb install -r "$out" && echo "Installed on the connected phone."
else
  echo "To install: plug in the phone (USB debugging on) and run: adb install -r $out"
fi
