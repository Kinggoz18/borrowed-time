# Phase 0: device test (your steps)

The stress scene is built. It has not yet run on a phone. This page shows you how to build the test APK on your Mac, run it on the two phones and send the results back.

**Phones:** a cheap or mid phone (3–4 GB RAM, Mali-G52/G57 or Adreno 610/618 class, Android 11+) and your own phone.

## 1. One-time setup on the Mac
1. Install **Android Studio** (it brings the Android SDK and Java). Open it once so it can finish downloading the SDK.
2. Use **Node 22 or newer** (`node -v`).
3. On each phone, turn on **Developer options → USB debugging**, then plug it in and accept the prompt.

## 2. Build and install the APK
```bash
cd borrowed-time
git pull
npm ci
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run apk:gate          # builds the test web app (HUD on), syncs it and builds the debug APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
- `apk:gate` uses the `gate` build, which keeps the performance panel. The normal `npm run build` leaves it out.
- If Gradle says it can't find the SDK, create `android/local.properties` with `sdk.dir=/Users/<you>/Library/Android/sdk`. Don't commit it.
- Debug builds are signed with Android's own debug key. No signing keys are in the repo.

## 3. Runs to do on each phone
Close other apps, set the brightness to about half, and leave the phone unplugged. Each run starts from the panel at the top left. Tier and mode buttons restart the scene.

| # | Run | How | Time |
|---|---|---|---|
| 1 | Startup | Swipe the app away. Start a screen recording, tap the icon, and stop when the island moves. Note the panel's "start" time too. | 3 times |
| 2 | Typical | **Auto**, **Loop**. Let one full day and night pass (2 min). Tap **Save CSV**. | 2 min |
| 3 | Worst load | **Auto**, **Worst** (night raid, fire, max particles, zooming). Tap **Save CSV**. | 2 min |
| 4 | Thermals | **Auto**, **10-min check**. Don't touch the phone. When the panel says "Done", tap **Save CSV**. | 10 min |
| 5 | Cheap phone only | If Auto didn't pick **Low**, repeat runs 2–3 on **Low**. | 4 min |
| 6 | Optional | Repeat run 3 with **Crowd** off (see the results doc: the 1,600-figure crowd is heavier than the shipped design). | 2 min |
| 7 | Recording | A 30-second screen recording of run 3. | |

Thermal state, from the Mac while run 4 is going (optional but useful):
```bash
adb shell dumpsys thermalservice | grep -i "status"     # before, and again at minute 10
adb shell dumpsys meminfo com.stardustcrusaders.borrowedtime | grep -iE "graphics|gl mtrack|egl"   # real GPU memory
```

## 4. Send the results back
- **Save CSV** opens the share sheet. Send each file to yourself (email, Drive or WhatsApp) and drop them in the chat with the screen recordings.
- File names look like `bt-phase0-low-worst-20261012-1830.csv`. The top lines hold the phone's GPU, the tier, startup and a pass/fail line per check; then one row per second.
- Please tell me which phone each file came from.

## 5. Pass or fail (FINAL_PLAN_BT.md §5)
| Check | Pass | Where to read it |
|---|---|---|
| Typical frame rate | 60 fps through the day/night loop | Run 2: `fpsMedian` (58+ counts as 60) |
| Worst load | Never below a steady 30 fps; the 1-second average stays at 30 or more | Run 3 and 4: `fpsWorstSecond` |
| Startup | Under about 3 s from tap to a moving scene, behind the splash | Run 1: the recording (the panel only times the web part) |
| Thermals | Minute 10 within 10% of minute 1, and no throttled state | Run 4: `minuteFps`, `gate_thermals`, `dumpsys thermalservice` |
| Texture memory | 128 MB or less on high, 80 MB or less on low | `texMBMax` (an estimate) and `dumpsys meminfo` |

**Decision rule:** fail = report to the owner with the numbers and options; the owner decides. Nothing switches engine, and no game code is written, until the owner has decided.
