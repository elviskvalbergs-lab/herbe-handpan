# Navigation redesign: tabs, Songs, a calmer Chords screen, one microphone story

Design for the outside-in review of November 2026. Wireframes: `docs/navigation-wireframes.html`.
The shared patterns that come out of it are written into `docs/design-system.md` as each part is built.

Audience: adult "jammers" who own an instrument, want to play chords with friends and also play
songs, and mostly do not know theory. Owner decision that stays: guests keep nothing between visits.

## Open questions for the owner

Each has a recommendation, and the build proceeds on the recommendation. Say so if one should change:
every one is a label, an order or a default, cheap to flip afterwards.

| # | Question | Recommendation (built) | Alternative |
| --- | --- | --- | --- |
| 1 | What is the tab that holds playlists and progressions called? | **Sets**. One list, one "New set" button. A playlist and a progression stay two kinds of set (no data change, no rename of the detail screens). | Keep "Playlists"; or "Saved" (reads oddly for a guest, who keeps nothing). |
| 2 | Tab order | **Chords · Songs · Sets · Pan/Drum/Kalimba/Notes**, the same on every instrument: the three jobs first, the instrument's own tab last. A link without a tab still opens the instrument's own tab, as today. | Instrument tab first (ocarina players have Notes first today). |
| 3 | The ♡ opens "Add to playlist", it is not a favourite | A **bookmark** icon labelled "Save to a set", on the chord card only. List rows show a small bookmark when the chord is in a set, without a button. Same sheet as today behind it. | Make ♡ a real one-tap favourite and move "Add to a set…" into ⋯. Nicer, but changes what a tap does for existing users. |
| 4 | Speed ("1×") on every chord card | Moves into the chord's ⋯ sheet (it is also in Settings). Set once, rarely touched. | Keep on the card. |
| 5 | C# or D♭ | New default **Auto**: each tuning is spelt the way its scale is written (D Kurd shows B♭). The setting becomes Auto · C# · D♭. Someone who already chose C# or D♭ keeps it. | Keep sharps as the default. |
| 6 | "Add to home screen" on the first screen | Not on the first-run screen. It shows on My instruments and Play something else once the visitor has heard a chord (got value), as today otherwise. | Keep on the first screen. |
| 7 | "Save for next time" straight to an email form | Keep the moment (the last setup step, with the result on screen: it is the best moment). Change the wording: the button says **Keep this handpan**, and the sheet first says what an account gives and that without one it is gone when the page closes, then asks for the email. | Ask only after the first chord was played. |
| 8 | Own-made ocarinas have a fifth tab (Build or Set up) | Keep as the fifth tab, only on those instruments. | Move into the instrument's ⋯ menu. |
| 9 | Settings rows for one instrument family | Show a family's section only when the person has, or is trying, an instrument of that family. | Always show everything, collapsed. |

## 1. The jobs

A jammer opens Oakhum for one of three things:

1. **"What can my instrument play?"** Pick a chord, see it on my own instrument, hear it. → **Chords**
2. **"Teach me a song."** A melody I know, note by note, on my instrument. → **Songs**
3. **"We are playing together."** The chords of a tune, in order, ready to play along. → **Sets**

Everything else (the layout editor, the fingering chart, the tuner, setup, settings, the builder)
supports those three and should not compete with them for the first screenful.

## 2. Tabs: the same four on every instrument

| | Before | After |
| --- | --- | --- |
| Handpan, tongue drum, kalimba | Chords · Pan · Playlists | **Chords · Songs · Sets · Pan** (Drum, Kalimba) |
| Ocarina, flute | Notes · Chords · Playlists (· Build / Set up) | **Chords · Songs · Sets · Notes** (· Build / Set up) |

- One function builds both tab bars (`instrumentTabs`, replacing `handpanTabs` and `ocTabs`): labels,
  icons and order are decided once. Only the instrument's own tab differs.
- **Songs** is its own tab: the "Songs to learn" list (unchanged, it belongs to the songs work),
  then one row "Know the chords of a song? Paste a chord sheet", which makes a set.
- **Sets** is one list in place of the three stacked sections of the old Playlists tab.
  - A row is a playlist or a progression. Its second line says which and why you would use it:
    "Playlist · 4 chords here · 9 in total", "Progression · Am – Dm – Am · 8 bars".
  - Favorites is a playlist like any other, first in the list.
  - One button, **New set**, opens a sheet with three choices: "Chords to pick from" (a playlist),
    "Chords in order" (a progression), "Paste a chord sheet".
  - Playlists and progressions keep their data, their detail screens and their names as *kinds* of
    set. Nothing is migrated; the database is untouched.
- My instruments (Home) keeps its side list, now also titled "Sets", built from the same rows.

Controls on the phone screen (buttons, links and fields, counted on D Kurd as a guest):

| Screen | Before | After |
| --- | --- | --- |
| Playlists tab | 15 (4 concepts) | split in two: |
| Songs tab | – | 13 (songs, and the way in for a chord sheet) |
| Sets tab | – | 9 (1 concept) |

### Deep links

`LINK_TABS` gets `songs` and `sets` on every family (ocarinas and flutes had no playlists link at all).

| Old | Opens | Address bar becomes |
| --- | --- | --- |
| `/handpan/d-kurd/playlists` | the Sets tab | `/handpan/d-kurd/sets` |
| `/handpan/d-kurd/songs` (new) | the Songs tab | – |
| `/ocarina/alto-c-12/songs`, `/sets` (new) | the same on an ocarina | – |
| `#i/<id>/playlists` (a saved ocarina) | its Sets tab | `#i/<id>/sets` |
| every other link | unchanged | unchanged |

`parseLink` reads `playlists` as `sets`, and its `path` is the new spelling, so `loadFromUrl`
replaces the address the way it already does for an alias. No slug changes.

## 3. The Chords screen

Before, a phone shows at once: the picture (with rotate), the chord card with ♡, Chord, 1×, ⋯,
"Goes well with" chips and a Progressions link, a Browse | Identify | Listen switch, Filters, a row
of root chips, "6 main chords · Show all 61", and rows that each carry a ♡ and a bare "3".

After, top to bottom:

1. **Picture.** Unchanged.
2. **Chord card.** Name, notes, **▶ Chord**, **Save** (bookmark), **⋯**. Under it one line,
   "Goes well with" and its chips: it answers "what do I play next?", which is the question a
   player without theory has. Everything else is in ⋯.
3. **⋯ sheet** (one sheet for every instrument, `chordMoreSheet`, replacing `hpMoreSheet` and
   `ocChordMoreSheet`): Speed, Play the scale, Progressions that use this chord, Copy link, then the
   instrument's own rows (an ocarina's octaves, pairs and hole legend).
4. **One switch** with words that say what each does: **All chords · Tap notes · Listen**
   (was Browse · Identify · Listen).
5. **One line**: "6 main chords · Show all 61" on the left, **Filters** on the right. The root
   chips move into the Filters sheet as "Starts on" (one sheet, `chordFiltersSheet`, replacing
   `hpFiltersSheet` and `ocFiltersSheet`; the instrument adds its own field: Playlist or Scale).
6. **Rows.** Name and "Minor · 3 notes". No button in a row: a tap selects and plays. A chord that
   is in a set shows a small bookmark.

| Screen (phone, guest) | Before | After |
| --- | --- | --- |
| Handpan Chords, D Kurd, A minor selected | 39 | 25 |
| Ocarina Chords, alto C | 50 | 33 |
| Kalimba Chords, C major 17 | 32 | 22 |

## 4. The microphone: three words, one strip

Before, five features with overlapping names: Tuner (app bar), "Play my notes" (setup), "Listen"
(find a scale in the catalogue), Listen (Chords), Listen debug (Settings).

The rule: the word says **who is making the sound**.

| Word | Who makes the sound | What Oakhum does | Where |
| --- | --- | --- | --- |
| **Tuner** | you, one note | says how sharp or flat it is | the app bar (a tuning-fork icon, no longer a microphone), the builder, set-up readings |
| **Play my notes** | you, your instrument's notes | works out which instrument, scale or key you have | setup, the scale catalogue ("Play my notes", was "Listen"), the note picker ("Play it"), a flute's or ocarina's key ("Play its lowest note", was "Detect with tuner") |
| **Listen** | music around you: a song, a friend | names the chord it hears and shows it on your instrument | Chords › Listen, and only there |

- "Listen" is never used for the first two again; "tuner" is never used for the second.
- The microphone icon appears only on a button that starts listening; the Tuner gets its own icon,
  so the app bar no longer shows a microphone that is not "Listen".
- All three show the same strip while the microphone is on, and the same sentence before it is:
  "Oakhum only listens while this is open. Nothing is recorded."
- Listen debug is a builder's tool (PR #81 already hides it from everyone else). It is renamed
  "Microphone readings" in that section so the word Listen keeps one meaning.

## 5. First run

Before: the hero picture and the "Add Oakhum to your home screen" banner put the five instrument
tiles below the fold of a 390 × 844 phone; the install ask comes before any value.

After:

- The hero becomes a short brand strip (logo and one line); the picture stays on wide screens,
  beside the tiles. All five tiles are visible without scrolling on a 390 × 844 phone.
- No install banner on this screen (question 6).
- The step counter names the stage instead of repeating a number: "Step 3 of 4" on five
  consecutive screens becomes four named stages, **Instrument · Notes · Match · Ready**, shown as
  four dots with the current stage's name. Several screens can belong to one stage without the
  counter looking stuck.
- The last step's second button: "Keep this handpan" (question 7).

| Screen | Before | After |
| --- | --- | --- |
| First run: controls | 10 | 8 |
| First run: tiles visible without scrolling (390 × 844) | 2 | 5 |

## 6. Settings

Before: 13+ rows in 8 sections, several for one instrument family whatever the person plays.

After, four sections:

1. **Notes and display**: Theme · Note names (Auto · C# · D♭) · Note style.
2. **Playing**: Speed · Seconds per chord in auto-play.
3. **Your instruments**, only the families the person has or is trying:
   Handpan: ring orientation. Ocarinas and flutes: finger labels, hole sizes (builders), close-up,
   Which finger is which, Show the legend again. With no instrument yet, the section is absent.
4. **Account and about**: Sign in · Privacy · Feedback · Check for updates. (Builders also see
   Clay bodies and Microphone readings.)

| | Before | After (guest, handpan only) |
| --- | --- | --- |
| Controls | 27 | 19 |
| Sections | 8 | 4 |

## 7. The two shells

Handpan/tongue drum/kalimba and ocarina/flute grew as two shells with paired functions. Where this
redesign touches a pair it is merged into one shared part:

| Pair | Becomes | In |
| --- | --- | --- |
| `handpanTabs` / `ocTabs` | `instrumentTabs` | part 1 |
| `viewHandpanPlaylists` / `viewOcarinaPlaylists` bodies | `setsTabHtml`, `songsTabHtml` | part 1 |
| `hpFiltersSheet` / `ocFiltersSheet` | `chordFiltersSheet` | part 2 |
| `hpMoreSheet` / `ocChordMoreSheet` | `chordMoreSheet` | part 2 |
| the two Browse/Identify/Listen switches | `chordModeSegHtml` | part 2 |
| `handpanAppBar` / `ocHeader` | left as they are: the redesign does not change the app bar | – |

## 8. Build order

1. **Tabs, Songs, Sets** and the deep links.
2. **The Chords screen.**
3. **First run, Settings, microphone names, note spelling.**

Each part: tests and both builds before the commit, before/after screenshots at 390 px in the pull
request, `docs/design-system.md` updated.
