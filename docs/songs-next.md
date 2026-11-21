# Songs, next: links, fit and the player

Design for the songs work that follows the outside-in review (November 2026). Wireframes: `docs/songs-next-wireframes.html`. Built in four pull requests, listed at the end. This document is the plan; `docs/design-system.md` records what is built.

## Open questions for the owner

Each has a recommendation, and the work goes ahead on it. Say so if you want it the other way.

1. **Songs that almost fit.** A song is offered when the instrument lacks exactly one of its notes and that note comes up rarely (at most a tenth of the song's notes, never the first or last note). It is listed after the songs that fit, marked "one note missing", and the player shows that note crossed out. Nothing is swapped in for it. *Recommendation: yes.* It takes a D Kurd from 21 songs to 52 without pretending anything. The alternative (only songs that fit completely) keeps the list short and beyond reproach.
2. **Moving a single note by an octave** (the low G played as the high G). Players do this, and it would add about as many songs again, but it changes the tune's shape, and the app would be making that musical choice. *Recommendation: not now.* Designed below, not built.
3. **How many song pages the website gets.** One page per song (114), plus a page per song and tuning ("Twinkle, Twinkle on D Kurd handpan") wherever the song fits completely. All of them work and can be shared; only the song pages and the pages for a short list of well-known tunings go into the sitemap and are open to search engines. *Recommendation: start with that short list* (D Kurd handpan, C major 17-key kalimba, C major 11 tongue drum, tin whistle in D, alto C 12-hole ocarina, Native American flute in A minor, about 500 pages) and widen it when search traffic shows which tunings people look for.
4. **Song order by language.** "Popular" opens with songs known everywhere, then songs from the visitor's own language area (from the browser's language), then the rest. Latvian folk songs join Popular for a Latvian browser and stay under Countries for everyone else. *Recommendation: yes.* The alternative is one fixed order for everybody.
5. **Sharing a playlist.** A playlist is the player's own data, so a link has to carry it (the chords in the address) or it has to be stored on the server. *Recommendation: carry it in the address,* built after the navigation redesign lands, because both touch the Playlists screens. Designed below, not built in this round.
6. **Speed down to 25%.** The speed setting is shared by everything that plays. *Recommendation: lower the bottom of the one shared slider from 50% to 25%* rather than give songs their own speed.

## What the review found

- A song has no address of its own: it opens at `/play#song/<id>`, with no instrument in it, no preview card and no Share.
- Fit is thin where it matters. Before this work (103 songs): a D Kurd handpan 21, the median handpan 21, six of 62 handpan tunings none; seven of 18 tongue drums none; two kalimbas none; the pentatonic Native American flute charts none.
- The brief promised wait mode, looping a section, speed from 25% and "songs I can play on my instruments". The player has speed from 50% and none of the rest.
- The order is wrong for an English-speaking launch: 42 of 103 songs are German. (The Latvian songs have since moved under Countries.)
- Tab and print: built for every family since November (flutes get Grey Larsen's tablature, ocarinas the fingering pictures, both print). That is the right equivalent, so nothing more is planned there.

## 1. A song has an address

### Links

```
/handpan/d-kurd/songs/twinkle-twinkle        a song on a catalogue tuning
/kalimba/c-major-17/songs                    that tuning's song list
/handpan/custom/songs/twinkle-twinkle?ding=… a song on custom notes
/s/7KQ2PM/songs/twinkle-twinkle              a song on a shared instrument
/song/twinkle-twinkle                        a song, no instrument
```

- `songs` is a tab in every family's links, like `chords`. The song's slug is its `id` in `js/songs.js`; ids never change once published (a rename adds an alias in `SONG_ALIASES`).
- `linkFor(target, { song })` writes them and `parseLink` reads them back as `{ …, tab: 'songs', song }`. An unknown song slug opens the tuning's song list.
- While a song is open the address bar shows its link, as it does for a chord.
- **A song link without an instrument** (`/song/<id>`): someone who has instruments gets the song on the one it fits best (fits completely before almost fits, the instrument used last first). Someone who has none gets the instrument picker with a line on top, "Pick your instrument to play Twinkle, Twinkle, Little Star", and the song opens once they have picked. If it doesn't fit there, the song list opens with a line saying so.
- The old `#song/<id>` keeps working inside a visit.

### Preview card

The Vercel middleware already rewrites the page's title, description and image for instrument links. For a song:

- Title: `Twinkle, Twinkle, Little Star on D Kurd handpan · Oakhum`
- Description: `Play it note by note on the D Kurd handpan: the tab, each note lit, at your own speed. Free, in your browser.`
- For `/song/<id>`: `Twinkle, Twinkle, Little Star · Oakhum`, "Find out whether your handpan, tongue drum, kalimba, ocarina or flute can play it…".
- Image: the family's card (`/og/handpan.jpg`) in the app. The website's song pages get their own image with the song title and tuning drawn on it (section 5).

### Share

A **Share** button in the song screen's app bar. It calls `navigator.share({ title, text, url })` where the browser has it (phones), otherwise copies the link and says "Link copied"; if neither works, a sheet shows the link to copy by hand. The link is the one in the address bar, so a friend with the same instrument opens the same song, and a friend with another one can switch instrument from there. Guests can share: nothing is stored.

The same button, through the same helper (`shareLink`), goes on a chord card and the instrument's own screen for catalogue and custom instruments, which today only have "Copy link" in a menu.

### Sharing a playlist (designed, not built)

`/handpan/d-kurd/playlists/shared?name=Evening&bpm=80&c=a-min.d-min.a-min.bb-maj` carries the chords in order by their link slugs (`linkSlug(chord.id)`), bars per step as `a-min*2`. Opening it shows the playlist ready to play, with "Keep it" (which asks a guest to make an account, as Save does). It waits for the navigation redesign, which is moving the Playlists screens.

## 2. Real repertoire for pentatonic and small instruments

The app already moves each song to the key where the instrument has all its notes (`songShift`). What is missing is songs that fit few notes, and honesty about near misses. Three things were weighed:

| Option | What it gives | Verdict |
| --- | --- | --- |
| **Published melodies on few notes** (pentatonic songs, four- and five-note children's songs, Japanese songs for the Akebono scale) | Songs that fit completely on instruments that had none | **Build.** Eleven added in this round, each read from the score in its Wikipedia article. |
| **Almost fits: one note missing**, marked | Roughly doubles the list on a nine-note instrument | **Build** (question 1). |
| **One note moved an octave**, marked | About as many again | Not now (question 2). |
| Swapping a missing note for a neighbour | More songs | **Never.** That is inventing notes. |

### New melodies

Hot Cross Buns, Rain, Rain, Go Away, Michael, Row the Boat Ashore, Ye Banks and Braes, Suo Gân (Wales), À la claire fontaine (France), Zum Gali Gali (Israel), Mo Li Hua (China), Kagome Kagome, Tōryanse and Edo Komoriuta (Japan). The reader that turns a LilyPond score into the app's notes is now in the repository (`scripts/song-from-score.mjs`), checked against songs already in the catalogue, and each new melody's bars were counted against its time. More will follow the same way: the next batch should be spirituals and Scottish pentatonic tunes, which are known in English and fit these instruments, when a published score with a clear licence is found for each.

### Almost fits

- `songFit(song, have)` gives `{ shift, missing }`: `missing` is null when the song fits, or the one note the instrument lacks.
- The list shows songs that fit first, then a second group, **Almost fit: one note missing**, each row saying which note ("without E5, 3 times").
- In the player that note is drawn crossed out in the tab and the note chips, nothing lights on the picture, and the line under the picture says "E5 isn't on your handpan: leave it out or sing it". Play still sounds it, so the tune is heard whole. Wait mode steps over it.

### Songs per instrument, computed with the app's own `playableSongs`

| Instrument | Before (103 songs) | Fits now (114) | With almost fits |
| --- | --- | --- | --- |
| D Kurd handpan | 21 | 26 | 52 |
| Handpans, median of 62 tunings | 21 | 26 | 56 |
| Handpans with no songs | 6 | 0 | 0 |
| F Low Pygmy handpan | 0 | 1 | 7 |
| D Akebono handpan | 0 | 1 | 3 |
| Tongue drums, median of 18 | 30 | 36 | 69 |
| Tongue drums with no songs | 7 | 0 | 0 |
| C major pentatonic drum, 8 notes | 0 | 2 | 14 |
| A minor pentatonic drum, 8 notes | 0 | 2 | 9 |
| D Akebono drum, 8 notes | 0 | 1 | 1 |
| Kalimbas, median of 10 | 50 | 58 | 100 |
| C pentatonic kalimba, 7 keys | 0 | 1 | 7 |
| A minor kalimba, 9 keys | 0 | 0 | 1 |
| Native American flute, pentatonic chart | 0 | 2 | 6 |
| Native American flute, A minor chart | 95 | 105 | 112 |
| Tin whistle in D | 103 | 114 | 114 |
| 12-hole ocarina | 102 | 113 | 113 |
| Smallest 6-hole pendants (3 keys) | 0 | 104 | 109 |

The pendants had none because a song was moved two octaves at most; it is now three. Akebono instruments and the A minor kalimba are still thin: they need more Japanese melodies and songs on the notes A C D E G, which is the first thing to look for in the next batch.

### Order

`songsInOrder(songs, languages)`: songs known everywhere (`SONG_WORLD`, a short list in `js/songs.js`: Ode to Joy, Twinkle, Twinkle, Happy Birthday, Frère Jacques, Amazing Grace, Silent Night, Auld Lang Syne and the like) first, then songs from countries that speak the browser's language, then the rest, each group in the catalogue's own order. The Countries sheet is unchanged.

## 3. The player

Wireframe 1. The controls row stays as it is; a second row holds the three new things.

- **Wait for me.** A microphone toggle. The player stops on each note and moves on when it hears that note (the tuner's pitch detection, within half a semitone, the octave free on drums and kalimbas where the overtone can be louder than the note). The same note twice in a row needs a new strike: the sound has to drop or change before it counts again. Rests and a missing note are stepped over. The note chip turns green as it is heard. Turning it on asks for the microphone as the tuner does; if that is refused the toggle goes back off with the tuner's message.
- **Loop.** Tap **Loop** once on the first note of the passage ("Loop from here"), again on the last ("to here"), and Play and Wait go round it; a third tap clears it. The looped notes are bracketed in the tab and the chips. On a tab, **Loop this line** on the line's edge sets both ends at once.
- **Speed from 25%.** The shared speed slider and its presets start at 25%.
- **On your instruments.** Under the tab: each saved instrument with "fits", "one note missing" or "doesn't fit", best first; tapping one opens the song on it. Shown when there are two or more. The matching list for a whole catalogue ("songs I can play on any of my instruments") belongs to the new Songs tab that the navigation redesign is building; the helper it needs (`songCoverage`) ships here.

## 4. Website song pages

Wireframe 3. New routes only; existing pages are not touched apart from a link to `/songs` where the instrument pages list things to do.

- `/songs`: every song, grouped as in the app, with a search box.
- `/songs/<song>`: the song (title, country, key, time, source and licence), its notes, a playable demo on a default instrument, and **which instruments can play it**: every catalogue tuning it fits, by family, each linking to its page below, and those it almost fits.
- `/songs/<song>/<family>/<tuning>`: "Twinkle, Twinkle, Little Star on D Kurd handpan": the tab for that tuning from the app's engine, the picture with the notes numbered, Play with the app's sound, the key it lands in, songs that go well after it, and "Open in the app" to the deep link from section 1. Real content that differs on every page: the tab, the numbers and the key are the tuning's own.
- Thin pages: a page exists only where the song fits completely. All are reachable and shareable; the sitemap and `index` are limited as in question 3, the rest carry `noindex` until the list is widened.
- Each page has its own preview image (title and tuning on the family's artwork) from the site's image route.
- Copy that isn't the song's own data (headings, the paragraph explaining tabs) is a Sanity document, as the site's rules require.

## Build order

1. **Links, share, previews.** `js/links.js` (song routes, `/song/<id>`, preview text), `vercel.json` and `middleware.js` matchers, the song screen's Share and address, tests (`parseLink(linkFor(x))` for every song on a tuning of every family).
2. **Repertoire.** The new melodies, `songFit`, the almost-fit group and markers, `songsInOrder`, the reader script, tests.
3. **Player.** Wait mode, loop, 25%, On your instruments, tests for the pure parts (`songWaitHeard`, `songLoopNext`, `songCoverage`).
4. **Website.** The song routes, sitemap, tests.

Not in this round: sharing a playlist, a note moved by an octave, MusicXML and MIDI import, a licensed catalogue.

## What was built, and what differs from the plan

Built as planned: sections 1, 2 and 3, and the website's `/songs`, `/songs/<song>` and `/songs/<song>/<family>/<tuning>` pages with their sitemap entries (114 song pages and 509 song-and-tuning pages for the six well-known tunings; every other tuning's pages work and carry `noindex`).

Different from the plan, or left out:

- **The website shows the song as notes in bars, not as the app's tab.** The numbered tab (which field or tongue, which hand) is drawn inside `js/app.js`, which the website can't import, and copying it would break the rule that music comes from the app. The page plays the song with the app's sound, lights each note on the app's drawing (or shows its fingering), and sends people to the app for the tab. To put the tab on the website, the tab's model has to move out of `js/app.js` into a module both can use.
- **The website's song pages use the site's default preview image.** A picture per song and tuning is not built.
- **`/songs` has no search box**, and nothing on the existing pages links to it yet (the header, footer and instrument pages belong to the website work in progress). It is in the sitemap.
- **Share is on the song screen only**, not yet on chord cards or the instrument screen.
- **"Loop this line"** on the tab's edge is not built; the two-tap loop is.
- **The list of songs across all my instruments** is not on a screen: `songsAcross` is ready for the Songs tab that the navigation redesign is adding. "On your instruments" for one song is built.
- **Wait mode** was tested with a generated recording as the microphone, not yet with a real instrument in a room.

