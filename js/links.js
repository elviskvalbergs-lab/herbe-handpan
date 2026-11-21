// Deep links: a stable path for every instrument and tuning in the catalogue
// (docs/free-to-play.md, "1. Deep links"). Pure: no DOM, so the tests and
// the Vercel middleware (preview cards) use it too.
//
//   /handpan/d-kurd[/chords[/a-min]]      a scale from SCALES
//   /handpan/custom[/chords[/a-min]]?ding=D3&top=A3,…&bottom=…&tc=8&bc=3&name=…
//   /ocarina/alto-c-12[/notes|/chords]    a fingering chart in one key
//   /flute/tin-whistle-d, /flute/naf-6-a4
//   /recorder/soprano-baroque, /recorder/alto-baroque, /recorder/soprano-german
//   /tongue-drum/d-kurd-9[/chords[/a-min]] a tongue drum from TONGUE_DRUMS
//   /tongue-drum/custom?…                  a custom tongue drum (same query as a custom handpan)
//   /kalimba/c-major-17, /kalimba/custom?… kalimbas (js/kalimbas.js), the same way
//   /s/7KQ2PM[/chords]                    an instrument shared by code
//
// A slug never changes or disappears once published: a rename only adds an
// alias. Every slug is lower case; '#' is written 's' (F# Kurd → fs-kurd).

import { SCALES } from './data.js';
import { LAYOUT_FAMILIES, LAYOUT_FAMILY_IDS, isLayoutFamily, familyOfTuningId, findTuning, safeNoteName } from './layoutfamilies.js';
import { TRADITIONAL_CHARTS, getChart, instrumentFromChart } from './charts.js';

// The app's name, used in page titles and preview cards (build.py has its own copy in the HTML template).
export const APP_NAME = 'Oakhum';

export const LINK_FAMILIES = [...LAYOUT_FAMILY_IDS, 'ocarina', 'flute', 'recorder'];
export const LINK_TABS = {
  handpan: ['pan', 'chords', 'playlists', 'listen'],
  ...Object.fromEntries(LAYOUT_FAMILY_IDS.filter(f => f !== 'handpan').map(f => [f, ['pan', 'chords', 'playlists', 'listen']])),
  ocarina: ['notes', 'chords', 'listen'],
  flute: ['notes', 'chords', 'listen'],
  recorder: ['notes', 'chords', 'playlists', 'listen'],
};
const LINK_DEFAULT_TAB = { ...Object.fromEntries(LAYOUT_FAMILY_IDS.map(f => [f, 'pan'])), ocarina: 'notes', flute: 'notes', recorder: 'notes' };

export function linkSlug(text) {
  return String(text).toLowerCase().replace(/#/g, 's').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Short names of the charts in links. A chart without one here falls back
// to its id, so a new chart still gets a working link.
const LINK_CHART_SLUGS = {
  'tin-whistle-d': 'tin-whistle',
  'naf6-penta': 'naf-6',
  'naf5-penta': 'naf-5',
  'naf6-a': 'naf-6-in-a',
  'naf5-a': 'naf-5-in-a',
  'naf6-fs': 'naf-6-in-fs',
  'naf5-fs': 'naf-5-in-fs',
  'ocarina-6-stl-c': 'pendant-6',
};

// 12-hole ocarinas go by voice and key, as players and makers name them
// ("alto C"): the voice is the octave of the lowest note.
const LINK_OCARINA_VOICES = { 3: 'bass', 4: 'alto', 5: 'soprano' };
const LINK_VOICED_CHARTS = { 'ocarina-12-stl-c': 12 };

function linkKeyOctave(key) { return Number(String(key.lowest).match(/(\d+)$/)?.[1]); }
function linkKeyRoot(key) { return key.root ?? String(key.id).split('-')[0]; }

function linkChartSlug(chart, key) {
  if (key.slug) return key.slug; // a recorder's size and fingering: soprano-baroque
  const holes = LINK_VOICED_CHARTS[chart.id];
  if (holes) {
    const voice = LINK_OCARINA_VOICES[linkKeyOctave(key)];
    if (voice) return `${voice}-${linkSlug(linkKeyRoot(key))}-${holes}`;
  }
  return `${LINK_CHART_SLUGS[chart.id] ?? linkSlug(chart.id)}-${linkSlug(key.id)}`;
}

// The slug tables, built once.
function linkBuildTables() {
  const canonical = Object.fromEntries(LINK_FAMILIES.map(f => [f, new Map()]));
  const alias = Object.fromEntries(LINK_FAMILIES.map(f => [f, new Map()]));
  const byTarget = new Map();
  for (const s of SCALES) {
    const slug = linkSlug(s.id);
    canonical.handpan.set(slug, { family: 'handpan', scaleId: s.id });
    byTarget.set(`scale:${s.id}`, slug);
  }
  // A scale named without its key opens the D version, else the first listed.
  const groups = new Map();
  for (const s of SCALES) {
    const rest = linkSlug(s.id.split('-').slice(1).join('-'));
    if (!groups.has(rest)) groups.set(rest, []);
    groups.get(rest).push(s);
  }
  for (const [rest, list] of groups) {
    if (canonical.handpan.has(rest)) continue;
    const pick = list.find(s => s.id.startsWith('D-')) ?? list[0];
    alias.handpan.set(rest, linkSlug(pick.id));
  }
  // Tongue drums, kalimbas…: each tuning by its own slug.
  for (const fam of LAYOUT_FAMILY_IDS.filter(f => f !== 'handpan')) {
    for (const t of LAYOUT_FAMILIES[fam].tunings) {
      canonical[fam].set(t.slug, { family: fam, scaleId: t.id });
      byTarget.set(`scale:${t.id}`, t.slug);
    }
  }
  for (const chart of TRADITIONAL_CHARTS) {
    const fam = chart.family;
    for (const key of chart.keys) {
      const slug = linkChartSlug(chart, key);
      canonical[fam].set(slug, { family: fam, chartId: chart.id, keyId: key.id });
      byTarget.set(`chart:${chart.id}:${key.id}`, slug);
    }
    const def = chart.keys.find(k => k.id === chart.defaultKey) ?? chart.keys[0];
    // A recorder by its size alone opens the baroque one; its other names too.
    if (fam === 'recorder' && chart.id === 'recorder-baroque') {
      for (const key of chart.keys) alias[fam].set(key.id, key.slug);
      alias[fam].set('descant', 'soprano-baroque');
      alias[fam].set('treble', 'alto-baroque');
      alias[fam].set('baroque', 'soprano-baroque');
      alias[fam].set('german', 'soprano-german');
    }
    const short = LINK_CHART_SLUGS[chart.id];
    if (short && !canonical[fam].has(short)) alias[fam].set(short, linkChartSlug(chart, def));
    if (LINK_VOICED_CHARTS[chart.id]) {
      const holes = LINK_VOICED_CHARTS[chart.id];
      alias[fam].set(`${holes}-hole`, linkChartSlug(chart, def));
      // "12-hole-g": that key in the default voice (alto when there is one).
      const defOct = linkKeyOctave(def);
      for (const key of chart.keys) {
        if (linkKeyOctave(key) !== defOct) continue;
        const root = linkSlug(linkKeyRoot(key));
        alias[fam].set(`${holes}-hole-${root}`, linkChartSlug(chart, key));
        alias[fam].set(`${LINK_OCARINA_VOICES[defOct]}-${root}`, linkChartSlug(chart, key));
      }
    }
  }
  return { canonical, alias, byTarget };
}
const LINK_TABLES = linkBuildTables();

// Every canonical link in the catalogue: [{ path, family, scaleId | chartId+keyId }].
export function catalogueLinks() {
  const out = [];
  for (const fam of LINK_FAMILIES) {
    for (const [slug, t] of LINK_TABLES.canonical[fam]) out.push({ path: `/${fam}/${slug}`, ...t });
  }
  return out;
}

// The path of an instrument and, optionally, a tab and chord.
//   target: { scaleId } | { chartId, keyId } | { custom: URLSearchParams|string } | { code }
export function linkFor(target, { tab = null, chord = null } = {}) {
  let base, family, query = '';
  if (target.code) { base = `/s/${String(target.code).toUpperCase()}`; family = null; }
  else if (target.scaleId) {
    const slug = LINK_TABLES.byTarget.get(`scale:${target.scaleId}`);
    if (!slug) return null;
    family = familyOfTuningId(target.scaleId);
    base = `/${family}/${slug}`;
  } else if (target.chartId) {
    const chart = getChart(target.chartId);
    if (!chart) return null;
    const keyId = target.keyId ?? chart.defaultKey ?? chart.keys[0].id;
    const slug = LINK_TABLES.byTarget.get(`chart:${target.chartId}:${keyId}`);
    if (!slug) return null;
    base = `/${chart.family}/${slug}`; family = chart.family;
  } else if (target.custom != null) {
    family = isLayoutFamily(target.family) ? target.family : 'handpan';
    base = `/${family}/custom`;
    const q = String(target.custom);
    query = q ? `?${q.replace(/^\?/, '')}` : '';
  } else return null;
  const tabs = family ? LINK_TABS[family] : ['pan', 'notes', 'chords', 'playlists', 'listen'];
  const useTab = chord ? 'chords' : tab;
  let path = base;
  if (useTab && tabs.includes(useTab) && useTab !== (family ? LINK_DEFAULT_TAB[family] : null)) path += `/${useTab}`;
  if (chord && useTab === 'chords') path += `/${linkSlug(chord)}`;
  return path + query;
}

// Reads a path (and query) into what it opens, or null when it isn't a deep
// link. Unknown slugs come back as { kind: 'unknown', closest } so the app
// can open the picker with the nearest match on top.
export function parseLink(pathname, search = '') {
  const parts = String(pathname).split('/').filter(Boolean).map(p => decodeURIComponent(p));
  if (parts.length < 2) return null;
  const [head, rawSlug, rawTab, rawChord] = parts;
  const tabOf = (fam) => {
    const t = rawTab ? rawTab.toLowerCase() : null;
    const ok = fam ? LINK_TABS[fam] : ['pan', 'notes', 'chords', 'playlists', 'listen'];
    return t && ok.includes(t) ? t : null;
  };
  const chord = rawChord ? linkSlug(rawChord) : null;

  if (head === 's') {
    const code = rawSlug.toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
    return { kind: 'shared', code, tab: tabOf(null), chord, path: linkFor({ code }, { tab: tabOf(null), chord }) };
  }
  const family = head.toLowerCase();
  if (!LINK_FAMILIES.includes(family)) return null;
  const slug = linkSlug(rawSlug);
  const tab = tabOf(family);

  if (isLayoutFamily(family) && slug === 'custom') {
    const q = String(search).replace(/^\?/, '');
    return { kind: 'custom', family, params: new URLSearchParams(q), tab, chord, path: linkFor({ custom: q, family }, { tab, chord }) };
  }
  const canonSlug = LINK_TABLES.canonical[family].has(slug) ? slug : LINK_TABLES.alias[family].get(slug);
  const target = canonSlug && LINK_TABLES.canonical[family].get(canonSlug);
  if (!target) {
    // Look in the other families too (a flute linked as /ocarina/…).
    for (const other of LINK_FAMILIES) {
      if (other === family) continue;
      const s2 = LINK_TABLES.canonical[other].has(slug) ? slug : LINK_TABLES.alias[other].get(slug);
      if (s2) return parseLink(`/${other}/${s2}${rawTab ? '/' + rawTab : ''}${rawChord ? '/' + rawChord : ''}`, search);
    }
    return { kind: 'unknown', family, slug: rawSlug, closest: closestLinks(family, slug) };
  }
  const kind = target.scaleId ? 'scale' : 'chart';
  const t = target.scaleId ? { scaleId: target.scaleId } : { chartId: target.chartId, keyId: target.keyId };
  // A tongue drum from the catalogue drawn the other way round: centre=1 puts
  // its lowest note in the middle, centre=0 round the edge with the others.
  const centre = family === 'tongue-drum' ? new URLSearchParams(String(search)).get('centre') : null;
  const drawn = centre === '1' || centre === '0' ? { centre: centre === '1' } : {};
  return { kind, family, ...t, ...drawn, tab, chord, path: linkFor(t, { tab, chord }) + (drawn.centre != null ? `?centre=${centre}` : '') };
}

// A custom handpan link's query (ding, top, bottom, tc, bc, name) as a
// layout. Each shell gets exactly as many slots as its capacity (tc / bc),
// empty ones as null: an empty list ("bottom=") is three empty slots when
// bc=3, not one blank note, so the shell can still be made smaller.
export function layoutFromCustomParams(params, family = 'handpan') {
  const fam = isLayoutFamily(family) ? family : 'handpan';
  const drum = fam === 'tongue-drum';
  const max = LAYOUT_FAMILIES[fam].maxNotes; // notes besides the lowest, per shell
  const shell = (key, capKey, fallback) => {
    const raw = params.get(key) ? params.get(key).split(',') : [];
    const notes = raw.map(n => safeNoteName(n)); // only note names reach the picture
    const cap = parseInt(params.get(capKey) ?? '', 10);
    const capacity = Math.min(max, Math.max(Number.isNaN(cap) ? fallback : cap, notes.length, 0));
    return { slots: Array.from({ length: capacity }, (_, i) => ({ note: notes[i] ?? null })), capacity };
  };
  return {
    id: 'custom',
    name: (params.get('name') || 'Custom Layout').slice(0, 80),
    isCustom: true,
    // A tongue drum: centre=1 when its lowest note is a tongue in the middle.
    ...(fam !== 'handpan' ? { instrument: fam, centre: drum && params.get('centre') === '1' } : {}),
    top: { ding: safeNoteName(params.get('ding')) ?? 'D3', ...shell('top', 'tc', 8) },
    bottom: shell('bottom', 'bc', fam === 'handpan' ? 3 : 0),
    // A handpan's tone fields moved to where they are on the real one.
    ...(fam === 'handpan' && panPosFromParam(params.get('pos')) ? { pos: panPosFromParam(params.get('pos')) } : {}),
  };
}

// The nearest catalogue slugs to a mistyped one, best first.
export function closestLinks(family, slug, limit = 3) {
  const fams = LINK_FAMILIES.includes(family) ? [family] : LINK_FAMILIES;
  const scored = [];
  for (const fam of fams) {
    for (const s of [...LINK_TABLES.canonical[fam].keys(), ...LINK_TABLES.alias[fam].keys()]) {
      const target = LINK_TABLES.canonical[fam].has(s) ? s : LINK_TABLES.alias[fam].get(s);
      scored.push({ path: `/${fam}/${target}`, d: linkDistance(slug, s) });
    }
  }
  scored.sort((a, b) => a.d - b.d);
  const seen = new Set();
  const out = [];
  for (const x of scored) {
    if (seen.has(x.path)) continue;
    seen.add(x.path);
    out.push(x.path);
    if (out.length >= limit) break;
  }
  return out;
}

function linkDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// A name for the instrument a link opens, for titles and preview cards.
export function linkTitle(link) {
  if (!link) return null;
  const what = LAYOUT_FAMILIES[isLayoutFamily(link.family) ? link.family : 'handpan'].word;
  if (link.kind === 'scale') {
    const name = findTuning(link.scaleId)?.name ?? link.scaleId;
    // Kalimbas of one key differ only by their number of keys: keep it ("C Major 17-key kalimba").
    const keys = link.family === 'kalimba' ? / \((\d+)\)$/.exec(name)?.[1] : null;
    return `${name.replace(/ \(\d+\)$/, '')} ${keys ? `${keys}-key ` : ''}${what}`;
  }
  if (link.kind === 'custom') return `${link.params.get('name') || 'Custom'} ${what}`;
  if (link.kind === 'shared') return 'Shared instrument';
  if (link.kind === 'chart') {
    const chart = getChart(link.chartId);
    const key = chart.keys.find(k => k.id === link.keyId) ?? chart.keys[0];
    if (LINK_VOICED_CHARTS[chart.id]) {
      const voice = LINK_OCARINA_VOICES[linkKeyOctave(key)];
      const v = voice ? voice[0].toUpperCase() + voice.slice(1) + ' ' : '';
      return `${v}${linkKeyRoot(key)} ${LINK_VOICED_CHARTS[chart.id]}-hole ocarina`;
    }
    return instrumentFromChart(chart.id, key.id, { now: '' }).name;
  }
  return null;
}

// Preview card text (title, description) for a path; the default card when
// it isn't a deep link.
export function linkPreview(pathname, search = '') {
  const link = parseLink(pathname, search);
  const title = linkTitle(link);
  if (!title || link.kind === 'unknown') {
    return { title: APP_NAME, description: 'Chords, arpeggios and play-along for handpans, tongue drums, kalimbas, ocarinas, flutes and recorders. Free, in your browser.', image: '/og/app.jpg' };
  }
  const what = link.tab === 'listen' ? 'Listen to a song and play along'
    : link.chord ? `The ${linkChordName(link.chord)} chord and its arpeggio`
    : 'Notes, chords, arpeggios and play-along';
  const family = link.family ?? 'app';
  return { title: `${title} · ${APP_NAME}`, description: `${what} on the ${linkLower(title)}. Free, in your browser: open it and play.`, image: `/og/${family}.jpg` };
}

// "a-min" → "A min", "cs-maj7" → "C# maj7": readable enough for a card.
function linkChordName(slug) {
  const [root, ...rest] = slug.split('-');
  const r = root.length === 2 && root[1] === 's' ? root[0].toUpperCase() + '#' : root[0].toUpperCase() + root.slice(1);
  return [r, ...rest].join(' ');
}

// "Tin whistle in D" → "tin whistle in D"; "D Kurd handpan" stays.
function linkLower(title) { return /^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title; }

// The app's index.html with the preview card of one link: title, description,
// image and URL (absolute, as preview cards need). Used by middleware.js.
export function withLinkPreview(html, preview, origin, url) {
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const meta = (attr, name, value) => {
    const re = new RegExp(`<meta ${attr}="${name}" content="[^"]*">`);
    const tag = `<meta ${attr}="${name}" content="${esc(value)}">`;
    html = re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => `  ${tag}\n</head>`);
  };
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(preview.title)}</title>`);
  meta('name', 'description', preview.description);
  meta('property', 'og:title', preview.title);
  meta('property', 'og:description', preview.description);
  meta('property', 'og:image', origin + preview.image);
  meta('property', 'og:url', url);
  return html;
}

// A handpan's moved tone fields (layout.pos, the editor's Move notes) in a
// link: pos=ding:250:250,ring-0:120:300,gu-1:40:460.
export function panPosToParam(pos) {
  return Object.entries(pos ?? {}).map(([id, p]) => `${id}:${Math.round(p.x)}:${Math.round(p.y)}`).join(',');
}
export function panPosFromParam(text) {
  const pos = {};
  for (const part of String(text ?? '').split(',')) {
    const m = /^(ding|ring-\d{1,2}|gu-\d{1,2}):(\d{1,3}):(\d{1,3})$/.exec(part);
    if (!m) continue;
    const x = +m[2], y = +m[3];
    if (x <= 500 && y <= 500) pos[m[1]] = { x, y };
  }
  return Object.keys(pos).length ? pos : null;
}
