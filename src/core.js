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
    if (!S.autoHideOnScroll || rt.scrollLocked) {
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
  function resetState() {
    clearTimeout(rt.accTimer);
    clearTimeout(rt.scrollLockTimer);
    clearTimeout(rt.toastTimer);
    if (rt.composerEl) rt.composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    ui.hideToast();
    rt.composerHidden = false;
    rt.scrollLocked = false;
    rt.draftSaved = false;
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
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.code === "KeyH") {
        e.preventDefault();
        e.stopPropagation();
        manualToggleComposer();
      } else if (e.code === "KeyZ") {
        e.preventDefault();
        e.stopPropagation();
        modes.toggleZen();
      }
    },
    true
  );

  // ---- Init ----
  function init() {
    var tries = 0;
    (function attempt() {
      rt.composerEl = site.composer();
      if (!rt.composerEl) {
        if (++tries > 40) return;
        setTimeout(attempt, 500);
        return;
      }
      rt.initialized = true;
      ui.createUI();
      discoverScroll();
      modes.applyWidth();
      if (S.rememberState) {
        var st = CALM.loadState();
        if (st.zen) modes.applyZen(true);
        else if (st.composerHidden) hideComposer();
      }
    })();
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
