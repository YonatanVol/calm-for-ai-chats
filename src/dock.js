/* ===== Calm — src/dock.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The pill and its anchoring. One pill anchored to a CORNER (not an absolute
 * left/top), so it stays glued through window resizes and the Console always
 * opens INWARD — off-screen is geometrically impossible. Position persists
 * per device as {corner, dx, dy} (v2; v1 {left,top} migrates automatically).
 * Quiet mode fades the pill while you type.
 *
 * The pill's contents are the Console (src/console.js); this module owns only
 * where it sits and how it is dragged.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var POS_KEY = "cit-dock-pos";
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
    var elx = d.querySelector(".cit-dock-status");
    if (!elx) return;
    var t = statusText();
    elx.textContent = t;
    elx.style.display = t ? "" : "none";
  }

  // ---------- Open / collapse (the Console owns its own state) ----------
  function expand() {
    if (CALM.console) CALM.console.open();
  }
  function collapse() {
    if (CALM.console) CALM.console.close();
  }
  function toggleOpen() {
    if (CALM.console) CALM.console.toggle();
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

    CALM.console.create(d);

    document.body.appendChild(d);
    // Render only once the dock is IN the document: the Console resolves its
    // own node by id, so rendering while detached was a silent no-op.
    CALM.console.render();
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
  // Escape is owned by one shared handler in src/ui.js. The Console pushes a
  // closer onto that stack while it is open (see console.js), so a single
  // listener dismisses whatever is topmost instead of four modules each
  // binding their own.

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
