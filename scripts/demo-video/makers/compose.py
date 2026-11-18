#!/usr/bin/env python3
"""Puts the makers video together (docs/video-script-makers.md), 1920 x 1080.

  node ../record.js          # the buyer's phone: D Kurd chords, with sound
  node record-shop.js        # the website's playable handpan, with sound
  node scenes.js             # the still scenes, the QR card
  python3 compose.py         # -> oakhum-makers.mp4

Version 1 has no voice-over yet: the captions carry the script, and the sound
is the app's own handpan. Output stays in this folder, uncommitted.
"""
import json, os, subprocess
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
PARENT = os.path.dirname(HERE)
CREAM = '0xF2E6D3'
FPS = 30

def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)

def mark(tl, prefix):
    return next(m['t'] for m in tl['marks'] if m['name'].startswith(prefix) or prefix in m['name'])

# The phone recording (../record.js) and where its chords are.
ptl = json.load(open(os.path.join(PARENT, 'timeline.json')))
p_first, p_audio = mark(ptl, 'firstFrame'), ptl['audioOffset']
p_dm, p_scale, p_f = mark(ptl, 'D Minor'), mark(ptl, 'scale'), mark(ptl, 'F Major')
PHONE_LEN = 20.0
p_ss = p_dm - 1.0  # start one second before D minor is tapped (recording clock)

# The website recording (record-shop.js).
stl = json.load(open('shop/timeline.json'))
SHOP_SS, SHOP_LEN = 0.8, 12.0
run(['-f', 'concat', '-safe', '0', '-i', 'shop/frames.ffconcat', '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-crf', '18', 'shop/screen.mp4'])

# Rounded mask for the phone screen (420 x 909, radius 44).
mask = Image.new('L', (420, 909), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 419, 908), radius=44, fill=255)
mask.save('scenes/phone-mask.png')

segs = []  # (file, duration)
def still(name, dur, zoom=True):
    out = f'seg_{name}.mp4'
    z = f"zoompan=z='1+0.035*on/({dur}*{FPS})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(dur*FPS)}:s=1920x1080:fps={FPS}," if zoom else ''
    run(['-loop', '1', '-t', str(dur), '-i', f'scenes/{name}.png', '-vf',
         f"scale=3840:-1,{z}format=yuv420p,fade=t=in:st=0:d=0.45:color={CREAM},fade=t=out:st={dur-0.45}:d=0.45:color={CREAM}",
         '-r', str(FPS), '-t', str(dur), '-c:v', 'libx264', '-crf', '18', out])
    segs.append((out, dur))

still('s1', 5.0); still('s2', 5.0); still('s3', 5.5); still('s4', 5.5)
still('s5a', 5.5); still('s5b', 5.5); still('s5c', 6.5)  # the QR code and the NFC tag, in more detail

# 6–7: the phone recording inside the phone, the words change after 6 s.
run(['-loop', '1', '-i', 'scenes/s6.png', '-loop', '1', '-i', 'scenes/s7.png',
     '-ss', f'{p_ss - p_first:.3f}', '-t', str(PHONE_LEN), '-i', os.path.join(PARENT, 'screen.mp4'),
     '-loop', '1', '-i', 'scenes/phone-mask.png', '-filter_complex',
     f"[2:v]scale=420:909,format=rgba[ph];[3:v]format=gray,scale=420:909[m];[ph][m]alphamerge[phm];"
     f"[0:v][1:v]overlay=enable='gte(t,6)'[bg];[bg][phm]overlay=1200:82:shortest=1,format=yuv420p,"
     f"fade=t=in:st=0:d=0.45:color={CREAM},fade=t=out:st={PHONE_LEN-0.45}:d=0.45:color={CREAM}",
     '-t', str(PHONE_LEN), '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', 'seg_phone.mp4'])
segs.append(('seg_phone.mp4', PHONE_LEN))

# 8: the website in a browser-like frame.
run(['-loop', '1', '-i', 'scenes/s8.png', '-ss', str(SHOP_SS), '-t', str(SHOP_LEN), '-i', 'shop/screen.mp4', '-filter_complex',
     f"[1:v]scale=1536:864[sh];[0:v][sh]overlay=192:196:shortest=1,format=yuv420p,"
     f"fade=t=in:st=0:d=0.45:color={CREAM},fade=t=out:st={SHOP_LEN-0.45}:d=0.45:color={CREAM}",
     '-t', str(SHOP_LEN), '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', 'seg_shop.mp4'])
segs.append(('seg_shop.mp4', SHOP_LEN))

still('s9', 5.5, zoom=False)

with open('segments.txt', 'w') as f:
    for s, _ in segs: f.write(f"file '{s}'\n")
starts, t = {}, 0.0
for s, d in segs: starts[s] = t; t += d
total = t

# Sound: the app's own handpan. Its scale and a few chords under the opening,
# then each recording's own sound under its scene.
def clip(src, start, dur, at, vol):
    return (src, start, dur, at, vol)
phone_audio = os.path.join(PARENT, 'audio.webm')
clips = [
    clip(phone_audio, p_scale - p_audio, 7.0, 0.6, 0.55),          # the scale, under "you put weeks…"
    clip(phone_audio, p_dm - p_audio, 4.6, starts['seg_s3.mp4'] + 0.6, 0.5),  # D minor, "keep playing"
    clip(phone_audio, p_f - p_audio, 4.6, starts['seg_s5a.mp4'] + 0.8, 0.45),  # F major, the QR card
    clip(phone_audio, p_scale - p_audio, 6.5, starts['seg_s5c.mp4'] + 0.3, 0.35),  # the scale, softly, under the steel tip
    clip(phone_audio, p_ss - p_audio, PHONE_LEN, starts['seg_phone.mp4'], 1.0),
    clip('shop/audio.webm', 0.0, SHOP_LEN, starts['seg_shop.mp4'] + max(0.0, stl['audioOffset'] - SHOP_SS), 1.0),
]
args, parts = [], []
for i, (src, ss, dur, at, vol) in enumerate(clips):
    args += ['-ss', f'{max(0, ss):.3f}', '-t', f'{dur:.3f}', '-i', src]
    ms = int(at * 1000)
    parts.append(f"[{i}:a]volume={vol},afade=t=in:d=0.05,afade=t=out:st={dur-0.6:.2f}:d=0.6,adelay={ms}|{ms}[a{i}]")
mix = ''.join(f'[a{i}]' for i in range(len(clips)))
run([*args, '-filter_complex', ';'.join(parts) + f";{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{total},afade=t=out:st={total-1.5}:d=1.5[a]",
     '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', 'audio.m4a'])

run(['-f', 'concat', '-safe', '0', '-i', 'segments.txt', '-i', 'audio.m4a', '-map', '0:v', '-map', '1:a',
     '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', 'oakhum-makers.mp4'])
print('oakhum-makers.mp4', round(total, 1), 's')
