# Parity gaps and the recorder: design note

From the outside-in review (November 2026). CLAUDE.md says every instrument gets the same experience; this note lists where that wasn't true, what each gap gets, where each chart comes from, and what is left for the owner to decide. Built in three pull requests into `preview`:

| | Branch | What |
|---|---|---|
| a | `review/parity-and-recorder` | Play levels for one-note instruments, link and preview fixes, docs that say what is true, this note |
| b | `review/chart-gaps` | Charts for the types that silently fell back to the tuner, and an honest line for those still missing |
| c | `review/recorder` | The recorder as a full instrument |

None needs another to work, so they can be merged in any order. After the first is merged, the others need `preview` merged into them: they touch the same lists (`js/charts.js`, `js/links.js`, the setup's types in `js/app.js`, CLAUDE.md's checklist) and git can't join those lines by itself. The conflicts are small and mechanical.

## 1. Play levels on ocarina and flute

**Gap.** The progression player's levels (Chord, Roots, Arpeggio, Groove) ran only on handpans, tongue drums and kalimbas. An ocarina or flute got one button, "Practice", an untimed walk through each chord's arpeggio.

**What it gets.** The same player, through the same shared part (`viewProgression`, one timer `progLevelTick`): Play with a one-bar count-in, tempo, beats per bar, the back-to-start row. Where the pan is, the fingering of the note being blown, with the arrows from the note before. A one-note instrument has no whole chord to strike, so its levels are:

| Level | What plays | Stored as |
|---|---|---|
| Roots | The chord's root, held for each bar | `roots` |
| Arpeggio | One note a beat from the root, the handpan's 1-2-3-2 | `arpeggio` (a playlist saved at `chord` plays as this) |
| Melody | The root held for the first half of the bar, then the other chord notes, a different one first in each bar | `groove` |

More than one chord in a bar, or 132 BPM and up, plays the root and one other note (the handpan's rule). Notes are held for their length with a breath before the next. "Practice chord by chord" stays under Play. The level is stored on the playlist, as before, so a playlist set to Groove on a handpan plays as Melody on a flute.

Pure pattern: `windPattern` in `js/chordsheet.js`, tested in `tests/chordsheet.test.mjs`.

## 2. Links and the Listen promise

- Ocarina and flute links had no `/playlists` tab. They have it now (`LINK_TABS`), and every family has the same tabs (tested).
- The `/listen` link's preview card said "Listen to a song and play along". Listen is at step 1 of the 7 in `docs/listen-mode.md`: it names one chord played nearby. The card now says "Hear a chord someone plays nearby and find it on the …".
- Listen steps 2–7 are **not built and parked** until usage of step 1 justifies them (the review's recommendation). `docs/listen-mode.md` now opens with a status table saying so.

## 3. Chart gaps

The rule: a fingering chart comes from a published source, with its URL in the data file, never from memory. Each chart below was read twice by different methods (by eye, and by measuring each hole's fill in the source's drawing) unless it says otherwise.

| Type | Status | Source | Notes |
|---|---|---|---|
| 4-hole pendant ocarina | **Added** | STL Ocarina booklet "The Art of Ocarina – A Guide for Your New 4 or 6-Hole Ocarina", pp. 2, 5, 15: https://cdn.shopify.com/s/files/1/0103/7756/0119/files/6HoleFinalPDF.pdf | STL has no separate 4-hole chart. The booklet says the 4-hole stops at the note where the 6-hole first lifts a thumb, so this is its chart up to there (13 notes). No Langley chart was found. |
| 10-hole ocarina, Italian and Asian systems | **Added, marked generic** | The Art of Ocarina Making, chart generator (Robert Hickman, maker of Pure Ocarinas): https://ocarinamaking.com/chartgen/ | The source says its charts are generic and "not intended to reflect those of any single maker". No maker's own 10-hole chart was found. The app says "a generic chart, check it with the tuner" in the setup and names the source that way. The Asian chart's top notes were read once and checked against the author's text. See question 1. |
| Tin whistle in C | **Added** | Clarke Tinwhistle, "C & D Basic Fingering Sheet", from https://www.clarketinwhistle.com/downloads | Clarke's own chart, with its alternates. |
| 7-hole and 8-hole ocarinas | **Missing** | Looked at STL, Imperial City, Pure Ocarinas, the generator | No maker's chart found. |
| Double and triple ocarinas | **Missing** | STL: https://cdn.shopify.com/s/files/1/0103/7756/0119/files/12doubleregular.pdf and `…/triple.pdf` (read) | Not shown: the charts name no fingers, a ⊕ mark on them is unexplained, and two cells of the triple chart contradict the rest. Imperial City and Pure Ocarinas publish others, not yet read. They also need the chart format to hold several chambers. |
| Tin whistle in other keys | **Missing** | Killarney, Susato, Dixon list their keys | No maker's chart for those keys, and no maker says one chart serves every key (Clarke says only that the D whistle's ranges are a tone above the C's). |
| Another flute (fife, bansuri, Irish flute, shakuhachi) | **Missing** | Fife rows and a shakuhachi chart exist in the Woodwind Fingering Guide | Not read yet. Nothing found from a maker for the Irish flute or bansuri. |

For everything missing, `CHART_GAPS` in `js/charts.js` says what was looked for (a visible TODO in the data file), and the setup's row says "no published chart found yet: set up note by note with the tuner" instead of falling back without a word. Double and triple ocarinas get a line under the list with a link to ask for one.

## 4. The recorder

A new chart family, `recorder`, following every item of CLAUDE.md's "Adding an instrument".

**Data.** Two charts, each two octaves and a tone, fully chromatic (27 notes):

- **Baroque (English) fingering**: soprano (C5), alto (F4), tenor (C4), sopranino (F5). From the Woodwind Fingering Guide's basic chart (https://www.wfg.woodwind.org/recorder/rec_bas_1.html, `_2`, `_3`), read from the pages' text and checked note by note against Yamaha's soprano and alto charts and Mollenhauer's soprano chart. All four agree on every note but one.
- **German fingering**: soprano only. From Yamaha's German chart, checked against Mollenhauer's German chart.

Decisions in the data, each noted in the file:

- The second-highest note (C♯7 on a soprano) needs the bell closed against the knee in the Woodwind Fingering Guide and Mollenhauer. A picture of holes can't show that, so Yamaha's fingering without the bell is used.
- German G♯ in both octaves: the two makers agree with each other and differ from the Woodwind Fingering Guide. The makers are followed.
- Notes above the top D are left out: one source lists them, only as alternates that depend on the instrument.
- German fingering for alto and tenor: **missing** (TODO in the file). No German chart for those sizes was read; Yamaha notes they are mostly made baroque.
- Sizes: the Woodwind Fingering Guide says the fingerings apply to all sizes, and Yamaha's alto chart is its soprano chart hole for hole.

**In the app.** Its own picture (the flute's tube with a recorder's beak, ring and foot; the thumb hole in the "underside" strip), its own voice, a setup tile with its brand picture, the same Notes, Chords, Playlists, Listen, songs, save and share as the flute. The setup asks the fingering system, then the size. Links: `/recorder/soprano-baroque`, `/recorder/alto-baroque`, `/recorder/soprano-german` and so on, with `soprano`, `alto`, `descant`, `treble` as aliases. Preview image `og/recorder.jpg`.

**On the website.** The instrument page and one page per size, with the playable demo. The Sanity document is in `site/src/content/seed.ts` and is created in the live content by the fix `2026-11-21-recorder-available` in `site/scripts/content-fixes.ts`, which the production build runs once. The same fix changes "Recorder is next" on the home page while it still reads as it did.

## 5. Docs that contradicted the code

- **Setup.** CLAUDE.md said every instrument's setup defaults to "Play my notes"; the design system said ocarinas and flutes get "their own wizard". True: one setup, one frame. Struck instruments default to "Play my notes". Wind instruments are asked which type and then its key, because their fingerings come from the type's chart, which listening alone can't tell; "I don't know: listen" and "play it my own way" are beside it. Both documents now say this.
- **Chords modes.** The design system said both "Browse / Listen" and "Browse | Identify | Listen" for ocarina and flute. True: all three on every instrument.

## Open questions for the owner

1. **The 10-hole chart is generic, not a maker's.** It is by a known maker and author, read cleanly, and marked generic in the app. Recommendation: keep it, since "check it with the tuner" is honest and better than no fingerings. If the rule should be strictly "a maker's chart of a real instrument", remove the two 10-hole charts from (b) and the type goes back to note by note.
2. **The tin whistle's octave.** The charts are written from D4, as the published charts write them, and the app stores D4. A standard (high) D whistle sounds D5; the setup already finds the octave by listening. Recommendation: leave the data as written and decide separately whether the link `/flute/tin-whistle-d` should sound an octave higher. Not changed here.
3. **Recorder sizes.** Tenor and sopranino are included because the sources say the same chart serves every size. Recommendation: keep them. Bass and great bass are left out (keys and bocals make the picture wrong).
4. **Which fingering first.** Baroque is listed first and is what `/recorder/soprano` opens. Recommendation: keep; Yamaha recommends baroque, and every other size is baroque.
5. **Website copy for the recorder** (`seed.ts`) is a first draft in the site's voice. Edit it in the Studio after the first production build has created it.
