"use client";

import type { Chord } from "@/lib/engine";

// The row of chord buttons under every playable demo (HandpanDemo, WindDemo):
// one look, one behaviour, on cream or on ink. A real button each, so it is
// the keyboard and screen-reader way to play the demo.
export function ChordButtons({ chords, index, onPick, tone = "light" }: {
  chords: Chord[]; index: number; onPick: (i: number) => void; tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
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
            onClick={() => onPick(i)}
            className={`min-h-11 min-w-[52px] cursor-pointer rounded-pill border px-4 text-[16px] font-semibold transition-colors ${tones}`}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}
