// The makers programme (docs/makers-programme.md): the pure parts. Makers and
// shops ask for the maker role, set up a public profile, and their shared
// instruments show "Made by" to the buyer who opens them by code.
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
