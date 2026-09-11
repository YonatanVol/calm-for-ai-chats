#!/usr/bin/env node
/* ===== Calm — tools/glide-test.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The auto-scroll bubble, in a REAL browser, asked what a pointer actually
 * hits.
 *
 * Why this exists: tools/harness.js has no layout and no hit-testing — its
 * scenarios call a button's click handler directly. So when the ring's drag
 * overlay was stacked on top of the whole bubble, every harness scenario
 * passed while every real tap landed on the ring: tap, double-tap and moving
 * the bubble were all dead in Chrome. A stub cannot see one element covering
 * another. A browser can.
 *
 * It loads the SHIPPING scripts in manifest order (the list is read from
 * manifest.json, so a new file joins automatically), points Calm at the
 * ChatGPT adapter — a file:// page matches no host — opens the player, and
 * uses elementFromPoint to ask what sits under the centre and under the ring.
 *
 *   node tools/glide-test.js          (needs Google Chrome; CHROME=/path works)
 */
"use strict";
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) {
  console.error("Chrome not found at " + CHROME + " — set CHROME=/path/to/chrome");
  process.exit(2);
}

var mf = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
var scripts = mf.content_scripts[0].js;
function url(rel) { return "file://" + path.join(ROOT, rel); }

var tags = scripts
  .map(function (f) {
    var t = '<script src="' + url(f) + '"></script>';
    // Right after the adapters load, choose one — the page's own hostname
    // matches none of them, and every later module bails out without a site.
    if (f === "src/adapters.js") t += "<script>CALM.site = CALM.ADAPTERS.chatgpt;</script>";
    return t;
  })
  .join("\n");

var probe = function () {
  var out = { ok: false };
  try {
    CALM.modes.enter("autoscroll");
    var root = document.getElementById("cit-glide");
    var dial = root && root.querySelector(".cit-glide-dial");
    if (!dial) throw new Error("no bubble on the page");
    var r = dial.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    function what(x, y) {
      var e = document.elementFromPoint(x, y);
      if (!e) return "nothing";
      if (e.closest(".cit-glide-btn")) return "button";
      if (e.closest(".cit-glide-ring-hit")) return "ring";
      return (e.className && String(e.className)) || e.tagName;
    }
    out.size = Math.round(r.width) + "x" + Math.round(r.height);
    out.centre = what(cx, cy);
    out.nearCentre = what(cx + 12, cy); // still well inside the 40px button
    out.band = what(cx + r.width / 2 - 3, cy); // inside the outer ring band
    out.bandTop = what(cx, r.top + 3);
    var hit = root.querySelector(".cit-glide-ring-hit");
    var btn = root.querySelector(".cit-glide-btn");
    out.title = (hit && hit.getAttribute("title")) || "";
    out.btnTitle = (btn && btn.getAttribute("title")) || "";
    out.knob = !!root.querySelector(".cit-glide-knob");
    // Calm's own sans, not whatever the page underneath uses. This test page
    // sets no font at all, so an inherited font is the browser default serif
    // — the same fall-through that on ChatGPT means ChatGPT's typography.
    var chip = root.querySelector(".cit-glide-chip");
    out.font = chip ? getComputedStyle(chip).fontFamily : "";
    out.ok =
      out.centre === "button" && out.nearCentre === "button" &&
      out.band === "ring" && out.bandTop === "ring" &&
      /ring/i.test(out.title) && /double-tap/i.test(out.btnTitle) && out.knob &&
      /apple-system|BlinkMacSystemFont|sans-serif/.test(out.font);
  } catch (e) {
    out.error = e.message;
  }
  document.title = "GLIDE " + JSON.stringify(out);
};

var html =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<link rel="stylesheet" href="' + url("content.css") + '">' +
  "</head><body style=\"margin:0;height:3000px;background:#131417\">" +
  tags + "\n<script>(" + probe.toString() + ")();</script></body></html>";

var page = path.join(os.tmpdir(), "calm-glide-test.html");
fs.writeFileSync(page, html);

var dom = cp.execFileSync(
  CHROME,
  ["--headless=new", "--disable-gpu", "--window-size=900,700",
   "--virtual-time-budget=3000", "--dump-dom", "file://" + page],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
);
var m = dom.match(/<title>GLIDE ([^<]*)<\/title>/);
if (!m) {
  console.error("FAIL  the probe never reported — a script threw before it ran");
  process.exit(1);
}
var res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
function line(ok, name, detail) {
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (ok ? "" : "  " + (detail || "")));
}
if (res.error) {
  line(false, "the bubble opens", res.error);
  process.exit(1);
}
line(res.centre === "button", "a tap in the centre reaches the play/pause button", "hit: " + res.centre);
line(res.nearCentre === "button", "and so does a tap just off-centre", "hit: " + res.nearCentre);
line(res.band === "ring", "the outer band belongs to the speed ring (side)", "hit: " + res.band);
line(res.bandTop === "ring", "the outer band belongs to the speed ring (top)", "hit: " + res.bandTop);
line(/ring/i.test(res.title), "the ring tells you it can be dragged", "title: \"" + res.title + "\"");
line(/double-tap/i.test(res.btnTitle), "the button tells you what a double-tap does", "title: \"" + res.btnTitle + "\"");
line(res.knob, "the ring has a knob to take hold of");
line(/apple-system|BlinkMacSystemFont|sans-serif/.test(res.font),
  "the strip uses Calm's own font, not the host page's", "font: " + res.font);
console.log("\n" + (res.ok ? "bubble hit-testing OK (" + res.size + ")" : "bubble hit-testing BROKEN"));
process.exit(res.ok ? 0 : 1);
