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
    if (CALM.margin && CALM.margin.reposition) CALM.margin.reposition();
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
    // Only claim the composer if it was visible: if the user had already hidden
    // it themselves, Zen has nothing to restore on the way out.
    if (S.zenComposer && !rt.composerHidden) {
      rt.zenHidComposer = true;
      CALM.core.hideComposer();
    }
  }
  function zenExit() {
    document.documentElement.classList.remove("cit-zen");
    removeEl("cit-zen-style");
    // Only strip inline display from elements WE set it on. The re-query used
    // to run on every site, so on Gemini/Claude (zenInline: false) exiting Zen
    // deleted inline styles the site itself had set — e.g. a collapsed sidenav.
    var touched = site.zenInline ? rt.zenHidden.concat(site.zenTargets()) : rt.zenHidden;
    touched.forEach(function (el) {
      try {
        el.style.removeProperty("display");
      } catch (_) {}
    });
    rt.zenHidden = [];
    rt.zenOn = false;
    // Restore what ZEN hid, never what the user chose to hide.
    if (rt.zenHidComposer && rt.composerHidden) CALM.core.showComposer();
    rt.zenHidComposer = false;
    // Presentation and Pomodoro each borrow Zen and give it back on the way
    // out. A loan only covers the Zen THEY switched on: once Zen is off — by
    // their hand or the user's — the loan is settled, so a Zen the user turns
    // on next is theirs to keep. Releasing here catches every route out of
    // Zen, including the keyboard shortcut that still works while
    // Presentation has hidden every Calm control.
    rt.presentationEnteredZen = false;
    if (CALM.pomodoro && CALM.pomodoro.state) {
      CALM.pomodoro.state.enteredZen = false;
    }
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
  // Reader typography is a SETTING, not a mode: it applies whenever the user
  // has moved either slider off its default, the same way reading width does.
  // ("Reader" as a name now means one thing only — the Focus Reader pane.)
  function applyReaderType() {
    var on = (S.readerFontScale | 0) !== 100 || (S.readerLineHeight | 0) !== 16;
    if (!on) {
      document.documentElement.classList.remove("cit-reader");
      removeEl("cit-reader-style");
      return;
    }
    var t = prefix(site.readerTargets(), "html.cit-reader");
    injectStyle(
      "cit-reader-style",
      t +
        "{font-size:var(--cit-reader-fs)!important;line-height:var(--cit-reader-lh)!important;}"
    );
    readerVars();
    document.documentElement.classList.add("cit-reader");
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
    // Take the first-run tour off screen immediately rather than relying on it
    // being inside the dock — it stays un-dismissed and returns afterwards.
    if (CALM.tour) CALM.tour.close();
    document.documentElement.classList.add("cit-presentation");
    rt.presentationEnteredZen = !rt.activeModes.zen;
    if (!rt.activeModes.zen) modeEnter("zen");
    // Presentation hides all Calm buttons — tell the user how to get out.
    if (CALM.ui.showToast) {
      CALM.ui.showToast("Presentation — press Esc to exit", true, true);
    }
  }
  function presentationExit() {
    document.documentElement.classList.remove("cit-presentation");
    if (rt.presentationEnteredZen && rt.activeModes.zen) modeExit("zen");
    rt.presentationEnteredZen = false;
  }

  // ---------- Auto-scroll (teleprompter) ----------
  // ---------- Auto-scroll: a player, not a timer ----------
  // A long answer, read hands-free. This is a media player for text — play,
  // pause, speed, skip to the next answer — and it notices when you take the
  // wheel. It moves on animation frames with sub-pixel accumulation, so a
  // slow speed is a smooth drift rather than a 1px stutter; eases in when it
  // starts and out when it stops; and reads the scroller fresh every frame,
  // because the old version held one reference and went silently dead after
  // the first navigation.
  var C = CALM.const;
  var G = {
    raf: null, lastTs: null, vel: 0, pos: 0,
    lineAcc: 0, target: null, dwellUntil: 0,
    lastTap: 0, unEsc: null, docLs: [], fadeTimer: null, el: null,
  };
  function gl() { return rt.glide; }
  function scroller() {
    return CALM.core && CALM.core.currentScroller
      ? CALM.core.currentScroller()
      : rt.scrollContainer;
  }
  function maxTop(sc) {
    return Math.max(0, (sc.scrollHeight || 0) - (sc.clientHeight || 0));
  }
  function clampSpeed(n) {
    return Math.max(C.GLIDE_MIN, Math.min(C.GLIDE_MAX, Math.round(n)));
  }
  function schedule() {
    if (G.raf == null) G.raf = requestAnimationFrame(frame);
  }
  function lineHeight() {
    // Measured from the conversation's own text; a mode that steps by "one
    // line" has to agree with the page about how tall a line is.
    try {
      var el = document.querySelector(site.responseSel);
      var lh = el && getComputedStyle(el).lineHeight;
      var n = parseFloat(lh);
      if (n > 8 && n < 80) return n;
    } catch (_) {}
    return 24;
  }
  function answerOffsets() {
    return CALM.core && CALM.core.answerOffsets ? CALM.core.answerOffsets() : [];
  }

  function frame(ts) {
    G.raf = null;
    var g = gl();
    if (!rt.activeModes.autoscroll) return;
    var sc = scroller();
    if (!sc) { schedule(); return; }
    var dt = G.lastTs == null ? 16 : Math.min(64, ts - G.lastTs);
    G.lastTs = ts;

    // Velocity eases toward 1 while playing and toward 0 while paused. The
    // two rates differ on purpose: starting should feel like a breath,
    // stopping like a hand laid on the page.
    var want = g.playing && !g.done ? 1 : 0;
    var ease = want ? C.GLIDE_EASE_IN_MS : C.GLIDE_EASE_OUT_MS;
    G.vel += (want - G.vel) * Math.min(1, dt / ease);
    if (Math.abs(G.vel - want) < 0.03) G.vel = want;
    if (G.vel <= 0) {
      G.lastTs = null; // idle: nothing scheduled until play() wakes it
      return;
    }

    var px = g.speed * G.vel * dt / 1000;
    var max = maxTop(sc);
    if (g.style === "lines") {
      G.lineAcc += px;
      var step = lineHeight();
      while (G.lineAcc >= step) {
        G.lineAcc -= step;
        G.pos += step;
      }
    } else if (g.style === "answers") {
      var now = ts;
      if (G.target == null) {
        if (now < G.dwellUntil) { schedule(); return; } // reading; hold still
        var offs = answerOffsets();
        var next = null;
        for (var i = 0; i < offs.length; i++) {
          if (offs[i] > G.pos + 1) { next = offs[i]; break; }
        }
        if (next == null) { G.pos = max; } // no more answers: run out the page
        else G.target = Math.min(max, next);
      }
      if (G.target != null) {
        G.pos = Math.min(G.target, G.pos + px);
        if (G.pos >= G.target - 0.01) {
          // Arrived. Dwell for about as long as the answer takes to read at
          // this speed — bounded, so a one-liner is not a five-second stare
          // and a wall of text is not a minute of nothing moving.
          var after = answerOffsets().filter(function (o) { return o > G.target + 1; })[0];
          var height = (after != null ? after : max) - G.target;
          G.dwellUntil = now + Math.max(1500, Math.min(20000, (height / g.speed) * 1000));
          G.target = null;
        }
      }
    } else {
      G.pos += px;
    }

    if (G.pos >= max - 0.5) {
      G.pos = max;
      sc.scrollTop = max;
      finish();
      return;
    }
    sc.scrollTop = G.pos;
    schedule();
  }

  // ---- state changes ----
  function syncFromPage() {
    var sc = scroller();
    G.pos = sc ? sc.scrollTop || 0 : 0;
    G.lineAcc = 0;
    G.target = null;
    G.dwellUntil = 0;
  }
  function play() {
    var g = gl();
    if (!rt.activeModes.autoscroll) return;
    if (g.done) { // "play" after the end means "from the top"
      g.done = false;
      var sc = scroller();
      if (sc) sc.scrollTop = 0;
      clearTimeout(G.fadeTimer);
    }
    syncFromPage();
    g.playing = true;
    paint();
    schedule();
  }
  function pause() {
    var g = gl();
    if (!g.playing) return;
    g.playing = false;
    paint();
    schedule(); // one more pass so the ease-out actually runs
  }
  function toggle() { gl().playing ? pause() : play(); }
  function setSpeed(n) {
    var g = gl();
    g.speed = clampSpeed(n);
    S.autoScrollSpeed = g.speed;
    CALM.saveSettings();
    paint();
  }
  function setStyle(style) {
    var g = gl();
    if (["glide", "lines", "answers"].indexOf(style) < 0) style = "glide";
    g.style = style;
    S.autoScrollStyle = style;
    CALM.saveSettings();
    syncFromPage();
    paint();
  }
  function next() {
    // The start of the NEXT answer, from wherever the page is right now —
    // and keep going from there.
    var sc = scroller();
    if (!sc) return;
    var here = sc.scrollTop || 0;
    var offs = answerOffsets();
    var to = null;
    for (var i = 0; i < offs.length; i++) {
      if (offs[i] > here + 1) { to = offs[i]; break; }
    }
    // No answer below. This used to return — two taps, nothing, in exactly
    // the place people double-tap most: inside the last, longest answer. The
    // next place worth going is the end, which the player then reports as
    // "reached the end".
    if (to == null) to = maxTop(sc);
    var target = Math.min(maxTop(sc), Math.max(0, to));
    sc.scrollTop = target;
    G.pos = target;
    G.lineAcc = 0;
    G.target = null;
    G.dwellUntil = 0;
  }
  function finish() {
    var g = gl();
    g.playing = false;
    g.done = true;
    G.vel = 0;
    G.lastTs = null;
    paint();
    // It lets itself out — but not so fast that "done" is never seen.
    clearTimeout(G.fadeTimer);
    G.fadeTimer = setTimeout(function () {
      if (rt.activeModes.autoscroll && gl().done) modeExit("autoscroll");
    }, C.GLIDE_END_FADE_MS);
  }

  // ---- the bubble ----
  var RING_R = 24;
  var RING_LEN = 2 * Math.PI * RING_R;
  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function chip(label, attr, value, on, onPick) {
    var b = mk("button", "cit-glide-chip" + (on ? " cit-active" : ""), label);
    b.type = "button";
    b.setAttribute(attr, String(value));
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      onPick();
    });
    return b;
  }
  function buildBubble() {
    removeBubble();
    var g = gl();
    var root = mk("div");
    root.id = "cit-glide";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Auto-scroll");

    var dial = mk("div", "cit-glide-dial");
    var svgNS = "http://www.w3.org/2000/svg";
    var svg, track, ring;
    try {
      svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "cit-glide-svg");
      svg.setAttribute("viewBox", "0 0 56 56");
      svg.setAttribute("aria-hidden", "true");
      track = document.createElementNS(svgNS, "circle");
      track.setAttribute("class", "cit-glide-track");
      track.setAttribute("cx", "28"); track.setAttribute("cy", "28"); track.setAttribute("r", String(RING_R));
      ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("class", "cit-glide-ring");
      ring.setAttribute("cx", "28"); ring.setAttribute("cy", "28"); ring.setAttribute("r", String(RING_R));
      ring.setAttribute("stroke-dasharray", RING_LEN.toFixed(2));
      ring.setAttribute("transform", "rotate(-90 28 28)");
      // A small knob at the end of the arc, shown on hover, so the ring reads
      // as something you can take hold of rather than as decoration.
      var knob = document.createElementNS(svgNS, "circle");
      knob.setAttribute("class", "cit-glide-knob");
      knob.setAttribute("r", "4");
      svg.appendChild(track);
      svg.appendChild(ring);
      svg.appendChild(knob);
      dial.appendChild(svg);
      G.knob = knob;
    } catch (_) { ring = null; G.knob = null; }
    G.ring = ring;

    var btn = mk("button", "cit-glide-btn");
    btn.type = "button";
    var icon = mk("span", "cit-glide-icon");
    btn.appendChild(icon);
    G.icon = icon;
    G.btn = btn;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      // Tap = pause/resume, instantly, so the first tap always answers.
      // A second tap inside GLIDE_TAP_MS makes the pair a double-tap: undo
      // the first tap's toggle and jump to the next answer instead.
      var now = Date.now();
      if (now - G.lastTap < C.GLIDE_TAP_MS) {
        G.lastTap = 0;
        toggle();
        next();
      } else {
        G.lastTap = now;
        toggle();
      }
    });
    dial.appendChild(btn);

    // The ring band is a dial: drag around it to set speed.
    var hit = mk("div", "cit-glide-ring-hit");
    hit.setAttribute("aria-hidden", "true");
    hit.setAttribute("title", "Drag the ring to change speed");
    hit.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      var r = dial.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      function at(ev) {
        var a = Math.atan2(ev.clientY - cy, ev.clientX - cx); // -π..π, 0 = east
        var frac = ((a + Math.PI / 2) / (2 * Math.PI) + 1) % 1; // 0 at north, clockwise
        setSpeed(C.GLIDE_MIN + frac * (C.GLIDE_MAX - C.GLIDE_MIN));
      }
      function up() {
        document.removeEventListener("pointermove", at, true);
        document.removeEventListener("pointerup", up, true);
        document.removeEventListener("pointercancel", up, true);
      }
      document.addEventListener("pointermove", at, true);
      document.addEventListener("pointerup", up, true);
      document.addEventListener("pointercancel", up, true);
      at(e);
    });
    // UNDER the button, not over it. It used to be appended last with a CSS
    // mask cutting out its centre — but a mask changes what you see, not what
    // the pointer hits, so every tap in the middle landed here and silently
    // changed the speed while the play button never heard a click. The
    // button is a circle, and border-radius does clip hit-testing, so with
    // the button on top it wins the centre and only the outer band reaches
    // the ring. tools/glide-test.js asks a real browser to confirm it.
    dial.insertBefore(hit, btn);
    root.appendChild(dial);

    // Wheel over the bubble nudges speed — same target as the ring, no chrome.
    root.addEventListener("wheel", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setSpeed(gl().speed + (e.deltaY < 0 ? C.GLIDE_STEP : -C.GLIDE_STEP));
    }, { passive: false });

    // The strip: discrete choices, unfolds beside the dial on hover.
    var strip = mk("div", "cit-glide-strip");
    var styleGroup = mk("div", "cit-glide-group");
    styleGroup.appendChild(mk("span", "cit-glide-label", "Style"));
    [["Glide", "glide"], ["Lines", "lines"], ["Answers", "answers"]].forEach(function (p) {
      styleGroup.appendChild(chip(p[0], "data-cit-style", p[1], g.style === p[1], function () {
        setStyle(p[1]);
      }));
    });
    var speedGroup = mk("div", "cit-glide-group");
    speedGroup.appendChild(mk("span", "cit-glide-label", "Speed"));
    [["Slow", 40], ["Read", 80], ["Skim", 160]].forEach(function (p) {
      speedGroup.appendChild(chip(p[0], "data-cit-speed", p[1], false, function () {
        setSpeed(p[1]);
      }));
    });
    var readout = mk("span", "cit-glide-readout");
    G.readout = readout;
    speedGroup.appendChild(readout);
    strip.appendChild(styleGroup);
    strip.appendChild(speedGroup);
    root.appendChild(strip);

    document.body.appendChild(root);
    G.el = root;
    if (CALM.ui && CALM.ui.makeDraggable) {
      CALM.ui.makeDraggable(root, "cit-glide-pos", { handle: btn });
    }
    paint();
  }
  function removeBubble() {
    var e = document.getElementById("cit-glide");
    if (e) e.remove();
    G.el = null; G.ring = null; G.knob = null; G.icon = null; G.btn = null;
    G.readout = null;
  }
  function paint() {
    var g = gl();
    var root = G.el;
    if (!root) return;
    root.classList.toggle("cit-glide-on", g.playing && !g.done);
    root.classList.toggle("cit-glide-paused", !g.playing && !g.done);
    root.classList.toggle("cit-glide-done", !!g.done);
    if (G.ring) {
      var frac = g.done ? 1 : (g.speed - C.GLIDE_MIN) / (C.GLIDE_MAX - C.GLIDE_MIN);
      G.ring.style.strokeDashoffset = (RING_LEN * (1 - frac)).toFixed(2);
    }
    if (G.knob) {
      // Same angle the drag maps FROM: 0 at the top, clockwise.
      var th = ((g.speed - C.GLIDE_MIN) / (C.GLIDE_MAX - C.GLIDE_MIN)) * 2 * Math.PI;
      G.knob.setAttribute("cx", (28 + RING_R * Math.sin(th)).toFixed(2));
      G.knob.setAttribute("cy", (28 - RING_R * Math.cos(th)).toFixed(2));
    }
    if (G.icon && CALM.icons) {
      G.icon.innerHTML = g.done ? CALM.icons.check : g.playing ? CALM.icons.pause : CALM.icons.play;
    }
    if (G.btn) {
      G.btn.setAttribute("aria-label",
        g.done ? "Auto-scroll finished — play again from the top"
        : g.playing ? "Pause auto-scroll" : "Resume auto-scroll");
      // The hover hint is the only place a double-tap is announced, and it
      // has to be true in every state — so it changes with the state.
      G.btn.setAttribute("title",
        g.done ? "Play again from the top"
        : (g.playing ? "Tap to pause" : "Tap to resume") +
          " · double-tap for the next answer");
    }
    if (G.readout) G.readout.textContent = (g.speed / C.GLIDE_READ).toFixed(1) + "×";
    if (root.querySelectorAll) {
      var nearest = [40, 80, 160].reduce(function (a, b) {
        return Math.abs(b - g.speed) < Math.abs(a - g.speed) ? b : a;
      });
      root.querySelectorAll(".cit-glide-chip").forEach(function (c) {
        var sp = c.getAttribute("data-cit-speed");
        var st = c.getAttribute("data-cit-style");
        var on = sp != null ? Number(sp) === nearest : st === g.style;
        c.classList.toggle("cit-active", !!on);
      });
    }
  }

  // ---- "you took the wheel" ----
  function inBubble(t) {
    try { return !!(t && t.closest && t.closest("#cit-glide")); } catch (_) { return false; }
  }
  var TAKEOVER_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1 };
  function listen(type, fn, opts) {
    document.addEventListener(type, fn, opts);
    G.docLs.push([type, fn, opts]);
  }
  function unlistenAll() {
    G.docLs.forEach(function (l) { document.removeEventListener(l[0], l[1], l[2]); });
    G.docLs = [];
  }

  function autoscrollEnter() {
    var g = gl();
    g.speed = clampSpeed(S.autoScrollSpeed | 0 || C.GLIDE_READ);
    g.style = ["glide", "lines", "answers"].indexOf(S.autoScrollStyle) >= 0 ? S.autoScrollStyle : "glide";
    g.done = false;
    g.playing = false;
    G.vel = 0; G.lastTs = null; G.lastTap = 0;
    buildBubble();
    // Anything that means "I'm driving now" pauses it. Never the scroll
    // event: our own scrollTop writes fire that.
    listen("wheel", function (e) { if (!inBubble(e.target)) pause(); }, { passive: true, capture: true });
    listen("touchstart", function (e) { if (!inBubble(e.target)) pause(); }, { passive: true, capture: true });
    listen("keydown", function (e) { if (TAKEOVER_KEYS[e.code] && !inBubble(e.target)) pause(); }, true);
    listen("visibilitychange", function () { if (document.hidden) pause(); });
    if (CALM.ui && CALM.ui.registerEscape) {
      G.unEsc = CALM.ui.registerEscape(function () {
        if (!rt.activeModes.autoscroll) return false;
        modeExit("autoscroll");
        return true;
      });
    }
    play();
  }
  function autoscrollExit() {
    var g = gl();
    g.playing = false;
    g.done = false;
    if (G.raf != null) { cancelAnimationFrame(G.raf); G.raf = null; }
    clearTimeout(G.fadeTimer);
    G.vel = 0; G.lastTs = null;
    unlistenAll();
    if (G.unEsc) { G.unEsc(); G.unEsc = null; }
    removeBubble();
  }

  CALM.glide = {
    state: rt.glide,
    play: play, pause: pause, toggle: toggle, next: next,
    setSpeed: setSpeed, setStyle: setStyle,
  };

  // ---------- Pause / Snooze (suspend auto-hide) ----------
  function pauseEnter() {
    rt.paused = true;
    stopTimer("pause");
    // Resume the original end time across SPA navs — a nav must never re-arm
    // a fresh countdown (that could suspend auto-hide indefinitely).
    var end =
      rt.resumePauseEnd && rt.resumePauseEnd > Date.now()
        ? rt.resumePauseEnd
        : Date.now() + Math.max(1, S.pauseMinutes | 0) * 60000;
    rt.resumePauseEnd = null;
    rt.pauseEndTs = end;
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
    rt.pauseEndTs = null;
    stopTimer("pause");
    if (CALM.ui.hideChip) CALM.ui.hideChip("pause");
  }

  // ---------- Reading ruler (ADHD attention anchor) ----------
  // A fixed band that follows the cursor; giant box-shadows dim everything
  // above/below it. Pure overlay — zero site-DOM mutation.
  function rulerVars() {
    document.documentElement.style.setProperty(
      "--cit-ruler-h",
      (S.rulerHeight | 0) + "px"
    );
    document.documentElement.style.setProperty(
      "--cit-ruler-dim",
      String((S.rulerDim | 0) / 100)
    );
  }
  function rulerMove(e) {
    var o = document.getElementById("cit-ruler");
    if (o) o.style.top = e.clientY - (S.rulerHeight | 0) / 2 + "px";
  }
  function rulerEnter() {
    if (!document.getElementById("cit-ruler")) {
      var o = document.createElement("div");
      o.id = "cit-ruler";
      document.body.appendChild(o);
    }
    rulerVars();
    rt.rulerHandler = rulerMove;
    document.addEventListener("mousemove", rt.rulerHandler, { passive: true });
  }
  function rulerExit() {
    removeEl("cit-ruler");
    if (rt.rulerHandler) {
      document.removeEventListener("mousemove", rt.rulerHandler);
      rt.rulerHandler = null;
    }
  }

  // ---------- Chat spotlight (attention on the current exchange) ----------
  // The in-page sibling of the reading pane's Spotlight: everything above the
  // exchange you are in recedes. Implemented entirely as a gated stylesheet,
  // so React and Angular can re-render the thread as often as they like and
  // the effect survives — the same reason Zen works this way.
  function chatspotVars() {
    document.documentElement.style.setProperty(
      "--cit-spot",
      String((S.spotDim | 0) / 100)
    );
  }
  function chatspotEnter() {
    if (!site.spotlightCss) return; // site has not described its turns
    injectStyle("cit-chatspot-style", site.spotlightCss());
    chatspotVars();
    document.documentElement.classList.add("cit-chatspot");
  }
  function chatspotExit() {
    document.documentElement.classList.remove("cit-chatspot");
    removeEl("cit-chatspot-style");
  }

  // ---------- Grayscale (stimulation regulation) ----------
  // Drains the dopamine-bait colors from the site; Calm's own UI is excluded.
  function grayVars() {
    document.documentElement.style.setProperty(
      "--cit-gray",
      String((S.grayLevel | 0) / 100)
    );
  }
  function grayEnter() {
    injectStyle(
      "cit-gray-style",
      'html.cit-gray body > *:not([id^="cit-"])' +
        "{filter:grayscale(var(--cit-gray,0.85)) !important;}"
    );
    grayVars();
    document.documentElement.classList.add("cit-gray");
  }
  function grayExit() {
    document.documentElement.classList.remove("cit-gray");
    removeEl("cit-gray-style");
  }

  // ---------- Reduce motion (kill site animations/transitions) ----------
  function motionEnter() {
    injectStyle(
      "cit-motion-style",
      'html.cit-motion *:not([id*="cit-"]):not([class*="cit-"]),' +
        'html.cit-motion *:not([id*="cit-"]):not([class*="cit-"])::before,' +
        'html.cit-motion *:not([id*="cit-"]):not([class*="cit-"])::after' +
        "{animation-duration:0.001s !important;transition-duration:0.001s !important;}"
    );
    document.documentElement.classList.add("cit-motion");
  }
  function motionExit() {
    document.documentElement.classList.remove("cit-motion");
    removeEl("cit-motion-style");
  }

  // ---------- Pomodoro (implemented in src/pomodoro.js, Phase 2) ----------
  function pomodoroEnter() {
    if (CALM.pomodoro) {
      var resume = rt.resumePomodoro;
      rt.resumePomodoro = null;
      CALM.pomodoro.start(resume || undefined);
    }
  }
  function pomodoroExit() {
    if (CALM.pomodoro) CALM.pomodoro.stop();
  }

  // ---------- Registry ----------
  // surface: where the mode is offered to the user.
  //   "tile"     — a control in the Console (the everyday five)
  //   "advanced" — a row in the Advanced drawer
  //   "command"  — reachable from the palette / a shortcut only
  // Every list in the UI derives from this; there are no hard-coded mode
  // arrays anywhere else.
  var MODES = {
    zen: { label: "Zen", icon: "❏", surface: "tile", enter: zenEnter, exit: zenExit },
    focusreader: {
      label: "Focus Reader",
      icon: "\u2750",
      surface: "tile",
      enter: function () { if (CALM.reader) CALM.reader.open(); },
      exit: function () { if (CALM.reader) CALM.reader.close(); },
      vars: function () { if (CALM.reader) CALM.reader.refreshVars(); },
    },
    night: { label: "Night", icon: "☾", surface: "tile", enter: nightEnter, exit: nightExit, vars: nightVars },
    ruler: { label: "Reading ruler", icon: "▬", surface: "tile", enter: rulerEnter, exit: rulerExit, vars: rulerVars },
    chatspot: {
      label: "Chat spotlight",
      icon: "◉",
      surface: "tile",
      enter: chatspotEnter,
      exit: chatspotExit,
      vars: chatspotVars,
    },
    pomodoro: { label: "Pomodoro", icon: "◴", surface: "tile", enter: pomodoroEnter, exit: pomodoroExit },
    pause: { label: "Pause", icon: "⏸", surface: "live", enter: pauseEnter, exit: pauseExit },
    gray: { label: "Grayscale", icon: "◐", surface: "advanced", enter: grayEnter, exit: grayExit, vars: grayVars },
    motion: { label: "Reduce motion", icon: "◇", surface: "advanced", enter: motionEnter, exit: motionExit },
    privacy: { label: "Privacy", icon: "⦿", surface: "advanced", enter: privacyEnter, exit: privacyExit },
    autoscroll: { label: "Auto-scroll", icon: "↧", surface: "tile", enter: autoscrollEnter, exit: autoscrollExit },
    presentation: { label: "Present", icon: "▣", surface: "command", enter: presentationEnter, exit: presentationExit },
  };
  function bySurface(kind) {
    return Object.keys(MODES).filter(function (id) {
      return MODES[id].surface === kind;
    });
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
  // Several modes change the page's geometry (Zen removes the sidebar, reading
  // width narrows the column). Anything anchored to the text has to be told.
  function afterLayoutChange() {
    if (CALM.margin && CALM.margin.reposition) CALM.margin.reposition();
  }
  function modeEnter(id) {
    var m = MODES[id];
    if (!m || rt.activeModes[id]) return;
    if (!CALM.entitled("mode:" + id)) return; // per-mode tier (all free in v1)
    rt.activeModes[id] = true;
    m.enter();
    setModeBtnActive(id, true);
    afterLayoutChange();
    persist();
  }
  function modeExit(id) {
    var m = MODES[id];
    if (!m || !rt.activeModes[id]) return;
    rt.activeModes[id] = false;
    m.exit();
    setModeBtnActive(id, false);
    afterLayoutChange();
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
    applyReaderType: applyReaderType,
    bySurface: bySurface,
    ids: function () { return Object.keys(MODES); },
    // back-compat aliases used by core/ui/keyboard:
    applyZen: function (on) {
      on ? modeEnter("zen") : modeExit("zen");
    },
    toggleZen: function () {
      modeToggle("zen");
    },
  };
})();
