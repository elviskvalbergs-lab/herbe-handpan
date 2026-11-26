# Oakhum launch campaign

**Status: plan** (rewritten 21 Nov 2026, checked against `preview` on 22 Nov; replaces the six-week "feedback round" plan of 17 Nov). Nothing here has been posted or sent yet. Words come from `docs/messaging.md`, videos from `docs/video-plan.md`, everything for makers from `docs/maker-kit.md`.

**What changed since the first plan:** there are two audiences, not six; Songs exist (114 songs with tabs, each with its own link) and lead the posts for kalimba, ocarina, whistle and recorder; the app has a feedback button (Settings › Send feedback); "works offline" is only ever said with "free account"; the makers pitch is one promise; and "what worked" is now a number.

The budget is still €0 and about 2–3 hours of the owner's time a week. The aim is still feedback and an honest read on who comes back, not a launch day.

---

## 1. Two audiences

| | Jammers | Makers and shops |
|---|---|---|
| Who | Adults who own a handpan, tongue drum, kalimba, ocarina, flute or recorder, want to join in with friends and want to play songs | People and workshops who make or sell them |
| What we ask them to do | Open the link for their instrument and play something | Save one instrument and put its code in the case |
| Where they are | Instrument subreddits and Facebook groups, forums, teachers' channels, search | Their own sites and published business addresses |
| The video | A (overview), then the clip for their instrument | Makers v2 (cut 1b until it exists) |

Communities are still approached one instrument at a time, because a post in r/kalimba has to be about kalimbas. But it is one audience with one message, said in that instrument's words. Sound healers, yoga teachers, school teachers and the clay ocarina builder are not audiences of this campaign.

## 2. Before the first post (week 0)

| # | What | Who | Status |
|---|---|---|---|
| 1 | The website says what Oakhum is: the hero, "Play my notes", Songs on the home page, song pages, the help centre | Site session | **Done** (merged 22 Nov) |
| 2 | Songs has its own tab and a link per song, so a post can link straight to a song on an instrument (`oakhum.com/kalimba/c-major-17/songs/ode-to-joy`) | App session | **Done** |
| 3 | Video A and the clip for the first instrument (F3 kalimba or F1 handpan) | Video session | Scripts ready (`docs/video-plan.md`) |
| 4 | Site measurement (§3): Vercel Web Analytics and the site's PostHog events, with campaign tags carried from the site into the app | Site session | **Done** (merged 22 Nov). Check in week 0 that events arrive in PostHog from production. |
| 5 | Tracked links for every post (§3) | Claude | The table is in §5; fill in at posting time |
| 6 | Free alerts: an [F5Bot](https://f5bot.com) alert and a Google Alert for "oakhum" | Owner, 5 min | To do |
| 7 | Google Search Console and Bing Webmaster Tools: submit `oakhum.com/sitemap.xml` | Owner, 15 min | To do |
| 8 | The email setup for maker outreach (§7) | Owner | To decide |

Item 3 (the videos) is what still gates week 1.

## 3. Measurement

### What is measured where

| Where | Tool | What it gives | Limits |
|---|---|---|---|
| **App** (`oakhum.com/play`, every `/<family>/<tuning>` and `/s/<code>` link) | PostHog EU, cookieless (`logEvent` in `js/auth.js`) | The events below, with `utm_source`, `utm_medium` and `utm_campaign` on `open`; taps for heatmaps | No guest is recognised on a second visit (nothing is stored on the device, on purpose). Returning is counted for accounts only. |
| **Website** (home, instrument, tuning and song pages, `/makers`, `/help`) | Vercel Web Analytics and Speed Insights (`site/src/components/Measure.tsx`) | Page views, referrers and UTM per page, without cookies | Page views, not people. Use it for "which post brought traffic to which page". |
| **Website to app** | PostHog events on the site (`site/src/lib/analytics.ts`, the same PostHog project as the app, marked `surface: site`): `app_cta_click` (where on the page, and the link), `demo_chord_played` (family, tuning, chord), `video_play` (which video), `request_submitted`, `maker_contact_click` | Whether a page sends people on into the app, whether the playable demo and the videos are used | A link from the site into the app carries the visit's `utm_…` tags with it, so the app's `open` event still knows which post the visitor came from. `video_play` counts starts, not how far people watched. |
| **Accounts** | Supabase: `profiles.last_seen_on` | Exact return counts for people with an account | — |
| **Makers** | A hand-kept list (who was written to, who replied, who said no), and the makers programme's own numbers (scans, saves and chords played per code; the admin's list of maker requests) | Replies, maker pages requested and approved, instruments with a code, scans per code | Counts only: nobody is identified. |

**App events that exist today:** `open` (path, referrer, utm) · `setup` (the setup steps and which path: listen or know) · `setup_screen` (each setup screen shown, with the one before) · `setup_finish` (setup done: play or save) · `first_play` (family, seconds from landing) · `feature` (name: chords, arpeggio, listen, tuner, chord-sheet, song-play, song-print, …) · `save_tap` · `signup_shown` · `signup_method` · `signup_done` · `save_completed` · `install` · `offline_session` · `guest_offline` · `listen_check`.

### Tracked links

Every link in a post or an email carries three tags. Keep them lower case, with these values only:

```
?utm_source=<reddit|facebook|forum|email|youtube|instagram|hn>
&utm_medium=<post|comment|maker-email|teacher-email|video|bio>
&utm_campaign=<handpan|tongue-drum|kalimba|ocarina|flute|recorder|makers>-<yyyymm>
```

Example: `oakhum.com/kalimba/c-major-17?utm_source=reddit&utm_medium=post&utm_campaign=kalimba-202612`

Link to the app's page for the instrument (`/kalimba/c-major-17`), not to the home page: the reader lands on a playing instrument, and PostHog measures it today.

### What "worked" means

Per post, read 7 days after posting. A post "worked" if it clears the **bar**; "good" is what to copy.

| Step | How it's counted | Bar | Good |
|---|---|---|---|
| Came | `open` with the post's UTM | 100 | 300+ |
| Played | `first_play` ÷ `open` | 40 % | 60 % |
| Went deeper | visits with a `feature` event (a song played, Listen, a chord sheet) ÷ `open` | 15 % | 30 % |
| Wanted to keep it | `save_tap` ÷ `first_play` | 8 % | 15 % |
| Signed up | `signup_done` ÷ `save_tap` | 35 % | 50 % |
| Told us something | Feedback messages and useful comments | 5 per post | 15 |

Read it as a funnel: the first step that misses its bar is the thing to fix before the next post. If people come but don't play, the landing is wrong. If they play but nobody taps Save, they got what they wanted in one visit or found nothing worth keeping; read the comments to tell which.

**For the whole four weeks:**

| Number | Target | Why this one |
|---|---|---|
| Visitors from posts and emails | 1,000–2,000 | Enough to read the funnel per instrument |
| First plays | 500+ | The product got used, not just seen |
| New accounts | 40+ | The only return signal we can count |
| Accounts seen again within 7 days | 30 % of new accounts | People came back |
| Pieces of useful feedback | 40+ | The point of the campaign |
| Makers who replied | 6 of 40 written to (15 %) | The usual range for honest cold email is 10–20 % |
| Makers with a saved, shared instrument | 3 | The promise was tried for real |

These are first guesses. After week 1, replace them with what week 1 showed and say so in this document.

**Which instrument to put the next two months into** is decided by "accounts seen again within 7 days" per `utm_campaign`, not by visitors.

## 4. Channels

| Channel | Owner's time | What to expect | How |
|---|---|---|---|
| **Reddit**, one post per instrument subreddit | 1 h per post, including replies on day 1 | The best feedback per hour; tens to a few hundred visits per post | Read the sub's rules first; message the mods where self-promotion is restricted. Post from the owner's own account, in the first person, with the video uploaded natively and the link in the text. Reply to every comment on day 1. |
| **Facebook groups** | 15 min per post, plus replies | The largest handpan and tongue drum audiences | Join a few days before posting. Ask the admin first where links need approval. By hand only: Meta has no API for groups. |
| **Makers and shops**, cold email | 5 min per batch of 10 to read and send | 10–20 % reply; one maker who joins keeps sending new owners | `docs/maker-kit.md`. The only channel that compounds. |
| **Teachers and creators** (mid-size YouTube and Instagram) | 5 min per batch | One mention can beat every post | Published business addresses only. Offer the links to the scales and songs they teach. |
| **Forums** (Chiff & Fipple, Pure Ocarinas) | 20 min each | Small, high trust | Be a member first; say plainly that you made it. |
| **Short video** (Instagram Reels, YouTube Shorts, TikTok) | 10 min per upload | Slow to start; the per-instrument clips are made for it | One clip per instrument per week, the same day as that instrument's post. |
| **Search** | 15 min once | Slow and free: a page per tuning ("D Kurd handpan chords") | Sitemap submitted in week 0. |
| **Show HN** | 30 min | Developers, not players: comments on the technology | Optional, after week 4. The honest angle: pitch detection in the browser, and an app that is fully usable signed out. Don't say "no build step" (there is one) or "works offline" without "for accounts". |
| Product Hunt, paid ads | — | **Skip.** Wrong audience; no budget. | |

What Claude can and can't do here: draft every post, email and reply; prepare maker emails as drafts for the owner to send; read PostHog and write the weekly review. Claude never posts or sends on its own, and posting to Reddit or Facebook groups by API is neither possible nor wise.

## 5. The posts, written out

Rules for all of them: first person, from the owner; the instrument's name in the title; one link, tagged; the free line in full; ask for what's wrong; no emoji; the video uploaded to the platform, not linked. Change a sentence or two per group so the posts are not identical.

### 5.1 r/handpan (week 1)

Video: F1 (handpan clip), or A. Link: `oakhum.com/handpan/d-kurd?utm_source=reddit&utm_medium=post&utm_campaign=handpan-202612`

> **Title:** I made a free tool that shows what your handpan's scale can play: chords, songs and playing along with a guitar. Tell me what's wrong with it
>
> Hi all. I'm Elvis, from Latvia. When I got my handpan I could play the scale up and down within a week, and then I was stuck: what can I actually play on these nine notes, and how do I join in when a friend plays guitar?
>
> So I built Oakhum. You pick your scale (62 so far), or enter your own notes, bottom notes included, or tap "Play my notes" and play each note so it works out what you have. Then it shows:
>
> - every chord your scale can make, drawn on your own layout
> - the songs your notes can play, with a tab (a D Kurd gets a couple of dozen; nine notes are nine notes)
> - a song's chords in order, as a playlist, if you paste its chord sheet
> - and with "Listen" it hears a chord someone plays nearby and shows it on your pan
>
> It runs in the browser on your phone. Free, no sign-up to try. A free account keeps your instrument, works offline and syncs between your devices.
>
> Here it is on D Kurd: [link]
>
> I'm one person doing this in my spare time, and I'd rather hear what's confusing, wrong or missing now than later. If your scale isn't there, tell me its notes and I'll add it.

### 5.2 Handpan Facebook groups (week 1, two or three groups across the week)

Video: A. Link: the same page with `utm_source=facebook`.

> I've been playing handpan for a while without any music background, and the question I kept having was "what can I actually play on my scale?" So I made a free tool for it, and I'd like your honest opinion before I show it more widely.
>
> You pick your scale, or just play your notes to your phone and it works out what you have. It then shows every chord on a picture of your own pan, the songs your notes can play, and it can listen to a guitar and show you where to join in.
>
> It opens in the browser, free, no sign-up to try (a free account keeps your instrument and makes it work offline). This link opens a D Kurd: [link]
>
> What's missing? What's confusing? Is your scale there? (Admins: I asked before posting. Happy to remove it if it doesn't fit.)

### 5.3 r/kalimba (week 2)

Video: F3 (kalimba clip) or C (Songs). Link: `oakhum.com/kalimba/c-major-17/songs/ode-to-joy?utm_source=reddit&utm_medium=post&utm_campaign=kalimba-202612` (Ode to Joy on a 17-key kalimba; "Back" from it is the kalimba's Songs tab).

> **Title:** Free kalimba tabs that light up note by note, filtered to the songs your kalimba can actually play. Feedback wanted
>
> Hi. I'm Elvis, from Latvia. I make a free web app called Oakhum, and it now does kalimbas, so I'd like to know what kalimba players think of it.
>
> Tell it which kalimba you have (17 or 21 keys in C, Hugh Tracey, Sansula and others, or your own tuning; if you don't know, tap "Play my notes" and pluck each key). Then you get:
>
> - songs your keys can play: about ninety folk songs, children's songs and carols on a 17-key in C, each as a kalimba tab with numbers, octave dots and which thumb, lit note by note as it plays, at any speed
> - every chord your kalimba can make, shown on the keys
> - a tuner
>
> The melodies come from published scores (Wikipedia and public-domain songbooks), with the source noted for each.
>
> Free, no sign-up to try. A free account keeps your kalimba and your songs, and works offline.
>
> Here's Ode to Joy on a 17-key in C: [link]
>
> I'd like to hear what's wrong: is the tab the way you read tabs? Which songs are missing? Is your kalimba in the list?

### 5.4 Tongue drum Facebook groups (week 2)

Video: F2 or B ("Play my notes"). Link: `oakhum.com/tongue-drum/d-kurd-9?utm_source=facebook&utm_medium=post&utm_campaign=tongue-drum-202612`, or better `oakhum.com/play?…` so they start with "Play my notes".

> A question for people whose tongue drum came with a pair of mallets and no instructions: do you know what notes it has?
>
> I made a free tool that finds out. You put your phone next to the drum and play each tongue once; it listens and works out your drum. Then it shows the chords those notes can make and the songs they can play, with a simple numbered tab.
>
> It opens in the browser. Free, no sign-up to try; a free account keeps your drum and works offline. [link]
>
> I'm one person making this, and I'd like to know whether it heard your drum correctly. If it didn't, there's a "Send feedback" button in Settings, or tell me here which drum you have.

### 5.5 r/ocarina and the Pure Ocarinas community (week 3)

Video: F4 or the ocarina variant of C. Link: `oakhum.com/ocarina/alto-c-12/songs?utm_source=reddit&utm_medium=post&utm_campaign=ocarina-202612`

> **Title:** A free fingering chart for 12-hole ocarinas in every key, with songs that show each fingering as they play. What did I get wrong?
>
> Hi. I'm Elvis, from Latvia, and I make a free web app called Oakhum. It started with handpans and now covers 12-hole ocarinas (alto, soprano and bass, in every key).
>
> What it does for an ocarina:
>
> - the fingering for every note, from a published 12-hole chart (the source is named in the app; nothing is filled in from memory)
> - about a hundred folk songs, children's songs and carols, moved into your ocarina's key, showing each note and its fingering as the song plays, at any speed
> - chords played one note at a time, with each fingering, for playing along with a guitar
> - a tuner
>
> Free, no sign-up to try. A free account keeps your ocarina and songs, and works offline.
>
> Alto C: [link]
>
> Ocarina players know fingerings far better than I do, so: are any wrong or unusual for your instrument? Are the songs in sensible keys?

### 5.6 r/tinwhistle and Chiff & Fipple (week 3)

Video: F5. Link: `oakhum.com/flute/tin-whistle-d/songs?utm_source=reddit&utm_medium=post&utm_campaign=flute-202612` (`utm_source=forum` on Chiff & Fipple). Be a member of the forum before posting, and post in the board for tools and resources.

> **Title:** Free: 100 well-known tunes for D whistle that show each fingering as they play. Looking for corrections
>
> Hello. I'm Elvis, from Latvia. I make a free web app called Oakhum for people who play instruments with a fixed set of notes, and it now does the D whistle and Native American flutes.
>
> For the whistle: a fingering chart from a published source, and about a hundred folk tunes, children's songs and carols set for a D whistle. Each one plays at whatever speed you like and shows the note and its fingering as it goes. These are simple, well-known melodies, not session tunes with ornaments; it's for people starting out, or for playing a carol with the family.
>
> Free, no sign-up to try. A free account keeps your whistle and songs, and works offline.
>
> [link]
>
> I'd value corrections from people who actually play: fingerings, the second octave, keys. Native American flute players: 5 and 6-hole charts are there too, and I'd like the same from you.

### 5.7 Native American flute groups (week 3)

Lead with fingerings and chords, not songs: a pentatonic flute has the notes for very few of the catalogue's songs (2 on a 6-hole flute in A on 22 Nov). Use 5.6 with its second paragraph replaced by: "For Native American flutes: 5 and 6-hole flutes in every key, the fingering for every note from a published chart, and chords played one note at a time, so you can play along with a guitar. It can also listen to a guitar and show you which notes fit." Leave out "a hundred tunes". Link: `oakhum.com/flute/naf-6-a4?utm_source=facebook&utm_medium=post&utm_campaign=flute-202612`.

### 5.7b r/Recorder (week 3)

Video: F6. Link: `oakhum.com/recorder/soprano-baroque/songs?utm_source=reddit&utm_medium=post&utm_campaign=recorder-202612`. Read the sub's rules first: it is a community of serious players, so say plainly who this is for.

> **Title:** Free: 100 well-known tunes for soprano recorder that show each fingering as they play (baroque and German). Corrections welcome
>
> Hello. I'm Elvis, from Latvia. I make a free web app called Oakhum for people who play instruments with a fixed set of notes, and it now does recorders: soprano and alto in baroque fingering, and soprano in German fingering.
>
> It has a fingering chart from a published source, and about a hundred folk songs, children's songs and carols. Each one plays at whatever speed you like and shows the note and its fingering as it goes. It's for adults picking the recorder up again and for parents helping a child, not for people playing Telemann.
>
> Free, no sign-up to try. A free account keeps your recorder and songs, and works offline.
>
> [link]
>
> I'd value corrections from people who play: fingerings, alternative fingerings I should show, keys.

### 5.8 Short video captions (each instrument's week)

One per clip, the same text on Reels, Shorts and TikTok:

- **Handpan (F1):** What can your handpan play? Every chord your scale can make and the songs that fit it. Free, no sign-up to try: oakhum.com
- **Tongue drum (F2):** Play each tongue once and Oakhum works out your drum, then shows what it can play. Free: oakhum.com
- **Kalimba (F3):** Songs your kalimba can play, in kalimba tab, lit note by note. Free, no sign-up to try: oakhum.com
- **Ocarina (F4):** Every fingering, and songs that show each one as they play. Free: oakhum.com
- **Tin whistle (F5):** A hundred well-known tunes for D whistle, with every fingering. Free: oakhum.com
- **Recorder (F6):** The recorder from school, and a hundred songs you already know, with every fingering. Free: oakhum.com
- **Play my notes (B):** Don't know your tuning? Play each note once. oakhum.com
- **Songs (C):** The songs your instrument's notes can play, with the tab. oakhum.com

Hashtags, three at most, the instrument's own: #handpan #handpanmusic · #kalimba #kalimbatabs · #tonguedrum · #ocarina · #tinwhistle · #recorder. The profile link carries `utm_source=instagram&utm_medium=bio` (or `youtube`, `tiktok`).

### 5.9 Email to a teacher or creator (weeks 2 and 3)

Plain text, to a published business address, one link, personalised by Claude and sent by the owner.

> **Subject:** A free page for each scale you teach
>
> Hi [Name],
>
> I'm Elvis, a handpan player from Latvia. I watched your [lesson / video on …] and it's the reason I'm writing to you in particular.
>
> I make Oakhum, a free web app that shows what a given instrument can play: every chord on its own layout, and the songs its notes can play, with tabs. Each scale has its own link, so for the [Scale] in your lessons it's [link].
>
> If it's useful to your students, link to it wherever you like; there's nothing to sign and nothing to pay. And if you see something that's wrong or taught differently, I'd like to hear it. That's the main reason I'm writing.
>
> Best,
> Elvis · oakhum.com
> P.S. If this isn't for you, reply "no" and I won't write again.

### 5.10 The reply that earns trust

A week after each post, answer in the same thread:

> Thank you for all of this. From what you told me I've changed: [1], [2], [3]. Still on the list: [4]. If you tried it last week and it got something wrong, it would help to know whether it's better now.

This is the feedback loop made visible, and it is worth more than a second post.

## 6. Four-week calendar

About 2–3 hours of the owner's time a week. Posts go out Tuesday to Thursday; replies the same day.

| Week | Mon | Tue–Thu | Fri | Ends with |
|---|---|---|---|---|
| **0 · Get ready** | Check §2's list. | Videos A and F1 reviewed. Tracked links made. Join the Facebook groups and forums. | Alerts and Search Console set up. | Everything in §2 that gates week 1 is done. |
| **1 · Handpan** | Post 5.1 to r/handpan (after reading its rules). | One handpan Facebook group a day (5.2). Upload F1 as a Reel, Short and TikTok. Reply to every comment. | First read of the funnel. Fix the top two or three problems. | The week-1 numbers written into §3 in place of the guesses. |
| **2 · Kalimba and tongue drum** | Reply 5.10 in the week-1 threads. | r/kalimba (5.3); tongue drum groups (5.4); clips F3 and F2. First batch of 10 teacher emails (5.9). | Weekly review. | A decision: do Songs or chords lead the kalimba pitch? (Read `feature: song-play` against chords.) |
| **3 · Ocarina, whistle, flute. Makers batch 1** | Reply 5.10 in the week-2 threads. | r/ocarina and Pure Ocarinas (5.5); r/tinwhistle and Chiff & Fipple (5.6); NAF groups (5.7); r/Recorder (5.7b); clips F4, F5 and F6. **Makers: 20 cold emails** (`docs/maker-kit.md`), 10 on Tuesday and 10 on Thursday. | Weekly review. | Maker replies answered within a day. |
| **4 · Follow up and decide** | Reply 5.10 in the week-3 threads. | One follow-up to every maker and teacher who didn't answer, then stop. **Makers batch 2: 20 more.** The local Riga handpan community, in person. | The four-week review (§8). | A written decision on where the next two months go. |

Makers are written to in week 3 and not before, for two reasons: by then the makers video says the one promise, and the first weeks' fixes are in. The makers programme is built (maker page, a code per instrument, "Made by", the numbers), so the email offers all of it and asks for one thing: set up one instrument.

## 7. Email: how it's done

- **What Claude does:** finds makers, shops and teachers; notes what each sells or teaches and which Oakhum links match; writes a short personal email for each; puts them in Gmail as **drafts**. The owner reads and sends, about 5 minutes per batch of 10.
- **Claude never sends.** A wrong cold email from a new address harms the brand and the address.
- **The address:** the Gmail connector in these sessions is the owner's personal Gmail, not oakhummusic@gmail.com. Either (a) forward oakhummusic to the personal Gmail and add it there as "Send mail as", so drafts go out as oakhummusic; or (b) connect oakhummusic as the Gmail connector. To decide in week 0.
- **Safe and legal (EU):** business addresses published on the company's own site only; at most 20 a day; plain text, one link, no tracking pixels; every email says who is writing and why, and "reply 'no' and I won't write again"; a list of who was written to and who said no, and nobody who said no is written to again; companies only, not private people.

## 8. The feedback loop

**Where feedback comes in**

| From | How it arrives | Where it goes |
|---|---|---|
| The app | Settings › Send feedback; the "it heard my instrument wrong" listening report | The feedback list in Jira |
| The website | The request form (an instrument, a tuning, a feature) | Sanity, then Jira |
| Posts | Comments and DMs | The owner copies the useful ones into Jira, with the post's link |
| Email | Replies from makers and teachers | The outreach list (reply, yes, no), and Jira for anything to fix |
| Mentions elsewhere | F5Bot and Google Alert emails | The weekly review |

**Every week (Friday, 20 minutes of the owner's time):** Claude writes a review of about ten lines: the funnel per post against the bars in §3, the feedback grouped by what it's about, the three things most worth fixing, and drafts of the 5.10 replies. The owner picks what gets fixed.

**What gets fixed first:** anything that stopped a first play (wrong notes heard, a tuning missing, a screen nobody understood), then anything two or more people said, then the rest.

**Close the loop in public:** the reply in 5.10, a week after each post. People who see their comment acted on come back, and say so.

**At four weeks, decide in writing** (add it to the end of this document): which instrument's owners came back most; whether Songs or chords led for each; whether makers replied to the promise; and what the next two months are for.

## 9. What is not verified

- Subreddit and group rules and sizes: Reddit blocks requests from Claude's environment. Read each sidebar before posting.
- Subreddit names (r/Recorder and the others) were not opened from here; confirm each exists and is the active one.
- The site measurement in §3 is merged but has not been seen working on production: check in week 0 that `app_cta_click` and `demo_chord_played` arrive in PostHog and that a tagged link keeps its tags into the app.
- The targets in §3 are guesses until week 1 replaces them.
- Song counts in the posts were read from the app's **Popular** list on 22 Nov 2026 (D Kurd handpan 22, 17-key kalimba in C 89, alto C ocarina 100, D whistle 101, soprano recorder 101). Check them again on the day of the post.
