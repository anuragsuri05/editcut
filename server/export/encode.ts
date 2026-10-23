// Encoder settings per ExportFormat, output scaling/fps conform and audio finishing.
import path from "node:path";
import type { ExportSettings, Sequence } from "../../shared/types";
import { fpsRational, fpsValue, num } from "./expr";
import type { LoudnormMeasure } from "./graph";

export interface EncoderCaps {
  /** Best available AV1 encoder (libsvtav1 preferred). */
  av1?: string | null;
  videotoolbox?: boolean;
  libopus?: boolean;
}

export interface EncodePass {
  /** Video/container args (codec, rate control, pass flags, -f). */
  args: string[];
  audioArgs: string[];
  /** First pass of a 2-pass encode: no audio, output discarded. */
  noAudio?: boolean;
  nullOut?: string;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Output dimensions, forced even for 4:2:0 codecs. */
export function outputSize(seq: Sequence, s: ExportSettings): [number, number] {
  let w = s.width || seq.settings.width;
  let h = s.height || seq.settings.height;
  if (s.format !== "png" && s.format !== "gif" && !(s.format === "prores")) {
    w = even(w);
    h = even(h);
  }
  return [w, h];
}

/** Filters appended to the composite: letterboxed scaling, frame rate conform, pixel format (GIF palette). */
export function finalVideoFilters(seq: Sequence, s: ExportSettings, alpha: boolean): string[] {
  const [w, h] = outputSize(seq, s);
  const f: string[] = [];
  const W = seq.settings.width, H = seq.settings.height;
  const flags = s.useMaxRenderQuality ? "lanczos+accurate_rnd+full_chroma_int" : "bicubic";
  if (w !== W || h !== H) {
    f.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=${flags}`);
    f.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${alpha ? "black@0" : "black"}`);
  }
  f.push("setsar=1");
  const outFps = s.fps || seq.settings.fps;
  if (s.format !== "png" && Math.abs(fpsValue(outFps) - fpsValue(seq.settings.fps)) > 1e-3) f.push(`fps=${fpsRational(outFps)}`);
  switch (s.format) {
    case "gif":
      f.push("split[gpa][gpb];[gpa]palettegen=stats_mode=diff:max_colors=256[gpp];[gpb][gpp]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle");
      break;
    case "png":
      f.push("format=rgb24");
      break;
    case "prores":
      f.push(s.proresProfile === "4444" ? "format=yuva444p10le" : "format=yuv422p10le");
      break;
    case "hevc":
    case "h264":
    case "av1":
    case "vp9":
    default:
      f.push("format=yuv420p");
  }
  return f;
}

export function finalAudioFilters(seq: Sequence, s: ExportSettings, ln?: LoudnormMeasure): string[] {
  const f: string[] = [];
  const L = s.loudnessNormalize;
  if (L?.enabled) {
    if (ln && Number.isFinite(Number(ln.input_i)) && Number(ln.input_i) > -70) {
      f.push(
        `loudnorm=I=${num(L.targetLufs)}:TP=${num(L.truePeak)}:LRA=11:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}:offset=${ln.target_offset}:linear=true`,
      );
    } else if (!ln) f.push(`loudnorm=I=${num(L.targetLufs)}:TP=${num(L.truePeak)}:LRA=11`);
  }
  const sr = s.audioSampleRate || seq.settings.sampleRate || 48000;
  f.push(`aresample=${sr}`);
  f.push(`aformat=sample_rates=${sr}:channel_layouts=${s.audioChannels === 1 ? "mono" : "stereo"}`);
  return f;
}

function audioCodecArgs(s: ExportSettings, container: "mp4" | "mov" | "webm" | "wav" | "mp3" | "m4a", caps: EncoderCaps): string[] {
  const br = `${Math.max(32, Math.min(512, s.audioBitrateKbps || 320))}k`;
  const sr = String(s.audioSampleRate || 48000);
  const ch = String(s.audioChannels === 1 ? 1 : 2);
  const common = ["-ar", sr, "-ac", ch];
  switch (container) {
    case "wav":
      return ["-c:a", "pcm_s16le", ...common];
    case "mp3":
      return ["-c:a", "libmp3lame", "-b:a", br, ...common];
    case "m4a":
      return ["-c:a", "aac", "-b:a", br, ...common];
    case "webm":
      return caps.libopus === false ? ["-c:a", "libvorbis", "-b:a", br, ...common] : ["-c:a", "libopus", "-b:a", br, ...common];
    case "mov":
      return s.audioCodec === "aac" ? ["-c:a", "aac", "-b:a", br, ...common] : ["-c:a", "pcm_s16le", ...common];
    case "mp4":
    default:
      return s.audioCodec === "mp3" ? ["-c:a", "libmp3lame", "-b:a", br, ...common] : ["-c:a", "aac", "-b:a", br, ...common];
  }
}

/** Encoder passes for the settings (2 for VBR 2-pass software encodes). */
export function encoderArgs(s: ExportSettings, caps: EncoderCaps, tmpDir: string): EncodePass[] {
  const mbps = Math.max(0.1, s.videoBitrateMbps || 10);
  const b = `${num(mbps, 3)}M`;
  const fpsOut = s.fps ? fpsRational(s.fps) : undefined;
  const rate = fpsOut && s.format !== "png" ? ["-r", fpsOut] : [];
  const passlog = path.join(tmpDir, "passlog");
  const crf = s.crf ?? 20;
  const hw = s.hardwareEncoding && caps.videotoolbox !== false;
  const rc = (mode: ExportSettings["bitrateMode"]): string[] => {
    switch (mode) {
      case "cbr":
        return ["-b:v", b, "-minrate", b, "-maxrate", b, "-bufsize", `${num(mbps, 3)}M`];
      case "crf":
        return ["-crf", String(crf)];
      case "vbr2":
      case "vbr1":
      default:
        return ["-b:v", b, "-maxrate", `${num(mbps * 1.5, 3)}M`, "-bufsize", `${num(mbps * 2, 3)}M`];
    }
  };
  const twoPass = (video: string[], container: string[], audio: string[], flag: (n: 1 | 2) => string[]): EncodePass[] => [
    { args: [...video, ...flag(1), ...rate, "-an", "-f", "null"], audioArgs: [], noAudio: true, nullOut: "-" },
    { args: [...video, ...flag(2), ...rate, ...container], audioArgs: audio },
  ];

  switch (s.format) {
    case "h264": {
      const audio = audioCodecArgs(s, "mp4", caps);
      const container = ["-movflags", "+faststart", "-f", "mp4"];
      if (hw) {
        const bitrate = s.bitrateMode === "crf" ? ["-q:v", String(Math.max(1, Math.min(100, Math.round(100 - crf * 2))))] : ["-b:v", b, "-maxrate", s.bitrateMode === "cbr" ? b : `${num(mbps * 1.5, 3)}M`];
        return [{ args: ["-c:v", "h264_videotoolbox", "-profile:v", "high", ...bitrate, "-allow_sw", "1", ...rate, ...container], audioArgs: audio }];
      }
      const video = ["-c:v", "libx264", "-preset", s.useMaxRenderQuality ? "slow" : "medium", "-profile:v", "high", ...rc(s.bitrateMode)];
      if (s.bitrateMode === "vbr2") return twoPass(video, container, audio, (n) => ["-pass", String(n), "-passlogfile", passlog]);
      return [{ args: [...video, ...rate, ...container], audioArgs: audio }];
    }
    case "hevc": {
      const audio = audioCodecArgs(s, "mp4", caps);
      const container = ["-tag:v", "hvc1", "-movflags", "+faststart", "-f", "mp4"];
      if (hw) {
        const bitrate = s.bitrateMode === "crf" ? ["-q:v", String(Math.max(1, Math.min(100, Math.round(100 - crf * 2))))] : ["-b:v", b];
        return [{ args: ["-c:v", "hevc_videotoolbox", "-profile:v", "main", ...bitrate, "-allow_sw", "1", ...rate, ...container], audioArgs: audio }];
      }
      const crfH = s.crf ?? 23;
      const video = ["-c:v", "libx265", "-preset", s.useMaxRenderQuality ? "slow" : "medium", ...(s.bitrateMode === "crf" ? ["-crf", String(crfH)] : rc(s.bitrateMode))];
      if (s.bitrateMode === "vbr2") {
        const stats = path.join(tmpDir, "x265.stats");
        return twoPass(video, container, audio, (n) => ["-x265-params", `pass=${n}:stats=${stats}:log-level=error`]);
      }
      return [{ args: [...video, "-x265-params", "log-level=error", ...rate, ...container], audioArgs: audio }];
    }
    case "prores": {
      const profiles: Record<string, string> = { proxy: "0", lt: "1", standard: "2", hq: "3", "4444": "4" };
      const p = profiles[s.proresProfile ?? "hq"] ?? "3";
      return [{
        args: ["-c:v", "prores_ks", "-profile:v", p, "-vendor", "apl0", ...(p === "4" ? ["-alpha_bits", "16"] : []), ...rate, "-f", "mov"],
        audioArgs: audioCodecArgs(s, "mov", caps),
      }];
    }
    case "av1": {
      const enc = caps.av1 ?? "libsvtav1";
      const audio = audioCodecArgs(s, "mp4", caps);
      const container = ["-movflags", "+faststart", "-f", "mp4"];
      if (enc === "libsvtav1") {
        const q = s.bitrateMode === "crf" ? ["-crf", String(s.crf ?? 32)] : ["-b:v", b];
        return [{ args: ["-c:v", "libsvtav1", "-preset", s.useMaxRenderQuality ? "6" : "9", ...q, ...rate, ...container], audioArgs: audio }];
      }
      const q = s.bitrateMode === "crf" ? ["-crf", String(s.crf ?? 32), "-b:v", "0"] : ["-b:v", b];
      return [{ args: ["-c:v", enc, "-cpu-used", "6", "-row-mt", "1", ...q, ...rate, ...container], audioArgs: audio }];
    }
    case "vp9": {
      const audio = audioCodecArgs(s, "webm", caps);
      const q = s.bitrateMode === "crf" ? ["-crf", String(s.crf ?? 31), "-b:v", "0"] : s.bitrateMode === "cbr" ? ["-b:v", b, "-minrate", b, "-maxrate", b] : ["-b:v", b];
      const video = ["-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", s.useMaxRenderQuality ? "2" : "4", "-row-mt", "1", ...q];
      if (s.bitrateMode === "vbr2") return twoPass(video, ["-f", "webm"], audio, (n) => ["-pass", String(n), "-passlogfile", passlog]);
      return [{ args: [...video, ...rate, "-f", "webm"], audioArgs: audio }];
    }
    case "gif":
      return [{ args: [...rate, "-loop", "0", "-f", "gif"], audioArgs: [] }];
    case "png":
      return [{ args: ["-frames:v", "1", "-update", "1", "-c:v", "png", "-f", "image2"], audioArgs: [] }];
    case "wav":
      return [{ args: ["-vn", "-f", "wav"], audioArgs: audioCodecArgs(s, "wav", caps) }];
    case "mp3":
      return [{ args: ["-vn", "-f", "mp3"], audioArgs: audioCodecArgs(s, "mp3", caps) }];
    case "aac":
      return [{ args: ["-vn", "-movflags", "+faststart", "-f", "ipod"], audioArgs: audioCodecArgs(s, "m4a", caps) }];
  }
}
