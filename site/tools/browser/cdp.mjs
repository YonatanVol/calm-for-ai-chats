// Minimal Chrome DevTools Protocol driver for a headless Chrome on a throwaway
// profile — it never touches your own Chrome profile. No dependencies: Node
// 22+ has fetch and WebSocket built in.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { existsSync } from "node:fs";
const CFT = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
// Chrome for Testing when present; otherwise the installed Chrome, headless, on a throwaway profile.
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME = process.env.CHROME || (existsSync(CFT) ? CFT : MAC_CHROME);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ extraArgs = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "calm-site-check-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, [
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--headless=new",
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", ...extraArgs, "about:blank",
  ], { stdio: "ignore" });
  let list;
  for (let i = 0; i < 200 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, (d) => (d.error ? rej(new Error(method + ": " + d.error.message)) : res(d.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const errors = [];
  listeners.push((d) => {
    if (d.method === "Runtime.exceptionThrown") errors.push("exception: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning"))
      errors.push(d.params.type + ": " + d.params.args.map((a) => a.value ?? a.description).join(" "));
    if (d.method === "Log.entryAdded" && (d.params.entry.level === "error" || d.params.entry.level === "warning"))
      errors.push("log " + d.params.entry.level + ": " + d.params.entry.text + " " + (d.params.entry.url || ""));
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  // A headless page never has OS focus, and Chrome then skips focus events. A real visitor's window does.
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  return {
    send, evaluate, errors, on: (fn) => listeners.push(fn),
    async size(width, height = 900, mobile = false) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    },
    async media(features) { await send("Emulation.setEmulatedMedia", { features }); },
    waitFor(method, ms = 20000) {
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), ms);
        listeners.push((d) => { if (d.method === method) { clearTimeout(t); resolve(true); } });
      });
    },
    async goto(url, wait = 1500) {
      const loaded = new Promise((r) => listeners.push((d) => d.method === "Page.loadEventFired" && r()));
      await send("Page.navigate", { url }); await loaded; await sleep(wait);
    },
    async key(type, key, code, modifiers = 0, text) {
      await send("Input.dispatchKeyEvent", { type, key, code, modifiers, text, windowsVirtualKeyCode: vk(key, code), nativeVirtualKeyCode: vk(key, code) });
    },
    async press(key, code, modifiers = 0) {
      const text = key.length === 1 && !(modifiers & 6) ? key : undefined;
      await this.key("keyDown", key, code, modifiers, text);
      await this.key("keyUp", key, code, modifiers);
    },
    async click(x, y) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    },
    async shot(path, clip) {
      const { writeFileSync } = await import("node:fs");
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}) });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    async close() {
      try { ws.close(); } catch {}
      const exited = new Promise((r) => proc.once("exit", r));
      proc.kill();
      await Promise.race([exited, sleep(3000)]);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

function vk(key, code) {
  const map = { Escape: 27, Enter: 13, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Tab: 9, " ": 32, Space: 32 };
  if (map[key]) return map[key];
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit\d$/.test(code)) return code.charCodeAt(5);
  return 0;
}

// Modifier bitmask for Input.dispatchKeyEvent
export const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
