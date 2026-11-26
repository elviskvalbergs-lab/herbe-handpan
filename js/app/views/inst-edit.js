// Photo and hole layout of a bought instrument; changing a fingering by hand.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote } from '../../data.js';
import { noteSearchWords } from '../../pickmatch.js';
import { icon } from '../../icons.js';
import { OC_FINGER_ORDER, buildScaleChambers, hzToMidi, pitchLabel, predictFingeringHz, scaleToMidis } from '../../ocarina.js';
import { getChart, instrumentFromChart } from '../../charts.js';
import { layoutFamilyInfo } from '../../layoutfamilies.js';
import { getClayBodies, getInstrument, isTubeFamily, midiToNoteName, saveClayBodies, saveInstrument, usesLayout, windWord } from '../../instruments.js';
import { SUB_LAYOUTS, cropRect, defaultCustomHoles, duplicateFingers, finishBuild, holeDisplayOrder, holeLabel, holeSpot, reverseHandFingers, updateClayBody, withFixedFingerings } from '../../builder.js';
import { renderFingering } from '../../ocarina-ui.js';

// Hole fingers: which finger covers each hole, in opening order.
// ── Photo and hole layout of a bought instrument ─────────────────────────────

function instEditMeta(inst) {
  return inst.kind === 'custom' && !usesLayout(inst) ? 'Name, photo, holes, fingers and readings' : 'Name and photo';
}

// A photo from the camera or the library, read at up to 1600 px on the long
// side for cropping: { src (JPEG data URL), iw, ih }.
async function readImageFile(file, max = 1600) {
  let src = null;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(src.width * k);
  canvas.height = Math.round(src.height * k);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL('image/jpeg', 0.9), iw: canvas.width, ih: canvas.height };
}

// Every photo of an instrument has the same shape, so pictures line up:
// 4:3 for an ocarina or kalimba, long and thin (3:1) for a flute, square for a round drum.
function photoRatio(inst) { return isTubeFamily(inst.family) ? 3 : inst.family === 'handpan' || inst.family === 'tongue-drum' ? 1 : 4 / 3; }

// Crop step after picking a photo: the photo under a frame of that shape;
// drag to move it, the slider (or a pinch / the wheel) to zoom.
function photoCropSheet() {
  const c = state.photoCrop;
  return uiSheet({
    key: 'photo-crop', title: 'Fit the photo', close: 'crop-cancel',
    body: `
      <p class="sheet-text">Drag the photo so the instrument fills the frame, top side up. Zoom in to crop closer; Rotate turns an upright photo.</p>
      <div class="crop-stage" style="aspect-ratio: ${c.ratio}"><img class="crop-img" src="${c.src}" alt="" draggable="false"></div>
      <div class="crop-tools">
        <label class="crop-zoom-row">${icon('search')}<input type="range" class="crop-zoom" data-action="crop-zoom" min="1" max="4" step="0.01" value="${c.zoom}" aria-label="Zoom"></label>
        <button type="button" class="btn btn-secondary btn-sm" data-action="crop-rotate" title="Turn the photo a quarter turn">${icon('rotate')} Rotate</button>
      </div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="crop-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="crop-done">Use photo</button>`,
  });
}

// A quarter turn clockwise (a photo taken upright), as a new image.
async function rotateCropImage() {
  const c = state.photoCrop;
  if (!c) return;
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = c.src; });
  const canvas = document.createElement('canvas');
  canvas.width = c.ih; canvas.height = c.iw;
  const g = canvas.getContext('2d');
  g.translate(c.ih, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(img, 0, 0);
  Object.assign(c, { src: canvas.toDataURL('image/jpeg', 0.9), iw: canvas.width, ih: canvas.height, zoom: 1, cx: 0.5, cy: 0.5 });
  render();
}

// Places the photo under the frame from state.photoCrop (no re-render).
function layoutCrop() {
  const c = state.photoCrop;
  const stage = document.querySelector('.crop-stage');
  const img = stage?.querySelector('.crop-img');
  if (!c || !img) return;
  const r = cropRect(c);
  const k = stage.clientWidth / r.sw;
  Object.assign(img.style, { width: `${c.iw * k}px`, height: `${c.ih * k}px`, left: `${-r.sx * k}px`, top: `${-r.sy * k}px` });
  // Keep the centre inside the image, as the frame shows it.
  c.cx = (r.sx + r.sw / 2) / c.iw;
  c.cy = (r.sy + r.sh / 2) / c.ih;
}

// The cropped photo, at most 720 px wide, saved on the instrument. A new
// photo moves everything, so marked holes are cleared.
function finishCrop() {
  const c = state.photoCrop;
  const inst = c && getInstrument(c.id);
  const img = document.querySelector('.crop-img');
  if (!inst || !img) { state.photoCrop = null; render(); return; }
  const r = cropRect(c);
  const w = Math.round(Math.min(720, r.sw)), h = Math.round(w / c.ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  if (inst.photo) delete inst.holeMap;
  inst.photo = { src: canvas.toDataURL('image/jpeg', 0.78), aspect: c.ratio };
  saveInstrument(inst);
  refreshInstruments();
  state.photoCrop = null;
  render();
}

// Dragging, pinching and wheel-zooming the photo under the crop frame.
const _cropPointers = new Map();
let _cropPinch = null;
document.addEventListener('pointerdown', e => {
  const stage = e.target.closest?.('.crop-stage');
  if (!stage || !state.photoCrop) return;
  e.preventDefault();
  stage.setPointerCapture?.(e.pointerId);
  _cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_cropPointers.size === 2) {
    const [a, b] = [..._cropPointers.values()];
    _cropPinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.photoCrop.zoom };
  }
});
document.addEventListener('pointermove', e => {
  const c = state.photoCrop;
  const prev = _cropPointers.get(e.pointerId);
  if (!c || !prev) return;
  _cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const stage = document.querySelector('.crop-stage');
  if (!stage) return;
  if (_cropPointers.size === 2 && _cropPinch) {
    const [a, b] = [..._cropPointers.values()];
    c.zoom = Math.min(4, Math.max(1, _cropPinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / (_cropPinch.d || 1)));
  } else {
    const k = stage.clientWidth / cropRect(c).sw;   // screen px per image px
    c.cx -= (e.clientX - prev.x) / k / c.iw;
    c.cy -= (e.clientY - prev.y) / k / c.ih;
  }
  layoutCrop();
  const zoom = document.querySelector('.crop-zoom');
  if (zoom) zoom.value = c.zoom;
});
const cropPointerEnd = e => { _cropPointers.delete(e.pointerId); if (_cropPointers.size < 2) _cropPinch = null; };
document.addEventListener('pointerup', cropPointerEnd);
document.addEventListener('pointercancel', cropPointerEnd);
document.addEventListener('wheel', e => {
  if (!state.photoCrop || !e.target.closest?.('.crop-stage')) return;
  e.preventDefault();
  state.photoCrop.zoom = Math.min(4, Math.max(1, state.photoCrop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  layoutCrop();
  const zoom = document.querySelector('.crop-zoom');
  if (zoom) zoom.value = state.photoCrop.zoom;
}, { passive: false });

// Name, photo and (for one you set up yourself) the number of holes. In
// the Edit instrument sheet, or at the top of Set up for a bought ocarina
// or flute: one place for everything about it.
function instFieldsHtml(inst) {
  const custom = inst.kind === 'custom' && !usesLayout(inst); // a custom handpan's notes are set on its own tab
  const flute = isTubeFamily(inst.family);
  const n = inst.holeCount ?? 0;
  const id = escHtml(inst.id);
  return `
      ${uiField({ label: 'Name', id: `ie-name-${id}`, control: `<input class="input" id="ie-name-${id}" data-action="ie-name" data-id="${id}" value="${escHtml(inst.name)}" autocomplete="off">` })}
      <div class="field">
        <span class="field-label">Photo</span>
        <div class="ie-photo">
          ${inst.photo?.src ? `<img class="ie-photo-img" src="${inst.photo.src}" alt="Photo of ${escHtml(inst.name)}">`
            : `<span class="ie-photo-empty">${icon(FAMILY_ICONS[inst.family] ?? 'music')}</span>`}
          <div class="ie-photo-actions">
            <label class="btn btn-secondary btn-sm">${icon('camera')} ${inst.photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" class="sr-only" data-action="ie-photo" data-id="${id}"></label>
            ${inst.photo ? `<button type="button" class="btn btn-ghost btn-sm" data-action="ie-photo-remove" data-id="${id}">Remove</button>` : ''}
          </div>
        </div>
        <div class="field-help">Shown next to its name${inst.family === 'ocarina' && custom ? ', and used to mark where the holes are' : ''}. A photo of the top works best.</div>
      </div>
      ${instKeyFieldHtml(inst)}
      ${custom ? uiField({
        label: flute ? 'Finger holes' : 'Holes, thumb holes included', id: 'ie-holes',
        control: uiStepper({ value: n, label: 'Holes', action: 'ie-holes-step', data: { id: inst.id }, min: n <= (flute ? 3 : 1), max: n >= (flute ? 8 : 13) }),
        help: inst.chambers?.length || inst.setup ? 'Changing this clears the fingering chart; set it up again with the new holes.' : '',
      }) : ''}`;
}

// Key of an instrument made from a published chart, when the chart has
// more than one: changing it moves every note (the fingerings stay).
function instKeyFieldHtml(inst) {
  if (inst.kind !== 'traditional') return '';
  const chart = getChart(inst.type);
  if (!chart || chart.keys.length < 2) return '';
  const key = chart.keys.find(k => k.id === inst.key) ?? chart.keys[0];
  return uiField({
    label: 'Key', id: `ie-key-${escHtml(inst.id)}`,
    control: uiPicker({
      id: `ie-key-${inst.id}`, value: key.id, label: 'Key', action: 'ie-key', data: { id: inst.id },
      options: chart.keys.map(k => ({
        value: k.id, label: chart.octaves ? ocKeyLabel(k) : k.name, group: chart.octaves ? ocKeyOctaveName(k) : undefined,
        keywords: [...(k.root ? noteSearchWords(k.root) : []), ...noteSearchWords(k.lowest)],
      })),
    }),
    help: 'All holes closed sounds the lowest note. Changing the key moves every note; the fingerings stay the same.',
  });
}

// The Edit instrument sheet: ocarinas and flutes without a Set up tab
// (from a published chart, or designed here). Name and photo.
function instEditSheet() {
  const inst = getInstrument(state.instEdit);
  if (!inst) return '';
  return uiSheet({
    key: 'inst-edit', title: 'Edit instrument', close: 'inst-edit-close',
    body: instFieldsHtml(inst),
    footer: '<button type="button" class="btn btn-primary" data-action="inst-edit-close">Done</button>',
  });
}

// Where the holes are: the photo with the marked holes, and Mark / Edit.
function holeMapCardHtml(inst) {
  const holes = setupOf(inst).holes;
  const mapped = holes.filter((h, i) => h.side !== 'bottom' && inst.holeMap?.[i]).length;
  const tops = holes.filter(h => h.side !== 'bottom').length;
  return `
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Where the holes are</h3>
              <p class="b-meta">${inst.photo ? '' : 'No photo yet · '}${mapped} of ${tops} marked</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="hm-open">${icon('pencil')} ${mapped ? 'Edit' : 'Mark'}</button>
          </div>
          ${inst.photo || mapped ? `<button type="button" class="hm-preview" data-action="hm-open" aria-label="Edit where the holes are">${holeMapSvg(inst, { fingers: true })}</button>`
            : '<p class="b-meta">Add a photo of the top of your ocarina, then tap where each hole is. The fingering pictures then show your own ocarina.</p>'}
        </div>`;
}

// Set up of an ocarina or flute from a published chart: name, photo, key,
// where the holes are (ocarinas), which finger covers each hole, and the
// notes whose fingering you changed. No readings: the chart gives the notes.
function viewChartSetup(inst) {
  const setup = setupOf(inst);
  const chart = getChart(inst.type);
  const fixed = Object.keys(inst.setup?.fixed ?? {}).map(Number).sort((a, b) => a - b);
  const uf = state.useFlats, us = state.useSolfege;
  return `${instrumentAppBar(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Your ${windWord(inst)} plays from ${escHtml(chart?.sourceName ? `the ${chart.sourceName} chart` : 'a published chart')}. Make it yours: its name and photo, ${inst.family === 'ocarina' ? 'where its holes are, ' : ''}and which finger covers each hole.</p>
        ${instSetupCardHtml(inst)}
        ${inst.family === 'ocarina' ? holeMapCardHtml(inst) : ''}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${setup.holes.length} holes${isTubeFamily(inst.family) ? ', from the mouthpiece down' : ''}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${setup.holes.map(h => escHtml(h.finger) + (h.sub ? '·sub' : '')).join(' ')}</p>
        </div>
        <div class="card b-card">
          <h3 class="b-card-title">Your fingerings</h3>
          <p class="b-meta">${fixed.length
            ? `Played your way: ${fixed.map(m => escHtml(displayNote(midiToNoteName(m), uf, us))).join(', ')}. The chart's fingering is a tap away on each note.`
            : 'None yet. On Notes, pick a note and tap "Not how you play it?" to set the fingering you use.'}</p>
        </div>
      </div>
    </div>`;
}

// The card at the top of Set up.
function instSetupCardHtml(inst) {
  const word = usesLayout(inst) ? layoutFamilyInfo(inst.family).word : windWord(inst);
  return `
        <div class="card b-card ie-card">
          <h3 class="b-card-title">Your ${word}</h3>
          ${instFieldsHtml(inst)}
        </div>`;
}

const HM_W = 1000;

// The instrument's photo (or a plain body when there's none) with its
// marked holes. opts: sel (hole being placed, editor), highlight (one hole
// drawn open, the reading list), fingers (label the spots), mini.
function holeMapSvg(inst, { sel = null, highlight = null, fingers = false, mini = false } = {}) {
  const aspect = inst.photo?.aspect ?? 1.6;
  const H = Math.round(HM_W / aspect);
  const holes = setupOf(inst).holes;
  const r = mini ? 70 : 34;
  const spots = holes.map((h, i) => ({ h, i, s: holeSpot(inst, i) })).filter(x => x.s);
  const under = holes.map((h, i) => ({ h, i })).filter(x => x.h.side === 'bottom');
  const bg = inst.photo?.src
    ? `<image href="${inst.photo.src}" x="0" y="0" width="${HM_W}" height="${H}"/>`
    : `<rect class="hm-blank" x="0" y="0" width="${HM_W}" height="${H}" rx="40"/>`;
  const marks = spots.map(({ h, i, s }) => {
    const cls = ['hm-spot', i === sel ? 'is-sel' : '', highlight != null ? (i === highlight ? 'is-open' : 'is-closed') : ''].join(' ');
    const text = mini ? '' : `<text class="hm-num" x="${s.x * HM_W}" y="${s.y * H}">${fingers ? escHtml(h.finger) : i + 1}</text>`;
    return `<g class="${cls}"><circle cx="${s.x * HM_W}" cy="${s.y * H}" r="${r}"/>${text}</g>`;
  }).join('');
  const underText = !mini && under.length
    ? `<text class="hm-under" x="24" y="${H - 24}">Underneath: ${under.map(u => escHtml(u.h.finger)).join(', ')}</text>` : '';
  return `<svg class="hm-svg${mini ? ' is-mini' : ''}" viewBox="0 0 ${HM_W} ${H}" preserveAspectRatio="xMidYMid meet">${bg}${marks}${underText}</svg>`;
}

// Marking the holes: pick a hole in the list, tap where it is on the photo;
// the next unmarked hole is picked by itself.
function viewHoleMap(inst) {
  const setup = setupOf(inst);
  const sel = state.oc.holeMap.sel;
  const chips = holeDisplayOrder(setup.holes).map(i => {
    const h = setup.holes[i];
    const under = h.side === 'bottom';
    const done = under || inst.holeMap?.[i];
    return `<button type="button" class="chip hm-chip${i === sel ? ' is-selected' : ''}" data-action="hm-select" data-index="${i}" ${under ? 'disabled' : ''}
      aria-pressed="${i === sel ? 'true' : 'false'}">${escHtml(holeLabel(setup.holes, i))}${under ? ' · under' : done ? ` ${icon('check')}` : ''}</button>`;
  }).join('');
  const selHole = sel != null ? setup.holes[sel] : null;
  return `${instrumentAppBar(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Where the holes are</h2>
        <p class="b-intro">${selHole ? `Tap where the ${escHtml(holeLabel(setup.holes, sel))} hole is.` : 'Every hole is marked. Tap a hole below to move it.'}</p>
        ${inst.photo ? '' : `<p class="b-meta">No photo yet: <button type="button" class="btn-link" data-action="inst-edit-open" data-id="${escHtml(inst.id)}">add one</button>, or mark the holes on the plain shape.</p>`}
        <div class="hm-stage" data-action="hm-place">${holeMapSvg(inst, { sel, fingers: true })}</div>
        <div class="chips hm-chips">${chips}</div>
        ${selHole ? uiField({
          label: 'Finger on this hole', id: `s-finger-${sel}`,
          control: `<select class="select" id="s-finger-${sel}" data-action="s-finger" data-index="${sel}">
            ${OC_FINGER_ORDER.map(f => `<option value="${f}" ${selHole.finger === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>`,
          help: 'A thumb (LT, RT) puts the hole underneath.',
        }) : ''}
        <p class="b-meta">Thumb holes underneath don't need a spot. Not sure which finger is which? See the ⋯ menu.</p>
        <div class="b-actions">
          ${selHole && inst.holeMap?.[sel] ? '<button type="button" class="btn btn-ghost" data-action="hm-clear">Clear this spot</button>' : ''}
          <button type="button" class="btn btn-primary b-next" data-action="hm-close">Done</button>
        </div>
      </div>
    </div>`;
}

function hmFirstUnmarked(inst) {
  const holes = setupOf(inst).holes;
  const i = holeDisplayOrder(holes).find(k => holes[k].side !== 'bottom' && !inst.holeMap?.[k]);
  return i ?? null;
}

// ── Changing a note's fingering by hand (bought ocarinas) ────────────────────

function fgEditable(inst) {
  if (inst.id === SHARED_ID || inst.chambers?.length !== 1) return false;
  return inst.kind === 'traditional' || (inst.kind === 'custom' && inst.family === 'ocarina');
}

// The selected note's fingering while it's being changed: tap a hole to go
// covered → open → half; the calibration says roughly what it would sound.
function fgEditStageHtml(inst, opts) {
  const ed = state.oc.fgEdit;
  const ch = inst.chambers[0];
  const tmp = { ...inst, chambers: [{ ...ch, fingerings: { ...ch.fingerings, [ed.midi]: ed.states } }] };
  const uf = state.useFlats, us = state.useSolfege;
  const cal = inst.calibration;
  let guess = '';
  if (cal?.f0 > 0 && cal.ratios?.length === ed.states.length) {
    const hz = predictFingeringHz(cal.f0, cal.ratios, ed.states);
    const p = pitchLabel(hz, { useFlats: uf, useSolfege: us });
    guess = `From your readings this fingering should sound about ${escHtml(p.text)}.`;
  }
  const fixed = inst.setup?.fixed?.[ed.midi];
  return `
    <div class="fg-stage is-editing">
      ${renderFingering(tmp, ed.midi, { ...opts, size: 'large', showFingers: true, editable: true })}
      <p class="fg-edit-help">Tap a hole: covered → open → half. Blow it with the tuner on to check.</p>
      ${guess ? `<p class="fg-edit-help">${guess}</p>` : ''}
      ${inst.kind !== 'custom' ? '' : `<div class="fg-edit-rec">
        <div class="field-label">What it really sounds (optional)</div>
        ${uiHzField('e:hz', ed.hz ?? null, { label: 'What this fingering sounds in Hz' })}
        <p class="fg-edit-help">Tap ${icon('mic')}<span class="sr-only">the microphone</span> and blow this fingering: the reading is added to your set-up readings, so the other notes are worked out better too.</p>
      </div>`}
      <div class="fg-edit-actions">
        ${fixed ? `<button type="button" class="btn btn-ghost btn-sm" data-action="fg-edit-reset">${inst.kind === 'traditional' ? 'Use the chart\'s one' : 'Use the worked-out one'}</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-action="fg-edit-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="fg-edit-save">Save for ${escHtml(displayNote(midiToNoteName(ed.hz > 0 ? Math.round(hzToMidi(ed.hz)) : ed.midi), uf, us))}</button>
      </div>
    </div>`;
}

// "R1 ↔ R4, R2 ↔ R3" for the fingers this hand uses.
function handSwapText(holes, hand) {
  const before = holes.map(h => h.finger);
  const after = reverseHandFingers(holes, hand).map(h => h.finger);
  const pairs = new Set();
  before.forEach((f, i) => { if (f !== after[i]) pairs.add([f, after[i]].sort().join(' ↔ ')); });
  return [...pairs].join(', ');
}

function setupFingersSheet() {
  const inst = currentInstrument();
  if (!inst || (inst.kind !== 'custom' && inst.kind !== 'traditional')) return '';
  const setup = holesSetupOf(inst);
  return uiSheet({
    key: 's-fingers', title: 'Hole fingers', close: 's-fingers-close',
    body: `
      <p class="sheet-text">Check which finger covers each hole. ${isTubeFamily(inst.family) ? 'Holes count from the mouthpiece down: hole 1 is nearest your mouth.' : 'Holes are listed by finger, right hand first.'}</p>
      ${(() => {
        const dup = duplicateFingers(setup.holes);
        return dup.length ? `<p class="s-warn is-warning">${icon('hand')} More than one hole is on ${dup.join(', ')}. Each finger usually covers one hole: check the fingers below.</p>` : '';
      })()}
      ${inst.kind === 'custom' && inst.family === 'ocarina' ? `
        <button type="button" class="btn btn-secondary btn-sm s-reverse" data-action="s-fingers-reset">${icon('rotate')} Back to the first guess for ${setup.holes.length} holes</button>` : ''}
      ${inst.kind === 'custom' && inst.family === 'ocarina' && setup.holes.filter(h => h.sub).length === 2 ? `
        <div class="field s-subs">
          <span class="field-label">Sub-holes</span>
          ${uiSeg([{ value: 'taiwanese', label: 'Beside R2 and L2' }, { value: 'japanese', label: 'Beside R1 and R2' }],
            setup.holes.filter(h => h.sub).map(h => h.finger).sort().join() === [...SUB_LAYOUTS.japanese].sort().join() ? 'japanese' : 'taiwanese',
            { action: 's-sub-layout', label: 'Sub-hole layout' })}
          <div class="field-help">Beside each middle finger is the Taiwanese layout; both on the right hand is the Japanese one. Pick the one your ocarina has.</div>
        </div>` : ''}
      ${['R', 'L'].filter(hand => handSwapText(setup.holes, hand)).map(hand => `
        <button type="button" class="btn btn-secondary btn-sm s-reverse" data-action="s-fingers-reverse" data-hand="${hand}">
          ${icon('refresh')} Reverse ${hand === 'R' ? 'right' : 'left'} hand (${handSwapText(setup.holes, hand)})</button>`).join('')}
      <div class="s-fingers">
        ${(isTubeFamily(inst.family) ? setup.holes.map((_, i) => i) : holeDisplayOrder(setup.holes)).map((i, n) => {
          const h = setup.holes[i];
          const where = !isTubeFamily(inst.family) && holeSpot(inst, i)
            ? `<span class="s-finger-map" aria-hidden="true">${holeMapSvg(inst, { highlight: i, mini: true })}</span>` : '';
          return `<div class="s-finger-row">${where}${uiField({
            label: `Hole ${n + 1}${h.sub ? ' (sub-hole)' : ''}`, id: `s-finger-${i}`,
            control: `<select class="select" id="s-finger-${i}" data-action="s-finger" data-index="${i}">
              ${OC_FINGER_ORDER.map(f => `<option value="${f}" ${h.finger === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>`,
          })}</div>`;
        }).join('')}
      </div>`,
    footer: '<button type="button" class="btn btn-primary" data-action="s-fingers-close">Done</button>',
  });
}

// Writes a reading into an instrument. Paths: "ci:stage:f0|d|f1",
// "ci:stage:n:<midi>", "s:f0", "s:<holeIndex>".
function setReading(inst, path, value) {
  const parts = path.split(':');
  if (parts[0] === 'f') {
    const setup = fluteSetupOf(inst);
    setup.readings[parseInt(parts[1], 10)] = value;
    inst.setup = setup;
    return;
  }
  if (parts[0] === 'e') {
    if (state.oc.fgEdit) state.oc.fgEdit.hz = value;
    return;
  }
  if (parts[0] === 's') {
    const setup = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
    if (parts[1] === 'f0') setup.f0 = value; else setup.singles[parseInt(parts[1], 10)] = value;
    inst.setup = setup;
    return;
  }
  const ci = parseInt(parts[0], 10);
  const stage = parts[1];
  const per = inst.build.perChamber;
  per[ci] = per[ci] ?? {};
  per[ci].readings = per[ci].readings ?? {};
  const r = per[ci].readings[stage] = per[ci].readings[stage] ?? {};
  if (parts[2] === 'n') {
    r.notes = r.notes ?? {};
    r.notes[parts[3]] = value;
  } else {
    r[parts[2]] = value;
    // The closed pitch is also the reading of the chamber's lowest note.
    if (parts[2] === 'f0') { r.notes = r.notes ?? {}; r.notes[inst.chambers[ci].notes[0]] = value; }
  }
}

// Fill big gaps: at most this many holes a chamber (8 fingers + 2 thumbs).
const DESIGN_MAX_HOLES = 10;

function applyDesign(inst) {
  const plan = planOcarina(inst.design);
  inst.scaleId = plan.scale.id;
  inst.transpose = inst.design.transpose ?? 0;
  inst.includeGu = inst.design.includeGu ?? true;
  // Sub-holes add notes below the scale, from its key (the full scale's
  // pitch classes, transposed).
  const pcs = new Set(scaleToMidis(plan.scale, { transpose: inst.transpose, includeGu: true }).map(m => ((m % 12) + 12) % 12));
  inst.chambers = buildScaleChambers(plan.notes, {
    subs: inst.design.subHoles ?? 0, layout: inst.design.subLayout ?? 'taiwanese', pcs,
    fill: inst.design.fillGaps ? DESIGN_MAX_HOLES : 0,
  });
  inst.notes = [...new Set(inst.chambers.flatMap(ch => ch.notes))].sort((a, b) => a - b);
  inst.fullChambers = plan.needed;
}

function finishInstrumentBuild(inst) {
  const { inst: done, learned } = finishBuild(inst);
  if (learned != null && done.build.clayBody) {
    saveClayBodies(getClayBodies().map(c => (c.id === done.build.clayBody ? updateClayBody(c, learned) : c)));
  }
  return done;
}

// ── Change: Edit instrument ───────────────────────────────────────────────
registerActions({
  'ie-key': (el, e, action) => {
    const inst = getInstrument(el.dataset.id);
    if (!inst || inst.kind !== 'traditional') return;
    const before = instrumentFromChart(inst.type, inst.key);
    const fresh = instrumentFromChart(inst.type, el.value);
    // A name the app made ("… (D4)") follows the key; one the owner typed stays.
    if (inst.name === before.name) inst.name = fresh.name;
    inst.key = fresh.key;
    // Finger names the owner set stay with their holes; fingerings set by
    // hand move with the key.
    const shift = fresh.chambers[0].notes[0] - before.chambers[0].notes[0];
    const holes = fresh.chambers[0].holes.map((h, i) => (inst.setup?.holes?.[i] ? { ...h, finger: inst.setup.holes[i].finger, side: inst.setup.holes[i].side } : h));
    if (inst.setup?.fixed) {
      inst.setup.fixed = Object.fromEntries(Object.entries(inst.setup.fixed).map(([m, st]) => [Number(m) + shift, st]));
    }
    inst.chambers = [withFixedFingerings({ ...fresh.chambers[0], holes }, inst.setup?.fixed)];
    saveInstrument(inst);
    refreshInstruments();
    state.oc.selected = null;
    render();
    return;
  },
  'ie-name, ie-photo': (el, e, action) => {
    const inst = getInstrument(el.dataset.id || state.instEdit);
    if (!inst) return;
    if (action === 'ie-name') {
      inst.name = el.value.trim() || inst.name;
      // A handpan, tongue drum or kalimba takes its name from its saved
      // layout (instruments.js reconcileInstruments), so rename that too.
      if (usesLayout(inst)) renameSavedLayout(inst.layoutId, inst.name);
      saveInstrument(inst);
      refreshInstruments();
      render();
      return;
    }
    const file = el.files?.[0];
    if (!file) return;
    readImageFile(file).then(img => {
      state.photoCrop = { id: inst.id, ...img, ratio: photoRatio(inst), zoom: 1, cx: 0.5, cy: 0.5 };
      render();
    }).catch(() => showToast('That photo couldn\'t be read'));
    return;
  },
}, CHANGE_ACTIONS);
