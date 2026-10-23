# DaVinci Resolve — Exhaustive Reference (Resolve 20 → 21.1, as of late 2026)

> Knowledge base for **editcut** (building our own NLE). Focus: what every page, panel, button and mode actually *does*, how features interact, and which design decisions Blackmagic made. Written from the Blackmagic manual/new-features guides, release notes and trade coverage, plus hands-on knowledge. Items marked **(S)** are Studio-only (paid). Items marked **(v20)** / **(v21)** / **(v21.1)** indicate the version that introduced them. Shortcuts are given as **Mac / Windows** (Cmd↔Ctrl, Opt↔Alt); where only one is listed, substitute Cmd/Ctrl and Opt/Alt.

---

## 0. Table of Contents

1. Version history & timeline (17 → 21.1)
2. Free vs Studio
3. Architecture & core concepts (databases, projects, timelines, the node pipeline, image processing order)
4. Project Manager
5. Project Settings (Master Settings, Image Scaling, Color Management, etc.)
6. Preferences (System & User)
7. Global UI conventions (page bar, interface toolbar, viewers, Media Pool, Inspector)
8. Media page
9. Cut page
10. Edit page (toolbar, timeline, track headers, inspector, Effects library, Edit index, Sound library, Mixer, Metadata, keyframes, multicam, compound clips)
11. Fusion page
12. Color page
13. Fairlight page
14. Deliver page
15. Photo page (v21)
16. Neural Engine / DaVinci AI feature catalogue
17. Multicam, proxies/optimized media, render cache, compound clips, timelines, collaboration, keyframing, subtitles/captions
18. Keyboard shortcuts (essential, Mac/Windows)
19. Design takeaways for editcut

---

## 1. Version History (relevant context)

| Version | Year | Headline additions |
|---|---|---|
| 16 | 2019 | **Cut page** introduced (source tape, dual timeline, boring detector, smart editing tools), Neural Engine debut (facial recognition, Speed Warp), DaVinci Resolve Studio adaptive Neural Engine. |
| 17 | 2020 | HDR palette, Color Warper, Magic Mask, new DaVinci Wide Gamut/Intermediate color space, Fairlight FlexBus, proxy workflow overhaul, Fusion on Cut/Edit (Fusion effects in inspector), Fairlight Audio Core. |
| 18 | 2022 | **Blackmagic Cloud** (cloud project libraries, multi-user collaboration), Proxy generator app, Object Removal, Depth Map, Surface Tracker, Fairlight Dolby Atmos, Fusion GPU, subtitles improvements. |
| 18.5 | 2023 | Text-based editing via AI transcription (Studio), Auto subtitles (speech to text), Relight, Fusion USD tools, AI Audio classification, Cut page Quick Export improvements. |
| 18.6 | 2023 | Fairlight Dialogue Separator FX, Music Remixer FX (Studio), AI audio classification improvements. |
| 19 | 2024 | DaVinci Neural Engine: **IntelliTrack** (AI point tracker; also audio panning to video), **UltraNR** (AI spatial noise reduction), **Color Slice** palette, **Film Look Creator** FX, Dialogue Leveler, Fairlight **ducker track FX**, Cut page **Multi-source** viewer, live overwrite, text-based editing on Edit page, Motion Effects improvements, Fusion multipoly/MultiText precursors. |
| **20** | Apr 2025 beta / mid-2025 final | ~100+ features. **AI IntelliScript**, **AI Animated Subtitles**, **AI Multicam SmartSwitch**, **AI Audio Assistant**, **AI IntelliCut**, **AI Dialogue Matcher**, **AI Music Editor/Extender**, **AI Detect Music Beats**, **AI Voice Convert**, **AI SuperScale 3x/4x**, **Magic Mask v2**, **Depth Map v2**, **AI Set Extender**, **Keyframe editor/tray**, **Voiceover palette/tool**, **Chroma Warp** (Color Warper), **Fusion Deep Image compositing**, **multi-layer EXR/PSD**, **Vector Warp/Transform/Denoise**, **VR180**, **MultiText**, **6-band Clip EQ**, **EQ Match**, **Level Matcher**, **Chain FX**, per-channel automation modes, cloud folders, vertical layouts, Apple Immersive Video (S). |
| 20.1 | Aug 2025 | Apple Immersive/Vision Pro monitoring, Apple Spatial Audio Format (macOS), Magic Mask 2 in Fusion, 32-bit float recording on Cut/Edit/Fairlight, custom viewer guides & rulers, **Shift+Space effects search**, MultiText char/paragraph styling. |
| 20.2 | late 2025 | **Sync locks**, **auto select**, source patch selector, **auto blade** for ripple trimming; 20.2.3: faster AI on Intel GPUs, keyframe/curves tray hotkey, BRAW 5.1. |
| 20.3 | early 2026 | Insert Gap and refinements; last 20.x (20.3.2 library compatible with 21). |
| **21** | Apr 2026 beta (NAB) → 3 Jun 2026 final | **Photo page** (stills editing/grading, Lightroom catalog import, LightBox, albums, tethered Sony/Canon capture), **AI IntelliSearch** (search media by people/faces/objects/dialogue keywords), **AI CineFocus** (refocus/depth-of-field, rack focus), **AI Speech Generator** (text-to-speech/voice cloning from ~10 s sample), **AI Face Age Transformer**, **AI Face Reshaper**, **AI Blemish Removal**, **AI UltraSharpen**, **AI Motion Deblur**, **AI SlateID**, IntelliScript for Final Draft/plain-text screenplays, **Krokodove** toolset in Fusion (70+ tools), **Fairlight Animator** modifier (audio-driven animation), **Macro Editor**, native **OGraf** (HTML graphics) and **Lottie**, Text+ spell check/color fonts/emoji, **layer-list node graph view**, **grade versions for group grading**, **MultiMaster trim pass** (S), **Fairlight folder tracks**, Cut page smart bin views, **4-point Bézier retime controls**, metadata star ratings, render Magic Mask as external matte, **Picture in Picture** Resolve FX, VR180/VR360 presets, immersive master settings, USD 25.11 / Hydra 2.0. Projects opened in 21 can't be opened in 20.3.2 (library is compatible). |
| 21.1 | Sep 2026 (pre-IBC) | AI assistant integration (**native MCP server (S)**; works with Claude/Claude Code/ChatGPT Codex to analyze projects, organize media, batch render, make highlight edits), built-in **Python console** (S), 20 new scripting APIs (S) — **advanced scripting now requires Studio**, Python 2 dropped, individual MultiMaster trims for Dolby Vision/HDR10+/HDR Vivid (S), inspector presets, multi-clip Fusion property editing, compare-timeline workflow, presentation-marker annotations/replies/status, cut/copy/paste gaps, transitions on adjustment clips, Edit Index export to PDF, multicam mode as timeline-viewer property, switching up to 25 angles via shortcuts, new camera log support (DJI D-Log2, GoPro Log, Leica L-Log, Vivo Log), OCIO 2.5/ACES 2.0 in Fusion Studio, EXR HTJ2K. |

---

## 2. Free vs Studio

**Pricing**: DaVinci Resolve = free. **DaVinci Resolve Studio = US$295 one-time** perpetual license (activation key or USB dongle; key allows 2 activations), free upgrades for life (17→21 all free). Bundled free with many Blackmagic cameras (Pocket 6K, URSA, PYXIS) and the Speed Editor keyboard. Free is **not a trial** and has **no watermark** on renders unless you use a Studio-only tool (Studio-only Resolve FX can be previewed in Free but render with a "DaVinci Resolve Studio" watermark).

| Area | Free | Studio |
|---|---|---|
| Max timeline/delivery resolution | UHD 3840×2160 (source media of any res can be used; output capped at UHD) | Up to 32K |
| Max frame rate | 60 fps | 120 fps |
| GPU | Single GPU (macOS: Apple Silicon/Metal fully used) | Multiple GPUs; better GPU decode/encode |
| H.264/H.265 hardware decode/encode | Limited (Mac: hardware H.264/HEVC available; Windows/Linux: mostly software) | Full hardware decode/encode (NVIDIA NVENC/NVDEC, Intel QSV, AMD, Apple), 10-bit 4:2:2 H.264/HEVC decode, AV1 encode |
| Neural Engine AI tools | Virtually all DaVinci Neural Engine tools are Studio-only; Free shows them in the UI and Resolve FX versions preview with a watermark | All: Magic Mask, Speed Warp, Super Scale, Smart Reframe, Voice Isolation, Text-based editing/transcription, IntelliScript, IntelliCut, IntelliSearch, CineFocus, UltraNR, Relight, Depth Map, Face Refinement, Object Removal, Set Extender, etc. |
| Temporal & spatial noise reduction (Motion Effects) | No (Studio watermark) | Yes, incl. UltraNR |
| Motion blur (Motion Effects) | No | Yes |
| Resolve FX | ~most basic FX; many premium FX Studio-only (Film Grain partly, Lens Flare, Lens Blur, Glow advanced, Face Refinement, Patch Replacer, Dead Pixel Fixer, Deband, Beauty, etc.) | All 100+ Resolve FX |
| Fairlight FX | Most core FX; some Studio-only (e.g., Music Remixer, Dialogue Separator, Voice Isolation, Voice Convert) | All |
| HDR grading | HDR palette available; HDR10+/Dolby Vision analysis/metadata & MultiMaster trims are Studio | Dolby Vision (license), HDR10+, HDR Vivid, MultiMaster trims |
| Stereoscopic 3D, Immersive (Apple Immersive, VR) | No | Yes |
| Collaboration | Can open/host Blackmagic Cloud & network libraries; multi-user simultaneous collaboration (bin locking, timeline compare/merge, chat) is a Studio feature | Full multi-user collaboration |
| 10-bit+ H.264/HEVC, AV1, some DCP (Kakadu JPEG2000 DCP/IMF encoding), IMF | No | Yes |
| Remote grading, remote rendering, Render queue to other systems | No | Yes |
| Scripting | v21.1: advanced scripting requires Studio (free had scripting from internal console previously) | Full Python/Lua API, MCP server (21.1) |
| Frame-rate conversion with optical flow at render, film grain, Lens distortion calibration, etc. | Partial | Full |
| External scopes, 12G-SDI video output | Output via Blackmagic DeckLink/UltraStudio supported in Free too | Yes |
| Resolve Speed Editor / panels | Supported | Supported |

> **Design note for editcut**: Blackmagic's model is "full professional NLE free, paywall the GPU-heavy AI, high-res/high-fps, HDR metadata, collaboration scale, and pro delivery". The free tier deliberately has no watermark and no time limit — that's a huge part of Resolve's adoption.

---

## 3. Architecture & Core Concepts

### 3.1 Data model
| Concept | Description |
|---|---|
| **Project Library** (formerly "database") | Container of projects. Types: **Local** (on disk, a folder of `.drp`-like data, previously "Disk database"), **Network** (PostgreSQL via **DaVinci Project Server**, multi-user), **Cloud** (Blackmagic Cloud-hosted, multi-user). |
| **Project** | Everything for a production: Media Pool (bins, clips, timelines), project settings, grades, Fusion comps, Fairlight state, render jobs, Gallery stills. Export/import as `.drp` (project) or `.dra` (archive with media). |
| **Media Pool** | Bins → clips (master clips referencing files), timelines, compound clips, Fusion compositions, multicam clips, subtitles, generators. Shared across all pages. **Smart Bins** = saved metadata queries. **Power Bins** = bins shared across all projects in a library. |
| **Clip** | Reference to source media + clip attributes (pixel aspect, data levels, audio channel mapping, timecode), metadata, in/out, markers, keywords, proxy/optimized links. |
| **Timeline** | A sequence. Has its own settings (can override project res/fps per timeline). Tracks: Video (V1..n, higher covers lower), Audio (A1..n with format mono/stereo/5.1/7.1/adaptive/Atmos-like), Subtitle (ST1..n). |
| **Timeline clip** | Instance of a source clip with in/out, transform/composite/speed/keyframes (Inspector), Fusion comp, Color grade (per-clip node tree), audio levels/EQ. |
| **Grade** | A node tree attached to a timeline clip (or shared via group/shared node, timeline-level, or remote/local version). |

### 3.2 Image processing pipeline (order matters)
Resolve's documented page-level order is **Media Pool → Edit (retime/speed, source-level ops) → Fusion → Color → Edit (transform/composite/transitions) → Timeline output → Deliver**. Per clip:
1. **Decode** source (Camera RAW settings, Clip Attributes: data levels, PAR, field order; input color space/IDT).
2. **Retime** (speed change / retime curve; frame interpolation: nearest, frame blend, optical flow, Speed Warp).
3. **Fusion** composition (if the clip has one) — receives the retimed source frames conformed to timeline resolution (with input scaling); Fusion has its own MediaIn/MediaOut.
4. **Color** node tree: Input Sizing → nodes (with per-node color space/gamma, node sizing) → Output Sizing; timeline-level grade (Timeline node graph) after clip grades.
5. **Edit-page Inspector**: Transform (zoom/position/rotation/anchor/pitch/yaw/flip), Cropping, Dynamic Zoom, Lens Correction, Stabilization, Composite mode/opacity — applied **after** the grade, so Color page windows/trackers see the un-transformed image. (Edit sizing and Color's Input Sizing are actually the same underlying sizing stage: changes in Edit's Transform appear as "Edit sizing" on the Color page Sizing palette.)
6. **Transitions, titles, generators, adjustment clips, track compositing** (top track wins, composite modes stack down).
7. **Output color transform** (RCM/ACES ODT), output sizing/blanking, data burn-in, broadcast-safe.
8. **Encode** (Deliver).

### 3.3 Image precision
- 32-bit floating-point YRGB processing internally, GPU-accelerated (Metal on Mac, CUDA/OpenCL on Win/Linux).
- **Render cache** & **optimized/proxy media** for performance (see §17).

---

## 4. Project Manager

Opened via the **house icon** (bottom-right) or **Shift+1** / File > Project Manager. Shown on launch.

| Element | Function |
|---|---|
| **Project Libraries sidebar** (toggle "Project Libraries") | Lists Local, Network, Cloud libraries. Add / Connect / Disconnect / Backup / Restore / Upgrade / Create Folder. Cloud libraries require Blackmagic Cloud sign-in. |
| **Project tiles/list** | Thumbnail (hover-scrub shows timeline frames), name, date modified, resolution/fps. List view shows columns. |
| **Folders** | Organize projects; double-click to enter. |
| **New Project** | Creates "Untitled Project N", opens Media/Cut page. |
| **New Folder** | Folder inside current library. |
| **Open / Open in Read-only** | |
| **Import (.drp) / Export (.drp)** | Project file without media. **Export Project Archive (.dra)**: copies media, render cache, proxies, LUTs, stills (options in 21.1). **Restore Project Archive**. |
| **Dynamic project switching** | Right-click → Dynamic Project Switching: keep multiple projects open in RAM, switch instantly; copy/paste between. |
| **Project backups** | Live save & project backups (set in Preferences > User > Project Save and Load). Right-click → Project Backups to restore. |
| **Collaboration (cloud/network)** | Right-click → Enable Collaboration / Users. Shows who is in the project. |
| **Settings in PM** | Search, sort (name, date), Show Info, project notes. |
| **Upgrade** | Older libraries must be upgraded when opening with new major version (21 projects not readable by 20.3.2; library format compatible). |

**Blackmagic Cloud**: create a cloud project library (hosting is a small monthly per-library fee); projects sync over internet, media synced via Blackmagic Cloud Store / Dropbox / Google Drive / cloud folders (v20). **Presentations**: share timeline for review with timecoded comments; guest access (v20), annotations/replies/status (v21.1).

---

## 5. Project Settings (gear icon bottom-right, Shift+9)

Left sidebar categories. Settings can be saved as **Presets** (Save As Preset; create/update/import/export presets — scriptable in 21.1). "Save" applies; changes to resolution are allowed any time, **frame rate is locked** once media is in a timeline (per-timeline fps can be set at timeline creation).

### 5.1 Presets
Save/Load/Save As user presets for all project settings, set "Current" as default for new projects.

### 5.2 Master Settings
| Group | Setting | Meaning |
|---|---|---|
| **Timeline Format** | Timeline resolution | Presets (720p, 1080 HD, UHD, DCI 2K/4K, vertical 1080×1920, square, Custom). Also "For 1920x1080 processing" options. |
| | Pixel aspect ratio | Square, 16:9 anamorphic, 4:3 standard definition, Cinemascope (2x). |
| | Timeline frame rate | 23.976, 24, 25, 29.97 (DF/NDF), 30, 47.952, 48, 50, 59.94, 60, 95.904, 96, 100, 119.88, 120. Locked after first clip edited into a timeline (per project); per-timeline override possible in New Timeline > Use Project Settings off. |
| | Use drop frame timecode | For 29.97/59.94. |
| | Enable interlace processing | Field-aware processing. |
| | Standard immersive option (v21) | Immersive master settings for VR180/VR360/Meta Quest/YouTube VR delivery. |
| **Video Monitoring** | Use separate video monitoring format / Video format, SDI configuration (Single/Dual/Quad link), Data levels (Video/Full), Video bit depth (8/10/12), Monitor scaling (Basic/Bilinear), Use 4:4:4 SDI, Use Level A for 3G-SDI, Enable HDR metadata over HDMI, Retain sub-black and super-white data | For external monitoring via DeckLink/UltraStudio. |
| **Optimized Media and Render Cache** | Proxy media resolution (Choose automatically / Original / Half / Quarter / One-eighth / One-sixteenth) & Proxy media format (ProRes/DNxHR/H.264/H.265) | Proxy generation from Resolve. |
| | Optimized media resolution & format | Same idea, optimized media (DNxHR/ProRes/Uncompressed). |
| | Render cache format | ProRes 422/HQ/4444, DNxHR, Uncompressed 10-bit/16-bit float. |
| | Enable background caching after N seconds | Smart cache starts when idle. |
| | Automatically cache transitions / composites / Fusion effects in user mode | |
| **Working Folders** | Project media location (proxies, generated media), Cache files location, Gallery stills location | |
| **Frame Interpolation** | Retime process: Nearest / Frame Blend / Optical Flow. Motion estimation mode: Standard/Enhanced Faster/Better, **Speed Warp Faster/Better (S)**. Motion range: Small/Medium/Large. | Project default for speed changes; overridable per clip. |

### 5.3 Image Scaling
| Setting | Options | Meaning |
|---|---|---|
| Image scaling quality / **Resize filter** | Sharper, Smoother, Bicubic, Bilinear, **Custom** (Lanczos, Mitchell, etc. in newer), Super Scale is per-clip. | Interpolation kernel for resizing. |
| Override input scaling | | |
| **Input Scaling — Mismatched resolution files** | **Center crop with no resizing**; **Scale full frame with crop** (fill); **Scale entire image to fit** (letterbox/pillarbox, default); **Stretch frame to all corners** (distort). | How clips that don't match timeline res are fit. Per clip override in Clip Attributes/Inspector (Retime and Scaling > Scaling). |
| Output Scaling — Match timeline settings / custom output res | | Render/monitor at a different res than timeline; e.g., edit 1080, deliver 4K. Mismatched output uses same 4 modes. |
| Deinterlace quality | Normal / High (S) | |
| Anti-alias edges | Auto / On / Off | For sizing. |

### 5.4 Color Management
| Setting | Options | Details |
|---|---|---|
| **Color science** | **DaVinci YRGB** (manual; you choose timeline space, LUT/CST nodes do conversions), **DaVinci YRGB Color Managed** (RCM — Resolve Color Management), **ACEScct**, **ACEScc** (ACES pipeline) | |
| **DaVinci YRGB** | Timeline color space (e.g., Rec.709 Gamma 2.4), Output color space. No automatic transforms; clips decoded in their native encoding (log stays log). Classic manual workflow: use CST/LUT nodes. | |
| **DaVinci YRGB Color Managed (RCM)** | **Color processing mode**: **SDR**, **HDR** (preset groups), or **Custom**. Presets: *SDR Rec.709*, *HDR DaVinci Wide Gamut*, *HDR Rec.2100 HLG/ST2084* etc. **Output color space** (Rec.709 Gamma 2.4, Rec.709-A for Mac viewing, sRGB, P3-D65, Rec.2100 ST2084 1000 nits…). In *Custom*: **Input color space** (default for clips; or "Rec.709 Gamma 2.4"), **Timeline color space** (e.g., **DaVinci Wide Gamut / DaVinci Intermediate** — the recommended scene-referred working space), **Timeline working luminance** (SDR 100, HDR 1000/2000/4000…/Custom), **Output color space**, **Limit output gamut to** (Rec.709/P3), **Input DRT** & **Output DRT** tone mapping (None / Simple / Luminance Mapping / **DaVinci** / RED IPP2 / ACES), **Use inverse DRT for SDR to HDR conversion**, **Apply resize transformations in** (Linear/Log/Timeline), **Use white point adaptation**, **Color space aware grading tools** (makes Primaries/HDR palette respond consistently regardless of input), **Graphics white level** (for titles/generators, e.g., 100/203 nits), **Automatically tag Rec.709 Scene clips as Rec.709-A** (Mac QuickTime gamma). Per-clip **Input Color Space** set via Media Pool right-click; camera metadata auto-detects many log formats. | RCM is scene-referred; grading tools operate in the timeline space. |
| **ACES** | **ACES version** (1.0/1.1/1.3; ACES 2.0 support via OCIO 2.5 in Fusion Studio 21.1 and newer Resolve), **ACES Input Device Transform** (IDT; per-clip override), **ACES Output Device Transform** (ODT, e.g., Rec.709, P3-D65, Rec.2020 ST2084 1000 nits), **Process node LUTs in** (AP1 timeline space / ACEScc AP1), **Enable reference gamut compression** (RGC), **ACES Gamut Mapping** | ACEScct preferred over ACEScc (toe for log-style grading). |
| **Dolby Vision (S)** | Enable Dolby Vision, version (2.9 / 4.0), Mastering display, analysis tuning, external CMU | |
| **HDR10+ (S)** | Enable HDR10+ | |
| **HDR Vivid (S)** | China UHD HDR standard (v20/21) | |
| **Lookup Tables** | 3D input LUT, 3D output LUT, 3D video monitor LUT, 3D color viewer LUT, 3D scopes LUT, 1D variants, 3D LUT interpolation (Trilinear/Tetrahedral) | "Update Lists", "Open LUT Folder". |
| Broadcast safe | Broadcast safe IRE levels (-20–120, 0–100, -10–110), Make broadcast safe | |
| Use Mac display color profiles for viewers | macOS ColorSync for GUI viewer | |
| Use 10-bit precision in viewers if available | | |
| Gallery color space / stills | | |
| **Generate Color Space Transforms…** etc. | | |

### 5.5 Other settings categories
| Category | Key options |
|---|---|
| **General Options** | Conform options (assist using reel names from: source clip pathname/file name/embedded/metadata), Timecode source (Embedded / file-derived), Mixed frame rate format (Resolve / Final Cut Pro 7 / FCP X / Avid / Premiere), Use timecode/match by file name, Assist using … , **Use local grades/remote grades default**, **Color: version naming**, Grade/node behavior: Use S-curve for contrast, Apply pre-grades, Use DaVinci "Keep all" etc., Use legacy … , **Timeline node graph** etc. Also "Automatically match Edit timeline to Color timeline thumbnails", Cache options, "Use Edit Sizing"… |
| **Camera RAW** | Per-format project defaults: ARRI, BRAW, Canon RAW, CinemaDNG, Nikon N-RAW, Panasonic, RED R3D, Sony RAW, ProRes RAW, DJI, Fujifilm (v21 photo RAW). Decode quality (Full/Half/Quarter/Eighth res), decode using (Camera metadata / Project / Clip), color science, gamma, white balance, ISO, exposure, etc. |
| **Capture and Playback** | Video format for tape capture, Capture save path, Output to tape options. |
| **Subtitles** | Subtitle presets/defaults; caption formats (608/708, TTML, WebVTT, SRT). |
| **Fairlight** | **Timeline sample rate** (48 kHz default; 44.1/96/192), **Audio bit depth**, **Target loudness level** (e.g., -23 LUFS EBU R128, -24 LKFS ATSC A/85, -14/-16 for streaming), **Loudness standard** (EBU R128, ATSC, ITU-R BS.1770-4, Netflix/Prime Video etc.), True peak limit, Video/Audio sync offset, Immersive audio (Dolby Atmos/Spatial Audio/Auro-3D/MPEG-H), **Fairlight audio busing presets**. |
| **Color** (part of General) | Ganged grading behaviors. |

---

## 6. Preferences (DaVinci Resolve menu > Preferences, Cmd/Ctrl+,)

Two tabs: **System** (machine-wide) and **User** (per user, sync-able). Many require restart.

### 6.1 System
| Panel | Contents |
|---|---|
| **Memory and GPU** | Limit Resolve memory usage to X GB, Limit Fusion memory cache to X GB, GPU processing mode (Auto/Metal/CUDA/OpenCL), GPU selection (manual/auto; multi-GPU Studio), Use display GPU for compute, **Neural Engine** settings, Optimize GPU memory. |
| **Media Storage** | Media storage locations (first = cache/gallery default), mounted volumes, network paths. **Cache files location**. Show only volumes in Media Storage. |
| **Decode Options** | Use GPU for Blackmagic RAW decode, Use hardware acceleration for H.264/H.265 decode (vendor: NVIDIA/Intel/AMD/Apple), Decode H.264/HEVC using hardware, Use GPU for R3D (debayer), Use AMD/Intel Quick Sync… |
| **Video and Audio I/O** | Capture/playback device (DeckLink, UltraStudio), Use 3G SDI level, Output 10-bit, Release video device when not in focus; Audio I/O (Blackmagic Fairlight Audio Accelerator, system audio device, speaker setup: Use system settings / Manual: monitor set (2.0/5.1/7.1/7.1.4/etc.)), Use Fairlight audio interface. |
| **Video Plugins** | Enable/disable OpenFX plugins, rescan. |
| **Audio Plugins** | VST/VST3/AU plugin enable, scan, custom VST path. |
| **Control Panels** | DaVinci Resolve Mini/Micro/Advanced panels, Speed Editor, Editor Keyboard, Fairlight consoles, Tangent, Avid Artist. |
| **General** | Auto-check for updates, Use gestures, Use 10-bit precision in viewers, External scopes, Enable remote rendering, Automatically display log, Project Server, Language, UI scaling (Windows/Linux), Haptic feedback (21.1 Windows). |
| **Internet Accounts** | Blackmagic Cloud, Dropbox, Google Drive (for cloud-synced media), Frame.io, YouTube, Vimeo, Twitter/X, TikTok (Deliver direct upload sign-in). |
| **Advanced** | Key/value tweaks. |

### 6.2 User
| Panel | Contents |
|---|---|
| **UI Settings** | Reload last project on startup, Show focus indicators, Language, Timeline playback/scroll, **Use dark UI**, Show all frames in thumbnails, Stop renders when a frame or clip cannot be processed, Metadata Overlay, Use gray background for user interface/viewers, Enable gestures, Show Cut page/ Show Fusion page/ etc. (hide pages), Show Photo page (v21). |
| **Project Save and Load** | Load all timelines when opening projects, **Live save** (save each change), **Project backups** (every N min/hours/days kept), Backup location, Load/Save dynamic links. |
| **Editing** | New timeline settings (Start timecode 01:00:00:00, No. of video/audio tracks, audio track type), **Standard generator duration** (5 s), **Standard transition duration** (1 s), transition alignment (centered/start/end), **Standard still duration**, Handles for edit operations, **Default smooth/linear keyframes**, Automatically smart-insert in Cut page, **Gang/use J-K-L shuttle speeds**, **Assist: Select clip after playhead when blading (21.1)**, Allow ripple trimming of empty frames, Fast nudge length (5 frames default), Pre-roll/post-roll for playback around edits, Auto Smart Bins for keywords/people, Use timeline for Inspector … Stop playback when scrubbing (21.1), Always play audio when playhead moves (21.1), Inspector respects auto track selection (21.1). |
| **Color** | Use S-curve for contrast, Always use timeline mode for… , Show Gallery stills with timecode, Auto-saving of stills, Color panel sensitivity, Use legacy offset mode, Use "Lum mix" default, Arrow keys nudge, Retain node Key mixing… Use log mode at… |
| **Fairlight** | Auto-select track with clip selection, Waveform display (log/lin), Show fades in timeline, Default fade shape, Record to path, ADR settings, Pre-roll/post-roll, Video playback during record, Monitoring latency. |
| **Playback Settings** | **Performance mode** (Auto/Manual), **Hide UI overlays**, **Minimize interface updates during playback**, **Timeline proxy resolution**, **Use proxy media during playback**, Video playback buffer, **Deck/viewer: Show all video frames**. |
| **Control Panels** | Panel-specific behavior. |
| **Metadata** | Custom metadata presets & fields. |
| **Keyboard Customization** (separate dialog, Cmd+Opt+K / Ctrl+Alt+K) | Presets: **DaVinci Resolve**, Adobe Premiere Pro, Apple Final Cut Pro X, Avid Media Composer, Pro Tools. Visual keyboard map; per-page or Application-level; Import/Export `.txt`. 21.1: new user presets inherit factory defaults updates. |

---

## 7. Global UI Conventions

| Element | Location | Function |
|---|---|---|
| **Page bar** | Bottom center | Buttons: **Media, Cut, Edit, Fusion, Color, Fairlight, Deliver** (+ **Photo** in v21). Right-click to hide labels/icons. Pages can be hidden in Preferences. Keyboard: Shift+2 … Shift+8. |
| **Bottom-right icons** | | **Home** (Project Manager), **Gear** (Project Settings). |
| **Bottom-left** | | **DaVinci Resolve logo/version**; collaboration/cloud status indicators; **Background activity / Proxy generation progress** (v18+). |
| **Interface toolbar** | Top of each page | Toggles for panels on that page (Media Pool, Effects, Edit Index, Sound Library, Inspector, Metadata, Mixer, etc.). Panels open/close and auto-reflow. |
| **Workspace menu** | Menubar | Layout presets (save/load UI layouts), **Reset UI Layout**, Dual Screen, Full Screen Window, Viewer mode (Cinema Viewer Cmd/Ctrl+F), Video Clean Feed, Primary Display, Show Page/Panel, **Scripts** (Utility/Comp/Edit/Deliver scripts), Console, Remote Grading. |
| **Viewers** | | Single viewer (Edit/Cut: can be single or dual source/timeline), Jog bar/scrubber, transport (Jump to start, Rewind (J), Stop, Play (L), Forward/loop), timecode display (click to type), **Viewer options menu (…)**: Show all video frames, Show Cut timer, Safe area, Show Gang, Data burn overlay, Show metadata overlay. |
| **Viewer overlays dropdown** (bottom-left of timeline viewer, Edit) | | **Transform**, **Crop**, **Dynamic Zoom**, **OpenFX Overlay**, **Fusion Overlay**, **Annotations** (draw on frame; also markers), **Smart Reframe** — switches which on-screen handles are shown. |
| **Zoom/Fit** | | Viewer zoom % dropdown (Fit, 25–400%). |
| **Safe area / Guides** | View > Safe Area; v20.1 custom guides & rulers. |
| **Media Pool** | Shared across Media, Cut, Edit, Fusion, Color, Fairlight | Bin list (Master, user bins, Power Bins, Smart Bins, Collections in v21 photo), thumbnail/list/strip view, search (21.1: sub-bins, exact match), sort, filter, metadata columns, **hover scrub**, clip color, flags, markers, keywords. Right-click clip menu (see §8.4). |
| **Inspector** | Right side Cut/Edit/Fusion/Fairlight | Context-sensitive properties for selected clip/transition/title/effect. Tabs: Video, Audio, Effects, Transition, Image (Camera RAW), File (metadata). 21.1 adds **Inspector presets** and playhead indicator for current clip. |
| **Undo/History** | Edit > Undo History window (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z). Color page has separate per-clip "Undo". Fusion page has its own undo stack. |
| **Status/progress** | Background tasks (proxy/optimize/analysis/transcription/AI). |

---

## 8. Media Page (Shift+2)

Purpose: ingest, organize, sync, clip attributes, metadata, cloning. It is the "logging" page.

### 8.1 Layout
| Panel | Function |
|---|---|
| **Media Storage browser** (top-left) | Browse mounted volumes/locations from Preferences > Media Storage. Favorites. Shows clips (image sequences collapsed). Hover scrub. Drag into Media Pool to import. Right-click: Add Folder into Media Pool, Add Folder and SubFolders into Media Pool (creates bins), Add as Offline Reference Clip, Open file location, Show in Finder. |
| **Viewer** (top-center) | Source viewer: playback, in/out, audio meters; Clip/timecode; **Show original aspect ratio** (21.1); interlaced preview (21.1). |
| **Clone tool** (toolbar) | Copy camera cards with **checksum verification** (MD5/SHA/xxHash) to multiple destinations simultaneously; job queue. Studio adds more (21.1 scripting: clone via API). |
| **Metadata editor** (top-right) | Shows file info, then editable metadata sets (Shot & Scene, Clip Details, Camera, Production, Audio, Reviewed by, Stereo3D, etc.). |
| **Audio panel** | Waveform & meters for selected clip. |
| **Media Pool** (bottom) | Bins and clips. |
| **Scene Cut Detection** | Clip > Scene Cut Detection: analyze a flattened program file and auto-cut at shot changes, then add cuts to Media Pool as clips/timeline. |

### 8.2 Import methods
- Drag from Finder/Explorer or Media Storage. File > Import Media (Cmd/Ctrl+I). Import timeline (AAF, XML, FCPXML, EDL, OTIO (OpenTimelineIO), DRT). Import subtitles (SRT, WebVTT, TTML, DFXP, SCC).
- **Frame rate mismatch prompt**: when first clip's fps differs from project, Resolve asks "Change project frame rate to match?" (only before timeline created).
- Image sequences (DPX, EXR, TIFF, PNG, JPG) detected automatically ("Frame Display Mode": Auto/Sequence/Individual).

### 8.3 Organization features
| Feature | Function |
|---|---|
| **Bins** | Folders; nested; color-tag; lock (collaboration). Open bin in new window. |
| **Smart Bins** | Rule-based (metadata, keywords, clip type, date, camera, people (face), etc.), auto-update. Auto smart bins for keywords/people/scenes (setting). v21: Cut page smart bin views. |
| **Power Bins** | Bins shared across all projects in the library (logos, music, LUT assets). Enable via View > Show Power Bins. |
| **Collections** (v21) | Photo albums. |
| **Clip color / Flags / Markers** | Clip color labels (16 colors), flags (colored), markers with notes/duration/keywords. |
| **Keywords** | Keyword dictionary; used by smart bins. |
| **People** | **Analyze for People (S)** – Neural Engine face detection groups clips by person; Manage People window; auto smart bins per person. v21 IntelliSearch extends to faces with names (rename faces 21.1). |
| **IntelliSearch (v21, S)** | Natural-language/AI search for objects, people, faces, dialogue keywords across media. |
| **AI SlateID (v21, S)** | Detects clapperboard/slate in clip and extracts scene/shot/take/roll to metadata. |
| **Star ratings & tags** (v21) | Metadata panel star rating; clip tagging. |
| **Audio transcription (S)** | Right-click > Audio Transcription > Transcribe: speech-to-text, speaker detection, searchable; used for text-based editing. |
| **Sync audio** | Select clips + audio files → right-click **Auto Sync Audio** > Based on Waveform / Timecode / Waveform & Append tracks / Timecode & Append Tracks. Creates linked synced clips. Also manual sync in Media page viewer with "Link" button. |
| **Generate Proxy / Optimized Media** | See §17. |
| **Relink / Unlink** | Relink clips (folder search), Change Source Folder, Replace Clip. Offline clips shown red. |
| **Clip Attributes** | See below. |
| **Create bins from selected clips**, **Create timeline using selected clips**, **Create new multicam clip using selected clips**, **Create subclip**, **Create compound clip**. |
| **Media Management** (File > Media Management) | Copy / Move / Transcode: entire project, timelines, or clips; trim unused (handles); relink to new media; v21.1 includes `.drp` export. |

### 8.4 Clip Attributes (right-click > Clip Attributes)
| Tab | Settings |
|---|---|
| **Video** | Video format, Pixel aspect ratio, Data levels (Auto/Video/Full), **Field dominance**, **Enable deinterlacing**, **Frame rate** (conform! change interpreted fps, e.g., 120→24 for slow motion), Image orientation (rotate/flip), Alpha mode (None/Premultiplied/Straight), Mono/Stereo 3D, **Enable Flicker** (none), Input sizing preset, Lens metadata. |
| **Audio** | Channel format (Mono/Stereo/5.1/7.1/Adaptive 1-24), **Source channel mapping** per track (e.g., use channels 1&2 as stereo, embedded vs linked audio), add/remove tracks, mute. 21.1 drag to remove multiple tracks. |
| **Timecode** | Change starting timecode (multiple clips in 21.1). |
| **Name** | Clip name, reel name. |

### 8.5 Media Pool list-view columns (selection)
Clip Name, Reel Name, Start/End TC, Duration, Frames, FPS, Resolution, Codec, Bit depth, Audio Ch, Audio Codec, Sample Rate, Flags, Clip Color, Keywords, Comments, Usage (# times used in timelines), Date Created/Modified, Proxy (None/Available/Generating), Optimized, Shot/Scene/Take, Camera #, Angle, Good Take, Star rating (v21). 21.1: edit text/checkbox fields inline, delete markers.

---

## 9. Cut Page (Shift+3)

Introduced in v16 for fast turnaround (news, social, docs). Single-window, no panel juggling, intelligent defaults, optimized for the **DaVinci Resolve Speed Editor** keyboard. Shares the same timeline data as the Edit page (edits in one appear in the other).

### 9.1 Layout
- **Interface toolbar** (top): Media Pool, Sync Bin, Transitions, Titles, Effects; Smart bin views (v21); Import media / import folder buttons; Quick Export (top-right); Inspector toggle; Audio Mixer (v20 full mixer); Voiceover (v20).
- **Media Pool** (left) in thumbnail/list/**filmstrip** view; sort; **Source Tape** button.
- **Viewer** (right): single viewer that switches between Source Clip / **Source Tape** / Timeline modes; buttons under it: **Source Clip**, **Source Tape**, **Timeline** (and **Multi-source** v19+). Timecode/Cut timer.
- **Edit buttons** row below Viewer/above timeline (left→right): **Smart Insert**, **Append**, **Ripple Overwrite**, **Close Up**, **Place on Top**, **Source Overwrite** (each with a big icon).
- **Tool row** above timeline (left): **Timeline settings**, Undo/Redo… **Blade (scissors)**, **Audio trim / waveform** (enlarged waveform for audio trimming), **Split clip**, **Dynamic trim/Trim**; **Transitions buttons**: Cut, Dissolve, Smooth Cut (customizable), **Snapping**, **Track lock**, **Volume**, **Zoom**... (customizable toolbar)
- **Dual Timeline** (bottom): **Upper timeline** = entire program overview always fully zoomed out (navigation; click to jump; drag clips here too); **Lower timeline** = zoomed-in detail around playhead, with trimming. The zoomed-in timeline scrolls; the playhead stays centered. Each can be resized; can be turned off (single timeline mode) via timeline options.
- **Track headers**: compact (lock, mute, solo, enable). Clips can be moved between tracks by dragging.
- **Keyframe tray** (v20): keyframe navigation below timeline; curve editor.

### 9.2 Source modes
| Mode | What it does |
|---|---|
| **Source Clip** | Classic: shows one selected clip; set in/out with I/O, then perform an edit. |
| **Source Tape** | Concatenates **every clip in the current bin** into one long virtual "tape" in bin order (sorted per Media Pool sort). Scrub through all footage like a reel. The current clip is highlighted in the Media Pool and the clip name/boundaries are shown on the viewer scrub bar. When you edit, Resolve uses the clip under the playhead (with in/out you set, or auto smart in/out). Fast skimming without opening clips. 21.1: separate timer option for source tape. |
| **Timeline** | Viewer shows program. |
| **Multi-source (v19+)** | Shows all clips in the bin that overlap the current timeline timecode (by timecode/time-of-day) as a multiview grid, like an ad-hoc multicam without creating a multicam clip. Click an angle to cut it in / **Live overwrite**. |
| **Sync Bin** | See below. |

### 9.3 Edit functions (buttons) — exact behavior
| Button | Shortcut | Behavior |
|---|---|---|
| **Smart Insert** | F9 (Speed Editor: SMART INSRT) | Inserts the source clip at the **nearest edit point** to the playhead (not exactly at the playhead) so you never split a clip accidentally. It finds the closest cut on the timeline, inserts there, and ripples everything after it. The smart indicator (small marker/arrow on the timeline) shows where it will go. |
| **Append** | Shift+F12 (APPND) | Puts source clip at end of the timeline regardless of playhead. |
| **Ripple Overwrite** | Shift+F10 (RIPL O/WR) | Replaces the clip under the playhead with the source clip; if durations differ, the timeline ripples (shortens/extends) to accommodate the new clip's duration. Great for swapping shots without gaps. |
| **Close Up** | (CLOSE UP) | Uses Neural Engine face detection to create a zoomed-in punch-in (up to ~150%, approx 1.5x) of the **same** source clip placed on the track above the current clip, framed on the detected face; used for fake second angle. Places the source clip itself (with the smart in/out) on V2 with zoom/position derived from face location. |
| **Place on Top** | F12 (PLACE ON TOP) | Puts source clip on the first empty track above the timeline at the playhead (B-roll cutaway / overlay). |
| **Source Overwrite** | (SRC O/WR) | Timecode-based overwrite: places the source clip on a track above at the location where its **source timecode matches** the timecode of the clip already in the timeline (synchronizes multicamera angles with matching TC). Used for multicam-style cutaways. |
| **Live overwrite (v19/v20)** | Drag in viewer / Speed Editor | In Sync Bin/Multi-source mode, select an angle while playing to paint it over the timeline; v20: drag horizontally to paint at playhead, drag down to create draggable clip. |
| **Drag to timeline** | | Drag from viewer/Media Pool onto timeline: drop between clips to insert, onto clip to overwrite (with modifier), above to place on top. On Cut page, dragging onto the lower timeline inserts by default (ripples). |

**Smart in/out**: if no in/out set in Source Tape, Cut page auto-chooses a portion around the playhead (Smart Indicator), using the "Source Tape" smart in/out logic; the Speed Editor can set durations by spinning the search dial.

### 9.4 Sync Bin
- Button in Media Pool header (**Sync Bin**). Shows timeline above a **multiview** of all clips that are **synced by timecode** to the current timeline clip's moment (time-of-day TC / multicam cameras). Click any angle → it appears in the source viewer already synced to the timeline position; then **Source Overwrite** or click to perform a cutaway at the exact synced moment. Essentially an automatic multicam from loose clips. Camera-number metadata ordering. Requires matching TC (or synced via waveform prior).

### 9.5 Timeline tools on the Cut page
| Tool | Function |
|---|---|
| **Timeline trim** (direct) | Hovering an edit point shows trim cursors: drag to **ripple** trim (Cut page trims are ripple by default — no gaps). Hold modifier for roll. The viewer shows **two-up** (outgoing/incoming frames) while trimming. |
| **Trim editor/Trim mode** | Click a trim icon or press T: dedicated trim view with **Ripple / Roll / Slip / Slide**, numbers. v21.1: mouse-drag & nudge trimming in trim editor, auto-select to refine. |
| **Safe trim mode (v20)** | Prevents accidental overwrites: playback/drag pauses at cut points; continuing to drag overwrites adjacent clip. |
| **Blade/Split (scissors)** | Cuts clip(s) at playhead on all/selected tracks (Cmd/Ctrl+B). |
| **Audio trim** | Expands waveform view for precise audio trims. |
| **Transitions buttons** | Cut, Dissolve (default cross dissolve), **Smooth Cut** (optical-flow morph to hide jump cuts), customizable; applied to edit nearest the playhead. |
| **Boring Detector** | Timeline > "Boring Detector" (toolbar eye icon/Timeline Options): highlights shots that are **too long** (boring; threshold e.g., > 10 s) and **too short** (jump cuts; threshold e.g., < 1 s) with a gray pattern overlay on the upper timeline. Purely an analysis overlay; does not edit. |
| **Cut timer** | Shows remaining time of the source clip/timeline segment (v21.1: separate timer options for source tape/multiview). |
| **Audio level** | Drag on clip waveform / Inspector. |
| **Timeline options** | Toggle Show dual timeline, track heights, show waveform, show video thumbnails, boring detector, audio waveforms etc. |
| **Voiceover (v20)** | Voiceover palette: cue/record/stop, input selection, auto-dedicated track, Voice Isolation and Dialogue Leveler quick access, teleprompter script with countdown. |
| **Full Audio Mixer (v20)** | Loudness metering, per-channel pan, fader, solo, mute, EQ, Dynamics, FX. |
| **Keyframe editor/tray (v20)** | Curve view with ease controls; keyframe navigation tray below timeline. |
| **Vertical layout (v20)** | UI rearranges for vertical (9:16) timelines. |

### 9.6 Quick Export (Cut page top-right; also File > Quick Export on any page)
- One-click render of the whole timeline (or in-out range) with presets: **H.264**, **H.265**, **ProRes** (Mac), **YouTube**, **Vimeo**, **TikTok**, **Twitter/X**, **Dropbox**, **Box**, **Frame.io**, **Presentations** (Blackmagic Cloud). Choose preset → Export → set filename/location; can **upload directly** to the platform (signed in via Preferences > Internet Accounts). 21.1: render presets can be added to Quick Export via scripting.

### 9.7 Cut page inspector
Same tabs as Edit page inspector (Video: Transform, Cropping, Dynamic Zoom, Composite, Speed Change, Stabilization, Lens Correction, Retime & Scaling; Audio: Volume, Pan, Pitch, EQ; Effects; Transition; Image; File). Also on-viewer **Tools** buttons bar (below viewer when Tools toggled): **Transform, Crop, Dynamic Zoom, Composite, Speed, Stabilization, Lens correction, Audio, Camera Raw/Color (simple)**, **Smart Reframe**.

### 9.8 Speed Editor integration (hardware)
Keys: SOURCE, TIMELINE, SYNC BIN, AUDIO LEVEL, FULL VIEW, TRANS (transition), SPLIT, SNAP, RIPL DEL; IN/OUT, TRIM IN/TRIM OUT, ROLL, SLIP SRC, SLIP DEST, TRANS DUR, CUT, DIS (dissolve), SMTH CUT, SMART INSRT, APPND, RIPL O/WR, CLOSE UP, PLACE ON TOP, SRC O/WR; camera 1–9 angle keys (multicam/sync bin), LIVE O/WR, VIDEO ONLY, AUDIO ONLY, STOP/PLAY; Search dial (shuttle/jog/scroll modes).


---

## 10. Edit Page (Shift+4)

The full-featured NLE page: source/timeline dual viewers, multi-track timeline, full trim toolset, Inspector, Effects, Edit Index, Sound Library, Mixer, Metadata.

### 10.1 Layout
| Area | Contents |
|---|---|
| **Interface toolbar (top)** | Left: **Media Pool**, **Effects** (Effects Library), **Edit Index**, **Sound Library**. Right: **Mixer**, **Metadata**, **Inspector**. Center: viewer mode buttons (single/dual viewer). |
| **Source viewer (left)** | Shows source clip / compound / timeline-as-source; in/out marks, clip name, timecode, **jog bar**, transport; dropdown at top: recent clips list; **Source viewer options**: Audio waveform display (for audio-only clips), Show multicam (if multicam clip). |
| **Timeline viewer (right)** | Program monitor; **viewer overlay mode dropdown** (Transform, Crop, Dynamic Zoom, OpenFX, Fusion, Annotations, Smart Reframe), zoom, **Bypass color grades and Fusion effects** button, playback; timeline name dropdown (switch timelines; timeline tabs option "Show stacked timelines"). |
| **Toolbar (between viewer and timeline)** | See §10.2. |
| **Timeline** | Track headers on left; ruler with timecode; playhead; clips; markers; ruler zoom; **Timeline View Options** (button at toolbar left). |
| **Audio meters** | Right of timeline (Mixer collapsed). |

### 10.2 Edit page toolbar — every button
Left-to-right in Resolve 20/21:

| Button | Shortcut | Exact behavior |
|---|---|---|
| **Timeline View Options** (menu icon) | — | Stacked timelines, subtitle tracks show/hide, **Video view options**: Filmstrip / Thumbnail / Name-only (clip appearance); **Audio view**: waveform / none; **Track height** sliders (video/audio/subtitle); Show audio waveforms; Show Video Track Display Options; Show Transitions as Full Height; Show Flags/Markers/Keyframes. |
| **Selection Mode (Arrow)** | **A** | Default pointer. Click to select clips; drag to move (overwrite at destination by default); drag edges to **trim** (non-ripple, leaving gaps, unless trimming into gap/overlap); context-sensitive cursors at edges allow roll (center of edit), and Shift-drag etc. Hold Cmd/Ctrl while dragging to swap/shuffle insert (Cmd+Shift drag = swap edit). |
| **Trim Edit Mode** | **T** | Turns timeline into a ripple/roll/slip/slide trim tool depending on pointer position: **Ripple** (edge of clip: changes duration and ripples downstream), **Roll** (center of edit point: moves cut between two clips without changing timeline length), **Slip** (middle-upper area of clip body: changes source in/out while keeping position/duration), **Slide** (on clip name bar/upper part: moves clip left/right, adjusting neighbors). Viewer shows **four-up** (slip/slide) or **two-up** trim view. Ripples respect **sync locks** (v20.2) and selected tracks. |
| **Dynamic Trim Mode** | **W** | Trims **during playback** using J-K-L: select an edit point (Trim mode) or clip (Slip/Slide), then press J/K/L — edit moves as playback runs; the toolbar button cycles **Slip** vs **Slide** behavior (press **S** to toggle Slip/Slide in dynamic mode). Plays a loop around the edit (pre-/post-roll). 21.1: switching to dynamic trim turns on trim mode by default; loop playback continues. |
| **Blade Edit Mode** | **B** | Pointer becomes razor; click on a clip to cut it at that frame. With linked selection on, cuts video and linked audio together (Opt/Alt-click cuts only the clicked item). Cmd/Ctrl+B = **Split clip** at playhead on auto-selected tracks without changing tool. |
| **Insert Clip** | **F9** | Inserts source (in→out) at timeline playhead or timeline In point on the **destination tracks** (patched), rippling everything downstream on all **unlocked** tracks (sync). |
| **Overwrite Clip** | **F10** | Overwrites destination track content from playhead/In for the source duration; no ripple. |
| **Replace Clip** | **F11** | Replaces the clip under the playhead with source; aligns the source frame at the source playhead to the timeline playhead (backtimes) and uses the **timeline clip's duration** (not source in/out). Good for swapping takes in sync. |
| **(Dropdown) Place on Top** | **F12** | Puts clip on first free track above at playhead. |
| **Ripple Overwrite** | **Shift+F10** | Replaces clip under playhead with source, rippling for duration difference. |
| **Fit to Fill** | **Shift+F11** | Requires 3 points + 1 (timeline In & Out, source In & Out): retimes the source (speed change) so source range exactly fills timeline range. |
| **Append at End** | **Shift+F12** | Appends after last clip on the timeline. |
| (Toolbar edit buttons) | | Three big icons by default: **Insert**, **Overwrite**, **Replace**; dropdown/right-click reveals others. You can also drag a clip from source viewer to timeline viewer: the **Edit Overlay** appears with drop zones: Insert, Overwrite, Replace, Place on Top, Append at End, Ripple Overwrite, Fit to Fill, Superimpose (composite above), plus Superimpose. |
| **Snapping** | **N** | Clips/playhead/edit points snap to edits, markers, playhead, in/out. Holding N during drag temporarily toggles. Also v20 snap to music beat markers. |
| **Linked Selection** | **Cmd+Shift+L / Ctrl+Shift+L** | When on, selecting video also selects linked audio (synced). Off → select independently. Opt/Alt-click selects one item of linked pair temporarily. Link/Unlink clips: Cmd+Opt+L / Ctrl+Alt+L. |
| **Position Lock** | (no default; toolbar lock icon) | Locks horizontal position of all clips on the timeline: you can still trim levels, change attributes, grade, but cannot move/ripple clips. Protects against accidental moves. |
| **Flag** dropdown | **G** (add flag) | Adds a colored flag to the **source clip** (Media Pool clip — every instance in all timelines shows it). Choose color. |
| **Marker** dropdown | **M** (add marker); **M M** (double tap) or Cmd/Ctrl+M opens marker dialog; Shift+↑/↓ previous/next marker | Markers are placed on **the timeline ruler** (no clip selected) or **on selected clip** (clip marker). Colors (16), name, notes, keywords, duration (Opt/Alt-drag or Mark In/Out to duration marker), **custom data**. Markers with "Show in Edit index". Types: standard, **Presentation markers** (Cloud reviews: annotations, replies, status 21.1), **Beat markers** (AI Detect Music Beats v20). Markers can carry **annotations** (drawn on frame, 21.1 ellipse). Chapter markers via marker naming for MP4/QuickTime chapter export. |
| **Zoom controls** | Cmd/Ctrl +/–, Shift+Z (fit), **Full Extent Zoom**, **Detail Zoom** (around playhead), **Custom Zoom** slider | |
| **Timeline Overlay Toolbar buttons** (v19+, right side) | | **Audio Volume (fader icon)**, **Audio Mute**, **Video Track Display** etc. |
| **Retime/Speed (none default)** | **R** (change clip speed dialog), **Cmd/Ctrl+R** (show retime controls) | |
| **Audio Mixer/Meter** | | |

**Edit Overlay (drag-to-viewer) actions** — drag a source clip onto the timeline viewer: **Insert, Overwrite, Replace, Fit to Fill, Place on Top, Append at End, Ripple Overwrite**. Fast for mouse users.

### 10.3 Three-point / four-point editing logic
- Source In/Out + timeline In → duration from source.
- Source In + timeline In/Out → duration from timeline.
- Backtiming: source Out + timeline Out.
- Without timeline In, playhead = In. Without source marks, entire clip (or from playhead).
- **Fit to Fill** consumes all four.
- **Replace** uses playhead sync points (source playhead ↔ timeline playhead), duration of timeline clip.
- **Mark clip** (**X**) sets timeline In/Out around clip under playhead on auto-selected tracks; **Opt/Alt+X** clears In/Out; **Mark Selection** (Shift+A) sets In/Out to the extent of the selected clips.

### 10.4 Track headers (each track row)
| Control | Function |
|---|---|
| **Track name & number** (V1, A1, ST1) | Rename by double click. |
| **Destination control** (patch buttons, left of track header: "V1"/"A1" boxes) | Source tracks of the current source clip (left column) are patched to destination timeline tracks (the red/orange button). Edits (F9/F10…) go to destination tracks. Drag patch to other tracks. Cmd/Ctrl/Opt+1–8 shortcuts set destination video/audio track. v20.2 **source patch selector** improvements. 21.1 shortcuts up to 32 tracks. |
| **Lock Track** (padlock) | Prevents any edits to that track (no ripple, trimming, selection). Ripple edits elsewhere will not move clips on locked tracks (can cause sync drift). |
| **Auto Track Selector** (track with box/arrow icon, default on) | Determines which tracks are affected by **edit-point-based** operations: playhead-based trims (Up/Down arrow navigation selects edit points on auto-selected tracks), Mark Clip (X), Delete In-Out, Ripple Delete, Blade/Split at playhead, Match Frame, copy/paste with in-out, Paste location (pastes to lowest auto-selected track). Insert edits ripple all unlocked tracks (or sync-locked tracks in 20.2+). Opt/Alt-click to solo the auto-select state (enable only this track). v20.2 introduced **Auto select** improvements and **Sync locks**. |
| **Sync Lock** (v20.2) | Like Avid/Premiere: tracks with sync lock on ripple along with ripple edits on other tracks (keep sync), off tracks don't move. |
| **Enable Video Track** (monitor icon on video tracks) | Turns the whole video track's visibility on/off (disabled track not shown/rendered). |
| **Solo** (S) / **Mute** (M) on audio tracks | Solo plays only soloed tracks; Mute silences. 21.1: Clear solo / restore solo. |
| **Track color**, track height | Right-click track header: Change Track Color, Add/Delete Tracks, Move Up/Down, Delete Empty Tracks, **Track type** (Mono, Stereo, 5.1, 7.1, Adaptive…), Show waveforms. |
| **Audio track level/pan** | Visible in Mixer. |
| **Folder tracks (v21)** | Group tracks under a folder, collapse to composite view showing clip count/duration; expand to reveal. (Fairlight & Edit.) |
| **Subtitle track header** | Enable/lock/caption format/language name; show/hide; export. |

### 10.5 Timeline editing operations (beyond buttons)
| Operation | Shortcut | Description |
|---|---|---|
| Delete (lift) | Backspace (Mac: Delete) | Removes selection leaving a gap. |
| **Ripple Delete** | Shift+Backspace / Forward Delete (Mac Fn+Delete) | Removes & closes gap. Also delete gap by selecting gap and Delete. |
| Delete gaps | Edit > Delete Gaps | Removes all gaps on tracks. |
| **Insert Gap** (v20.3) | | Adds empty space at playhead. |
| **Cut/copy/paste gaps** (21.1) | | |
| **Paste Insert** | Cmd/Ctrl+Shift+V | Inserts clipboard at playhead with ripple. |
| **Paste Attributes** | Opt/Alt+V | Dialog: choose Video Attributes (Zoom, Position, Rotation, Anchor, Pitch, Yaw, Flip, Crop, Dynamic Zoom, Composite, Speed change, Keyframes (Maintain timing / Stretch to fit), Plugins/OpenFX, Color corrections, Fusion), Audio attributes (Volume, Pan, EQ, Plugins). |
| **Remove attributes** | | Same dialog to strip. |
| **Shuffle insert / Swap clips** | Cmd/Ctrl+Shift drag, or Cmd+Opt+, / . (swap left/right) | Move clip to new position rippling. |
| **Move clip up/down tracks** | Opt/Alt+↑/↓ | |
| **Nudge** | , / . (1 frame); Shift+, / Shift+. (fast nudge; default 5 frames, configurable) | Moves selected clip or edit point. |
| **Trim start/end to playhead** | Shift+[ / Shift+] | Trim start/end of clip at playhead (non-ripple). |
| **Ripple trim start/end to playhead** | Cmd/Ctrl+Shift+[ / ] | Ripple. |
| **Select nearest edit point** | V | Selects edit point closest to playhead on auto-selected tracks. |
| **Toggle edit selection (incoming/outgoing/both)** | U | Cycles which side of edit selected (A side/B side/roll). |
| **Extend edit** | E | Extends selected edit point to playhead. |
| **Select clip at playhead** | Shift+V | |
| **Select clips forward** | Y (forward on track), Opt/Alt+Y (forward all tracks), Cmd/Ctrl+Y (backward) | |
| **Disable/Enable clip** | D | Disabled clips are hidden/not rendered (muted for audio). |
| **Link/Unlink** | Cmd+Opt+L / Ctrl+Alt+L | |
| **Match frame** | F | Loads source clip in source viewer at same frame. Shift+F: Find clip in Media Pool (reveal). |
| **Add default transition** | Cmd/Ctrl+T (video & audio), Opt/Alt+T (audio only), Shift+T (video only) | Uses Standard transition duration from prefs; placement centered/start/end. Needs handles; if insufficient, transition shortens or prompts. Right-click effect in library → Set as Standard Transition. |
| **Fade handles** | | Drag white fade handle at top corners of clips for video opacity fades or audio fades (curve by dragging the curve handle). |
| **Audio level line** | | Drag the horizontal line on audio clip to adjust gain; Opt/Alt-click to add keyframe. |
| **Freeze frame** | Shift+R | Converts clip at playhead to freeze (speed 0) for clip duration. |
| **Change clip speed** | R | Dialog: speed %, fps, duration, Ripple sequence, Reverse speed, **Freeze frame**, Pitch correction. |
| **Retime controls** | Cmd/Ctrl+R | Shows speed bar on clip; dropdown at each speed point: Change Speed (presets 10–400%, reverse, freeze), **Add Speed Point**, Reset, Retime frame/curve; drag top of speed segment to change speed (ripples); drag speed-point handle to move point. |
| **Retime curve** | | Keyframe-able Retime Frame curve (frame vs time) and Speed curve in curve editor; ease. v21: **4-point Bézier retime controls**. |
| **Compound clip** | Right-click > New Compound Clip | Nests selected clips into one clip (see §17). Decompose in Place. |
| **New Fusion Clip** | Right-click | Combines selected clips into a Fusion composition with stacked MediaIns/Merges. |
| **Open in Timeline / Open in Fusion** | | |
| **Adjustment Clip** | Effects > Toolbox > Effects > Adjustment Clip | A blank clip that applies its grade/inspector/effects to everything beneath it. 21.1: transitions can be applied to adjustment clips. |
| **Render in Place** | Right-click > Render in Place | Bakes clip (with effects/grades/Fusion) into a new media file, replaces in timeline (original retained; "Decompose to original"). |
| **Render Cache Fusion/Color output** | Right-click > Render Cache Fusion Output / Color Output: Auto/On/Off | |
| **Detect Scene Cuts / Split at scene cuts** | Timeline > Detect Scene Cuts (v19+) | On a flattened clip in timeline. |
| **Normalize Audio Levels** | Right-click audio | Peak / Loudness (ITU-R BS.1770/EBU R128) target; set relative or independent. |
| **Take selector** | Right-click > Take Selector | Stack alternate takes on one clip; choose take; IntelliScript places alternates on extra tracks. |
| **Duplicate timeline** | Media Pool right-click | Versioning. |
| **Compare timelines** (Studio, collab; 21.1 improved) | Timeline > Compare with Current Timeline | Diff two timeline versions, merge changes. |
| **Auto align clips** | Right-click > Auto Align Clips (waveform/timecode) | Align selected overlapping clips. |
| **Conform Lock / Use Timecode** | | Conform options. |
| **Lift/Extract a range** | Set timeline In/Out, then Backspace / Shift+Backspace | Backspace removes the In–Out range on auto-selected tracks leaving a gap (lift); Shift+Backspace ripple-deletes it (extract). |

### 10.6 Inspector — Video tab (per timeline clip)
Each group can be enabled/disabled (toggle) and reset (circular arrow). Every numeric parameter has a **keyframe diamond** (add/remove keyframe at playhead, navigation arrows). Drag-scrub numbers; Opt-drag finer; double-click to reset.

| Section | Parameters & behavior |
|---|---|
| **Transform** | **Zoom X/Y** (linked chain, 1.0 = 100%), **Position X/Y** (pixels from center), **Rotation Angle** (degrees, around anchor), **Anchor Point X/Y**, **Pitch** & **Yaw** (3D-ish perspective tilt), **Flip** Horizontal/Vertical buttons. Viewer: overlay mode **Transform** shows bounding box handles. |
| **Smart Reframe (S)** | Neural Engine: reframes clip to a different aspect timeline (e.g., 16:9 → 9:16) by tracking the main subject; options **Object of Interest: Auto / Reference Point** (draw box), **Reframe** button; generates position keyframes. |
| **Cropping** | **Crop Left/Right/Top/Bottom** (pixels), **Softness** (feather on crop edges), **Retain Image Position** (crop without shifting). |
| **Dynamic Zoom** | Ken Burns: on-viewer **green (start) and red (end) rectangles**; **Dynamic Zoom Ease**: Linear / Ease In / Ease Out / Ease In and Out; **Swap** start/end. Animates across the whole clip duration without keyframes. |
| **Composite** | **Composite Mode** (Normal, Add, Subtract, Difference, Multiply, Screen, Overlay, Hardlight, Softlight, Darken, Lighten, Color Dodge, Color Burn, Exclusion, Hue, Saturation, Color, Luminosity, Linear Dodge, Linear Burn, Linear Light, Vivid Light, Pin Light, Hard Mix, Lighter Color, Darker Color, Foreground, Alpha, Inverted Alpha, Lum, Inverted Lum), **Opacity** (0–100). |
| **Speed Change** | **Direction** (forward/reverse/freeze), **Speed %**, **Frames per second**, **Duration**, **Ripple Timeline** checkbox, **Pitch Correction** (audio). Note: Speed Change here is constant speed; variable → Retime controls. |
| **Stabilization** | **Mode**: Perspective / Similarity / Translation; **Camera Lock** (lock-off shot completely); **Zoom** (auto crop to hide edges) & **Crop Ratio** (amount of zoom permitted; lower = more zoom), **Smooth** (strength), **Strength**, **Stabilize** button (analyzes). Similarity = pan/tilt/rotation/zoom; Perspective = also keystone; Translation = x/y only. Color page Tracker has the same with more controls. |
| **Lens Correction** | **Analyze** (auto detect straight lines), **Distortion** slider (barrel/pincushion correction); Color page has extended Lens Correction Resolve FX. |
| **Retime and Scaling** | **Retime Process**: Project Settings / Nearest / Frame Blend / Optical Flow. **Motion Estimation**: Project / Standard Faster / Standard Better / Enhanced Faster / Enhanced Better / **Speed Warp Faster / Speed Warp Better (S)**. **Motion Range** (Small/Medium/Large). **Scaling**: Project Settings / Crop / Fit / Fill / Stretch. **Resize Filter**: Project / Sharper / Smoother / Bicubic / Bilinear / Custom. **Super Scale (S)** is set per source clip via Media Pool right-click > Clip Attributes > Video > Super Scale (2x; 3x/4x added in v20) with Sharpness and Noise Reduction (also exposed in the Inspector for timeline clips in recent versions). |
| **Video fades** | Via the fade handles at the clip's top corners (opacity ramps); 21.1 exposes fades to scripting. |
| **Image / Camera RAW tab** | RAW decode settings per clip (ISO, WB, tint, exposure, etc.). |

### 10.7 Inspector — Audio tab
| Section | Parameters |
|---|---|
| **Volume** | Clip gain (dB), keyframeable. |
| **Pan** | L/R (and surround) pan, keyframeable; IntelliTrack (v19) can drive pan from tracked object. |
| **Pitch** | Semitones & cents (pitch shift without speed change). |
| **Clip EQ** | **6-band** parametric EQ (v20; formerly 4) with HP/LP filters, shelf/bell. |
| **Voice Isolation (S)** | On/off + amount: AI removes non-voice noise (music, wind, traffic). |
| **Dialogue Leveler (v19)** | Smooths dialogue level variations: Reduce/Boost/Background reduction, target. |
| **Audio FX** | Clip-level Fairlight FX applied. |
| **Audio fade** | |
| **AI Voice Convert (v20, S)** | Apply voice model to clip. |

Other Inspector tabs: **Effects** (Resolve FX/OpenFX applied on clip, Fusion effects with parameters), **Transition** (duration, alignment, style params, ease, **Transition curve**), **Image**, **File** (metadata). Title clips show **Title** tab (Text+ params), Generators show **Generator** tab.

### 10.8 Effects Library (Effects panel)
Panel with category tree and search (v20.1: **Shift+Space** global effects search on Edit/Cut).

| Category | Contents |
|---|---|
| **Toolbox** | **Video Transitions** (Dissolve: Cross Dissolve, Additive Dissolve, Blur Dissolve, Dip to Color Dissolve, Non-Additive Dissolve, **Smooth Cut**; Iris: Arrow, Cross, Diamond, Eye, Hexagon, Oval, Pentagon, Square, Triangle; Motion: Barn Door, Clock Wipe, Push, Slide, Split, Spin; Shape: Box, Heart, Star; Wipe: Band, Center, Clock, Edge, Radial, Spiral, Venetian Blind, X; **Fusion Transitions** (Brightness Flash, Camera Shake, Slide Push Smear, Zoom In/Out etc.); **Resolve FX Transitions** (e.g., blur/warp-style dissolves)); **Audio Transitions** (Cross Fade 0 dB, +3 dB, -3 dB); **Titles** (Left Lower Third, Middle Lower Third, Right Lower Third, Scroll, Text, **Text+** (Fusion-based), **Fusion Titles** (dozens of animated templates: Background Reveal, Call Out, Digital Glitch, Draw On, Dark Box Text, Lens Blur, Lower Third templates, Scroll Text...), **Animated subtitles** templates (v20)); **Generators** (10 Step, 100mV Steps, Color Bars, EBU Color Bar, Four Color Gradient, Grey Scale, SMPTE Color Bar, **Solid Color**, Window, **YCbCr Ramp**, **Fusion Generators**: Contours, Noise Gradient, Paper, Texture Background); **Effects** (**Adjustment Clip**, **Fusion Composition**). |
| **Audio Transitions** | Crossfades. |
| **OpenFX** | **Resolve FX** grouped: Blur (Box, Directional, Gaussian, Lens Blur, Mosaic, Radial, Zoom), Color (ACES Transform, Chromatic Adaptation, Color Compressor, Color Space Transform, Color Stabilizer, Contrast Pop, DCTL, Dehaze, False Color, **Film Look Creator** (v19), **Gamut Limiter/Mapping**, Invert Color), Generate (Color Generator, Grid, Four Color Gradient), Key (3D Keyer, Alpha Matte Shrink and Grow, HSL Keyer, Luma Keyer), Light (Aperture Diffraction, Glow, Lens Flare, Lens Reflections, Light Rays, **Relight** (S)), Refine (**Beauty**, **Face Refinement** (S)), Revival (Automatic Dirt Removal, Chromatic Aberration Removal, Dead Pixel Fixer, Deband, **Deflicker**, Dust Buster, **Object Removal**, Patch Replacer, **Noise Reduction** (S), **UltraSharpen** (v21)), Sharpen (Sharpen, Sharpen Edges, Soften & Sharpen), Stylize (Abstraction, Blanking Fill, Drop Shadow, Edge Detect, Emboss, **Film Damage**, **Film Grain**, JPEG Damage, Mirrors, Pencil Sketch, Prism Blur, Scanlines, Stop Motion, Tilt-Shift Blur, Vignette, Watercolor, **Video Collage**), Texture (Analog Damage, Halation), Transform (Camera Shake, Flicker Addition, Lens Distortion, **Transform**, **Picture in Picture** (v21)), Warp (Ripple, Vortex, Waviness, Warper), **AI**: Magic Mask (Color/Fusion), Depth Map, Set Extender (v20), CineFocus (v21), Face Age Transformer, Face Reshaper, Blemish Removal, Motion Deblur, UltraSharpen. Third-party OFX (BorisFX, RedGiant, etc.). |
| **Audio FX** | Fairlight FX list (see §13) + VST/AU. |
| **Favorites** | Starred effects. |

Applying: drag onto clip/edit point; or select edit point + double-click transition; or set as standard. Effects on clips appear in Inspector > Effects (Edit page) and in the Color page as OFX in nodes when applied there. Edit-page OpenFX are part of the timeline clip's effect stack (processed after the Color page grade); Color-page OFX live inside nodes of the grade.

### 10.9 Titles & Text
| Type | Notes |
|---|---|
| **Text** (basic) | Font, color, size, tracking, line spacing, alignment, drop shadow, stroke, background box; fast. |
| **Text+** | Fusion-based Text+ tool: per-character styling, layout (point/frame/circle/path v20), shading elements (8: fill, outline, shadow, border…), character-level styling, per-character animation via the **Follower** modifier in Fusion; spell check, color fonts, emoji (v21). |
| **MultiText (v20)** | Multiple text layers in one tool with per-layer style/layout/warp/keyframes; text list for navigation. |
| **Fusion Titles** | Templates (macros) with exposed parameters in Inspector; editable in Fusion page. Make your own via Macro Editor (v21) / `.setting` & `.drfx` bundles. |
| **Scroll** | Rolling credits; auto scroll speed from duration. |
| **OGraf (v21)** | Native HTML-based graphics standard (EBU OGraf) as titles/graphics; 21.1 animation actions. |
| **Lottie (v21)** | Import Lottie JSON animations. |

### 10.10 Edit Index
Table list of the current timeline's events (toggle Edit Index). Tabs/dropdown: **Edit Index** (event #, reel, track, V/A, source in/out, record in/out, duration, name, codec, notes, flags, clip color), **Markers** list (filter by color, edit name/notes/keywords; 21.1: export as PDF), **Missing clips**. Click to jump playhead. Column options. Export EDL. Useful for conform and marker reviews.

### 10.11 Sound Library
Search a database of audio files (e.g., free **Blackmagic Foley/SFX library** download (500+ SFX), indexed user libraries). **Add library** → index → search by name/metadata → audition → drag to timeline. Also in Fairlight.

### 10.12 Mixer (Edit page)
Compact Fairlight mixer: per track **channel strip**: **EQ** (thumbnail, double-click opens 6-band), **Dynamics** (thumb), **Pan** knob/2D panner, **Bus sends**, **Mute/Solo**, **Fader** (dB), meters; **Main bus** fader. Full mixer on Fairlight page. Also v20 Cut page mixer.

### 10.13 Metadata panel
Shows selected clip metadata (file info, camera, shot/scene/take, comments, keywords, good take, star rating (v21)). Editable. Metadata presets (Preferences > User > Metadata).

### 10.14 Keyframing on Edit page
- Diamond buttons in Inspector add keyframes; arrows navigate.
- Timeline: click the **keyframe icon** (diamond) at bottom-right of clip to show **Keyframe track** under the clip with all animated params; **curve icon** shows **Curve editor** (per parameter, Bézier handles, linear/ease-in/ease-out/smooth). Right-click keyframe: Linear, Ease In, Ease Out, Ease In and Out, Static (hold).
- v20 **Keyframe editor/tray**: dedicated timeline-bottom tray across all keyframed clips with curve view and parameter modes; 20.2.3 hotkey to toggle. v21: improvements (4-point Bézier).
- Default interpolation in preferences (Smooth vs Linear).
- Opt/Alt-click on audio volume line adds keyframe; Fairlight automation separate.

### 10.15 Subtitles on Edit page
See §17.8.

### 10.16 Multicam on Edit page
See §17.1. Toolbar viewer: Source viewer dropdown → **Multicam** mode shows angle grid; click an angle to cut; the buttons under the viewer choose whether the cut affects **Audio & Video**, **Video only** or **Audio only**; Opt/Alt-click switches the current segment without adding a cut.

### 10.17 Timelines
- **New Timeline**: Cmd/Ctrl+N: name, Start TC, # video/audio tracks, audio track type, **Empty timeline**, **Use selected Mark In & Out**, **Use Project Settings** (uncheck → per-timeline Format (res, fps, PAR), Monitor, Output and Color settings)
- **Create timeline from selected clips** in Media Pool; **Timeline from bins**.
- Stacked timelines (tabs), **Timeline compare**, timeline backups (Collab), **Export Timeline**: AAF, XML (FCP7), FCPXML (1.8–1.11), EDL, OTIO, CSV/TXT edit list, **DRT** (Resolve timeline file).
- **Timeline Settings** (right-click timeline): resolution/fps(override at creation only), output scaling, monitoring, and (with "Use Project Settings" off) per-timeline format and color management.


---

## 11. Fusion Page (Shift+5)

Node-based compositing, VFX and motion graphics (Fusion was acquired from eyeon in 2014; also sold standalone as **Fusion Studio**). Each timeline clip can hold a **Fusion composition**; the Fusion page shows the comp of the clip under the playhead.

### 11.1 Layout
| Area | Function |
|---|---|
| **Viewers** (1 or 2) | Left and right viewer: press **1** / **2** with a node selected to view it in that viewer. Viewer toolbar: zoom, **Region of Interest**, **Color channels** (RGB, R, G, B, Alpha, Z), **LUT** toggle, **Sub views** (Histogram, Waveform, Vectorscope, 3D Histogram, Navigator, Color Inspector, Magnifier, Image Info), **Checker underlay**, **Lock** viewer, **A/B buffer split** compare, **Proxy/Auto proxy**, **Stereo**, **3D viewer** modes (Perspective, Front/Top/Left, Camera views, Light views). Time ruler under viewers with render range, keyframe ticks, transport. |
| **Toolbar** | Quick buttons for common tools: Background, Paint, Text+, Merge, Polygon/B-Spline/Ellipse/Rectangle masks, Tracker, Planar Tracker, Transform, Blur, Color Corrector, Brightness/Contrast, Channel Booleans (customizable), 3D: Shape3D, Merge3D, Camera3D, Renderer3D, Text3D, Image Plane, Particles: pEmitter, pRender. |
| **Node Editor** | Node graph; flows left→right or top→bottom. **MediaIn** (source clip, after Edit retime) → tools → **MediaOut** (to Color). Additional MediaIns by dragging clips from Media Pool. |
| **Spline Editor** | Animation curves for all animated parameters; Bézier handles; tools: Smooth (S), Linear (L), Step in/out, Reverse, Time stretch, Shape box, Loop/Ping-pong/Relative loop; set key values; Follow active. |
| **Keyframes Editor** | Dope-sheet style timeline per tool/parameter: move/retime keys, time stretcher, offset tools, show render range. |
| **Inspector** | Parameters of selected node in tabs (e.g., Controls, Style, Layout, Transform, Shading for Text+; **Settings** tab common to all: Blend, process RGBA channels, Apply Mask Inverted, Multiply by Mask, **Motion Blur** (quality, shutter angle, center bias, sample spread), Use GPU, Comments, Frame render scripts). Right-click parameter: Animate (adds Bezier spline), **Modify With** (Expression, Shake, Perturb, Path, XY Path, Probe, Follower, Calculation, Offset Angle/Position, Track, Publish/Connect to), **Fairlight Animator** (v21), Remove, Set key. |
| **Effects Library** | Tools (categorized), OpenFX, **Templates** (Fusion titles/generators/transitions/effects macros, Krokodove (v21)). |
| **Metadata, Clips (thumbnail strip of timeline clips)** | |

### 11.2 Core concepts
- **Nodes**: each has **inputs** (triangles: yellow = background/main, green = foreground, blue = mask/effect mask, white/gray = garbage/solid masks; 3D = scene inputs) and **output** (square). Connect by dragging. Node naming, coloring, **Pass-through** (Cmd/Ctrl+P), **Lock**, **Groups** (Cmd/Ctrl+G), **Macros**, **Underlays**, **Pipe routers**, **Sticky notes**.
- **Image domain**: **DoD** (domain of definition — actual pixel bounds, may extend beyond frame) vs **RoI**; processing resolution independent; images are float (int8/int16/float16/float32 depth per node Settings).
- **Pre-multiplied alpha** throughout; Merge handles additive/subtractive; **Alpha gain**.
- **Coordinates** are normalized: (0.5, 0.5) = center; size 1.0 = 100%. Rotation in degrees. Pixel-independent.
- **Concatenation** of transforms: consecutive Transform/Merge transform nodes concatenate to avoid repeated filtering (red/green indicator).
- **Render**: on-demand per frame, cached in RAM (Fusion memory cache); **Render Cache Fusion Output** on Edit page; Fusion "Render" options.
- **Expressions** (Lua-like, `Point(…)`, `time`, `comp`), **SimpleExpression**, **Custom Tool**, scripting (Lua/Python).
- **Deep image compositing (v20)**: deep EXR merge/transform/resize/crop/recolor/holdout; render deep from 3D.
- **Multi-layer support (v20)**: all nodes handle multi-layer images (multi-layer EXR/PSD), choose layer.
- **USD** (Universal Scene Description) 3D toolset (uLoader, uMerge, uRenderer etc. v18.5+; USD 25.11/Hydra 2.0 v21); **OpenPBR** (21.1).

### 11.3 Key tools/nodes (categories)
| Category | Tools (most used in bold) |
|---|---|
| **I/O** | **MediaIn**, **MediaOut**, Loader, Saver (Fusion Studio / for renders) |
| **Generators** | **Background** (solid/gradient), **FastNoise**, Day Sky, Mandelbrot, Plasma, Text+, MultiText (v20), Text3D, Krokodove shape tools (v21). |
| **Composite** | **Merge** (Foreground over Background; Apply modes: Normal, Screen, Dissolve, Multiply, Overlay, Soft/Hard light, Color dodge/burn, Darken, Lighten, Difference, Exclusion, Hue, Saturation, Color, Luminosity; Operator: Over, In, Held Out, Atop, XOr, Conjoint; size/center/angle; edges), **Dissolve**, Channel Booleans, **Matte Control**. |
| **Masks** | **Polygon**, **B-Spline**, **Ellipse**, **Rectangle**, Bitmap, Paint mask, Ranges, Triangle, Wand, **Magic Mask** (Neural Engine, v20.1 MM2 in Fusion). |
| **Transform** | **Transform** (center, pivot, size, aspect, angle, flip; concatenates), Resize, Scale, Letterbox, Crop, DVE (3D-ish), Camera Shake. |
| **Color** | **Color Corrector** (wheels, levels, histogram, suppression), **Brightness/Contrast**, Color Curves, Hue Curves, Gamut (color space conversion), Color Space, **File LUT**, OCIO ColorSpace/CDL/FileTransform, Auto Gain, Channel Booleans, White Balance, Color Gain. |
| **Blur** | **Blur** (Fast Gaussian, Box, Multi-box, Bartlett, Gaussian), Defocus, Directional Blur, Glow, Sharpen, Soft Glow, Unsharp Mask, VariBlur, Vector Motion Blur. |
| **Effect / Filter** | Highlight, Hot Spot, Pseudo Color, Rays, Shadow, Trails, TV, Create Bump Map, Custom Filter, Erode/Dilate, Rank Filter, **Duplicate** (copies & offsets), Film Grain, Noise. |
| **Matte / Keying** | **Delta Keyer** (primary green/blue screen keyer: Background color pick, Pre-matte, Matte (threshold, erode/dilate, blur, clean fg/bg), Fringe, Tuning), **Ultra Keyer**, Primatte (Fusion Studio legacy), **Chroma Keyer**, **Luma Keyer**, **Difference Keyer**, **Clean Plate**, Matte Control, Alpha Divide/Multiply. |
| **Tracking** | **Tracker** (point tracker: 1–N patterns, Match Move / Corner pin / Steady / Unsteady), **Planar Tracker** (track planar surface; Corner pin / Stabilize / Track), **Camera Tracker** (3D camera solve; 21.1 import external tracks), **Surface Tracker** (v18, deforming surfaces), **IntelliTrack** (AI tracker option, v19). |
| **Paint** | **Paint** (stroke-based: Clone, Wire removal, Erase, Stamp, Smear, multistroke vs stroke). |
| **Warp** | Grid Warp, Lens Distort, Displace, Dent, Drip, Vortex, **Vector Warp/Vector Transform/Vector Denoise** (v20 optical flow), Coordinate Space. |
| **Optical Flow** | **Optical Flow** (vectors), **Time Speed**, **Time Stretcher**, Repair Frame, Smooth Motion, Tween, Vector Motion Blur. |
| **3D** | **Shape3D**, **Text3D**, **Image Plane 3D**, **Merge3D**, **Camera3D**, **Renderer3D** (Software / OpenGL / OpenGL UV; 21.1 deep motion blur, matte objects), **Light** (Ambient, Directional, Point, Spot, **Dome Light** w/ HDRI (v20 enhanced)), **Transform3D**, Cube3D, Bender3D, Displace3D, Duplicate3D, Extrude3D, FBX Mesh 3D (import FBX/OBJ/Alembic), Replace Material 3D, Material tools (Blinn, Phong, Cook-Torrance, Ward, Reflect, Channel Boolean, Texture2D, Catcher, Stereo Mix), Point Cloud 3D, Projector3D, Locator3D, UV Map 3D, Weld3D, Sphere Map, Fog3D, Soft Clip, Ribbon3D, Override3D; Krokodove 3D (Connect 3D, Heightfield Create 3D, Tube Create 3D, 3D Region toolset, sPrimitive — v21/21.1). |
| **Particles** | **pEmitter** (styles: point, blob, brush, line, N-sided, bitmap, 3D geometry), **pRender**, forces: pDirectionalForce, pGravity, pTurbulence, pVortex, pFriction, pBounce, pAvoid, pKill, pSpawn, pFlock, pFollow, pTangentForce, pChangeStyle, pCustom, pImageEmitter, pMerge. |
| **Stereo / VR** | PanoMap, Spherical Stabilizer, LatLong Patcher, Spherical Camera, VR180 (v20), ILPD retarget (v21). |
| **Deep (v20)** | dMerge, dTransform, dResize, dCrop, dRecolor, dHoldout, dToImage. |
| **Miscellaneous** | Auto Domain, Change Depth, Custom Tool, Fields, Frame Average, Keyframe Stretcher, Run Command, Set Domain, Time Speed, Time Stretcher, Wireless Link, **Text Followers**. |
| **Modifiers** | Expression, Shake, Perturb, Path/XY Path, Probe, Follower (per-character animation), Track, Calculation, Offset, Anim Curves, Coordinate Transform, **Fairlight Animator (v21)** — drive animation from audio analysis (amplitude/frequency bands, phonemes for eye/lip). |

### 11.4 Keyframing in Fusion
- Click the **keyframe diamond** next to a parameter (gray→red) to animate. Changing values at other frames auto-creates keys.
- Paths: Center parameters animate along a **motion path** (polyline with Bézier) drawn in viewer; **Displacement** spline controls velocity.
- **Spline Editor**: select splines in left list; edit with Bézier handles; **Ease In/Out** (T key / dialog), **Linear** (L), **Smooth** (S), **Step In/Step Out**, **Reverse**, **Set Loop / Ping-Pong / Relative**, **Time Stretch** (W), **Shape Box** (B), **Zoom to fit** (Cmd/Ctrl+F), **Snap to frame**.
- **Keyframes Editor**: time/offset spreadsheet; drag keys; Time Stretcher for groups; numeric key entry.
- **Expressions** can link any parameter (`=` typed into field).

### 11.5 Fusion workflow on Edit page
- Fusion Titles/Generators/Transitions/Effects (macros) appear as Effects Library items with Inspector controls.
- Right-click clip > **Open in Fusion page**, or **New Fusion Clip** (combine layers).
- **Fusion Composition** generator = blank comp clip.
- **MediaOut node (v20)** previews Color grade in Fusion viewer.
- Fusion clips cache via render cache. Edit-page viewer can show Fusion overlay controls (on-screen handles) for templates.
- **Macro Editor (v21)**: package node groups as reusable tools/templates with exposed inspector controls; publish effect; DRFX multi-template bundles (21.1).

---

## 12. Color Page (Shift+6)

The flagship grading page. All grading is **node-based**: each clip has a node graph; each **Corrector node** contains a full set of palette adjustments (primaries, curves, qualifiers, windows, keys, blur, etc.). The node's output passes to the next.

### 12.1 Layout
| Area | Function |
|---|---|
| **Gallery** (top-left toggle) | Stills (still frames + grade metadata), albums, **PowerGrades** (shared across projects), **Memories** (A–H quick recall), LUT browser (**LUTs** panel), timelines (pull grades from other timelines). |
| **LUTs** panel | Browse LUTs (thumbnails preview on current clip), favorites, apply to node by drag. LUT Manager (21.1 relink missing). |
| **Media Pool** | Same pool. |
| **Clips (Thumbnail timeline)** | Strip of timeline clips with clip number, source TC, version name, track, codec; filters (All/Ungraded/Graded/Flagged/Group/Clip color/Version; **Smart filters**). Right-click: grade versions, groups, flags, render cache, **Update thumbnails**, Add to group, Remove grade, Reset, Copy grade. |
| **Timeline** (mini) | Above thumbnail strip; select clips, track enable. |
| **Viewer** | Grade preview; viewer modes: Normal, **Enhanced** (Opt/Alt+F, bigger), **Cinema** (Cmd/Ctrl+F); **Split-screen** (Cmd+Opt+W / Ctrl+Alt+W; modes: Selected Album, Gallery stills, Selected clips, Versions, Color Mattes, Selected nodes), **Wipe** (Cmd/Ctrl+W toggle; wipe styles horizontal/vertical/mix/alpha/difference/box/venetian), **Highlight** (Shift+H: show qualified/keyed area; Highlight B/W, Difference), **Unmix**, viewer overlays (window outlines, tracking points), **Image wipe/ Reference still** (from Gallery). |
| **Node Editor** (top-right) | Node graph; modes: **Clip** / **Timeline** (timeline-level node graph applies to entire timeline) / **Group Pre-Clip** / **Group Post-Clip** / **Shared**. v21: **layer-list view** (node graph as stacked layer list). Also shows **Key** inputs/outputs, LUT badges, labels, node cache (green/red indicator). |
| **Left palette bar** (center-left, icons) | **Camera Raw**, **Color Match**, **Primaries** (Wheels/Bars/Log), **HDR**, **RGB Mixer**, **Motion Effects**. |
| **Center palettes** (icons) | **Curves**, **Color Warper**, **Qualifier**, **Window**, **Tracker**, **Magic Mask**, **Blur**, **Key**, **Sizing**, **3D**. |
| **Right side panel** | **Keyframes** (per-node keyframe tracks), **Scopes** (Waveform, Parade, Vectorscope, Histogram, CIE chromaticity), **Information** (clip info), **Effects** (OpenFX library + Settings of applied FX), **Lightbox** (separate button: all clip thumbnails in a grid with grades). |
| **Bottom bar** | Shows current clip, frame #, Undo/Redo, **Bypass grades**, **Toggle viewer modes**. |

### 12.2 Left palettes
#### Camera Raw
Per-clip or project decode settings for RAW media (BRAW, R3D, ARRIRAW, CinemaDNG, Canon RAW, Sony RAW, Nikon N-RAW, ProRes RAW, DNG stills v21): **Decode Quality**, **Decode Using** (Camera metadata / Clip / Project), **Color Science**, **Color Space**, **Gamma**, **White Balance** preset/**Color Temp**/**Tint**, **ISO**, **Exposure**, **Saturation**, **Contrast**, **Midpoint**, **Highlight/Shadow Recovery**, **Lift/Gain**, **Sharpness**, **Highlight rolloff**, **Lens correction** (DNG distortion, aberration, shading v21.1). Grading "before the debayer" yields max quality.

#### Color Match
Auto-match clip to a **color chart** (X-Rite ColorChecker Classic/Passport/Video, DSC One Shot, Datacolor SpyderCheckr, etc.): show chart overlay, align to chart in viewer, set **Source gamma**, **Target gamma**, **Target color space**, **Color temp**, **White level**, **Match** button. Produces corrections in the node.

#### Primaries — Color Wheels / Primaries Bars / Log Wheels
| Mode | Controls |
|---|---|
| **Primaries Wheels** | Four wheels: **Lift** (shadows), **Gamma** (midtones), **Gain** (highlights), **Offset** (all — shifts entire signal). Each wheel: color balance puck (drag center), **master wheel** (ring below: luminance/YRGB level), numeric R/G/B/Y fields. Lift/Gamma/Gain are overlapping tonal ranges (classic LGG). |
| **Primaries Bars** | Same LGG/Offset as vertical **Y, R, G, B** sliders per range (useful for per-channel). |
| **Log Wheels** | **Shadow**, **Midtone**, **Highlight**, **Offset** — narrower tonal ranges (log-style, film grading), with **Low Range** and **High Range** controls defining band boundaries. Best for log/Cineon-like grading. |
| **Top row (page 1)** | **Temp** (Kelvin-ish shift), **Tint**, **Contrast**, **Pivot** (contrast center), **Mid/Detail** (local contrast). |
| **Bottom row (page 2)** | **Color Boost** (vibrance-like for low-sat), **Shadows**, **Highlights** (recover), **Saturation**, **Hue** rotation, **Lum Mix** (how much YRGB master affects luma). |
| Auto buttons | **Auto Balance** (A icon), **Shot Match** (right-click clip > Shot Match to this clip), white/black **picker** (eyedroppers: Gain/Lift white balance pick), **Reset** per wheel. |

#### HDR palette (since v17)
- Zone-based wheels: **Black**, **Dark**, **Shadow**, **Light**, **Highlight**, **Specular** (defaults), plus **Global**. Zones are customizable (add zones, set **Range** and **Falloff** per zone in stops relative to middle gray). Each wheel: **Exposure** (stops) and color balance; **Saturation** per zone.
- **Color space and gamma aware** (uses timeline/working space), **Black Offset**, **Temp/Tint** global, **MD (midtone detail)**, **Contrast/Pivot**, **Highlight/Shadow** zone control; **Zone visualization** overlay in viewer.
- Works for SDR too — it's a photographic exposure-based grade tool.

#### RGB Mixer
- Matrix: **Red output** = R/G/B input mix, Green output, Blue output (3×3), **Preserve Luminance** checkbox, **Monochrome** mode (B&W mix: adjust R/G/B contributions for B&W conversion), **Swap channels** buttons (R↔G, G↔B, B↔R), Reset.

#### Motion Effects (S — temporal/spatial NR & motion blur)
| Section | Controls |
|---|---|
| **Temporal NR** | **Frames** (1–5 either side), **Mo. Est. Type** (None/Faster/Better), **Motion Range** (Small/Medium/Large), **Luma/Chroma Threshold** (link), **Motion** threshold, **Blend**. |
| **Spatial NR** | **Mode**: Faster / Better / Enhanced / **UltraNR** (AI, v19); **Radius** (Small/Medium/Large), **Luma/Chroma Threshold**, **Blend**; UltraNR has **Analyze**/strength. |
| **Motion Blur** | **Mo. Est. Type**, **Motion Range**, **Motion Blur** amount (synthetic shutter blur). |

### 12.3 Center palettes
#### Curves (each a separate mode tab)
| Curve | X axis → Y axis | Use |
|---|---|---|
| **Custom** | Input luma/RGB → output; **YRGB** curves (linked or unlinked; edit Y only or each channel); **Soft Clip** (Low/High clip, Low/High soft), **Intensity** per channel, **Lum Mix**; Edit points; spline with **Bézier** option; **Add default anchors** | Contrast, S-curve, channel balance. |
| **Hue vs Hue** | Hue → hue rotation | Shift specific hues (e.g., turn foliage). |
| **Hue vs Sat** | Hue → saturation gain | Desaturate/saturate specific colors. |
| **Hue vs Lum** | Hue → luminance | Darken skies (blue) etc. Can be noisy on compressed media. |
| **Lum vs Sat** | Luma → saturation | Desaturate shadows/highlights. |
| **Sat vs Sat** | Saturation → saturation | Boost low-sat without clipping high-sat (vibrance). |
| **Sat vs Lum** | Saturation → luminance | Darken/lighten saturated colors ("density"/film-look). |
| (Ctrl) | **Color picker**: click in viewer to add points on curve at sampled color; six-vector preset swatches (R, Y, G, C, B, M) to add points; **Input Hue/Sat/Lum** numeric fields per point. | |

#### Color Warper (v17) and **Chroma Warp** (v20)
- **Hue-Saturation** grid warp: mesh over a vectorscope-like polar chart; drag control points to move colors in hue/sat; **pin** points to protect; **Range** selection; **Lum** variant (Chroma-Luma grid: Chroma vs Luma). Resolution of grid adjustable. Tools: Select/Drag, Pin, Unpin, Invert pins, Smooth, Hue/Sat lock axes.
- **Chroma Warp** (v20): single motion color & saturation adjustment; **stroke mode** (drag in viewer to shift a range directionally) and **point-to-point mode** (isolate hue correction); pins protect regions.

#### Color Slice (v19)
- Subtractive-style "density" grading per six vectors + skin: **Red, Yellow, Green, Cyan, Blue, Magenta, Skin** slices with **Hue**, **Saturation**, **Density** controls, plus global **Density** and **Saturation**; Sat Depth. Mimics film-like subtractive color.

#### Qualifier
Secondary keying; generates a matte (key) limiting the node's correction.
| Mode | Controls |
|---|---|
| **HSL** | **Hue** (center, width, soft, symmetry), **Saturation** (low/high, low soft/high soft), **Luminance** (low/high, soft); enable/disable each channel. |
| **RGB** | Red/Green/Blue low/high/soft ranges. |
| **LUM** | Luma only (luminance key). |
| **3D** | Draw strokes in viewer over colors to include (and Shift-stroke to exclude); keys in a 3D color volume; **Despill** option; selectable keying color space. Good for green screens. |
| Picker tools | **Qualifier picker** (eyedropper), **Picker +/-** (add/subtract), **Feather +/-**, **Invert**, **Highlight** toggle (Shift+H). |
| **Matte Finesse** | **Pre-filter**, **Clean Black**, **Clean White**, **Black Clip/White Clip**, **Blur Radius**, **In/Out Ratio**, **Morph Mode** (Shrink/Grow, Opening/Closing) & **Morph Radius**, **Denoise**, **Shadow/Midtone/Highlight** cleanup, **Post-filter**. |

#### Window (Power Windows)
- Shapes: **Linear (rectangle)**, **Circle**, **Polygon**, **Curve** (Bézier freehand), **Gradient**; up to unlimited windows per node; each has **On/off**, **Invert**, **Mask** (subtract mode: makes it an exclusion), **Name**, **Delete**.
- Controls: **Transform** (Size, Aspect, Pan, Tilt, Rotate, Opacity), **Softness** (Soft 1–4 per side for rectangle; inside/outside softness for curves), **Presets** (save shapes), **Combine** (Add/Subtract via window **Mask** toggles and window combine options), on-viewer handles. Curve windows: **Inner/outer soft edges** editable separately.
- Windows can be **tracked** (Tracker palette) and **keyframed**.

#### Tracker
| Mode | Function |
|---|---|
| **Window** | Tracks windows across shot: **Track Forward/Reverse** (Cmd/Ctrl+T forward, Opt/Alt+T reverse), **Pan/Tilt/Zoom/Rotate/3D (perspective)** checkboxes, **Point tracker vs Cloud tracker**, **Interactive mode** (choose/insert own points), **Frame mode vs Clip mode** (manual frame-by-frame keyframes vs tracking whole clip), **IntelliTrack** (AI tracker v19), Graph shows tracking data. Copy/paste track data; **FX** mode for OpenFX tracking. |
| **Stabilizer** | Same as Edit Inspector but more: **Perspective/Similarity/Translation**, **Cropping Ratio**, **Smooth**, **Strength**, **Zoom**, **Camera Lock**; **Stabilize** after tracking. |
| **FX** | Track effect points for OpenFX (e.g., Lens flare position, Patch Replacer). |

#### Magic Mask (S) — Neural Engine
- v2 (Resolve 20) unified: **Point/stroke-based selection** (click points on subject; + and − strokes), **Person** / **Object/Feature** (Features: face, hair, arms, clothing… in v1 Person mode). v2 simplified to single mode with improved tracking & **paint refinement** brushes.
- Controls: **Track forward/back/bidirectional**, **Quality** (Faster/Better), **Matte finesse** (Smart refine, Consistency, Denoise, Clean black/white, Blur radius, In/Out ratio), **Show overlay**, **Invert**. Produces a matte for node. v21: **render Magic Mask as an external matte**. Available in Fusion (v20.1).

#### Blur / Sharpen / Mist
| Mode | Controls |
|---|---|
| **Blur** | Per-channel **Radius** (R/G/B link), **H/V ratio**, **Scaling**; Radius 0.5 = neutral; above blurs, below sharpens. |
| **Sharpen** | Radius < neutral, **Scaling**, **Coring Softness**, **Level** (threshold to avoid sharpening noise). |
| **Mist** | Diffusion/bloom effect: Radius, H/V ratio, Scaling, **Mix**. |

#### Key palette
- Controls the node's **key** (combined matte from qualifier/windows/magic mask/external key): **Key Input** (Gain, Offset/Clip), **Qualifier** contribution, **Key Output** (Gain, Offset), **Invert**, **Mask** (multiply). Shows key mini-viewer. Use with **Outside nodes** and **Key Mixer**.

#### Sizing
| Mode | Function |
|---|---|
| **Edit Sizing** | Same as Edit page Inspector transform (shared). |
| **Input Sizing** | Clip-level sizing (Pan, Tilt, Zoom, Rotate, Width, Height, Pitch, Yaw, Flip, Crop) applied to the clip before output; savable **Input Sizing presets**. |
| **Output Sizing** | Timeline-level output reframe/blanking for all clips (e.g., letterbox). **Output blanking** in Timeline menu. |
| **Node Sizing** | Sizing applied within a specific node (e.g., to shift a portion of image, beauty work). |
| **Reference Sizing** | For Gallery reference stills alignment. |
| Smart Reframe (S) | Also accessible here. |

#### 3D palette (S — stereoscopic)
- Stereo 3D tools: **Convergence**, **Floating windows**, **Auto color match/geometry match** between L/R eyes, **Stereo alignment**, viewer modes (Side-by-side, Anaglyph, Difference, Mono L/R, Stacked). Also Apple Immersive/VR180 (v20/v21).

### 12.4 Right panels
#### Scopes
- **Waveform** (luma/YRGB), **Parade** (RGB/YRGB), **Vectorscope** (with skin-tone indicator line, 75%/100% targets, 2x zoom, **Hue vector targets**), **Histogram**, **CIE Chromaticity** (gamut triangles: Rec.709/P3/2020; shows clipping), options: **Low pass filter**, **Show reference levels**, **Scope color/brightness**, **Extents**, **Focus (qualify) on window area**, **HDR scale (nits)**, 1-up/2-up/4-up layout; **External scopes** via video output. **Scope LUT** (show in output space).
#### Information panel
Clip info: source TC, codec, resolution, frame rate, data level, color space, timeline TC, version.
#### Keyframes panel
- Per clip: **Master** track and per-node tracks (with sub-tracks: Corrector, Sizing, Windows, Qualifier, Blur, OFX etc.). Keyframe types: **Dynamic** (interpolated dissolve between grades; adjustable dissolve curve "Dynamic attributes"), **Static** (hard change at frame). Auto-keyframe mode per track (record any change). Copy/paste keyframes.
#### Effects (OpenFX)
- Resolve FX library; apply to nodes (creates OFX node badge) or as standalone "Effect" node; settings panel.

### 12.5 Node types & graph
| Node | Shortcut | Behavior |
|---|---|---|
| **Corrector (Serial) node** | Opt/Alt+S (add after), Shift+S (add before) | Standard; output of previous node feeds this; RGB input & key input. |
| **Parallel node** | Opt/Alt+P | Inserts a **Parallel Mixer** — multiple nodes all receive the same input and outputs are **blended (averaged/mixed equally)**; good for independent secondary corrections that shouldn't stack. |
| **Layer node** | Opt/Alt+L | Inserts a **Layer Mixer**: nodes stacked like layers — **bottom input has priority** (lower input composited over upper); supports **Composite modes** (right-click Layer Mixer → Composite Mode: Add, Multiply, Screen, Overlay, etc.). Used for keyed layers that override. |
| **Outside node** | Opt/Alt+O | New serial node whose key is the **inverse** of the selected node's key (for grading outside a window/qualifier). |
| **Splitter/Combiner** | Right-click > Add Splitter/Combiner node | Splitter separates R, G, B channels into three nodes; Combiner recombines — per-channel processing (e.g., channel-specific noise/blur). |
| **Key Mixer** | Right-click > Add Key Mixer | Combines multiple keys (Add/Subtract/Intersection by key input invert/mask settings) into one matte to feed a node's key input. |
| **Shared node** | Right-click > Save as Shared Node | Node instance shared across clips; editing one updates all (e.g., log-to-709 CST shared). Lock. |
| **Compound node** | Right-click > Create Compound Node | Collapses multiple nodes into one visually; expand to edit. |
| **Effect/OFX node** | Drag OpenFX into graph | Node dedicated to a Resolve FX. |
| **Alpha output** | Node Editor right side blue output | Connect a node key to clip alpha output (transparent areas for compositing on Edit timeline). |
| **Source/Input** | Green square left = clip input; right = **RGB output**; extra **External matte** input (Mattes from Media Pool) and **Key inputs/outputs** (blue triangles) connectable. |
| **Node operations** | | Node label, **color space/gamma per node** (right-click > Node Color Space/Gamma: process this node in e.g. HSL/YUV/Lab or Linear gamma), **Channel selection** (process only some channels), **Enable/Disable node** (Cmd/Ctrl+D), **Bypass all** (Shift+D), **Node cache** (right-click > Node Cache: Auto/On/Off), **Reset node grade** (Shift+Home), **Reset all grades and nodes** (Cmd/Ctrl+Home), **Lock node**, **Merge node**. |
| **Node graph levels** | | **Clip**, **Group Pre-Clip**, **Group Post-Clip** (groups), **Timeline** (applies to whole timeline after clip grades), **Shared**. Each its own graph. |
| **Layer-list view (v21)** | | Alternative display of node graph as a list (layers), friendlier for photo/NLE users. |

**Node graph order (per clip)**: Group Pre-Clip → Clip → Group Post-Clip → Timeline.

### 12.6 Versions, groups, stills, copy grades
| Feature | Function |
|---|---|
| **Local versions** (per clip, per timeline) vs **Remote versions** (per source clip, follow the clip into any timeline) | Right-click thumbnail > Local/Remote Versions > Create New Version / Load / Rename / Delete. Shortcut Cmd/Ctrl+Y creates a new local version. Versions (A, B, C …) for client options. Default for timelines: Use local grades (since v?) — set in timeline settings ("Use local grades/Use remote grades"). |
| **Grade versions for group grading (v21)** | Versions at group level. |
| **Groups** | Select clips > Right-click > Add into new group: unlocks Group Pre-Clip and Group Post-Clip graphs for shared grading across shots (e.g., same camera, same scene). |
| **Gallery stills** | **Grab Still** (Cmd/Ctrl+Opt/Alt+G): saves frame + full grade. Use: wipe compare (Cmd/Ctrl+W), **apply grade** (middle-click still on clip or right-click > Apply Grade), Apply grade without/with sizing, Append node graph. Albums; **PowerGrade** albums shared across projects; **Memories** (Opt/Alt+1–8 save, Cmd/Ctrl+1–8 recall), export stills as DPX/TIFF/JPG/PNG/EXR + .drx grade file; import .drx. **Gallery split-screen** compare. |
| **Copy grades** | **Cmd/Ctrl+C / V** on thumbnails; **Middle-click** (apply grade from clip under cursor); **=** (apply grade from one clip prior), **-** (from two clips prior); **Append node graph**; **Ripple** changes to selected clips (ripple node changes: Exact values / % change / absolute). |
| **Lightbox** | Grid of all clip thumbnails with grades; select & filter; v21 Photo page Lightbox. |
| **Color Trace** | Copy grades between timelines by matching source. |
| **LUTs** | Apply LUT to node (right-click node > LUT > category > LUT), Generate 3D LUT from node (Cube/Panasonic VLUT) — export grade as LUT, **Generate LUT (17/33/65 point)**; DCTL (DaVinci CTL) custom shaders (21.1 validate/encrypt DCTL via API). |
| **CST / Color Space Transform** | Resolve FX for explicit conversions: Input/Output Color Space & Gamma, Tone mapping method (None/Simple/Luminance/DaVinci/Saturation preserving), Gamut mapping (None/Saturation compression), Forward/Inverse OOTF, Use white point adaptation. |
| **Timeline node graph & Color management** | Timeline grade applies post all clips. |
| **Render cache Color output** | Right-click thumbnail. |
| **Dolby Vision / HDR10+ analysis (S)** | Color > Dolby Vision > Analyze all shots, trim controls; MultiMaster trims (v21, individual trims 21.1). |
| **Flags, clip colors, markers** on Color page | same. |
| **Remote grading / Live grade (S)** | Grading over network; Color page streaming to remote monitor (v20: overlays on reference monitor, H.265 4:2:2 streaming). |
| **Film Look Creator (v19)** | Resolve FX simulating film stock: Halation, Bloom, Grain, Gate weave, Vignette, Split tone, Print stock. |
| **Color Compressor, Contrast Pop, Dehaze, Beauty, Face Refinement, Relight, Depth Map, CineFocus, Face Age/Reshaper/Blemish (v21)** | Resolve FX used inside nodes. |

### 12.7 Typical node tree convention
1. Denoise (UltraNR/Temporal NR) — before anything.
2. Input CST (if manual YRGB) / RCM handles.
3. Exposure/balance (Primaries/HDR).
4. Contrast/curves.
5. Saturation/color.
6. Secondaries (qualifiers, windows, Magic Mask) in parallel or serial.
7. Look (LUT/Film Look Creator), grain, vignette.
8. Output CST / ODT.


---

## 13. Fairlight Page (Shift+7)

Full DAW for post audio (Fairlight acquired 2016). Runs on the **Fairlight Audio Core** engine (up to 2,000 tracks with Fairlight Audio Accelerator card; native CPU otherwise), **FlexBus** routing architecture.

### 13.1 Layout
| Area | Function |
|---|---|
| **Interface toolbar** | Media Pool, Effects Library, Index (tracks/markers/edit index), Sound Library, **ADR**, Mixer, Meters, Metadata, Inspector, **Voiceover** (v20). |
| **Monitoring panel / Meters** (top) | Track meters for all tracks, **Loudness meter** (Integrated, Short-term, Momentary, Range, True Peak; start/pause/reset; BS.1770/EBU R128/ATSC presets), Control room meter, **Video viewer** (small floating), Bus meters. |
| **Timeline** | Track headers (larger): name, **Record arm (R)**, **Solo (S)**, **Mute (M)**, input assignment, **Automation**, track format, Volume display; clips with waveforms; **fade handles**, **clip gain line**; **Layered audio editing** (View > Show audio track layers: overlapping clips on same track stack as layers, top layer plays). |
| **Toolbar** | Selection (A), Range Selection (R), Edit Selection, Blade (B), Snapping (N), Linked Selection, **Link/Unlink**, Flags/Markers, **Transport** (Record, Play, Stop, Loop, Rewind/Forward, Go to start/end), **Automation toggle**, **Fixed playhead**, Zoom, **Audio waveform zoom**, **Edit tools: Fade In/Out to playhead, Normalize, Elastic Wave (time stretch within clip), Clip gain**. |
| **Mixer** (right) | Full channel strips (see 13.2). |
| **Inspector** | Clip/track settings: Volume, Pan, Pitch, **Elastic wave** (stretch), **Clip EQ (6-band)**, Clip FX, Voice Isolation, Dialogue Leveler, **Clip attributes**. |

### 13.2 Mixer channel strip (top → bottom)
| Section | Function |
|---|---|
| **Input** | Patch input source (hardware input, bus, or "No input"). |
| **Order** | Change processing order of FX/EQ/Dynamics (e.g., FX→EQ→Dyn or Dyn→EQ…). |
| **Effects** (slots) | Insert Fairlight FX / VST / AU / **Chain FX** (v20: up to 6 effects grouped with presets). |
| **EQ** | **6-band parametric** (Band 1: Low cut/HPF, Bands 2–5: bell/shelf/notch, Band 6: high cut/LPF), Freq/Gain/Q per band, graph; on/off. |
| **Dynamics** | **Expander/Gate** (threshold, range, ratio, attack, hold, release), **Compressor** (threshold, ratio, attack, hold, release, **sidechain** from bus/track, **Key listen**, makeup gain), **Limiter** (threshold, attack, hold, release); dynamics sidechain via **Send**. |
| **Pan** | Stereo/2D surround panner (X/Y, Spread, Divergence, LFE, Rotation, Tilt), 3D panner for immersive (Atmos objects). **IntelliTrack panning** (v19). |
| **Bus Sends / Bus Outputs** | Send levels to Aux buses (pre/post fader). Assign **Bus outputs** (main/submix/aux). |
| **Group** | VCA/group assignment. |
| **Mute/Solo/Record** | |
| **Fader** | dB level, automation mode selector (Read/Write/Touch/Latch/Snap/Trim). |
| **Name** | |

### 13.3 Bus routing (FlexBus)
- **Fairlight > Bus Format** (Bus Format dialog): create **Main** (master, e.g., Main 1 stereo/5.1/7.1/Atmos), **Submix**, **Aux** buses (any format); buses can feed other buses (FlexBus allows bus-to-bus, arbitrary depth). **Bus Assign** window to route tracks.
- **Patch Input/Output** (Fairlight > Patch Input/Output): matrix connecting sources (hardware inputs, tracks, buses, **Oscillator**) to destinations (tracks, buses, hardware outputs).
- **Track > Output Track** etc. Each Main can be rendered separately in Deliver ("Render Main 1/2…").
- **Immersive**: Dolby Atmos (internal renderer; ADM BWF export), Auro-3D, MPEG-H, Sony 360 Reality Audio, Apple Spatial Audio (v20.1).
- **VCA groups**, **Spill** of buses, **Link groups** (link tracks for gang control).

### 13.4 Automation
- Per parameter (fader, pan, mute, EQ, FX params). Modes: **Off**, **Read**, **Touch** (writes while touching, returns to prior), **Latch** (writes while touching and holds last value until stop), **Write** (overwrite), **Snap** (returns instantly), **Trim** (relative offset to existing automation), **Preview**. v20: per-channel automation modes (Snap/Latch/Trim mixed in one pass).
- Automation toolbar: enable automation, **Automation follows edit**, **Show automation** curve in timeline lanes; draw/edit keyframes.

### 13.5 ADR
- **ADR panel**: **List** (cue list: in/out TC, character, line text; import CSV), **Record** (pre-roll, post-roll, **beeps** (3 beeps countdown), on-screen **cue streamer/visual countdown**, record takes to designated track/layers), **Setup** (character list, record track, pre/post roll, beeps, guide track, loop count). **Take Ratings** (stars), Take Selector to choose take. IntelliCut can create ADR cue lists automatically (v20).

### 13.6 Voiceover (v20)
Voiceover palette/tool on Cut/Edit/Fairlight: file name, input selection, destination track (auto-created), **countdown**, input monitoring, **teleprompter script** scroll.

### 13.7 Fairlight FX list (built-in)
| FX | Purpose |
|---|---|
| **Chorus** | Modulated delay chorus. |
| **De-Esser** | Reduce sibilance (frequency, range, reduction). |
| **De-Hummer** | Remove 50/60 Hz hum + harmonics. |
| **Delay** | Stereo delay with feedback/filters. |
| **Dialogue Processor** | All-in-one dialogue chain (de-ess, de-hum, compressor, EQ, exciter). |
| **Dialogue Leveler** (v19) | Auto-leveling of speech; Reduce background, Boost/Reduce. |
| **Dialogue Separator** (S, v18.6) | Splits clip into Voice / Background / Ambience with independent levels. |
| **Distortion** | Saturation/distortion. |
| **Ducker** (track FX, v19) | Auto-duck music/BG under dialogue sidechain. |
| **Echo** | Echo/delay. |
| **Flanger** | |
| **Foley Sampler** | Sample-based foley performance (trigger from keyboard/MIDI). |
| **Frequency Analyzer** | Spectrum display. |
| **Limiter** | Brickwall/true-peak limiter. |
| **Meter** | Metering plugin. |
| **Modulation** | Tremolo/vibrato. |
| **Multiband Compressor** | 4-band compressor. |
| **Noise Reduction** | Learn/auto noise profile spectral NR (speech mode/manual). |
| **Phaser** | |
| **Pitch** | Pitch shift. |
| **Reverb** | Algorithmic reverb (room size, decay, early reflections, damping). |
| **Soft Clipper** | Gentle clip. |
| **Stereo Fixer** | Fix channel issues (L/R swap, phase, mono). |
| **Stereo Width** | |
| **Surround Analyzer** | |
| **Vocal Channel** | Channel strip for vocals (HPF, EQ, compressor). |
| **Voice Isolation** (S) | AI: isolates voice from noise/music (amount). |
| **Music Remixer** (S, v18.6) | AI splits music into **Voice, Drums, Bass, Guitar, Other** stems with level per stem. |
| **Voice Convert** (S, v20) | AI voice model conversion. |
| **EQ** and **Gain** (v20) | Now as FX plugins too. |
| **Chain FX** (v20) | Container for up to 6 FX with presets. |
| **Fairlight FX Reverb/Delay legacy** | |
| **Spatial/Binaural** renderers | Immersive. |
| Legacy: **Fairlight FX Chorus, Echo…** plus third-party VST3/AU. |

### 13.8 Other Fairlight features
| Feature | Function |
|---|---|
| **EQ Match** (v20) | Match target clip's tonal spectrum to a reference clip; dynamic across the clip. |
| **Level Matcher** (v20) | Match clip levels to reference clips. |
| **AI Dialogue Matcher** (v20, S) | Match tone, level & room character between dialogue clips (e.g., lav vs boom, different rooms). |
| **AI Audio Assistant** (v20, S) | "AudioAssist": analyzes the timeline, **organizes tracks** (dialogue/music/effects categorization), balances dialogue, adjusts music/effects, applies EQ/dynamics, creates a **mastered mix** to a delivery loudness target in one click. |
| **AI Music Editor / Music Extender** (v20, S) | Lengthen/shorten a music cue to match video duration, offering four alternatives; 21.1 retains more content, avoids repetition. |
| **AI Detect Music Beats** (v20) | Places beat markers; snap clips to beats. |
| **AI IntelliCut** (v20, S) | Remove silences, checkerboard/split dialogue by speaker onto separate tracks, create ADR cue lists from transcript. |
| **AI audio classification** (v18.5) | Auto-tag clips as Dialogue/Music/Effects. |
| **Folder tracks** (v21) | Group tracks into collapsible folders. |
| **Fairlight Animator** (v21, Fusion modifier) | Drive Fusion animation from audio. |
| **Elastic Wave** | Time-stretch audio within clip (warp markers). |
| **Clip gain / Normalize** | |
| **Track layering** | Multiple layers per track; top layer audible. |
| **Range selection** & **Edit selection** | Cut/copy within ranges across tracks. |
| **Fixed playhead mode** | Timeline scrolls under fixed playhead. |
| **Loudness measuring/render with loudness normalization** | Deliver audio normalization options. |
| **32-bit float recording** (v20.1) | |
| **Fairlight consoles & Desktop Console/Audio Editor** hardware support. | |
| **Sound Library** with 500+ free Blackmagic SFX. | |
| **Patching & Input monitoring**, **Oscillator** (tone/pink noise, Fairlight > Oscillator). | |
| **Dialogue: Clip-level Voice Isolation and Dialogue Leveler toggles** in Inspector. | |

---

## 14. Deliver Page (Shift+8)

### 14.1 Layout
| Area | Function |
|---|---|
| **Render Settings** (left) | Preset tiles + settings tabs: **Video**, **Audio**, **File**. |
| **Viewer** (center) | Preview render range. |
| **Render Queue** (right) | Jobs list; **Render All**; per job: project, timeline, format, location, estimated time; edit/delete; job status; render with **remote rendering** (S). Queue spans projects (Show all projects). |
| **Timeline** (bottom) | Full timeline with **Render range: Entire Timeline / In/Out Range**; set I/O on ruler. |

### 14.2 Presets (render settings tiles)
**Custom Export**, **H.264 Master**, **H.265 Master**, **HyperDeck**, **ProRes 422 HQ** (Mac/Win), **YouTube** (720p/1080p/2160p, auto upload), **Vimeo** (720/1080/2160), **TikTok** (1080×1920; upload), **Twitter/X**, **Dropbox**, **Box**, **Frame.io**, **Presentations** (Blackmagic Cloud), **Audio Only**, **IMF** (S; Netflix IMF, etc.), **DCP/Kakadu DCP** (S), **Final Cut Pro (XML + media)**, **Premiere XML**, **AVID AAF**, **Pro Tools AAF**, **Apple Immersive/Vision Pro** (S), **VR180/VR360** (v21). Users save **custom presets** (Save as New Preset); export/import presets (21.1 add to Quick Export).

Upload presets require signing in under Preferences > Internet Accounts; options: Title, Description, Privacy (Public/Unlisted/Private), Category, **Upload directly to YouTube/Vimeo/TikTok/X**, Upload chapters from markers.

### 14.3 Render mode
- **Single clip**: entire timeline (or range) rendered as one file.
- **Individual clips**: each timeline clip rendered as a separate file (for conform/VFX/grading round-trip). Options: **Render at source resolution**, **Use unique filenames**, **Filename uses: Source Name / Custom name / Timeline name / Source reel**, **Add handles of N frames**, **Render clips with timeline TC vs source TC**, **Export alpha**, **Use subfolders**. Filters: **Render Video/Audio only**.

### 14.4 Video tab
| Setting | Options |
|---|---|
| Export Video | on/off |
| **Format** | QuickTime (.mov), **MP4**, MXF OP1A, MXF OP-Atom, AVI, DCP (Kakadu S), IMF (S), DPX, EXR (21.1 HTJ2K), TIFF, PNG, JPEG 2000, **GIF**, **WebM** (VP9/AV1), Cineon, **Wave** (audio only), BRAW (Blackmagic RAW render), AVC/HEVC etc. |
| **Codec** | **H.264**, **H.265 (HEVC)**, **AV1** (S hardware/where supported), **Apple ProRes** (422 Proxy, LT, 422, HQ, 4444, 4444 XQ; Windows encode supported since v17), **DNxHR/DNxHD** (LB, SQ, HQ, HQX 10-bit, 444), **GoPro CineForm**, **Uncompressed 8/10/16-bit**, **QuickTime Animation**, **Blackmagic RAW**, **JPEG2000**, **VP9**, **Avid DNxUncompressed**, **XAVC** (Intra/Long GOP), **XDCAM**, **AVC-Intra**, **XF-AVC**, **H.264 422/10-bit (S)**. |
| Type | e.g. HQ / HQX; Encoder: **Auto / Native (software) / NVIDIA / Apple VideoToolbox / Intel QuickSync / AMD**. |
| **Network optimization** | moov atom at start (fast-start for streaming). |
| **Resolution** | Presets & Custom; **Use vertical resolution**; Output can differ from timeline (uses Output Scaling / Mismatched setting). |
| **Frame rate** | Defaults to timeline fps; rendering at a different fps converts using the project's Frame Interpolation settings. |
| **Quality** | **Automatic** (Best/High/Medium/Low/Least) or **Restrict to X Kb/s**; **Encoding profile** (Main/High/Main10/Main 4:2:2 10), **Keyframes** (Automatic/Every N frames), **Frame reordering**, **Rate control** (CBR/VBR/Constant quality), **Entropy mode**, **Multi-pass encode**, **Lookahead**, **Bitrate for 2 pass**. |
| **Field rendering**, **Chroma subsampling**, **Bit depth** | |
| **Data Levels** | Auto / Video / Full. |
| **Color Space Tag / Gamma Tag** | Same as Project / Rec.709 / Rec.2020 / P3 / etc.; tags for NCLC (QuickTime) or VUI (H.264/HEVC). |
| **HDR10 metadata, Dolby Vision metadata** (S) | |
| **Advanced Settings** | **Pixel aspect ratio**, **Data burn-in** (per job), **Force sizing to highest quality**, **Force debayer to highest quality**, **Use optimized media**, **Use proxy media**, **Use render cached images** (huge speedup), **Disable sizing and blanking output**, **Enable flat pass** (render without grade: Off/On/Hidden), **Bypass re-encode when possible** (smart render for ProRes/DNx/H.264 matching settings — renders only changed frames, **Smart Render**), **Add N frame pre-roll**, **Start timecode**, **Embed timecode**, **Set to bypass re-encode**, **Render with GPU**, **Upload to cloud**. |
| **Subtitle Settings** | **Export subtitle**: off / **As a separate file** (SRT/WebVTT/TTML/IMSC/DFXP; per track), **Burn into video**, **As embedded captions** (CEA-608 in MOV/MXF/MP4; 21.1 multiple embedded captions). |

### 14.5 Audio tab
Export audio on/off; **Codec**: Linear PCM, AAC, MP3 (audio-only renders), Opus (WebM), Dolby Digital/AC-3 and Dolby Digital Plus (where licensed); **Sample rate**; **Bit depth** (16/24/32); **Bitrate** (AAC kbps); **Output track** mapping: Main 1 / Bus / Timeline tracks (individual tracks as channels), **Number of channels/Tracks**; **Render one track per channel**; **Audio normalization** (Normalize to target loudness: EBU R128/ATSC/custom LUFS, True peak); **Render Dolby Atmos (ADM BWF)**; **Spatial/immersive**.

### 14.6 File tab
**Filename uses** (Custom name / Timeline name / Source name), **Custom name** with tokens (`%{Timeline Name}`, `%{Clip #}`, `%{Source Name}`, `%{Reel Name}`, date, etc.), **Location** browse, **Use unique filenames: Prefix/Suffix**, **File subfolder**, **Each clip starting frame**, **Image sequence start frame**, **Use subfolders per clip**, **Preserve source directory levels**.

### 14.7 Render queue behavior
- **Add to Render Queue** (button) creates job snapshot; **Render All** processes sequentially; jobs can come from other projects (**Show All Projects**); job edits by clicking pencil; **Remote rendering** (S) sends to other workstations sharing a Project Server library; **Background rendering**; render progress shows time remaining & fps; post-render actions via scripts ("Trigger script at end of render").
- **Quick Export** (File > Quick Export; Cut page button): presets (H.264/H.265/ProRes/YouTube/Vimeo/TikTok/X/Box/Dropbox/Frame.io/Presentations) — one dialog, no queue.
- **Render in Place** and **Render Cache** are separate from Deliver.

---

## 15. Photo Page (v21)

New in Resolve 21 — a Lightroom-style still photography page leveraging the Color engine.
| Feature | Details |
|---|---|
| **Albums/Collections** | Build & manage photos at source resolution; tagging, favorites, star ratings, flags, clip color; filtering by graded/ungraded, rating, flag, color. **Lightroom catalog import**. |
| **RAW support** | Camera RAW for stills (Canon, Sony, Nikon, Fuji, DNG…), 21.1 post-decode sharpening, per-parameter reset, DNG lens corrections. Hardware HEIC decode on Apple Silicon (21.1). |
| **Grading** | Full node-based Color grading on stills (serial/parallel nodes, Magic Mask, qualifiers, windows), Looks/LUTs/Resolve FX/OpenFX on images; shared nodes across an album; inspector color panels (21.1); Sky Replacement FX on album photos (21.1). |
| **Reframe & Crop** | At original resolution/aspect (independent of timeline). |
| **LightBox** | View entire album with grades, live grading updates across collection. |
| **Tethering** | Direct capture from **Sony, Canon** (21.0), **Fujifilm, Leica, Sony A7R VI** (21.1, S): live view, control ISO/exposure/WB, **capture presets**. |
| **Collaboration** | Blackmagic Cloud for Photo page. |
| **Export** | Still formats (JPEG/TIFF/PNG/EXR, etc.) at source resolution. |

---

## 16. DaVinci Neural Engine / AI Feature Catalogue (verified for 20 / 21 / 21.1)

Nearly all are **Studio-only (S)**. Page = where it lives.

| Feature | Since | Page(s) | What it does |
|---|---|---|---|
| **Magic Mask** (v1 Person/Feature/Object → **v2** unified) | 17 / v2 in 20 | Color, Fusion (20.1), Edit FX | Point/stroke-based object/person segmentation with tracking, paint refinement; produce mattes; render as external matte (21). |
| **Smart Reframe** | 17 | Edit/Cut Inspector, Color Sizing | Auto-reframes for different aspect ratios following subject. |
| **Speed Warp** | 16 | Retime (motion estimation) | AI frame interpolation for high-quality slow motion. |
| **Super Scale** | 17 (2x), 20 (3x/4x) | Clip Attributes | AI upscaling with sharpness/noise controls. |
| **Face Detection / People (Analyze for People)** | 16 | Media Pool | Groups clips by faces, auto smart bins. |
| **Auto Color / Shot Match** | 16 | Color | Auto balance & shot matching. |
| **Voice Isolation** | 18 | Inspector, Fairlight FX | Removes non-voice noise. |
| **Text-Based Editing / Transcription** | 18.5 (Edit/Cut), 19 | Media Pool, Edit/Cut, Inspector | Speech-to-text with speaker detection; edit timeline by selecting/deleting text in the transcript (Insert/Append/Delete selected text; remove silences; search). |
| **Auto Subtitles** (Create Subtitles from Audio) | 18.5 | Timeline menu | Generates subtitle track from speech (language, caption preset Netflix/Default, chars per line, lines, gap). |
| **AI Animated Subtitles** | 20 | Edit/Cut | Animate subtitle words as spoken using Fusion title templates (word highlighting, pop, karaoke styles). |
| **AI IntelliScript** | 20 (Final Draft/plain text in 21) | Edit/Cut | Builds a timeline from a script by matching transcribed clips to lines; best take first, alternates on extra tracks. |
| **AI IntelliCut** | 20 | Fairlight/Edit | Remove silence, checkerboard dialogue by speaker, ADR cue lists. |
| **AI Multicam SmartSwitch** | 20 | Edit/Cut (multicam) | Auto-cuts multicam angles to active speaker by audio + lip movement. Scriptable (21.1). |
| **AI Audio Assistant** | 20 | Fairlight/Edit | Auto-organize, balance, and master mix. |
| **AI Dialogue Matcher** | 20 | Fairlight | Match tone/level/room. |
| **AI Music Editor / Extender** | 20 | Edit/Fairlight | Retime music to length (4 options). |
| **AI Detect Music Beats** | 20 | Edit/Fairlight | Beat markers, snapping. |
| **AI Voice Convert** | 20 | Inspector/Fairlight FX | Voice model conversion (built-in & trainable models). |
| **AI Speech Generator** | 21 | Fairlight/Edit | Text-to-speech; clone a voice from ~10 s sample; speed, pitch, inflection. |
| **Music Remixer** | 18.6 | Fairlight FX | Stem separation. |
| **Dialogue Separator** | 18.6 | Fairlight FX | Voice/background/ambience separation. |
| **Audio classification** | 18.5 | Media Pool/Fairlight | Dialogue/music/effects tagging. |
| **Ducker** (track FX) | 19 | Fairlight | Auto ducking. |
| **Dialogue Leveler** | 19 | Inspector/Fairlight | Auto level. |
| **IntelliTrack** | 19 | Fusion/Color Tracker/Fairlight panning | AI point tracking and audio pan-to-object. |
| **UltraNR** | 19 | Color Motion Effects | AI spatial noise reduction. |
| **Relight** | 18.5 | Resolve FX | Virtual light sources using surface normals (Directional/Point/Spot). |
| **Depth Map** (v2 in 20) | 18 | Resolve FX | Generates depth matte for fog/blur/isolation. |
| **Object Removal** | 17/18 | Resolve FX | Removes objects with temporal fill (tracked). |
| **Face Refinement** | 15/16 | Resolve FX | Face tracking for skin smoothing, eye/lip/blush, face reshaping (basic). |
| **Set Extender** | 20 | Resolve FX | Fill frame gaps / generate backgrounds from text prompt (generative). |
| **Surface Tracker** | 18 | Resolve FX/Fusion | Deforming surface tracking. |
| **Scene Cut Detection** | old | Media/Edit | Shot change detection. |
| **Boring Detector, Close Up** (face detect) | 16 | Cut | Analysis/punch-in. |
| **AI IntelliSearch** | 21 | Media Pool | Search media by people/faces/objects/dialogue keywords. |
| **AI SlateID** | 21 | Media | Read slate → metadata. |
| **AI CineFocus** | 21 | Resolve FX (Color/Edit) | Refocus: set focal point, aperture, focal range, keyframe rack focus; 21.1 natural-effect & high-precision options. |
| **AI Face Age Transformer** | 21 | Resolve FX | Age/de-age faces. |
| **AI Face Reshaper** | 21 | Resolve FX | Reshape facial features on moving subjects. |
| **AI Blemish Removal** | 21 | Resolve FX | Skin imperfections removal. |
| **AI UltraSharpen** | 21 | Resolve FX | Sharpen upscaled/soft footage, fix slight misfocus. |
| **AI Motion Deblur** | 21 | Resolve FX | Remove motion blur streaks (slo-mo, freeze frames). |
| **MCP server / AI assistant integration** | 21.1 | App-level | Lets external assistants (Claude, Claude Code, ChatGPT Codex) drive Resolve via MCP + scripting API: analyze projects, organize media, adjust settings, batch render, make highlight edits. |
| **Transcription API (speaker/timing)** | 21.1 | Scripting | |

> There is **no** "AI Relight 2" or generative video model beyond Set Extender (prompt-based background fill) as of 21.1; Resolve's AI emphasis is assistive (analysis, masking, audio) rather than generative.


---

## 17. Cross-Page Workflows & Systems

### 17.1 Multicam
| Step / Feature | Details |
|---|---|
| **Create** | Media Pool: select clips → right-click **Create New Multicam Clip Using Selected Clips**. Dialog: name, start TC, **Angle Sync**: **Timecode / Sound (waveform) / In points / Out points / Markers**, **Angle Name**: Camera # metadata / clip name / angle metadata / sequential, **Detect clips with same camera angle** (multiple clips per angle placed sequentially by TC), **Move source clips to "Original Clips" bin**, Audio: use all angles' audio or specific. |
| **Edit** | Put multicam clip on timeline. Source viewer → **Multicam** mode shows grid (2×2 up to 5×5; 21.1 grid changes keep angle). Click angle while playing: **cut** (blade + switch). Modes at the viewer bottom: **Audio & Video**, **Video only**, **Audio only**. Holding Opt/Alt-click = **switch** current segment without cutting. Number keys (with multicam mode) / Speed Editor cam keys. 21.1: multicam mode is a timeline viewer property; shortcuts switch/cut up to 25 angles; decompose shortcut. |
| **Open multicam clip in timeline** | Right-click > Open in Timeline: edit angles' sync/content (each angle is a track). |
| **Flatten / Decompose** | Right-click > **Flatten Multicam Clip** (replace with active angle source) / Decompose in place. Scriptable (21.1). |
| **Switch angle later** | Right-click segment > **Switch Multicam Clip Angle** > choose. |
| **AI Multicam SmartSwitch** (20, S) | Auto-cut by active speaker. |
| **Cut page alternatives** | **Sync Bin** and **Multi-source**, no multicam clip needed. |
| **Color page** | Multicam segments grade on the source angle's clip; color with "Use remote grades" consistency. |

### 17.2 Proxies & Optimized Media
| Type | How | Behavior |
|---|---|---|
| **Proxy media** (v17+ new system) | Right-click clips > **Generate Proxy Media**; or **Blackmagic Proxy Generator** app (watch folders, creates `Proxy/` subfolder next to camera originals); or link external proxies (**Link Proxy Media**, auto-relink from `Proxy` subfolder). Format/res in Project Settings > Master Settings. | Separate files (ProRes/DNxHR/H.264/H.265); **portable** (can share with remote editors, link back to originals); **Playback > Prefer Proxies / Prefer Camera Originals / Disable All Proxies**; render can choose (Deliver: "Use proxy media" — default off so renders use originals). Proxy indicator in Media Pool column. Can unlink. 21.1: AI tools use proxies when originals offline (pref). |
| **Optimized media** (legacy, internal) | Right-click > **Generate Optimized Media**; stored in Cache folder; **Playback > Use Optimized Media If Available**. | Resolve-managed, not portable; HDR/RAW friendly (Uncompressed/DNxHR 444 options). "Optimized media" setting "Choose automatically". |
| **Timeline Proxy Resolution** | Playback > Timeline Proxy Resolution > Full/Half/Quarter | Real-time decode at lower res (not files). |
| **Performance mode** | Preferences > User > Playback; **Playback > Proxy Handling** | |

### 17.3 Render Cache
| Mode (Playback > Render Cache) | Behavior |
|---|---|
| **None** | Off. |
| **Smart** | Automatically caches computationally intensive things: transitions, composite, opacity, speed effects (optical flow), Fusion effects, OpenFX, color nodes with NR; cache bar above the timeline ruler turns **red** (needs caching) → **blue** (cached). Background caching starts after N seconds idle. |
| **User** | Only what you flag: right-click clip > **Render Cache Color Output** / **Render Cache Fusion Output** (Auto/On/Off) / **Node Cache** per node (Color page; caching upstream nodes so tweaking downstream is fast) . |
| **Cache format** | Project Settings (ProRes/DNxHR/Uncompressed); location in Preferences Media Storage. |
| **Deliver** | "Use render cached images" reuses cache for faster renders. Playback > Delete Render Cache > All/Unused/Selected. |
| Timeline indicator | Thin bar: red = uncached heavy, blue = cached, none = realtime. |

### 17.4 Compound clips, Fusion clips, nested timelines
- **Compound Clip**: Right-click selection > **New Compound Clip** (name, start TC): collapses multiple clips/tracks into a single clip; stored in Media Pool; editable via **Open in Timeline** (opens as nested tab); **Decompose in Place** reverses. Grades: applied to the compound as a whole (can also grade inner clips by opening). Compound clips are fixed resolution of timeline.
- **Nested timeline**: drag a **timeline** from Media Pool into another timeline — it becomes a nested timeline clip (live link). Right-click > Open in Timeline / Decompose.
- **Fusion Clip**: Right-click > **New Fusion Clip** — clips become MediaIns in one Fusion comp.
- **Multicam clip** (see above), **Take selector** (alternate takes stack).

### 17.5 Timelines/Sequences management
- Multiple timelines per project; **timeline tabs** (stacked timelines option), **duplicate timeline** for versions, **Timeline backups** (collab; restored backups keep history, 21.1), **compare timelines** (diff & merge), **import/export** (AAF/XML/FCPXML/EDL/OTIO/DRT), **Timeline settings** per timeline (resolution, fps chosen at creation; output scaling, monitoring and color settings when not using project settings).
- **Timeline frame rate cannot be changed after creation**; resolution can.
- **Timeline start TC** default 01:00:00:00.
- **Subtitle/caption tracks**, **Video/audio tracks** unlimited.

### 17.6 Collaboration
| Mode | Details |
|---|---|
| **Blackmagic Cloud** (v18) | Cloud project library hosted by Blackmagic; invite collaborators (by email); each user's media is local/synced (Blackmagic Cloud Store, Dropbox, Google Drive sync; **cloud folders** v20 with virtual clips); changes propagate on save (live save). |
| **Project Server** (local network, PostgreSQL; 21.1 bundles PostgreSQL 18) | Free app hosting network libraries. |
| **Multi-user collaboration (S)** | Right-click project > Enable Collaboration. Users can work simultaneously on different pages (editor, colorist, VFX, audio). **Bin locking** (first to open bin gets write access; others read-only), **Timeline locking** (each timeline editable by one user; others can view), **Clip locking** for grades (colorist owns grade; editor sees updates on "Refresh"), **Compare and merge timelines**, **Chat** panel, **Collaboration Updates** (refresh icon to pull changes). |
| **Presentations** (Cloud review) | Share timeline playback with clients via web URL (guest access v20), **timecoded comments/markers**, annotations/replies/status (21.1), group chat; presentation export with subtitles (21.1). |
| **Remote grading (S)** | Control another Resolve's Color page over internet. |
| **Remote monitoring** | Stream viewer to Resolve/HyperDeck/iPad (Studio); v20: overlays + H.265 4:2:2. |
| **Power Bins**, **PowerGrades** shared across projects. | |
| **Dropbox Replay/Frame.io integration** | Frame.io comments as markers (sync). |

### 17.7 Keyframing (consolidated)
| Page | Mechanism |
|---|---|
| Cut/Edit | Inspector diamonds; per-clip keyframe track & curve editor; **Keyframe tray/editor** (v20) with curve view, parameter modes, ease controls; 4-point Bézier retime (v21). Interpolation: Linear, Ease In, Ease Out, Ease In & Out, Hold (static). Dynamic Zoom = start/end rectangles without keys. Retime curves. Audio level keyframes (Opt/Alt-click line). |
| Fusion | Per-parameter splines, Spline Editor, Keyframes Editor, modifiers/expressions, motion paths. |
| Color | Keyframes panel (Dynamic vs Static keyframes per node attribute track), auto-keyframe; tracker data for windows. |
| Fairlight | Automation (Read/Touch/Latch/Write/Trim/Snap), drawn automation curves, clip gain keyframes. |

### 17.8 Subtitles & Captions
| Feature | Details |
|---|---|
| **Subtitle tracks** | Timeline > Add Subtitle Track; each track = language/caption format (name e.g., "English"). Subtitle clips (text, duration) edited in Inspector: **Caption** tab (text, position) & **Track** style tab (font, size, color, background/box, stroke, drop shadow, position presets, **Caption format: Subtitle / 608 / 708 / Teletext**). |
| **Create subtitles from audio** (S) | Timeline > Create Subtitles from Audio: Language (auto/English/Spanish/…), **Caption preset** (Subtitle Default / Netflix), **Characters per line**, **Lines** (single/double), **Gap between subtitles**. Uses transcription. |
| **AI Animated Subtitles** (v20, S) | Apply animated Fusion caption templates to subtitle track (word-by-word highlight). |
| **Import** | SRT, WebVTT, TTML/DFXP/IMSC, SCC (608), EBU STL; drag to timeline. |
| **Export** | Right-click subtitle track > Export Subtitle (SRT/WebVTT/TTML/DFXP); Deliver: separate file / **burn-in** / **embedded captions** (CEA-608 in MOV/MXF/MP4; 21.1 multiple embedded). |
| **Transcription panel** | Search text, select text → insert/append to timeline (text-based editing), remove silent portions, speaker labels. |
| **Caption safe area**, **Netflix TTML** compliance options. | |

### 17.9 Scripting & extensibility
- **Lua/Python 3** API (Workspace > Scripts; external scripting via `DaVinciResolveScript` module); objects: Resolve → ProjectManager → Project → MediaPool/Timeline/TimelineItem/Gallery; render queue control. **21.1: advanced/external scripting requires Studio; built-in Python console; Python 2 removed; 20 new APIs** (keyboard presets, render presets/Quick Export, codec queries, transcription w/ speaker timing, create/flatten/SmartSwitch multicam, auto-align clips, add transitions, normalize audio, inspector properties incl. fades & speed, project setting presets, clone media, source audio mapping, output blanking, DCTL validate/encrypt).
- **MCP server (21.1, S)** for AI assistants.
- **Workflow Integration plugins** (JS/HTML panels), **OpenFX** plugin SDK, **DCTL** shaders, **Fusion Fuses** (Lua tools), **Macros/.setting/.drfx**, **Encoder plugin SDK** (IO plugins for new formats), **Fairlight VST3/AU**.

---

## 18. Keyboard Shortcuts (DaVinci Resolve default preset)

Mac uses **Cmd/Opt**, Windows/Linux **Ctrl/Alt**. Written as Mac / Win where they differ.

### 18.1 Application & pages
| Action | Mac | Windows |
|---|---|---|
| Project Manager | Shift+1 | Shift+1 |
| Media page | Shift+2 | Shift+2 |
| Cut page | Shift+3 | Shift+3 |
| Edit page | Shift+4 | Shift+4 |
| Fusion page | Shift+5 | Shift+5 |
| Color page | Shift+6 | Shift+6 |
| Fairlight page | Shift+7 | Shift+7 |
| Deliver page | Shift+8 | Shift+8 |
| Project Settings | Shift+9 | Shift+9 |
| Preferences | Cmd+, | Ctrl+, |
| Keyboard Customization | Cmd+Opt+K | Ctrl+Alt+K |
| Save project | Cmd+S | Ctrl+S |
| Undo / Redo | Cmd+Z / Cmd+Shift+Z | Ctrl+Z / Ctrl+Shift+Z |
| Import media | Cmd+I | Ctrl+I |
| New timeline | Cmd+N | Ctrl+N |
| New bin | Cmd+Shift+N | Ctrl+Shift+N |
| Full-screen (Cinema) viewer | Cmd+F | Ctrl+F |
| Enhanced viewer | Opt+F | Alt+F |
| Full screen window / UI | Cmd+Ctrl+F (Mac) | — |
| Effects search (v20.1) | Shift+Space | Shift+Space |

### 18.2 Playback & navigation
| Action | Key |
|---|---|
| Play/Stop | Space |
| Play reverse / Stop / Play forward (shuttle; repeat for 2x/4x…) | J / K / L |
| Slow-mo jog | Hold K + J or L (frame-by-frame), K+L held = slow forward |
| Previous / next frame | ← / → |
| Previous / next edit point | ↑ / ↓ |
| Previous / next marker | Shift+↑ / Shift+↓ |
| Jump 1 second back/forward | Shift+← / Shift+→ |
| Go to start / end of timeline | Home / End |
| Play around current frame | / |
| Play In to Out | Opt+/ (Alt+/) |
| Loop toggle | Cmd+/ (Ctrl+/) |
| Switch source/timeline viewer | Q |
| Go to timecode | type numbers (on timeline) then Enter (+/- for relative) |
| Toggle audio scrubbing | Shift+S |

### 18.3 Marking
| Action | Key |
|---|---|
| Mark In / Out | I / O |
| Clear In / Clear Out | Opt+I / Opt+O (Alt+I / Alt+O) |
| Clear In & Out | Opt+X (Alt+X) |
| Mark Clip (in/out around clip at playhead) | X |
| Mark Selection | Shift+A |
| Go to In / Out | Shift+I / Shift+O |
| Add marker | M |
| Add marker & open marker dialog | M pressed twice (or Cmd/Ctrl+M) |
| Add flag | G |
| Match frame | F |
| Find current clip in Media Pool | Opt+F / Alt+F (Edit page) |

### 18.4 Edit page tools & edits
| Action | Key |
|---|---|
| Selection mode | A |
| Trim edit mode | T |
| Dynamic trim mode | W (S toggles slip/slide) |
| Blade edit mode | B |
| Split clip at playhead (razor) | Cmd+B / Ctrl+B (also Cmd+\ / Ctrl+\) |
| Snapping toggle | N |
| Linked selection | Cmd+Shift+L / Ctrl+Shift+L |
| Link/unlink clips | Cmd+Opt+L / Ctrl+Alt+L |
| Insert | F9 |
| Overwrite | F10 |
| Replace | F11 |
| Place on top | F12 |
| Ripple overwrite | Shift+F10 |
| Fit to fill | Shift+F11 |
| Append at end | Shift+F12 |
| Delete (lift, leave gap) | Backspace / Delete |
| Ripple delete | Shift+Backspace (or Forward Delete) |
| Paste insert | Cmd+Shift+V / Ctrl+Shift+V |
| Paste attributes | Opt+V / Alt+V |
| Enable/disable clip | D |
| Select nearest edit point | V |
| Toggle edit side (in/out/both) | U |
| Extend edit to playhead | E |
| Select clip at playhead | Shift+V |
| Select clips forward (track / all tracks) | Y / Opt+Y (Alt+Y) |
| Select clips backward | Cmd+Y / Ctrl+Y |
| Nudge 1 frame | , / . |
| Nudge multi-frame | Shift+, / Shift+. |
| Move clip to track above/below | Opt+↑/↓ (Alt+↑/↓) |
| Swap clip left/right | Cmd+Opt+, / . (Ctrl+Alt+, / .) |
| Trim start / end to playhead | Shift+[ / Shift+] |
| Ripple trim start / end to playhead | Cmd+Shift+[ / ] (Ctrl+Shift+[ / ]) |
| Add default transition (V+A) | Cmd+T / Ctrl+T |
| Add video-only transition | Shift+T |
| Add audio-only transition | Opt+T / Alt+T |
| Change clip speed | R |
| Retime controls | Cmd+R / Ctrl+R |
| Freeze frame | Shift+R |
| Zoom in / out | Cmd+= / Cmd+- (Ctrl+= / Ctrl+-) |
| Zoom to fit timeline | Shift+Z |
| Set destination video track 1–8 | Opt+1…8 (Alt+1…8) |
| Set destination audio track 1–8 | Opt+Cmd+1…8 (Ctrl+Alt+1…8) |
| Auto track selector toggle V1–V8 | Opt+F1…F8 (Alt+F1…F8) |
| Mute / Solo track | (Fairlight: track header) |
| Multicam: cut to angle 1–9 | 1–9 (in multicam mode); Opt+1–9 switch |
| New compound clip | (right-click; customizable) |
| Show keyframe curve editor/tray (20.2.3) | assignable |

### 18.5 Color page
| Action | Key |
|---|---|
| Add serial node after | Opt+S / Alt+S |
| Add serial node before | Shift+S |
| Add parallel node | Opt+P / Alt+P |
| Add layer node | Opt+L / Alt+L |
| Add outside node | Opt+O / Alt+O |
| Enable/disable current node | Cmd+D / Ctrl+D |
| Bypass all grades | Shift+D |
| Reset selected node grade | Shift+Home |
| Reset grades & nodes (clip) | Cmd+Home / Ctrl+Home |
| Previous / next clip | ↑ / ↓ (in Color page) |
| Grab still | Cmd+Opt+G / Ctrl+Alt+G |
| Play/Toggle wipe (reference still) | Cmd+W / Ctrl+W |
| Split screen | Cmd+Opt+W / Ctrl+Alt+W |
| Highlight mode | Shift+H |
| Apply grade from 1 clip prior | = |
| Apply grade from 2 clips prior | - |
| Copy/paste grade | Cmd+C / Cmd+V |
| Create new local version | Cmd+Y / Ctrl+Y |
| Track forward / backward (Tracker) | Cmd+T / Opt+T (Ctrl+T / Alt+T) |
| Save memory A–H | Opt+1…8 (Alt+1…8) — Color page |
| Recall memory A–H | Cmd+1…8 (Ctrl+1…8) — Color page |
| Cinema viewer | Cmd+F |
| Enhanced viewer | Opt+F |
| Toggle node editor / scopes panels | via toolbar |

### 18.6 Fusion page
| Action | Key |
|---|---|
| Select/Add tool dialog (search tools) | Shift+Space |
| View node in left/right viewer | 1 / 2 |
| Pass-through (bypass) node | Cmd+P / Ctrl+P |
| Group nodes | Cmd+G / Ctrl+G |
| Swap Merge inputs (fg/bg) | Cmd+T / Ctrl+T |
| Maximize viewer | F4 (customizable) |
| Fit view to window | Cmd+F / Ctrl+F (when viewer focused) |
| Spline editor: Smooth / Linear | S / L (Spline Editor focused) |
| Set render range | via ruler |
| Show/hide controls | Cmd+K / Ctrl+K |

### 18.7 Fairlight page
| Action | Key |
|---|---|
| Record (armed tracks) | Opt+Cmd+R / Ctrl+Alt+R (assignable) |
| Range selection tool | R |
| Add fade in/out to playhead | toolbar |
| Normalize | right-click |
| Toggle automation | toolbar |
| Nudge | , / . |

> Note: Resolve's map is fully customizable; ambiguous mappings above (marked "?") vary by version/preset — verify in **Keyboard Customization** (Cmd/Ctrl+Opt/Alt+K). Presets exist for Premiere Pro, FCP X, Avid, Pro Tools layouts.

---

## 19. Design Takeaways for editcut

| Resolve idea | Why it matters for our editor |
|---|---|
| **Page-based workflow** sharing one project/timeline/media pool | Separate UIs per task without duplicating data; each page = a view over the same model. |
| **Cut page** "smart" defaults (smart insert at nearest edit, source tape, dual timeline, boring detector, close-up) | Beginner-fast editing: avoid split clips, reduce mouse/panel switching. Prime candidates for editcut's quick mode. |
| **Edit overlay** drag-to-viewer with 7 edit types | Discoverable pro edit semantics with mouse. |
| **Auto Track Selector + Destination patching + Sync locks + Position lock** | Precise control over which tracks edits affect — essential for multi-track safety. |
| **Trim modes (ripple/roll/slip/slide) determined by pointer zone** | Single tool, context cursor; dynamic J-K-L trimming. |
| **Inspector with per-parameter keyframes + curves + keyframe tray** | Unified animation model. |
| **Clip node graph for color** with serial/parallel/layer semantics | Powerful but complex; v21 added **layer-list view** to simplify — suggests a layer/stack UI over a DAG is friendlier. |
| **Order of operations** (retime → fusion → grade → transform → composite → output transform) | Define our pipeline explicitly; transforms after grade so masks track original. |
| **Color management (RCM)** with input tags + working space + output DRT | Scene-referred working space and tone-mapping decouple footage formats from output. |
| **Proxies (portable) vs optimized media (internal) vs render cache (smart/user)** | Three-layer performance system; red/blue cache bar is great feedback. |
| **Free tier without watermark** | Monetize via AI/high-res/collab. |
| **AI as assistive tools** (transcribe → text-based editing, IntelliScript, SmartSwitch, IntelliCut, Audio Assistant, Magic Mask) | Highest-leverage AI features for an editor: transcription-driven editing, silence removal, auto multicam, auto subtitles/animated captions, beat detection, auto-reframe. |
| **Quick Export presets with direct upload** (YouTube/TikTok/Vimeo/X) | Social creators' one-click deliver. |
| **Scripting API + MCP server (21.1)** | Making the editor agent-drivable is now an industry direction. |
