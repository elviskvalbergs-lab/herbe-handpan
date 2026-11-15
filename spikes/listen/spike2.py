"""Second pass: once the key is known, detection prefers the key's chords
(and a found progression's chords). Tests the hard cases again."""
import sys, json
sys.argv = ['spike.py']
exec(open('spike.py').read().split("if __name__ == '__main__':")[0])

def diatonic_set(r, mode):
    out = set()
    for d, q in DIATONIC[mode]:
        out.add(((r + d) % 12, q))
    return out

def recognise_locked(x, allowed, boost=0.12, smooth=3, alpha=0.5):
    labels = []; run_lab, run_n, shown = None, 0, None; cs = None
    peak = max(1e-6, float(np.sqrt(np.mean(x ** 2))))
    for s, fr in frames(x):
        c, b, rms = chroma_frame(fr)
        if c is None or rms < 0.15 * peak: labels.append(shown); continue
        cs = c if cs is None else alpha * cs + (1 - alpha) * c
        cand = chord_candidates(cs / (np.linalg.norm(cs) + 1e-9), b)
        cand = [(sc + (boost if (r, FAMILY[t]) in allowed else 0), r, t) for sc, r, t in cand]
        cand.sort(reverse=True)
        lab = name(cand[0][1], cand[0][2])
        if lab == run_lab: run_n += 1
        else: run_lab, run_n = lab, 1
        if run_n >= smooth: shown = lab
        labels.append(shown)
    return labels

def roots_progression(seq):
    roots = []
    for c in seq:
        r = parse(c)[0]
        if not roots or roots[-1] != r: roots.append(r)
    p = progression([NAMES[r] for r in roots])
    return p

prog = {'Am': GUITAR['Am'], 'F': GUITAR['F'], 'C': GUITAR['C'], 'G': GUITAR['G']}
def build(order, reps, bpm, make, chords, snr=None, kind='pink', bleed=None):
    bar = 4 * 60 / bpm; seq = [c for _ in range(reps) for c in order]
    x = mix([(i * bar, make(chords[c], bar)) for i, c in enumerate(seq)], len(seq) * bar + 0.5)
    if bleed is not None: x = x + bleed(len(x))
    return add_noise(x, snr, kind)

def bleed(n, level=0.6):
    notes = [50, 57, 58, 60, 62, 64, 65, 67, 69]; parts = []; t = 0
    while t < n / SR - 1:
        parts.append((t, handpan_note(int(RNG.choice(notes)), 2.0))); t += 0.5
    return level * mix(parts, n / SR)[:n]

out = {}
cases = {
  'babble 10 dB': dict(snr=10, kind='babble'),
  'babble 5 dB': dict(snr=5, kind='babble'),
  'my handpan bleeding in (loud)': dict(bleed=lambda n: bleed(n, 0.6)),
  'my handpan bleeding in (quiet, phone nearer the guitar)': dict(bleed=lambda n: bleed(n, 0.25)),
}
for name_, kw in cases.items():
    x = build(['Am', 'F', 'C', 'G'], 4, 100, lambda m, d: strum(m, d), prog, **kw)
    free = recognise(x, smooth=3)[0]
    segs = segments(free); simp = simplify(segs)
    acc = np.zeros(12)
    for s, fr in frames(x):
        c, b, rms = chroma_frame(fr)
        if c is not None: acc += c
    k = key_from_chords(segments(free, True), acc)[0]
    locked = recognise_locked(x, diatonic_set(k[1], k[2]))
    lsegs = simplify(segments(locked))
    out[name_] = {'free': ' '.join(simp), 'free_prog': progression(simp), 'roots_prog': roots_progression(segs),
                  'key': f'{NAMES[k[1]]} {k[2]}', 'locked': ' '.join(lsegs), 'locked_prog': progression(lsegs)}
print(json.dumps(out, indent=1))
