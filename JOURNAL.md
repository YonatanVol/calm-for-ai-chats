# Calm — engineering journal

One dated entry per working session (the daily improvement task appends here).
What shipped, what was verified, what's next. Facts only.

## 2026-07-27 — session
- PA `fix/review-criticals`: pomodoro/pause survive SPA nav, honest stats, popover
  registry, truthful docs, v3.0.0.
- PB `feat/bloom-engine`: corner-anchored dock — off-screen geometrically
  impossible; 3×3 Bloom tray; then the tray + intention-card redesigns.
- `feat/quiet-palette`: gold removed entirely — quiet graphite system
  ("luxury = smooth, not bling"). Both themes verified by headless render.
- `tools/harness.js`: 47-check merge gate committed (now 57 with Focus Reader).
- `feat/focus-reader`: the Calm-owned reading pane — bionic fixation
  (20–60% slider), Ease (dyslexia spacing), Spotlight (block dimming,
  arrow-key navigation), per-block RTL via dir=auto, sanitized cloning
  (attributes stripped, links vetted), Esc to close. PRIVACY.md updated
  truthfully. Adversarial review workflow run before merge.
- Ops: daily scheduled task `calm-daily-improvement` (09:00) created;
  growth-audit workflow launched (feature tree → ROADMAP.md → GTM checklist).

## 2026-07-29 — daily improvement

- Shipped A1 `auto/daily-20260729`: STORE_LISTING.md rewritten from scratch.
  The old copy was actively false — it advertised "zero permissions, no network
  requests" and two sites, written before auth/sync and Claude support landed.
  Submitting on it would have contradicted the manifest at review.
- New listing: 3 sites, Focus Reader led as the flagship, quiet-graphite
  positioning, honest optional-sign-in story, CWS single-purpose statement,
  a per-permission justification table (identity / storage / Supabase host /
  content-script matches), data-usage checkbox answers, and the ordered 5-shot
  1280×800 list feeding roadmap item A3. Also corrected the review-time
  expectation: `identity` + a host permission means a normal review, not the
  fast path the old file promised.
- Every claim checked against source, not memory: shortcuts (H/Z/P/K) read from
  core.js + intent.js, bionic range 20–60 from reader.js, 3-task cap from
  intent.js, permissions from manifest.json. Drafted summary was 108 chars, not
  the 121 first written — counted and corrected.
- Verified: `node --check` 18/18 src files · content.css braces 261=261 ·
  `node tools/harness.js` 57/57 (incl. 3-host load smoke for chatgpt.com,
  gemini.google.com, claude.ai) · `python3 install.py --zip` exit 0, 59.2 KB,
  no `_`-prefixed / .pem / .DS_Store entries.
- Note: the task file's smoke list names 16 content scripts and omits
  reader.js; the manifest ships 17. The harness reads the real manifest order,
  so the gate is correct — the checklist is the stale one.
- Roadmap: A1 checked off. Added a C-tier doc-drift item (README stale,
  FEATURES.md still says 16 scripts) with a harness assertion so the count
  can't silently drift again.
- Next: A2 onboarding first-run tour (3 quiet cards over the dock).

## 2026-07-30 — v3.1 menu rebuild

Owner asked for a menu redesign (chose the Console from five rendered options),
for the floating "What did you come to do?" card to stop appearing, and for a
subtraction pass. Five phases, each harness-gated and merged to develop.

- Pre-step: rescued the 2026-07-29 daily run, which wrote and verified
  STORE_LISTING.md but never reached its commit step. The daily task needs a
  "tree must be clean at exit" check.
- P1 strip-network: deleted auth.js, sync.js, background.js and config.js
  (547 lines gating nothing; config.js was injecting a Supabase anon JWT into
  every page for no reader). Manifest now declares NO permissions and no host
  access. Focus logging kept, moved local (CALM.stats). Intention auto-open
  removed — it was calling .focus() 2s after load and eating the first thing
  typed in a fresh tab.
- P2 mode-registry: `surface` field on every mode; the 12-id array that was
  copy-pasted into two files is gone; `reader` folded into settings so
  "Reader" means only the pane.
- P3 console: bloom tray + modes popover + settings panel -> one panel with an
  in-place Advanced drawer. Corner-anchor engine untouched.
- P4 palette: ⌘K over a derived list (modes from the registry, settings from
  defaultSettings), arrows nudge numbers in place.
- P5 polish: showToggleButton persistence, preset coverage 10/37 -> all,
  dockQuiet exposed, one Escape STACK (registering at load order gets topmost
  exactly backwards), nags moved below the reader pane.

Harness 57 -> 87 checks. Two new tests failed first and both were real: the
Escape ordering, and a stub bug where innerHTML="" did not clear children, so
re-render tests were reading stale nodes. Fixed the stub, not the assertion.

Verified: 87/87 · three hosts init with NO chrome API present at all ·
install.py --zip clean · Console and palette rendered headlessly in dark and
light and reviewed before merging.

## 2026-07-30 (later) — full code review + the clipped-label bug

Owner reported the Console's live tile rendering its label as an unreadable
sliver, and asked for a full review plus more design options.

- **Root cause of the visual bug: no CSS isolation.** Calm's UI inherited
  typography from the host page; `.cit-live-idle` combined `overflow:hidden`
  with an inherited line-height, so a small host line-height collapsed the line
  box and clipped the glyphs. Found by building a 12-case host-interference
  matrix and rendering it headless — case 11 reproduced the screenshot exactly.
  Fixed with a `:where()` (zero-specificity) reset over all Calm chrome. The
  same matrix caught a second bug: under `dir=rtl` the whole Console mirrored
  and the bidi scrambled the sub-line. Chrome is now pinned LTR; the reader
  keeps per-block bidi; user text carries dir=auto.
- **Three reviewers** (correctness, CSS, security/architecture) produced 18
  confirmed defects. Six were MAJOR and reproducible, including a Presentation
  mode that became an unrecoverable trap with shortcuts off, a Pomodoro preset
  that wiped two thirds of the Advanced drawer, and presets that silently
  failed to apply typography. All fixed, each with a regression test.
- **The sanitizer was a denylist with zero tests** — the one security-critical
  function in the codebase. Rewritten as an allowlist that REBUILDS the tree
  from elements we create, plus tools/sanitizer-test.html: 16 real attacks in a
  real browser, 16/16 passing.
- **Privacy corrections.** The policy's central technical claim was false in
  its reasoning (no host permissions does not prevent same-origin fetch), and
  it omitted that extension storage lives in the site's storage area — which
  matters for parked thoughts specifically. Both corrected. Backend plans moved
  to docs/future/ so the repo stops contradicting the listing.

Harness 87 -> 121 checks. manifest 3.1.0. Zip 60.4 KB.

## 2026-07-30 (later still) — the Margin, and a regression I shipped

- **H · Margin built.** Controls as marginalia in the empty gutter beside the
  text: no card, no border, 20% opacity at rest, waking on approach. Built as a
  presentation of the dock (rail replaces the pill inside #cit-dock) so the
  Console, popover registry, Escape stack and palette are untouched. The gutter
  is measured, never assumed, and below 76px the dock falls back to the corner
  pill on its own. Setting: Advanced -> Menu style.
- **The CSS review caught a regression from my own host-isolation fix.**
  `color:` on a descendant inside a :where() reset is still a DECLARATION, and
  a declaration beats inheritance — so every icon inside an active control was
  painted with the base ink on top of the active fill. White on white, both
  themes, every toggle. Verified by measuring computed styles, not by eye.
  Typography and colour now sit on the reset's roots only.
  Lesson: zero SPECIFICITY is not zero EFFECT. Added tools/contrast-test.html
  so a cascade bug like this fails a suite instead of shipping.
- Also fixed from that review: a selector with no declaration block that was
  swallowing the next rule, an !important that had silently killed the
  Pomodoro break ring, three uses of --cit-gold as a background under ink
  (1.42:1 -> 10.19:1), a Console with no max-width, and a responsive block
  still aimed at a panel deleted in v3.1.
- Second stub lie fixed: remove() forgot only its own id, so descendants stayed
  findable after detachment and teardown tests passed falsely.

Harness 121 -> 144. Browser suites: sanitizer 16/16, contrast 7/7.
