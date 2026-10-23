// File menu and Project panel commands (file.*, project.*, sequence.settings).
import { registerCommands } from "../../commands/registry";
import { useEditor } from "../../store/store";
import { openPanel } from "../../dock";
import {
  deleteItems, getCurrentBin, makeOffline, newProject, openFilePicker, revertProject, saveNow,
} from "../../projectIO";
import { newBin, openAutomate, openItem, projectPanelApi } from "./ProjectPanel";
import { addSyntheticClip } from "./dialogs";
import "./dialogs";

const ed = () => useEditor.getState();
const hasSeq = () => !!ed().project.activeSequenceId && !!ed().project.sequences[ed().project.activeSequenceId!];
const selectedMedia = () => ed().selection.itemIds.filter((id) => ed().project.media[id]);

function downloadProjectJson(): void {
  const p = ed().project;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w\- ]+/g, "_") || "project"}.editcut.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

registerCommands([
  // ---- File > New
  { id: "file.newProject", label: "Project…", keys: ["Mod+Alt+N"], run: () => ed().openDialog("newProject") },
  { id: "file.newSequence", label: "Sequence…", keys: ["Mod+N"], run: () => ed().openDialog("newSequence", { binId: getCurrentBin() }) },
  { id: "file.newBin", label: "Bin", keys: ["Mod+B"], scope: "project", run: () => newBin(getCurrentBin()) },
  { id: "file.newAdjustmentLayer", label: "Adjustment Layer…", run: () => ed().openDialog("synthetic", { kind: "adjustmentLayer" }), enabled: hasSeq },
  { id: "file.newColorMatte", label: "Color Matte…", run: () => ed().openDialog("synthetic", { kind: "colorMatte" }), enabled: hasSeq },
  { id: "file.newBlackVideo", label: "Black Video…", run: () => ed().openDialog("synthetic", { kind: "blackVideo" }), enabled: hasSeq },
  { id: "file.newBarsAndTone", label: "Bars and Tone…", run: () => addSyntheticClip("bars"), enabled: hasSeq },
  { id: "project.newTransparentVideo", label: "Transparent Video…", run: () => ed().openDialog("synthetic", { kind: "transparent" }), enabled: hasSeq },

  // ---- File > Open / Save
  { id: "file.openProject", label: "Open Project…", keys: ["Mod+O"], run: () => ed().openDialog("openProject") },
  { id: "file.openRecent", label: "Open Recent…", run: () => ed().openDialog("openProject", { recent: true }) },
  {
    id: "file.closeProject",
    label: "Close Project",
    keys: ["Mod+Shift+W"],
    run: async () => {
      // There is always an open project: closing saves and starts a fresh one, then offers to open another.
      await saveNow();
      await newProject("Untitled Project");
      ed().openDialog("openProject", { recent: true });
    },
  },
  { id: "file.save", label: "Save", keys: ["Mod+S"], run: () => void saveNow({ notify: true }) },
  { id: "file.saveAs", label: "Save As…", keys: ["Mod+Shift+S"], run: () => ed().openDialog("saveAs") },
  { id: "file.saveCopy", label: "Save a Copy…", keys: ["Mod+Alt+S"], run: () => ed().openDialog("saveAs", { copy: true }) },
  {
    id: "file.revert",
    label: "Revert",
    run: () => {
      if (!ed().dirty || window.confirm("Revert to the last saved version? Unsaved changes are lost.")) void revertProject();
    },
  },

  // ---- File > Import
  { id: "file.import", label: "Import…", keys: ["Mod+I"], run: () => openFilePicker({ binId: getCurrentBin() }) },
  { id: "project.importFolder", label: "Import Folder…", run: () => openFilePicker({ binId: getCurrentBin(), folders: true }) },
  { id: "file.importFromPath", label: "Import from Path…", keys: ["Mod+Shift+I"], run: () => ed().openDialog("importFromPath") },
  { id: "file.mediaBrowser", label: "Import from Media Browser", keys: ["Mod+Alt+I"], run: () => openPanel("mediaBrowser") },

  // ---- File > media management
  { id: "file.linkMedia", label: "Link Media…", run: () => ed().openDialog("linkMedia", { ids: selectedMedia() }) },
  { id: "file.makeOffline", label: "Make Offline…", run: () => makeOffline(selectedMedia()), enabled: () => selectedMedia().length > 0 },
  { id: "file.projectManager", label: "Project Manager…", run: () => ed().openDialog("projectManager") },
  { id: "file.projectSettings", label: "Project Settings…", run: () => ed().openDialog("projectSettings") },
  { id: "file.export.projectJson", label: "Project (JSON)…", run: downloadProjectJson },

  // ---- Sequence settings (owned here because it is a project dialog)
  { id: "sequence.settings", label: "Sequence Settings…", run: () => ed().openDialog("sequenceSettings"), enabled: hasSeq },

  // ---- Project panel (scoped shortcuts)
  {
    id: "project.clear",
    label: "Clear",
    keys: ["Backspace", "Delete"],
    scope: "project",
    run: () => deleteItems(ed().selection.itemIds),
    enabled: () => ed().selection.itemIds.length > 0,
  },
  {
    id: "project.open",
    label: "Open in Source Monitor",
    keys: ["Enter"],
    scope: "project",
    run: () => {
      const id = ed().selection.itemIds[0];
      const item = ed().project.items.find((i) => i.id === id);
      if (item) openItem(item);
    },
  },
  { id: "project.selectAll", label: "Select All", keys: ["Mod+A"], scope: "project", run: () => ed().select({ itemIds: projectPanelApi.visibleIds() }) },
  { id: "project.deselectAll", label: "Deselect All", keys: ["Mod+Shift+A"], scope: "project", run: () => ed().select({ itemIds: [] }) },
  { id: "project.find", label: "Find…", keys: ["Mod+F"], scope: "project", run: () => projectPanelApi.focusSearch() },
  { id: "project.listView", label: "List View", keys: ["Mod+PageUp"], scope: "project", run: () => projectPanelApi.setView("list") },
  { id: "project.iconView", label: "Icon View", keys: ["Mod+PageDown"], scope: "project", run: () => projectPanelApi.setView("icon") },
  {
    id: "project.rename",
    label: "Rename",
    keys: ["F2"],
    scope: "project",
    run: () => {
      const id = ed().selection.itemIds[0];
      if (id) projectPanelApi.rename(id);
    },
  },
  { id: "project.automateToSequence", label: "Automate to Sequence…", run: () => openAutomate(projectPanelApi.visibleIds()) },
  ...(["ArrowDown", "ArrowUp"] as const).map((k) => ({
    id: k === "ArrowDown" ? "project.selectNext" : "project.selectPrev",
    label: k === "ArrowDown" ? "Select Next Item" : "Select Previous Item",
    keys: [k],
    scope: "project",
    run: () => {
      const vis = projectPanelApi.visibleIds();
      if (!vis.length) return;
      const sel = ed().selection.itemIds;
      const cur = sel.length ? vis.indexOf(sel[sel.length - 1]) : -1;
      const next = Math.max(0, Math.min(vis.length - 1, cur + (k === "ArrowDown" ? 1 : -1)));
      ed().select({ itemIds: [vis[next]] });
    },
  })),
]);
