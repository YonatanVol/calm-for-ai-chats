# Privacy Policy — Calm (Reading Mode for AI Chats)

_Last updated: July 2026_

Calm is local-first. **Your conversations are never read, stored, or transmitted.**
Signing in is optional; until you do, nothing leaves your browser.

## What Calm never does
- It never reads, stores, or transmits the **content of your conversations**.
- It contains **no analytics, no trackers, no ads, and no third-party code**.
- It never sells or shares data with anyone.

## What stays on your device (always)
- **UI preferences** (modes, sliders, dock position) — `localStorage`.
- **Unsent draft text** while the input is hidden — `sessionStorage` (cleared when
  the tab closes).
- **Focus-panel data**: your intention and micro-tasks are per-tab
  (`sessionStorage`); **parked thoughts persist on your device** (`localStorage`)
  until you delete them.

## Optional account & sync (only if you sign in)
Calm offers Google sign-in (via Chrome's `identity` permission) backed by Supabase.
If — and only if — you sign in:
- Your **email**, **settings**, **custom presets**, and **focus-session stats**
  (timestamps/durations — never conversation content) are stored in your own row
  of our Supabase database, protected by row-level security (only your
  authenticated account can read or write your row).
- Your session token is kept in `chrome.storage.local` on your device.
- Signing out stops all network activity; the extension remains fully functional
  offline and signed-out.

## Permissions, plainly
- `identity` — Google sign-in popup (only when you click "Sign in").
- `storage` — keeps your session on your device.
- Host access to our Supabase URL — sync traffic for signed-in users only.
- Content-script access to `chatgpt.com`, `gemini.google.com`, `claude.ai` —
  to adjust the on-screen layout. No other sites.

## Contact
Questions or deletion requests: open an issue at
https://github.com/YonatanVol/calm-for-ai-chats
