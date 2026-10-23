// Shared UI primitives. Use these in every panel for a consistent Premiere look.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------- HotNumber
/**
 * Premiere "hot text": blue number you drag left/right to scrub, click to type.
 * Shift = 10x step, Alt/Cmd = 0.1x step. onChange fires live while dragging;
 * onCommit fires once at the end (use it for undoable history entries).
 */
export function HotNumber(props: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
  width?: number;
  disabled?: boolean;
  format?: (v: number) => string;
  parse?: (s: string) => number | null;
  title?: string;
}) {
  const { value, min = -Infinity, max = Infinity, step = 1, decimals = step < 1 ? 1 : 0, unit, disabled } = props;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const fmt = props.format ?? ((v: number) => v.toFixed(decimals));

  if (editing)
    return (
      <input
        className="hot-input"
        autoFocus
        style={{ width: props.width ?? 56 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const v = props.parse ? props.parse(text) : parseFloat(text);
            if (v !== null && !Number.isNaN(v)) {
              props.onChange(clamp(v));
              props.onCommit?.(clamp(v));
            }
            setEditing(false);
          } else if (e.key === "Escape") setEditing(false);
        }}
      />
    );

  return (
    <span
      className={"hot-number" + (disabled ? " disabled" : "")}
      title={props.title}
      onPointerDown={(e) => {
        if (disabled) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 2) d.moved = true;
        if (!d.moved) return;
        const mult = e.shiftKey ? 10 : e.altKey || e.metaKey ? 0.1 : 1;
        props.onChange(clamp(+(d.v + dx * step * mult).toFixed(6)));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) {
          setText(fmt(value));
          setEditing(true);
        } else {
          const mult = e.shiftKey ? 10 : e.altKey || e.metaKey ? 0.1 : 1;
          props.onCommit?.(clamp(+(d.v + (e.clientX - d.x) * step * mult).toFixed(6)));
        }
      }}
    >
      {fmt(value)}
      {unit ? <span className="hot-unit">{unit}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------- Slider
export function Slider(props: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; defaultValue?: number; style?: CSSProperties }) {
  return (
    <input
      type="range"
      className="slider"
      style={props.style}
      min={props.min}
      max={props.max}
      step={props.step ?? (props.max - props.min) / 1000}
      value={props.value}
      onChange={(e) => props.onChange(parseFloat(e.target.value))}
      onPointerUp={(e) => props.onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => props.onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      onDoubleClick={() => {
        if (props.defaultValue !== undefined) {
          props.onChange(props.defaultValue);
          props.onCommit?.(props.defaultValue);
        }
      }}
    />
  );
}

/** Label + slider + hot number row (Lumetri style). Double-click resets. */
export function SliderRow(props: { label: string; value: number; min: number; max: number; step?: number; defaultValue: number; unit?: string; onChange: (v: number) => void; onCommit: (v: number) => void }) {
  return (
    <div className="slider-row" onDoubleClick={() => { props.onChange(props.defaultValue); props.onCommit(props.defaultValue); }}>
      <label>{props.label}</label>
      <Slider value={props.value} min={props.min} max={props.max} step={props.step} onChange={props.onChange} onCommit={props.onCommit} />
      <HotNumber value={props.value} min={props.min} max={props.max} step={props.step ?? (props.max - props.min) / 200} unit={props.unit} onChange={props.onChange} onCommit={props.onCommit} />
    </div>
  );
}

// ---------------------------------------------------------------- Section (twirl-down)
export function Section(props: { title: ReactNode; defaultOpen?: boolean; right?: ReactNode; children: ReactNode; enabled?: boolean; onToggleEnabled?: () => void }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <div className="section">
      <div className="section-header" onClick={() => setOpen(!open)}>
        <span className={"twirl" + (open ? " open" : "")}>▸</span>
        {props.onToggleEnabled ? (
          <span
            className={"fx-toggle" + (props.enabled ? " on" : "")}
            title="Toggle effect on/off"
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleEnabled!();
            }}
          >
            fx
          </span>
        ) : null}
        <span className="section-title">{props.title}</span>
        <span className="section-right" onClick={(e) => e.stopPropagation()}>
          {props.right}
        </span>
      </div>
      {open ? <div className="section-body">{props.children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Buttons
export function Button(props: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; small?: boolean; style?: CSSProperties }) {
  return (
    <button className={"btn" + (props.primary ? " primary" : "") + (props.small ? " small" : "")} disabled={props.disabled} title={props.title} onClick={props.onClick} style={props.style}>
      {props.children}
    </button>
  );
}

export function IconButton(props: { children: ReactNode; onClick?: (e: React.MouseEvent) => void; active?: boolean; title?: string; disabled?: boolean; size?: number; style?: CSSProperties }) {
  return (
    <button
      className={"icon-btn" + (props.active ? " active" : "")}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{ width: props.size, height: props.size, ...props.style }}
    >
      {props.children}
    </button>
  );
}

export function Checkbox(props: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  );
}

export function Select<T extends string>(props: { value: T; options: { value: T; label: string }[] | T[]; onChange: (v: T) => void; style?: CSSProperties; disabled?: boolean }) {
  const opts = (props.options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select className="select" value={props.value} style={props.style} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ColorInput(props: { value: string; onChange: (v: string) => void; onCommit?: (v: string) => void }) {
  return (
    <input
      type="color"
      className="color-input"
      value={toHex(props.value)}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={(e) => props.onCommit?.(e.target.value)}
    />
  );
}

function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((x) => x + x).join("");
  return "#ffffff";
}

export function Tabs<T extends string>(props: { value: T; tabs: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {props.tabs.map((t) => (
        <button key={t.value} className={"tab" + (t.value === props.value ? " active" : "")} onClick={() => props.onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void; style?: CSSProperties; autoFocus?: boolean }) {
  return (
    <input
      className="text-input"
      value={props.value}
      placeholder={props.placeholder}
      style={props.style}
      autoFocus={props.autoFocus}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation(); // don't trigger shortcuts while typing
        if (e.key === "Enter") props.onEnter?.();
      }}
    />
  );
}

// ---------------------------------------------------------------- Dialog frame
export function Dialog(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [props]);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="dialog" style={{ width: props.width ?? 480 }} onKeyDown={(e) => e.stopPropagation()}>
        <div className="dialog-title">{props.title}</div>
        <div className="dialog-body">{props.children}</div>
        {props.footer ? <div className="dialog-footer">{props.footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Context menu
export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  checked?: boolean;
  shortcut?: string;
  separator?: boolean;
  submenu?: ContextMenuItem[];
}

let openMenu: ((m: { x: number; y: number; items: ContextMenuItem[] } | null) => void) | null = null;

/** Open a context menu at the mouse position. Call from onContextMenu handlers. */
export function showContextMenu(e: { clientX: number; clientY: number; preventDefault: () => void }, items: ContextMenuItem[]): void {
  e.preventDefault();
  openMenu?.({ x: e.clientX, y: e.clientY, items });
}

export function ContextMenuHost() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  useEffect(() => {
    openMenu = setMenu;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, []);
  if (!menu) return null;
  return createPortal(<MenuList items={menu.items} x={menu.x} y={menu.y} onDone={() => setMenu(null)} />, document.body);
}

export function MenuList(props: { items: ContextMenuItem[]; x: number; y: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: props.x, y: props.y });
  const [sub, setSub] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(props.x, window.innerWidth - r.width - 4), y: Math.min(props.y, window.innerHeight - r.height - 4) });
  }, [props.x, props.y]);
  return (
    <div ref={ref} className="menu-list" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
      {props.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" />
        ) : (
          <div
            key={i}
            className={"menu-item" + (it.disabled ? " disabled" : "")}
            onMouseEnter={() => setSub(it.submenu ? i : null)}
            onClick={() => {
              if (it.disabled || it.submenu) return;
              props.onDone();
              it.onClick?.();
            }}
          >
            <span className="menu-check">{it.checked ? "✓" : ""}</span>
            <span className="menu-label">{it.label}</span>
            <span className="menu-shortcut">{it.submenu ? "▸" : it.shortcut}</span>
            {it.submenu && sub === i ? (
              <SubMenu items={it.submenu} onDone={props.onDone} />
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}

function SubMenu(props: { items: ContextMenuItem[]; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const parent = ref.current?.parentElement?.getBoundingClientRect();
    if (parent) setRect({ x: parent.right, y: parent.top - 4 });
  }, []);
  return <div ref={ref}>{rect ? <MenuList items={props.items} x={rect.x} y={rect.y} onDone={props.onDone} /> : null}</div>;
}

// ---------------------------------------------------------------- misc
export function Empty(props: { children: ReactNode }) {
  return <div className="panel-empty">{props.children}</div>;
}

export function Row(props: { children: ReactNode; gap?: number; style?: CSSProperties; className?: string }) {
  return (
    <div className={"row " + (props.className ?? "")} style={{ gap: props.gap ?? 6, ...props.style }}>
      {props.children}
    </div>
  );
}

export function Progress(props: { value: number }) {
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${Math.round(Math.min(1, Math.max(0, props.value)) * 100)}%` }} />
    </div>
  );
}
