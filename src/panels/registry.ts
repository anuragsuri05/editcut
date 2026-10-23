// Panel registry: id -> title + component. Workspaces (src/workspaces.ts) are
// arrangements of these ids in the dock layout.
import type { FunctionComponent } from "react";
import ProjectPanel from "./project/ProjectPanel";
import MediaBrowserPanel from "./project/MediaBrowserPanel";
import InfoPanel from "./project/InfoPanel";
import SourceMonitor from "./monitors/SourceMonitor";
import ProgramMonitor from "./monitors/ProgramMonitor";
import ScopesPanel from "./monitors/ScopesPanel";
import AudioMetersPanel from "./monitors/AudioMetersPanel";
import TimelinePanel from "./timeline/TimelinePanel";
import ToolsPanel from "./timeline/ToolsPanel";
import MarkersPanel from "./timeline/MarkersPanel";
import HistoryPanel from "./timeline/HistoryPanel";
import EffectControlsPanel from "./effects/EffectControlsPanel";
import EffectsPanel from "./effects/EffectsPanel";
import LumetriPanel from "./effects/LumetriPanel";
import EssentialSoundPanel from "./effects/EssentialSoundPanel";
import AudioMixerPanel from "./effects/AudioMixerPanel";
import PropertiesPanel from "./effects/PropertiesPanel";
import TextPanel from "./ai/TextPanel";
import AssistantPanel from "./ai/AssistantPanel";
import ExportQueuePanel from "./export/ExportQueuePanel";

export interface PanelDef {
  title: string;
  component: FunctionComponent;
}

export const PANELS: Record<string, PanelDef> = {
  project: { title: "Project", component: ProjectPanel },
  mediaBrowser: { title: "Media Browser", component: MediaBrowserPanel },
  info: { title: "Info", component: InfoPanel },
  source: { title: "Source", component: SourceMonitor },
  program: { title: "Program", component: ProgramMonitor },
  lumetriScopes: { title: "Lumetri Scopes", component: ScopesPanel },
  audioMeters: { title: "Audio Meters", component: AudioMetersPanel },
  timeline: { title: "Timeline", component: TimelinePanel },
  tools: { title: "Tools", component: ToolsPanel },
  markers: { title: "Markers", component: MarkersPanel },
  history: { title: "History", component: HistoryPanel },
  effectControls: { title: "Effect Controls", component: EffectControlsPanel },
  effects: { title: "Effects", component: EffectsPanel },
  lumetri: { title: "Lumetri Color", component: LumetriPanel },
  essentialSound: { title: "Essential Sound", component: EssentialSoundPanel },
  audioMixer: { title: "Audio Track Mixer", component: AudioMixerPanel },
  properties: { title: "Properties", component: PropertiesPanel },
  text: { title: "Text", component: TextPanel },
  ai: { title: "AI Assistant", component: AssistantPanel },
  exportQueue: { title: "Export Queue", component: ExportQueuePanel },
};
