// Friendly labels/icons for Claude's tools in the activity feed, and a tiny
// markdown renderer (bold, italic, code, lists, headings) that builds React
// elements (no innerHTML).
import type { ReactNode } from "react";
import {
  AudioLines, Captions, Clapperboard, Crop, Download, Eye, Film, FolderSearch, Layers, ListVideo, MapPin, Move, Headphones, Palette,
  Scissors, ScissorsLineDashed, Sparkles, Timer, Type, Volume2, WandSparkles, AudioWaveform, Wrench, Mic, SlidersHorizontal, Blend, Gauge, ArrowLeftRight,
} from "lucide-react";

type Icon = typeof Scissors;
export const TOOL_LABELS: Record<string, { running: string; done: string; icon: Icon }> = {
  get_timeline: { running: "Reading the timeline…", done: "Read the timeline", icon: ListVideo },
  list_media: { running: "Looking through your media…", done: "Reviewed media", icon: FolderSearch },
  view_media_frames: { running: "Watching footage…", done: "Watched footage", icon: Eye },
  view_timeline_frames: { running: "Reviewing the edit…", done: "Reviewed the edit", icon: Eye },
  transcribe_media: { running: "Transcribing speech…", done: "Transcribed", icon: Mic },
  get_transcript: { running: "Reading transcript…", done: "Read transcript", icon: Captions },
  detect_scenes: { running: "Detecting shot changes…", done: "Detected scenes", icon: Film },
  detect_silences: { running: "Finding pauses…", done: "Pauses", icon: AudioWaveform },
  create_sequence: { running: "Creating a sequence…", done: "Created sequence", icon: Clapperboard },
  set_active_sequence: { running: "Opening sequence…", done: "Opened sequence", icon: Clapperboard },
  place_clip: { running: "Placing a clip…", done: "Placed clip", icon: Layers },
  append_clips: { running: "Assembling the cut…", done: "Assembled clips", icon: ListVideo },
  move_clips: { running: "Moving clips…", done: "Moved clips", icon: Move },
  trim_clip: { running: "Trimming…", done: "Trimmed", icon: ScissorsLineDashed },
  split_at: { running: "Cutting…", done: "Razor cut", icon: Scissors },
  delete_clips: { running: "Removing clips…", done: "Removed clips", icon: Scissors },
  delete_range: { running: "Cutting out sections…", done: "Cut sections", icon: Scissors },
  close_gaps: { running: "Closing gaps…", done: "Closed gaps", icon: ArrowLeftRight },
  set_clip_speed: { running: "Changing speed…", done: "Speed changed", icon: Gauge },
  set_clip_properties: { running: "Adjusting motion…", done: "Adjusted clips", icon: SlidersHorizontal },
  add_effect: { running: "Applying effect…", done: "Applied effect", icon: WandSparkles },
  update_effect: { running: "Tweaking effect…", done: "Tweaked effect", icon: WandSparkles },
  remove_effect: { running: "Removing effect…", done: "Removed effect", icon: WandSparkles },
  apply_color_grade: { running: "Color grading…", done: "Color graded", icon: Palette },
  enhance_speech: { running: "Enhancing speech…", done: "Enhanced speech", icon: AudioLines },
  add_transition: { running: "Adding transitions…", done: "Added transitions", icon: Blend },
  add_text: { running: "Adding a title…", done: "Added title", icon: Type },
  update_text: { running: "Editing text…", done: "Edited text", icon: Type },
  add_captions: { running: "Creating captions…", done: "Captions", icon: Captions },
  set_volume: { running: "Setting levels…", done: "Levels set", icon: Volume2 },
  duck_music: { running: "Ducking music under voice…", done: "Ducked music", icon: Headphones },
  set_track_properties: { running: "Updating track…", done: "Track updated", icon: Wrench },
  add_marker: { running: "Adding marker…", done: "Marker", icon: MapPin },
  set_in_out: { running: "Setting In/Out…", done: "In/Out set", icon: Timer },
  auto_reframe: { running: "Reframing…", done: "Reframed", icon: Crop },
  remove_filler_words: { running: "Cutting filler words…", done: "Filler words", icon: Scissors },
  beat_sync: { running: "Finding the beat…", done: "Beat sync", icon: Headphones },
  export_sequence: { running: "Starting export…", done: "Export", icon: Download },
};

export function toolLabel(name: string, status: "running" | "done" | "error"): { text: string; icon: Icon } {
  const l = TOOL_LABELS[name];
  if (!l) return { text: name.replace(/_/g, " "), icon: Sparkles };
  return { text: status === "running" ? l.running : l.done, icon: l.icon };
}

// ---------------------------------------------------------------- markdown

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**") || tok.startsWith("__")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const kids = items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>);
      blocks.push(ordered ? <ol key={k++}>{kids}</ol> : <ul key={k++}>{kids}</ul>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(<div key={k++} className="md-h">{inline(h[2], `h${k}`)}</div>);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !lines[i].startsWith("```") && !/^#{1,4}\s/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
