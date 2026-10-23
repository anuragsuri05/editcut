// Command registry: every user action (menu item, keyboard shortcut, toolbar
// button) is a Command. Menus and the keyboard handler both dispatch through
// here, so a feature is implemented once and is reachable from everywhere.

export interface Command {
  id: string; // e.g. "edit.undo", "sequence.addEdit"
  label: string;
  /** Default shortcut(s), Premiere-style. Use "Mod" for Cmd (mac) / Ctrl (win). Examples: "Mod+Z", "Shift+Delete", "J", "Alt+ArrowLeft". */
  keys?: string[];
  /** Only active when this panel has focus (panel-scoped shortcut), e.g. "timeline". */
  scope?: string;
  run: () => void;
  enabled?: () => boolean;
  /** For toggle items in menus (shows a check mark). */
  checked?: () => boolean;
}

const commands = new Map<string, Command>();
const listeners = new Set<() => void>();
const userKeys = new Map<string, string[]>(); // customized shortcuts

export function registerCommands(list: Command[]): void {
  for (const c of list) commands.set(c.id, c);
  listeners.forEach((l) => l());
}

export function getCommand(id: string): Command | undefined {
  return commands.get(id);
}

export function allCommands(): Command[] {
  return [...commands.values()];
}

export function runCommand(id: string): boolean {
  const c = commands.get(id);
  if (!c) {
    console.warn("Unknown command", id);
    return false;
  }
  if (c.enabled && !c.enabled()) return false;
  c.run();
  return true;
}

export function keysFor(id: string): string[] {
  return userKeys.get(id) ?? commands.get(id)?.keys ?? [];
}

export function setUserKeys(id: string, keys: string[]): void {
  userKeys.set(id, keys);
  try {
    localStorage.setItem("editcut.keys", JSON.stringify(Object.fromEntries(userKeys)));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function loadUserKeys(): void {
  try {
    const raw = localStorage.getItem("editcut.keys");
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string[]>)) userKeys.set(k, v);
  } catch {
    /* ignore */
  }
}

export function onCommandsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Normalize a KeyboardEvent to our key string, e.g. "Mod+Shift+K". */
export function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) parts.push("Mod");
  if (isMac && e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = e.key;
  if (e.code.startsWith("Key")) k = e.code.slice(3);
  else if (e.code.startsWith("Digit")) k = e.code.slice(5);
  else if (e.code === "Space") k = "Space";
  else if (e.code === "Comma") k = ",";
  else if (e.code === "Period") k = ".";
  else if (e.code === "Semicolon") k = ";";
  else if (e.code === "Quote") k = "'";
  else if (e.code === "BracketLeft") k = "[";
  else if (e.code === "BracketRight") k = "]";
  else if (e.code === "Backslash") k = "\\";
  else if (e.code === "Equal") k = "=";
  else if (e.code === "Minus") k = "-";
  else if (e.code === "Backquote") k = "`";
  else if (e.code === "Slash") k = "/";
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

/** Pretty-print a key string for menus: "Mod+Shift+K" -> "⌘⇧K" on mac. */
export function prettyKey(k: string): string {
  if (!isMac) return k.replace("Mod", "Ctrl");
  return k
    .replace("Mod+", "⌘")
    .replace("Ctrl+", "⌃")
    .replace("Alt+", "⌥")
    .replace("Shift+", "⇧")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓")
    .replace("Backspace", "⌫")
    .replace("Delete", "⌦")
    .replace("Enter", "↩")
    .replace("Escape", "Esc");
}

/** Find the command bound to a key, preferring one scoped to the active panel. */
export function commandForKey(key: string, activePanel: string): Command | undefined {
  let global: Command | undefined;
  for (const c of commands.values()) {
    if (!keysFor(c.id).includes(key)) continue;
    if (c.scope && c.scope === activePanel) return c;
    if (!c.scope) global ??= c;
  }
  return global;
}
