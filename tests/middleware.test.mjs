import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkSearchHeaders } from '../middleware.js';

test('a plain tuning link names the website\'s page as its canonical address', () => {
  assert.deepEqual(linkSearchHeaders('/handpan/d-kurd'), { link: '<https://oakhum.com/instruments/handpan/d-kurd>; rel="canonical"' });
  assert.deepEqual(linkSearchHeaders('/tongue-drum/d-kurd-9'), { link: '<https://oakhum.com/instruments/steel-tongue-drum/d-kurd-9>; rel="canonical"' });
  assert.deepEqual(linkSearchHeaders('/ocarina/alto-c-12'), { link: '<https://oakhum.com/instruments/ocarina/alto-c-12>; rel="canonical"' });
  // Campaign tags don't make it another page.
  assert.deepEqual(linkSearchHeaders('/handpan/d-kurd', '?utm_source=card'), { link: '<https://oakhum.com/instruments/handpan/d-kurd>; rel="canonical"' });
});

test('every other deep link asks not to be indexed', () => {
  const noindex = { 'x-robots-tag': 'noindex, follow' };
  assert.deepEqual(linkSearchHeaders('/handpan/d-kurd/chords/a-min'), noindex);
  assert.deepEqual(linkSearchHeaders('/ocarina/alto-c-12/chords'), noindex);
  assert.deepEqual(linkSearchHeaders('/handpan/custom', '?ding=D3&top=A3,C4'), noindex);
  assert.deepEqual(linkSearchHeaders('/s/abc123'), noindex);
  assert.deepEqual(linkSearchHeaders('/handpan/nope'), noindex);
});
