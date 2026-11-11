// Unit tests for instrument sync and sharing helpers. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPublicId, mergeInstruments, syncableInstruments, copySharedInstrument } from '../js/instruments.js';

test('public IDs: 6 characters, no look-alikes', () => {
  for (let i = 0; i < 200; i++) assert.match(newPublicId(), /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(newPublicId(() => 0), 'AAAAAA');
});

test('merge: newest wins, deletes travel, handpans never pushed', () => {
  const local = [
    { id: 'oc-a', family: 'ocarina', name: 'A local', updatedAt: '2026-11-02' },
    { id: 'oc-b', family: 'ocarina', name: 'B local', updatedAt: '2026-11-05' },
    { id: 'oc-c', family: 'ocarina', name: 'C', updatedAt: '2026-11-01' },
    { id: 'hp-D-Kurd', family: 'handpan', name: 'D Kurd', updatedAt: '2026-11-09' },
  ];
  const rows = [
    { id: 'oc-a', data: { id: 'oc-a', family: 'ocarina', name: 'A cloud', updatedAt: '2026-11-03' }, deleted_at: null },
    { id: 'oc-b', data: { id: 'oc-b', family: 'ocarina', name: 'B cloud', updatedAt: '2026-11-04' }, deleted_at: null },
    { id: 'oc-c', data: { id: 'oc-c', family: 'ocarina', name: 'C', updatedAt: '2026-11-06', deletedAt: '2026-11-06' }, deleted_at: '2026-11-06' },
    { id: 'oc-d', data: { id: 'oc-d', family: 'ocarina', name: 'D new', updatedAt: '2026-11-07' }, deleted_at: null },
  ];
  const { local: merged, toPush, changed } = mergeInstruments(local, rows);
  assert.equal(changed, true);
  const by = id => merged.find(i => i.id === id);
  assert.equal(by('oc-a').name, 'A cloud');
  assert.equal(by('oc-b').name, 'B local');
  assert.equal(by('oc-c').deletedAt, '2026-11-06');
  assert.equal(by('oc-d').name, 'D new');
  assert.deepEqual(toPush.map(i => i.id), ['oc-b']);
  assert.deepEqual(syncableInstruments(merged).map(i => i.family), ['ocarina', 'ocarina', 'ocarina', 'ocarina']);
});

test('copying a shared instrument', () => {
  const shared = { id: 'oc-x', publicId: 'K7Q2XD', family: 'ocarina', kind: 'scale', name: 'Blue', chambers: [], build: { stage: 'done', perChamber: [{ readings: {} }] } };
  const copy = copySharedInstrument(shared, 'T');
  assert.notEqual(copy.id, 'oc-x');
  assert.equal(copy.publicId, undefined);
  assert.equal(copy.copiedFrom, 'K7Q2XD');
  assert.deepEqual(copy.build.perChamber, []);
  assert.equal(copy.name, 'Blue');
});
