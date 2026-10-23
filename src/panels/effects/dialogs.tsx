// Dialogs: Save Preset (Effect Controls) and Title Templates (Graphics).
import { useEffect, useMemo, useState } from "react";
import { EFFECT_MAP } from "@shared/effects";
import { uid } from "@shared/factory";
import { Button, Dialog, TextInput } from "../../ui/kit";
import { useEditor, getActiveSequence } from "../../store/store";
import { drawGenerator } from "../../render/graphics";
import { saveUserPreset, type UserPreset } from "./presets";
import { insertTemplate, TITLE_TEMPLATES, type TitleTemplate } from "./graphicsOps";

export function SavePresetDialog(props: { onClose: () => void; clipId?: string; effectIds?: string[] }) {
  const seq = getActiveSequence();
  const clip = seq?.clips.find((c) => c.id === props.clipId);
  const fxs = (clip?.effects ?? []).filter((e) => props.effectIds?.includes(e.id));
  const [name, setName] = useState(fxs.length === 1 ? `${EFFECT_MAP[fxs[0].type]?.name ?? "Effect"} Preset` : "My Preset");
  const [type, setType] = useState<UserPreset["type"]>("scale");
  const save = () => {
    if (!clip || !fxs.length) return props.onClose();
    const kind = EFFECT_MAP[fxs[0].type]?.kind === "audio" ? "audio" : "video";
    saveUserPreset({ id: uid("pre_"), name: name.trim() || "Preset", kind, effects: JSON.parse(JSON.stringify(fxs)), type, sourceDuration: clip.duration });
    useEditor.getState().toast(`Saved preset “${name}” (Effects › Presets › My Presets)`, "success");
    props.onClose();
  };
  return (
    <Dialog title="Save Preset" onClose={props.onClose} width={420} footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary onClick={save}>OK</Button></>}>
      <div className="form-grid">
        <label>Name</label>
        <TextInput value={name} onChange={setName} autoFocus onEnter={save} />
        <label>Type</label>
        <div className="col-radios">
          {([["scale", "Scale"], ["in", "Anchor to In Point"], ["out", "Anchor to Out Point"]] as const).map(([v, l]) => (
            <label key={v} className="checkbox"><input type="radio" checked={type === v} onChange={() => setType(v)} />{l}</label>
          ))}
        </div>
        <label>Effects</label>
        <span className="muted">{fxs.map((f) => EFFECT_MAP[f.type]?.name ?? f.type).join(", ") || "(none)"}</span>
      </div>
    </Dialog>
  );
}

function useTemplatePreview(tpl: TitleTemplate, W: number, H: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const out = document.createElement("canvas");
    out.width = 256;
    out.height = Math.round((256 * H) / W);
    const ctx = out.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, out.width, out.height);
    g.addColorStop(0, "#3b4a5e");
    g.addColorStop(1, "#1a2028");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, out.width, out.height);
    const layer = document.createElement("canvas");
    layer.width = W;
    layer.height = H;
    const lctx = layer.getContext("2d")!;
    const k = out.width / W;
    for (const L of tpl.build(W, H)) {
      drawGenerator(lctx, L.gen, W, H);
      const dx = ((L.x ?? 0.5) - 0.5) * W, dy = ((L.y ?? 0.5) - 0.5) * H;
      ctx.drawImage(layer, dx * k, dy * k, out.width, out.height);
    }
    setUrl(out.toDataURL());
  }, [tpl, W, H]);
  return url;
}

function TemplateCard({ tpl, W, H, onPick }: { tpl: TitleTemplate; W: number; H: number; onPick: () => void }) {
  const url = useTemplatePreview(tpl, W, H);
  return (
    <button className="tt-card" onClick={onPick} title={tpl.description}>
      <div className="tt-thumb" style={{ aspectRatio: `${W} / ${H}` }}>{url ? <img src={url} alt="" /> : null}</div>
      <div className="tt-name">{tpl.name}</div>
      <div className="tt-desc muted">{tpl.description}</div>
    </button>
  );
}

export function TitleTemplatesDialog(props: { onClose: () => void }) {
  const seq = getActiveSequence();
  const W = seq?.settings.width ?? 1920, H = seq?.settings.height ?? 1080;
  const [q, setQ] = useState("");
  const list = useMemo(() => TITLE_TEMPLATES.filter((t) => !q || (t.name + t.description).toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <Dialog title="Title Templates" onClose={props.onClose} width={760} footer={<Button onClick={props.onClose}>Close</Button>}>
      <TextInput value={q} onChange={setQ} placeholder="Search templates" autoFocus style={{ width: "100%", marginBottom: 10 }} />
      <div className="tt-grid">
        {list.map((t) => (
          <TemplateCard key={t.id} tpl={t} W={W} H={H} onPick={() => { insertTemplate(t); props.onClose(); }} />
        ))}
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Templates are added at the playhead on the first free video tracks above existing clips. Each layer is an editable text or shape graphic.</div>
    </Dialog>
  );
}
