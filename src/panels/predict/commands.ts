// Content Lab commands (AI menu): open the lab, analyze the active sequence or selected clip.
import { registerCommands } from "../../commands/registry";
import { useEditor } from "../../store/store";
import { activeSequence, analyzeActiveSequence, analyzeSelectedAsset, selectedAsset } from "./analyze";

const ed = () => useEditor.getState();

registerCommands([
  {
    id: "lab.open",
    label: "Content Lab…",
    keys: ["Mod+Shift+L"],
    run: () => ed().setUI({ mode: "predict" }),
  },
  { id: "lab.analyzeSequence", label: "Predict Performance of Active Sequence", run: () => void analyzeActiveSequence(), enabled: () => !!activeSequence()?.clips.length },
  { id: "lab.analyzeSelected", label: "Predict Performance of Selected Clip", run: () => void analyzeSelectedAsset(), enabled: () => !!selectedAsset() },
]);
