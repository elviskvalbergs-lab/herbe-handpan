# Help centre: design

Oakhum had no help beyond field hints, the install sheet and a one-time
diagram legend. This is the design of the help "wiki": what end users read
today at oakhum.com/help and inside the app, what an AI support assistant can
be connected to later, and the rules that stop it drifting from the product.

Status: built, except where a section says "designed, not built".

## Open questions for the owner (with what was done meanwhile)

1. **Markdown in the repository, not Sanity.** Recommended and built. Say so if
   you want to edit help in the Studio instead: see "Where the content lives"
   for what that would cost.
2. **"Help with this screen" lives in the ⋯ menu and in Settings, not as a "?"
   button on every screen.** Recommended and built this way because the
   navigation redesign owns the screens' layout; a "?" in the app bar is one
   line once that settles (`uiIconBtn('info', …, { action: 'help-open' })`).
3. **No first-use tour or coach marks.** Recommended: don't build them. Reasons
   under "In the app".
4. **Articles go stale after 180 days** (`VERIFY_DAYS` in
   `tests/help.test.mjs`): the test fails until someone re-checks the article
   against the app. Shorter is stricter; say if you want another number.
5. **The site's "In the app now" list** (Sanity `feature` documents) still has
   its own titles. Recommended next step, with the website session: give the
   `feature` schema a `featureId` and show the registry's name. Not built: the
   list is the website session's.
6. **Latvian.** The structure is ready (`help/lv/`, same ids). Recommended:
   translate after the navigation redesign lands, so it is done once.
7. **Video.** The setup's "Watch how" stays "later". Each how-to article is
   already a script for a 30-second clip; decide when videos are worth making.
8. **oakhum.com as the public address.** The app's help sheet links to
   `https://oakhum.com/help/<id>` (`HELP_SITE` in `js/helpdoc.js`), as the app's
   `/privacy` redirect already does.

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
| Human pages with search | `/help`, `/help/<id>` | `site/src/app/(site)/help/` |
| JSON for a chatbot or RAG pipeline | `/help/index.json` | `helpExport()` in `site/src/lib/help.ts` |
| llmstxt.org files | `/llms.txt`, `/llms-full.txt` | `llmsTxt()`, `llmsFullTxt()` |
| JSON-LD | each article: `HowTo` (type howto) or `FAQPage`, plus `BreadcrumbList` | `helpJsonLd()` |
| The app's help sheet, offline | Settings › Help, ⋯ › Help | `build.py` → `HELP_BUNDLE`, `helpSheet()` in `js/app.js` |
| Sitemap entries | `/sitemap.xml` | `site/src/app/sitemap.ts` |

All of the site's outputs are prerendered at build time.

## Information architecture

Sections (`HELP_SECTIONS`), in this order, with today's articles:

- **Getting started**: set up your instrument · by playing your notes · by
  picking your scale · an ocarina or flute · try a tuning without saving · My
  instruments · change the notes · fingerings.
- **Chords**: find the chords · which chord am I playing · which chords go
  together · slower or faster.
- **Songs, playlists and progressions**: songs to learn · playlists · paste a
  chord sheet.
- **Listen and the tuner**: Listen · the tuner · the microphone and your privacy.
- **Saving, accounts and offline**: saving and accounts · offline · add to home
  screen (iPhone, Android, Samsung, computer) · settings · your data and privacy.
- **Sharing**: links, codes and QR codes.
- **When something goes wrong**: it heard the wrong note · fix common problems ·
  get help or tell us.
- **Words explained**: the glossary (ding, scale, chord, progression, bar…),
  one anchor per word so any article can link to a single word.
- **For makers and shops**: one page, `audience: makers`.

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

- **Settings › About › Help** opens the list of articles in the shared sheet.
- **⋯ menu › Help ("About this screen")** on every instrument, playlist and
  song menu opens the article for the screen you are on (`helpScreenKey()`).
- Articles open in the shared bottom sheet (`uiSheet`), links between articles
  stay inside it, and a button opens the same article on the website (with its
  pictures). The text is built into the page, so it works offline for
  everyone the page works for, account or not. Cost: about 60 KB of the 1.2 MB
  page.
- **Coach marks: not built, on purpose.** The setup is already a guided
  four-step flow that ends on "Play my first chord"; a tour on top would
  repeat it, block the first chord, and need re-drawing with every layout
  change (the navigation redesign is about to move the tabs). What a tour is
  for is covered by good empty states and help one tap away. Revisit only if
  analytics (`help` events, by article) show people stuck on one screen.
- **Empty states** (designed, not built: the screens are the navigation
  redesign's). Each says what the thing is, the one action that fills it, and
  links to its article with `data-action="help-open" data-id="…"`:
  - Playlists, none yet: "Chords in order… Tap ♡ on any chord to start one, or
    paste a chord sheet." (exists) + "How playlists work" → `playlists`.
  - Songs, none playable: "No song here fits these notes yet." + "Why?" →
    `songs-to-learn#key`.
  - Listen, nothing heard for 5 s: the existing hint + "It shows nothing" →
    `listen#nothing`.
  - Tuner error "refused": the existing browser link + `troubleshooting#microphone`.
  - Identify, fewer than two notes: (exists) + `identify-a-chord`.
  - My instruments, empty: the welcome screen already is the empty state.
- Usage is counted with the existing analytics: `logEvent('help', { article })`.

## Anti-drift rules

Checked by `node --test` (`tests/help.test.mjs`) and `pnpm test`
(`site/tests/help.spec.ts`), which CI runs on every pull request:

1. Every feature in the registry has an article, and that article lists the feature.
2. Every feature name and UI label is found, letter for letter, in the app's
   source. Rename something in the app only, and the test names it.
3. Every `{{id}}`, article link, `#anchor`, `app:` deep link (through the
   app's own `parseLink`) and link tab exists.
4. Every key `helpScreenKey()` can return has an article.
5. Markdown outside the subset fails to parse.
6. Every picture is listed in `help/screenshots.json`, exists, has a
   description, and is used; a file in `help/img/` that the script does not
   make fails the test.
7. `verified` is a real date, not in the future and not older than 180 days.
8. The exports contain every article, feature and passage, with unique
   citation ids.

**Screenshots are made by a script, never by hand:**
`python3 build.py && node scripts/help-screenshots.mjs`. It opens the built
app in the pre-installed Chromium (`scripts/lib/app-browser.mjs`: a local
server with the deep-link fallback, a fake microphone, a stand-in account for
the screens that need one, a fixed date) and follows the steps in
`help/screenshots.json`. When a pictured screen changes, run it and commit the
new pictures.

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
