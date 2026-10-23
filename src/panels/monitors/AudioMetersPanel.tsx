// Audio Meters: vertical stereo master meters (dBFS) with peak hold, clip
// indicators (click to reset) and per-channel solo buttons.
import { useEffect, useRef, useState } from "react";
import { usePlayback } from "../../store/playback";
import { getAudioEngine } from "../../engine";
import { showContextMenu } from "../../ui/kit";
import { useElementSize } from "./parts";
import "./monitors.css";

const RANGES = [120, 96, 72, 60, 48, 24];

function ticksFor(range: number): number[] {
  const step = range > 72 ? 12 : range > 48 ? 6 : range > 24 ? 6 : 3;
  const out: number[] = [];
  for (let d = 0; d >= -range; d -= step) out.push(d);
  return out;
}

export default function AudioMetersPanel() {
  const meters = usePlayback((s) => s.meters);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [range, setRange] = useState<number>(() => Number(localStorage.getItem("editcut.meterRange")) || 60);
  const [staticPeaks, setStaticPeaks] = useState(false);
  const [clip, setClip] = useState<[boolean, boolean]>([false, false]);
  const [solo, setSolo] = useState<[boolean, boolean]>(() => [...getAudioEngine().channelSolo] as [boolean, boolean]);
  const staticHold = useRef<[number, number]>([-Infinity, -Infinity]);

  useEffect(() => {
    const c0 = meters.left >= 0 || meters.peakLeft >= 0;
    const c1 = meters.right >= 0 || meters.peakRight >= 0;
    if ((c0 && !clip[0]) || (c1 && !clip[1])) setClip([clip[0] || c0, clip[1] || c1]);
    staticHold.current = [Math.max(staticHold.current[0], meters.left), Math.max(staticHold.current[1], meters.right)];
  }, [meters, clip]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || size.w < 10 || size.h < 10) return;
    const dpr = window.devicePixelRatio || 1;
    const W = size.w, H = size.h;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const top = 4, bottom = H - 4;
    const yOf = (db: number) => top + (Math.min(0, Math.max(-range, db)) / -range) * (bottom - top);
    const scaleW = 26;
    const barW = Math.max(6, Math.min(18, (W - scaleW - 10) / 2));
    const x0 = W / 2 - barW - 1 + scaleW / 2 - 4;
    // scale
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#8a8a8a";
    for (const d of ticksFor(range)) {
      const y = Math.round(yOf(d)) + 0.5;
      ctx.fillText(String(d), x0 - 5, y + 3);
      ctx.fillRect(x0 - 3, y, 2, 1);
    }
    const vals = [meters.left, meters.right];
    const peaks = staticPeaks ? staticHold.current : [meters.peakLeft, meters.peakRight];
    for (let ch = 0; ch < 2; ch++) {
      const x = x0 + ch * (barW + 2);
      ctx.fillStyle = "#151515";
      ctx.fillRect(x, top, barW, bottom - top);
      const v = vals[ch];
      if (v > -range) {
        const grad = ctx.createLinearGradient(0, bottom, 0, top);
        const stop = (db: number) => 1 - (Math.min(0, Math.max(-range, db)) / -range);
        grad.addColorStop(0, "#1f9a3a");
        grad.addColorStop(Math.max(0, stop(-18)), "#3fcf4f");
        grad.addColorStop(Math.max(0, stop(-12)), "#d8d23a");
        grad.addColorStop(Math.max(0, stop(-6)), "#e8962c");
        grad.addColorStop(1, "#e5484d");
        ctx.fillStyle = grad;
        const y = yOf(v);
        ctx.fillRect(x, y, barW, bottom - y);
      }
      const pk = peaks[ch];
      if (pk > -range) {
        ctx.fillStyle = pk >= -6 ? "#ff6b6b" : "#e6e6e6";
        ctx.fillRect(x, Math.round(yOf(pk)), barW, 1.5);
      }
    }
  }, [meters, size.w, size.h, range, staticPeaks]);

  const menu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      ...RANGES.map((r) => ({ label: `${r} dB Range`, checked: r === range, onClick: () => { setRange(r); localStorage.setItem("editcut.meterRange", String(r)); } })),
      { separator: true },
      { label: "Dynamic Peaks", checked: !staticPeaks, onClick: () => setStaticPeaks(false) },
      { label: "Static Peaks", checked: staticPeaks, onClick: () => { staticHold.current = [-Infinity, -Infinity]; setStaticPeaks(true); } },
      { separator: true },
      { label: "Reset Indicators", onClick: () => { setClip([false, false]); staticHold.current = [-Infinity, -Infinity]; } },
    ]);

  const toggleSolo = (ch: 0 | 1) => {
    const next: [boolean, boolean] = [...solo] as [boolean, boolean];
    next[ch] = !next[ch];
    getAudioEngine().setChannelSolo(ch, next[ch]);
    setSolo(next);
  };

  return (
    <div className="meters-panel" onContextMenu={menu}>
      <div className="meters-clips">
        {[0, 1].map((ch) => (
          <span key={ch} className={"clip-led" + (clip[ch] ? " on" : "")} title="Clip indicator — click to reset" onClick={() => { const n = [...clip] as [boolean, boolean]; n[ch] = false; setClip(n); staticHold.current[ch] = -Infinity; }} />
        ))}
      </div>
      <div ref={ref} className="meters-body">
        <canvas ref={canvas} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
      <div className="meters-solo">
        {[0, 1].map((ch) => (
          <button key={ch} className={"solo-btn" + (solo[ch] ? " on" : "")} title={`Solo ${ch ? "Right" : "Left"} channel`} onClick={() => toggleSolo(ch as 0 | 1)}>S</button>
        ))}
      </div>
      <div className="meters-foot"><span>L</span><span>R</span></div>
    </div>
  );
}
