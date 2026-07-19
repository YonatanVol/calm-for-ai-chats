/* ===== Calm — src/pomodoro.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Focus timer. A compact floating widget (animated SVG ring + MM:SS) that
 * expands into a full-screen focus overlay. Focus blocks optionally auto-enable
 * Zen; breaks reveal the page; a chime plays at each phase end (src/audio.js).
 * Driven via the "pomodoro" mode (modes.js delegates here). Exposes CALM.pomodoro.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;

  var st = { phase: "idle", remaining: 0, total: 0, cycle: 1, running: false, paused: false, timer: null, enteredZen: false };

  function minsFor(phase) {
    return phase === "focus" ? S.pomoFocusMin : phase === "long" ? S.pomoLongBreakMin : S.pomoBreakMin;
  }
  function enterPhase(phase) {
    st.phase = phase;
    st.total = Math.max(1, minsFor(phase) | 0) * 60;
    st.remaining = st.total;
  }
  function fmt(s) {
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ":" + (ss < 10 ? "0" + ss : ss);
  }

  // ---------- Timer ----------
  function start() {
    if (st.running) return;
    if (CALM.audio) CALM.audio.unlock(); // unlock audio on the starting gesture
    st.cycle = 1;
    st.paused = false;
    enterPhase("focus");
    st.running = true;
    if (S.pomoAutoZen && !CALM.modes.isActive("zen")) {
      st.enteredZen = true;
      CALM.modes.enter("zen");
    }
    buildWidget();
    buildTimeBar();
    render();
    st.timer = setInterval(tick, 1000);
  }
  function stop() {
    if (!st.running && st.phase === "idle") return;
    st.running = false;
    clearInterval(st.timer);
    st.timer = null;
    st.phase = "idle";
    removeOverlay();
    removeWidget();
    removeTimeBar();
    // Leave no zen behind that WE turned on (user-enabled zen is untouched).
    if (st.enteredZen && CALM.modes.isActive("zen")) CALM.modes.exit("zen");
    st.enteredZen = false;
  }
  function tick() {
    if (!st.running || st.paused) return;
    if (st.remaining <= 0) {
      nextPhase();
      return;
    }
    st.remaining--;
    render();
  }
  function nextPhase() {
    if (CALM.audio) CALM.audio.playChime();
    // Log the block that just finished (best-effort; no-op when signed out).
    if (CALM.sync && CALM.sync.logFocus && st.phase !== "idle") {
      CALM.sync.logFocus(st.phase, Math.max(0, minsFor(st.phase) | 0));
    }
    if (st.phase === "focus") {
      var longNow = st.cycle >= (S.pomoCycles | 0);
      enterPhase(longNow ? "long" : "break");
      if (S.pomoAutoZen && CALM.modes.isActive("zen")) CALM.modes.exit("zen"); // reveal on break
      showOverlay(); // surface the break
    } else {
      if (st.phase === "long") {
        CALM.modes.exit("pomodoro"); // whole set done
        return;
      }
      st.cycle++;
      enterPhase("focus");
      if (S.pomoAutoZen && !CALM.modes.isActive("zen")) {
        st.enteredZen = true;
        CALM.modes.enter("zen");
      }
      removeOverlay();
    }
    render();
  }
  function pauseResume() {
    st.paused = !st.paused;
    render();
  }
  function skip() {
    st.remaining = 0;
    nextPhase();
  }
  function reset() {
    st.cycle = 1;
    st.paused = false;
    enterPhase("focus");
    render();
  }

  // ---------- Rendering ----------
  function ringSvg(size) {
    var r = size / 2 - 7;
    var c = 2 * Math.PI * r;
    var cx = size / 2;
    return (
      '<svg class="cit-pomo-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle class="cit-pomo-track" cx="' + cx + '" cy="' + cx + '" r="' + r + '"></circle>' +
      '<circle class="cit-pomo-prog" cx="' + cx + '" cy="' + cx + '" r="' + r + '" ' +
      'stroke-dasharray="' + c + '" stroke-dashoffset="0" transform="rotate(-90 ' + cx + " " + cx + ')"></circle>' +
      "</svg>"
    );
  }
  function setRing(el, frac) {
    if (!el) return;
    var r = parseFloat(el.getAttribute("r"));
    var c = 2 * Math.PI * r;
    el.style.strokeDasharray = c;
    el.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, frac)));
  }
  function label() {
    return st.phase === "focus" ? "Focus" : st.phase === "break" ? "Break" : st.phase === "long" ? "Long break" : "";
  }
  function isBreak() {
    return st.phase === "break" || st.phase === "long";
  }
  function render() {
    var frac = st.total ? st.remaining / st.total : 0;
    var time = fmt(st.remaining);
    ["cit-pomo-widget", "cit-pomo-overlay"].forEach(function (id) {
      var host = document.getElementById(id);
      if (!host) return;
      var t = host.querySelector(".cit-pomo-time");
      if (t) t.textContent = time;
      var l = host.querySelector(".cit-pomo-label");
      if (l) l.textContent = label();
      setRing(host.querySelector(".cit-pomo-prog"), frac);
      host.classList.toggle("cit-pomo-break", isBreak());
    });
    var o = document.getElementById("cit-pomo-overlay");
    if (o) {
      var dots = o.querySelector(".cit-pomo-dots");
      if (dots) {
        dots.innerHTML = "";
        for (var i = 1; i <= (S.pomoCycles | 0); i++) {
          var d = document.createElement("span");
          d.className = "cit-dot" + (i <= st.cycle ? " cit-dot-on" : "");
          dots.appendChild(d);
        }
      }
      var pb = o.querySelector(".cit-pomo-pause");
      if (pb) pb.textContent = st.paused ? "▶ Resume" : "❚❚ Pause";
    }
    renderTimeBar();
  }

  // ---------- Visual time bar (time as a shape, not a number) ----------
  function buildTimeBar() {
    removeTimeBar();
    if (!S.showTimeBar) return;
    var b = document.createElement("div");
    b.id = "cit-timebar";
    b.innerHTML = '<div class="cit-timebar-fill"></div>';
    document.body.appendChild(b);
  }
  function removeTimeBar() {
    var b = document.getElementById("cit-timebar");
    if (b) b.remove();
  }
  function renderTimeBar() {
    var b = document.getElementById("cit-timebar");
    if (!b) return;
    var fill = b.querySelector(".cit-timebar-fill");
    if (fill) fill.style.width = (st.total ? (1 - st.remaining / st.total) * 100 : 0) + "%";
    b.classList.toggle("cit-timebar-break", isBreak());
  }

  // ---------- Widget (compact) ----------
  function buildWidget() {
    removeWidget();
    var w = document.createElement("div");
    w.id = "cit-pomo-widget";
    w.innerHTML =
      '<div class="cit-pomo-ringwrap">' + ringSvg(46) + '<span class="cit-pomo-time"></span></div>' +
      '<div class="cit-pomo-meta"><span class="cit-pomo-label"></span><span class="cit-pomo-expand">expand ⤢</span></div>';
    w.addEventListener("click", showOverlay);
    document.body.appendChild(w);
  }
  function removeWidget() {
    var w = document.getElementById("cit-pomo-widget");
    if (w) w.remove();
  }

  // ---------- Overlay (full focus screen) ----------
  function showOverlay() {
    if (document.getElementById("cit-pomo-overlay")) return;
    var o = document.createElement("div");
    o.id = "cit-pomo-overlay";
    o.innerHTML =
      '<div class="cit-pomo-card">' +
      '<div class="cit-pomo-label"></div>' +
      '<div class="cit-pomo-ringwrap cit-pomo-ringwrap-lg">' + ringSvg(220) + '<span class="cit-pomo-time"></span></div>' +
      '<div class="cit-pomo-dots"></div>' +
      '<div class="cit-pomo-controls">' +
      '<button type="button" class="cit-pomo-btn cit-pomo-pause"></button>' +
      '<button type="button" class="cit-pomo-btn cit-pomo-skip">Skip ⤼</button>' +
      '<button type="button" class="cit-pomo-btn cit-pomo-reset">Reset ↺</button>' +
      '<button type="button" class="cit-pomo-btn cit-pomo-min">Minimize ⤡</button>' +
      '<button type="button" class="cit-pomo-btn cit-pomo-close">End ✕</button>' +
      "</div></div>";
    document.body.appendChild(o);
    o.querySelector(".cit-pomo-pause").addEventListener("click", pauseResume);
    o.querySelector(".cit-pomo-skip").addEventListener("click", skip);
    o.querySelector(".cit-pomo-reset").addEventListener("click", reset);
    o.querySelector(".cit-pomo-min").addEventListener("click", removeOverlay);
    o.querySelector(".cit-pomo-close").addEventListener("click", function () {
      CALM.modes.exit("pomodoro");
    });
    render();
  }
  function removeOverlay() {
    var o = document.getElementById("cit-pomo-overlay");
    if (o) o.remove();
  }

  CALM.pomodoro = { start: start, stop: stop, state: st };
})();
