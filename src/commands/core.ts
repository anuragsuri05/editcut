// Shell-level commands: undo/redo, workspaces, panels, view toggles, app dialogs.
import { registerCommands } from "./registry";
import { useEditor } from "../store/store";
import { openPanel, setWorkspace, getCurrentWorkspace } from "../dock";
import { PANELS } from "../panels/registry";
import { WORKSPACES } from "../workspaces";

const ed = () => useEditor.getState();

registerCommands([
  { id: "edit.undo", label: "Undo", keys: ["Mod+Z"], run: () => ed().undo(), enabled: () => ed().past.length > 0 },
  { id: "edit.redo", label: "Redo", keys: ["Mod+Shift+Z", "Mod+Y"], run: () => ed().redo(), enabled: () => ed().future.length > 0 },

  ...WORKSPACES.map((w, i) => ({
    id: `window.ws.${w.id}`,
    label: w.name,
    keys: [`Alt+Shift+${i + 1}`],
    run: () => setWorkspace(w.id),
    checked: () => getCurrentWorkspace() === w.id,
  })),
  { id: "window.resetWorkspace", label: "Reset to Saved Layout", keys: ["Alt+Shift+0"], run: () => setWorkspace(getCurrentWorkspace(), true) },
  { id: "window.saveWorkspace", label: "Save Changes to this Workspace", run: () => ed().toast("Workspace layout saved", "success") },

  ...Object.entries(PANELS).map(([id, def]) => ({ id: `window.panel.${id}`, label: def.title, run: () => openPanel(id) })),
  { id: "window.panel.project", label: "Project", keys: ["Shift+1"], run: () => openPanel("project") },
  { id: "window.panel.source", label: "Source Monitor", keys: ["Shift+2"], run: () => openPanel("source") },
  { id: "window.panel.timeline", label: "Timeline", keys: ["Shift+3"], run: () => openPanel("timeline") },
  { id: "window.panel.program", label: "Program Monitor", keys: ["Shift+4"], run: () => openPanel("program") },
  { id: "window.panel.effectControls", label: "Effect Controls", keys: ["Shift+5"], run: () => openPanel("effectControls") },
  { id: "window.panel.audioMixer", label: "Audio Track Mixer", keys: ["Shift+6"], run: () => openPanel("audioMixer") },
  { id: "window.panel.effects", label: "Effects", keys: ["Shift+7"], run: () => openPanel("effects") },
  { id: "window.panel.mediaBrowser", label: "Media Browser", keys: ["Shift+8"], run: () => openPanel("mediaBrowser") },

  { id: "view.playbackResolutionFull", label: "Playback Resolution: Full", run: () => ed().setUI({ playbackResolution: 1 }), checked: () => ed().playbackResolution === 1 },
  { id: "view.playbackResolutionHalf", label: "Playback Resolution: 1/2", run: () => ed().setUI({ playbackResolution: 0.5 }), checked: () => ed().playbackResolution === 0.5 },
  { id: "view.playbackResolutionQuarter", label: "Playback Resolution: 1/4", run: () => ed().setUI({ playbackResolution: 0.25 }), checked: () => ed().playbackResolution === 0.25 },
  { id: "view.toggleProxies", label: "Toggle Proxies", run: () => ed().setUI({ proxiesEnabled: !ed().proxiesEnabled }), checked: () => ed().proxiesEnabled },
  { id: "view.safeMargins", label: "Safe Margins", run: () => ed().setUI({ showSafeMargins: !ed().showSafeMargins }), checked: () => ed().showSafeMargins },
  { id: "view.loop", label: "Loop Playback", run: () => ed().setUI({ loopPlayback: !ed().loopPlayback }), checked: () => ed().loopPlayback },

  { id: "app.modeImport", label: "Import Mode", run: () => ed().setUI({ mode: "import" }) },
  { id: "app.modeEdit", label: "Edit Mode", run: () => ed().setUI({ mode: "edit" }) },
  { id: "app.modeExport", label: "Export Mode", run: () => ed().setUI({ mode: "export" }) },
  { id: "app.keyboardShortcuts", label: "Keyboard Shortcuts…", keys: ["Mod+Alt+K"], run: () => ed().openDialog("keyboardShortcuts") },
  { id: "app.about", label: "About EditCut", run: () => ed().openDialog("about") },
  { id: "app.help", label: "EditCut Help", run: () => ed().openDialog("keyboardShortcuts") },
]);
