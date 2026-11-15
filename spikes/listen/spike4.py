"""Recorded music: chords + bass + drums + a 'voice' melody, as from a
speaker. Free detection, roots-only loop, key, and longer smoothing."""
import sys, json
exec(open('spike2.py').read().split("out = {}")[0])

def drums(n, bpm):
    beat = 60 / bpm; y = np.zeros(n); t = 0; i = 0
    while t * SR < n - SR:
        s = int(t * SR)
        L = int(0.15 * SR); env = np.exp(-np.arange(L) / (0.03 * SR))
        if i % 2 == 0:  # kick: low sine sweep
            f = 60 * np.exp(-np.arange(L) / (0.05 * SR)) + 40
            y[s:s + L] += 1.2 * env * np.sin(2 * np.pi * np.cumsum(f) / SR)
        else:           # snare: noise burst
            y[s:s + L] += 0.7 * env * RNG.standard_normal(L)
        hh = int(0.03 * SR)  # hi-hat on every eighth
        for h in (0, 0.5):
            hs = int((t + h * beat) * SR); y[hs:hs + hh] += 0.2 * RNG.standard_normal(hh) * np.exp(-np.arange(hh) / (0.005 * SR))
        t += beat; i += 1
    return y

def voice(m, dur):
    tt = np.arange(int(dur * SR)) / SR; f = hz(m) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(k * ph) * (1 / k) * (1.5 if 2 <= k <= 4 else 1) for k in range(1, 9))
    return y * np.minimum(1, tt / 0.05) * np.minimum(1, (dur - tt) / 0.05)

def band(order, reps, bpm, melody_off=False, mix_levels=(1, 0.8, 0.6, 0.7)):
    bar = 4 * 60 / bpm; seq = [c for _ in range(reps) for c in order]
    total = len(seq) * bar + 0.5; n = int(total * SR)
    chords = mix([(i * bar, strum(prog[c], bar)) for i, c in enumerate(seq)], total)
    root = {'Am': 45, 'F': 41, 'C': 48, 'G': 43}
    bass = mix([(i * bar + k * bar / 2, piano_note(root[c] - 12 + 12, bar / 2)) for i, c in enumerate(seq) for k in range(2)], total)
    # a tune over it: chord tones and passing notes, quarter notes
    tune = {'Am': [69, 72, 71, 69], 'F': [69, 65, 67, 69], 'C': [67, 64, 62, 64], 'G': [67, 71, 74, 72]}
    mel = mix([(i * bar + k * bar / 4, voice(tune[c][k], bar / 4 * 0.9)) for i, c in enumerate(seq) for k in range(4)], total)
    d = drums(n, bpm)
    a, b, c_, dd = mix_levels
    y = a * chords + b * bass[:n] + (0 if melody_off else c_) * mel[:n] + dd * d / (np.max(np.abs(d)) + 1e-9)
    return y / np.max(np.abs(y))

out = {}
for nm, kw, sp in [('band: chords + bass + drums + voice', {}, None), ('same, through a phone speaker (pink 10 dB)', {}, 10),
                   ('band, loud drums and voice', dict(mix_levels=(0.6, 0.8, 1.0, 1.2)), None)]:
    x = band(['Am', 'F', 'C', 'G'], 4, 100, **kw)
    if sp: x = add_noise(x, sp)
    for smooth, alpha in [(3, 0.5), (6, 0.8)]:
        labels = recognise(x, smooth=smooth, alpha=alpha)[0]
        segs = segments(labels); simp = simplify(segs)
        acc = np.zeros(12)
        for s, fr in frames(x):
            c, b, rms = chroma_frame(fr)
            if c is not None: acc += c
        k = key_from_chords(segments(labels, True), acc)[0]
        locked = simplify(segments(recognise_locked(x, diatonic_set(k[1], k[2]), smooth=smooth, alpha=alpha)))
        out[f'{nm} · smoothing {"long" if smooth > 3 else "short"}'] = {
            'chords': ' '.join(simp), 'loop': progression(simp), 'roots_loop': roots_progression(segs),
            'key': f'{NAMES[k[1]]} {k[2]}', 'key_locked_chords': ' '.join(locked), 'key_locked_loop': progression(locked)}
print(json.dumps(out, indent=1))
