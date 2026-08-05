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

  // ALLOWLIST, not a denylist. A denylist has to enumerate every dangerous tag
  // forever — NOSCRIPT, FRAMESET, PLAINTEXT, FENCEDFRAME, whatever HTML adds
  // next — and anything it forgets sails through. Here the default is "not
  // trusted": an unknown tag is unwrapped (its text kept), never adopted.
  // That also means we never re-adopt a host CUSTOM ELEMENT — cloning one back
  // into the document could run the page framework's own constructor inside
  // our pane, after sanitizing.
  var KEEP = {
    P: 1, DIV: 1, SPAN: 1, BR: 1, HR: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    UL: 1, OL: 1, LI: 1, DL: 1, DT: 1, DD: 1,
    PRE: 1, CODE: 1, BLOCKQUOTE: 1, FIGURE: 1, FIGCAPTION: 1,
    TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TH: 1, TD: 1, CAPTION: 1,
    A: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, DEL: 1, INS: 1,
    MARK: 1, SMALL: 1, SUB: 1, SUP: 1, ABBR: 1, KBD: 1, SAMP: 1, VAR: 1, Q: 1,
  };
  // Unwrapping these would leak their contents as visible text — their child
  // text IS markup or code.
  var DROP_ENTIRELY = {
    SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, IFRAME: 1, OBJECT: 1,
    EMBED: 1, FRAME: 1, FRAMESET: 1, PLAINTEXT: 1, XMP: 1, LISTING: 1,
    HEAD: 1, TITLE: 1, SELECT: 1, OPTION: 1, TEXTAREA: 1, BUTTON: 1,
  };

  var cleanRoot = null; // sanitized, pre-bionic copy of the response
  var keyHandler = null;
  var unEsc = null;
  var curBlock = -1;

  // ---------- Extraction + sanitization ----------
  function latestResponse() {
    var sel = CALM.site.responseSel;
    if (!sel) return null;
    var els = document.querySelectorAll(sel);
    return els.length ? els[els.length - 1] : null;
  }

  function safeHref(v) {
    // Strip control characters and whitespace before testing: "java\tscript:"
    // and a leading newline both slip past a naive prefix check.
    var clean = String(v || "").replace(/[\u0000-\u0020\u007f]/g, "");
    return /^https?:\/\/[^\s]/i.test(clean) ? clean : null;
  }

  // Rebuild rather than clone-and-strip: walk the source and construct fresh
  // elements that we own. Nothing from the host survives except allowed tag
  // names, the text, and vetted link hrefs.
  function sanitize(node) {
    var out = document.createElement("div");
    (function copy(src, dest) {
      var kids = src.childNodes ? Array.prototype.slice.call(src.childNodes) : [];
      kids.forEach(function (n) {
        if (n.nodeType === 3) {
          dest.appendChild(document.createTextNode(n.textContent));
          return;
        }
        if (n.nodeType !== 1) return;
        var tag = String(n.tagName || "").toUpperCase();
        // Rendered maths: keep the TeX source, not the glyph soup KaTeX emits.
        if (n.classList && n.classList.contains && n.classList.contains("katex")) {
          var ann = n.querySelector &&
            n.querySelector('annotation[encoding="application/x-tex"]');
          var code = document.createElement("code");
          code.textContent = ann ? ann.textContent : n.textContent;
          dest.appendChild(code);
          return;
        }
        if (DROP_ENTIRELY[tag]) return;
        if (!Object.prototype.hasOwnProperty.call(KEEP, tag)) {
          copy(n, dest); // unknown tag: unwrap, keep the words
          return;
        }
        var kid = document.createElement(tag);
        if (tag === "A") {
          var href = safeHref(n.getAttribute && n.getAttribute("href"));
          if (href) {
            kid.setAttribute("href", href);
            kid.setAttribute("target", "_blank");
            kid.setAttribute("rel", "noopener noreferrer");
          }
        }
        dest.appendChild(kid);
        copy(n, kid);
      });
    })(node, out);
    return out;
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

  var lastSeen = "";   // fingerprint of what we last rendered
  var followTimer = null;

  function load() {
    var src = latestResponse();
    lastSeen = src ? (src.textContent || "") : "";
    cleanRoot = src ? sanitize(src) : null;
    render();
  }

  // Answers arrive a word at a time. Opening the pane mid-stream used to
  // freeze whatever had been written so far, with no sign that more was
  // coming — you had to guess that the Refresh button existed. While the pane
  // is open, follow the source: re-render only when the text actually changed,
  // and keep the reading position rather than snapping back to the top.
  function follow() {
    if (!paneEl()) return;
    var src = latestResponse();
    var now = src ? src.textContent || "" : "";
    if (now === lastSeen) return;
    var pane = paneEl();
    var wasAtTop = !pane.scrollTop;
    var prevBlock = curBlock;
    load();
    if (!wasAtTop && pane.scrollTop === 0 && prevBlock >= 0) setCur(prevBlock);
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
    if (e.key === "Escape") return; // the shared Escape handler owns this
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
    clearInterval(followTimer);
    followTimer = setInterval(follow, 700);
    if (!unEsc && CALM.ui.registerEscape) {
      unEsc = CALM.ui.registerEscape(function () {
        if (!paneEl()) return false;
        CALM.modes.exit("focusreader");
        return true;
      });
    }
  }

  function close() {
    var p = paneEl();
    if (p) p.remove();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
    if (unEsc) { unEsc(); unEsc = null; }
    clearInterval(followTimer);
    followTimer = null;
    lastSeen = "";
    cleanRoot = null;
  }

  CALM.reader = {
    open: open,
    // Lets the palette and presets change frSize/frEase/frSpotlight/frBionic
    // from outside the pane and have the open pane actually reflect it.
    refreshVars: function () {
      if (!paneEl()) return;
      setVars();
      render();
    },
    close: close,
    refresh: load,
    _boldCount: boldCount, // exposed for the harness
    _sanitize: sanitize, // the one security-critical function — must be testable
    _follow: follow,
  };
})();
