# EditCut TRIBE v2 worker

This worker is the brain-model backend for EditCut's **Content Lab**. It runs Meta's open-source [TRIBE v2](https://github.com/facebookresearch/tribev2) on a video and sends back per-second signals for eight cortical networks: visual, motion, faces, auditory, language, attention, salience and social.

## What TRIBE v2 is (and isn't)

TRIBE v2 is a brain encoding model. It predicts the fMRI response of an average person's cortex while they watch your video: one prediction per second for about 20,000 points on the cortical surface (fsaverage5). It combines V-JEPA2 (video), Wav2Vec-BERT (audio) and optionally Llama 3.2 3B (text). Meta trained it on more than 1,000 hours of fMRI from 720 people.

It does not predict views, watch time or retention on any platform. EditCut uses the network signals as one input to its own transparent attention model (`server/predict/score.ts`), next to measurable features: cuts, motion, loudness and speech. The retention curves and scores are estimates. Use them to compare cuts of the same video and to find weak moments, not as a promise of performance.

## Requirements

- **GPU:** a CUDA GPU with enough memory. Meta doesn't publish a figure; a third-party tutorial measured roughly 28–32 GB of VRAM for all three modalities, and says a 16 GB T4 runs out of memory. This worker runs video and audio only by default (no Llama), which needs less.
- **Software:** Python 3.11+, `ffmpeg`, and PyTorch 2.5–2.6, which TRIBE v2 pins. PyTorch 2.5+ has no builds for Intel Macs, so it can't run on an Intel Mac at all.
- **License:** TRIBE v2 is released under **CC BY-NC 4.0**, which covers non-commercial use only. Check the license before using Content Lab commercially.

## Run it

**On a Linux GPU machine:**

```bash
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
TRIBE_WORKER_TOKEN=change-me uvicorn server:app --host 0.0.0.0 --port 8765
```

**With Docker:**

```bash
docker build -t editcut-tribe .
docker run --gpus all -p 8765:8765 -e TRIBE_WORKER_TOKEN=change-me -v tribe-cache:/cache editcut-tribe
```

**On Modal (serverless GPU, billed per second, scales to zero):**

```bash
pip install modal && modal setup
modal secret create editcut-tribe TRIBE_WORKER_TOKEN=change-me
modal deploy modal_app.py
```

The first request downloads the weights (several GB) and is slow. Later requests reuse the cache.

## Connect EditCut

Open **Content Lab → Connect TRIBE v2**, then paste the worker URL (for example `http://gpu-box:8765` or the Modal URL) and the token. `GET /health` reports whether the model has loaded and which device it is on.

## Transcript input (optional)

To include the text modality, accept the license for [meta-llama/Llama-3.2-3B](https://huggingface.co/meta-llama/Llama-3.2-3B) on Hugging Face, set `HF_TOKEN` on the worker, and turn on "Include transcript in TRIBE" in Content Lab.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ok, model, device, loading, error, mock}` |
| POST | `/predict` | multipart `file` (video), `use_text` (bool); header `Authorization: Bearer <token>` | `{tr, networks: {id: number[]}, global, modalities, model, device, elapsedSec}` |

Network values are z-scored within the video: 0 means this video's average response. `networks.py` documents how the Destrieux atlas parcels are grouped into networks; this anatomical grouping is an approximation.

## Development without a GPU

`TRIBE_MOCK=1 uvicorn server:app --port 8765`, after `pip install -r requirements-mock.txt`, serves synthetic activations so the rest of the pipeline can be tested. Every result it returns is flagged `mock: true`, and Content Lab shows a warning banner on those reports.
