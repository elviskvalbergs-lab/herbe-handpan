// Measurement (docs/free-to-play.md §9).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { layoutInstrument } from '../layoutfamilies.js';
import { parseLink } from '../links.js';
import { onFirstSound } from '../audio.js';
import { logEvent } from '../auth.js';

// ── Measurement (docs/free-to-play.md §9) ──────────────────────────────────
// Which link brought someone in, how long until the first sound, and which
// features get used: event names and a few properties, no ids (auth.js
// logEvent). Each feature is counted once per visit.
const MEASURE_START = Date.now();

function measureFamily() {
  if (state.layout) return layoutInstrument(state.layout);
  return currentInstrument()?.family ?? null;
}

function measureOpen() {
  const link = parseLink(location.pathname, location.search);
  // The link, without anything personal: custom notes and share codes stay out.
  const path = !link ? (isAppHome() ? APP_HOME : 'other')
    : link.kind === 'custom' ? `/${link.family}/custom`
    : link.kind === 'shared' ? '/s'
    : link.kind === 'unknown' ? `/${link.family}/?`
    : link.path;
  const q = new URLSearchParams(location.search);
  let referrer = null;
  try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) referrer = r.host; } catch (_) {}
  const props = { path };
  if (referrer) props.referrer = referrer;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) if (q.get(k)) props[k] = q.get(k);
  logEvent('open', props);
  onFirstSound(() => { _heardSound = true; logEvent('first_play', { family: measureFamily(), seconds: Math.round((Date.now() - MEASURE_START) / 1000) }); });
}

const MEASURE_FEATURES = {
  'go-chords': 'chords', 'play-chord': 'chords', 'toggle-discover-mode': 'identify', 'oc-play-arp': 'arpeggio',
  'tuner-toggle': 'tuner', 'listen-start': 'listen-scale', 'cs-open': 'chord-sheet',
  'oc-practice-start': 'practice', 'prog-practice': 'practice', 'hp-play-playlist': 'playlist-play',
  'play-custom-handpan': 'custom-notes', 'clone-layout': 'custom-notes', 'add-instrument': 'add-instrument',
  'setup-listen': 'setup-listen', 'setup-know': 'setup-know',
};
const _measured = new Set();
function measureFeature(action, el) {
  let name = MEASURE_FEATURES[action];
  if (action === 'oc-tab' && el.dataset.tab === 'chords') name = 'chords';
  if (!name || _measured.has(name)) return;
  _measured.add(name);
  logEvent('feature', { name, family: measureFamily() });
}

// The path of a link without anything personal (custom notes, share codes).
function measurePathOf(pathname) {
  const link = parseLink((pathname || '/').split(/[?#]/)[0], '');
  return !link ? APP_HOME : link.kind === 'custom' ? `/${link.family}/custom` : link.kind === 'shared' ? '/s' : link.kind === 'unknown' ? `/${link.family}/?` : link.path;
}
