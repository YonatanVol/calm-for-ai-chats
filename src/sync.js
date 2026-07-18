/* ===== Calm — src/sync.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Offline-first sync of settings, presets, and focus_sessions over Supabase
 * PostgREST (via the background worker). Local storage stays the source of
 * truth for the live UI; the cloud is a mirror. Changes are debounced and
 * marked "dirty", then flushed whenever we're signed in and online. On
 * sign-in we pull the server copy first (seeding it from local if empty).
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var auth = CALM.auth;
  if (!auth) return;
  var S = CALM.settings;

  var DEBOUNCE_MS = 1500;
  var PRESETS_KEY = "cit-presets";

  var dirty = { settings: false, presets: false };
  var timer = null;
  var flushing = false;

  function uid() {
    var u = auth.user();
    return u && u.id;
  }
  function online() {
    return navigator.onLine !== false;
  }
  function customPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }
  function markSettings() {
    dirty.settings = true;
    schedule();
  }
  function markPresets() {
    dirty.presets = true;
    schedule();
  }

  // ---- Push ----
  async function pushSettings() {
    var id = uid();
    if (!id) return;
    var r = await auth.db({
      method: "POST",
      path: "settings?on_conflict=user_id",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { user_id: id, data: S, updated_at: new Date().toISOString() },
    });
    if (!r.ok) throw new Error(r.error);
  }

  async function pushPresets() {
    var id = uid();
    if (!id) return;
    // Mirror: clear this user's presets, then insert the current custom set.
    var del = await auth.db({ method: "DELETE", path: "presets?user_id=eq." + id });
    if (!del.ok) throw new Error(del.error);
    var rows = customPresets().map(function (p) {
      return {
        user_id: id,
        name: p.name,
        data: { settings: p.settings || {}, modes: p.modes || [] },
      };
    });
    if (rows.length) {
      var ins = await auth.db({
        method: "POST",
        path: "presets",
        headers: { Prefer: "return=minimal" },
        body: rows,
      });
      if (!ins.ok) throw new Error(ins.error);
    }
  }

  async function flush() {
    if (flushing || !auth.isSignedIn() || !online()) return;
    flushing = true;
    try {
      if (dirty.settings) {
        await pushSettings();
        dirty.settings = false;
      }
      if (dirty.presets) {
        await pushPresets();
        dirty.presets = false;
      }
    } catch (_) {
      schedule(); // leave dirty flags set; retry later
    } finally {
      flushing = false;
    }
  }

  // ---- Pull (on sign-in) ----
  async function pull() {
    var id = uid();
    if (!id) return { hadSettings: false };
    var hadSettings = false;

    var r = await auth.db({
      method: "GET",
      path: "settings?user_id=eq." + id + "&select=data,updated_at",
    });
    if (r.ok && r.data && r.data.length) {
      hadSettings = true;
      var remote = r.data[0].data || {};
      Object.keys(remote).forEach(function (k) {
        if (k in CALM.defaultSettings) S[k] = remote[k];
      });
      CALM.saveSettings.__fromSync = true;
      CALM.saveSettings();
      CALM.saveSettings.__fromSync = false;
      if (CALM.modes) {
        if (CALM.modes.applyWidth) CALM.modes.applyWidth();
        if (CALM.modes.refreshVars) CALM.modes.refreshVars();
      }
      if (CALM.ui && CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
    }

    var p = await auth.db({
      method: "GET",
      path: "presets?user_id=eq." + id + "&select=name,data",
    });
    if (p.ok && p.data && p.data.length) {
      var customs = p.data.map(function (row) {
        var d = row.data || {};
        return { name: row.name, settings: d.settings || {}, modes: d.modes || [] };
      });
      try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(customs));
      } catch (_) {}
    }
    return { hadSettings: hadSettings };
  }

  // ---- Focus sessions (append-only log) ----
  async function logFocus(kind, minutes) {
    var id = uid();
    if (!id || !auth.isSignedIn()) return;
    try {
      await auth.db({
        method: "POST",
        path: "focus_sessions",
        headers: { Prefer: "return=minimal" },
        body: {
          user_id: id,
          kind: kind || "focus",
          minutes: minutes || 0,
          site: CALM.site && CALM.site.id,
        },
      });
    } catch (_) {}
  }

  // ---- Wrap local mutators so any change marks the mirror dirty ----
  var _saveSettings = CALM.saveSettings;
  CALM.saveSettings = function () {
    _saveSettings.apply(this, arguments);
    if (!CALM.saveSettings.__fromSync) markSettings();
  };
  if (CALM.presets) {
    var _save = CALM.presets.saveCurrent;
    var _del = CALM.presets.del;
    CALM.presets.saveCurrent = function () {
      var out = _save.apply(this, arguments);
      markPresets();
      return out;
    };
    CALM.presets.del = function () {
      var out = _del.apply(this, arguments);
      markPresets();
      return out;
    };
  }

  window.addEventListener("online", flush);

  CALM.sync = {
    flush: flush,
    pull: pull,
    logFocus: logFocus,
    markSettings: markSettings,
    markPresets: markPresets,
  };

  // On sign-in: pull the server copy; if the server had no settings yet, seed
  // it from what's on this device. Then flush anything still pending.
  auth.onChange(function (session) {
    if (!session || !session.access_token) return;
    pull()
      .then(function (res) {
        if (!res.hadSettings) markSettings();
      })
      .then(flush)
      .catch(function () {});
  });
})();
