// Content Lab: predicted audience response for a video (start → progress → report).
// Rendered full-screen as the "Content Lab" mode, or standalone at ?app=lab / /lab.
import { useEffect } from "react";
import { startLabSync, useLab } from "./labStore";
import StartScreen from "./StartScreen";
import ProgressScreen from "./ProgressScreen";
import ReportScreen from "./ReportScreen";
import "./lab.css";

export default function ContentLab(props: { standalone?: boolean }) {
  const view = useLab((s) => s.view);
  useEffect(() => {
    startLabSync();
    void useLab.getState().refreshStatus();
    void useLab.getState().refreshHistory();
  }, []);
  // Re-check engines when returning to the start screen (settings may have changed).
  useEffect(() => {
    if (view.kind === "start") void useLab.getState().refreshStatus();
  }, [view.kind]);
  return (
    <div className={"lab-root" + (props.standalone ? " standalone" : "")}>
      {view.kind === "start" ? <StartScreen standalone={props.standalone} /> : null}
      {view.kind === "progress" ? <ProgressScreen /> : null}
      {view.kind === "report" ? <ReportScreen key={view.id} id={view.id} standalone={props.standalone} /> : null}
    </div>
  );
}
