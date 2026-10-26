// Sanity checks for the Content Lab scoring model. Run: npx tsx scripts/test-predict-score.ts
import { scoreReport, simulateRetention } from "../server/predict/score";
import type { SecondFeatures } from "../shared/predict";

let fails = 0;
const check = (name: string, ok: boolean, info = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${info}`);
  if (!ok) fails++;
};

const sec = (t: number, o: Partial<SecondFeatures> = {}): SecondFeatures => ({ t, cut: false, motion: 0.3, brightness: 0.5, loudness: -18, speech: 2, silent: false, ...o });
const lively = Array.from({ length: 30 }, (_, t) => sec(t, { cut: t % 3 === 0, motion: 0.35 }));
const dull = Array.from({ length: 30 }, (_, t) => sec(t, { motion: 0.02, speech: 0, loudness: -60, silent: true }));

const a = scoreReport(lively, ["tiktok", "youtube"], { width: 1080, height: 1920 });
const b = scoreReport(dull, ["tiktok", "youtube"], { width: 1080, height: 1920 });
check("lively beats dull overall", a.overall.score > b.overall.score + 20, `${a.overall.score} vs ${b.overall.score}`);
check("lively beats dull on TikTok", a.platforms[0].score > b.platforms[0].score, `${a.platforms[0].score} vs ${b.platforms[0].score}`);
check("retention is monotonic", simulateRetention("tiktok", a.seconds.map((s) => s.attention)).every((v, i, arr) => i === 0 || v <= arr[i - 1]));
check("retention starts at 100", simulateRetention("reels", [50, 50])[0] === 100);
check("dull video gets dead-air + pacing suggestions", b.suggestions.some((s) => s.kind === "pacing") && b.suggestions.some((s) => s.kind === "hook"));
const short = scoreReport(lively.slice(0, 20), ["youtube"], { width: 1920, height: 1080 });
check("20s video penalized on YouTube long-form", short.platforms[0].score < 75 && /Short/.test(short.platforms[0].verdict), `${short.platforms[0].score} ${short.platforms[0].verdict}`);
const medium = Array.from({ length: 30 }, (_, t) => sec(t, { cut: t % 6 === 0, motion: 0.12, speech: 1 }));
const horiz = scoreReport(medium, ["tiktok"], { width: 1920, height: 1080 });
const vert = scoreReport(medium, ["tiktok"], { width: 1080, height: 1920 });
check("horizontal video gets reframe suggestion for TikTok", horiz.suggestions.some((s) => s.kind === "format"));
check("horizontal scores lower than vertical on TikTok", horiz.platforms[0].score < vert.platforms[0].score, `${horiz.platforms[0].score} vs ${vert.platforms[0].score}`);
const withSilence = lively.map((s) => (s.t >= 10 && s.t < 14 ? { ...s, silent: true, loudness: -70, motion: 0.01, cut: false, speech: 0 } : s));
const c = scoreReport(withSilence, ["tiktok"], { width: 1080, height: 1920 });
check("silence detected as dip + suggestion", c.moments.some((m) => m.kind === "dip" && m.start >= 8 && m.start <= 14) && c.suggestions.some((s) => s.kind === "dead-air"));
console.log(fails ? `${fails} failed` : "ALL PASS");
process.exit(fails ? 1 : 0);
