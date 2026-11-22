""""Songs you can play today": the voice-over, one line per scene (docs/video-plan.md §6).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

No numbers in the voice: how many songs fit differs by instrument, and the
screen shows the true count. The end card (g5) has no voice.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Songs your kalimba can play today]
    'g1':   ['This is a song your kalimba can play.',
             'Today.'],
    # [Only the songs your notes can play]
    'g2':   ['Your instrument only has certain notes.',
             'So Oakhum lists the songs those notes can play.'],
    # [With the tab · Numbers, thumbs, words]
    'g3':   ['Pick one. It lights each note in turn,',
             'and writes the tab the way kalimba players read it.'],
    # [Handpans, flutes and more]
    'g4':   ['On a handpan, the same song, in its own tab.'],
    # [the ocarina variant]
    'g1_ocarina':['This is a song your ocarina can play.',
             'Today.'],
    'g3_ocarina':['Pick one. It shows each note in turn,',
             'with its fingering.'],
    # [the tin whistle variant]
    'g1_whistle':['This is a tune your tin whistle can play.',
             'Today.'],
    'g3_whistle':['Pick one. It shows each note in turn,',
             'with its fingering.'],
    # [the December cut: Carols your kalimba can play]
    'g1_christmas':['This is a carol your kalimba can play.',
             'Tonight.'],
}
