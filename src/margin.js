/* ===== Calm — src/margin.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Margin — controls as marginalia.
 *
 * Chat sites centre their text in a narrow column and leave the sides empty.
 * This puts Calm's controls in that empty gutter, like pencil marks in a
 * book's margin: no panel, no card, no border, nothing overlapping the words.
 * They sit at ~20% opacity until the pointer comes near, then fade up and
 * name themselves.
 *
 * It is a presentation of the dock, not a separate surface: the rail renders
 * INSIDE #cit-dock in place of the pill, so the Console, the popover registry,
 * the Escape stack and the palette all keep working untouched.
 *
 * The gutter is not always there — narrow windows, zoomed pages, sites with a
 * wide layout. measure() returns null in those cases and the dock falls back
 * to the corner pill on its own.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var MIN_GUTTER = 76; // below this the marks would sit on top of the text
  var RAIL_W = 34;
  var resizeTimer = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Where is the text column? ----------
  // Measured from the page, never assumed: the same site renders a different
  // column width with the sidebar open, on a split screen, or zoomed.
  function columnRect() {
    var node = null;
    try {
      var sel = CALM.site.responseSel;
      if (sel) {
        var found = document.querySelectorAll(sel);
        node = found[found.length - 1] || null;
      }
    } catch (_) {}
    if (!node) node = rt.composerEl;
    if (!node || !node.getBoundingClientRect) return null;
    var r = node.getBoundingClientRect();
    if (!r || r.width < 240) return null; // not a text column
    return r;
  }

  // Returns {side, x} for the roomier gutter, or null when neither fits.
  function measure() {
    var r = columnRect();
    if (!r) return null;
    var vw = window.innerWidth || 0;
    var leftFree = Math.max(0, r.left);
    var rightFree = Math.max(0, vw - r.right);
    var side = rightFree >= leftFree ? "right" : "left";
    var free = side === "right" ? rightFree : leftFree;
    if (free < MIN_GUTTER) return null;
    // Centre the rail in the gutter, then keep it clear of the viewport edge.
    var centre = side === "right" ? r.right + free / 2 : r.left - free / 2;
    var x = Math.round(centre - RAIL_W / 2);
    x = Math.max(8, Math.min(vw - RAIL_W - 8, x));
    return { side: side, x: x };
  }

  function fits() {
    return S.menuStyle === "margin" && !!measure();
  }

  // ---------- Marks ----------
  function mark(iconName, label, isOn, onClick, modeId) {
    var b = el("button", "cit-mark");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    if (modeId) b.setAttribute("data-cit-mode", modeId);
    var ic = el("span", "cit-mark-ic");
    if (CALM.icons && CALM.icons[iconName]) ic.innerHTML = CALM.icons[iconName];
    var lb = el("span", "cit-mark-label", label);
    b.appendChild(ic);
    b.appendChild(lb);
    if (isOn && isOn()) b.classList.add("cit-active");
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick();
      refresh();
    });
    return b;
  }

  function timerLabel() {
    var ps = CALM.pomodoro && CALM.pomodoro.state;
    if (!ps || !ps.running) return "";
    return String(Math.max(0, Math.ceil(ps.remaining / 60)));
  }

  function build(host) {
    var rail = el("div", "cit-rail");
    rail.id = IDS.rail;
    rail.setAttribute("role", "toolbar");
    rail.setAttribute("aria-label", "Calm");

    rail.appendChild(
      mark("input", "Input", function () { return !!rt.composerHidden; }, function () {
        CALM.core.manualToggleComposer();
      })
    );
    rail.appendChild(
      mark("zen", "Zen", function () { return CALM.modes.isActive("zen"); }, function () {
        CALM.modes.toggleZen();
      }, "zen")
    );
    rail.appendChild(
      mark("book", "Reader", function () { return CALM.modes.isActive("focusreader"); },
        function () { CALM.modes.toggle("focusreader"); }, "focusreader")
    );

    var t = mark("pomodoro", "Timer", function () {
      return CALM.modes.isActive("pomodoro");
    }, function () { CALM.modes.toggle("pomodoro"); }, "pomodoro");
    var count = el("span", "cit-mark-count", timerLabel());
    t.appendChild(count);
    rail.appendChild(t);

    rail.appendChild(
      mark("settings", "More", function () { return false; }, function () {
        if (CALM.console) CALM.console.toggle();
      })
    );

    host.appendChild(rail);
    return rail;
  }

  // ---------- Placement ----------
  function place(dock) {
    var m = measure();
    if (!m) return false;
    dock.classList.add("cit-margin");
    dock.classList.toggle("cit-rail-right", m.side === "right");
    dock.classList.toggle("cit-rail-left", m.side === "left");
    dock.style.left = m.x + "px";
    dock.style.right = "auto";
    dock.style.top = "50%";
    dock.style.bottom = "auto";
    return true;
  }

  // Patch text in place rather than rebuilding — a rebuild under the cursor
  // destroys the button being hovered and drops keyboard focus.
  function refresh() {
    var rail = document.getElementById(IDS.rail);
    if (!rail) return;
    var c = rail.querySelector(".cit-mark-count");
    var live = timerLabel();
    if (c) c.textContent = live;
    var dock = document.getElementById(IDS.dock);
    if (dock) dock.classList.toggle("cit-margin-live", !!live);
    if (CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
  }

  // Re-measure after anything that can move the text column. Zen removes the
  // site's sidebar, which shifts and widens the column — the marks used to
  // stay where the old edge was, sometimes on top of the words.
  function reposition() {
    if (S.menuStyle !== "margin") return;
    var dock = document.getElementById(IDS.dock);
    if (!dock) return;
    var inMargin = dock.classList.contains("cit-margin");
    var m = measure();
    if (!m && !inMargin) return; // still no gutter, still a pill
    if (m && inMargin) {
      place(dock); // just move it
      return;
    }
    // Gained or lost the gutter: the dock has to change shape.
    if (CALM.dock) CALM.dock.build();
  }

  // The column moves when the window resizes or the site opens its sidebar.
  window.addEventListener(
    "resize",
    function () {
      if (S.menuStyle !== "margin") return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (CALM.dock) CALM.dock.build(); // re-measures, and falls back if it no longer fits
      }, 180);
    },
    { passive: true }
  );

  setInterval(refresh, 1000);

  CALM.margin = {
    build: build,
    place: place,
    measure: measure,
    fits: fits,
    reposition: reposition,
    refresh: refresh,
  };
})();
