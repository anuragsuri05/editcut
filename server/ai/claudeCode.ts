// "Sign in with Claude Code" provider: runs the user's own installed Claude Code
// CLI in headless mode (`claude -p`) and gives it EditCut's editing tools through
// a per-turn MCP endpoint served by this server. Claude Code handles auth with
// whatever account the user signed in with (`claude auth login`).
import { spawn, execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import type { AIChatRequest, AIEvent } from "../../src/api";
import type { Project } from "../../shared/types";
import { getSettings, PORT, TMP_DIR } from "../config";
import { SYSTEM_PROMPT } from "./prompt";
import { editorStateText } from "./agent";
import { apiToolDefinitions, runTool, type ToolContext } from "./tools";

const CLAUDE_BIN = process.env.EDITCUT_CLAUDE_BIN ?? "claude";
const MCP_SERVER_NAME = "editcut";

// ---------------------------------------------------------------- status & login

export interface ClaudeCodeStatus {
  installed: boolean;
  loggedIn: boolean;
  authMethod?: string;
  email?: string;
  subscriptionType?: string;
  version?: string;
  loginInProgress?: boolean;
}

let statusCache: { at: number; value: ClaudeCodeStatus } | null = null;
let loginProc: ReturnType<typeof spawn> | null = null;

function run(args: string[], timeoutMs = 15000): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(CLAUDE_BIN, args, { timeout: timeoutMs }, (err, stdout) => resolve({ ok: !err, stdout: String(stdout ?? "") }));
  });
}

export async function claudeCodeStatus(force = false): Promise<ClaudeCodeStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 10_000) return { ...statusCache.value, loginInProgress: !!loginProc };
  const ver = await run(["--version"]);
  if (!ver.ok) {
    statusCache = { at: Date.now(), value: { installed: false, loggedIn: false } };
    return statusCache.value;
  }
  const st = await run(["auth", "status", "--json"]);
  let info: Record<string, unknown> = {};
  try {
    info = JSON.parse(st.stdout);
  } catch {
    /* older CLI or not logged in */
  }
  const value: ClaudeCodeStatus = {
    installed: true,
    loggedIn: info.loggedIn === true,
    authMethod: typeof info.authMethod === "string" ? info.authMethod : undefined,
    email: typeof info.email === "string" ? info.email : undefined,
    subscriptionType: typeof info.subscriptionType === "string" ? info.subscriptionType : undefined,
    version: ver.stdout.trim().split(" ")[0],
  };
  statusCache = { at: Date.now(), value };
  return { ...value, loginInProgress: !!loginProc };
}

/** Start `claude auth login`, which opens the browser sign-in page. The client polls status. */
export function startClaudeCodeLogin(method: "claudeai" | "console" = "claudeai"): void {
  if (loginProc) return;
  statusCache = null;
  loginProc = spawn(CLAUDE_BIN, ["auth", "login", method === "console" ? "--console" : "--claudeai"], { stdio: "ignore" });
  const done = () => {
    loginProc = null;
    statusCache = null;
  };
  loginProc.on("exit", done);
  loginProc.on("error", done);
  // the CLI waits for the browser callback; give up after 10 minutes
  setTimeout(() => loginProc?.kill(), 10 * 60_000).unref();
}

export async function claudeCodeLogout(): Promise<void> {
  await run(["auth", "logout"]);
  statusCache = null;
}

// ---------------------------------------------------------------- per-turn MCP endpoint

interface McpSession {
  ctx: ToolContext;
  emit: (e: AIEvent) => void;
  project: Project;
  /** Serialize tool calls: they share one project. */
  queue: Promise<unknown>;
}

const sessions = new Map<string, McpSession>();

type JsonRpc = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handleRpc(session: McpSession, msg: JsonRpc): Promise<unknown | null> {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const error = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null; // notification
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "editcut", version: "1.0.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: apiToolDefinitions().map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const input = (msg.params?.arguments as Record<string, unknown>) ?? {};
      const id = `cc_${crypto.randomUUID().slice(0, 8)}`;
      const task = session.queue.then(async () => {
        session.emit({ type: "tool_start", id, name, input });
        const r = await runTool(name, input, session.ctx);
        session.emit({ type: "tool_result", id, name, summary: r.output.summary ?? r.output.text.split("\n")[0].slice(0, 140), isError: r.isError || undefined });
        if (r.changed) session.emit({ type: "project", project: structuredClone(session.project), label: `AI: ${r.output.label ?? name}` });
        const content: unknown[] = [{ type: "text", text: r.output.text || "(ok)" }];
        for (const img of r.output.images ?? []) content.push({ type: "image", data: img.data, mimeType: img.mediaType });
        return reply({ content, isError: r.isError });
      });
      session.queue = task.catch(() => undefined);
      return task;
    }
    default:
      return error(-32601, `Method not found: ${msg.method}`);
  }
}

/** Streamable-HTTP MCP transport (JSON responses, no server-initiated stream). Mounted at /api/ai/mcp. */
export const claudeCodeMcpRouter = Router();

claudeCodeMcpRouter.post("/:token", async (req: Request, res: Response) => {
  const session = sessions.get(String(req.params.token));
  if (!session) return void res.status(404).json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unknown or finished EditCut session" } });
  const body = req.body as JsonRpc | JsonRpc[];
  const batch = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(batch.map((m) => handleRpc(session, m)))).filter((r) => r !== null);
  if (!replies.length) return void res.status(202).end();
  res.json(Array.isArray(body) ? replies : replies[0]);
});
claudeCodeMcpRouter.get("/:token", (_req, res) => void res.status(405).end());
claudeCodeMcpRouter.delete("/:token", (_req, res) => void res.status(200).end());

// ---------------------------------------------------------------- the turn

/** Claude Code accepts model aliases or full ids; map our setting to something it understands. */
function cliModel(model: string): string | undefined {
  if (!model) return undefined;
  return model;
}

function imageBlock(dataUrl: string): unknown | null {
  const m = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[3] } } : null;
}

/** Previous Claude Code session id, carried in the opaque chat history. */
function previousSession(history: unknown[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i] as { type?: string; sessionId?: string };
    if (h?.type === "claude_code_session" && typeof h.sessionId === "string") return h.sessionId;
  }
  return undefined;
}

export async function runClaudeCodeTurn(req: AIChatRequest, emit: (e: AIEvent) => void, signal: AbortSignal): Promise<void> {
  const resumeId = previousSession(req.history ?? []);
  const doneWith = (sessionId?: string) => emit({ type: "done", messages: sessionId ? [{ type: "claude_code_session", sessionId }] : [] });

  const status = await claudeCodeStatus();
  if (!status.installed) {
    emit({ type: "error", error: "Claude Code isn't installed on this computer. Install it from claude.com/claude-code, or use an API key in AI Settings." });
    return doneWith(resumeId);
  }
  if (!status.loggedIn) {
    emit({ type: "error", error: "Claude Code isn't signed in. Open AI Settings and click “Sign in with Claude Code”." });
    return doneWith(resumeId);
  }

  const project: Project = structuredClone(req.project);
  if (req.sequenceId && project.sequences[req.sequenceId]) project.activeSequenceId = req.sequenceId;
  const ctx: ToolContext = { project, playhead: req.playhead ?? 0, selection: req.selection ?? { clipIds: [], itemIds: [] }, signal, emit };
  const token = crypto.randomUUID();
  sessions.set(token, { ctx, emit, project, queue: Promise.resolve() });

  const mcpConfig = JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: "http", url: `http://127.0.0.1:${PORT}/api/ai/mcp/${token}` } } });
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--input-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--mcp-config", mcpConfig,
    "--strict-mcp-config",
    "--tools", "", // no built-in file/shell tools: Claude edits only through EditCut's tools
    "--allowedTools", `mcp__${MCP_SERVER_NAME}`,
    "--system-prompt", SYSTEM_PROMPT + "\n\nYour tools are provided by the EditCut MCP server (names prefixed mcp__editcut__).",
  ];
  const model = cliModel(getSettings().claudeCodeModel ?? "");
  if (model) args.push("--model", model);
  if (resumeId) args.push("--resume", resumeId);

  const cwd = path.join(TMP_DIR, "claude-code");
  fs.mkdirSync(cwd, { recursive: true });
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // use the Claude Code sign-in, not an API key from the environment

  const child = spawn(CLAUDE_BIN, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  const kill = () => child.kill("SIGTERM");
  signal.addEventListener("abort", kill);

  const content: unknown[] = [{ type: "text", text: `<editor_state>\n${editorStateText(project, ctx)}\n</editor_state>\n\n${req.message}` }];
  const frame = req.programFrame ? imageBlock(req.programFrame) : null;
  if (frame) content.push({ type: "text", text: `Current Program Monitor frame at the playhead (${ctx.playhead.toFixed(2)}s):` }, frame);
  child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content } }) + "\n");
  child.stdin.end();

  let sessionId = resumeId;
  let streamedText = false;
  let wroteTextThisMessage = false;
  let anyText = false;
  let resultError: string | null = null;
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));

  const onLine = (line: string) => {
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(line);
    } catch {
      return;
    }
    if (ev.session_id) sessionId = ev.session_id;
    if (ev.type === "stream_event") {
      const e = ev.event ?? {};
      if (e.type === "message_start") {
        if (anyText) emit({ type: "text", text: "\n\n" });
        wroteTextThisMessage = false;
      } else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
        streamedText = true;
        wroteTextThisMessage = anyText = true;
        emit({ type: "text", text: e.delta.text });
      } else if (e.type === "content_block_delta" && e.delta?.type === "thinking_delta" && e.delta.thinking) {
        emit({ type: "thinking", text: e.delta.thinking });
      }
    } else if (ev.type === "assistant" && !streamedText) {
      // no partial events (older CLI): fall back to whole text blocks
      for (const b of ev.message?.content ?? []) {
        if (b.type === "text" && b.text) {
          emit({ type: "text", text: (anyText ? "\n\n" : "") + b.text });
          anyText = true;
        }
      }
    } else if (ev.type === "result") {
      if (ev.is_error || (ev.subtype && ev.subtype !== "success")) resultError = typeof ev.result === "string" && ev.result ? ev.result : `Claude Code stopped (${ev.subtype ?? "error"}).`;
    }
  };

  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  });

  const code: number | null = await new Promise((resolve) => {
    child.on("exit", (c) => resolve(c));
    child.on("error", (err) => {
      stderr += String(err);
      resolve(-1);
    });
  });
  if (buf.trim()) onLine(buf.trim());
  signal.removeEventListener("abort", kill);
  sessions.delete(token);
  void wroteTextThisMessage;

  if (!signal.aborted) {
    if (resultError) emit({ type: "error", error: resultError });
    else if (code !== 0) emit({ type: "error", error: `Claude Code exited with code ${code}. ${stderr.trim().split("\n").slice(-3).join(" ")}`.trim() });
  }
  doneWith(sessionId);
}
