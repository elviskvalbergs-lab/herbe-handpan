#!/usr/bin/env python3
"""Puts the overview video together (docs/video-plan.md §1), 1920 x 1080.

  node ../record.js          # the phone: D Kurd chords, with sound (shared with the makers video)
  node scenes.js             # the still scenes
  python3 ../voiceover.py    # the voice-over from lines.py, vo/*.wav (Kokoro, free)
  python3 compose.py         # -> oakhum-overview.mp4
  python3 compose.py vo-elevenlabs   # the final voice -> oakhum-overview-elevenlabs.mp4

Shared parts in ../videokit.py. Output stays in this folder, uncommitted.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.chdir(HERE)
from videokit import Video, Phone, VO_LEAD, VO_TAIL

v = Video('oakhum-overview', sys.argv[1] if len(sys.argv) > 1 else 'vo')
ph = Phone()

v.still('o1', 5.0)

# 2–3: the chords recording in the phone, from a second before D minor is
# tapped; the words change from scene 2 to 3 once the scene-2 line is said.
p_ss = ph.t['D Minor'] - 1.0
switch = round(max(5.0, VO_LEAD + v.vo_len('o2') + 0.6), 2)
phone_len = round(max(11.0, switch + 0.4 + v.vo_len('o3') + VO_TAIL), 2)
v.phone('seg_phone.mp4', [('scenes/o2.png', 0), ('scenes/o3.png', switch)], ph.video, p_ss - ph.first, phone_len,
        {'o2': VO_LEAD, 'o3': switch + 0.4})

v.still('o4', 5.5); v.still('o5', 6.0); v.still('o6', 5.5, zoom=False)

# Sound: the app's own handpan under the whole video, with no gaps: each part
# rings on past the change of scene and fades while the next comes in
# (videokit.bed). The scale under the opening, the recording's own chords under
# the phone, the recording's B flat, F and C under the stills, F then C at the end. Each still's chord
# strikes LEAD_IN before its scene, so the sound carries across the change
# instead of dying away just before it.
LEAD_IN = 0.8
at, _ = v.starts()
v.bed([
    (ph.audio, ph.sound('scale'), 0.4, 0.55),                           # the scale: music is everywhere
    (ph.audio, p_ss - ph.audio_offset, at['seg_phone.mp4'], 1.0),       # the chords in the phone
    (ph.audio, ph.sound('A# Major'), at['seg_o4.mp4'] - LEAD_IN, 0.45), # B flat, F, C: a chord every 5 s under 4 and 5
    (ph.audio, ph.sound('F Major'), at['seg_o6.mp4'] - LEAD_IN, 0.55),  # F, then C: the ending resolves
])
v.finish()
