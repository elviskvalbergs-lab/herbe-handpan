# The makers programme

Version 1, 21 Nov 2026. **Status:** phases 1 to 3 are built (see "Build order"); the rest is design. Wireframes: `docs/makers-programme-wireframes.html`. The message and the video are in `docs/video-script-makers.md`; this document is the product behind them.

Until now "for makers" meant a page in the website's footer with two `mailto:` buttons. This turns it into something a maker can use alone: ask for the maker role, set up a public profile, manage instruments, print a code for each one, and see how those codes are used.

Oakhum has two public audiences: **jammers** (people who play) and **makers and shops**. Everything here is for the second, and it only works because of what the first already gets.

---

## Open questions for the owner

Each has a recommended answer, and the build follows the recommendation. Changing one later is cheap unless noted.

| # | Question | Recommendation (what is built) | Why |
|---|---|---|---|
| 1 | Who grants the maker role? | **The maker asks in the app; you approve.** One tap in the app's review list (accounts with `profiles.is_admin`), or one cell in Supabase. | A maker profile is public content under Oakhum's name, in a directory that is only worth something if the makers in it are real. Approval costs you a minute per maker at this scale (dozens, not thousands) and removes spam, impersonation and joke entries before anyone sees them. Fully self-serve can come when volume makes approval a burden. |
| 2 | Does a maker have to wait for approval before doing anything? | **No.** While the request is pending the maker can fill in the profile, set up instruments, print codes and see stats. Only the public parts wait: the directory entry, the maker page, and "Made by" on the buyer's screen. | The first ten minutes decide whether a maker stays. Nothing they do before approval is visible to anyone else, so there is nothing to moderate yet. |
| 3 | Can an approved maker edit the profile freely? | **Yes, edits go live at once.** The address (`/makers/<slug>`) is fixed once approved. Anyone can report a profile; you can suspend it in one tap, which hides every public part. | Re-approving every typo fix would make you the bottleneck. Trust after approval, with report and takedown, is how every small marketplace does it. |
| 4 | Where does the maker dashboard live: the app or the website? | **The app** (`/play#maker`). The website gets the public side: the makers page, the directory and one page per maker. | The maker already has to be in the app to set up an instrument, with an account. The app has sign-in, sync, offline, the instrument set-up and the QR code. The website has no sign-in at all, and adding one means a second session, a second place for bugs and a second privacy surface. |
| 5 | One code per model, or one per physical instrument? | **Both, the maker chooses per instrument.** Every instrument a maker sets up has one link and code (the model code). "Add serial numbers" gives each physical instrument its own code that opens the same instrument, so the stats can say "#17: scanned 12 times, saved by its owner". | A maker selling stock D Kurds wants one card to reprint; a maker building to order wants to know what happened to instrument #17. Both are the same instrument set-up with different codes, so it is one feature. |
| 6 | How are scans counted without tracking people? | **Our own tables, counts only** (see "Scan logging"). A scan adds one to a daily counter. "Unique devices per day" uses a hash that is thrown away the next day. Country comes from the request's edge header, never from a stored address. No cookies, no identifiers on the device, no IP addresses stored. | PostHog can't do this: it is set to discard IPs (so no country), and a maker can't be given a view into it. Our own counters hold nothing about a person, so the app's "cookieless, counts not people" promise holds and no consent banner is needed. **Needs one paragraph in the privacy notice** (text proposed below). |
| 7 | Do QR codes and NFC tags count separately? | **Yes.** The printed QR code and the link for an NFC tag differ by `?via=qr` / `?via=nfc`; a link someone copies has neither. The dashboard splits scans three ways. | It costs nothing, and "do the NFC stickers get used?" is the first question a maker who paid for them asks. |
| 8 | Where does the maker's logo live? | **In the maker's row, as a small picture** (PNG, JPEG or WebP, shrunk to 256 px on the device, at most 60 KB). No SVG. | No storage bucket to configure or police, nothing a browser can execute, and it is deleted with the account by the existing cascade. |
| 9 | Do buyers "register" an instrument as theirs? | **Not in this version.** "Saved by its owner" is a count of saves from a code, not a registry of who owns what. | A registry holds personal data and invites disputes (resale, gifts). Worth a separate decision if makers ask for warranty registration. |
| 10 | What is free and what could be paid later? | **Everything here is free.** A later paid tier is proposed under "Free now, paid later"; nothing in the build assumes it. | The programme's job now is to get instruments played and to learn what makers use. |
| 11 | How do you hear about a new request? | The review list in the app shows a count on Settings › Makers for admin accounts. From phase 4 the website's request form also has the kind "Maker or shop", which reaches you the way requests already do. | No email service exists in the project yet; adding one only for this is not worth it. |
| 12 | Which language does a buyer see? | The app and the site are English. The maker's own text (name, place, story) is shown **as the maker wrote it**, marked with its language so browsers and screen readers treat it correctly. No machine translation. | Translating a craftsperson's story automatically puts words in their mouth. If the app is translated later, only the fixed words around the story change. |

**Decisions already made, not reopened:** guests keep nothing between visits; a buyer who scans a maker's code gets the maker's instrument every time they scan. The clay ocarina builder (`profiles.can_build`) stays internal: it is the precedent for a role flag, not something makers are told about.

---

## The maker's journey

Told as Ilze, who builds about 40 handpans a year, most to order, and has never heard of Oakhum.

### 1. Discover
- She gets the cold email, sees the video, or a buyer shows her the app. All of them end at **oakhum.com/makers**.
- The page says what she gets in the order she cares about: buyers keep playing → a link, QR code or NFC tag in every case → her name on the buyer's screen → she sees which codes get used. One button: **Set up your maker page**. A second, quieter one: "Just want the link for a standard scale? Find it here" (the tuning pages, no account).
- The page also shows makers already in the programme (the directory), because the first question is "who else does this?".

### 2. Apply
- The button opens the app at `/play#maker`. A guest sees one screen: what the programme is in three lines, and **Create your maker page**. That opens the app's usual sign-in sheet (email code, Google or Apple), with its own text: "Set up your maker page. Free: your profile, a code for every instrument, and how they are used."
- After sign-in she fills in one form, the same one she can edit later:
  - **Name** of the workshop or shop (and the address it gives: `oakhum.com/makers/ilze-pans`)
  - **Maker or shop**
  - **Where** (town, country)
  - **Website**
  - **What you make** (handpans, tongue drums, kalimbas, ocarinas, flutes)
  - **Your story**, a few sentences, optional
  - **Logo**, optional
  - **A note for us**: what she builds and roughly how many a year. Only the reviewer sees it.
- She sends it. The screen now says "We're looking at your request. You can set everything up meanwhile." Nothing is blocked.

### 3. Approval
- You open Settings › Makers › Requests, read the profile and the note, look at the website, and tap **Approve** or **Not now** (with a sentence she will see).
- Approved: her account gets the maker role (`profiles.is_maker`), her page and directory entry appear on the website's next refresh (within an hour), and her instruments start showing "Made by Ilze Pans".

### 4. Instruments
She adds instruments the way any player does, because it *is* the same set-up:
- **From the catalogue**: pick the scale, save.
- **Custom notes**: the layout editor, including bottom notes.
- **Play my notes**: the app listens and works out the layout.
- **In bulk**: paste or upload a list (a CSV: name, instrument, notes or catalogue scale, serial numbers). She checks the preview, fixes the rows marked in red, and imports.

Every saved instrument appears under **Your instruments** on her maker screen. For each one:
- **Link and code**: `oakhum.com/s/7KQ2PM`. It is the app's existing share code, so nothing new to learn.
- **QR card**: a print-ready card (SVG, and "Print" for a PDF) with the QR code, the instrument's name, her name and logo, and "Scan to see what it can play". A sheet of stickers for several at once.
- **NFC**: the link to write (with the free NFC Tools app), and the two warnings from the video script: on steel use an on-metal tag or put it on the case; iPhones need XS or newer.
- **Serial numbers**: "Add serial numbers" → `17, 18, 19` or `17-40`. Each gets its own code and its own card, all opening this instrument.
- **Show "Made by"**: on by default; off for an instrument she shares but did not make.

### 5. The buyer scans
- The phone opens the app on exactly that instrument, ready to play, no account. Under the app bar: **Made by Ilze Pans** with her logo. Tapping it shows her place, story and website, and "More from this maker".
- If the buyer saves it (a free account), the copy keeps "Made by Ilze Pans".
- The link preview (when the link is pasted into a chat) reads "D Kurd handpan by Ilze Pans".
- A buyer who scans again gets the maker's instrument again (owner's decision).

### 6. Stats
- Back on her maker screen: scans this week and this month, how many came from QR, NFC and plain links, how many devices, how many saves into an account, how many visits played chords or opened a song, and the top countries. Per instrument and per serial number.
- "#17: 12 scans, saved, last scan 3 days ago" tells her the buyer is playing. "#22: 0 scans" tells her the card stayed in the case, and maybe to mention it at handover.

---

## What gets built

### Roles
- **`profiles.is_maker`**: set when a request is approved, cleared on suspension. Read by the app next to `can_build`.
- **`profiles.is_admin`**: you tick it once on your own row in Supabase. It opens the review list in the app. It is the only manual step.
- The role is kept in step with `makers.status` by a trigger, so approving in the app and editing the cell in Supabase do the same thing.

### Maker profile (`makers`)
One row per account: slug, name, kind (maker / shop), place, country, website, story and its language, what they make, logo, whether to list in the directory, the note for the reviewer, and the status: `pending` → `approved` | `rejected`; `approved` ↔ `suspended`.

- **Public** (only when approved): name, slug, kind, place, country, website, story, families, logo, and the instruments below.
- **Never public**: the note for the reviewer, the status note, the owner's account.
- **Slug**: lower-case letters, digits and hyphens, 3–40 characters, taken from the name, editable until approval, then fixed (links must not break). A list of reserved words (`admin`, `oakhum`, `request`, …) is refused.
- **Website**: `https://` only.
- **A rejected maker** can edit and send again.

### Instruments: models and individual instruments
A maker's instrument **is one of their saved instruments, shared** (the app's `instruments` table and its 6-character code). Nothing new to set up, sync or back up: the maker screen is a view over what the account already has.

| | What it is | Code |
|---|---|---|
| **Model** | one saved, shared instrument: "D Kurd 9", "Low Pygmy with two bottom notes" | the instrument's share code |
| **Individual instrument** | a serial number under a model | its own code in `maker_codes`, opening the model's instrument |

- All codes open at `/s/CODE`, the path that already has rewrites, previews and tests.
- A code can be **retired** (a lost card, a returned instrument): it then opens the "not found" screen. It is never reused.
- The 6-character alphabet without look-alikes gives 729 million codes; codes are checked for clashes across both tables.

### "Made by"
- Shown when the code's owner is an **approved** maker and the instrument does not have "Made by" switched off.
- **In the app**: a row under the app bar on every instrument family (one shared part, `madeByRowHtml`), and a sheet with the public profile. A saved copy keeps the maker's name and slug.
- **In the link preview**: "<instrument> by <maker>".
- **It cannot be forged**: the maker comes from the server's answer for that code, never from the instrument's own data (anything called `madeBy` inside shared data is dropped on arrival), and never from a custom link.

### Scan logging
What is kept, in full:

| Table | Holds | Kept |
|---|---|---|
| `maker_scan_days` | per code, day, country and source (qr / nfc / link): opens, devices, saves, visits that played a chord, visits that opened a song, chords played, songs played | for good; it is only counts |
| `maker_scan_seen` | per code and day: a hash, to count a device once a day | deleted after two days |
| `maker_scan_salts` | one random value per day, mixed into that hash | deleted after two days |

- **The hash** is `sha256(day's random value + code + IP address + browser name)`, worked out inside the database from the request and never sent anywhere. Once the day's random value is deleted the hash can't be recomputed or linked to anything, including the next day's.
- **Country** is the two-letter code the hosting edge puts on the request. Missing means "unknown".
- **Nothing is written on the buyer's device.** No cookie, no local storage, no identifier. Within one visit the app remembers in memory that the code was counted.
- **The maker's own scans don't count** (the maker is signed in; the function skips the code's owner), so testing a card doesn't inflate the numbers.
- **Limits**: a visit reports at most 500 chords and 100 songs; the log function accepts only known codes and event names.
- **A reload or a second visit without the card's mark** counts as an open by plain link: the mark (`?via=qr`) is read once and then dropped from the address, so a link copied from the address bar never claims to be a scan.
- **One device** counts at most 20 opens a day for one code, and can only add saves and chords for a code it opened that day or the day before.
- **"Devices" is devices per day, added up.** The same phone on two days counts twice, because nothing is kept that could tell it is the same phone. The stats screen says so.
- **Small numbers**: countries are shown only for a code or maker with at least 5 devices in the period, so a single buyer's country isn't singled out.

**Proposed privacy notice paragraph** (the notice is website content; it needs adding there):
> *Instrument codes from makers.* When you open an instrument from a maker's QR code, NFC tag or link, we add one to that code's daily count, with the country your connection comes from and whether you played or saved the instrument. To count a device once a day we use a scrambled value made from your connection and browser that we delete after two days and can't turn back into anything about you. The maker sees these totals. We don't store your IP address, set cookies or keep anything on your device for this.

### The maker dashboard (in the app)
Settings › Makers opens `#maker`:
1. **Status card**: pending / approved (with the public page's link) / what to fix.
2. **Profile**: the form above.
3. **Your instruments**: every shared instrument, with link, QR card, NFC, serial numbers, the "Made by" switch, and its numbers.
4. **Stats**: totals for 7, 30 and 90 days, a bar per day, the split by source, top countries, and a table per code. Export as CSV.
5. **For your shop** (phase 5): the embed code.
6. For admins only: **Requests** and **Reports**.

It is built from the app's shared parts (`uiAppBar`, `uiRow`, `uiField`, `uiSheet`, `uiSeg`, `uiEmpty`); the only new pattern is the small bar chart, which goes into `docs/design-system.md`.

### The website
- **`/makers`** rebuilt: the message, the steps, the video, the real call to action (to `/play#maker`), the directory, and the FAQ. Linked from the header, not only the footer.
- **`/makers/<slug>`**: a maker's page: logo, name, place, story, website, and their instruments, each with the playable demo link. In the sitemap.
- **The request form** gets the kind "Maker or shop" for people who want to talk first.
- Copy lives in Sanity as the site's rules require; makers' own data comes from the database (they edit it in the app), never from Sanity.

### Embed (phase 5)
A maker's product page can show the playable picture: `<iframe src="https://oakhum.com/embed/s/7KQ2PM">` (or `/embed/handpan/d-kurd` for a catalogue scale). The embed is the site's existing demo component without the site chrome, with "Made by … · Open in Oakhum" under it. It counts as a source of its own (`via=embed`).

### Bulk import
Paste, or a `.csv` file. One row per model:

```
name,instrument,scale,ding,top,bottom,serials
D Kurd 9,handpan,d-kurd,,,,101-110
Low Pygmy special,handpan,,F3,"G3 Ab3 C4 Eb4 F4 G4 Ab4 C5","C3 Eb3",111
```

- `scale` is a catalogue slug (as in the tuning pages' addresses); or `ding` / `top` / `bottom` for custom notes.
- `serials` is optional: a list or ranges.
- The preview shows each row as it will be created and marks what's wrong ("no such scale: d-kurdd, did you mean d-kurd?", "G3# is not a note"). Nothing is created until every kept row is valid; bad rows can be skipped.
- Limit: 200 rows and 2,000 serial numbers per import.
- Each row becomes an instrument of its own under the name given, even when two rows use the same scale. Ocarinas and flutes are imported by chart (`alto-c-12`, `tin-whistle-d`), not by notes.

---

## Free now, paid later

Nothing below is built or priced; it is a proposal for when makers ask for more.

| Stays free for good | Could be a paid maker tier |
|---|---|
| The maker role, profile, directory entry and maker page | Custom card and sticker designs (own colours, own text, batch PDF with crop marks) |
| Unlimited instruments and codes | Stats older than 90 days, per-serial history, CSV export on a schedule |
| QR card, NFC link, "Made by" | The embed without "Open in Oakhum", or styled to the shop |
| Stats for the last 90 days | Several people on one maker account (a shop's staff) |
| Bulk import | A note from the maker shown to the buyer on first open (care, warranty, lessons) |
| The basic embed | Featured place in the directory |

The line: anything that helps a buyer keep playing is free. Paying is for the maker's own convenience and branding.

---

## Abuse and moderation

| Risk | Answer |
|---|---|
| Fake or joke makers, impersonating a known brand | Approval before anything is public (question 1). The reviewer sees the website and the note. |
| A good profile turned bad after approval | **Report** on every maker sheet and maker page (reason, optional detail; at most 20 a day per maker are kept). Reports show in the admin list. **Suspend** hides the page, the directory entry and "Made by" at once; codes keep opening the instruments, so buyers are not punished. |
| Offensive names in instrument titles | The instrument's name is the maker's own data shown to the buyer who scanned their code; suspension covers it. |
| Script in the profile | Every field is plain text, escaped where shown. The logo is a raster picture checked by the database; the website is `https://` only and opened with `rel="noopener nofollow"`. |
| Inflating one's own stats | Counts are per device per day for "devices"; opens are capped per device per day; the owner's own opens are skipped. Stats are private to the maker, so there is little to gain. |
| Forged "Made by" | See "Made by": only the server says who made it. |
| Scraping the directory | It is public on purpose. It holds nothing that is not on the maker's own website. |
| A maker leaves | Delete account removes the profile, codes and instruments (existing cascade). The counters hold no personal data and stay as totals without an owner. |

---

## Data model (additive)

New columns on `profiles`: `is_maker`, `is_admin`. New tables, all with row-level security on and no write policies: every write goes through a security-definer function, as `save_item` does.

| Migration | Adds |
|---|---|
| `20261121_makers.sql` (phase 1) | `profiles.is_maker`, `profiles.is_admin`; `makers`, `maker_codes`, `maker_reports`; `my_maker()`, `save_maker_profile()`, `review_maker()`, `admin_list_makers()`, `get_maker()`, `list_makers()`, `report_maker()`, `open_shared_instrument()`, `shared_instrument_card()` |
| `20261122_maker_codes_scans.sql` (phase 2) | `maker_scan_days`, `maker_scan_seen`, `maker_scan_salts`; `create_maker_codes()`, `retire_maker_code()`, `log_maker_event()` |
| `20261123_maker_stats.sql` (phase 3) | `maker_stats()` |

`get_shared_instrument()` stays exactly as it is; older app versions keep using it.

Tests: `tests/makers.test.mjs` for the pure module (`js/makers.js`), and `tests/makers-sql.test.mjs`, which applies every migration to a throwaway local Postgres and exercises the functions as a guest, a maker, another maker and an admin (skipped when Postgres isn't installed).

---

## Build order

One pull request per phase, each usable on its own.

1. **Role, profile, "Made by".** The migration; `js/makers.js`; the maker screen with the request form and status; the admin review list; "Made by" on instruments opened by code and in the link preview.
2. **Instruments and codes.** Your instruments on the maker screen; serial numbers; the QR card and sticker sheet; NFC instructions; bulk import; scan logging.
3. **Stats.** The dashboard numbers, per instrument and per code; CSV export.
4. **Website.** `/makers` rebuilt with the real call to action and a header link; the directory; maker pages; the request form's "Maker or shop".
5. **Embed.** If phases 1–4 hold up.

## Not in this plan
- Payments, and anything in the paid column.
- An ownership registry or warranty registration (question 9).
- Translating the app or the makers' text.
- Email notifications.
- Maker-to-buyer messages.
