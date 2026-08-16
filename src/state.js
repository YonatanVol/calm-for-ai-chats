/* ===== Calm — src/state.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Settings (localStorage), per-site persisted state, shared runtime state,
 * constants/IDs, the entitlement seam and the local focus log.
 * Everything here is device-local. Exposes window.CALM.*.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var site = CALM.site;

  var SETTINGS_KEY = "cit-settings";
  var STATE_KEY = "cit-state-" + site.id;
  var DRAFT_KEY = "cit-draft-text";

  var defaultSettings = {
    autoHideOnScroll: true,
    keyboardShortcut: true,
    showToggleButton: true,
    showHints: true,
    rememberState: false,
    sensitivity: 5, // 1 (needs big scroll) .. 10 (hair trigger)
    readingWidth: 0, // 0 = off; else px
    zenComposer: true, // zen also hides the composer
    typeAhead: "auto", // off | auto | buffer | both — typing while input hidden
    settingsVersion: 3, // bump when a migration below needs to run
    // Mode parameters
    readerFontScale: 100, // % (80..160) — host-page text size (100 = off)
    readerLineHeight: 16, // ×0.1 => 1.6 — host-page line height (16 = off)
    nightLevel: 35, // overlay opacity % (10..70) — Night/Dim
    autoScrollSpeed: 3, // px per tick (1..10) — Auto-scroll
    pauseMinutes: 15, // snooze duration (5..60) — Pause
    rulerHeight: 90, // reading-ruler band height in px (50..160)
    rulerDim: 45, // reading-ruler surround dim % (15..70)
    grayLevel: 85, // grayscale mode strength % (40..100)
    spotDim: 30, // chat spotlight: how far older turns recede (10..70)
    // Focus Reader (the Calm-owned reading pane)
    frBionic: true, // bold word-starts (fixation anchors)
    frFixation: 40, // % of each word bolded (20..60)
    frSize: 18, // reading text size in px (15..26)
    frEase: false, // dyslexia-friendly spacing + sans
    frSpotlight: false, // dim all blocks except the current one
    intentionPrompt: true, // ask "what did you come to do?" once per tab
    intentChipMode: "dock", // dock | floating | hidden — where the 🎯 goal shows
    menuStyle: "console", // console (corner pill) | margin (marks in the gutter)
    dockAutoCollapse: true, // dock folds back to the pill after 6s idle
    dockQuiet: true, // pill fades while typing; wakes on pointer approach
    answerReady: true, // tab title says when a reply finished while you were away
    answerReadyChime: false, // ...and optionally a soft chime. Off by default.
    whereWasI: true, // on returning after a long gap, remind me what I was doing
    whereWasIMin: 20, // how long counts as "away" (minutes)
    showTimeOnPage: true, // "🕐 25m here" chip (from 5 minutes on)
    hyperfocusMin: 60, // nudge every N minutes; 0 = off
    showTimeBar: true, // thin focus-progress bar during Pomodoro blocks
    pomoPreset: "custom", // custom | 25/5 | 52/17 | 90/20 | 10/2
    // Pomodoro
    pomoFocusMin: 25,
    pomoBreakMin: 5,
    pomoLongBreakMin: 15,
    pomoCycles: 4, // focus blocks before a long break
    pomoAutoZen: true, // auto Zen during focus, reveal on break
    pomoSound: true, // play a chime at phase end
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        var merged = Object.assign({}, defaultSettings, saved);
        // v3 migration: instant type-ahead becomes the default. Only users
        // still on the old default ("both") are moved; explicit choices of
        // "buffer"/"off" are respected.
        if ((saved.settingsVersion | 0) < 3) {
          if (saved.typeAhead === "both" || saved.typeAhead === undefined) {
            merged.typeAhead = "auto";
          }
          merged.settingsVersion = 3;
        }
        return merged;
      }
    } catch (_) {}
    return Object.assign({}, defaultSettings);
  }

  CALM.settings = loadSettings();
  CALM.defaultSettings = defaultSettings;
  CALM.saveSettings = function () {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(CALM.settings));
    } catch (_) {}
  };

  CALM.keys = {
    SETTINGS_KEY: SETTINGS_KEY,
    STATE_KEY: STATE_KEY,
    DRAFT_KEY: DRAFT_KEY,
  };

  CALM.const = {
    BOTTOM_THRESHOLD: 90,
    MIN_SCROLLABLE: 200, // enough range to call an element "a scroller"
    // Enough range for hiding to be WORTH anything. On a short page a single
    // trackpad flick covers the whole range in one event, which trivially
    // satisfies both the accumulate-upward and distance-from-bottom
    // thresholds — so an empty new chat hid its composer on the first scroll.
    MIN_HIDE_RANGE: 700,
    // A conversation this long is real even if the adapter's response
    // selector has rotted; used so selector rot can never disable auto-hide.
    ASSUME_CONTENT_RANGE: 2000,
    // Upward pixels needed to hide, mapped from sensitivity 1..10.
    UP_MAX: 150, // sensitivity 1 — needs a deliberate shove
    UP_MIN: 20, // sensitivity 10 — hair trigger
    ACC_RESET_MS: 350,
    SCROLL_GRACE_MS: 450,
    TOAST_MS: 2200,
    TOAST_THROTTLE_MS: 5000,
    RETRY_MS: 1500,
  };

  CALM.IDS = {
    toggle: "cit-input-tile",
    zen: "cit-zen-tile",
    toast: "cit-toast",
    widthStyle: "cit-width-style",
    typeChip: "cit-type-chip",
    dock: "cit-dock",
    console: "cit-console",
    rail: "cit-margin-rail",
    tour: "cit-tour",
    back: "cit-back",
    readerPane: "cit-reader-pane",
  };

  // Shared MUTABLE runtime state — every module reads/writes this one object.
  CALM.rt = {
    composerEl: null,
    scrollContainer: null,
    composerHidden: false,
    hiddenManually: false, // an explicit hide is not undone by scrolling
    zenHidComposer: false, // Zen hid it, so Zen may reveal it again
    zenOn: false,
    zenHidden: [],
    activeModes: {}, // { modeId: true } — which modes are on
    paused: false, // Pause/Snooze suspends auto-hide
    modeTimers: {}, // per-mode interval handles (autoscroll, pause, ...)
    scrollLocked: false,
    scrollLockTimer: null,
    lastScrollTop: 0,
    accUp: 0,
    accTimer: null,
    draftSaved: false,
    pendingText: "", // type-ahead buffer (typing while composer hidden)
    lastToastAt: 0,
    toastTimer: null,
    lastUrl: location.href,
    navObserver: null,
    retryTimer: null,
    initialized: false,
    initGen: 0, // generation token: aborts stale init attempt-loops after nav
    pendingModes: null, // modes to re-enter fresh after a SPA navigation
    presentationEnteredZen: false, // presentation auto-entered zen → exit it too
    rulerHandler: null, // mousemove listener for the reading ruler
    tearingDown: false, // true during resetState (suppresses partial-block logs)
    pauseEndTs: null, // active Pause end time (survives navs via resumePauseEnd)
    resumePauseEnd: null, // nav snapshot: Pause end time to resume
    resumePomodoro: null, // nav snapshot: {phase,remaining,cycle,paused,enteredZen}
  };

  // Feature tiers. Nothing is "pro" today — there is no account and no server.
  var FEATURE_TIERS = {
    composerToggle: "free",
    keyboardShortcut: "free",
    zenMode: "free",
    rememberState: "free",
    readingWidth: "free",
    scrollSensitivity: "free",
    "mode:zen": "free",
    "mode:focusreader": "free",
    "mode:night": "free",
    "mode:privacy": "free",
    "mode:presentation": "free",
    "mode:autoscroll": "free",
    "mode:pause": "free",
    "mode:pomodoro": "free",
    "mode:ruler": "free",
    "mode:chatspot": "free",
    "mode:gray": "free",
    "mode:motion": "free",
  };
  CALM.FEATURE_TIERS = FEATURE_TIERS;
  // Entitlement seam. Every feature is free and there is no paid tier, no
  // account and no server — so this is honest rather than a stub that claims
  // otherwise. When billing eventually exists, this is the single hook.
  CALM.entitled = function (feature) {
    return FEATURE_TIERS[feature] !== "pro";
  };

  // Focus-session log — local only, capped, never leaves the device.
  var LOG_KEY = "cit-focus-log";
  CALM.stats = {
    log: function (kind, minutes) {
      try {
        var arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
        arr.push({ k: kind, m: minutes, t: Date.now(), s: site.id });
        localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-500)));
      } catch (_) {}
    },
    all: function () {
      try {
        return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      } catch (_) {
        return [];
      }
    },
  };

  CALM.loadState = function () {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  };
  CALM.saveState = function () {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          composerHidden: CALM.rt.composerHidden,
          modes: CALM.rt.activeModes,
        })
      );
    } catch (_) {}
  };
})();
