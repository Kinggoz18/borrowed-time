"""Turns the two licensed Pixabay tracks into the shipped, looping game music (docs/CREDITS.md).

   python tools/audio/build_music.py <day.mp3> <night.mp3>      # needs ffmpeg, numpy, scipy

The originals stay out of the repo. For each track this
  1. decodes to 44.1 kHz stereo and trims the leading/trailing silence,
  2. picks a loop of about 70-80 s from a steady stretch, bar-aligned to the estimated tempo,
     then searches +-0.7 s for the end point whose preceding bars best match the start's (so the beat does not slip),
  3. closes the seam with an equal-power crossfade of the tail into the audio that came just before the start,
  4. levels both tracks to the same loudness, fades the very ends by a few ms,
  5. encodes Ogg Vorbis (Android, desktop) and AAC in .m4a (iOS Safari) into public/audio/.
Run it again and the output is identical."""
import os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

SR = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "audio")
TARGET_RMS = 0.105                       # same loudness for both tracks (full-scale float RMS)
XFADE_S = 3.0                            # seam crossfade
# name -> (start hint s, loop length in bars, search window s)
SPEC = {"day": dict(start=14.0, bars=48, bitrate="56k"), "night": dict(start=18.0, bars=48, bitrate="56k")}


def decode(path):
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "2", "-ar", str(SR), tmp], check=True)
    sr, a = wavfile.read(tmp)
    os.unlink(tmp)
    return a.astype(np.float32) / 32768.0


def trim_silence(a, thr=0.004):
    m = np.abs(a).max(1)
    nz = np.nonzero(m > thr)[0]
    return a[nz[0]: nz[-1] + 1]


def tempo(mono):
    hop = 512
    fr = len(mono) // hop
    env = np.sqrt((mono[: fr * hop].reshape(fr, hop) ** 2).mean(1))
    on = np.maximum(0, np.diff(env))
    on -= on.mean()
    ac = np.correlate(on, on, "full")[len(on) - 1:]
    ac /= ac[0]
    lo, hi = int(60 / 200 * SR / hop), int(60 / 60 * SR / hop)
    k = lo + int(np.argmax(ac[lo:hi]))
    return k * hop / SR            # seconds per beat


def lowpass(mono):
    return sosfiltfilt(butter(4, 600, "low", fs=SR, output="sos"), mono)


def best_end(mono, a, nominal_b, win=0.7, ctx_s=3.0):
    """b near nominal_b where the ctx_s seconds before b look most like the ctx_s before a (normalised correlation of the low band)."""
    lp = lowpass(mono)
    c = int(ctx_s * SR)
    ref = lp[a - c: a]
    ref = ref - ref.mean()
    best, bb = -2, nominal_b
    step = int(0.002 * SR)
    for b in range(nominal_b - int(win * SR), nominal_b + int(win * SR), step):
        seg = lp[b - c: b]
        seg = seg - seg.mean()
        r = float((ref * seg).sum() / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
        if r > best:
            best, bb = r, b
    return bb, best


def make_loop(a, name):
    spec = SPEC[name]
    mono = a.mean(1)
    beat = tempo(mono)
    bar = beat * 4
    # an onset-ish start: the loudest 50 ms hop within 0.5 s after the hint
    s0 = int(spec["start"] * SR)
    env = np.abs(mono[s0: s0 + SR // 2])
    s0 += int(np.argmax(env))
    nominal = s0 + int(round(spec["bars"] * bar * SR))
    if nominal + 2 * SR > len(a):
        raise SystemExit(f"{name}: loop runs past the end of the track")
    b, r = best_end(mono, s0, nominal)
    loop = a[s0:b].copy()
    x = int(XFADE_S * SR)
    pre = a[s0 - x: s0]
    t = np.linspace(0, 1, x, dtype=np.float32)[:, None]
    fade_out, fade_in = np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)
    loop[-x:] = loop[-x:] * fade_out + pre * fade_in
    print(f"{name}: beat {beat:.3f}s ({60 / beat:.0f} bpm), loop {s0 / SR:.2f}s -> {b / SR:.2f}s = {len(loop) / SR:.1f}s, seam match {r:.2f}")
    return loop


def level(loop):
    rms = float(np.sqrt((loop ** 2).mean()))
    g = TARGET_RMS / max(rms, 1e-6)
    out = loop * g
    peak = float(np.abs(out).max())
    if peak > 0.95:
        out *= 0.95 / peak
    return out


def encode(loop, name, bitrate):
    os.makedirs(OUT, exist_ok=True)
    wav = tempfile.mktemp(suffix=".wav")
    wavfile.write(wav, SR, (np.clip(loop, -1, 1) * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-map_metadata", "-1", "-c:a", "libvorbis", "-b:a", bitrate, "-ar", "44100", os.path.join(OUT, f"{name}.ogg")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-map_metadata", "-1", "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-movflags", "+faststart", os.path.join(OUT, f"{name}.m4a")], check=True)
    os.unlink(wav)


if __name__ == "__main__":
    day_src, night_src = sys.argv[1:3]
    total = 0
    for name, src in (("day", day_src), ("night", night_src)):
        loop = level(make_loop(trim_silence(decode(src)), name))
        encode(loop, name, SPEC[name]["bitrate"])
        for ext in ("ogg", "m4a"):
            sz = os.path.getsize(os.path.join(OUT, f"{name}.{ext}"))
            total += sz
            print(f"  {name}.{ext}: {sz / 1024:.0f} KB")
    print(f"total {total / 1024 / 1024:.2f} MB")
