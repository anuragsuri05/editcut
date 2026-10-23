// Built-in workspaces, modeled on Premiere's. A workspace is a function that
// populates an empty DockviewApi.
import type { DockviewApi } from "dockview-react";
import { PANELS } from "./panels/registry";

export interface WorkspaceDef {
  id: string;
  name: string;
  build: (api: DockviewApi) => void;
}

function add(api: DockviewApi, id: string, ref?: string, direction?: "left" | "right" | "above" | "below" | "within", size?: { width?: number; height?: number }) {
  const p = api.addPanel({
    id,
    component: id,
    title: PANELS[id].title,
    position: ref ? { referencePanel: ref, direction: direction ?? "within" } : undefined,
    initialWidth: size?.width,
    initialHeight: size?.height,
  });
  return p;
}

function finish(api: DockviewApi, active: string[]) {
  for (const id of active) api.getPanel(id)?.api.setActive();
}

export const WORKSPACES: WorkspaceDef[] = [
  {
    id: "editing",
    name: "Editing",
    build: (api) => {
      add(api, "source");
      add(api, "effectControls", "source", "within");
      add(api, "lumetriScopes", "source", "within");
      add(api, "program", "source", "right");
      add(api, "ai", "program", "right", { width: 340 });
      add(api, "properties", "ai", "within");
      add(api, "essentialSound", "ai", "within");
      add(api, "project", "source", "below", { height: 380 });
      add(api, "mediaBrowser", "project", "within");
      add(api, "effects", "project", "within");
      add(api, "markers", "project", "within");
      add(api, "history", "project", "within");
      add(api, "info", "project", "within");
      add(api, "tools", "project", "right", { width: 44 });
      add(api, "timeline", "tools", "right");
      add(api, "text", "timeline", "within");
      add(api, "audioMeters", "timeline", "right", { width: 70 });
      finish(api, ["source", "program", "ai", "project", "timeline"]);
    },
  },
  {
    id: "assembly",
    name: "Assembly",
    build: (api) => {
      add(api, "project", undefined, undefined);
      add(api, "mediaBrowser", "project", "within");
      add(api, "source", "project", "right");
      add(api, "program", "source", "right");
      add(api, "tools", "project", "below", { height: 320 });
      add(api, "timeline", "tools", "right");
      add(api, "audioMeters", "timeline", "right", { width: 70 });
      finish(api, ["project", "timeline"]);
    },
  },
  {
    id: "color",
    name: "Color",
    build: (api) => {
      add(api, "lumetriScopes");
      add(api, "program", "lumetriScopes", "right");
      add(api, "lumetri", "program", "right", { width: 340 });
      add(api, "effectControls", "lumetriScopes", "within");
      add(api, "timeline", "lumetriScopes", "below", { height: 300 });
      add(api, "project", "timeline", "left", { width: 300 });
      finish(api, ["lumetriScopes", "lumetri", "timeline"]);
    },
  },
  {
    id: "effects",
    name: "Effects",
    build: (api) => {
      add(api, "effectControls");
      add(api, "program", "effectControls", "right");
      add(api, "effects", "program", "right", { width: 320 });
      add(api, "properties", "effects", "within");
      add(api, "project", "effectControls", "below", { height: 340 });
      add(api, "tools", "project", "right", { width: 44 });
      add(api, "timeline", "tools", "right");
      finish(api, ["effectControls", "effects", "timeline"]);
    },
  },
  {
    id: "audio",
    name: "Audio",
    build: (api) => {
      add(api, "audioMixer");
      add(api, "program", "audioMixer", "right");
      add(api, "essentialSound", "program", "right", { width: 340 });
      add(api, "effectControls", "audioMixer", "within");
      add(api, "project", "audioMixer", "below", { height: 340 });
      add(api, "timeline", "project", "right");
      add(api, "audioMeters", "timeline", "right", { width: 80 });
      finish(api, ["audioMixer", "essentialSound", "timeline"]);
    },
  },
  {
    id: "captions",
    name: "Captions and Graphics",
    build: (api) => {
      add(api, "text");
      add(api, "program", "text", "right");
      add(api, "properties", "program", "right", { width: 340 });
      add(api, "project", "text", "below", { height: 320 });
      add(api, "timeline", "project", "right");
      finish(api, ["text", "properties", "timeline"]);
    },
  },
  {
    id: "ai",
    name: "AI Editing",
    build: (api) => {
      add(api, "ai", undefined, undefined, { width: 420 });
      add(api, "program", "ai", "right");
      add(api, "text", "program", "right", { width: 340 });
      add(api, "project", "ai", "below", { height: 320 });
      add(api, "timeline", "project", "right");
      finish(api, ["ai", "program", "timeline"]);
    },
  },
];
