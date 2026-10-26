// Content Lab report: score, synced player, per-second ribbon, retention,
// brain response, platforms, moments, suggestions, coaching, transcript.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, AudioLines, BookOpen, Brain, Captions, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy, Download, Eye, Gauge as GaugeIcon,
  MessageSquareText, Pause, Play, Plus, Smartphone, Timer, TrendingDown, TrendingUp, Trophy, Volume2, VolumeX, X, Zap, ExternalLink, Plug, Scissors,
} from "lucide-react";
import type { PlatformId, PredictionReport, Suggestion, SuggestionKind } from "@shared/predict";
import { NETWORKS } from "@shared/predict";
import { useEditor } from "../../store/store";
import { goTo } from "../../engine/transport";
import { openPanel } from "../../dock";
import { Button, IconButton } from "../../ui/kit";
import { Markdown } from "../ai/toolLabels";
import { usePlayer, useLab } from "./labStore";
import { BrainRows, Gauge, Meter, RetentionChart, Ribbon, RibbonLegend, Thumb, useInspect, useResetInspect, useWidth } from "./charts";
import { NEURAL_COLOR, PLATFORM_COLOR, band, divColor, fitNotes, fmtDate, fmtDuration, fmtRange, fmtTime, platformName, seqColor, summaryText } from "./format";
import { TribePopover } from "./StartScreen";

// ---------------------------------------------------------------- bits

type Prov = "measured" | "estimated" | "tribe" | "claude";
const PROV: Record<Prov, { label: string; title: string }> = {
  measured: { label: "Measured", title: "Computed directly from the video file (ffmpeg / Whisper)" },
  estimated: { label: "Estimated", title: "EditCut's model, built on measured features and (when available) TRIBE v2. Not platform analytics." },
  tribe: { label: "Predicted · TRIBE v2", title: "Meta's TRIBE v2 predicts the average viewer's cortical fMRI response. A research model." },
  claude: { label: "Written by Claude", title: "Claude wrote this from the numbers in this report" },
};

function Panel(props: { title: ReactNode; prov?: Prov[]; right?: ReactNode; children: ReactNode; className?: string; area?: string }) {
  return (
    <section className={"lab-panel " + (props.className ?? "")} style={props.area ? { gridArea: props.area } : undefined}>
      <header className="lab-panel-head">
        <h3>{props.title}</h3>
        {props.prov?.map((p) => (
          <span key={p} className={"lab-prov " + p} title={PROV[p].title}>{PROV[p].label}</span>
        ))}
        <span className="spacer" />
        {props.right}
      </header>
      <div className="lab-panel-body">{props.children}</div>
    </section>
  );
}

function BandLabel(props: { score: number }) {
  const b = band(props.score);
  const Icon = b.key === "good" ? TrendingUp : b.key === "critical" ? TrendingDown : b.key === "serious" ? AlertTriangle : Check;
  return (
    <span className={"lab-band " + b.key}>
      <Icon size={11} /> {b.label}
    </span>
  );
}

function TimeChip(props: { start?: number; end?: number }) {
  const seek = usePlayer((s) => s.seek);
  if (props.start === undefined) return null;
  return (
    <button className="lab-timechip" onClick={(e) => { e.stopPropagation(); seek(props.start!); }} title="Jump to this moment">
      <Play size={9} /> {fmtRange(props.start, props.end)}
    </button>
  );
}

/** Open the analyzed source in the editor at time t (sequence or Source Monitor), when known. */
function useOpenInEditor(rep: PredictionReport, standalone?: boolean) {
  const remembered = useLab((s) => s.sources[rep.id]);
  const src = rep.source ?? remembered;
  const project = useEditor((s) => s.project);
  if (standalone || !src) return null;
  if (src.startsWith("asset:")) {
    const id = src.slice(6);
    if (!project.media[id]) return null;
    return (t: number) => {
      useEditor.getState().setUI({ mode: "edit", sourceAssetId: id, focusedMonitor: "source" });
      openPanel("source");
      setTimeout(() => goTo("source", t), 50);
    };
  }
  if (!project.sequences[src]) return null;
  return (t: number) => {
    const e = useEditor.getState();
    if (e.project.activeSequenceId !== src) e.patch((d) => { d.activeSequenceId = src; });
    e.setUI({ mode: "edit", focusedMonitor: "program" });
    openPanel("timeline");
    setTimeout(() => goTo("program", t), 50);
  };
}

// ---------------------------------------------------------------- header

function EngineBadges(props: { rep: PredictionReport }) {
  const { engine, tribe } = props.rep;
  const [pop, setPop] = useState(false);
  const tribeBadge =
    engine.tribe === "used" ? (
      <span className="lab-badge neural" title={tribe ? `${tribe.model} on ${tribe.device} · ${tribe.modalities.join(" + ")} · ${tribe.elapsedSec.toFixed(0)}s` : "TRIBE v2"}>
        <Brain size={12} /> TRIBE v2 used
      </span>
    ) : engine.tribe === "failed" ? (
      <span className="lab-badge bad" title={engine.tribeError ?? "TRIBE v2 failed"}>
        <AlertTriangle size={12} /> TRIBE v2 failed
      </span>
    ) : (
      <span className="lab-pop-anchor">
        <button className="lab-badge off" onClick={() => setPop((v) => !v)} title="Brain-response predictions were not included">
          <Brain size={12} /> {engine.tribe === "disabled" ? "TRIBE v2 off" : "TRIBE v2 not connected"}
        </button>
        {pop ? <TribePopover onClose={() => setPop(false)} /> : null}
      </span>
    );
  const claude =
    engine.claude === "used" ? <span className="lab-badge"><MessageSquareText size={12} /> Claude coaching</span>
    : engine.claude === "failed" ? <span className="lab-badge bad"><MessageSquareText size={12} /> Claude failed</span>
    : engine.claude === "unavailable" ? (
      <button className="lab-badge off" onClick={() => useEditor.getState().openDialog("aiSettings")} title="Connect Claude in AI Settings"><MessageSquareText size={12} /> Claude unavailable</button>
    ) : <span className="lab-badge off"><MessageSquareText size={12} /> No coaching</span>;
  return (
    <div className="lab-badges">
      {tribeBadge}
      {claude}
    </div>
  );
}

function ReportHeader(props: { rep: PredictionReport }) {
  const { rep } = props;
  const setView = useLab((s) => s.setView);
  const refreshHistory = useLab((s) => s.refreshHistory);
  const download = () => {
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${rep.fileName.replace(/\.[^.]+$/, "")}.contentlab.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const copy = () => {
    navigator.clipboard
      .writeText(summaryText(rep))
      .then(() => useEditor.getState().toast("Summary copied", "success"))
      .catch(() => useEditor.getState().toast("Couldn't access the clipboard", "error"));
  };
  return (
    <div className="lab-rhead">
      <IconButton title="Back to Content Lab" onClick={() => { void refreshHistory(); setView({ kind: "start" }); }}>
        <ArrowLeft size={15} />
      </IconButton>
      <div className="lab-rhead-title">
        <h1 title={rep.fileName}>{rep.fileName}</h1>
        <div className="lab-rhead-meta">
          <span>{fmtDuration(rep.durationSec)}</span>
          {rep.width && rep.height ? <span>{rep.width}×{rep.height}{rep.height > rep.width * 1.1 ? " · vertical" : ""}</span> : null}
          <span>Analyzed {fmtDate(rep.createdAt)}</span>
        </div>
      </div>
      <EngineBadges rep={rep} />
      <span className="spacer" />
      <Button small onClick={copy}><span className="lab-btn-in"><ClipboardCopy size={12} /> Copy summary</span></Button>
      <Button small onClick={download}><span className="lab-btn-in"><Download size={12} /> Download JSON</span></Button>
      <Button small primary onClick={() => setView({ kind: "start" })}><span className="lab-btn-in"><Plus size={12} /> New analysis</span></Button>
    </div>
  );
}

// ---------------------------------------------------------------- score

function ScoreHero(props: { rep: PredictionReport }) {
  const { rep } = props;
  const o = rep.overall;
  const best = rep.platforms.find((p) => p.platform === rep.bestPlatform);
  return (
    <Panel title="Content score" prov={["estimated"]} area="score" className="lab-score">
      <div className="lab-score-top">
        <Gauge score={o.score} />
        <div className="lab-score-side">
          <BandLabel score={o.score} />
          <p className="lab-score-blurb">
            {o.score >= 75 ? "Likely to hold attention well." : o.score >= 58 ? "Solid, with a few fixable leaks." : o.score >= 40 ? "Viewers will drift; fix the dips below." : "Most viewers will scroll past. Rework the hook."}
          </p>
        </div>
      </div>
      <div className="lab-meters">
        <Meter label="Hook (0–3s)" value={o.hook} hint="Strength of the first three seconds" />
        <Meter label="Pacing" value={o.pacing} hint="Cuts, motion and information rate over time" />
        <Meter label="Clarity" value={o.clarity} hint="Audio and speech clarity (loudness, silence, speech rate)" />
        {o.neural !== undefined ? <Meter label="Neural engagement" value={o.neural} accent={NEURAL_COLOR} hint="Mean TRIBE v2-based engagement" /> : null}
      </div>
      {best ? (
        <div className="lab-best">
          <Trophy size={14} />
          <div>
            <div className="lab-best-name">Best fit: <strong>{platformName(best.platform)}</strong> <span className="lab-best-score">{Math.round(best.score)}</span></div>
            <div className="lab-best-note">{Math.round(best.hookHoldPct)}% past the hook · {Math.round(best.completionPct)}% finish (predicted)</div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- player

function Player(props: { rep: PredictionReport }) {
  const { rep } = props;
  const vref = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);
  const [muted, setMuted] = useState(false);
  const time = usePlayer((s) => s.time);
  const playing = usePlayer((s) => s.playing);
  const { toggle, seek, setVideo, reset } = usePlayer.getState();
  const n = rep.seconds.length || Math.ceil(rep.durationSec);
  const dur = rep.durationSec || n;

  useEffect(() => {
    reset(dur);
    return () => {
      usePlayer.getState().pause();
      usePlayer.getState().setVideo(null, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep.id]);

  // keyboard: space play/pause, arrows ±1s (captured so editor shortcuts don't fire)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (useEditor.getState().dialog) return;
      const p = usePlayer.getState();
      if (e.key === " " || e.key === "k" || e.key === "K") p.toggle();
      else if (e.key === "ArrowLeft") p.seek(p.time - (e.shiftKey ? 5 : 1));
      else if (e.key === "ArrowRight") p.seek(p.time + (e.shiftKey ? 5 : 1));
      else if (e.key === "Home") p.seek(0);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, []);

  const scrub = useRef<HTMLDivElement>(null);
  const [scrubHover, setScrubHover] = useState<number | null>(null);
  const tAt = (cx: number) => {
    const r = scrub.current!.getBoundingClientRect();
    return Math.max(0, Math.min(dur, ((cx - r.left) / r.width) * dur));
  };
  const dragging = useRef(false);
  const ar = rep.width && rep.height ? rep.width / rep.height : 16 / 9;
  const [screenRef, screenW] = useWidth<HTMLDivElement>();
  const frameH = Math.max(120, Math.min(window.innerWidth > 1440 ? 400 : 340, (Math.max(200, screenW) - 20) / ar));
  const moments = [...rep.moments].sort((a, b) => a.start - b.start);
  const jump = (dir: 1 | -1) => {
    const list = dir > 0 ? moments.filter((m) => m.start > time + 0.3) : moments.filter((m) => m.start < time - 0.3).reverse();
    if (list[0]) seek(list[0].start);
  };
  return (
    <section className="lab-panel lab-player" style={{ gridArea: "player" }}>
      <div className="lab-screen" ref={screenRef}>
        <div className="lab-frame" style={{ height: frameH, width: frameH * ar }} onClick={toggle}>
          <video
            ref={vref}
            src={rep.videoUrl}
            playsInline
            preload="auto"
            muted={muted}
            style={{ opacity: playable ? 1 : 0 }}
            onLoadedMetadata={(e) => {
              setPlayable(true);
              setVideo(e.currentTarget, true);
              e.currentTarget.currentTime = usePlayer.getState().time;
            }}
            onError={(e) => {
              setPlayable(false);
              setVideo(e.currentTarget, false);
            }}
          />
          {!playable ? (
            <>
              <div className="lab-frame-fallback">
                <Thumb rep={rep} t={time} height={frameH} />
              </div>
              <span className="lab-frame-note">Preview frames · video not available</span>
            </>
          ) : null}
          {!playing ? <div className="lab-frame-play"><Play size={26} /></div> : null}
        </div>
      </div>
      <div className="lab-transport">
        <div
          className="lab-scrub"
          ref={scrub}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seek(tAt(e.clientX));
          }}
          onPointerMove={(e) => {
            setScrubHover(tAt(e.clientX));
            if (dragging.current) seek(tAt(e.clientX));
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => setScrubHover(null)}
        >
          <div className="lab-scrub-heat">
            {rep.seconds.map((s) => <i key={s.t} style={{ background: seqColor(s.attention) }} />)}
          </div>
          <div className="lab-scrub-played" style={{ width: `${(time / dur) * 100}%` }} />
          <div className="lab-scrub-knob" style={{ left: `${(time / dur) * 100}%` }} />
          {scrubHover !== null ? (
            <div className="lab-scrub-tip" style={{ left: `${(scrubHover / dur) * 100}%` }}>
              {rep.thumbs ? <Thumb rep={rep} t={scrubHover} height={64} /> : null}
              <span>{fmtTime(scrubHover)}</span>
            </div>
          ) : null}
        </div>
        <div className="lab-transport-row">
          <IconButton title="Previous moment" onClick={() => jump(-1)}><ChevronLeft size={15} /></IconButton>
          <IconButton title={playing ? "Pause (Space)" : "Play (Space)"} onClick={toggle} active={playing}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>
          <IconButton title="Next moment" onClick={() => jump(1)}><ChevronRight size={15} /></IconButton>
          <span className="lab-tc">{fmtTime(time)}</span>
          <span className="lab-tc dim">/ {fmtTime(dur)}</span>
          <span className="spacer" />
          <IconButton title={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</IconButton>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- inspector

function Inspector(props: { rep: PredictionReport }) {
  const { rep } = props;
  const hover = useInspect((s) => s.hover);
  const time = usePlayer((s) => s.time);
  const n = rep.seconds.length;
  const t = Math.max(0, Math.min(n - 1, hover ?? Math.floor(time)));
  const s = rep.seconds[t];
  const f = rep.features[t];
  const moment = rep.moments.find((m) => t >= m.start && t < m.end);
  if (!s) return null;
  return (
    <Panel title={<>Second <span className="lab-tc">{fmtTime(t)}</span>{hover !== null ? <span className="lab-inspect-mode">hover</span> : null}</>} area="inspect" className="lab-inspect">
      <div className="lab-insp-top">
        <Thumb rep={rep} t={t} height={86} />
        <div className="lab-insp-score">
          <div className="lab-insp-num">{Math.round(s.attention)}</div>
          <div className="lab-insp-lbl">predicted attention</div>
          <BandLabel score={s.attention} />
        </div>
      </div>
      {moment ? (
        <div className={"lab-insp-moment " + moment.kind}>
          {moment.kind === "peak" ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {moment.label}
        </div>
      ) : null}
      {s.drivers.length ? (
        <div className="lab-drivers">
          {s.drivers.map((d) => <span key={d} className="lab-driver">{d}</span>)}
        </div>
      ) : null}
      <dl className="lab-kv">
        {s.neural !== undefined ? (<><dt>Neural</dt><dd>{Math.round(s.neural)}</dd></>) : null}
        <dt>Features</dt><dd>{Math.round(s.features)}</dd>
        {f ? (
          <>
            <dt>Loudness</dt><dd>{f.silent ? "silent" : `${f.loudness.toFixed(0)} dBFS`}</dd>
            <dt>Motion</dt><dd>{Math.round(f.motion * 100)}%{f.cut ? " · cut" : ""}</dd>
            <dt>Speech</dt><dd className="lab-words">{f.text ? `“${f.text}”` : f.speech ? `${f.speech} words` : "—"}</dd>
          </>
        ) : null}
      </dl>
      {rep.tribe ? (
        <div className="lab-insp-nets">
          {NETWORKS.map((nw) => {
            const z = rep.tribe!.networks[nw.id]?.[t] ?? 0;
            const w = (Math.min(2.5, Math.abs(z)) / 2.5) * 50;
            return (
              <div key={nw.id} className="lab-insp-net" title={`${nw.name}: ${nw.meaning}`}>
                <span className="lab-insp-net-name">{nw.name}</span>
                <span className="lab-insp-net-bar">
                  <i className="mid" />
                  <i className="val" style={{ left: z >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: divColor(z * 1.4) }} />
                </span>
                <span className="lab-insp-net-v">{z >= 0 ? "+" : ""}{z.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- retention

function Retention(props: { rep: PredictionReport }) {
  const { rep } = props;
  const [focus, setFocus] = useState<PlatformId>(rep.bestPlatform);
  const fp = rep.platforms.find((p) => p.platform === focus) ?? rep.platforms[0];
  if (!fp) return null;
  return (
    <Panel
      title="Predicted retention"
      prov={["estimated"]}
      area="retention"
      right={
        <div className="lab-ptabs">
          {rep.platforms.map((p) => (
            <button key={p.platform} className={"lab-ptab" + (p.platform === fp.platform ? " on" : "")} onClick={() => setFocus(p.platform)}>
              <i style={{ background: PLATFORM_COLOR[p.platform] }} />
              {platformName(p.platform).replace("Instagram ", "").replace("YouTube Shorts", "Shorts")}
            </button>
          ))}
        </div>
      }
    >
      <div className="lab-ret-stats">
        <div><span>Past the hook</span><strong>{Math.round(fp.hookHoldPct)}%</strong></div>
        <div><span>Avg view</span><strong>{fmtTime(fp.avgViewSec)}</strong><em>{Math.round(fp.avgViewPct)}%</em></div>
        <div><span>Finish</span><strong>{Math.round(fp.completionPct)}%</strong></div>
        <div><span>{platformName(fp.platform)} score</span><strong>{Math.round(fp.score)}</strong><BandLabel score={fp.score} /></div>
      </div>
      <RetentionChart rep={rep} focus={fp.platform} onFocus={setFocus} />
      <p className="lab-footnote">% of viewers still watching at each second, as estimated by EditCut. Not data from {platformName(fp.platform)}.</p>
    </Panel>
  );
}

// ---------------------------------------------------------------- brain

function BrainPanel(props: { rep: PredictionReport }) {
  const { rep } = props;
  const [pop, setPop] = useState(false);
  if (!rep.tribe) {
    return (
      <Panel title="Brain response" area="brain" className="lab-brain-empty">
        <div className="lab-empty-card">
          <Brain size={22} />
          <div>
            <strong>{rep.engine.tribe === "failed" ? "TRIBE v2 failed for this video" : "Brain response wasn't predicted for this video"}</strong>
            <p>
              {rep.engine.tribe === "failed" && rep.engine.tribeError ? <>{rep.engine.tribeError}. </> : null}
              Meta's TRIBE v2 predicts how the average viewer's cortex responds to each second: attention, salience, language, faces, social meaning. Connect a TRIBE v2 worker to add it to your next analysis.
            </p>
            <span className="lab-pop-anchor">
              <Button small onClick={() => setPop((v) => !v)}><span className="lab-btn-in"><Plug size={12} /> Connect TRIBE v2</span></Button>
              {pop ? <TribePopover onClose={() => setPop(false)} /> : null}
            </span>
          </div>
        </div>
      </Panel>
    );
  }
  const tr = rep.tribe;
  return (
    <Panel
      title="Brain response"
      prov={["tribe"]}
      area="brain"
      right={<span className="lab-meta-small">{tr.model} · {tr.device} · {tr.modalities.join(" + ")}{tr.mock ? <span className="lab-chip warn">MOCK</span> : null}</span>}
    >
      <BrainRows rep={rep} />
      <p className="lab-explainer">
        <Brain size={12} /> TRIBE v2 predicts the <em>average viewer's</em> cortical response (fMRI), one value per second, grouped here into functional networks. Higher sustained activity in the attention, salience and social networks tends to mean more engaging content. This is a research model of brain responses, not platform analytics. Values are relative within this video.
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------- platforms

function Platforms(props: { rep: PredictionReport }) {
  const { rep } = props;
  return (
    <Panel title="Platforms" prov={["estimated"]} area="platforms" className="lab-platforms">
      <div className="lab-pcards">
        {[...rep.platforms].sort((a, b) => b.score - a.score).map((p) => {
          const notes = fitNotes(rep, p.platform);
          return (
            <div key={p.platform} className={"lab-pcard" + (p.platform === rep.bestPlatform ? " best" : "")}>
              <div className="lab-pcard-head">
                <i className="lab-key" style={{ background: PLATFORM_COLOR[p.platform] }} />
                <strong>{platformName(p.platform)}</strong>
                {p.platform === rep.bestPlatform ? <span className="lab-chip best"><Trophy size={10} /> Best fit</span> : null}
                <span className="spacer" />
                <span className="lab-pcard-score">{Math.round(p.score)}</span>
                <BandLabel score={p.score} />
              </div>
              <div className="lab-pcard-stats">
                <div><strong>{Math.round(p.hookHoldPct)}%</strong><span>past hook</span></div>
                <div><strong>{Math.round(p.avgViewPct)}%</strong><span>avg view</span></div>
                <div><strong>{Math.round(p.completionPct)}%</strong><span>finish</span></div>
              </div>
              <p className="lab-pcard-verdict">{p.verdict}</p>
              <ul className="lab-fit">
                {notes.map((nt) => (
                  <li key={nt.text} className={nt.ok ? "ok" : "bad"}>{nt.ok ? <Check size={11} /> : <X size={11} />} {nt.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- moments

function Moments(props: { rep: PredictionReport }) {
  const { rep } = props;
  const seek = usePlayer((s) => s.seek);
  const time = usePlayer((s) => s.time);
  const peaks = rep.moments.filter((m) => m.kind === "peak").sort((a, b) => b.attention - a.attention);
  const dips = rep.moments.filter((m) => m.kind === "dip").sort((a, b) => a.attention - b.attention);
  const row = (m: (typeof rep.moments)[number], i: number) => (
    <button key={i} className={"lab-moment" + (time >= m.start && time < m.end ? " on" : "")} onClick={() => seek(m.start)}>
      <Thumb rep={rep} t={m.start + (m.end - m.start) / 2} height={44} />
      <div className="lab-moment-txt">
        <div className="lab-moment-top"><span className="lab-tc">{fmtRange(m.start, m.end)}</span><span className={"lab-moment-val " + m.kind}>{m.kind === "peak" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.round(m.attention)}</span></div>
        <div className="lab-moment-label">{m.label}</div>
      </div>
    </button>
  );
  return (
    <Panel title="Moments" prov={["estimated"]} area="moments">
      <div className="lab-moments">
        <div>
          <div className="lab-eyebrow">Strongest</div>
          {peaks.length ? peaks.map(row) : <div className="lab-hint">No clear peaks.</div>}
        </div>
        <div>
          <div className="lab-eyebrow">Weakest</div>
          {dips.length ? dips.map(row) : <div className="lab-hint">No clear dips.</div>}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- suggestions

const KIND_ICON: Record<SuggestionKind, typeof Zap> = {
  hook: Zap, pacing: GaugeIcon, "dead-air": VolumeX, audio: AudioLines, captions: Captions, length: Timer, visual: Eye, story: BookOpen, format: Smartphone,
};
const SEV: { key: Suggestion["severity"]; label: string }[] = [
  { key: "high", label: "Fix first" },
  { key: "medium", label: "Worth doing" },
  { key: "low", label: "Polish" },
];

function Suggestions(props: { rep: PredictionReport; standalone?: boolean }) {
  const { rep } = props;
  const openInEditor = useOpenInEditor(rep, props.standalone);
  const seek = usePlayer((s) => s.seek);
  return (
    <Panel title={`Suggestions · ${rep.suggestions.length}`} area="suggestions" className="lab-suggest">
      {SEV.map((sv) => {
        const list = rep.suggestions.filter((s) => s.severity === sv.key);
        if (!list.length) return null;
        return (
          <div key={sv.key} className="lab-sev">
            <div className={"lab-sev-head " + sv.key}><span className="lab-sev-dot" />{sv.label}<span className="lab-sev-count">{list.length}</span></div>
            {list.map((s) => {
              const Icon = KIND_ICON[s.kind] ?? Scissors;
              return (
                <div key={s.id} className="lab-sug" onClick={() => s.start !== undefined && seek(s.start)}>
                  <span className="lab-sug-icon"><Icon size={14} /></span>
                  <div className="lab-sug-body">
                    <div className="lab-sug-title">{s.title}</div>
                    <div className="lab-sug-detail">{s.detail}</div>
                    <div className="lab-sug-meta">
                      <TimeChip start={s.start} end={s.end} />
                      {s.impact ? <span className="lab-impact" title="Rough expected effect (estimate)">{s.impact}</span> : null}
                      <span className="lab-kind">{s.kind.replace("-", " ")}</span>
                      {openInEditor && s.start !== undefined ? (
                        <button className="lab-linkbtn" onClick={(e) => { e.stopPropagation(); openInEditor(s.start!); }}>
                          <ExternalLink size={11} /> Open in editor
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!rep.suggestions.length ? <div className="lab-hint">Nothing to fix. Ship it.</div> : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- coaching + transcript

function Coaching(props: { rep: PredictionReport }) {
  const { rep } = props;
  if (!rep.coaching) {
    return (
      <Panel title="Coaching" area="coaching">
        <div className="lab-empty-card small">
          <MessageSquareText size={18} />
          <div>
            <p>
              {rep.engine.claude === "failed" ? "Claude couldn't write coaching for this report." : rep.engine.claude === "skipped" ? "Written coaching was turned off for this analysis." : "Connect Claude to get a written edit plan with every report."}
            </p>
            {rep.engine.claude === "unavailable" ? <Button small onClick={() => useEditor.getState().openDialog("aiSettings")}>Open AI Settings</Button> : null}
          </div>
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Coaching" prov={["claude"]} area="coaching" className="lab-coach">
      <Markdown text={rep.coaching} />
    </Panel>
  );
}

function Transcript(props: { rep: PredictionReport }) {
  const { rep } = props;
  const [open, setOpen] = useState(false);
  const seek = usePlayer((s) => s.seek);
  const time = usePlayer((s) => s.time);
  const lines = useMemo(() => {
    const out: { t: number; text: string }[] = [];
    let cur: { t: number; text: string } | null = null;
    for (const f of rep.features) {
      if (!f.text) continue;
      if (!cur || f.t - cur.t >= 5 || /[.!?]$/.test(cur.text)) {
        cur = { t: f.t, text: f.text };
        out.push(cur);
      } else cur.text += " " + f.text;
    }
    return out;
  }, [rep]);
  if (!lines.length && !rep.transcript) return null;
  return (
    <section className="lab-panel lab-transcript" style={{ gridArea: "transcript" }}>
      <header className="lab-panel-head clickable" onClick={() => setOpen(!open)}>
        <ChevronDown size={13} className={"lab-twirl" + (open ? " open" : "")} />
        <h3>Transcript</h3>
        <span className="lab-prov measured" title={PROV.measured.title}>Measured</span>
      </header>
      {open ? (
        <div className="lab-panel-body">
          {lines.length ? (
            lines.map((l) => (
              <button key={l.t} className={"lab-tline" + (time >= l.t && time < l.t + 5 ? " on" : "")} onClick={() => seek(l.t)}>
                <span className="lab-tc">{fmtTime(l.t)}</span>
                <span>{l.text}</span>
              </button>
            ))
          ) : (
            <p className="lab-ttext">{rep.transcript}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- screen

export default function ReportScreen(props: { id: string; standalone?: boolean }) {
  const rep = useLab((s) => s.reports[props.id]);
  const err = useLab((s) => s.reportError[props.id]);
  const setView = useLab((s) => s.setView);
  useResetInspect();
  if (!rep) {
    return (
      <div className="lab-center">
        {err ? (
          <div className="lab-banner bad"><AlertTriangle size={14} /> Couldn't load this report: {err} <Button small onClick={() => setView({ kind: "start" })}>Back</Button></div>
        ) : (
          <span className="muted">Loading report…</span>
        )}
      </div>
    );
  }
  const mock = rep.engine.mock || rep.tribe?.mock;
  return (
    <div className="lab-report">
      <ReportHeader rep={rep} />
      {mock ? (
        <div className="lab-banner warn">
          <AlertTriangle size={14} /> <strong>Synthetic test data, not real TRIBE predictions.</strong> The TRIBE v2 worker ran in mock mode, so the brain response, neural score and anything derived from them are placeholders.
        </div>
      ) : null}
      <div className="lab-report-scroll">
        <div className="lab-grid-top">
          <ScoreHero rep={rep} />
          <Player rep={rep} />
          <Inspector rep={rep} />
        </div>
        <Panel title="Second by second" prov={rep.tribe ? ["measured", "estimated", "tribe"] : ["measured", "estimated"]} right={<RibbonLegend rep={rep} />} className="lab-ribbon-panel">
          <Ribbon rep={rep} />
        </Panel>
        <div className="lab-grid-main">
          <div className="lab-col">
            <Retention rep={rep} />
            <BrainPanel rep={rep} />
            <Suggestions rep={rep} standalone={props.standalone} />
            <Transcript rep={rep} />
          </div>
          <div className="lab-col">
            <Platforms rep={rep} />
            <Moments rep={rep} />
            <Coaching rep={rep} />
          </div>
        </div>
      </div>
    </div>
  );
}
