// The agentic loop: Claude (adaptive thinking, streamed) <-> editing tools.
// We own the loop so we can stream progress, emit the edited project after each
// mutating tool, and keep the editing state server-side for the whole turn.
import Anthropic from "@anthropic-ai/sdk";
import type { AIChatRequest, AIEvent } from "../../src/api";
import type { Project } from "../../shared/types";
import { describeSequence, sequenceDuration } from "../../shared/ops";
import { apiKey, getSettings } from "../config";
import { SYSTEM_PROMPT } from "./prompt";
import { apiToolDefinitions, runTool, type ToolContext } from "./tools";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type BetaToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;
type BetaMessage = Anthropic.Beta.BetaMessage;
type StreamParams = Anthropic.Beta.MessageCreateParamsStreaming;

export const MAX_ITERATIONS = 40;
export const DEFAULT_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Minimal surface of the SDK we use — lets tests inject a scripted fake model. */
export interface StreamLike {
  on(event: "text", cb: (delta: string) => void): unknown;
  on(event: "thinking", cb: (delta: string) => void): unknown;
  finalMessage(): Promise<BetaMessage>;
}
export interface ModelClient {
  stream(params: StreamParams, opts: { signal: AbortSignal }): StreamLike;
}

export function anthropicClient(key: string): ModelClient {
  const client = new Anthropic({ apiKey: key });
  return { stream: (params, opts) => client.beta.messages.stream(params, opts) };
}

// tool definitions + system prompt never change between requests -> stable cache prefix
let cachedTools: Anthropic.Beta.BetaTool[] | null = null;
export function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  cachedTools ??= apiToolDefinitions() as Anthropic.Beta.BetaTool[];
  return cachedTools;
}

/** Server-side refusal fallback: supported on Opus/Sonnet/Fable; Haiku 5.5 has none (don't send it). */
const supportsFallback = (model: string) => !/haiku/.test(model);

export function buildRequestParams(messages: BetaMessageParam[], model = getSettings().model || DEFAULT_MODEL): StreamParams {
  const params: StreamParams = {
    model,
    max_tokens: 64000,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: "high" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: toolDefinitions(),
    tool_choice: { type: "auto" },
    // automatic caching of the growing conversation prefix inside the agent loop
    cache_control: { type: "ephemeral" },
    messages,
    stream: true,
  };
  if (supportsFallback(model)) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = "default";
  }
  return params;
}

// ---------------------------------------------------------------- per-request context

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Volatile editor state, placed in the user message (not the cached system prompt). */
export function editorStateText(project: Project, req: Pick<AIChatRequest, "selection" | "playhead">): string {
  const lines: string[] = [`Project "${project.name}".`];
  const media = Object.values(project.media);
  lines.push(`Media (${media.length}):`);
  for (const a of media.slice(0, 80)) {
    lines.push(`- ${a.id} "${a.name}" ${a.kind} ${a.kind === "image" ? "still" : fmt(a.duration) + "s"}${a.width ? ` ${a.width}x${a.height}` : ""}${a.hasAudio ? "" : " no-audio"}${a.transcript ? " [transcribed]" : ""}${a.status !== "ready" ? ` [${a.status}]` : ""}`);
  }
  if (media.length > 80) lines.push(`… and ${media.length - 80} more (use list_media).`);
  const seq = project.activeSequenceId ? project.sequences[project.activeSequenceId] : undefined;
  const others = Object.values(project.sequences).filter((s) => s.id !== seq?.id);
  if (seq) {
    let d = describeSequence(project, seq);
    if (d.length > 12000) d = d.slice(0, 12000) + `\n… (truncated; ${seq.clips.length} clips, ${fmt(sequenceDuration(seq))}s — use get_timeline)`;
    lines.push(`Active sequence (${seq.id}):\n${d}`);
  } else lines.push("No active sequence.");
  if (others.length) lines.push(`Other sequences: ${others.map((s) => `${s.id} "${s.name}"`).join(", ")}`);
  lines.push(`Playhead: ${fmt(req.playhead)}s. Selected clips: ${req.selection.clipIds.join(", ") || "none"}. Selected project items: ${req.selection.itemIds.join(", ") || "none"}.`);
  return lines.join("\n");
}

function dataUrlToImage(url: string): BetaContentBlockParam | null {
  const m = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(url);
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[3] } };
}

/** Accept only well-formed {role, content} entries from the client. */
export function sanitizeHistory(history: unknown[]): BetaMessageParam[] {
  if (!Array.isArray(history)) return [];
  const out = history.filter((m): m is BetaMessageParam => {
    const x = m as { role?: unknown; content?: unknown };
    return !!x && (x.role === "user" || x.role === "assistant") && (typeof x.content === "string" || Array.isArray(x.content));
  });
  // must start with a user message that isn't a dangling tool_result
  while (out.length && (out[0].role !== "user" || (Array.isArray(out[0].content) && out[0].content.some((b) => (b as { type: string }).type === "tool_result")))) out.shift();
  return out;
}

/** Replace images with placeholders and drop the oldest turns so history stays small. */
export function compactHistory(messages: BetaMessageParam[], maxMessages = 120): BetaMessageParam[] {
  const strip = (blocks: unknown): unknown => {
    if (!Array.isArray(blocks)) return blocks;
    return blocks.map((b) => {
      const blk = b as { type: string; content?: unknown };
      if (blk.type === "image") return { type: "text", text: "[image omitted from history]" };
      if (blk.type === "tool_result" && Array.isArray(blk.content)) return { ...blk, content: strip(blk.content) };
      return b;
    });
  };
  let out: BetaMessageParam[] = messages.map((m) => (m.role === "user" ? ({ ...m, content: strip(m.content) } as BetaMessageParam) : m));
  if (out.length > maxMessages) {
    out = out.slice(out.length - maxMessages);
    out = sanitizeHistory(out);
  }
  return out;
}

function errorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Update it in AI Settings.";
  if (e instanceof Anthropic.PermissionDeniedError) return "This API key doesn't have access to the selected model. Pick another model in AI Settings.";
  if (e instanceof Anthropic.NotFoundError) return "Model not found — choose a different model in AI Settings.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API — wait a moment and try again.";
  if (e instanceof Anthropic.BadRequestError) return `Request rejected by the API: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach the Anthropic API — check your internet connection.";
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`;
  return (e as Error)?.message ?? String(e);
}

// ---------------------------------------------------------------- the loop

export interface TurnOptions {
  client?: ModelClient;
  model?: string;
  maxIterations?: number;
}

/**
 * Run one user turn to completion. Emits AIEvents; always finishes with a
 * `done` event carrying the (compacted) API message history for the next turn.
 */
export async function runAgentTurn(req: AIChatRequest, emit: (e: AIEvent) => void, signal: AbortSignal, opts: TurnOptions = {}): Promise<void> {
  const history = sanitizeHistory(req.history ?? []);
  const key = apiKey();
  if (!opts.client && !key) {
    emit({ type: "error", error: "No Anthropic API key set. Open AI Settings and paste your key to let Claude edit." });
    emit({ type: "done", messages: history });
    return;
  }
  const client = opts.client ?? anthropicClient(key!);
  const model = opts.model ?? (getSettings().model || DEFAULT_MODEL);

  // editing state lives server-side for the whole turn
  const project: Project = structuredClone(req.project);
  if (req.sequenceId && project.sequences[req.sequenceId]) project.activeSequenceId = req.sequenceId;
  const ctx: ToolContext = { project, playhead: req.playhead ?? 0, selection: req.selection ?? { clipIds: [], itemIds: [] }, signal, emit };

  const userContent: BetaContentBlockParam[] = [{ type: "text", text: `<editor_state>\n${editorStateText(project, ctx)}\n</editor_state>\n\n${req.message}` }];
  const frame = req.programFrame ? dataUrlToImage(req.programFrame) : null;
  if (frame) userContent.push({ type: "text", text: `Current Program Monitor frame at the playhead (${fmt(ctx.playhead)}s):` }, frame);
  const messages: BetaMessageParam[] = [...history, { role: "user", content: userContent }];

  const maxIter = opts.maxIterations ?? MAX_ITERATIONS;
  let iterations = 0;
  try {
    for (;;) {
      if (signal.aborted) break;
      if (iterations++ >= maxIter) {
        emit({ type: "text", text: `\n\n_Stopped after ${maxIter} steps. Say "continue" to keep going._` });
        break;
      }
      const stream = client.stream(buildRequestParams(messages, model), { signal });
      stream.on("text", (delta) => emit({ type: "text", text: delta }));
      stream.on("thinking", (delta) => emit({ type: "thinking", text: delta }));
      const msg = await stream.finalMessage();

      if (msg.stop_reason === "refusal") {
        // discard the declined partial output; the conversation stays usable
        emit({ type: "text", text: "\n\n_Claude declined to continue this request. Try rephrasing it._" });
        break;
      }
      const toolUses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (msg.stop_reason === "max_tokens") {
        if (toolUses.length) {
          emit({ type: "error", error: "Claude's response was cut off (max tokens) before a tool call completed. Try a smaller request." });
        } else {
          messages.push({ role: "assistant", content: msg.content });
          emit({ type: "text", text: "\n\n_(response truncated)_" });
        }
        break;
      }
      messages.push({ role: "assistant", content: msg.content });
      if (msg.stop_reason === "pause_turn") continue;
      if (msg.stop_reason !== "tool_use" || !toolUses.length) break; // end_turn / stop_sequence

      // execute ALL tool calls of this turn (sequentially: they share the project), reply in ONE user message
      const results: BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "tool_start", id: tu.id, name: tu.name, input: tu.input });
        const r = await runTool(tu.name, tu.input, ctx);
        emit({ type: "tool_result", id: tu.id, name: tu.name, summary: r.output.summary ?? r.output.text.split("\n")[0].slice(0, 140), isError: r.isError || undefined });
        if (r.changed) emit({ type: "project", project: structuredClone(project), label: `AI: ${r.output.label ?? tu.name}` });
        const content: Exclude<BetaToolResultBlockParam["content"], string | undefined> = [{ type: "text", text: r.output.text || "(ok)" }];
        for (const img of r.output.images ?? []) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
        results.push({ type: "tool_result", tool_use_id: tu.id, content, ...(r.isError ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    if (!(signal.aborted || e instanceof Anthropic.APIUserAbortError)) emit({ type: "error", error: errorMessage(e) });
  }
  emit({ type: "done", messages: compactHistory(messages) });
}
