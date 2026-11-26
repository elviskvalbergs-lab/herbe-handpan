// The instrument screen's shared parts: tabs, app bar, not-saved banner, Playlists and Songs tabs.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../../icons.js';
import { layoutFamilyInfo, layoutInstrument } from '../../layoutfamilies.js';
import { windWord } from '../../instruments.js';
import { playableMidis } from '../../ocarina-ui.js';

// Tabs of an ocarina or flute: [id, label, icon]. Notes, Chords and
// Playlists need a playable chart; a shared instrument is read-only.
// The tabs of an instrument, the same on every one and in the same order
// (docs/navigation-redesign.md): the three things people come for, Chords,
// Songs and Playlists, then the instrument's own tab (Pan, Drum, Kalimba, or an
// ocarina's or flute's Notes). inst is an ocarina or flute, or null for the
// handpan, tongue drum or kalimba on screen. One it made itself also has
// Build or Set up.
function instrumentTabs(inst) {
  const chords = { id: 'chords', label: 'Chords', icon: 'music' };
  const songs = { id: 'songs', label: 'Songs', icon: 'music-2' };
  const sets = { id: 'playlists', label: 'Playlists', icon: 'list-music' };
  // A handpan, tongue drum or kalimba: its picture and notes. Once it is in
  // My instruments that tab is its Set up (its name and photo are there too).
  if (!inst) {
    return [chords, songs, sets, state.currentInstrumentId
      ? { id: 'editor', label: 'Set up', icon: 'wrench' }
      : { id: 'editor', label: layoutFamilyInfo(layoutInstrument(state.layout)).tab, icon: 'circle-dot' }];
  }
  const tabs = [];
  if (playableMidis(inst).length > 0) {
    tabs.push(chords, songs);
    // Playlists on every instrument, saved or opened from a link; not on someone's
    // instrument shared by code, which is read-only.
    if (inst.id !== SHARED_ID || inst.link) tabs.push(sets);
    tabs.push({ id: 'notes', label: 'Notes', icon: 'layout-grid' });
  }
  if (inst.id === SHARED_ID) return tabs;
  if (inst.kind === 'scale' && canBuild()) tabs.push({ id: 'builder', label: 'Build', icon: 'hammer' });
  if (inst.kind === 'custom' || inst.kind === 'traditional') tabs.push({ id: 'setup', label: 'Set up', icon: 'wrench' });
  return tabs;
}
// The tab bar: an ocarina's or flute's tabs are one view's (oc-tab), a
// handpan's are views of their own.
const LAYOUT_TAB_ACTIONS = { chords: 'go-chords', songs: 'hp-songs', playlists: 'hp-playlists', editor: 'back-editor' };
function instrumentTabBar(inst, current) {
  return uiTabBar(instrumentTabs(inst).map(t => (inst
    ? { ...t, action: 'oc-tab', data: { tab: t.id } }
    : { ...t, action: LAYOUT_TAB_ACTIONS[t.id] })), current);
}

// An instrument being tried, not in My instruments: the same banner on every
// instrument (a handpan scale or custom notes, an ocarina or flute opened
// from a link), with its Save.
function notSavedBannerHtml(action) {
  // visit-save: a guest's own instrument, built in this visit (§2);
  // prog-keep: a guest's playlist, from a pasted chord sheet.
  const text = action === 'visit-save' || action === 'prog-keep' ? 'Not saved · gone when you close this page' : 'Not saved · try it, then keep it in My instruments';
  return `
      <div class="banner">
        <span>${text}</span>
        <button type="button" class="btn btn-primary btn-sm" data-action="${action}">Save</button>
      </div>`;
}

// The app bar of every instrument, with its tabs (none in practice mode) and,
// under it, the banner of one that is not kept yet. inst is an ocarina or
// flute, or null for the handpan, tongue drum or kalimba on screen.
//   mine          the switcher goes to My instruments; a guest's is "gone
//                 when you close this page" until saved
//   being tried   (a link, the catalogue, Play something else): the switcher
//                 goes to the others of its family, the badge says Not saved
//   shared by code  read-only, with its code and Add to My instruments
function instrumentAppBar(inst, view, { practice = false } = {}) {
  const family = inst ? inst.family : layoutInstrument(state.layout);
  const name = inst ? inst.name : state.layout.name;
  const mine = inst ? inst.id !== SHARED_ID : !!state.currentInstrumentId;
  const byCode = !!inst && inst.id === SHARED_ID && !inst.link;
  const others = inst ? `Other ${windWord(inst)}s` : family === 'handpan' ? 'Other scales' : 'Other tunings';
  const banner = practice ? ''
    : byCode ? `
      <div class="banner">
        <span>Shared instrument ${escHtml(inst.publicId)} · read-only</span>
        <button type="button" class="btn btn-primary btn-sm" data-action="shared-add">${icon('plus')} Add to My instruments</button>
      </div>`
    : !mine ? notSavedBannerHtml(inst ? 'shared-add' : 'save-layout')
    : !accountOn() ? notSavedBannerHtml('visit-save') : '';
  return `
    ${uiAppBar({
      switcher: mine || byCode ? { name, action: 'back-home', title: 'My instruments' } : { name, action: 'open-play', data: { family }, title: others },
      badge: byCode ? uiBadge(inst.publicId) : mine ? '' : uiBadge('Not saved'),
      actions: [tunerAppBtn(), menuAppBtn()],
      tabs: practice ? '' : instrumentTabBar(inst, view),
    })}
    ${practice ? '' : madeByRowHtml()}
    ${banner}`;
}

// The Playlists tab: one kind of list (chords in order, the same one as
// often as you like, played in time; stored as progressions). Songs have
// their own tab (songsTabHtml).
function playlistsTabHtml(inst) {
  return `
    <section class="pl-section" aria-labelledby="pl-sec-playlists">
      <h2 class="list-title" id="pl-sec-playlists">Playlists ${uiHelp('playlists')}</h2>
      ${state.progressions.length
        ? `<div class="list">${progressionRowsHtml(inst)}</div>`
        : '<p class="pl-section-hint">Chords in order, the same chord as often as you like (Am – Dm – Am), played in time. Tap the bookmark on any chord to start one, or paste a chord sheet.</p>'}
      <div class="pl-new-row">
        <button type="button" class="btn btn-ghost pl-new" data-action="prog-new-open">${icon('plus')} New playlist</button>
        <button type="button" class="btn btn-ghost pl-new" data-action="cs-open">${icon('clipboard-paste')} Paste a chord sheet</button>
      </div>
    </section>`;
}

// The Songs tab: songs to learn, then the way in for a song whose chords
// you have (it becomes a playlist).
function songsTabHtml(inst) {
  return `${songsSectionHtml(inst)}
    <section class="pl-section" aria-labelledby="pl-sec-sheet">
      <h2 class="list-title" id="pl-sec-sheet">Chords of a song ${uiHelp('chord-sheets')}</h2>
      <div class="list">${uiRow({ lead: 'clipboard-paste', title: 'Paste a chord sheet', meta: 'Know a song’s chords? Play along with them', chevron: true, action: 'cs-open' })}</div>
    </section>`;
}
