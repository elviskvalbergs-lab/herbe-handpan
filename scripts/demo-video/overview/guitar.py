#!/usr/bin/env python3
"""A stand-in guitar for the Listen scene (docs/video-plan.md §4, scene 5):
a strummed D minor, then a B flat, as the microphone hears them. Plucked
strings by Karplus-Strong, so the app's Listen hears something like a real
guitar. Replace guitar.wav with a phone recording of a real guitar (D minor,
then B flat, five seconds each) when the owner has one: record.js and
compose.py read only the file.

  python3 guitar.py   # -> guitar.wav (48 kHz mono)
"""
import os, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def pluck(freq, seconds, rng, damp=0.996):
    n = int(SR / freq)
    buf = rng.uniform(-1, 1, n)
    out = np.empty(int(seconds * SR))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = damp * 0.5 * (buf[i % n] + buf[(i + 1) % n])
    return out


def strum(notes, seconds, rng, spread=0.018):
    """Down-strum: the strings low to high, a few ms apart."""
    out = np.zeros(int(seconds * SR))
    for i, n in enumerate(notes):
        s = pluck(midi(n), seconds, rng) * (0.9 - 0.05 * i)
        d = int(i * spread * SR)
        out[d:] += s[:len(out) - d]
    return out


def main():
    rng = np.random.default_rng(7)
    dm = [50, 57, 62, 65]       # D3 A3 D4 F4: open D minor, four strings
    bb = [46, 53, 58, 62, 65]   # Bb2 F3 Bb3 D4 F4
    parts = [np.zeros(int(0.8 * SR)), strum(dm, 4.5, rng), np.zeros(int(0.4 * SR)),
             strum(bb, 4.5, rng), np.zeros(int(6 * SR))]
    a = np.concatenate(parts)
    a = 0.6 * a / np.abs(a).max()
    pcm = (a * 32767).astype('<i2')
    with wave.open(os.path.join(HERE, 'guitar.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('guitar.wav', round(len(a) / SR, 1), 's')


if __name__ == '__main__':
    main()
