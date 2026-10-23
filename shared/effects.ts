// Effect registry. Each effect declares its parameters (for UI + AI) and compiles
// its evaluated parameter values into renderer-agnostic PRIMITIVES. The browser
// preview (src/engine) and the ffmpeg exporter (server/export) each implement
// every primitive, so an effect only has to be defined once here.

import type { Effect, TransitionType } from "./types";
import { evalParam } from "./params";

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
}

export interface OptionDef {
  key: string;
  label: string;
  type: "color" | "select" | "boolean";
  default: string | boolean;
  choices?: string[];
}

export type EffectCategory =
  | "Lumetri" | "Adjust" | "Blur & Sharpen" | "Color Correction" | "Distort" | "Generate"
  | "Image Control" | "Keying" | "Noise & Grain" | "Perspective" | "Stylize" | "Transform"
  | "Amplitude & Compression" | "Filter & EQ" | "Noise Reduction" | "Reverb" | "Delay & Echo" | "Time & Pitch" | "Special";

export interface EffectDef {
  type: string;
  name: string;
  category: EffectCategory;
  kind: "video" | "audio";
  description: string;
  params: ParamDef[];
  options?: OptionDef[];
  /** Compile evaluated values into primitives (video) or audio primitives. */
  compile: (v: Record<string, number>, o: Record<string, string | boolean>) => Primitive[];
}

// ---------- Video primitives ----------
// All color values are normalized so that 0 means "no change" unless noted.
export type VideoPrimitive =
  | { op: "exposure"; stops: number } // multiply linear light by 2^stops
  | { op: "contrast"; amount: number } // -1..1 around mid grey 0.5
  | { op: "brightness"; amount: number } // -1..1 additive
  | { op: "gamma"; value: number } // 0.1..10, 1 = none
  | { op: "saturation"; factor: number } // 1 = none, 0 = grey
  | { op: "vibrance"; amount: number } // -1..1
  | { op: "temperature"; amount: number } // -1 (blue) .. 1 (orange)
  | { op: "tint"; amount: number } // -1 (green) .. 1 (magenta)
  | { op: "tones"; highlights: number; shadows: number; whites: number; blacks: number } // each -1..1
  | { op: "colorBalance"; shadows: [number, number, number]; midtones: [number, number, number]; highlights: [number, number, number] } // RGB offsets -1..1
  | { op: "hue"; degrees: number }
  | { op: "grayscale"; amount: number } // 0..1
  | { op: "sepia"; amount: number } // 0..1
  | { op: "invert"; amount: number } // 0..1
  | { op: "fade"; amount: number } // faded film: lift blacks 0..1
  | { op: "colorize"; color: string; amount: number } // tint toward color 0..1
  | { op: "posterize"; levels: number }
  | { op: "threshold"; level: number } // 0..1
  | { op: "blur"; radius: number; direction: "both" | "horizontal" | "vertical" } // px at sequence res
  | { op: "sharpen"; amount: number } // 0..5
  | { op: "noise"; amount: number } // 0..1
  | { op: "pixelate"; size: number } // px
  | { op: "vignette"; amount: number; midpoint: number; roundness: number; feather: number } // amount -1..1
  | { op: "chromaKey"; color: string; similarity: number; smoothness: number; spill: number } // 0..1
  | { op: "lumaKey"; threshold: number; cutoff: number }
  | { op: "flip"; horizontal: boolean; vertical: boolean }
  | { op: "mirror"; axis: "horizontal" | "vertical" } // mirror half of the image
  | { op: "edgeDetect"; amount: number }
  | { op: "emboss"; amount: number }
  | { op: "glow"; radius: number; intensity: number; threshold: number }
  | { op: "lut"; name: string; intensity: number }
  | { op: "transform"; skewX: number; skewY: number }; // extra 2D skew in degrees

// ---------- Audio primitives ----------
export type AudioPrimitive =
  | { op: "gain"; db: number }
  | { op: "highpass"; freq: number }
  | { op: "lowpass"; freq: number }
  | { op: "eq3"; lowDb: number; midDb: number; highDb: number; midFreq: number }
  | { op: "compressor"; thresholdDb: number; ratio: number; attackMs: number; releaseMs: number; makeupDb: number }
  | { op: "limiter"; ceilingDb: number }
  | { op: "denoise"; amount: number } // 0..1
  | { op: "dehum"; freq: 50 | 60 }
  | { op: "deess"; amount: number }
  | { op: "reverb"; mix: number; roomSize: number } // 0..1
  | { op: "delay"; timeMs: number; feedback: number; mix: number }
  | { op: "pitch"; semitones: number }
  | { op: "invertPolarity" }
  | { op: "monoToStereo" }
  | { op: "swapChannels" };

export type Primitive = VideoPrimitive | AudioPrimitive;

const n = (o: unknown, d: number) => (typeof o === "number" ? o : d);

export const EFFECTS: EffectDef[] = [
  // ---------------- Lumetri Color (single comprehensive effect) ----------------
  {
    type: "lumetri",
    name: "Lumetri Color",
    category: "Lumetri",
    kind: "video",
    description: "Full color grading: basic correction, creative look, color wheels, vignette.",
    params: [
      { key: "temperature", label: "Temperature", min: -100, max: 100, default: 0 },
      { key: "tint", label: "Tint", min: -100, max: 100, default: 0 },
      { key: "exposure", label: "Exposure", min: -5, max: 5, default: 0, step: 0.1 },
      { key: "contrast", label: "Contrast", min: -100, max: 100, default: 0 },
      { key: "highlights", label: "Highlights", min: -100, max: 100, default: 0 },
      { key: "shadows", label: "Shadows", min: -100, max: 100, default: 0 },
      { key: "whites", label: "Whites", min: -100, max: 100, default: 0 },
      { key: "blacks", label: "Blacks", min: -100, max: 100, default: 0 },
      { key: "saturation", label: "Saturation", min: 0, max: 200, default: 100 },
      { key: "fadedFilm", label: "Faded Film", min: 0, max: 100, default: 0 },
      { key: "sharpen", label: "Sharpen", min: -100, max: 100, default: 0 },
      { key: "vibrance", label: "Vibrance", min: -100, max: 100, default: 0 },
      { key: "creativeSaturation", label: "Creative Saturation", min: 0, max: 200, default: 100 },
      { key: "lookIntensity", label: "Look Intensity", min: 0, max: 200, default: 100 },
      // Color wheels as hue (deg) + amount (0..100) per range, plus luma offset
      { key: "shadowHue", label: "Shadows Hue", min: 0, max: 360, default: 0 },
      { key: "shadowAmount", label: "Shadows Amount", min: 0, max: 100, default: 0 },
      { key: "shadowLuma", label: "Shadows Luma", min: -100, max: 100, default: 0 },
      { key: "midHue", label: "Midtones Hue", min: 0, max: 360, default: 0 },
      { key: "midAmount", label: "Midtones Amount", min: 0, max: 100, default: 0 },
      { key: "midLuma", label: "Midtones Luma", min: -100, max: 100, default: 0 },
      { key: "highHue", label: "Highlights Hue", min: 0, max: 360, default: 0 },
      { key: "highAmount", label: "Highlights Amount", min: 0, max: 100, default: 0 },
      { key: "highLuma", label: "Highlights Luma", min: -100, max: 100, default: 0 },
      { key: "vignetteAmount", label: "Vignette Amount", min: -5, max: 5, default: 0, step: 0.1 },
      { key: "vignetteMidpoint", label: "Vignette Midpoint", min: 0, max: 100, default: 50 },
      { key: "vignetteRoundness", label: "Vignette Roundness", min: -100, max: 100, default: 0 },
      { key: "vignetteFeather", label: "Vignette Feather", min: 0, max: 100, default: 50 },
    ],
    options: [
      { key: "look", label: "Look", type: "select", default: "None", choices: ["None", "Cinematic Teal-Orange", "Warm Film", "Cool Night", "Bleach Bypass", "Vintage", "B&W High Contrast", "Kodak 2383", "Fuji Eterna", "Faded Pastel"] },
    ],
    compile: (v, o) => {
      const prims: VideoPrimitive[] = [];
      const wheel = (hue: number, amt: number, luma: number): [number, number, number] => {
        const a = (amt / 100) * 0.3;
        const h = (hue * Math.PI) / 180;
        const l = luma / 100 * 0.3;
        return [a * Math.cos(h) + l, a * Math.cos(h - (2 * Math.PI) / 3) + l, a * Math.cos(h + (2 * Math.PI) / 3) + l];
      };
      if (v.temperature) prims.push({ op: "temperature", amount: v.temperature / 100 });
      if (v.tint) prims.push({ op: "tint", amount: v.tint / 100 });
      if (v.exposure) prims.push({ op: "exposure", stops: v.exposure });
      if (v.contrast) prims.push({ op: "contrast", amount: v.contrast / 100 });
      if (v.highlights || v.shadows || v.whites || v.blacks)
        prims.push({ op: "tones", highlights: v.highlights / 100, shadows: v.shadows / 100, whites: v.whites / 100, blacks: v.blacks / 100 });
      if (v.saturation !== 100) prims.push({ op: "saturation", factor: v.saturation / 100 });
      const look = String(o.look ?? "None");
      if (look !== "None") prims.push({ op: "lut", name: look, intensity: v.lookIntensity / 100 });
      if (v.fadedFilm) prims.push({ op: "fade", amount: v.fadedFilm / 100 });
      if (v.vibrance) prims.push({ op: "vibrance", amount: v.vibrance / 100 });
      if (v.creativeSaturation !== 100) prims.push({ op: "saturation", factor: v.creativeSaturation / 100 });
      if (v.shadowAmount || v.midAmount || v.highAmount || v.shadowLuma || v.midLuma || v.highLuma)
        prims.push({
          op: "colorBalance",
          shadows: wheel(v.shadowHue, v.shadowAmount, v.shadowLuma),
          midtones: wheel(v.midHue, v.midAmount, v.midLuma),
          highlights: wheel(v.highHue, v.highAmount, v.highLuma),
        });
      if (v.sharpen > 0) prims.push({ op: "sharpen", amount: v.sharpen / 20 });
      if (v.sharpen < 0) prims.push({ op: "blur", radius: -v.sharpen / 25, direction: "both" });
      if (v.vignetteAmount)
        prims.push({ op: "vignette", amount: v.vignetteAmount / 5, midpoint: v.vignetteMidpoint / 100, roundness: v.vignetteRoundness / 100, feather: v.vignetteFeather / 100 });
      return prims;
    },
  },
  // ---------------- Adjust / Color ----------------
  { type: "brightnessContrast", name: "Brightness & Contrast", category: "Color Correction", kind: "video", description: "Simple brightness and contrast.",
    params: [ { key: "brightness", label: "Brightness", min: -100, max: 100, default: 0 }, { key: "contrast", label: "Contrast", min: -100, max: 100, default: 0 } ],
    compile: (v) => [ { op: "brightness", amount: v.brightness / 100 }, { op: "contrast", amount: v.contrast / 100 } ] },
  { type: "hueSaturation", name: "Hue/Saturation", category: "Color Correction", kind: "video", description: "Rotate hue, change saturation and lightness.",
    params: [ { key: "hue", label: "Hue", min: -180, max: 180, default: 0, unit: "°" }, { key: "saturation", label: "Saturation", min: 0, max: 200, default: 100 }, { key: "lightness", label: "Lightness", min: -100, max: 100, default: 0 } ],
    compile: (v) => [ { op: "hue", degrees: v.hue }, { op: "saturation", factor: v.saturation / 100 }, { op: "brightness", amount: v.lightness / 100 } ] },
  { type: "gammaCorrection", name: "Gamma Correction", category: "Image Control", kind: "video", description: "Adjust midtone gamma.",
    params: [ { key: "gamma", label: "Gamma", min: 1, max: 28, default: 10 } ], compile: (v) => [ { op: "gamma", value: 10 / v.gamma } ] },
  { type: "blackWhite", name: "Black & White", category: "Image Control", kind: "video", description: "Convert to grayscale.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 100 } ], compile: (v) => [ { op: "grayscale", amount: v.amount / 100 } ] },
  { type: "tint", name: "Tint", category: "Color Correction", kind: "video", description: "Tint the image toward a color.",
    params: [ { key: "amount", label: "Amount to Tint", min: 0, max: 100, default: 100 } ], options: [ { key: "color", label: "Map White To", type: "color", default: "#ffb070" } ],
    compile: (v, o) => [ { op: "colorize", color: String(o.color ?? "#ffb070"), amount: v.amount / 100 } ] },
  { type: "sepia", name: "Sepia", category: "Image Control", kind: "video", description: "Old-photo sepia tone.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 100 } ], compile: (v) => [ { op: "sepia", amount: v.amount / 100 } ] },
  { type: "invert", name: "Invert", category: "Image Control", kind: "video", description: "Invert colors.",
    params: [ { key: "blend", label: "Blend With Original", min: 0, max: 100, default: 0 } ], compile: (v) => [ { op: "invert", amount: 1 - v.blend / 100 } ] },
  { type: "posterize", name: "Posterize", category: "Stylize", kind: "video", description: "Reduce color levels.",
    params: [ { key: "levels", label: "Level", min: 2, max: 32, default: 6, step: 1 } ], compile: (v) => [ { op: "posterize", levels: Math.round(v.levels) } ] },
  { type: "threshold", name: "Threshold", category: "Stylize", kind: "video", description: "Pure black/white by luminance threshold.",
    params: [ { key: "level", label: "Level", min: 0, max: 255, default: 128 } ], compile: (v) => [ { op: "threshold", level: v.level / 255 } ] },
  // ---------------- Blur & Sharpen ----------------
  { type: "gaussianBlur", name: "Gaussian Blur", category: "Blur & Sharpen", kind: "video", description: "Smooth blur.",
    params: [ { key: "blurriness", label: "Blurriness", min: 0, max: 200, default: 20 } ],
    options: [ { key: "dimensions", label: "Blur Dimensions", type: "select", default: "both", choices: ["both", "horizontal", "vertical"] } ],
    compile: (v, o) => [ { op: "blur", radius: v.blurriness / 2, direction: (o.dimensions as "both") ?? "both" } ] },
  { type: "directionalBlur", name: "Directional Blur", category: "Blur & Sharpen", kind: "video", description: "Motion-style horizontal blur.",
    params: [ { key: "length", label: "Blur Length", min: 0, max: 200, default: 20 } ], compile: (v) => [ { op: "blur", radius: v.length / 2, direction: "horizontal" } ] },
  { type: "sharpen", name: "Sharpen", category: "Blur & Sharpen", kind: "video", description: "Increase edge contrast.",
    params: [ { key: "amount", label: "Sharpen Amount", min: 0, max: 100, default: 25 } ], compile: (v) => [ { op: "sharpen", amount: v.amount / 20 } ] },
  { type: "unsharpMask", name: "Unsharp Mask", category: "Blur & Sharpen", kind: "video", description: "Classic unsharp mask.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 500, default: 50 } ], compile: (v) => [ { op: "sharpen", amount: v.amount / 100 } ] },
  // ---------------- Stylize / Noise ----------------
  { type: "noise", name: "Noise", category: "Noise & Grain", kind: "video", description: "Film grain / noise.",
    params: [ { key: "amount", label: "Amount of Noise", min: 0, max: 100, default: 20 } ], compile: (v) => [ { op: "noise", amount: v.amount / 100 } ] },
  { type: "mosaic", name: "Mosaic", category: "Stylize", kind: "video", description: "Pixelate into blocks.",
    params: [ { key: "blocks", label: "Block Size", min: 2, max: 200, default: 20 } ], compile: (v) => [ { op: "pixelate", size: v.blocks } ] },
  { type: "findEdges", name: "Find Edges", category: "Stylize", kind: "video", description: "Edge detection.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 100 } ], compile: (v) => [ { op: "edgeDetect", amount: v.amount / 100 } ] },
  { type: "emboss", name: "Emboss", category: "Stylize", kind: "video", description: "Embossed relief look.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 100 } ], compile: (v) => [ { op: "emboss", amount: v.amount / 100 } ] },
  { type: "glow", name: "Glow", category: "Stylize", kind: "video", description: "Bloom bright areas.",
    params: [ { key: "radius", label: "Radius", min: 0, max: 100, default: 20 }, { key: "intensity", label: "Intensity", min: 0, max: 400, default: 100 }, { key: "threshold", label: "Threshold", min: 0, max: 100, default: 60 } ],
    compile: (v) => [ { op: "glow", radius: v.radius, intensity: v.intensity / 100, threshold: v.threshold / 100 } ] },
  { type: "vignette", name: "Vignette", category: "Stylize", kind: "video", description: "Darken (or lighten) edges.",
    params: [ { key: "amount", label: "Amount", min: -100, max: 100, default: -50 }, { key: "midpoint", label: "Midpoint", min: 0, max: 100, default: 50 }, { key: "feather", label: "Feather", min: 0, max: 100, default: 50 } ],
    compile: (v) => [ { op: "vignette", amount: v.amount / 100, midpoint: v.midpoint / 100, roundness: 0, feather: v.feather / 100 } ] },
  // ---------------- Transform / Distort ----------------
  { type: "horizontalFlip", name: "Horizontal Flip", category: "Transform", kind: "video", description: "Flip left-right.", params: [], compile: () => [ { op: "flip", horizontal: true, vertical: false } ] },
  { type: "verticalFlip", name: "Vertical Flip", category: "Transform", kind: "video", description: "Flip upside down.", params: [], compile: () => [ { op: "flip", horizontal: false, vertical: true } ] },
  { type: "mirror", name: "Mirror", category: "Distort", kind: "video", description: "Mirror one half of the frame.", params: [],
    options: [ { key: "axis", label: "Axis", type: "select", default: "horizontal", choices: ["horizontal", "vertical"] } ], compile: (_v, o) => [ { op: "mirror", axis: (o.axis as "horizontal") ?? "horizontal" } ] },
  { type: "skew", name: "Transform (Skew)", category: "Distort", kind: "video", description: "Skew the image.",
    params: [ { key: "skewX", label: "Skew X", min: -70, max: 70, default: 0, unit: "°" }, { key: "skewY", label: "Skew Y", min: -70, max: 70, default: 0, unit: "°" } ],
    compile: (v) => [ { op: "transform", skewX: v.skewX, skewY: v.skewY } ] },
  // ---------------- Keying ----------------
  { type: "ultraKey", name: "Ultra Key", category: "Keying", kind: "video", description: "Chroma key (green/blue screen) with spill suppression.",
    params: [ { key: "similarity", label: "Similarity", min: 0, max: 100, default: 35 }, { key: "smoothness", label: "Smoothness", min: 0, max: 100, default: 10 }, { key: "spill", label: "Spill Suppression", min: 0, max: 100, default: 50 } ],
    options: [ { key: "keyColor", label: "Key Color", type: "color", default: "#00ff00" } ],
    compile: (v, o) => [ { op: "chromaKey", color: String(o.keyColor ?? "#00ff00"), similarity: v.similarity / 100, smoothness: v.smoothness / 100, spill: v.spill / 100 } ] },
  { type: "lumaKey", name: "Luma Key", category: "Keying", kind: "video", description: "Key out dark areas.",
    params: [ { key: "threshold", label: "Threshold", min: 0, max: 100, default: 10 }, { key: "cutoff", label: "Cutoff", min: 0, max: 100, default: 0 } ],
    compile: (v) => [ { op: "lumaKey", threshold: v.threshold / 100, cutoff: v.cutoff / 100 } ] },

  // ================= AUDIO =================
  { type: "audioGain", name: "Amplify", category: "Amplitude & Compression", kind: "audio", description: "Boost or cut level.",
    params: [ { key: "db", label: "Gain", min: -48, max: 24, default: 0, unit: "dB" } ], compile: (v) => [ { op: "gain", db: v.db } ] },
  { type: "dynamics", name: "Dynamics Processing", category: "Amplitude & Compression", kind: "audio", description: "Compressor.",
    params: [ { key: "threshold", label: "Threshold", min: -60, max: 0, default: -20, unit: "dB" }, { key: "ratio", label: "Ratio", min: 1, max: 20, default: 4 }, { key: "attack", label: "Attack", min: 0.1, max: 200, default: 10, unit: "ms" }, { key: "release", label: "Release", min: 10, max: 2000, default: 100, unit: "ms" }, { key: "makeup", label: "Make-up Gain", min: 0, max: 24, default: 0, unit: "dB" } ],
    compile: (v) => [ { op: "compressor", thresholdDb: v.threshold, ratio: v.ratio, attackMs: v.attack, releaseMs: v.release, makeupDb: v.makeup } ] },
  { type: "hardLimiter", name: "Hard Limiter", category: "Amplitude & Compression", kind: "audio", description: "Brick-wall limiter.",
    params: [ { key: "ceiling", label: "Maximum Amplitude", min: -24, max: 0, default: -1, unit: "dB" } ], compile: (v) => [ { op: "limiter", ceilingDb: v.ceiling } ] },
  { type: "eq3", name: "Simple EQ", category: "Filter & EQ", kind: "audio", description: "3-band EQ.",
    params: [ { key: "low", label: "Low", min: -24, max: 24, default: 0, unit: "dB" }, { key: "mid", label: "Mid", min: -24, max: 24, default: 0, unit: "dB" }, { key: "midFreq", label: "Mid Freq", min: 200, max: 8000, default: 1000, unit: "Hz" }, { key: "high", label: "High", min: -24, max: 24, default: 0, unit: "dB" } ],
    compile: (v) => [ { op: "eq3", lowDb: v.low, midDb: v.mid, highDb: v.high, midFreq: v.midFreq } ] },
  { type: "highpass", name: "Highpass", category: "Filter & EQ", kind: "audio", description: "Remove low rumble.",
    params: [ { key: "freq", label: "Cutoff", min: 20, max: 2000, default: 80, unit: "Hz" } ], compile: (v) => [ { op: "highpass", freq: v.freq } ] },
  { type: "lowpass", name: "Lowpass", category: "Filter & EQ", kind: "audio", description: "Remove high frequencies.",
    params: [ { key: "freq", label: "Cutoff", min: 200, max: 20000, default: 8000, unit: "Hz" } ], compile: (v) => [ { op: "lowpass", freq: v.freq } ] },
  { type: "denoise", name: "DeNoise", category: "Noise Reduction", kind: "audio", description: "Reduce broadband noise.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 40 } ], compile: (v) => [ { op: "denoise", amount: v.amount / 100 } ] },
  { type: "dehum", name: "DeHummer", category: "Noise Reduction", kind: "audio", description: "Remove mains hum.",
    params: [], options: [ { key: "freq", label: "Frequency", type: "select", default: "60", choices: ["50", "60"] } ], compile: (_v, o) => [ { op: "dehum", freq: o.freq === "50" ? 50 : 60 } ] },
  { type: "deesser", name: "DeEsser", category: "Noise Reduction", kind: "audio", description: "Tame harsh sibilance.",
    params: [ { key: "amount", label: "Amount", min: 0, max: 100, default: 50 } ], compile: (v) => [ { op: "deess", amount: v.amount / 100 } ] },
  { type: "reverb", name: "Studio Reverb", category: "Reverb", kind: "audio", description: "Room reverb.",
    params: [ { key: "mix", label: "Mix", min: 0, max: 100, default: 30 }, { key: "room", label: "Room Size", min: 0, max: 100, default: 50 } ], compile: (v) => [ { op: "reverb", mix: v.mix / 100, roomSize: v.room / 100 } ] },
  { type: "delay", name: "Delay", category: "Delay & Echo", kind: "audio", description: "Echo.",
    params: [ { key: "time", label: "Delay Time", min: 10, max: 2000, default: 300, unit: "ms" }, { key: "feedback", label: "Feedback", min: 0, max: 90, default: 30 }, { key: "mix", label: "Mix", min: 0, max: 100, default: 30 } ],
    compile: (v) => [ { op: "delay", timeMs: v.time, feedback: v.feedback / 100, mix: v.mix / 100 } ] },
  { type: "pitchShifter", name: "Pitch Shifter", category: "Time & Pitch", kind: "audio", description: "Shift pitch.",
    params: [ { key: "semitones", label: "Semitones", min: -12, max: 12, default: 0, step: 1 } ], compile: (v) => [ { op: "pitch", semitones: v.semitones } ] },
  { type: "invertPolarity", name: "Invert (Polarity)", category: "Special", kind: "audio", description: "Invert waveform polarity.", params: [], compile: () => [ { op: "invertPolarity" } ] },
  { type: "fillLeftWithRight", name: "Mono → Stereo", category: "Special", kind: "audio", description: "Duplicate mono to both channels.", params: [], compile: () => [ { op: "monoToStereo" } ] },
  { type: "swapChannels", name: "Swap Channels", category: "Special", kind: "audio", description: "Swap left and right.", params: [], compile: () => [ { op: "swapChannels" } ] },
];

export const EFFECT_MAP: Record<string, EffectDef> = Object.fromEntries(EFFECTS.map((e) => [e.type, e]));

/** Evaluate all params of an effect at clip-local time t and compile to primitives. */
export function compileEffect(effect: Effect, t: number): Primitive[] {
  const def = EFFECT_MAP[effect.type];
  if (!def || !effect.enabled) return [];
  const values: Record<string, number> = {};
  for (const pd of def.params) values[pd.key] = evalParam(effect.params[pd.key], t, pd.default);
  const opts: Record<string, string | boolean> = {};
  for (const od of def.options ?? []) opts[od.key] = effect.options?.[od.key] ?? od.default;
  return def.compile(values, opts);
}

export function isVideoPrimitive(p: Primitive): p is VideoPrimitive {
  return !AUDIO_OPS.has(p.op);
}
const AUDIO_OPS = new Set(["gain", "highpass", "lowpass", "eq3", "compressor", "limiter", "denoise", "dehum", "deess", "reverb", "delay", "pitch", "invertPolarity", "monoToStereo", "swapChannels"]);

// Built-in "looks" used by the lumetri `lut` primitive: simple parametric approximations
// so both renderers can implement them without LUT files.
export const LOOKS: Record<string, VideoPrimitive[]> = {
  "Cinematic Teal-Orange": [ { op: "colorBalance", shadows: [-0.06, 0.02, 0.08], midtones: [0.02, 0, -0.02], highlights: [0.08, 0.03, -0.05] }, { op: "contrast", amount: 0.15 }, { op: "saturation", factor: 1.1 } ],
  "Warm Film": [ { op: "temperature", amount: 0.3 }, { op: "fade", amount: 0.12 }, { op: "contrast", amount: 0.1 } ],
  "Cool Night": [ { op: "temperature", amount: -0.4 }, { op: "exposure", stops: -0.4 }, { op: "saturation", factor: 0.8 } ],
  "Bleach Bypass": [ { op: "saturation", factor: 0.45 }, { op: "contrast", amount: 0.35 } ],
  "Vintage": [ { op: "sepia", amount: 0.35 }, { op: "fade", amount: 0.2 }, { op: "vignette", amount: -0.3, midpoint: 0.5, roundness: 0, feather: 0.6 } ],
  "B&W High Contrast": [ { op: "grayscale", amount: 1 }, { op: "contrast", amount: 0.45 } ],
  "Kodak 2383": [ { op: "colorBalance", shadows: [0, 0.02, 0.05], midtones: [0.03, 0.01, -0.02], highlights: [0.05, 0.03, 0] }, { op: "contrast", amount: 0.2 }, { op: "saturation", factor: 1.05 } ],
  "Fuji Eterna": [ { op: "saturation", factor: 0.8 }, { op: "contrast", amount: -0.05 }, { op: "colorBalance", shadows: [0, 0.03, 0.03], midtones: [0, 0.01, 0], highlights: [0.02, 0.02, 0] } ],
  "Faded Pastel": [ { op: "fade", amount: 0.3 }, { op: "saturation", factor: 0.75 }, { op: "exposure", stops: 0.2 } ],
};

// ---------- Transitions ----------
export interface TransitionDef {
  type: TransitionType;
  name: string;
  category: "Dissolve" | "Wipe" | "Slide" | "Iris" | "Zoom" | "3D Motion" | "Audio Crossfade";
  kind: "video" | "audio";
  /** Equivalent ffmpeg xfade transition name (video) or acrossfade curve (audio). */
  ffmpeg: string;
}

export const TRANSITIONS: TransitionDef[] = [
  { type: "crossDissolve", name: "Cross Dissolve", category: "Dissolve", kind: "video", ffmpeg: "fade" },
  { type: "dipToBlack", name: "Dip to Black", category: "Dissolve", kind: "video", ffmpeg: "fadeblack" },
  { type: "dipToWhite", name: "Dip to White", category: "Dissolve", kind: "video", ffmpeg: "fadewhite" },
  { type: "filmDissolve", name: "Film Dissolve", category: "Dissolve", kind: "video", ffmpeg: "fadegrays" },
  { type: "additiveDissolve", name: "Additive Dissolve", category: "Dissolve", kind: "video", ffmpeg: "dissolve" },
  { type: "wipeLeft", name: "Wipe Left", category: "Wipe", kind: "video", ffmpeg: "wipeleft" },
  { type: "wipeRight", name: "Wipe Right", category: "Wipe", kind: "video", ffmpeg: "wiperight" },
  { type: "wipeUp", name: "Wipe Up", category: "Wipe", kind: "video", ffmpeg: "wipeup" },
  { type: "wipeDown", name: "Wipe Down", category: "Wipe", kind: "video", ffmpeg: "wipedown" },
  { type: "barnDoors", name: "Barn Doors", category: "Wipe", kind: "video", ffmpeg: "vertopen" },
  { type: "slideLeft", name: "Slide Left", category: "Slide", kind: "video", ffmpeg: "slideleft" },
  { type: "slideRight", name: "Slide Right", category: "Slide", kind: "video", ffmpeg: "slideright" },
  { type: "slideUp", name: "Slide Up", category: "Slide", kind: "video", ffmpeg: "slideup" },
  { type: "slideDown", name: "Slide Down", category: "Slide", kind: "video", ffmpeg: "slidedown" },
  { type: "pushLeft", name: "Push Left", category: "Slide", kind: "video", ffmpeg: "smoothleft" },
  { type: "pushRight", name: "Push Right", category: "Slide", kind: "video", ffmpeg: "smoothright" },
  { type: "pushUp", name: "Push Up", category: "Slide", kind: "video", ffmpeg: "smoothup" },
  { type: "pushDown", name: "Push Down", category: "Slide", kind: "video", ffmpeg: "smoothdown" },
  { type: "irisRound", name: "Iris Round", category: "Iris", kind: "video", ffmpeg: "circleopen" },
  { type: "irisBox", name: "Iris Box", category: "Iris", kind: "video", ffmpeg: "rectcrop" },
  { type: "zoomIn", name: "Cross Zoom", category: "Zoom", kind: "video", ffmpeg: "zoomin" },
  { type: "zoomOut", name: "Zoom Out", category: "Zoom", kind: "video", ffmpeg: "fade" },
  { type: "crossZoom", name: "Cross Zoom Blur", category: "Zoom", kind: "video", ffmpeg: "zoomin" },
  { type: "whip", name: "Whip Pan", category: "3D Motion", kind: "video", ffmpeg: "hblur" },
  { type: "constantPower", name: "Constant Power", category: "Audio Crossfade", kind: "audio", ffmpeg: "qsin" },
  { type: "constantGain", name: "Constant Gain", category: "Audio Crossfade", kind: "audio", ffmpeg: "tri" },
  { type: "exponentialFade", name: "Exponential Fade", category: "Audio Crossfade", kind: "audio", ffmpeg: "exp" },
];

export const TRANSITION_MAP = Object.fromEntries(TRANSITIONS.map((t) => [t.type, t])) as Record<TransitionType, TransitionDef>;
