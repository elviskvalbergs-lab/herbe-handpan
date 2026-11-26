// The action registry (js/app/actions.js): every control's data-action has a
// handler, and no name is registered twice. Reads the app's files as text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_ACTIONS } from '../js/store.js';

const ROOT = new URL('..', import.meta.url).pathname;
const appFiles = readdirSync(join(ROOT, 'js', 'app'), { recursive: true }).filter(f => f.endsWith('.js')).map(f => join('js', 'app', f));
const src = Object.fromEntries([...appFiles, 'js/makers-ui.js'].map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));
const app = appFiles.map(f => src[f]).join('\n');

// registerActions({ 'a': …, 'b, c': … }[, TABLE]) blocks, by table.
function registered() {
  const out = { click: [], change: [] };
  for (const f of appFiles) {
    for (const block of src[f].split(/^registerActions\(\{$/m).slice(1)) {
      const end = /^\}(, [A-Z_]+)?\);$/m.exec(block);
      const body = block.slice(0, end.index + end[0].length);
      const table = /^\}, CHANGE_ACTIONS\);$/m.test(body) ? 'change' : 'click';
      for (const m of body.matchAll(/^  '([^']+)': \(el, e, action\) =>/gm)) out[table].push(...m[1].split(/,\s*/));
    }
  }
  return out;
}
const reg = registered();
// Screens that handle a group of names in one function (songAction, setupAction, makerClick, …).
const inFunctions = new Set([...Object.values(src).join('\n').matchAll(/action === '([a-z0-9-]+)'/g)].map(m => m[1]));
// The input listener (js/app/main.js) goes by the element's class.
const byClass = new Set([...src['js/app/main.js'].matchAll(/classList\?\.contains\('([a-z0-9-]+)'\)/g)].map(m => m[1]));
const handled = n => reg.click.includes(n) || reg.change.includes(n) || inFunctions.has(n) || byClass.has(n);

test('the registry has the actions, and none twice', () => {
  assert.ok(reg.click.length > 200 && reg.change.length > 10, `${reg.click.length} click, ${reg.change.length} change`);
  for (const t of ['click', 'change']) {
    const dup = reg[t].filter((n, i) => reg[t].indexOf(n) !== i);
    assert.deepEqual(dup, [], `registered twice (${t})`);
  }
});

test('every action a screen names has a handler', () => {
  const used = new Set();
  for (const re of [/data-action="([a-z0-9-]+)"/g, /\b(?:action|close|rootAction|countAction|categoryAction|open|clear):\s*'([a-z0-9-]+)'/g])
    for (const m of app.matchAll(re)) used.add(m[1]);
  assert.ok(used.size > 200);
  assert.deepEqual([...used].filter(n => !handled(n)).sort(), []);
});

test('the save moments and measured features name real actions', () => {
  assert.deepEqual(Object.keys(SAVE_ACTIONS).filter(n => !handled(n)), []);
  const measured = /const MEASURE_FEATURES = \{([^}]*)\}/.exec(app)[1];
  assert.deepEqual([...measured.matchAll(/'([a-z0-9-]+)'\s*:/g)].map(m => m[1]).filter(n => !handled(n)), []);
});
