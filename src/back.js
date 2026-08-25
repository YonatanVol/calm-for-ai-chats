/* ===== Calm — src/back.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * "Where was I?"
 *
 * You leave the tab, something else happens, and half an hour later you come
 * back to a wall of text with no idea which thread you were pulling. The
 * expensive part of an interruption is not the interruption — it is the
 * re-entry.
 *
 * So on returning after a real absence, one quiet card says what you had set
 * out to do, how many thoughts you parked, and offers to put you back where
 * you stopped reading.
 *
 * Rules it holds to, because this is the kind of feature that becomes a nag:
 *   - only after a genuinely long absence, not a tab flick;
 *   - only if it has something to say — no goal and nothing parked, no card;
 *   - never during a presentation;
 *   - dismissing restarts the clock, so it cannot bounce straight back.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var rt = CALM.rt;
  var IDS = CALM.IDS;

  var leftAt = null;
  var lastScrollTop = 0;
  var unEsc = null;
  var autoClose = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function close() {
    var c = document.getElementById(IDS.back);
    if (c) c.remove();
    if (unEsc) {
      unEsc();
      unEsc = null;
    }
    // The card lets itself out after 18s. If it left early — dismissed, or
    // torn down by a navigation — that timer must go with it, or it fires
    // over whatever card is up by then.
    if (autoClose) {
      clearTimeout(autoClose);
      autoClose = null;
    }
    if (CALM.ui.unregisterPopover) CALM.ui.unregisterPopover(close);
  }

  function parkedCount() {
    try {
      return (CALM.intent && CALM.intent.notes ? CALM.intent.notes() : []).length;
    } catch (_) {
      return 0;
    }
  }

  function show() {
    close();
    var goal = (CALM.intent && CALM.intent.state && CALM.intent.state.goal) || "";
    var parked = parkedCount();
    // Nothing to say is a perfectly good outcome.
    if (!goal && !parked) return;

    var c = el("div");
    c.id = IDS.back;
    c.setAttribute("role", "status");

    var head = el("div", "cit-back-head");
    head.appendChild(el("span", "cit-back-brand", "Where you were"));
    var x = el("button", "cit-back-x");
    x.type = "button";
    x.setAttribute("aria-label", "Dismiss");
    x.innerHTML = CALM.icons.close;
    x.addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
    head.appendChild(x);
    c.appendChild(head);

    if (goal) {
      var g = el("div", "cit-back-goal", goal);
      g.setAttribute("dir", "auto"); // the user's own words
      c.appendChild(g);
    }
    if (parked) {
      var p = el("button", "cit-back-parked",
        parked + (parked === 1 ? " parked thought" : " parked thoughts"));
      p.type = "button";
      p.addEventListener("click", function (e) {
        e.stopPropagation();
        if (CALM.intent) CALM.intent.toggle(true);
        close();
      });
      c.appendChild(p);
    }

    // Only offer to jump if we actually know where they were, and they have
    // since moved. An offer that does nothing is worse than no offer.
    var sc = CALM.core && CALM.core.currentScroller && CALM.core.currentScroller();
    if (sc && lastScrollTop && Math.abs((sc.scrollTop || 0) - lastScrollTop) > 200) {
      var jump = el("button", "cit-back-jump", "Back to where you stopped");
      jump.type = "button";
      jump.addEventListener("click", function (e) {
        e.stopPropagation();
        CALM.ui.smoothScrollTo(lastScrollTop);
        close();
      });
      c.appendChild(jump);
    }

    document.body.appendChild(c);
    if (CALM.ui.registerEscape) {
      unEsc = CALM.ui.registerEscape(function () {
        if (!document.getElementById(IDS.back)) return false;
        close();
        return true;
      });
    }
    // This card belongs to the conversation it was raised over: the jump
    // button holds a scroll offset measured in THAT conversation. Registering
    // with the popover registry is what takes it down on a navigation — and
    // it is the same registry every other surface uses, so it also inherits
    // the "close it and release its listeners together" contract.
    if (CALM.ui.registerPopover) CALM.ui.registerPopover(close);
    // It is a reminder, not a demand: it lets itself out.
    autoClose = setTimeout(close, 18000);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      leftAt = Date.now();
      var sc = CALM.core && CALM.core.currentScroller && CALM.core.currentScroller();
      lastScrollTop = sc ? sc.scrollTop || 0 : 0;
      return;
    }
    var away = leftAt ? Date.now() - leftAt : 0;
    leftAt = null;
    if (!S.whereWasI) return;
    if (away < (S.whereWasIMin | 0) * 60000) return; // a flick, not an absence
    if (CALM.modes && CALM.modes.isActive("presentation")) return;
    show();
  });

  CALM.back = { show: show, close: close };
})();
