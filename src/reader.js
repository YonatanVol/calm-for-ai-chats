/* ===== Calm — src/reader.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * The Focus Reader — Calm's own reading surface. It lifts the latest
 * assistant response out of the noisy chat DOM and re-renders it in a quiet,
 * full-screen graphite pane that WE own, so typography, bionic fixation,
 * spotlight and RTL never fight the host framework.
 *
 * Privacy: everything happens locally in this tab. The text is cloned,
 * sanitized (all attributes stripped except safe link hrefs), rendered, and
 * discarded when the pane closes. Nothing is stored, logged, or sent.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;
  var S = CALM.settings;
  var IDS = CALM.IDS;

  // Tags dropped wholesale during sanitization. Matched case-insensitively:
  // SVG/MathML elements keep lowercase tagName (foreign namespaces), so an
  // uppercase-only lookup would silently let them through.
  var DROP = {
    SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, BUTTON: 1, INPUT: 1, SELECT: 1,
    TEXTAREA: 1, SVG: 1, IMG: 1, PICTURE: 1, VIDEO: 1, AUDIO: 1, IFRAME: 1,
    CANVAS: 1, FORM: 1, NAV: 1, DIALOG: 1, OBJECT: 1, EMBED: 1, APPLET: 1,
    TEMPLATE: 1, MATH: 1, BASE: 1, SOURCE: 1, TRACK: 1, AREA: 1, MAP: 1,
    SLOT: 1, PORTAL: 1,
  };
  var BLOCKS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, PRE: 1, BLOCKQUOTE: 1, TABLE: 1, DIV: 1, HR: 1 };

  var cleanRoot = null; // sanitized, pre-bionic copy of the response
  var keyHandler = null;
  var curBlock = -1;

  // ---------- Extraction + sanitization ----------
  function latestResponse() {
    var sel = CALM.site.responseSel;
    if (!sel) return null;
    var els = document.querySelectorAll(sel);
    return els.length ? els[els.length - 1] : null;
  }

  function safeHref(v) {
    return /^https?:\/\//i.test(v || "") ? v : null;
  }

  function sanitize(node) {
    // Walk a detached clone: drop noise wholesale, strip every attribute
    // (site classes, handlers, tracking data) except a vetted link href.
    var clone = node.cloneNode(true);
    // KaTeX pre-pass: attribute stripping would shred rendered math into
    // duplicated glyph soup, so swap each formula for its TeX source.
    Array.prototype.slice
      .call(clone.querySelectorAll ? clone.querySelectorAll(".katex") : [])
      .forEach(function (k) {
        var ann = k.querySelector('annotation[encoding="application/x-tex"]');
        var code = document.createElement("code");
        code.textContent = ann ? ann.textContent : k.textContent;
        if (k.parentNode) k.parentNode.replaceChild(code, k);
      });
    (function scrub(el) {
      var kids = Array.prototype.slice.call(el.children || []);
      kids.forEach(function (ch) {
        if (DROP[String(ch.tagName).toUpperCase()]) {
          ch.remove();
          return;
        }
        scrub(ch);
      });
      if (el.attributes) {
        for (var i = el.attributes.length - 1; i >= 0; i--) {
          var name = el.attributes[i].name;
          if (el.tagName === "A" && name === "href") continue;
          el.removeAttribute(name);
        }
      }
      if (el.tagName === "A") {
        var href = safeHref(el.getAttribute("href"));
        if (href) {
          el.setAttribute("href", href);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        } else {
          el.removeAttribute("href");
        }
      }
    })(clone);
    return clone;
  }

  // ---------- Bionic fixation ----------
  // Bold the first portion of each word so the eye has an anchor per word.
  function boldCount(len, frac) {
    if (len <= 1) return 1;
    return Math.max(1, Math.min(len - 1, Math.round(len * frac)));
  }

  // Never cut inside a surrogate pair or before combining marks (Hebrew
  // niqqud/cantillation, Arabic harakat) — the bold boundary would otherwise
  // split a single visible glyph across two elements.
  function safeCut(tok, cut) {
    var c = tok.charCodeAt(cut - 1);
    if (c >= 0xd800 && c <= 0xdbff) cut++; // high surrogate: keep the pair
    while (cut < tok.length) {
      var n = tok.charCodeAt(cut);
      var combining =
        (n >= 0x0300 && n <= 0x036f) || (n >= 0x0591 && n <= 0x05c7) ||
        (n >= 0x0610 && n <= 0x065f) || (n >= 0xdc00 && n <= 0xdfff);
      if (!combining) break;
      cut++;
    }
    return Math.min(cut, tok.length);
  }

  function applyBionic(root, frac) {
    (function walk(el) {
      if (el.tagName === "PRE" || el.tagName === "CODE") return; // never fixate code
      var kids = Array.prototype.slice.call(el.childNodes || []);
      kids.forEach(function (n) {
        if (n.nodeType === 1) {
          walk(n);
          return;
        }
        if (n.nodeType !== 3 || !/\S/.test(n.textContent)) return;
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (/^\s+$/.test(tok)) {
            frag.appendChild(document.createTextNode(tok));
            return;
          }
          var b = document.createElement("b");
          b.className = "cit-fx";
          var cut = safeCut(tok, boldCount(tok.length, frac));
          b.textContent = tok.slice(0, cut);
          frag.appendChild(b);
          frag.appendChild(document.createTextNode(tok.slice(cut)));
        });
        el.replaceChild(frag, n);
      });
    })(root);
  }

  // ---------- Rendering ----------
  function paneEl() {
    return document.getElementById(IDS.readerPane);
  }

  function setVars() {
    var p = paneEl();
    if (!p) return;
    p.style.setProperty("--cit-fr-size", (S.frSize | 0) + "px");
    p.classList.toggle("cit-fr-ease", !!S.frEase);
    p.classList.toggle("cit-fr-spot", !!S.frSpotlight);
  }

  function blocks() {
    var body = paneEl() && paneEl().querySelector(".cit-fr-body");
    return body ? Array.prototype.slice.call(body.children) : [];
  }

  function setCur(i) {
    var bs = blocks();
    if (!bs.length) return;
    curBlock = Math.max(0, Math.min(bs.length - 1, i));
    bs.forEach(function (b, j) {
      b.classList.toggle("cit-blk-on", j === curBlock);
    });
  }

  function render() {
    var p = paneEl();
    if (!p) return;
    var body = p.querySelector(".cit-fr-body");
    if (!body) return;
    body.innerHTML = "";
    if (!cleanRoot) {
      var empty = document.createElement("div");
      empty.className = "cit-fr-empty";
      var msg = document.createElement("p");
      msg.textContent = "Nothing to read yet. Ask something, then refresh.";
      var again = document.createElement("button");
      again.type = "button";
      again.className = "cit-fr-btn";
      again.textContent = "Refresh";
      again.addEventListener("click", function (e) {
        e.stopPropagation();
        load();
      });
      empty.appendChild(msg);
      empty.appendChild(again);
      body.appendChild(empty);
      return;
    }
    var content = cleanRoot.cloneNode(true);
    if (S.frBionic) applyBionic(content, (S.frFixation | 0) / 100 || 0.4);
    // Adopt the response's top-level children as our reading blocks; loose
    // text becomes a paragraph. dir=auto gives per-paragraph bidi (RTL-safe).
    var kids = Array.prototype.slice.call(content.childNodes);
    kids.forEach(function (n) {
      var blk;
      if (n.nodeType === 3) {
        if (!/\S/.test(n.textContent)) return;
        blk = document.createElement("p");
        blk.appendChild(n);
      } else if (n.nodeType === 1) {
        blk = n;
      } else {
        return;
      }
      blk.classList.add("cit-blk");
      blk.setAttribute("dir", "auto");
      body.appendChild(blk);
    });
    if (!body.children.length) {
      // Response had structure we dropped entirely — fall back to its text.
      var ptext = document.createElement("p");
      ptext.className = "cit-blk";
      ptext.setAttribute("dir", "auto");
      ptext.textContent = cleanRoot.textContent || "";
      body.appendChild(ptext);
    }
    setVars();
    if (S.frSpotlight) setCur(0);
  }

  function load() {
    var src = latestResponse();
    cleanRoot = src ? sanitize(src) : null;
    render();
  }

  // ---------- Chrome ----------
  function chip(label, isOn, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cit-fr-btn" + (isOn() ? " cit-active" : "");
    b.textContent = label;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick();
      b.classList.toggle("cit-active", isOn());
      CALM.saveSettings();
    });
    return b;
  }

  function slider(min, max, get, set, title) {
    var r = document.createElement("input");
    r.type = "range";
    r.min = String(min);
    r.max = String(max);
    r.value = String(get());
    r.className = "cit-fr-range";
    r.title = title;
    r.setAttribute("aria-label", title);
    r.addEventListener("input", function (e) {
      e.stopPropagation();
      set(parseInt(r.value, 10));
      CALM.saveSettings();
    });
    return r;
  }

  function build() {
    close();
    var p = document.createElement("div");
    p.id = IDS.readerPane;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Focus Reader");
    p.setAttribute("tabindex", "-1");

    var bar = document.createElement("div");
    bar.className = "cit-fr-bar";
    var brand = document.createElement("span");
    brand.className = "cit-fr-brand";
    brand.textContent = "Focus Reader";
    bar.appendChild(brand);

    var tools = document.createElement("div");
    tools.className = "cit-fr-tools";
    tools.appendChild(chip("Bionic", function () { return !!S.frBionic; }, function () {
      S.frBionic = !S.frBionic;
      render();
    }));
    tools.appendChild(slider(20, 60, function () { return S.frFixation | 0; }, function (v) {
      S.frFixation = v;
      if (S.frBionic) render();
    }, "Fixation strength"));
    tools.appendChild(slider(15, 26, function () { return S.frSize | 0; }, function (v) {
      S.frSize = v;
      setVars();
    }, "Text size"));
    tools.appendChild(chip("Ease", function () { return !!S.frEase; }, function () {
      S.frEase = !S.frEase;
      setVars();
    }));
    tools.appendChild(chip("Spotlight", function () { return !!S.frSpotlight; }, function () {
      S.frSpotlight = !S.frSpotlight;
      setVars();
      if (S.frSpotlight) setCur(curBlock < 0 ? 0 : curBlock);
    }));
    var refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "cit-fr-ic";
    refresh.title = "Read the latest response";
    refresh.setAttribute("aria-label", "Refresh");
    refresh.innerHTML = CALM.icons.refresh;
    refresh.addEventListener("click", function (e) {
      e.stopPropagation();
      load();
    });
    tools.appendChild(refresh);
    var x = document.createElement("button");
    x.type = "button";
    x.className = "cit-fr-ic";
    x.title = "Close (Esc)";
    x.setAttribute("aria-label", "Close");
    x.innerHTML = CALM.icons.close;
    x.addEventListener("click", function (e) {
      e.stopPropagation();
      CALM.modes.exit("focusreader");
    });
    tools.appendChild(x);
    bar.appendChild(tools);
    p.appendChild(bar);

    var body = document.createElement("div");
    body.className = "cit-fr-body";
    body.addEventListener("mouseover", function (e) {
      if (!S.frSpotlight) return;
      var t = e.target;
      while (t && t !== body && !(t.classList && t.classList.contains("cit-blk"))) {
        t = t.parentElement;
      }
      if (t && t !== body) setCur(blocks().indexOf(t));
    });
    p.appendChild(body);
    document.body.appendChild(p);
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      CALM.modes.exit("focusreader");
      return;
    }
    if (!S.frSpotlight) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setCur(curBlock + (e.key === "ArrowDown" ? 1 : -1));
      var on = blocks()[curBlock];
      if (on && on.scrollIntoView) on.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function open() {
    build();
    curBlock = -1;
    load();
    setVars();
    var p = paneEl();
    if (p && p.focus) p.focus(); // keyboard scroll/Esc belong to the pane
    keyHandler = onKey;
    document.addEventListener("keydown", keyHandler, true);
  }

  function close() {
    var p = paneEl();
    if (p) p.remove();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
    cleanRoot = null;
  }

  CALM.reader = {
    open: open,
    close: close,
    refresh: load,
    _boldCount: boldCount, // exposed for the harness
  };
})();
