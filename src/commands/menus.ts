// Premiere-style application menus. Items reference command ids from the
// registry; unregistered commands render disabled. "-" is a separator.
// Ownership of command id prefixes (who registers them):
//   file.*, project.*            -> src/commands/fileCommands.ts (media/project agent) + export agent (file.export.*)
//   edit.*, clip.*, sequence.*, markers.*, tool.*  -> src/panels/timeline/commands.ts (timeline agent)
//   play.*, monitor.*            -> src/engine/commands.ts (engine agent)
//   graphics.*, effects.*        -> src/panels/effects/commands.ts (effects agent)
//   ai.*, captions.*             -> src/panels/ai/commands.ts (AI agent)
//   window.*, view.*, app.*      -> src/commands/core.ts (shell)

export type MenuItem = string | "-" | { label: string; items: MenuItem[] };

export interface Menu {
  label: string;
  items: MenuItem[];
}

export const MENUS: Menu[] = [
  {
    label: "File",
    items: [
      { label: "New", items: ["file.newProject", "file.newSequence", "file.newBin", "-", "graphics.newText", "graphics.newRectangle", "graphics.newEllipse", "-", "file.newAdjustmentLayer", "file.newColorMatte", "file.newBlackVideo", "file.newBarsAndTone"] },
      "file.openProject", "file.openRecent", "file.closeProject", "-",
      "file.save", "file.saveAs", "file.saveCopy", "file.revert", "-",
      "file.import", "file.importFromPath", "file.mediaBrowser", "-",
      "file.linkMedia", "file.makeOffline", "file.projectManager", "-",
      { label: "Export", items: ["file.export.media", "file.export.quick", "file.export.frame", "file.export.captions", "file.export.projectJson"] }, "-",
      "file.projectSettings", "app.settings",
    ],
  },
  {
    label: "Edit",
    items: [
      "edit.undo", "edit.redo", "-",
      "edit.cut", "edit.copy", "edit.paste", "edit.pasteInsert", "edit.pasteAttributes", "edit.removeAttributes", "-",
      "edit.clear", "edit.rippleDelete", "edit.duplicate", "edit.selectAll", "edit.deselectAll", "-",
      "edit.find", "edit.label", "-",
      "app.keyboardShortcuts", "app.settings",
    ],
  },
  {
    label: "Clip",
    items: [
      "clip.rename", "clip.makeSubclip", "clip.editSubclip", "-",
      "clip.modifyAudioChannels", "clip.speedDuration", "clip.sceneEditDetection", "-",
      "clip.audioGain", "clip.enable", "clip.link", "clip.unlink", "clip.group", "clip.ungroup", "-",
      "clip.nest", "clip.replaceWithClip", "clip.frameHold", "clip.addFrameHold", "clip.insertFrameHold", "-",
      "clip.scaleToFrameSize", "clip.setToFrameSize", "clip.autoReframe", "-",
      "clip.reveal",
    ],
  },
  {
    label: "Sequence",
    items: [
      "sequence.settings", "sequence.renderInOut", "sequence.deleteRenderFiles", "-",
      "sequence.matchFrame", "sequence.reverseMatchFrame", "-",
      "sequence.addEdit", "sequence.addEditAllTracks", "sequence.trimEdit", "sequence.extendEdit", "-",
      "sequence.applyVideoTransition", "sequence.applyAudioTransition", "sequence.applyDefaultTransitionsToSelection", "-",
      "sequence.lift", "sequence.extract", "sequence.rippleDeleteGap", "sequence.closeGaps", "-",
      "sequence.zoomIn", "sequence.zoomOut", "sequence.zoomToFit", "-",
      "sequence.snapping", "sequence.linkedSelection", "-",
      "sequence.addTracks", "sequence.deleteEmptyTracks", "-",
      "sequence.autoReframe", "sequence.simplify",
    ],
  },
  {
    label: "Markers",
    items: [
      "markers.markIn", "markers.markOut", "markers.markClip", "markers.markSelection", "-",
      "markers.goToIn", "markers.goToOut", "-",
      "markers.clearIn", "markers.clearOut", "markers.clearInOut", "-",
      "markers.addMarker", "markers.goToNextMarker", "markers.goToPrevMarker", "markers.clearSelectedMarker", "markers.clearAllMarkers", "markers.editMarker", "-",
      "markers.addChapterMarker",
    ],
  },
  {
    label: "Graphics and Titles",
    items: ["graphics.newText", "graphics.newRectangle", "graphics.newEllipse", "-", "graphics.upgradeCaptionsToGraphic", "graphics.alignCenter", "graphics.alignHCenter", "graphics.alignVCenter", "-", "graphics.titleTemplates"],
  },
  {
    label: "AI",
    items: [
      "ai.openAssistant", "-",
      "ai.autoEdit", "ai.roughCut", "ai.removeSilences", "ai.removeFillerWords", "ai.sceneDetect", "-",
      "captions.transcribe", "captions.generate", "captions.translate", "-",
      "ai.enhanceSpeech", "ai.autoColor", "ai.colorMatch", "ai.autoDuck", "ai.autoReframeVertical", "ai.beatSync", "-",
      "ai.describeFrame", "-",
      "lab.open", "lab.analyzeSequence", "lab.analyzeSelected",
    ],
  },
  {
    label: "View",
    items: [
      "view.playbackResolutionFull", "view.playbackResolutionHalf", "view.playbackResolutionQuarter", "-",
      "view.toggleProxies", "view.safeMargins", "view.loop", "-",
      "view.zoomFit", "view.zoom100", "-",
      "view.showRulers", "view.showGuides",
    ],
  },
  {
    label: "Window",
    items: [
      { label: "Workspaces", items: ["window.ws.editing", "window.ws.assembly", "window.ws.color", "window.ws.effects", "window.ws.audio", "window.ws.captions", "window.ws.ai", "-", "window.resetWorkspace", "window.saveWorkspace"] }, "-",
      "window.panel.ai", "window.panel.audioMeters", "window.panel.audioMixer", "window.panel.effectControls", "window.panel.effects",
      "window.panel.essentialSound", "window.panel.history", "window.panel.info", "window.panel.lumetri", "window.panel.lumetriScopes",
      "window.panel.markers", "window.panel.mediaBrowser", "window.panel.program", "window.panel.project", "window.panel.properties",
      "window.panel.source", "window.panel.text", "window.panel.timeline", "window.panel.tools", "window.panel.exportQueue",
    ],
  },
  {
    label: "Help",
    items: ["app.help", "app.keyboardShortcuts", "app.about"],
  },
];
