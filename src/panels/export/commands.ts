// Export commands: Export Media (Cmd+M → Export mode), Quick Export, Captions sidecar.
import { registerCommands } from "../../commands/registry";
import { useEditor } from "../../store/store";
import { openPanel } from "../../dock";
import { downloadCaptions, quickExport, startExportSync } from "./exportClient";

const ed = () => useEditor.getState();
const hasSeq = () => !!ed().project.activeSequenceId;

registerCommands([
  { id: "file.export.media", label: "Media…", keys: ["Mod+M"], run: () => ed().setUI({ mode: "export" }), enabled: hasSeq },
  { id: "file.export.quick", label: "Quick Export", run: () => void quickExport(), enabled: hasSeq },
  { id: "file.export.captions", label: "Captions (SRT)…", run: () => downloadCaptions("srt"), enabled: hasSeq },
  { id: "file.export.captionsVtt", label: "Captions (WebVTT)…", run: () => downloadCaptions("vtt"), enabled: hasSeq },
  { id: "file.export.queue", label: "Export Queue (Media Encoder)", run: () => { ed().setUI({ mode: "edit" }); openPanel("exportQueue"); } },
]);

// Keep the export queue / status bar in sync with the server from startup.
startExportSync();
