// Lumetri Color panel: edits a "lumetri" effect on the selected clip (or the clip under the playhead).
import { useMemo, useRef, useState } from "react";
import type { Clip, Effect, Project, Sequence } from "@shared/types";
import { EFFECT_MAP, LOOKS } from "@shared/effects";
import { evalParam, isAnimated, setParamAt } from "@shared/params";
import { makeEffect } from "@shared/factory";
import { getClip, clipsAtTime } from "@shared/ops";
import { useEditor, useActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { getCommand, runCommand } from "../../commands/registry";
import { Button, Checkbox, Select, SliderRow, Tabs } from "../../ui/kit";
import { commitSeq, liveSeq } from "./liveEdit";
import { isVisual, localTime, selectedClips, toggleAnim } from "./model";
import { autoTone, autoWhiteBalance, sampleFrame } from "./analysis";
import { CheckSection, ColorWheel, Stopwatch, SubHead } from "./widgets";
import "./effects.css";

const DEF = EFFECT_MAP.lumetri;
const pdef = (k: string) => DEF.params.find((p) => p.key === k)!;

type Curves = Record<"master" | "red" | "green" | "blue", { x: number; y: number }[]>;
const DEFAULT_CURVES: Curves = {
  master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
};

/** The clip Lumetri works on: selected visual clip, else topmost visual clip under the playhead. */
function useTarget(seq: Sequence | null): Clip | undefined {
  const ids = useEditor((s) => s.selection.clipIds);
  const time = usePlayback((s) => s.time);
  return useMemo(() => {
    if (!seq) return undefined;
    const sel = selectedClips(seq, ids).find((c) => isVisual(seq, c));
    if (sel) return sel;
    const order = seq.tracks.filter((t) => t.kind === "video");
    const under = clipsAtTime(seq, time).filter((c) => isVisual(seq, c) && c.enabled);
    under.sort((a, b) => order.findIndex((t) => t.id === b.trackId) - order.findIndex((t) => t.id === a.trackId));
    return under[0];
  }, [seq, ids, time]);
}

export default function LumetriPanel() {
  const seq = useActiveSequence();
  const clip = useTarget(seq);
  const time = usePlayback((s) => s.time);
  const [fxIndex, setFxIndex] = useState(0);
  if (!seq) return <div className="panel-empty">(no sequence)</div>;
  if (!clip) return <div className="panel-empty">Select a video clip (or park the playhead over one) to grade it.</div>;
  const lums = clip.effects.filter((e) => e.type === "lumetri");
  const fx: Effect | undefined = lums[Math.min(fxIndex, lums.length - 1)];
  return <LumetriBody key={clip.id} seq={seq} clip={clip} fx={fx} lums={lums} fxIndex={fxIndex} setFxIndex={setFxIndex} time={time} />;
}

function LumetriBody(props: { seq: Sequence; clip: Clip; fx?: Effect; lums: Effect[]; fxIndex: number; setFxIndex: (i: number) => void; time: number }) {
  const { seq, clip, fx, time } = props;
  const lt = localTime(clip, time);
  const fxId = fx?.id;

  // ---- read
  const val = (k: string) => (fx ? evalParam(fx.params[k], lt, pdef(k).default) : pdef(k).default);
  const opt = (k: string) => {
    const d = DEF.options?.find((o) => o.key === k)?.default;
    return fx?.options?.[k] ?? d;
  };

  // ---- write (creates the effect on first edit)
  const target = (s: Sequence): Effect | undefined => {
    const c = getClip(s, clip.id);
    if (!c) return undefined;
    let e = fxId ? c.effects.find((x) => x.id === fxId) : c.effects.find((x) => x.type === "lumetri");
    if (!e) {
      c.effects.push(makeEffect("lumetri"));
      e = c.effects[c.effects.length - 1];
    }
    return e;
  };
  const writeParams = (vals: Record<string, number>, label: string, final: boolean) => {
    const fn = (s: Sequence) => {
      const e = target(s);
      const c = getClip(s, clip.id);
      if (!e || !c) return;
      const t = localTime(c, usePlayback.getState().time);
      for (const [k, v] of Object.entries(vals)) {
        e.params[k] ??= { value: pdef(k).default };
        setParamAt(e.params[k], t, v);
      }
    };
    if (final) commitSeq(label, fn);
    else liveSeq(fn);
  };
  const writeOpts = (o: Record<string, string | boolean>, label: string, final = true) => {
    const fn = (s: Sequence) => {
      const e = target(s);
      if (e) e.options = { ...(e.options ?? {}), ...o };
    };
    if (final) commitSeq(label, fn);
    else liveSeq(fn);
  };

  const slider = (k: string, label?: string, unit?: string, cls?: string) => {
    const d = pdef(k);
    const animated = isAnimated(fx?.params[k]);
    return (
      <div className={"lum-slider " + (cls ?? "") + (animated ? " animated" : "")} key={k} title={animated ? "Animated — edits add keyframes at the playhead" : undefined}>
        <SliderRow
          label={label ?? d.label}
          value={val(k)}
          min={d.min}
          max={d.max}
          step={d.step ?? (d.max - d.min) / 400}
          defaultValue={d.default}
          unit={unit}
          onChange={(v) => writeParams({ [k]: v }, d.label, false)}
          onCommit={(v) => writeParams({ [k]: v }, d.label, true)}
        />
      </div>
    );
  };
  const resetKeys = (keys: string[], label: string) => writeParams(Object.fromEntries(keys.map((k) => [k, pdef(k).default])), label, true);

  const [busy, setBusy] = useState(false);
  const project = useEditor((s) => s.project);
  const runAuto = async () => {
    if (getCommand("ai.autoColor") && !clip.assetId) return void runCommand("ai.autoColor");
    setBusy(true);
    const stats = await sampleFrame(project, clip, usePlayback.getState().time);
    setBusy(false);
    if (!stats) {
      if (getCommand("ai.autoColor")) runCommand("ai.autoColor");
      else useEditor.getState().toast("Couldn't analyze this frame", "error");
      return;
    }
    writeParams(autoTone(stats), "Lumetri Auto", true);
  };
  const runWB = async () => {
    setBusy(true);
    const stats = await sampleFrame(project, clip, usePlayback.getState().time);
    setBusy(false);
    if (!stats) return useEditor.getState().toast("Couldn't sample this frame", "error");
    writeParams(autoWhiteBalance(stats), "White Balance", true);
    useEditor.getState().toast("White balance set from the frame's average neutral");
  };

  const look = String(opt("look") ?? "None");
  const lookNames = ["None", ...Object.keys(LOOKS)];
  const cycleLook = (d: number) => {
    const i = lookNames.indexOf(look);
    writeOpts({ look: lookNames[(i + d + lookNames.length) % lookNames.length] }, "Lumetri Look");
  };

  const curves: Curves = useMemo(() => {
    try {
      return { ...DEFAULT_CURVES, ...(JSON.parse(String(fx?.options?.curves ?? "{}")) as Partial<Curves>) };
    } catch {
      return DEFAULT_CURVES;
    }
  }, [fx?.options?.curves]);

  const wheel = (prefix: "shadow" | "mid" | "high", label: string, size = 104) => (
    <ColorWheel
      label={label}
      size={size}
      hue={val(prefix + "Hue")}
      amount={val(prefix + "Amount")}
      luma={val(prefix + "Luma")}
      onChange={(h, a) => writeParams({ [prefix + "Hue"]: h, [prefix + "Amount"]: a }, `${label} Wheel`, false)}
      onCommit={(h, a) => writeParams({ [prefix + "Hue"]: h, [prefix + "Amount"]: a }, `${label} Wheel`, true)}
      onLumaChange={(v) => writeParams({ [prefix + "Luma"]: v }, `${label} Luminance`, false)}
      onLumaCommit={(v) => writeParams({ [prefix + "Luma"]: v }, `${label} Luminance`, true)}
    />
  );

  const allKeys = DEF.params.map((p) => p.key);
  return (
    <div className="lum">
      <div className="lum-head">
        <span className={"fx-toggle" + (fx?.enabled !== false ? " on" : "")} title="Toggle Lumetri on/off" onClick={() => fx && commitSeq(fx.enabled ? "Disable Lumetri" : "Enable Lumetri", (s) => { const e = getClip(s, clip.id)?.effects.find((x) => x.id === fx.id); if (e) e.enabled = !e.enabled; })}>fx</span>
        <span className="lum-target" title={clip.name}>
          <span className="muted">Master ·</span> {clip.name}
          <span className="muted"> · {seq.name}</span>
        </span>
        <span className="spacer" />
        {props.lums.length > 1 ? (
          <Select value={String(props.fxIndex)} options={props.lums.map((_, i) => ({ value: String(i), label: `Lumetri Color ${i + 1}` }))} onChange={(v) => props.setFxIndex(Number(v))} />
        ) : (
          <span className="muted">{fx ? "Lumetri Color" : "(no Lumetri yet — edits add it)"}</span>
        )}
        <Stopwatch on={allKeys.some((k) => isAnimated(fx?.params[k]))} disabled={!fx} onClick={() => fx && toggleAnim(clip.id, ["exposure", "contrast", "saturation", "temperature", "tint"].map((k) => `fx.${fx.id}.${k}`), "Animate Lumetri Basic")} />
      </div>
      <div className="lum-body">
        {/* ---------------- Basic Correction ---------------- */}
        <CheckSection title="Basic Correction" defaultOpen enabled={opt("basicOn") !== false} onToggle={(v) => writeOpts({ basicOn: v }, "Basic Correction")}>
          <div className="lum-line">
            <span className="lum-lbl">Input LUT</span>
            <Select value={String(fx?.options?.inputLut ?? "None")} options={["None", "Browse…"]} onChange={(v) => (v === "Browse…" ? useEditor.getState().toast("Custom LUT files are not supported yet") : writeOpts({ inputLut: v }, "Input LUT"))} />
          </div>
          <SubHead>
            White Balance
            <span className="spacer" />
            <button className="lum-eyedrop" disabled={busy || !clip.assetId} title="White Balance Selector — neutralizes the frame's average mid-tone (gray world)" onClick={runWB}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10.5 1.5 L14.5 5.5 L12 8 L8 4 Z M9 5 L3 11 L2 14 L5 13 L11 7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            </button>
          </SubHead>
          {slider("temperature", "Temperature", undefined, "grad-temp")}
          {slider("tint", "Tint", undefined, "grad-tint")}
          {slider("saturation", "Saturation", undefined, "grad-sat")}
          <SubHead>
            Tone
            <span className="spacer" />
            <Button small onClick={() => resetKeys(["temperature", "tint", "exposure", "contrast", "highlights", "shadows", "whites", "blacks", "saturation"], "Reset Basic Correction")}>Reset</Button>
            <Button small disabled={busy} onClick={runAuto}>{busy ? "…" : "Auto"}</Button>
          </SubHead>
          {slider("exposure")}
          {slider("contrast")}
          {slider("highlights")}
          {slider("shadows")}
          {slider("whites")}
          {slider("blacks")}
        </CheckSection>

        {/* ---------------- Creative ---------------- */}
        <CheckSection title="Creative" enabled={opt("creativeOn") !== false} onToggle={(v) => writeOpts({ creativeOn: v }, "Creative")}>
          <div className="lum-line">
            <span className="lum-lbl">Look</span>
            <Select value={look} options={lookNames} onChange={(v) => writeOpts({ look: v }, "Lumetri Look")} style={{ flex: 1 }} />
          </div>
          <div className="lum-lookstrip">
            <button onClick={() => cycleLook(-1)} title="Previous look">◀</button>
            <div className={"lum-lookprev look-" + lookNames.indexOf(look)} title="Click to apply" onClick={() => writeOpts({ look }, "Lumetri Look")}>
              <div className="lum-lookimg" />
              <span>{look}</span>
            </div>
            <button onClick={() => cycleLook(1)} title="Next look">▶</button>
          </div>
          {slider("lookIntensity", "Intensity")}
          <SubHead>Adjustments</SubHead>
          {slider("fadedFilm")}
          {slider("sharpen")}
          {slider("vibrance")}
          {slider("creativeSaturation", "Saturation")}
          <div className="lum-wheels two">
            <ColorWheel label="Shadow Tint" size={92} hue={val("shadowTintHue")} amount={val("shadowTintAmount")}
              onChange={(h, a) => writeParams({ shadowTintHue: h, shadowTintAmount: a }, "Shadow Tint", false)}
              onCommit={(h, a) => writeParams({ shadowTintHue: h, shadowTintAmount: a }, "Shadow Tint", true)} />
            <ColorWheel label="Highlight Tint" size={92} hue={val("highTintHue")} amount={val("highTintAmount")}
              onChange={(h, a) => writeParams({ highTintHue: h, highTintAmount: a }, "Highlight Tint", false)}
              onCommit={(h, a) => writeParams({ highTintHue: h, highTintAmount: a }, "Highlight Tint", true)} />
          </div>
          {slider("tintBalance", "Tint Balance")}
        </CheckSection>

        {/* ---------------- Curves ---------------- */}
        <CheckSection title="Curves" enabled={opt("curvesOn") !== false} onToggle={(v) => writeOpts({ curvesOn: v }, "Curves")}>
          <CurvesSection curves={curves}
            onChange={(c, final) => {
              const fit = fitCurves(c);
              const fn = (s: Sequence) => {
                const e = target(s);
                const cl = getClip(s, clip.id);
                if (!e || !cl) return;
                e.options = { ...(e.options ?? {}), curves: JSON.stringify(c) };
                const t = localTime(cl, usePlayback.getState().time);
                for (const [k, v] of Object.entries(fit)) {
                  e.params[k] ??= { value: pdef(k).default };
                  setParamAt(e.params[k], t, v);
                }
              };
              if (final) commitSeq("RGB Curves", fn);
              else liveSeq(fn);
            }}
          />
        </CheckSection>

        {/* ---------------- Color Wheels & Match ---------------- */}
        <CheckSection title="Color Wheels & Match" enabled={opt("wheelsOn") !== false} onToggle={(v) => writeOpts({ wheelsOn: v }, "Color Wheels")}>
          <div className="lum-match">
            <Button small onClick={() => (getCommand("monitor.toggleComparison") ? runCommand("monitor.toggleComparison") : useEditor.getState().toast("Comparison View is not available in this build"))}>Comparison View</Button>
            <MatchControls />
          </div>
          <div className="lum-wheels three">
            {wheel("shadow", "Shadows")}
            {wheel("mid", "Midtones")}
            {wheel("high", "Highlights")}
          </div>
          <div className="lum-reset-row">
            <Button small onClick={() => resetKeys(["shadowHue", "shadowAmount", "shadowLuma", "midHue", "midAmount", "midLuma", "highHue", "highAmount", "highLuma"], "Reset Color Wheels")}>Reset Wheels</Button>
          </div>
        </CheckSection>

        {/* ---------------- HSL Secondary ---------------- */}
        <CheckSection title="HSL Secondary" enabled={false} right={<span className="lum-soon">not available yet</span>}>
          <HslStub />
        </CheckSection>

        {/* ---------------- Vignette ---------------- */}
        <CheckSection title="Vignette" enabled={opt("vignetteOn") !== false} onToggle={(v) => writeOpts({ vignetteOn: v }, "Vignette")}>
          {slider("vignetteAmount", "Amount")}
          {slider("vignetteMidpoint", "Midpoint")}
          {slider("vignetteRoundness", "Roundness")}
          {slider("vignetteFeather", "Feather")}
        </CheckSection>
      </div>
    </div>
  );
}

function MatchControls() {
  const [faces, setFaces] = useState(true);
  return (
    <>
      <Checkbox checked={faces} label="Face Detection" onChange={setFaces} />
      <Button small primary onClick={() => (getCommand("ai.colorMatch") ? runCommand("ai.colorMatch") : useEditor.getState().toast("Color Match needs the AI assistant (ai.colorMatch)", "error"))}>Apply Match</Button>
    </>
  );
}

// ---------------------------------------------------------------- curves
type Pt = { x: number; y: number };

/** Monotone cubic (Fritsch–Carlson) through sorted points; returns y(x). */
export function curveFn(pts: Pt[]): (x: number) => number {
  const p = [...pts].sort((a, b) => a.x - b.x);
  const n = p.length;
  if (n < 2) return (x) => x;
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1].y - p[i].y) / Math.max(1e-6, p[i + 1].x - p[i].x));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= p[0].x) return p[0].y;
    if (x >= p[n - 1].x) return p[n - 1].y;
    let i = 0;
    while (i < n - 2 && x > p[i + 1].x) i++;
    const h = p[i + 1].x - p[i].x, t = (x - p[i].x) / h;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return Math.min(1, Math.max(0, h00 * p[i].y + h10 * h * m[i] + h01 * p[i + 1].y + h11 * h * m[i + 1]));
  };
}

/** Fit the curve editor onto the lumetri curve params (see compile in shared/effects.ts). */
function fitCurves(c: Curves): Record<string, number> {
  const m = curveFn(c.master), r = curveFn(c.red), g = curveFn(c.green), b = curveFn(c.blue);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    curveBlack: r1(m(0) * 100), curveMid: r1(m(0.5) * 100), curveWhite: r1(m(1) * 100),
    curveRed: r1((r(0.5) - 0.5) * 200), curveGreen: r1((g(0.5) - 0.5) * 200), curveBlue: r1((b(0.5) - 0.5) * 200),
  };
}

const CH_COLORS = { master: "#e8e8e8", red: "#ff5555", green: "#4cd964", blue: "#4a90ff" } as const;

function CurvesSection(props: { curves: Curves; onChange: (c: Curves, final: boolean) => void }) {
  const [tab, setTab] = useState<"rgb" | "hue">("rgb");
  const [ch, setCh] = useState<keyof Curves>("master");
  return (
    <div className="lum-curves">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "rgb", label: "RGB Curves" }, { value: "hue", label: "Hue Saturation Curves" }]} />
      {tab === "rgb" ? (
        <>
          <div className="lum-chans">
            {(Object.keys(CH_COLORS) as (keyof Curves)[]).map((k) => (
              <button key={k} className={"lum-chan" + (ch === k ? " on" : "")} style={{ background: CH_COLORS[k] }} title={k} onClick={() => setCh(k)} />
            ))}
          </div>
          <CurveEditor
            points={props.curves[ch]}
            color={CH_COLORS[ch]}
            ghosts={(Object.keys(CH_COLORS) as (keyof Curves)[]).filter((k) => k !== ch).map((k) => ({ pts: props.curves[k], color: CH_COLORS[k] }))}
            onChange={(pts, final) => props.onChange({ ...props.curves, [ch]: pts }, final)}
          />
          <div className="lum-note">Click to add points, drag to shape, double-click a point to delete, double-click empty space to reset. Rendered as a levels + gamma fit of the curve (master) and midtone balance (R/G/B).</div>
        </>
      ) : (
        <div className="lum-hue-stub">
          {["Hue vs Sat", "Hue vs Hue", "Hue vs Luma", "Luma vs Sat", "Sat vs Sat"].map((n) => (
            <div key={n} className="lum-hue-curve">
              <div className="lum-hue-bar" />
              <span>{n}</span>
            </div>
          ))}
          <div className="lum-note">Hue/Saturation curves are not available yet (no renderer primitive for hue-qualified corrections).</div>
        </div>
      )}
    </div>
  );
}

function CurveEditor(props: { points: Pt[]; color: string; ghosts: { pts: Pt[]; color: string }[]; onChange: (pts: Pt[], final: boolean) => void }) {
  const S = 220;
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; pts: Pt[] } | null>(null);
  const toPt = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) };
  };
  const path = (pts: Pt[]) => {
    const f = curveFn(pts);
    let d = "";
    for (let i = 0; i <= 64; i++) {
      const x = i / 64;
      d += `${i ? "L" : "M"}${x * S} ${(1 - f(x)) * S}`;
    }
    return d;
  };
  const pts = [...props.points].sort((a, b) => a.x - b.x);
  const nearest = (p: Pt) => pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.045);
  return (
    <svg
      ref={ref}
      className="lum-curve"
      viewBox={`0 0 ${S} ${S}`}
      onPointerDown={(e) => {
        const p = toPt(e);
        let i = nearest(p);
        let next = pts;
        if (i < 0) {
          if (pts.length >= 16) return;
          next = [...pts, p].sort((a, b) => a.x - b.x);
          i = next.indexOf(p);
          props.onChange(next, false);
        }
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { i, pts: next };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const p = toPt(e);
        const arr = d.pts.map((q) => ({ ...q }));
        const isEnd = d.i === 0 || d.i === arr.length - 1;
        const lo = d.i > 0 ? arr[d.i - 1].x + 0.01 : 0, hi = d.i < arr.length - 1 ? arr[d.i + 1].x - 0.01 : 1;
        arr[d.i] = { x: isEnd ? arr[d.i].x : Math.min(hi, Math.max(lo, p.x)), y: p.y };
        d.pts = arr;
        props.onChange(arr, false);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d) props.onChange(d.pts, true);
      }}
      onDoubleClick={(e) => {
        const i = nearest(toPt(e));
        if (i > 0 && i < pts.length - 1) props.onChange(pts.filter((_, j) => j !== i), true);
        else if (i < 0) props.onChange([{ x: 0, y: 0 }, { x: 1, y: 1 }], true);
      }}
    >
      <rect width={S} height={S} fill="#141414" />
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g} stroke="#2a2a2a">
          <line x1={g * S} y1={0} x2={g * S} y2={S} />
          <line x1={0} y1={g * S} x2={S} y2={g * S} />
        </g>
      ))}
      <line x1={0} y1={S} x2={S} y2={0} stroke="#333" strokeDasharray="3 3" />
      {props.ghosts.map((g, i) => (
        <path key={i} d={path(g.pts)} fill="none" stroke={g.color} strokeOpacity={0.18} />
      ))}
      <path d={path(pts)} fill="none" stroke={props.color} strokeWidth={1.6} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x * S} cy={(1 - p.y) * S} r={4} fill="#141414" stroke={props.color} strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function HslStub() {
  return (
    <div className="lum-hsl">
      <SubHead>Key</SubHead>
      <div className="lum-hsl-swatches">
        {["#e23", "#e93", "#ee3", "#3c3", "#3cc", "#36e", "#c3c", "#e9a37a"].map((c) => <span key={c} style={{ background: c }} />)}
      </div>
      {["H", "S", "L"].map((k) => (
        <div key={k} className="lum-hsl-bar">
          <input type="checkbox" checked disabled readOnly /> <span>{k}</span>
          <div className={"bar " + k} />
        </div>
      ))}
      <SubHead>Refine</SubHead>
      <SliderRow label="Denoise" value={0} min={0} max={100} defaultValue={0} onChange={() => {}} onCommit={() => {}} />
      <SliderRow label="Blur" value={0} min={0} max={100} defaultValue={0} onChange={() => {}} onCommit={() => {}} />
      <div className="lum-note">HSL Secondary keying needs a qualified-correction primitive that the renderers don't implement yet. Use masks + a second Lumetri on an adjustment layer instead.</div>
    </div>
  );
}

// exported for the Properties panel's Lumetri quick controls
export function lumetriTargetEffect(project: Project, seqId: string, clipId: string): Effect | undefined {
  return project.sequences[seqId]?.clips.find((c) => c.id === clipId)?.effects.find((e) => e.type === "lumetri");
}
