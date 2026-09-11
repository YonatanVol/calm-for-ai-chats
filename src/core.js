/* ===== Calm — src/core.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The engine: composer hide/show, draft save/restore, capture-phase scroll
 * detection, keyboard shortcuts, SPA-nav handling, and init. Loaded last.
 *
 * Notes learned the hard way:
 *  - The composer is React/Tailwind (ChatGPT) or Angular (Gemini) and resets
 *    transform/opacity/classes; the only reliable mutation is inline
 *    display:none !important. So hide is INSTANT; motion lives on Calm's own UI.
 *  - ChatGPT keeps the composer focused, so we must NOT guard auto-hide on focus.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var site = CALM.site;
  var S = CALM.settings;
  var rt = CALM.rt;
  var C = CALM.const;
  var ui = CALM.ui;
  var modes = CALM.modes;
  var DRAFT_KEY = CALM.keys.DRAFT_KEY;

  // sensitivity -> upward px needed to hide (1=hard .. 10=easy)
  function upThreshold() {
    var s = Math.max(1, Math.min(10, S.sensitivity || 5));
    return Math.round(C.UP_MAX - (s - 1) * ((C.UP_MAX - C.UP_MIN) / 9));
  }

  function lockScroll() {
    rt.scrollLocked = true;
    rt.accUp = 0;
    clearTimeout(rt.scrollLockTimer);
    rt.scrollLockTimer = setTimeout(function () {
      rt.scrollLocked = false;
      if (rt.scrollContainer) rt.lastScrollTop = rt.scrollContainer.scrollTop;
    }, C.SCROLL_GRACE_MS);
  }

  // ---- Hide / show composer (instant, reliable) ----
  // React re-renders the composer out from under us. Acting on the node we
  // happened to capture at init means hiding a detached element: nothing moves
  // on screen and the toggle looks broken. Always re-resolve when the held
  // reference has left the document.
  // React replaces the scroll container too, and a detached one silently
  // swallows every scrollTo and reports a frozen scrollTop.
  function currentScroller() {
    var sc = rt.scrollContainer;
    if (sc && sc.isConnected === false) {
      var fresh = site.scrollRoot && site.scrollRoot();
      if (fresh) {
        rt.scrollContainer = fresh;
        rt.lastScrollTop = fresh.scrollTop || 0;
      }
    }
    return rt.scrollContainer;
  }

  function currentComposer() {
    if (rt.composerEl && rt.composerEl.isConnected === false) {
      var fresh = site.composer();
      if (fresh && fresh !== rt.composerEl) {
        rt.composerEl = fresh;
        // The replacement arrives visible, so a hide that was in force has to
        // be re-applied or our state and the page disagree.
        if (rt.composerHidden) {
          fresh.style.setProperty("display", "none", "important");
        }
      }
    }
    return rt.composerEl;
  }

  function hideComposer(opts) {
    if (!currentComposer() || rt.composerHidden) return;
    opts = opts || {};
    saveDraft();
    lockScroll();
    rt.composerEl.style.setProperty("display", "none", "important");
    document.body.classList.add("cit-composer-hidden");
    rt.composerHidden = true;
    // An explicit hide is a decision; an automatic one is a guess. Only the
    // guess may be undone by scrolling back to the bottom.
    rt.hiddenManually = !opts.auto;
    if (S.rememberState) CALM.saveState();
    // A restore is not news — it is the state you left. Hinting on every
    // navigation would turn the hint into noise.
    //
    // Neither is the fiftieth auto-hide of a long reading session. The first
    // one teaches you where the input went; after that the same sentence is
    // just something moving at the edge of your vision while you read, which
    // is the precise thing this extension exists to remove. Say it once, then
    // not again for a week — long enough to have forgotten, rare enough not
    // to be noise.
    if (opts.auto && S.showHints && !opts.silent &&
        CALM.hints.shouldShow("composerHidden", C.HINT_EVERY_DAYS)) {
      CALM.hints.markShown("composerHidden");
      ui.showToast();
    }
  }
  function showComposer() {
    if (!currentComposer() || !rt.composerHidden) return;
    lockScroll();
    rt.composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    rt.composerHidden = false;
    rt.hiddenManually = false;
    // Zen's claim on the composer lasts exactly as long as Zen's hide does.
    // Once it is revealed — by the tile, the shortcut, or type-ahead — the
    // next hide belongs to whoever asked for it, and leaving Zen must not
    // undo it. Releasing here covers every reveal path at once.
    rt.zenHidComposer = false;
    if (S.rememberState) CALM.saveState();
    restoreDraft();
    flushTypeAhead();
  }
  // Type-ahead: text typed while the composer was hidden is flushed into the
  // input on reveal, with the caret at the end, so typing stays continuous.
  function flushTypeAhead() {
    if (rt.pendingText) {
      insertIntoInput(site.promptInput(), rt.pendingText, true);
      rt.pendingText = "";
    }
    if (ui.hideTypeChip) ui.hideTypeChip();
  }
  function manualToggleComposer() {
    if (rt.composerHidden) showComposer();
    else hideComposer();
  }

  // ---- Draft save / restore (sessionStorage) ----
  function saveDraft() {
    var input = site.promptInput();
    if (!input) return;
    var text = input.tagName === "TEXTAREA" ? input.value : input.innerText;
    if (text && text.trim()) {
      try {
        sessionStorage.setItem(DRAFT_KEY, text);
        rt.draftSaved = true;
      } catch (_) {}
    }
  }
  // Insert text into the prompt input via the browser's native editing pipeline
  // (what ProseMirror / Quill listen to). Reused by type-ahead in Phase 1b.
  function insertIntoInput(input, text, focusEnd) {
    if (!input || !text) return;
    if (input.tagName === "TEXTAREA") {
      // APPEND at the caret. This used to assign input.value outright, so
      // flushing type-ahead over a half-written prompt erased it.
      var start = input.selectionStart;
      var end = input.selectionEnd;
      if (input.setRangeText && typeof start === "number" && typeof end === "number") {
        input.setRangeText(text, start, end, "end");
      } else {
        input.value = (input.value || "") + text;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    input.focus();
    var sel = window.getSelection();
    if (sel && input.childNodes.length) {
      var range = document.createRange();
      range.selectNodeContents(input);
      if (focusEnd) range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    var ok = false;
    try {
      ok = document.execCommand("insertText", false, text);
    } catch (_) {}
    if (!ok) {
      input.textContent = text;
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text,
        })
      );
    }
  }
  function restoreDraft() {
    if (!rt.draftSaved) return;
    var text;
    try {
      text = sessionStorage.getItem(DRAFT_KEY);
    } catch (_) {
      return;
    }
    var input = site.promptInput();
    // Composer was only display:none'd, so the input usually kept its text.
    var kept = input
      ? input.tagName === "TEXTAREA" ? input.value : input.innerText
      : "";
    if (kept && kept.trim()) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch (_) {}
      rt.draftSaved = false;
      return;
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
    rt.draftSaved = false;
    if (!text || !text.trim() || !input) return;
    insertIntoInput(input, text, true);
  }

  // ---- Scroll detection — ONE capture-phase listener on document ----
  function isExcludedScroller(el) {
    // Calm's own surfaces, plus whatever this site says is chrome rather than
    // conversation. The per-site half lives in the adapter so adding a fourth
    // site means writing an adapter and touching nothing here.
    var own = "#cit-console, #cit-palette, #cit-reader-pane";
    var site_ = site.excludedScrollers ? site.excludedScrollers() : "";
    try {
      return !!el.closest(site_ ? own + ", " + site_ : own);
    } catch (_) {
      return false;
    }
  }
  // Is there actually a conversation to read? On a brand-new chat there is
  // nothing to gain by hiding the composer — the user is about to type into
  // it. Two independent signals, either of which is enough, so that a rotted
  // response selector can never silently disable auto-hide on a long thread.
  function hasConversation() {
    try {
      return !site.responseSel || !!document.querySelector(site.responseSel);
    } catch (_) {
      return true; // selector rot must never disable the feature outright
    }
  }
  function worthHiding(el) {
    var range = el.scrollHeight - el.clientHeight;
    if (range < C.MIN_HIDE_RANGE) return false;
    if (range >= C.ASSUME_CONTENT_RANGE) return true;
    return hasConversation();
  }

  function handleScrollEl(el) {
    if (!S.autoHideOnScroll || rt.scrollLocked || rt.paused) {
      rt.lastScrollTop = el.scrollTop;
      return;
    }
    var cur = el.scrollTop;
    var delta = cur - rt.lastScrollTop;
    rt.lastScrollTop = cur;
    if (delta === 0) return;

    var distFromBottom = el.scrollHeight - el.clientHeight - cur;

    // Reveal is decided by POSITION, not by the size of the last movement:
    // the site's own jump-to-bottom arrow moves a whole viewport at once, and
    // arriving at the bottom should bring the input back however you got
    // there. Hiding, below, is the part that must not be fooled by a jump.
    if (rt.composerHidden && !rt.hiddenManually && distFromBottom < C.BOTTOM_THRESHOLD) {
      rt.accUp = 0;
      showComposer();
      return;
    }

    // A jump of more than a viewport in one event is the page relayouting or
    // snapping, not a hand on a wheel. Counting it as intent is how a single
    // flick used to add hundreds of pixels to the accumulator at once.
    if (Math.abs(delta) > el.clientHeight) {
      rt.accUp = 0;
      return;
    }
    clearTimeout(rt.accTimer);
    rt.accTimer = setTimeout(function () {
      rt.accUp = 0;
    }, C.ACC_RESET_MS);

    if (delta < 0) {
      rt.accUp += -delta;
      if (
        rt.accUp >= upThreshold() &&
        !rt.composerHidden &&
        distFromBottom > C.BOTTOM_THRESHOLD &&
        worthHiding(el)
      ) {
        rt.accUp = 0;
        hideComposer({ auto: true });
      }
    } else {
      rt.accUp = 0; // handled by the position check above
    }
  }
  function onAnyScroll(e) {
    var el = e.target;
    if (!el || el === document || el.nodeType === 9 || el === window) {
      el = document.scrollingElement || document.documentElement;
    }
    if (!el || el.nodeType !== 1) return;
    if (el.clientHeight < 200) return;
    if (el.scrollHeight - el.clientHeight < C.MIN_SCROLLABLE) return;
    if (isExcludedScroller(el)) return;

    if (el !== rt.scrollContainer) {
      rt.scrollContainer = el;
      rt.lastScrollTop = el.scrollTop;
      return;
    }
    handleScrollEl(el);
  }
  document.addEventListener("scroll", onAnyScroll, {
    capture: true,
    passive: true,
  });

  function discoverScroll() {
    var sc = site.scrollRoot();
    if (sc) {
      rt.scrollContainer = sc;
      rt.lastScrollTop = sc.scrollTop;
      stopRetry();
    } else startRetry();
  }
  function startRetry() {
    if (rt.retryTimer) return;
    // Capped like the composer probe. Uncapped, a rotted scrollRoot selector on
    // a non-scrolling route re-ran largestScroller() — getComputedStyle on every
    // div under <main> — every 1.5s for the life of the tab. The capture-phase
    // scroll listener still adopts a container the moment the user scrolls, so
    // giving up here costs nothing.
    var tries = 0;
    rt.retryTimer = setInterval(function () {
      if (rt.scrollContainer || ++tries > 40) return stopRetry();
      discoverScroll();
    }, C.RETRY_MS);
  }
  function stopRetry() {
    if (rt.retryTimer) {
      clearInterval(rt.retryTimer);
      rt.retryTimer = null;
    }
  }

  // ---- SPA navigation ----
  // Full teardown. SPA navs re-render the page under us: any mode artifact left
  // behind (inline display:none, injected styles, overlays, running intervals)
  // becomes an un-removable ghost — this was the root cause of the "extension
  // disappeared but still affects the page" bug on Gemini.
  function resetState() {
    rt.tearingDown = true;

    // 0. Snapshot stateful timers so navigation does NOT reset them: a
    //    Pomodoro 20 minutes into a block resumes at 20 minutes, and a Pause
    //    keeps its original end time (it must not re-arm a fresh countdown).
    var ps = CALM.pomodoro && CALM.pomodoro.state;
    rt.resumePomodoro =
      ps && ps.running
        ? {
            phase: ps.phase,
            remaining: ps.remaining,
            cycle: ps.cycle,
            paused: ps.paused,
            enteredZen: ps.enteredZen,
          }
        : null;
    rt.resumePauseEnd = rt.pauseEndTs || null;

    // 0b. Close every open popover through its own close() (removes the
    //     element AND its document listeners — no ghost panels after nav).
    if (ui.closeAllPopovers) ui.closeAllPopovers();

    // 1. Remember which modes were on, then exit them PROPERLY (each exit
    //    clears its own timers/styles/refs while they are still valid).
    rt.pendingModes = Object.keys(rt.activeModes).filter(function (id) {
      return rt.activeModes[id];
    });
    rt.pendingModes.forEach(function (id) {
      try {
        modes.exit(id);
      } catch (_) {}
    });
    // The auto-scroll player stops here rather than resuming: gliding from
    // the top of a conversation you just opened is a surprise, not a
    // convenience. (Exited above with everything else; simply not re-entered.)
    rt.pendingModes = rt.pendingModes.filter(function (id) {
      return id !== "autoscroll";
    });

    // 2. Hard-clean any residue in case an exit had stale refs.
    ["cit-zen-style", "cit-reader-style", "cit-privacy-style", "cit-night-overlay",
     "cit-pomo-widget", "cit-pomo-overlay", "cit-ruler", "cit-gray-style",
     "cit-motion-style", "cit-timebar"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.remove();
    });
    ["cit-zen", "cit-reader", "cit-night", "cit-privacy", "cit-presentation",
     "cit-gray", "cit-motion"].forEach(function (cls) {
      document.documentElement.classList.remove(cls);
    });
    if (rt.rulerHandler) {
      document.removeEventListener("mousemove", rt.rulerHandler);
      rt.rulerHandler = null;
    }
    Object.keys(rt.modeTimers).forEach(function (k) {
      if (rt.modeTimers[k]) {
        clearInterval(rt.modeTimers[k]);
        rt.modeTimers[k] = null;
      }
    });
    var chips = document.getElementById("cit-chip-stack");
    if (chips) chips.innerHTML = "";
    if (ui.hideTypeChip) ui.hideTypeChip();

    // 3. Composer / scroll / misc.
    clearTimeout(rt.accTimer);
    clearTimeout(rt.scrollLockTimer);
    clearTimeout(rt.toastTimer);
    if (rt.composerEl) rt.composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    ui.hideToast();
    rt.composerHidden = false;
    rt.scrollLocked = false;
    rt.draftSaved = false;
    rt.pendingText = "";
    rt.initialized = false;
    rt.accUp = 0;
    rt.jumpRef = null; // a new conversation: nothing to continue from
    rt.jumpTotal = -1; // forces a re-anchor to the newest answer
    rt.composerEl = null;
    rt.scrollContainer = null;
    // Calm-owned singletons that popover-close doesn't cover.
    ["cit-reader-pane", "cit-intent-pop", "cit-intent-chip",
     "cit-back", "cit-glide"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.remove();
    });
    stopRetry();
    rt.tearingDown = false;
  }
  function startNavObserver() {
    if (rt.navObserver) rt.navObserver.disconnect();
    rt.navObserver = new MutationObserver(function () {
      if (location.href !== rt.lastUrl) {
        rt.lastUrl = location.href;
        resetState();
        init();
        return;
      }
      if (rt.initialized && rt.composerEl && !document.body.contains(rt.composerEl)) {
        resetState();
        init();
      }
    });
    rt.navObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Back to the top of the answer ----
  // A long answer finishes and the view is parked at its END, because that is
  // where the streaming left you. Reading it means hunting upward for where it
  // started. This puts you on its first line instead, and pressing again walks
  // back through earlier answers — which is how people actually re-read a
  // conversation: by turn, not by pixel.
  function answers() {
    try {
      if (!site.responseSel) return [];
      return Array.prototype.slice.call(
        document.querySelectorAll(site.responseSel)
      );
    } catch (_) {
      return [];
    }
  }
  // Where the scroller's own top edge sits in the viewport. The page itself
  // IS the viewport, so its base is zero; a nested scroller has a real one.
  function scrollerBase(sc) {
    try {
      if (sc !== document.scrollingElement && sc !== document.documentElement &&
          sc !== document.body && sc.getBoundingClientRect) {
        return sc.getBoundingClientRect().top || 0;
      }
    } catch (_) {}
    return 0;
  }
  // Every answer's start as a scrollTop, sorted — what the auto-scroll
  // player walks between. Same margin as ⌃⇧J so the two agree on where an
  // answer "starts".
  function answerOffsets() {
    var sc = currentScroller();
    if (!sc) return [];
    var base = scrollerBase(sc);
    var top = sc.scrollTop || 0;
    return answers()
      .map(function (el) {
        try { return top + (el.getBoundingClientRect().top - base) - C.JUMP_MARGIN; }
        catch (_) { return null; }
      })
      .filter(function (x) { return x != null && !isNaN(x); })
      .sort(function (a, b) { return a - b; });
  }
  // ---- Up and down through the answers ----
  // ↑ goes to the start of the answer above you; ↓ to the start of the one
  // below, or the very end when there is none. They share ONE reference point
  // so they are exact inverses: ↑ ↑ ↓ lands where the first ↑ did.
  //
  // The reference is where the last jump was GOING, not where the page is,
  // because jumps are smooth: press twice quickly and the page is still
  // mid-glide, so reading scrollTop would land on the same answer twice.
  // Anything that means "I'm driving now" drops it (below), so after
  // scrolling by hand the next press starts from where you ARE. The old
  // index-based walk carried on from where it had left off, however far you
  // had scrolled since.
  function scrollBottom(sc) {
    return Math.max(0, (sc.scrollHeight || 0) - (sc.clientHeight || 0));
  }
  // The start of the next answer below `from`, or the end if there is none.
  // Shared with the auto-scroll player's double-tap, so the two can never
  // disagree about where "next" is.
  function nextAnswerTarget(from) {
    var sc = currentScroller();
    if (!sc) return null;
    var offs = answerOffsets();
    for (var i = 0; i < offs.length; i++) {
      if (offs[i] > from + 1) return Math.min(scrollBottom(sc), Math.max(0, offs[i]));
    }
    return scrollBottom(sc);
  }
  function answerNav(dir) {
    var sc = currentScroller();
    if (!sc) return;
    var offs = answerOffsets();
    if (!offs.length) return; // a new chat has nothing to walk through
    var ref = rt.jumpRef != null ? rt.jumpRef : sc.scrollTop || 0;
    var target = null;
    if (dir < 0) {
      if (rt.jumpTotal !== offs.length) {
        // A new turn arrived since the last jump: you sent a message, the
        // reply landed, and ↑ means "read it from the top".
        target = offs[offs.length - 1];
      } else {
        for (var i = offs.length - 1; i >= 0; i--) {
          if (offs[i] < ref - 1) { target = offs[i]; break; }
        }
        // Nothing above: STAY on the first rather than wrapping — wrapping
        // would fling you to the bottom just as you reached the top.
        if (target == null) target = offs[0];
      }
    } else {
      target = nextAnswerTarget(ref);
    }
    target = Math.max(0, Math.min(scrollBottom(sc), target));
    rt.jumpRef = target;
    rt.jumpTotal = offs.length;
    CALM.ui.smoothScrollTo(target);
  }
  function jumpToAnswerStart() { answerNav(-1); }
  function jumpToNextAnswer() { answerNav(1); }

  // A hand on the page: forget where the last jump was going. Input events
  // only, never `scroll` — the smooth jump itself fires that. Calm's own
  // surfaces are exempt, so wheeling over the menu does not count.
  function dropJumpRef(e) {
    try {
      if (e && e.target && e.target.closest &&
          e.target.closest("#cit-dock, #cit-console, #cit-palette, #cit-glide")) return;
    } catch (_) {}
    rt.jumpRef = null;
  }
  var NAV_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, Space: 1 };
  document.addEventListener("wheel", dropJumpRef, { passive: true, capture: true });
  document.addEventListener("touchstart", dropJumpRef, { passive: true, capture: true });
  document.addEventListener("keydown", function (e) {
    if (NAV_KEYS[e.code]) dropJumpRef(e);
  }, true);

  // ---- Keyboard ----
  document.addEventListener(
    "keydown",
    function (e) {
      // Escape ALWAYS leaves Presentation, even with shortcuts switched off:
      // Presentation hides every Calm surface including the menu that turned
      // it on, so gating this made it an unrecoverable trap that "remember
      // state" could persist across reloads.
      if (e.code === "Escape" && CALM.modes.isActive("presentation")) {
        CALM.modes.exit("presentation");
        return;
      }
      // While the auto-scroll player is on screen, Space is play/pause — a
      // player without a spacebar is broken. This is a control on a surface
      // the user put there, not a global shortcut, so it does not sit behind
      // the shortcuts switch. Never inside a text field, and it consumes the
      // key so the site does not ALSO page down.
      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey &&
          CALM.glide && modes.isActive("autoscroll")) {
        if (CALM.typeahead && CALM.typeahead.inEditable(e)) return;
        e.preventDefault();
        e.stopPropagation();
        CALM.glide.toggle();
        return;
      }
      if (!S.keyboardShortcut) return;
      if (e.code === "Escape" && modes.isActive && modes.isActive("presentation")) {
        modes.exit("presentation");
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.code === "KeyH") {
        e.preventDefault();
        e.stopPropagation();
        manualToggleComposer();
      } else if (e.code === "KeyZ") {
        e.preventDefault();
        e.stopPropagation();
        modes.toggleZen();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        e.stopPropagation();
        modes.toggle("presentation");
      } else if (e.code === "KeyJ") {
        e.preventDefault();
        e.stopPropagation();
        CALM.core.jumpToAnswerStart();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        e.stopPropagation();
        modes.toggle("autoscroll");
      } else if (e.code === "KeyE") {
        // E for "end", where repeated presses finish. N was the obvious
        // letter and cannot be had: Ctrl+Shift+N and ⌘⇧N open an incognito
        // window before the page ever sees the key.
        e.preventDefault();
        e.stopPropagation();
        CALM.core.jumpToNextAnswer();
      }
    },
    true
  );

  // ---- Init ----
  // UI is created IMMEDIATELY (never leave the page button-less — routes like
  // Gemini's /library have no composer at all). Composer discovery continues in
  // the background and composer-dependent features light up when it lands.
  // A generation token aborts stale attempt-loops from previous navigations.
  function init() {
    var gen = ++rt.initGen;
    rt.initialized = true;
    ui.createUI();
    discoverScroll();
    modes.applyWidth();
    modes.applyReaderType();

    // Re-enter modes that were active before the navigation (fresh DOM), then
    // fall back to remember-state for full page loads.
    var reentry = rt.pendingModes || [];
    rt.pendingModes = null;
    if (!reentry.length && S.rememberState) {
      var st = CALM.loadState();
      if (st.modes) {
        reentry = Object.keys(st.modes).filter(function (id) {
          return st.modes[id];
        });
      }
    }
    reentry.forEach(function (id) {
      try {
        modes.enter(id);
      } catch (_) {}
    });
    // Consume unclaimed timer snapshots (mode wasn't re-entered after all).
    rt.resumePomodoro = null;
    rt.resumePauseEnd = null;
    // Floating goal chip is a body-level singleton — re-render it after nav.
    if (CALM.intent && CALM.intent.renderChip) CALM.intent.renderChip();

    (function attempt(tries) {
      if (gen !== rt.initGen) return; // superseded by a newer navigation
      rt.composerEl = site.composer();
      if (!rt.composerEl) {
        if (tries < 120) setTimeout(function () { attempt(tries + 1); }, 500);
        return;
      }
      // Zen re-entered above may have wanted the composer hidden but no-oped
      // because the composer didn't exist yet — honor it now.
      //
      // Remember-state is deliberately weaker than Zen here: restoring a
      // hidden composer onto a BRAND-NEW chat reproduces the worst version of
      // this feature — nothing to read, and the box you are about to type in
      // is gone. Zen is a mode the user is currently in, so it still wins.
      var saved = (S.rememberState && CALM.loadState()) || {};
      var remembered = !!saved.composerHidden;
      var zenWants = modes.isActive("zen") && S.zenComposer;
      var wantHidden = zenWants || (remembered && hasConversation());
      if (wantHidden && !rt.composerHidden) {
        // Zen hiding the composer is Zen's own decision. A remembered hide
        // must come back as the KIND of hide it was, so an automatic one is
        // still undone by scrolling to the bottom.
        hideComposer(
          zenWants ? {} : { auto: !saved.hiddenManually, silent: true }
        );
      }
    })(0);
  }

  CALM.core = {
    hideComposer: hideComposer,
    showComposer: showComposer,
    manualToggleComposer: manualToggleComposer,
    saveDraft: saveDraft,
    restoreDraft: restoreDraft,
    insertIntoInput: insertIntoInput,
    discoverScroll: discoverScroll,
    currentScroller: currentScroller,
    jumpToAnswerStart: jumpToAnswerStart,
    jumpToNextAnswer: jumpToNextAnswer,
    nextAnswerTarget: nextAnswerTarget,
    answerOffsets: answerOffsets,
    init: init,
  };

  init();
  startNavObserver();
})();
