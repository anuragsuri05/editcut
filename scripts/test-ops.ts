// Exercises shared/ops edit operations. Run: npx tsx <this file>
import * as ops from "/Users/lakshsharma/Downloads/100 projects/editcut/shared/ops";
import { makeProject, makeSequence } from "/Users/lakshsharma/Downloads/100 projects/editcut/shared/factory";
import type { MediaAsset, Project, Sequence } from "/Users/lakshsharma/Downloads/100 projects/editcut/shared/types";

let fails = 0;
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-4;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { fails++; console.log("FAIL", name, extra ?? ""); } else console.log("ok  ", name);
}

function asset(id: string, dur = 20): MediaAsset {
  return { id, name: id, kind: "video", path: "/x", url: "/x", duration: dur, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true, markers: [], status: "ready", importedAt: 0 };
}
function setup(): { p: Project; s: Sequence; v1: string; a1: string; v2: string; a2: string } {
  const p = makeProject("t");
  const s = makeSequence("s");
  p.sequences[s.id] = s;
  p.media.A = asset("A");
  p.media.B = asset("B");
  p.media.C = asset("C", 4);
  const v = ops.tracksOfKind(s, "video"), a = ops.tracksOfKind(s, "audio");
  return { p, s, v1: v[0].id, a1: a[0].id, v2: v[1].id, a2: a[1].id };
}
const summary = (s: Sequence, tr: string) => ops.clipsOnTrack(s, tr).map((c) => `${c.name}@${c.start.toFixed(2)}+${c.duration.toFixed(2)}[${c.sourceIn.toFixed(2)}]`).join(" ");

// ---- overwrite placement: A 0..10, B 10..20
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  ops.placeAsset(s, p.media.B, { at: 10, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  check("place: 4 clips", s.clips.length === 4);
  check("place linked", s.clips.filter((c) => c.linkId).length === 4);
  // overwrite C (4s) at 8 -> A trimmed to 8, B starts 12
  ops.placeAsset(s, p.media.C, { at: 8, mode: "overwrite" });
  const vs = ops.clipsOnTrack(s, v1);
  check("overwrite: A trimmed", eq(vs[0].duration, 8), summary(s, v1));
  check("overwrite: B head trimmed", eq(vs[2].start, 12) && eq(vs[2].sourceIn, 2), summary(s, v1));
  check("overwrite audio mirror", summary(s, v1).replace(/A|B|C/g, "") === summary(s, a1).replace(/A|B|C/g, ""));
  // insert C at 5 -> splits A at 5, everything after shifts 4
  ops.placeAsset(s, p.media.C, { at: 5, mode: "insert" });
  const v = ops.clipsOnTrack(s, v1);
  check("insert: 5 clips on V1", v.length === 5, summary(s, v1));
  check("insert: A right half at 9 srcIn 5", eq(v[2].start, 9) && eq(v[2].sourceIn, 5), summary(s, v1));
  check("insert: total dur 24", eq(ops.sequenceDuration(s), 24), ops.sequenceDuration(s));
  // split halves of A: video and audio right halves share a linkId distinct from left
  const aRightV = v[2];
  const aRightA = ops.clipsOnTrack(s, a1)[2];
  check("insert split relink V/A", aRightV.linkId === aRightA.linkId && aRightV.linkId !== v[0].linkId, [aRightV.linkId, aRightA.linkId, v[0].linkId]);
}

// ---- razor / splitAt with linked
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  const created = ops.splitAt(s, 4, [v1, a1]);
  check("razor: 2 new", created.length === 2);
  check("razor: right halves linked together", created[0].linkId === created[1].linkId);
  check("razor: right sourceIn 4", created.every((c) => eq(c.sourceIn, 4)));
}

// ---- extract with linked clips
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  ops.placeAsset(s, p.media.B, { at: 10, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  ops.extract(s, 8, 12, [v1, a1]);
  check("extract: dur 16", eq(ops.sequenceDuration(s), 16));
  const v = ops.clipsOnTrack(s, v1);
  check("extract: B at 8 srcIn 2", eq(v[1].start, 8) && eq(v[1].sourceIn, 2), summary(s, v1));
  const a = ops.clipsOnTrack(s, a1);
  check("extract: audio in sync", eq(a[1].start, 8) && a[1].linkId === v[1].linkId, summary(s, a1));
  // extract a range inside one clip (straddle) — right parts relinked consistently
  ops.extract(s, 2, 3, [v1, a1]);
  const v2 = ops.clipsOnTrack(s, v1), a2 = ops.clipsOnTrack(s, a1);
  check("extract straddle: 3 clips", v2.length === 3 && a2.length === 3, summary(s, v1));
  check("extract straddle: right parts linked", v2[1].linkId === a2[1].linkId && v2[1].linkId !== v2[0].linkId, [v2[1].linkId, a2[1].linkId, v2[0].linkId]);
  check("extract straddle: right src 3 at 2", eq(v2[1].start, 2) && eq(v2[1].sourceIn, 3), summary(s, v1));
}

// ---- lift
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 10, mode: "overwrite" });
  ops.lift(s, 2, 4, [v1]);
  check("lift: V gap, A untouched", ops.clipsOnTrack(s, v1).length === 2 && ops.clipsOnTrack(s, a1).length === 1, summary(s, v1));
}

// ---- ripple delete with linked
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  ops.placeAsset(s, p.media.B, { at: 5, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  ops.placeAsset(s, p.media.C, { at: 10, mode: "overwrite" });
  const ids = s.clips.filter((c) => c.name === "B").map((c) => c.id);
  ops.deleteClips(s, ids, true);
  check("ripple delete: C at 5 on V and A", ops.clipsOnTrack(s, v1)[1].start === 5 && ops.clipsOnTrack(s, a1)[1].start === 5, summary(s, v1) + " | " + summary(s, a1));
  check("ripple delete: dur 9", eq(ops.sequenceDuration(s), 9));
}

// ---- trim normal / ripple / roll
{
  const { p, s, v1, a1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 2, sourceOut: 12, mode: "overwrite" });
  ops.placeAsset(s, p.media.B, { at: 10, sourceIn: 2, sourceOut: 12, mode: "overwrite" });
  const A = ops.clipsOnTrack(s, v1)[0], B = ops.clipsOnTrack(s, v1)[1];
  // normal: extending A's out into B is blocked
  const d1 = ops.trimClip(p, s, A.id, "out", 2, "normal");
  check("trim normal blocked by neighbour", eq(d1, 0) && eq(A.duration, 10));
  const d2 = ops.trimClip(p, s, A.id, "out", -2, "normal");
  check("trim normal shorten", eq(d2, -2) && eq(A.duration, 8) && eq(B.start, 10));
  // ripple out +1: B moves to 9? A is 8 long ending 8; ripple +1 => A ends 9, B starts 11
  const d3 = ops.trimClip(p, s, A.id, "out", 1, "ripple");
  check("ripple out", eq(d3, 1) && eq(B.start, 11), summary(s, v1));
  const Aa = ops.clipsOnTrack(s, a1)[1];
  check("ripple out shifts sync-locked audio", eq(Aa.start, 11), summary(s, a1));
  // ripple in on B: +1 => B start stays 11, srcIn 3, dur 9
  const d4 = ops.trimClip(p, s, B.id, "in", 1, "ripple");
  check("ripple in", eq(d4, 1) && eq(B.start, 11) && eq(B.sourceIn, 3) && eq(B.duration, 9), summary(s, v1));
  // roll
  ops.trimClip(p, s, A.id, "out", 2, "normal"); // close gap: A 0..10 ; B at 11 -> gap 1, A extends to 11
  check("normal fills gap", eq(ops.clipEnd(A), 11), summary(s, v1));
  const d5 = ops.trimClip(p, s, A.id, "out", 1, "roll");
  check("roll", eq(d5, 1) && eq(ops.clipEnd(A), 12) && eq(B.start, 12) && eq(B.sourceIn, 4) && eq(B.duration, 8), summary(s, v1));
  // slip
  ops.slipClip(p, s, B.id, 1);
  check("slip", eq(B.sourceIn, 5) && eq(B.start, 12));
  // slide B left 1 => A shortens to 11, B starts 11
  ops.slideClip(p, s, B.id, -1);
  check("slide", eq(B.start, 11) && eq(ops.clipEnd(A), 11), summary(s, v1));
}

// ---- reversed clip trims (source side must mirror)
{
  const { p, s, v1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 5, sourceOut: 10, mode: "overwrite", includeAudio: false });
  const A = ops.clipsOnTrack(s, v1)[0];
  A.reversed = true; // plays source 10 -> 5
  // trimming the head of a reversed clip later by 1 should remove source 10..9 => sourceIn stays 5
  ops.trimClip(p, s, A.id, "in", 1, "normal");
  check("reversed in-trim keeps sourceIn", eq(A.sourceIn, 5) && eq(A.duration, 4), [A.sourceIn, A.duration]);
  // trimming tail later by 1 (extending) consumes source before 5 => sourceIn 4
  ops.trimClip(p, s, A.id, "out", 1, "normal");
  check("reversed out-extend moves sourceIn back", eq(A.sourceIn, 4) && eq(A.duration, 5), [A.sourceIn, A.duration]);
}

// ---- move overwrite / insert with linked
{
  const { p, s, v1, a1, v2, a2 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  ops.placeAsset(s, p.media.B, { at: 5, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  const bIds = s.clips.filter((c) => c.name === "B").map((c) => c.id);
  ops.moveClips(s, bIds, -3, 1, "overwrite");
  check("move up one track: V2 and A2", ops.clipsOnTrack(s, v2).length === 1 && ops.clipsOnTrack(s, a2).length === 1);
  check("move: at 2", eq(ops.clipsOnTrack(s, v2)[0].start, 2));
  ops.moveClips(s, bIds, 0, -1, "overwrite");
  check("move back down overwrites A tail", eq(ops.clipsOnTrack(s, v1)[0].duration, 2), summary(s, v1));
  // insert move
  const { p: p2, s: s2, v1: w1 } = setup();
  ops.placeAsset(s2, p2.media.A, { at: 0, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  ops.placeAsset(s2, p2.media.B, { at: 5, sourceIn: 0, sourceOut: 5, mode: "overwrite" });
  const b2 = s2.clips.filter((c) => c.name === "B").map((c) => c.id);
  ops.moveClips(s2, b2, -3, 0, "insert");
  check("insert move: 3 clips on V1", ops.clipsOnTrack(s2, w1).length === 3, summary(s2, w1));
  check("insert move: dur 10 (A split, gap at end)", eq(ops.sequenceDuration(s2), 10), summary(s2, w1));
}

// ---- speed
{
  const { p, s, v1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 4, mode: "overwrite", includeAudio: false });
  ops.placeAsset(s, p.media.B, { at: 4, sourceIn: 0, sourceOut: 4, mode: "overwrite", includeAudio: false });
  const A = ops.clipsOnTrack(s, v1)[0], B = ops.clipsOnTrack(s, v1)[1];
  ops.setClipSpeed(p, s, A.id, 0.5, { ripple: true });
  check("speed ripple", eq(A.duration, 8) && eq(B.start, 8));
  ops.setClipSpeed(p, s, A.id, 2, { ripple: true });
  check("speed ripple back", eq(A.duration, 2) && eq(B.start, 2), summary(s, v1));
}

// ---- transitions survive splits / ripple delete gap
{
  const { p, s, v1 } = setup();
  ops.placeAsset(s, p.media.A, { at: 0, sourceIn: 0, sourceOut: 5, mode: "overwrite", includeAudio: false });
  ops.placeAsset(s, p.media.B, { at: 5, sourceIn: 0, sourceOut: 5, mode: "overwrite", includeAudio: false });
  const t = ops.addTransition(s, v1, 5, "crossDissolve", 1);
  check("transition two-sided", !!t?.clipAId && !!t?.clipBId);
  ops.splitAt(s, 2, [v1]);
  check("transition kept after split", s.transitions.length === 1 && eq(s.transitions[0].at, 5));
  ops.normalizeTransitions(s);
  check("transition A is right half", ops.getClip(s, s.transitions[0].clipAId!)!.start === 2);
  const B = ops.clipsOnTrack(s, v1)[2];
  ops.moveClips(s, [B.id], 2, 0);
  check("gap: rippleDeleteGap", ops.rippleDeleteGap(s, v1, 6) && eq(B.start, 5), summary(s, v1));
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
