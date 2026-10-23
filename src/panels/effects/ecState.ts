// UI-only state for the inspector panels (not in undo history).
import { create } from "zustand";
import type { Effect } from "@shared/types";

export interface EcState {
  /** Effect selected in Effect Controls (clicked header) — target of Delete / Copy. */
  selectedFx: { clipId: string; fxId: string } | null;
  /** Effect clipboard (Copy / Cut in Effect Controls, Paste onto clips). */
  clipboard: Effect[];
  /** Mini-timeline spans just the clip (true) or the whole sequence. */
  pinToClip: boolean;
  showTimeline: boolean;
  /** Fraction of the panel width used by the property tree. */
  split: number;
  set: (p: Partial<EcState>) => void;
}

function loadSplit(): number {
  try {
    const v = Number(localStorage.getItem("editcut.ec.split"));
    return v > 0.2 && v < 0.85 ? v : 0.56;
  } catch {
    return 0.56;
  }
}

export const useEc = create<EcState>()((set) => ({
  selectedFx: null,
  clipboard: [],
  pinToClip: true,
  showTimeline: true,
  split: loadSplit(),
  set: (p) => {
    if (p.split !== undefined) {
      try {
        localStorage.setItem("editcut.ec.split", String(p.split));
      } catch {
        /* ignore */
      }
    }
    set(p);
  },
}));
