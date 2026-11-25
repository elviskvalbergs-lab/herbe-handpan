// Songs to learn (js/songs.js): the list, opening and sharing a song.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote, getAllNotes, noteToMidi } from '../../data.js';
import { icon } from '../../icons.js';
import { SONGS, SONG_COLLECTION_ORIGINS, SONG_LICENCE, SONG_ORIGINS, christmasSeason, christmasSongs, playableSongs, songFit, songKeyOn, songLyrics, songNotes, songTimeLabel, songsForFilter, songsInOrder, songsThatGoTogether } from '../../songs.js';
import { getChart } from '../../charts.js';
import { layoutFamilyInfo, layoutInstrument } from '../../layoutfamilies.js';
import { linkFor, linkPreview, parseLink } from '../../links.js';
import { getInstrument, getInstruments, midiToNoteName, sortInstruments, usesLayout, windWord } from '../../instruments.js';
import { renderPan } from '../../pan.js';
import { fingeringFor, playableMidis, renderFingering } from '../../ocarina-ui.js';
import { getSavedLayouts } from '../../storage.js';
import { logEvent } from '../../auth.js';

// ── Songs to learn (js/songs.js) ──────────────────────────────────────────
// Folk songs, melody only, in every instrument's Playlists tab: the ones
// whose notes the instrument has, each moved to where it has them. A song
// opens its player (viewSong): the instrument's picture with the note to
// play lit (a fingering on an ocarina or flute), the notes in order, play
// at the chosen speed or step note by note, and songs that go well after it.

// The instrument a song plays on: an ocarina or flute, or null for the
// handpan, tongue drum or kalimba on screen (state.layout).
function songInstrument() {
  const id = state.songCtx?.instId;
  if (!id) return null;
  const cur = currentInstrument();
  return cur?.id === id ? cur : getInstrument(id);
}
function songHave(inst) {
  return new Set(inst ? playableMidis(inst) : getAllNotes(state.layout).map(noteToMidi));
}
// An ocarina's or flute's notes played without half-covering a hole: songs
// are moved to keys that keep to these where they can.
function songEasy(inst) {
  return inst ? new Set(playableMidis(inst).filter(m => !fingeringFor(inst, m)?.states?.includes('h'))) : null;
}
// near: the songs that almost fit too (one note missing, songFit), after the ones that fit.
function songsFor(inst, songs, { near = false } = {}) { return playableSongs(songHave(inst), songs, { easy: songEasy(inst), near }); }
// The browser's languages, for the order of the list (songsInOrder).
function songLanguages() { return navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en']; }
// "without E5, 3 times": the one note an almost-fitting song lacks here.
function songMissingLabel(x) {
  const n = displayNote(midiToNoteName(x.missing), state.useFlats, state.useSolfege);
  return `without ${n}, ${x.times === 1 ? 'once' : x.times === 2 ? 'twice' : `${x.times} times`}`;
}
function songInstWord(inst) {
  return inst ? windWord(inst) : layoutFamilyInfo(layoutInstrument(state.layout)).word;
}
function songMeta(song, shift) {
  return `${SONG_ORIGINS[song.origin]} · ${songKeyOn(song, shift)} · ${songTimeLabel(song)}`;
}

const SONGS_SHOWN = 8;
const SONGS_ALMOST_SHOWN = 4;
// Which songs the list shows (songsForFilter): 'christmas', 'popular' or
// 'origin:<code>'. Christmas is the spotlight in season (15 Nov – 6 Jan):
// the list opens on it, and its chip is highlighted.
function songsFilter() {
  const f = state.songsFilter ?? (christmasSeason() ? 'christmas' : 'popular');
  return f === 'all' ? 'popular' : f;
}
function songsSectionHtml(inst) {
  const filter = songsFilter();
  const langs = songLanguages();
  const pool = songsInOrder(songsForFilter(filter, SONGS, { languages: langs }), langs);
  const fits = songsFor(inst, pool, { near: true });
  const ok = fits.filter(x => x.missing == null), almost = fits.filter(x => x.missing != null);
  const more = pool.length - fits.length;
  const nXmas = songsFor(inst, christmasSongs()).length;
  const nPop = songsFor(inst, songsForFilter('popular', SONGS, { languages: langs })).length;
  const word = songInstWord(inst);
  const origin = filter.startsWith('origin:') ? filter.slice(7) : null;
  const spotlight = christmasSeason();
  const chip = (value, label, { cls = '', lead = '' } = {}) => `<button type="button" class="chip${cls}" data-action="songs-filter" data-value="${escHtml(value)}" aria-pressed="${filter === value}">${lead}${escHtml(label)}</button>`;
  const what = filter === 'christmas' ? 'Christmas songs' : origin ? `songs from ${SONG_ORIGINS[origin]}` : 'songs';
  return `
    <section class="pl-section" aria-labelledby="pl-sec-songs">
      <h2 class="list-title" id="pl-sec-songs">Songs to learn</h2>
      <div class="chips songs-filter" role="group" aria-label="Which songs">
        ${nXmas ? chip('christmas', `Christmas · ${nXmas}`, { cls: spotlight ? ' is-spotlight' : '', lead: spotlight ? icon('sparkles') : '' }) : ''}
        ${chip('popular', `Popular · ${nPop}`)}
        ${origin ? `<button type="button" class="chip" data-action="songs-filter" data-value="popular" aria-pressed="true" aria-label="${escHtml(SONG_ORIGINS[origin])}: show Popular again">${escHtml(SONG_ORIGINS[origin])} ${icon('x')}</button>` : ''}
        <button type="button" class="chip" data-action="songs-countries-open">${icon('sliders-horizontal')} Countries</button>
      </div>
      ${ok.length
        ? `<div class="list">${(state.songsAll ? ok : ok.slice(0, SONGS_SHOWN)).map(({ song, shift }) => uiRow({
            lead: 'music', title: song.title, meta: escHtml(songMeta(song, shift)), chevron: true,
            action: 'song-open', data: { id: song.id, inst: inst?.id ?? '' },
          })).join('')}${!state.songsAll && ok.length > SONGS_SHOWN ? uiRow({ lead: 'chevron-down', title: `Show all ${ok.length} ${what}`, action: 'songs-all' }) : ''}</div>`
        : `<p class="pl-section-hint">None of these ${escHtml(what)} fits your ${escHtml(word)} completely${almost.length ? '' : ': each needs notes it doesn’t have'}.</p>`}
      ${almost.length ? `<h3 class="list-title song-almost-title">Almost fit: one note missing</h3>
        <div class="list">${(state.songsAlmostAll ? almost : almost.slice(0, SONGS_ALMOST_SHOWN)).map(x => uiRow({
            lead: 'music', title: x.song.title, meta: escHtml(`${songMeta(x.song, x.shift)} · ${songMissingLabel(x)}`), chevron: true,
            action: 'song-open', data: { id: x.song.id, inst: inst?.id ?? '' },
          })).join('')}${!state.songsAlmostAll && almost.length > SONGS_ALMOST_SHOWN ? uiRow({ lead: 'chevron-down', title: `Show all ${almost.length}`, action: 'songs-almost-all' }) : ''}</div>
        <p class="pl-section-hint">The note is marked in the song and never swapped for another: leave it out or sing it.</p>` : ''}
      ${fits.length && more ? `<p class="pl-section-hint">${more} more need notes your ${escHtml(word)} doesn’t have.</p>` : ''}
      <p class="pl-section-hint song-licence">Folk, children’s and Christmas songs from many countries, the best known first; collections such as Latvian folk songs under Countries. ${escHtml(SONG_LICENCE)}.</p>
    </section>`;
}
// Countries: every country with songs that fit this instrument, most first;
// a collection (Latvian folk songs) says what it is.
function songsCountriesSheet() {
  const inst = songListInstrument();
  const counts = new Map();
  for (const { song } of songsFor(inst, SONGS, { near: true })) counts.set(song.origin, (counts.get(song.origin) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([o, n]) => uiRow({
    lead: 'music', title: SONG_ORIGINS[o],
    meta: `${n} song${n !== 1 ? 's' : ''} on your ${escHtml(songInstWord(inst))}${SONG_COLLECTION_ORIGINS.includes(o) ? ' · a collection of folk songs' : ''}`,
    action: 'songs-filter', data: { value: `origin:${o}` }, chevron: true,
  })).join('');
  return uiSheet({
    key: 'songs-countries', title: 'Songs by country', close: 'songs-countries-close',
    body: `<div class="list">${rows}</div>`,
  });
}
// The instrument whose Playlists tab is on screen: an ocarina or flute, or
// null for the handpan, tongue drum or kalimba.
function songListInstrument() { return state.view === 'instrument' ? currentInstrument() : null; }

function openSong(id, instId, { push = true } = {}) {
  songStop();
  state.songCtx = { id, instId: instId || null, idx: 0, from: state.view };
  state.view = 'song';
  if (push) navPush(songAddress());
  render();
  window.scrollTo(0, 0);
}

// The link of the song on screen that anyone can open (links.js):
// /handpan/d-kurd/songs/<song>, a custom instrument with its notes, a shared
// one by its code. An ocarina or flute of my own that isn't shared or from a
// chart has none: then the song alone (/song/<id>), the instrument for the
// other person to choose.
function songPublicPath() {
  const id = state.songCtx?.id;
  if (!id) return null;
  const inst = songInstrument();
  if (!inst) {
    if (!state.layout) return linkFor({ song: id });
    const base = stateToHash();
    if (!base.startsWith('/')) return linkFor({ song: id });
    const [path, query] = base.split('?');
    const link = parseLink(path, query ? `?${query}` : '');
    const target = !link ? null : link.kind === 'scale' ? { scaleId: link.scaleId } : link.kind === 'custom' ? { custom: query ?? '', family: link.family } : null;
    const out = target && linkFor(target, { song: id });
    return out ? (link.kind === 'scale' && query ? `${out}?${query}` : out) : linkFor({ song: id });
  }
  if (inst.id === SHARED_ID && state.shared?.link) return linkFor(state.shared.link, { song: id });
  if (inst.publicId) return linkFor({ code: inst.publicId }, { song: id });
  if (inst.kind === 'traditional' && getChart(inst.type)) return linkFor({ chartId: inst.type, keyId: inst.key }, { song: id }) ?? linkFor({ song: id });
  return linkFor({ song: id });
}
// The address bar while a song is open: its public link, except on an
// ocarina or flute of my own, which keeps its own id so a reload opens mine.
function songAddress() {
  const inst = songInstrument();
  if (inst && inst.id !== SHARED_ID) return `#i/${inst.id}/song/${encodeURIComponent(state.songCtx.id)}`;
  return songPublicPath() ?? `#song/${encodeURIComponent(state.songCtx.id)}`;
}

// A song waiting for its instrument (a /…/songs/<id> link still loading, or
// /song/<id> with the instrument still to be chosen): opened as soon as an
// instrument is on screen (render). When it doesn't fit there, says so.
function songOpenPending() {
  const id = state.pendingSong;
  if (!id || !['editor', 'chords', 'hp-playlists', 'hp-songs', 'instrument'].includes(state.view)) return;
  const inst = state.view === 'instrument' ? currentInstrument() : null;
  if (state.view === 'instrument' ? !inst || usesLayout(inst) : !state.layout) return;
  state.pendingSong = null;
  const song = SONGS.find(x => x.id === id);
  if (!song) return;
  if (!songsFor(inst, [song], { near: true }).length) {
    if (inst) state.oc.tab = 'songs'; else state.view = 'hp-songs';
    navReplace(inst ? instUrl(inst.id, 'songs') : stateToHash());
    showToast(`${song.title} needs notes this ${songInstWord(inst)} doesn’t have. These songs fit.`);
    return;
  }
  songStop();
  state.songCtx = { id, instId: inst?.id ?? null, idx: 0, from: state.view };
  state.view = 'song';
  const to = songAddress();
  if (navUrl(to) !== location.pathname + location.search + location.hash) navPush(to);
}

// /song/<id>: on the instrument of mine it fits (the one used last first);
// with none, the instrument picker with the song waiting.
function openSongAnywhere(id) {
  const song = SONGS.find(x => x.id === id);
  if (!song) return;
  // Where it fits completely before where it almost fits.
  const fitOn = inst => { const have = songHaveOf(inst); return have ? songFit(song, have) : null; };
  const all = sortInstruments(getInstruments()).map(inst => ({ inst, fit: fitOn(inst) })).filter(x => x.fit);
  const mine = (all.find(x => x.fit.missing == null) ?? all[0])?.inst;
  state.pendingSong = id;
  if (mine && openInstrument(mine.id, { push: false })) return;
  Object.assign(state, { view: 'play', layout: null, currentInstrumentId: null });
}
// The notes one of my instruments has: a Set of MIDI numbers, or null.
function songHaveOf(inst) {
  if (!usesLayout(inst)) return new Set(playableMidis(inst));
  const saved = getSavedLayouts().find(l => l.id === inst.layoutId);
  return saved ? new Set(getAllNotes(saved.layout).map(noteToMidi)) : null;
}

// Share: the phone's own share sheet where there is one, else the link is
// copied; when neither works, a sheet with the link to copy by hand.
async function shareLink({ title, text, path }) {
  const url = `${location.origin}${path}`;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('Link copied'); }
  catch (_) { state.linkSheet = { title, url }; render(); }
}
function linkSheetHtml() {
  const m = state.linkSheet;
  return uiSheet({
    key: 'link', title: 'Share', close: 'link-sheet-close',
    body: `<p class="sheet-text">${escHtml(m.title)}</p>
      <input class="input share-url" readonly value="${escHtml(m.url)}" aria-label="Link">`,
    footer: `<button class="btn btn-ghost" data-action="link-sheet-close">Close</button>
      <button class="btn btn-primary" data-action="share-copy">${icon('link')} Copy link</button>`,
  });
}
function songShare() {
  const S = songOnInstrument();
  const path = songPublicPath();
  if (!S || !path) return;
  const preview = linkPreview(path.split('?')[0], path.includes('?') ? `?${path.split('?')[1]}` : '');
  logEvent('feature', { name: 'song-share', family: measureFamily() });
  shareLink({ title: preview.title, text: `${S.song.title}: play it note by note on Oakhum.`, path });
}

// Back from a song opened by its link (no history to step back through):
// the instrument's song list.
function songBackToList() {
  songStop();
  const inst = songInstrument();
  state.songCtx = null;
  if (inst) { state.view = 'instrument'; state.oc.tab = 'songs'; navReplace(instUrl(inst.id, 'songs')); }
  else if (state.layout) { state.view = 'hp-songs'; navReplace(stateToHash()); }
  else { goHome(); return; }
  render();
}

// Where the song is on the instrument: { song, shift, notes (moved), name(midi) }.
function songOnInstrument() {
  const ctx = state.songCtx;
  const song = ctx && SONGS.find(x => x.id === ctx.id);
  if (!song) return null;
  const inst = songInstrument();
  if (ctx.instId && !inst) return null;
  const here = songsFor(inst, [song], { near: true })[0];
  if (!here) return null;
  // gone: the one note this instrument doesn't have (a song that almost fits).
  const notes = songNotes(song).map(n => ({ ...n, midi: n.midi == null ? null : n.midi + here.shift, gone: n.midi != null && n.midi + here.shift === here.missing }));
  // A handpan's notes by its own spelling, so the drawing lights them.
  const spell = inst ? null : new Map(getAllNotes(state.layout).map(n => [noteToMidi(n), n]));
  const name = m => (spell?.get(m) ?? midiToNoteName(m));
  return { song, shift: here.shift, missing: here.missing ?? null, notes, inst, name };
}

function viewSong() {
  const S = songOnInstrument();
  if (!S) return viewHome();
  const { song, shift, notes, inst, name } = S;
  const uf = state.useFlats, us = state.useSolfege;
  const idx = Math.min(state.songCtx.idx, notes.length - 1);
  // Printing: a clean sheet, nothing lit.
  const cur = state.songPrinting ? { midi: null } : notes[idx];
  const nextNote = state.songPrinting ? null : notes.slice(idx + 1).find(n => n.midi != null);
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const LY = song.lyrics && state.showLyrics ? songLyrics(song, notes) : null;
  const T = songTabShown(inst) ? songTab(S, { lyrics: !!LY }) : null;
  const picture = inst
    ? (cur.gone ? '<p class="song-rest">Not on this instrument</p>'
      : cur.midi != null
      ? renderFingering(inst, cur.midi, { size: 'large', useFlats: uf, useSolfege: us, showFingers: state.showFingers, closeUp: state.closeUp, nextMidi: nextNote && !nextNote.gone ? nextNote.midi : null })
      : '<p class="song-rest">Rest</p>')
    : renderPan(state.layout, {
      shellMode: 'both', highlightNotes: cur.midi != null ? [name(cur.midi)] : [],
      faintNotes: nextNote && nextNote.midi !== cur.midi ? [name(nextNote.midi)] : [],
      rotated: state.ringRotated, useFlats: uf, useSolfege: us,
      strikeMarks: T ? songTabMarks(S, T) : [],
    });
  const playing = !!state.songPlay;
  const chips = notes.map((n, i) => `<button type="button" class="chip song-note${i === idx ? ' is-current' : ''}${songNoteCls(i, idx)}${n.gone ? ' is-gone' : ''}${LY ? ' has-lyric' : ''}" data-action="song-step" data-i="${i}"${i === idx ? ' aria-current="true"' : ''}>${n.midi == null ? '·' : escHtml(nn(n.midi))}${LY ? `<span class="song-note-lyric">${escHtml(LY[i]?.text ?? '')}</span>` : ''}</button>`).join('');
  const after = songsThatGoTogether(song, songsFor(inst, SONGS, { near: true }).filter(x => x.missing == null || x.song.id === song.id));
  return `${backAppBar(song.title, { fallback: 'songs', actions: [uiIconBtn('share-2', 'Share this song', { action: 'song-share' })] })}
    <div class="song">
      <h1 class="song-print-title">${escHtml(song.title)}</h1>
      <p class="song-meta">${escHtml(songMeta(song, shift))} · on your ${escHtml(songInstWord(inst))}${S.missing != null ? ' · <span class="song-gone-text">one note missing</span>' : ''}</p>
      <div class="song-top${T && !state.songPrinting ? ' is-framed' : ''}">
      <div class="song-stage${inst ? ' fg-stage' : ' pan-wrap'}">${picture}</div>
      <div class="song-now" aria-live="polite">
        <span class="song-now-note">${cur.midi == null ? 'Rest' : escHtml(nn(cur.midi))}</span>
        ${nextNote ? `<span class="song-now-next">Next ${escHtml(nn(nextNote.midi))}</span>` : '<span class="song-now-next">Last note</span>'}
        <span class="song-now-pos">${idx + 1} / ${notes.length}</span>
      </div>
      ${cur.gone ? `<p class="song-gone-note" role="status">${escHtml(nn(cur.midi))} isn’t on your ${escHtml(songInstWord(inst))}: leave it out or sing it.</p>` : ''}
      ${LY && !state.songPrinting ? songLyricLineHtml(LY, idx) : ''}
      </div>
      <div class="song-controls${T ? ' actionbar' : ''}">
        ${uiIconBtn('rewind', 'Back to the start', { action: 'song-restart', disabled: idx === 0 && !playing })}
        ${uiIconBtn('skip-back', 'Back one note', { action: 'song-prev' })}
        <button type="button" class="btn btn-primary song-play" data-action="song-play">${icon(playing ? 'square' : 'play')} ${playing ? 'Stop' : idx ? 'Play on' : 'Play'}</button>
        ${uiIconBtn('skip-forward', 'Next note', { action: 'song-next' })}
        ${speedBtnHtml()}
      </div>
      ${state.songPrinting ? '' : songPracticeRowHtml(S, idx)}
      ${songTabFamily(inst) || song.lyrics ? `<div class="song-view-row">
        ${songTabFamily(inst) ? uiSeg([{ value: 'tab', label: 'Tab' }, { value: 'notes', label: 'Notes' }], T ? 'tab' : 'notes', { action: 'song-view', label: 'Show the song as' }) : ''}
        ${song.lyrics ? `<button type="button" class="btn btn-secondary song-lyrics-btn" data-action="song-lyrics" aria-pressed="${state.showLyrics}">${icon(state.showLyrics ? 'check' : 'plus')} Lyrics</button>` : ''}
        ${T ? uiIconBtn('printer', 'Print the tab', { action: 'song-print' }) : ''}
      </div>` : ''}
      ${T ? songTabHtml(S, T, state.songPrinting ? -1 : idx, LY) : `<div class="chips song-notes" role="group" aria-label="Notes of the song">${chips}</div>`}
      ${state.songPrinting ? '' : songOnInstrumentsHtml(S)}
      ${after.length ? `<h2 class="list-title">Goes well after it</h2>
        <div class="list">${after.map(({ song: s, shift: sh }) => uiRow({ lead: 'music', title: s.title, meta: escHtml(songMeta(s, sh)), chevron: true, action: 'song-open', data: { id: s.id, inst: inst?.id ?? '' } })).join('')}</div>` : ''}
      <p class="pl-section-hint song-licence">${song.sourceName
        ? `${song.lyrics ? 'Melody and words' : 'Melody'} from <a href="${escHtml(song.source)}" target="_blank" rel="noopener">${escHtml(song.sourceName)}</a>, public domain${song.lyrics ? '; the words in today’s spelling' : ''}.`
        : `The tune is traditional. ${song.lyrics ? 'Melody and words' : 'Melody'} from <a href="${escHtml(song.source)}" target="_blank" rel="noopener">its Wikipedia article</a>, CC BY-SA 4.0.`}</p>
    </div>`;
}
