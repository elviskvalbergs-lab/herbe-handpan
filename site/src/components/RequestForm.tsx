"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const field = "min-h-13 rounded-tile border border-border-strong bg-surface px-4 text-[17px] text-text aria-[invalid=true]:border-danger";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "title" | "details" | "email";
type FieldErrors = Partial<Record<FieldName, string>>;

/** What each field is missing, in the words the server would use (src/lib/requests.ts), so the field itself can say it. */
function check(kind: Kind, data: Record<string, FormDataEntryValue>): FieldErrors {
  const v = (k: string) => String(data[k] ?? "").trim();
  const errors: FieldErrors = {};
  if (kind !== "feedback" && !v("title")) errors.title = kind === "instrument" ? "Write which instrument you play." : "Write which feature you’d like.";
  if (kind === "feedback" && !v("details")) errors.details = "Write what happened or what’s missing.";
  if (v("email") && !EMAIL.test(v("email"))) errors.email = "That email address doesn’t look right. Check it, or leave it empty.";
  return errors;
}

/** A field's error, tied to the field by aria-describedby. */
function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="m-0 text-[15px] font-semibold text-danger">{text}</p> : null;
}

type Kind = "instrument" | "feature" | "feedback";
const KIND_LABELS: Record<Kind, string> = { instrument: "An instrument or tuning", feature: "A feature", feedback: "Feedback" };

export function RequestForm() {
  const params = useSearchParams();
  const asked = params.get("kind");
  const [kind, setKind] = useState<Kind>(asked === "feature" || asked === "feedback" ? asked : "instrument");
  const feedback = kind === "feedback";
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const invalid = (name: FieldName) => (errors[name] ? { "aria-invalid": true as const, "aria-describedby": `r-${name}-error` } : {});
  const clear = (name: FieldName) => () => { if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined })); };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const found = check(kind, data);
    setErrors(found);
    const first = (["title", "details", "email"] as const).find((k) => found[k]);
    if (first) { form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    setState("sending");
    try {
      const res = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, kind }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); setState("idle"); return; }
      setState("sent");
      track("request_submitted", { kind });
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-card bg-surface p-9 shadow-[inset_0_0_0_1px_var(--border)]">
        <h2 className="m-0 mb-2.5 text-[30px] font-semibold">{feedback ? "Feedback sent" : "Request sent"}</h2>
        <p className="m-0 mb-6 text-body">{feedback ? "Thank you, every message is read. If you left your email, we’ll tell you when it’s fixed." : "Thank you. If you left your email, we’ll write when it’s ready."}</p>
        <button type="button" className={btnSecondary} onClick={() => setState("idle")}>{feedback ? "Send more feedback" : "Send another request"}</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div role="group" aria-label="What are you asking for?" className="inline-flex w-fit flex-wrap gap-1 rounded-tile bg-band p-1">
        {(["instrument", "feature", "feedback"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setErrors({}); }}
            className={`min-h-11 cursor-pointer rounded-pill border-0 px-5 text-[16px] font-semibold ${kind === k ? "bg-primary text-on-primary" : "bg-transparent text-text"}`}>
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      {feedback ? null : <div className="flex flex-col gap-1.5">
        <label htmlFor="r-title" className="font-semibold">{kind === "instrument" ? "Instrument" : "Feature"}</label>
        <input id="r-title" name="title" required maxLength={120} {...invalid("title")} onInput={clear("title")} defaultValue={kind === "instrument" ? params.get("instrument") ?? "" : ""}
          placeholder={kind === "instrument" ? "For example: 17-key kalimba" : "For example: a metronome while I play"} className={field} />
        <FieldError id="r-title-error" text={errors.title} />
      </div>}
      {kind === "instrument" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Its notes or tuning <span className="font-normal text-muted">(if you know them)</span></label>
          <input id="r-notes" name="notes" maxLength={200} placeholder="For example: C4 D4 E4 F4 G4 A4 B4 C5" className={field} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-details" className="font-semibold">{feedback ? "What was confusing, wrong or missing?" : "What would help you most?"}</label>
        <textarea id="r-details" name="details" rows={feedback ? 6 : 4} maxLength={2000} required={feedback} {...invalid("details")} onInput={clear("details")}
          placeholder={feedback ? "What you tried, what happened, what you expected. Honest is best." : "A sentence or two is plenty"} className={`${field} resize-y py-3.5`} />
        <FieldError id="r-details-error" text={errors.details} />
      </div>
      {feedback ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-notes" className="font-semibold">Instrument and tuning <span className="font-normal text-muted">(if it’s about one)</span></label>
          <input id="r-notes" name="notes" maxLength={200} placeholder="For example: D Kurd handpan, 9 notes" className={field} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-email" className="font-semibold">Email <span className="font-normal text-muted">{feedback ? "(optional, so we can tell you when it’s fixed)" : "(optional, to hear when it’s ready)"}</span></label>
        <input id="r-email" name="email" type="email" maxLength={200} autoComplete="email" placeholder="you@example.com" className={field} {...invalid("email")} onInput={clear("email")} />
        <FieldError id="r-email-error" text={errors.email} />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="r-website">Leave this empty</label>
        <input id="r-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? <p role="alert" className="m-0 font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "sending"} className={`${btnPrimary} cursor-pointer border-0 disabled:opacity-60`}>
          {state === "sending" ? "Sending…" : feedback ? "Send feedback" : "Send request"}
        </button>
        <p className="m-0 text-[15px] text-muted">We only use your email for this {feedback ? "message" : "request"}. <Link href="/privacy">Privacy</Link></p>
      </div>
    </form>
  );
}
