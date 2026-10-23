import { useState } from "react";
import { registerDialog } from "../../ui/dialogs";
import { Button, Checkbox, Dialog, Select, TextInput } from "../../ui/kit";
import { exportFrame } from "./actions";

// ---------------------------------------------------------------- Export Frame dialog

function ExportFrameDialog(props: { onClose: () => void; which?: "program" | "source"; defaultName?: string }) {
  const [name, setName] = useState(props.defaultName ?? "Still");
  const [format, setFormat] = useState<"jpeg" | "png">(() => (localStorage.getItem("editcut.exportFrameFormat") as "jpeg" | "png") ?? "jpeg");
  const [imp, setImp] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      localStorage.setItem("editcut.exportFrameFormat", format);
    } catch {
      /* ignore */
    }
    await exportFrame(props.which ?? "program", name, format, imp);
    setBusy(false);
    props.onClose();
  };
  return (
    <Dialog
      title="Export Frame"
      onClose={props.onClose}
      width={420}
      footer={
        <>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button primary disabled={busy} onClick={() => void go()}>{busy ? "Exporting…" : "OK"}</Button>
        </>
      }
    >
      <div className="form-grid">
        <label>Name</label>
        <TextInput value={name} onChange={setName} autoFocus onEnter={() => void go()} />
        <label>Format</label>
        <Select value={format} options={[{ value: "jpeg", label: "JPEG" }, { value: "png", label: "PNG" }]} onChange={setFormat} />
        <label />
        <Checkbox checked={imp} onChange={setImp} label="Import into project" />
      </div>
    </Dialog>
  );
}

registerDialog("monitor.exportFrame", ExportFrameDialog as never);
