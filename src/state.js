/* ===== Calm — src/state.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Settings (localStorage), per-site persisted state, shared runtime state,
 * constants/IDs, and the isPro()/entitlement seam. Exposes window.CALM.*.
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
    showQuickNav: true,
    sensitivity: 5, // 1 (needs big scroll) .. 10 (hair trigger)
    readingWidth: 0, // 0 = off; else px
    zenComposer: true, // zen also hides the composer
    typeAhead: "auto", // off | auto | buffer | both — typing while input hidden
    settingsVersion: 3, // bump when a migration below needs to run
    // Mode parameters
    readerFontScale: 110, // % (80..160) — Reader mode
    readerLineHeight: 16, // ×0.1 => 1.6 — Reader mode
    nightLevel: 35, // overlay opacity % (10..70) — Night/Dim
    autoScrollSpeed: 3, // px per tick (1..10) — Auto-scroll
    pauseMinutes: 15, // snooze duration (5..60) — Pause
    rulerHeight: 90, // reading-ruler band height in px (50..160)
    rulerDim: 45, // reading-ruler surround dim % (15..70)
    grayLevel: 85, // grayscale mode strength % (40..100)
    intentionPrompt: true, // ask "what did you come to do?" once per tab
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
    MIN_SCROLLABLE: 200,
    ACC_RESET_MS: 350,
    SCROLL_GRACE_MS: 450,
    TOAST_MS: 2200,
    TOAST_THROTTLE_MS: 5000,
    RETRY_MS: 1500,
  };

  CALM.IDS = {
    toggle: "cit-toggle-btn",
    zen: "cit-zen-btn",
    settings: "cit-settings-btn",
    panel: "cit-settings-panel",
    toast: "cit-toast",
    top: "cit-nav-top",
    bottom: "cit-nav-bottom",
    widthStyle: "cit-width-style",
    typeChip: "cit-type-chip",
  };

  // Shared MUTABLE runtime state — every module reads/writes this one object.
  CALM.rt = {
    composerEl: null,
    scrollContainer: null,
    composerHidden: false,
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
  };

  // Entitlement seam — all free in v1; Phase 7 resolves from Supabase/Stripe.
  var FEATURE_TIERS = {
    composerToggle: "free",
    keyboardShortcut: "free",
    zenMode: "free",
    rememberState: "free",
    readingWidth: "free",
    scrollSensitivity: "free",
    quickNav: "free",
    "mode:zen": "free",
    "mode:reader": "free",
    "mode:night": "free",
    "mode:privacy": "free",
    "mode:presentation": "free",
    "mode:autoscroll": "free",
    "mode:pause": "free",
    "mode:pomodoro": "free",
    "mode:ruler": "free",
    "mode:gray": "free",
    "mode:motion": "free",
  };
  CALM.FEATURE_TIERS = FEATURE_TIERS;
  CALM.isPro = function () {
    return true;
  };
  CALM.entitled = function (feature) {
    return FEATURE_TIERS[feature] === "free" || CALM.isPro();
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
