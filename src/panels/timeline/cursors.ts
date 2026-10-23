// Premiere-style tool / trim cursors as inline SVG data URIs.
const RED = "#ff4b4b";
const YEL = "#ffd23c";

function svg(body: string, hx = 12, hy = 12, fallback = "default"): string {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>${body}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}") ${hx} ${hy}, ${fallback}`;
}

const outline = (d: string, color: string, w = 2) =>
  `<path d='${d}' fill='none' stroke='#000' stroke-width='${w + 2}' stroke-linecap='round' stroke-linejoin='round'/>` +
  `<path d='${d}' fill='none' stroke='${color}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'/>`;

export const CURSORS = {
  trimIn: svg(outline("M14 4h-3v16h3M11 12H4M7 9l-3 3 3 3", RED), 11, 12, "col-resize"),
  trimOut: svg(outline("M10 4h3v16h-3M13 12h7M17 9l3 3-3 3", RED), 13, 12, "col-resize"),
  rippleIn: svg(outline("M14 4h-3v16h3M11 12H4M7 9l-3 3 3 3", YEL), 11, 12, "col-resize"),
  rippleOut: svg(outline("M10 4h3v16h-3M13 12h7M17 9l3 3-3 3", YEL), 13, 12, "col-resize"),
  roll: svg(outline("M9 4h2v16H9M15 4h-2v16h2M3 12h4M17 12h4", RED), 12, 12, "col-resize"),
  rate: svg(outline("M4 5v14M20 5v14M7 12h10M9 9l-3 3 3 3M15 9l3 3-3 3", RED), 12, 12, "ew-resize"),
  razor: svg(
    outline("M6 7a2.5 2.5 0 1 0 0 .01M6 17a2.5 2.5 0 1 0 0 .01M8 8.5 20 18M8 15.5 20 6", "#fff", 1.6),
    20, 12, "crosshair",
  ),
  slip: svg(outline("M8 4v16M16 4v16M2 12h4M18 12h4M11 9l-2 3 2 3M13 9l2 3-2 3", "#fff", 1.6), 12, 12, "ew-resize"),
  slide: svg(outline("M4 4v16M20 4v16M8 8h8v8H8zM1 12h3M20 12h3", "#fff", 1.6), 12, 12, "ew-resize"),
  pen: svg(outline("M4 20l3-1 11-11-2-2L5 17zM14 6l2-2 2 2-2 2", "#fff", 1.6), 4, 20, "crosshair"),
  penAdd: svg(outline("M4 20l3-1 11-11-2-2L5 17zM14 6l2-2 2 2-2 2M18 16v6M15 19h6", "#fff", 1.6), 4, 20, "crosshair"),
  trackForward: svg(outline("M4 6l6 6-6 6M12 6l6 6-6 6", "#fff", 1.8), 4, 12, "e-resize"),
  trackBackward: svg(outline("M20 6l-6 6 6 6M12 6l-6 6 6 6", "#fff", 1.8), 20, 12, "w-resize"),
  hand: "grab",
  handDrag: "grabbing",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
  type: "text",
  move: "default",
  band: "ns-resize",
};
