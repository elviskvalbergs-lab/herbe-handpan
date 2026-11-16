import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// The pan drawing on the site uses the app's light-theme pan colours. They are
// written out in globals.css (the site's one token file); this keeps them in
// step with the app's styles.css.
const tokens = (css: string) => Object.fromEntries([...css.matchAll(/--((?:pan|note|chord|alt-c|faint)[a-z0-9-]*):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

it("the site's pan colours are the app's light theme", () => {
  const app = readFileSync(join(__dirname, "..", "..", "styles.css"), "utf8");
  const lightBlock = app.slice(app.indexOf(':root[data-theme="light"] {\n  --pan-g0'));
  const appLight = { ...tokens(app.slice(0, app.indexOf(":root[data-theme"))), ...tokens(app.slice(app.indexOf(':root[data-theme="light"]'), app.indexOf("@media (prefers-color-scheme: light)"))), ...tokens(lightBlock.slice(0, lightBlock.indexOf("}"))) };
  const site = tokens(readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8"));
  expect(Object.keys(site).length).toBeGreaterThan(30);
  for (const [name, value] of Object.entries(site)) expect([name, value]).toEqual([name, appLight[name]]);
});
