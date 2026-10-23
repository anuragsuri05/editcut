// Web Audio playback graph:
//   <audio> per clip → MediaElementSource → clip gain (volume keyframes × transition fade)
//   → clip pan → AudioPrimitive effect chain → track bus (fader, pan, mute/solo, meter)
//   → program master (sequence.masterVolumeDb) → output bus → channel solo → destination
//   The Source Monitor element joins the output bus directly. Meters read the output bus.
import type { Clip, MediaAsset, Project, Sequence } from "@shared/types";
import { compileEffect, isVideoPrimitive, type AudioPrimitive } from "@shared/effects";
import { evalParam } from "@shared/params";
import { usePlayback } from "../store/playback";
import { mediaUrl } from "./media";
import { audioTransitionGain, clipPlayRange, dbToGain, sourceTimeUnclamped, trackAudible } from "./timing";
import { clipEnd } from "@shared/ops";

// ---------------------------------------------------------------- effect chain

interface FxNode {
  input: AudioNode;
  output: AudioNode;
  update: (p: AudioPrimitive) => void;
}

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

const setP = (p: AudioParam, v: number, ctx: BaseAudioContext) => {
  if (!Number.isFinite(v)) return;
  if (Math.abs(p.value - v) > 1e-4) p.setTargetAtTime(v, ctx.currentTime, 0.01);
};

function makeFx(ctx: AudioContext, prim: AudioPrimitive): FxNode {
  const gainNode = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const biquad = (type: BiquadFilterType, f: number, q = 0.707, gain = 0) => {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain;
    return b;
  };
  switch (prim.op) {
    case "gain": {
      const g = gainNode(dbToGain(prim.db));
      return { input: g, output: g, update: (p) => p.op === "gain" && setP(g.gain, dbToGain(p.db), ctx) };
    }
    case "highpass":
    case "lowpass": {
      const b = biquad(prim.op, prim.freq);
      return { input: b, output: b, update: (p) => (p.op === "highpass" || p.op === "lowpass") && setP(b.frequency, p.freq, ctx) };
    }
    case "eq3": {
      const lo = biquad("lowshelf", 200, 0.707, prim.lowDb);
      const mid = biquad("peaking", prim.midFreq, 1, prim.midDb);
      const hi = biquad("highshelf", 5000, 0.707, prim.highDb);
      lo.connect(mid).connect(hi);
      return {
        input: lo, output: hi,
        update: (p) => {
          if (p.op !== "eq3") return;
          setP(lo.gain, p.lowDb, ctx); setP(mid.gain, p.midDb, ctx); setP(mid.frequency, p.midFreq, ctx); setP(hi.gain, p.highDb, ctx);
        },
      };
    }
    case "compressor": {
      const c = ctx.createDynamicsCompressor();
      const mk = gainNode();
      c.connect(mk);
      const upd = (p: AudioPrimitive) => {
        if (p.op !== "compressor") return;
        setP(c.threshold, Math.max(-100, Math.min(0, p.thresholdDb)), ctx);
        setP(c.ratio, Math.max(1, Math.min(20, p.ratio)), ctx);
        setP(c.attack, Math.max(0, Math.min(1, p.attackMs / 1000)), ctx);
        setP(c.release, Math.max(0, Math.min(1, p.releaseMs / 1000)), ctx);
        setP(mk.gain, dbToGain(p.makeupDb), ctx);
      };
      c.knee.value = 6;
      upd(prim);
      return { input: c, output: mk, update: upd };
    }
    case "limiter": {
      const c = ctx.createDynamicsCompressor();
      c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.05;
      c.threshold.value = prim.ceilingDb;
      return { input: c, output: c, update: (p) => p.op === "limiter" && setP(c.threshold, p.ceilingDb, ctx) };
    }
    case "denoise": {
      const hp = biquad("highpass", 70);
      const lp = biquad("lowpass", 12000 - prim.amount * 6000);
      hp.connect(lp);
      return { input: hp, output: lp, update: (p) => p.op === "denoise" && setP(lp.frequency, 12000 - p.amount * 6000, ctx) };
    }
    case "dehum": {
      const n1 = biquad("notch", prim.freq, 30), n2 = biquad("notch", prim.freq * 2, 30), n3 = biquad("notch", prim.freq * 3, 30);
      n1.connect(n2).connect(n3);
      return {
        input: n1, output: n3,
        update: (p) => {
          if (p.op !== "dehum") return;
          setP(n1.frequency, p.freq, ctx); setP(n2.frequency, p.freq * 2, ctx); setP(n3.frequency, p.freq * 3, ctx);
        },
      };
    }
    case "deess": {
      const b = biquad("peaking", 6500, 2, -prim.amount * 12);
      return { input: b, output: b, update: (p) => p.op === "deess" && setP(b.gain, -p.amount * 12, ctx) };
    }
    case "reverb": {
      const input = gainNode(), out = gainNode(), dry = gainNode(1 - prim.mix * 0.5), wet = gainNode(prim.mix);
      const conv = ctx.createConvolver();
      let room = prim.roomSize;
      conv.buffer = impulse(ctx, 0.4 + room * 3);
      input.connect(dry).connect(out);
      input.connect(conv).connect(wet).connect(out);
      return {
        input, output: out,
        update: (p) => {
          if (p.op !== "reverb") return;
          setP(dry.gain, 1 - p.mix * 0.5, ctx); setP(wet.gain, p.mix, ctx);
          if (Math.abs(p.roomSize - room) > 0.05) { room = p.roomSize; conv.buffer = impulse(ctx, 0.4 + room * 3); }
        },
      };
    }
    case "delay": {
      const input = gainNode(), out = gainNode(), dry = gainNode(1), wet = gainNode(prim.mix), fb = gainNode(Math.min(0.95, prim.feedback));
      const d = ctx.createDelay(2.5);
      d.delayTime.value = prim.timeMs / 1000;
      input.connect(dry).connect(out);
      input.connect(d);
      d.connect(fb).connect(d);
      d.connect(wet).connect(out);
      return {
        input, output: out,
        update: (p) => {
          if (p.op !== "delay") return;
          setP(d.delayTime, Math.min(2.5, p.timeMs / 1000), ctx); setP(fb.gain, Math.min(0.95, p.feedback), ctx); setP(wet.gain, p.mix, ctx);
        },
      };
    }
    case "invertPolarity": {
      const g = gainNode(-1);
      return { input: g, output: g, update: () => {} };
    }
    case "swapChannels":
    case "monoToStereo": {
      const split = ctx.createChannelSplitter(2);
      const merge = ctx.createChannelMerger(2);
      if (prim.op === "swapChannels") { split.connect(merge, 0, 1); split.connect(merge, 1, 0); }
      else { split.connect(merge, 0, 0); split.connect(merge, 0, 1); }
      return { input: split, output: merge, update: () => {} };
    }
    case "pitch":
    default: {
      // Pitch shifting needs an AudioWorklet; passthrough in preview.
      const g = gainNode();
      return { input: g, output: g, update: () => {} };
    }
  }
}

class FxChain {
  readonly input: GainNode;
  readonly output: GainNode;
  private nodes: FxNode[] = [];
  sig = "";
  constructor(private ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.input.connect(this.output);
  }
  set(prims: AudioPrimitive[]): void {
    const sig = prims.map((p) => p.op + (p.op === "dehum" ? p.freq : "")).join(",");
    if (sig !== this.sig) {
      this.input.disconnect();
      for (const n of this.nodes) { try { n.output.disconnect(); } catch { /* */ } }
      this.nodes = prims.map((p) => makeFx(this.ctx, p));
      let prev: AudioNode = this.input;
      for (const n of this.nodes) { prev.connect(n.input); prev = n.output; }
      prev.connect(this.output);
      this.sig = sig;
    } else prims.forEach((p, i) => this.nodes[i]?.update(p));
  }
}

// ---------------------------------------------------------------- voices & buses

interface Voice {
  key: string;
  el: HTMLAudioElement;
  url: string;
  src: MediaElementAudioSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  fx: FxChain;
  bus: string;
  lastUsed: number;
  lastSeekAt: number;
}

interface Bus {
  input: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
}

export interface AudioNeed {
  key: string;
  clip: Clip;
  asset: MediaAsset;
  seq: Sequence;
  /** Bus id (track id) or "master". */
  bus: string;
  active: boolean;
  target: number;
  /** Timeline time inside `seq` (for keyframes / fades). */
  t: number;
  rateMul: number;
}

/** Audio clips needed around time t (recursing into nested sequences placed on video tracks). */
export function collectAudioNeeds(project: Project, seq: Sequence, t: number, lookahead: number, out: AudioNeed[] = [], prefix = "", bus?: string, rateMul = 1, depth = 0): AudioNeed[] {
  if (depth > 4) return out;
  for (const track of seq.tracks) {
    if (track.kind !== "audio") continue;
    for (const clip of seq.clips) {
      if (clip.trackId !== track.id || !clip.enabled || !clip.assetId) continue;
      const asset = project.media[clip.assetId];
      if (!asset || !asset.hasAudio || asset.status === "error") continue;
      const [s, e] = clipPlayRange(seq, clip);
      const active = t >= s && t < e;
      if (!active && !(t < s && s - t <= lookahead)) continue;
      out.push({
        key: prefix + clip.id, clip, asset, seq, bus: bus ?? track.id, active,
        target: sourceTimeUnclamped(clip, active ? t : s, asset.duration), t, rateMul,
      });
    }
  }
  for (const clip of seq.clips) {
    if (!clip.sequenceId || !clip.enabled) continue;
    const nested = project.sequences[clip.sequenceId];
    if (!nested || nested.id === seq.id) continue;
    if (t < clip.start - lookahead || t >= clipEnd(clip)) continue;
    const tn = sourceTimeUnclamped(clip, Math.max(t, clip.start));
    collectAudioNeeds(project, nested, tn, lookahead, out, prefix + clip.id + "/", bus ?? "master", rateMul * clip.speed * (clip.reversed ? -1 : 1), depth + 1);
  }
  return out;
}

export interface MeterState {
  left: number; right: number; peakLeft: number; peakRight: number;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private programMaster!: GainNode;
  private outBus!: GainNode;
  private splitter!: ChannelSplitterNode;
  private chGain: GainNode[] = [];
  private analysers: AnalyserNode[] = [];
  private buses = new Map<string, Bus>();
  private voices = new Map<string, Voice>();
  private sourceNodes = new WeakMap<HTMLMediaElement, { src: MediaElementAudioSourceNode; gain: GainNode }>();
  private clock = 0;
  private buf = new Float32Array(2048);
  private peakHold = [{ v: -Infinity, at: 0 }, { v: -Infinity, at: 0 }];
  private lastMeterAt = 0;
  private metersIdle = true;
  channelSolo: [boolean, boolean] = [false, false];

  /** Create the AudioContext (must be called from a user gesture the first time). */
  ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    this.ctx = ctx;
    this.programMaster = ctx.createGain();
    this.outBus = ctx.createGain();
    this.programMaster.connect(this.outBus);
    this.splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    this.outBus.connect(this.splitter);
    for (let ch = 0; ch < 2; ch++) {
      const g = ctx.createGain();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      this.splitter.connect(an, ch);
      this.splitter.connect(g, ch);
      g.connect(merger, 0, ch);
      this.chGain.push(g);
      this.analysers.push(an);
    }
    merger.connect(ctx.destination);
    return ctx;
  }

  setChannelSolo(ch: 0 | 1, on: boolean): void {
    this.channelSolo[ch] = on;
    const any = this.channelSolo[0] || this.channelSolo[1];
    this.chGain.forEach((g, i) => (g.gain.value = !any || this.channelSolo[i] ? 1 : 0));
  }

  private bus(id: string): Bus | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let b = this.buses.get(id);
    if (!b) {
      const input = ctx.createGain(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      input.connect(gain).connect(pan).connect(this.programMaster);
      pan.connect(analyser);
      b = { input, gain, pan, analyser };
      this.buses.set(id, b);
    }
    return b;
  }

  private voice(key: string, url: string, busId: string): Voice | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let v = this.voices.get(key);
    if (v && v.url !== url) {
      v.el.src = url;
      v.url = url;
    }
    if (!v) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.src = url;
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      const fx = new FxChain(ctx);
      src.connect(gain).connect(pan).connect(fx.input);
      v = { key, el, url, src, gain, pan, fx, bus: "", lastUsed: this.clock, lastSeekAt: 0 };
      this.voices.set(key, v);
    }
    if (v.bus !== busId) {
      try { v.fx.output.disconnect(); } catch { /* */ }
      const b = this.bus(busId);
      if (b) v.fx.output.connect(b.input);
      v.bus = busId;
    }
    v.lastUsed = this.clock;
    return v;
  }

  /** Per-frame program sync. */
  syncProgram(project: Project, seq: Sequence | null, t: number, playing: boolean, rate: number): void {
    this.clock++;
    const ctx = this.ctx;
    if (!ctx) return;
    const used = new Set<string>();
    if (seq && playing) {
      this.programMaster.gain.setTargetAtTime(dbToGain(seq.masterVolumeDb ?? 0), ctx.currentTime, 0.02);
      for (const tr of seq.tracks) {
        if (tr.kind !== "audio") continue;
        const b = this.bus(tr.id)!;
        setP(b.gain.gain, trackAudible(seq, tr) ? dbToGain(tr.volumeDb ?? 0) : 0, ctx);
        const pan = Math.abs(tr.pan ?? 0) > 1 ? (tr.pan ?? 0) / 100 : tr.pan ?? 0;
        setP(b.pan.pan, Math.max(-1, Math.min(1, pan)), ctx);
      }
      const master = this.bus("master")!;
      setP(master.gain.gain, 1, ctx);
      const now = performance.now();
      for (const n of collectAudioNeeds(project, seq, t, 2)) {
        const v = this.voice(n.key, mediaUrl(n.asset), n.bus);
        if (!v) continue;
        used.add(n.key);
        const el = v.el;
        const eff = rate * n.clip.speed * n.rateMul * (n.clip.reversed ? -1 : 1);
        if (!n.active || eff <= 0 || eff > 8) {
          if (!el.paused) el.pause();
          setP(v.gain.gain, 0, ctx);
          if (!n.active && !el.seeking && Math.abs(el.currentTime - n.target) > 0.1) el.currentTime = n.target;
          continue;
        }
        const local = n.t - n.clip.start;
        const audio = n.clip.audio;
        let g = audio && !audio.muted ? dbToGain(evalParam(audio.volumeDb, local, 0)) : audio?.muted ? 0 : 1;
        g *= audioTransitionGain(n.seq, n.clip, n.t);
        setP(v.gain.gain, g, ctx);
        setP(v.pan.pan, Math.max(-1, Math.min(1, evalParam(audio?.pan, local, 0) / 100)), ctx);
        const prims: AudioPrimitive[] = [];
        for (const e of n.clip.effects) if (e.enabled) for (const p of compileEffect(e, local)) if (!isVideoPrimitive(p)) prims.push(p as AudioPrimitive);
        v.fx.set(prims);
        const pr = Math.max(0.0625, Math.min(16, eff));
        if (Math.abs(el.playbackRate - pr) > 1e-3) el.playbackRate = pr;
        (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = n.clip.maintainPitch || rate !== 1;
        const drift = el.currentTime - n.target;
        if (Math.abs(drift) > 0.15 * Math.max(1, pr) && now - v.lastSeekAt > 500 && !el.seeking) {
          el.currentTime = n.target;
          v.lastSeekAt = now;
        }
        if (el.paused) void el.play().catch(() => {});
      }
    }
    for (const v of this.voices.values()) {
      if (used.has(v.key)) continue;
      if (!v.el.paused) v.el.pause();
      v.gain.gain.value = 0;
    }
    // evict stale voices
    if (this.voices.size > 32) {
      const stale = [...this.voices.values()].filter((v) => !used.has(v.key)).sort((a, b) => a.lastUsed - b.lastUsed);
      while (this.voices.size > 24 && stale.length) {
        const v = stale.shift()!;
        v.el.pause();
        try { v.src.disconnect(); v.fx.output.disconnect(); } catch { /* */ }
        v.el.removeAttribute("src");
        v.el.load();
        this.voices.delete(v.key);
      }
    }
  }

  /** Route a Source Monitor media element through the output bus (for meters). */
  attachSourceElement(el: HTMLMediaElement): void {
    const ctx = this.ensure();
    if (!ctx || this.sourceNodes.has(el)) return;
    try {
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      src.connect(gain).connect(this.outBus);
      this.sourceNodes.set(el, { src, gain });
    } catch (e) {
      console.warn("[engine] cannot route source element", e);
    }
  }

  isSourceAttached(el: HTMLMediaElement): boolean {
    return this.sourceNodes.has(el);
  }

  pauseAll(): void {
    for (const v of this.voices.values()) v.el.pause();
  }

  /** Update usePlayback meters (~30 fps). */
  meterTick(now: number, active: boolean): void {
    if (now - this.lastMeterAt < 33) return;
    this.lastMeterAt = now;
    if (!this.ctx || (!active && this.metersIdle)) return;
    const levels: number[] = [];
    for (let ch = 0; ch < 2; ch++) levels.push(active ? this.peakDb(this.analysers[ch]) : -Infinity);
    const res: MeterState = { left: levels[0], right: levels[1], peakLeft: -Infinity, peakRight: -Infinity };
    for (let ch = 0; ch < 2; ch++) {
      const h = this.peakHold[ch];
      if (levels[ch] >= h.v || now - h.at > 1500) {
        h.v = levels[ch];
        h.at = now;
      }
    }
    res.peakLeft = this.peakHold[0].v;
    res.peakRight = this.peakHold[1].v;
    const trackMeters: Record<string, number> = {};
    if (active) for (const [id, b] of this.buses) trackMeters[id] = this.peakDb(b.analyser);
    usePlayback.getState().set({ meters: res, trackMeters });
    this.metersIdle = !active && res.peakLeft === -Infinity && res.peakRight === -Infinity;
  }

  private peakDb(an: AnalyserNode | undefined): number {
    if (!an) return -Infinity;
    if (this.buf.length < an.fftSize) this.buf = new Float32Array(an.fftSize);
    const b = this.buf.subarray(0, an.fftSize);
    an.getFloatTimeDomainData(b);
    let pk = 0;
    for (let i = 0; i < b.length; i++) {
      const a = Math.abs(b[i]);
      if (a > pk) pk = a;
    }
    return pk <= 1e-5 ? -Infinity : 20 * Math.log10(pk);
  }
}
