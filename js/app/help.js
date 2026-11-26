// The Help sheet and which article a screen opens.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { featureName } from '../features.js';
import { HELP_SECTIONS, HELP_SITE, helpBundled, helpHtml, helpSort } from '../helpdoc.js';

// ── Help ─────────────────────────────────────────────────────────────────────
// The help articles (help/en/*.md, built into the page by build.py) in the
// shared sheet, so help opens with no connection. docs/help-centre.md.

// Which help the current screen asks for: a key of HELP_SCREENS (js/features.js).
function helpScreenKey() {
  const v = state.view;
  if (v === 'chords') return state.hpListen ? 'listen' : state.discoverMode ? 'identify' : 'chords';
  if (v === 'editor') return 'pan';
  if (v === 'hp-playlists') return 'playlists';
  if (v === 'hp-songs') return 'songs';
  if (v === 'instrument') {
    const oc = state.oc;
    if (oc.tab === 'chords') return oc.listen ? 'listen' : oc.identify ? 'identify' : 'chords';
    if (oc.tab === 'songs') return 'songs';
    if (oc.tab === 'setup') return 'pan';
    return oc.tab === 'playlists' ? 'playlists' : oc.tab === 'practice' ? 'practice' : 'notes';
  }
  if (v === 'playlist') return 'playlist';
  if (v === 'progression') return 'progression';
  if (v === 'song') return 'song';
  if (v === 'setup' || v === 'wizard') return 'setup';
  if (v === 'play' || v === 'selector') return 'try';
  if (v === 'settings') return 'settings';
  if (v.startsWith('maker')) return 'makers';
  return 'home';
}

// The ⋯ menu's row: help for the screen you are on.
function helpMenuRow() {
  return uiRow({ lead: 'info', title: featureName('help'), meta: 'About this screen', action: 'help-open' });
}

function helpSheet() {
  const all = helpBundled();
  const a = state.help.id ? all[state.help.id] : null;
  if (a) {
    return uiSheet({
      key: 'help', title: a.title, close: 'help-close',
      body: `<div class="help-doc">${helpHtml(a)}</div>`,
      footer: `<button type="button" class="btn btn-ghost" data-action="help-open" data-id="">All help topics</button>
        <a class="btn btn-secondary" href="${HELP_SITE}/help/${a.id}" target="_blank" rel="noopener">Open on oakhum.com</a>`,
    });
  }
  const list = helpSort(Object.values(all));
  const body = list.length
    ? HELP_SECTIONS.filter(s => list.some(x => x.section === s.id)).map(s => `
        <h3 class="list-title">${escHtml(s.title)}</h3>
        <div class="list">${list.filter(x => x.section === s.id).map(x => uiRow({ title: x.title, chevron: true, action: 'help-open', data: { id: x.id } })).join('')}</div>`).join('')
    : `<p class="sheet-text">Help is on <a href="${HELP_SITE}/help" target="_blank" rel="noopener">oakhum.com/help</a>.</p>`;
  return uiSheet({ key: 'help', title: featureName('help'), close: 'help-close', body: `<div class="help-doc">${body}</div>` });
}
