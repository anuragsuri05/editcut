// Factories producing default project objects.
import type {
  AudioProps, Clip, Effect, Generator, Marker, MediaAsset, MotionProps, OpacityProps,
  Project, Sequence, SequenceSettings, TextStyle, Track, TrackKind,
} from "./types";
import { EFFECT_MAP } from "./effects";
import { p } from "./params";

export function uid(prefix = ""): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
  return prefix + r.slice(0, 12);
}

export const SEQUENCE_PRESETS: { id: string; name: string; group: string; settings: Partial<SequenceSettings> }[] = [
  { id: "hd1080p30", name: "HD 1080p 30", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 30 } },
  { id: "hd1080p2997", name: "HD 1080p 29.97", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 29.97 } },
  { id: "hd1080p25", name: "HD 1080p 25", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 25 } },
  { id: "hd1080p24", name: "HD 1080p 24", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 24 } },
  { id: "hd1080p23976", name: "HD 1080p 23.976", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 23.976 } },
  { id: "hd1080p60", name: "HD 1080p 60", group: "Digital SLR / Web", settings: { width: 1920, height: 1080, fps: 60 } },
  { id: "hd720p30", name: "HD 720p 30", group: "Digital SLR / Web", settings: { width: 1280, height: 720, fps: 30 } },
  { id: "uhd4k30", name: "UHD 4K 30", group: "UHD", settings: { width: 3840, height: 2160, fps: 30 } },
  { id: "uhd4k24", name: "UHD 4K 24", group: "UHD", settings: { width: 3840, height: 2160, fps: 24 } },
  { id: "uhd4k60", name: "UHD 4K 60", group: "UHD", settings: { width: 3840, height: 2160, fps: 60 } },
  { id: "vertical1080", name: "Vertical 9:16 1080x1920 30", group: "Social", settings: { width: 1080, height: 1920, fps: 30 } },
  { id: "square1080", name: "Square 1:1 1080x1080 30", group: "Social", settings: { width: 1080, height: 1080, fps: 30 } },
  { id: "portrait45", name: "Portrait 4:5 1080x1350 30", group: "Social", settings: { width: 1080, height: 1350, fps: 30 } },
  { id: "cinema4k", name: "DCI 4K 24", group: "Cinema", settings: { width: 4096, height: 2160, fps: 24 } },
];

export function defaultSequenceSettings(overrides: Partial<SequenceSettings> = {}): SequenceSettings {
  return { width: 1920, height: 1080, fps: 30, sampleRate: 48000, pixelAspect: 1, backgroundColor: "#000000", ...overrides };
}

export function makeTrack(kind: TrackKind, index: number): Track {
  const prefix = kind === "video" ? "V" : kind === "audio" ? "A" : "C";
  return {
    id: uid("trk_"), kind, name: `${prefix}${index}`, locked: false, syncLock: true,
    targeted: kind !== "caption" && index === 1, muted: false, solo: false,
    height: kind === "video" ? 56 : kind === "audio" ? 52 : 32, volumeDb: 0, pan: 0,
  };
}

export function makeSequence(name: string, settings: Partial<SequenceSettings> = {}, videoTracks = 3, audioTracks = 3): Sequence {
  const tracks: Track[] = [];
  for (let i = 1; i <= videoTracks; i++) tracks.push(makeTrack("video", i));
  for (let i = 1; i <= audioTracks; i++) tracks.push(makeTrack("audio", i));
  return {
    id: uid("seq_"), name, settings: defaultSequenceSettings(settings), tracks, clips: [], transitions: [],
    markers: [], playhead: 0, masterVolumeDb: 0, createdAt: Date.now(),
  };
}

export function makeProject(name = "Untitled"): Project {
  return {
    id: uid("prj_"), name, version: 1, items: [], media: {}, sequences: {}, activeSequenceId: null,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

export function defaultMotion(seq: SequenceSettings, srcW = seq.width, srcH = seq.height): MotionProps {
  return {
    positionX: p(seq.width / 2), positionY: p(seq.height / 2), scale: p(100), scaleWidth: p(100), uniformScale: true,
    rotation: p(0), anchorX: p(srcW / 2), anchorY: p(srcH / 2),
    cropLeft: p(0), cropRight: p(0), cropTop: p(0), cropBottom: p(0),
  };
}

export function defaultOpacity(): OpacityProps {
  return { opacity: p(100), blendMode: "normal" };
}

export function defaultAudioProps(): AudioProps {
  return { volumeDb: p(0), pan: p(0), muted: false };
}

export function makeEffect(type: string): Effect {
  const def = EFFECT_MAP[type];
  if (!def) throw new Error(`Unknown effect type: ${type}`);
  const params: Effect["params"] = {};
  for (const pd of def.params) params[pd.key] = p(pd.default);
  const options: Record<string, string | boolean> = {};
  for (const od of def.options ?? []) options[od.key] = od.default;
  return { id: uid("fx_"), type, enabled: true, params, options };
}

export function makeMarker(time: number, init: Partial<Marker> = {}): Marker {
  return { id: uid("mk_"), time, duration: 0, name: "", comment: "", color: "green", type: "comment", ...init };
}

export function defaultTextStyle(text = "Title"): TextStyle {
  return {
    text, fontFamily: "Inter, Helvetica, Arial, sans-serif", fontSize: 96, fontWeight: 700, italic: false,
    color: "#ffffff", align: "center", lineHeight: 1.2, letterSpacing: 0,
    shadow: { color: "rgba(0,0,0,0.6)", blur: 8, offsetX: 0, offsetY: 3 },
  };
}

/** Create a visual or audio clip for a media asset. */
export function makeMediaClip(
  asset: MediaAsset, seq: SequenceSettings, trackId: string, kind: "video" | "audio",
  start: number, sourceIn: number, duration: number, linkId?: string,
): Clip {
  const visual = kind === "video";
  return {
    id: uid("clp_"), trackId, name: asset.name, assetId: asset.id, start, duration, sourceIn, speed: 1,
    reversed: false, maintainPitch: true, enabled: true, linkId, label: visual ? (asset.kind === "image" ? "lavender" : "iris") : "forest",
    motion: visual ? fitMotion(seq, asset.width ?? seq.width, asset.height ?? seq.height, false) : undefined,
    opacity: visual ? defaultOpacity() : undefined,
    audio: visual ? undefined : defaultAudioProps(),
    effects: [], masks: [], markers: [],
  };
}

/** Motion that keeps native size (Premiere default) or scales to fit the frame. */
export function fitMotion(seq: SequenceSettings, srcW: number, srcH: number, fit: boolean | "fill"): MotionProps {
  const m = defaultMotion(seq, srcW, srcH);
  if (fit) {
    const sx = seq.width / srcW, sy = seq.height / srcH;
    m.scale = p(Math.round((fit === "fill" ? Math.max(sx, sy) : Math.min(sx, sy)) * 10000) / 100);
  }
  return m;
}

export function makeGeneratorClip(gen: Generator, seq: SequenceSettings, trackId: string, start: number, duration: number, name?: string): Clip {
  const names: Record<Generator["kind"], string> = {
    text: "Graphic", shape: "Shape", colorMatte: "Color Matte", blackVideo: "Black Video", adjustmentLayer: "Adjustment Layer", bars: "Bars and Tone",
  };
  return {
    id: uid("clp_"), trackId, name: name ?? (gen.kind === "text" ? gen.style.text.slice(0, 40) : names[gen.kind]),
    generator: gen, start, duration, sourceIn: 0, speed: 1, reversed: false, maintainPitch: true, enabled: true,
    label: gen.kind === "adjustmentLayer" ? "lavender" : "rose",
    motion: defaultMotion(seq), opacity: defaultOpacity(), effects: [], masks: [], markers: [],
  };
}

export function makeCaptionClip(trackId: string, start: number, duration: number, text: string): Clip {
  return {
    id: uid("clp_"), trackId, name: text.slice(0, 40), start, duration, sourceIn: 0, speed: 1, reversed: false,
    maintainPitch: true, enabled: true, label: "yellow", effects: [], masks: [], markers: [], caption: { text },
  };
}
