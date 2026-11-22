// Browser smoke suite: the safety net for js/app.js, which has no unit
// tests. It opens the built app in a real browser and walks the paths a
// person takes most; any uncaught error, console error or missing file
// fails it. Run by scripts/ci.sh on every pull request:
//
//   python3 build.py && node tests/e2e/smoke.e2e.mjs
//
// Keep it fast (a few seconds) and about "does it open and work", not
// about details: details belong in tests/*.test.mjs. When a pull request
// adds a screen, add one step that opens it.
import assert from 'node:assert/strict';
import { chromium, serveApp, fakeServer, newDevice, runner } from './harness.mjs';
import { catalogueLinks, LINK_FAMILIES } from '../../js/links.js';

const app = await serveApp();
const server = fakeServer();
const browser = await chromium.launch();
const run = runner();
let failed = false;

// A fresh guest (nothing saved) for each part.
async function guest(name) {
  const d = await newDevice(browser, server, name, { base: app.base, serviceWorkers: 'block' });
  d.page.setDefaultTimeout(8000);
  return d;
}
// Fails the step when the page reported anything since the last check.
function clean(d) {
  const found = d.problems.splice(0);
  assert.deepEqual(found, [], `${d.name}: the page reported problems`);
}
const step = (name, d, fn) => run.step(name, async () => { await fn(d.page); clean(d); }, d.page);
// The instrument's picture is on screen: the pan / drum / kalimba drawing
// or a fingering diagram, with something drawn in it.
async function pictureShown(p) {
  const pic = p.locator('.pan-wrap svg, svg.fingering').first();
  await pic.waitFor();
  assert.ok(await pic.locator('circle, path, ellipse, rect').count() > 0, 'the picture is empty');
}

try {
  // ── First run ─────────────────────────────────────────────────────────────
  const first = await guest('first run');
  await step('/play opens on the first-run setup with every instrument family', first, async p => {
    await p.goto(`${app.base}/play`);
    await p.locator('.setup-tile').first().waitFor();
    const families = await p.locator('[data-action="setup-family"]').evaluateAll(els => els.map(e => e.dataset.family));
    assert.deepEqual([...families].sort(), [...LINK_FAMILIES].sort());
    assert.equal(await p.title(), 'Oakhum');
  });
  await step('setup: handpan, "I know my scale", a key, a scale, then "Play my first chord"', first, async p => {
    await p.click('[data-action="setup-family"][data-family="handpan"]');
    await p.click('[data-action="setup-know"]');
    await p.locator('[data-action="setup-root"]').first().click();
    await p.locator('[data-action="setup-scale"]').first().click();
    const go = p.locator('[data-action="setup-first-chord"]');
    assert.match(await go.innerText(), /Play my first chord/);
    await go.click();
    await p.waitForURL(/\/handpan\/[a-z0-9-]+\/chords\/[a-z0-9-]+/);
    await pictureShown(p);
    assert.ok(await p.locator('[data-action="select-chord"]').count() > 3, 'chords are listed');
  });
  await step('a chord plays, and the next chord opens', first, async p => {
    await p.click('[data-action="play-chord"]');
    await p.locator('[data-action="select-chord"]').nth(2).click();
    await pictureShown(p);
  });
  await step('the picture is playable from the keyboard: notes are named buttons, Enter picks one', first, async p => {
    const notes = p.locator('.pan-wrap .pan-note[data-note]');
    const first = notes.first();
    assert.equal(await first.getAttribute('role'), 'button');
    assert.equal(await first.getAttribute('tabindex'), '0');
    assert.match(await first.getAttribute('aria-label'), /^[A-G]/);
    await p.locator('[data-action="toggle-discover-mode"]', { hasText: 'Tap notes' }).click();
    await notes.nth(1).focus();
    await p.keyboard.press('Enter');
    await p.keyboard.press('Tab');
    await p.keyboard.press('Space');
    await p.waitForTimeout(100);
    // Tap notes marks the picked notes; the focus stayed in the picture.
    assert.equal(await p.locator('.pan-wrap .pan-note.highlight').count(), 2, 'Enter and Space each picked a note');
    assert.ok(await p.evaluate(() => document.activeElement?.classList?.contains('pan-note')), 'focus is still on a note');
    await p.locator('[data-action="toggle-discover-mode"]', { hasText: 'All chords' }).click();
  });
  await step('the Playlists tab opens, with New playlist', first, async p => {
    await p.click('[data-action="hp-playlists"]');
    await p.waitForURL(/\/playlists$/);
    await p.locator('[data-action="prog-new-open"]').waitFor();
  });
  await step('the Songs tab opens, with songs and the way in for a chord sheet', first, async p => {
    await p.click('[data-action="hp-songs"]');
    await p.waitForURL(/\/songs$/);
    await p.locator('[data-action="song-open"]').first().waitFor();
    await p.locator('[data-action="cs-open"]').waitFor();
  });
  await step('a song opens and plays', first, async p => {
    await p.locator('[data-action="song-open"]').first().click();
    await p.locator('[data-action="song-play"]').waitFor();
    assert.ok(await p.locator('[data-action="song-step"]').count() > 0, 'the song has notes to tap');
    await p.click('[data-action="song-play"]');
    await p.waitForTimeout(300);
    // The tab follows the music under the instrument: the picture stays in
    // view (the framed top block) and the playing line sits just below it.
    if (await p.locator('.song-tab').count()) {
      const pos = await p.evaluate(() => ({
        stage: document.querySelector('.song-top.is-framed .song-stage')?.getBoundingClientRect().top ?? -1,
        topBottom: document.querySelector('.song-top.is-framed')?.getBoundingClientRect().bottom ?? -1,
        line: document.querySelector('.tab-line.is-current-line')?.getBoundingClientRect().top ?? -1,
      }));
      assert.ok(pos.stage >= 0 && pos.stage < 120, `the instrument stays at the top (${pos.stage})`);
      assert.ok(pos.line >= pos.topBottom && pos.line - pos.topBottom < 40, `the playing line sits under it (${pos.line} vs ${pos.topBottom})`);
    }
    await p.click('[data-action="song-play"]');
    await p.click('[data-action="nav-back"]');
    await p.waitForURL(/\/songs$/);
    await p.locator('[data-action="song-open"]').first().waitFor();
  });
  await step('Settings opens from the menu and a setting changes', first, async p => {
    await p.click('[data-action="menu-open"]');
    await p.click('[data-action="open-settings"]');
    await p.locator('[data-action="set-theme"]').first().waitFor();
    await p.locator('[data-action="set-theme"]', { hasText: 'Light' }).click();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
    await p.locator('[data-action="open-sign-in"]').waitFor();
    await p.click('[data-action="nav-back"]');
    await p.waitForURL(/\/songs$/);
    await p.locator('[data-action="song-open"]').first().waitFor();
  });
  await first.ctx.close();

  // ── One deep link per instrument family ───────────────────────────────────
  const links = catalogueLinks();
  for (const family of LINK_FAMILIES) {
    const link = links.find(l => l.family === family);
    assert.ok(link, `no catalogue link for ${family}`);
    const d = await guest(family);
    await step(`${link.path} opens with its picture`, d, async p => {
      await p.goto(app.base + link.path);
      await p.locator('.appbar').first().waitFor();
      await pictureShown(p);
      assert.equal(new URL(p.url()).pathname, link.path);
    });
    await step(`${link.path}/chords lists chords and one plays`, d, async p => {
      await p.goto(`${app.base}${link.path}/chords`);
      await pictureShown(p);
      const chords = p.locator('[data-action="select-chord"], [data-action="oc-chord-select"]');
      await chords.first().waitFor();
      assert.ok(await chords.count() > 1, 'chords are listed');
      await chords.nth(1).click();
      await p.locator('[data-action="play-chord"], [data-action="oc-play-arp"]').first().click();
      await pictureShown(p);
    });
    await step(`${family}: the Playlists tab opens`, d, async p => {
      await p.locator('[data-action="hp-playlists"], [data-action="oc-tab"][data-tab="playlists"]').first().click();
      await p.locator('[data-action="prog-new-open"]').waitFor();
    });
    await step(`${family}: the Songs tab opens`, d, async p => {
      await p.locator('[data-action="hp-songs"], [data-action="oc-tab"][data-tab="songs"]').first().click();
      await p.waitForURL(/\/songs$/);
      await p.locator('#pl-sec-songs').waitFor();
    });
    await d.ctx.close();
  }

  // ── Links that aren't in the catalogue ────────────────────────────────────
  const odd = await guest('odd links');
  await step('an unknown tuning opens the picker, not a blank page', odd, async p => {
    await p.goto(`${app.base}/kalimba/no-such-kalimba`);
    await p.locator('[data-action="open-link"]').first().waitFor();
  });
  await step('a share code that does not exist says so', odd, async p => {
    await p.goto(`${app.base}/s/NOPE1234`);
    await p.locator('.appbar').first().waitFor();
    await p.getByText('No shared instrument has that code').waitFor();
  });
  await odd.ctx.close();

  // ── Hostile input (regression: PR #81) ────────────────────────────────────
  // A note name or instrument name with markup in it must be shown as text
  // (or dropped), never run: from a custom link's query and from an
  // instrument shared by code.
  const HOSTILE = 'D3"><img src=x onerror="window.__pwned=(window.__pwned||0)+1"><svg onload="window.__pwned=1">';
  const pwned = async p => {
    await p.waitForTimeout(250); // an onerror would have fired by now
    assert.equal(await p.evaluate(() => window.__pwned), undefined, 'markup from outside ran as script');
    assert.equal(await p.locator('#app img[src="x"], #app [onerror], #app [onload]').count(), 0, 'markup from outside reached the page');
  };
  const hostile = await guest('hostile');
  for (const tab of ['', '/chords']) {
    await step(`a custom link with markup in its notes and name is harmless (${tab || 'pan'})`, hostile, async p => {
      const q = new URLSearchParams({ ding: HOSTILE, top: `A3,${HOSTILE},C4,D4,E4,F4,G4,A4`, bottom: HOSTILE, name: `Evil ${HOSTILE}`, tc: '8', bc: '2' });
      await p.goto(`${app.base}/handpan/custom${tab}?${q}`);
      await pictureShown(p);
      await pwned(p);
    });
  }
  for (const family of ['tongue-drum', 'kalimba']) {
    await step(`the same link as a ${family} is harmless`, hostile, async p => {
      const q = new URLSearchParams({ ding: HOSTILE, top: `A3,${HOSTILE},C4,D4`, name: HOSTILE });
      await p.goto(`${app.base}/${family}/custom?${q}`);
      await p.locator('.appbar').first().waitFor();
      await pwned(p);
    });
  }
  await step('an instrument shared by code with markup in it is harmless', hostile, async p => {
    server.shared.set('EVIL1234', {
      id: 'x', family: 'handpan', name: `Shared ${HOSTILE}`,
      layout: { id: 'custom', name: HOSTILE, isCustom: true, top: { ding: HOSTILE, capacity: 4, slots: [{ note: 'A3' }, { note: HOSTILE }, { note: 'C4' }, { note: 'D4' }] }, bottom: { slots: [{ note: HOSTILE }], capacity: 1 }, pos: { ding: { x: '250"><script>window.__pwned=1</script>', y: 250 } } },
    });
    await p.goto(`${app.base}/s/EVIL1234`);
    await pictureShown(p);
    await pwned(p);
    server.shared.set('EVIL5678', { id: 'y', family: 'ocarina', name: HOSTILE, notes: [60, 62, 64], holes: [], fingerings: {}, maker: HOSTILE, chartId: HOSTILE });
    await p.goto(`${app.base}/s/EVIL5678`);
    await p.locator('.appbar').first().waitFor();
    await pwned(p);
  });
  hostile.problems.splice(0);
  await hostile.ctx.close();
} catch (err) {
  failed = true;
  console.error(err?.stack ?? err);
} finally {
  await browser.close();
  await app.close();
}
console.log(`\n${run.passed} passed${failed ? ', 1 failed' : ''}`);
process.exit(failed ? 1 : 0);
