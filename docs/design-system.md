# herbe-handpan design system and redesign spec

Nov 11, 2026 · design review of the current build (screenshots `phone-01…17`, `desktop-01…17`) and the spec for the redesign.

This document is for the engineer who implements it. It covers the problems, the rules, the navigation model, tokens, components, every screen, and the order to build it in. Where it says "keep", the behaviour of the existing code stays as it is and only the presentation changes. Handpan behaviour (chord finding, filters, autoplay, discover, voicings, playlists, layouts, URL hashes) must not change.

---

## 1. Diagnosis

Ranked by how much each one costs a player using the app on a phone on a stand, with one hand free.

1. **There is no navigation model, only breadcrumbs.** Every screen starts with a breadcrumb of red back-links (`← Scales / ← D Kurd / Chords`, phone-08). The handpan layout editor can only be reached from a breadcrumb link. The ocarina views use three small pills floating at the top right (phone-10, 11, 13), and on a phone they drop to a second line. Practice mode, the most valuable ocarina feature, only appears after you choose a playlist in the third dropdown of the Chords toolbar (phone-11). The playlist screen's back link says "← Scales" even when you came from My instruments (phone-09, desktop-09). The brief's "the instrument name in the header opens My instruments" is missing.
2. **Toolbars are full of controls you set once.** The handpan Chords header has five buttons (Rotate, Flats, Do-Re-Mi, Discover, Copy URL) that push the phone page to 429px wide, so the whole page scrolls sideways at 390px (phone-08 is 429px wide). The ocarina Notes toolbar has eight controls on two lines (R4 L1, mm, ✋ Fingers, ♭ Flats, …, phone-10). "♭ Flats" appears on four different screens, while solfège only appears on one. The brief puts these in Settings, and there is no Settings screen.
3. **Red means everything.** The accent #CD4C38 marks primary buttons, selected chips, active tabs, the selected chamber count, every included note, toasts, the "blow" mouthpiece and changed holes. On the ocarina design screen there are 13 red elements at once (phone-04), so the eye can't tell a selection from an action, or which button to press.
4. **Text is too small and too faint to read from a stand or in daylight.** The muted colour `#4d7560` on `#090f0d` has a contrast of about 3.7:1. It's used for 10–12px text: family badges, hints, builder step names, chord types and the legend (phone-05, 10, 13). Body text is 13–14px, and pills and small buttons are 12px. There is no light theme for playing outdoors.
5. **Touch targets are under 44px.** Pills are 24–28px tall, `btn-sm` is about 28px, and the instrument card's delete × is about 20px in the corner of a tappable card (phone-05). The playlist reorder chevrons are 22px (phone-09), and builder step labels are 10px.
6. **Long, flat pages with nothing to hold onto.** The handpan step of the wizard is a 6983px column of 70 cards (phone-02). The catalogue is 8850px, with the sync bar and "My layouts" in the middle (phone-06). Ocarina Chords is 4710px (phone-11). On Set up, 12 dropdowns are followed by 13 reading rows (phone-16). Search never stays on screen, and nothing is grouped or collapsed.
7. **The tuner covers what you're recording.** The floating tuner panel sits on top of the "All holes closed" row and its record button, which is the row you're filling in (phone-17, desktop-17). The 🎤 record buttons only work once the tuner is already on (the first tap shows a toast asking you to tap again). The 🎤 and ✋ emoji don't match the SVG icon set and render differently on each platform.
8. **Desktop wastes space.** The ocarina views are capped at 720px, which leaves about 40% of a 1280px screen empty (desktop-10, 12, 13, 15). On desktop handpan Chords, the detail column is so narrow that "C Add9" wraps onto two lines and the notes onto four (desktop-08). Home shows three cards in the top left of an empty page (desktop-05).
9. **Global things are duplicated and out of place.** The sync email field sits on Home and on the catalogue (phone-05, desktop-06). "My layouts" on the catalogue repeats the handpan instruments on Home. The playlists strip appears on both screens. Toasts sit bottom-right and stay through unrelated steps ("D Kurd added" while designing an ocarina, phone-04). "✓ Saved" looks like a button but is a status (phone-07).
10. **The wizard asks too much at once.** Families are small pills, and "Next" is disabled with no explanation (phone-01). The ocarina design step shows the same thing twice: nine note-window pills and then the note chips (phone-04). The name field is a bare underline at the bottom.

## 2. Principles

1. **The instrument is the hero.** The pan drawing or the fingering diagram gets the most space and the best position. Controls sit around it, never in front of it.
2. **One accent, one meaning.** Red is for the primary action and for "do this now" on the instrument (blow here, this hole changes). Selection uses a neutral high-contrast fill. Status uses green and amber.
3. **Within thumb reach.** On a phone, navigation and the main action of each screen sit in the bottom third. Targets are at least 44×44px.
4. **Put each control where the brief's rule puts it.** If it changes while you play, it's on screen. If it's set once per instrument, it's in the instrument's ⋯ menu or its Build/Set up tab. If it's set once ever, it's in Settings.
5. **Readable at arm's length.** Body text is at least 15px and nothing is under 12px. Text contrast is at least 4.5:1. There's a light theme for daylight.
6. **One pattern everywhere.** Handpan and ocarina share one app bar, one tab bar, one list row, one sheet and one record field, so the two sides feel like one app.

---

## 3. Information architecture and navigation

### Screen map

```
Wizard (first run, or Add instrument)       full screen, own bottom action bar
Home = My instruments                        #  (empty hash)
 ├─ Try a scale (catalogue, unsaved)         (existing selector view)
 ├─ Settings                                 #settings
 ├─ Playlist detail                          (existing playlist view)
 └─ Instrument ─ tabs (bottom tab bar)
     Handpan:  Chords · Pan · Playlists      (existing #scale= / #custom? hashes unchanged)
     Ocarina:  Notes · Chords · Playlists · Build | Set up      #i/<id>/<tab>
         └─ Practice (full-screen focus view, entered from Playlists)
Sheets (overlays): instrument menu (⋯), Share, Add to playlist, Filters, Related chords,
                   Note picker, Which finger is which, Confirm delete, Hole fingers
Tuner: docked strip, can be switched on from any instrument or builder screen
```

### App bar (every screen except the wizard and Practice)

One sticky bar, `--appbar-h` 56px plus the top safe area, background `--bg`, with a 1px `--border` bottom edge. It has three slots:

| Slot | Home | Instrument (any tab) | Deeper screen (Settings, Playlist detail, Try a scale) |
| --- | --- | --- | --- |
| Left | title "My instruments" | **instrument switcher**: name + chevron-down, opens Home | back icon button (chevron-left) + title |
| Right | tuner icon button, settings icon button | tuner icon button, ⋯ menu icon button | tuner (except Settings), ⋯ where the screen has actions |

- **Switcher.** A 44px-tall button with the instrument name in `--fs-17`/600, cut off with an ellipsis, a 16px chevron, and `max-width: calc(100% - 3 × 44px)`. Tapping it goes to Home (`back-home`). That's two taps to switch: name, then the other instrument. An unsaved handpan from Try a scale shows a "Not saved" badge after the name. A shared instrument shows its public ID badge.
- **Back.** Back always goes to the screen this one was opened from, using the browser history the app already pushes. When there's no history entry (a deep link), it goes to the logical parent: Home for an instrument, Settings or playlists, and the instrument for Practice. This fixes "← Scales" on the playlist screen.
- **⋯ instrument menu** (a sheet on phone, a popover on ≥600px), as a list of rows:
  - Share… (code, link, QR). Not shown on shared instruments.
  - Copy link to this chord (handpan only; the existing `copy-url`).
  - Which finger is which (ocarina and flute; the existing `oc-hand-open`).
  - Settings.
  - Remove instrument (danger; opens the confirm sheet). Not shown for unsaved or shared instruments.
- On desktop (≥1024px) the instrument tabs sit in the middle of the app bar (see below), and the bar holds switcher | tabs | tuner + ⋯.

Breadcrumbs (`.breadcrumb`) are removed everywhere.

### Instrument sub-views: bottom tab bar on phone, top tabs on desktop

**Phone and tablet (<1024px):** a fixed bottom tab bar, `--tabbar-h` 64px plus the bottom safe area, with 2–4 equal-width tabs, each a 24px icon over a 12px label. The thumb reaches it, and it's always visible, so moving between Notes and Chords is one tap.

**Desktop (≥1024px):** the same tabs move into the app bar as text tabs (40px tall, 2px accent underline on the selected tab), and the bottom bar is hidden. The DOM is the same, and a media query moves it: render the tabs once inside the app bar and position them `fixed; bottom: 0` below 1024px.

| Family | Tabs (in order) | Opens on |
| --- | --- | --- |
| Handpan (saved) | **Chords** (`chords` view) · **Pan** (`editor` view) · **Playlists** | Chords, as today |
| Handpan (unsaved, from Try a scale) | Chords · Pan · Playlists | Pan, as today (`select-scale` lands in the editor) |
| Ocarina/flute, traditional or calibrated | Notes · Chords · Playlists | Notes |
| Ocarina, scale-built | Notes · Chords · Playlists · **Build** | Build while `build.stage !== 'done'`, otherwise Notes (as `openInstrument` does today) |
| Ocarina, custom | Notes · Chords · Playlists · **Set up** | Set up until calibrated (as today) |
| Shared (read-only) | Notes · Chords | Notes |

Notes and Chords only appear when `playableMidis(inst).length > 0`, as `ocTabs` does today. The "Pan" tab replaces the "← D Kurd" breadcrumb and the "Find Chords →" button. The "Playlists" tab is new: it's where Practice is started (ocarina) and where a playlist starts playing (handpan). For ocarina, the hash becomes `#i/<id>/<tab>` as the brief asks (`#i/<id>` alone still opens the default tab). Handpan hashes don't change.

### Current instrument and switching

- Home lists instruments, most recently played first (`touchInstrument` order, unchanged). With exactly one instrument, the app opens straight into it (unchanged).
- From anywhere inside an instrument, tapping its name in the app bar opens Home, and tapping another instrument opens it.
- Try a scale is a row on Home ("Try another scale"). It opens the catalogue, and picking a scale opens an unsaved handpan with the same tabs. A "Not saved" banner under the app bar has a **Save to My instruments** button (`save-layout`).

### Where the tuner lives

- There's a **tuner icon button (mic) in the app bar** of every instrument screen, Home, playlist detail and Practice. In the Builder and Set up it's the same app-bar button, so it's "on every instrument and builder step" without repeating it in the content. When the tuner is on, the button shows its pressed state (`aria-pressed="true"`, `--accent-soft` background, `--accent-text` icon).
- While the tuner is on, a **docked tuner strip** (spec in §5.13) sits directly above the tab bar. Without a tab bar it sits at the bottom edge, and on desktop it floats at the bottom of the content column. The page gets matching bottom padding, so the strip never covers content.
- Every Hz field has a record button that turns the tuner on by itself if needed (§5.3). Users never have to "turn on the tuner, then tap again".

### Settings: where it lives and what's in it

Settings opens from the gear icon on Home and from the ⋯ menu on any instrument. The route is `#settings`. It's a single scrolling page of grouped list rows (no sub-pages except Clay bodies). Its contents, in this order:

| Group | Row | Control | Stored as (existing pref unless marked new) |
| --- | --- | --- | --- |
| **Display** | Theme | segmented: Dark · Light · Auto | `theme` (new, default `dark`) |
| | Note names | segmented: Sharps (C#) · Flats (D♭) | `useFlats` |
| | Note style | segmented: Letters (C D E) · Solfège (Do Re Mi) | `useSolfege` |
| **Handpan** | Ring orientation | segmented: Standard · Rotated | `ringRotated` (also on the pan itself, see §6) |
| | Seconds per chord in autoplay | stepper (3, 4, 5, 6, 8, 10 s) | `autoplaySeconds` (also in the Now playing bar) |
| **Fingering diagrams** | Finger labels in holes (R4, L1, LT) | switch | `showFingers` |
| | Hole sizes in mm | switch | `showSizes` |
| | Which finger is which | row › opens the hand sheet | (`oc-hand-open`) |
| | Show the diagram legend again | row button | resets `ocLegendSeen` and `handLegendSeen` |
| **Tuning** | ~~A4 reference~~ | deferred by the owner's decision: no setting for now, A4 is 440 Hz everywhere | (none; see §7 step 15) |
| | Clay bodies | row › Clay bodies page: list with name and shrinkage %, editable | `getClayBodies` / `saveClayBodies` |
| **Sync** | Signed out: email field + "Send code"; code sent: code field + Verify + Cancel; signed in: email, "Sync now", "Sign out" | `authBarHtml` contents, moved here | |
| **About** | Version, "Check for updates" | row | (`checkForUpdates`) |

In the brief's terms: scale filter, chord filters, voicing, play and tuner stay on screen. Scale, transpose, gu notes, chamber count, clay body for this build and window sizes stay in Build. Type, key, name, ID and QR live with the instrument (⋯ menu and Share sheet). Everything in the table above is set once.

### Capability map (nothing is lost)

| Existing control (action) | New home |
| --- | --- |
| `add-instrument`, `other-instrument`, `open-instrument`, `delete-instrument` | Home: button, row, row tap, row ⋯ → confirm sheet |
| `auth-*` (sync bar) | Settings › Sync |
| `load-saved`, `delete-saved` ("My layouts" on the catalogue) | Removed as a duplicate: every saved layout is already a handpan instrument on Home (`syncHandpanInstruments`), opened and removed there |
| `open-playlist`, `open-playlist-chords` (playlist strip) | Home › Playlists section and the instrument's Playlists tab: row = detail, ▶ = play |
| `filter-notes`, `select-scale`, scale search | Try a scale |
| `toggle-flats`, `toggle-solfege`, `oc-toggle-fingers`, `oc-toggle-sizes` | Settings |
| `toggle-rotation` | Rotate icon button on the pan drawing (Chords and Pan) + Settings |
| `shell-mode`, `adjust-capacity`, `clone-layout`, `save-layout`, `pick-note`, custom name | Pan tab |
| `go-chords`, `back-editor`, `back-selector`, `back-home`, `oc-tab` | Tab bar, app bar back and switcher |
| `copy-url` | ⋯ menu › Copy link to this chord |
| `toggle-discover-mode`, `discover-*` | Chords › "Identify" segment |
| `toggle-note-count`, `filter-category`, `select-playlist-filter` (incl. "Edit playlist") | Chords › Filters sheet (plus an "Edit" link in the Now playing bar) |
| `filter-root` | Chords › root chip row |
| `toggle-autoplay`, `set-autoplay-seconds` | Chords › Now playing bar |
| `select-chord`, `play-chord`, `play-scale`, `show-playlist-picker`, `update-playlist-entry`, related chips | Chords › selected-chord bar and its "More" sheet (inline on desktop) |
| `move-chord-up/down`, `remove-playlist-chord`, rename, `delete-playlist`, `open-playlist-chord` | Playlist detail |
| `toggle-playlist-chord`, `show-new-playlist-input`, `confirm-new-playlist` | Add to playlist sheet |
| `oc-scale-filter`, `oc-play-scale`, `oc-select-note`, `oc-play-selected`, `oc-legend-dismiss` | Ocarina Notes |
| `oc-hand-open/close` | ⋯ menu, Settings, and the hand icon beside the moves line when finger labels are on |
| `oc-category`, `oc-chord-toggle`, `oc-voicing`, `oc-play-arp`, `oc-play-note`, `oc-play-pair`, `oc-show-playlist-picker` | Ocarina Chords |
| `oc-playlist` (playlist filter on ocarina Chords) | Playlists tab › playlist detail (shows the same chord cards) |
| `oc-practice-start/next/prev/stop` | Playlists tab ▶ Practice; Practice screen |
| `share-instrument`, `share-copy`, `share-close`, `shared-add` | ⋯ menu / Home row ⋯ → Share sheet; shared banner |
| `tuner-toggle` | App bar mic |
| `b-*`, `s-*`, `b-record` | Build and Set up tabs; record field |
| `wizard-*` | Wizard |

---

## 4. Tokens

Replace the current `:root` block in `styles.css` with the block below. The **legacy aliases** at the end keep every existing rule working, so step 1 of §7 changes the look without touching any selector. Remove each alias once its last user has gone.

The theme is set on `<html data-theme="dark|light|auto">` from the `theme` pref, and `auto` follows the OS. The JS that sets the attribute also updates `<meta name="theme-color">` (`#090F0D` dark, `#F3F6F4` light).

**The pan drawing follows the theme** (changed at the owner's request; it used to stay dark). `pan.js` draws with `--pan-*` tokens: dark steel in the dark theme, a light steel shell with darker lines in the light theme (`--pan-stage` #E4EBE6 behind it). The four chord colours are the same in both; the faint and other-octave note colours have light-theme versions. The fingering diagram follows the theme too.

```css
:root {
  /* ── Type ─────────────────────────────────────────────── */
  --font: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fs-12: 12px;  --lh-12: 16px;   /* minimum: captions, badges, tab labels */
  --fs-13: 13px;  --lh-13: 18px;   /* meta, helper text */
  --fs-15: 15px;  --lh-15: 22px;   /* body, buttons, list titles */
  --fs-17: 17px;  --lh-17: 24px;   /* app bar title, card titles, sheet titles */
  --fs-20: 20px;  --lh-20: 28px;   /* screen titles, moves line in practice */
  --fs-24: 24px;  --lh-24: 32px;   /* wizard questions, tuner note */
  --fs-32: 32px;  --lh-32: 40px;   /* share code, large numerics */
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  --tracking-overline: 0.06em;

  /* ── Spacing (4px grid) ───────────────────────────────── */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px;

  /* ── Radii (herbe: square-first) ──────────────────────── */
  --r-xs: 2px;   /* badges */
  --r-sm: 4px;   /* buttons, chips, inputs, segmented */
  --r-md: 8px;   /* cards, popovers, desktop modal, tuner (desktop) */
  --r-lg: 12px;  /* bottom-sheet top corners */
  --r-full: 999px; /* switch track, needle, progress dots only */

  /* ── Sizes and layout ─────────────────────────────────── */
  --touch: 44px;
  --control-h: 44px;          /* buttons, segmented, chips' hit area */
  --field-h: 48px;            /* inputs and selects on touch (16px font, no iOS zoom) */
  --appbar-h: 56px;
  --tabbar-h: 64px;
  --tuner-h: 72px;
  --gutter: 16px;             /* 24px at ≥1024 */
  --content-max: 1200px;
  --reading-max: 640px;       /* forms, wizard, practice */
  --z-appbar: 20; --z-tabbar: 20; --z-tuner: 30; --z-sheet: 40; --z-toast: 50;

  /* ── Motion ───────────────────────────────────────────── */
  --dur-1: 120ms;  /* hover, press, colour */
  --dur-2: 200ms;  /* expand, toast */
  --dur-3: 280ms;  /* sheet in/out */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  /* ── Colour: dark (default) ───────────────────────────── */
  --bg:           #090F0D;
  --surface-0:    #0C1713;   /* sunken: inside cards, fingering mouthpiece */
  --surface-1:    #111F19;   /* cards, list groups, sheets, tab bar */
  --surface-2:    #172A21;   /* inputs, secondary buttons, hover */
  --surface-3:    #1E372B;   /* pressed, switch track off, meter track */
  --border:       #1F3B2E;
  --border-strong:#2F5544;   /* inputs, secondary buttons, dividers you must see */

  --text-1:       #E4F2EA;   /* titles, values, covered holes        ~16:1 */
  --text-2:       #B8D0C4;   /* body                                  ~11:1 */
  --text-3:       #8BA898;   /* meta, helper, captions                 ~7:1 */
  --text-disabled:#56705F;   /* disabled only, never for information   */

  --accent:            #CD4C38;   /* brand mark: blow, changed holes, indicators */
  --accent-fill:       #C2412E;   /* primary button background (white text 5.1:1) */
  --accent-fill-hover: #CD4C38;
  --accent-fill-press: #A9382A;
  --on-accent:         #FFFFFF;
  --accent-text:       #EE7A66;   /* accent as text/icon on dark (7:1) */
  --accent-soft:       rgba(205, 76, 56, 0.16);

  --selected-bg:  #E4F2EA;   /* selected chip / segment: neutral, not red */
  --on-selected:  #0B1A14;

  --success:      #4CC38A;  --success-soft: rgba(76, 195, 138, 0.16);  /* in tune */
  --warning:      #E8B33A;  --warning-soft: rgba(232, 179, 58, 0.16);  /* near (10–50 ¢) */
  --danger:       #F07563;  --danger-soft:  rgba(240, 117, 99, 0.14);  /* delete, errors */
  --focus:        #7FD6D4;  /* 2px focus ring, distinct from accent and selection */

  --move-lift:    #6FD0CE;  /* lift arrow + "lift" word */
  --move-cover:   #E8B33A;  /* cover arrow + "cover" word */
  --hole-covered: var(--text-1);
  --hole-open:    var(--bg);
  --pan-stage:    #090F0D;  /* card behind the pan drawing */
  --scrim:        rgba(0, 0, 0, 0.6);

  --e-1: 0 1px 2px rgba(0, 0, 0, 0.35);
  --e-2: 0 8px 24px rgba(0, 0, 0, 0.45);   /* tuner, popover, toast */
  --e-3: 0 -12px 40px rgba(0, 0, 0, 0.55); /* bottom sheet */

  /* Chord colours (pan) — unchanged */
  --chord-c0: #CD4C38; --chord-c0-stroke: #e8906e; --chord-c0-text: #fff;
  --chord-c1: #D9A62E; --chord-c1-stroke: #f0c866; --chord-c1-text: #241c05;
  --chord-c2: #3FA7A6; --chord-c2-stroke: #7fd6d4; --chord-c2-text: #04211f;
  --chord-c3: #9B6FD4; --chord-c3-stroke: #c6a3f0; --chord-c3-text: #1c0d2e;
  --note-rest-bg: #162c22; --note-rest-text: #5a9878;
  --note-active-bg: #CD4C38; --note-active-text: #fff; --note-empty-border: #224838;

  /* ── Legacy aliases (remove as rules migrate) ─────────── */
  --surface: var(--surface-0);
  --card:    var(--surface-1);
  --muted:   var(--text-3);
  --text:    var(--text-2);
  --heading: var(--text-1);
  --primary: var(--accent-fill);
  --primary-hover: var(--accent-fill-hover);
  --primary-light: var(--accent-soft);
  --radius:  var(--r-sm);
}

/* ── Colour: light (daylight) ───────────────────────────── */
:root[data-theme="light"] {
  --bg: #F3F6F4; --surface-0: #E9EFEB; --surface-1: #FFFFFF; --surface-2: #F0F4F1; --surface-3: #E1E9E4;
  --border: #D3DED7; --border-strong: #A9BDB1;
  --text-1: #0F231A; --text-2: #2E4A3D; --text-3: #557064; --text-disabled: #93A79C;
  --accent: #C2412E; --accent-fill: #C2412E; --accent-fill-hover: #B23A27; --accent-fill-press: #9C3222;
  --on-accent: #FFFFFF; --accent-text: #B23A27; --accent-soft: rgba(194, 65, 46, 0.10);
  --selected-bg: #0F231A; --on-selected: #FFFFFF;
  --success: #17734E; --success-soft: rgba(23, 115, 78, 0.12);
  --warning: #8A5A00; --warning-soft: rgba(138, 90, 0, 0.12);
  --danger: #B3261E;  --danger-soft: rgba(179, 38, 30, 0.10);
  --focus: #0B6E6C;
  --move-lift: #0E7C7B; --move-cover: #9A6700;
  --hole-covered: #0F231A; --hole-open: #FFFFFF;
  --pan-stage: #0C1713; --scrim: rgba(15, 35, 26, 0.45);
  --e-1: 0 1px 2px rgba(15, 35, 26, 0.10);
  --e-2: 0 8px 24px rgba(15, 35, 26, 0.16);
  --e-3: 0 -12px 40px rgba(15, 35, 26, 0.20);
}
/* Auto: the same values as light when the OS asks for it. Keep this block identical to the one above. */
@media (prefers-color-scheme: light) {
  :root[data-theme="auto"] {
    --bg: #F3F6F4; --surface-0: #E9EFEB; --surface-1: #FFFFFF; --surface-2: #F0F4F1; --surface-3: #E1E9E4;
    --border: #D3DED7; --border-strong: #A9BDB1;
    --text-1: #0F231A; --text-2: #2E4A3D; --text-3: #557064; --text-disabled: #93A79C;
    --accent: #C2412E; --accent-fill: #C2412E; --accent-fill-hover: #B23A27; --accent-fill-press: #9C3222;
    --on-accent: #FFFFFF; --accent-text: #B23A27; --accent-soft: rgba(194, 65, 46, 0.10);
    --selected-bg: #0F231A; --on-selected: #FFFFFF;
    --success: #17734E; --success-soft: rgba(23, 115, 78, 0.12);
    --warning: #8A5A00; --warning-soft: rgba(138, 90, 0, 0.12);
    --danger: #B3261E;  --danger-soft: rgba(179, 38, 30, 0.10);
    --focus: #0B6E6C;
    --move-lift: #0E7C7B; --move-cover: #9A6700;
    --hole-covered: #0F231A; --hole-open: #FFFFFF;
    --pan-stage: #0C1713; --scrim: rgba(15, 35, 26, 0.45);
    --e-1: 0 1px 2px rgba(15, 35, 26, 0.10);
    --e-2: 0 8px 24px rgba(15, 35, 26, 0.16);
    --e-3: 0 -12px 40px rgba(15, 35, 26, 0.20);
  }
}
@media (min-width: 1024px) { :root { --gutter: 24px; } }
@media (prefers-reduced-motion: reduce) { :root { --dur-1: 0ms; --dur-2: 0ms; --dur-3: 0ms; } }
```

**Base rules:** `body { font: var(--fw-regular) var(--fs-15)/var(--lh-15) var(--font); color: var(--text-2); background: var(--bg); }`. Headings and values use `--text-1`. Numbers that change (Hz, cents, counts) use `font-variant-numeric: tabular-nums`. Text inputs use 16px below 1024px (keep the existing iOS zoom rule). Global focus rule: `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }`. Nothing gets `outline: none` without a replacement.

**Breakpoints:** phone <600px, tablet 600–1023px, desktop ≥1024px. Keep the existing landscape rule (`max-height: 500px and min-width: 620px`) for the handpan explorer.

---

## 5. Components

Class names are new, short and unique. Write the render helpers in `js/app.js` under a new `// ── UI primitives` section with `ui`-prefixed names (`uiAppBar`, `uiTabBar`, `uiSheet`, `uiRow`, `uiField`, `uiHzField`, `uiSeg`, `uiEmpty`). They return HTML strings like the rest of the code, and putting them in `app.js` means `build.py` doesn't change. The names must stay unique across `js/`.

### 5.1 Button `.btn`

| Size | Height | Padding | Font | Icon | Use |
| --- | --- | --- | --- | --- | --- |
| `.btn-lg` | 52px | 0 24px | 17/600 | 20px | Practice Next, wizard and sheet primary on phone |
| default | 44px | 0 16px | 15/600 | 20px | everything else |
| `.btn-sm` | 36px visual, 44px hit area* | 0 12px | 13/600 | 16px | dense desktop rows only (selected-chord card, list trailing) |

\* The hit area grows with `position: relative` plus `::after { content: ''; position: absolute; inset: -4px 0; }`.

| Variant | Rest | Hover (pointer) | Active | Disabled |
| --- | --- | --- | --- | --- |
| `.btn-primary` | bg `--accent-fill`, text `--on-accent` | bg `--accent-fill-hover` | bg `--accent-fill-press`, `translateY(1px)` | bg `--surface-3`, text `--text-disabled`, `cursor: not-allowed` |
| `.btn-secondary` | bg `--surface-2`, 1px `--border-strong`, text `--text-1` | bg `--surface-3` | bg `--surface-3`, border `--text-3` | text `--text-disabled`, border `--border` |
| `.btn-ghost` | transparent, text `--text-2` | bg `--surface-2`, text `--text-1` | bg `--surface-3` | text `--text-disabled` |
| `.btn-danger` | transparent, 1px `--danger`, text `--danger` | bg `--danger-soft` | bg `--danger-soft` | — |

- Common: `display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--r-sm); transition: background var(--dur-1), border-color var(--dur-1);`. Focus uses the global ring. `.btn-block` makes a button full width.
- **Only one `.btn-primary` per visible screen region.** In the current UI, toggles like "R4 L1", "mm" and "♭ Flats" switch to primary when on. That stops: toggles become switches (Settings) or `aria-pressed` icon buttons.
- Icon + label is the default; icon-only buttons use `.icon-btn`.

**Icon button `.icon-btn`**: 44×44px with a 24px icon (20px in dense rows), radius `--r-sm`. Variants: ghost (default: transparent, `--text-2`, hover `--surface-2`) and `.tonal` (`--surface-2` background, 1px `--border`). Toggle state: `[aria-pressed="true"]` gets an `--accent-soft` background and an `--accent-text` icon. Every icon button needs `aria-label` and `title`.

**Icons:** `js/icons.js` gets these 24px stroke icons (Lucide paths, the same style as now): `mic`, `settings`, `ellipsis`, `chevron-left`, `chevron-right`, `sliders-horizontal` (filters), `share-2`, `link`, `hand`, `music` (Chords tab), `circle-dot` (Pan tab), `list-music` (Playlists), `layout-grid` (Notes), `hammer` (Build), `wrench` (Set up), `trash-2`, `square` (stop), `skip-back`, `skip-forward`, `volume-2`, `sun`, `moon`, `info`. They also get three custom family glyphs: `family-handpan` (circle with an inner circle and 6 dots), `family-ocarina` (egg outline with 4 dots and a mouthpiece) and `family-flute` (a long rounded rectangle with 6 dots). The 🎤 and ✋ emoji are replaced by `mic` and `hand` everywhere.

### 5.2 Chip `.chip` and segmented control `.seg`

**Chip** (filter, choice, note): 40px tall (with an 8px gap the rows sit 48px apart, so they're comfortably tappable), padding 0 14px, radius `--r-sm`, font 14/500, 1px `--border-strong`, bg `--surface-1`, text `--text-2`.

- Hover: bg `--surface-2`, text `--text-1`.
- Selected (`.chip[aria-pressed="true"]` or `.is-selected`): bg `--selected-bg`, text `--on-selected`, border the same colour, font 600. **It is not red.**
- Disabled: text `--text-disabled`, border `--border`, with a reason in `title` and as helper text ("Flute (soon)" becomes a disabled tile with the "Coming soon" sub-line).
- Note-off variant `.chip.is-off` (builder note left out): dashed 1px `--border-strong`, text `--text-3`, `text-decoration: line-through`.
- Out-of-window (not tappable) variant `.chip.is-static`: no border, text `--text-3`, `cursor: default`.
- Chip row `.chips`: `display: flex; flex-wrap: wrap; gap: 8px`. Scrolling variant `.chips-scroll`: `flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity`, with negative side margins equal to `--gutter` so it bleeds to the screen edge, and hidden scrollbars. This is the only allowed horizontal scroll: inside a component, never the page.

**Segmented control** `.seg` (2–4 mutually exclusive options): 44px tall, bg `--surface-2`, 1px `--border`, radius `--r-sm`, padding 2px, `display: grid; grid-auto-flow: column; grid-auto-columns: 1fr`. Segments are 40px, font 14/600, text `--text-2`, radius 3px. Selected: bg `--selected-bg`, text `--on-selected`. Use `role="radiogroup"` with `role="radio"` and `aria-checked` on each segment. Uses: shells (Both/Top/Bottom), Chords mode (Browse/Identify), chamber count, chamber switch in Build, and every Settings choice.

**Switch** `.switch` (Settings on/off rows): a 44×26px track with radius `--r-full`, bg `--surface-3` and a 1px `--border-strong` border. The knob is 20px, `--text-2`, 3px inset. On: track `--selected-bg`, knob `--on-selected`, `transform: translateX(18px)`, `var(--dur-1)`. The whole row is the hit target. Use `role="switch"` with `aria-checked`.

### 5.3 Fields `.field`, select, number, stepper, record field

- **Field wrapper** `.field`: a column with a 6px gap. Label 13/600 `--text-2`, helper 13/400 `--text-3`, error 13/500 `--danger` (and the input border turns `--danger`).
- **Input and select** `.input`, `.select`: height `--field-h` (48px; 44px at ≥1024), padding 0 12px, bg `--surface-2`, 1px `--border-strong`, radius `--r-sm`, text `--text-1` 16px (15px at ≥1024). Placeholder `--text-3`. Hover border `--text-3`. Focus: border `--focus` plus the global ring. Disabled: bg `--surface-1`, text `--text-disabled`. A select gets a custom 16px chevron-down at the right (`appearance: none`, `padding-right: 36px`). The name field (currently a bare underline, `.name-input`) becomes a normal `.input`.
- **Unit suffix** `.input-unit`: the input sits in a wrapper with the unit ("Hz", "mm", "%") absolutely placed at the right in 13px `--text-3`, and the input gets `padding-right: 40px`.
- **Number stepper** `.stepper-num` (transpose, shell capacity, autoplay seconds): `[−] value [+]`. The buttons are 44×44 `.icon-btn.tonal`, and the value is 20/700 `--text-1`, centred, min-width 56px, tabular. Below that, a 13px helper ("semitones", "9 notes incl. ding · 0 empty"). The − and + buttons are disabled at their limits (existing logic).
- **Record field** `.rec` (every Hz input: builder readings and Set up). One joined control: `[ input (flex 1, min 96px) Hz ][ mic 48×48 ]`, outer corners `--r-sm`, a shared 1px `--border-strong`, and the button separated by a 1px left border. Render it from `uiHzField(path, value)`, which replaces `hzField`. States:

| State | Look | Behaviour |
| --- | --- | --- |
| Idle, empty | placeholder "Hz", mic `--text-2` | Tapping the mic **arms** the field and turns the tuner on if it's off (no "tap again" toast) |
| Armed / listening | button bg `--accent-soft`, mic `--accent-text`, an 8px pulsing dot (`--accent`, 1s, none with reduced motion), placeholder "Listening…", `aria-live="polite"` | The first `reading.stable` with Hz > 0 fills the field (rounded to 0.1, through `setReading` as today), saves, and disarms. Tapping again disarms. Only one field is armed at a time |
| Captured | value shown; the mic briefly becomes a `check` in `--success` for 1s | The status line below updates |
| No steady note after 8s | helper text "No steady note yet: keep blowing, or type the value" in `--warning` | stays armed |
| Error (mic refused) | helper text in `--danger` with the tuner's error message | disarms |

  This replaces the current two-step `b-record` behaviour (an ocarina-side change only). Typed input still works exactly as today (`b-input`).
- **Status line** `.rec-status` under a reading: 13/600, ✓ + "in tune" in `--success`, "12 cents flat: open it slightly" in `--warning`, "sharp: can't be lowered by filing" in `--danger`. Text comes from `noteAdvice`, unchanged.

### 5.4 Card `.card`

bg `--surface-1`, 1px `--border`, radius `--r-md`, padding 16px (20px at ≥1024), no shadow (`--e-1` only on light theme). Header: optional overline `.overline` (12/600, uppercase, `--tracking-overline`, `--text-3`, 12px bottom margin) or title 17/600 `--text-1`. A tappable card (`.card.is-link`) gets a hover border of `--border-strong`, an active bg of `--surface-2`, and must be a `<button>` or carry `role="button" tabindex="0"`. Cards don't nest: inside a card, use `.divider` (1px `--border`, 16px vertical margin) or plain sections.

### 5.5 List row `.row` and list group `.list`

The workhorse: instruments, scales, chords, playlists, playlist entries, settings, menu items.

- `.list`: a card with zero padding and rows separated by a 1px `--border` inset 16px from the left. `.list-title` above it: overline style, 24px top margin.
- `.row`: `display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; min-height: 56px; padding: 8px 8px 8px 16px`.
  - Leading slot (optional): a 40×40 glyph tile (radius `--r-sm`, bg `--surface-2`, 24px icon `--text-2`), or a 48px-wide mini fingering, or a 24px checkbox.
  - Text: title 15/600 `--text-1` (one line, ellipsis); meta 13/400 `--text-3` (up to 2 lines, `-webkit-line-clamp: 2`); optional third line, the same.
  - Trailing: up to 3 × 44px icon buttons, a badge, a count (13/600 tabular `--text-3`, the existing `.chord-count`), or a 20px `chevron-right` `--text-3` when the row navigates.
- States: hover bg `--surface-2`. Pressed: bg `--surface-3`. **Current/selected** (the selected chord, the current note): bg `--surface-2`, a 3px `--accent` bar on the left (`box-shadow: inset 3px 0 0 var(--accent)`), title `--text-1`. Disabled: 0.5 opacity, no pointer events.
- Trailing buttons stop propagation (as `fav-btn` does today).

### 5.6 Bottom sheet `.sheet` (also the desktop modal) and popover

One component replaces `.modal`, `.picker-modal`, `.share-modal`, the note picker and the hand legend.

- Scrim `.sheet-scrim`: fixed inset 0, `--scrim`, `z-index: var(--z-sheet)`. Tapping it closes the sheet (existing `*-close` actions).
- Phone (<600px): fixed to the bottom, full width, `max-height: 85dvh`, radius `--r-lg --r-lg 0 0`, bg `--surface-1`, shadow `--e-3`. A grab handle (36×4px, `--border-strong`, radius full, 8px from the top). Header 56px: title 17/600 at left, close `.icon-btn` (x) at right. The body scrolls with 0 16px padding. An optional footer is sticky with 16px padding + the bottom safe area, a top border `--border`, and full-width buttons (primary right, or stacked primary above ghost). Enter: `translateY(100%) → 0` over `--dur-3 --ease-out`; leave: `--dur-2 --ease-in`.
- ≥600px: a centred modal, `width: min(480px, 100% - 48px)`, radius `--r-md`, no handle, max-height 80dvh, fading and scaling from 0.98 over `--dur-2`.
- Behaviour: `role="dialog" aria-modal="true" aria-labelledby` points at the title. Focus moves to the first control and is trapped. Esc closes. Focus returns to the trigger. The page under it doesn't scroll (`body:has(.sheet) { overflow: hidden }`).
- **Menu** variant (⋯ menus): on phone, a sheet whose body is a `.list` of rows (icon + label, danger rows in `--danger`). On ≥600px, a **popover**: absolutely placed under its trigger, aligned right, min-width 240px, bg `--surface-1`, 1px `--border-strong`, radius `--r-md`, `--e-2`, rows 44px.
- **Confirm** variant: title ("Remove Blue D Kurd?"), body 15px `--text-2` ("Its readings and build history are removed from this device and from sync."), footer with [Cancel ghost] and [Remove `.btn-danger` filled with `--danger` bg / `--on-accent` text]. This replaces `window.confirm` in `delete-instrument` and `delete-playlist`.

### 5.7 Toast `.toast`

Bottom centre, `bottom: calc(var(--tabbar-h, 0) + var(--tuner-h, 0 when the tuner is on) + env(safe-area-inset-bottom) + 12px)`, `width: max-content; max-width: min(420px, 100% - 32px)`. bg `--text-1` (inverted), text `--bg`, 14/500, padding 12px 16px, radius `--r-sm`, `--e-2`. It has an optional action (ghost button, text `--accent` on light / `--accent-fill` on dark, e.g. "Open" after "D Kurd added"). It shows for 3s (5s with an action), fading and sliding up 8px over `--dur-2`, with `role="status"`. **Not red.** Toasts are cleared on view change (the wizard's "D Kurd added" must not follow you to the next step; it shows on Home instead).

### 5.8 Tab bar `.tabbar` and top tabs

- Phone and tablet: `position: fixed; left: 0; right: 0; bottom: 0; height: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom)`, bg `--surface-1`, top border 1px `--border`, `z-index: var(--z-tabbar)`. `role="tablist"`. Each tab: `flex: 1`, a column with a 2px gap, a 24px icon and a 12/500 label, colour `--text-3`.
- Selected tab: icon and label `--text-1`, label 600, plus a 24×3px `--accent` bar 6px above the icon (radius full), with `aria-selected="true"`. Hover: `--text-2`. Focus: the ring inset by 2px.
- ≥1024px: the same element sits inside the app bar, centred: `position: static; height: 56px; background: none; border: 0`, with tabs in a row, auto width, padding 0 16px, a 15/600 label, no icon, and a selected 2px `--accent` underline at the bottom edge.
- The content area gets `padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 16px)` on screens with a tab bar (`body.has-tabbar`), plus `--tuner-h` while the tuner is on (`body.tuner-on`).
- The tab bar is hidden in the wizard, in Practice, in sheets, and while an input is focused on phone (`body:has(input:focus, select:focus) .tabbar { display: none }` below 600px, so the keyboard doesn't push it up over the field).

### 5.9 App bar `.appbar`

`position: sticky; top: 0; z-index: var(--z-appbar); height: calc(var(--appbar-h) + env(safe-area-inset-top)); padding: env(safe-area-inset-top) 4px 0;` bg `--bg`, bottom 1px `--border`. Grid: `auto 1fr auto`. The left slot is the back icon button (44) and/or the title or switcher. The title is 17/600 `--text-1` with ellipsis. The right slot holds up to 3 icon buttons with a 0 gap. On desktop, its inner content is constrained to `--content-max`. Spec of the switcher and slots: §3.

Under the app bar there's an optional **banner** `.banner` for the shared and unsaved states: 48px min height, padding 8px 16px, bg `--accent-soft`, 13/500 `--text-1`, with one right-aligned `.btn-sm` (primary: "Add to My instruments" / "Save").

### 5.10 Empty state `.empty`

Centred, 48px top padding, max-width 32ch. 40px icon `--text-3`, title 17/600 `--text-1`, body 15 `--text-2`, and one primary or secondary button 16px below. Examples: no instruments ("Add the instruments you play" + Add instrument); no chords match ("No chords match these filters" + Clear filters); empty playlist ("Tap ♥ on any chord to add it here" + Go to Chords).

### 5.11 Builder stepper `.bsteps`

- A row of 7 steps, each a 44×44 button holding a 28px circle with its number (13/700). States: **done** = check icon on `--surface-3`, `--text-1`; **current** = `--selected-bg` fill, `--on-selected` text; **future** = transparent, 1px `--border-strong`, `--text-3` (still tappable: `b-stage` lets you jump, unchanged). Steps are joined by 2px `--border` lines (done: `--text-3`). `role="list"`, with `aria-current="step"` on the current step and `aria-label="Step 3: Voice and drill"` on each.
- Phone: no labels under the circles. 7 × 44 = 308px, which fits in 328px at 360 wide with the lines shrinking. Below the row: "Step 3 of 7" 13 `--text-3`, and the stage title at 20/600 `--text-1` with its qualifier ("leather-hard") in `--text-3`.
- ≥600px: a 12/500 label under each circle (`STAGE_TITLES` up to the parenthesis), `--text-3`; the current one is `--text-1`.

### 5.12 Badge `.badge`

20px tall, padding 0 6px, radius `--r-xs`, 12/600, uppercase, letter-spacing 0.04em. Variants: `.badge` neutral (bg `--surface-3`, `--text-2`), used for family on rows and "Not saved"; `.badge-accent` (bg `--accent-soft`, `--accent-text`), used for "Your test hole" and "Together" (two-note pair); `.badge-success` / `.badge-warning` (soft background, matching text), used for "Building 3/7" (warning) and "Calibrated" (success). There's at most one badge per row. The current `.family-badge` and `.oc-badge` become `.badge`.

### 5.13 Tuner strip `.tuner`

Docked, never overlapping content (§3).

- Phone and tablet: `position: fixed; left: 0; right: 0; bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom))` on screens with a tab bar, and `bottom: env(safe-area-inset-bottom)` otherwise. Height `--tuner-h` (72px), bg `--surface-1`, top border 1px `--border-strong`, `--e-2`, `z-index: var(--z-tuner)`.
- ≥1024px: `left: 50%; transform: translateX(-50%); bottom: 16px; width: min(560px, 100% - 48px); border: 1px solid var(--border-strong); border-radius: var(--r-md)`.
- Layout: `grid-template-columns: 72px 1fr 44px; gap: 12px; padding: 8px 4px 8px 16px; align-items: center`.
  - **Note block:** the heard note at 24/700 `--text-1` ("D4", or "—" while listening), and cents below at 13/600 tabular ("−3 ¢").
  - **Middle:** a status line at 13/500 ("Target D4 · in tune", "D4 is 12 ¢ flat", "Hearing E4, looking for D4", "Listening…"), with Hz right-aligned at 12 tabular `--text-3`. Under it, the meter: an 8px track (`--surface-3`, radius full); an in-tune band ±10 ¢ (20% of the width, centred, `--success-soft`); a centre tick 2×16px `--text-3`; and the needle, 4×20px, radius full, at `left: 50% + cents%` clamped to ±50, transitioning `left` over 80ms (none with reduced motion).
  - **Close:** `.icon-btn` x (`tuner-toggle`).
- Colour by state: in tune (|¢| ≤ 10) → note, status and needle `--success`; near (10–50 ¢) → `--warning`; far or no target → needle `--text-1`, status `--text-2`; listening → note "—", no needle. Error → the whole middle shows the message in `--danger`, plus a "How to allow the microphone" link that opens the browser's help in a new tab.
- `aria-live="polite"` on the status line only. Throttle announcements to stable readings, not 20 a second.
- The existing logic (`tunerPanelInner`, `onTunerReading`, `tunerTarget`, in-place updates) stays; only the markup and classes change.

### 5.14 Fingering diagram card

`renderFingering` keeps its signature. These are the containers and CSS around it.

| Size | Container | Width | Height cap | Notes |
| --- | --- | --- | --- | --- |
| **Large** `.fg-stage` | card (`--surface-1`, radius `--r-md`, padding 16px) | `min(100%, 420px)`, centred | `40dvh` on Notes (sticky stage), `52dvh` in Practice; the SVG gets `max-height` and `width: auto` | Below the SVG: the **moves line** 17/600 `--text-1`, centred, min-height 24px. The words "Lift …" are wrapped in `--move-lift` and "Cover …" in `--move-cover` (split the existing `fingeringMoves().text`; if splitting is awkward, colour the whole line `--text-1`). On the right of the moves line, a 44px `hand` icon button when finger labels are on. Tapping the SVG plays the note (`oc-play-selected`, unchanged) |
| **Medium** `.fg-cell` | button cell, bg `--surface-1`, 1px `--border`, radius `--r-sm`, padding 6px | grid column ≥104px on phone (3 columns at 360), ≥132px desktop | none | Selected: 2px `--selected-bg` border (inset with `box-shadow`, so the layout doesn't jump). Hover: border `--border-strong`. Dimmed by the scale filter: opacity 0.35 (keeps the tap). Focus ring. `aria-pressed` on the selected one |
| **Mini** `.fg-mini` | no background | 64px (arpeggio), 72px (Practice "up next"), 48px (row leading slot) | — | Between minis in an arpeggio: `.fg-move` 56px wide, 12/500 `--text-2`, centred, up to 3 lines, with a 16px chevron-right `--text-3` above it |

SVG classes in `styles.css` get new values only:

- `.fg-body`: fill `--surface-0`, stroke `--border-strong`.
- `.fg-c` (covered): fill and stroke `--hole-covered`.
- `.fg-o` (open): fill `--hole-open`, stroke `--hole-covered`, 2px.
- `.fg-mouth.fg-blow` and `.fg-blow-label`: `--accent` (the "do this now" mark keeps the brand red).
- `.fg-changed`: stroke `--accent`, 4px.
- Arrows: `.fg-arrow-up` `--move-lift`, `.fg-arrow-down` `--move-cover`.
- `.fg-dim`: 0.3.
- `.fg-note`: `--text-1`.
- `.fg-size` and `.fg-strip-label`: `--text-3`. In SVG units these render at least 12px at the large size; in mini/medium, sizes and labels are hidden (already the case unless `showSizes` is on).

Legend line `.fg-legend` (first time only): a row of three 16px glyphs with labels 13 `--text-2` and a "Got it" ghost `.btn-sm` (`oc-legend-dismiss`), placed directly under the stage.

---

## 6. Screen-by-screen redesign

The wireframes are at 360px. `[ ]` is a button, `( )` a chip or segment, `▾` a select, `›` navigation, `⋯` a menu, and 🎤 means the `mic` icon (not the emoji).

### 6.1 Wizard: families (phone-01, desktop-01)

```
┌──────────────────────────────────────┐
│ Welcome                              │ app bar, no back on first run; "← Add instrument" otherwise
├──────────────────────────────────────┤
│ Step 1 of 3                          │ 13 text-3 (count = 1 + ticked families, updates live)
│ Which instruments do you play?       │ 24/600
│ Pick all that apply. You can add     │ 15 text-2
│ more later.                          │
│ ┌──────────────────────────────────┐ │
│ │ ◎  Handpan                    ☐ │ │ selectable tile = .row in a .list, 72px,
│ │    Pick yours by scale           │ │ trailing 24px checkbox; selected: selected-bg check,
│ ├──────────────────────────────────┤ │ row bg surface-2
│ │ ⬭  Ocarina                    ☐ │ │
│ │    Bought, or one you're making  │ │
│ ├──────────────────────────────────┤ │
│ │ ━  Flute                 SOON    │ │ disabled row, badge "Soon"
│ └──────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤ sticky bottom action bar (wizard only):
│ [Just browse scales]        [Next →] │ ghost left (first run only) · primary right, btn-lg
└──────────────────────────────────────┘
```

- When nothing is ticked, Next stays disabled with the helper "Tick at least one" shown above the bar.
- The wizard action bar (`.actionbar`): fixed bottom, bg `--bg`, top border, padding 12px 16px + the safe area, and `justify-content: space-between`. The content gets matching bottom padding.
- Desktop: the content is centred at `--reading-max` (640px), and the action bar is inline at the end of the content (static, not fixed).

### 6.2 Wizard: which handpan (phone-02, desktop-02)

```
App bar: ← | Add instrument            (or "Welcome")
Step 2 of 3 · Which handpan do you have?
┌ sticky under app bar ───────────────┐
│ [⌕ Search scales…               ]   │ .input 48px
│ (All) (9 notes) (10) (11+)          │ chips-scroll; same filter as Try a scale
└─────────────────────────────────────┘
KURD                                    overline group headers (by family, in SCALES order)
│ D Kurd                            › │ .row 64px: title; meta "9 notes · D3 ding";
│ 9 notes · D3 ding                   │ the description is left out here (it's in Try a scale)
│ E Kurd …                            │
CELTIC MINOR
│ …                                   │
Custom layout? Add it later from        13 text-3, at the end of the list
"Try another scale" → Pan → Customize.
Action bar: [Skip]
```

- Tapping a row adds the handpan (`wizard-pick-handpan`) and moves to the next step. The "D Kurd added" toast shows only once the wizard ends, on Home, and in the meantime the step title confirms it ("D Kurd added. Now your ocarina.").
- Desktop: rows become a 3-column card grid (`.grid-cards`, `minmax(260px, 1fr)`), with search and chips sticky.

### 6.3 Wizard: add an ocarina (phone-03, desktop-03) and "I have one"

```
Step 3 of 3 · Add an ocarina
┌ .list ──────────────────────────────┐
│ ⬭  I have one                     › │ 80px rows, meta 13 text-3 (2 lines)
│    A bought ocarina. You'll chart   │
│    it with the tuner.               │
├─────────────────────────────────────┤
│ ⚒  I'm making one                 › │
│    A clay ocarina tuned to a        │
│    handpan scale.                   │
└─────────────────────────────────────┘
Action bar: [Back]                [Skip]
```

"I have one" form (the same pattern as the flute step):

```
Your ocarina
Name        [ My ocarina                 ]
Type        [ Unknown or other: chart it… ▾ ]
— when a chart is chosen —
Key         [ Alto C                     ▾ ]
            Chart source: maker.com          13 text-3 link
— when custom —
Holes, thumb holes included   [−] 12 [+]     stepper-num (4–13), replaces the select
            Its chart is worked out from the instrument: you blow it into the tuner…
Action bar: [Back]            [Add ocarina]
```

### 6.4 Wizard: design an ocarina (phone-04, desktop-04)

The note-window pills and the note chips show the same choice twice, so they merge into one **note strip** with a movable window.

```
Design an ocarina
Handpan scale   [ F Low Pygmy (17)             ▾ ]
┌ row ────────────────────────────────┐
│ Transpose  [−]  0  [+]   semitones  │ stepper-num (−6…+6)
│ Gu notes                    [■━━ ]  │ switch (only when the scale has gu notes)
└─────────────────────────────────────┘
Chambers
The full scale needs 3 chambers.        15 text-2
( 1 )( 2 )( 3 )                         seg; selected = selected-bg
— only when fewer chambers than needed —
Which notes? One chamber holds 9.       15 text-2
 G#2 A#2 C3 C#3 D#3 [F3 F#3 G#3 A#3 C4 C#4 D#4 F4 F#4] G#4 A#4 C5
                                        all notes as chips; the chosen window is selected
                                        (selected-bg); notes outside it are .is-static
[‹ Lower]  (Start on the ding)  [Higher ›]
                                        icon+label secondary buttons step to the previous/next
                                        window (wizard-oc-window with that window's start);
                                        the ding chip is a toggle-style chip, selected when the
                                        window starts on the ding
9 notes · 8 holes · 1 chamber           13 text-3 summary
Name            [ F Low Pygmy (17) ocarina ]
Action bar: [Back]          [Start building]
```

Desktop: a two-column card, form fields on the left and a medium fingering preview of the all-closed note on the right (the same preview as Build › Design).

### 6.5 Home: My instruments (phone-05, desktop-05)

```
┌──────────────────────────────────────┐
│ My instruments             🎤   ⚙    │ app bar
├──────────────────────────────────────┤
│ ┌ .list ────────────────────────────┐│
│ │[⬭] Blue D Kurd                 ⋯ ││ .row: glyph tile, title, meta "Ocarina · 9 notes ·
│ │    Ocarina · 9 notes · 2 chambers ││ 2 chambers"; whole row opens; ⋯ = 44px menu
│ ├───────────────────────────────────┤│
│ │[⬭] F Low Pygmy (17) ocarina    ⋯ ││
│ │    BUILDING 1/7 · Design · 9 notes││ warning badge + meta
│ ├───────────────────────────────────┤│
│ │[◎] D Kurd                      ⋯ ││
│ │    Handpan · 9 notes              ││
│ └───────────────────────────────────┘│
│ [ + Add instrument               ]   │ btn-secondary btn-block
│ ┌───────────────────────────────────┐│
│ │[⌕] Try another scale            › ││ .row: "Browse every scale without saving"
│ └───────────────────────────────────┘│
│ PLAYLISTS                            │ .list-title
│ ┌───────────────────────────────────┐│
│ │[≡] Favorites                 ▶  › ││ meta "7 chords · 2 instruments"; ▶ = open-playlist-chords
│ └───────────────────────────────────┘│
│ ┌ tip card (signed out & has data) ─┐│
│ │ Sync across devices      [Set up] ││ 13; Set up → #settings (Sync); dismissible ×
│ └───────────────────────────────────┘│
└──────────────────────────────────────┘
```

- Row ⋯ menu: **Share…** (ocarina/flute), **Remove** (danger → confirm sheet). The corner × goes.
- Add instrument is a secondary button, not red: it's the action you take once. (A red button on a screen you visit daily trains people to ignore red.) When the list is empty, the empty state shows Add instrument as a primary `btn-lg`.
- No tab bar on Home. The tuner works here with no target (it shows the nearest note).
- Desktop: two columns within `--content-max`, instruments `2fr` and Playlists `1fr`. The instrument list becomes a grid of row-cards `minmax(320px, 1fr)`.

### 6.6 Try a scale: the catalogue (phone-06, desktop-06)

```
App bar: ← | Try a scale        🎤
Sticky: [⌕ Search scales by name or family…]   (All)(9 notes)(10)(11+)
KURD
│ D Kurd                                   › │ .row 72px: title; meta "9 notes · D3 ding";
│ 9 notes · D3 ding                          │ 3rd line: description, 1 line clamp, text-3
│ The most popular handpan scale worldwide…  │
…
```

- Removed from this screen: sync bar (moved to Settings), My layouts (duplicate of Home), playlists strip (on Home), ♭ Flats chip (moved to Settings).
- Tapping a row behaves as today (`select-scale` → unsaved instrument, Pan tab).
- Desktop: a card grid `repeat(auto-fill, minmax(260px, 1fr))` (4 columns in 1200px), keeping the family badge, name, meta and 3-line description. The search and chips row is sticky.

### 6.7 Handpan: Chords tab (phone-08, desktop-08). The daily screen.

Phone: the pan and the selected chord stay on screen while the chord list scrolls under them. This replaces today's 45dvh inner-scrolling list.

```
┌──────────────────────────────────────┐
│ D Kurd ▾                    🎤   ⋯   │ app bar (⋯: Copy link to this chord, Settings, …)
├──────────────────────────────────────┤ ┐
│            ╭─────────╮           [⟳] │ │ sticky block, top: app bar
│           (  pan SVG  )              │ │ pan height: min(100vw − 32px, 36dvh)
│            ╰─────────╯               │ │ ⟳ = toggle-rotation, 44px tonal icon-btn
│ ┌──────────────────────────────────┐ │ │ overlaid top-right of the pan stage
│ │ C Add9                 ♡  [▶ Chord]│ │ selected-chord bar: card, 64px, title 17/600,
│ │ C4 · E4 · G4 · D3        ⋯ More   │ │ │ meta 13 text-3 (notes); ♡ show-playlist-picker;
│ └──────────────────────────────────┘ │ │ ▶ Chord btn-primary; More → sheet
├──────────────────────────────────────┤ ┘
│ ( Browse | Identify )                │ seg (toggle-discover-mode)
│ [⚙ Filters · 2]  (All)(C)(D)(E)(F)(G)…│ Filters = btn-secondary with count of active
│                                      │ filters; root chips = chips-scroll
│ 61 chords                            │ 13 text-3
│ ┌──────────────────────────────────┐ │
│ │ C Dominant 9th            ♡   5  │ │ .row 56px; meta = category; trailing ♡ + count;
│ │ Dominant                         │ │ save-voicing icon when canUpdateEntry (unchanged)
│ │▌C Add9                    ♡   4  │ │ selected row: accent left bar
│ │ …                                │ │
└──────────────────────────────────────┘
│ ♫ Chords   ◎ Pan   ≡ Playlists       │ tab bar
```

- **Selected-chord bar** with no chord selected: "Tap a chord to see it on the pan" (15 `--text-2`) plus a `[▶ Scale]` secondary button.
- **More sheet** (with a chord selected), as rows:
  - Play scale (`play-scale`).
  - Save this voicing to "Favorites" (`update-playlist-entry`, only when it applies).
  - A **Related chords** section with the "Same type, other roots" and "Shares 2+ notes" chips (`select-chord`; tapping one closes the sheet and selects it).
  - Copy link to this chord.
- **Filters sheet**: Notes in chord as count chips (2)(3)(4)(5+) (`toggle-note-count`, multi-select); Type select (`filter-category`); Playlist select (`select-playlist-filter`, with "Edit playlist" as a row link when a playlist is chosen). The footer has [Clear all] ghost and [Done] primary. The Filters button shows the number of active filters except root.
- **Now playing bar** (shown instead of the Filters row when a playlist filter is active, like today's `.autoplay-bar`): `[⏸ Pause | ▶ Auto-play]` primary, a seconds select (3–10 s), "2 / 7" tabular, an "Edit" link (opens the playlist detail), and a ✕ icon button that clears the playlist filter.
- **Identify mode:** the list area shows the hint "Tap notes on the pan to build a chord. Tap again to remove one.", the selected notes as static chips, [Clear], and the matches as `.row`s (name, category · notes, ♡ `discover-bookmark`, ▶ `discover-play`). The custom combination row has ♡ and ▶ as today. The sticky selected-chord bar hides in this mode.
- Root chips use the display note naming from Settings.
- **Tablet (600–1023):** two columns, `grid-template-columns: 300px 1fr`. Left: the list section (its own sticky scroll area, `height: calc(100dvh - appbar - tabbar)`, `overflow: auto`). Right: the pan (max `min(100%, 60dvh)`), then the selected-chord card with Related chips inline (no More sheet).
- **Desktop (≥1024):** the same two columns with a 340px list. The right column is sticky and has the pan stage on top (max-height 64dvh) and, beneath it, the chord card at full width (title 20/600 on one line, notes, ♡, ▶ Chord, ▶ Scale, save-voicing, then Related chips inline). This fixes the cramped middle column in desktop-08.
- **Short landscape:** keep the existing 3-column rule.

### 6.8 Handpan: Pan tab (the layout editor, phone-07, desktop-07)

```
App bar: D Kurd ▾                 🎤  ⋯
[banner: Not saved · [Save]]           only for unsaved instruments
( Both shells | Top | Bottom )         seg (shell-mode)
       ╭───────────╮              [⟳]  pan stage, max min(100%, 55dvh); ⟳ overlay
      (  pan SVG    )
       ╰───────────╯
Tap a note to remove it · tap + to add  13 text-3, only for custom layouts
┌ card: Shells ───────────────────────┐
│ Name  [ My D Kurd               ]   │ only for custom layouts (custom-name-input)
│ TOP SHELL            [−]  8  [+]    │ stepper-num per shell
│ 9 notes incl. ding · 0 empty        │
│ BOTTOM SHELL         [−]  3  [+]    │
│ 0 notes · 3 empty                   │
└─────────────────────────────────────┘
[ Customize ]   [ Save ]                secondary (clone-layout, only when not custom) ·
                                        primary Save; when saved: "✓ Saved" as 13 success
                                        status text and the button becomes "Saved" disabled
Tab bar
```

- "Find Chords →" goes, because the Chords tab does that job.
- The Rotate pill moves to the pan overlay. The Flats pill moves to Settings.
- Desktop: two columns, as today: the pan left and a 320px side panel right (the Shells card and buttons).
- The note picker (`renderNotePicker`) becomes a sheet titled "Add a note". Its octave rows of note chips (40px) are kept, with in-use notes `.is-static`.

### 6.9 Playlists tab (new) and playlist detail (phone-09, desktop-09)

Playlists tab, on any instrument:

```
App bar: Blue D Kurd ▾            🎤  ⋯
┌ .list ──────────────────────────────┐
│[≡] Favorites            [▶ Practice]│ ocarina: btn-sm primary "Practice" (oc-practice-start
│    3 chords here · 7 in total     › │ with this playlist); handpan: "▶ Play"
├─────────────────────────────────────┤ (open-playlist-chords + autoplay on)
│[≡] Jam set                 [▶ Play] │ disabled when no entry belongs to this
│    0 here · 4 in total            › │ instrument (meta says so)
└─────────────────────────────────────┘
[+ New playlist]                        ghost
Empty: "No playlists yet. Tap ♡ on any chord to start one." [Go to Chords]
```

Playlist detail (opened from a row's › or from Home):

```
App bar: ← | Favorites                    ⋯  (Rename, Delete playlist (danger → confirm))
[▶ Practice on Blue D Kurd]  btn-lg primary block (ocarina) / [▶ Play] (handpan)
                             hidden when no entry belongs to the current instrument
( Chords | Order )           seg: Order shows reorder controls
Handpan entries, and ocarina entries in Order mode:
│ D Minor                               ⋯ │ .row: title; meta "Blue D Kurd · D3 F4 A3";
│ Blue D Kurd · D3 · F4 · A3              │ tap = open-playlist-chord; ⋯ = Move up / Move down /
                                          │ Remove
Order mode: trailing [▲][▼] 44px icon-btns + [✕]
Ocarina entries in Chords mode: ocChordCard rows (expandable, as in §6.11) for this
instrument — this replaces the ocarina "All chords ▾" playlist filter.
```

- Rename is a field in a sheet ("Rename playlist" with an input and Save). The always-visible underline input goes.
- Delete has a confirm sheet. "Favorites" can't be deleted (unchanged), so its ⋯ shows only Rename.

### 6.10 Ocarina: Notes tab (phone-10, desktop-10)

```
┌──────────────────────────────────────┐
│ Blue D Kurd ▾               🎤   ⋯   │
├──────────────────────────────────────┤
│ [ All notes                 ▾ ][▶ Scale]│ context row: scale filter select (flex 1, label
│                                      │ "Scale filter" visually hidden) + secondary button
│ ┌ .fg-stage (sticky, top: appbar) ──┐│
│ │            ▭ blow                 ││ large diagram, max-height 40dvh
│ │          ( ●  ●  ·  ● )           ││
│ │          (  ○  ●  ·   )           ││
│ │                D3                 ││
│ │      Lift R3 and R2        [✋]   ││ moves line (17/600, lift/cover coloured);
│ └───────────────────────────────────┘│ hand icon only when finger labels are on
│ ● covered ○ open ◐ half    [Got it] │ legend, first time only
│ ┌────────┐┌────────┐┌────────┐       │ medium grid: 3 columns at 360
│ │  D3    ││  A3    ││  A#3   │       │ selected cell: 2px selected-bg border
│ └────────┘└────────┘└────────┘       │ dimmed: outside the scale filter
│ …                                    │
│ 9 notes · 2 chambers                 │ 13 text-3 (instrumentStatus)
├──────────────────────────────────────┤
│ ▦ Notes  ♫ Chords  ≡ Playlists  ⚒ Build│
└──────────────────────────────────────┘
```

- Removed from the toolbar: R4 L1 and mm (now Settings switches), ✋ Fingers (now the ⋯ menu, Settings and the hand icon on the stage), ♭ Flats (Settings), 🎤 Tuner (app bar).
- Tapping a medium cell selects it (`oc-select-note`). The sticky stage updates without scrolling, and tapping the stage plays the note.
- The stage's sticky height cap (40dvh) keeps at least two rows of the grid visible on an 844px phone.
- Desktop: `grid-template-columns: minmax(360px, 440px) 1fr; gap: 24px`. Left: the context row and stage, sticky. Right: the grid with `repeat(auto-fill, minmax(132px, 1fr))`. This uses the empty right half of desktop-10.

### 6.11 Ocarina: Chords tab (phone-11, desktop-11)

```
App bar: Blue D Kurd ▾            🎤  ⋯
[ All notes        ▾ ][ All types   ▾ ]   two selects, equal width (oc-scale-filter, oc-category)
61 chords · tap one for its fingerings    13 text-3
┌ .list ──────────────────────────────┐
│ C Dominant 9th   TOGETHER   ♡   ▶   │ .row 56: title; meta category; badge only when
│ Dominant                            │ a two-note pair exists; ♡ oc-show-playlist-picker;
├─────────────────────────────────────┤ ▶ oc-play-arp (icon-btn)
│ D Minor 9th      TOGETHER   ♥   ▶   │ expanded row (oc-chord-toggle): bg surface-2,
│ Extended                            │ accent left bar, content below:
│  Voicing  (D3)(A3)(C4)(E4)(F4)      │ chips; "Tap a note to move it to another octave"
│  ┌──────────────────────────────┐   │ arpeggio: .chips-scroll strip of 64px minis with
│  │ [D3] › lift R4 › [A3] › …    │   │ .fg-move labels between
│  └──────────────────────────────┘   │
│  TOGETHER  D3 + E4: blow both  [mini]│ pair rows: badge + text + 64px combined mini;
│                                     │ tap = oc-play-pair
├─────────────────────────────────────┤
│ …                                   │
└─────────────────────────────────────┘
▸ Not on this ocarina (14)              disclosure (<details>), closed by default; rows with
                                        "missing E5" meta, 0.7 opacity
```

- The "All chords ▾" playlist select and the "Practice" button move to the Playlists tab. 🎤 moves to the app bar.
- The "play together" badge becomes the neutral-accent `.badge-accent` "TOGETHER" (12px). The pair explanation sits in the expanded content.
- Only one chord is expanded at a time (as today).
- Desktop: master-detail, `grid-template-columns: 360px 1fr`. Left: the filters and list, with the selected row highlighted but not expanded. Right (sticky): the selected chord's detail at larger size: title 20/600, ♡, ▶ Play arpeggio, voicing chips, then the arpeggio as **medium** diagrams (`size: 'medium'`) with move labels between and wrapping, then the pairs.

### 6.12 Practice (phone-12, desktop-12)

A full-screen focus view. There's no tab bar, and the app bar is simplified.

```
┌──────────────────────────────────────┐
│ ✕   Practice · Favorites       🎤    │ ✕ = oc-practice-stop; 🎤 = tuner (drives auto-advance)
├──────────────────────────────────────┤
│ D Minor                              │ 20/600
│ Chord 1 of 3 · note 2 of 3           │ 13 text-3
│ ━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░  │ 4px progress bar over all steps (text-1 on surface-3)
│ ┌ .fg-stage ────────────────────────┐│
│ │        large diagram, max 52dvh   ││ tap = oc-practice-next (unchanged)
│ │           with arrows             ││
│ │               D3                  ││
│ │        Next: lift R4              ││ 20/600; lift/cover coloured
│ └───────────────────────────────────┘│
│ [mini A3]  Up next: A3               │ 72px mini + 15 text-2 (+ next chord name when it
│                                      │ changes)
│ Listening for D3 · play the note     │ 13 text-3 when the tuner is on; otherwise
│                                      │ "Tap the diagram or Next to move on"
├──────────────────────────────────────┤
│ [ ‹ Back ]          [ Next › ]       │ bottom action bar: secondary 1fr, primary 2fr, btn-lg
└──────────────────────────────────────┘
(tuner strip docks above the action bar when on)
```

Desktop: a centred column at `--reading-max` with the same order. The stage gets 60dvh.

### 6.13 Build tab: shared frame (phone-13…15, desktop-13…15)

```
App bar: Blue D Kurd ▾            🎤  ⋯
(1)━(2)━(3)━(4)━(5)━(6)━(7)            .bsteps
Step 3 of 7
Voice and drill  leather-hard          20/600 + text-3 qualifier
…step content…
[ Next: Bone-dry check ]  primary, btn-block on phone, at the end of the content (not sticky,
                          because the tab bar and tuner are already docked at the bottom)
[ Unglazed: finish now ]  ghost, bisque step only
Tab bar
```

- The "🎤 Tuner · Design, step 1 of 7 · 9 notes · 2 chambers" toolbar goes. The tuner is in the app bar, the step is in the stepper, and the notes and chambers summary moves to the Design step.
- With 2 or more chambers, the leather, bone-dry, bisque and final steps show a **chamber switch** `( Chamber 1 · D3 | Chamber 2 · E4 )` (seg) under the title, so only one chamber's checklist is on screen. The choice is view state only (`state.oc.buildChamber`, default 0). It moves to the next chamber by itself once every hole and reading in the current one is filled.
- Desktop: the content sits at `--reading-max` on the left, and a **sticky preview panel** on the right (`grid-template-columns: minmax(0, 640px) 1fr`) shows the chamber's medium fingering diagram with hole sizes (as a drilling map, `showSizes: true`), plus the step's summary (volume and ball on Body; holes done n/m on leather).

### 6.14 Build › Design (phone-13, desktop-13)

```
┌ card ───────────────────────────────┐
│ Handpan scale  [ D Kurd         ▾ ] │
│ Transpose      [−]  0  [+]          │
│ Gu notes                    [switch]│
│ Chambers  The full scale needs 2.   │
│ ( 1 | 2 )                           │
│ Which notes?  (note strip + ‹ ›,    │ the same component as §6.4, only when fewer chambers
│               start on the ding)    │
│ Notes — tap one to leave it out     │ chips: in = selected, out = .is-off
│ (D3)(A3)(A#3)(C4)(D4)(E4)(F4)(G4)(A4)│
│ Chamber 1: D3 A3 A#3 C4 D4 · 4 holes│ 13 text-3
│ Chamber 2: E4 F4 G4 A4 · 3 holes    │
│ [medium preview diagram]            │ phone only (desktop: right panel)
└─────────────────────────────────────┘
▸ Start from an earlier build          <details>; select inside (b-from), shown only when
                                       earlier builds exist
```

### 6.15 Build › Body (phone-14, desktop-14)

```
┌ card ───────────────────────────────┐
│ Clay body  [ Generic clay · 11%  ▾ ]│ includes "Add a clay body…" (unchanged); helper:
│            learned from 2 builds    │ "Manage clay bodies in Settings"
│ ▸ Advanced                          │ <details>: Shrinkage for this build [11.0] %
└─────────────────────────────────────┘
CHAMBER 1 · CLOSED NOTE D3              overline (per chamber card, or the chamber switch
┌ card ───────────────────────────────┐ when ≥2 chambers; Body shows both stacked, since they're
│ Window shape                        │ short)
│ ( ▭ Rectangle | ◯ Round | ⬭ Oval )  │ seg with shape icons
│ Width [13 mm] Length [9.75 mm]      │ three .input-unit fields in a 3-column grid
│ Wall [4 mm]                         │ (2 columns when round)
│ ┌ result ─────────────────────────┐ │ surface-0 inset block:
│ │ Inside volume       1635 ml     │ │ label 13 text-3 / value 17/700 text-1, tabular
│ │ Form around a ball   146 mm     │ │
│ │ After firing        ~1153 ml    │ │
│ └─────────────────────────────────┘ │
│ A starting point: the finished pitch can land a couple of semitones away…  13 text-3
└─────────────────────────────────────┘
```

### 6.16 Build › Voice and drill (phone-15, desktop-15)

```
( Chamber 1 · D3 | Chamber 2 · E4 )
┌ card: 1 · Closed pitch ─────────────┐
│ Cover all holes and blow.           │
│ Target D3 · 130.7 Hz                │ 15 text-1 / tabular
│ [ 130.5          Hz ][🎤]           │ .rec
│ ✓ Closed note in tune               │ .rec-status success
│ last build 131.2                    │ 13 text-3, when starting from an earlier build
└─────────────────────────────────────┘
┌ card: 2 · Test hole ────────────────┐
│ Drill a test hole where R4 goes.    │
│ Diameter [ 6        mm ]            │
│ Blow with only that hole open:      │
│ [ 146            Hz ][🎤]           │
└─────────────────────────────────────┘
┌ card: 3 · Drill the holes  2/4 ─────┐ count of done holes
│ In this order. Sizes are at         │
│ leather-hard; targets are 11.0%     │
│ lower for shrinkage.                │
│ ☑ R4  3 × 9.9 mm   YOUR TEST HOLE   │ hole row: 44px checkbox (b-hole-done), finger 15/700,
│   A3 → 195.8 Hz                     │ size 15; badge; line 2: target 13 text-3;
│   [ 194          Hz ][🎤]           │ line 3: .rec; line 4: .rec-status
│   A3 is 16 cents flat: open it      │
│   slightly                          │ done rows: title text-3, the .rec stays editable
│ ☐ R3  6.6 mm                        │
│   A#3 → 207.4 Hz                    │
│   [               Hz ][🎤]          │
└─────────────────────────────────────┘
(before readings exist: "Record the closed pitch and the test-hole pitch to see every hole's
size." as an .empty-style note inside card 3)
[ Next: Bone-dry check ]
```

**Bone-dry, bisque and final** use the same frame: the intro paragraph (15 `--text-2`), then per chamber one card listing every note as a row (note 15/700 + target Hz 13 `--text-3`, then `.rec`, then the status, plus "rose +18 ¢ since leather-hard" and "last build …" as 13 `--text-3`). Next/Finish at the end. Bisque adds [Unglazed: finish now] as ghost.

**Done:** a card with the success title "Blue D Kurd is finished" (20/600), the body text, a learned-shrinkage result block (the same inset style as Body), and per-chamber hole sizes as a two-column table (finger | size). Below it, two buttons: [Open Notes] (primary, switches tab) and [Share…] (secondary).

### 6.17 Set up a bought ocarina (phone-16, desktop-16)

The current screen is two long forms. The new one is a guided capture with the finger assignments folded away.

```
App bar: Market ocarina ▾          🎤  ⋯
Set up                                  20/600
Blow each line into the tuner. Tap 🎤,  15 text-2 (one sentence, plus "Blow steadily at a
blow, and it fills itself in.           medium breath." as 13 text-3)
┌ card: Holes and fingers ────────────┐
│ 12 holes · standard order     [Edit]│ summary: "R4 R3 R2 R1 L4 L3 L2 L1 LT RT + 2 sub-holes"
│ R4 R3 R2 R1 L4 L3 L2 L1 LT RT R4 L4 │ 13 text-3; Edit opens the "Hole fingers" sheet:
└─────────────────────────────────────┘ a 2-column grid of "Hole n [finger ▾]" (s-finger)
┌ card: Readings   5 of 13 ───────────┐ count, plus a 4px progress bar
│ All holes closed                    │ .row-like blocks, each: label 15/600,
│ [ 293.2          Hz ][🎤]  ✓        │ .rec, ✓ when filled
│▌Only hole 1 open · R4    ← next     │ next unfilled row: accent left bar + "Next" badge,
│ [                Hz ][🎤]           │ scrolled into view; when the tuner captures into a
│ Only hole 2 open · R3               │ row, the next empty row arms by itself
│ …                                   │
└─────────────────────────────────────┘
[ Work out the fingering chart ]        primary block, disabled until all 13 are filled; the
5 readings to go                        13 text-3 helper says how many remain
Current chart: 21 notes. Predictions…   13 text-3, when calibrated
```

**Auto-advance:** when a reading is captured through the record field on this screen, the next empty reading arms by itself (the tuner stays on). Rows can still be typed or re-recorded in any order.

### 6.18 Tuner strip (phone-17, desktop-17)

Spec in §5.13. On this screen, the docked strip sits above the tab bar, the readings card scrolls freely above it, and the armed row is never covered. Compared with the current panel, the heard note and cents get their own large block, the in-tune band is visible, and closing is a 44px button.

### 6.19 Settings (new)

```
App bar: ← | Settings
DISPLAY
┌ .list ──────────────────────────────┐
│ Theme        ( Dark | Light | Auto )│ rows: label 15/600 left, control right; at <400px
│ Note names   ( C# | D♭ )            │ the control drops below the label (row grid wraps)
│ Note style   ( C D E | Do Re Mi )   │
└─────────────────────────────────────┘
HANDPAN
│ Ring orientation  ( Standard | Rotated ) │
│ Seconds per chord in autoplay  [−] 4 s [+]│
FINGERING DIAGRAMS
│ Finger labels in holes            [sw] │ helper: "R4, L1, LT inside each hole"
│ Hole sizes in mm                  [sw] │ helper: "The builder always shows sizes"
│ Which finger is which               › │
│ Show the diagram legend again          │ row button; toast "The legend will show again"
TUNING
│ Clay bodies                          › │ → page: list of rows "Generic clay · 11.0%
                                           (learned from 2 builds)", tap = sheet with
                                           Name and Shrinkage % fields
SYNC
│ Email  [ you@example.com ] [Send code] │ signed-out state; then the code state; then
│                                        │ "Signed in as …  [Sync now] [Sign out]"
ABOUT
│ Version 2026.11 · Check for updates    │
```

Turning on finger labels for the first time opens the "Which finger is which" sheet once (existing `handLegendSeen` behaviour).

### 6.20 Sheets used across screens

- **Add to playlist** (`renderPlaylistPicker`): title "Add to playlist", a `.list` of rows (24px check in the leading slot, name, count trailing), then a "New playlist" row that turns into an input + Create.
- **Share** (`shareModalHtml`): title "Share this instrument". The explanation (15 `--text-2`), the code at 32/700 with letter-spacing 0.18em, the QR on a white 240px block, the link in a read-only `.input`, and a footer with [Copy link] primary and [Close] ghost.
- **Which finger is which** (`handLegendModal`): title, sub-line, `renderHandLegend()` at full width, and [Close] in the footer.
- **Shared instrument banner:** `.banner` with "Shared instrument K7Q2XD · read-only" and [Add to My instruments].

---

## 7. Implementation order

Each step is one small commit that can be checked on the Vercel preview at 360px, 390px and 1280px before the next. Run `node --test` and `python3 build.py` before each commit, as `CLAUDE.md` requires. No step changes handpan behaviour, and steps 1–4 shouldn't change any layout.

1. **Tokens.** Replace `:root` with §4, including the legacy aliases. Add `data-theme="dark"` on `<html>` in the HTML template. *Check:* the screens look the same except for lighter muted text, and nothing turns unstyled. Grep for hard-coded hex values in `styles.css` (for example `.share-qr #fff`, `--error,#e05`) and swap them for tokens.
2. **Base type and focus.** Body 15px, the minimum-12px sweep (`.family-badge`, `.editor-section-title`, `.b-step`, `.oc-arp-move`, `.fg-strip-label` and other 9–11px rules), the global `:focus-visible` ring, tabular numerals for Hz and counts. *Check:* no text under 12px in the computed styles on any screen.
3. **Icons.** Add the icons from §5.1 to `js/icons.js`, and replace the 🎤 and ✋ emoji.
4. **Primitives CSS:** `.btn` sizes and variants, `.icon-btn`, `.chip`/`.chips`/`.chips-scroll`, `.seg`, `.switch`, `.field`/`.input`/`.select`/`.input-unit`, `.stepper-num`, `.card`, `.list`/`.row`, `.badge`, `.empty`. Then the `ui*` helpers in `app.js`. *Check:* a temporary `#kitchen-sink` hash renders every component in both themes. Remove it before the PR.
5. **App bar.** `uiAppBar()` replaces every `.app-header`/`.breadcrumb`, with the back logic from §3 and the switcher. *Check:* the playlist screen's back goes where you came from, and every former breadcrumb target is reachable.
6. **Tab bar.** `uiTabBar()` with the handpan Chords/Pan tabs (mapped to the `chords`/`editor` views) and the ocarina tabs (`state.oc.tab`). Add `#i/<id>/<tab>` for ocarina. Remove "Find Chords" and "← D Kurd". *Check:* the handpan `#scale=`/`#custom?` deep links still open, and there's no horizontal scroll at 360px.
7. **Sheet component.** Migrate the playlist picker, note picker, share and hand legend to it, then add the ⋯ menu (popover on ≥600) and the confirm sheet (replacing `confirm()`). *Check:* Esc, the scrim, focus return and body scroll lock.
8. **Settings screen** (`#settings`). Move flats, solfège, ring orientation, autoplay seconds, finger labels, hole sizes, the legend reset and sync into it. Add the theme pref and the light/auto CSS. Remove those toggles from all toolbars (Rotate stays as the pan overlay). *Check:* every pref still persists through `savePrefs`, and the light theme reads correctly in daylight (the pan stays dark).
9. **Toast** restyle, positioning and clearing on view change.
10. **Tuner strip and record field.** Dock the panel (§5.13), add the body padding classes, the app-bar mic, and `uiHzField` with the arm-and-capture behaviour (§5.3). *Check:* on Set up, the armed row is never covered, recording works with the tuner off, and practice auto-advance still works.
11. **Home, Try a scale, wizard** (§6.1–6.6). Remove the sync bar, My layouts and the duplicate playlists strip. Add the wizard action bar and the merged note strip. *Check:* first run, Add instrument, Skip and "Just browse scales" all work.
12. **Handpan Chords and Pan** (§6.7–6.8): the sticky pan and selected-chord bar on phone, the Filters, More and Now playing bars, the Identify segment, and the two-column desktop layout. *Check against the old build, side by side:* the same chord list order and counts for every filter combination, discover results, autoplay timing and saving voicings.
13. **Playlists tab and playlist detail** (§6.9), including Practice start and the ocarina playlist-entry cards. Remove the ocarina playlist select from Chords.
14. **Ocarina Notes, Chords and Practice** (§6.10–6.12): the sticky stage, medium grid, master-detail Chords on desktop, and the Practice focus view.
15. **Build and Set up** (§6.13–6.17): the stepper, chamber switch, card structure, desktop preview panel, Set up guided capture and hole-fingers sheet, and the Clay bodies page in Settings. **A4:** deferred by the owner's decision. There is no A4 setting for now: the reference stays 440 Hz everywhere (tuner, builder targets and `build.a4` of new builds).
16. **Final pass:** at 360px every screen in both themes, no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`), every interactive element ≥44px (spot-check with devtools), `aria-label` on every icon button, keyboard-only navigation through the tabs, sheets and wizard, and reduced motion. Retake the 34 screenshots for the PR description.

### Instrument photo, editing and hole layout (bought ocarinas)

- **One place per instrument.** An ocarina or flute you set up yourself (`kind: 'custom'`) is edited on its **Set up** tab: a "Your ocarina" card at the top (Name, Photo, number of holes; `instFieldsHtml`), then Where the holes are, Holes and fingers (with Reverse right/left hand) and Readings. ⋯ › Edit instrument opens that tab. Ocarinas and flutes without a Set up tab (published chart, designed here) use the **Edit instrument** sheet (`instEditSheet`): Name and Photo (Add / Change / Remove, a camera or library picture stored as a JPEG of at most 600 px). Changing the hole count clears the fingering chart; an ocarina keeps the fingers, single-hole readings and marked spots of the holes it still has (`withHoleCount` in js/builder.js).
- The photo is the instrument's avatar on Home (40 px, rounded).
- **Where the holes are** (Set up tab of a bought ocarina): a card with the photo and the marked holes, then the editor (`viewHoleMap`): the photo (or a plain shape), chips for each hole (number · finger, ✓ when marked, thumb holes "under"), the finger of the selected hole, Clear this spot, Done. Tapping the photo marks the selected hole and moves on to the next unmarked one.
- Each "Only hole N open" reading shows a small copy of the photo with that hole drawn open.
- Once every top hole is marked, the fingering diagrams draw the photo with the holes on it, sized from the calibration, thumb holes in the underside strip (`fgPhotoParts`).
- **Charted instruments get Set up too** (`viewChartSetup`): ocarinas and flutes from a published chart have the same tab without Readings: Your ocarina/flute (name, photo, key), Where the holes are (ocarinas), Holes and fingers, and Your fingerings (notes played your way). On Notes, "Not how you play it? Change the fingering" saves a fingering for that note (badge "Your fingering"); "Use the chart's one" puts the published one back. A key change moves fingerings set by hand with it and keeps renamed fingers.
- **Ocarina / flute Chords use the handpan Chords layout** (`viewOcarinaChords`, `ocChordStageHtml`): the same `.hp-chords` / `.hp-stage` / `.hp-card` / `.hp-list` structure. On top (sticky on phones; the right column from 600px): one fingering picture in place of the pan, then the chord card (title, notes, ♡, ▶ Chord, ⋯) with the notes in playing order as numbered buttons and the move for the note on show. Picking a chord in the list shows and plays it; while it plays, the picture, the lit note and the move step through the notes. ⋯ opens a sheet with the octaves, two-chamber pairs, the hole key and Which finger is which.

### Rule: one pattern per screen, for every instrument

Handpan, ocarina, flute and any instrument added later share their screens. Each screen is made of shared parts; an instrument supplies only what really differs (the picture of the instrument, its fingerings), never its own version of a screen.

| Screen | Shared parts | What an instrument supplies |
|---|---|---|
| Chords | `chordsScreenHtml` (picture + card on top, list below), `chordCardHtml`, `chordRowHtml`, the filter row `chordFilterRowHtml` (Filters + root chips, `chordRootsOf`) and the Filters sheet fields `chordCountField` / `chordTypeField`, the `.hp-chords` / `.hp-stage` / `.hp-card` / `.hp-list` CSS | its picture (pan drawing, fingering); its chord rows and card actions; anything below the card (ocarina/flute: notes in playing order and the move); extra filters in its sheet (handpan: playlist; ocarina/flute: handpan scale) |
| Playlists tab | `playlistsTabHtml` | nothing |
| Playlist page | one row per entry; tapping it opens the chord on its instrument's Chords screen | nothing |
| Set up | the "Your …" card (`instFieldsHtml`), Holes and fingers, Where the holes are | what it needs set up (readings for a bought one) |
| Sheets, rows, fields | `uiSheet`, `uiRow`, `uiField`, `uiPicker`, `uiStepper`, `uiSeg` | content |

A change to a screen's pattern goes into the shared part, so every instrument gets it, and any older copy is deleted.

**Chords on a phone (≤599px).** Goal: at least three chords in view with the filters visible. The picture is capped (pan 25dvh, ocarina 23dvh, flute 15dvh) with no frame, the chord card is tighter (40px controls, 15px title, the notes in playing order on one scrolling line), the list head (filters, count) sticks right under the sticky stage (its height is kept in `--chords-stage-h` by `watchChordsStage`), chord rows are 50px, and the tab bar is 54px on phones.
