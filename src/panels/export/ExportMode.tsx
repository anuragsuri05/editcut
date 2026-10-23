// Premiere-style Export mode: Destinations (left) · Settings (center) · Preview + summary (right).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Film, PlaySquare, AtSign, Music2, Layers, Send, Download, Link2, Link2Off } from "lucide-react";
import type { ExportFormat, ExportJob, ExportSettings, Sequence } from "@shared/types";
import { EXPORT_FORMATS, EXPORT_PRESETS, PRESET_MAP, applyPreset, estimateSizeBytes, exportRangeOf, formatBytes, formatInfo } from "@shared/exportPresets";
import { formatTimecode } from "@shared/time";
import { sequenceDuration } from "@shared/ops";
import { useEditor } from "../../store/store";
import { Button, Checkbox, HotNumber, Section, Slider, TextInput, Progress } from "../../ui/kit";
import { renderSequenceFrame } from "../../engine";
import { defaultDirectory, settingsFor, startExportSync, submitExport, useExportJobs, useExportUI, type CustomRange } from "./exportClient";
import { JobList, JobRow } from "./ExportQueuePanel";
import "./export.css";

type DestId = "media" | "youtube" | "vimeo" | "tiktok" | "x" | "behance" | "queue";
const DESTS: { id: DestId; label: string; preset?: string; icon: ReactNode }[] = [
  { id: "media", label: "Media File", icon: <Film size={15} /> },
  { id: "youtube", label: "YouTube", preset: "youtube-1080", icon: <PlaySquare size={15} /> },
  { id: "vimeo", label: "Vimeo", preset: "vimeo-1080", icon: <Film size={15} /> },
  { id: "tiktok", label: "TikTok", preset: "tiktok-916", icon: <Music2 size={15} /> },
  { id: "x", label: "X", preset: "twitter-720", icon: <AtSign size={15} /> },
  { id: "behance", label: "Behance", preset: "behance-1080", icon: <Layers size={15} /> },
];

const FPS_CHOICES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
const LOUDNESS_STANDARDS = [
  { id: "ebu", label: "EBU R128 (−23 LUFS)", lufs: -23, tp: -1 },
  { id: "atsc", label: "ATSC A/85 (−24 LKFS)", lufs: -24, tp: -2 },
  { id: "web", label: "Web / Podcast (−16 LUFS)", lufs: -16, tp: -1 },
  { id: "stream", label: "Streaming (−14 LUFS)", lufs: -14, tp: -1 },
  { id: "custom", label: "Custom", lufs: NaN, tp: NaN },
];

type RangeChoice = "entire" | "inOut" | "workArea" | "custom";

function Field(props: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="xm-field" title={props.hint}>
      <label>{props.label}</label>
      <div className="xm-field-ctl">{props.children}</div>
    </div>
  );
}

function Sel<T extends string | number>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <select
      className="select xm-select"
      disabled={props.disabled}
      value={String(props.value)}
      onChange={(e) => {
        const o = props.options.find((x) => String(x.value) === e.target.value);
        if (o) props.onChange(o.value);
      }}
    >
      {props.options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function ExportMode() {
  const project = useEditor((s) => s.project);
  const setUI = useEditor((s) => s.setUI);
  const toast = useEditor((s) => s.toast);
  const sequences = Object.values(project.sequences).sort((a, b) => a.createdAt - b.createdAt);
  const [seqId, setSeqId] = useState<string | null>(project.activeSequenceId ?? sequences[0]?.id ?? null);
  const seq: Sequence | null = seqId ? project.sequences[seqId] ?? null : null;
  const savedFor = useExportUI((s) => (seqId ? s.bySeq[seqId] : undefined));
  const setFor = useExportUI((s) => s.setFor);
  const defaultDir = useExportUI((s) => s.directory);
  const [dest, setDest] = useState<DestId>("media");
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>(() => (seq && (seq.inPoint !== undefined || seq.outPoint !== undefined) ? "inOut" : "entire"));
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkSize, setLinkSize] = useState(true);
  const [loudStd, setLoudStd] = useState("web");
  const [cosmetic, setCosmetic] = useState({ fieldOrder: "progressive", aspect: "1", profile: "high", level: "5.1", mux: "mp4", markers: true, previews: false, importIntoProject: false, scaling: "fit" });
  const jobs = useExportJobs((s) => s.jobs);
  const lastJob = jobs.find((j) => j.id === lastJobId) ?? null;

  useEffect(() => {
    startExportSync();
    void defaultDirectory();
  }, []);

  const settings: ExportSettings | null = useMemo(() => (seq ? savedFor ?? settingsFor(seq) : null), [seq, savedFor]);
  const update = (patch: Partial<ExportSettings>) => {
    if (!seq || !settings) return;
    setFor(seq.id, { ...settings, ...patch });
  };

  // ---------------- range / duration
  const seqDur = seq ? sequenceDuration(seq) : 0;
  const effectiveRange: [number, number] = useMemo(() => {
    if (!seq || !settings) return [0, 0];
    if (rangeChoice === "custom" && custom) return [custom.start, custom.end];
    return exportRangeOf(seq, { range: rangeChoice === "custom" ? "entire" : rangeChoice, format: settings.format });
  }, [seq, settings, rangeChoice, custom]);
  const duration = Math.max(0, effectiveRange[1] - effectiveRange[0]);

  // ---------------- preview
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewT, setPreviewT] = useState(0);
  const [previewErr, setPreviewErr] = useState(false);
  useEffect(() => {
    if (seq) setPreviewT(settings?.format === "png" ? seq.playhead : effectiveRange[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seqId, effectiveRange[0], effectiveRange[1], settings?.format]);
  const outW = settings?.width || seq?.settings.width || 1920;
  const outH = settings?.height || seq?.settings.height || 1080;
  useEffect(() => {
    if (!seq || !canvasRef.current || !seq.clips.length) return;
    let cancelled = false;
    const id = setTimeout(() => {
      renderSequenceFrame(seq, previewT, null, { width: Math.min(960, seq.settings.width), project })
        .then((frame) => {
          if (cancelled || !canvasRef.current) return;
          const c = canvasRef.current;
          const cw = 640, ch = Math.round((640 * outH) / outW);
          c.width = cw;
          c.height = ch;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, cw, ch);
          const s = Math.min(cw / frame.width, ch / frame.height);
          const dw = frame.width * s, dh = frame.height * s;
          ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
          setPreviewErr(false);
        })
        .catch(() => !cancelled && setPreviewErr(true));
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [seq, project, previewT, outW, outH]);

  if (!seq || !settings) {
    return (
      <div className="xm-root">
        <div className="panel-empty">
          No sequence to export. Create or open a sequence in Edit mode.
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setUI({ mode: "edit" })}>Back to Edit</Button>
          </div>
        </div>
      </div>
    );
  }

  const info = formatInfo(settings.format);
  const isVideo = info.video;
  const hasAudio = info.audio && settings.audioCodec !== "none";
  const matchSource = settings.width === seq.settings.width && settings.height === seq.settings.height && Math.abs(settings.fps - seq.settings.fps) < 0.01;
  const ext = info.ext;
  const dir = settings.directory || defaultDir || "~/Movies/EditCut";
  const outPath = `${dir.replace(/\/$/, "")}/${(settings.fileName || seq.name).replace(/\.[a-z0-9]+$/i, "")}.${ext}`;
  const est = estimateSizeBytes(settings, duration);
  const rateControl = isVideo && !["prores", "gif", "png"].includes(settings.format);
  const hwCapable = settings.format === "h264" || settings.format === "hevc";

  const choosePreset = (id: string) => {
    const s = applyPreset(settings, id, seq);
    setFor(seq.id, s);
  };
  const chooseFormat = (f: ExportFormat) => {
    const firstPreset = EXPORT_PRESETS.find((p) => p.settings.format === f);
    const s = firstPreset ? applyPreset(settings, firstPreset.id, seq) : { ...settings, format: f };
    setFor(seq.id, { ...s, format: f });
  };
  const chooseDest = (d: DestId) => {
    setDest(d);
    const p = DESTS.find((x) => x.id === d)?.preset;
    if (p) choosePreset(p);
  };
  const setW = (w: number) => {
    w = Math.max(16, Math.round(w));
    update(linkSize ? { width: w, height: Math.max(16, Math.round((w * settings.height) / settings.width / 2) * 2), presetId: undefined } : { width: w, presetId: undefined });
  };
  const setH = (h: number) => {
    h = Math.max(16, Math.round(h));
    update(linkSize ? { height: h, width: Math.max(16, Math.round((h * settings.width) / settings.height / 2) * 2), presetId: undefined } : { height: h, presetId: undefined });
  };

  const go = async (sendToQueue: boolean) => {
    if (!seq.clips.length) return toast("The sequence is empty", "error");
    if (duration <= 0) return toast("The export range is empty", "error");
    setBusy(true);
    try {
      const s: ExportSettings = { ...settings, directory: settings.directory || defaultDir || undefined, range: rangeChoice === "custom" ? "inOut" : rangeChoice };
      const job = await submitExport(project, seq.id, s, rangeChoice === "custom" ? custom : null);
      setLastJobId(job.id);
      toast(sendToQueue ? `Added to Media Encoder queue: ${job.outputPath.split("/").pop()}` : `Exporting to ${job.outputPath}`, "info");
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const presetGroups = [...new Set(EXPORT_PRESETS.map((p) => p.group))];
  const queueCount = jobs.filter((j) => j.status === "queued" || j.status === "rendering").length;

  return (
    <div className="xm-root">
      {/* ------------------------------------------------ destinations */}
      <aside className="xm-dest">
        <div className="xm-col-title">Destinations</div>
        {DESTS.map((d) => (
          <button key={d.id} className={"xm-dest-item" + (dest === d.id ? " active" : "")} onClick={() => chooseDest(d.id)}>
            <span className="xm-dest-icon">{d.icon}</span>
            <span className="xm-dest-label">{d.label}</span>
            <span className={"xm-toggle" + (dest === d.id ? " on" : "")} />
          </button>
        ))}
        <div className="xm-dest-sep" />
        <button className={"xm-dest-item" + (dest === "queue" ? " active" : "")} onClick={() => setDest("queue")}>
          <span className="xm-dest-icon">
            <Send size={15} />
          </span>
          <span className="xm-dest-label">Media Encoder</span>
          {queueCount ? <span className="xm-badge">{queueCount}</span> : null}
        </button>
        <div className="xm-dest-note">Platform destinations choose a matching preset; files are saved locally for upload.</div>
      </aside>

      {/* ------------------------------------------------ settings */}
      <section className="xm-settings">
        {dest === "queue" ? (
          <>
            <div className="xm-col-title">Media Encoder Queue</div>
            <JobList jobs={[...jobs].reverse()} empty="The queue is empty. Use “Send to Media Encoder” to add exports." />
          </>
        ) : (
          <>
            <div className="xm-col-title">
              Settings
              <span className="muted xm-seqname">
                <Sel value={seq.id} options={sequences.map((s) => ({ value: s.id, label: s.name }))} onChange={(id) => setSeqId(id)} />
              </span>
            </div>
            <div className="xm-top">
              <Field label="File Name">
                <TextInput value={settings.fileName} onChange={(v) => update({ fileName: v })} style={{ flex: 1 }} />
                <span className="xm-ext">.{ext}</span>
              </Field>
              <Field label="Location" hint="Folder on this computer (created if missing)">
                <TextInput value={settings.directory ?? ""} placeholder={defaultDir ?? "~/Movies/EditCut"} onChange={(v) => update({ directory: v || undefined })} style={{ flex: 1 }} />
              </Field>
              <Field label="Preset">
                <select className="select xm-select" value={settings.presetId && PRESET_MAP[settings.presetId] ? settings.presetId : ""} onChange={(e) => e.target.value && choosePreset(e.target.value)}>
                  <option value="">Custom</option>
                  {presetGroups.map((g) => (
                    <optgroup key={g} label={g}>
                      {EXPORT_PRESETS.filter((p) => p.group === g).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Format">
                <Sel value={settings.format} options={EXPORT_FORMATS.map((f) => ({ value: f.value, label: f.label }))} onChange={chooseFormat} />
              </Field>
              {settings.presetId && PRESET_MAP[settings.presetId] ? <div className="xm-preset-desc">{PRESET_MAP[settings.presetId].description}</div> : null}
            </div>

            <div className="xm-sections">
              {isVideo ? (
                <Section title="Video" defaultOpen>
                  <Field label="Match Source">
                    <Checkbox checked={matchSource} onChange={(v) => v && update({ width: seq.settings.width, height: seq.settings.height, fps: seq.settings.fps, presetId: undefined })} label={<span className="muted">{seq.settings.width}×{seq.settings.height}, {seq.settings.fps} fps</span>} />
                  </Field>
                  <Field label="Frame Size">
                    <HotNumber value={settings.width} min={16} max={8192} step={2} onChange={setW} width={60} />
                    <button className={"xm-link" + (linkSize ? " on" : "")} title={linkSize ? "Unlink width and height" : "Link width and height"} onClick={() => setLinkSize(!linkSize)}>
                      {linkSize ? <Link2 size={13} /> : <Link2Off size={13} />}
                    </button>
                    <HotNumber value={settings.height} min={16} max={8192} step={2} onChange={setH} width={60} />
                  </Field>
                  {settings.format !== "png" ? (
                    <Field label="Frame Rate">
                      <Sel value={settings.fps} options={[...new Set([...FPS_CHOICES, seq.settings.fps])].sort((a, b) => a - b).map((f) => ({ value: f, label: `${f} fps` }))} onChange={(fps) => update({ fps, presetId: undefined })} />
                    </Field>
                  ) : null}
                  <Field label="Field Order">
                    <Sel value={cosmetic.fieldOrder} options={[{ value: "progressive", label: "Progressive" }, { value: "upper", label: "Upper First" }, { value: "lower", label: "Lower First" }]} onChange={(v) => setCosmetic({ ...cosmetic, fieldOrder: v })} />
                  </Field>
                  <Field label="Aspect">
                    <Sel value={cosmetic.aspect} options={[{ value: "1", label: "Square Pixels (1.0)" }, { value: "1.333", label: "HD Anamorphic 1080 (1.333)" }, { value: "2", label: "Anamorphic 2:1 (2.0)" }]} onChange={(v) => setCosmetic({ ...cosmetic, aspect: v })} />
                  </Field>
                  {settings.format === "h264" || settings.format === "hevc" ? (
                    <>
                      <Field label="Profile">
                        <Sel value={cosmetic.profile} options={settings.format === "h264" ? [{ value: "high", label: "High" }, { value: "main", label: "Main" }, { value: "baseline", label: "Baseline" }] : [{ value: "high", label: "Main" }, { value: "main10", label: "Main10" }]} onChange={(v) => setCosmetic({ ...cosmetic, profile: v })} />
                      </Field>
                      <Field label="Level">
                        <Sel value={cosmetic.level} options={["4.0", "4.1", "4.2", "5.0", "5.1", "5.2"].map((l) => ({ value: l, label: l }))} onChange={(v) => setCosmetic({ ...cosmetic, level: v })} />
                      </Field>
                    </>
                  ) : null}
                  {settings.format === "prores" ? (
                    <Field label="Video Codec">
                      <Sel
                        value={settings.proresProfile ?? "hq"}
                        options={[
                          { value: "proxy", label: "Apple ProRes 422 Proxy" },
                          { value: "lt", label: "Apple ProRes 422 LT" },
                          { value: "standard", label: "Apple ProRes 422" },
                          { value: "hq", label: "Apple ProRes 422 HQ" },
                          { value: "4444", label: "Apple ProRes 4444 (alpha)" },
                        ]}
                        onChange={(v) => update({ proresProfile: v, presetId: undefined })}
                      />
                    </Field>
                  ) : null}
                  {hwCapable ? (
                    <Field label="Performance" hint="VideoToolbox hardware encoding (falls back to software if unavailable)">
                      <Sel value={settings.hardwareEncoding ? "hw" : "sw"} options={[{ value: "hw", label: "Hardware Encoding" }, { value: "sw", label: "Software Encoding" }]} onChange={(v) => update({ hardwareEncoding: v === "hw", bitrateMode: v === "hw" && settings.bitrateMode === "vbr2" ? "vbr1" : settings.bitrateMode })} />
                    </Field>
                  ) : null}
                  {rateControl ? (
                    <>
                      <Field label="Bitrate Encoding">
                        <Sel
                          value={settings.bitrateMode}
                          options={[
                            { value: "cbr", label: "CBR" },
                            { value: "vbr1", label: "VBR, 1 pass" },
                            ...(settings.hardwareEncoding && hwCapable ? [] : [{ value: "vbr2" as const, label: "VBR, 2 pass" }]),
                            { value: "crf", label: "Constant Quality" },
                          ]}
                          onChange={(v) => update({ bitrateMode: v, presetId: undefined })}
                        />
                      </Field>
                      {settings.bitrateMode === "crf" ? (
                        <Field label="Quality (CRF)" hint="Lower = better quality, bigger file">
                          <Slider value={settings.crf ?? 20} min={0} max={51} step={1} onChange={(v) => update({ crf: Math.round(v), presetId: undefined })} />
                          <HotNumber value={settings.crf ?? 20} min={0} max={51} step={1} onChange={(v) => update({ crf: Math.round(v) })} width={36} />
                        </Field>
                      ) : (
                        <Field label="Target Bitrate">
                          <Slider value={settings.videoBitrateMbps} min={1} max={100} step={0.5} onChange={(v) => update({ videoBitrateMbps: v, presetId: undefined })} />
                          <HotNumber value={settings.videoBitrateMbps} min={0.5} max={400} step={0.5} decimals={1} unit="Mbps" onChange={(v) => update({ videoBitrateMbps: v })} width={44} />
                        </Field>
                      )}
                    </>
                  ) : null}
                </Section>
              ) : null}

              {info.audio ? (
                <Section title="Audio" defaultOpen>
                  <Field label="Audio Codec">
                    <Sel
                      value={settings.audioCodec}
                      options={
                        settings.format === "wav"
                          ? [{ value: "pcm" as const, label: "Uncompressed (PCM)" }]
                          : settings.format === "mp3"
                            ? [{ value: "mp3" as const, label: "MPEG Layer 3" }]
                            : settings.format === "aac"
                              ? [{ value: "aac" as const, label: "AAC" }]
                              : settings.format === "prores"
                                ? [{ value: "pcm" as const, label: "Uncompressed (PCM)" }, { value: "aac" as const, label: "AAC" }, { value: "none" as const, label: "None" }]
                                : [{ value: "aac" as const, label: settings.format === "vp9" ? "Opus" : "AAC" }, { value: "none" as const, label: "None" }]
                      }
                      onChange={(v) => update({ audioCodec: v })}
                    />
                  </Field>
                  {hasAudio ? (
                    <>
                      <Field label="Sample Rate">
                        <Sel value={settings.audioSampleRate} options={[32000, 44100, 48000, 96000].map((r) => ({ value: r, label: `${r} Hz` }))} onChange={(v) => update({ audioSampleRate: v })} />
                      </Field>
                      <Field label="Channels">
                        <Sel value={settings.audioChannels} options={[{ value: 1 as const, label: "Mono" }, { value: 2 as const, label: "Stereo" }]} onChange={(v) => update({ audioChannels: v })} />
                      </Field>
                      {settings.audioCodec !== "pcm" ? (
                        <Field label="Bitrate">
                          <Sel value={settings.audioBitrateKbps} options={[96, 128, 160, 192, 256, 320].map((b) => ({ value: b, label: `${b} kbps` }))} onChange={(v) => update({ audioBitrateKbps: v })} />
                        </Field>
                      ) : null}
                    </>
                  ) : null}
                </Section>
              ) : null}

              {["h264", "hevc", "av1"].includes(settings.format) ? (
                <Section title="Multiplexer" defaultOpen={false}>
                  <Field label="Multiplexing">
                    <Sel value={cosmetic.mux} options={[{ value: "mp4", label: "MP4" }]} onChange={(v) => setCosmetic({ ...cosmetic, mux: v })} />
                  </Field>
                  <Field label="Fast Start">
                    <Checkbox checked disabled onChange={() => {}} label={<span className="muted">moov atom at start (web streaming)</span>} />
                  </Field>
                </Section>
              ) : null}

              <Section title="Captions" defaultOpen={false}>
                <Field label="Export Options">
                  <Sel
                    value={settings.burnCaptions ? "burn" : settings.exportCaptionsSidecar !== "none" ? "sidecar" : "none"}
                    options={[{ value: "none", label: "None" }, ...(isVideo ? [{ value: "burn", label: "Burn Captions Into Video" }] : []), { value: "sidecar", label: "Create Sidecar File" }]}
                    onChange={(v) => update({ burnCaptions: v === "burn", exportCaptionsSidecar: v === "sidecar" ? (settings.exportCaptionsSidecar === "none" ? "srt" : settings.exportCaptionsSidecar) : "none" })}
                  />
                </Field>
                {settings.exportCaptionsSidecar !== "none" ? (
                  <Field label="File Format">
                    <Sel value={settings.exportCaptionsSidecar} options={[{ value: "srt" as const, label: "SubRip Subtitle (.srt)" }, { value: "vtt" as const, label: "WebVTT (.vtt)" }]} onChange={(v) => update({ exportCaptionsSidecar: v })} />
                  </Field>
                ) : null}
              </Section>

              {info.audio ? (
                <Section title="Effects" defaultOpen={!!settings.loudnessNormalize?.enabled}>
                  <Field label="Loudness Normalization">
                    <Checkbox
                      checked={!!settings.loudnessNormalize?.enabled}
                      onChange={(v) => update({ loudnessNormalize: { targetLufs: settings.loudnessNormalize?.targetLufs ?? -16, truePeak: settings.loudnessNormalize?.truePeak ?? -1, enabled: v } })}
                      label={<span className="muted">two-pass, ITU BS.1770</span>}
                    />
                  </Field>
                  {settings.loudnessNormalize?.enabled ? (
                    <>
                      <Field label="Loudness Standard">
                        <Sel
                          value={loudStd}
                          options={LOUDNESS_STANDARDS.map((s) => ({ value: s.id, label: s.label }))}
                          onChange={(id) => {
                            setLoudStd(id);
                            const st = LOUDNESS_STANDARDS.find((s) => s.id === id)!;
                            if (Number.isFinite(st.lufs)) update({ loudnessNormalize: { enabled: true, targetLufs: st.lufs, truePeak: st.tp } });
                          }}
                        />
                      </Field>
                      <Field label="Target Loudness">
                        <HotNumber value={settings.loudnessNormalize.targetLufs} min={-40} max={-5} step={0.5} decimals={1} unit="LUFS" onChange={(v) => (setLoudStd("custom"), update({ loudnessNormalize: { ...settings.loudnessNormalize!, targetLufs: v } }))} />
                      </Field>
                      <Field label="Max True Peak">
                        <HotNumber value={settings.loudnessNormalize.truePeak} min={-9} max={0} step={0.1} decimals={1} unit="dBTP" onChange={(v) => (setLoudStd("custom"), update({ loudnessNormalize: { ...settings.loudnessNormalize!, truePeak: v } }))} />
                      </Field>
                    </>
                  ) : null}
                </Section>
              ) : null}

              <Section title="Metadata" defaultOpen={false}>
                <Field label="Include Markers">
                  <Checkbox checked={cosmetic.markers} onChange={(v) => setCosmetic({ ...cosmetic, markers: v })} />
                </Field>
                <div className="xm-note">Title and encoder tags are embedded in the output.</div>
              </Section>

              <Section title="General" defaultOpen={false}>
                <Field label="Use Previews">
                  <Checkbox checked={cosmetic.previews} onChange={(v) => setCosmetic({ ...cosmetic, previews: v })} label={<span className="muted">every frame is re-rendered at full quality</span>} />
                </Field>
                <Field label="Use Maximum Render Quality">
                  <Checkbox checked={settings.useMaxRenderQuality} onChange={(v) => update({ useMaxRenderQuality: v })} label={<span className="muted">Lanczos scaling, slower presets</span>} />
                </Field>
              </Section>
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------ preview / summary */}
      <aside className="xm-preview">
        <div className="xm-col-title">Preview</div>
        <div className="xm-canvas-wrap" style={{ aspectRatio: `${outW} / ${outH}` }}>
          {seq.clips.length && !previewErr ? <canvas ref={canvasRef} className="xm-canvas" /> : <div className="xm-canvas-empty">{seq.clips.length ? "Preview unavailable" : "Empty sequence"}</div>}
        </div>
        {settings.format !== "png" ? (
          <div className="xm-scrub">
            <Slider value={previewT} min={effectiveRange[0]} max={Math.max(effectiveRange[0] + 0.001, effectiveRange[1] - 1 / seq.settings.fps)} step={1 / seq.settings.fps} onChange={setPreviewT} />
            <span className="xm-tc">{formatTimecode(previewT, seq.settings.fps)}</span>
          </div>
        ) : (
          <div className="xm-note">PNG exports the frame under the playhead ({formatTimecode(seq.playhead, seq.settings.fps)}).</div>
        )}
        <div className="xm-prev-controls">
          <Field label="Range">
            <Sel
              value={rangeChoice}
              options={[
                { value: "entire", label: "Entire Source" },
                { value: "inOut", label: "Source In/Out" },
                { value: "workArea", label: "Work Area" },
                { value: "custom", label: "Custom" },
              ]}
              onChange={(v) => {
                setRangeChoice(v);
                if (v === "custom" && !custom) setCustom({ start: 0, end: seqDur });
              }}
            />
          </Field>
          {rangeChoice === "custom" && custom ? (
            <Field label="In / Out">
              <HotNumber value={custom.start} min={0} max={custom.end - 0.04} step={1 / seq.settings.fps} format={(v) => formatTimecode(v, seq.settings.fps)} onChange={(v) => setCustom({ ...custom, start: v })} width={80} />
              <HotNumber value={custom.end} min={custom.start + 0.04} max={seqDur} step={1 / seq.settings.fps} format={(v) => formatTimecode(v, seq.settings.fps)} onChange={(v) => setCustom({ ...custom, end: v })} width={80} />
            </Field>
          ) : null}
          {isVideo ? (
            <Field label="Scaling">
              <Sel value={cosmetic.scaling} options={[{ value: "fit", label: "Scale To Fit" }]} onChange={(v) => setCosmetic({ ...cosmetic, scaling: v })} />
            </Field>
          ) : null}
        </div>

        <div className="xm-summary">
          <div className="xm-sum-title">Summary</div>
          <div className="xm-sum-row">
            <span>Output</span>
            <span className="xm-sum-path" title={outPath}>
              {outPath}
            </span>
          </div>
          {isVideo ? (
            <div className="xm-sum-row">
              <span>Video</span>
              <span>
                {formatInfo(settings.format).label}, {settings.width}×{settings.height}
                {settings.format !== "png" ? `, ${settings.fps} fps` : ""}
                {rateControl ? (settings.bitrateMode === "crf" ? `, CRF ${settings.crf ?? 20}` : `, ${settings.bitrateMode.toUpperCase()} ${settings.videoBitrateMbps} Mbps`) : settings.format === "prores" ? `, ${settings.proresProfile ?? "hq"}` : ""}
                {settings.hardwareEncoding && hwCapable ? ", hardware" : ""}
              </span>
            </div>
          ) : null}
          {info.audio ? (
            <div className="xm-sum-row">
              <span>Audio</span>
              <span>{hasAudio ? `${settings.audioCodec.toUpperCase()}, ${settings.audioSampleRate / 1000} kHz, ${settings.audioChannels === 1 ? "Mono" : "Stereo"}${settings.audioCodec !== "pcm" ? `, ${settings.audioBitrateKbps} kbps` : ""}${settings.loudnessNormalize?.enabled ? `, ${settings.loudnessNormalize.targetLufs} LUFS` : ""}` : "None"}</span>
            </div>
          ) : null}
          <div className="xm-sum-row">
            <span>Duration</span>
            <span>
              {formatTimecode(duration, seq.settings.fps)} ({formatTimecode(effectiveRange[0], seq.settings.fps)} – {formatTimecode(effectiveRange[1], seq.settings.fps)})
            </span>
          </div>
          <div className="xm-sum-row xm-size">
            <span>Estimated File Size</span>
            <span>{formatBytes(est)}</span>
          </div>
        </div>

        {lastJob ? <ActiveJob job={lastJob} /> : null}

        <div className="xm-actions">
          <Button onClick={() => void go(true)} disabled={busy || !seq.clips.length}>
            <Send size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            Send to Media Encoder
          </Button>
          <Button primary onClick={() => void go(false)} disabled={busy || !seq.clips.length}>
            <Download size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            Export
          </Button>
        </div>
      </aside>
    </div>
  );
}

function ActiveJob({ job }: { job: ExportJob }) {
  return (
    <div className="xm-active">
      <JobRow job={job} />
      {job.status === "rendering" ? <Progress value={job.progress} /> : null}
    </div>
  );
}
