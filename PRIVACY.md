# Privacy Policy — Calm (Reading Mode for AI Chats)

_Last updated: July 2026_

Calm has **no permissions, no account, and makes no network requests**. There is
no server to send anything to. Everything the extension does happens inside your
own browser tab.

## What Calm never does
- It never stores or transmits the **content of your conversations**. The one
  place Calm touches conversation text at all is the **Focus Reader**, which —
  only when you open it — re-renders the latest response inside your own tab
  for easier reading. That copy lives in the page's memory only and is
  discarded the moment the pane closes. It is never persisted, logged, or sent
  anywhere.
- It contains **no analytics, no trackers, no ads, and no third-party code**.
- It makes **no network requests of any kind** — the extension declares no host
  permissions, so it is technically incapable of contacting a server.
- It never sells or shares data with anyone, because it never collects any.

## What stays on your device (always)
- **UI preferences** (modes, sliders, menu position) — `localStorage`.
- **Unsent draft text** while the input is hidden — `sessionStorage` (cleared
  when the tab closes).
- **Focus-panel data**: your intention and first steps are per-tab
  (`sessionStorage`); **parked thoughts persist on your device**
  (`localStorage`) until you delete them.
- **Focus-session log**: the duration of completed Pomodoro blocks, kept
  locally and capped at the last 500 entries. Never conversation content, never
  transmitted.

Clearing your browser data for a site removes all of it. There is no copy
anywhere else.

## Permissions, plainly
Calm requests **no Chrome permissions at all**. Its manifest declares an empty
permission list and no host permissions.

The only access it has is the content script itself, which runs on
`chatgpt.com`, `gemini.google.com` and `claude.ai` to adjust the on-screen
layout. No other sites.

## Contact
Questions or deletion requests: open an issue at
https://github.com/YonatanVol/calm-for-ai-chats
