// The makers programme (docs/makers-programme.md): the pure parts. Makers and
// shops ask for the maker role, set up a public profile, and their shared
// instruments show "Made by" to the buyer who opens them by code.
// Phase 2 adds codes, the printed card and the bulk import.
// No DOM and no network here, so the tests, the website and the link-preview
// middleware can use it. The screens are in js/makers-ui.js; the database
// rules these mirror are in supabase/migrations/20261121_makers.sql.

export const MAKER_FAMILIES = [
  { id: 'handpan', label: 'Handpans' },
  { id: 'tongue-drum', label: 'Tongue drums' },
  { id: 'kalimba', label: 'Kalimbas' },
  { id: 'ocarina', label: 'Ocarinas' },
  { id: 'flute', label: 'Flutes' },
  { id: 'recorder', label: 'Recorders' },
];
export const MAKER_KINDS = [{ value: 'maker', label: 'Maker' }, { value: 'shop', label: 'Shop' }];

// Addresses a maker page can't take (the website's own paths, and words
// that would read as Oakhum itself). The database refuses the same list.
export const MAKER_RESERVED_SLUGS = ['admin', 'oakhum', 'request', 'requests', 'makers', 'maker', 'new', 'edit', 'api', 'embed',
  'studio', 'play', 'privacy', 'terms', 'about', 'help', 'support', 'directory', 'instruments'];

export const MAKER_LIMITS = { name: 60, place: 80, website: 200, story: 1200, note: 600, logoChars: 90000, logoBytes: 60000, logoPx: 256 };

// ISO 3166-1 alpha-2 codes, for the country picker (names come from Intl).
const MAKER_COUNTRY_CODES = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ '
  + 'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ '
  + 'OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ '
  + 'UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW').split(' ');

// "LV" → "Latvia" (the code itself where the browser can't name it).
export function makerCountryName(code, locale = 'en') {
  if (!code) return '';
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code; } catch { return code; }
}

// [{ code, name }] sorted by name, for the picker.
export function makerCountries(locale = 'en') {
  return MAKER_COUNTRY_CODES.map(code => ({ code, name: makerCountryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// The address of a maker page from its name: "Ilze Pans" → "ilze-pans".
// Accents are folded (Cēsu → cesu); 3 to 40 characters.
export function makerSlug(text) {
  const s = String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 40).replace(/-+$/, '');
}

export function makerSlugError(slug) {
  if (!/^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(slug)) return 'Use 3 to 40 letters, digits or hyphens';
  if (MAKER_RESERVED_SLUGS.includes(slug)) return 'That address is taken';
  return '';
}

// "ilzepans.lv" → "https://ilzepans.lv". Only https links are kept; '' when
// it can't be one.
export function makerWebsite(text) {
  let s = String(text ?? '').trim();
  if (!s) return '';
  if (/^http:\/\//i.test(s)) s = 'https://' + s.slice(7);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) return '';
    const out = u.toString().replace(/\/$/, '');
    return /[\s<>"']/.test(out) || out.length > MAKER_LIMITS.website ? '' : out;
  } catch { return ''; }
}

// The website as people read it: "ilzepans.lv/handpans".
export function makerWebsiteLabel(url) {
  return String(url ?? '').replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
}

// A logo the database accepts: a small PNG, JPEG or WebP as a data URL.
export function makerLogoOk(dataUrl) {
  return typeof dataUrl === 'string' && dataUrl.length <= MAKER_LIMITS.logoChars
    && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
}

// Checks and tidies the profile form. Returns { ok, errors: { field: text },
// value }, value being what save_maker_profile takes.
export function validateMakerProfile(form) {
  const f = form ?? {};
  const errors = {};
  const name = String(f.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) errors.name = 'Give your workshop or shop’s name';
  else if (name.length > MAKER_LIMITS.name) errors.name = `At most ${MAKER_LIMITS.name} characters`;
  const slug = String(f.slug ?? '').trim().toLowerCase() || makerSlug(name);
  const slugErr = makerSlugError(slug);
  if (slugErr && !errors.name) errors.slug = slugErr;
  const kind = f.kind === 'shop' ? 'shop' : 'maker';
  const place = String(f.place ?? '').trim();
  if (place.length > MAKER_LIMITS.place) errors.place = `At most ${MAKER_LIMITS.place} characters`;
  const country = String(f.country ?? '').trim().toUpperCase();
  if (country && !MAKER_COUNTRY_CODES.includes(country)) errors.country = 'Choose a country';
  const rawSite = String(f.website ?? '').trim();
  const website = makerWebsite(rawSite);
  if (rawSite && !website) errors.website = 'That doesn’t look like a web address';
  const story = String(f.story ?? '').trim();
  if (story.length > MAKER_LIMITS.story) errors.story = `At most ${MAKER_LIMITS.story} characters (${story.length} now)`;
  const storyLang = /^[a-z]{2}$/.test(String(f.story_lang ?? '')) ? f.story_lang : '';
  const known = MAKER_FAMILIES.map(x => x.id);
  const families = [...new Set((f.families ?? []).filter(x => known.includes(x)))];
  if (!families.length) errors.families = 'Choose what you make or sell';
  const logo = f.logo || '';
  if (logo && !makerLogoOk(logo)) errors.logo = 'That picture can’t be used: try a PNG or JPEG';
  const note = String(f.request_note ?? '').trim();
  if (note.length > MAKER_LIMITS.note) errors.request_note = `At most ${MAKER_LIMITS.note} characters`;
  return {
    ok: Object.keys(errors).length === 0, errors,
    value: { slug, name, kind, place, country, website, story, story_lang: story ? storyLang : '', families, logo, listed: f.listed !== false, request_note: note },
  };
}

// The form for a maker's row (or an empty one).
export function makerFormFrom(maker) {
  const m = maker ?? {};
  return {
    slug: m.slug ?? '', name: m.name ?? '', kind: m.kind ?? 'maker', place: m.place ?? '', country: m.country ?? '',
    website: m.website ?? '', story: m.story ?? '', story_lang: m.story_lang ?? '', families: [...(m.families ?? [])],
    logo: m.logo ?? '', listed: m.listed !== false, request_note: m.request_note ?? '',
    slugEdited: !!m.slug,
  };
}

// "Maker · Cēsis, Latvia": the line under a maker's name.
export function makerPlaceLine(maker, locale = 'en') {
  if (!maker) return '';
  const where = [maker.place, makerCountryName(maker.country, locale)].filter(Boolean).join(', ');
  return [maker.kind === 'shop' ? 'Shop' : 'Maker', where].filter(Boolean).join(' · ');
}

// Two letters for a maker without a logo: "Ilze Pans" → "IP".
export function makerInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]];
  return letters.join('').toUpperCase();
}

// What the maker's own screen says for each status.
export function makerStatusText(maker) {
  const s = maker?.status;
  if (s === 'approved') return { tone: 'ok', title: 'Your page is live', body: 'Buyers who open your instruments see “Made by” with your name.' };
  if (s === 'pending') return { tone: 'wait', title: 'We’re looking at your request', body: 'Usually within two days. You can set everything up meanwhile; your page and “Made by” appear once it’s approved.' };
  if (s === 'rejected') return { tone: 'warn', title: 'Not yet', body: maker.status_note || 'Something is missing. Change your profile and send it again.' };
  if (s === 'suspended') return { tone: 'warn', title: 'Your page is hidden for now', body: maker.status_note || 'Write to us and we’ll sort it out. Your codes still open your instruments.' };
  return null;
}

export const MAKER_REPORT_REASONS = [
  { value: 'not-them', label: 'It isn’t really this maker' },
  { value: 'offensive', label: 'Something offensive' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
];

// ── Opening an instrument by code ────────────────────────────────────────────
// Who made an instrument is only ever what the server says for its code
// (open_shared_instrument). Shared data is written by whoever shared it, so
// anything in it that claims a maker is dropped on arrival.
export function withoutMadeBy(data) {
  if (!data || typeof data !== 'object') return data;
  const { madeBy, ...rest } = data;
  if (rest.layout && typeof rest.layout === 'object' && 'madeBy' in rest.layout) {
    const { madeBy: _, ...layout } = rest.layout;
    rest.layout = layout;
  }
  return rest;
}

// The answer of open_shared_instrument, made safe to use:
// { data, code, serial, madeBy } or null. An older server answers with the
// instrument alone (get_shared_instrument): pass it as { data }.
export function sharedOpening(res, code = null) {
  if (!res || !res.data || typeof res.data !== 'object') return null;
  const m = res.maker && typeof res.maker === 'object' && typeof res.maker.slug === 'string' && typeof res.maker.name === 'string' ? res.maker : null;
  const theCode = String(res.code ?? code ?? '').toUpperCase() || null;
  return {
    data: withoutMadeBy(res.data),
    code: theCode,
    serial: typeof res.serial === 'string' && res.serial ? res.serial : null,
    madeBy: m ? {
      slug: m.slug, name: m.name, kind: m.kind === 'shop' ? 'shop' : 'maker',
      place: m.place ?? '', country: m.country ?? '', website: makerWebsite(m.website), story: m.story ?? '', story_lang: m.story_lang ?? '',
      logo: makerLogoOk(m.logo) ? m.logo : '', code: theCode,
    } : null,
  };
}

// What a saved copy keeps of its maker: enough for the "Made by" row, not
// the logo or the story (those are read again when online).
export function madeByToKeep(madeBy) {
  if (!madeBy?.slug || !madeBy?.name) return null;
  return { slug: madeBy.slug, name: madeBy.name, kind: madeBy.kind === 'shop' ? 'shop' : 'maker', code: madeBy.code ?? null };
}

// The website's page of a maker.
export function makerPagePath(slug) { return `/makers/${encodeURIComponent(slug)}`; }

// A link preview for a code (middleware.js): "D Kurd 9 by Ilze Pans".
// card is shared_instrument_card's answer; base is the preview the link
// would get anyway (js/links.js).
export function makerLinkPreview(card, base, appName = 'Oakhum') {
  if (!card || typeof card.name !== 'string' || !card.name.trim()) return base;
  const name = card.name.trim().slice(0, 80);
  const maker = typeof card.maker === 'string' && card.maker.trim() ? card.maker.trim().slice(0, 60) : null;
  const what = maker ? `${name} by ${maker}` : name;
  const serial = typeof card.serial === 'string' && card.serial ? ` (no. ${card.serial.slice(0, 40)})` : '';
  const known = ['handpan', 'tongue-drum', 'kalimba', 'ocarina', 'flute'];
  return {
    title: `${what} · ${appName}`,
    description: `${maker ? `Made by ${maker}. ` : ''}Notes, chords, songs and play-along for this ${known.includes(card.family) ? card.family.replace('-', ' ') : 'instrument'}${serial}. Free, in your browser: open it and play.`,
    image: known.includes(card.family) ? `/og/${card.family}.jpg` : base.image,
  };
}

// ── Codes: links, serial numbers, where a scan came from ─────────────────────
export const MAKER_VIAS = ['qr', 'nfc', 'embed']; // anything else is a plain link

// The address a code opens. via marks the printed QR code ('qr') and the
// NFC tag ('nfc'), so the maker can tell them apart from a copied link.
export function makerCodeUrl(origin, code, via = null) {
  return `${String(origin ?? '').replace(/\/$/, '')}/s/${String(code).toUpperCase()}${MAKER_VIAS.includes(via) ? `?via=${via}` : ''}`;
}
// "oakhum.com/s/7KQ2PM": the address as printed on a card.
export function makerCodeLabel(origin, code) {
  return makerCodeUrl(origin, code).replace(/^https?:\/\/(www\.)?/, '');
}
// '?via=qr' → 'qr'; anything else → null.
export function makerViaFromSearch(search) {
  try { const v = new URLSearchParams(search ?? '').get('via'); return MAKER_VIAS.includes(v) ? v : null; } catch { return null; }
}

// Serial numbers from what a maker types: "17, 18, 20-25" or "A-07 A-08",
// one per line or separated by commas. A range of plain numbers is filled
// in, keeping leading zeros ("001-003" → 001, 002, 003). Each at most 40
// characters, no repeats. Returns { serials, error }.
export function parseSerials(text, { max = 500 } = {}) {
  const out = [];
  const seen = new Set();
  const add = s => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const part of String(text ?? '').split(/[,;\n\t]+/).map(x => x.trim().replace(/^#/, '')).filter(Boolean)) {
    const m = /^(\d{1,9})\s*(?:-|–|\.\.)\s*(\d{1,9})$/.exec(part);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      if (b < a) return { serials: [], error: `“${part}” runs backwards` };
      if (b - a >= max) return { serials: [], error: `At most ${max} at a time` };
      const pad = m[1].startsWith('0') ? m[1].length : 0;
      for (let n = a; n <= b; n++) add(String(n).padStart(pad, '0'));
    } else if (part.length > 40) {
      return { serials: [], error: `“${part.slice(0, 20)}…” is too long` };
    } else add(part);
    if (out.length > max) return { serials: [], error: `At most ${max} at a time` };
  }
  return { serials: out, error: out.length ? '' : 'Type at least one serial number' };
}

// ── The printed card ─────────────────────────────────────────────────────────
function mkEsc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// Text cut to fit a width (no text measuring without a DOM: about 0.55 em a letter).
function mkFit(text, widthMm, sizeMm) {
  const max = Math.max(4, Math.floor(widthMm / (sizeMm * 0.55)));
  const t = String(text ?? '');
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// A QR code's dark squares as one SVG path, drawn in a box of `size` at x, y.
// modules is a square array of rows of booleans (true = dark).
export function qrPath(modules, x, y, size) {
  const n = modules.length;
  const cell = size / n;
  const r = v => Math.round(v * 1000) / 1000;
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!modules[row][col]) continue;
      let run = 1;
      while (col + run < n && modules[row][col + run]) run++;
      d += `M${r(x + col * cell)} ${r(y + row * cell)}h${r(run * cell)}v${r(cell)}h-${r(run * cell)}z`;
      col += run - 1;
    }
  }
  return d;
}

export const MAKER_CARD_FORMATS = {
  // A business-card size for the case or the certificate; 2 × 5 on A4 with cut marks.
  card: { label: 'Cards', w: 85, h: 55, cols: 2, rows: 5, gapX: 10, gapY: 2, marks: true, hint: '85 × 55 mm, ten to an A4 sheet, with cut marks' },
  // Labels 63.5 × 38.1 mm, 3 × 7 on A4 (the common L7160 sheet).
  label: { label: 'Stickers', w: 63.5, h: 38.1, cols: 3, rows: 7, gapX: 2.5, gapY: 0, marks: false, hint: '63.5 × 38.1 mm, 21 to an A4 label sheet (L7160)' },
};

// One card as SVG markup (in millimetres): the QR code, "Scan to see what it
// can play", the instrument's name, its serial number, the maker and the
// address. Black on white, for any printer. card = { modules, name, serial,
// maker, logo, label }. With { inner: true } only the card's contents come
// back, to place on a sheet.
export function qrCardSvg(card, format = 'card', { inner = false } = {}) {
  const f = MAKER_CARD_FORMATS[format] ?? MAKER_CARD_FORMATS.card;
  const small = f.h < 45;
  const pad = small ? 3 : 5;
  // The code is big enough to scan from arm's length, and leaves the words room.
  const qr = small ? 27 : 36;
  const qy = (f.h - qr) / 2;
  const tx = pad + qr + (small ? 3 : 5);
  const tw = f.w - tx - pad;
  const sz = small ? { hint: 2.3, name: 3.7, serial: 2.6, maker: 2.8, url: 2.1 } : { hint: 2.8, name: 5, serial: 3.2, maker: 3.4, url: 2.5 };
  const logo = card.logo && makerLogoOk(card.logo) ? card.logo : '';
  const logoSize = small ? 5 : 7;
  let y = pad + sz.hint;
  const lines = [];
  lines.push(`<text x="${tx}" y="${y}" font-size="${sz.hint}" fill="#555">Scan to see what it can play</text>`);
  y += sz.name + (small ? 1.6 : 2.6);
  lines.push(`<text x="${tx}" y="${y}" font-size="${sz.name}" font-weight="700">${mkEsc(mkFit(card.name, tw, sz.name))}</text>`);
  if (card.serial) {
    y += sz.serial + (small ? 1.2 : 1.8);
    lines.push(`<text x="${tx}" y="${y}" font-size="${sz.serial}" fill="#333">No. ${mkEsc(mkFit(card.serial, tw - 6, sz.serial))}</text>`);
  }
  const bottom = f.h - pad;
  lines.push(`<text x="${tx}" y="${bottom}" font-size="${sz.url}" fill="#555" font-family="ui-monospace, Menlo, Consolas, monospace">${mkEsc(mkFit(card.label, tw, sz.url * 1.12))}</text>`);
  if (card.maker) {
    const my = bottom - sz.url - (small ? 2 : 3);
    if (logo) lines.push(`<image href="${mkEsc(logo)}" x="${tx}" y="${my - logoSize + 1}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`);
    const mx = logo ? tx + logoSize + 1.5 : tx;
    lines.push(`<text x="${mx}" y="${my}" font-size="${sz.maker}" font-weight="600">${mkEsc(mkFit(card.maker, tw - (logo ? logoSize + 1.5 : 0), sz.maker))}</text>`);
  }
  const body = `<rect width="${f.w}" height="${f.h}" fill="#fff"/><path d="${qrPath(card.modules, pad, qy, qr)}" fill="#000"/>${lines.join('')}`;
  if (inner) return body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" width="${f.w}mm" height="${f.h}mm" font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">${body}</svg>`;
}

// Cards laid out on A4 pages, one SVG per page, ready to print (the
// browser's Print makes the PDF). Cards get faint cut marks; label sheets
// don't, their labels are already cut.
export function qrSheetSvgs(cards, format = 'card') {
  const f = MAKER_CARD_FORMATS[format] ?? MAKER_CARD_FORMATS.card;
  const W = 210, H = 297;
  const per = f.cols * f.rows;
  const x0 = (W - f.cols * f.w - (f.cols - 1) * f.gapX) / 2;
  const y0 = (H - f.rows * f.h - (f.rows - 1) * f.gapY) / 2;
  const r = v => Math.round(v * 100) / 100;
  const pages = [];
  for (let p = 0; p < cards.length; p += per) {
    let g = '';
    cards.slice(p, p + per).forEach((card, i) => {
      const x = x0 + (i % f.cols) * (f.w + f.gapX), y = y0 + Math.floor(i / f.cols) * (f.h + f.gapY);
      g += `<g transform="translate(${r(x)} ${r(y)})">${qrCardSvg(card, format, { inner: true })}`;
      if (f.marks) g += `<rect width="${f.w}" height="${f.h}" fill="none" stroke="#bbb" stroke-width="0.15" stroke-dasharray="1 1"/>`;
      g += '</g>';
    });
    pages.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">${g}</svg>`);
  }
  return pages;
}

// The page that prints those sheets: nothing but the pages, at A4.
export function qrPrintDocument(pages, title = 'Oakhum cards') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${mkEsc(title)}</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:210mm;height:297mm;page-break-after:always;break-after:page}svg:last-child{page-break-after:auto;break-after:auto}@media screen{body{background:#ddd}svg{margin:8px auto;box-shadow:0 1px 6px rgba(0,0,0,.3);background:#fff}}</style>
</head><body>${pages.join('')}</body></html>`;
}

// ── Importing a list ─────────────────────────────────────────────────────────
export const MAKER_IMPORT_COLUMNS = ['name', 'instrument', 'scale', 'ding', 'top', 'bottom', 'serials'];
export const MAKER_IMPORT_LIMITS = { rows: 200, serials: 2000 };
export const MAKER_IMPORT_EXAMPLE = `name,instrument,scale,ding,top,bottom,serials
D Kurd 9,handpan,d-kurd,,,,101-103
Low Pygmy special,handpan,,F3,G3 Ab3 C4 Eb4 F4 G4 Ab4 C5,C3 Eb3,104
C major 17,kalimba,c-major-17,,,,
`;

// Rows of cells from pasted or uploaded text: commas, semicolons or tabs
// (whichever the first line uses), quotes around a cell that holds one.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n')[0] ?? '';
  const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter(r => r.some(c => c !== ''));
}

const MAKER_IMPORT_FAMILY_WORDS = {
  handpan: 'handpan', handpans: 'handpan', pan: 'handpan', pantam: 'handpan',
  'tongue-drum': 'tongue-drum', 'tongue drum': 'tongue-drum', tonguedrum: 'tongue-drum', drum: 'tongue-drum',
  kalimba: 'kalimba', kalimbas: 'kalimba', ocarina: 'ocarina', ocarinas: 'ocarina', flute: 'flute', flutes: 'flute', whistle: 'flute',
};

// Checks a pasted list and says, row by row, what would be made.
// tools = { parseLink, closestLinks, safeNoteName } from js/links.js and
// js/layoutfamilies.js (passed in so this file stays free of the catalogue).
// Returns { rows: [{ line, ok, error, name, family, kind: 'scale' | 'custom'
// | 'chart', scaleId, chartId, keyId, ding, top, bottom, serials, what }],
// error } where error is about the whole list (empty, too long).
export function makerImportRows(text, tools) {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], error: 'Paste a list, or choose a file' };
  const head = table[0].map(c => c.toLowerCase().replace(/[^a-z]/g, ''));
  const alias = { name: 'name', model: 'name', instrument: 'instrument', type: 'instrument', family: 'instrument', scale: 'scale', tuning: 'scale',
    ding: 'ding', lowest: 'ding', top: 'top', notes: 'top', bottom: 'bottom', serials: 'serials', serial: 'serials', serialnumbers: 'serials' };
  const hasHead = head.includes('name') || head.includes('model');
  const cols = hasHead ? head.map(h => alias[h] ?? null) : MAKER_IMPORT_COLUMNS;
  const body = hasHead ? table.slice(1) : table;
  if (!body.length) return { rows: [], error: 'The list has a heading but no rows' };
  if (body.length > MAKER_IMPORT_LIMITS.rows) return { rows: [], error: `At most ${MAKER_IMPORT_LIMITS.rows} rows at a time (this has ${body.length})` };
  const notesOf = cell => String(cell ?? '').split(/[\s,]+/).filter(Boolean);
  let serialTotal = 0;
  const rows = body.map((cells, i) => {
    const get = k => { const at = cols.indexOf(k); return at < 0 ? '' : (cells[at] ?? '').trim(); };
    const row = { line: i + (hasHead ? 2 : 1), ok: false, error: '', name: get('name').slice(0, 80), family: null, kind: null, serials: [], what: '' };
    const fail = msg => ({ ...row, error: msg });
    if (!row.name) return fail('No name');
    const family = MAKER_IMPORT_FAMILY_WORDS[get('instrument').toLowerCase()] ?? (get('instrument') ? null : 'handpan');
    if (!family) return fail(`Unknown instrument: ${get('instrument')}`);
    row.family = family;
    const layoutFamily = family === 'handpan' || family === 'tongue-drum' || family === 'kalimba';
    const slug = get('scale').toLowerCase().replace(/\s+/g, '-');
    if (slug) {
      const link = tools.parseLink(`/${family}/${slug}`);
      if (!link || link.kind === 'unknown' || link.kind === 'custom') {
        const near = tools.closestLinks(family, slug, 1)[0];
        const nearSlug = near ? String(near.path ?? near.slug ?? near).split('/').pop() : '';
        return fail(`No such ${layoutFamily ? 'scale' : 'chart'}: ${slug}${nearSlug ? `. Did you mean ${nearSlug}?` : ''}`);
      }
      if (link.kind === 'scale') Object.assign(row, { kind: 'scale', scaleId: link.scaleId });
      else if (link.kind === 'chart') Object.assign(row, { kind: 'chart', chartId: link.chartId, keyId: link.keyId });
      else return fail(`No such scale: ${slug}`);
      row.what = slug;
    } else {
      if (!layoutFamily) return fail('Give the chart, as in its address on oakhum.com (for example alto-c-12)');
      const ding = get('ding'), top = notesOf(get('top')), bottom = notesOf(get('bottom'));
      if (!ding && !top.length) return fail('Give a scale, or the notes');
      if (!ding) return fail('Give the lowest note (ding)');
      for (const n of [ding, ...top, ...bottom]) if (!tools.safeNoteName(n)) return fail(`${n} isn’t a note (write it like D3, Bb3 or F#4)`);
      if (!top.length) return fail('Give the notes around the lowest one');
      if (bottom.length && family !== 'handpan') return fail('Only a handpan has bottom notes');
      Object.assign(row, { kind: 'custom', ding, top, bottom });
      row.what = `${ding} + ${top.length + bottom.length} notes`;
    }
    if (get('serials')) {
      const ser = parseSerials(get('serials'));
      if (ser.error) return fail(`Serial numbers: ${ser.error}`);
      row.serials = ser.serials;
      serialTotal += ser.serials.length;
    }
    return { ...row, ok: true };
  });
  const names = new Map();
  for (const r of rows) if (r.ok) { if (names.has(r.name)) { r.ok = false; r.error = `The same name as row ${names.get(r.name)}`; } else names.set(r.name, r.line); }
  return { rows, error: serialTotal > MAKER_IMPORT_LIMITS.serials ? `At most ${MAKER_IMPORT_LIMITS.serials} serial numbers at a time (this has ${serialTotal})` : '' };
}

// ── Stats (maker_stats; supabase/migrations/20261123_maker_stats.sql) ────────
export const MAKER_STAT_PERIODS = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }];
export const MAKER_VIA_LABELS = { qr: 'QR code', nfc: 'NFC tag', link: 'Link', embed: 'On your website' };

export function makerNum(n) { return Number(n || 0).toLocaleString('en-GB'); }

// Every day of the period, oldest first, with zeros where nothing happened:
// [{ day: '2026-11-21', opens, devices }].
export function makerStatsDays(stats) {
  if (!stats?.since || !stats?.until) return [];
  const by = new Map((stats.by_day ?? []).map(d => [d.day, d]));
  const out = [];
  const end = Date.parse(stats.until + 'T00:00:00Z');
  for (let t = Date.parse(stats.since + 'T00:00:00Z'); t <= end && out.length < 100; t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, opens: Number(by.get(day)?.opens ?? 0), devices: Number(by.get(day)?.devices ?? 0) });
  }
  return out;
}

// "21 Nov": a day as a chart label.
export function makerDayLabel(day) {
  const d = new Date(day + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
}

// "today", "yesterday", "3 days ago" for a code's last scan.
export function makerDaysAgo(day, today) {
  const n = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 86400000);
  if (!Number.isFinite(n) || n < 0) return '';
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

// What one code's row says: "12 scans · saved · last scan 3 days ago".
export function makerCodeStatText(row, today) {
  if (!row || !row.opens) return 'Not scanned yet';
  const parts = [`${makerNum(row.opens)} scan${row.opens !== 1 ? 's' : ''}`];
  if (row.saves) parts.push(row.saves > 1 ? `saved ${makerNum(row.saves)} times` : 'saved');
  if (row.chord_visits) parts.push('chords played');
  if (row.last_day && today) parts.push(`last scan ${makerDaysAgo(row.last_day, today)}`);
  return parts.join(' · ');
}

// The codes' rows grouped by instrument, most scanned first:
// [{ id, name, opens, devices, saves, codes: [row…] }]. names: { id: name }.
export function makerStatsByInstrument(stats, names = {}) {
  const groups = new Map();
  for (const row of stats?.by_code ?? []) {
    const g = groups.get(row.instrument_id) ?? { id: row.instrument_id, name: names[row.instrument_id] ?? 'Instrument', opens: 0, devices: 0, saves: 0, codes: [] };
    g.opens += Number(row.opens || 0); g.devices += Number(row.devices || 0); g.saves += Number(row.saves || 0);
    g.codes.push(row);
    groups.set(row.instrument_id, g);
  }
  return [...groups.values()].sort((a, b) => b.opens - a.opens || a.name.localeCompare(b.name));
}

// The period's numbers per code as a CSV file (for a spreadsheet).
export function makerStatsCsv(stats, names = {}) {
  const cell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const head = ['instrument', 'serial', 'code', 'scans', 'devices', 'saves', 'visits_with_chords', 'visits_with_songs', 'chords_played', 'songs_opened', 'last_scan', 'retired'];
  const lines = [head.join(',')];
  for (const g of makerStatsByInstrument(stats, names)) {
    for (const r of g.codes) {
      lines.push([g.name, r.serial ?? '', r.code, r.opens, r.devices, r.saves, r.chord_visits, r.song_visits, r.chords, r.songs, r.last_day ?? '', r.retired ? 'yes' : ''].map(cell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}
