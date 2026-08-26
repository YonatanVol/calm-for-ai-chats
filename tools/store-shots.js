#!/usr/bin/env node
/* ===== Calm — tools/store-shots.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 *
 * Renders the Chrome Web Store screenshots from the REAL stylesheet and the
 * REAL icon set, so a shot can never drift from what the extension actually
 * looks like — re-run it after any design change and the assets update.
 *
 *   node tools/store-shots.js          → store-assets/*.png
 *
 * Output: five 1280x800 screenshots plus the 440x280 small promo tile, the
 * exact sizes the dashboard asks for.
 *
 * HONESTY NOTE — read before uploading. These are HERO shots: Calm's own
 * interface on a neutral backdrop with a caption. They show the real UI, but
 * they do NOT show it sitting on chatgpt.com, gemini.google.com or claude.ai,
 * because this script cannot log into those sites and mocking up someone
 * else's product to pass as a real screenshot would be both misleading and a
 * trademark problem. At least one in-situ screenshot taken by hand on a real
 * conversation is worth more than all five of these; see store-assets/README.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var OUT = path.join(ROOT, "store-assets");
var TMP = path.join(OUT, ".build");

var CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

var css = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, "src", "icons.js"), "utf8"));
var I = global.window.CALM.icons;

/* ---------------- the pieces, built from the real markup ---------------- */

function qt(icon, label, on) {
  return (
    '<button class="cit-qt ' + (on ? "cit-active" : "") + '">' +
    '<span class="cit-ic">' + icon + "</span>" +
    '<span class="cit-qt-label">' + label + "</span></button>"
  );
}
function chipm(icon, label, on) {
  return (
    '<button class="cit-chipm ' + (on ? "cit-active" : "") + '">' +
    '<span class="cit-chipm-ic">' + icon + "</span><span>" + label + "</span></button>"
  );
}
function slider(label, val, out) {
  return (
    '<div class="cit-con-slider"><span class="cit-con-slabel">' + label + "</span>" +
    '<input type="range" value="' + val + '"><span class="cit-con-sval">' + out +
    "</span></div>"
  );
}
function consolePanel(running) {
  var live = running
    ? '<div class="cit-live-time">24:31</div><div class="cit-live-sub">focus · 2/4</div>'
    : '<div class="cit-live-idle">Start a focus block</div>' +
      '<div class="cit-live-sub">25 min · 5 break</div>';
  return (
    '<div id="cit-console"><div class="cit-live ' + (running ? "cit-live-on" : "") + '">' +
    '<div class="cit-live-main">' + live + "</div>" +
    '<div class="cit-live-side"><button class="cit-live-btn">' + I.pause +
    '</button><button class="cit-live-btn">' + I.focus + "</button></div></div>" +
    '<div class="cit-quick">' + qt(I.input, "Input", false) + qt(I.zen, "Zen", true) +
    qt(I.book, "Reader", false) + qt(I.top, "Answer", false) + "</div>" +
    slider("Width", 55, "780") + slider("Text", 30, "110") +
    '<div class="cit-modes-row">' + chipm(I.night, "Night", false) +
    chipm(I.ruler, "Reading ruler", true) + "</div>" +
    '<div class="cit-con-foot"><span class="cit-con-hint">⌘K</span>' +
    '<button class="cit-con-adv-btn">Advanced' + I.collapse + "</button></div></div>"
  );
}
function dock(inner, cls) {
  // In margin mode the rail REPLACES the pill, so a shot showing both would be
  // advertising a UI that never exists.
  var isMargin = /cit-margin/.test(cls || "");
  return (
    '<div id="cit-dock" class="cit-dock-open ' + (cls || "cit-corner-br") + '">' +
    (isMargin
      ? ""
      : '<button class="cit-dock-pill"><span class="cit-dock-mark">' + I.mark +
        "</span></button>") +
    inner + "</div>"
  );
}
function rail(live) {
  function mark(icon, label, on, count) {
    return (
      '<button class="cit-mark ' + (on ? "cit-active" : "") + '">' +
      '<span class="cit-mark-ic">' + icon + "</span>" +
      '<span class="cit-mark-label">' + label + "</span>" +
      (count ? '<span class="cit-mark-count">' + count + "</span>" : "") +
      "</button>"
    );
  }
  return (
    '<div class="cit-rail">' + mark(I.input, "Input", false) +
    mark(I.zen, "Zen", true) + mark(I.book, "Reader", false) +
    mark(I.pomodoro, "Timer", !!live, live) + mark(I.settings, "More", false) + "</div>"
  );
}

// A neutral stand-in for a conversation. Deliberately abstract: it suggests
// a page of text without imitating any particular product's chrome.
function proseColumn(width) {
  var lines = [
    96, 88, 100, 72, 0,
    94, 100, 83, 91, 68, 0,
    78, 96, 100, 61, 0,
    89, 97, 74,
  ];
  return (
    '<div class="col" style="width:' + width + 'px">' +
    lines
      .map(function (w) {
        return w
          ? '<div class="ln" style="width:' + w + '%"></div>'
          : '<div class="gap"></div>';
      })
      .join("") +
    "</div>"
  );
}

/* ---------------- the shots ---------------- */

var SHOTS = [
  {
    file: "01-one-menu.png",
    caption: "One menu. Not five.",
    sub: "Every control in a single panel that can never open off-screen.",
    body: function () {
      return proseColumn(560) + dock(consolePanel(false));
    },
  },
  {
    file: "02-focus-reader.png",
    caption: "Read the answer, not the interface.",
    sub: "Bionic fixation, dyslexia-friendly spacing, full Hebrew and Arabic support.",
    body: function () {
      function bionic(t, frac) {
        return t
          .split(/(\s+)/)
          .map(function (w) {
            if (!w.trim()) return w;
            var c = Math.max(1, Math.min(w.length - 1, Math.round(w.length * frac)));
            return '<b class="cit-fx">' + w.slice(0, c) + "</b>" + w.slice(c);
          })
          .join("");
      }
      return (
        '<div id="cit-reader-pane" class="shot-reader">' +
        '<div class="cit-fr-bar"><span class="cit-fr-brand">Focus Reader</span>' +
        '<div class="cit-fr-tools"><button class="cit-fr-btn cit-active">Bionic</button>' +
        '<button class="cit-fr-btn">Ease</button>' +
        '<button class="cit-fr-btn">Spotlight</button>' +
        '<button class="cit-fr-ic">' + I.close + "</button></div></div>" +
        '<div class="cit-fr-body" style="--cit-fr-size:18px">' +
        '<h2 class="cit-blk">' + bionic("What the reading pane is for", 0.4) + "</h2>" +
        '<p class="cit-blk">' +
        bionic(
          "The response is lifted into Calm's own surface, so typography, " +
            "fixation and spotlight never fight the site's own styles.",
          0.4
        ) +
        "</p>" +
        '<p class="cit-blk" dir="auto">' +
        bionic("זהו מצב קריאה שקט, עם תמיכה מלאה בעברית ובכיווניות דו-לשונית.", 0.4) +
        "</p>" +
        '<p class="cit-blk">' +
        bionic("Bold word-starts give the eye an anchor on every word.", 0.4) +
        "</p></div></div>"
      );
    },
  },
  {
    file: "03-timer.png",
    caption: "A focus timer that stays out of the way.",
    sub: "Pomodoro blocks, an optional quiet Zen during focus, and a chime at the end.",
    body: function () {
      return proseColumn(560) + dock(consolePanel(true));
    },
  },
  {
    file: "04-palette.png",
    caption: "Everything, one keystroke away.",
    sub: "⌘K searches every mode, action and setting. Arrows nudge values in place.",
    body: function () {
      function row(n, s, on) {
        return (
          '<div class="cit-pal-row ' + (on ? "cit-pal-on" : "") + '"><span>' + n +
          '</span><span class="cit-pal-state">' + s + "</span></div>"
        );
      }
      return (
        proseColumn(560) +
        '<div id="cit-palette" class="shot-pal"><div class="cit-pal-box">' +
        '<div class="cit-pal-top"><span class="cit-pal-tag">CALM</span>' +
        '<span class="shot-typed">ni</span></div>' +
        '<div class="cit-pal-list">' +
        row("Night", "on", true) + row("Night Level", "35  ← →", false) +
        row("Reading ruler", "", false) + row("Pomodoro Cycles", "4", false) +
        "</div></div></div>"
      );
    },
  },
  {
    file: "05-margin.png",
    caption: "Or no panel at all.",
    sub: "Controls as marks in the margin: barely there until you look for them.",
    body: function () {
      // Shown awake with one label out — the state the marks take the moment
      // the pointer nears them. At rest they sit at 20% and would be almost
      // invisible in a screenshot, which would undersell what they do.
      return proseColumn(560) +
        dock(rail("24"), "cit-margin cit-rail-right shot-awake");
    },
  },
];

var PROMO = {
  file: "promo-440x280.png",
  w: 440,
  h: 280,
  body: function () {
    return (
      '<div class="promo"><div class="promo-mark">' + I.mark + "</div>" +
      '<div class="promo-name">Calm</div>' +
      '<div class="promo-sub">Reading mode for AI chats</div></div>'
    );
  },
};

/* ---------------- render ---------------- */

function page(shot, w, h) {
  var isPromo = !shot.caption;
  return (
    "<html><head><style>" + css + "</style><style>" +
    "*{box-sizing:border-box}" +
    "body{margin:0;width:" + w + "px;height:" + h + "px;overflow:hidden;" +
    "background:radial-gradient(120% 90% at 50% 0%,#232428,#101113);" +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    "display:flex;flex-direction:column;align-items:center;justify-content:center}" +
    ".cap{font-family:Georgia,serif;font-size:30px;color:#f0f0f2;margin-bottom:9px;text-align:center}" +
    ".sub{font-size:14px;color:rgba(240,240,242,.5);margin-bottom:30px;text-align:center;max-width:620px;line-height:1.5}" +
    ".stage{position:relative;width:1020px;height:470px;border-radius:14px;" +
    "background:#161719;box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden;" +
    "display:flex;align-items:center;justify-content:center}" +
    ".col{position:absolute;left:50%;transform:translateX(-50%);top:30px}" +
    ".ln{height:8px;border-radius:4px;background:rgba(255,255,255,.085);margin-bottom:11px}" +
    ".gap{height:15px}" +
    "#cit-dock{position:absolute!important;right:26px!important;bottom:26px!important;top:auto!important;left:auto!important}" +
    "#cit-dock.cit-margin{right:auto!important;left:840px!important;top:50%!important;bottom:auto!important;opacity:1!important}" +
    "#cit-console{opacity:1!important;transform:none!important}" +
    "#cit-dock.cit-margin #cit-console{display:none}" +
    ".shot-reader{position:absolute!important;inset:0!important;border-radius:14px}" +
    "#cit-dock.shot-awake{opacity:1!important}" +
    ".shot-awake .cit-mark:nth-child(2){color:var(--cit-ink);background:var(--cit-fill-soft)}" +
    ".shot-awake .cit-mark:nth-child(2) .cit-mark-label{opacity:1;transform:translateY(-50%) translateX(0)}" +
    ".shot-pal{position:absolute!important;inset:0!important;animation:none!important;padding-top:64px}" +
    '.shot-typed{color:#ececee;font-size:14px}' +
    ".promo{text-align:center}" +
    ".promo-mark{color:#d8d8dc}.promo-mark .cit-svg{width:52px;height:52px}" +
    ".promo-name{font-family:Georgia,serif;font-size:34px;color:#f0f0f2;margin-top:10px}" +
    ".promo-sub{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(240,240,242,.45);margin-top:7px}" +
    "</style></head><body>" +
    (isPromo
      ? shot.body()
      : '<div class="cap">' + shot.caption + "</div>" +
        '<div class="sub">' + shot.sub + "</div>" +
        '<div class="stage">' + shot.body() + "</div>") +
    "</body></html>"
  );
}

function shoot(shot, w, h) {
  var html = path.join(TMP, shot.file.replace(/\.png$/, ".html"));
  fs.writeFileSync(html, page(shot, w, h));
  var out = path.join(OUT, shot.file);
  cp.execFileSync(
    CHROME,
    [
      "--headless", "--disable-gpu", "--hide-scrollbars",
      "--screenshot=" + out,
      "--window-size=" + w + "," + h,
      "file://" + html,
    ],
    { stdio: "ignore" }
  );
  var kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log("  " + shot.file.padEnd(24) + w + "x" + h + "  " + kb + " KB");
}

if (!fs.existsSync(CHROME)) {
  console.error("Chrome not found at " + CHROME + " — set CHROME=/path/to/chrome");
  process.exit(1);
}
fs.mkdirSync(TMP, { recursive: true });
console.log("Rendering store assets from the live stylesheet:\n");
SHOTS.forEach(function (s) { shoot(s, 1280, 800); });
shoot(PROMO, PROMO.w, PROMO.h);
fs.readdirSync(TMP).forEach(function (f) { fs.unlinkSync(path.join(TMP, f)); });
fs.rmdirSync(TMP);
console.log("\n→ " + path.relative(ROOT, OUT) + "/  (read its README before uploading)");
