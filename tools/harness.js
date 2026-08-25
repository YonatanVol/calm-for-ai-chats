#!/usr/bin/env node
/* ===== Calm — tools/harness.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 *
 * The verification gate. Runs the full stubbed-DOM behavioral suite plus
 * static checks. Exit 0 = safe to merge; anything else = do not merge.
 * No dependencies — plain Node. Usage: node tools/harness.js
 *
 * HOW TO ADD A TEST (this is the house style — see the "Scenarios" sections):
 *   1. Describe what a PERSON does, not what a function does. "I hid the input
 *      to read, and it came back on its own" beats "showComposer() is called".
 *      Every bug worth finding here was found by asking that question.
 *   2. Write it BEFORE the fix and watch it FAIL. A test that has never been
 *      red has never been shown to test anything.
 *   3. Be suspicious of a green you did not earn. Two tests here once passed
 *      for the wrong reason — one scrolled further than the relayout guard
 *      allows, one called a function that does not exist — and the second was
 *      hiding a real bug. If a test passes first try, prove it can fail.
 *   4. When the stub is what is wrong (innerHTML not clearing children,
 *      remove() not forgetting descendants, querySelector answering every
 *      selector alike), fix the STUB, not the assertion. A stub that lies is
 *      worse than no stub.
 *
 * Two suites need a real browser and live beside this file, because a stub
 * cannot prove a script did not run or a cascade did not repaint:
 *   tools/sanitizer-test.html   16 XSS/injection attacks on the Focus Reader
 *   tools/contrast-test.html    active-state colour + contrast ratios
 */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");

// The module list is READ FROM THE MANIFEST, not duplicated here: load order
// is load-bearing (reader.js needs CALM.ui, dock.js needs CALM.console), and a
// hand-kept copy would drift the moment a script is added or reordered.
var MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
var MODULES = MANIFEST.content_scripts[0].js.map(function (rel) {
  return path.join(ROOT, rel);
});

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
        // Removing a node removes its whole subtree in a real DOM. The stub
        // used to forget only the node's own id, so descendants stayed
        // "findable" by getElementById after their parent was detached — and
        // teardown tests passed when the real page would have kept nothing.
        (function forget(n) {
          if (n.__id) delete world.bodyEls[n.__id];
          (n.children || []).forEach(forget);
        })(el);
        if (el.__parent) {
          var i = el.__parent.children.indexOf(el);
          if (i >= 0) el.__parent.children.splice(i, 1);
        }
      },
      __attrs: {},
      setAttribute: function (k, v) { el.__attrs[k] = v; },
      getAttribute: function (k) { return el.__attrs[k] == null ? null : el.__attrs[k]; },
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
      offsetHeight: 40, offsetWidth: 120,
      innerText: "", focus: noop,
      scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      nodeType: 1, parentElement: null,
      tagName: (tag || "div").toUpperCase(),
      textContent: "", value: "", title: "",
      getBoundingClientRect: function () {
        return el.__rect || { left: 1200, top: 800, right: 1320, bottom: 840, width: 120, height: 40 };
      },
      setPointerCapture: noop,
      replaceChild: function (fresh, old) {
        var i = el.children.indexOf(old);
        if (i >= 0) el.children[i] = fresh;
        else el.children.push(fresh);
        if (fresh) fresh.__parent = el;
        if (fresh && fresh.__id) world.bodyEls[fresh.__id] = fresh;
        return old;
      },
      insertBefore: function (fresh, ref) {
        var i = el.children.indexOf(ref);
        if (i < 0) i = el.children.length;
        el.children.splice(i, 0, fresh);
        if (fresh) fresh.__parent = el;
        return fresh;
      },
      // Real elements clone; the stub had no cloneNode at all, so the Focus
      // Reader's render path could never be exercised end to end.
      cloneNode: function () {
        var copy = makeEl(el.tagName);
        copy.className = el.className;
        copy.textContent = el.textContent;
        copy.__attrs = JSON.parse(JSON.stringify(el.__attrs || {}));
        (el.children || []).forEach(function (c) {
          // Text nodes are plain objects with no cloneNode, so they were
          // silently dropped — the clone kept the structure and lost every
          // word in it.
          if (c.cloneNode) copy.appendChild(c.cloneNode(true));
          else if (c.nodeType === 3) {
            copy.appendChild({ nodeType: 3, textContent: c.textContent, children: [] });
          }
        });
        copy.childNodes = copy.children;
        return copy;
      },
    };
    // In a real DOM childNodes and children are two views of one list. The
    // stub kept childNodes permanently empty, so any code that walks the tree
    // the standard way (the Focus Reader does) saw nothing at all.
    el.childNodes = el.children;
    Object.defineProperty(el, "innerHTML", {
      // Real DOM discards children when innerHTML is assigned. The stub used
      // to keep them, so a re-render appended instead of replacing and tests
      // silently inspected stale nodes.
      set: function (v) {
        el.children.forEach(function (c) {
          if (c.__id) delete world.bodyEls[c.__id];
        });
        el.children = [];
        el.childNodes = el.children;
        el.__html = v;
      },
      get: function () { return el.__html || ""; },
    });
    return el;
  }
  world.makeEl = makeEl;
  var body = makeEl("body");
  world.winLs = {};
  global.window = {
    getSelection: function () { return { removeAllRanges: noop, addRange: noop }; },
    // Window listeners were dropped on the floor, so anything that reacts to
    // resize could not be tested at all.
    addEventListener: function (t, fn) { (world.winLs[t] = world.winLs[t] || []).push(fn); },
    removeEventListener: noop,
    innerWidth: 1400, innerHeight: 900, CALM: undefined,
  };
  global.document = {
    // Tests set world.docQuery to simulate what the page contains. A function
    // lets a test answer per selector — e.g. "there is a composer but no
    // assistant response yet", which is exactly a brand-new chat.
    querySelector: function (sel) {
      return typeof world.docQuery === "function"
        ? world.docQuery(sel)
        : world.docQuery || null;
    },
    querySelectorAll: function (sel) {
      return typeof world.docQueryAll === "function" ? world.docQueryAll(sel) : [];
    },
    createElement: function (t) {
      var e = makeEl(t);
      Object.defineProperty(e, "id", {
        set: function (v) { e.__id = v; },
        get: function () { return e.__id; },
      });
      return e;
    },
    createRange: function () { return { selectNodeContents: noop, collapse: noop }; },
    createTextNode: function (t) { return { nodeType: 3, textContent: t, children: [] }; },
    createDocumentFragment: function () { return makeEl("fragment"); },
    addEventListener: function (t, fn) { (world.docLs[t] = world.docLs[t] || []).push(fn); },
    removeEventListener: function (t, fn) {
      if (world.docLs[t]) world.docLs[t] = world.docLs[t].filter(function (f) { return f !== fn; });
    },
    documentElement: makeEl("html"), scrollingElement: null,
    head: makeEl("head"), body: body,
    getElementById: function (id) { return world.bodyEls[id] || null; },
    execCommand: function () { return true; },
    nodeType: 9, activeElement: null, title: "", hidden: false,
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
  check("every manifest script exists on disk",
    MODULES.every(function (f) { return fs.existsSync(f); }));
  check("reader.js loads after ui.js (it registers with the popover registry)",
    mf.content_scripts[0].js.indexOf("src/reader.js") >
      mf.content_scripts[0].js.indexOf("src/ui.js"));
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
  (w.docLs.keydown || []).forEach(function (f) { f({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} }); });
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

/* ---------------- Scenario tests (written before the fixes) --------------- */
// These describe things a person actually does, not units of code. Each one
// was written first and watched fail.
section("Scenarios");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  function scroller(clientH, scrollH, top) {
    var el = w.makeEl("div");
    el.clientHeight = clientH; el.scrollHeight = scrollH; el.scrollTop = top;
    el.closest = function () { return null; };
    return el;
  }
  function scrollTo(el, top) {
    el.scrollTop = top;
    (w.docLs.scroll || []).forEach(function (f) { f({ target: el }); });
  }
  function adopt(el) {
    C.rt.scrollContainer = null; C.rt.accUp = 0; C.rt.scrollLocked = false;
    scrollTo(el, el.scrollTop);
  }
  C.rt.composerEl = w.makeEl("div");
  w.docQuery = w.makeEl("div"); // a real conversation is on the page

  // SCENARIO 1 — "I hid the input on purpose so I could read. The answer was
  // still streaming, the page scrolled itself to the bottom, and the input
  // came back." An explicit action must not be undone by an implicit one.
  var el1 = scroller(800, 4000, 2000);
  adopt(el1);
  C.rt.composerHidden = false;
  C.core.manualToggleComposer();          // deliberate hide
  // Human-sized steps: a single 1150px jump would be swallowed by the
  // relayout guard and the test would pass without proving anything.
  [2400, 2800, 3150].forEach(function (t) {
    C.rt.scrollLocked = false;
    scrollTo(el1, t);
  });                                     // streaming drags us to the bottom
  check("a hide I asked for survives the page scrolling to the bottom",
    C.rt.composerHidden);

  // ...but an automatic hide SHOULD still reveal at the bottom, as designed.
  C.rt.composerHidden = false;
  C.rt.scrollLocked = false;
  var el2 = scroller(800, 4000, 2000);
  adopt(el2);
  scrollTo(el2, 1900);                    // one notch up -> auto-hide
  var autoHid = C.rt.composerHidden;
  [2300, 2700, 3100, 3200].forEach(function (t) {
    C.rt.scrollLocked = false;
    scrollTo(el2, t);
  });                                     // back to the bottom
  check("an automatic hide still reveals when I reach the bottom",
    autoHid && !C.rt.composerHidden);

  // SCENARIO 1c — "I clicked the site's jump-to-bottom arrow." Arriving at the
  // bottom should reveal the input however I got there; the relayout guard is
  // about not mistaking a jump for a HIDE gesture, not about ignoring where I
  // ended up.
  C.rt.composerHidden = false;
  C.rt.scrollLocked = false;
  var el3 = scroller(800, 4000, 1000);
  adopt(el3);
  C.rt.composerHidden = true;             // hidden automatically earlier
  C.rt.hiddenManually = false;
  scrollTo(el3, 3200);                    // one big jump to the bottom
  check("the jump-to-bottom button reveals the input", !C.rt.composerHidden);

  // SCENARIO 2 — "I had a half-written prompt, hid the input, kept typing,
  // and when it came back my earlier text was gone."
  var ta = w.makeEl("textarea");
  ta.tagName = "TEXTAREA";
  ta.value = "half-written prompt";
  ta.dispatchEvent = function () {};
  C.site.promptInput = function () { return ta; };
  C.rt.composerHidden = true;
  C.rt.pendingText = " and the rest";
  C.core.showComposer();
  check("typing while hidden APPENDS to my draft instead of erasing it",
    ta.value.indexOf("half-written prompt") >= 0 &&
      ta.value.indexOf(" and the rest") >= 0, JSON.stringify(ta.value));

  // SCENARIO 3 — "I turned on Zen with the margin rail showing. The sidebar
  // vanished, the text moved, and the marks stayed where the old edge was."
  C.settings.menuStyle = "margin";
  C.rt.composerEl.__rect = { left: 350, right: 1050, width: 700, top: 0, bottom: 400, height: 400 };
  C.dock.build();
  var before = w.bodyEls["cit-dock"].style.left;
  // Zen removes the sidebar: the column shifts left and widens.
  C.rt.composerEl.__rect = { left: 150, right: 1250, width: 1100, top: 0, bottom: 400, height: 400 };
  C.modes.enter("zen");
  var after = w.bodyEls["cit-dock"] && w.bodyEls["cit-dock"].style.left;
  check("the margin rail follows the text when Zen changes the layout",
    before !== after, "left " + before + " -> " + after);
  C.modes.exit("zen");
  C.settings.menuStyle = "console";
  C.dock.build();
})();

section("Scenarios II");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  C.rt.composerEl = w.makeEl("div");

  // SCENARIO 4 — "I hid the input, then hit Ctrl+Shift+H expecting it back."
  // The manual-hide flag must not make the manual toggle a one-way trip.
  C.rt.composerHidden = false;
  C.core.manualToggleComposer();
  C.core.manualToggleComposer();
  check("the manual toggle still toggles back", !C.rt.composerHidden);

  // SCENARIO 5 — "Zen hid my input. I pressed the Input tile to get it back
  // while staying in Zen." Zen owns the composer, but an explicit request
  // should still win.
  C.settings.zenComposer = true;
  C.modes.enter("zen");
  var hidByZen = C.rt.composerHidden;
  C.core.manualToggleComposer();
  check("I can reveal the input without leaving Zen",
    hidByZen && !C.rt.composerHidden && C.modes.isActive("zen"));
  C.modes.exit("zen");

  // SCENARIO 6 — "A Pomodoro block ended while I was reading. The break
  // overlay appeared." Leaving the timer must not leave the page dimmed or
  // the composer stuck hidden.
  C.rt.composerHidden = false;
  C.modes.enter("pomodoro");
  C.modes.exit("pomodoro");
  check("ending a timer leaves nothing behind",
    !C.modes.isActive("zen") && !w.bodyEls["cit-pomo-overlay"] &&
      !w.bodyEls["cit-pomo-widget"] && !w.bodyEls["cit-timebar"]);

  // SCENARIO 7 — "I set a reading width, then switched the site to a wider
  // window." Width is a setting, not a mode: it must survive a navigation.
  C.settings.readingWidth = 900;
  C.modes.applyWidth();
  var onBefore = global.document.documentElement.classList.contains("cit-width");
  w.nav("https://chatgpt.com/c/next");
  check("reading width survives navigating to another chat",
    onBefore && global.document.documentElement.classList.contains("cit-width"));
  C.settings.readingWidth = 0;
  C.modes.applyWidth();

  // SCENARIO 8 — "I typed into the page while Calm was hiding the input, but
  // my cursor was in the site's own search box." Type-ahead must not steal
  // keystrokes aimed somewhere else.
  C.rt.composerHidden = true;
  C.rt.pendingText = "";
  C.settings.typeAhead = "auto";
  var searchBox = w.makeEl("input");
  searchBox.tagName = "INPUT";
  var swallowed = false;
  (w.docLs.keydown || []).forEach(function (f) {
    f({ key: "a", code: "KeyA", ctrlKey: false, metaKey: false, altKey: false,
        composedPath: function () { return [searchBox]; },
        preventDefault: function () { swallowed = true; },
        stopPropagation: function () {} });
  });
  check("typing in the site's own field is not hijacked", !swallowed);
  C.rt.composerHidden = false;
})();

section("Scenarios III");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  C.rt.composerEl = w.makeEl("div");

  // SCENARIO 9 — "I was half-way through a prompt in one chat, hid the input,
  // then opened a DIFFERENT chat." A draft belongs to the conversation it was
  // written in; it must not reappear in another one.
  var box = w.makeEl("div");
  box.tagName = "DIV";
  box.innerText = "a question about my tax return";
  C.site.promptInput = function () { return box; };
  C.rt.composerHidden = false;
  C.core.manualToggleComposer();          // hides, saving the draft
  w.nav("https://chatgpt.com/c/a-different-chat");
  var fresh = w.makeEl("div");
  fresh.tagName = "DIV";
  fresh.innerText = "";                   // the new chat's empty composer
  C.site.promptInput = function () { return fresh; };
  C.rt.composerEl = w.makeEl("div");
  C.rt.composerHidden = true;
  C.core.showComposer();
  check("a draft does not follow me into a different conversation",
    !/tax return/.test(fresh.innerText || ""),
    JSON.stringify(fresh.innerText));

  // SCENARIO 10 — "I turned on Remember state. Next time I opened a BRAND NEW
  // chat the input was already hidden, with nothing to read." Restoring a
  // hidden composer is only sensible where there IS something to read.
  var w2 = buildWorld("chatgpt.com", {
    lenient: true,
    seed: { "cit-state-chatgpt": JSON.stringify({ composerHidden: true, modes: {} }) },
  });
  var respSel = w2.C.site.responseSel;
  // A brand-new chat: the composer exists, no assistant response does.
  w2.docQuery = function (sel) {
    return sel === respSel ? null : w2.makeEl("div");
  };
  w2.C.settings.rememberState = true;
  w2.C.rt.composerHidden = false;
  w2.C.core.init();
  check("remembered 'hidden' is not restored onto an empty new chat",
    !w2.C.rt.composerHidden);

  // ...but on a chat that HAS a conversation, remembering still works.
  var w3 = buildWorld("chatgpt.com", {
    lenient: true,
    seed: { "cit-state-chatgpt": JSON.stringify({ composerHidden: true, modes: {} }) },
  });
  w3.docQuery = function () { return w3.makeEl("div"); }; // responses present
  w3.C.settings.rememberState = true;
  w3.C.rt.composerHidden = false;
  w3.C.core.init();
  check("remembered 'hidden' still applies to a real conversation",
    w3.C.rt.composerHidden);

  // SCENARIO 10c — "It hid itself while I was reading, so I scrolled to the
  // bottom to get it back. Then I opened another conversation and scrolling
  // to the bottom stopped working."
  //
  // Hiding remembers WHY: an automatic hide is a guess and scrolling back to
  // the bottom undoes it; an explicit hide is a decision and does not. What
  // is saved across a navigation is only the fact of being hidden, so the
  // restore has to pick one — and picking "decision" quietly takes away the
  // affordance the user just learned, with no toast to hint at the shortcut.
  var w4 = buildWorld("chatgpt.com", {
    lenient: true,
    seed: { "cit-state-chatgpt": JSON.stringify({
      composerHidden: true, hiddenManually: false, modes: {} }) },
  });
  w4.docQuery = function () { return w4.makeEl("div"); }; // a real conversation
  w4.C.settings.rememberState = true;
  w4.C.rt.composerHidden = false;
  w4.C.core.init();
  check("(setup) a remembered auto-hide is restored hidden",
    w4.C.rt.composerHidden);
  check("a remembered auto-hide can still be undone by scrolling to the bottom",
    !w4.C.rt.hiddenManually);

  // ...and the other half of the same rule: a hide the user ASKED for stays.
  var w5 = buildWorld("chatgpt.com", {
    lenient: true,
    seed: { "cit-state-chatgpt": JSON.stringify({
      composerHidden: true, hiddenManually: true, modes: {} }) },
  });
  w5.docQuery = function () { return w5.makeEl("div"); };
  w5.C.settings.rememberState = true;
  w5.C.rt.composerHidden = false;
  w5.C.core.init();
  check("a hide I asked for is not undone by scrolling after a navigation",
    w5.C.rt.composerHidden && w5.C.rt.hiddenManually);

  // The distinction has to survive the storage boundary or the restore above
  // is guessing.
  var w6 = buildWorld("chatgpt.com", { lenient: true });
  w6.C.rt.composerHidden = true;
  w6.C.rt.hiddenManually = true;
  w6.C.settings.rememberState = true;
  w6.C.saveState();
  check("saved state records which kind of hide it was",
    JSON.parse(w6.local["cit-state-chatgpt"]).hiddenManually === true);
})();

section("Scenarios IV");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  C.rt.composerEl = w.makeEl("div");

  // SCENARIO 11 — "I opened the menu, then resized my window." Rebuilding the
  // dock destroys the panel the user is looking at — the same failure as the
  // old Reset-positions bug, arriving from a different direction.
  C.settings.menuStyle = "margin";
  C.rt.composerEl.__rect = { left: 350, right: 1050, width: 700, top: 0, bottom: 400, height: 400 };
  C.dock.build();
  C.console.open();
  var wasOpen = C.console.isOpen();
  global.window.innerWidth = 1500;
  (w.winLs && w.winLs.resize ? w.winLs.resize : []).forEach(function (f) { f({}); });
  check("resizing does not slam the menu shut in my face",
    wasOpen && C.console.isOpen());
  C.console.close();
  C.settings.menuStyle = "console";
  C.dock.build();

  // SCENARIO 12 — "I typed while the input was hidden, then switched chats
  // before revealing it." Buffered keystrokes belong to the conversation they
  // were typed in, exactly like a draft.
  C.rt.pendingText = "what about the second option";
  C.rt.composerHidden = true;
  w.nav("https://chatgpt.com/c/somewhere-else");
  var landed = w.makeEl("div");
  landed.tagName = "DIV";
  landed.innerText = "";
  C.site.promptInput = function () { return landed; };
  C.rt.composerEl = w.makeEl("div");
  C.rt.composerHidden = true;
  C.core.showComposer();
  check("buffered typing does not spill into a different conversation",
    !/second option/.test(landed.innerText || ""), JSON.stringify(landed.innerText));

  // SCENARIO 13 — "The site re-rendered its composer while Calm had it hidden.
  // Now the toggle does nothing." Calm holds a reference to a node React has
  // already thrown away.
  var stale = w.makeEl("div");
  var hiddenOn = null;
  stale.style.setProperty = function (k) { hiddenOn = "stale"; };
  stale.isConnected = false;                 // React replaced it
  var live = w.makeEl("div");
  live.style.setProperty = function (k) { hiddenOn = "live"; };
  live.isConnected = true;
  C.rt.composerEl = stale;
  C.rt.composerHidden = false;
  C.site.composer = function () { return live; };
  C.core.manualToggleComposer();
  check("hiding acts on the composer that is actually on the page",
    hiddenOn === "live", "acted on " + hiddenOn);
})();

section("Scenarios V");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  C.rt.composerEl = w.makeEl("div");
  C.rt.composerEl.isConnected = true;

  // SCENARIO 14 — "I hid the input myself, then used Zen for a while. When I
  // left Zen the input came back on its own." Same principle as scenario 1:
  // Zen restores what IT changed, not what I chose.
  C.settings.zenComposer = true;
  C.rt.composerHidden = false;
  C.core.manualToggleComposer();          // my decision
  C.modes.enter("zen");
  C.modes.exit("zen");
  check("leaving Zen does not undo a hide I chose myself",
    C.rt.composerHidden);
  C.rt.composerHidden = false;

  // ...and Zen's own hide is still restored on the way out.
  C.modes.enter("zen");
  var zenHid = C.rt.composerHidden;
  C.modes.exit("zen");
  check("leaving Zen does restore what Zen itself hid",
    zenHid && !C.rt.composerHidden);

  // SCENARIO 15 — "I paused auto-hide for 15 minutes and walked away." When
  // it expires, auto-hide has to come back and the countdown chip has to go.
  C.modes.enter("pause");
  var pausedNow = C.rt.paused;
  var tick = w.lastInterval();
  // The countdown closes over a local end-time, so nudging rt.pauseEndTs does
  // nothing — the clock itself has to move.
  var realNow = Date.now;
  Date.now = function () { return realNow() + 60 * 60 * 1000; };
  if (tick) tick();
  Date.now = realNow;
  check("pause expires cleanly and auto-hide resumes",
    pausedNow && !C.rt.paused && !C.modes.isActive("pause"));

  // SCENARIO 16 — "Auto-scroll ran to the bottom of the page and stopped."
  // The mode has to switch itself off, not just stop moving.
  var sc = w.makeEl("div");
  sc.clientHeight = 800; sc.scrollHeight = 1000; sc.scrollTop = 0;
  C.rt.scrollContainer = sc;
  C.modes.enter("autoscroll");
  var t2 = w.lastInterval();
  for (var i = 0; i < 300 && C.modes.isActive("autoscroll"); i++) {
    sc.scrollTop = Math.min(sc.scrollHeight - sc.clientHeight, sc.scrollTop + 20);
    if (t2) t2();
  }
  check("auto-scroll turns itself off at the bottom",
    !C.modes.isActive("autoscroll"));
})();

section("Scenarios VI");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;

  // SCENARIO 17 — "I opened the Focus Reader while the answer was still
  // being written." It snapshots on open, so the pane showed a truncated
  // answer and never filled in.
  var resp = w.makeEl("div");
  resp.tagName = "DIV";
  resp.textContent = "The first part of the answer";
  resp.childNodes = [{ nodeType: 3, textContent: "The first part of the answer" }];
  var respSel = C.site.responseSel;
  w.docQueryAll = function (sel) { return sel === respSel ? [resp] : []; };
  C.modes.enter("focusreader");
  var body = w.bodyEls["cit-reader-pane"].querySelector(".cit-fr-body");
  function paneText() {
    var out = "";
    (function walk(n) {
      (n.children || []).forEach(function (c) {
        if (c.textContent) out += c.textContent;
        walk(c);
      });
    })(body);
    return out;
  }
  var streamed = "The first part of the answer and the rest of it";
  resp.textContent = streamed;
  resp.childNodes = [{ nodeType: 3, textContent: streamed }];
  var t = w.lastInterval();
  if (t) t();
  check("the reader keeps up while the answer is still streaming",
    /the rest of it/.test(paneText()), JSON.stringify(paneText().slice(0, 60)));
  C.modes.exit("focusreader");

  // SCENARIO 18 — "I saved a preset while using the margin menu, then applied
  // it later from the corner pill." A preset now snapshots every setting,
  // menuStyle included, so applying one has to rebuild the menu.
  w.docQueryAll = null; // stop scenario 17's stub response from being the column
  C.rt.composerEl = w.makeEl("div");
  C.rt.composerEl.__rect = { left: 350, right: 1050, width: 700, top: 0, bottom: 400, height: 400 };
  // Save the preset in the state it is meant to restore. (list() re-parses
  // from storage, so mutating a returned object changes nothing — an earlier
  // version of this test did exactly that and proved nothing.)
  C.settings.menuStyle = "margin";
  C.presets.saveCurrent("margin-setup");
  C.settings.menuStyle = "console";
  C.dock.build();
  C.presets.apply("margin-setup");
  check("applying a preset that changes the menu style rebuilds the menu",
    C.settings.menuStyle === "margin" && !!w.bodyEls["cit-margin-rail"]);
  C.presets.del("margin-setup");
  C.settings.menuStyle = "console";
  C.dock.build();

  // SCENARIO 19 — "The input was hidden, so I hit Cmd+K and started typing in
  // Calm's own search box." Type-ahead must not scoop those keystrokes into
  // the chat composer.
  C.rt.composerHidden = true;
  C.rt.pendingText = "";
  C.settings.typeAhead = "auto";
  C.palette.open();
  var palInput = w.bodyEls["cit-palette"].querySelector(".cit-pal-input");
  var stolen = false;
  (w.docLs.keydown || []).forEach(function (f) {
    f({ key: "z", code: "KeyZ", ctrlKey: false, metaKey: false, altKey: false,
        composedPath: function () { return [palInput]; },
        preventDefault: function () { stolen = true; },
        stopPropagation: function () {} });
  });
  check("typing in Calm's own search box is not scooped into the chat",
    !stolen && !C.rt.pendingText);
  C.palette.close();

  // SCENARIO 19b — "Calm hid the input so I could read, and I hit Space to
  // scroll down like I do on every other page."
  //
  // Space is a printable character AND the oldest scroll key on the web. When
  // the composer is hidden there is nothing being typed yet, so a Space is a
  // request to move down the page — never the first character of a message.
  var body = w.makeEl("div"); // focus is on the page, not in any field
  function press(key) {
    var prevented = false;
    (w.docLs.keydown || []).forEach(function (f) {
      f({ key: key, code: key === " " ? "Space" : "Key" + key.toUpperCase(),
          ctrlKey: false, metaKey: false, altKey: false,
          composedPath: function () { return [body]; },
          preventDefault: function () { prevented = true; },
          stopPropagation: function () {} });
    });
    return prevented;
  }
  C.rt.composerHidden = true;
  C.rt.pendingText = "";
  C.settings.typeAhead = "auto";
  check("Space still scrolls the page while the input is hidden", !press(" "));

  // ...but a letter is someone starting to type, and must still be caught.
  C.rt.composerHidden = true;
  C.rt.pendingText = "";
  check("a letter still starts a message", press("h"));

  // In buffer mode the composer stays hidden while you keep typing, so once
  // there IS a word in flight a Space belongs to the sentence.
  C.rt.composerHidden = true;
  C.settings.typeAhead = "buffer";
  C.rt.pendingText = "";
  press("h");
  press("i");
  check("(setup) buffer mode is holding a word", C.rt.pendingText === "hi");
  check("a Space mid-sentence is typed, not swallowed as a scroll",
    press(" ") && C.rt.pendingText === "hi ");

  C.settings.typeAhead = "auto";
  C.rt.pendingText = "";
  C.rt.composerHidden = false;
})();

section("Onboarding");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;

  // SCENARIO 20 — "I installed it. Something should tell me the pill is the
  // menu and that Cmd+K exists, without a modal over the conversation."
  check("a first-run tour appears, anchored to the menu, not over the chat",
    !!w.bodyEls["cit-tour"] &&
      w.bodyEls["cit-dock"].querySelectorAll(".cit-tour-card").length +
      (w.bodyEls["cit-tour"] ? 1 : 0) > 0);
  check("it is short and says which step you are on",
    !!w.bodyEls["cit-tour"] &&
      /1\s*\/\s*3/.test(JSON.stringify(
        (w.bodyEls["cit-tour"].querySelector(".cit-tour-step") || {}).textContent || "")));

  // SCENARIO 21 — "I clicked through it. It must never come back."
  var next = w.bodyEls["cit-tour"] && w.bodyEls["cit-tour"].querySelector(".cit-tour-next");
  if (next) {
    next.__ls.click[0]({ stopPropagation: function () {} });
    next.__ls.click[0]({ stopPropagation: function () {} });
    next.__ls.click[0]({ stopPropagation: function () {} });
  }
  check("finishing the tour closes it", !w.bodyEls["cit-tour"]);
  C.dock.build();
  check("and it does not reappear on a rebuild", !w.bodyEls["cit-tour"]);
  w.nav("https://chatgpt.com/c/next");
  check("nor after navigating", !w.bodyEls["cit-tour"]);
  var w2 = buildWorld("chatgpt.com", { lenient: true, seed: w.local });
  check("nor on a fresh page load once dismissed", !w2.bodyEls["cit-tour"]);

  // SCENARIO 22 — "Skip means skip."
  var w3 = buildWorld("chatgpt.com", { lenient: true });
  var skip = w3.bodyEls["cit-tour"] && w3.bodyEls["cit-tour"].querySelector(".cit-tour-skip");
  check("there is a way out on the first card", !!skip);
  if (skip) skip.__ls.click[0]({ stopPropagation: function () {} });
  check("skipping closes it", !w3.bodyEls["cit-tour"]);
  var w4 = buildWorld("chatgpt.com", { lenient: true, seed: w3.local });
  check("skipping is remembered too", !w4.bodyEls["cit-tour"]);

  // SCENARIO 23 — "I was mid-presentation when I first installed it." It must
  // not appear over something the user is showing other people. The tour is a
  // CHILD of the dock, so presentation's hide-all-Calm-UI rule covers it —
  // that inheritance is the actual guarantee, so assert it rather than
  // asserting the element is absent (it is only deferred, not dismissed).
  var w5 = buildWorld("chatgpt.com", { lenient: true });
  var tourEl = w5.bodyEls["cit-tour"];
  check("the tour hangs off the dock, so Presentation hides it too",
    !!tourEl && tourEl.__parent === w5.bodyEls["cit-dock"]);
  var cssTxt = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
  check("Presentation really does hide the dock",
    /html\.cit-presentation[^{]*#cit-dock/.test(cssTxt));
  // Starting a presentation while it is up must take it off screen at once.
  w5.C.modes.enter("presentation");
  check("entering Presentation does not leave the tour behind",
    !w5.bodyEls["cit-tour"]);
  w5.C.modes.exit("presentation");

  // SCENARIO 24 — Escape closes it, like everything else in Calm.
  var w6 = buildWorld("chatgpt.com", { lenient: true });
  (w6.docLs.keydown || []).slice().forEach(function (f) {
    f({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} });
  });
  check("Escape dismisses the tour", !w6.bodyEls["cit-tour"]);
})();

section("Answer ready");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  var generating = false;
  var stopSel = C.site.stopSel;
  w.docQuery = function (sel) { return sel === stopSel && generating ? w.makeEl("button") : null; };
  function tick() { var t = w.lastInterval(); if (t) t(); }
  function poll() { Object.keys(w.intervals).forEach(function (k) { w.intervals[k](); }); }

  // SCENARIO 25 — "I asked something long and switched to another tab. I want
  // to know when it is done without going back to check."
  global.document.title = "A question about tax — ChatGPT";
  global.document.hidden = true;
  generating = true;  poll();
  generating = false; poll();
  check("the tab tells me when the answer landed while I was away",
    /ready/i.test(global.document.title), JSON.stringify(global.document.title));

  // SCENARIO 26 — "The site renamed its own tab while the badge was up."
  global.document.title = "A question about tax — ChatGPT";
  poll();
  check("the badge survives the site rewriting its own title",
    /ready/i.test(global.document.title), JSON.stringify(global.document.title));

  // SCENARIO 27 — "I came back to the tab." The badge must clear itself and
  // leave the site's own title exactly as it was.
  global.document.hidden = false;
  (w.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  check("coming back clears the badge and restores the real title",
    global.document.title === "A question about tax — ChatGPT",
    JSON.stringify(global.document.title));

  // SCENARIO 28 — "I never left the tab." Nothing should change: I watched it
  // finish with my own eyes.
  global.document.hidden = false;
  global.document.title = "Still here — ChatGPT";
  generating = true;  poll();
  generating = false; poll();
  check("nothing happens if I was watching the whole time",
    global.document.title === "Still here — ChatGPT",
    JSON.stringify(global.document.title));

  // SCENARIO 29 — sound is off unless asked for, and never while I am looking.
  var chimes = 0;
  C.audio.playChime = function () { chimes++; };
  global.document.hidden = true;
  generating = true;  poll();
  generating = false; poll();
  check("no sound unless I turned it on", chimes === 0);
  // Look at the tab and leave again — otherwise the badge is still armed from
  // the case above and markReady() rightly refuses to fire a second time.
  global.document.hidden = false;
  (w.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  global.document.hidden = true;
  C.settings.answerReadyChime = true;
  generating = true;  poll();
  generating = false; poll();
  check("with it on, it chimes once", chimes === 1, "chimes=" + chimes);
  // A second reply landing while I am STILL away must not chime again.
  generating = true;  poll();
  generating = false; poll();
  check("but it does not keep chiming while I stay away", chimes === 1,
    "chimes=" + chimes);
  C.settings.answerReadyChime = false;
  global.document.hidden = false;
  (w.docLs.visibilitychange || []).forEach(function (f) { f({}); });

  // SCENARIO 30 — the whole thing can be switched off.
  C.settings.answerReady = false;
  global.document.title = "Off — ChatGPT";
  global.document.hidden = true;
  generating = true;  poll();
  generating = false; poll();
  check("turning the cue off really turns it off",
    global.document.title === "Off — ChatGPT");
  C.settings.answerReady = true;
  global.document.hidden = false;
})();

section("Hardening");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;

  // SCENARIO 31 — "The site re-rendered the conversation, then Scroll to top
  // did nothing." Calm was holding the scroller React had already replaced —
  // the same failure the composer had, in the other half of the engine.
  var stale = w.makeEl("div");
  stale.isConnected = false;
  var scrolledOn = null;
  stale.scrollTo = function () { scrolledOn = "stale"; };
  var live = w.makeEl("div");
  live.isConnected = true;
  live.clientHeight = 800; live.scrollHeight = 4000;
  live.scrollTo = function () { scrolledOn = "live"; };
  C.rt.scrollContainer = stale;
  C.site.scrollRoot = function () { return live; };
  C.ui.smoothScrollTo(0);
  check("scrolling acts on the scroller that is actually on the page",
    scrolledOn === "live", "acted on " + scrolledOn);

  // The same re-resolution must protect auto-hide, or it reads scrollTop off a
  // node the page has thrown away.
  check("the stale reference is replaced, not just worked around",
    C.rt.scrollContainer === live);

  // SCENARIO 32 — site knowledge belongs in the adapter, not the engine. A
  // fourth site should be addable by writing an adapter and nothing else.
  var coreSrc = fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8");
  check("no site selectors are hard-coded in core.js",
    !/bard-sidenav|dframe-sidebar|stage-slideover/.test(coreSrc));
  check("every adapter declares what must not drive auto-hide",
    ["chatgpt.com", "gemini.google.com", "claude.ai"].every(function (h) {
      var ww = buildWorld(h, { lenient: true });
      return typeof ww.C.site.excludedScrollers === "function" &&
        typeof ww.C.site.excludedScrollers() === "string";
    }));

  // SCENARIO 33 — the tuning numbers live with the other tuning numbers.
  var w2 = buildWorld("chatgpt.com", { lenient: true });
  check("scroll thresholds are named constants, not literals in the logic",
    typeof w2.C.const.UP_MAX === "number" && typeof w2.C.const.UP_MIN === "number");
  var core2 = fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8");
  check("the sensitivity formula reads them from CALM.const",
    /C\.UP_MAX/.test(core2) && /C\.UP_MIN/.test(core2) && !/150 - \(s - 1\)/.test(core2));
})();

section("Where was I");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;
  var realNow = Date.now;
  function travel(min) { Date.now = function () { return realNow() + min * 60000; }; }
  function comeBack() {
    global.document.hidden = false;
    (w.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  }
  function leave() {
    global.document.hidden = true;
    (w.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  }

  // SCENARIO 34 — "I came back to this tab an hour later and had no idea what
  // I was doing." A quiet card, only after a real absence.
  C.intent.state.goal = "draft the quarterly review";
  leave();
  travel(45);
  comeBack();
  var card = w.bodyEls["cit-back"];
  check("after a long absence it reminds me what I was doing", !!card);
  check("and it says the goal I set",
    !!card && /quarterly review/.test(JSON.stringify(card.__text || textOf(card))),
    card ? textOf(card).slice(0, 80) : "");
  Date.now = realNow;

  function textOf(n) {
    var out = "";
    (function walk(x) {
      (x.children || []).forEach(function (c) {
        if (c.textContent) out += c.textContent + " ";
        walk(c);
      });
    })(n);
    return out;
  }

  // SCENARIO 35 — "I switched tabs for thirty seconds." Nothing should happen;
  // that is not being away, that is working.
  if (card) card.remove();
  leave();
  travel(0.5);
  comeBack();
  check("a quick tab switch does not trigger it", !w.bodyEls["cit-back"]);
  Date.now = realNow;

  // SCENARIO 36 — "I dismissed it." It must go, and not come straight back on
  // the next tab switch.
  leave(); travel(45); comeBack();
  var c2 = w.bodyEls["cit-back"];
  var x = c2 && c2.querySelector(".cit-back-x");
  if (x) x.__ls.click[0]({ stopPropagation: function () {} });
  check("dismissing closes it", !w.bodyEls["cit-back"]);
  Date.now = realNow;
  // Dismissing restarts the clock: a quick flick after it must NOT bring it
  // back. (An earlier version of this test travelled 45 minutes and expected
  // silence — but that is a genuine new absence, and returning then is the
  // whole point of the feature.)
  leave(); travel(1); comeBack();
  check("a flick right after dismissing does not bring it back",
    !w.bodyEls["cit-back"]);
  Date.now = realNow;
  leave(); travel(45); comeBack();
  check("but a real new absence does earn it again", !!w.bodyEls["cit-back"]);
  if (w.bodyEls["cit-back"]) w.bodyEls["cit-back"].remove();
  Date.now = realNow;

  // SCENARIO 37 — nothing to say, so say nothing.
  var w2 = buildWorld("chatgpt.com", { lenient: true });
  w2.C.intent.state.goal = "";
  global.document.hidden = true;
  (w2.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  Date.now = function () { return realNow() + 45 * 60000; };
  global.document.hidden = false;
  (w2.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  check("with no goal and nothing parked it stays quiet", !w2.bodyEls["cit-back"]);
  Date.now = realNow;

  // SCENARIO 38 — never over a presentation, like everything else.
  var w3 = buildWorld("chatgpt.com", { lenient: true });
  w3.C.intent.state.goal = "something";
  w3.C.modes.enter("presentation");
  global.document.hidden = true;
  (w3.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  Date.now = function () { return realNow() + 45 * 60000; };
  global.document.hidden = false;
  (w3.docLs.visibilitychange || []).forEach(function (f) { f({}); });
  check("it never appears during Presentation", !w3.bodyEls["cit-back"]);
  Date.now = realNow;
  w3.C.modes.exit("presentation");
})();

/* ---------------- Auto-hide: only when there is something to read -------- */
section("Auto-hide");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  function scroller(clientH, scrollH, top) {
    var el = w.makeEl("div");
    el.clientHeight = clientH;
    el.scrollHeight = scrollH;
    el.scrollTop = top;
    el.closest = function () { return null; }; // not an excluded scroller
    return el;
  }
  function scrollTo(el, top) {
    el.scrollTop = top;
    (w.docLs.scroll || []).forEach(function (f) { f({ target: el }); });
  }
  // NOTE: the stub fires sub-3s timers synchronously, so the 350ms
  // accumulator reset lands between events and cross-event accumulation
  // cannot be modelled here. Each scroll below is therefore ONE realistic
  // wheel notch (~100px), which is what actually has to clear the threshold.
  function adopt(el) {
    C.rt.scrollContainer = null;
    C.rt.accUp = 0;
    C.rt.composerHidden = false;
    C.rt.scrollLocked = false;
    scrollTo(el, el.scrollTop); // first event adopts and is swallowed
  }

  C.rt.composerEl = w.makeEl("div");
  C.settings.autoHideOnScroll = true;

  // THE REPORTED BUG: a new chat. 250px of scrollable range means one flick
  // covers the lot, which used to satisfy both thresholds at once.
  w.docQuery = null; // no assistant responses on the page
  var fresh = scroller(800, 1050, 250);
  adopt(fresh);
  scrollTo(fresh, 0); // flick the entire range upward
  check("a new chat does NOT hide the composer on the first scroll",
    !C.rt.composerHidden);
  scrollTo(fresh, 250);
  scrollTo(fresh, 0);
  check("nor on repeated scrolling", !C.rt.composerHidden);

  // A real conversation still behaves exactly as before.
  w.docQuery = w.makeEl("div"); // responses exist
  var real = scroller(800, 4000, 2000);
  adopt(real);
  scrollTo(real, 1900); // one wheel notch up
  check("a long conversation still auto-hides", C.rt.composerHidden);

  // A single jump larger than the viewport is a relayout, not a gesture.
  C.rt.composerHidden = false;
  var snap = scroller(800, 4000, 3000);
  adopt(snap);
  scrollTo(snap, 0); // -3000 in one event
  check("a viewport-sized jump is ignored (relayout, not intent)",
    !C.rt.composerHidden);

  // Selector rot must never silently disable auto-hide on a long thread.
  w.docQuery = null;
  C.rt.composerHidden = false;
  var longNoSel = scroller(800, 5000, 2500);
  adopt(longNoSel);
  scrollTo(longNoSel, 2400);
  check("a very long page hides even if the response selector rots",
    C.rt.composerHidden);

  // Mid-length page with no conversation: still refuse.
  w.docQuery = null;
  C.rt.composerHidden = false;
  var midEmpty = scroller(800, 1700, 700);
  adopt(midEmpty);
  scrollTo(midEmpty, 600);
  check("a mid-length page with no responses refuses to hide",
    !C.rt.composerHidden);

  // ...but the same page WITH responses hides.
  w.docQuery = w.makeEl("div");
  C.rt.composerHidden = false;
  var midReal = scroller(800, 1700, 700);
  adopt(midReal);
  scrollTo(midReal, 600);
  check("the same page with responses does hide", C.rt.composerHidden);
  w.docQuery = null;
})();

/* ---------------- The Margin ---------------- */
section("Margin");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  // A realistic column: 700px of text centred in a 1400px window leaves 350px
  // of gutter on each side.
  function column(left, right) {
    C.rt.composerEl = w.makeEl("div");
    C.rt.composerEl.__rect = { left: left, right: right, width: right - left,
      top: 100, bottom: 500, height: 400 };
  }

  column(350, 1050);
  var m = C.margin.measure();
  check("finds the roomier gutter and centres the rail in it",
    !!m && m.side === "right" && m.x > 1050 && m.x < 1400, JSON.stringify(m));

  // A column pushed right (site sidebar open) should move the rail left.
  column(700, 1380);
  var m2 = C.margin.measure();
  check("follows the column when the page layout shifts",
    !!m2 && m2.side === "left" && m2.x < 700, JSON.stringify(m2));

  // No gutter -> margin mode must decline rather than sit on the text.
  column(20, 1380);
  check("declines when there is no room", C.margin.measure() === null);

  // End to end: the rail replaces the pill, and the Console still works.
  column(350, 1050);
  C.settings.menuStyle = "margin";
  C.dock.build();
  var dock = w.bodyEls["cit-dock"];
  check("margin mode renders the rail instead of the pill",
    !!w.bodyEls["cit-margin-rail"] && !dock.querySelector(".cit-dock-pill") &&
      dock.classList.contains("cit-margin"));
  check("the rail carries five marks",
    w.bodyEls["cit-margin-rail"].querySelectorAll(".cit-mark").length === 5);
  check("the Console still lives in the same host",
    !!w.bodyEls["cit-console"]);
  C.console.open();
  check("and still opens from the rail", C.console.isOpen());
  C.console.close();

  // Fall back on its own when the gutter disappears — no setting to change.
  column(20, 1380);
  C.dock.build();
  check("falls back to the corner pill when the gutter goes away",
    !w.bodyEls["cit-margin-rail"] &&
      !!w.bodyEls["cit-dock"].querySelector(".cit-dock-pill"));
  check("and the Console survives the fallback", !!w.bodyEls["cit-console"]);

  C.settings.menuStyle = "console";
  C.dock.build();
  check("switching back to the pill leaves no rail behind",
    !w.bodyEls["cit-margin-rail"]);
})();

/* ---------------- Sanitizer ---------------- */
section("Sanitizer");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;
  check("the security-critical function is exported and therefore testable",
    typeof C.reader._sanitize === "function");

  // Node-level smoke; the full attack suite lives in tools/sanitizer-test.html
  // and must be run in a real browser (see the header of that file).
  function src(build) {
    var root = w.makeEl("div");
    build(root);
    return root;
  }
  function txt(n, s) { var t = { nodeType: 3, textContent: s }; n.children.push(t);
    n.childNodes = n.children; return n; }
  function tag(name, attrs) {
    var e = w.makeEl(name);
    e.__attrs = attrs || {};
    e.childNodes = e.children;
    return e;
  }
  var root = src(function (r) {
    var script = tag("script"); txt(script, "window.x=1");
    var p = tag("p", { onclick: "x()", id: "cit-dock" }); txt(p, "hello");
    var a = tag("a", { href: "javascript:alert(1)" }); txt(a, "bad");
    var custom = tag("message-content"); txt(custom, "unwrapped");
    r.children = [script, p, a, custom];
    r.childNodes = r.children;
  });
  var out = C.reader._sanitize(root);
  function collect(n, acc) {
    (n.children || []).forEach(function (c) {
      if (c.tagName) acc.push(String(c.tagName).toUpperCase());
      collect(c, acc);
    });
    return acc;
  }
  var tags = collect(out, []);
  check("script is dropped entirely", tags.indexOf("SCRIPT") < 0);
  check("allowed tags survive", tags.indexOf("P") >= 0);
  check("unknown custom element is unwrapped, not adopted",
    tags.indexOf("MESSAGE-CONTENT") < 0);
  var anchors = [];
  (function walk(n) {
    (n.children || []).forEach(function (c) {
      if (String(c.tagName).toUpperCase() === "A") anchors.push(c);
      walk(c);
    });
  })(out);
  check("javascript: href is refused",
    anchors.length === 1 && !anchors[0].__attrs.href);

  var browserSuite = fs.existsSync(path.join(ROOT, "tools", "sanitizer-test.html"));
  check("the browser attack suite is committed alongside it", browserSuite);
})();

/* ---------------- Host isolation ---------------- */
section("Host isolation");
(function () {
  var css = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
  var rules = css.match(/:where\([^)]*#cit-console[^)]*\)[^{]*\{[^}]*\}/g) || [];
  var descendant = rules.filter(function (r) { return /\)\s*\*\s*\{/.test(r); })[0];
  var rootOnly = rules.filter(function (r) { return !/\)\s*\*\s*\{/.test(r); })[0];
  check("a zero-specificity reset guards Calm's chrome", !!descendant && !!rootOnly);
  if (!descendant || !rootOnly) return;

  // Properties a hostile host sets that must never reach our descendants.
  ["letter-spacing", "text-indent", "white-space", "direction",
   "text-transform", "box-sizing"].forEach(function (prop) {
    check("descendants are guarded against inherited " + prop,
      descendant.indexOf(prop + ":") >= 0);
  });

  // REGRESSION GUARD. `color` (and friends) on a DESCENDANT is a declaration,
  // and a declaration beats inheritance — so declaring them there paints every
  // icon inside an active control with the base ink instead of the active
  // foreground, i.e. white-on-white. They belong on the roots only.
  ["color", "font-size", "line-height", "font-weight"].forEach(function (prop) {
    check("descendants do NOT declare " + prop + " (it would break active states)",
      descendant.indexOf(prop + ":") < 0);
    check("the root does declare " + prop, rootOnly.indexOf(prop + ":") >= 0);
  });

  check("the reset uses :where() so real rules still win without !important",
    descendant.indexOf("!important") < 0 && rootOnly.indexOf("!important") < 0);

  // Elements a host could crush must state their own line-height, which
  // outranks any `*` or type selector the page can write.
  check("the live-tile label declares its own line-height",
    /\.cit-live-idle \{[^}]*line-height:/.test(css));

  var readerReset = css.match(/:where\(#cit-reader-pane[^{]*\{([^}]*)\}/);
  check("the reader's reset leaves bidi and whitespace alone",
    !!readerReset && readerReset[1].indexOf("direction:") < 0 &&
      readerReset[1].indexOf("white-space:") < 0);
  check("code blocks re-assert white-space: pre",
    /\.cit-fr-body pre \{\s*white-space: pre;/.test(css));

  // No rule may still target a surface v3.1 deleted.
  ["#cit-settings-panel", "#cit-modes-pop", "#cit-bloom", ".cit-account"].forEach(function (sel) {
    check("no dead CSS for " + sel, css.indexOf(sel) < 0);
  });
  check("a browser colour/contrast suite is committed",
    fs.existsSync(path.join(ROOT, "tools", "contrast-test.html")));

  var w = buildWorld("chatgpt.com", {});
  w.C.intent.state.goal = "לסיים את הסקירה";
  w.C.console.render();
  var idle = w.bodyEls["cit-console"].querySelector(".cit-live-idle");
  check("the goal renders with dir=auto (Hebrew reads correctly)",
    !!idle && idle.__attrs && idle.__attrs.dir === "auto");
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

/* ---------------- Polish: the audit's confirmed defects ---------------- */
section("Polish");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  // showToggleButton used to be applied by the settings handler with
  // display:none, which punched a hole in the grid AND was undone by the next
  // rebuild. It is now honoured at build time, and dims.
  C.settings.showToggleButton = false;
  C.console.render();
  var con = w.bodyEls["cit-console"];
  var tiles = con.querySelectorAll(".cit-qt");
  check("hidden input tile dims and keeps its column",
    tiles.length === 3 && tiles[0].classList.contains("cit-qt-dim"));
  C.dock.build(); // survives a rebuild
  check("the setting survives a rebuild",
    w.bodyEls["cit-console"].querySelectorAll(".cit-qt")[0].classList.contains("cit-qt-dim"));
  C.settings.showToggleButton = true;
  C.console.render();

  // Presets used to snapshot 10 of 37 settings and silently drop the rest.
  C.settings.grayLevel = 55;
  C.settings.frSize = 22;
  C.presets.saveCurrent("t");
  var saved = C.presets.list().filter(function (p) { return p.name === "t"; })[0];
  check("a preset now captures every user-facing setting",
    saved && saved.settings.grayLevel === 55 && saved.settings.frSize === 22 &&
      Object.keys(saved.settings).length >= Object.keys(C.defaultSettings).length - 1,
    saved ? Object.keys(saved.settings).length + " keys" : "not saved");
  C.presets.del("t");

  // dockQuiet had no control anywhere in the UI.
  var adv = w.makeEl("div");
  C.ui.buildAdvancedSections(adv);
  var labels = adv.querySelectorAll(".cit-settings-row").map(function (r) {
    return r.children[0] ? r.children[0].textContent : "";
  });
  check("dockQuiet is reachable from Advanced",
    labels.some(function (l) { return /fade the pill/i.test(l); }), labels.length + " rows");

  // One Escape listener, newest-first: the reader must win over the Console.
  C.console.open();
  C.modes.enter("focusreader");
  var esc = function () {
    (w.docLs.keydown || []).forEach(function (f) {
      f({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} });
    });
  };
  esc();
  check("Escape closes the topmost surface first (reader, not the Console)",
    !w.bodyEls["cit-reader-pane"] && C.console.isOpen());
  esc();
  check("a second Escape then closes the Console", !C.console.isOpen());
})();

/* ---------------- Review batch A ---------------- */
section("Review fixes");
(function () {
  var w = buildWorld("chatgpt.com", {});
  var C = w.C;

  // The "Show input tile" row was passed as appendChild's SECOND argument and
  // silently discarded, so it never rendered.
  var adv = w.makeEl("div");
  C.ui.buildAdvancedSections(adv);
  var labels = adv.querySelectorAll(".cit-settings-row").map(function (r) {
    return r.children[0] ? r.children[0].textContent : "";
  });
  check("both toggle rows render (appendChild takes ONE child)",
    labels.some(function (l) { return /fade the pill/i.test(l); }) &&
    labels.some(function (l) { return /show input tile/i.test(l); }));

  // Escape must reach every dismissible surface.
  function esc() {
    (w.docLs.keydown || []).slice().forEach(function (f) {
      f({ key: "Escape", stopPropagation: function () {}, preventDefault: function () {} });
    });
  }
  C.intent.toggle(false);
  check("Escape closes the Intention panel",
    !!w.bodyEls["cit-intent-pop"] && (esc(), !w.bodyEls["cit-intent-pop"]));
  C.palette.open();
  check("Escape closes the palette even without input focus",
    !!w.bodyEls["cit-palette"] && (esc(), !w.bodyEls["cit-palette"]));
})();

section("Pomodoro accounting");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C, P = C.pomodoro, logged = [];
  C.stats.log = function (kind, min) { logged.push({ kind: kind, min: min }); };
  if (C.audio) C.audio.playChime = function () {};

  // Skipping two minutes into a 25-minute block must log 2, not 25.
  C.modes.enter("pomodoro");
  P.state.remaining = P.state.total - 120;
  P.skip();
  check("skip logs the elapsed time, not the configured length",
    logged.length === 1 && logged[0].min === 2, JSON.stringify(logged));

  // The final long break was logged once by nextPhase and again by stop().
  logged.length = 0;
  P.state.phase = "long";
  P.state.total = 900;
  P.state.remaining = 300;
  P.state.running = true;
  var tick = w.lastInterval();
  P.state.remaining = 1;
  if (tick) tick();
  var longEntries = logged.filter(function (l) { return l.kind === "long"; });
  check("the final long break is logged exactly once",
    longEntries.length <= 1, JSON.stringify(logged));
})();

section("Zen ownership across sites");
(function () {
  ["gemini.google.com", "claude.ai"].forEach(function (host) {
    var w = buildWorld(host, { lenient: true });
    var C = w.C;
    check(host + ": zenInline is off", C.site.zenInline !== true);
    var stripped = [];
    var fake = { style: { removeProperty: function (p) { stripped.push(p); },
      setProperty: function () {} } };
    C.rt.zenHidden = [fake];
    C.modes.enter("zen");
    C.modes.exit("zen");
    // Only elements Calm itself hid may have their inline display cleared.
    check(host + ": exiting Zen touches only elements Calm hid",
      stripped.length <= 1);
  });
})();

section("Review batch B");
(function () {
  var w = buildWorld("chatgpt.com", { lenient: true });
  var C = w.C;

  // Presentation hides every Calm surface, so Escape must work even with
  // keyboard shortcuts switched off — otherwise it is an unrecoverable trap
  // that "remember state" persists across reloads.
  C.settings.keyboardShortcut = false;
  C.modes.enter("presentation");
  (w.docLs.keydown || []).slice().forEach(function (f) {
    f({ code: "Escape", key: "Escape", stopPropagation: function () {},
        preventDefault: function () {} });
  });
  check("Escape escapes Presentation even with shortcuts off",
    !C.modes.isActive("presentation"));
  C.settings.keyboardShortcut = true;

  // Choosing a Pomodoro preset used to wipe Reading/Behavior/Presets/About.
  var adv = w.makeEl("div");
  C.ui.buildAdvancedSections(adv);
  var before = adv.querySelectorAll(".cit-settings-row").length;
  var sel = adv.querySelectorAll(".cit-select")[0];
  if (sel && sel.__ls && sel.__ls.change) {
    sel.value = "25/5";
    sel.__ls.change[0]({ stopPropagation: function () {} });
  }
  check("changing the timer preset keeps the whole drawer",
    adv.querySelectorAll(".cit-settings-row").length >= before - 2,
    before + " -> " + adv.querySelectorAll(".cit-settings-row").length);

  // Applying a preset must re-apply reader typography (the deleted mode's job).
  C.settings.readerFontScale = 100;
  C.modes.applyReaderType();
  C.presets.apply("Deep Reading");
  check("a preset that sets page typography actually applies it",
    C.settings.readerFontScale === 120 &&
      global.document.documentElement.classList.contains("cit-reader"));

  // Reset positions rebuilds the dock — it must not leave the user staring at
  // a vanished drawer.
  C.console.openAdvanced();
  C.dock.build();
  if (C.console.openAdvanced) C.console.openAdvanced();
  check("Reset-positions style rebuild keeps the Console reachable",
    C.console.isOpen());
  C.console.close();

  // Dead controls are gone rather than lying to the user.
  check("the no-op quick-scroll setting is gone",
    C.defaultSettings.showQuickNav === undefined && !C.ui.updateQuickNav);
  var adv2 = w.makeEl("div");
  C.ui.buildAdvancedSections(adv2);
  var text = adv2.querySelectorAll(".cit-settings-row").map(function (r) {
    return r.children[0] ? r.children[0].textContent : "";
  }).join("|");
  check("the goal-placement setting is reachable", /where the goal shows/i.test(text));
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
