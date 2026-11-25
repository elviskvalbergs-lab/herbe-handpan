// The help centre must not drift from the app (docs/help-centre.md, and
// "Help and docs" in CLAUDE.md). These tests fail when:
//  - a feature in js/features.js has no help article, or the article does not
//    say it covers that feature;
//  - a feature name or UI label in the registry is not in the app's source
//    any more (it was renamed in the app but not here);
//  - an article uses Markdown outside the subset, names a feature, tab,
//    deep link, article, anchor or picture that does not exist;
//  - an article has not been checked against the app for too long.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, UI_LABELS, HELP_SCREENS, FEATURE_FAMILIES, featureName } from '../js/features.js';
import { helpParse, helpPassages, helpMarkdown, helpHtml, helpSort, helpText, HELP_SECTIONS } from '../js/helpdoc.js';
import { parseLink, LINK_TABS, LINK_FAMILIES } from '../js/links.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'help', 'en');
const files = readdirSync(DIR).filter(f => f.endsWith('.md')).sort();
const articles = files.map(f => ({ file: f, ...helpParse(readFileSync(join(DIR, f), 'utf8'), `help/en/${f}`) }));
const byId = new Map(articles.map(a => [a.id, a]));
const appSource = readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'features.js')
  .map(f => readFileSync(join(ROOT, 'js', f), 'utf8')).join('\n');
const shots = JSON.parse(readFileSync(join(ROOT, 'help', 'screenshots.json'), 'utf8'));

// How long an article may go without someone checking it against the app.
const VERIFY_DAYS = 180;

test('every article parses, and its id is its file name', () => {
  assert.ok(articles.length >= 25);
  for (const a of articles) assert.equal(`${a.id}.md`, a.file);
  assert.equal(byId.size, articles.length);
});

test('every feature has a help article that says it covers the feature', () => {
  const ids = new Set();
  for (const f of FEATURES) {
    assert.ok(!ids.has(f.id), `feature id ${f.id} is used twice`);
    ids.add(f.id);
    const a = byId.get(f.help);
    assert.ok(a, `feature "${f.id}" points to help article "${f.help}", which does not exist`);
    assert.ok(a.features.includes(f.id), `help/en/${a.file} must list "${f.id}" in its features (js/features.js says it explains it)`);
    assert.ok(f.instruments.length && f.instruments.every(i => FEATURE_FAMILIES.includes(i)), `feature ${f.id}: instruments`);
    if (f.link) assert.ok(f.instruments.some(fam => LINK_TABS[fam].includes(f.link)), `feature ${f.id}: "${f.link}" is not a link tab (js/links.js LINK_TABS) of any of its instruments`);
  }
  for (const id of Object.keys(UI_LABELS)) assert.ok(!ids.has(id), `"${id}" is both a feature and a label`);
});

test('the families in the registry are the app’s', () => {
  assert.deepEqual([...FEATURE_FAMILIES].sort(), [...LINK_FAMILIES].sort());
});

test('feature names and labels are written as the app shows them', () => {
  // As UI text: inside quotes or between tags (">Label<", "} Label</b"), or
  // a sentence the app builds ("Keep this ${word}"), never in a comment. So
  // a word that survives only in a comment or a longer phrase does not pass.
  // A name the app takes from the registry itself (featureName('help')) passes.
  const src = appSource.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    .replace(/&amp;/g, '&').replace(/\\'/g, '’');
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shown = t => new RegExp(`(['"\`>]|\\}\\s)${esc(t)}(['"\`<]|\\s\\$\\{)`).test(src);
  for (const f of FEATURES) assert.ok(shown(f.name) || src.includes(`featureName('${f.id}')`), `feature "${f.id}": the app does not show "${f.name}" any more. Rename it in js/features.js and in the articles that use it.`);
  for (const [id, text] of Object.entries(UI_LABELS)) assert.ok(shown(text), `label "${id}": the app does not show "${text}" any more. Rename it in js/features.js and in the articles that use it.`);
});

test('articles only mention features and labels that are used', () => {
  // A label nobody mentions is dead weight that still has to be kept in step.
  const used = new Set();
  const walk = parts => parts.forEach(p => p.t === 'label' && used.add(p.id));
  for (const a of articles) for (const b of a.blocks) (b.t === 'list' ? b.items : [b.parts ?? []]).forEach(walk);
  for (const id of Object.keys(UI_LABELS)) assert.ok(used.has(id), `label "${id}" in js/features.js is not used by any article: remove it`);
  assert.equal(featureName('no-such-thing'), null);
});

test('deep links, article links and anchors all lead somewhere', () => {
  for (const a of articles) {
    if (a.app && a.app !== '/play') {
      const link = parseLink(a.app.split('?')[0], a.app.split('?')[1] ? `?${a.app.split('?')[1]}` : '');
      assert.ok(link && link.kind !== 'shared', `help/en/${a.file}: app link ${a.app} is not a link the app knows`);
    }
    const links = [];
    const walk = parts => parts.forEach(p => p.t === 'link' && links.push(p.href));
    for (const b of a.blocks) (b.t === 'list' ? b.items : [b.parts ?? []]).forEach(walk);
    for (const href of links) {
      const m = /^\/help\/([a-z0-9-]+)(?:#([a-z0-9-]+))?$/.exec(href);
      if (m) {
        const to = byId.get(m[1]);
        assert.ok(to, `help/en/${a.file}: link to ${href}, but there is no article "${m[1]}"`);
        if (m[2]) assert.ok(to.anchors.includes(m[2]), `help/en/${a.file}: link to ${href}, but "${m[1]}" has no #${m[2]}`);
      } else {
        assert.ok(['/help', '/privacy', '/request', '/makers'].includes(href), `help/en/${a.file}: link ${href} is not a help article or a known page of the site`);
      }
    }
  }
});

test('every screen with a help entry opens an article', () => {
  for (const [screen, id] of Object.entries(HELP_SCREENS)) assert.ok(byId.has(id), `HELP_SCREENS.${screen} points to "${id}", which does not exist`);
  // The keys the app can ask for (js/app.js helpScreenKey) are all listed.
  const fn = /function helpScreenKey\(\) \{[\s\S]*?\n\}/.exec(appSource)?.[0];
  assert.ok(fn, 'helpScreenKey not found in js/app.js');
  const asked = [...fn.matchAll(/(?:return|\?|:) '([a-z]+)'/g)].map(m => m[1]);
  assert.ok(asked.length >= 8);
  for (const key of asked) assert.ok(HELP_SCREENS[key], `js/app.js helpScreenKey can return '${key}', which HELP_SCREENS (js/features.js) does not list`);
});

test('every "?" in the app opens an article that exists, at an anchor that exists', () => {
  const calls = appSource.match(/uiHelp\(/g) ?? [];
  const literal = [...appSource.matchAll(/uiHelp\('([a-z0-9-]+)'(?:, '([a-z0-9-]+)')?\)/g)];
  // The definition is the one call that is not literal.
  assert.equal(literal.length, calls.length - 1, 'every uiHelp(…) call takes literal ids, so it can be checked here');
  assert.ok(literal.length >= 25, `only ${literal.length} "?" buttons found`);
  for (const [, id, anchor] of literal) {
    const a = byId.get(id);
    assert.ok(a, `uiHelp('${id}'): there is no article "${id}"`);
    if (anchor) assert.ok(a.anchors.includes(anchor), `uiHelp('${id}', '${anchor}'): "${id}" has no #${anchor}`);
  }
});

test('pictures are made by the script, and every one is used', () => {
  const names = new Set(shots.shots.map(s => s.name));
  const used = new Set();
  for (const a of articles) for (const b of a.blocks) if (b.t === 'img') {
    used.add(b.name);
    assert.ok(names.has(b.name), `help/en/${a.file}: picture "${b.name}" is not in help/screenshots.json`);
    assert.ok(existsSync(join(ROOT, 'help', 'img', `${b.name}.jpg`)), `help/img/${b.name}.jpg is missing: run node scripts/help-screenshots.mjs`);
    assert.ok(b.alt.length >= 10, `help/en/${a.file}: picture "${b.name}" needs a real description`);
  }
  for (const n of names) assert.ok(used.has(n), `help/screenshots.json makes "${n}", but no article shows it`);
  for (const f of readdirSync(join(ROOT, 'help', 'img'))) assert.ok(names.has(f.replace(/\.jpg$/, '')), `help/img/${f} is not made by help/screenshots.json: pictures are never added by hand`);
});

test('articles are short, plain and complete', () => {
  for (const a of articles) {
    assert.ok(a.title.length <= 70, `${a.file}: title too long`);
    assert.ok(a.summary.length >= 40 && a.summary.length <= 220, `${a.file}: summary should be one or two sentences (${a.summary.length} characters)`);
    assert.ok(a.anchors.length >= 1, `${a.file}: needs at least one ## heading with an anchor`);
    if (a.type === 'howto') assert.ok(a.blocks.some(b => b.t === 'list' && b.ordered), `${a.file}: a how-to needs numbered steps`);
    const passages = helpPassages(a);
    for (const p of passages) if (p.id) assert.ok(p.text.trim(), `${a.file}: #${p.id} has no text under it`);
    assert.ok(helpMarkdown(a).length > 200, `${a.file}: too short to be useful`);
    assert.ok(!/\{\{|\}\}/.test(helpMarkdown(a)));
  }
});

test('each article was checked against the app recently', () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const a of articles) {
    assert.ok(a.verified <= today, `${a.file}: verified ${a.verified} is in the future`);
    const days = (Date.parse(today) - Date.parse(a.verified)) / 86400000;
    assert.ok(days <= VERIFY_DAYS, `${a.file}: last checked against the app ${Math.round(days)} days ago. Open the screens it describes, fix what changed, then set "verified" to today.`);
  }
});

test('every section has an article, and the order is stable', () => {
  const sorted = helpSort(articles);
  for (const s of HELP_SECTIONS) assert.ok(sorted.some(a => a.section === s.id), `section "${s.id}" has no article`);
  assert.equal(sorted[0].id, 'set-up-your-instrument');
});

test('the parser refuses what the app and the site would show differently', () => {
  const head = '---\nid: x\ntitle: T\nsummary: S\nsection: start\ntype: faq\naudience: players\ninstruments: all\nfeatures: none\nverified: 2026-01-01\n---\n';
  assert.throws(() => helpParse(`${head}## No anchor\ntext`), /stable anchor/);
  assert.throws(() => helpParse(`${head}## A {#a}\n| a | b |`), /unsupported/);
  assert.throws(() => helpParse(`${head}## A {#a}\nsome \`code\``), /unsupported/);
  assert.throws(() => helpParse(`${head}## A {#a}\n{{nope}}`), /not a feature or label/);
  assert.throws(() => helpParse(`${head}## A {#a}\nx\n## B {#a}\ny`), /twice/);
  assert.throws(() => helpParse(head.replace('features: none', 'features: nope') + '## A {#a}\nx'), /unknown feature/);
  const ok = helpParse(`${head}Intro with {{chords}}.\n\n## A question? {#a}\n1. One\n2. Two **bold** [link](/help/chords#play)\n\n> A note`);
  assert.equal(ok.blocks[0].parts.find(p => p.t === 'label').v, featureName('chords'));
  assert.equal(ok.blocks[2].items.length, 2);
  assert.match(helpHtml(ok), /data-action="help-open" data-id="chords" data-anchor="play"/);
  assert.match(helpHtml(ok), /<h3 class="help-h" id="help-a">/);
  assert.equal(helpText(ok.blocks[1].parts), 'A question?');
});
