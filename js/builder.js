// Builder logic: the seven stages of making a clay ocarina, clay bodies with
// learned shrinkage, and calibrating a bought ocarina from tuner readings.
// See docs/ocarina-mode.md, "Builder" and "Calibrated charts".
//
// Pure functions only (no DOM, no storage), unit tested in Node. The screens
// are in app.js; the clay body list is stored by instruments.js.

import {
  midiToHz, hzToMidi, centsBetween, holeSizes, splitHole, applyHoleSizes, defaultWindow, chamberVolume,
  learnedShrinkage, solveHoleRatios, calibratedChart, fingersForHoleCount, OC_FINGER_ORDER,
} from './ocarina.js';

export const STAGE_ORDER = ['design', 'body', 'leather', 'boneDry', 'bisque', 'final', 'done'];
export const STAGE_TITLES = {
  design: 'Design', body: 'Body', leather: 'Voice and drill (leather-hard)',
  boneDry: 'Bone-dry check', bisque: 'Bisque check', final: 'Final check', done: 'Done',
};

export const DEFAULT_CLAY_BODIES = [
  { id: 'generic', name: 'Generic clay (11%)', shrinkPct: 11, builds: 0 },
];

// Shrinkage fraction for a build (from its clay body), e.g. 0.11.
export function buildShrink(inst) {
  return (inst.build?.shrinkPct ?? 11) / 100;
}

// Per-chamber build record, created on demand.
export function chamberBuild(inst, ci) {
  const per = inst.build.perChamber[ci] ?? {};
  return {
    window: per.window ?? defaultWindow(midiToHz(inst.chambers[ci].notes[0], inst.build.a4 ?? 440)),
    readings: per.readings ?? {},
    holesDone: per.holesDone ?? [],
    testHoleMm: per.testHoleMm ?? 6,
  };
}

// Target frequency of every note of a chamber at a stage. Leather-hard
// targets are lowered for shrinkage (f × (1 − s)); bone-dry is compared
// with the leather-hard readings; bisque and final use concert pitch.
export function stageTargets(chamber, stage, shrink, a4 = 440) {
  const out = {};
  for (const m of chamber.notes) {
    const concert = midiToHz(m, a4);
    out[m] = stage === 'leather' ? concert * (1 - shrink) : concert;
  }
  return out;
}

// What to do about a note measured at a stage. Returns { cents, status, text }
// with status 'ok' | 'flat' | 'sharp'. In tune means within ±10 cents.
export function noteAdvice(stage, measuredHz, targetHz) {
  const cents = Math.round(centsBetween(measuredHz, targetHz));
  if (Math.abs(cents) <= 10) return { cents, status: 'ok', text: 'in tune' };
  const flat = cents < 0;
  const amount = `${Math.abs(cents)} cents ${flat ? 'flat' : 'sharp'}`;
  if (stage === 'leather') {
    return { cents, status: flat ? 'flat' : 'sharp', text: flat ? `${amount}: open it slightly` : `${amount}: make the hole a little smaller with clay` };
  }
  if (stage === 'boneDry') {
    return { cents, status: flat ? 'flat' : 'sharp', text: flat ? `${amount}: file this hole carefully` : `${amount}: leave it, it can't be lowered now` };
  }
  return { cents, status: flat ? 'flat' : 'sharp', text: flat ? `${amount}: file this hole a little larger` : `${amount}: can't be lowered by filing` };
}

// Hole diameters at leather-hard from the tuner readings, in drilling order
// (the opening order). Returns null until f0, d and f1 are all recorded.
// Each hole: { index, finger, mm, parts } where parts is [mm] or two halves
// or several equal ones for a hole over 12 mm; testHoleIndex is the hole the test hole becomes.
export function leatherHolePlan(chamber, reading, shrink, a4 = 440) {
  if (!(reading?.f0 > 0 && reading?.d > 0 && reading?.f1 > reading?.f0)) return null;
  const targets = stageTargets(chamber, 'leather', shrink, a4);
  const { W, holes, testHoleIndex } = holeSizes({
    f0: reading.f0, d: reading.d, f1: reading.f1,
    targets: chamber.notes.slice(1).map(m => targets[m]),
  });
  return {
    W,
    testHoleIndex,
    holes: holes.map((mm, i) => ({
      index: i, finger: chamber.holes[i].finger, mm,
      parts: splitHole(mm),
    })),
  };
}

// Inside volume and ball size for each chamber's window (leather-hard target).
export function bodyPlan(inst) {
  const shrink = buildShrink(inst);
  return inst.chambers.map((ch, ci) => {
    const win = chamberBuild(inst, ci).window;
    return { window: win, ...chamberVolume(win, midiToHz(ch.notes[0], inst.build.a4 ?? 440), shrink) };
  });
}

export function nextStage(stage, { unglazed = false } = {}) {
  const i = STAGE_ORDER.indexOf(stage);
  const next = STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
  return next === 'final' && unglazed ? 'done' : next;
}

// Finishes a build: stores the drilled hole sizes on the chambers, the
// measured pitches, and the shrinkage learned from leather-hard vs final
// (or bisque, if unglazed) readings. Returns { inst, learned } where learned
// is the shrinkage fraction (null if no note was measured at both stages).
export function finishBuild(inst) {
  const shrink = buildShrink(inst);
  const a4 = inst.build.a4 ?? 440;
  const leatherAll = {}, finalAll = {};
  const chambers = inst.chambers.map((ch, ci) => {
    const b = chamberBuild(inst, ci);
    const lr = b.readings.leather ?? {};
    Object.assign(leatherAll, lr.notes ?? {});
    Object.assign(finalAll, (b.readings.final ?? b.readings.bisque ?? {}).notes ?? {});
    const plan = leatherHolePlan(ch, { ...lr, d: lr.d ?? b.testHoleMm }, shrink, a4);
    return plan ? applyHoleSizes(ch, plan.holes.map(h => h.mm)) : ch;
  });
  const learned = learnedShrinkage(leatherAll, finalAll);
  return {
    inst: {
      ...inst,
      chambers,
      measured: finalAll,
      build: { ...inst.build, stage: 'done', learnedShrink: learned },
    },
    learned,
  };
}

// Folds a new learned shrinkage into a clay body: the average over the
// builds made with it so far.
export function updateClayBody(body, learned) {
  if (learned == null) return body;
  const n = body.builds ?? 0;
  const pct = ((body.shrinkPct * n) + learned * 100) / (n + 1);
  return { ...body, shrinkPct: Math.round(pct * 10) / 10, builds: n + 1 };
}

// ── Bought ocarinas: calibration ─────────────────────────────────────────────

// Default finger for each hole of an ocarina with `count` holes: the
// standard opening order, thumbs underneath above 8 holes; holes beyond 10
// are sub-holes (on a 12-hole ocarina, small holes next to a finger hole):
// beside the right then the left middle finger, as on the STL 12-hole
// chart in charts.js. The user checks and changes these.
export function defaultCustomHoles(count) {
  const main = fingersForHoleCount(Math.min(count, OC_FINGER_ORDER.length));
  const holes = main.map(f => ({ id: f, finger: f, side: f.endsWith('T') ? 'bottom' : 'top' }));
  const subFingers = ['R2', 'L2'];
  for (let i = 0; holes.length < count; i++) {
    const f = subFingers[i % subFingers.length];
    holes.push({ id: f + 's' + (i + 1), finger: f, side: 'top', sub: true });
  }
  return holes;
}

// A playable chamber from calibration readings: f0 with every hole closed,
// singles[i] with only hole i open. Returns { notes, holes, fingerings,
// calibration } or null until every reading is in.
// extra: further readings the owner took of other fingerings ([{ states,
// hz }], from changing a fingering by hand); they refine the fit and, like
// the set-up readings, win the note they land on.
export function calibrateChamber(holes, f0, singles, { a4 = 440, toleranceCents = 20, extra = [] } = {}) {
  if (!(f0 > 0) || singles.length !== holes.length || !singles.every(hz => hz > f0)) return null;
  const measurements = [
    ...singles.map((hz, i) => ({ states: holes.map((_, j) => (j === i ? 'o' : 'c')), hz })),
    ...extra.filter(x => x?.hz > 0 && x.states?.length === holes.length),
  ];
  const ratios = solveHoleRatios(f0, measurements);
  const chart = calibratedChart(f0, ratios, { a4, toleranceCents });
  const max = Math.max(...ratios);
  // A note blown during set-up is a measurement, not a prediction: when a
  // reading lands on a note, its fingering (all closed, or that one hole
  // open) is the one shown for that note.
  const measured = [{ states: holes.map(() => 'c'), hz: f0 }, ...measurements];
  for (const { states, hz } of measured) {
    const midi = Math.round(hzToMidi(hz, a4));
    const cents = centsBetween(hz, midiToHz(midi, a4));
    if (Math.abs(cents) > Math.max(toleranceCents, 30)) continue;
    const prev = chart[midi];
    if (prev?.measured && Math.abs(prev.cents) <= Math.abs(cents)) continue;
    chart[midi] = { states, hz, cents, measured: true };
  }
  const notes = Object.keys(chart).map(Number).sort((a, b) => a - b);
  const fingerings = {};
  for (const m of notes) fingerings[m] = chart[m].states;
  return {
    notes,
    holes: holes.map((h, i) => ({ ...h, rel: ratios[i] / max })),
    fingerings,
    calibration: { f0, singles, ratios, cents: Object.fromEntries(notes.map(m => [m, Math.round(chart[m].cents)])) },
  };
}

// ── Other flutes: recording their notes ──────────────────────────────────────

// Fingers of a flute with `count` holes (3–8), from the mouthpiece down. Six
// holes are the usual L1 L2 L3 R1 R2 R3. Fewer holes drop fingers from the
// top of the left hand (5: L2 L3 R1 R2 R3 … 3: R1 R2 R3). Seven add the right
// little finger at the bottom (R4); eight also the left little finger (L4,
// after L3). The fingers are only labels: the chart comes from the readings.
export function fluteHoles(count) {
  const n = Math.max(3, Math.min(8, count));
  const six = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];
  const fingers = n <= 6 ? six.slice(6 - n)
    : n === 7 ? [...six, 'R4'] : ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
  return fingers.map(f => ({ id: f, finger: f, side: 'top' }));
}

// Hole states for recorded step k of a flute with n holes: step 0 all
// closed, step k the k lowest holes open (holes listed from the mouthpiece
// down, so the last k).
export function fluteStepStates(n, k) {
  return Array.from({ length: n }, (_, i) => (i >= n - k ? 'o' : 'c'));
}

// A playable chamber from a flute's recorded notes: readings[0] with every
// hole closed, readings[k] with the k lowest holes open. Each reading is
// rounded to the nearest note; its cents off that note are kept for display.
// When two readings round to the same note the first one is kept and the
// later one listed in `dropped`. Returns null until every reading is in.
export function fluteChamberFromReadings(holes, readings, { a4 = 440 } = {}) {
  const n = holes.length;
  if (readings.length !== n + 1 || !readings.every(hz => hz > 0)) return null;
  const fingerings = {};
  const cents = {};
  const dropped = [];
  readings.forEach((hz, k) => {
    const exact = hzToMidi(hz, a4);
    const midi = Math.round(exact);
    if (fingerings[midi]) { dropped.push({ step: k, midi, keptStep: cents[midi].step }); return; }
    fingerings[midi] = fluteStepStates(n, k);
    cents[midi] = { step: k, cents: Math.round((exact - midi) * 100) };
  });
  const notes = Object.keys(fingerings).map(Number).sort((a, b) => a - b);
  return {
    notes,
    holes: holes.map(h => ({ ...h })),
    fingerings,
    calibration: {
      readings: [...readings],
      cents: Object.fromEntries(notes.map(m => [m, cents[m].cents])),
      dropped,
    },
  };
}

// ── Editing a bought instrument ──────────────────────────────────────────────

// A custom (bought) ocarina or flute with a different number of holes, as a
// new object. An ocarina keeps the fingers and the single-hole readings of
// the holes it still has and the spots marked on its photo; a flute's
// readings depend on the count, so they start again. Either way the chart
// is cleared: it came from readings that no longer match.
export function withHoleCount(inst, count) {
  const flute = inst.family === 'flute';
  const n = flute ? Math.max(3, Math.min(8, count)) : Math.max(1, Math.min(13, count));
  if (n === inst.holeCount) return inst;
  const out = { ...inst, holeCount: n, chambers: [], calibration: null };
  if (flute) {
    out.setup = { holes: fluteHoles(n), readings: [] };
  } else {
    const old = inst.setup ?? { holes: defaultCustomHoles(inst.holeCount), f0: null, singles: [] };
    const holes = defaultCustomHoles(n).map((h, i) => (old.holes[i] ? { ...old.holes[i] } : h));
    out.setup = { holes, f0: old.f0 ?? null, singles: (old.singles ?? []).slice(0, n) };
    if (inst.holeMap) out.holeMap = Array.from({ length: n }, (_, i) => inst.holeMap[i] ?? null);
  }
  return out;
}

// Where hole i sits on the instrument's photo: { x, y } as fractions of the
// photo's width and height, or null when it isn't marked or is underneath
// (thumb holes can't be seen from the top).
export function holeSpot(inst, i) {
  const s = inst.holeMap?.[i];
  const hole = inst.setup?.holes?.[i] ?? inst.chambers?.[0]?.holes?.[i];
  if (!s || hole?.side === 'bottom') return null;
  return s;
}

// Whether the fingering diagrams draw this ocarina from its own photo: a
// bought, single-chamber ocarina with every top hole marked.
export function usesHoleMap(inst) {
  if (inst.family !== 'ocarina' || inst.kind !== 'custom' || !inst.holeMap) return false;
  const holes = inst.setup?.holes ?? [];
  return holes.length > 0 && holes.every((h, i) => h.side === 'bottom' || inst.holeMap[i]);
}

// Fingerings the owner set by hand ({ midi: states }) on top of a worked-out
// chart: they replace the predicted ones and add notes the chart missed.
export function withFixedFingerings(chamber, fixed) {
  if (!fixed || !Object.keys(fixed).length) return chamber;
  const fingerings = { ...chamber.fingerings };
  for (const [m, states] of Object.entries(fixed)) {
    if (Array.isArray(states) && states.length === chamber.holes.length) fingerings[m] = states;
  }
  const notes = Object.keys(fingerings).map(Number).sort((a, b) => a - b);
  return { ...chamber, notes, fingerings };
}

// The holes with one hand's fingers in the opposite order (R1 ↔ R4,
// R2 ↔ R3, or the same for L): for when they were set up the wrong way
// round. Thumbs and sub-hole flags stay; returns new hole objects.
export function reverseHandFingers(holes, hand) {
  const swap = { 1: 4, 2: 3, 3: 2, 4: 1 };
  return holes.map(h => {
    const m = new RegExp(`^${hand}([1-4])$`).exec(h.finger);
    return m ? { ...h, finger: `${hand}${swap[m[1]]}` } : { ...h };
  });
}
