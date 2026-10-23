// Tool definitions (Tools panel + tool.* commands), Premiere grouping.
import type { ReactNode } from "react";
import {
  ChevronsLeft, ChevronsRight, Circle, Hand, MousePointer2, PenTool, Scissors, Square, Type, ZoomIn,
} from "lucide-react";
import type { ToolId } from "../../store/store";

export interface ToolDef {
  id: ToolId;
  label: string;
  key?: string;
  icon: ReactNode;
}

const S = 16;

/** Custom glyphs for the trim tools (lucide has no bracket icons). */
const Glyph = (props: { d: string; color?: string }) => (
  <svg width={S} height={S} viewBox="0 0 16 16" fill="none" stroke={props.color ?? "currentColor"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={props.d} />
  </svg>
);

export const TOOL_DEFS: Record<ToolId, ToolDef> = {
  select: { id: "select", label: "Selection Tool", key: "V", icon: <MousePointer2 size={S} /> },
  trackForward: { id: "trackForward", label: "Track Select Forward Tool", key: "A", icon: <ChevronsRight size={S} /> },
  trackBackward: { id: "trackBackward", label: "Track Select Backward Tool", key: "Shift+A", icon: <ChevronsLeft size={S} /> },
  ripple: { id: "ripple", label: "Ripple Edit Tool", key: "B", icon: <Glyph d="M6 2H3v12h3M10 5l3 3-3 3M13 8H8" /> },
  roll: { id: "roll", label: "Rolling Edit Tool", key: "N", icon: <Glyph d="M6 2H4v12h2M10 2h2v12h-2M1 8h2M13 8h2" /> },
  rateStretch: { id: "rateStretch", label: "Rate Stretch Tool", key: "R", icon: <Glyph d="M2 3v10M14 3v10M4 8h8M6 6 4 8l2 2M10 6l2 2-2 2" /> },
  razor: { id: "razor", label: "Razor Tool", key: "C", icon: <Scissors size={S} /> },
  slip: { id: "slip", label: "Slip Tool", key: "Y", icon: <Glyph d="M5 3v10M11 3v10M1 8h3M12 8h3M7 6l-2 2 2 2M9 6l2 2-2 2" /> },
  slide: { id: "slide", label: "Slide Tool", key: "U", icon: <Glyph d="M3 3v10M13 3v10M6 5h4v6H6zM1 8h2M13 8h2" /> },
  pen: { id: "pen", label: "Pen Tool", key: "P", icon: <PenTool size={S} /> },
  rectangle: { id: "rectangle", label: "Rectangle Tool", icon: <Square size={S} /> },
  ellipse: { id: "ellipse", label: "Ellipse Tool", icon: <Circle size={S} /> },
  hand: { id: "hand", label: "Hand Tool", key: "H", icon: <Hand size={S} /> },
  zoom: { id: "zoom", label: "Zoom Tool", key: "Z", icon: <ZoomIn size={S} /> },
  type: { id: "type", label: "Type Tool", key: "T", icon: <Type size={S} /> },
};

/** Tool slots in Premiere's Tools panel (grouped tools share a slot with a flyout). */
export const TOOL_GROUPS: ToolId[][] = [
  ["select"],
  ["trackForward", "trackBackward"],
  ["ripple", "roll", "rateStretch"],
  ["razor"],
  ["slip", "slide"],
  ["pen", "rectangle", "ellipse"],
  ["hand", "zoom"],
  ["type"],
];
