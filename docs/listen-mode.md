# Listen: join in with someone playing nearby

Design document for review. **No production code until the owner approves.**
Wireframes: `docs/listen-wireframes.html` (open it in a browser). Spike: `spikes/listen/`.

The feature: the app listens to someone playing nearby (guitar, piano, another handpan), works out the notes and chords, and helps me join in on the instrument I have open (handpan, ocarina, flute; later kalimba, tongue drum).

---

## Phase 1 · What exists and what Listen can reuse

| Area | How it works today | Reuse for Listen |
|---|---|---|
| **Instrument view** | Handpan: `renderPan(layout, { highlightNotes, altHighlightNotes, strikeMarks, faintNotes })` draws the pan with per-degree chord colours. Ocarina and flute: `renderFingering(inst, midi, …)`, drawn on the owner's photo when holes are marked. The shared Chords screen (`chordsScreenHtml` / `chordCardHtml` / `chordRowHtml`) puts the picture and a chord card on top, the list below. | The "Now" picture is exactly this: the detected chord lit on the pan, or its notes as fingerings. The Listen screen is built from the same shared parts. |
| **Chord finder** | `findAllChords(layout)` lists every chord a layout can play (25 types in `CHORD_TYPES`, deduped by root and type). `identifyChord(notes)` names a set of notes (the handpan's Identify mode). | Detected chords are named with the same `CHORD_TYPES`, so they match the Chords list, favourites and playlists. |
| **Closest version** | `fitChordToInstrument(inst, notes)` puts each chord note on the nearest octave the instrument has and lists the ones it can't play. `stackVoicing(rootPC, intervals, layoutNotes)` builds a playable voicing from the root up. `nextVoicing` moves a note to another octave. | "The closest version, with the missing notes named" is these functions, for any instrument. |
| **Favourites and playlists** | Playlists (`favorites` is one) store chords per instrument and voicing (`addChordToPlaylist`, `isChordBookmarkedAnyVoicing`). | Saving a detected chord is the existing ♡ and picker. |
| **Progressions** | Ordered steps with bars, tempo and beats per bar, played by the progression player at four levels (Chord, Roots, Arpeggio, Groove: `strikePattern`), with a count-in, strike-order badges and the next chord shown faintly. | A detected progression is saved as a progression, and "practise it" opens the existing player. The "suggested arpeggios" are the Arpeggio and Groove levels. |
| **Chord sheets** | `parseChordSymbol`, `matchSheetChord`, `sheetCoverage`, `rankTranspositions` map chord symbols onto an instrument and rank the keys that fit it. | The same maths answers "this song is in E, but your D Kurd plays it best moved to D". |
| **My instruments** | Handpans, ocarinas and flutes behind one model: `playableMidis(inst)`, `ocarinaToLayout`, fingerings, sub-holes, set-up. | Listen asks the open instrument only "which notes can you play?" (`playableMidis`) and "show these notes" (the picture), so it works for any instrument. |
| **Ocarina mode** | Notes, Chords (one note at a time, arpeggio order, moves between fingerings), Practice. | For one-note instruments: "notes of this chord you can play" and "notes that fit the song" use the same fingering pictures and moves. |
| **Microphone** | `startTuner` opens the mic, runs YIN (`yinPitch`) about 20 times a second and a stability tracker; the tuner strip shows it. Listen-for-a-scale (`scalefinder.js`) collects notes and ranks scales. iOS audio routing is handled (`ensureAudioOutput`). | The same mic pipeline and permission flow; single-note detection is the tuner's YIN; "notes heard so far → likely scale" is `rankScalesByNotes`. |

What's **new**: hearing chords (several notes at once), following a song over time (timeline, key, progression), and the Listen screen itself.

## Phase 1 · Use cases

| | a) One chord | b) A whole song | c) Ocarina with a song | d) Single notes / melody |
|---|---|---|---|---|
| **Who plays** | A friend strums or strikes one chord and holds or repeats it | A friend plays a song or a loop, 3–8 chords repeating | A friend plays chords; I'm on a one-note instrument | A friend picks a tune, hums, or plays a riff |
| **Around** | Quiet room, or talking | Often several people, maybe a second instrument; my own instrument | Same as b) | Usually quiet; sometimes over a chord |
| **I'm holding** | My handpan or ocarina, ready to play | My instrument, hands busy | Ocarina: two hands, mouth busy | My instrument |
| **At a glance** | Big chord name and the notes lit on my instrument | The chord now, the next one, the key; where we are in the loop | The 2–4 notes I can play over this chord, big; a calm "safe notes" set for the song | The note name and where it is on my instrument, the last few notes in order |
| **Phone** | On my lap or a stand, 0.5–1 m away | On a stand, 1–2 m away, often not touched for minutes | On a stand, can't be touched while playing | Close |

**e) A recording (radio, a record, a phone speaker), to learn the song on my own.** Who plays: a band, with drums, bass and a voice. Around: usually quiet, but the speaker may be small. I'm holding: nothing yet, I'm learning. At a glance: the song's chords and key, then Play along at my own pace. Extra: **Choose a song file** analyses a downloaded track faster than real time, without the microphone. (Telling *which* song is playing, as SoundHound does, needs a music database and isn't part of this.)

## Phase 2 · Modes

**Option A: two modes**, "Single chord" and "Follow a song". Simple to explain, but you have to choose first, and a "single chord" is usually the start of a song anyway.

**Option B: one Listen screen that adapts** (recommended). One session, always building the song in the background. The screen shows:
- **Now**: the chord (or single note) being played, on my instrument. That covers case a) and d) with no extra step.
- **Song**: the chords so far as a timeline, the key, and the progression once it repeats. That covers case b) and c).
- When it hears one note at a time it shows notes rather than chords (case d), automatically, with a small "Chords / Notes" override for when it guesses wrong.

**Recommendation: B.** Same mic session, nothing to choose up front, and the "Now" card is useful on its own in every case. The cost is one more decision in code (chords or notes), which the spike shows is easy: a single note gives one strong pitch, a chord gives several.

### Two phases of a song: **Listen**, then **Play along**

The spike (Phase 3) shows that detection while I also play is unreliable: my own instrument's notes mix into the chords. So following a song has two phases:
1. **Listen**: I don't play. The app builds the timeline, finds the key and, once a sequence repeats, the progression and its tempo. A banner offers **Play along**.
2. **Play along**: the progression is locked. The app follows it **by the clock** (bars at the detected tempo), shows Now / Next on my instrument, and only listens for the friend's chord changes to stay in step (it re-syncs on a clear, repeated difference). My own playing can't scramble a locked progression.

I can skip straight to Play along (for one chord, or when I know the song) or go back to Listen at any time.

## Phase 2 · The Follow a song experience

Wireframes 2–5 in `docs/listen-wireframes.html`.

- **Timeline**: the chords in the order played, building up live as chips with their length in bars. The current one is lit; uncertain ones are drawn dashed with a "?" (tap to correct). Repeats collapse into the loop once found.
- **Key and scale**: "Key: A minor (or C major)" with a confidence bar. Relative keys share the same chords, so both are named until the first and last chords make it clear. The scale's notes are listed.
- **Progression**: once a sequence repeats at least twice (with a little tolerance for misreadings), it's shown as a loop, for example **Am · F · C · G ×3**, with the place in the loop.
- **Tap any chord** to show it on my instrument in the Now card.
- **My instrument can't play it fully**: the closest version (nearest octaves, from `fitChordToInstrument` / `stackVoicing`), the missing notes named ("no E on this pan: plays as A–C"), and the chord's root in bold, which is always playable alone when the instrument has that note. If a different key would fit my instrument better, it says so once ("This song fits your D Kurd best moved down 2: tell your friend to capo 2", from `rankTranspositions`).
- **Ocarina and other one-note instruments**: for the current chord, the **notes of the chord I can play** as fingering chips (root first), and the **notes that fit the whole song** (the key's notes my instrument has) as a calm row, plus "avoid" notes (out of key) faint. Tapping a note shows its fingering.
- **Save**: ♡ on a chord (favourites or any playlist, as today); **Save progression** turns the loop into a progression (chords, bars, tempo, on this instrument); from there "Arpeggio" and "Groove" are the existing play levels.

### How results are shown while I play

- **Phone, Listen phase**: a full screen built from the shared Chords layout: the instrument picture on top (sticky), the Now card, then the Song section (timeline, key, loop). Readable at arm's length: chord names 28–40 px.
- **Phone, Play along**: a **focus view**: Now and Next only, huge (chord name 56 px, the instrument picture large), a bar progress line, the key small. Readable from 1–2 m. Screen stays awake (Wake Lock). A tap anywhere pauses or resumes.
- **Tablet and desktop**: picture and Now on the right, timeline and key on the left (the Chords two-column layout).
- **Not a bottom sheet**: a sheet hides the instrument, and Listen is long-running; a sheet is used only for "Correct this chord".

### Checking and editing what was heard

The person playing (or I) can correct the result, and the corrected version is what's used and saved:
- After Listen, a **Check** step shows the loop as a row of chords before Play along: *"Are these the chords?"*
- Tap a chord to change it: root and type (Am → A), or pick from the top guesses; **delete** it, **insert** one before/after, change its **length in bars**, or merge it with its neighbour.
- The whole timeline (not just the loop) can be edited the same way, and the key is recomputed from the edited chords.
- A correction is remembered for the rest of the session, so the same misreading on the next round is fixed automatically.
- **Save progression** saves the edited version.

### Hard cases

| Case | What the user sees and can do |
|---|---|
| **Noisy room** | A level meter and "Listening… a bit noisy" when the noise floor is high. Results then wait longer before showing (more smoothing) and show the root more confidently than the chord type (the spike: the root survives noise much better). Tip: put the phone nearer the player. |
| **Several instruments** | The loudest harmony wins. If two parts disagree for long, the chord shows as uncertain. Tip in the empty state: point the phone at the instrument to follow. |
| **My own instrument in the mic** | Listen → Play along (above). In Listen, a hint: "Let them play a round first, then join in." |
| **Wrong or uncertain detection** | Each chord has a confidence: solid (sure), dashed with "?" (unsure), and in the Now card the second guess is shown small ("or C6?"). Tapping a chord opens **Correct**: the top 3 guesses, plus "pick another chord" (root and type). A correction teaches the session: the key and loop are recomputed, and a corrected chord is kept on its next repeats. |
| **Same notes, two names** | Csus2 = Gsus4 (C D G), Am7 ≈ C6, Fmaj7 ≈ Am over F. The app picks the name that fits the key and the bass note, and shows the other as the second guess. |
| **Song changes key** | The key is computed over the last ~16 bars, not the whole song; a change shows as a new key marker on the timeline ("→ D minor"). The loop is re-found from there. |
| **Stop and restart** | Pause keeps everything; Resume continues the same timeline (a gap marker). **Clear** starts over. The session is kept until I leave Listen or clear it; a found loop can be saved before. |
| **Silence** | After 1 s of silence Now dims; after 60 s Listen pauses itself (as Listen-for-a-scale does today). |
| **Tuning** | Notes are named against A4 = 440 Hz and allowed ±50 cents. If everything comes in consistently 20–40 cents off (a detuned guitar, a 432 Hz pan), a small note says so; chords still work. |

### Privacy

- Everything is processed on the device, in the browser. **Nothing is recorded, stored or uploaded**: audio frames are analysed and thrown away; only chord names and times are kept in the session.
- The microphone is asked for only when I tap **Listen**, with one sentence before the browser's prompt: *"Listen uses the microphone to hear the chords nearby; the sound stays on this phone and isn't recorded."*
- The mic turns off when I leave Listen, pause, or after 60 s of silence; the app bar shows a red mic dot while it's on (as the tuner does).

### User flows

- **a) One chord**: open my instrument → Listen (app bar mic, or "Listen" on Chords) → one-sentence note → allow mic → friend strums → within about half a second Now shows **"G"** with its notes lit on my instrument → ♡ to save, or just play.
- **b) A song**: Listen → the timeline fills (G · Em · C · D …) → after two rounds "Loop found: G · Em · C · D, key G major, 96 bpm" → **Play along** → focus view with Now / Next, following the bars → after the song: **Save progression** → it opens in Progressions with the levels.
- **c) Ocarina**: same as b), and the Now card shows "Notes you can play: G4 B4 D5" (fingerings), and below "Fits the song: G A B C D E F#" → tap a note to see its fingering.
- **d) Melody**: Listen → the friend plays single notes → the screen switches to **Notes**: the note now, big, lit on my instrument; the last 8 notes as a row; "Likely scale: G major" when enough are heard (as Listen-for-a-scale does) → tap the row to replay it, or "Copy as notes".

## Phase 3 · Technical approach

### Detection

- **Single notes**: YIN, as the tuner already does (`yinPitch`), with the stability tracker. Spike: 100% on clean guitar, piano and handpan notes; 87–100% with noise at 10 dB SNR.
- **Chords**: a **chroma** vector (energy per pitch class) from spectral peaks, matched against chord templates.
  - Peaks must stand clear of the **noise floor** (a running median of the spectrum, ×3 in amplitude) and are weighted by how far above it they are.
  - **Overtone damping**: a peak at 3, 5, 6 or 7 times a stronger lower peak is mostly that note's overtone (it would read as a fifth, a third or a seventh) and counts for a quarter.
  - **Templates**: maj, min, 7, maj7, m7, sus2, sus4, dim (the brief's list) at every root; chord tones +1, other notes −0.25. A seventh only counts when its note is clearly there (≥ 45% of the triad's average), so plain triads aren't read as 7ths.
  - **Bass**: the strongest pitch class below 260 Hz nudges the root (helps inversions and Am7 vs C6).
  - **Smoothing**: chroma averaged over about 0.4 s; a chord is shown once it wins 3–4 frames in a row (about 0.3 s).
- **Key**: from the chords heard: each of the 24 keys scores the time spent on its diatonic chords (the tonic counts double), the first and last chords lean to the tonic, and a Krumhansl profile of the chroma breaks ties. Shown with the runner-up when it's close (relative major/minor).
- **Progression**: the chord sequence simplified to triads (Am7 → Am), then the shortest cycle that explains at least 75% of it, from any starting point. When chord types are noisy, the same search on roots only (A F C G) still finds the loop.
- **Tempo** (for Play along): from the chord-change times in the loop (median bar length), refined by onset times.
- **Lock**: once the key is known, the key's chords get a small boost; in Play along only the loop's chords compete, and the clock decides when a change is expected.

### Spike results (synthesised audio, see `spikes/listen/`)

The spike is a throwaway Python script, separate from the app. **I couldn't fetch real recordings from this environment** (Wikimedia rate-limited the shared connection), so it measures synthesised instruments modelled on their physics: Karplus-Strong plucked strings for strummed guitar (strings 25 ms apart), a piano with stretched overtones and decay, a handpan with its tuned fundamental, octave and fifth; noise as pink noise or crowd babble at 20, 10 and 5 dB SNR. These numbers are **optimistic** until checked on real recordings (see "Recording kit" below).

| Test | Chord exactly right | Root right |
|---|---|---|
| Guitar strums, 18 chords, clean | **100%** | 100% |
| Guitar, noise 20 dB / 10 dB / 5 dB (pink) | 89% / 72% / 67% | 100% / 100% / 100% |
| Guitar, crowd babble 20 / 10 / 5 dB | 89% / 78% / 50% | 100% / 100% / 94% |
| Piano, 12 chords incl. inversions, clean and all noise levels | **100%** | 100% |
| Handpan D Kurd chords, arpeggiated or struck together, clean and noisy | **90%** | 90% |
| Single notes (YIN), guitar / piano / handpan, clean | **100%** | |
| Single notes with noise 10 dB | 87% (guitar) / 100% (handpan) | |

- **What fails**: chord *type* in noise (7ths and sus chords added or lost) while the root holds; same-note pairs (Csus2 / Gsus4, Fmaj7 / Am); and above all **my own instrument in the mic**.
- **Songs**:
  - Am F C G, guitar, clean: loop found, key A minor (C major second), also at two chords a bar.
  - Piano C G Am F: loop found, key C major.
  - Handpan Dm Bb F C (arpeggiated): key D minor; loop found, with the arpeggio's A–C–F briefly read as Am (an extra chord in the loop: to fix with longer smoothing for arpeggios).
  - Crowd babble 10 dB: chord types too noisy for the loop, but the roots-only search finds A F C G; at 5 dB, locking to the key gives the clean Am F C G back.
- **My handpan bleeding in** while the friend strums: free detection is useless (D Kurd notes everywhere). Following with the loop locked gets 8/16 bars right with my pan as loud as the guitar, 12/16 when it's quieter, 14/16 with babble and quiet bleed, but with many short flickers. Hence the design change: **Listen, then Play along by the clock**.
- **Latency**: a chord is shown about 0.3 s after it starts (FFT 8192 at 22 kHz, hop 93 ms, 3–4 frames).

- **Recorded music** (`spike4.py`: strummed chords + bass + drums + a sung melody, also through a phone speaker at 10 dB, and with loud drums and voice): with the live settings the voice's melody notes turn chords into sus2/sus4 and the loop isn't found. With **longer smoothing (≈0.8 s) and locking to the key**, all three mixes come out exactly **Am F C G** (the loop found every time). Key: A minor / C major, the relative pair, as expected.

### Design changes from the spike

1. **Listen, then Play along**: follow a locked loop by the clock while I play (above).
2. **Root first in noise**: when the type is uncertain, show the root big and the type as "?" (the root is right 94–100% even at 5 dB).
3. **Arpeggiated playing** (handpan, harp-like guitar) needs longer smoothing (about 1 bar) to see the whole chord; the app uses longer smoothing when it hears separate onsets.
4. **Same-note names**: pick by key and bass, show the other as the second guess.
5. **Recorded music and song files** use the slower setting (≈0.8 s smoothing, key-locked once the key is known); a live friend uses the faster one (≈0.3 s). The app picks the slow one for a file, and offers "Steady (recordings)" / "Quick (live)" in Listen's ⋯ menu.

### Recording kit (to rerun the spike on real sound)

Record on the phone, 20–40 s each, phone at the distance you'd use, WAV or M4A, and send them:
1. A guitar strumming G, Em, C, D, Am, F, E7, Dsus2 (each for 4 strums), then the loop G Em C D three times.
2. Piano (or keyboard) block chords C, Am, F, G, Dm7, Cmaj7, then C G Am F three times.
3. Another handpan (or yours played by someone else) arpeggiating Dm, Bb, F, C.
4. The guitar loop again with people talking nearby.
5. The guitar loop while you play your D Kurd softly along.
6. A short tune of single notes (any instrument).

`python3 spikes/listen/spike.py file1.wav file2.wav …` prints the chords and key it hears; I'll compare with what was played and adjust the thresholds before building.

### Architecture

Detection and analysis know nothing about instruments, so a kalimba or tongue drum reuses them as they are.

```
mic ─▶ audio pipeline ─▶ detection ─▶ song analysis ─▶ Listen view
       (listen-audio.js)  (listen-detect.js)  (listen-song.js)     │
                                                                   ▼
                                            instrument adapter: playableMidis(inst),
                                            fitChordToInstrument / stackVoicing,
                                            picture (renderPan / renderFingering)
```

- **Audio pipeline** (`js/listen-audio.js`, browser only): opens the mic (sharing the tuner's code and permission flow), an `AnalyserNode` with FFT 16384 at 44.1/48 kHz (≈ 3 Hz bins, enough for a low E at 82 Hz), read about 10 times a second; plus the time-domain buffer for YIN. Emits `{ spectrum, sampleRate, rms, time }` frames. Wake Lock while listening.
- **Detection** (`js/listen-detect.js`, pure, unit tested in Node): `chromaFromSpectrum`, `chordCandidates(chroma, bass)` → `[{ rootPC, typeId, score }]` (ids from `CHORD_TYPES`), `isSingleNote`, `noteFromYin`, and a `createChordTracker()` with smoothing and hysteresis → `{ chord, alternatives, confidence, stable }`.
- **Song analysis** (`js/listen-song.js`, pure, unit tested): `createSong()` takes stable chords with times → timeline (chords, bars, uncertainty, corrections), `keyFromChords`, `findLoop` (chords and roots), `tempoFromChanges`, key changes over a window; `follow(loop, tempo, now, evidence)` for Play along.
- **Instrument adapter** (existing functions): from a detected chord (root + type) to what my instrument plays: the full voicing if it can, else the closest version and the missing notes; for one-note instruments, the chord's playable notes and the key's notes it has.
- **Listen view** (`js/app.js`, the shared Chords parts): Now card, Song section, focus view, Correct sheet, Debug view.
- **Debug view** (Settings › Listen debug, or a long-press on the Listen title): live chroma bars, the detected pitch and its YIN confidence, the top 5 chord candidates with scores, the noise floor and the smoothing state, and sliders for the thresholds, so detection can be tuned with real instruments.

## Risks

- **Real-world accuracy** may be lower than the spike's (room echo, phone mics with automatic gain, strings out of tune). Mitigation: the recording kit before building, the debug view, root-first display, corrections.
- **iOS microphone**: Safari can drop the mic when the screen locks or another app takes audio; Wake Lock and the existing `ensureAudioOutput` handling. Listen and the tuner can't run at once (one mic session).
- **CPU and battery**: FFT 16384 ten times a second is light; YIN runs only when a single note is likely.
- **Expectations**: complex jazz chords, fast changes (more than 2 a bar) and very quiet playing will be missed. The empty state says what works best.

## Confidence (owner's request)

- **Each chord**: sure / likely / unsure, from how well it fits, how far ahead of the next guess it is, and how steadily it held while it rang (`listenTracker`). Shown as a three-step bar with the word under the chord name; unsure chords show the root with "?" when the root is clear, and the second guess ("or Cmaj7?") when not sure.
- **Overall**: "Heard clearly" / "Mostly clear" / "Hard to hear: ask them to play it again, closer to the phone": the chords' confidence weighted by how long each was heard (`listenOverallConfidence`). Step 4 adds whether the loop repeated the same way.

## Implementation plan (after approval)

Each step is a pull request, smallest useful version first:
1. **Single chord, shown on my instrument** (case a) — **built** (`js/listen-detect.js`, `js/listen-audio.js`, Chords › Listen on handpan, ocarina and flute, Settings › Listen debug; `tests/listen.test.mjs`): audio pipeline, `listen-detect.js` (chroma, templates, tracker), the Now card on the shared Chords layout for handpan and ocarina, privacy note and mic flow, and the **debug view**. Unit tests: chord matching on synthetic chroma, closest version on D Kurd 9, D Celtic Minor 9, a custom layout with bottom notes, and the 12-hole alto C ocarina.
2. **Single notes** (case d): note mode with YIN, last notes row, likely scale. Tests: note naming, chord/notes decision.
3. **Song timeline and key** (case b, Listen phase): `listen-song.js` timeline, key with confidence, uncertainty and the Correct sheet. Tests: key detection on chord histories (incl. relative keys and a key change).
4. **Loop and saving**: `findLoop`, tempo, Save progression / ♡. Tests: progression detection with misreadings, roots-only fallback.
5. **Check and edit, then Play along**: the Check step and timeline editing; the focus view following the edited loop by the clock with the microphone off, Wake Lock. Tests: editing operations and following a loop.
6. **One-note instruments** (case c): notes that fit the song (play / avoid) and the chord's notes, on ocarina and flute. Tests: the alto C ocarina and a 6-hole flute.
7. **Recordings and song files** (case e): the steady setting, Choose a song file (decoded on the device, analysed faster than real time, nothing uploaded).

## Owner's decisions (review round 1)

- **Play along by the clock: confirmed, and without listening.** The app listens only in the Listen phase, to the other instrument on its own. In Play along the **microphone is off**: the app shows the learned loop on my instrument in time (Now / Next, bar by bar at the learned tempo, like the progression player). Controls instead of re-syncing by ear: tap to pause/resume, ◀ ▶ a chord back/forward, a tempo nudge, and **Listen again** to relearn. This replaces the "re-check at bar lines" idea elsewhere in this document.
- **Where:** a third segment on the Chords screen: **Browse / Identify / Listen**. All instruments share the Chords screen, so ocarinas and flutes get Identify and Listen too.
- **Chords:** only what's reliable. Root first (right 94–100% in the spike, even in noise), then major/minor; 7ths and sus only when clearly there, otherwise the root and major/minor, never a confident wrong extension. Uncertain = root plus "?".
- **A song that doesn't fit:** say so plainly ("This song doesn't fit your instrument well; try another one"); no capo or transposition advice.
- **Ocarina:** "notes that fit" (play / avoid) only; the point is matching the key, not copying the melody.
- **Recordings:** the owner records clips with the phone's own recorder (any format; converted with ffmpeg) and uploads them. Most important: the chords one by one with their names said, the G Em C D loop, and the loop with the owner's handpan playing along.

## Open questions for the owner

1. **Listen, then Play along**: is it OK that following a song while I play is by the clock (re-checking at bar lines), rather than truly listening every moment? The spike says the latter isn't reliable with my own instrument in the mic.
2. **Where does Listen live?** A mic button in the instrument's app bar (next to the tuner), a "Listen" tab, or a "Listen" segment on the Chords screen next to Browse / Identify (it's "Identify by ear")?
3. **Chord vocabulary**: the brief's list (maj, min, 7, maj7, m7, sus2, sus4, dim) for detection, or all 25 app chord types? More types mean more confusion; I'd start with the 8.
4. **Transposition**: when the song is in a key my instrument doesn't fit, should the app suggest a capo / transposition to the friend (as chord sheets do), or only show the closest versions?
5. **Real recordings**: can you record the six clips in the recording kit? I'd like to tune on real sound before step 1.
6. **Ocarina melody help**: for case c), show "notes that fit" only, or also suggest a simple line (chord tones on the beat), like the handpan's Groove level?
