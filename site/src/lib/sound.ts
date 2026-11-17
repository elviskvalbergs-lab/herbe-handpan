// Sound for the website, from the app's own engine (../js/audio.js): the same
// handpan and tongue drum voices, and the same chord as the app plays it (each note in turn,
// then all together), with the sounding notes lit on the drawing as in the
// app (js/pan.js updatePanPlaying, styled by css/pan-drawing.css).
// Only call these from a tap: browsers start audio only after one.
import { playChord, playNote, setVoice } from "@engine/audio.js";
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
