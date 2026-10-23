// End-to-end tests for the ffmpeg export renderer (server/export).
// Builds real projects from samples/, renders them with ffmpeg, verifies the
// outputs with ffprobe and extracts frames for visual inspection.
//
//   npx tsx scripts/test-export.ts            # all tests
//   npx tsx scripts/test-export.ts pip gif    # only tests whose name contains "pip" or "gif"
//   EXPORT_TEST_OUT=/some/dir npx tsx scripts/test-export.ts
//
// Frames are written to <out>/frames/<test>_<t>.png — open them to check composition.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Clip, ExportJob, ExportSettings, MediaAsset, Project, Sequence } from "../shared/types";
import { makeProject, makeSequence, makeMediaClip, makeGeneratorClip, makeEffect, makeTrack, makeCaptionClip, defaultTextStyle, fitMotion } from "../shared/factory";
import { addTransition, tracksOfKind, nestClips, sequenceDuration } from "../shared/ops";
import { defaultExportSettings, applyPreset } from "../shared/exportPresets";
import { ExportQueue, FFMPEG } from "../server/export/jobs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "samples");
const OUT = process.env.EXPORT_TEST_OUT || path.join(os.tmpdir(), "editcut-export-tests");
const FRAMES = path.join(OUT, "frames");
const FFPROBE = FFMPEG.endsWith("ffmpeg") ? FFMPEG.replace(/ffmpeg$/, "ffprobe") : "ffprobe";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

// ------------------------------------------------------------ helpers

function probe(file: string): { format: { duration: string }; streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string; duration?: string; nb_frames?: string; channels?: number; sample_rate?: string; pix_fmt?: string; codec_tag_string?: string }[] } {
  return JSON.parse(execFileSync(FFPROBE, ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
}

let assetSeq = 0;
function asset(file: string): MediaAsset {
  const p = path.join(SAMPLES, file);
  const info = probe(p);
  const v = info.streams.find((s) => s.codec_type === "video");
  const a = info.streams.find((s) => s.codec_type === "audio");
  const isImage = /\.(png|jpe?g)$/i.test(file);
  const fr = v?.r_frame_rate?.split("/").map(Number);
  return {
    id: `ast_${++assetSeq}_${file.replace(/\W/g, "_")}`,
    name: file, kind: isImage ? "image" : v ? "video" : "audio", path: p, url: "",
    duration: isImage ? 5 : Number(info.format.duration), width: v?.width, height: v?.height,
    fps: fr ? fr[0] / (fr[1] || 1) : undefined, hasVideo: !!v, hasAudio: !!a, audioChannels: a?.channels,
    sampleRate: a ? Number(a.sample_rate) : undefined, videoCodec: v?.codec_name, audioCodec: a?.codec_name,
    markers: [], status: "ready", importedAt: Date.now(),
  };
}

const A = {
  testsrc: asset("clip_testsrc_1080p.mp4"),
  bars: asset("bars_720p_noaudio.mp4"),
  talk: asset("talking_head_speech.mp4"),
  green: asset("greenscreen.mp4"),
  music: asset("music.mp3"),
  photo: asset("photo.png"),
};

function project(seq: Sequence, extra: Sequence[] = []): Project {
  const p = makeProject("Export Test");
  for (const a of Object.values(A)) p.media[a.id] = a;
  p.sequences[seq.id] = seq;
  for (const s of extra) p.sequences[s.id] = s;
  p.activeSequenceId = seq.id;
  return p;
}

const V = (seq: Sequence, i: number) => tracksOfKind(seq, "video")[i];
const Au = (seq: Sequence, i: number) => tracksOfKind(seq, "audio")[i];

function vclip(seq: Sequence, a: MediaAsset, track: number, start: number, sourceIn: number, dur: number, fit: boolean | "fill" = true): Clip {
  const c = makeMediaClip(a, seq.settings, V(seq, track).id, "video", start, sourceIn, dur);
  c.motion = fitMotion(seq.settings, a.width ?? seq.settings.width, a.height ?? seq.settings.height, fit);
  seq.clips.push(c);
  return c;
}
function aclip(seq: Sequence, a: MediaAsset, track: number, start: number, sourceIn: number, dur: number): Clip {
  const c = makeMediaClip(a, seq.settings, Au(seq, track).id, "audio", start, sourceIn, dur);
  seq.clips.push(c);
  return c;
}

/** Title graphic drawn with ffmpeg geq (transparent PNG at sequence size): a lower-third bar with "text" blocks. */
function makeTitlePNG(file: string, W: number, H: number) {
  const expr = (ch: "r" | "g" | "b" | "a") => {
    const bar = `between(X,${W * 0.08},${W * 0.62})*between(Y,${H * 0.74},${H * 0.88})`;
    const txt = `between(Y,${H * 0.775},${H * 0.845})*between(X,${W * 0.11},${W * 0.58})*lt(mod(X,${Math.round(W * 0.035)}),${Math.round(W * 0.026)})`;
    const v = { r: `if(${txt},255,if(${bar},20,0))`, g: `if(${txt},255,if(${bar},90,0))`, b: `if(${txt},255,if(${bar},220,0))`, a: `if(${txt},255,if(${bar},200,0))` };
    return v[ch];
  };
  execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=black@0:s=${W}x${H}:d=1,format=rgba`, "-vf",
    `geq=r='${expr("r")}':g='${expr("g")}':b='${expr("b")}':a='${expr("a")}'`, "-frames:v", "1", file]);
}
function makeCaptionPNG(file: string, W: number, H: number) {
  execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=black@0:s=${W}x${H}:d=1,format=rgba`, "-vf",
    `geq=r='255*between(Y,${H * 0.86},${H * 0.92})*between(X,${W * 0.3},${W * 0.7})':g='255*between(Y,${H * 0.86},${H * 0.92})*between(X,${W * 0.3},${W * 0.7})':b='0':a='200*between(Y,${H * 0.84},${H * 0.94})*between(X,${W * 0.28},${W * 0.72})'`, "-frames:v", "1", file]);
}

const kf = (pairs: [number, number][], interp: "linear" | "easeInOut" = "linear") => ({ value: pairs[0][1], keyframes: pairs.map(([t, v]) => ({ t, v, interp })) });

// ------------------------------------------------------------ test cases

interface TestCase {
  name: string;
  build: () => { project: Project; seq: Sequence; settings: Partial<ExportSettings>; graphics?: Record<string, string> };
  expect: { duration: number; video?: { w: number; h: number; codec: string; fps?: number }; audio?: { codec: string; channels?: number } | null; tag?: string };
  frames?: number[];
  check?: (file: string) => string | null;
}

function settingsFor(seq: Sequence, preset: string, extra: Partial<ExportSettings> = {}): Partial<ExportSettings> {
  return { ...applyPreset(defaultExportSettings(seq), preset, seq), directory: OUT, fileName: extra.fileName ?? "out", ...extra };
}

const tests: TestCase[] = [
  {
    name: "pip_keyframes_h264",
    build: () => {
      const seq = makeSequence("PiP", { width: 1920, height: 1080, fps: 30 });
      vclip(seq, A.testsrc, 0, 0, 0, 6);
      const pip = vclip(seq, A.bars, 1, 0.5, 0, 5, false);
      // PiP flies from top-left to bottom-right, grows 30%→50%, fades in
      pip.motion!.positionX = kf([[0, 400], [4, 1500]], "easeInOut");
      pip.motion!.positionY = kf([[0, 250], [4, 800]]);
      pip.motion!.scale = kf([[0, 30], [4, 50]]);
      pip.opacity!.opacity = kf([[0, 0], [1, 100]]);
      aclip(seq, A.testsrc, 0, 0, 0, 6);
      return { project: project(seq), seq, settings: settingsFor(seq, "match-high", { fileName: "pip" }) };
    },
    expect: { duration: 6, video: { w: 1920, h: 1080, codec: "h264", fps: 30 }, audio: { codec: "aac", channels: 2 } },
    frames: [0.6, 1.0, 3.0, 5.0],
  },
  {
    name: "greenscreen_lumetri_blur_hevc",
    build: () => {
      const seq = makeSequence("Key", { width: 1920, height: 1080, fps: 30 });
      const bg = vclip(seq, A.photo, 0, 0, 0, 4, "fill");
      const lum = makeEffect("lumetri");
      lum.params.temperature = { value: 60 };
      lum.params.saturation = { value: 140 };
      lum.params.vignetteAmount = { value: -3 };
      const blur = makeEffect("gaussianBlur");
      blur.params.blurriness = { value: 30 };
      bg.effects.push(lum, blur);
      const fg = vclip(seq, A.green, 1, 0, 0, 4);
      const key = makeEffect("ultraKey");
      key.options = { keyColor: "#008000" };
      fg.effects.push(key);
      return { project: project(seq), seq, settings: settingsFor(seq, "hevc-match", { fileName: "greenscreen" }) };
    },
    expect: { duration: 4, video: { w: 1920, h: 1080, codec: "hevc" }, audio: { codec: "aac" }, tag: "hvc1" },
    frames: [1, 3],
  },
  {
    name: "transitions_prores",
    build: () => {
      const seq = makeSequence("Transitions", { width: 1280, height: 720, fps: 25 });
      vclip(seq, A.testsrc, 0, 0, 1, 4);
      vclip(seq, A.talk, 0, 4, 2, 4);
      vclip(seq, A.bars, 0, 8, 0, 4);
      addTransition(seq, V(seq, 0).id, 4, "crossDissolve", 1);
      addTransition(seq, V(seq, 0).id, 8, "wipeLeft", 1);
      addTransition(seq, V(seq, 0).id, 12, "dipToBlack", 1);
      aclip(seq, A.talk, 0, 4, 2, 4);
      aclip(seq, A.testsrc, 0, 0, 1, 4);
      addTransition(seq, Au(seq, 0).id, 8, "constantPower", 0.5);
      return { project: project(seq), seq, settings: settingsFor(seq, "prores-422hq", { fileName: "transitions" }) };
    },
    expect: { duration: 12, video: { w: 1280, h: 720, codec: "prores", fps: 25 }, audio: { codec: "pcm_s16le" } },
    frames: [2, 4.0, 8.0, 8.3, 11.6],
  },
  {
    name: "speed_reverse_h264",
    build: () => {
      const seq = makeSequence("Speed", { width: 1280, height: 720, fps: 30 });
      const fast = vclip(seq, A.testsrc, 0, 0, 0, 2); // 4s of source at 2x
      fast.speed = 2;
      const slow = vclip(seq, A.bars, 0, 2, 0, 4); // 2s of source at 0.5x
      slow.speed = 0.5;
      const rev = vclip(seq, A.testsrc, 0, 6, 2, 3);
      rev.reversed = true;
      const fa = aclip(seq, A.testsrc, 0, 0, 0, 2);
      fa.speed = 2;
      const ra = aclip(seq, A.testsrc, 0, 6, 2, 3);
      ra.reversed = true;
      return { project: project(seq), seq, settings: settingsFor(seq, "match-high", { fileName: "speed" }) };
    },
    expect: { duration: 9, video: { w: 1280, h: 720, codec: "h264" }, audio: { codec: "aac" } },
    frames: [0.5, 1.9, 3, 6.1, 8.9],
  },
  {
    name: "title_adjustment_nested_gif",
    build: () => {
      const inner = makeSequence("Inner", { width: 1280, height: 720, fps: 30 });
      vclip(inner, A.testsrc, 0, 0, 0, 3);
      const t = makeGeneratorClip({ kind: "text", style: defaultTextStyle("Hello") }, inner.settings, V(inner, 1).id, 0.5, 2.5);
      inner.clips.push(t);
      const png = path.join(OUT, "title_inner.png");
      makeTitlePNG(png, 1280, 720);
      const seq = makeSequence("Outer", { width: 1280, height: 720, fps: 30 });
      vclip(seq, A.bars, 0, 0, 0, 4);
      const nest: Clip = {
        id: "clp_nest", trackId: V(seq, 1).id, name: "Inner", sequenceId: inner.id, start: 0.5, duration: 3, sourceIn: 0, speed: 1,
        reversed: false, maintainPitch: true, enabled: true, effects: [], masks: [], markers: [],
        motion: fitMotion(seq.settings, 1280, 720, false), opacity: { opacity: { value: 100 }, blendMode: "normal" },
      };
      nest.motion!.scale = { value: 60 };
      nest.motion!.rotation = { value: 8 };
      seq.clips.push(nest);
      const adj = makeGeneratorClip({ kind: "adjustmentLayer" }, seq.settings, V(seq, 2).id, 2, 2);
      adj.effects.push(makeEffect("blackWhite"));
      seq.clips.push(adj);
      return { project: project(seq, [inner]), seq, settings: settingsFor(seq, "gif-480", { fileName: "nested" }), graphics: { [t.id]: png } };
    },
    expect: { duration: 4, video: { w: 480, h: 270, codec: "gif" }, audio: null },
    frames: [1, 2.5, 3.8],
  },
  {
    name: "audio_mix_wav",
    build: () => {
      const seq = makeSequence("Audio", { width: 1920, height: 1080, fps: 30 });
      aclip(seq, A.talk, 0, 0, 0, 8); // dialogue
      const m1 = aclip(seq, A.music, 1, 0, 0, 5);
      const m2 = aclip(seq, A.music, 1, 5, 8, 5);
      m1.audio!.volumeDb = kf([[0, 0], [1, -18], [4, -18], [5, -6]]); // ducking under dialogue
      addTransition(seq, Au(seq, 1).id, 5, "constantPower", 1);
      Au(seq, 1).volumeDb = -3;
      const eq = makeEffect("eq3");
      eq.params.low = { value: 4 };
      m2.effects.push(eq, makeEffect("reverb"));
      return { project: project(seq), seq, settings: settingsFor(seq, "wav-48k", { fileName: "mix" }) };
    },
    expect: { duration: 10, audio: { codec: "pcm_s16le", channels: 2 } },
  },
  {
    name: "inout_vertical_h264",
    build: () => {
      const seq = makeSequence("Vertical", { width: 1920, height: 1080, fps: 30 });
      vclip(seq, A.testsrc, 0, 0, 0, 10);
      aclip(seq, A.testsrc, 0, 0, 0, 10);
      const cap = makeTrack("caption", 1);
      seq.tracks.push(cap);
      const c = makeCaptionClip(cap.id, 3, 2, "Hello captions");
      seq.clips.push(c);
      const png = path.join(OUT, "caption.png");
      makeCaptionPNG(png, 1920, 1080);
      seq.inPoint = 2.5;
      seq.outPoint = 6;
      return { project: project(seq), seq, settings: settingsFor(seq, "tiktok-916", { fileName: "vertical", range: "inOut", burnCaptions: true, exportCaptionsSidecar: "srt" }), graphics: { [c.id]: png } };
    },
    expect: { duration: 3.5, video: { w: 1080, h: 1920, codec: "h264" }, audio: { codec: "aac" } },
    frames: [0.2, 1.0],
    check: (file) => {
      const srt = file.replace(/\.mp4$/, ".srt");
      if (!fs.existsSync(srt)) return "sidecar SRT missing";
      const txt = fs.readFileSync(srt, "utf8");
      return txt.includes("00:00:00,500 --> 00:00:02,500") && txt.includes("Hello captions") ? null : `bad SRT: ${txt}`;
    },
  },
  {
    name: "motion_mask_blend_h264",
    build: () => {
      const seq = makeSequence("Motion", { width: 1280, height: 720, fps: 30 });
      vclip(seq, A.talk, 0, 0, 0, 4);
      const spin = vclip(seq, A.bars, 1, 0, 0, 4, false);
      spin.motion!.rotation = kf([[0, 0], [4, 180]]);
      spin.motion!.scale = kf([[0, 20], [4, 60]]);
      spin.motion!.cropLeft = { value: 10 };
      const ph = vclip(seq, A.photo, 2, 0, 0, 4, false);
      ph.motion!.scale = { value: 30 };
      ph.motion!.positionX = { value: 1000 };
      ph.motion!.positionY = { value: 200 };
      ph.masks.push({ id: "m1", shape: "ellipse", points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }], feather: 30, expansion: 0, opacity: 100, inverted: false });
      ph.opacity!.blendMode = "screen";
      const mosaic = makeEffect("mosaic");
      mosaic.params.blocks = kf([[0, 2], [4, 60]]); // animated effect param
      ph.effects.push(mosaic);
      return { project: project(seq), seq, settings: settingsFor(seq, "match-high", { fileName: "motion", audioCodec: "none" }) };
    },
    expect: { duration: 4, video: { w: 1280, h: 720, codec: "h264" }, audio: null },
    frames: [0.5, 2, 3.8],
  },
  {
    name: "png_frame",
    build: () => {
      const seq = makeSequence("Still", { width: 1920, height: 1080, fps: 30 });
      vclip(seq, A.testsrc, 0, 0, 0, 5);
      const fx = makeEffect("sepia");
      seq.clips[0].effects.push(fx);
      seq.playhead = 2;
      return { project: project(seq), seq, settings: settingsFor(seq, "png-frame", { fileName: "frame" }) };
    },
    expect: { duration: 0, video: { w: 1920, h: 1080, codec: "png" }, audio: null },
  },
  {
    name: "podcast_loudnorm_mp3",
    build: () => {
      const seq = makeSequence("Podcast", { width: 1920, height: 1080, fps: 30 });
      aclip(seq, A.talk, 0, 0, 0, 6);
      return { project: project(seq), seq, settings: settingsFor(seq, "podcast-16", { fileName: "podcast" }) };
    },
    expect: { duration: 6, audio: { codec: "mp3" } },
    check: (file) => {
      const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr;
      const m = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(r);
      if (!m) return "could not measure loudness";
      const I = Number(m[1]);
      return Math.abs(I - -16) <= 1.5 ? null : `integrated loudness ${I} LUFS (want -16±1.5)`;
    },
  },
  {
    name: "vbr2_twopass_h264_effects",
    build: () => {
      const seq = makeSequence("TwoPass", { width: 1280, height: 720, fps: 24 });
      const c = vclip(seq, A.testsrc, 0, 0, 0, 3);
      for (const t of ["hueSaturation", "glow", "noise", "vignette", "invert", "posterize", "findEdges", "emboss", "mirror", "skew", "horizontalFlip", "directionalBlur", "sharpen", "tint", "threshold"]) {
        const e = makeEffect(t);
        e.enabled = ["mirror", "glow", "vignette", "skew", "tint"].includes(t); // a visible subset; others compile but are off
        c.effects.push(e);
      }
      const skew = c.effects.find((e) => e.type === "skew")!;
      skew.params.skewX = { value: 12 };
      return { project: project(seq), seq, settings: settingsFor(seq, "youtube-1080", { fileName: "twopass", width: 1280, height: 720 }) };
    },
    expect: { duration: 3, video: { w: 1280, h: 720, codec: "h264", fps: 24 }, audio: { codec: "aac" } },
    frames: [1.5],
  },
  {
    name: "all_effects_compile_vp9",
    build: () => {
      const seq = makeSequence("AllFx", { width: 640, height: 360, fps: 30 });
      const c = vclip(seq, A.testsrc, 0, 0, 0, 1);
      const a = aclip(seq, A.talk, 0, 0, 0, 1);
      for (const t of ["lumetri", "brightnessContrast", "hueSaturation", "gammaCorrection", "blackWhite", "tint", "sepia", "invert", "posterize", "threshold", "gaussianBlur", "directionalBlur", "sharpen", "unsharpMask", "noise", "mosaic", "findEdges", "emboss", "glow", "vignette", "horizontalFlip", "verticalFlip", "mirror", "skew", "lumaKey"]) {
        const e = makeEffect(t);
        if (t === "lumetri") e.options = { look: "Cinematic Teal-Orange" };
        if (t === "skew") e.params.skewY = { value: 5 };
        c.effects.push(e);
      }
      for (const t of ["audioGain", "dynamics", "hardLimiter", "eq3", "highpass", "lowpass", "denoise", "dehum", "deesser", "reverb", "delay", "pitchShifter", "invertPolarity", "fillLeftWithRight", "swapChannels"]) {
        const e = makeEffect(t);
        if (t === "pitchShifter") e.params.semitones = { value: 3 };
        a.effects.push(e);
      }
      return { project: project(seq), seq, settings: settingsFor(seq, "webm-vp9", { fileName: "allfx", width: 640, height: 360 }) };
    },
    expect: { duration: 1, video: { w: 640, h: 360, codec: "vp9" }, audio: { codec: "opus" } },
  },
  {
    name: "ntsc2997_hardware_h264",
    build: () => {
      const seq = makeSequence("NTSC", { width: 1280, height: 720, fps: 29.97 });
      vclip(seq, A.talk, 0, 0, 1, 3);
      vclip(seq, A.bars, 0, 3, 0, 2);
      addTransition(seq, V(seq, 0).id, 3, "slideLeft", 0.5);
      aclip(seq, A.talk, 0, 0, 1, 3);
      return { project: project(seq), seq, settings: settingsFor(seq, "match-high", { fileName: "ntsc_hw", hardwareEncoding: true }) };
    },
    expect: { duration: 5.005, video: { w: 1280, h: 720, codec: "h264", fps: 29.97 }, audio: { codec: "aac" } },
    frames: [3.0],
  },
  {
    name: "av1_aac_m4a",
    build: () => {
      const seq = makeSequence("AV1", { width: 640, height: 360, fps: 30 });
      vclip(seq, A.bars, 0, 0, 0, 2);
      aclip(seq, A.music, 0, 0, 0, 2);
      return { project: project(seq), seq, settings: settingsFor(seq, "av1-1080", { fileName: "av1", width: 640, height: 360 }) };
    },
    expect: { duration: 2, video: { w: 640, h: 360, codec: "av1" }, audio: { codec: "aac" } },
  },
];

// ------------------------------------------------------------ runner

async function main() {
  const filters = process.argv.slice(2);
  const queue = new ExportQueue({
    tmpRoot: path.join(OUT, "tmp"),
    defaultDirectory: () => OUT,
    resolveAssetPath: (a) => (fs.existsSync(a.path) ? a.path : null),
    broadcast: () => {},
  });
  const results: { name: string; ok: boolean; msg: string; secs: number; file?: string }[] = [];
  for (const t of tests) {
    if (filters.length && !filters.some((f) => t.name.includes(f))) continue;
    const t0 = Date.now();
    let file: string | undefined;
    try {
      const { project: p, seq, settings, graphics } = t.build();
      const ji = queue.enqueue(p, seq.id, { ...defaultExportSettings(seq), ...settings } as ExportSettings, graphics ?? {});
      const job: ExportJob = await ji.done;
      file = job.outputPath;
      if (job.status !== "done") throw new Error(`job ${job.status}: ${job.error}`);
      const info = probe(file);
      const errs: string[] = [];
      const vs = info.streams.filter((s) => s.codec_type === "video");
      const as = info.streams.filter((s) => s.codec_type === "audio");
      if (t.expect.video) {
        if (vs.length !== 1) errs.push(`video streams ${vs.length}`);
        const v = vs[0];
        if (v) {
          if (v.width !== t.expect.video.w || v.height !== t.expect.video.h) errs.push(`size ${v.width}x${v.height} != ${t.expect.video.w}x${t.expect.video.h}`);
          if (v.codec_name !== t.expect.video.codec) errs.push(`codec ${v.codec_name} != ${t.expect.video.codec}`);
          if (t.expect.video.fps) {
            const [n, d] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
            if (Math.abs(n / d - t.expect.video.fps) > 0.01) errs.push(`fps ${n / d}`);
          }
        }
      } else if (vs.length && t.expect.video === undefined && !/png$/.test(file)) errs.push(`unexpected video stream`);
      if (t.expect.audio) {
        if (as.length !== 1) errs.push(`audio streams ${as.length}`);
        else {
          if (as[0].codec_name !== t.expect.audio.codec) errs.push(`audio codec ${as[0].codec_name} != ${t.expect.audio.codec}`);
          if (t.expect.audio.channels && as[0].channels !== t.expect.audio.channels) errs.push(`channels ${as[0].channels}`);
        }
      } else if (t.expect.audio === null && as.length) errs.push(`unexpected audio stream`);
      if (t.expect.tag && vs[0]?.codec_tag_string !== t.expect.tag) errs.push(`tag ${vs[0]?.codec_tag_string} != ${t.expect.tag}`);
      let dur = Number(info.format.duration);
      if (t.expect.duration > 0) {
        const fps = t.expect.video?.fps ?? (vs[0] ? (() => { const [n, d] = (vs[0].r_frame_rate ?? "30/1").split("/").map(Number); return n / d; })() : 0);
        // per-stream durations: video must be within one frame; audio within one AAC/MP3 frame + priming
        const tol = fps ? 1 / Math.min(fps, 60) + 0.001 : 0.06;
        if (vs[0]?.duration) {
          const vd = Number(vs[0].duration);
          if (Math.abs(vd - t.expect.duration) > tol) errs.push(`video duration ${vd.toFixed(3)} != ${t.expect.duration}`);
        } else if (vs[0] && t.expect.video?.codec !== "gif") {
          if (Math.abs(dur - t.expect.duration) > tol + 0.05) errs.push(`duration ${dur.toFixed(3)} != ${t.expect.duration}`);
        } else if (t.expect.video?.codec === "gif" && Math.abs(dur - t.expect.duration) > 0.11) errs.push(`gif duration ${dur}`);
        if (as[0]?.duration) {
          const ad = Number(as[0].duration);
          if (Math.abs(ad - t.expect.duration) > 0.06) errs.push(`audio duration ${ad.toFixed(3)} != ${t.expect.duration}`);
        } else if (!vs.length && Math.abs(dur - t.expect.duration) > 0.06) errs.push(`duration ${dur.toFixed(3)} != ${t.expect.duration}`);
      }
      for (const ft of t.frames ?? []) {
        const fp = path.join(FRAMES, `${t.name}_${ft}.png`);
        execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", String(ft), "-i", file, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", fp]);
        if (!fs.existsSync(fp)) errs.push(`no frame at ${ft}`);
      }
      if (/png$/.test(file)) fs.copyFileSync(file, path.join(FRAMES, `${t.name}.png`));
      const c = t.check?.(file);
      if (c) errs.push(c);
      if (job.warnings?.length) console.log(`   warnings: ${job.warnings.join(" | ")}`);
      dur = Number(info.format.duration);
      results.push({ name: t.name, ok: errs.length === 0, msg: errs.join("; ") || `dur ${dur.toFixed(3)}s, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`, secs: (Date.now() - t0) / 1000, file });
    } catch (e) {
      results.push({ name: t.name, ok: false, msg: String((e as Error).message ?? e).slice(0, 1500), secs: (Date.now() - t0) / 1000, file });
    }
    const r = results[results.length - 1];
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(34)} ${r.secs.toFixed(1).padStart(5)}s  ${r.msg}`);
  }

  // cancel test: queue a long render then cancel it
  if (!filters.length || filters.some((f) => "cancel".includes(f))) {
    const seq = makeSequence("Cancel", { width: 1920, height: 1080, fps: 30 });
    vclip(seq, A.testsrc, 0, 0, 0, 10);
    const b = makeEffect("gaussianBlur");
    seq.clips[0].effects.push(b);
    const ji = queue.enqueue(project(seq), seq.id, { ...defaultExportSettings(seq), directory: OUT, fileName: "cancel" } as ExportSettings, {});
    await new Promise((r) => setTimeout(r, 1500));
    queue.cancel(ji.job.id);
    const job = await ji.done;
    const ok = job.status === "cancelled" && !fs.existsSync(job.outputPath);
    results.push({ name: "cancel", ok, msg: `status ${job.status}, partial removed: ${!fs.existsSync(job.outputPath)}`, secs: 0 });
    console.log(`${ok ? "PASS" : "FAIL"}  cancel                              status ${job.status}`);
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} passed. Outputs: ${OUT}  Frames: ${FRAMES}`);
  process.exit(pass === results.length ? 0 : 1);
}

void sequenceDuration;
main();
