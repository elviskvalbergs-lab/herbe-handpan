#!/usr/bin/env python3
"""Puts the overview video together (the first cut of 19 Nov; the current script is docs/video-plan.md §4), 1920 x 1080.

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

v.still('o1', 4.5); v.still('o2', 4.5); v.still('o3', 5.0); v.still('o4', 5.5)

# 5: the chords recording in the phone, from a second before D minor is tapped.
p_ss = ph.t['D Minor'] - 1.0
phone_len = round(max(12.0, VO_LEAD + v.vo_len('o5') + VO_TAIL + 1.0), 2)
v.phone('seg_phone.mp4', [('scenes/o5.png', 0)], ph.video, p_ss - ph.first, phone_len, {'o5': VO_LEAD})

v.still('o6', 5.5, zoom=False)

# Sound: the app's own handpan. The scale under the opening, then chords, the
# recording's own sound under the phone, and F then C under the end card.
at, _ = v.starts()
v.clip(ph.audio, ph.sound('scale'), 7.0, 0.4, 0.55)                            # the scale: the sound you fell for
v.clip(ph.audio, ph.sound('A# Major'), 4.6, at['seg_o3.mp4'] + 0.4, 0.5)       # B flat: join in
v.clip(ph.audio, ph.sound('F Major'), 4.6, at['seg_o4.mp4'] + 0.6, 0.45)       # F: your instrument
v.clip(ph.audio, p_ss - ph.audio_offset, phone_len, at['seg_phone.mp4'], 1.0)
v.clip(ph.audio, ph.sound('F Major'), 9.5, at['seg_o6.mp4'] + 0.3, 0.55)       # F, then C: the ending resolves
v.finish()
