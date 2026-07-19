/* ===== Calm — src/icons.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Maison icon set: hand-drawn inline SVG, 24px grid, 1.5px stroke,
 * stroke=currentColor — one coherent thin-line language instead of emoji
 * (emoji render differently on every OS and read amateur). All static markup;
 * never mix user content into these strings.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});

  function svg(inner, vb) {
    return (
      '<svg class="cit-svg" viewBox="' + (vb || "0 0 24 24") +
      '" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  var I = {
    // Monogram: serif C inside a thin double ring — the Calm seal.
    mark:
      '<svg class="cit-svg cit-svg-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10.6" stroke="currentColor" stroke-width="0.9"/>' +
      '<circle cx="12" cy="12" r="8.9" stroke="currentColor" stroke-width="0.6" opacity="0.55"/>' +
      '<text x="12" y="16.2" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" fill="currentColor" stroke="none">C</text>' +
      "</svg>",
    input: svg('<path d="M5 9l7 7 7-7"/>'),
    zen: svg('<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M9 5V3.5M15 5V3.5M9 20.5V19M15 20.5V19M5 9H3.5M5 15H3.5M20.5 9H19M20.5 15H19" stroke-width="1"/>'),
    modes: svg('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>'),
    pomodoro: svg('<circle cx="12" cy="13" r="8"/><path d="M12 13V8.5M12 5V3.5M9.5 3.5h5"/>'),
    focus: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
    top: svg('<path d="M6 11l6-6 6 6M12 5v14"/>'),
    bottom: svg('<path d="M6 13l6 6 6-6M12 19V5"/>'),
    // A key — the castle's settings.
    settings: svg('<circle cx="8" cy="8.5" r="4.2"/><path d="M11 11.5L20 20.5M16.2 16.7l2.2-2.2M13.4 13.9l2-2"/>'),
    collapse: svg('<path d="M14 6l-6 6 6 6"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    reader: svg('<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>'),
    ruler: svg('<path d="M3 9h18M3 15h18" /><path d="M7 9v2M12 9v2M17 9v2" stroke-width="1"/>'),
    night: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
    gray: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor" fill-opacity="0.25" stroke="none"/>'),
    motion: svg('<path d="M12 4l6 8-6 8-6-8z"/>'),
    privacy: svg('<path d="M4 12s3-5.5 8-5.5S20 12 20 12s-3 5.5-8 5.5S4 12 4 12z"/><path d="M5 19L19 5"/>'),
    presentation: svg('<rect x="3.5" y="5" width="17" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/>'),
    autoscroll: svg('<path d="M7 6l5 5 5-5M7 13l5 5 5-5"/>'),
    pause: svg('<path d="M9 5v14M15 5v14"/>'),
  };

  // Per-mode icon lookup for the modes popover / settings rows.
  I.mode = {
    zen: I.zen,
    reader: I.reader,
    ruler: I.ruler,
    night: I.night,
    gray: I.gray,
    motion: I.motion,
    privacy: I.privacy,
    presentation: I.presentation,
    autoscroll: I.autoscroll,
    pause: I.pause,
    pomodoro: I.pomodoro,
  };

  CALM.icons = I;
})();
