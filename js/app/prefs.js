// Preferences (persist across sessions) and the speed control.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { safeSetItem } from '../datastore.js';
import { initAudio, playScale, setPlaybackTempo } from '../audio.js';
import { scheduleSave } from '../auth.js';

// ── Speed ─────────────────────────────────────────────────────────────────
// One speed for everything that plays (arpeggios, scales, fingerings shown
// note by note, previews), 25–150% of normal: a slider with presets, in
// Settings and behind the "1×" button on every chord card. Remembered and
// synced (the tempo preference).
const TEMPO_PRESETS = [25, 50, 75, 100, 125];
function clampTempo(v) { return Math.min(150, Math.max(25, Math.round((Number(v) || 100) / 5) * 5)); }
function tempoLabel(t = state.tempo) { return `${(t / 100).toFixed(2).replace(/\.?0+$/, '')}×`; }
let _tempoSave = null;
function setTempo(v, { preview = false } = {}) {
  state.tempo = clampTempo(v);
  setPlaybackTempo(state.tempo);
  clearTimeout(_tempoSave);
  _tempoSave = setTimeout(savePrefs, 400);
  document.querySelectorAll('.tempo-value').forEach(e => { e.textContent = `${state.tempo}%`; });
  document.querySelectorAll('.speed-btn-label').forEach(e => { e.textContent = tempoLabel(); });
  document.querySelectorAll('.tempo-presets [data-value]').forEach(e => e.setAttribute('aria-pressed', String(+e.dataset.value === state.tempo)));
  if (preview) { initAudio(); playScale(['C4', 'E4', 'G4']); }
}
function tempoControlHtml() {
  return `<div class="tempo">
      <div class="tempo-row">
        <input type="range" class="tempo-slider" min="25" max="150" step="5" value="${state.tempo}" aria-label="Speed, percent of normal">
        <span class="tempo-value">${state.tempo}%</span>
      </div>
      <div class="chips tempo-presets" role="group" aria-label="Speed presets">
        ${TEMPO_PRESETS.map(v => `<button type="button" class="chip" data-action="tempo-set" data-value="${v}" aria-pressed="${v === state.tempo}">${v === 100 ? 'Normal' : `${v}%`}</button>`).join('')}
      </div>
    </div>`;
}
// The card's speed button: "1×", "0.75×".
function speedBtnHtml() {
  return `<button type="button" class="btn btn-secondary speed-btn" data-action="speed-open" aria-haspopup="dialog" aria-label="Speed ${state.tempo}%" title="Speed"><span class="speed-btn-label">${tempoLabel()}</span></button>`;
}
function speedSheet() {
  return uiSheet({
    key: 'speed', title: 'Speed', close: 'speed-close',
    body: `<p class="sheet-text">How fast chords, scales and fingerings play, on every instrument. Slower is easier to follow.</p>${tempoControlHtml()}`,
    footer: '<button type="button" class="btn btn-primary" data-action="speed-close">Done</button>',
  });
}

// ── Preferences (persist across sessions) ────────────────────────────────────
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}');
    if (typeof p.ringRotated === 'boolean') state.ringRotated = p.ringRotated;
    // Note names: the three-way setting, or the C# / D♭ switch it replaced
    // (D♭ was a choice and stays; C# was also the default, so it becomes Auto).
    if (['auto', 'sharps', 'flats'].includes(p.noteNames)) state.noteNames = p.noteNames;
    else if (p.useFlats === true) state.noteNames = 'flats';
    if (typeof p.useSolfege === 'boolean') state.useSolfege = p.useSolfege;
    if (typeof p.autoplaySeconds === 'number') state.autoplaySeconds = p.autoplaySeconds;
    // The speed, or the Slow / Normal / Fast it replaced.
    if (Number.isFinite(p.tempo)) state.tempo = clampTempo(p.tempo);
    else if (p.playbackSpeed === 'slow') state.tempo = 70;
    else if (p.playbackSpeed === 'fast') state.tempo = 140;
    if (typeof p.showFingers === 'boolean') state.showFingers = p.showFingers;
    if (typeof p.showSizes === 'boolean') state.showSizes = p.showSizes;
    if (typeof p.closeUp === 'boolean') state.closeUp = p.closeUp;
    if (typeof p.chordsAll === 'boolean') state.chordsAll = p.chordsAll;
    if (typeof p.showLyrics === 'boolean') state.showLyrics = p.showLyrics;
    if (typeof p.ocLegendSeen === 'boolean') state.ocLegendSeen = p.ocLegendSeen;
    if (typeof p.handLegendSeen === 'boolean') state.handLegendSeen = p.handLegendSeen;
    if (['dark', 'light', 'auto'].includes(p.theme)) state.theme = p.theme;
  } catch {}
  applyTheme();
  setPlaybackTempo(state.tempo);
}

// The theme pref on <html data-theme> (the CSS does the rest) and the
// browser chrome colour to match. Auto follows the OS as it changes.
const THEME_COLORS = { dark: '#1C1B16', light: '#F2E6D3' };
const _themeQuery = window.matchMedia?.('(prefers-color-scheme: light)');
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const resolved = state.theme === 'auto' ? (_themeQuery?.matches ? 'light' : 'dark') : state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}
_themeQuery?.addEventListener?.('change', applyTheme);

// Settings sync with an account (as the 'prefs' item): updatedAt stamps the
// edit, and lastPath (rememberLastPath) is kept.
function savePrefs() {
  let kept = {};
  try { const p = JSON.parse(localStorage.getItem('hp-prefs') || '{}'); if (p.lastPath) kept = { lastPath: p.lastPath }; } catch {}
  safeSetItem(localStorage, 'hp-prefs', JSON.stringify({
    ...kept,
    updatedAt: new Date().toISOString(),
    ringRotated: state.ringRotated,
    noteNames: state.noteNames,
    useFlats: state.noteNames === 'flats', // for app versions from before Auto
    useSolfege: state.useSolfege,
    autoplaySeconds: state.autoplaySeconds,
    tempo: state.tempo,
    showFingers: state.showFingers,
    showSizes: state.showSizes,
    closeUp: state.closeUp,
    chordsAll: state.chordsAll,
    showLyrics: state.showLyrics,
    ocLegendSeen: state.ocLegendSeen,
    handLegendSeen: state.handLegendSeen,
    theme: state.theme,
  }));
  scheduleSave();
}
