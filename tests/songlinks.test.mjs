// Unit tests for song links (js/links.js) and where they are routed. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONGS } from '../js/songs.js';
import { catalogueLinks, linkFor, parseLink, linkPreview, linkSong, linkSongTitle, withLinkPreview, LINK_FAMILIES, LINK_TABS } from '../js/links.js';

const targetOf = l => (l.scaleId ? { scaleId: l.scaleId } : { chartId: l.chartId, keyId: l.keyId });

test('every song id is its own link slug', () => {
  for (const s of SONGS) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, s.id);
    assert.equal(linkSong(s.id), s.id);
    assert.equal(linkSong(s.id.toUpperCase()), s.id, 'any case');
  }
  assert.equal(linkSong('not-a-song'), null);
  assert.equal(linkSong(null), null);
});

test('a song on every catalogue instrument round-trips', () => {
  const links = catalogueLinks();
  assert.ok(links.length > 200);
  for (const l of links) {
    for (const s of [SONGS[0], SONGS[SONGS.length - 1]]) {
      const path = linkFor(targetOf(l), { song: s.id });
      assert.equal(path, `${l.path}/songs/${s.id}`);
      const back = parseLink(path);
      assert.equal(back.path, path);
      assert.equal(back.song, s.id);
      assert.equal(back.tab, 'songs');
      assert.equal(back.family, l.family);
      assert.equal(back.scaleId, l.scaleId);
      assert.equal(back.chartId, l.chartId);
      assert.equal(back.keyId, l.keyId);
    }
  }
});

test('every song round-trips on one instrument of each family, and alone', () => {
  const one = LINK_FAMILIES.map(f => catalogueLinks().find(l => l.family === f));
  for (const s of SONGS) {
    for (const l of one) {
      const path = linkFor(targetOf(l), { song: s.id });
      assert.equal(parseLink(path).song, s.id, path);
      assert.equal(parseLink(path).path, path);
    }
    const alone = linkFor({ song: s.id });
    assert.equal(alone, `/song/${s.id}`);
    assert.deepEqual(parseLink(alone), { kind: 'song', song: s.id, path: alone });
  }
});

test('the songs tab, unknown songs, aliases of the instrument', () => {
  for (const f of LINK_FAMILIES) assert.ok(LINK_TABS[f].includes('songs'), f);
  assert.equal(linkFor({ scaleId: 'D-Kurd' }, { tab: 'songs' }), '/handpan/d-kurd/songs');
  const list = parseLink('/handpan/d-kurd/songs');
  assert.equal(list.tab, 'songs');
  assert.equal(list.song, null);
  const unknown = parseLink('/handpan/d-kurd/songs/not-a-song');
  assert.equal(unknown.song, null, 'an unknown song opens the song list');
  assert.equal(unknown.path, '/handpan/d-kurd/songs');
  assert.equal(parseLink('/handpan/kurd/songs/ode-to-joy').path, '/handpan/d-kurd/songs/ode-to-joy', 'an alias shows the canonical link');
  assert.equal(parseLink('/ocarina/tin-whistle-d/songs/ode-to-joy').path, '/flute/tin-whistle-d/songs/ode-to-joy', 'the wrong family finds the right one');
  assert.equal(parseLink('/song/not-a-song'), null);
  assert.equal(parseLink('/song'), null);
  assert.equal(linkFor({ song: 'not-a-song' }), null);
  // A chord link is still a chord link.
  assert.equal(parseLink('/handpan/d-kurd/chords/a-min').chord, 'a-min');
  assert.equal(parseLink('/handpan/d-kurd/chords/a-min').song, null);
});

test('a song on custom notes and on a shared instrument', () => {
  const q = 'ding=D3&top=A3,Bb3,C4,D4,E4,F4,G4,A4&tc=8&bc=0&name=Mine';
  const path = linkFor({ custom: q, family: 'handpan' }, { song: 'twinkle-twinkle' });
  assert.equal(path, `/handpan/custom/songs/twinkle-twinkle?${q}`);
  const [p, search] = path.split('?');
  const back = parseLink(p, `?${search}`);
  assert.equal(back.kind, 'custom');
  assert.equal(back.song, 'twinkle-twinkle');
  assert.equal(back.params.get('ding'), 'D3');
  assert.equal(back.path, path);
  const shared = parseLink('/s/7kq2pm/songs/twinkle-twinkle');
  assert.equal(shared.kind, 'shared');
  assert.equal(shared.song, 'twinkle-twinkle');
  assert.equal(shared.path, '/s/7KQ2PM/songs/twinkle-twinkle');
  assert.equal(linkFor({ code: '7kq2pm' }, { song: 'twinkle-twinkle' }), shared.path);
  // A drum drawn the other way round keeps that with the song.
  assert.equal(parseLink('/tongue-drum/d-kurd-9/songs/ode-to-joy', '?centre=0').path, '/tongue-drum/d-kurd-9/songs/ode-to-joy?centre=0');
});

test('preview cards for songs', () => {
  assert.equal(linkSongTitle('ode-to-joy'), 'Ode to Joy', 'without the bracketed second title');
  const p = linkPreview('/handpan/d-kurd/songs/twinkle-twinkle');
  assert.equal(p.title, 'Twinkle, Twinkle, Little Star on D Kurd handpan · Oakhum');
  assert.match(p.description, /^Play it note by note on the D Kurd handpan/);
  assert.equal(p.image, '/og/handpan.jpg');
  assert.match(linkPreview('/flute/tin-whistle-d/songs/ode-to-joy').description, /on the tin whistle in D/);
  assert.equal(linkPreview('/s/7KQ2PM/songs/ode-to-joy').title, 'Ode to Joy on a shared instrument · Oakhum');
  const alone = linkPreview('/song/ode-to-joy');
  assert.equal(alone.title, 'Ode to Joy · Oakhum');
  assert.equal(alone.image, '/og/app.jpg');
  assert.match(linkPreview('/kalimba/c-major-17/songs').title, /^Songs for the .*kalimba · Oakhum$/);
  assert.equal(linkPreview('/handpan/d-kurd/songs/not-a-song').title, 'Songs for the D Kurd handpan · Oakhum');
  const html = '<html><head>\n  <title>Oakhum</title>\n  <meta property="og:title" content="Oakhum">\n</head><body></body></html>';
  const out = withLinkPreview(html, p, 'https://example.app', 'https://example.app/handpan/d-kurd/songs/twinkle-twinkle');
  assert.match(out, /<title>Twinkle, Twinkle, Little Star on D Kurd handpan · Oakhum<\/title>/);
  assert.match(out, /og:url" content="https:\/\/example.app\/handpan\/d-kurd\/songs\/twinkle-twinkle"/);
});

// Every place that routes deep links to the app lists the same paths: the
// app's own rewrites and middleware, and the website's list of app paths.
test('vercel.json, middleware.js and the website route every link family and /song', () => {
  const want = [...LINK_FAMILIES.map(f => `/${f}/:path*`), '/s/:path*', '/song/:path*'];
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = vercel.rewrites.map(r => r.source);
  for (const w of want) {
    assert.ok(rewrites.includes(w), `vercel.json rewrites ${w}`);
    assert.equal(vercel.rewrites.find(r => r.source === w).destination, '/');
  }
  const mw = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
  const matcher = /matcher:\s*\[([^\]]*)\]/.exec(mw)[1];
  const site = readFileSync(new URL('../site/next.config.ts', import.meta.url), 'utf8');
  const appPaths = /const APP_PATHS = \[([\s\S]*?)\];/.exec(site)[1];
  for (const w of want) {
    assert.ok(matcher.includes(`'${w}'`), `middleware.js matches ${w}`);
    assert.ok(appPaths.includes(`"${w}"`), `site/next.config.ts sends ${w} to the app`);
  }
  // The browser tests' server serves the same paths as production: every
  // link family (from LINK_FAMILIES), /s and /song.
  const harness = readFileSync(new URL('./e2e/harness.mjs', import.meta.url), 'utf8');
  const served = /const APP_PATHS = new RegExp\(`\^\/\(\|play\|\(\$\{\[\.\.\.LINK_FAMILIES, ([^\]]*)\]/.exec(harness);
  assert.ok(served, 'tests/e2e/harness.mjs builds APP_PATHS from LINK_FAMILIES');
  for (const extra of ['s', 'song']) assert.ok(served[1].includes(`'${extra}'`), `tests/e2e/harness.mjs serves /${extra}/`);
  // The website's own song pages live at /songs, which must stay the site's.
  assert.ok(!rewrites.some(r => r.startsWith('/songs')));
  assert.ok(!appPaths.includes('"/songs'));
});
