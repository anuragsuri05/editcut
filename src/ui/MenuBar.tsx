import { useEffect, useState, useSyncExternalStore } from "react";
import { MENUS, type MenuItem } from "../commands/menus";
import { getCommand, keysFor, onCommandsChanged, prettyKey, runCommand } from "../commands/registry";
import { MenuList, type ContextMenuItem } from "./kit";
import { useEditor } from "../store/store";

let version = 0;
const subscribe = (cb: () => void) =>
  onCommandsChanged(() => {
    version++;
    cb();
  });

function toItems(items: MenuItem[]): ContextMenuItem[] {
  return items.map((it) => {
    if (it === "-") return { separator: true };
    if (typeof it === "object") return { label: it.label, submenu: toItems(it.items) };
    const c = getCommand(it);
    const k = keysFor(it)[0];
    return {
      label: c?.label ?? humanize(it),
      disabled: !c || (c.enabled ? !c.enabled() : false),
      checked: c?.checked?.(),
      shortcut: k ? prettyKey(k) : undefined,
      onClick: () => runCommand(it),
    };
  });
}

function humanize(id: string): string {
  const last = id.split(".").pop() ?? id;
  return last.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function MenuBar() {
  useSyncExternalStore(subscribe, () => version);
  const [open, setOpen] = useState<number | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  useEditor((s) => s.project); // re-evaluate enabled/checked states on edits
  useEditor((s) => s.selection);

  useEffect(() => {
    if (open === null) return;
    const close = () => setOpen(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="menubar" onMouseDown={(e) => e.stopPropagation()}>
      {MENUS.map((m, i) => (
        <div
          key={m.label}
          className={"menubar-item" + (open === i ? " open" : "")}
          onMouseDown={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setAnchor({ x: r.left, y: r.bottom });
            setOpen(open === i ? null : i);
          }}
          onMouseEnter={(e) => {
            if (open !== null) {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAnchor({ x: r.left, y: r.bottom });
              setOpen(i);
            }
          }}
        >
          {m.label}
        </div>
      ))}
      {open !== null ? <MenuList items={toItems(MENUS[open].items)} x={anchor.x} y={anchor.y} onDone={() => setOpen(null)} /> : null}
    </div>
  );
}
