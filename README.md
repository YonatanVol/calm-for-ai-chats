# Calm — Reading Mode for AI Chats

A Chrome extension that makes **ChatGPT**, **Gemini**, and **Claude** calmer to
read and easier to focus in — built with ADHD-friendly workflows at its core and
a hand-crafted "Maison" design language (espresso, ivory, brushed gold, serif
details).

> Local-first: your conversations are never read or transmitted. Signing in for
> cross-device sync is optional — until you do, nothing leaves your browser.
> See [`PRIVACY.md`](PRIVACY.md) for the plain-language details.

---

## ✨ What it does

**Reading comfort**
- Hide the input bar for clean full-height reading (`Ctrl/Cmd+Shift+H`), with
  auto-hide as you scroll and instant reveal the moment you start typing —
  whatever you type lands in the input, nothing lost (RTL/Hebrew safe).
- **Zen mode** (`Ctrl/Cmd+Shift+Z`) — sidebar, header and suggestion chips gone.
- **Reading width**, **Reader typography** (font size / line height), and
  **Night/Dim** warmth overlay.

**Focus (ADHD-friendly)**
- **The Calm Dock** — one draggable pill with your 🎯 intention and timer status;
  expands into all controls.
- **Intention prompt** — "What did you come to do?" pinned as a goal chip, with
  up to 3 micro-tasks and a `Ctrl/Cmd+Shift+K` **thought parking lot**.
- **Pomodoro** — animated timer with presets (10/2 starter, 25/5, 52/17, 90/20),
  auto-Zen during focus, chime, and a screen-width progress bar.
- **Reading ruler**, **Grayscale**, **Reduce motion** — attention anchors and
  stimulation control.
- **Time awareness** — a gentle time-on-page chip and a hyperfocus nudge.
- **Presentation mode** (`Ctrl/Cmd+Shift+P`) — hide everything for clean
  captures; Esc exits.
- **Presets** — save and switch whole setups (Deep Reading, Study, Night Owl…).

**Optional account (off by default)**
- Google sign-in syncs your settings, presets, and focus stats across devices
  (Supabase, row-level security). The signed-out experience is fully local.

Works on `chatgpt.com`, `gemini.google.com`, and `claude.ai`.

---

## 🔒 Permissions, honestly

| Permission | Why |
| --- | --- |
| Content script on the 3 chat sites | Adjust the on-screen layout |
| `identity` | The optional Google sign-in popup |
| `storage` | Keep your session on your device |
| Supabase host access | Sync traffic — signed-in users only |

No analytics, no trackers, no conversation access. Ever.

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
