// Modal dialog registry. Feature modules call registerDialog(id, Component);
// open with useEditor.getState().openDialog(id, props). The component receives
// its props plus onClose.
import type { FunctionComponent } from "react";
import { useEditor } from "../store/store";

export type DialogComponent = FunctionComponent<{ onClose: () => void } & Record<string, unknown>>;

const dialogs = new Map<string, DialogComponent>();

export function registerDialog(id: string, comp: DialogComponent): void {
  dialogs.set(id, comp);
}

export function DialogHost() {
  const dialog = useEditor((s) => s.dialog);
  const close = useEditor((s) => s.closeDialog);
  if (!dialog) return null;
  const Comp = dialogs.get(dialog.id);
  if (!Comp) return null;
  return <Comp {...(dialog.props ?? {})} onClose={close} />;
}
