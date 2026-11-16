# Listen spike (throwaway, not app code)

Measures chord, key, progression and single-note detection for the Listen
design (`docs/listen-mode.md`). Python 3 with numpy; nothing here is bundled
into the app.

- `python3 spike.py` — synthesised guitar, piano and handpan with noise;
  prints accuracy (the last run is in `results-synthetic.json`).
- `python3 spike2.py` — noisy songs and my own instrument bleeding in; key
  locking and roots-only loop detection.
- `python3 spike3.py` — following a locked loop with bleed.
- `python3 spike.py a.wav b.wav …` — real recordings (16-bit WAV; convert
  phone recordings with `ffmpeg -i in.m4a -ac 1 -ar 22050 out.wav`): prints
  the chords and key heard.
