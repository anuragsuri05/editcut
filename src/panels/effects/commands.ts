// Registers graphics.* and effects.* commands and this area's dialogs.
import { registerCommands } from "../../commands/registry";
import { registerDialog } from "../../ui/dialogs";
import { useEditor, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { deleteSelectedKeyframes, getParam, keyframeTimes, localTime } from "./model";
import { useEc } from "./ecState";
import { pasteEffects, removeEffect } from "./EffectControlsPanel";
import { alignSelected, newShape, newText, upgradeCaptionsToGraphic } from "./graphicsOps";
import { SavePresetDialog, TitleTemplatesDialog } from "./dialogs";
import type { Clip } from "@shared/types";

const ed = () => useEditor.getState();
const hasSeq = () => !!getActiveSequence();
const hasSel = () => ed().selection.clipIds.length > 0;

function selectedClipList(): Clip[] {
  const seq = getActiveSequence();
  if (!seq) return [];
  const ids = new Set(ed().selection.clipIds);
  return seq.clips.filter((c) => ids.has(c.id));
}

/** All animated param paths of a clip (for keyframe navigation). */
function animatedPaths(c: Clip): string[] {
  const out: string[] = [];
  if (c.motion) for (const k of Object.keys(c.motion)) if (getParam(c, `motion.${k}`)?.keyframes?.length) out.push(`motion.${k}`);
  if (c.opacity?.opacity.keyframes?.length) out.push("opacity.opacity");
  if (c.audio) for (const k of ["volumeDb", "pan"]) if (getParam(c, `audio.${k}`)?.keyframes?.length) out.push(`audio.${k}`);
  for (const fx of c.effects) for (const [k, p] of Object.entries(fx.params)) if (p.keyframes?.length) out.push(`fx.${fx.id}.${k}`);
  return out;
}

function gotoKf(dir: -1 | 1) {
  const c = selectedClipList()[0];
  if (!c) return;
  const ts = keyframeTimes(c, animatedPaths(c));
  const lt = localTime(c);
  const t = dir < 0 ? [...ts].reverse().find((x) => x < lt - 1e-3) : ts.find((x) => x > lt + 1e-3);
  if (t !== undefined) usePlayback.getState().setTime(c.start + t);
}

registerCommands([
  // ---------------- Graphics and Titles
  { id: "graphics.newText", label: "New Layer: Text", keys: ["Mod+T"], run: newText, enabled: hasSeq },
  { id: "graphics.newRectangle", label: "New Layer: Rectangle", keys: ["Mod+Alt+R"], run: () => newShape("rectangle"), enabled: hasSeq },
  { id: "graphics.newEllipse", label: "New Layer: Ellipse", keys: ["Mod+Alt+E"], run: () => newShape("ellipse"), enabled: hasSeq },
  { id: "graphics.alignCenter", label: "Align Center in Video Frame", run: () => alignSelected("center"), enabled: hasSel },
  { id: "graphics.alignHCenter", label: "Align Horizontal Center", run: () => alignSelected("hcenter"), enabled: hasSel },
  { id: "graphics.alignVCenter", label: "Align Vertical Center", run: () => alignSelected("vcenter"), enabled: hasSel },
  { id: "graphics.alignLeft", label: "Align Left in Video Frame", run: () => alignSelected("left"), enabled: hasSel },
  { id: "graphics.alignRight", label: "Align Right in Video Frame", run: () => alignSelected("right"), enabled: hasSel },
  { id: "graphics.alignTop", label: "Align Top in Video Frame", run: () => alignSelected("top"), enabled: hasSel },
  { id: "graphics.alignBottom", label: "Align Bottom in Video Frame", run: () => alignSelected("bottom"), enabled: hasSel },
  { id: "graphics.titleTemplates", label: "Title Templates…", run: () => ed().openDialog("graphics.titleTemplates"), enabled: hasSeq },
  { id: "graphics.upgradeCaptionsToGraphic", label: "Upgrade Captions to Graphic", run: upgradeCaptionsToGraphic, enabled: hasSeq },

  // ---------------- Effect Controls (panel-scoped)
  {
    id: "effects.deleteSelection", label: "Clear Selected Keyframes / Effect", keys: ["Delete", "Backspace"], scope: "effectControls",
    run: () => {
      if (deleteSelectedKeyframes()) return;
      const sf = useEc.getState().selectedFx;
      if (sf) removeEffect(sf.clipId, sf.fxId);
    },
  },
  {
    id: "effects.copy", label: "Copy Effect", keys: ["Mod+C"], scope: "effectControls",
    run: () => {
      const sf = useEc.getState().selectedFx;
      const c = selectedClipList().find((x) => x.id === sf?.clipId);
      const fx = c?.effects.find((e) => e.id === sf?.fxId);
      if (fx) {
        useEc.getState().set({ clipboard: [JSON.parse(JSON.stringify(fx))] });
        ed().toast("Effect copied");
      } else {
        const all = selectedClipList()[0]?.effects ?? [];
        if (all.length) {
          useEc.getState().set({ clipboard: JSON.parse(JSON.stringify(all)) });
          ed().toast(`Copied ${all.length} effect${all.length > 1 ? "s" : ""}`);
        }
      }
    },
  },
  { id: "effects.paste", label: "Paste Effects", keys: ["Mod+V"], scope: "effectControls", run: pasteEffects, enabled: () => useEc.getState().clipboard.length > 0 },
  {
    id: "effects.selectAllKeyframes", label: "Select All Keyframes", keys: ["Mod+A"], scope: "effectControls",
    run: () => {
      const keys: string[] = [];
      for (const c of selectedClipList())
        for (const path of animatedPaths(c)) (getParam(c, path)?.keyframes ?? []).forEach((_, i) => keys.push(`${c.id}|${path}|${i}`));
      ed().select({ keyframes: keys });
    },
  },
  { id: "effects.prevKeyframe", label: "Go to Previous Keyframe", run: () => gotoKf(-1), enabled: hasSel },
  { id: "effects.nextKeyframe", label: "Go to Next Keyframe", run: () => gotoKf(1), enabled: hasSel },
  {
    id: "effects.removeEffects", label: "Remove Effects…", enabled: hasSel,
    run: () => ed().applySeq("Remove Effects", (s) => { const ids = new Set(ed().selection.clipIds); for (const c of s.clips) if (ids.has(c.id)) c.effects = []; }),
  },
  {
    id: "effects.savePreset", label: "Save Preset…", enabled: hasSel,
    run: () => {
      const c = selectedClipList()[0];
      if (c?.effects.length) ed().openDialog("effects.savePreset", { clipId: c.id, effectIds: c.effects.map((e) => e.id) });
      else ed().toast("The selected clip has no effects to save", "error");
    },
  },
]);

registerDialog("effects.savePreset", SavePresetDialog as never);
registerDialog("graphics.titleTemplates", TitleTemplatesDialog as never);

