# Changelog

All notable changes to Calm. Dates are release dates; the format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
