import { displayNote } from './data.js';

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

// Positions for inner ring notes — symmetric around 12 o'clock at ±45°.
function innerRingPositions(cx, cy, r) {
  const angles = [-Math.PI / 2 - Math.PI / 4, -Math.PI / 2 + Math.PI / 4];
  return angles.map(a => ({
    x: Math.round(cx + r * Math.cos(a)),
    y: Math.round(cy + r * Math.sin(a)),
  }));
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
function noteSlotSvg(x, y, note, extraClasses, noteId, r = 24, useFlats = false) {
  const isEmpty = !note;
  const allClasses = ['pan-note', ...extraClasses.split(' ').filter(Boolean)].join(' ');
  const noteAttr = note ? ` data-note="${note}"` : '';

  let textHtml;
  if (isEmpty) {
    textHtml = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui,sans-serif" font-size="${Math.round(r * 0.7)}" font-weight="600"
      fill="var(--note-rest-text)">+</text>`;
  } else {
    const displayed = displayNote(note, useFlats);
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
  <circle cx="${x}" cy="${y}" r="${r}" fill="var(--note-rest-bg)" stroke="var(--border)" stroke-width="1.5"/>
  ${textHtml}
</g>`;
}

// Radius for a ring note at sorted index i (0=lowest, n-1=highest).
// Lower notes are physically larger on a real handpan.
function ringNoteRadius(sortedIndex, total) {
  const minR = 18, maxR = 26;
  const t = total <= 1 ? 0 : sortedIndex / (total - 1);
  return Math.round(maxR - (maxR - minR) * t);
}

function renderBottomShell(layout, opts = {}) {
  const { highlightNotes = [], useFlats = false } = opts;
  const cx = 250, cy = 240;
  const hlSet = new Set(highlightNotes);
  const guCount = Math.max(layout.bottom.capacity, layout.bottom.slots.length);

  let svg = `<svg id="${PAN_SVG_ID}" viewBox="0 0 500 490" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="panGrad" cx="38%" cy="32%">
      <stop offset="0%" stop-color="#1a3828"/>
      <stop offset="60%" stop-color="#0d2018"/>
      <stop offset="100%" stop-color="#060f0c"/>
    </radialGradient>
  </defs>
  <!-- Pan body -->
  <circle cx="${cx}" cy="${cy}" r="220" fill="url(#panGrad)" stroke="#2a5040" stroke-width="2"/>
  <!-- Outer groove ring -->
  <circle cx="${cx}" cy="${cy}" r="195" fill="none" stroke="#1c3828" stroke-width="1" stroke-dasharray="3 7"/>
  <!-- Gu ring guide -->
  <circle cx="${cx}" cy="${cy}" r="145" fill="none" stroke="#183028" stroke-width="1" opacity="0.5"/>
  <!-- Inner groove ring -->
  <circle cx="${cx}" cy="${cy}" r="80" fill="none" stroke="#1c3828" stroke-width="1" stroke-dasharray="2 5" opacity="0.6"/>
  <!-- Center hole -->
  <circle cx="${cx}" cy="${cy}" r="50" fill="#030a06" stroke="#1c3828" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="#0a1a12" stroke-width="2" opacity="0.7"/>
`;

  if (guCount > 0) {
    const guPos = circlePositions(guCount, cx, cy, 145, 0);
    for (let i = 0; i < guCount; i++) {
      const slot = layout.bottom.slots[i] ?? { note: null };
      const isHighlighted = !!(slot.note && hlSet.has(slot.note));
      const cls = ['gu', !slot.note ? 'empty' : '', isHighlighted ? 'highlight' : ''].filter(Boolean).join(' ');
      svg += noteSlotSvg(guPos[i].x, guPos[i].y, slot.note, cls, `gu-${i}`, 24, useFlats);
    }
  }

  svg += '</svg>';
  return svg;
}

export function renderPan(layout, opts = {}) {
  const { shellMode = 'both', highlightNotes = [], rotated = false, useFlats = false } = opts;

  // Bottom shell gets its own dedicated view.
  if (shellMode === 'bottom') return renderBottomShell(layout, opts);

  const cx = 250, cy = 240;
  const hlSet = new Set(highlightNotes);

  const dimTop = shellMode === 'bottom';
  const dimBottom = shellMode === 'top';

  function noteClass(note, isTopShell) {
    const classes = [];
    if (!note) classes.push('empty');
    else if (hlSet.has(note)) classes.push('highlight');
    if (isTopShell && dimTop) classes.push('dimmed');
    if (!isTopShell && dimBottom) classes.push('dimmed');
    return classes.join(' ');
  }

  // 10-ring scales split into outer (n1-n8) + inner (n9, n10) rings.
  const totalRingSlots = layout.top.slots.length;
  const hasInnerRing = !layout.isCustom && totalRingSlots >= 10;

  let svg = `<svg id="${PAN_SVG_ID}" viewBox="0 0 500 490" width="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="panGrad" cx="38%" cy="32%">
      <stop offset="0%" stop-color="#1a3828"/>
      <stop offset="60%" stop-color="#0d2018"/>
      <stop offset="100%" stop-color="#060f0c"/>
    </radialGradient>
    <radialGradient id="innerGrad" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#183028"/>
      <stop offset="100%" stop-color="#0d1e18"/>
    </radialGradient>
    <clipPath id="panClip">
      <circle cx="${cx}" cy="${cy}" r="218"/>
    </clipPath>
  </defs>

  <!-- Pan body -->
  <circle cx="${cx}" cy="${cy}" r="220" fill="url(#panGrad)" stroke="#2a5040" stroke-width="2"/>
  <!-- Outer groove ring -->
  <circle cx="${cx}" cy="${cy}" r="195" fill="none" stroke="#1c3828" stroke-width="1" stroke-dasharray="3 7"/>
  <!-- Gu separator groove -->
  <path d="M ${cx - 90},${cy + 175} A 195,195 0 0,1 ${cx + 90},${cy + 175}"
    fill="none" stroke="#2a5040" stroke-width="1.5" stroke-dasharray="4 6" opacity="0.9"/>
  <!-- Inner center dome -->
  <circle cx="${cx}" cy="${cy}" r="68" fill="url(#innerGrad)" stroke="#1c3828" stroke-width="1.5"/>
  <!-- Outer tone field guide ring -->
  <circle cx="${cx}" cy="${cy}" r="145" fill="none" stroke="#183028" stroke-width="1" opacity="0.5"/>
  ${hasInnerRing ? `<!-- Inner tone field guide ring -->
  <circle cx="${cx}" cy="${cy}" r="100" fill="none" stroke="#183028" stroke-width="1" stroke-dasharray="3 5" opacity="0.4"/>` : ''}
`;

  // Ding (center)
  const dingNote = layout.top.ding;
  const dingClass = [
    !dingNote ? 'empty' : '',
    dingNote && hlSet.has(dingNote) ? 'highlight' : '',
    dimTop ? 'dimmed' : '',
  ].filter(Boolean).join(' ');
  svg += noteSlotSvg(cx, cy, dingNote, `ding ${dingClass}`, 'ding', 30, useFlats);

  if (hasInnerRing) {
    // 10-ring: outer ring gets 8 lower notes (n1-n8), inner ring gets n9 and n10.
    const outerSlots = OUTER_8_ORDER.map(i => layout.top.slots[i] ?? { note: null });
    const rotationRad = rotated ? Math.PI * (8 - 9) / 8 : 0;
    const outerPos = circlePositions(8, cx, cy, 145, rotationRad);
    for (let i = 0; i < 8; i++) {
      const slot = outerSlots[i];
      const sortedIdx = OUTER_8_ORDER[i]; // position in original slots array (0-7)
      const r = ringNoteRadius(sortedIdx, totalRingSlots);
      svg += noteSlotSvg(outerPos[i].x, outerPos[i].y, slot.note,
        `ring ${noteClass(slot.note, true)}`, `ring-${sortedIdx}`, r, useFlats);
    }
    // Inner ring: n9 (index 8) and n10 (index 9)
    const innerPos = innerRingPositions(cx, cy, 100);
    for (let i = 0; i < Math.min(2, totalRingSlots - 8); i++) {
      const sortedIdx = 8 + i;
      const slot = layout.top.slots[sortedIdx] ?? { note: null };
      const r = ringNoteRadius(sortedIdx, totalRingSlots);
      svg += noteSlotSvg(innerPos[i].x, innerPos[i].y, slot.note,
        `ring ${noteClass(slot.note, true)}`, `ring-${sortedIdx}`, r, useFlats);
    }
  } else {
    // Standard: all ring slots on one ring.
    const ringCount = Math.max(layout.top.capacity, totalRingSlots);
    const rotationRad = rotated ? Math.PI * (ringCount - 9) / ringCount : 0;
    const ringPos = circlePositions(ringCount, cx, cy, 145, rotationRad);

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
      const r = sortedIndices
        ? ringNoteRadius(sortedIndices[i], totalRingSlots)
        : 22;
      svg += noteSlotSvg(pos.x, pos.y, slot.note, `ring ${noteClass(slot.note, true)}`, `ring-${i}`, r, useFlats);
    }
  }

  // Gu (bottom shell) — placed inside the pan body, lower zone
  const guCount = Math.max(layout.bottom.capacity, layout.bottom.slots.length);
  if (guCount > 0) {
    const guR = 20;
    const guY = cy + 197; // inside the pan (pan bottom edge = cy+220)
    const guSpacing = Math.min(60, guCount > 1 ? 180 / (guCount - 1) : 0);
    const guStartX = guCount === 1 ? cx : cx - ((guCount - 1) * guSpacing) / 2;

    // Clip group so circles don't bleed outside the pan body
    svg += `<g clip-path="url(#panClip)">`;
    for (let i = 0; i < guCount; i++) {
      const slot = layout.bottom.slots[i] ?? { note: null };
      const gx = guCount === 1 ? cx : guStartX + i * guSpacing;
      svg += noteSlotSvg(gx, guY, slot.note, `gu ${noteClass(slot.note, false)}`, `gu-${i}`, guR, useFlats);
    }
    svg += `</g>`;
  }

  svg += '</svg>';
  return svg;
}

// Update highlight using full note strings (with octave)
export function updatePanHighlight(noteNames) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  const nameSet = new Set(noteNames);
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const note = el.dataset.note;
    el.classList.toggle('highlight', !!(note && nameSet.has(note)));
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
