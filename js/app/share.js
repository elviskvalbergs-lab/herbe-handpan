// Sharing an instrument, and the instrument on screen (currentInstrument).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../icons.js';
import { linkFor } from '../links.js';
import { getInstrument, newPublicId, saveInstrument, usesLayout } from '../instruments.js';
import { getSavedLayouts } from '../storage.js';
import { isLoggedIn, saveCloudInstruments } from '../auth.js';

// ── Sharing ──────────────────────────────────────────────────────────────────
// A shared instrument (#p/<code>) opens read-only under this id.
const SHARED_ID = '__shared__';

function currentInstrument() {
  return state.currentInstrumentId === SHARED_ID ? state.shared : getInstrument(state.currentInstrumentId);
}

function openSharedLink(code, tab = null) {
  Object.assign(state, {
    view: 'instrument', layout: null, currentInstrumentId: SHARED_ID,
    shared: null, sharedStatus: 'loading', oc: newOcState(), chordsUi: newChordsUi(),
  });
  // Supabase is initialised just after the first render, so fetch next tick.
  setTimeout(async () => {
    // With who made it, when an approved maker shared it (js/makers-ui.js).
    const opening = await makerOpenCode(code);
    const data = opening?.data ?? null;
    if (state.currentInstrumentId !== SHARED_ID) return;
    // A shared handpan, tongue drum or kalimba opens like any visiting one:
    // its notes on its own screens, ready to save.
    if (data && usesLayout(data) && data.layout) {
      openSharedLayout(data, tab);
      makerMarkOpened(opening);
      render();
      return;
    }
    state.shared = data ? { ...data, id: SHARED_ID, publicId: code.toUpperCase() } : null;
    state.sharedStatus = data ? null : 'missing';
    makerMarkOpened(opening);
    render();
  }, 0);
}

let _qrLib = null;
function loadQrLib() {
  if (_qrLib) return _qrLib;
  _qrLib = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    // Pinned: the hash cdnjs publishes for this file of this version.
    sc.integrity = 'sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==';
    sc.crossOrigin = 'anonymous';
    sc.onload = () => resolve(window.qrcode);
    sc.onerror = () => { _qrLib = null; reject(new Error('QR library unavailable')); };
    document.head.appendChild(sc);
  });
  return _qrLib;
}

async function shareInstrument(id = null) {
  const inst = id ? getInstrument(id) : currentInstrument();
  if (!inst || inst.id === SHARED_ID) return;
  // A guest got the save sheet first (store.js); an account needs the connection.
  if (!isLoggedIn()) { showToast('Sharing needs a connection'); return; }
  // A handpan, tongue drum or kalimba shares a copy of its notes, kept up to
  // date each time it is shared (its layout lives in the saved layouts).
  if (usesLayout(inst)) {
    const saved = getSavedLayouts().find(l => l.id === inst.layoutId);
    if (!saved) return;
    inst.layout = JSON.parse(JSON.stringify(saved.layout));
    saveInstrument(inst);
    if (inst.publicId && await saveCloudInstruments([getInstrument(inst.id)]) !== true) { showToast('Sharing needs a connection'); return; }
  }
  if (!inst.publicId) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && ok !== true; attempt++) {
      inst.publicId = newPublicId();
      saveInstrument(inst);
      ok = await saveCloudInstruments([getInstrument(inst.id)]);
      if (ok !== '23505') break; // anything but a public-ID clash: stop retrying
    }
    if (ok !== true) {
      delete inst.publicId;
      saveInstrument(inst);
      showToast('Sharing isn\'t available on the server yet');
      return;
    }
  }
  const url = `${location.origin}${linkFor({ code: inst.publicId })}`;
  const what = usesLayout(inst) ? 'its notes and chords' : 'its fingering chart and chords';
  const tip = inst.family === 'ocarina' ? ' Stamp the code into the clay or tie the QR code to it.' : ' Print the QR code and keep it with the instrument.';
  state.shareModal = { code: inst.publicId, url, qr: null, text: `Anyone with the code, link or QR code sees ${what}, read-only, and can add it to their own instruments.${tip}` };
  render();
  try {
    const qrcode = await loadQrLib();
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    if (state.shareModal?.code === inst.publicId) { state.shareModal.qr = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); render(); }
  } catch { /* the link and code still work without the QR image */ }
}

function shareModalHtml() {
  const m = state.shareModal;
  if (!m) return '';
  return uiSheet({
    help: uiHelp('sharing', 'code'), key: 'share', title: 'Share this instrument', close: 'share-close',
    body: `
      <p class="sheet-text">${escHtml(m.text)}</p>
      <div class="share-code">${escHtml(m.code)}</div>
      <div class="share-qr">${m.qr ?? '<span class="share-loading">QR code loading…</span>'}</div>
      <input class="input share-url" readonly value="${escHtml(m.url)}" aria-label="Share link">`,
    footer: `
      <button class="btn btn-ghost" data-action="share-close">Close</button>
      <button class="btn btn-primary" data-action="share-copy">${icon('link')} Copy link</button>`,
  });
}
