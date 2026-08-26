/* ===== Calm — src/tour.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The first run. Three short cards, once, ever.
 *
 * Deliberately not a modal over the conversation: it hangs off the menu it is
 * describing, so the thing being pointed at is visible while you read about
 * it. There is a way out on every card, dismissal is permanent, and it never
 * appears over a presentation.
 *
 * An extension that promises calm gets exactly one interruption, and only to
 * say where its controls are.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var IDS = CALM.IDS;

  var KEY = "cit-onboarded";
  var step = 0;
  var unEsc = null;

  var CARDS = [
    {
      title: "This is Calm",
      body: "Everything lives behind this one mark. Click it for the menu; drag it anywhere you like.",
    },
    {
      title: "One shortcut for everything",
      body: "⌘K opens a search over every mode, action and setting — including the ones tucked away.",
    },
    {
      title: "Hide the input to read",
      body: "⌃⇧H clears the message box for full-height reading. Start typing and it comes straight back.",
    },
  ];

  function done() {
    try {
      localStorage.setItem(KEY, "1");
    } catch (_) {}
    close();
  }
  function seen() {
    try {
      return !!localStorage.getItem(KEY);
    } catch (_) {
      return true; // storage unavailable: never nag rather than nag forever
    }
  }
  function close() {
    var t = document.getElementById(IDS.tour);
    if (t) t.remove();
    if (unEsc) {
      unEsc();
      unEsc = null;
    }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render(host) {
    var old = document.getElementById(IDS.tour);
    if (old) old.remove();
    var card = CARDS[step];
    if (!card) return done();

    var t = el("div", "cit-tour-card");
    t.id = IDS.tour;
    t.setAttribute("role", "dialog");
    t.setAttribute("aria-label", "Getting started with Calm");

    var head = el("div", "cit-tour-head");
    head.appendChild(el("span", "cit-tour-brand", "CALM"));
    head.appendChild(el("span", "cit-tour-step", step + 1 + " / " + CARDS.length));
    t.appendChild(head);

    t.appendChild(el("div", "cit-tour-title", card.title));
    t.appendChild(el("div", "cit-tour-body", card.body));

    var foot = el("div", "cit-tour-foot");
    var skip = el("button", "cit-tour-skip", "Skip");
    skip.type = "button";
    skip.addEventListener("click", function (e) {
      e.stopPropagation();
      done();
    });
    var next = el("button", "cit-tour-next", step === CARDS.length - 1 ? "Done" : "Next");
    next.type = "button";
    next.addEventListener("click", function (e) {
      e.stopPropagation();
      step++;
      if (step >= CARDS.length) return done();
      render(host);
    });
    foot.appendChild(skip);
    foot.appendChild(next);
    t.appendChild(foot);

    host.appendChild(t);

    if (!unEsc && CALM.ui.registerEscape) {
      unEsc = CALM.ui.registerEscape(function () {
        if (!document.getElementById(IDS.tour)) return false;
        done(); // Escape means "I have seen enough", not "ask me again"
        return true;
      });
    }
  }

  // Called at the end of dock.build(), so the tour hangs off the menu wherever
  // that menu currently is — corner pill or margin rail.
  function maybeShow(host) {
    if (seen()) return;
    // Never over something the user is showing other people.
    if (CALM.modes && CALM.modes.isActive("presentation")) return;
    if (!host) return;
    render(host);
  }

  CALM.tour = { maybeShow: maybeShow, close: close, _seen: seen };
})();
