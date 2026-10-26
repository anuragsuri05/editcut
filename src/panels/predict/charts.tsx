// Hand-written SVG charts for the Content Lab: score gauge, the per-second
// attention ribbon, the retention chart and the brain-network heat rows.
// All are synced to the shared player clock (usePlayer) and hover second (useInspect).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { NETWORKS, type NetworkId, type PlatformId, type PredictionReport } from "@shared/predict";
import { usePlayer } from "./labStore";
import { NEURAL_COLOR, PLATFORM_COLOR, band, divColor, fmtTime, platformName, seqColor } from "./format";

// ---------------------------------------------------------------- shared

/** Second under the pointer in any chart (drives the inspector). */
export const useInspect = create<{ hover: number | null; setHover: (t: number | null) => void }>()((set) => ({
  hover: null,
  setHover: (hover) => set({ hover }),
}));

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function tickStep(n: number, px: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return steps.find((s) => (n / s) * 46 <= px) ?? 900;
}

/** Pointer handling shared by the time-based charts: hover a second, click/drag to seek. */
function useTimePointer(toTime: (clientX: number, el: HTMLElement) => number, n: number) {
  const seek = usePlayer((s) => s.seek);
  const setHover = useInspect((s) => s.setHover);
  const [hx, setHx] = useState<number | null>(null);
  const dragging = useRef(false);
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      seek(toTime(e.clientX, e.currentTarget));
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const t = toTime(e.clientX, e.currentTarget);
      const rect = e.currentTarget.getBoundingClientRect();
      setHx(e.clientX - rect.left);
      setHover(Math.min(n - 1, Math.max(0, Math.floor(t))));
      if (dragging.current) seek(t);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onPointerLeave: () => {
      if (dragging.current) return;
      setHx(null);
      setHover(null);
    },
  };
  return { handlers, hx };
}

function Tip(props: { x: number; width: number; children: ReactNode; top?: number }) {
  const left = props.x + 14 + 220 > props.width ? props.x - 14 - 220 : props.x + 14;
  return (
    <div className="lab-tip" style={{ left: Math.max(0, left), top: props.top ?? 8 }}>
      {props.children}
    </div>
  );
}

function Playhead(props: { x: number; top?: number; bottom?: number }) {
  return <div className="lab-playhead" style={{ left: props.x, top: props.top ?? 0, bottom: props.bottom ?? 0 }} />;
}

// ---------------------------------------------------------------- gauge

export function Gauge(props: { score: number; size?: number }) {
  const size = props.size ?? 148;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const start = 135, sweep = 270;
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    return `M${x1},${y1} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2},${y2}`;
  };
  const v = Math.max(0, Math.min(100, props.score));
  const b = band(v);
  return (
    <svg className="lab-gauge" width={size} height={size * 0.86} viewBox={`0 0 ${size} ${size * 0.86}`} role="img" aria-label={`Content score ${v} of 100, ${b.label}`}>
      <path d={arc(start, start + sweep)} stroke="#2c2c2a" strokeWidth={9} fill="none" strokeLinecap="round" />
      {v > 0 ? <path d={arc(start, start + (sweep * v) / 100)} stroke={b.color} strokeWidth={9} fill="none" strokeLinecap="round" /> : null}
      {[40, 58, 75].map((th) => {
        const [x1, y1] = pt(start + (sweep * th) / 100);
        return <circle key={th} cx={x1} cy={y1} r={1.6} fill="#1e1e1e" />;
      })}
      <text x={cx} y={cy + 4} textAnchor="middle" className="lab-gauge-num">{Math.round(v)}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" className="lab-gauge-sub">of 100</text>
    </svg>
  );
}

export function Meter(props: { label: string; value: number; hint?: string; accent?: string }) {
  const b = band(props.value);
  return (
    <div className="lab-meter" title={props.hint}>
      <div className="lab-meter-top">
        <span>{props.label}</span>
        <strong>{Math.round(props.value)}</strong>
      </div>
      <div className="lab-meter-track">
        <div className="lab-meter-fill" style={{ width: `${props.value}%`, background: props.accent ?? b.color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- thumbnails

/** Sprite frame covering time t (frame i covers t in [i*interval, (i+1)*interval)). */
export function thumbIndex(th: NonNullable<PredictionReport["thumbs"]>, t: number): number {
  return Math.max(0, Math.min(th.count - 1, Math.floor(t / (th.interval || 1))));
}

export function Thumb(props: { rep: PredictionReport; t: number; height: number; className?: string }) {
  const th = props.rep.thumbs;
  const fw = th ? (props.height * th.width) / th.height : (props.height * 16) / 9;
  if (!th) return <div className={"lab-thumb empty " + (props.className ?? "")} style={{ width: fw, height: props.height }} />;
  const i = thumbIndex(th, props.t);
  const s = props.height / th.height;
  return (
    <div
      className={"lab-thumb " + (props.className ?? "")}
      style={{
        width: fw,
        height: props.height,
        backgroundImage: `url(${JSON.stringify(th.url)})`,
        backgroundSize: `${th.count * th.width * s}px ${props.height}px`,
        backgroundPosition: `${-i * th.width * s}px 0`,
      }}
    />
  );
}

// ---------------------------------------------------------------- ribbon

const GUTTER = 76;

export function Ribbon(props: { rep: PredictionReport }) {
  const { rep } = props;
  const n = rep.seconds.length;
  const [ref, W] = useWidth<HTMLDivElement>();
  const time = usePlayer((s) => s.time);
  const hover = useInspect((s) => s.hover);
  const plotW = Math.max(120, W - GUTTER - 10);
  const x = (t: number) => GUTTER + (t / n) * plotW;
  const toTime = (cx: number, el: HTMLElement) => ((cx - el.getBoundingClientRect().left - GUTTER) / plotW) * n;
  const { handlers, hx } = useTimePointer(toTime, n);

  const TH = 50, HEAT = 10, CH = 118, SP = 18, AX = 18;
  const yThumb = 0, yHeat = TH + 4, yChart = yHeat + HEAT + 8, ySpeech = yChart + CH + 6, yAxis = ySpeech + SP + 2;
  const H = yAxis + AX;
  const yv = (v: number) => yChart + CH - (v / 100) * CH;
  const cell = plotW / n;

  const pts = (key: "attention" | "neural" | "features") => rep.seconds.map((s, i) => `${x(i + 0.5).toFixed(1)},${yv((s[key] ?? 0) as number).toFixed(1)}`).join(" ");
  const area = `M${x(0.5)},${yChart + CH} L${pts("attention").split(" ").join(" L")} L${x(n - 0.5)},${yChart + CH} Z`;
  const step = tickStep(n, plotW);
  const ticks: number[] = [];
  for (let t = 0; t <= n; t += step) ticks.push(t);
  const maxWords = Math.max(3, ...rep.features.map((f) => f.speech));
  const hasNeural = rep.seconds.some((s) => s.neural !== undefined);

  // thumbnails: one frame per cell, or every k-th second when cells are narrow
  const th = rep.thumbs;
  const fw = th ? (TH * th.width) / th.height : TH;
  const k = cell >= fw * 0.4 ? 1 : Math.ceil((fw * 0.5) / Math.max(0.1, cell));

  const hs = hover !== null ? rep.seconds[hover] : null;
  return (
    <div className="lab-ribbon" ref={ref}>
      <div className="lab-ribbon-plot" style={{ height: H }} {...handlers}>
        <div className="lab-row-label" style={{ top: yThumb + TH / 2 - 7 }}>Frames</div>
        <div className="lab-row-label" style={{ top: yHeat - 3 }}>Heat</div>
        <div className="lab-row-label" style={{ top: yChart + 2 }}>Attention</div>
        <div className="lab-row-label" style={{ top: ySpeech + 2 }}>Speech</div>
        {th
          ? Array.from({ length: Math.ceil(n / k) }, (_, j) => {
              const t = j * k;
              const w = Math.min(cell * k, plotW - (x(t) - GUTTER));
              const s = TH / th.height;
              const off = (w - th.width * s) / 2;
              return (
                <div
                  key={t}
                  className="lab-ribbon-thumb"
                  style={{
                    left: x(t),
                    width: Math.max(1, w - 1),
                    height: TH,
                    top: yThumb,
                    backgroundImage: `url(${JSON.stringify(th.url)})`,
                    backgroundSize: `${th.count * th.width * s}px ${TH}px`,
                    backgroundPosition: `${-thumbIndex(th, t + (k > 1 ? k / 2 : 0)) * th.width * s + off}px 0`,
                  }}
                />
              );
            })
          : null}
        <svg className="lab-svg" width={W} height={H}>
          <defs>
            <linearGradient id="lab-att-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#3987e5" stopOpacity="0.34" />
              <stop offset="1" stopColor="#3987e5" stopOpacity="0.02" />
            </linearGradient>
            <pattern id="lab-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#5a5a5a" strokeWidth="1.5" />
            </pattern>
          </defs>
          {/* heat strip */}
          {rep.seconds.map((s, i) => (
            <rect key={i} x={x(i) + 0.5} y={yHeat} width={Math.max(0.5, cell - 1)} height={HEAT} rx={1.5} fill={seqColor(s.attention)} />
          ))}
          {/* moments */}
          {rep.moments.map((m, i) => (
            <rect key={i} x={x(m.start)} y={yChart} width={Math.max(2, x(m.end) - x(m.start))} height={CH} fill={m.kind === "peak" ? "rgba(12,163,12,0.10)" : "rgba(208,59,59,0.12)"} />
          ))}
          {/* grid */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={GUTTER} x2={GUTTER + plotW} y1={yv(v)} y2={yv(v)} stroke={v === 0 ? "#383835" : "#2a2a2a"} strokeWidth={1} />
              {v > 0 && v < 100 ? <text x={GUTTER - 6} y={yv(v) + 3} textAnchor="end" className="lab-axis">{v}</text> : null}
            </g>
          ))}
          {/* cuts */}
          {rep.features.filter((f) => f.cut).map((f) => (
            <g key={f.t}>
              <line x1={x(f.t)} x2={x(f.t)} y1={yChart} y2={yChart + CH} stroke="#4a4a4a" strokeDasharray="2 3" />
              <path d={`M${x(f.t) - 3.5},${yAxis + 1} L${x(f.t) + 3.5},${yAxis + 1} L${x(f.t)},${yAxis + 6} Z`} fill="#9a9a9a" />
            </g>
          ))}
          <path d={area} fill="url(#lab-att-fill)" />
          <polyline points={pts("features")} fill="none" stroke="#8a8a8a" strokeWidth={1.25} strokeDasharray="3 3" strokeLinejoin="round" />
          {hasNeural ? <polyline points={pts("neural")} fill="none" stroke={NEURAL_COLOR} strokeWidth={1.5} strokeLinejoin="round" opacity={0.9} /> : null}
          <polyline points={pts("attention")} fill="none" stroke="#5598e7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* moment markers */}
          {rep.moments.map((m, i) => {
            const mx = (x(m.start) + x(m.end)) / 2;
            const peak = m.kind === "peak";
            return (
              <g key={i}>
                <title>{`${peak ? "Peak" : "Dip"} ${fmtTime(m.start)}–${fmtTime(m.end)}: ${m.label}`}</title>
                <path d={peak ? `M${mx - 5},${yChart + 9} L${mx + 5},${yChart + 9} L${mx},${yChart + 2} Z` : `M${mx - 5},${yChart + 2} L${mx + 5},${yChart + 2} L${mx},${yChart + 9} Z`} fill={peak ? "#0ca30c" : "#d03b3b"} />
              </g>
            );
          })}
          {/* speech */}
          {rep.features.map((f) =>
            f.silent ? (
              <rect key={f.t} x={x(f.t) + 0.5} y={ySpeech} width={Math.max(0.5, cell - 1)} height={SP} fill="url(#lab-hatch)" />
            ) : (
              <rect key={f.t} x={x(f.t) + 0.5} y={ySpeech + SP - Math.max(2, (f.speech / maxWords) * SP)} width={Math.max(0.5, cell - 1)} height={Math.max(2, (f.speech / maxWords) * SP)} rx={1} fill="#6b6b6b" />
            ),
          )}
          {/* axis */}
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={yAxis + 15} textAnchor={t === 0 ? "start" : t >= n ? "end" : "middle"} className="lab-axis">{fmtTime(t)}</text>
          ))}
        </svg>
        {hover !== null ? <div className="lab-hover-cell" style={{ left: x(hover), width: cell, top: 0, height: yAxis }} /> : null}
        <Playhead x={x(Math.min(time, n))} bottom={AX - 4} />
        {hx !== null && hs ? (
          <Tip x={hx} width={W} top={yChart}>
            <div className="lab-tip-head">{fmtTime(hs.t)}</div>
            <div className="lab-tip-row"><span className="lab-key" style={{ background: "#5598e7" }} /><strong>{Math.round(hs.attention!)}</strong> attention</div>
            {hs.neural !== undefined ? <div className="lab-tip-row"><span className="lab-key" style={{ background: NEURAL_COLOR }} /><strong>{Math.round(hs.neural!)}</strong> neural</div> : null}
            <div className="lab-tip-row"><span className="lab-key dashed" /><strong>{Math.round(hs.features!)}</strong> features</div>
            {hs.drivers[0] ? <div className="lab-tip-note">{hs.drivers.join(" · ")}</div> : null}
          </Tip>
        ) : null}
      </div>
    </div>
  );
}

export function RibbonLegend(props: { rep: PredictionReport }) {
  const hasNeural = props.rep.seconds.some((s) => s.neural !== undefined);
  return (
    <div className="lab-legend">
      <span><i className="lab-key" style={{ background: "#5598e7" }} /> Attention (estimate)</span>
      {hasNeural ? <span><i className="lab-key" style={{ background: NEURAL_COLOR }} /> Neural component (TRIBE v2)</span> : null}
      <span><i className="lab-key dashed" /> Feature component (measured)</span>
      <span><i className="lab-tri up" /> Peak</span>
      <span><i className="lab-tri down" /> Dip</span>
      <span><i className="lab-tri cut" /> Cut</span>
      <span><i className="lab-hatchkey" /> Silence</span>
    </div>
  );
}

// ---------------------------------------------------------------- retention

export function RetentionChart(props: { rep: PredictionReport; focus: PlatformId; onFocus: (p: PlatformId) => void }) {
  const { rep, focus } = props;
  const n = Math.max(2, ...rep.platforms.map((p) => p.retention.length));
  const [ref, W] = useWidth<HTMLDivElement>();
  const time = usePlayer((s) => s.time);
  const L = 40, R = 52, T = 18, B = 24, H = 236;
  const plotW = Math.max(100, W - L - R);
  const plotH = H - T - B;
  const x = (t: number) => L + (t / (n - 1)) * plotW;
  const y = (v: number) => T + plotH - (v / 100) * plotH;
  const toTime = (cx: number, el: HTMLElement) => ((cx - el.getBoundingClientRect().left - L) / plotW) * (n - 1);
  const { handlers, hx } = useTimePointer(toTime, n);
  const hover = useInspect((s) => s.hover);
  const step = tickStep(n, plotW);
  const ticks: number[] = [];
  for (let t = 0; t < n; t += step) ticks.push(t);
  const fp = rep.platforms.find((p) => p.platform === focus) ?? rep.platforms[0];
  const ordered = [...rep.platforms.filter((p) => p.platform !== fp?.platform), ...(fp ? [fp] : [])];
  const path = (r: number[]) => r.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const hookEnd = Math.min(3, n - 1);

  return (
    <div className="lab-ret" ref={ref}>
      <div className="lab-ret-plot" style={{ height: H }} {...handlers}>
        <svg className="lab-svg" width={W} height={H}>
          <rect x={x(0)} y={T} width={x(hookEnd) - x(0)} height={plotH} fill="rgba(255,255,255,0.045)" />
          <text x={x(0) + 4} y={T - 6} className="lab-axis">Hook 0–3s</text>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={L + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#383835" : "#2a2a2a"} />
              <text x={L - 6} y={y(v) + 3} textAnchor="end" className="lab-axis">{v}%</text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={H - 6} textAnchor={t === 0 ? "start" : "middle"} className="lab-axis">{fmtTime(t)}</text>
          ))}
          {fp ? (
            <g>
              <line x1={x(Math.min(n - 1, fp.avgViewSec))} x2={x(Math.min(n - 1, fp.avgViewSec))} y1={T} y2={T + plotH} stroke="#9a9a9a" strokeDasharray="3 3" />
              <text x={x(Math.min(n - 1, fp.avgViewSec)) + 4} y={T + plotH - 6} className="lab-axis strong">avg view {fmtTime(fp.avgViewSec)}</text>
            </g>
          ) : null}
          {ordered.map((p) => {
            const on = p.platform === fp?.platform;
            return (
              <path
                key={p.platform}
                d={path(p.retention)}
                fill="none"
                stroke={PLATFORM_COLOR[p.platform]}
                strokeWidth={on ? 2.25 : 1.5}
                opacity={on ? 1 : 0.38}
                strokeLinejoin="round"
                style={{ cursor: "pointer" }}
              />
            );
          })}
          {fp ? (
            <g>
              <circle cx={x(fp.retention.length - 1)} cy={y(fp.retention[fp.retention.length - 1])} r={4} fill={PLATFORM_COLOR[fp.platform]} stroke="#1e1e1e" strokeWidth={2} />
              <text x={x(fp.retention.length - 1) + 8} y={y(fp.retention[fp.retention.length - 1]) + 4} className="lab-axis strong">{Math.round(fp.completionPct)}%</text>
              <circle cx={x(hookEnd)} cy={y(fp.retention[hookEnd])} r={4} fill={PLATFORM_COLOR[fp.platform]} stroke="#1e1e1e" strokeWidth={2} />
              <text x={x(hookEnd) + 7} y={y(fp.retention[hookEnd]) - 7} className="lab-axis strong">{Math.round(fp.hookHoldPct)}%</text>
            </g>
          ) : null}
        </svg>
        <Playhead x={x(Math.min(time, n - 1))} top={T} bottom={B} />
        {hx !== null && hover !== null ? (
          <>
            <div className="lab-crosshair" style={{ left: x(hover), top: T, height: plotH }} />
            <Tip x={hx} width={W} top={T}>
              <div className="lab-tip-head">{fmtTime(hover)} · still watching</div>
              {rep.platforms.map((p) => (
                <div key={p.platform} className={"lab-tip-row" + (p.platform === fp?.platform ? " on" : "")}>
                  <span className="lab-key" style={{ background: PLATFORM_COLOR[p.platform] }} />
                  <strong>{Math.round(p.retention[Math.min(hover, p.retention.length - 1)])}%</strong> {platformName(p.platform)}
                </div>
              ))}
            </Tip>
          </>
        ) : null}
      </div>
      <div className="lab-legend">
        {rep.platforms.map((p) => (
          <button key={p.platform} className={"lab-legend-btn" + (p.platform === fp?.platform ? " on" : "")} onClick={() => props.onFocus(p.platform)}>
            <i className="lab-key" style={{ background: PLATFORM_COLOR[p.platform] }} /> {platformName(p.platform)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- brain networks

export function BrainRows(props: { rep: PredictionReport }) {
  const tribe = props.rep.tribe!;
  const n = tribe.global.length;
  const [ref, W] = useWidth<HTMLDivElement>();
  const time = usePlayer((s) => s.time);
  const hover = useInspect((s) => s.hover);
  const LBL = 128, BAR = 92;
  const plotW = Math.max(100, W - LBL - BAR - 16);
  const x = (t: number) => LBL + (t / n) * plotW;
  const toTime = (cx: number, el: HTMLElement) => ((cx - el.getBoundingClientRect().left - LBL) / plotW) * n;
  const { handlers, hx } = useTimePointer(toTime, n);
  const cur = Math.min(n - 1, Math.max(0, hover ?? Math.floor(time)));
  const RH = 18, GAP = 3;
  const rows: { id: NetworkId | "global"; name: string; meaning: string; values: number[] }[] = [
    ...NETWORKS.map((nw) => ({ id: nw.id, name: nw.name, meaning: nw.meaning, values: tribe.networks[nw.id] ?? [] })),
    { id: "global", name: "Whole cortex", meaning: "Mean absolute predicted activation across all cortical vertices", values: tribe.global },
  ];
  const H = rows.length * (RH + GAP) + 18;
  const cell = plotW / n;
  const hv = hover !== null && hx !== null ? hover : null;
  return (
    <div className="lab-brain" ref={ref}>
      <div className="lab-brain-plot" style={{ height: H }} {...handlers}>
        <svg className="lab-svg" width={W} height={H}>
          {rows.map((r, ri) => {
            const yy = ri * (RH + GAP) + (r.id === "global" ? 6 : 0);
            const v = r.values[cur] ?? 0;
            const mid = LBL + plotW + 16 + BAR / 2;
            const bw = (Math.min(2.5, Math.abs(v)) / 2.5) * (BAR / 2);
            return (
              <g key={r.id}>
                <text x={0} y={yy + RH / 2 + 4} className={"lab-brain-name" + (r.id === "global" ? " dim" : "")}>
                  <title>{r.meaning}</title>
                  {r.name}
                </text>
                {r.values.map((z, i) => (
                  <rect key={i} x={x(i) + 0.25} y={yy} width={Math.max(0.5, cell - 0.5)} height={RH} fill={divColor(z)} />
                ))}
                <line x1={mid} x2={mid} y1={yy} y2={yy + RH} stroke="#4a4a4a" />
                <rect x={v >= 0 ? mid : mid - bw} y={yy + 4} width={Math.max(1, bw)} height={RH - 8} rx={2} fill={divColor(v * 1.4)} />
              </g>
            );
          })}
          <text x={LBL + plotW + 16} y={H - 4} className="lab-axis">−</text>
          <text x={LBL + plotW + 16 + BAR / 2} y={H - 4} textAnchor="middle" className="lab-axis strong">{fmtTime(cur)}</text>
          <text x={LBL + plotW + 16 + BAR} y={H - 4} textAnchor="end" className="lab-axis">+</text>
          <text x={LBL} y={H - 4} className="lab-axis">0:00</text>
          <text x={LBL + plotW} y={H - 4} textAnchor="end" className="lab-axis">{fmtTime(n)}</text>
        </svg>
        <Playhead x={x(Math.min(time, n))} bottom={18} />
        {hv !== null ? <div className="lab-hover-cell" style={{ left: x(hv), width: cell, top: 0, height: H - 18 }} /> : null}
        {hv !== null && hx !== null ? (
          <Tip x={hx} width={W} top={4}>
            <div className="lab-tip-head">{fmtTime(hv)} · predicted activation (z)</div>
            {rows.slice(0, -1).map((r) => (
              <div key={r.id} className="lab-tip-row">
                <span className="lab-key" style={{ background: divColor(r.values[hv] ?? 0) }} />
                <strong>{(r.values[hv] ?? 0) >= 0 ? "+" : ""}{(r.values[hv] ?? 0).toFixed(2)}</strong> {r.name}
              </div>
            ))}
          </Tip>
        ) : null}
      </div>
      <div className="lab-legend">
        <span className="lab-divkey"><i style={{ background: "linear-gradient(90deg,#3987e5,#383835,#e66767)" }} /> below average · typical · above average for this video (z-score)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tiny sparkline

export function Sparkline(props: { values: number[]; width: number; height: number; color: string; max?: number }) {
  const { values, width, height } = props;
  const max = props.max ?? 100;
  if (values.length < 2) return null;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className="lab-spark">
      <path d={d} fill="none" stroke={props.color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Keep hover cleared when leaving the report. */
export function useResetInspect() {
  useEffect(() => () => useInspect.getState().setHover(null), []);
}
