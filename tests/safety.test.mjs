// What comes from outside the app (a link's query, an instrument shared by
// code) must never reach the picture or the page as markup. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layoutFromCustomParams, withLinkPreview, linkTitle, parseLink } from '../js/links.js';
import { safeLayout, safeNoteName } from '../js/layoutfamilies.js';
import { renderPan } from '../js/pan.js';
import { KALIMBAS } from '../js/kalimbas.js';

const HOSTILE = 'D3"><img src=x onerror="window.__x=1">';

test('a custom link keeps only note names', () => {
  const layout = layoutFromCustomParams(new URLSearchParams({ ding: HOSTILE, top: `A3,${HOSTILE},C4`, bottom: HOSTILE }));
  assert.equal(layout.top.ding, 'D3');
  assert.deepEqual(layout.top.slots.slice(0, 3).map(s => s.note), ['A3', null, 'C4']);
  assert.ok(layout.bottom.slots.every(s => s.note === null));
  assert.ok(!JSON.stringify(layout).includes('onerror'));
});

test('a shared layout is cleaned: notes, sizes, positions', () => {
  const layout = safeLayout({
    id: 'custom', name: 'x'.repeat(500), isCustom: true,
    top: { ding: HOSTILE, capacity: 9999, slots: [{ note: 'Bb3' }, { note: HOSTILE }, { note: 'F#4' }] },
    bottom: { slots: [{ note: 7 }] },
    pos: { ding: { x: '250"><script>', y: 250 }, 'ring-0': { x: 120, y: 300 }, evil: { x: 1, y: 1 } },
  });
  assert.equal(layout.top.ding, 'D3');
  assert.deepEqual(layout.top.slots.slice(0, 3).map(s => s.note), ['Bb3', null, 'F#4']);
  assert.ok(layout.top.capacity <= 12);
  assert.equal(layout.name.length, 80);
  assert.deepEqual(layout.pos, { 'ring-0': { x: 120, y: 300 } });
  assert.equal(safeNoteName('C#4'), 'C#4');
  assert.equal(safeNoteName('C#44'), null);
});

test('the picture escapes whatever it is given', () => {
  const layout = { id: 'custom', name: 'n', top: { ding: 'D3', capacity: 2, slots: [{ note: HOSTILE }, { note: 'A3' }] }, bottom: { slots: [], capacity: 0 } };
  const svg = renderPan(layout, {});
  assert.ok(!svg.includes('<img'), 'no markup from a note');
});

test('link previews treat URL text as text, not as replace patterns', () => {
  const html = '<head><title>t</title><meta name="description" content="d"></head><body>BODY</body>';
  const out = withLinkPreview(html, { title: "a$'b$`c$&", description: "x$'y", image: '/og/x.jpg' }, 'https://e.test', 'https://e.test/p');
  assert.equal(out.split('BODY').length, 2, 'the page is not repeated');
  assert.ok(out.includes("a$'b$`c$&amp;"));
});

test('kalimbas of one key are told apart by their number of keys', () => {
  const titles = KALIMBAS.map(k => linkTitle(parseLink(`/kalimba/${k.slug}`)));
  assert.equal(new Set(titles).size, titles.length, titles.join(' | '));
});
