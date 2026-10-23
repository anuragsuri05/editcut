// Info panel (Premiere: Window > Info). Shows the selected project item or
// timeline clip, then the active sequence with the playhead timecode and the
// clip under the playhead on every track.
import type { Clip, MediaAsset, Project, Sequence } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { clipAt, clipEnd, getTrack, sequenceDuration } from "@shared/ops";
import { useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { audioInfo, fmtBytes, itemInfo, ItemIcon, LabelChip, videoInfo } from "./common";

function Grid(props: { rows: [string, string | undefined | false][] }) {
  return (
    <div className="info-grid">
      {props.rows
        .filter(([, v]) => v !== undefined && v !== false && v !== "")
        .flatMap(([k, v]) => [<span key={k}>{k}</span>, <span key={k + ":v"} title={String(v)}>{v}</span>])}
    </div>
  );
}

function clipSourceLabel(p: Project, c: Clip): string {
  if (c.assetId) {
    const a = p.media[c.assetId];
    return a ? (a.kind === "image" ? "Still Image" : a.kind === "audio" ? "Audio" : a.hasAudio ? "Movie" : "Video") : "Offline";
  }
  if (c.sequenceId) return "Nested Sequence";
  if (c.caption) return "Caption";
  if (c.generator) return { text: "Graphic", shape: "Graphic", colorMatte: "Color Matte", blackVideo: "Black Video", adjustmentLayer: "Adjustment Layer", bars: "Bars and Tone" }[c.generator.kind];
  return "Clip";
}

function ClipInfo(props: { project: Project; seq: Sequence; clip: Clip }) {
  const { project, seq, clip } = props;
  const fps = seq.settings.fps;
  const a: MediaAsset | undefined = clip.assetId ? project.media[clip.assetId] : undefined;
  const track = getTrack(seq, clip.trackId);
  const srcDur = clip.duration * clip.speed;
  return (
    <>
      <div className="info-title">
        <LabelChip label={clip.label} /> {clip.name}
      </div>
      <Grid
        rows={[
          ["Type", clipSourceLabel(project, clip)],
          ["Track", track?.name],
          ["Video", a ? videoInfo(a) : clip.motion ? `${seq.settings.width} x ${seq.settings.height}` : ""],
          ["Audio", a ? audioInfo(a) : ""],
          ["Start", formatTimecode(clip.start, fps)],
          ["End", formatTimecode(clipEnd(clip), fps)],
          ["Duration", formatTimecode(clip.duration, fps)],
          ["Source In", clip.assetId || clip.sequenceId ? formatTimecode(clip.sourceIn, fps) : ""],
          ["Source Out", clip.assetId || clip.sequenceId ? formatTimecode(clip.sourceIn + srcDur, fps) : ""],
          ["Speed", clip.speed !== 1 || clip.reversed ? `${Math.round(clip.speed * 100)}%${clip.reversed ? " (reversed)" : ""}` : ""],
          ["Effects", clip.effects.length ? clip.effects.length + "" : ""],
          ["Enabled", clip.enabled ? "" : "No"],
        ]}
      />
    </>
  );
}

export default function InfoPanel() {
  const project = useEditor((s) => s.project);
  const sel = useEditor((s) => s.selection);
  const activePanel = useEditor((s) => s.activePanel);
  const time = usePlayback((s) => s.time);
  const seq = project.activeSequenceId ? project.sequences[project.activeSequenceId] : null;

  // Like Premiere, show whichever selection was made last: timeline clips when the timeline has focus.
  const preferClip = sel.clipIds.length && (activePanel !== "project" || !sel.itemIds.length);
  const clip = seq && preferClip ? seq.clips.find((c) => c.id === sel.clipIds[0]) : undefined;
  const item = !clip && sel.itemIds.length ? project.items.find((i) => i.id === sel.itemIds[0]) : undefined;
  const info = item ? itemInfo(project, item) : null;
  const a = info?.asset;
  const fps = seq?.settings.fps ?? 30;

  return (
    <div className="info-panel">
      {clip && seq ? (
        <ClipInfo project={project} seq={seq} clip={clip} />
      ) : info ? (
        <>
          <div className="info-title">
            <ItemIcon info={info} /> <LabelChip label={info.item.label} /> {info.item.name}
          </div>
          <Grid
            rows={[
              ["Type", info.mediaType],
              ["Video", info.videoInfo],
              ["Frame Rate", info.fps ? `${info.fps} fps` : ""],
              ["Audio", info.audioInfo],
              ["Codec", a ? [a.videoCodec, a.audioCodec].filter(Boolean).join(" / ") : ""],
              ["Size", a ? fmtBytes(a.sizeBytes) : ""],
              ["Duration", info.kind !== "bin" ? formatTimecode(info.duration, info.fps ?? fps) : ""],
              ["In", a?.inPoint !== undefined ? formatTimecode(a.inPoint, a.fps ?? fps) : ""],
              ["Out", a?.outPoint !== undefined ? formatTimecode(a.outPoint, a.fps ?? fps) : ""],
              ["In/Out Duration", a && (a.inPoint !== undefined || a.outPoint !== undefined) ? formatTimecode((a.outPoint ?? a.duration) - (a.inPoint ?? 0), a.fps ?? fps) : ""],
              ["Status", a && a.status !== "ready" ? (a.status === "error" ? a.error ?? "Error" : "Importing…") : ""],
              ["Proxy", a?.proxyUrl ? "Attached" : ""],
              ["Items", info.kind === "bin" ? String(project.items.filter((i) => i.parentId === info.item.id).length) : ""],
              ["Path", a?.path],
            ]}
          />
          {sel.itemIds.length > 1 ? <div className="muted" style={{ marginTop: 6 }}>{sel.itemIds.length} items selected</div> : null}
        </>
      ) : (
        <div className="muted">Nothing selected</div>
      )}

      {seq ? (
        <>
          <div className="info-sep" />
          <div className="info-title">{seq.name}</div>
          <Grid
            rows={[
              ["Current Time", formatTimecode(time, fps)],
              ["Duration", formatTimecode(sequenceDuration(seq), fps)],
              ["Settings", `${seq.settings.width} x ${seq.settings.height}, ${seq.settings.fps} fps, ${seq.settings.sampleRate} Hz`],
              ["In/Out", seq.inPoint !== undefined || seq.outPoint !== undefined ? `${formatTimecode(seq.inPoint ?? 0, fps)} – ${formatTimecode(seq.outPoint ?? sequenceDuration(seq), fps)}` : ""],
            ]}
          />
          <div className="info-sep" />
          <div className="info-track">
            {[...seq.tracks.filter((t) => t.kind === "video").reverse(), ...seq.tracks.filter((t) => t.kind !== "video")].map((t) => {
              const c = clipAt(seq, t.id, time);
              return [
                <span key={t.id} className="muted">{t.name}</span>,
                <span key={t.id + ":c"} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c ? `${formatTimecode(c.start, fps)} – ${formatTimecode(clipEnd(c), fps)}  ${c.name}` : <span className="muted">—</span>}
                </span>,
              ];
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
