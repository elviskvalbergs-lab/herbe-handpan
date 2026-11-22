"""How to: keep your instrument and add Oakhum to your home screen: the voice-over, one line per scene (docs/video-plan.md §9, G2).
Used by ../voiceover.py; the video's compose.py fits each scene to its line.

First cuts are voiced with Kokoro (free); once the owner agrees the words and
timing, the same lines go to ElevenLabs "Liam" (eleven_v4), one take each,
kept in takes-elevenlabs/ like the makers video's.
"""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [Keep your instrument · Guests keep nothing between visits]
    'k0':   ['You can try everything in Oakhum without an account.',
             "But when you close it, a guest's instrument is gone."],
    # [1 · Tap Save]
    'k1':   ['To keep it, tap Save.',
             "A free account is just your email. There's no password."],
    # [2 · Type the code we email you · No password]
    'k2':   ['Type your email, and tap Send code.',
             "We email you a short code. Type it in, and you're signed in."],
    # [3 · It's in My instruments · On every device you sign in on]
    'k3':   ['Your instrument is now in My instruments,',
             'on every device where you sign in.'],
    # [4 · Works offline, with your account]
    'k4':   ['And it works with no signal.',
             "Open it once while you're online, and after that it's there offline too."],
    # [5 · Add to home screen · iPhone: Share › Add to Home Screen · Android: menu › Install app]
    'k5':   ['One more thing: put Oakhum on your home screen.',
             'On an iPhone, tap Share, then Add to Home Screen.',
             'On Android, open the browser menu and tap Add to Home screen, or Install app.',
             'Now it opens like any other app.'],
    # [Free. Delete it any time. · oakhum.com/help]
    'k6':   ['You can delete your account, and everything in it, any time in Settings.'],
}
