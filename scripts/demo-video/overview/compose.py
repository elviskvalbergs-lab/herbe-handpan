#!/usr/bin/env python3
"""Puts the overview video together, "What can your instrument play?"
(docs/video-plan.md §4), 1920 x 1080.

  python3 guitar.py          # the stand-in guitar for the Listen scene (guitar.wav)
  node record.js             # the four phone recordings, rec/o2 … rec/o5
  node ../record.js          # the D Kurd scale and chords for scene 1 and the end card (shared with the makers video)
  node scenes.js             # the still scenes
  python3 ../voiceover.py    # the voice-over from lines.py, vo/*.wav (Kokoro, free)
  python3 compose.py         # -> oakhum-overview.mp4
  python3 compose.py vo-elevenlabs   # the final voice -> oakhum-overview-elevenlabs.mp4
  node scenes.js 9x16 && python3 compose.py vo-elevenlabs 9x16   # the 9:16 cut -> oakhum-overview-9x16-elevenlabs.mp4

Shared parts in ../videokit.py. Output stays in this folder, uncommitted.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.chdir(HERE)
from videokit import Video, Phone, VO_LEAD

args = sys.argv[1:]
fmt = '9x16' if '9x16' in args else '16x9'
vo_dir = next((a for a in args if a != '9x16'), 'vo')
v = Video('oakhum-overview', vo_dir, fmt)
base = Phone()                    # ../record.js: the D Kurd scale, and F then C for the end card
rec = {k: Phone(os.path.join(HERE, 'rec', k)) for k in ('o2', 'o3', 'o4', 'o5')}

# Where each phone scene starts in its recording, and how long it is at least.
START = {
    'o2': ('tap', -1.2, 7.0),         # the tiles, then "Let's find out which handpan you have"
    'o3': ('D Minor', -0.6, 8.0),     # D Minor, Bb Major, F Major lit and ringing
    'o4': ('play', -0.4, 8.0),        # Ode to Joy on the kalimba, with the tab
    'o5': ('listen', -0.6, 7.0),      # Listen: the guitar's D minor, then B flat
}

v.still('o1', 4.0)
for k, (name, offset, least) in START.items():
    dur = v.fit(k, least)
    v.phone(v.seg(k), [(v.scene(k), 0)], rec[k].video, rec[k].at(name, offset), dur, {k: VO_LEAD})
v.still('o6', 6.0, zoom=False)

# Sound: the app's own instruments under the whole video, with no gaps
# (videokit.bed): the D Kurd scale under the hook, each recording's own sound
# under its scene, the guitar where Listen starts hearing it, F then C at the end.
at, _ = v.starts()
def scene_sound(k):
    """A phone scene's recording, from the moment the scene starts."""
    name, offset, _ = START[k]
    return rec[k].t[name] + offset - rec[k].audio_offset
o5_listen = at[v.seg('o5')] - START['o5'][1] + 0.15   # the microphone starts just after the tap on Listen
v.bed([
    (base.audio, base.sound('scale'), 0.0, 0.8),                    # the D Kurd scale: "its own notes"
    (rec['o3'].audio, scene_sound('o3'), at[v.seg('o3')], 1.0),    # the three chords
    (rec['o4'].audio, scene_sound('o4'), at[v.seg('o4')], 1.0),    # the melody on the kalimba
    ('guitar.wav', 0.0, o5_listen, 0.9),                            # the friend's guitar
    (base.audio, base.sound('F Major'), at[v.seg('o6')] - 0.8, 0.55),  # F, then C: the ending resolves
])
v.finish()
