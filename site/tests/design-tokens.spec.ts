import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Colour values live in src/app/globals.css as tokens (as on lgaa-site).
// Everything else under src/ uses the tokens, so one edit restyles the site.
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
// layout.tsx: viewport.themeColor must be a literal colour (checked below to be Ink).
const ALLOWED = new Set([join("src", "app", "globals.css"), join("src", "app", "layout.tsx")]);

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
const ARBITRARY_COLOUR_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|outline|decoration|shadow|from|via|to|divide|accent|caret)-\[\s*(?:#|color:|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\()/i;
const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|outline|decoration|from|via|to|divide|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/;

export function findViolations(source: string): string[] {
  const found: string[] = [];
  if (RAW_HEX.test(source)) found.push("raw hex colour");
  if (COLOUR_FUNCTION.test(source)) found.push("rgb()/hsl() colour");
  if (ARBITRARY_COLOUR_CLASS.test(source)) found.push("arbitrary Tailwind colour class");
  if (PALETTE_CLASS.test(source)) found.push("Tailwind palette colour class (use a token)");
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("design tokens", () => {
  it("scans a non-trivial set of files", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(15);
  });

  it("keeps raw colour values out of src/ (except globals.css)", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(ROOT, file))
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) => findViolations(readFileSync(join(ROOT, file), "utf8")).map((v) => `${file.split(sep).join("/")}: ${v}`));
    expect(offenders).toEqual([]);
  });

  it("uses the brand palette as given in the brand book", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const [name, hex] of [["oak-olive", "#4E4B2E"], ["clay", "#B3633F"], ["ink", "#28271F"], ["cream", "#F2E6D3"], ["sage", "#7A7A57"]]) {
      expect(css).toMatch(new RegExp(`--${name}: ${hex};`));
    }
  });

  it("the theme colour in the root layout is Ink", () => {
    // The one hex outside globals.css that Next needs as a literal (viewport.themeColor).
    expect(readFileSync(join(SRC, "app", "layout.tsx"), "utf8")).toContain('themeColor: "#28271F"');
  });
});

// WCAG 2.x contrast for every text colour on the surface it is used on.
function cssColour(name: string): string {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`--${name} is not a plain #rrggbb value`);
  return match[1];
}
function contrast(a: string, b: string): number {
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255); };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("text contrast is at least 4.5:1", () => {
  const pairs: [string, string][] = [
    ["text", "bg"], ["body-text", "bg"], ["muted", "bg"], ["link", "bg"], ["accent-text", "bg"],
    ["text", "surface"], ["body-text", "surface"], ["muted", "surface"],
    ["body-text", "band"], ["muted", "band"], ["link", "band"],
    ["on-primary", "primary"], ["on-cta", "cta"], ["on-dark", "dark"], ["on-dark-muted", "dark"], ["on-dark-muted", "dark-raised"],
    ["status-ready", "status-ready-soft"], ["status-soon", "status-soon-soft"], ["danger", "bg"],
  ];
  for (const [fg, bg] of pairs) {
    it(`--${fg} on --${bg}`, () => expect(contrast(cssColour(fg), cssColour(bg))).toBeGreaterThanOrEqual(4.5));
  }
});
