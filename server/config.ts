// Server configuration, data directories and persisted settings.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PORT = Number(process.env.EDITCUT_PORT ?? 5174);
export const DATA_DIR = process.env.EDITCUT_DATA ?? path.join(os.homedir(), "EditCut");
export const MEDIA_DIR = path.join(DATA_DIR, "media"); // per-asset folders: <id>/original.ext, proxy.mp4, thumbs.jpg, waveform.json
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const TMP_DIR = path.join(DATA_DIR, "tmp");
export const MODELS_DIR = path.join(DATA_DIR, "models"); // whisper models
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

for (const d of [DATA_DIR, MEDIA_DIR, PROJECTS_DIR, TMP_DIR, MODELS_DIR]) fs.mkdirSync(d, { recursive: true });

export interface Settings {
  anthropicApiKey?: string;
  model: string;
  exportDirectory: string;
}

let settings: Settings = {
  model: "claude-opus-5-5",
  exportDirectory: path.join(os.homedir(), "Movies", "EditCut"),
};
try {
  settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
} catch {
  /* first run */
}

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  settings = { ...settings, ...patch };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
  return settings;
}

/** Anthropic API key: settings file first, then environment (the SDK also reads ANTHROPIC_API_KEY itself). */
export function apiKey(): string | undefined {
  return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
}
