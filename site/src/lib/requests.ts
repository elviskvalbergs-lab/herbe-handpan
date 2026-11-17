// Checks a request from the form before anything is written. Pure, so it is
// unit-tested (tests/requests.spec.ts). The API route adds the Sanity write.
// "feedback" is something confusing, wrong or missing in the app: never shown
// in the public list, and its title is the start of what the person wrote.
export type RequestInput = { kind: "instrument" | "feature" | "feedback"; title: string; notes?: string; details?: string; email?: string };

const LIMITS = { title: 120, notes: 200, details: 2000, email: 200 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequest(body: unknown): { ok: true; value: RequestInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Something went wrong reading the form. Please try again." };
  const b = body as Record<string, unknown>;
  // A field people can't see: bots fill it in, people don't.
  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: false, error: "Something went wrong. Please try again." };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const kind = b.kind === "feature" || b.kind === "instrument" || b.kind === "feedback" ? b.kind : null;
  if (!kind) return { ok: false, error: "Choose an instrument, a feature or feedback." };
  const notes = str(b.notes), details = str(b.details), email = str(b.email);
  if (kind === "feedback" && !details) return { ok: false, error: "Write what happened or what's missing." };
  const title = kind === "feedback" ? (str(b.title) || feedbackTitle(details)) : str(b.title);
  if (!title) return { ok: false, error: kind === "instrument" ? "Write which instrument you play." : "Write which feature you'd like." };
  for (const [k, v] of Object.entries({ title, notes, details, email })) {
    if (v.length > LIMITS[k as keyof typeof LIMITS]) return { ok: false, error: `That's longer than we can take: shorten the ${k === "details" ? "description" : k}.` };
  }
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address doesn't look right. Check it, or leave it empty." };
  return { ok: true, value: { kind, title, notes: notes || undefined, details: details || undefined, email: email || undefined } };
}

// A one-line title for the Studio list, from the start of the feedback.
function feedbackTitle(details: string): string {
  const line = details.split("\n")[0];
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line;
}
