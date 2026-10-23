// Maps every AudioPrimitive (shared/effects.ts) to ffmpeg audio filters.
// Streams are stereo float at the project sample rate when these run.
import type { AudioPrimitive } from "../../shared/effects";
import { num } from "./expr";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lin = (db: number) => Math.pow(10, db / 20);

/** atempo chain for an arbitrary factor (each stage kept within 0.5..2 for quality). */
export function atempoChain(factor: number): string[] {
  const out: string[] = [];
  let f = factor;
  if (!Number.isFinite(f) || f <= 0) return out;
  while (f > 2) {
    out.push("atempo=2");
    f /= 2;
  }
  while (f < 0.5) {
    out.push("atempo=0.5");
    f /= 0.5;
  }
  if (Math.abs(f - 1) > 1e-6) out.push(`atempo=${num(f, 6)}`);
  return out;
}

export function audioPrimFilters(p: AudioPrimitive, sampleRate: number): string[] {
  switch (p.op) {
    case "gain":
      return p.db ? [`volume=${num(p.db)}dB`] : [];
    case "highpass":
      return [`highpass=f=${num(clamp(p.freq, 10, sampleRate / 2 - 100))}`];
    case "lowpass":
      return [`lowpass=f=${num(clamp(p.freq, 20, sampleRate / 2 - 100))}`];
    case "eq3": {
      const f: string[] = [];
      if (p.lowDb) f.push(`bass=g=${num(p.lowDb)}:f=120:width_type=s:w=0.7`);
      if (p.midDb) f.push(`equalizer=f=${num(clamp(p.midFreq, 40, 16000))}:width_type=o:w=1.2:g=${num(p.midDb)}`);
      if (p.highDb) f.push(`treble=g=${num(p.highDb)}:f=6000:width_type=s:w=0.7`);
      return f;
    }
    case "compressor":
      return [
        `acompressor=threshold=${num(clamp(lin(p.thresholdDb), 0.000976563, 1))}:ratio=${num(clamp(p.ratio, 1, 20))}:attack=${num(clamp(p.attackMs, 0.01, 2000))}:release=${num(clamp(p.releaseMs, 0.01, 9000))}:makeup=${num(clamp(lin(p.makeupDb), 1, 64))}`,
      ];
    case "limiter":
      return [`alimiter=limit=${num(clamp(lin(p.ceilingDb), 0.0625, 1))}:level=0:attack=5:release=50`];
    case "denoise": {
      const a = clamp(p.amount, 0, 1);
      return a > 0.005 ? [`afftdn=nr=${num(6 + a * 30)}:nf=-45:tn=1`] : [];
    }
    case "dehum":
      return [1, 2, 3, 4].map((k) => `bandreject=f=${p.freq * k}:width_type=h:w=${3 + k}`);
    case "deess": {
      const a = clamp(p.amount, 0, 1);
      return a > 0.005 ? [`deesser=i=${num(a)}:m=0.5:f=0.5:s=o`] : [];
    }
    case "reverb": {
      const mix = clamp(p.mix, 0, 1);
      if (mix < 0.005) return [];
      const room = clamp(p.roomSize, 0, 1);
      const base = 25 + room * 70;
      const delays = [base, base * 1.7, base * 2.6, base * 3.9].map((d) => num(d, 1));
      const decays = [0.5, 0.36, 0.25, 0.16].map((d) => num(d * mix * (0.7 + room * 0.6), 3));
      return [`aecho=in_gain=1:out_gain=${num(1 - mix * 0.35, 3)}:delays=${delays.join("|")}:decays=${decays.join("|")}`];
    }
    case "delay": {
      const mix = clamp(p.mix, 0, 1);
      if (mix < 0.005) return [];
      const fb = clamp(p.feedback, 0, 0.9);
      const taps = [1, 2, 3, 4].filter((k) => k === 1 || Math.pow(fb, k - 1) > 0.05);
      const delays = taps.map((k) => num(clamp(p.timeMs * k, 1, 90000), 1));
      const decays = taps.map((k) => num(mix * Math.pow(fb, k - 1), 3));
      return [`aecho=in_gain=1:out_gain=1:delays=${delays.join("|")}:decays=${decays.join("|")}`];
    }
    case "pitch": {
      if (!p.semitones) return [];
      const r = Math.pow(2, p.semitones / 12);
      return [`asetrate=${Math.round(sampleRate * r)}`, `aresample=${sampleRate}`, ...atempoChain(1 / r)];
    }
    case "invertPolarity":
      return ["aeval=exprs='-val(0)|-val(1)':channel_layout=stereo"];
    case "monoToStereo":
      return ["pan=stereo|c0=c0|c1=c0"];
    case "swapChannels":
      return ["pan=stereo|c0=c1|c1=c0"];
  }
}
