/* ===== Calm — src/presets.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Presets = a named snapshot of settings + active modes. Built-ins plus
 * user-saved customs (localStorage). Applying a preset sets the settings and
 * reconciles which modes are on. Loaded after modes.js. Exposes CALM.presets.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;

  var CUSTOM_KEY = "cit-presets";
  var PRESET_KEYS = [
    "readingWidth",
    "sensitivity",
    "readerFontScale",
    "readerLineHeight",
    "nightLevel",
    "autoScrollSpeed",
    "pauseMinutes",
    "zenComposer",
    "typeAhead",
    "autoHideOnScroll",
  ];

  var BUILTINS = [
    { name: "Default", builtin: true, settings: { readingWidth: 0 }, modes: [] },
    {
      name: "Deep Reading",
      builtin: true,
      settings: { readingWidth: 1000, readerFontScale: 120, readerLineHeight: 18, nightLevel: 25 },
      modes: ["reader"],
    },
    { name: "Study", builtin: true, settings: {}, modes: ["zen", "pomodoro"] },
    { name: "Present", builtin: true, settings: {}, modes: ["presentation"] },
    {
      name: "Night Owl",
      builtin: true,
      settings: { nightLevel: 45, readerFontScale: 115 },
      modes: ["night", "reader"],
    },
  ];

  function loadCustom() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || [];
    } catch (_) {
      return [];
    }
  }
  function saveCustom(arr) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  function list() {
    return BUILTINS.concat(loadCustom());
  }
  function find(name) {
    var all = list();
    for (var i = 0; i < all.length; i++) if (all[i].name === name) return all[i];
    return null;
  }

  function apply(name) {
    var p = find(name);
    if (!p) return;
    if (p.settings) {
      Object.keys(p.settings).forEach(function (k) {
        S[k] = p.settings[k];
      });
      CALM.saveSettings();
    }
    // Reconcile modes: turn off everything on, then turn on the preset's set.
    Object.keys(rt.activeModes).forEach(function (id) {
      if (rt.activeModes[id]) CALM.modes.exit(id);
    });
    (p.modes || []).forEach(function (id) {
      CALM.modes.enter(id);
    });
    CALM.modes.applyWidth();
    CALM.modes.refreshVars();
    if (CALM.ui && CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
  }

  function saveCurrent(name) {
    name = (name || "").trim();
    if (!name) return;
    var custom = loadCustom().filter(function (x) {
      return x.name !== name;
    });
    var snap = {};
    PRESET_KEYS.forEach(function (k) {
      snap[k] = S[k];
    });
    var modes = Object.keys(rt.activeModes).filter(function (id) {
      return rt.activeModes[id];
    });
    custom.push({ name: name, settings: snap, modes: modes });
    saveCustom(custom);
  }

  function del(name) {
    saveCustom(
      loadCustom().filter(function (x) {
        return x.name !== name;
      })
    );
  }

  CALM.presets = {
    list: list,
    apply: apply,
    saveCurrent: saveCurrent,
    del: del,
    BUILTINS: BUILTINS,
  };
})();
