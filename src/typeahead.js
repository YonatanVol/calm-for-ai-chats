/* ===== Calm — src/typeahead.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Typing continuity: when the composer is hidden and you start typing, capture
 * it so nothing is lost. Three user-selectable behaviors (settings.typeAhead):
 *   auto   — reveal the input immediately and type into it live
 *   buffer — capture silently (chip shown); reveal with the text on Ctrl/Cmd+Shift+H
 *   both   — first key buffers + shows a chip; the next key (or the shortcut)
 *            reveals and flushes, so you can keep typing or use the shortcut
 *   off    — do nothing
 * Loaded after core.js. Reuses CALM.core.{showComposer,insertIntoInput}.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var site = CALM.site;
  var S = CALM.settings;
  var rt = CALM.rt;

  function isPrintable(e) {
    return (
      e.key &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    );
  }
  function focusInEditable() {
    var a = document.activeElement;
    if (!a) return false;
    return (
      a.isContentEditable ||
      a.tagName === "TEXTAREA" ||
      a.tagName === "INPUT" ||
      a.tagName === "SELECT"
    );
  }
  function revealAndInsert(ch) {
    CALM.core.showComposer(); // flushes any pending buffer + restores draft
    CALM.core.insertIntoInput(site.promptInput(), ch, true);
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (!rt.composerHidden) return;
      var mode = S.typeAhead;
      if (mode === "off" || !mode) return;
      if (!isPrintable(e)) return;
      if (focusInEditable()) return;

      e.preventDefault();
      e.stopPropagation();

      if (mode === "auto") {
        revealAndInsert(e.key);
      } else if (mode === "buffer") {
        rt.pendingText += e.key;
        CALM.ui.showTypeChip(rt.pendingText);
      } else {
        // both: first key buffers + chip; next key reveals & flushes.
        rt.pendingText += e.key;
        if (rt.pendingText.length === 1) {
          CALM.ui.showTypeChip(rt.pendingText);
        } else {
          CALM.core.showComposer(); // flush pending (incl. this key)
        }
      }
    },
    true // capture: run before the site's own key handling
  );
})();
