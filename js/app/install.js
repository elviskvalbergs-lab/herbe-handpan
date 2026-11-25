// Add to home screen.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../icons.js';

// ── Add to home screen ─────────────────────────────────────────────────────
// The app works best installed: full screen, its own icon, offline. A slim
// banner on the start screens says so; Android browsers give us their own
// install dialog (beforeinstallprompt), iPhones don't, so there the button
// shows the steps. Hidden in the installed app, and for 30 days after ×
// (a per-device convenience, so localStorage).
let _installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvent = e; render(); });
window.addEventListener('appinstalled', () => { _installEvent = null; state.installHelp = false; render(); });
const INSTALL_DISMISS_KEY = 'hp-install-dismissed';
const INSTALL_QUIET_MS = 30 * 24 * 3600 * 1000;

function runningInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
// Not before the visitor got something out of the app: it shows once a sound
// was played in this visit, or an instrument is saved.
let _heardSound = false;
function installBannerHtml() {
  if (runningInstalled()) return '';
  if (!_heardSound && !state.instruments.length) return '';
  try { if (Date.now() - Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) < INSTALL_QUIET_MS) return ''; } catch {}
  return `
      <div class="banner install-banner">
        <span>${icon('smartphone')} Add Oakhum to your home screen: it opens like an app, full screen, and works offline.</span>
        <span class="install-banner-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="install-app">Add</button>
          ${uiIconBtn('x', 'Not now', { action: 'install-dismiss' })}
        </span>
      </div>`;
}
function installHelpSheet() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const steps = ios
    ? (/CriOS|FxiOS|EdgiOS/.test(ua)
      ? ['Tap the Share button in the address bar (a square with an arrow).', 'Choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.']
      : ['Tap the Share button (a square with an arrow) at the bottom of Safari.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b>.'])
    : /SamsungBrowser/.test(ua)
    ? ['Open the menu (the three lines at the bottom).', 'Choose <b>Add page to</b>, then <b>Home screen</b>.']
    : ['Open the browser menu (⋮ or ≡).', 'Choose <b>Add to Home screen</b> or <b>Install app</b>.'];
  return uiSheet({
    key: 'install', title: 'Add Oakhum to your home screen', close: 'install-help-close',
    body: `<ol class="install-steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
      <p class="sheet-text">Then open Oakhum from its icon: full screen, quicker to reach, and with an account it works offline.</p>`,
    footer: '<button type="button" class="btn btn-primary" data-action="install-help-close">Done</button>',
  });
}
