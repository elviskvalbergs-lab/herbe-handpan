"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { track } from "@/lib/analytics";
import { layoutPicture, panSvg, type Chord, type PanFamily } from "@/lib/engine";
import { playPanChord, playPanNote } from "@/lib/sound";
import { btnCta, btnPrimary } from "@/lib/ui";
import { ChordButtons } from "./ChordButtons";

// The app's own drawing of a handpan, tongue drum or kalimba (js/pan.js renderPan) with a chord lit. Tapping a
// chord re-draws it with that chord's notes, coloured root, third, fifth… and
// plays it as the app does: each note in turn, then all together, with the
// sounding note lit. Tapping a note on the drawing plays that note.
// A maker's own instrument (not one of the catalogue's scales) is drawn from
// its saved notes instead: pass `layout` and its name as `slug`.
export function HandpanDemo({
  slug, chords, caption, tone = "light", initial = 0, family = "handpan", appPath, layout, cta,
}: {
  slug: string; chords: Chord[]; caption?: string; tone?: "light" | "dark"; initial?: number; family?: PanFamily; appPath?: string;
  /** The saved notes of a maker's instrument; `slug` is then its name. */
  layout?: unknown;
  /** The button under the demo, instead of "Play … in the app": { href, label, newTab }. */
  cta?: { href: string; label: string; newTab?: boolean };
}) {
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, chords.length - 1)));
  const drawingRef = useRef<HTMLDivElement>(null);
  const chord = chords[index];
  const dark = tone === "dark";
  const drawing = () => drawingRef.current?.querySelector("svg");

  const pick = (i: number) => {
    setIndex(i);
    if (!chords[i]) return;
    playPanChord(chords[i].notes, drawing, family);
    track("demo_chord_played", { family, tuning: slug, chord: chords[i].id });
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
    <div data-loc="demo" className="flex w-full flex-col items-center gap-5">
      <div
        ref={drawingRef}
        onClick={tapNote}
        onKeyDown={keyNote}
        className="pan-drawing w-full max-w-[440px] [&_.pan-note[data-note]]:cursor-pointer"
        dangerouslySetInnerHTML={{ __html: layout ? layoutPicture(layout, family, slug, chord?.notes ?? []) ?? "" : panSvg(slug, chord?.notes ?? [], family) }}
      />
      {caption ? <p className={`m-0 text-center text-[15px] ${dark ? "text-on-dark-muted" : "text-muted"}`}>{caption}</p> : null}
      <ChordButtons chords={chords} index={index} onPick={pick} tone={tone} />
      {chord ? (
        <p aria-live="polite" className={`m-0 text-[15px] ${dark ? "text-on-dark-muted" : "text-muted"}`}>
          {chord.name}: {chord.pitches.join(" · ")}
        </p>
      ) : null}
      {/* Straight on to the app, on this tuning with the chord just played. */}
      {cta ? (
        <a href={cta.href} {...(cta.newTab ? { target: "_blank", rel: "noopener" } : {})} className={dark ? btnCta : btnPrimary}>{cta.label}</a>
      ) : appPath && chord ? (
        <a href={`${appPath}/chords/${chord.id}`} className={dark ? btnCta : btnPrimary}>Play {chord.short} in the app</a>
      ) : null}
    </div>
  );
}
