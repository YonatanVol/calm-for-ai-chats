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
  function updateQuickNav() {
    var show =
      S.showQuickNav &&
      CALM.entitled("quickNav") &&
      rt.composerHidden &&
      !!rt.scrollContainer;
    [IDS.top, IDS.bottom].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.style.display = show ? "flex" : "none";
    });
  }
  function smoothScrollTo(top) {
    if (!rt.scrollContainer) return;
    try {
      rt.scrollContainer.scrollTo({ top: top, behavior: "smooth" });
    } catch (_) {
      rt.scrollContainer.scrollTop = top;
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
        localStorage.setItem(storageKey, JSON.stringify(fin));
      } catch (_) {}
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
    var restored = restore();
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
  function closeAllPopovers() {
    popovers.slice().forEach(function (c) {
      try {
        c();
      } catch (_) {}
    });
    popovers.length = 0;
  }

  // ---- Generic popover close ----
  function closeOnOutsideOf(p, excludeIds) {
    function close() {
      p.remove();
      document.removeEventListener("click", handler, true);
      document.removeEventListener("keydown", onKey, true);
      unregisterPopover(close);
    }
    function handler(e) {
      if (!p.contains(e.target) && excludeIds.indexOf(e.target.id) < 0) close();
    }
    function onKey(e) {
      if (e.code === "Escape") close();
    }
    registerPopover(close);
    setTimeout(function () {
      document.addEventListener("click", handler, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    return close;
  }

  // ---- Place a popover near the dock ----
  function placeNearDock(p) {
    var d = document.getElementById(IDS.dock);
    if (!d || !d.getBoundingClientRect) return;
    var r = d.getBoundingClientRect();
    var ih = window.innerHeight || 900;
    var iw = window.innerWidth || 1400;
    var pw = p.offsetWidth || 260;
    var ph = p.offsetHeight || 300;
    var top = r.top > ih / 2 ? r.top - ph - 10 : r.bottom + 10;
    var left = Math.max(8, Math.min(iw - pw - 8, r.right - pw));
    p.style.top = Math.max(8, top) + "px";
    p.style.left = left + "px";
    p.style.right = "auto";
    p.style.bottom = "auto";
  }

  // ---- Modes quick-popover ----
  function toggleModesPop() {
    var p = document.getElementById(IDS.modesPop);
    if (p) {
      p.remove();
      return;
    }
    p = document.createElement("div");
    p.id = IDS.modesPop;
    ["zen", "reader", "ruler", "night", "gray", "motion", "privacy",
     "presentation", "autoscroll", "pause", "pomodoro"].forEach(function (id) {
      var m = CALM.modes.MODES[id];
      if (!m) return;
      var card = document.createElement("button");
      card.type = "button";
      card.className = "cit-mode-card" + (CALM.modes.isActive(id) ? " cit-on" : "");
      card.setAttribute("data-cit-mode", id);
      var ic = document.createElement("span");
      ic.className = "cit-mode-ic";
      // Static SVG markup from our own icon set — never user content.
      if (CALM.icons && CALM.icons.mode[id]) ic.innerHTML = CALM.icons.mode[id];
      else ic.textContent = m.icon;
      var lb = document.createElement("span");
      lb.textContent = m.label;
      card.appendChild(ic);
      card.appendChild(lb);
      card.addEventListener("click", function (e) {
        e.stopPropagation();
        CALM.modes.toggle(id);
        card.classList.toggle("cit-on", CALM.modes.isActive(id));
      });
      p.appendChild(card);
    });
    var all = document.createElement("button");
    all.type = "button";
    all.className = "cit-modes-all";
    all.textContent = "All settings →";
    all.addEventListener("click", function (e) {
      e.stopPropagation();
      p.remove();
      toggleSettingsPanel();
    });
    p.appendChild(all);
    document.body.appendChild(p);
    placeNearDock(p);
    closeOnOutsideOf(p, [IDS.dock]);
  }

  // ---- UI root: the dock owns all floating controls now ----
  function createUI() {
    if (CALM.dock) CALM.dock.build();
    updateQuickNav();
  }

  // ---- Settings panel ----
  function toggleSettingsPanel() {
    var p = document.getElementById(IDS.panel);
    if (p) {
      p.remove();
      return;
    }
    p = document.createElement("div");
    p.id = IDS.panel;

    var header = document.createElement("div");
    header.className = "cit-settings-header";
    var title = document.createElement("div");
    title.className = "cit-settings-title";
    title.textContent = "Calm";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "cit-settings-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = CALM.icons ? CALM.icons.close : "✕";
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      closePanel();
    });
    header.appendChild(title);
    header.appendChild(close);
    p.appendChild(header);

    var tabbar = document.createElement("div");
    tabbar.className = "cit-tabbar";
    var content = document.createElement("div");
    content.className = "cit-tab-content";
    var TABS = [
      { id: "modes", label: "Modes", build: buildModesTab },
      { id: "reading", label: "Reading", build: buildReadingTab },
      { id: "behavior", label: "Behavior", build: buildBehaviorTab },
      { id: "presets", label: "Presets", build: buildPresetsTab },
      { id: "account", label: "Account", build: buildAccountTab },
      { id: "about", label: "About", build: buildAboutTab },
    ];
    function showTab(id) {
      content.innerHTML = "";
      var btns = tabbar.querySelectorAll(".cit-tab");
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("cit-tab-on", btns[i].getAttribute("data-tab") === id);
      }
      for (var j = 0; j < TABS.length; j++) if (TABS[j].id === id) TABS[j].build(content);
    }
    TABS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cit-tab";
      b.textContent = t.label;
      b.setAttribute("data-tab", t.id);
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        showTab(t.id);
      });
      tabbar.appendChild(b);
    });
    p.appendChild(tabbar);
    p.appendChild(content);
    document.body.appendChild(p);
    showTab("modes");
    // Draggable by its header; springs from the dock when no saved position.
    var drag = makeDraggable(p, "cit-panel-pos", { handle: header });
    if (!drag.restored) placeNearDock(p);

    // Single close path so the outside-click listener never leaks.
    function closePanel() {
      p.remove();
      document.removeEventListener("click", closeOnOutside, true);
      unregisterPopover(closePanel);
    }
    function closeOnOutside(e) {
      if (!p.contains(e.target) && e.target.id !== IDS.settings) closePanel();
    }
    registerPopover(closePanel);
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  function buildModesTab(c) {
    ["zen", "reader", "ruler", "night", "gray", "motion", "privacy",
     "presentation", "autoscroll", "pause", "pomodoro"].forEach(function (id) {
      c.appendChild(modeRow(id));
    });
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
            c.innerHTML = "";
            buildModesTab(c); // re-render so the sliders show the new values
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
    c.appendChild(toggleRow("Time-on-page chip", "showTimeOnPage"));
    c.appendChild(sliderRow("Hyperfocus nudge (min, 0=off)", "hyperfocusMin", 0, 180, 15));
  }
  function buildReadingTab(c) {
    c.appendChild(sliderRow("Reading width (0=off)", "readingWidth", 0, 1600, 20, CALM.modes.applyWidth));
    c.appendChild(sliderRow("Reader font %", "readerFontScale", 80, 160, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Reader line-height ×10", "readerLineHeight", 12, 22, 1, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Night dim %", "nightLevel", 10, 70, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Ruler height px", "rulerHeight", 50, 160, 10, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Ruler dim %", "rulerDim", 15, 70, 5, CALM.modes.refreshVars));
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
    c.appendChild(toggleRow("Quick scroll buttons", "showQuickNav", updateQuickNav));
    c.appendChild(toggleRow("Keyboard shortcuts", "keyboardShortcut"));
    c.appendChild(
      toggleRow("Show toggle button", "showToggleButton", function () {
        var b = document.getElementById(IDS.toggle);
        if (b) b.style.display = S.showToggleButton ? "" : "none";
      })
    );
    c.appendChild(toggleRow("Hint when auto-hidden", "showHints"));
    c.appendChild(
      toggleRow("Intention prompt (🎯)", "intentionPrompt", function () {
        if (CALM.intent) CALM.intent.renderChip();
      })
    );
    c.appendChild(
      selectRow(
        "Goal display",
        "intentChipMode",
        [
          { value: "dock", label: "In the dock" },
          { value: "floating", label: "Floating chip" },
          { value: "hidden", label: "Hidden" },
        ],
        function () {
          if (CALM.intent) CALM.intent.renderChip();
          if (CALM.dock) CALM.dock.refreshStatus();
        }
      )
    );
    c.appendChild(toggleRow("Dock auto-collapse", "dockAutoCollapse"));
    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "cit-save-preset";
    reset.textContent = "↺ Reset positions";
    reset.addEventListener("click", function (e) {
      e.stopPropagation();
      ["cit-dock-pos", "cit-intent-pos", "cit-pomo-pos", "cit-panel-pos"].forEach(
        function (k) {
          try {
            localStorage.removeItem(k);
          } catch (_) {}
        }
      );
      ["cit-dock", "cit-intent-chip", "cit-pomo-widget", IDS.panel].forEach(function (id) {
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
  function buildAccountTab(c) {
    var wrap = document.createElement("div");
    wrap.className = "cit-account";
    c.appendChild(wrap);

    function render() {
      wrap.innerHTML = "";
      var auth = CALM.auth;
      if (!auth) {
        var na = document.createElement("p");
        na.className = "cit-about-dim";
        na.textContent = "Sync isn't available right now.";
        wrap.appendChild(na);
        return;
      }
      if (auth.isSignedIn()) {
        var u = auth.user() || {};
        var who = document.createElement("div");
        who.className = "cit-account-who";
        who.textContent = "Signed in as " + (u.email || u.id || "your account");
        var note = document.createElement("p");
        note.className = "cit-about-dim";
        note.textContent =
          "Your settings, presets and focus stats sync to your account.";
        var out = document.createElement("button");
        out.type = "button";
        out.className = "cit-save-preset";
        out.textContent = "Sign out";
        out.addEventListener("click", function (e) {
          e.stopPropagation();
          auth.signOut().then(render);
        });
        wrap.appendChild(who);
        wrap.appendChild(note);
        wrap.appendChild(out);
      } else {
        var intro = document.createElement("p");
        intro.className = "cit-about-dim";
        intro.textContent =
          "Sign in to sync your settings, presets and focus stats across devices. The free experience stays fully local until you do.";
        var inBtn = document.createElement("button");
        inBtn.type = "button";
        inBtn.className = "cit-save-preset";
        inBtn.textContent = "Sign in with Google";
        inBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          inBtn.disabled = true;
          inBtn.textContent = "Opening Google…";
          CALM.auth.signInWithGoogle().then(function (r) {
            if (r && r.ok) {
              render();
            } else {
              inBtn.disabled = false;
              inBtn.textContent = "Sign in with Google";
              var err = document.createElement("div");
              err.className = "cit-account-err";
              err.textContent = (r && r.error) || "Sign-in failed. Try again.";
              wrap.appendChild(err);
            }
          });
        });
        wrap.appendChild(intro);
        wrap.appendChild(inBtn);
      }
    }
    render();
  }

  function buildAboutTab(c) {
    var d = document.createElement("div");
    d.className = "cit-about";
    d.innerHTML =
      '<div class="cit-about-name">Calm</div>' +
      '<div class="cit-about-ver">Reading Mode for AI Chats</div>' +
      "<p>Distraction-free reading for ChatGPT &amp; Gemini — hide the input, 8 focus modes, a Pomodoro timer, and more.</p>" +
      '<p class="cit-about-dim">Your conversations are never read or sent. Settings stay on your device.</p>' +
      '<p><span class="cit-about-pro">Pro — cloud sync, dashboard &amp; Spotify — coming soon.</span></p>';
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
      list[i].classList.toggle("cit-on", CALM.modes.isActive(id));
    }
    // Keep the floating zen button in sync too (single source of truth).
    var zb = document.getElementById(IDS.zen);
    if (zb) zb.classList.toggle("cit-active", CALM.modes.isActive("zen"));
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
    updateQuickNav: updateQuickNav,
    smoothScrollTo: smoothScrollTo,
    showTypeChip: showTypeChip,
    hideTypeChip: hideTypeChip,
    showChip: showChip,
    hideChip: hideChip,
    refreshModeButtons: refreshModeButtons,
    registerPopover: registerPopover,
    unregisterPopover: unregisterPopover,
    closeAllPopovers: closeAllPopovers,
    createUI: createUI,
    toggleSettingsPanel: toggleSettingsPanel,
    toggleModesPop: toggleModesPop,
    makeDraggable: makeDraggable,
    placeNearDock: placeNearDock,
    toggleRow: toggleRow,
    sliderRow: sliderRow,
    selectRow: selectRow,
  };
})();
