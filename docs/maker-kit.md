# Oakhum maker kit

**Status: plan** (texts checked against `preview` on 22 Nov 2026; nothing here has been sent). Ready-to-use texts for reaching makers and shops and for what they put in front of their buyers. The message is in `docs/messaging.md` and `docs/video-script-makers.md` §1; when and how it is sent is in `docs/launch-campaign.md` (week 3). The product behind it is `docs/makers-programme.md`.

**The one promise:** *Save the instrument once. Every scan of its code opens that instrument, ready to play.*

**What a maker gets** (all built, all free; `docs/makers-programme.md`):

- **A maker page on oakhum.com**: name, logo, story and the instruments they make, each one playable. Asked for in the app (Settings › For makers and shops › Create your maker page); we look at each request before a page goes public.
- **A code for every instrument**, as a link, a printable QR card, a sheet of stickers or an NFC tag: one for a model, or one for each serial number. A whole range can be pasted in as a list.
- **"Made by <maker>" on the buyer's screen**, with the logo and a link to the maker's site, every time the buyer opens the instrument.
- **Numbers, never people**: scans (by QR code or NFC tag), saves and chords played, for each code.
- **For the shop page**: a public page per tuning to link to, and an embed of the playable instrument.
- The buyer needs no app store and no sign-up to open and play.

Never mention the clay ocarina builder. Promise only what is in this list.

---

## 1. Cold email

Plain text, to a published business address, one link, sent by the owner from the Oakhum address. Claude fills in the brackets for each maker from their own site; the owner reads and sends. No attachment, no tracking pixel. Under 150 words.

**Subject options** (pick by what the maker sells):

- A code in the case that opens the buyer's [handpan] on their phone
- For the "what do I play now?" emails after a sale
- Your [D Kurd 9+2], playable on a phone

> Hi [Name],
>
> I'm Elvis, a handpan player from Latvia. I'm writing because of your [instrument and tuning, e.g. "F Celtic Minor with the two bottom notes"]: [one true, specific sentence about it].
>
> I make Oakhum, a free web app for the people who buy instruments like yours. You save an instrument once, exactly as you built it, and it gets its own code. Printed on a card in the case, it opens that instrument on the buyer's phone, ready to play: every chord it can make and the songs its notes can play. They don't need an app or an account.
>
> It's free for you and for them. This is what a buyer sees, on a [tuning]: [link]
>
> If you'd like to try it on one instrument, I'll set the first one up with you. And if something about it is wrong for how you work, I'd like to hear that too.
>
> Best,
> Elvis Kvalbergs · Oakhum · oakhum.com/makers
>
> P.S. If this isn't for you, reply "no" and I won't write again.

Notes:

- **The link** is the app page of a tuning they actually sell, tagged: `oakhum.com/handpan/f-celtic-minor?utm_source=email&utm_medium=maker-email&utm_campaign=makers-202612`. If they only build custom tunings, set one up as a custom instrument and link that.
- **The specific sentence** has to be real (a scale they build, something from their site or a video). If there is nothing specific to say, don't write to them.
- The sentence "It says who made it, and you can see how often each code is opened" may follow "…or an account." when the email has room; it is the second-strongest thing to say after the promise.
- **For a shop** (sells other makers' instruments), replace the second paragraph's first two sentences with: "I make Oakhum, a free web app for the people who buy instruments like the ones you sell. Every scale has a page where a customer can hear it and play it before they choose, and you can put a code in the box that opens their instrument on their phone."

## 2. Follow-up

Once, 7 to 9 days later, as a reply in the same thread. Then stop, whatever happens.

> Hi [Name],
>
> One short follow-up, and then I'll leave you in peace. I set up your [tuning] so you can see what a buyer would get: [shared link `oakhum.com/s/<code>`]. Open it on your phone; that's all there is to it.
>
> If a card with that code in the case would be useful, I can send you a print-ready one.
>
> Best,
> Elvis · oakhum.com/makers

This only works if the instrument really was set up: do it before sending (two minutes each, from their published notes). If their site doesn't publish the notes, send this instead:

> Hi [Name], one short follow-up and then I'll leave you in peace. If you tell me the notes of one instrument you're building now, I'll set it up and send you its code, so you can see what your buyer would get. Best, Elvis

## 3. Replies

**If they say yes:**

> Thank you, that's great. Three steps:
> 1. Open oakhum.com/makers and tap "Set up your maker page". You sign in with your email and a code we send you (no password), and tell us your name and what you make. I look at each request myself, usually the same day.
> 2. Set up your first instrument and give it a code.
> 3. Tap "QR card" and print it for the case. Stickers and NFC tags are on the same screen.
> If anything isn't right for your instruments (a note layout it can't show, a scale it names wrongly), tell me. That is exactly what I need to hear.

**If they ask "what's the catch?":**

> There isn't one. Oakhum is a personal passion project and it's free. If it ever has paid parts, the code in your buyer's case will keep opening their instrument for free.

(The last sentence is a promise the owner made on 25 Nov 2026: a code that is in a buyer's case keeps opening that instrument for free. It may be said on `/makers` too.)

**If they say no:** "Understood, thank you for telling me. I won't write again." Add them to the no-list.

## 4. One-page PDF: outline

A4, portrait, one side, in the brand's cream, ink and clay with the Oakhum text face (`docs/design-system.md` §0). For attaching to a *reply* (never to the first email) and for printing at a gathering. Built like the video stills (HTML to PDF with Playwright), so it stays in the repository.

| Block | Content |
|---|---|
| **Top left** | Logo. Small: "For makers and shops". |
| **Headline** | **Save it once. Every scan opens it, ready to play.** |
| **Under it, one line** | Oakhum puts each instrument you make on its buyer's phone: every chord it can play and the songs its notes can play. |
| **Picture, right half** | A phone showing a shared instrument with a chord lit; beside it, the QR card (§6) at real size. The phone shows "Made by <maker>". |
| **Three steps, numbered** | **1 Save it.** Set the instrument up exactly as you built it: scale, layout, every bottom note. · **2 Put its code in the case.** A QR card, a sticker or an NFC tag. · **3 They scan it.** Their instrument opens, ready to play, with your name on it. No app, no sign-up. |
| **Why, three short lines** | Buyers get past "what do I play now?" · Fewer emails asking what to play · Unusual scales are easier to choose when people can hear them first |
| **Small print, one line** | Free for you and your buyers. A buyer's free account keeps their instrument, works offline and syncs. Handpans, kalimbas, flutes and more. |
| **Bottom** | A QR code to `oakhum.com/makers?utm_source=pdf&utm_medium=maker-email&utm_campaign=makers-202612` · **oakhum.com/makers** · oakhummusic@gmail.com · "Made in Latvia, on Oak Street" |

Not on the page: NFC details, the shop link, Listen, feature lists. One page, one promise.

A fourth "why" line, if there is room: "See how often each instrument is opened".

## 5. Product-page copy for a maker's shop

For the maker to paste into their own product page. Written in the maker's voice ("we"), so it reads as theirs. Replace the brackets. The link is the tuning's page or the instrument's own code.

**Short (one line, under the price or the sound sample):**

> Hear this scale and try its chords on your phone before you choose: [link]

**Medium (a paragraph in the description):**

> **See what this [handpan] can play.** Every [Maker] instrument comes with its own page on Oakhum, a free app that shows every chord this scale can make, drawn on the instrument's own layout, and the songs its notes can play. Open it on your phone, tap a chord and hear it: [link]. No app to install and no sign-up.

**In the box (for the "what you get" list):**

> - A card with your instrument's code. Scan it and your [handpan] opens on your phone, with every chord and the songs it can play.

**After-sale email (to send with the shipping notice):**

> **Subject:** Your [D Kurd] is on its way. Here's what it can play
>
> Hi [Name],
>
> Your [handpan] left the workshop today.
>
> While you wait: this link opens your exact instrument on your phone, with every chord it can play and the songs that fit its notes: [link]. There's a card with the same code in the case.
>
> It's a free app called Oakhum, and it works in your browser. If you'd like it to keep your instrument, work offline and sync between your devices, save it with a free account.
>
> Enjoy the first notes,
> [Maker]

**For a custom or unusual scale (where buyers hesitate):**

> Not sure what you could play on [scale name]? Try it first: [link] shows every chord this scale can make and plays them for you.

Rules for whoever edits these: keep "free"; keep "no app to install"; don't write "works offline" without "free account"; don't call Oakhum "our app" (it isn't the maker's).

## 6. The QR card

A6 portrait (105 × 148 mm), one side, printed on the card stock the maker already uses for certificates. The pipeline already renders one (`scripts/demo-video/makers/scenes.js`, `qr-card.png`); this is the text for the real one.

**Front**

```
[Oakhum logo, small]

Scan to play
your D Kurd 9+2

[QR code → oakhum.com/s/7KQ2PM]

Every chord and the songs
your handpan can play.
Free. No app to install.

oakhum.com/s/7KQ2PM
```

- Line 2 is the instrument's own name, as the maker saved it.
- The link is printed under the code for anyone whose camera won't scan it.
- The QR code is at least 30 mm wide, dark on light, with a quiet margin of four modules.
- Above the logo: "Made by [Maker]", as the app shows it. The app prints this card itself (the maker's screen › an instrument › **QR card**); the text here is what it should say, and the reference if a maker designs their own.

**Back (optional)**

```
Keep it
Save this instrument with a free account:
it stays on your phone, works offline
and syncs between your devices.

Made by [Maker] · [maker's site]
```

**Variants of the first two lines**

| For | Text |
|---|---|
| The certificate (small code in a corner) | Scan to play this instrument |
| A sticker inside the case lid | Scan to play |
| An NFC tag's label | Hold your phone here to play |
| A shop's shelf label, per scale | Hear this scale: scan to play |

**NFC, in one paragraph** (for the maker who asks): any free NFC app writes the same link to a sticker in a few seconds. Android phones and iPhone XS or newer read it without an app. Steel blocks a normal tag, so on a handpan or tongue drum put it on the case, the box or the card, or use an "on-metal" tag. A QR code works on every phone, so print that as well.

## 7. Who to write to, and the list

- **Who:** workshops and shops that sell to order or in their own tunings, with a business address published on their own site. Start with handpan and tongue drum makers (custom tunings are where the promise is strongest), then kalimba makers, then ocarina and flute makers. 20 in the first batch, 20 in the second.
- **Not:** private people, marketplaces, big brands (later), anyone whose only contact is a personal social account.
- **The list** (a private sheet, not in the repository): maker · country · what they sell · the address and where it was published · date written · link sent · reply (yes / no / question / none) · follow-up date · instrument set up · code. Anyone marked "no" is never written to again.
- **What counts as worked:** 15 % reply; 3 makers with a saved, shared instrument after the two batches (`docs/launch-campaign.md` §3).
