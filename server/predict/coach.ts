// Claude's written coaching for a Content Lab report. Uses whichever Claude
// connection the user set up: the Anthropic API key or their Claude Code sign-in.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { PredictionReport } from "../../shared/predict";
import { PLATFORMS } from "../../shared/predict";
import { apiKey, getSettings, TMP_DIR } from "../config";
import { resolveProvider } from "../ai/index";
import { mmss } from "./score";

const COACH_SYSTEM = `You are a senior short-form and YouTube video strategist reviewing a creator's video before it is posted.
You receive EditCut Content Lab's analysis: per-second attention estimates, simulated retention per platform, measurable features (cuts, motion, loudness, speech), optional brain-response signals from Meta's TRIBE v2 research model (predicted average-viewer cortical activity, z-scored within the video), the transcript, and a few frames.
Write a concise, specific coaching report in markdown:
1. **Verdict** — one or two sentences on how this video will likely perform and on which platform.
2. **What works** — 2–3 bullets with timestamps.
3. **Fix first** — the 3–5 highest-impact changes, each with a timestamp range and an exact, actionable edit (what to cut, add, reorder, say on screen).
4. **Hook rewrite** — 2 alternative opening lines or on-screen texts for the first 3 seconds.
5. **Per-platform notes** — one line each for the target platforms.
Be honest: the numbers are model estimates, not platform analytics, so never promise views. Don't repeat the raw numbers back; interpret them. Keep it under 450 words.`;

function reportDigest(r: PredictionReport, goal?: string): string {
  const att = r.seconds.map((s) => s.attention);
  const lines: string[] = [];
  lines.push(`File: ${r.fileName}, ${r.durationSec.toFixed(1)}s, ${r.width ?? "?"}x${r.height ?? "?"}`);
  if (goal) lines.push(`Creator's goal: ${goal}`);
  lines.push(`Scores: overall ${r.overall.score}, hook ${r.overall.hook}, pacing ${r.overall.pacing}, clarity ${r.overall.clarity}${r.overall.neural !== undefined ? `, neural ${r.overall.neural}` : ""}`);
  lines.push(`Attention per second: ${att.join(",")}`);
  for (const p of r.platforms) {
    const name = PLATFORMS.find((x) => x.id === p.platform)?.name;
    lines.push(`${name}: score ${p.score}, hook hold ${p.hookHoldPct}%, avg view ${p.avgViewPct}%, completion ${p.completionPct}%`);
  }
  lines.push(`Cuts at: ${r.features.filter((f) => f.cut).map((f) => mmss(f.t)).join(", ") || "none"}`);
  lines.push(`Silent seconds: ${r.features.filter((f) => f.silent).map((f) => f.t).join(",") || "none"}`);
  if (r.tribe) {
    lines.push(`TRIBE v2 (${r.tribe.mock ? "MOCK DATA — ignore brain signals" : r.tribe.model}) network z-scores per second:`);
    for (const [k, v] of Object.entries(r.tribe.networks)) lines.push(`  ${k}: ${v.map((x) => x.toFixed(1)).join(",")}`);
  }
  lines.push("Moments: " + r.moments.map((m) => `${m.kind} ${mmss(m.start)}-${mmss(m.end)} (${m.label})`).join("; "));
  lines.push("Rule-based suggestions already shown to the user: " + r.suggestions.map((s) => s.title).join("; "));
  if (r.transcript) lines.push(`Transcript:\n${r.transcript.slice(0, 6000)}`);
  return lines.join("\n");
}

/** Frames as base64 JPEG: the opening, the biggest peak and the biggest dip. */
export type CoachFrame = { label: string; jpegBase64: string };

async function viaApi(text: string, frames: CoachFrame[], signal?: AbortSignal): Promise<string> {
  const client = new Anthropic({ apiKey: apiKey() });
  const model = getSettings().model || "claude-opus-5-5";
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of frames) {
    content.push({ type: "text", text: f.label });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpegBase64 } });
  }
  content.push({ type: "text", text });
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: COACH_SYSTEM,
    messages: [{ role: "user", content }],
  };
  if (!/haiku/.test(model)) {
    params.betas = ["server-side-fallback-2026-07-01"];
    (params as unknown as { fallbacks: string }).fallbacks = "default";
  }
  const msg = await client.beta.messages.create(params, { signal });
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to write coaching for this video");
  return msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}

async function viaClaudeCode(text: string, frames: CoachFrame[], signal?: AbortSignal): Promise<string> {
  const content: unknown[] = [];
  for (const f of frames) content.push({ type: "text", text: f.label }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpegBase64 } });
  content.push({ type: "text", text });
  const cwd = path.join(TMP_DIR, "claude-code");
  fs.mkdirSync(cwd, { recursive: true });
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  const args = ["-p", "--output-format", "stream-json", "--input-format", "stream-json", "--verbose", "--tools", "", "--strict-mcp-config", "--system-prompt", COACH_SYSTEM];
  if (getSettings().claudeCodeModel) args.push("--model", getSettings().claudeCodeModel!);
  const child = spawn(process.env.EDITCUT_CLAUDE_BIN ?? "claude", args, { cwd, env, stdio: ["pipe", "pipe", "pipe"], signal });
  child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content } }) + "\n");
  child.stdin.end();
  let out = "", err = "", result = "", failed = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
  await new Promise<void>((resolve) => child.on("close", () => resolve()));
  for (const line of out.split("\n")) {
    try {
      const ev = JSON.parse(line);
      if (ev.type === "result") {
        if (ev.is_error) failed = String(ev.result ?? "error");
        else result = String(ev.result ?? "");
      }
    } catch {
      /* partial line */
    }
  }
  if (failed || !result) throw new Error(`Claude Code: ${failed || err.trim().split("\n").pop() || "no result"}`);
  return result.trim();
}

/** Returns markdown coaching, or null when no Claude connection is configured. */
export async function writeCoaching(report: PredictionReport, frames: CoachFrame[], goal?: string, signal?: AbortSignal): Promise<string | null> {
  const provider = await resolveProvider();
  if (!provider) return null;
  const text = `Here is the Content Lab analysis of my video. Write the coaching report.\n\n${reportDigest(report, goal)}`;
  return provider === "api" ? viaApi(text, frames, signal) : viaClaudeCode(text, frames, signal);
}
