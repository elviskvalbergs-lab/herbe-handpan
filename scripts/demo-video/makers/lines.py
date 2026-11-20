"""The makers video's voice-over, one line per scene (docs/video-script-makers.md).
Used by ../voiceover.py; compose.py fits each scene to its line.

The video on the website uses ElevenLabs' "Liam" (eleven_v4), kept in
takes-elevenlabs/, so it can be rebuilt without spending credits:
  python3 ../voiceover.py --from takes-elevenlabs --out vo-elevenlabs
  python3 compose.py vo-elevenlabs
The last line was sent as "... [excited] Let's get your instruments PLAYED!" so
the weight falls on "played". The voice adds what the captions leave out
(listening along with a guitar, offline, made in Latvia, free for maker and buyer)."""

# One line per scene. A line is a list of phrases, so a pause is a real pause.
# Captions on screen in brackets, so the voice can add to them, not repeat them.
LINES = {
    # [You put weeks into every instrument you make.]
    's1':   ["Shaping, tuning, listening…", "and tuning again, until every note sings."],
    # [But the first week is the hardest for many buyers. They play the scale… and then, what next?]
    's2':   ["Then it arrives at someone's door, and they're thrilled!",
             "They play it every day…", "until, one day, it quietly moves to the shelf."],
    # [Oakhum helps every buyer keep playing. Even with no musical background.]
    's3':   ["We made Oakhum so that doesn't happen.",
             "It shows people what their own instrument can do. No lessons, no theory.",
             "And someone who's having fun? They tell everyone about it."],
    # [Set it up once. Exactly as you built it: your scale, your layout, every bottom note.]
    's4':   ["Here's how it works.", "You set up the instrument once, even a scale nobody else makes.",
             "Save it with a free account, and it gets its very own link."],
    # [Print its QR code. On a card in the case, on the certificate...]
    's5a':  ["That link travels in the box.", "So your buyers never have to write and ask you what to play."],
    # [Or write it to an NFC tag. A sticker costs cents...]
    's5b':  ["Want a little magic?", "Hide it in an NFC sticker. Writing one takes a few seconds."],
    # [One tap: their own instrument opens. No app store, no sign-up.]
    's6':   ["And now the best part.", "They unbox it, tap their phone…", "and there it is: ready to play!"],
    # [Every chord it can play. Songs step by step, and help to join any jam.]
    's7':   ["Every chord lights up, right where it lives on their instrument.",
             "And when a friend picks up a guitar, Oakhum listens, and shows them how to join in.",
             "It even works offline, around the campfire."],
    # [Link every scale you sell from your shop]
    'shop': ["On your shop, people can hear your scales and play them, before they buy.",
             "Even the unusual ones."],
    # [Help your instruments get played. For makers of handpans, kalimbas, flutes and more · Free]
    's9':   ["Oakhum is made in Latvia, on Oak Street.",
             "It's free, for you and for every player.", "Let's get your instruments played!"],
}
