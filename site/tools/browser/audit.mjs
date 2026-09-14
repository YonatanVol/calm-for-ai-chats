// Pixel-measured WCAG contrast: text colour from the DOM, background from the
// actual rendered pixels under each line with all text made transparent.
// This sees gradients, scrims and translucent panels a DOM walk cannot.
import { decodePNG } from "./png.mjs";
import { sleep } from "./cdp.mjs";

const COLLECT = (scope) => `(() => {
  const scopeEl = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : "document.body"};
  const H = innerHeight, W = document.documentElement.clientWidth;
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = 'rgba(0,0,0,0)'; cv.fillStyle = c; cv.fillRect(0,0,1,1); const d = cv.getImageData(0,0,1,1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const parse = (c) => { const m = c.match(/^rgba?\\(([^)]+)\\)$/); if (!m) return rgba(c); const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const items = [];
  const push = (el, rect, color, text) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') return;
    const x = Math.max(0, rect.left), y = Math.max(0, rect.top);
    const r = Math.min(W, rect.right), b = Math.min(H, rect.bottom);
    if (r - x < 2 || b - y < 2) return;
    if (rect.top < -1 || rect.bottom > H + 1) return; // only lines fully on screen
    const op = opacityOf(el); if (op < 0.1) return;
    // Covered anywhere — by an overlay, or by the fixed nav it is scrolling under — is not measured here.
    const pts = [[(x + r) / 2, (y + b) / 2], [x + 1.5, y + 1.5], [r - 1.5, y + 1.5], [x + 1.5, b - 1.5], [r - 1.5, b - 1.5]];
    for (const [px, py] of pts) {
      const hit = document.elementFromPoint(px, py);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) return;
    }
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    items.push({ x, y, w: r - x, h: b - y, fg: parse(color), op, large: size >= 24 || (weight >= 700 && size >= 18.66), size, weight, text: text.trim().slice(0, 48), where: (el.closest('[class]')?.className || el.tagName).toString().split(' ')[0] });
  };
  const tw = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const t = tw.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || el.closest('script,style,.sr-only')) continue;
    const range = document.createRange(); range.selectNodeContents(t);
    for (const rect of range.getClientRects()) push(el, rect, getComputedStyle(el).color, t.textContent);
  }
  scopeEl.querySelectorAll('input[type=text], input:not([type]), textarea').forEach((inp) => {
    const rect = inp.getBoundingClientRect();
    if (inp.value) push(inp, rect, getComputedStyle(inp).color, inp.value);
    else if (inp.placeholder) push(inp, rect, getComputedStyle(inp, '::placeholder').color, inp.placeholder);
  });
  return items;
})()`;

const HIDE = `(() => { const s = document.createElement('style'); s.id = '__audit_hide';
  s.textContent = '*, *::before, *::after, *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; transition: none !important; animation-play-state: paused !important; }';
  document.head.appendChild(s); return true; })()`;
const UNHIDE = `(() => { document.getElementById('__audit_hide')?.remove(); return true; })()`;
const PE_ON = `(() => { const s = document.createElement('style'); s.id='__audit_pe'; s.textContent='* { pointer-events: auto !important; }'; document.head.appendChild(s); return true; })()`;
const PE_OFF = `(() => { document.getElementById('__audit_pe')?.remove(); return true; })()`;

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

async function measureViewport(b, scope) {
  // Never measure mid-transition: wait until nothing is animating (infinite
  // animations, like the timer's breathing ring, never finish, so skip those).
  await b.evaluate(`new Promise(r => { const t0 = performance.now(); (function wait() { const busy = document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity && a.playState === "running"); if (!busy.length || performance.now() - t0 > 4000) r(true); else setTimeout(wait, 50); })(); })`);
  await b.evaluate(PE_ON);
  const items = await b.evaluate(COLLECT(scope));
  await b.evaluate(PE_OFF);
  await b.evaluate(HIDE);
  await sleep(120);
  const shot = await b.send("Page.captureScreenshot", { format: "png" });
  await b.evaluate(UNHIDE);
  const img = decodePNG(Buffer.from(shot.data, "base64"));
  const dpr = img.width / (await b.evaluate("document.documentElement.clientWidth"));
  return items.map((it) => {
    const ratios = [];
    let bgSum = { r: 0, g: 0, b: 0 }, n = 0;
    const x0 = Math.floor((it.x + 1) * dpr), x1 = Math.floor((it.x + it.w - 1) * dpr);
    const y0 = Math.floor((it.y + 1) * dpr), y1 = Math.floor((it.y + it.h - 1) * dpr);
    const sx = Math.max(1, Math.floor((x1 - x0) / 24)), sy = Math.max(1, Math.floor((y1 - y0) / 6));
    for (let y = y0; y <= y1; y += sy) for (let x = x0; x <= x1; x += sx) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      const bg = { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
      const a = it.fg.a * it.op;
      const fg = { r: it.fg.r * a + bg.r * (1 - a), g: it.fg.g * a + bg.g * (1 - a), b: it.fg.b * a + bg.b * (1 - a) };
      ratios.push(ratio(fg, bg));
      bgSum.r += bg.r; bgSum.g += bg.g; bgSum.b += bg.b; n++;
    }
    ratios.sort((p, q) => p - q);
    const p10 = ratios[Math.floor(ratios.length * 0.1)] ?? 21;
    const need = it.large ? 3 : 4.5;
    return { ...it, p10: +p10.toFixed(2), min: +(ratios[0] ?? 21).toFixed(2), need, pass: p10 >= need, bg: n ? hex({ r: bgSum.r / n, g: bgSum.g / n, b: bgSum.b / n }) : "?", fgHex: hex(it.fg) };
  });
}

export async function contrast(b, { scope, fullPage = false } = {}) {
  const results = new Map();
  const keep = (list) => list.forEach((r) => {
    const k = r.text + "|" + r.where + "|" + r.fgHex + "|" + Math.round(r.size);
    const prev = results.get(k);
    if (!prev || r.p10 < prev.p10) results.set(k, r);
  });
  if (!fullPage) keep(await measureViewport(b, scope));
  else {
    const H = await b.evaluate("innerHeight");
    const total = await b.evaluate("document.documentElement.scrollHeight");
    for (let y = 0; y < total; y += Math.round(H * 0.7)) {
      await b.evaluate(`scrollTo({ top: ${y}, behavior: "instant" })`);
      await sleep(1250);
      keep(await measureViewport(b, scope));
    }
  }
  const all = [...results.values()];
  return { count: all.length, fails: all.filter((r) => !r.pass), lowest: all.sort((p, q) => p.p10 / p.need - q.p10 / q.need).slice(0, 4) };
}

export const OVERFLOW = `(() => {
  const W = document.documentElement.clientWidth;
  const wide = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || (r.right <= W + 1 && r.left >= -1)) return;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return;
    wide.push((el.className || el.tagName).toString().split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return { W, scroll: document.documentElement.scrollWidth - W, bodyScroll: document.body.scrollWidth - W, wide: wide.slice(0, 6) };
})()`;
