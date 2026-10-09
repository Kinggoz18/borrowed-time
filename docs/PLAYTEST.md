# Phase 1 playtest (on the phone, held sideways)

## Build and install the APK (Mac)
1. Install Node 22+ (`brew install node`) and Android Studio; open Android Studio once so it downloads the Android SDK.
2. Phone: Settings → About phone → tap *Build number* 7 times → Developer options → *USB debugging* on. Plug in by USB and accept the prompt.
3. In the repo: `npm ci`, then `npm run apk:play`. It builds the game, runs `cap sync android` and Gradle, writes `borrowed-time-play.apk`, and installs it with `adb` if the phone is connected. No cable: send the APK to the phone and open it (allow installing unknown apps).
4. `npm run apk:gate` builds the Phase 0 stress-scene APK the same way; perf/stress testing is paused, so skip it for now.

## Checklist
Play from a fresh install, phone held sideways (the app is landscape only). For each item note pass/fail and one line on how it felt.

1. **First minute:** the home screen, then "We're starving. Borrow 10 Hours?" Borrow. The light bar grows and the debt chip says Owed with an hourglass icon and the word.
2. **Coach:** Build pulses; the tip says Palisade, then Field. Build both. The ring of stakes appears, the field lands on a lot, the camera stays close enough to see them.
3. **Read the island:** without zooming, tell a Cottage (tent/hut with smoke), Clockworks (gear), Hourglass (brass sign), Watchtower (red pennant) and Field apart. Pinch out to see the whole island, pinch in, drag to pan.
4. **Tap a lot:** empty lot opens "Build here"; a building opens its sheet with Upgrade. The sheet slides in from the right and leaves the island visible.
5. **Hesper:** tap her tent or the Hesper button. Borrow shows today's extra light and tomorrow's shorter day. Repay all; the chip turns Safe with a tick and the word.
6. **Dusk:** the dusk card fits the screen with all buttons visible. The hint line (skiffs/longboats, light/even/heavy) makes sense. Pick each of Hold / Walls / Borrow the dusk once over a few nights.
7. **Debt you can see:** borrow a lot. Grey land appears; buildings on it are still recognisable. Near the limit the chip says "Near limit" and pulses.
8. **Seizure:** go over the limit at night. Hesper takes a building ("Gently, as always."), the debt drops, the game continues.
9. **To Village:** build food and homes, level up and reach the charter (star chip). The Village card plays, the ring grows to 11×11 and the look changes.
10. **Resume and settings:** mid-day, swipe the app away and reopen; Continue puts you at the same hour. In settings, sound and vibration toggles work, and text is readable at arm's length everywhere.
