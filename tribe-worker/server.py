"""EditCut TRIBE v2 worker.

A small HTTP service that runs Meta's TRIBE v2 brain encoding model
(https://github.com/facebookresearch/tribev2, CC BY-NC 4.0) on a video and
returns per-second cortical-network signals for EditCut's Content Lab.

Run on a machine with a CUDA GPU (the full model needs roughly 24-40 GB VRAM):

    uvicorn server:app --host 0.0.0.0 --port 8765

Environment:
    TRIBE_WORKER_TOKEN   optional bearer token required on /predict
    TRIBE_CACHE          feature/model cache folder (default ./cache)
    TRIBE_DEVICE         "auto" (default), "cuda", "cpu"
    TRIBE_MOCK=1         development only: synthetic activations, no model
    HF_TOKEN             only needed for use_text (gated Llama 3.2 3B)
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from networks import N_VERTICES, NETWORK_IDS, summarize

log = logging.getLogger("tribe-worker")
logging.basicConfig(level=logging.INFO)

MODEL_ID = "facebook/tribev2"
MOCK = os.environ.get("TRIBE_MOCK") == "1"
TOKEN = os.environ.get("TRIBE_WORKER_TOKEN", "")
CACHE = Path(os.environ.get("TRIBE_CACHE", "./cache"))

app = FastAPI(title="EditCut TRIBE v2 worker")
_model = None
_model_error: str | None = None
_lock = threading.Lock()  # one GPU job at a time


def _load_model():
    global _model, _model_error
    if MOCK or _model is not None:
        return _model
    try:
        from tribev2.demo_utils import TribeModel

        CACHE.mkdir(parents=True, exist_ok=True)
        _model = TribeModel.from_pretrained(MODEL_ID, cache_folder=CACHE, device=os.environ.get("TRIBE_DEVICE", "auto"))
        _model_error = None
    except Exception as e:  # surfaced through /health
        _model_error = f"{type(e).__name__}: {e}"
        log.exception("failed to load TRIBE v2")
    return _model


def _device() -> str:
    if MOCK:
        return "mock"
    try:
        import torch

        return "cuda:" + torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    except Exception:
        return "unknown"


def _auth(authorization: str | None = Header(default=None)) -> None:
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid worker token")


@app.on_event("startup")
def _warm() -> None:
    # load in the background so /health answers immediately
    threading.Thread(target=_load_model, daemon=True).start()


@app.get("/health")
def health() -> dict:
    return {
        "ok": MOCK or _model is not None,
        "model": MODEL_ID,
        "mock": MOCK,
        "loading": not MOCK and _model is None and _model_error is None,
        "error": _model_error,
        "device": _device(),
        "networks": NETWORK_IDS,
    }


def _events(model, video_path: str, use_text: bool):
    """Events dataframe for one video. Without text we skip transcription and the gated Llama extractor."""
    if use_text:
        return model.get_events_dataframe(video_path=video_path)
    import pandas as pd
    from tribev2.demo_utils import get_audio_and_text_events

    event = {"type": "Video", "filepath": video_path, "start": 0, "timeline": "default", "subject": "default"}
    return get_audio_and_text_events(pd.DataFrame([event]), audio_only=True)


def _per_second(preds: np.ndarray, segments: list, duration: float) -> np.ndarray:
    """Place prediction rows on a 1-second grid (rows can be dropped for empty segments)."""
    n = max(1, int(np.ceil(duration)))
    out = np.full((n, preds.shape[1]), np.nan, dtype=np.float32)
    starts = [getattr(s, "start", None) for s in segments]
    if all(isinstance(x, (int, float)) for x in starts) and starts:
        t0 = min(starts)
        for row, st in zip(preds, starts):
            i = int(round(st - t0))
            if 0 <= i < n:
                out[i] = row
    else:
        out[: min(n, len(preds))] = preds[:n]
    # fill gaps (silent/empty seconds) from neighbours
    for i in range(n):
        if np.isnan(out[i, 0]):
            prev = next((out[j] for j in range(i - 1, -1, -1) if not np.isnan(out[j, 0])), None)
            out[i] = prev if prev is not None else np.nanmean(out, axis=0)
    return np.nan_to_num(out)


def _duration(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def _mock_predictions(path: str, duration: float) -> np.ndarray:
    """Deterministic synthetic activations (noise + slow drift). Development only, flagged mock=True."""
    n = max(1, int(np.ceil(duration)))
    rng = np.random.default_rng(abs(hash(os.path.basename(path))) % (2**32))
    base = rng.normal(0, 0.3, size=(n, N_VERTICES)).astype(np.float32)
    drift = np.sin(np.linspace(0, 3 * np.pi, n))[:, None]
    return base + drift.astype(np.float32)


@app.post("/predict", dependencies=[Depends(_auth)])
def predict(file: UploadFile = File(...), use_text: bool = Form(False)) -> dict:
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "input" + suffix)
        with open(path, "wb") as f:
            while chunk := file.file.read(1 << 20):
                f.write(chunk)
        duration = _duration(path)
        t0 = time.time()
        with _lock:
            if MOCK:
                preds = _mock_predictions(path, duration)
                modalities = ["video", "audio"]
            else:
                model = _load_model()
                if model is None:
                    raise HTTPException(status_code=503, detail=_model_error or "TRIBE v2 is still loading")
                events = _events(model, path, use_text)
                raw, segments = model.predict(events=events, verbose=False)
                preds = _per_second(np.asarray(raw, dtype=np.float32), segments, duration)
                types = set(str(t) for t in events["type"].unique()) if "type" in events else set()
                modalities = [m for m, key in (("video", "Video"), ("audio", "Audio"), ("text", "Word")) if key in types] or ["video"]
        summary = summarize(preds)
        return {
            "tr": 1.0,
            "networks": summary["networks"],
            "global": summary["global"],
            "modalities": modalities,
            "model": MODEL_ID,
            "device": _device(),
            "mock": MOCK,
            "elapsedSec": round(time.time() - t0, 2),
            "nSeconds": int(preds.shape[0]),
            "vertexCounts": summary["vertexCounts"],
        }
