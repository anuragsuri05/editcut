// Effects panel (Premiere): searchable folder tree of presets, Lumetri presets, audio/video effects and transitions.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TransitionType } from "@shared/types";
import { EFFECTS, LOOKS, TRANSITIONS, TRANSITION_MAP, type EffectCategory } from "@shared/effects";
import { addTransition, clipEnd, clipsOnTrack, editPoints } from "@shared/ops";
import { useEditor, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { useTimeline } from "../timeline/state";
import { showContextMenu, TextInput } from "../../ui/kit";
import { addEffectToClips } from "./model";
import { applyPreset, BUILTIN_PRESETS, deleteUserPreset, EFFECT_MIME, loadUserPresets, onUserPresetsChanged, PRESET_MIME, TRANSITION_MIME } from "./presets";
import "./effects.css";

type Leaf =
  | { kind: "effect"; id: string; name: string; desc: string; audio: boolean; accel: boolean; bit32: boolean; yuv: boolean }
  | { kind: "transition"; id: TransitionType; name: string; desc: string; audio: boolean }
  | { kind: "preset"; id: string; name: string; desc: string; user?: boolean };

interface Folder { id: string; name: string; children: (Folder | Leaf)[]; custom?: boolean }

const HIDDEN = new Set(["essentialSound"]);
// cosmetic badges like Premiere's: GPU accelerated / 32-bit / YUV
const NOT_ACCEL = new Set(["posterize", "threshold", "emboss", "findEdges", "mirror"]);

function buildTree(customBins: string[]): Folder[] {
  const byCat = (kind: "video" | "audio") => {
    const cats = new Map<EffectCategory, Leaf[]>();
    for (const e of EFFECTS) {
      if (e.kind !== kind || HIDDEN.has(e.type)) continue;
      if (!cats.has(e.category)) cats.set(e.category, []);
      cats.get(e.category)!.push({ kind: "effect", id: e.type, name: e.name, desc: e.description, audio: kind === "audio", accel: kind === "video" && !NOT_ACCEL.has(e.type), bit32: true, yuv: kind === "video" && e.category !== "Keying" });
    }
    return [...cats.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, leaves]) => ({ id: `${kind}:${cat}`, name: cat, children: leaves.sort((a, b) => a.name.localeCompare(b.name)) }));
  };
  const trCats = new Map<string, Leaf[]>();
  for (const t of TRANSITIONS) {
    if (t.kind !== "video") continue;
    if (!trCats.has(t.category)) trCats.set(t.category, []);
    trCats.get(t.category)!.push({ kind: "transition", id: t.type, name: t.name, desc: `${t.category} transition`, audio: false });
  }
  const presetFolders = new Map<string, Leaf[]>();
  for (const p of BUILTIN_PRESETS) {
    if (!presetFolders.has(p.folder)) presetFolders.set(p.folder, []);
    presetFolders.get(p.folder)!.push({ kind: "preset", id: `builtin:${p.id}`, name: p.name, desc: p.description });
  }
  const user = loadUserPresets();
  return [
    {
      id: "presets", name: "Presets",
      children: [
        ...[...presetFolders.entries()].map(([f, leaves]) => ({ id: `presets:${f}`, name: f, children: leaves })),
        ...(user.length ? [{ id: "presets:user", name: "My Presets", children: user.map((u) => ({ kind: "preset" as const, id: `user:${u.id}`, name: u.name, desc: `${u.effects.length} effect(s), ${u.kind}`, user: true })) }] : []),
      ],
    },
    {
      id: "lumetri", name: "Lumetri Presets",
      children: [{ id: "lumetri:looks", name: "Creative", children: Object.keys(LOOKS).map((n) => ({ kind: "preset" as const, id: `look:${n}`, name: n, desc: "Lumetri Color with this Look" })) }],
    },
    { id: "audioFx", name: "Audio Effects", children: byCat("audio") },
    {
      id: "audioTr", name: "Audio Transitions",
      children: [{ id: "audioTr:cf", name: "Crossfade", children: TRANSITIONS.filter((t) => t.kind === "audio").map((t) => ({ kind: "transition" as const, id: t.type, name: t.name, desc: "Audio crossfade", audio: true })) }],
    },
    { id: "videoFx", name: "Video Effects", children: byCat("video") },
    { id: "videoTr", name: "Video Transitions", children: [...trCats.entries()].map(([c, leaves]) => ({ id: `videoTr:${c}`, name: c, children: leaves })) },
    ...customBins.map((b) => ({ id: `custom:${b}`, name: b, children: [], custom: true })),
  ];
}

function loadBins(): string[] {
  try {
    return JSON.parse(localStorage.getItem("editcut.fxBins") ?? "[]");
  } catch {
    return [];
  }
}

export default function EffectsPanel() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(["videoFx", "videoTr"]));
  const [sel, setSel] = useState<string | null>(null);
  const [bins, setBins] = useState<string[]>(loadBins);
  const [ver, setVer] = useState(0);
  const [filter, setFilter] = useState({ accel: false, bit32: false, yuv: false });
  useEffect(() => onUserPresetsChanged(() => setVer((v) => v + 1)), []);
  const defaultV = useTimeline((s) => s.defaultVideoTransition);
  const defaultA = useTimeline((s) => s.defaultAudioTransition);
  const tree = useMemo(() => buildTree(bins), [bins, ver]);

  const needle = q.trim().toLowerCase();
  const filterLeaf = (l: Leaf) => {
    if (needle && !(l.name + " " + l.desc).toLowerCase().includes(needle)) return false;
    if (l.kind === "effect") {
      if (filter.accel && !l.accel) return false;
      if (filter.yuv && !l.yuv) return false;
    } else if (filter.accel || filter.yuv) return false;
    return true;
  };
  const prune = (f: Folder): Folder | null => {
    const kids = f.children.map((c) => ("children" in c ? prune(c) : filterLeaf(c) ? c : null)).filter(Boolean) as (Folder | Leaf)[];
    if (!kids.length && (needle || filter.accel || filter.yuv)) return null;
    return { ...f, children: kids };
  };
  const shown = tree.map(prune).filter(Boolean) as Folder[];
  const forceOpen = !!needle;

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const apply = (l: Leaf) => {
    const st = useEditor.getState();
    if (l.kind === "effect") {
      const n = addEffectToClips(l.id, st.selection.clipIds);
      if (n) st.toast(`Applied ${l.name} to ${n} clip${n > 1 ? "s" : ""}`, "success");
    } else if (l.kind === "preset") {
      const n = applyPreset(l.id, st.selection.clipIds);
      if (n) st.toast(`Applied ${l.name} to ${n} clip${n > 1 ? "s" : ""}`, "success");
    } else applyTransitionAtPlayhead(l.id, l.audio);
  };

  const leafMenu = (e: React.MouseEvent, l: Leaf) => {
    const items = [{ label: l.kind === "transition" ? "Apply at Nearest Edit" : "Apply to Selected Clips", onClick: () => apply(l) }];
    if (l.kind === "transition")
      items.push({
        label: "Set Selected as Default Transition",
        onClick: () => {
          useTimeline.getState().set(l.audio ? { defaultAudioTransition: l.id } : { defaultVideoTransition: l.id });
          useEditor.getState().toast(`${l.name} is now the default ${l.audio ? "audio" : "video"} transition`);
        },
      });
    if (l.kind === "preset" && l.user) items.push({ label: "Delete Preset", onClick: () => deleteUserPreset(l.id.slice(5)) });
    showContextMenu(e, items);
  };

  const renderNode = (n: Folder | Leaf, depth: number): ReactNode => {
    if ("children" in n) {
      const isOpen = forceOpen || open.has(n.id);
      return (
        <div key={n.id}>
          <div
            className="fxp-row folder"
            style={{ paddingLeft: 6 + depth * 14 }}
            onClick={() => toggle(n.id)}
            onContextMenu={n.custom ? (e) => showContextMenu(e, [{ label: "Delete Bin", onClick: () => { const b = bins.filter((x) => `custom:${x}` !== n.id); setBins(b); localStorage.setItem("editcut.fxBins", JSON.stringify(b)); } }]) : undefined}
          >
            <span className={"twirl" + (isOpen ? " open" : "")}>▸</span>
            <FolderIcon open={isOpen} />
            <span className="fxp-name">{n.name}</span>
          </div>
          {isOpen ? n.children.map((c) => renderNode(c, depth + 1)) : null}
          {isOpen && n.custom && !n.children.length ? <div className="fxp-empty" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>Empty bin</div> : null}
        </div>
      );
    }
    const key = `${n.kind}:${n.id}`;
    const mime = n.kind === "effect" ? EFFECT_MIME : n.kind === "transition" ? TRANSITION_MIME : PRESET_MIME;
    const isDefault = n.kind === "transition" && (n.id === defaultV || n.id === defaultA);
    return (
      <div
        key={key}
        className={"fxp-row leaf" + (sel === key ? " selected" : "")}
        style={{ paddingLeft: 20 + depth * 14 }}
        draggable
        title={n.desc}
        onDragStart={(e) => {
          e.dataTransfer.setData(mime, n.id);
          e.dataTransfer.setData("text/plain", n.name);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => setSel(key)}
        onDoubleClick={() => apply(n)}
        onContextMenu={(e) => { setSel(key); leafMenu(e, n); }}
      >
        <LeafIcon leaf={n} isDefault={isDefault} />
        <span className="fxp-name">{n.name}</span>
        <span className="spacer" />
        {n.kind === "effect" ? (
          <span className="fxp-badges">
            <span className={"fxp-badge" + (n.accel ? " on" : "")} title="Accelerated (GPU)">▣</span>
            <span className={"fxp-badge" + (n.bit32 ? " on" : "")} title="32-bit color">32</span>
            <span className={"fxp-badge" + (n.yuv ? " on" : "")} title="YUV">YUV</span>
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fxp">
      <div className="fxp-toolbar">
        <TextInput value={q} onChange={setQ} placeholder="Search effects" style={{ flex: 1, minWidth: 60 }} />
        <button className={"fxp-filter" + (filter.accel ? " on" : "")} title="Show accelerated effects only" onClick={() => setFilter({ ...filter, accel: !filter.accel })}>▣</button>
        <button className={"fxp-filter" + (filter.bit32 ? " on" : "")} title="Show 32-bit effects only" onClick={() => setFilter({ ...filter, bit32: !filter.bit32 })}>32</button>
        <button className={"fxp-filter" + (filter.yuv ? " on" : "")} title="Show YUV effects only" onClick={() => setFilter({ ...filter, yuv: !filter.yuv })}>YUV</button>
      </div>
      <div className="fxp-tree">
        {shown.map((f) => renderNode(f, 0))}
        {!shown.length ? <div className="fxp-empty">No effects match “{q}”</div> : null}
      </div>
      <div className="fxp-foot">
        <span className="muted">{sel ? describe(sel, tree) : "Drag onto a clip, or double-click to apply"}</span>
        <span className="spacer" />
        <button
          className="fxp-filter"
          title="New Custom Bin"
          onClick={() => {
            const name = `Custom Bin ${bins.length + 1}`;
            const b = [...bins, name];
            setBins(b);
            try { localStorage.setItem("editcut.fxBins", JSON.stringify(b)); } catch { /* ignore */ }
          }}
        >
          <FolderIcon open={false} />+
        </button>
      </div>
    </div>
  );
}

function describe(key: string, tree: Folder[]): string {
  const find = (n: Folder | Leaf): Leaf | null => ("children" in n ? n.children.map(find).find(Boolean) ?? null : `${n.kind}:${n.id}` === key ? n : null);
  for (const f of tree) {
    const l = find(f);
    if (l) return l.desc;
  }
  return "";
}

/** Double-click a transition: apply at the edit nearest the playhead on targeted tracks of that kind. */
export function applyTransitionAtPlayhead(type: TransitionType, audio: boolean): void {
  const st = useEditor.getState();
  const seq = getActiveSequence();
  if (!seq) return;
  const t = usePlayback.getState().time;
  const dur = useTimeline.getState().defaultTransitionDuration ?? 1;
  let count = 0;
  st.applySeq(`Apply ${TRANSITION_MAP[type]?.name ?? type}`, (s) => {
    const kind = audio ? "audio" : "video";
    let tracks = s.tracks.filter((tr) => tr.kind === kind && tr.targeted && !tr.locked);
    if (!tracks.length) tracks = s.tracks.filter((tr) => tr.kind === kind && !tr.locked);
    for (const tr of tracks) {
      const clips = clipsOnTrack(s, tr.id);
      const pts = editPoints(s, [tr.id]).filter((p) => clips.some((c) => Math.abs(c.start - p) < 1e-6 || Math.abs(clipEnd(c) - p) < 1e-6));
      if (!pts.length) continue;
      const p = pts.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), pts[0]);
      if (addTransition(s, tr.id, p, type, dur)) count++;
    }
  });
  if (!count) st.toast("No edit point found on the targeted tracks", "error");
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="12" viewBox="0 0 16 13" className="fxp-folder">
      <path d={open ? "M1 2 H6 L7.5 3.5 H14 V5 H3.5 L1.5 11.5 Z M3.5 5 H15.5 L13.5 11.5 H1.5 Z" : "M1 1.5 H6 L7.5 3 H15 V11.5 H1 Z"} fill={open ? "#8a7a4a" : "#a08c55"} stroke="#5c5132" strokeWidth=".6" />
    </svg>
  );
}

function LeafIcon({ leaf, isDefault }: { leaf: Leaf; isDefault: boolean }) {
  if (leaf.kind === "transition")
    return (
      <svg width="16" height="12" viewBox="0 0 16 12" className={"fxp-icon" + (isDefault ? " default" : "")}>
        <rect x=".5" y=".5" width="15" height="11" rx="1.5" fill="#2c2c3c" stroke={isDefault ? "#2d8ceb" : "#666"} />
        <path d="M2 10 L14 2" stroke="#aaa" strokeWidth="1" />
        <path d="M2 2 H8 L2 10 Z" fill="#5a70d6" opacity=".8" />
      </svg>
    );
  if (leaf.kind === "preset")
    return (
      <svg width="16" height="12" viewBox="0 0 16 12" className="fxp-icon">
        <rect x=".5" y=".5" width="15" height="11" rx="1.5" fill="#33302a" stroke="#776" />
        <text x="8" y="9" fontSize="7" textAnchor="middle" fill="#e8c26a" fontWeight="700">P</text>
      </svg>
    );
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" className="fxp-icon">
      <rect x=".5" y=".5" width="15" height="11" rx="1.5" fill={leaf.audio ? "#23362a" : "#272c3c"} stroke={leaf.audio ? "#3fae4a" : "#5a70d6"} />
      <text x="8" y="9" fontSize="7" textAnchor="middle" fill={leaf.audio ? "#8fd99a" : "#a9b7ff"} fontStyle="italic" fontWeight="700">fx</text>
    </svg>
  );
}
