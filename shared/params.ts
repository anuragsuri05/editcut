// Keyframe evaluation for animatable parameters.
import type { Keyframe, Param } from "./types";

export function p(value: number): Param {
  return { value };
}

function ease(interp: Keyframe["interp"], x: number): number {
  switch (interp) {
    case "hold":
      return 0;
    case "linear":
      return x;
    case "easeIn":
      return x * x;
    case "easeOut":
      return 1 - (1 - x) * (1 - x);
    case "bezier":
    case "easeInOut":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
}

/**
 * Value of a parameter at clip-local time t (seconds from clip start).
 * Interpolation uses the interp of the keyframe at the START of the segment.
 */
export function evalParam(param: Param | undefined, t: number, fallback = 0): number {
  if (!param) return fallback;
  const kfs = param.keyframes;
  if (!kfs || kfs.length === 0) return param.value;
  if (t <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const x = span <= 0 ? 1 : (t - a.t) / span;
      return a.v + (b.v - a.v) * ease(a.interp, x);
    }
  }
  return last.v;
}

export function isAnimated(param: Param | undefined): boolean {
  return !!param?.keyframes && param.keyframes.length > 0;
}

/** Set a value at time t: updates/creates a keyframe when animated, else the static value. Mutates. */
export function setParamAt(param: Param, t: number, v: number, tolerance = 1 / 120): void {
  if (!param.keyframes || param.keyframes.length === 0) {
    param.value = v;
    return;
  }
  const existing = param.keyframes.find((k) => Math.abs(k.t - t) <= tolerance);
  if (existing) existing.v = v;
  else {
    param.keyframes.push({ t, v, interp: "linear" });
    param.keyframes.sort((a, b) => a.t - b.t);
  }
}

/** Toggle animation (stopwatch). Turning on adds a keyframe at t with the current value; off clears keyframes keeping the value at t. Mutates. */
export function toggleAnimation(param: Param, t: number): void {
  if (isAnimated(param)) {
    param.value = evalParam(param, t);
    param.keyframes = [];
  } else {
    param.keyframes = [{ t, v: param.value, interp: "linear" }];
  }
}

/** Sample a param over [0,duration] at the given step; used by export to build piecewise expressions. */
export function sampleParam(param: Param, duration: number, step: number): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  for (let t = 0; t <= duration + 1e-9; t += step) out.push({ t, v: evalParam(param, t) });
  return out;
}
