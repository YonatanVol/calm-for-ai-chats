/* ===== ChatGPT Input Toggle — content.js =====
 *
 * Hide/show the ChatGPT composer for distraction-free reading.
 *
 * Why the composer hide is instant (no CSS animation):
 *   #thread-bottom-container is a React + Tailwind element whose
 *   transform / opacity / translate / filter are actively normalized by
 *   ChatGPT's own "content-fade" render loop. Any CSS transition or Web
 *   Animation on it gets reset mid-flight (the source of the old
 *   "vibration" bug). The only mutation that reliably sticks is an inline
 *   `display:none !important`, so that is what we use. All motion lives on
 *   our own elements (button + toast), which we fully control.
 *
 * Security:
 *   - No network requests, no external resources.
 *   - Never reads conversation content (only the composer input, for drafts).
 *   - Draft text lives in sessionStorage ONLY (dies with the tab).
 *   - Boolean UI prefs live in localStorage (no sensitive data).
 */

(function () {
  "use strict";

  // ---- Constants -------------------------------------------------
  var SETTINGS_KEY = "cit-settings"; // localStorage (prefs persist)
  var DRAFT_KEY = "cit-draft-text"; // sessionStorage (tab-scoped, secure)

  var UP_THRESHOLD = 60; // px of upward scroll to trigger hide
  var BOTTOM_THRESHOLD = 90; // px from bottom counts as "at bottom" (reveal point)
  var MIN_SCROLLABLE = 200; // need this much scrollable height to auto-hide
  var ACC_RESET_MS = 350; // accumulator decays after this idle gap
  var SCROLL_GRACE_MS = 450; // ignore scroll right after a toggle
  var TOAST_MS = 2200; // how long the hint toast stays
  var TOAST_THROTTLE_MS = 5000; // min gap between hint toasts
  var RETRY_MS = 1500; // re-discovery poll interval

  var TOGGLE_BTN_ID = "cit-toggle-btn";
  var SETTINGS_BTN_ID = "cit-settings-btn";
  var SETTINGS_PANEL_ID = "cit-settings-panel";
  var TOAST_ID = "cit-toast";

  // ---- Settings --------------------------------------------------
  var defaultSettings = {
    autoHideOnScroll: true,
    keyboardShortcut: true,
    showToggleButton: true,
    showHints: true,
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return Object.assign({}, defaultSettings, JSON.parse(raw));
    } catch (_) {}
    return Object.assign({}, defaultSettings);
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  var settings = loadSettings();

  // ---- State -----------------------------------------------------
  var composerEl = null;
  var scrollContainer = null;
  var lastUrl = location.href;
  var navObserver = null;
  var retryTimer = null;
  var initialized = false;

  var composerHidden = false;

  var scrollLocked = false;
  var scrollLockTimer = null;
  var lastScrollTop = 0;
  var accUp = 0;
  var accTimer = null;
  var draftSaved = false;
  var lastToastAt = 0;
  var toastTimer = null;

  // =========================================================
  // Element discovery (resilient fallback chains)
  // =========================================================

  function findPromptInput() {
    return (
      document.querySelector("#prompt-textarea") ||
      document.querySelector('div.ProseMirror[contenteditable="true"]') ||
      document.querySelector('form [contenteditable="true"]') ||
      document.querySelector("main form textarea")
    );
  }

  function findComposer() {
    var el =
      document.querySelector("#thread-bottom-container") ||
      document.querySelector("#composer-background") ||
      document.querySelector('[class*="thread-bottom"]');
    if (el) return el;

    var input = findPromptInput();
    if (!input) return null;

    var form = input.closest("form");
    if (form) return form;

    var p = input.parentElement;
    while (p && p !== document.body) {
      var s = getComputedStyle(p);
      if (s.position !== "static" && p.offsetWidth > window.innerWidth * 0.5) {
        return p;
      }
      p = p.parentElement;
    }
    return null;
  }

  function findScrollContainer() {
    var root = document.querySelector('[class*="group/scroll-root"]');
    if (root) return root;

    var anchor = composerEl || findComposer();
    if (anchor) {
      var p = anchor.parentElement;
      while (p && p !== document.body) {
        var s = getComputedStyle(p);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          p.scrollHeight > p.clientHeight
        ) {
          return p;
        }
        p = p.parentElement;
      }
    }

    var turn = document.querySelector('[data-testid^="conversation-turn"]');
    if (turn) {
      var q = turn.parentElement;
      while (q && q !== document.body) {
        var qs = getComputedStyle(q);
        if (qs.overflowY === "auto" || qs.overflowY === "scroll") return q;
        q = q.parentElement;
      }
    }

    var main = document.querySelector("main");
    if (!main) return null;
    var best = null;
    var bestH = 0;
    main.querySelectorAll("div").forEach(function (d) {
      var ds = getComputedStyle(d);
      if (
        (ds.overflowY === "auto" || ds.overflowY === "scroll") &&
        d.clientHeight > bestH
      ) {
        best = d;
        bestH = d.clientHeight;
      }
    });
    return best;
  }

  // =========================================================
  // Hide / show (instant + reliable)
  // =========================================================

  function lockScroll() {
    scrollLocked = true;
    accUp = 0;
    clearTimeout(scrollLockTimer);
    scrollLockTimer = setTimeout(function () {
      scrollLocked = false;
      if (scrollContainer) lastScrollTop = scrollContainer.scrollTop;
    }, SCROLL_GRACE_MS);
  }

  function hideComposer(opts) {
    if (!composerEl || composerHidden) return;
    opts = opts || {};

    saveDraft();
    lockScroll();

    // Inline display:none is the only mutation that reliably sticks on this
    // React/Tailwind element. ProseMirror keeps its content while hidden.
    composerEl.style.setProperty("display", "none", "important");
    document.body.classList.add("cit-composer-hidden");
    composerHidden = true;

    if (opts.auto && settings.showHints) showToast();
  }

  function showComposer() {
    if (!composerEl || !composerHidden) return;

    lockScroll();
    composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    composerHidden = false;

    restoreDraft();
  }

  function manualToggle() {
    if (composerHidden) showComposer();
    else hideComposer();
  }

  // =========================================================
  // Toast (auto-hide feedback)
  // =========================================================

  function showToast() {
    var now = Date.now();
    if (now - lastToastAt < TOAST_THROTTLE_MS) return;
    lastToastAt = now;

    var toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    toast.textContent = "Input hidden · scroll down or ⌃⇧H";
    toast.classList.remove("cit-toast-show");
    void toast.offsetHeight;
    toast.classList.add("cit-toast-show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("cit-toast-show");
    }, TOAST_MS);
  }

  function hideToast() {
    var toast = document.getElementById(TOAST_ID);
    if (toast) toast.classList.remove("cit-toast-show");
    clearTimeout(toastTimer);
  }

  // =========================================================
  // Buttons
  // =========================================================

  function createToggleButton() {
    var old = document.getElementById(TOGGLE_BTN_ID);
    if (old) old.remove();

    var btn = document.createElement("button");
    btn.id = TOGGLE_BTN_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle ChatGPT input area");
    btn.setAttribute("title", "Toggle input (Ctrl+Shift+H)");
    btn.innerHTML = '<span class="cit-icon">▼</span>';
    btn.addEventListener("click", manualToggle);
    if (!settings.showToggleButton) btn.style.display = "none";
    document.body.appendChild(btn);

    createSettingsButton();
  }

  function createSettingsButton() {
    var old = document.getElementById(SETTINGS_BTN_ID);
    if (old) old.remove();

    var btn = document.createElement("button");
    btn.id = SETTINGS_BTN_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "Input Toggle settings");
    btn.setAttribute("title", "Input Toggle settings");
    btn.innerHTML = "⚙";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleSettingsPanel();
    });
    document.body.appendChild(btn);
  }

  // =========================================================
  // Settings panel
  // =========================================================

  function toggleSettingsPanel() {
    var panel = document.getElementById(SETTINGS_PANEL_ID);
    if (panel) {
      panel.remove();
      return;
    }

    panel = document.createElement("div");
    panel.id = SETTINGS_PANEL_ID;

    var header = document.createElement("div");
    header.className = "cit-settings-header";

    var title = document.createElement("div");
    title.className = "cit-settings-title";
    title.textContent = "Input Toggle";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "cit-settings-close";
    close.setAttribute("aria-label", "Close settings");
    close.innerHTML = "✕";
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.remove();
    });

    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);

    panel.appendChild(row("Auto-hide on scroll", "autoHideOnScroll"));
    panel.appendChild(row("Keyboard shortcut (Ctrl+Shift+H)", "keyboardShortcut"));
    panel.appendChild(row("Show toggle button", "showToggleButton"));
    panel.appendChild(row("Show hint when auto-hidden", "showHints"));

    document.body.appendChild(panel);

    function closeOnOutside(e) {
      if (!panel.contains(e.target) && e.target.id !== SETTINGS_BTN_ID) {
        panel.remove();
        document.removeEventListener("click", closeOnOutside, true);
      }
    }
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  function row(label, key) {
    var r = document.createElement("div");
    r.className = "cit-settings-row";

    var span = document.createElement("span");
    span.textContent = label;

    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "cit-toggle-switch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(!!settings[key]));
    if (settings[key]) sw.classList.add("cit-on");

    var knob = document.createElement("div");
    knob.className = "cit-toggle-knob";
    sw.appendChild(knob);

    sw.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      settings[key] = !settings[key];
      saveSettings();
      sw.classList.toggle("cit-on", settings[key]);
      sw.setAttribute("aria-checked", String(settings[key]));
      applySettings();
    });

    r.appendChild(span);
    r.appendChild(sw);
    return r;
  }

  function applySettings() {
    var btn = document.getElementById(TOGGLE_BTN_ID);
    if (btn) btn.style.display = settings.showToggleButton ? "" : "none";

    // If auto-hide was switched off while auto-hidden, bring it back.
    if (!settings.autoHideOnScroll && composerHidden) showComposer();
    if (!settings.showHints) hideToast();
  }

  // =========================================================
  // Keyboard shortcut (layout-independent via e.code)
  // =========================================================

  function onKeydown(e) {
    if (!settings.keyboardShortcut) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyH") {
      e.preventDefault();
      e.stopPropagation();
      manualToggle();
    }
  }
  document.addEventListener("keydown", onKeydown, true);

  // =========================================================
  // Draft save / restore (sessionStorage only)
  // =========================================================

  function saveDraft() {
    var input = findPromptInput();
    if (!input) return;
    var text = input.tagName === "TEXTAREA" ? input.value : input.innerText;
    if (text && text.trim()) {
      try {
        sessionStorage.setItem(DRAFT_KEY, text);
        draftSaved = true;
      } catch (_) {}
    }
  }

  function restoreDraft() {
    if (!draftSaved) return;
    var text;
    try {
      text = sessionStorage.getItem(DRAFT_KEY);
    } catch (_) {
      return;
    }

    var input = findPromptInput();

    // The composer is only display:none'd, so the input normally keeps its
    // text across a toggle. Only re-insert if it was actually cleared.
    if (input && input.innerText && input.innerText.trim()) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch (_) {}
      draftSaved = false;
      return;
    }

    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
    draftSaved = false;
    if (!text || !text.trim() || !input) return;

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

  // =========================================================
  // Scroll detection — unified scroll event (covers wheel,
  // touch, keyboard, scrollbar). Direction via scrollTop delta.
  // =========================================================

  function onScroll() {
    if (!scrollContainer) return;
    var cur = scrollContainer.scrollTop;

    if (!settings.autoHideOnScroll || scrollLocked) {
      lastScrollTop = cur;
      return;
    }

    var delta = cur - lastScrollTop;
    lastScrollTop = cur;
    if (delta === 0) return;

    var maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    var distFromBottom = maxScroll - cur;
    if (maxScroll < MIN_SCROLLABLE) return;

    clearTimeout(accTimer);
    accTimer = setTimeout(function () {
      accUp = 0;
    }, ACC_RESET_MS);

    if (delta < 0) {
      // Scrolling up — hide after enough upward intent.
      // (No focus guard: ChatGPT keeps the composer focused, and the draft
      // is preserved while hidden, so hiding on scroll-up is always safe.)
      accUp += -delta;
      if (
        accUp >= UP_THRESHOLD &&
        !composerHidden &&
        distFromBottom > BOTTOM_THRESHOLD
      ) {
        accUp = 0;
        hideComposer({ auto: true });
      }
    } else {
      // Scrolling down — only reveal once we reach the very bottom.
      accUp = 0;
      if (composerHidden && distFromBottom < BOTTOM_THRESHOLD) {
        showComposer();
      }
    }
  }

  function attachScroll() {
    scrollContainer = findScrollContainer();
    if (scrollContainer) {
      lastScrollTop = scrollContainer.scrollTop;
      scrollContainer.addEventListener("scroll", onScroll, { passive: true });
      stopRetry();
    } else {
      startRetry();
    }
  }

  function detachScroll() {
    if (scrollContainer) {
      scrollContainer.removeEventListener("scroll", onScroll);
      scrollContainer = null;
    }
  }

  function startRetry() {
    if (retryTimer) return;
    retryTimer = setInterval(function () {
      if (!scrollContainer) attachScroll();
      else stopRetry();
    }, RETRY_MS);
  }

  function stopRetry() {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  // =========================================================
  // SPA navigation
  // =========================================================

  function resetState() {
    clearTimeout(accTimer);
    clearTimeout(scrollLockTimer);
    clearTimeout(toastTimer);

    if (composerEl) composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    hideToast();

    composerHidden = false;
    scrollLocked = false;
    draftSaved = false;
    initialized = false;
    accUp = 0;
    composerEl = null;

    detachScroll();
    stopRetry();
  }

  function startNavObserver() {
    if (navObserver) navObserver.disconnect();
    navObserver = new MutationObserver(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        resetState();
        init();
        return;
      }
      if (initialized && composerEl && !document.body.contains(composerEl)) {
        resetState();
        init();
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
  }

  // =========================================================
  // Init
  // =========================================================

  function init() {
    var tries = 0;
    var maxTries = 40; // ~20s at 500ms

    function attempt() {
      composerEl = findComposer();
      if (!composerEl) {
        if (++tries > maxTries) return;
        setTimeout(attempt, 500);
        return;
      }
      initialized = true;
      createToggleButton();
      attachScroll();
    }
    attempt();
  }

  init();
  startNavObserver();
})();
