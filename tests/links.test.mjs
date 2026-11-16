// Unit tests for js/links.js (docs/free-to-play.md, "1. Deep links"). Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCALES } from '../js/data.js';
import { TRADITIONAL_CHARTS } from '../js/charts.js';
import {
  parseLink, linkFor, linkSlug, linkTitle, linkPreview, withLinkPreview, catalogueLinks, closestLinks,
} from '../js/links.js';

test('slugs: lower case, # as s, dashes', () => {
  assert.equal(linkSlug('D-Kurd'), 'd-kurd');
  assert.equal(linkSlug('F#-Kurd'), 'fs-kurd');
  assert.equal(linkSlug('C#-maj7'), 'cs-maj7');
  assert.equal(linkSlug('F-Low-Pygmy-11'), 'f-low-pygmy-11');
});

test('every catalogue scale and chart key has exactly one link, and it round-trips', () => {
  const links = catalogueLinks();
  const paths = links.map(l => l.path);
  assert.equal(new Set(paths).size, paths.length, 'no two instruments share a link');
  const keys = TRADITIONAL_CHARTS.reduce((n, c) => n + c.keys.length, 0);
  assert.equal(links.length, SCALES.length + keys);
  for (const s of SCALES) {
    const path = linkFor({ scaleId: s.id });
    const back = parseLink(path);
    assert.equal(back.kind, 'scale', path);
    assert.equal(back.scaleId, s.id, path);
    assert.equal(back.path, path);
  }
  for (const c of TRADITIONAL_CHARTS) {
    for (const k of c.keys) {
      const path = linkFor({ chartId: c.id, keyId: k.id });
      assert.ok(path.startsWith(`/${c.family}/`), path);
      const back = parseLink(path);
      assert.deepEqual([back.kind, back.chartId, back.keyId], ['chart', c.id, k.id], path);
    }
  }
});

test('the links the website uses', () => {
  assert.equal(linkFor({ scaleId: 'D-Kurd' }), '/handpan/d-kurd');
  assert.equal(linkFor({ scaleId: 'D-Celtic-Minor' }), '/handpan/d-celtic-minor');
  assert.equal(linkFor({ chartId: 'ocarina-12-stl-c', keyId: 'C-A4' }), '/ocarina/alto-c-12');
  assert.equal(linkFor({ chartId: 'ocarina-12-stl-c', keyId: 'C-A5' }), '/ocarina/soprano-c-12');
  assert.equal(linkFor({ chartId: 'ocarina-12-stl-c', keyId: 'C-A3' }), '/ocarina/bass-c-12');
  assert.equal(linkFor({ chartId: 'tin-whistle-d', keyId: 'D' }), '/flute/tin-whistle-d');
  assert.equal(linkFor({ chartId: 'naf6-penta', keyId: 'A4' }), '/flute/naf-6-a4');
});

test('tabs and chords in the path', () => {
  assert.equal(linkFor({ scaleId: 'D-Kurd' }, { tab: 'chords', chord: 'A-min' }), '/handpan/d-kurd/chords/a-min');
  assert.equal(linkFor({ scaleId: 'D-Kurd' }, { tab: 'pan' }), '/handpan/d-kurd', 'the default tab is left out');
  assert.equal(linkFor({ chartId: 'ocarina-12-stl-c', keyId: 'C-A4' }, { tab: 'notes' }), '/ocarina/alto-c-12');
  const l = parseLink('/handpan/d-kurd/chords/A-min');
  assert.deepEqual([l.scaleId, l.tab, l.chord], ['D-Kurd', 'chords', 'a-min']);
  assert.equal(parseLink('/handpan/d-kurd/nonsense').tab, null, 'unknown tabs are ignored');
  assert.equal(parseLink('/ocarina/alto-c-12/listen').tab, 'listen');
});

test('aliases open the canonical instrument', () => {
  const cm = parseLink('/handpan/celtic-minor');
  assert.equal(cm.scaleId, 'D-Celtic-Minor');
  assert.equal(cm.path, '/handpan/d-celtic-minor');
  assert.equal(parseLink('/handpan/kurd').scaleId, 'D-Kurd');
  assert.equal(parseLink('/handpan/D-Kurd').scaleId, 'D-Kurd', 'any case');
  assert.equal(parseLink('/ocarina/12-hole').keyId, 'C-A4');
  assert.equal(parseLink('/ocarina/12-hole-g').path, '/ocarina/alto-g-12');
  assert.equal(parseLink('/ocarina/alto-g').path, '/ocarina/alto-g-12');
  assert.equal(parseLink('/flute/tin-whistle').path, '/flute/tin-whistle-d');
  assert.equal(parseLink('/flute/naf-6').path, '/flute/naf-6-a4');
  // A flute linked under the wrong family still opens.
  assert.equal(parseLink('/ocarina/tin-whistle-d').path, '/flute/tin-whistle-d');
});

test('unknown slugs say so, with the closest matches', () => {
  const u = parseLink('/handpan/d-kurdd');
  assert.equal(u.kind, 'unknown');
  assert.equal(u.closest[0], '/handpan/d-kurd');
  assert.equal(closestLinks('ocarina', 'alto-c-21')[0], '/ocarina/alto-c-12');
});

test('not deep links', () => {
  for (const p of ['/', '', '/index.html', '/handpan', '/piano/c-major', '/s/!!']) assert.equal(parseLink(p), null, p);
});

test('custom handpan notes travel in the link', () => {
  const q = 'ding=D3&top=A3,C4,D4,E4,F4,A4,C5,D5&bottom=&tc=8&bc=3&name=Mine';
  const path = linkFor({ custom: q }, { tab: 'chords', chord: 'A-min' });
  assert.equal(path, `/handpan/custom/chords/a-min?${q}`);
  const [pathname, search] = path.split('?');
  const l = parseLink(pathname, '?' + search);
  assert.equal(l.kind, 'custom');
  assert.equal(l.params.get('top'), 'A3,C4,D4,E4,F4,A4,C5,D5');
  assert.equal(l.params.get('name'), 'Mine');
  assert.equal(l.chord, 'a-min');
});

test('shared instruments by code', () => {
  const l = parseLink('/s/7kq2pm/chords');
  assert.deepEqual([l.kind, l.code, l.tab, l.path], ['shared', '7KQ2PM', 'chords', '/s/7KQ2PM/chords']);
  assert.equal(linkFor({ code: 'abc123' }), '/s/ABC123');
});

test('names and preview cards', () => {
  assert.equal(linkTitle(parseLink('/handpan/d-kurd')), 'D Kurd handpan');
  assert.equal(linkTitle(parseLink('/ocarina/alto-c-12')), 'Alto C 12-hole ocarina');
  assert.equal(linkTitle(parseLink('/flute/tin-whistle-d')), 'Tin whistle in D');
  const p = linkPreview('/handpan/d-kurd/chords/a-min');
  assert.equal(p.title, 'D Kurd handpan · Oakhum');
  assert.match(p.description, /A min chord/);
  assert.equal(p.image, '/og/handpan.jpg');
  assert.equal(linkPreview('/ocarina/alto-c-12').image, '/og/ocarina.jpg');
  assert.equal(linkPreview('/handpan/nope').image, '/og/app.jpg', 'unknown links get the app card');
});

test('the preview card goes into index.html', () => {
  const html = `<html><head>\n  <title>Oakhum</title>\n  <meta name="description" content="x">\n  <meta property="og:title" content="Oakhum">\n  <meta property="og:image" content="/og/app.jpg">\n</head><body><script>const t = '<title>not this</title>';</script></body></html>`;
  const out = withLinkPreview(html, linkPreview('/ocarina/alto-c-12'), 'https://example.app', 'https://example.app/ocarina/alto-c-12');
  assert.match(out, /<title>Alto C 12-hole ocarina · Oakhum<\/title>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/example.app\/og\/ocarina.png">/);
  assert.match(out, /<meta property="og:url" content="https:\/\/example.app\/ocarina\/alto-c-12">/);
  assert.match(out, /<meta name="description" content="Notes, chords, arpeggios and play-along on the alto C 12-hole ocarina/);
  assert.match(out, /'<title>not this<\/title>'/, 'only the head changes');
  assert.equal((out.match(/og:title/g) || []).length, 1);
});
