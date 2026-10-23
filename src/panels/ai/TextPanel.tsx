// Text panel (Premiere 24+): Transcript (text-based editing) | Captions | Graphics.
import { useEffect, useMemo, useRef, useState } from "react";
import { Captions as CaptionsIcon, FileDown, Languages, Merge, Scissors, Search, Trash, Mic, ChevronUp, ChevronDown } from "lucide-react";
import type { Clip, ID, MediaAsset, TranscriptWord } from "@shared/types";
import { clipEnd, getTrack, tracksOfKind, clipsOnTrack } from "@shared/ops";
import { formatTimecode } from "@shared/time";
import { useEditor, useActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { seekProgram, seekSource } from "../../engine";
import { Button, Empty, HotNumber, IconButton, Progress, Select, Tabs } from "../../ui/kit";
import { captionsToSrt, findFillers, flattenWords, sequenceWords, sourceRangeToSequence, mergeRanges, normWord, type Range } from "../../../server/ai/editOps";
import { deleteSequenceRanges, generateCaptions, transcribeAsset, transcriptOf, withTranscripts } from "./localOps";
import "./ai.css";

type Tab = "transcript" | "captions" | "graphics";
const ed = () => useEditor.getState();

export default function TextPanel() {
  const [tab, setTab] = useState<Tab>("transcript");
  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<Tab>).detail);
    window.addEventListener("editcut:text-tab", on);
    return () => window.removeEventListener("editcut:text-tab", on);
  }, []);
  return (
    <div className="tp">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "transcript", label: "Transcript" }, { value: "captions", label: "Captions" }, { value: "graphics", label: "Graphics" }]} />
      {tab === "transcript" ? <TranscriptTab /> : tab === "captions" ? <CaptionsTab /> : <GraphicsTab />}
    </div>
  );
}

// ---------------------------------------------------------------- transcript

interface W extends TranscriptWord { i: number; assetId: ID; used: boolean }
interface Para { start: number; label: string; words: W[] }

function TranscriptTab() {
  const project = useEditor((s) => s.project);
  const seq = useActiveSequence();
  const jobs = useEditor((s) => s.jobs);
  const [source, setSource] = useState<string>("seq");
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(-1);
  const drag = useRef(false);
  const body = useRef<HTMLDivElement>(null);

  const pv = useMemo(() => withTranscripts(project), [project]);
  const audioAssets = useMemo(() => Object.values(project.media).filter((a) => a.hasAudio && a.status !== "error"), [project.media]);
  const seqMode = source === "seq";
  const asset: MediaAsset | undefined = seqMode ? undefined : pv.media[source];
  const usedAssets = useMemo(() => (seq ? [...new Set(seq.clips.map((c) => c.assetId).filter(Boolean) as ID[])].map((id) => pv.media[id]).filter((a) => a?.hasAudio) : []), [seq, pv]);
  const missing = seqMode ? usedAssets.filter((a) => !transcriptOf(a)) : asset && !transcriptOf(asset) ? [asset] : [];

  // flat word list (sequence time in seq mode, source time in asset mode)
  const words: W[] = useMemo(() => {
    if (seqMode) {
      if (!seq) return [];
      return sequenceWords(pv, pv.sequences[seq.id] ?? seq).map((w, i) => ({ text: w.text, start: w.start, end: w.end, i, assetId: w.assetId, used: true }));
    }
    if (!asset) return [];
    const usedRanges = seq ? seq.clips.filter((c) => c.assetId === asset.id).map((c) => ({ s: c.sourceIn, e: c.sourceIn + c.duration * c.speed })) : [];
    return flattenWords({ ...asset, transcript: transcriptOf(asset) }).map((w, i) => ({ ...w, i, assetId: asset.id, used: usedRanges.some((r) => (w.start + w.end) / 2 >= r.s && (w.start + w.end) / 2 <= r.e) }));
  }, [seqMode, seq, pv, asset]);

  const paras: Para[] = useMemo(() => {
    const out: Para[] = [];
    let cur: Para | null = null;
    words.forEach((w, k) => {
      const prev = words[k - 1];
      const brk = !cur || w.assetId !== prev.assetId || w.start - prev.end > 1.2 || (cur.words.length > 45 && /[.!?]$/.test(prev.text));
      if (brk) {
        cur = { start: w.start, label: pv.media[w.assetId]?.name ?? "", words: [] };
        out.push(cur);
      }
      cur!.words.push(w);
    });
    return out;
  }, [words, pv.media]);

  const fillerSet = useMemo(() => {
    const s = new Set<number>();
    for (const h of findFillers(words)) {
      const n = h.text.split(" ").length;
      for (let k = 0; k < n; k++) s.add(h.index + k);
    }
    return s;
  }, [words]);

  const matches = useMemo(() => {
    const q = normWord(query).split(/\s+/).filter(Boolean);
    if (!q.length) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < words.length; i++) if (q.every((t, k) => normWord(words[i + k]?.text ?? "").includes(t))) out.push(i);
    return out;
  }, [query, words]);
  const matchSet = useMemo(() => {
    const n = normWord(query).split(/\s+/).filter(Boolean).length;
    const s = new Set<number>();
    for (const m of matches) for (let k = 0; k < n; k++) s.add(m + k);
    return s;
  }, [matches, query]);

  // current word under the playhead (sequence mode) / source playhead (asset mode)
  useEffect(() => {
    const find = (t: number) => {
      let lo = 0, hi = words.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (words[mid].start <= t + 1e-3) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans >= 0 && t <= words[ans].end + 0.25 ? ans : -1;
    };
    const update = () => {
      const pb = usePlayback.getState();
      const t = seqMode ? pb.time : ed().sourceAssetId === asset?.id ? pb.sourceTime : -1;
      setNow(t < 0 ? -1 : find(t));
    };
    update();
    return usePlayback.subscribe(update);
  }, [words, seqMode, asset?.id]);

  // map a word's time range to sequence ranges
  const toSeqRanges = (start: number, end: number): Range[] => {
    if (seqMode) return [{ start, end }];
    if (!seq || !asset) return [];
    return sourceRangeToSequence(seq, asset.id, start, end);
  };

  const jump = (w: W) => {
    if (seqMode) return seekProgram(w.start);
    const r = toSeqRanges(w.start, w.end);
    if (r.length) {
      seekProgram(r[0].start);
    } else if (asset) {
      ed().setUI({ sourceAssetId: asset.id, focusedMonitor: "source" });
      seekSource(w.start);
    }
  };

  const selRange = sel ? [Math.min(sel[0], sel[1]), Math.max(sel[0], sel[1])] : null;
  const deleteSelection = () => {
    if (!selRange || !seq) return;
    const first = words[selRange[0]], last = words[selRange[1]], next = words[selRange[1] + 1];
    const end = next && next.start - last.end < 0.4 && next.assetId === last.assetId ? next.start - 0.01 : last.end + 0.05;
    const ranges = toSeqRanges(first.start, end);
    if (!ranges.length) return void ed().toast("Those words aren't used in the active sequence", "error");
    const removed = deleteSequenceRanges(ranges, `Delete "${words.slice(selRange[0], selRange[1] + 1).map((w) => w.text).join(" ").slice(0, 30)}"`);
    ed().toast(`Removed ${removed.toFixed(2)}s`, "success");
    setSel(null);
  };

  const removeFillers = () => {
    const hits = findFillers(words);
    const ranges = mergeRanges(hits.flatMap((h) => toSeqRanges(h.start, h.end)));
    if (!ranges.length) return void ed().toast("No filler words in the sequence", "info");
    deleteSequenceRanges(ranges, "Remove Filler Words");
    ed().toast(`Removed ${hits.length} filler words`, "success");
  };

  const transcribe = async () => {
    setBusy(true);
    try {
      for (const a of missing) await transcribeAsset(a.id);
    } catch (e) {
      ed().toast(`Transcription failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const gotoMatch = (dir: 1 | -1) => {
    if (!matches.length) return;
    const k = (matchIdx + dir + matches.length) % matches.length;
    setMatchIdx(k);
    const w = words[matches[k]];
    jump(w);
    body.current?.querySelector(`[data-i="${w.i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const progress = Object.entries(jobs).find(([k]) => k.startsWith("transcribe:"))?.[1];
  const fps = seq?.settings.fps ?? 30;

  return (
    <>
      <div className="tp-toolbar">
        <Select
          value={source}
          onChange={(v) => { setSource(v); setSel(null); }}
          style={{ maxWidth: 190 }}
          options={[{ value: "seq", label: seq ? `Sequence: ${seq.name}` : "Sequence (none open)" }, ...audioAssets.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <div className="tp-search">
          <Search size={13} className="muted" />
          <input className="text-input" placeholder="Search transcript" value={query} onChange={(e) => { setQuery(e.target.value); setMatchIdx(-1); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") gotoMatch(e.shiftKey ? -1 : 1); }} />
          {query ? <span className="muted" style={{ fontSize: 11 }}>{matches.length ? `${Math.max(1, matchIdx + 1)}/${matches.length}` : "0"}</span> : null}
          <IconButton size={20} title="Previous" onClick={() => gotoMatch(-1)}><ChevronUp size={13} /></IconButton>
          <IconButton size={20} title="Next" onClick={() => gotoMatch(1)}><ChevronDown size={13} /></IconButton>
        </div>
        {fillerSet.size ? <Button small onClick={removeFillers} title="Ripple-delete every um/uh from the sequence">Remove fillers ({findFillers(words).length})</Button> : null}
        {missing.length ? <Button small primary onClick={transcribe} disabled={busy}><Mic size={11} style={{ verticalAlign: -1 }} /> {busy ? "Transcribing…" : `Transcribe${missing.length > 1 ? ` (${missing.length})` : ""}`}</Button> : null}
      </div>
      <div
        className="tp-body"
        ref={body}
        tabIndex={0}
        onMouseUp={() => (drag.current = false)}
        onKeyDown={(e) => {
          if ((e.key === "Delete" || e.key === "Backspace") && selRange) {
            e.preventDefault();
            e.stopPropagation();
            deleteSelection();
          } else if (e.key === "Escape") setSel(null);
        }}
      >
        {!words.length ? (
          <Empty>
            {seqMode && !seq ? "Open a sequence to see its transcript." : missing.length ? (
              <div>
                <p>{seqMode ? `${missing.length} clip${missing.length > 1 ? "s" : ""} in this sequence need${missing.length > 1 ? "" : "s"} a transcript.` : `"${asset?.name}" isn't transcribed yet.`}</p>
                <Button primary onClick={transcribe} disabled={busy}>{busy ? "Transcribing…" : "Transcribe"}</Button>
              </div>
            ) : "No speech found."}
          </Empty>
        ) : (
          paras.map((p, pi) => (
            <div className="tp-para" key={pi}>
              <div className="tp-para-head">
                <span className="tc" onClick={() => jump(p.words[0])}>{formatTimecode(p.start, fps)}</span>
                <span>{p.label}</span>
              </div>
              <div className="tp-words">
                {p.words.map((w) => {
                  const inSel = selRange && w.i >= selRange[0] && w.i <= selRange[1];
                  const cls = ["tp-word", inSel && "sel", w.i === now && "now", fillerSet.has(w.i) && "filler", matchSet.has(w.i) && "match", matches[matchIdx] === w.i && "cur", !w.used && "unused"].filter(Boolean).join(" ");
                  return (
                    <span key={w.i}>
                      <span
                        data-i={w.i}
                        className={cls}
                        title={`${w.start.toFixed(2)}–${w.end.toFixed(2)}s`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          (e.currentTarget.closest(".tp-body") as HTMLElement | null)?.focus();
                          drag.current = true;
                          if (e.shiftKey && sel) setSel([sel[0], w.i]);
                          else setSel([w.i, w.i]);
                          if (!e.shiftKey) jump(w);
                        }}
                        onMouseEnter={() => drag.current && sel && setSel([sel[0], w.i])}
                      >
                        {w.text}
                      </span>{" "}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="tp-status">
        {progress ? (<><span>{progress.label}</span><Progress value={progress.progress} /></>) : selRange ? (
          <span>{selRange[1] - selRange[0] + 1} words selected — press Delete to cut them from the sequence</span>
        ) : (
          <span>{words.length ? `${words.length} words · click a word to jump · drag to select · Delete to cut` : ""}</span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- captions

function CaptionRow({ c, fps, active }: { c: Clip; fps: number; active: boolean }) {
  const [text, setText] = useState(c.caption?.text ?? "");
  useEffect(() => setText(c.caption?.text ?? ""), [c.caption?.text]);
  const commit = () => {
    if (text === c.caption?.text) return;
    ed().applySeq("Edit Caption", (s) => {
      const x = s.clips.find((k) => k.id === c.id);
      if (x?.caption) {
        x.caption.text = text;
        x.name = text.slice(0, 40);
      }
    });
  };
  const setTimes = (start: number, end: number) =>
    ed().applySeq("Caption Timing", (s) => {
      const x = s.clips.find((k) => k.id === c.id);
      if (!x || end - start < 1 / fps) return;
      x.start = Math.max(0, start);
      x.duration = end - x.start;
    });
  const split = () =>
    ed().applySeq("Split Caption", (s) => {
      const x = s.clips.find((k) => k.id === c.id);
      if (!x?.caption) return;
      const words = x.caption.text.replace(/\n/g, " ").split(/\s+/).filter(Boolean);
      if (words.length < 2) return;
      const k = Math.ceil(words.length / 2);
      const mid = x.start + x.duration * (words.slice(0, k).join(" ").length / words.join(" ").length);
      const right: Clip = JSON.parse(JSON.stringify(x));
      right.id = "clp_" + Math.random().toString(36).slice(2, 14);
      right.start = mid;
      right.duration = clipEnd(x) - mid;
      right.caption = { text: words.slice(k).join(" ") };
      right.name = right.caption.text.slice(0, 40);
      x.duration = mid - x.start;
      x.caption.text = words.slice(0, k).join(" ");
      x.name = x.caption.text.slice(0, 40);
      s.clips.push(right);
    });
  const mergeNext = () =>
    ed().applySeq("Merge Captions", (s) => {
      const x = s.clips.find((k) => k.id === c.id);
      if (!x?.caption) return;
      const next = clipsOnTrack(s, x.trackId).find((k) => k.start >= clipEnd(x) - 1e-6 && k.id !== x.id);
      if (!next?.caption) return;
      x.caption.text = `${x.caption.text} ${next.caption.text}`.replace(/\s+/g, " ").trim();
      x.duration = clipEnd(next) - x.start;
      x.name = x.caption.text.slice(0, 40);
      s.clips = s.clips.filter((k) => k.id !== next.id);
    });
  const del = () => ed().applySeq("Delete Caption", (s) => void (s.clips = s.clips.filter((k) => k.id !== c.id)));
  const tc = (t: number) => formatTimecode(t, fps);
  return (
    <div className={"tp-cap" + (active ? " active" : "")}>
      <div className="tp-cap-times" title="Drag to adjust; click the row's text to edit">
        <span onClick={() => seekProgram(c.start)}><HotNumber value={c.start} step={1 / fps} format={tc} onChange={() => undefined} onCommit={(v) => setTimes(v, clipEnd(c))} /></span>
        <span className="muted">→</span>
        <span><HotNumber value={clipEnd(c)} step={1 / fps} format={tc} onChange={() => undefined} onCommit={(v) => setTimes(c.start, v)} /></span>
      </div>
      <textarea className="text-input" value={text} rows={Math.max(1, text.split("\n").length)} onChange={(e) => setText(e.target.value)} onBlur={commit} onFocus={() => seekProgram(c.start + 0.01)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); }} />
      <div className="tp-cap-actions">
        <IconButton size={20} title="Split caption" onClick={split}><Scissors size={12} /></IconButton>
        <IconButton size={20} title="Merge with next" onClick={mergeNext}><Merge size={12} /></IconButton>
        <IconButton size={20} title="Delete caption" onClick={del}><Trash size={12} /></IconButton>
      </div>
    </div>
  );
}

function CaptionsTab() {
  const seq = useActiveSequence();
  const [maxChars, setMaxChars] = useState(42);
  const [lines, setLines] = useState<"1" | "2">("2");
  const [minDur, setMinDur] = useState(0.8);
  const [gap, setGap] = useState(2);
  const [style, setStyle] = useState<"standard" | "social">("standard");
  const [busy, setBusy] = useState(false);
  const time = usePlayback((s) => Math.round(s.time * 20) / 20);
  if (!seq) return <Empty>Open a sequence to work with captions.</Empty>;
  const track = tracksOfKind(seq, "caption")[0];
  const caps = track ? clipsOnTrack(seq, track.id).filter((c) => c.caption) : [];
  const create = async () => {
    setBusy(true);
    await generateCaptions({ maxCharsPerLine: maxChars, lines: lines === "1" ? 1 : 2, minDuration: minDur, gapFrames: gap, style });
    setBusy(false);
  };
  const exportSrt = () => {
    const blob = new Blob([captionsToSrt(caps)], { type: "application/x-subrip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${seq.name}.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const num = (v: number, set: (n: number) => void, step = 1) => (
    <input className="text-input" type="number" step={step} value={v} onChange={(e) => set(Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} />
  );
  return (
    <>
      <div className="tp-cap-form">
        <span className="tp-field"><label>Max chars/line</label>{num(maxChars, setMaxChars)}</span>
        <span className="tp-field"><label>Lines</label><Select value={lines} options={["1", "2"]} onChange={setLines} /></span>
        <span className="tp-field"><label>Min duration</label>{num(minDur, setMinDur, 0.1)}</span>
        <span className="tp-field"><label>Gap frames</label>{num(gap, setGap)}</span>
        <span className="tp-field"><label>Style</label><Select value={style} options={[{ value: "standard", label: "Standard subtitles" }, { value: "social", label: "Social (bold words)" }]} onChange={setStyle} /></span>
        <Button small primary onClick={create} disabled={busy}><CaptionsIcon size={11} style={{ verticalAlign: -1 }} /> {busy ? "Working…" : caps.length && style === "standard" ? "Re-create captions" : "Create captions"}</Button>
      </div>
      <div className="tp-body">
        {caps.length ? caps.map((c) => <CaptionRow key={c.id} c={c} fps={seq.settings.fps} active={time >= c.start && time < clipEnd(c)} />) : <Empty>No captions yet. Create them from the transcript above{style === "social" ? " — social captions appear in the Graphics tab" : ""}.</Empty>}
      </div>
      <div className="tp-status">
        <span>{caps.length} captions</span>
        <span className="spacer" />
        <Button small onClick={() => ed().openDialog("captionsTranslate")} disabled={!caps.length}><Languages size={11} style={{ verticalAlign: -1 }} /> Translate</Button>
        <Button small onClick={exportSrt} disabled={!caps.length}><FileDown size={11} style={{ verticalAlign: -1 }} /> Export SRT</Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- graphics

function GraphicsTab() {
  const seq = useActiveSequence();
  const selected = useEditor((s) => s.selection.clipIds);
  if (!seq) return <Empty>Open a sequence.</Empty>;
  const gfx = seq.clips.filter((c) => c.generator?.kind === "text").sort((a, b) => a.start - b.start);
  if (!gfx.length) return <Empty>No text graphics in this sequence. Use the Type tool, Graphics &gt; New Text, or ask Claude to add a title.</Empty>;
  return (
    <div className="tp-body">
      {gfx.map((c) => (
        <div
          key={c.id}
          className="tp-gfx"
          style={selected.includes(c.id) ? { background: "var(--accent-bg)" } : undefined}
          onClick={() => {
            seekProgram(c.start + 0.01);
            ed().select({ clipIds: [c.id] });
          }}
        >
          <span className="tc">{formatTimecode(c.start, seq.settings.fps)}</span>
          <span className="txt">{c.generator?.kind === "text" ? c.generator.style.text.replace(/\n/g, " / ") : c.name}</span>
          <span className="trk">{getTrack(seq, c.trackId)?.name}</span>
        </div>
      ))}
    </div>
  );
}
