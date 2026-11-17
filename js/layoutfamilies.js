// The instruments drawn and played as a layout (a lowest note and a ring or
// row of notes): handpans, tongue drums and kalimbas. They share every
// screen of the handpan engine (Chords, the instrument tab, Playlists,
// Listen, the setup, saving, links); what differs between them is here, in
// one place, so a new one of this kind is one entry plus its data file and
// its picture (CLAUDE.md, "Adding an instrument").
import { SCALES } from './data.js';
import { TONGUE_DRUMS } from './tonguedrums.js';
import { KALIMBAS } from './kalimbas.js';

// maxNotes: the most notes besides the lowest (a handpan shell, a tongue
// drum's or kalimba's other tongues or keys).
export const LAYOUT_FAMILIES = {
  handpan: {
    tunings: SCALES, word: 'handpan', name: 'Handpan', tab: 'Pan', idPrefix: '', maxNotes: 12, voice: 'handpan',
    first: 'big note in the middle', each: 'note around it', firstShort: 'the big note in the middle',
    knowTitle: 'Which note is in the middle?', thing: 'note',
    knowSub: 'It’s usually written on the sticker or the box: the first letter of the scale name, like the D in “D Kurd”.',
  },
  'tongue-drum': {
    tunings: TONGUE_DRUMS, word: 'tongue drum', name: 'Tongue drum', tab: 'Drum', idPrefix: 'TD-', maxNotes: 15, voice: 'tongue-drum',
    first: 'lowest note (the biggest tongue)', each: 'tongue', firstShort: 'the lowest note',
    knowTitle: 'What’s its lowest note?', thing: 'tongue',
    knowSub: 'It’s usually written on the sticker or the box: the first letter of the scale name, like the D in “D Kurd”.',
  },
  kalimba: {
    tunings: KALIMBAS, word: 'kalimba', name: 'Kalimba', tab: 'Keys', idPrefix: 'KL-', maxNotes: 20, voice: 'kalimba',
    first: 'lowest note (the longest key, in the middle)', each: 'key', firstShort: 'the lowest note',
    knowTitle: 'What key is it in?', thing: 'key',
    knowSub: 'It’s usually printed on the box or the keys, like the C in “C major, 17 keys”.',
  },
};

export const LAYOUT_FAMILY_IDS = Object.keys(LAYOUT_FAMILIES);

export function isLayoutFamily(family) { return Object.hasOwn(LAYOUT_FAMILIES, family); }

// Which layout family a tuning id belongs to.
export function familyOfTuningId(id) {
  const s = String(id);
  return LAYOUT_FAMILY_IDS.find(f => LAYOUT_FAMILIES[f].idPrefix && s.startsWith(LAYOUT_FAMILIES[f].idPrefix)) ?? 'handpan';
}

// A tuning by id, from any layout family.
export function findTuning(id) {
  return LAYOUT_FAMILIES[familyOfTuningId(id)].tunings.find(t => t.id === id) ?? null;
}

// Which family a layout is ('handpan' when it doesn't say).
export function layoutInstrument(layout) {
  const f = layout?.instrument;
  return f && isLayoutFamily(f) ? f : 'handpan';
}

export function layoutFamilyInfo(family) { return LAYOUT_FAMILIES[isLayoutFamily(family) ? family : 'handpan']; }
