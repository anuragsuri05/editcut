// Registers ai.*, captions.*, the AI clip/sequence commands and app.settings.
// Commands that need judgement (auto edit, color, beat sync…) go to Claude; the
// mechanical ones run locally so they work without an API key.
import { registerCommands } from "../../commands/registry";
import { openPanel } from "../../dock";
import { getActiveSequence, useEditor } from "../../store/store";
import { askClaude } from "./aiSession";
import {
  autoDuck, autoReframeClips, autoReframeSequence, enhanceSpeechLocal, generateCaptions, removeFillerWords, removeSilences, sceneEditDetection, transcribeSequence,
} from "./localOps";
import "./SettingsDialog";

const ed = () => useEditor.getState();
const hasSeq = () => !!getActiveSequence();

function focusAssistant(): void {
  openPanel("ai");
  setTimeout(() => window.dispatchEvent(new CustomEvent("editcut:ai-focus")), 50);
}
window.addEventListener("editcut:open-ai", () => openPanel("ai"));

function openTextPanel(tab: "transcript" | "captions" | "graphics"): void {
  openPanel("text");
  setTimeout(() => window.dispatchEvent(new CustomEvent("editcut:text-tab", { detail: tab })), 30);
}

registerCommands([
  { id: "ai.openAssistant", label: "AI Assistant (Ask Claude)…", keys: ["Mod+J"], run: focusAssistant },
  {
    id: "ai.autoEdit", label: "Auto Edit with Claude…",
    run: () => askClaude("Edit my footage into a polished video: review all media (transcripts and frames), build a well-paced edit in a new sequence with a strong opening, clean audio, tasteful transitions, a consistent color grade and captions for any dialogue. Tell me what you made.", { displayText: "Auto Edit" }),
  },
  {
    id: "ai.roughCut", label: "Rough Cut from Clips…",
    run: () => askClaude("Make a rough cut from my clips. Review the media first, pick the strongest moments, and assemble them in a logical order in a new sequence.", { displayText: "Rough cut from my clips" }),
  },
  { id: "ai.removeSilences", label: "Remove Silences", run: () => void removeSilences(), enabled: hasSeq },
  { id: "ai.removeFillerWords", label: "Remove Filler Words (um, uh…)", run: () => void removeFillerWords(), enabled: hasSeq },
  { id: "ai.sceneDetect", label: "Scene Edit Detection", run: () => void sceneEditDetection(), enabled: hasSeq },
  { id: "clip.sceneEditDetection", label: "Scene Edit Detection…", run: () => void sceneEditDetection(), enabled: hasSeq },
  { id: "ai.enhanceSpeech", label: "Enhance Speech", run: enhanceSpeechLocal, enabled: hasSeq },
  {
    id: "ai.autoColor", label: "Auto Color (Claude)",
    run: () => {
      const sel = ed().selection.clipIds;
      askClaude(`Auto color correct ${sel.length ? `the selected clips (${sel.join(", ")})` : "every clip in the sequence"}: look at frames, fix exposure, contrast and white balance with Lumetri so the shots look natural and consistent. No creative look.`, { displayText: "Auto Color" });
    },
    enabled: hasSeq,
  },
  {
    id: "ai.colorMatch", label: "Color Match (Claude)",
    run: () => {
      const sel = ed().selection.clipIds;
      askClaude(sel.length ? `Match the color of the other clips in the sequence to the selected reference clip ${sel[0]}: compare frames and adjust each clip's Lumetri (temperature, tint, exposure, contrast, saturation) to match it.` : "Match the color of all clips in the sequence to the first shot: compare frames and adjust each clip's Lumetri to match.", { displayText: "Color Match" });
    },
    enabled: hasSeq,
  },
  { id: "ai.autoDuck", label: "Auto-Duck Music", run: () => void autoDuck(), enabled: hasSeq },
  { id: "ai.autoReframeVertical", label: "Auto Reframe to Vertical 9:16", run: () => autoReframeSequence("9:16"), enabled: hasSeq },
  { id: "sequence.autoReframe", label: "Auto Reframe Sequence (9:16)…", run: () => autoReframeSequence("9:16"), enabled: hasSeq },
  { id: "clip.autoReframe", label: "Auto Reframe Clip (fill frame)", run: autoReframeClips, enabled: () => hasSeq() && ed().selection.clipIds.length > 0 },
  {
    id: "ai.beatSync", label: "Beat Sync (Claude)…",
    run: () => askClaude("Sync the edit to the music: detect the beat of the music in the sequence (or in my media if none is placed — place it on A2), then re-time the shots on V1 so cuts land on the beat.", { displayText: "Beat sync" }),
    enabled: hasSeq,
  },
  {
    id: "ai.describeFrame", label: "Describe Current Frame (Claude)",
    run: () => askClaude("Describe what's in the current Program Monitor frame and give quick editing suggestions for this shot (framing, color, pacing).", { shareFrame: true, displayText: "Describe this frame" }),
    enabled: hasSeq,
  },
  { id: "captions.transcribe", label: "Transcribe Sequence", run: () => { openTextPanel("transcript"); void transcribeSequence(); } },
  { id: "captions.generate", label: "Create Captions", run: () => { openTextPanel("captions"); void generateCaptions(); }, enabled: hasSeq },
  { id: "captions.translate", label: "Translate Captions (Claude)…", run: () => ed().openDialog("captionsTranslate"), enabled: hasSeq },
  { id: "app.settings", label: "Settings…", keys: ["Mod+,"], run: () => ed().openDialog("aiSettings") },
]);
