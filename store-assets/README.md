# Store assets

Regenerate at any time:

```bash
node tools/store-shots.js
```

They are rendered from `content.css` and `src/icons.js` directly, so they can
never drift from what the extension actually looks like. Re-run after any
design change.

| File | Size | Slot in the dashboard |
| --- | --- | --- |
| `01-one-menu.png` | 1280×800 | Screenshot 1 |
| `02-focus-reader.png` | 1280×800 | Screenshot 2 |
| `03-timer.png` | 1280×800 | Screenshot 3 |
| `04-palette.png` | 1280×800 | Screenshot 4 |
| `05-margin.png` | 1280×800 | Screenshot 5 |
| `promo-440x280.png` | 440×280 | Small promo tile |

## Read this before uploading

**These are hero shots, not in-situ screenshots.** They show Calm's real
interface — real stylesheet, real icons, real states — on a neutral backdrop
with a caption. What they do *not* show is that interface sitting on
chatgpt.com, gemini.google.com or claude.ai.

That is deliberate. The generator cannot log into those sites, and mocking up
someone else's product closely enough to pass as a real screenshot would be
both misleading to a reviewer and a trademark problem. The page of text in the
background is abstract for exactly that reason.

**One screenshot you take by hand, on a real conversation, is worth more than
all five of these.** Reviewers and users both want to see the thing in its
actual context. If you take even one, make it screenshot 1.

To take it: open a real chat with a decent amount of text, press ⌘K or click
the pill so the menu is open, and capture the window at 1280×800
(`⌘⇧4` then Space on macOS captures a window; resize the window to 1280×800
first, or crop after). Drop it in here and rename it `01-one-menu.png`.

Two honest notes about what the shots depict:

- **05-margin** shows the marks *awake* — the state they take when the pointer
  comes near them. At rest they sit at 20% opacity and would be nearly
  invisible in a still image. This is a real state, not an invented one.
- **02-focus-reader** includes a Hebrew paragraph on purpose. Right-to-left
  support is real, and it is the kind of thing people search for.

## Still needed from you

- The **128×128 store icon** is in `icons/icon128.png` and is uploaded
  separately from these.
- A **marquee promo tile** (1400×560) is optional and only used if Chrome
  features the extension. Not generated here.
