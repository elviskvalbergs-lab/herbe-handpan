// Reads a melody out of the LilyPond score in a Wikipedia article, in the
// shape js/songs.js keeps ("C4:1 D4:0.5 r:1 …"). Melodies are never typed
// from memory (CLAUDE.md): this is how a published score becomes a song.
//
//   node scripts/song-from-score.mjs <article.txt> [--score N] [--voice name] [--json]
//
// article.txt: the article's wikitext (…/w/index.php?title=…&action=raw).
// --score N: which <score> block (0 is the first). --voice: the variable
// holding the tune when the score names its parts (melody = \relative …).
//
// Reads: \relative and \fixed, absolute pitches; Dutch note names (the
// LilyPond default: fis, bes, es, as) and English ones (fs, bf, f-sharp);
// durations with dots, ties, rests (r, s, R, also "bes4\rest"); \partial;
// \time and \key; \repeat volta / unfold with \alternative endings;
// \times and \tuplet; variables used inside the tune. Skips: grace notes,
// lyrics, chord names, markup. A chord <c e g> gives its top note.
// The result still has to be checked against the score by eye (the opening,
// the bar lengths): the reader prints each bar's length to help.

const STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function scoreBlocks(wikitext) {
  return [...wikitext.matchAll(/<score[^>]*>([\s\S]*?)<\/score>/g)].map(m => m[1]);
}

// The text from the brace at `i` to its match, without the braces.
function braced(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return { body: src.slice(i + 1, j), end: j + 1 };
  }
  throw new Error('unbalanced braces');
}

function clean(src) {
  src = src.replace(/%\{[\s\S]*?%\}/g, ' ').replace(/%.*$/gm, ' ').replace(/"[^"]*"/g, ' ');
  // Blocks that hold no tune.
  for (const word of ['\\\\addlyrics', '\\\\lyricmode', '\\\\chordmode', '\\\\header', '\\\\layout', '\\\\midi', '\\\\paper', '\\\\lyricsto\\s+\\S+', '\\\\new\\s+Lyrics', '\\\\new\\s+ChordNames', '\\\\chords', '\\\\lyrics', '\\\\markup', '\\\\with']) {
    const re = new RegExp(`${word}\\s*(?=\\{)`);
    for (let m; (m = re.exec(src));) {
      const { end } = braced(src, m.index + m[0].length);
      src = src.slice(0, m.index) + ' ' + src.slice(end);
    }
  }
  return src;
}

// name = … { … } definitions: { name: text after the '=' up to the end of its block }.
function variables(src) {
  const vars = {};
  const re = /(^|\n)\s*([A-Za-z]+)\s*=\s*/g;
  for (let m; (m = re.exec(src));) {
    const open = src.indexOf('{', re.lastIndex);
    if (open < 0) continue;
    const head = src.slice(re.lastIndex, open);
    if (/\n\s*\n/.test(head) || /=/.test(head)) continue;
    const { end } = braced(src, open);
    vars[m[2]] = src.slice(re.lastIndex, end);
    re.lastIndex = end;
  }
  return vars;
}

function pitchClass(name, german = false) {
  if (german) {
    if (name === 'h') return { step: 'b', alt: 0 };
    if (name === 'b') return { step: 'b', alt: -1 };
    if (name === 'his') return { step: 'b', alt: 1 };
  }
  // Dutch: cis, ces, es, as, bes, fisis; English: cs, cf, c-sharp, c-flat.
  let m = /^([a-g])((?:is|es)+|s+|f+|-sharp|-flat)?$/.exec(name);
  if (!m) {
    if (name === 'es' || name === 'ees') return { step: 'e', alt: -1 };
    if (name === 'as' || name === 'aes') return { step: 'a', alt: -1 };
    return null;
  }
  const acc = m[2] ?? '';
  let alt = 0;
  if (/^(is)+$/.test(acc)) alt = acc.length / 2;
  else if (/^(es)+$/.test(acc)) alt = -acc.length / 2;
  else if (acc === '-sharp') alt = 1;
  else if (acc === '-flat') alt = -1;
  else if (/^s+$/.test(acc)) alt = m[1] === 'a' || m[1] === 'e' ? -acc.length : acc.length; // "as"/"es" are flats in Dutch
  else if (/^f+$/.test(acc)) alt = -acc.length;
  return { step: m[1], alt };
}

// The octave of "c'" style marks: c' is C4 (MIDI 60).
const markOctave = marks => [...marks].reduce((o, ch) => o + (ch === "'" ? 1 : -1), 3);

/** A tune's wikitext block as { notes: "C4:1 …", time, key, pickup, bars }. */
export function readMelody(block, { voice = null } = {}) {
  const src = clean(block);
  const vars = variables(src);
  // German note names (h is B, b is B flat): when the score says so, or uses h.
  const german = /\\language\s+"deutsch"/.test(block) || /(^|[\s(\[])h(is)?[',]*\d*\.*(?=[\s~)\]|\\])/.test(src);
  let text;
  if (voice) {
    if (!vars[voice]) throw new Error(`no part named ${voice}: ${Object.keys(vars).join(', ')}`);
    text = vars[voice];
  } else {
    // Without named parts the whole block is the tune; with them, the first
    // one that is \relative or \fixed.
    const named = Object.entries(vars).find(([, v]) => /\\(relative|fixed)/.test(v));
    text = named && !/\\(relative|fixed)[^=]*\{/.test(src.replace(/(^|\n)\s*[A-Za-z]+\s*=[\s\S]*?\n\}/g, '')) ? named[1] : src;
  }
  const out = { time: null, key: null, pickup: 0, events: [] };
  const state = { mode: 'absolute', last: null, base: 0, dur: 1, scale: 1, german, shift: 0 };
  walk(text, vars, state, out, 0);
  // Ties: a note tied to the same pitch becomes one longer note.
  const notes = [];
  for (const e of out.events) {
    const prev = notes[notes.length - 1];
    if (prev?.tie && prev.midi === e.midi) { prev.beats += e.beats; prev.tie = e.tie; } else notes.push({ ...e });
  }
  // Rests before the first note and after the last are not part of the tune.
  while (notes.length && notes[0].midi == null) notes.shift();
  while (notes.length && notes[notes.length - 1].midi == null) notes.pop();
  const fmt = b => String(+b.toFixed(4));
  const name = m => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
  return {
    time: out.time, key: out.key, pickup: out.pickup,
    notes: notes.map(n => `${n.midi == null ? 'r' : name(n.midi)}:${fmt(n.beats)}`).join(' '),
    beats: notes.reduce((a, n) => a + n.beats, 0),
  };
}

function walk(text, vars, state, out, depth, firstOnly = false) {
  const had = out.events.length;
  if (depth > 8) throw new Error('parts nested too deep');
  let i = 0;
  const skipSpace = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const word = () => { skipSpace(); const m = /^[^\s{}<>]+/.exec(text.slice(i)); if (!m) return null; i += m[0].length; return m[0]; };
  const block = () => { skipSpace(); if (text[i] !== '{') return null; const b = braced(text, i); i = b.end; return b.body; };
  const duration = (num, dots) => {
    let b = 4 / Number(num);
    for (let k = 0, add = b / 2; k < dots.length; k++, add /= 2) b += add;
    return b;
  };
  const place = (pc, marks) => {
    const semis = STEP[pc.step] + pc.alt;
    if (state.mode === 'relative' && state.last) {
      // Nearest by letter name (within a fourth), then the octave marks.
      const letters = 'cdefgab';
      const lastOct = state.last.oct, lastIdx = letters.indexOf(state.last.step);
      let idx = letters.indexOf(pc.step), oct = lastOct;
      if (idx - lastIdx > 3) oct--; else if (lastIdx - idx > 3) oct++;
      oct += [...marks].reduce((o, ch) => o + (ch === "'" ? 1 : -1), 0);
      state.last = { step: pc.step, oct };
      return 12 * (oct + 1) + semis + state.shift;
    }
    const oct = state.mode === 'fixed' ? state.base + [...marks].reduce((o, ch) => o + (ch === "'" ? 1 : -1), 0) : markOctave(marks);
    state.last = { step: pc.step, oct };
    return 12 * (oct + 1) + semis + state.shift;
  };
  while (i < text.length) {
    skipSpace();
    if (i >= text.length) break;
    if (firstOnly && out.events.length > had) break;
    const ch = text[i];
    if (ch === '~') { const prev = out.events[out.events.length - 1]; if (prev) prev.tie = true; i++; continue; }
    if ('()[]|-^_!.,\'='.includes(ch)) { i++; continue; }
    if (ch === '{') { walk(block(), vars, state, out, depth + 1); continue; }
    if (ch === '}') { i++; continue; }
    if (ch === '<' && text[i + 1] === '<') {
      // Voices together: the first one that has notes is the tune.
      let d = 0, j = i;
      for (; j < text.length; j++) {
        if (text.startsWith('<<', j)) { d++; j++; } else if (text.startsWith('>>', j)) { j++; if (--d === 0) break; }
      }
      const inner = text.slice(i + 2, j - 1).split('\\\\')[0];
      walk(inner, vars, state, out, depth + 1, true);
      i = j + 1;
      continue;
    }
    if (ch === '<') {
      const end = text.indexOf('>', i);
      const names = text.slice(i + 1, end).trim().split(/\s+/);
      i = end + 1;
      const m = /^(\d+)?(\.*)/.exec(text.slice(i));
      i += m[0].length;
      if (m[1]) state.dur = duration(m[1], m[2]);
      let top = null, first = null;
      for (const n of names) {
        const pm = /^([a-g][a-z-]*?)([',]*)$/.exec(n);
        const pc = pm && pitchClass(pm[1], state.german);
        if (!pc) continue;
        const midi = place(pc, pm[2]);
        first ??= { ...state.last };
        if (top == null || midi > top) top = midi;
      }
      if (first) state.last = first; // after a chord, relative to its first note
      const tie = text[i] === '~';
      if (top != null) out.events.push({ midi: top, beats: state.dur * state.scale, tie });
      continue;
    }
    if (ch === '\\') {
      const cmd = word();
      if (cmd === '\\relative') {
        skipSpace();
        const m = /^([a-g][a-z]*)([',]*)\s*(?=\{)/.exec(text.slice(i));
        const sub = { ...state, mode: 'relative', last: { step: 'c', oct: 3 } };
        if (m) { i += m[0].length; sub.last = { step: m[1][0], oct: markOctave(m[2]) }; }
        const body = block();
        if (body != null) walk(body, vars, sub, out, depth + 1);
      } else if (cmd === '\\fixed') {
        skipSpace();
        const m = /^([a-g][a-z]*)([',]*)\s*(?=\{)/.exec(text.slice(i));
        i += m[0].length;
        walk(block(), vars, { ...state, mode: 'fixed', base: markOctave(m[2]), last: null }, out, depth + 1);
      } else if (cmd === '\\time') { const t = word(); out.time ??= t; }
      else if (cmd === '\\key') { const k = word(); const mode = word(); out.key ??= `${k} ${mode.replace('\\', '')}`; }
      else if (cmd === '\\partial') {
        const m = /^(\d+)(\.*)(?:\*(\d+))?$/.exec(word());
        if (!out.events.length) out.pickup = duration(m[1], m[2]) * (m[3] ? Number(m[3]) : 1);
      } else if (cmd === '\\repeat') {
        const kind = word(), times = Number(word());
        const body = block();
        skipSpace();
        let alts = null;
        if (text.slice(i).startsWith('\\alternative')) {
          i += '\\alternative'.length;
          const a = block();
          alts = [];
          for (let j = 0; j < a.length; j++) if (a[j] === '{') { const b = braced(a, j); alts.push(b.body); j = b.end - 1; }
        }
        // Relative pitches follow the written order: the body is read once,
        // then each ending once, and the repeats are put together from those.
        const part = t => { const from = out.events.length; walk(t, vars, state, out, depth + 1); return out.events.splice(from); };
        const main = part(body);
        const ends = (alts ?? []).map(part);
        const n = kind === 'unfold' || kind === 'volta' ? times : 1;
        for (let k = 0; k < n; k++) {
          out.events.push(...main.map(e => ({ ...e })));
          if (ends.length) out.events.push(...ends[Math.min(k, ends.length - 1)].map(e => ({ ...e })));
        }
      } else if (cmd === '\\times' || cmd === '\\tuplet') {
        const [a, b] = word().split('/').map(Number);
        const factor = cmd === '\\times' ? a / b : b / a;
        skipSpace();
        const m = /^\d+\s*(?=\{)/.exec(text.slice(i)); // \tuplet 3/2 4 { … }
        if (m) i += m[0].length;
        const keep = state.scale;
        state.scale *= factor;
        walk(block(), vars, state, out, depth + 1);
        state.scale = keep;
      } else if (cmd === '\\grace' || cmd === '\\acciaccatura' || cmd === '\\appoggiatura' || cmd === '\\slashedGrace') {
        if (block() == null) word();
      } else if (cmd === '\\clef' || cmd === '\\tempo' || cmd === '\\bar' || cmd === '\\set' || cmd === '\\override' || cmd === '\\once' || cmd === '\\mark' || cmd === '\\new' || cmd === '\\context' || cmd === '\\transpose' || cmd === '\\numericTimeSignature') {
        // Their arguments are words, numbers or '=' forms on the same line: drop what isn't a block.
        if (cmd === '\\tempo') { const m = /^\s*(?:\d+\.*\s*=\s*[\d-]+)/.exec(text.slice(i)); if (m) i += m[0].length; }
        else if (cmd === '\\set' || cmd === '\\override') { const m = /^[^\n|{}]*?=[ \t]*(#\S+|[^\s\\]\S*)?/.exec(text.slice(i)); if (m) i += m[0].length; }
        else if (cmd === '\\once' || cmd === '\\numericTimeSignature') { /* nothing to drop */ }
        else if (cmd === '\\transpose') {
          const from = /^([a-g][a-z]*?)([',]*)$/.exec(word()), to = /^([a-g][a-z]*?)([',]*)$/.exec(word());
          const semi = (m) => { const pc = pitchClass(m[1], state.german); return 12 * markOctave(m[2]) + STEP[pc.step] + pc.alt; };
          const body = block();
          if (body != null) walk(body, vars, { ...state, shift: state.shift + semi(to) - semi(from) }, out, depth + 1);
          else state.shift += semi(to) - semi(from);
        }
        else word();
      } else if (vars[cmd.slice(1)] && cmd.slice(1) !== 'global') {
        walk(vars[cmd.slice(1)], vars, state, out, depth + 1);
      } else if (vars[cmd.slice(1)]) {
        const g = vars[cmd.slice(1)];
        const t = /\\time\s+(\S+)/.exec(g); if (t) out.time ??= t[1];
        const k = /\\key\s+(\S+)\s+\\(\w+)/.exec(g); if (k) out.key ??= `${k[1]} ${k[2]}`;
        const p = /\\partial\s+(\d+)(\.*)/.exec(g); if (p && !out.events.length) out.pickup = duration(p[1], p[2]);
      }
      continue;
    }
    // A note, a rest, or something to skip (bar lines, slurs, dynamics, #scheme).
    // A length on its own ("g4 8"): the note before again, that long.
    const bare = /^(\d+)(\.*)(?=[\s()\[\]~|])/.exec(text.slice(i));
    if (bare && out.events.length && [1, 2, 4, 8, 16, 32].includes(Number(bare[1]))) {
      i += bare[0].length;
      state.dur = duration(bare[1], bare[2]);
      const prev = out.events[out.events.length - 1];
      out.events.push({ midi: prev.midi, beats: state.dur * state.scale, tie: false });
      continue;
    }
    const m = /^([a-h](?:-sharp|-flat|[a-z]*)|r|s|R)(?![a-zA-Z])([',]*)(\d+)?(\.*)(?:\*(\d+))?/.exec(text.slice(i));
    const isNote = m && (/^[a-g]/.test(m[1]) || (state.german && /^h/.test(m[1])));
    const pc = m && m[1].length <= 7 && (/^[rsR]$/.test(m[1]) ? 'rest' : pitchClass(m[1], state.german));
    if (!pc) {
      const w = /^(#\S+|[^\s{}\\<]+)/.exec(text.slice(i));
      i += w ? w[0].length : 1;
      continue;
    }
    i += m[0].length;
    if (m[3]) state.dur = duration(m[3], m[4]);
    const beats = state.dur * state.scale * (m[5] ? Number(m[5]) : 1);
    const after = /^[^\s{}|]*/.exec(text.slice(i))[0];
    if (pc === 'rest' || after.startsWith('\\rest')) {
      if (pc !== 'rest') place(pc, m[2]);
      const prev = out.events[out.events.length - 1];
      if (prev && prev.midi == null) prev.beats += beats; else out.events.push({ midi: null, beats, tie: false });
    } else {
      out.events.push({ midi: place(pc, m[2]), beats, tie: after.includes('~') });
    }
  }
}

// The length of each bar the notes fill, for checking against the score.
export function barLengths(result) {
  if (!result.time) return [];
  const [n, d] = result.time.split('/').map(Number);
  const bar = (n * 4) / d;
  const out = [];
  let t = result.pickup ? bar - result.pickup : 0, across = 0;
  for (const tok of result.notes.split(' ')) {
    const b = Number(tok.split(':')[1]);
    const left = bar - (t % bar || 0);
    if (b > left + 1e-6 && Math.abs(left - bar) > 1e-6) across++;
    t += b;
  }
  out.push({ bars: +(t / bar).toFixed(3), notesAcrossBarLines: across });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const blocks = scoreBlocks(readFileSync(args[0], 'utf8'));
  if (!blocks.length) { console.error('no <score> in this article'); process.exit(1); }
  const res = readMelody(blocks[Number(opt('--score') ?? 0)], { voice: opt('--voice') });
  if (args.includes('--json')) console.log(JSON.stringify(res));
  else { console.log(res); console.log(barLengths(res)); }
}
