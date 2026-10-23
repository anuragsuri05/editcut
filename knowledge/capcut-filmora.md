# CapCut & Wondershare Filmora — Exhaustive Reference for editcut

> Purpose: a UX + feature reference for building **editcut**, a creator-focused video editor. It covers what every panel, tab and button in CapCut (desktop + mobile, as of late 2026) and Wondershare Filmora (v14 to v15.7, 2024–2026) *does*, so editcut can copy or improve on proven consumer patterns.
>
> Compiled: October 2026. Sources are the official help centers and changelogs (capcut.com/help, filmora.wondershare.com "What's New" and guide pages), the official shortcut tables, and reputable 2026 reviews (PCMag, Pixflow, BigVU), plus hands-on product knowledge.
> **Caveats:** Both apps ship UI changes every 2 to 6 weeks, run A/B tests by region, and keep moving features between Free and Paid. Treat prices and paywall placement as *approximate*. Labels may vary slightly between Windows and macOS builds and between locales.

---

## Table of Contents

1. [CapCut overview](#1-capcut--overview)
2. [CapCut pricing and Free vs Pro](#2-capcut--pricing--free-vs-pro)
3. [CapCut desktop: home screen and project creation](#3-capcut-desktop--home-screen--project-creation)
4. [CapCut desktop: UI layout](#4-capcut-desktop--full-ui-layout)
5. [CapCut desktop: asset panel tabs](#5-capcut-desktop--top-assetmaterial-tabs-in-detail)
6. [CapCut desktop: player/preview](#6-capcut-desktop--playerpreview-window)
7. [CapCut desktop: timeline toolbar and track behaviors](#7-capcut-desktop--timeline-toolbar--track-behaviors)
8. [CapCut desktop: property panel (video, audio, text, more)](#8-capcut-desktop--right-side-property-panel)
9. [CapCut AI feature list](#9-capcut--complete-ai-feature-list)
10. [CapCut keyframes, masks, chroma key, PiP, compound clips, templates, stock](#10-capcut--keyframes-masks-chroma-key-pip-compound-clips-templates-stock)
11. [CapCut export and publishing](#11-capcut--export--publishing)
12. [CapCut mobile specifics](#12-capcut-mobile--specifics)
13. [CapCut desktop keyboard shortcuts](#13-capcut-desktop--keyboard-shortcuts)
14. [Filmora overview and version history](#14-filmora--overview--version-history)
15. [Filmora pricing and Free vs Paid](#15-filmora--pricing--free-vs-paid)
16. [Filmora home/startup and project settings](#16-filmora--startup-window--project-creation)
17. [Filmora UI layout and asset tabs](#17-filmora--full-ui-layout--top-asset-tabs)
18. [Filmora player and timeline toolbar](#18-filmora--player--timeline-toolbar--track-behaviors)
19. [Filmora property panel](#19-filmora--right-side-property-panel)
20. [Filmora AI feature list](#20-filmora--complete-ai-feature-list)
21. [Filmora keyframes, masks, chroma key, PiP, compound, templates, stock](#21-filmora--keyframes-masks-chroma-key-pip-compound-clips-templates-stock)
22. [Filmora export and publishing](#22-filmora--export--publishing)
23. [Filmora mobile (brief)](#23-filmora-mobile-brief)
24. [Filmora keyboard shortcuts](#24-filmora--keyboard-shortcuts)
25. [CapCut vs Filmora side-by-side](#25-capcut-vs-filmora--side-by-side-matrix)
26. [Common patterns across consumer editors](#26-common-patterns-across-consumer-editors-ux-conventions-worth-copying)

---

# PART A — CAPCUT

## 1. CapCut — Overview

| Item | Detail |
|---|---|
| Developer | ByteDance (Bytedance Pte. Ltd.; sister product to TikTok; Chinese counterpart is **JianYing / 剪映**) |
| Platforms | iOS, Android (CapCut mobile), Windows + macOS (CapCut desktop / "CapCut PC"), Web (CapCut Online at capcut.com/editor), plus Design Studio (web canvas) and Video Studio (AI generation) |
| Positioning | Free-first, TikTok/Reels/Shorts-native, template-driven, heavy on AI and trending effects |
| Sync | **Spaces / Cloud** drafts sync between mobile, desktop and web (cloud storage is paid since Aug 2024; free cloud storage discontinued) |
| Engine traits | Single "main track" magnetic model, overlay tracks stacked above, audio below; property inspector on the right; real-time preview with proxy support; GPU-accelerated export (H.264/HEVC/AV1) |
| 2026 headline changes | Plans restructured (Apr 2026); **Ultra** tier above Pro (Jun 2026); **Director Mode** in Video Studio for AI short dramas (Jun 2026); **Dreamina Seedance 2.0 / 2.5**, Dola Seedream 5.0 Pro, Kling 3.0, VEO 3.x, PixVerse model picker; **EditPilot** prompt-driven first-pass editor for PC (Sep 2026); Design Studio infinite canvas + "Skills" (Aug 2026); C2PA Content Credentials + visible AI labels on generated content; Gemini app integration |

### 1.1 Product surfaces

| Surface | What it is | Notes for editcut |
|---|---|---|
| CapCut mobile | Touch editor: bottom toolbar, horizontal timeline, one-thumb editing | Defined the "tap clip → contextual tool strip" pattern |
| CapCut desktop | Full NLE-lite: 4-pane layout (assets / player / inspector / timeline) | Main inspiration for the editcut desktop layout |
| CapCut Online (web) | Browser editor with a left vertical rail instead of top tabs | Shows the same model collapsed into a vertical icon rail |
| Video Studio | AI generation workspace (text/image→video, Director Mode, model picker) | Generation lives apart from the timeline and its output drops into Media |
| Design Studio | Canva-like image/graphic editor with an infinite canvas and AI agent | Thumbnails and covers |
| CapCut Commerce / Business | Product-video tools, brand kits, team spaces | Team "Spaces" share assets and brand kits |

---

## 2. CapCut — Pricing & Free vs Pro

### 2.1 Tiers (US list prices, late 2026; region- and store-dependent)

| Tier | Price (approx.) | Credits | Cloud | Who it's for |
|---|---|---|---|---|
| **Free** | $0 | Small promo/activity credits only | Minimal / none (free cloud discontinued Aug 2024) | Basic editing, templates, most core tools |
| **Standard** | ~$7.99–9.99/mo (region-specific; mobile-centric; no annual in some regions) | ~600 credits/cycle | Small | Removes watermark/limits on many assets; fewer AI tools |
| **Pro** | **$19.99/mo** or **$179.99/yr** on capcut.com (app-store prices a few dollars higher) | ~1,200 credits/cycle (raised from 550 in Apr 2026) | **1 TB** (raised from 100 GB) | Creators: all Pro effects, AI tools, 4K, no watermark |
| **Ultra** (Jun 2026) | ~$79/mo (reported) | Large credit pool | Larger | AI-heavy creators and studios generating lots of AI video |
| Teams / Business | Per-seat | Shared | Shared Spaces | Agencies, brand teams |

**Credits model (2026):**
- Three kinds. **Subscription credits** reset monthly and expire. **Activity credits** come from promos and expire quickly. **Purchased credits** usually don't expire.
- Spend order: subscription credits first, purchased last.
- Credit-consuming features run **only on desktop and web**. Mobile cannot spend credits.
- Example costs (PCMag): Seedance 1.0 at 720p for 10 s is about 90 credits. VEO 3 for 8 s is about 416 credits. Seedance 2.5 costs more.

### 2.2 Free vs Pro feature split (typical late-2025/2026 state)

UI convention: a **gold crown / "Pro" badge** on a thumbnail or button means the asset or tool is paid. Free users can *preview and apply* Pro items, but export is blocked or watermarked until they're removed ("Remove Pro features" button in the export dialog). editcut should copy this "try before you buy" pattern.

| Area | Free | Pro / paid |
|---|---|---|
| Core editing (trim, split, speed normal, transitions basic, text, keyframes, overlays, basic masks) | ✅ | ✅ |
| Export resolution | Up to 1080p (2K/4K availability varies by device/platform; clarified Jan 2026) | 4K / up to 60 fps, higher bitrate, HDR |
| Watermark/ending | No watermark on desktop exports without Pro assets. The mobile template "CapCut ending" clip can be deleted | No watermark |
| Effects / filters / transitions / stickers / fonts | Large free subset | Pro-badged sets (Trending/premium, many AI-driven effects) |
| Auto captions | Historically free; partially gated by region and plan in 2025–26 (caption *styles/templates* often Pro) | Full: bilingual, filler-word detection, premium caption styles |
| Remove background (auto) | Usually free on desktop; gated in some regions | ✅ + custom brush refine |
| Speed curve presets | Partially (some presets Pro) | ✅ |
| Retouch (face/body/makeup) | Basic | Advanced body/makeup |
| AI color: Auto adjust, Color match | ❌ (Pro) | ✅ |
| Enhance image quality (HD/UHD), Reduce noise, Remove flicker, Relight | ❌ / limited | ✅ |
| Voice: Enhance voice, Isolate voice, Voice changer premium voices | Limited | ✅ |
| AI avatars, voice cloning, video translator/lip-sync | Credits | Credits (Pro allowance) |
| Script/Idea to video, long video to shorts | Limited trials | ✅ |
| Cloud storage | ❌ | 1 TB (Pro) |
| Video generation models (Seedance, Kling, VEO, PixVerse) | Trial credits | Credits; some models subscriber-only (e.g. Seedream 5.0 Pro) |

---

## 3. CapCut Desktop — Home Screen & Project Creation

### 3.1 Home screen layout

| Region | Contents / behavior |
|---|---|
| Left sidebar | Account avatar + plan badge; **Home**; **Templates** (browse/use templates); **Spaces** (cloud drafts: personal + team spaces); **Video Studio / AI tools** (generation); **Design / Image**; Settings (gear); Feedback; "Upgrade to Pro" CTA |
| Hero area | Large **"+ Create project"** button (opens an empty editor with "Original"/auto aspect ratio). Next to it are quick AI entry cards that change by region and A/B test: **AI video maker / Script to video, Long video to shorts, Auto captions, AI avatar / Text to speech, Image generator, Remove background, Video translator, EditPilot (PC)** |
| Projects list | **Projects** section: thumbnails with name, duration, file size, last modified. Grid/List toggle, sort (time/name), search, multi-select (batch delete / upload to Space). Right-click or hover "…": Rename, Duplicate, Upload to cloud, Delete, Open folder / Show draft location |
| Import project | Some builds can import mobile drafts via Spaces. No import of Premiere/FCP XML (one-way export of an XML timeline was added in some builds for Pro) |

### 3.2 Creating a project — aspect ratios & project settings

New projects open with **"Original"** ratio, which locks the canvas to the **first clip** added to the main track. Change it from the **Ratio** dropdown under the player, or in the project settings ("Modify" button in the Details/Draft panel, which shows when nothing is selected).

**Aspect ratio presets (player "Ratio" dropdown):**

| Preset | Typical use |
|---|---|
| Original | Matches first main-track clip |
| 16:9 | YouTube, landscape |
| 4:3 | Classic/legacy |
| 2.35:1 / 2.39:1 | Cinemascope letterbox |
| 2:1 | Cinematic / Univisium |
| 1.85:1 | Theatrical flat |
| 9:16 | TikTok, Reels, Shorts |
| 3:4 | Portrait feed |
| 5.8-inch | iPhone full-screen mockup |
| 1:1 | Square feed |
| 21:9 | Ultrawide (some builds) |
| Custom | Width x height in px (desktop) |

**Project settings ("Draft settings" / Details panel → Modify):**

| Setting | Options |
|---|---|
| Draft name | Text |
| Draft location | Local folder path |
| Aspect ratio | As above |
| Resolution | 480p, 720p, 1080p, 2K, 4K (+ custom in some builds) |
| Frame rate | 23.976, 24, 25, 29.97, 30, 50, 59.94, 60 |
| Color space | **Rec.709 SDR**, **Rec.2020 HLG**, **Rec.2020 PQ** (HDR workflows) |
| Proxy | On/off. Generates low-res proxies for 4K/HEVC media for smooth playback |
| Free layer | Toggle. ON = overlay clips can be layered freely (layer order = track order). Affects how overlay stacking behaves |
| Text-based editing / transcript | Some builds show a transcript toggle here |

**Global Settings (gear → Settings):**
- General: draft location, import options (keep original frame rate, auto-add to timeline), language, auto-save interval.
- Performance: **hardware decoding/encoding** (GPU on/off), proxy settings (auto-generate for >1080p), cache location and size (+ "Clear cache").
- Preview: preview quality (Full / Optimized / Smooth), color management.
- Shortcuts: customizable keymap. You can choose **CapCut**, **Premiere Pro**, or **Final Cut Pro** layout presets in recent builds.

---

## 4. CapCut Desktop — Full UI Layout

```
┌──────────────── Menu bar: Menu ▾ | Draft name (click to rename) | Shortcuts ⌨ | Layout | Share/Export ▸ ────────────────┐
│ ┌── Asset panel (top-left) ────────────────┐ ┌── Player (top-center) ──────────┐ ┌── Inspector (right) ──────────┐ │
│ │ Top tabs: Media | Audio | Text |         │ │  Preview canvas                 │ │ Contextual tabs for selected   │ │
│ │ Stickers | Effects | Transitions |       │ │  Timecode 00:00:12:05 / total   │ │ clip: Video | Audio | Speed |  │ │
│ │ Captions | Filters | Adjustment |        │ │  ▶ play, fullscreen, ratio,     │ │ Animation | Adjust | AI…       │ │
│ │ Templates | AI avatars | (Brand kit)     │ │  zoom %, quality, safe zones    │ │ or "Details" (project info)    │ │
│ │ Left sub-nav inside each tab             │ │                                 │ │ when nothing is selected       │ │
│ └──────────────────────────────────────────┘ └─────────────────────────────────┘ └────────────────────────────────┘ │
│ ┌── Timeline toolbar ───────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Select▾ ↶ ↷ | Split ⌷ DelLeft DelRight 🗑 | Marker | Freeze | Reverse | Mirror | Rotate | Crop | AutoReframe… │ │
│ │                                     ... right side: 🎤 Record | Magnet | Snap | Linkage | Preview axis | − ═ + │ │
│ ├── Timeline: time ruler; overlay tracks (video/sticker/text/effect/filter/adjustment) ↑; MAIN TRACK (with "Cover"│ │
│ │   thumbnail slot at its head); audio tracks ↓. Track header: lock, hide, mute.                               │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Behavior |
|---|---|
| Menu (top-left "Menu" ▾) | File (New, Open, Import, Save/auto-save, Export, Draft settings), Edit, Settings, Help, Check for updates, Feedback |
| Draft name | Click to rename inline |
| Layout button | Choose panel arrangements: default, "media-focused", "timeline-focused", player-left; panels are resizable via splitters; double-clicking a panel header can maximize |
| Shortcut (keyboard icon) | Opens shortcut sheet + customization; preset layouts CapCut/Premiere/FCP |
| Export button (top-right, highlighted) | Opens export dialog; "Share" dropdown for direct-to-TikTok/YouTube |
| Resizable everything | All splitters drag. Inspector collapses to icons on small windows |

**Panel-selection rule:** the inspector is **contextual**. Selecting a video clip shows Video/Audio/Speed/Animation/Adjust/AI tabs. Selecting text shows Text/Animation/Tracking/Text-to-speech. Selecting audio shows Basic/Voice changer/Speed. With nothing selected it shows **Details** (project name, path, ratio, resolution, frame rate, color space, proxy, "Modify").

---

## 5. CapCut Desktop — Top Asset/Material Tabs in Detail

Each top tab has a **left sub-navigation column** (categories) and a **thumbnail grid**. Hovering a thumbnail plays an animated preview *in the grid tile*, and also in the player for effects, transitions and filters. Every tile has:
- a **"+" button** (adds at the playhead, on the appropriate track),
- a **download arrow** (first use downloads the asset), and
- a **★ favorite** (collected under "Favorites/Mine").

Assets can be **dragged** onto the timeline, or onto a clip in the case of filters/effects/transitions.

### 5.1 Media

| Sub-section | Contents / behavior |
|---|---|
| **Import** (Local) | "Import" button (files/folders), drag-and-drop. Grid/list view, sort, filter (video/image/audio), **"Added"** checkmark badge on used media, duration labels. Right-click: Show in folder, Replace, Delete, Generate proxy, Rename. Hover-scrub thumbnails |
| **Spaces / Cloud** | Cloud assets and team-shared assets |
| **Library** (stock) | CapCut stock footage: Trending, Green screen, Intro & ending, Backgrounds, Transitions-footage, Effects overlays (light leaks, dust), Countdowns, Funny, Holidays, Social media frames. Most are free; some are Pro |
| **AI media / AI generated** | Text-to-image, image-to-video, text-to-video via Video Studio models; results land here |
| **Stock (third-party)** | Some builds integrate Getty/Shutterstock-like stock through "Stock videos/images" search |
| **Brand kit** | Logos, colors, fonts (teams) |
| **Record** | Screen / webcam recorder (desktop, newer builds) and voiceover |

### 5.2 Audio

| Sub-section | Contents |
|---|---|
| **Music** | Categories (Vlog, Travel, Beats, Calm, Romance, Fashion, Funny, Holiday, Warm…). Search. Preview on hover/click, waveform tile, "+" adds to an audio track at the playhead. Commercial-use filter and "Copyright-cleared" tags |
| **Sound effects** | Whoosh, Transition, Laugh, Cartoon, Keyboard, Applause, Notification, Animal, Horror… |
| **Brand music / TikTok sounds** | Link a TikTok account to use favorited TikTok sounds (licensing restrictions apply) |
| **Extract audio** | Import a video file and use only its audio |
| **Copyright check** | Pre-export copyright check for music (Pro/business) |
| **AI music / AI sound** | Prompt-generated music beds and SFX (credits) |
| **Text to speech** | In some builds TTS lives here as well as in the Text inspector |
| **Voiceover / Record** | Record mic to the timeline (also the 🎤 timeline button) |

### 5.3 Text

| Sub-section | Contents |
|---|---|
| **Add text → Default text** | Plain "Default text" layer |
| **Text templates** | Animated pre-built titles: Trending, Basic, Tags, Titles, Subtitles-style, Social media, Holiday, Effects, Brand. Many Pro |
| **WordArt / Effects** | Styled fills (gradients, 3D, metallic, neon) |
| **Fonts** | Some builds list a font browser; uploading system fonts is supported |
| **AI generated (Text effects / AI font)** | Prompt-generated text styling |
| **Auto captions / Auto lyrics** | Shortcuts into the Captions tab |
| **Recognize lyrics** | Lyrics from songs → timed text |

### 5.4 Stickers

| Sub-section | Contents |
|---|---|
| Stickers | Animated stickers (Trending, Emoji, Love, Arrows, Subscribe/Like buttons, Social media, Labels, Holidays, Comment-reply bubbles) |
| GIPHY | GIPHY search (some regions) |
| AI generated | Prompt → sticker (credits) |
| Emoji | Animated emoji |

Stickers go onto overlay tracks and support transform, animation, keyframes, **motion tracking**, and blend modes.

### 5.5 Effects

| Sub-section | Contents |
|---|---|
| **Video effects** | Categories: Trending, Pro, Basic (blur, zoom, shake, mosaic), Party, Lens (fisheye, lens blur), Retro (VHS, film), Light (light leaks, flares), Dreamy, Split (split-screen 2/3/4/6/9), Glitch, Distortion, Shake, Overlay, Comic, Nature, Borders/Frames, Love, Bling, Motion blur |
| **Body effects** | Human-segmentation effects: Outline/neon edge, Clone/duplicate, Shadow, Heartbeat, Wings, Glow, Halo, Pixelated, Ghost, etc. They follow the detected person |
| **Photo / AI effects** | Single-image stylization (AI anime, 3D cartoon, painting, "AI Dance"); some generate new clips (credits) |
| **Audio effects** | (some builds) reverb, etc. — mostly in Voice changer |

**Application models (important UX):**
1. Drag an effect **onto a clip** → it applies to that clip only (shows as an effect icon/badge on the clip; editable in the clip's Effects tab).
2. Drop an effect **on an empty track area** or click "+" → creates an **effect clip on its own track** that affects everything **below it** for its duration (trimmable, movable).
3. In an effect clip's inspector, an **"Apply to"** selector (Main track / Overlay / All) chooses the target layers.

### 5.6 Transitions

Categories: Trending, Basic (Mix/Dissolve, Black fade, White flash, Blur), **Overlay**, **Camera** (Pull in, Pull out, Zoom, Spin), Blur, Glitch, Slide, Wipe, Distortion, Light, Mask (shape wipes), Social media, Split, Love.

| Behavior | Detail |
|---|---|
| Placement | Drag between two adjacent clips **on the same track** (main or overlay). On the main track, a small transition icon appears at each cut between clips; clicking it opens Transitions |
| Duration | Inspector slider (typically 0.1–X s, bounded by clip lengths) |
| **Apply to all** | One button applies the same transition at every cut on the track |
| Overlap model | CapCut transitions overlap the two clips (they consume handles); total duration shortens |
| Remove | Select the transition, then Delete |

### 5.7 Captions

| Sub-section | What it does |
|---|---|
| **Auto captions** | Speech-to-text on selected clips or the full timeline. Options: **Spoken language** (auto-detect or pick from ~20–130 languages depending on source), **Bilingual captions** (adds a translated second line), **Identify filler words** (flags um/uh/like for removal), **Clear current captions**, **Caption style/template** pre-selection, **Only selected clip** |
| **Caption templates / styles** | Animated caption looks (karaoke-word highlight, pop-in per word, emoji-auto) |
| **Import captions** | SRT, LRC, ASS files |
| **Auto lyrics** | Lyrics recognition for songs (mostly English, Chinese) |
| **Caption list** | Editable transcript list: click a line to jump, edit text inline, Enter splits a caption, Ctrl/Cmd+Enter adds a line break; find & replace; batch style change |
| **Translate** | Translate existing captions |
| **Text-based editing / Transcript** | Edit the video by deleting words in the transcript. Includes **Remove filler words** and **Remove pauses/silences** (some builds) |

Captions are created on a dedicated **caption track** (text clips grouped). Editing style on one caption offers "Apply to all captions" (checkbox, on by default).

### 5.8 Filters

Categories: Featured, Pro, Life, Scenery, Movies/Cinematic, Retro/Film, Black & white, Food, Night, Portrait, Vintage, Glitch, Style. Each filter has an **Intensity 0–100** slider.

| Application | Behavior |
|---|---|
| Drop on clip | Clip-attached filter (one filter per clip; replacing swaps it) |
| Drop on empty track / "+" | **Filter clip** on its own track affecting all layers below for its duration |

### 5.9 Adjustment

| Sub-section | Contents |
|---|---|
| **Custom adjustment** ("Adjustment" layer) | Adds an **adjustment clip** that carries color settings (Basic/HSL/Curves/Color wheels). It affects tracks below for its duration (like Premiere adjustment layers) |
| **My presets** | Saved color presets from the Adjust inspector ("Save preset") |
| **LUTs** | Import **.cube / .3dl** LUTs, which then appear under Adjust → LUT with intensity |

### 5.10 Templates

- Browsable in-editor templates: Trending, Vlog, Travel, Birthday, Business, Intro, Memes, Product. Search by keyword, filter by aspect ratio, number of clips and duration.
- **Use template**: opens a "replace media" flow showing the template's numbered **media slots** with required durations. You pick media and it autofills.
- Desktop can also **insert a template as a compound/template clip** into an existing timeline, then "Edit template" to swap slots and texts.
- **Template creation** (mobile "Create template" / desktop "Publish template", creator program): mark which clips are replaceable and which texts are editable, then publish.

### 5.11 AI avatars

- Pick a stock **digital human** (gender/age/ethnicity, outfit, background), or create a **custom avatar** from a short self-recorded video (requires consent verification).
- Enter a script or upload audio → lip-synced talking-avatar clip on the timeline. Voice comes from the TTS library or a cloned voice. Avatar can be placed as an overlay with background removed.
- Credit-based.

### 5.12 Other tabs seen in 2025–26 desktop builds

| Tab | Purpose |
|---|---|
| **Brand kit** | Team logos/colors/fonts |
| **Plugins** | Third-party plugin assets (some regions) |
| **AI** / **Smart tools** hub | Grid of AI tools (shortcut duplicates of inspector features) |
| **Elements / Shapes** | Basic shapes for overlays |

---

## 6. CapCut Desktop — Player/Preview Window

| Control | Location | Behavior |
|---|---|---|
| Panel title "Player" + **⋯ menu** | Top | Preview quality (Full quality / Performance / Smooth), **Show safe zones** (TikTok/YouTube/Instagram UI overlays to keep captions clear of buttons), Show guides/grid, Background color |
| Timecode | Bottom-left | Current / total (HH:MM:SS:FF). Click to type a time to jump |
| ▶ Play/Pause | Bottom-center | Space |
| Frame step | (keys) | ←/→ |
| **Ratio** dropdown | Bottom-right | Aspect ratio presets (see §3.2) |
| **Zoom %** dropdown | Bottom-right | Fit, 25–400%. Alt/Option+Shift+Z = fit to window |
| **Full screen** | Bottom-right | Ctrl+Shift+F / Cmd+Ctrl+F; Esc exits |
| **Snapshot / capture frame** | (some builds) | Saves the current frame as an image |
| **Original/Compare** toggle | When enhancing/adjusting | Hold to see before/after |
| On-canvas handles | Canvas | Selected layer shows a bounding box: corner scale, **rotate handle** (circular arrow below/above box), drag to move, **snap guides** (center lines, edges, other layers) with magenta/blue lines. Hold Ctrl/Cmd to temporarily ignore guides. Text boxes: Alt/Option+drag resizes from center; double-click edits text inline |
| Crop mode | Canvas | When Crop is active: crop rectangle with ratio presets (Free, 16:9, 9:16, 1:1, 4:3, 3:4, 2:1, 2.35:1…), straighten/rotate slider, Reset, Confirm |
| Mask overlay | Canvas | Mask shapes display with handles (position, size, rotation, feather arrow, round-corner handle) |
| Keyframe path | Canvas | Position keyframes show a motion path (some builds) |

---

## 7. CapCut Desktop — Timeline Toolbar & Track Behaviors

### 7.1 Toolbar (left group), left → right

| Button | Shortcut | What it does exactly |
|---|---|---|
| **Select / Split mode ▾** (arrow icon) | A / B | **Select** = normal pointer. **Split (blade)** = every click on a clip cuts it at the cursor |
| **Undo** | Ctrl/Cmd+Z | Steps back through history (unlimited during session) |
| **Redo** | Ctrl/Cmd+Shift+Z | Re-applies |
| **Split** | Ctrl/Cmd+B | Cuts the **selected** clip(s) at the playhead. If nothing is selected, cuts the clip under the playhead on the main track (behavior varies by version). Ctrl/Cmd+Shift+B splits **all tracks** at the playhead |
| **Delete left** | Q | Trims away the part of the selected/under-playhead clip **left of the playhead** and ripples (closes the gap on the main track) |
| **Delete right** | W | Trims away everything **right of the playhead** in that clip |
| **Delete** | Backspace/Delete | Deletes the selected clip(s). On the main track with magnet ON it ripples; on overlay tracks it leaves a gap |
| **Add marker** | M | Adds a marker on the ruler (or on the selected clip). Markers can be colored and named |
| **Freeze** | — | Inserts a **3-second still frame** of the frame at the playhead, splitting the clip and pushing later content right. The freeze clip is an image clip whose duration can be trimmed |
| **Reverse** | — | Renders the clip reversed (progress bar; audio is removed/reversed). Toggle back by clicking again |
| **Mirror** | — | Flips horizontally (toggle) |
| **Rotate** | — | Rotates 90° clockwise per click (fine rotation is in the inspector) |
| **Crop** | — | Opens the crop dialog/mode (see Player). Also **Crop & ratio** |
| **Auto reframe** | — | AI reframes the clip to a new aspect ratio while tracking the subject. Options: target ratio, **tracking speed** (slow/default/fast/extra fast for motion), subject. Creates keyframed position automatically |
| **Remove background** / **Cutout** shortcut | — | (some builds) quick access to BG removal |
| **Match cut** | Ctrl/Cmd+J | Jumps to the matching frame/source |
| **Duplicate**, **Replace** | right-click | — |
| **Create compound clip** | Alt/Option+G | Converts a selection into a nested clip |
| **Group / Ungroup** | Ctrl/Cmd+G / +Shift+G | Groups clips to move them together (not nested) |
| **Record voiceover** 🎤 | — | Records the mic at the playhead into a new audio track. Countdown 3-2-1, noise reduction toggle, mute-project-during-record toggle |
| **AI / Smart edit** | — | Recent builds add "AI cut" buttons (e.g. EditPilot, Long-video-to-shorts) near the toolbar |

> Some build variations collapse less-used actions (Mirror, Rotate, Crop, Reverse, Freeze) into a "…" overflow when the window is narrow.

### 7.2 Toolbar (right group)

| Button | Shortcut | What it does |
|---|---|---|
| **Main track magnet** | P | ON (default): the main track is **magnetic**. Clips always abut with no gaps. Deleting ripples; dragging a clip reorders by swapping/inserting; trims ripple later clips. OFF: free positioning with gaps allowed (black where empty) |
| **Auto snapping** | N | Snaps clip edges, playhead, markers and keyframes to each other while dragging (vertical snap line appears) |
| **Linkage** | ~ (tilde) | ON: links overlay/text/audio clips to the **main-track clip** they sit over, so moving/trimming the main clip carries attached clips along (connected clips similar to FCP). OFF: independent |
| **Preview axis** | S | ON: hovering over the timeline **skims** (previews under the mouse without moving the playhead), with a hover line. OFF: preview only at the playhead |
| **Zoom out / slider / Zoom in** | Ctrl/Cmd+- / Ctrl/Cmd+= ; Ctrl/Cmd+wheel | Timeline horizontal zoom |
| **Zoom to fit** | Shift+Z | Fits the whole project into the timeline width |
| **Track height** (some builds) | — | Small/medium/large thumbnails |

### 7.3 Track model & behaviors

| Track | Rules |
|---|---|
| **Main track** (video) | The single "spine". Magnetic by default, starts at 0, cannot have leading gaps when magnet is on. Header has a **Cover** button to set a video cover/thumbnail (frame from video or uploaded image, plus text templates, exported as the cover image for TikTok). Transitions live only between adjacent clips on a track |
| **Overlay video tracks** (PiP) | Created automatically above the main track when you drag media above it. Stack order = layer order (higher = on top). Free positioning (non-magnetic) |
| **Text / sticker / effect / filter / adjustment tracks** | Created above as needed. Color-coded clips: text = orange/amber, stickers = yellow-ish, effects = purple, filters = teal/blue, adjustment = green-ish. Effect/filter/adjustment clips affect everything *below* |
| **Audio tracks** | Below the main track. Music = green-ish clips with waveforms; voiceovers and extracted audio separate. Beat markers show as dots on music clips |
| **Captions track** | Text clips grouped as a caption track; editing is mirrored in the caption list |
| Track headers | **Lock** (prevents edits), **Hide/eye** (visual tracks; excludes from preview/export), **Mute** (audio/video audio). Main track header also shows "Cover" |
| Auto-create/delete | Tracks appear when dropping above/below and disappear when empty (no manual track management needed, which is a key simplicity win) |
| Clip appearance | Filmstrip thumbnails; clip name; badges for speed (×2.0), effects, filters, keyframes (◆), muted; the red/orange "Pro" marker on clips using Pro features |
| Clip trim | Drag left/right edges (handles shown); a tooltip shows the new duration |
| Slip | Some builds: Alt-drag inside a clip to slip the source in/out |
| Detach audio | Right-click → **Extract audio** (Ctrl/Cmd+Shift+S): video's audio is muted and a new audio clip is created below; doing it again restores |
| Clip right-click menu | Copy, Cut, Paste, Delete, Split, Duplicate, **Replace clip** (keeps duration and effects, swaps the source), Extract audio, Create compound clip, Group, Enable/disable clip (V), Link/unlink, **Separate audio**, Show in media, Speed, Freeze, Reverse, **Copy attributes / Paste attributes** (selective: transform, adjust, filters, effects, animation, speed, audio), Save as preset, Add to Brand kit |
| Keyframe lane | Alt/Option+K shows the keyframe panel. Keyframes show as ◆ on the clip |
| Playhead | White vertical line with a triangular head. Click the ruler to jump; drag to scrub with audio scrubbing |
| Range selection | I/O mark in/out; Shift+X select area by clip; Alt+X clear |

---

## 8. CapCut Desktop — Right-Side Property Panel

### 8.1 Video clip selected

Top-level tabs: **Video** | **Audio** | **Speed** | **Animation** | **Adjust** | (**AI tools** / **Smart tools**) — sometimes plus **Effects** (applied effects) and **Filter** when attached. Each tab has sub-tabs. Every property row has a **◇ keyframe button** at the right (filled ◆ when a keyframe exists at the playhead; ◀ ▶ arrows jump between keyframes) and a **↺ reset** button per section.

#### 8.1.1 Video → Basic

| Section | Controls | What they do |
|---|---|---|
| **Transform** | Scale (%), **Uniform scale** toggle (off = independent Scale X/Y), Position X/Y (px), Rotate (°), **Alignment** quick buttons (left, h-center, right, top, v-center, bottom), Flip (some builds) | Geometric transform of the layer within the canvas |
| **Blend** | Mode: Normal, Darken, Multiply, Color burn, Linear burn, Lighten, Screen, Color dodge, Add/Linear dodge, Overlay, Soft light, Hard light; **Opacity 0–100%** | Compositing over lower layers |
| **Background** (main track only) | Canvas fill when the clip doesn't fill the frame: **None**, **Color** (swatches/eyedropper), **Blur** (4 strengths), **Image/Pattern** (presets/upload); "Apply to all" | Letterbox fill (the classic "blurred background" for vertical-on-horizontal) |
| **Stabilize** | Off / Recommended / Minimum cut / Most stable | Analyses motion and warps/crops to steady shake. Higher levels crop more |
| **Video quality / Enhance** | **Enhance image quality** (HD / UHD; AI upscale), **Reduce image noise**, **Remove flickers** (for screen/lighting flicker), **Motion blur** (blur amount, direction, blend), **Lens correction** (some builds) | AI restoration |
| **Relight** (2025+) | Light presets, direction, intensity, color | AI re-illumination of faces/subjects |

#### 8.1.2 Video → Remove BG (Cutout)

| Mode | Controls |
|---|---|
| **Auto removal** | Toggle: AI person/subject segmentation; then **Stroke** (outline style, color, size), **Edge** feather/shrink |
| **Custom removal** | Brush to **Smart brush** (paint the keep-area) / **Eraser**, brush size; **Expand/contract edge**; AI propagates through the clip (progress bar) |
| **Chroma key** | **Color picker** (eyedropper on the canvas), **Intensity** (tolerance), **Shadow** (preserve shadows / edge softness), **Edge feather**, Spill suppression (some builds) |

Only one mode is active at a time.

#### 8.1.3 Video → Mask

| Mask shapes | Controls |
|---|---|
| None, **Split/Linear**, **Mirror** (band), **Circle**, **Rectangle**, **Heart**, **Star**, (**Text mask**, **Pen/custom bezier** in newer builds; **multiple masks** combined since 2025) | Position X/Y, Rotation, Size W/H (or scale), **Feather**, **Round corners** (rectangle), **Invert** button; all keyframable; on-canvas handles |

#### 8.1.4 Video → Retouch (face/body)

| Group | Sliders |
|---|---|
| **Face** | Smooth, Whiten/Brighten, Even skin tone, Remove dark circles, Remove nasolabial folds, Teeth whiten, Sharpen face |
| **Reshape** | Slim face, Face width, V-shape, Chin, Forehead, Cheekbones, Eye size, Eye distance, Nose size/width/bridge, Mouth size, Smile |
| **Makeup** | Presets (Natural, Glam…), lipstick, blush, contour, eyebrows (Pro) |
| **Body** | Slim body, Long legs, Small head, Slim waist, Shoulders (Pro) |
| **Manual / Auto** | "Auto" one-click and multi-face selection (choose which face) |

#### 8.1.5 Video → Animation

| Sub-tab | Behavior |
|---|---|
| **In** | Entrance animations (Fade in, Zoom in, Slide left/right/up/down, Rotate, Bounce, Blur in, Swing, Wipe…) + **Duration** slider (anchored to clip start) |
| **Out** | Exit animations + duration (anchored to clip end) |
| **Combo** | Loop-style animations spanning the whole clip (Shake, Zoom-in-out, Swing, Rotate-down…). Exclusive with In/Out |

Animation is shown as a translucent ramp at the start/end of the clip in the timeline.

#### 8.1.6 Speed

| Sub-tab | Controls / behavior |
|---|---|
| **Normal** (constant) | **Speed** multiplier 0.1x–100x (slider + numeric), **Duration** field (type target duration and speed is computed), **Change pitch** toggle (off = pitch preserved when sped up), **Smooth slow-mo** toggle (**Frame interpolation**: Frame blending / **Optical flow** AI interpolation, rendered in the background). Clip shows a "×1.5" badge |
| **Curve** (speed ramp) | Presets: **Custom**, **Montage**, **Hero**, **Bullet**, **Jump cut**, **Flash in**, **Flash out**. Click a preset, then **Edit** opens a **speed-curve graph** (x = clip time, y = speed 0.1x–10x) with draggable beat points; **+ Add beat / − Delete beat**; **Reset**. **Change pitch** toggle applies too. Duration readout updates live |
| Shortcut | Ctrl/Cmd+R opens Speed; Shift+B switches to Curve |

#### 8.1.7 Adjust (color)

| Sub-tab | Controls |
|---|---|
| **Basic** | **Auto adjust** (AI one-click, intensity) [Pro], **Color correction / AI color grade** [Pro], **Color match** (choose a reference clip/frame → match its look) [Pro], **LUT** (built-in + imported .cube/.3dl, intensity), **Color**: Temperature, Tint, Saturation; **Lightness**: Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Brilliance (some builds), Light sensation; **Effects**: Sharpen, Clarity, **Particles/Grain**, Fade, **Vignette**. "Save preset", "Apply to all" |
| **HSL** | 8 color chips (red, orange, yellow, green, cyan, blue, purple, magenta) × **Hue, Saturation, Luminance** sliders |
| **Curves** | Luma (white), Red, Green, Blue curves; click to add points, drag; reset per curve |
| **Color wheels** | **Primary wheels**: Lift / Gamma / Gain / Offset (each a wheel + luminance slider). **Log wheels**: Shadows / Midtones / Highlights / Offset for log footage. Global intensity |

Adjust settings can be packaged as an **Adjustment layer** (see §5.9).

#### 8.1.8 Video → Audio (audio of the video clip)

Same as §8.2 (volume, fades, noise reduction, enhance voice, voice changer…) for the clip's embedded audio.

#### 8.1.9 Tracking & AI tools (video)

| Tool | What it does |
|---|---|
| **Camera tracking** | Keeps a chosen subject (face/body) **centered in frame** by animating crop/scale. Like an AI virtual camera operator for re-framing static wide shots. Options: zoom level, subject, smoothness |
| **Motion tracking** (on text/sticker/overlay) | Select the overlay → **Tracking** → pick the target clip, draw a tracking box on the subject in the player, choose **Position only** or **Position + Scale (+ Rotation)** → Start tracking. Overlay then follows |
| **Auto reframe** | (also toolbar) re-aspect with subject tracking |
| **Video translator** | Translates speech into another language with cloned voice and **lip-sync** |
| **AI expand** (image) | Outpaints images to a new ratio |
| **Remove objects / Smart object remover** (2025+) | Brush an object and it's inpainted out over time |
| **Old photo restoration / colorize** | Photo tools |
| **AI stylize** | Restyles a clip (anime, 3D, painting) |
| **Remove watermark?** | Not offered |

### 8.2 Audio clip selected

Tabs: **Basic** | **Voice changer** | **Speed** | (**Beats**) | (**AI tools**)

| Section | Controls | Behavior |
|---|---|---|
| **Volume** | dB slider (−∞ to +20 dB), keyframable. Also a volume line dragged directly on the timeline clip | Gain |
| **Fade in / Fade out** | Duration sliders (s) | Shown as curved ramps at the clip edges in the timeline |
| **Normalize loudness** | Toggle + target (e.g. −14 LUFS for social / −16 / −23) | Evens loudness across clips |
| **Enhance voice** | Toggle (+ intensity) [Pro] | AI studio-sound: removes noise/reverb, EQs voice |
| **Reduce noise** | Toggle (levels) | Removes constant background noise |
| **Isolate voice / Remove vocals** (Audio separation) | Choose **Vocals** or **Instrumental/Background** | Source separation, producing a new clip |
| **Speech to song** | Turns speech into a sung melody (voice-changer category) | — |
| **Voice changer** | **Voice filters**: Echo, Megaphone, Low battery, Vinyl, Lo-fi, Synth, Big house, Distorted, Electronic, Tremble, Deep, High; **Voice characters**: Chipmunk, Robot, Giant, Elf, Monster, Female/Male-ize, Jessie, Trickster…; **Speech to song** genres. Intensity sliders per effect | Apply on audio or video-audio clips |
| **Speed** | Same as video Normal speed (+ Change pitch toggle) | — |
| **Beats** | **Auto beat** (analyse song → beat markers, choose **Beat 1** (strong beats) / **Beat 2** (more frequent)), **Manual: Add/Remove beat** at the playhead, **Clear beats** | Yellow dots on the clip. Snapping makes cutting video to beats easy |
| **Pan / channel** | Some builds: Left/Right balance | — |
| **Audio ducking** | Some builds: auto-lowers music under speech | — |
| **Extract audio / Replace** | — | — |

### 8.3 Text clip selected

Tabs: **Text** | **Animation** | **Tracking** | **Text to speech** | (**Captions** when caption) | (**Bubble**, **Effects** as sub-tabs of Text)

#### 8.3.1 Text → Basic

| Control | Detail |
|---|---|
| Text box | Multiline input. Edits sync with the canvas inline editing |
| **Font** | Dropdown with system + CapCut fonts (thumbnail previews; Pro fonts badged; "Commercial" filter); upload font (desktop) |
| Font size | Numeric/slider |
| **Pattern** | **B**old, *I*talic, U̲nderline |
| **Case** | Original / UPPERCASE / lowercase / Title Case |
| **Color** | Swatches + picker + eyedropper; **gradient** fills in newer builds |
| Character spacing, Line spacing | Sliders |
| **Alignment** | Left / Center / Right / Justify; vertical text toggle |
| **Style presets** | Row of one-click styles (white text black stroke, yellow, boxed…) |
| **Stroke** | Toggle, color, thickness (multiple strokes in newer builds) |
| **Background** | Toggle, color, opacity, round corners, height/width padding, offset |
| **Shadow** | Toggle, color, opacity, blur, distance, angle |
| **Glow** | (2025+) color, intensity, range |
| **Transform** | Scale, Position, Rotate (same as video) |
| **Save as preset** | Saves the complete text style |

#### 8.3.2 Text → Bubble / Effects

| Sub-tab | Detail |
|---|---|
| **Bubble** | Speech-bubble / label backgrounds that wrap the text (shout, thought, tag, price label…). Some animated |
| **Effects (WordArt)** | Pre-made fill styles: gradient, chrome, neon, 3D extrude, fire, glitter. Intensity |
| **Text template** | If created from a template, shows editable text fields per line |

#### 8.3.3 Text → Animation

**In / Out / Loop** (not Combo) with duration. Types include Typewriter, Fade, Pop, Bounce, Slide, Zoom, Blur, Wave, Rise, Spin, **Word-by-word / karaoke highlight** (for captions), Shake, Flicker. Loop animations have a **speed** slider.

#### 8.3.4 Text → Text to speech

- Voice grid with categories: Trending, English, Characters (Narrator, Jessie, Peaceful Female, Chill Girl, Elfy, Trickster…), Multilingual (dozens of languages), Your voices (cloned).
- Each voice tile has a preview button. A **Generate speech** button creates an audio clip aligned to the text clip.
- Option to "update speech when text changes" (some builds).
- **Voice clone / Custom voice**: record ~10 s of reading or upload, accept consent, then your voice appears in the list (credits/Pro).

#### 8.3.5 Text → Tracking

Motion tracking for the text (see §8.1.9).

#### 8.3.6 Captions (caption clip selected)

Style edits apply to all captions by default. The caption list is editable. Other features:
- **Bilingual** layout (primary + translation lines, each styled separately).
- **Caption templates** with per-word highlight color and animation.
- **Emoji auto-insert** (AI).
- **Keyword highlight** (AI picks keywords to color).

### 8.4 Sticker / Effect / Filter / Adjustment clips selected

| Clip type | Inspector |
|---|---|
| Sticker | Transform, Blend/Opacity, Animation (In/Out/Loop), Tracking |
| Effect clip | **Effect parameters** (varies: Speed, Range, Intensity, Color, Filter strength, Direction…) and **Apply to** (Main track / Overlay / All / specific) |
| Filter clip | Filter choice, Intensity |
| Adjustment clip | Basic / HSL / Curves / Color wheels (as §8.1.7) |

### 8.5 Image clip selected

Same as video minus Speed/Audio. Adds **AI expand**, **AI effects (photo to video)**, **Retouch**, and **Duration** (default 3–5 s, set in Settings).

---

## 9. CapCut — Complete AI Feature List

| # | Feature | Where | What it does / notes | Paywall |
|---|---|---|---|---|
| 1 | **Auto captions** | Captions tab | Speech-to-text into a caption track; 20+ (up to ~130 claimed) languages; bilingual; filler-word identification; style templates | Free/limited → Pro |
| 2 | **Auto lyrics** | Captions tab | Timed lyrics from music | Free/Pro |
| 3 | **Caption translation** | Captions | Translate captions | Pro/credits |
| 4 | **Text-based editing / Transcript editing** | Captions / Text-based edit panel | Delete words in the transcript to cut video | Pro |
| 5 | **Remove filler words** | Auto captions option / transcript | Detects "um, uh, like" and batch-deletes | Pro |
| 6 | **Remove pauses / silences** | Transcript / Smart tools | Cuts silent gaps (threshold) | Pro |
| 7 | **Script to video / AI video maker / Instant AI video** | Home + Media | Prompt or script → assembled video with stock/AI visuals, TTS voiceover, captions, music | Credits |
| 8 | **Idea to video / AI writer** | Home | Generates the script first | Credits |
| 9 | **Long video to shorts** | Home | Upload a long video (or YouTube link) → AI finds highlights, reframes to 9:16, adds captions, scores virality; outputs multiple shorts | Credits/Pro |
| 10 | **EditPilot** (PC, 2026) | Desktop | Prompt-driven first-pass edit: assembly, filler removal, alternate cuts | Credits |
| 11 | **AutoCut** (mobile/web) | Home | Pick clips + style → auto-edited beat-synced video | Free/Pro |
| 12 | **AI avatars** | AI avatars tab | Stock/custom talking avatars from script | Credits |
| 13 | **Text to speech** | Text inspector / Audio | 200+ voices (≈269 cited), many languages, character voices | Free + Pro voices |
| 14 | **Voice cloning / Custom voice** | TTS | Clone the user's voice from a short sample | Pro/credits |
| 15 | **Video translator** | Smart tools | Translates speech with voice clone + lip-sync | Credits |
| 16 | **Lip sync** | AI avatars / translator | Re-animate the mouth to new audio | Credits |
| 17 | **Retouch** | Video inspector | Face smoothing/reshape, makeup, body reshaping | Partly Pro |
| 18 | **Remove background (auto)** | Video → Remove BG | AI person/subject segmentation without a green screen | Free/Pro by region |
| 19 | **Custom removal / Smart cutout** | Remove BG | Brush-guided segmentation propagated through video | Pro |
| 20 | **Chroma key** | Remove BG | Color key (not AI) | Free |
| 21 | **Auto reframe** | Toolbar/inspector | Subject-tracking re-aspect (16:9 → 9:16 etc.) | Pro |
| 22 | **Camera tracking** | Video tools | Virtual camera that keeps the subject centered | Pro |
| 23 | **Motion tracking** | Text/sticker/overlay | Overlay follows a tracked object | Free |
| 24 | **Auto adjust (AI color correction)** | Adjust → Basic | One-click exposure/WB/contrast fix | Pro |
| 25 | **Color match** | Adjust → Basic | Matches the color of one clip to a reference | Pro |
| 26 | **AI color grade / AI LUT** | Adjust | Style-prompted grading | Pro |
| 27 | **Relight** | Video → Basic/Enhance | AI relighting of faces/scenes (direction, color, intensity) | Pro |
| 28 | **Enhance image quality (HD/UHD upscale)** | Video → Enhance | AI super-resolution | Pro |
| 29 | **Reduce image noise** | Video → Enhance | AI denoise | Pro |
| 30 | **Remove flickers** | Video → Enhance | Deflicker | Pro |
| 31 | **Smooth slow-mo (optical flow)** | Speed | AI frame interpolation | Pro |
| 32 | **Motion blur** | Video | Synthetic motion blur | Free/Pro |
| 33 | **Stabilize** | Video → Basic | Motion stabilization | Free |
| 34 | **Enhance voice** | Audio | AI voice cleanup (studio sound) | Pro |
| 35 | **Reduce noise** | Audio | Noise suppression | Free |
| 36 | **Isolate voice / Vocal remover / Audio separation** | Audio | Stem separation | Pro |
| 37 | **Voice changer / Voice effects / Speech-to-song** | Audio | Character voices, filters, sung speech | Free + Pro |
| 38 | **Auto beat detection** | Audio → Beats | Beat markers for cut-to-beat | Free |
| 39 | **Normalize loudness** | Audio | LUFS normalization | Free |
| 40 | **AI music / AI sound effects** | Audio | Prompt-generated audio | Credits |
| 41 | **AI effects / AI stylize** | Effects → AI | Photo/video restyle (anime, 3D, painting), "AI dance" | Credits |
| 42 | **Body effects** | Effects | Segmentation-driven person effects | Free/Pro |
| 43 | **AI expand** | Image | Outpaint images to new ratios | Credits |
| 44 | **Text to image / AI image generator** (Seedream, Nano Banana, GPT Image) | Media/AI / Design Studio | Image generation | Credits |
| 45 | **Image to video / Text to video** (Seedance 2.0/2.5, Kling 3.0, VEO 3.x, PixVerse) | Video Studio / Media | Video generation (15 s Seedance 2.0, up to 30 s Seedance 2.5) | Credits |
| 46 | **Director Mode** (Jun 2026) | Video Studio | Multi-shot AI short drama with consistent characters, scenes, props | Credits |
| 47 | **AI stickers** | Stickers | Prompt to sticker | Credits |
| 48 | **AI text effects / AI fonts** | Text | Prompt-generated text styling | Credits |
| 49 | **Remove objects / AI eraser** | Video/Image | Inpaint objects away | Pro/credits |
| 50 | **Old photo restoration / Colorize** | Image tools | Restoration | Credits |
| 51 | **Product photo / AI background** | Commerce tools | Product shots on AI backgrounds | Credits |
| 52 | **AI caption emoji / keyword highlight** | Captions | Auto-insert emojis and highlights | Pro |
| 53 | **Copyright check** | Export | Scans music for copyright issues before posting | Pro/business |
| 54 | **Smart highlight / Auto cover** | Cover | Suggests cover frames | Free |
| 55 | **Design Studio agent + Skills** (Aug 2026) | Web | Infinite-canvas AI design with reusable workflows | Credits |
| 56 | **Content Credentials (C2PA) + AI labels** | Export | Marks AI-generated content | Automatic |

---

## 10. CapCut — Keyframes, Masks, Chroma Key, PiP, Compound Clips, Templates, Stock

### 10.1 Keyframes

| Aspect | Behavior |
|---|---|
| Creation | Click the **◇** next to any keyframable property (scale, position, rotation, opacity, volume, mask params, color adjust values, filter intensity, effect params, text properties) to add a keyframe at the playhead. Changing a value while the playhead sits on a keyframe updates it. **Auto-keyframe rule**: once a property has ≥1 keyframe, changing it elsewhere **automatically adds** a new keyframe |
| Timeline display | ◆ diamonds on the clip at keyframe positions; Alt/Option+K toggles a keyframe panel/lane |
| Navigation | ◀ ▶ arrows beside the property jump to prev/next keyframe |
| Easing / interpolation | Right-click a keyframe (or the "Graph"/curve icon) → **Keyframe curves/presets**: Linear, Ease in, Ease out, Ease in-out, plus custom bezier presets (desktop "Graph" panel). Mobile shows a "Graphs" button with presets |
| Bulk | Select multiple keyframes (drag-select) to copy/paste/delete |
| Hold | Not a first-class hold interpolation in older builds; newer builds add "Hold" |
| Reset | Delete keyframe; reset property resets all |

### 10.2 Masks

See §8.1.3. Keyframable; invertible; multiple masks in 2025+ builds. **Text mask** and **pen mask** (custom bezier path) arrived on desktop in 2025. Masks on **adjustment layers** let you color only part of the frame.

### 10.3 Chroma key

Video → Remove BG → Chroma key: eyedropper color, Intensity, Shadow, (Edge feather, Spill). Works on any track. Stock library includes green-screen clips. "Remove BG" **auto** is the AI alternative.

### 10.4 Picture-in-picture / Overlay

| Action | How |
|---|---|
| Add as overlay | Drag media **above** the main track → new overlay track. Mobile: **Overlay → Add overlay** |
| Move to main track / to overlay | Right-click → "Move to main track" / mobile "Switch to main track" / "Switch to overlay" |
| Layering | Track order; the **Layer** setting in some builds; **Free layer** project option |
| Composite | Blend modes + opacity; masks; Remove BG |
| Split-screen | Effects → Split; or manual PiP with transform; templates |

### 10.5 Compound clips

- Select clips, then right-click → **Create compound clip** (Alt/Option+G). They collapse into one clip on the track.
- **Double-click** opens it in a nested timeline with a breadcrumb back.
- **Undo compound** (Alt/Option+Shift+G) un-nests.
- Compound clips accept effects, speed, animation, and masks as one unit.
- Common use: applying a speed ramp to a multi-clip sequence, or an animation to a group.
- Separate from **Group** (Ctrl+G), which just binds selection without nesting.

### 10.6 Templates

- Template consumption (§5.10) is CapCut's growth engine, especially on mobile where templates are a first-class tab.
- Templates expose **replaceable media slots** (with required durations) and **editable text slots**. Everything else is locked unless you "Edit in CapCut" (convert to a full project).

### 10.7 Stock libraries

| Library | Types |
|---|---|
| CapCut Library | Stock video, green screen, backgrounds, intros, overlays |
| Audio library | Music, SFX, TikTok sounds |
| Text templates, stickers, effects, filters, transitions | Downloadable assets |
| AI generation | Images, video, music, stickers |
| Fonts | Hundreds, with a commercial-use filter |

**Licensing UX:** a "Commercial use" toggle/filter and "Copyright-cleared" labels, mainly for business accounts.

---

## 11. CapCut — Export & Publishing

### 11.1 Desktop export dialog

The dialog shows a **cover thumbnail** with an "Edit cover" link on the left and settings on the right.

| Field | Options |
|---|---|
| **Title / Name** | Filename |
| **Export to** | Folder picker |
| **Video** checkbox | Enable video export |
| Resolution | 480p, 720p, 1080p, **2K**, **4K** (8K not supported) |
| Bit rate | **Lower**, **Recommended**, **Higher**, **Custom** (Mbps field / VBR-CBR on some builds) |
| Codec | **H.264**, **HEVC (H.265)**, **AV1** (newer builds; GPU-dependent). ProRes not on consumer builds |
| Format | **MP4**, **MOV** |
| Frame rate | 24, 25, 30, 50, 60 fps (+ 23.976/29.97/59.94 in newer builds) |
| **Color space / HDR** | Rec.709 SDR; HDR10/HLG (when project color space is HDR) |
| **Optimize for** / Smart HDR | Some builds |
| **Audio** checkbox (**Export audio only**) | Format **MP3**, **WAV**, **AAC**, **FLAC**. Can export audio alongside or alone |
| **Export GIF** checkbox | GIF resolution 240p / 320p / 480p (for short clips) |
| **Captions** checkbox | Export captions as **SRT** or **TXT** (separate file) |
| **Copyright check** | Toggle (music) |
| **Export range** | Whole timeline or **In/Out range** (some builds); "Export selected clip" via right-click |
| Estimates | Duration, estimated **file size** |
| Pro check | If Pro features are used without a subscription: banner "This project contains Pro features" with **Remove** / **Subscribe** options |
| **Export** button | Progress with % and cancel. After export: **"Share to"** TikTok / YouTube / (Instagram/Facebook in some regions), "Open folder", "Edit again" |

### 11.2 Direct publishing

| Destination | Flow |
|---|---|
| **TikTok** | Linked account → caption, hashtags, privacy (Everyone/Friends/Only me), allow comments/duet/stitch, cover selection → post or save as draft in TikTok. One-click "Share to TikTok" also exists on mobile |
| **YouTube** | Google account → title, description, visibility, category, Shorts auto-detected for 9:16 ≤ 3 min |
| Others | Instagram/Facebook (some builds), and scheduled publishing via the **CapCut Commerce/Business** "Content scheduler" |

### 11.3 Mobile export

- Top-right **resolution chip** (e.g. "1080P ▾") opens a sheet with sliders: **Resolution** (480p, 720p, 1080p, 2K/4K), **Frame rate** (24/25/30/50/60), **Code rate/Bitrate** (Lower/Recommended/Higher), **Smart HDR** toggle, and an estimated file size.
- An **Export** arrow saves to the camera roll, then the share sheet (TikTok, Instagram, WhatsApp, Facebook, "Other").
- Pro features trigger a "Remove Pro features?" prompt.
- Template exports may append the **CapCut ending** clip, which you can delete in the timeline (also toggleable in settings with "Add default ending").

---

## 12. CapCut Mobile — Specifics

### 12.1 App navigation

| Tab (bottom bar) | Purpose |
|---|---|
| **Edit** (home) | **+ New project**. Shortcut row: AutoCut, Retouch, Auto captions, Remove BG, Product photos, AI expand, Text to image, Teleprompter, Camera, Long video to shorts. Projects list with cloud badge, "…" (Rename, Duplicate, Upload, Delete), Select mode |
| **Templates** | TikTok-style vertical feed and grid of templates by category; "Use template" |
| **Inbox** | Notifications |
| **Me** | Profile, creator templates, settings (Add default ending, Upload quality, etc.) |
| Cloud / Spaces | From the Edit tab |

### 12.2 Editor layout (portrait)

- **Top bar**: Close (X), help, resolution chip (export settings), **Export**.
- **Preview** in the middle, with a play button, timecode, ↶ ↷, and fullscreen.
- **Timeline** below, horizontally scrolling with a fixed center playhead. Pinch to zoom. The main track has a "+" at its end to add media and a mute-clip-audio toggle at its head, plus the **Cover** button.
- **Bottom toolbar** (nothing selected), scrollable: **Edit**, **Audio**, **Text**, **Overlay**, **Effects**, **Captions**, **Filters**, **Adjust**, **Stickers**, **Aspect ratio / Format**, **Background / Canvas**, **Retouch**, **Templates/AutoCut**.

### 12.3 Clip-selected tool strip (video clip)

When a clip is tapped, the bottom bar becomes a contextual strip (back arrow ← returns):

| Tool | Function |
|---|---|
| **Split** | Cut at the playhead |
| **Speed** | Normal / Curve |
| **Animation** | In / Out / Combo |
| **Delete** | Remove |
| **Volume** | Clip volume % (0–1000%) |
| **Fade** | Fade in/out (audio) |
| **Effects** | Clip effects |
| **Remove BG** | Auto / Custom / Chroma key |
| **Mask** | Shapes |
| **Chroma key** | Color key |
| **Crop** | Crop + ratio + rotation slider |
| **Mirror / Rotate** | Under Edit |
| **Reverse** | Reverse clip |
| **Freeze** | Freeze frame (3 s) |
| **Replace** | Swap source |
| **Duplicate** | Copy clip |
| **Adjust** | Color adjust |
| **Filters** | Clip filter |
| **Opacity** | Opacity % |
| **Stabilize** | Levels |
| **Voice effects / Voice changer** | Audio FX |
| **Extract audio** | Separate audio |
| **Noise reduction** | Audio denoise |
| **Enhance voice** | AI voice |
| **Enhance quality / Reduce noise** | AI video |
| **Camera tracking** | Subject centering |
| **Motion blur** | Blur |
| **Retouch** | Face/body |
| **Smooth slow-mo** | Interpolation |
| **Style / AI effects** | Stylize |
| **Switch to overlay** | Move layer |
| **Tracking** (overlays/text) | Motion tracking |

UX lessons:
- **Long-press a clip** to drag-reorder; the clips shrink to tiles while dragging.
- **Pinch** the timeline to zoom.
- **Two-finger pinch/rotate on the preview** to transform.
- The mobile **keyframe button** (◇+) sits above the timeline at the right; tapping adds a keyframe for *all* transform properties.

---

## 13. CapCut Desktop — Keyboard Shortcuts

Defaults for desktop (Windows / macOS). Users can rebind them via the keyboard icon in the top bar (or Settings → Shortcuts). Presets: CapCut / Premiere Pro / Final Cut Pro.

### 13.1 Project & general

| Action | Windows | macOS |
|---|---|---|
| New project | Ctrl+N | Cmd+N |
| Import media | Ctrl+I | Cmd+I |
| Export | Ctrl+E | Cmd+E |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z (Ctrl+Y on some builds) | Cmd+Shift+Z |
| Copy / Cut / Paste | Ctrl+C / Ctrl+X / Ctrl+V | Cmd+C / Cmd+X / Cmd+V |
| Select all | Ctrl+A | Cmd+A |
| Cycle material (asset) panel tabs | Tab | Tab |
| Back to edit page / home | Ctrl+Alt+Q | Cmd+Option+Q |
| Quit | Ctrl+Q | Cmd+Q |

### 13.2 Playback & navigation

| Action | Windows | macOS |
|---|---|---|
| Play / Pause | Space | Space |
| Previous / next frame | ← / → | ← / → |
| Jump several frames | Shift+← / Shift+→ | Shift+← / Shift+→ |
| Previous / next edit point (cut) | ↑ / ↓ | ↑ / ↓ |
| Go to start / end | Home / End | Home / End (Fn+←/→) |
| Mark In / Mark Out | I / O | I / O |
| Fullscreen preview | Ctrl+Shift+F | Cmd+Ctrl+F |
| Exit fullscreen | Esc | Esc |
| Fit preview to window | Alt+Shift+Z | Option+Shift+Z |
| Hold to ignore canvas alignment guides | Hold Ctrl | Hold Cmd |

### 13.3 Editing

| Action | Windows | macOS |
|---|---|---|
| Select tool | A | A |
| Split (blade) tool mode | B | B |
| Split selected at playhead | Ctrl+B | Cmd+B |
| Split all tracks at playhead | Ctrl+Shift+B | Cmd+Shift+B |
| Delete left of playhead | Q | Q |
| Delete right of playhead | W | W |
| Delete | Backspace / Delete | Delete |
| Select clips left / right of playhead | [ / ] | [ / ] |
| Enable / disable clip | V | V |
| Group / Ungroup | Ctrl+G / Ctrl+Shift+G | Cmd+G / Cmd+Shift+G |
| Create compound clip | Alt+G | Option+G |
| Undo compound clip | Alt+Shift+G | Option+Shift+G |
| Match cut | Ctrl+J | Cmd+J |
| Select area by clip | Shift+X | Shift+X |
| Clear selected area | Alt+X | Option+X |
| Add marker | M | M |
| Extract / restore audio | Ctrl+Shift+S | Cmd+Shift+S |
| Speed panel | Ctrl+R | Cmd+R |
| Switch to curve speed | Shift+B | Shift+B |
| Volume up / down | Ctrl+. / Ctrl+, | Cmd+. / Cmd+, |
| Keyframe panel | Alt+K | Option+K |

### 13.4 Timeline modes & zoom

| Action | Windows | macOS |
|---|---|---|
| Main track magnet | P | P |
| Auto snapping | N | N |
| Linkage | ~ | ~ |
| Preview axis (skimming) | S | S |
| Timeline zoom in / out | Ctrl+= (Ctrl++) / Ctrl+- | Cmd+= / Cmd+- |
| Zoom timeline with wheel | Ctrl+scroll | Cmd+scroll |
| Horizontal scroll | Alt+scroll | Option+scroll |
| Zoom to fit | Shift+Z | Shift+Z |

### 13.5 Captions / text

| Action | Windows | macOS |
|---|---|---|
| Split caption into two (in caption list) | Enter | Return |
| Line break in caption | Ctrl+Enter | Cmd+Return |
| Resize text box from center | Alt+drag | Option+drag |


---

# PART B — WONDERSHARE FILMORA

## 14. Filmora — Overview & Version History

| Item | Detail |
|---|---|
| Developer | Wondershare Technology (Shenzhen) |
| Platforms | Windows, macOS (desktop flagship); Filmora mobile (iOS/Android, formerly FilmoraGo); Filmora web tools (online AI tools) |
| Positioning | "Pro features made easy": a prosumer desktop NLE with a classic multi-track timeline, large effects store (Filmstock), and dense AI tooling. Its audience skews more YouTube/education/business than CapCut's |
| Current major | **Filmora 15** (15.0.1 Nov 2025 → 15.7 Jul 2026; newer point releases may exist as of Oct 2026) |
| Timeline model | Classic **free multi-track** timeline (tracks numbered, video above, audio below), with an optional **Magnetic Timeline** (14+) and **Auto Ripple**; **Dual-timeline** (source + timeline monitors) since 15.0 |
| AI credits | Most generative/advanced AI features consume **AI credits**. Plans include a monthly or one-time credit allowance and extra packs can be bought |

### 14.1 Version highlights (14 → 15.7)

| Version (date) | Key additions |
|---|---|
| **14.0** (Sep 2024) | Smart Scene Cut, **Smart Short Clips**, AI Sound Effect, AI Face Mosaic, **AI Video Enhancer**, AI Voice Enhancer, **AI Translation with lip-sync**, **AI Color Palette**, Copilot 2.0, AI Image upgrade, AI Portrait Cutout upgrade, **Multi-Camera editing**, **Magnetic Timeline**, Bezier keyframe panel, **Planar Tracking**, Video Denoise, Advanced Compression, SVG import |
| 14.1 (Nov 2024) | Filter texts for commercial use, basic 3D effect, detachable compound clips |
| 14.2 (late 2024) | Audio to Video, Image to Video, AI Object Remover optimization, **Text Bezier path animation** |
| 14.2.5 (Dec 2024) | Social scheduled posting + analytics, audio sticker resources, new TTS voices, drawing lines on the player |
| 14.4 (Mar 2025) | Character to Video, **Solo track**, **multi-platform publishing**, export panel improvements |
| 14.5.16 (May 2025) | AI Idea to Video, AI Photo Object Remover, speech-to-text auto-correction, **Asset Center**, extra RAW formats |
| 14.6 (Jun 2025) | **8K and up to 120 fps** editing; **AI Mate** (renamed from Copilot) |
| 14.7 (Jun 2025) | **Mocha Filmora** plugin, 48 kHz high-precision audio, 32-bit float export, audio ducking fades, image-to-video start/end frame, AI Image Stylizer, favorites tagging |
| 14.7.15 / 14.8 (Jul 2025) | 47 bubble text presets, Veo 3 image-to-video and text-to-video, glow text, custom color layers (solid/gradient), unified AI Denoise |
| 14.9 (Aug 2025) | **Anchor point**, Mocha timeline insert, GPU AI Video Enhancer (no time limit), AI Vocal Remover (≤1 h), GoPro lens correction; 14.9.10: AI Music + AI SFX prompts, FLAC export, recorder BG removal/blur |
| 14.10.4 (Sep 2025) | Nano Banana for AI Image, 1080p image-to-video with lower credit cost, multi-image references, multi-monitor recording |
| **15.0.1** (Nov 2025) | **AI Extend** (extend video/audio in the timeline), AI Object Remover "Magic Box", Smart Cutout upgrade, **Dual-timeline editing** (source + timeline monitors), **Import subprojects as compound clips**, **Dynamic Captions** (batch), **Pen Tool**, **Animated Charts**, 32-bit audio pipeline |
| 15.1.0 (Dec 2025) | AI Mate conversational assistant; Text/Image to Video with **Sora 2, Veo 3.1, Kling 2.5**; **Auto Normalization (LUFS/LKFS presets)**; **Audio Gain** (fixed/relative/peak) |
| 15.2.7 (Feb 2026) | **AI Relight**, **Topaz-powered upscaling**, AI Image/Sticker model upgrades, pen tool end shapes, path-follow direction |
| 15.3.0 (Mar 2026) | Nano Banana 2, AI Effects (generative grain), **HDR Color Wheel (6+1 zones)**, HSL eyedropper, **Flicker Removal**, drawing tools (shapes to editable paths), template auto-fill |
| 15.4.2 (Apr 2026) | GPT Image 2, **Seedance 2.0** T2V/I2V, Image to Prompt, AI Image Enhancer, **AIGC transitions** (generated from first/last frames), gradient colors in the Color Editor, animated chart upgrades, rename projects/change save path, redesigned recorder toolbar |
| 15.5.2 (May 2026) | **AI Eye Contact**, **AI Night View**, **Motion Blur**, text angle offset, upgraded HDR wheel, pen tool custom materials, **Idea to Video Agent**, window recording |
| 15.6 (Jun 2026) | Pen-tool keyframe presets (Linear/Ease In/Out/In-Out), path orientation, **Generative Enhance** for low-res footage, custom text textures, auto-fill text gaps, **Chapter Progress Bar** export, **Teleprompter** in the recorder, recording markers imported to the timeline |
| 15.7 (Jul 2026) | **Unified multi-mask workflow** with edge control, **LUT export** + thumbnail previews, color preset management, **Retouch (makeup & beauty)**, **Multi Frame Effect** (split screen), split-screen templates with swappable media |

---

## 15. Filmora — Pricing & Free vs Paid

### 15.1 Plans (US list, approx. 2026; frequent promos; varies by region)

| Plan | Price (approx.) | Platforms | Updates | AI credits | Notes |
|---|---|---|---|---|---|
| **Free** | $0 | Win/Mac | Latest | Small trial allowance | **All editing features usable; export carries a Filmora watermark**. Some AI tools are trial-limited |
| **Annual (Basic)** | ~$49.99/yr | One OS | All updates during the term | ~200/mo (reported) | No watermark; may limit cloud/AI |
| **Annual Advanced / Cross-Platform** | ~$59.99–69.99/yr | Win + Mac (+ mobile on cross-platform) | All updates | ~1,000/mo (reported) + 10 GB cloud | Most popular tier |
| **Perpetual** | ~$79.99 one-time (some regions $99.99 Win / $109.99 Mac) | One OS | **Current major only** ("Filmora 15 updates only"; Filmora 16 needs an upgrade) | ~1,000 one-time pool | No watermark forever on v15 |
| **Team / Business / Education** | Per seat | — | — | — | Commercial licensing, invoicing |
| **AI credit packs** | Add-on | — | — | Purchased | Generative AI (video gen, upscaling, voice clone…) |
| **Filmstock / Creative Assets** | Separate subscription (Standard/Premium) or bundle | — | — | — | Premium effects, templates and stock beyond the built-in set |

### 15.2 What's free vs paid

| Area | Free | Paid plan | Credits |
|---|---|---|---|
| Editing, effects, transitions, titles (built-in) | ✅ (watermark on export) | ✅ | — |
| Watermark-free export | ❌ | ✅ | — |
| 4K/8K export | Watermarked | ✅ | — |
| Premium Filmstock / Creative Assets | Preview (watermark) | Bundle/subscription | — |
| Basic AI (Auto reframe, silence detection, scene detection, beat sync, audio ducking, smart cutout, AI portrait, motion tracking) | ✅ trial / usable with watermark | ✅ | Usually no credits |
| Generative AI (text/image to video, AI image, AI music, AI SFX, AI Extend, Idea to Video, video upscaler (Topaz/Generative Enhance), AI translation, voice clone) | Limited trials | ✅ | **Consumes credits** |
| Speech-to-text / TTS | Limited minutes/characters | Larger quota | Some credit-based |
| Cloud storage | — | 1–10 GB+ | — |

**UX note:** Filmora lets free users *use everything* and watermarks the output, which is a different funnel from CapCut's crown-gated assets. A 💎/crown "paid" badge appears on premium resources. AI features show a **credit-cost chip** (e.g. "⚡10") on the Generate button.

---

## 16. Filmora — Startup Window & Project Creation

### 16.1 Startup (launcher) window

| Region | Contents |
|---|---|
| Left nav | **Create Project**, **Cloud Project/Drive**, **Templates**, **Toolbox / AI tools**, **Tutorials/Learn**, **Creator Hub**, account + plan, settings |
| Top hero | **Aspect ratio dropdown** (16:9, 9:16, 1:1, 4:3, 3:4, 21:9) + **"New Project"** button + **"Open Project"** (.wfp files) |
| AI quick tools row | Text to Video, Image to Video, AI Image, **Smart Short Clips**, **Smart Scene Cut**, AI Mate/Copilot, **Auto Beat Sync**, **Instant Cutter** (lossless trim/merge for long footage), **Screen Recorder**, **Instant Mode** (pick media → auto-edited video from a template), AI Translation, AI Vocal Remover, AI Video Enhancer, Idea to Video Agent, Auto Reframe (standalone), **Multicam** |
| Recent projects | Thumbnails with name, date, duration; right-click: Rename (15.4+), Open location, Remove, **Change save path** |
| Templates | Template gallery entry |

### 16.2 Project settings (File → Project Settings, or the gear in the player)

| Setting | Options |
|---|---|
| Aspect ratio | 16:9, 4:3, 1:1, 9:16, 3:4, 21:9, Custom |
| Resolution | 640×360 up to **7680×4320 (8K)**; presets per ratio (1280×720, 1920×1080, 2560×1440, 3840×2160, 4096×2160…) or custom |
| Frame rate | 23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, … up to **120 fps** (14.6+) |
| Color space | **SDR – Rec.709**, **HDR – Rec.2100 HLG**, **HDR – Rec.2100 PQ** |
| Audio | 48 kHz high-precision mode (14.7+) |
| Rendering / Proxy | Proxy files (auto for >1080p), render preview cache, GPU acceleration toggles (Preferences → Performance) |
| Project name/location | Save path (renamable since 15.4) |

**Auto-match rule:** when the first clip's resolution/fps differs from the project, Filmora asks *"Match to Media?"* (Match to media / Keep project settings). This is a good pattern to copy.

**Preferences (File → Preferences):** General (language, check updates, GPU rendering, auto-save interval), New Project (default ratio/fps), Editing (default image/transition/title durations; Ripple on delete; Snap; Magnetic timeline default; render preview), Performance (hardware encode/decode, Intel/NVIDIA/AMD/Apple Silicon, background rendering), Save (autosave location, proxy, cache, clean-up).

---

## 17. Filmora — Full UI Layout & Top Asset Tabs

```
┌ Menu bar: File Edit Tools View Help | Project name | Cloud ↑ | Account | Export ▸ (top-right, highlighted) ─────────────┐
│ ┌ Asset library (top-left) ──────────────┐ ┌ Player (top-center/right) ─────────┐ ┌ Property panel (right) ───────┐ │
│ │ Tabs: Media | Stock Media | Audio |    │ │ (Dual monitor in 15: Source | Time-│ │ Contextual: Video | Audio |   │ │
│ │ Titles | Transitions | Effects |       │ │ line) Quality ▾, Full/Fit, ruler,  │ │ Color | Speed | Animation |   │ │
│ │ Filters | Stickers | Templates |       │ │ playback controls, snapshot, mark  │ │ AI tools (sub-tabs inside)    │ │
│ │ (AI Media / Elements)                  │ │ in/out, volume, fullscreen         │ │                               │ │
│ │ Left sub-tree: Project Media, Global…  │ │                                    │ │                               │ │
│ └────────────────────────────────────────┘ └────────────────────────────────────┘ └───────────────────────────────┘ │
│ ┌ Timeline toolbar: tool▾ ↶ ↷ 🗑 ✂ crop T  … (customizable) ║ render · marker · mic · AI · snap · link · zoom ─────┐ │
│ │ Ruler; tracks numbered V3 V2 V1 (main track) ... A1 A2; track header: lock, eye, mute, height; Add track (+)   │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Layout presets** (View / top-right layout icon): Default, Organize (bigger library), Editing (bigger timeline), Short-video (vertical player), Dual monitor.
- Panels are dockable/resizable.
- **Customize toolbar** lets the user choose which timeline buttons appear.

### 17.1 Media

| Sub-tree item | What it is |
|---|---|
| **Project Media** | Imported files. "Import" dropdown: Import media files, Import a media folder, Import from a camera/phone, **Import with Instant Cutter**, Record from webcam, **Record PC screen**, **Record voiceover**, Import subproject (15.0, as a compound clip). Folders, sort, search, thumbnail size, used-in-timeline ✓ markers |
| **Global Media / Asset Center** | Assets shared across projects; favorites |
| **Cloud Media** | Wondershare Drive |
| **Influence Kit** | Pre-made social media elements |
| **Adjustment Layer** | Drag in to create an adjustment layer |
| **Compound Clip** | Compound clips in the project |
| **Sample Color** | Solid color clips (black, white, color bars) + **custom color layers** (solid/gradient, 14.8+) |
| **Sample Video / Sample Green Screen** | Built-in countdowns, green-screen elements, intros |
| **Proxy / Smart Scene Cut / Auto-captions results** | Generated items |

### 17.2 Stock Media

Integrated search across **Filmora stock (Filmstock)**, **Pixabay**, **Pexels**, **Unsplash** (images), **GIPHY**, plus **AI Image** and **AI Video** generation entry points. Previews download on add, and licensing is labeled.

### 17.3 Audio

| Sub-section | Contents |
|---|---|
| **Music** | Categories (Young & Bright, Tender & Sentimental, Rock, Folk, Electronic, Vlog, Cinematic…), Filmstock premium music, search |
| **Sound Effects** | Categories |
| **AI Music** | Prompt/genre/mood/duration → generated music (credits) |
| **AI Sound Effect** | Text-prompted SFX (credits) |
| **Audio stickers** | Short meme sounds (14.2.5+) |
| **Recorded** | Voiceover recordings |
| **Text-to-Speech / Voiceover** | Shortcuts |

### 17.4 Titles

| Sub-section | Contents |
|---|---|
| **Titles** (Default/Basic) | Plain text and styled titles |
| **Openers / Lower Thirds / Callouts / Subtitles / End Credits** | Pre-animated title groups |
| **Bubble text** | 47 presets (14.7.15+) |
| **AI Text / Dynamic Captions** | Animated caption styles (15.0) |
| **3D titles / Glow** | Newer styles |
| **Commercial-use filter** | 14.1+ |

### 17.5 Transitions

Categories: Basic (Dissolve, Fade, Cross zoom), **Shape/Wipe**, Slide, Speed blur, Zoom, 3D, Warp, Dynamic, Glitch, Light leaks, Ripple & Dissolve, Countdown, Game, Hand-drawn, Filmstock packs, **AIGC transitions** (15.4: generated motion between two frames, credits).

Drag between clips. Inspector: **Duration**, **Position/Alignment** (Overlap / Prefix / Postfix — whether the transition centers on, ends at, or starts at the cut), **Apply to all**. Double-clicking a transition opens its properties. Default transition duration is set in Preferences.

### 17.6 Effects

| Sub-section | Contents |
|---|---|
| **Video Effects** | Hundreds: Blur, Distortion, Retro, Lens flare, Light leaks, Overlay, Shake, Glitch, VHS, Frame/Border, Split screen (Multi Frame Effect 15.7), Utility (mosaic, tilt-shift, auto-enhance), **Motion Blur** (15.5) |
| **Body Effects** | Human-segmentation effects (outline, clone, neon, glow) |
| **AI Effects** | Generative (anime/cartoon, AI grain 15.3), **AI Portrait** effects (background swap etc.) |
| **Face props / AR stickers** | Face-tracked props |
| **Boris FX / NewBlue FX** | Third-party plugin libraries (Boris Continuum units, NewBlue Titler/Filters) bundled in some plans |
| **Audio effects** | Reverb, echo, phone, etc. |
| **Masks** | Shape mask presets as effects (older pattern) |
| **Utility** | Mosaic, Face-off, Tilt-shift, Image mask, Chroma key, Auto enhance |
| **Filters** (separate tab in 14+) | Color looks (Cinematic, Film, Vintage, B&W, Food…) with intensity; dropped on clip or as a layer |

Effects apply **onto a clip** (listed in the clip's Effects section of the inspector, toggle/delete/reorder) or **as a track layer** affecting everything below for its duration (adjustment-style). The drop target determines which.

### 17.7 Stickers / Elements

Animated stickers (Social, Emoji, Arrows, Shapes, Frames, Gaming, Holiday), GIPHY, **AI Sticker** (prompt → sticker), **Animated Charts** (15.0: bar/line/pie with data entry, percentages, axis length), **Drawing tools / Pen tool** (15.0+: draw shapes and paths on the player, stroke effects, path-follow animation, end shapes, keyframe presets).

### 17.8 Templates

Templates (intro, vlog, slideshow, social, **split-screen templates** 15.7). Drag a template onto the timeline, and it becomes a **template clip** with **replaceable placeholders** (drop media on a placeholder, or **auto-fill** 15.3). **Template mode** shows placeholders in a strip. Templates can be "ungrouped" to edit internals. **Instant Mode** creates a whole video from a template + media.

---

## 18. Filmora — Player, Timeline Toolbar & Track Behaviors

### 18.1 Player

| Control | Behavior |
|---|---|
| **Dual monitor** (15.0+) | **Source monitor** (preview a media item, mark in/out, Insert/Overwrite/Append to timeline) and **Timeline monitor**. Toggle single/dual |
| Playback | Previous frame, **Play/Pause**, Next frame, **Stop**, loop playback, playback speed (J/K/L style in some builds) |
| Timecode | Current/total, click to type |
| **Quality ▾** | Full, 1/2, 1/4, 1/8, **Auto** playback resolution |
| **Fit / zoom** | Fit, 25–200% |
| **Snapshot** 📷 | Saves the current frame to Project Media (PNG/JPG) |
| **Mark in / Mark out** | Player-level (I/O). Used for export range and source edits |
| **Render preview** | Renders the selected area for smooth playback (green bar on the ruler when rendered; red/yellow = needs render) |
| **Safe zones / grid** | Title/action safe guides, social safe area |
| **Volume** | Preview volume, **Solo track** (14.4) |
| **Fullscreen** | Alt+Enter |
| On-canvas | Transform handles, **anchor point** (14.9+), crop handles in crop mode, mask handles, motion-tracking box, planar-tracking 4-corner plane, drawing/pen tools, text inline edit |
| Color scopes | View → Scopes: waveform, vectorscope, histogram, RGB parade (in Color panel) |

### 18.2 Timeline toolbar (customizable)

Default left group (common 14/15 layout; extra tools under "…" / customizable):

| Button | Shortcut | What it does |
|---|---|---|
| **Selection / Blade tool ▾** (also Range select, Hand) | V / C (Blade), (verify) | Pointer vs. razor that cuts where clicked |
| **Undo / Redo** | Ctrl+Z / Ctrl+Y (Mac Cmd+Shift+Z) | History |
| **Delete** | Delete | Removes the clip, leaving a gap (unless Ripple/Auto-ripple or Magnetic is on) |
| **Split** ✂ | Ctrl/Cmd+B | Splits the clip(s) at the playhead |
| **Crop** | Alt+C (Crop and zoom) | Crop dialog: crop rectangle with ratio presets + **Pan & Zoom (Ken Burns)** start/end frames |
| **Text** (T) | — | Adds a default title at the playhead |
| **Speed** (dropdown) | Ctrl+R | Uniform speed / **Speed ramping** / **Reverse** / **Freeze frame** / Slow/Fast presets |
| **Color** | — | Opens the color panel / color match |
| **Keyframe** | — | Adds a keyframe / opens Animation |
| **Freeze frame** | Alt+F (verify) | Inserts a still frame (default 5 s) at the playhead |
| **Audio** (dropdown) | — | Detach audio (Ctrl+Alt+D), Mute (Ctrl+Shift+M), Adjust audio, Audio ducking, Silence detection, Beat detection |
| **Stabilization**, **Smart cutout**, **Motion tracking**, **Planar tracking**, **Auto reframe**, **Scene detection**, **Silence detection**, **Speech-to-text**, **Text-to-speech**, **Auto beat sync**, **Green screen**, **Split screen**, **Duration**, **Mark in/out**, **Snapshot**, **AI Extend**, **AI Mate** | — | Optional toolbar buttons (via "Customize toolbar") |

Right group:

| Button | What it does |
|---|---|
| **Render preview** | Renders the timeline for real-time playback |
| **Marker** (M) | Adds a marker; double-click to name/color/comment; markers can export as **YouTube chapters** |
| **Record voiceover** 🎤 | Mic recording at the playhead (input, volume, countdown, mute project) |
| **AI tools menu** | AI Mate, Smart Short Clips, Smart Scene Cut |
| **Mixer / Audio meter** | Audio mixer (per-track volume/pan, master) + loudness meters |
| **Magnetic timeline** toggle | Main track (track 1) behaves magnetically (no gaps; insert ripple) |
| **Auto ripple** toggle | Deleting/trimming ripples subsequent clips on the same track |
| **Snapping** toggle (N) | Snap to edges/playhead/markers |
| **Link** toggle | Linked selection of video/audio |
| **Show/Hide track options** | Track height/display (thumbnail-only, waveform-only) |
| **Zoom out / slider / Zoom in / Zoom to fit** | Ctrl+-, Ctrl+=, Shift+Z |
| **Customize toolbar** ⚙ | Choose buttons |

### 18.3 Track model & behaviors

| Aspect | Behavior |
|---|---|
| Tracks | **Numbered** video tracks (Track 1 = bottom / main, higher numbers on top) and audio tracks below. Up to 100+ tracks. **Track manager** (right-click header → Add/Delete track, Delete empty tracks) |
| Track header | **Lock** 🔒, **Hide** 👁, **Mute** 🔈, track height drag, track name, **Solo** (14.4) |
| Clip colors | Video blue, audio green, titles orange, effects purple, etc. Customizable (right-click → Select color) |
| Clip badges | Speed, effects ★, keyframes ◆, masks, audio waveform, proxy, transitions |
| **Magnetic timeline** | Main track only (like CapCut's main track magnet) |
| Gaps | Allowed. Right-click a gap → **Delete gap / Ripple delete**. Shift+Delete = ripple delete |
| Insert vs Overwrite | Drag modes plus **Shift+I insert / Shift+O overwrite** from the source monitor |
| Trimming | Edge drag (ripple if auto-ripple), **Trim start/end to playhead** (Alt+[ / Alt+]), slip/slide in newer builds, Roll |
| Detach audio | Ctrl+Alt+D → separate audio clip with a link chain icon |
| **Grouping** | Ctrl+G / Ctrl+Alt+G (verify) |
| **Compound clip** | Right-click → Create compound clip (nesting); double-click to enter; detachable (14.1); **Dual timeline** shows the compound's internals in a second timeline tab (15.0) |
| **Multicam** | Select angles → Create multi-camera clip (sync by audio or timecode) → live angle switching in the multicam viewer |
| Right-click clip menu | Cut/Copy/Paste, Delete, Ripple delete, Split, Trim start/end to playhead, **Speed and Duration**, **Freeze frame**, **Reverse**, **Detach audio**, Mute, **Copy effects / Paste effects**, Paste attributes, **Adjust audio**, **Color match**, **Stabilization**, **Smart cutout**, **Motion tracking**, **Auto reframe**, **Scene detection**, **Speech-to-text / Text-to-speech**, **Silence detection**, **Beat detection**, Enable/Disable clip, Show properties, Group, Create compound clip, Create multi-camera clip, Rename, Select clip color, Show in library, **Add to Favorites / Save as custom preset** |

---

## 19. Filmora — Right-Side Property Panel

Contextual tabs when a **video clip** is selected (14/15): **Video** | **Audio** | **Color** | **Speed** | **Animation** | (**AI Tools**). Each has sub-tabs. A **keyframe ◇** sits next to keyframable parameters, a toggle switch heads each section (enable/disable that section without losing values), and there is a ↺ reset per section. A **"Save as custom" / "Apply to all"** pair sits at the bottom.

### 19.1 Video tab

#### Video → Basic

| Section | Controls |
|---|---|
| **Transform** | Rotate (°), **Flip** (horizontal/vertical), **Scale** (%; uniform lock), **Position** X/Y, **Anchor point** (14.9+) |
| **Compositing** | **Blend mode** (Normal, Darken, Multiply, Color burn, Linear burn, Lighten, Screen, Color dodge, Linear dodge, Overlay, Soft light, Hard light, Vivid light, Linear light, Pin light, Hard mix, Difference, Exclusion, Hue, Saturation, Color, Luminosity…), **Opacity** |
| **Background** | Fill empty canvas: Blur (style + level), Color, Image pattern |
| **Auto enhance** | One-click enhancement + amount |
| **Drop shadow** | Type, distance, blur, transparency, color, angle |
| **Stabilization** | Analyse; smooth level; edge processing (Fixed / Reflection / Tile / Extend) |
| **Lens correction** | Camera model presets (GoPro, DJI…) + level |
| **Video Denoise** | Strength (AI) |
| **Flicker removal** (15.3) | Mode/strength |
| **Motion blur** (15.5) | Amount |
| **Border / corner** | Rounded corners, borders (in newer builds) |

#### Video → Mask (15.7 unified multi-mask)

| Item | Detail |
|---|---|
| Shapes | Rectangle, Circle, Line (linear), Mirror, Star, Heart, **Pen/Draw mask** (custom bezier), **Text mask**, Image mask, **AI mask / Smart mask** (auto subject/sky/person) |
| Per-mask controls | Position, Rotation, Width/Height, **Feather/Blur strength**, Roundness, **Opacity**, **Invert**, **Edge control** (expand/contract, 15.7) |
| Multi-mask | Stack multiple masks with **Add / Subtract / Intersect** modes (15.7) |
| Keyframes + tracking | Masks are keyframable and can **follow motion/planar tracking** |

#### Video → AI Tools (sub-tab)

| Tool | Controls / behavior |
|---|---|
| **AI Portrait** | Person segmentation; remove BG, replace with color/image; edge thickness/feather; portrait stickers/effects |
| **Smart Cutout** | Brush the subject on a frame → AI propagates through the clip (**Click/Brush/Box** modes, preview transparency grid, "Start Smart Cutout"); refine per frame |
| **Chroma Key** (Green Screen) | Color picker, Tolerance (offset), Edge feather, Edge thickness, Alpha channel view, Spill removal |
| **Motion Tracking** | Draw a box → **Start tracking** → choose an element to link (title, sticker, mosaic, image, video); also used for **AI Face Mosaic** |
| **Planar Tracking** (14.0) | Track a planar surface (screen, sign) with 4 corners: **Auto / Advanced**; attach media → corner-pin replace, perspective-correct |
| **Mocha Filmora** (14.7) | Integrated Boris FX Mocha planar tracker for complex tracking; insert from the timeline (14.9) |
| **AI Video Enhancer** | Upscale/denoise/sharpen (GPU, no time limit since 14.9; Topaz models 15.2; **Generative Enhance** 15.6) |
| **AI Object Remover** | Brush or Magic Box (15.0) → inpaint over time |
| **AI Face Mosaic** | Auto-detect faces → blur/pixelate, tracked |
| **AI Relight** (15.2) | Light direction/color/intensity |
| **AI Eye Contact** (15.5) | Redirects gaze to the camera |
| **AI Night View** (15.5) | Low-light enhancement |
| **Auto Reframe** | Target ratio + subject tracking speed |
| **AI Extend** (15.0) | Generates additional frames/audio beyond the clip end (credits) |
| **Retouch** (15.7) | Beauty/makeup: smoothing, whitening, reshape, makeup presets |

### 19.2 Color tab

| Sub-tab | Controls |
|---|---|
| **Basic** | **Color presets / LUT** (3D LUT dropdown + import .cube/.3dl, intensity; **LUT export** 15.7), **AI Color Palette** (pick a reference image/clip and AI transfers its palette, strength), **Color match** (match to another clip's frame; compare view), **White balance** (Temperature, Tint, auto WB eyedropper), **Light** (Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks), **Adjust** (Vibrance, Saturation, Sharpen), **Vignette** (amount, size, roundness, feather, exposure, highlight), **Save as preset**, preset management (15.7) |
| **HSL** | 8 color channels × Hue/Saturation/Luminance + **HSL eyedropper** (15.3) |
| **Curves** | RGB master, Red, Green, Blue curves (+ Hue vs Sat style curves in newer builds) |
| **Color wheels** | Highlights / Midtones / Shadows / Global wheels with luminance; **HDR Color Wheel** (15.3: 6 luminance zones + global, upgraded in 15.5) |
| **Gradient colors** (15.4) | In the color editor for text/shapes |
| **Scopes** | Waveform, Vectorscope, Histogram, Parade (View → Video scopes) |
| **Compare** | Split-screen before/after toggle in the player |

**Adjustment Layer** (Media → Adjustment Layer): a layer carrying Color + Effects settings over tracks below.

### 19.3 Audio tab (audio clip or video's audio)

| Section | Controls / behavior |
|---|---|
| **Basic → Volume** | dB slider, keyframable; volume rubber-band on the clip |
| **Audio Gain** (15.1) | **Fixed** gain, **Relative** gain, **Peak** normalize modes |
| **Auto Normalization** (15.1) | **LUFS/LKFS presets** (e.g. −14 LUFS YouTube/Spotify, −16 podcasts, −23 EBU R128, −24 ATSC) |
| **Fade in / Fade out** | Durations; also draggable fade handles on the clip corners |
| **Pan** | L/R |
| **Pitch** | Semitone shift |
| **Audio Ducking** | Select the speech clip → "Lower the volume of other clips" + **ducking amount %**, fades (14.7) |
| **Denoise** (unified **AI Denoise** 14.8) | **AI Speech Enhancement**, Normal denoise, **Wind removal**, **DeReverb**, **Hum removal** (50/60 Hz), **Hiss removal**, strength sliders |
| **AI Voice Enhancer** | Studio-quality voice cleanup |
| **Equalizer** | Presets (Default, Classic, Low bass, Pop, Rock, Techno, Soft, Country, Folk…) + **Custom 10-band** EQ |
| **Voice changer** | Character presets (Child, Robot, Monster, Chipmunk, Female/Male) + **Voice filters** (Echo, Telephone, Radio…) |
| **AI Vocal Remover** | Split into **Vocal** and **Accompaniment** tracks (≤1 h since 14.9) |
| **AI Audio Stretch** | Retimes **music** to a target duration intelligently (recomposes loops/sections; drag the clip end with the stretch handle) |
| **Silence Detection** | Threshold (dB), minimum duration, buffer → auto-cut silences (review list + apply) |
| **Beat Detection / Auto Beat Sync** | Beat markers on music; Auto Beat Sync auto-cuts media to beats |
| **AI Speech-to-Text / TTS** | Shortcuts |
| **Audio Visualizer** | Effect that animates to audio (Effects → Audio Visualizer) |
| **Mixer** | Track-level mixing |
| **Sample rate / precision** | 48 kHz and 32-bit float pipeline (14.7/15.0) |

### 19.4 Speed tab

| Sub-tab | Controls |
|---|---|
| **Uniform Speed** | **Speed** slider (0.01x–100x), **Duration** field, **Reverse speed** checkbox, **Ripple edit** (push following clips), **Maintain pitch**, **AI Frame Interpolation**: Frame sampling / Frame blending / **Optical flow** |
| **Speed Ramping** | Presets: **Custom**, **Montage**, **Hero Moment**, **Bullet Time**, **Jumper**, **Flash In**, **Flash Out**. A curve editor with speed points (add/delete, drag; range 0.1x–10x), **Maintain pitch**, duration readout |
| Freeze frame | Duration field when a freeze is selected |

### 19.5 Animation tab

| Sub-tab | Behavior |
|---|---|
| **Preset** | In / Out / Loop-style presets (Fade, Zoom in/out, Slide, Rotate, Bounce, Swing, Flip…) with durations |
| **Keyframe** | Property list (Transform, Compositing, Mask, Color…) with ◇ per property, **Bezier/graph editor** (expanded in 14.0: per-keyframe **Linear, Ease in, Ease out, Ease in-out, Hold**, custom bezier handles), copy/paste keyframes; 15.6 adds keyframe presets for the Pen tool |
| **Path / follow path** | Objects following a pen-drawn path (15.2 direction control; 15.6 orientation) |

### 19.6 Text/Title tab (title selected)

| Sub-tab | Controls |
|---|---|
| **Basic** | Text box, **Preset styles** grid, Font (with commercial filter), size, **B / I / U**, alignment, **Color** (solid/gradient/**custom image texture** 15.6), Character/line spacing, **Text angle offset** (15.5), **Curved text** (curvature amount), **Text Bezier path** (14.2), **Fill**, **Outline** (multiple), **Shadow** (distance, blur, color, opacity), **Background** (shape, color, opacity, padding, radius), **Glow** (14.8), **Transform** (rotate, scale, position), **Compositing** (blend, opacity) |
| **Animation** | In/Out/Loop presets + keyframes (text-specific: typewriter, word-by-word, etc.) |
| **Advanced** (Title Editor) | Full title designer window: multiple text objects/shapes per title, per-object animation, timeline of elements |
| **Bubble** | Bubble/label backgrounds (47 presets) |
| **Text-to-speech** | Voice list (many languages; character voices; **AI Voice Cloning** custom voices), speed and pitch, "Generate" (creates an audio clip) |
| **Speech-to-text / Subtitles** | **STT**: language, clip(s) selection, auto-match to timeline, **speaker separation** (some builds), **auto-correction** (14.5); creates subtitle clips on a subtitle track. **Subtitle editor**: line list, timing, find/replace, batch style; import/export **SRT**; **AI Translation** of subtitles; **Dynamic Captions** (word highlight animated captions, batch apply, 15.0); **auto-fill text gaps** (15.6) |

### 19.7 Other inspectors

| Clip type | Inspector highlights |
|---|---|
| Image | Video tab minus speed; **duration**; Pan & Zoom; AI image tools (AI Image Enhancer, object remover, stylizer, image-to-video) |
| Effect clip/layer | Effect parameters, opacity, **apply to** (layer below vs clip) |
| Transition | Duration, alignment (overlap/prefix/postfix), params |
| Sticker | Transform, animation, motion tracking |
| Compound | Video + Color + Animation applied to the nest |
| Adjustment layer | Color + Effects |
| Multicam | Angle switching, audio source |

---

## 20. Filmora — Complete AI Feature List

| # | Feature | What it does | Credits/paywall |
|---|---|---|---|
| 1 | **AI Mate** (ex-AI Copilot Editing, renamed 14.6; conversational 15.1) | Chat assistant inside the editor: answers how-to questions, executes edits ("cut silences", "add captions", "make it 9:16"), suggests next steps and links to tools | Free/limited |
| 2 | **Idea to Video / Idea to Video Agent** (14.5 / 15.5) | Concept → script → generated scenes, voiceover, music, captions → editable timeline | Credits |
| 3 | **AI Text-to-Video** | Prompt → video clip (models: Veo 3/3.1, Sora 2, Kling 2.5, Seedance 2.0) | Credits |
| 4 | **AI Image-to-Video** | Animate a still; start/end frame control (14.7); element editing (14.9.10); 1080p (14.10) | Credits |
| 5 | **Character to Video / Audio to Video** | Character-consistent clips; visuals from audio | Credits |
| 6 | **AI Image** (Nano Banana 2, GPT Image 2) | Text-to-image; **Image to Prompt**; **AI Image Stylizer**; **AI Image Enhancer** | Credits |
| 7 | **AI Sticker** | Prompt → sticker | Credits |
| 8 | **AI Music Generator** | Mood/genre/duration/prompt → royalty-free track | Credits |
| 9 | **AI Sound Effect** | Text → SFX | Credits |
| 10 | **AI Text-Based Editing** | Transcribes; edit video by editing the transcript; remove filler words and silences from the text view | Paid |
| 11 | **Smart Short Clips** | Long video/URL → multiple highlight shorts (reframed 9:16, captions, music, scored), with quick trimming (14.8) | Credits |
| 12 | **Smart Scene Cut** | Detects scenes/highlights/people/objects in long footage → selects clips | Paid |
| 13 | **Scene Detection** | Splits a clip at shot changes | Free |
| 14 | **Silence Detection** | Auto-removes silent gaps (threshold, min length, buffer) | Paid |
| 15 | **AI Speech-to-Text** (auto subtitles) | Transcribe to subtitles; auto-correction; many languages | Quota |
| 16 | **Dynamic Captions** | Animated word-highlight captions, batch | Paid |
| 17 | **AI Translation** (with **lip-sync**) | Translates speech (voice clone) + subtitles; lip-sync option | Credits |
| 18 | **Text-to-Speech** | Many voices/languages | Quota |
| 19 | **AI Voice Cloning** | Clone your voice for TTS | Credits |
| 20 | **AI Voice Enhancer** | Studio voice cleanup | Paid |
| 21 | **AI Audio Denoise** (Speech enhancement, wind, reverb, hum, hiss) | Restoration | Paid |
| 22 | **AI Vocal Remover** | Vocal/instrumental split | Credits/paid |
| 23 | **AI Audio Stretch** | Fit music to a duration musically | Paid |
| 24 | **Audio Ducking** | Auto-lower music under dialogue | Free |
| 25 | **Auto Normalization / Audio Gain** | LUFS loudness standards | Free |
| 26 | **Beat Detection / Auto Beat Sync** | Beat markers / auto cut-to-beat | Free/paid |
| 27 | **AI Portrait** | Person segmentation, BG removal/replace | Paid |
| 28 | **AI Smart Cutout** | Brush-guided object segmentation through time | Paid |
| 29 | **Smart Masking / AI Mask** | Auto masks of subject/sky/people; multi-mask (15.7) | Paid |
| 30 | **Motion Tracking** | Attach elements to a moving object | Free |
| 31 | **Planar Tracking** + **Mocha Filmora** | Surface tracking and corner-pin | Paid |
| 32 | **AI Face Mosaic** | Auto tracked face blur | Paid |
| 33 | **AI Object Remover** (video/photo, Magic Box) | Inpaint objects | Credits |
| 34 | **AI Video Enhancer** / Topaz upscaling / **Generative Enhance** | Upscale, sharpen, restore low-res footage | Credits/paid |
| 35 | **Video Denoise**, **Flicker Removal**, **Lens correction** | Restoration | Paid |
| 36 | **AI Relight**, **AI Eye Contact**, **AI Night View** | Lighting/gaze/low-light | Credits |
| 37 | **AI Color Palette** | Transfer a palette from a reference | Paid |
| 38 | **Color Match** | Match to a reference frame | Free |
| 39 | **Auto Enhance** | One-click fix | Free |
| 40 | **Auto Reframe** | Subject-aware re-aspect | Paid |
| 41 | **AI Extend** | Generative extension of clip video/audio | Credits |
| 42 | **AIGC Transitions** | Generated transitions between two frames | Credits |
| 43 | **AI Effects** (generative grain, stylize) | Generative looks | Credits |
| 44 | **Retouch / AI beauty** (15.7) | Face smoothing, makeup | Paid |
| 45 | **Speed Ramping + AI Frame Interpolation** (optical flow) | Smooth slow-mo | Paid |
| 46 | **Stabilization** | Shake removal | Free |
| 47 | **Keyframes** with bezier graphs | Animation | Free |
| 48 | **Multicam auto-sync** | Audio-based sync of angles | Paid |
| 49 | **Instant Mode / Auto Montage** | Auto-edit from template | Free/paid |
| 50 | **AI Thumbnail Creator / Cover** | Picks frames, adds templates | Paid |
| 51 | **AI Copywriting** (titles, descriptions, scripts) | ChatGPT-backed writing | Credits |
| 52 | **Screen Recorder** (with BG removal/blur, teleprompter, window recording, markers) | Recording | Free/paid |
| 53 | **Social publishing + scheduling + analytics** (14.2.5/14.4) | Publishing | Paid |

---

## 21. Filmora — Keyframes, Masks, Chroma Key, PiP, Compound Clips, Templates, Stock

| Topic | Filmora behavior |
|---|---|
| **Keyframes** | Animation → Keyframe tab: per-property ◇ buttons (Transform, Compositing, Mask, Color, Audio volume, Effects params, Text). Keyframes show on the clip. **Graph editor** with interpolation types (Linear, Ease in/out, Hold, custom bezier) — expanded in 14.0. Copy/paste keyframes; keyframe presets for the pen tool (15.6) |
| **Masks** | See §19.1. Shape, pen, text, image, AI masks; multi-mask boolean modes (15.7); feather, invert, opacity, edge control; keyframable; trackable |
| **Chroma key** | AI Tools → Chroma Key (tolerance, offset, edge feather/thickness, spill, alpha view). Sample Green Screen assets. AI Portrait = no-green-screen alternative |
| **PiP / Overlays** | Drop media on track 2+; transform in the player; Video → Basic transform; blend modes; masks; **Split screen** presets (Templates → Split Screen; **Multi Frame Effect** 15.7) with drop zones per cell |
| **Compound clips** | Create from a selection; double-click to edit; **dual timeline** view (15.0); **import subprojects as compound clips** (15.0); detachable (14.1) |
| **Multicam** | Create multi-camera clip (sync by audio); switch angles live during playback in the multicam viewer |
| **Templates** | Template library; template mode with placeholder strip; auto-fill (15.3); split-screen templates (15.7); **Instant Mode**; Filmstock template packs |
| **Stock** | Filmstock (Wondershare's own: music, SFX, video, effects packs), Pixabay, Pexels, Unsplash, GIPHY, Boris FX/NewBlue FX bundles, AI-generated media; **Asset Center** (14.5) with favorites tagging (14.7) |
| **Pen tool / drawing** | Draw vector paths and shapes on the canvas, stroke styles, path-follow animation, custom materials (15.0–15.6) |
| **Animated charts** | Data-driven bar/line/pie charts (15.0+) |

---

## 22. Filmora — Export & Publishing

The export dialog (Ctrl/Cmd+E) has tabs on the left: **Local**, **Device**, **Social Media** (YouTube, TikTok, Vimeo, plus Facebook/Instagram in multi-platform publishing), **DVD**, and **Cloud**.

### 22.1 Local tab

| Field | Options |
|---|---|
| **Format** | **MP4**, **MOV**, **WMV**, **AVI**, **MKV**, **F4V**, **TS**, **3GP**, **MPEG-2**, **WEBM**, **GIF**; audio-only **MP3**, **WAV**, **M4A**/AAC, **FLAC** (14.9.10), 32-bit float WAV (14.7/14.8) |
| Name / Save to | Filename, folder |
| **Preset / Quality** | Higher / Recommended / Lower (or Best/Better/Good) presets, plus **Settings** for custom |
| **Settings (advanced)** | **Encoder**: H.264, **HEVC (H.265)**, AV1 (newer, GPU-dependent), ProRes on Mac MOV (verify); **Resolution** (up to 8K / 7680×4320); **Frame rate** (up to 120 fps); **Bitrate** (Kbps, CBR/VBR); Audio encoder (AAC/MP3), channels, sample rate (44.1/48 kHz), bitrate |
| **Export range** | Entire project / **Selected range (Mark In-Out)** / Selected clips |
| **GPU / hardware-accelerated encoding** | Toggle |
| **HDR export** | When the project is HDR (HLG/PQ with HEVC) |
| **Advanced Compression** (14.0) | Target size or smart compression ratio, keeping quality |
| **Chapters / Chapter Progress Bar** (15.6) | Use timeline markers as chapters; optionally burn in an animated chapter progress bar |
| **Auto highlight** | Exports a short highlight version (Smart Short Clips) |
| **Export each subtitle / SRT** | Subtitles burned in or exported as SRT |
| **Render preview reuse** | "Use render preview files" to speed up export |
| **Upload to cloud** | Toggle |
| Estimates | File size, duration |

### 22.2 Other tabs

| Tab | Options |
|---|---|
| **Device** | iPhone, iPad, Apple TV, Android (Samsung, Google), Smart TV, PS4/PS5, Xbox, with tuned resolutions |
| **Social Media** | **YouTube** (title, description, tags, category, privacy, chapters from markers, thumbnail), **TikTok**, **Vimeo**, (Facebook/Instagram in multi-platform publishing 14.4). Login once and **publish to multiple platforms in one go**; **scheduled posting** + basic analytics (14.2.5) |
| **DVD** | Burn to disc / ISO / DVD folder (TV standard NTSC/PAL, ratio 16:9/4:3, quality) |
| **Cloud** | Wondershare Drive |
| **GIF** | Format option with resolution/fps |

---

## 23. Filmora Mobile (brief)

| Item | Detail |
|---|---|
| Home | New project, AI tools row (AI Remove BG, Smart Cutout, AI Captions, TTS, AI Image, Templates), projects |
| Editor | Preview top, timeline middle (main track + PiP/text/audio tracks), bottom toolbar: **Trim/Split, Audio, Text, Stickers, Effects, Filters, PiP, Canvas/Ratio, Adjust, Speed, Keyframe, Mask, Chroma key, AI Cutout, Captions** |
| Export | 720p/1080p/4K, fps, watermark on free |
| Sync | Cross-platform plan syncs cloud projects with desktop (limited) |

---

## 24. Filmora — Keyboard Shortcuts

Defaults from Filmora's official Windows/Mac shortcut pages. Customize via **File → Keyboard Shortcuts** (Windows: Ctrl+Alt+K opens the manager per the localized docs). The editor offers presets (Filmora / Premiere Pro / Final Cut Pro) and conflict detection. Entries marked *(verify)* are commonly cited but weren't in the official table retrieved.

### 24.1 File

| Action | Windows | macOS |
|---|---|---|
| New project | Ctrl+N | Cmd+N |
| Open project | Ctrl+O | Cmd+O |
| Save project | Ctrl+S | Cmd+S |
| Save as | Ctrl+Shift+S | Cmd+Shift+S |
| Import media files | Ctrl+I | Cmd+I |
| Record voiceover | Ctrl+Alt+R | Option+Shift+R *(verify)* |
| Preferences | Ctrl+, | Cmd+, |
| Export | Ctrl+E | Cmd+E |
| Keyboard shortcuts | Ctrl+Alt+K | Option+Cmd+K *(verify)* |
| Help | F1 | — |
| Quit | Alt+F4 | Cmd+Q |

### 24.2 Edit

| Action | Windows | macOS |
|---|---|---|
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Cut / Copy / Paste | Ctrl+X / Ctrl+C / Ctrl+V | Cmd+X / Cmd+C / Cmd+V |
| Delete | Delete | Delete |
| **Ripple delete** (delete and close gap) | Shift+Delete | Shift+Delete |
| Select all | Ctrl+A | Cmd+A |
| **Split** | Ctrl+B | Cmd+B |
| Trim start to playhead | Alt+[ | Option+[ |
| Trim end to playhead | Alt+] | Option+] |
| Speed and duration | Ctrl+R | Cmd+R |
| Crop and zoom | Alt+C | Option+C |
| Detach audio | Ctrl+Alt+D | Cmd+Option+D *(verify)* |
| Mute | Ctrl+Shift+M | Cmd+Shift+M |
| Insert (from source) | Shift+I | Shift+I |
| Overwrite (from source) | Shift+O | Shift+O |
| Freeze frame | Alt+F *(verify)* | Option+F *(verify)* |
| Copy effects / Paste effects | Ctrl+Alt+C / Ctrl+Alt+V *(verify)* | Cmd+Option+C / Cmd+Option+V *(verify)* |
| Group / Ungroup | Ctrl+G / Ctrl+Alt+G *(verify)* | Cmd+G / Cmd+Option+G *(verify)* |
| Enable/disable clip | E *(verify)* | E *(verify)* |
| Snapshot | Ctrl+Alt+S *(verify)* | Cmd+Shift+S? *(verify)* |
| Blade tool / Select tool | C / V *(verify)* | C / V *(verify)* |
| Rename | F2 | — |

### 24.3 View & playback

| Action | Windows | macOS |
|---|---|---|
| Play / Pause | Space | Space |
| Previous / next frame | ← / → | ← / → |
| Previous / next edit point | ↑ / ↓ | ↑ / ↓ |
| Go to start / end | Home / End | Home / End (Fn+←/→) |
| Timeline zoom in / out | Ctrl+= / Ctrl+- | Cmd+= / Cmd+- |
| Zoom to fit timeline | Shift+Z | Shift+Z |
| Full screen preview | Alt+Enter | Cmd+F *(verify)* |
| Exit full screen | Esc | Esc |
| Shuttle (reverse / pause / forward) | J / K / L *(verify)* | J / K / L *(verify)* |
| Render preview | Enter *(verify)* | Return *(verify)* |
| Snapping toggle | N *(verify)* | N *(verify)* |

### 24.4 Markers

| Action | Windows | macOS |
|---|---|---|
| Set In point / Out point | I / O | I / O |
| Clear In / Out | Alt+I / Alt+O *(verify)* | Option+I / Option+O *(verify)* |
| Add marker | M | M |
| Edit marker | Shift+M | Shift+M |
| Delete marker | Delete (on selected marker) | Delete |
| Previous / next marker | Shift+↑ / Shift+↓ | Shift+↑ / Shift+↓ |

---

# PART C — COMPARISON & PATTERNS

## 25. CapCut vs Filmora — Side-by-Side Matrix

| Dimension | CapCut (desktop) | Filmora 15 |
|---|---|---|
| Business model | Free-first; crown-gated Pro assets/tools; credits for generative AI; Standard/Pro/Ultra | Everything usable free with a watermark; annual/perpetual; credits for generative AI |
| Timeline philosophy | **Main track magnet** spine + auto-created overlay tracks; tracks appear/disappear automatically | **Numbered multi-track** NLE + optional magnetic main track, auto ripple, track manager |
| Asset panel | Top tabs: Media, Audio, Text, Stickers, Effects, Transitions, Captions, Filters, Adjustment, Templates, AI avatars | Top tabs: Media, Stock Media, Audio, Titles, Transitions, Effects, Filters, Stickers, Templates |
| Inspector | Contextual tabs: Video/Audio/Speed/Animation/Adjust/AI | Contextual tabs: Video/Audio/Color/Speed/Animation/AI tools |
| Monitors | Single player (+ skimming "preview axis") | Single or **dual** (source + timeline) |
| Captions | Best-in-class auto captions + caption templates + transcript editing | STT + Dynamic Captions + text-based editing + AI translation |
| Color | Basic/HSL/Curves/Color wheels (primary + log), LUTs, auto adjust/match | Basic/HSL/Curves/Color wheels + **HDR wheel**, AI Color Palette, scopes, LUT export |
| Tracking | Motion tracking, camera tracking, auto reframe | Motion tracking, **planar tracking**, **Mocha**, auto reframe |
| Masks | Shapes + pen/text, multiple masks | Shapes + pen/text/image/AI masks, boolean multi-mask |
| Audio | Enhance voice, noise, isolate voice, voice changer, beats, normalize | Full AI denoise suite, EQ, mixer, ducking, audio stretch, LUFS, 32-bit float |
| Generative | Seedance/Kling/VEO/PixVerse; Director Mode; AI avatars; EditPilot | Veo/Sora/Kling/Seedance; Idea to Video Agent; AI Extend; AIGC transitions |
| Export | MP4/MOV; H.264/HEVC/AV1; ≤4K/60; GIF; audio; SRT; direct TikTok/YouTube | Many containers; ≤8K/120; GIF; audio (incl. FLAC/32-bit); device presets; DVD; multi-platform publish + scheduling; chapters |
| Strength | Speed to "viral-ready" output; templates; mobile parity | Depth; pro-adjacent controls; format breadth |

---

## 26. Common Patterns Across Consumer Editors (UX conventions worth copying)

1. **Four-pane layout:** assets (top-left), player (top-center), contextual inspector (right), timeline (bottom). Every pane is resizable and there are layout presets. Users expect this.
2. **Top-tab asset browser with a left category column:** each tab (Media/Audio/Text/Stickers/Effects/Transitions/Filters/Captions/Templates) uses the same grid UI with hover-to-preview, a **"+" add-at-playhead** button, download-on-first-use, and ★ favorites. One component serves all asset types.
3. **Context-sensitive inspector:** the selection type decides the tabs. With nothing selected, show project details. Each section has an enable toggle, a reset ↺, and a **◇ keyframe button per property**.
4. **Implicit keyframing:** once a property has one keyframe, editing it at a new time auto-adds another. Show ◆ on clips, give prev/next arrows, and offer easing presets (Linear/Ease in/Ease out/Ease in-out/Hold) before exposing a bezier graph.
5. **Magnetic main track + free overlays:** a gapless "spine" track that ripples automatically, with free-floating overlay/text/audio tracks that auto-create and auto-delete. Provide a toggle (P) for the magnet and **linkage** so overlays ride along with their main clip.
6. **Drop target defines scope:** drop an effect/filter **on a clip** to affect that clip, or **on an empty track** to create a layer that affects everything below. Transitions drop **between** clips, with "Apply to all".
7. **One-key editing verbs:** Ctrl/Cmd+B split, **Q/W delete left/right of playhead** (ripple trims; CapCut's best shortcut), Shift+Delete ripple delete, Alt+[ / ] trim to playhead, I/O in-out, M marker, Space play, ←/→ frame, ↑/↓ edit points, Shift+Z fit, Ctrl+wheel zoom, N snap, A/B select/blade. Ship Premiere/FCP keymap presets.
8. **Skimming ("preview axis")**: hover-scrubbing the timeline and media thumbnails without moving the playhead, toggleable.
9. **Speed = Normal + Curve:** a numeric multiplier with a duration field and a pitch-preserve toggle, plus named ramp presets (Montage, Hero, Bullet, Jump cut, Flash in/out) opening an editable curve. Add an optical-flow "smooth slow-mo" toggle.
10. **In / Out / Combo(Loop) animation presets** with duration sliders, shown as ramps on clip edges. This is far more approachable than keyframes for most users.
11. **Captions as a first-class workflow:** one-click auto-captions with language, bilingual and filler-word options. Captions land on their own track with an editable transcript list (Enter splits a line). Style edits apply to all by default. Offer animated word-highlight templates, SRT import/export, and transcript-based cutting (delete words to delete video, remove fillers and silences).
12. **Background fill for mismatched ratios:** a Blur/Color/Image canvas fill with "Apply to all", plus **auto reframe** for re-aspecting. Social ratios (9:16, 1:1, 4:5, 16:9) sit one click away under the player, and platform **safe-zone overlays** are available.
13. **Pre-baked looks over raw controls:** filters with intensity sliders, color presets/LUTs, "Auto adjust" and "Color match", then Basic sliders, then HSL/Curves/Wheels for power users (progressive disclosure). Adjustment layers apply a grade across many clips.
14. **Segmentation everywhere:** remove background (auto + brush refine), chroma key as the classic fallback, body effects, retouch, AI masks. Users now expect no-green-screen cutouts.
15. **Tracking that attaches things:** select a sticker/text/mosaic → draw a box → "Track" → it follows. Planar/corner-pin is a pro upsell.
16. **Audio one-toggles:** Enhance voice, Reduce noise, Normalize loudness (LUFS presets), Fade in/out handles on clip corners, auto ducking, beat markers for cut-to-beat, voice changer presets, and stem separation.
17. **Template slots:** templates expose numbered replaceable media slots with target durations plus editable text fields. "Use template", then autofill, then optionally convert to a full project.
18. **Freeze / Reverse / Mirror / Rotate / Crop as one-click toolbar verbs** (freeze inserts a fixed 3–5 s still), not buried in menus.
19. **Compound clips + groups:** nest (Alt+G) for treating a sequence as one clip, with double-click to enter and a breadcrumb back; group (Ctrl+G) for moving together.
20. **Try-before-you-buy paywall:** premium items are visibly badged (crown/diamond) but fully previewable and applicable. Gate at **export** with "Remove Pro features" vs "Upgrade", or with a watermark. AI actions show their credit cost on the button.
21. **Export dialog as a single compact sheet:** name, location, resolution, fps, bitrate (Lower/Recommended/Higher/Custom), codec, format, estimated file size, plus checkboxes for **audio-only**, **GIF**, **captions file**. Post-export **share to TikTok/YouTube** with title, privacy and cover, plus "Open folder". Social presets auto-pick the right settings.
22. **Cover/thumbnail as part of the project:** a "Cover" slot at the head of the main track (choose a frame, add text) that exports with the video for social platforms.
23. **Project creation by aspect ratio first:** "New project" with a ratio dropdown (or "Original" = first clip). Ask "Match project to media?" when the first clip differs. Resolution/fps/color space go under "Modify".
24. **Proxy + render preview + preview quality** controls (Full/½/¼/Auto) to keep playback real-time on weak machines, with auto-proxy for 4K/HEVC.
25. **AI entry points in three places:** home-screen quick tools (long video → shorts, script → video, captions), inspector tabs on the selected clip, and a chat/agent (AI Mate, EditPilot) that performs edits. Outputs always land back on the normal timeline as editable clips, never as a locked render.
26. **Non-destructive, reversible toggles:** every AI/effect application can be toggled off or reset per section. Reverse/extract-audio actions are re-clickable to restore. Unlimited undo, and auto-save is on by default.
27. **Mobile parity mental model:** a bottom tool strip that becomes contextual when a clip is selected (Split, Speed, Animation, Delete, Volume, Mask, Remove BG…), a fixed center playhead with the timeline scrolling beneath, pinch to zoom, and long-press to reorder. A desktop editor that mirrors these names helps users who move between devices.
