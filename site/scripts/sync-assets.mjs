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
console.log("sync-assets: copied ../fonts and ../brand into public/");
