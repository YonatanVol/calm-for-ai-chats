/* ===== Calm — src/adapters.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Site-adapter layer + shared DOM helpers. Loaded first; exposes
 * window.CALM.{helpers, ADAPTERS, site}. Adding a new AI chat site = add an
 * adapter here, nothing else changes.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});

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
      // ChatGPT: stylesheet zen (stable IDs) + inline fallback (zenInline).
      zenInline: true,
      zenTargets: function () {
        return [
          q("#page-header"),
          q("#stage-slideover-sidebar"),
          q("#stage-sidebar-tiny-bar"),
          q('[class*="bottom-of-thread"]'),
        ].filter(Boolean);
      },
      zenCss: function () {
        return (
          "html.cit-zen #page-header," +
          "html.cit-zen #stage-slideover-sidebar," +
          "html.cit-zen #stage-sidebar-tiny-bar," +
          'html.cit-zen [class*="bottom-of-thread"]' +
          "{display:none !important;}"
        );
      },
      // Reader typography target (message prose).
      readerTargets: function () {
        return ".markdown, [class*='prose'], [data-message-author-role] .markdown";
      },
      // Sidebar conversation titles to blur in Privacy/Share mode.
      privacyTargets: function () {
        return "#stage-slideover-sidebar a, nav a[href*='/c/']";
      },
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
      // Gemini: stylesheet-only zen (Angular re-renders make inline styles and
      // saved refs go stale — the old ".closest('div')" ancestor walk hid
      // arbitrary layout containers and could never be undone reliably).
      // Only known, self-contained custom elements are targeted.
      zenInline: false,
      zenTargets: function () {
        return [
          q("bard-sidenav"),
          q("bard-mode-switcher"),
          q("chat-app-side-nav-menu-button"),
          q("modular-zero-state"),
        ].filter(Boolean);
      },
      zenCss: function () {
        return (
          "html.cit-zen bard-sidenav," +
          "html.cit-zen bard-mode-switcher," +
          "html.cit-zen chat-app-side-nav-menu-button," +
          "html.cit-zen modular-zero-state," +
          "html.cit-zen bot-banner," +
          "html.cit-zen chat-app-banners," +
          "html.cit-zen chat-app-announcement-banners" +
          "{display:none !important;}"
        );
      },
      readerTargets: function () {
        return "message-content, .markdown, .model-response-text";
      },
      privacyTargets: function () {
        return "conversations-list .conversation, gem-nav-list-item .title";
      },
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

  CALM.helpers = {
    q: q,
    firstOf: firstOf,
    scrollableAncestor: scrollableAncestor,
    largestScroller: largestScroller,
  };
  CALM.ADAPTERS = ADAPTERS;
  CALM.site = pickAdapter();
})();
