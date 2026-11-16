// Checks a request from the form before anything is written. Pure, so it is
// unit-tested (tests/requests.spec.ts). The API route adds the Sanity write.
export type RequestInput = { kind: "instrument" | "feature"; title: string; notes?: string; details?: string; email?: string };

const LIMITS = { title: 120, notes: 200, details: 2000, email: 200 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequest(body: unknown): { ok: true; value: RequestInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Something went wrong reading the form. Please try again." };
  const b = body as Record<string, unknown>;
  // A field people can't see: bots fill it in, people don't.
  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: false, error: "Something went wrong. Please try again." };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const kind = b.kind === "feature" ? "feature" : b.kind === "instrument" ? "instrument" : null;
  if (!kind) return { ok: false, error: "Choose an instrument or a feature." };
  const title = str(b.title);
  if (!title) return { ok: false, error: kind === "instrument" ? "Write which instrument you play." : "Write which feature you'd like." };
  const notes = str(b.notes), details = str(b.details), email = str(b.email);
  for (const [k, v] of Object.entries({ title, notes, details, email })) {
    if (v.length > LIMITS[k as keyof typeof LIMITS]) return { ok: false, error: `That's longer than we can take: shorten the ${k === "details" ? "description" : k}.` };
  }
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address doesn't look right. Check it, or leave it empty." };
  return { ok: true, value: { kind, title, notes: notes || undefined, details: details || undefined, email: email || undefined } };
}
