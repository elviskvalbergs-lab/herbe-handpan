#!/usr/bin/env python3
"""Puts the makers video together (docs/video-script-makers.md), 1920 x 1080.

  node ../record.js          # the buyer's phone: D Kurd chords, with sound
  node record-shop.js        # the website's playable handpan, with sound
  node scenes.js             # the still scenes, the QR card
  python3 ../voiceover.py    # the voice-over from lines.py, vo/*.wav (see its notes)
  python3 compose.py         # -> oakhum-makers.mp4
  python3 compose.py vo-elevenlabs   # another take of the voice -> oakhum-makers-elevenlabs.mp4

The shared parts (scenes with a slow zoom, the phone frame, the voice fitted
to the scenes, the sound) are in ../videokit.py. Output stays in this folder,
uncommitted.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.chdir(HERE)
from videokit import Video, Phone, run, FPS, VO_LEAD, VO_TAIL

v = Video('oakhum-makers', sys.argv[1] if len(sys.argv) > 1 else 'vo')
ph = Phone()

for name, dur in [('s1', 5.0), ('s2', 5.0), ('s3', 5.5), ('s4', 5.5), ('s5a', 5.5), ('s5b', 5.5)]:
    v.still(name, dur)  # s5a, s5b: the QR code, then the NFC tag

# 6–7: the phone recording inside the phone, starting a second before D minor
# is tapped. The words change from scene 6 to 7 once the scene-6 line is said.
switch = max(6.0, VO_LEAD + v.vo_len('s6') + 0.6) if 's6' in v.vo else 6.0
phone_len = max(20.0, switch + 0.4 + v.vo_len('s7') + VO_TAIL) if 's7' in v.vo else 20.0
p_ss = ph.t['D Minor'] - 1.0
v.phone('seg_phone.mp4', [('scenes/s6.png', 0), ('scenes/s7.png', switch)], ph.video, p_ss - ph.first, phone_len,
        {'s6': VO_LEAD, 's7': switch + 0.4})

# 8: the website (record-shop.js) in a browser-like frame.
stl = json.load(open('shop/timeline.json'))
SHOP_SS, shop_len = 0.8, v.fit('shop', 12.0)
run(['-f', 'concat', '-safe', '0', '-i', 'shop/frames.ffconcat', '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-crf', '18', 'shop/screen.mp4'])
run(['-loop', '1', '-i', 'scenes/s8.png', '-ss', str(SHOP_SS), '-t', str(shop_len), '-i', 'shop/screen.mp4', '-filter_complex',
     f"[1:v]scale=1536:864[sh];[0:v][sh]overlay=192:196:shortest=1,format=yuv420p,{v._fades(shop_len)}",
     '-t', str(shop_len), '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', 'seg_shop.mp4'])
v.add('seg_shop.mp4', shop_len, {'shop': VO_LEAD})

v.still('s9', 5.5, zoom=False)

# Sound: the app's own handpan. Its scale and chords under the stills, then
# each recording's own sound under its scene.
at, _ = v.starts()
v.clip(ph.audio, ph.sound('scale'), 7.0, 0.6, 0.55)                                # the scale, under the workshop
v.clip(ph.audio, ph.sound('D Minor'), 4.6, at['seg_s3.mp4'] + 0.6, 0.5)            # D minor, "keep playing"
v.clip(ph.audio, ph.sound('F Major'), 4.6, at['seg_s5a.mp4'] + 0.8, 0.45)          # F major, the QR card
v.clip(ph.audio, ph.sound('A# Major'), 4.6, at['seg_s5b.mp4'] + 0.5, 0.45)         # B flat major, the NFC tag
v.clip(ph.audio, p_ss - ph.audio_offset, phone_len, at['seg_phone.mp4'], 1.0)
v.clip('shop/audio.webm', 0.0, shop_len, at['seg_shop.mp4'] + max(0.0, stl['audioOffset'] - SHOP_SS), 1.0)
v.clip(ph.audio, ph.sound('F Major'), 9.5, at['seg_s9.mp4'] + 0.3, 0.55)          # F, then C: the ending resolves
v.finish()
