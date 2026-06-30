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
  function showToast() {
    var now = Date.now();
    if (now - rt.lastToastAt < C.TOAST_THROTTLE_MS) return;
    rt.lastToastAt = now;
    var t = document.getElementById(IDS.toast);
    if (!t) {
      t = document.createElement("div");
      t.id = IDS.toast;
      document.body.appendChild(t);
    }
    t.textContent = "Input hidden · scroll down or ⌃⇧H";
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
      p.remove();
    });
    header.appendChild(title);
    header.appendChild(close);
    p.appendChild(header);

    p.appendChild(toggleRow("Auto-hide on scroll", "autoHideOnScroll"));
    p.appendChild(sliderRow("Scroll sensitivity", "sensitivity", 1, 10, 1));
    p.appendChild(toggleRow("Zen also hides input", "zenComposer"));
    p.appendChild(
      toggleRow("Remember state", "rememberState", function () {
        if (S.rememberState) CALM.saveState();
      })
    );
    p.appendChild(toggleRow("Quick scroll buttons", "showQuickNav", updateQuickNav));
    p.appendChild(
      sliderRow("Reading width (0=off)", "readingWidth", 0, 1600, 20, CALM.modes.applyWidth)
    );
    p.appendChild(toggleRow("Keyboard shortcuts", "keyboardShortcut"));
    p.appendChild(
      toggleRow("Show toggle button", "showToggleButton", function () {
        var b = document.getElementById(IDS.toggle);
        if (b) b.style.display = S.showToggleButton ? "" : "none";
      })
    );
    p.appendChild(toggleRow("Hint when auto-hidden", "showHints"));

    document.body.appendChild(p);

    function closeOnOutside(e) {
      if (!p.contains(e.target) && e.target.id !== IDS.settings) {
        p.remove();
        document.removeEventListener("click", closeOnOutside, true);
      }
    }
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
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

  CALM.ui = {
    showToast: showToast,
    hideToast: hideToast,
    updateQuickNav: updateQuickNav,
    smoothScrollTo: smoothScrollTo,
    createUI: createUI,
    toggleSettingsPanel: toggleSettingsPanel,
    toggleRow: toggleRow,
    sliderRow: sliderRow,
  };
})();
