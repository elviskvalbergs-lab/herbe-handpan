"""The six per-instrument clips (16-18 s each): the voice-over, one line per scene (docs/video-plan.md §8).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

Three lines per clip: the question, its chords, a song. The end cards have
no voice. """

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [What can your handpan play?]
    'handpan1':['Nine notes. What can they play?'],
    'handpan2':['Every chord your handpan can make, right where it lives.'],
    'handpan3':['And the songs that fit it.',
             'Pick your scale, or play its notes.'],
    # [What can your tongue drum play?]
    'tonguedrum1':['It came with a few notes and no instructions.'],
    'tonguedrum2':["Here's every chord those notes can make."],
    'tonguedrum3':['And the songs they can play.',
             'Just play its notes, and Oakhum knows your drum.'],
    # [What can your kalimba play?]
    'kalimba1':['Seventeen keys. Where do you start?'],
    'kalimba2':['With chords that sit right under your thumbs.'],
    'kalimba3':['And songs in kalimba tab, lit note by note.'],
    # [What can your ocarina play?]
    'ocarina1':['Twelve holes. A lot of fingerings.'],
    'ocarina2':["Here's each one, and chords played one note at a time."],
    'ocarina3':['And songs with every fingering shown as you go.'],
    # [What can your tin whistle play?]
    'whistle1':['Six holes, and a lot of tunes.'],
    'whistle2':["Every note's fingering, as you play."],
    'whistle3':['And songs, note by note.',
             'For Native American flutes too.'],
    # [What can your recorder play?]
    'recorder1':['The recorder from school. Still in a drawer?'],
    'recorder2':["Every note's fingering, as you play."],
    'recorder3':['And a hundred songs you already know, note by note.'],
}
