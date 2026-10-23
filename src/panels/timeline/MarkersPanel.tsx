// Markers panel: sequence markers (+ markers of selected clips) with color,
// name, In/Out, duration, comment; search, color filter, click to jump, inline edit.
import { useMemo, useState } from "react";
import type { ID, Marker, MarkerColor } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { getClip } from "@shared/ops";
import { useEditor, editor } from "../../store/store";
import { playback } from "../../store/playback";
import { TextInput, Empty, showContextMenu } from "../../ui/kit";
import { MARKER_COLORS } from "./dialogs";
import { tl, useTimeline } from "./state";
import "./timeline.css";

type Row = { m: Marker; clipId?: ID; clipName?: string; offset: number };

function InlineField({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState<string | null>(null);
  return (
    <input
      value={v ?? value}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== null && v !== value) onCommit(v);
        setV(null);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(null);
      }}
    />
  );
}

export default function MarkersPanel() {
  const seq = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId] ?? null : null));
  const selIds = useEditor((s) => s.selection.clipIds);
  const selectedMarkerId = useTimeline((s) => s.selectedMarkerId);
  const [q, setQ] = useState("");
  const [colors, setColors] = useState<Set<MarkerColor>>(new Set(Object.keys(MARKER_COLORS) as MarkerColor[]));

  const rows = useMemo(() => {
    if (!seq) return { seqRows: [] as Row[], clipRows: [] as Row[] };
    const match = (m: Marker) => colors.has(m.color) && (!q || (m.name + " " + m.comment + " " + m.color).toLowerCase().includes(q.toLowerCase()));
    const seqRows = seq.markers.filter(match).map((m) => ({ m, offset: 0 }));
    const clipRows: Row[] = [];
    for (const id of selIds) {
      const c = getClip(seq, id);
      if (c) for (const m of c.markers) if (match(m)) clipRows.push({ m, clipId: c.id, clipName: c.name, offset: c.start });
    }
    return { seqRows: seqRows.sort((a, b) => a.m.time - b.m.time), clipRows: clipRows.sort((a, b) => a.m.time + a.offset - (b.m.time + b.offset)) };
  }, [seq, selIds, q, colors]);

  if (!seq) return <Empty>No active sequence</Empty>;
  const fps = seq.settings.fps;

  const edit = (row: Row, patch: Partial<Marker>, label: string) => {
    editor().applySeq(label, (s) => {
      const list = row.clipId ? getClip(s, row.clipId)?.markers : s.markers;
      const m = list?.find((x) => x.id === row.m.id);
      if (m) Object.assign(m, patch);
    });
  };
  const remove = (row: Row) =>
    editor().applySeq("Delete Marker", (s) => {
      if (row.clipId) {
        const c = getClip(s, row.clipId);
        if (c) c.markers = c.markers.filter((x) => x.id !== row.m.id);
      } else s.markers = s.markers.filter((x) => x.id !== row.m.id);
    });

  const renderRow = (row: Row) => {
    const { m } = row;
    const t = m.time + row.offset;
    return (
      <div
        key={m.id}
        className={"mk-row" + (selectedMarkerId === m.id ? " active" : "")}
        onClick={() => {
          playback().setTime(t);
          if (!row.clipId) tl().set({ selectedMarkerId: m.id });
        }}
        onDoubleClick={() => editor().openDialog("timeline.marker", { markerId: m.id, clipId: row.clipId })}
        onContextMenu={(e) => showContextMenu(e, [
          { label: "Edit Marker…", onClick: () => editor().openDialog("timeline.marker", { markerId: m.id, clipId: row.clipId }) },
          { label: "Color", submenu: (Object.keys(MARKER_COLORS) as MarkerColor[]).map((c) => ({ label: c[0].toUpperCase() + c.slice(1), checked: m.color === c, onClick: () => edit(row, { color: c }, "Marker Color") })) },
          { separator: true },
          { label: "Delete Marker", onClick: () => remove(row) },
        ])}
        title={row.clipName ? `Clip marker on "${row.clipName}"` : "Sequence marker"}
      >
        <span className="mk-dot" style={{ background: MARKER_COLORS[m.color] }} />
        <InlineField value={m.name} placeholder={row.clipName ? `(${row.clipName})` : "Marker"} onCommit={(name) => edit(row, { name }, "Rename Marker")} />
        <span className="mono">{formatTimecode(t, fps)}</span>
        <span className="mono">{formatTimecode(t + m.duration, fps)}</span>
        <span className="mono">{formatTimecode(m.duration, fps)}</span>
        <InlineField value={m.comment} placeholder="Comment" onCommit={(comment) => edit(row, { comment }, "Marker Comment")} />
      </div>
    );
  };

  return (
    <div className="mk-panel">
      <div className="mk-toolbar">
        <TextInput value={q} onChange={setQ} placeholder="Search markers…" style={{ flex: 1, minWidth: 100 }} />
        <div className="mk-colors" title="Filter by color">
          {(Object.keys(MARKER_COLORS) as MarkerColor[]).map((c) => (
            <button
              key={c}
              className={"mk-color" + (colors.has(c) ? " on" : "")}
              style={{ background: MARKER_COLORS[c] }}
              title={c}
              onClick={(e) => {
                const next = new Set(colors);
                if (e.altKey) {
                  // Alt-click: solo this color
                  next.clear();
                  next.add(c);
                } else if (next.has(c)) next.delete(c);
                else next.add(c);
                setColors(next);
              }}
            />
          ))}
        </div>
      </div>
      <div className="mk-list">
        <div className="mk-head"><span /><span>Name</span><span>In</span><span>Out</span><span>Duration</span><span>Comment</span></div>
        {rows.seqRows.length === 0 && rows.clipRows.length === 0 ? <div className="panel-empty" style={{ padding: 20 }}>No markers. Press M to add one at the playhead.</div> : null}
        {rows.seqRows.map(renderRow)}
        {rows.clipRows.length ? <div className="mk-sub">Selected clip markers</div> : null}
        {rows.clipRows.map(renderRow)}
      </div>
    </div>
  );
}
