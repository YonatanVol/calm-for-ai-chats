// End-to-end check of the Calm site and its demo in a real, headless Chrome.
//
//   npm run dev                          (in site/, serves http://localhost:5174)
//   npm run check:browser                everything, ~6 minutes
//   ONLY=keyboard,click npm run check:browser
//
// Sections: page (AA contrast from real pixels, reveals, overflow and console at
// 375/810/1280), preview, keyboard, click, reduced, touch, windows.
// Screenshots of each demo state land in SHOTS (default: a temp folder).
import { launch, sleep, MOD } from "./cdp.mjs";
import { contrast, OVERFLOW } from "./audit.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = process.env.SHOTS || mkdtempSync(join(tmpdir(), "calm-site-shots-"));
const URL = process.argv[2] || "http://localhost:5174/";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
let passed = 0, failed = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log("  PASS  " + name); }
  else { failed++; fails.push(name); console.log("  FAIL  " + name + (detail !== undefined ? "  " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : "")); }
}
const section = (t) => console.log("\n== " + t + " ==");

const Q = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const center = async (b, sel) => b.evaluate(`(() => { const e = ${Q(sel)}; if (!e) return null; e.scrollIntoView({block:'center', behavior:'instant'}); const r = e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
async function click(b, sel) {
  const c = await center(b, sel);
  if (!c) throw new Error("no element " + sel);
  await b.click(c.x, c.y);
  await sleep(120);
}
const btn = (label) => `(() => [...document.querySelectorAll('.demo button')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})))()`;
async function clickBtn(b, label) {
  const c = await b.evaluate(`(() => { const e = ${btn(label)}; if (!e) return null; e.scrollIntoView({block:'center', behavior:'instant'}); const r = e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  if (!c) throw new Error("no button " + label);
  await b.click(c.x, c.y);
  await sleep(150);
}
const snap = (b) => b.evaluate(`(() => {
  const d = document.querySelector('.demo');
  const side = d.querySelector('.demo-side'), app = d.querySelector('.demo-app');
  const col = [...d.querySelectorAll('.demo-collapse')];
  const input = d.querySelector('.demo-composer-input');
  const pal = d.querySelector('.demo-pal');
  const fr = d.querySelector('.demo-fr');
  const pomo = d.querySelector('.demo-pomo'), screen = d.querySelector('.demo-pomo-screen');
  return {
    zen: app.dataset.zen === 'true', headHidden: col[0].dataset.hidden === 'true', chipsHidden: col[1].dataset.hidden === 'true',
    composerHidden: col[2].dataset.hidden === 'true', composerInert: col[2].inert, inputValue: input.value,
    palette: !!pal, palQuery: pal ? pal.querySelector('input').value : null,
    palRows: pal ? [...pal.querySelectorAll('[role=option]')].map(r => r.textContent.replace(/\\s+/g,' ').trim()) : [],
    palSel: pal ? pal.querySelector('[aria-selected=true]')?.textContent.replace(/\\s+/g,' ').trim() : null,
    reader: !!fr, fixation: fr ? +fr.querySelector('input[type=range]').value : null,
    bold: fr ? [...fr.querySelectorAll('.demo-fx')].slice(0, 3).map(x => x.textContent) : [],
    timer: pomo ? pomo.querySelector('.demo-pomo-time').textContent : null, timerLabel: pomo ? pomo.querySelector('.demo-pomo-label').textContent : null,
    screen: !!screen, screenPhase: screen ? screen.querySelector('.demo-pomo-phase').textContent : null,
    stopBtn: !!d.querySelector('.demo-stop'), keycap: d.querySelector('.demo-keycap')?.textContent || null,
    live: d.querySelector('[role=status]').textContent.replace(/\\u200b/g, ''),
    active: document.activeElement === document.body ? 'body' : (document.activeElement.className || document.activeElement.tagName).toString().split(' ')[0],
    inDemo: d.contains(document.activeElement),
    pressed: Object.fromEntries([...d.querySelectorAll('.demo-controls button[aria-pressed]')].map(x => [(x.querySelector('span') || x).textContent.trim(), x.getAttribute('aria-pressed') === 'true'])),
  };
})()`);

// Record whether the page saw each shortcut as handled.
const LISTEN = `(() => { window.__keys = []; document.addEventListener('keydown', e => { const rec = { code: e.code, prevented: null }; window.__keys.push(rec); setTimeout(() => { rec.prevented = e.defaultPrevented; }, 0); }, true); return true; })()`;
const lastKey = (b) => b.evaluate(`window.__keys[window.__keys.length - 1]`);

async function press(b, key, code, mods = 0) {
  if (key === "Enter" && !(mods & 6)) { await b.key("keyDown", key, code, mods, "\r"); await b.key("keyUp", key, code, mods); }
  else await b.press(key, code, mods);
  await sleep(160);
}
const CMD = MOD.meta;

async function freshPage(b, { width = 1280, height = 900, mobile = false, reduced = false, touch = false } = {}) {
  await b.size(width, height, mobile);
  await b.send("Emulation.setTouchEmulationEnabled", touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await b.media(reduced ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await b.goto(URL, 900);
  await b.evaluate(LISTEN);
  await b.evaluate(`document.querySelector('.demo').scrollIntoView({ block: 'center', behavior: 'instant' }); true`);
  await sleep(1500);
}

async function stateContrast(b, label, width) {
  await sleep(700);
  const c = await contrast(b, { scope: ".demo" });
  check(`${width}px ${label}: every demo text passes AA (${c.count} lines measured)`, c.fails.length === 0,
    c.fails.slice(0, 4).map((f) => `${JSON.stringify(f.text)} ${f.fgHex} on ${f.bg} p10=${f.p10} need ${f.need}`).join(" | "));
  const o = await b.evaluate(OVERFLOW);
  check(`${width}px ${label}: no horizontal overflow`, o.scroll <= 0 && o.bodyScroll <= 0 && o.wide.length === 0, o);
  await sleep(450); // let colours settle after the contrast pass before the picture
  await b.shot(`${S}/v-${width}-${label.replace(/\W+/g, "-")}.png`, await b.evaluate(`(() => { const r = document.querySelector('.demo').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 8), width: innerWidth, height: r.height + 16 }; })()`));
}

const b = await launch();
console.log("screenshots:", S);
const run = async (name, fn) => { if (!ONLY || ONLY.includes(name)) await fn(); };
try {
  /* ------------------------------------------------------------ */
  await run("page", async () => {
    for (const w of [375, 810, 1280]) {
      section(`Whole page at ${w}px`);
      await b.size(w, 900, w < 768);
      await b.send("Emulation.setTouchEmulationEnabled", w < 768 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      await b.media([{ name: "prefers-reduced-motion", value: "no-preference" }]);
      const before = b.errors.length;
      await b.goto(URL, 900);
      // Take over the demo first, so the preview does not change the page under the measurement.
      await b.evaluate(`document.querySelector('.demo-stop')?.click(); true`);
      const c = await contrast(b, { fullPage: true });
      const reveal = await b.evaluate(`({ total: document.querySelectorAll('.reveal').length, shown: document.querySelectorAll('.reveal.reveal-in').length })`);
      check(`${w}px: scroll reveals all fired`, reveal.total > 40 && reveal.shown === reveal.total, reveal);
      check(`${w}px: every text on the page passes AA (${c.count} distinct lines)`, c.fails.length === 0,
        c.fails.slice(0, 5).map((f) => `${JSON.stringify(f.text)} ${f.fgHex} on ${f.bg} p10=${f.p10} need ${f.need}`).join(" | "));
      console.log("        tightest:", c.lowest.map((l) => `${JSON.stringify(l.text.slice(0, 24))} ${l.p10}/${l.need}`).join(" · "));
      const o = await b.evaluate(OVERFLOW);
      check(`${w}px: no horizontal overflow`, o.scroll <= 0 && o.bodyScroll <= 0 && o.wide.length === 0, o);
      check(`${w}px: no console errors or warnings`, b.errors.length === before, b.errors.slice(before));
    }
  });

  /* ------------------------------------------------------------ */
  await run("preview", async () => {
    section("Preview (autoplay) at 1280px");
    await freshPage(b);
    await sleep(2200);
    let s = await snap(b);
    check("preview starts on its own when the demo is on screen", s.stopBtn && (!!s.keycap || s.zen || s.composerHidden), s);
    let changed = false, announced = false, seen = new Set();
    for (let i = 0; i < 30; i++) {
      s = await snap(b);
      if (s.zen || s.composerHidden || s.palette || s.reader) changed = true;
      if (s.live) announced = true;
      if (s.zen) seen.add("zen"); if (s.composerHidden && !s.zen) seen.add("input"); if (s.palette) seen.add("palette"); if (s.reader) seen.add("reader"); if (s.timer) seen.add("timer");
      await sleep(900);
    }
    check("preview walks through Zen, input, palette, Focus Reader and the timer", ["zen", "input", "palette", "reader", "timer"].every((k) => seen.has(k)), [...seen]);
    check("preview changes the chat without announcing anything", changed && !announced);
    check("preview never moves focus into the demo", !s.inDemo, s.active);
    await stateContrast(b, "preview keycap", 1280);

    // Take over with a click on the chat.
    await click(b, ".demo-convo");
    await sleep(300);
    s = await snap(b);
    check("a click stops the preview and resets to a clean chat", !s.stopBtn && !s.keycap && !s.zen && !s.composerHidden && !s.palette && !s.reader && !s.timer, s);
    await sleep(3500);
    const s2 = await snap(b);
    check("…and it does not start again", !s2.stopBtn && !s2.zen && !s2.palette && !s2.reader && !s2.timer, s2);

    // Stop button, and a key, also take over.
    await freshPage(b);
    await sleep(2500);
    await click(b, ".demo-stop");
    s = await snap(b);
    check("the Stop preview button stops it", !s.stopBtn && !s.keycap, s);

    await freshPage(b);
    await sleep(1800);
    await b.evaluate(`document.querySelector('.demo-window').focus(); true`);
    await sleep(200);
    s = await snap(b);
    check("focusing the demo (Tab) stops the preview", !s.stopBtn, s);

    // Scrolled away: it resets; back on screen: it plays again.
    await freshPage(b);
    await sleep(4000);
    await b.evaluate(`scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); true`);
    await sleep(900);
    s = await snap(b);
    check("scrolling away stops the preview and resets the chat", !s.keycap && !s.zen && !s.palette && !s.reader, s);
    await b.evaluate(`document.querySelector('.demo').scrollIntoView({ block: 'center', behavior: 'instant' }); true`);
    let playing = false;
    for (let i = 0; i < 20 && !playing; i++) { await sleep(300); s = await snap(b); playing = s.stopBtn && (!!s.keycap || s.zen); }
    check("coming back plays it again", playing, s);
  });

  /* ------------------------------------------------------------ */
  await run("keyboard", async () => {
    section("Every path by keyboard at 1280px (Mac labels)");
    await freshPage(b);
    // Outside the demo: shortcuts must not be touched.
    await b.evaluate(`document.querySelector('h1').setAttribute('tabindex','-1'); document.querySelector('h1').focus(); true`);
    await press(b, "Z", "KeyZ", CMD | MOD.shift);
    let k = await lastKey(b); let s = await snap(b);
    check("⌘⇧Z outside the demo: not prevented, nothing happens", k && !k.prevented && !s.zen, { k, zen: s.zen });
    await press(b, "k", "KeyK", CMD);
    k = await lastKey(b); s = await snap(b);
    check("⌘K outside the demo: not prevented, no palette", k && !k.prevented && !s.palette, { k, palette: s.palette });

    await b.evaluate(`document.querySelector('.demo-window').focus(); true`);
    await sleep(200);
    s = await snap(b);
    check("focusing the window shows 'keys on'", (await b.evaluate(`document.querySelector('.demo-keys')?.textContent`)) === "keys on");

    // Zen
    await press(b, "Z", "KeyZ", CMD | MOD.shift);
    k = await lastKey(b); s = await snap(b);
    check("⌘⇧Z: Zen on — sidebar, header, chips and input hidden; key prevented", s.zen && s.headHidden && s.chipsHidden && s.composerHidden && k.prevented, { s, k });
    check("⌘⇧Z: announced", /^Zen on/.test(s.live), s.live);
    check("⌘⇧Z: control shows Zen pressed", s.pressed["Zen"] === true, s.pressed);
    await stateContrast(b, "zen", 1280);
    await press(b, "Z", "KeyZ", CMD | MOD.shift);
    s = await snap(b);
    check("⌘⇧Z again: everything back, input included", !s.zen && !s.headHidden && !s.composerHidden, s);

    // Input bar + type-ahead
    await press(b, "H", "KeyH", CMD | MOD.shift);
    s = await snap(b);
    check("⌘⇧H: input bar hidden and inert, announced", s.composerHidden && s.composerInert && /Input bar hidden/.test(s.live), s);
    await press(b, " ", "Space");
    s = await snap(b);
    check("Space while hidden stays a scroll key", s.composerHidden, s);
    await press(b, "H", "KeyH", 0);
    await press(b, "i", "KeyI", 0);
    s = await snap(b);
    check("typing while hidden brings the input back with the letters in it, focused", !s.composerHidden && s.inputValue === "Hi" && s.active === "demo-composer-input", s);
    await press(b, "H", "KeyH", CMD | MOD.shift);
    s = await snap(b);
    check("⌘⇧H from inside the input hides it and keeps focus in the demo", s.composerHidden && s.inDemo, s);
    await press(b, "H", "KeyH", CMD | MOD.shift);
    s = await snap(b);
    check("…so the next shortcut still works", !s.composerHidden, s);
    // Zen does not undo a hide I chose
    await b.evaluate(`document.querySelector('.demo-window').focus(); true`);
    await press(b, "H", "KeyH", CMD | MOD.shift);
    await press(b, "Z", "KeyZ", CMD | MOD.shift);
    await press(b, "Z", "KeyZ", CMD | MOD.shift);
    s = await snap(b);
    check("hide input, Zen on, Zen off: the input stays hidden (Zen gives back only what it hid)", s.composerHidden && !s.zen, s);
    await press(b, "Escape", "Escape");
    s = await snap(b);
    check("Esc with nothing open resets the demo", !s.composerHidden && /Demo reset/.test(s.live), s);

    // Palette
    await press(b, "k", "KeyK", CMD);
    k = await lastKey(b); s = await snap(b);
    check("⌘K: palette opens with focus in its search field; key prevented", s.palette && s.active === "demo-pal-input" && k.prevented, { s, k });
    check("⌘K: first rows are the extension's actions", s.palRows[0].startsWith("Toggle the input bar") && s.palRows.length === 8, s.palRows);
    await b.send("Input.insertText", { text: "zen" }); await sleep(200);
    s = await snap(b);
    check("typing filters: 'zen' → Zen first", s.palRows[0].startsWith("Zen"), s.palRows);
    await press(b, "ArrowDown", "ArrowDown"); s = await snap(b);
    const second = s.palSel;
    await press(b, "ArrowUp", "ArrowUp"); s = await snap(b);
    check("↓ and ↑ move the selection", second !== s.palSel && s.palSel.startsWith("Zen"), { second, now: s.palSel });
    await press(b, "Enter", "Enter"); s = await snap(b);
    check("Return runs Zen and closes the palette; focus returns to the demo", s.zen && !s.palette && s.inDemo, s);
    await press(b, "Z", "KeyZ", CMD | MOD.shift);

    await press(b, "k", "KeyK", CMD);
    await b.send("Input.insertText", { text: "fixation" }); await sleep(200);
    s = await snap(b);
    check("'fixation' → Reader Fixation 40", /^Reader Fixation\D*40/.test(s.palRows[0]), s.palRows);
    await press(b, "ArrowRight", "ArrowRight"); await press(b, "ArrowRight", "ArrowRight");
    s = await snap(b);
    check("→ → nudges it to 50 in place", /^Reader Fixation\D*50/.test(s.palRows[0]), s.palRows);
    await press(b, "ArrowLeft", "ArrowLeft"); s = await snap(b);
    check("← nudges it back to 45", /^Reader Fixation\D*45/.test(s.palRows[0]), s.palRows);
    await stateContrast(b, "palette", 1280);
    await press(b, "Enter", "Enter"); s = await snap(b);
    check("Return on a number row keeps the palette open", s.palette, s);
    await press(b, "Escape", "Escape"); s = await snap(b);
    check("Esc closes the palette and returns focus to the demo", !s.palette && s.inDemo, s);

    // Focus Reader via palette
    await press(b, "k", "KeyK", CMD);
    await b.send("Input.insertText", { text: "foc" }); await sleep(200);
    await press(b, "Enter", "Enter");
    s = await snap(b);
    check("palette 'foc' + Return opens Focus Reader with focus in it, announced", s.reader && s.active === "demo-fr" && /Focus Reader open/.test(s.live), s);
    check("fixation starts where the palette left it (45)", s.fixation === 45, s.fixation);
    const dirs = await b.evaluate(`[...document.querySelectorAll('.demo-fr-blk')].map(e => getComputedStyle(e).direction)`);
    check("each paragraph finds its own direction: the Hebrew one is right-to-left", dirs.join() === "ltr,ltr,rtl,ltr", dirs);
    const align = await b.evaluate(`[document.querySelectorAll('.demo-fr-blk')[2], document.querySelectorAll('.demo-answer p')[1]].map(p => { const r = document.createRange(); r.selectNodeContents(p); const lines = [...r.getClientRects()]; const box = p.getBoundingClientRect(); return Math.round(box.right - Math.max(...lines.map(l => l.right))); })`);
    check("…and lines up on the right, in Focus Reader and in the chat", align.every((gap) => gap <= 2), align);
    const fixSel = ".demo-fr input[type=range]";
    await b.evaluate(`${Q(fixSel)}.focus(); true`);
    await press(b, "End", "End"); s = await snap(b);
    const b60 = s.bold;
    await press(b, "Home", "Home"); s = await snap(b);
    const b20 = s.bold;
    check("fixation slider runs 20–60 and re-bolds live", s.fixation === 20 && b60.join() !== b20.join(), { b60, b20 });
    check("bold starts match the extension's rule (Too→'To' at 60%, 'T' at 20%)", b60[0] === "To" && b20[0] === "T", { b60, b20 });
    // Spotlight: Tab to it, Space, then ↓
    await b.evaluate(`[...document.querySelectorAll('.demo-fr-btn')].find(x => x.textContent === 'Spotlight').focus(); true`);
    await press(b, " ", "Space");
    await b.evaluate(`document.querySelector('.demo-fr').focus(); true`);
    await press(b, "ArrowDown", "ArrowDown");
    const on = await b.evaluate(`[...document.querySelectorAll('.demo-fr-blk')].findIndex(e => e.classList.contains('is-on'))`);
    check("Spotlight on, ↓ walks to the next block", on === 1, on);
    await stateContrast(b, "reader spotlight", 1280);
    await press(b, "Escape", "Escape"); s = await snap(b);
    check("Esc closes Focus Reader, focus back in the demo", !s.reader && s.inDemo, s);

    // Timer by keyboard
    await b.evaluate(`[...document.querySelectorAll('.demo-ctl-preset')].find(x => x.textContent === '25/5').focus(); true`);
    await press(b, "Enter", "Enter");
    s = await snap(b);
    check("preset 25/5 by keyboard: timer at 25:00, Focus, Zen on by itself, announced", s.timer === "25:00" && s.timerLabel === "Focus" && s.zen && /Classic 25\/5/.test(s.live), s);
    await sleep(2300); s = await snap(b);
    check("the clock runs in real seconds", s.timer === "24:58" || s.timer === "24:57", s.timer);
    await b.evaluate(`document.querySelector('.demo-pomo').focus(); true`);
    await press(b, "Enter", "Enter"); s = await snap(b);
    check("Return on the widget expands the full timer, focus on Pause", s.screen && s.active === "demo-pomo-btn", s);
    await stateContrast(b, "timer focus", 1280);
    await press(b, "Escape", "Escape"); s = await snap(b);
    check("Esc minimises the timer screen; the block keeps running", !s.screen && !!s.timer, s);
    await press(b, "Escape", "Escape"); s = await snap(b);
    check("Esc again resets: timer stopped, Zen returned", !s.timer && !s.zen, s);
    const kEsc = await b.evaluate(`(() => { document.querySelector('.demo-window').focus(); const e = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }); document.querySelector('.demo-window').dispatchEvent(e); return e.defaultPrevented; })()`);
    check("Esc with nothing open is left alone (not prevented)", kEsc === false);
  });

  /* ------------------------------------------------------------ */
  await run("click", async () => {
    section("Every path by clicking at 1280px");
    await freshPage(b);
    await clickBtn(b, "Command palette");
    let s = await snap(b);
    check("click Command palette: opens, control pressed", s.palette && s.pressed["Command palette"] === true, s);
    await b.evaluate(`(() => { const r = [...document.querySelectorAll('.demo-pal-row')].find(x => x.textContent.startsWith('Zen')); r.scrollIntoView({block:'nearest'}); return true; })()`);
    const zr = await b.evaluate(`(() => { const r = [...document.querySelectorAll('.demo-pal-row')].find(x => x.textContent.startsWith('Zen')).getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    await b.click(zr.x, zr.y); await sleep(250);
    s = await snap(b);
    check("click the Zen row: Zen on, palette closed", s.zen && !s.palette, s);
    await clickBtn(b, "Zen"); s = await snap(b);
    check("click Zen: off", !s.zen && !s.composerHidden, s);
    await clickBtn(b, "Hide input"); s = await snap(b);
    check("click Hide input: hidden, pressed", s.composerHidden && s.pressed["Hide input"] === true, s);
    await clickBtn(b, "Hide input"); s = await snap(b);
    check("click again: shown", !s.composerHidden, s);
    await clickBtn(b, "Command palette");
    await sleep(200);
    const bd = await b.evaluate(`(() => { const r = document.querySelector('.demo-pal').getBoundingClientRect(); return { x: r.left + 12, y: r.bottom - 12 }; })()`);
    await b.click(bd.x, bd.y); await sleep(200); s = await snap(b);
    check("click outside the palette box closes it", !s.palette, s);
    await clickBtn(b, "Focus Reader"); s = await snap(b);
    check("click Focus Reader: open", s.reader, s);
    await b.evaluate(`[...document.querySelectorAll('.demo-fr-btn')].find(x => x.textContent === 'Bionic').click(); true`); await sleep(150);
    s = await snap(b);
    check("click Bionic: fixation off (no bold starts)", s.bold.length === 0, s.bold);
    await b.evaluate(`[...document.querySelectorAll('.demo-fr-btn')].find(x => x.textContent === 'Ease').click(); true`); await sleep(150);
    const ease = await b.evaluate(`getComputedStyle(document.querySelector('.demo-fr-body')).letterSpacing`);
    check("click Ease: wider letter spacing", ease !== "normal" && parseFloat(ease) > 0, ease);
    await click(b, ".demo-fr-ic"); s = await snap(b);
    check("click ✕: Focus Reader closed", !s.reader, s);
    await clickBtn(b, "10/2"); s = await snap(b);
    check("click 10/2: 10:00 focus block, Zen on", s.timer === "10:00" && s.zen && s.pressed["10/2"] === true, s);
    await click(b, ".demo-pomo"); s = await snap(b);
    check("click the widget: full timer", s.screen && s.screenPhase === "Focus", s);
    await clickBtn(b, "Skip"); await sleep(300); s = await snap(b);
    check("click Skip: break of 2:00, Zen released, screen stays", s.screen && s.screenPhase === "Break" && !s.zen, s);
    await stateContrast(b, "timer break", 1280);
    await clickBtn(b, "Minimize"); s = await snap(b);
    check("click Minimize: widget shows Break", !s.screen && s.timerLabel === "Break", s);
    await clickBtn(b, "End timer"); s = await snap(b);
    check("click End timer: stopped", !s.timer, s);
    await click(b, ".demo-send"); await sleep(300); s = await snap(b);
    const note = await b.evaluate(`getComputedStyle(document.querySelector('.demo-sent')).opacity`);
    check("click send: says nothing is sent (visible and announced)", note === "1" && /Nothing is sent/.test(s.live), { note, live: s.live });
    await stateContrast(b, "sent note", 1280);
    const brand = await b.evaluate(`document.querySelector('.demo').innerText`);
    check("the demo names no chat service", !/chatgpt|gemini|claude|openai|anthropic|google|copilot/i.test(brand), brand.match(/chatgpt|gemini|claude|openai|anthropic|google|copilot/i));
  });

  /* ------------------------------------------------------------ */
  await run("reduced", async () => {
    section("prefers-reduced-motion at 1280px");
    await freshPage(b, { reduced: true });
    await sleep(3000);
    let s = await snap(b);
    check("no preview: no Stop button, no keycap, chat untouched", !s.stopBtn && !s.keycap && !s.zen && !s.palette && !s.reader && !s.timer, s);
    await clickBtn(b, "Zen"); s = await snap(b);
    check("controls still work", s.zen, s);
    const tr = await b.evaluate(`getComputedStyle(document.querySelector('.demo-collapse')).transitionDuration`);
    check("no transitions inside the demo", /^0s/.test(tr), tr);
  });

  /* ------------------------------------------------------------ */
  await run("touch", async () => {
    for (const w of [375, 810]) {
      section(`Touch at ${w}px`);
      await freshPage(b, { width: w, height: w < 768 ? 812 : 1024, mobile: w < 768, touch: true });
      await click(b, ".demo-stop");
      const env = await b.evaluate(`({ coarse: matchMedia('(hover: none) and (pointer: coarse)').matches, hint: document.querySelector('.demo-hint').textContent, kbd: getComputedStyle(document.querySelector('.demo-ctl-kbd')).display })`);
      check(`${w}px touch: hint says to tap, no key labels on the buttons`, env.coarse && /tap the buttons/.test(env.hint) && env.kbd === "none", env);
      await stateContrast(b, "touch idle", w);
      await clickBtn(b, "Zen"); await stateContrast(b, "touch zen", w);
      let s = await snap(b);
      check(`${w}px: tap Zen works`, s.zen, s);
      await clickBtn(b, "Zen");
      await clickBtn(b, "Command palette");
      await b.evaluate(`(() => { const inp = document.querySelector('.demo-pal-input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, 'size'); inp.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(200);
      const plus = await b.evaluate(`getComputedStyle(document.querySelector('.demo-pal-nudge')).display`);
      await b.evaluate(`document.querySelectorAll('.demo-pal-nudge')[1].click(); true`); await sleep(150);
      s = await snap(b);
      check(`${w}px: a number row offers − and + on touch, and + nudges`, plus !== "none" && /^Reader Size\D*19/.test(s.palRows[0]), { plus, rows: s.palRows });
      await stateContrast(b, "touch palette", w);
      await clickBtn(b, "Command palette");
      await clickBtn(b, "Focus Reader"); await stateContrast(b, "touch reader", w);
      await clickBtn(b, "Focus Reader");
      await clickBtn(b, "52/17");
      const t52 = await snap(b);
      check(`${w}px: tap 52/17 starts a 52:00 block`, t52.timer === "52:00", t52);
      await click(b, ".demo-pomo"); await stateContrast(b, "touch timer", w);
      s = await snap(b);
      check(`${w}px: tap preset + widget opens the timer`, s.screen && s.timer === null, s);
    }
  });

  /* ------------------------------------------------------------ */
  await run("windows", async () => {
    section("Windows labels");
    await b.send("Emulation.setUserAgentOverride", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      platform: "Win32",
      userAgentMetadata: { brands: [{ brand: "Chromium", version: "140" }], fullVersion: "140.0.0.0", platform: "Windows", platformVersion: "10.0.0", architecture: "x86", model: "", mobile: false },
    });
    await freshPage(b);
    const labels = await b.evaluate(`({
      hint: document.querySelector('.demo-hint').textContent,
      kbds: [...document.querySelectorAll('.demo-ctl-kbd')].map(k => k.textContent),
      aria: [...document.querySelectorAll('.demo-ctl[aria-keyshortcuts]')].map(k => k.getAttribute('aria-keyshortcuts')),
      shortcuts: [...document.querySelectorAll('#shortcuts kbd')].map(k => k.textContent),
      note: [...document.querySelectorAll('#shortcuts p')].map(p => p.textContent).join(' | '),
      install: document.querySelector('#install ol').textContent.includes('Ctrl+K'),
      mac: /⌘/.test(document.body.innerText.replace(/Ctrl works in place of ⌘ too\\.|On a Mac, ⌘ works in place of Ctrl\\./, '')),
    })`);
    check("Windows: Ctrl everywhere, no ⌘ left on the page", /Ctrl\+K/.test(labels.hint) && labels.kbds.join() === "Ctrl+K,Ctrl+Shift+Z,Ctrl+Shift+H" && labels.shortcuts[0] === "Ctrl+K" && labels.install && !labels.mac, labels);
    check("Windows: aria-keyshortcuts use Control", labels.aria.join() === "Control+K,Control+Shift+Z,Control+Shift+H", labels.aria);
    check("Windows: the note points Mac users to ⌘", /On a Mac, ⌘ works in place of Ctrl/.test(labels.note), labels.note);
    await b.evaluate(`document.querySelector('.demo-window').focus(); true`);
    await press(b, "Z", "KeyZ", MOD.ctrl | MOD.shift);
    await press(b, "k", "KeyK", MOD.ctrl);
    const s = await snap(b);
    check("Windows: Ctrl+Shift+Z and Ctrl+K work", s.zen && s.palette, s);
    const hint = await b.evaluate(`[...document.querySelectorAll('.demo-pal-row')][0].textContent`);
    check("Windows: palette hints read Ctrl+Shift+H", /Ctrl\+Shift\+H/.test(hint), hint);
    await b.send("Emulation.setUserAgentOverride", { userAgent: "" });
  });

  console.log("\nconsole errors/warnings overall:", b.errors.length ? b.errors : "none");
} catch (e) {
  failed++; console.log("  CRASH " + e.stack);
} finally {
  await b.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (fails.length) console.log("failed:\n - " + fails.join("\n - "));
  process.exit(failed ? 1 : 0);
}
