"use client";

import { useState } from "react";
import { panSvg, type Chord } from "@/lib/engine";

// The app's own pan drawing (js/pan.js renderPan) with a chord lit. Tapping a
// chord re-draws it with that chord's notes, coloured root, third, fifth… as
// in the app.
export function HandpanDemo({
  slug, chords, caption, tone = "light", initial = 0,
}: { slug: string; chords: Chord[]; caption?: string; tone?: "light" | "dark"; initial?: number }) {
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, chords.length - 1)));
  const chord = chords[index];
  const dark = tone === "dark";
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className="pan-drawing w-full max-w-[440px]"
        dangerouslySetInnerHTML={{ __html: panSvg(slug, chord?.notes ?? []) }}
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
              aria-label={`${c.name}: ${c.pitches.join(" ")}`}
              onClick={() => setIndex(i)}
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
    </div>
  );
}
