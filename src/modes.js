/* ===== Calm — src/modes.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Reading "modes" + reading width. v3 will grow this into a full registry
 * (Pause, Pomodoro, Reader, Night/Dim, Presentation, Auto-scroll, Privacy).
 * For now it holds the ported Zen + Width behavior. Exposes window.CALM.modes.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var site = CALM.site;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  // ---- Zen ----
  function applyZen(on) {
    if (on) {
      rt.zenHidden = [];
      site.zenTargets().forEach(function (el) {
        if (!el) return;
        el.style.setProperty("display", "none", "important");
        rt.zenHidden.push(el);
      });
      document.documentElement.classList.add("cit-zen");
      rt.zenOn = true;
      if (S.zenComposer) CALM.core.hideComposer();
    } else {
      rt.zenHidden.forEach(function (el) {
        el.style.removeProperty("display");
      });
      rt.zenHidden = [];
      document.documentElement.classList.remove("cit-zen");
      rt.zenOn = false;
      if (S.zenComposer && rt.composerHidden) CALM.core.showComposer();
    }
    var btn = document.getElementById(IDS.zen);
    if (btn) btn.classList.toggle("cit-active", rt.zenOn);
    if (S.rememberState) CALM.saveState();
  }
  function toggleZen() {
    if (!CALM.entitled("zenMode")) return;
    applyZen(!rt.zenOn);
  }

  // ---- Reading width ----
  function ensureWidthStyle() {
    var st = document.getElementById(IDS.widthStyle);
    if (!st) {
      st = document.createElement("style");
      st.id = IDS.widthStyle;
      st.textContent = site.widthCss();
      document.head.appendChild(st);
    }
  }
  function applyWidth() {
    var w = S.readingWidth | 0;
    if (w > 0 && CALM.entitled("readingWidth")) {
      ensureWidthStyle();
      document.documentElement.style.setProperty(
        "--cit-reading-width",
        w + "px"
      );
      document.documentElement.classList.add("cit-width");
    } else {
      document.documentElement.classList.remove("cit-width");
      document.documentElement.style.removeProperty("--cit-reading-width");
    }
  }

  CALM.modes = {
    applyZen: applyZen,
    toggleZen: toggleZen,
    applyWidth: applyWidth,
  };
})();
