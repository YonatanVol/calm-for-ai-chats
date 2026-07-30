# Calm — Reading Mode for AI Chats

A Chrome extension that makes **ChatGPT**, **Gemini**, and **Claude** calmer to
read and easier to focus in — built with ADHD-friendly workflows at its core and
a quiet graphite design language.

> **No permissions, no account, no network requests.** Calm declares an empty
> permission list, so it is technically incapable of contacting a server.
> Everything stays in your browser. See [`PRIVACY.md`](PRIVACY.md).

---

## ✨ What it does

**Reading comfort**
- Hide the input bar for clean full-height reading (`Ctrl/Cmd+Shift+H`), with
  auto-hide as you scroll and instant reveal the moment you start typing —
  whatever you type lands in the input, nothing lost (RTL/Hebrew safe).
- **Zen mode** (`Ctrl/Cmd+Shift+Z`) — sidebar, header and suggestion chips gone.
- **Focus Reader** — the response lifted into Calm's own reading pane: bionic
  fixation, dyslexia-friendly spacing, spotlight, full Hebrew/RTL support.
- **Reading width**, **reader typography** (font size / line height), and
  **Night/Dim** warmth overlay.

**Focus (ADHD-friendly)**
- **The Console** — one draggable pill, anchored to a corner so it can never
  open off-screen. It opens a single panel: a live timer tile, quick toggles,
  inline sliders, and an Advanced drawer that slides in rather than opening a
  second window.
- **Command palette** (`Ctrl/Cmd+K`) — every mode, action and setting in one
  keystroke; arrow keys nudge numeric settings in place.
- **Intention** — "What did you come to do?", with up to 3 first steps and a
  `Ctrl/Cmd+Shift+K` **thought parking lot**. It never opens by itself; you ask
  for it.
- **Pomodoro** — animated timer with presets (10/2 starter, 25/5, 52/17, 90/20),
  auto-Zen during focus, chime, and a screen-width progress bar.
- **Reading ruler**, **Grayscale**, **Reduce motion** — attention anchors and
  stimulation control.
- **Time awareness** — a gentle time-on-page chip and a hyperfocus nudge.
- **Presentation mode** (`Ctrl/Cmd+Shift+P`) — hide everything for clean
  captures; Esc exits.
- **Presets** — save and switch whole setups (Deep Reading, Study, Night Owl…).

Works on `chatgpt.com`, `gemini.google.com`, and `claude.ai`.

---

## 🔒 Permissions, honestly

Calm requests **zero Chrome permissions**. The manifest's permission list is
empty and there are no host permissions.

| What it has | Why |
| --- | --- |
| Content script on the 3 chat sites | Adjust the on-screen layout |

No analytics, no trackers, no account, no network. Ever.

---

## 🧩 Install

> **Note:** Chrome 137+ removed the ability for any script to auto-load an
> unpacked extension — the "Load unpacked" click must be yours. The installer
> does everything up to that click.

```bash
python3 install.py
```

It validates the extension, builds the store zip, copies the folder path to
your clipboard, and opens `chrome://extensions`. Then: enable **Developer
mode** → **Load unpacked** → paste the path (`⌘⇧G`, `⌘V` on macOS) → Select.

Chrome Web Store listing: coming soon (see [`STORE_LISTING.md`](STORE_LISTING.md)).

---

## ⌨️ Shortcuts

| Action | Shortcut |
| --- | --- |
| **Command palette** (everything) | `Ctrl/Cmd + K` |
| Toggle input | `Ctrl/Cmd + Shift + H` |
| Zen mode | `Ctrl/Cmd + Shift + Z` |
| Presentation mode | `Ctrl/Cmd + Shift + P` (Esc exits) |
| Thought parking lot | `Ctrl/Cmd + Shift + K` |

---

## 🛠️ Development

- `main` = stable releases · `develop` = integration · `fix/*`, `feat/*` = one
  branch per phase, merged `--no-ff` after verification.
- No build step: plain JS content scripts sharing a `window.CALM` namespace
  (`src/adapters.js` per-site selector layer; `src/modes.js` mode registry;
  `content.css` design-token system).
- `python3 install.py --zip` builds `dist/` for the Web Store.

## 📄 License

**Proprietary and source-available** — see [`LICENSE`](LICENSE). You may read
the code; copying, modifying, redistributing, or commercial use require written
permission. "Calm" is a trademark of the author.

© 2026 Yonatan Volsky. All rights reserved.
