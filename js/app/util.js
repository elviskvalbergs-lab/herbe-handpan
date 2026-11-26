// Small helpers: escaping HTML, the toast.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).

// ── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Toast (§5.7): bottom centre above the tab bar, tuner, wizard action bar
// or sheet footer (CSS), 3 s, or 5 s with an action ({ label, run }). A
// toast belongs to the screen it was shown on: render() hides it when the
// screen changes, unless it was shown in the same event that changed it.
let _toastTimer = null;
let _toastFresh = false;
function showToast(msg, { action = null } = {}) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-msg">${escHtml(msg)}</span>${action ? `<button type="button" class="toast-action">${escHtml(action.label)}</button>` : ''}`;
  if (action) toast.querySelector('.toast-action').addEventListener('click', () => { hideToast(); action.run(); });
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, action ? 5000 : 3000);
  _toastFresh = true;
  queueMicrotask(() => { _toastFresh = false; });
}
function hideToast() {
  clearTimeout(_toastTimer);
  document.querySelector('.toast')?.classList.remove('show');
}
