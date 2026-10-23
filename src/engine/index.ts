// EditCut playback engine — public API.
//
//   getProgramRenderer()        WebGL2 renderer whose canvas the Program Monitor shows
//   setProgramView(view)        tell the engine the Program Monitor's canvas size/options
//   renderSequenceFrame(seq, t, canvas?, opts?)  offline render of any sequence/time (seeks media first)
//   captureProgramFrame(maxW?)  JPEG data URL of the current program frame (for the AI)
//   playProgram(rate?) / playSource(rate?) / stopPlayback() / togglePlay(which?)
//   seekProgram(t) / seekSource(t)
//   transport.*                 J/K/L shuttle, step, play in→out, play around (see ./transport)
//   getAudioEngine()            meters, channel solo
//   getSourcePlayer()           the Source Monitor's media element
import type { Project, Sequence } from "@shared/types";
import { usePlayback } from "../store/playback";
import { getActiveSequence, useEditor } from "../store/store";
import { AudioEngine } from "./audio";
import { Renderer, type RenderOptions } from "./compositor";
import { mediaUrl, waitForFrame, waitForImage } from "./media";
import { SourcePlayer } from "./source";
import { collectVideoNeeds, syncVideos } from "./sync";
import * as transport from "./transport";

export { transport };
export type { Renderer, RenderOptions };
export { Renderer as RendererClass } from "./compositor";

export interface ProgramView {
  /** Canvas size in device pixels at full resolution. */
  width: number;
  height: number;
  transparencyGrid?: boolean;
  bypassEffects?: boolean;
  gridCell?: number;
}

let programRenderer: Renderer | null = null;
let offlineRenderer: Renderer | null = null;
let view: ProgramView | null = null;
let dirty = true;
let lastIncompleteRender = 0;
const audio = new AudioEngine();
let sourcePlayer: SourcePlayer | null = null;
let started = false;
const frameListeners = new Set<() => void>();

export function getProgramRenderer(): Renderer {
  if (!programRenderer) {
    programRenderer = new Renderer(() => (dirty = true));
    programRenderer.canvas.className = "program-canvas";
  }
  startEngine();
  return programRenderer;
}

export function getAudioEngine(): AudioEngine {
  return audio;
}

export function getSourcePlayer(): SourcePlayer {
  if (!sourcePlayer) sourcePlayer = new SourcePlayer();
  startEngine();
  return sourcePlayer;
}

export function setProgramView(v: ProgramView | null): void {
  view = v;
  dirty = true;
}

export function invalidateProgram(): void {
  dirty = true;
}

/** Called after each program frame render (e.g. scopes). */
export function onProgramFrame(fn: () => void): () => void {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
}

// ---------------------------------------------------------------- transport shortcuts

export const playProgram = (rate = 1) => transport.play("program", rate);
export const playSource = (rate = 1) => transport.play("source", rate);
export const stopPlayback = () => transport.stop();
export const togglePlay = (which: transport.Which = useEditor.getState().focusedMonitor) => transport.toggle(which);
export const seekProgram = (t: number) => transport.goTo("program", t);
export const seekSource = (t: number) => transport.goTo("source", t);

// ---------------------------------------------------------------- offline rendering

let queue: Promise<unknown> = Promise.resolve();

export interface FrameOptions {
  width?: number;
  height?: number;
  bypassEffects?: boolean;
  project?: Project;
}

/**
 * Render any sequence at time t into a 2D canvas (created if omitted), waiting
 * for media to seek/decode first. Calls are serialized.
 */
export function renderSequenceFrame(seq: Sequence, t: number, canvas?: HTMLCanvasElement | null, opts: FrameOptions = {}): Promise<HTMLCanvasElement> {
  const job = queue.then(async () => {
    if (!offlineRenderer) offlineRenderer = new Renderer(() => {});
    const r = offlineRenderer;
    const project = opts.project ?? useEditor.getState().project;
    const w = Math.round(opts.width ?? canvas?.width ?? seq.settings.width);
    const h = Math.round(opts.height ?? (w * seq.settings.height) / seq.settings.width);
    const images = new Set<string>();
    const needs = collectVideoNeeds(project, seq, t, 0, [], "", 1, 0, images).filter((n) => n.active);
    const waits: Promise<void>[] = [];
    for (const n of needs) {
      const pv = r.pool.video(n.key, mediaUrl(n.asset));
      pv.el.pause();
      if (Math.abs(pv.el.currentTime - (n.target + 0.001)) > 0.002 || pv.el.readyState < 2) pv.el.currentTime = n.target + 0.001;
      waits.push(waitForFrame(pv.el));
    }
    for (const url of images) waits.push(waitForImage(r.pool.image(url).img));
    await Promise.all(waits);
    // let rVFC/seeked handlers bump frame counters
    await new Promise((res) => setTimeout(res, 0));
    r.render(project, seq, t, { width: w, height: h, bypassEffects: opts.bypassEffects });
    const out = canvas ?? document.createElement("canvas");
    if (out.width !== w) out.width = w;
    if (out.height !== h) out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(r.canvas, 0, 0, w, h);
    r.pool.sweep(null, new Set(needs.map((n) => n.key)));
    return out;
  });
  queue = job.catch(() => undefined);
  return job;
}

/** JPEG data URL of the current Program Monitor frame (active sequence at the playhead). */
export async function captureProgramFrame(maxWidth = 1280, quality = 0.85): Promise<string> {
  const seq = getActiveSequence();
  if (!seq) throw new Error("No active sequence");
  const w = Math.min(maxWidth, seq.settings.width);
  const c = await renderSequenceFrame(seq, usePlayback.getState().time, null, { width: w });
  return c.toDataURL("image/jpeg", quality);
}

// ---------------------------------------------------------------- main loop

function frame(now: number) {
  requestAnimationFrame(frame);
  try {
    transport.tick(now);
    const ed = useEditor.getState();
    const pb = usePlayback.getState();
    const seq = getActiveSequence();
    const programPlaying = pb.playing === "program" && !pb.scrubbing;
    if (programRenderer && seq) {
      const needs = collectVideoNeeds(ed.project, seq, pb.time, 2);
      const keys = syncVideos(programRenderer.pool, needs, programPlaying, pb.rate, seq.settings.fps);
      programRenderer.pool.sweep(null, keys);
    }
    audio.syncProgram(ed.project, seq, pb.time, programPlaying, pb.rate);
    sourcePlayer?.sync();
    if (programRenderer && view) {
      const needIncomplete = programRenderer.incomplete && now - lastIncompleteRender > 60;
      if (dirty || programPlaying || needIncomplete) {
        dirty = false;
        if (needIncomplete) lastIncompleteRender = now;
        if (seq) {
          const res = programPlaying ? ed.playbackResolution : 1;
          // never render above sequence resolution; playback resolution scales while playing
          const width = Math.max(2, Math.round(Math.min(view.width, seq.settings.width) * res));
          const height = Math.max(2, Math.round((width * seq.settings.height) / seq.settings.width));
          programRenderer.render(ed.project, seq, pb.time, {
            width, height, playing: programPlaying, transparencyGrid: view.transparencyGrid, bypassEffects: view.bypassEffects,
            gridCell: Math.max(4, Math.round((view.gridCell ?? 8) * (width / Math.max(1, view.width)))),
          });
          if (programRenderer.incomplete && !needIncomplete) lastIncompleteRender = now;
          if (programPlaying && programRenderer.incomplete) usePlayback.getState().set({ droppedFrames: pb.droppedFrames + 1 });
        } else programRenderer.renderEmpty(view.width, view.height);
        frameListeners.forEach((f) => f());
      }
    }
    audio.meterTick(now, pb.playing !== null && !pb.scrubbing);
  } catch (err) {
    console.error("[engine] frame error", err);
  }
}

export function startEngine(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  transport.installTransportKeys();
  transport.setOnPlayStart(() => {
    audio.ensure();
    if (usePlayback.getState().playing === "source") audio.attachSourceElement(getSourcePlayer().el);
  });
  usePlayback.subscribe((s, p) => {
    if (s.time !== p.time || s.playing !== p.playing) dirty = true;
  });
  useEditor.subscribe((s, p) => {
    if (s.project !== p.project || s.proxiesEnabled !== p.proxiesEnabled || s.playbackResolution !== p.playbackResolution) dirty = true;
  });
  requestAnimationFrame(frame);
}

startEngine();
