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

// A layout that came from outside the app (a link's query, an instrument
// someone shared by code) with everything that reaches the picture checked:
// notes are note names or empty, sizes and positions are small numbers. The
// picture is drawn as SVG text, so nothing else may get in.
export const NOTE_NAME_RE = /^[A-G](#|b)?[0-9]$/;
export function safeNoteName(note) { return typeof note === 'string' && NOTE_NAME_RE.test(note) ? note : null; }
export function safeLayout(layout) {
  const src = layout && typeof layout === 'object' ? layout : {};
  const fam = isLayoutFamily(src.instrument) ? src.instrument : 'handpan';
  const max = LAYOUT_FAMILIES[fam].maxNotes;
  const shell = s => {
    const slots = (Array.isArray(s?.slots) ? s.slots : []).slice(0, max).map(x => ({ note: safeNoteName(x?.note) }));
    const cap = Number.isInteger(s?.capacity) ? s.capacity : slots.length;
    const capacity = Math.min(max, Math.max(cap, slots.length, 0));
    while (slots.length < capacity) slots.push({ note: null });
    return { slots, capacity };
  };
  const out = {
    ...src,
    id: typeof src.id === 'string' ? src.id.slice(0, 80) : 'custom',
    name: typeof src.name === 'string' ? src.name.slice(0, 80) : 'Custom Layout',
    top: { ding: safeNoteName(src.top?.ding) ?? 'D3', ...shell(src.top) },
    bottom: shell(src.bottom),
  };
  if (fam === 'handpan') delete out.instrument; else { out.instrument = fam; out.centre = src.centre === true; }
  delete out.pos;
  if (fam === 'handpan' && src.pos && typeof src.pos === 'object') {
    const pos = {};
    for (const [k, v] of Object.entries(src.pos)) {
      if (!/^(ding|ring-\d{1,2}|gu-\d{1,2})$/.test(k)) continue;
      const x = Math.round(Number(v?.x)), y = Math.round(Number(v?.y));
      if (x >= 0 && x <= 500 && y >= 0 && y <= 500) pos[k] = { x, y };
    }
    if (Object.keys(pos).length) out.pos = pos;
  }
  return out;
}
