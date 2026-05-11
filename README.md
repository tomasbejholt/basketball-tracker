# Basketball Tracker

Upload a basketball video and get it back with a glowing motion trail drawn on the ball — plus an AI sports commentator that reacts to your clip.

## How it works

A custom YOLOv8 nano model was trained to detect basketballs in video footage. Once a ball is detected, ByteTrack locks onto it across every frame. Short gaps in detection are filled with interpolation so the trail stays smooth even when the ball is briefly occluded. The result is rendered with a neon glow effect and re-encoded to MP4.

On top of that, ElevenLabs generates a live sports commentary audio clip based on the trail color you chose.

**Model stats:** YOLOv8n — 80.3% mAP

## Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** FastAPI, Ultralytics YOLOv8, OpenCV, ByteTrack
- **Commentary:** ElevenLabs text-to-speech

## Features

- Adjustable confidence threshold and trail length
- 4 trail color themes (neon green, hot pink, laser orange, purple lightning)
- Real-time processing progress
- AI commentary unique to each color
