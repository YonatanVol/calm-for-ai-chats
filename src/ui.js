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

  // ---- Buttons ----
  function mkBtn(id, label, title, onClick) {
    var b = document.createElement("button");
    b.id = id;
    b.type = "button";
    b.className = "cit-btn";
    b.setAttribute("aria-label", title);
    b.setAttribute("title", title);
    b.innerHTML = label;
    b.addEventListener("click", onClick);
    document.body.appendChild(b);
    return b;
  }

  function createUI() {
    [IDS.toggle, IDS.zen, IDS.settings, IDS.top, IDS.bottom].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.remove();
    });

    var toggle = mkBtn(
      IDS.toggle,
      '<span class="cit-icon">▼</span>',
      "Toggle input (Ctrl+Shift+H)",
      function () {
        CALM.core.manualToggleComposer();
      }
    );
    if (!S.showToggleButton) toggle.style.display = "none";

    mkBtn(IDS.zen, "❏", "Zen mode (Ctrl+Shift+Z)", function () {
      CALM.modes.toggleZen();
    }).classList.toggle("cit-active", rt.zenOn);

    mkBtn(IDS.settings, "⚙", "Calm settings", function (e) {
      e.stopPropagation();
      toggleSettingsPanel();
    });

    mkBtn(IDS.top, "⤒", "Scroll to top", function () {
      smoothScrollTo(0);
    });
    mkBtn(IDS.bottom, "⤓", "Scroll to bottom", function () {
      smoothScrollTo(rt.scrollContainer ? rt.scrollContainer.scrollHeight : 0);
    });
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
    close.innerHTML = "✕";
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

    // Single close path so the outside-click listener never leaks.
    function closePanel() {
      p.remove();
      document.removeEventListener("click", closeOnOutside, true);
    }
    function closeOnOutside(e) {
      if (!p.contains(e.target) && e.target.id !== IDS.settings) closePanel();
    }
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  function buildModesTab(c) {
    ["zen", "reader", "night", "privacy", "presentation", "autoscroll", "pause", "pomodoro"].forEach(
      function (id) {
        c.appendChild(modeRow(id));
      }
    );
    c.appendChild(divider("Mode settings"));
    c.appendChild(sliderRow("Auto-scroll speed", "autoScrollSpeed", 1, 10, 1));
    c.appendChild(sliderRow("Pause minutes", "pauseMinutes", 5, 60, 5));
    c.appendChild(divider("Pomodoro"));
    c.appendChild(sliderRow("Focus minutes", "pomoFocusMin", 5, 60, 5));
    c.appendChild(sliderRow("Break minutes", "pomoBreakMin", 1, 20, 1));
    c.appendChild(sliderRow("Long break minutes", "pomoLongBreakMin", 5, 30, 5));
    c.appendChild(sliderRow("Cycles before long break", "pomoCycles", 2, 8, 1));
    c.appendChild(toggleRow("Auto Zen during focus", "pomoAutoZen"));
    c.appendChild(toggleRow("Chime at phase end", "pomoSound"));
  }
  function buildReadingTab(c) {
    c.appendChild(sliderRow("Reading width (0=off)", "readingWidth", 0, 1600, 20, CALM.modes.applyWidth));
    c.appendChild(sliderRow("Reader font %", "readerFontScale", 80, 160, 5, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Reader line-height ×10", "readerLineHeight", 12, 22, 1, CALM.modes.refreshVars));
    c.appendChild(sliderRow("Night dim %", "nightLevel", 10, 70, 5, CALM.modes.refreshVars));
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
    span.textContent = m.icon + "  " + m.label;
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
    createUI: createUI,
    toggleSettingsPanel: toggleSettingsPanel,
    toggleRow: toggleRow,
    sliderRow: sliderRow,
    selectRow: selectRow,
  };
})();
