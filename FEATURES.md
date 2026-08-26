# Calm — feature tree

Generated from a full-code audit (2026-07-27), updated after the 2026-07-30
v3.1 menu rebuild. ✅ shipped · ◐ partial · ○ stub.

**What changed in v3.1:** the bloom tray, modes popover and tabbed settings
panel were replaced by a single **Console** (`src/console.js`) with an in-place
Advanced drawer, plus a **⌘K command palette** (`src/palette.js`). Sign-in and
cloud sync were deleted — the extension now declares **zero permissions** and
makes **no network requests**. `reader` is no longer a mode (its typography is
a setting); modes now declare a `surface` so every list derives from the
registry. Entries below marked ⛔ describe surfaces that no longer exist.
Newest addition: the **Focus Reader** pane (bionic fixation, Ease, Spotlight, RTL) — post-audit, listed under Modes.

## Core engine (36)
- **Composer engine**
  - ✅ Instant composer hide/show — Hides/shows the chat composer via inline style.setProperty
  - ✅ Manual toggle (Ctrl/Cmd+Shift+H) — manualToggleComposer wired to a capture-phase keydown handler with preventDefault+stopPropagation; also exported on CALM.core for the toggle
  - ✅ Scroll-lock grace period — Engine guarantee: every hide/show calls lockScroll
- **Scroll auto-hide**
  - ✅ Auto-hide on upward scroll (sensitivity 1-10) — Accumulated upward-scroll pixels
  - ✅ Bottom-guard + auto-reveal at bottom — Never auto-hides within BOTTOM_THRESHOLD
  - ✅ Dynamic scroll-container acquisition — One capture-phase passive scroll listener on document; whichever qualifying element
  - ✅ Excluded-scroller list — isExcludedScroller blocks auto-hide from sidebar/panel scrollers: Gemini bard-sidenav/conversations-list, ChatGPT stage sidebars, generic na
  - ✅ Adapter scrollRoot discovery + retry loop — discoverScroll asks site.scrollRoot
  - ✅ Pause-mode suspension of auto-hide — rt.paused
- **Draft preservation**
  - ✅ Draft save on hide (sessionStorage) — saveDraft snapshots the prompt input
  - ✅ Draft restore with kept-text short-circuit — On show, restoreDraft first checks whether the input retained its text through display:none
  - ◐ insertIntoInput native-editing pipeline — Inserts text through focus + select-all + collapse-to-end + document.execCommand
- **Type-ahead**
  - ✅ Type-ahead: auto mode (instant reveal) — First printable key while hidden reveals the composer and types the character live via revealAndInsert; the v3 default
  - ✅ Type-ahead: buffer mode + chip — Keystrokes accumulate silently in rt.pendingText with a visible chip
  - ✅ Type-ahead: both mode (legacy) — First key buffers + shows chip, second key
  - ✅ Type-ahead capture guards — Capture-phase keydown
  - ✅ Flush-on-reveal continuity guarantee — showComposer always runs restoreDraft then flushTypeAhead, so any pending buffer lands after the restored draft with the caret at the end an
- **SPA lifecycle**
  - ✅ SPA navigation detection — A MutationObserver on document.body
  - ✅ Composer-death detection and re-init — The same observer notices when a React re-render removed rt.composerEl from the body
  - ✅ Full teardown resetState (ghost prevention) — On nav: snapshot Pomodoro/Pause timers, close popovers via their own close
  - ✅ Mode re-entry + timer resume across navs — Active modes are remembered
  - ✅ Generation-token init loop — rt.initGen increments per init; the async composer-discovery loop
  - ✅ UI-first init (never button-less) — ui.createUI
  - ✅ Deferred zen-composer honor — If Zen
- **Site adapters**
  - ✅ Site-adapter contract — Each ADAPTERS entry supplies id, host regex, composer
  - ✅ ChatGPT adapter — Composer via #thread-bottom-container / #composer-background / form-of-input; input via #prompt-textarea then ProseMirror/contenteditable/te
  - ✅ Gemini adapter — Angular custom elements
  - ✅ Claude adapter — Live-probed 2026-07
  - ✅ Safe DOM helpers — q
- **Engine**
  - ◐ Entitlement seam for pomodoro (free tier) — mode:pomodoro is declared 'free' in FEATURE_TIERS and CALM.isPro
  - ✅ Nav-teardown timer hygiene — The pomodoro interval registers in rt.modeTimers.pomodoro so the generic core.js sweep clears it
- **Internal / engine**
  - ○ Entitlement gating (quickNav) — updateQuickNav consults CALM.entitled
- **Mode engine**
  - ✅ Mode registry and lifecycle engine — Central MODES map of 11 modes
  - ✅ Remember-state persistence of active modes — Every enter/exit calls persist
  - ✅ Live slider re-application (refreshVars) — refreshVars
  - ✅ Unsupported-site guard — Both modules bail immediately when CALM.site is unset

## Modes (16)
- **Modes**
  - ✅ Zen mode — Stylesheet-first hide of site chrome gated on html.cit-zen, plus an inline display:none!important fallback path
  - ✅ Reader mode (typography) — Prefixes site.readerTargets
  - ✅ Night / Dim mode — Appends a #cit-night-overlay div directly under documentElement
  - ✅ Privacy / Share mode (sidebar blur) — Blurs site.privacyTargets
  - ✅ Presentation / Screenshot mode — Adds html.cit-presentation
  - ✅ Auto-scroll (teleprompter) — 60ms setInterval adds max
  - ✅ Pause / Snooze auto-hide — Sets rt.paused, shows a live mm:ss countdown chip, and auto-exits after S.pauseMinutes; deliberately resumes the ORIGINAL end timestamp acro
  - ✅ Reading ruler (ADHD attention anchor) — A #cit-ruler overlay band follows the cursor via a passive mousemove listener; giant box-shadows
  - ✅ Grayscale mode (stimulation regulation) — Applies filter:grayscale
  - ✅ Reduce motion mode — Forces animation-duration/transition-duration to 0.001s on all elements
  - ◐ Pomodoro mode (delegation shell) — enter/exit delegate entirely to CALM.pomodoro.start/stop
- **Typography**
  - ✅ Reading width — Persistent
- **Presets**
  - ✅ Built-in presets — Five builtins — Default, Deep Reading
  - ✅ Custom presets (save / delete) — saveCurrent
  - ◐ Preset settings snapshot coverage (PRESET_KEYS) — The snapshot whitelist covers width, sensitivity, reader, night, autoscroll, pause, zenComposer, typeAhead, autoHideOnScroll — but not every
  - ✅ Preset apply / mode reconciliation — apply

## Focus & ADHD suite (20)
- **Pomodoro**
  - ✅ Pomodoro timer engine (focus / break / long-break cycles) — Full cycle state machine in src/pomodoro.js: configurable focus/break/long-break minutes and cycle count
  - ✅ Compact floating timer widget (SVG ring + MM:SS) — 46px animated stroke-dashoffset ring with time, phase label, and an 'expand' hint
  - ✅ Full-screen focus overlay (large ring, cycle dots, controls) — Expanded card
  - ✅ Auto-Zen with ownership tracking (enteredZen) — Focus blocks auto-enter Zen only when Zen is not already user-enabled, remember that they own it
  - ✅ Visual time bar (time as a shape) — Thin full-width progress bar
  - ✅ SPA-navigation resume (block survives host re-render) — core.js resetState
  - ✅ Pomodoro settings surface — All engine knobs are user-visible in the settings panel
- **Intention**
  - ✅ Intention prompt (once per tab) — 'What did you come to do?' panel auto-opens 2s after first load, once per tab
  - ✅ Goal chip (floating / dock / hidden modes) — Pinned goal chip with open-task count
  - ✅ Focus panel (intention card) — One popover owning goal input
  - ✅ Micro-tasks (max 3 first steps) — Up to three tiny checkbox tasks with add/toggle/delete, an 'n/3' meter, and an open-count reflected in the goal chip; deliberately a working
  - ✅ Thought parking lot (Ctrl/Cmd+Shift+K) — Global capture-phase hotkey
  - ✅ Intent programmatic API — CALM.intent exposes state, setGoal, addTask
- **Wellness**
  - ✅ Time-on-page chip — From minute 5, a chip shows '
  - ✅ Hyperfocus nudge (stretch/water reminder) — Every hyperfocusMin minutes
  - ✅ minutesOnPage API — CALM.wellness.minutesOnPage
- **Audio**
  - ✅ Synthesized end-of-phase chime (Web Audio, zero assets) — playChime
  - ✅ Audio unlock on starting gesture — CALM.audio.unlock
  - · Spotify / streaming audio integration — Referenced only in the audio.js header comment
- **Stats**
  - ◐ Focus stats logging ('stats honesty': elapsed minutes only) — logElapsed

## Interface (Maison graphite) (36)
- **Bloom dock**
  - ✅ Corner-anchored dock pill (Bloom engine) — Single Maison pill positioned by {corner, dx, dy} rather than absolute left/top, so it stays glued through resizes and the 3×3 tray geometri
  - ✅ Position persistence with v1→v2 migration — loadPos reads cit-dock-pos, auto-migrates the old {left,top} shape to {corner,dx,dy} via migrateV1 and re-saves; defaults to bottom-right 20
  - ✅ Drag-to-corner snap — Pill drags via the shared engine with an onDrop override; on release, nearestCorner picks the quadrant by rect midpoint and applyPos re-anch
  - ✅ 3×3 bloom grid with radial stagger — Nine tiles
  - ✅ Engraved lid + pill live status — The tray head shows 'CALM' in tracked serif caps until there is live status
  - ✅ Dock auto-collapse — Open tray auto-folds after 6s of inactivity when dockAutoCollapse is on; every tile click bumps the timer
  - ✅ Quiet pill (fade while typing) — Typing inside the composer fades the closed pill to 0.35 opacity; it wakes when the pointer comes within 120px, after 4s, or on click
  - ✅ Outside-click / Escape collapse (no close tile) — Capture-phase document click outside the dock and an Escape keydown both fold the bloom; a dedicated CLOSE cell was deliberately omitted
  - ✅ Quick-nav Top/End tiles (dim, never hide) — Top/End scroll tiles dim via .cit-tile-dim instead of hiding so the 3×3 grid never gets holes; shown only when composer is hidden, a scroll 
  - ✅ Composer-toggle tile icon rotation — The Input tile's chevron rotates 180° via body.cit-composer-hidden #cit-toggle-btn .cit-icon
- **Settings panel**
  - ✅ Tabbed settings panel (6 tabs) — Floating panel with Modes / Reading / Behavior / Presets / Account / About tabs, built entirely in DOM APIs
  - ✅ Panel dragging with persisted position — Panel is draggable by its header via the shared drag engine, persists to localStorage key cit-panel-pos, and springs from the dock
  - ✅ Modes tab (11 mode toggles + per-mode settings) — Rows for zen/reader/ruler/night/gray/motion/privacy/presentation/autoscroll/pause/pomodoro with Maison icons, plus auto-scroll speed, pause 
  - ✅ Reading tab (typography/visual sliders) — Seven live-apply sliders — reading width, reader font %, line-height, night dim, ruler height/dim, grayscale — each wired to CALM.modes.appl
  - ◐ Behavior tab — Auto-hide, sensitivity, zen-composer link, type-ahead mode select, remember-state, quick-nav, shortcuts, toggle-button visibility, hints, in
  - ✅ Reset positions button — Clears cit-dock-pos / cit-intent-pos / cit-pomo-pos / cit-panel-pos, wipes inline styles on the four movable elements, rebuilds the dock, co
  - ✅ Presets tab — Lists built-in and user presets with Apply
  - ✅ Account tab (Google sign-in / sync) — Sign in with Google via CALM.auth, signed-in state with email + sign-out, graceful 'Sync isn't available' fallback when the auth module is a
  - ◐ About tab — Static brand card: name, tagline, privacy promise
  - ✅ Settings control kit (toggleRow / sliderRow / selectRow / divider) — Reusable row builders bound directly to CALM.settings with optional after-callbacks; exported on CALM.ui for other modules
- **Popover registry**
  - ✅ Popover registry + SPA-nav teardown — Every popover registers its close
  - ◐ Generic outside-click/Escape closer (closeOnOutsideOf) — Shared closer that removes the popover on outside click or Escape, deferred one tick so the opening click doesn't self-close, and auto-unreg
  - ✅ Flip-aware popover placement (placeNearDock) — Popovers open inward from the dock's vertical half, flip when they would leave the viewport, and clamp to an 8px margin as last resort
  - ✅ Modes quick-popover — Two-column grid of 11 mode cards with Maison icons and live on-state, plus an 'All settings →' escape hatch into the full panel
- **Draggables**
  - ✅ Shared drag engine (makeDraggable) — Pointer-based dragging with 5px threshold
  - ✅ Post-drag click swallowing — After a real drag, a one-shot capture-phase click blocker prevents the drop from triggering the element's click action
- **Toasts & chips**
  - ✅ Toast system — Singleton pill toast with 5s throttle
  - ✅ Type-ahead chip — While typing into a hidden composer, shows a pulsing dot, 'typing…', the last 24 chars of the buffer
  - ✅ Generic status chip stack — showChip/hideChip manage id-keyed pills in a fixed column
- **Icon set**
  - ✅ Maison SVG icon set — 22 hand-drawn inline SVGs on a 24px grid, 1.5px stroke, stroke=currentColor, plus a serif-C double-ring monogram and a per-mode lookup map; 
- **Design tokens**
  - ✅ Graphite design-token system (dark + light) — Full custom-property palette on html with a light-theme override block keyed on html[class*="light"] / [data-theme="light"]; surfaces, inks,
  - ◐ Pill hover shimmer — A slow diagonal sheen sweeps the pill on hover via background-position transition
  - ◐ Reduced-motion support — @media
  - ✅ Finishing-layer cascade — A 'Maison finishing layer' appended at the end of content.css restyles tabs
  - ✅ Presentation-mode chrome hiding — html.cit-presentation display:none's every Calm surface
  - ◐ Responsive adjustments — Under 480px the settings panel goes full-width and the toast wraps and repositions

## Platform & account (21)
- **Auth**
  - ✅ Google sign-in via chrome.identity + Supabase OAuth — background.js runs launchWebAuthFlow against Supabase /auth/v1/authorize?provider=google, parses tokens from redirect hash or query, fetches
  - ✅ Session persistence + silent refresh — Session lives in chrome.storage.local
  - ✅ Content-script auth bridge (CALM.auth) — src/auth.js exposes session
  - ✅ Worker-proxied PostgREST requests (calm-db) — All Supabase REST I/O routes through the service worker to sidestep MV3 content-script CORS; anon key + bearer token attached, JSON/text fal
  - ✅ Account tab (sign in / sign out UI) — Settings panel Account tab renders signed-in identity
- **Cloud sync**
  - ✅ Debounced offline-first settings sync — CALM.saveSettings is wrapped to mark a dirty flag; a 1.5s debounce flushes a whole-document upsert
  - ✅ Custom presets sync (mirror) — Preset save/delete are wrapped to mark dirty; push is DELETE-all-then-INSERT of the local 'cit-presets' list; pull replaces local only when 
  - ✅ Pull-on-sign-in with local seeding — auth.onChange triggers pull
  - ◐ Focus-session logging (append-only stats) — Pomodoro phase ends >=1 minute POST a {kind, minutes, site} row to focus_sessions
- **Backend/RLS**
  - ✅ Supabase schema + Row-Level Security — supabase/schema.sql defines profiles/settings/presets/focus_sessions/integrations/subscriptions, RLS enabled on all, owner-scoped `auth.uid
  - ✅ Anon-key discipline (public client key, RLS as the guard) — Both background.js and config.js ship only the anon JWT with explicit comments that service_role never enters the extension; the manifest's 
- **Entitlements**
  - ○ isPro()/entitled() entitlement seam — CALM.isPro
  - · Spotify integration — Only artifacts: the integrations table
  - · Stripe billing + web dashboard — subscriptions table
- **Persistence & settings**
  - ✅ Settings persistence + v3 migration — Settings live in page localStorage under cit-settings, merged over ~35 defaults with a settingsVersion=3 migration moving the old 'both' typ
  - ✅ Per-site remember-state — Opt-in
  - ✅ Centralized tuning constants + runtime singleton — CALM.const centralizes thresholds
- **Monetization scaffolding**
  - ○ Per-mode entitlement gating — modeEnter checks CALM.entitled
- **Infra & monetization**
  - ○ Entitlement seam (isPro / FEATURE_TIERS) — FEATURE_TIERS marks every feature 'free' and isPro
  - · Phase 7 billing resolution (Supabase/Stripe) — Referenced only in the state.js entitlement comment
  - ✅ Supabase client config — config.js ships the public SUPABASE_URL and anon-role JWT

## Packaging & docs (8)
- **Packaging**
  - ✅ install.py guided installer — validate
  - ✅ Web Store zip builder (--zip) — Builds dist/calm-for-ai-chats-v{version}.zip from exactly manifest.json + src/ + content.css + icons/, filtering .DS_Store, printing size; d
  - ✅ Stable extension ID + signing-key hygiene — manifest 'key' pins the extension ID so the chromiumapp.org OAuth redirect never changes; the private .pem lives outside the repo
  - ✅ Minimal-permission manifest — MV3 with exactly identity + storage, one Supabase host permission, three site matches, 16 ordered no-build content scripts + content.css at 
- **Docs**
  - ◐ README — Complete feature tour, honest permission table, install steps, shortcuts, dev workflow, and license — but stale against the shipped design a
  - ✅ PRIVACY.md — Plain-language and accurate to the code: never reads conversations, no analytics/third-party code, localStorage/sessionStorage inventory mat
  - ✅ SETUP-BACKEND.md — Accurate phase-by-phase backend guide
  - ◐ About tab copy — The in-extension About tab

- **Modes** (added post-audit)
  - ✅ Focus Reader — Calm-owned reading pane: bionic fixation slider, Ease, Spotlight, per-block RTL, sanitized local-only cloning

### v3.1 additions
- ✅ Console — one menu: live timer tile, quick toggles, inline sliders, mode
  chips from the registry, Advanced as an in-place drawer
- ✅ Command palette (⌘K) — every mode/action/setting, derived not hand-listed;
  arrows nudge numeric settings in place
- ✅ Shared Escape stack — one listener, closes the topmost open surface
- ✅ Local focus log (`CALM.stats`) — capped, device-only
- ⛔ Removed: bloom tray, modes popover, tabbed settings panel, Google
  sign-in, Supabase sync, `reader` mode, `identity`/`storage` permissions

_Feature count is no longer tracked here; the harness (`tools/harness.js`,
87 checks) is the source of truth for what actually works._