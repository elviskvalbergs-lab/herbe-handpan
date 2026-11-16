"use client";

import { useState, useSyncExternalStore } from "react";
import type { PublicRequest } from "@/sanity/lib/types";

const KEY = "oakhum-votes";
// What this browser voted for, kept in localStorage (a convenience, not a guard).
const listeners = new Set<() => void>();
const readRaw = () => { try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; } };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function remember(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private window */ }
  listeners.forEach((fn) => fn());
}

export function RequestVotes({ requests }: { requests: PublicRequest[] }) {
  const votedRaw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const voted: string[] = (() => { try { return JSON.parse(votedRaw); } catch { return []; } })();
  const [votes, setVotes] = useState<Record<string, number>>(() => Object.fromEntries(requests.map((r) => [r._id, r.votes ?? 0])));
  const [error, setError] = useState<string | null>(null);

  async function vote(id: string) {
    if (voted.includes(id)) return;
    setError(null);
    const res = await fetch("/api/requests/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setError(json.error ?? "Your vote didn't go through. Please try again."); return; }
    remember([...voted, id]);
    setVotes((v) => ({ ...v, [id]: json.votes ?? (v[id] ?? 0) + 1 }));
  }

  if (!requests.length) {
    return <p className="m-0 text-body">The list starts with the first requests. Yours could be at the top.</p>;
  }
  return (
    <>
      <ul className="m-0 list-none border-t border-border p-0">
        {requests.map((r) => {
          const on = voted.includes(r._id);
          return (
            <li key={r._id} className="flex items-center justify-between gap-4 border-b border-border py-3.5">
              <span className="flex flex-col">
                <span className="font-semibold">{r.title}</span>
                <span className="text-[15px] text-muted">{r.kind === "feature" ? "Feature" : "Instrument"} · {votes[r._id]} {votes[r._id] === 1 ? "vote" : "votes"}</span>
              </span>
              <button type="button" aria-pressed={on} disabled={on} onClick={() => vote(r._id)}
                className={`min-h-11 min-w-[88px] cursor-pointer rounded-pill border px-4 text-[15px] font-semibold ${on ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text hover:border-text"}`}>
                {on ? "Voted" : "Vote"}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="mt-3 mb-0 text-danger">{error}</p> : null}
    </>
  );
}
