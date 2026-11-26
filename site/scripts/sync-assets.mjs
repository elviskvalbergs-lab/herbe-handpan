// Copies the app's shared assets into public/ before `next dev` / `next build`:
// the Oakhum Text fonts (../fonts) and the brand kit (../brand). The copies are
// gitignored; the originals in the repository root are the only source.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(site, "..");
for (const dir of ["fonts", "brand"]) {
  mkdirSync(join(site, "public", dir), { recursive: true });
  cpSync(join(root, dir), join(site, "public", dir), { recursive: true });
}
// The help articles' pictures (../help/img, made by ../scripts/help-screenshots.mjs),
// at the same address the app's own server gives them: /help/img/<name>.jpg.
mkdirSync(join(site, "public", "help", "img"), { recursive: true });
cpSync(join(root, "help", "img"), join(site, "public", "help", "img"), { recursive: true });
console.log("sync-assets: copied ../fonts, ../brand and ../help/img into public/");
