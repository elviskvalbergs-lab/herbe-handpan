// Unit tests for js/builder.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noteToMidi } from '../js/data.js';
import { midiToHz, predictFingeringHz, buildChamber } from '../js/ocarina.js';
import { createScaleOcarina } from '../js/instruments.js';
import {
  stageTargets, noteAdvice, leatherHolePlan, bodyPlan, nextStage, finishBuild,
  updateClayBody, defaultCustomHoles, calibrateChamber, chamberBuild,
} from '../js/builder.js';

const m = n => noteToMidi(n);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('stage targets: leather-hard lowered by shrinkage, later stages at concert pitch', () => {
  const ch = buildChamber([m('D4'), m('E4')]);
  close(stageTargets(ch, 'leather', 0.11)[m('D4')], midiToHz(m('D4')) * 0.89);
  close(stageTargets(ch, 'bisque', 0.11)[m('E4')], midiToHz(m('E4')));
});

test('advice per stage', () => {
  const t = 300;
  const flat12 = t * 2 ** (-12 / 1200);
  assert.deepEqual(noteAdvice('leather', flat12, t), { cents: -12, status: 'flat', text: '12 cents flat: open it slightly' });
  assert.equal(noteAdvice('bisque', flat12, t).text, '12 cents flat: file this hole a little larger');
  assert.equal(noteAdvice('bisque', t * 2 ** (20 / 1200), t).text, "20 cents sharp: can't be lowered by filing");
  assert.equal(noteAdvice('final', t * 2 ** (5 / 1200), t).status, 'ok');
});

test('leather-hole plan matches holeSizes with lowered targets', () => {
  const ch = buildChamber([m('D4'), m('E4'), m('F4')]);
  assert.equal(leatherHolePlan(ch, { f0: 260 }, 0.11), null);
  const plan = leatherHolePlan(ch, { f0: 260, d: 6, f1: 280 }, 0.11);
  const W = 6 / ((280 / 260) ** 2 - 1);
  const tE = midiToHz(m('E4')) * 0.89, tF = midiToHz(m('F4')) * 0.89;
  close(plan.W, W, 1e-9);
  close(plan.holes[0].mm, W * ((tE / 260) ** 2 - 1), 1e-9);
  close(plan.holes[1].mm, W * ((tF / 260) ** 2 - 1) - plan.holes[0].mm, 1e-9);
  assert.equal(plan.holes[0].finger, 'R4');
});

test('body plan and stages', () => {
  const oc = createScaleOcarina({ scaleId: 'D-Kurd' });
  const plan = bodyPlan(oc);
  assert.equal(plan.length, 2);
  assert.ok(plan[0].volume > plan[1].volume); // lower chamber is bigger
  assert.deepEqual(chamberBuild(oc, 0).window, { shape: 'rect', w: 13, l: 9.75, t: 4 });
  assert.equal(nextStage('design'), 'body');
  assert.equal(nextStage('bisque'), 'final');
  assert.equal(nextStage('bisque', { unglazed: true }), 'done');
});

test('finishing a build stores sizes and learns shrinkage', () => {
  const oc = createScaleOcarina({ scaleId: 'D-Kurd' });
  const [c0] = oc.chambers;
  oc.build.perChamber[0] = { readings: {
    leather: { f0: 130, d: 6, f1: 150, notes: { [c0.notes[0]]: 130, [c0.notes[1]]: 196 } },
    final: { notes: { [c0.notes[0]]: 146, [c0.notes[1]]: 220 } },
  } };
  const { inst, learned } = finishBuild(oc);
  close(learned, ((1 - 130 / 146) + (1 - 196 / 220)) / 2, 1e-12);
  assert.equal(inst.build.stage, 'done');
  assert.ok(inst.chambers[0].holes.every(h => h.sizeMm > 0));
  assert.equal(inst.chambers[1].holes[0].sizeMm, null); // no readings for chamber 2
  // The default 6 mm test hole counts when no size was typed in.
  const oc2 = createScaleOcarina({ scaleId: 'D-Kurd' });
  oc2.build.perChamber[0] = { readings: { leather: { f0: 130, f1: 150 } } };
  assert.ok(finishBuild(oc2).inst.chambers[0].holes.every(h => h.sizeMm > 0));
  const body = updateClayBody({ id: 'b', shrinkPct: 11, builds: 1 }, 0.13);
  assert.deepEqual(body, { id: 'b', shrinkPct: 12, builds: 2 });
});

test('custom ocarina: default holes and calibration', () => {
  // Split between the hands by anatomy, the right hand taking the odd hole.
  const f = n => defaultCustomHoles(n).map(h => h.finger);
  assert.deepEqual(f(3), ['R2', 'R1', 'L1']);
  assert.deepEqual(f(4), ['R2', 'R1', 'L2', 'L1']);
  assert.deepEqual(f(5), ['R3', 'R2', 'R1', 'L2', 'L1']);
  assert.deepEqual(f(7), ['R4', 'R3', 'R2', 'R1', 'L3', 'L2', 'L1']);
  assert.deepEqual(f(9), ['R4', 'R3', 'R2', 'R1', 'L4', 'L3', 'L2', 'L1', 'LT']);
  const twelve = defaultCustomHoles(12);
  assert.equal(twelve.length, 12);
  assert.deepEqual(twelve.slice(8, 10).map(h => [h.finger, h.side]), [['LT', 'bottom'], ['RT', 'bottom']]);
  assert.ok(twelve.slice(10).every(h => h.sub));
  assert.deepEqual(twelve.slice(10).map(h => h.finger), ['R2', 'L2']);

  // A 4-hole ocarina whose holes give a C major pentachord, cumulatively.
  const holes = defaultCustomHoles(4);
  const f0 = midiToHz(60);
  const totals = [62, 64, 65, 67].map(x => (midiToHz(x) / f0) ** 2 - 1);
  const ratios = totals.map((t, i) => t - (i ? totals[i - 1] : 0));
  const singles = ratios.map((_, i) => predictFingeringHz(f0, ratios, ratios.map((__, j) => (j === i ? 'o' : 'c'))));
  assert.equal(calibrateChamber(holes, f0, singles.slice(0, 3)), null);
  const ch = calibrateChamber(holes, f0, singles);
  assert.deepEqual(ch.fingerings[64], ['o', 'o', 'c', 'c']);
  assert.deepEqual(ch.fingerings[67], ['o', 'o', 'o', 'o']);
  assert.ok(ch.notes.includes(61) && ch.notes.includes(63)); // chromatic notes found too
  assert.equal(Math.max(...ch.holes.map(h => h.rel)), 1);
});

test('flute holes: fingers by hole count, from the mouthpiece down', async () => {
  const { fluteHoles } = await import('../js/builder.js');
  const f = n => fluteHoles(n).map(h => h.finger).join(' ');
  assert.equal(f(6), 'L1 L2 L3 R1 R2 R3');
  assert.equal(f(5), 'L2 L3 R1 R2 R3');
  assert.equal(f(3), 'R1 R2 R3');
  assert.equal(f(7), 'L1 L2 L3 R1 R2 R3 R4');
  assert.equal(f(8), 'L1 L2 L3 L4 R1 R2 R3 R4');
  assert.ok(fluteHoles(6).every(h => h.side === 'top'));
});

test('flute chamber from recorded notes: cumulative openings, cents kept, repeats dropped', async () => {
  const { fluteHoles, fluteChamberFromReadings, fluteStepStates } = await import('../js/builder.js');
  const holes = fluteHoles(6);
  const hz = (n, c = 0) => midiToHz(m(n)) * 2 ** (c / 1200);
  assert.deepEqual(fluteStepStates(4, 0), ['c', 'c', 'c', 'c']);
  assert.deepEqual(fluteStepStates(4, 1), ['c', 'c', 'c', 'o']);
  assert.deepEqual(fluteStepStates(4, 3), ['c', 'o', 'o', 'o']);
  assert.equal(fluteChamberFromReadings(holes, [hz('G3')]), null);
  assert.equal(fluteChamberFromReadings(holes, [hz('G3'), 0, 1, 1, 1, 1, 1]), null);
  const readings = [hz('G3', 12), hz('Bb3', -8), hz('C4'), hz('D4', 3), hz('Eb4', 49), hz('F4'), hz('G4', -20)];
  const ch = fluteChamberFromReadings(holes, readings);
  assert.deepEqual(ch.notes, ['G3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4'].map(m));
  assert.deepEqual(ch.fingerings[m('G3')], ['c', 'c', 'c', 'c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[m('Bb3')], ['c', 'c', 'c', 'c', 'c', 'o']);
  assert.deepEqual(ch.fingerings[m('G4')], ['o', 'o', 'o', 'o', 'o', 'o']);
  assert.equal(ch.calibration.cents[m('G3')], 12);
  assert.equal(ch.calibration.cents[m('Bb3')], -8);
  assert.equal(ch.calibration.cents[m('Eb4')], 49);
  assert.deepEqual(ch.calibration.dropped, []);
  assert.deepEqual(ch.holes, holes);
  // Two readings on the same note: the first is kept, the second reported.
  const dup = fluteChamberFromReadings(fluteHoles(3), [hz('C4'), hz('D4'), hz('D4', 20), hz('E4')]);
  assert.deepEqual(dup.notes, ['C4', 'D4', 'E4'].map(m));
  assert.deepEqual(dup.fingerings[m('D4')], ['c', 'c', 'o']);
  assert.deepEqual(dup.calibration.dropped, [{ step: 2, midi: m('D4'), keptStep: 1 }]);
  // Readings are rounded against the given A4.
  assert.deepEqual(fluteChamberFromReadings(fluteHoles(3), [432, 485, 545, 577], { a4: 432 }).notes, [69, 71, 73, 74]);
});

test('bought instruments: change the hole count, mark holes on the photo', async () => {
  const { withHoleCount, holeSpot, usesHoleMap } = await import('../js/builder.js');
  const oc = { id: 'oc-x', family: 'ocarina', kind: 'custom', holeCount: 11, chambers: [{ notes: [60, 62] }], calibration: { a: 1 },
    setup: { holes: defaultCustomHoles(11), f0: 300, singles: [310, 320, 330, 340, 350, 360] },
    holeMap: [{ x: 0.1, y: 0.2 }, null, { x: 0.3, y: 0.4 }] };
  oc.setup.holes[0].finger = 'L1';
  const five = withHoleCount(oc, 5);
  assert.equal(five.holeCount, 5);
  assert.equal(five.setup.holes.length, 5);
  assert.equal(five.setup.holes[0].finger, 'L1');          // kept
  assert.deepEqual(five.setup.singles, [310, 320, 330, 340, 350]);
  assert.equal(five.setup.f0, 300);
  assert.deepEqual(five.chambers, []);                     // chart cleared
  assert.equal(five.calibration, null);
  assert.equal(five.holeMap.length, 5);
  assert.equal(oc.holeCount, 11);                          // original untouched
  assert.equal(withHoleCount(oc, 11), oc);

  const fl = withHoleCount({ family: 'flute', kind: 'custom', holeCount: 6, setup: { readings: [1, 2] } }, 5);
  assert.deepEqual(fl.setup.readings, []);
  assert.equal(fl.setup.holes.length, 5);

  const four = { family: 'ocarina', kind: 'custom', holeCount: 4, setup: { holes: defaultCustomHoles(4) },
    holeMap: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.3, y: 0.1 }, null] };
  assert.equal(usesHoleMap(four), false);
  four.holeMap[3] = { x: 0.4, y: 0.1 };
  assert.equal(usesHoleMap(four), true);
  assert.deepEqual(holeSpot(four, 1), { x: 0.2, y: 0.1 });
  four.setup.holes[1].side = 'bottom';                     // a thumb hole: underneath, no spot
  assert.equal(holeSpot(four, 1), null);
});

test('calibration: a note blown at set-up keeps the fingering it was blown with', () => {
  // Five holes; with only the third open the ocarina sounds C5, with only
  // the first open G4 (as on the owner's ocarina). Holes 1 and 2 open
  // together are predicted to give C5 too, and that fingering is "easier"
  // (holes opening in order), but C5 was heard with hole 3 alone.
  const holes = defaultCustomHoles(5);
  const hz = n => midiToHz(noteToMidi(n));
  const f0 = hz('C4');
  const r1 = (hz('G4') / f0) ** 2 - 1;
  const singles = [hz('G4'), f0 * Math.sqrt(1 + (3 - r1)), hz('C5'), hz('E4'), hz('F4')];
  const ch = calibrateChamber(holes, f0, singles);
  assert.deepEqual(ch.fingerings[noteToMidi('C5')], ['c', 'c', 'o', 'c', 'c']);
  assert.deepEqual(ch.fingerings[noteToMidi('G4')], ['o', 'c', 'c', 'c', 'c']);
  assert.deepEqual(ch.fingerings[noteToMidi('C4')], ['c', 'c', 'c', 'c', 'c']);
});

test('fingerings set by hand override the worked-out chart', async () => {
  const { withFixedFingerings } = await import('../js/builder.js');
  const ch = { notes: [60, 62], holes: [{}, {}], fingerings: { 60: ['c', 'c'], 62: ['o', 'c'] } };
  const out = withFixedFingerings(ch, { 62: ['c', 'o'], 64: ['o', 'o'], 65: ['o'] });
  assert.deepEqual(out.fingerings[62], ['c', 'o']);
  assert.deepEqual(out.notes, [60, 62, 64]);              // 65 has the wrong hole count: ignored
  assert.equal(withFixedFingerings(ch, {}), ch);
});

test('calibration: a reading of another fingering refines the chart and wins its note', () => {
  const holes = defaultCustomHoles(5);
  const hz = n => midiToHz(noteToMidi(n));
  const singles = [hz('E4'), hz('F4'), hz('F#4'), hz('G4'), hz('A4')];
  // Owner: C5 is every hole open but the third.
  const c5 = ['o', 'o', 'c', 'o', 'o'];
  const ch = calibrateChamber(holes, hz('C4'), singles, { extra: [{ states: c5, hz: hz('C5') }] });
  assert.deepEqual(ch.fingerings[noteToMidi('C5')], c5);
  // Readings with the wrong hole count are ignored.
  assert.ok(calibrateChamber(holes, hz('C4'), singles, { extra: [{ states: ['o'], hz: 500 }] }));
});

test('reversing one hand\'s fingers', async () => {
  const { reverseHandFingers } = await import('../js/builder.js');
  const holes = ['L4', 'L3', 'R4', 'R3', 'R2', 'RT'].map(f => ({ id: f, finger: f, side: f.endsWith('T') ? 'bottom' : 'top' }));
  assert.deepEqual(reverseHandFingers(holes, 'R').map(h => h.finger), ['L4', 'L3', 'R2', 'R3', 'R4', 'RT']);
  const full = ['R4', 'R3', 'R2', 'R1'].map(f => ({ finger: f }));
  assert.deepEqual(reverseHandFingers(full, 'R').map(h => h.finger), ['R1', 'R2', 'R3', 'R4']);
  const flute = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'].map(f => ({ finger: f }));
  assert.deepEqual(reverseHandFingers(flute, 'L').map(h => h.finger), ['L3', 'L2', 'L1', 'R1', 'R2', 'R3']);
  assert.equal(holes[2].finger, 'R4');   // original untouched
});

test('a charted ocarina can be drawn on its photo too', async () => {
  const { usesHoleMap } = await import('../js/builder.js');
  const inst = { family: 'ocarina', kind: 'traditional', chambers: [{ holes: [{ finger: 'L1', side: 'top' }, { finger: 'LT', side: 'bottom' }] }], holeMap: [{ x: 0.5, y: 0.5 }, null] };
  assert.equal(usesHoleMap(inst), true);
});

test('holes are listed and named by finger', async () => {
  const { holeDisplayOrder, holeLabel } = await import('../js/builder.js');
  const holes = defaultCustomHoles(5);                      // stored: R3 R2 R1 L2 L1
  assert.deepEqual(holes.map(h => h.finger), ['R3', 'R2', 'R1', 'L2', 'L1']);
  assert.deepEqual(holeDisplayOrder(holes).map(i => holes[i].finger), ['R1', 'R2', 'R3', 'L1', 'L2']);
  const twelve = defaultCustomHoles(12);
  assert.deepEqual(holeDisplayOrder(twelve).map(i => holeLabel(twelve, i)),
    ['R1', 'R2', 'R2 sub-hole', 'R3', 'R4', 'L1', 'L2', 'L2 sub-hole', 'L3', 'L4', 'RT', 'LT']);
  const pair = [{ finger: 'R4' }, { finger: 'R4' }, { finger: 'R3' }];
  assert.deepEqual([0, 1, 2].map(i => holeLabel(pair, i)), ['R4 (1)', 'R4 (2)', 'R3']);
});

test('cropping a photo to a fixed ratio', async () => {
  const { cropRect } = await import('../js/builder.js');
  // A 4000 × 3000 photo in a 4:3 frame: all of it.
  assert.deepEqual(cropRect({ iw: 4000, ih: 3000, ratio: 4 / 3 }), { sx: 0, sy: 0, sw: 4000, sh: 3000 });
  // A portrait photo in a 4:3 frame: full width, a band in the middle.
  const p = cropRect({ iw: 3000, ih: 4000, ratio: 4 / 3 });
  assert.equal(p.sw, 3000); assert.equal(p.sh, 2250); assert.equal(p.sy, 875);
  // Zoom 2 centred far right stays inside the image.
  const z = cropRect({ iw: 4000, ih: 3000, ratio: 4 / 3, zoom: 2, cx: 1, cy: 0.5 });
  assert.deepEqual(z, { sx: 2000, sy: 750, sw: 2000, sh: 1500 });
  // A flute frame (3:1) on a 4:3 photo.
  const f = cropRect({ iw: 4000, ih: 3000, ratio: 3 });
  assert.ok(Math.abs(f.sh - 4000 / 3) < 1e-9 && f.sw === 4000);
});

test('changing the hole count one step at a time keeps one hole per finger', async () => {
  const { withHoleCount, duplicateFingers, withSubLayout } = await import('../js/builder.js');
  let oc = { family: 'ocarina', kind: 'custom', holeCount: 5, setup: { holes: defaultCustomHoles(5), f0: null, singles: [] } };
  for (let n = 6; n <= 12; n++) oc = withHoleCount(oc, n);
  assert.deepEqual(oc.setup.holes.map(h => h.finger + (h.sub ? 's' : '')), defaultCustomHoles(12).map(h => h.finger + (h.sub ? 's' : '')));
  assert.deepEqual(duplicateFingers(oc.setup.holes), []);
  // Fingers the owner set are kept; added holes get unused fingers.
  const mine = { family: 'ocarina', kind: 'custom', holeCount: 3,
    setup: { holes: [{ finger: 'L1', side: 'top' }, { finger: 'L2', side: 'top' }, { finger: 'R1', side: 'top' }], f0: null, singles: [] } };
  const five = withHoleCount(mine, 5).setup.holes.map(h => h.finger);
  assert.deepEqual(five.slice(0, 3), ['L1', 'L2', 'R1']);
  assert.deepEqual(duplicateFingers(withHoleCount(mine, 5).setup.holes), []);
  assert.deepEqual(duplicateFingers([{ finger: 'L1' }, { finger: 'L1' }, { finger: 'L2', sub: true }, { finger: 'L2' }]), ['L1']);
  // Japanese sub-holes: beside R2 and R1.
  const jp = withSubLayout(defaultCustomHoles(12), 'japanese').filter(h => h.sub).map(h => h.finger);
  assert.deepEqual(jp, ['R2', 'R1']);
});

test('leather plan: the test hole is never a sub-hole', async () => {
  const { buildChamber } = await import('../js/ocarina.js');
  const ch = buildChamber([57, 59, 60, 62, 64, 65, 67], { subs: 2 });
  const plan = leatherHolePlan(ch, { f0: 196, d: 6, f1: 215 }, 0.11);
  assert.ok(plan.holes[0].sub && plan.holes[1].sub);
  assert.ok(plan.testHoleIndex === -1 || !plan.holes[plan.testHoleIndex].sub);
});
