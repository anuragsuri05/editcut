// EditCut project data model. Shared by the browser client, the Node server
// (export renderer, AI agent) and persisted as JSON. All times are in SECONDS
// (floats); UI snaps them to sequence frames via shared/time.ts.

export type ID = string;

// ---------- Media ----------

export type MediaKind = "video" | "audio" | "image";

export interface MediaAsset {
  id: ID;
  name: string;
  kind: MediaKind;
  /** Absolute path of the original file on the server machine. */
  path: string;
  /** URL the browser plays (original or proxy), e.g. /files/media/<id>/proxy.mp4 */
  url: string;
  /** Browser-playable proxy url if one was generated. */
  proxyUrl?: string;
  duration: number; // seconds (images: default still duration)
  width?: number;
  height?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  audioChannels?: number;
  sampleRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  sizeBytes?: number;
  /** Thumbnail sprite: horizontal strip of frames, each thumbWidth x thumbHeight, one every thumbInterval sec. */
  thumbs?: { url: string; count: number; interval: number; width: number; height: number };
  /** URL of JSON waveform peaks: { peaksPerSecond: number, peaks: number[] (0..1) } */
  waveformUrl?: string;
  /** Media-level In/Out marks set in the Source Monitor. */
  inPoint?: number;
  outPoint?: number;
  markers: Marker[];
  /** Whisper transcript, if transcribed. */
  transcript?: Transcript;
  status: "importing" | "ready" | "error";
  error?: string;
  label?: LabelColor;
  importedAt: number;
}

export interface TranscriptWord { text: string; start: number; end: number; speaker?: string }
export interface TranscriptSegment { id: ID; text: string; start: number; end: number; words: TranscriptWord[]; speaker?: string }
export interface Transcript { language?: string; segments: TranscriptSegment[] }

// ---------- Project bins ----------

export type ProjectItemType = "bin" | "media" | "sequence";

export interface ProjectItem {
  id: ID; // same id as the MediaAsset / Sequence it refers to (bins have their own)
  type: ProjectItemType;
  name: string;
  parentId: ID | null; // bin id or null = root
  label?: LabelColor;
}

export type LabelColor =
  | "violet" | "iris" | "caribbean" | "lavender" | "cerulean" | "forest" | "rose" | "mango"
  | "purple" | "blue" | "teal" | "magenta" | "tan" | "green" | "brown" | "yellow";

export const LABEL_COLORS: Record<LabelColor, string> = {
  violet: "#a593e0", iris: "#5a70d6", caribbean: "#1dbfa0", lavender: "#e384e0",
  cerulean: "#1c9ed9", forest: "#5c9e3a", rose: "#e3577f", mango: "#e8962c",
  purple: "#8f45c2", blue: "#2f56d9", teal: "#178e8e", magenta: "#cf2fb3",
  tan: "#c9a77c", green: "#3fae4a", brown: "#8c5a32", yellow: "#e2d43c",
};

// ---------- Animatable parameters ----------

export type Interp = "linear" | "bezier" | "hold" | "easeIn" | "easeOut" | "easeInOut";

export interface Keyframe {
  /** Time relative to the CLIP START on the timeline (seconds). */
  t: number;
  v: number;
  interp: Interp;
}

/** A numeric parameter: static value, or animated when keyframes is non-empty. */
export interface Param {
  value: number;
  keyframes?: Keyframe[];
}

// ---------- Effects ----------

/** Effect type ids are registered in shared/effects.ts (EFFECTS registry). */
export interface Effect {
  id: ID;
  type: string;
  enabled: boolean;
  params: Record<string, Param>;
  /** Non-numeric settings (e.g. key color hex, LUT name, blend option). */
  options?: Record<string, string | boolean>;
}

export type BlendMode =
  | "normal" | "darken" | "multiply" | "colorBurn" | "lighten" | "screen" | "colorDodge"
  | "add" | "overlay" | "softLight" | "hardLight" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";

/** Fixed (intrinsic) video effects every visual clip has, like Premiere's Motion/Opacity. */
export interface MotionProps {
  positionX: Param; // px in sequence space, default = sequence center
  positionY: Param;
  scale: Param; // percent, 100 = native size
  scaleWidth: Param; // percent, used when uniformScale = false
  uniformScale: boolean;
  rotation: Param; // degrees
  anchorX: Param; // px in clip-source space, default = source center
  anchorY: Param;
  cropLeft: Param; // percent
  cropRight: Param;
  cropTop: Param;
  cropBottom: Param;
}

export interface OpacityProps {
  opacity: Param; // 0..100
  blendMode: BlendMode;
}

export interface AudioProps {
  volumeDb: Param; // clip volume in dB (0 = unity), Premiere "Volume > Level"
  pan: Param; // -100 (L) .. 100 (R)
  muted: boolean;
}

// ---------- Masks ----------

export interface Mask {
  id: ID;
  shape: "ellipse" | "rectangle" | "polygon";
  /** Normalized (0..1) points in clip frame space. Ellipse/rect use the bounding box of the points. */
  points: { x: number; y: number }[];
  feather: number; // px
  expansion: number; // px
  opacity: number; // 0..100
  inverted: boolean;
}

// ---------- Generators (synthetic clips) ----------

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number; // px at sequence resolution
  fontWeight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number; // multiplier
  letterSpacing: number; // px
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  background?: { color: string; padding: number; radius: number };
}

export type Generator =
  | { kind: "text"; style: TextStyle }
  | { kind: "shape"; shape: "rectangle" | "ellipse"; fill: string; stroke?: string; strokeWidth?: number; width: number; height: number; radius?: number }
  | { kind: "colorMatte"; color: string }
  | { kind: "blackVideo" }
  | { kind: "adjustmentLayer" }
  | { kind: "bars" };

// ---------- Timeline ----------

export type TrackKind = "video" | "audio" | "caption";

export interface Track {
  id: ID;
  kind: TrackKind;
  name: string; // "V1", "A2", "Subtitle"
  locked: boolean;
  syncLock: boolean;
  /** Track targeting (blue highlight) for commands like Match Frame / Go to edit. */
  targeted: boolean;
  /** Video: toggle track output (eye). Audio: mute. */
  muted: boolean;
  solo: boolean; // audio only
  height: number; // px in timeline
  volumeDb: number; // audio track fader
  pan: number;
}

export interface Clip {
  id: ID;
  trackId: ID;
  name: string;
  /** Source media asset; undefined for generators and nested sequences. */
  assetId?: ID;
  /** Nested sequence source. */
  sequenceId?: ID;
  generator?: Generator;
  /** Timeline start, seconds. */
  start: number;
  /** Timeline duration, seconds (already accounts for speed). */
  duration: number;
  /** Source in-point, seconds into the media. */
  sourceIn: number;
  /** Playback rate; 1 = normal. Source consumed = duration * speed. */
  speed: number;
  reversed: boolean;
  maintainPitch: boolean;
  enabled: boolean;
  /** Clips sharing a linkId move/select together (video + its audio). */
  linkId?: ID;
  /** Clips sharing a groupId select/move together (Clip > Group); independent of linking. */
  groupId?: ID;
  /** Clip > Video Options > Time Interpolation (default frameSampling). */
  timeInterpolation?: "frameSampling" | "frameBlending" | "opticalFlow";
  /** Which audio channel(s) of the source this audio clip plays. */
  audioChannel?: number;
  label?: LabelColor;
  motion?: MotionProps; // visual clips
  opacity?: OpacityProps; // visual clips
  audio?: AudioProps; // audio clips
  effects: Effect[];
  masks: Mask[];
  /** Captions only. */
  caption?: { text: string };
  markers: Marker[];
}

export type TransitionType =
  | "crossDissolve" | "dipToBlack" | "dipToWhite" | "filmDissolve" | "additiveDissolve"
  | "wipeLeft" | "wipeRight" | "wipeUp" | "wipeDown"
  | "slideLeft" | "slideRight" | "slideUp" | "slideDown"
  | "pushLeft" | "pushRight" | "pushUp" | "pushDown"
  | "irisRound" | "irisBox" | "zoomIn" | "zoomOut" | "barnDoors" | "crossZoom" | "whip"
  | "constantPower" | "constantGain" | "exponentialFade";

/**
 * A transition sits on a cut point of a track. When clipBId is set it is a
 * two-sided transition between adjacent clips A (outgoing) and B (incoming);
 * otherwise a one-sided transition at clipA's end (edge "out") or at clipB's start (edge "in").
 */
export interface Transition {
  id: ID;
  trackId: ID;
  type: TransitionType;
  /** Timeline time of the cut (center reference). */
  at: number;
  duration: number;
  alignment: "center" | "start" | "end"; // "start" = starts at cut, "end" = ends at cut
  clipAId?: ID;
  clipBId?: ID;
}

export type MarkerColor = "green" | "red" | "purple" | "orange" | "yellow" | "white" | "blue" | "cyan";
export interface Marker {
  id: ID;
  time: number;
  duration: number;
  name: string;
  comment: string;
  color: MarkerColor;
  type: "comment" | "chapter" | "segmentation" | "webLink";
}

export interface SequenceSettings {
  width: number;
  height: number;
  fps: number; // e.g. 23.976, 24, 25, 29.97, 30, 50, 59.94, 60
  sampleRate: number; // 48000
  pixelAspect: number; // 1
  backgroundColor: string;
}

export interface Sequence {
  id: ID;
  name: string;
  settings: SequenceSettings;
  /** Ordered bottom-to-top for video (V1 first), top-to-bottom for audio (A1 first). */
  tracks: Track[];
  clips: Clip[];
  transitions: Transition[];
  markers: Marker[];
  inPoint?: number;
  outPoint?: number;
  playhead: number;
  /** Master audio bus. */
  masterVolumeDb: number;
  createdAt: number;
}

export interface Project {
  id: ID;
  name: string;
  version: 1;
  items: ProjectItem[];
  media: Record<ID, MediaAsset>;
  sequences: Record<ID, Sequence>;
  activeSequenceId: ID | null;
  createdAt: number;
  updatedAt: number;
}

// ---------- Export ----------

export type ExportFormat = "h264" | "hevc" | "prores" | "av1" | "vp9" | "gif" | "mp3" | "wav" | "aac" | "png";

export interface ExportSettings {
  fileName: string;
  /** Directory on the server machine; default ~/Movies/EditCut */
  directory?: string;
  format: ExportFormat;
  presetId?: string;
  range: "entire" | "inOut" | "workArea";
  width: number;
  height: number;
  fps: number;
  /** Video bitrate in Mbps (VBR target) — ignored for ProRes/GIF/PNG. */
  videoBitrateMbps: number;
  bitrateMode: "cbr" | "vbr1" | "vbr2" | "crf";
  crf?: number;
  proresProfile?: "proxy" | "lt" | "standard" | "hq" | "4444";
  hardwareEncoding: boolean;
  audioCodec: "aac" | "pcm" | "mp3" | "none";
  audioBitrateKbps: number;
  audioSampleRate: number;
  audioChannels: 1 | 2;
  loudnessNormalize?: { enabled: boolean; targetLufs: number; truePeak: number };
  burnCaptions: boolean;
  exportCaptionsSidecar: "none" | "srt" | "vtt";
  useMaxRenderQuality: boolean;
}

export interface ExportJob {
  id: ID;
  sequenceName: string;
  outputPath: string;
  status: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number; // 0..1
  etaSeconds?: number;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  /** Optional details (export queue UI). */
  sequenceId?: ID;
  format?: ExportFormat;
  presetName?: string;
  warnings?: string[];
}
