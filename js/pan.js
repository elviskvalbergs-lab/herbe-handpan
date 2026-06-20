import { getNoteName } from './data.js';

export const PAN_SVG_ID = 'handpan-svg';

// Compute (x, y) positions for N items evenly around a circle
function circlePositions(count, cx, cy, r) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI / count) - Math.PI / 2; // start at top
    return {
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    };
  });
}

// Render a filled or empty note slot as SVG string
function noteSlotSvg(x, y, note, extraClasses, noteId, isCircle = false) {
  const label = note ? getNoteName(note) : '+';
  const isEmpty = !note;
  const allClasses = ['pan-note', ...extraClasses.split(' ').filter(Boolean)].join(' ');

  if (isCircle) {
    const r = 30;
    return `<g class="${allClasses}" data-note-id="${noteId}">
  <circle cx="${x}" cy="${y}" r="${r}" fill="var(--note-rest-bg)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,sans-serif" font-size="${isEmpty ? 20 : 13}" font-weight="600"
    fill="var(--note-rest-text)">${label}</text>
</g>`;
  }

  // Rounded rectangle for ring slots
  const w = 50, h = 38;
  return `<g class="${allClasses}" data-note-id="${noteId}">
  <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8"
    fill="var(--note-rest-bg)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,sans-serif" font-size="${isEmpty ? 18 : 13}" font-weight="600"
    fill="var(--note-rest-text)">${label}</text>
</g>`;
}

// Render the full handpan as an SVG string
export function renderPan(layout, opts = {}) {
  const { shellMode = 'both', highlightNotes = [] } = opts;

  const cx = 250, cy = 240;
  const hlNames = new Set(highlightNotes.map(n =>
    typeof n === 'string' ? getNoteName(n) : n
  ));

  const dimTop = shellMode === 'bottom';
  const dimBottom = shellMode === 'top';

  function noteClass(note, isTopShell) {
    const classes = [];
    if (!note) classes.push('empty');
    else if (hlNames.has(getNoteName(note))) classes.push('highlight');
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
    dingNote && hlNames.has(getNoteName(dingNote)) ? 'highlight' : '',
    dimTop ? 'dimmed' : '',
  ].filter(Boolean).join(' ');
  svg += noteSlotSvg(cx, cy, dingNote, `ding ${dingClass}`, 'ding', true);

  // Ring slots
  const ringCount = Math.max(layout.top.capacity, layout.top.slots.length);
  const ringPos = circlePositions(ringCount, cx, cy, 145);

  for (let i = 0; i < ringCount; i++) {
    const slot = layout.top.slots[i] ?? { note: null };
    const pos = ringPos[i];
    svg += noteSlotSvg(pos.x, pos.y, slot.note, `ring ${noteClass(slot.note, true)}`, `ring-${i}`);
  }

  // Gu (bottom shell) slots — centered below the main circle
  const guCount = Math.max(layout.bottom.capacity, layout.bottom.slots.length);
  const guSpacing = 76;
  const guStartX = cx - ((guCount - 1) * guSpacing) / 2;
  const guY = 496;

  for (let i = 0; i < guCount; i++) {
    const slot = layout.bottom.slots[i] ?? { note: null };
    const gx = guStartX + i * guSpacing;
    svg += noteSlotSvg(gx, guY, slot.note, `gu ${noteClass(slot.note, false)}`, `gu-${i}`, true);
  }

  svg += '</svg>';
  return svg;
}

// Update highlight classes on the existing SVG without full re-render
export function updatePanHighlight(noteNames) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  const nameSet = new Set(noteNames.map(n => getNoteName(n)));
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const label = el.querySelector('text')?.textContent;
    el.classList.toggle('highlight', !!(label && nameSet.has(label)));
  });
}

// Update shell dimming without re-render
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

// Briefly add 'playing' class to notes then remove it
export function updatePanPlaying(noteNames) {
  const svg = document.getElementById(PAN_SVG_ID);
  if (!svg) return;
  const nameSet = new Set(noteNames.map(n => getNoteName(n)));
  svg.querySelectorAll('.pan-note').forEach(el => {
    if (el.classList.contains('empty')) return;
    const label = el.querySelector('text')?.textContent;
    if (label && nameSet.has(label)) {
      el.classList.add('playing');
      setTimeout(() => el.classList.remove('playing'), 2200);
    }
  });
}
