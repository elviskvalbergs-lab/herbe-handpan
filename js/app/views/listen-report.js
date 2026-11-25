// Listening reports.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote } from '../../data.js';
import { icon } from '../../icons.js';
import { a4ForOffset } from '../../setup.js';
import { micRecordingSupported, micTakes } from '../../tuner.js';
import { midiToNoteName } from '../../instruments.js';
import { getUserEmail, logEvent } from '../../auth.js';

// ── Listening reports ────────────────────────────────────────────────────────
// Hearing an instrument right is what setup by ear rests on, so every time
// Oakhum shows what it heard it asks whether that was right. "Yes" is counted
// (PostHog, listen_check); "not quite" offers to send what it heard and the
// recording of it (js/tuner.js keeps the last takes in memory) to the website
// (POST /api/listen-report), where it becomes a report in the Studio and a
// Jira issue. We replay it (scripts/replay-listen.mjs), fix it, and write back
// if they left their email. docs/design-system.md, "Listening to real instruments".
const listenReportUrl = () => (/(^|\.)oakhum\.com$/.test(location.hostname) ? '/api/listen-report' : 'https://oakhum.com/api/listen-report');
const LISTEN_REPORT_MAX_BYTES = 4_000_000; // the website takes up to 4.5 MB
const LISTEN_REPORT_PHOTO_PX = 1600;       // a photo's long side, about 300 KB as JPEG

// What Oakhum heard and made of it, for the report and the PostHog event.
function listenReportContext() {
  const L = state.listen;
  const st = state.view === 'setup' ? state.setup : null;
  const g = st?.guide, w = st?.windGuide;
  const family = st?.family ?? (state.view === 'wizard' || state.view === 'selector' ? 'handpan' : null);
  let matched = null;
  if (st && L?.notes?.length && !w) {
    const { best } = setupMatchFor(st, L.notes);
    if (best) matched = { id: best.scale.id, name: best.scale.name };
  }
  const notes = g ? g.notes.map(m => (m == null ? null : midiToNoteName(m))) : (L?.notes ?? []).map(midiToNoteName);
  return {
    where: st ? 'setup' : (L?.where ?? state.view),
    family,
    mode: w ? 'wind-guided' : g ? 'guided' : 'free',
    heard: notes,
    raw: (g ? g.raw : L?.raw ?? []).filter(x => x != null).map(x => Math.round(x * 100) / 100),
    places: g ? guideTotal(g) : null,
    windChart: w ? `${w.chartId}/${w.keyId}` : null,
    tuningCents: st?.tuningCents ?? 0,
    a4: st?.tuningCents ? a4ForOffset(st.tuningCents) : 440,
    matched,
  };
}

function listenCheckEvent(result, ctx = listenReportContext()) {
  logEvent('listen_check', {
    result, where: ctx.where, family: ctx.family, mode: ctx.mode,
    notes: ctx.heard.filter(Boolean).length, a4: ctx.a4, matched: ctx.matched?.id ?? null,
  });
}

// Opens the report sheet. `then` is the setup step to go on to afterwards.
function openListenReport({ then = null } = {}) {
  stopListen();
  const ctx = listenReportContext();
  listenCheckEvent('wrong', ctx);
  state.listenReport = { ctx, then, takes: null, withAudio: true, comment: '', email: getUserEmail() ?? '', sending: false, sent: false, error: '' };
  render();
  micTakes().then(takes => {
    const R = state.listenReport;
    if (!R) return;
    // The newest takes that fit in one upload.
    let bytes = 0;
    R.takes = takes.reverse().filter(t => (bytes += t.blob.size) <= LISTEN_REPORT_MAX_BYTES).reverse()
      .map(t => ({ ...t, url: URL.createObjectURL(t.blob) }));
    render();
  });
}

function closeListenReport() {
  const R = state.listenReport;
  if (!R) return;
  R.takes?.forEach(t => URL.revokeObjectURL(t.url));
  if (R.photo) URL.revokeObjectURL(R.photo.url);
  state.listenReport = null;
  if (R.then && state.view === 'setup' && state.setup) setupGo(R.then);
  else render();
}

// Typed text survives a re-render (the switch, Send).
function listenReportKeepFields() {
  const R = state.listenReport;
  const c = document.getElementById('lr-comment'), e = document.getElementById('lr-email');
  if (R && c) R.comment = c.value;
  if (R && e) R.email = e.value.trim();
}

function listenReportSheet() {
  const R = state.listenReport;
  const close = 'lr-close';
  if (R.sent) {
    return uiSheet({
      key: 'listen-report', title: 'Thank you', close,
      body: `<p class="sheet-text">We’ll listen to it and work out what Oakhum got wrong.${R.email ? ' We’ll write to you when it’s fixed, so you can try again.' : ''}</p>`,
      footer: `<button type="button" class="btn btn-primary" data-action="${close}">${R.then ? 'Choose it myself' : 'Done'}</button>`,
    });
  }
  const ctx = R.ctx;
  const heard = ctx.heard.map(n => (n ? displayNote(n, state.useFlats, state.useSolfege) : '–')).join(' · ');
  const secs = (R.takes ?? []).reduce((a, t) => a + t.seconds, 0);
  const rec = !micRecordingSupported() ? ''
    : R.takes == null ? '<p class="field-help">Getting the recording…</p>'
    : !R.takes.length ? '<p class="field-help">There’s no recording this time: this browser didn’t record, or the microphone wasn’t on.</p>'
    : `${uiSwitchRow({ label: `Send the recording (${secs} s)`, help: 'It helps most: we hear what Oakhum heard. It may also catch voices in the room.', on: R.withAudio, action: 'lr-audio' })}
       ${R.withAudio ? `<div class="lr-takes">${R.takes.map(t => `<audio class="lr-audio" controls preload="metadata" src="${t.url}"></audio>`).join('')}</div>` : ''}`;
  return uiSheet({
    key: 'listen-report', title: 'Help us hear it right', close,
    body: `
      <p class="sheet-text">Tell us what Oakhum got wrong. We’ll listen, fix it and let you know.</p>
      ${heard ? `<p class="lr-heard"><span class="lr-heard-label">Oakhum heard</span> ${escHtml(heard)}${ctx.a4 !== 440 ? ` <span class="lr-heard-label">· A = ${ctx.a4} Hz</span>` : ''}</p>` : ''}
      ${uiField({ label: 'What was wrong?', id: 'lr-comment',
        control: `<textarea class="input" id="lr-comment" rows="3" maxlength="2000" placeholder="For example: it didn’t hear my lowest note. Mine is a C major with 8 notes.">${escHtml(R.comment)}</textarea>` })}
      ${rec}
      ${uiField({ label: 'A photo of your instrument (if you like)', id: 'lr-photo',
        control: R.photo
          ? `<div class="lr-photo"><img src="${R.photo.url}" alt="Your photo"><button type="button" class="btn btn-ghost btn-sm" data-action="lr-photo-remove">${icon('x')} Remove</button></div>`
          : `<label class="btn btn-secondary lr-photo-add">${icon('camera')} Add a photo<input type="file" accept="image/*" class="sr-only" id="lr-photo" data-action="lr-photo"></label>`,
        help: 'It helps us see how yours is laid out: the holes, the notes, any markings.' })}
      ${uiField({ label: 'Your email (if you’d like to hear back)', id: 'lr-email',
        control: `<input class="input" id="lr-email" type="email" inputmode="email" autocomplete="email" maxlength="200" value="${escHtml(R.email)}" placeholder="you@example.com">`,
        help: 'We keep the report until it’s fixed, at most a year. <a href="/privacy" target="_blank" rel="noopener">Privacy</a>' })}
      ${R.error ? `<p class="field-error" role="alert">${escHtml(R.error)}</p>` : ''}`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="${close}">${R.then ? 'Skip' : 'Not now'}</button>
      <button type="button" class="btn btn-primary" data-action="lr-send"${R.sending ? ' disabled' : ''}>${R.sending ? 'Sending…' : 'Send'}</button>`,
  });
}

async function sendListenReport() {
  const R = state.listenReport;
  if (!R || R.sending) return;
  listenReportKeepFields();
  if (R.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(R.email)) { R.error = 'That email doesn’t look right. Leave it empty if you’d rather not hear back.'; render(); return; }
  Object.assign(R, { sending: true, error: '' });
  render();
  // The recording that fits next to the photo, newest first.
  let room = LISTEN_REPORT_MAX_BYTES - (R.photo?.blob.size ?? 0);
  const takes = (R.withAudio ? (R.takes ?? []) : []).slice().reverse().filter(t => (room -= t.blob.size) >= 0).reverse();
  const meta = {
    ...R.ctx, comment: R.comment.trim(), email: R.email || null,
    takes: takes.map(t => ({ seconds: t.seconds, type: t.type })),
    photo: !!R.photo,
    app: BUILD_HASH, host: location.host, ua: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`, lang: navigator.language,
  };
  const form = new FormData();
  form.append('meta', JSON.stringify(meta));
  takes.forEach((t, i) => form.append('audio', t.blob, `take-${i + 1}.${/mp4/.test(t.type) ? 'm4a' : /ogg/.test(t.type) ? 'ogg' : 'webm'}`));
  if (R.photo) form.append('photo', R.photo.blob, 'instrument.jpg');
  try {
    const res = await fetch(listenReportUrl(), { method: 'POST', body: form });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    Object.assign(R, { sending: false, sent: true });
    listenCheckEvent('reported', R.ctx);
  } catch (e) {
    Object.assign(R, { sending: false, error: navigator.onLine === false ? 'You’re offline. Try again when you’re back online.' : `We couldn’t send it just now (${e.message}). Please try again.` });
  }
  if (state.listenReport === R) render();
}

function listenReportAction(action) {
  if (action === 'lr-open') { openListenReport(); return true; }
  if (!state.listenReport) return false;
  if (action === 'lr-close') { if (!state.listenReport.sent) listenCheckEvent('skipped', state.listenReport.ctx); closeListenReport(); return true; }
  if (action === 'lr-audio') { listenReportKeepFields(); state.listenReport.withAudio = !state.listenReport.withAudio; render(); return true; }
  if (action === 'lr-send') { sendListenReport(); return true; }
  if (action === 'lr-photo-remove') {
    listenReportKeepFields();
    const R = state.listenReport;
    if (R.photo) URL.revokeObjectURL(R.photo.url);
    R.photo = null;
    render();
    return true;
  }
  return false;
}

// A photo picked for the report: shrunk to LISTEN_REPORT_PHOTO_PX as a JPEG.
async function listenReportPhoto(file) {
  const R = state.listenReport;
  if (!R || !file) return;
  listenReportKeepFields();
  try {
    const img = await readImageFile(file, LISTEN_REPORT_PHOTO_PX);
    const blob = await (await fetch(img.src)).blob();
    if (state.listenReport !== R) return;
    if (R.photo) URL.revokeObjectURL(R.photo.url);
    R.photo = { blob, url: URL.createObjectURL(blob) };
  } catch {
    showToast('That photo couldn’t be read');
  }
  render();
}

// The line under a result that opens the report sheet.
function listenReportLinkHtml(text = 'Did Oakhum mishear something?') {
  return `<p class="wizard-foot lr-link">${escHtml(text)} <button type="button" class="link-btn" data-action="lr-open">Send us the recording</button></p>`;
}

// ── Change: Listening reports ─────────────────────────────────────────────
registerActions({
  'lr-photo': (el, e, action) => { listenReportPhoto(el.files?.[0]); return; },
}, CHANGE_ACTIONS);
