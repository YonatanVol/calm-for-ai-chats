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
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return Object.assign({}, defaultSettings, JSON.parse(raw));
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
  };

  // Shared MUTABLE runtime state — every module reads/writes this one object.
  CALM.rt = {
    composerEl: null,
    scrollContainer: null,
    composerHidden: false,
    zenOn: false,
    zenHidden: [],
    scrollLocked: false,
    scrollLockTimer: null,
    lastScrollTop: 0,
    accUp: 0,
    accTimer: null,
    draftSaved: false,
    lastToastAt: 0,
    toastTimer: null,
    lastUrl: location.href,
    navObserver: null,
    retryTimer: null,
    initialized: false,
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
          zen: CALM.rt.zenOn,
        })
      );
    } catch (_) {}
  };
})();
