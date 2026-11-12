// Matching for the searchable picker (uiPicker in app.js): which options a
// typed query keeps. Every word of the query must match a word of the
// option's label, group or keywords, in any order, ignoring case and
// diacritics ("kurd 10", "d k", "pygmy 17", "f#", "fa#", "re4").
//
// Pure functions; unit tested in Node (tests/pickmatch.test.mjs).

import { displayNote } from './data.js';

// Lower case, without diacritics, ♯ → #, ♭ → b.
export function pickFold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase();
}

// The words of a text: letters, digits and #, split on anything else.
export function pickWords(s) {
  return pickFold(s).split(/[^a-z0-9#]+/).filter(Boolean);
}

// What a query is matched against for one option { label, group, keywords }.
export function pickIndex(opt) {
  const text = [opt.label, opt.group, ...(opt.keywords ?? [])].filter(Boolean).join(' ');
  return { words: pickWords(text), text: pickFold(text) };
}

// A note as a word: name (letter or solfège), accidental, octave.
const PICK_NOTE = /^([a-g]|do|re|mi|fa|sol|la|si)(#|b)?(\d*)$/;

// A query word matches the start of a word ("pyg" → "Pygmy", "e4" → "E4");
// one of three or more letters also matches inside a word ("ziska"). A note
// matches only the same note: "d" finds D and D3 but not Db or Do#, "fa#"
// finds Fa#3.
function pickWordMatch(t, words, text) {
  const tn = t.match(PICK_NOTE);
  return words.some(w => {
    const wn = tn && w.match(PICK_NOTE);
    if (wn) return tn[1] === wn[1] && (tn[2] ?? '') === (wn[2] ?? '') && wn[3].startsWith(tn[3]);
    return w.startsWith(t);
  }) || (!tn && t.length >= 3 && text.includes(t));
}

export function pickMatches(query, index) {
  return pickWords(query).every(t => pickWordMatch(t, index.words, index.text));
}

// The options a query keeps, in their order.
export function pickFilter(options, query) {
  if (!pickWords(query).length) return options.slice();
  return options.filter(o => pickMatches(query, pickIndex(o)));
}

// A note in every spelling a user might type: sharps, flats and solfège
// ('F#3' → F#3, Gb3, Fa#3, Solb3), so a search finds it whatever notation
// the app shows.
export function noteSearchWords(note) {
  const out = [];
  for (const us of [false, true]) {
    for (const uf of [false, true]) {
      const n = displayNote(note, uf, us);
      if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}
