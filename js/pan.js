import { displayNote, noteToMidi, notePC } from './data.js';
import { kalimbaOrder } from './kalimbas.js';

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

// ── Tongue drums (js/tonguedrums.js) ────────────────────────────────────────
// The same notes, ids and classes as the handpan drawing, so taps, chord
// colours, the playing glow and the editor work unchanged; each note is a
// tongue (a rounded rect, which pan-drawing.css colours like a dent) cut
// into the shell and pointing at the middle. The lowest note sits at the
// bottom and the notes climb alternately right and left, the way makers lay
// them out (https://www.hluru.net/en-us/blogs/skills-tips/15-note-tongue-drum-sheet-music-3-advanced-songs-free-tabs).
function tongueAngles(count) {
  const step = (2 * Math.PI) / count;
  return Array.from({ length: count }, (_, i) => {
    const k = Math.ceil(i / 2);
    const side = i % 2 === 1 ? -1 : 1; // 1: right of the bottom, -1: left
    return Math.PI / 2 + side * k * step;
  });
}

function tongueSvg(x, y, angle, note, classes, noteId, w, h, useFlats, useSolfege) {
  const deg = Math.round((angle * 180) / Math.PI - 90); // local -y points at the middle
  const allClasses = ['pan-note', 'tongue', ...classes.split(' ').filter(Boolean)].join(' ');
  const noteAttr = note ? ` data-note="${note}"` : '';
  const cut = `M ${-w / 2 - 5} ${h / 2} L ${-w / 2 - 5} ${-h / 2 + w / 2} A ${w / 2 + 5} ${w / 2 + 5} 0 0 1 ${w / 2 + 5} ${-h / 2 + w / 2} L ${w / 2 + 5} ${h / 2}`;
  let text;
  if (!note) {
    text = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="${Math.round(w * 0.5)}" font-weight="600" fill="var(--note-rest-text)">+</text>`;
  } else {
    const shown = displayNote(note, useFlats, useSolfege);
    const name = shown.replace(/\d+$/, '');
    const oct = (shown.match(/\d+$/) ?? [''])[0];
    const fs = Math.max(9, Math.round((name.length > 1 ? 12 : 14) * w / 40));
    text = `<text x="${x}" y="${y - 2}" text-anchor="middle" dominant-baseline="auto" font-family="system-ui,sans-serif" font-size="${fs}" font-weight="600" fill="var(--note-rest-text)">${name}</text>
<text x="${x}" y="${y + Math.round(fs * 0.9)}" text-anchor="middle" dominant-baseline="auto" font-family="system-ui,sans-serif" font-size="${Math.max(7, Math.round(fs * 0.65))}" font-weight="400" fill="var(--note-rest-text)" opacity="0.5">${oct}</text>`;
  }
  return `<g class="${allClasses}" data-note-id="${noteId}"${noteAttr}>
  <g transform="translate(${x} ${y}) rotate(${deg})">
    <path d="${cut}" fill="none" stroke="var(--pan-groove)" stroke-width="2" stroke-linecap="round"/>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="var(--note-rest-bg)" stroke="var(--pan-note-stroke)" stroke-width="1.5"/>
  </g>
  ${text}
</g>`;
}

function renderTongueDrum(layout, { noteClass, useFlats, useSolfege, placed, strikeMarks }) {
  const cx = 250, cy = 250;
  let svg = `<svg id="${PAN_SVG_ID}" class="is-tongue-drum" viewBox="0 0 500 500" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="panGrad" cx="38%" cy="32%">
      <stop offset="0%" style="stop-color: var(--pan-g0)"/>
      <stop offset="60%" style="stop-color: var(--pan-g1)"/>
      <stop offset="100%" style="stop-color: var(--pan-g2)"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="215" fill="url(#panGrad)" stroke="var(--pan-rim)" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="none" stroke="var(--pan-groove)" stroke-width="1" stroke-dasharray="3 7"/>
`;
  // The ring: every note but a centre one, in slot order (custom drums keep
  // their empty places). Lower notes get bigger tongues.
  const ring = [];
  if (!layout.centre) ring.push({ note: layout.top.ding, id: 'ding', top: true });
  layout.top.slots.forEach((slot, i) => ring.push({ note: slot.note, id: `ring-${i}`, top: true }));
  layout.bottom.slots.forEach((slot, i) => ring.push({ note: slot.note, id: `gu-${i}`, top: false }));
  const n = Math.max(ring.length, 1);
  const angles = tongueAngles(n);
  const baseW = Math.max(26, Math.min(48, Math.round(640 / n)));
  ring.forEach((t, i) => {
    const scale = 1.12 - 0.24 * (n <= 1 ? 0 : i / (n - 1)); // the lowest first, biggest
    const w = Math.round(baseW * scale);
    const h = Math.round(w * 1.9);
    const r = 205 - h / 2 - 14;
    const x = Math.round(cx + r * Math.cos(angles[i]));
    const y = Math.round(cy + r * Math.sin(angles[i]));
    if (t.note) placed.push({ x, y, r: w / 2, note: t.note });
    const cls = t.id === 'ding' ? `ding ${noteClass(t.note, true)}` : t.top ? `ring ${noteClass(t.note, true)}` : `gu ${noteClass(t.note, false)}`;
    svg += tongueSvg(x, y, angles[i], t.note, cls, t.id, w, h, useFlats, useSolfege);
  });
  if (layout.centre) {
    if (layout.top.ding) placed.push({ x: cx, y: cy, r: 44, note: layout.top.ding });
    svg += noteSlotSvg(cx, cy, layout.top.ding, `ding ${noteClass(layout.top.ding, true)}`, 'ding', 44, useFlats, useSolfege);
  }
  if (strikeMarks.length) svg += strikeBadgesSvg(placed, strikeMarks);
  return svg + '</svg>';
}

// ── Kalimbas (js/kalimbas.js) ────────────────────────────────────────────────
// Keys (tines) over a bridge, left to right as the maker lays them out
// (layout.order) or in the standard layout (kalimbaOrder): the lowest in the
// middle, longer keys for lower notes. Each key is a rounded rect, coloured by
// pan-drawing.css like a dent; same note ids and classes as the handpan.
function renderKalimba(layout, { noteClass, useFlats, useSolfege, placed, strikeMarks }) {
  const keys = [{ note: layout.top.ding, id: 'ding' }, ...layout.top.slots.map((slot, i) => ({ note: slot.note, id: `ring-${i}` }))];
  let ordered;
  if (layout.order?.length === keys.length) {
    const left = [...keys];
    ordered = layout.order.map(n => left.splice(left.findIndex(k => k.note === n), 1)[0] ?? { note: n, id: 'ring-x' });
  } else ordered = kalimbaOrder(keys);
  const midis = keys.filter(k => k.note).map(k => noteToMidi(k.note));
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const n = ordered.length;
  const span = 400, x0 = 50, bridgeY = 112, top = 66;
  const step = span / n;
  const w = Math.max(9, Math.min(22, Math.round(step * 0.72)));
  let svg = `<svg id="${PAN_SVG_ID}" class="is-kalimba" viewBox="0 0 500 500" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="panGrad" cx="38%" cy="30%">
      <stop offset="0%" style="stop-color: var(--pan-g0)"/>
      <stop offset="60%" style="stop-color: var(--pan-g1)"/>
      <stop offset="100%" style="stop-color: var(--pan-g2)"/>
    </radialGradient>
  </defs>
  <rect x="24" y="30" width="452" height="440" rx="44" fill="url(#panGrad)" stroke="var(--pan-rim)" stroke-width="2"/>
  <circle cx="250" cy="405" r="30" fill="var(--pan-rim)" opacity="0.55"/>
`;
  ordered.forEach((k, i) => {
    const t = k.note && hi > lo ? (noteToMidi(k.note) - lo) / (hi - lo) : 0.5;
    const len = Math.round(250 - 130 * t);
    const cx = Math.round(x0 + step * (i + 0.5));
    const y1 = top, y2 = bridgeY + len;
    if (k.note) placed.push({ x: cx, y: y2 - w, r: w / 2, note: k.note });
    const cls = k.id === 'ding' ? `ding ${noteClass(k.note, true)}` : `ring ${noteClass(k.note, true)}`;
    const shown = k.note ? displayNote(k.note, useFlats, useSolfege) : '+';
    const name = shown.replace(/\d+$/, '');
    const oct = (shown.match(/\d+$/) ?? [''])[0];
    const fs = Math.max(8, Math.min(13, Math.round(w * 0.62)));
    svg += `<g class="pan-note kalimba-key ${cls}" data-note-id="${k.id}"${k.note ? ` data-note="${k.note}"` : ''}>
  <rect x="${cx - w / 2}" y="${y1}" width="${w}" height="${y2 - y1}" rx="${w / 2}" fill="var(--note-rest-bg)" stroke="var(--pan-note-stroke)" stroke-width="1.5"/>
  <text x="${cx}" y="${y2 - fs * 1.3}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fs}" font-weight="600" fill="var(--note-rest-text)">${name}</text>
  ${oct ? `<text x="${cx}" y="${y2 - fs * 0.35}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.max(7, Math.round(fs * 0.7))}" fill="var(--note-rest-text)" opacity="0.5">${oct}</text>` : ''}
</g>`;
  });
  // The bridge, over the keys' roots.
  svg += `<rect x="36" y="${bridgeY - 9}" width="428" height="18" rx="9" fill="var(--pan-rim)"/>`;
  if (strikeMarks.length) svg += strikeBadgesSvg(placed, strikeMarks);
  return svg + '</svg>';
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
  // A handpan whose tone fields were moved to where they are on the real one
  // (the editor's Move notes): layout.pos = { [place id]: { x, y } }.
  const moved = layout.instrument ? null : layout.pos;
  const place = (x, y, note, classes, id, r) => {
    const p = moved?.[id];
    if (p) ({ x, y } = p);
    if (note) placed.push({ x, y, r, note });
    return noteSlotSvg(x, y, note, classes, id, r, useFlats, useSolfege)
      .replace('<g ', `<g data-x="${x}" data-y="${y}" data-r="${r}" `);
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

  if (layout.instrument === 'tongue-drum') return renderTongueDrum(layout, { noteClass, useFlats, useSolfege, placed, strikeMarks });
  if (layout.instrument === 'kalimba') return renderKalimba(layout, { noteClass, useFlats, useSolfege, placed, strikeMarks });

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
// The app has one pan (found by id); the website passes the drawing it means.
let _playTimer = null;
/** @param {string[]} noteNames @param {Element | null} [svg] */
export function updatePanPlaying(noteNames, svg = document.getElementById(PAN_SVG_ID)) {
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

// ── Moving tone fields (the editor's Move notes) ────────────────────────────
// Handpans are laid out in many ways, so the tone fields of a handpan can be
// moved on the drawing to where they are on the real one. Places on top stay
// on the pan, the ones underneath round it, and two never overlap.
export const PAN_BODY_R = 193;
const PAN_GAP = 3;

/** Where a place dropped at (x, y) settles, given the other places
 *  [{ x, y, r }]: inside its area and clear of the others, or null when it
 *  can't fit there. id: 'ding' / 'ring-N' (on top) or 'gu-N' (underneath). */
export function settlePanPlace(id, x, y, r, others, { cx = 250, cy = 250, size = 500 } = {}) {
  const under = id.startsWith('gu-');
  const into = (px, py) => {
    let dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (d < 1) { dx = 0; dy = 1; d = 1; } // dropped dead centre: straight down
    if (!under) {
      const max = PAN_BODY_R - r - PAN_GAP;
      return d > max ? [cx + dx / d * max, cy + dy / d * max] : [px, py];
    }
    const min = PAN_BODY_R + r + PAN_GAP;
    let [qx, qy] = d < min ? [cx + dx / d * min, cy + dy / d * min] : [px, py];
    qx = Math.min(size - r - PAN_GAP, Math.max(r + PAN_GAP, qx));
    qy = Math.min(size - r - PAN_GAP, Math.max(r + PAN_GAP, qy));
    return [qx, qy];
  };
  const clear = (px, py) => others.every(o => Math.hypot(px - o.x, py - o.y) >= r + o.r + PAN_GAP);
  // Where it was dropped (kept in its area), else the nearest free spot
  // round that: rings of candidates further and further out.
  const [px, py] = into(x, y);
  if (clear(px, py)) return { x: Math.round(px), y: Math.round(py) };
  for (let R = 4; R <= size; R += 4) {
    const steps = Math.max(12, Math.round(R / 3));
    let best = null;
    for (let k = 0; k < steps; k++) {
      const a = (2 * Math.PI * k) / steps;
      const [qx, qy] = into(px + R * Math.cos(a), py + R * Math.sin(a));
      if (!clear(qx, qy)) continue;
      const d = Math.hypot(qx - px, qy - py);
      if (!best || d < best.d) best = { x: qx, y: qy, d };
    }
    if (best) return { x: Math.round(best.x), y: Math.round(best.y) };
  }
  return null;
}
