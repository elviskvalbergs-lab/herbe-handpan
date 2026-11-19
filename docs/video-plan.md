# Oakhum videos: the plan

Version 1, 19 Nov 2026. **Status:** for the owner's review. Nothing past the makers video gets made until this is agreed.

The rules from `docs/video-script.md` hold for every video: why, then how, then what; "handpans, kalimbas, flutes and more", never the full list; one thing per scene; captions burned in; no music-theory words in the voice. The voice is ElevenLabs "Liam" (eleven_v4), as in the makers video: it tells the story, the captions say the point.

## The set: three kinds of video

| Video | For | Length | What it does | Where it goes |
|---|---|---|---|---|
| **1. What Oakhum is** (overview) | Anyone who plays or wants to play | 40–50 s | The why, with a quick how and what. Makes people want to try. | Home page, Reddit and Facebook posts, Instagram/TikTok (9:16 cut) |
| **2. How to set up your instrument** (one per instrument: handpan, tongue drum, kalimba, ocarina, flute or whistle) | Someone who has just opened the app | 60–90 s each | Shows the setup done right, step by step, on the real app, then the first chord, then where to tell us if something doesn't work. | Each instrument page on the website; linked from the app's setup ("Watch how") later; YouTube |
| **3. For makers** | Makers and shops | 94 s | Done. | `/makers` |

The overview and the tutorials share the same opening look, voice and ending, the way the makers video does, so they read as one series.

## 1. What Oakhum is (overview)

This replaces the draft in `docs/video-script.md`, which tried to be the overview and the how-to at once. Shorter, mostly why.

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 1 | Hands on an instrument in soft light; the first notes ring | "You fell in love with the sound." | You fell in love with the sound |
| 2 | Friends around a fire with a guitar; our player sits a little apart | "But when your friends start to jam… you just listen." | Nobody taught you music |
| 3 | The same player joins in, smiling | "Oakhum is here so you can join in. No lessons, no theory." | Join in |
| 4 | Phone: "Play my notes", notes filling in one by one | "Play your instrument's notes, and it works out exactly what you have. Even one you made yourself." | It starts from *your* instrument |
| 5 | Chords lighting up on the instrument, then a song's chords pasted in | "Then it shows every chord your notes can make, right where they live. A friend plays a chord? It listens, and shows you where to join." | Every chord. Any jam. |
| 6 | Everyone playing together. End card: logo, "Handpans, kalimbas, flutes and more", "Free, in your browser", **oakhum.com** | "It's free, and it's made in Latvia, on Oak Street. Oakhum: find the music hiding in your instrument." | Find the music hiding in your instrument |

About 45 s. A 9:16 cut from the same scenes for Reels, Shorts and TikTok.

## 2. How to set up your instrument (tutorials)

Every tutorial has the same shape. Only the middle (steps 2–3) is the instrument's own, because that is where the setups really differ.

| Part | Picture | Voice-over (handpan words; the others swap theirs in) |
|---|---|---|
| 1. Hello (common, ~5 s) | The instrument's picture, then the app's "What do you play?" | "Let's set up your handpan. It takes about a minute." |
| 2. Play my notes (per instrument, ~25 s) | The real setup screen, recorded from the live app, with the instrument's real sound going into the microphone | How many notes, where to start, the playing order, how to play each note (below) |
| 3. Or: I know my scale (per instrument, ~10 s) | The "I know my scale/key" path | Where the scale or key is usually written |
| 4. Your first chord (common, ~10 s) | The ready screen; tap a chord, it lights up and plays | "There it is: your instrument, with every chord it can play. Tap one and play along." |
| 5. Keep it (common, ~8 s) | Save with a free account; add to home screen | "Save it with a free account, and it's on all your devices, even offline." |
| 6. Tell us (common ending, ~7 s) | Settings → Send feedback; end card with the instrument's page | "Something not right, or confusing? Tap Settings, then Send feedback. We read every message, and it really helps." |

**What really differs per instrument** (from the app's setup, `js/app.js` and `js/setup.js`):

| Instrument | Play my notes | I know my… | Watch out for |
|---|---|---|---|
| Handpan | Count the notes (9 by default; bottom notes too), start with the ding, then round the pan clockwise from the bottom. Strike once, let it ring, damp before the next. | Scale: the middle note, then the common scales; the rest behind "Show all" | A quiet room; damp each note, or the next one is heard wrong |
| Tongue drum | Count the tongues, start with the lowest, then round the drum. Strike once and let it ring. | Scale: usually on the box or a sticker underneath | Same as handpan |
| Kalimba | 17 keys by default. Start with the long key in the middle, then left to right. Pluck once, damp before the next. | Key: often stamped on the keys | Keys ring into each other: damp with a finger |
| Ocarina | Start with the lowest note, every hole covered (thumb holes too), then up the scale, lifting one finger at a time. Blow gently, hold for a second. | Key: written on it or its box ("12-hole in C") | Breath changes pitch: blow steadily. Its chords play as arpeggios, with each fingering shown in turn |
| Flute or whistle | Lowest note with every hole covered, then up, lifting one finger at a time. Hold each for a second. | Key: marked on it, D on most tin whistles, often A or F♯ on a Native American flute | Same as ocarina |

## How they get made

- **Screen and sound from the live app**, with the same tools as the makers video (`scripts/demo-video/`): Playwright records the app, its own sound is tapped, the voice and captions go on top.
- **"Play my notes" needs sound in the microphone.** Chromium can play a recording as its microphone, so the app hears real notes. That needs a recording of each instrument playing its notes one by one, in the setup's order: best from the owner's own instruments (a phone recording is enough), otherwise the app's own sound for that instrument.
- **Credits:** ElevenLabs costs about 1 credit per character, one take per line. Overview about 700, each tutorial about 1,000–1,200: the whole set is about 6,000–6,500 credits. The free account has about 8,300 left this month, so it fits once, with little room for retakes. To be safe, each script is first voiced with the free Kokoro voice to check timing and wording, and only the agreed text goes to ElevenLabs.

## Build order

1. **Overview**: it's what every post and the home page need first.
2. **Handpan tutorial**: the biggest audience and the most finished setup. It sets the common parts (hello, first chord, keep it, tell us) that the others reuse.
3. **Kalimba and tongue drum tutorials** (week 3 of the launch plan).
4. **Ocarina and flute tutorials** (week 4).

## Questions for the owner

1. **Instrument recordings:** which instruments do you have to record their notes for "Play my notes" (a phone recording of each note, in order, is enough)? For the others, the app's own sound stands in.
2. **Footage for the overview's opening and ending** (hands on an instrument, friends with a guitar, everyone playing): your own short clips, free stock footage, or the brand pictures as in the makers video?
3. **Tutorial format:** 16:9 only (for the website and YouTube), or a 9:16 cut too?
4. **The overview script above:** OK as a starting point?
