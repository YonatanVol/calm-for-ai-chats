# calm-site

Landing page for **Calm — Reading Mode for AI Chats**.

```bash
npm install && npm run dev     # http://localhost:5174
npm run build                  # → dist/
```

## What this is

The design system extracted in [`../siteLearner/DESIGN-SYSTEM.md`](../siteLearner/DESIGN-SYSTEM.md),
applied to Calm. Same **system**, deliberately different **skin** — copying
Supaste's electric blue and notch nav would have made Calm look like a knockoff
of an unrelated product.

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
page's own copy that way. The page demonstrates the product instead of
describing it, and no other landing page can borrow it.

## Palette provenance

Colors are lifted from Calm's own `content.css` so the site and the extension
are visibly the same object — `#1c1d20` panels, `#9a9ba0` secondary text, the
`#f59e0b` Pomodoro warmth as the single accent.

**One deviation:** Calm's `#6e6f74` measured 3.4:1 at 11–12px, under the 4.5:1
WCAG AA floor. It is lightened to `#8a8b91` here. A page selling a
reading-accessibility tool has to pass its own bar — and the same token is
probably worth checking inside the extension.

## Media

Real product screenshots from `chatgpt-input-toggle/store-assets/` — the same
images destined for the Chrome Web Store listing. Per section 7 of the teardown,
this is where perceived quality actually comes from.

## Verified

- 24/24 text-on-background combinations pass WCAG AA contrast
- No horizontal overflow at 375, 810 or 1280
- Type tokens hold at every breakpoint (tracking is em-based, so −0.035em
  becomes −2.66px at 76px and −1.96px at 56px on its own)
- `prefers-reduced-motion` disables reveals and smooth scrolling
- Font payload 175KB — latin subsets only, `wght` axis instead of `opsz`

## Still to do

- Not on the Chrome Web Store yet, so the install flow documents developer mode
  honestly, including the Chrome warning. Replace that section with a store
  button once listed.
- Copy assumes the GitHub repo is `YonatanVol/calm-for-ai-chats` — fix the
  footer and install links if that changes.
- No OG image or favicon set beyond the extension icon.
