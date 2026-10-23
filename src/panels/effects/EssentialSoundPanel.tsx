// Essential Sound panel (Premiere): tag audio clips as Dialogue / Music / SFX / Ambience and drive a
// managed chain of real audio effects on the clip.
//
// Data model (all inside the clip's effect stack, so it renders in preview + export and shows in Effect Controls):
//   - an "essentialSound" effect (no processing) holds the type in options.audioType and panel settings
//     (ducking prefs, loudness result) in extra option keys;
//   - each control owns one real effect tagged with options.esRole (e.g. "reduceNoise" -> denoise).
import { useMemo, useState, type ReactNode } from "react";
import type { Clip, Effect, Keyframe, Sequence } from "@shared/types";
import { evalParam, isAnimated, setParamAt } from "@shared/params";
import { makeEffect } from "@shared/factory";
import { getClip, setClipSpeed, clipEnd } from "@shared/ops";
import { formatTimecode } from "@shared/time";
import { useEditor, useActiveSequence, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { getCommand, runCommand } from "../../commands/registry";
import { Button, Checkbox, HotNumber, Select, SliderRow } from "../../ui/kit";
import { commitSeq, liveSeq } from "./liveEdit";
import { isAudio, localTime, selectedClips } from "./model";
import { estimateLoudness, LOUDNESS_TARGETS } from "./analysis";
import { CheckSection, SubHead } from "./widgets";
import "./effects.css";

export type AudioType = "Dialogue" | "Music" | "SFX" | "Ambience";
const TYPES: AudioType[] = ["Dialogue", "Music", "SFX", "Ambience"];

export function audioTypeOf(c: Clip): AudioType | null {
  const t = c.effects.find((e) => e.type === "essentialSound")?.options?.audioType;
  return t ? (t as AudioType) : null;
}

// ---------------------------------------------------------------- roles
interface RoleDef {
  role: string;
  type: string;
  label: string;
  /** Map the 0..10 panel amount (+ variant such as an EQ preset name) to effect params. */
  apply: (fx: Effect, amount: number, variant?: string) => void;
  /** Read back the 0..10 amount. */
  read: (fx: Effect) => number;
  variants?: string[];
  defaultAmount: number;
  defaultVariant?: string;
}

const P = (fx: Effect, k: string, v: number) => {
  fx.params[k] = fx.params[k] && isAnimated(fx.params[k]) ? fx.params[k] : { value: v };
  fx.params[k].value = v;
};
const amountOpt = (fx: Effect, fallback: number) => {
  const v = Number(fx.options?.esAmount);
  return Number.isFinite(v) ? v : fallback;
};

const EQ_PRESETS: Record<string, [number, number, number, number]> = {
  // [low dB, mid dB, mid Hz, high dB] at amount 10
  "Subtle Voice Clarity": [-1.5, 2, 2500, 2],
  "Podcast Voice": [-3, 3.5, 3000, 2],
  "Vocal Presence": [-2, 4, 4000, 1.5],
  "Broadcast": [2.5, 3, 2500, 3],
  "Background Voice": [-6, -3, 1000, -4],
  "Bass Boost": [6, 0, 1000, 0],
  "Low-cut": [-14, 0, 1000, 0],
  "Telephone": [-18, 6, 1500, -18],
  "Tame Brightness": [0, 0, 1000, -6],
};

const REVERB_PRESETS: Record<string, [number, number]> = {
  // [max mix 0..100, room 0..100]
  "Auditorium": [45, 92], "Large Reflective Room": [40, 80], "Outside Club": [35, 60], "Warm Room": [30, 45],
  "Warm Voice Booth": [20, 20], "Heavy Reverb": [60, 95], "Light Reverb": [18, 30], "Thick Reverb": [50, 85],
};

const ROLES: Record<string, RoleDef> = {
  reduceNoise: { role: "reduceNoise", type: "denoise", label: "Reduce Noise", defaultAmount: 5, apply: (fx, a) => P(fx, "amount", a * 10), read: (fx) => (fx.params.amount?.value ?? 50) / 10 },
  reduceRumble: { role: "reduceRumble", type: "highpass", label: "Reduce Rumble", defaultAmount: 5, apply: (fx, a) => P(fx, "freq", Math.round(40 + a * 12)), read: (fx) => ((fx.params.freq?.value ?? 100) - 40) / 12 },
  dehum: {
    role: "dehum", type: "dehum", label: "DeHum", defaultAmount: 5, variants: ["60 Hz", "50 Hz"], defaultVariant: "60 Hz",
    apply: (fx, a, v) => { fx.options = { ...(fx.options ?? {}), esAmount: String(a), ...(v ? { freq: v.startsWith("50") ? "50" : "60" } : {}) }; },
    read: (fx) => amountOpt(fx, 5),
  },
  deess: { role: "deess", type: "deesser", label: "DeEss", defaultAmount: 5, apply: (fx, a) => P(fx, "amount", a * 10), read: (fx) => (fx.params.amount?.value ?? 50) / 10 },
  dynamics: {
    role: "dynamics", type: "dynamics", label: "Dynamics", defaultAmount: 5,
    apply: (fx, a) => { P(fx, "threshold", -10 - a * 2.6); P(fx, "ratio", 1.5 + a * 0.55); P(fx, "attack", 8); P(fx, "release", 140); P(fx, "makeup", +(a * 0.7).toFixed(1)); },
    read: (fx) => (-(fx.params.threshold?.value ?? -23) - 10) / 2.6,
  },
  eq: {
    role: "eq", type: "eq3", label: "EQ", defaultAmount: 6, variants: Object.keys(EQ_PRESETS), defaultVariant: "Podcast Voice",
    apply: (fx, a, v) => {
      const name = v ?? String(fx.options?.esPreset ?? "Podcast Voice");
      const [lo, mid, f, hi] = EQ_PRESETS[name] ?? EQ_PRESETS["Podcast Voice"];
      const k = a / 10;
      P(fx, "low", +(lo * k).toFixed(1)); P(fx, "mid", +(mid * k).toFixed(1)); P(fx, "midFreq", f); P(fx, "high", +(hi * k).toFixed(1));
      fx.options = { ...(fx.options ?? {}), esPreset: name, esAmount: String(a) };
    },
    read: (fx) => amountOpt(fx, 6),
  },
  reverb: {
    role: "reverb", type: "reverb", label: "Reverb", defaultAmount: 5, variants: Object.keys(REVERB_PRESETS), defaultVariant: "Warm Room",
    apply: (fx, a, v) => {
      const name = v ?? String(fx.options?.esPreset ?? "Warm Room");
      const [mix, room] = REVERB_PRESETS[name] ?? REVERB_PRESETS["Warm Room"];
      P(fx, "mix", +((mix * a) / 10).toFixed(1)); P(fx, "room", room);
      fx.options = { ...(fx.options ?? {}), esPreset: name, esAmount: String(a) };
    },
    read: (fx) => amountOpt(fx, 5),
  },
};

function roleFx(c: Clip, role: string): Effect | undefined {
  return c.effects.find((e) => e.options?.esRole === role);
}

function ensureRole(c: Clip, role: string): Effect {
  let fx = roleFx(c, role);
  if (!fx) {
    const nfx = makeEffect(ROLES[role].type);
    nfx.options = { ...(nfx.options ?? {}), esRole: role };
    c.effects.push(nfx);
    fx = c.effects[c.effects.length - 1];
  }
  return fx;
}

function tagFx(c: Clip): Effect {
  let fx = c.effects.find((e) => e.type === "essentialSound");
  if (!fx) {
    c.effects.unshift(makeEffect("essentialSound"));
    fx = c.effects[0];
  }
  return fx;
}

// ---------------------------------------------------------------- presets per type
type RoleSetting = { role: string; amount: number; variant?: string };
const TYPE_PRESETS: Record<AudioType, Record<string, { roles: RoleSetting[]; pan?: number }>> = {
  Dialogue: {
    "(Default)": { roles: [] },
    "Balanced Female Voice": { roles: [{ role: "dynamics", amount: 4 }, { role: "eq", amount: 5, variant: "Subtle Voice Clarity" }, { role: "deess", amount: 4 }] },
    "Balanced Male Voice": { roles: [{ role: "dynamics", amount: 4 }, { role: "eq", amount: 5, variant: "Vocal Presence" }, { role: "reduceRumble", amount: 4 }] },
    "Podcast Voice": { roles: [{ role: "reduceRumble", amount: 5 }, { role: "dynamics", amount: 6 }, { role: "eq", amount: 7, variant: "Podcast Voice" }, { role: "deess", amount: 4 }] },
    "Clean Up Noisy Dialogue": { roles: [{ role: "reduceNoise", amount: 6 }, { role: "reduceRumble", amount: 6 }, { role: "dehum", amount: 5, variant: "60 Hz" }, { role: "dynamics", amount: 3 }] },
    "Make It Sound Like Phone": { roles: [{ role: "eq", amount: 10, variant: "Telephone" }, { role: "dynamics", amount: 7 }] },
    "Make It Sound Like Radio": { roles: [{ role: "eq", amount: 8, variant: "Broadcast" }, { role: "dynamics", amount: 8 }] },
    "Make It Sound Outside": { roles: [{ role: "reverb", amount: 3, variant: "Outside Club" }, { role: "eq", amount: 4, variant: "Tame Brightness" }] },
  },
  Music: {
    "(Default)": { roles: [] },
    "Balanced Background Music": { roles: [{ role: "eq", amount: 4, variant: "Background Voice" }, { role: "dynamics", amount: 3 }] },
    "Smooth Volume Variance": { roles: [{ role: "dynamics", amount: 6 }] },
  },
  SFX: {
    "(Default)": { roles: [] },
    "Create Distant Effect": { roles: [{ role: "reverb", amount: 6, variant: "Large Reflective Room" }, { role: "eq", amount: 5, variant: "Tame Brightness" }] },
    "From the Left": { roles: [], pan: -60 },
    "From the Right": { roles: [], pan: 60 },
  },
  Ambience: {
    "(Default)": { roles: [] },
    "Create Indoor Room Ambience": { roles: [{ role: "reverb", amount: 5, variant: "Warm Room" }] },
    "Create Outdoor Ambience": { roles: [{ role: "reverb", amount: 3, variant: "Outside Club" }] },
    "Smooth Volume Variance": { roles: [{ role: "dynamics", amount: 5 }] },
  },
};

// ---------------------------------------------------------------- panel
export default function EssentialSoundPanel() {
  const seq = useActiveSequence();
  const ids = useEditor((s) => s.selection.clipIds);
  const clips = useMemo(() => (seq ? selectedClips(seq, ids).filter((c) => isAudio(seq, c)) : []), [seq, ids]);
  if (!seq) return <div className="panel-empty">(no sequence)</div>;
  if (!clips.length)
    return (
      <div className="panel-empty es-empty">
        <div>
          <div className="es-empty-title">Essential Sound</div>
          Select audio clips in the timeline, then choose an audio type to unlock repair, clarity, loudness and ducking controls.
        </div>
      </div>
    );
  return <EssentialSoundBody seq={seq} clips={clips} />;
}

function EssentialSoundBody({ seq, clips }: { seq: Sequence; clips: Clip[] }) {
  const types = new Set(clips.map(audioTypeOf));
  const type = types.size === 1 ? [...types][0] : null;
  const mixed = types.size > 1;
  const first = clips[0];
  const ids = clips.map((c) => c.id);

  const edit = (label: string, final: boolean, fn: (c: Clip, s: Sequence) => void) => {
    const f = (s: Sequence) => {
      for (const id of ids) {
        const c = getClip(s, id);
        if (c) fn(c, s);
      }
    };
    if (final) commitSeq(label, f);
    else liveSeq(f);
  };

  const assign = (t: AudioType) => edit(`Set Audio Type: ${t}`, true, (c) => { tagFx(c).options = { ...(tagFx(c).options ?? {}), audioType: t }; });
  const clearType = () =>
    edit("Clear Audio Type", true, (c) => {
      c.effects = c.effects.filter((e) => e.type !== "essentialSound" && !e.options?.esRole);
    });

  if (!type)
    return (
      <div className="es">
        <div className="es-head">
          <span className="muted">{clips.length} audio clip{clips.length > 1 ? "s" : ""} selected{mixed ? " · mixed types" : ""}</span>
          {mixed ? <Button small onClick={clearType}>Clear Audio Type</Button> : null}
        </div>
        <div className="es-types">
          {TYPES.map((t) => (
            <button key={t} className={"es-type-btn t-" + t} onClick={() => assign(t)}>
              <TypeIcon type={t} />
              <span>{t}</span>
            </button>
          ))}
        </div>
        <div className="es-hint muted">Assign an audio type to the selection. The type adds an editable chain of real effects (visible in Effect Controls).</div>
      </div>
    );

  const tag = first.effects.find((e) => e.type === "essentialSound");
  const tagOpt = (k: string, d: string | boolean) => tag?.options?.[k] ?? d;
  const setTagOpt = (o: Record<string, string | boolean>, label: string) => edit(label, true, (c) => { const t = tagFx(c); t.options = { ...(t.options ?? {}), ...o }; });

  // ---- role controls
  const roleOn = (role: string) => !!roleFx(first, role);
  const roleAmount = (role: string) => {
    const fx = roleFx(first, role);
    return fx ? Math.round(Math.min(10, Math.max(0, ROLES[role].read(fx))) * 10) / 10 : ROLES[role].defaultAmount;
  };
  const roleVariant = (role: string) => String(roleFx(first, role)?.options?.[role === "dehum" ? "freq" : "esPreset"] ?? ROLES[role].defaultVariant ?? "");
  const setRole = (role: string, on: boolean) =>
    edit(`${on ? "Enable" : "Disable"} ${ROLES[role].label}`, true, (c) => {
      if (on) ROLES[role].apply(ensureRole(c, role), ROLES[role].defaultAmount, ROLES[role].defaultVariant);
      else c.effects = c.effects.filter((e) => e.options?.esRole !== role);
    });
  const setAmount = (role: string, a: number, final: boolean) => edit(ROLES[role].label, final, (c) => ROLES[role].apply(ensureRole(c, role), a));
  const setVariant = (role: string, v: string) => edit(`${ROLES[role].label} Preset`, true, (c) => ROLES[role].apply(ensureRole(c, role), roleAmount(role), v));

  const roleRow = (role: string, opts?: { variantLabel?: string; disabledNote?: string }) => {
    const on = roleOn(role);
    const def = ROLES[role];
    return (
      <div className={"es-role" + (on ? "" : " off")} key={role}>
        <Checkbox checked={on} label={def.label} onChange={(v) => setRole(role, v)} />
        {def.variants ? (
          <Select
            value={role === "dehum" ? (roleVariant(role) === "50" ? "50 Hz" : "60 Hz") : roleVariant(role)}
            options={def.variants}
            disabled={!on}
            onChange={(v) => setVariant(role, v)}
            style={{ maxWidth: 150 }}
          />
        ) : null}
        <div className="es-role-slider">
          <SliderRow label={opts?.variantLabel ?? "Amount"} value={roleAmount(role)} min={0} max={10} step={0.1} defaultValue={def.defaultAmount} onChange={(v) => on && setAmount(role, v, false)} onCommit={(v) => on && setAmount(role, v, true)} />
        </div>
      </div>
    );
  };

  // ---- presets
  const presets = TYPE_PRESETS[type];
  const applyTypePreset = (name: string) => {
    const pr = presets[name];
    if (!pr) return;
    edit(`Essential Sound Preset: ${name}`, true, (c) => {
      c.effects = c.effects.filter((e) => !e.options?.esRole);
      for (const r of pr.roles) ROLES[r.role].apply(ensureRole(c, r.role), r.amount, r.variant);
      if (pr.pan !== undefined && c.audio) c.audio.pan = { value: pr.pan };
      const t = tagFx(c);
      t.options = { ...(t.options ?? {}), preset: name };
    });
  };

  return (
    <div className="es">
      <div className="es-head">
        <TypeIcon type={type} />
        <span className="es-type-name">{type}</span>
        <span className="muted">{clips.length > 1 ? `· ${clips.length} clips` : `· ${first.name}`}</span>
        <span className="spacer" />
        <Button small onClick={clearType}>Clear Audio Type</Button>
      </div>
      <div className="es-preset">
        <span className="muted">Preset</span>
        <Select value={String(tagOpt("preset", "(Default)"))} options={Object.keys(presets)} onChange={applyTypePreset} style={{ flex: 1 }} />
      </div>
      <div className="es-body">
        <LoudnessSection type={type} clips={clips} tagValue={String(tagOpt("lufs", ""))} onMatched={(lufs) => setTagOpt({ lufs: String(lufs) }, "Loudness")} />

        {type === "Dialogue" ? (
          <>
            <CheckSection title="Repair" enabled={["reduceNoise", "reduceRumble", "dehum", "deess"].some(roleOn)} defaultOpen>
              {roleRow("reduceNoise")}
              {roleRow("reduceRumble")}
              {roleRow("dehum")}
              {roleRow("deess")}
              <div className="es-role off">
                <Checkbox checked={false} disabled label="Reduce Reverb" onChange={() => {}} />
                <span className="es-soon">not available yet</span>
              </div>
            </CheckSection>
            <CheckSection title="Clarity" enabled={["dynamics", "eq"].some(roleOn)} defaultOpen>
              {roleRow("dynamics")}
              {roleRow("eq")}
              <EnhanceSpeech clips={clips} />
            </CheckSection>
          </>
        ) : null}

        {type === "Music" ? (
          <>
            <DurationSection clip={first} />
            <DuckingSection seq={seq} clips={clips} tag={tag} setTagOpt={setTagOpt} />
          </>
        ) : null}

        {type === "SFX" ? (
          <CheckSection title="Pan" enabled defaultOpen>
            <PanControl clips={clips} />
          </CheckSection>
        ) : null}

        <CheckSection title="Creative" enabled={roleOn("reverb")} defaultOpen={type !== "Music"}>
          {roleRow("reverb")}
        </CheckSection>

        {type === "Ambience" ? (
          <>
            <CheckSection title="Stereo Width" enabled={false} right={<span className="es-soon">not available yet</span>}>
              <SliderRow label="Width" value={5} min={0} max={10} defaultValue={5} onChange={() => {}} onCommit={() => {}} />
            </CheckSection>
            <DuckingSection seq={seq} clips={clips} tag={tag} setTagOpt={setTagOpt} />
          </>
        ) : null}

        <ClipVolume clips={clips} />
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: AudioType }) {
  const paths: Record<AudioType, ReactNode> = {
    Dialogue: <path d="M3 4 H13 V10 H7 L4 13 V10 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
    Music: <path d="M6 12 A2 2 0 1 1 6 11.9 M6 12 V3 L13 2 V10 M13 10 A2 2 0 1 1 13 9.9" fill="none" stroke="currentColor" strokeWidth="1.4" />,
    SFX: <path d="M2 9 L5 9 L7 3 L9 13 L11 6 L12 9 L14 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
    Ambience: <path d="M2 11 Q5 4 8 11 T14 11 M2 7 Q5 1 8 7 T14 7" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  };
  return <svg width="16" height="16" viewBox="0 0 16 16" className={"es-icon t-" + type}>{paths[type]}</svg>;
}

// ---------------------------------------------------------------- loudness
function LoudnessSection({ type, clips, tagValue, onMatched }: { type: AudioType; clips: Clip[]; tagValue: string; onMatched: (lufs: number) => void }) {
  const [busy, setBusy] = useState(false);
  const target = LOUDNESS_TARGETS[type];
  const autoMatch = async () => {
    const project = useEditor.getState().project;
    setBusy(true);
    const results = await Promise.all(clips.map(async (c) => ({ id: c.id, lufs: await estimateLoudness(project, c) })));
    setBusy(false);
    const ok = results.filter((r) => r.lufs !== null) as { id: string; lufs: number }[];
    if (!ok.length) return useEditor.getState().toast("No waveform data to analyze yet", "error");
    useEditor.getState().applySeq("Auto-Match Loudness", (s) => {
      for (const r of ok) {
        const c = getClip(s, r.id);
        if (!c?.audio) continue;
        const gain = Math.max(-48, Math.min(15, target - r.lufs));
        const p = c.audio.volumeDb;
        if (isAnimated(p)) {
          const delta = gain - (p.keyframes!.reduce((m, k) => Math.max(m, k.v), -96));
          for (const k of p.keyframes!) k.v = Math.min(15, k.v + delta);
        } else p.value = Math.round(gain * 10) / 10;
      }
    });
    onMatched(Math.round(target * 10) / 10);
    useEditor.getState().toast(`Matched ${ok.length} clip${ok.length > 1 ? "s" : ""} to ${target} LUFS`, "success");
  };
  return (
    <CheckSection title="Loudness" enabled defaultOpen>
      <div className="es-loud">
        <Button small primary disabled={busy} onClick={autoMatch}>{busy ? "Analyzing…" : "Auto-Match"}</Button>
        <span className="es-lufs">{tagValue ? `${tagValue} LUFS` : `target ${target} LUFS`}</span>
        <span className="spacer" />
        <Button small onClick={() => useEditor.getState().applySeq("Reset Loudness", (s) => { for (const c0 of clips) { const c = getClip(s, c0.id); if (c?.audio && !isAnimated(c.audio.volumeDb)) c.audio.volumeDb.value = 0; } })}>Reset</Button>
      </div>
      <div className="es-note muted">Loudness is estimated from the waveform envelope (approximate BS.1770).</div>
    </CheckSection>
  );
}

function EnhanceSpeech({ clips }: { clips: Clip[] }) {
  const [mix, setMix] = useState(7);
  const run = () => {
    if (getCommand("ai.enhanceSpeech")) {
      runCommand("ai.enhanceSpeech");
      return;
    }
    // Fallback: a classic speech-cleanup chain built from real effects.
    const k = mix / 10;
    const ids = new Set(clips.map((c) => c.id));
    useEditor.getState().applySeq("Enhance Speech", (s) => {
      for (const c of s.clips) {
        if (!ids.has(c.id)) continue;
        ROLES.reduceRumble.apply(ensureRole(c, "reduceRumble"), 4);
        ROLES.reduceNoise.apply(ensureRole(c, "reduceNoise"), 3 + 4 * k);
        ROLES.eq.apply(ensureRole(c, "eq"), 4 + 4 * k, "Podcast Voice");
        ROLES.dynamics.apply(ensureRole(c, "dynamics"), 3 + 4 * k);
      }
    });
    useEditor.getState().toast("Enhance Speech: applied cleanup chain (high-pass, denoise, EQ, dynamics)");
  };
  return (
    <div className="es-enhance">
      <div className="es-enhance-row">
        <span>Enhance Speech</span>
        <span className="spacer" />
        <Button small primary onClick={run}>Enhance</Button>
      </div>
      <SliderRow label="Mix Amount" value={mix} min={0} max={10} step={0.1} defaultValue={7} onChange={setMix} onCommit={setMix} />
    </div>
  );
}

// ---------------------------------------------------------------- music: duration + ducking
function DurationSection({ clip }: { clip: Clip }) {
  const fps = getActiveSequence()?.settings.fps ?? 30;
  const [method, setMethod] = useState<"Stretch" | "Remix">("Stretch");
  const [target, setTarget] = useState(clip.duration);
  const apply = () => {
    if (method === "Remix") return useEditor.getState().toast("Remix (music retiming) is not available yet");
    const srcDur = clip.duration * clip.speed;
    const speed = srcDur / Math.max(0.1, target);
    useEditor.getState().applySeq("Stretch Music", (s, p) => setClipSpeed(p, s, clip.id, speed, { maintainPitch: true, ripple: false }));
  };
  return (
    <CheckSection title="Duration" enabled defaultOpen={false}>
      <div className="es-line">
        <span className="muted">Method</span>
        <Select value={method} options={["Stretch", "Remix"]} onChange={(v) => setMethod(v)} />
      </div>
      <div className="es-line">
        <span className="muted">Target Duration</span>
        <HotNumber value={target} min={0.5} max={3600} step={1 / fps} format={(v) => formatTimecode(v, fps)} parse={(s) => (s.includes(":") ? null : parseFloat(s))} onChange={setTarget} />
        <Button small onClick={apply}>Apply</Button>
      </div>
      <div className="es-note muted">Stretch changes speed with pitch preserved{method === "Remix" ? "; Remix isn't available yet" : ""}.</div>
    </CheckSection>
  );
}

const DUCK_TYPES = ["Dialogue", "Music", "SFX", "Ambience", "Untagged"] as const;

function DuckingSection({ seq, clips, tag, setTagOpt }: { seq: Sequence; clips: Clip[]; tag?: Effect; setTagOpt: (o: Record<string, string | boolean>, label: string) => void }) {
  const o = tag?.options ?? {};
  const on = o.duckOn === true;
  const against = new Set(String(o.duckAgainst ?? "Dialogue").split(",").filter(Boolean));
  const sens = Number(o.duckSensitivity ?? 6);
  const reduce = Number(o.duckReduce ?? -18);
  const fade = Number(o.duckFade ?? 800);
  const [local, setLocal] = useState<{ sens?: number; reduce?: number; fade?: number }>({});

  const generate = () => {
    const ranges = duckRanges(seq, clips, against, local.sens ?? sens);
    if (!ranges.length) return useEditor.getState().toast(`No ${[...against].join("/")} clips found to duck against`, "error");
    const ids = new Set(clips.map((c) => c.id));
    const red = local.reduce ?? reduce, fd = (local.fade ?? fade) / 1000;
    let n = 0;
    useEditor.getState().applySeq("Generate Ducking Keyframes", (s) => {
      for (const c of s.clips) {
        if (!ids.has(c.id) || !c.audio) continue;
        const kfs = duckKeyframes(c, ranges, red, fd);
        if (kfs.length) {
          c.audio.volumeDb.keyframes = kfs;
          n++;
        }
      }
    });
    useEditor.getState().toast(n ? `Ducking keyframes written on ${n} clip${n > 1 ? "s" : ""}` : "No overlap between the selection and the duck sources", n ? "success" : "error");
  };

  return (
    <CheckSection title="Ducking" enabled={on} onToggle={(v) => setTagOpt({ duckOn: v }, "Ducking")} defaultOpen>
      <div className="es-line">
        <span className="muted">Duck against</span>
        <span className="es-duck-types">
          {DUCK_TYPES.map((t) => (
            <button
              key={t}
              className={"es-duck-t" + (against.has(t) ? " on" : "")}
              title={t}
              onClick={() => {
                const n = new Set(against);
                if (n.has(t)) n.delete(t);
                else n.add(t);
                setTagOpt({ duckAgainst: [...n].join(",") }, "Duck Against");
              }}
            >
              {t === "Untagged" ? "?" : <TypeIcon type={t as AudioType} />}
            </button>
          ))}
        </span>
      </div>
      <SliderRow label="Sensitivity" value={local.sens ?? sens} min={0} max={10} step={0.1} defaultValue={6} onChange={(v) => setLocal({ ...local, sens: v })} onCommit={(v) => { setLocal({ ...local, sens: undefined }); setTagOpt({ duckSensitivity: String(v) }, "Ducking Sensitivity"); }} />
      <SliderRow label="Reduce By" unit="dB" value={local.reduce ?? reduce} min={-40} max={0} step={0.5} defaultValue={-18} onChange={(v) => setLocal({ ...local, reduce: v })} onCommit={(v) => { setLocal({ ...local, reduce: undefined }); setTagOpt({ duckReduce: String(v) }, "Ducking Amount"); }} />
      <SliderRow label="Fades" unit="ms" value={local.fade ?? fade} min={0} max={3000} step={10} defaultValue={800} onChange={(v) => setLocal({ ...local, fade: v })} onCommit={(v) => { setLocal({ ...local, fade: undefined }); setTagOpt({ duckFade: String(v) }, "Ducking Fades"); }} />
      <div className="es-line">
        <span className="spacer" />
        <Button small primary disabled={!on || !against.size} onClick={generate}>Generate Keyframes</Button>
      </div>
    </CheckSection>
  );
}

/** Timeline ranges where duck-source clips play (merged per sensitivity). */
function duckRanges(seq: Sequence, music: Clip[], against: Set<string>, sensitivity: number): [number, number][] {
  const exclude = new Set(music.map((c) => c.id));
  const raw: [number, number][] = [];
  for (const c of seq.clips) {
    if (exclude.has(c.id) || !c.enabled || c.audio?.muted || !isAudio(seq, c)) continue;
    if (seq.tracks.find((t) => t.id === c.trackId)?.muted) continue;
    const t = audioTypeOf(c) ?? "Untagged";
    if (!against.has(t)) continue;
    raw.push([c.start, clipEnd(c)]);
  }
  raw.sort((a, b) => a[0] - b[0]);
  // Higher sensitivity = more (shorter) ducks: bridge smaller gaps only and keep shorter sources.
  const bridge = (10 - sensitivity) * 0.3 + 0.15;
  const minLen = (10 - sensitivity) * 0.08;
  const out: [number, number][] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r[0] - last[1] <= bridge) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out.filter((r) => r[1] - r[0] >= minLen);
}

/** Volume keyframes on a clip dipping by `reduce` dB during the ranges, with `fade` sec ramps outside them. */
function duckKeyframes(c: Clip, ranges: [number, number][], reduce: number, fade: number): Keyframe[] {
  const base = c.audio ? (isAnimated(c.audio.volumeDb) ? evalParam(c.audio.volumeDb, 0) : c.audio.volumeDb.value) : 0;
  const duck = base + reduce;
  // merge ranges whose ramps would overlap
  const rs: [number, number][] = [];
  for (const [a, b] of ranges) {
    const la = a - c.start, lb = b - c.start;
    if (lb + fade < 0 || la - fade > c.duration) continue;
    const last = rs[rs.length - 1];
    if (last && la - fade <= last[1] + fade) last[1] = Math.max(last[1], lb);
    else rs.push([la, lb]);
  }
  if (!rs.length) return [];
  const pts: { t: number; v: number }[] = [];
  for (const [a, b] of rs) pts.push({ t: a - fade, v: base }, { t: a, v: duck }, { t: b, v: duck }, { t: b + fade, v: base });
  const lin = (t: number) => {
    if (t <= pts[0].t) return pts[0].v;
    for (let i = 0; i < pts.length - 1; i++) if (t <= pts[i + 1].t) return pts[i].v + (pts[i + 1].v - pts[i].v) * ((t - pts[i].t) / Math.max(1e-6, pts[i + 1].t - pts[i].t));
    return pts[pts.length - 1].v;
  };
  const times = new Set<number>([0, c.duration]);
  for (const p of pts) if (p.t > 0 && p.t < c.duration) times.add(Math.round(p.t * 1000) / 1000);
  const out = [...times].sort((a, b) => a - b).map((t) => ({ t, v: Math.round(lin(t) * 10) / 10, interp: "linear" as const }));
  // drop redundant middle points on flat segments
  return out.filter((k, i) => i === 0 || i === out.length - 1 || !(out[i - 1].v === k.v && out[i + 1].v === k.v));
}

// ---------------------------------------------------------------- SFX pan, clip volume
function PanControl({ clips }: { clips: Clip[] }) {
  const first = clips[0];
  const v = first.audio ? evalParam(first.audio.pan, localTime(first)) : 0;
  const ids = clips.map((c) => c.id);
  const write = (val: number, final: boolean) => {
    const f = (s: Sequence) => { for (const id of ids) { const c = getClip(s, id); if (c?.audio) setParamAt(c.audio.pan, localTime(c), val); } };
    if (final) commitSeq("Pan", f);
    else liveSeq(f);
  };
  return <SliderRow label="Position" value={v} min={-100} max={100} step={1} defaultValue={0} onChange={(x) => write(x, false)} onCommit={(x) => write(x, true)} />;
}

function ClipVolume({ clips }: { clips: Clip[] }) {
  const time = usePlayback((s) => s.time);
  const first = clips[0];
  const v = first.audio ? evalParam(first.audio.volumeDb, localTime(first, time)) : 0;
  const ids = clips.map((c) => c.id);
  const muted = clips.every((c) => c.audio?.muted);
  const write = (val: number, final: boolean) => {
    const f = (s: Sequence) => { for (const id of ids) { const c = getClip(s, id); if (c?.audio) setParamAt(c.audio.volumeDb, localTime(c), val); } };
    if (final) commitSeq("Clip Volume", f);
    else liveSeq(f);
  };
  return (
    <CheckSection title="Clip Volume" enabled defaultOpen>
      <SliderRow label="Level" unit="dB" value={Math.max(-60, v)} min={-60} max={15} step={0.1} defaultValue={0} onChange={(x) => write(x, false)} onCommit={(x) => write(x, true)} />
      <Checkbox checked={muted} label="Mute" onChange={(m) => useEditor.getState().applySeq(m ? "Mute Clips" : "Unmute Clips", (s) => { for (const id of ids) { const c = getClip(s, id); if (c?.audio) c.audio.muted = m; } })} />
    </CheckSection>
  );
}
