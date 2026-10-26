// Content Lab start screen: drop zone, analysis options, engine status, history.
import { useEffect, useRef, useState } from "react";
import { Brain, Clapperboard, Film, Link2, MessageSquareText, Plug, Sparkles, Trash2, Upload, FileVideo, AlertTriangle, Captions } from "lucide-react";
import { PLATFORMS } from "@shared/predict";
import { api } from "../../api";
import { useEditor } from "../../store/store";
import { Button, Checkbox, IconButton, showContextMenu } from "../../ui/kit";
import { activeSequence, analyzeActiveSequence, analyzeFile, analyzeSelectedAsset, selectedAsset } from "./analyze";
import { FIXTURE, useLab } from "./labStore";
import { PLATFORM_COLOR, band, fmtDate, fmtDuration, platformName } from "./format";

export function TribePopover(props: { onClose: () => void }) {
  const status = useLab((s) => s.status);
  const [url, setUrl] = useState(status?.tribe.url ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [props]);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const st = FIXTURE ? useLab.getState().status! : await api.savePredictSettings({ tribeUrl: url.trim(), tribeToken: token || undefined });
      useLab.setState({ status: st, statusError: null });
      if (st.tribe.reachable) props.onClose();
      else setErr(st.tribe.error ?? "Saved, but the worker did not respond.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const t = status?.tribe;
  return (
    <div className="lab-popover" ref={ref} onKeyDown={(e) => e.stopPropagation()}>
      <div className="lab-pop-title"><Brain size={14} /> Connect TRIBE v2</div>
      <p className="lab-pop-text">
        TRIBE v2 runs in a separate Python worker (see <code>tribe-worker/</code>), ideally on a machine with a GPU. Point EditCut at its URL.
      </p>
      <label className="lab-field">
        <span>Worker URL</span>
        <input className="text-input" value={url} placeholder="http://localhost:8765" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} autoFocus />
      </label>
      <label className="lab-field">
        <span>Access token</span>
        <input className="text-input" type="password" value={token} placeholder={t?.configured ? "unchanged" : "optional"} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
      </label>
      {t?.reachable ? (
        <div className="lab-pop-status ok">
          Connected · {t.model ?? "facebook/tribev2"} on {t.device ?? "?"}
          {t.modalities?.length ? ` · ${t.modalities.join(", ")}` : ""}
          {t.mock ? <span className="lab-chip warn">MOCK</span> : null}
        </div>
      ) : t?.configured ? (
        <div className="lab-pop-status bad">Not reachable{t.error ? `: ${t.error}` : ""}</div>
      ) : null}
      {err ? <div className="lab-pop-status bad">{err}</div> : null}
      <div className="lab-pop-actions">
        <Button small onClick={props.onClose}>Cancel</Button>
        <Button small primary onClick={() => void save()} disabled={busy || !url.trim()}>{busy ? "Connecting…" : "Save & test"}</Button>
      </div>
    </div>
  );
}

function EngineStatus() {
  const status = useLab((s) => s.status);
  const statusError = useLab((s) => s.statusError);
  const [pop, setPop] = useState(false);
  const t = status?.tribe;
  let line: React.ReactNode;
  if (statusError) line = <span className="lab-st bad">EditCut server not reachable</span>;
  else if (!status) line = <span className="lab-st">Checking…</span>;
  else if (t?.reachable)
    line = (
      <span className="lab-st ok">
        {t.model ?? "facebook/tribev2"} · {t.device ?? "?"}
        {t.mock ? <span className="lab-chip warn" title="The worker is running in --mock mode and returns synthetic data">MOCK</span> : null}
      </span>
    );
  else if (t?.configured) line = <span className="lab-st bad" title={t.error}>Worker not reachable</span>;
  else line = <span className="lab-st">Not connected</span>;
  return (
    <div className="lab-engine">
      {line}
      <span className="lab-pop-anchor">
        <button className="lab-linkbtn" onClick={() => setPop((v) => !v)}>
          <Plug size={12} /> {t?.reachable ? "Settings" : "Connect TRIBE v2"}
        </button>
        {pop ? <TribePopover onClose={() => setPop(false)} /> : null}
      </span>
    </div>
  );
}

function Options() {
  const o = useLab((s) => s.options);
  const set = useLab((s) => s.setOptions);
  const status = useLab((s) => s.status);
  const tribeOk = !!status?.tribe.reachable;
  const claudeOk = !!status?.claude;
  return (
    <div className="lab-options">
      <div className="lab-opt-group">
        <div className="lab-eyebrow">Target platforms</div>
        <div className="lab-chips">
          {PLATFORMS.map((p) => {
            const on = o.platforms.includes(p.id);
            return (
              <button
                key={p.id}
                className={"lab-pchip" + (on ? " on" : "")}
                aria-pressed={on}
                onClick={() => set({ platforms: on ? o.platforms.filter((x) => x !== p.id) : [...o.platforms, p.id] })}
              >
                <i style={{ background: PLATFORM_COLOR[p.id] }} />
                {p.name}
                <span className="lab-pchip-meta">{p.vertical ? "9:16" : "16:9"}</span>
              </button>
            );
          })}
        </div>
        {!o.platforms.length ? <div className="lab-hint">None selected: every platform will be scored.</div> : null}
      </div>

      <div className="lab-opt-group">
        <div className="lab-eyebrow">What is this video for?</div>
        <textarea
          className="text-input lab-goal"
          rows={2}
          value={o.goal}
          placeholder="e.g. Grow a productivity audience; drive follows for part two"
          onChange={(e) => set({ goal: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="lab-hint">Claude uses this to tailor the coaching.</div>
      </div>

      <div className="lab-opt-group">
        <div className="lab-eyebrow">Engines</div>
        <div className={"lab-toggle" + (tribeOk ? "" : " off")}>
          <Checkbox checked={o.useTribe && tribeOk} disabled={!tribeOk} onChange={(v) => set({ useTribe: v })} label={<span className="lab-toggle-label"><Brain size={13} /> Use TRIBE v2 brain model</span>} />
          <div className="lab-toggle-desc">
            Predicts the average viewer's cortical (fMRI) response, second by second.
            {!tribeOk ? " Unavailable until a TRIBE v2 worker is connected; the analysis then uses measurable video features only." : ""}
          </div>
          <EngineStatus />
        </div>
        <div className={"lab-toggle sub" + (tribeOk && o.useTribe ? "" : " off")}>
          <Checkbox checked={o.tribeText && o.useTribe && tribeOk} disabled={!tribeOk || !o.useTribe} onChange={(v) => set({ tribeText: v })} label={<span className="lab-toggle-label"><Captions size={13} /> Include transcript in TRIBE</span>} />
          <div className="lab-toggle-desc">Adds the language pathway. Needs gated Llama 3.2 access on the worker.</div>
        </div>
        <div className={"lab-toggle" + (claudeOk ? "" : " off")}>
          <Checkbox checked={o.useClaude && claudeOk} disabled={!claudeOk} onChange={(v) => set({ useClaude: v })} label={<span className="lab-toggle-label"><MessageSquareText size={13} /> Written coaching from Claude</span>} />
          <div className="lab-toggle-desc">
            {claudeOk ? (
              <>A short edit plan written from the numbers ({status?.claude === "claudeCode" ? "via Claude Code sign-in" : "via API key"}).</>
            ) : (
              <>
                Connect Claude to get a written edit plan.{" "}
                <button className="lab-linkbtn inline" onClick={() => useEditor.getState().openDialog("aiSettings")}><Link2 size={11} /> Open AI Settings</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function History() {
  const history = useLab((s) => s.history);
  const open = useLab((s) => s.openReport);
  const del = useLab((s) => s.deleteReport);
  if (history === null) return <div className="lab-history-empty">Loading past reports…</div>;
  if (!history.length) return <div className="lab-history-empty">Your reports will appear here. Each one keeps the video, the curves and the suggestions so you can compare versions.</div>;
  return (
    <div className="lab-history">
      {history.map((h) => {
        const b = band(h.score);
        const menu = (e: React.MouseEvent) =>
          showContextMenu(e, [
            { label: "Open report", onClick: () => void open(h.id) },
            { separator: true },
            { label: "Delete report", onClick: () => void del(h.id) },
          ]);
        return (
          <div key={h.id} className="lab-hcard" role="button" tabIndex={0} onClick={() => void open(h.id)} onKeyDown={(e) => e.key === "Enter" && void open(h.id)} onContextMenu={menu}>
            <div className="lab-hthumb" style={h.thumbUrl ? { backgroundImage: `url(${JSON.stringify(h.thumbUrl)})` } : undefined}>
              {!h.thumbUrl ? <FileVideo size={22} /> : null}
              <span className="lab-hscore" style={{ borderColor: b.color }} title={`Content score ${h.score}: ${b.label}`}>
                {h.score}
              </span>
            </div>
            <div className="lab-hmeta">
              <div className="lab-hname" title={h.fileName}>{h.fileName}</div>
              <div className="lab-hsub">
                {fmtDuration(h.durationSec)} · {fmtDate(h.createdAt)}
              </div>
              <div className="lab-hsub">
                Best on {platformName(h.bestPlatform)}
                {h.tribe === "used" ? <span className="lab-chip neural" title="TRIBE v2 brain model used">TRIBE</span> : null}
              </div>
            </div>
            <span className="lab-hdel" onClick={(e) => e.stopPropagation()}>
              <IconButton title="Delete report" onClick={() => void del(h.id)}>
                <Trash2 size={13} />
              </IconButton>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StartScreen(props: { standalone?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const status = useLab((s) => s.status);
  const statusError = useLab((s) => s.statusError);
  const seq = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId] : null));
  const selItems = useEditor((s) => s.selection.itemIds);
  void selItems;
  const asset = selectedAsset();
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/^(video|audio)\//.test(f.type) && !/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name)) {
      useEditor.getState().toast("That file doesn't look like a video", "error");
      return;
    }
    void analyzeFile(f);
  };
  const seqOk = !props.standalone && !!seq && seq.clips.length > 0;
  return (
    <div className="lab-start">
      <div className="lab-start-main">
        <div
          className={"lab-drop" + (over ? " over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        >
          <div className="lab-drop-art" aria-hidden>
            <svg width="300" height="66" viewBox="0 0 300 66">
              {Array.from({ length: 30 }, (_, i) => {
                const v = 0.5 + 0.45 * Math.sin(i * 0.55) * Math.cos(i * 0.21) + (i < 3 ? 0.3 : 0);
                const c = Math.max(0.08, Math.min(1, v));
                return <rect key={i} x={i * 10} y={66 - c * 56} width={7} height={c * 56} rx={2} fill={i < 3 ? "#5598e7" : `rgba(85,152,231,${0.18 + c * 0.45})`} />;
              })}
            </svg>
          </div>
          <Upload size={26} className="lab-drop-icon" />
          <div className="lab-drop-title">Drop a video to predict how it will perform</div>
          <div className="lab-drop-sub">Second-by-second attention, retention per platform, the strongest and weakest moments, and what to fix. MP4, MOV or WebM.</div>
          <div className="lab-drop-actions" onClick={(e) => e.stopPropagation()}>
            <Button primary onClick={() => input.current?.click()} disabled={!!statusError && !FIXTURE}>
              <span className="lab-btn-in"><Film size={13} /> Choose video…</span>
            </Button>
          </div>
          <input ref={input} type="file" accept="video/*,.mov,.mkv" hidden onChange={(e) => pick(e.target.files)} />
        </div>
        {statusError && !FIXTURE ? (
          <div className="lab-banner bad">
            <AlertTriangle size={14} /> The EditCut server isn't responding ({statusError}). Start it with <code>npm run dev</code>, then reload.
          </div>
        ) : null}
        <div className="lab-secondary">
          <Button onClick={() => void analyzeActiveSequence()} disabled={!seqOk} title={props.standalone ? "Open the full editor to analyze a sequence" : !seq ? "No active sequence" : seq.clips.length ? `Render “${seq.name}” and analyze it` : "The active sequence is empty"}>
            <span className="lab-btn-in"><Clapperboard size={13} /> Analyze active sequence{seq && !props.standalone ? <span className="lab-btn-meta">{seq.name}</span> : null}</span>
          </Button>
          <Button onClick={() => void analyzeSelectedAsset()} disabled={props.standalone || !asset} title={asset ? `Analyze “${asset.name}”` : "Select a video in the Project panel"}>
            <span className="lab-btn-in"><FileVideo size={13} /> Analyze selected clip{asset && !props.standalone ? <span className="lab-btn-meta">{asset.name}</span> : null}</span>
          </Button>
          <div className="lab-honest">
            <Sparkles size={12} /> Scores and retention curves are EditCut's estimates from your video's features{status?.tribe.reachable ? " and TRIBE v2's predicted brain response" : ""}. They are not analytics from any platform.
          </div>
        </div>
      </div>
      <aside className="lab-start-side">
        <Options />
      </aside>
      <section className="lab-start-history">
        <div className="lab-section-head">
          <h2>Past reports</h2>
        </div>
        <History />
      </section>
    </div>
  );
}
