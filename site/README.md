# Calm site

Landing page for **Calm — Reading Mode for AI Chats**. It lives in `site/` of the
extension's repository so the page and the product it describes change together.
The extension never packages this folder: `install.py` and `tools/harness.js`
both skip it.

```bash
cd site
npm install && npm run dev     # http://localhost:5174
npm run build                  # → site/dist/
npm test                       # the demo against ../src (develop)
npm run test:release           # the demo against the v3.2.1 release tag
npm run check:browser          # with `npm run dev` running: the whole page in headless Chrome
```

## What this is

The design system extracted in `~/siteLearner/DESIGN-SYSTEM.md`, applied to Calm.
Same **system**, deliberately different **skin** — copying Supaste's electric
blue and notch nav would have made Calm look like a knockoff of an unrelated
product.

| | Supaste | Calm |
|---|---|---|
| Ground | white | near-black `#0b0c0e` |
| Brand object | 1400px blue gradient | barely-there warm bloom |
| Display face | Inter Display **700** | Source Serif 4 **400** |
| Accent | Instrument Serif *italic* | the same serif, *italic* |
| Display rule | lh 1.0 / −0.05em | lh 1.04 / −0.035em |
| Body rule | lh 1.4 / −0.01em | lh 1.5 / −0.01em |
| Radii | 30 / 20 | 18 / 9 |
| Reveal distance | 30px | 12px |
| Flourish | notch-shaped nav | bionic fixation |

The deviations are all reasoned, not arbitrary:

- **Body line-height 1.5, not 1.4.** This is a reading product; the page should
  demonstrate the thing it sells.
- **12px reveals, 1s fades.** Selling a calm-reading tool on a page that lurches
  would contradict the product.
- **Serif at weight 400.** Supaste shouts in bold sans. Calm speaks.

## The flourish

Supaste's one custom element is a nav shaped like a MacBook notch, because the
product lives in the notch. Calm's signature feature is bionic fixation, so
[`src/components/Bionic.jsx`](src/components/Bionic.jsx) renders a line of the
page's own copy that way — using the extension's own split
([`src/lib/bionic.js`](src/lib/bionic.js), ported from `src/reader.js`) at its
default 40%, so the sentence is set exactly the way Calm would set it.

## The demo

In plain words: the hero holds a small pretend AI chat that people can use. It
replaces a screenshot, because Calm is a keyboard tool and watching one is a
poor substitute for driving one.

- **Generic on purpose.** No chat service's name, logo, colours or layout quirks.
- **Behaviour is ported, not imagined.** Zen hides the sidebar, header, chips
  and (by default) the input bar, and gives back only what it hid; typing with
  the input hidden brings it back with the letter in it; ⌘K searches with the
  extension's scoring, ↑↓ move, ↩ runs, ←→ nudge numbers; Focus Reader bolds
  with the extension's rule from 20 to 60% and sets each paragraph's direction on
  its own (one is Hebrew); a timer preset starts a real-seconds block that
  borrows Zen and returns it at the break. [`src/demo/state.js`](src/demo/state.js)
  names the source file behind each rule, and
  [`tools/parity.test.mjs`](tools/parity.test.mjs) reads the extension's source
  to prove the port.
- **Keys only while the demo has focus**, and `preventDefault` only for a key it
  handled — ⌘⇧Z is redo and ⌘K means something in several browsers everywhere
  else on the page. Labels print Ctrl on Windows and Linux. Esc closes the top
  layer, then resets the demo.
- **Every action has a button** under the chat, for phones.
- **A preview plays until someone takes over** — a click, tap, focus or key — and
  stops at once. It stops and resets when scrolled away, never announces itself,
  and never plays under `prefers-reduced-motion`. A Stop preview button is always
  visible while it runs.
- **Announced**: each mode change a person makes is read out through a polite
  live region.

Deliberate differences from the extension, all for accessibility, honesty or
the fact that this is a demo:

- **Contrast.** The extension's 32%-ink greys and its 22%-opacity spotlight dim
  measure under WCAG AA, so the demo uses the site's lifted greys and dims the
  other blocks to 5.3:1 instead.
- **Escape.** Here it closes the top layer — palette, then the timer screen,
  then Focus Reader — and resets the demo when nothing is open. The extension's
  Escape closes the palette and Focus Reader, has no handler on the timer
  screen, and never leaves Zen or shows the input. The note under the demo says
  "Esc closes what is open, then resets the demo".
- **Layers.** Everything under the top layer is `inert`, so Tab cannot reach a
  control that is covered. The extension does not do this.
- **Type-ahead** is held back while a layer is open; the extension would reveal
  the input underneath it.
- **The fixation slider** shows its value; the extension leaves that to the
  slider's tooltip. ↑↓ on a focused slider adjust the slider rather than walking
  the spotlight.
- **The palette** lists only the commands this demo can run, and says so. A
  number gets − and + buttons on touch screens, below the list.
- **Timer presets** start the block in one tap; the extension sets the preset in
  the Advanced drawer and starts it from the Console.
- **Version.** The demo follows `develop` (3.3.0), which fixed two ownership
  rules: showing the input bar releases Zen's claim on it, and leaving Zen
  settles a timer's borrowed Zen. Against the downloadable v3.2.1 those two
  show up in random action sequences (1466 of 2000 in the fuzz below), but both
  need you to toggle Zen or the input bar while Zen or a block is already on.
  Ship 3.3.0 before this page goes live, or accept that difference.

## Palette provenance

Colors are lifted from Calm's own `content.css` so the site and the extension
are visibly the same object — `#1c1d20` panels, `#9a9ba0` secondary text, the
`#f59e0b` Pomodoro warmth as the single accent.

**One deviation:** Calm's `#6e6f74` measured 3.4:1 at 11–12px, under the 4.5:1
WCAG AA floor. It is lightened to `#8a8b91` here. A page selling a
reading-accessibility tool has to pass its own bar.

## Media

Screenshots from the extension's `store-assets/`, as they were at **v3.2.1** —
the version the page's download button installs. `develop`'s newer shots show
3.3.0 interface (the ↓ Answer half, Auto-scroll in the mode row) that people
cannot download yet, so they are not used until 3.3.0 ships.

## Copy is checked against the code

Every feature and FAQ claim was checked against `src/` on `develop` and against
the `v3.2.1` tag. When 3.3.0 ships: add ⌘⇧E (down to the next answer) and ⌘⇧S
(auto-scroll) to the shortcuts section, and refresh the media from
`store-assets/`.

## Verified

`npm test` / `npm run test:release` — 12 tests, each shown to fail when the rule
it guards is broken on purpose:

- **Differential fuzz.** The extension's own Zen, input-bar and timer functions
  are lifted out of `src/` (DOM and drawing stubbed) and driven through the same
  2000 random action sequences as the demo's reducer. Every observable — Zen,
  the input bar and who hid it, phase, clock, cycle, pause, the break screen,
  the borrowed Zen — has to match after every step. It caught three real
  mismatches while being written (a cleared clock, a cleared pause flag, and
  pausing an idle timer).
- Bionic splitting, palette names/ranges/scoring, timer presets and defaults are
  all compared against the extension's source, not a copy of it.

`npm run check:browser` — headless Chrome, 375 / 810 / 1280:

- Every line of text passes WCAG AA against the **rendered pixels** behind it,
  on the whole page and in every demo state (preview, Zen, palette, Focus Reader
  with spotlight, timer focus and break, the send note, touch layouts), with a
  minimum line count per state so a scrolled-away demo cannot pass by measuring
  nothing.
- No horizontal overflow anywhere; every scroll reveal fires; no console errors.
- Every demo path by keyboard and by clicking; shortcuts outside the demo are
  left alone; Tab into the demo keeps the keyboard there; layers are inert
  beneath the top one; Escape peels them top-down; an automatic break screen
  does not steal focus from the rest of the page; the preview starts, stops on
  takeover, resets when scrolled away and resumes; reduced motion has no
  preview; Windows labels read Ctrl.

## Still to do

- Not on the Chrome Web Store yet, so the install flow documents developer mode
  honestly, including the Chrome warning. Replace that section with a store
  button once listed.
- No OG image or favicon set beyond the extension icon.
- `02-focus-reader.png` has "full Hebrew and Arabic support" baked into the
  image, which is a stronger claim than the copy around it now makes, and it
  predates the reader's sliders and Refresh button. Regenerate it with
  `node tools/store-shots.js` when the reader's chrome next changes.
- Per-block right-to-left is proven in the demo and in ChatGPT's markup. On
  Gemini and Claude the response may arrive inside a single wrapper, in which
  case the whole answer becomes one block (one direction, one spotlight step).
  Worth checking live on both, and worth `unicode-bidi: plaintext` on the
  reader's paragraphs if it does.
- The parity tests are not in CI. Adding `node --test site/tools/*.test.mjs` to
  `.github/workflows/harness.yml` would catch the demo drifting when the
  extension changes — at the cost of failing the extension's own merge gate
  until the demo is updated. Owner's call.
- In the extension (not this site): the manifest description and several docs
  still say "no permissions" and "incapable of contacting a server"; the timer's
  breathing ring ignores reduced motion. Both are being handled on
  `fix/honest-privacy-and-motion`.
