/* ===== Calm — Reading Mode for AI Chats (ChatGPT + Gemini) =====
 *
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Local, zero-network. Hides the composer for distraction-free reading,
 * plus Zen mode, reading-width, scroll sensitivity, remember-state, quick-nav.
 *
 * Notes learned the hard way:
 *  - ChatGPT's composer is React+Tailwind and resets transform/opacity/classes;
 *    the only reliable mutation is inline `display:none !important`. So hide is
 *    INSTANT (no CSS transition on the chat's own elements). All motion lives on
 *    OUR elements (buttons/toast), which we fully control.
 *  - ChatGPT keeps the composer focused, so we must NOT guard auto-hide on focus.
 *
 * Security: never reads conversation content (only the composer input, for
 * drafts). Drafts -> sessionStorage (tab-scoped). UI prefs -> localStorage.
 */

(function () {
  "use strict";

  function q(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (_) {
      return null;
    }
  }
  function firstOf(list) {
    for (var i = 0; i < list.length; i++) if (list[i]) return list[i];
    return null;
  }
  function scrollableAncestor(el) {
    var p = el && el.parentElement;
    while (p && p !== document.body) {
      var s = getComputedStyle(p);
      if (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        p.scrollHeight > p.clientHeight
      )
        return p;
      p = p.parentElement;
    }
    return null;
  }
  function largestScroller() {
    var main = document.querySelector("main") || document.body;
    var best = null,
      bestH = 0;
    main.querySelectorAll("div, infinite-scroller").forEach(function (d) {
      var s = getComputedStyle(d);
      if (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        d.clientHeight > bestH
      ) {
        best = d;
        bestH = d.clientHeight;
      }
    });
    return best;
  }

  // =========================================================
  // Site adapters
  // =========================================================
  var ADAPTERS = {
    chatgpt: {
      id: "chatgpt",
      host: /(^|\.)chatgpt\.com$/,
      composer: function () {
        return firstOf([
          q("#thread-bottom-container"),
          q("#composer-background"),
          this.promptInput() && this.promptInput().closest("form"),
        ]);
      },
      promptInput: function () {
        return firstOf([
          q("#prompt-textarea"),
          q('div.ProseMirror[contenteditable="true"]'),
          q('form [contenteditable="true"]'),
          q("main form textarea"),
        ]);
      },
      scrollRoot: function () {
        return firstOf([
          q('[class*="group/scroll-root"]'),
          scrollableAncestor(this.composer()),
          largestScroller(),
        ]);
      },
      zenTargets: function () {
        return [
          q("#page-header"),
          q("#stage-slideover-sidebar"),
          q("#stage-sidebar-tiny-bar"),
          q('[class*="bottom-of-thread"]'),
        ].filter(Boolean);
      },
      // Reading width: ChatGPT defines --thread-content-max-width on message
      // wrappers (Tailwind arbitrary class). Override the var with ours.
      widthCss: function () {
        return (
          'html.cit-width [class*="thread-content-max-width"]{' +
          "--thread-content-max-width: var(--cit-reading-width) !important;}"
        );
      },
    },

    gemini: {
      id: "gemini",
      host: /(^|\.)gemini\.google\.com$/,
      composer: function () {
        return firstOf([
          q("input-area-v2"),
          q("input-container"),
          this.promptInput() &&
            this.promptInput().closest("input-area-v2, input-container"),
        ]);
      },
      promptInput: function () {
        return firstOf([
          q("rich-textarea .ql-editor"),
          q(".ql-editor"),
          q('[contenteditable="true"]'),
        ]);
      },
      scrollRoot: function () {
        var s = q("infinite-scroller");
        if (s) {
          var cs = getComputedStyle(s);
          if (cs.overflowY === "auto" || cs.overflowY === "scroll") return s;
        }
        return firstOf([s, largestScroller()]);
      },
      zenTargets: function () {
        return [
          q("bard-sidenav"),
          q("bard-mode-switcher") &&
            q("bard-mode-switcher").closest("header, toolbar, .top-bar, div"),
          q("modular-zero-state"),
        ].filter(Boolean);
      },
      // Gemini reading width confirmed during the width task; conservative rule.
      widthCss: function () {
        return (
          "html.cit-width .conversation-container," +
          "html.cit-width message-content," +
          "html.cit-width .response-container{" +
          "max-width: var(--cit-reading-width) !important;" +
          "width: 100% !important;}"
        );
      },
    },
  };

  function pickAdapter() {
    var h = location.hostname;
    for (var k in ADAPTERS) if (ADAPTERS[k].host.test(h)) return ADAPTERS[k];
    return null;
  }
  var site = pickAdapter();
  if (!site) return; // not a supported site

  // =========================================================
  // Entitlement seam (everything free in v1; ready for ExtPay later)
  // =========================================================
  var FEATURE_TIERS = {
    composerToggle: "free",
    keyboardShortcut: "free",
    zenMode: "free",
    rememberState: "free",
    readingWidth: "free",
    scrollSensitivity: "free",
    quickNav: "free",
  };
  function isPro() {
    return true; // v1: all unlocked. Phase E swaps this for ExtPay user.paid.
  }
  function entitled(feature) {
    return FEATURE_TIERS[feature] === "free" || isPro();
  }

  // =========================================================
  // Settings (localStorage) + per-site state (localStorage)
  // =========================================================
  var SETTINGS_KEY = "cit-settings";
  var STATE_KEY = "cit-state-" + site.id;
  var DRAFT_KEY = "cit-draft-text";

  var defaultSettings = {
    autoHideOnScroll: true,
    keyboardShortcut: true,
    showToggleButton: true,
    showHints: true,
    rememberState: false,
    showQuickNav: true,
    sensitivity: 5, // 1 (needs big scroll) .. 10 (hair trigger)
    readingWidth: 0, // 0 = off; else px
    zenComposer: true, // zen also hides the composer
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

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }
  function saveState() {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({ composerHidden: composerHidden, zen: zenOn })
      );
    } catch (_) {}
  }

  // =========================================================
  // Constants + runtime state
  // =========================================================
  var BOTTOM_THRESHOLD = 90;
  var MIN_SCROLLABLE = 200;
  var ACC_RESET_MS = 350;
  var SCROLL_GRACE_MS = 450;
  var TOAST_MS = 2200;
  var TOAST_THROTTLE_MS = 5000;
  var RETRY_MS = 1500;

  var IDS = {
    toggle: "cit-toggle-btn",
    zen: "cit-zen-btn",
    settings: "cit-settings-btn",
    panel: "cit-settings-panel",
    toast: "cit-toast",
    top: "cit-nav-top",
    bottom: "cit-nav-bottom",
    widthStyle: "cit-width-style",
  };

  var composerEl = null;
  var scrollContainer = null;
  var lastUrl = location.href;
  var navObserver = null;
  var retryTimer = null;
  var initialized = false;

  var composerHidden = false;
  var zenOn = false;
  var zenHidden = []; // elements we hid for zen (to restore)

  var scrollLocked = false;
  var scrollLockTimer = null;
  var lastScrollTop = 0;
  var accUp = 0;
  var accTimer = null;
  var draftSaved = false;
  var lastToastAt = 0;
  var toastTimer = null;

  // sensitivity -> upward px needed to hide (1=hard .. 10=easy)
  function upThreshold() {
    var s = Math.max(1, Math.min(10, settings.sensitivity || 5));
    return Math.round(150 - (s - 1) * (130 / 9)); // s1=150 .. s10=20
  }

  // =========================================================
  // Hide / show composer (instant, reliable)
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
    composerEl.style.setProperty("display", "none", "important");
    document.body.classList.add("cit-composer-hidden");
    composerHidden = true;
    updateQuickNav();
    if (settings.rememberState) saveState();
    if (opts.auto && settings.showHints) showToast();
  }
  function showComposer() {
    if (!composerEl || !composerHidden) return;
    lockScroll();
    composerEl.style.removeProperty("display");
    document.body.classList.remove("cit-composer-hidden");
    composerHidden = false;
    updateQuickNav();
    if (settings.rememberState) saveState();
    restoreDraft();
  }
  function manualToggleComposer() {
    if (composerHidden) showComposer();
    else hideComposer();
  }

  // =========================================================
  // Zen mode
  // =========================================================
  function applyZen(on) {
    if (on) {
      zenHidden = [];
      site.zenTargets().forEach(function (el) {
        if (!el) return;
        el.style.setProperty("display", "none", "important");
        zenHidden.push(el);
      });
      document.documentElement.classList.add("cit-zen");
      zenOn = true;
      if (settings.zenComposer) hideComposer();
    } else {
      zenHidden.forEach(function (el) {
        el.style.removeProperty("display");
      });
      zenHidden = [];
      document.documentElement.classList.remove("cit-zen");
      zenOn = false;
      if (settings.zenComposer && composerHidden) showComposer();
    }
    var btn = document.getElementById(IDS.zen);
    if (btn) btn.classList.toggle("cit-active", zenOn);
    if (settings.rememberState) saveState();
  }
  function toggleZen() {
    if (!entitled("zenMode")) return;
    applyZen(!zenOn);
  }

  // =========================================================
  // Reading width
  // =========================================================
  function ensureWidthStyle() {
    var st = document.getElementById(IDS.widthStyle);
    if (!st) {
      st = document.createElement("style");
      st.id = IDS.widthStyle;
      st.textContent = site.widthCss();
      document.head.appendChild(st);
    }
  }
  function applyWidth() {
    var w = settings.readingWidth | 0;
    if (w > 0 && entitled("readingWidth")) {
      ensureWidthStyle();
      document.documentElement.style.setProperty("--cit-reading-width", w + "px");
      document.documentElement.classList.add("cit-width");
    } else {
      document.documentElement.classList.remove("cit-width");
      document.documentElement.style.removeProperty("--cit-reading-width");
    }
  }

  // =========================================================
  // Quick scroll-to-top/bottom buttons
  // =========================================================
  function updateQuickNav() {
    var show =
      settings.showQuickNav && entitled("quickNav") && composerHidden && !!scrollContainer;
    [IDS.top, IDS.bottom].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.style.display = show ? "flex" : "none";
    });
  }
  function smoothScrollTo(top) {
    if (!scrollContainer) return;
    try {
      scrollContainer.scrollTo({ top: top, behavior: "smooth" });
    } catch (_) {
      scrollContainer.scrollTop = top;
    }
  }

  // =========================================================
  // Toast
  // =========================================================
  function showToast() {
    var now = Date.now();
    if (now - lastToastAt < TOAST_THROTTLE_MS) return;
    lastToastAt = now;
    var t = document.getElementById(IDS.toast);
    if (!t) {
      t = document.createElement("div");
      t.id = IDS.toast;
      document.body.appendChild(t);
    }
    t.textContent = "Input hidden · scroll down or ⌃⇧H";
    t.classList.remove("cit-toast-show");
    void t.offsetHeight;
    t.classList.add("cit-toast-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("cit-toast-show");
    }, TOAST_MS);
  }
  function hideToast() {
    var t = document.getElementById(IDS.toast);
    if (t) t.classList.remove("cit-toast-show");
    clearTimeout(toastTimer);
  }

  // =========================================================
  // Buttons
  // =========================================================
  function mkBtn(id, label, title, onClick) {
    var b = document.createElement("button");
    b.id = id;
    b.type = "button";
    b.className = "cit-btn";
    b.setAttribute("aria-label", title);
    b.setAttribute("title", title);
    b.innerHTML = label;
    b.addEventListener("click", onClick);
    document.body.appendChild(b);
    return b;
  }

  function createUI() {
    [IDS.toggle, IDS.zen, IDS.settings, IDS.top, IDS.bottom].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.remove();
    });

    var toggle = mkBtn(
      IDS.toggle,
      '<span class="cit-icon">▼</span>',
      "Toggle input (Ctrl+Shift+H)",
      manualToggleComposer
    );
    if (!settings.showToggleButton) toggle.style.display = "none";

    mkBtn(IDS.zen, "❏", "Zen mode (Ctrl+Shift+Z)", toggleZen).classList.toggle(
      "cit-active",
      zenOn
    );

    mkBtn(IDS.settings, "⚙", "Calm settings", function (e) {
      e.stopPropagation();
      toggleSettingsPanel();
    });

    mkBtn(IDS.top, "⤒", "Scroll to top", function () {
      smoothScrollTo(0);
    });
    mkBtn(IDS.bottom, "⤓", "Scroll to bottom", function () {
      smoothScrollTo(scrollContainer ? scrollContainer.scrollHeight : 0);
    });
    updateQuickNav();
  }

  // =========================================================
  // Settings panel v2 (toggles + sliders)
  // =========================================================
  function toggleSettingsPanel() {
    var p = document.getElementById(IDS.panel);
    if (p) {
      p.remove();
      return;
    }
    p = document.createElement("div");
    p.id = IDS.panel;

    var header = document.createElement("div");
    header.className = "cit-settings-header";
    var title = document.createElement("div");
    title.className = "cit-settings-title";
    title.textContent = "Calm";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "cit-settings-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "✕";
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      p.remove();
    });
    header.appendChild(title);
    header.appendChild(close);
    p.appendChild(header);

    p.appendChild(toggleRow("Auto-hide on scroll", "autoHideOnScroll"));
    p.appendChild(
      sliderRow("Scroll sensitivity", "sensitivity", 1, 10, 1, function () {})
    );
    p.appendChild(toggleRow("Zen also hides input", "zenComposer"));
    p.appendChild(toggleRow("Remember state", "rememberState", function () {
      if (settings.rememberState) saveState();
    }));
    p.appendChild(toggleRow("Quick scroll buttons", "showQuickNav", updateQuickNav));
    p.appendChild(
      sliderRow("Reading width (0=off)", "readingWidth", 0, 1600, 20, applyWidth)
    );
    p.appendChild(toggleRow("Keyboard shortcuts", "keyboardShortcut"));
    p.appendChild(toggleRow("Show toggle button", "showToggleButton", function () {
      var b = document.getElementById(IDS.toggle);
      if (b) b.style.display = settings.showToggleButton ? "" : "none";
    }));
    p.appendChild(toggleRow("Hint when auto-hidden", "showHints"));

    document.body.appendChild(p);

    function closeOnOutside(e) {
      if (!p.contains(e.target) && e.target.id !== IDS.settings) {
        p.remove();
        document.removeEventListener("click", closeOnOutside, true);
      }
    }
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside, true);
    }, 0);
  }

  function toggleRow(label, key, after) {
    var r = document.createElement("div");
    r.className = "cit-settings-row";
    var span = document.createElement("span");
    span.textContent = label;
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "cit-toggle-switch" + (settings[key] ? " cit-on" : "");
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(!!settings[key]));
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
      if (after) after();
    });
    r.appendChild(span);
    r.appendChild(sw);
    return r;
  }

  function sliderRow(label, key, min, max, step, after) {
    var r = document.createElement("div");
    r.className = "cit-settings-row cit-slider-row";
    var top = document.createElement("div");
    top.className = "cit-slider-top";
    var span = document.createElement("span");
    span.textContent = label;
    var val = document.createElement("span");
    val.className = "cit-slider-val";
    val.textContent = settings[key];
    top.appendChild(span);
    top.appendChild(val);
    var input = document.createElement("input");
    input.type = "range";
    input.className = "cit-slider";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = settings[key];
    input.addEventListener("input", function () {
      settings[key] = parseInt(input.value, 10);
      val.textContent = settings[key];
      saveSettings();
      if (after) after();
    });
    r.appendChild(top);
    r.appendChild(input);
    return r;
  }

  // =========================================================
  // Keyboard
  // =========================================================
  document.addEventListener(
    "keydown",
    function (e) {
      if (!settings.keyboardShortcut) return;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.code === "KeyH") {
        e.preventDefault();
        e.stopPropagation();
        manualToggleComposer();
      } else if (e.code === "KeyZ") {
        e.preventDefault();
        e.stopPropagation();
        toggleZen();
      }
    },
    true
  );

  // =========================================================
  // Draft save / restore (sessionStorage)
  // =========================================================
  function saveDraft() {
    var input = site.promptInput();
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
    var input = site.promptInput();
    // Composer was only display:none'd, so the input usually kept its text.
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
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
    }
  }

  // =========================================================
  // Scroll detection — ONE capture-phase listener on document.
  // Scroll events don't bubble, but a capture listener on document
  // receives them for ANY scrolling descendant. This works no matter
  // which element actually scrolls (ChatGPT's group/scroll-root, Gemini's
  // infinite-scroller / virtual viewport, or the page itself) and self-heals
  // the scrollContainer reference — far more robust than binding to one node.
  // =========================================================
  function isExcludedScroller(el) {
    return !!el.closest(
      "bard-sidenav, conversations-list, #stage-slideover-sidebar," +
        " #stage-sidebar-tiny-bar, nav[aria-label], #cit-settings-panel"
    );
  }

  function handleScrollEl(el) {
    if (!settings.autoHideOnScroll || scrollLocked) {
      lastScrollTop = el.scrollTop;
      return;
    }
    var cur = el.scrollTop;
    var delta = cur - lastScrollTop;
    lastScrollTop = cur;
    if (delta === 0) return;

    var distFromBottom = el.scrollHeight - el.clientHeight - cur;
    clearTimeout(accTimer);
    accTimer = setTimeout(function () {
      accUp = 0;
    }, ACC_RESET_MS);

    if (delta < 0) {
      // Scrolling up — hide after enough upward intent (no focus guard:
      // ChatGPT keeps the composer focused, draft is preserved while hidden).
      accUp += -delta;
      if (accUp >= upThreshold() && !composerHidden && distFromBottom > BOTTOM_THRESHOLD) {
        accUp = 0;
        hideComposer({ auto: true });
      }
    } else {
      // Scrolling down — only reveal once we reach the very bottom.
      accUp = 0;
      if (composerHidden && distFromBottom < BOTTOM_THRESHOLD) showComposer();
    }
  }

  function onAnyScroll(e) {
    var el = e.target;
    // Page-level scroll arrives with the document as target.
    if (!el || el === document || el.nodeType === 9 || el === window) {
      el = document.scrollingElement || document.documentElement;
    }
    if (!el || el.nodeType !== 1) return;
    if (el.clientHeight < 200) return; // ignore small/menu scrollers
    if (el.scrollHeight - el.clientHeight < MIN_SCROLLABLE) return; // not really scrollable
    if (isExcludedScroller(el)) return; // sidebar / settings panel

    if (el !== scrollContainer) {
      // New/changed scroller — adopt it and baseline (no spurious delta).
      scrollContainer = el;
      lastScrollTop = el.scrollTop;
      updateQuickNav();
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
      scrollContainer = sc;
      lastScrollTop = sc.scrollTop;
      updateQuickNav();
      stopRetry();
    } else startRetry();
  }
  function startRetry() {
    if (retryTimer) return;
    retryTimer = setInterval(function () {
      if (!scrollContainer) discoverScroll();
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
    scrollContainer = null;
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
    (function attempt() {
      composerEl = site.composer();
      if (!composerEl) {
        if (++tries > 40) return;
        setTimeout(attempt, 500);
        return;
      }
      initialized = true;
      createUI();
      discoverScroll();
      applyWidth();

      // Remember-state: re-apply last session's choices for this site.
      if (settings.rememberState) {
        var st = loadState();
        if (st.zen) applyZen(true);
        else if (st.composerHidden) hideComposer();
      }
    })();
  }

  init();
  startNavObserver();
})();
