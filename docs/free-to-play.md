# Free to play, sign up to save

Design for review. No production code until the owner approves it.
Wireframes: `docs/free-to-play-wireframes.html`.

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
1. **Today guests can save and play offline.** Under the new model both need an account, so current users without an account lose something. They must keep what they already saved (see Migration).
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
| `/ocarina/12-hole/g` | the same chart in another key |
| `/flute/tin-whistle-d`, `/flute/naf-6/a4`, `/flute/naf-5-pentatonic/e3` | flutes from the charts |
| `/handpan/custom?ding=D3&top=A3,Bb3,C4,D4,E4,F4,G4,A4&bottom=&name=My+pan` | a custom handpan, fully in the link |
| `/s/7KQ2PM` | a shared instrument (any kind, including a measured ocarina with its photo) |

**Rules**
- **Slugs live in one data file, `js/links.js`:** the slug ↔ scale id / chart+key, plus aliases (e.g. `alto-c-12`, `celtic-minor`). A slug never changes or disappears; renames only add an alias. A test checks that every scale and chart key has exactly one canonical slug.
- **Tabs and chords are optional path parts** (`/chords`, `/notes`, `/playlists`, `/listen`). The app keeps the URL in sync while you play, so the address bar is always a link to what you see. The website can link straight to Listen too.
- **Unknown slug:** the instrument picker opens, with "We couldn't find *d-kurdd*, pick one below" and the closest match on top.
- **Vercel:** rewrites `/handpan/*`, `/ocarina/*`, `/flute/*`, `/s/*` to `index.html`. The old hash links (`#scale=`, `#custom?`, `#p/`) keep working: they're read the same way and the URL is replaced with the new path.
- **A deep link opens a *visiting* instrument:** the normal interface with all tabs, not added to My instruments, with a quiet **Save** in the app bar. For ocarinas and flutes this is new (today they're always saved). For handpans it is how scales already behave.
- **Link previews on the website / social:** the page title is set per instrument in the browser. Proper preview cards (Open Graph per link) need a small server step (Vercel Edge Middleware rewriting `<title>`/`og:` tags). I've left that out of the first version (open question 7).

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
- **A guest keeps a few things on this device** (see Carry-over): the last instrument, a setup in progress, recent chords. That way, opening the app again lands where they left off. These aren't saves: they aren't synced, they're listed as "Recent", and they expire.
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
| bookmark an arpeggio (see open question 2) | Start your arpeggio collection | Keep the arpeggios you're learning, in their playing order. |
| Save a handpan / ocarina / flute, Add a shared instrument | Save your instrument | Set up your instrument once. It's ready every time, on every device. |
| Save a heard progression (Listen) | Keep what you heard | Save this progression and play along with it any time. |
| Import a chord sheet / new progression | Save this song | Keep the song's chords and play along any time, on any device. |
| Share an instrument | Share your instrument | Anyone with the link can play it. Your setup stays yours. |

- **After sign-in, the started action is completed automatically.**
  - The sheet closes and the chord is starred, the instrument saved, and so on.
  - A toast confirms it ("Saved to Favourites"), with the same toast as today and an Undo where it makes sense.
  - The intent is kept as `{action, payload, path}` in `sessionStorage`, so it survives the Google redirect or a magic link opened in the same browser.
- **"Not now":** closes the sheet; nothing is lost and the screen stays as it was. If they tap save again, the sheet shows again (no nagging beyond that).
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
- **Guests on the new version:** a guest who still has the old service worker has it removed on their next online visit (see Migration).

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
A guest's device keeps **guest data** (`hp-guest` in `localStorage`, 30 days since last use, never synced):
- the last instrument and tab (so returning lands there)
- instruments they built but didn't save: custom handpan notes, an ocarina or flute set up with readings, a scale-built ocarina in progress
- recent chords (last 20) and the last heard progressions from Listen (last 3)

On sign-up or sign-in **on that device**:
1. the started action is completed (§3)
2. then everything the guest built (instruments in progress, heard progressions) is **moved into the account automatically**, and a toast says "Also saved: Low D ocarina, 1 heard progression"
3. recents become the account's recents

Nothing is asked and nothing is lost. If the account already has an item with the same id, both are kept.

### 6. Sign-up methods (no passwords)
- **Email code (already built), plus a link in the same email.**
  - The code is the main path because it works inside an installed app. On iPhone, a link in an email opens in Safari, not in the installed app.
  - The link is for people on the same browser.
  - It's one field, then 6 digits.
- **Continue with Google:** one tap on Android and desktop. Supabase supports it; it needs a Google Cloud OAuth client (owner task).
- **Continue with Apple:** natural on iPhone, but it needs a paid Apple Developer account and Apple's key setup. I suggest adding it in a later step if the numbers show iPhone users dropping off at sign-up (open question 4).
- **Passkeys:** later.
- **One sheet holds all of it:** [Continue with Google], [Continue with Apple] (later), a separator, an email field with [Send code], then the code field in the same sheet. A new account and a returning account go through exactly the same steps; there's no "sign up" vs "log in" choice.

### 7. Signed in: where things live
- **My instruments (home) stays the hub.** In order:
  1. **Continue: <last instrument>**, a big row at the top
  2. **My instruments**
  3. **Favourites**: chords; as today, a pinned playlist with its own row
  4. **Arpeggios**, if open question 2 is yes
  5. **Playlists**
  6. **Progressions & songs**
  7. **Play something else** (the catalogue)

  Inside an instrument, the Playlists tab shows the items for that instrument, as today.
- **Returning user:** the app opens straight into the **last instrument and tab**. It's stored in the synced prefs, so a second device also opens where you left off, with the first sync shown as "Getting your things…" in the app bar for a moment.
- **Settings › Sync becomes Settings › Account:** email, sync status, pending changes, offline "Ready", Export my data, Sign out, Delete account, Privacy notice.

### 8. Account basics and GDPR
- **Minimal data:** email address only (plus what the person saves). No name, no birthday, no profiling, no marketing emails (no opt-in in this version).
- **Legal basis:** creating an account is a contract ("to keep your things and sync them"), so no consent box is needed. The sign-up sheet says, under the buttons: "Free. We only keep your email and what you save. Privacy notice." It's a link, not a checkbox.
- **Privacy notice** (`/privacy`, plain language), covering:
  - what we keep and why
  - processors: Supabase (database and auth, EU region to be confirmed, open question 6), Vercel (hosting), Google (only if you sign in with Google), the analytics tool
  - how long data is kept: until you delete the account; accounts with no use for 24 months are deleted after an email warning
  - your rights, and a contact address
- **Export my data:** downloads one JSON file of everything the account holds (instruments with photos, playlists, progressions, prefs). It's built in the browser from the person's own rows.
- **Delete account:**
  1. confirm in a sheet (type DELETE)
  2. a database function (`delete_my_account`, security definer, only `auth.uid()`) deletes the user, and every row goes with it (`on delete cascade`)
  3. this device is cleared and the service worker removed
- **Sign out:** clears this device (§4). If changes haven't synced, it says so and offers to wait.
- **Analytics:** no cookies or personal data, so it needs no consent banner (§9).

### 9. Measurement (privacy-friendly)
**Tool: Plausible Analytics (EU-hosted, cookieless, no personal data).**
- **Why Plausible:**
  - It has custom events with properties, funnels, and `utm` / deep-link sources.
  - It needs no consent banner.
  - It costs about €9 a month.
- **Alternatives:**
  - Umami, self-hosted: free, but someone has to run it.
  - Vercel Web Analytics: custom events need the Pro plan, and it has no funnels.

**Events** (no ids, no email; `account` = guest or signed in):

| Event | Properties | Answers |
|---|---|---|
| pageview | path (the deep link), referrer, utm | which links bring people in |
| `first_play` | instrument family, seconds from landing | how short landing → playing is |
| `feature` | name (chords, arpeggio, listen, play-along, tuner, chord-sheet, custom-notes), account | which features guests use |
| `save_tap` | what (chord, playlist, arpeggio, instrument, progression, song, share), account | how many tap save |
| `signup_shown` / `signup_method` | what · method (google, email, apple) | where they drop |
| `signup_done` | what, method, new or returning | how many complete |
| `save_completed` | what | that the started action finished |
| `return_visit` | account, days since last (bucket: 1, 2–7, 8–30, 30+) | how many come back |
| `offline_session` | (signed in) | how many use it offline; queued and sent when back online |
| `guest_offline` | shown, remind tapped | |

- **Returns:** for accounts, a daily `last_seen_on` date in `profiles` gives exact return counts in SQL, without tracking anyone.
- **Guest returns** come from the `days since last` bucket, which the device works out from its own guest data. Nothing that identifies the device is sent.

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
  kind       text check (kind in ('playlist','progression','layout','instrument','arpeggio','prefs','recents')),
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
```

- **Favourites:** a playlist with id `favorites`, as today.
- **Arpeggio bookmarks** (if wanted): `kind = 'arpeggio'`, each holding `{instrumentId, chordId, notes, order}`.
- **Shared codes keep working:** an instrument shared by code stays in the existing `instruments` table (that's what `get_shared_instrument` reads). It is written to both tables until all clients use `saved_items`.

### Open questions for the owner
1. **Current users without an account** have instruments and playlists on their device today. **Proposal:**
   - Their data stays usable on that device.
   - One quiet card on My instruments: "Your instruments are only on this phone. A free account keeps them safe and on all your devices."
   - New saves need an account.
   - They lose offline unless they sign up.

   OK, or should existing users keep offline too?
2. **"Bookmarked arpeggios" don't exist yet** (you can save the chord, and the arpeggio is worked out from it). Shall I add an **Arpeggios** collection (a ☆ in the arpeggio player), or should "bookmark an arpeggio" mean saving the chord to Favourites?
3. **Guest "recents" on the device** (last instrument, setup in progress, recent chords, 30 days): OK? They aren't saves, but they make a returning guest land where they left off and make carry-over possible.
4. **Sign-in methods for the first version: email code + Google, Apple later.** Google needs an OAuth client in Google Cloud; Apple needs the Apple Developer account. Do you have one?
5. **Analytics: Plausible (paid, EU) or self-hosted Umami (free)?**
6. **Which region is the Supabase project in?** For the privacy notice it should be in the EU (if not, a new EU project and a move).
7. **Do link previews on social media and messaging (Open Graph cards per instrument) matter for the website launch?** If so, I add a small Vercel Edge Middleware step.
8. **Who is the contact for the privacy notice** (name/company and email)?
9. **Sharing a measured ocarina needs an account** (it's stored on the server). OK?

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
//   intent: { what: 'chord' | 'playlist' | 'arpeggio' | 'instrument' | 'progression' | 'song' | 'share', payload, path }
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
- **Apple:** later.
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

### Migration (no one loses anything)
- **Signed-in users:** on first run of the new version, their `user_data` blobs and `instruments` rows are copied into `saved_items` once (marked done in `profiles`). The old columns stay untouched (additive rule).
- **Users without an account:** their local data is kept and usable (open question 1). On sign-up it's moved in, like carry-over.
- **Old links:** hash links (`#scale=`, `#custom?`, `#p/`, `#i/`) keep working.

---

## Phase 4: implementation plan, smallest useful first

Each step is its own branch and PR into `preview`, with tests, `python3 build.py`, and docs updated.

1. **Deep links and visiting instruments**
   - Build:
     - `js/links.js` with slugs and aliases
     - Vercel rewrites
     - path routing (old hashes still work)
     - a visiting ocarina or flute with a Save button
     - the Play screen instead of the first-run wizard
     - the URL kept in sync while playing
     - Plausible pageview and `first_play`
   - Tests: every catalogue scale and chart key round-trips `linkFor` ↔ `parseLink`; aliases (`alto-c-12`, `celtic-minor`); unknown slugs; custom handpan links; old hash links; opening `/handpan/d-kurd/chords/a-min` gives D Kurd on Chords with A minor selected (e2e).
2. **Save sheet, starting with favourite chords**
   - Build:
     - `store.save` / `account` (email code + Google)
     - the save sheet with its per-action text
     - the started action completed after sign-in, including after the Google redirect
     - the profile row
     - the `save_tap` / `signup_*` events
     - migration of existing local data (kept)
   - Tests: a guest ☆ → sheet → (stubbed) sign-in → the chord is in Favourites; Not now changes nothing; the pending action survives a reload.
3. **All save actions, carry-over and account basics**
   - Build:
     - every save action in the table goes through `save`
     - guest data (`hp-guest`) and carry-over on sign-up
     - Settings › Account
     - export, delete account, privacy notice
     - sign-out clears the device
   - Tests: a guest builds an ocarina setup, signs up, and it's in My instruments; export contains everything; sign-out leaves no saved data.
4. **Sync by item, with an outbox and merging**
   - Build:
     - `saved_items` + `save_item`
     - IndexedDB store + outbox
     - three-way merge
     - migration from `user_data`
     - last instrument synced
   - Tests (pure, on `merge3` and the outbox, with two simulated sessions):
     - adds on both devices are both kept
     - remove + rename both apply
     - the same field takes the later edit
     - delete vs a later edit
     - an instrument setup clash makes a copy
     - offline edits flush on reconnect
     - a second device gets everything
5. **Offline for accounts**
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
6. **Later:** Apple sign-in, Open Graph cards per link, passkeys.

**Stop here for the owner's review.**
