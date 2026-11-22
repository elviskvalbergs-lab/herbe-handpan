// The makers programme's pure parts (js/makers.js; docs/makers-programme.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAKER_FAMILIES, MAKER_RESERVED_SLUGS, MAKER_LIMITS, makerSlug, makerSlugError, makerWebsite, makerWebsiteLabel, makerLogoOk,
  validateMakerProfile, makerFormFrom, makerPlaceLine, makerInitials, makerStatusText, makerCountries, makerCountryName,
  withoutMadeBy, sharedOpening, madeByToKeep, makerPagePath, makerLinkPreview,
  makerCodeUrl, makerCodeLabel, makerViaFromSearch, parseSerials, qrPath, qrCardSvg, qrSheetSvgs, qrPrintDocument, MAKER_CARD_FORMATS,
  parseCsv, makerImportRows, MAKER_IMPORT_EXAMPLE, MAKER_IMPORT_LIMITS,
  makerEmbedUrl, makerEmbedCode,
  makerNum, makerStatsDays, makerDayLabel, makerDaysAgo, makerCodeStatText, makerStatsByInstrument, makerStatsCsv, MAKER_VIA_LABELS,
} from '../js/makers.js';
import { LINK_FAMILIES, linkPreview, withLinkPreview, parseLink, closestLinks } from '../js/links.js';
import { safeNoteName } from '../js/layoutfamilies.js';
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

// ── Phase 2: codes, the printed card, importing a list ──────────────────────
test('a code\'s link says where a scan came from', () => {
  assert.equal(makerCodeUrl('https://oakhum.com/', 'b7xk3n'), 'https://oakhum.com/s/B7XK3N');
  assert.equal(makerCodeUrl('https://oakhum.com', 'B7XK3N', 'qr'), 'https://oakhum.com/s/B7XK3N?via=qr');
  assert.equal(makerCodeUrl('https://oakhum.com', 'B7XK3N', 'nonsense'), 'https://oakhum.com/s/B7XK3N');
  assert.equal(makerCodeLabel('https://www.oakhum.com', 'B7XK3N'), 'oakhum.com/s/B7XK3N');
  assert.equal(makerViaFromSearch('?via=nfc'), 'nfc');
  assert.equal(makerViaFromSearch('?via=<script>'), null);
  assert.equal(makerViaFromSearch(''), null);
  // The app still reads the link, with or without the mark.
  assert.equal(parseLink('/s/B7XK3N', '?via=qr').code, 'B7XK3N');
});

test('serial numbers as a maker types them', () => {
  assert.deepEqual(parseSerials('17, 18\n20-22').serials, ['17', '18', '20', '21', '22']);
  assert.deepEqual(parseSerials('001-003').serials, ['001', '002', '003'], 'leading zeros stay');
  assert.deepEqual(parseSerials('A-07; #12, 12').serials, ['A-07', '12'], 'a name with a hyphen is not a range; no repeats');
  assert.match(parseSerials('9-7').error, /backwards/);
  assert.match(parseSerials('1-9999').error, /At most 500/);
  assert.match(parseSerials('x'.repeat(41)).error, /too long/);
  assert.ok(parseSerials('  ').error);
  assert.equal(parseSerials('1-500').serials.length, 500);
});

// A tiny "QR code": the real ones come from the QR library in the browser.
const MODULES = [[true, true, false], [false, true, false], [true, false, true]];

test('the QR path draws exactly the dark squares', () => {
  const d = qrPath(MODULES, 0, 0, 3);
  assert.equal(d, 'M0 0h2v1h-2zM1 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1z');
  assert.equal(qrPath([[false]], 0, 0, 10), '');
});

test('the printed card: sizes, words, and nothing a name can break', () => {
  const card = { modules: MODULES, name: 'D Kurd 9', serial: '101', maker: 'Ilze Pans', logo: '', label: 'oakhum.com/s/B7XK3N' };
  const svg = qrCardSvg(card);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 85 55" width="85mm" height="55mm"/);
  for (const t of ['Scan to see what it can play', 'D Kurd 9', 'No. 101', 'Ilze Pans', 'oakhum.com/s/B7XK3N']) assert.ok(svg.includes(t), t);
  const label = qrCardSvg(card, 'label');
  assert.match(label, /viewBox="0 0 63\.5 38\.1"/);
  assert.ok(label.includes('oakhum.com/s/B7XK3N'), 'the address fits on a sticker too');
  assert.ok(!qrCardSvg({ ...card, serial: '', maker: '' }).includes('No.'));
  const evil = qrCardSvg({ ...card, name: '</text><script>alert(1)</script>', maker: '"><image href="x"/>', logo: 'javascript:alert(1)' });
  assert.ok(!evil.includes('<script>') && !evil.includes('<image'), 'text is escaped and a logo that isn\'t a picture is left out');
  assert.ok(qrCardSvg({ ...card, logo: PNG }).includes(`<image href="${PNG}"`));
  assert.ok(qrCardSvg({ ...card, name: 'A very long instrument name that would run off the card' }).includes('…'));
});

test('sheets: ten cards or 21 stickers to an A4 page, cut marks on cards only', () => {
  const cards = Array.from({ length: 23 }, (_, i) => ({ modules: MODULES, name: 'D Kurd 9', serial: String(100 + i), maker: 'Ilze Pans', label: 'oakhum.com/s/B7XK3N' }));
  const pages = qrSheetSvgs(cards, 'card');
  assert.equal(pages.length, 3);
  assert.equal((pages[0].match(/<g transform=/g) ?? []).length, 10);
  assert.equal((pages[2].match(/<g transform=/g) ?? []).length, 3);
  assert.ok(pages[0].includes('stroke-dasharray'));
  const labels = qrSheetSvgs(cards, 'label');
  assert.equal(labels.length, 2);
  assert.ok(!labels[0].includes('stroke-dasharray'));
  for (const f of Object.values(MAKER_CARD_FORMATS)) {
    assert.ok(f.cols * f.w + (f.cols - 1) * f.gapX <= 210 && f.rows * f.h + (f.rows - 1) * f.gapY <= 297, `${f.label} fit A4`);
  }
  // Every card is inside the page.
  for (const m of pages[0].matchAll(/translate\(([\d.]+) ([\d.]+)\)/g)) assert.ok(+m[1] >= 0 && +m[1] + 85 <= 210 && +m[2] >= 0 && +m[2] + 55 <= 297);
  const doc = qrPrintDocument(pages, 'D Kurd 9 <cards>');
  assert.match(doc, /@page\{size:A4;margin:0\}/);
  assert.ok(doc.includes('<title>D Kurd 9 &lt;cards&gt;</title>'));
  assert.equal((doc.match(/<svg /g) ?? []).length, 3);
});

test('CSV: commas, semicolons or tabs, quoted cells', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  assert.deepEqual(parseCsv('a;b\r\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('﻿a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv(''), []);
});

const tools = { parseLink, closestLinks, safeNoteName };

test('importing a list: each row says what it makes, or what is wrong with it', () => {
  const { rows, error } = makerImportRows(MAKER_IMPORT_EXAMPLE, tools);
  assert.equal(error, '');
  assert.deepEqual(rows.map(r => r.ok), [true, true, true], JSON.stringify(rows.map(r => r.error)));
  assert.deepEqual({ kind: rows[0].kind, scaleId: rows[0].scaleId, family: rows[0].family, serials: rows[0].serials }, { kind: 'scale', scaleId: 'D-Kurd', family: 'handpan', serials: ['101', '102', '103'] });
  assert.deepEqual({ kind: rows[1].kind, ding: rows[1].ding, top: rows[1].top.length, bottom: rows[1].bottom }, { kind: 'custom', ding: 'F3', top: 8, bottom: ['C3', 'Eb3'] });
  assert.equal(rows[2].family, 'kalimba');

  const bad = makerImportRows([
    'name,instrument,scale,ding,top,bottom,serials',
    ',handpan,d-kurd,,,,',
    'Odd,handpan,d-kurdd,,,,',
    'Note,handpan,,D3,A3 H3,,',
    'Nothing,handpan,,,,,',
    'Thing,theremin,,,,,',
    'Drum,tongue drum,,C4,D4 E4,G3,',
    'Flute,flute,,D4,E4,,',
    'Whistle,flute,tin-whistle-d,,,,',
    'Serials,handpan,d-kurd,,,,9-7',
    'Whistle,flute,tin-whistle-d,,,,',
  ].join('\n'), tools).rows;
  assert.deepEqual(bad.map(r => r.ok), [false, false, false, false, false, false, false, true, false, false]);
  assert.match(bad[0].error, /No name/);
  assert.match(bad[1].error, /No such scale: d-kurdd\. Did you mean d-kurd\?/);
  assert.match(bad[2].error, /H3 isn’t a note/);
  assert.match(bad[3].error, /Give a scale, or the notes/);
  assert.match(bad[4].error, /Unknown instrument: theremin/);
  assert.match(bad[5].error, /Only a handpan has bottom notes/);
  assert.match(bad[6].error, /Give the chart/);
  assert.deepEqual({ kind: bad[7].kind, chartId: bad[7].chartId }, { kind: 'chart', chartId: 'tin-whistle-d' });
  assert.match(bad[8].error, /backwards/);
  assert.match(bad[9].error, /The same name as row 9/);
  assert.equal(bad[1].line, 3, 'rows are numbered as in the file');
});

test('importing a list: no heading, other headings, and the limits', () => {
  assert.equal(makerImportRows('D Kurd 9,handpan,d-kurd', tools).rows[0].ok, true, 'without a heading the columns are in the usual order');
  const other = makerImportRows('Model;Type;Tuning;Serial numbers\nMy pan;handpan;D Kurd;1-2', tools).rows[0];
  assert.deepEqual({ ok: other.ok, scaleId: other.scaleId, serials: other.serials }, { ok: true, scaleId: 'D-Kurd', serials: ['1', '2'] });
  assert.ok(makerImportRows('', tools).error);
  assert.ok(makerImportRows('name,instrument', tools).error);
  const many = Array.from({ length: MAKER_IMPORT_LIMITS.rows + 1 }, (_, i) => `Pan ${i},handpan,d-kurd`).join('\n');
  assert.match(makerImportRows(many, tools).error, /At most 200 rows/);
  const serials = Array.from({ length: 5 }, (_, i) => `Pan ${i},handpan,d-kurd,,,,${i * 1000 + 1}-${i * 1000 + 500}`).join('\n');
  assert.match(makerImportRows(serials, tools).error, /At most 2000 serial numbers/);
  // Every note in a row passes safeNoteName, so nothing but note names reaches the picture.
  assert.equal(makerImportRows('X,handpan,,D3,"A3 <img>"', tools).rows[0].ok, false);
});

test('the scan-counting SQL takes only the events and sources the app sends', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261122_maker_codes_scans.sql', import.meta.url), 'utf8');
  for (const v of ['qr', 'nfc', 'embed']) assert.ok(sql.includes(`'${v}'`), v);
  for (const e of ['open', 'save', 'chords', 'songs']) assert.ok(sql.includes(`'${e}'`), e);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\b(ip|address)\s+(text|inet)\b/i, 'no column holds an address');
});

// ── Phase 3: stats ──────────────────────────────────────────────────────────
const STATS = {
  days: 7, since: '2026-11-15', until: '2026-11-21',
  totals: { opens: 15, devices: 6, saves: 1, chord_visits: 2, song_visits: 0, chords: 40, songs: 0 },
  by_day: [{ day: '2026-11-16', opens: 3, devices: 2 }, { day: '2026-11-21', opens: 12, devices: 4 }],
  by_via: { qr: 12, nfc: 3 },
  by_country: [],
  by_code: [
    { code: 'B7XK3N', instrument_id: 'hp-1', serial: '101', retired: false, opens: 12, devices: 4, saves: 1, chord_visits: 2, song_visits: 0, chords: 40, songs: 0, last_day: '2026-11-21' },
    { code: 'KURD22', instrument_id: 'hp-1', serial: null, retired: false, opens: 3, devices: 2, saves: 0, chord_visits: 0, song_visits: 0, chords: 0, songs: 0, last_day: '2026-11-16' },
    { code: 'PYGMY2', instrument_id: 'hp-2', serial: null, retired: true, opens: 0, devices: 0, saves: 0, chord_visits: 0, song_visits: 0, chords: 0, songs: 0, last_day: null },
  ],
};

test('stats: every day of the period, zeros included', () => {
  const days = makerStatsDays(STATS);
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(d => d.opens), [0, 3, 0, 0, 0, 0, 12]);
  assert.equal(days[0].day, '2026-11-15');
  assert.deepEqual(makerStatsDays(null), []);
  assert.equal(makerStatsDays({ since: '2026-10-28', until: '2026-11-02', by_day: [] }).length, 6, 'across a month end');
  assert.equal(makerDayLabel('2026-11-05'), '5 Nov');
  assert.equal(makerNum(12345), '12,345');
});

test('stats: what a code\'s row says', () => {
  assert.equal(makerCodeStatText(STATS.by_code[0], '2026-11-21'), '12 scans · saved · chords played · last scan today');
  assert.equal(makerCodeStatText(STATS.by_code[1], '2026-11-21'), '3 scans · last scan 5 days ago');
  assert.equal(makerCodeStatText({ opens: 1, saves: 3, last_day: '2026-11-20' }, '2026-11-21'), '1 scan · saved 3 times · last scan yesterday');
  assert.equal(makerCodeStatText(STATS.by_code[2], '2026-11-21'), 'Not scanned yet');
  assert.equal(makerCodeStatText(null), 'Not scanned yet');
  assert.equal(makerDaysAgo('2026-11-22', '2026-11-21'), '', 'never a day in the future');
});

test('stats: by instrument, most scanned first, and as a CSV', () => {
  const g = makerStatsByInstrument(STATS, { 'hp-1': 'D Kurd 9', 'hp-2': '=Pygmy, "low"' });
  assert.deepEqual(g.map(x => [x.name, x.opens, x.saves, x.codes.length]), [['D Kurd 9', 15, 1, 2], ['=Pygmy, "low"', 0, 0, 1]]);
  assert.equal(makerStatsByInstrument(STATS)[0].name, 'Instrument');
  const csv = makerStatsCsv(STATS, { 'hp-1': 'D Kurd 9', 'hp-2': '=Pygmy, "low"' }).trim().split('\n');
  assert.equal(csv.length, 4);
  assert.equal(csv[1], 'D Kurd 9,101,B7XK3N,12,4,1,2,0,40,0,2026-11-21,');
  assert.equal(csv[3], `"'=Pygmy, ""low""",,PYGMY2,0,0,0,0,0,0,0,,yes`, 'a name that looks like a formula is defused');
  for (const k of ['qr', 'nfc', 'link', 'embed']) assert.ok(MAKER_VIA_LABELS[k]);
});

// ── Phase 5: the embed ──────────────────────────────────────────────────────
test('the embed code is one iframe on the website\'s embed page, and can\'t be broken by a name', () => {
  assert.equal(makerEmbedUrl('https://oakhum.com/', 'b7xk3n'), 'https://oakhum.com/embed/s/B7XK3N');
  const code = makerEmbedCode('https://oakhum.com', 'B7XK3N', { name: 'D Kurd 9', maker: 'Ilze Pans' });
  assert.match(code, /^<iframe src="https:\/\/oakhum\.com\/embed\/s\/B7XK3N" title="D Kurd 9 by Ilze Pans, playable" width="100%" height="740" style="border:0;max-width:520px" loading="lazy"><\/iframe>$/);
  const evil = makerEmbedCode('https://oakhum.com', 'B7XK3N', { name: '"><script>alert(1)</script>' });
  assert.equal((evil.match(/</g) ?? []).length, 2, 'only the iframe\'s own tags');
  assert.ok(!evil.includes('"><script>'));
  assert.match(makerEmbedCode('https://oakhum.com', 'B7XK3N'), /title="Instrument, playable"/);
});
