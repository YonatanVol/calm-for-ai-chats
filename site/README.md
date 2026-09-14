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

Deliberate differences from the extension, all for accessibility or honesty:
the extension's 32%-ink greys and its 22%-opacity spotlight dim measure under
WCAG AA, so the demo uses the site's lifted greys and dims to 5.3:1 instead; a
small number beside the fixation slider says its value; the palette lists only
the commands this demo can run and says so, and a number row offers − and + on
touch screens; choosing a timer preset starts the block in one tap (the
extension sets the preset in Advanced and starts from the Console); and Esc
resets the demo when nothing is open, which the extension does not do — the
note under the demo says so.

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

## Verified (2026-09-14, headless Chrome 152, `npm run check:browser`: 129 checks)

- Every line of text on the page passes WCAG AA against the **rendered pixels**
  behind it (218–237 lines at 375, 810 and 1280), and every demo state does too:
  preview keycap, Zen, palette, Focus Reader with spotlight, timer focus and
  break screens, the send note, and the touch layouts at 375 and 810.
- No horizontal overflow at 375, 810 or 1280, in every demo state.
- Every scroll reveal fires; no console errors or warnings.
- Every demo path works by keyboard and by clicking; shortcuts outside the demo
  are not prevented; the preview starts, stops on takeover, resets when
  scrolled away and resumes; reduced motion has no preview and no transitions;
  Windows labels read Ctrl.
- `npm test` / `npm run test:release`: 10 tests; each was shown to fail when the
  rule it guards was broken on purpose.

## Still to do

- Not on the Chrome Web Store yet, so the install flow documents developer mode
  honestly, including the Chrome warning. Replace that section with a store
  button once listed.
- No OG image or favicon set beyond the extension icon.
- In the extension (not this site): the manifest description and several docs
  still say "no permissions" and "incapable of contacting a server"; the timer's
  breathing ring ignores reduced motion.
