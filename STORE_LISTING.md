# Chrome Web Store — Submission Guide (v3.0.0)

Everything needed to publish **Calm — Reading Mode for AI Chats**. Registering the
developer account, paying the fee, and pressing Submit require your Google account
and payment — those stay with you. Everything below is paste-ready.

**Every claim here is checked against the shipped code** (`manifest.json`,
`PRIVACY.md`, `src/`). If you change permissions or add a site, update this file
in the same commit — a listing that overstates or understates the privacy story is
the fastest way to fail review.

---

## 0. One-time setup (you)

1. Register as a Chrome Web Store developer (**one-time $5 USD fee**):
   https://chrome.google.com/webstore/devconsole
2. Verify your email / account.
3. Host `PRIVACY.md` at a public URL (GitHub Pages, or link the raw file) — the
   dashboard requires a privacy-policy URL because Calm requests permissions.

## 1. Upload artifact

```bash
python3 install.py --zip
```

Produces `dist/calm-for-ai-chats-v3.0.0.zip` (manifest + `src/` + `content.css` +
`icons/`, with `__pycache__`/`.DS_Store` swept). Upload it under **New item**.

The private signing key lives outside the repo in `~/.calm-keys/` and must **never**
be added to the zip. The `key` field in the manifest is the *public* half — it pins
the extension ID so the OAuth redirect URL stays stable across uploads. Leave it in.

---

## 2. Listing copy (paste-ready)

**Name**

> Calm — Reading Mode for AI Chats

**Summary** (≤132 chars — this one is 108)

> Calm reading and focus for ChatGPT, Gemini and Claude. Focus Reader, Zen mode, Pomodoro. No analytics, ever.

**Description**

> AI chats are built to keep you typing. Calm turns one into something you can
> actually read and think in.
>
> **Read**
> • Focus Reader — the response, re-rendered in a quiet pane of its own: bionic
>   fixation (adjustable 20–60%), Ease spacing for dyslexic reading, Spotlight
>   that dims everything but the block you're on, arrow keys to walk it, and
>   automatic right-to-left per paragraph.
> • Zen mode — sidebar, header and suggestion chips gone in one keypress.
> • Set your reading width, font size and line height. No more cramped column.
> • Reading ruler, night dim, grayscale and reduce-motion for when the screen is
>   too much.
>
> **Focus**
> • Hide the input box so a finished answer stays finished (Ctrl/Cmd+Shift+H).
> • Auto-hide as you scroll up; it comes back when you reach the bottom.
> • Start typing and the composer returns instantly with your keystroke intact —
>   nothing is ever swallowed, and your unsent draft is kept while it's hidden.
> • Pomodoro with focus/break cycles, a quiet ring timer, and auto-Zen during
>   focus blocks.
> • Set an intention for the session, keep up to three first steps, and park a
>   stray thought (Ctrl/Cmd+Shift+K) instead of chasing it.
>
> **Quiet by design**
> A graphite monochrome interface, one small dock in the corner, and a tray that
> blooms out when you need it. No badges, no streak guilt, no confetti.
>
> **Privacy, stated plainly**
> Calm requests no Chrome permissions at all — its permission list is empty and
> it declares no host access, so it is technically incapable of contacting a
> server. There is no account, no sync and no network traffic. It has no
> analytics, no trackers, no ads and no third-party code, and it never reads,
> stores or transmits your conversations. Nothing leaves your browser, ever.
>
> Works on ChatGPT, Gemini and Claude.

**Category:** Productivity
**Language:** English

---

## 3. Privacy tab answers (exact)

**Single purpose statement** — paste verbatim:

> Calm modifies the on-screen reading and focus environment of supported AI chat
> websites (ChatGPT, Gemini, Claude): it hides or reveals the message composer,
> adjusts reading typography and width, provides a distraction-free reading pane
> for the current response, and offers optional focus timers. All of these serve
> the single purpose of making these pages easier to read and concentrate in.

**Per-permission justification** — one field each in the dashboard:

Calm declares **no permissions and no host permissions**, so the dashboard asks
for only one justification:

| Permission | Justification to paste |
| --- | --- |
| Content scripts on `chatgpt.com`, `gemini.google.com`, `claude.ai` | These are the three sites the extension adjusts. The content script reads page layout to find the composer and scroll container and applies styling. It does not read, collect or transmit conversation text, and the extension makes no network requests. |

**Data usage checkboxes**

- Personally identifiable information — **No**. The extension collects nothing.
- Everything else (health, financial, authentication info, personal
  communications, location, web history, user activity, website content) —
  **No**.
- Certify: data is **not** sold to third parties · **not** used for purposes
  unrelated to the single purpose · **not** used for creditworthiness/lending.

**Remote code:** No — all code is bundled in the package. No `eval`, no remotely
hosted scripts.

> Do not repeat the old "zero permissions, no network requests" line from previous
> drafts. It is no longer true, and a privacy claim that contradicts the manifest
> is a rejection.

---

## 4. Required assets

| Asset | Spec | Status |
| --- | --- | --- |
| Store icon | 128×128 PNG | ✅ `icons/icon128.png` |
| Screenshots | **1280×800** PNG, ×5 | ☐ see shot list |
| Small promo tile | **440×280** PNG | ☐ |
| Marquee promo tile | 1400×560 PNG | ☐ optional, only for featuring |
| Privacy policy URL | public link to `PRIVACY.md` | ☐ host it |

**Shot list — the five 1280×800 screenshots, in listing order:**

1. **Bloom tray open** — the dock pill expanded into the 3×3 tray over a real
   conversation, composer hidden. This is the product's face; it leads.
2. **Focus Reader, dark + RTL** — the pane open with bionic fixation on and a
   Hebrew paragraph showing correct right-to-left flow. The flagship feature and
   the one no competitor has.
3. **Pomodoro focus block** — expanded ring overlay with cycle dots, Zen active
   behind it.
4. **Intention card** — goal set, two of three micro-tasks done, the goal chip
   showing the open count.
5. **Settings panel, Reading tab** — the live typography sliders, showing depth
   without shouting.

Shoot 1–4 in the dark graphite theme, 5 in light, so the strip shows both.
Roadmap item A3 automates these via `tools/store-shots.js`; until it lands,
capture at exactly 1280×800 with the browser zoom at 100%.

---

## 5. Naming and trademark caution

The **name** avoids "ChatGPT"/"Gemini"/"Claude" — keep it that way. Naming them in
the **description** as supported sites is ordinary nominative use and is normally
fine. If review pushes back, soften to "popular AI chat sites" in the description
only; do not rename the extension.

Do not use OpenAI, Google or Anthropic logos, wordmarks or brand colors in any
screenshot chrome, the promo tiles, or the icon.

---

## 6. Submit

1. Upload the zip → 2. paste listing copy → 3. add the 5 screenshots + promo tile
→ 4. fill the Privacy tab (single purpose, all four justifications, data
checkboxes) → 5. add the privacy-policy URL → 6. **Submit for review**.

Calm requests no permissions and no host access, which is the profile that
attracts the **least** review friction. Reviews still take days rather than
hours, but there is no permission story to defend.

**Post-submission:** publishing to the store and cutting the `main`/tag release
are owner decisions. The daily automation never performs them.
