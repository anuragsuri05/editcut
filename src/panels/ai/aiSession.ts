// AI Assistant session: chat transcript, multi-turn API history, streaming and
// applying Claude's edits to the editor store. Lives outside the panel component
// so commands can send prompts even when the panel is closed.
//
// Undo model: one AI turn = ONE undo step. The first `project` event of a turn
// pushes a history entry ("Claude: <prompt>") via apply(); every later `project`
// event of the same turn replaces the current project in place, so Cmd+Z reverts
// the whole turn. If the user makes their own edit mid-turn, the next AI event
// starts a fresh undo step so the user's edit isn't folded into Claude's.
import { create } from "zustand";
import type { ExportSettings, ID } from "@shared/types";
import { api, streamAIChat, type AIEvent, type ServerSettings } from "../../api";
import { useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { submitExport } from "../export/exportClient";
import { captureProgramFrame } from "../../engine";
import { applyProjectEvent, type TurnState } from "./applyTurn";

export type ChatItem =
  | { kind: "user"; id: number; text: string; withFrame?: boolean }
  | { kind: "text"; id: number; text: string }
  | { kind: "thinking"; id: number; text: string; done?: boolean }
  | { kind: "tool"; id: number; toolId: string; name: string; input: unknown; status: "running" | "done" | "error"; summary?: string }
  | { kind: "error"; id: number; text: string }
  | { kind: "notice"; id: number; text: string };

interface SessionState {
  items: ChatItem[];
  history: unknown[];
  running: boolean;
  shareFrame: boolean;
  settings: ServerSettings | null;
  draft: string;
  set: (p: Partial<SessionState>) => void;
}

export const useAISession = create<SessionState>()((set) => ({
  items: [],
  history: [],
  running: false,
  shareFrame: true,
  settings: null,
  draft: "",
  set: (p) => set(p),
}));

let seq = 1;
let abort: AbortController | null = null;
const S = () => useAISession.getState();

function push(item: ChatItem): void {
  useAISession.setState((s) => ({ items: [...s.items, item] }));
}
function updateLast<K extends ChatItem["kind"]>(kind: K, fn: (it: Extract<ChatItem, { kind: K }>) => ChatItem): boolean {
  const items = S().items;
  const last = items[items.length - 1];
  if (!last || last.kind !== kind) return false;
  useAISession.setState({ items: [...items.slice(0, -1), fn(last as Extract<ChatItem, { kind: K }>)] });
  return true;
}

export async function refreshSettings(): Promise<ServerSettings | null> {
  try {
    const s = await api.getSettings();
    S().set({ settings: s });
    return s;
  } catch {
    return null;
  }
}

export function newChat(): void {
  stop();
  S().set({ items: [], history: [] });
}

export function stop(): void {
  abort?.abort();
  abort = null;
}

// ---------------------------------------------------------------- applying edits

/** Start an export through the Export panel's client (renders titles/captions to PNG, then POSTs /api/export). */
export async function startExportWithGraphics(sequenceId: ID, settings: ExportSettings): Promise<void> {
  const project = useEditor.getState().project;
  if (!project.sequences[sequenceId]) throw new Error("Sequence not found");
  const job = await submitExport(project, sequenceId, settings);
  push({ kind: "notice", id: seq++, text: `Export started → ${job.outputPath}` });
  useEditor.getState().toast(`Exporting ${settings.fileName}…`, "success");
}

// ---------------------------------------------------------------- sending

export interface SendOptions { shareFrame?: boolean; displayText?: string }

export async function sendMessage(message: string, opts: SendOptions = {}): Promise<void> {
  const text = message.trim();
  if (!text || S().running) return;
  const ed = useEditor.getState();
  const seqId = ed.project.activeSequenceId;
  const share = (opts.shareFrame ?? S().shareFrame) && !!seqId;
  let programFrame: string | undefined;
  if (share) {
    try {
      programFrame = await captureProgramFrame(960, 0.8);
    } catch {
      programFrame = undefined;
    }
  }
  push({ kind: "user", id: seq++, text: opts.displayText ?? text, withFrame: !!programFrame });
  S().set({ running: true });
  abort = new AbortController();
  const turn: TurnState = { label: `Claude: ${truncate(opts.displayText ?? text, 40)}`, pastLen: -1, applied: false };
  const jobId = "ai-turn";
  ed.setJob(jobId, { label: "Claude is editing…", progress: 0.5 });

  const onEvent = (e: AIEvent) => {
    switch (e.type) {
      case "text":
        if (!updateLast("text", (it) => ({ ...it, text: it.text + e.text }))) {
          finishThinking();
          push({ kind: "text", id: seq++, text: e.text.replace(/^\n+/, "") });
        }
        break;
      case "thinking":
        if (!updateLast("thinking", (it) => (it.done ? it : { ...it, text: it.text + e.text }))) push({ kind: "thinking", id: seq++, text: e.text });
        break;
      case "tool_start":
        finishThinking();
        push({ kind: "tool", id: seq++, toolId: e.id, name: e.name, input: e.input, status: "running" });
        break;
      case "tool_result":
        useAISession.setState((s) => ({ items: s.items.map((it) => (it.kind === "tool" && it.toolId === e.id ? { ...it, status: e.isError ? "error" : "done", summary: e.summary } : it)) }));
        break;
      case "project":
        applyProjectEvent(e.project, turn);
        break;
      case "export_started":
        push({ kind: "notice", id: seq++, text: `Export started → ${e.job.outputPath}` });
        break;
      case "export_request":
        startExportWithGraphics(e.sequenceId, e.settings).catch((err) => push({ kind: "error", id: seq++, text: `Export failed: ${(err as Error).message}` }));
        break;
      case "done":
        S().set({ history: e.messages });
        break;
      case "error":
        push({ kind: "error", id: seq++, text: e.error });
        if (/API key/i.test(e.error)) refreshSettings();
        break;
    }
  };

  try {
    await streamAIChat(
      { project: ed.project, sequenceId: seqId, selection: { clipIds: ed.selection.clipIds, itemIds: ed.selection.itemIds }, playhead: usePlayback.getState().time, history: S().history, message: text, programFrame },
      onEvent,
      abort.signal,
    );
  } catch (err) {
    if ((err as Error).name !== "AbortError") push({ kind: "error", id: seq++, text: (err as Error).message || "Connection to the EditCut server failed." });
    else push({ kind: "notice", id: seq++, text: "Stopped." });
  } finally {
    finishThinking();
    useAISession.setState((s) => ({ running: false, items: s.items.map((it) => (it.kind === "tool" && it.status === "running" ? { ...it, status: "error", summary: "interrupted" } : it)) }));
    useEditor.getState().setJob(jobId, null);
    abort = null;
  }
}

function finishThinking(): void {
  updateLast("thinking", (it) => ({ ...it, done: true }));
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Open the assistant panel and send a prompt (used by AI menu commands). */
export function askClaude(prompt: string, opts: SendOptions = {}): void {
  window.dispatchEvent(new CustomEvent("editcut:open-ai"));
  void sendMessage(prompt, opts);
}
