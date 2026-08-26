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

Calm requests **zero Chrome permissions**. `manifest.json` has no `permissions`
key and no `host_permissions` key — not empty ones, absent ones. Chrome grants
only what is asked for.

| What it has | Why |
| --- | --- |
| Content script on the 3 chat sites | Adjust the on-screen layout |

No analytics, no trackers, no account, no network. Ever.

---

## 🧩 Install

Calm is not on the Chrome Web Store yet, so it installs the way any extension
does before it is listed: you point Chrome at a folder. It takes about two
minutes and needs no tools — no `git`, no Python, no terminal.

1. **Download** the latest `calm-extension.zip` from
   [Releases](https://github.com/YonatanVol/calm-for-ai-chats/releases/latest),
   and unzip it. Keep the unzipped folder somewhere you will not delete by
   accident — Chrome loads it from that path every time it starts, so moving
   or deleting it uninstalls Calm.
2. Open **`chrome://extensions`** and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder you unzipped.
4. Open [ChatGPT](https://chatgpt.com), [Gemini](https://gemini.google.com) or
   [Claude](https://claude.ai). The Calm pill appears in the bottom-right
   corner. Press **⌘K** (or **Ctrl+K**) to see everything it can do.

**Chrome will warn you** that developer-mode extensions can be a security risk.
That warning is honest and worth taking seriously in general: an unpacked
extension is just a folder, and nobody has reviewed it. The reason to be
comfortable here is that this one asks for no permissions at all — you can
check that yourself on the `chrome://extensions` card before loading it, and
[`SECURITY.md`](SECURITY.md) shows how. Dismissing the warning is fine; getting
into the habit of dismissing it is not.

**To update**, download the new zip, replace the folder's contents, and click
the ↻ refresh icon on Calm's card. Your settings survive — they live in the
browser, not the folder.

### From a clone

If you have the repository:

```bash
python3 install.py
```

It validates the extension, builds the zip, copies the folder path to your
clipboard and opens `chrome://extensions`. Chrome 137+ removed the ability for
any script to click **Load unpacked** for you, so that last click is yours.

---

## ⌨️ Shortcuts

| Action | Shortcut |
| --- | --- |
| **Command palette** (everything) | `Ctrl/Cmd + K` |
| Toggle input | `Ctrl/Cmd + Shift + H` |
| Back to the start of the answer | `Ctrl/Cmd + Shift + J` |
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

## 🐛 Something wrong?

[Open an issue](https://github.com/YonatanVol/calm-for-ai-chats/issues/new/choose).
The three sites redesign themselves regularly, and when they do, Calm's
selectors can stop matching — the symptom is usually a mode that quietly does
nothing rather than an error. Saying which site and what you expected is
enough to act on.

For anything with a security dimension, see [`SECURITY.md`](SECURITY.md)
instead of the issue tracker.

## 📄 License

**Proprietary and source-available** — see [`LICENSE`](LICENSE). You may read
the code; copying, modifying, redistributing, or commercial use require written
permission. "Calm" is a trademark of the author.

© 2026 Yonatan Volsky. All rights reserved.
