// The makers programme's pure parts (js/makers.js; docs/makers-programme.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAKER_FAMILIES, MAKER_RESERVED_SLUGS, MAKER_LIMITS, makerSlug, makerSlugError, makerWebsite, makerWebsiteLabel, makerLogoOk,
  validateMakerProfile, makerFormFrom, makerPlaceLine, makerInitials, makerStatusText, makerCountries, makerCountryName,
  withoutMadeBy, sharedOpening, madeByToKeep, makerPagePath, makerLinkPreview,
} from '../js/makers.js';
import { LINK_FAMILIES, linkPreview, withLinkPreview } from '../js/links.js';
import { SAVE_ACTIONS, SAVE_TEXTS } from '../js/store.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const good = { name: ' Ilze  Pans ', kind: 'maker', place: 'Cēsis', country: 'lv', website: 'ilzepans.lv', families: ['handpan'], story: 'One at a time.', story_lang: 'en' };

test('a page address from a name', () => {
  assert.equal(makerSlug('Ilze Pans'), 'ilze-pans');
  assert.equal(makerSlug('Cēsu Skaņa & Co.'), 'cesu-skana-and-co');
  assert.equal(makerSlug('  --Weird__name!! '), 'weird-name');
  assert.ok(makerSlug('x'.repeat(80)).length <= 40);
  assert.equal(makerSlugError('ilze-pans'), '');
  assert.ok(makerSlugError('ab'));
  assert.ok(makerSlugError('-abc'));
  assert.ok(makerSlugError('Has Space'));
  for (const s of MAKER_RESERVED_SLUGS) assert.ok(makerSlugError(s) || s.length < 3, s);
});

test('the reserved addresses and the rules match the database migration', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261121_makers.sql', import.meta.url), 'utf8');
  for (const s of MAKER_RESERVED_SLUGS) assert.ok(sql.includes(`'${s}'`), `the database reserves ${s}`);
  // The families check, as replaced by the latest migration that sets it.
  const fams = readFileSync(new URL('../supabase/migrations/20261122_makers_recorder.sql', import.meta.url), 'utf8');
  for (const f of MAKER_FAMILIES) assert.ok(fams.includes(`'${f.id}'`), f.id);
  assert.ok(sql.includes(`char_length(story) <= ${MAKER_LIMITS.story}`));
  assert.ok(sql.includes(`char_length(logo) <= ${MAKER_LIMITS.logoChars}`));
  assert.ok(sql.includes(`char_length(name) between 2 and ${MAKER_LIMITS.name}`));
  assert.deepEqual(MAKER_FAMILIES.map(f => f.id).sort(), [...LINK_FAMILIES].sort(), 'every instrument family a maker can make');
});

test('websites: https only, nothing that could run', () => {
  assert.equal(makerWebsite('ilzepans.lv'), 'https://ilzepans.lv');
  assert.equal(makerWebsite('http://ilzepans.lv/handpans/'), 'https://ilzepans.lv/handpans');
  assert.equal(makerWebsite(' https://www.ilzepans.lv '), 'https://www.ilzepans.lv');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.lv', 'localhost', 'https://user:pw@x.lv', 'not a site']) {
    assert.equal(makerWebsite(bad), '', bad);
  }
  assert.doesNotMatch(makerWebsite('https://x.lv/"><script>'), /["<>\s]/, 'what stays is encoded');
  assert.equal(makerWebsite(''), '');
  assert.equal(makerWebsiteLabel('https://www.ilzepans.lv/handpans/'), 'ilzepans.lv/handpans');
});

test('logos: a small raster picture only', () => {
  assert.equal(makerLogoOk(PNG), true);
  assert.equal(makerLogoOk('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(makerLogoOk('https://example.com/logo.png'), false);
  assert.equal(makerLogoOk('data:image/png;base64,' + 'A'.repeat(MAKER_LIMITS.logoChars)), false);
  assert.equal(makerLogoOk('data:image/png;base64,AAA" onerror="x'), false);
});

test('the profile form is checked and tidied', () => {
  const v = validateMakerProfile(good);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.deepEqual(v.value, {
    slug: 'ilze-pans', name: 'Ilze Pans', kind: 'maker', place: 'Cēsis', country: 'LV', website: 'https://ilzepans.lv',
    story: 'One at a time.', story_lang: 'en', families: ['handpan'], logo: '', listed: true, request_note: '',
  });
  const bad = validateMakerProfile({ name: 'x', website: 'javascript:1', families: ['theremin'], country: 'ZZ', story: 'x'.repeat(1300), logo: 'nope' });
  assert.equal(bad.ok, false);
  for (const k of ['name', 'website', 'families', 'country', 'story', 'logo']) assert.ok(bad.errors[k], k);
  assert.ok(validateMakerProfile({ ...good, slug: 'oakhum' }).errors.slug);
  assert.equal(validateMakerProfile({ ...good, kind: 'emperor' }).value.kind, 'maker');
  assert.equal(validateMakerProfile({ ...good, story: '', story_lang: 'en' }).value.story_lang, '', 'no language without a story');
  // A row from the server fills the form and comes back the same.
  const row = { ...v.value, status: 'approved' };
  assert.deepEqual(validateMakerProfile(makerFormFrom(row)).value, v.value);
  assert.equal(makerFormFrom(null).listed, true);
});

test('names, places and status texts', () => {
  assert.equal(makerPlaceLine({ kind: 'maker', place: 'Cēsis', country: 'LV' }), 'Maker · Cēsis, Latvia');
  assert.equal(makerPlaceLine({ kind: 'shop', country: 'EE' }), 'Shop · Estonia');
  assert.equal(makerPlaceLine({ kind: 'maker' }), 'Maker');
  assert.equal(makerInitials('Ilze Pans'), 'IP');
  assert.equal(makerInitials('oakhum'), 'OA');
  assert.equal(makerInitials(''), '?');
  assert.equal(makerCountryName('LV'), 'Latvia');
  const list = makerCountries();
  assert.ok(list.length > 150 && list.some(c => c.code === 'LV') && new Set(list.map(c => c.code)).size === list.length);
  assert.equal(makerStatusText({ status: 'approved' }).tone, 'ok');
  assert.equal(makerStatusText({ status: 'rejected', status_note: 'Add your website' }).body, 'Add your website');
  assert.equal(makerStatusText({ status: 'suspended' }).tone, 'warn');
  assert.equal(makerStatusText(null), null);
  assert.equal(makerPagePath('ilze-pans'), '/makers/ilze-pans');
});

test('who made it comes only from the server\'s answer, never from shared data', () => {
  const data = { name: 'D Kurd 9', madeBy: { slug: 'famous', name: 'Someone Famous' }, layout: { id: 'D-Kurd', madeBy: { slug: 'famous', name: 'Someone Famous' } } };
  const clean = withoutMadeBy(data);
  assert.equal(clean.madeBy, undefined);
  assert.equal(clean.layout.madeBy, undefined);
  assert.equal(data.layout.madeBy.slug, 'famous', 'the argument is not changed');

  const none = sharedOpening({ data, code: 'abc234', maker: null });
  assert.equal(none.madeBy, null);
  assert.equal(none.data.layout.madeBy, undefined);
  assert.equal(none.code, 'ABC234');

  const o = sharedOpening({ data, code: 'SER222', serial: '17', maker: { slug: 'ilze-pans', name: 'Ilze Pans', kind: 'maker', website: 'javascript:alert(1)', logo: 'data:image/svg+xml;base64,AA==', story: 'Hi' } });
  assert.equal(o.madeBy.name, 'Ilze Pans');
  assert.equal(o.madeBy.website, '', 'a website that isn\'t https is dropped');
  assert.equal(o.madeBy.logo, '', 'so is a logo that isn\'t a raster picture');
  assert.equal(o.serial, '17');
  assert.deepEqual(madeByToKeep(o.madeBy), { slug: 'ilze-pans', name: 'Ilze Pans', kind: 'maker', code: 'SER222' });
  assert.equal(madeByToKeep(null), null);
  // An older server answers with the instrument alone.
  assert.equal(sharedOpening({ data: { name: 'x' } }, 'abc234').code, 'ABC234');
  assert.equal(sharedOpening(null), null);
  assert.equal(sharedOpening({ data: 'nope' }), null);
  assert.equal(sharedOpening({ data, maker: { slug: 5 } }).madeBy, null);
});

test('the link preview of a code names the instrument and its maker, escaped', () => {
  const base = linkPreview('/s/ABC234');
  assert.equal(makerLinkPreview(null, base), base);
  assert.equal(makerLinkPreview({ name: '' }, base), base);
  const p = makerLinkPreview({ name: 'D Kurd 9', family: 'handpan', maker: 'Ilze Pans', serial: '17' }, base);
  assert.equal(p.title, 'D Kurd 9 by Ilze Pans · Oakhum');
  assert.match(p.description, /^Made by Ilze Pans\. .*handpan \(no\. 17\)/);
  assert.equal(p.image, '/og/handpan.jpg');
  assert.equal(makerLinkPreview({ name: 'Blue', family: 'ocarina', maker: null }, base).title, 'Blue · Oakhum');
  assert.equal(makerLinkPreview({ name: 'X', family: '../../evil' }, base).image, base.image);
  const html = withLinkPreview('<head><title>Oakhum</title></head>', makerLinkPreview({ name: 'A', family: 'handpan', maker: '"><script>$&' }, base), 'https://o', 'https://o/s/A');
  assert.ok(!html.includes('<script>') && !html.includes('"><'), html);
});

test('asking for the maker role is a save action with its own words', () => {
  assert.equal(SAVE_ACTIONS['maker-start'], 'maker');
  assert.match(SAVE_TEXTS.maker.title, /maker page/);
});
