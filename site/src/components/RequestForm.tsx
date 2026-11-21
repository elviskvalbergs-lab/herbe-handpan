"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { APP_URL } from "@/lib/site";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const field = "min-h-13 rounded-tile border border-border-strong bg-surface px-4 text-[17px] text-text";

type Kind = "instrument" | "feature" | "feedback" | "maker";
const KIND_LABELS: Record<Kind, string> = { instrument: "An instrument or tuning", feature: "A feature", feedback: "Feedback", maker: "Maker or shop" };

export function RequestForm() {
  const params = useSearchParams();
  const asked = params.get("kind");
  const [kind, setKind] = useState<Kind>(asked === "feature" || asked === "feedback" || asked === "maker" ? asked : "instrument");
  const feedback = kind === "feedback";
  const maker = kind === "maker";
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
        <h2 className="m-0 mb-2.5 text-[30px] font-semibold">{feedback ? "Feedback sent" : maker ? "Message sent" : "Request sent"}</h2>
        <p className="m-0 mb-6 text-body">{maker ? "Thank you. We’ll write back within a couple of days." : feedback ? "Thank you, every message is read. If you left your email, we’ll tell you when it’s fixed." : "Thank you. If you left your email, we’ll write when it’s ready."}</p>
        <button type="button" className={btnSecondary} onClick={() => setState("idle")}>{feedback ? "Send more feedback" : "Send another request"}</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div role="group" aria-label="What are you asking for?" className="inline-flex w-fit flex-wrap gap-1 rounded-tile bg-band p-1">
        {(["instrument", "feature", "feedback", "maker"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
            className={`min-h-11 cursor-pointer rounded-pill border-0 px-5 text-[16px] font-semibold ${kind === k ? "bg-primary text-on-primary" : "bg-transparent text-text"}`}>
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      {maker ? (
        <p className="m-0 max-w-[560px] rounded-tile bg-band px-4 py-3 text-body">
          You can set up your maker page yourself, free, in about ten minutes: <a href={`${APP_URL}#maker`} className="font-semibold">open the app on “Create your maker page”</a>. Or write to us here first.
        </p>
      ) : null}
      {feedback ? null : <div className="flex flex-col gap-1.5">
        <label htmlFor="r-title" className="font-semibold">{kind === "instrument" ? "Instrument" : maker ? "Your workshop or shop" : "Feature"}</label>
        <input id="r-title" name="title" required maxLength={120} defaultValue={kind === "instrument" ? params.get("instrument") ?? "" : ""}
          placeholder={kind === "instrument" ? "For example: 17-key kalimba" : maker ? "Its name" : "For example: a metronome while I play"} className={field} />
      </div>}
      {maker ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Website <span className="font-normal text-muted">(if you have one)</span></label>
          <input id="r-notes" name="notes" maxLength={200} inputMode="url" autoCapitalize="none" placeholder="yourworkshop.com" className={field} />
        </div>
      ) : null}
      {kind === "instrument" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Its notes or tuning <span className="font-normal text-muted">(if you know them)</span></label>
          <input id="r-notes" name="notes" maxLength={200} placeholder="For example: C4 D4 E4 F4 G4 A4 B4 C5" className={field} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-details" className="font-semibold">{feedback ? "What was confusing, wrong or missing?" : maker ? "What do you make or sell, and what would help your buyers?" : "What would help you most?"}</label>
        <textarea id="r-details" name="details" rows={feedback ? 6 : 4} maxLength={2000} required={feedback}
          placeholder={feedback ? "What you tried, what happened, what you expected. Honest is best." : maker ? "For example: handpans to order, about 40 a year" : "A sentence or two is plenty"}
          defaultValue={feedback ? params.get("about") ?? "" : ""} className={`${field} resize-y py-3.5`} />
      </div>
      {feedback ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Instrument and tuning <span className="font-normal text-muted">(if it’s about one)</span></label>
          <input id="r-notes" name="notes" maxLength={200} placeholder="For example: D Kurd handpan, 9 notes" className={field} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-email" className="font-semibold">Email <span className="font-normal text-muted">{maker ? "(so we can write back)" : feedback ? "(optional, so we can tell you when it’s fixed)" : "(optional, to hear when it’s ready)"}</span></label>
        <input id="r-email" name="email" type="email" required={maker} maxLength={200} autoComplete="email" placeholder="you@example.com" className={field} />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="r-website">Leave this empty</label>
        <input id="r-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? <p role="alert" className="m-0 font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "sending"} className={`${btnPrimary} cursor-pointer border-0 disabled:opacity-60`}>
          {state === "sending" ? "Sending…" : feedback ? "Send feedback" : maker ? "Send" : "Send request"}
        </button>
        <p className="m-0 text-[15px] text-muted">We only use your email for this {feedback ? "message" : "request"}. <Link href="/privacy">Privacy</Link></p>
      </div>
    </form>
  );
}
