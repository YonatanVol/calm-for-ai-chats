/* ===== Calm — src/intent.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Working-memory pack (ADHD): the #1 online failure mode is forgetting why you
 * opened the tab. This module owns one surface — the Focus panel:
 *  - Intention: "What did you come to do?" asked once per tab; the answer stays
 *    pinned as a top-center goal chip.
 *  - Micro-tasks: up to 3 tiny checkboxes (a working-memory prosthetic, not a
 *    todo app).
 *  - Thought parking lot: Ctrl/Cmd+Shift+K opens a scratch pad; intrusive
 *    thoughts get captured without leaving the task. Notes persist locally.
 * Goal + tasks are per-tab (sessionStorage); parked notes persist (localStorage).
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;

  var SKEY = "cit-intent"; // sessionStorage: { goal, tasks, asked }
  var NKEY = "cit-parked"; // localStorage: [ "note", ... ]

  function load() {
    try {
      return JSON.parse(sessionStorage.getItem(SKEY)) || {};
    } catch (_) {
      return {};
    }
  }
  function save() {
    try {
      sessionStorage.setItem(
        SKEY,
        JSON.stringify({
          goal: st.goal,
          tasks: st.tasks,
          asked: st.asked,
          dismissed: st.dismissed,
        })
      );
    } catch (_) {}
  }
  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(NKEY)) || [];
    } catch (_) {
      return [];
    }
  }
  function saveNotes(n) {
    try {
      localStorage.setItem(NKEY, JSON.stringify(n));
    } catch (_) {}
  }

  var persisted = load();
  var st = {
    goal: persisted.goal || "",
    tasks: persisted.tasks || [], // [{ t, done }]
    asked: !!persisted.asked,
    dismissed: !!persisted.dismissed, // ✕ pressed → hidden for this session
  };

  // ---------- Goal chip ----------
  // Shown ONLY in "floating" mode, when the feature is on and not dismissed.
  // In "dock" mode (default) the goal lives inside the Calm dock pill instead;
  // "hidden" keeps the goal saved with no visual. Draggable; position persists.
  function renderChip() {
    var c = document.getElementById("cit-intent-chip");
    var show =
      S.intentionPrompt && (S.intentChipMode || "dock") === "floating" && !st.dismissed;
    if (!show) {
      if (c) c.remove();
      if (CALM.dock) CALM.dock.refreshStatus();
      return;
    }
    if (!c) {
      c = document.createElement("button");
      c.id = "cit-intent-chip";
      c.type = "button";
      var cic = document.createElement("span");
      cic.className = "cit-row-ic";
      if (CALM.icons) cic.innerHTML = CALM.icons.focus; // static markup
      c.appendChild(cic);
      var txt = document.createElement("span");
      txt.className = "cit-intent-chip-text";
      var x = document.createElement("span");
      x.className = "cit-intent-x";
      x.textContent = "✕";
      x.title = "Hide for this session";
      x.addEventListener("click", function (e) {
        e.stopPropagation();
        st.dismissed = true;
        save();
        renderChip();
      });
      c.appendChild(txt);
      c.appendChild(x);
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePop();
      });
      document.body.appendChild(c);
      if (CALM.ui && CALM.ui.makeDraggable) {
        CALM.ui.makeDraggable(c, "cit-intent-pos");
      }
    }
    var open = st.tasks.filter(function (t) {
      return !t.done;
    }).length;
    var t = c.querySelector(".cit-intent-chip-text");
    if (t) {
      t.textContent = st.goal
        ? st.goal + (open ? "  ·  " + open + " left" : "")
        : "Set intention";
    }
    c.classList.toggle("cit-intent-empty", !st.goal);
    if (CALM.dock) CALM.dock.refreshStatus();
  }

  // ---------- Focus panel ----------
  function togglePop(focusPark) {
    var p = document.getElementById("cit-intent-pop");
    if (p) {
      p.remove();
      return;
    }
    p = document.createElement("div");
    p.id = "cit-intent-pop";

    // Engraved lid, same as the bloom tray — identity, then the question.
    var head = document.createElement("div");
    head.className = "cit-intent-head";
    var brand = document.createElement("span");
    brand.textContent = "Intention";
    var hx = document.createElement("button");
    hx.type = "button";
    hx.className = "cit-intent-close";
    hx.setAttribute("aria-label", "Close");
    hx.innerHTML = CALM.icons.close;
    hx.addEventListener("click", function (e) {
      e.stopPropagation();
      closePop();
    });
    head.appendChild(brand);
    head.appendChild(hx);
    p.appendChild(head);

    var title = document.createElement("div");
    title.className = "cit-intent-title";
    title.textContent = "What did you come to do?";
    p.appendChild(title);

    var goal = document.createElement("input");
    goal.type = "text";
    goal.className = "cit-intent-goal";
    goal.placeholder = "draft the report intro";
    goal.value = st.goal;
    goal.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        st.goal = goal.value.trim();
        save();
        renderChip();
        renderTasks();
      }
    });
    goal.addEventListener("change", function () {
      st.goal = goal.value.trim();
      save();
      renderChip();
    });
    p.appendChild(goal);

    // Section rule: a tracked micro-label with its own meta on the right.
    function section(label, metaEl) {
      var s = document.createElement("div");
      s.className = "cit-intent-sec";
      var l = document.createElement("span");
      l.textContent = label;
      s.appendChild(l);
      if (metaEl) s.appendChild(metaEl);
      p.appendChild(s);
      return s;
    }

    var stepCount = document.createElement("span");
    stepCount.className = "cit-intent-meta";
    section("First steps", stepCount);

    var taskWrap = document.createElement("div");
    taskWrap.className = "cit-intent-tasks";
    p.appendChild(taskWrap);

    function renderTasks() {
      stepCount.textContent = st.tasks.length + "/3";
      taskWrap.innerHTML = "";
      st.tasks.forEach(function (task, i) {
        var row = document.createElement("div");
        row.className = "cit-intent-task" + (task.done ? " cit-done" : "");
        var box = document.createElement("button");
        box.type = "button";
        box.className = "cit-intent-box";
        box.textContent = task.done ? "✓" : "";
        box.addEventListener("click", function (e) {
          e.stopPropagation();
          task.done = !task.done;
          save();
          renderTasks();
          renderChip();
        });
        var label = document.createElement("span");
        label.textContent = task.t;
        var del = document.createElement("button");
        del.type = "button";
        del.className = "cit-intent-del";
        del.textContent = "✕";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          st.tasks.splice(i, 1);
          save();
          renderTasks();
          renderChip();
        });
        row.appendChild(box);
        row.appendChild(label);
        row.appendChild(del);
        taskWrap.appendChild(row);
      });
      if (st.tasks.length < 3) {
        var add = document.createElement("input");
        add.type = "text";
        add.className = "cit-intent-add";
        add.placeholder = st.tasks.length ? "one more…" : "one small step";
        add.addEventListener("keydown", function (e) {
          e.stopPropagation();
          if (e.key === "Enter" && add.value.trim()) {
            st.tasks.push({ t: add.value.trim(), done: false });
            save();
            renderTasks();
            renderChip();
          }
        });
        taskWrap.appendChild(add);
      }
    }
    renderTasks();

    // Parking lot — the shortcut belongs in a kbd chip, not in the heading.
    var kbd = document.createElement("kbd");
    kbd.className = "cit-kbd";
    kbd.textContent = "⌃⇧K";
    section("Parked thoughts", kbd);

    var notesWrap = document.createElement("div");
    notesWrap.className = "cit-intent-notes";
    p.appendChild(notesWrap);
    function renderNotes() {
      notesWrap.innerHTML = "";
      loadNotes().forEach(function (note, i) {
        var row = document.createElement("div");
        row.className = "cit-intent-note";
        var span = document.createElement("span");
        span.textContent = note;
        var del = document.createElement("button");
        del.type = "button";
        del.className = "cit-intent-del";
        del.textContent = "✕";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          var n = loadNotes();
          n.splice(i, 1);
          saveNotes(n);
          renderNotes();
        });
        row.appendChild(span);
        row.appendChild(del);
        notesWrap.appendChild(row);
      });
    }
    renderNotes();

    var park = document.createElement("input");
    park.type = "text";
    park.className = "cit-intent-park";
    park.placeholder = "park it here, stay on task";
    park.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && park.value.trim()) {
        var n = loadNotes();
        n.push(park.value.trim());
        saveNotes(n);
        park.value = "";
        renderNotes();
        if (CALM.ui.showToast) CALM.ui.showToast("Parked — come back to it later", true);
      }
    });
    p.appendChild(park);

    // A card that asks for a commitment needs a way to make one.
    var foot = document.createElement("div");
    foot.className = "cit-intent-foot";
    var later = document.createElement("button");
    later.type = "button";
    later.className = "cit-intent-later";
    later.textContent = "Not now";
    later.addEventListener("click", function (e) {
      e.stopPropagation();
      closePop();
    });
    var begin = document.createElement("button");
    begin.type = "button";
    begin.className = "cit-intent-begin";
    begin.textContent = "Begin";
    begin.addEventListener("click", function (e) {
      e.stopPropagation();
      st.goal = goal.value.trim();
      save();
      renderChip();
      closePop();
      if (st.goal && CALM.ui.showToast) CALM.ui.showToast(st.goal, true);
    });
    foot.appendChild(later);
    foot.appendChild(begin);
    p.appendChild(foot);

    document.body.appendChild(p);
    (focusPark ? park : goal).focus();

    function closePop() {
      p.remove();
      document.removeEventListener("click", closeOnOutside, true);
      if (CALM.ui.unregisterPopover) CALM.ui.unregisterPopover(closePop);
    }
    function closeOnOutside(e) {
      if (!p.contains(e.target) && e.target.id !== "cit-intent-chip") closePop();
    }
    if (CALM.ui.registerPopover) CALM.ui.registerPopover(closePop);
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  // ---------- Hotkey: Ctrl/Cmd+Shift+K → parking lot ----------
  document.addEventListener(
    "keydown",
    function (e) {
      if (!S.keyboardShortcut) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        e.stopPropagation();
        togglePop(true);
      }
    },
    true
  );

  // ---------- First-load intention prompt (once per tab) ----------
  function boot() {
    if (!S.intentionPrompt) return;
    renderChip();
    if (!st.asked) {
      st.asked = true;
      save();
      setTimeout(function () {
        if (!document.getElementById("cit-intent-pop")) togglePop(false);
      }, 2000);
    }
  }
  if (S.intentionPrompt) boot();

  CALM.intent = {
    state: st,
    setGoal: function (g) {
      st.goal = g;
      save();
      renderChip();
    },
    addTask: function (t) {
      if (st.tasks.length < 3) {
        st.tasks.push({ t: t, done: false });
        save();
        renderChip();
      }
    },
    park: function (n) {
      var arr = loadNotes();
      arr.push(n);
      saveNotes(arr);
    },
    notes: loadNotes,
    toggle: togglePop,
    renderChip: renderChip,
  };
})();
