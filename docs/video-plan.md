# Oakhum videos: the plan and the scripts

**Status: current** (shots checked against `preview` on 22 Nov 2026). This is the one document for every Oakhum video except the makers one, whose message and script are in `docs/video-script-makers.md`. It replaces `docs/video-script.md` (the first overview draft, 18 Nov) and the earlier version of this plan (19 Nov), which each had their own overview script. Words come from `docs/messaging.md`.

**What exists today:** the makers video, cut 1 (94 s, on `/makers`), and a first overview cut (44 s, Kokoro voice, never published). **Everything below is a script**, written so the video session can build it with `scripts/demo-video/` as it is.

Every shot was checked against the app built from `preview` on 22 Nov 2026. Since the first version of this plan the product gained: the tabs Chords · Songs · Playlists and the instrument's own (Pan, Keys, Drum or Notes); one kind of list, Playlists; the song chips Christmas · Popular · Countries and a link for every song (`/<family>/<tuning>/songs/<song>`); the Chords switch All chords · Tap notes · Listen; note names written as the scale writes them (B♭ on a D Kurd); "Keep this handpan" on the last setup step; the recorder; the help centre at `/help`; and the whole makers programme. Nothing in this plan waits for unreleased work any more; §11 lists what each video still needs for the shoot.

---

## 1. Rules for every video

1. **One idea per video, one thing per scene.** The idea is in the caption of the first scene and again on the end card.
2. **The hook is in the first 3 seconds**, as a caption and as picture, before any logo. For jammers the hook is a question about *their* instrument. No "why" opening longer than one scene.
3. **The voice tells the story; the captions say the point.** People can read, so the voice doesn't read the caption aloud: it says what happens around it.
4. **No music-theory words in the voice.** Chord names may be on screen; the voice says "chord".
5. **Instruments in the voice and in burned-in text:** "handpans, kalimbas, flutes and more", or the one instrument the video is about. Never the full list (the owner's rule: it keeps growing, and a video can't be edited).
6. **Honest about free:** end cards say "Free. No sign-up to try." Nothing says or shows saving or offline without the words "free account". A recording that shows a saved instrument is made signed in; a guest recording shows "Not saved", which is fine in a video about trying and wrong in a video about saving.
7. **No numbers in the voice** that the catalogue can change (songs, scales). The screen may show them, because the screen is the app.
8. **Sound has three layers:** the voice; the app's own instrument sound (tapped from the page by `record.js`), loud when nobody speaks and ducked under the voice; nothing else. No stock music, so nothing needs a licence.
9. **Captions are burned in.** Most people watch with the sound off, so every video must make sense muted.
10. **Formats from the same scenes:** a 16:9 master (1920 × 1080: words on the left, the phone on the right) for the website and YouTube, and a 9:16 cut (1080 × 1920: caption band on top, the phone below, as `scripts/demo-video/compose.py` already does) for Reels, Shorts, TikTok and Reddit. Each script has a 9:16 note.

## 2. How a script maps onto the pipeline

Each video is a folder under `scripts/demo-video/` with the same three files as `makers/` and `overview/`:

| File | What it holds | In this document |
|---|---|---|
| `lines.py` | `LINES`: scene key → list of phrases (a new list item is a real pause). `../voiceover.py` makes one take per key. | The **Voice-over** column. The `lines.py` files for every video below are already written and committed. |
| `scenes.js` | The still scenes: `copy(big, sub, n)` for the words on the left, `phone()` for the frame a recording is laid into. | The **Caption** column: `big` / `sub`. A number in a circle (`n`) only in the how-to videos. |
| a recording script (like `../record.js`) | Playwright on a 390 × 844 phone at 2×, the page's sound tapped, `mark('name')` before each tap. | The **Picture** column: the deep link to `goto`, then the taps, each with the `data-action` to click. |
| `compose.py` | Scene lengths fitted to the voice (`v.still`, `v.phone`, `v.fit`), the app's sound laid under. | The **Length** in each heading; scene lengths are "voice + 1.5 s" unless a script says otherwise. |

Scene **kinds**: *still* (a picture made by `scenes.js`), *phone* (a still with the phone frame and a recording inside it), *card* (the end card, `zoom=False`).

**Pace.** "Liam" speaks about 2.3 words a second including pauses (the makers video: 219 words of voice in 94 s). The word counts below are set from that: a script that runs long is cut in words, never by speeding up the voice.

**Voice.** ElevenLabs "Liam" (eleven_v4), one take per scene key, kept in the video's `takes-elevenlabs/`. First cuts use the free Kokoro voice to check words and timing; only agreed text goes to ElevenLabs. Characters (about 1 credit each) are given per script.

**Where to record.** `record.js` records `https://oakhum.com`. Record on the preview deployment when production is behind `preview`. Shots of saved instruments, Share and playing a chord sheet need **a signed-in demo account**: sign in once in a persistent Playwright profile with a test address, and save the demo instruments there ("Elvis's D Kurd", "Anna's kalimba").

**"Play my notes" needs sound in the microphone.** Launch Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<notes.wav>`: the app then hears the WAV as its microphone. The WAV is each note of the instrument, one by one, with a second of silence between; best a phone recording of a real instrument, otherwise the app's own sound for that instrument rendered to a file.

**The end card** is the same for every jammer video (only the last line changes):

```
[logo]
Find the music hiding in your instrument
Handpans, kalimbas, flutes and more
Free. No sign-up to try.
oakhum.com
```

---

## 3. The set

| # | Video | Audience | Length | Idea | Where it goes |
|---|---|---|---|---|---|
| A | **What can your instrument play?** (overview) | Jammers | 40 s | It starts from the instrument you own | Home page hero, every launch post, 9:16 for Reels/Shorts/TikTok |
| B | **Play my notes** | Jammers who don't know their tuning | 25 s | Play its notes and Oakhum works out your instrument | Home page "how it works", kalimba and tongue drum posts, the help centre's setup page |
| C | **Songs you can play today** | Jammers who want tunes | 26 s | The songs your notes can play, with the tab | Home page Songs section, r/kalimba, r/ocarina, r/tinwhistle posts |
| D | **Play along with a guitarist** | Jammers who play with friends | 28 s | A song's chords, in order, on your instrument | Handpan posts, the handpan instrument page |
| E | **For makers, v2** | Makers and shops | 60 s | Save it once; every scan opens it | `/makers`, cold emails. Script in `docs/video-script-makers.md` |
| F1–F6 | **What can your [instrument] play?** × 6 | Owners of that instrument | 16–18 s each | One instrument: its chords and one song | Each instrument page, social, that instrument's communities |
| G1–G3 | **How to**: set up · save and add to home screen · share with a code | People already in the app | 70–80 s each | One task, start to finish | The help centre at `/help` (the articles named in §9), YouTube |

A is the only one that tries to say everything. B, C and D each take one sentence of A and show it properly.

---

## 4. A · What can your instrument play? (overview, 40 s)

- **Goal:** a stranger who owns one of these instruments taps the link. Success is `first_play` on the app within the same visit.
- **Audience:** jammers, any instrument.
- **Hook (0–3 s):** the question "What can *your* instrument play?" over three instruments, each with a different set of notes.
- **Folder:** `scripts/demo-video/overview/` (replaces its current six scenes; the scene keys stay `o1`–`o6`, but `o2`–`o5` are all phone scenes now, so its `compose.py` needs four recordings instead of one). Voice: 94 words, about 465 characters.
- **Built (26 Nov), first cut with the Kokoro voice, 43 s:** `overview/record.js` makes the four phone recordings from the live app (`../phone-recorder.js`), `scenes.js` the hook and the end card, `compose.py` the video. Scene 5's guitar is a stand-in made by `overview/guitar.py` (a plucked-string D minor, then B♭, which Listen recognises); a phone recording of a real guitar replaces `guitar.wav` without other changes. Next: the owner's check, then the ElevenLabs take and the 9:16 cut.

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub) | App sound |
|---|---|---|---|---|---|
| 1 | `o1` · still, 4 s | Brand pictures of a handpan, a kalimba and an ocarina (`brand/instruments/`), each with its note names under it (D Kurd: D A B♭ C D E F G A · 17-key kalimba in C · alto C ocarina). | "You don't need to be a musician to make music." / "And every one of these has its own notes." / "So what can *yours* actually play?" (the first line is the owner's, 26 Nov) | **What can *your* instrument play?** | D Kurd scale (`play-scale`), full volume for the first second |
| 2 | `o2` · phone, 7 s | `/play` as a new visitor: "What do you play?" with the instrument tiles. Tap **Handpan** (`setup-family`, `data-family="handpan"`): "Let's find out which handpan you have". Hold on the two buttons, "I know my scale" and "Play my notes". | "Tell Oakhum which one you have." / "Or just play its notes, and it works it out." | **It starts from your instrument** / Pick it, or play its notes | — |
| 3 | `o3` · phone, 8 s | `/handpan/d-kurd/chords`. Tap the row **D Minor** (`select-chord`): three notes light up on the pan and ring. Then **Bb Major**, then **F Major**. | "Then it shows every chord your notes can make, right where they live." | **Every chord, on your own instrument** | The three chords, from the recording |
| 4 | `o4` · phone, 8 s | `/kalimba/c-major-17/songs/ode-to-joy` (the song's own link), tap **Play** (`song-play`): the keys light one by one and the tab follows. | "And the songs they can play, note by note." | **Songs your notes can play** / With the tab | The melody, from the recording |
| 5 | `o5` · phone, 7 s | `/handpan/d-kurd/chords`, tap **Listen** in the All chords · Tap notes · Listen switch (`toggle-discover-mode`), then **Listen**. A guitar chord goes in as the microphone (`--use-file-for-fake-audio-capture`, a recorded D minor then B♭): the chord appears, lit on the pan. | "A friend picks up a guitar?" / "It listens, and shows you where to join in." | **Join in** / Oakhum hears the chord and shows it on yours | The guitar chord, then the pan answering |
| 6 | `o6` · card, 6 s | The end card (§2). | "It's free, and there's no sign-up to try." / "Oakhum." / "Find the music hiding in your instrument!" | **Find the music hiding in your instrument** / Free. No sign-up to try. · oakhum.com | F major, then C major, as in the makers video |

**9:16 cut:** all six scenes; in `o1` stack the three instruments vertically. This is the main cut for social: check that scene 1 reads with the sound off and the caption band is clear of the platform's own buttons (keep text out of the bottom 320 px and the top 220 px).

**What changed from the two older scripts, and why.** Both opened with 14 seconds of "you fell in love with the sound… you just listen" before the app appeared. That is a handpan owner's story; a kalimba or ocarina owner bought the instrument to play tunes. The opening is now a question every owner has, the app is on screen by second 4, Songs has its own scene, and "made in Latvia, on Oak Street" moved out of this video (it stays on the website and in posts). "Even one you made yourself" is gone: the clay ocarina builder is not marketed.

---

## 5. B · Play my notes (25 s)

- **Goal:** take away the first reason people leave setup ("I don't know my scale"). Success is the share of `setup` events that go through the listen path, and setup completions.
- **Audience:** owners who don't know their tuning: most kalimba and tongue drum owners, many handpan owners with a second-hand instrument.
- **Hook (0–3 s):** "Don't know what your kalimba is tuned to?" over the setup screen.
- **Folder:** `scripts/demo-video/play-my-notes/`. Voice: 38 words, about 190 characters (plus one 8-word take for the handpan variant). Can be filmed today.

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub) | App sound |
|---|---|---|---|---|---|
| 1 | `p1` · phone, 4 s | `/play` as a new visitor, tap **Kalimba** (`setup-family`, `data-family="kalimba"`): "Let's find out which kalimba you have · No need to know its key." | "Don't know what your kalimba is tuned to?" | **Don't know your tuning?** | — |
| 2 | `p2` · phone, 8 s | Tap **Play my notes** (`setup-listen`). "How many notes does your kalimba have?" shows 17: tap **Start**. The microphone gets the kalimba WAV (§2): the keys fill in one by one as each note is plucked. | "Put your phone next to it." / "Then play each note, once." | **Play each note, once** / Any order | The plucked notes themselves (the WAV, mixed in so the viewer hears what the app hears) |
| 3 | `p3` · phone, 6 s | The last keys fill in; the last step, "Ready": "Your … kalimba is ready · Start with this chord", with the buttons **Keep this kalimba** and **Play my first chord**. | "Oakhum listens…" / "and works out exactly which one you have." | **Oakhum works out the rest** | — |
| 4 | `p4` · phone, 4 s | Tap **Play my first chord** (`setup-first-chord`): the chord lights on the keys and plays. | "And there it is: everything it can play." | **Your instrument, ready** | C major on the kalimba |
| 5 | `p5` · card, 3 s | The end card, last line: "Free. No sign-up to try. · oakhum.com" | — (sound only) | **Play my notes** / Free. No sign-up to try. · oakhum.com | The chord rings out |

**9:16 cut:** this one is made 9:16 first; the 16:9 master is for the help centre. For a handpan version swap scene 1's instrument (tap **Handpan**; the screen then says "Play the big note in the middle") and the WAV; the words "your kalimba" in `p1` become "your handpan" (one extra take).

**Watch for:** the screen says "Oakhum only listens while this screen is open. The sound stays on your phone unless you choose to send it to us." Leave that line readable in scene 1; it answers the microphone worry without the voice having to.

---

## 6. C · Songs you can play today (26 s)

- **Goal:** show tune-players (kalimba, ocarina, whistle, tongue drum) that Oakhum has songs, not only chords. Success is `feature: song-play` per visit from the posts that carry this video.
- **Audience:** jammers who want tunes.
- **Hook (0–3 s):** a song title, and its notes lighting on a kalimba, with the caption "Songs your kalimba can play today".
- **Folder:** `scripts/demo-video/songs/`. Voice: 49 words, about 260 characters (plus about 250 for the ocarina, whistle and Christmas variants). Can be filmed today. Every song has its own link, so a recording can open straight on it, and the post that carries this video links to the same song.

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub) | App sound |
|---|---|---|---|---|---|
| 1 | `g1` · phone, 4 s | `/kalimba/c-major-17/songs/ode-to-joy` (the song's own link) → **Play** (`song-play`), already playing when the video starts (start the clip a second after the tap). | "This is a song your kalimba can play." / "Today." | **Songs your kalimba can play today** | The melody, full volume |
| 2 | `g2` · phone, 7 s | Back (`nav-back`) to the list under **Songs to learn**: the chips **Christmas · Popular · Countries**, the titles, each with country, key and time, and the line "… more need notes your kalimba doesn't have" in view. | "Your instrument only has certain notes." / "So Oakhum lists the songs those notes can play." | **Only the songs your notes can play** | — |
| 3 | `g3` · phone, 7 s | Open **Twinkle, Twinkle, Little Star**, tap **Tab** (`song-view`) then **Play**: the tab scrolls, numbers with octave dots, left and right thumb, the words under the notes. | "Pick one. It lights each note in turn," / "and writes the tab the way kalimba players read it." | **With the tab** / Numbers, thumbs, words | The melody |
| 4 | `g4` · phone, 5 s | `/handpan/d-kurd/songs/twinkle-twinkle` → **Play**: the same song on a handpan, its own tab (R and L hands). | "On a handpan, the same song, in its own tab." | **Handpans, flutes and more** | The melody on the pan |
| 5 | `g5` · card, 3 s | The end card, last line "Folk songs, children's songs and carols · oakhum.com" | — | **Songs your notes can play** / Free. No sign-up to try. · oakhum.com | Last notes ring |

**9:16 cut:** all scenes. For r/ocarina and r/tinwhistle, make a wind variant by swapping scenes 1–3 to `/ocarina/alto-c-12` or `/flute/tin-whistle-d` (`/ocarina/alto-c-12/songs`, `/flute/tin-whistle-d/songs`; the tab shows note letters and each fingering in turn) and re-voicing `g1` and `g3` with "ocarina" / "tin whistle" (two extra takes each, in `lines.py` as `g1_ocarina`, `g3_ocarina`, `g1_whistle`, `g3_whistle`).

**Seasonal cut:** from 15 November to 6 January the song list opens on the **Christmas** chip ("Christmas · 28" on a 17-key kalimba), so in that season scene 2 shows carols unless **Popular** is tapped first. For the Christmas cut, leave it on Christmas, swap scene 1 to **Silent Night** and the caption to "Carols your kalimba can play". Same voice takes except `g1` ("This is a carol your kalimba can play. Tonight."), in `lines.py` as `g1_christmas`.

**Don't say** how many songs there are. It differs a lot by instrument (see `docs/messaging.md` §3), and the screen shows the true number for the instrument on screen.

---

## 7. D · Play along with a guitarist (28 s)

- **Goal:** the handpan owner's wish: play with a friend's guitar. Success is `feature: chord-sheet` and `feature: listen` per visit from handpan posts.
- **Audience:** jammers who play with friends, mostly handpan and tongue drum.
- **Hook (0–3 s):** "Your friend has a guitar and a song. You have nine notes."
- **Folder:** `scripts/demo-video/play-along/`. Voice: 49 words, about 250 characters.
- **Needs a signed-in demo account** for scenes 3–4: a guest can paste a chord sheet and see how it fits, but "Save playlist" (which is what opens the play screen) asks for the free account. The video shows the saved song, so the voice says "save it".

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub) | App sound |
|---|---|---|---|---|---|
| 1 | `d1` · still, 4 s | The brand handpan picture and a guitar chord chart of the song ("Dm  B♭  F  C" written over two lines of lyrics). | "Your friend has a guitar, and a song." / "You have nine notes." | **Play along with a guitarist** | One guitar strum (the recorded D minor from video A), then silence |
| 2 | `d2` · phone, 7 s | Signed in, `/handpan/d-kurd/songs`, under "Chords of a song" tap **Paste a chord sheet** (`cs-open`; the same button is on the Playlists tab), paste `{title: Campfire song}` / `Dm | Bb | F | C` / `Dm | Bb | F | C`, tap **Next** (`cs-next`): "Fit to D Kurd · As written · 100% · 8 of 8 steps · Plays". | "Paste the song's chords." / "Oakhum fits them to the notes you have." | **Paste the chords** / It fits them to your notes | — |
| 3 | `d3` · phone, 8 s | Tap **Save playlist** (`cs-save`); the song opens. Tap **Play**: Dm, B♭, F, C light on the pan one after another, in the song's order. | "Save it, and you get the chords in order," / "each one lit on your handpan." | **The chords, in order** / On your own instrument | The four chords, from the recording |
| 4 | `d4` · phone, 6 s | Change **Level** (`prog-level`) to **Roots**: one note per chord. Hold two chords. | "Start with one note per chord." / "That's already playing along." | **Start with one note per chord** | The root notes |
| 5 | `d5` · card, 3 s | The end card, last line "Free. No sign-up to try. A free account keeps your songs. · oakhum.com" | — | **Join in** / Free. No sign-up to try. · oakhum.com | Final chord rings |

**9:16 cut:** all scenes; scene 1's chord chart goes above the handpan.

**The other half of playing along is Listen** (no song sheet: the app hears the chord). It is scene 5 of video A and can be cut as its own 12-second clip from that recording, with the caption "A friend plays a chord. Oakhum shows it on yours." and no new voice.

---

## 8. F · One clip per instrument (16–18 s each)

- **Goal:** one clip that an owner of that instrument recognises as theirs in the first second. For the top of each instrument page and for that instrument's communities.
- **Audience:** owners of that one instrument.
- **Shape (the same for all six):** the question with the instrument's name (3 s) → its chords (5 s) → one song with its tab (6 s) → end card with the instrument's page (3 s).
- **Folder:** `scripts/demo-video/instruments/`, one `lines.py` with keys `<instrument>1`…`<instrument>3`; the end card has no voice. About 26 words and 140 characters each, 830 for all six. All can be filmed today.
- **Hook (0–3 s):** the caption "What can your [instrument] play?" over the instrument itself, already sounding.

| Clip | Scene 1 (3 s): link, taps, caption | Scene 2 (5 s): chords | Scene 3 (6 s): a song | Voice-over (`…1` / `…2` / `…3`) | End card last line |
|---|---|---|---|---|---|
| **F1 Handpan** | `/handpan/d-kurd/chords`, tap **Scale** (`play-scale`). Caption: **What can your handpan play?** | Tap **D Minor**, then **Bb Major**. Caption: **Every chord, where it lives** | **Songs** tab → Popular → **Twinkle, Twinkle, Little Star** → **Play**. Caption: **Songs, with the tab** | "Nine notes. What can they play?" / "Every chord your handpan can make, right where it lives." / "And the songs that fit it. Pick your scale, or play its notes." | oakhum.com/instruments/handpan |
| **F2 Tongue drum** | `/tongue-drum/d-kurd-9/chords`, tap **Scale**. Caption: **What can your tongue drum play?** | Tap **D Minor**, then **F Major**. Caption: **Every chord, tongue by tongue** | **Songs** tab → Popular → **Twinkle, Twinkle, Little Star** → **Play**. Caption: **Songs, with the tab** | "It came with a few notes and no instructions." / "Here's every chord those notes can make." / "And the songs they can play. Just play its notes, and Oakhum knows your drum." | oakhum.com/instruments/steel-tongue-drum |
| **F3 Kalimba** | `/kalimba/c-major-17/songs` → Popular → **Ode to Joy** → **Play**. Caption: **What can your kalimba play?** | `/kalimba/c-major-17/chords`, tap **C Major**, then **A Minor**. Caption: **Chords under your thumbs** | Back to the song, **Tab** view, **Play**. Caption: **Songs, in kalimba tab** | "Seventeen keys. Where do you start?" / "With chords that sit right under your thumbs." / "And songs in kalimba tab, lit note by note." | oakhum.com/instruments/kalimba |
| **F4 Ocarina** | `/ocarina/alto-c-12`, tap notes **A4**, **C5**, **E5** on the note row: the fingering changes with each. Caption: **What can your ocarina play?** | `/ocarina/alto-c-12/chords`, tap **A Major**, tap **Chord** (`play-chord`): the three fingerings in turn. Caption: **Chords, one note at a time** | **Songs** tab → Popular → **Ode to Joy** → **Play**. Caption: **Songs, with every fingering** | "Twelve holes. A lot of fingerings." / "Here's each one, and chords played one note at a time." / "And songs with every fingering shown as you go." | oakhum.com/instruments/ocarina |
| **F5 Flute or whistle** | `/flute/tin-whistle-d`, tap **D4**, **E4**, **F#4**: the fingering changes. Caption: **What can your tin whistle play?** | `/flute/tin-whistle-d/chords`, tap **D Major**, tap **Chord** (`play-chord`): its three fingerings in turn. Caption: **Every note's fingering** | **Songs** tab → Popular → **Drunken Sailor** → **Play**. Caption: **Songs, note by note** | "Six holes, and a lot of tunes." / "Every note's fingering, as you play." / "And songs, note by note. For Native American flutes too." | oakhum.com/instruments/flute |

The ocarina's and whistle's first screen shows a legend ("covered · open · half · Got it"): tap **Got it** before the recording starts.

**9:16 cut:** these are made 9:16 first (social), with a 16:9 master for the instrument pages. The end card is the standard one with the instrument's page as the address and, above it, "Free. No sign-up to try."

| **F6 Recorder** | `/recorder/soprano-baroque`, tap **C5**, **D5**, **E5** on the note row: the fingering changes. Caption: **What can your recorder play?** | `/recorder/soprano-baroque/chords`, tap **C Major**, tap **Chord** (`play-chord`): its three fingerings in turn. Caption: **Every note's fingering** | **Songs** tab → Popular → **Ode to Joy** → **Play**. Caption: **Songs, note by note** | "The recorder from school. Still in a drawer?" / "Every note's fingering, as you play." / "And a hundred songs you already know, note by note." | oakhum.com/instruments/recorder |

---

## 9. G · How-to videos for the help centre (70–80 s each)

For people who are already in the app. Calm, exact, numbered steps on screen (`copy(big, sub, n)` with the number in a circle). Each ends with where to ask for help, not with a pitch. Each sits at the top of its help article: G1 on `/help/set-up-your-instrument`, G2 on `/help/accounts-and-saving` (and `/help/install`), G3 on `/help/sharing`. The help articles are the reference for the steps: if a video and its article disagree, check the app and fix both.

All three: **Audience** people who opened the app and want to do one thing. **Hook (0–3 s):** the task in the caption and the finished result on the phone ("this is where you'll be in a minute"). **End card:** "More help: oakhum.com/help · Something not right? Settings › Send feedback". **9:16:** not needed; if one is wanted for Shorts, cut steps 1–3 only with the step captions.

### G1 · Set up your instrument (about 75 s)

- **Goal:** more `setup` completions; fewer "it didn't hear my notes" reports.
- **Folder:** `scripts/demo-video/howto-setup/`. Voice: 146 words, about 740 characters. Can be filmed today (handpan; the table in §10 gives the words to swap for the other four).

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub / n) |
|---|---|---|---|---|
| 0 | `h0` · phone, 5 s | `/handpan/d-kurd/chords` with D Minor lit (the result). | "Let's set up your handpan. It takes about a minute." | **Set up your instrument** / About a minute |
| 1 | `h1` · phone, 8 s | `/play` as a new visitor: "What do you play?". Tap **Handpan**. | "Open oakhum.com and tap Start playing." / "Then tap your instrument." | **Tap your instrument** / n = 1 |
| 2 | `h2` · phone, 10 s | "Let's find out which handpan you have": the two buttons. | "You have two ways. If you don't know its scale, tap Play my notes." / "If you do, tap I know my scale." | **Play my notes, or I know my scale** / n = 2 |
| 3 | `h3` · phone, 22 s | Tap **Play my notes**. "How many notes…": set 9, **Start**. The microphone gets the handpan WAV: the middle note first, then round the pan. Notes fill in. | "Find a quiet room and put the phone next to the handpan." / "Count its notes, and tap Start." / "Play the big note in the middle. Strike it once, and let it ring." / "Then each note around it, one by one. Stop each note with your hand before the next." | **Play each note, once** / Quiet room · let it ring · then stop it / n = 3 |
| 4 | `h4` · phone, 10 s | Start again from step 2, tap **I know my scale**: "Which note is in the middle?" → **D** → "Which D scale?" → **D Kurd**. | "If you know the scale, pick the middle note," / "then the scale. It's usually on the sticker or the certificate." | **Or pick your scale** / It's on the sticker or certificate / n = 3 |
| 5 | `h5` · phone, 10 s | The last step, "Ready": "Your D Kurd handpan is ready". Tap **Play my first chord** (`setup-first-chord`): D minor lights up and plays. (The other button, **Keep this handpan**, is video G2.) | "That's your handpan, with every chord it can play." / "Tap Play my first chord: it lights up, and plays." | **Your first chord** / n = 4 |
| 6 | `h6` · card, 8 s | End card. | "If Oakhum hears a note wrong, tap Settings, then Send feedback." / "We read every message." | **Something not right?** / Settings › Send feedback · oakhum.com/help |

### G2 · Keep your instrument and add Oakhum to your home screen (about 75 s)

- **Goal:** `signup_done` after `save_tap`, and `install`. This is the video where the free-account line is said most carefully.
- **Folder:** `scripts/demo-video/howto-save/`. Voice: 141 words, about 730 characters. Can be filmed today; needs a test email address that receives the sign-in code, and scene 5 is filmed on a real phone or shown as stills (Playwright has no home screen).

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub / n) |
|---|---|---|---|---|
| 0 | `k0` · phone, 6 s | `/handpan/d-kurd` as a guest: the label **Not saved** and the line "Not saved · try it, then keep it in My instruments". | "You can try everything in Oakhum without an account." / "But when you close it, a guest's instrument is gone." | **Keep your instrument** / Guests keep nothing between visits |
| 1 | `k1` · phone, 8 s | Tap **Save**. The sheet: "Save your instrument · Free · takes seconds · also lets you play offline". | "To keep it, tap Save." / "A free account is just your email. There's no password." | **Tap Save** / n = 1 |
| 2 | `k2` · phone, 12 s | Type the email, tap **Send code** (`save-send-code`). Type the code from the email. | "Type your email, and tap Send code." / "We email you a short code. Type it in, and you're signed in." | **Type the code we email you** / No password / n = 2 |
| 3 | `k3` · phone, 10 s | The instrument is now in **My instruments**; the "Not saved" label is gone. Tap the name to show the list. | "Your instrument is now in My instruments," / "on every device where you sign in." | **It's in My instruments** / On every device you sign in on / n = 3 |
| 4 | `k4` · phone, 10 s | The same screen with the connection off (Playwright `context.setOffline(true)`), tap a chord: it still plays. | "And it works with no signal." / "Open it once while you're online, and after that it's there offline too." | **Works offline, with your account** / n = 4 |
| 5 | `k5` · still, 16 s | Three stills of a real phone: the browser's Share menu → **Add to Home Screen** → the Oakhum icon among the apps → opened full screen. (In the app, the banner "Add Oakhum to your home screen" → **Add** shows these steps.) | "One more thing: put Oakhum on your home screen." / "On an iPhone, tap Share, then Add to Home Screen." / "On Android, open the browser menu and tap Add to Home screen, or Install app." / "Now it opens like any other app." | **Add to home screen** / iPhone: Share › Add to Home Screen · Android: menu › Install app / n = 5 |
| 6 | `k6` · card, 8 s | End card. | "You can delete your account, and everything in it, any time in Settings." | **Free. Delete it any time.** / oakhum.com/help |

### G3 · Share an instrument with a code (about 70 s)

- **Goal:** more shared instruments opened (`open` on `/s/…` paths). Also the how-to that the maker kit links to.
- **Folder:** `scripts/demo-video/howto-share/`. Voice: 131 words, about 660 characters. Needs the signed-in demo account. Can be filmed today.

| # | Key · kind | Picture: link and taps | Voice-over | Caption (big / sub / n) |
|---|---|---|---|---|
| 0 | `s0` · still, 6 s | Two phones side by side showing the same custom handpan. | "Want a friend to open your exact instrument? Or the person you're giving it to?" / "Share it with a code." | **Share your instrument** / A code, a link or a QR code |
| 1 | `s1` · phone, 10 s | Signed in, the saved instrument open (a custom D Kurd with two bottom notes). Tap **⋯** (`menu-open`), tap **Share…** ("Code, link and QR code"). | "Sharing works for instruments you've saved." / "Open yours, tap the three dots, then Share." | **⋯ then Share** / For saved instruments / n = 1 |
| 2 | `s2` · phone, 14 s | The sheet "Share this instrument": the 6-character code, the link `oakhum.com/s/…`, the QR code. | "You get three things: a short code, a link, and a QR code." / "Send the link in a message. Or print the QR code on a card and keep it with the instrument." | **A code, a link, a QR code** / n = 2 |
| 3 | `s3` · phone, 14 s | A second (guest) browser opens the `/s/<CODE>` link: the same instrument opens; tap **Chords**, tap a chord. | "Whoever opens it sees your instrument, exactly as you set it up, and can play it straight away." / "They don't need an account." | **They open it and play** / No app, no sign-up / n = 3 |
| 4 | `s4` · phone, 12 s | On the shared instrument, tap **Add to my instruments** (the save sheet appears for a guest). (If the sharer is an approved maker, the row "Made by <maker>" shows under the app bar; this how-to is recorded from an ordinary account, without it.) | "It's a copy for them to look at. To keep it, they tap Add to my instruments," / "and save it with their own free account." | **To keep it: Add to my instruments** / n = 4 |
| 5 | `s5` · card, 8 s | End card. | "Do you make or sell instruments? There's more for you at oakhum dot com, slash makers." | **For makers and shops** / oakhum.com/makers · oakhum.com/help |

---

## 10. The setup how-to for the other instruments

G1 is written for the handpan. The other four use the same seven scenes; only these words and taps change (from the app's setup screens, `js/app.js` and `js/setup.js`, checked 21 Nov):

| Instrument | Scene 2 buttons | Scene 3: what the app asks, and the voice | Scene 4: where the tuning is written | Watch out for |
|---|---|---|---|---|
| Tongue drum | Play my notes · I know my scale | Count the tongues. "Play the lowest tongue, then each of the others. Strike once and let it ring." | "On the box, or a sticker underneath." | Stop each note before the next |
| Kalimba | Play my notes · I know my key | 17 by default. "Play the longest key, in the middle. Pluck it once and let it ring. Then each key, one by one." | "Often stamped on the keys." | Keys ring into each other: stop each with a finger |
| Ocarina | Play my notes · I know my key | "Start with the lowest note, every hole covered, thumbs too. Then lift one finger at a time. Blow gently and hold each note for a second." | "On the ocarina or its box: twelve-hole, in C." | Breath changes the pitch: blow steadily |
| Flute or whistle | Play my notes · I know my key | "Lowest note, every hole covered, then up, one finger at a time. Hold each for a second." | "Marked on it. D on most tin whistles." | Same as the ocarina |

---

## 11. What can be filmed today

Checked against `preview` on 21 Nov 2026.

| Video | Today? | Waiting for |
|---|---|---|
| A · Overview | **Yes.** Needs a recorded guitar chord for scene 5. | — |
| B · Play my notes | **Yes.** Needs a WAV of kalimba notes (and one of handpan notes for the variant). | — |
| C · Songs | **Yes.** | — |
| D · Play along | **Yes**, with a signed-in demo account. | — |
| E · Makers v2 | **Yes, every scene**, with a signed-in demo maker account that an admin has approved and that has a few scans on its codes. See `docs/video-script-makers.md`. | — |
| F1–F6 · Instruments | **Yes**, all six. | — |
| G1 · Set up | **Yes** (handpan WAV). | — |
| G2 · Save and add to home screen | **Yes** (test email; real-phone stills for scene 5). | — |
| G3 · Share with a code | **Yes** (signed-in demo account). | — |

## 12. Build order and credits

1. **A** (every post and the home page need it) and **B** (it reuses A's setup recording).
2. **F3 kalimba, F1 handpan** and **C** (the launch plan's weeks 1 and 2).
3. **E makers v2**, all seven scenes (week 3's emails link to it).
4. **D**, then **F2, F4, F5, F6**.
5. **G1–G3**, for the help centre.

ElevenLabs characters, one take per line: A 415 · B 230 · C 510 with its variants · D 250 · E 640 · F 830 with the recorder · G 2,125. About **5,050** for the whole set, 2,900 without the how-tos (counted from the committed `lines.py` files). Voice every script with Kokoro first; send only agreed text to ElevenLabs.

## 13. Questions for the owner

1. **Instrument recordings for "Play my notes":** which instruments can you record note by note on a phone (kalimba and handpan matter most)? For the others the app's own sound stands in.
2. **A guitar chord** for A scene 5 and D scene 1: a phone recording of D minor and B♭, five seconds each.
3. **A demo account:** which address should the signed-in recordings use (it appears nowhere on screen)?
