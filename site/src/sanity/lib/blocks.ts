import type { Block, SimpleBlock } from "./types";

/** Seed pages are simple paragraphs; Sanity pages are already Portable Text. */
export function toBlocks(body: Block[] | SimpleBlock[] | null | undefined): Block[] {
  return (body ?? []).map((b, i) =>
    "_type" in b
      ? b
      : { _type: "block", _key: `b${i}`, style: b.style, markDefs: [], children: [{ _type: "span", _key: `s${i}`, text: b.text, marks: [] }] },
  );
}
