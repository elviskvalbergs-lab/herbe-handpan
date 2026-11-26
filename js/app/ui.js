// UI primitives (app bar, tabs, sheets, rows, fields) and the app bar's buttons.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { icon } from '../icons.js';

// App-bar buttons shared by many screens.
function tunerAppBtn() {
  return uiIconBtn('tuning-fork', state.tuner.on ? 'Stop the tuner' : 'Tuner', { action: 'tuner-toggle', pressed: state.tuner.on });
}
function settingsAppBtn() { return uiIconBtn('settings', 'Settings', { action: 'open-settings' }); }

// App bar of a deeper screen: back (history, else the logical parent) + title.
function backAppBar(title, { fallback = 'home', actions = [] } = {}) {
  return uiAppBar({ title, back: { action: 'nav-back', data: { fallback }, label: 'Back' }, actions });
}

// ── UI primitives ────────────────────────────────────────────────────────────
// Render helpers for the design-system components (docs/design-system.md §5).
// Like the views, they return HTML strings. `attrs` is pre-escaped markup.

// data-* attributes from a plain object, escaped.
function uiData(data = {}) {
  return Object.entries(data)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => ` data-${k}="${escHtml(v)}"`).join('');
}

// "?": opens one help article (help/en/<id>.md) in the help sheet, at a
// section when an anchor is given. Next to a heading or a control, wherever
// someone might wonder what it does. Always literal ids: tests/help.test.mjs
// checks every call against the articles. docs/help-centre.md.
function uiHelp(id, anchor = '') {
  return `<button type="button" class="help-q" data-action="help-open" data-id="${escHtml(id)}"${anchor ? ` data-anchor="${escHtml(anchor)}"` : ''}
    aria-label="Help" title="Help">${icon('help-circle')}</button>`;
}

// Icon-only button: 44×44, always labelled.
function uiIconBtn(name, label, { action, data, pressed, cls = '', attrs = '', disabled = false } = {}) {
  return `<button type="button" class="icon-btn ${cls}"${action ? ` data-action="${action}"` : ''}${uiData(data)}
    aria-label="${escHtml(label)}" title="${escHtml(label)}"${pressed != null ? ` aria-pressed="${pressed ? 'true' : 'false'}"` : ''}
    ${disabled ? 'disabled' : ''} ${attrs}>${icon(name)}</button>`;
}

function uiBadge(text, variant = '') {
  return `<span class="badge ${variant ? 'badge-' + variant : ''}">${escHtml(text)}</span>`;
}

// The sticky app bar. Left slot: a back button and title, a plain title, or
// the instrument switcher. Middle: the tab bar (moved to the bottom on
// phones by CSS). Right: up to three icon buttons. The trailing comment
// lets render() put everything after the bar into <main>.
function uiAppBar({ title = '', back = null, switcher = null, badge = '', actions = [], tabs = '' } = {}) {
  let left;
  if (switcher) {
    left = `
      <button type="button" class="appbar-switcher" data-action="${switcher.action}"${uiData(switcher.data)}
        title="${escHtml(switcher.title ?? 'My instruments')}">
        <span class="appbar-switcher-name">${escHtml(switcher.name)}</span>${icon('chevron-down')}
      </button>${badge}`;
  } else {
    left = `
      ${back ? uiIconBtn(back.icon ?? 'chevron-left', back.label ?? 'Back', { action: back.action, data: back.data }) : ''}
      <h1 class="appbar-title${back ? '' : ' no-back'}">${escHtml(title)}</h1>${badge}`;
  }
  return `
    <header class="appbar">
      <div class="appbar-inner">
        <div class="appbar-left">${left}</div>
        <div class="appbar-mid">${tabs}</div>
        <div class="appbar-right">${offlinePillHtml()}${actions.join('')}</div>
      </div>
    </header><!--appbar-end-->`;
}

// Tabs of an instrument: [{ id, label, icon, action, data }], one selected.
// Rendered inside the app bar; fixed to the bottom of the screen <1024px.
function uiTabBar(tabs, current) {
  if (tabs.length < 2) return '';
  return `
    <nav class="tabbar" role="tablist" aria-label="Instrument views">
      ${tabs.map(t => `
        <button type="button" class="tab" role="tab" aria-selected="${t.id === current ? 'true' : 'false'}"
          data-action="${t.action}"${uiData(t.data)}>
          <span class="tab-inner">${icon(t.icon)}<span class="tab-label">${escHtml(t.label)}</span></span>
        </button>`).join('')}
    </nav>`;
}

// Bottom sheet (phone) / centred modal (≥600px). `close` is the action that
// closes it (scrim, close button and Esc all use it). variant: '' | 'menu' | 'confirm'.
function uiSheet({ key, title, body, footer = '', close, closeData, variant = '', help = '' }) {
  const id = `sheet-${key}`;
  return `
    <div class="sheet-root${variant ? ' sheet-' + variant : ''}" data-sheet="${escHtml(key)}">
      <div class="sheet-scrim" data-action="${close}"${uiData(closeData)}></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 class="sheet-title" id="${id}-title">${escHtml(title)}</h2>
          ${help}${uiIconBtn('x', 'Close', { action: close, data: closeData, attrs: 'data-sheet-close' })}
        </div>
        <div class="sheet-body">${body}</div>
        ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
      </div>
    </div>`;
}

// A list row. `lead` is an icon name (shown in a tile) or markup; `trail`
// markup; `chevron` adds the navigation chevron. With an action the row is a
// <button>, unless it holds buttons of its own (then a div with role=button).
function uiRow({ lead = '', title, meta = '', meta2 = '', trail = '', chevron = false, action = '', data, cls = '', titleHtml = false } = {}) {
  const leadHtml = !lead ? '' : /^[a-z0-9-]+$/.test(lead)
    ? `<span class="row-lead tile">${icon(lead)}</span>` : `<span class="row-lead">${lead}</span>`;
  const inner = `
    ${leadHtml}
    <span class="row-text">
      <span class="row-title">${titleHtml ? title : escHtml(title)}</span>
      ${meta ? `<span class="row-meta">${meta}</span>` : ''}
      ${meta2 ? `<span class="row-meta">${meta2}</span>` : ''}
    </span>
    <span class="row-trail">${trail}${chevron ? icon('chevron-right') : ''}</span>`;
  const classes = `row ${lead ? '' : 'no-lead'} ${cls}`;
  if (!action) return `<div class="${classes}">${inner}</div>`;
  if (/<button/.test(trail)) {
    return `<div class="${classes}" role="button" tabindex="0" data-action="${action}"${uiData(data)}>${inner}</div>`;
  }
  return `<button type="button" class="${classes}" data-action="${action}"${uiData(data)}>${inner}</button>`;
}

// Label + control + optional helper or error text.
function uiField({ label, control, help = '', error = '', id = '' }) {
  return `
    <div class="field ${error ? 'has-error' : ''}">
      ${label ? `<label class="field-label"${id ? ` for="${id}"` : ''}>${escHtml(label)}</label>` : ''}
      ${control}
      ${error ? `<div class="field-error">${escHtml(error)}</div>` : help ? `<div class="field-help">${help}</div>` : ''}
    </div>`;
}

// Segmented control: options [{ value, label }], one checked.
function uiSeg(options, value, { action, key = 'value', label = '' } = {}) {
  return `
    <div class="seg" role="radiogroup"${label ? ` aria-label="${escHtml(label)}"` : ''}>
      ${options.map(o => `
        <button type="button" class="seg-opt" role="radio" aria-checked="${o.value === value ? 'true' : 'false'}"
          data-action="${action}" data-${key}="${escHtml(o.value)}">${o.label}</button>`).join('')}
    </div>`;
}

// Empty state: icon, title, body and one optional button (markup).
function uiEmpty({ icon: ico = 'info', title, body = '', action = '' }) {
  return `
    <div class="empty">
      ${icon(ico)}
      <div class="empty-title">${escHtml(title)}</div>
      ${body ? `<div class="empty-body">${body}</div>` : ''}
      ${action}
    </div>`;
}

// A switch row: the whole row is the control (role=switch), the track is
// drawn at the right. `help` is a meta line under the label.
function uiSwitchRow({ label, help = '', on, action, data }) {
  return `
    <button type="button" class="row no-lead set-row" role="switch" aria-checked="${on ? 'true' : 'false'}"
      data-action="${action}"${uiData(data)}>
      <span class="row-text"><span class="row-title">${escHtml(label)}</span>${help ? `<span class="row-meta">${escHtml(help)}</span>` : ''}</span>
      <span class="switch${on ? ' is-on' : ''}" aria-hidden="true"></span>
    </button>`;
}

// A settings row with a control at the right (it drops below the label on
// narrow phones): a segmented control, a stepper or a field.
function uiSetRow({ label, help = '', control, wide = false }) {
  return `
    <div class="row no-lead set-row${wide ? ' is-wide' : ''}">
      <span class="row-text"><span class="row-title">${escHtml(label)}</span>${help ? `<span class="row-meta">${help}</span>` : ''}</span>
      <div class="set-control">${control}</div>
    </div>`;
}

// Number stepper [−] value [+]; the buttons carry data-delta -1 / 1.
function uiStepper({ value, label, action, data, min = false, max = false, help = '' }) {
  return `
    <div class="stepper-num">
      <div class="stepper-num-row" role="group" aria-label="${escHtml(label)}">
        ${uiIconBtn('minus', `Less (${label})`, { action, data: { ...data, delta: -1 }, cls: 'tonal', disabled: min })}
        <span class="stepper-num-val" aria-live="polite">${escHtml(value)}</span>
        ${uiIconBtn('plus', `More (${label})`, { action, data: { ...data, delta: 1 }, cls: 'tonal', disabled: max })}
      </div>
      ${help ? `<div class="stepper-num-help">${help}</div>` : ''}
    </div>`;
}

// ⋯ button of an instrument's app bar.
function menuAppBtn() { return uiIconBtn('ellipsis', 'More', { action: 'menu-open', attrs: 'aria-haspopup="dialog"' }); }
