""""Play my notes": the voice-over, one line per scene (docs/video-plan.md §5).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

The end card (p5) has no voice.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Don't know your tuning?]
    'p1':   ["Don't know what your kalimba is tuned to?"],
    # [Play each note, once · Any order]
    'p2':   ['Put your phone next to it.',
             'Then play each note, once.'],
    # [Oakhum works out the rest]
    'p3':   ['Oakhum listens…',
             'and works out exactly which one you have.'],
    # [Your instrument, ready]
    'p4':   ['And there it is: everything it can play.'],
    # [the handpan variant of p1]
    'p1_handpan':["Don't know what your handpan is tuned to?"],
}
