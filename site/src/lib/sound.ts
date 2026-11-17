// Sound for the website, from the app's own engine (../js/audio.js): the same
// handpan and tongue drum voices, and the same chord as the app plays it (each note in turn,
// then all together), with the sounding notes lit on the drawing as in the
// app (js/pan.js updatePanPlaying, styled by css/pan-drawing.css).
// Only call these from a tap: browsers start audio only after one.
import { playChord, playNote, playSequence, setVoice } from "@engine/audio.js";
import { updatePanPlaying } from "@engine/pan.js";

type Drawing = () => SVGSVGElement | null | undefined;

/** Plays a chord on a handpan or tongue drum (its own voice) and lights each note as it sounds. */
export function playPanChord(notes: string[], drawing: Drawing, voice: string = "handpan"): void {
  setVoice(voice);
  playChord(
    notes,
    (note: string) => light([note], drawing),
    (all: string[]) => light(all, drawing),
  );
}

/** Plays one note on a handpan or tongue drum and lights it. */
export function playPanNote(note: string, drawing: Drawing, voice: string = "handpan"): void {
  setVoice(voice);
  playNote(note);
  light([note], drawing);
}

function light(notes: string[], drawing: Drawing) {
  const svg = drawing();
  if (svg) updatePanPlaying(notes, svg);
}

/**
 * An ocarina or flute chord: one note at a time (an arpeggio, as in the app),
 * calling onNote with each note's place as it sounds, so the demo can show
 * that note's fingering.
 */
export function playWindChord(notes: string[], voice: string, onNote: (i: number) => void): void {
  setVoice(voice);
  playSequence(notes, (_n: string, i: number) => onNote(i), 0.55);
}

/** One ocarina or flute note. */
export function playWindNote(note: string, voice: string): void {
  setVoice(voice);
  playNote(note);
}
