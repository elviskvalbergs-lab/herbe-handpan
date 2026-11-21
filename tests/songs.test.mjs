// Unit tests for js/songs.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, createLayoutFromScale, getAllNotes, noteToMidi } from '../js/data.js';
import { instrumentFromChart } from '../js/charts.js';
import { SONGS, SONG_ORIGINS, songNotes, songShift, playableSongs, songKeyOn, songsThatGoTogether } from '../js/songs.js';

test('every song has a source, an origin, a key and notes that read', () => {
  assert.ok(SONGS.length >= 50);
  const ids = new Set();
  for (const s of SONGS) {
    assert.ok(!ids.has(s.id), s.id); ids.add(s.id);
    assert.match(s.source, /^https:\/\/(de|en|fr)\.wikipedia\.org\/wiki\//);
    assert.ok(SONG_ORIGINS[s.origin], s.id);
    assert.match(s.key, /^[A-G][♭♯]? (major|minor)$/);
    const notes = songNotes(s);
    assert.ok(notes.length > 15, s.id);
    for (const n of notes) {
      assert.ok(n.midi === null || (n.midi >= 48 && n.midi <= 96), `${s.id}: ${n.midi}`);
      assert.ok(n.beats > 0 && n.beats <= 6, `${s.id}: ${n.beats}`);
    }
  }
});

test('Alle meine Entchen as the score gives it', () => {
  const s = SONGS.find(x => x.id === 'alle-meine-entchen');
  assert.equal(s.notes.split(' ').slice(0, 7).join(' '), 'C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:1 G4:1 A4:0.5');
});

test('a song is moved to where the instrument has all its notes', () => {
  const kurd = SCALES.find(x => x.id === 'D-Kurd');
  const have = new Set(getAllNotes(createLayoutFromScale(kurd)).map(noteToMidi));
  assert.equal(songShift(SONGS.find(x => x.id === 'alle-meine-entchen'), have), 0);
  const ok = playableSongs(have);
  assert.ok(ok.length >= 4 && ok.length < SONGS.length, 'some, not all, on a D Kurd');
  for (const { song, shift } of ok) {
    for (const n of songNotes(song)) if (n.midi != null) assert.ok(have.has(n.midi + shift), `${song.id} ${n.midi + shift}`);
  }
  const whistle = instrumentFromChart('tin-whistle-d', 'D');
  assert.equal(playableSongs(new Set(whistle.chambers[0].notes)).length, SONGS.length, 'a whistle plays them all');
  assert.equal(songKeyOn(SONGS.find(x => x.id === 'haenschen-klein'), -5), 'C major');
});

test('songs that go together: the same key on the instrument first', () => {
  const whistle = instrumentFromChart('tin-whistle-d', 'D');
  const ok = playableSongs(new Set(whistle.chambers[0].notes));
  const song = SONGS.find(x => x.id === 'alle-voegel-sind-schon-da');
  const next = songsThatGoTogether(song, ok);
  const key = songKeyOn(song, ok.find(x => x.song.id === song.id).shift);
  assert.equal(next.length, 3);
  assert.equal(songKeyOn(next[0].song, next[0].shift), key);
});

test('on a whistle, songs go to keys without half-covered holes where they can', async () => {
  const { fingeringFor } = await import('../js/ocarina-ui.js');
  const whistle = instrumentFromChart('tin-whistle-d', 'D');
  const have = new Set(whistle.chambers[0].notes);
  const easy = new Set([...have].filter(m => !fingeringFor(whistle, m)?.states?.includes('h')));
  const ok = playableSongs(have, SONGS, { easy });
  const air = ok.find(x => x.song.id === 'londonderry-air');
  const hard = songNotes(air.song).filter(n => n.midi != null && !easy.has(n.midi + air.shift)).length;
  const plain = songNotes(air.song).filter(n => n.midi != null && !easy.has(n.midi + songShift(air.song, have))).length;
  assert.ok(hard <= plain, `${hard} half-holed notes, against ${plain} without the preference`);
});

test('the best-known songs come first, and a few openings are as the scores give them', () => {
  assert.deepEqual(SONGS.slice(0, 3).map(s => s.id), ['ode-to-joy', 'twinkle-twinkle', 'happy-birthday']);
  const start = (id, n) => SONGS.find(s => s.id === id).notes.split(' ').slice(0, n).map(t => t.split(':')[0]).join(' ');
  assert.equal(start('ode-to-joy', 8), 'B4 B4 C5 D5 D5 C5 B4 A4');
  assert.equal(start('twinkle-twinkle', 7), 'C4 C4 G4 G4 A4 A4 G4');
  assert.equal(start('frere-jacques', 4), 'D4 E4 F#4 D4');
  assert.equal(start('amazing-grace', 3), 'D4 G4 B4', 'the pickup rests are dropped');
});

test('Christmas songs: tagged, and first in the list in season', async () => {
  const { christmasSongs, christmasSeason } = await import('../js/songs.js');
  const xmas = christmasSongs();
  assert.ok(xmas.length >= 30);
  for (const id of ['silent-night', 'o-du-froehliche', 'kling-gloeckchen', 'we-three-kings', 'in-dulci-jubilo']) assert.ok(xmas.some(s => s.id === id), id);
  assert.ok(!xmas.some(s => s.id === 'ode-to-joy'));
  assert.equal(christmasSeason(new Date('2026-12-10')), true);
  assert.equal(christmasSeason(new Date('2027-01-05')), true);
  assert.equal(christmasSeason(new Date('2026-07-01')), false);
  const start = id => SONGS.find(s => s.id === id).notes.split(' ').slice(0, 6).map(t => t.split(':')[0]).join(' ');
  assert.equal(start('kling-gloeckchen'), 'C5 A4 Bb4 C5 D5 C5', 'German note names read as German');
  assert.equal(start('o-du-froehliche'), 'G4 A4 G4 F4 E4 F4');
});

test('a rest written at a pitch is a rest (Silent Night)', () => {
  const s = SONGS.find(x => x.id === 'silent-night');
  assert.equal(s.notes.split(' ').slice(0, 6).join(' '), 'A4:0.75 B4:0.25 A4:0.5 F#4:1 r:0.5 A4:0.75');
});
