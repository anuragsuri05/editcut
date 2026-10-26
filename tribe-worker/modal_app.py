"""Deploy the EditCut TRIBE v2 worker on Modal (serverless GPU, billed per second).

    pip install modal && modal setup
    modal secret create editcut-tribe TRIBE_WORKER_TOKEN=change-me   # add HF_TOKEN=... to enable transcript input
    modal deploy modal_app.py

Modal prints the web URL; paste it and the token into EditCut > Content Lab > Connect TRIBE v2.
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git")
    .pip_install_from_requirements("requirements.txt")
    .env({"TRIBE_CACHE": "/cache", "HF_HOME": "/cache/hf"})
    .add_local_python_source("networks", "server")
)
cache = modal.Volume.from_name("editcut-tribe-cache", create_if_missing=True)
app = modal.App("editcut-tribe", image=image)


@app.function(
    gpu="A100-40GB",
    volumes={"/cache": cache},
    secrets=[modal.Secret.from_name("editcut-tribe")],
    timeout=1800,
    scaledown_window=300,
)
@modal.concurrent(max_inputs=1)
@modal.asgi_app()
def web():
    from server import app as fastapi_app

    return fastapi_app
