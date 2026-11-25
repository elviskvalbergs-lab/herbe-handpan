# Reasons to come back: the songbook

**Status: plan** (status line added 22 Nov 2026). A design for the owner's review; none of it is built.

Design for review. **No feature code until the owner approves it.**
Wireframes: `docs/reasons-to-come-back-wireframes.html` (open it in a browser).

The review found that nothing brings anyone back: no progress, no "what next", no reminder, no way to reach people, and the planned `return_visit` event is never logged. The instrument goes on a shelf after two weeks. This proposal is one small system that gives a reason for the second visit and for the fifth, and a way to measure both.

It builds on what other sessions are adding now (Songs as its own tab, song links and sharing, the "wait for the right note" song mode, the help centre, the makers programme). It doesn't repeat them.

---

## Decisions for the owner

Each has my recommendation. Everything below the line assumes the recommendations.

| # | Decision | Recommendation |
|---|---|---|
| 1 | **What counts as "I can play it"?** | Playing it from the first note to the last with the microphone listening (the wait mode), in one go, without skipping. Not a button you tap. That is what makes the songbook worth having. A progression played along to the end without the microphone gets a quieter mark, "Played along", until Listen can check chords on real instruments. |
| 2 | **The name.** "Songs I can play", "My songbook", "Repertoire". | **Songbook** as the name of the place, "I can play" as the label on the tab. Short, no theory, and people already say it. |
| 3 | **A guest plays a song through. What happens?** | The moment is shown in full (they hear it, they see "You played it through"), and the sheet's one button is "Keep it in my songbook", which is the sign-up. This fits your earlier decision that guests keep nothing between visits. It is the strongest sign-up moment the app will have, stronger than Save. |
| 4 | **Email.** Today the privacy notice says no marketing emails. | Ask for it in release 1, send from release 2. One unticked choice: "Email me the tune of the week (one email a week at most)". Ask in release 1 because someone who signs up without being asked can never be asked by email later. Don't ask in release 1 unless release 2 follows within about eight weeks. Needs a privacy notice change (§8). |
| 5 | **Push notifications.** | Not now. On iPhone they only work for an installed app, the permission prompt is the least grown-up thing a music app can show, and it is the most expensive channel to build. A weekly calendar entry (decision 6) does the same job with no data. |
| 6 | **A reminder that needs no data.** | "Add a weekly time to my calendar": the app makes a calendar file with a repeating 15-minute entry and a link to the instrument. Nothing is stored anywhere, it works for guests, and the link tells us how many returns it brings. In release 1. |
| 7 | **Counting returning guests.** | Don't store anything on a guest's device to count them. Keep the promise in the privacy notice ("no cookies, no stored id"). Count guest returns by what the link says (opened from the calendar entry, from the tune-of-the-week link, from the home screen icon) and count accounts exactly. The alternative, a "been here before" mark on the device, would need consent in the EU even though it identifies nobody (§9). |
| 8 | **Practice rhythm: weeks or days?** | Weeks. "Played 3 of the last 4 weeks." No streak, nothing resets, a missed week is an empty dot and no words. |
| 9 | **Recordings.** | Release 2, on the device only, shared as a file through the phone's own share sheet. No recordings on our servers: they catch voices and rooms, and hosting them changes what the privacy notice has to say. |
| 10 | **Order of the first five songs.** | The best-known songs first, among those that need few notes; each next one adds at most one or two new notes. Pure "fewest notes first" puts songs nobody knows at the top (I ran it: on a D Kurd it opens with *Kas godīga Jāņu māte*, three notes, before *Twinkle, Twinkle*). |
| 11 | **Where the songbook is stored.** `saved_items.kind` only allows five kinds, and changing that list would alter an existing table. | A new table, `progress_items`, with the same shape and its own save function, so the sync code is reused and nothing existing changes (§7). |

---

## 1. The system in one paragraph

**You play a piece through, the app heard you, and it goes into your songbook for that instrument. The app then offers one next piece, chosen because it uses the notes you already know. A quiet line shows which weeks you played.** Three parts, one loop:

1. **Play it through** (the proof): the wait mode, on the song's own screen.
2. **The songbook** (the record): what you can play, on each instrument, at which level.
3. **Next** (the pull): one suggestion, with the reason in one line ("Same six notes" · "One new fingering: B5").

Around the loop are two helpers: the **weeks line** (a forgiving rhythm) and a **reminder you set yourself** (calendar now, email from release 2).

Nothing in it is a number for its own sake. There are no points, badges, levels to "unlock", mascots or streaks. What you get for playing is musical: the song is yours, you hear it over a drone in its key, and the next song is one note away.

### Why this suits the audience
- **Jammers want songs, not theory.** A list of songs they can actually play is the thing they'd show a friend. "I can play eleven songs on this" is the opposite of the instrument on the shelf.
- **Adults give up when they can't tell if they're getting anywhere.** The songbook is evidence, and it only grows.
- **It was often a gift.** The first five songs answer "what do I do with this?" in the first week, five minutes at a time.
- **Makers** want buyers who keep playing. The songbook and the weeks line are exactly the numbers a maker would want to see in aggregate (release 2, on top of the makers programme).

### Levels (reusing the play levels)
The songbook shows a level in words, never as a score.

| Piece | Levels | Where they come from |
|---|---|---|
| A song (melody, `js/songs.js`) | **Note by note** (wait mode, your own pace) → **In time** (you kept up with the player at 75% speed or more) | The songs have no chords in their data, so Roots / Arpeggio / Groove don't apply to them. Note by note is release 1; In time is release 2, once the wait mode can judge timing. |
| A progression or imported chord sheet | **Roots → Arpeggio → Groove** | Exactly the existing `PLAY_LEVELS` on the progression player. The songbook keeps the highest level played to the end. |
| An ocarina's or flute's playlist practice | **Played through** | Practice already moves on when the tuner hears the right note (`state.tuner.lastAdvance`). Reaching the last step counts. |

Honest limit: play levels don't exist on ocarinas and flutes yet (`docs/ocarina-mode.md`, "Still to do"). Until they do, a wind instrument's progression has one level.

---

## 2. What exists today (from walking the app)

- **Songs:** 103 melodies in `js/songs.js`, each fitted to the instrument (`playableSongs`, `songShift`): 21 fit a D Kurd, 102 fit a 12-hole alto C ocarina. The song screen (`viewSong`) plays the tune, shows the tab and lyrics, and lists "Goes well after it" (`songsThatGoTogether`). Nothing remembers that you opened or played a song.
- **Progressions:** the player runs steps in time at Chord / Roots / Arpeggio / Groove. Reaching the end is not recorded.
- **Microphone:** the tuner (YIN) and Listen. `recordMic` / `micTakes` already record takes in memory for the listening report.
- **Home:** My instruments, playlists, progressions. No "continue", no progress. An account opens on its last screen (`lastPath` in the synced prefs).
- **Measurement:** PostHog, cookieless. `open`, `first_play`, `feature`, `save_tap`, `signup_*`, `install` are logged. **`return_visit` is in the plan but no code logs it.** `profiles.last_seen_on` is overwritten every day, so it holds the last day only: retention by week can't be worked out from it.
- **Reach:** none. No email opt-in, no notifications. Sign-in emails come from Supabase's own mailer, which is for sign-in only.
- **Guests:** keep nothing between visits (owner's decision). Settings stay on the device for everyone.

---

## 3. The ideas, one by one

Cost is S (a day or two), M (about a week), L (several weeks). "Modules" are the files that change.

### 3.1 The songbook: "Songs I can play"
- **User story:** *I played Twinkle, Twinkle through on my handpan, and it's now in my songbook. When my sister visits I open the list and play her three songs.*
- **Why it suits them:** it is progress an adult respects, a list of music rather than a score. It is per instrument, because a song you know on the handpan is a new thing on the ocarina.
- **How:** the wait mode (another session) tells the app when the last note was played, with how many notes were skipped. No skips and started from the first note: the piece goes in. The Songs tab gets two views with the shared segmented control, **To learn** and **I can play · 3**. Rows are the shared `uiRow` with a level badge. On another instrument that the song fits: "You play this on your D Kurd. Try it here, in A."
- **Cost: M.** `js/songs.js` (pure: `songbookAdd`, `songbookFor`), `js/app.js` (the Songs tab views, the row), `js/sync.js` + `js/datastore.js` (a second table through the same merge), `js/store.js` (a `learned` save text), tests. Depends on the wait mode's "finished" signal.
- **Data:** `progress_items` (§7). One item per instrument and piece: level, first and last week played, times played.
- **Privacy:** which songs an account can play, by week. No audio, no times of day. Covered by the existing purpose ("to keep your things and sync them"); the notice gets one line.
- **Measured by:** `play_through`, `songbook_add`; the share of new accounts with one piece in the songbook in week 1, and with five in the first 30 days.

### 3.2 A gentle practice rhythm: the weeks line
- **User story:** *I see four small dots, three filled: I played three of the last four weeks. I missed one and nothing told me off.*
- **Why:** adults have jobs and children; a daily streak punishes exactly the people we want to keep. A week is how people actually keep a hobby ("I play on Sundays").
- **How:** a week counts when you play any piece through, a new one or one already in the songbook. Shown as one line on Home and on the songbook: "Played 3 of the last 4 weeks", with eight dots behind "Show more". An empty week has no text. There is no best-ever number to lose.
- **Cost: S**, once play-throughs are stored. `js/app.js` (one line of UI), a pure `weeksPlayed(items, today)` in `js/songs.js`.
- **Data:** worked out from `progress_items` for display; `activity_weeks` (§7) for measurement.
- **Privacy:** week granularity only.
- **Measured by:** the retention metric itself (§9): accounts active in week 4 and week 8.

### 3.3 "Next": one recommendation after each piece
- **User story:** *I finished Ode to Joy on my ocarina. The app says: "Next: Frère Jacques. One new fingering: B5." I tap it.*
- **Why:** the hardest moment is the one right after success, when there's nothing obvious to do. A list of a hundred songs is a chore; one song with a reason is an invitation.
- **How:** a pure function `nextPiece(have, songbook, just)`:
  1. Songs that fit the instrument and aren't in the songbook.
  2. Fewest notes that no learned song has used (0 first, then 1, then 2).
  3. Among those, the best-known first (the catalogue's own order), songs of the season ahead in season (`christmasSeason`), then the same time signature as the piece just played.
  - The reason line is worked out, not written: "Same six notes" · "One new note: A3" · on an ocarina or flute "One new fingering: B5" with that fingering drawn (`renderFingering`).
  - After a progression: the next level ("You played it at Roots. Try Arpeggio."), and after Groove a song in the same key.
  - One suggestion, plus "More songs" to the Songs tab. The song screen's "Goes well after it" list stays as it is.
- **Cost: S–M.** `js/songs.js` (pure, tested on real tunings), `js/app.js` (the finish sheet, the pick-up row).
- **Data:** none beyond the songbook.
- **Privacy:** none.
- **Measured by:** `next_shown`, `next_tap` (with the reason kind); the share of play-throughs followed by another piece started in the same visit, and within 7 days.

### 3.4 Tune of the week
- **User story:** *It's the week before Midsummer and the app's tune of the week is "Kas godīga Jāņu māte", already in the key that fits my pan. I send the link to my cousin.*
- **Why:** something new that isn't about you. It gives the owner a weekly thing to post, and it is the natural content of the one email.
- **How:** one song a week from the catalogue. A data file (`js/weekly.js`: ISO week → song id) with a default rotation, so it never needs weekly work, and the owner can set weeks by hand (seasons, name days, a maker's tune). It shows at the top of the Songs tab and on Home, fitted to the instrument: "This week: Skye Boat Song · fits your D Kurd in D minor". If it doesn't fit, it says so and offers the closest one that does. The link `/week` always opens the current tune on the visitor's instrument (it builds on the song links another session is adding).
- **Cost: S** for the row and the data file, **+S** for `/week` in `js/links.js` and `middleware.js` (preview card). Later it can move into Sanity so it's edited in the Studio.
- **Data:** none (static file).
- **Privacy:** none.
- **Measured by:** `open` with `source=week`; `play_through` with `weekly: true`; weekly shares.

### 3.5 Guided paths: "Your first five"
- **User story:** *I got an ocarina for my birthday. The app shows five songs, "about five minutes each". I did the first tonight; number two is waiting.*
- **Why:** a gift owner has no plan. Five short sessions is a promise small enough to keep, and unfinished number two is the reason for the second visit.
- **How:** not a separate feature: it is the songbook's empty state. `firstFive(have)` picks five songs for the instrument with the Next rules (decision 10), shown as five numbered rows with the done ones ticked. It says "about 5 minutes each · one a day or one a week, as you like" and never mentions days missed. After the fifth: "Your first five are in your songbook", and Next takes over.
- **Written paths** (a first chord, a first two-chord song, a first rhythm at Roots; "play with a friend") are release 2: they need authored steps and copy, where the first five need none.
- **Cost: S** on top of 3.1 and 3.3 (same rows, same function). Written paths: **M**.
- **Data:** none (worked out; progress is the songbook).
- **Privacy:** none.
- **Measured by:** `path_step` (n of 5); the share of new accounts that reach 2 of 5 (the second visit) and 5 of 5.

### 3.6 Record a take, keep it, share it
- **User story:** *I finally got Amazing Grace clean. I keep the take, play it back next month and hear how far I've come. I send it to my mum.*
- **Why:** hearing yourself is the most musical reward there is, and a take from a month ago is real, felt progress.
- **How:** `recordMic` already records while the microphone is open. After a play-through: "Keep this take". One take per piece (the latest; keeping the first as well, "Then and now", is the nice version). Stored on the device in IndexedDB (`js/localdb.js`), not synced. Share sends the audio file through the phone's share sheet (`navigator.share` with a file), so it goes to WhatsApp or Messages without touching our servers.
- **Cost: M.** `js/tuner.js` (keep a take beyond memory), `js/localdb.js`, `js/app.js` (the player row, share). Hosted take links: **L**, not recommended.
- **Data:** none on the server.
- **Privacy:** a recording may catch voices. It stays on the device, the app says so, and sign-out deletes it with everything else. The notice gets a line. Takes aren't on a second device: say that plainly in the UI.
- **Measured by:** `take_keep`, `take_play`, `take_share` (counts only).

### 3.7 Playing together
- **User story:** *I worked out four chords on my pan. I send the link to Jānis; his phone shows the same four chords as plain chord names for guitar, with the tempo, and he plays along.*
- **Why:** "play chords with friends" is the reason many of these people own the instrument. A friend waiting for you is a better reminder than any notification.
- **How, three sizes:**
  - **Jam card (M):** a progression's link (`/jam?...`, everything in the link like a custom handpan, so it works for guests and needs no server) opens a simple page for the other player: chord names in concert pitch, bars, tempo, a count-in, and "Open it on my instrument". Built from the progression screen's shared parts, read-only.
  - **The same song for two instruments (S–M):** a song link that carries a key which fits both instruments (`songShift` for each, then the keys they share). "Play it with a friend" on the song screen asks what the friend plays.
  - **Live sessions (L):** two phones in step. Not recommended; the mic and timing work is large and the need is unproven.
- **Data:** none.
- **Privacy:** none; the link holds chords only.
- **Measured by:** `jam_share`, `open` with `source=jam`, and `first_play` after it (the friend played).

### 3.8 Maker-linked moments
- **User story:** *I scan the QR card that came with my handpan. The app opens on my exact scale and the first of my five songs is "A welcome tune from Aurora Handpans".*
- **Why:** it makes the first minute personal, and it gives makers a reason to put the link in the box, which is the cheapest acquisition channel there is.
- **How:** on top of the makers programme: a maker profile gets one optional field, a welcome tune (a song from the catalogue, or a progression the maker made in the app). When an instrument is opened through the maker's link, that tune is slot 1 of the first five, labelled with the maker's name. For makers, one aggregate line in their scan stats: "Of buyers who made an account, 4 in 10 played in their fourth week", shown only above a minimum number of accounts (say 20) so nobody can be singled out.
- **Cost: S–M**, after the makers programme lands.
- **Data:** one field on the maker profile (that session's table); `profiles.signup_source` already holds the path they signed up on.
- **Privacy:** aggregates only, with a floor. The notice says makers see totals, never people.
- **Measured by:** `path_step` with `maker: true`; week-4 retention by sign-up source.

### 3.9 Reminders: calendar, email, push
- **User story:** *After my first song the app asks, once: "When do you like to play?" I pick Sunday evening and it's in my calendar. Later I also tick "Email me the tune of the week".*
- **Why:** without something arriving from outside, coming back depends on remembering. But this audience will leave at the first nagging message, so every reminder is one they set themselves.

| Channel | What it is | Cost | Needs | Verdict |
|---|---|---|---|---|
| **Calendar entry** | A calendar file with a weekly repeating entry and a link (`…/handpan/d-kurd?from=reminder`) | **S** (`js/app.js`, a pure `.ics` builder) | Nothing: no server, no data, works for guests | **Release 1** |
| **Email** | One email a week at most: the tune of the week, fitted to your instrument, and your next song | **M–L** | Consent, a sender, unsubscribe, a privacy notice change (§8) | Ask in release 1, send in release 2 |
| **Push** | A notification from the installed app | **L** | A push subscription table, keys, a sender; on iPhone only for an installed app (iOS 16.4 and later); the service worker, which only accounts have | **Drop for now** |
| **Home screen** | The existing install banner | built | | Offer it at the first play-through instead of on arrival: "Keep Oakhum next to your other apps" |

- **Measured by:** `reminder_add`, `email_optin`, `open` with `source=reminder` / `source=email`, unsubscribe rate (keep it under 1% per send; above that the email is wrong).

### 3.10 Progress as the reason to sign up
- **User story:** *I played my first song through as a guest. The sheet says "You played it through" and "Keep it in my songbook: free, takes seconds". I sign up because I don't want to lose what I just did.*
- **Why:** today the sign-up moment is Save, which asks for an account before the person has done anything they care about. Finishing a song is the first thing worth keeping.
- **How:** the shared save sheet with a new text, `learned`: **"Keep it in your songbook"** / "You played *Twinkle, Twinkle* through. A free account keeps your songbook on every device." After sign-in the piece is added (the pending-save mechanism already survives the redirect). "Not now" lets them hear the drone and see Next anyway: the moment isn't taken away. It adds no new nag: the sheet shows after a play-through, once per piece.
- **Cost: S.** `js/store.js` (`SAVE_TEXTS.learned`, the intent), `js/app.js`.
- **Data, privacy:** as the songbook.
- **Measured by:** `signup_shown` / `signup_done` with `what: 'learned'`, against the same pair for the other intents. I expect this to convert better than any other; if it doesn't, the songbook isn't valued and the plan should change.

### 3.11 The musical reward: play it over a drone
- **User story:** *I played Ode to Joy. The sheet offers "Play it again over a drone in D". A low D and A hum under me and my six notes suddenly sound like music.*
- **Why:** the brief asked for rewards that are musical ("here is what it sounds like with a second chord"). The songs have no chords in their data, and chords must come from a published source, not from memory. A drone on the key's first and fifth notes needs no extra data, suits folk tunes, and is how handpans and flutes are often played together.
- **How:** `js/audio.js` holds the key note and its fifth (from the song's `key` and the shift) softly in the instrument's voice while the wait mode runs again. For a minor key the same two notes work.
- **Cost: S.** `js/audio.js`, `js/app.js`.
- **Data, privacy:** none.
- **Measured by:** `drone_play`; the share of first play-throughs followed by a second run.

---

## 4. Recommendation

### Release 1: "the songbook" (the smallest loop)
What makes a second visit likely is an unfinished small promise (2 of 5) and a reminder you set. What makes a fifth likely is a list that grows and a week you don't want to leave empty.

| Part | From | Cost |
|---|---|---|
| The songbook, per instrument, with Note by note / Roots · Arpeggio · Groove / Played through | 3.1 | M |
| The finish sheet: "You played it through", the drone, one Next | 3.3, 3.11 | M |
| Sign-up at the finish for guests ("Keep it in my songbook") | 3.10 | S |
| Your first five (the songbook's empty state) | 3.5 | S |
| The weeks line | 3.2 | S |
| A pick-up row on Home and a one-line banner when an account opens an instrument ("Next: London Bridge · same six notes") | 3.3 | S |
| "Add a weekly time to my calendar", offered once after the first play-through | 3.9 | S |
| The email question, asked but not yet sent (decision 4) | 3.9, §8 | S |
| Measurement: `return_visit` logged at last, `activity_weeks`, the new events | §9 | S |

About three weeks of work in all, after the wait mode and the Songs tab are merged. It follows the design rule: every part is a shared one (`uiRow`, `uiSheet`, `.banner`, `.badge`, `uiSeg`), the same for handpan, tongue drum, kalimba, ocarina and flute. Only the picture differs, as everywhere else.

### Release 2: "something new each week, and friends"
- Tune of the week with `/week` (3.4), and the weekly email that carries it (3.9, §8).
- Keep and share a take (3.6).
- The jam card and "the same song for two instruments" (3.7).
- The maker's welcome tune and the maker's aggregate line (3.8).
- "In time" for songs; written paths (3.5).

### Drop (or leave until the numbers ask for it)
- **Push notifications:** cost and tone (decision 5).
- **Daily streaks, points, badges, leaderboards, mascots:** against the brief, and they'd make the app look like every other.
- **Recordings on our servers and public take pages:** privacy and hosting for little gain over the share sheet.
- **Live jam sessions between phones:** large, unproven.
- **A "been here before" mark on guests' devices:** breaks the notice's promise for a number we can live without (§9).
- **Mic-checked chords on handpan progressions in release 1:** Listen's chord detection is still being proven on real instruments (`docs/listen-mode.md`). "Played along" is the honest mark until then.

---

## 5. Release 1, screen by screen

See the wireframes; numbers match.

1. **Songs tab, To learn (handpan):** "Your first five on D Kurd · 1 of 5" with five numbered rows; the weeks line; the rest of the songs below, as today.
2. **The finish sheet, guest (handpan):** "You played it through", "Keep it in my songbook" (sign-up), "Play it again over a drone in C", Next.
3. **The finish sheet, account (ocarina):** "In your songbook", the drone, Next with the new fingering drawn.
4. **Songs tab, I can play (ocarina):** the songbook rows with level badges, the weeks line, a song known on another instrument.
5. **Home (account):** the pick-up row on top, instrument rows with "3 songs · played 3 of the last 4 weeks".
6. **Opening an instrument on a later day (handpan, Chords):** the one-line banner. It shows once a day at most and can be closed.
7. **"When do you like to play?" (ocarina):** the calendar sheet, with the email question under it. Shown once after the first play-through, and again only from Settings › Account.
8. **A progression played to the end (handpan):** "Played at Roots. Try Arpeggio."

### Copy rules
- Say what happened in music words: "You played it through", "One new note". Never "Great job!", "Level up", "Streak".
- A missed week has no words at all.
- At most one suggestion at a time, and the reason is always shown.
- Every reminder is set by the person and names how to stop it.

---

## 6. What the wait mode must tell this feature

A request to the session building it, not a change to it:
- an event when the last note was played: `{ songId, instrument, shift, skipped, startedAtFirstNote, seconds }`;
- "skipped" counts taps on Next note and jumps in the note strip;
- nothing else. Tolerances, octave handling on handpans and the listening UI stay that session's decisions.

---

## 7. Data (additive only)

New tables and functions. Nothing existing is altered: `saved_items` keeps its five kinds, `touch_last_seen` stays as it is.

```sql
-- The songbook and anything else that is progress rather than a saved thing.
-- Same shape as saved_items, so js/sync.js merges it the same way.
progress_items (
  owner_id   uuid references auth.users on delete cascade default auth.uid(),
  kind       text check (kind in ('piece')),      -- room for 'path' later, by a new migration
  id         text,            -- '<instrument key>:<song|prog>:<piece id>'
  data       jsonb not null,  -- { level, firstWeek, lastWeek, weeks: ['2026-W47', …], times, verified: 'mic' | 'along' }
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  edited_at  timestamptz, device_id text, deleted_at timestamptz,
  primary key (owner_id, kind, id)
)  -- row-level security: owner reads; writes only through save_progress_item

save_progress_item(kind, id, data, base_version, deleted)  -- as save_item

-- Retention, by week. One row per account and week; no times, no content.
activity_weeks (
  user_id     uuid references auth.users on delete cascade,
  week_start  date,                 -- the Monday
  active_days smallint not null default 0,   -- distinct days the app was opened that week
  pieces      smallint not null default 0,   -- play-throughs that week
  primary key (user_id, week_start)
)
touch_activity(p_played boolean)   -- at most one active day per day; called next to touch_last_seen

-- Email (asked in release 1, used in release 2).
email_prefs (
  user_id          uuid primary key references auth.users on delete cascade,
  weekly           boolean not null default false,
  consented_at     timestamptz,     -- when they ticked it
  consent_version  text,            -- the wording and notice version they saw
  unsubscribed_at  timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid()
)
set_email_optin(p_on boolean, p_version text)   -- auth.uid() only
unsubscribe_email(p_token uuid)                 -- callable signed out: the link in every email
```

- **The instrument key:** the catalogue slug from `js/links.js` (`handpan/d-kurd`, `ocarina/alto-c-12`) for catalogue instruments, the saved item's id for custom and measured ones. So a song learned on a D Kurd is known on every D Kurd the person opens.
- **Merging on two devices:** per field: the higher level, the earlier first week, the later last week, the union of weeks. Nothing is ever lost by a merge, which suits progress.
- **Weeks, not timestamps:** the songbook keeps ISO weeks only. It is all the weeks line needs.
- **Delete and export:** everything cascades from the account, and Export my data gains the three tables.
- **Guests:** the songbook lives in this tab's `sessionStorage` like the rest of a guest's work (`dataStore()`), and `carryOverVisit` moves it into the account at sign-up.

---

## 8. Email: what it needs

I'm not a lawyer; have the notice wording checked once before the first send.

**Legally (EU, GDPR and the ePrivacy rules as Latvia applies them):**
- **Consent, separate from the account.** The account is a contract; a weekly email is not needed for it, so it needs its own yes. An unticked switch with the plain promise next to it: "Email me the tune of the week. One email a week at most. Stop any time."
- **Proof:** when they said yes and to which wording (`consented_at`, `consent_version`).
- **Every email:** who it is from (Oakhum, Elvis Kvalbergs, the contact address), a one-tap unsubscribe link that works without signing in, and the `List-Unsubscribe` headers so mail apps show their own unsubscribe button. A postal address in the footer if you expect readers in the USA.
- **The address is already confirmed** (they signed in with a code sent to it), so no second confirmation email is needed.
- **The privacy notice** changes: a new purpose ("to email you the tune of the week, if you ask for it"), the sending service as a processor, how to stop. `PRIVACY_VERSION` moves on, and the line "no marketing emails" goes. Existing accounts aren't affected until they tick the switch.
- **Keep it honest:** no emails to people who didn't tick it, including "we miss you". No tracking pixels; count returns by the link's `source=email`.

**Technically:**
- **A sending service** (Supabase's mailer only sends sign-in codes). One with an EU region; its key lives in Vercel's environment variables only.
- **A weekly job** in the website project (`site/`, a scheduled route): reads the opted-in addresses with the server key, builds each email from the tune of the week and the person's instruments and songbook, sends in batches.
- **A sending domain** set up with SPF, DKIM and DMARC, or the emails land in spam.
- **The unsubscribe page** on the website, calling `unsubscribe_email(token)`.
- **Owner time:** none per week if the rotation is used; a few minutes when you want to pick the tune and write a line.

---

## 9. Measurement

### Events (PostHog, cookieless, no ids; `account` = guest or signed in)

| Event | Properties | Answers |
|---|---|---|
| `return_visit` (planned, **never logged**) | days since last (1, 2–7, 8–30, 30+), accounts only | how many come back, and after how long |
| `play_through` | kind (song, progression, practice), family, level, verified (mic, along), first (yes/no), weekly, account | are people finishing pieces |
| `songbook_add` | family, count bucket (1, 2–4, 5–9, 10+) | is the songbook growing |
| `next_shown` / `next_tap` | reason (same-notes, one-new, next-level, season) | does the suggestion work |
| `path_step` | n of 5, maker | where the first five lose people |
| `drone_play` | family | is the reward used |
| `reminder_add` | kind (calendar), day of week | do people set one |
| `email_optin` | on/off, where (finish sheet, settings) | list growth |
| `open` (exists) gains | source (reminder, week, email, jam, pwa) | which channel brings returns |
| `signup_shown` / `signup_done` (exist) gain | what: learned | is achievement a better sign-up moment than Save |

`return_visit` is logged at app start for an account when `profiles.last_seen_on` is not today, from the difference, before `touch_last_seen` overwrites it.

### The retention metric
Counted in SQL from `activity_weeks`, by sign-up week, with week 0 the week the account was made:

- **Second visit:** the share of new accounts with 2 or more active days in their first 7 days.
- **Fifth visit:** the share with 5 or more active days in their first 30 days.
- **Off the shelf (the headline):** the share active in week 4, and in week 8. "Active" means the app was opened; the stricter line is "played a piece through" (`pieces > 0`).
- **Songbook depth:** the share with 5 pieces in the songbook after 30 days.

There is no baseline, because none of this was measured. First target: collect four weeks of numbers before judging. As a rough bar for a hobby tool, I'd call week-4 activity of 20% of new accounts worth building on and under 10% a sign the loop isn't working.

### Returning guests, without identifying them
- **PostHog's cookieless mode** counts a visitor with a hash that changes every day, so a guest who returns tomorrow is a new visitor. That's by design.
- **Storing a "been here before" mark** on the device would count them, but in the EU reading or writing anything on someone's device for measurement needs consent, even when it identifies nobody; only storage the person's own request needs is exempt. That means a consent banner, which the app has avoided on purpose. **Not recommended.**
- **What we do instead, with nothing stored:**
  - the link says where they came from: `source=reminder` (they set a reminder, so they've been here), `source=week`, `source=email`, `source=jam`;
  - an `open` from the installed app (`display-mode: standalone`) is a return by definition;
  - the share of `open` events that carry no referrer and no campaign (typed, bookmarked) is a rough upper bound.
- **The honest summary:** guest returns are undercounted, account returns are exact, and the design pushes anyone who has a reason to return towards an account at the moment they earn it.

---

## 10. Risks

- **The microphone doesn't hear the instrument well enough,** and people can't finish a song they played correctly. That would turn the best moment into the worst. Mitigations belong to the wait mode (tolerances, "I played it, move on" that counts as a skip), and the songbook should accept a song with a small number of skips if real recordings show misses (start at 0, tune from the listening reports).
- **Few songs fit some instruments** (21 on a D Kurd). The first five still work, but the songbook tops out. Progressions and imported chord sheets count as pieces, which is where handpan players will grow.
- **Sign-up at the finish feels like a ransom.** It doesn't take the moment away: the song was played, the drone and Next still work, and "Not now" is one tap.
- **The email is asked for and then nothing arrives** if release 2 slips (decision 4).
- **Dependence on other sessions:** the Songs tab and the wait mode must be merged first. Everything here is written against their described behaviour, not their code.

---

## 11. Build order (after approval)

Each step is its own branch and pull request into `preview`, with tests and `python3 build.py`.

1. **Measurement first:** log `return_visit`; `activity_weeks` and `touch_activity`; `source` on `open`. Small, and it starts the baseline before anything changes.
2. **The songbook:** `progress_items`, sync, the pure functions with tests on real tunings (`nextPiece`, `firstFive`, `weeksPlayed`), the Songs tab's two views.
3. **The finish sheet:** play-through → songbook, the drone, Next, the `learned` sign-up for guests.
4. **Coming back:** the pick-up row and banner, the weeks line, the calendar entry, the email question (with the privacy notice change).
5. **Docs:** `docs/design-system.md` gains the finish sheet, the level badge and the weeks line as shared patterns; `CLAUDE.md`'s instrument checklist gains "songbook and first five work for the new instrument".

**Stop here for the owner's review.**
