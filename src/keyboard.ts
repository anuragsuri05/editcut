// Global keyboard dispatcher: maps key events to commands (panel-scoped first).
import { commandForKey, eventToKey, runCommand } from "./commands/registry";
import { useEditor } from "./store/store";

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || t.isContentEditable) return true;
  if (tag === "INPUT") {
    const type = (t as HTMLInputElement).type;
    return !["range", "checkbox", "radio", "button", "color"].includes(type);
  }
  return tag === "SELECT";
}

export function installKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.repeat && !["J", "L", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", ",", "."].some((k) => e.key.toUpperCase() === k)) {
      // allow auto-repeat only for transport/nudge keys
    }
    if (isTyping(e)) return;
    if (useEditor.getState().dialog) return;
    const key = eventToKey(e);
    const cmd = commandForKey(key, useEditor.getState().activePanel);
    if (cmd) {
      e.preventDefault();
      e.stopPropagation();
      runCommand(cmd.id);
    }
  };
  window.addEventListener("keydown", down);
  return () => window.removeEventListener("keydown", down);
}
