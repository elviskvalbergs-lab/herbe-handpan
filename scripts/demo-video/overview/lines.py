"""The overview video's voice-over, one line per scene (docs/video-plan.md §1).
Used by ../voiceover.py; compose.py fits each scene to its line.

First versions are voiced with Kokoro (free); once the owner agrees the words
and timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.
"""

# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [You fell in love with the sound]
    'o1': ["It started with a sound.", "You heard it once… and you just had to have one."],
    # [Nobody taught you music · So when friends start to jam, you listen]
    'o2': ["But when your friends start to jam…", "you just listen."],
    # [Join in. Have fun.]
    'o3': ["Oakhum is here so you can join in.", "No lessons, no theory. Just you, and your instrument."],
    # [It starts from your instrument]
    'o4': ["Play its notes, and Oakhum works out exactly what you have.", "Even one you made yourself."],
    # [Every chord, right on your instrument · A friend plays a chord? Oakhum listens]
    'o5': ["Then it shows every chord your notes can make, right where they live.",
           "And when a friend picks up a guitar, it listens, and shows you where to join in."],
    # [Find the music hiding in your instrument · Free, in your browser · oakhum.com]
    'o6': ["It's free, and it's made in Latvia, on Oak Street.", "Oakhum.", "Find the music hiding in your instrument!"],
}
