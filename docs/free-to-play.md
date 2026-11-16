# Free to play, sign up to save

Design for review. No production code until the owner approves it.
Wireframes: `docs/free-to-play-wireframes.html`.

**Review round 1 is done:** the owner's answers are in "Owner's decisions" at the end, and the sections below are updated to match.

Everything in the app stays free. Anyone can play every feature without an account. A free account is needed for three things: **saving**, **syncing across devices** and **offline use**. Right now the goal is to measure real uptake, so the path from a link on the website to playing must be as short as possible.

---

## Phase 1: what the app does today

### Routing
- The app is a single page, built by `build.py` into `index.html`, and **all routing is in the URL hash** (`loadFromHash` in `js/app.js`). Navigation uses `history.pushState`.
- `vercel.json` has `cleanUrls` and no rewrites, so a path such as `/handpan/d-kurd` would get a 404 today.

| Hash | Opens |
|---|---|
| `#scale=D-Kurd[&chord=D-min]` | a handpan scale from the catalogue (62 scales in `SCALES`), optionally with a chord selected |
| `#custom?ding=…&top=…&bottom=…&tc=…&bc=…&name=…` | a custom handpan layout, encoded fully in the link (works without a server) |
| `#i/<instrumentId>/<tab>` | one of *my* instruments (local id, so it only works on the device that has it) |
| `#p/<CODE>` | an instrument someone shared: 6-character code, read from Supabase (`get_shared_instrument`), works signed out, read-only, with "Add to my instruments" |
| `#pl/<id>`, `#prog/<id>` | one of my playlists / progressions |
| `#scales`, `#settings`, `#settings/clay`, `#settings/listen` | screens |

### How you pick an instrument
- **No hash:**
  - On first run with no instruments, the app opens the **wizard** (`openStartView`).
  - Otherwise it opens **My instruments** (home), or goes straight into the only instrument if there is just one.
- **Handpan:**
  - **Picking:** you choose a scale in the selector (`#scales`) and play it straight away.
  - **Saving:** it only becomes "mine" when you tap **Save** (`save-layout` → `hp-layouts`, shown in My instruments as `hp-<id>`). Customize makes a custom layout.
- **Ocarina / flute:** the wizard creates the instrument and **saves it immediately** (`wizard-oc-create`, `wizard-fl-create`). There are three kinds:
  - charted (`TRADITIONAL_CHARTS`: 12-hole ocarina in 36 keys, tin whistle, Native American flutes)
  - custom (holes you set up and measure)
  - scale-built (Build tab)

  There is no way to *try* a charted ocarina without adding it to My instruments.

### Where things are stored
Everything is in `localStorage` first, for everyone. Signing in adds a copy on the server.

| Data | Key on the device | On the server when signed in |
|---|---|---|
| Favourite chords | inside `hp-playlists`: a playlist with id `favorites` (legacy `hp-favorites` migrated) | `user_data.playlists` (one JSON blob per user) |
| Playlists (chords with voicing) | `hp-playlists` | `user_data.playlists` |
| Saved handpan layouts | `hp-layouts` | `user_data.layouts` |
| Ocarinas and flutes (set-up readings, photo as data URL, sharing code) | `hp-instruments` | `instruments` table, one row per instrument |
| Progressions (incl. chord sheets imported as songs) | `hp-progressions` | `user_data.progressions` |
| Settings | `hp-prefs` | `user_data.prefs` |
| Clay bodies, "onboarded" flag | `hp-clay-bodies`, `hp-onboarded` | not synced |

- **Merging:** per item by `updatedAt`, newest wins, and soft deletes (`deletedAt`) travel to other devices (`mergeById`, `mergeInstruments`, `mergeProgressionLists`).
- **When sync runs:** on sign-in, when the app comes back to the foreground, every 30 s while visible, and 1.5–2 s after a change.
- **Arpeggio bookmarks don't exist.** The arpeggio and its playing order (`arpeggioOrder`) are worked out for any chord, but you can't save one separately; you save the chord to a playlist.
- **There is no song library.** "Songs" are chord sheets imported into progressions (`cs-save`).

### Auth
- **Supabase email code** (`signInWithOtp` / `verifyOtp`, 6–8 digits) in **Settings › Sync**. It's optional; it's only needed to sync and to share an instrument.
- **Session:** kept by supabase-js in `localStorage`. The library itself is loaded from the jsDelivr CDN (unpinned `@2`).
- **Sign-out** keeps all data on the device.
- **Data stored:** the email (in Supabase auth), and nothing else about the person.

### Offline today
- **`sw.js` is registered for everyone.**
  - Page loads try the network first and fall back to the cache.
  - Google Fonts are served from the cache first.
- **What works offline (for everyone):** because the whole app is one `index.html` and everything is worked out in the browser (chords, arpeggios, fingerings, tuner, Listen), the whole app works offline after one visit:
  - every catalogue instrument
  - everything saved on the device
- **What doesn't work offline:**
  - sign-in and sync. supabase-js isn't cached, so `initSupabase` quietly does nothing.
  - opening a shared code (`#p/…`)
  - the QR code in Share
- **Offline edits:** changes stay in `localStorage` and are merged at the next sync. There is no queue: the next sync just compares timestamps.

### Every action that saves something today

| Action (data-action) | Saves |
|---|---|
| playlist picker: `show-playlist-picker` → `toggle-playlist-chord`, `confirm-new-playlist` | a chord into Favourites or a playlist; a new playlist |
| `discover-bookmark`, `discover-bookmark-custom` (Identify) | a chord found by Identify into a playlist |
| `update-playlist-entry`, `remove-playlist-chord`, reorder, `pl-name-save`, `delete-playlist`, `hp-clear-playlist` | playlist edits |
| `save-layout` (after `clone-layout` / custom notes) | a handpan into My instruments |
| `wizard-oc-create`, `wizard-fl-create`, `add-instrument` | an ocarina or flute into My instruments (straight away) |
| Set up / Build edits (`b-*`, hole sheet, photo crop `crop-done`, `ie-photo-remove`, `delete-instrument`) | instrument set-up (saved on every change) |
| `shared-add` | a shared instrument copied into My instruments |
| `confirm-new-progression`, `add-to-progression`, `prog-step-*`, `prog-bpm`, `prog-beats`, `prog-level`, `prog-delete`, `pl-copy-progression` | progressions |
| `cs-save` | a chord sheet (song) imported as a progression |
| `share-instrument` | publishes an instrument with a code |
| Settings (theme, flats, speed …), `clay-save`, `hide-sync-tip` | preferences |

Listen step 1 (in [elviskvalbergs-lab/herbe-handpan#14](https://github.com/elviskvalbergs-lab/herbe-handpan/pull/14)) doesn't save anything yet. Saving a heard progression is Listen step 4.

### Places that assume a signed-in user
- `shareInstrument`: "Sign in under Settings › Sync to share".
- Settings › Sync (`syncSettingsHtml`), the "Sync across devices" tip on My instruments, and Check for updates.
- `syncInstrumentsNow`, `syncProgressionsNow`, `checkForUpdates`, `scheduleSave`: all do nothing when signed out.

Nothing else needs an account.

### What this means for the redesign
1. **Today guests can save and play offline.** Under the new model both need an account. There are no current users (owner's decision), so nobody loses anything.
2. **Ocarinas and flutes can only be played after they are *saved*.** The redesign needs a "visiting" instrument for them, like the one shared links already use (`SHARED_ID`).
3. **The current sync stores blobs and merges by timestamp,** with no offline queue and no real conflict handling. That's good enough to build on in the first steps, but not for the "edited offline on two devices" case.

---

## Phase 2: design

### 1. Deep links

Real paths, so the website links read well and work as shared links:

| Link | Opens |
|---|---|
| `/handpan/d-kurd` | D Kurd 9, Pan view |
| `/handpan/d-kurd/chords` · `/handpan/d-kurd/chords/a-min` | its Chords tab · with A minor selected |
| `/handpan/celtic-minor` | the default key (D Celtic Minor) of a scale named without a key |
| `/handpan/f-low-pygmy-11` | scales with a note count keep it in the slug |
| `/ocarina/alto-c-12` | 12-hole ocarina in C (chart `ocarina-12-stl-c`, key `C-A4`) |
| `/ocarina/alto-g-12`, `/ocarina/soprano-c-12`, `/ocarina/bass-c-12` | the same chart in another key and voice (the voice is the octave of the lowest note); `/ocarina/12-hole-g` and `/ocarina/alto-g` are aliases |
| `/flute/tin-whistle-d`, `/flute/naf-6-a4`, `/flute/naf-5-e3`, `/flute/naf-6-in-a-a4` | flutes from the charts (`/flute/naf-6` opens its default key) |
| `/handpan/custom?ding=D3&top=A3,Bb3,C4,D4,E4,F4,G4,A4&bottom=&name=My+pan` | a custom handpan, fully in the link |
| `/s/7KQ2PM` | a shared instrument (any kind, including a measured ocarina with its photo) |

**Rules**
- **Slugs live in one data file, `js/links.js`:** the slug ↔ scale id / chart+key, plus aliases (e.g. `alto-c-12`, `celtic-minor`). A slug never changes or disappears; renames only add an alias. A test checks that every scale and chart key has exactly one canonical slug.
- **Tabs and chords are optional path parts** (`/chords`, `/notes`, `/playlists`, `/listen`). The app keeps the URL in sync while you play, so the address bar is always a link to what you see. The website can link straight to Listen too.
- **Unknown slug:** the instrument picker opens, with "We couldn't find *d-kurdd*, pick one below" and the closest match on top.
- **Vercel:** rewrites `/handpan/*`, `/ocarina/*`, `/flute/*`, `/s/*` to `index.html`. The old hash links (`#scale=`, `#custom?`, `#p/`) keep working: they're read the same way and the URL is replaced with the new path.
- **A deep link opens a *visiting* instrument:** the normal interface with all tabs, not added to My instruments, with a quiet **Save** in the app bar. For ocarinas and flutes this is new (today they're always saved). For handpans it is how scales already behave.
- **Link previews on the website / social:** each link gets its own preview card (title, description, picture of the instrument), added by a small Vercel Routing Middleware in step 1 (owner's decision).

**Sharing custom tunings**
- **Custom handpan:** the long link above. It's stateless, works for guests, and needs no server.
- **Custom or measured ocarina or flute, scale-built ocarina:** too much to put in a link (photo, hole readings). It's shared by code (`/s/CODE`), which stores it on the server, so **sharing needs an account**. It's treated as a save action and shows the same sheet ("Share your instrument: anyone with the link can play it").
- **Opening a shared link:** works for everyone, read-only, with Save ("Add to my instruments").

### 2. Guest experience
- **No wall, no popup on entry.** A deep link opens the instrument ready to play.
- **Opening the app with no link** (e.g. from the home screen) shows **Play**, a one-screen picker. It replaces the first-run wizard:
  - Handpan / Ocarina / Flute
  - the popular tunings
  - "Your own notes" (custom)
  - one tap to playing

  The full wizard stays for building an ocarina from a scale.
- **A guest keeps nothing between visits** (owner's decision: push for sign-up). Opening the app again without a link shows the Play screen. Only the current browser tab remembers its work (in `sessionStorage`), so a sign-in, including the Google redirect, never loses it.
- **The only account mention a guest sees:**
  - a small "Sign in" text button in the app bar on the Play screen
  - the save sheet when they tap save
  - the offline message

### 3. The save moment
Any save action by a guest opens one **light bottom sheet**, the same shared `uiSheet`, so it looks the same everywhere. It has:
- a headline and one benefit line, matched to what was tapped
- "Free · takes seconds · also lets you play offline"
- sign-in buttons
- "Not now"

| Tapped | Headline | Line |
|---|---|---|
| ☆ a chord / add to Favourites | Keep this chord | Keep your favourite chords one tap away, on any device. |
| add a chord to a playlist / new playlist | Start a playlist | Put the chords for a song together and play them on any device. |
| Save a handpan / ocarina / flute, Add a shared instrument | Save your instrument | Set up your instrument once. It's ready every time, on every device. |
| Save a heard progression (Listen) | Keep what you heard | Save this progression and play along with it any time. |
| Import a chord sheet / new progression | Save this song | Keep the song's chords and play along any time, on any device. |
| Share an instrument | Share your instrument | Anyone with the link can play it. Your setup stays yours. |

- **After sign-in, the started action is completed automatically.**
  - The sheet closes and the chord is starred, the instrument saved, and so on.
  - A toast confirms it ("Saved to Favourites"), with the same toast as today and an Undo where it makes sense.
  - The intent is kept as `{action, payload, path}` in `sessionStorage`, so it survives the Google redirect or a magic link opened in the same browser.
- **"Not now":** closes the sheet; nothing is lost and the screen stays as it was. If they tap save again, the sheet shows again (no nagging beyond that).
- **Arpeggios are saved with their chord.** A playlist keeps the chord, and its arpeggio and playing order come with it (owner's decision). The arpeggio player gets the same ☆ / add-to-playlist button as the chord card, so it uses the playlist text above.
- **Leaving unsaved work:** a guest who built something (custom notes, a measured ocarina or flute, a scale-built ocarina) and leaves it (back to Play, or closes the tab) sees the save sheet once: "Save your instrument? Without a free account it's gone when you close this page." Closing the tab only gets the browser's own "Leave site?" prompt.
- **Settings, theme and clay bodies aren't save actions.** They stay on the device for guests and sync for accounts.

### 4. Offline, for accounts only
**What works offline once signed in:**
- the whole app, because everything is worked out on the device:
  - every instrument and tuning, not just saved ones
  - chords, arpeggios and their order
  - tuner, Listen and Play along
- all saved items: instruments, Favourites, playlists, progressions/songs

**What doesn't work offline:** signing in, account settings (export, delete), opening someone else's shared code for the first time, and the QR image.

**Songs:** there is no song library yet, and "songs" are the user's own progressions, so they are all cached. When a catalogue comes, cache **only the songs in their playlists or progressions, plus the last 20 opened**, not the whole library.

**Turning it on and off**
- **The service worker is registered only after sign-in.** It precaches `index.html`, a **pinned** supabase-js version, the fonts, icons and manifest, and answers every deep-link path with the cached app.
- **On sign-out:**
  - unregister the service worker and delete its caches
  - clear the saved data from this device (after warning if changes haven't synced yet)
- **Guests on the new version:** a guest who still has the old service worker has it removed on their next online visit (a cleanup step in `offline.js`; there are no existing users to migrate).

**Status, clear but quiet**
- **While offline:** a small `cloud-off` "Offline" pill sits in the app bar. It isn't a banner and doesn't cover anything.
- **Pending changes:** Settings › Account shows "3 changes will sync when you're online".
- **Back online:** the pill goes away, and a toast says "Synced" only if there were pending changes.

**Edits on two devices while offline**
- **Merged per item and per field,** not "last device wins" for the whole item:
  - Two different chords added to the same playlist on phone and tablet: both are kept.
  - A chord removed on one device and the playlist renamed on the other: both changes apply.
  - The same field changed on both devices (e.g. the playlist name): the later edit wins.
  - Deleted on one device, edited later on the other: the edit wins and the item comes back. Deleted after the edit: it stays deleted.
- **One exception, instrument setups:** these are a lot of work (hole readings, finger maps). If both devices changed the **same** readings, nothing is thrown away. The newer one stays as the instrument and the other becomes "D Kurd (from your tablet)" in My instruments, with a one-time note.

**A guest who loses connection**
- **The page they're on keeps working,** because the app is already loaded and runs on the device. Nothing reloads and nothing is lost.
- **A friendly card slides in at the bottom:** "You're offline. You can keep playing here. To open the app offline any time, create a free account; it takes seconds."
  - **[Remind me when I'm back online]** shows the sign-up sheet (with the "offline" text) when the connection returns.
  - **[OK]** closes it.
- **Honest limit:** if a guest *reloads* while offline, the browser shows its own error page, because there is no service worker to show ours.

### 5. Carry-over (guest → account)
Guests keep nothing between visits. **Within one visit**, the current tab holds the guest's work in memory, mirrored to `sessionStorage` (cleared when the tab closes):
- the instrument on screen, and any instrument built in this visit (custom notes, set-up readings, a scale-built ocarina)
- a progression heard with Listen, and a chord sheet being imported
- the action they started (§3)

On sign-up or sign-in in that tab:
1. the started action is completed (§3)
2. then everything built in this visit is **moved into the account automatically**, and a toast says "Also saved: Low D ocarina"

If the account already has an item with the same id, both are kept.

### 6. Sign-up methods (no passwords)
- **Email code (already built), plus a link in the same email.**
  - The code is the main path because it works inside an installed app. On iPhone, a link in an email opens in Safari, not in the installed app.
  - The link is for people on the same browser.
  - It's one field, then 6 digits.
- **Continue with Google:** one tap on Android and desktop. Supabase supports it; it needs a Google Cloud OAuth client (owner task).
- **Continue with Apple:** natural on iPhone. The owner has access to an Apple Developer account, so it goes in step 2 next to Google once the owner has created the Services ID and key in Apple's developer site (the steps go in `supabase/README.md`). If that isn't ready, step 2 ships with Google and email, and Apple follows without design changes.
- **Passkeys:** later.
- **One sheet holds all of it:** [Continue with Google], [Continue with Apple], a separator, an email field with [Send code], then the code field in the same sheet. A new account and a returning account go through exactly the same steps; there's no "sign up" vs "log in" choice.

### 7. Signed in: where things live
- **My instruments (home) stays the hub.** In order:
  1. **Continue: <last instrument>**, a big row at the top
  2. **My instruments**
  3. **Favourites**: chords; as today, a pinned playlist with its own row
  4. **Playlists**
  5. **Progressions & songs**
  6. **Play something else** (the catalogue)

  Inside an instrument, the Playlists tab shows the items for that instrument, as today.
- **Returning user:** the app opens straight into the **last instrument and tab**. It's stored in the synced prefs, so a second device also opens where you left off, with the first sync shown as "Getting your things…" in the app bar for a moment.
- **Settings › Sync becomes Settings › Account:** email, sync status, pending changes, offline "Ready", Export my data, Sign out, Delete account, Privacy notice.

### 8. Account basics and GDPR
- **Minimal data:** email address only (plus what the person saves). No name, no birthday, no profiling, no marketing emails (no opt-in in this version).
- **Legal basis:** creating an account is a contract ("to keep your things and sync them"), so no consent box is needed. The sign-up sheet says, under the buttons: "Free. We only keep your email and what you save. Privacy notice." It's a link, not a checkbox.
- **Privacy notice** (`/privacy`, plain language), covering:
  - what we keep and why
  - processors: Supabase (database and auth, EU region, confirmed), Vercel (hosting), Google (only if you sign in with Google), the analytics tool
  - how long data is kept: until you delete the account; accounts with no use for 24 months are deleted after an email warning
  - your rights, and the contact: Elvis Kvalbergs (the owner), oakhummusic@gmail.com
- **Export my data:** downloads one JSON file of everything the account holds (instruments with photos, playlists, progressions, prefs). It's built in the browser from the person's own rows.
- **Delete account:**
  1. confirm in a sheet (type DELETE)
  2. a database function (`delete_my_account`, security definer, only `auth.uid()`) deletes the user, and every row goes with it (`on delete cascade`)
  3. this device is cleared and the service worker removed
- **Sign out:** clears this device (§4). If changes haven't synced, it says so and offers to wait.
- **Analytics:** no cookies and no stored id, so it needs no consent banner (§9). Session replays, later, only with an opt-in.

### 9. Measurement (privacy-friendly)
**Tool: PostHog, EU cloud (Frankfurt), free tier** (owner's decision, review round 2). It replaces the first plan, our own `events` table, which was never merged: it gave counts but no heatmaps, and the owner wants to see where people tap.
- **Free tier:** about 1M events a month for the whole PostHog organisation (all its projects share it), far above what we need. Project: Oakhum (EU, id 352395).
- **Set up for no consent banner:** cookieless mode (`cookieless_mode: 'always'`, also switched on in the project settings): nothing is stored on the device, and PostHog's server counts unique visitors with a hash of IP and browser that changes daily. "Discard client IP data" is on, so no IPs are kept; the cost is no country data. No person profiles for guests, session recording off.
- **What we get:** the events below, autocaptured taps (heatmaps per screen; every instrument and tab has its own URL), funnels and sources. Errors, replays and performance are **not** in PostHog: they go to Sentry, which the owner uses everywhere else (round 3). In PostHog, error capture, web vitals and session replay are off.
- **Claude reads it** through the PostHog MCP connector: a weekly usage review, and later feature flags and experiments (each started only with the owner's OK).
- **Not yet:** session replays (in Sentry, error sessions only). They need consent; an opt-in comes with Settings › Account (step 3).
- **Return visits** can't be seen without a stored id; for accounts, `profiles.last_seen_on` counts them.
- **Privacy notice:** names PostHog (a US company, data stored in the EU) as a processor.
- **Code:** `logEvent(name, props)` in `js/auth.js`. It does nothing until `_PH_KEY` (the project's public key) is filled in.

**Events** (no ids, no email; `account` = guest or signed in):

| Event | Properties | Answers |
|---|---|---|
| `open` | path (the deep link), referrer domain, utm | which links bring people in |
| `first_play` | instrument family, seconds from landing | how short landing → playing is |
| `feature` | name (chords, arpeggio, listen, play-along, tuner, chord-sheet, custom-notes), account | which features guests use |
| `save_tap` | what (chord, playlist, instrument, progression, song, share, leave-unsaved), account | how many tap save |
| `signup_shown` / `signup_method` | what · method (google, email, apple) | where they drop |
| `signup_done` | what, method, new or returning | how many complete |
| `save_completed` | what | that the started action finished |
| `return_visit` | days since last (bucket: 1, 2–7, 8–30, 30+), accounts only | how many come back |
| `offline_session` | (signed in) | how many use it offline; queued and sent when back online |
| `guest_offline` | shown, remind tapped | |

- **Returns:** for accounts, a daily `last_seen_on` date in `profiles` gives exact return counts in SQL, without tracking anyone.
- **Guest returns** can't be counted, because guests keep nothing between visits and we don't use identifiers. That's by design: the number that matters is sign-ups, and returns are counted for accounts.

### User flows
See the wireframes for each screen.
1. **First visit from a website link:**
   1. website → `/handpan/d-kurd`
   2. app opens on D Kurd, Pan view, ready to play (wireframe 1)
   3. they tap notes, Chords, Listen; nothing asks for anything
2. **The save moment:**
   1. ☆ on A minor
   2. sheet "Keep this chord" (wireframe 2)
   3. Continue with Google, or email → code (wireframe 3)
   4. the sheet closes, the chord is starred, toast "Saved to Favourites" (wireframe 4)
   5. the guest's built instruments are moved in as well (toast)
3. **Sign-up:** the same as 2 from Settings › Account or the Play screen's "Sign in", without a pending action.
4. **Returning user on a second device:**
   1. they open the app; the guest Play screen shows
   2. Sign in → email code
   3. "Getting your things…"
   4. it opens on their last instrument and tab; My instruments, Favourites and playlists are there (wireframe 6)
   5. offline is now ready on this device too
5. **Going offline when signed in:**
   1. the "Offline" pill appears (wireframe 7)
   2. everything keeps working; edits are queued ("2 changes will sync")
   3. back online: they sync, the pill goes, toast "Synced"
6. **Going offline as a guest:**
   1. the card slides in (wireframe 8)
   2. they keep playing on the same screen
   3. "Remind me" → when the connection returns, the sign-up sheet with the "offline" text

### Data model (Supabase, additive)
New tables and functions only. `user_data` and `instruments` stay as they are and keep working during the move.

```sql
-- One row per person: no personal data beyond what auth already holds.
profiles (
  user_id        uuid primary key references auth.users on delete cascade,
  created_at     timestamptz default now(),
  privacy_version text,            -- the notice version shown at sign-up
  signup_source  text,             -- e.g. '/handpan/d-kurd' (path only)
  signup_intent  text,             -- e.g. 'chord', 'instrument'
  last_seen_on   date              -- updated at most once a day
)

-- Everything a person saves, one row per item.
saved_items (
  owner_id   uuid references auth.users on delete cascade default auth.uid(),
  kind       text check (kind in ('playlist','progression','layout','instrument','prefs')),
  id         text,
  data       jsonb not null,
  version    bigint not null default 1,         -- bumped by the server on every write
  updated_at timestamptz not null default now(),-- server time
  edited_at  timestamptz,                       -- device time of the edit (for "later edit wins")
  device_id  text,                              -- random per install, only to name "from your tablet"
  deleted_at timestamptz,
  primary key (owner_id, kind, id)
)  -- row-level security: owner only, like instruments

save_item(kind, id, data, base_version, deleted) returns (ok, version, current_row)
  -- writes only if base_version matches; otherwise returns the current row for merging
delete_my_account()  -- deletes auth.users row for auth.uid(); cascades
touch_last_seen()    -- sets profiles.last_seen_on = today

-- Measurement (§9) is in PostHog, not in the database.
```

- **Favourites:** a playlist with id `favorites`, as today.
- **Shared codes keep working:** an instrument shared by code stays in the existing `instruments` table (that's what `get_shared_instrument` reads). It is written to both tables until all clients use `saved_items`.

### Owner's decisions (review round 1)
1. **There are no current users,** so nothing needs migrating. The old offline mode is simply removed for guests.
2. **Arpeggios are saved through playlists.** A saved chord carries its arpeggio, so there's no separate collection.
3. **No guest recents.** Push for sign-up: guests keep nothing between visits, only within the open tab (§2, §5), and leaving unsaved work shows the save sheet once.
4. **Apple sign-in is possible** (the owner has access to a developer account). It's planned for step 2 if the Apple keys are ready.
5. **No paid analytics:** PostHog's free tier, EU cloud (§9; round 2 replaced the own-database plan).
6. **The Supabase project is in the EU.**
7. **Link preview cards per instrument: yes** (step 1).
8. **The privacy contact is the owner,** Elvis Kvalbergs. The contact email is oakhummusic@gmail.com.

---

## Phase 3: technical plan

### Interfaces (features never know who's signed in or online)

```js
// js/account.js — who is signed in
account.state            // 'guest' | 'signed-in'
account.onChange(fn)
account.signInWithEmail(email) / verifyCode(code) / signInWithGoogle()
account.signOut()        // flush or warn, clear device, offline off
account.exportData() / deleteAccount()

// js/store.js — the only way features save
await save(intent, apply)
//   intent: { what: 'chord' | 'playlist' | 'instrument' | 'progression' | 'song' | 'share', payload, path }
//   apply:  () => the local change (the existing storage.js / instruments.js call)
//   guest  → opens the save sheet; resolves after sign-in and apply(), or rejects on Not now
//   signed → apply(), queue the change, resolve at once (online or not)

// js/sync.js — pure merge + outbox; no DOM
outbox.add({kind, id, base, item}) · outbox.flush() · pull() · merge3(kind, base, mine, theirs)

// js/offline.js — the service worker on/off and status
offline.enable() · offline.disable() · offline.status   // 'online' | 'offline' · pending count

// js/links.js — pure: path ↔ instrument
linkFor(instrument, {tab, chord}) · parseLink(path) → { family, scaleId | chartId+key | custom | code, tab, chord }
```

Every save action in the table above changes from `toggleChord(...)` to `save({what:'chord', payload}, () => toggleChord(...))`, a one-line wrap at each place. The existing `storage.js` and `instruments.js` functions stay as the local layer.

### Auth provider
**Keep Supabase Auth** (already used, EU-hostable, free tier).
- **Email:** OTP code plus a link in the same email template.
- **Google:** OAuth.
- **Apple:** in step 2 if the keys are ready.
- **No passwords.**
- **supabase-js:** pinned to an exact version and precached by the service worker.

### Storage and sync
- **On the device:** keep `localStorage` for the first steps. In the sync step, move saved items and the outbox to **IndexedDB**, because photos make `localStorage`'s ~5 MB limit a real risk.
- **The outbox:** each change is stored as `{kind, id, base (the version and copy it started from), item}`.
- **Flushing:** the outbox is flushed when back online, on visibility, and after a change, through `save_item` with `base_version`.
  - If the server version moved on, the reply carries the current row. The client does a **three-way merge** (base, mine, theirs) with the rules in §4 and retries.
  - Instrument setups that clash on the same readings become a copy.
- **Pull:** rows with `updated_at > last pull`.
- **Clock skew:** "later edit wins" uses the device's `edited_at` only to break ties between two edits of the *same field*. Ordering of writes uses the server's `version`.

### Offline caching
- `sw.js` gets a **versioned cache name** (build.py writes a hash of `index.html` into it).
- **Precache:** `/`, `index.html`, supabase-js (pinned), fonts, icons, `manifest.json`.
- **Page loads:** any page load (including `/handpan/…`) tries the network first and falls back to the cached `index.html`.
- **Service worker on and off:**
  - It's registered only when `account.state === 'signed-in'`.
  - On every app start as a guest, any existing registration is removed and its caches deleted. That covers guests from the old version, and a sign-out in another tab.

### Migration
- **There are no existing users** (owner's decision), so there's no data migration. `user_data` and `instruments` stay as they are (the additive rule) and are no longer written by the new code, except `instruments` for shared codes.
- **Old links:** hash links (`#scale=`, `#custom?`, `#p/`, `#i/`) keep working.
- **Old offline mode:** a browser that still has the old service worker as a guest has it removed on its next visit.

---

## Phase 4: implementation plan, smallest useful first

Each step is its own branch and PR into `preview`, with tests, `python3 build.py`, and docs updated.

1. **Deep links and visiting instruments**: **built** (`js/links.js`, `middleware.js`, `og/`, `supabase/migrations/20261115_events.sql`, `tests/links.test.mjs`)
   - Build:
     - `js/links.js` with slugs and aliases
     - Vercel rewrites
     - path routing (old hashes still work)
     - a visiting ocarina or flute with a Save button
     - the Play screen instead of the first-run wizard
     - the URL kept in sync while playing
     - preview cards per link: a Vercel Routing Middleware (`middleware.js`, works without a framework) that puts the instrument's title, description and an image into `<title>` and the `og:` tags of `index.html`
     - the `open` / `first_play` / `feature` events through `logEvent` (PostHog, off until the key is set)
   - Tests: preview tags for a scale, a chart and an unknown slug; every catalogue scale and chart key round-trips `linkFor` ↔ `parseLink`; aliases (`alto-c-12`, `celtic-minor`); unknown slugs; custom handpan links; old hash links; opening `/handpan/d-kurd/chords/a-min` gives D Kurd on Chords with A minor selected (e2e).
2. **Save sheet, starting with favourite chords**: **built** (`js/store.js`, `js/datastore.js`, the save sheet in `js/app.js`, `supabase/migrations/20261116_accounts.sql`)
   - Build:
     - `store.save` / `account` (email code + Google, plus Apple if the keys are ready)
     - the save sheet with its per-action text
     - the started action completed after sign-in, including after the Google redirect
     - the profile row
     - the `save_tap` / `signup_*` events
   - Tests: a guest ☆ → sheet → (stubbed) sign-in → the chord is in Favourites; Not now changes nothing; the pending action survives a reload.
3. **All save actions, carry-over and account basics**: **built** (`SAVE_ACTIONS` in `js/store.js`, `carryOverVisit` in `js/datastore.js`, Settings › Account)
   - Build:
     - every save action in the table goes through `save`
     - work from this visit (`sessionStorage`) and carry-over on sign-up, plus the save sheet on leaving unsaved work
     - Settings › Account
     - export, delete account, privacy notice
     - sign-out clears the device
   - Tests: a guest builds an ocarina setup, signs up, and it's in My instruments; export contains everything; sign-out leaves no saved data.
4. **Sync by item, with an outbox and merging**: **built** (`js/sync.js`, `js/localdb.js`, `tests/sync.test.mjs`)
   - Build:
     - `saved_items` + `save_item`
     - IndexedDB store + outbox
     - three-way merge
     - last instrument synced
   - Tests (pure, on `merge3` and the outbox, with two simulated sessions):
     - adds on both devices are both kept
     - remove + rename both apply
     - the same field takes the later edit
     - delete vs a later edit
     - an instrument setup clash makes a copy
     - offline edits flush on reconnect
     - a second device gets everything
5. **Offline for accounts**: **built** (`js/offline.js`, `sw.js`, `tests/e2e/accounts.e2e.mjs`)
   - Build:
     - service worker on only when signed in, versioned precache
     - the Offline pill and pending count
     - the guest offline card and "remind me"
     - removal of the service worker for guests and on sign-out
     - `offline_session` events
   - Tests (Playwright):
     - signed in, go offline, reload: the app and saved items work
     - edit offline, go online: it syncs
     - sign out: no service worker, no caches, no saved data
     - guest goes offline: the card shows and the screen keeps its state
6. **Later:** passkeys, and a read-only Stats page for the owner.

### How steps 2–5 were built (notes for the next change)
- **Guest storage:** `dataStore()` (`js/datastore.js`) is `localStorage` when an account is on the device (`hp-account`) and this tab's `sessionStorage` for a guest, for the four saved lists. Settings and clay bodies stay in `localStorage` for everyone. A session from the old version counts as an account on first load.
- **Saving:** a guest's tap on an action in `SAVE_ACTIONS` opens the save sheet and keeps `{ what, action, data, path }` in `sessionStorage`; after sign-in the same action runs again (now with an account). Chords go through the playlist picker, which for a guest turns into the sheet; after sign-in the chord goes into Favourites (the entry is plain data, so it survives the Google redirect). Building an instrument isn't a save: a guest builds it in this visit, sees "Not saved · gone when you close this page" with Save, and the sheet once when leaving it.
- **Carry-over:** `carryOverVisit()` moves the tab's lists into the account; a clashing id is kept under a new id, Favourites' chords are joined.
- **Sync:** one row per item in `saved_items`, written only through `save_item` (optimistic version). The outbox is the difference between each item and its base (the last copy the server confirmed, in IndexedDB, `js/localdb.js`), so an offline edit survives a reload without being queued anywhere. Conflicts merge with `merge3` and are retried. Handpan instruments aren't synced (they're made from layouts). Shared instruments are also written to `instruments`, which serves the codes. The old `user_data` blob sync is no longer written.
- **Prefs** sync as one item, `prefs`, including `lastPath`: an account opens where it left off, on any device.
- **Offline:** `sw.js?v=<build hash>` is registered after sign-in only; it precaches the page, icons, fonts and the pinned supabase-js (2.49.4), and answers every page load (deep links too) with the cached app when offline. Guests and sign-out remove it and its caches.
- **Building ocarinas is for chosen accounts:** `profiles.can_build` (default off, ticked by the owner in Supabase) shows the wizard's "I'm making one", the Build tab and Settings › Clay bodies; everyone else never sees them. The app keeps the flag on the device (`hp-can-build`) so it works offline, and drops it at sign-out.
- **Not yet:** Google and Apple sign-in show once switched on in Supabase (owner task, `supabase/README.md`). Saving a heard progression comes with Listen step 4 (its sheet text, `heard`, is ready).

**Stop here for the owner's review.**
