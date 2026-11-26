# Help centre: design

**Status: built**, except where a section says "designed, not built".

Oakhum had no help beyond field hints, the install sheet and a one-time
diagram legend. This is the design of the help "wiki": what end users read
today at oakhum.com/help and inside the app, what an AI support assistant can
be connected to later, and the rules that stop it drifting from the product.


## Decisions

Answered by the owner (November 2026):

1. **Content: Markdown in the repository, shown as a wiki.** `/help` is a
   separate, wiki-style part of the site rendered from `help/en/*.md`: the
   contents of every section beside each page (a fold on phones), "On this
   page" links to each section, and previous/next. The app links into it.
2. **A "?" at each relevant point in the app**, opening the article at the
   right section, in the app's own sheet (works offline), with a button to
   the same page on the wiki. The ⋯ menu's Help row and Settings › Help stay.
3. **First-use tour: decide from data.** Not built. The `help` analytics event
   (which article, from which "?") and the existing feature events show where
   people get stuck; look after a month.
4. **Articles go stale after 180 days** (`VERIFY_DAYS` in `tests/help.test.mjs`).

Still open, with the recommendation:

5. **The site's "In the app now" list** (Sanity `feature` documents) still has
   its own titles. Give the `feature` schema a `featureId` and show the
   registry's name. Not built: the list is the website's.
6. **Latvian.** The structure is ready (`help/lv/`, same ids). Translate once
   the screens settle.
7. **Video.** The setup's "Watch how" stays "later". Each how-to article is
   already a script for a 30-second clip.
8. **oakhum.com as the public address.** The app's help sheet links to
   `https://oakhum.com/help/<id>` (`HELP_SITE` in `js/helpdoc.js`), as the
   app's `/privacy` redirect already does.

## Where the content lives

**Markdown files with front matter in the repository: `help/<lang>/<id>.md`.**

| | Markdown in the repo (chosen) | Sanity documents |
| --- | --- | --- |
| Reviewed with the feature | Same pull request, same diff | Separate, after the fact |
| Can be tested against the app | Yes: names, links, tabs, pictures (`tests/help.test.mjs`) | Only at build time, against a remote dataset |
| Works offline in the app | Yes: built into the page by `build.py` | Needs a fetch and a cache |
| AI ingestion | Plain files, plus generated exports | Needs an API token or the exports anyway |
| Edit without a deploy | No (a pull request; Vercel deploys in minutes) | Yes |
| Editors who don't use git | No | Yes |

The deciding point is drift. Help that says "tap Chords" must fail a test when
Chords is renamed, and that needs the text next to the code. The one thing
Sanity does better, editing without a deploy, matters little while one person
writes both. The site's rule "text goes in Sanity" has this one exception,
recorded in `site/CLAUDE.md`: help articles describe the app, so they live
with the app. Marketing copy and the per-instrument FAQ blocks stay in Sanity.

### One article

```
---
id: chords                       # = file name = URL slug. Never reused.
title: Find the chords your instrument can play
summary: One or two sentences for lists, search results and link previews.
section: chords                  # one of HELP_SECTIONS (js/helpdoc.js)
type: howto                      # howto | faq | reference
audience: players                # players | makers
instruments: all                 # or: handpan, tongue-drum, kalimba
features: chords, chords-filters # ids from js/features.js, or "none"
app: /handpan/d-kurd/chords      # optional deep link that shows it
verified: 2026-11-21             # the day it was last checked against the app
order: 10
---
Intro paragraph.

## A question, or a step heading {#stable-anchor}

1. Numbered steps, one line each. Tap {{chords}}, then {{show-all}}.
```

- The body is a strict subset of Markdown (`js/helpdoc.js`): `##` with a
  required `{#anchor}`, `###`, paragraphs, `-` and `1.` lists, `> ` notes,
  `**bold**`, links, and `![alt](img:name)`. Anything else throws. One small
  parser, no dependency, used by the app, the site and the tests, so an
  article cannot look different in two places.
- `{{id}}` is the name of a feature or a UI label **as the app shows it**,
  taken from the registry. Articles never spell a button's name themselves.
- Anchors are written by hand and never change when a heading is reworded.
  A passage's citation id is `article#anchor` (for example `chords#play`).
- Writing rules: plain, warm, short sentences; one idea per sentence; no
  theory word without a link to the glossary; describe what is on screen
  ("the three dots at the top right"), not how it is built.

### What is produced from the files

| Output | Where | Made by |
| --- | --- | --- |
| The wiki: pages with search, contents beside every page, "On this page", previous/next | `/help`, `/help/<id>` | `site/src/app/(site)/help/` (`layout.tsx`, `HelpNav`) |
| JSON for a chatbot or RAG pipeline | `/help/index.json` | `helpExport()` in `site/src/lib/help.ts` |
| llmstxt.org files | `/llms.txt`, `/llms-full.txt` | `llmsTxt()`, `llmsFullTxt()` |
| JSON-LD | each article: `HowTo` (type howto) or `FAQPage`, plus `BreadcrumbList` | `helpJsonLd()` |
| The app's help sheet, offline | every "?", ⋯ › Help, Settings › Help | `build.py` → `HELP_BUNDLE`, `helpSheet()` in `js/app/help.js` |
| Sitemap entries | `/sitemap.xml` | `site/src/app/sitemap.ts` |

All of the site's outputs are prerendered at build time.

## Information architecture

Sections (`HELP_SECTIONS`), in this order, with today's articles:

- **Getting started**: set up your instrument · by playing your notes · by
  picking your scale · an ocarina, flute or recorder · try a tuning without
  saving · My instruments · change the notes · fingerings.
- **Chords**: find the chords · which chord am I playing · which chords go
  together · slower or faster.
- **Songs and playlists**: songs to learn (Wait for me, loops) · playlists
  (progressions are playlists since the lists were merged) · paste a chord sheet.
- **Listen and the tuner**: Listen · the tuner · the microphone and your privacy.
- **Saving, accounts and offline**: saving and accounts · offline · add to home
  screen (iPhone, Android, Samsung, computer) · settings · your data and privacy.
- **Sharing**: links, songs, codes and QR codes.
- **When something goes wrong**: it heard the wrong note · fix common problems ·
  get help or tell us.
- **Words explained**: the glossary (ding, scale, chord, progression, bar…),
  one anchor per word so any article can link to a single word.
- **For makers and shops**: one page, `audience: makers`, including the in-app maker page and codes.

Per-instrument differences are handled inside an article ("On an ocarina or
flute…") and by the `instruments` field, not by five copies of each article.
The clay ocarina builder is internal and has no article; the test for "every
feature has an article" covers the registry, and the builder is deliberately
not in the registry.

## The feature registry: `js/features.js`

One small file, part of the app bundle and imported by the site (`@engine`):

- `FEATURES`: `{ id, name, where, instruments, account, help, link }` for every
  user-facing feature. `name` is the text in the UI; `help` is its article.
- `UI_LABELS`: the other words on buttons and tabs that articles mention.
- `HELP_SCREENS`: which article "Help with this screen" opens for each screen.

A rename happens once: change the label in the app and in `js/features.js`
(the test fails until both agree), and every article, the site, the exports
and the app's help sheet follow. The app itself may read its labels from
`featureName('chords')`; the Help rows already do. Moving the tab labels over
is the navigation redesign's call and is a one-line change per label.

## In the app

- **"?" at each relevant point**: `uiHelp(id, anchor)` in `js/app/ui.js` is a
  small round "?" button (44px tap area) that opens one article at one
  section. It sits next to the heading or control it explains:
  - the set-up frame, next to the stage dots (which article depends on the step);
  - Chords: the All chords · Tap notes · Listen switch (the article for the
    mode on), Goes well with, Filters and the chord's ⋯ sheet;
  - Songs: Songs to learn, Almost fit, Chords of a song, a song's Wait for me
    and Loop; Playlists: the heading, a playlist's play levels;
  - the instrument's own tab (Make my own copy, Move notes), the fingering legend;
  - the tuner and listening strip;
  - sheets, through `uiSheet({ help })`: share, save, speed, progressions,
    filters, add to a playlist, chord sheet, install, listening report,
    Which finger is which, songs by country;
  - each Settings section.
  A new screen or sheet gets its "?" in the same pull request (CLAUDE.md).
- **⋯ menu › Help ("About this screen")** opens the article for the screen you
  are on (`helpScreenKey()` → `HELP_SCREENS`).
- **Settings › Account and about › Help** opens the list of every article.
- Articles open in the shared bottom sheet, scrolled to the section; links
  between articles stay inside it; the footer opens the same page on the
  wiki (with its pictures). Help over another sheet closes back to it. The
  text is built into the page, so it works offline for everyone the page
  works for. Cost: about 60 KB of the page.
- **Coach marks: decide from data** (owner). Not built. The setup is already
  a guided flow that ends on "Play my first chord", and a tour needs
  redrawing with every layout change. Look at the `help` events after a month:
  a screen whose "?" is opened often is one a tour (or a better screen) should help.
- **Empty states** (designed, not built). Each says what the thing is, the one
  action that fills it, and links to its article:
  - Songs, none playable: "Why?" → `songs-to-learn#key`.
  - Listen, nothing heard for 5 s: the existing hint + `listen#nothing`.
  - Tuner error "refused": the existing browser link + `troubleshooting#microphone`.
- Usage is counted with the existing analytics: `logEvent('help', { article })`.

## Anti-drift rules

Checked by `node --test` (`tests/help.test.mjs`) and `pnpm test`
(`site/tests/help.spec.ts`), which CI runs on every pull request:

1. Every feature in the registry has an article, and that article lists the feature.
2. Every feature name and UI label is shown by the app, letter for letter: as
   UI text (in quotes or between tags, not in a comment). Rename something in
   the app only, and the test names it.
3. Every `{{id}}`, article link, `#anchor`, `app:` deep link (through the
   app's own `parseLink`) and link tab exists.
4. Every key `helpScreenKey()` can return has an article, and every "?"
   (`uiHelp('id', 'anchor')`, literal ids only) leads to an article and anchor that exist.
5. Markdown outside the subset fails to parse.
6. Every picture is listed in `help/screenshots.json`, exists, has a
   description, and is used; a file in `help/img/` that the script does not
   make fails the test.
7. `verified` is a real date, not in the future and not older than 180 days.
8. The exports contain every article, feature and passage, with unique
   citation ids.

**Screenshots are made by a script, never by hand:**
`python3 build.py && node scripts/help-screenshots.mjs`. It opens the built
app in the pre-installed Chromium (`scripts/lib/app-browser.mjs`, on top of
the browser tests' own harness `tests/e2e/harness.mjs`: the same server,
headers and Content-Security-Policy, a stand-in account for the screens that
need one, a fake microphone) and follows the steps in
`help/screenshots.json`. When a pictured screen changes, run it and commit the
new pictures.

The smoke suite (`tests/e2e/smoke.e2e.mjs`) opens a "?", the list and the ⋯ menu's Help.

The rules for people and for Claude are in `CLAUDE.md`, "Help and docs".

What the tests cannot check is whether a sentence is still true ("the button
is at the bottom left"). That is what `verified` and the pull-request rule are
for: the person who changes a screen re-reads its article in the same pull
request.

## An AI assistant, later (designed, not built)

- **What it reads**: `/help/index.json`. Each article comes as `passages`, one
  per `##` heading, with `id` (`article#anchor`), `url`, `heading` and `text`.
  They are already the right size to embed and to quote. `features` gives the
  vocabulary; `rules` repeats the rules below. `/llms-full.txt` is the same
  content for tools that take one file.
- **Retrieval**: embed the roughly 180 passages (heading + text) at build
  time; at this size a keyword search over them, as the `/help` page does in
  the browser, is a fair baseline to beat. Filter by `instruments` and
  `audience` when the question says which instrument.
- **Citations**: every answer names the passage ids it used and links their
  `url`. No passage, no answer: say so and offer `/help/contact`.
- **Never answered from memory**: the notes of a tuning, a fingering, the
  notes of a chord on an instrument, which songs or chords an instrument can
  play, and anything about a user's account. These come from the app's
  catalogue, which changes and is sourced from makers' charts. The assistant
  links to the instrument's page or deep link (`/handpan/d-kurd/chords`)
  instead, or, as a later step, calls a tool that runs the app's own engine
  (`site/src/lib/engine.ts` already exposes tunings, chords and fingerings).
  Privacy and data questions are answered only from the privacy passages.
- **Where "Ask a question" could sit**: on `/help` under the search box (the
  search results stay the first answer, the assistant is the fallback), and in
  the app's help sheet footer next to "All help topics", online only.
- **Feedback loop**: questions with no passage are the list of articles to
  write; send them where "Send feedback" goes today.

## Adding a language

`help/lv/<id>.md` with the same ids and anchors; `HELP_LANGUAGES` in
`site/src/lib/help.ts`; routes under `/lv/help`. The tests should then also
check that every language has every id and anchor. Feature names come from
the registry, which needs a per-language name when the app is translated.
