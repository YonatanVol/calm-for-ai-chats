/* ===== Calm — src/palette.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The command palette (Ctrl/Cmd+K). Everything Calm can do in one keystroke:
 * every mode, every action, every setting — including the ones that live in
 * the Advanced drawer, which is exactly why the Console can stay small.
 *
 * The action list is DERIVED (modes from the registry, settings from
 * defaultSettings), so a new mode or setting appears here automatically
 * instead of needing to be registered in a second place.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;

  var PID = "cit-palette";
  var items = [];
  var filtered = [];
  var cursor = 0;
  var keyHandler = null;
  var unEsc = null;

  // Settings worth exposing by name, with their ranges. Booleans are inferred.
  var RANGES = {
    readingWidth: [0, 1600, 20],
    readerFontScale: [80, 160, 5],
    readerLineHeight: [12, 22, 1],
    sensitivity: [1, 10, 1],
    nightLevel: [10, 70, 5],
    rulerHeight: [50, 160, 10],
    rulerDim: [15, 70, 5],
    grayLevel: [40, 100, 5],
    autoScrollSpeed: [1, 10, 1],
    pauseMinutes: [5, 60, 5],
    hyperfocusMin: [0, 180, 15],
    whereWasIMin: [5, 120, 5],
    pomoFocusMin: [5, 90, 1],
    pomoBreakMin: [1, 20, 1],
    pomoLongBreakMin: [5, 30, 5],
    pomoCycles: [2, 8, 1],
    frFixation: [20, 60, 5],
    frSize: [15, 26, 1],
  };
  function title(key) {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, function (m) { return m.toUpperCase(); })
      .replace(/\bPomo\b/, "Pomodoro")
      .replace(/\bFr\b/, "Reader");
  }

  function build() {
    items = [];
    // Actions
    items.push({
      kind: "action",
      name: "Toggle the input bar",
      hint: "⌃⇧H",
      run: function () { CALM.core.manualToggleComposer(); },
    });
    items.push({
      kind: "action",
      name: "Scroll to top",
      run: function () { CALM.ui.smoothScrollTo(0); },
    });
    items.push({
      kind: "action",
      name: "Scroll to end",
      run: function () {
        var sc = CALM.rt.scrollContainer;
        CALM.ui.smoothScrollTo(sc ? sc.scrollHeight : 0);
      },
    });
    items.push({
      kind: "action",
      name: "Intention and parked thoughts",
      hint: "⌃⇧K",
      run: function () { if (CALM.intent) CALM.intent.toggle(false); },
    });
    items.push({
      kind: "action",
      name: "Open Advanced settings",
      run: function () { if (CALM.console) CALM.console.openAdvanced(); },
    });
    // Every mode, whatever surface it normally lives on
    CALM.modes.ids().forEach(function (id) {
      items.push({
        kind: "mode",
        id: id,
        name: CALM.modes.MODES[id].label,
        run: function () {
          CALM.modes.toggle(id);
          if (CALM.console) CALM.console.render();
        },
      });
    });
    // Every setting
    Object.keys(CALM.defaultSettings).forEach(function (k) {
      if (k === "settingsVersion") return;
      var def = CALM.defaultSettings[k];
      if (typeof def === "boolean") {
        items.push({
          kind: "toggle",
          key: k,
          name: title(k),
          run: function () {
            S[k] = !S[k];
            CALM.saveSettings();
            if (CALM.reader && CALM.reader.refreshVars) CALM.reader.refreshVars();
            if (CALM.console) CALM.console.render();
          },
        });
      } else if (RANGES[k]) {
        items.push({ kind: "range", key: k, name: title(k), range: RANGES[k] });
      }
    });
  }

  // Subsequence match, so "rdr" finds "Reading ruler".
  function score(name, q) {
    if (!q) return 0;
    var n = name.toLowerCase();
    var i = n.indexOf(q);
    if (i >= 0) return 100 - i;
    var qi = 0;
    for (var c = 0; c < n.length && qi < q.length; c++) {
      if (n.charAt(c) === q.charAt(qi)) qi++;
    }
    return qi === q.length ? 10 : -1;
  }

  function stateOf(it) {
    if (it.kind === "mode") return CALM.modes.isActive(it.id) ? "on" : "";
    if (it.kind === "toggle") return S[it.key] ? "on" : "off";
    if (it.kind === "range") return String(S[it.key]);
    return it.hint || "";
  }

  function renderList() {
    var p = document.getElementById(PID);
    if (!p) return;
    var list = p.querySelector(".cit-pal-list");
    list.innerHTML = "";
    filtered.slice(0, 8).forEach(function (it, i) {
      var r = document.createElement("div");
      r.className = "cit-pal-row" + (i === cursor ? " cit-pal-on" : "");
      var n = document.createElement("span");
      n.textContent = it.name;
      var s = document.createElement("span");
      s.className = "cit-pal-state";
      s.textContent = stateOf(it) + (it.kind === "range" && i === cursor ? "  ← →" : "");
      r.appendChild(n);
      r.appendChild(s);
      r.addEventListener("click", function (e) {
        e.stopPropagation();
        cursor = i;
        run();
      });
      list.appendChild(r);
    });
    if (!filtered.length) {
      var empty = document.createElement("div");
      empty.className = "cit-pal-empty";
      empty.textContent = "Nothing matches";
      list.appendChild(empty);
    }
  }

  function filter(q) {
    q = (q || "").trim().toLowerCase();
    filtered = items
      .map(function (it) { return { it: it, s: score(it.name, q) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.it; });
    cursor = 0;
    renderList();
  }

  function nudge(dir) {
    var it = filtered[cursor];
    if (!it || it.kind !== "range") return;
    var r = it.range;
    S[it.key] = Math.max(r[0], Math.min(r[1], (S[it.key] | 0) + dir * r[2]));
    CALM.saveSettings();
    if (CALM.modes.refreshVars) CALM.modes.refreshVars();
    if (CALM.modes.applyWidth) CALM.modes.applyWidth();
    if (CALM.modes.applyReaderType) CALM.modes.applyReaderType();
    if (CALM.reader && CALM.reader.refreshVars) CALM.reader.refreshVars();
    if (CALM.console) CALM.console.render();
    renderList();
  }

  function run() {
    var it = filtered[cursor];
    if (!it) return;
    if (it.kind === "range") return; // adjusted with the arrows, not entered
    it.run();
    close();
  }

  function open() {
    if (document.getElementById(PID)) return;
    build();
    var p = document.createElement("div");
    p.id = PID;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Calm command palette");
    var box = document.createElement("div");
    box.className = "cit-pal-box";
    var top = document.createElement("div");
    top.className = "cit-pal-top";
    var tag = document.createElement("span");
    tag.className = "cit-pal-tag";
    tag.textContent = "CALM";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "cit-pal-input";
    input.placeholder = "Search modes, actions, settings…";
    input.setAttribute("aria-label", "Search Calm");
    top.appendChild(tag);
    top.appendChild(input);
    var list = document.createElement("div");
    list.className = "cit-pal-list";
    box.appendChild(top);
    box.appendChild(list);
    p.appendChild(box);
    document.body.appendChild(p);

    input.addEventListener("input", function (e) {
      e.stopPropagation();
      filter(input.value);
    });
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        cursor = Math.min(Math.min(filtered.length, 8) - 1, cursor + 1);
        renderList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        cursor = Math.max(0, cursor - 1);
        renderList();
      } else if (e.key === "ArrowRight") {
        nudge(1);
      } else if (e.key === "ArrowLeft") {
        nudge(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        run();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
    p.addEventListener("click", function (e) {
      if (e.target === p) close();
    });
    filter("");
    input.focus();
    if (CALM.ui.registerPopover) CALM.ui.registerPopover(close);
    // Escape worked only while the input kept focus; clicking a row moved it.
    if (!unEsc && CALM.ui.registerEscape) {
      unEsc = CALM.ui.registerEscape(function () {
        if (!document.getElementById(PID)) return false;
        close();
        return true;
      });
    }
  }

  function close() {
    var p = document.getElementById(PID);
    if (p) p.remove();
    if (unEsc) { unEsc(); unEsc = null; }
    if (CALM.ui.unregisterPopover) CALM.ui.unregisterPopover(close);
  }

  keyHandler = function (e) {
    if (!S.keyboardShortcut) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === "KeyK") {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById(PID) ? close() : open();
    }
  };
  document.addEventListener("keydown", keyHandler, true);

  CALM.palette = { open: open, close: close, _items: function () { return items; } };
})();
