""""Play along with a guitarist": the voice-over, one line per scene (docs/video-plan.md §7).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

Scenes d3-d4 are recorded signed in: playing a pasted chord sheet saves it as
a playlist, which needs the free account. The end card (d5) has no voice.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Play along with a guitarist]
    'd1':   ['Your friend has a guitar, and a song.',
             'You have nine notes.'],
    # [Paste the chords · It fits them to your notes]
    'd2':   ["Paste the song's chords.",
             'Oakhum fits them to the notes you have.'],
    # [The chords, in order · On your own instrument]
    'd3':   ['Save it, and you get the chords in order,',
             'each one lit on your handpan.'],
    # [Start with one note per chord]
    'd4':   ['Start with one note per chord.',
             "That's already playing along."],
}
