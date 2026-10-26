# GPU image for the EditCut TRIBE v2 worker.
#   docker build -t editcut-tribe .
#   docker run --gpus all -p 8765:8765 -e TRIBE_WORKER_TOKEN=change-me -v tribe-cache:/cache editcut-tribe
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY networks.py server.py ./
# fetch the atlas at build time so the first request doesn't
RUN python -c "from networks import network_masks; network_masks()"
ENV TRIBE_CACHE=/cache HF_HOME=/cache/hf
EXPOSE 8765
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8765"]
