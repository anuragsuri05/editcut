// Full user-journey QA for EditCut in headless Chrome (real keyboard/mouse/file-chooser events).
// Usage: node scripts/e2e/qa.mjs <appUrl> <outDir> <repoRoot> [--skip-claude]
// Expects the app (Vite) at appUrl proxying to a running server, and a TRIBE worker configured.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [APP = "http://localhost:5199/", OUT = "/tmp/editcut-qa", ROOT = process.cwd()] = process.argv.slice(2);
const SKIP_CLAUDE = process.argv.includes("--skip-claude");
const SAMPLES = path.join(ROOT, "samples");
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
const LOG = path.join(OUT, "qa.log");
fs.writeFileSync(LOG, "");
const log = (...a) => fs.appendFileSync(LOG, a.join(" ") + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok, info });
  log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " — " + info : ""}`);
};

// ------------------------------------------------------------------ chrome + CDP
const PORT = 9677;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run",
  `--user-data-dir=${path.join(OUT, "prof")}`, "--autoplay-policy=no-user-gesture-required", "--window-size=1680,1050", "about:blank",
], { stdio: "ignore" });
let ws;
for (let i = 0; i < 120 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((p) => p.type === "page");
    if (page) {
      const c = new WebSocket(page.webSocketDebuggerUrl);
      if (await new Promise((r) => { c.onopen = () => r(true); c.onerror = () => r(false); setTimeout(() => r(false), 5000); })) ws = c;
    }
  } catch {}
  if (!ws) await sleep(500);
}
let msgId = 0;
const pending = new Map();
const errors = [];
const listeners = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === "Runtime.exceptionThrown") errors.push("EXCEPTION " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 400));
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push("CONSOLE " + d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (d.method === "Network.responseReceived" && d.params.response.status >= 400) errors.push(`HTTP ${d.params.response.status} ${d.params.response.url}`);
  for (const l of listeners) l(d);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++msgId; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error((r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)).slice(0, 500));
  return r.result?.result?.value;
};
const shot = async (name) => fs.writeFileSync(path.join(OUT, "shots", name + ".png"), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
const waitFor = async (expr, timeoutMs = 30000, every = 500) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await ev(expr); if (v) return v; } catch {}
    await sleep(every);
  }
  return null;
};
const store = "const {useEditor} = await import('/src/store/store.ts'); const S = useEditor.getState(); const seq = S.project.activeSequenceId ? S.project.sequences[S.project.activeSequenceId] : null;";

// real input events
const MOD = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };
const KEYMAP = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Delete: 46, Backspace: 8, Enter: 13, Escape: 27, Space: 32, Home: 36, End: 35, ",": 188, ".": 190, "=": 187, "-": 189, "\\": 220, ";": 186, "'": 222 };
async function press(combo) {
  const parts = combo.split("+");
  const k = parts.pop();
  let modifiers = 0;
  for (const p of parts) modifiers |= MOD[p === "Mod" ? "Meta" : p];
  const isLetter = /^[A-Z]$/i.test(k);
  const code = isLetter ? "Key" + k.toUpperCase() : /^\d$/.test(k) ? "Digit" + k : { ",": "Comma", ".": "Period", "=": "Equal", "-": "Minus", "\\": "Backslash", ";": "Semicolon", "'": "Quote", Space: "Space" }[k] ?? k;
  const key = k === "Space" ? " " : isLetter ? (modifiers & MOD.Shift ? k.toUpperCase() : k.toLowerCase()) : k;
  const vk = isLetter ? k.toUpperCase().charCodeAt(0) : KEYMAP[k] ?? key.charCodeAt(0);
  await send("Input.dispatchKeyEvent", { type: "keyDown", modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(150);
}
async function centerOf(jsSelectorExpr) {
  return ev(`const el = ${jsSelectorExpr}; if (!el) return null; el.scrollIntoView({block: "nearest"}); const r = el.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2};`);
}
async function click(jsSelectorExpr, { double = false, modifiers = 0 } = {}) {
  const p = await centerOf(jsSelectorExpr);
  if (!p) return false;
  for (const clickCount of double ? [1, 2] : [1]) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount, modifiers });
  }
  await sleep(250);
  return true;
}
const byText = (text, scope = "document") => `[...${scope}.querySelectorAll("*")].filter(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(text)}).pop()`;
const panel = (title) => `[...document.querySelectorAll(".dv-groupview")].find(g => [...g.querySelectorAll(".dv-tab.dv-active-tab, .dv-tab")].some(t => t.textContent.trim().startsWith(${JSON.stringify(title)})))`;

// file chooser: next chooser gets these files
let nextFiles = null;
listeners.push(async (d) => {
  if (d.method === "Page.fileChooserOpened" && nextFiles) {
    const files = nextFiles;
    nextFiles = null;
    await send("DOM.setFileInputFiles", { files, backendNodeId: d.params.backendNodeId });
  }
});

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("DOM.enable");
await send("Page.setInterceptFileChooserDialog", { enabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });

try {
  // ================================================================ 1. startup
  await send("Page.navigate", { url: APP });
  check("app loads", !!(await waitFor("return !!document.querySelector('.menubar') && document.querySelectorAll('.dv-tab').length > 10 && !!document.querySelector('.panel-frame')", 90000)));
  await sleep(2500);
  check("default sequence exists", !!(await ev(`${store} return !!seq`)));
  await shot("01-startup");

  // ================================================================ 2. import via Cmd+I + OS file chooser
  nextFiles = ["talking_head_speech.mp4", "clip_testsrc_1080p.mp4", "greenscreen.mp4", "music.mp3"].map((f) => path.join(SAMPLES, f));
  await click(panel("Project"));
  await press("Mod+I");
  const ready = await waitFor(`${store} const m = Object.values(S.project.media); return m.length === 4 && m.every(a => a.status === 'ready') ? m.length : 0`, 120000, 1000);
  check("import 4 files through file chooser", ready === 4, `media ready: ${ready}`);
  check("thumbnails + waveform generated", !!(await ev(`${store} const m = Object.values(S.project.media); return m.filter(a => a.hasVideo).every(a => a.thumbs) && m.filter(a => a.hasAudio).every(a => a.waveformUrl)`)));
  await shot("02-imported");

  // ================================================================ 3. three-point edit from the Source Monitor
  await click(byText("talking_head_speech.mp4", panel("Project")), { double: true });
  check("double-click opens Source Monitor", !!(await waitFor(`${store} return S.sourceAssetId && S.project.media[S.sourceAssetId]?.name === 'talking_head_speech.mp4'`, 5000)));
  await click(`document.querySelector('.panel-frame canvas, .panel-frame video') && ${panel("Source")}`);
  await ev(`const e = await import('/src/engine/index.ts'); e.seekSource(1); return true`);
  await sleep(400);
  await press("I");
  await ev(`const e = await import('/src/engine/index.ts'); e.seekSource(9); return true`);
  await sleep(400);
  await press("O");
  const marks = await ev(`${store} const a = S.project.media[S.sourceAssetId]; return [a.inPoint, a.outPoint]`);
  check("Mark In/Out with I and O", marks && Math.abs(marks[0] - 1) < 0.1 && Math.abs(marks[1] - 9) < 0.1, JSON.stringify(marks));
  await press(",");
  await sleep(800);
  const afterInsert = await ev(`${store} return seq.clips.map(c => ({n: c.name, s: c.start, d: +c.duration.toFixed(2), i: +c.sourceIn.toFixed(2)}))`);
  check("Insert (,) places linked V+A clip", afterInsert?.length === 2 && afterInsert.every((c) => Math.abs(c.d - 8) < 0.1 && Math.abs(c.i - 1) < 0.1), JSON.stringify(afterInsert));

  await click(byText("clip_testsrc_1080p.mp4", panel("Project")), { double: true });
  await waitFor(`${store} return S.project.media[S.sourceAssetId]?.name === 'clip_testsrc_1080p.mp4'`, 5000);
  await click(panel("Source"));
  await ev(`const e = await import('/src/engine/index.ts'); e.seekSource(2); return true`);
  await sleep(300);
  await press("I");
  await ev(`const e = await import('/src/engine/index.ts'); e.seekSource(7); return true`);
  await sleep(300);
  await press("O");
  await press(".");
  await sleep(800);
  const afterOverwrite = await ev(`${store} const {sequenceDuration} = await import('/shared/ops.ts'); return {n: seq.clips.length, dur: sequenceDuration(seq)}`);
  check("Overwrite (.) appends second clip at playhead", afterOverwrite?.n === 4 && Math.abs(afterOverwrite.dur - 13) < 0.15, JSON.stringify(afterOverwrite));
  await shot("03-three-point-edits");

  // ================================================================ 4. timeline editing with keyboard
  await click(panel("Timeline"));
  await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(4); return true`);
  await sleep(300);
  await press("Mod+K");
  const afterSplit = await ev(`${store} return seq.clips.length`);
  check("Add Edit (Cmd+K) splits clips at playhead", afterSplit === 6, `clips ${afterSplit}`);
  // select the right half of the split V1 clip and ripple delete it
  const rightHalf = await ev(`${store} const {tracksOfKind} = await import('/shared/ops.ts'); const v1 = tracksOfKind(seq,'video')[0]; const c = seq.clips.filter(c => c.trackId === v1.id).sort((a,b)=>a.start-b.start)[1]; return c.id`);
  await click(`document.querySelector('[data-clip-id="${rightHalf}"]')`);
  const sel = await ev(`${store} return S.selection.clipIds.length`);
  check("click selects clip + linked audio", sel === 2, `selected ${sel}`);
  await press("Shift+Delete");
  const afterRipple = await ev(`${store} const {sequenceDuration} = await import('/shared/ops.ts'); return {n: seq.clips.length, dur: +sequenceDuration(seq).toFixed(2)}`);
  // 13s edit, split at 4s, the 4-8s piece removed -> 9s with no gap
check("Ripple Delete closes the gap", afterRipple?.n === 4 && Math.abs(afterRipple.dur - 9) < 0.15, JSON.stringify(afterRipple));
  await press("Mod+Z");
  const undone = await ev(`${store} return seq.clips.length`);
  await press("Mod+Shift+Z");
  const redone = await ev(`${store} return seq.clips.length`);
  check("Undo / Redo", undone === 6 && redone === 4, `undo ${undone} redo ${redone}`);
  await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(3); return true`);
  await sleep(200);
  await press("Mod+D");
  check("Default transition (Cmd+D) at edit point", (await ev(`${store} return seq.transitions.length`)) >= 1);
  await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(0.5); return true`);
  await press("Mod+T");
  const title = await ev(`${store} return seq.clips.filter(c => c.generator?.kind === 'text').length`);
  check("New Text layer (Cmd+T)", title === 1);
  await shot("04-timeline-edits");

  // ================================================================ 5. effects + Lumetri on a clip
  const v1first = await ev(`${store} const {tracksOfKind} = await import('/shared/ops.ts'); const v1 = tracksOfKind(seq,'video')[0]; return seq.clips.filter(c => c.trackId === v1.id).sort((a,b)=>a.start-b.start)[0].id`);
  await click(`document.querySelector('[data-clip-id="${v1first}"]')`);
  await ev(`const d = await import('/src/dock.tsx'); d.openPanel('effects'); return true`);
  await sleep(500);
  await click(`${panel("Effects")}?.querySelector('input')`);
  await send("Input.insertText", { text: "Gaussian" });
  await sleep(500);
  await click(byText("Gaussian Blur", panel("Effects")), { double: true });
  check("Apply effect from Effects panel (double-click)", !!(await waitFor(`${store} return seq.clips.find(c => c.id === '${v1first}')?.effects.some(e => e.type === 'gaussianBlur')`, 4000)));
  await ev(`const d = await import('/src/dock.tsx'); d.openPanel('lumetri'); return true`);
  await sleep(600);
  check("Lumetri Color opens docked (not floating)", (await ev(`const d = await import('/src/dock.tsx'); return d.getDockApi().getPanel('lumetri')?.group.api.location.type`)) === "grid");
  // drag the first Lumetri slider (Temperature) with real pointer events
  const slider = await ev(`const s = ${panel("Lumetri Color")}?.querySelector('input[type=range]'); if (!s) return null; s.scrollIntoView({block:'center'}); const r = s.getBoundingClientRect(); return {x: r.left, y: r.top + r.height/2, w: r.width}`);
  if (slider) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: slider.x + slider.w * 0.5, y: slider.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: slider.x + slider.w * 0.85, y: slider.y, button: "left" });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: slider.x + slider.w * 0.85, y: slider.y, button: "left", clickCount: 1 });
    await sleep(400);
  }
  const lum = await ev(`${store} const c = seq.clips.find(c => c.id === '${v1first}'); const l = c?.effects.find(e => e.type === 'lumetri'); return l ? Object.entries(l.params).filter(([k,v]) => v.value !== 0 && v.value !== 100 && v.value !== 50).map(([k,v]) => k+'='+v.value.toFixed(1)) : null`);
  check("Lumetri slider drag changes the grade", !!lum && lum.length > 0, JSON.stringify(lum));
  const lumHistory = await ev(`${store} return S.past.slice(-2).map(p => p.label)`);
  log("  history tail:", JSON.stringify(lumHistory));
  await shot("05-effects");

  // ================================================================ 6. playback renders frames
  await click(panel("Program"));
  await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(1); return true`);
  await press("Space");
  await sleep(2500);
  const t = await ev(`const {usePlayback} = await import('/src/store/playback.ts'); return usePlayback.getState().time`);
  await press("Space");
  check("Space plays the program (playhead advances)", t > 1.5, `t=${t?.toFixed(2)}`);
  const mean = await ev(`const e = await import('/src/engine/index.ts'); e.seekProgram(6.5); await new Promise(r => setTimeout(r, 4500)); const url = await e.captureProgramFrame(320, 0.8); const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0,0,c.width,c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]+d[i+1]+d[i+2]; return s / (d.length/4) / 3`);
  check("Program Monitor renders a real frame", mean > 20, `mean luma ${mean?.toFixed(1)}`);
  await shot("06-playback");

  // ================================================================ 7. Claude edits through the AI Assistant (Claude Code sign-in)
  if (!SKIP_CLAUDE) {
    const before = await ev(`${store} return {n: seq.clips.length, past: S.past.length}`);
    await ev(`const d = await import('/src/dock.tsx'); d.openPanel('ai'); return true`);
    await sleep(800);
    await ev(`const ta = document.querySelector('.ai-panel textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, "Add a lower-third title that says 'EditCut QA' from 1s to 4s on a free video track, and add a 0.5s Dip to Black at the very start of the first clip on V1. Reply in one short sentence."); ta.dispatchEvent(new Event('input', {bubbles: true})); ta.focus(); return true`);
    await press("Enter");
    const finished = await waitFor(`const m = await import('/src/panels/ai/aiSession.ts'); const s = m.useAISession.getState(); return !s.running && s.items.length > 1`, 300000, 2000);
    const after = await ev(`${store} return {n: seq.clips.length, past: S.past.length, titles: seq.clips.filter(c => c.generator?.kind === 'text').map(c => c.generator.style.text), lastLabel: S.past[S.past.length-1]?.label}`);
    const chat = await ev(`return document.querySelector('.ai-panel .ai-scroll')?.innerText.slice(-400)`);
    check("Claude edits the timeline from the AI Assistant", !!finished && after.titles.some((x) => /EditCut QA/i.test(x)), JSON.stringify(after) + " | " + chat?.replace(/\n/g, " "));
    await press("Escape");
    await click(panel("Timeline"));
    await press("Mod+Z");
    const undoneAI = await ev(`${store} return seq.clips.filter(c => c.generator?.kind === 'text').map(c => c.generator.style.text)`);
    check("One Cmd+Z undoes the whole Claude turn", !undoneAI.some((x) => /EditCut QA/i.test(x)), JSON.stringify(undoneAI));
    await press("Mod+Shift+Z");
    await shot("07-claude-edit");
  }

  // ================================================================ 8. captions from transcript
  await ev(`const {runCommand} = await import('/src/commands/registry.ts'); runCommand('captions.generate'); return true`);
  const caps = await waitFor(`${store} const c = seq.clips.filter(c => c.caption); return c.length ? c.map(x => x.caption.text) : null`, 180000, 2000);
  check("Create captions (whisper transcript)", !!caps && caps.length > 0, JSON.stringify(caps)?.slice(0, 160));
  await shot("08-captions");

  // ================================================================ 9. save + reload persistence
  await press("Mod+S");
  await sleep(2500);
  const snapshot = await ev(`${store} return {id: S.project.id, n: seq.clips.length, fx: seq.clips.reduce((a,c) => a + c.effects.length, 0)}`);
  await send("Page.reload");
  await waitFor("return document.querySelectorAll('.panel-frame').length > 10", 60000);
  await sleep(3000);
  const reloaded = await ev(`${store} return {id: S.project.id, n: seq?.clips.length, fx: seq?.clips.reduce((a,c) => a + c.effects.length, 0)}`);
  check("Project saves and restores after reload", JSON.stringify(snapshot) === JSON.stringify(reloaded), `${JSON.stringify(snapshot)} vs ${JSON.stringify(reloaded)}`);

  // ================================================================ 10. export through Export mode
  await click(byText("Export", "document.querySelector('.mode-tabs')"));
  await waitFor(`return !!document.querySelector('.export-mode, [class*=export]')`, 5000);
  await sleep(1500);
  await shot("10-export-mode");
  const jobsBefore = (await (await fetch(new URL("/api/export/jobs", APP))).json()).length;
  const exportBtn = `[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Export').pop()`;
  await click(exportBtn);
  let job = null;
  for (let i = 0; i < 240; i++) {
    await sleep(1500);
    const jobs = await (await fetch(new URL("/api/export/jobs", APP))).json();
    if (jobs.length > jobsBefore) {
      job = jobs[jobs.length - 1];
      if (["done", "error", "cancelled"].includes(job.status)) break;
    }
  }
  check("Export renders an MP4", job?.status === "done", job ? `${job.status} ${job.error ?? ""} ${job.outputPath}` : "no job started");
  if (job?.status === "done") {
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", job.outputPath]).toString());
    const seqDur = await ev(`${store} const {sequenceDuration} = await import('/shared/ops.ts'); return sequenceDuration(seq)`);
    const dur = parseFloat(probe.format.duration);
    check("Exported duration matches the sequence", Math.abs(dur - seqDur) < 0.2, `${dur} vs ${seqDur}`);
    check("Export has video + audio streams", probe.streams.some((s) => s.codec_type === "video") && probe.streams.some((s) => s.codec_type === "audio"));
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "2", "-i", job.outputPath, "-frames:v", "1", "-vf", "scale=640:-2", path.join(OUT, "export-2s.jpg")]);
  }

  // ================================================================ 11. Content Lab on the edited sequence
  await click(byText("Content Lab", "document.querySelector('.mode-tabs')"));
  await sleep(1500);
  await shot("11-lab-start");
  await click(`[...document.querySelectorAll('button')].find(b => /Analyze active sequence/.test(b.textContent))`);
  const rep = await waitFor(`const {useLab} = await import('/src/panels/predict/labStore.ts'); const v = useLab.getState().view; return v.kind === 'report' ? (v.reportId ?? v.id ?? 'report') : (v.kind === 'progress' && v.error ? 'ERR:' + v.error : null)`, 600000, 2000);
  check("Content Lab analyzes the active sequence", !!rep && !String(rep).startsWith("ERR"), String(rep));
  await sleep(2500);
  await shot("12-lab-report");
  const reportInfo = await ev(`return {text: document.body.innerText.slice(0, 20000)}`);
  check("Report shows score, retention, moments, suggestions", /Content score/i.test(reportInfo.text) && /retention/i.test(reportInfo.text) && /Suggestions/i.test(reportInfo.text) && /Moments/i.test(reportInfo.text));
  check("Mock TRIBE data is flagged in the report", /Synthetic test data/i.test(reportInfo.text));
  if (!SKIP_CLAUDE) check("Claude coaching present", /Written by Claude/i.test(reportInfo.text) && /Hook rewrite|Fix first|Verdict/i.test(reportInfo.text));
  const seekOk = await ev(`const chip = document.querySelector('.lab-timechip'); if (!chip) return 'no chip'; const v = document.querySelector('video'); const before = v.currentTime; chip.click(); await new Promise(r => setTimeout(r, 800)); return Math.abs(v.currentTime - before) > 0.2 || 'did not seek'`);
  check("Clicking a suggestion time seeks the player", seekOk === true, String(seekOk));
  const reportFromSeq = await ev(`const {useLab} = await import('/src/panels/predict/labStore.ts'); const v = useLab.getState().view; const id = v.reportId ?? v.id; const r = await (await fetch('/api/predict/reports/' + id)).json(); return {source: r.source, dur: r.durationSec, platforms: r.platforms.length, sugg: r.suggestions.length, tribe: r.engine.tribe, claude: r.engine.claude}`);
  log("  report:", JSON.stringify(reportFromSeq));
  check("Report links back to the sequence", !!reportFromSeq?.source?.startsWith("seq_"), JSON.stringify(reportFromSeq));

  // ================================================================ 12. Content Lab upload in standalone mode
  await send("Page.navigate", { url: new URL("/?app=lab", APP).toString() });
  check("Standalone Content Lab loads", !!(await waitFor(`return /Content Lab/.test(document.body.innerText) && /Drop a video/i.test(document.body.innerText)`, 60000)));
  await sleep(1500);
  check("History lists past reports", !!(await waitFor(`return /Past reports/i.test(document.body.innerText)`, 5000)));
  // turn off Claude for the upload run to keep it quick
  await ev(`const {useLab} = await import('/src/panels/predict/labStore.ts'); const s = useLab.getState(); s.setOptions ? s.setOptions({ ...s.options, useClaude: false }) : useLab.setState({ options: { ...s.options, useClaude: false } }); return true`);
  nextFiles = [path.join(SAMPLES, "greenscreen.mp4")];
  await click(`[...document.querySelectorAll('button')].find(b => /Choose video/.test(b.textContent))`);
  const rep2 = await waitFor(`const {useLab} = await import('/src/panels/predict/labStore.ts'); const v = useLab.getState().view; return v.kind === 'report' ? 'ok' : (v.kind === 'progress' && v.error ? 'ERR:' + v.error : null)`, 300000, 2000);
  check("Upload a video in standalone Content Lab", rep2 === "ok", String(rep2));
  await sleep(2000);
  await shot("13-lab-upload-report");
} catch (e) {
  check("run completed without a driver exception", false, e.message);
}

log("\n==== RESULTS ====");
const failed = results.filter((r) => !r.ok);
log(`${results.length - failed.length}/${results.length} passed`);
for (const f of failed) log("FAILED:", f.name, "—", f.info);
const benign = (e) => /favicon/.test(e);
const realErrors = errors.filter((e) => !benign(e));
log(`\n==== BROWSER ERRORS (${realErrors.length}) ====`);
for (const e of [...new Set(realErrors)].slice(0, 60)) log(" ", e);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, errors: realErrors }, null, 2));
chrome.kill();
process.exit(0);
