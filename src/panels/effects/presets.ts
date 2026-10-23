// Effect presets: built-in (Effects panel > Presets), Lumetri looks, and user-saved presets.
import type { Clip, Effect, Keyframe, Sequence } from "@shared/types";
import { makeEffect, uid } from "@shared/factory";
import { evalParam } from "@shared/params";
import { useEditor, getActiveSequence } from "../../store/store";
import { isAudio, isVisual, selectedClips } from "./model";

export const PRESET_MIME = "application/x-editcut-preset";
export const EFFECT_MIME = "application/x-editcut-effect";
export const TRANSITION_MIME = "application/x-editcut-transition";

export interface PresetDef {
  id: string;
  name: string;
  folder: string;
  kind: "video" | "audio";
  description: string;
  apply: (clip: Clip, seq: Sequence) => void;
}

const kf = (t: number, v: number, interp: Keyframe["interp"] = "linear"): Keyframe => ({ t, v, interp });
const rampLen = (c: Clip, want = 1) => Math.min(want, c.duration / 2);

export const BUILTIN_PRESETS: PresetDef[] = [
  {
    id: "kenBurnsIn", name: "Ken Burns Zoom In", folder: "Motion", kind: "video", description: "Slow push-in across the whole clip (Scale keyframes).",
    apply: (c) => {
      if (!c.motion) return;
      const s = evalParam(c.motion.scale, 0);
      c.motion.scale.keyframes = [kf(0, s, "easeInOut"), kf(c.duration, s * 1.18)];
    },
  },
  {
    id: "kenBurnsOut", name: "Ken Burns Zoom Out", folder: "Motion", kind: "video", description: "Slow pull-out across the whole clip.",
    apply: (c) => {
      if (!c.motion) return;
      const s = evalParam(c.motion.scale, 0);
      c.motion.scale.keyframes = [kf(0, s * 1.18, "easeInOut"), kf(c.duration, s)];
    },
  },
  {
    id: "kenBurnsPanRight", name: "Ken Burns Pan Right", folder: "Motion", kind: "video", description: "Zoomed-in pan from left to right.",
    apply: (c, seq) => {
      if (!c.motion) return;
      const s = evalParam(c.motion.scale, 0);
      const x = evalParam(c.motion.positionX, 0);
      const dx = seq.settings.width * 0.06;
      c.motion.scale.keyframes = [];
      c.motion.scale.value = s * 1.15;
      c.motion.positionX.keyframes = [kf(0, x + dx, "easeInOut"), kf(c.duration, x - dx)];
    },
  },
  {
    id: "twirlIn", name: "Twirl In", folder: "Motion", kind: "video", description: "Spin and scale up into frame.",
    apply: (c) => {
      if (!c.motion) return;
      const s = evalParam(c.motion.scale, 0);
      const r = evalParam(c.motion.rotation, 0);
      const d = rampLen(c, 0.7);
      c.motion.scale.keyframes = [kf(0, 0, "easeOut"), kf(d, s)];
      c.motion.rotation.keyframes = [kf(0, r - 180, "easeOut"), kf(d, r)];
    },
  },
  {
    id: "fadeIn", name: "Fade In", folder: "Opacity", kind: "video", description: "Opacity 0 → 100% over the first second.",
    apply: (c) => {
      if (!c.opacity) return;
      const o = evalParam(c.opacity.opacity, c.duration);
      const others = (c.opacity.opacity.keyframes ?? []).filter((k) => k.t > rampLen(c) + 1e-3);
      c.opacity.opacity.keyframes = [kf(0, 0), kf(rampLen(c), o), ...others];
    },
  },
  {
    id: "fadeOut", name: "Fade Out", folder: "Opacity", kind: "video", description: "Opacity 100 → 0% over the last second.",
    apply: (c) => {
      if (!c.opacity) return;
      const o = evalParam(c.opacity.opacity, 0);
      const d = rampLen(c);
      const others = (c.opacity.opacity.keyframes ?? []).filter((k) => k.t < c.duration - d - 1e-3);
      c.opacity.opacity.keyframes = [...others, kf(c.duration - d, o), kf(c.duration, 0)];
    },
  },
  {
    id: "blurIn", name: "Blur In", folder: "Blurs", kind: "video", description: "Gaussian blur from 100 to 0 over the first second.",
    apply: (c) => {
      const fx = makeEffect("gaussianBlur");
      fx.params.blurriness = { value: 0, keyframes: [kf(0, 100, "easeOut"), kf(rampLen(c), 0)] };
      c.effects.push(fx);
    },
  },
  {
    id: "blurOut", name: "Blur Out", folder: "Blurs", kind: "video", description: "Gaussian blur from 0 to 100 over the last second.",
    apply: (c) => {
      const fx = makeEffect("gaussianBlur");
      const d = rampLen(c);
      fx.params.blurriness = { value: 0, keyframes: [kf(c.duration - d, 0, "easeIn"), kf(c.duration, 100)] };
      c.effects.push(fx);
    },
  },
  {
    id: "mosaicIn", name: "Mosaic In", folder: "Mosaics", kind: "video", description: "Pixelated to sharp over the first second.",
    apply: (c) => {
      const fx = makeEffect("mosaic");
      fx.params.blocks = { value: 2, keyframes: [kf(0, 120), kf(rampLen(c), 2)] };
      c.effects.push(fx);
    },
  },
  {
    id: "audioFadeIn", name: "Audio Fade In", folder: "Audio", kind: "audio", description: "Volume −∞ → current level over the first second.",
    apply: (c) => {
      if (!c.audio) return;
      const v = evalParam(c.audio.volumeDb, c.duration);
      c.audio.volumeDb.keyframes = [kf(0, -60), kf(rampLen(c), v)];
    },
  },
  {
    id: "audioFadeOut", name: "Audio Fade Out", folder: "Audio", kind: "audio", description: "Volume current level → −∞ over the last second.",
    apply: (c) => {
      if (!c.audio) return;
      const v = evalParam(c.audio.volumeDb, 0);
      const d = rampLen(c);
      c.audio.volumeDb.keyframes = [kf(c.duration - d, v), kf(c.duration, -60)];
    },
  },
];

// ---------------------------------------------------------------- user presets (Save Preset…)
export interface UserPreset {
  id: string;
  name: string;
  kind: "video" | "audio";
  effects: Effect[];
  /** "scale" scales keyframe times to the target clip length; "in" keeps them anchored to the In point. */
  type: "scale" | "in" | "out";
  sourceDuration: number;
}

const KEY = "editcut.fxPresets";
const listeners = new Set<() => void>();

export function loadUserPresets(): UserPreset[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as UserPreset[];
  } catch {
    return [];
  }
}

export function saveUserPreset(p: UserPreset): void {
  const all = loadUserPresets().filter((x) => x.id !== p.id);
  all.push(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function deleteUserPreset(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadUserPresets().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function onUserPresetsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Clone effects with fresh ids, retiming keyframes for the target clip. */
export function cloneEffects(effects: Effect[], opts?: { type: UserPreset["type"]; from: number; to: number }): Effect[] {
  const json = JSON.parse(JSON.stringify(effects)) as Effect[];
  for (const fx of json) {
    fx.id = uid("fx_");
    if (!opts) continue;
    for (const p of Object.values(fx.params))
      for (const k of p.keyframes ?? []) {
        if (opts.type === "scale" && opts.from > 0) k.t = (k.t / opts.from) * opts.to;
        else if (opts.type === "out") k.t = Math.max(0, opts.to - (opts.from - k.t));
      }
  }
  return json;
}

// ---------------------------------------------------------------- applying

/** Apply a preset id ("builtin:<id>", "user:<id>" or "look:<name>") to clip ids. Returns count. */
export function applyPreset(ref: string, clipIds: string[]): number {
  const seq = getActiveSequence();
  if (!seq) return 0;
  const [kind, ...rest] = ref.split(":");
  const id = rest.join(":");
  const clips = selectedClips(seq, clipIds);
  if (kind === "look") {
    const targets = clips.filter((c) => isVisual(seq, c));
    if (!targets.length) return toastNone("video");
    const ids = new Set(targets.map((c) => c.id));
    useEditor.getState().applySeq(`Apply Look ${id}`, (s) => {
      for (const c of s.clips) {
        if (!ids.has(c.id)) continue;
        let fx = c.effects.find((e) => e.type === "lumetri");
        if (!fx) {
          c.effects.push(makeEffect("lumetri"));
          fx = c.effects[c.effects.length - 1];
        }
        fx.options = { ...(fx.options ?? {}), look: id };
      }
    });
    return targets.length;
  }
  if (kind === "builtin") {
    const def = BUILTIN_PRESETS.find((p) => p.id === id);
    if (!def) return 0;
    const targets = clips.filter((c) => (def.kind === "audio" ? isAudio(seq, c) : isVisual(seq, c)));
    if (!targets.length) return toastNone(def.kind);
    const ids = new Set(targets.map((c) => c.id));
    useEditor.getState().applySeq(`Apply Preset ${def.name}`, (s) => {
      for (const c of s.clips) if (ids.has(c.id)) def.apply(c, s);
    });
    return targets.length;
  }
  if (kind === "user") {
    const p = loadUserPresets().find((x) => x.id === id);
    if (!p) return 0;
    const targets = clips.filter((c) => (p.kind === "audio" ? isAudio(seq, c) : isVisual(seq, c)));
    if (!targets.length) return toastNone(p.kind);
    const ids = new Set(targets.map((c) => c.id));
    useEditor.getState().applySeq(`Apply Preset ${p.name}`, (s) => {
      for (const c of s.clips)
        if (ids.has(c.id)) c.effects.push(...cloneEffects(p.effects, { type: p.type, from: p.sourceDuration, to: c.duration }));
    });
    return targets.length;
  }
  return 0;
}

function toastNone(kind: string): number {
  useEditor.getState().toast(`Select a ${kind} clip in the timeline first`, "error");
  return 0;
}
