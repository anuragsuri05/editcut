// Properties panel (Premiere 25 context-aware Properties / Essential Graphics "Edit").
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Clip, Generator, Sequence, TextStyle } from "@shared/types";
import { EFFECT_MAP } from "@shared/effects";
import { evalParam, setParamAt } from "@shared/params";
import { makeEffect } from "@shared/factory";
import { getClip, setClipSpeed } from "@shared/ops";
import { useEditor, useActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { getCommand, runCommand } from "../../commands/registry";
import { Button, Checkbox, ColorInput, HotNumber, Section, Select, SliderRow } from "../../ui/kit";
import { commit, commitSeq, live, liveSeq } from "./liveEdit";
import { formatDb, formatRotation, isAudio, isVisual, localTime, paramDefault, parseRotation, selectedClips, sourceSize, getParam } from "./model";
import { alignSelected, type AlignMode } from "./graphicsOps";
import { PropRow, SubHead } from "./widgets";
import "./effects.css";

const FONTS = [
  "Inter, Helvetica, Arial, sans-serif", "Helvetica, Arial, sans-serif", "Arial, sans-serif", "Arial Black, sans-serif",
  "Verdana, sans-serif", "Tahoma, sans-serif", "Trebuchet MS, sans-serif", "Futura, 'Trebuchet MS', sans-serif",
  "Avenir Next, Avenir, sans-serif", "Gill Sans, sans-serif", "Impact, sans-serif", "system-ui, sans-serif",
  "Georgia, serif", "'Times New Roman', Times, serif", "Palatino, 'Palatino Linotype', serif", "Baskerville, serif",
  "'Courier New', Courier, monospace", "Menlo, Consolas, monospace", "'Comic Sans MS', cursive", "'Brush Script MT', cursive",
];
const fontLabel = (f: string) => f.split(",")[0].replace(/'/g, "");
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const WEIGHT_NAMES: Record<number, string> = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra Bold", 900: "Black" };

export default function PropertiesPanel() {
  const seq = useActiveSequence();
  const ids = useEditor((s) => s.selection.clipIds);
  const time = usePlayback((s) => s.time);
  const clips = useMemo(() => selectedClips(seq, ids), [seq, ids]);
  if (!seq) return <div className="panel-empty">(no sequence)</div>;
  if (!clips.length) return <NothingSelected />;
  const visual = clips.filter((c) => isVisual(seq, c));
  const audio = clips.filter((c) => isAudio(seq, c));
  const texts = visual.filter((c) => c.generator?.kind === "text");
  const shapes = visual.filter((c) => c.generator?.kind === "shape");
  const mattes = visual.filter((c) => c.generator?.kind === "colorMatte");
  const media = visual.filter((c) => !c.generator);
  const title =
    texts.length && texts.length === visual.length ? (texts.length > 1 ? `${texts.length} text layers` : "Text")
    : shapes.length && shapes.length === visual.length ? "Shape"
    : visual.length ? (visual.length > 1 ? `${visual.length} clips` : visual[0].generator ? visual[0].name : "Video")
    : audio.length > 1 ? `${audio.length} audio clips` : "Audio";
  return (
    <div className="props">
      <div className="props-head">
        <span className="props-kind">{title}</span>
        <span className="muted props-name">{clips.length === 1 ? clips[0].name : `${clips.length} selected`}</span>
      </div>
      <div className="props-body">
        {texts.length && texts.length === visual.length ? <TextProps seq={seq} clips={texts} /> : null}
        {shapes.length && shapes.length === visual.length ? <ShapeProps clips={shapes} /> : null}
        {mattes.length && mattes.length === visual.length ? <MatteProps clips={mattes} /> : null}
        {visual.length ? <TransformProps seq={seq} clips={visual} time={time} graphic={!media.length} /> : null}
        {media.length ? <QuickActions seq={seq} clips={media} /> : null}
        {visual.length && !visual.every((c) => c.generator && c.generator.kind !== "adjustmentLayer") ? <LumetriQuick clips={visual.filter((c) => !c.generator || c.generator.kind === "adjustmentLayer")} time={time} /> : null}
        {audio.length ? <AudioProps clips={audio} time={time} /> : null}
      </div>
    </div>
  );
}

function NothingSelected() {
  const act = (id: string, label: string, icon: ReactNode) => (
    <button className="props-action" disabled={!getCommand(id)} onClick={() => runCommand(id)}>
      <span className="props-action-icon">{icon}</span>
      {label}
    </button>
  );
  return (
    <div className="props props-none">
      <div className="props-none-title">Select a clip</div>
      <div className="muted">Properties shows controls for whatever is selected in the timeline: text, shapes, video, or audio.</div>
      <SubHead>Quick actions</SubHead>
      <div className="props-actions">
        {act("graphics.newText", "New Text", <b>T</b>)}
        {act("graphics.newRectangle", "Rectangle", "▭")}
        {act("graphics.newEllipse", "Ellipse", "◯")}
        {act("graphics.titleTemplates", "Title Templates", "▤")}
        {act("captions.generate", "Generate Captions", "CC")}
        {act("file.newAdjustmentLayer", "Adjustment Layer", "◫")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shared helpers
/** Values of a param path across clips at the playhead; `mixed` when they differ. */
function readParam(clips: Clip[], path: string, time: number) {
  const vals = clips.map((c) => evalParam(getParam(c, path), localTime(c, time), paramDefault(c, path)));
  const mixed = vals.some((v) => Math.abs(v - vals[0]) > 1e-6);
  return { value: vals[0] ?? 0, mixed };
}

function writeParam(ids: string[], path: string, v: number, label: string, final: boolean) {
  const t = usePlayback.getState().time;
  const f = (s: Sequence) => {
    for (const id of ids) {
      const c = getClip(s, id);
      const p = c && getParam(c, path);
      if (c && p) setParamAt(p, localTime(c, t), v);
    }
  };
  if (final) commitSeq(label, f);
  else liveSeq(f);
}

function NumParam(props: { clips: Clip[]; path: string; label: string; time: number; min?: number; max?: number; step?: number; decimals?: number; unit?: string; format?: (v: number) => string; parse?: (s: string) => number | null; disabled?: boolean }) {
  const ids = props.clips.map((c) => c.id);
  const { value, mixed } = readParam(props.clips, props.path, props.time);
  return (
    <HotNumber
      value={value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      decimals={props.decimals ?? 1}
      unit={mixed ? undefined : props.unit}
      format={mixed ? () => "—" : props.format}
      parse={props.parse}
      disabled={props.disabled}
      title={mixed ? "Mixed values" : props.label}
      onChange={(v) => writeParam(ids, props.path, v, props.label, false)}
      onCommit={(v) => writeParam(ids, props.path, v, props.label, true)}
    />
  );
}

// ---------------------------------------------------------------- transform
function TransformProps({ clips, time, graphic }: { seq: Sequence; clips: Clip[]; time: number; graphic: boolean }) {
  const uniform = clips.every((c) => c.motion?.uniformScale !== false);
  const align = (m: AlignMode) => alignSelected(m);
  const [cropOpen, setCropOpen] = useState(false);
  return (
    <Section title={graphic ? "Align and Transform" : "Transform"}>
      <div className="props-align">
        <span className="muted">Align</span>
        <AlignBtn title="Align left" onClick={() => align("left")} d="M2 2 V14 M4 5 H12 V7 H4 Z M4 9 H9 V11 H4 Z" />
        <AlignBtn title="Align horizontal center" onClick={() => align("hcenter")} d="M8 2 V14 M3 5 H13 V7 H3 Z M5 9 H11 V11 H5 Z" />
        <AlignBtn title="Align right" onClick={() => align("right")} d="M14 2 V14 M4 5 H12 V7 H4 Z M7 9 H12 V11 H7 Z" />
        <span className="props-sep" />
        <AlignBtn title="Align top" onClick={() => align("top")} d="M2 2 H14 M5 4 V12 H7 V4 Z M9 4 V9 H11 V4 Z" />
        <AlignBtn title="Align vertical center" onClick={() => align("vcenter")} d="M2 8 H14 M5 3 V13 H7 V3 Z M9 5 V11 H11 V5 Z" />
        <AlignBtn title="Align bottom" onClick={() => align("bottom")} d="M2 14 H14 M5 4 V12 H7 V4 Z M9 7 V12 H11 V7 Z" />
        <span className="props-sep" />
        <button className="props-mini" title="Center in video frame" onClick={() => align("center")}>⊕</button>
      </div>
      <PropRow label="Position">
        <NumParam clips={clips} time={time} path="motion.positionX" label="Position X" />
        <NumParam clips={clips} time={time} path="motion.positionY" label="Position Y" />
      </PropRow>
      <PropRow label={uniform ? "Scale" : "Scale Height"}>
        <NumParam clips={clips} time={time} path="motion.scale" label="Scale" min={0} max={10000} step={0.5} unit="%" />
        {!uniform ? <NumParam clips={clips} time={time} path="motion.scaleWidth" label="Scale Width" min={0} max={10000} step={0.5} unit="%" /> : null}
        <Checkbox
          checked={uniform}
          label="Uniform"
          onChange={(v) => useEditor.getState().applySeq("Uniform Scale", (s) => { for (const c0 of clips) { const c = getClip(s, c0.id); if (c?.motion) { c.motion.uniformScale = v; if (!v) c.motion.scaleWidth = JSON.parse(JSON.stringify(c.motion.scale)); } } })}
        />
      </PropRow>
      <PropRow label="Rotation">
        <NumParam clips={clips} time={time} path="motion.rotation" label="Rotation" step={0.5} format={formatRotation} parse={parseRotation} />
      </PropRow>
      <PropRow label="Anchor Point">
        <NumParam clips={clips} time={time} path="motion.anchorX" label="Anchor X" />
        <NumParam clips={clips} time={time} path="motion.anchorY" label="Anchor Y" />
      </PropRow>
      <PropRow label="Opacity">
        <NumParam clips={clips} time={time} path="opacity.opacity" label="Opacity" min={0} max={100} step={0.5} unit="%" />
      </PropRow>
      <div className="props-twirl" onClick={() => setCropOpen(!cropOpen)}>
        <span className={"twirl" + (cropOpen ? " open" : "")}>▸</span> Crop
      </div>
      {cropOpen ? (
        <div className="props-crop">
          {(["cropLeft", "cropTop", "cropRight", "cropBottom"] as const).map((k) => (
            <PropRow key={k} label={k.replace("crop", "")}>
              <NumParam clips={clips} time={time} path={`motion.${k}`} label={`Crop ${k.slice(4)}`} min={0} max={100} step={0.2} unit="%" />
            </PropRow>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function AlignBtn(props: { title: string; d: string; onClick: () => void }) {
  return (
    <button className="props-mini" title={props.title} onClick={props.onClick}>
      <svg width="14" height="14" viewBox="0 0 16 16"><path d={props.d} fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
    </button>
  );
}

// ---------------------------------------------------------------- quick actions (media clips)
function QuickActions({ clips }: { seq: Sequence; clips: Clip[] }) {
  const ids = clips.map((c) => c.id);
  const speeds = clips.map((c) => c.speed);
  const mixedSpeed = speeds.some((s) => Math.abs(s - speeds[0]) > 1e-6);
  const fit = (mode: "fit" | "fill") => {
    const t = usePlayback.getState().time;
    useEditor.getState().applySeq(mode === "fit" ? "Set to Frame Size" : "Fill Frame", (s) => {
      for (const id of ids) {
        const c = getClip(s, id);
        if (!c?.motion) continue;
        const { w, h } = sourceSize(c);
        const sx = s.settings.width / w, sy = s.settings.height / h;
        const sc = Math.round((mode === "fill" ? Math.max(sx, sy) : Math.min(sx, sy)) * 10000) / 100;
        const lt = localTime(c, t);
        setParamAt(c.motion.scale, lt, sc);
        setParamAt(c.motion.positionX, lt, s.settings.width / 2);
        setParamAt(c.motion.positionY, lt, s.settings.height / 2);
      }
    });
  };
  return (
    <Section title="Quick Actions">
      <div className="props-qa">
        <Button small onClick={() => fit("fit")}>Fit to Frame</Button>
        <Button small onClick={() => fit("fill")}>Fill Frame</Button>
        <Button small disabled={!getCommand("clip.autoReframe")} onClick={() => runCommand("clip.autoReframe")}>Auto Reframe</Button>
      </div>
      <PropRow label="Speed">
        <HotNumber
          value={speeds[0] * 100}
          min={1}
          max={10000}
          decimals={1}
          unit={mixedSpeed ? undefined : "%"}
          format={mixedSpeed ? () => "—" : undefined}
          onChange={(v) => liveSeq((s, p) => { for (const id of ids) setClipSpeed(p, s, id, v / 100); })}
          onCommit={(v) => commitSeq("Speed", (s, p) => { for (const id of ids) setClipSpeed(p, s, id, v / 100); })}
        />
        <Button small disabled={!getCommand("clip.speedDuration")} onClick={() => runCommand("clip.speedDuration")}>Speed/Duration…</Button>
      </PropRow>
    </Section>
  );
}

// ---------------------------------------------------------------- Lumetri basics
function LumetriQuick({ clips, time }: { clips: Clip[]; time: number }) {
  if (!clips.length) return null;
  const def = EFFECT_MAP.lumetri;
  const first = clips[0];
  const fx = first.effects.find((e) => e.type === "lumetri");
  const val = (k: string) => (fx ? evalParam(fx.params[k], localTime(first, time), def.params.find((p) => p.key === k)!.default) : def.params.find((p) => p.key === k)!.default);
  const write = (k: string, v: number, final: boolean) => {
    const t = usePlayback.getState().time;
    const f = (s: Sequence) => {
      for (const c0 of clips) {
        const c = getClip(s, c0.id);
        if (!c) continue;
        let e = c.effects.find((x) => x.type === "lumetri");
        if (!e) {
          c.effects.push(makeEffect("lumetri"));
          e = c.effects[c.effects.length - 1];
        }
        e.params[k] ??= { value: def.params.find((p) => p.key === k)!.default };
        setParamAt(e.params[k], localTime(c, t), v);
      }
    };
    if (final) commitSeq(def.params.find((p) => p.key === k)!.label, f);
    else liveSeq(f);
  };
  const row = (k: string) => {
    const d = def.params.find((p) => p.key === k)!;
    return <SliderRow key={k} label={d.label} value={val(k)} min={d.min} max={d.max} step={d.step ?? (d.max - d.min) / 400} defaultValue={d.default} onChange={(v) => write(k, v, false)} onCommit={(v) => write(k, v, true)} />;
  };
  return (
    <Section title="Color (Lumetri)" defaultOpen={false} right={<button className="props-link" onClick={() => runCommand("window.panel.lumetri")}>Lumetri ↗</button>}>
      {row("exposure")}
      {row("contrast")}
      {row("highlights")}
      {row("shadows")}
      {row("temperature")}
      {row("saturation")}
    </Section>
  );
}

// ---------------------------------------------------------------- audio
function AudioProps({ clips, time }: { clips: Clip[]; time: number }) {
  const ids = clips.map((c) => c.id);
  const { value: vol, mixed } = readParam(clips, "audio.volumeDb", time);
  const { value: pan } = readParam(clips, "audio.pan", time);
  const muted = clips.every((c) => c.audio?.muted);
  return (
    <Section title="Audio">
      <SliderRow label={mixed ? "Volume (mixed)" : "Volume"} unit="dB" value={Math.max(-60, vol)} min={-60} max={15} step={0.1} defaultValue={0} onChange={(v) => writeParam(ids, "audio.volumeDb", v, "Clip Volume", false)} onCommit={(v) => writeParam(ids, "audio.volumeDb", v, "Clip Volume", true)} />
      <SliderRow label="Balance" value={pan} min={-100} max={100} step={1} defaultValue={0} onChange={(v) => writeParam(ids, "audio.pan", v, "Balance", false)} onCommit={(v) => writeParam(ids, "audio.pan", v, "Balance", true)} />
      <div className="props-qa">
        <Checkbox checked={muted} label="Mute" onChange={(m) => useEditor.getState().applySeq(m ? "Mute Clips" : "Unmute Clips", (s) => { for (const id of ids) { const c = getClip(s, id); if (c?.audio) c.audio.muted = m; } })} />
        <span className="muted">{formatDb(vol)} dB</span>
        <span className="spacer" />
        <Button small onClick={() => runCommand("window.panel.essentialSound")}>Essential Sound ↗</Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- generator editing
function editGen<K extends Generator["kind"]>(ids: string[], kind: K, label: string, final: boolean, fn: (g: Extract<Generator, { kind: K }>, c: Clip) => void) {
  const f = (s: Sequence) => {
    for (const id of ids) {
      const c = getClip(s, id);
      if (c?.generator?.kind === kind) fn(c.generator as Extract<Generator, { kind: K }>, c);
    }
  };
  if (final) commitSeq(label, f);
  else liveSeq(f);
}

function TextProps({ clips }: { seq: Sequence; clips: Clip[] }) {
  const ids = clips.map((c) => c.id);
  const styles = clips.map((c) => (c.generator as { kind: "text"; style: TextStyle }).style);
  const s0 = styles[0];
  const same = <T,>(get: (s: TextStyle) => T) => styles.every((s) => JSON.stringify(get(s)) === JSON.stringify(get(s0)));
  const edit = (label: string, fn: (s: TextStyle) => void, final = true) => editGen(ids, "text", label, final, (g) => fn(g.style));

  // text box: live while typing, one undo step on blur
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [ids.join(",")]);
  const textValue = draft ?? (same((s) => s.text) ? s0.text : "");

  const num = (label: string, get: (s: TextStyle) => number, set: (s: TextStyle, v: number) => void, o: { min?: number; max?: number; step?: number; decimals?: number; unit?: string } = {}) => (
    <HotNumber
      value={get(s0)}
      min={o.min}
      max={o.max}
      step={o.step ?? 1}
      decimals={o.decimals ?? 0}
      unit={same(get) ? o.unit : undefined}
      format={same(get) ? undefined : () => "—"}
      title={label}
      onChange={(v) => edit(label, (s) => set(s, v), false)}
      onCommit={(v) => edit(label, (s) => set(s, v), true)}
    />
  );
  const color = (label: string, value: string, set: (s: TextStyle, v: string) => void) => (
    <ColorInput value={value} onChange={(v) => edit(label, (s) => set(s, v), false)} onCommit={(v) => edit(label, (s) => set(s, v), true)} />
  );

  const fonts = FONTS.includes(s0.fontFamily) ? FONTS : [s0.fontFamily, ...FONTS];
  return (
    <>
      <Section title="Text">
        <textarea
          className="text-input props-textarea"
          value={textValue}
          placeholder={same((s) => s.text) ? "" : "(mixed)"}
          rows={3}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            live((d) => {
              const seq = d.activeSequenceId ? d.sequences[d.activeSequenceId] : undefined;
              for (const id of ids) {
                const c = seq && getClip(seq, id);
                if (c?.generator?.kind === "text") c.generator.style.text = v;
              }
            });
          }}
          onBlur={() => {
            if (draft === null) return;
            const v = draft;
            setDraft(null);
            commit("Edit Text", (d) => {
              const seq = d.activeSequenceId ? d.sequences[d.activeSequenceId] : undefined;
              for (const id of ids) {
                const c = seq && getClip(seq, id);
                if (c?.generator?.kind === "text") {
                  c.generator.style.text = v;
                  c.name = v.split("\n")[0].slice(0, 40) || "Graphic";
                }
              }
            });
          }}
        />
        <PropRow label="Font">
          <select className="select props-font" value={same((s) => s.fontFamily) ? s0.fontFamily : ""} style={{ fontFamily: s0.fontFamily }} onChange={(e) => edit("Font", (s) => { s.fontFamily = e.target.value; })}>
            {!same((s) => s.fontFamily) ? <option value="">(mixed)</option> : null}
            {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{fontLabel(f)}</option>)}
          </select>
        </PropRow>
        <PropRow label="Style">
          <Select value={String(s0.fontWeight)} options={WEIGHTS.map((w) => ({ value: String(w), label: WEIGHT_NAMES[w] }))} onChange={(v) => edit("Font Weight", (s) => { s.fontWeight = Number(v); })} />
          <button className={"props-mini" + (s0.italic ? " on" : "")} title="Faux Italic" onClick={() => edit("Italic", (s) => { s.italic = !s0.italic; })}><i>I</i></button>
          <button className={"props-mini" + (s0.fontWeight >= 700 ? " on" : "")} title="Faux Bold" onClick={() => edit("Bold", (s) => { s.fontWeight = s0.fontWeight >= 700 ? 400 : 700; })}><b>B</b></button>
          <button className="props-mini" title="All Caps" onClick={() => edit("All Caps", (s) => { s.text = s.text.toUpperCase(); })}>TT</button>
        </PropRow>
        <PropRow label="Size">{num("Font Size", (s) => s.fontSize, (s, v) => { s.fontSize = v; }, { min: 4, max: 1000, unit: "px" })}</PropRow>
        <PropRow label="Align">
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} className={"props-mini" + (s0.align === a ? " on" : "")} title={`Align ${a}`} onClick={() => edit("Text Alignment", (s) => { s.align = a; })}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d={a === "left" ? "M2 3 H14 M2 6.5 H10 M2 10 H14 M2 13.5 H9" : a === "center" ? "M2 3 H14 M4 6.5 H12 M2 10 H14 M5 13.5 H11" : "M2 3 H14 M6 6.5 H14 M2 10 H14 M7 13.5 H14"} stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
          ))}
        </PropRow>
        <PropRow label="Tracking">{num("Tracking", (s) => s.letterSpacing, (s, v) => { s.letterSpacing = v; }, { min: -50, max: 200, step: 0.5, decimals: 1 })}</PropRow>
        <PropRow label="Leading">{num("Line Height", (s) => s.lineHeight, (s, v) => { s.lineHeight = v; }, { min: 0.5, max: 4, step: 0.01, decimals: 2, unit: "×" })}</PropRow>
      </Section>

      <Section title="Appearance">
        <PropRow label="Fill">{color("Fill Color", s0.color, (s, v) => { s.color = v; })}</PropRow>
        <PropRow label={<Checkbox checked={!!s0.strokeColor && !!s0.strokeWidth} label="Stroke" onChange={(on) => edit("Stroke", (s) => { if (on) { s.strokeColor = s.strokeColor ?? "#000000"; s.strokeWidth = s.strokeWidth || 4; } else { s.strokeWidth = 0; } })} />}>
          {color("Stroke Color", s0.strokeColor ?? "#000000", (s, v) => { s.strokeColor = v; s.strokeWidth ||= 4; })}
          {num("Stroke Width", (s) => s.strokeWidth ?? 0, (s, v) => { s.strokeWidth = v; s.strokeColor ??= "#000000"; }, { min: 0, max: 100, step: 0.5, decimals: 1 })}
        </PropRow>
        <PropRow label={<Checkbox checked={!!s0.background} label="Background" onChange={(on) => edit("Background", (s) => { s.background = on ? { color: "#000000", padding: 16, radius: 6 } : undefined; })} />}>
          {s0.background ? (
            <>
              {color("Background Color", toHexish(s0.background.color), (s, v) => { if (s.background) s.background.color = v; })}
              <span className="muted">Size</span>
              {num("Background Size", (s) => s.background?.padding ?? 0, (s, v) => { if (s.background) s.background.padding = v; }, { min: 0, max: 400 })}
              <span className="muted">Radius</span>
              {num("Corner Radius", (s) => s.background?.radius ?? 0, (s, v) => { if (s.background) s.background.radius = v; }, { min: 0, max: 400 })}
            </>
          ) : null}
        </PropRow>
        <PropRow label={<Checkbox checked={!!s0.shadow} label="Shadow" onChange={(on) => edit("Shadow", (s) => { s.shadow = on ? { color: "#000000", blur: 8, offsetX: 0, offsetY: 3 } : undefined; })} />}>
          {s0.shadow ? (
            <>
              {color("Shadow Color", toHexish(s0.shadow.color), (s, v) => { if (s.shadow) s.shadow.color = v; })}
              <span className="muted">Blur</span>
              {num("Shadow Blur", (s) => s.shadow?.blur ?? 0, (s, v) => { if (s.shadow) s.shadow.blur = v; }, { min: 0, max: 200 })}
            </>
          ) : null}
        </PropRow>
        {s0.shadow ? (
          <PropRow label="Offset">
            {num("Shadow X", (s) => s.shadow?.offsetX ?? 0, (s, v) => { if (s.shadow) s.shadow.offsetX = v; }, { min: -200, max: 200 })}
            {num("Shadow Y", (s) => s.shadow?.offsetY ?? 0, (s, v) => { if (s.shadow) s.shadow.offsetY = v; }, { min: -200, max: 200 })}
          </PropRow>
        ) : null}
      </Section>
      <ResponsiveStub />
    </>
  );
}

function toHexish(c: string): string {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return c;
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}

function ResponsiveStub() {
  const [intro, setIntro] = useState(0);
  const [outro, setOutro] = useState(0);
  const [roll, setRoll] = useState(false);
  return (
    <Section title="Responsive Design" defaultOpen={false}>
      <PropRow label="Pin To"><Select value="Video Frame" options={["Video Frame"]} onChange={() => {}} disabled /></PropRow>
      <PropRow label="Intro Duration"><HotNumber value={intro} min={0} max={10} step={0.1} decimals={1} unit="s" onChange={setIntro} /></PropRow>
      <PropRow label="Outro Duration"><HotNumber value={outro} min={0} max={10} step={0.1} decimals={1} unit="s" onChange={setOutro} /></PropRow>
      <PropRow label="Roll"><Checkbox checked={roll} label="Roll (credits)" onChange={setRoll} /></PropRow>
      <div className="muted props-note">Responsive design settings are display-only for now.</div>
    </Section>
  );
}

function ShapeProps({ clips }: { clips: Clip[] }) {
  const ids = clips.map((c) => c.id);
  const g0 = clips[0].generator as Extract<Generator, { kind: "shape" }>;
  type Shape = Extract<Generator, { kind: "shape" }>;
  const edit = (label: string, fn: (g: Shape) => void, final = true) => editGen(ids, "shape", label, final, fn);
  const num = (label: string, get: (g: Shape) => number, set: (g: Shape, v: number) => void, o: { min?: number; max?: number } = {}) => (
    <HotNumber value={get(g0)} min={o.min ?? 0} max={o.max ?? 10000} step={1} decimals={0} title={label} onChange={(v) => edit(label, (g) => set(g, v), false)} onCommit={(v) => edit(label, (g) => set(g, v), true)} />
  );
  return (
    <Section title={g0.shape === "ellipse" ? "Ellipse" : "Rectangle"}>
      <PropRow label="Shape">
        <Select value={g0.shape} options={[{ value: "rectangle", label: "Rectangle" }, { value: "ellipse", label: "Ellipse" }]} onChange={(v) => edit("Shape", (g) => { g.shape = v; })} />
      </PropRow>
      <PropRow label="Size">
        <span className="muted">W</span>{num("Width", (g) => g.width, (g, v) => { g.width = v; })}
        <span className="muted">H</span>{num("Height", (g) => g.height, (g, v) => { g.height = v; })}
      </PropRow>
      {g0.shape === "rectangle" ? <PropRow label="Corner Radius">{num("Corner Radius", (g) => g.radius ?? 0, (g, v) => { g.radius = v; })}</PropRow> : null}
      <PropRow label="Fill">
        <ColorInput value={g0.fill} onChange={(v) => edit("Fill", (g) => { g.fill = v; }, false)} onCommit={(v) => edit("Fill", (g) => { g.fill = v; })} />
      </PropRow>
      <PropRow label={<Checkbox checked={!!g0.stroke && !!g0.strokeWidth} label="Stroke" onChange={(on) => edit("Stroke", (g) => { if (on) { g.stroke = g.stroke ?? "#ffffff"; g.strokeWidth = g.strokeWidth || 4; } else g.strokeWidth = 0; })} />}>
        <ColorInput value={g0.stroke ?? "#ffffff"} onChange={(v) => edit("Stroke Color", (g) => { g.stroke = v; g.strokeWidth ||= 4; }, false)} onCommit={(v) => edit("Stroke Color", (g) => { g.stroke = v; g.strokeWidth ||= 4; })} />
        {num("Stroke Width", (g) => g.strokeWidth ?? 0, (g, v) => { g.strokeWidth = v; g.stroke ??= "#ffffff"; }, { max: 200 })}
      </PropRow>
    </Section>
  );
}

function MatteProps({ clips }: { clips: Clip[] }) {
  const ids = clips.map((c) => c.id);
  const g0 = clips[0].generator as Extract<Generator, { kind: "colorMatte" }>;
  return (
    <Section title="Color Matte">
      <PropRow label="Color">
        <ColorInput value={g0.color} onChange={(v) => editGen(ids, "colorMatte", "Matte Color", false, (g) => { g.color = v; })} onCommit={(v) => editGen(ids, "colorMatte", "Matte Color", true, (g) => { g.color = v; })} />
      </PropRow>
    </Section>
  );
}
