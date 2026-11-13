import { displayNote, noteToMidi, notePC } from './data.js';

export const PAN_SVG_ID = 'handpan-svg';

// Physical handpan ring layout (confirmed from klangzeug.de for all scales).
// Notes sorted ascending (n1=lowest, nN=highest) placed clockwise from 12 o'clock.
// For 10-ring instruments, n9+n10 go on a separate inner ring (see renderPan).
function physicalOrder(n) {
  if (n === 7)  return [6,4,2,0,1,3,5];
  if (n === 8)  return [7,6,4,2,0,1,3,5];
  if (n === 9)  return [8,6,4,2,0,1,3,5,7];
  return null;
}

// Outer ring physical order for 10-ring instruments (n1-n8, same as 8-ring).
const OUTER_8_ORDER = [7,6,4,2,0,1,3,5];

// Inner ring note positions. 1-2 notes: symmetric at ±45° from top, r=100.
// 3-5 notes: evenly spread across an arc from -140° to -40°, r=95.
function innerRingPositions(cx, cy, count) {
  if (count <= 2) {
    const r = 100;
    const angles = [-Math.PI * 3 / 4, -Math.PI / 4]; // -135°, -45°
    return angles.slice(0, count).map(a => ({
      x: Math.round(cx + r * Math.cos(a)),
      y: Math.round(cy + r * Math.sin(a)),
    }));
  }
  const r = 95;
  const start = (-140 * Math.PI) / 180;
  const end   = (-40 * Math.PI) / 180;
  const step  = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const a = start + i * step;
    return { x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)) };
  });
}

function circlePositions(count, cx, cy, r, rotationOffset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI / count) - Math.PI / 2 + rotationOffset;
    return {
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    };
  });
}

// All tone fields are circles. r controls size; lower notes get larger circles.
function noteSlotSvg(x, y, note, extraClasses, noteId, r = 24, useFlats = false, useSolfege = false) {
  const isEmpty = !note;
  const allClasses = ['pan-note', ...extraClasses.split(' ').filter(Boolean)].join(' ');
  const noteAttr = note ? ` data-note="${note}"` : '';

  let textHtml;
  if (isEmpty) {
    textHtml = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui,sans-serif" font-size="${Math.round(r * 0.7)}" font-weight="600"
      fill="var(--note-rest-text)">+</text>`;
  } else {
    const displayed = displayNote(note, useFlats, useSolfege);
    const name = displayed.replace(/\d+$/, '');
    const oct = (displayed.match(/\d+$/) ?? [''])[0];
    const nameFontSize = Math.max(8, Math.round((name.length > 1 ? 12 : 14) * r / 26));
    const octFontSize  = Math.max(6, Math.round(9 * r / 26));
    const nameY = y - Math.round(r * 0.14);
    const octY  = y + Math.round(r * 0.40);
    textHtml = `<text x="${x}" y="${nameY}" text-anchor="middle" dominant-baseline="auto"
      font-family="system-ui,sans-serif" font-size="${nameFontSize}" font-weight="600"
      fill="var(--note-rest-text)">${name}</text>
<text x="${x}" y="${octY}" text-anchor="middle" dominant-baseline="auto"
      font-family="system-ui,sans-serif" font-size="${octFontSize}" font-weight="400"
      fill="var(--note-rest-text)" opacity="0.5">${oct}</text>`;
  }

  return `<g class="${allClasses}" data-note-id="${noteId}"${noteAttr}>
  <circle cx="${x}" cy="${y}" r="${r}" fill="var(--note-rest-bg)" stroke="var(--pan-note-stroke)" stroke-width="1.5"/>
  ${textHtml}
</g>`;
}

// Radius for a ring note at sorted index i (0=lowest, n-1=highest).
// Lower notes are physically larger on a real handpan.
function ringNoteRadius(sortedIndex, total) {
  // 10+ ring instruments: keep smaller notes to avoid inner-ring overlap
  const minR = total >= 10 ? 18 : 22;
  const maxR = total >= 10 ? 26 : 30;
  const t = total <= 1 ? 0 : sortedIndex / (total - 1);
  return Math.round(maxR - (maxR - minR) * t);
}

// Bottom notes now rendered as outer ring in unified renderPan — this function is kept
// only for callers that may reference it directly (shellMode='bottom' handled inline).

// Strike-order badges (opts.strikeMarks, from a progression's play level):
// each note's strike numbers and hands, e.g. "2L 4L", in a tag at the
// note's top right, coloured by the hand of its first strike.
function strikeBadgesSvg(placed, strikeMarks) {
  let out = '';
  for (const { note, marks } of strikeMarks) {
    const at = placed.find(p => p.note === note);
    if (!at || !marks.length) continue;
    const label = marks.map(m => `${m.n}${m.hand}`).join(' ');
    const w = 14 + label.length * 13;
    const h = 30;
    // Just outside the note, away from the pan's centre (above the ding),
    // so the note's name stays readable.
    const dx = at.x - 250, dy = at.y - 250;
    const d = Math.hypot(dx, dy);
    const ux = d < 1 ? 0 : dx / d, uy = d < 1 ? -1 : dy / d;
    const off = at.r + 3 + Math.max(Math.abs(ux) * w / 2, Math.abs(uy) * h / 2);
    const x = Math.max(2, Math.min(500 - w - 2, Math.round(at.x + ux * off - w / 2)));
    const y = Math.max(2, Math.min(500 - h - 2, Math.round(at.y + uy * off - h / 2)));
    const hand = marks[0].hand === 'L' ? 'l' : 'r';
    out += `<g class="pan-strike pan-strike-${hand}" data-note="${note}" aria-hidden="true">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
  <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,sans-serif" font-size="23" font-weight="700">${label}</text>
</g>`;
  }
  return out;
}

// opts.faintNotes (optional) draws notes faintly (the next chord), and
// opts.strikeMarks (optional) numbers notes in strike order with L/R; a pan
// rendered without them is exactly as before.
export function renderPan(layout, opts = {}) {
  const { shellMode = 'both', highlightNotes = [], altHighlightNotes = [], rotated = false, useFlats = false, useSolfege = false,
    faintNotes = [], strikeMarks = [] } = opts;

  const cx = 250, cy = 250;
  const hlSet = new Set(highlightNotes);
  const altSet = new Set(altHighlightNotes);
  const faintSet = new Set(faintNotes);
  const placed = []; // { x, y, r, note } of every note drawn, for strike badges
  const place = (x, y, note, classes, id, r) => {
    if (note) placed.push({ x, y, r, note });
    return noteSlotSvg(x, y, note, classes, id, r, useFlats, useSolfege);
  };

  // Assign each unique pitch class in the chord its own color (0-3, root first),
  // cycling for chords with more than 4 distinct pitch classes.
  const pcColorIndex = new Map();
  highlightNotes.forEach(n => {
    const pc = notePC(n);
    if (!pcColorIndex.has(pc)) pcColorIndex.set(pc, pcColorIndex.size % 4);
  });

  const dimTop = shellMode === 'bottom';
  const dimBottom = shellMode === 'top';

  function noteClass(note, isTopShell) {
    const classes = [];
    if (!note) classes.push('empty');
    else if (hlSet.has(note)) classes.push(`highlight highlight-${pcColorIndex.get(notePC(note))}`);
    else if (altSet.has(note)) classes.push(`alt-highlight alt-highlight-${pcColorIndex.get(notePC(note))}`);
    else if (faintSet.has(note)) classes.push('faint');
    if (isTopShell && dimTop) classes.push('dimmed');
    if (!isTopShell && dimBottom) classes.push('dimmed');
    return classes.join(' ');
  }

  const totalRingSlots = layout.top.slots.length;
  const hasInnerRing = totalRingSlots >= 10 && totalRingSlots <= 13;
  const guCount = Math.max(layout.bottom.capacity, layout.bottom.slots.length);

  let svg = `<svg id="${PAN_SVG_ID}" viewBox="0 0 500 500" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="panGrad" cx="38%" cy="32%">
      <stop offset="0%" style="stop-color: var(--pan-g0)"/>
      <stop offset="60%" style="stop-color: var(--pan-g1)"/>
      <stop offset="100%" style="stop-color: var(--pan-g2)"/>
    </radialGradient>
    <radialGradient id="innerGrad" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color: var(--pan-i0)"/>
      <stop offset="100%" style="stop-color: var(--pan-i1)"/>
    </radialGradient>
  </defs>

  <!-- Pan body -->
  <circle cx="${cx}" cy="${cy}" r="193" fill="url(#panGrad)" stroke="var(--pan-rim)" stroke-width="2"/>
  <!-- Outer groove ring -->
  <circle cx="${cx}" cy="${cy}" r="173" fill="none" stroke="var(--pan-groove)" stroke-width="1" stroke-dasharray="3 7"/>
  <!-- Inner center dome -->
  <circle cx="${cx}" cy="${cy}" r="66" fill="url(#innerGrad)" stroke="var(--pan-groove)" stroke-width="1.5"/>
  <!-- Tone field guide ring -->
  <circle cx="${cx}" cy="${cy}" r="142" fill="none" stroke="var(--pan-guide)" stroke-width="1" opacity="0.5"/>
  ${hasInnerRing ? `<circle cx="${cx}" cy="${cy}" r="${totalRingSlots >= 12 ? 95 : 100}" fill="none" stroke="var(--pan-guide)" stroke-width="1" stroke-dasharray="3 5" opacity="0.4"/>` : ''}
`;

  // Ding (center)
  const dingNote = layout.top.ding;
  const dingHighlighted = dingNote && hlSet.has(dingNote);
  const dingClass = [
    !dingNote ? 'empty' : '',
    dingHighlighted ? `highlight highlight-${pcColorIndex.get(notePC(dingNote))}` : '',
    dingNote && !dingHighlighted && faintSet.has(dingNote) ? 'faint' : '',
    dimTop ? 'dimmed' : '',
  ].filter(Boolean).join(' ');
  svg += place(cx, cy, dingNote, `ding ${dingClass}`, 'ding', 36);

  if (hasInnerRing) {
    const outerSlots = OUTER_8_ORDER.map(i => layout.top.slots[i] ?? { note: null });
    const rotationRad = rotated ? Math.PI * (8 - 9) / 8 : 0;
    const outerPos = circlePositions(8, cx, cy, 142, rotationRad);
    for (let i = 0; i < 8; i++) {
      const slot = outerSlots[i];
      const sortedIdx = OUTER_8_ORDER[i];
      const r = ringNoteRadius(sortedIdx, totalRingSlots);
      svg += place(outerPos[i].x, outerPos[i].y, slot.note,
        `ring ${noteClass(slot.note, true)}`, `ring-${sortedIdx}`, r);
    }
    const innerCount = Math.min(5, totalRingSlots - 8);
    const innerPos = innerRingPositions(cx, cy, innerCount);
    for (let i = 0; i < innerCount; i++) {
      const sortedIdx = 8 + i;
      const slot = layout.top.slots[sortedIdx] ?? { note: null };
      const r = ringNoteRadius(sortedIdx, totalRingSlots);
      svg += place(innerPos[i].x, innerPos[i].y, slot.note,
        `ring ${noteClass(slot.note, true)}`, `ring-${sortedIdx}`, r);
    }
  } else {
    const ringCount = Math.max(layout.top.capacity, totalRingSlots);
    const rotationRad = rotated ? Math.PI * (ringCount - 9) / ringCount : 0;
    const ringPos = circlePositions(ringCount, cx, cy, 142, rotationRad);

    let ringSlots = layout.top.slots;
    let sortedIndices = null;
    if (!layout.isCustom) {
      const order = physicalOrder(totalRingSlots);
      if (order) {
        ringSlots = order.map(i => layout.top.slots[i] ?? { note: null });
        sortedIndices = order;
      }
    }

    for (let i = 0; i < ringCount; i++) {
      const slot = ringSlots[i] ?? { note: null };
      const pos = ringPos[i];
      const r = sortedIndices ? ringNoteRadius(sortedIndices[i], totalRingSlots) : 22;
      svg += place(pos.x, pos.y, slot.note, `ring ${noteClass(slot.note, true)}`, `ring-${i}`, r);
    }
  }

  // Bottom shell — outer orbit circles around the pan body
  if (guCount > 0) {
    const guPos = circlePositions(guCount, cx, cy, 228, 0);
    for (let i = 0; i < guCount; i++) {
      const slot = layout.bottom.slots[i] ?? { note: null };
      svg += place(guPos[i].x, guPos[i].y, slot.note,
        `gu ${noteClass(slot.note, false)}`, `gu-${i}`, 16);
    }
  }

  if (strikeMarks.length) svg += strikeBadgesSvg(placed, strikeMarks);
  svg += '</svg>';
  return svg;
}

// Update highlight using full note strings (with octave)
export function updatePanHighlight(noteNames, altNoteNames = []) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  const nameSet = new Set(noteNames);
  const altSet = new Set(altNoteNames);
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const note = el.dataset.note;
    el.classList.toggle('highlight', !!(note && nameSet.has(note)));
    el.classList.toggle('alt-highlight', !!(note && !nameSet.has(note) && altSet.has(note)));
  });
}

export function updatePanShellMode(mode) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  svg.querySelectorAll('.pan-note').forEach(el => {
    const isTop = el.classList.contains('ding') || el.classList.contains('ring');
    const isBottom = el.classList.contains('gu');
    if (mode === 'top') el.classList.toggle('dimmed', isBottom);
    else if (mode === 'bottom') el.classList.toggle('dimmed', isTop);
    else el.classList.remove('dimmed');
  });
}

// Highlight the currently playing note(s). Clears any previous playing state
// so only the most-recently-requested notes are lit. Auto-clears after 2.2s.
let _playTimer = null;
export function updatePanPlaying(noteNames) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  if (_playTimer !== null) { clearTimeout(_playTimer); _playTimer = null; }
  svg.querySelectorAll('.pan-note.playing').forEach(el => el.classList.remove('playing'));
  const nameSet = new Set(noteNames);
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const note = el.dataset.note;
    if (note && nameSet.has(note)) el.classList.add('playing');
  });
  _playTimer = setTimeout(() => {
    svg.querySelectorAll('.pan-note.playing').forEach(el => el.classList.remove('playing'));
    _playTimer = null;
  }, 2200);
}
