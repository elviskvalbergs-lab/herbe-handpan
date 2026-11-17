// Sync by item: merge3, the outbox and two simulated devices against a fake
// server with save_item's rules (docs/free-to-play.md, Phase 4 step 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge3, pendingChanges, syncRound, syncKey } from '../js/sync.js';

const T = n => `2026-11-16T10:00:${String(n).padStart(2, '0')}.000Z`;

// ── A fake server: save_item's optimistic versions, pull by updated_at ──────
function fakeServer() {
  const rows = new Map();
  let clock = 0;
  const now = () => new Date(Date.UTC(2026, 10, 16, 12, 0, 0, ++clock)).toISOString();
  return {
    rows,
    online: true,
    api(deviceKind) {
      const srv = this;
      return {
        async pull(since) {
          if (!srv.online) throw new Error('offline');
          return [...rows.values()].filter(r => !since || r.updated_at > since).map(r => structuredClone(r));
        },
        async saveItem({ kind, id, data, baseVersion, deleted }) {
          if (!srv.online) return null;
          const key = syncKey(kind, id);
          const cur = rows.get(key);
          if (cur && cur.version !== baseVersion) return { ok: false, current: structuredClone(cur) };
          if (!cur && baseVersion) { /* row vanished: write it again */ }
          const ts = now();
          const row = { kind, id, data: structuredClone(data), version: (cur?.version ?? 0) + 1, updated_at: ts, deleted_at: deleted ? ts : null, device_kind: deviceKind };
          rows.set(key, row);
          return { ok: true, version: row.version, updated_at: ts };
        },
      };
    },
  };
}

// ── A device: local lists by kind, bases in memory ───────────────────────────
function device(server, kind = 'phone') {
  const lists = { playlist: [], progression: [], layout: [], instrument: [], prefs: [] };
  const baseMap = new Map();
  let meta = {};
  const local = {
    items() {
      const m = new Map();
      for (const [k, list] of Object.entries(lists)) for (const data of list) m.set(syncKey(k, data.id), { kind: k, id: data.id, data });
      return m;
    },
    write(k, id, data) {
      const list = lists[k];
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) list[i] = structuredClone(data); else list.push(structuredClone(data));
    },
    add(k, data) { lists[k].push(structuredClone(data)); },
  };
  const bases = {
    async getAll() { return new Map([...baseMap].map(([k, v]) => [k, structuredClone(v)])); },
    async put(k, v) { baseMap.set(k, structuredClone(v)); },
    async getMeta() { return meta; },
    async setMeta(m) { meta = m; },
  };
  return {
    lists,
    sync: () => syncRound({ local, bases, api: server.api(kind), device: kind, newId: id => `${id}-copy` }),
    pending: () => pendingChanges(local.items(), baseMap).length,
  };
}

const playlist = (chords, extra = {}) => ({ id: 'p1', name: 'Songs', chords: chords.map(id => ({ id, rootName: id })), updatedAt: T(1), ...extra });

// ── merge3 ────────────────────────────────────────────────────────────────
test('merge3: different chords added on each device are both kept', () => {
  const base = playlist(['a']);
  const mine = playlist(['b', 'a'], { updatedAt: T(2) });
  const theirs = playlist(['c', 'a'], { updatedAt: T(3) });
  const { data } = merge3('playlist', base, mine, theirs);
  assert.deepEqual(data.chords.map(c => c.id).sort(), ['a', 'b', 'c']);
  assert.equal(data.updatedAt, T(3));
});

test('merge3: a chord removed on one device and a rename on the other both apply', () => {
  const base = playlist(['a', 'b']);
  const mine = playlist(['a'], { updatedAt: T(2) });
  const theirs = playlist(['a', 'b'], { name: 'Campfire', updatedAt: T(3) });
  const { data } = merge3('playlist', base, mine, theirs);
  assert.deepEqual(data.chords.map(c => c.id), ['a']);
  assert.equal(data.name, 'Campfire');
});

test('merge3: the same field changed on both devices takes the later edit', () => {
  const base = playlist(['a']);
  const mine = playlist(['a'], { name: 'Mine', updatedAt: T(5) });
  const theirs = playlist(['a'], { name: 'Theirs', updatedAt: T(3) });
  assert.equal(merge3('playlist', base, mine, theirs).data.name, 'Mine');
  assert.equal(merge3('playlist', base, { ...mine, updatedAt: T(2) }, theirs).data.name, 'Theirs');
});

test('merge3: deleted on one device, edited later on the other: the edit wins', () => {
  const base = playlist(['a']);
  const deleted = playlist(['a'], { deletedAt: T(2), updatedAt: T(2) });
  const edited = playlist(['a', 'b'], { updatedAt: T(4) });
  const { data } = merge3('playlist', base, deleted, edited);
  assert.equal(data.deletedAt, undefined);
  assert.deepEqual(data.chords.map(c => c.id), ['a', 'b']);
});

test('merge3: deleted after the edit: it stays deleted', () => {
  const base = playlist(['a']);
  const edited = playlist(['a', 'b'], { updatedAt: T(2) });
  const deleted = playlist(['a'], { deletedAt: T(4), updatedAt: T(4) });
  assert.equal(merge3('playlist', base, edited, deleted).data.deletedAt, T(4));
});

test('merge3: progression steps merge by stepId, keeping each side\'s position', () => {
  const step = id => ({ stepId: id, bars: 1, rootName: id });
  const base = { id: 'pr', steps: [step('s1'), step('s2')], updatedAt: T(1) };
  const mine = { id: 'pr', steps: [step('s1'), step('m'), step('s2')], updatedAt: T(2) };
  const theirs = { id: 'pr', steps: [step('s1'), step('s2'), step('t')], updatedAt: T(3) };
  assert.deepEqual(merge3('progression', base, mine, theirs).data.steps.map(s => s.stepId), ['s1', 'm', 's2', 't']);
});

test('merge3: an instrument whose readings changed on both devices keeps both', () => {
  const base = { id: 'oc-1', name: 'Low D', family: 'ocarina', setup: { hz: [100, 200] }, updatedAt: T(1) };
  const mine = { ...base, setup: { hz: [101, 200] }, updatedAt: T(2) };
  const theirs = { ...base, setup: { hz: [102, 200] }, updatedAt: T(3), publicId: 'ABC234' };
  const { data, copy } = merge3('instrument', base, mine, theirs, { mineDevice: 'phone', theirsDevice: 'tablet', newId: id => id + '-b' });
  assert.deepEqual(data.setup.hz, [102, 200]);
  assert.equal(copy.id, 'oc-1-b');
  assert.equal(copy.name, 'Low D (from your phone)');
  assert.deepEqual(copy.setup.hz, [101, 200]);
});

test('merge3: an instrument renamed on one device and re-measured on the other needs no copy', () => {
  const base = { id: 'oc-1', name: 'Low D', setup: { hz: [100] }, updatedAt: T(1) };
  const { data, copy } = merge3('instrument', base, { ...base, name: 'Lowie', updatedAt: T(2) }, { ...base, setup: { hz: [99] }, updatedAt: T(3) });
  assert.equal(copy, null);
  assert.equal(data.name, 'Lowie');
  assert.deepEqual(data.setup.hz, [99]);
});

test('pendingChanges: only items that differ from their base, ignoring lastPlayedAt', () => {
  const items = new Map([
    ['instrument:a', { kind: 'instrument', id: 'a', data: { id: 'a', name: 'A', lastPlayedAt: T(9) } }],
    ['instrument:b', { kind: 'instrument', id: 'b', data: { id: 'b', name: 'B2' } }],
    ['instrument:c', { kind: 'instrument', id: 'c', data: { id: 'c', name: 'C' } }],
  ]);
  const bases = new Map([
    ['instrument:a', { version: 1, data: { id: 'a', name: 'A' } }],
    ['instrument:b', { version: 1, data: { id: 'b', name: 'B' } }],
  ]);
  assert.deepEqual(pendingChanges(items, bases).map(c => c.id), ['b', 'c']);
});

// ── Two devices ─────────────────────────────────────────────────────────────
test('a second device gets everything', async () => {
  const srv = fakeServer();
  const phone = device(srv, 'phone'), tablet = device(srv, 'tablet');
  phone.lists.playlist.push(playlist(['a']));
  phone.lists.instrument.push({ id: 'oc-1', name: 'Low D', updatedAt: T(1) });
  await phone.sync();
  await tablet.sync();
  assert.deepEqual(tablet.lists.playlist.map(p => p.id), ['p1']);
  assert.deepEqual(tablet.lists.instrument.map(i => i.name), ['Low D']);
  assert.equal(tablet.pending(), 0);
});

test('offline edits on two devices are both kept and flush on reconnect', async () => {
  const srv = fakeServer();
  const phone = device(srv, 'phone'), tablet = device(srv, 'tablet');
  phone.lists.playlist.push(playlist(['a']));
  await phone.sync();
  await tablet.sync();

  srv.online = false;
  phone.lists.playlist[0] = playlist(['b', 'a'], { updatedAt: T(2) });
  tablet.lists.playlist[0] = playlist(['c', 'a'], { updatedAt: T(3) });
  await phone.sync().catch(() => {});
  assert.equal(phone.pending(), 1, 'the change waits in the outbox');

  srv.online = true;
  await phone.sync();
  await tablet.sync(); // conflicts with the phone's write, merges, pushes
  await phone.sync();
  for (const d of [phone, tablet]) {
    assert.deepEqual(d.lists.playlist[0].chords.map(c => c.id).sort(), ['a', 'b', 'c']);
    assert.equal(d.pending(), 0);
  }
});

test('an instrument setup clash becomes a copy on both devices', async () => {
  const srv = fakeServer();
  const phone = device(srv, 'phone'), tablet = device(srv, 'tablet');
  phone.lists.instrument.push({ id: 'oc-1', name: 'Low D', setup: { hz: [100] }, updatedAt: T(1) });
  await phone.sync();
  await tablet.sync();
  phone.lists.instrument[0] = { ...phone.lists.instrument[0], setup: { hz: [101] }, updatedAt: T(2) };
  tablet.lists.instrument[0] = { ...tablet.lists.instrument[0], setup: { hz: [102] }, updatedAt: T(3) };
  await phone.sync();
  const r = await tablet.sync();
  await phone.sync();
  assert.deepEqual(r.copies, ['Low D (from your phone)']);
  for (const d of [phone, tablet]) {
    const names = d.lists.instrument.map(i => i.name).sort();
    assert.deepEqual(names, ['Low D', 'Low D (from your phone)']);
    assert.deepEqual(d.lists.instrument.find(i => i.id === 'oc-1').setup.hz, [102]);
  }
});

test('a delete travels to the other device', async () => {
  const srv = fakeServer();
  const phone = device(srv), tablet = device(srv, 'tablet');
  phone.lists.playlist.push(playlist(['a']));
  await phone.sync();
  await tablet.sync();
  phone.lists.playlist[0] = { ...phone.lists.playlist[0], deletedAt: T(5), updatedAt: T(5) };
  await phone.sync();
  await tablet.sync();
  assert.equal(tablet.lists.playlist[0].deletedAt, T(5));
});
