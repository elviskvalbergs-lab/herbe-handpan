"""How to: set up your instrument (handpan): the voice-over, one line per scene (docs/video-plan.md §9, G1).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

The other four instruments swap the words in h3 and h4: the table is in
docs/video-plan.md §10.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Set up your instrument · About a minute]
    'h0':   ["Let's set up your handpan. It takes about a minute."],
    # [1 · Tap your instrument]
    'h1':   ['Open oakhum.com and tap Start playing.',
             'Then tap your instrument.'],
    # [2 · Play my notes, or I know my scale]
    'h2':   ["You have two ways. If you don't know its scale, tap Play my notes.",
             'If you do, tap I know my scale.'],
    # [3 · Play each note, once · Quiet room · let it ring · then stop it]
    'h3':   ['Find a quiet room and put the phone next to the handpan.',
             'Count its notes, and tap Start.',
             'Play the big note in the middle. Strike it once, and let it ring.',
             'Then each note around it, one by one. Stop each note with your hand before the next.'],
    # [3 · Or pick your scale · It's on the sticker or certificate]
    'h4':   ['If you know the scale, pick the middle note,',
             "then the scale. It's usually on the sticker or the certificate."],
    # [4 · Your first chord]
    'h5':   ["That's your handpan, with every chord it can play.",
             'Tap Play my first chord: it lights up, and plays.'],
    # [Something not right? · Settings › Send feedback · oakhum.com/help]
    'h6':   ['If Oakhum hears a note wrong, tap Settings, then Send feedback.',
             'We read every message.'],
}
