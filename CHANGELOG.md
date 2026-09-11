# Changelog

All notable changes to Calm. Dates are release dates; the format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] — 2026-09-11

### Added

- **↓ beside ↑ on the Answer tile** (`Ctrl/Cmd+Shift+E`, or ⌘K). ↑ goes to
  the start of the answer above you; ↓ to the start of the next one below,
  or the very end when there is none. They walk the conversation in both
  directions and are exact inverses, and pressing twice before a smooth
  scroll lands still moves two answers. After you scroll by hand, the next
  press starts from where you are rather than from where the last walk left
  off — which ↑ used not to do.
- **Auto-scroll is a player now.** A small dial floats over the page: tap to
  pause and resume, double-tap to jump to the start of the next answer, drag
  around the ring or spin the wheel over it to change speed. Hover it and a
  strip unfolds with a **style** — *Glide* (continuous), *Lines* (one line at
  a time), *Answers* (one answer, then a pause long enough to read it) — and
  a **speed** — Slow, Read, Skim — with a live readout relative to Read.
  `Ctrl/Cmd+Shift+S` starts and stops it; while it runs, **Space is play/pause**
  and `Esc` stops it. It notices when you take the wheel — scrolling, arrow
  keys, PageDown, or hiding the tab all pause it — and it never resumes on its
  own. It eases in when it starts and out when it stops, moves on animation
  frames with sub-pixel accumulation so slow speeds drift rather than stutter,
  stops exactly at the end of the conversation and lets itself out a few
  seconds later. Switching conversations stops it rather than gliding from the
  top of one you just opened.

### Fixed

- Auto-scroll read its scroll container once and kept it, so after the first
  navigation it silently did nothing. It now reads the page fresh every frame.
- Two fixes that had been waiting on `develop`: ✕ in the parking lot deleted
  the row you pressed rather than the thought you pressed, and a mode Calm
  borrowed for you (Zen during focus) is given back while one you chose is
  left alone.

### Changed

- Auto-scroll speed is measured in pixels per second (20–300) instead of
  "pixels per tick". Existing settings migrate: the old default lands on Read.
- Auto-scroll moved from the Advanced drawer to the Console's mode row.

### Internal

- Suite 444 → 484. The test world now has animation frames and a clock
  (`world.frame(ms)`) and records long timers so a scenario can say "four
  seconds later". Ten mutations of the player each fail by name.

## [3.2.1] — 2026-08-26

Follow-up from reading the 3.2.0 diff back as a reviewer.

### Fixed

- The intention card can no longer get stuck open if its closer goes missing.
- A width or text size set from ⌘K to a value the menu does not offer now shows
  as its own value instead of highlighting a different one — opening the
  settings drawer could otherwise change a setting you never touched.

### Internal

- The menu's offered values and ⌘K's ranges are now required to agree.
- Suite 430 → 438.

## [3.2.0] — 2026-08-26

The first release meant to be installed by someone who did not write it.

### Added

- **Back to the start of the answer** (`Ctrl/Cmd+Shift+J`, a menu tile, or
  ⌘K). A long answer finishes and the view is parked at its end, because that
  is where the streaming left you. This puts you on its first line. Press again
  to walk back through earlier answers; it stops at the first rather than
  wrapping round to the bottom.
- **Chat spotlight** — everything above the exchange you are in recedes, and
  hovering a dimmed turn brings it back.

### Changed

- **The settings menu has no sliders.** Seventeen rows instead of thirty-six,
  all switches and named choices. A slider asks you to pick a number, which
  requires already knowing what the numbers mean; "Ruler dim 45%" tells you
  nothing until you have tried it. Every number is still adjustable in ⌘K,
  where the arrow keys change it while the effect is on screen.
- **Switches invert instead of tinting**, so on and off are unmistakable at a
  glance. Contrast is measured, not guessed: 10:1 and 11.4:1 between states.
- **The "input hidden" hint appears once a week, not once a scroll.** The first
  one teaches you where the input went; the fiftieth is movement at the edge of
  your vision, which is what this extension exists to remove.
- The pill's hover shimmer is gone.

### Fixed

- **Space scrolls the page again while the input is hidden.** Type-ahead
  treated any single-character key as the start of a message, and a space is a
  single character — so pressing space to page down opened the composer with a
  space in it instead. This was the default configuration, and it broke the
  exact activity the input is hidden for.
- **The composer remembers *why* it was hidden.** A hide Calm chose can be
  undone by scrolling to the bottom; a hide you asked for cannot. Only the fact
  of being hidden survived a navigation, so a restored auto-hide became
  permanent until you found the shortcut.
- **The "where was I" card no longer outlives its conversation.** Its jump
  button holds a scroll position measured in the conversation you left.
- **Nothing pops over a presentation** except the note telling you how to exit.
  The hyperfocus nudge fires on a timer and did not care what you were doing.
- **The intention card releases what it takes.** Two leaks: a navigation closed
  it without releasing its Escape handler, and toggling it shut left a
  document-wide click listener bound — one more on every click, for the life of
  the tab.
- **Every control is announced properly.** The dropdowns, the switches and the
  mode rows had no accessible names, and mode rows had no state at all: with a
  screen reader the settings drawer was a list of anonymous buttons.
- **An idle tab is idle.** The dock's status line wrote to the page once a
  second whether or not anything had changed.

### Internal

- Scenario suite 212 → 423 checks, run in CI on every push.
- New derived rules that fail for the *next* omission rather than the one that
  prompted them: every mode must hand the page back, every surface must let go
  of the stacks it pushed onto, every adapter must answer the contract the
  engine assumes, every setting must be reachable, every control must be named.
- The "no gold in the palette" check was a denylist that had been passing for
  months while the pill shimmered a gold written in decimal rather than hex. It
  now measures chroma, so the colour is caught in any notation.

## [3.1.0] — 2026-07-30

- One menu. The bloom tray, the modes popover and the tabbed settings panel
  became a single Console with an Advanced drawer.
- Command palette (`Ctrl/Cmd+K`) over every mode, action and setting.
- Zero permissions: sign-in, cloud sync and the config that shipped an API key
  into every page were deleted outright. The manifest's permission list is
  empty, so the extension is incapable of contacting a server.
- Focus Reader hardened: the sanitizer became an allowlist with a browser suite
  of sixteen real attacks.
- The intention card no longer opens by itself.

## [3.0.0] — 2026-07-27

- Focus Reader, the quiet graphite palette, the corner-anchored dock, and
  `tools/harness.js` as a merge gate.
