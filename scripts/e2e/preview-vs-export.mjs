// Captures the Program Monitor frame at time T (full sequence resolution) and saves it as JPEG.
// Usage: node scripts/e2e/preview-vs-export.mjs <appUrl> <time> <out.jpg>
import { spawn } from "node:child_process";
import fs from "node:fs";
const [APP, T, OUT] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9688", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", `--user-data-dir=${OUT}.prof`, "--window-size=1680,1050", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 120 && !ws; i++) {
  try {
    const page = (await (await fetch("http://127.0.0.1:9688/json")).json()).find((p) => p.type === "page");
    if (page) { const c = new WebSocket(page.webSocketDebuggerUrl); if (await new Promise((r) => { c.onopen = () => r(true); c.onerror = () => r(false); setTimeout(() => r(false), 5000); })) ws = c; }
  } catch {}
  if (!ws) await sleep(500);
}
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: `(async () => { ${e} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: APP });
for (let i = 0; i < 90; i++) { if (await ev("return !!document.querySelector('.panel-frame')")) break; await sleep(1000); }
await sleep(4000);
const url = await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(${T}); await new Promise(r => setTimeout(r, 5000)); return await e.captureProgramFrame(1920, 0.95);`);
fs.writeFileSync(OUT, Buffer.from(url.split(",")[1], "base64"));
chrome.kill();
process.exit(0);
