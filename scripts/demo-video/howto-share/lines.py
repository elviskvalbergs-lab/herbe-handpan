"""How to: share an instrument with a code: the voice-over, one line per scene (docs/video-plan.md §9, G3).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Share your instrument · A code, a link or a QR code]
    's0':   ["Want a friend to open your exact instrument? Or the person you're giving it to?",
             'Share it with a code.'],
    # [1 · ⋯ then Share · For saved instruments]
    's1':   ["Sharing works for instruments you've saved.",
             'Open yours, tap the three dots, then Share.'],
    # [2 · A code, a link, a QR code]
    's2':   ['You get three things: a short code, a link, and a QR code.',
             'Send the link in a message. Or print the QR code on a card and keep it with the instrument.'],
    # [3 · They open it and play · No app, no sign-up]
    's3':   ['Whoever opens it sees your instrument, exactly as you set it up, and can play it straight away.',
             "They don't need an account."],
    # [4 · To keep it: Add to my instruments]
    's4':   ["It's a copy for them to look at. To keep it, they tap Add to my instruments,",
             'and save it with their own free account.'],
    # [For makers and shops · oakhum.com/makers · oakhum.com/help]
    's5':   ["Do you make or sell instruments? There's more for you at oakhum dot com, slash makers."],
}
