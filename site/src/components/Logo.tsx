import { brandLogo } from "@engine/brand.js";

// The Oakhum logo: the brand kit's master paths, drawn by the app's own
// helper (js/brand.js) in currentColor. Size it with the wrapper's height.
export function Logo({ className = "", label = "Oakhum" }: { className?: string; label?: string }) {
  return <span className={`inline-block [&_svg]:block [&_svg]:h-full [&_svg]:w-auto ${className}`} dangerouslySetInnerHTML={{ __html: brandLogo({ label }) }} />;
}
