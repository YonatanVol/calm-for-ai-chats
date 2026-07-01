/* ===== Calm — src/audio.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * End-of-timer sound. The bundled option is SYNTHESIZED with the Web Audio API
 * — no audio files, no web_accessible_resources, no network, and inherently
 * royalty-free. (Spotify streaming is added in Phase 6 and will take priority
 * here when connected.) The AudioContext is unlocked on a user gesture (the
 * click that starts the timer). Exposes window.CALM.audio.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var ctx = null;

  function unlock() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch (_) {}
  }

  function tone(freq, startAt, dur, peak) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    var t0 = ctx.currentTime + startAt;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // A gentle major arpeggio (C5–E5–G5) with a soft C6 to finish.
  function playChime() {
    if (!S.pomoSound) return;
    unlock();
    if (!ctx) return;
    var notes = [523.25, 659.25, 783.99];
    notes.forEach(function (f, i) {
      tone(f, i * 0.18, 0.55, 0.18);
    });
    tone(1046.5, 0.54, 0.8, 0.13);
  }

  CALM.audio = { unlock: unlock, playChime: playChime };
})();
