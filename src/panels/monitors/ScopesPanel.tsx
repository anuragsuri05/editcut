// Lumetri Scopes: Waveform (Luma / RGB / YC), RGB Parade, Vectorscope YUV,
// Histogram — computed from the program renderer's last frame (~10 fps).
import { useEffect, useRef, useState } from "react";
import { getProgramRenderer, onProgramFrame } from "../../engine";
import { getActiveSequence } from "../../store/store";
import { showContextMenu } from "../../ui/kit";
import { useMonitorUI, type ScopeKind } from "./monitorStore";
import { Icon, useElementSize } from "./parts";
import "./monitors.css";

const SCOPE_LABELS: Record<ScopeKind, string> = {
  vectorscope: "Vectorscope YUV",
  histogram: "Histogram",
  parade: "Parade (RGB)",
  waveformRGB: "Waveform (RGB)",
  waveformLuma: "Waveform (Luma)",
  waveformYC: "Waveform (YC)",
};

interface Frame {
  data: Uint8Array;
  w: number;
  h: number;
}

const coeffs = (cs: "709" | "601") => (cs === "709" ? [0.2126, 0.7152, 0.0722] : [0.299, 0.587, 0.114]);

/** Accumulate density then paint with a tint. */
function paintDensity(ctx: CanvasRenderingContext2D, W: number, H: number, layers: { buf: Float32Array; color: [number, number, number] }[], gain: number, ox = 0, oy = 0) {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    let r = 0, g = 0, b = 0;
    for (const L of layers) {
      const v = L.buf[i];
      if (!v) continue;
      const k = Math.min(1, Math.sqrt(v * gain));
      r += L.color[0] * k; g += L.color[1] * k; b += L.color[2] * k;
    }
    if (r || g || b) {
      d[i * 4] = Math.min(255, r);
      d[i * 4 + 1] = Math.min(255, g);
      d[i * 4 + 2] = Math.min(255, b);
      d[i * 4 + 3] = 255;
    }
  }
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  tmp.getContext("2d")!.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(tmp, ox, oy);
  ctx.globalCompositeOperation = "source-over";
}

function graticule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, clamp: boolean, labels = true) {
  const lo = clamp ? 0 : -10, hi = clamp ? 100 : 110;
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "9px sans-serif";
  ctx.lineWidth = 1;
  for (let ire = 0; ire <= 100; ire += 10) {
    const yy = Math.round(y + h - ((ire - lo) / (hi - lo)) * h) + 0.5;
    ctx.globalAlpha = ire % 50 === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    if (labels && ire % 20 === 0) ctx.fillText(String(ire), x + 2, yy - 2);
  }
  ctx.globalAlpha = 1;
}

function drawWaveform(ctx: CanvasRenderingContext2D, W: number, H: number, f: Frame, kind: "luma" | "rgb" | "yc", cs: "709" | "601", clamp: boolean, gain: number) {
  const pad = 18;
  const w = W - pad, h = H;
  const lo = clamp ? 0 : -0.1, hi = clamp ? 1 : 1.1;
  const bufs = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  const [kr, kg, kb] = coeffs(cs);
  const plot = (buf: Float32Array, x: number, v: number) => {
    const yy = Math.round((1 - (v - lo) / (hi - lo)) * (h - 1));
    if (yy >= 0 && yy < h) buf[yy * w + x] += 1;
  };
  for (let py = 0; py < f.h; py++) {
    for (let px = 0; px < f.w; px++) {
      const i = (py * f.w + px) * 4;
      const r = f.data[i] / 255, g = f.data[i + 1] / 255, b = f.data[i + 2] / 255;
      const x = Math.min(w - 1, Math.floor((px / f.w) * w));
      if (kind === "rgb") {
        plot(bufs[0], x, r); plot(bufs[1], x, g); plot(bufs[2], x, b);
      } else {
        const y = kr * r + kg * g + kb * b;
        plot(bufs[1], x, y);
        if (kind === "yc") {
          const cb = (b - y) / (2 * (1 - kb)), cr = (r - y) / (2 * (1 - kr));
          plot(bufs[2], x, Math.hypot(cb, cr) * 1.4);
        }
      }
    }
  }
  const scale = (gain * 40) / Math.max(1, f.h);
  graticule(ctx, pad, 0, w, h, clamp);
  if (kind === "rgb") paintDensity(ctx, w, h, [{ buf: bufs[0], color: [255, 60, 60] }, { buf: bufs[1], color: [60, 255, 60] }, { buf: bufs[2], color: [70, 110, 255] }], scale, pad);
  else paintDensity(ctx, w, h, [{ buf: bufs[1], color: [140, 255, 140] }, ...(kind === "yc" ? [{ buf: bufs[2], color: [80, 150, 255] as [number, number, number] }] : [])], scale, pad);
}

function drawParade(ctx: CanvasRenderingContext2D, W: number, H: number, f: Frame, clamp: boolean, gain: number) {
  const pad = 18;
  const each = Math.floor((W - pad - 8) / 3);
  const lo = clamp ? 0 : -0.1, hi = clamp ? 1 : 1.1;
  const colors: [number, number, number][] = [[255, 70, 70], [70, 255, 70], [80, 120, 255]];
  for (let ch = 0; ch < 3; ch++) {
    const buf = new Float32Array(each * H);
    for (let py = 0; py < f.h; py++) {
      for (let px = 0; px < f.w; px++) {
        const v = f.data[(py * f.w + px) * 4 + ch] / 255;
        const x = Math.min(each - 1, Math.floor((px / f.w) * each));
        const yy = Math.round((1 - (v - lo) / (hi - lo)) * (H - 1));
        if (yy >= 0 && yy < H) buf[yy * each + x] += 1;
      }
    }
    const ox = pad + ch * (each + 4);
    graticule(ctx, ox, 0, each, H, clamp, ch === 0);
    paintDensity(ctx, each, H, [{ buf, color: colors[ch] }], (gain * 40) / Math.max(1, f.h), ox);
  }
}

function drawVectorscope(ctx: CanvasRenderingContext2D, W: number, H: number, f: Frame, cs: "709" | "601", gain: number) {
  const size = Math.min(W, H) - 8;
  const R = size / 2;
  const cx = W / 2, cy = H / 2;
  const [kr, kg, kb] = coeffs(cs);
  const toXY = (r: number, g: number, b: number): [number, number] => {
    const y = kr * r + kg * g + kb * b;
    const cb = (b - y) / (2 * (1 - kb)), cr = (r - y) / (2 * (1 - kr));
    return [cx + (cb / 0.5) * R * 0.9, cy - (cr / 0.5) * R * 0.9];
  };
  // graticule
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();
  // skin tone line (I-line, ~123°)
  const a = (123 * Math.PI) / 180;
  ctx.strokeStyle = "rgba(232,150,44,0.6)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R);
  ctx.stroke();
  // 75% / 100% targets
  const targets: [string, number, number, number][] = [["R", 1, 0, 0], ["Mg", 1, 0, 1], ["B", 0, 0, 1], ["Cy", 0, 1, 1], ["G", 0, 1, 0], ["Yl", 1, 1, 0]];
  ctx.font = "9px sans-serif";
  for (const [name, r, g, b] of targets) {
    for (const lvl of [0.75, 1]) {
      const [x, y] = toXY(r * lvl, g * lvl, b * lvl);
      ctx.strokeStyle = lvl === 0.75 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
      ctx.strokeRect(x - 4, y - 4, 8, 8);
      if (lvl === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(name, x + 6, y + 3);
      }
    }
  }
  const S = Math.max(1, Math.round(size));
  const buf = new Float32Array(S * S);
  const ox = Math.round(cx - S / 2), oy = Math.round(cy - S / 2);
  for (let i = 0; i < f.w * f.h; i++) {
    const [x, y] = toXY(f.data[i * 4] / 255, f.data[i * 4 + 1] / 255, f.data[i * 4 + 2] / 255);
    const xi = Math.round(x - ox), yi = Math.round(y - oy);
    if (xi >= 0 && yi >= 0 && xi < S && yi < S) buf[yi * S + xi] += 1;
  }
  paintDensity(ctx, S, S, [{ buf, color: [160, 255, 170] }], gain * 0.6, ox, oy);
}

function drawHistogram(ctx: CanvasRenderingContext2D, W: number, H: number, f: Frame) {
  const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < f.w * f.h; i++) for (let c = 0; c < 3; c++) bins[c][f.data[i * 4 + c]]++;
  let max = 1;
  for (const b of bins) for (let i = 1; i < 255; i++) max = Math.max(max, b[i]);
  const colors = ["rgba(255,70,70,0.75)", "rgba(70,255,70,0.75)", "rgba(80,120,255,0.75)"];
  const pad = 18;
  graticule(ctx, pad, 0, W - pad, H, true);
  ctx.globalCompositeOperation = "lighter";
  for (let c = 0; c < 3; c++) {
    ctx.fillStyle = colors[c];
    for (let v = 0; v < 256; v++) {
      const y0 = H - ((v + 1) / 256) * H;
      const len = Math.min(1, bins[c][v] / max) * (W - pad);
      ctx.fillRect(pad, y0, len, Math.max(1, H / 256));
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function ScopeCanvas(props: { kind: ScopeKind; frame: Frame | null; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const brightness = useMonitorUI((s) => s.scopeBrightness);
  const clamp = useMonitorUI((s) => s.scopeClamp);
  const cs = useMonitorUI((s) => s.scopeColorSpace);
  useEffect(() => {
    const c = ref.current;
    if (!c || props.w < 4 || props.h < 4) return;
    const W = Math.floor(props.w), H = Math.floor(props.h);
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, W, H);
    const f = props.frame;
    if (!f) return;
    switch (props.kind) {
      case "waveformLuma": return drawWaveform(ctx, W, H, f, "luma", cs, clamp, brightness);
      case "waveformRGB": return drawWaveform(ctx, W, H, f, "rgb", cs, clamp, brightness);
      case "waveformYC": return drawWaveform(ctx, W, H, f, "yc", cs, clamp, brightness);
      case "parade": return drawParade(ctx, W, H, f, clamp, brightness);
      case "vectorscope": return drawVectorscope(ctx, W, H, f, cs, brightness);
      case "histogram": return drawHistogram(ctx, W, H, f);
    }
  }, [props.frame, props.kind, props.w, props.h, brightness, clamp, cs]);
  return (
    <div className="scope-cell">
      <canvas ref={ref} style={{ width: props.w, height: props.h }} />
      <span className="scope-label">{SCOPE_LABELS[props.kind]}</span>
    </div>
  );
}

export default function ScopesPanel() {
  const scopes = useMonitorUI((s) => s.scopes);
  const brightness = useMonitorUI((s) => s.scopeBrightness);
  const clamp = useMonitorUI((s) => s.scopeClamp);
  const cs = useMonitorUI((s) => s.scopeColorSpace);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const set = useMonitorUI.getState().set;

  useEffect(() => {
    let last = 0;
    let pending = 0;
    const grab = () => {
      const r = getProgramRenderer();
      const seq = getActiveSequence();
      const w = 256;
      const h = seq ? Math.max(16, Math.round((w * seq.settings.height) / seq.settings.width)) : 144;
      const data = r.readPixels(w, h);
      setFrame(data ? { data, w, h } : null);
    };
    const off = onProgramFrame(() => {
      const now = performance.now();
      if (now - last >= 100) {
        last = now;
        grab();
      } else if (!pending) {
        pending = window.setTimeout(() => {
          pending = 0;
          last = performance.now();
          grab();
        }, 100 - (now - last));
      }
    });
    grab();
    return () => {
      off();
      if (pending) clearTimeout(pending);
    };
  }, []);

  const menu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      ...(Object.keys(SCOPE_LABELS) as ScopeKind[]).map((k) => ({
        label: SCOPE_LABELS[k],
        checked: scopes.includes(k),
        onClick: () => set({ scopes: scopes.includes(k) ? scopes.filter((x) => x !== k) : [...scopes, k] }),
      })),
      { separator: true },
      { label: "Presets", submenu: [
        { label: "Waveform + Vectorscope", onClick: () => set({ scopes: ["waveformLuma", "vectorscope"] }) },
        { label: "Parade + Vectorscope + Histogram", onClick: () => set({ scopes: ["parade", "vectorscope", "histogram"] }) },
        { label: "All Scopes", onClick: () => set({ scopes: ["vectorscope", "histogram", "parade", "waveformRGB"] }) },
      ] },
      { separator: true },
      { label: "Clamp Signal", checked: clamp, onClick: () => set({ scopeClamp: !clamp }) },
      { label: "Color Space", submenu: [
        { label: "Rec. 709", checked: cs === "709", onClick: () => set({ scopeColorSpace: "709" }) },
        { label: "Rec. 601", checked: cs === "601", onClick: () => set({ scopeColorSpace: "601" }) },
      ] },
      { label: "Brightness", submenu: [
        { label: "Dimmed", checked: brightness === 0.5, onClick: () => set({ scopeBrightness: 0.5 }) },
        { label: "Normal", checked: brightness === 1, onClick: () => set({ scopeBrightness: 1 }) },
        { label: "Bright", checked: brightness === 2, onClick: () => set({ scopeBrightness: 2 }) },
      ] },
    ]);

  const n = Math.max(1, scopes.length);
  const cols = n <= 1 ? 1 : n <= 2 ? (area.w > area.h ? 2 : 1) : 2;
  const rows = Math.ceil(n / cols);
  const cw = area.w / cols - 4, ch = area.h / rows - 4;

  return (
    <div className="scopes-panel" onContextMenu={menu}>
      <div ref={areaRef} className="scopes-area" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {scopes.length ? scopes.map((k) => <ScopeCanvas key={k} kind={k} frame={frame} w={cw} h={ch} />) : <div className="mon-msg">Right-click to choose scopes</div>}
      </div>
      {!frame ? <div className="scopes-note">Open the Program Monitor to analyze the current frame.</div> : null}
      <div className="scopes-bar">
        <button className="mb" title="Scope settings" onClick={menu}>{Icon.wrench}</button>
        <span className="muted">Brightness</span>
        <input type="range" className="slider" min={0.2} max={4} step={0.05} value={brightness} onChange={(e) => set({ scopeBrightness: parseFloat(e.target.value) })} style={{ maxWidth: 120 }} />
        <label className="checkbox"><input type="checkbox" checked={clamp} onChange={(e) => set({ scopeClamp: e.target.checked })} />Clamp Signal</label>
        <select className="mon-select" value={cs} onChange={(e) => set({ scopeColorSpace: e.target.value as "709" | "601" })}>
          <option value="709">Rec. 709</option>
          <option value="601">Rec. 601</option>
        </select>
        <span className="spacer" />
        <span className="muted">8 Bit</span>
      </div>
    </div>
  );
}
