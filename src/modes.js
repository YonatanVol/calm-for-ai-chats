/* ===== Calm — src/modes.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Modes registry. Each mode is { label, icon, enter, exit, vars? }.
 * Modes stack (Reader + Night + Zen can all be on). Active modes live in
 * rt.activeModes and persist with remember-state. Reading width is kept here
 * too. Pomodoro delegates to src/pomodoro.js (Phase 2). Exposes window.CALM.modes.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var site = CALM.site;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  function injectStyle(id, css) {
    var s = document.getElementById(id);
    if (!s) {
      s = document.createElement("style");
      s.id = id;
      document.head.appendChild(s);
    }
    s.textContent = css;
    return s;
  }
  function removeEl(id) {
    var e = document.getElementById(id);
    if (e) e.remove();
  }
  function prefix(sel, pre) {
    return sel
      .split(",")
      .map(function (s) {
        return pre + " " + s.trim();
      })
      .join(",");
  }
  function stopTimer(name) {
    if (rt.modeTimers[name]) {
      clearInterval(rt.modeTimers[name]);
      rt.modeTimers[name] = null;
    }
  }

  // ---------- Reading width (kept) ----------
  function ensureWidthStyle() {
    if (!document.getElementById(IDS.widthStyle)) {
      injectStyle(IDS.widthStyle, site.widthCss());
    }
  }
  function applyWidth() {
    var w = S.readingWidth | 0;
    if (w > 0 && CALM.entitled("readingWidth")) {
      ensureWidthStyle();
      document.documentElement.style.setProperty("--cit-reading-width", w + "px");
      document.documentElement.classList.add("cit-width");
    } else {
      document.documentElement.classList.remove("cit-width");
      document.documentElement.style.removeProperty("--cit-reading-width");
    }
  }

  // ---------- Zen ----------
  // Stylesheet-first: a <style> gated on html.cit-zen self-heals when the class
  // is removed, no matter how the SPA re-rendered in between. The inline path
  // (zenInline) is kept only for sites whose own !important rules can beat a
  // stylesheet (ChatGPT); its cleanup strips BOTH saved refs and a fresh query,
  // so stale references can never leave elements permanently hidden.
  function zenEnter() {
    injectStyle("cit-zen-style", site.zenCss());
    rt.zenHidden = [];
    if (site.zenInline) {
      site.zenTargets().forEach(function (el) {
        el.style.setProperty("display", "none", "important");
        rt.zenHidden.push(el);
      });
    }
    document.documentElement.classList.add("cit-zen");
    rt.zenOn = true;
    if (S.zenComposer) CALM.core.hideComposer();
  }
  function zenExit() {
    document.documentElement.classList.remove("cit-zen");
    removeEl("cit-zen-style");
    rt.zenHidden.concat(site.zenTargets()).forEach(function (el) {
      try {
        el.style.removeProperty("display");
      } catch (_) {}
    });
    rt.zenHidden = [];
    rt.zenOn = false;
    if (S.zenComposer && rt.composerHidden) CALM.core.showComposer();
  }

  // ---------- Reader (typography) ----------
  function readerVars() {
    document.documentElement.style.setProperty(
      "--cit-reader-fs",
      S.readerFontScale / 100 + "em"
    );
    document.documentElement.style.setProperty(
      "--cit-reader-lh",
      String(S.readerLineHeight / 10)
    );
  }
  function readerEnter() {
    var t = prefix(site.readerTargets(), "html.cit-reader");
    injectStyle(
      "cit-reader-style",
      t +
        "{font-size:var(--cit-reader-fs)!important;line-height:var(--cit-reader-lh)!important;}"
    );
    readerVars();
    document.documentElement.classList.add("cit-reader");
  }
  function readerExit() {
    document.documentElement.classList.remove("cit-reader");
    removeEl("cit-reader-style");
  }

  // ---------- Night / Dim ----------
  function nightVars() {
    document.documentElement.style.setProperty(
      "--cit-night-opacity",
      String(S.nightLevel / 100)
    );
  }
  function nightEnter() {
    if (!document.getElementById("cit-night-overlay")) {
      var o = document.createElement("div");
      o.id = "cit-night-overlay";
      (document.documentElement || document.body).appendChild(o);
    }
    nightVars();
    document.documentElement.classList.add("cit-night");
  }
  function nightExit() {
    removeEl("cit-night-overlay");
    document.documentElement.classList.remove("cit-night");
  }

  // ---------- Privacy / Share (blur sidebar titles) ----------
  function privacyEnter() {
    var t = prefix(site.privacyTargets(), "html.cit-privacy");
    var th = t
      .split(",")
      .map(function (s) {
        return s + ":hover";
      })
      .join(",");
    injectStyle(
      "cit-privacy-style",
      t +
        "{filter:blur(5px)!important;transition:filter .12s ease;}" +
        th +
        "{filter:none!important;}"
    );
    document.documentElement.classList.add("cit-privacy");
  }
  function privacyExit() {
    document.documentElement.classList.remove("cit-privacy");
    removeEl("cit-privacy-style");
  }

  // ---------- Presentation / Screenshot ----------
  function presentationEnter() {
    document.documentElement.classList.add("cit-presentation");
    if (!rt.activeModes.zen) modeEnter("zen");
  }
  function presentationExit() {
    document.documentElement.classList.remove("cit-presentation");
  }

  // ---------- Auto-scroll (teleprompter) ----------
  function autoscrollEnter() {
    stopTimer("autoscroll");
    rt.modeTimers.autoscroll = setInterval(function () {
      var sc = rt.scrollContainer;
      if (!sc) return;
      sc.scrollTop += Math.max(1, S.autoScrollSpeed | 0);
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) {
        modeExit("autoscroll");
      }
    }, 60);
  }
  function autoscrollExit() {
    stopTimer("autoscroll");
  }

  // ---------- Pause / Snooze (suspend auto-hide) ----------
  function pauseEnter() {
    rt.paused = true;
    stopTimer("pause");
    var end = Date.now() + Math.max(1, S.pauseMinutes | 0) * 60000;
    tickPause(end);
    rt.modeTimers.pause = setInterval(function () {
      if (Date.now() >= end) modeExit("pause");
      else tickPause(end);
    }, 1000);
  }
  function tickPause(end) {
    var left = Math.max(0, end - Date.now());
    var m = Math.floor(left / 60000);
    var s = Math.floor((left % 60000) / 1000);
    if (CALM.ui.showChip)
      CALM.ui.showChip(
        "pause",
        "⏸ Auto-hide paused · " + m + ":" + (s < 10 ? "0" + s : s)
      );
  }
  function pauseExit() {
    rt.paused = false;
    stopTimer("pause");
    if (CALM.ui.hideChip) CALM.ui.hideChip("pause");
  }

  // ---------- Pomodoro (implemented in src/pomodoro.js, Phase 2) ----------
  function pomodoroEnter() {
    if (CALM.pomodoro) CALM.pomodoro.start();
  }
  function pomodoroExit() {
    if (CALM.pomodoro) CALM.pomodoro.stop();
  }

  // ---------- Registry ----------
  var MODES = {
    zen: { label: "Zen", icon: "❏", enter: zenEnter, exit: zenExit },
    reader: { label: "Reader", icon: "A", enter: readerEnter, exit: readerExit, vars: readerVars },
    night: { label: "Night", icon: "☾", enter: nightEnter, exit: nightExit, vars: nightVars },
    privacy: { label: "Privacy", icon: "⦿", enter: privacyEnter, exit: privacyExit },
    presentation: { label: "Present", icon: "▣", enter: presentationEnter, exit: presentationExit },
    autoscroll: { label: "Auto-scroll", icon: "↧", enter: autoscrollEnter, exit: autoscrollExit },
    pause: { label: "Pause", icon: "⏸", enter: pauseEnter, exit: pauseExit },
    pomodoro: { label: "Pomodoro", icon: "◴", enter: pomodoroEnter, exit: pomodoroExit },
  };

  function setModeBtnActive(id, on) {
    if (id === "zen") {
      var b = document.getElementById(IDS.zen);
      if (b) b.classList.toggle("cit-active", on);
    }
    if (CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
  }
  function persist() {
    if (S.rememberState) CALM.saveState();
  }
  function modeEnter(id) {
    var m = MODES[id];
    if (!m || rt.activeModes[id]) return;
    if (!CALM.entitled("zenMode")) return; // all modes free in v1
    rt.activeModes[id] = true;
    m.enter();
    setModeBtnActive(id, true);
    persist();
  }
  function modeExit(id) {
    var m = MODES[id];
    if (!m || !rt.activeModes[id]) return;
    rt.activeModes[id] = false;
    m.exit();
    setModeBtnActive(id, false);
    persist();
  }
  function modeToggle(id) {
    if (rt.activeModes[id]) modeExit(id);
    else modeEnter(id);
  }
  function isActive(id) {
    return !!rt.activeModes[id];
  }
  // Re-apply live slider values for whichever modes are on.
  function refreshVars() {
    Object.keys(MODES).forEach(function (id) {
      if (rt.activeModes[id] && MODES[id].vars) MODES[id].vars();
    });
  }

  CALM.modes = {
    MODES: MODES,
    enter: modeEnter,
    exit: modeExit,
    toggle: modeToggle,
    isActive: isActive,
    refreshVars: refreshVars,
    applyWidth: applyWidth,
    // back-compat aliases used by core/ui/keyboard:
    applyZen: function (on) {
      on ? modeEnter("zen") : modeExit("zen");
    },
    toggleZen: function () {
      modeToggle("zen");
    },
  };
})();
