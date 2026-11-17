# Oakhum video: script for review

Version 1, 17 Nov 2026. **Status:** script only. Nothing gets rendered until the owner approves it.

## Rules for every Oakhum video

1. **Why, then how, then what.** Every video opens with why Oakhum exists, then shows how it starts from your own instrument, then what it does. The opening and the ending are the same in every video; only the middle changes per instrument.
2. **Don't list every instrument.** Write "handpans, kalimbas, flutes and more" (or swap one name for the video's own instrument). The list will grow, and videos shouldn't need remaking because of that. The same goes for posts and the website.
3. **One thing per scene.** Each scene says one sentence and shows one thing.
4. **No music-theory words in the voice-over.** Chord names may appear on screen; the voice says "chord", not "minor sixth".
5. **Sound has three layers:**
   - **the voice-over**
   - **the instrument itself:** the app's own notes, or real playing
   - **room sound** under the opening and the ending: a jam, laughter
   - There is **no stock music**, so nothing needs a licence.
6. **Captions are burned in.** Most people watch with the sound off.
7. **Formats, made from the same scenes:**
   - **16:9 master** (1920 × 1080) for YouTube, the website and desktop: the phone screen on one side, words or footage on the other.
   - **9:16 cut** (1080 × 1920) for Reels, Shorts and TikTok: footage on top, the phone below.
   - Reddit and Facebook take either.

## The script (about 50 s)

### 1. Why (common opening, about 14 s)

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 1 | Close-up of hands on an instrument in soft light. The first notes ring. | "You fell in love with the sound." | You fell in love with the sound |
| 2 | Friends around a fire with a guitar. Our player sits a little apart and listens. | "But nobody taught you music. So when friends start to jam… you listen." | Nobody taught you music |
| 3 | The same player joins in, smiling. | "Oakhum is here so you can join in. Have fun, find your own sound, and maybe one day call yourself a musician." | Join in. Have fun. Discover. |

### 2. How (common, about 8 s; the instrument shown can be swapped)

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 4 | The phone on the "Play my notes" setup. Each note is struck, and the app fills in the instrument note by note. | "It starts from your own instrument. Play its notes, and Oakhum works out exactly what you have." | It starts from *your* instrument |

### 3. What (per instrument, about 20 s; handpan version below)

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 5 | Chords screen. Tap D minor: the three notes light up on the pan and ring out. Then B♭ and F. | "Then it shows what your notes can do: every chord, right where it lives on your instrument." | Every chord, on your own instrument |
| 6 | A guitar plays a chord off-screen. Listen mode shows the same chord lit up on the pan. | "A friend plays a chord? Oakhum hears it and shows you where to play." | Hear it. See it. Play it. |
| 7 | Paste a song's chords. The app fits them to the pan; level 1 plays the root notes. | "Want a song? Paste its chords and learn it step by step." | Any song, step by step |

For other instruments, scenes 5–7 keep the same voice-over and swap the picture, for example the kalimba's keys or the ocarina's fingering diagram.

### 4. Ending (common, about 8 s)

| # | Picture | Voice-over | Caption |
|---|---|---|---|
| 8 | Back to the fire, everyone playing together. Then the end card: logo, "Handpans, kalimbas, flutes and more", "Free in your browser", **oakhum.com** | "Oakhum. Find the music hiding in your instrument." | Find the music hiding in your instrument |

## What it needs

- **Footage for scenes 1–3 and 8.** There are three options:
  - **a)** The owner films 4 short phone clips: hands on the handpan, a friend with a guitar, a smile, everyone playing. About 15 minutes; this gives the best result.
  - **b)** Free stock footage (Pexels or Pixabay; their licences allow commercial use without credit).
  - **c)** The brand hero images in `brand/` with slow pans and zooms. Free and on-brand, but no people.
- **Scene 6 (Listen):** a real guitar chord into the microphone. Recording it from a real phone is best; otherwise I feed a recorded guitar chord in as the microphone.
- **Voice:** text-to-speech in English, a warm, calm voice. The script is about 650 characters, so one take costs cents with pay-as-you-go APIs. Options are listed in the reply to the owner.
- **Scenes 4, 5 and 7:** recorded from the live app with `scripts/demo-video`. Scene 6 needs the guitar sound from the point above.
