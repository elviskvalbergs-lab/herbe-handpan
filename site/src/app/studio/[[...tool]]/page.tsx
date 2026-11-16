import { Studio } from "./Studio";

export { metadata, viewport } from "next-sanity/studio";

// Cache Components needs at least one prerendered param; `[]` is the Studio root.
export function generateStaticParams() {
  return [{ tool: [] as string[] }];
}

export default function StudioPage() {
  return <Studio />;
}
