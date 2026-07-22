/* ===== Calm — src/dock.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Bloom engine. One Maison pill anchored to a CORNER (not an absolute
 * left/top), so it stays glued through window resizes and its 3×3 control
 * tile always blooms INWARD — opening off-screen is geometrically impossible.
 * Motion is compositor-only (opacity/transform with a spring curve); tiles
 * stagger radially outward from the pill's corner like a flower opening.
 * Position persists per device as {corner, dx, dy} (v2; v1 {left,top}
 * migrates automatically). Quiet mode fades the pill while you type.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var POS_KEY = "cit-dock-pos";
  var collapseTimer = null;
  var quietTimer = null;

  // ---------- Corner position model ----------
  function defaultPos() {
    return { corner: "br", dx: 20, dy: 20 };
  }
  function loadPos() {
    try {
      var p = JSON.parse(localStorage.getItem(POS_KEY));
      if (p && p.corner) return p;
      if (p && typeof p.left === "number") return migrateV1(p); // old shape
    } catch (_) {}
    return defaultPos();
  }
  function savePos(pos) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch (_) {}
  }
  function migrateV1(p) {
    var iw = window.innerWidth || 1400;
    var ih = window.innerHeight || 900;
    var w = 120, h = 40; // approximate pill box; corner choice is what matters
    var horiz = p.left + w / 2 < iw / 2 ? "l" : "r";
    var vert = p.top + h / 2 < ih / 2 ? "t" : "b";
    var pos = {
      corner: vert + horiz, // "br","bl","tr","tl"
      dx: Math.max(12, horiz === "l" ? p.left : iw - p.left - w),
      dy: Math.max(12, vert === "t" ? p.top : ih - p.top - h),
    };
    savePos(pos);
    return pos;
  }
  function nearestCorner(rect) {
    var iw = window.innerWidth || 1400;
    var ih = window.innerHeight || 900;
    var horiz = rect.left + rect.width / 2 < iw / 2 ? "l" : "r";
    var vert = rect.top + rect.height / 2 < ih / 2 ? "t" : "b";
    return {
      corner: vert + horiz,
      dx: Math.max(12, Math.round(horiz === "l" ? rect.left : iw - rect.left - rect.width)),
      dy: Math.max(12, Math.round(vert === "t" ? rect.top : ih - rect.top - rect.height)),
    };
  }
  function applyPos(d, pos) {
    d.style.left = d.style.right = d.style.top = d.style.bottom = "auto";
    if (pos.corner.indexOf("l") >= 0) d.style.left = pos.dx + "px";
    else d.style.right = pos.dx + "px";
    if (pos.corner.indexOf("t") >= 0) d.style.top = pos.dy + "px";
    else d.style.bottom = pos.dy + "px";
    ["br", "bl", "tr", "tl"].forEach(function (c) {
      d.classList.toggle("cit-corner-" + c, pos.corner === c);
    });
    staggerFor(pos.corner);
  }

  // ---------- Radial bloom stagger ----------
  // Delay grows with Chebyshev distance from the grid cell nearest the pill,
  // so tiles open outward from the pill's corner — the bloom.
  function staggerFor(corner) {
    var bloom = document.getElementById(IDS.bloom);
    if (!bloom) return;
    var originRow = corner.indexOf("t") >= 0 ? 0 : 2;
    var originCol = corner.indexOf("l") >= 0 ? 0 : 2;
    var tiles = bloom.querySelectorAll(".cit-tile");
    for (var i = 0; i < tiles.length && i < 9; i++) {
      var row = Math.floor(i / 3);
      var col = i % 3;
      var dist = Math.max(Math.abs(row - originRow), Math.abs(col - originCol));
      tiles[i].style.transitionDelay = dist * 0.038 + "s";
    }
  }

  // ---------- Status ----------
  function statusText() {
    var parts = [];
    var goal = CALM.intent && CALM.intent.state && CALM.intent.state.goal;
    if (S.intentChipMode === "dock" && S.intentionPrompt && goal) {
      parts.push(goal.length > 24 ? goal.slice(0, 24) + "…" : goal);
    }
    var ps = CALM.pomodoro && CALM.pomodoro.state;
    if (ps && ps.running) {
      var m = Math.floor(ps.remaining / 60);
      var s = ps.remaining % 60;
      parts.push(m + ":" + (s < 10 ? "0" + s : s));
    }
    return parts.join("  ·  ");
  }
  function refreshStatus() {
    var d = document.getElementById(IDS.dock);
    if (!d) return;
    var t = statusText();
    var el = d.querySelector(".cit-dock-status");
    if (el) {
      el.textContent = t;
      el.style.display = t ? "" : "none";
    }
    // The tray's engraved lid: the maison name until there's something to say.
    var head = d.querySelector(".cit-bloom-head");
    if (head) {
      head.textContent = t || "CALM";
      head.classList.toggle("cit-head-live", !!t);
    }
  }

  // ---------- Open / collapse ----------
  function bump() {
    clearTimeout(collapseTimer);
    if (S.dockAutoCollapse) collapseTimer = setTimeout(collapse, 6000);
  }
  function expand() {
    var d = document.getElementById(IDS.dock);
    if (d) {
      d.classList.add("cit-dock-open");
      bump();
    }
  }
  function collapse() {
    var d = document.getElementById(IDS.dock);
    if (d) d.classList.remove("cit-dock-open");
    clearTimeout(collapseTimer);
  }
  function toggleOpen() {
    var d = document.getElementById(IDS.dock);
    if (!d) return;
    if (d.classList.contains("cit-dock-open")) collapse();
    else expand();
  }

  // ---------- Tiles ----------
  function tile(icon, label, onClick, id, quiet) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cit-tile" + (quiet ? " cit-tile-quiet" : "");
    if (id) b.id = id;
    b.title = label;
    b.setAttribute("aria-label", label);
    var ic = document.createElement("span");
    ic.className = "cit-tile-ic";
    ic.innerHTML = icon; // static markup from our icon set only
    var lb = document.createElement("span");
    lb.className = "cit-tile-label";
    lb.textContent = label;
    b.appendChild(ic);
    b.appendChild(lb);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick(e);
      bump();
    });
    return b;
  }

  function build() {
    var old = document.getElementById(IDS.dock);
    if (old) old.remove();

    var d = document.createElement("div");
    d.id = IDS.dock;

    var IC = CALM.icons;
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "cit-dock-pill";
    pill.setAttribute("aria-label", "Calm");
    pill.innerHTML =
      '<span class="cit-dock-mark">' + IC.mark +
      '</span><span class="cit-dock-status"></span>';
    pill.addEventListener("click", function (e) {
      e.stopPropagation();
      unquiet();
      toggleOpen();
    });
    d.appendChild(pill);

    var bloom = document.createElement("div");
    bloom.id = IDS.bloom;
    bloom.setAttribute("role", "menu");

    // Engraved lid: the maison name, replaced by live status when there is any.
    var head = document.createElement("div");
    head.className = "cit-bloom-head";
    bloom.appendChild(head);

    // Row 1 — what you came for. Row 2 — the session. Row 3 — the plumbing.
    bloom.appendChild(
      tile('<span class="cit-icon">' + IC.input + "</span>", "Input", function () {
        CALM.core.manualToggleComposer();
      }, IDS.toggle)
    );
    bloom.appendChild(tile(IC.zen, "Zen", function () {
      CALM.modes.toggleZen();
    }, IDS.zen));
    bloom.appendChild(tile(IC.focus, "Focus", function () {
      if (CALM.intent) CALM.intent.toggle(false);
    }));

    bloom.appendChild(tile(IC.pomodoro, "Timer", function () {
      CALM.modes.toggle("pomodoro");
      refreshStatus();
    }, "cit-tile-pomodoro"));
    bloom.appendChild(tile(IC.pause, "Pause", function () {
      CALM.modes.toggle("pause");
    }, "cit-tile-pause"));
    bloom.appendChild(tile(IC.modes, "Modes", function () {
      CALM.ui.toggleModesPop();
    }));

    bloom.appendChild(tile(IC.top, "Top", function () {
      CALM.ui.smoothScrollTo(0);
    }, IDS.top, true));
    bloom.appendChild(tile(IC.bottom, "End", function () {
      CALM.ui.smoothScrollTo(rt.scrollContainer ? rt.scrollContainer.scrollHeight : 0);
    }, IDS.bottom, true));
    bloom.appendChild(tile(IC.settings, "Settings", function () {
      CALM.ui.toggleSettingsPanel();
    }, IDS.settings, true));
    d.appendChild(bloom);

    document.body.appendChild(d);
    applyPos(d, loadPos());

    // Drag the pill; on drop, snap to the nearest corner and persist v2.
    CALM.ui.makeDraggable(d, null, {
      handle: pill,
      onDrop: function (rect) {
        var pos = nearestCorner(rect);
        savePos(pos);
        applyPos(d, pos);
      },
    });

    refreshStatus();
    if (CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
    if (CALM.ui.updateQuickNav) CALM.ui.updateQuickNav();
  }

  // ---------- Quiet pill (fades while you type; wakes on approach) ----------
  function quiet() {
    if (!S.dockQuiet) return;
    var d = document.getElementById(IDS.dock);
    if (d && !d.classList.contains("cit-dock-open")) d.classList.add("cit-quiet");
    clearTimeout(quietTimer);
    quietTimer = setTimeout(unquiet, 4000);
  }
  function unquiet() {
    var d = document.getElementById(IDS.dock);
    if (d) d.classList.remove("cit-quiet");
    clearTimeout(quietTimer);
  }
  document.addEventListener(
    "input",
    function (e) {
      if (rt.composerEl && e.target && rt.composerEl.contains(e.target)) quiet();
    },
    true
  );
  document.addEventListener(
    "pointermove",
    function (e) {
      var d = document.getElementById(IDS.dock);
      if (!d || !d.classList.contains("cit-quiet")) return;
      var r = d.getBoundingClientRect();
      if (
        e.clientX > r.left - 120 && e.clientX < r.right + 120 &&
        e.clientY > r.top - 120 && e.clientY < r.bottom + 120
      ) {
        unquiet();
      }
    },
    { passive: true }
  );

  // Outside click folds the bloom. (Close is not a tile — the pill, a click
  // away, and Esc all dismiss it; a dedicated CLOSE cell was just furniture.)
  document.addEventListener(
    "click",
    function (e) {
      var d = document.getElementById(IDS.dock);
      if (d && d.classList.contains("cit-dock-open") && !d.contains(e.target)) {
        collapse();
      }
    },
    true
  );
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var d = document.getElementById(IDS.dock);
    if (d && d.classList.contains("cit-dock-open")) collapse();
  });

  setInterval(refreshStatus, 1000);

  CALM.dock = {
    build: build,
    expand: expand,
    collapse: collapse,
    refreshStatus: refreshStatus,
    _nearestCorner: nearestCorner, // exposed for tests
    _loadPos: loadPos,
  };
})();
