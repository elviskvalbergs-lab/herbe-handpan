"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const field = "min-h-13 rounded-tile border border-border-strong bg-surface px-4 text-[17px] text-text";

export function RequestForm() {
  const params = useSearchParams();
  const [kind, setKind] = useState<"instrument" | "feature">(params.get("kind") === "feature" ? "feature" : "instrument");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, kind }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); setState("idle"); return; }
      setState("sent");
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-card bg-surface p-9 shadow-[inset_0_0_0_1px_var(--border)]">
        <h2 className="m-0 mb-2.5 text-[30px] font-semibold">Request sent</h2>
        <p className="m-0 mb-6 text-body">Thank you. If you left your email, we’ll write when it’s ready.</p>
        <button type="button" className={btnSecondary} onClick={() => setState("idle")}>Send another request</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div role="group" aria-label="What are you asking for?" className="inline-flex w-fit rounded-pill bg-band p-1">
        {(["instrument", "feature"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
            className={`min-h-11 cursor-pointer rounded-pill border-0 px-5 text-[16px] font-semibold ${kind === k ? "bg-primary text-on-primary" : "bg-transparent text-text"}`}>
            {k === "instrument" ? "An instrument or tuning" : "A feature"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-title" className="font-semibold">{kind === "instrument" ? "Instrument" : "Feature"}</label>
        <input id="r-title" name="title" required maxLength={120} defaultValue={kind === "instrument" ? params.get("instrument") ?? "" : ""}
          placeholder={kind === "instrument" ? "For example: 17-key kalimba" : "For example: a metronome while I play"} className={field} />
      </div>
      {kind === "instrument" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Its notes or tuning <span className="font-normal text-muted">(if you know them)</span></label>
          <input id="r-notes" name="notes" maxLength={200} placeholder="For example: C4 D4 E4 F4 G4 A4 B4 C5" className={field} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-details" className="font-semibold">What would help you most?</label>
        <textarea id="r-details" name="details" rows={4} maxLength={2000} placeholder="A sentence or two is plenty" className={`${field} resize-y py-3.5`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-email" className="font-semibold">Email <span className="font-normal text-muted">(optional, to hear when it’s ready)</span></label>
        <input id="r-email" name="email" type="email" maxLength={200} autoComplete="email" placeholder="you@example.com" className={field} />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="r-website">Leave this empty</label>
        <input id="r-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? <p role="alert" className="m-0 font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "sending"} className={`${btnPrimary} cursor-pointer border-0 disabled:opacity-60`}>
          {state === "sending" ? "Sending…" : "Send request"}
        </button>
        <p className="m-0 text-[15px] text-muted">We only use your email for this request. <Link href="/privacy">Privacy</Link></p>
      </div>
    </form>
  );
}
