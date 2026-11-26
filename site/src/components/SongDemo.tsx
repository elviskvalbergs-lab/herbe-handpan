"use client";

import { useEffect, useRef, useState } from "react";
import { isPanFamily, panSvg, windFingering, type Tuning } from "@/lib/engine";
import { noteLabel, type SongNote } from "@/lib/songs";
import { playPanNote, playWindNote } from "@/lib/sound";
import { btnPrimary } from "@/lib/ui";

// A song on one instrument, playable: the app's own picture of the instrument
// (the pan drawing, or the fingering of the current note) and the app's own
// sound, each note for its length at 100 beats a minute, as the app's song
// player does at normal speed. The notes below are the song in bars; tapping
// one plays it. A note the instrument lacks is crossed out and never lit.
const BEAT_MS = 600;

export function SongDemo({ tuning, notes, bars, voice, caption }: {
  tuning: Tuning; notes: SongNote[]; bars: number[][]; voice: string; caption?: string;
}) {
  const pan = isPanFamily(tuning.family) ? tuning.family : null;
  const first = Math.max(0, notes.findIndex((n) => n.note != null));
  const [index, setIndex] = useState(first);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const drawing = () => drawingRef.current?.querySelector("svg");
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setPlaying(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const sound = (i: number) => {
    const n = notes[i];
    if (!n?.note) return;
    if (pan) {
      // A missing note is still heard, so the tune is whole; nothing lights for it.
      if (n.missing) playPanNote(n.note, () => null, pan); else playPanNote(n.note, drawing, pan);
    } else playWindNote(n.note, voice);
  };
  const step = (i: number) => {
    setIndex(i);
    sound(i);
    timer.current = setTimeout(() => {
      if (i >= notes.length - 1) { stop(); return; }
      step(i + 1);
    }, notes[i].beats * BEAT_MS);
  };
  const toggle = () => {
    if (playing) { stop(); return; }
    setPlaying(true);
    step(index >= notes.length - 1 ? first : index);
  };
  const tap = (i: number) => { stop(); setIndex(i); sound(i); };
  const cur = notes[index];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {pan ? (
        <div ref={drawingRef} className="pan-drawing w-full max-w-[440px]" dangerouslySetInnerHTML={{ __html: panSvg(tuning.slug, [], pan) }} />
      ) : (
        <div className="flex min-h-[220px] w-full max-w-[300px] items-center justify-center" aria-hidden="true">
          {cur?.midi != null && !cur.missing
            ? <div className="w-full" dangerouslySetInnerHTML={{ __html: windFingering(tuning, cur.midi, "large") }} />
            : <p className="m-0 text-muted">{cur?.missing ? "Not on this instrument" : "Rest"}</p>}
        </div>
      )}
      {caption ? <p className="m-0 text-center text-[15px] text-muted">{caption}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={toggle} className={`${btnPrimary} cursor-pointer border-0`}>{playing ? "Stop" : index > first && index < notes.length - 1 ? "Play on" : "Play"}</button>
        <p aria-live="polite" className="tabular m-0 text-[15px] text-muted">
          {cur?.note ? noteLabel(cur.note) : "Rest"} · {index + 1} of {notes.length}
        </p>
      </div>
      <ol aria-label="The song, bar by bar" className="m-0 flex w-full list-none flex-wrap gap-x-4 gap-y-3 p-0">
        {bars.map((bar, b) => (
          <li key={b} className="flex gap-1 border-l border-border-strong pl-2">
            {bar.map((i) => {
              const n = notes[i];
              if (!n.note) return <span key={i} className="inline-flex min-h-9 min-w-6 items-center justify-center text-muted" aria-label="Rest">·</span>;
              const on = i === index;
              return (
                <button
                  key={i}
                  type="button"
                  aria-current={on ? "true" : undefined}
                  aria-label={n.missing ? `${noteLabel(n.note)}, not on this instrument` : `Play ${noteLabel(n.note)}`}
                  onClick={() => tap(i)}
                  className={`tabular min-h-9 min-w-9 cursor-pointer rounded-tile border px-1.5 text-[14px] font-semibold transition-colors ${on ? "border-primary bg-primary text-on-primary" : n.missing ? "border-soon bg-soon-soft text-soon line-through" : "border-border bg-surface text-text hover:border-border-strong"}`}
                >
                  {noteLabel(n.note)}
                </button>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}
