// Guards for two Sentry errors seen in development (OAKHUM-APP-3, OAKHUM-APP-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { displayNote } from '../js/data.js';

test('displayNote shows a non-string as it is instead of throwing (note.match is not a function)', () => {
  assert.equal(displayNote('G#3', false), 'G#3');
  assert.equal(displayNote('G#3', true), 'Ab3');
  assert.equal(displayNote(62, false), '62');
  assert.equal(displayNote(null, false), '');
  assert.equal(displayNote(undefined, true, true), '');
  assert.equal(displayNote({}, false), '[object Object]');
});

// build.py puts every js file into one script scope, so a helper called in
// the app (js/app/*.js) has to be declared in some file of that list. Calling one that was
// never declared is a ReferenceError the moment its screen renders
// ("speedBtnHtml is not defined").
const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const files = [...read('build.py').match(/js_files = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const sources = files.map(read);

test('every fooHtml() helper called in the app is declared in the bundle', () => {
  const app = files.filter(f => f === 'js/app.js' || f.startsWith('js/app/')).map(read).join('\n');
  const called = new Set([...app.matchAll(/(?<![.\w$])([a-z]\w*Html)\(/g)].map(m => m[1]));
  assert.ok(called.has('speedBtnHtml'), 'the scan finds the helper it is meant to guard');
  const declared = name => sources.some(src =>
    new RegExp(`(?:function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\b)`).test(src));
  const missing = [...called].filter(n => !declared(n));
  assert.deepEqual(missing, []);
});
