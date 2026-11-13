// My instruments: the saved instruments a user plays (handpans, ocarinas,
// later flutes). See docs/ocarina-mode.md, "Instruments first".
//
// Stored in localStorage under hp-instruments (soft deletes, like layouts).
// Not synced to Supabase yet (phase 7).
//
// Handpan instruments mirror the saved layouts in hp-layouts one to one
// (id 'hp-' + layoutId). The layouts stay where they are and keep syncing
// as before; reconcileInstruments() adds or removes the matching handpan
// instruments, so existing users get one instrument per saved layout and
// nothing about layouts or playlists changes.

import { NOTE_NAMES, SCALES } from './data.js';
import { scaleToMidis, buildScaleChambers, chambersNeeded } from './ocarina.js';

const INSTRUMENTS_KEY = 'hp-instruments';
const ONBOARDED_KEY = 'hp-onboarded';

export const INSTRUMENT_FAMILIES = [
  { id: 'handpan', name: 'Handpan' },
  { id: 'ocarina', name: 'Ocarina' },
  { id: 'flute', name: 'Flute' }, // offered when js/charts.js has a sourced flute chart
];

export const BUILD_STAGES = [
  { id: 'design', name: 'Design' },
  { id: 'body', name: 'Body' },
  { id: 'leather', name: 'Voice and drill' },
  { id: 'boneDry', name: 'Drying' },
  { id: 'bisque', name: 'Bisque check' },
  { id: 'final', name: 'Final check' },
  { id: 'done', name: 'Done' },
];

// ── Pure helpers ─────────────────────────────────────────────────────────────

// 62 → 'D4' (flat-preferring spelling from data.js; displayNote re-spells it).
export function midiToNoteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

function nowIso() { return new Date().toISOString(); }

export function handpanInstrumentId(layoutId) { return 'hp-' + layoutId; }

// Adds a handpan instrument for every saved layout that has none, keeps names
// in step, and soft-deletes handpan instruments whose layout is gone.
// Pure: returns { instruments, changed }.
export function reconcileInstruments(instruments, savedLayouts, now = nowIso()) {
  const list = instruments.map(i => ({ ...i }));
  let changed = false;
  const live = new Set();
  for (const saved of savedLayouts) {
    const id = handpanInstrumentId(saved.id);
    live.add(id);
    const existing = list.find(i => i.id === id);
    if (!existing) {
      list.push({
        id,
        family: 'handpan',
        kind: saved.layout?.isCustom ? 'custom' : 'scale',
        layoutId: saved.id,
        name: saved.name,
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: saved.savedAt ? new Date(saved.savedAt).toISOString() : null,
      });
      changed = true;
    } else if (existing.deletedAt || existing.name !== saved.name) {
      delete existing.deletedAt;
      existing.name = saved.name;
      existing.updatedAt = now;
      changed = true;
    }
  }
  for (const inst of list) {
    if (inst.family === 'handpan' && !inst.deletedAt && !live.has(inst.id)) {
      inst.deletedAt = now;
      inst.updatedAt = now;
      changed = true;
    }
  }
  return { instruments: list, changed };
}

// Most recently played first; never-played ones by creation, newest first.
export function sortInstruments(instruments) {
  const key = i => i.lastPlayedAt || i.createdAt || '';
  return [...instruments].sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
}

// A scale-built ocarina from a handpan scale. `notes` (MIDI) is the chosen
// subset when building fewer chambers than the full scale needs; defaults to
// every note.
export function createScaleOcarina({ scaleId, transpose = 0, includeGu = true, notes = null, name }, now = nowIso()) {
  const scale = SCALES.find(s => s.id === scaleId);
  if (!scale) throw new RangeError(`Unknown scale: ${scaleId}`);
  const all = scaleToMidis(scale, { transpose, includeGu });
  const chosen = (notes ?? all).filter(m => all.includes(m)).sort((a, b) => a - b);
  return {
    id: 'oc-' + Math.random().toString(36).slice(2, 10),
    family: 'ocarina',
    kind: 'scale',
    name: name || `${scale.name} ocarina`,
    scaleId,
    transpose,
    includeGu,
    notes: chosen,
    fullChambers: chambersNeeded(all),
    chambers: buildScaleChambers(chosen),
    build: { stage: 'design', clayBody: null, shrinkPct: 11, a4: 440, perChamber: [] },
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}

// An ocarina the user owns whose fingering chart is unknown. It is set up
// later by calibration with the tuner (docs/ocarina-mode.md, "Calibrated
// charts"); until then it only has a name and a hole count.
export function createCustomOcarina({ name, holeCount }, now = nowIso()) {
  return {
    id: 'oc-' + Math.random().toString(36).slice(2, 10),
    family: 'ocarina',
    kind: 'custom',
    name: name || 'My ocarina',
    holeCount,
    chambers: [],
    calibration: null,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}

// A flute that isn't in js/charts.js. Its chart comes from recording its
// notes on Set up: all holes closed, then the holes lifted one by one from
// the bottom (fluteChamberFromReadings in js/builder.js).
export function createCustomFlute({ name, holeCount }, now = nowIso()) {
  return {
    id: 'fl-' + Math.random().toString(36).slice(2, 10),
    family: 'flute',
    kind: 'custom',
    name: name || 'My flute',
    holeCount,
    chambers: [],
    calibration: null,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}

// One line under the instrument's name on its card.
export function instrumentStatus(inst) {
  if (inst.family === 'handpan') return inst.kind === 'custom' ? 'Custom handpan' : 'Handpan';
  if (inst.kind === 'traditional') {
    const notes = inst.chambers?.[0]?.notes ?? [];
    return notes.length ? `${notes.length} notes, ${midiToNoteName(notes[0])} to ${midiToNoteName(notes[notes.length - 1])}` : '';
  }
  if (inst.kind === 'custom') {
    if (!inst.calibration) return `${inst.holeCount} holes · not set up yet`;
    const notes = inst.chambers?.[0]?.notes ?? [];
    return inst.family === 'flute' && notes.length
      ? `${inst.holeCount} holes · ${notes.length} notes, ${midiToNoteName(notes[0])} to ${midiToNoteName(notes[notes.length - 1])}`
      : `${inst.holeCount} holes`;
  }
  if (inst.kind === 'scale') {
    const stage = inst.build?.stage ?? 'done';
    const chambers = inst.chambers.length;
    const size = `${inst.notes.length} notes · ${chambers} chamber${chambers !== 1 ? 's' : ''}`;
    if (stage === 'done') return size;
    const idx = BUILD_STAGES.findIndex(s => s.id === stage);
    return `${BUILD_STAGES[idx].name}, step ${idx + 1} of ${BUILD_STAGES.length} · ${size}`;
  }
  return '';
}

// ── Storage ──────────────────────────────────────────────────────────────────

function getAllInstrumentsRaw() {
  try { return JSON.parse(localStorage.getItem(INSTRUMENTS_KEY) || '[]'); }
  catch { return []; }
}

function writeInstruments(list) {
  localStorage.setItem(INSTRUMENTS_KEY, JSON.stringify(list));
  // Lets the app schedule a cloud sync without every caller remembering to.
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hp-instruments-changed'));
}

// Raw list including soft deletes, for sync.
export function getInstrumentsRaw() { return getAllInstrumentsRaw(); }
export function writeInstrumentsRaw(list) { writeInstruments(list); }

export function getInstruments() {
  return sortInstruments(getAllInstrumentsRaw().filter(i => !i.deletedAt));
}

export function getInstrument(id) {
  return getAllInstrumentsRaw().find(i => i.id === id && !i.deletedAt) || null;
}

export function saveInstrument(inst) {
  const all = getAllInstrumentsRaw();
  const idx = all.findIndex(i => i.id === inst.id);
  const stamped = { ...inst, updatedAt: nowIso() };
  if (idx >= 0) all[idx] = stamped; else all.push(stamped);
  writeInstruments(all);
}

export function deleteInstrument(id) {
  const all = getAllInstrumentsRaw();
  const inst = all.find(i => i.id === id);
  if (inst) { inst.deletedAt = inst.updatedAt = nowIso(); writeInstruments(all); }
}

// Marks an instrument as just played (orders My instruments). Doesn't touch
// updatedAt, so it never wins a sync merge on its own.
export function touchInstrument(id) {
  const all = getAllInstrumentsRaw();
  const inst = all.find(i => i.id === id);
  if (inst) { inst.lastPlayedAt = nowIso(); writeInstruments(all); }
}

// Brings handpan instruments in step with the saved layouts.
export function syncHandpanInstruments(savedLayouts) {
  const { instruments, changed } = reconcileInstruments(getAllInstrumentsRaw(), savedLayouts);
  if (changed) writeInstruments(instruments);
}

export function isOnboarded() { return localStorage.getItem(ONBOARDED_KEY) === '1'; }
export function setOnboarded() { localStorage.setItem(ONBOARDED_KEY, '1'); }

// ── Clay bodies ──────────────────────────────────────────────────────────────
// The named list of clays a user builds with, each carrying the shrinkage
// learned from finished builds. Local only for now.

const CLAY_KEY = 'hp-clay-bodies';

export function getClayBodies() {
  try {
    const list = JSON.parse(localStorage.getItem(CLAY_KEY) || 'null');
    if (Array.isArray(list) && list.length) return list;
  } catch { /* fall through */ }
  return [{ id: 'generic', name: 'Generic clay', shrinkPct: 11, builds: 0 }];
}

export function saveClayBodies(list) {
  localStorage.setItem(CLAY_KEY, JSON.stringify(list));
}

// ── Sharing and sync ─────────────────────────────────────────────────────────

// 6-character public ID without look-alike characters (no 0/O, 1/I/L).
const PUBLIC_ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newPublicId(random = Math.random) {
  let id = '';
  for (let i = 0; i < 6; i++) id += PUBLIC_ID_CHARS[Math.floor(random() * PUBLIC_ID_CHARS.length)];
  return id;
}

// Instruments that sync through the instruments table: everything except
// handpans, which are rebuilt from the saved layouts (synced already).
export function syncableInstruments(list) {
  return list.filter(i => i.family !== 'handpan');
}

// Two-way merge of local instruments with cloud rows ({ id, data,
// updated_at, deleted_at }): newest updatedAt wins per instrument, deletes
// included. Pure. Returns { local, toPush, changed } where toPush lists the
// local instruments the cloud lacks or has older.
export function mergeInstruments(localList, rows) {
  const local = localList.map(i => ({ ...i }));
  let changed = false;
  const cloudById = new Map(rows.map(r => [r.id, r]));
  for (const row of rows) {
    const remote = { ...row.data, deletedAt: row.deleted_at ?? row.data?.deletedAt ?? undefined };
    if (!remote.deletedAt) delete remote.deletedAt;
    const idx = local.findIndex(i => i.id === row.id);
    if (idx < 0) { local.push(remote); changed = true; continue; }
    if ((remote.updatedAt || '') > (local[idx].updatedAt || '')) {
      local[idx] = { ...remote, lastPlayedAt: local[idx].lastPlayedAt ?? remote.lastPlayedAt };
      changed = true;
    }
  }
  const toPush = syncableInstruments(local).filter(i => {
    const row = cloudById.get(i.id);
    return !row || (i.updatedAt || '') > (row.data?.updatedAt || '');
  });
  return { local, toPush, changed };
}

// A shared instrument opened from a link or QR code, ready to add to My
// instruments: a fresh id, no public ID (that belongs to the owner's copy),
// no build readings.
export function copySharedInstrument(shared, now = nowIso()) {
  const { publicId, build, setup, deletedAt, ...rest } = shared;
  return {
    ...rest,
    id: (shared.family === 'handpan' ? 'hp-' : 'oc-') + Math.random().toString(36).slice(2, 10),
    copiedFrom: publicId ?? null,
    build: build ? { ...build, stage: 'done', perChamber: [] } : undefined,
    createdAt: now, updatedAt: now, lastPlayedAt: now,
  };
}
