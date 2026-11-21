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
  makerCodeUrl, makerCodeLabel, makerViaFromSearch, parseSerials, qrCardSvg, qrSheetSvgs, qrPrintDocument, MAKER_CARD_FORMATS,
  makerImportRows, MAKER_IMPORT_EXAMPLE,
} from './makers.js';
import {
  fetchMyMaker, saveMakerProfile, adminListMakers, reviewMaker, resolveMakerReport, reportMaker, openSharedCode, isLoggedIn,
  fetchMakerCodes, createMakerCodes, retireMakerCode, logMakerEvent, saveCloudInstruments,
} from './auth.js';

const MAKER_VIEWS = { maker: '#maker', 'maker-profile': '#maker/profile', 'maker-review': '#maker/review', 'maker-inst': '#maker/i', 'maker-import': '#maker/import' };
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
    opened: null,      // the last instrument opened by code: { code, serial, madeBy, via }
    instId: null,      // the instrument on #maker/i/<id>
    codes: null,       // fetchMakerCodes(): every serial code of the account
    serialsSheet: null, // { text, error, busy } while adding serial numbers
    card: null,        // { title, items: [{ code, serial }], format, svg, busy } while the card sheet is open
    nfc: null,         // { code, serial } while the NFC sheet is open
    imp: null,         // the import screen: { text, checked: { rows, error }, busy, done }
    played: { chords: 0, songs: 0, sentChords: false, sentSongs: false }, // this visit's counts for the opened code, not yet sent
  };
  return state.mk;
}

function makerAccess() {
  try { return JSON.parse(localStorage.getItem(MAKER_ACCESS_KEY) || 'null') ?? {}; } catch { return {}; }
}
function makerKeepAccess(info) {
  try {
    if (!info) localStorage.removeItem(MAKER_ACCESS_KEY);
    else localStorage.setItem(MAKER_ACCESS_KEY, JSON.stringify({ is_maker: !!info.is_maker, is_admin: !!info.is_admin, waiting: info.waiting ?? 0, status: info.maker?.status ?? null }));
  } catch { /* shown again next time */ }
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
function openMaker(view = 'maker', { push = true, id = null } = {}) {
  stopAutoplay();
  const mk = mkState();
  Object.assign(state, { view, menu: false });
  if (view === 'maker-profile') { mk.form = makerFormFrom(mk.info?.maker); mk.errors = {}; mk.formError = ''; }
  if (view === 'maker-inst') mk.instId = id;
  if (view === 'maker-import') mk.imp = { text: '', checked: null, busy: false, done: null };
  const url = view === 'maker-inst' ? `${MAKER_VIEWS[view]}/${encodeURIComponent(id)}` : MAKER_VIEWS[view];
  if (push) navPush(url); else navReplace(url);
  makerRefresh().then(info => {
    if (view === 'maker-profile' && info?.maker && !mk.form?.touched) { mk.form = makerFormFrom(info.maker); render(); }
    if (view === 'maker-review') makerLoadAdmin();
  });
  if (view === 'maker' || view === 'maker-inst') makerLoadCodes();
  render();
}

// '#maker…' in the address bar (loadFromHash). True when it was one.
function makerOpenHash(hash) {
  if (hash !== '#maker' && !hash.startsWith('#maker/')) return false;
  const instId = hash.startsWith('#maker/i/') ? decodeURIComponent(hash.slice(9)) : null;
  const view = hash === '#maker/profile' && accountOn() ? 'maker-profile' : hash === '#maker/review' && makerAccess().is_admin ? 'maker-review'
    : instId && accountOn() && getInstrument(instId) ? 'maker-inst' : hash === '#maker/import' && accountOn() ? 'maker-import' : 'maker';
  const mk = mkState();
  state.view = view;
  if (view === 'maker-inst') mk.instId = instId;
  if (view === 'maker-import') mk.imp ??= { text: '', checked: null, busy: false, done: null };
  if (view === 'maker' || view === 'maker-inst') setTimeout(makerLoadCodes, 0);
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
      ${makerInstrumentsHtml(maker)}
      ${makerAdminRowHtml()}
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
  const mk = mkState();
  makerFlushPlayed();
  // Only the page's own first open came from the card or the tag.
  const via = _makerLandingUsed ? null : MAKER_LANDING_VIA;
  _makerLandingUsed = true;
  const again = mk.opened?.code === opening?.code;
  mk.opened = opening ? { code: opening.code, serial: opening.serial, madeBy: opening.madeBy, via: again ? mk.opened.via : via } : null;
  if (opening && !again) {
    mk.played = { chords: 0, songs: 0, sentChords: false, sentSongs: false };
    logMakerEvent(opening.code, 'open', { via });
  }
  return opening;
}

// Marks what was just opened with its maker: the layout on screen, or the
// shared ocarina / flute. Called right after the app has opened it.
function makerMarkOpened(opening) {
  const keep = madeByToKeep(opening?.madeBy);
  const target = state.layout ?? state.shared;
  if (!target) return;
  if (keep) target.madeBy = keep; else delete target.madeBy;
  // The code it came from: its scans are counted while it is on screen, and
  // the address stays the code's (makerCodePath).
  if (opening?.code) target.fromCode = opening.code; else delete target.fromCode;
  if (state.layout && opening?.code) navReplace(stateToHash());
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
  if (mk.serialsSheet && state.view === 'maker-inst') return makerSerialsSheet();
  if (mk.card && state.view === 'maker-inst') return makerCardSheet();
  if (mk.nfc && state.view === 'maker-inst') return makerNfcSheet();
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
  // Instruments and codes
  if (action === 'maker-inst-open') { openMaker('maker-inst', { id: el.dataset.id }); return true; }
  if (action === 'maker-add-inst') { goHome(); state.view = 'play'; state.playNotice = null; render(); return true; }
  if (action === 'maker-import-open') { openMaker('maker-import'); return true; }
  if (action === 'maker-copy') {
    navigator.clipboard?.writeText(el.dataset.text).then(() => showToast('Link copied'), () => showToast('Copy the link from the box'));
    return true;
  }
  if (action === 'maker-share') {
    if (!isLoggedIn()) { showToast('Sharing needs a connection'); return true; }
    makerShareInstruments([el.dataset.id]).then(ok => { if (!ok) showToast('That didn’t work: check the connection'); render(); });
    return true;
  }
  if (action === 'maker-hide-toggle') {
    const inst = getInstrument(el.dataset.id);
    if (!inst) return true;
    if (inst.hideMaker) delete inst.hideMaker; else inst.hideMaker = true;
    saveInstrument(inst);
    refreshInstruments();
    render();
    saveCloudInstruments([getInstrument(inst.id)]).then(ok => { if (ok !== true) showToast('That will be sent when you’re online'); });
    return true;
  }
  if (action === 'maker-serials-open') { mk.serialsSheet = { text: '', error: '', busy: false }; render(); return true; }
  if (action === 'maker-serials-cancel') { mk.serialsSheet = null; render(); return true; }
  if (action === 'maker-serials-ok') {
    const sh = mk.serialsSheet;
    sh.text = document.getElementById('maker-serials-input')?.value ?? sh.text;
    const parsed = parseSerials(sh.text);
    if (parsed.error) { sh.error = parsed.error; render(); return true; }
    sh.busy = true; sh.error = '';
    render();
    createMakerCodes(mk.instId, parsed.serials).then(res => {
      if (!mk.serialsSheet) return;
      if (res?.ok) {
        mk.codes = [...(mk.codes ?? []).filter(c => c.instrument_id !== mk.instId), ...res.codes.map(c => ({ ...c, instrument_id: mk.instId }))];
        mk.serialsSheet = null;
        showToast(`${parsed.serials.length} serial number${parsed.serials.length !== 1 ? 's' : ''} added`);
      } else {
        sh.busy = false;
        sh.error = res?.error === 'too-many' ? 'That is more than one instrument can have' : res?.error === 'not-shared' ? 'Give the instrument a code first' : 'That didn’t work: check the connection';
      }
      render();
    });
    return true;
  }
  if (action === 'maker-code-retire') {
    const retired = el.dataset.retired === '1';
    retireMakerCode(el.dataset.code, retired).then(ok => {
      if (!ok) { showToast('That didn’t work: check the connection'); return; }
      const c = (mk.codes ?? []).find(x => x.code === el.dataset.code);
      if (c) c.retired_at = retired ? new Date().toISOString() : null;
      showToast(retired ? 'Retired: this code opens nothing now' : 'The code works again');
      render();
    });
    return true;
  }
  if (action === 'maker-card-open') { makerOpenCard(el.dataset.code); return true; }
  if (action === 'maker-card-close') { mk.card = null; render(); return true; }
  if (action === 'maker-card-format') { if (mk.card) { mk.card.format = el.dataset.value; mk.card.svg = null; render(); makerCardPreview(); } return true; }
  if (action === 'maker-card-svg') {
    const inst = getInstrument(mk.instId);
    const item = mk.card.items[0];
    makerDownload(`oakhum-${linkSlug(inst.name)}${item.serial ? '-' + linkSlug(item.serial) : ''}-${mk.card.format}.svg`, mk.card.svg, 'image/svg+xml');
    return true;
  }
  if (action === 'maker-card-print') { makerPrintCards(); return true; }
  if (action === 'maker-nfc-open') {
    const c = makerCodesOf(mk.instId).find(x => x.code === el.dataset.code);
    mk.nfc = { code: el.dataset.code, serial: c?.serial ?? null };
    render();
    return true;
  }
  if (action === 'maker-nfc-close') { mk.nfc = null; render(); return true; }

  // Importing a list
  if (action === 'maker-import-example') { mk.imp.text = MAKER_IMPORT_EXAMPLE; mk.imp.checked = makerImportRows(mk.imp.text, { parseLink, closestLinks, safeNoteName }); render(); return true; }
  if (action === 'maker-import-check') { makerImportCheck(); return true; }
  if (action === 'maker-import-go') { makerImportGo(); return true; }
  return true; // a maker action from another phase's screen: nothing to do here
}

// Typing in the profile form. True when the field was one of ours.
function makerInput(target) {
  const key = target.dataset?.mk;
  const mk = state.mk;
  if (target.id === 'maker-import-text' && mk?.imp) { mk.imp.text = target.value; return true; }
  if (target.id === 'maker-serials-input' && mk?.serialsSheet) { mk.serialsSheet.text = target.value; return true; }
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
  if (el.dataset?.action === 'maker-import-file' && mk?.imp) {
    const file = el.files?.[0];
    if (!file) return true;
    if (file.size > 500000) { showToast('That file is too big for a list'); return true; }
    file.text().then(text => { mk.imp.text = text; mk.imp.checked = makerImportRows(text, { parseLink, closestLinks, safeNoteName }); render(); });
    return true;
  }
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

// ════════════════════════════════════════════════════════════════════════════
// Phase 2: the maker's instruments, their codes, the printed card, importing
// a list, and counting how codes are used.
// ════════════════════════════════════════════════════════════════════════════

function makerLoadCodes() {
  const mk = mkState();
  if (!accountOn() || !isLoggedIn()) return Promise.resolve(null);
  return fetchMakerCodes().then(list => {
    if (list) mk.codes = list;
    if (state.view === 'maker' || state.view === 'maker-inst') render();
    return list;
  });
}
function makerCodesOf(instId, { retired = true } = {}) {
  return (mkState().codes ?? []).filter(c => c.instrument_id === instId && (retired || !c.retired_at));
}
function makerOrigin() { return location.origin; }

// ── Your instruments (on #maker) ─────────────────────────────────────────────
function makerInstrumentsHtml(maker) {
  const list = state.instruments ?? [];
  const rows = list.map(inst => {
    const n = makerCodesOf(inst.id, { retired: false }).length;
    const meta = inst.publicId
      ? `${escHtml(inst.publicId)}${n ? ` · ${n} serial number${n !== 1 ? 's' : ''}` : ''}${inst.hideMaker ? ' · “Made by” off' : ''}`
      : 'No code yet';
    return uiRow({
      lead: FAMILY_ICONS[inst.family] ?? 'music', title: inst.name, meta, chevron: true,
      trail: inst.publicId ? '' : uiBadge('Share'), action: 'maker-inst-open', data: { id: inst.id },
    });
  }).join('');
  return `
      <h2 class="list-title">Your instruments${list.length ? ` · ${list.length}` : ''}</h2>
      <div class="list">
        ${rows || uiRow({ lead: 'info', title: 'No instruments yet', meta: 'Set one up the way a player does: from our scales, your own notes, or play it and the app listens' })}
      </div>
      <div class="maker-actions">
        <button type="button" class="btn btn-secondary" data-action="maker-add-inst">${icon('plus')} Add an instrument</button>
        <button type="button" class="btn btn-secondary" data-action="maker-import-open">${icon('clipboard-paste')} Import a list</button>
      </div>`;
}

// ── One instrument's codes (#maker/i/<id>) ───────────────────────────────────
function viewMakerInst() {
  const mk = mkState();
  const inst = getInstrument(mk.instId);
  const bar = backAppBar(inst?.name ?? 'Instrument', { fallback: 'settings' });
  if (!inst) return `${bar}<div class="settings maker-screen">${uiEmpty({ icon: 'info', title: 'That instrument isn’t here any more' })}</div>`;
  if (!inst.publicId) {
    return `${bar}
      <div class="settings maker-screen">
        ${uiEmpty({ icon: 'share-2', title: 'This instrument has no code yet', body: 'Sharing gives it a link and a code that open exactly this instrument.',
          action: `<button type="button" class="btn btn-primary" data-action="maker-share" data-id="${escHtml(inst.id)}">Give it a code</button>` })}
      </div>`;
  }
  const maker = mk.info?.maker ?? null;
  const url = makerCodeUrl(makerOrigin(), inst.publicId);
  const codes = makerCodesOf(inst.id);
  const active = codes.filter(c => !c.retired_at);
  const serialRows = codes.map(c => uiRow({
    title: `No. ${c.serial}`, cls: c.retired_at ? 'is-retired' : '',
    meta: `${escHtml(c.code)}${c.retired_at ? ' · retired: opens nothing' : ''}`,
    trail: c.retired_at
      ? `<button type="button" class="btn btn-ghost btn-sm" data-action="maker-code-retire" data-code="${c.code}" data-retired="0">Bring back</button>`
      : `<button type="button" class="btn btn-ghost btn-sm" data-action="maker-card-open" data-code="${c.code}">Card</button>
         <button type="button" class="btn btn-ghost btn-sm" data-action="maker-nfc-open" data-code="${c.code}">NFC</button>
         ${uiIconBtn('trash-2', `Retire the code of no. ${c.serial}`, { action: 'maker-code-retire', data: { code: c.code, retired: '1' } })}`,
  })).join('');
  return `${bar}
    <div class="settings maker-screen">
      <div class="card maker-code-card">
        <div class="maker-code-main">
          <div class="maker-code">${escHtml(inst.publicId)}</div>
          <div class="maker-code-url">${escHtml(makerCodeLabel(makerOrigin(), inst.publicId))}</div>
          <div class="row-meta">Opens this instrument for anyone, ready to play${maker?.status === 'approved' && !inst.hideMaker ? `, with “Made by ${escHtml(maker.name)}”` : ''}</div>
        </div>
        <div class="maker-code-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="maker-copy" data-text="${escHtml(url)}">${icon('link')} Copy link</button>
          <button type="button" class="btn btn-primary btn-sm" data-action="maker-card-open" data-code="${escHtml(inst.publicId)}">QR card</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="maker-nfc-open" data-code="${escHtml(inst.publicId)}">NFC tag</button>
          <a class="btn btn-ghost btn-sm" href="${escHtml(url)}" target="_blank" rel="noopener">${icon('external-link')} Open</a>
        </div>
      </div>
      ${maker ? `<div class="list">${uiSwitchRow({ label: `Show “Made by ${maker.name}”`, help: maker.status === 'approved' ? 'Off for an instrument you share but didn’t make' : 'Shows once your maker page is approved', on: !inst.hideMaker, action: 'maker-hide-toggle', data: { id: inst.id } })}</div>` : ''}
      ${typeof makerInstStatsHtml === 'function' ? makerInstStatsHtml(inst, codes) : ''}
      <h2 class="list-title">Serial numbers${codes.length ? ` · ${active.length}` : ''}</h2>
      <div class="list">
        ${serialRows || uiRow({ lead: 'list-ordered', title: 'One code per instrument you build', meta: 'Give each serial number its own code and card. All of them open this instrument, and you see each one’s scans' })}
      </div>
      <div class="maker-actions">
        <button type="button" class="btn btn-secondary" data-action="maker-serials-open">${icon('plus')} Add serial numbers</button>
        ${active.length ? `<button type="button" class="btn btn-secondary" data-action="maker-card-open" data-code="all">${icon('download')} Print all cards</button>` : ''}
      </div>
    </div>`;
}

// Gives instruments their share code (as Share does), a handpan, tongue drum
// or kalimba with a copy of its notes. True when the server has them.
async function makerShareInstruments(ids) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const list = [];
    for (const id of ids) {
      const inst = getInstrument(id);
      if (!inst) continue;
      if (usesLayout(inst)) {
        const saved = getSavedLayouts().find(l => l.id === inst.layoutId);
        if (!saved) continue;
        inst.layout = JSON.parse(JSON.stringify(saved.layout));
      }
      if (!inst.publicId || attempt > 0) inst.publicId = inst._hadCode ?? newPublicId();
      saveInstrument(inst);
      list.push(getInstrument(id));
    }
    const ok = await saveCloudInstruments(list);
    if (ok === true) { refreshInstruments(); return true; }
    if (ok !== '23505') {
      // Not shared after all: take the codes back so nothing shows a code that opens nothing.
      for (const i of list) { const inst = getInstrument(i.id); if (inst) { delete inst.publicId; saveInstrument(inst); } }
      refreshInstruments();
      return false;
    }
  }
  return false;
}

function makerSerialsSheet() {
  const s = mkState().serialsSheet;
  return uiSheet({
    key: 'maker-serials', title: 'Add serial numbers', close: 'maker-serials-cancel',
    body: `
      <p class="sheet-text">Each one gets its own code and card. They all open this instrument.</p>
      ${uiField({ label: 'Serial numbers', id: 'maker-serials-input', error: s.error, help: 'For example 17, 18, 21-30 or A-07',
        control: `<textarea class="input maker-text" id="maker-serials-input" rows="3" autocapitalize="characters" spellcheck="false">${escHtml(s.text)}</textarea>` })}`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="maker-serials-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="maker-serials-ok"${s.busy ? ' disabled' : ''}>${s.busy ? 'Adding…' : 'Add'}</button>`,
  });
}

// ── The printed card ─────────────────────────────────────────────────────────
// A QR code's squares for a link (the QR library loads on first use).
async function makerQrModules(url) {
  const qrcode = await loadQrLib();
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
// What goes on the cards of the open sheet: [{ modules, name, serial, maker, logo, label }].
async function makerCardData() {
  const mk = mkState();
  const inst = getInstrument(mk.instId);
  const maker = mk.info?.maker ?? null;
  const out = [];
  for (const item of mk.card.items) {
    out.push({
      modules: await makerQrModules(makerCodeUrl(makerOrigin(), item.code, 'qr')),
      name: inst.name, serial: item.serial ?? '', maker: maker && !inst.hideMaker ? maker.name : '', logo: maker && !inst.hideMaker ? maker.logo ?? '' : '',
      label: makerCodeLabel(makerOrigin(), item.code),
    });
  }
  return out;
}
function makerOpenCard(code) {
  const mk = mkState();
  const inst = getInstrument(mk.instId);
  if (!inst?.publicId) return;
  const serials = makerCodesOf(inst.id, { retired: false });
  const items = code === 'all' ? serials.map(c => ({ code: c.code, serial: c.serial }))
    : code === inst.publicId ? [{ code, serial: null }] : serials.filter(c => c.code === code).map(c => ({ code: c.code, serial: c.serial }));
  if (!items.length) return;
  mk.card = { title: items.length > 1 ? `${items.length} cards` : items[0].serial ? `Card for no. ${items[0].serial}` : 'QR card', items, format: 'card', svg: null, failed: false };
  render();
  makerCardPreview();
}
function makerCardPreview() {
  const mk = mkState();
  const card = mk.card;
  makerCardData().then(cards => {
    if (mk.card !== card) return;
    card.svg = qrCardSvg(cards[0], card.format);
    render();
  }, () => { if (mk.card === card) { card.failed = true; render(); } });
}
function makerCardSheet() {
  const c = mkState().card;
  const many = c.items.length > 1;
  return uiSheet({
    key: 'maker-card', title: c.title, close: 'maker-card-close',
    body: `
      <div class="maker-card-preview">${c.svg ?? `<span class="share-loading">${c.failed ? 'The QR code needs a connection the first time' : 'Drawing the card…'}</span>`}</div>
      ${uiField({ label: 'Print as', help: escHtml(MAKER_CARD_FORMATS[c.format].hint),
        control: uiSeg(Object.entries(MAKER_CARD_FORMATS).map(([value, f]) => ({ value, label: f.label })), c.format, { action: 'maker-card-format', label: 'Print as' }) })}
      <p class="field-help">The code on the card counts as a QR scan in your numbers. Print at 100%, not “fit to page”.</p>`,
    footer: `
      ${many ? '' : `<button type="button" class="btn btn-secondary" data-action="maker-card-svg"${c.svg ? '' : ' disabled'}>${icon('download')} SVG</button>`}
      <button type="button" class="btn btn-primary" data-action="maker-card-print"${c.svg ? '' : ' disabled'}>Print${many ? ` ${c.items.length} cards` : ''} or save as PDF</button>`,
  });
}
function makerDownload(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function makerPrintCards() {
  const mk = mkState();
  const c = mk.card;
  // Opened now, inside the tap, so the browser allows it; filled when the codes are drawn.
  const win = window.open('', '_blank');
  const inst = getInstrument(mk.instId);
  const doc = qrPrintDocument(qrSheetSvgs(await makerCardData(), c.format), `${inst.name}: ${MAKER_CARD_FORMATS[c.format].label.toLowerCase()}`);
  logEvent('maker_cards', { count: c.items.length, format: c.format });
  if (!win) { makerDownload(`oakhum-${linkSlug(inst.name)}-${c.format}s.html`, doc, 'text/html'); showToast('Saved as a file: open it and print'); return; }
  win.document.open();
  win.document.write(doc);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch { /* they can print from the menu */ } }, 300);
}

function makerNfcSheet() {
  const n = mkState().nfc;
  const url = makerCodeUrl(makerOrigin(), n.code, 'nfc');
  return uiSheet({
    key: 'maker-nfc', title: n.serial ? `NFC tag for no. ${n.serial}` : 'NFC tag', close: 'maker-nfc-close',
    body: `
      <p class="sheet-text">Write this link to a tag. A buyer holds their phone to it and the instrument opens.</p>
      <input class="input share-url" readonly value="${escHtml(url)}" aria-label="Link for the NFC tag">
      <ol class="maker-steps">
        <li>Get NTAG213 stickers (about €0.10 to €0.70 each).</li>
        <li>Install a free tag writer on your phone, such as NFC Tools.</li>
        <li>Choose Write › Add a record › URL, paste the link, and hold the phone to the tag.</li>
      </ol>
      <p class="field-help"><strong>On steel</strong> (a handpan, a tongue drum) a normal sticker doesn’t work: use an “on-metal” tag, or put the sticker in the case or on the card. Any Android phone and iPhone XS or newer read tags without an app.</p>
      <p class="field-help">The link ends in <code>?via=nfc</code> so your numbers tell tags from QR codes.</p>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-action="maker-nfc-close">Close</button>
      <button type="button" class="btn btn-primary" data-action="maker-copy" data-text="${escHtml(url)}">${icon('link')} Copy link</button>`,
  });
}

// ── Importing a list (#maker/import) ─────────────────────────────────────────
function viewMakerImport() {
  const mk = mkState();
  const im = mk.imp ?? (mk.imp = { text: '', checked: null, busy: false, done: null });
  const bar = backAppBar('Import a list', { fallback: 'settings' });
  if (im.done) {
    return `${bar}
      <div class="settings maker-screen">
        ${uiEmpty({ icon: 'check', title: `${im.done.made} instrument${im.done.made !== 1 ? 's' : ''} added`,
          body: `${im.done.shared ? 'Each has its code' : 'They are saved, but couldn’t be given codes just now: open each one and tap “Give it a code”'}${im.done.serials ? `, and ${im.done.serials} serial number${im.done.serials !== 1 ? 's have' : ' has'} a code of ${im.done.serials !== 1 ? 'their' : 'its'} own` : ''}.`,
          action: '<button type="button" class="btn btn-primary" data-action="open-maker">See your instruments</button>' })}
      </div>`;
  }
  const ch = im.checked;
  const good = ch ? ch.rows.filter(r => r.ok) : [];
  const preview = !ch ? '' : `
      <h2 class="list-title">Preview · ${ch.rows.length} row${ch.rows.length !== 1 ? 's' : ''}</h2>
      ${ch.error ? `<p class="field-error" role="alert">${escHtml(ch.error)}</p>` : ''}
      <div class="list">
        ${ch.rows.map(r => uiRow({
          lead: r.ok ? FAMILY_ICONS[r.family] ?? 'music' : 'x', title: r.name || `Row ${r.line}`, cls: r.ok ? '' : 'is-bad',
          meta: r.ok ? `${escHtml(familyName(r.family))} · ${escHtml(r.what)}${r.serials.length ? ` · ${r.serials.length} serial number${r.serials.length !== 1 ? 's' : ''}` : ''}`
            : `<span class="is-error">Row ${r.line}: ${escHtml(r.error)}</span>`,
          trail: r.ok ? icon('check') : '<span class="row-meta">Skipped</span>',
        })).join('')}
      </div>`;
  return `${bar}
    <div class="settings maker-screen">
      <p class="settings-intro">One row per instrument you make: its name, what it is, and either one of our scales or its notes. Add serial numbers to give each instrument its own code.</p>
      ${uiField({ label: 'Paste your list', id: 'maker-import-text', help: 'Columns: name, instrument, scale, ding, top, bottom, serials. A scale is written as in its address on oakhum.com (d-kurd); notes like D3 Bb3 F#4',
        control: `<textarea class="input maker-text maker-import-text" id="maker-import-text" rows="7" spellcheck="false" autocapitalize="none" placeholder="${escHtml(MAKER_IMPORT_EXAMPLE.trim())}">${escHtml(im.text)}</textarea>` })}
      <div class="maker-actions">
        <label class="btn btn-secondary">${icon('download')} Choose a .csv file<input type="file" accept=".csv,.txt,text/csv,text/plain" class="sr-only" data-action="maker-import-file"></label>
        <button type="button" class="btn btn-ghost" data-action="maker-import-example">Show an example</button>
        <button type="button" class="btn btn-secondary" data-action="maker-import-check">Check the list</button>
      </div>
      ${preview}
      ${ch && !ch.error && good.length ? `
      <div class="maker-cta">
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="maker-import-go"${im.busy ? ' disabled' : ''}>${im.busy ? 'Importing…' : `Import ${good.length} instrument${good.length !== 1 ? 's' : ''}`}</button>
        ${good.length < ch.rows.length ? `<p class="field-help">${ch.rows.length - good.length} row${ch.rows.length - good.length !== 1 ? 's are' : ' is'} skipped. Fix ${ch.rows.length - good.length !== 1 ? 'them' : 'it'} above and check again, or import the rest.</p>` : ''}
      </div>` : ''}
    </div>`;
}

function makerImportCheck() {
  const mk = mkState();
  const im = mk.imp;
  im.text = document.getElementById('maker-import-text')?.value ?? im.text;
  im.checked = makerImportRows(im.text, { parseLink, closestLinks, safeNoteName });
  render();
}

// Makes the checked rows: each becomes one of the account's instruments (a
// handpan, tongue drum or kalimba as its saved notes; an ocarina or flute
// from its chart), gets its code, and its serial numbers their own.
async function makerImportGo() {
  const mk = mkState();
  const im = mk.imp;
  const rows = im.checked?.rows.filter(r => r.ok) ?? [];
  if (!rows.length || im.busy) return;
  if (!isLoggedIn()) { showToast('Importing needs a connection'); return; }
  im.busy = true;
  render();
  const made = [];
  const stamp = Date.now();
  rows.forEach((r, i) => {
    if (r.kind === 'chart') {
      const inst = instrumentFromChart(r.chartId, r.keyId, { name: r.name });
      saveInstrument(inst);
      made.push({ id: inst.id, row: r });
      return;
    }
    let layout;
    if (r.kind === 'scale') {
      layout = createLayoutFromScale(findTuning(r.scaleId));
    } else {
      const params = new URLSearchParams({ ding: r.ding, top: r.top.join(','), bottom: r.bottom.join(','), tc: String(r.top.length), bc: String(r.bottom.length), name: r.name });
      layout = layoutFromCustomParams(params, r.family);
    }
    // Saved as the maker's own instrument under its own name, so two rows on the same scale stay two instruments.
    const savedId = `c-${stamp}-${i}`;
    layout = { ...JSON.parse(JSON.stringify(layout)), id: 'custom', isCustom: true, savedId, name: r.name };
    const total = 1 + layout.top.slots.filter(x => x.note).length + layout.bottom.slots.filter(x => x.note).length;
    saveLayout({ id: savedId, name: r.name, noteCount: total, layout, savedAt: stamp + i });
    made.push({ id: handpanInstrumentId(savedId), row: r });
  });
  state.savedLayouts = getSavedLayouts();
  refreshInstruments();
  scheduleSave();
  const shared = await makerShareInstruments(made.map(x => x.id));
  let serials = 0;
  if (shared) {
    for (const x of made) {
      if (!x.row.serials.length) continue;
      const res = await createMakerCodes(x.id, x.row.serials);
      if (res?.ok) serials += x.row.serials.length;
    }
    await makerLoadCodes();
  }
  logEvent('maker_import', { rows: made.length, serials });
  im.busy = false;
  im.done = { made: made.length, shared, serials };
  render();
}

// ── Counting how a code is used ──────────────────────────────────────────────
// Where this page load came from, read before the app tidies the address.
const MAKER_LANDING_VIA = typeof location !== 'undefined' ? makerViaFromSearch(location.search) : null;
let _makerLandingUsed = false;
const MAKER_CHORD_ACTIONS = ['select-chord', 'play-chord', 'oc-chord-select', 'oc-play-selected', 'oc-play-arp'];

// The code whose instrument is on screen in this visit, or null. Counting
// stops when the visitor moves to another instrument.
function makerActiveCode() {
  const opened = state.mk?.opened;
  if (!opened?.code) return null;
  const here = state.layout ? state.layout.fromCode : state.view === 'instrument' ? currentInstrument()?.fromCode : null;
  return here === opened.code ? opened.code : null;
}
// The address of the instrument on screen while it is still the maker's
// (not saved, opened by code): its code, so a reload, Copy link and a second
// scan all open the maker's instrument. Used by stateToHash.
function makerCodePath(tab = null, chord = null) {
  if (!state.layout?.fromCode || state.currentInstrumentId || state.mk?.opened?.code !== state.layout.fromCode) return null;
  return linkFor({ code: state.layout.fromCode }, { tab, chord });
}
function makerFlushPlayed() {
  const mk = state.mk;
  const code = mk?.opened?.code;
  if (!code) return;
  const p = mk.played;
  if (p.chords > 0) { logMakerEvent(code, 'chords', { via: mk.opened.via, count: p.chords, first: !p.sentChords }); p.sentChords = true; p.chords = 0; }
  if (p.songs > 0) { logMakerEvent(code, 'songs', { via: mk.opened.via, count: p.songs, first: !p.sentSongs }); p.sentSongs = true; p.songs = 0; }
}
if (typeof document !== 'undefined') {
  // Chords played and songs opened on a maker's instrument are counted here
  // and sent now and then as two numbers: never which chord or which song.
  document.addEventListener('click', e => {
    const action = e.target.closest?.('[data-action]')?.dataset.action;
    if (!action || !makerActiveCode()) return;
    const p = state.mk.played;
    if (MAKER_CHORD_ACTIONS.includes(action)) p.chords++;
    else if (action === 'song-open') p.songs++;
    else if ((action === 'save-layout' || action === 'shared-add' || action === 'visit-save') && accountOn()) logMakerEvent(state.mk.opened.code, 'save', { via: state.mk.opened.via });
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') makerFlushPlayed(); });
  window.addEventListener('pagehide', makerFlushPlayed);
  setInterval(makerFlushPlayed, 20000);
}
