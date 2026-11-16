"""Throwaway spike for the listening feature: chord recognition from chroma,
key detection, progression detection and single-note pitch (YIN), measured
on synthesised guitar, piano and handpan with noise. Not app code.

Run: python3 -I spike.py [wav ...]   (wav files: real recordings to analyse)
"""
import sys, json, math, wave
import numpy as np

SR = 22050
RNG = np.random.default_rng(7)
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# ── Instruments ──────────────────────────────────────────────────────────────
_GCACHE = {}
def guitar_note(m, dur, sr=SR):
    """Karplus-Strong plucked string (cached per note and length)."""
    key = (m, round(dur, 3))
    if key in _GCACHE: return _GCACHE[key]
    _GCACHE[key] = _ks(m, dur, sr)
    return _GCACHE[key]

def _ks(m, dur, sr=SR):
    n = int(dur * sr); p = max(2, int(round(sr / hz(m))))
    buf = RNG.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out

def piano_note(m, dur, sr=SR):
    t = np.arange(int(dur * sr)) / sr; f0 = hz(m); B = 0.0004; y = np.zeros_like(t)
    for k in range(1, 12):
        fk = k * f0 * math.sqrt(1 + B * k * k)
        if fk > sr / 2: break
        y += (1.0 / k ** 1.1) * np.exp(-t * (1.2 + 0.6 * k)) * np.sin(2 * math.pi * fk * t + RNG.uniform(0, 6.28))
    return y * np.minimum(1, t / 0.004)

def handpan_note(m, dur, sr=SR):
    """Fundamental, octave and compound fifth (the tuned partials of a handpan)."""
    t = np.arange(int(dur * sr)) / sr; f0 = hz(m)
    y = (1.0 * np.exp(-t * 0.9) * np.sin(2 * math.pi * f0 * t) +
         0.55 * np.exp(-t * 1.6) * np.sin(2 * math.pi * 2 * f0 * t) +
         0.25 * np.exp(-t * 2.4) * np.sin(2 * math.pi * 3 * f0 * t))
    return y * np.minimum(1, t / 0.008)

def mix(parts, total):
    out = np.zeros(int(total * SR))
    for start, sig in parts:
        s = int(start * SR); e = min(len(out), s + len(sig)); out[s:e] += sig[:e - s]
    return out / (np.max(np.abs(out)) + 1e-9)

def strum(midis, dur, spread=0.025):
    return mix([(i * spread, guitar_note(m, dur)) for i, m in enumerate(sorted(midis))], dur)

def block(midis, dur, fn=piano_note):
    return mix([(0, fn(m, dur)) for m in midis], dur)

def arpeggio(midis, dur, fn=handpan_note, step=0.25):
    seq = sorted(midis); parts = []; t = 0
    while t < dur - 0.1:
        for m in seq:
            if t >= dur - 0.1: break
            parts.append((t, fn(m, 2.0))); t += step
    return mix(parts, dur)

def pink(n):
    w = RNG.standard_normal(n); f = np.fft.rfft(w); k = np.arange(len(f)); k[0] = 1
    return np.fft.irfft(f / np.sqrt(k), n)

def babble(n):
    """Crowd-ish noise: several random sliding harmonic voices + pink noise."""
    t = np.arange(n) / SR; y = 0.3 * pink(n) / np.std(pink(n))
    for _ in range(6):
        f = 120 + 120 * RNG.random() + 30 * np.sin(2 * math.pi * RNG.uniform(0.5, 3) * t)
        ph = 2 * math.pi * np.cumsum(f) / SR
        y += sum(np.sin(k * ph) / k for k in range(1, 6)) * (0.5 + 0.5 * np.sin(2 * math.pi * RNG.uniform(1, 4) * t))
    return y

def add_noise(x, snr_db, kind='pink'):
    if snr_db is None: return x
    nz = pink(len(x)) if kind == 'pink' else babble(len(x))
    nz = nz / (np.std(nz) + 1e-12) * np.std(x) / (10 ** (snr_db / 20))
    return x + nz

# ── Detection ────────────────────────────────────────────────────────────────
FFT, HOP = 8192, 2048
FREQS = np.fft.rfftfreq(FFT, 1 / SR)
BAND = (FREQS > 55) & (FREQS < 2000)
PITCH = 69 + 12 * np.log2(np.maximum(FREQS, 1) / 440)
PCBIN = np.round(PITCH).astype(int) % 12
WIN = np.hanning(FFT)

def frames(x):
    for s in range(0, max(1, len(x) - FFT), HOP):
        yield s, x[s:s + FFT]

def chroma_frame(fr):
    """Chroma from spectral peaks that stand clear of the noise floor (a
    running median of the spectrum, ×3 in amplitude), each weighted by how far
    above it is. A peak at 3, 5, 6 or 7 times a stronger lower peak is
    mostly its overtone (a fifth, a third, a seventh) and counts for little.
    Plus a bass chroma from below 260 Hz to help with the root."""
    mag = np.abs(np.fft.rfft(fr * WIN))
    rms = float(np.sqrt(np.mean(fr ** 2)))
    if mag[BAND].max() < 1e-6: return None, None, rms
    k = 31
    pad = np.pad(mag, k // 2, mode='edge')
    floor = np.median(np.lib.stride_tricks.sliding_window_view(pad, k), axis=1)[:len(mag)] + 1e-9
    snr = mag / floor
    pk = (mag > np.roll(mag, 1)) & (mag >= np.roll(mag, -1)) & BAND & (snr > 3)
    idx = np.where(pk)[0]
    if len(idx) == 0: return None, None, rms
    w = np.log1p(snr[idx] - 3)
    w = w * (mag[idx] / mag[idx].max()) ** 0.5
    f = FREQS[idx]
    order = np.argsort(-w)
    keep = np.ones(len(idx))
    for j in range(len(idx)):
        for i in order:
            if i == j or f[i] >= f[j] or w[i] < w[j] * 0.7: continue
            r = f[j] / f[i]; kk = round(r)
            if kk in (3, 5, 6, 7) and abs(r - kk) < 0.03 * kk: keep[j] = 0.25; break
    w = w * keep
    c = np.zeros(12); bass = np.zeros(12)
    np.add.at(c, PCBIN[idx], w)
    lo = f < 260
    np.add.at(bass, PCBIN[idx][lo], w[lo])
    if c.max() <= 0: return None, None, rms
    return c / (np.linalg.norm(c) + 1e-9), (bass / (np.linalg.norm(bass) + 1e-9) if bass.max() > 0 else None), rms

TYPES = {  # the shortlist from the brief; app's CHORD_TYPES ids
    'maj': [0, 4, 7], 'min': [0, 3, 7], 'dom7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11],
    'min7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'dim': [0, 3, 6],
}
SUFFIX = {'maj': '', 'min': 'm', 'dom7': '7', 'maj7': 'maj7', 'min7': 'm7', 'sus2': 'sus2', 'sus4': 'sus4', 'dim': 'dim'}
PRIOR = {'maj': 0.04, 'min': 0.04, 'dom7': 0.0, 'maj7': 0.0, 'min7': 0.0, 'sus2': -0.02, 'sus4': -0.02, 'dim': -0.03}

def templates():
    out = []
    for r in range(12):
        for t, iv in TYPES.items():
            v = np.full(12, -0.25)
            for d in iv: v[(r + d) % 12] = 1.0
            out.append((r, t, iv, v / np.linalg.norm(v)))
    return out
TPL = templates()

def chord_candidates(c, bass):
    """Score per template (chord tones +, other notes −), a little help from
    the bass note, small priors (plain triads first). A seventh only counts
    when its note is clearly there (≥ 45% of the triad's average)."""
    res = []
    bpc = int(np.argmax(bass)) if bass is not None and bass.max() > 0.5 else None
    for r, t, iv, v in TPL:
        s = float(c @ v) + PRIOR[t] + (0.08 if bpc == r else 0)
        if len(iv) == 4:
            triad = np.mean([c[(r + d) % 12] for d in iv[:3]])
            if c[(r + iv[3]) % 12] < 0.45 * triad: s -= 0.2
        res.append((s, r, t))
    res.sort(reverse=True)
    return res

def name(r, t): return NAMES[r] + SUFFIX[t]

def recognise(x, smooth=4, alpha=0.5):
    """Chroma smoothed over frames (≈0.4 s), best chord per frame, then a
    stable label: shown once it wins `smooth` frames in a row; a quiet or
    noise-only frame keeps the last one."""
    labels, confs, raw = [], [], []
    run_lab, run_n, shown = None, 0, None
    cs = None; peak = max(1e-6, float(np.sqrt(np.mean(x ** 2))))
    for s, fr in frames(x):
        c, b, rms = chroma_frame(fr)
        if c is None or rms < 0.15 * peak:
            raw.append(None); labels.append(shown); confs.append(0); continue
        cs = c if cs is None else alpha * cs + (1 - alpha) * c
        cand = chord_candidates(cs / (np.linalg.norm(cs) + 1e-9), b)
        best, second = cand[0], cand[1]
        lab = name(best[1], best[2])
        raw.append(lab)
        if lab == run_lab: run_n += 1
        else: run_lab, run_n = lab, 1
        if run_n >= smooth: shown = lab
        labels.append(shown); confs.append(best[0] - second[0])
    return labels, confs, raw

def chord_of(x, smooth=4):
    labels, confs, raw = recognise(x, smooth)
    stable = [l for l in labels if l]
    if not stable: return None, None
    vals, counts = np.unique(stable, return_counts=True)
    first = next((i for i, l in enumerate(labels) if l), None)
    return vals[np.argmax(counts)], (first * HOP / SR if first is not None else None)

# Key from the chords heard: each key scores the time its diatonic chords
# take (tonic chord counts double); Krumhansl profiles on the chroma break ties.
DIATONIC = {'major': [(0, 'maj'), (2, 'min'), (4, 'min'), (5, 'maj'), (7, 'maj'), (9, 'min'), (11, 'dim')],
            'minor': [(0, 'min'), (2, 'dim'), (3, 'maj'), (5, 'min'), (7, 'min'), (8, 'maj'), (10, 'maj'), (7, 'maj')]}
FAMILY = {'maj': 'maj', 'dom7': 'maj', 'maj7': 'maj', 'min': 'min', 'min7': 'min', 'dim': 'dim', 'sus2': None, 'sus4': None}
KK_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

def parse(lab):
    root = lab[:2] if len(lab) > 1 and lab[1] in '#b' else lab[:1]
    r = NAMES.index(root) if root in NAMES else {'Db': 1, 'D#': 3, 'G#': 8, 'A#': 10, 'Gb': 6}[root]
    suf = lab[len(root):]
    t = next(k for k, v in SUFFIX.items() if v == suf)
    return r, t

def key_from_chords(seq_with_len, chroma_sum=None):
    res = []
    for r in range(12):
        for mode in ('major', 'minor'):
            sc = 0; tot = 0
            for lab, n in seq_with_len:
                cr, ct = parse(lab); fam = FAMILY[ct]; tot += n
                for d, q in DIATONIC[mode]:
                    if (r + d) % 12 == cr and (fam is None or fam == q):
                        sc += n * (2 if d == 0 else 1); break
            # ties: relative major/minor share chords; the first and last chord lean to the tonic
            if seq_with_len:
                for lab in (seq_with_len[0][0], seq_with_len[-1][0]):
                    cr, ct = parse(lab)
                    if cr == r and FAMILY[ct] == ('maj' if mode == 'major' else 'min'): sc += 0.5 * tot / len(seq_with_len)
            prof = KK_MAJ if mode == 'major' else KK_MIN
            kk = float(np.corrcoef(chroma_sum, np.roll(prof, r))[0, 1]) if chroma_sum is not None else 0
            res.append((sc / max(tot, 1) + 0.05 * kk, r, mode))
    res.sort(reverse=True)
    return res

def key_of(chroma_sum):
    res = []
    for r in range(12):
        for mode, prof in (('major', KK_MAJ), ('minor', KK_MIN)):
            res.append((float(np.corrcoef(chroma_sum, np.roll(prof, r))[0, 1]), r, mode))
    res.sort(reverse=True)
    return res

def segments(labels, with_len=False):
    seg = []
    for l in labels:
        if l and (not seg or seg[-1][0] != l): seg.append([l, 1])
        elif l: seg[-1][1] += 1
    seg = [s for s in seg if s[1] >= 2]
    return [(s[0], s[1]) for s in seg] if with_len else [s[0] for s in seg]

def simple(lab):
    """For progressions: a chord's plain triad (Am7 → Am, Cmaj7 → C)."""
    r, t = parse(lab)
    return NAMES[r] + {'maj': '', 'dom7': '', 'maj7': '', 'min': 'm', 'min7': 'm', 'dim': 'dim', 'sus2': 'sus2', 'sus4': 'sus4'}[t]

def simplify(seq):
    out = []
    for c in seq:
        c = simple(c)
        if not out or out[-1] != c: out.append(c)
    return out

def progression(seq):
    """Shortest cycle that explains the chord sequence (≥ 2 repeats), from
    any starting point, allowing a few misreadings (≥ 75% of chords fit)."""
    best = None
    for p in range(2, len(seq) // 2 + 1):
        for off in range(p):
            cyc = seq[off:off + p]
            if len(cyc) < p: continue
            hits = sum(1 for i, c in enumerate(seq) if c == cyc[(i - off) % p])
            if hits / len(seq) >= 0.75 and (best is None or hits / len(seq) > best[0] + 0.05):
                best = (hits / len(seq), cyc)
        if best: return best[1]
    return None

# ── YIN (same method as js/tuner.js) ─────────────────────────────────────────
def yin(buf, sr=SR, thr=0.15, fmin=70, fmax=1500):
    n = len(buf) // 2; tmin, tmax = int(sr / fmax), min(n - 1, int(sr / fmin))
    d = np.array([np.sum((buf[:n] - buf[t:t + n]) ** 2) for t in range(tmax + 1)])
    cm = np.ones_like(d); run = np.cumsum(d[1:]); cm[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(run, 1e-12)
    for t in range(tmin, tmax):
        if cm[t] < thr:
            while t + 1 < tmax and cm[t + 1] < cm[t]: t += 1
            a, b, c = cm[t - 1], cm[t], cm[t + 1]; den = a - 2 * b + c
            tt = t + (0.5 * (a - c) / den if den else 0)
            return sr / tt, 1 - b
    return None, 0

# ── Tests ────────────────────────────────────────────────────────────────────
GUITAR = {  # common open voicings (MIDI)
    'C': [48, 52, 55, 60, 64], 'G': [43, 47, 50, 55, 59, 67], 'Am': [45, 52, 57, 60, 64], 'F': [41, 48, 53, 57, 60, 65],
    'D': [50, 57, 62, 66], 'Em': [40, 47, 52, 55, 59, 64], 'E': [40, 47, 52, 56, 59, 64], 'Dm': [50, 57, 62, 65],
    'A7': [45, 52, 55, 61, 64], 'Dm7': [50, 57, 60, 65], 'Cmaj7': [48, 52, 55, 59, 64], 'G7': [43, 47, 50, 55, 59, 65],
    'Gsus4': [43, 50, 55, 60, 67], 'Dsus2': [50, 57, 62, 64], 'Bdim': [47, 50, 53, 59],
    'Am7': [45, 52, 55, 60, 64], 'E7': [40, 47, 50, 56, 59, 64], 'Fmaj7': [41, 48, 52, 57, 60],
}
PIANO = {
    'C': [48, 60, 64, 67], 'Am': [45, 57, 60, 64], 'F': [41, 57, 60, 65], 'G': [43, 59, 62, 67], 'Dm': [50, 62, 65, 69],
    'E7': [40, 56, 59, 62, 64], 'Cmaj7': [48, 59, 64, 67], 'Dm7': [50, 60, 65, 69], 'Bb': [46, 58, 62, 65],
    'Gsus4': [43, 60, 62, 67], 'F#dim': [42, 57, 60, 66], 'C/E': [52, 60, 64, 67],
}
HANDPAN = {  # D Kurd 9 chords, notes as played on the pan
    'Dm': [50, 57, 62, 65, 69], 'F': [53 + 12, 57, 60, 69], 'C': [60, 64, 67], 'Gm': [55 + 12, 58, 62], 'Bb': [58, 62, 65],
    'Am': [57, 60, 64, 69], 'Dm7': [50, 57, 60, 65], 'Fmaj7': [57, 60, 64, 65], 'Csus2': [60, 62, 67], 'Asus4': [57, 62, 64],
}
EXPECT_ALIAS = {'C/E': 'C'}

def root_of(lab): return lab[:2] if len(lab) > 1 and lab[1] in '#b' else lab[:1]

def run_set(label, chords, make, snrs, kinds=('pink',)):
    rows = []
    clean = {want: make(midis) for want, midis in chords.items()}
    for kind in kinds:
        for snr in snrs:
            if snr is None and kind != kinds[0]: continue
            ok = root_ok = n = 0; lat = []; misses = []
            for want, midis in chords.items():
                x = add_noise(clean[want], snr, kind)
                got, t = chord_of(x)
                want2 = EXPECT_ALIAS.get(want, want)
                n += 1
                if got == want2: ok += 1
                else: misses.append(f'{want2}→{got}')
                if got and root_of(got) == root_of(want2): root_ok += 1
                if t is not None: lat.append(t)
            rows.append({'set': label, 'noise': kind if snr is not None else 'none', 'snr_db': snr,
                         'exact': f'{ok}/{n}', 'pct': round(100 * ok / n), 'root_pct': round(100 * root_ok / n),
                         'latency_s': round(float(np.median(lat)), 2) if lat else None, 'misses': misses})
    return rows

def song_test(make, chords, order, reps, bpm, snr=None, kind='pink', bleed=None):
    beat = 60 / bpm; bar = 4 * beat
    seq = [c for _ in range(reps) for c in order]
    parts = [(i * bar, make(chords[c], bar)) for i, c in enumerate(seq)]
    x = mix(parts, len(seq) * bar + 0.5)
    if bleed is not None: x = x + bleed(len(x))
    x = add_noise(x, snr, kind)
    labels, confs, raw = recognise(x, smooth=3)
    segs = segments(labels)
    acc = np.zeros(12)
    for s, fr in frames(x):
        c, b, rms = chroma_frame(fr)
        if c is not None: acc += c
    keys = key_from_chords(segments(labels, True), acc)
    simp = simplify(segs)
    return {'detected': ' '.join(segs), 'simple': ' '.join(simp), 'progression': progression(simp), 'key': f'{NAMES[keys[0][1]]} {keys[0][2]}',
            'key2': f'{NAMES[keys[1][1]]} {keys[1][2]}', 'key_margin': round(keys[0][0] - keys[1][0], 3)}

def melody_test(fn, notes, snr=None):
    ok = 0; errs = []
    for m in notes:
        x = add_noise(fn(m, 0.6), snr)
        buf = x[int(0.1 * SR):int(0.1 * SR) + 2048]
        f, conf = yin(buf)
        got = round(69 + 12 * math.log2(f / 440)) if f else None
        if got == m: ok += 1
        else: errs.append(f'{m}→{got}')
    return {'pct': round(100 * ok / len(notes)), 'n': len(notes), 'errors': errs}

def read_wav(path):
    with wave.open(path) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(float) / 32768
        if ch > 1: x = x.reshape(-1, ch).mean(1)
    if sr != SR:
        t = np.arange(int(len(x) * SR / sr)) * sr / SR
        x = np.interp(t, np.arange(len(x)), x)
    return x

if __name__ == '__main__':
    if len(sys.argv) > 1:
        for p in sys.argv[1:]:
            x = read_wav(p); labels, confs, raw = recognise(x, smooth=3)
            acc = np.zeros(12)
            for s, fr in frames(x):
                c, b, rms = chroma_frame(fr)
                if c is not None: acc += c
            k = key_of(acc)[0]
            print(json.dumps({'file': p, 'chords': segments(labels), 'key': f'{NAMES[k[1]]} {k[2]}'}))
        sys.exit()
    out = {}
    out['guitar'] = run_set('guitar strum', GUITAR, lambda m: strum(m, 2.0), [None, 20, 10, 5], kinds=('pink', 'babble'))
    out['piano'] = run_set('piano', PIANO, lambda m: block(m, 2.0, piano_note), [None, 20, 10, 5], kinds=('pink', 'babble'))
    out['handpan'] = run_set('handpan arpeggio', HANDPAN, lambda m: arpeggio(m, 2.5), [None, 20, 10, 5], kinds=('pink', 'babble'))
    out['handpan_block'] = run_set('handpan struck together', HANDPAN, lambda m: block(m, 2.0, handpan_note), [None, 10])
    songs = {}
    prog = {'Am': GUITAR['Am'], 'F': GUITAR['F'], 'C': GUITAR['C'], 'G': GUITAR['G']}
    songs['guitar Am F C G x4, 100 bpm'] = song_test(lambda m, d: strum(m, d), prog, ['Am', 'F', 'C', 'G'], 4, 100)
    songs['same, babble 10 dB'] = song_test(lambda m, d: strum(m, d), prog, ['Am', 'F', 'C', 'G'], 4, 100, snr=10, kind='babble')
    songs['same, 2 chords a bar (fast changes)'] = song_test(lambda m, d: strum(m, d), prog, ['Am', 'F', 'C', 'G'], 4, 200)
    # my own handpan (D Kurd notes, random) bleeding into the mic while the friend strums
    def bleed(n):
        notes = [50, 57, 58, 60, 62, 64, 65, 67, 69]; parts = []; t = 0
        while t < n / SR - 1:
            parts.append((t, handpan_note(int(RNG.choice(notes)), 2.0))); t += 0.5
        return 0.6 * mix(parts, n / SR)[:n]
    songs['same, my handpan bleeding in'] = song_test(lambda m, d: strum(m, d), prog, ['Am', 'F', 'C', 'G'], 4, 100, bleed=bleed)
    pianoprog = {'C': PIANO['C'], 'G': PIANO['G'], 'Am': PIANO['Am'], 'F': PIANO['F']}
    songs['piano C G Am F x3, 90 bpm'] = song_test(lambda m, d: block(m, d, piano_note), pianoprog, ['C', 'G', 'Am', 'F'], 3, 90)
    kurd = {'Dm': HANDPAN['Dm'], 'Bb': HANDPAN['Bb'], 'F': HANDPAN['F'], 'C': HANDPAN['C']}
    songs['handpan Dm Bb F C x3 (arpeggiated), 80 bpm'] = song_test(lambda m, d: arpeggio(m, d), kurd, ['Dm', 'Bb', 'F', 'C'], 3, 80)
    out['songs'] = songs
    mel = list(range(50, 80, 2))
    out['melody'] = {
        'guitar': melody_test(guitar_note, mel), 'piano': melody_test(piano_note, mel), 'handpan': melody_test(handpan_note, mel),
        'guitar, pink 10 dB': melody_test(guitar_note, mel, 10), 'handpan, pink 10 dB': melody_test(handpan_note, mel, 10),
    }
    print(json.dumps(out, indent=1))
