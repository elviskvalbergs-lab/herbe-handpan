// The Oakhum logo in the app is the brand kit's master paths, unchanged
// (docs/design-system.md, "0. Brand"). Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { brandLogo } from '../js/brand.js';

const paths = f => [...readFileSync(new URL(`../brand/${f}`, import.meta.url), 'utf8').matchAll(/<path d="([^"]*)"/g)].map(m => m[1]);

test('the logo draws the master leaf and lettering in currentColor', () => {
  const [leaf, word] = paths('horizontal_ink.svg');
  const svg = brandLogo();
  assert.ok(svg.includes(`d="${leaf}"`), 'leaf path');
  assert.ok(svg.includes(`d="${word}"`), 'lettering path');
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /role="img" aria-label="Oakhum"/);
  assert.equal(paths('leaf_only_ink.svg')[0], leaf, 'the symbol is the same leaf');
});

test('the leaf alone, and a decorative logo next to text', () => {
  assert.match(brandLogo({ kind: 'leaf' }), /viewBox="0 0 100 150"/);
  assert.match(brandLogo({ label: '' }), /aria-hidden="true"/);
});

test('every colour version of a lockup has the same shapes', () => {
  for (const lockup of ['horizontal', 'stacked', 'leaf_hum', 'leaf_only']) {
    const ink = paths(`${lockup}_ink.svg`);
    for (const c of ['oak_olive', 'clay', 'cream']) assert.deepEqual(paths(`${lockup}_${c}.svg`), ink, `${lockup}_${c}`);
  }
});
