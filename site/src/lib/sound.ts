// Sound for the website, from the app's own engine (../js/audio.js): the same
// handpan voice, and the same chord as the app plays it (each note in turn,
// then all together), with the sounding notes lit on the drawing as in the
// app (js/pan.js updatePanPlaying, styled by css/pan-drawing.css).
// Only call these from a tap: browsers start audio only after one.
import { playChord, playNote, setVoice } from "@engine/audio.js";
import { updatePanPlaying } from "@engine/pan.js";

type Drawing = () => SVGSVGElement | null | undefined;

/** Plays a chord on the handpan and lights each note as it sounds. */
export function playPanChord(notes: string[], drawing: Drawing): void {
  setVoice("handpan");
  playChord(
    notes,
    (note: string) => light([note], drawing),
    (all: string[]) => light(all, drawing),
  );
}

/** Plays one note on the handpan and lights it. */
export function playPanNote(note: string, drawing: Drawing): void {
  setVoice("handpan");
  playNote(note);
  light([note], drawing);
}

function light(notes: string[], drawing: Drawing) {
  const svg = drawing();
  if (svg) updatePanPlaying(notes, svg);
}
