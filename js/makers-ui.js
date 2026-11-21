// The makers programme's screens (docs/makers-programme.md): Settings ›
// Makers and shops (#maker), the profile form (#maker/profile), the admin's
// review list (#maker/review), and the "Made by" row and sheet a buyer sees
// on an instrument opened by a maker's code.
//
// Part of the app's bundle only (build.py): everything shares one script
// scope, so this file uses app.js's state, render(), showToast(), navPush()
// and the shared ui* parts directly, and app.js calls in here from its
// render(), sheetHtml(), click / input / change handlers and loadFromHash().
// The pure parts (checks, texts) are in js/makers.js and are tested there.

import {
  MAKER_FAMILIES, MAKER_KINDS, MAKER_LIMITS, MAKER_REPORT_REASONS, makerCountries, makerSlug, makerSlugError,
  validateMakerProfile, makerFormFrom, makerPlaceLine, makerInitials, makerStatusText, makerWebsiteLabel,
  makerLogoOk, sharedOpening, madeByToKeep, makerPagePath,
} from './makers.js';
import {
  fetchMyMaker, saveMakerProfile, adminListMakers, reviewMaker, resolveMakerReport, reportMaker, openSharedCode, isLoggedIn,
} from './auth.js';
import { safeSetItem } from './datastore.js';

const MAKER_VIEWS = { maker: '#maker', 'maker-profile': '#maker/profile', 'maker-review': '#maker/review' };
const MAKER_ACCESS_KEY = 'hp-maker-access'; // { is_maker, is_admin, waiting, status }: what Settings shows before the server answers

// state.mk: everything these screens keep.
function mkState() {
  state.mk ??= {
    info: null,        // my_maker(): { is_maker, is_admin, maker, waiting }
    loading: false, loadError: false,
    form: null, errors: {}, formError: '', busy: false,
    admin: null,       // admin_list_makers(): { makers, reports } | 'error'
    reject: null,      // { id, name, status, note } while the admin writes a note
    madeBy: null,      // the maker whose sheet is open
    report: null,      // { slug, reason, detail, sent, busy } inside that sheet
    opened: null,      // the last instrument opened by code: { code, serial, madeBy }
  };
  return state.mk;
}

function makerAccess() {
  try { return JSON.parse(localStorage.getItem(MAKER_ACCESS_KEY) || 'null') ?? {}; } catch { return {}; }
}
function makerKeepAccess(info) {
  if (!info) { try { localStorage.removeItem(MAKER_ACCESS_KEY); } catch { /* nothing kept */ } return; }
  // safeSetItem (js/datastore.js): a full or blocked store never stops the screen.
  safeSetItem(localStorage, MAKER_ACCESS_KEY, JSON.stringify({ is_maker: !!info.is_maker, is_admin: !!info.is_admin, waiting: info.waiting ?? 0, status: info.maker?.status ?? null }));
}

// Reads the account's maker state again (after sign-in, on opening the
// screen, after a save). Keeps what it knew when the server can't be read.
function makerRefresh() {
  const mk = mkState();
  if (!accountOn() || !isLoggedIn()) { if (!accountOn()) { mk.info = null; makerKeepAccess(null); } return Promise.resolve(null); }
  mk.loading = true;
  return fetchMyMaker().then(info => {
    mk.loading = false;
    mk.loadError = !info;
    if (info) { mk.info = info; makerKeepAccess(info); }
    if (state.view in MAKER_VIEWS || state.view === 'settings') render();
    return info;
  });
}

// ── Navigation ───────────────────────────────────────────────────────────────
function openMaker(view = 'maker', { push = true } = {}) {
  stopAutoplay();
  const mk = mkState();
  Object.assign(state, { view, menu: false });
  if (view === 'maker-profile') { mk.form = makerFormFrom(mk.info?.maker); mk.errors = {}; mk.formError = ''; }
  if (push) navPush(MAKER_VIEWS[view]); else navReplace(MAKER_VIEWS[view]);
  makerRefresh().then(info => {
    if (view === 'maker-profile' && info?.maker && !mk.form?.touched) { mk.form = makerFormFrom(info.maker); render(); }
    if (view === 'maker-review') makerLoadAdmin();
  });
  render();
}

// '#maker…' in the address bar (loadFromHash). True when it was one.
function makerOpenHash(hash) {
  if (hash !== '#maker' && !hash.startsWith('#maker/')) return false;
  const view = hash === '#maker/profile' && accountOn() ? 'maker-profile' : hash === '#maker/review' && makerAccess().is_admin ? 'maker-review' : 'maker';
  const mk = mkState();
  state.view = view;
  if (view === 'maker-profile') { mk.form ??= makerFormFrom(mk.info?.maker); }
  setTimeout(() => makerRefresh().then(info => {
    if (view === 'maker-profile' && info?.maker && !mk.form?.touched) { mk.form = makerFormFrom(info.maker); render(); }
    if (view === 'maker-review') makerLoadAdmin();
  }), 0);
  return true;
}

function makerLoadAdmin() {
  const mk = mkState();
  return adminListMakers().then(list => { mk.admin = list ?? 'error'; if (state.view === 'maker-review') render(); });
}

// ── Shared bits ──────────────────────────────────────────────────────────────
// A maker's logo, or their initials on a tile. size: 'sm' | 'md' | 'lg'.
function makerLogoHtml(maker, size = 'md') {
  const cls = `maker-logo maker-logo-${size}`;
  return maker?.logo && makerLogoOk(maker.logo)
    ? `<img class="${cls}" src="${escHtml(maker.logo)}" alt="">`
    : `<span class="${cls} is-initials" aria-hidden="true">${escHtml(makerInitials(maker?.name))}</span>`;
}

function makerStatusCardHtml(maker) {
  const t = makerStatusText(maker);
  if (!t) return '';
  const page = maker.status === 'approved' ? `
      <div class="maker-status-actions">
        <a class="btn btn-secondary btn-sm" href="${escHtml(makerPagePath(maker.slug))}" target="_blank" rel="noopener">${icon('external-link')} Open your page</a>
        <button type="button" class="btn btn-ghost btn-sm" data-action="maker-copy-page">${icon('link')} Copy its link</button>
      </div>` : maker.status === 'rejected' ? `
      <div class="maker-status-actions"><button type="button" class="btn btn-primary btn-sm" data-action="maker-edit">Change and send again</button></div>` : '';
  return `
    <div class="maker-status is-${t.tone}" role="status">
      <div class="maker-status-title">${escHtml(t.title)}</div>
      <div class="maker-status-body">${escHtml(t.body)}</div>${page}
    </div>`;
}

// ── Settings › Makers and shops (#maker) ─────────────────────────────────────
// The row in Settings. Everyone sees it: it is how a maker finds the programme.
function makerSettingsHtml() {
  const a = accountOn() ? makerAccess() : {};
  const meta = a.status === 'approved' ? 'Your page, your instruments’ codes and how they’re used'
    : a.status === 'pending' ? 'Your request is waiting for approval'
    : a.status ? 'Your maker page needs a look'
    : 'Make or sell instruments? Give every buyer a code that opens theirs';
  const waiting = a.is_admin && a.waiting ? uiBadge(String(a.waiting), 'accent') : '';
  return `
      <h2 class="list-title">Makers and shops</h2>
      <div class="list">
        ${uiRow({ lead: 'hammer', title: a.status ? 'Your maker page' : 'For makers and shops', meta, trail: waiting, action: 'open-maker', chevron: true })}
      </div>`;
}

function viewMaker() {
  const mk = mkState();
  const bar = backAppBar('Makers and shops', { fallback: 'settings' });
  const maker = mk.info?.maker ?? null;
  if (!accountOn() || (!maker && !mk.loading && mk.info) || (!maker && mk.loadError)) {
    // The pitch: a guest, or an account that hasn't asked yet.
    return `${bar}
      <div class="settings maker-screen">
        <h2 class="maker-pitch-title">Help your instruments get played</h2>
        <p class="settings-intro">Oakhum shows every buyer what their own instrument can do: its chords, songs and how to join a jam. Put a code in the case and they open exactly the instrument you built.</p>
        <div class="list">
          ${uiRow({ lead: 'user', title: 'Your page on oakhum.com', meta: 'Your name, logo, story and the instruments you make' })}
          ${uiRow({ lead: 'link', title: 'A code for every instrument', meta: 'A link, a QR card or an NFC tag: one per model, or one per serial number' })}
          ${uiRow({ lead: 'hammer', title: '“Made by you” on the buyer’s screen', meta: 'With your logo and a link to your website' })}
          ${uiRow({ lead: 'music', title: 'See which codes get used', meta: 'Scans, saves and chords played. Counts, never people' })}
        </div>
        <div class="maker-cta">
          <button type="button" class="btn btn-primary btn-lg btn-block" data-action="maker-start">Create your maker page</button>
          <p class="field-help">Free. ${accountOn() ? 'We look at each request before a page goes public.' : 'You sign in with an email code; we look at each request before a page goes public.'}</p>
          ${mk.loadError && accountOn() ? '<p class="field-help is-warning">We couldn’t reach the server just now. Try again when you’re online.</p>' : ''}
        </div>
        ${makerAdminRowHtml()}
      </div>`;
  }
  if (!maker) {
    return `${bar}<div class="settings maker-screen">${uiEmpty({ icon: 'refresh', title: 'Getting your maker page…' })}</div>`;
  }
  return `${bar}
    <div class="settings maker-screen">
      ${makerStatusCardHtml(maker)}
      <h2 class="list-title">Profile</h2>
      <div class="list">
        ${uiRow({ lead: makerLogoHtml(maker), title: maker.name, meta: escHtml(makerPlaceLine(maker)), meta2: maker.website ? escHtml(makerWebsiteLabel(maker.website)) : '', action: 'maker-edit', chevron: true })}
        ${uiRow({ lead: 'eye', title: 'What a buyer sees', meta: 'The “Made by” sheet, as it opens from your instruments', action: 'maker-preview', chevron: true })}
      </div>
      ${typeof makerInstrumentsHtml === 'function' ? makerInstrumentsHtml(maker) : makerInstrumentsSoonHtml()}
      ${makerAdminRowHtml()}
    </div>`;
}

// Until instruments and codes are listed here (phase 2): how it works today.
function makerInstrumentsSoonHtml() {
  return `
      <h2 class="list-title">Your instruments</h2>
      <div class="list">
        ${uiRow({ lead: 'share-2', title: 'Give an instrument its code', meta: 'Save it in My instruments, then ⋯ › Share: its link and QR code open exactly that instrument, with “Made by” once your page is approved', action: 'back-home', chevron: true })}
      </div>`;
}

function makerAdminRowHtml() {
  const info = mkState().info;
  if (!(info?.is_admin ?? makerAccess().is_admin)) return '';
  const n = info?.waiting ?? 0;
  return `
      <h2 class="list-title">Oakhum</h2>
      <div class="list">
        ${uiRow({ lead: 'shield', title: 'Requests and reports', meta: n ? `${n} to look at` : 'Nothing waiting', trail: n ? uiBadge(String(n), 'accent') : '', action: 'maker-review-open', chevron: true })}
      </div>`;
}

// ── The profile form (#maker/profile) ────────────────────────────────────────
function viewMakerProfile() {
  const mk = mkState();
  const f = mk.form ?? (mk.form = makerFormFrom(mk.info?.maker));
  const e = mk.errors;
  const maker = mk.info?.maker ?? null;
  const fixedSlug = maker && (maker.status === 'approved' || maker.status === 'suspended');
  const slug = f.slugEdited ? f.slug : makerSlug(f.name);
  const countries = makerCountries();
  return `${backAppBar(maker ? 'Your maker page' : 'Create your maker page', { fallback: 'settings' })}
    <div class="settings maker-screen">
      ${maker ? '' : '<p class="settings-intro">This is what buyers see next to your instruments, and your page on oakhum.com. You can change it any time.</p>'}
      <div class="list">
        <div class="set-form">
          ${uiField({ label: 'Name of your workshop or shop', id: 'maker-name', error: e.name,
            control: `<input class="input" id="maker-name" data-mk="name" maxlength="${MAKER_LIMITS.name}" value="${escHtml(f.name)}" autocomplete="organization">` })}
          ${uiField({ label: 'Your page’s address', id: 'maker-slug', error: e.slug,
            help: fixedSlug ? 'The address stays the same so links and printed codes keep working' : 'Letters, digits and hyphens. It can’t be changed once your page is approved',
            control: `<span class="maker-slug"><span class="maker-slug-pre">oakhum.com/makers/</span><input class="input" id="maker-slug" data-mk="slug" maxlength="40" value="${escHtml(slug)}"${fixedSlug ? ' disabled' : ''} autocapitalize="none" autocomplete="off" spellcheck="false"></span>` })}
          ${uiField({ label: 'You are a', control: uiSeg(MAKER_KINDS, f.kind, { action: 'maker-kind', label: 'Maker or shop' }) })}
          ${uiField({ label: 'What you make or sell', error: e.families,
            control: `<div class="chips" role="group" aria-label="What you make or sell">${MAKER_FAMILIES.map(x => `
              <button type="button" class="chip" data-action="maker-family" data-family="${x.id}" aria-pressed="${f.families.includes(x.id) ? 'true' : 'false'}">${x.label}</button>`).join('')}</div>` })}
          <div class="maker-two">
            ${uiField({ label: 'Town or city', id: 'maker-place', error: e.place,
              control: `<input class="input" id="maker-place" data-mk="place" maxlength="${MAKER_LIMITS.place}" value="${escHtml(f.place)}" autocomplete="address-level2">` })}
            ${uiField({ label: 'Country', id: 'maker-country', error: e.country,
              control: `<select class="select" id="maker-country" data-mk="country" autocomplete="country"><option value="">Choose…</option>${countries.map(c => `<option value="${c.code}"${c.code === f.country ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}</select>` })}
          </div>
          ${uiField({ label: 'Website', id: 'maker-website', error: e.website, help: 'Buyers can open it from “Made by”',
            control: `<input class="input" id="maker-website" data-mk="website" type="url" inputmode="url" maxlength="${MAKER_LIMITS.website}" placeholder="yourworkshop.com" value="${escHtml(f.website)}" autocapitalize="none" autocomplete="url">` })}
          ${uiField({ label: 'Logo', error: e.logo, help: 'Optional. A square picture works best',
            control: `<div class="maker-logo-pick">${makerLogoHtml({ name: f.name, logo: f.logo }, 'lg')}
              <label class="btn btn-secondary">${icon('camera')} ${f.logo ? 'Change' : 'Choose a picture'}<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" data-action="maker-logo"></label>
              ${f.logo ? '<button type="button" class="btn btn-ghost" data-action="maker-logo-remove">Remove</button>' : ''}</div>` })}
          ${uiField({ label: 'Your story', id: 'maker-story', error: e.story, help: `Optional. A few sentences, in your own language. ${f.story.length} of ${MAKER_LIMITS.story}`,
            control: `<textarea class="input maker-text" id="maker-story" data-mk="story" maxlength="${MAKER_LIMITS.story}" rows="4">${escHtml(f.story)}</textarea>` })}
          ${uiField({ label: 'A note for us', id: 'maker-note', error: e.request_note, help: 'What you build and roughly how many a year. Only we read this',
            control: `<textarea class="input maker-text" id="maker-note" data-mk="request_note" maxlength="${MAKER_LIMITS.note}" rows="3">${escHtml(f.request_note)}</textarea>` })}
        </div>
        ${uiSwitchRow({ label: 'List me among the makers on oakhum.com', help: 'Your page works either way', on: f.listed, action: 'maker-listed' })}
      </div>
      ${mk.formError ? `<p class="field-error maker-form-error" role="alert">${escHtml(mk.formError)}</p>` : ''}
      <div class="maker-cta">
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="maker-save"${mk.busy ? ' disabled' : ''}>${mk.busy ? 'Saving…' : !maker ? 'Send request' : maker.status === 'rejected' ? 'Send again' : 'Save'}</button>
        ${maker ? '' : '<p class="field-help">We look at each request before a page goes public. You can set up your instruments meanwhile.</p>'}
      </div>
    </div>`;
}

// A chosen picture, shrunk to a small square-ish WebP (PNG where the browser
// can't write WebP) the database accepts.
function makerLogoFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let px = MAKER_LIMITS.logoPx;
      for (let attempt = 0; attempt < 4; attempt++, px = Math.round(px * 0.75)) {
        const k = Math.min(1, px / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', 0.9);
        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
        if (makerLogoOk(out) && out.length * 0.75 <= MAKER_LIMITS.logoBytes) { resolve(out); return; }
      }
      reject(new Error('too big'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not a picture')); };
    img.src = url;
  });
}

async function makerSaveProfile() {
  const mk = mkState();
  const f = mk.form;
  if (!f || mk.busy) return;
  const v = validateMakerProfile({ ...f, slug: f.slugEdited ? f.slug : makerSlug(f.name) });
  mk.errors = v.errors;
  mk.formError = v.ok ? '' : 'Check the fields marked above';
  if (!v.ok) { render(); document.querySelector('.maker-screen .has-error')?.scrollIntoView({ block: 'center' }); return; }
  mk.busy = true;
  render();
  const first = !mk.info?.maker;
  const res = await saveMakerProfile(v.value);
  mk.busy = false;
  if (res?.ok) {
    mk.info = { ...(mk.info ?? { is_maker: false, is_admin: false, waiting: 0 }), maker: res.maker };
    makerKeepAccess(mk.info);
    mk.form = null;
    logEvent('maker_profile', { first, status: res.maker.status });
    openMaker('maker', { push: false });
    showToast(first ? 'Request sent' : res.maker.status === 'pending' ? 'Sent again' : 'Saved');
    return;
  }
  if (res?.error === 'slug-taken' || res?.error === 'slug-reserved') mk.errors = { slug: 'That address is taken: try another' };
  mk.formError = res?.error === 'offline' ? 'You’re offline: try again when you’re connected'
    : mk.errors.slug ? 'Check the fields marked above' : 'That didn’t save. Check the fields and try again';
  render();
}

// ── The review list (#maker/review), admins only ─────────────────────────────
function viewMakerReview() {
  const mk = mkState();
  const bar = backAppBar('Requests and reports', { fallback: 'settings' });
  const a = mk.admin;
  if (!a) return `${bar}<div class="settings maker-screen">${uiEmpty({ icon: 'refresh', title: 'Loading…' })}</div>`;
  if (a === 'error') return `${bar}<div class="settings maker-screen">${uiEmpty({ icon: 'cloud-off', title: 'Couldn’t load the list', body: 'It needs a connection and an admin account.' })}</div>`;
  const card = m => `
    <div class="card maker-review-card">
      <div class="maker-review-head">${makerLogoHtml(m)}<div><div class="maker-review-name">${escHtml(m.name)}</div>
        <div class="row-meta">${escHtml(makerPlaceLine(m))}</div>
        <div class="row-meta">oakhum.com/makers/${escHtml(m.slug)} · ${escHtml((m.families ?? []).join(', '))}</div></div></div>
      ${m.website ? `<a class="maker-review-link" href="${escHtml(m.website)}" target="_blank" rel="noopener nofollow">${escHtml(makerWebsiteLabel(m.website))}</a>` : '<div class="row-meta">No website</div>'}
      ${m.request_note ? `<p class="maker-review-note">“${escHtml(m.request_note)}”</p>` : ''}
      ${m.story ? `<p class="maker-review-story"${m.story_lang ? ` lang="${escHtml(m.story_lang)}"` : ''}>${escHtml(m.story)}</p>` : ''}
      ${m.status_note && m.status !== 'approved' ? `<div class="row-meta">Our note: ${escHtml(m.status_note)}</div>` : ''}
      <div class="maker-review-actions">
        ${m.status !== 'approved' ? `<button type="button" class="btn btn-primary btn-sm" data-action="maker-review" data-id="${m.id}" data-status="approved">Approve</button>` : ''}
        ${m.status === 'pending' ? `<button type="button" class="btn btn-secondary btn-sm" data-action="maker-review-note" data-id="${m.id}" data-status="rejected">Not now…</button>` : ''}
        ${m.status === 'approved' ? `<button type="button" class="btn btn-danger btn-sm" data-action="maker-review-note" data-id="${m.id}" data-status="suspended">Suspend…</button>` : ''}
      </div>
    </div>`;
  const by = s => a.makers.filter(m => m.status === s);
  const section = (title, list) => (list.length ? `<h2 class="list-title">${title} · ${list.length}</h2>${list.map(card).join('')}` : '');
  const reasons = Object.fromEntries(MAKER_REPORT_REASONS.map(r => [r.value, r.label]));
  const reports = a.reports.length ? `
      <h2 class="list-title">Reports · ${a.reports.length}</h2>
      <div class="list">${a.reports.map(r => uiRow({
        title: r.name, meta: escHtml(reasons[r.reason] ?? r.reason) + (r.detail ? `: “${escHtml(r.detail)}”` : ''), meta2: escHtml(new Date(r.created_at).toLocaleDateString()),
        trail: `<button type="button" class="btn btn-ghost btn-sm" data-action="maker-report-done" data-id="${r.id}">Done</button>`,
      })).join('')}</div>` : '';
  const none = !a.makers.length && !a.reports.length ? uiEmpty({ icon: 'check', title: 'Nothing here yet', body: 'Maker requests show here as they come in.' }) : '';
  return `${bar}
    <div class="settings maker-screen">
      ${none}${section('Waiting', by('pending'))}${reports}${section('Approved', by('approved'))}${section('Suspended', by('suspended'))}${section('Not now', by('rejected'))}
    </div>`;
}

function makerRejectSheet() {
  const r = mkState().reject;
  const suspend = r.status === 'suspended';
  return uiSheet({
    key: 'maker-reject', title: suspend ? `Suspend ${r.name}?` : `Not now: ${r.name}`, close: 'maker-reject-cancel', variant: 'confirm',
    body: `
      <p class="sheet-text">${suspend ? 'Their page, directory entry and “Made by” are hidden at once. Their codes keep opening the instruments.' : 'They can change their profile and send it again.'}</p>
      ${uiField({ label: 'A sentence they will see', id: 'maker-reject-note',
        control: `<textarea class="input maker-text" id="maker-reject-note" rows="3" maxlength="600" placeholder="${suspend ? 'Why, and how to sort it out' : 'What is missing'}">${escHtml(r.note)}</textarea>` })}`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="maker-reject-cancel">Cancel</button>
      <button type="button" class="btn ${suspend ? 'btn-danger' : 'btn-primary'}" data-action="maker-reject-ok">${suspend ? 'Suspend' : 'Send'}</button>`,
  });
}

async function makerReview(id, status, note = null) {
  const res = await reviewMaker(id, status, note);
  if (!res?.ok) { showToast('That didn’t work: check the connection'); return; }
  showToast({ approved: 'Approved', rejected: 'Sent back', suspended: 'Suspended', pending: 'Reopened' }[status] ?? 'Done');
  await makerLoadAdmin();
  makerRefresh();
}

// ── "Made by", on an instrument opened by a maker's code ─────────────────────
// Who made the instrument on screen, or null: the layout's or the
// instrument's own note of it (set from the server's answer only).
function currentMadeBy() {
  const kept = state.layout ? state.layout.madeBy : state.view === 'instrument' ? currentInstrument()?.madeBy : null;
  if (!kept?.slug || !kept?.name) return null;
  const opened = mkState().opened?.madeBy;
  return opened && opened.slug === kept.slug ? { ...kept, ...opened } : kept;
}

// The row under the app bar, the same on every instrument.
function madeByRowHtml() {
  const m = currentMadeBy();
  if (!m) return '';
  return `
    <button type="button" class="made-by" data-action="made-by-open">
      ${makerLogoHtml(m, 'sm')}<span class="made-by-text">Made by <strong>${escHtml(m.name)}</strong></span>${icon('chevron-right')}
    </button>`;
}

// Opens a shared code with who made it, and remembers that for the row.
// Resolves to { data, code, serial, madeBy } (data never carries a maker of
// its own) or null.
async function makerOpenCode(code) {
  const opening = sharedOpening(await openSharedCode(code), code);
  mkState().opened = opening ? { code: opening.code, serial: opening.serial, madeBy: opening.madeBy } : null;
  return opening;
}

// Marks what was just opened with its maker: the layout on screen, or the
// shared ocarina / flute. Called right after the app has opened it.
function makerMarkOpened(opening) {
  const keep = madeByToKeep(opening?.madeBy);
  if (state.layout) { if (keep) state.layout.madeBy = keep; else delete state.layout.madeBy; }
  else if (state.shared) { if (keep) state.shared.madeBy = keep; else delete state.shared.madeBy; }
}

function madeBySheet() {
  const mk = mkState();
  const m = mk.madeBy;
  const r = mk.report;
  if (r) {
    return uiSheet({
      key: 'maker-report', title: 'Report this profile', close: 'made-by-close',
      body: r.sent ? '<p class="sheet-text">Thank you. We’ll look at it.</p>' : `
        <div class="list">${MAKER_REPORT_REASONS.map(x => `
          <button type="button" class="row no-lead" role="radio" aria-checked="${r.reason === x.value ? 'true' : 'false'}" data-action="maker-report-reason" data-reason="${x.value}">
            <span class="row-text"><span class="row-title">${escHtml(x.label)}</span></span><span class="row-trail">${r.reason === x.value ? icon('check') : ''}</span></button>`).join('')}</div>
        ${uiField({ label: 'Anything to add? (optional)', id: 'maker-report-detail',
          control: `<textarea class="input maker-text" id="maker-report-detail" rows="2" maxlength="500">${escHtml(r.detail)}</textarea>` })}`,
      footer: r.sent ? '<button type="button" class="btn btn-primary" data-action="made-by-close">Close</button>' : `
        <button type="button" class="btn btn-ghost" data-action="maker-report-back">Back</button>
        <button type="button" class="btn btn-primary" data-action="maker-report-send"${r.reason && !r.busy ? '' : ' disabled'}>Send</button>`,
    });
  }
  return uiSheet({
    key: 'made-by', title: 'Made by', close: 'made-by-close',
    body: `
      <div class="maker-card">
        ${makerLogoHtml(m, 'lg')}
        <div><div class="maker-card-name">${escHtml(m.name)}</div><div class="row-meta">${escHtml(makerPlaceLine(m))}</div></div>
      </div>
      ${m.story ? `<p class="sheet-text maker-card-story"${m.story_lang ? ` lang="${escHtml(m.story_lang)}"` : ''}>${escHtml(m.story)}</p>` : ''}
      <div class="maker-card-links">
        ${m.website ? `<a class="btn btn-secondary btn-block" href="${escHtml(m.website)}" target="_blank" rel="noopener nofollow">${icon('external-link')} ${escHtml(makerWebsiteLabel(m.website))}</a>` : ''}
        ${m.preview ? '' : `<a class="btn btn-secondary btn-block" href="${escHtml(makerPagePath(m.slug))}" target="_blank" rel="noopener">More from this maker</a>`}
      </div>
      ${m.preview ? '<p class="field-help">This is what a buyer sees when they tap “Made by” on one of your instruments.</p>' : `<button type="button" class="btn btn-ghost btn-sm maker-report-link" data-action="maker-report-open">Report this profile</button>`}`,
  });
}

// The sheet of these screens that is open, or '' (sheetHtml).
function makerSheetHtml() {
  const mk = state.mk;
  if (!mk) return '';
  if (mk.reject && state.view === 'maker-review') return makerRejectSheet();
  if (mk.madeBy) return madeBySheet();
  return '';
}

// ── Events ───────────────────────────────────────────────────────────────────
// A tap on one of these screens' actions. True when it was handled.
function makerClick(action, el) {
  if (!action.startsWith('maker-') && !action.startsWith('made-by-') && action !== 'open-maker') return false;
  const mk = mkState();
  if (action === 'open-maker') { openMaker('maker'); return true; }
  if (action === 'maker-start' || action === 'maker-edit') { openMaker('maker-profile'); return true; }
  if (action === 'maker-review-open') { mk.admin = null; openMaker('maker-review'); return true; }
  if (action === 'maker-kind') { if (mk.form) { mk.form.kind = el.dataset.value; mk.form.touched = true; render(); } return true; }
  if (action === 'maker-family') {
    if (!mk.form) return true;
    const id = el.dataset.family;
    mk.form.families = mk.form.families.includes(id) ? mk.form.families.filter(x => x !== id) : [...mk.form.families, id];
    mk.form.touched = true;
    delete mk.errors.families;
    render();
    return true;
  }
  if (action === 'maker-listed') { if (mk.form) { mk.form.listed = !mk.form.listed; mk.form.touched = true; render(); } return true; }
  if (action === 'maker-logo-remove') { if (mk.form) { mk.form.logo = ''; mk.form.touched = true; render(); } return true; }
  if (action === 'maker-save') { makerSaveProfile(); return true; }
  if (action === 'maker-copy-page') {
    const url = location.origin + makerPagePath(mk.info?.maker?.slug ?? '');
    navigator.clipboard?.writeText(url).then(() => showToast('Link copied'), () => showToast(url));
    return true;
  }
  if (action === 'maker-preview') { mk.madeBy = { ...mk.info.maker, preview: true }; mk.report = null; render(); return true; }

  // The review list
  if (action === 'maker-review') { makerReview(el.dataset.id, el.dataset.status); return true; }
  if (action === 'maker-review-note') {
    const m = mk.admin?.makers?.find(x => x.id === el.dataset.id);
    if (m) { mk.reject = { id: m.id, name: m.name, status: el.dataset.status, note: '' }; render(); }
    return true;
  }
  if (action === 'maker-reject-cancel') { mk.reject = null; render(); return true; }
  if (action === 'maker-reject-ok') {
    const r = mk.reject;
    const note = (document.getElementById('maker-reject-note')?.value ?? r.note).trim();
    mk.reject = null;
    render();
    makerReview(r.id, r.status, note || null);
    return true;
  }
  if (action === 'maker-report-done') { resolveMakerReport(el.dataset.id).then(() => makerLoadAdmin()).then(() => makerRefresh()); return true; }

  // Made by
  if (action === 'made-by-open') { const m = currentMadeBy(); if (m) { mk.madeBy = m; mk.report = null; logEvent('made_by_open', {}); render(); } return true; }
  if (action === 'made-by-close') { mk.madeBy = null; mk.report = null; render(); return true; }
  if (action === 'maker-report-open') { mk.report = { slug: mk.madeBy.slug, reason: '', detail: '', sent: false, busy: false }; render(); return true; }
  if (action === 'maker-report-back') { mk.report = null; render(); return true; }
  if (action === 'maker-report-reason') {
    mk.report.detail = document.getElementById('maker-report-detail')?.value ?? mk.report.detail;
    mk.report.reason = el.dataset.reason;
    render();
    return true;
  }
  if (action === 'maker-report-send') {
    const r = mk.report;
    r.detail = document.getElementById('maker-report-detail')?.value ?? r.detail;
    r.busy = true;
    render();
    reportMaker(r.slug, r.reason, r.detail.trim() || null).then(ok => {
      if (!mk.report) return;
      if (ok) mk.report.sent = true; else { mk.report.busy = false; showToast('That didn’t send: check the connection'); }
      render();
    });
    return true;
  }
  return true; // a maker action from another phase's screen: nothing to do here
}

// Typing in the profile form. True when the field was one of ours.
function makerInput(target) {
  const key = target.dataset?.mk;
  const mk = state.mk;
  if (!key || !mk?.form) return false;
  mk.form[key] = target.value;
  mk.form.touched = true;
  if (key === 'slug') mk.form.slugEdited = true;
  if (key === 'name' && !mk.form.slugEdited) {
    const slugInput = document.getElementById('maker-slug');
    if (slugInput) slugInput.value = makerSlug(target.value);
  }
  return true;
}

// A changed control (the country, the address on leaving it, a chosen logo).
function makerChange(el) {
  const mk = state.mk;
  if (!mk?.form) return false;
  if (el.dataset.action === 'maker-logo') {
    const file = el.files?.[0];
    if (!file) return true;
    makerLogoFromFile(file).then(
      logo => { mk.form.logo = logo; mk.form.touched = true; delete mk.errors.logo; render(); },
      () => { mk.errors.logo = 'That picture can’t be used: try a PNG or JPEG'; render(); });
    return true;
  }
  const key = el.dataset.mk;
  if (!key) return false;
  mk.form[key] = el.value;
  if (key === 'slug') {
    mk.form.slug = makerSlug(el.value);
    mk.form.slugEdited = !!mk.form.slug;
    const err = mk.form.slug ? makerSlugError(mk.form.slug) : '';
    if (err) mk.errors.slug = err; else delete mk.errors.slug;
    render();
  }
  return true;
}
