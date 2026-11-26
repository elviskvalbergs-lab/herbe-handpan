// The builder and set-up (internal clay ocarina builder).
// Part of the app split out of js/app.js (docs/app-structure-plan.md). Names from
// the other js/app/ files are shared through the bundle's one scope (build.py).
import { displayNote } from '../../data.js';
import { icon } from '../../icons.js';
import { applyHoleSizes, centsBetween, hzToMidi, parsePitch, pitchLabel } from '../../ocarina.js';
import { instrumentFromChart } from '../../charts.js';
import { findTuning } from '../../layoutfamilies.js';
import { getClayBodies, getInstrument, midiToNoteName, saveClayBodies, saveInstrument, usesLayout } from '../../instruments.js';
import { STAGE_ORDER, STAGE_TITLES, bodyPlan, buildShrink, calibrateChamber, chamberBuild, defaultCustomHoles, duplicateFingers, fluteChamberFromReadings, fluteHoles, fluteStepStates, holeDisplayOrder, holeLabel, leatherHolePlan, nextStage, noteAdvice, reverseHandFingers, stageTargets, withFixedFingerings, withHoleCount, withSubLayout } from '../../builder.js';
import { fingeringFor, playableMidis, renderFingering } from '../../ocarina-ui.js';

// ── Builder ──────────────────────────────────────────────────────────────────
// A step-by-step project per scale-built ocarina. Each instrument remembers
// its stage; readings are kept per stage, so going back loses nothing.

// Record field (§5.3): [ input Hz ][ mic ]. The mic arms the field and turns
// the tuner on if needed; the first steady reading fills it (onTunerReading).
// Typing still works as before (b-input).
function uiHzField(path, value, { label = 'Reading in Hz' } = {}) {
  const r = state.rec;
  const armed = r.armed === path;
  const captured = r.captured === path;
  const help = r.error?.path === path ? `<span class="is-error">${escHtml(r.error.msg)}</span>`
    : armed && r.slow ? '<span class="is-warning">No steady note yet: keep blowing, or type the value</span>'
    : armed ? '<span class="sr-only">Listening for a steady note</span>' : '';
  // Shown as the nearest note in the user's notation and how far off it is
  // ("D4 −3 ¢"); the exact frequency is what's stored and what the maths
  // uses, so it stays visible underneath. Typing accepts a note or Hz.
  const pitch = value > 0 ? pitchLabel(value, { useFlats: state.useFlats, useSolfege: state.useSolfege }) : null;
  const hzLine = pitch && !help ? `<span class="rec-hz">${(Math.round(value * 10) / 10).toFixed(1)} Hz</span>` : '';
  return `
    <div class="rec-field${armed ? ' is-armed' : ''}" data-rec="${escHtml(path)}">
      <div class="rec">
        <input class="rec-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
          data-action="b-input" data-kind="pitch" data-path="${path}"
          value="${pitch ? escHtml(pitch.text) : ''}" placeholder="${armed ? 'Listening…' : 'Note, e.g. ' + escHtml(displayNote('D4', state.useFlats, state.useSolfege))}"
          aria-label="${escHtml(label.replace(/ in Hz$/, ''))}: a note such as D4, or a frequency in Hz">
        <button type="button" class="rec-btn${captured ? ' is-captured' : ''}" data-action="b-record" data-path="${path}"
          aria-pressed="${armed ? 'true' : 'false'}" aria-label="${armed ? 'Stop listening' : 'Fill in from the tuner'}"
          title="${armed ? 'Stop listening' : 'Fill in from the tuner'}">${armed ? '<span class="rec-dot" aria-hidden="true"></span>' : ''}${icon(captured ? 'check' : 'mic')}</button>
      </div>
      <div class="rec-help" aria-live="polite">${help}${hzLine}</div>
    </div>`;
}

// Stage name without its qualifier ("Voice and drill"), and the qualifier ("leather-hard").
function stageName(st) { return STAGE_TITLES[st].split(' (')[0]; }
function stageQualifier(st) { return STAGE_TITLES[st].match(/\(([^)]+)\)/)?.[1] ?? ''; }

// The builder stepper (§5.11): seven numbered steps joined by lines, then
// "Step 3 of 7" and the stage title. Every step can be tapped (b-stage).
function bStepsHtml(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return `
    <ol class="bsteps" aria-label="Build steps">
      ${STAGE_ORDER.map((st, i) => `
        <li class="bstep${i < idx ? ' is-done' : i === idx ? ' is-current' : ''}">
          <button type="button" class="bstep-btn" data-action="b-stage" data-stage="${st}"
            aria-label="Step ${i + 1}: ${escHtml(stageName(st))}${i < idx ? ', done' : ''}"${i === idx ? ' aria-current="step"' : ''}>
            <span class="bstep-dot" aria-hidden="true">${i < idx ? icon('check') : i + 1}</span>
            <span class="bstep-label" aria-hidden="true">${escHtml(stageName(st))}</span>
          </button>
        </li>`).join('')}
    </ol>
    <div class="b-count">Step ${idx + 1} of ${STAGE_ORDER.length}</div>
    <h2 class="b-title">${escHtml(stageName(stage))}${stageQualifier(stage) ? ` <span class="b-qual">${escHtml(stageQualifier(stage))}</span>` : ''}</h2>`;
}

function shapeIcon(shape) {
  const body = shape === 'round' ? '<circle cx="12" cy="12" r="7"/>'
    : shape === 'oval' ? '<ellipse cx="12" cy="12" rx="9" ry="6"/>'
    : '<rect x="3" y="7" width="18" height="10" rx="1"/>';
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${body}</svg>`;
}

// Earlier builds with readings, offered as a starting point.
function earlierBuilds(inst) {
  return state.instruments.filter(i => i.kind === 'scale' && i.id !== inst.id);
}

// The note strip of a design (§6.4): every note of the scale as a chip, the
// notes in the chosen window selected and the rest static, then Lower /
// Higher and "Start on the ding" to move the window. win(start) gives the
// attributes of a button that picks the window starting at `start`.
// toggle(m), when given, makes the window's notes buttons that leave a
// note out (Build › Design); in the wizard they're plain chips.
function noteStripHtml(plan, nn, { win, toggle = null }) {
  const chosen = plan.windows.find(w => w.chosen);
  const inWin = m => !chosen || chosen.notes.includes(m);
  const chips = plan.all.map(m => {
    if (!inWin(m)) return `<span class="chip is-static">${nn(m)}</span>`;
    const on = plan.notes.includes(m);
    if (!toggle) return `<span class="chip is-selected">${nn(m)}</span>`;
    return `<button type="button" class="chip${on ? '' : ' is-off'}" aria-pressed="${on ? 'true' : 'false'}" ${toggle(m)}
      aria-label="${nn(m)}${on ? '' : ', left out'}" title="${on ? 'Leave this note out' : 'Put this note back'}">${nn(m)}</button>`;
  }).join('');
  if (!chosen) return `<div class="chips note-strip">${chips}</div>`;
  const i = plan.windows.indexOf(chosen);
  const prev = plan.windows[i - 1], next = plan.windows[i + 1];
  const ding = plan.windows.find(w => w.fromDing);
  return `
    <div class="chips note-strip">${chips}</div>
    <div class="window-nav">
      <button type="button" class="btn btn-secondary" ${prev ? win(prev.start) : 'disabled'}>${icon('chevron-left')} Lower</button>
      ${ding ? `<button type="button" class="chip" ${win(ding.start)} aria-pressed="${ding.chosen ? 'true' : 'false'}">Start on the ding</button>` : ''}
      <button type="button" class="btn btn-secondary" ${next ? win(next.start) : 'disabled'}>Higher ${icon('chevron-right')}</button>
    </div>`;
}

// The chamber shown on the per-chamber steps (view state only).
function bChamberIdx(inst) { return Math.max(0, Math.min(state.oc.buildChamber ?? 0, inst.chambers.length - 1)); }

// ( Chamber 1 · D3 | Chamber 2 · E4 ) when an ocarina has two or more chambers.
function bChamberSwitch(inst, nn) {
  if (inst.chambers.length < 2) return '';
  const short = inst.chambers.length > 2;
  return uiSeg(inst.chambers.map((ch, i) => ({ value: String(i), label: `${short ? '' : 'Chamber '}${i + 1} · ${nn(ch.notes[0])}` })),
    String(bChamberIdx(inst)), { action: 'b-chamber', key: 'ci', label: 'Chamber' });
}

// A hole in the build steps: its finger, or "R2 sub-hole".
function bHoleName(h) { return h.sub ? `${h.finger} sub-hole` : h.finger; }

// Has every hole and reading of a chamber been filled in at this stage?
function bChamberComplete(inst, ci, stage) {
  const ch = inst.chambers[ci];
  const cb = chamberBuild(inst, ci);
  const r = cb.readings[stage] ?? {};
  if (stage === 'leather') {
    const plan = leatherHolePlan(ch, { f0: r.f0, d: r.d ?? cb.testHoleMm, f1: r.f1 }, buildShrink(inst), inst.build.a4);
    return !!plan && plan.holes.every(h => cb.holesDone.includes(h.index) && r.notes?.[ch.notes[h.index + 1]] > 0);
  }
  if (['boneDry', 'bisque', 'final'].includes(stage)) return ch.notes.every(m => r.notes?.[m] > 0);
  return false;
}

// Once the chamber on screen is complete, move on to the next one.
function bAdvanceChamber(inst) {
  const ci = bChamberIdx(inst);
  if (inst.chambers.length < 2 || ci >= inst.chambers.length - 1 || !bChamberComplete(inst, ci, inst.build.stage)) return;
  state.oc.buildChamber = ci + 1;
  showToast(`Chamber ${ci + 1} is done. Now chamber ${ci + 2}.`);
}

// "✓ in tune" / "12 cents flat: open it slightly" under a reading (§5.3).
function recStatus(stage, adv, text = adv.text) {
  const tone = adv.status === 'ok' ? 'is-ok' : adv.status === 'sharp' && stage !== 'leather' ? 'is-danger' : 'is-warning';
  return `<div class="rec-status ${tone}">${adv.status === 'ok' ? icon('check') : ''}${escHtml(text)}</div>`;
}

// A number field with its unit at the right.
function unitInput({ value, unit, label, attrs, step = '0.5', min = '1', max = '' }) {
  return `<span class="input-unit"><input class="input" type="number" inputmode="decimal" step="${step}" min="${min}"${max ? ` max="${max}"` : ''}
    value="${value}" aria-label="${escHtml(label)}" ${attrs}><span class="input-unit-label" aria-hidden="true">${unit}</span></span>`;
}

// The desktop preview panel: the chamber's diagram with hole sizes, as a
// drilling map, and the step's summary.
function bPreviewHtml(inst, stage, nn) {
  const ci = stage === 'design' || stage === 'body' ? 0 : bChamberIdx(inst);
  const ch = inst.chambers[ci];
  // Until the build is finished, the sizes drawn are the leather-hard plan's.
  const drawn = stage === 'done' ? inst : {
    ...inst,
    chambers: inst.chambers.map((c, i) => {
      const cb = chamberBuild(inst, i);
      const lr = cb.readings.leather ?? {};
      const plan = leatherHolePlan(c, { ...lr, d: lr.d ?? cb.testHoleMm }, buildShrink(inst), inst.build.a4);
      return plan ? applyHoleSizes(c, plan.holes.map(h => h.mm)) : c;
    }),
  };
  let summary = '';
  if (stage === 'design') {
    summary = inst.chambers.map((c, i) => `Chamber ${i + 1}: ${c.notes.map(nn).join(' ')} · ${c.holes.length} holes`).join('<br>');
  } else if (stage === 'body') {
    summary = bodyPlan(inst).map((p, i) => `Chamber ${i + 1}: ${Math.round(p.volume)} ml · ball ${Math.round(p.ballDiameter)} mm`).join('<br>');
  } else if (stage === 'leather') {
    const cb = chamberBuild(inst, ci);
    summary = `Holes drilled: ${cb.holesDone.length}/${ch.holes.length}`;
  } else if (stage !== 'done') {
    const r = chamberBuild(inst, ci).readings[stage]?.notes ?? {};
    summary = `Notes recorded: ${ch.notes.filter(m => r[m] > 0).length}/${ch.notes.length}`;
  }
  return `
    <aside class="b-aside" aria-label="Preview">
      <div class="card">
        <div class="overline">${inst.chambers.length > 1 ? `Chamber ${ci + 1} · ` : ''}${stage === 'design' || stage === 'body' ? 'preview' : 'drilling map'}</div>
        ${renderFingering(drawn, ch.notes[0], { size: 'medium', showSizes: true, useFlats: state.useFlats, useSolfege: state.useSolfege })}
        ${summary ? `<p class="b-aside-sum">${summary}</p>` : ''}
      </div>
    </aside>`;
}

// One reading block of the bone-dry, bisque and final checks: note and
// target, the record field, its status and how it compares.
function bNoteReading(inst, ci, stage, midi, targets, nn, from) {
  const cb = chamberBuild(inst, ci);
  const measured = cb.readings[stage]?.notes?.[midi];
  const leather = cb.readings.leather?.notes ?? {};
  const old = from?.build?.perChamber?.[ci]?.readings?.[stage]?.notes ?? {};
  const adv = measured > 0 ? noteAdvice(stage, measured, targets[midi]) : null;
  const rise = stage === 'boneDry' && measured > 0 && leather[midi] > 0 ? Math.round(centsBetween(measured, leather[midi])) : null;
  return `
    <div class="b-reading">
      <div class="b-reading-head"><span class="b-note">${nn(midi)}</span><span class="b-target">${targets[midi].toFixed(1)} Hz</span></div>
      ${uiHzField(`${ci}:${stage}:n:${midi}`, measured, { label: `${nn(midi)}, Hz` })}
      ${adv ? recStatus(stage, adv, adv.status === 'ok' ? 'in tune' : adv.text) : ''}
      ${rise != null ? `<div class="b-meta">rose ${rise >= 0 ? '+' : ''}${rise} ¢ since leather-hard</div>` : ''}
      ${old[midi] ? `<div class="b-meta">last build ${old[midi].toFixed(1)}</div>` : ''}
    </div>`;
}

function viewBuilder(inst) {
  const b = inst.build;
  const stage = b.stage;
  const uf = state.useFlats, us = state.useSolfege;
  const nn = m => displayNote(midiToNoteName(m), uf, us);
  const shrink = buildShrink(inst);
  const from = b.fromId ? getInstrument(b.fromId) : null;
  const ci = bChamberIdx(inst);
  const perChamber = ['leather', 'boneDry', 'bisque', 'final'].includes(stage);
  let body = '';

  if (stage === 'design') {
    const d = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    const plan = planOcarina(d);
    const hasGu = plan.scale.bottom.notes.length > 0;
    const transpose = d.transpose ?? 0;
    body = `
      <div class="card b-card">
        ${uiField({ label: 'Handpan scale', id: 'b-scale', control: uiPicker({
          id: 'b-scale', value: plan.scale.id, label: 'Handpan scale', options: scalePickerOptions(), action: 'b-design', data: { key: 'scaleId' },
        }) })}
        <div class="list b-inset">
          ${uiSetRow({ label: 'Transpose', control: uiStepper({
            value: transpose > 0 ? '+' + transpose : String(transpose), label: 'Transpose', action: 'b-design-transpose',
            min: transpose <= -6, max: transpose >= 6, help: 'semitones',
          }) })}
          ${hasGu ? uiSwitchRow({ label: 'Gu notes', help: 'Include the bottom-shell notes', on: d.includeGu ?? true, action: 'b-design-gu' }) : ''}
        </div>
        <div class="field">
          <div class="field-label">Chambers</div>
          <p class="b-text">The full scale needs ${plan.needed} chamber${plan.needed !== 1 ? 's' : ''}.</p>
          ${uiSeg(Array.from({ length: plan.needed }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(plan.chambers), { action: 'b-design-chambers', key: 'n', label: 'Chambers' })}
        </div>
        ${(() => {
          // Notes added inside big steps (not the scale's own, not sub-holes).
          const subNotes = inst.chambers[0].notes.slice(0, d.subHoles ?? 0);
          const fill = inst.chambers.flatMap(ch => ch.notes).filter(m => !plan.notes.includes(m) && !subNotes.includes(m));
          return `<div class="list b-inset">${uiSwitchRow({
            label: 'Fill big gaps', help: 'Notes of the key inside steps bigger than a tone',
            on: !!d.fillGaps, action: 'b-design-fill',
          })}</div>
          <p class="b-meta">Smaller steps make smaller, easier holes. Every note of the scale stays; up to ${DESIGN_MAX_HOLES} holes a chamber (8 fingers and 2 thumbs).${d.fillGaps ? (fill.length ? ` Adds ${fill.map(nn).join(', ')}.` : ' No step here is bigger than a tone.') : ''}</p>`;
        })()}
        ${(() => {
          // Sub-holes: notes added below the scale, a semitone or a tone
          // each, played by a finger sliding over its own hole and the
          // small one beside it. The scale stays on the finger holes.
          const subs = d.subHoles ?? 0;
          const ch0 = inst.chambers[0];
          const added = ch0.notes.slice(0, subs);
          const steps = ch0.notes.slice(0, subs + 1).map((m, i, a) => (i ? m - a[i - 1] : null)).slice(1);
          const stepName = n => (n === 1 ? 'a semitone' : 'a tone');
          return `
        <div class="field">
          <div class="field-label">Sub-holes</div>
          <p class="b-text">Small holes beside a finger's hole that add notes below the scale, as on 12-hole ocarinas: the finger slides forward to cover both. The scale itself stays on the finger holes.</p>
          ${uiSeg([{ value: '0', label: 'None' }, { value: '1', label: '1' }, { value: '2', label: '2' }], String(subs), { action: 'b-design-subs', key: 'n', label: 'Sub-holes' })}
          ${subs ? `<p class="b-meta">Adds ${added.map(nn).join(' and ')} below ${nn(ch0.notes[subs])}: ${steps.reverse().map(stepName).join(', then ')} down, in the scale's key where it can.</p>` : ''}
          ${subs === 2 ? `<div class="b-subs-layout">${uiSeg([{ value: 'taiwanese', label: 'Beside R2 and L2' }, { value: 'japanese', label: 'Beside R1 and R2' }], d.subLayout ?? 'taiwanese', { action: 'b-design-sublayout', key: 'v', label: 'Sub-hole layout' })}</div>` : ''}
          ${subs === 1 ? '<p class="b-meta">Beside the left middle finger (L2), which shares the work between the hands.</p>' : ''}
        </div>`;
        })()}
        <div class="field">
          <div class="field-label">${plan.windows.length ? 'Which notes?' : 'Notes'}</div>
          <p class="b-text">${plan.windows.length ? `${plan.chambers === 1 ? 'One chamber holds' : `${plan.chambers} chambers hold`} ${plan.windows.find(w => w.chosen).notes.length}. ` : ''}Tap a note to leave it out.</p>
          ${noteStripHtml(plan, nn, {
            win: start => `data-action="b-design" data-key="windowStart" data-value="${start}"`,
            toggle: m => `data-action="b-design" data-key="toggleNote" data-value="${m}"`,
          })}
        </div>
        <p class="b-meta">${inst.chambers.map((ch, i) => `Chamber ${i + 1}: ${ch.notes.map(nn).join(' ')} · ${ch.holes.length} hole${ch.holes.length !== 1 ? 's' : ''}`).join('<br>')}</p>
        <div class="b-preview" aria-hidden="true">${renderFingering(inst, inst.chambers[0].notes[0], { size: 'medium', useFlats: uf, useSolfege: us })}</div>
      </div>
      ${earlierBuilds(inst).length ? `
        <details class="b-details" ${b.fromId ? 'open' : ''}>
          <summary>${icon('chevron-right')} Start from an earlier build</summary>
          ${uiField({ label: 'Earlier build', id: 'b-from', help: 'Copies its design, clay body, window and test hole, and shows its readings beside yours.', control: uiPicker({
            id: 'b-from', value: b.fromId ?? '', label: 'Earlier build', action: 'b-from',
            options: [{ value: '', label: 'None' }, ...earlierBuilds(inst).map(i => ({ value: i.id, label: i.name }))],
          }) })}
        </details>` : ''}`;
  }

  if (stage === 'body') {
    const clays = getClayBodies();
    const clay = clays.find(c => c.id === b.clayBody);
    const plans = bodyPlan(inst);
    body = `
      <div class="card b-card">
        ${uiField({ label: 'Clay body', id: 'b-clay', help: `${clay?.builds ? `Learned from ${clay.builds} build${clay.builds !== 1 ? 's' : ''}. ` : clay ? '' : 'Choose one, so a finished build teaches it its shrinkage. '}<button type="button" class="link-btn" data-action="open-clay-bodies">Manage clay bodies in Settings</button>`, control: `
          <select class="select" id="b-clay" data-action="b-clay">
            ${clay ? '' : `<option value="" selected disabled>Not chosen · ${b.shrinkPct}%</option>`}
            ${clays.map(c => `<option value="${escHtml(c.id)}" ${b.clayBody === c.id ? 'selected' : ''}>${escHtml(c.name)} · ${c.shrinkPct}%</option>`).join('')}
            <option value="__new__">Add a clay body…</option>
          </select>` })}
        <details class="b-details">
          <summary>${icon('chevron-right')} Advanced</summary>
          ${uiField({ label: 'Shrinkage for this build', control: unitInput({ value: b.shrinkPct, unit: '%', label: 'Shrinkage for this build, %', attrs: 'data-action="b-shrink"', step: '0.1', min: '0', max: '30' }) })}
        </details>
      </div>
      ${inst.chambers.map((ch, i) => {
        const p = plans[i];
        const win = p.window;
        const round = win.shape === 'round';
        const shapes = [['rect', 'Rectangle'], ['round', 'Round'], ['oval', 'Oval']];
        return `
        <div class="overline b-overline">Chamber ${i + 1} · closed note ${nn(ch.notes[0])}</div>
        <div class="card b-card">
          <div class="field">
            <div class="field-label" id="b-shape-${i}">Window shape</div>
            <div class="seg" role="radiogroup" aria-labelledby="b-shape-${i}">
              ${shapes.map(([sh, label]) => `<button type="button" class="seg-opt" role="radio" aria-checked="${win.shape === sh ? 'true' : 'false'}"
                data-action="b-window" data-ci="${i}" data-key="shape" data-value="${sh}">${shapeIcon(sh)} ${label}</button>`).join('')}
            </div>
          </div>
          <div class="b-dims${round ? ' is-round' : ''}">
            ${uiField({ label: round ? 'Diameter' : 'Width', control: unitInput({ value: win.w, unit: 'mm', label: `${round ? 'Diameter' : 'Width'}, mm`, attrs: `data-action="b-window" data-ci="${i}" data-key="w"` }) })}
            ${round ? '' : uiField({ label: 'Length', control: unitInput({ value: win.l, unit: 'mm', label: 'Length, mm', attrs: `data-action="b-window" data-ci="${i}" data-key="l"` }) })}
            ${uiField({ label: 'Wall', control: unitInput({ value: win.t, unit: 'mm', label: 'Wall, mm', attrs: `data-action="b-window" data-ci="${i}" data-key="t"` }) })}
          </div>
          <dl class="b-result">
            <div><dt>Inside volume</dt><dd>${Math.round(p.volume)} ml</dd></div>
            <div><dt>Form around a ball</dt><dd>${Math.round(p.ballDiameter)} mm</dd></div>
            <div><dt>After firing</dt><dd>~${Math.round(p.firedVolume)} ml</dd></div>
          </dl>
          <p class="b-meta">A starting point: the finished pitch can land a couple of semitones away, which the next step corrects.</p>
        </div>`;
      }).join('')}`;
  }

  if (stage === 'leather') {
    const ch = inst.chambers[ci];
    const cb = chamberBuild(inst, ci);
    const r = cb.readings.leather ?? {};
    const targets = stageTargets(ch, 'leather', shrink, b.a4);
    const plan = leatherHolePlan(ch, { f0: r.f0, d: r.d ?? cb.testHoleMm, f1: r.f1 }, shrink, b.a4);
    const old = from?.build?.perChamber?.[ci]?.readings?.leather;
    const closedAdv = r.f0 > 0 ? noteAdvice('leather', r.f0, targets[ch.notes[0]]) : null;
    const done = plan ? plan.holes.filter(h => cb.holesDone.includes(h.index)).length : 0;
    body = `
      <div class="card b-card">
        <h3 class="b-card-title">1 · Closed pitch</h3>
        <p class="b-text">Cover all holes and blow.</p>
        <p class="b-target-line">Target ${nn(ch.notes[0])} · ${targets[ch.notes[0]].toFixed(1)} Hz</p>
        ${uiHzField(`${ci}:leather:f0`, r.f0, { label: 'Closed pitch, Hz' })}
        ${closedAdv ? recStatus('leather', closedAdv, closedAdv.status === 'ok' ? 'Closed note in tune'
          : closedAdv.status === 'flat' ? `${Math.abs(closedAdv.cents)} cents flat: open the window slightly`
          : `${closedAdv.cents} cents sharp: the chamber is a little small for this note`) : ''}
        ${old?.f0 ? `<div class="b-meta">last build ${old.f0.toFixed(1)}</div>` : ''}
      </div>
      <div class="card b-card">
        <h3 class="b-card-title">2 · Test hole</h3>
        <p class="b-text">Drill a test hole where ${escHtml((ch.holes.find(h => !h.sub) ?? ch.holes[0]).finger)} goes.</p>
        ${uiField({ label: 'Diameter', control: unitInput({ value: r.d ?? cb.testHoleMm, unit: 'mm', label: 'Test hole diameter, mm', attrs: `data-action="b-input" data-path="${ci}:leather:d"` }) })}
        <p class="b-text">Blow with only that hole open:</p>
        ${uiHzField(`${ci}:leather:f1`, r.f1, { label: 'Test hole pitch, Hz' })}
      </div>
      <div class="card b-card">
        <h3 class="b-card-title">3 · Drill the holes${plan ? ` <span class="b-card-count">${done}/${plan.holes.length}</span>` : ''}</h3>
        ${plan ? `
          <p class="b-text">In this order. Sizes are at leather-hard; targets are ${(shrink * 100).toFixed(1)}% lower for shrinkage.</p>
          ${plan.holes.some(h => h.sub) ? `<p class="b-text">Sub-holes first: each sits right beside its finger's hole, just past it toward the fingertip, so the finger covers its own hole and then slides forward to cover both. Leave the finger holes for the next steps.</p>` : ''}
          <div class="b-holes">
            ${plan.holes.map(h => {
              const midi = ch.notes[h.index + 1];
              const isDone = cb.holesDone.includes(h.index);
              const measured = r.notes?.[midi];
              const adv = measured > 0 ? noteAdvice('leather', measured, targets[midi]) : null;
              const size = h.parts.length > 1 ? `${h.parts.length} × ${h.parts[0].toFixed(1)} mm` : `${h.mm.toFixed(1)} mm`;
              return `
              <div class="b-hole${isDone ? ' is-done' : ''}">
                <button type="button" class="b-check" role="checkbox" aria-checked="${isDone ? 'true' : 'false'}"
                  data-action="b-hole-done" data-ci="${ci}" data-index="${h.index}" aria-label="${escHtml(bHoleName(h))} drilled">
                  <span class="checkbox" aria-hidden="true">${isDone ? icon('check') : ''}</span>
                </button>
                <div class="b-hole-main">
                  <div class="b-hole-head">
                    <span class="b-finger">${escHtml(bHoleName(h))}</span><span class="b-size">${size}</span>
                    ${h.index === plan.testHoleIndex ? uiBadge('Your test hole', 'accent') : ''}
                  </div>
                  <div class="b-meta">${nn(midi)} → ${targets[midi].toFixed(1)} Hz</div>
                  ${uiHzField(`${ci}:leather:n:${midi}`, measured, { label: `${nn(midi)}, Hz` })}
                  ${adv ? recStatus('leather', adv, adv.status === 'ok' ? `${nn(midi)} in tune` : `${nn(midi)} is ${adv.text}`) : ''}
                </div>
              </div>`;
            }).join('')}
          </div>` : `<div class="b-empty">${icon('info')}<span>Record the closed pitch and the test-hole pitch to see every hole's size.</span></div>`}
      </div>`;
  }

  if (['boneDry', 'bisque', 'final'].includes(stage)) {
    const intro = {
      boneDry: 'Blow every note once more. Pitch rises while the clay dries; small corrections are still possible with careful filing.',
      bisque: 'After the first firing the targets are concert pitch. Flat notes can be filed larger; sharp ones can\'t be lowered.',
      final: 'After the glaze firing, a last pass records the finished tuning.',
    }[stage];
    const ch = inst.chambers[ci];
    const targets = stageTargets(ch, stage, shrink, b.a4);
    body = `
      <p class="b-intro">${intro}</p>
      <div class="card b-card b-readings">
        ${ch.notes.map(midi => bNoteReading(inst, ci, stage, midi, targets, nn, from)).join('')}
      </div>`;
  }

  if (stage === 'done') {
    const learned = b.learnedShrink;
    const clayName = getClayBodies().find(c => c.id === b.clayBody)?.name ?? 'this clay';
    body = `
      <div class="card b-card">
        <h3 class="b-done-title">${icon('check')} ${escHtml(inst.name)} is finished</h3>
        <p class="b-text">It's playable from the Notes and Chords tabs, with its hole sizes and measured pitches stored.</p>
        ${learned != null ? `
          <dl class="b-result">
            <div><dt>Shrinkage, leather-hard to fired</dt><dd>${(learned * 100).toFixed(1)}%</dd></div>
          </dl>
          <p class="b-meta">That's now the default for ${escHtml(clayName)}.</p>` : ''}
        ${inst.chambers.map((ch, i) => {
          const byFinger = [];
          ch.holes.forEach(h => {
            const last = byFinger[byFinger.length - 1];
            if (last && last.finger === bHoleName(h)) last.n++; else byFinger.push({ finger: bHoleName(h), n: 1, mm: h.sizeMm });
          });
          return `
            <table class="b-table">
              <caption>${inst.chambers.length > 1 ? `Chamber ${i + 1} · ` : ''}hole sizes</caption>
              <thead><tr><th scope="col">Finger</th><th scope="col">Size</th></tr></thead>
              <tbody>${byFinger.map(g => `<tr><td>${escHtml(g.finger)}</td><td>${g.mm ? (g.n > 1 ? g.n + ' × ' : '') + g.mm.toFixed(1) + ' mm' : '—'}</td></tr>`).join('')}</tbody>
            </table>`;
        }).join('')}
      </div>
      <div class="b-actions">
        <button type="button" class="btn btn-primary" data-action="oc-tab" data-tab="notes">Open Notes</button>
        <button type="button" class="btn btn-secondary" data-action="share-instrument">${icon('share-2')} Share…</button>
      </div>`;
  }

  const nextLabel = stage === 'final' ? 'Finish' : stage === 'done' ? '' : `Next: ${stageName(nextStage(stage))}`;
  return `${instrumentAppBar(inst, 'builder')}
    <div class="b-layout">
      <div class="b-main">
        ${bStepsHtml(stage)}
        ${perChamber ? bChamberSwitch(inst, nn) : ''}
        ${body}
        ${nextLabel || stage === 'bisque' ? `
          <div class="b-actions">
            ${nextLabel ? `<button type="button" class="btn btn-primary b-next" data-action="b-next">${escHtml(nextLabel)}${stage === 'final' ? '' : ` ${icon('chevron-right')}`}</button>` : ''}
            ${stage === 'bisque' ? '<button type="button" class="btn btn-ghost b-next" data-action="b-unglazed">Unglazed: finish now</button>' : ''}
          </div>` : ''}
      </div>
      ${bPreviewHtml(inst, stage, nn)}
    </div>`;
}

// Set-up for a bought ocarina (§6.17): which finger covers each hole
// (folded into a sheet), then one reading with all holes closed and one per
// hole open on its own. A capture arms the next empty reading by itself.
function setupOf(inst) {
  if (inst.setup) return inst.setup;
  // From a published chart: its own holes (the owner may rename fingers).
  if (inst.kind === 'traditional') return { holes: (inst.chambers?.[0]?.holes ?? []).map(h => ({ ...h })) };
  return { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
}

// Holes of a bought flute live in its flute set-up; everything else in setupOf.
function holesSetupOf(inst) {
  return inst.family === 'flute' && inst.kind === 'custom' ? fluteSetupOf(inst) : setupOf(inst);
}

function viewSetup(inst) {
  if (state.oc.holeMap && inst.family === 'ocarina') return viewHoleMap(inst);
  if (inst.kind === 'traditional') return viewChartSetup(inst);
  if (inst.family === 'flute') return viewFluteSetup(inst);
  const setup = setupOf(inst);
  const mapped = setup.holes.filter((h, i) => h.side !== 'bottom' && inst.holeMap?.[i]).length;
  const tops = setup.holes.filter(h => h.side !== 'bottom').length;
  // Listed by finger (R1 first), not in the stored opening order.
  const paths = ['s:f0', ...holeDisplayOrder(setup.holes).map(i => `s:${i}`)];
  const holeOf = p => parseInt(p.slice(2), 10);
  const value = p => (p === 's:f0' ? setup.f0 : setup.singles[holeOf(p)]);
  const filled = paths.filter(p => value(p) > 0).length;
  const left = paths.length - filled;
  const next = paths.find(p => !(value(p) > 0));
  const standard = defaultCustomHoles(setup.holes.length).every((h, i) => h.finger === setup.holes[i].finger);
  const subs = setup.holes.filter(h => h.sub).length;
  const label = p => (p === 's:f0' ? 'All holes closed' : `Only ${escHtml(holeLabel(setup.holes, holeOf(p)))} open`);
  return `${instrumentAppBar(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Everything about your ocarina: what it's called, its holes and fingers, and the readings its fingering chart is worked out from.</p>
        ${instSetupCardHtml(inst)}
        ${holeMapCardHtml(inst)}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${setup.holes.length} holes · ${standard ? 'standard order' : 'your order'}${subs ? ` · ${subs} sub-hole${subs !== 1 ? 's' : ''}` : ''}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${holeDisplayOrder(setup.holes).map(i => escHtml(holeLabel(setup.holes, i))).join(' · ')}</p>
          ${duplicateFingers(setup.holes).length ? `<p class="b-meta is-warning">More than one hole is on ${duplicateFingers(setup.holes).join(', ')}: tap Edit to check.</p>` : ''}
        </div>
        <div class="card b-card">
          <div class="b-card-head">
            <h3 class="b-card-title">Readings</h3>
            <span class="b-card-count">${filled} of ${paths.length}</span>
          </div>
          <div class="practice-progress" role="progressbar" aria-label="Readings recorded" aria-valuemin="0" aria-valuemax="${paths.length}" aria-valuenow="${filled}">
            <span style="width:${Math.round((filled / paths.length) * 100)}%"></span>
          </div>
          <p class="b-meta">Blow each line into the tuner: tap ${icon('mic')}<span class="sr-only">the microphone</span>, blow steadily at a medium breath, and it fills itself in.</p>
          <div class="s-readings">
            ${paths.map((p, i) => {
              const v = value(p);
              const isNext = p === next;
              return `
                <div class="s-reading${isNext ? ' is-next' : ''}${v > 0 ? ' is-filled' : ''}">
                  <div class="s-reading-head">
                    ${mapped && p !== 's:f0' ? `<span class="s-reading-map" aria-hidden="true">${holeMapSvg(inst, { highlight: holeOf(p), mini: true })}</span>` : ''}
                    <span class="s-reading-label">${label(p)}</span>
                    ${isNext ? uiBadge('Next', 'accent') : v > 0 ? `<span class="s-done" aria-label="Recorded">${icon('check')}</span>` : ''}
                  </div>
                  ${uiHzField(p, v, { label: `${p === 's:f0' ? 'All holes closed' : `Only ${holeLabel(setup.holes, holeOf(p))} open`}, Hz` })}
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="b-actions">
          <button type="button" class="btn btn-primary b-next" data-action="s-calibrate" ${left ? 'disabled' : ''}>Work out the fingering chart</button>
        </div>
        <p class="b-meta">${left ? `${left} reading${left !== 1 ? 's' : ''} to go` : 'Every reading is in.'}</p>
        ${inst.calibration ? `<p class="b-meta">Current chart: ${playableMidis(inst).length} notes. Predicted fingerings are within 20 cents; check them with the tuner.</p>` : ''}
      </div>
    </div>`;
}

// Set up for a flute that isn't charted (Other flute): one reading with all
// holes closed, then one more for each hole lifted, from the bottom up, the
// lower ones staying open. Paths "f:<step>". Holes count from the mouthpiece.
function fluteSetupOf(inst) {
  return inst.setup ?? { holes: fluteHoles(inst.holeCount), readings: [] };
}

function fluteSetupPaths(setup) {
  return Array.from({ length: setup.holes.length + 1 }, (_, k) => `f:${k}`);
}

function fluteStepLabel(n, k) {
  if (k === 0) return 'All holes closed';
  if (k === 1) return `Lift the lowest hole (hole ${n})`;
  return k === n ? 'Also lift hole 1: all holes open' : `Also lift hole ${n - k + 1}`;
}

function viewFluteSetup(inst) {
  const setup = fluteSetupOf(inst);
  const n = setup.holes.length;
  const uf = state.useFlats, us = state.useSolfege;
  const paths = fluteSetupPaths(setup);
  const value = k => setup.readings[k];
  const filled = paths.filter((_, k) => value(k) > 0).length;
  const left = paths.length - filled;
  const next = paths.findIndex((_, k) => !(value(k) > 0));
  // Heard note per reading, and readings that repeat an earlier note.
  const heard = paths.map((_, k) => {
    if (!(value(k) > 0)) return null;
    const exact = hzToMidi(value(k));
    return { midi: Math.round(exact), cents: Math.round((exact - Math.round(exact)) * 100) };
  });
  const firstWith = midi => heard.findIndex(h => h?.midi === midi);
  const cents = c => (c === 0 ? '0 ¢' : `${c > 0 ? '+' : '−'}${Math.abs(c)} ¢`);
  const pattern = k => fluteStepStates(n, k).map(st => (st === 'c' ? '●' : '○')).join(' ');
  const dropped = inst.calibration?.dropped ?? [];
  return `${instrumentAppBar(inst, 'setup')}
    <div class="b-layout is-single">
      <div class="b-main">
        <h2 class="b-title">Set up</h2>
        <p class="b-intro">Blow each line into the tuner. Tap ${icon('mic')}<span class="sr-only">the microphone</span>, blow, and it fills itself in.</p>
        <p class="b-meta">Holes count from the mouthpiece down: hole 1 is nearest your mouth. Lifted holes stay open for the lines below. Blow steadily at a medium breath.</p>
        ${instSetupCardHtml(inst)}
        <div class="card b-card">
          <div class="b-card-head">
            <div class="b-card-head-text">
              <h3 class="b-card-title">Holes and fingers</h3>
              <p class="b-meta">${n} holes, from the mouthpiece down</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-action="s-fingers-open" aria-haspopup="dialog">${icon('pencil')} Edit</button>
          </div>
          <p class="b-fingers">${setup.holes.map(h => escHtml(h.finger)).join(' ')}</p>
        </div>
        <div class="card b-card">
          <div class="b-card-head">
            <h3 class="b-card-title">Readings</h3>
            <span class="b-card-count">${filled} of ${paths.length}</span>
          </div>
          <div class="practice-progress" role="progressbar" aria-label="Readings recorded" aria-valuemin="0" aria-valuemax="${paths.length}" aria-valuenow="${filled}">
            <span style="width:${Math.round((filled / paths.length) * 100)}%"></span>
          </div>
          <div class="s-readings">
            ${paths.map((p, k) => {
              const v = value(k);
              const h = heard[k];
              const repeat = h && firstWith(h.midi) < k;
              const isNext = k === next;
              return `
                <div class="s-reading${isNext ? ' is-next' : ''}${v > 0 ? ' is-filled' : ''}">
                  <div class="s-reading-head">
                    <span class="s-reading-label">${escHtml(fluteStepLabel(n, k))}</span>
                    ${isNext ? uiBadge('Next', 'accent') : v > 0 ? `<span class="s-done" aria-label="Recorded">${icon('check')}</span>` : ''}
                  </div>
                  <div class="b-meta fl-step"><span class="fl-pattern" aria-hidden="true">${pattern(k)}</span>${h ? ` · ${escHtml(displayNote(midiToNoteName(h.midi), uf, us))} ${cents(h.cents)}` : ''}${repeat ? ` · <span class="is-warning">same note as “${escHtml(fluteStepLabel(n, firstWith(h.midi)))}”</span>` : ''}</div>
                  ${uiHzField(p, v, { label: `${fluteStepLabel(n, k)}, Hz` })}
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="b-actions">
          <button type="button" class="btn btn-primary b-next" data-action="f-work-out" ${left ? 'disabled' : ''}>Work out the chart</button>
        </div>
        <p class="b-meta">${left ? `${left} reading${left !== 1 ? 's' : ''} to go` : 'Every reading is in.'}</p>
        ${inst.calibration ? `<p class="b-meta">Current chart: ${playableMidis(inst).length} notes, each the nearest note to what you blew.${dropped.length ? ` ${dropped.length} reading${dropped.length !== 1 ? 's' : ''} gave a note already charted and ${dropped.length !== 1 ? 'were' : 'was'} left out.` : ''}</p>` : ''}
      </div>
    </div>`;
}

// ── Click: Builder and set-up ─────────────────────────────────────────────
registerActions({
  'b-record': (el, e, action) => {
    // Arm the field (or disarm it); the tuner turns on if it's off.
    if (state.rec.armed === el.dataset.path) { disarmRecord(); render(); return; }
    armRecord(el.dataset.path);
    if (!state.tuner.on || state.tuner.error) {
      if (state.tuner.error) { stopTunerMic(); state.tuner.on = false; }
      toggleTuner();
      return;
    }
    render();
    return;
  },
  'b-stage, b-next, b-unglazed': (el, e, action) => {
    let inst = currentInstrument();
    if (!inst) return;
    const target = action === 'b-stage' ? el.dataset.stage
      : action === 'b-unglazed' ? 'done' : nextStage(inst.build.stage);
    if (target === 'done' && inst.build.stage !== 'done') inst = finishInstrumentBuild(inst);
    else inst.build.stage = target;
    state.oc.buildChamber = 0;
    saveInstrument(inst);
    refreshInstruments();
    window.scrollTo(0, 0);
    render();
    return;
  },
  'b-design': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst || el.tagName === 'SELECT' || el.tagName === 'INPUT') return; // handled on change
    inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    const key = el.dataset.key, v = parseInt(el.dataset.value, 10);
    if (key === 'chambers') Object.assign(inst.design, { chambers: v, windowStart: null, excluded: [] });
    if (key === 'windowStart') Object.assign(inst.design, { windowStart: v, excluded: [] });
    if (key === 'toggleNote') {
      const ex = inst.design.excluded ?? [];
      inst.design.excluded = ex.includes(v) ? ex.filter(x => x !== v) : [...ex, v];
    }
    applyDesign(inst);
    saveInstrument(inst);
    render();
    return;
  },
  'b-design-subs, b-design-sublayout, b-design-fill': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const d = inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    if (action === 'b-design-subs') d.subHoles = parseInt(el.dataset.n, 10) || 0;
    else if (action === 'b-design-fill') d.fillGaps = !d.fillGaps;
    else d.subLayout = el.dataset.v;
    applyDesign(inst);
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  },
  'b-design-transpose, b-design-gu, b-design-chambers': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const d = inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
    if (action === 'b-design-transpose') {
      Object.assign(d, { transpose: Math.max(-6, Math.min(6, (d.transpose ?? 0) + parseInt(el.dataset.delta, 10))), windowStart: null, excluded: [] });
    }
    if (action === 'b-design-gu') Object.assign(d, { includeGu: !(d.includeGu ?? true), chambers: null, windowStart: null, excluded: [] });
    if (action === 'b-design-chambers') Object.assign(d, { chambers: parseInt(el.dataset.n, 10), windowStart: null, excluded: [] });
    applyDesign(inst);
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  },
  'b-chamber': (el, e, action) => {
    state.oc.buildChamber = parseInt(el.dataset.ci, 10) || 0;
    render();
    return;
  },
  'fg-edit-open': (el, e, action) => {
    const inst = currentInstrument();
    const f = inst && fingeringFor(inst, state.oc.selected);
    if (!f) return;
    state.oc.fgEdit = { midi: state.oc.selected, states: [...f.states] };
    render();
    return;
  },
  'fg-edit-hole': (el, e, action) => { if (!(state.oc.fgEdit)) return;
    const i = parseInt(el.dataset.index, 10);
    const next = { c: 'o', o: 'h', h: 'c' };
    state.oc.fgEdit.states[i] = next[state.oc.fgEdit.states[i]] ?? 'c';
    render();
    return;
  },
  'fg-edit-cancel': (el, e, action) => { state.oc.fgEdit = null; render(); return; },
  'fg-edit-save, fg-edit-reset': (el, e, action) => {
    const inst = currentInstrument();
    const ed = state.oc.fgEdit;
    if (!inst || !ed) return;
    inst.setup = inst.setup ?? setupOf(inst);
    const fixed = { ...(inst.setup.fixed ?? {}) };
    if (action === 'fg-edit-save') fixed[ed.midi] = ed.states;
    else delete fixed[ed.midi];
    let heard = null;
    if (action === 'fg-edit-save' && ed.hz > 0) {
      // A reading of this fingering: one more measurement for the fit. It
      // fixes the note it actually sounds, which may not be the one picked.
      const same = x => x.states.join() === ed.states.join();
      inst.setup.extra = [...(inst.setup.extra ?? []).filter(x => !same(x)), { states: ed.states, hz: ed.hz }];
      heard = Math.round(hzToMidi(ed.hz));
      if (heard !== ed.midi) delete fixed[ed.midi];
    }
    inst.setup.fixed = fixed;
    if (heard != null) {
      const s2 = inst.setup;
      const ch = calibrateChamber(s2.holes, s2.f0, s2.singles, { extra: s2.extra });
      if (ch) {
        inst.chambers = [withFixedFingerings({ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }, fixed)];
        inst.calibration = ch.calibration;
      }
    } else if (action === 'fg-edit-save') {
      inst.chambers = [withFixedFingerings(inst.chambers[0], { [ed.midi]: ed.states })];
    } else if (inst.kind === 'traditional') {
      // Back to the published chart's fingering for this note.
      const chartFg = instrumentFromChart(inst.type, inst.key).chambers[0].fingerings[ed.midi];
      const fg = { ...inst.chambers[0].fingerings };
      if (chartFg) fg[ed.midi] = chartFg; else delete fg[ed.midi];
      inst.chambers[0] = { ...inst.chambers[0], fingerings: fg, notes: Object.keys(fg).map(Number).sort((a, b) => a - b) };
    } else {
      // Back to the chart worked out from the readings for this note.
      const s = inst.setup;
      const ch = calibrateChamber(s.holes, s.f0, s.singles, { extra: s.extra });
      if (ch?.fingerings[ed.midi]) inst.chambers[0] = { ...inst.chambers[0], fingerings: { ...inst.chambers[0].fingerings, [ed.midi]: ch.fingerings[ed.midi] } };
    }
    saveInstrument(inst);
    refreshInstruments();
    state.oc.fgEdit = null;
    const uf = state.useFlats, us = state.useSolfege;
    showToast(heard != null && heard !== ed.midi
      ? `That fingering sounds ${displayNote(midiToNoteName(heard), uf, us)}: saved for ${displayNote(midiToNoteName(heard), uf, us)}, chart updated`
      : heard != null ? 'Fingering and reading saved, chart updated'
      : action === 'fg-edit-save' ? 'Fingering saved' : inst.kind === 'traditional' ? 'Back to the chart\'s fingering' : 'Back to the worked-out fingering');
    if (heard != null && playableMidis(inst).includes(heard)) state.oc.selected = heard;
    render();
    return;
  },
  'inst-edit-open': (el, e, action) => {
    const id = el.dataset.id || state.currentInstrumentId;
    const inst = getInstrument(id);
    state.menu = false;
    // One you set up yourself is edited on its Set up tab, with everything else.
    if ((inst?.kind === 'custom' || inst?.kind === 'traditional') && !usesLayout(inst)) {
      if (state.currentInstrumentId !== id || state.view !== 'instrument') openInstrument(id);
      state.oc.tab = 'setup';
      state.oc.holeMap = null;
      navReplace(`#i/${id}/setup`);
      render();
      window.scrollTo({ top: 0 });
      return;
    }
    state.instEdit = id;
    render();
    return;
  },
  'crop-cancel': (el, e, action) => { state.photoCrop = null; render(); return; },
  'crop-done': (el, e, action) => { finishCrop(); return; },
  'crop-rotate': (el, e, action) => { rotateCropImage().catch(() => showToast('That photo couldn\'t be turned')); return; },
  'inst-edit-close': (el, e, action) => { state.instEdit = null; refreshInstruments(); render(); return; },
  'ie-photo-remove, ie-holes-step': (el, e, action) => {
    let inst = getInstrument(el.dataset.id || state.instEdit);
    if (!inst) return;
    if (action === 'ie-photo-remove') { delete inst.photo; delete inst.holeMap; }
    else inst = withHoleCount(inst, (inst.holeCount ?? 0) + parseInt(el.dataset.delta, 10));
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  },
  'hm-open': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    state.oc.holeMap = { sel: hmFirstUnmarked(inst) ?? 0 };
    render();
    return;
  },
  'hm-close': (el, e, action) => { state.oc.holeMap = null; render(); return; },
  'hm-select': (el, e, action) => { state.oc.holeMap.sel = parseInt(el.dataset.index, 10); render(); return; },
  'hm-place, hm-clear': (el, e, action) => {
    const inst = currentInstrument();
    const sel = state.oc.holeMap?.sel;
    if (!inst || sel == null) return;
    const n = setupOf(inst).holes.length;
    inst.holeMap = Array.from({ length: n }, (_, i) => inst.holeMap?.[i] ?? null);
    if (action === 'hm-clear') {
      inst.holeMap[sel] = null;
    } else {
      const svg = el.querySelector('svg');
      const box = svg.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      inst.holeMap[sel] = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    }
    saveInstrument(inst);
    refreshInstruments();
    if (action === 'hm-place') state.oc.holeMap.sel = hmFirstUnmarked(inst);
    render();
    return;
  },
  's-fingers-reset, s-sub-layout': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const setup = setupOf(inst);
    setup.holes = action === 's-fingers-reset' ? defaultCustomHoles(setup.holes.length) : withSubLayout(setup.holes, el.dataset.value);
    inst.setup = setup;
    if (inst.chambers?.[0]?.holes?.length === setup.holes.length) {
      inst.chambers[0] = { ...inst.chambers[0], holes: inst.chambers[0].holes.map((h, i) => ({ ...h, finger: setup.holes[i].finger, side: setup.holes[i].side, sub: setup.holes[i].sub })) };
    }
    saveInstrument(inst);
    refreshInstruments();
    render();
    return;
  },
  's-fingers-reverse': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const setup = holesSetupOf(inst);
    setup.holes = reverseHandFingers(setup.holes, el.dataset.hand);
    inst.setup = setup;
    // The chart's copies of the holes take the new finger names too.
    if (inst.chambers?.[0]?.holes?.length === setup.holes.length) {
      inst.chambers[0] = { ...inst.chambers[0], holes: inst.chambers[0].holes.map((h, i) => ({ ...h, finger: setup.holes[i].finger, side: setup.holes[i].side })) };
    }
    saveInstrument(inst);
    refreshInstruments();
    showToast(`${el.dataset.hand === 'R' ? 'Right' : 'Left'} hand reversed`);
    render();
    return;
  },
  's-fingers-open': (el, e, action) => { state.oc.fingersSheet = true; render(); return; },
  's-fingers-close': (el, e, action) => { state.oc.fingersSheet = false; render(); return; },
  'b-hole-done': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10), idx = parseInt(el.dataset.index, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    const done = per.holesDone ?? [];
    per.holesDone = done.includes(idx) ? done.filter(x => x !== idx) : [...done, idx];
    saveInstrument(inst);
    bAdvanceChamber(inst);
    render();
    return;
  },
  'b-window': (el, e, action) => { if (!(el.tagName === 'BUTTON')) return;
    const inst = currentInstrument();
    if (!inst) return;
    const ci = parseInt(el.dataset.ci, 10);
    const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
    per.window = { ...chamberBuild(inst, ci).window, shape: el.dataset.value };
    saveInstrument(inst);
    render();
    return;
  },
  'f-work-out': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst?.setup || inst.family !== 'flute') return;
    const ch = fluteChamberFromReadings(inst.setup.holes, inst.setup.readings);
    if (!ch || ch.notes.length < 2) { showToast('Those readings don\'t give a chart: check each line is a different note'); return; }
    inst.chambers = [withFixedFingerings({ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }, inst.setup.fixed)];
    inst.calibration = ch.calibration;
    saveInstrument(inst);
    refreshInstruments();
    state.oc.tab = 'notes';
    navReplace(`#i/${inst.id}/notes`);
    const n = ch.calibration.dropped.length;
    const nn = m => displayNote(midiToNoteName(m), state.useFlats, state.useSolfege);
    showToast(n
      ? `Chart ready: ${ch.notes.length} notes. ${ch.calibration.dropped.map(d => nn(d.midi)).join(', ')} came out twice; the first fingering is kept`
      : `Chart ready: ${ch.notes.length} notes`);
    render();
    return;
  },
  's-calibrate': (el, e, action) => {
    const inst = currentInstrument();
    if (!inst?.setup) return;
    const ch = calibrateChamber(inst.setup.holes, inst.setup.f0, inst.setup.singles, { extra: inst.setup.extra });
    if (!ch || ch.notes.length < 2) { showToast('Those readings don\'t give a chart: check each hole raises the pitch'); return; }
    inst.chambers = [{ notes: ch.notes, holes: ch.holes, fingerings: ch.fingerings }];
    inst.calibration = ch.calibration;
    saveInstrument(inst);
    refreshInstruments();
    state.oc.tab = 'notes';
    showToast(`Chart ready: ${ch.notes.length} notes`);
    render();
    return;
  },
});

// ── Change: Builder and set-up ────────────────────────────────────────────
registerActions({
  'b-input, b-shrink, b-window, b-clay, b-from, s-finger, b-design': (el, e, action) => { if (!(action === 'b-input' || action === 'b-shrink' || (action === 'b-window' && el.tagName === 'INPUT')
      || action === 'b-clay' || action === 'b-from' || action === 's-finger'
      || (action === 'b-design' && (el.tagName === 'SELECT' || el.tagName === 'INPUT')))) return;
    let inst = currentInstrument();
    if (!inst) return;
    const num = parseFloat(el.value);
    if (action === 'b-input') {
      // Record fields take a note ("D4", "Re4 +12") or a frequency; other
      // builder inputs (the test hole in mm) stay plain numbers.
      const v = el.dataset.kind === 'pitch' ? parsePitch(el.value) : (num > 0 ? num : null);
      if (el.dataset.kind === 'pitch' && el.value.trim() && v == null) { showToast(`"${el.value.trim()}" isn't a note or a frequency`); render(); return; }
      setReading(inst, el.dataset.path, v);
    }
    if (action === 'b-shrink' && num >= 0) inst.build.shrinkPct = num;
    if (action === 'b-window') {
      const ci = parseInt(el.dataset.ci, 10);
      const per = inst.build.perChamber[ci] = inst.build.perChamber[ci] ?? {};
      if (num > 0) per.window = { ...chamberBuild(inst, ci).window, [el.dataset.key]: num };
    }
    if (action === 'b-clay') {
      if (el.value === '__new__') {
        const name = (prompt('Name of the clay body') || '').trim();
        if (!name) { render(); return; }
        const pct = parseFloat(prompt('Its shrinkage in %, if known', '11')) || 11;
        const clay = { id: 'clay-' + Date.now().toString(36), name, shrinkPct: pct, builds: 0 };
        saveClayBodies([...getClayBodies(), clay]);
        inst.build.clayBody = clay.id;
        inst.build.shrinkPct = pct;
      } else {
        const clay = getClayBodies().find(c => c.id === el.value);
        inst.build.clayBody = el.value;
        if (clay) inst.build.shrinkPct = clay.shrinkPct;
      }
    }
    if (action === 'b-from') {
      const src = getInstrument(el.value);
      inst.build.fromId = src ? src.id : null;
      if (src) {
        inst.design = { ...(src.design ?? { scaleId: src.scaleId, transpose: src.transpose, includeGu: src.includeGu }) };
        applyDesign(inst);
        inst.build.clayBody = src.build.clayBody;
        const clay = getClayBodies().find(c => c.id === src.build.clayBody);
        inst.build.shrinkPct = clay ? clay.shrinkPct : src.build.shrinkPct;
        inst.build.perChamber = (src.build.perChamber ?? []).map(p => ({ window: p?.window, testHoleMm: p?.readings?.leather?.d }));
      }
    }
    if (action === 's-finger') {
      const setup = holesSetupOf(inst);
      const h = setup.holes[parseInt(el.dataset.index, 10)];
      h.finger = el.value;
      h.side = el.value.endsWith('T') ? 'bottom' : 'top';
      inst.setup = setup;
      // The chart's holes are copies made when it was worked out: keep their
      // finger names in step (the notes don't depend on them).
      const ch = inst.chambers?.[0]?.holes?.[parseInt(el.dataset.index, 10)];
      if (ch) Object.assign(ch, { finger: h.finger, side: h.side });
    }
    if (action === 'b-design') {
      inst.design = inst.design ?? { scaleId: inst.scaleId, transpose: inst.transpose, includeGu: inst.includeGu };
      const key = el.dataset.key;
      if (key === 'scaleId') Object.assign(inst.design, { scaleId: el.value, chambers: null, windowStart: null, excluded: [] });
      applyDesign(inst);
      if (!inst.name || inst.name.endsWith(' ocarina')) inst.name = `${findTuning(inst.scaleId).name} ocarina`;
    }
    saveInstrument(inst);
    refreshInstruments();
    if (action === 'b-input') bAdvanceChamber(inst);
    // The Hole fingers sheet stays as it is (and keeps focus) while it's open.
    if (action === 's-finger' && state.oc.fingersSheet) return;
    render();
  },
}, CHANGE_ACTIONS);
