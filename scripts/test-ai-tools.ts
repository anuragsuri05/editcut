// End-to-end test of the AI editing tools against real media (no API key needed).
//   npx tsx scripts/test-ai-tools.ts
// Builds a project from samples/, runs every tool implementation directly, runs the
// agent loop against a scripted fake model, and checks the /api/ai/chat SSE route.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "editcut-ai-test-"));
process.env.EDITCUT_DATA = DATA;
delete process.env.ANTHROPIC_API_KEY;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = (f: string) => path.join(ROOT, "samples", f);

const { runTool, TOOLS, apiToolDefinitions } = await import("../server/ai/tools");
const { runAgentTurn, buildRequestParams, compactHistory } = await import("../server/ai/agent");
const { sequenceWords, findFillers, flattenWords } = await import("../server/ai/editOps");
const { makeProject, uid } = await import("../shared/factory");
const { sequenceDuration, clipEnd, tracksOfKind, clipsOnTrack } = await import("../shared/ops");
type Project = import("../shared/types").Project;
type MediaAsset = import("../shared/types").MediaAsset;
type AIEvent = import("../src/api").AIEvent;

let pass = 0, failCount = 0;
const results: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) pass++;
  else failCount++;
  const line = `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`;
  results.push(line);
  console.log(line);
}

function probe(file: string): MediaAsset {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file]).toString());
  const v = j.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  const a = j.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  const isImage = /\.(png|jpe?g)$/i.test(file);
  const [n, d] = String(v?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    id: uid("med_"), name: path.basename(file), kind: isImage ? "image" : v ? "video" : "audio", path: file, url: "", duration: isImage ? 5 : Number(j.format.duration),
    width: v?.width, height: v?.height, fps: v && !isImage ? n / (d || 1) : undefined, hasVideo: !!v, hasAudio: !!a, audioChannels: a?.channels, sampleRate: a ? Number(a.sample_rate) : undefined,
    sizeBytes: Number(j.format.size), markers: [], status: "ready", importedAt: Date.now(),
  };
}

const project: Project = makeProject("AI tool test");
const assets: Record<string, MediaAsset> = {};
for (const f of ["talking_head_speech.mp4", "clip_testsrc_1080p.mp4", "music.mp3", "photo.png", "greenscreen.mp4", "speech.aiff", "bars_720p_noaudio.mp4"]) {
  const a = probe(S(f));
  project.media[a.id] = a;
  project.items.push({ id: a.id, type: "media", name: a.name, parentId: null });
  assets[f] = a;
}
const TH = assets["talking_head_speech.mp4"].id, TEST = assets["clip_testsrc_1080p.mp4"].id, MUSIC = assets["music.mp3"].id, PHOTO = assets["photo.png"].id, AIFF = assets["speech.aiff"].id, GREEN = assets["greenscreen.mp4"].id;

const events: AIEvent[] = [];
const ctx = { project, playhead: 0, selection: { clipIds: [] as string[], itemIds: [] as string[] }, signal: new AbortController().signal, emit: (e: AIEvent) => events.push(e) };
const seq = () => project.sequences[project.activeSequenceId!];

async function T(name: string, input: unknown, expectError = false) {
  const t0 = Date.now();
  const r = await runTool(name, input, ctx);
  const ms = Date.now() - t0;
  check(`${name}${expectError ? " (expected error)" : ""}`, r.isError === expectError, `${r.output.summary ?? r.output.text.split("\n")[0]} [${ms}ms]`);
  return r;
}

// ---------------------------------------------------------------- schemas
const defs = apiToolDefinitions();
check("tool count", defs.length === TOOLS.length && defs.length >= 35, `${defs.length} tools`);
check("schemas are objects with additionalProperties:false", defs.every((d) => d.input_schema.type === "object" && d.input_schema.additionalProperties === false), "");
const params = buildRequestParams([{ role: "user", content: "hi" }], "claude-opus-5-5");
check("request params", params.model === "claude-opus-5-5" && params.max_tokens === 64000 && params.thinking?.type === "adaptive" && params.output_config?.effort === "high" && params.tool_choice?.type === "auto" && params.fallbacks === "default" && !!params.betas?.includes("server-side-fallback-2026-07-01"), `tools=${params.tools?.length}, ${JSON.stringify(params).length} bytes`);
const haiku = buildRequestParams([{ role: "user", content: "hi" }], "claude-haiku-5-5");
check("haiku omits fallbacks", haiku.fallbacks === undefined && haiku.betas === undefined);

// ---------------------------------------------------------------- inspection + transcription
await T("list_media", {});
await T("get_timeline", {});
await T("append_clips", { clips: [{ asset_id: TH }] }, true); // no sequence yet
await T("create_sequence", { name: "Main", preset: "hd1080p30" });
check("sequence created", seq()?.settings.width === 1920 && seq()?.settings.fps === 30);

let r = await T("transcribe_media", { asset_id: TH });
const thWords = flattenWords(project.media[TH]);
check("talking head transcript", thWords.length >= 25 && /welcome/i.test(r.output.text), `${thWords.length} words; "${thWords.slice(0, 8).map((w) => w.text).join(" ")}"`);
const fillersTH = findFillers(thWords);
check("filler detection (source)", fillersTH.length >= 1, fillersTH.map((f) => `${f.text}@${f.start}-${f.end}`).join(", "));
r = await T("transcribe_media", { asset_id: AIFF });
const aiffWords = flattenWords(project.media[AIFF]);
check("speech.aiff transcript", aiffWords.length >= 25, `${aiffWords.length} words, fillers: ${findFillers(aiffWords).map((f) => f.text).join(" ")}`);
r = await T("transcribe_media", { asset_id: TH });
check("transcript cache", /cached/.test(r.output.summary ?? ""), r.output.summary);
await T("get_transcript", { asset_id: TH, start: 0, end: 5 });
check("transcript cached on disk", fs.existsSync(path.join(DATA, "media", TH, "transcript.json")));

// ---------------------------------------------------------------- assembly
await T("append_clips", { clips: [{ asset_id: TH }, { asset_id: TEST, source_in: 2, source_out: 5 }, { asset_id: PHOTO, still_duration: 2 }] });
const v1 = tracksOfKind(seq(), "video")[0];
check("rough cut assembled", Math.abs(sequenceDuration(seq()) - (14 + 3 + 2)) < 0.05 && clipsOnTrack(seq(), v1.id).length === 3, `duration ${sequenceDuration(seq()).toFixed(2)}s, ${seq().clips.length} clips`);
await T("append_clips", { clips: [{ asset_id: TEST, source_in: 9, source_out: 12 }] }, true);

// ---------------------------------------------------------------- text-based cleanup
const before = sequenceDuration(seq());
r = await T("remove_filler_words", { dry_run: true });
r = await T("remove_filler_words", {});
const afterFill = sequenceDuration(seq());
const remainingFillers = findFillers(sequenceWords(project, seq()));
check("fillers removed from timeline", afterFill < before - 0.3 && remainingFillers.length === 0, `${before.toFixed(2)}s → ${afterFill.toFixed(2)}s; ${r.output.text.split(":")[0]}`);
r = await T("detect_silences", { asset_id: TH, min_duration: 0.35, noise_db: -35 });
r = await T("detect_silences", { asset_id: TH, min_duration: 0.35, remove: true, padding: 0.08 });
check("silences tightened", sequenceDuration(seq()) <= afterFill, `${afterFill.toFixed(2)}s → ${sequenceDuration(seq()).toFixed(2)}s`);
// sanity: linked V/A of talking head still aligned
const thClips = seq().clips.filter((c) => c.assetId === TH);
const misaligned = thClips.filter((c) => c.linkId && seq().clips.some((o) => o.linkId === c.linkId && o.id !== c.id && (Math.abs(o.start - c.start) > 1e-3 || Math.abs(o.duration - c.duration) > 1e-3 || Math.abs(o.sourceIn - c.sourceIn) > 1e-3)));
check("A/V sync preserved after ripple deletes", misaligned.length === 0, `${thClips.length} talking-head pieces`);

// ---------------------------------------------------------------- captions & text
r = await T("add_captions", { style: "standard", max_chars_per_line: 42, lines: 2 });
const capTrack = tracksOfKind(seq(), "caption")[0];
const caps = clipsOnTrack(seq(), capTrack.id);
const overlaps = caps.filter((c, i) => i > 0 && c.start < clipEnd(caps[i - 1]) - 1e-6).length;
const tooLong = caps.filter((c) => c.caption!.text.split("\n").some((l) => l.length > 42) || c.caption!.text.split("\n").length > 2).length;
check("standard captions", caps.length >= 3 && overlaps === 0 && tooLong === 0, `${caps.length} captions, first "${caps[0]?.caption?.text.replace("\n", " / ")}" ${caps[0]?.start}-${clipEnd(caps[0])}`);
const words = sequenceWords(project, seq());
const capDrift = caps.map((c) => Math.min(...words.map((w) => Math.abs(w.start - c.start)))).reduce((a, b) => Math.max(a, b), 0);
check("captions start on word timings", capDrift < 0.01, `max drift ${capDrift.toFixed(3)}s`);
r = await T("add_captions", { style: "social" });
const social = seq().clips.filter((c) => c.generator?.kind === "text" && seq().tracks.find((t) => t.id === c.trackId)?.name === "Captions");
check("social captions", social.length >= caps.length, `${social.length} word groups, e.g. "${social[0]?.generator?.kind === "text" ? social[0].generator.style.text : ""}"`);
await T("update_text", { edits: [{ clip_id: caps[0].id, text: "Hola a todos" }] });
check("caption edited", seq().clips.find((c) => c.id === caps[0].id)?.caption?.text === "Hola a todos");
r = await T("add_text", { text: "EditCut Demo", start: 0, duration: 4, position: "center" });
r = await T("add_text", { text: "Laksh Sharma\\nCreator", start: 1, duration: 4, position: "lower_third", style: { color: "#ffcc00" } });

// ---------------------------------------------------------------- transitions / color / effects
r = await T("add_transition", { all_cuts: true, type: "crossDissolve", duration: 0.5, include_audio: true });
check("transitions at cuts", seq().transitions.length >= 2, `${seq().transitions.length} transitions`);
await T("add_transition", { at: 0, type: "dipToBlack", duration: 1 });
await T("add_transition", { at: 3, type: "notATransition" }, true);
r = await T("apply_color_grade", { look: "Cinematic Teal-Orange", intensity: 80, params: { contrast: 15, saturation: 110 } });
const graded = seq().clips.filter((c) => c.effects.some((e) => e.type === "lumetri"));
check("lumetri on clips", graded.length >= 3 && graded[0].effects[0].options?.look === "Cinematic Teal-Orange", `${graded.length} clips`);
r = await T("apply_color_grade", { target: "adjustment_layer", look: "Warm Film" });
await T("apply_color_grade", { look: "Nope" }, true);
const vclip = seq().clips.find((c) => c.assetId === TEST && seq().tracks.find((t) => t.id === c.trackId)?.kind === "video")!;
await T("add_effect", { clip_ids: [vclip.id], type: "gaussianBlur", params: { blurriness: 500 } });
check("param clamped", vclip.effects.find((e) => e.type === "gaussianBlur")?.params.blurriness.value === 200);
let thVideo = seq().clips.find((c) => c.assetId === TH && seq().tracks.find((t) => t.id === c.trackId)?.kind === "video")!;
await T("add_effect", { clip_ids: [thVideo.id], type: "denoise", params: { amount: 50 } });
check("audio effect routed to linked audio", seq().clips.some((c) => c.linkId === thVideo.linkId && c.effects.some((e) => e.type === "denoise")));
await T("update_effect", { clip_id: vclip.id, type: "gaussianBlur", keyframes: [{ param: "blurriness", time: 0, value: 50 }, { param: "blurriness", time: 1, value: 0 }] });
await T("remove_effect", { clip_ids: [vclip.id], type: "gaussianBlur" });
await T("add_effect", { clip_ids: [vclip.id], type: "warpStabilizer" }, true);
await T("enhance_speech", {});
await T("set_clip_properties", { clip_ids: [vclip.id], scale: 120, keyframes: [{ property: "scale", time: 0, value: 100 }, { property: "scale", time: 1.5, value: 115, easing: "easeInOut" }, { property: "opacity", time: 0, value: 0 }, { property: "opacity", time: 0.5, value: 100 }] });
const vNow = seq().clips.find((c) => c.id === vclip.id)!; // failed tools roll back by restoring the project, so re-fetch by id
check("keyframes set", vNow.motion!.scale.keyframes?.length === 2 && vNow.opacity!.opacity.keyframes?.length === 2 && vNow.motion!.scale.keyframes[1].interp === "easeInOut");

// ---------------------------------------------------------------- audio: music, ducking, volume, beats
await T("place_clip", { asset_id: MUSIC, at: 0, include_video: false, audio_track: 2, source_out: Math.min(project.media[MUSIC].duration, sequenceDuration(seq())) });
await T("set_volume", { track: "A2", volume_db: -3 });
const musicClip = seq().clips.find((c) => c.assetId === MUSIC)!;
await T("set_volume", { clip_ids: [musicClip.id], volume_db: -14, fade_out: 1.5 });
r = await T("duck_music", { music_track: "A2", dialogue_track: "A1", duck_db: -10 });
const kf = seq().clips.find((c) => c.assetId === MUSIC)!.audio!.volumeDb.keyframes ?? [];
check("ducking keyframes", kf.length >= 3 && kf.some((k) => k.v <= -23.9), `${kf.length} keyframes, min ${Math.min(...kf.map((k) => k.v))}dB`);
r = await T("beat_sync", { music_asset_id: MUSIC });
check("beat detection", /BPM/.test(r.output.text), r.output.text.split(".")[0]);
r = await T("beat_sync", { music_asset_id: MUSIC, apply: "markers" });
check("beat markers", seq().markers.length >= 4, `${seq().markers.length} markers`);

// ---------------------------------------------------------------- vision
r = await T("view_media_frames", { asset_id: TEST, count: 3, width: 320 });
const imgs = r.output.images ?? [];
check("frames are JPEG", imgs.length === 3 && imgs.every((i) => Buffer.from(i.data, "base64").subarray(0, 2).toString("hex") === "ffd8"), `${imgs.length} frames, ${Math.round(imgs.reduce((a, i) => a + i.data.length * 0.75, 0) / 1024)}KB`);
r = await T("view_media_frames", { asset_id: PHOTO, count: 1 });
r = await T("view_timeline_frames", { count: 4 });
check("timeline frames", (r.output.images?.length ?? 0) >= 3, r.output.text.split("\n")[0]);
fs.writeFileSync(path.join(DATA, "timeline_frame.jpg"), Buffer.from(r.output.images![0].data, "base64"));
await T("view_media_frames", { asset_id: MUSIC }, true);
r = await T("detect_scenes", { asset_id: GREEN, threshold: 0.3 });
r = await T("detect_scenes", { asset_id: TEST, threshold: 0.2, split_in_sequence: true });

// ---------------------------------------------------------------- trimming / moving / deleting
const n0 = seq().clips.length;
await T("split_at", { time: 2, tracks: ["V1", "A1"] });
check("razor", seq().clips.length === n0 + 2, `${n0} → ${seq().clips.length}`);
const piece = seq().clips.find((c) => Math.abs(c.start - 2) < 1e-6 && seq().tracks.find((t) => t.id === c.trackId)?.name === "V1")!;
const v1End = () => Math.max(...clipsOnTrack(seq(), tracksOfKind(seq(), "video")[0].id).map(clipEnd));
const d0 = v1End();
r = await T("trim_clip", { clip_id: piece.id, edge: "in", delta: 0.3, mode: "ripple" });
check("ripple trim pulled V1 left", Math.abs(v1End() - (d0 - 0.3)) < 0.02, `V1 end ${d0.toFixed(2)} → ${v1End().toFixed(2)}`);
await T("trim_clip", { clip_id: piece.id, new_end: piece.start + 0.6, mode: "normal" });
await T("move_clips", { clip_ids: [piece.id], to_track: "V3", delta: 0 });
check("moved to V3, audio stays on A1", seq().tracks.find((t) => t.id === piece.trackId)?.name === "V3" && seq().clips.filter((c) => c.linkId === piece.linkId && c.id !== piece.id).every((c) => seq().tracks.find((t) => t.id === c.trackId)?.name === "A1"));
await T("set_clip_speed", { clip_ids: [vclip.id], speed: 2 });
await T("delete_range", { ranges: [{ start: 0.2, end: 0.6 }], asset_id: TH });
await T("delete_clips", { clip_ids: [piece.id] });
await T("close_gaps", {});
await T("set_in_out", { in: 1, out: 5 });
await T("add_marker", { time: 1, name: "Intro", type: "chapter" });
await T("set_track_properties", { track: "A2", name: "Music" });
await T("trim_clip", { clip_id: "clp_nope", edge: "in", delta: 1 }, true);
await T("place_clip", { asset_id: "med_nope", at: 0 }, true);
await T("place_clip", { asset_id: TH, at: 0, source_in: 50 }, true);
await T("get_timeline", { clip_ids: [vclip.id] });

// ---------------------------------------------------------------- reframe
const mainId = seq().id;
r = await T("auto_reframe", { aspect: "9:16", focus: [{ clip_id: thVideo.id, x: 0.4 }] });
const vert = seq();
const visual = vert.clips.filter((c) => vert.tracks.find((t) => t.id === c.trackId)?.kind === "video" && c.assetId);
const covered = visual.every((c) => {
  const a = project.media[c.assetId!];
  const s = c.motion!.scale.value / 100;
  const w = (a.width ?? 1920) * s, h = (a.height ?? 1080) * s, x = c.motion!.positionX.value, y = c.motion!.positionY.value;
  return x - w / 2 <= 0.5 && x + w / 2 >= 1079.5 && y - h / 2 <= 0.5 && y + h / 2 >= 1919.5;
});
check("auto reframe 9:16 (new sequence, frame covered)", vert.id !== mainId && vert.settings.width === 1080 && vert.settings.height === 1920 && covered && project.sequences[mainId].settings.width === 1920, `${visual.length} clips, "${vert.name}"`);
await T("set_active_sequence", { sequence_id: mainId });

// ---------------------------------------------------------------- export
r = await T("export_sequence", { preset: "list" });
events.length = 0;
r = await T("export_sequence", { preset: r.output.text.split(":")[0], file_name: "test-export" });
check("export handed to client (graphics present)", events.some((e) => e.type === "export_request" || e.type === "export_started"), events.map((e) => e.type).join(","));
await T("totally_fake_tool", {}, true);
await T("add_text", { start: 1 }, true);

// ---------------------------------------------------------------- agent loop with a scripted model
type Msg = import("@anthropic-ai/sdk").default.Beta.BetaMessage;
const scripted: Msg[] = [
  { id: "m1", type: "message", role: "assistant", model: "fake", stop_reason: "tool_use", stop_sequence: null, usage: {} as Msg["usage"], content: [
    { type: "thinking", thinking: "Plan: inspect media then cut fillers.", signature: "sig" } as Msg["content"][number],
    { type: "text", text: "Let me look at your media." } as Msg["content"][number],
    { type: "tool_use", id: "tu1", name: "list_media", input: {} } as Msg["content"][number],
    { type: "tool_use", id: "tu2", name: "view_media_frames", input: { asset_id: TEST, count: 1, width: 256 } } as Msg["content"][number],
    { type: "tool_use", id: "tu3", name: "add_text", input: { text: "Hello", start: 0, duration: 3 } } as Msg["content"][number],
  ] } as unknown as Msg,
  { id: "m2", type: "message", role: "assistant", model: "fake", stop_reason: "tool_use", stop_sequence: null, usage: {} as Msg["usage"], content: [
    { type: "tool_use", id: "tu4", name: "trim_clip", input: { clip_id: "bogus" } } as Msg["content"][number],
  ] } as unknown as Msg,
  { id: "m3", type: "message", role: "assistant", model: "fake", stop_reason: "end_turn", stop_sequence: null, usage: {} as Msg["usage"], content: [
    { type: "text", text: "Done — added a title." } as Msg["content"][number],
  ] } as unknown as Msg,
];
const sentParams: unknown[] = [];
let call = 0;
const fakeClient = {
  stream(p: unknown) {
    sentParams.push(JSON.parse(JSON.stringify(p)));
    const msg = scripted[call++];
    const handlers: Record<string, ((d: string) => void)[]> = {};
    return {
      on(ev: string, cb: (d: string) => void) { (handlers[ev] ??= []).push(cb); return this; },
      async finalMessage() {
        for (const b of msg.content) {
          if (b.type === "thinking") handlers.thinking?.forEach((h) => h(b.thinking));
          if (b.type === "text") handlers.text?.forEach((h) => h(b.text));
        }
        return msg;
      },
    };
  },
};
const agentEvents: AIEvent[] = [];
const projBefore = JSON.stringify(project);
await runAgentTurn({ project, sequenceId: mainId, selection: { clipIds: [], itemIds: [] }, playhead: 1.5, history: [], message: "Add a hello title" }, (e) => agentEvents.push(e), new AbortController().signal, { client: fakeClient as never });
const types = agentEvents.map((e) => e.type);
const done = agentEvents.find((e) => e.type === "done") as Extract<AIEvent, { type: "done" }>;
const hist = done.messages as { role: string; content: unknown }[];
check("agent: event sequence", types[0] === "thinking" && types.filter((t) => t === "tool_start").length === 4 && types.filter((t) => t === "tool_result").length === 4 && types.filter((t) => t === "project").length === 1 && types.at(-1) === "done", types.join(","));
check("agent: tool error surfaced", agentEvents.some((e) => e.type === "tool_result" && e.name === "trim_clip" && e.isError));
const p2 = sentParams[1] as { messages: { role: string; content: { type: string; is_error?: boolean; content?: { type: string }[] }[] }[] };
const lastUser = p2.messages.at(-1)!;
check("agent: all tool results in ONE user message, with image", lastUser.role === "user" && lastUser.content.length === 3 && lastUser.content.every((b) => b.type === "tool_result") && !!lastUser.content[1].content?.some((c) => c.type === "image"));
const p3 = sentParams[2] as typeof p2;
check("agent: is_error on failed tool", p3.messages.at(-1)!.content[0].is_error === true);
check("agent: thinking blocks preserved in history", JSON.stringify(hist).includes('"signature":"sig"'));
check("agent: history images stripped", !JSON.stringify(hist).includes('"type":"image"') && hist.length === 6, `${hist.length} messages`);
check("agent: request project untouched (server-side copy)", JSON.stringify(project) === projBefore);
const projEv = agentEvents.find((e) => e.type === "project") as Extract<AIEvent, { type: "project" }>;
check("agent: project event has the title", Object.values(projEv.project.sequences[mainId].clips).some((c) => c.generator?.kind === "text" && c.generator.style.text === "Hello"), projEv.label);
check("agent: editor state in user message", JSON.stringify((sentParams[0] as typeof p2).messages[0]).includes("<editor_state>"));
check("compactHistory keeps alternation", compactHistory(hist as never).length === hist.length);

// ---------------------------------------------------------------- real SDK against a mock Anthropic endpoint
{
  const http = await import("node:http");
  const reqs: { headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
  const sse = (ev: Record<string, unknown>) => `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
  const mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw);
      reqs.push({ headers: req.headers, body });
      res.writeHead(200, { "content-type": "text/event-stream" });
      const n = reqs.length;
      const blocks: string[] = [sse({ type: "message_start", message: { id: `msg_${n}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } })];
      if (n === 1) {
        blocks.push(
          sse({ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } }),
          sse({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "**Checking media** first." } }),
          sse({ type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "SIG123" } }),
          sse({ type: "content_block_stop", index: 0 }),
          sse({ type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }),
          sse({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Looking at " } }),
          sse({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "your clips." } }),
          sse({ type: "content_block_stop", index: 1 }),
          sse({ type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_A", name: "add_marker", input: {} } }),
          sse({ type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"time": 1.5, ' } }),
          sse({ type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '"name": "Hook"}' } }),
          sse({ type: "content_block_stop", index: 2 }),
          sse({ type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 30 } }),
        );
      } else {
        blocks.push(
          sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
          sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Added a **Hook** marker." } }),
          sse({ type: "content_block_stop", index: 0 }),
          sse({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 8 } }),
        );
      }
      blocks.push(sse({ type: "message_stop" }));
      res.end(blocks.join(""));
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
  const { anthropicClient } = await import("../server/ai/agent");
  const evs: AIEvent[] = [];
  await runAgentTurn({ project, sequenceId: mainId, selection: { clipIds: [], itemIds: [] }, playhead: 0, history: [], message: "mark the hook" }, (e) => evs.push(e), new AbortController().signal, { client: anthropicClient("sk-ant-test"), model: "claude-opus-5-5" });
  const b0 = reqs[0]?.body ?? {};
  const h0 = reqs[0]?.headers ?? {};
  check("SDK: request body shape", b0.model === "claude-opus-5-5" && b0.max_tokens === 64000 && JSON.stringify(b0.thinking) === '{"type":"adaptive","display":"summarized"}' && JSON.stringify(b0.output_config) === '{"effort":"high"}' && b0.fallbacks === "default" && b0.stream === true && (b0.tools as unknown[]).length === TOOLS.length && JSON.stringify(b0.tool_choice) === '{"type":"auto"}' && !("betas" in b0), `keys: ${Object.keys(b0).join(",")}`);
  check("SDK: beta header + cache_control on system", String(h0["anthropic-beta"]).includes("server-side-fallback-2026-07-01") && JSON.stringify(b0.system).includes('"cache_control":{"type":"ephemeral"}') && (String(h0["x-api-key"]) === "sk-ant-test" || String(h0["authorization"]) === "Bearer sk-ant-test"), `anthropic-beta: ${h0["anthropic-beta"]}; system=${JSON.stringify(b0.system).slice(-60)}; auth=${h0["authorization"] ? "bearer" : h0["x-api-key"] ? "x-api-key" : "none"}`);
  const b1 = reqs[1]?.body as { messages: { role: string; content: { type: string; tool_use_id?: string; signature?: string }[] }[] } | undefined;
  check("SDK: 2nd request carries thinking signature + tool_result", !!b1 && b1.messages[1].content.some((c) => c.type === "thinking" && c.signature === "SIG123") && b1.messages[2].content[0].type === "tool_result" && b1.messages[2].content[0].tool_use_id === "toolu_A", `${reqs.length} requests`);
  const txt = evs.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
  check("SDK: streamed text/thinking/tool/project events", txt === "Looking at your clips.Added a **Hook** marker." && evs.some((e) => e.type === "thinking") && evs.some((e) => e.type === "project" && e.project.sequences[mainId].markers.some((m) => m.name === "Hook")) && evs.at(-1)?.type === "done", evs.map((e) => e.type).join(","));
  mock.close();
  delete process.env.ANTHROPIC_BASE_URL;
}

// ---------------------------------------------------------------- client undo model (one AI turn = one undo step)
{
  const { useEditor } = await import("../src/store/store");
  const { applyProjectEvent } = await import("../src/panels/ai/applyTurn");
  const base: Project = JSON.parse(JSON.stringify(project));
  useEditor.getState().loadProject(base);
  const step = (fn: (p: Project) => void): Project => {
    const p = JSON.parse(JSON.stringify(useEditor.getState().project)) as Project;
    fn(p);
    return p;
  };
  const turn = { label: "Claude: tighten it", pastLen: -1, applied: false };
  const seqLen = () => useEditor.getState().project.sequences[mainId].markers.length;
  const m0 = seqLen();
  applyProjectEvent(step((p) => p.sequences[mainId].markers.push({ id: "mk_a", time: 1, duration: 0, name: "a", comment: "", color: "green", type: "comment" })), turn);
  applyProjectEvent(step((p) => p.sequences[mainId].markers.push({ id: "mk_b", time: 2, duration: 0, name: "b", comment: "", color: "green", type: "comment" })), turn);
  applyProjectEvent(step((p) => { p.media[TH] = { ...p.media[TH], transcript: undefined }; p.sequences[mainId].markers.push({ id: "mk_c", time: 3, duration: 0, name: "c", comment: "", color: "green", type: "comment" }); }), turn);
  const st = useEditor.getState();
  check("undo: 3 AI steps → 1 history entry", st.past.length === 1 && st.past[0].label === "Claude: tighten it" && seqLen() === m0 + 3, `past=${st.past.length}, markers ${m0}→${seqLen()}`);
  check("undo: live transcript kept when AI copy lacks it", !!useEditor.getState().project.media[TH].transcript);
  useEditor.getState().undo();
  check("undo: Cmd+Z reverts the whole AI turn", seqLen() === m0 && useEditor.getState().past.length === 0, `markers ${seqLen()}`);
  useEditor.getState().redo();
  check("undo: redo restores the whole AI turn", seqLen() === m0 + 3);
  // user edit mid-turn -> next AI event becomes its own entry, user's edit preserved in history
  const turn2 = { label: "Claude: more", pastLen: -1, applied: false };
  applyProjectEvent(step((p) => p.sequences[mainId].markers.push({ id: "mk_d", time: 4, duration: 0, name: "d", comment: "", color: "green", type: "comment" })), turn2);
  useEditor.getState().apply("User rename", (d) => { d.sequences[mainId].name = "Renamed"; });
  applyProjectEvent(step((p) => p.sequences[mainId].markers.push({ id: "mk_e", time: 5, duration: 0, name: "e", comment: "", color: "green", type: "comment" })), turn2);
  const labels = useEditor.getState().past.map((h) => h.label);
  check("undo: user edit mid-turn is not swallowed", labels.join("|") === "Claude: tighten it|Claude: more|User rename|Claude: more" && useEditor.getState().project.sequences[mainId].name === "Renamed", labels.join(" | "));
}

// ---------------------------------------------------------------- SSE route without API key
const express = (await import("express")).default;
const { aiRouter, transcribeRouter } = await import("../server/ai/index");
const app = express();
app.use(express.json({ limit: "200mb" }));
app.use("/api/ai", aiRouter);
app.use("/api/media", transcribeRouter);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
// pin the API-key provider so this checks the no-key path (Automatic would fall back to a signed-in Claude Code)
(await import("../server/config")).updateSettings({ aiProvider: "api", anthropicApiKey: "" });
const res = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, sequenceId: mainId, selection: { clipIds: [], itemIds: [] }, playhead: 0, history: [], message: "hi" }) });
const sse = await res.text();
const sseEvents = sse.split("\n\n").filter((c) => c.startsWith("data: ")).map((c) => JSON.parse(c.slice(6)));
check("SSE no-key error event", res.headers.get("content-type")?.includes("text/event-stream") === true && sseEvents[0]?.type === "error" && /API key/.test(sseEvents[0].error) && sseEvents.at(-1)?.type === "done", JSON.stringify(sseEvents[0]));
const bad = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "" }) }).then((r) => r.text());
check("SSE bad request → error event", bad.includes('"type":"error"'));
const tr = await fetch(`http://127.0.0.1:${port}/api/media/${AIFF}/transcribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: S("speech.aiff") }) });
const trJson = await tr.json();
check("POST /api/media/:id/transcribe", tr.ok && trJson.segments?.length > 0, `${trJson.segments?.length} segments`);
const tr404 = await fetch(`http://127.0.0.1:${port}/api/media/med_missing/transcribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
check("transcribe unknown id → 404", tr404.status === 404);
const ws = await fetch(`http://127.0.0.1:${port}/api/ai/whisper`).then((r) => r.json());
check("whisper status", ws.available === true, `model ${ws.model}`);
server.close();

console.log(`\n${pass} passed, ${failCount} failed. Data dir: ${DATA}`);
console.log("Main sequence after all tools:\n" + (await import("../shared/ops")).describeSequence(project, project.sequences[mainId]).split("\n").slice(0, 12).join("\n"));
process.exit(failCount ? 1 : 0);
