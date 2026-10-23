// Live (non-undoable) editing with a single undo entry per gesture.
//
// Pattern used by every inspector control in this folder:
//   onChange (fires many times while dragging / typing)  -> live(fn)
//   onCommit (fires once at the end of the gesture)      -> commit(label, fn)
//
// live() captures the project as it was BEFORE the first change of a gesture and
// patches the store without history. commit() applies the final value and pushes
// ONE history entry whose snapshot is the pre-gesture project, so Undo restores
// the value from before the drag. If something else changed the project in the
// middle of a gesture (another apply), the gesture restarts from the current
// project so we never undo someone else's edit.
import type { Project, Sequence } from "@shared/types";
import { useEditor } from "../../store/store";

const MAX_HISTORY = 200;

let session: { before: Project; after: Project } | null = null;

function current(): Project {
  return useEditor.getState().project;
}

/** Live, non-undoable project mutation (call repeatedly during a drag). */
export function live(fn: (draft: Project) => void): void {
  const now = current();
  if (!session || session.after !== now) session = { before: now, after: now };
  useEditor.getState().patch(fn);
  session.after = current();
}

/** Final mutation of a gesture: records a single undo step labelled `label`. */
export function commit(label: string, fn?: (draft: Project) => void): void {
  const now = current();
  const s = session && session.after === now ? session : null;
  session = null;
  if (!s) {
    // No live phase (click, typed value, menu): a normal undoable apply.
    if (fn) useEditor.getState().apply(label, fn);
    return;
  }
  if (fn) useEditor.getState().patch(fn);
  const after = current();
  if (after === s.before) return;
  useEditor.setState((st) => ({
    project: after,
    past: [...st.past, { label, project: s.before, time: Date.now() }].slice(-MAX_HISTORY),
    future: [],
    dirty: true,
  }));
}

/** Abandon a live gesture, restoring the pre-gesture project (e.g. Escape). */
export function cancelLive(): void {
  if (session && session.after === current()) useEditor.setState({ project: session.before });
  session = null;
}

function withSeq(fn: (seq: Sequence, p: Project) => void) {
  return (d: Project) => {
    const id = d.activeSequenceId;
    const seq = id ? d.sequences[id] : undefined;
    if (seq) fn(seq, d);
  };
}

/** live() on the active sequence. */
export function liveSeq(fn: (seq: Sequence, p: Project) => void): void {
  live(withSeq(fn));
}

/** commit() on the active sequence. */
export function commitSeq(label: string, fn?: (seq: Sequence, p: Project) => void): void {
  commit(label, fn ? withSeq(fn) : undefined);
}

/**
 * Convenience for a value control: returns {onChange, onCommit} handlers that run the
 * same sequence mutation live while dragging and once more as the undoable commit.
 */
export function seqHandlers<T>(label: string, fn: (seq: Sequence, v: T, p: Project) => void) {
  return {
    onChange: (v: T) => liveSeq((s, p) => fn(s, v, p)),
    onCommit: (v: T) => commitSeq(label, (s, p) => fn(s, v, p)),
  };
}
