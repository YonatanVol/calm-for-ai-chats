/* ===== Calm — src/dock.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Calm Dock: ONE draggable pill that replaces the old stack of floating
 * buttons. Collapsed it shows the ❏ mark plus live micro-status (🎯 goal,
 * Pomodoro countdown); clicking expands a staggered row of actions. Position
 * persists per device (localStorage, not synced). Loaded after ui.js;
 * CALM.ui.createUI() delegates here so core.js stays unchanged.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var collapseTimer = null;

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
    var el = d.querySelector(".cit-dock-status");
    if (!el) return;
    var t = statusText();
    el.textContent = t;
    el.style.display = t ? "" : "none";
  }

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

  function item(icon, title, onClick, id) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cit-dock-item";
    if (id) b.id = id;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icon;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick(e);
      bump();
    });
    return b;
  }

  // Orientation classes from the dock's position (set on drag/restore).
  function orient(l) {
    var d = document.getElementById(IDS.dock);
    if (!d) return;
    var iw = window.innerWidth || 1400;
    d.classList.toggle("cit-dock-leftish", l < iw / 2);
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
      '<span class="cit-dock-mark">' + IC.mark + '</span><span class="cit-dock-status"></span>';
    pill.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleOpen();
    });
    d.appendChild(pill);

    var row = document.createElement("div");
    row.className = "cit-dock-items";
    row.appendChild(
      item('<span class="cit-icon">' + IC.input + "</span>", "Toggle input (⌃⇧H)", function () {
        CALM.core.manualToggleComposer();
      }, IDS.toggle)
    );
    row.appendChild(
      item(IC.zen, "Zen (⌃⇧Z)", function () {
        CALM.modes.toggleZen();
      }, IDS.zen)
    );
    row.appendChild(
      item(IC.modes, "Modes", function () {
        CALM.ui.toggleModesPop();
      })
    );
    row.appendChild(
      item(IC.pomodoro, "Pomodoro", function () {
        CALM.modes.toggle("pomodoro");
        refreshStatus();
      })
    );
    row.appendChild(
      item(IC.focus, "Focus panel (⌃⇧K)", function () {
        if (CALM.intent) CALM.intent.toggle(false);
      })
    );
    row.appendChild(
      item(IC.top, "Scroll to top", function () {
        CALM.ui.smoothScrollTo(0);
      }, IDS.top)
    );
    row.appendChild(
      item(IC.bottom, "Scroll to bottom", function () {
        CALM.ui.smoothScrollTo(
          rt.scrollContainer ? rt.scrollContainer.scrollHeight : 0
        );
      }, IDS.bottom)
    );
    row.appendChild(
      item(IC.settings, "Settings", function () {
        CALM.ui.toggleSettingsPanel();
      }, IDS.settings)
    );
    row.appendChild(item(IC.collapse, "Collapse", collapse));
    d.appendChild(row);

    document.body.appendChild(d);
    CALM.ui.makeDraggable(d, "cit-dock-pos", {
      handle: pill,
      snap: true,
      onPlace: orient,
    });
    refreshStatus();
    if (CALM.ui.refreshModeButtons) CALM.ui.refreshModeButtons();
  }

  // Outside click folds the dock.
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

  setInterval(refreshStatus, 1000);

  CALM.dock = {
    build: build,
    expand: expand,
    collapse: collapse,
    refreshStatus: refreshStatus,
  };
})();
