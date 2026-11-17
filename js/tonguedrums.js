// Steel tongue drums: the tunings makers sell, in the same shape as the
// handpan scales in data.js (SCALES), so the handpan engine (chords,
// playlists, Listen, the setup, links) works for them unchanged. Only the
// picture differs: tongues instead of dents (js/pan.js, renderPan).
//
// Every tuning comes from a maker's published listing, noted in `sources`
// (CLAUDE.md: never from memory). Notes are listed lowest first; `top.ding`
// is the lowest note. `centre: true` means that note is a tongue in the
// middle of the drum (as on handpan-style tongue drums such as RAV Vast);
// otherwise every tongue sits around the edge.
//
// Pure data; unit tested in Node (tests/tonguedrums.test.mjs).

import { SCALES } from './data.js';

const SELA_CATALOGUE = 'https://selapercussion.com/wp-content/uploads/SELA-World-Of-Sounds-Catalog-2024.pdf';

function td(id, { name, slug, family, desc, centre = false, notes, sources }) {
  const [ding, ...rest] = notes;
  return {
    id, name, slug, family, desc, centre, sources, instrument: 'tongue-drum',
    top: { ding, notes: rest, capacity: rest.length },
    bottom: { notes: [], capacity: 0 },
  };
}

export const TONGUE_DRUMS = [
  td('TD-C-Major-Pentatonic-6', {
    name: 'C Major Pentatonic (6)', slug: 'c-major-pentatonic-6', family: 'Major Pentatonic',
    desc: 'Six high, bright tongues. The friendliest first drum: nothing sounds wrong.',
    notes: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
    sources: [{ maker: 'Sela', model: 'SE352', url: SELA_CATALOGUE }],
  }),
  td('TD-C-Major-8', {
    name: 'C Major (8)', slug: 'c-major-8', family: 'Major',
    desc: 'A full major scale, C to C. Plays children’s songs and simple melodies.',
    notes: ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'],
    sources: [{ maker: 'Sela', model: 'SE360', url: SELA_CATALOGUE }],
  }),
  td('TD-D-Major-8', {
    name: 'D Major (8)', slug: 'd-major-8', family: 'Major',
    desc: 'A full major scale, D to D. Bright and singable.',
    notes: ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6'],
    sources: [{ maker: 'Sela', model: 'SE361', url: SELA_CATALOGUE }],
  }),
  td('TD-C-Major-Pentatonic-8', {
    name: 'C Major Pentatonic (8)', slug: 'c-major-pentatonic-8', family: 'Major Pentatonic',
    desc: 'Low and warm pentatonic over two octaves.',
    notes: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4'],
    sources: [{ maker: 'Sela', model: 'SE372', url: SELA_CATALOGUE }],
  }),
  td('TD-D-Akebono-8', {
    name: 'D Akebono (8)', slug: 'd-akebono-8', family: 'Akebono',
    desc: 'Japanese pentatonic: calm, a little mysterious.',
    notes: ['D3', 'E3', 'F3', 'A3', 'Bb3', 'D4', 'E4', 'F4'],
    sources: [{ maker: 'Sela', model: 'SE371', url: SELA_CATALOGUE }],
  }),
  td('TD-D-Kurd-9', {
    name: 'D Kurd (9)', slug: 'd-kurd-9', family: 'Kurd', centre: true,
    desc: 'The handpan favourite on a tongue drum: deep D in the middle, natural minor around it.',
    notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    sources: [{ maker: 'Sela', model: 'SE380', url: SELA_CATALOGUE }],
  }),
  td('TD-D-Amara-9', {
    name: 'D Amara (9)', slug: 'd-amara-9', family: 'Amara', centre: true,
    desc: 'Also sold as D Celtic Minor. Soft, folky minor with a deep D in the middle.',
    notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
    sources: [
      { maker: 'Sela', model: 'SE381', url: SELA_CATALOGUE },
      { maker: 'Meinl Sonic Energy', model: 'OSTD2NBE', url: 'https://www.meinlshop.de/en/Meinl-Sonic-Energy-16-Octave-Steel-Tongue-Drum-D-Amara-9-Notes-440-Hz-Lasered-Floral-Design-Navy-Blue-OSTD2NBE/OSTD2NBE' },
      { maker: 'RAV Vast', model: 'D Celtic Minor', url: 'https://ravvast.com/products/rav-vast-d-celtic-minor-arm' },
    ],
  }),
  td('TD-C-Minor-11', {
    name: 'C Minor (11)', slug: 'c-minor-11', family: 'Minor',
    desc: 'A natural minor over almost two octaves, with low C and G.',
    notes: ['C3', 'G3', 'Ab3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
    sources: [{ maker: 'Sela', model: 'SETD13U1', url: SELA_CATALOGUE }],
  }),
  td('TD-C-Major-11', {
    name: 'C Major (11)', slug: 'c-major-11', family: 'Major',
    desc: 'A major scale over almost two octaves, with low C and G.',
    notes: ['C3', 'G3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'D5'],
    sources: [{ maker: 'Sela', model: 'SETD13U2', url: 'https://www.thomann.ie/sela_tongue_drum_setd13u2.htm' }],
  }),
  td('TD-G-Major-Pentatonic-8', {
    name: 'G Major Pentatonic (8)', slug: 'g-major-pentatonic-8', family: 'Major Pentatonic',
    desc: 'Sold as G Major. Sunny pentatonic, easy to play along with songs in G.',
    notes: ['G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4'],
    sources: [{ maker: 'Meinl Sonic Energy', model: 'STD3VB', url: 'https://www.meinlshop.de/en/Meinl-Sonic-Energy-12-Steel-Tongue-Drum-G-Major-8-Notes-440-Hz-Vintage-Brown-STD3VB/STD3VB' }],
  }),
  td('TD-A-Minor-Pentatonic-8', {
    name: 'A Minor Pentatonic (8)', slug: 'a-minor-pentatonic-8', family: 'Minor Pentatonic',
    desc: 'Sold as A Minor. Gentle minor pentatonic, the classic meditation drum.',
    notes: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'],
    sources: [{ maker: 'Meinl Sonic Energy', model: 'STD1VB', url: 'https://www.meinlshop.de/en/meinl-sonic-energy/steel-tongue-drums/meinl-sonic-energy-steel-tongue-drum-vintage-brown-a-minor-std1vb?c=330' }],
  }),
  td('TD-D-Major-9', {
    name: 'D Major (9)', slug: 'd-major-9', family: 'Major', centre: true,
    desc: 'Bright major with a deep D in the middle.',
    notes: ['D3', 'G3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'A4'],
    sources: [{ maker: 'RAV Vast', model: 'D Major', url: 'https://ravvast.com/products/rav-vast-d-major-indigo' }],
  }),
  td('TD-B-Celtic-Minor-9', {
    name: 'B Celtic Minor (9)', slug: 'b-celtic-minor-9', family: 'Celtic Minor', centre: true,
    desc: 'Soft, folky minor with a deep B in the middle.',
    notes: ['B2', 'F#3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'A4'],
    sources: [{ maker: 'RAV Vast', model: 'B Celtic Minor', url: 'https://ravvast.com/products/rav-vast-b-celtic-minor-indigo' }],
  }),
  td('TD-B-Kurd-10', {
    name: 'B Kurd (10)', slug: 'b-kurd-10', family: 'Kurd', centre: true,
    desc: 'Natural minor with a deep B in the middle.',
    notes: ['B2', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'A4'],
    sources: [{ maker: 'RAV Vast', model: 'B Kurd', url: 'https://ravvast.com/products/rav-vast-b-kurd-indigo' }],
  }),
  td('TD-G-Pygmy-9', {
    name: 'G Pygmy (9)', slug: 'g-pygmy-9', family: 'Pygmy', centre: true,
    desc: 'Dark, earthy pentatonic with a very deep G in the middle.',
    notes: ['G2', 'C3', 'D3', 'Eb3', 'G3', 'Bb3', 'C4', 'D4', 'F4'],
    sources: [{ maker: 'RAV Vast', model: 'G Pygmy', url: 'https://ravvast.com/products/rav-vast-g-pygmy-arm' }],
  }),
  td('TD-E-Minor-Pentatonic-10', {
    name: 'E Minor Pentatonic (10)', slug: 'e-minor-pentatonic-10', family: 'Minor Pentatonic',
    desc: 'Minor pentatonic over two octaves.',
    notes: ['E3', 'G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5'],
    sources: [{ maker: 'Idiopan', model: 'Dominus', url: 'https://idiopan.com/products/idiopan-dominus' }],
  }),
  td('TD-A-Akebono-8', {
    name: 'A Akebono (8)', slug: 'a-akebono-8', family: 'Akebono',
    desc: 'Japanese pentatonic in A: calm and a little mysterious.',
    notes: ['A3', 'B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5'],
    sources: [{ maker: 'Asian Sound', model: 'Hapi Slim A Akebono', url: 'https://www.thomann.co.uk/asian_sound_hapi_slim_a_akebono.htm' }],
  }),
  td('TD-D-Kurd-15', {
    name: 'D Kurd (15)', slug: 'd-kurd-15', family: 'Kurd',
    desc: 'Two full octaves of D Kurd: room for melodies as well as chords.',
    notes: ['D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
    sources: [{ maker: 'Thomann', model: '14" EQ D Kurd 15', url: 'https://www.thomann.co.uk/thomann_tongue_drum_14_eq_d_kurd_440.htm' }],
  }),
];

export function isTongueDrumId(id) { return String(id).startsWith('TD-'); }

// A tuning by id: a handpan scale or a tongue drum.
export function findTuning(id) {
  return SCALES.find(s => s.id === id) ?? TONGUE_DRUMS.find(t => t.id === id) ?? null;
}

// Which instrument a layout is: 'handpan' or 'tongue-drum'.
export function layoutInstrument(layout) { return layout?.instrument === 'tongue-drum' ? 'tongue-drum' : 'handpan'; }
