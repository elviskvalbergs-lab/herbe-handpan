export const PAN_SVG_ID = 'handpan-svg';

// Physical handpan ring layout (confirmed from klangzeug.de for all scales).
// Notes sorted ascending (n1=lowest, nN=highest) are placed clockwise from 12 o'clock:
//  7-ring: [n7, n5, n3, n1, n2, n4, n6]
//  8-ring: [n8, n7, n5, n3, n1, n2, n4, n6]
//  9-ring: [n9, n7, n5, n3, n1, n2, n4, n6, n8]
// 10-ring: [n10,n7, n5, n3, n1, n2, n4, n6, n8, n9]
function physicalOrder(n) {
  if (n === 7)  return [6,4,2,0,1,3,5];
  if (n === 8)  return [7,6,4,2,0,1,3,5];
  if (n === 9)  return [8,6,4,2,0,1,3,5,7];
  if (n === 10) return [9,6,4,2,0,1,3,5,7,8];
  return null;
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
function noteSlotSvg(x, y, note, extraClasses, noteId, r = 24) {
  const isEmpty = !note;
  const allClasses = ['pan-note', ...extraClasses.split(' ').filter(Boolean)].join(' ');
  const noteAttr = note ? ` data-note="${note}"` : '';

  let textHtml;
  if (isEmpty) {
    textHtml = `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui,sans-serif" font-size="${Math.round(r * 0.7)}" font-weight="600"
      fill="var(--note-rest-text)">+</text>`;
  } else {
    const name = note.replace(/\d+$/, '');
    const oct = (note.match(/\d+$/) ?? [''])[0];
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

export function renderPan(layout, opts = {}) {
  const { shellMode = 'both', highlightNotes = [], rotated = false } = opts;

  const cx = 250, cy = 240;
  // Match full note strings (with octave) for precise highlighting
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

  let svg = `<svg id="${PAN_SVG_ID}" viewBox="0 0 500 560" xmlns="http://www.w3.org/2000/svg">
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
  </defs>

  <!-- Pan body -->
  <circle cx="${cx}" cy="${cy}" r="220" fill="url(#panGrad)" stroke="#2a5040" stroke-width="2"/>
  <!-- Outer groove ring -->
  <circle cx="${cx}" cy="${cy}" r="195" fill="none" stroke="#1c3828" stroke-width="1" stroke-dasharray="3 7"/>
  <!-- Inner center dome -->
  <circle cx="${cx}" cy="${cy}" r="68" fill="url(#innerGrad)" stroke="#1c3828" stroke-width="1.5"/>
  <!-- Tone field guide ring -->
  <circle cx="${cx}" cy="${cy}" r="145" fill="none" stroke="#183028" stroke-width="1" opacity="0.5"/>
`;

  // Ding (center)
  const dingNote = layout.top.ding;
  const dingClass = [
    !dingNote ? 'empty' : '',
    dingNote && hlSet.has(dingNote) ? 'highlight' : '',
    dimTop ? 'dimmed' : '',
  ].filter(Boolean).join(' ');
  svg += noteSlotSvg(cx, cy, dingNote, `ding ${dingClass}`, 'ding', 30);

  // Ring slots — physical layout + rotation
  const ringCount = Math.max(layout.top.capacity, layout.top.slots.length);
  // When rotated: shift so the gap between the two lowest notes faces the player.
  // Formula: π(N−9)/N puts the n1/n2 midpoint at the bottom for any ring size.
  const rotationRad = rotated ? Math.PI * (ringCount - 9) / ringCount : 0;
  const ringPos = circlePositions(ringCount, cx, cy, 145, rotationRad);

  let ringSlots = layout.top.slots;
  let sortedIndices = null;
  if (!layout.isCustom) {
    const order = physicalOrder(layout.top.slots.length);
    if (order) {
      ringSlots = order.map(i => layout.top.slots[i] ?? { note: null });
      sortedIndices = order; // order[i] = original sorted index for position i
    }
  }

  for (let i = 0; i < ringCount; i++) {
    const slot = ringSlots[i] ?? { note: null };
    const pos = ringPos[i];
    const r = sortedIndices
      ? ringNoteRadius(sortedIndices[i], layout.top.slots.length)
      : 22; // fallback for custom layouts
    svg += noteSlotSvg(pos.x, pos.y, slot.note, `ring ${noteClass(slot.note, true)}`, `ring-${i}`, r);
  }

  // Gu (bottom shell)
  const guCount = Math.max(layout.bottom.capacity, layout.bottom.slots.length);
  const guSpacing = 76;
  const guStartX = cx - ((guCount - 1) * guSpacing) / 2;
  const guY = 496;

  for (let i = 0; i < guCount; i++) {
    const slot = layout.bottom.slots[i] ?? { note: null };
    const gx = guStartX + i * guSpacing;
    svg += noteSlotSvg(gx, guY, slot.note, `gu ${noteClass(slot.note, false)}`, `gu-${i}`, 24);
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

// Briefly add 'playing' class — matches against full note strings (with octave)
export function updatePanPlaying(noteNames) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  const nameSet = new Set(noteNames);
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const note = el.dataset.note;
    if (note && nameSet.has(note)) {
      el.classList.add('playing');
      setTimeout(() => el.classList.remove('playing'), 2200);
    }
  });
}
