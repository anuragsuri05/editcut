// Connect Claude: sign in with Claude Code (the user's own Claude Code install and
// plan) or use an Anthropic API key. Used by the AI Assistant setup card and AI Settings.
import { useEffect, useState } from "react";
import { KeyRound, LogIn, LogOut, RefreshCw, Terminal } from "lucide-react";
import { api, type AIProvider, type ServerSettings } from "../../api";
import { useEditor } from "../../store/store";
import { useAISession } from "./aiSession";

/** Which backend the server will use, mirroring server/ai/index.ts resolveProvider(). */
export function activeProvider(s: ServerSettings | null): "api" | "claudeCode" | null {
  if (!s) return null;
  const pref = s.aiProvider ?? "auto";
  if (pref === "api") return s.hasApiKey ? "api" : null;
  if (pref === "claudeCode") return s.claudeCode?.loggedIn ? "claudeCode" : null;
  if (s.hasApiKey) return "api";
  return s.claudeCode?.loggedIn ? "claudeCode" : null;
}

const toast = (t: string, k: "info" | "error" | "success" = "info") => useEditor.getState().toast(t, k);

function publish(s: ServerSettings) {
  useAISession.getState().set({ settings: s });
}

export function ConnectClaude(props: { compact?: boolean; onSettings?: (s: ServerSettings) => void }) {
  const settings = useAISession((s) => s.settings);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const cc = settings?.claudeCode;
  const provider = activeProvider(settings);

  const reload = async (refresh = false) => {
    if (refresh) await api.claudeCodeStatus(true).catch(() => undefined);
    const s = await api.getSettings();
    publish(s);
    props.onSettings?.(s);
    return s;
  };

  useEffect(() => {
    if (!settings) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // while the browser sign-in is open, poll until Claude Code reports signed in
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const st = await api.claudeCodeStatus(true).catch(() => null);
      if (st?.loggedIn) {
        setWaiting(false);
        const s = await api.saveSettings({ aiProvider: "claudeCode" });
        publish(s);
        props.onSettings?.(s);
        toast(`Signed in with Claude Code${st.email ? ` as ${st.email}` : ""}`, "success");
      } else if (st && !st.loginInProgress) {
        setWaiting(false);
      }
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const signIn = async () => {
    setBusy("login");
    try {
      await api.claudeCodeLogin("claudeai");
      setWaiting(true);
      toast("Finish signing in in the browser window that opened");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy("logout");
    try {
      await api.claudeCodeLogout();
      await reload(true);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (p: AIProvider) => {
    const s = await api.saveSettings({ aiProvider: p });
    publish(s);
    props.onSettings?.(s);
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy("key");
    try {
      const s = await api.saveSettings({ anthropicApiKey: key.trim(), aiProvider: "api" });
      publish(s);
      props.onSettings?.(s);
      setKey("");
      toast(s.hasApiKey ? "API key saved — Claude is ready" : "Key not saved", s.hasApiKey ? "success" : "error");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    const s = await api.saveSettings({ anthropicApiKey: "" });
    publish(s);
    props.onSettings?.(s);
  };

  return (
    <div className={"ai-connect" + (props.compact ? " compact" : "")}>
      <div className={"ai-connect-option" + (provider === "claudeCode" ? " active" : "")}>
        <div className="ai-connect-head">
          <Terminal size={14} />
          <span className="ai-connect-name">Claude Code</span>
          {provider === "claudeCode" ? <span className="ai-connect-badge">In use</span> : null}
        </div>
        <p className="muted">Use the Claude Code installed on this computer and the Claude account you sign in with. No API key needed.</p>
        {!cc ? (
          <span className="muted">Checking…</span>
        ) : !cc.installed ? (
          <span className="ai-bad">
            Claude Code isn't installed. <a className="ai-link" href="https://claude.com/claude-code" target="_blank" rel="noreferrer">Install it →</a>
          </span>
        ) : cc.loggedIn ? (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="ai-ok">✓ Signed in{cc.email ? ` as ${cc.email}` : ""}{cc.subscriptionType ? ` · ${cc.subscriptionType}` : ""}</span>
            <span className="spacer" />
            {provider !== "claudeCode" ? <button className="btn small primary" onClick={() => choose("claudeCode")}>Use Claude Code</button> : null}
            <button className="btn small" disabled={busy === "logout"} onClick={signOut} title="Sign out of Claude Code on this computer"><LogOut size={12} /> Sign out</button>
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary" disabled={busy === "login" || waiting} onClick={signIn}>
              <LogIn size={13} /> {waiting ? "Waiting for browser sign-in…" : "Sign in with Claude Code"}
            </button>
            <button className="icon-btn" title="Check again" onClick={() => reload(true)}><RefreshCw size={13} /></button>
          </div>
        )}
      </div>

      <div className="ai-connect-or"><span>or</span></div>

      <div className={"ai-connect-option" + (provider === "api" ? " active" : "")}>
        <div className="ai-connect-head">
          <KeyRound size={14} />
          <span className="ai-connect-name">Anthropic API key</span>
          {provider === "api" ? <span className="ai-connect-badge">In use</span> : null}
        </div>
        <p className="muted">Pay-as-you-go API billing. The key is stored only on this machine.</p>
        {settings?.hasApiKey ? (
          <div className="row" style={{ gap: 6 }}>
            <span className="ai-ok">✓ Key saved</span>
            <span className="spacer" />
            {provider !== "api" ? <button className="btn small primary" onClick={() => choose("api")}>Use API key</button> : null}
            <button className="btn small" onClick={removeKey}>Remove</button>
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <input
              className="text-input"
              type="password"
              placeholder="sk-ant-…"
              value={key}
              autoComplete="off"
              style={{ flex: 1 }}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void saveKey();
              }}
            />
            <button className="btn primary" disabled={!key.trim() || busy === "key"} onClick={saveKey}>Save</button>
          </div>
        )}
        {!settings?.hasApiKey ? <a className="ai-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Get an API key →</a> : null}
      </div>
    </div>
  );
}
