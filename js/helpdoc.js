// Help articles: the one reader of help/<lang>/*.md, shared by the app's
// help sheet, the website's /help pages and exports, and the tests. Design:
// docs/help-centre.md.
//
// An article is front matter between two '---' lines, then a small, strict
// subset of Markdown. Anything outside the subset is an error (helpParse
// throws), so an article can never render differently in the app and on the
// website.
//
//   ---
//   id: chords
//   title: Find the chords your instrument can play
//   summary: One or two sentences, shown in lists and search results.
//   section: chords
//   type: howto | faq | reference
//   audience: players | makers
//   instruments: all            (or: handpan, tongue-drum, kalimba)
//   features: chords, chords-filters
//   app: /handpan/d-kurd/chords (a deep link that shows it; optional)
//   verified: 2026-11-21        (the day someone last checked it against the app)
//   order: 10
//   ---
//
// Body:
//   ## A question or a step heading {#stable-anchor}
//   ### A smaller heading
//   Paragraphs, **bold**, [links](/help/other-article#anchor),
//   - bullet lists and
//   1. numbered lists (one line per item),
//   > a note,
//   ![What the picture shows](img:name)   (help/img/name.jpg, made by scripts/help-screenshots.mjs)
//   {{feature-or-label-id}}               (the name as the app shows it, from js/features.js)
import { FEATURES, FEATURE_FAMILIES, featureName } from './features.js';

// Replaced by build.py with { id: "the article's Markdown" } for the app's
// help sheet, so help opens with no connection. Stays null on the website
// and in tests, which read the files.
const HELP_BUNDLE = null;

// The website, where the articles also live (/help/<id>) and where a link
// out of an article goes (/privacy, /request). The app may be open on its
// own address, so these are absolute.
export const HELP_SITE = 'https://oakhum.com';

export const HELP_SECTIONS = [
  { id: 'start',     title: 'Getting started' },
  { id: 'chords',    title: 'Chords' },
  { id: 'songs',     title: 'Songs, playlists and progressions' },
  { id: 'listening', title: 'Listen and the tuner' },
  { id: 'account',   title: 'Saving, accounts and offline' },
  { id: 'sharing',   title: 'Sharing' },
  { id: 'trouble',   title: 'When something goes wrong' },
  { id: 'glossary',  title: 'Words explained' },
  { id: 'makers',    title: 'For makers and shops' },
];
export const HELP_TYPES = ['howto', 'faq', 'reference'];
export const HELP_AUDIENCES = ['players', 'makers'];
const HELP_FIELDS = ['id', 'title', 'summary', 'section', 'type', 'audience', 'instruments', 'features', 'app', 'verified', 'order'];

const helpList = v => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** "Add to playlist" → "add-to-playlist". */
export function helpSlug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Inline text → [{ t: 'text' | 'bold' | 'link' | 'label', … }]. {{id}} becomes
// the app's own name for that feature or label.
function helpInline(src, where) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\{\{([a-z0-9-]+)\}\}/g;
  let last = 0, m;
  const text = s => { if (s) out.push({ t: 'text', v: s }); };
  while ((m = re.exec(src))) {
    text(src.slice(last, m.index));
    if (m[1] != null) out.push({ t: 'bold', v: m[1] });
    else if (m[2] != null) out.push({ t: 'link', v: m[2], href: m[3] });
    else {
      const name = featureName(m[4]);
      if (name == null) throw new Error(`${where}: {{${m[4]}}} is not a feature or label in js/features.js`);
      out.push({ t: 'label', v: name, id: m[4] });
    }
    last = re.lastIndex;
  }
  text(src.slice(last));
  for (const part of out) {
    if (part.t === 'text' && /[*`{}]|\]\(/.test(part.v)) throw new Error(`${where}: unsupported Markdown in "${part.v.trim().slice(0, 60)}"`);
  }
  return out;
}

/** Plain text of inline parts or of a block. */
export function helpText(x) {
  if (Array.isArray(x)) return x.map(p => p.v).join('');
  if (x.t === 'list') return x.items.map((it, i) => `${x.ordered ? `${i + 1}.` : '-'} ${helpText(it)}`).join('\n');
  if (x.t === 'img') return '';
  return helpText(x.parts);
}

/**
 * Markdown source → the article: its front matter fields, `blocks` (the
 * body) and `anchors` (the ids of its ## headings). Throws on anything
 * outside the subset, with the file name in the message.
 */
export function helpParse(source, file = 'article') {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source.replace(/\r\n/g, '\n'));
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv || !HELP_FIELDS.includes(kv[1])) throw new Error(`${file}: unknown front matter line "${line}"`);
    meta[kv[1]] = kv[2].trim();
  }
  for (const f of ['id', 'title', 'summary', 'section', 'type', 'audience', 'instruments', 'features', 'verified']) {
    if (!meta[f]) throw new Error(`${file}: front matter needs "${f}"`);
  }
  if (!HELP_SECTIONS.some(s => s.id === meta.section)) throw new Error(`${file}: unknown section "${meta.section}"`);
  if (!HELP_TYPES.includes(meta.type)) throw new Error(`${file}: unknown type "${meta.type}"`);
  if (!HELP_AUDIENCES.includes(meta.audience)) throw new Error(`${file}: unknown audience "${meta.audience}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.verified)) throw new Error(`${file}: "verified" must be a date, YYYY-MM-DD`);
  const instruments = meta.instruments === 'all' ? [...FEATURE_FAMILIES] : helpList(meta.instruments);
  for (const i of instruments) if (!FEATURE_FAMILIES.includes(i)) throw new Error(`${file}: unknown instrument "${i}"`);
  const features = meta.features === 'none' ? [] : helpList(meta.features);
  for (const f of features) if (!FEATURES.some(x => x.id === f)) throw new Error(`${file}: unknown feature "${f}"`);

  const blocks = [];
  const anchors = [];
  const lines = m[2].split('\n');
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ t: 'p', parts: helpInline(para.join(' '), file) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    let x;
    if (!line.trim()) { flush(); continue; }
    if ((x = /^## (.+?) \{#([a-z0-9-]+)\}$/.exec(line))) {
      flush();
      if (anchors.includes(x[2])) throw new Error(`${file}: anchor #${x[2]} is used twice`);
      anchors.push(x[2]);
      blocks.push({ t: 'h2', id: x[2], parts: helpInline(x[1], file) });
    } else if (/^## /.test(line)) {
      throw new Error(`${file}: "${line}" needs a stable anchor, like "## Heading {#heading}"`);
    } else if ((x = /^### (.+)$/.exec(line))) {
      flush();
      blocks.push({ t: 'h3', parts: helpInline(x[1], file) });
    } else if (/^#/.test(line)) {
      throw new Error(`${file}: only ## and ### headings (the title is in the front matter): "${line}"`);
    } else if ((x = /^(-|\d+\.) (.+)$/.exec(line))) {
      flush();
      const ordered = x[1] !== '-';
      const prev = blocks[blocks.length - 1];
      const item = helpInline(x[2], file);
      if (prev?.t === 'list' && prev.ordered === ordered && lines[i - 1]?.trim()) prev.items.push(item);
      else blocks.push({ t: 'list', ordered, items: [item] });
    } else if ((x = /^> (.+)$/.exec(line))) {
      flush();
      blocks.push({ t: 'note', parts: helpInline(x[1], file) });
    } else if ((x = /^!\[([^\]]+)\]\(img:([a-z0-9-]+)\)$/.exec(line))) {
      flush();
      blocks.push({ t: 'img', alt: x[1], name: x[2] });
    } else if (/^(!\[|```|\||<|\s{2,}\S)/.test(lines[i])) {
      throw new Error(`${file}: unsupported Markdown: "${line.slice(0, 60)}"`);
    } else {
      para.push(line.trim());
    }
  }
  flush();
  if (!blocks.length) throw new Error(`${file}: the article is empty`);

  return {
    id: meta.id, title: meta.title, summary: meta.summary, section: meta.section, type: meta.type,
    audience: meta.audience, instruments, features, app: meta.app || null, verified: meta.verified,
    order: Number(meta.order ?? 100), blocks, anchors,
  };
}

/** Sorted the way the help index shows them: by section, then order, then title. */
export function helpSort(articles) {
  const sec = id => HELP_SECTIONS.findIndex(s => s.id === id);
  return [...articles].sort((a, b) => sec(a.section) - sec(b.section) || a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * The article split at its ## headings: [{ id, heading, text, blocks }]. The
 * part before the first heading has id '' and the article's title. This is
 * what search, the JSON export and an AI assistant index: one passage per
 * anchor, small enough to quote and cite.
 */
export function helpPassages(article) {
  const out = [{ id: '', heading: article.title, blocks: [] }];
  for (const b of article.blocks) {
    if (b.t === 'h2') out.push({ id: b.id, heading: helpText(b.parts), blocks: [] });
    else out[out.length - 1].blocks.push(b);
  }
  return out
    .filter(p => p.id || p.blocks.length)
    .map(p => ({ ...p, text: p.blocks.map(helpText).filter(Boolean).join('\n\n') }));
}

/** The article as plain Markdown with the names filled in (llms-full.txt, the JSON export). */
export function helpMarkdown(article) {
  const inl = parts => parts.map(p => (p.t === 'bold' || p.t === 'label' ? `**${p.v}**` : p.t === 'link' ? `[${p.v}](${p.href})` : p.v)).join('');
  return article.blocks.map(b => {
    if (b.t === 'h2') return `## ${inl(b.parts)}`;
    if (b.t === 'h3') return `### ${inl(b.parts)}`;
    if (b.t === 'note') return `> ${inl(b.parts)}`;
    if (b.t === 'list') return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${inl(it)}`).join('\n');
    if (b.t === 'img') return '';
    return inl(b.parts);
  }).filter(Boolean).join('\n\n');
}

// ── In the app ───────────────────────────────────────────────────────────────

const helpEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The articles built into the app (build.py), parsed once: { id: article }. */
let _helpBundled = null;
export function helpBundled() {
  if (_helpBundled) return _helpBundled;
  _helpBundled = {};
  for (const [id, src] of Object.entries(HELP_BUNDLE ?? {})) {
    try { _helpBundled[id] = helpParse(src, id); } catch (_) { /* a broken article is left out; the tests catch it first */ }
  }
  return _helpBundled;
}

/**
 * The body of the app's help sheet. A link to another article stays inside
 * the sheet (data-action="help-open"); pictures are left out, since the
 * reader is looking at the app itself.
 */
export function helpHtml(article) {
  const inl = parts => parts.map(p => {
    if (p.t === 'bold' || p.t === 'label') return `<strong>${helpEsc(p.v)}</strong>`;
    if (p.t === 'link') {
      const to = /^\/help\/([a-z0-9-]+)(?:#([a-z0-9-]+))?$/.exec(p.href);
      if (to) return `<button type="button" class="link-btn" data-action="help-open" data-id="${to[1]}"${to[2] ? ` data-anchor="${to[2]}"` : ''}>${helpEsc(p.v)}</button>`;
      return `<a href="${helpEsc(p.href.startsWith('/') ? HELP_SITE + p.href : p.href)}" target="_blank" rel="noopener">${helpEsc(p.v)}</a>`;
    }
    return helpEsc(p.v);
  }).join('');
  return article.blocks.map(b => {
    if (b.t === 'h2') return `<h3 class="help-h" id="help-${b.id}">${inl(b.parts)}</h3>`;
    if (b.t === 'h3') return `<h4 class="help-h4">${inl(b.parts)}</h4>`;
    if (b.t === 'note') return `<p class="help-note">${inl(b.parts)}</p>`;
    if (b.t === 'list') return `<${b.ordered ? 'ol' : 'ul'} class="help-list">${b.items.map(it => `<li>${inl(it)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    if (b.t === 'img') return '';
    return `<p>${inl(b.parts)}</p>`;
  }).join('');
}
