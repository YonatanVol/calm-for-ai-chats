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
    return Math.round(150 - (s - 1) * (130 / 9)); // s1=150 .. s10=20
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
  function hideComposer(opts) {
    if (!rt.composerEl || rt.composerHidden) return;
    opts = opts || {};
    saveDraft();
    lockScroll();
    rt.composerEl.style.setProperty("display", "none", "important");
    document.body.classList.add("cit-composer-hidden");
    rt.composerHidden = true;
    ui.updateQuickNav();
    if (S.rememberState) CALM.saveState();
    if (opts.auto && S.showHints) ui.showToast();
  }
  function showComposer() {
    if (!rt.composerEl || !rt.composerHidden) return;
    lockScroll();
    rt.composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    rt.composerHidden = false;
    ui.updateQuickNav();
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
      input.value = text;
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
    if (input && input.innerText && input.innerText.trim()) {
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
    return !!el.closest(
      "bard-sidenav, conversations-list, #stage-slideover-sidebar," +
        " #stage-sidebar-tiny-bar, nav[aria-label], #cit-settings-panel"
    );
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
    clearTimeout(rt.accTimer);
    rt.accTimer = setTimeout(function () {
      rt.accUp = 0;
    }, C.ACC_RESET_MS);

    if (delta < 0) {
      rt.accUp += -delta;
      if (
        rt.accUp >= upThreshold() &&
        !rt.composerHidden &&
        distFromBottom > C.BOTTOM_THRESHOLD
      ) {
        rt.accUp = 0;
        hideComposer({ auto: true });
      }
    } else {
      rt.accUp = 0;
      if (rt.composerHidden && distFromBottom < C.BOTTOM_THRESHOLD) showComposer();
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
      ui.updateQuickNav();
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
      ui.updateQuickNav();
      stopRetry();
    } else startRetry();
  }
  function startRetry() {
    if (rt.retryTimer) return;
    rt.retryTimer = setInterval(function () {
      if (!rt.scrollContainer) discoverScroll();
      else stopRetry();
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

    // 2. Hard-clean any residue in case an exit had stale refs.
    ["cit-reader-style", "cit-privacy-style", "cit-night-overlay",
     "cit-pomo-widget", "cit-pomo-overlay"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.remove();
    });
    ["cit-zen", "cit-reader", "cit-night", "cit-privacy", "cit-presentation"].forEach(
      function (cls) {
        document.documentElement.classList.remove(cls);
      }
    );
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
    rt.composerEl = null;
    rt.scrollContainer = null;
    stopRetry();
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

  // ---- Keyboard ----
  document.addEventListener(
    "keydown",
    function (e) {
      if (!S.keyboardShortcut) return;
      // Escape leaves Presentation mode (its buttons are hidden).
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

    (function attempt(tries) {
      if (gen !== rt.initGen) return; // superseded by a newer navigation
      rt.composerEl = site.composer();
      if (!rt.composerEl) {
        if (tries < 120) setTimeout(function () { attempt(tries + 1); }, 500);
        return;
      }
      // Zen re-entered above may have wanted the composer hidden but no-oped
      // because the composer didn't exist yet — honor it now.
      var wantHidden =
        (modes.isActive("zen") && S.zenComposer) ||
        (S.rememberState && !!(CALM.loadState() || {}).composerHidden);
      if (wantHidden && !rt.composerHidden) hideComposer();
      ui.updateQuickNav();
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
    init: init,
  };

  init();
  startNavObserver();
})();
