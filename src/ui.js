/* ===== Calm — src/ui.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * All Calm-owned UI: floating buttons, settings panel, toast, quick-nav.
 * (v3 will replace the single panel with a tabbed UI + modes menu + chips.)
 * Exposes window.CALM.ui.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;
  var C = CALM.const;

  // ---- Toast ----
  function showToast(text, force) {
    var now = Date.now();
    if (!force && now - rt.lastToastAt < C.TOAST_THROTTLE_MS) return;
    rt.lastToastAt = now;
    var t = document.getElementById(IDS.toast);
    if (!t) {
      t = document.createElement("div");
      t.id = IDS.toast;
      document.body.appendChild(t);
    }
    t.textContent = text || "Input hidden · scroll down or ⌃⇧H";
    t.classList.remove("cit-toast-show");
    void t.offsetHeight;
    t.classList.add("cit-toast-show");
    clearTimeout(rt.toastTimer);
    rt.toastTimer = setTimeout(function () {
      t.classList.remove("cit-toast-show");
    }, C.TOAST_MS);
  }
  function hideToast() {
    var t = document.getElementById(IDS.toast);
    if (t) t.classList.remove("cit-toast-show");
    clearTimeout(rt.toastTimer);
  }

  // ---- Quick nav ----
  function smoothScrollTo(top) {
    var sc =
      CALM.core && CALM.core.currentScroller
        ? CALM.core.currentScroller()
        : rt.scrollContainer;
    if (!sc) return;
    try {
      sc.scrollTo({ top: top, behavior: "smooth" });
    } catch (_) {
      sc.scrollTop = top;
    }
  }

  // ---- Type-ahead chip (shown while typing into a hidden composer) ----
  function showTypeChip(text) {
    var c = document.getElementById(IDS.typeChip);
    if (!c) {
      c = document.createElement("div");
      c.id = IDS.typeChip;
      c.innerHTML =
        '<span class="cit-type-dot"></span>' +
        '<span class="cit-type-label">typing…&nbsp;</span>' +
        '<b class="cit-type-preview"></b>' +
        '<span class="cit-type-hint">⌃⇧H</span>';
      document.body.appendChild(c);
    }
    var preview = text.length > 24 ? "…" + text.slice(-24) : text;
    c.querySelector(".cit-type-preview").textContent = preview; // textContent = no XSS
    c.classList.add("cit-type-show");
  }
  function hideTypeChip() {
    var c = document.getElementById(IDS.typeChip);
    if (c) c.classList.remove("cit-type-show");
  }

  // ---- Generic status chips (pause countdown, pomodoro, etc.) ----
  function chipStack() {
    var s = document.getElementById("cit-chip-stack");
    if (!s) {
      s = document.createElement("div");
      s.id = "cit-chip-stack";
      document.body.appendChild(s);
    }
    return s;
  }
  function showChip(id, text) {
    var c = document.getElementById("cit-chip-" + id);
    if (!c) {
      c = document.createElement("div");
      c.id = "cit-chip-" + id;
      c.className = "cit-chip";
      chipStack().appendChild(c);
    }
    c.textContent = text;
  }
  function hideChip(id) {
    var c = document.getElementById("cit-chip-" + id);
    if (c) c.remove();
  }

  // ---- Drag engine (shared by dock, chips, widgets, panel) ----
  // Pointer-based, 5px threshold so clicks still work, viewport-clamped,
  // optional edge snap, position persisted per storageKey (device-local).
  function makeDraggable(el, storageKey, opts) {
    opts = opts || {};
    var handle = opts.handle || el;
    var sx, sy, ox, oy, dragging = false, moved = false;

    function place(l, t) {
      var w = el.offsetWidth || 40;
      var h = el.offsetHeight || 40;
      l = Math.max(8, Math.min((window.innerWidth || 1400) - w - 8, l));
      t = Math.max(8, Math.min((window.innerHeight || 900) - h - 8, t));
      el.style.left = l + "px";
      el.style.top = t + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transform = "none";
      if (opts.onPlace) opts.onPlace(l, t);
      return { left: l, top: t };
    }
    function restore() {
      try {
        var p = JSON.parse(localStorage.getItem(storageKey));
        if (p && typeof p.left === "number") {
          place(p.left, p.top);
          return true;
        }
      } catch (_) {}
      return false;
    }
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      var r = el.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      // Capture the pointer so a missed pointerup (touch/pen cancel, element
      // detached mid-drag) can never strand the document listeners.
      try {
        if (e.pointerId != null && handle.setPointerCapture) {
          handle.setPointerCapture(e.pointerId);
        }
      } catch (_) {}
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
    }
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      el.classList.add("cit-dragging");
      place(ox + dx, oy + dy);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      el.classList.remove("cit-dragging");
      if (!moved) return;
      var r = el.getBoundingClientRect();
      if (opts.onDrop) {
        // Caller owns final placement + persistence (dock corner-anchoring).
        opts.onDrop({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        var l = r.left;
        var t = r.top;
        if (opts.snap) {
          var iw = window.innerWidth || 1400;
          var dl = l;
          var dr = iw - (l + r.width);
          if (Math.min(dl, dr) < 48) l = dl < dr ? 12 : iw - r.width - 12;
        }
        var fin = place(l, t);
        try {
          if (storageKey) localStorage.setItem(storageKey, JSON.stringify(fin));
        } catch (_) {}
      }
      // swallow the click that follows a drag
      function block(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        document.removeEventListener("click", block, true);
      }
      document.addEventListener("click", block, true);
      setTimeout(function () {
        document.removeEventListener("click", block, true);
      }, 0);
    }
    handle.addEventListener("pointerdown", onDown);
    var restored = opts.onDrop ? false : restore();
    return { restore: restore, place: place, restored: restored };
  }

  // ---- Popover registry ----
  // Every floating popover registers its close(); navigation teardown calls
  // closeAllPopovers() so elements AND their document listeners go together —
  // no ghost panels or orphaned handlers after a SPA nav.
  var popovers = [];
  function registerPopover(closeFn) {
    popovers.push(closeFn);
  }
  function unregisterPopover(closeFn) {
    var i = popovers.indexOf(closeFn);
    if (i >= 0) popovers.splice(i, 1);
  }
  // One Escape listener for the whole extension. Handlers run newest-first and
  // the first one that reports it handled the key wins, so Escape always
  // dismisses the topmost surface.
  // A STACK of currently-open surfaces. Registering at open time (rather than
  // at module load) is what makes "topmost" mean what the user sees: the last
  // thing opened is the first thing Escape closes.
  var escapers = [];
  function registerEscape(fn) {
    escapers.push(fn);
    return function () {
      var i = escapers.indexOf(fn);
      if (i >= 0) escapers.splice(i, 1);
    };
  }
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Escape") return;
      for (var i = escapers.length - 1; i >= 0; i--) {
        if (escapers[i]() === true) {
          e.stopPropagation();
          return;
        }
      }
    },
    true
  );

  function closeAllPopovers() {
    popovers.slice().forEach(function (c) {
      try {
        c();
      } catch (_) {}
    });
    popovers.length = 0;
  }

  // ---- Generic popover close ----


  // The Console (src/console.js) is the only menu now: the modes popover and
  // the tabbed settings panel are gone, and the section builders below render
  // into its Advanced drawer instead of into tabs.
  function createUI() {
    if (CALM.dock) CALM.dock.build();
  }

  // ---- Advanced drawer: every long-tail control, grouped ----
  function buildAdvancedSections(c) {
    c.appendChild(divider("Modes"));
    CALM.modes.ids().forEach(function (id) {
      if (CALM.modes.MODES[id].surface === "tile") return; // already up front
      c.appendChild(modeRow(id));
    });
    buildModesTab(c);
    c.appendChild(divider("Reading"));
    buildReadingTab(c);
    c.appendChild(divider("Behavior"));
    buildBehaviorTab(c);
    c.appendChild(divider("Presets"));
    buildPresetsTab(c);
    c.appendChild(divider("About"));
    buildAboutTab(c);
  }

  function buildModesTab(c) {
    c.appendChild(divider("Mode settings"));
    c.appendChild(sliderRow("Auto-scroll speed", "autoScrollSpeed", 1, 10, 1));
    c.appendChild(sliderRow("Pause minutes", "pauseMinutes", 5, 60, 5));
    c.appendChild(divider("Pomodoro"));
    c.appendChild(
      selectRow(
        "Timer preset",
        "pomoPreset",
        [
          { value: "custom", label: "Custom" },
          { value: "10/2", label: "Just 10 min (starter)" },
          { value: "25/5", label: "Classic 25/5" },
          { value: "52/17", label: "Deep 52/17" },
          { value: "90/20", label: "Ultra 90/20" },
        ],
        function () {
          var map = {
            "10/2": [10, 2, 10],
            "25/5": [25, 5, 15],
            "52/17": [52, 17, 25],
            "90/20": [90, 20, 30],
          };
          var v = map[S.pomoPreset];
          if (v) {
            S.pomoFocusMin = v[0];
            S.pomoBreakMin = v[1];
            S.pomoLongBreakMin = v[2];
            CALM.saveSettings();
            // Re-render the WHOLE drawer, not just this tab into the shared
            // container: `c` here is the drawer body, so the old
            // `c.innerHTML=""; buildModesTab(c)` deleted Reading, Behavior,
            // Presets and About along with it.
            c.innerHTML = "";
            buildAdvancedSections(c);
          }
        }
      )
    );
    c.appendChild(sliderRow("Focus minutes", "pomoFocusMin", 5, 90, 1));
    c.appendChild(sliderRow("Break minutes", "pomoBreakMin", 1, 20, 1));
    c.appendChild(sliderRow("Long break minutes", "pomoLongBreakMin", 5, 30, 5));
    c.appendChild(sliderRow("Cycles before long break", "pomoCycles", 2, 8, 1));
    c.appendChild(toggleRow("Auto Zen during focus", "pomoAutoZen"));
    c.appendChild(toggleRow("Chime at phase end", "pomoSound"));
    c.appendChild(toggleRow("Focus progress bar", "showTimeBar"));
    c.appendChild(divider("Time awareness"));
    c.appendChild(toggleRow("Tell me when an answer lands", "answerReady"));
    c.appendChild(toggleRow("Remind me what I was doing", "whereWasI"));
    c.appendChild(sliderRow("...after this many minutes away", "whereWasIMin", 5, 120, 5));
    c.appendChild(toggleRow("...with a soft chime", "answerReadyChime"));
    c.appendChild(toggleRow("Time-on-page chip", "showTimeOnPage"));
    c.appendChild(sliderRow("Hyperfocus nudge (min, 0=off)", "hyperfocusMin", 0, 180, 15));
  }
  function buildReadingTab(c) {
    c.appendChild(sliderRow("Reading width (0=off)", "readingWidth", 0, 1600, 20, CALM.modes.applyWidth));
    c.appendChild(sliderRow("Page text size %", "readerFontScale", 80, 160, 5, CALM.modes.applyReaderType));
    c.appendChild(sliderRow("Page line-height ×10", "readerLineHeight", 12, 22, 1, CALM.modes.applyReaderType));
    c.appendChild(sliderRow("Night dim %", "nightLevel", 10, 70, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Ruler height px", "rulerHeight", 50, 160, 10, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Ruler dim %", "rulerDim", 15, 70, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Chat spotlight dim %", "spotDim", 10, 70, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Grayscale %", "grayLevel", 40, 100, 5, CALM.modes.refreshVars));
  }
  function buildBehaviorTab(c) {
    c.appendChild(toggleRow("Auto-hide on scroll", "autoHideOnScroll"));
    c.appendChild(sliderRow("Scroll sensitivity", "sensitivity", 1, 10, 1));
    c.appendChild(toggleRow("Zen also hides input", "zenComposer"));
    c.appendChild(
      selectRow("Type while hidden", "typeAhead", [
        { value: "auto", label: "Auto-reveal (instant)" },
        { value: "both", label: "Both" },
        { value: "buffer", label: "Buffer" },
        { value: "off", label: "Off" },
      ])
    );
    c.appendChild(
      toggleRow("Remember state", "rememberState", function () {
        if (S.rememberState) CALM.saveState();
      })
    );
    c.appendChild(toggleRow("Keyboard shortcuts", "keyboardShortcut"));
    c.appendChild(toggleRow("Fade the pill while typing", "dockQuiet"));
    c.appendChild(
      toggleRow("Show input tile", "showToggleButton", function () {
        if (CALM.console) CALM.console.render();
      })
    );
    c.appendChild(
      selectRow(
        "Menu style",
        "menuStyle",
        [
          { value: "console", label: "Corner pill" },
          { value: "margin", label: "Page margin (needs room)" },
        ],
        function () {
          if (CALM.dock) CALM.dock.build();
        }
      )
    );
    c.appendChild(toggleRow("Dock auto-collapse", "dockAutoCollapse"));
    c.appendChild(
      selectRow(
        "Where the goal shows",
        "intentChipMode",
        [
          { value: "dock", label: "In the pill" },
          { value: "floating", label: "Floating chip" },
          { value: "hidden", label: "Nowhere" },
        ],
        function () {
          if (CALM.intent) CALM.intent.renderChip();
          if (CALM.dock) CALM.dock.refreshStatus();
        }
      )
    );
    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "cit-save-preset";
    reset.textContent = "↺ Reset positions";
    reset.addEventListener("click", function (e) {
      e.stopPropagation();
      ["cit-dock-pos", "cit-intent-pos", "cit-pomo-pos"].forEach(
        function (k) {
          try {
            localStorage.removeItem(k);
          } catch (_) {}
        }
      );
      ["cit-dock", "cit-intent-chip", "cit-pomo-widget"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.style.left = "";
          el.style.top = "";
          el.style.right = "";
          el.style.bottom = "";
          el.style.transform = "";
        }
      });
      if (CALM.dock) CALM.dock.build();
      // build() removes and re-creates the dock, taking this very drawer with
      // it. Re-open on Advanced so the user stays where they were.
      if (CALM.console) CALM.console.openAdvanced();
      showToast("Positions reset", true);
    });
    c.appendChild(reset);
  }
  function buildPresetsTab(c) {
    var host = document.createElement("div");
    host.className = "cit-preset-host";
    c.appendChild(host);
    buildPresets(host);
  }
  function buildAboutTab(c) {
    var d = document.createElement("div");
    d.className = "cit-about";
    d.innerHTML =
      '<div class="cit-about-name">Calm</div>' +
      '<div class="cit-about-ver">Reading Mode for AI Chats</div>' +
      "<p>Distraction-free reading for ChatGPT, Gemini and Claude — hide the input, the Focus Reader, a Pomodoro timer, and more.</p>" +
      '<p class="cit-about-dim">No permissions, no account, no network requests. Everything stays on your device.</p>';
    c.appendChild(d);
  }

  function toggleRow(label, key, after) {
    var r = document.createElement("div");
    r.className = "cit-settings-row";
    var span = document.createElement("span");
    span.textContent = label;
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "cit-toggle-switch" + (S[key] ? " cit-on" : "");
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(!!S[key]));
    var knob = document.createElement("div");
    knob.className = "cit-toggle-knob";
    sw.appendChild(knob);
    sw.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      S[key] = !S[key];
      CALM.saveSettings();
      sw.classList.toggle("cit-on", S[key]);
      sw.setAttribute("aria-checked", String(S[key]));
      if (after) after();
    });
    r.appendChild(span);
    r.appendChild(sw);
    return r;
  }

  function sliderRow(label, key, min, max, step, after) {
    var r = document.createElement("div");
    r.className = "cit-settings-row cit-slider-row";
    var top = document.createElement("div");
    top.className = "cit-slider-top";
    var span = document.createElement("span");
    span.textContent = label;
    var val = document.createElement("span");
    val.className = "cit-slider-val";
    val.textContent = S[key];
    top.appendChild(span);
    top.appendChild(val);
    var input = document.createElement("input");
    input.type = "range";
    input.className = "cit-slider";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = S[key];
    input.addEventListener("input", function () {
      S[key] = parseInt(input.value, 10);
      val.textContent = S[key];
      CALM.saveSettings();
      if (after) after();
    });
    r.appendChild(top);
    r.appendChild(input);
    return r;
  }

  function selectRow(label, key, options, after) {
    var r = document.createElement("div");
    r.className = "cit-settings-row";
    var span = document.createElement("span");
    span.textContent = label;
    var sel = document.createElement("select");
    sel.className = "cit-select";
    options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.value;
      op.textContent = o.label;
      if (S[key] === o.value) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", function () {
      S[key] = sel.value;
      CALM.saveSettings();
      if (after) after();
    });
    r.appendChild(span);
    r.appendChild(sel);
    return r;
  }

  function divider(label) {
    var d = document.createElement("div");
    d.className = "cit-settings-divider";
    d.textContent = label;
    return d;
  }

  function modeRow(id) {
    var m = CALM.modes.MODES[id];
    var r = document.createElement("div");
    r.className = "cit-settings-row";
    var span = document.createElement("span");
    span.className = "cit-row-label";
    if (CALM.icons && CALM.icons.mode[id]) {
      var ric = document.createElement("span");
      ric.className = "cit-row-ic";
      ric.innerHTML = CALM.icons.mode[id]; // static markup from our icon set
      span.appendChild(ric);
      var rlb = document.createElement("span");
      rlb.textContent = m.label;
      span.appendChild(rlb);
    } else {
      span.textContent = m.icon + "  " + m.label;
    }
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "cit-toggle-switch" + (CALM.modes.isActive(id) ? " cit-on" : "");
    sw.setAttribute("data-cit-mode", id);
    var knob = document.createElement("div");
    knob.className = "cit-toggle-knob";
    sw.appendChild(knob);
    sw.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      CALM.modes.toggle(id);
      sw.classList.toggle("cit-on", CALM.modes.isActive(id));
    });
    r.appendChild(span);
    r.appendChild(sw);
    return r;
  }
  function refreshModeButtons() {
    var list = document.querySelectorAll("[data-cit-mode]");
    for (var i = 0; i < list.length; i++) {
      var id = list[i].getAttribute("data-cit-mode");
      var on = CALM.modes.isActive(id);
      list[i].classList.toggle("cit-on", on);
      list[i].classList.toggle("cit-active", on);
    }
  }

  function buildPresets(host) {
    host.innerHTML = "";
    CALM.presets.list().forEach(function (p) {
      var r = document.createElement("div");
      r.className = "cit-settings-row cit-preset-row";
      var span = document.createElement("span");
      span.textContent = p.name;
      var wrap = document.createElement("div");
      wrap.className = "cit-preset-actions";
      var apply = document.createElement("button");
      apply.type = "button";
      apply.className = "cit-mini-btn";
      apply.textContent = "Apply";
      apply.addEventListener("click", function (e) {
        e.stopPropagation();
        CALM.presets.apply(p.name);
        refreshModeButtons();
      });
      wrap.appendChild(apply);
      if (!p.builtin) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "cit-mini-btn cit-del";
        del.textContent = "✕";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          CALM.presets.del(p.name);
          buildPresets(host);
        });
        wrap.appendChild(del);
      }
      r.appendChild(span);
      r.appendChild(wrap);
      host.appendChild(r);
    });
    var save = document.createElement("button");
    save.type = "button";
    save.className = "cit-save-preset";
    save.textContent = "＋ Save current as preset";
    save.addEventListener("click", function (e) {
      e.stopPropagation();
      var name = window.prompt("Preset name:");
      if (name) {
        CALM.presets.saveCurrent(name);
        buildPresets(host);
      }
    });
    host.appendChild(save);
  }

  CALM.ui = {
    showToast: showToast,
    hideToast: hideToast,
    smoothScrollTo: smoothScrollTo,
    showTypeChip: showTypeChip,
    hideTypeChip: hideTypeChip,
    showChip: showChip,
    hideChip: hideChip,
    refreshModeButtons: refreshModeButtons,
    registerPopover: registerPopover,
    registerEscape: registerEscape,
    unregisterPopover: unregisterPopover,
    closeAllPopovers: closeAllPopovers,
    createUI: createUI,
    buildAdvancedSections: buildAdvancedSections,
    makeDraggable: makeDraggable,
    toggleRow: toggleRow,
    sliderRow: sliderRow,
    selectRow: selectRow,
  };
})();
