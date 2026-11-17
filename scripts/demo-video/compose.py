#!/usr/bin/env python3
"""Puts the recording, its sound, the captions and the end card together into
oakhum-demo.mp4 (1080 x 1920, for Reels/Shorts/TikTok and Reddit).

  node record.js && node cards.js && python3 compose.py

Times come from timeline.json, written by record.js. Output files stay in this
folder and are not committed (see .gitignore).
"""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
LEAD = 1.5  # seconds the first frame is held, under the first caption
END_CARD = 3.5

tl = json.load(open('timeline.json'))
marks = {m['name']: m['t'] for m in tl['marks']}
first = marks['firstFrame']
at = lambda name: round(marks[name] - first + LEAD, 2)
names = [m['name'] for m in tl['marks']]
scale, first_chord, second_chord, end = at('scale'), at(names[2]), at(names[3]), at('end')
total = end + END_CARD
delay = int(round((tl['audioOffset'] - first + LEAD) * 1000))

subprocess.run(['sh', '-c', 'ffmpeg -v error -y -f concat -safe 0 -i frames.ffconcat -vf "fps=30,format=yuv420p" -c:v libx264 -crf 18 screen.mp4'], check=True)
graph = f"""
color=c=0xF2E6D3:s=1080x1920:r=30:d={end}[bg];
[0:v]tpad=start_duration={LEAD}:start_mode=clone,scale=720:1560:flags=lanczos,setsar=1[app];
[bg][app]overlay=180:340:eof_action=repeat[v0];
[v0][3:v]overlay=0:0:enable='between(t,0,{scale})'[v1];
[v1][4:v]overlay=0:0:enable='between(t,{scale},{first_chord})'[v2];
[v2][5:v]overlay=0:0:enable='between(t,{first_chord},{second_chord})'[v3];
[v3][6:v]overlay=0:0:enable='between(t,{second_chord},{end})',trim=0:{end},setpts=PTS-STARTPTS,format=yuv420p[main];
[2:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.4[endc];
[main][endc]concat=n=2:v=1:a=0[v];
[1:a]adelay={delay}|{delay},apad,atrim=0:{total},afade=t=out:st={total - 2}:d=2[a]"""
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'screen.mp4', '-i', 'audio.webm', '-loop', '1', '-t', str(END_CARD), '-i', 'end.png',
                '-i', 'c1.png', '-i', 'c2.png', '-i', 'c3.png', '-i', 'c4.png', '-filter_complex', graph,
                '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'oakhum-demo.mp4'], check=True)
print('oakhum-demo.mp4', round(total, 1), 's')
