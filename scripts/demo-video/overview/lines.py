"""The overview video's voice-over, one line per scene (docs/video-plan.md §1).
Used by ../voiceover.py; compose.py fits each scene to its line.

The angle (owner, 2026-11-20): you don't need to be a musician to make music,
and playing the way you feel is fine. Oakhum adds the musician's know-how on
your own instrument, so you can learn from there and use it your way: a jam,
a song, a little piece of your own.

First versions are voiced with Kokoro (free); once the owner agrees the words
and timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.
"""

# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Music is for everyone]
    'o1': ["You don't need to be a musician to make music.",
           "Music is everywhere, and playing the way you feel is just fine."],
    # [The basics are easier than you think]
    'o2': ["And when you want a little more, the basics aren't that hard.",
           "A few chords, a pattern you remember… and suddenly, it sounds like music."],
    # [A musician's know-how, on your instrument]
    'o3': ["Oakhum adds the musician's know-how, right on your own instrument:",
           "which notes go together, and where they are. You learn from there."],
    # [It starts from your instrument]
    'o4': ["Play your notes, and it works out exactly what you have."],
    # [Jam. Songs. Your own music.]
    'o5': ["Then use it your way.", "Join a jam, learn a song step by step,", "or put together a little piece of your own."],
    # [Find the music hiding in your instrument · Free, in your browser · oakhum.com]
    'o6': ["It's free, and it's made in Latvia, on Oak Street.", "Find the music hiding in your instrument!"],
}
