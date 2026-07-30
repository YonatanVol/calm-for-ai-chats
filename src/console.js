/* ===== Calm — src/console.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Console — Calm's one menu.
 *
 * It replaces three surfaces that used to overlap: the 3x3 bloom tray, the
 * modes popover, and the tabbed settings panel (whose first tab was "Modes"
 * again). Everything now lives in a single panel anchored to the pill, and
 * the long tail of settings slides in as a drawer *inside* that panel rather
 * than opening a second floating window.
 *
 * Layout is deliberately unequal — a wide live tile, three quick tiles, inline
 * sliders, a mode row — so hierarchy comes from size and weight instead of a
 * grid of identical squares.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var collapseTimer = null;
  var unEsc = null;
  var view = "main"; // "main" | "advanced"

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) {
    var s = el("span", "cit-ic");
    if (CALM.icons && CALM.icons[name]) s.innerHTML = CALM.icons[name]; // own set
    return s;
  }
  function root() {
    return document.getElementById(IDS.console);
  }

  // ---------- open / close ----------
  function bump() {
    clearTimeout(collapseTimer);
    if (S.dockAutoCollapse && view === "main") {
      collapseTimer = setTimeout(close, 6000);
    }
  }
  function isOpen() {
    var d = document.getElementById(IDS.dock);
    return !!d && d.classList.contains("cit-dock-open");
  }
  function open() {
    var d = document.getElementById(IDS.dock);
    if (!d) return;
    setView("main");
    render();
    d.classList.add("cit-dock-open");
    if (!unEsc && CALM.ui.registerEscape) {
      unEsc = CALM.ui.registerEscape(function () {
        if (!isOpen()) return false;
        close();
        return true;
      });
    }
    bump();
  }
  function close() {
    var d = document.getElementById(IDS.dock);
    if (d) d.classList.remove("cit-dock-open");
    clearTimeout(collapseTimer);
    setView("main");
    if (unEsc) { unEsc(); unEsc = null; }
  }
  function toggle() {
    isOpen() ? close() : open();
  }
  function setView(v) {
    view = v;
    var c = root();
    if (c) c.classList.toggle("cit-con-adv", v === "advanced");
    if (v === "advanced") clearTimeout(collapseTimer);
  }

  // ---------- pieces ----------
  function quickTile(id, iconName, label, isOn, onClick) {
    var b = el("button", "cit-qt");
    b.type = "button";
    b.id = id || "";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.appendChild(icon(iconName));
    b.appendChild(el("span", "cit-qt-label", label));
    if (isOn && isOn()) b.classList.add("cit-active");
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick();
      render();
      bump();
    });
    return b;
  }

  // The live tile: the timer when one is running, an invitation when not.
  // Pause lives here too — it is a state of the session, not a "mode".
  function liveTile() {
    var ps = CALM.pomodoro && CALM.pomodoro.state;
    var running = !!(ps && ps.running);
    var t = el("div", "cit-live" + (running ? " cit-live-on" : ""));

    var main = el("div", "cit-live-main");
    if (running) {
      var m = Math.floor(ps.remaining / 60);
      var s = ps.remaining % 60;
      main.appendChild(el("div", "cit-live-time", m + ":" + (s < 10 ? "0" + s : s)));
      main.appendChild(
        el("div", "cit-live-sub", ps.phase + " · " + ps.cycle + "/" + (S.pomoCycles | 0))
      );
    } else {
      var goal = CALM.intent && CALM.intent.state && CALM.intent.state.goal;
      main.appendChild(el("div", "cit-live-idle", goal || "Start a focus block"));
      main.appendChild(
        el("div", "cit-live-sub", (S.pomoFocusMin | 0) + " min · " + (S.pomoBreakMin | 0) + " break")
      );
    }
    main.addEventListener("click", function (e) {
      e.stopPropagation();
      CALM.modes.toggle("pomodoro");
      render();
      bump();
    });
    t.appendChild(main);

    var side = el("div", "cit-live-side");
    var pauseOn = CALM.modes.isActive("pause");
    var pb = el("button", "cit-live-btn" + (pauseOn ? " cit-active" : ""));
    pb.type = "button";
    pb.title = pauseOn ? "Resume auto-hide" : "Pause auto-hide";
    pb.setAttribute("aria-label", pb.title);
    pb.appendChild(icon("pause"));
    pb.addEventListener("click", function (e) {
      e.stopPropagation();
      CALM.modes.toggle("pause");
      render();
      bump();
    });
    var fb = el("button", "cit-live-btn");
    fb.type = "button";
    fb.title = "Intention";
    fb.setAttribute("aria-label", "Intention");
    fb.appendChild(icon("focus"));
    fb.addEventListener("click", function (e) {
      e.stopPropagation();
      if (CALM.intent) CALM.intent.toggle(false);
      bump();
    });
    side.appendChild(pb);
    side.appendChild(fb);
    t.appendChild(side);
    return t;
  }

  function inlineSlider(label, key, min, max, step, after) {
    var r = el("div", "cit-con-slider");
    r.appendChild(el("span", "cit-con-slabel", label));
    var i = document.createElement("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(step || 1);
    i.value = String(S[key] | 0);
    i.setAttribute("aria-label", label);
    var out = el("span", "cit-con-sval", String(S[key] | 0));
    i.addEventListener("input", function (e) {
      e.stopPropagation();
      S[key] = parseInt(i.value, 10);
      out.textContent = String(S[key]);
      CALM.saveSettings();
      if (after) after();
      bump();
    });
    r.appendChild(i);
    r.appendChild(out);
    return r;
  }

  function modeChip(id) {
    var m = CALM.modes.MODES[id];
    var b = el("button", "cit-chipm" + (CALM.modes.isActive(id) ? " cit-active" : ""));
    b.type = "button";
    b.setAttribute("data-cit-mode", id);
    b.title = m.label;
    var ic = el("span", "cit-chipm-ic");
    if (CALM.icons && CALM.icons.mode[id]) ic.innerHTML = CALM.icons.mode[id];
    b.appendChild(ic);
    b.appendChild(el("span", null, m.label));
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      CALM.modes.toggle(id);
      render();
      bump();
    });
    return b;
  }

  // ---------- the two views ----------
  function buildMain(c) {
    c.appendChild(liveTile());

    var quick = el("div", "cit-quick");
    var inputTile = quickTile(IDS.toggle, "input", "Input", function () {
      return !!rt.composerHidden;
    }, function () {
      CALM.core.manualToggleComposer();
    });
    // Honoured at BUILD time, and dimmed rather than removed so the row keeps
    // its three columns. (The old tray set display:none from the settings
    // handler, which both punched a hole in the grid and was silently undone
    // by the next rebuild.)
    if (!S.showToggleButton) inputTile.classList.add("cit-qt-dim");
    quick.appendChild(inputTile);
    quick.appendChild(
      quickTile(IDS.zen, "zen", "Zen", function () {
        return CALM.modes.isActive("zen");
      }, function () {
        CALM.modes.toggleZen();
      })
    );
    quick.appendChild(
      quickTile(null, "book", "Reader", function () {
        return CALM.modes.isActive("focusreader");
      }, function () {
        CALM.modes.toggle("focusreader");
      })
    );
    c.appendChild(quick);

    c.appendChild(inlineSlider("Width", "readingWidth", 0, 1400, 20, CALM.modes.applyWidth));
    c.appendChild(inlineSlider("Text", "readerFontScale", 80, 160, 5, CALM.modes.applyReaderType));

    var row = el("div", "cit-modes-row");
    CALM.modes.bySurface("tile").forEach(function (id) {
      if (id === "zen" || id === "focusreader" || id === "pomodoro") return; // already above
      row.appendChild(modeChip(id));
    });
    c.appendChild(row);

    var foot = el("div", "cit-con-foot");
    var adv = el("button", "cit-con-adv-btn", "Advanced");
    adv.type = "button";
    adv.addEventListener("click", function (e) {
      e.stopPropagation();
      setView("advanced");
      render();
    });
    adv.appendChild(icon("chevron"));
    var hint = el("span", "cit-con-hint", CALM.palette ? "⌘K" : "");
    foot.appendChild(hint);
    foot.appendChild(adv);
    c.appendChild(foot);
  }

  function buildAdvanced(c) {
    var head = el("div", "cit-con-head");
    var back = el("button", "cit-con-back");
    back.type = "button";
    back.setAttribute("aria-label", "Back");
    back.appendChild(icon("collapse"));
    back.addEventListener("click", function (e) {
      e.stopPropagation();
      setView("main");
      render();
    });
    head.appendChild(back);
    head.appendChild(el("span", "cit-con-title", "Advanced"));
    c.appendChild(head);

    var body = el("div", "cit-con-scroll");
    CALM.ui.buildAdvancedSections(body);
    c.appendChild(body);
  }

  function render() {
    var c = root();
    if (!c) return;
    c.innerHTML = "";
    c.classList.toggle("cit-con-adv", view === "advanced");
    if (view === "advanced") buildAdvanced(c);
    else buildMain(c);
    if (CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
    if (CALM.ui.updateQuickNav) CALM.ui.updateQuickNav();
  }

  // Cheap refresh while a timer runs — only the live tile changes, and only
  // while the Console is actually open.
  function tick() {
    if (!isOpen() || view !== "main") return;
    var c = root();
    var live = c && c.querySelector(".cit-live");
    if (live) c.replaceChild(liveTile(), live);
  }
  setInterval(tick, 1000);

  CALM.console = {
    create: function (host) {
      var c = el("div");
      c.id = IDS.console;
      c.setAttribute("role", "menu");
      host.appendChild(c);
      render();
      return c;
    },
    open: open,
    close: close,
    toggle: toggle,
    render: render,
    isOpen: isOpen,
  };
})();
