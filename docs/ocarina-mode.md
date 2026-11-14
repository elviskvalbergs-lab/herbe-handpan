# Ocarina mode for herbe-handpan: design brief

Nov 11, 2026 · @Elvis

## Goal and how to use this brief

Add an ocarina side to herbe-handpan that shares its scale library, chord engine, sound and sync, but has its own interface built around fingering diagrams. It also gets a builder for making a clay ocarina tuned to any handpan scale.

This brief is written for a Claude Code cloud session working in `elviskvalbergs-lab/herbe-handpan` on the `preview` branch. To use it: export this doc as Markdown, start a Claude Code session on the repo, paste the text, and ask it to save the brief as `docs/ocarina-mode.md` before starting. Then work through the eight phases in the Build order section, one per pull request. The last two sections, on songs and on playing from chord sheets, describe the next project: keep them in mind for the instrument model, but don’t build them yet.

**Branches and data.** `preview` is the repo’s only branch and the one Vercel deploys to production, so it is effectively main. The Supabase project is hard-coded in `js/auth.js`, so every deployment, test builds included, shares one database. Claude Code should therefore work on one feature branch per phase and open a pull request into `preview`. Vercel builds a preview link for each pull request to try on the phone before merging. Database changes must be additive only (new tables or columns, never altering existing ones), so a test build can’t damage saved layouts and playlists. Before the sync phase, set up a second Supabase project for testing and point non-production builds at it.

The tuning maths and the builder flow were prototyped in the [Handpan-scale ocarina planner](https://claude.ai/artifact/7FLyxyoXuavFNXeX4duZdX). The formulas are written out in full below, because a cloud session can't open that page.

## Instruments first

The app opens on the user’s own instruments rather than a Handpan or Ocarina mode. Each instrument belongs to a family (handpan, ocarina, flute), and the family decides which views it gets. The scale library, chord engine, playlists, sound, tuner and sync are shared underneath.

- **Setup wizard on first run:** “Which instruments do you play?” with the families to tick, then the specific instruments: a handpan by scale, an ocarina or flute by type and key, or one being built. The same wizard runs later from “Add instrument”.
- **Home is My instruments:** a card per instrument, most recently played first. Tapping one opens its family’s views. Someone with a single instrument goes straight into it.
- **Trying someone else’s:** “Other instrument” opens the full catalogue of scales, types and keys without saving anything, for when someone hands you their flute at a jam. A shared instrument link or QR code opens the same way (see the next section).
- **Switching:** the current instrument’s name in the header opens My instruments, so switching is two taps from anywhere.
- **Existing users:** saved handpan layouts become handpan instruments on the first launch after the update, so nothing is lost and the chord views behave as they do today.
- **Routing:** the URL hash carries the instrument and view (`#i/<id>/chords`), following the existing `stateToHash` and `loadFromHash` pattern.
- **Playlists:** each entry records the instrument it was saved from and plays and displays in that instrument’s way: highlighted notes on a pan, fingerings on an ocarina or flute.

## Ocarinas and flutes

An ocarina or flute in the app is an instrument with holes and a fingering table, not a list of notes. There are three kinds: traditional, custom and scale-built. All end up in the same shape, so every view treats them alike.

**Traditional** instruments are the ones people buy: a type plus a key. Their fingerings are fixed charts stored as data. Because they're chromatic, a traditional ocarina can also be filtered by any handpan scale, which shows which notes and chords of, say, D Kurd it can reach.

| Type | Body | Approximate range | Common keys |
| --- | --- | --- | --- |
| 12-hole ocarina (Italian system) | 1 chamber | A to F, an octave and a sixth | Soprano C, F, G; Alto C, F, G; Tenor C; Bass C |
| 10-hole ocarina | 1 chamber | About an octave and a third | Alto C, Alto G |
| 6-hole pendant ocarina (English system) | 1 chamber | About an octave and a fourth | C, G |
| 4-hole pendant ocarina (English system) | 1 chamber | One octave plus one note | C, G |
| Double ocarina | 2 chambers | About two octaves | Alto C, Alto G |
| Triple ocarina | 3 chambers | About two and a half octaves | Alto C |
| Native American flute (5 or 6 holes) | Tube | About an octave and a third, minor pentatonic | F#, G, A minor |
| Tin whistle | Tube | Two octaves, diatonic | D, C |

The ranges above are from memory and must be checked against a published maker’s chart before they go into code, along with the concert pitch of each key’s lowest note.

**Scale-built** instruments are the user’s own clay ocarinas, made from a handpan scale in `data.js` (optionally transposed, gu notes in or out). Holes, chambers and fingerings are generated by `js/ocarina.js`, and the user’s measured hole sizes are stored on the instrument once built.

**Custom** instruments are bought ones that don’t match a standard chart. The user enters the number of holes and where they sit, then plays each fingering into the built-in tuner to record the note it gives.

**Calibrated charts (added after phase 1).** Makers agree on the basic order (right pinky to index, then the left hand, thumbs last) but differ in hole sizes, which decide the cross-fingerings and half-holes for sharps and flats, and in how the top notes and the extra holes of a 12-hole are used. So an ocarina of unknown make, or any custom one, is charted from the instrument itself: the user says which finger covers each hole, then blows all holes closed and each hole open on its own into the tuner (about 13 notes for a 12-hole). From those readings `ocarina.js` works out each hole's size relative to the window (`solveHoleRatios`), predicts the pitch of every fingering including half-holes (`predictFingeringHz`), and picks the easiest fingering for every chromatic note (`calibratedChart`), preferring the standard opening order and avoiding half-holes. Predictions are a starting point within about 20 cents; the tuner confirms each note, and a confirmed reading replaces the prediction. This is also the path for traditional types until a sourced maker chart is in place.

**Every instrument is a named, saved preset,** bought or built, such as “Blue D Kurd alto”, with an optional photo. Each one gets a short public ID (6 characters, like `K7Q2XD`) with a matching link and QR code. Stamp the ID into the clay or tie a QR tag to the instrument, and anyone who plays it opens the app straight to its fingering chart and chords, read-only, with an option to add it to their own instruments. This needs a Supabase `instruments` table readable by public ID and writable only by its owner.

Suggested model, stored like layouts (`hp-instruments` in localStorage, synced through the same Supabase path):

```js
Instrument = {
  id, publicId, name, photo, updatedAt,
  family: 'handpan' | 'ocarina' | 'flute',
  kind: 'traditional' | 'custom' | 'scale',
  // traditional
  type: '12-hole', key: 'C', register: 'alto',
  // scale-built
  scaleId: 'D-Kurd', transpose: 0, includeGu: true,
  chambers: [{
    notes: [midi, ...],               // ascending; notes[0] = all holes closed
    holes: [{ id: 'R4', finger: 'R4', side: 'top' | 'bottom', x, y, sizeMm }],
    fingerings: { [midi]: ['c' | 'o' | 'h', ...] }   // one state per hole: closed, open, half
  }],
  build: {
    stage: 'design' | 'body' | 'leather' | 'boneDry' | 'bisque' | 'final' | 'done',
    clayBody, shrinkPct, a4,
    perChamber: [{ window: { shape, w, l, t }, readings: { [stage]: { f0, d, f1, notes: { [midi]: hz } } }, holesDone: [] }]
  }
}
```

Finger names follow the usual ocarina convention: L1–L4 and R1–R4 for index to pinky, LT and RT for the thumbs. Scale-built ocarinas open holes in the same order as a standard ocarina (right hand pinky to index, then the left hand, thumbs last), so they feel familiar. That order also puts the smallest holes under the weakest fingers, because hole sizes grow as the scale rises.

**Thumb holes** sit underneath and are opened last. On a 12-hole ocarina the top few notes of the range come from lifting the thumbs once all the finger holes are open. They extend the range upward; they don’t jump an octave the way a recorder’s thumb hole does. A scale-built ocarina with more than 8 holes gets thumb holes the same way: its two highest-note holes go underneath. The fingering diagram, the player and the builder’s drilling map all show them.

**Flutes** use the same holes-and-fingerings model and the same views. A Native American flute is a tube, so a hole’s position changes its pitch, unlike an ocarina; the builder therefore covers vessel ocarinas only. Flute fingerings come from published charts stored as data, including the cross-fingerings that give extra notes outside the pentatonic scale.

## The fingering diagram

One SVG component draws every fingering in the app, at three sizes. It replaces the pan as the central visual on the ocarina side, so it gets the same care the pan drawing has.

**What it shows**

- **The body, seen from above:** a transverse "sweet potato" outline (mouthpiece out of the wide end, tail tapering away) for 10-hole, 12-hole, multi-chamber and scale-built ocarinas, drawn fatter, like an aubergine, for bass chambers (closed note below C3). Only small single-chamber ocarinas with 4 holes or fewer, like English-system pendants, get the round pendant outline. (Changed after review: the first version drew everything with 6 holes or fewer as round pendants.)
- **Holes in their real positions:** for scale-built instruments, hole circles are drawn in proportion to their actual diameters, so the diagram doubles as a drilling map.
- **Thumb holes:** drawn in a small strip below the body labelled “underside”, placed under the hand they belong to.
- **Hole states:** filled means covered, an empty ring means open, half-filled means half-holed. This is the convention printed ocarina charts use, and a one-line legend appears the first time a user opens the ocarina side.
- **Chambers:** every chamber is drawn, and the one to blow is marked at its mouthpiece. Unused chambers are dimmed. For a two-note harmony, both are marked “blow both”.
- **Note name:** under the body, in the same naming style as the rest of the app (flats, sharps or solfege).

**Sizes**

- **Large:** about 70% of the screen width, used for the selected note and in practice mode.
- **Medium:** one row per note in the Notes chart.
- **Mini:** 4 to 6 across a phone screen, used for chord arpeggios and playlists.

**Behaviour**

- Tapping any diagram plays its note through `audio.js`.
- When moving from one fingering to the next (in an arpeggio or practice mode), the holes that change state get a short highlight ring. Learning which fingers move is the hardest part of playing, so this is the detail that makes the diagram useful rather than decorative.
- Finger labels (R4, L1, LT) inside the holes and hole sizes in millimetres are both off by default and switched on in settings. The builder always shows sizes.
- Each diagram has an accessible label listing its open holes, for example “D4: R4 and R3 open, all others closed”.

**Showing the moves.** Between two notes, every hole that changes gets an instruction, not just a highlight. Holes to lift get an upward arrow in one colour, holes to cover a downward arrow in another, and a line under the diagram spells it out: “Lift R3 and R2” or “Cover L1, lift R4”. In an arpeggio the moves sit between each pair of mini diagrams, so a chord reads as a sequence of finger movements. Holes that stay as they are get no mark, which keeps attention on the fingers that move.

**Which finger is R3?** A small hand icon beside any finger label opens a two-hand diagram naming each finger (L1 to L4, R1 to R4, LT, RT), drawn the way a player holds the instrument. It also appears once, by itself, the first time finger labels are switched on.

Suggested signature, in a new `js/ocarina-ui.js`: `renderFingering(instrument, midi, { size, previousMidi, showFingers, showSizes })`, returning an SVG string like `renderPan` does.

## Ocarina and flute screens

An ocarina or flute opens into four views. Notes and Chords are where people spend their time; Instruments and Builder are visited occasionally.

**Instruments** lists the user’s ocarinas, with “Add ocarina” offering two paths: “I have one” (pick a traditional type and key) and “I’m making one” (pick a handpan scale, which opens the Builder). The selected instrument shows in the header next to the menu, and tapping it opens My instruments.

Instruments still being built appear in My instruments with their stage (“Drying, step 4 of 7”), and tapping one reopens it in the Builder at that step, so several builds can run in parallel. “I’m making one” also offers “Start from an earlier build”: it copies that instrument’s scale, window and hole sizes as the starting point and shows its old readings beside the new ones.

**Notes** is the fingering chart: every note low to high as a medium diagram, with the selected note shown large at the top. A scale filter (any scale from `data.js`) dims notes outside it, which turns a 12-hole Alto C into a practice tool for D Kurd. There’s also a play-scale button using `playScale`.

**Tuner.** A built-in tuner, reached from a button on every instrument and on every builder step, listens through the microphone and shows the note heard, its frequency and how many cents it is from the target. On the Notes view it checks each fingering against the chart; in the Builder it fills in the readings itself, so the user just blows instead of typing numbers.

**Chords** reuses `findAllChords` and the existing chord types through an adapter that turns an ocarina into the layout shape it expects (`ocarinaToLayout(oc)`, returning its notes in range, filtered by the scale filter if one is set). Each chord card shows:

- the chord name and notes, as on the handpan side;
- its arpeggio as a row of mini diagrams in playing order, root first, with changed holes highlighted from one to the next;
- a play button using `playChord` in arpeggio mode, since an ocarina sounds one note at a time;
- the existing voicing swap, so a chord tone can move to another octave when the instrument has it;
- a “not on this ocarina” note when a chord tone falls outside the range (for example when gu notes were left out).

**Two-note harmony on multi-chamber ocarinas.** With both windways blown at once, one note can come from each chamber. A pair is playable together only when no finger is needed in two places: the two fingerings must not ask the same finger to cover one hole and lift off another. `ocarina.js` checks this from each hole’s finger assignment. The Chords view then marks the playable pairs inside a chord, such as root and fifth, with a “play together” badge and a combined diagram.

**Playlists and practice.** Ocarina chords save to the existing playlists. Autoplay on an ocarina playlist steps through each arpeggio note by note, showing the large diagram for the current note and the next one as a mini. This is the practice mode, so it needs no separate screen.

In practice mode the moves are the main thing on screen: the large diagram shows the current note with arrows for what to lift or cover to reach the next one. The user sets the pace by tapping, or with the tuner on, the player advances by itself once the right note is heard.

## Builder

The builder is a step-by-step project, not a settings form. Making a clay ocarina takes days or weeks of drying and firing, so each instrument remembers which step it’s on and the user can leave and come back.

1. **Design.** Pick a scale, transpose, include or leave out gu notes, or start from an earlier build. The screen shows the resulting notes, how many chambers and holes that means, and a preview of the fingering diagram. Chamber splitting is automatic, with a manual override under “Advanced”. **Fewer chambers (added after phase 1):** the screen says how many chambers the full scale needs (“The full scale needs 3 chambers”) and offers fewer. With fewer chambers than needed, the notes show as a row of chips with a window that slides along them, starting at the lowest notes, so the user can move it to the middle or top (`noteWindows`). A “start on the ding” shortcut picks the window beginning at the ding. Single notes can also be switched off. One chamber holds about 9 notes of a handpan scale (8 holes, one per finger).
2. **Body.** Pick the clay body from a short named list, then for each chamber the window shape (rectangle, round or oval, chosen by picture), its size and the wall thickness. The app gives the inside volume and the diameter of a ball with that volume, which is what the clay is formed around.
3. **Voice and drill at leather-hard.** The tuner records the closed pitch, then the pitch with the test hole, and every hole’s diameter appears. Holes form a checklist in drilling order; after each one the tuner confirms the note (“D4 is 12 cents flat: open it slightly”) before the next is ticked off. Targets here are already lowered for shrinkage.
4. **Bone-dry check.** A tuner pass over every note shows how far the pitch has risen while drying. Small corrections are still possible with careful filing.
5. **Bisque check.** After the first firing, the targets switch to concert pitch. Flat notes get a “file this hole a little larger” hint; sharp ones are reported plainly as “can’t be lowered by filing”.
6. **Final check.** After the glaze firing (skipped if unglazed), a last tuner pass records the finished tuning.
7. **Done.** The instrument becomes playable in My instruments, with its real hole sizes and measured pitches stored, and gets its public ID and QR code.

Each stage keeps its own readings, so going back never loses later measurements. Comparing the leather-hard and final readings gives the real shrinkage of that clay body, which the app offers as the default the next time the user builds with the same clay. After a couple of builds the targets fit the user’s own clay and kiln rather than a generic 11%.

## What goes where

Most controls in the prototype planner are things people set once, so they leave the main screens. The test applied: if someone changes it while playing or building, it’s on screen; if they set it once per instrument, it lives with the instrument; if they set it once ever, it’s in settings.

| Control | Where it lives | Why |
| --- | --- | --- |
| Current instrument | Header, opens My instruments | Changed when picking up a different instrument |
| Other instrument (unsaved) | My instruments | For a jam or a borrowed instrument |
| Tuner | Button on every instrument and builder step | Used while playing and building |
| Scale filter | Notes and Chords views | Changed while practising |
| Chord, voicing, play | Chords view | The work itself |
| Window shape and size, readings, hole checklist | Builder, on the step that needs them | The work itself while building |
| Scale, transpose, gu notes | Instrument (Builder step 1, editable later) | Defines what the instrument is |
| Traditional type and key | Instrument | Defines what the instrument is |
| Name, photo, public ID, QR code | Instrument | Identity of a saved instrument |
| Chamber count override | Builder step 1, under Advanced | Auto is right almost always |
| Clay body | Builder step 2; the named list itself in settings | Picked per build, carries learned shrinkage |
| Clay shrinkage % | Shown with the clay body, editable under Advanced | Learned from earlier builds, default 11% |
| A4 reference (440 Hz) | Settings | Rarely changed, applies everywhere |
| Sharps, flats or solfege | Settings (already exists) | Shared by every instrument |
| Finger labels, hole sizes on diagrams | Settings | Display preference |

The window’s equivalent size W, shown in the prototype, becomes an internal value. Users only see what they act on: millimetres to drill and the volume to form around.

Users never enter W. The window is described by its shape and size, the app works out its area, and W comes from the tuner readings.

## Maths reference for js/ocarina.js

All of this is pure functions with no DOM, so it can be unit-tested in Node. The numbers match the prototype planner.

**Pitch from frequency.** f = A4 × 2^((midi − 69) / 12), with A4 from settings.

**Chamber splitting.** If the notes span 14 semitones or less, use one chamber. Otherwise walk up from the lowest note and start a new chamber whenever a note is more than 12 semitones above the current chamber’s lowest note. Then, from the top chamber down, move notes into any chamber with fewer than 2 notes from the chamber below it; if that isn’t possible, merge it into the chamber below. Each chamber’s lowest note is its all-closed note.

**Hole sizes from the tuning readings.** f0 is the measured closed pitch, d the test hole diameter, f1 the pitch with the test hole open. W is the window’s equivalent hole size:

```latex
W = \frac{d}{(f_1/f_0)^2 - 1}
```

The total open hole diameter needed for note n is:

```latex
D_n = W\left[\left(\frac{f_n}{f_0}\right)^2 - 1\right]
```

In the cumulative fingering, hole n’s diameter is D\_n − D\_(n−1). A hole over 12 mm becomes two holes of half that diameter, opened together. Before readings exist, show sizes as relative proportions only. The test hole becomes the first hole whose size is at least d.

**Inside volume from the window.** Window width w, length l and wall thickness t in mm; c = 343 m/s:

```latex
A = w l,\quad a = \sqrt{A/\pi},\quad K = \frac{A}{t + 1.5a},\quad V = \frac{K c^2}{4\pi^2 f^2}
```

Use the leather-hard target f × (1 − s), where s is the shrinkage fraction. The fired volume is V × (1 − s)³, and the ball diameter is the cube root of 6V/π. Default window: width = 10 × √(262 / f) mm, clamped to 6–16 mm and rounded; length = 0.75 × width; wall 4 mm. Present the result as a starting point within a couple of semitones.

Window area by shape: rectangle A = w × l; round A = π d² / 4; oval A = π w l / 4. Everything after that uses A alone.

**Shrinkage.** Every pitch rises by a factor of 1 / (1 − s) from leather-hard to fired, so leather-hard targets are the concert targets × (1 − s).

**Two-note pairs.** Notes from different chambers can sound together when, for every finger, the two fingerings don’t require it both on a hole and off a hole.

**Learned shrinkage.** For each note measured at both leather-hard and final stage, s = 1 − f\_leather / f\_final. Average over the notes, store it on the clay body, and use it as that clay’s default.

**Tuner.** Microphone through `getUserMedia` into an `AnalyserNode`, with pitch detection by the McLeod pitch method or YIN; both run comfortably on a phone in plain JavaScript. Report a note only after the reading has been stable for about 200 ms, and show cents from the current target. Ocarinas are close to pure sine tones, which makes them easy to detect, but the low notes of a large bass ocarina need a longer window (about 4096 samples at 48 kHz). Microphone access needs HTTPS, which Vercel already provides.

## Build order

Eight phases, one feature branch and pull request each into `preview`, so every step can be tried on its Vercel preview link before the next starts. New files go into `build.py`’s bundle list: `js/ocarina.js` and `js/tuner.js` after `js/chords.js`, and `js/ocarina-ui.js` after `js/pan.js`.

1. **Maths and data.** `js/ocarina.js` with the formulas above, generated fingerings, two-note pair checks and Node unit tests. Traditional charts start with the 12-hole Italian system only.
2. **Instruments first.** The instrument model, setup wizard, My instruments home, unsaved “Other instrument”, and migration of saved layouts into handpan instruments, with no change to how the handpan views behave.
3. **Fingering diagram and Notes view.** `renderFingering` with the moves and the finger legend, and the Notes chart for traditional ocarinas.
4. **Chords and practice.** `ocarinaToLayout`, arpeggio rows with moves, two-note pairs, playlist autoplay as practice mode.
5. **Tuner.** `js/tuner.js`, the tuner screen, and tuner-driven advance in practice mode.
6. **Builder.** The seven stages, parallel builds, starting from an earlier build, clay bodies with learned shrinkage, custom instruments recorded with the tuner.
7. **Sharing and sync.** `hp-instruments` through the existing Supabase sync, the public `instruments` table, public IDs, links and QR codes.
8. **More instruments.** The remaining ocarina types, then Native American flute and tin whistle charts.

**Reused as they are:** the scale list and note helpers in `data.js`, `findAllChords` and the chord types in `chords.js`, `playNote`, `playChord` and `playScale` in `audio.js`, playlists in `storage.js`, prefs and URL hash handling in `app.js`.

**To verify before shipping:**

- [ ] Fingering charts for each traditional ocarina and flute type, from a published maker’s chart, with the source noted in the data file
- [ ] Range and lowest concert pitch for each type and key
- [ ] How layouts and playlists are stored in Supabase, so instrument ids can be added without breaking existing saved data
- [ ] Supabase row-level security for the public `instruments` table: anyone reads by public ID, only the owner writes

A kickoff prompt for the first session: “Read docs/ocarina-mode.md. Start phase 1 on a new branch off preview: create js/ocarina.js with the maths and fingering generation described, plus unit tests. Don’t change any existing behaviour. Open a pull request when the tests pass.”

## Next project: songs on any instrument

A song player that tells you whether a song works on your instrument, in which key, and walks you through it note by note is feasible. It’s a separate project of about the same size as the ocarina work, built after phases 1 to 5, because it stands on the instrument model, the fingering diagram and the tuner. The one thing to get right now: every instrument exposes `playableNotes()` and `fingeringFor(midi)`, and chords go through `ocarinaToLayout`. That is all the song player needs from it.

**Getting songs in**

| Format | What it carries | Where songs come from |
| --- | --- | --- |
| ABC notation | Melody, chords, as plain text | Large folk and traditional tune collections; easy to paste. abcjs parses and renders it in the browser |
| MusicXML | Melody, chords, lyrics | Exported by MuseScore and most notation apps |
| MIDI | Notes per track | Widely available; the user picks the melody track |
| ChordPro | Lyrics with chords, no melody | The format most chord-tab sites use |

Popular songs need a licence before the app can publish them: their melodies and lyrics are copyrighted, while a chord progression on its own usually isn’t. [Handpan ChordBook](https://handpanchordbook.com/faqs/), for example, pays a yearly licensing fee to include well-known songs. Start with public-domain and traditional tunes plus the user’s own imports, and add a licensed catalogue if the app grows. Every format is converted into one song shape: title, tempo, time signature, melody notes with durations and bar numbers, chords on beats, and lyrics if present.

**Can I play it?** For each instrument, try all 12 transpositions and octave shifts and keep the best one. Score it by the share of melody note time the instrument can play and, for handpans, the share of chords whose notes all exist. Instruments are listed best first with a badge:

- **95% or more:** plays as written, in the key shown.
- **80 to 95%:** plays with a few notes swapped; the swaps are marked and use the nearest note of the chord underneath.
- **Below 80%:** shown greyed with the bars where it breaks down, so it’s clear why.

**The player.** Everyone sees the chord tabs and lyrics. Under them the instrument’s own view follows along: a handpan lights up its notes on the pan, an ocarina or flute shows the current fingering with the moves to the next note, and a strip shows what’s coming. Tempo runs from 25% upward, any section can loop, and in wait mode the tuner listens and moves on only when the right note is played, so the song goes at the player’s own speed.

Suggested order once the ocarina phases are done: progressions (below), then ABC and ChordPro import, then coverage scores, then the player, then MusicXML and MIDI import.

**Progressions: the same chord more than once (owner request, Nov 2026).** Today a playlist is a set of chords: each chord, in each voicing, can be in a playlist only once (`addChordToPlaylist` refuses an entry whose id is already there, and the id is `layoutId-chordId`, plus the notes if the voicing differs). So a progression like **Am – Dm – Am – Bbm** can't be written down. Progressions are the first step towards songs: a song's chord track is a progression with timing. Plan:

- **A progression is an ordered list of steps,** and the same chord can appear any number of times. Each step gets its own id (`stepId`) and points at the chord (`chordId`, `notes` for its voicing, `layoutId` or `instrumentId`). Nothing is matched by chord id any more, so removing or reordering one Am leaves the other alone.
- **Keep playlists as they are** (a set of favourite chords: the heart means "in this list", and existing saved data and sync stay valid). Add progressions next to them: a playlist can be turned into a progression ("Copy as progression"), and a progression can hold repeats. This avoids migrating existing playlists, and the heart keeps its simple meaning. Stored and synced like playlists (soft deletes, `updatedAt`), additive only.
- **Building one:** an "Add to progression" action on any chord appends a step (repeats allowed), a step list with drag/up-down reorder, duplicate step, remove step, and optional bars per step (default 1) and time signature (default 4/4), which is all a song's chord track needs later.
- **Playing it:** autoplay steps through the progression in order, repeats included, with tempo in BPM and bars per step instead of seconds per chord; on ocarina and flute, practice mode walks each step's arpeggio as it does for playlists. The "From chord sheet to playing" levels (roots, arpeggio, groove) apply directly to a progression.
- **Later, songs:** a song is a progression with a tempo, sections (verse, chorus) and optionally a melody; ChordPro import produces a progression.

## From chord sheet to playing

A chord sheet tells you which notes, not what to do with your hands, and that gap is where beginners give up. The app should never stop at a chord: it always offers a concrete, timed pattern the player can follow, picked automatically and adjustable by level.

**Levels**, chosen per song and changeable at any time:

1. **Roots.** One note per chord, the chord’s lowest available note, on beat 1 of the bar. Anyone can play along on day one.
2. **Arpeggio.** Root on beat 1, then the other chord notes one per beat, alternating hands (pattern 1-2-3-2 by default).
3. **Groove.** Root on the strong beats, two chord notes struck together on the backbeats, and ghost taps in between, following the song’s rhythm.

**When to play a chord or an arpeggio.** The app decides with simple rules, so the player doesn’t have to:

- **Slow song, or a quiet section such as a verse under singing:** arpeggio. Handpan notes ring for a long time, so one note per beat stays clear.
- **Chorus or a building section:** two or three notes together on beat 1, then arpeggio for the rest of the bar.
- **More than one chord per bar, or a fast tempo:** fewer notes, roots or two-note pairs only.
- **Notes ringing into the next chord:** if the next chord lacks a note that is still sounding, prefer notes the two chords share.

**On the pan.** Each note of the pattern is numbered in strike order and marked L or R for the hand, the next chord is drawn faintly, and a count-in and tempo control start the player.

**Worked example: Stand by Me on D Kurd.** The song’s verse loops the common I–vi–IV–V progression. Transposed to F major, every chord fits D Kurd (D3 / A3 Bb3 C4 D4 E4 F4 G4 A4) with no missing notes:

| Bars | Chord | Notes on D Kurd | Level 1 (beat 1) | Level 2 (beats 1-2-3-4) |
| --- | --- | --- | --- | --- |
| 1–2 | F | C4 F4 A4 | F4 | C4 F4 A4 F4 |
| 3–4 | Dm | D3 F4 A4 | D3 (ding) | D3 F4 A4 F4 |
| 5 | Bb | Bb3 D4 F4 | Bb3 | Bb3 D4 F4 D4 |
| 6 | C | C4 E4 G4 | C4 | C4 E4 G4 E4 |
| 7–8 | F | C4 F4 A4 | F4 | C4 F4 A4 F4 |

This is the shape every song page should take: the chord, what to hit at the player’s level, and when.

**Built so far (chord sheets, Nov 2026).**

- **Chord sheet import.** "Paste a chord sheet" on the Playlists tab's Progressions section and in an empty progression. `js/chordsheet.js` reads ChordPro (`[Am]` inline chords, `{title}`, `{tempo}`, `{time}`, `{start_of_chorus}`/`{soc}` … `{eoc}`, `{start_of_verse}`, `{chorus}` to repeat the last chorus; tabs are skipped) and plain chord-over-lyrics or chord-only lines (`Am Dm Am Bbm`, `| Am | Dm |`, `%`, `x2`, "Verse 1:" headings). One chord per bar; chords sharing a bar split its beats; the same chord in bars that follow each other within a section becomes one step. Symbols map onto `CHORD_TYPES` by intervals (slash chords play the chord and keep the bass); symbols with no matching type (7sus4, 11, 13, altered chords) are listed and kept.
- **Fit and "Can I play it?" for one instrument.** The sheet is fitted to the open instrument or one picked in the sheet: on a handpan through `findAllChords(layout)`, on an ocarina or flute through `ocarinaToLayout`. All 12 transpositions are scored (share of steps whose chord is fully playable) and the best three plus "as written" are offered with the 95% / 80% badges. Chords the instrument lacks stay in the progression as steps marked "not on this instrument" and are skipped when playing. The progression keeps the sheet's tempo, beats per bar, sections on steps, bars per step, part-bar steps (`beats`) and the chosen transposition.
- **Play levels on handpan progressions.** A Level control (Chord · Roots · Arpeggio · Groove) on the progression player. Chord is Play as it was before (the default for existing progressions); imported handpan progressions start on Arpeggio. A level counts in one bar (clicks and 4-3-2-1), then shows the current chord numbered in strike order with L/R and the next chord faint on the pan. The patterns follow the table above: Roots is the lowest root on beat 1 of each bar; Arpeggio stacks the chord from its lowest root and plays 1-2-3-2 with alternating hands; Groove puts the root on strong beats, two notes together on backbeats and silent ghost taps between. Automatic rules: more than one chord in a bar or a tempo of 132 BPM and up plays roots and two-note pairs only; a chorus starts each bar with two notes together; a pair at the end of a step prefers notes the next chord shares. The Arpeggio level keeps the table's 1-2-3-2 rather than applying the ring rule.

**Still to do:** ABC, MusicXML and MIDI import; melodies (the song shape, melody notes and the note-by-note player with wait mode); coverage across all of My instruments at once (a best-first list with badges, not just the instrument in hand) including octave shifts and the melody share; a licensed song catalogue; sections looping and tempo from 25% in the player; play levels on ocarina and flute (practice mode still walks the arpeggio).

## Ideas for later

Parked on purpose; not planned for a phase yet.

- **Identify a chord by ear (handpan).** A microphone button in Identify mode: the app listens and checks, for each note on the pan, whether its tone (with the overtones a handpan note always has) is ringing. The notes it hears light up on the pan, you tap to fix any it got wrong, and Identify names the chord. Easier than general chord recognition because the candidates are only the pan's own 9–17 notes; notes an octave apart (a D3's strong D4 overtone against a struck D4) are the hard case. Parked by the owner: tapping the notes already works well.

### Sub-holes (12-hole ocarinas)

Source: Pure Ocarinas, "The ocarina's fingering system" (https://pureocarinas.com/ocarina-fingering-system).
- Two layouts. **Taiwanese:** one sub-hole beside each middle finger (R2 and L2). **Japanese:** both on the right hand, beside the index and middle fingers (R1 and R2).
- They extend the range down below the "all finger holes closed" note: on an alto C, B with the right sub-hole closed, A with both closed. A finger slides forward so its pad covers its own hole and the sub-hole at once.
- An 11-hole ocarina has one sub-hole, beside either middle finger; the left one shares the work between the hands.
- The app's first guess for 11–12 holes is the Taiwanese layout (as on the STL 12-hole chart). Hole fingers offers both layouts for a bought ocarina.
- **Built:** the Build tab's Design step has **Sub-holes: None / 1 / 2** (two: beside R2 and L2, or beside R1 and R2). They don't take any of the scale's notes: the scale stays on the finger holes, and the sub-holes **add notes below it**, each a semitone or a tone lower than the one above, a note of the scale's key where one is that close, otherwise a tone (`subExtensionNotes`). D Kurd gets C3 and Bb2 below its D3 ding; a C major scale gets B3 and A3 below C4, as on an alto C. They are the lowest chamber's first holes in opening order and are sized by the same Helmholtz maths, so they come out small; the chamber is sized for the new lowest note. In the drilling plan they come first, named "L2 sub-hole" / "R2 sub-hole", placed just past their finger's hole toward the fingertip; the test hole is always a finger hole.
