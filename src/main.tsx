import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "dockview-react/dist/styles/dockview.css";
import "./styles/theme.css";
import "./commands/index";
import { loadUserKeys } from "./commands/registry";
import { installKeyboard } from "./keyboard";
import { initProjectIO } from "./projectIO";
import App from "./App";

loadUserKeys();
installKeyboard();
initProjectIO();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
