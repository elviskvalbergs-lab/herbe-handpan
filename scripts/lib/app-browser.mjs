// The built app in a real browser, for scripts that need to look at it
// (scripts/help-screenshots.mjs). A thin layer over the browser tests' own
// harness (tests/e2e/harness.mjs): the same server (served like Vercel, with
// its headers and Content-Security-Policy), the same stand-in Supabase and
// the same cut-off of outside hosts, so a picture shows exactly what the
// smoke suite tests. Nothing leaves this machine.
import { chromium, serveApp, fakeServer, newDevice, signInWithCode, ROOT } from '../../tests/e2e/harness.mjs';

export { ROOT };

/** Starts the server and the browser. `await app.close()` when done. */
export async function openApp() {
  const served = await serveApp();
  const server = fakeServer();
  // A fake microphone, so screens that listen open as they do on a phone.
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

  /** A fresh visitor (own storage). `problems` lists page errors, as the smoke suite does. */
  async function visitor({ width = 390, height = 844, scale = 1 } = {}) {
    const d = await newDevice(browser, server, 'visitor', {
      base: served.base, serviceWorkers: 'block',
      contextOptions: { viewport: { width, height }, deviceScaleFactor: scale, permissions: ['microphone'] },
    });
    const page = d.page;
    const go = async (path) => { await page.goto(served.base + path); await page.waitForTimeout(500); };
    /** Signs in through the app's own save sheet (which must be open). */
    const signIn = async () => { await signInWithCode(page, 'player@example.com'); await page.waitForTimeout(1200); };
    return { page, go, signIn, problems: d.problems, close: () => d.ctx.close() };
  }

  return { base: served.base, visitor, close: async () => { await browser.close(); await served.close(); } };
}
