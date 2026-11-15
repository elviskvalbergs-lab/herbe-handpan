import sys, json
exec(open('spike2.py').read().split("out = {}")[0])

def follow(x, cycle, smooth=2, alpha=0.5):
    """Only the progression's chords compete; the next chord in the cycle
    gets a small extra push. Returns the chord sequence followed."""
    chords = [parse(c) for c in cycle]
    labels = []; cs = None; cur = None; run = (None, 0)
    peak = max(1e-6, float(np.sqrt(np.mean(x ** 2))))
    for s, fr in frames(x):
        c, b, rms = chroma_frame(fr)
        if c is None or rms < 0.15 * peak: labels.append(cur); continue
        cs = c if cs is None else alpha * cs + (1 - alpha) * c
        v = cs / (np.linalg.norm(cs) + 1e-9)
        scores = []
        for i, (r, t) in enumerate(chords):
            tpl = next(tv for rr, tt, iv, tv in TPL if rr == r and tt == t)
            sc = float(v @ tpl)
            if cur is not None and i == (cur + 1) % len(chords): sc += 0.03
            if cur is not None and i == cur: sc += 0.02
            scores.append(sc)
        best = int(np.argmax(scores))
        run = (best, run[1] + 1) if run[0] == best else (best, 1)
        if run[1] >= smooth: cur = best
        labels.append(cur)
    names = [cycle[i] if i is not None else None for i in labels]
    return simplify(segments(names))

cyc = ['Am', 'F', 'C', 'G']
out = {}
for nm, kw in {'loud bleed': dict(bleed=lambda n: bleed(n, 0.6)), 'quiet bleed': dict(bleed=lambda n: bleed(n, 0.25)),
               'babble 5 dB + quiet bleed': dict(snr=5, kind='babble', bleed=lambda n: bleed(n, 0.25))}.items():
    x = build(cyc, 4, 100, lambda m, d: strum(m, d), prog, **kw)
    got = follow(x, cyc)
    want = cyc * 4
    # how many of the 16 bars came out right, in order
    import difflib
    sm = difflib.SequenceMatcher(None, got, want)
    out[nm] = {'followed': ' '.join(got), 'matching_chords': sum(b.size for b in sm.get_matching_blocks()), 'of': len(want)}
print(json.dumps(out, indent=1))
