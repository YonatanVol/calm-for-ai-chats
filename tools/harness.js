#!/usr/bin/env node
/* ===== Calm — tools/harness.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 *
 * The verification gate. Runs the full stubbed-DOM behavioral suite plus
 * static checks. Exit 0 = safe to merge; anything else = do not merge.
 * No dependencies — plain Node. Usage: node tools/harness.js
 */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");

var MODULES = [
  "icons", "adapters", "state", "modes", "presets", "audio",
  "pomodoro", "reader", "ui", "console", "dock", "palette", "wellness", "intent", "core", "typeahead",
].map(function (n) { return path.join(ROOT, "src", n + ".js"); });

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (detail ? "  " + detail : "")); }
}
function section(t) { console.log("\n== " + t + " =="); }

/* ---------------- stub DOM worlds ---------------- */
// lenient: element.querySelector falls back to a fresh stub (survives code
// that assumes innerHTML created children, e.g. the pomodoro overlay).
// strict: returns null when absent (needed for presence/absence assertions).
function buildWorld(hostname, opts) {
  opts = opts || {};
  var noop = function () {};
  var world = { bodyEls: {}, local: {}, sess: {}, observers: [], docLs: {}, intervals: {} };
  var iid = 0;
  function makeEl(tag) {
    var el = {
      __ls: {},
      style: { setProperty: noop, removeProperty: noop },
      classList: {
        _s: new Set(),
        add: function (c) { this._s.add(c); },
        remove: function (c) { this._s.delete(c); },
        toggle: function (c, on) {
          if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
          else { on ? this._s.add(c) : this._s.delete(c); }
        },
        contains: function (c) {
          return this._s.has(c) || String(el.className || "").split(" ").indexOf(c) >= 0;
        },
      },
      children: [],
      addEventListener: function (t, fn) { (el.__ls[t] = el.__ls[t] || []).push(fn); },
      removeEventListener: noop,
      appendChild: function (c) {
        el.children.push(c); c.__parent = el;
        if (c && c.__id) world.bodyEls[c.__id] = c;
        return c;
      },
      remove: function () {
        delete world.bodyEls[el.__id];
        if (el.__parent) {
          var i = el.__parent.children.indexOf(el);
          if (i >= 0) el.__parent.children.splice(i, 1);
        }
      },
      setAttribute: noop,
      getAttribute: function () { return null; },
      querySelectorAll: function (sel) {
        var out = [];
        (function walk(n) {
          (n.children || []).forEach(function (ch) {
            if (sel.charAt(0) === "." &&
                String(ch.className || "").split(" ").indexOf(sel.slice(1)) >= 0) out.push(ch);
            walk(ch);
          });
        })(el);
        return out;
      },
      querySelector: function (sel) {
        var hit = el.querySelectorAll(sel)[0] || null;
        return hit || (opts.lenient ? makeEl() : null);
      },
      closest: function () { return null; },
      contains: function () { return false; },
      offsetHeight: 40, offsetWidth: 120, childNodes: [],
      innerText: "", focus: noop,
      scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      nodeType: 1, parentElement: null,
      tagName: (tag || "div").toUpperCase(),
      textContent: "", value: "", title: "",
      getBoundingClientRect: function () {
        return el.__rect || { left: 1200, top: 800, right: 1320, bottom: 840, width: 120, height: 40 };
      },
      setPointerCapture: noop,
    };
    Object.defineProperty(el, "innerHTML", {
      set: function (v) { el.__html = v; },
      get: function () { return el.__html || ""; },
    });
    return el;
  }
  world.makeEl = makeEl;
  var body = makeEl("body");
  global.window = {
    getSelection: function () { return { removeAllRanges: noop, addRange: noop }; },
    addEventListener: noop, innerWidth: 1400, innerHeight: 900, CALM: undefined,
  };
  global.document = {
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function (t) {
      var e = makeEl(t);
      Object.defineProperty(e, "id", {
        set: function (v) { e.__id = v; },
        get: function () { return e.__id; },
      });
      return e;
    },
    createRange: function () { return { selectNodeContents: noop, collapse: noop }; },
    addEventListener: function (t, fn) { (world.docLs[t] = world.docLs[t] || []).push(fn); },
    removeEventListener: function (t, fn) {
      if (world.docLs[t]) world.docLs[t] = world.docLs[t].filter(function (f) { return f !== fn; });
    },
    documentElement: makeEl("html"), scrollingElement: null,
    head: makeEl("head"), body: body,
    getElementById: function (id) { return world.bodyEls[id] || null; },
    execCommand: function () { return true; },
    nodeType: 9, activeElement: null,
  };
  global.getComputedStyle = function () { return { overflowY: "visible" }; };
  global.location = { hostname: hostname, href: "https://" + hostname + "/c/x" };
  global.localStorage = {
    getItem: function (k) { return world.local[k] || null; },
    setItem: function (k, v) { world.local[k] = v; },
    removeItem: function (k) { delete world.local[k]; },
  };
  global.sessionStorage = {
    getItem: function (k) { return world.sess[k] || null; },
    setItem: function (k, v) { world.sess[k] = v; },
    removeItem: function (k) { delete world.sess[k]; },
  };
  // Short timers fire immediately; long timers (quiet 4s, collapse 6s) stay
  // pending like the real world. Intervals are registered for manual ticking.
  global.setTimeout = function (f, ms) {
    if ((ms | 0) >= 3000) return 99999;
    try { f && f(); } catch (e) { throw e; }
    return 0;
  };
  global.setInterval = function (f) { world.intervals[++iid] = f; return iid; };
  global.clearTimeout = noop;
  global.clearInterval = function (id) { delete world.intervals[id]; };
  global.MutationObserver = function (cb) {
    this.cb = cb; world.observers.push(this);
    this.observe = noop; this.disconnect = noop;
  };
  global.Event = function () {};
  global.InputEvent = function () {};
  global.chrome = {
    runtime: { sendMessage: function (m, cb) { cb && cb({ ok: false }); }, lastError: null },
    storage: { local: {
      get: function () { return Promise.resolve({}); },
      set: function () { return Promise.resolve(); },
      remove: function () { return Promise.resolve(); },
    } },
  };
  if (opts.seed) Object.keys(opts.seed).forEach(function (k) { world.local[k] = opts.seed[k]; });
  MODULES.forEach(function (f) { (0, eval)(fs.readFileSync(f, "utf8")); });
  world.C = global.window.CALM;
  world.nav = function (url) {
    global.location.href = url;
    world.observers.forEach(function (o) { try { o.cb([]); } catch (_) {} });
  };
  world.lastInterval = function () {
    var ks = Object.keys(world.intervals);
    return world.intervals[ks[ks.length - 1]];
  };
  return world;
}

/* ---------------- static checks ---------------- */
section("Static");
(function () {
  var css = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
  check("content.css braces balanced",
    css.split("{").length === css.split("}").length);
  var warm = css.match(/198, ?161, ?91|c6a15b|d9bc7f|a8874a|#241d12|#232019|#17140f|#211d19/g);
  check("no gold/warm literals in CSS (quiet graphite only)", !warm,
    warm ? warm.slice(0, 3).join(",") : "");
  var mf = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  check("manifest v3 parses", mf.manifest_version === 3);
  check("manifest declares ZERO permissions",
    !(mf.permissions || []).length, JSON.stringify(mf.permissions));
  check("no host_permissions (no network reachable)",
    !(mf.host_permissions || []).length, JSON.stringify(mf.host_permissions));
  check("no background service worker", !mf.background);
  check("harness module list matches the manifest exactly",
    JSON.stringify(mf.content_scripts[0].js) ===
      JSON.stringify(MODULES.map(function (f) { return "src/" + path.basename(f); })),
    JSON.stringify(mf.content_scripts[0].js));
  var srcFiles = fs.readdirSync(path.join(ROOT, "src"));
  check("auth/sync/config/background files are gone",
    !srcFiles.some(function (f) {
      return ["auth.js", "sync.js", "config.js", "background.js"].indexOf(f) >= 0;
    }), srcFiles.join(","));
  var leaks = [];
  srcFiles.forEach(function (f) {
    var t = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
    if (/CALM\.config|CALM\.auth\b|CALM\.sync\b|supabase/i.test(t)) leaks.push(f);
  });
  check("no source file references auth/sync/Supabase", !leaks.length, leaks.join(","));
  var offenders = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name === ".git") return;
      var full = path.join(dir, name);
      if (name.charAt(0) === "_" || /\.pem$/.test(name)) offenders.push(full);
      if (fs.statSync(full).isDirectory()) walk(full);
    });
  })(ROOT);
  check("no _-prefixed names or .pem in folder (Chrome refuses them)",
    offenders.length === 0, offenders.join(","));
  MODULES.forEach(function (f) {
    try { new Function(fs.readFileSync(f, "utf8")); check("syntax " + path.basename(f), true); }
    catch (e) { check("syntax " + path.basename(f), false, e.message); }
  });
})();

/* ---------------- 3-host load smoke ---------------- */
section("Load smoke");
["chatgpt.com", "gemini.google.com", "claude.ai"].forEach(function (host) {
  try {
    var w = buildWorld(host, { lenient: true });
    check("init " + host, !!(w.C && w.C.rt && w.C.rt.initialized));
  } catch (e) {
    check("init " + host, false, e.message);
  }
});

/* ---------------- lifecycle: pomodoro / pause / registry ---------------- */
section("Lifecycle");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C, P = C.pomodoro, logged = [];
  C.stats.log = function (kind, min) { logged.push({ kind: kind, min: min }); };
  if (C.audio) C.audio.playChime = function () {};

  C.modes.enter("pomodoro");
  P.state.remaining = 300; P.state.cycle = 3;
  w.nav("https://chatgpt.com/c/other");
  check("pomodoro resumes across nav (remaining+cycle intact)",
    P.state.running && P.state.remaining === 300 && P.state.cycle === 3);
  check("nav teardown logs nothing (no double count)", logged.length === 0);

  P.state.remaining = P.state.total - 600;
  C.modes.exit("pomodoro");
  check("manual End logs elapsed minutes", logged.length === 1 && logged[0].min === 10);

  logged.length = 0;
  C.modes.enter("zen");
  C.modes.enter("pomodoro");
  var preBreak = P.state.enteredZen;
  P.state.remaining = 1;
  var tick = w.lastInterval(); tick && tick();
  var zenDuringBreak = C.modes.isActive("zen");
  C.modes.exit("pomodoro");
  check("user zen untouched by pomodoro break+End",
    preBreak === false && zenDuringBreak === true && C.modes.isActive("zen"));
  C.modes.exit("zen");

  C.modes.enter("pomodoro");
  var owned = P.state.enteredZen === true && C.modes.isActive("zen");
  P.state.remaining = 1;
  tick = w.lastInterval(); tick && tick();
  var zenOnBreak = C.modes.isActive("zen");
  C.modes.exit("pomodoro");
  check("pomodoro-owned zen released on break", owned && zenOnBreak === false);

  C.modes.enter("pause");
  var end1 = C.rt.pauseEndTs;
  w.nav("https://chatgpt.com/c/third");
  check("pause keeps original end across nav",
    C.rt.pauseEndTs === end1 && C.rt.paused === true && end1 > Date.now());
  C.modes.exit("pause");

  C.intent.toggle(false);
  var openBefore = !!w.bodyEls["cit-intent-pop"];
  var clicksBefore = (w.docLs.click || []).length;
  w.nav("https://chatgpt.com/c/fourth");
  check("popover registry closes popovers + listeners on nav",
    openBefore && !w.bodyEls["cit-intent-pop"] &&
    (w.docLs.click || []).length <= clicksBefore);

  w.docLs.pointermove = []; w.docLs.pointerup = []; w.docLs.pointercancel = [];
  var el2 = global.document.createElement("div");
  el2.id = "dtest"; global.document.body.appendChild(el2);
  C.ui.makeDraggable(el2, "cit-dtest");
  el2.__ls.pointerdown[0]({ button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  var added = w.docLs.pointermove.length === 1 && w.docLs.pointerup.length === 1 &&
    w.docLs.pointercancel.length === 1;
  w.docLs.pointercancel[0]({});
  check("makeDraggable pointercancel add/remove balanced",
    added && !w.docLs.pointermove.length && !w.docLs.pointerup.length &&
    !w.docLs.pointercancel.length);
})();

/* ---------------- Console (the one menu) ---------------- */
section("Console");
(function () {
  var w = buildWorld("chatgpt.com", {
    seed: { "cit-dock-pos": JSON.stringify({ left: 1200, top: 800 }) },
  });
  var C = w.C, D = C.dock;

  var pos = JSON.parse(w.local["cit-dock-pos"]);
  check("v1 to v2 corner migration", pos.corner === "br" && pos.dx >= 12);

  var dock = w.bodyEls["cit-dock"];
  var con = w.bodyEls["cit-console"];
  check("pill hosts exactly one Console (no second floating panel)",
    !!dock && !!con && !w.bodyEls["cit-settings-panel"] && !w.bodyEls["cit-modes-pop"]);
  check("corner-anchored insets applied",
    dock.classList.contains("cit-corner-br") &&
    dock.style.right !== "auto" && dock.style.left === "auto");

  var quad = [
    [{ left: 30, top: 30, width: 120, height: 40 }, "tl"],
    [{ left: 1250, top: 30, width: 120, height: 40 }, "tr"],
    [{ left: 30, top: 820, width: 120, height: 40 }, "bl"],
    [{ left: 1250, top: 820, width: 120, height: 40 }, "br"],
  ].every(function (t) { return D._nearestCorner(t[0]).corner === t[1]; });
  check("nearest-corner detection all quadrants", quad);

  // Main view: one live tile, three quick tiles, two sliders, mode chips
  check("main view has a live tile + 3 quick tiles",
    con.querySelectorAll(".cit-live").length === 1 &&
    con.querySelectorAll(".cit-qt").length === 3);
  check("inline sliders present", con.querySelectorAll(".cit-con-slider").length === 2);
  check("mode chips come from the registry",
    con.querySelectorAll(".cit-chipm").length ===
      C.modes.bySurface("tile").filter(function (id) {
        return ["zen", "focusreader", "pomodoro"].indexOf(id) < 0;
      }).length);

  // Open / close
  C.console.open();
  var wasOpen = dock.classList.contains("cit-dock-open");
  (w.docLs.keydown || []).forEach(function (f) { f({ key: "Escape" }); });
  check("pill opens it, Esc closes it",
    wasOpen && !dock.classList.contains("cit-dock-open"));

  // Advanced opens IN PLACE — no second body-level element appears
  var bodyIdsBefore = Object.keys(w.bodyEls).length;
  C.console.open();
  var advBtn = con.querySelector(".cit-con-adv-btn");
  advBtn.__ls.click[0]({ stopPropagation: function () {} });
  var con2 = w.bodyEls["cit-console"];
  check("Advanced drawer opens inside the Console, not as a new window",
    con2.classList.contains("cit-con-adv") &&
    Object.keys(w.bodyEls).length === bodyIdsBefore &&
    !!con2.querySelector(".cit-con-scroll"));
  var back = con2.querySelector(".cit-con-back");
  back.__ls.click[0]({ stopPropagation: function () {} });
  check("Back returns to the main view",
    !w.bodyEls["cit-console"].classList.contains("cit-con-adv"));

  // Quiet pill still works (it must NOT fade while the menu is open)
  C.rt.composerEl = { contains: function () { return true; } };
  (w.docLs.input || []).forEach(function (f) { f({ target: {} }); });
  check("pill does not fade while the Console is open",
    !dock.classList.contains("cit-quiet"));
  C.console.close();
  (w.docLs.input || []).forEach(function (f) { f({ target: {} }); });
  var quietOn = dock.classList.contains("cit-quiet");
  (w.docLs.pointermove || []).forEach(function (f) {
    try { f({ clientX: 1250, clientY: 830 }); } catch (_) {}
  });
  check("quiet pill fades on typing and wakes on approach",
    quietOn && !dock.classList.contains("cit-quiet"));

  w.nav("https://chatgpt.com/c/next");
  var nd = w.bodyEls["cit-dock"];
  check("nav rebuild keeps corner + Console",
    !!nd && nd.classList.contains("cit-corner-br") && !!w.bodyEls["cit-console"]);
})();

/* ---------------- Mode registry is the single source ---------------- */
section("Mode registry");
(function () {
  var uiSrc = fs.readFileSync(path.join(ROOT, "src", "ui.js"), "utf8");
  check("no hard-coded mode arrays left in ui.js",
    !/\[\s*"(focusreader|zen)"\s*,/.test(uiSrc));

  var w = buildWorld("chatgpt.com", {});
  var C = w.C, M = C.modes;
  check("'reader' is no longer a mode", !M.MODES.reader &&
    C.FEATURE_TIERS["mode:reader"] === undefined);
  check("every mode declares a surface",
    M.ids().every(function (id) { return !!M.MODES[id].surface; }));
  var tiles = M.bySurface("tile");
  check("five everyday modes surface as tiles",
    tiles.length === 5 && tiles.indexOf("zen") >= 0 &&
    tiles.indexOf("focusreader") >= 0 && tiles.indexOf("pomodoro") >= 0,
    tiles.join(","));
  check("niche modes still exist, just moved off the tiles",
    ["gray", "motion", "privacy", "autoscroll", "presentation"].every(function (id) {
      return !!M.MODES[id] && M.MODES[id].surface !== "tile";
    }));
  check("every surfaced mode has an icon",
    M.ids().every(function (id) { return !!C.icons.mode[id]; }));

  // Reader typography now behaves like reading width: a setting, applied at
  // init, with defaults meaning "off".
  check("reader typography applies as a setting, off at defaults",
    typeof M.applyReaderType === "function" &&
    !global.document.documentElement.classList.contains("cit-reader"));
  C.settings.readerFontScale = 130;
  M.applyReaderType();
  check("moving the slider turns it on",
    global.document.documentElement.classList.contains("cit-reader"));
  C.settings.readerFontScale = 100;
  M.applyReaderType();
  check("returning to default turns it off",
    !global.document.documentElement.classList.contains("cit-reader"));
})();

/* ---------------- Command palette ---------------- */
section("Palette");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  var kd = (w.docLs.keydown || []);
  kd.forEach(function (f) {
    f({ ctrlKey: true, metaKey: false, shiftKey: false, code: "KeyK",
        preventDefault: function () {}, stopPropagation: function () {} });
  });
  var p = w.bodyEls["cit-palette"];
  check("Ctrl+K opens the palette", !!p);

  var items = C.palette._items();
  check("every mode is reachable from the palette",
    C.modes.ids().every(function (id) {
      return items.some(function (it) { return it.kind === "mode" && it.id === id; });
    }));
  check("Advanced-only settings are reachable too",
    items.some(function (it) { return it.key === "grayLevel"; }) &&
    items.some(function (it) { return it.key === "dockQuiet"; }));

  var input = p.querySelector(".cit-pal-input");
  input.value = "zen";
  input.__ls.input[0]({ stopPropagation: function () {} });
  var rows = p.querySelectorAll(".cit-pal-row");
  check("typing filters the list", rows.length > 0 && rows.length < items.length);
  check("subsequence matching works (rdr finds Reading ruler)",
    (function () {
      input.value = "rdr";
      input.__ls.input[0]({ stopPropagation: function () {} });
      return p.querySelectorAll(".cit-pal-row").some(function (r) {
        return /ruler/i.test(r.children[0].textContent);
      });
    })());

  input.value = "zen";
  input.__ls.input[0]({ stopPropagation: function () {} });
  var before = C.modes.isActive("zen");
  input.__ls.keydown[0]({ key: "Enter", stopPropagation: function () {}, preventDefault: function () {} });
  check("Enter runs the highlighted item and closes",
    C.modes.isActive("zen") !== before && !w.bodyEls["cit-palette"]);
  C.modes.exit("zen");

  // Arrow keys nudge a numeric setting in place
  kd.forEach(function (f) {
    f({ ctrlKey: true, metaKey: false, shiftKey: false, code: "KeyK",
        preventDefault: function () {}, stopPropagation: function () {} });
  });
  var p2 = w.bodyEls["cit-palette"];
  var i2 = p2.querySelector(".cit-pal-input");
  i2.value = "night level";
  i2.__ls.input[0]({ stopPropagation: function () {} });
  var was = C.settings.nightLevel;
  i2.__ls.keydown[0]({ key: "ArrowRight", stopPropagation: function () {}, preventDefault: function () {} });
  check("arrows nudge a numeric setting without leaving the palette",
    C.settings.nightLevel === was + 5 && !!w.bodyEls["cit-palette"]);

  var docKeysBefore = (w.docLs.keydown || []).length;
  i2.__ls.keydown[0]({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} });
  check("Esc closes it and the registry entry is released",
    !w.bodyEls["cit-palette"] && (w.docLs.keydown || []).length <= docKeysBefore);

  C.palette.open();
  w.nav("https://chatgpt.com/c/next");
  check("SPA nav closes the palette", !w.bodyEls["cit-palette"]);
})();

/* ---------------- Intention: never self-opens ---------------- */
section("No auto-open");
(function () {
  var w = buildWorld("chatgpt.com", {});
  // Modules have fully evaluated (incl. every timer the stub fires inline).
  check("intention card does NOT open by itself on load",
    !w.bodyEls["cit-intent-pop"]);
  check("it still opens on demand",
    (w.C.intent.toggle(false), !!w.bodyEls["cit-intent-pop"]));
  var handlers = (w.docLs.keydown || []).length;
  check("Ctrl/Cmd+Shift+K parking shortcut still bound", handlers >= 1);
})();

/* ---------------- Focus Reader ---------------- */
section("Focus Reader");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;
  check("mode registered with icon + tier",
    !!C.modes.MODES.focusreader && !!C.icons.mode.focusreader &&
    C.FEATURE_TIERS["mode:focusreader"] === "free");
  check("adapter has responseSel", typeof C.site.responseSel === "string" && C.site.responseSel.length > 0);

  C.modes.enter("focusreader");
  var pane = w.bodyEls["cit-reader-pane"];
  check("pane opens with bar + body",
    !!pane && !!pane.querySelector(".cit-fr-bar") && !!pane.querySelector(".cit-fr-body"));
  check("empty page shows empty state (no crash)",
    !!pane.querySelector(".cit-fr-empty"));
  var keysBefore = (w.docLs.keydown || []).length;
  check("keydown listener installed", keysBefore >= 1);

  // Esc exits the mode and removes the pane + listener
  (w.docLs.keydown || []).slice().forEach(function (f) {
    f({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} });
  });
  check("Esc exits mode, removes pane",
    !w.bodyEls["cit-reader-pane"] && !C.modes.isActive("focusreader"));
  check("keydown listener removed on close",
    (w.docLs.keydown || []).length < keysBefore);

  // bionic math
  var bc = C.reader._boldCount;
  check("bionic bold-count math",
    bc(1, 0.4) === 1 && bc(4, 0.4) === 2 && bc(8, 0.5) === 4 &&
    bc(2, 0.9) === 1 && bc(10, 0.2) === 2);

  // nav teardown: active mode exits cleanly and re-enters on the new page
  C.modes.enter("focusreader");
  w.nav("https://chatgpt.com/c/next");
  check("nav rebuild keeps Focus Reader mode alive",
    C.modes.isActive("focusreader") && !!w.bodyEls["cit-reader-pane"]);
  C.modes.exit("focusreader");
})();

/* ---------------- verdict ---------------- */
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
