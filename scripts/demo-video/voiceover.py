#!/usr/bin/env python3
"""The voice-over of a video, run from its folder (makers/, overview/): one
take per line of its lines.py, written to <out>/<line>.wav, with their lengths
in <out>/lines.json. Its compose.py fits each scene to its line and lays the
voice over the sound.

  pip install kokoro-onnx soundfile
  python3 ../voiceover.py                          # Kokoro "Liam" -> vo/
  python3 ../voiceover.py --voice am_puck          # another Kokoro voice, see --list
  python3 ../voiceover.py --samples                # one line in every male voice, vo/samples/
  python3 ../voiceover.py --engine openai --out vo-openai   # OpenAI, needs OPENAI_API_KEY
  python3 ../voiceover.py --from takes-elevenlabs --out vo-elevenlabs   # takes made elsewhere

The voices: Kokoro (free, local) for first versions, ElevenLabs "Liam"
(eleven_v4) for the final ones, made through the ElevenLabs connector, one
take per line, kept in the video's takes-elevenlabs/ (<line>.mp3) and brought
in with --from, so a video can be rebuilt without spending credits.

The captions already say what's on screen, so the voice doesn't read them: it
tells the story around them and adds what the captions leave out.
No music-theory words (docs/video-plan.md §1).

Kokoro is an open model (Apache 2.0) run locally: no account, no API key. Its
model files (~350 MB) are downloaded once to ~/.cache/oakhum-tts. OpenAI's
gpt-4o-mini-tts takes directions for the tone (OPENAI_STYLE below); one take
of the whole script costs about a cent. Output stays in this folder, uncommitted.
"""
import argparse, io, json, os, sys, urllib.request
import numpy as np

HERE = os.getcwd()  # the video's folder: its lines.py, takes and vo/ live there
CACHE = os.path.expanduser('~/.cache/oakhum-tts')
MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
FILES = ['kokoro-v1.0.onnx', 'voices-v1.0.bin']
VOICE, SPEED = 'am_liam', 1.0        # Kokoro: the owner's pick of the male voices
OPENAI_MODEL, OPENAI_VOICE = 'gpt-4o-mini-tts', 'ash'
OPENAI_STYLE = ("A man in his thirties telling a friend about something he loves. Warm, joyful and "
                "approachable, smiling while he speaks, gently excited but never salesy or loud. "
                "Relaxed, natural pace with small pauses where the text has them.")
PAUSE = 0.32  # seconds between the phrases of one line (Kokoro)
# Kokoro says "Oakhum" so the h disappears ("oh-come"). A tiny break between
# the halves keeps it "oak hum" (checked with speech recognition).
PRONOUNCE = {'ˈoʊkhəm': 'ˈoʊk, hˈʌm'}

# The lines come from the video's own lines.py (LINES: scene -> phrases), in
# the folder this is run from: python3 ../voiceover.py inside makers/ or overview/.
sys.path.insert(0, os.getcwd())
from lines import LINES

def kokoro():
    os.makedirs(CACHE, exist_ok=True)
    for f in FILES:
        p = os.path.join(CACHE, f)
        if not os.path.exists(p):
            print('downloading', f, file=sys.stderr)
            urllib.request.urlretrieve(MODEL_URL + f, p + '.part'); os.replace(p + '.part', p)
    from kokoro_onnx import Kokoro
    return Kokoro(*(os.path.join(CACHE, f) for f in FILES))

def trim(s, sr, floor=0.01):
    """Cut silence at both ends, keeping 40 ms so the words don't start abruptly."""
    loud = np.flatnonzero(np.abs(s) > floor)
    if not len(loud): return s
    pad = int(0.04 * sr)
    return s[max(0, loud[0] - pad):loud[-1] + pad]

def say_kokoro(k, phrases, voice, speed):
    parts, sr = [], 24000
    for i, ph in enumerate(phrases):
        ipa = k.tokenizer.phonemize(ph, 'en-us')
        for word, fix in PRONOUNCE.items(): ipa = ipa.replace(word, fix)
        s, sr = k.create(ipa, voice=voice, speed=speed, is_phonemes=True)
        if i: parts.append(np.zeros(int(PAUSE * sr), dtype=np.float32))
        parts.append(trim(s, sr))
    return np.concatenate(parts), sr

def say_openai(phrases, voice, speed):
    """One request per line, so the line keeps its own intonation."""
    import soundfile as sf
    body = json.dumps({'model': OPENAI_MODEL, 'voice': voice, 'input': ' '.join(phrases),
                       'instructions': OPENAI_STYLE, 'response_format': 'wav', 'speed': speed}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', body, {
        'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})
    data = urllib.request.urlopen(req, timeout=120).read()
    s, sr = sf.read(io.BytesIO(data), dtype='float32')
    return trim(s if s.ndim == 1 else s.mean(axis=1), sr), sr

def main():
    a = argparse.ArgumentParser()
    a.add_argument('--engine', choices=['kokoro', 'openai'], default='kokoro')
    a.add_argument('--voice'); a.add_argument('--speed', type=float, default=SPEED)
    a.add_argument('--out', default='vo')
    a.add_argument('--from', dest='src', help='a folder of takes made elsewhere, <scene>.mp3')
    a.add_argument('--list', action='store_true'); a.add_argument('--samples', action='store_true')
    o = a.parse_args()
    import soundfile as sf
    out = os.path.join(HERE, o.out)
    if o.src:
        import subprocess
        os.makedirs(out, exist_ok=True)
        lines = {}
        for scene, phrases in LINES.items():
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(HERE, o.src, scene + '.mp3'),
                                  '-ac', '1', '-ar', '24000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
            s = trim(np.frombuffer(raw, dtype=np.float32), 24000)
            sf.write(os.path.join(out, scene + '.wav'), s, 24000)
            lines[scene] = {'text': ' '.join(phrases), 'seconds': round(len(s) / 24000, 3)}
            print(f"{scene:6} {lines[scene]['seconds']:5.2f} s")
        json.dump({'engine': 'takes from ' + o.src, 'lines': lines}, open(os.path.join(out, 'lines.json'), 'w'), indent=2)
        return
    voice = o.voice or (VOICE if o.engine == 'kokoro' else OPENAI_VOICE)
    k = kokoro() if o.engine == 'kokoro' else None
    say = (lambda ph: say_kokoro(k, ph, voice, o.speed)) if k else (lambda ph: say_openai(ph, voice, o.speed))
    if o.list:
        print(' '.join(v for v in k.get_voices() if v[1] == 'm')); return
    if o.samples:
        os.makedirs(os.path.join(out, 'samples'), exist_ok=True)
        for v in (v for v in k.get_voices() if v[:2] in ('am', 'bm')):
            s, sr = say_kokoro(k, LINES['s3'], v, o.speed)
            sf.write(os.path.join(out, 'samples', v + '.wav'), s, sr); print(v)
        return
    os.makedirs(out, exist_ok=True)
    lines = {}
    for scene, phrases in LINES.items():
        s, sr = say(phrases)
        sf.write(os.path.join(out, scene + '.wav'), s, sr)
        lines[scene] = {'text': ' '.join(phrases), 'seconds': round(len(s) / sr, 3)}
        print(f"{scene:6} {lines[scene]['seconds']:5.2f} s  {lines[scene]['text']}")
    json.dump({'engine': o.engine, 'voice': voice, 'speed': o.speed, 'lines': lines},
              open(os.path.join(out, 'lines.json'), 'w'), indent=2)

if __name__ == '__main__':
    main()
