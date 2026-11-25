# Reasons to come back: the songbook

Design for review. **No feature code until the owner approves it.**
Wireframes: `docs/reasons-to-come-back-wireframes.html` (open it in a browser).

The review found that nothing brings anyone back: no progress, no "what next", no reminder, no way to reach people, and the planned `return_visit` event is never logged. The instrument goes on a shelf after two weeks. This proposal is one small system that gives a reason for the second visit and for the fifth, and a way to measure both.

It builds on what is now in the app: the Songs tab (Chords · Songs · Playlists · the instrument's own tab), song links and Share, the player's **Wait for me** and **Loop**, the help centre and the makers programme. It doesn't repeat them.

**Review round 1 is done.** The owner's comments are in "Owner's decisions" at the end; this version is rewritten to match them. The biggest changes: the songbook no longer depends on the microphone, the calendar reminder is gone, weekly streaks are in, recordings reach the owner only through the listening report, and there is a catalogue of congratulations and nudges.

---

## Decisions for the owner

Each has my recommendation. Everything below the line assumes the recommendations.

| # | Decision | Recommendation |
|---|---|---|
| 1 | **What puts a song in the songbook?** | Reaching the last note. If **Wait for me** was on, the app heard it, so it goes straight in. Otherwise the app asks one question, "Did you play along?", and **Yes** puts it in. No proof needed: these are adults playing for themselves. The microphone becomes an extra that helps (it says which notes were off) and never a gate. *(Round 1: was "only with the microphone".)* |
| 2 | **The name.** | **Songbook** for the place, **I can play** on the Songs tab's switch. |
| 3 | **A guest reaches the end of a song.** | The finish sheet shows in full (the congratulation, the drone, the next song), and its first button is "Keep it in my songbook", which is the sign-up. The strongest sign-up moment the app has, stronger than Save. |
| 4 | **Streaks.** | Yes, **by week**: "4 weeks in a row". A week counts when you play any song or progression to the end. One missed week in any four is forgiven by itself (a "rest week"). Milestones at 2, 4, 8, 12, 26 and 52 weeks are congratulated. When a run ends the app says nothing and the line goes back to "Played this week" the next time. No "you'll lose your streak", no best-ever number to lose. *(Round 1: was "no streaks".)* |
| 5 | **Reminders.** | Release 2, as **notifications from the installed web app** (web push), for accounts, offered right after a song is finished. This doesn't need a native app: it works on Android and on desktop, and on iPhone once Oakhum is on the home screen (iOS 16.4 and later). A native app is a separate decision, worth it only for being in the app stores (§3.9). *(Round 1: the calendar entry is dropped.)* |
| 6 | **Email.** | Ask in release 1 (one unticked switch: "Email me the tune of the week"), send from release 2 together with notifications. Ask early, because someone who signs up without being asked can't be emailed later. Needs a privacy notice change (§8). |
| 7 | **Counting returning guests.** | Keep one value on a guest's device: **the week of their first visit** (for example `2026-W48`). No id, nothing that tells two people apart. Each `open` then says "first visit", "back this week", "back after 1–4 weeks" or "after 5+". Name it in the privacy notice. There is no EU-wide rule that clearly allows this without consent, so it carries a small risk (§9). Your call. *(Round 1: you thought a line in the notice is enough; I agree it's a reasonable, low-risk choice, with that caveat.)* |
| 8 | **Recordings.** | Nothing is kept by default. While **Wait for me** is on, the app keeps the last few minutes in memory, as Listen and setup already do. When Wait is stuck on a note, or after the song, "Oakhum misheard? Send this take" opens the **listening report that already exists** (recording, what it heard, a comment, an email to hear back). Recordings reach you only when someone taps Send. Keeping your own takes on the phone is parked. *(Round 1.)* |
| 9 | **Congratulations and nudges.** | A short, written catalogue (§3.12) with three rules: each one shows once, any can be dismissed, at most one nudge per visit. A switch in Settings turns them all off. *(Round 1: the owner's "congrats and nudges would go a long way".)* |
| 10 | **Order of the first five songs.** | The best-known songs first, among those that need few notes; each next one adds at most one or two new notes. Pure "fewest notes first" puts songs nobody knows at the top (I ran it: on a D Kurd it opens with *Kas godīga Jāņu māte*, three notes, before *Twinkle, Twinkle*). |
| 11 | **Where the songbook is stored.** | A new table, `progress_items`, with the same shape as `saved_items` and its own save function. `saved_items.kind` allows five kinds, and adding a sixth would alter an existing table (§7). |

---

## 1. The system in one paragraph

**You reach the end of a song, the app congratulates you and puts it in your songbook for that instrument, and offers one next song, chosen because it uses the notes you already know. A weekly streak shows that you keep playing.** Three parts, one loop:

1. **Finish a song** (the moment): reaching the last note in the player, with or without Wait for me.
2. **The songbook** (the record): what you can play, on each instrument, at which level.
3. **Next** (the pull): one suggestion, with the reason in one line ("Same six notes" · "One new fingering: B5").

Around the loop: the **weekly streak**, **congratulations and nudges** in the app, and, from release 2, **reminders** that arrive from outside (notifications and email).

The rewards are musical first: the song is yours, you hear it again over a drone in its key, and the next song is one note away. The congratulations say what you did in music words ("4 weeks in a row: 6 songs on your D Kurd"). There are no points, no badges for their own sake, no mascots and no leaderboards.

### Why this suits the audience
- **Jammers want songs, not theory.** A list of songs they can actually play is the thing they'd show a friend. "I can play eleven songs on this" is the opposite of the instrument on the shelf.
- **Adults give up when they can't tell if they're getting anywhere.** The songbook only grows, and the streak shows the habit.
- **It was often a gift.** The first five songs answer "what do I do with this?" in the first week, five minutes at a time.
- **A weekly streak suits adults.** People like streaks; a daily one punishes the people we most want to keep (jobs, children). A week, with a rest week, keeps the pleasure and drops the guilt.
- **Makers** want buyers who keep playing. The songbook and the streak are the numbers a maker would want to see in aggregate (release 2, on the makers programme).

### Levels (reusing the play levels)
The songbook shows a level in words, never as a score.

| Piece | Levels | Where they come from |
|---|---|---|
| A song (melody, `js/songs.js`) | **Played** (to the end) → **Heard** (to the end with Wait for me on) → **In time** (release 2: kept up with the player at 75% or faster) | The songs have no chords in their data, so Roots / Arpeggio / Groove don't apply to them. |
| A progression or imported chord sheet | **Roots → Arpeggio → Groove** | The existing `PLAY_LEVELS` on the progression player. The songbook keeps the highest level played to the end. |
| An ocarina's or flute's playlist practice | **Played** | Reaching the last step of practice. |

"Heard" is the only thing the microphone adds to the songbook, and it is a small extra: the app treats Played and Heard the same everywhere else (Next, the streak, the first five).

---

## 2. What exists today (from walking the app)

- **Songs tab** on every instrument: "Songs to learn" with Christmas · Popular · Countries filters, and an "Almost fit: one note missing" group. On a D Kurd, 22 popular and 3 Christmas songs fit; far more fit a 12-hole alto C ocarina.
- **The player:** Play, step back and forward, speed from 25%, **Wait for me** (stops on each note until the microphone hears it; tested with generated audio, not yet with a real instrument in a room), **Loop**, the tab with lyrics, Share, "On your instruments", "Goes well after it". **Nothing remembers that a song was played or finished.**
- **Progressions:** the player runs steps in time at Chord / Roots / Arpeggio / Groove. Reaching the end is not recorded.
- **Microphone:** the Tuner, Play my notes, Listen. Listen and setup keep the last takes in memory (`recordMic`, `micTakes`) for the **listening report**, which sends the recording, what was heard, a comment and an email to `/api/listen-report` (the Studio and Jira). Setup says: "The sound stays on your phone unless you choose to send it to us."
- **Home:** My instruments, playlists. No "continue", no progress. An account opens on its last screen (`lastPath`).
- **Measurement:** PostHog, cookieless. `open`, `first_play`, `feature`, `save_tap`, `signup_*`, `install` are logged. **`return_visit` is planned but never logged.** `profiles.last_seen_on` is overwritten every day, so retention by week can't be worked out from it.
- **Reach:** none. No email opt-in, no notifications. The service worker exists for accounts only (offline), which is also what web push needs.
- **Guests:** keep nothing between visits (owner's decision). Settings stay on the device for everyone.

---

## 3. The ideas, one by one

Cost is S (a day or two), M (about a week), L (several weeks). "Modules" are the files that change.

### 3.1 The songbook: "Songs I can play"
- **User story:** *I played Twinkle, Twinkle to the end on my handpan, said yes, and it's in my songbook. When my sister visits I open the list and play her three songs.*
- **Why:** progress an adult respects, a list of music rather than a score; per instrument, because a song you know on the handpan is new on the ocarina.
- **How:** when the player reaches the last note (Play, Wait for me, or stepping) the finish sheet opens (3.3). With Wait for me on, the song goes in as **Heard**. Otherwise: "Did you play along?" → **Yes, I played it** puts it in as **Played**; **I just listened** closes the question and keeps the rest of the sheet. The Songs tab gets a switch, **To learn · I can play 3** (the shared segmented control). Rows are the shared `uiRow` with a level badge. A song in the songbook of another instrument that also fits this one: "You play this on your D Kurd. Try it here, in A."
- **Cost: M.** `js/songs.js` (pure: `songbookAdd`, `songbookFor`), `js/app.js` (the switch, the rows, the end of the player), `js/sync.js` + `js/datastore.js` (a second table through the same merge), `js/store.js` (a `learned` save text), tests.
- **Data:** `progress_items` (§7): one item per instrument and piece, with level, first and last week, the weeks played, times played.
- **Privacy:** which songs an account can play, by week. No audio. Covered by the existing purpose ("to keep your things and sync them"); the notice gets one line.
- **Measured by:** `play_end` with `answer` (yes, listened, heard); `songbook_add`; the share of new accounts with one song in week 1 and five in the first 30 days.

### 3.2 The weekly streak
- **User story:** *The songbook says "4 weeks in a row". I missed a week in October and it still counted it as a rest week. On Sunday I play one song so the run keeps going.*
- **Why:** people like streaks, and they work. Measured in weeks, with a rest week, it rewards the habit without punishing a busy week.
- **Rules:**
  - A week (Monday to Sunday) counts when you play any song or progression to the end, a new one or one you already know.
  - **Rest week:** one missed week in any four in a row is forgiven by itself, shown as a hollow dot with a small dash. Nothing to buy or tap.
  - The line: "4 weeks in a row" from 2 weeks on; "Played this week" for a single week; nothing at all before the first song.
  - **Milestones** (2, 4, 8, 12, 26, 52 weeks) open a congratulation once (3.12).
  - When a run ends, nothing is said. No best-ever number.
  - A guest has no streak (nothing is kept between visits). It starts with the account, and the weeks played in the visit before sign-up count.
- **Cost: S.** A pure `weekStreak(weeks, today)` in `js/songs.js` with tests (rest weeks, a year boundary, time zones by the device's own week), one line of UI.
- **Data:** worked out from `progress_items`; `activity_weeks` (§7) for measurement.
- **Privacy:** weeks only.
- **Measured by:** the retention metric itself (§9), and how many reach each milestone.

### 3.3 The finish sheet and "Next"
- **User story:** *I finished Ode to Joy on my ocarina. The app says "In your songbook", offers to play it again over a drone, and suggests: "Next: Frère Jacques. One new fingering: B5." I tap it.*
- **Why:** the hardest moment is the one right after success, when there's nothing obvious to do. A list of a hundred songs is a chore; one song with a reason is an invitation.
- **The sheet** (the shared `uiSheet`): the congratulation in music words, the question or the songbook line, **Play it again over a drone in C** (3.11), one **Next** with its reason, and, if Wait for me was on, "Oakhum misheard? Send this take" (3.6).
- **Next** is a pure `nextPiece(have, songbook, just)`:
  1. Songs that fit the instrument and aren't in the songbook.
  2. Fewest notes that no song in the songbook used (0 first, then 1, then 2).
  3. Among those: the best-known first (the catalogue's own order), the season's songs in season (`christmasSeason`), then the same time signature as the song just played.
  - The reason is worked out, not written: "Same six notes" · "One new note: A3" · on an ocarina, flute or recorder "One new fingering: B5" with the fingering drawn (`renderFingering`).
  - After a progression: the next level ("You played it at Roots. Try Arpeggio."), and after Groove a song in the same key.
  - "Goes well after it" on the song screen stays as it is.
- **Cost: M.** `js/songs.js` (pure, tested on real tunings of every family), `js/app.js` (the sheet).
- **Data, privacy:** none beyond the songbook.
- **Measured by:** `next_shown`, `next_tap` (with the reason); the share of finished songs followed by another started in the same visit, and within 7 days.

### 3.4 Tune of the week
- **User story:** *The week before Midsummer the tune of the week is "Kas godīga Jāņu māte", already in the key that fits my pan. I send the link to my cousin.*
- **Why:** something new each week that isn't about you; the owner has a weekly thing to post; it is what the notification and the email carry.
- **How:** one song a week, from a data file (`js/weekly.js`: ISO week → song id) with a default rotation, so it never needs weekly work; the owner can set weeks by hand (seasons, name days, a maker's tune). At the top of the Songs tab and on Home, fitted to the instrument ("fits your D Kurd in D minor"), or the closest one that fits. `/week` always opens the current tune on the visitor's instrument (on top of the song links).
- **Cost: S** (+S for `/week` in `js/links.js` and `middleware.js`). Later it can move to Sanity.
- **Data, privacy:** none.
- **Measured by:** `open` with `source=week`; `play_end` with `weekly: true`.

### 3.5 Your first five
- **User story:** *I got an ocarina for my birthday. The Songs tab shows five songs, "about five minutes each". I did the first tonight; number two is waiting.*
- **Why:** a gift owner has no plan. Five short songs is a promise small enough to keep, and number two waiting is the reason for the second visit.
- **How:** the songbook's starting state. `firstFive(have)` picks five songs with the Next rules (decision 10), shown above "Songs to learn" as five numbered rows, done ones ticked. "One a day or one a week, as you like." After the fifth: a congratulation, and Next takes over.
- **Written paths** (a first chord, a first two-chord progression, a first rhythm at Roots, "play with a friend") are release 2: they need authored steps; the first five need none.
- **Cost: S** on top of 3.1 and 3.3.
- **Data, privacy:** none.
- **Measured by:** `path_step` (n of 5); the share of new accounts that reach 2 of 5 and 5 of 5.

### 3.6 The microphone as a helper, and sending a take
- **User story:** *Wait for me hangs on the same note although I'm playing it. A line appears: "Not hearing it? Skip this note · Tell us". I tap Tell us, and the last minute of my playing goes to Oakhum with what it heard.*
- **Why:** this is where the microphone adds value without being a gate: it says what went wrong, and it turns every failure into a report you can fix.
- **How:**
  - While Wait for me is on, the app keeps the last takes in memory (`recordMic(true)`, the same as Listen and setup). They are gone when the song closes. The Wait toggle says what setup says: "The sound stays on your phone unless you choose to send it to us."
  - **Stuck:** after about 8 seconds on one note while sound is coming in, a line under the picture: **Skip this note** (moves on; the song still counts as Heard if fewer than a few notes were skipped) and **Tell us** (opens the listening report).
  - **After the song with Wait on:** a quiet "2 notes were hard to hear: bar 3, bar 7" (the notes that took longest) and "Oakhum misheard? Send this take".
  - The **listening report** (`listenReportSheet`) gets the song as context: song id, key, instrument, the note it waited on, the notes heard. Nothing else changes: the recording switch, the comment, the email, `/api/listen-report`, the Studio and Jira.
- **Cost: S.** `js/app.js` (the stuck line, the context), `js/tuner.js` (none: the recording already exists).
- **Data:** only what someone sends, as today.
- **Privacy:** as the listening report today: sent only on Send, the switch for the recording on by default with the note that it may catch voices.
- **Measured by:** `wait_stuck` (with skip or tell), `listen_check` with `where: 'song'`, reports per 100 Wait sessions.
- **Parked:** keeping your own takes on the phone and sharing them ("Then and now"). Nice, but not needed for coming back.

### 3.7 Playing together
- **User story:** *I worked out four chords on my pan. I send the link to Jānis; his phone shows the chords for guitar, with the tempo, and he plays along.*
- **Why:** "play chords with friends" is why many of these people own the instrument. A friend waiting for you is a better reminder than any notification.
- **How:** the **jam card** (M): a progression's link opens a page for the other player with chord names in concert pitch, bars, tempo and a count-in, and "Open it on my instrument"; built from the progression screen's parts, everything in the link. **The same song for two instruments** (S–M): a song link with a key that fits both (`songShift` for each, then the keys they share). **Live sessions** between phones (L): not recommended.
- **Data, privacy:** none; the link holds chords only.
- **Measured by:** `jam_share`; `open` with `source=jam` followed by `first_play`.

### 3.8 Maker-linked moments
- **User story:** *I scan the card that came with my handpan. The app opens on my scale and the first of my five songs is "A welcome tune from my maker".*
- **How:** a maker profile gets one optional field, a welcome tune (a catalogue song or a progression the maker made). Opened through the maker's link, it is song 1 of the first five, with the maker's name. Makers see one aggregate line in their stats ("Of buyers who made an account, 4 in 10 played in their fourth week"), only above 20 accounts.
- **Cost: S–M**, on the makers programme.
- **Privacy:** aggregates with a floor; the notice says makers see totals, never people.
- **Measured by:** week-4 retention by sign-up source.

### 3.9 Reminders: web push, email, a native app
- **User story:** *After my second song the app asks: "Want a nudge on Fridays?" I say yes. On Friday my phone shows "This week's tune fits your D Kurd: Skye Boat Song".*
- **Why:** without something arriving from outside, coming back depends on remembering. But this audience leaves at the first nagging message, so every reminder is one they asked for, at most one a week.

| Channel | What it is | Cost | Needs | Verdict |
|---|---|---|---|---|
| **Web push** | A notification from the installed web app, at most one a week: the tune of the week, or "One song this weekend keeps your 4-week run going" | **M** | Accounts only (the service worker is theirs); a `push_subscriptions` table; a key pair (the private key in Vercel's environment variables only); a weekly scheduled route in `site/` that sends; on iPhone, the app on the home screen (iOS 16.4+) | **Release 2** |
| **Email** | The same weekly message by email | **M–L** | Consent, a sender, unsubscribe, a privacy notice change (§8) | Ask in release 1, send in release 2 |
| **Native app** (the web app wrapped for the stores) | Notifications through Apple and Google, and a place in the app stores | **L**, plus yearly store fees and review for every release | Two store accounts, a build per platform, a second release process | **Not for reminders.** Decide on it later for store presence, if the numbers say people look for it there |
| **Home screen** | The existing install banner | built | | Offer it at the first finished song: "Keep Oakhum next to your other apps". On iPhone it is also what makes notifications possible |

- **Asking:** only from a button the person taps ("Remind me on Fridays"), never the browser's prompt on arrival. Shown once after the second finished song, then only from Settings › Account.
- **Settings › Account › Reminders:** tune of the week (on/off), streak note (on/off), the day.
- **Measured by:** `remind_on` (push or email), `open` with `source=push` / `source=email`, how many turn it off again.

### 3.10 Progress as the reason to sign up
- **User story:** *As a guest I played my first song to the end. The sheet says "You played it through" and "Keep it in my songbook: free, takes seconds". I sign up because I don't want to lose it.*
- **How:** the shared save sheet with a new text, `learned`: "Keep it in your songbook" / "You played *Twinkle, Twinkle* through. A free account keeps your songbook on every device, and your weekly streak." After sign-in the song is added (the pending-save mechanism survives the redirect). "Not now" leaves the drone and Next.
- **Cost: S.** `js/store.js` (`SAVE_TEXTS.learned`), `js/app.js`.
- **Measured by:** `signup_shown` / `signup_done` with `what: 'learned'` against the other intents. If it doesn't convert better than Save, the songbook isn't valued and the plan should change.

### 3.11 The musical reward: play it again over a drone
- **User story:** *I finished Ode to Joy. "Play it again over a drone in D." A low D and A hum under me and my six notes sound like music.*
- **Why:** a reward that is music. The songs have no chords in their data, and chords must come from a published source, not from memory; a drone on the key's first and fifth needs no extra data and suits folk tunes.
- **How:** `js/audio.js` holds the key note and its fifth softly in the instrument's voice while the player runs again.
- **Cost: S.**
- **Measured by:** `drone_play`; the share of first finished songs followed by a second run.

### 3.12 Congratulations and nudges
Small moments in the app, written once, shown once. They use the shared parts: the **toast** for a small one, the **finish sheet** or a **sheet** for a big one, the **banner** or a **tip card** for a nudge.

**Congratulations** (each once per account and instrument):

| When | What it says | Where | Musical touch |
|---|---|---|---|
| The first chord played on Chords | "Your first chord: D minor. F major shares two of its notes: try it next." | toast | |
| The first song to the end | "You played your first song on your D Kurd." | finish sheet | the drone |
| 5 songs in the songbook (the first five done) | "Your first five. You can play 5 songs on your ocarina." with their titles | finish sheet | |
| 10, 25, 50 songs | "10 songs on your D Kurd" | finish sheet | |
| A new level on a progression | "Stand by Me at Arpeggio. Groove next?" | finish sheet | |
| A streak milestone (2, 4, 8, 12, 26, 52 weeks) | "4 weeks in a row: 6 songs, 2 of them new." | sheet, the first time the app opens after it | a short arpeggio of the last song's key, on the instrument |
| The first song on a second instrument | "Your second instrument. You already know 3 of its songs from your D Kurd." | finish sheet | |
| A song Heard with Wait for me for the first time | "Oakhum heard every note." | finish sheet | |

**Nudges** (contextual, at most one per visit, each at most twice, the second time a week later):

| When | The nudge |
|---|---|
| An account opens an instrument on a later day | banner: "Next: London Bridge · same six notes · ▷ Play" |
| 3 favourite chords and no progression | tip: "Put your chords in order and play them as a progression." |
| The same song opened 3 times, never finished | tip under the player: "Loop the hard part: tap Loop on its first note." |
| A progression finished twice at the same level | in the finish sheet: "Try it at Arpeggio." |
| A song finished slowly (50% or less) twice | in the finish sheet: "Try it at 75%." |
| The first finished song, app not installed | the install banner, with "Keep Oakhum next to your other apps" |
| The second finished song, account, reminders not set | in the finish sheet: "Want a nudge on Fridays?" (release 2) |
| A Friday with a streak of 2+ and nothing played this week | notification, if asked for: "One song this weekend keeps your 4-week run going." (release 2) |

**Rules**
- Music words, never "Great job!", "Level up", fireworks or a mascot.
- One big moment at a time: a milestone waits if a finish sheet is open.
- Each can be dismissed; a dismissed nudge doesn't come back.
- **Settings › Tips and congratulations** (on by default) turns them all off; the songbook and the streak line stay.
- A guest sees them in the visit (nothing is kept), so a returning guest may see the first-chord toast again. That's fine.
- The texts live in one data file (`js/moments.js`: id, when, text, where), so they can be read, changed and translated in one place, and the help centre's anti-drift tests can check them.

- **Cost: M** for the catalogue, the "seen" list and the moments above (the finish sheet itself is 3.3).
- **Data:** the ids already seen, in the synced prefs (`moments: ['first-chord', 'first-five', …]`); no new table.
- **Measured by:** `moment_shown`, `moment_tap`, `nudge_dismiss` (with the id). A nudge dismissed more often than tapped gets rewritten or removed.

---

## 4. Recommendation

### Release 1: "the songbook" (the smallest loop)
What makes a second visit likely: a song finished and congratulated, an unfinished small promise (2 of 5), and the next song waiting on the screen. What makes a fifth: a list that grows and a streak you want to keep.

| Part | From | Cost |
|---|---|---|
| The songbook, with Played / Heard and Roots · Arpeggio · Groove | 3.1 | M |
| The finish sheet: the question, the drone, one Next | 3.3, 3.11 | M |
| Sign-up at the finish for guests ("Keep it in my songbook") | 3.10 | S |
| Your first five | 3.5 | S |
| The weekly streak with rest weeks | 3.2 | S |
| Congratulations and nudges (the catalogue above, except the release 2 rows) | 3.12 | M |
| The pick-up row on Home and the banner on a later day | 3.3, 3.12 | S |
| Wait for me: "Not hearing it?" and "Send this take" through the listening report | 3.6 | S |
| The email question, asked but not yet sent | 3.9, §8 | S |
| Measurement: `return_visit` at last, `activity_weeks`, the guest's first-visit week, the new events | §9 | S |

About four weeks of work. Every part is a shared one (`uiRow`, `uiSheet`, `uiSeg`, `.banner`, `.badge`, the toast), the same for handpan, tongue drum, kalimba, ocarina, flute and recorder. Only the picture differs, as everywhere else.

### Release 2: "something arrives each week, and friends"
- Web push (3.9) and the weekly email (3.9, §8), both carrying the tune of the week (3.4).
- The jam card and the same song for two instruments (3.7).
- The maker's welcome tune and the maker's aggregate line (3.8).
- "In time" for songs; written paths (3.5).

### Drop (or leave until the numbers ask for it)
- **The calendar reminder** (round 1: nobody would use it).
- **A native app for reminders:** web push does it; store presence is a separate decision.
- **A daily streak, points, badges for their own sake, leaderboards, mascots.**
- **Recordings on our servers**, except what people send in a listening report. Keeping takes on the phone is parked.
- **Live jam sessions between phones:** large, unproven.
- **Mic-checked chords on handpan progressions:** Listen's chord detection is still being proven on real instruments. Progressions use the same "Did you play along?" question.

---

## 5. Release 1, screen by screen

See the wireframes; the numbers match.

1. **Songs tab, To learn (handpan, account):** the streak line, "Your first five on D Kurd · 1 of 5", then Songs to learn as today.
2. **The finish, as a guest (handpan):** "You played it to the end", "Did you play along?", "Keep it in my songbook" (sign-up), the drone, Next.
3. **The finish, signed in, with Wait for me (ocarina):** "Oakhum heard every note", in your songbook, the streak, the drone, Next with the new fingering, and "Oakhum misheard? Send this take".
4. **Songs tab, I can play (ocarina):** the songbook with level badges, the streak with a rest week, a song known on another instrument.
5. **Home (account):** the pick-up card, the streak, what each instrument can play.
6. **Opening an instrument on a later day (handpan, Chords):** the Next banner, and a nudge tip after three favourite chords (the two never show in the same visit: drawn together only to save a screen).
7. **Wait for me, stuck (ocarina):** "Not hearing it? Skip this note · Tell us", and the listening report with the song as context.
8. **A streak milestone (handpan):** "4 weeks in a row" with the songs of those weeks.
9. **Tell us (ocarina):** the existing listening report, opened from a song, with the note it waited on and what it heard.

---

## 6. What the player must tell this feature

A request for the player's code, not a change to its behaviour:
- an event when the last note is reached: `{ songId, instrument, shift, how: 'play' | 'wait' | 'step', skipped, startedAtFirstNote, speed, seconds }`;
- in Wait mode, an event when it has waited on one note for 8 seconds while sound was coming in (`{ noteIndex, midi, heardMidi }`), so the stuck line can show;
- the same "reached the end" event from the progression player and from ocarina practice, with the level.

---

## 7. Data (additive only)

New tables and functions. Nothing existing is altered: `saved_items` keeps its five kinds, `touch_last_seen` stays as it is.

```sql
-- The songbook: progress rather than a saved thing.
-- Same shape as saved_items, so js/sync.js merges it the same way.
progress_items (
  owner_id   uuid references auth.users on delete cascade default auth.uid(),
  kind       text check (kind in ('piece')),      -- room for 'path' later, by a new migration
  id         text,            -- '<instrument key>:<song|prog>:<piece id>'
  data       jsonb not null,  -- { level, firstWeek, lastWeek, weeks: ['2026-W47', …], times, how: 'played' | 'heard' }
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  edited_at  timestamptz, device_id text, deleted_at timestamptz,
  primary key (owner_id, kind, id)
)  -- row-level security: owner reads; writes only through save_progress_item

save_progress_item(kind, id, data, base_version, deleted)  -- as save_item

-- Retention, by week. One row per account and week; no times, no content.
activity_weeks (
  user_id     uuid references auth.users on delete cascade,
  week_start  date,                          -- the Monday
  active_days smallint not null default 0,   -- distinct days the app was opened that week
  pieces      smallint not null default 0,   -- songs and progressions finished that week
  primary key (user_id, week_start)
)
touch_activity(p_finished boolean)   -- at most one active day per day; called next to touch_last_seen

-- Email (asked in release 1, used in release 2).
email_prefs (
  user_id           uuid primary key references auth.users on delete cascade,
  weekly            boolean not null default false,
  consented_at      timestamptz,     -- when they ticked it
  consent_version   text,            -- the wording and notice version they saw
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid()
)
set_email_optin(p_on boolean, p_version text)   -- auth.uid() only
unsubscribe_email(p_token uuid)                 -- callable signed out: the link in every email

-- Web push (release 2).
push_subscriptions (
  user_id    uuid references auth.users on delete cascade,
  endpoint   text,
  p256dh     text, auth text,        -- the browser's public keys for this subscription
  kinds      text[] not null default '{week}',   -- 'week', 'streak'
  weekday    smallint not null default 5,         -- 1 = Monday … 7 = Sunday
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
)
```

- **The instrument key:** the catalogue slug from `js/links.js` (`handpan/d-kurd`, `ocarina/alto-c-12`) for catalogue instruments, the saved item's id for custom and measured ones. A song learned on a D Kurd is known on every D Kurd the person opens.
- **Merging on two devices:** per field: the higher level, the earlier first week, the later last week, the union of weeks. Nothing is lost by a merge.
- **Weeks, not timestamps:** the songbook keeps ISO weeks only, which is all the streak needs.
- **Moments already seen** go in the synced prefs, not a table.
- **Delete and export:** everything cascades from the account, and Export my data gains the new tables.
- **Guests:** the songbook lives in this tab's `sessionStorage` like the rest of a guest's work (`dataStore()`), and `carryOverVisit` moves it into the account at sign-up.

---

## 8. Email and notifications: what they need

I'm not a lawyer; have the notice wording checked once before the first send.

**Legally (EU):**
- **Consent, separate from the account.** The account is a contract; a weekly email or notification is not needed for it, so each needs its own yes: an unticked switch with the plain promise next to it ("One a week at most. Stop any time."). For push, the browser's own permission comes after the person tapped our button.
- **Proof:** when they said yes and to which wording (`consented_at`, `consent_version`).
- **Every email:** who it is from (Oakhum, Elvis Kvalbergs, the contact address), a one-tap unsubscribe link that works without signing in, and the `List-Unsubscribe` headers. A postal address in the footer if you expect readers in the USA.
- **The privacy notice** changes: new purposes (the weekly email and notifications, if asked for), the sending service as a processor, how to stop. `PRIVACY_VERSION` moves on and "no marketing emails" goes.
- **Honest use:** nothing to people who didn't ask, including "we miss you". No tracking pixels; count returns by the link's `source`.

**Technically:**
- **Email:** a sending service with an EU region (Supabase's mailer is for sign-in codes only), its key in Vercel's environment variables only; a sending domain with SPF, DKIM and DMARC; an unsubscribe page on the website calling `unsubscribe_email(token)`.
- **Push:** a VAPID key pair (public key in the app, private key in Vercel only); the service worker gets `push` and `notificationclick` handlers (it already exists for accounts); `PushManager.subscribe` after the person's tap; subscriptions that fail with "gone" are deleted.
- **One weekly job** in the website project (`site/`, a scheduled route) builds each message from the tune of the week and the person's instruments, songbook and streak, and sends by push or email or both, as chosen.
- **Owner time:** none per week if the rotation is used.

---

## 9. Measurement

### Events (PostHog, cookieless, no ids; `account` = guest or signed in)

| Event | Properties | Answers |
|---|---|---|
| `return_visit` (planned, **never logged**) | days since last (1, 2–7, 8–30, 30+), accounts only | how many come back, after how long |
| `play_end` | kind (song, progression, practice), family, how (play, wait, step), answer (yes, listened, heard), level, first, weekly, account | are people finishing |
| `songbook_add` | family, count bucket (1, 2–4, 5–9, 10+) | is the songbook growing |
| `next_shown` / `next_tap` | reason | does the suggestion work |
| `path_step` | n of 5, maker | where the first five lose people |
| `streak` | weeks (2, 4, 8, 12, 26, 52) | how many keep the habit |
| `moment_shown` / `moment_tap` / `nudge_dismiss` | id | which moments help, which annoy |
| `wait_stuck` | action (skip, tell) | how often the microphone fails a player |
| `drone_play` | family | is the reward used |
| `email_optin` / `remind_on` | channel, where | list growth |
| `open` (exists) gains | source (week, email, push, jam, pwa), and for guests `returning` (first, this-week, 1–4w, 5w+) | which channel brings returns; guest returns |
| `signup_shown` / `signup_done` (exist) gain | what: learned | is achievement a better sign-up moment than Save |

`return_visit` is logged at app start for an account when `profiles.last_seen_on` is not today, from the difference, before `touch_last_seen` overwrites it.

### The retention metric
Counted in SQL from `activity_weeks`, by sign-up week, week 0 being the week the account was made:

- **Second visit:** the share of new accounts with 2+ active days in their first 7 days.
- **Fifth visit:** the share with 5+ active days in their first 30 days.
- **Off the shelf (the headline):** the share active in week 4, and in week 8. "Active" means the app was opened; the stricter line is "finished a song or progression" (`pieces > 0`).
- **Songbook depth:** the share with 5 songs after 30 days.

There is no baseline. Collect four weeks of numbers before judging. As a rough bar for a hobby tool, week-4 activity of 20% of new accounts is worth building on; under 10% says the loop isn't working.

### Returning guests (decision 7)
- **What is stored:** one key on the guest's device, `hp-first-week`, holding the ISO week of the first visit. No id, no random number, nothing sent but the bucket. It is cleared with the browser's site data, and an account doesn't need it.
- **What it gives:** each `open` carries `returning` (first visit, back this week, after 1–4 weeks, after 5+). Together with `source`, that answers whether guests come back at all, and from where.
- **The legal question:** reading or writing anything on someone's device needs consent in the EU unless it is strictly needed for what the person asked for, and counting visits isn't. Some regulators (France's CNIL) exempt anonymous, first-party audience measurement under strict conditions; there is no EU-wide exemption, and the European data protection board reads the rule broadly. A coarse week with no id, used only for aggregate counts and named in the privacy notice, is a low risk, but not zero. The cautious alternative is the first version's: count guests only by `source` and installed-app opens, and accept an undercount.
- **The privacy notice** gets one line: "If you don't have an account, Oakhum keeps one thing on your device: the week you first visited, so we can count how many people come back. It isn't linked to you."

---

## 10. Risks

- **"Did you play along?" is an honour system.** People may say yes to songs they didn't play. That's fine: it's their songbook. It also means the songbook can't be used to rank anyone, which is why there are no leaderboards.
- **Wait for me mishears real instruments** (tested with generated audio only). It is optional, Skip is always there, and each failure can become a report with the recording.
- **Few songs fit some instruments** (22 on a D Kurd). The first five still work; progressions and imported chord sheets are where handpan players grow.
- **Congratulations can tip into noise.** One big moment at a time, one nudge per visit, a switch to turn them off, and `nudge_dismiss` to find the ones that annoy.
- **Sign-up at the finish feels like a ransom.** It doesn't take the moment away: the drone and Next still work, and "Not now" is one tap.
- **The email is asked for and then nothing arrives** if release 2 slips (decision 6).

---

## 11. Build order (after approval)

Each step is its own branch and pull request into `preview`, with tests and `python3 build.py`.

1. **Measurement first:** log `return_visit`; `activity_weeks` and `touch_activity`; `source` and the guest's `returning` on `open`. It starts the baseline before anything changes.
2. **The songbook:** `progress_items`, sync, the pure functions with tests on real tunings of every family (`nextPiece`, `firstFive`, `weekStreak`), the Songs tab's switch.
3. **The finish sheet:** the end of the player, the question, the drone, Next, the `learned` sign-up for guests.
4. **Moments:** `js/moments.js`, the congratulations and nudges, the Settings switch, the pick-up row and banner, Wait for me's stuck line and "Send this take", the email question (with the privacy notice change).
5. **Docs:** `docs/design-system.md` gains the finish sheet, the level badge, the streak line and the moments catalogue as shared patterns; `CLAUDE.md`'s instrument checklist gains "songbook, first five and the finish sheet work for the new instrument".

---

## Owner's decisions (review round 1)

1. **The songbook doesn't depend on the microphone.** The app isn't tested on enough real instruments to make Wait for me a gate. The microphone is a helper that says what was wrong (decision 1, 3.6).
2. **No calendar reminder.** Reminders come as notifications; whether that needs a native app was open (decision 5: web push does it, a native app is a separate decision).
3. **A line in the privacy notice is enough for counting returning guests,** in the owner's view (decision 7, with the caveat in §9).
4. **Streaks, as congratulation and encouragement** (decision 4: weekly, with a rest week).
5. **Recordings:** not every recording stored, but a player who finds a problem can send the take (decision 8: the listening report).
6. **Congratulations and nudges in the app** (decision 9, 3.12).

**Stop here for the owner's review.**
