// Draws generator clips (text, shapes, mattes...) and captions onto a 2D canvas
// at SEQUENCE resolution, centered in the frame, BEFORE motion/opacity/effects.
// Used by the preview engine (as a texture source) and by export (rendered to PNG
// and sent to the server), so titles look identical in preview and output.
import type { Clip, Generator, SequenceSettings, TextStyle } from "@shared/types";

export function drawGenerator(ctx: CanvasRenderingContext2D, gen: Generator, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  switch (gen.kind) {
    case "colorMatte":
      ctx.fillStyle = gen.color;
      ctx.fillRect(0, 0, width, height);
      break;
    case "blackVideo":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      break;
    case "bars": {
      const colors = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
      const w = width / colors.length;
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w), height * 0.75);
      });
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, height * 0.75, width, height * 0.25);
      break;
    }
    case "shape": {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.beginPath();
      if (gen.shape === "ellipse") ctx.ellipse(0, 0, gen.width / 2, gen.height / 2, 0, 0, Math.PI * 2);
      else roundRect(ctx, -gen.width / 2, -gen.height / 2, gen.width, gen.height, gen.radius ?? 0);
      ctx.fillStyle = gen.fill;
      ctx.fill();
      if (gen.stroke && gen.strokeWidth) {
        ctx.strokeStyle = gen.stroke;
        ctx.lineWidth = gen.strokeWidth;
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "text":
      drawText(ctx, gen.style, width, height);
      break;
    case "adjustmentLayer":
      break; // transparent; the engine applies its effects to layers below
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Measure the text block (for selection boxes in the Program Monitor). */
export function measureText(ctx: CanvasRenderingContext2D, s: TextStyle): { width: number; height: number } {
  ctx.font = fontString(s);
  const lines = s.text.split("\n");
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width + Math.max(0, l.length - 1) * s.letterSpacing));
  return { width, height: lines.length * s.fontSize * s.lineHeight };
}

export function fontString(s: TextStyle): string {
  return `${s.italic ? "italic " : ""}${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
}

export function drawText(ctx: CanvasRenderingContext2D, s: TextStyle, width: number, height: number): void {
  ctx.save();
  ctx.font = fontString(s);
  ctx.textBaseline = "middle";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${s.letterSpacing}px`;
  const lines = s.text.split("\n");
  const lh = s.fontSize * s.lineHeight;
  const { width: blockW, height: blockH } = measureText(ctx, s);
  const cx = width / 2;
  const top = height / 2 - blockH / 2;
  const x = s.align === "left" ? cx - blockW / 2 : s.align === "right" ? cx + blockW / 2 : cx;
  ctx.textAlign = s.align;
  if (s.background) {
    const pad = s.background.padding;
    ctx.fillStyle = s.background.color;
    ctx.beginPath();
    roundRect(ctx, cx - blockW / 2 - pad, top - pad, blockW + pad * 2, blockH + pad * 2, s.background.radius);
    ctx.fill();
  }
  lines.forEach((line, i) => {
    const y = top + lh * i + lh / 2;
    if (s.shadow) {
      ctx.shadowColor = s.shadow.color;
      ctx.shadowBlur = s.shadow.blur;
      ctx.shadowOffsetX = s.shadow.offsetX;
      ctx.shadowOffsetY = s.shadow.offsetY;
    }
    if (s.strokeColor && s.strokeWidth) {
      ctx.lineJoin = "round";
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth * 2;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = s.color;
    ctx.fillText(line, x, y);
    ctx.shadowColor = "transparent";
  });
  ctx.restore();
}

/** Default caption look (Premiere-style subtitle at bottom). */
export const CAPTION_STYLE = {
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  fontWeight: 600,
  sizeRatio: 0.045, // of frame height
  color: "#ffffff",
  background: "rgba(0,0,0,0.75)",
  bottomRatio: 0.08,
};

export function drawCaption(ctx: CanvasRenderingContext2D, text: string, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  const size = Math.round(height * CAPTION_STYLE.sizeRatio);
  ctx.save();
  ctx.font = `${CAPTION_STYLE.fontWeight} ${size}px ${CAPTION_STYLE.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, width * 0.8);
  const lh = size * 1.3;
  let y = height - height * CAPTION_STYLE.bottomRatio - lh * (lines.length - 1) - lh / 2;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    ctx.fillStyle = CAPTION_STYLE.background;
    ctx.fillRect(width / 2 - w / 2 - size * 0.35, y - lh / 2, w + size * 0.7, lh);
    ctx.fillStyle = CAPTION_STYLE.color;
    ctx.fillText(line, width / 2, y);
    y += lh;
  }
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

/** Render a generator/caption clip to a PNG data URL at sequence resolution (for export). */
export function renderClipToPNG(clip: Clip, seq: SequenceSettings): string | null {
  if (!clip.generator && !clip.caption) return null;
  const canvas = document.createElement("canvas");
  canvas.width = seq.width;
  canvas.height = seq.height;
  const ctx = canvas.getContext("2d")!;
  if (clip.generator) drawGenerator(ctx, clip.generator, seq.width, seq.height);
  else if (clip.caption) drawCaption(ctx, clip.caption.text, seq.width, seq.height);
  return canvas.toDataURL("image/png");
}
