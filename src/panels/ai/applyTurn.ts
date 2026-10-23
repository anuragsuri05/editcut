// Applying Claude's streamed project states to the editor store so that one AI
// turn is ONE undo step (kept DOM-free so it can be unit-tested in node).
//  - first `project` event of a turn: apply("Claude: <prompt>") -> pushes a history entry
//  - later events of the same turn: replace the current project in place (same undo entry)
//  - if the user made their own edit meanwhile, the next AI event starts a new undo entry
import { freeze } from "immer";
import type { Project } from "@shared/types";
import { useEditor } from "../../store/store";

export interface TurnState { label: string; pastLen: number; applied: boolean }

/** Merge Claude's project with the live one: keep live media state (imports/proxies finishing), take transcripts. */
export function mergeProject(ai: Project, live: Project): Project {
  const media = { ...live.media };
  for (const [id, a] of Object.entries(ai.media)) {
    const cur = live.media[id];
    if (cur && a.transcript && !cur.transcript) media[id] = { ...cur, transcript: a.transcript };
  }
  return { ...ai, media, name: live.name, updatedAt: Date.now() };
}

export function applyProjectEvent(p: Project, turn: TurnState): void {
  const ed = useEditor.getState();
  const merged = mergeProject(p, ed.project);
  const ourEntryOnTop = turn.applied && ed.past.length === turn.pastLen + 1 && ed.past[ed.past.length - 1]?.label === turn.label;
  if (!ourEntryOnTop) {
    ed.apply(turn.label, (d) => {
      for (const k of Object.keys(d)) delete (d as unknown as Record<string, unknown>)[k];
      Object.assign(d, structuredClone(merged));
    });
    turn.pastLen = useEditor.getState().past.length - 1;
    turn.applied = true;
  } else {
    useEditor.setState({ project: freeze(merged, true), future: [], dirty: true });
  }
  // drop selections of clips that no longer exist
  const sel = useEditor.getState().selection;
  const live = useEditor.getState().project;
  const seqObj = live.activeSequenceId ? live.sequences[live.activeSequenceId] : undefined;
  if (sel.clipIds.length && seqObj) {
    const keep = sel.clipIds.filter((id) => seqObj.clips.some((c) => c.id === id));
    if (keep.length !== sel.clipIds.length) useEditor.getState().select({ clipIds: keep });
  }
}

