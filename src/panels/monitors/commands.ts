// Transport + monitor commands (play.*, monitor.*, source-scoped marking) and
// the Export Frame dialog. Transport commands act on the FOCUSED monitor.
import { registerCommands } from "../../commands/registry";
import { useEditor } from "../../store/store";
import { transport } from "../../engine";
import { useMonitorUI } from "./monitorStore";
import {
  openExportFrame, sourceAddMarker, sourceClear, sourceEdit, sourceGoToMarker, sourceSetIn, sourceSetOut,
  getSourceAsset,
} from "./actions";

const ed = () => useEditor.getState();
const which = () => ed().focusedMonitor;
const mon = () => useMonitorUI.getState();

// Keep focusedMonitor in sync with panel focus (Timeline focus drives the Program Monitor).
useEditor.subscribe((s, p) => {
  if (s.activePanel === p.activePanel) return;
  if (s.activePanel === "source" && s.focusedMonitor !== "source") s.setUI({ focusedMonitor: "source" });
  else if ((s.activePanel === "program" || s.activePanel === "timeline") && s.focusedMonitor !== "program") s.setUI({ focusedMonitor: "program" });
});

// Remember Source Monitor history (recent clips dropdown).
useEditor.subscribe((s, p) => {
  if (s.sourceAssetId === p.sourceAssetId || !s.sourceAssetId) return;
  const h = mon().sourceHistory.filter((id) => id !== s.sourceAssetId);
  mon().set({ sourceHistory: [s.sourceAssetId, ...h].slice(0, 12) });
  if (s.focusedMonitor !== "source") s.setUI({ focusedMonitor: "source" });
});

const hasSource = () => !!getSourceAsset();

registerCommands([
  // ---- transport (global, act on the focused monitor)
  { id: "play.toggle", label: "Play-Stop Toggle", keys: ["Space"], run: () => transport.toggle(which()) },
  { id: "play.shuttleLeft", label: "Shuttle Left", keys: ["J"], run: () => transport.shuttle(which(), -1) },
  { id: "play.stop", label: "Shuttle Stop", keys: ["K"], run: () => transport.stop() },
  { id: "play.shuttleRight", label: "Shuttle Right", keys: ["L"], run: () => transport.shuttle(which(), 1) },
  { id: "play.shuttleSlowLeft", label: "Shuttle Slow Left", keys: ["Shift+J"], run: () => transport.shuttleSlow(which(), -1) },
  { id: "play.shuttleSlowRight", label: "Shuttle Slow Right", keys: ["Shift+L"], run: () => transport.shuttleSlow(which(), 1) },
  { id: "play.stepBack", label: "Step Back 1 Frame", keys: ["ArrowLeft"], run: () => transport.step(which(), -1) },
  { id: "play.stepForward", label: "Step Forward 1 Frame", keys: ["ArrowRight"], run: () => transport.step(which(), 1) },
  { id: "play.stepBack5", label: "Step Back Many Frames", keys: ["Shift+ArrowLeft"], run: () => transport.step(which(), -5) },
  { id: "play.stepForward5", label: "Step Forward Many Frames", keys: ["Shift+ArrowRight"], run: () => transport.step(which(), 5) },
  { id: "play.goToStart", label: "Go to Start", keys: ["Home"], run: () => transport.goTo(which(), 0) },
  { id: "play.goToEnd", label: "Go to End", keys: ["End"], run: () => transport.goTo(which(), transport.transportInfo(which()).duration) },
  { id: "play.inToOut", label: "Play In to Out", keys: ["Mod+Shift+Space"], run: () => transport.playInToOut(which()) },
  { id: "play.around", label: "Play Around", keys: ["Shift+K"], run: () => transport.playAround(which()) },
  { id: "play.loop", label: "Loop Playback", keys: ["Mod+L"], run: () => ed().setUI({ loopPlayback: !ed().loopPlayback }), checked: () => ed().loopPlayback },

  // ---- edits from source (global: Premiere uses , and . from the Timeline too)
  { id: "monitor.insert", label: "Insert", keys: [","], run: () => void sourceEdit("insert"), enabled: hasSource },
  { id: "monitor.overwrite", label: "Overwrite", keys: ["."], run: () => void sourceEdit("overwrite"), enabled: hasSource },

  // ---- export frame
  { id: "monitor.exportFrame", label: "Export Frame…", keys: ["Mod+Shift+E"], run: () => openExportFrame() },
  { id: "file.export.frame", label: "Frame…", run: () => openExportFrame() },

  // ---- view
  { id: "view.zoomFit", label: "Monitor Zoom: Fit", run: () => mon().set(which() === "program" ? { programZoom: "fit" } : { sourceZoom: "fit" }), checked: () => (which() === "program" ? mon().programZoom : mon().sourceZoom) === "fit" },
  { id: "view.zoom100", label: "Monitor Zoom: 100%", run: () => mon().set(which() === "program" ? { programZoom: 100 } : { sourceZoom: 100 }), checked: () => (which() === "program" ? mon().programZoom : mon().sourceZoom) === 100 },
  { id: "view.showRulers", label: "Show Rulers", run: () => mon().set({ showRulers: !mon().showRulers }), checked: () => mon().showRulers },
  { id: "view.showGuides", label: "Show Guides", run: () => mon().set({ showGuides: !mon().showGuides }), checked: () => mon().showGuides },
  { id: "monitor.toggleComparison", label: "Comparison View", run: () => mon().set({ comparison: { ...mon().comparison, on: !mon().comparison.on } }), checked: () => mon().comparison.on },
  { id: "monitor.transparencyGrid", label: "Transparency Grid", run: () => mon().set({ transparencyGrid: !mon().transparencyGrid }), checked: () => mon().transparencyGrid },
  { id: "monitor.fxMute", label: "Global FX Mute", run: () => mon().set({ fxMute: !mon().fxMute }), checked: () => mon().fxMute },

  // ---- Source Monitor (panel-scoped; Program-side marking is owned by the timeline's markers.* commands)
  { id: "source.markIn", label: "Mark In (Source)", keys: ["I"], scope: "source", run: () => sourceSetIn(), enabled: hasSource },
  { id: "source.markOut", label: "Mark Out (Source)", keys: ["O"], scope: "source", run: () => sourceSetOut(), enabled: hasSource },
  { id: "source.goToIn", label: "Go to In (Source)", keys: ["Shift+I"], scope: "source", run: () => { const a = getSourceAsset(); if (a?.inPoint !== undefined) transport.goTo("source", a.inPoint); } },
  { id: "source.goToOut", label: "Go to Out (Source)", keys: ["Shift+O"], scope: "source", run: () => { const a = getSourceAsset(); if (a?.outPoint !== undefined) transport.goTo("source", a.outPoint); } },
  { id: "source.clearIn", label: "Clear In (Source)", keys: ["Alt+I"], scope: "source", run: () => sourceClear("in") },
  { id: "source.clearOut", label: "Clear Out (Source)", keys: ["Alt+O"], scope: "source", run: () => sourceClear("out") },
  { id: "source.clearInOut", label: "Clear In and Out (Source)", keys: ["Alt+X", "Mod+Shift+X"], scope: "source", run: () => sourceClear("both") },
  { id: "source.addMarker", label: "Add Marker (Source)", keys: ["M"], scope: "source", run: () => sourceAddMarker(), enabled: hasSource },
  { id: "source.nextMarker", label: "Go to Next Marker (Source)", keys: ["Shift+M"], scope: "source", run: () => sourceGoToMarker(1) },
  { id: "source.prevMarker", label: "Go to Previous Marker (Source)", keys: ["Mod+Shift+M"], scope: "source", run: () => sourceGoToMarker(-1) },
]);

import "./ExportFrameDialog";
