"use client";

import { useEffect } from "react";

// Counts one open of a maker's code from an embed (log_maker_event,
// supabase/migrations/20261122_maker_codes_scans.sql in the repository
// root): a count for the maker's numbers, nothing about the visitor, nothing
// stored in the browser. Fails silently; the demo never waits for it.
export function EmbedCount({ code, api }: { code: string; api: { url: string; key: string } }) {
  useEffect(() => {
    fetch(`${api.url}/rest/v1/rpc/log_maker_event`, {
      method: "POST",
      headers: { apikey: api.key, authorization: `Bearer ${api.key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_code: code, p_event: "open", p_via: "embed" }),
      keepalive: true,
    }).catch(() => {});
  }, [code, api.url, api.key]);
  return null;
}
