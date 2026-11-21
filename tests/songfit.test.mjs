// Unit tests for song fit, order and the score reader. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, getAllNotes, noteToMidi } from '../js/data.js';
import { LAYOUT_FAMILIES } from '../js/layoutfamilies.js';
import { TRADITIONAL_CHARTS, instrumentFromChart } from '../js/charts.js';
import { SONGS, SONG_ORIGINS, SONG_WORLD, SONG_NEAR_SHARE, songNotes, songShift, songFit, playableSongs, songsInOrder, songsForFilter, songHomeOrigins } from '../js/songs.js';
import { readMelody, scoreBlocks } from '../scripts/song-from-score.mjs';

const haveOf = scale => new Set(getAllNotes(createLayoutFromScale(scale)).map(noteToMidi));
const kurd = haveOf(SCALES.find(x => x.id === 'D-Kurd'));
const song = id => SONGS.find(x => x.id === id);
const midis = s => songNotes(s).map(n => n.midi).filter(m => m != null);

test('songFit: a song that fits has nothing missing and the same move as songShift', () => {
  for (const { song: s, shift } of playableSongs(kurd)) {
    assert.deepEqual(songFit(s, kurd), { shift, missing: null });
    assert.deepEqual(songFit(s, kurd, { near: false }), { shift, missing: null });
  }
});

test('songFit: almost fits means exactly one note missing, rarely, never first or last', () => {
  const near = playableSongs(kurd, SONGS, { near: true }).filter(x => x.missing != null);
  assert.ok(near.length >= 10, 'a D Kurd gets a good many more songs');
  for (const { song: s, shift, missing, times } of near) {
    assert.equal(songShift(s, kurd), null, `${s.id} doesn't fit as it is`);
    const moved = midis(s).map(m => m + shift);
    const gone = [...new Set(moved.filter(m => !kurd.has(m)))];
    assert.deepEqual(gone, [missing], s.id);
    assert.equal(moved.filter(m => m === missing).length, times);
    assert.ok(times <= moved.length * SONG_NEAR_SHARE, `${s.id}: ${times} of ${moved.length}`);
    assert.notEqual(moved[0], missing, `${s.id} starts on a note the instrument has`);
    assert.notEqual(moved[moved.length - 1], missing, `${s.id} ends on a note the instrument has`);
  }
  assert.equal(songFit(near[0].song, kurd, { near: false }), null);
});

test('songFit: made-up cases', () => {
  const have = new Set([60, 62, 64, 65, 67]);
  const tune = notes => ({ notes });
  const twenty = Array(18).fill('C4:1').join(' ');
  assert.deepEqual(songFit(tune(`C4:1 ${twenty} A4:1 C4:1`), have), { shift: 0, missing: 69, times: 1 });
  assert.equal(songFit(tune(`A4:1 ${twenty} C4:1`), have), null, 'the first note missing');
  assert.equal(songFit(tune(`C4:1 ${twenty} A4:1`), have), null, 'the last note missing');
  assert.equal(songFit(tune('C4:1 A4:1 A4:1 A4:1 C4:1'), have), null, 'missing too often');
  assert.equal(songFit(tune(`C4:1 ${twenty} A4:1 B4:1 C4:1`), have), null, 'two notes missing');
  // A move that leaves nothing out wins over one that leaves a note out.
  assert.deepEqual(songFit(tune(`D4:1 ${Array(18).fill('D4:1').join(' ')} A4:1 D4:1`), have), { shift: -2, missing: null });
});

test('playableSongs: the ones that fit first, then the ones that almost fit; without near, as before', () => {
  const all = playableSongs(kurd, SONGS, { near: true });
  const firstNear = all.findIndex(x => x.missing != null);
  assert.ok(firstNear > 0);
  assert.ok(all.slice(firstNear).every(x => x.missing != null));
  assert.deepEqual(all.slice(0, firstNear).map(x => x.song.id), playableSongs(kurd).map(x => x.song.id));
  assert.ok(playableSongs(kurd).every(x => x.missing == null));
});

test('every catalogue instrument has a song (the pentatonic ones too)', () => {
  const zeroExact = [];
  for (const fam of Object.keys(LAYOUT_FAMILIES)) {
    for (const t of fam === 'handpan' ? SCALES : LAYOUT_FAMILIES[fam].tunings) {
      const have = haveOf(t);
      assert.ok(playableSongs(have, SONGS, { near: true }).length >= 1, `${t.id} has a song`);
      if (!playableSongs(have).length) zeroExact.push(t.id);
    }
  }
  // Still to find songs for: say so here when one is added or fixed.
  assert.deepEqual(zeroExact, ['KL-A-Minor-9']);
  for (const chart of TRADITIONAL_CHARTS) {
    for (const key of chart.keys) {
      const have = new Set(instrumentFromChart(chart.id, key.id).chambers.flatMap(c => [...c.notes, ...(c.overblow ?? [])]));
      assert.ok(playableSongs(have).length >= 1, `${chart.id} ${key.id} has a song that fits`);
    }
  }
});

test('the songs on few notes fit the instruments they were added for', () => {
  const drum = id => haveOf(LAYOUT_FAMILIES['tongue-drum'].tunings.find(t => t.id === id));
  const fits = (id, have) => songShift(song(id), have) != null;
  assert.ok(fits('a-la-claire-fontaine', drum('TD-C-Major-Pentatonic-8')));
  assert.ok(fits('kagome-kagome', drum('TD-A-Minor-Pentatonic-8')));
  assert.ok(fits('a-la-claire-fontaine', drum('TD-C-Major-Pentatonic-6')));
  assert.ok(fits('edo-komoriuta', drum('TD-D-Akebono-8')));
  assert.ok(fits('edo-komoriuta', haveOf(SCALES.find(x => x.id === 'D-Akebono'))));
  for (const id of ['hot-cross-buns', 'rain-rain-go-away', 'michael-row-the-boat-ashore', 'ye-banks-and-braes', 'suo-gan', 'a-la-claire-fontaine', 'zum-gali-gali', 'mo-li-hua', 'kagome-kagome', 'toryanse', 'edo-komoriuta']) {
    const s = song(id);
    assert.ok(s, id);
    assert.ok(SONG_ORIGINS[s.origin]);
    // Whole bars: the notes fill the song's time (a last bar may be cut short by a rest).
    const [n, d] = s.time.split('/').map(Number);
    const beats = songNotes(s).reduce((a, x) => a + x.beats, 0) - (s.pickup ?? 0);
    const bars = beats / ((n * 4) / d);
    assert.ok(Math.ceil(bars) - bars < 0.51, `${id}: ${bars} bars`);
  }
});

test('songsInOrder: known everywhere, then the visitor\'s own, then the rest', () => {
  for (const id of SONG_WORLD) assert.ok(song(id), id);
  const en = songsInOrder(SONGS, ['en-GB', 'en']);
  assert.equal(en.length, SONGS.length);
  assert.deepEqual(en.slice(0, SONG_WORLD.length).map(s => s.id).sort(), [...SONG_WORLD].sort());
  const home = new Set(songHomeOrigins(['en']));
  const rest = en.slice(SONG_WORLD.length);
  const firstOther = rest.findIndex(s => !home.has(s.origin));
  assert.ok(firstOther > 10, 'English, Scottish, Irish, American songs come next');
  assert.ok(rest.slice(firstOther).every(s => !home.has(s.origin)));
  // Each group keeps the catalogue's order.
  const idx = s => SONGS.indexOf(s);
  for (const group of [en.slice(0, SONG_WORLD.length), rest.slice(0, firstOther), rest.slice(firstOther)]) {
    assert.deepEqual(group.map(idx), group.map(idx).sort((a, b) => a - b));
  }
  const de = songsInOrder(SONGS, ['de-AT']).slice(SONG_WORLD.length);
  assert.ok(['de', 'at', 'ch'].includes(de[0].origin));
  assert.deepEqual(songsInOrder(SONGS, []).slice(SONG_WORLD.length).map(idx), songsInOrder(SONGS, ['xx']).slice(SONG_WORLD.length).map(idx));
  assert.deepEqual(songHomeOrigins(['lv', 'en-US']).slice(0, 1), ['lv']);
});

test('Popular: the Latvian collection only where Latvian is read', () => {
  assert.ok(!songsForFilter('popular').some(s => s.origin === 'lv'));
  assert.ok(!songsForFilter('popular', SONGS, { languages: ['en-GB'] }).some(s => s.origin === 'lv'));
  assert.equal(songsForFilter('popular', SONGS, { languages: ['lv', 'en'] }).filter(s => s.origin === 'lv').length, 13);
  assert.equal(songsForFilter('origin:lv').length, 13);
});

// The reader that turns a published score into the catalogue's notes.
test('song-from-score: relative pitches, lengths, dots, ties, rests', () => {
  const r = readMelody(String.raw`\relative c' { \key g \major \time 3/4 \partial 4 d4 | g2 b8 g | b2. ~ | b4 r a | d,2. \bar "|." }`);
  assert.equal(r.notes, 'D4:1 G4:2 B4:0.5 G4:0.5 B4:4 r:1 A4:1 D4:3');
  assert.equal(r.time, '3/4');
  assert.equal(r.key, 'g major');
  assert.equal(r.pickup, 1);
});

test('song-from-score: \\fixed, a bare length, accidentals, German names', () => {
  assert.equal(readMelody(String.raw`\fixed c' { g4 8 a( g) fis bes d'2 }`).notes, 'G4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 Bb4:0.5 D5:2');
  assert.equal(readMelody('\\language "deutsch"\n\\relative c\'\' { h4 b a2 }').notes, 'B4:1 Bb4:1 A4:2');
  assert.equal(readMelody(String.raw`\relative c'' { a4 h a2 }`).notes, 'A4:1 B4:1 A4:2', 'h without saying so is German too');
});

test('song-from-score: repeats in written order, endings, named parts, lyrics left out', () => {
  const r = readMelody(String.raw`
global = { \key c \major \time 4/4 }
tune = \relative c' { \global \set Staff.midiInstrument = "flute"
  \repeat volta 2 { c4 e g c } \alternative { { b2 g } { c1 } } }
words = \lyricmode { la la la la la la }
\score { << \new Staff { \tune } \addlyrics { \words } >> }`, { voice: 'tune' });
  assert.equal(r.notes, 'C4:1 E4:1 G4:1 C5:1 B4:2 G4:2 C4:1 E4:1 G4:1 C5:1 C5:4');
  assert.equal(r.time, '4/4');
  assert.equal(readMelody(String.raw`\relative c' { \repeat unfold 2 { c8 d } \times 2/3 { e8 f g } \transpose c d { c4 } }`).notes,
    'C4:0.5 D4:0.5 C4:0.5 D4:0.5 E4:0.3333 F4:0.3333 G4:0.3333 D5:1');
  assert.deepEqual(scoreBlocks('x <score sound="1">\\relative c\' { c4 }</score> y <score>{ d4 }</score>').length, 2);
});
