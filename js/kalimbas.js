// Kalimbas (thumb pianos): the tunings makers sell, in the handpan scales'
// shape (data.js, SCALES) so the handpan engine works for them unchanged,
// like the tongue drums (js/tonguedrums.js). Only the picture differs: keys
// (tines) over a bridge (js/pan.js, renderPan).
//
// Every tuning comes from a maker's or shop's published listing, noted in
// `sources` (CLAUDE.md: never from memory). Notes are lowest first.
// `order` is the keys left to right as the player holds it, where the source
// shows it; without one, the standard modern layout is drawn: the lowest key
// in the middle (just right of it on an even count), then up the scale
// alternately one to the left and one to the right
// (https://www.kalimbamagic.com/blog/item/how-does-the-kalimba-relate-to-the-piano,
// https://www.kalimbamagic.com/info/how-to-play/how-to-play-the-alto-kalimba).
//
// Octaves: Hluru and Hokema write them as published (scientific and Helmholtz
// notation); Meinl's own labels are one octave low against the same models'
// stated ranges (Sela SE 241 "c' - e'' (C4 - E5)" next to Meinl's 10 notes),
// so its layouts are read an octave up. Unverified tunings (Gecko's B, the
// Hokema 17 in G without octaves) are left out until a source gives notes.
//
// Pure data; unit tested in Node (tests/kalimbas.test.mjs).

const KM_LAYOUT = 'https://www.kalimbamagic.com/blog/item/how-does-the-kalimba-relate-to-the-piano';

function kl(id, { name, slug, family, desc, notes, order = null, sources }) {
  const [ding, ...rest] = notes;
  return {
    // The key it is sold in (the makers' names: "C major", "in G"), which is
    // not always its lowest key: a 21-key C kalimba starts on F3.
    id, name, slug, family, desc, order, sources, instrument: 'kalimba', key: id.split('-')[1],
    top: { ding, notes: rest, capacity: rest.length },
    bottom: { notes: [], capacity: 0 },
  };
}

export const KALIMBAS = [
  kl('KL-C-Major-17', {
    name: 'C Major (17)', slug: 'c-major-17', family: 'Major',
    desc: 'The classic kalimba: C4 to E6. Most songbooks and tabs are written for it.',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'],
    order: ['D6', 'B5', 'G5', 'E5', 'C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6'],
    sources: [
      { maker: 'Hokema', model: 'B17 C major', url: 'https://www.hokema.de/en/products/hokema-kalimba-b17-c-dur-432-hz' },
      { maker: 'Hluru', model: '17 keys C major', url: 'https://www.hluru.net/products/hluru-17-keys-sapele-c-major-kalimba-fan-shaped' },
      { maker: 'Meinl Sonic Energy', model: 'KL1704S', url: 'https://www.meinlshop.de/en/MEINL-Sonic-Energy-Solid-Kalimba-17-notes-maple-KL1704S/KL1704S' },
      { maker: 'Sela', model: 'SE 246', url: 'https://www.thomannmusic.com/sela_se_246_kalimba_black_17.htm' },
      { maker: 'Thomann', model: 'TK17-R', url: 'https://www.thomannmusic.com/thomann_tk17_r_kalimba.htm' },
    ],
  }),
  kl('KL-C-Major-21', {
    name: 'C Major (21)', slug: 'c-major-21', family: 'Major',
    desc: 'The 17-key C kalimba with four lower keys, from F3: room for bass notes under the melody.',
    notes: ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'],
    order: ['D6', 'B5', 'G5', 'E5', 'C5', 'A4', 'F4', 'D4', 'B3', 'G3', 'F3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6'],
    sources: [
      { maker: 'Hluru', model: '21 keys C major', url: 'https://www.hluru.net/products/hluru-21-keys-sandalwood-c-major-kalimba-for-relaxation-round-edge-box' },
      { maker: 'Meinl Sonic Energy', model: '21 notes, solid walnut', url: 'https://www.thomann.co.uk/meinl_21_notes_solid_walnut_kalimba.htm' },
      { maker: 'Thomann', model: 'TK21-WT', url: 'https://www.thomann.de/de/thomann_tk21_wt_walnut_kalimba.htm' },
    ],
  }),
  kl('KL-C-Major-10', {
    name: 'C Major (10)', slug: 'c-major-10', family: 'Major',
    desc: 'A small C kalimba, C4 to E5: a full scale and a little more.',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'],
    order: ['E5', 'C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4', 'D5'],
    sources: [
      { maker: 'Meinl Sonic Energy', model: '10 notes, solid redwood', url: 'https://www.thomann.co.uk/meinl_10_notes_solid_redwood_kalimba.htm' },
      { maker: 'Sela', model: 'SE 241', url: 'https://www.thomannmusic.com/sela_se_241_kalimba_black_10.htm' },
    ],
  }),
  kl('KL-C-Major-8', {
    name: 'C Major (8)', slug: 'c-major-8', family: 'Major',
    desc: 'Eight keys, one octave of C major: the simplest kalimba to start on.',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    order: ['C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4'],
    sources: [
      { maker: 'Hluru', model: '8 keys C major', url: 'https://www.hluru.net/products/hluru-8-keys-walnut-totoro-kalimba' },
      { maker: 'Meinl Sonic Energy', model: '8 notes, solid walnut', url: 'https://www.thomannmusic.com/meinl_8_notes_solid_walnut_kalimba.htm' },
      { maker: 'Kalimba Magic', model: 'Standard 8-note C major tuning', url: 'https://www.kalimbamagic.com/info/how-to-play/how-to-play-the-8-note-kalimba' },
    ],
  }),
  kl('KL-C-Pentatonic-8', {
    name: 'C Pentatonic (8)', slug: 'c-pentatonic-8', family: 'Major Pentatonic',
    desc: 'Eight high keys in C pentatonic (G4 to C6): every combination sounds good.',
    notes: ['G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
    sources: [{ maker: 'Hluru', model: '8 keys maple, C5 major', url: 'https://www.hluru.net/products/hluru-8-key-maple-c-major-small-kalimba' }],
  }),
  kl('KL-G-Alto-15', {
    name: 'Alto in G (15)', slug: 'alto-g-15', family: 'Hugh Tracey',
    desc: 'Hugh Tracey Alto, G3 to G5: the warm, classic African-made kalimba. The low G sits just right of the middle.',
    notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'],
    order: ['F#5', 'D5', 'B4', 'G4', 'E4', 'C4', 'A3', 'G3', 'B3', 'D4', 'F#4', 'A4', 'C5', 'E5', 'G5'],
    sources: [
      { maker: 'Hugh Tracey (Kalimba Magic)', model: 'Alto, standard G tuning chart', url: 'https://www.kalimbamagic.com/info/how-to-play/how-to-play-the-alto-kalimba' },
      { maker: 'Kalimba Magic', model: 'Alto range G3 to G5', url: 'https://www.kalimbamagic.com/blog/item/what-is-the-difference-between-alto-kalimba-treble-kalimba-17-note-kalimba-in-c' },
    ],
  }),
  kl('KL-G-Treble-17', {
    name: 'Treble in G (17)', slug: 'treble-g-17', family: 'Hugh Tracey',
    desc: 'Hugh Tracey Treble, B3 to D6, in G. Its lowest key is B, not G.',
    notes: ['B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C6', 'D6'],
    order: ['C6', 'A5', 'F#5', 'D5', 'B4', 'G4', 'E4', 'C4', 'B3', 'D4', 'F#4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6'],
    sources: [
      { maker: 'Hugh Tracey (Kalimba Magic)', model: 'Treble, standard G tuning chart', url: 'https://www.kalimbamagic.com/info/how-to-play/how-to-play-the-treble-kalimba' },
      { maker: 'Kalimba Magic', model: 'Treble range B3 to D6', url: 'https://www.kalimbamagic.com/blog/item/what-is-the-difference-between-alto-kalimba-treble-kalimba-17-note-kalimba-in-c' },
    ],
  }),
  kl('KL-A-Minor-9', {
    name: 'Sansula A Minor (9)', slug: 'sansula-a-minor-9', family: 'Minor',
    desc: 'Hokema Sansula and Kalimba B9: A minor, with A4 on two keys. Dreamy and soft.',
    notes: ['A3', 'C4', 'E4', 'F4', 'A4', 'A4', 'B4', 'C5', 'E5'],
    order: ['A4', 'C5', 'C4', 'A4', 'A3', 'F4', 'E4', 'E5', 'B4'],
    sources: [
      { maker: 'Hokema', model: 'Kalimba B9', url: 'https://www.hokema.de/en/products/kalimba-b9' },
      { maker: 'Hokema', model: 'Sansula Basic', url: 'https://www.hokema.de/en/products/hokema-sansula-basic-a-moll-a-c-c-a-a-f-e-e-b-standard-432-hz' },
    ],
  }),
  kl('KL-G-Major-11', {
    name: 'G Major (11)', slug: 'g-major-11', family: 'Major',
    desc: 'Hokema B11 and Sansula "Melody": G major from G3, for tunes.',
    notes: ['G3', 'D4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5'],
    order: ['G5', 'A4', 'E5', 'D4', 'C5', 'G3', 'D5', 'G4', 'F#5', 'B4', 'A5'],
    sources: [
      { maker: 'Hokema', model: 'Kalimba B11 "Melody" G major', url: 'https://www.hokema.de/en/products/kalimba-b11-melody-g-dur-432hz' },
      { maker: 'Hokema', model: 'Sansula Basic "Melody"', url: 'https://www.hokema.de/en/products/hokema-sansula-basic-melody' },
    ],
  }),
  kl('KL-C-Pentatonic-7', {
    name: 'C Pentatonic (7)', slug: 'c-pentatonic-7', family: 'Major Pentatonic',
    desc: 'Hokema B7: seven low keys in C pentatonic, from E3.',
    notes: ['E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'A4'],
    order: ['E4', 'G3', 'D4', 'E3', 'C4', 'A3', 'A4'],
    sources: [{ maker: 'Hokema', model: 'Kalimba B7 C pentatonic', url: 'https://www.hokema.de/en/products/kalimba-b7' }],
  }),
];

export function isKalimbaId(id) { return String(id).startsWith('KL-'); }

// The keys left to right: the tuning's own order, or the standard layout
// (lowest in the middle, then alternately left and right going up).
export function kalimbaOrder(notes) {
  const n = notes.length;
  const out = new Array(n);
  const mid = Math.floor(n / 2); // odd: the centre; even: just right of it
  notes.forEach((note, i) => {
    const k = Math.ceil(i / 2);
    const pos = i === 0 ? mid : i % 2 === 1 ? mid - k : mid + k;
    out[pos] = note;
  });
  return out;
}

export { KM_LAYOUT };
