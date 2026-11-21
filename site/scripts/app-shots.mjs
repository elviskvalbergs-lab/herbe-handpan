// Takes the website's screenshots of the app (public/shots/*.webp) from a
// local build of it, so they are the real screens, not mock-ups.
//   python3 build.py            (repository root: builds index.html)
//   node site/scripts/app-shots.mjs
// Re-run it when the app's look changes. Needs Playwright (and its Chromium)
// and Python's Pillow for the WebP files; neither is a dependency of the site.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "site", "public", "shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };

// The repository root, with the app's own rule: any path that isn't a file is the app (vercel.json rewrites).
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if (!extname(path)) throw new Error("app path");
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(200, { "content-type": "text/html" }).end(await readFile(join(ROOT, "index.html")));
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
// A phone: 390 × 844 at twice the pixels.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
// Nothing leaves the machine: no analytics, no error reports, no sign-in.
await context.route((url) => !url.href.startsWith(origin), (route) => route.abort());

const only = process.argv[2];
async function shot(name, path, steps = async () => {}) {
  if (only && only !== name) return;
  const page = await context.newPage();
  await page.goto(origin + path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await steps(page);
  await page.waitForTimeout(500);
  const png = join(OUT, `${name}.png`);
  await page.screenshot({ path: png });
  await page.close();
  execFileSync("python3", ["-c", "import sys; from PIL import Image; im = Image.open(sys.argv[1]).convert('RGB'); im.save(sys.argv[2], 'WEBP', quality=82, method=6)", png, join(OUT, `${name}.webp`)]);
  execFileSync("rm", [png]);
  console.log(`public/shots/${name}.webp`);
}

await shot("handpan-chords", "/handpan/d-kurd/chords/d-min");
await shot("tongue-drum-chords", "/tongue-drum/d-kurd-9/chords/d-min");
await shot("kalimba-chords", "/kalimba/c-major-17/chords/c-maj");
await shot("ocarina-chords", "/ocarina/alto-c-12/chords");
await shot("flute-chords", "/flute/tin-whistle-d/chords/d-maj");
// The first screen of setting up: "Play my notes" is its main button.
await shot("setup-play-my-notes", "/play", async (page) => {
  await page.locator('[data-action="setup-family"][data-family="handpan"]').click();
});
// The song list without the season's filter, so the picture doesn't date.
const allSongs = async (page) => {
  const all = page.locator('[data-action="songs-filter"]').filter({ hasText: "All songs" });
  if (await all.count()) await all.first().click();
  await page.evaluate(() => { const h = document.getElementById("pl-sec-songs"); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 76); });
};
await shot("songs", "/handpan/d-kurd/playlists", allSongs);
await shot("song-tab", "/handpan/d-kurd/playlists", async (page) => {
  await allSongs(page);
  await page.locator('[data-action="song-open"]').first().click();
});

await browser.close();
server.close();
