/* ===== Calm — src/wellness.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Time visibility for time-blind brains (ADHD pack):
 *  - Time-on-page chip: a gentle "you've been here N min" indicator (from 5m).
 *  - Hyperfocus alarm: every `hyperfocusMin` minutes, a non-judgmental nudge
 *    ("stretch? water?"). 0 disables it.
 * Counts time on the SITE since the tab loaded — SPA navigations do not reset
 * it (that is the honest number). Everything local; nothing recorded.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;

  var startTs = Date.now();
  var lastNudgeAt = 0;

  function fmt(min) {
    return min >= 60 ? Math.floor(min / 60) + "h " + (min % 60) + "m" : min + "m";
  }

  function tick() {
    var min = Math.floor((Date.now() - startTs) / 60000);

    if (S.showTimeOnPage && min >= 5) {
      CALM.ui.showChip("time", "🕐 " + fmt(min) + " here");
    } else {
      CALM.ui.hideChip("time");
    }

    var hf = S.hyperfocusMin | 0;
    if (hf > 0 && min > 0 && min - lastNudgeAt >= hf) {
      lastNudgeAt = min;
      CALM.ui.showToast("🌿 " + fmt(min) + " on this site — stretch? water?", true);
    }
  }

  setInterval(tick, 30000);

  CALM.wellness = {
    minutesOnPage: function () {
      return Math.floor((Date.now() - startTs) / 60000);
    },
  };
})();
