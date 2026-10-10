# Credits

## Music

Both tracks are from [Pixabay](https://pixabay.com/music/) and used under the Pixabay Content License. Credit is not required by the licence; it is given here and in the game (Settings > Credits) because the artists made the mood of the game.

| Used for | Track | Artist | Source |
| --- | --- | --- | --- |
| Daytime (menus, morning to dusk) | "Music 1" | Music by Ribhav Agrawal from Pixabay | Pixabay |
| Night (dusk, raids, the night) | "Music 2" | Music by Bryan Jesus De Los Santos Breton from Pixabay | Pixabay |

(The owner supplied the files as "Music 1" and "Music 2" without titles. Replace the titles here and in `src/ui/credits.ts` if you want the originals.)

How it ships: `tools/audio/build_music.py` trims the silence, cuts a loop of 65-83 s from a steady stretch, closes the seam with a 3 s equal-power crossfade, levels both tracks to about -17 LUFS and encodes `public/audio/{day,night}.ogg` (Vorbis, Android and desktop) and `.m4a` (AAC, iOS Safari), 56 kbps, 1.8 MB for all four files. The original MP3s are not in the repository. The game crossfades between the two over 4 s at dusk and dawn.

## Everything else

Art, portraits, the interface and the sound effects were made for this project (procedural pixel art, generated puppets, Web Audio cues).
