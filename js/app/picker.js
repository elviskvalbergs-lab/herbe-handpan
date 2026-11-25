// The searchable picker.
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { SCALES } from '../data.js';
import { noteSearchWords, pickIndex, pickMatches } from '../pickmatch.js';
import { icon } from '../icons.js';

// Searchable picker: a field that looks like a select (.select, chevron,
// the chosen option's label) but opens a sheet with a search box and the
// options as rows, grouped under headers. For lists that can be long.
//   options: [{ value, label, group?, meta?, keywords? }]; groups: the group
//   names in order (default: order of first appearance; ungrouped first).
//   action + data: what choosing runs. A choice dispatches a change event
//   from an input carrying data-action=action and the data, with the chosen
//   value, so the change delegation below handles it exactly as it handled
//   the <select> this replaced.
// The sheet lives outside #app and filters in place as you type, so a
// render() never runs per keystroke.
const _pickerDefs = {};
let _pickerOpen = null; // { id, root, rows, active }

function uiPicker({ id, value, label, placeholder = 'Choose…', options, groups = null, action, data = {}, cls = '', hint = '' }) {
  _pickerDefs[id] = { id, value, label, options, groups, action, data };
  const cur = options.find(o => o.value === value);
  return `<button type="button" class="select picker-btn ${cls}" id="${escHtml(id)}" data-action="picker-open" data-picker="${escHtml(id)}"
    aria-haspopup="dialog" aria-label="${escHtml(label)}: ${escHtml(cur ? cur.label : placeholder)}"
    title="${escHtml(hint || (cur ? cur.label : label))}"><span class="picker-val${cur ? '' : ' is-placeholder'}">${escHtml(cur ? cur.label : placeholder)}</span></button>`;
}

// Options for the handpan scales, grouped by family in catalogue order.
// A scale is also found by its ding in any spelling and its note count.
function scalePickerOptions(lead = []) {
  return [...lead, ...SCALES.map(sc => {
    const n = 1 + sc.top.notes.length + sc.bottom.notes.length;
    return {
      value: sc.id, label: sc.name, group: sc.family, meta: `${n} notes`,
      keywords: [...noteSearchWords(sc.top.ding), ...noteSearchWords(sc.top.ding.replace(/\d+$/, ''))],
    };
  })];
}

function pickerSheetHtml(def) {
  const order = def.groups ?? [...new Set(def.options.map(o => o.group).filter(Boolean))];
  const rowHtml = (o, i) => {
    const on = o.value === def.value;
    return `<button type="button" class="row no-lead picker-row${on ? ' is-selected' : ''}" role="option" tabindex="-1"
      id="pick-opt-${i}" data-pick-index="${i}" data-value="${escHtml(o.value)}" aria-selected="${on ? 'true' : 'false'}">
      <span class="row-text"><span class="row-title">${escHtml(o.label)}</span>${o.meta ? `<span class="row-meta">${escHtml(o.meta)}</span>` : ''}</span>
      <span class="row-trail">${on ? icon('check') : ''}</span>
    </button>`;
  };
  const indexed = def.options.map((o, i) => [o, i]);
  const loose = indexed.filter(([o]) => !o.group || !order.includes(o.group));
  const sections = [];
  if (loose.length) sections.push(`<div class="picker-group" role="group" aria-label="${escHtml(def.label)}"><div class="list">${loose.map(([o, i]) => rowHtml(o, i)).join('')}</div></div>`);
  order.forEach((g, gi) => {
    const rows = indexed.filter(([o]) => o.group === g);
    if (!rows.length) return;
    sections.push(`<div class="picker-group" role="group" aria-labelledby="pick-g-${gi}">
      <div class="list-title picker-group-title" id="pick-g-${gi}">${escHtml(g)}</div>
      <div class="list">${rows.map(([o, i]) => rowHtml(o, i)).join('')}</div></div>`);
  });
  const tall = def.options.length > 8 ? ' is-tall' : '';
  return `
    <div class="sheet-root sheet-pick${tall} is-entering" data-sheet="pick">
      <div class="sheet-scrim" data-pick-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pick-title" tabindex="-1">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2 class="sheet-title" id="pick-title">${escHtml(def.label)}</h2>
          ${uiIconBtn('x', 'Close', { attrs: 'data-pick-close' })}
        </div>
        <div class="picker-search">
          ${icon('search')}
          <input class="input" id="pick-search" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"
            placeholder="Search" aria-label="Search ${escHtml(def.label)}" role="combobox" aria-expanded="true"
            aria-controls="pick-list" aria-autocomplete="list">
        </div>
        <div class="sheet-body picker-body">
          <div id="pick-list" role="listbox" aria-label="${escHtml(def.label)}">${sections.join('')}</div>
          <div class="picker-empty" hidden>${uiEmpty({ icon: 'search', title: 'No matches', body: 'Try fewer letters, or another spelling.' })}</div>
        </div>
      </div>
    </div>`;
}

function openPicker(id) {
  const def = _pickerDefs[id];
  if (!def) return;
  closePicker(false);
  document.body.insertAdjacentHTML('beforeend', pickerSheetHtml(def));
  const root = document.body.lastElementChild;
  // Rows are in group order, which need not be the options' order.
  const rows = [...root.querySelectorAll('.picker-row')];
  const index = rows.map(r => pickIndex(def.options[parseInt(r.dataset.pickIndex, 10)]));
  _pickerOpen = { id, def, root, rows, index, active: -1 };
  const input = root.querySelector('#pick-search');
  const cur = rows.find(r => r.classList.contains('is-selected'));
  pickerSetActive(cur ? rows.indexOf(cur) : -1, 'center');
  // Fine pointers (mouse, trackpad) type straight away. On touch screens the
  // keyboard would cover half the list, so search waits for a tap.
  if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  else root.querySelector('.sheet').focus({ preventScroll: true });
  root.addEventListener('keydown', pickerKeydown);
  root.addEventListener('click', pickerClick);
  input.addEventListener('input', pickerFilterRows);
  setTimeout(() => root.classList.remove('is-entering'), 400);
}

// Closes the picker; focus goes back to its field.
function closePicker(refocus = true) {
  const p = _pickerOpen;
  if (!p) return;
  _pickerOpen = null;
  p.root.remove();
  if (refocus) document.getElementById(p.id)?.focus({ preventScroll: true });
}

function pickerVisible() {
  return _pickerOpen ? _pickerOpen.rows.filter(r => !r.hidden) : [];
}

function pickerSetActive(i, block = 'nearest') {
  const p = _pickerOpen;
  p.rows.forEach(r => r.classList.remove('is-active'));
  p.active = i;
  const input = p.root.querySelector('#pick-search');
  const row = p.rows[i];
  if (!row) { input.removeAttribute('aria-activedescendant'); return; }
  row.classList.add('is-active');
  input.setAttribute('aria-activedescendant', row.id);
  // Keep the row clear of the sticky group header above it.
  const body = p.root.querySelector('.picker-body');
  const head = row.closest('.picker-group')?.querySelector('.picker-group-title');
  const hh = head ? head.offsetHeight : 0;
  const top = row.getBoundingClientRect().top - body.getBoundingClientRect().top;
  if (block === 'center') body.scrollTop += top - (body.clientHeight - row.offsetHeight) / 2;
  else if (top < hh) body.scrollTop += top - hh;
  else if (top + row.offsetHeight > body.clientHeight) body.scrollTop += top + row.offsetHeight - body.clientHeight;
}

function pickerFilterRows() {
  const p = _pickerOpen;
  if (!p) return;
  const q = p.root.querySelector('#pick-search').value;
  p.rows.forEach((r, i) => { r.hidden = !pickMatches(q, p.index[i]); });
  p.root.querySelectorAll('.picker-group').forEach(g => { g.hidden = !g.querySelector('.picker-row:not([hidden])'); });
  const vis = pickerVisible();
  p.root.querySelector('.picker-empty').hidden = vis.length > 0;
  p.root.querySelector('.picker-body').scrollTop = 0;
  // While searching, Enter picks the first match.
  pickerSetActive(vis.length ? p.rows.indexOf(vis[0]) : -1);
}

function pickerKeydown(e) {
  const p = _pickerOpen;
  if (!p) return;
  // The picker handles its own keys; the app's sheet keys (Esc closes the
  // sheet under it, Tab cycles) must not see them.
  e.stopPropagation();
  const input = p.root.querySelector('#pick-search');
  const vis = pickerVisible();
  const pos = vis.indexOf(p.rows[p.active]);
  if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!vis.length) return;
    const next = e.key === 'ArrowDown' ? Math.min(vis.length - 1, pos + 1) : Math.max(0, pos < 0 ? 0 : pos - 1);
    pickerSetActive(p.rows.indexOf(vis[next]));
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    return;
  }
  if (e.key === 'Home' || e.key === 'End') {
    if (document.activeElement === input && input.value) return; // caret moves in the text
    e.preventDefault();
    if (vis.length) pickerSetActive(p.rows.indexOf(vis[e.key === 'Home' ? 0 : vis.length - 1]));
    return;
  }
  if (e.key === 'Enter') {
    if (e.target.closest?.('[data-pick-close]')) return;
    e.preventDefault();
    if (pos >= 0) pickerChoose(p.active);
    return;
  }
  if (e.key === 'Tab') {
    const items = [p.root.querySelector('.sheet-head [data-pick-close]'), input];
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
    return;
  }
  // Typing anywhere in the sheet goes to the search box.
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== input) input.focus();
}

function pickerClick(e) {
  if (e.target.closest('[data-pick-close]')) { closePicker(); return; }
  const row = e.target.closest('.picker-row');
  if (row) pickerChoose(_pickerOpen.rows.indexOf(row));
}

// Chooses an option: closes the sheet, puts focus back on the field and,
// if the value changed, runs the field's change action.
function pickerChoose(i) {
  const p = _pickerOpen;
  const opt = p?.rows[i] && p.def.options[parseInt(p.rows[i].dataset.pickIndex, 10)];
  if (!opt) return;
  closePicker();
  const btn = document.getElementById(p.id);
  if (opt.value === p.def.value) return;
  p.def.value = opt.value;
  if (btn) {
    const val = btn.querySelector('.picker-val');
    val.textContent = opt.label;
    val.classList.remove('is-placeholder');
    btn.title = opt.label;
    btn.setAttribute('aria-label', `${p.def.label}: ${opt.label}`);
  }
  const el = document.createElement('input');
  el.type = 'hidden';
  el.dataset.action = p.def.action;
  for (const [k, v] of Object.entries(p.def.data ?? {})) if (v != null) el.setAttribute(`data-${k}`, v);
  el.value = opt.value;
  (btn?.parentNode ?? document.body).appendChild(el);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.remove();
  document.getElementById(p.id)?.focus({ preventScroll: true });
}

// Browser back closes the picker with the screen it was on.
window.addEventListener('popstate', () => closePicker(false));
