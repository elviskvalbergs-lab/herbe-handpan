// The four phone recordings of the overview video (docs/video-plan.md §4),
// from the live app with its own sound (../phone-recorder.js), into rec/<scene>/:
//   o2  /play as a new visitor: tap Handpan, hold on "I know my scale" / "Play my notes"
//   o3  /handpan/d-kurd/chords: D Minor, Bb Major, F Major
//   o4  /kalimba/c-major-17/songs/ode-to-joy: Play
//   o5  /handpan/d-kurd/chords: Listen, with guitar.wav as the microphone
//
//   python3 guitar.py && node record.js            # all four
//   node record.js o3                               # one of them
const path = require('path');
const { recordPhone } = require('../phone-recorder');
const OUT = __dirname + '/rec/';
const APP = 'https://oakhum.com';
const only = process.argv.slice(2);

// The first visible button with that data-action (the app keeps hidden copies of some).
const act = (page, action, extra = '') => page.locator(`[data-action="${action}"]${extra} >> visible=true`).first();

const RECORDINGS = {
  async o2() {
    await recordPhone(OUT + 'o2/', `${APP}/play`, async (page, mark) => {
      await page.waitForTimeout(1200);
      mark('tap');
      await act(page, 'setup-family', '[data-family="handpan"]').click();
      await page.waitForTimeout(5500);
    }, {
      // The tiles in view, as on a phone that has scrolled to them.
      prepare: async (page) => {
        await act(page, 'setup-family', '[data-family="handpan"]').scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, 160));
      },
    });
  },
  async o3() {
    await recordPhone(OUT + 'o3/', `${APP}/handpan/d-kurd/chords`, async (page, mark) => {
      await page.waitForTimeout(600);
      for (const name of ['D Minor', 'Bb Major', 'F Major']) {
        mark(name);
        await act(page, 'select-chord', `:has-text("${name}")`).click();
        await page.waitForTimeout(2700);
      }
      await page.waitForTimeout(1200);
    });
  },
  async o4() {
    await recordPhone(OUT + 'o4/', `${APP}/kalimba/c-major-17/songs/ode-to-joy`, async (page, mark) => {
      await page.waitForTimeout(800);
      mark('play');
      await act(page, 'song-play').click();
      await page.waitForTimeout(10000);
    });
  },
  async o5() {
    await recordPhone(OUT + 'o5/', `${APP}/handpan/d-kurd/chords`, async (page, mark) => {
      await page.waitForTimeout(600);
      await act(page, 'chords-mode', '[data-value="listen"]').click();
      await page.waitForTimeout(900);
      mark('listen');  // the microphone (guitar.wav) starts about here
      await act(page, 'hear-start').click();
      await page.waitForTimeout(10500);
    }, { mic: path.join(__dirname, 'guitar.wav') });
  },
};

(async () => {
  for (const [name, rec] of Object.entries(RECORDINGS)) if (!only.length || only.includes(name)) await rec();
})();
