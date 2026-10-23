// AI Assistant panel — chat with Claude, who edits the timeline with tools.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, CircleAlert, Brain, Check, ImageOff, Image as ImageIcon, LoaderCircle, Plus, Send, Settings, Sparkles, Square, KeyRound } from "lucide-react";
import { formatTimecode } from "@shared/time";
import { api } from "../../api";
import { useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { IconButton, Select } from "../../ui/kit";
import { Markdown, toolLabel } from "./toolLabels";
import { newChat, refreshSettings, sendMessage, stop, useAISession, type ChatItem } from "./aiSession";
import "./ai.css";

export const MODELS = [
  { value: "claude-opus-5-5", label: "Claude Opus 5.5 (best)" },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster)" },
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest)" },
  { value: "claude-fable-5-1", label: "Claude Fable 5.1" },
];

export const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Rough cut from my clips", prompt: "Make a rough cut from my clips. Review the media first (transcripts for talking footage, a few frames for visual footage), pick the strongest moments and assemble them in a logical order in a new sequence. Keep it tight." },
  { label: "Remove silences", prompt: "Remove the silences and long pauses from the dialogue in the active sequence, keeping natural breathing room." },
  { label: "Add captions", prompt: "Add captions for all dialogue in the active sequence (standard subtitles, max 2 lines of 42 characters)." },
  { label: "Make it vertical for TikTok", prompt: "Make a vertical 9:16 version of this sequence for TikTok: auto reframe keeping the subjects in frame (check the frames to choose focus points), and add social-style captions if there's dialogue." },
  { label: "Color grade cinematic", prompt: "Give the sequence a cinematic color grade. Look at a few frames first, fix exposure and white balance if needed, then apply a tasteful cinematic look." },
  { label: "Add title", prompt: "Add an opening title at the start of the sequence that fits the content." },
  { label: "Tighten pacing", prompt: "Tighten the pacing of the active sequence: remove filler words, long pauses and weak or repeated moments, keeping complete sentences." },
  { label: "Duck music under voice", prompt: "Lower the music under the dialogue (auto-duck) so the voice is always clear, and make the music fade out at the end." },
  { label: "Export for YouTube", prompt: "Export the active sequence for YouTube at 1080p." },
];

function ToolRow({ it }: { it: Extract<ChatItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const { text, icon: Icon } = toolLabel(it.name, it.status);
  return (
    <div className={"ai-tool " + it.status}>
      <div className="ai-tool-head" onClick={() => setOpen(!open)} title="Show details">
        <span className="ai-tool-icon">{it.status === "running" ? <LoaderCircle size={13} className="spin" /> : it.status === "error" ? <CircleAlert size={13} /> : <Icon size={13} />}</span>
        <span className="ai-tool-label">{text}</span>
        {it.summary ? <span className="ai-tool-summary">{it.summary}</span> : null}
        <ChevronRight size={12} className={"ai-tool-twirl" + (open ? " open" : "")} />
      </div>
      {open ? <pre className="ai-tool-detail">{it.name}({JSON.stringify(it.input, null, 1)}){it.summary ? `\n→ ${it.summary}` : ""}</pre> : null}
    </div>
  );
}

function Thinking({ it }: { it: Extract<ChatItem, { kind: "thinking" }> }) {
  const [open, setOpen] = useState(false);
  const first = it.text.trim().split("\n")[0]?.replace(/^[#*\s]+|\*+$/g, "") || "Thinking";
  return (
    <div className="ai-thinking">
      <div className="ai-thinking-head" onClick={() => setOpen(!open)}>
        <Brain size={12} />
        <span className="ai-thinking-title">{it.done ? first : "Thinking…"}</span>
        <ChevronRight size={12} className={"ai-tool-twirl" + (open ? " open" : "")} />
      </div>
      {open ? <div className="ai-thinking-body"><Markdown text={it.text} /></div> : null}
    </div>
  );
}

function Item({ it }: { it: ChatItem }) {
  switch (it.kind) {
    case "user":
      return (
        <div className="ai-msg user">
          <div className="ai-bubble">{it.text}</div>
          {it.withFrame ? <div className="ai-msg-meta"><ImageIcon size={11} /> frame shared</div> : null}
        </div>
      );
    case "text":
      return <div className="ai-msg assistant"><Markdown text={it.text} /></div>;
    case "thinking":
      return <Thinking it={it} />;
    case "tool":
      return <ToolRow it={it} />;
    case "error":
      return <div className="ai-error"><CircleAlert size={13} /> <span>{it.text}</span></div>;
    case "notice":
      return <div className="ai-notice"><Check size={12} /> {it.text}</div>;
  }
}

function SetupCard() {
  const settings = useAISession((s) => s.settings);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(settings?.model ?? "claude-opus-5-5");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const s = await api.saveSettings({ anthropicApiKey: key, model });
      useAISession.getState().set({ settings: s });
      useEditor.getState().toast(s.hasApiKey ? "Claude is ready" : "Key not saved", s.hasApiKey ? "success" : "error");
    } catch (e) {
      useEditor.getState().toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ai-setup">
      <div className="ai-setup-title"><KeyRound size={15} /> Connect Claude</div>
      <p className="muted">Add your Anthropic API key to let Claude cut, color, caption and export your timeline. It's stored only on this machine (~/EditCut/settings.json).</p>
      <input className="text-input" type="password" placeholder="sk-ant-…" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && key.trim()) void save(); }} />
      <div className="row" style={{ gap: 6 }}>
        <Select value={model} options={MODELS} onChange={setModel} style={{ flex: 1 }} />
        <button className="btn primary" disabled={!key.trim() || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
      <a className="ai-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Get an API key →</a>
    </div>
  );
}

function ContextBar() {
  const seqName = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId]?.name : null));
  const fps = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId]?.settings.fps ?? 30 : 30));
  const selCount = useEditor((s) => s.selection.clipIds.length);
  const mediaCount = useEditor((s) => Object.keys(s.project.media).length);
  const time = usePlayback((s) => Math.round(s.time * 10) / 10);
  const share = useAISession((s) => s.shareFrame);
  return (
    <div className="ai-context" title="What Claude will see with your next message">
      <span className="ai-chip-ctx">{seqName ? `▶ ${seqName}` : "No sequence"}</span>
      <span className="ai-chip-ctx">{mediaCount} media</span>
      {selCount ? <span className="ai-chip-ctx">{selCount} selected</span> : null}
      <span className="ai-chip-ctx mono">{formatTimecode(time, fps)}</span>
      <span className="spacer" />
      <button className={"ai-frame-toggle" + (share ? " on" : "")} onClick={() => useAISession.getState().set({ shareFrame: !share })} title="Share the current Program Monitor frame with Claude">
        {share ? <ImageIcon size={12} /> : <ImageOff size={12} />} Share frame
      </button>
    </div>
  );
}

export default function AssistantPanel() {
  const items = useAISession((s) => s.items);
  const running = useAISession((s) => s.running);
  const settings = useAISession((s) => s.settings);
  const draft = useAISession((s) => s.draft);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    void refreshSettings();
    const focus = () => setTimeout(() => input.current?.focus(), 30);
    window.addEventListener("editcut:ai-focus", focus);
    return () => window.removeEventListener("editcut:ai-focus", focus);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  }, [draft]);

  const send = (text = draft) => {
    if (!text.trim() || running) return;
    useAISession.getState().set({ draft: "" });
    stick.current = true;
    void sendMessage(text);
  };

  const noKey = settings && !settings.hasApiKey;
  const model = MODELS.find((m) => m.value === settings?.model)?.label.replace(/ \(.*\)/, "") ?? settings?.model;

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <span className="ai-logo"><Sparkles size={13} /></span>
        <span className="ai-title">Claude</span>
        {model ? <span className="ai-model" title="Model (change in AI Settings)">{model}</span> : null}
        <span className="spacer" />
        <IconButton title="New chat" onClick={newChat}><Plus size={14} /></IconButton>
        <IconButton title="AI Settings" onClick={() => useEditor.getState().openDialog("aiSettings")}><Settings size={14} /></IconButton>
      </div>

      <div className="ai-scroll" ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {noKey ? <SetupCard /> : null}
        {!items.length ? (
          <div className="ai-empty">
            <div className="ai-empty-mark"><Sparkles size={22} /></div>
            <div className="ai-empty-title">What should we make?</div>
            <div className="muted ai-empty-sub">Describe the edit — "make a 30-second highlight reel with captions and upbeat color" — and Claude will cut it on your timeline. Every turn is one undo step.</div>
            <div className="ai-chips grid">
              {QUICK_ACTIONS.map((q) => (
                <button key={q.label} className="ai-chip" disabled={running || !!noKey} onClick={() => send(q.prompt)}>{q.label}</button>
              ))}
            </div>
          </div>
        ) : (
          items.map((it) => <Item key={it.id} it={it} />)
        )}
        {running && items[items.length - 1]?.kind === "user" ? <div className="ai-working"><LoaderCircle size={13} className="spin" /> Claude is looking at your project…</div> : null}
      </div>

      {items.length ? (
        <div className="ai-chips scroll">
          {QUICK_ACTIONS.map((q) => (
            <button key={q.label} className="ai-chip small" disabled={running || !!noKey} onClick={() => send(q.prompt)}>{q.label}</button>
          ))}
        </div>
      ) : null}
      <ContextBar />
      <div className="ai-input">
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={noKey ? "Add your API key above to start" : "Ask Claude to edit…  (Enter to send, Shift+Enter for a new line)"}
          onChange={(e) => useAISession.getState().set({ draft: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        {running ? (
          <button className="ai-send stop" onClick={stop} title="Stop"><Square size={13} /></button>
        ) : (
          <button className="ai-send" onClick={() => send()} disabled={!draft.trim() || !!noKey} title="Send"><Send size={14} /></button>
        )}
      </div>
    </div>
  );
}
