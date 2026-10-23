# EditCut

An AI-powered, Premiere-Pro-style non-linear video editor with Claude built in. You can edit by hand with the full NLE toolset, or ask Claude to cut, arrange, grade, caption and export for you.

## Run it

Requirements: Node 20+ and `ffmpeg`/`ffprobe` on your PATH. Optional: `whisper-cli` (whisper.cpp) for transcription and captions.

```bash
npm install
npm run dev          # server on :5174 + UI on http://localhost:5173
```

The first time you open the AI Assistant, enter your Anthropic API key (or set `ANTHROPIC_API_KEY` before `npm run dev`). The key is kept in `~/EditCut/settings.json`, which is readable only by your user.

Data lives in `~/EditCut` (imported media, proxies, thumbnails, projects). Exports default to `~/Movies/EditCut`. Override these with `EDITCUT_DATA` and the Export settings.

## Architecture

```
shared/        Data model + pure editing operations, used by the UI, the exporter and the AI agent
  types.ts       Project / Sequence / Track / Clip / Effect / Transition / Marker / ExportSettings
  ops.ts         insert, overwrite, lift, extract, ripple delete, trim (normal/ripple/roll), slip, slide,
                 razor, move, speed, transitions, nesting, describeSequence()
  effects.ts     Effect registry -> renderer-agnostic primitives (preview: WebGL, export: ffmpeg)
src/           React client
  store/         zustand store with undo history (apply/applySeq) + a 60fps playback clock
  commands/      Command registry: menus, keyboard shortcuts and buttons all dispatch commands
  engine/        WebGL compositor + Web Audio playback engine
  panels/        Premiere panels: Project, Source, Program, Timeline, Tools, Effect Controls, Effects,
                 Lumetri Color, Lumetri Scopes, Essential Sound, Audio Mixer, Properties, Text,
                 Markers, History, Info, Media Browser, AI Assistant, Export
server/        Express + ffmpeg
  media.ts       import, probe, thumbnails, waveforms, proxies, frames, scene/silence detection
  projects.ts    project JSON storage
  export/        sequence -> ffmpeg filter graph renderer, job queue
  ai/            Claude agent (tool use over shared/ops) + whisper.cpp transcription
knowledge/     Reference notes on Premiere Pro, Resolve, Final Cut, CapCut, Filmora
```

One effect definition drives both renderers. Each effect in `shared/effects.ts` compiles to a fixed set of primitives (exposure, contrast, blur, chroma key and so on). The browser preview implements those primitives in WebGL, and the exporter implements them as ffmpeg filters.

The AI edits the same document you do. Claude's tools call the same `shared/ops.ts` functions as the timeline UI. Each AI turn arrives as a single undo step.

## Tests

```bash
npm test              # typecheck + all suites below
npm run test:ops      # editing operations (insert/overwrite/ripple/roll/razor/extract…)
npm run test:ai       # every Claude tool against real media (transcription, captions, cuts…)
npm run test:export   # 15 real ffmpeg renders checked with ffprobe
```

The AI and export suites need the sample media in `samples/`. Generate it with `sh scripts/make-samples.sh` (macOS: it uses `say` for the speech sample).

## Known limitations

- **Curves:** the Lumetri RGB curves are approximations. HSL Secondary, the Hue/Sat curves and Remix are not implemented yet.
- **Preview audio:** no pitch shifting, and no audio while scrubbing or playing in reverse.
- **Export:**
  - Keyframed effect parameters are stepped at about 15 updates per second.
  - The Hue, Saturation, Color and Luminosity blend modes export as Normal.
  - Timecode and name overlays need an ffmpeg build that includes `drawtext`.
- **Stubs:** Multi-camera, Synchronize, Merge Clips, voice-over recording and Collect Files show a notice only.
- **Titles in AI-started exports:** text and caption graphics are rendered in the browser. An export Claude starts while no editor window is open leaves them out.
