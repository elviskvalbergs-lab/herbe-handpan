# Oakhum for makers: the message and a video script

Version 1, 18 Nov 2026. **Status:** for review. This document works out the message first; voice and footage come after it's agreed.

**Cut 1 exists** (`scripts/demo-video/makers/`, 16:9, about 99 s), with a voice-over. The voice is a man's, pleasant, joyful and approachable: Kokoro "Liam", an open text-to-speech model run locally by `voiceover.py` (no account; it can also use OpenAI's voices when that account has credit). The app's own handpan plays under it and gets quieter while he speaks, and each scene is as long as its line needs. Still to do: real workshop and unboxing footage for scenes 1–3 and 6 (cut 1 uses the brand landscape and instrument pictures), and scene 4 showing a saved instrument rather than "Not saved". The QR card it renders (`scenes/qr-card.png`) is a real, printable code for the D Kurd page.

The rules from `docs/video-script.md` apply: why, then how, then what; "handpans, kalimbas, flutes and more"; one thing per scene; captions burned in.

## Who it's for

People and small workshops who make or sell handpans, steel tongue drums, kalimbas, ocarinas and flutes. Many make each instrument to order, often in their own scale. Big brands come later.

## What the maker wants

| The maker's worry | What Oakhum changes |
|---|---|
| A buyer plays the scale for a week, gets stuck at "now what?", and the instrument ends up on a shelf. | They open their own instrument and see every chord, the songs they can play, and how to join a jam. They keep playing. |
| A buyer hesitates over an unusual or custom scale: "what can I even play on it?" | Before buying, they can hear and see what that scale can do: a playable page per tuning on oakhum.com. |
| "What can I play?" emails after the sale | One link answers them. |
| Happy players are what bring reviews, recommendations and second instruments. | More of the people who buy keep playing, so more of them recommend. |
| Building in tune: an ocarina's holes, a custom layout | The app has a tuner, and the ocarina builder learns each clay body's shrinkage. |

**In one sentence:** *you make instruments to be played; Oakhum helps every buyer keep playing yours.*

## What we offer makers (all free)

1. **Each instrument gets its own link:**
   - For standard tunings, the tuning's page, e.g. `oakhum.com/handpan/d-kurd`.
   - For custom layouts (bottom notes, odd scales), the maker sets the instrument up once and shares it, so the link opens *exactly that* instrument.
2. **The link goes in the box, so the buyer's phone opens it in one tap.**
   - **QR code:** printed on a card in the case or on the certificate. It works on every phone.
   - **NFC tag:** a small sticker with the link, the phone-readable kind of RFID. The buyer holds the phone to it.
     - It works without an app on any Android phone and on iPhone XS and newer.
     - Stickers cost roughly €0.10–0.70 each.
     - On a steel instrument (handpan, tongue drum) a normal sticker doesn't work: use an "on-metal" tag, or put the sticker on the case or the card instead.
3. **A link for the shop:** every scale they sell has a page on oakhum.com where buyers can tap chords and hear them. The maker links to it from the product page.
4. **No app store, no sign-up:** it opens in the browser, and it can be added to the phone as an app.

Not promised yet: embedding the playable picture on the maker's own site, or showing the maker's name and logo when the instrument opens. Both are possible later if makers ask for them.

## The video (about 60 s; cut 1 runs about 99 s with the voice-over)

**The voice tells the story; the captions say the point.** People can read the captions themselves, so the voice doesn't repeat them. It tells what happens around them, in a friendly, excited way, and adds what the captions leave out: listening along with a friend's guitar, working offline, made in Latvia on Oak Street, free for the maker and every player. The voice-over below is what cut 1 says (`LINES` in `voiceover.py`).

### 1. Why

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 1 | The workshop: hammering a shell, tuning a note, sanding a kalimba bridge. | "Shaping, tuning, listening… and tuning again, until every note sings." | You make instruments to be played |
| 2 | A finished instrument in its case, shipped. Cut to it sitting on a shelf, dusty. | "Then it arrives at someone's door, and they're thrilled! They play it every day… until, one day, it quietly moves to the shelf." | …not to sit on a shelf |
| 3 | The same buyer playing with friends, smiling. | "We made Oakhum so that doesn't happen. It shows people what their own instrument can do. No lessons, no theory. And someone who's having fun? They tell everyone about it." | Players who keep playing tell their friends |

### 2. How

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 4 | The maker sets up a custom instrument in Oakhum (the layout, bottom notes) and gets its link and QR code. | "Here's how it works. You set up the instrument once, even a scale nobody else makes. Save it with a free account, and it gets its very own link." | Set it up once, exactly as you built it |
| 5 | A QR card goes into the case. An NFC sticker goes inside the lid. (Cut 1 shows this as three scenes: the QR code, the NFC tag, the tip for steel.) | QR code: "That link travels in the box. And it answers every 'so, what can I play?' email, before it's ever written." NFC tag: "Want a little magic? Hide it in an NFC sticker. Writing one takes a few seconds." Steel: "Making handpans or drums? Stick the tag on the case or the card. Steel blocks the signal." | A QR code or NFC tag in the box |
| 6 | The buyer unboxes it, holds the phone to the tag, and their instrument opens in Oakhum. | "And now the best part. They unbox it, tap their phone… and there it is: ready to play!" | One tap: their own instrument |

### 3. What

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 7 | Chords lighting up on the pan; a song's chords pasted in and played level by level. | "Every chord lights up, right where it lives on their instrument. And when a friend picks up a guitar, Oakhum listens, and shows them how to join in. It even works offline, around the campfire." | Chords, songs, jams |
| 8 | A shop's product page with a "Hear what this scale can do" link opening the playable page. | "On your shop, people can hear your scales and play them, before they buy. Even the unusual ones." | Let buyers hear your scales first |

### 4. Ending

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 9 | The maker's workshop, an instrument being played. End card: logo, "For makers of handpans, kalimbas, flutes and more", "Free", **oakhum.com/makers** | "Oakhum is made in Latvia, on Oak Street. It's free, for you and for every player. Let's get your instruments played!" | Help your instruments get played |

## Where this goes

- **Cold emails to makers** (the launch plan's week 2): the email links to this video and to the makers page.
- **A `/makers` page on the website** with this message, the steps, and a "set up your instruments" call to action. This isn't built yet; the video's end card assumes it exists.
- **Makers' own Instagram:** a maker who agrees can post the unboxing scene with their own instrument.
