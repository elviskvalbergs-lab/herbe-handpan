"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { panSvg, type Chord, type PanFamily } from "@/lib/engine";
import { playPanChord, playPanNote } from "@/lib/sound";
import { btnCta, btnPrimary } from "@/lib/ui";

// The app's own drawing of a handpan or tongue drum (js/pan.js renderPan) with a chord lit. Tapping a
// chord re-draws it with that chord's notes, coloured root, third, fifth… and
// plays it as the app does: each note in turn, then all together, with the
// sounding note lit. Tapping a note on the drawing plays that note.
export function HandpanDemo({
  slug, chords, caption, tone = "light", initial = 0, family = "handpan", appPath,
}: { slug: string; chords: Chord[]; caption?: string; tone?: "light" | "dark"; initial?: number; family?: PanFamily; appPath?: string }) {
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, chords.length - 1)));
  const drawingRef = useRef<HTMLDivElement>(null);
  const chord = chords[index];
  const dark = tone === "dark";
  const drawing = () => drawingRef.current?.querySelector("svg");

  const pick = (i: number) => {
    setIndex(i);
    if (chords[i]) playPanChord(chords[i].notes, drawing, family);
  };
  const tapNote = (e: MouseEvent<HTMLDivElement>) => {
    const note = (e.target as Element).closest<SVGGElement>(".pan-note")?.dataset.note;
    if (note) playPanNote(note, drawing, family);
  };
  // The picture's notes are buttons (role, tabindex and a label from js/pan.js): Enter or Space plays one.
  const keyNote = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const note = (e.target as Element).closest<SVGGElement>(".pan-note")?.dataset.note;
    if (!note) return;
    e.preventDefault();
    playPanNote(note, drawing, family);
  };
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        ref={drawingRef}
        onClick={tapNote}
        onKeyDown={keyNote}
        className="pan-drawing w-full max-w-[440px] [&_.pan-note[data-note]]:cursor-pointer"
        dangerouslySetInnerHTML={{ __html: panSvg(slug, chord?.notes ?? [], family) }}
      />
      {caption ? <p className={`m-0 text-center text-[15px] ${dark ? "text-on-dark-muted" : "text-muted"}`}>{caption}</p> : null}
      <div role="group" aria-label="Chords" className="flex flex-wrap justify-center gap-2">
        {chords.map((c, i) => {
          const on = i === index;
          const tones = dark
            ? on ? "border-on-dark bg-on-dark text-dark" : "border-dark-line text-on-dark hover:border-on-dark"
            : on ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text hover:border-text";
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              aria-label={`Play ${c.name}: ${c.pitches.join(" ")}`}
              onClick={() => pick(i)}
              className={`min-h-11 min-w-[52px] cursor-pointer rounded-pill border px-4 text-[16px] font-semibold transition-colors ${tones}`}
            >
              {c.short}
            </button>
          );
        })}
      </div>
      {chord ? (
        <p aria-live="polite" className={`m-0 text-[15px] ${dark ? "text-on-dark-muted" : "text-muted"}`}>
          {chord.name}: {chord.pitches.join(" · ")}
        </p>
      ) : null}
      {/* Straight on to the app, on this tuning with the chord just played. */}
      {appPath && chord ? (
        <a href={`${appPath}/chords/${chord.id}`} className={dark ? btnCta : btnPrimary}>Play {chord.short} in the app</a>
      ) : null}
    </div>
  );
}
