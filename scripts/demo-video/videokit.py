"""What every 16:9 video's compose.py shares (the makers video, the overview):
still scenes with a slow zoom, a phone recording laid into a phone frame,
the voice-over fitted to the scenes, and the sound: the app's own instrument,
ducking under the voice, brought to a steady loudness.

A video's compose.py makes a Video, adds its segments in order, says which
voice line belongs to which segment and which clips of sound go where, and
calls finish().
"""
import json, os, subprocess
from PIL import Image, ImageDraw

DEMO = os.path.dirname(os.path.abspath(__file__))  # scripts/demo-video
CREAM = '0xF2E6D3'
FPS = 30
VO_LEAD, VO_TAIL = 0.6, 1.0  # a line starts VO_LEAD into its scene and leaves VO_TAIL after it


def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


_SECONDS = {}
def _seconds(path):
    """How long a recording is, by decoding it (the browser's recordings say
    nothing about their length in their header)."""
    if path not in _SECONDS:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
                             capture_output=True, check=True).stdout
        _SECONDS[path] = len(raw) / 2 / 8000
    return _SECONDS[path]


def mark(tl, prefix):
    return next(m['t'] for m in tl['marks'] if m['name'].startswith(prefix) or prefix in m['name'])


class Phone:
    """The phone recording made by ../record.js (D Kurd: the scale, then Dm, B flat, F, C)."""
    def __init__(self):
        tl = json.load(open(os.path.join(DEMO, 'timeline.json')))
        self.first, self.audio_offset = mark(tl, 'firstFrame'), tl['audioOffset']
        self.t = {k: mark(tl, k) for k in ('scale', 'D Minor', 'A# Major', 'F Major', 'C Major')}
        self.video = os.path.join(DEMO, 'screen.mp4')
        self.audio = os.path.join(DEMO, 'audio.webm')
        if not os.path.exists(self.video):  # normally made by ../compose.py
            run(['-f', 'concat', '-safe', '0', '-i', os.path.join(DEMO, 'frames.ffconcat'), '-vf', f'fps={FPS},format=yuv420p',
                 '-c:v', 'libx264', '-crf', '18', self.video])

    def sound(self, at_mark):
        """Where a moment of the recording is in its audio file (seconds)."""
        return self.t[at_mark] - self.audio_offset


class Video:
    def __init__(self, name, vo_dir='vo'):
        """name: the output's base name; vo_dir: the voice-over takes (voiceover.py)."""
        self.vo_dir = vo_dir.rstrip('/')
        self.out = name + self.vo_dir[2:] + '.mp4'  # vo -> name.mp4, vo-x -> name-x.mp4
        path = f'{self.vo_dir}/lines.json'
        self.vo = json.load(open(path))['lines'] if os.path.exists(path) else {}
        self.segs = []      # (file, seconds)
        self.vo_place = {}  # line -> (segment file, seconds into it)
        self.clips = []     # (source, start, seconds, at, volume, fade-out seconds)

    def vo_len(self, line):
        return self.vo[line]['seconds'] if line in self.vo else 0.0

    def fit(self, line, dur):
        """A scene at least as long as its line needs."""
        return round(max(dur, VO_LEAD + self.vo_len(line) + VO_TAIL), 2) if line in self.vo else dur

    def _fades(self, dur):
        return f"fade=t=in:st=0:d=0.45:color={CREAM},fade=t=out:st={dur-0.45}:d=0.45:color={CREAM}"

    def still(self, name, dur, zoom=True, line=None):
        """scenes/<name>.png with a slow zoom; its voice line (default: the same name) starts VO_LEAD in."""
        line = line or name
        out = f'seg_{name}.mp4'
        dur = self.fit(line, dur)
        z = f"zoompan=z='1+0.035*on/({dur}*{FPS})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(dur*FPS)}:s=1920x1080:fps={FPS}," if zoom else ''
        run(['-loop', '1', '-t', str(dur), '-i', f'scenes/{name}.png', '-vf', f"scale=3840:-1,{z}format=yuv420p,{self._fades(dur)}",
             '-r', str(FPS), '-t', str(dur), '-c:v', 'libx264', '-crf', '18', out])
        self.add(out, dur, {line: VO_LEAD})
        return out

    def phone(self, out, backgrounds, video, ss, dur, lines):
        """A phone recording inside the phone frame. backgrounds: [(png, from second)],
        each replacing the one before; lines: {line: seconds into the segment}."""
        mask = 'scenes/phone-mask.png'
        if not os.path.exists(mask):  # rounded phone screen, 420 x 909, radius 44
            m = Image.new('L', (420, 909), 0)
            ImageDraw.Draw(m).rounded_rectangle((0, 0, 419, 908), radius=44, fill=255)
            m.save(mask)
        args, chain = [], ''
        for i, (png, _) in enumerate(backgrounds):
            args += ['-loop', '1', '-i', png]
        n = len(backgrounds)
        args += ['-ss', f'{ss:.3f}', '-t', str(dur), '-i', video, '-loop', '1', '-i', mask]
        g = f"[{n}:v]scale=420:909,format=rgba[ph];[{n+1}:v]format=gray,scale=420:909[m];[ph][m]alphamerge[phm];"
        last = '[0:v]'
        for i in range(1, n):
            g += f"{last}[{i}:v]overlay=enable='gte(t,{backgrounds[i][1]:.2f})'[bg{i}];"
            last = f'[bg{i}]'
        g += f"{last}[phm]overlay=1200:82:shortest=1,format=yuv420p,{self._fades(dur)}"
        run([*args, '-filter_complex', g, '-t', str(dur), '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', out])
        self.add(out, dur, lines)
        return out

    def add(self, out, dur, lines=None):
        """A segment made elsewhere; lines: {line: seconds into it}."""
        self.segs.append((out, dur))
        for line, at in (lines or {}).items():
            if line in self.vo:
                self.vo_place[line] = (out, at)

    def starts(self):
        s, t = {}, 0.0
        for f, d in self.segs:
            s[f] = t
            t += d
        return s, t

    def clip(self, src, start, dur, at, vol, fade=0.6):
        """A stretch of sound (the instrument) at a time in the video."""
        self.clips.append((src, start, dur, at, vol, fade))

    def bed(self, parts, overlap=1.5, fade=1.5):
        """The instrument under the whole video with no gaps or cut-offs:
        parts = [(source, start, at, volume)]. Each part plays until the next
        one has started, then rings on for `overlap` seconds and fades out over
        `fade` while the next comes in; the last plays to the end. A part never
        runs past the end of its recording."""
        _, total = self.starts()
        parts = sorted(parts, key=lambda p: p[2])
        for i, (src, start, at, vol) in enumerate(parts):
            end = parts[i + 1][2] + overlap if i + 1 < len(parts) else total
            room = _seconds(src) - max(0.0, start)
            dur = round(min(end - at, room), 2)
            self.clip(src, start, dur, at, vol, fade=min(fade, dur / 2))

    def finish(self):
        starts, total = self.starts()
        with open('segments.txt', 'w') as f:
            for s, _ in self.segs:
                f.write(f"file '{s}'\n")
        args, graph = [], []
        for i, (src, ss, dur, at, vol, fade) in enumerate(self.clips):
            args += ['-ss', f'{max(0, ss):.3f}', '-t', f'{dur:.3f}', '-i', src]
            ms = int(at * 1000)
            graph.append(f"[{i}:a]volume={vol},afade=t=in:d=0.05,afade=t=out:st={dur-fade:.2f}:d={fade},adelay={ms}|{ms}[a{i}]")
        mix = ''.join(f'[a{i}]' for i in range(len(self.clips)))
        graph.append(f"{mix}amix=inputs={len(self.clips)}:normalize=0,apad,atrim=0:{total}[music]")
        lines = [l for l in self.vo if l in self.vo_place]
        if lines:
            # The voice: each line at its time, one bus. The instrument ducks
            # under it (sidechain), then both are mixed and brought to a steady loudness.
            n = len(self.clips)
            for j, line in enumerate(lines):
                seg, at = self.vo_place[line]
                args += ['-i', f'{self.vo_dir}/{line}.wav']
                ms = int((starts[seg] + at) * 1000)
                graph.append(f"[{n + j}:a]aresample=48000,adelay={ms}|{ms}[v{j}]")
            graph.append(''.join(f'[v{j}]' for j in range(len(lines))) + f"amix=inputs={len(lines)}:normalize=0,apad,atrim=0:{total},asplit[vo][key]")
            graph.append("[music][key]sidechaincompress=threshold=0.02:ratio=4:attack=60:release=1200[duck]")
            graph.append(f"[duck][vo]amix=inputs=2:weights='0.8 1':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=out:st={total-1.5}:d=1.5[a]")
        else:
            graph.append(f"[music]afade=t=out:st={total-1.5}:d=1.5[a]")
        run([*args, '-filter_complex', ';'.join(graph), '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', 'audio.m4a'])
        run(['-f', 'concat', '-safe', '0', '-i', 'segments.txt', '-i', 'audio.m4a', '-map', '0:v', '-map', '1:a',
             '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', self.out])
        print(self.out, round(total, 1), 's')
        return starts, total
