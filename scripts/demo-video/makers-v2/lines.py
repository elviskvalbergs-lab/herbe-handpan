"""The makers video, v2 (60 s, one promise): the voice-over, one line per scene (docs/video-script-makers.md §3).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.

Cut 1 (94 s) and its takes stay in ../makers/. The last phrase goes to
ElevenLabs as "[excited] Let's get your instruments PLAYED!", as in cut 1.
m6 is the maker dashboard: leave it out until the makers programme is live.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [One code in the case. Their instrument, ready to play.]
    'm1':   ['Your buyer scans one code…',
             'and their instrument is on their phone, ready to play.'],
    # [The first week is the hardest · "What do I play now?"]
    'm2':   ['Most new owners play the scale for a week, and then get stuck.',
             "That's when an instrument moves to the shelf."],
    # [Save it once · Exactly as you built it]
    'm3':   ['So set each instrument up once, exactly as you built it.',
             'Your scale, your layout, every bottom note.',
             'Save it.'],
    # [It gets its own code · On a card, the certificate, or an NFC tag]
    'm4':   ['It gets its own code.',
             'Print it on a card for the case, or on the certificate.'],
    # [Every scan opens that instrument · Chords and songs · no app, no sign-up]
    'm5':   ['Every scan opens that instrument.',
             'With every chord it can play, and the songs that fit it.',
             'No app to install. No sign-up.'],
    # [You see every scan · Your instruments, your name (needs: makers programme)]
    'm6':   ['And you see it working: which instruments were opened, and how often.'],
    # [Save it once. Every scan opens it. · Free for you and your buyers · oakhum.com/makers]
    'm7':   ["It's free, for you and for your buyers.",
             'Oakhum.',
             "Let's get your instruments played!"],
}
