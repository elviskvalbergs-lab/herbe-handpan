// Sync by item (docs/free-to-play.md §4 "Edits on two devices while
// offline", Phase 3 "Storage and sync"). Pure: no DOM, no storage, no
// network. The app gives it three adapters:
//
//   local  — the items on this device:  items() → Map(key → { kind, id, data })
//            write(kind, id, data) · add(kind, data) (a kept copy)
//   bases  — the last synced copy of each item (IndexedDB in the browser):
//            async getAll() → Map(key → { version, data }) · put(key, rec) ·
//            async getMeta() / setMeta({ lastPull })
//   api    — the server: pull(sinceIso) → rows · saveItem({ kind, id, data,
//            baseVersion, deleted, editedAt }) → { ok, version } | { ok: false, current }
//
// The outbox is what differs between an item and its base: every local edit
// (online or not) shows up there until the server has taken it, so nothing
// needs to remember to queue a change and an edit made offline survives a
// reload. Writes are ordered by the server's version; device time
// (updatedAt) only breaks ties between two edits of the same field.

// Fields that never count as an edit (playing an instrument reorders My
// instruments but isn't a change worth syncing).
const SYNC_VOLATILE = ['lastPlayedAt'];
// The id field of items inside arrays that merge item by item.
const SYNC_ARRAY_IDS = ['id', 'stepId'];
// Instrument fields two devices may both change without making a copy.
const SYNC_SOFT_FIELDS = ['name', 'updatedAt', 'lastPlayedAt', 'deletedAt'];

export function syncKey(kind, id) { return `${kind}:${id}`; }

function syncStable(v) {
  if (Array.isArray(v)) return v.map(syncStable);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = syncStable(v[k]);
    return out;
  }
  return v;
}

export function syncSame(a, b) {
  return JSON.stringify(syncStable(a ?? null)) === JSON.stringify(syncStable(b ?? null));
}

// The item without the fields that don't count as edits.
export function syncComparable(data) {
  if (!data || typeof data !== 'object') return data ?? null;
  const out = { ...data };
  for (const f of SYNC_VOLATILE) delete out[f];
  return out;
}

function syncChanged(data, base) { return !syncSame(syncComparable(data), syncComparable(base)); }

function syncIsObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

function syncArrayIdKey(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return SYNC_ARRAY_IDS.find(k => arr.every(x => syncIsObj(x) && x[k] != null)) ?? null;
}

// Two lists of items with ids, both changed since base: adds on both sides
// are kept, a removal on either side applies, items on both sides merge
// field by field. Order follows the side that reordered (mine if both did).
function syncMergeArrays(base, mine, theirs, idKey, ctx) {
  const ids = arr => (arr || []).map(x => x[idKey]);
  const byId = arr => new Map((arr || []).map(x => [x[idKey], x]));
  const b = byId(base), m = byId(mine), t = byId(theirs);
  // Did mine reorder the items all three sides share?
  const shared = list => ids(list).filter(id => b.has(id) && m.has(id) && t.has(id));
  const mineReordered = !syncSame(shared(mine), shared(base));
  const [first, second] = mineReordered ? [mine, theirs] : [theirs, mine];
  const f = byId(first), s = byId(second);
  const removedIn = (side, id) => b.has(id) && !side.has(id);
  const out = [];
  for (const item of first) {
    const id = item[idKey];
    if (removedIn(s, id)) continue;
    if (s.has(id)) out.push(syncMergeValues(b.get(id), m.get(id), t.get(id), ctx).value);
    else out.push(item); // added on the first side
  }
  // Items added on the second side, after the item they follow there.
  const secondIds = ids(second);
  secondIds.forEach((id, i) => {
    if (f.has(id) || b.has(id)) return;
    const prev = secondIds.slice(0, i).reverse().find(p => out.some(x => x[idKey] === p));
    const at = prev == null ? 0 : out.findIndex(x => x[idKey] === prev) + 1;
    out.splice(at, 0, s.get(id));
  });
  return out;
}

// Field-by-field three-way merge of two values. ctx.later is 'mine' or
// 'theirs' (whose edit is later); ctx.clashes collects the paths both sides
// changed to different values.
function syncMergeValues(base, mine, theirs, ctx, path = '') {
  if (syncSame(mine, theirs)) return { value: mine };
  if (syncSame(mine, base)) return { value: theirs };
  if (syncSame(theirs, base)) return { value: mine };
  const idKey = Array.isArray(mine) && Array.isArray(theirs) ? (syncArrayIdKey([...mine, ...theirs]) ?? null) : null;
  if (idKey) return { value: syncMergeArrays(Array.isArray(base) ? base : [], mine, theirs, idKey, ctx) };
  if (syncIsObj(mine) && syncIsObj(theirs)) {
    const b = syncIsObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      const v = syncMergeValues(b[k], mine[k], theirs[k], ctx, path ? `${path}.${k}` : k).value;
      if (v !== undefined) out[k] = v;
    }
    return { value: out };
  }
  ctx.clashes.push(path);
  return { value: ctx.later === 'mine' ? mine : theirs };
}

function syncTime(data) { return (data && (data.deletedAt || data.updatedAt)) || ''; }

// Three-way merge of one item (§4):
// - different fields changed on each device: both apply
// - lists of chords / steps: adds on both kept, removals apply
// - the same field changed on both: the later edit wins
// - deleted on one, edited later on the other: the edit wins (it comes
//   back); deleted after the edit: it stays deleted
// - instrument setups where both changed the same readings: nothing is
//   thrown away; the newer stays and the older comes back as a copy
//   (`copy`), named "… (from your <device>)".
// Returns { data, copy } (copy is null unless an instrument clashed).
export function merge3(kind, base, mine, theirs, { mineDevice = 'device', theirsDevice = 'other device', newId } = {}) {
  if (!mine) return { data: theirs, copy: null };
  if (!theirs) return { data: mine, copy: null };
  const later = syncTime(mine) >= syncTime(theirs) ? 'mine' : 'theirs';
  const mDel = !!mine.deletedAt, tDel = !!theirs.deletedAt;
  if (mDel || tDel) {
    if (mDel && tDel) return { data: later === 'mine' ? mine : theirs, copy: null };
    const [del, kept] = mDel ? [mine, theirs] : [theirs, mine];
    const keptEdited = !base || syncChanged(kept, base);
    // The edit wins when it is later than the delete; otherwise it stays deleted.
    if (keptEdited && (kept.updatedAt || '') > del.deletedAt) {
      const { deletedAt, ...alive } = kept;
      return { data: alive, copy: null };
    }
    return { data: del, copy: null };
  }
  const ctx = { later, clashes: [] };
  const { value } = syncMergeValues(base ?? {}, mine, theirs, ctx);
  const data = { ...value, updatedAt: later === 'mine' ? mine.updatedAt : theirs.updatedAt };
  if (data.updatedAt === undefined) delete data.updatedAt;
  const hard = ctx.clashes.filter(p => !SYNC_SOFT_FIELDS.includes(p.split('.')[0]));
  if (kind === 'instrument' && hard.length) {
    const [newer, older, olderDevice] = later === 'mine' ? [mine, theirs, theirsDevice] : [theirs, mine, mineDevice];
    const id = newId ? newId(older.id) : `${older.id}-${Math.random().toString(36).slice(2, 6)}`;
    const { publicId, ...rest } = older;
    return { data: newer, copy: { ...rest, id, name: `${older.name ?? 'Instrument'} (from your ${olderDevice})` } };
  }
  return { data, copy: null };
}

// The outbox: every item that differs from what the server last confirmed.
// Items the device doesn't have are left alone (a missing item is never a
// delete; deletes are soft, with deletedAt).
export function pendingChanges(localItems, bases) {
  const out = [];
  for (const [key, item] of localItems) {
    const base = bases.get(key);
    if (!base) { if (!item.data?.deletedAt) out.push({ ...item, key, base: null }); continue; }
    if (syncChanged(item.data, base.data)) out.push({ ...item, key, base });
  }
  return out;
}

// A server row as the item the app stores.
export function rowToItem(row) {
  const data = { ...(row.data || {}) };
  if (row.deleted_at && !data.deletedAt) data.deletedAt = row.deleted_at;
  if (!row.deleted_at) delete data.deletedAt;
  return data;
}

// One round of sync: pull what other devices wrote, merge it in, then push
// this device's changes, merging and retrying when another device got there
// first. Returns { pulled, pushed, copies, pending } (counts, and the
// names of kept copies for the one-time note).
export async function syncRound({ local, bases, api, device = 'device', newId }) {
  const baseMap = await bases.getAll();
  const meta = (await bases.getMeta()) || {};
  const result = { pulled: 0, pushed: 0, copies: [], pending: 0 };
  const mergeIn = (kind, id, base, mine, row) => {
    const theirs = rowToItem(row);
    const { data, copy } = merge3(kind, base?.data ?? null, mine, theirs, { mineDevice: device, theirsDevice: row.device_kind || 'other device', newId });
    local.write(kind, id, data);
    if (copy) { local.add(kind, copy); result.copies.push(copy.name); }
    return theirs;
  };

  // Pull. A little overlap guards against rows committed out of order;
  // versions already seen are skipped.
  const since = meta.lastPull ? new Date(Date.parse(meta.lastPull) - 10000).toISOString() : null;
  const rows = await api.pull(since);
  let newest = meta.lastPull || null;
  const items = local.items();
  for (const row of rows) {
    if (!newest || row.updated_at > newest) newest = row.updated_at;
    const key = syncKey(row.kind, row.id);
    const base = baseMap.get(key);
    if (base && row.version <= base.version) continue;
    const mine = items.get(key)?.data ?? null;
    const unchangedHere = mine && base && !syncChanged(mine, base.data);
    let stored;
    if (!mine || unchangedHere) {
      // Unchanged here (or not here at all): take theirs, keeping what never syncs.
      stored = rowToItem(row);
      const keep = {};
      for (const f of SYNC_VOLATILE) if (mine?.[f] !== undefined) keep[f] = mine[f];
      local.write(row.kind, row.id, { ...stored, ...keep });
    } else {
      stored = mergeIn(row.kind, row.id, base, mine, row);
    }
    const rec = { version: row.version, data: stored };
    baseMap.set(key, rec);
    await bases.put(key, rec);
    result.pulled++;
  }
  if (newest) await bases.setMeta({ ...meta, lastPull: newest });

  // Push the outbox.
  for (let pass = 0; pass < 3; pass++) {
    const changes = pendingChanges(local.items(), baseMap);
    if (!changes.length) break;
    let conflicted = false;
    for (const ch of changes) {
      const res = await api.saveItem({
        kind: ch.kind, id: ch.id, data: ch.data, baseVersion: ch.base?.version ?? 0,
        deleted: !!ch.data.deletedAt, editedAt: ch.data.deletedAt || ch.data.updatedAt || null,
      });
      if (res?.ok) {
        const rec = { version: res.version, data: ch.data };
        baseMap.set(ch.key, rec);
        await bases.put(ch.key, rec);
        result.pushed++;
      } else if (res?.current) {
        const row = res.current;
        const stored = mergeIn(ch.kind, ch.id, ch.base, ch.data, row);
        const rec = { version: row.version, data: stored };
        baseMap.set(ch.key, rec);
        await bases.put(ch.key, rec);
        conflicted = true;
      } else {
        // Offline or the server said no: stays in the outbox for next time.
        result.pending = pendingChanges(local.items(), baseMap).length;
        return result;
      }
    }
    if (!conflicted) break;
  }
  result.pending = pendingChanges(local.items(), baseMap).length;
  return result;
}
