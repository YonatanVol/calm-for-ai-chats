# Calm — Reading Mode for AI Chats

A lightweight Chrome extension that makes **ChatGPT** and **Gemini** calmer to read. Hide the input box for distraction‑free reading, switch on Zen mode, widen the cramped column, and more — all **local, with zero permissions and zero network calls**.

> Your conversations never leave your browser. The extension makes no network requests and reads no chat content.

---

## ✨ Features

- **Hide the input** — toggle the composer away for a clean reading view (button, or `Ctrl/Cmd + Shift + H`).
- **Auto‑hide on scroll** — scroll up to hide the input, reach the bottom to bring it back. Tunable sensitivity.
- **Zen mode** — hide the sidebar, header, and suggestion chips in one keypress (`Ctrl/Cmd + Shift + Z`).
- **Reading width** — widen or narrow the conversation column to taste.
- **Remember state** — optionally keep your hidden/Zen choice across page loads (per site).
- **Quick scroll** — jump to top/bottom while the input is hidden.
- **Draft‑safe** — anything you've typed is preserved while the input is hidden.
- **Light & dark** aware, responsive, and works across conversation switches (SPA‑aware).

Works on `chatgpt.com` and `gemini.google.com`.

---

## 🔒 Privacy & permissions

- **No permissions requested** in the manifest — only a content script on the two supported sites.
- **No network requests, no analytics, no external resources.**
- **Never reads conversation content** — it only touches the composer input (to preserve your draft) and toggles visibility.
- Draft text lives in `sessionStorage` (dies with the tab). UI preferences live in `localStorage`.

---

## 🧩 Install

### One command (no "Load unpacked")

Fetches Calm from GitHub and loads it straight into your Chrome — your real
profile, your logins:

```bash
curl -fsSL https://raw.githubusercontent.com/YonatanVol/calm-for-ai-chats/main/install.py | python3 - --auto
```

Or inside a checkout:

```bash
python3 install.py --auto
```

> **What to expect:** Chrome relaunches with Calm loaded and shows a
> "developer mode extensions" banner (normal for sideloaded extensions). The
> installer also writes a reusable launcher (`~/.calm-for-ai-chats/calm-chrome.command`
> on macOS) so you can start Chrome with Calm anytime.
>
> Chrome **intentionally** blocks fully‑silent, permanent installs of
> non‑store extensions — the only one‑click, banner‑free path is the
> **Chrome Web Store** (below).

Other flags:

```bash
python3 install.py           # build a .zip + print manual steps
python3 install.py --zip     # just build the Web-Store zip
python3 install.py --launch  # try it in a throwaway demo profile
python3 install.py --open    # open chrome://extensions
```

### Manual (unpacked)

1. Open `chrome://extensions` → enable **Developer mode** (top‑right).
2. **Load unpacked** → select this folder.

### Chrome Web Store

Coming soon — the one‑click, permanent install for everyone. See
[`STORE_LISTING.md`](STORE_LISTING.md) for the submission guide and
[`PRIVACY.md`](PRIVACY.md) for the privacy policy.

---

## ⌨️ Shortcuts

| Action | Shortcut |
| --- | --- |
| Toggle input | `Ctrl/Cmd + Shift + H` |
| Toggle Zen mode | `Ctrl/Cmd + Shift + Z` |

Open the **⚙ settings** button (bottom‑right) for sliders and toggles.

---

## 🛠️ How it works

Built as a single content script with a small **site‑adapter** layer, so one codebase serves both ChatGPT and Gemini. The chat apps are React/Tailwind (ChatGPT) and Angular (Gemini); hiding is done with the one mutation that reliably sticks (`display:none`), and scroll detection uses a single capture‑phase listener so it works no matter which element the page actually scrolls.

```
manifest.json   # MV3, zero permissions, matches chatgpt.com + gemini.google.com
content.js      # adapters + all logic
content.css     # UI for the floating controls & settings panel
icons/          # extension icons
```

---

## 🗺️ Roadmap

- One‑time and subscription Pro tier (the entitlement seam is already in place).
- More surfaces (Claude, others).
- Themes, line‑spacing and font controls.

---

## 📄 License

**Proprietary and source-available** — see [`LICENSE`](LICENSE). You may read the
code for evaluation; copying, modifying, redistributing, or commercial use are
not permitted without written permission. "Calm" is a trademark of the author.

© 2026 Yonatan Volsky. All rights reserved.
