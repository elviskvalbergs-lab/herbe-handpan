"""The overview video ("What can your instrument play?"): the voice-over, one line per scene (docs/video-plan.md §4).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

These lines replace the first cut's (19 Nov), which opened with "It started
with a sound". Scenes o2-o5 are phone scenes now, so scenes.js and compose.py
in this folder still need changing to match (see the plan).
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [What can your instrument play?]
    'o1':   ['Every one of these has its own notes.',
             'So what can yours actually play?'],
    # [It starts from your instrument · Pick it, or play its notes]
    'o2':   ['Tell Oakhum which one you have.',
             'Or just play its notes, and it works it out.'],
    # [Every chord, on your own instrument]
    'o3':   ['Then it shows every chord your notes can make, right where they live.'],
    # [Songs your notes can play · With the tab]
    'o4':   ['And the songs they can play, note by note.'],
    # [Join in · Oakhum hears the chord and shows it on yours]
    'o5':   ['A friend picks up a guitar?',
             'It listens, and shows you where to join in.'],
    # [Find the music hiding in your instrument · Free. No sign-up to try. · oakhum.com]
    'o6':   ["It's free, and there's no sign-up to try.",
             'Oakhum.',
             'Find the music hiding in your instrument!'],
}
