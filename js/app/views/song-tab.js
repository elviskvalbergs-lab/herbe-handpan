// A song's tab and practising it.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote, getAllNotes, noteToMidi } from '../../data.js';
import { icon } from '../../icons.js';
import { songBars, songCoverage, songHands, songInLoop, songKeyOn, songLoopTap, songNextIndex, songWaitHeard, songWaitTarget } from '../../songs.js';
import { kalimbaNumbers } from '../../kalimbas.js';
import { layoutInstrument } from '../../layoutfamilies.js';
import { getInstrument, getInstruments, isTubeFamily, midiToNoteName, sortInstruments, usesLayout } from '../../instruments.js';
import { initAudio, playNote, setVoice } from '../../audio.js';
import { panPlaces } from '../../pan.js';
import { fingeringFor, playableMidis, renderFingering } from '../../ocarina-ui.js';
import { logEvent } from '../../auth.js';

// ── The song's tab (handpan, tongue drum) ───────────────────────────────
// Like a handpan tab sheet: each note's number on the instrument in a grid
// of bars counted "1 + 2 +", in the R row or the L row for the hand that
// plays it. Numbers: a handpan's ding is 0, then its tone fields by pitch
// (bottom notes after the top ones); a tongue drum's tongues 1, 2, … by
// pitch. The hand is the side of the drawing the note is on (as moved in
// Move notes, and as rotated), a middle note the other hand from the note
// before (songHands). The picture numbers the song's notes the same way.
function songTabFamily(inst) {
  if (inst) return isTubeFamily(inst.family) ? 'flute' : 'ocarina';
  const f = layoutInstrument(state.layout);
  return f === 'handpan' || f === 'tongue-drum' || f === 'kalimba' ? f : null;
}
function songTabShown(inst) { return !!songTabFamily(inst) && (state.songView ?? 'tab') === 'tab'; }
function songFieldNumbers(layout) {
  // A kalimba: its own numbered notation (1–7 with octave dots, js/kalimbas.js).
  if (layoutInstrument(layout) === 'kalimba') return kalimbaNumbers(getAllNotes(layout));
  const byPitch = a => [...new Set(a.filter(Boolean))].sort((x, y) => noteToMidi(x) - noteToMidi(y));
  const order = layoutInstrument(layout) === 'handpan'
    ? [layout.top.ding, ...byPitch(layout.top.slots.map(x => x.note)), ...byPitch(layout.bottom.slots.map(x => x.note))]
    : byPitch([layout.top.ding, ...layout.top.slots.map(x => x.note), ...layout.bottom.slots.map(x => x.note)]);
  const start = layoutInstrument(layout) === 'handpan' && layout.top.ding ? 0 : 1;
  const nums = new Map();
  order.filter(Boolean).forEach(n => { if (!nums.has(n)) nums.set(n, start + nums.size); });
  return nums;
}
// Columns on a line of the tab: fewer with lyrics, so the words fit, and
// fewer on an ocarina, whose fingering pictures need the room.
const SONG_TAB_LINE = { plain: 16, lyrics: 12, ocarina: 8 };
function songTab(S, { lyrics = false } = {}) {
  const family = songTabFamily(S.inst);
  const lineCols = family === 'ocarina' ? SONG_TAB_LINE.ocarina : lyrics ? SONG_TAB_LINE.lyrics : SONG_TAB_LINE.plain;
  const bars = songBars(S.song, S.notes);
  const lines = [];
  for (const b of bars) {
    const line = lines[lines.length - 1];
    if (line && line.cols + b.cols.length <= lineCols) { line.bars.push(b); line.cols += b.cols.length; }
    else lines.push({ bars: [b], cols: b.cols.length });
  }
  if (S.inst) {
    // An ocarina's pictures are two columns wide: a note starting in the
    // next column goes on a second level, and one in a line's last column
    // is drawn back over the column before (so nothing hangs off the line).
    const fgPlace = new Map();
    if (family === 'ocarina') {
      for (const line of lines) {
        let k = 0, prev = null;
        const total = line.cols;
        for (const b of line.bars) for (const c of b.cols) {
          if (c.i != null && S.notes[c.i].midi != null && !S.notes[c.i].gone) {
            const lane = prev && k - prev.k < 2 && prev.lane === 0 ? 1 : 0;
            fgPlace.set(c.i, { lane, last: k === total - 1 });
            prev = { k, lane };
          }
          k++;
        }
      }
    }
    return { family, lines, fgPlace };
  }
  const nums = songFieldNumbers(state.layout);
  const places = new Map(panPlaces(state.layout, { rotated: state.ringRotated }).map(p => [p.note, p]));
  const sideOf = note => {
    const p = places.get(note);
    if (!p) return 0;
    const dx = p.x - 250;
    // The middle: a note drawn across the centre line (a ding, a kalimba's
    // middle key), within its own half-width.
    return Math.abs(dx) < Math.max(p.r, 6) ? 0 : Math.sign(dx);
  };
  const sides = S.notes.map(n => (n.midi == null || n.gone ? null : sideOf(S.name(n.midi))));
  return { family, nums, hands: songHands(sides), sideOf, lines };
}
// The picture's badges: each note the song uses, with its number, coloured
// by the side it's on (no colour in the middle).
function songTabMarks(S, T) {
  const used = [...new Set(S.notes.filter(n => n.midi != null).map(n => S.name(n.midi)))];
  return used.filter(n => T.nums.has(n)).map(n => {
    const side = T.sideOf(n);
    const hand = side < 0 ? 'L' : side > 0 ? 'R' : '';
    // A kalimba's keys are narrow: the number alone, coloured by thumb.
    const label = layoutInstrument(state.layout) === 'kalimba' ? String(T.nums.get(n)) : undefined;
    return { note: n, marks: [{ n: T.nums.get(n), hand, label }] };
  });
}
// The tab's rows under the counts, by instrument; each { label, h (px),
// cell(column) → html, cls }. Every instrument shares the grid (bars,
// counts, the lyrics row, the current note, print); only these differ.
//  · handpan, tongue drum, kalimba: an R and an L row, each note's number
//    in the row of the hand (or thumb) that plays it.
//  · flute (tin whistle, Native American flute): Grey Larsen's staff-based
//    tablature (https://greylarsen.com/FreeDownloads/Tablature_System_Explanation.pdf):
//    a line per finger hole, the mouthpiece end on top, a gap between the
//    hands; a dot on a line closes that hole (half a dot: half-cover it),
//    a ring with a tail opens them all, + above: the second octave (blow
//    harder). The note's name is above, as Larsen pairs letter names.
//  · ocarina: an ocarina tab's picture of the fingering for each note
//    (filled holes closed), here on the beat it starts on.
function songTabRows(S, T, idx) {
  const family = T.family;
  const uf = state.useFlats, us = state.useSolfege;
  const nameBtn = c => {
    const n = S.notes[c.i];
    const cur = c.i === idx;
    return `<button type="button" class="tab-name${cur ? ' is-current' : ''}${songNoteCls(c.i, idx)}${n.gone ? ' is-gone' : ''}" data-action="song-step" data-i="${c.i}"${cur ? ' aria-current="true"' : ''}>${escHtml(displayNote(midiToNoteName(n.midi), uf, us).replace(/\d+$/, ''))}</button>`;
  };
  const nameRow = {
    label: '', h: 22, cls: 'tab-names',
    cell: c => (c.i != null && S.notes[c.i].midi != null ? nameBtn(c) : c.hold != null ? '<span class="tab-hold" aria-hidden="true"></span>' : ''),
  };
  if (family === 'flute') {
    const inst = S.inst;
    const ch = inst.chambers[0];
    const holes = ch.holes;
    const fg = i => fingeringFor(inst, S.notes[i].midi)?.states ?? null;
    const rows = [nameRow];
    const overblown = i => !!fingeringFor(inst, S.notes[i].midi)?.chamber.overblow?.includes(S.notes[i].midi);
    if (S.notes.some((n, i) => n.midi != null && overblown(i))) {
      rows.push({ label: '', h: 12, cls: 'tab-plus', cell: c => (c.i != null && S.notes[c.i].midi != null && overblown(c.i) ? '+' : '') });
    }
    holes.forEach((h, k) => {
      if (k > 0 && h.finger[0] !== holes[k - 1].finger[0]) rows.push({ label: '', h: 8, cls: 'tab-gap', cell: () => '' });
      rows.push({
        label: h.finger, h: 13, cls: 'tab-hole',
        cell: c => {
          if (c.i == null || S.notes[c.i].midi == null) return '';
          if (S.notes[c.i].gone) return k === 0 ? '<span class="tab-gone" title="Not on this instrument">×</span>' : '';
          const st = fg(c.i);
          if (!st) return '';
          if (st.every(x => x === 'o')) return k === 0 ? '<span class="tab-allopen" aria-hidden="true"></span>' : '';
          return st[k] === 'c' ? '<span class="tab-dot" aria-hidden="true"></span>' : st[k] === 'h' ? '<span class="tab-dot is-half" aria-hidden="true"></span>' : '';
        },
      });
    });
    return rows;
  }
  if (family === 'ocarina') {
    // Pictures two columns wide, on two levels where notes are close
    // (songTab's fgPlace).
    const two = [...T.fgPlace.values()].some(p => p.lane === 1);
    const place = i => T.fgPlace.get(i) ?? { lane: 0, last: false };
    return [nameRow, {
      label: '', h: two ? 112 : 58, cls: 'tab-fgs',
      cell: c => (c.i != null && S.notes[c.i].gone ? '<span class="tab-gone" title="Not on this instrument">×</span>'
        : c.i != null && S.notes[c.i].midi != null
        ? `<button type="button" class="tab-fg${place(c.i).lane ? ' is-lane2' : ''}${place(c.i).last ? ' is-last' : ''}" data-action="song-step" data-i="${c.i}" tabindex="-1" aria-hidden="true">${renderFingering(S.inst, S.notes[c.i].midi, { size: 'mini', noteLabel: false, useFlats: uf, useSolfege: us })}</button>`
        : ''),
    }];
  }
  const handWord = family === 'kalimba' ? 'thumb' : 'hand';
  const num = i => T.nums.get(S.name(S.notes[i].midi)) ?? '?';
  const handCell = hand => c => {
    // The note this instrument lacks: a cross in the R row, no number.
    if (c.i != null && S.notes[c.i].gone) {
      if (hand !== 'R') return '';
      const cur = c.i === idx;
      return `<button type="button" class="tab-note tab-note-gone${cur ? ' is-current' : ''}" data-action="song-step" data-i="${c.i}"${cur ? ' aria-current="true"' : ''} aria-label="${escHtml(displayNote(midiToNoteName(S.notes[c.i].midi), uf, us))}, not on this instrument">×</button>`;
    }
    if (c.i != null && T.hands[c.i] === hand) {
      const cur = c.i === idx;
      return `<button type="button" class="tab-note tab-note-${hand.toLowerCase()}${cur ? ' is-current' : ''}${songNoteCls(c.i, idx)}" data-action="song-step" data-i="${c.i}"${cur ? ' aria-current="true"' : ''} aria-label="${hand === 'R' ? 'Right' : 'Left'} ${handWord} ${num(c.i)}">${num(c.i)}</button>`;
    }
    return c.hold != null && T.hands[c.hold] === hand ? '<span class="tab-hold" aria-hidden="true"></span>' : '';
  };
  return [{ label: 'R', h: 32, cell: handCell('R'), cls: '' }, { label: 'L', h: 32, cell: handCell('L'), cls: '' }];
}
function songTabHtml(S, T, idx, LY = null) {
  const family = T.family;
  const rows = songTabRows(S, T, idx);
  const heights = `18px ${rows.map(r => `${r.h}px`).join(' ')}${LY ? ' 22px' : ''}`;
  const colCls = c => (c.i != null && c.i === idx && (family === 'flute' || family === 'ocarina') ? ' is-current-col' : '');
  const lines = T.lines.map(line => {
    const bars = line.bars.map(b => `<div class="tab-bar${b.from ? ' is-pickup' : ''}" style="--cols:${b.cols.length};grid-template-rows:${heights}">${b.change ? `<span class="tab-time" aria-label="Time changes to ${b.time}">${b.time}</span>` : ''}
        ${b.cols.map(c => `<span class="tab-count${c.count && c.count !== '+' ? ' is-beat' : ''}">${c.count}</span>`).join('')}
        ${rows.map(r => b.cols.map(c => `<span class="tab-cell ${r.cls}${colCls(c)}">${r.cell(c)}</span>`).join('')).join('')}
        ${LY ? b.cols.map(c => `<span class="tab-lyric${c.i === idx ? ' is-current' : ''}">${c.i != null && LY[c.i] ? escHtml(LY[c.i].text) : ''}</span>`).join('') : ''}
      </div>`).join('');
    const here = line.bars.some(b => b.cols.some(c => c.i === idx));
    return `<div class="tab-line${LY ? ' has-lyrics' : ''} tab-${family}${here ? ' is-current-line' : ''}"><div class="tab-hands" aria-hidden="true" style="grid-template-rows:${heights}"><span></span>${rows.map(r => `<span class="${r.cls}">${escHtml(r.label)}</span>`).join('')}${LY ? '<span></span>' : ''}</div>${bars}</div>`;
  }).join('');
  const handWord = family === 'kalimba' ? 'thumb' : 'hand';
  const label = {
    flute: 'Tab: a line for each finger hole, a dot to close it',
    ocarina: 'Tab: the fingering for each note',
  }[family] ?? `Tab: the number of each ${{ 'tongue-drum': 'tongue', kalimba: 'key' }[family] ?? 'note'}, R right ${handWord}, L left ${handWord}`;
  const key = {
    handpan: 'Numbers: the ding is 0, then the notes from low to high, as on the picture. R is the right hand, L the left. A line after a number: let it ring.',
    'tongue-drum': 'Numbers: the tongues from low to high, as on the picture. R is the right hand, L the left. A line after a number: let it ring.',
    kalimba: 'Numbers: kalimba notation, 1 to 7 up the scale from the key’s first note, a dot above for an octave up and below for an octave down, as on the picture. R is the right thumb, L the left. A line after a number: let it ring.',
    flute: 'Each line is a finger hole, the mouthpiece end on top, the left hand above the gap and the right hand below it. A dot: close the hole; half a dot: half-cover it; a ring with a tail: open them all. + : blow harder, the second octave. A line after a note: hold it.',
    ocarina: 'Each picture is the fingering for the note that starts on that beat, filled holes closed, as on the big picture. A line after a note: hold it.',
  }[family];
  return `<div class="song-tab" role="group" aria-label="${label}">${lines}</div>
    <p class="pl-section-hint song-tab-key">${key}</p>`;
}
// The words around the current note, the current syllable marked: a few
// syllables before it and the rest of the phrase after.
function songLyricLineHtml(LY, idx) {
  const at = LY.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
  if (!at.length) return '';
  let k = at.findLastIndex(i => i <= idx);
  if (k < 0) k = 0;
  const from = Math.max(0, k - 4), to = Math.min(at.length, k + 9);
  let html = '';
  for (let j = from; j < to; j++) {
    const x = LY[at[j]];
    // Whole words: a syllable's hyphen only where the line stops mid-word.
    const t = escHtml(j < to - 1 ? x.text.replace(/-$/, '') : x.text);
    if (j > from && x.word) html += ' ';
    html += j === k && at[j] <= idx ? `<mark>${t}</mark>` : t;
  }
  return `<p class="song-lyric-line" aria-live="off">${from > 0 ? '… ' : ''}${html}${to < at.length ? ' …' : ''}</p>`;
}
// The tab follows the music: when the current note moves to another line
// (playing, stepping, tapping, rewinding), that line scrolls to the top of
// the screen, just under the app bar. Only on a change of line, so it never
// pulls the page back while someone scrolls through it by hand; not when the
// song first opens (the picture and controls are seen first).
function songTabFollow() {
  if (state.view !== 'song' || !state.songCtx || state.songPrinting) { _songTabLine = null; return; }
  const lines = [...document.querySelectorAll('.song-tab .tab-line')];
  const at = lines.findIndex(l => l.classList.contains('is-current-line'));
  const key = `${state.songCtx.id}:${at}`;
  if (at < 0 || (key === _songTabLine && !_songTabForce)) return;
  const first = _songTabLine == null || !_songTabLine.startsWith(`${state.songCtx.id}:`);
  _songTabLine = key;
  if (first && !_songTabForce) return;
  _songTabForce = false;
  // The instrument stays in view (the framed top block sticks under the app
  // bar): the line goes just under it, so the tab moves as in a frame.
  const bar = document.querySelector('.appbar');
  const top = document.querySelector('.song-top.is-framed');
  const offset = (bar?.offsetHeight ?? 0) + (top?.offsetHeight ?? 0) + 8;
  const y = lines[at].getBoundingClientRect().top + window.scrollY - offset;
  // At once, like turning a page: a smooth scroll is cut short by the next
  // note's redraw.
  window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
}
let _songTabLine = null;
let _songTabForce = false; // Play pressed: bring the current line up even if it hasn't changed
function songPrint() {
  songStop();
  state.songPrinting = true;
  render();
  document.body.classList.add('printing-song');
  const done = () => {
    document.body.classList.remove('printing-song');
    window.removeEventListener('afterprint', done);
    state.songPrinting = false;
    render();
  };
  window.addEventListener('afterprint', done);
  logEvent('feature', { name: 'song-print', family: measureFamily() });
  window.print();
}

// ── Practising a song: wait mode, a loop, the song on my other instruments ──
// (docs/songs-next.md §3; the pure parts are in js/songs.js.)

// A note's extra classes: inside the loop, already heard in wait mode.
function songNoteCls(i, idx) {
  const ctx = state.songCtx;
  return `${songInLoop(ctx?.loop, i) ? ' is-loop' : ''}${state.songWait && i < idx && i >= (ctx?.waitFrom ?? 0) ? ' is-heard' : ''}`;
}
function songPracticeRowHtml(S, idx) {
  const loop = state.songCtx.loop;
  const nn = m => displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
  const loopLabel = !loop ? 'Loop from here' : loop.to == null ? 'Loop to here' : 'Loop on';
  const target = state.songWait ? songWaitTarget(S.notes, idx, loop) : null;
  const status = state.songWait
    ? (state.tuner.error ? escHtml(state.tuner.error)
      : state.songWaitDone ? 'That was the last note. Back to the start to play it again.'
      : target != null ? `Listening: play ${escHtml(nn(S.notes[target].midi))} and the song moves on.` : '')
    : loop && loop.to == null ? `The loop starts at note ${loop.from + 1}. Go to its last note and tap “Loop to here”.`
    : loop ? `Looping notes ${loop.from + 1} to ${loop.to + 1}.` : '';
  return `<div class="song-practice">
      <button type="button" class="btn btn-secondary song-wait-btn" data-action="song-wait" aria-pressed="${!!state.songWait}">${icon('mic')} Wait for me</button>
      <button type="button" class="btn btn-secondary song-loop-btn" data-action="song-loop" aria-pressed="${!!loop}">${icon(loop && loop.to != null ? 'x' : 'repeat')} ${loopLabel}</button>
      ${uiHelp('songs-to-learn', 'wait')}
    </div>
    ${status ? `<p class="song-practice-status" role="status">${status}</p>` : ''}`;
}

// Wait mode: the tuner listens and the song moves on when it hears the note
// (songWaitHeard). It turns the tuner on, and off again when it did.
function songWaitArm() {
  if (!state.songWait) return;
  state.songWaitState = { at: performance.now(), low: Infinity };
  state.songWaitDone = false;
  if (state.songCtx) state.songCtx.waitFrom = state.songCtx.idx;
}
async function songWaitToggle() {
  if (state.songWait) { songWaitOff(); render(); return; }
  songStop();
  state.songWait = { startedTuner: !state.tuner.on || !!state.tuner.error };
  songWaitArm();
  logEvent('feature', { name: 'song-wait', family: measureFamily() });
  if (state.songWait.startedTuner) {
    if (state.tuner.error) { if (_tunerStop) { _tunerStop(); _tunerStop = null; } state.tuner.on = false; }
    await toggleTuner();
    // Refused: the switch goes back off, the tuner's own message stays on show.
    if (state.tuner.error) { state.songWait = null; render(); return; }
  }
  render();
}
function songWaitOff() {
  const w = state.songWait;
  state.songWait = null;
  state.songWaitDone = false;
  if (w?.startedTuner && state.tuner.on && !state.tuner.error) toggleTuner();
}
// A tuner reading while waiting. True when it moved the song on.
function songWaitReading(reading) {
  if (!state.songWait || state.view !== 'song' || state.songPlay || state.songWaitDone) return false;
  const S = songOnInstrument();
  if (!S) return false;
  const last = S.notes.length - 1;
  const at = songWaitTarget(S.notes, Math.min(state.songCtx.idx, last), state.songCtx.loop);
  if (at == null) return false;
  if (at !== state.songCtx.idx) state.songCtx.idx = at; // stepped over a rest or a missing note
  const res = songWaitHeard(state.songWaitState ?? { at: 0, low: Infinity }, S.notes[at].midi, reading, performance.now(), { anyOctave: !S.inst });
  state.songWaitState = res.w;
  if (!res.heard) return false;
  const next = songNextIndex(at, last, state.songCtx.loop);
  const to = next == null ? null : songWaitTarget(S.notes, next, state.songCtx.loop);
  if (to == null) state.songWaitDone = true;
  else {
    // Round the loop again: the notes count as not yet heard.
    if (to <= at) state.songCtx.waitFrom = to;
    state.songCtx.idx = to;
  }
  render();
  return true;
}

// The song on my other instruments: fits, one note missing, or not (songCoverage).
function songOnInstrumentsHtml(S) {
  const here = S.inst?.id ?? state.currentInstrumentId;
  const mine = sortInstruments(getInstruments()).filter(i => i.id !== here);
  if (!mine.length) return '';
  const rows = songCoverage(S.song, mine.map(i => ({ id: i.id, name: i.name, have: songHaveOf(i), easy: usesLayout(i) ? null : new Set(playableMidis(i).filter(m => !fingeringFor(i, m)?.states?.includes('h'))) })));
  return `<h2 class="list-title">On your instruments</h2>
    <div class="list">${rows.map(r => uiRow({
      lead: 'music', title: r.name,
      meta: escHtml(r.fit ? `${songKeyOn(S.song, r.fit.shift)}${r.fit.missing != null ? ` · ${songMissingLabel(r.fit)}` : ''}` : 'Needs notes it doesn’t have'),
      trail: r.fit ? (r.fit.missing == null ? uiBadge('Fits', 'success') : uiBadge('One note missing', 'warning')) : uiBadge('Doesn’t fit'),
      chevron: !!r.fit, action: r.fit ? 'song-on' : '', data: { id: r.id },
    })).join('')}</div>`;
}
function songOpenOn(instId) {
  const id = state.songCtx?.id;
  const inst = getInstrument(instId);
  if (!id || !inst) return;
  songStop();
  if (state.songWait) songWaitOff();
  if (!openInstrument(instId, { push: false })) return;
  openSong(id, usesLayout(inst) ? null : instId);
}

// Playing the song: each note for its length at the chosen speed (100 bpm
// at 100%), the picture following.
let _songTimer = null;
function songStop() {
  clearTimeout(_songTimer);
  _songTimer = null;
  state.songPlay = null;
}
function songSound(m) {
  if (m == null) return;
  const S = songOnInstrument();
  setVoice(voiceForState());
  playNote(S ? S.name(m) : midiToNoteName(m));
}
function songTick() {
  const S = songOnInstrument();
  if (!S || state.view !== 'song' || !state.songPlay) { songStop(); return; }
  const n = S.notes[state.songCtx.idx];
  songSound(n.midi);
  render();
  const ms = n.beats * 600 * (100 / state.tempo);
  _songTimer = setTimeout(() => {
    if (!state.songPlay) return;
    const next = songNextIndex(state.songCtx.idx, S.notes.length - 1, state.songCtx.loop);
    if (next == null) { songStop(); render(); return; }
    state.songCtx.idx = next;
    songTick();
  }, ms);
}
function songAction(action, el) {
  if (action === 'lists-other') { state.listsShowOther = !state.listsShowOther; render(); return true; }
  if (action === 'song-open') { openSong(el.dataset.id, el.dataset.inst); return true; }
  if (action === 'songs-all') { state.songsAll = true; render(); return true; }
  if (action === 'songs-almost-all') { state.songsAlmostAll = true; render(); return true; }
  if (action === 'songs-filter') { state.songsFilter = el.dataset.value; state.songsAll = false; state.songsAlmostAll = false; state.songsCountries = false; render(); return true; }
  if (action === 'songs-countries-open') { state.songsCountries = true; render(); return true; }
  if (action === 'songs-countries-close') { state.songsCountries = false; render(); return true; }
  if (state.view !== 'song' || !state.songCtx) return false;
  const S = songOnInstrument();
  if (!S) return false;
  const last = S.notes.length - 1;
  if (action === 'song-loop') {
    state.songCtx.loop = songLoopTap(state.songCtx.loop, Math.min(state.songCtx.idx, last));
    logEvent('feature', { name: 'song-loop', family: measureFamily() });
    render();
    return true;
  }
  if (action === 'song-wait') { songWaitToggle(); return true; }
  if (action === 'song-on') { songOpenOn(el.dataset.id); return true; }
  if (action === 'song-play') {
    if (state.songPlay) { songStop(); render(); return true; }
    if (state.songWait) songWaitOff();
    initAudio();
    if (state.songCtx.idx >= last) state.songCtx.idx = 0;
    state.songPlay = { at: Date.now() };
    _songTabForce = true;
    logEvent('feature', { name: 'song-play', family: measureFamily() });
    songTick();
    return true;
  }
  const go = i => { songStop(); state.songCtx.idx = Math.max(0, Math.min(last, i)); songWaitArm(); initAudio(); if (!state.songWait) songSound(S.notes[state.songCtx.idx].midi); render(); };
  if (action === 'song-step') { go(parseInt(el.dataset.i, 10)); return true; }
  if (action === 'song-view') { state.songView = el.dataset.value; render(); return true; }
  if (action === 'song-lyrics') { state.showLyrics = !state.showLyrics; savePrefs(); render(); return true; }
  if (action === 'song-print') { songPrint(); return true; }
  if (action === 'song-share') { songShare(); return true; }
  if (action === 'song-prev') { go(state.songCtx.idx - 1); return true; }
  // Back to the first note, stopped, so the next Play starts the song over.
  if (action === 'song-restart') { songStop(); state.songCtx.idx = songInLoop(state.songCtx.loop, state.songCtx.idx) ? state.songCtx.loop.from : 0; songWaitArm(); render(); return true; }
  if (action === 'song-next') { go(state.songCtx.idx + 1); return true; }
  return false;
}
