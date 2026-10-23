// Export presets (Premiere "Preset" dropdown / Media Encoder preset browser).
// Shared by the Export mode UI, the server renderer and the AI agent.
import type { ExportFormat, ExportSettings, Sequence } from "./types";
import { sequenceDuration, tracksOfKind } from "./ops";

export interface ExportPreset {
  id: string;
  name: string;
  group: "Match Source" | "Web" | "Social" | "Mastering" | "Animation" | "Audio" | "Image";
  description: string;
  /** Settings this preset forces. width/height/fps 0 (or absent) = match sequence. */
  settings: Partial<ExportSettings>;
}

export const EXPORT_FORMATS: { value: ExportFormat; label: string; ext: string; video: boolean; audio: boolean }[] = [
  { value: "h264", label: "H.264", ext: "mp4", video: true, audio: true },
  { value: "hevc", label: "HEVC (H.265)", ext: "mp4", video: true, audio: true },
  { value: "prores", label: "QuickTime (Apple ProRes)", ext: "mov", video: true, audio: true },
  { value: "av1", label: "AV1", ext: "mp4", video: true, audio: true },
  { value: "vp9", label: "WebM (VP9)", ext: "webm", video: true, audio: true },
  { value: "gif", label: "Animated GIF", ext: "gif", video: true, audio: false },
  { value: "png", label: "PNG (frame at playhead)", ext: "png", video: true, audio: false },
  { value: "wav", label: "Waveform Audio (WAV)", ext: "wav", video: false, audio: true },
  { value: "mp3", label: "MP3", ext: "mp3", video: false, audio: true },
  { value: "aac", label: "AAC Audio", ext: "m4a", video: false, audio: true },
];

export function formatInfo(f: ExportFormat) {
  return EXPORT_FORMATS.find((x) => x.value === f) ?? EXPORT_FORMATS[0];
}

export function extensionFor(f: ExportFormat): string {
  return formatInfo(f).ext;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: "match-high", name: "Match Source – High Bitrate", group: "Match Source", description: "H.264 at sequence size and frame rate, 20 Mbps VBR 1-pass, AAC 320 kbps.",
    settings: { format: "h264", width: 0, height: 0, fps: 0, videoBitrateMbps: 20, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "match-adaptive-high", name: "Match Source – Adaptive High Bitrate", group: "Match Source", description: "H.264 at sequence size, quality-based (CRF 18), AAC 320 kbps.",
    settings: { format: "h264", width: 0, height: 0, fps: 0, videoBitrateMbps: 16, bitrateMode: "crf", crf: 18, audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "match-medium", name: "Match Source – Medium Bitrate", group: "Match Source", description: "H.264 at sequence size, 10 Mbps VBR.",
    settings: { format: "h264", width: 0, height: 0, fps: 0, videoBitrateMbps: 10, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 192, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "youtube-1080", name: "YouTube 1080p Full HD", group: "Web", description: "1920x1080 H.264, 16 Mbps VBR 2-pass, AAC 320 kbps.",
    settings: { format: "h264", width: 1920, height: 1080, fps: 0, videoBitrateMbps: 16, bitrateMode: "vbr2", audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "youtube-4k", name: "YouTube 2160p 4K Ultra HD", group: "Web", description: "3840x2160 H.264, 45 Mbps VBR, AAC 320 kbps.",
    settings: { format: "h264", width: 3840, height: 2160, fps: 0, videoBitrateMbps: 45, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "vimeo-1080", name: "Vimeo 1080p Full HD", group: "Web", description: "1920x1080 H.264, 20 Mbps VBR 2-pass.",
    settings: { format: "h264", width: 1920, height: 1080, fps: 0, videoBitrateMbps: 20, bitrateMode: "vbr2", audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "tiktok-916", name: "TikTok / Reels / Shorts 9:16", group: "Social", description: "1080x1920 vertical H.264, 12 Mbps, letterboxed if the sequence is landscape.",
    settings: { format: "h264", width: 1080, height: 1920, fps: 0, videoBitrateMbps: 12, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "instagram-45", name: "Instagram Feed 4:5", group: "Social", description: "1080x1350 H.264, 10 Mbps.",
    settings: { format: "h264", width: 1080, height: 1350, fps: 30, videoBitrateMbps: 10, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "square-11", name: "Square 1:1", group: "Social", description: "1080x1080 H.264, 10 Mbps.",
    settings: { format: "h264", width: 1080, height: 1080, fps: 30, videoBitrateMbps: 10, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "twitter-720", name: "X (Twitter) 720p", group: "Social", description: "1280x720 H.264, 6 Mbps.",
    settings: { format: "h264", width: 1280, height: 720, fps: 30, videoBitrateMbps: 6, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 192, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "behance-1080", name: "Behance 1080p", group: "Social", description: "1920x1080 H.264, 12 Mbps.",
    settings: { format: "h264", width: 1920, height: 1080, fps: 0, videoBitrateMbps: 12, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "prores-422hq", name: "Apple ProRes 422 HQ", group: "Mastering", description: "Match source, ProRes 422 HQ 10-bit, PCM audio (.mov).",
    settings: { format: "prores", proresProfile: "hq", width: 0, height: 0, fps: 0, audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2 } },
  { id: "prores-422", name: "Apple ProRes 422", group: "Mastering", description: "Match source, ProRes 422, PCM audio.",
    settings: { format: "prores", proresProfile: "standard", width: 0, height: 0, fps: 0, audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2 } },
  { id: "prores-4444", name: "Apple ProRes 4444 (with alpha)", group: "Mastering", description: "Match source, ProRes 4444, transparent background where the sequence is empty.",
    settings: { format: "prores", proresProfile: "4444", width: 0, height: 0, fps: 0, audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2 } },
  { id: "prores-proxy", name: "Apple ProRes 422 Proxy", group: "Mastering", description: "Lightweight ProRes for offline editing.",
    settings: { format: "prores", proresProfile: "proxy", width: 0, height: 0, fps: 0, audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2 } },
  { id: "hevc-4k", name: "HEVC 4K (SDR)", group: "Mastering", description: "3840x2160 HEVC Main, 30 Mbps, hvc1 tag (plays in QuickTime).",
    settings: { format: "hevc", width: 3840, height: 2160, fps: 0, videoBitrateMbps: 30, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "hevc-match", name: "HEVC Match Source", group: "Mastering", description: "HEVC at sequence size, 10 Mbps.",
    settings: { format: "hevc", width: 0, height: 0, fps: 0, videoBitrateMbps: 10, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "av1-1080", name: "AV1 1080p", group: "Web", description: "1920x1080 AV1 (SVT-AV1), quality based.",
    settings: { format: "av1", width: 1920, height: 1080, fps: 0, videoBitrateMbps: 8, bitrateMode: "crf", crf: 32, audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "webm-vp9", name: "WebM VP9 1080p", group: "Web", description: "1920x1080 VP9 + Opus.",
    settings: { format: "vp9", width: 1920, height: 1080, fps: 0, videoBitrateMbps: 8, bitrateMode: "vbr1", audioCodec: "aac", audioBitrateKbps: 192, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "gif-480", name: "Animated GIF 480p", group: "Animation", description: "480px wide GIF at 15 fps with an optimized palette.",
    settings: { format: "gif", width: 480, height: 0, fps: 15, audioCodec: "none" } },
  { id: "png-frame", name: "PNG Frame (at playhead)", group: "Image", description: "Single PNG still of the frame under the playhead.",
    settings: { format: "png", width: 0, height: 0, fps: 0, audioCodec: "none" } },
  { id: "wav-48k", name: "Waveform Audio 48 kHz 16-bit", group: "Audio", description: "Uncompressed stereo WAV.",
    settings: { format: "wav", audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2 } },
  { id: "mp3-320", name: "MP3 320 kbps", group: "Audio", description: "High quality MP3.",
    settings: { format: "mp3", audioCodec: "mp3", audioBitrateKbps: 320, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "aac-256", name: "AAC Audio 256 kbps", group: "Audio", description: "AAC in .m4a.",
    settings: { format: "aac", audioCodec: "aac", audioBitrateKbps: 256, audioSampleRate: 48000, audioChannels: 2 } },
  { id: "podcast-16", name: "Podcast – Loudness −16 LUFS (MP3)", group: "Audio", description: "MP3 192 kbps, loudness-normalized to −16 LUFS / −1 dBTP.",
    settings: { format: "mp3", audioCodec: "mp3", audioBitrateKbps: 192, audioSampleRate: 48000, audioChannels: 2, loudnessNormalize: { enabled: true, targetLufs: -16, truePeak: -1 } } },
  { id: "broadcast-23", name: "Broadcast – EBU R128 −23 LUFS (ProRes)", group: "Mastering", description: "ProRes 422 HQ with −23 LUFS loudness normalization.",
    settings: { format: "prores", proresProfile: "hq", width: 0, height: 0, fps: 0, audioCodec: "pcm", audioSampleRate: 48000, audioChannels: 2, loudnessNormalize: { enabled: true, targetLufs: -23, truePeak: -1 } } },
];

export const PRESET_MAP: Record<string, ExportPreset> = Object.fromEntries(EXPORT_PRESETS.map((p) => [p.id, p]));

export const QUICK_EXPORT_PRESET_ID = "match-high";

/** Sensible defaults (Match Source – High Bitrate) for a sequence. */
export function defaultExportSettings(seq: Pick<Sequence, "name" | "settings">): ExportSettings {
  return applyPreset(
    {
      fileName: seq.name,
      format: "h264",
      presetId: QUICK_EXPORT_PRESET_ID,
      range: "entire",
      width: seq.settings.width,
      height: seq.settings.height,
      fps: seq.settings.fps,
      videoBitrateMbps: 20,
      bitrateMode: "vbr1",
      crf: 20,
      proresProfile: "hq",
      hardwareEncoding: false,
      audioCodec: "aac",
      audioBitrateKbps: 320,
      audioSampleRate: 48000,
      audioChannels: 2,
      loudnessNormalize: { enabled: false, targetLufs: -16, truePeak: -1 },
      burnCaptions: false,
      exportCaptionsSidecar: "none",
      useMaxRenderQuality: false,
    },
    QUICK_EXPORT_PRESET_ID,
    seq,
  );
}

/** Apply a preset on top of existing settings; 0 sizes/fps resolve to the sequence. Keeps file name, range, captions. */
export function applyPreset(base: ExportSettings, presetId: string, seq: Pick<Sequence, "settings">): ExportSettings {
  const preset = PRESET_MAP[presetId];
  if (!preset) return base;
  const s: ExportSettings = { ...base, ...preset.settings, presetId };
  if (!preset.settings.loudnessNormalize && base.loudnessNormalize) s.loudnessNormalize = { ...base.loudnessNormalize, enabled: false };
  const sw = seq.settings.width, sh = seq.settings.height;
  if (!s.width && !s.height) {
    s.width = sw;
    s.height = sh;
  } else if (s.width && !s.height) {
    s.height = Math.round((s.width * sh) / sw / 2) * 2;
  } else if (!s.width && s.height) {
    s.width = Math.round((s.height * sw) / sh / 2) * 2;
  }
  if (!s.fps) s.fps = seq.settings.fps;
  return s;
}

/** Estimated output size in bytes (Premiere's "Estimated File Size"). */
export function estimateSizeBytes(s: ExportSettings, durationSec: number): number {
  const info = formatInfo(s.format);
  let videoBps = 0;
  if (info.video) {
    if (s.format === "prores") {
      // Apple ProRes target data rates at 1920x1080 29.97 (Mbps), scaled by pixels & fps
      const base: Record<string, number> = { proxy: 45, lt: 102, standard: 147, hq: 220, "4444": 330 };
      videoBps = (base[s.proresProfile ?? "hq"] ?? 220) * 1e6 * ((s.width * s.height) / (1920 * 1080)) * (s.fps / 29.97);
    } else if (s.format === "gif") {
      videoBps = s.width * s.height * s.fps * 0.9; // ~0.11 bytes/px/frame
    } else if (s.format === "png") {
      return s.width * s.height * 1.5;
    } else {
      videoBps = s.videoBitrateMbps * 1e6;
    }
  }
  let audioBps = 0;
  if (info.audio && s.audioCodec !== "none") {
    if (s.format === "wav" || (s.format === "prores" && s.audioCodec === "pcm")) audioBps = s.audioSampleRate * 16 * s.audioChannels;
    else audioBps = s.audioBitrateKbps * 1000;
  }
  return Math.round(((videoBps + audioBps) / 8) * Math.max(0, durationSec));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// ---------------------------------------------------------------- range & captions

function fpsExact(fps: number): number {
  for (const [f, v] of [[23.976, 24000 / 1001], [29.97, 30000 / 1001], [59.94, 60000 / 1001], [47.952, 48000 / 1001], [119.88, 120000 / 1001]] as const)
    if (Math.abs(fps - f) < 0.01) return v;
  return fps;
}

/** Export time range [start, end] in sequence seconds (frame-snapped). PNG = the frame under the playhead. */
export function exportRangeOf(seq: Sequence, s: Pick<ExportSettings, "range" | "format">): [number, number] {
  const fv = fpsExact(seq.settings.fps);
  const dur = sequenceDuration(seq);
  const fr = (t: number) => Math.round(t * fv + 1e-7);
  if (s.format === "png") {
    const t = Math.max(0, Math.min(seq.playhead ?? 0, Math.max(0, dur - 1 / fv)));
    const f = fr(t);
    return [f / fv, (f + 1) / fv];
  }
  if (s.range === "inOut" || s.range === "workArea") {
    const a = Math.max(0, seq.inPoint ?? 0);
    const b = Math.min(dur, seq.outPoint ?? dur);
    if (b - a >= 1 / fv) return [fr(a) / fv, fr(b) / fv];
  }
  return [0, fr(dur) / fv];
}

function srtTime(t: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

/** SRT / WebVTT text for the caption clips in range (times relative to the range start). "" if none. */
export function captionsText(seq: Sequence, range: [number, number], format: "srt" | "vtt"): string {
  const tracks = tracksOfKind(seq, "caption").filter((t) => !t.muted);
  const cues = seq.clips
    .filter((c) => c.caption && tracks.some((t) => t.id === c.trackId) && c.enabled !== false)
    .map((c) => ({ s: Math.max(c.start, range[0]) - range[0], e: Math.min(c.start + c.duration, range[1]) - range[0], text: c.caption!.text }))
    .filter((c) => c.e > c.s + 1e-6)
    .sort((a, b) => a.s - b.s);
  if (!cues.length) return "";
  if (format === "vtt") return "WEBVTT\n\n" + cues.map((c) => `${srtTime(c.s, ".")} --> ${srtTime(c.e, ".")}\n${c.text}\n`).join("\n");
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.s, ",")} --> ${srtTime(c.e, ",")}\n${c.text}\n`).join("\n");
}
