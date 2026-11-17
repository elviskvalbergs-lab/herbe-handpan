# Oakhum launch campaign: a feedback round

Written 17 Nov 2026. The budget is €0 and you have about 2–3 hours a week, so the plan has six weeks.

**What this launch is for:** feedback from real players, not reach. The aim is roughly **30–50 useful pieces of feedback** and an honest read on which audience comes back. It is not a big launch day. Communities that have to deal with self-promotion react much better to *"I made a free tool for this instrument, please tell me what's wrong with it"* than to an announcement.

**Starting point:** PostHog shows 14 visitors and 15 sessions in the last 30 days, which is mostly you. Every number after launch can therefore be credited to a channel, as long as every link carries a `utm_source` tag.

---

## 1. Who the audiences are

They are listed in the order to approach them: best fit and most finished part of the product first.

| # | Audience | Why Oakhum fits | Where they are |
|---|---|---|---|
| 1 | **Handpan owners**, mostly self-taught adults with a €1.5–4k instrument | "What can I play on *my* scale?" is the classic beginner question. Your strongest features answer it: scale-specific chords, playing along with a guitarist, and setting up by ear. | r/handpan, large Facebook groups (general, regional, swap and sale), Instagram/YouTube teachers, makers, gatherings and meetups |
| 2 | **Handpan makers and shops** (a channel to reach owners, not users themselves) | Every new owner gets the scale on a certificate. A link like "see what your D Kurd can play" is a free after-sale extra for the maker. | Their websites and public business email addresses |
| 3 | **Steel tongue drum and kalimba owners**: a much bigger, cheaper, beginner-heavy market, often given as gifts | Owners have no idea what to play, and the "play my notes" setup suits them. | r/kalimba, tongue drum Facebook groups, kalimba tab sites and teachers (e.g. Kalimba Magic), brand communities |
| 4 | **Ocarina players** | 12-hole charts in every key, plus support for ocarinas people made themselves | r/ocarina, Pure Ocarinas community/forum, ocarina Facebook groups |
| 5 | **Tin whistle and Native American flute players** | Fingering charts, chords as arpeggios | r/tinwhistle, Chiff & Fipple forum (whistle and NAF boards), Flutopedia's list of NAF groups, NAF Facebook groups |
| 6 | **Multipliers**: sound healers, yoga and meditation teachers, music therapists, school music teachers (kalimba, ocarina, and recorder when it arrives) | Each one reaches many players | Later, through what waves 1–5 teach you |

**Your story is part of the pitch.** A one-person project made in Latvia, on Oak Street, free with no sign-up, built from published fingering charts. Say it plainly in every post.

## 2. Channels, costs and expected return

All of these cost €0. The real cost is your time.

| Channel | Your time | Expected return | Notes |
|---|---|---|---|
| **Reddit**: one honest post per instrument subreddit | about 1 h per post, including replies on day 1 | Best feedback per hour, typically tens to a few hundred visits per post | Read each sub's rules first, and message the mods if the rules are strict about self-promotion. Post from your own account, written in the first person. Reply to every comment on the first day. |
| **Facebook groups** | 15 min per post, plus replies | The biggest handpan audience is here | Join the group a few days before posting. Many groups require admin approval for links, so ask the admin. Meta shut down its Groups API in 2024, so this can only be done by hand. |
| **Makers, shops and brands**: cold email | 5 min per batch for you to review and send (I prepare it) | Low reply rate (expect 10–20%), but one maker who says yes keeps sending new owners every month | The only channel that compounds. Details in §4. |
| **Teachers and creators** (YouTube/Instagram, mid-size) | Same as above | A single mention from a teacher can beat every post you make | Write to their *published business email* only. Offer them something useful for their students: a deep link to each scale they teach. |
| **Forums** (Chiff & Fipple, Pure Ocarinas) | 20 min | Small but high-trust | Be a member first, and say clearly that you made the tool. |
| **Search**: per-tuning pages such as "D Kurd handpan chords" | 15 min once | Slow, but free forever | Submit the sitemap to Google Search Console and Bing Webmaster Tools. This is the long-term channel. |
| **Show HN** (Hacker News) | 30 min | Developers, not players. You get feedback on the technology and UX, plus maybe a spike. | An optional week-5 post about the technical side: in-browser pitch detection, works offline, no build step. |
| Product Hunt | – | **Skip.** The median launch gets a handful of upvotes, and the audience doesn't fit. | |
| Paid ads | – | **Skip** (no budget) | |

## 3. Six-week plan (~2–3 h a week)

**Week 0: preparation (~3 h, mostly by you)**
1. **A way to give feedback inside the app.** The app has no feedback button yet, only the request page. Add a "Send feedback" link (a mailto link to oakhummusic@gmail.com, or a 2-question PostHog survey). *I can build this as a small PR.*
2. **A 30–45 s demo video, filmed on your phone:** a handpan being played, with the app recognising the scale and lighting up the chords. Make a second one later for kalimba or tongue drum. On Reddit and Facebook a video does much better than a link.
3. **Tracked links:** each post gets its own link, such as `oakhum.com/?utm_source=reddit&utm_campaign=handpan`, so PostHog shows which post brought whom. I make the list.
4. **Free alerts:** create an [F5Bot](https://f5bot.com) alert for "oakhum" (emails when Reddit or HN mention it) and a Google Alert. The alert emails go to Gmail, where I can read them.
5. Google Search Console and Bing Webmaster Tools: submit `oakhum.com/sitemap.xml`.
6. Choose the email setup (§4).

**Week 1: handpan, people.** r/handpan, then 2–3 big handpan Facebook groups spread over the week. Collect the feedback, then fix the top 2–3 problems.
**Week 2: handpan, makers and teachers.** First cold batch: about 20 makers and shops, and 10 teachers. Reply to the people from week 1 and say what you changed. That reply earns trust.
**Week 3: kalimba and tongue drum.** r/kalimba, tongue drum Facebook groups, kalimba teachers and tab sites, and a batch of smaller brands and shops.
**Week 4: ocarina and flutes.** r/ocarina, Pure Ocarinas, r/tinwhistle, Chiff & Fipple, NAF groups.
**Week 5:** follow-ups (one polite follow-up to people who didn't answer, then stop), an optional Show HN, and the local Riga handpan community.
**Week 6: review.** Visitors → first play → came back within 7 days, broken down by channel. Put the effort of the next two months where people come back, not just where they click.

**Rough targets.** These are guesses to check against reality, not promises: 500–1,500 visitors, 30–50 feedback messages, 3–5 makers or teachers linking to Oakhum.

## 4. What I can automate, and what I can't

You want as little automation as possible, and only where it pays off. Here is what I recommend.

### Email (worth automating, with you approving every send)
- **What I do:** find makers, shops and teachers. For each one I note what they sell or teach and which Oakhum deep links match their scales or keys, then write a short personal email for each. I put the emails in Gmail as **drafts**. You read them and press send, about 5 minutes per batch of 10.
- **Monitoring:** a scheduled task twice a week reads the replies and the F5Bot/Google alerts, labels them, drafts answers for you to approve, and sends you a summary of about 5 lines.
- **I never send anything on my own.** A wrong cold email from a brand-new account harms the brand and the account's deliverability.
- **The catch:** the Gmail connector in this session is connected to your **personal** Gmail, not oakhummusic@gmail.com. There are two ways to fix it:
  - **a)** In oakhummusic@gmail.com, set up forwarding to your personal Gmail, and add oakhummusic as "Send mail as" there. I then draft from your personal inbox with oakhummusic as the sender.
  - **b)** Connect oakhummusic@gmail.com as the Gmail connector in claude.ai settings. This is cleaner, but the sessions then lose your personal Gmail.
- **Keep it safe and legal (EU/GDPR):**
  - Write only to *business* addresses that are published on their site (info@, the contact page).
  - Send ≤ 20 a day from the new account, as plain text with one link and no tracking pixels.
  - Every email says who you are, why you're writing, and "reply 'no' and I won't write again".
  - Keep a simple list of whom you contacted and who opted out. Never write again to anyone who said no.
  - This is the usual "legitimate interest" basis for B2B outreach. Latvian law on this has nuances, so stick to companies, not private people.

### Reddit (I can't automate it, and shouldn't)
- **Posting isn't possible:** Reddit now requires a reviewed application for API access (the *Responsible Builder Policy*). According to reports, it stopped accepting new applications on 31 Oct 2026. Requests to Reddit from this cloud environment are also blocked (HTTP 403).
- **Automated posting is also a bad idea:** small instrument subreddits ban accounts for it quickly.
- **What I do instead:**
  - draft each post to match that sub's rules and tone, which you paste in
  - you get reply notifications in the Reddit app
  - F5Bot emails catch mentions anywhere on Reddit
  - I fold those into the twice-weekly summary and suggest replies

### Facebook, Instagram, YouTube
These can only be done by hand: Meta has no API for posting in groups. I can draft the posts and the DMs to teachers.

### Analytics (worth automating, read-only)
- A weekly PostHog digest: visitors by `utm_source`, first plays, return visits and new accounts, with the post that drove them.
- I can also set up the feedback survey in PostHog, with your OK.

### Your time budget with all of this in place
About **1 hour of posting and replying per wave, plus 10 minutes twice a week** to read my summary, approve drafts and press send.

## 5. Drafts to start from

**r/handpan (week 1).** Check the sub's rules first, and attach the video.

> **Title:** I made a free app that shows every chord your handpan scale can play, would love your honest feedback
>
> Hi all, I'm Elvis from Latvia. After getting my handpan I kept wondering what I could actually play on *my* scale, and how to jam with friends who play guitar. So I built Oakhum: pick your scale (62 of them, or enter your own notes, bottom notes included; it can also listen and work out your scale), and it shows every chord drawn on your own layout, plays arpeggios, and tells a guitarist which chords stay in tune with you.
>
> It's free and runs in the browser, with no sign-up. Here's D Kurd: oakhum.com/handpan/d-kurd?utm_source=reddit&utm_campaign=handpan
>
> I'm one person building this in my spare time, so I'd really value hearing what's confusing, what's wrong or what's missing. Brutal honesty welcome.

**Email to a maker (week 2).** Plain text. I personalise each one.

> **Subject:** A free "what can I play?" page for your [Scale] owners
>
> Hi [Name],
>
> I'm Elvis, a handpan player from Latvia. I built Oakhum, a free browser app that shows every chord a given scale can play, drawn on the instrument's own layout, with arpeggios and play-along help for guitarists.
>
> Your [Scale] already has its own page: [deep link]. New owners often ask "what do I play now?", so it might be a useful link for your product page or your after-sale email. It's free, with no sign-up or ads.
>
> If a scale you build is missing, or anything is wrong, I'd love to hear it. That feedback is the main reason I'm writing.
>
> Best,
> Elvis, Oakhum (oakhum.com)
> P.S. If this isn't for you, just reply "no" and I won't write again.

## 6. What I couldn't check

- I couldn't verify subreddit member counts or each sub's current rules, because Reddit blocks requests from this environment. Read the sidebar before each post.
- The Reddit API dates come from news reports, not from Reddit's own help page.
- I didn't verify whether PostHog surveys work with the app's cookieless setup. I'll check before setting one up.

Sources: [Reddit Responsible Builder Policy announcement](https://r.datuan.dev/r/redditdev/comments/1oug31u/introducing_the_responsible_builder_policy_new/nobt04v) · [Reddit API changes (Unite.AI)](https://www.unite.ai/?p=478946) · [Product Hunt median launch (Indie Hackers)](https://www.indiehackers.com/post/the-median-indie-launch-last-week-got-3-upvotes-d1c2406a1f) · [GDPR and B2B cold email](https://prospeo.io/s/gdpr-cold-email-b2b) · [Pure Ocarinas community](https://pureocarinas.com/community) · [Flutopedia: NAF groups](https://flutopedia.com/roster_social.htm) · [Chiff & Fipple](https://forums.chiffandfipple.com/viewtopic.php?p=1244569)
