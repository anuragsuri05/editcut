// Imports samples/ into a running EditCut server and saves a small demo project.
// Usage: npx tsx scripts/make-test-project.ts [serverUrl] [outRequestJson] [message]
import fs from "node:fs";
import path from "node:path";
import { makeProject, makeSequence } from "../shared/factory";
import { placeAsset } from "../shared/ops";
import type { MediaAsset } from "../shared/types";

const base = process.argv[2] ?? "http://localhost:5174";
const out = process.argv[3];
const message = process.argv[4] ?? "Describe the timeline.";
const root = path.resolve(import.meta.dirname, "..", "samples");
const files = ["talking_head_speech.mp4", "clip_testsrc_1080p.mp4", "music.mp3"].map((f) => path.join(root, f));

let assets: MediaAsset[] = await (await fetch(`${base}/api/media/import-paths`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths: files }) })).json();
for (let i = 0; i < 120 && assets.some((a) => a.status === "importing"); i++) {
  await new Promise((r) => setTimeout(r, 1000));
  assets = await Promise.all(assets.map(async (a) => (await fetch(`${base}/api/media/${a.id}`)).json()));
}
const project = makeProject("Claude Code test");
const seq = makeSequence("Sequence 01");
project.sequences[seq.id] = seq;
project.activeSequenceId = seq.id;
project.items.push({ id: seq.id, type: "sequence", name: seq.name, parentId: null });
for (const a of assets) {
  project.media[a.id] = a;
  project.items.push({ id: a.id, type: "media", name: a.name, parentId: null });
}
placeAsset(seq, assets[0], { at: 0, sourceIn: 0, sourceOut: 8, mode: "overwrite" });
placeAsset(seq, assets[1], { at: 8, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
placeAsset(seq, assets[2], { at: 0, sourceIn: 0, sourceOut: 13, audioTrackIndex: 1, mode: "overwrite" });
await fetch(`${base}/api/projects/${project.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(project) });
if (out) fs.writeFileSync(out, JSON.stringify({ project, sequenceId: seq.id, selection: { clipIds: [], itemIds: [] }, playhead: 0, history: [], message }));
console.log(`project ${project.id}: ${assets.map((a) => `${a.name}=${a.status}`).join(", ")}`);
