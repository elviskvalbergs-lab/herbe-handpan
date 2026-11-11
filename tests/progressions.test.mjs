// Unit tests for progressions in js/storage.js. Run with: node --test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// A minimal localStorage for the storage functions.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};

const {
  PROG_DEFAULTS, newProgressionStep, normalizeProgression, progressionStepMs, progressionTotals,
  nextProgressionStep, mergeProgressionLists, getProgressions, getProgressionsRaw, addProgression,
  renameProgression, deleteProgression, setProgressionTiming, addStepToProgression,
  duplicateProgressionStep, moveProgressionStep, removeProgressionStep, setProgressionStepBars,
  getPlaylists,
} = await import('../js/storage.js');

const entry = (chordId, rootName, typeName, notes, extra = {}) => ({
  id: `D-Harmonic-Minor-10-${chordId}`, chordId, rootName, typeName, category: 'Minor',
  notes, noteCount: notes.length, layoutId: 'D-Harmonic-Minor-10', layoutData: null,
  scaleName: 'D Harmonic Minor (10)', ...extra,
});
const Am = entry('A-min', 'A', 'Minor', ['A3', 'C5', 'E4']);
const Dm = entry('D-min', 'D', 'Minor', ['D3', 'F4', 'A3']);
const Bbm = entry('Bb-min', 'Bb', 'Minor', ['Bb3', 'C#4', 'F4']);
const ocC = { id: 'oc:oc-1-C-maj', chordId: 'C-maj', rootName: 'C', typeName: 'Major', category: 'Major', notes: ['C4', 'E4', 'G4'], noteCount: 3, layoutId: 'oc:oc-1', layoutData: null, scaleName: 'Blue C', family: 'ocarina', instrumentId: 'oc-1' };

beforeEach(() => store.clear());

test('a step mirrors the playlist entry, without its id, with its own stepId and bars', () => {
  const s = newProgressionStep(Am, { stepId: 'st-1' });
  assert.equal(s.stepId, 'st-1');
  assert.equal(s.bars, 1);
  assert.equal('id' in s, false);
  for (const k of ['chordId', 'rootName', 'typeName', 'category', 'notes', 'noteCount', 'layoutId', 'layoutData', 'scaleName']) {
    assert.deepEqual(s[k], Am[k], k);
  }
  const o = newProgressionStep(ocC, { bars: 3 });
  assert.equal(o.instrumentId, 'oc-1');
  assert.equal(o.family, 'ocarina');
  assert.equal(o.bars, 3);
  assert.match(o.stepId, /^st-/);
  assert.equal(newProgressionStep(Am, { bars: 99 }).bars, 16);
  assert.equal(newProgressionStep(Am, { bars: 0 }).bars, 1);
});

test('defaults: 80 BPM, 4 beats per bar, 1 bar per step', () => {
  assert.deepEqual(PROG_DEFAULTS, { bpm: 80, beatsPerBar: 4, bars: 1 });
  const p = normalizeProgression({ id: 'x', name: 'X', steps: [{ stepId: 'a' }] });
  assert.equal(p.bpm, 80);
  assert.equal(p.beatsPerBar, 4);
  assert.equal(p.steps[0].bars, 1);
});

test('step length follows bpm × beats per bar × bars', () => {
  assert.equal(progressionStepMs(80, 4, 1), 3000);
  assert.equal(progressionStepMs(120, 4, 2), 4000);
  assert.equal(progressionStepMs(60, 3, 1), 3000);
  const p = { bpm: 120, beatsPerBar: 4, steps: [{ bars: 1 }, { bars: 2 }, { bars: 1, instrumentId: 'oc-1' }] };
  assert.deepEqual(progressionTotals(p), { steps: 3, bars: 4, ms: 8000 });
  assert.deepEqual(progressionTotals(p, s => !s.instrumentId), { steps: 2, bars: 3, ms: 6000 });
});

test('the next playable step wraps round and skips other instruments', () => {
  const steps = [{ h: 1 }, { h: 0 }, { h: 1 }, { h: 0 }];
  const here = s => s.h === 1;
  assert.equal(nextProgressionStep(steps, -1, here), 0);
  assert.equal(nextProgressionStep(steps, 0, here), 2);
  assert.equal(nextProgressionStep(steps, 2, here), 0);
  assert.equal(nextProgressionStep(steps, 1, () => false), -1);
  assert.equal(nextProgressionStep([], -1), -1);
});

test('Am – Dm – Am – Bbm: the same chord can come back, and each step stays its own', () => {
  const id = addProgression('Verse');
  assert.equal(addStepToProgression(id, Am), 1);
  assert.equal(addStepToProgression(id, Dm), 2);
  assert.equal(addStepToProgression(id, Am), 3);
  assert.equal(addStepToProgression(id, Bbm), 4);
  let p = getProgressions().find(x => x.id === id);
  assert.deepEqual(p.steps.map(s => s.chordId), ['A-min', 'D-min', 'A-min', 'Bb-min']);
  assert.equal(new Set(p.steps.map(s => s.stepId)).size, 4);
  assert.equal(p.bpm, 80);
  assert.equal(p.beatsPerBar, 4);

  // Removing the second Am leaves the first alone.
  const firstAm = p.steps[0].stepId;
  removeProgressionStep(id, 2);
  p = getProgressions().find(x => x.id === id);
  assert.deepEqual(p.steps.map(s => s.chordId), ['A-min', 'D-min', 'Bb-min']);
  assert.equal(p.steps[0].stepId, firstAm);

  // Duplicate puts a copy right after, with a new stepId and the same bars.
  setProgressionStepBars(id, 1, 2);
  duplicateProgressionStep(id, 1);
  p = getProgressions().find(x => x.id === id);
  assert.deepEqual(p.steps.map(s => [s.chordId, s.bars]), [['A-min', 1], ['D-min', 2], ['D-min', 2], ['Bb-min', 1]]);
  assert.notEqual(p.steps[1].stepId, p.steps[2].stepId);

  // Move up / down, refusing to fall off either end.
  moveProgressionStep(id, 3, 2);
  assert.deepEqual(getProgressions()[0].steps.map(s => s.chordId), ['A-min', 'D-min', 'Bb-min', 'D-min']);
  assert.equal(moveProgressionStep(id, 0, -1), false);
  assert.equal(moveProgressionStep(id, 3, 4), false);
});

test('timing, rename and soft delete stamp updatedAt', async () => {
  const id = addProgression('Chorus');
  const t0 = getProgressionsRaw()[0].updatedAt;
  await new Promise(r => setTimeout(r, 5));
  setProgressionTiming(id, { bpm: 300, beatsPerBar: 3 });
  let p = getProgressions()[0];
  assert.equal(p.bpm, 240);
  assert.equal(p.beatsPerBar, 3);
  assert.ok(p.updatedAt > t0);
  renameProgression(id, 'Bridge');
  assert.equal(getProgressions()[0].name, 'Bridge');
  deleteProgression(id);
  assert.equal(getProgressions().length, 0);
  const raw = getProgressionsRaw()[0];
  assert.ok(raw.deletedAt);
  assert.equal(raw.updatedAt, raw.deletedAt);
  assert.equal(addStepToProgression(id, Am), undefined);
});

test('progressions leave playlists alone', () => {
  const before = JSON.stringify(getPlaylists());
  const id = addProgression('Verse', [newProgressionStep(Am)]);
  addStepToProgression(id, Am);
  assert.equal(JSON.stringify(getPlaylists()), before);
  assert.equal(store.has('hp-progressions'), true);
});

test('merge keeps the newest version of each progression and says who needs what', () => {
  const a1 = { id: 'a', name: 'A', steps: [], updatedAt: '2026-11-01T00:00:00Z' };
  const a2 = { ...a1, name: 'A new', updatedAt: '2026-11-02T00:00:00Z' };
  const b = { id: 'b', name: 'B', steps: [], updatedAt: '2026-11-01T00:00:00Z' };
  const c = { id: 'c', name: 'C', steps: [], updatedAt: '2026-11-03T00:00:00Z', deletedAt: '2026-11-03T00:00:00Z' };

  let r = mergeProgressionLists([a1, b], [a2, c]);
  assert.deepEqual(r.merged.map(p => [p.id, p.name]).sort(), [['a', 'A new'], ['b', 'B'], ['c', 'C']]);
  assert.equal(r.changedLocal, true);
  assert.equal(r.needPush, true);

  r = mergeProgressionLists([a2], [a1]);
  assert.equal(r.changedLocal, false);
  assert.equal(r.needPush, true);

  r = mergeProgressionLists([a2, b], [b, a2]);
  assert.equal(r.changedLocal, false);
  assert.equal(r.needPush, false);

  r = mergeProgressionLists([], null ?? []);
  assert.deepEqual(r, { merged: [], changedLocal: false, needPush: false });
});
