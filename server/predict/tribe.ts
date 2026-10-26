// Client for the EditCut TRIBE v2 worker (tribe-worker/server.py), which runs Meta's
// TRIBE v2 brain encoding model on a GPU machine and returns per-second network signals.
import fs from "node:fs";
import path from "node:path";
import type { NetworkId, TribeResult } from "../../shared/predict";
import { getSettings } from "../config";

export interface TribeHealth {
  configured: boolean;
  url: string;
  reachable: boolean;
  model?: string;
  device?: string;
  mock?: boolean;
  modalities?: string[];
  error?: string;
}

const base = () => (getSettings().tribeUrl ?? process.env.EDITCUT_TRIBE_URL ?? "").replace(/\/+$/, "");
const headers = (): Record<string, string> => {
  const token = getSettings().tribeToken ?? process.env.EDITCUT_TRIBE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function tribeHealth(): Promise<TribeHealth> {
  const url = base();
  if (!url) return { configured: false, url: "", reachable: false };
  try {
    const r = await fetch(`${url}/health`, { headers: headers(), signal: AbortSignal.timeout(8000) });
    const h = (await r.json()) as { ok?: boolean; model?: string; device?: string; mock?: boolean; loading?: boolean; error?: string };
    return {
      configured: true, url, reachable: r.ok && !!h.ok, model: h.model, device: h.device, mock: h.mock,
      error: h.error ?? (h.loading ? "Model is still loading on the worker" : undefined),
    };
  } catch (e) {
    return { configured: true, url, reachable: false, error: `Can't reach the TRIBE worker: ${(e as Error).message}` };
  }
}

export async function runTribe(file: string, opts: { useText: boolean; signal?: AbortSignal }): Promise<TribeResult> {
  const url = base();
  if (!url) throw new Error("No TRIBE v2 worker configured");
  const fd = new FormData();
  fd.append("file", await fs.openAsBlob(file), path.basename(file));
  fd.append("use_text", opts.useText ? "true" : "false");
  // long videos take a while on the GPU; cap at 30 minutes
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(30 * 60_000)]) : AbortSignal.timeout(30 * 60_000);
  const r = await fetch(`${url}/predict`, { method: "POST", body: fd, headers: headers(), signal });
  if (!r.ok) {
    let detail = `${r.status} ${r.statusText}`;
    try {
      const body = (await r.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* not json */
    }
    throw new Error(`TRIBE worker: ${detail}`);
  }
  const body = (await r.json()) as TribeResult & { networks: Record<NetworkId, number[]> };
  return {
    tr: body.tr ?? 1,
    networks: body.networks,
    global: body.global ?? [],
    modalities: body.modalities ?? ["video"],
    model: body.model ?? "facebook/tribev2",
    device: body.device ?? "unknown",
    mock: body.mock || undefined,
    elapsedSec: body.elapsedSec ?? 0,
  };
}
