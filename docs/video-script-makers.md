# Oakhum for makers: the message, the video on the site, and the v2 script

**Status: current** (21 Nov 2026) for §1–§4. §5 (the script of cut 1) is **history**, kept because the video built from it is still on the website.

- **Built:** cut 1 of the makers video (94 s, 16:9) is on `/makers` (`site/public/video/oakhum-makers.mp4`), made by `scripts/demo-video/makers/`. The `/makers` page exists.
- **Planned:** the v2 cut below (60 s), which replaces cut 1 on `/makers` and in cold emails once its last scene can be filmed.
- **The makers programme** (`docs/makers-programme.md`) is being built in phases. **Phase 1 is merged (21 Nov):** the maker role (asked for in Settings › Makers and approved by an admin), the public profile, and "Made by <maker>" on instruments opened by code and in the link preview. **Not built yet:** phase 2 (the maker's instruments list, serial numbers, the QR card and sticker sheet, NFC instructions, scan logging), phase 3 (the dashboard's numbers), phase 4 (the website: `/makers` rebuilt, the directory, maker pages), phase 5 (an embed). Shots are marked with the phase they need.

Words come from `docs/messaging.md`; the rules and the pipeline are in `docs/video-plan.md` §1–§2.

## 1. The message

**Who it's for:** people and small workshops who make or sell handpans, steel tongue drums, kalimbas, ocarinas and flutes. Many make each instrument to order, often in their own scale.

**The one promise:**

> **Save the instrument once. Every scan of its code opens that instrument, ready to play.**

Everything else a maker gets is a reason to believe the promise or a consequence of it, and belongs on the `/makers` page and in the kit (`docs/maker-kit.md`), not in the video:

| The maker's worry | What Oakhum changes | Where we say it |
|---|---|---|
| A buyer plays the scale for a week, gets stuck at "now what?", and the instrument ends up on a shelf. | They open their own instrument and see every chord and the songs it can play. | The video (the reason for the promise) |
| "What can I play?" emails after the sale | The code in the case answers them. | The page, the email |
| A buyer hesitates over an unusual or custom scale. | Every tuning has a playable page to link from the product page. | The page, the product-page copy in the kit |
| Does anyone actually use it? | *(needs: makers phase 3)* The dashboard shows how often each code was scanned. | The video's last scene, the page |
| Will it carry my name? | Yes, for an approved maker (built 21 Nov): a shared instrument says "Made by <maker>". | The video (on the buyer's phone), the page |

Not in marketing: the clay ocarina builder (internal), tuning help for makers, NFC on steel (it's a how-to detail; the FAQ on `/makers` has it).

## 2. Does the video on `/makers` work as it is?

**As a page explainer for a maker who is already interested: yes, it is fine to leave up until v2 is ready.** It is warm, it sounds like the brand, and the unboxing moment in scene 6 lands.

**As the video a cold email links to: no.** Four reasons, in order of weight:

1. **It is 94 s against the 60 s it was written for,** and the app does not appear until second 35. A maker who clicked a link in an email from a stranger has decided by second 15.
2. **It makes seven claims** (keeps buyers playing; buyers recommend you; your own link; QR; NFC; chords, songs and jams; hear scales before buying; offline; made in Latvia; free). Nobody can repeat it afterwards. The promise a maker can repeat is one sentence.
3. **Two things on screen contradict the voice.** Scene 4 says "Save it with a free account, and it gets its very own link" over a phone that says "Not saved". And the link shown everywhere is `oakhum.com/handpan/d-kurd`, the public page of a catalogue scale, while the voice says "exactly as you built it, even a scale nobody else makes". The video promises a per-instrument code and shows a generic page.
4. **"It even works offline, around the campfire"** is said about a buyer who, two scenes earlier, opened it with "no sign-up". Offline needs the free account. The line has to go or be qualified.

It also never shows the maker anything that is *theirs* after the sale: no name on the instrument, no number. That is what the makers programme adds, and it is the last scene of v2.

**What to do**

- **Now, at no cost (cut 1b, about 60 s, the same voice takes):** rebuild from `takes-elevenlabs/` with these scenes only: `s2` → `s3` (first two phrases; stop before "And someone who's having fun?") → `s4` → `s5a` → `s6` → `s7` (first phrase only, ending at "…on their instrument."; this removes the offline line) → `s9`. Drop `s1` (the workshop), `s5b` (NFC) and `shop`. Re-shoot scene 4's phone signed in, so it shows a saved instrument and the Share sheet, and change the QR card and label from `/handpan/d-kurd` to a shared code (`oakhum.com/s/…`). Voice left: about 47 s, so about 60 s with the scene leads. Use this in emails until v2 exists.
- **Then v2 (below):** new words, one promise, the maker's dashboard. It needs about 640 ElevenLabs characters and makers phases 2–3 for its last scene.

## 3. Makers v2 (60 s)

- **Goal:** a maker who watched it can say the promise back, and clicks through to `/makers` to save a first instrument. Success: replies to the cold email, and maker accounts with at least one shared instrument.
- **Audience:** makers and shops, cold.
- **Hook (0–3 s):** a phone scans a card in an instrument case and that instrument opens. The promise is on screen before anything is explained.
- **Folder:** `scripts/demo-video/makers-v2/` (`lines.py` is written). Voice: 123 words, about 640 characters.
- **Recording:** a signed-in demo maker account with one saved custom instrument: a D Kurd with two bottom notes, named "D Kurd 9+2", made with `/handpan/custom?ding=D3&top=A3,Bb3,C4,D4,E4,F4,G4,A4&bottom=F3,G3&tc=8&bc=3&name=D%20Kurd%209%2B2` and then **Save**. Scenes 1 and 5 are a second, signed-out browser.

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub) | App sound |
|---|---|---|---|---|---|
| 1 | `m1` · phone, 6 s | A QR card lying in an open case (a still made like `scenes/qr-card.png`, with the shared code). Then the buyer's phone: `oakhum.com/s/<CODE>` opening on the instrument, "D Kurd 9+2", notes lit by **Scale** (`play-scale`). The row "Made by <maker>" under the app bar shows when the code belongs to an approved maker: record with a demo maker account that an admin has approved. | "Your buyer scans one code…" / "and their instrument is on their phone, ready to play." | **One code in the case. Their instrument, ready to play.** | The scale, full volume from 0.5 s |
| 2 | `m2` · still, 7 s | The brand handpan picture, greyed, on a shelf line (cut 1's scene `s2` picture). | "Most new owners play the scale for a week, and then get stuck." / "That's when an instrument moves to the shelf." | **The first week is the hardest** / "What do I play now?" | — |
| 3 | `m3` · phone, 11 s | Maker's phone, signed in: `/handpan/custom?…` (above). The layout with both shells: tap **Bottom**, the two bottom notes show. Tap **Save**; the label "Not saved" goes and the name appears in **My instruments**. | "So set each instrument up once, exactly as you built it." / "Your scale, your layout, every bottom note." / "Save it." | **Save it once** / Exactly as you built it | A soft D minor under the voice |
| 4 | `m4` · phone, 9 s | Tap **⋯** (`menu-open`) → **Share…** → the sheet "Share this instrument": code, link, QR code. Then a still: the QR on a card and on a certificate. *(needs: makers phase 2 for the printable QR card, sticker sheet and NFC instructions from the maker's own screen; the Share sheet works today)* | "It gets its own code." / "Print it on a card for the case, or on the certificate." | **It gets its own code** / On a card, the certificate, or an NFC tag | — |
| 5 | `m5` · phone, 10 s | Buyer's phone again (signed out): the shared instrument, tap **Chords**, tap **D Minor**, then **Bb Major**: lit on *that* layout, bottom notes included. Then the **Songs** tab → **Popular**: the songs it can play. | "Every scan opens that instrument." / "With every chord it can play, and the songs that fit it." / "No app to install. No sign-up." | **Every scan opens that instrument** / Chords and songs · no app, no sign-up | The two chords, from the recording |
| 6 | `m6` · phone, 9 s | **(needs: makers phases 2–3)** The maker dashboard (Settings › Makers): the maker's instruments in a list, each with its code and its scan count; the maker's name and logo at the top. Until it exists, hold scene 5 for 4 s longer and cut this scene; the video is then 51 s and the voice take `m6` is not used. | "And you see it working: which instruments were opened, and how often." | **You see every scan** / Your instruments, your name | — |
| 7 | `m7` · card, 8 s | End card: logo · **Save it once. Every scan opens it.** · "For makers of handpans, kalimbas, flutes and more" · "Free for you and your buyers" · **oakhum.com/makers** | "It's free, for you and for your buyers." / "Oakhum." / "Let's get your instruments played!" | as the card | F major, then C major |

**What is deliberately not in it:** NFC as its own scene (a caption sub-line only), the shop's product-page link, Listen and jams, offline, "made in Latvia". They are all on `/makers` or in the kit.

**The last line** is sent to ElevenLabs as in cut 1: `[excited] Let's get your instruments PLAYED!`, so the weight falls on "played".

**9:16 cut** (for makers' own Instagram and for a Reel): scenes 1, 3, 4, 5 and 7, about 40 s. Scene 1 in 9:16 is the strongest single clip in the set: on its own (6 s, with the end card) it is the Reel a maker who joined can post with their own instrument.

**Can be filmed today:** scenes 1–5 and 7, with "Made by <maker>" (an approved demo maker account). **Waiting for makers phases 2–3:** scene 6, the dashboard with its instruments and scan counts.

## 4. Where the makers video goes

- **`/makers`**, at the top. The page's line "A minute and a half: how one link in the box keeps your buyers playing" becomes "One minute: …" when v2 replaces cut 1 (that text is in Sanity / `site/src/content/seed.ts`; the site session owns it).
- **Cold emails to makers** (`docs/maker-kit.md`): the email links to `/makers`, where the video is the first thing on the page. Never attach it.
- **Makers' own Instagram:** the 9:16 scene 1, re-shot with their instrument, for a maker who asks.

## 5. History: the script of cut 1 (18 Nov 2026)

Kept because the video on the site was built from it and its takes are in `scripts/demo-video/makers/takes-elevenlabs/`. Do not use it for new work.

Cut 1 runs about 94 s. The voice is ElevenLabs "Liam" (eleven_v4), one take per line (`scripts/demo-video/makers/lines.py`); rebuild without spending credits with `voiceover.py --from takes-elevenlabs --out vo-elevenlabs`, then `compose.py vo-elevenlabs`. The app's own handpan plays under the voice. It uses the brand landscape and instrument pictures in place of workshop footage. The QR card it renders (`scenes/qr-card.png`) is a real code for the D Kurd page.

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| s1 | The brand landscape. | "Shaping, tuning, listening… and tuning again, until every note sings." | You put weeks into every instrument you make. |
| s2 | A greyed handpan on a shelf. | "Then it arrives at someone's door, and they're thrilled! They play it every day… until, one day, it quietly moves to the shelf." | But the first week is the hardest for many buyers. |
| s3 | Three instruments. | "We made Oakhum so that doesn't happen. It shows people what their own instrument can do. No lessons, no theory. And someone who's having fun? They tell everyone about it." | Oakhum helps every buyer keep playing. |
| s4 | The phone on the D Kurd layout (it says "Not saved"). | "Here's how it works. You set up the instrument once, even a scale nobody else makes. Save it with a free account, and it gets its very own link." | Set it up once |
| s5a | A certificate and a QR card. | "That link travels in the box. So your buyers never have to write and ask you what to play." | Print its QR code |
| s5b | A phone writing an NFC tag. | "Want a little magic? Hide it in an NFC sticker. Writing one takes a few seconds." | Or write it to an NFC tag |
| s6 | The phone: D Kurd chords. | "And now the best part. They unbox it, tap their phone… and there it is: ready to play!" | One tap: their own instrument opens |
| s7 | The same recording. | "Every chord lights up, right where it lives on their instrument. And when a friend picks up a guitar, Oakhum listens, and shows them how to join in. It even works offline, around the campfire." | Every chord it can play |
| shop | The website's playable handpan in a browser frame. | "On your shop, people can hear your scales and play them, before they buy. Even the unusual ones." | Link every scale you sell from your shop |
| s9 | End card. | "Oakhum is made in Latvia, on Oak Street. It's free, for you and for every player. Let's get your instruments played!" | Help your instruments get played |
