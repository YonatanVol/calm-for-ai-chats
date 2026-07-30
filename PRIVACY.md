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
- It makes **no network requests of any kind**. There is no `fetch`,
  `XMLHttpRequest`, `WebSocket`, `sendBeacon` or remote script anywhere in the
  source, and no analytics endpoint to call. (To be precise about *why*: a
  content script shares the page's origin, so having no host permissions is
  not by itself what prevents network access — the absence of any networking
  code is. The source is public; this is checkable.)
- It never sells or shares data with anyone, because it never collects any.

## What stays on your device (always)
- **UI preferences** (modes, sliders, menu position) — `localStorage`.
- **Unsent draft text** while the input is hidden — `sessionStorage` (cleared
  when the tab closes).
- **Focus-panel data**: your intention and first steps are per-tab
  (`sessionStorage`); **parked thoughts persist on your device**
  (`localStorage`) until you delete them.
- **Focus-session log**: for each finished, skipped or ended Pomodoro block,
  its length in minutes, a timestamp and which of the three sites you were on.
  Capped at the last 500 entries. Never conversation content, never
  transmitted.

Clearing your browser data for a site removes all of it. There is no copy on
any server.

### One honest caveat about where "on your device" lives
Browser extensions of this kind store their data in the **website's own
storage area**. That keeps it on your machine and off any server — but it also
means the site you are visiting (chatgpt.com, gemini.google.com, claude.ai)
can technically read it with its own JavaScript, the same way it can read
anything else it stores there.

For settings and window positions this is uninteresting. It matters for one
thing: **parked thoughts and your stated intention are text you typed into
Calm rather than into the chat**, so they are the only data here the site
would not otherwise have. If you would not want a note visible to the site
you are on, do not park it. We would rather say this plainly than let the
phrase "stays on your device" imply more privacy than it delivers.

## Permissions, plainly
Calm requests **no Chrome permissions at all**. Its manifest declares an empty
permission list and no host permissions.

The only access it has is the content script itself, which runs on
`chatgpt.com`, `gemini.google.com` and `claude.ai` to adjust the on-screen
layout. No other sites.

## Contact
Questions or deletion requests: open an issue at
https://github.com/YonatanVol/calm-for-ai-chats
