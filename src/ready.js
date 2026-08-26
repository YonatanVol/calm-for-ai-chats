/* ===== Calm — src/ready.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * "Your answer is ready."
 *
 * You ask something long, switch tabs, and then keep flicking back to check.
 * That flicking is the distraction — not the waiting. So when a reply finishes
 * while the tab is in the background, the tab title says so, and stops saying
 * so the moment you look.
 *
 * Nothing here needs a permission: the title belongs to the page, the state is
 * read from the page, and the sound is the chime the extension already has.
 *
 * Detection is by the site's own stop-generating control, which exists only
 * while a reply is streaming. If that selector ever rots the feature simply
 * never fires — it can produce a missing cue, never a false one, which is the
 * right way round for something that interrupts you.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var site = CALM.site;

  var BADGE = "● Ready · ";
  var wasGenerating = false;
  var armed = false; // a reply finished while we were away
  var realTitle = null; // the site's title, before we touched it

  function generating() {
    if (!site.stopSel) return false;
    try {
      return !!document.querySelector(site.stopSel);
    } catch (_) {
      return false;
    }
  }
  function badged() {
    return document.title.indexOf(BADGE) === 0;
  }
  function away() {
    return !!document.hidden;
  }

  function markReady() {
    if (armed) return;
    armed = true;
    realTitle = document.title;
    document.title = BADGE + realTitle;
    if (S.answerReadyChime && CALM.audio) CALM.audio.playChime();
  }

  function clearBadge() {
    if (!armed) return;
    armed = false;
    // Restore the site's own title, but only if it is still ours to restore —
    // the page may legitimately have renamed itself while we were away.
    if (badged()) document.title = document.title.slice(BADGE.length);
    realTitle = null;
  }

  function poll() {
    if (!S.answerReady) {
      clearBadge();
      wasGenerating = false;
      return;
    }
    var now = generating();
    // The edge that matters: it WAS streaming, it no longer is, and we were
    // not watching. Mid-stream tab switches still count, which is the point.
    if (wasGenerating && !now && away()) markReady();
    wasGenerating = now;

    // These sites rewrite their own <title> constantly (the conversation gets
    // named, a model switches). Re-apply rather than lose the cue.
    if (armed && away() && !badged()) {
      realTitle = document.title;
      document.title = BADGE + realTitle;
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (!away()) clearBadge(); // you looked; that is the whole signal
  });
  window.addEventListener("focus", function () {
    clearBadge();
  });

  setInterval(poll, 800);

  CALM.ready = { _poll: poll, _clear: clearBadge };
})();
