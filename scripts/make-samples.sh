#!/bin/sh
# Generates the sample media used by the test suites into samples/.
set -e
cd "$(dirname "$0")/.." && mkdir -p samples && cd samples
ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 10 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest clip_testsrc_1080p.mp4
ffmpeg -loglevel error -y -f lavfi -i "smptehdbars=size=1280x720:rate=25" -t 6 -c:v libx264 -pix_fmt yuv420p bars_720p_noaudio.mp4
say -o speech.aiff "Hi everyone, um, welcome back to the channel. Today we are going to, uh, edit a video with artificial intelligence. Let's get started. First, we import our footage. Then, we cut out the boring parts."
ffmpeg -loglevel error -y -f lavfi -i "mandelbrot=size=1280x720:rate=30" -i speech.aiff -t 14 -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 talking_head_speech.mp4
ffmpeg -loglevel error -y -f lavfi -i "color=c=green:size=1920x1080:rate=30" -t 5 -vf "drawbox=x=700:y=300:w=500:h=500:color=red:t=fill" -c:v libx264 -pix_fmt yuv420p greenscreen.mp4
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=220:sample_rate=48000,volume=0.3" -t 20 music.mp3
ffmpeg -loglevel error -y -f lavfi -i "testsrc=size=1600x1200" -frames:v 1 photo.png
echo "samples ready"
