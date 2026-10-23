// AI Settings (registerDialog "aiSettings"): API key, model, speech model, export folder.
// Also the "Translate captions" dialog.
import { useEffect, useState } from "react";
import { api, type ServerSettings } from "../../api";
import { registerDialog } from "../../ui/dialogs";
import { Button, Dialog, Progress, Select, TextInput } from "../../ui/kit";
import { useEditor } from "../../store/store";
import { MODELS } from "./AssistantPanel";
import { askClaude, useAISession } from "./aiSession";

interface WhisperInfo {
  available: boolean;
  model?: string;
  binary?: string;
  download?: { active: boolean; progress: number; file?: string; error?: string; done?: boolean };
  models: Record<string, { file: string; sizeMb: number; label: string }>;
}

const getWhisper = () => fetch("/api/ai/whisper").then((r) => r.json() as Promise<WhisperInfo>);

function AISettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<ServerSettings | null>(null);
  const [key, setKey] = useState("");
  const [model, setModel] = useState("claude-opus-5-5");
  const [exportDir, setExportDir] = useState("");
  const [whisper, setWhisper] = useState<WhisperInfo | null>(null);
  const [dlModel, setDlModel] = useState("base");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((x) => {
      setS(x);
      setModel(x.model);
      setExportDir(x.exportDirectory);
    }).catch(() => undefined);
    getWhisper().then(setWhisper).catch(() => undefined);
  }, []);

  // poll while a model download is running
  useEffect(() => {
    if (!whisper?.download?.active) return;
    const t = setInterval(() => getWhisper().then(setWhisper).catch(() => undefined), 700);
    return () => clearInterval(t);
  }, [whisper?.download?.active]);

  const save = async () => {
    setSaving(true);
    try {
      const patch: Parameters<typeof api.saveSettings>[0] = { model, exportDirectory: exportDir };
      if (key.trim()) patch.anthropicApiKey = key.trim();
      const next = await api.saveSettings(patch);
      useAISession.getState().set({ settings: next });
      useEditor.getState().toast("Settings saved", "success");
      onClose();
    } catch (e) {
      useEditor.getState().toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    const next = await api.saveSettings({ anthropicApiKey: "" });
    setS(next);
    useAISession.getState().set({ settings: next });
  };

  const download = async () => {
    const r = await fetch("/api/ai/whisper/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: dlModel }) });
    if (!r.ok) useEditor.getState().toast((await r.json().catch(() => ({}))).error ?? "Download failed", "error");
    setWhisper(await getWhisper());
  };

  const dl = whisper?.download;
  return (
    <Dialog title="AI Settings" onClose={onClose} width={560} footer={<><Button onClick={onClose}>Cancel</Button><Button primary onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
      <div className="ai-settings">
        <div className="form-grid">
          <label>Anthropic API key</label>
          <div className="row" style={{ gap: 6 }}>
            <input className="text-input" type="password" autoComplete="off" placeholder={s?.hasApiKey ? "•••••••• saved — paste to replace" : "sk-ant-…"} value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            {s?.hasApiKey ? <Button small onClick={removeKey}>Remove</Button> : null}
          </div>
          <span className="hint">{s?.hasApiKey ? <span className="ai-ok">✓ Key configured</span> : <span className="ai-bad">No key — Claude can't edit until you add one.</span>} Stored locally in your EditCut data folder.</span>

          <label>Model</label>
          <Select value={model} options={MODELS.some((m) => m.value === model) ? MODELS : [...MODELS, { value: model, label: model }]} onChange={setModel} />
          <span className="hint">Opus 5.5 gives the best edits; Sonnet/Haiku respond faster.</span>

          <label>Speech-to-text</label>
          <div>
            {whisper ? (
              whisper.available ? (
                <span className="ai-ok">✓ whisper.cpp ready ({whisper.model})</span>
              ) : (
                <span className="ai-bad">{whisper.binary ? "No speech model installed" : "whisper.cpp not found (brew install whisper-cpp)"}</span>
              )
            ) : (
              <span className="muted">Checking…</span>
            )}
          </div>
          <label />
          <div className="row" style={{ gap: 6 }}>
            <Select value={dlModel} options={Object.entries(whisper?.models ?? { base: { label: "Base (multilingual, 142 MB)" } }).map(([k, v]) => ({ value: k, label: (v as { label: string }).label }))} onChange={setDlModel} style={{ flex: 1 }} />
            <Button small onClick={download} disabled={!!dl?.active || !whisper?.binary}>{dl?.active ? "Downloading…" : "Download speech model"}</Button>
          </div>
          {dl?.active ? (<><label /><Progress value={dl.progress} /></>) : null}
          {dl?.error ? (<><label /><span className="ai-bad">{dl.error}</span></>) : null}
          {dl?.done ? (<><label /><span className="ai-ok">Downloaded {dl.file}</span></>) : null}

          <label>Export folder</label>
          <TextInput value={exportDir} onChange={setExportDir} />
          {s ? <span className="hint">Data folder: {s.dataDirectory}</span> : null}
        </div>
      </div>
    </Dialog>
  );
}

const LANGS = ["Spanish", "French", "German", "Portuguese", "Italian", "Hindi", "Japanese", "Korean", "Chinese (Simplified)", "Arabic", "Russian", "English"];

function TranslateCaptionsDialog({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState("Spanish");
  const go = () => {
    onClose();
    askClaude(
      `Translate every caption in the active sequence into ${lang} with update_text, keeping each caption's timing and line breaks (max ~42 characters per line). Translate in place and keep names and brand terms unchanged.`,
      { shareFrame: false, displayText: `Translate captions to ${lang}` },
    );
  };
  return (
    <Dialog title="Translate Captions" onClose={onClose} width={380} footer={<><Button onClick={onClose}>Cancel</Button><Button primary onClick={go}>Translate with Claude</Button></>}>
      <div className="form-grid">
        <label>Language</label>
        <Select value={lang} options={LANGS} onChange={setLang} />
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>Claude rewrites the caption text in place; timings stay the same. Undo with ⌘Z.</p>
    </Dialog>
  );
}

registerDialog("aiSettings", AISettingsDialog as never);
registerDialog("captionsTranslate", TranslateCaptionsDialog as never);
