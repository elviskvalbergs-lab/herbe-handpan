"use client";

import { useEffect, useRef, useState } from "react";
import { midiNoteName, windFingering, type Tuning, type WindChord } from "@/lib/engine";
import { playWindChord, playWindNote } from "@/lib/sound";

// The playable demo of an ocarina or flute, as HandpanDemo is for a handpan:
// the app's own fingering diagram (js/ocarina-ui.js renderFingering) and chord
// buttons. These instruments play one note at a time, so a chord plays as an
// arpeggio, as in the app, and the big diagram shows each note's fingering in
// turn; the small ones below are the chord's notes in playing order (tap one
// to hear it).
export function WindDemo({ tuning, chords, voice, caption, initial = 0 }: {
  tuning: Tuning; chords: WindChord[]; voice: string; caption?: string; initial?: number;
}) {
  const [index, setIndex] = useState(Math.min(initial, Math.max(0, chords.length - 1)));
  const [step, setStep] = useState(0);
  const run = useRef(0);
  const chord = chords[index];
  const midi = chord?.arpeggio[step] ?? chord?.arpeggio[0];
  useEffect(() => () => { run.current++; }, []);

  const pick = (i: number) => {
    const c = chords[i];
    if (!c) return;
    const me = ++run.current;
    setIndex(i);
    setStep(0);
    playWindChord(c.arpeggio.map(midiNoteName), voice, (k) => { if (run.current === me) setStep(k); });
  };
  const tap = (k: number) => {
    if (!chord) return;
    run.current++;
    setStep(k);
    playWindNote(midiNoteName(chord.arpeggio[k]), voice);
  };

  if (!chord) return null;
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="w-full max-w-[300px]" aria-hidden="true" dangerouslySetInnerHTML={{ __html: windFingering(tuning, midi, "large") }} />
      <div role="group" aria-label="Notes of the chord, in playing order" className="flex justify-center gap-3">
        {chord.arpeggio.map((m, k) => (
          <button
            key={m}
            type="button"
            aria-pressed={k === step}
            aria-label={`Play ${midiNoteName(m)}`}
            onClick={() => tap(k)}
            className={`w-[76px] cursor-pointer rounded-tile border bg-surface p-1.5 transition-colors ${k === step ? "border-primary" : "border-border hover:border-border-strong"}`}
            dangerouslySetInnerHTML={{ __html: windFingering(tuning, m, "mini") }}
          />
        ))}
      </div>
      {caption ? <p className="m-0 text-center text-[15px] text-muted">{caption}</p> : null}
      <div role="group" aria-label="Chords" className="flex flex-wrap justify-center gap-2">
        {chords.map((c, i) => {
          const on = i === index;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              aria-label={`Play ${c.name}: ${c.pitches.join(" ")}`}
              onClick={() => pick(i)}
              className={`min-h-11 min-w-[52px] cursor-pointer rounded-pill border px-4 text-[16px] font-semibold transition-colors ${on ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text hover:border-text"}`}
            >
              {c.short}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="m-0 text-[15px] text-muted">{chord.name}: {chord.pitches.join(" · ")}, one note at a time</p>
    </div>
  );
}
