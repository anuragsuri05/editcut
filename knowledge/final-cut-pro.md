# Final Cut Pro (Mac) — Exhaustive Reference for editcut

> Scope: Apple Final Cut Pro for Mac, current through **FCP 12.4 (Sept 29, 2026)**, with FCP 10.8 / 11.x history, plus Final Cut Pro for iPad differences.
> Purpose: a design/behavior reference for building the "editcut" editor. Focus is on *what each control does* and the underlying data model.
> Sources: Apple Final Cut Pro User Guide (support.apple.com/guide/final-cut-pro), Apple FCP release notes (support.apple.com/102825), Apple Newsroom (Creator Studio, Jan 2026), Larry Jordan, fcp.cafe, plus domain knowledge. Keyboard shortcuts are US defaults and can be remapped in the Command Editor (Final Cut Pro > Commands > Customize, Opt-Cmd-K). Items marked *(verify)* are less certain and should be double-checked in-app.

---

## 0. Version timeline (what shipped when)

| Version | Date | Headline features |
|---|---|---|
| 10.6.x | 2021–2023 | Object Tracker (10.6), Cinematic mode editing (10.6.2), Voice Isolation (10.6.2), Duplicate detection, Color Adjustments effect, Proxy H.264 + proxy sizes, Proxy Only playback (10.6.6), Scrolling timeline (10.6.6) |
| 10.7 | Nov 2023 | Timeline scrolling auto, keyword shortcuts on clips, simplified export, Background rendering improvements, Apple silicon perf; |
| 10.8 | Jun 2024 | **Enhance Light and Color** (ML), **Smooth Slo-Mo** (ML frame generation, Apple silicon), rename color corrections/effects in Inspector, drag effects from Inspector onto clips, new Timeline Index filters (audio effects, video effects, retiming, missing media, missing effects), Index search by reel/scene/angle/camera/custom metadata/effect name/role, Browser search "Starts With/Ends With", toolbar Timeline Scrolling toggle, 8K ProRes MXF export; **disc (DVD/Blu-ray) burning removed**; FCPXML 1.12 |
| 10.8.1 | Aug 2024 | bug fixes |
| **11.0** | Nov 13, 2024 | **Magnetic Mask** (AI subject isolation w/o green screen), **Transcribe to Captions** (on-device LLM speech-to-text; Apple silicon + macOS 15), **Spatial video** import/edit/export for Apple Vision Pro, 90/100/120 fps timelines, originals auto-hidden when creating synced/multicam clips, **Picture in Picture** and **Callout** effects, **modular transitions**, Vertical "Zoom to Fit" clip heights, new shortcuts (reorder stacked clips, list view nav, Rename Clip, audio lanes, subroles, half-speed playback, Consolidate Motion Content, Paste Timecode, Show Horizon), third-party **Media Extensions** (macOS 15), direct export to Photos, MXF with 32 kHz audio; FCPXML 1.13 |
| 11.0.1 | Feb 2025 | Custom overlay fix, Send to Compressor w/ Magnetic Mask fix |
| **11.1** | Mar 27, 2025 | **Adjustment Clips** (adjustment layers), **Image Playground** (Apple Intelligence image gen; macOS 15.2+, M1+), Quantec QRS reverb, rename audio effects, Reveal multicam angle/synced clip source in Browser, drag markers to move / drag off to delete, Magnetic Mask Editor shortcut |
| 11.1.1 | May 2025 | MXF playback fix, "Allow export segmentation" frame rate fix |
| 11.2 | Sep 19, 2025 | iPhone **ProRes RAW** controls (exposure, color temp, tint, demosaic), **Apple Log 2** LUT, FireWire device support removed on macOS 26 Tahoe |
| **12.0** | Jan 28, 2026 | Launch alongside **Apple Creator Studio** subscription. **Transcript Search** (exact or natural-language search of spoken words; Apple silicon), **Visual Search** (natural-language search of objects/actions; Apple silicon), **Beat Detection** (bars & beats grid from any song), in-app guides, toolbar "New" menu (project/event/library), demo project; FCPXML 1.14 |
| 12.2 | Apr 9, 2026 | Magnetic Timeline video tutorial, faster startup with many AUs, Beat Detection zoom crash fix |
| **12.3** | Jun 30, 2026 | **Generate Captions** (subtitle creation; Apple silicon, US English), **Auto Mask** (isolates recognized objects for color/effects without manual tracking), **Match Color** tool (match across cameras/lighting/styles), **Edit Detection** (find shot changes in a flattened/rendered video and split into clips), persistent **two-up display** while trimming (incl. Precision Editor), send frame to **Pixelmator Pro**, **swap clip positions** in primary storyline shortcut, copy/paste complex edits (primary clip + its connected clips) across timelines, **proxies now HEVC** (better compression, HDR support), **background rendering off by default**, convert closed captions to subtitles, Select All Subtitles, multi-subtitle Inspector edits |
| **12.4** | Sep 29, 2026 | Edit **Cinematic mode** video recorded in **Final Cut Camera** (focus points, depth of field; requires macOS 27), waveform generation fix, network-volume library backup fix, Animation Editor keyframe paste fix, multicam angle-switch latency fix |

Requirements (12.x): macOS 15.6+ (verify exact minimum per point release), Apple silicon strongly recommended; many ML features (Transcript/Visual Search, Transcribe/Generate Captions, Smooth Slo-Mo, Spatial video) are **Apple-silicon-only**. Licensing: one-time Mac App Store purchase ($299.99) **or** via Apple Creator Studio subscription (FCP Mac+iPad, Logic Pro, Pixelmator Pro, Motion, Compressor, MainStage, premium iWork content).

---

## 1. Core data model: Libraries → Events → Clips / Projects

### 1.1 Hierarchy

| Container | File-system form | Contains | Notes for editcut |
|---|---|---|---|
| **Library** | `.fcpbundle` package (folder bundle). Contains a `CurrentVersion.flexolibrary` SQLite DB per event, `Settings.plist`, plus per-event folders (`Original Media`, `Transcoded Media/High Quality Media` (optimized), `Transcoded Media/Proxy Media`, `Render Files`, `Analysis Files`, `Shared Items`) | Events, plus library-wide settings (color processing, storage locations) | Multiple libraries can be open at once. Libraries auto-save continuously (no Save command). Backups every 15 min to Backups location (default `~/Movies/Final Cut Backups`). |
| **Event** | Folder inside library | Clips (master clips referencing media), Projects, Keyword Collections, Smart Collections, folders, compound/multicam/synced "parent" clips | An event is like a bin + database. Projects live *inside* events. |
| **Clip (Browser clip / master clip)** | DB record pointing to media file (internal or external alias/symlink) | Metadata, ratings ranges, keyword ranges, markers, analysis keywords, roles, audio config, transcripts (12.0) | Browser clips are non-destructive references. |
| **Project** | DB record (timeline) | Primary storyline + connected clips/storylines; project properties (format, resolution, rate, audio, render codec, color space) | Equivalent of a "sequence". Snapshots = frozen duplicates. |
| **Compound clip (parent)** | DB record in event | Nested timeline | Browser compound clips are *live* parents: edits propagate to all instances (unless "Reference New Parent Clip"). |
| **Multicam clip / Synchronized clip** | DB record in event | Angles / synced components | Created from Browser; originals auto-hidden (11.0+). |

### 1.2 Library Properties (Inspector when library selected)

| Setting | Options / What it does |
|---|---|
| Storage Locations → **Media** | "In Library" (managed) or an external folder (external media; FCP stores symlinks/aliases). Applies to newly imported/generated media. |
| Storage Locations → **Motion Content** | "In Motion Templates folder" (`~/Movies/Motion Templates`) or "In Library" (embeds custom templates in library for portability). |
| Storage Locations → **Cache** | Render files, analysis, thumbnails, waveform caches. Can be set to fast external drive. |
| Storage Locations → **Backups** | Location for automatic library backups (database only, not media), or "Do Not Save". |
| **Color Processing** | *Standard* (Rec. 709 processing) or *Wide Gamut HDR* (processes in linear-light Rec. 2020; required for HDR projects). One-way upgrade. |
| **Consolidate** (button) | Copies all external media referenced by the library into the library or to a chosen external folder; optional include optimized/proxy media. |
| **Modify Settings** | Change the above. |
| Library info | Size, number of events, media/optimized/proxy/render totals. |

### 1.3 Media management commands

| Command | Location | Behavior |
|---|---|---|
| Import Media (Cmd-I) | File > Import > Media | Opens the Media Import window (see §2). |
| Import from iMovie (iOS) / FCP for iPad project | File > Import | Converts iMovie iOS or FCP for iPad projects (one-way). |
| Import XML (Shift-Opt-Cmd-I) | File > Import > XML | FCPXML (1.x) import, including `.fcpxmld` bundles. |
| Import Captions | File > Import > Captions | SRT, iTT, SCC (CEA-608) import into a caption role. |
| Copy to Library / Move to Library | File > Copy Clip/Event/Project to Library | Copies event/project + media to another library, with option to include optimized/proxy media. |
| Consolidate Library/Event/Project Media | File > Consolidate | Gathers referenced media into one place. |
| Relink Files (Relink Original/Proxy) | File > Relink Files | Re-points missing or replacement media; matches by name, frame rate, duration, audio channels. Option "Copy relinked files to library". |
| Delete Generated Files | File > Delete Generated Library/Event Files | Deletes render files (all or unused), optimized media, proxy media to free space. |
| Transcode Media | File > Transcode Media | Create optimized (ProRes 422) and/or proxy media after import. |
| Duplicate / Snapshot project | Edit > Duplicate (Cmd-D) / Duplicate Project as Snapshot (Shift-Cmd-D) | Duplicate shares referenced compound clips; Snapshot makes compound/multicam clips independent copies (frozen). |
| Merge Events | drag event onto another | Combines event content. |
| Reveal in Finder (Shift-Cmd-R) | File | Reveals source media file. |
| Reveal in Browser (Shift-F) | File | Shows the source Browser clip of a timeline clip (11.1 extends to multicam angle / synced component sources). |
| Reveal Project in Browser (Opt-Shift-Cmd-F?) *(verify)* | File | Selects the project in its event. |
| Move to Trash (Cmd-Delete) | File | Deletes Browser clip/project. External media files untouched; managed media deleted when clip removed. |
| Close Library | File > Close Library | Unmounts library from sidebar. |
| Library Backups | File > Open Library > From Backup | Restore DB backup. |
| Find Duplicates | Timeline Index / View > Show Duplicate Ranges | Duplicate ranges appear as striped bars on timeline clips. |

### 1.4 Proxy, optimized and original media

| Type | Codec | Purpose |
|---|---|---|
| Original | Camera native (H.264, HEVC, ProRes, ProRes RAW, RED R3D (plug-in), Canon Cinema RAW Light (plug-in), Sony XAVC, AVCHD, MXF (XAVC/ AVC-Intra / DNxHD via Media Extensions/plug-in), BRAW via Blackmagic Media Extension on macOS 15+, image formats, audio formats) | Highest quality. |
| Optimized | **Apple ProRes 422** at original resolution | Easier decode for long-GOP footage, faster effects/render. |
| Proxy | **Apple ProRes 422 Proxy**, H.264 (10.6.6+) or **HEVC (12.3+, default; supports HDR)**; size 12.5% / 25% / 50% / 100% | Lightweight offline editing; can be generated on import or later. Proxy-only libraries can be copied to a laptop ("proxy workflow"). |
| Render files | Project's render codec (ProRes 422 default; options ProRes 4444, 4444 XQ, 422 HQ, 422 LT, 422 Proxy, Uncompressed 10-bit) | Cached results of effects/transitions; stored in Cache. |

**Viewer > View > Media** playback toggle: **Proxy Preferred** (uses proxy if exists, else original/optimized), **Proxy Only** (shows "Missing Proxy" slate where none), **Optimized/Original**. Quality toggle: **Better Performance** vs **Better Quality**. Sharing always uses original/optimized unless explicitly "share proxy".

### 1.5 Background Tasks (Cmd-9)

Window listing progress with pause/cancel per category: **Transcoding and Analysis** (optimized/proxy creation, analysis for stabilization, rolling shutter, balance color, find people, audio analysis, object tracking, Smart Conform analysis, transcription, visual/transcript indexing, Beat Detection), **Rendering** (background render; 12.3 makes background rendering **off by default**, configured in Settings > Playback: "Background render: Start after N seconds"), **Sharing**, **Import** (copying files), **Synchronization/Transcription**. The toolbar Background Tasks button shows a progress ring.

### 1.6 Settings (Final Cut Pro > Settings, Cmd-,)

| Pane | Key options |
|---|---|
| General | Time display (HH:MM:SS:FF, + subframes, frames, seconds); Dialog warnings reset; Audio units validation; Color correction default (Color Board vs Color Wheels vs Curves... "Default color correction" choice) |
| Editing | Show detailed trimming feedback (two-up), Position playhead after edit operation, Show reference waveforms, Audio fade duration default, Still image duration (default 4 s), Transition duration (default 1 s), Cross-dissolve when applying a transition, apply transitions using full overlap / available media |
| Playback | Background render on/off + delay; Create optimized media for multicam clips; Warn when frames drop; Pre-roll / Post-roll duration (for Play Around, default 2 s / 2 s); Player background (Black, White, Checkerboard); A/V output device; HDR settings |
| Import | Defaults for the import window (copy vs leave, keywords, transcoding, analysis), ingest "Assign iXML track names if available" etc. In recent versions import options live mainly in the import window sidebar. |
| Destinations | Share destinations list: add/remove/duplicate/reorder; set Default destination (Cmd-E). |
| Account? | (Not present) |

---

## 2. Media Import window (Cmd-I)

| Area | Function |
|---|---|
| Left sidebar: **Devices / Cameras / Favorites / Locations** | Connected cameras & cards (AVCHD, XAVC, ProRes, iPhone via USB), mounted volumes, folders; **Create Archive** (camera archive bundle `.fcarch`) for card backup. |
| Browser (filmstrip or list view) | Skim clips before import, mark ranges (I/O) to import only a portion; Select All. |
| Viewer at top | Playback of selected clip. |
| Right panel — **Media Import Options** | |
| • Add to existing event / Create new event in [library] | Destination event. |
| • Files: **Copy to library storage location** / **Leave files in place** | Managed vs referenced (external) media. "Leave in place" is not available from cameras/cards (always copied). |
| • Keywords: **From Finder tags**, **From folders** (folder names become Keyword Collections) | Auto-keywording. |
| • Audio Roles: Assign Audio Roles (Automatically / Dialogue / Music / Effects / custom); **Assign iXML track names if available** (creates subroles from iXML) | Role assignment at ingest. |
| • Transcoding: **Create optimized media**, **Create proxy media** (codec: HEVC/H.264/ProRes Proxy; size %) | Background transcode. |
| • Video analysis: **Analyze for balance color**, **Find people** (adds keywords One Person/Two Persons/Group, Close Up Shot/Medium Shot/Wide Shot), **Consolidate find people results**, **Create Smart Collections after analysis** | Analysis keywords. Stabilization & rolling shutter analysis happen on demand. |
| • Audio analysis: **Analyze and fix audio problems** (loudness, noise, hum), **Separate mono and group stereo audio**, **Remove silent channels** | Audio config cleanup. |
| • (12.0) transcript / visual search indexing | Transcript & Visual Search indexes are built in background (Apple silicon) — verify toggle location. |
| Import Selected / Import All | Starts import; continues in background. |

Other import paths: drag from Finder/Photos to Browser or timeline; **Photos and Audio sidebar** (Photos library, Music/GarageBand/Sound Effects, iMovie Theater-like sources); Import from iPhone via USB/Continuity Camera; **Record Voiceover** (Window > Record Voiceover, Opt-Shift-Cmd-8): input device, gain, countdown, prompt, create audition from takes, event destination; **Image Playground** (11.1+): Apple Intelligence generated images inserted to Browser.

Supported containers: MOV, MP4, M4V, MXF, AVCHD, MTS/M2TS, 3GP, AVI (limited), R3D (via RED plug-in), BRAW (via Media Extension), ProRes RAW, ARRIRAW (via plug-in? and LUT auto-apply), CinemaDNG? (no), image sequences, PSD (layered PSD becomes compound clip), HEIF/HEIC, JPEG, PNG, TIFF, RAW photo; audio AAC, AIFF, BWF, CAF, MP3, MP4, WAV, RF64.

---

## 3. Organizing: roles, keywords, ratings, collections

### 3.1 Ratings

| Rating | Key | Display | Notes |
|---|---|---|---|
| **Favorite** | F | Green line across the rated range in filmstrip | Applies to selection range (or whole clip). Multiple favorite ranges per clip. |
| **Reject** | Delete (in Browser) | Red line | Rejected ranges hidden by "Hide Rejected" filter. Not deleted from disk. |
| **Unrate** | U | removes | |
| Browser Filter pop-up (top of browser) | All Clips (Ctrl-C), Hide Rejected (Ctrl-H), No Ratings or Keywords (Ctrl-X), Favorites (Ctrl-F), Rejected (Ctrl-Delete), Unused (clips not used in any project in the current library *(verify)*) | Filters the Browser in place. |

### 3.2 Keywords

| Feature | Behavior |
|---|---|
| **Keyword Editor** (Cmd-K) | HUD to type keywords applied to the selected clip or *range*. Shortcuts Ctrl-1 … Ctrl-9 assigned to keyword slots; Ctrl-0 removes all keywords from selection. |
| **Keyword Collection** | Purple key icon in Sidebar under event. Created automatically when a keyword is applied. Dragging clips onto it applies the keyword. Keywords are range-based (blue line in filmstrip). |
| **Analysis keywords** | From Find People / Stabilization ("Excessive Shake"), audio analysis — appear in "Analysis Keywords" folder of smart collections. |
| **Folders** | Plain folders in event to group collections (no metadata effect). |
| **Smart Collection** | Saved search (gear/purple-ish icon). Library-level (since 10.3) or event-level. Defaults: All Video, Audio Only, Stills, Favorites, Projects. |

### 3.3 Filter window / Smart Collection criteria (Cmd-F)

| Criterion | Options |
|---|---|
| Text | Includes / Does Not Include / Is / Is Not / Starts With / Ends With (10.8) — searches name, notes, markers |
| Ratings | Favorites / Rejected |
| Media Type | Video with audio, Video only, Audio only, Stills |
| Type | Audition, Synchronized, Compound, Multicam, Layered Graphic, Project |
| Stabilization | Excessive Shake |
| Keywords | Include Any/All, list of keywords |
| People | One Person, Two Persons, Group, Close Up, Medium, Wide |
| Format Info | Reel, Scene, Take, Audio Output Channels, Frame Size, Video Frame Rate, Audio Sample Rate, Camera Name, Camera Angle |
| Date | Content created / Date imported — is before/after/within last |
| Roles | Includes/Does not include role |
| Used Media | Used / Unused *(verify)* |
| Match All / Any | Combine criteria |

**Browser search field (12.0)** now has three modes: **Text/metadata search**, **Transcript Search** (find spoken words — exact phrase or natural-language semantics; results show matching ranges; click to load range), **Visual Search** (natural language, e.g. "dog jumping into pool", returns matching *ranges* with thumbnails). Both rely on on-device analysis indexes (Apple silicon).

### 3.4 Roles & subroles

| Concept | Details |
|---|---|
| Role | Metadata tag on every clip (video & audio separately) describing function. Default video roles: **Video**, **Titles**; default audio roles: **Dialogue**, **Music**, **Effects**. Caption roles: per format (iTT, SRT, CEA-608) + language subroles. |
| Subrole | Child of role (e.g., Dialogue › Boom, Dialogue › Lav-1). Auto subroles from iXML names. |
| Role color | Each role has a color shown on timeline clips (e.g., Dialogue = blue, Music = green, Effects = cyan, Titles = purple, Video = dark blue). Editable in Role Editor. |
| **Role Editor** | Modify > Edit Roles: add/delete roles & subroles, set colors, choose ducking? (no). Roles can be renamed globally. |
| Assign | Modify > Assign Audio/Video Roles (or Info Inspector role pop-up; Ctrl-Opt-D/M/E shortcuts for Dialogue/Music/Effects; Ctrl-Opt-V Video, Ctrl-Opt-T Titles) |
| **Timeline Index › Roles tab** | Toggle visibility (mute/disable) per role/subrole; **Focus** a role (minimize others); **Show Audio Lanes** – groups connected audio by role into horizontal lanes in the timeline (a lane per role, primary storyline audio still attached); drag lanes to reorder; Collapse subroles. |
| Export | Roles used to produce **multitrack QuickTime** (each role = a stem track), **separate files per role** (stems), or role-filtered exports (only include certain roles). Audio role assignment to output channels (Mono/Stereo/5.1 per role). |

---

## 4. Interface overview (default workspace)

```
+------------------------------------------------------------------------------------+
| Toolbar: [Libraries/Photos&Audio/Titles sidebar toggles] [Import] [Keywords] [BG tasks] |
|          [New ▼] ...   [Dashboard/timecode]  ...  [Browser][Timeline][Inspector] [Share]|
+-------------------+--------------------------+-------------------------------------+
| Sidebar           | Browser                  | Viewer                    | Inspector|
| (Libraries /      | (filmstrip / list)       | (Event viewer optional,    |          |
|  Photos & Audio / |                          |  comparison viewer, scopes)|          |
|  Titles & Gens)   |                          |                           |          |
+-------------------+--------------------------+---------------------------+----------+
| Timeline toolbar: Index | Project name/duration | Edit buttons | Tools | Skimming/Audio skim/Solo/Snapping | Clip appearance | Effects/Transitions browsers |
| Magnetic Timeline                                                                   |
+------------------------------------------------------------------------------------+
```

Workspaces (Window > Workspaces): **Default** (Cmd-0), **Organize** (Ctrl-Shift-1? *(verify)*), **Color & Effects**, **Dual Displays**; custom saved workspaces (Window > Workspaces > Save Workspace as). Window > Show in Workspace toggles: Sidebar (Cmd-`), Browser (Ctrl-Cmd-1), Event Viewer (Ctrl-Cmd-3), Comparison Viewer (Ctrl-Cmd-6), Inspector (Cmd-4), Timeline (Ctrl-Cmd-2), Timeline Index (Shift-Cmd-2), Audio Meters (Shift-Cmd-8), Effects (Cmd-5), Transitions (Ctrl-Cmd-5), Video Scopes (Cmd-7), Angles (Shift-Cmd-7). Window > Show in Second Display: Browser / Viewers / Timeline. Window > A/V Output (Cmd-F12) to external monitor/Blackmagic/AJA device.

### 4.1 Toolbar (top)

| Control | Function |
|---|---|
| Sidebar buttons: **Libraries**, **Photos and Audio**, **Titles and Generators** | Toggle sidebar content (Cmd-` / Shift-Cmd-1 / Opt-Cmd-1). |
| **Import Media** button (down arrow) | Opens Media Import window. |
| **New** menu (12.0) | Quick-create New Project (Cmd-N), New Event (Opt-N), New Library. |
| **Keywords** button (key icon) | Keyword Editor (Cmd-K). |
| **Background Tasks** button (ring) | Cmd-9. |
| **Dashboard** (center) | Timecode display (project/clip/source TC, click to type), playback/edit status icons (rendering %, audio meters mini). Click timecode to enter numeric move/trim (e.g., "+1:00" moves playhead; with clip selected moves/trims). Ctrl-P = Move playhead (timecode entry), Ctrl-D = change duration. |
| Timeline Scrolling toggle (10.8) | Keeps playhead centered with scrolling timeline. |
| **Browser / Timeline / Inspector** toggle buttons (right) | Show/hide areas. |
| **Share** button | Share menu (destinations). |

---

## 5. Sidebar

| Pane | Contents & behavior |
|---|---|
| **Libraries** (Cmd-`) | Tree: Library → Smart Collections (library-level) → Events → Keyword Collections, Smart Collections, Folders. Select to show contents in Browser. Right-click: New Event, New Folder, New Keyword Collection, New Smart Collection, Reveal in Finder, Close Library, Delete Event, Merge, Copy/Move to Library, Consolidate, Delete Generated Files. Disclosure to show/hide contents. |
| **Photos and Audio** (Shift-Cmd-1) | Photos library albums/memories/people (iCloud Photos), **Sound Effects** (Final Cut Pro sound effects library, ~1300 royalty-free FX installed via additional content), **Music** (Apple Music downloaded DRM-free items, GarageBand, Logic), **Video in Photos**. Items can be dragged directly into timeline (imported on use). |
| **Titles and Generators** (Opt-Cmd-1) | Category list for Titles (Build In/Out, Bumper/Opener, Credits, Elements, Lower Thirds, Social, 360°, plus Themes: e.g., Comic, Documentary, Kinetic? *(verify names)*) and Generators (Backgrounds, Elements, Solids, Textures, 360°). Browser shows thumbnails, skimming previews animation. |

---

## 6. Browser

### 6.1 Views

| Mode | Behavior |
|---|---|
| **Filmstrip view** | Each clip shown as a filmstrip of thumbnails; length represents duration (adjustable). Keyword (blue), favorite (green), reject (red), used-in-project (orange line along the bottom = "Used Media Ranges"), duplicate, analysis lines displayed. Audio waveform optional. |
| **List view** (Opt-Cmd-2 toggles) | Spreadsheet of clips with columns (Name, Start, End, Duration, Content Created, Camera Angle, Notes, Reel, Scene, Take, Roles, Frame size, Codecs, Media Start, File type, etc.). Disclosure shows keyword/marker/rating ranges as sub-rows. Top filmstrip shows selected clip. 11.0 adds list-view keyboard navigation shortcuts. |
| **Clip Appearance** popover (filmstrip icon at top-right) | Clip height slider; **Duration per thumbnail** slider ("All" = one thumbnail per clip, to 1/2 s); **Waveforms** checkbox; **Continuous Playback** (play into next clip); **Group By** (None, Content Created, Date Imported, Reel, Scene, Duration, File Type, Roles, Camera Name, Camera Angle); **Sort By** (Name, Content Created, Take, Duration); Ascending/Descending. Show Hidden Clips (synced/multicam originals hidden 11.0+). |
| Search field + Filter button | Text/transcript/visual search; Filter HUD (Cmd-F) with criteria (§3.3); "New Smart Collection" from filter. |
| Browser filter pop-up | All Clips / Hide Rejected / Favorites / Rejected / No ratings or keywords / Unused. |

### 6.2 Skimming & playhead

| Element | Behavior |
|---|---|
| **Skimmer** | Pink/red vertical line following the pointer; hovering previews video in Viewer (and audio if audio skimming on). Toggle skimming S; audio skimming Shift-S; clip skimming (Opt-Cmd-S) skims individual clips in timeline stacks. |
| **Playhead** | Gray/white line; position for playback & edits. When skimming is on, edits use skimmer position if pointer is over timeline. |
| Range selection in Browser | Click in filmstrip sets a default selection (yellow outline = whole clip or default duration). Drag across filmstrip to define range; I / O set in/out; X selects entire clip; Opt-X clears. Multiple ranges via Cmd-drag. Ranges persist per clip ("remember selection"). |
| Context menu | New Compound Clip, New Multicam Clip, Synchronize Clips, Create Audition, Open in Timeline, Reveal in Finder, Transcode Media, Analyze and Fix, Assign Roles, Rename, Move to Trash, Relink, Detect Beats (12.0, on music clip), Find shot changes / Edit Detection (12.3) *(verify placement)*. |

---

## 7. Viewer

### 7.1 Viewer controls

| Control | Location | What it does |
|---|---|---|
| Title bar info | top-left | Shows format (e.g., "4K 29.97p"), clip/project name, and view percentage. |
| **Zoom pop-up** | top-right | Fit (Shift-Z), 12.5%–400%; Cmd-+/− when Viewer active; zoomed view shows navigation box. |
| **View pop-up** (switch icon) | top-right | See 7.2. |
| **Onscreen control pop-up** | bottom-left | Choose **Transform** (Shift-T), **Crop** (Shift-C), **Distort** (Opt-D), plus Text, Tracker, Magnetic Mask editing when relevant. |
| **Enhancements pop-up** (magic wand) | bottom-left | **Balance Color** (Opt-Cmd-B), **Match Color** (Opt-Cmd-M), **Enhance Light and Color**, **Auto Enhance Audio** (Opt-Cmd-A), **Show Color Inspector** (Cmd-6), **Show Audio Enhancements** (Cmd-8). |
| **Retime pop-up** (speedometer) | bottom-left | Same as Modify > Retime menu (§15). |
| **Play** button | center | Space toggles. |
| Full Screen | bottom-right | Shift-Cmd-F (Esc to exit). |
| Track button (target icon, 10.6) | appears with Transform/effect onscreen controls that support tracking | Starts Object Tracker analysis. |
| Timecode display (if detached) | | Moved to Dashboard in toolbar. |
| Overlay text | | Shows clip name & timecode, missing media slates, "Offline", "Missing Proxy". |

### 7.2 Viewer View menu (Display options)

| Item | Effect |
|---|---|
| Quality: **Better Quality / Better Performance** | Full-res decode vs reduced-res decoding during playback. |
| Media: **Proxy Preferred / Proxy Only / Optimized/Original** | Which media file is used for playback. |
| Show Captions (Opt-Shift-Cmd-C?) | Displays active caption role. |
| Show Both Fields | For interlaced media. |
| Channels: **All / Alpha / Red / Green / Blue** | Solo channel view (alpha shows matte as grayscale). |
| **Show Horizon** (11.0 shortcut) | Overlay horizon line (360 / leveling). |
| **Show Title/Action Safe Zones** | Broadcast safe guide rectangles. |
| **Show Custom Overlay** + Choose Custom Overlay/Add Custom Overlay | Load a PNG guide (e.g., social UI safe area) with opacity slider. |
| **Range Check**: Off / Luma / Saturation / All | Zebra stripes on out-of-gamut / out-of-range pixels. |
| **Show Video Scopes** (Cmd-7) | Opens scopes beside Viewer. |
| **Show 360° Viewer** | Adds a headset-style 360 window next to the Viewer. |
| **Show Angles** (Shift-Cmd-7) | Multicam angle viewer. |
| **Show Comparison Viewer** (Ctrl-Cmd-6) | Side-by-side reference frames. |
| Display: **HDR as Raw Values** vs tone-mapped | In HDR projects shown on SDR displays. |
| Show Event Viewer (Ctrl-Cmd-3) | Second viewer showing Browser clip while timeline plays in main Viewer. |
| Show Stereoscopic/spatial options (11.0) | View as Left eye / Right eye / Side by Side / Anaglyph (Monochrome/Color/Full Color?) / Difference — for spatial video. |
| Show Cinematic onscreen controls | Show focus point brackets for Cinematic clips. |

### 7.3 Onscreen controls

| Control | Handles / behavior |
|---|---|
| **Transform** | Blue bounding box with corner handles (scale proportionally; Shift for free; Opt from center), edge handles (non-uniform scale), center dot (position), rotation handle (line from center), anchor point. "Done" button. Keyframe button in upper-left of Viewer adds keyframes for transform parameters. Snapping guides (yellow) to center/edges when Option? Shift? *(verify)* |
| **Crop** | Top bar: **Trim** / **Crop** / **Ken Burns** buttons. *Trim*: drag edges to cut off edges (leaves empty area, shows lower layers). *Crop*: drag box constrained to frame aspect; result scaled up to fill frame. *Ken Burns*: green Start rectangle and red End rectangle; swap button; play preview; generates a pan/zoom across the clip duration with ease. |
| **Distort** | Four corner handles + edge handles for corner-pinning (perspective); center to move. |
| Effect onscreen controls | e.g., Shape Mask (circle with feather ring, roundness handle, rotation), Draw Mask (Bezier/B-Spline/Linear points), Vignette, Color mask eyedropper, Text title positions, Object Tracker bounding box, Picture in Picture border position, Callout pointer. |
| **Magnetic Mask** onscreen tools | Brush tool with **Add/Subtract**, brush size, **Analyze** button (forward/both directions), Edit/Refine modes, Mask view (Matte, Overlay color). Magnetic Mask Editor window toggled with shortcut (11.1). |

### 7.4 360° and Comparison viewers

* **360° Viewer**: shows a viewport into an equirectangular clip; drag to look around; Field-of-view; it can display controls in the main viewer (horizon/reorient). Project formats support 360 monoscopic/stereoscopic (over/under, side by side); Info Inspector Settings set projection mode (Equirectangular, Monoscopic/Stereoscopic). Reorient in Video Inspector (Tilt/Pan/Roll). 360 effects: 360° Blur, 360° Bloom, 360° Glow, 360° Patch (remove tripod), 360° Noise reduction?, 360° Sharpen; 360° titles & 360° transitions; Add Tiny Planet effect for non-360 projects; 360 output to headset via Share. 
* **Comparison Viewer**: left pane shows reference; pop-ups choose **Previous Edit** (frame before current clip), **Next Edit**, or **Saved Frames** (Frame Browser of grabbed frames: "Save Frame" button / Opt-Cmd-? ). Used for shot matching; Match Color references can come from here.


---

## 8. Projects (timelines) — properties

| Property | Options |
|---|---|
| Project Name / Event | Event that owns project. |
| Starting Timecode | e.g., 00:00:00:00 or 01:00:00:00; drop-frame toggle for 29.97/59.94. |
| Video | "Set based on first video clip properties" (automatic) or Custom: **Format** (1080p HD, 720p HD, 4K, 5K, 6K, 8K, PAL/NTSC, Vertical, Square, Custom, 360° (Mono/Stereo), Spatial (11.0)), **Resolution**, **Rate** (23.98, 24, 25, 29.97, 30, 47.95, 48, 50, 59.94, 60, 90/100/120 since 11.0) |
| Rendering | Codec for render files: ProRes 422 (default), 422 HQ, 422 LT, 422 Proxy, 4444, 4444 XQ, Uncompressed 10-bit 4:2:2 |
| Color Space | **Standard – Rec. 709**, **Wide Gamut – Rec. 2020**, **Wide Gamut HDR – Rec. 2020 PQ**, **Wide Gamut HDR – Rec. 2020 HLG** (HDR requires library Wide Gamut HDR color processing) |
| Audio | Channels: **Stereo** or **Surround (5.1)**; Sample rate 32/44.1/48/88.2/96/176.4/192 kHz |
| 360° | Spherical mode, stereoscopic mode |

Rate can't be changed after first clip added (except via a new project / copy-paste). Vertical projects (e.g., 1080×1920) supported as Custom/Vertical format; **Smart Conform** reframes to a new aspect.

---

## 9. Magnetic Timeline

### 9.1 Structure

| Element | Description | Behavior |
|---|---|---|
| **Primary storyline** | Dark gray band; main spine of the project. Clips are **magnetic**: they butt together, no gaps unless a **Gap clip** is inserted. | Deleting a clip ripples everything left. Moving a clip reorders (others slide). There are no "tracks". |
| **Connected clip** | Clip attached above (video/titles/B-roll) or below (audio) a primary storyline clip by a **connection point** (thin vertical line at a frame). | Moves/deletes with its parent. Opt(Cmd)-click... Hold **` (Grave)** while moving parent to *not* move connected clips ("override connections"). Connection point can be moved with Opt-Cmd-click on connected clip. |
| **Secondary (connected) storyline** | Gray-outlined container holding a sequence of connected clips that behave magnetically among themselves; attached by one connection point. | Create with Cmd-G on selected connected clips; transitions on connected clips auto-create a storyline. Break apart with Shift-Cmd-G. "Collapse to connected storyline". |
| **Gap clip** | Black placeholder in primary (Opt-W inserts 3 s default) | Holds space; connected clips can attach to gaps. |
| **Placeholder clip** | Generator showing framing/gender/number/ background icons (Opt-Cmd-W) | Storyboarding stand-in. |
| **Compound clip** | Nested clips shown as a single clip with compound icon (Opt-G = New Compound Clip). | Double-click to open; navigate back via timeline history arrows (Cmd-[ / Cmd-]). Break Apart Clip Items (Shift-Cmd-G) flattens. Compound clips in Browser are parent clips; timeline instances reference it ("Reference New Parent Clip" to split). Layered PSDs import as compounds. |
| **Audition** | Container with multiple alternative clips (spotlight icon). | Cmd-Y create audition from selection; Y open; Ctrl-Left/Right cycle picks; Shift-Opt-Y finalize *(verify)*; "Duplicate as Audition" (Opt-Y) to try effects variations. Only pick is in the timeline. |
| **Multicam clip** | Multiple angles synced by timecode/content created/audio/markers; plays the active angle. | See §21. |
| **Synchronized clip** | Video + external audio synced by audio waveform/timecode/markers (Opt-Cmd-G "Synchronize Clips"). | Behaves as compound; options to disable camera audio. |
| **Adjustment Clip** (11.1) | Special title/generator-like clip connected above a range; any color correction/effect applied to it affects all clips below it in that range. | Like adjustment layers; supports Transform/Crop too *(verify)*. |
| **Through edit** | Edit point with continuous media both sides (dotted line). | Join Clips (Delete on through edit / Trim > Join Clips). |
| **Clip parts** | Video portion (filmstrip) and audio portion (waveform; colored by role); expanded audio (Ctrl-S) shows separately trimmable audio for J/L cuts; **audio components** (Ctrl-Opt-S) show each channel. Detach Audio (Ctrl-Shift-S) makes separate connected audio clip. |
| Clip badges | Effects (FX), retime, multicam, audition, compound, missing media (red), stabilization/rolling shutter? |
| Markers | Standard (blue), To-do (red; completed green), Chapter (orange, with poster frame pin). Also beat markers / Beat grid (12.0) shown as bar/beat lines above clips. |
| Render bar | Dotted orange line above clips that need rendering *(when background render off it stays)*. |
| Duplicate ranges | Striped bar where same source used twice (View > Show Duplicate Ranges). |
| Timeline history | Back/forward arrows (Cmd-[ / Cmd-]) when navigating into compound clips. |

### 9.2 Timeline Index (Shift-Cmd-2)

| Tab | Features |
|---|---|
| **Clips** | List of every clip in the project in order (name, position, roles); search by name, notes, marker text; filters (All, Video, Audio, Titles, + 10.8 filters: Audio Effects, Video Effects, Retimed, Missing Media, Missing Effects); click to move playhead and select. Search fields (10.8) reel/scene/angle/camera/custom metadata/effect name. |
| **Tags** | Markers (standard, to-do, completed, chapter), keywords, analysis keywords; checkboxes for to-do completion. |
| **Roles** | Toggle on/off roles & subroles; Show Audio Lanes; Collapse Subroles; Focus button; Edit Roles button; Caption roles (show one at a time). |
| **Captions** | List of captions, search text, validation errors (overlaps). |

### 9.3 Timeline appearance (Clip Appearance popover — filmstrip icon at right of timeline toolbar)

| Option | Effect |
|---|---|
| 6 clip display buttons (Ctrl-Opt-1…6) | 1 Large waveforms only; 2 Large waveform small filmstrip; 3 Equal; 4 Large filmstrip small waveform; 5 Filmstrips only; 6 Clip labels only. |
| Zoom slider | Horizontal zoom (Cmd-= / Cmd-−; Shift-Z fit project). |
| Clip height slider | Vertical size. **Vertical Zoom to Fit** (11.0) auto-fits heights. |
| Show: **Clip Names**, **Angles**, **Clip Roles**, **Clip names only? / Lane Headers**, **Connections** | Toggle display. |
| Timeline Scrolling (10.8 button) | Continuous scroll during playback. |

Timeline toolbar left to right: Index button; **Back/Forward** history; Project name & duration (click opens project in Inspector); **Edit buttons** (Connect/Insert/Append/Overwrite + Source pop-up All/Video/Audio); **Tools pop-up**; Skimming / Audio skimming / Solo / Snapping toggles; Clip appearance; Effects browser & Transitions browser buttons.

### 9.4 Timeline toggles

| Toggle | Key | Behavior |
|---|---|---|
| Skimming | S | On/off. |
| Audio skimming | Shift-S | Hear audio while skimming (pitch-corrected scrubbing). |
| Clip skimming | Opt-Cmd-S | Skim individual stacked clips only. |
| **Solo** | Opt-S | Mutes all non-selected clips' audio (selected clips solo). |
| **Snapping** | N | Snap to playhead, edit points, markers, keyframes, beat grid. Hold N temporarily inverts while dragging. |
| Enable/Disable clip | V | Disabled clips are dimmed and neither seen nor heard. |
| Position playhead after edit | Settings | |

### 9.5 Tools (Tools pop-up / keys)

| Tool | Key | Function |
|---|---|---|
| **Select** (arrow) | A | Select, move (magnetic re-order), trim by dragging edges (ripple by default), drag to connect/insert. |
| **Trim** | T | Drag edit point = **roll** (in middle) / ripple (edge); drag clip middle = **slip** (changes source in/out, timeline position/duration unchanged; two-up display shows new in/out frames); Opt-drag = **slide** (moves clip between neighbors, neighbors trimmed). |
| **Position** | P | Moves clips **without magnetism** — overwrites what it lands on and leaves a gap clip where it came from (track-style behavior). Trims also don't ripple. |
| **Range Selection** | R | Drag to select a time range across clips (for marking ratings, partial deletes, ranges for audio volume change with automatic keyframes). |
| **Blade** | B | Click to cut a clip at that point (Shift-click cuts all stacked clips). Cmd-B blades at playhead/skimmer without switching tools. |
| **Zoom** | Z | Click to zoom in, Opt-click out, drag to zoom to area. |
| **Hand** | H | Drag to scroll timeline. |
| Temporary tool | hold key | Holding key switches temporarily; releasing returns to previous tool. |

### 9.6 Edit commands / buttons

| Edit | Key | Behavior |
|---|---|---|
| **Connect** | Q | Connects Browser selection above primary storyline at skimmer/playhead (audio-only clips connect below). Shift-Q = **backtimed connect** (aligns selection's out point to playhead). |
| **Insert** | W | Inserts at playhead into primary storyline (or selected storyline), splitting the clip and rippling later clips. Shift-W backtimed? *(verify)*. Opt-W inserts gap. |
| **Append** | E | Adds to end of primary storyline (or to end of selected storyline). |
| **Overwrite** | D | Overwrites from playhead for selection duration (no ripple). Shift-D = backtimed overwrite (out at playhead). |
| **Replace** (drag onto clip) | Shift-R | Replace (duration of the new source), **Replace from Start** (Opt-R; keeps timeline duration), **Replace from End**, **Replace and Add to Audition**, **Replace with Gap** (Shift-Delete in timeline). Drag a Browser clip onto a timeline clip → menu with Replace/Replace from Start/Replace from End/Replace and Add to Audition/Add to Audition. |
| Source mode | Shift-1 (All), Shift-2 (Video Only), Shift-3 (Audio Only) | Edits use only chosen components. |
| **Overwrite to Primary Storyline** | Opt-Cmd-Down? *(verify: Opt-Cmd-Down)* | Moves a connected clip into primary storyline, overwriting. |
| **Lift from Storyline** | Opt-Cmd-Up | Removes clip from primary to connected, leaving gap. |
| Paste / Paste as Connected | Cmd-V / Opt-V | Insert paste at playhead / connect paste. 12.3 copies a primary clip with its connected clips across timelines. |
| Paste Effects / Paste Attributes | Opt-Cmd-V / Shift-Cmd-V | Paste Attributes window: choose Video attributes (Effects, Transform, Crop, Distort, Compositing, Spatial Conform, Rolling Shutter, Stabilization, Speed), Audio attributes (Volume, Pan, Effects), Maintain Timing vs Stretch to Fit keyframes. Remove Effects (Opt-Cmd-X) / Remove Attributes (Shift-Cmd-X). |
| Delete | Delete | Ripple delete in primary; deletes connected clip. Shift-Delete replace with gap. Fn-Delete (forward delete) deletes range? |
| Swap clips (12.3) | new shortcut *(verify key)* | Swap selected clip with neighbor in primary storyline. |
| Reorder stacked clips (11.0) | shortcuts | Move a connected clip up/down in the stack (Opt-Up/Opt-Down? *(verify)*). |
| 3-point editing | | Any two of source in/out + timeline in/out; FCP computes the rest; backtimed variants using Shift. |
| Duplicate from source / Timecode-based placement | Ctrl-P/Ctrl-D | Typing "+10" moves 10 frames. |

### 9.7 Trimming

| Trim | How | Effect |
|---|---|---|
| **Ripple** | Select tool, drag an edge (yellow bracket) | Changes clip duration; subsequent clips shift; project duration changes. |
| **Roll** | Trim tool on edit point (both sides selected) | Moves edit point; outgoing gets longer/shorter, incoming opposite; duration unchanged. |
| **Slip** | Trim tool drag in clip | Changes source in/out; position & duration unchanged. Two-up displays in/out frames. |
| **Slide** | Trim tool + Opt drag clip | Moves clip in time, adjusts neighbors' durations. |
| **Extend Edit** | Select edit point, place skimmer/playhead, Shift-X | Rolls/ripples edit point to playhead. |
| Trim Start / Trim End | Opt-[ / Opt-] | Trim clip start/end to playhead (ripple). |
| Trim to Selection | Opt-\ | Trims clip to range selection. |
| Nudge trim | , / . (1 frame), Shift-, / Shift-. (10 frames) | Moves selected edit/clip. Subframe audio nudge Opt-, / Opt-. *(verify)* |
| Numeric trim | Select edge, type + or − then number, Enter | |
| Edge selection | [ / ] / \ | Select left edge, right edge, both edges of edit point. |
| Join through edits | Delete on through edit | |
| **Two-up display** (persistent since 12.3) | shown in Viewer while trimming: outgoing out-frame left, incoming in-frame right; skim/settings | |
| Detailed trimming feedback | Settings > Editing | Always show the two-up (pre-12.3). |
| **Precision Editor** (Ctrl-E or double-click edit point) | Primary storyline splits: outgoing clip on top row (with unused handle media ghosted), incoming on bottom row; gray bar in middle = edit point. Drag the edit handle to roll; drag a clip's frame strip to ripple; Arrow Up/Down to move to previous/next edit; Esc/Ctrl-E closes. Works with connected storylines. |
| Trim with **Expanded audio** | split edits (J-cut/L-cut) by dragging audio edges independently; Shift-drag? | |
| Trim with **Clip connections** | Hold ` (Grave) to move a clip without its connected clips; Opt-Cmd click sets connection point. |

### 9.8 Markers

| Action | Key |
|---|---|
| Add marker | M (press again to open marker window) |
| Add marker and modify | Opt-M |
| Marker types | Standard, To Do Item (Completed checkbox), Chapter (exported as chapter markers; poster frame adjustable) |
| Delete marker | Ctrl-M? *(verify)*; delete markers in selection Ctrl-Shift-M |
| Next/Prev marker | Ctrl-' / Ctrl-; |
| Move marker by dragging (11.1); drag off clip to remove | |
| Nudge marker | Ctrl-, / Ctrl-. *(verify)* |

### 9.9 Beat Detection (12.0)

* Run on a music clip (Browser or timeline context menu "Detect Beats" / Modify menu). Uses AI model (from Logic Pro) to find **bars and beats**; displays a **Beat Grid** in the timeline above/across clips with bar lines emphasized. Snapping snaps edits to beats. Toggleable via View menu. Works with any song (no need for tempo metadata). 12.2 fixed a zoom crash.

### 9.10 Edit Detection (12.3)

* For a flattened/rendered video file (e.g., an exported program), **Edit Detection** analyzes for shot changes and splits the clip into separate clips at each cut (scene-cut detection), enabling re-editing of finished masters.


---

## 10. Inspector (Cmd-4)

The Inspector shows tabs depending on selection: **Video**, **Color** (when a color correction exists), **Audio**, **Info**, **Transition**, **Title/Text**, **Generator**, **Share**, **Library/Project properties**. Ctrl-Tab cycles tabs. Header shows clip name + duration. Every parameter row has: **keyframe diamond button** (add/remove keyframe at playhead; arrows to jump to previous/next keyframe), **reset arrow** (hooked arrow) and a disclosure "Show/Hide". Effects can be toggled with a blue checkbox, reordered by drag (render order top → bottom), renamed (10.8/11.1), dragged onto other clips (10.8). Parameter values: drag numeric fields, click to type, Opt-drag for fine. Height of inspector expandable (double-click title bar).

### 10.1 Video Inspector

| Section | Parameters | What they do |
|---|---|---|
| **Effects** | List of applied video effects in order; each with its parameters, mask button (add Shape/Color/Magnetic/Draw mask to the effect), "Show/Hide" | Applied via Effects Browser. Masks limit an effect to an area (Inside/Outside). |
| **Compositing** | **Blend Mode** (Normal, Subtract, Darken, Multiply, Color Burn, Linear Burn, Add, Lighten, Screen, Color Dodge, Linear Dodge, Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix, Difference, Exclusion, Stencil Alpha, Stencil Luma, Silhouette Alpha, Silhouette Luma, Behind, Alpha Add, Premultiplied Mix); **Opacity** 0–100% | How clip composites onto clips beneath (connected clips above primary storyline layer bottom-to-top). Stencil/Silhouette use this clip's alpha/luma as a matte for layers below. |
| **Transform** | **Position X/Y** (pixels from center), **Rotation** (degrees, unlimited), **Scale (All)**, **Scale X**, **Scale Y**, **Anchor X/Y** | 2D transform; onscreen Transform control. Keyframeable; position path shown in Viewer with bezier handles. |
| **Crop** | **Type**: Trim / Crop / Ken Burns; **Left/Right/Top/Bottom** pixels | Trim cuts edges (reveals below); Crop scales to fill; Ken Burns animates between start/end rectangles. |
| **Distort** | **Bottom Left / Bottom Right / Top Right / Top Left** X/Y corners | Corner-pin perspective. |
| **Stabilization** | Checkbox; **Method**: Automatic, **InertiaCam** (gyro-like analysis; offers **Tripod Mode**), **SmoothCam** (with **Translation Smooth**, **Rotation Smooth**, **Scale Smooth** sliders); **Smoothing** amount (InertiaCam) | Analyzes clip (background) and stabilizes with crop/scale. "Excessive Shake" analysis keyword. |
| **Rolling Shutter** | Checkbox; **Amount**: None, Low, Medium, High, Extra High | Corrects CMOS skew/wobble. |
| **Spatial Conform** | **Type**: **Fit** (letterbox/pillarbox to fit), **Fill** (scale to fill, crops), **None** (native pixel size) | How clips of different size/aspect fit the project frame. Smart Conform writes keyframed Transform position for Fill reframes. |
| **360° Reorient** (360 clips) | Tilt, Pan, Roll | Rotate spherical orientation. |
| **Stereoscopic / Spatial** (11.0) | Convergence, eye swap, depth for titles | For spatial video projects. |
| **Cinematic** (Cinematic mode clips; 12.4 also Final Cut Camera) | **Depth of Field** effect: **f-stop / Aperture** slider, focus point editing in Viewer (click subject to set focus; double-click to track; keyframes shown as focus points markers in timeline) | Rack focus after the fact. |
| **ProRes RAW / RAW settings** | (Info Inspector Settings or Video Inspector "RAW to Log Conversion", ISO, Exposure Offset, Color Temperature, Tint, demosaic (11.2)) | RAW decode parameters. |
| **Camera LUT / Log Processing** | (Info > Settings) | Applies camera LUT (Apple Log, Apple Log 2 (11.2), S-Log, C-Log, V-Log, LogC (ARRI auto), RED) before other corrections. |

### 10.2 Color Inspector (Cmd-6)

Pop-up at top selects which color correction to edit (multiple corrections per clip; each named/renamed). See §16 for full color details.

### 10.3 Audio Inspector

| Section | Parameters | Behavior |
|---|---|---|
| **Volume** | dB slider (−∞ to +12 dB) | Clip gain; keyframeable (Ctrl-A shows animation). Ctrl-= / Ctrl-− = ±1 dB. Range selection + volume change auto-creates 4 keyframes with fades. |
| **Audio Enhancements** | **Loudness** (checkbox; **Amount**, **Uniformity** — compression/normalization); **Noise Removal** (Amount); **Hum Removal** (50 Hz / 60 Hz); **Voice Isolation** (checkbox, Amount %, ML-based, 10.6.2+); **Equalization** pop-up (Flat, Voice Enhance, Music Enhance, Loudness, Hum Reduction, Bass Boost, Bass Reduce, Treble Boost, Treble Reduce) + button to show Graphic EQ (10- or 31-band); **Match** (Match Audio — Shift-Cmd-M: pick a reference clip, applies matching EQ) | Analysis indicator (green check / yellow warning / red) per problem. Auto Enhance Audio (Opt-Cmd-A) turns on whichever is needed. |
| **Pan** | **Mode**: None, **Stereo Left/Right** (Amount slider), Surround modes: **Basic Surround** (opens surround panner puck), **Create Space**, **Dialogue**, **Music**, **Ambience**, **Circle**, **Rotate**, **Back to Front**, **Left Surround to Right Front**, **Right Surround to Left Front**; **Amount**; Surround Panner (puck, Original Background, LFE Balance, Rotation, Width, Collapse, Center balance) | Stereo or 5.1 spatial positioning; keyframeable. |
| **Effects** | Applied audio effects list with parameters, preset menus, open AU custom UI button (icon), rename (11.1), reorder, enable checkbox | Logic/AU plug-ins. |
| **Audio Configuration** | Per-component channel pop-up: **Mono**, **Stereo**, **Dual Mono**, **5.1 Surround**, multi-channel options (e.g., 8 × Mono), channel enable checkboxes, waveform previews, per-component role/subrole assignment, per-component **Volume/Pan/Effects** when expanded | Defines how source channels map to components (affects Expand Audio Components). |

### 10.4 Info Inspector

| Metadata view (pop-up bottom-left) | Shows |
|---|---|
| **Basic** | Name, Start, End, Duration, Notes, Roles, Camera Angle, Camera Name, Reel/Scene/Take, Media start, Frame size, Video frame rate, Audio channels/sample rate, Codecs, Location |
| **General** | Basic + Content Created, Date Imported, Media start/end |
| **Extended** | General + detailed codec, color profile, field dominance, file path |
| **Audio** | Audio-specific: channel count, sample rate, output channels, roles, iXML data |
| **EXIF** | Camera make/model, lens, ISO, aperture, shutter, white balance, GPS |
| **IPTC** | Copyright, creator, caption, keywords |
| **Settings** | **Anamorphic Override** (Default/Standard/Widescreen), **Field Dominance Override**, **Alpha Handling** (Straight/Premultiplied/Ignore), **Color Space Override** (e.g., Rec. 709, Rec. 2020 HLG/PQ), **Camera LUT** (None/Apple Log/LUT list/Add Custom Camera LUT), **Log Processing**, **Projection Mode** (Equirectangular / Rectangular), **Stereoscopic Mode** (Monoscopic, Over/Under, Side by Side), **Spatial** (11.0), ProRes RAW / RED / Canon RAW Settings buttons |
| Custom metadata views | Edit Metadata View… (create views using any metadata fields, add custom fields) |
| Bottom buttons | **Apply Custom Name** (naming presets with tokens: Clip Name, Date, Scene, Take, Counter, Camera...), metadata view pop-up, **Save Metadata View As**. |

### 10.5 Transition Inspector

Duration (shown in title); parameters specific to transition (e.g., Cross Dissolve: **Look** (Video, Bright, Dark, Cold, Warm, Sharp, Dull, Additive, Subtractive, Highlights, Shadows), **Amount**, **Ease** (In/Out/In & Out/None), **Ease Amount**); **Audio Crossfade**: Fade In Type / Fade Out Type (**Linear**, **S-Curve**, **+3 dB** (default), **−3 dB**). Modular transitions (11.0) expose component options (e.g., direction, edge style, background).

### 10.6 Title / Text Inspectors

| Inspector | Parameters |
|---|---|
| **Title** (Published parameters of the Motion template) | Template-specific: e.g., Build In/Out checkboxes, colors, positions, styles, drop zones (image wells for video/stills), Layout. |
| **Text** | **Text field** (all text layers); **Preset** pop-up (Text styles: 2D styles, 3D styles; Save Format/Appearance/All Attributes); **Basic**: Font, Size, Alignment (left/center/right/justified), Vertical Alignment, Line Spacing, Tracking, Kerning, Baseline, All Caps, All Caps Size, Position, Rotation, Scale; **3D Text** (Depth, Depth direction, Weight, Front Edge (Square, Round, Concave, Convex, Bevel...), Front Edge Size, Back Edge, Inside corner; Lighting style (Standard, Above, Below, Left, Right, Front Left etc., Off), Self Shadows, Environment (Type, Intensity, Rotation, Contrast, Saturation, Anisotropic)); **Face** (Fill with Color / Gradient / Texture, Opacity, Blur), **Outline** (Color, Opacity, Blur, Width, Layer Order), **Glow** (Color, Opacity, Blur, Radius), **Drop Shadow** (Fill with, Color, Opacity, Blur, Distance, Angle); for 3D: Materials (multi-material per face/edge: Substance (Concrete, Fabric, Metal, Plastic, Stone, Wood, ...), Paint, Finish). |

### 10.7 Generator Inspector

Generator-specific published parameters: e.g., Solids (Color, Custom), Backgrounds (Blobs, Curtain, Stripes, etc. with color/animation params), Textures (Type), Shapes (Shape type: rectangle, circle, star, arrow…, Fill Color, Outline, Outline Color/Width, Drop shadow, Corner roundness), Counting (Start/End numbers, Format: Number, Currency, Percent, Scientific, Spelled Out; Decimal places, Font, Size), Placeholder (Framing: Extreme Wide / Wide / Medium / Medium Close-Up / Close-Up / Extreme Close-Up / ...; People count (0–6+), Gender, Background (Interior/Exterior, Day/Night), View Notes), Timecode (Format, Source, Font, Label, BG opacity), Shapes / Custom (gradients), 360° backgrounds.

---

## 11. Effects Browser (Cmd-5)

Shows thumbnails that preview on the skimmed/selected clip as you hover. Categories in left list; search field; Installed Effects vs Video/Audio heading. Apply: double-click (applies to selected clips), or drag onto clip. Opt-drag? Default effects: Opt-E? Set Default Video/Audio effect via right-click.

### 11.1 Video effect categories (representative contents)

| Category | Effects |
|---|---|
| **360°** | 360° Blur, 360° Bloom, 360° Glow, 360° Noise Reduction, 360° Patch (hide tripod/rig), 360° Sharpen, Tiny Planet (non-360 projects) |
| **Basics** | Aspect Ratio (letterbox), Broadcast Safe, Flipped, Letterbox, Timecode, Video Noise Reduction? *(verify placement)*, **Picture in Picture** (11.0, border/shadow/position), **Callout** (11.0, magnifier with pointer, trackable) |
| **Blur** | Gaussian, Defocus, Directional, Focus, Prism, Radial, Sharpen, Soft Focus, Unsharp Mask, Zoom |
| **Color** | **Color Board**, **Color Wheels**, **Color Curves**, **Hue/Saturation Curves**, **Color Adjustments**, **Custom LUT**, **HDR Tools**, Broadcast Safe, Colorize, Channel Mixer? *(verify)*, Black & White? *(look)*, **Enhance Light and Color** |
| **Color Presets** | Preset Color Board looks (e.g., Bleach Bypass, Blockbuster?, Cool Tone, Day for Night, Warm Tone, Vintage, Sepia...) |
| **Comic Looks** | Comic Basic, Comic Cool, Comic Warm, Inked, Sketch? |
| **Distortion** | Bad TV, Black Hole, Bulge, Cartoon? , Crumple? , Drop Shadow? , Earthquake, Fisheye, Glass Block, Glass Distortion, Insect Eye, Mirror, Page Curl, Ripple, Scrape, Trails, Underwater, Water Pane, Wave |
| **Keying** | **Keyer** (chroma key: Strength, Jitter, Fill holes, Edge distance, Spill level, Invert, Sample color, Edges, Matte tools, Spill suppression, Light wrap, view Composite/Matte/Original), **Luma Keyer** (Luma curve, Invert, Fill holes, Edge distance, matte tools) |
| **Light** | Artifacts, Bloom, Dazzle, Flicker, Glow, Light Noise, Light Rays, Prism?, Spot, Sun? |
| **Looks** | Bleach Bypass, Cinema, Cool, Day into Night, Glory, Low Contrast? , Super 8? (and many presets) |
| **Masks** | **Draw Mask**, **Image Mask**, **Shape Mask**, **Vignette Mask**, **Magnetic Mask** (11.0) |
| **Nostalgia** | Aged Film, Aged Paper, Camcorder, Film Grain, Old Film?, Projector, Sepia?, Super 8mm, Vignette |
| **Stylize** | Add Noise, Censor (blur/pixelate/darken a trackable region), Drop Shadow, Halftone, Line Screen, Pixellate, Posterize, Raster, Simple Border, Slit Scan?, Vignette, Glow? |
| **Text Effects** | Effects for titles (Drop Shadow on text, Outline?) |
| **Tiling** | Kaleidoscope, Kaleidotile, Tile, Perspective Tile? |
| **Spatial/Stereo** | (11.0) Stereo conversion helpers *(verify)* |

Third-party effects (FxPlug 4 plug-ins; Motion-published templates) appear in their own categories. Motion templates saved to `~/Movies/Motion Templates/Effects`.

### 11.2 Audio effect categories (Logic Pro effects + AU)

| Category | Effects |
|---|---|
| **Distortion** | Bitcrusher, Clip Distortion, Distortion, Distortion II, Overdrive, Phase Distortion, Ringshifter, Transient Shaper? |
| **Echo** | Delay Designer, Echo, Modulation Delay, Sample Delay, Stereo Delay, Tape Delay |
| **EQ** | Channel EQ, Fat EQ, Linear Phase EQ, Single Band EQ, AUGraphicEQ, AUNBandEQ, high/low pass filters, Graphic EQ (Match EQ) |
| **Levels** | Adaptive Limiter, Compressor, DeEsser 2, Enveloper, Expander, Gain, Limiter, Multipressor, Noise Gate, Spectral Gate, Surround Compressor, AUDynamicsProcessor, AUPeakLimiter |
| **Modulation** | Chorus, Ensemble, Flanger, Phaser, Scanner Vibrato, Tremolo, Rotor Cabinet? |
| **Spaces** | ChromaVerb, Space Designer (convolution, presets: rooms/halls/outdoor), **Quantec QRS** (Room Simulator, 11.1), Silver/Platinum Verb, AUReverb2, AUMatrixReverb |
| **Specialized** | Correlation Meter? , Denoiser, Exciter, Grungelizer, SubBass, Stereo Spread, Direction Mixer, Test Oscillator, Multimeter? |
| **Voice** | DeEsser, Pitch Correction, Pitch Shifter, Vocal Transformer, Voice-over enhancer presets |
| **Final Cut presets** (top-level "Final Cut" groups) | Ready-made chains: Car Radio, Cathedral, Telephone, Walkie-Talkie, Robot, Alien, Disc? , Underwater, Space? , Megaphone, Cave, Arena, Small Room, Large Room, Stadium, etc. |
| Audio Units | Third-party AU plug-ins (validated at launch; 12.2 faster startup) |

---

## 12. Transitions Browser (Ctrl-Cmd-5)

| Behavior | Detail |
|---|---|
| Apply | Select edit point(s)/clip(s) and Cmd-T (default transition: Cross Dissolve, 1 s) or double-click/drag from browser. Applying to a clip adds at both ends. |
| Media handles | Transition needs handle media; if insufficient, FCP asks to overlap (shorten clip and project) — "Full overlap" default. |
| Connected clips | Transition on connected clip auto-wraps it in a connected storyline. |
| Duration | Drag edges, Ctrl-D, Transition inspector. |
| Audio | Video transitions on clips with attached audio add a crossfade. Audio-only crossfade: Opt-Cmd-T *(verify)*: Modify > Adjust Audio Fades > Crossfade. |
| Categories | **360°**, **Blurs** (Cross Blur, Zoom & Pan, Simple?), **Dissolves** (Cross Dissolve, Dip to Color, Fade to Color, **Flow** — morph for jump-cuts in interviews, Divide?), **Lights** (Flash, Light Noise, Bloom?), **Movements** (Doorway, Fall, Page Curl, Push, Slide, Spin, Swap, Zoom, Cube, Pinwheel? ), **Objects** (Star, Heart, Leaves...), **Replicator/Clones**, **Stylized** (Comic, Pinwheel? , Stylized Mosaic, Static), **Wipes** (Band, Center, Clock, Gradient Image, Letter X, Mask?, Wipe, Star?), plus theme transitions. 11.0 added **modular transitions** (configurable shapes/directions). |
| Set default | Right-click > Make Default. |

---

## 13. Titles & Generators

| Title category | Examples |
|---|---|
| **Build In/Out** | Basic Title? , Centered, Assembler, Blur, Bumper?, Clouds? , Custom (Opt) , Echo, Far Far Away, Gravity, Lens Flare, Organic, Reveal, Slide, Sci-Fi, Shatter? |
| **Bumper/Opener** | Animated openers, Cinematic Title? |
| **Credits** | Scrolling credits, Tri-column? |
| **Elements** | Gradient, Lower Third Elements, Bars? |
| **Lower Thirds** | Basic Lower Third (Shift-Ctrl-T), Gradient Edge, News?, Social?, etc. |
| **Social** (newer) | Social-media themed titles (vertical-friendly) |
| **3D / 3D Cinematic** | Basic 3D, Clouds, etc. 3D text with materials |
| **360°** | 360° title (equirectangular-correct) |
| Defaults | **Basic Title** (Ctrl-T) and **Basic Lower Third** (Shift-Ctrl-T) |

Generators: **Backgrounds** (Blobs, Clouds, Curtain, Organic, Paper, Formula, etc.), **Elements** (Counting, Placeholder, Shapes, Timecode), **Solids** (Custom, colors), **Textures** (Cloth, Concrete, Marble, Wood...), **360°** backgrounds, **Adjustment Clip** (11.1 — in Titles/Generators; search "Adjustment").

Title workflow: text editable directly in Viewer (double-click), Text Inspector, Find and Replace Title Text (Edit menu), "Open a copy in Motion" to make new template. Captions are distinct from titles (§18).

### 13.1 Motion templates (FCP ↔ Motion)

| Concept | Detail |
|---|---|
| Template types | **Final Cut Effect**, **Final Cut Generator**, **Final Cut Title**, **Final Cut Transition** (Motion project types). |
| Publishing | In Motion, rig/publish parameters ("Publish" in parameter menu) — appear in FCP Inspector; **Rigs & Widgets** (Slider, Pop-up, Checkbox, Screen widgets) expose snapshots. |
| Drop zones | Image wells that accept video/stills in FCP. |
| Build In/Out markers | Timing markers for titles to stretch middle while keeping in/out animation duration. |
| Effect source | Effects use "Effect Source" placeholder; transitions use "Transition A/B". |
| Storage | `~/Movies/Motion Templates/` (Effects, Generators, Titles, Transitions; Category/Theme folders), or embedded in library (Motion Content in Library). |
| Open a copy in Motion | Right-click a template in FCP browser. Consolidate Motion Content (11.0 shortcut). |
| FxPlug 4 | Third-party native plug-in API (C/Obj-C/Swift) with custom UI and onscreen controls. |


---

## 14. Keyframes & animation

| Feature | Detail |
|---|---|
| Inspector keyframes | Diamond button per parameter; yellow/orange filled when on a keyframe; arrows navigate. Opt-K adds keyframe to the parameter in the current animation pane; Opt-; / Opt-' prev/next keyframe. |
| **Video Animation editor** (Ctrl-V) | Opens above a timeline clip: rows per animatable parameter (Transform, Crop, Distort, Compositing: Opacity, effects). Each row collapsible to show keyframes; double-click to expand curve view for opacity; select multiple keyframes, drag in time; right-click keyframe for interpolation: **Linear**, **Smooth** (ease), plus **Ease In / Ease Out** on spatial transforms; Fade handles (opacity fade in/out). 12.4 fixed keyframe paste here. |
| **Audio Animation editor** (Ctrl-A) | Shows volume, pan, and effects parameters as keyframe rows. |
| Volume line (in waveform) | Drag up/down; Opt-click adds keyframe; range selection + drag creates keyframes automatically. |
| Fade handles | Small handles at top corners of audio waveform (and video opacity in animation editor) to drag fades; right-click fade handle to choose shape: **Linear**, **S-curve**, **+3 dB** (default), **−3 dB**. Modify > Adjust Audio Fades > Fade In / Fade Out / Apply Fades / Remove Fades. |
| Motion path | Position keyframes shown in Viewer as path with Bezier control; right-click points (Linear/Smooth). |
| Paste keyframes | Copy/paste keyframes across clips (Edit > Paste Attributes with keyframes, "Maintain timing" vs "Stretch to fit"). |

---

## 15. Retiming (Cmd-R shows Retime Editor)

Retime pop-up (Viewer) or Modify > Retime. Retime Editor is a bar above clip with colored segments: **Green** = fast, **Orange** = slow, **Blue** = normal (100%), **Red** = hold/0%; drag handle on bar end to change speed (and duration ripple). Right-click segment for menu.

| Command | Key | Behavior |
|---|---|---|
| Slow 50% / 25% / 10% | | Constant slow motion; clip lengthens (ripple). |
| Fast 2× / 4× / 8× / 20× | | Speeds up; clip shortens. |
| Normal (100%) | Shift-N | Resets segment to 100%. |
| **Hold** | Shift-H | Inserts a 2-second freeze segment at playhead (red). |
| Freeze Frame (Edit > Add Freeze Frame) | Opt-F | Inserts/connects still frame clip at playhead (default 4 s). |
| **Blade Speed** | Shift-B | Splits the retime bar into speed segments without cutting the clip. |
| **Speed Transitions** | | Checkbox in retime menu; smooth ease between segments; double-click transition handle to set source frame. |
| **Custom Speed** | Ctrl-Opt-R | HUD: Direction Forward/Reverse, Set Speed by Rate (%) or Duration, **Ripple** checkbox. |
| **Reverse Clip** | | Plays backward (segment shows arrows). |
| **Rewind** 1× / 2× / 4× | | Adds a rewind segment that plays back the section then continues forward. |
| **Instant Replay** 1×/... | | Duplicates a range immediately after itself (adds "Instant Replay" title optionally). |
| **Jump Cut at Markers** 3/5/10/20/30 frames | | Removes N frames at each marker for jump-cut effect. |
| **Speed Ramp** to 0% / from 0% | | Creates 4 decelerating/accelerating segments (100→75→50→25 etc.). |
| **Automatic Speed / Conform Speed** | | Conforms clip's native rate to project rate (e.g., 60p in 24p timeline plays at 40% = smooth slow-mo). |
| **Preserve Pitch** | | Keeps audio pitch when speed changes (default on). |
| **Video Quality**: **Normal** (frame duplication), **Frame Blending**, **Optical Flow** (motion-estimated interpolated frames, requires analysis/render), **Machine Learning / Smooth Slo-Mo** (10.8+, Apple silicon) | | Interpolation method for slowed footage. |
| Reset Speed | Opt-Cmd-R | Removes all retiming. |
| Show Retime Editor | Cmd-R | |

---

## 16. Color correction & grading

### 16.1 Color architecture

* Each clip can hold multiple color corrections (in Effects stack; render top-to-bottom). The Color Inspector's pop-up selects the correction; "+" adds new; corrections can be renamed (10.8), presets saved.
* Library Color Processing (Standard / Wide Gamut HDR) + project color space (§8) + clip **color space override** + Camera LUT/log processing define the pipeline: source → (RAW decode / Camera LUT) → effects & corrections in working space → project space → output (HDR tone mapping for SDR displays).
* Automatic corrections: **Balance Color** (Opt-Cmd-B; neutralizes cast/contrast using analysis; or click "Balance Color: White Balance" eyedropper in Video Inspector to pick a neutral area), **Match Color** (Opt-Cmd-M; choose reference frame from Viewer side-by-side → "Apply Match"); **12.3 Match Color tool** — a more advanced shot-matching tool to match across cameras, lighting, and cinematic styles; **Enhance Light and Color** (10.8; ML exposure/contrast/color with single **Amount**).

### 16.2 Color Board

| Pane | Controls | Function |
|---|---|---|
| **Color** (Ctrl-Cmd-C) | Four pucks — **Master**, **Shadows**, **Midtones**, **Highlights** — dragged on a hue/up-down board | Up = add that hue; down = add complementary. Horizontal = hue, vertical = amount. Fields show angle and %. |
| **Saturation** (Ctrl-Cmd-S) | Four vertical pucks | Saturation per tonal range (−100 to +100%). |
| **Exposure** (Ctrl-Cmd-E) | Four vertical pucks | Brightness per tonal range. |
| Shortcuts | Opt-Cmd-arrow nudges selected puck *(verify)* | |

### 16.3 Color Wheels

| Control | Function |
|---|---|
| Four wheels: **Master**, **Shadows**, **Midtones**, **Highlights** | Center puck = hue/tint; left slider = **Saturation**; right slider = **Brightness**. View pop-up shows all four or single large wheel. |
| **Temperature** (K) | Warm/cool shift (2500–10000K). |
| **Tint** | Green/magenta. |
| **Hue** | Global hue rotation (degrees). |
| **Mix** | Blend correction with original (0–1). |

### 16.4 Color Curves

| Control | Function |
|---|---|
| **Luma** curve | Contrast/tone; add points by clicking; drag; delete with Delete key. |
| **Red / Green / Blue** curves | Per-channel curves. |
| **Preserve Luma** checkbox | RGB adjustments don't change luminance. |
| Eyedropper (per curve) | Sample a color to add a control point at that value on the curve. |
| **Mix** slider | Blend. |
| Reset per curve | |

### 16.5 Hue/Saturation Curves

| Curve | X axis → Y effect |
|---|---|
| **Hue vs Hue** | Shift a hue to another hue (e.g., turn green to teal). |
| **Hue vs Saturation** | Saturate/desaturate specific hues. |
| **Hue vs Luma** | Brighten/darken specific hues. |
| **Luma vs Saturation** | Saturation by brightness (e.g., desaturate highlights). |
| **Saturation vs Saturation** | Adjust saturation of already saturated/unsaturated areas. |
| **Orange vs Saturation** (skin) | Saturation of skin tone hue based on its saturation. *(verify exact name: "Orange vs Sat")* |
| Eyedropper | Samples color to place 3 points around hue. |
| Mix | Blend. |

### 16.6 Color Adjustments effect (10.6+)

Simple sliders: **Exposure**, **Contrast**, **Brightness**, **Saturation**, **Highlights**, **Black Point**, **Shadows**, **Highlights Warmth**, **Highlights Tint**, **Midtones Warmth**, **Midtones Tint**, **Shadows Warmth**, **Shadows Tint**, **Mix**. (Photos-like.)

### 16.7 Masks on corrections

| Mask | Behavior |
|---|---|
| **Shape Mask** | Ellipse/rect with roundness, feather; onscreen controls; keyframeable/trackable (Object Tracker). Inside/Outside correction toggles. |
| **Color Mask** | Eyedropper samples color (Shift-drag to add, Opt-drag to subtract); type **3D** (RGB cube distance with Softness) or **HSL** (Hue/Saturation/Luminance ranges with each toggle); View Masks (alpha matte). |
| **Magnetic Mask** (11.0) | ML subject segmentation across frames; can be used as an effect (Masks category) or on a correction; output used for compositing (subject over new background) or inside/outside grading. |
| **Auto Mask** (12.3) | Automatically isolates recognized objects (e.g., person, sky?) for color correction/enhancement without manual tracking. |
| Mask combine | Multiple masks with Add, Subtract, Intersect modes; "Invert". |
| View | "View Masks" button toggles matte view in Viewer. |

### 16.8 HDR tools & LUTs

| Tool | Detail |
|---|---|
| **HDR Tools** effect | Modes: **Rec. 2020 PQ to HLG**, **Rec. 2020 HLG to PQ**, **PQ to SDR**?, **HLG to SDR**?, **Rec.709 SDR to PQ/HLG** *(verify list)*; **Peak brightness** (nits) slider (e.g., 1000). Used for converting between HDR standards and tone-mapping. |
| **Tone Mapping** | Project/View option: Display HDR as raw values vs tone-mapped; Share option "HDR → SDR tone map" in Export File (convert Rec.2020 HDR projects to Rec.709). |
| **Custom LUT** effect | Load .cube / .mga LUTs; **Input** color space (e.g., Rec.709, Rec.2020, PQ, HLG, Apple Log, Log variants) and **Output** color space; Mix. |
| **Camera LUT** (Info Inspector > Settings) | Applied at decode, before corrections. Built-in camera log LUTs: Apple Log / Apple Log 2 (11.2), ARRI LogC (auto), Blackmagic, Canon Log/2/3, DJI D-Log, Fujifilm F-Log, Nikon N-Log, Panasonic V-Log, Sony S-Log2/3, RED... Add Custom Camera LUT. |
| HDR monitoring | Pro Display XDR/MacBook Pro XDR show HDR directly; A/V Output to HDR monitors. |
| Range check | Luma/saturation zebras for broadcast compliance. |
| Broadcast Safe effect | Clamps luma/chroma to broadcast-legal range. |

### 16.9 Video Scopes (Cmd-7)

| Scope | Modes / options |
|---|---|
| **Waveform** | RGB Parade, RGB Overlay, Red/Green/Blue only, Luma, Chroma, YCbCr Parade; units **IRE** / **millivolts** / **nits** (HDR, with scale to 10000 nits); Guides; Brightness slider; monochrome/color display. |
| **Vectorscope** | Standard; Zoom 100% / 133% / 200% *(verify)*; **75%/100%** color targets; **Skin tone indicator** line; display brightness; Guides. |
| **Histogram** | RGB Overlay, RGB Parade, Luma, Red/Green/Blue channels. |
| Layout | 1, 2, 3 (vertical/horizontal), or 4 scopes simultaneously via View pop-up in scopes pane. |
| Scopes follow | Viewer (or Event Viewer) — "Scopes on Event Viewer" toggle. |
| Settings | Show Guides, Brightness, Traces. |

---

## 17. Audio editing

| Feature | Detail |
|---|---|
| Audio display | Waveforms colored by role; peaks red when clipping (> 0 dBFS); reference waveforms (ghost of original level, Settings > Editing). |
| **Audio meters** (Shift-Cmd-8) | Per-channel peak meters with peak hold; stereo or 5.1; mini meters on Dashboard. |
| **Expand audio** (Ctrl-S) | Shows audio separately within a clip to create split edits (J/L cuts) while staying synced. Collapse with Ctrl-S. |
| **Expand Audio Components** (Ctrl-Opt-S) | Shows each channel component (lane per channel) with independent volume, pan, effects, enable, trim. |
| **Detach Audio** (Ctrl-Shift-S) | Separates audio into a connected audio-only clip (sync no longer enforced except via connection). |
| Break Apart Clip Items | For synced/compound clips. |
| **Audio Lanes** (Timeline Index > Roles > Show Audio Lanes; 11.0 shortcuts) | Organizes connected audio into role lanes with headers; drag to reorder; focus lane; subroles collapse. |
| **Fades** | Fade handles at clip ends (§14); Apply Fades / Remove Fades; crossfade between adjacent audio clips (Modify > Adjust Audio Fades > Crossfade, Opt-T? *(verify)*). Default fade duration in Settings. |
| **Volume keyframes** | Opt-click line; range-selection + volume drag; Animation editor; "Adjust Volume Absolute/Relative" (Modify > Adjust Volume > Up/Down/Absolute/Relative/Reset/Silence (-∞)). |
| **Voice Isolation** | ML-based dialogue separation from background noise/music; Amount slider. |
| **Loudness** | Normalizing/compression (Amount, Uniformity). |
| **Noise Removal** | Broadband noise reduction (Amount). |
| **Hum Removal** | Notch filter at 50/60 Hz + harmonics. |
| **Match Audio** (Shift-Cmd-M) | Match EQ of one clip to another chosen clip (Graphic EQ "Match"). |
| **Auto Enhance Audio** (Opt-Cmd-A) | Applies needed enhancements based on analysis. |
| **Analyze and Fix** | Modify > Analyze and Fix (detect loudness/noise/hum problems; separate mono & stereo; remove silent channels). |
| **Solo / Mute** | Solo (Opt-S) selected clips; Disable (V) to mute a clip; role-level enable in Timeline Index. |
| **Record Voiceover** (Opt-Shift-Cmd-8) | Records to new connected clip at playhead with count-in; Input gain, Monitor (headphones), Create Audition from takes, Event destination, Role assignment (11.x bug fix for external storage). |
| **Sync** | Synchronize Clips by audio waveform (Opt-Cmd-G); multicam angle sync by audio. |
| Subframe nudge | Audio can be edited at subframe (1/80 frame) precision when zoomed in; Opt-,/Opt-. *(verify)*. |
| Surround | 5.1 projects; Surround panner; Surround Compressor. |
| Sound effects / music | Built-in Final Cut sound effects library; Beat Detection grid (12.0) for music editing; Logic Pro integration via FCPXML/AAF (third-party X2Pro). |
| Audio sample rate | Project-wide; mixed sources resampled. |


---

## 18. AI / ML features (consolidated)

| Feature | Since | Where | What it does / how it works | Requirements |
|---|---|---|---|---|
| **Find People** analysis | 10.0 | Import / Analyze and Fix | Detects faces/number of people & shot framing → analysis keywords | — |
| **Balance Color / Match Color** | 10.0 | Enhancements pop-up | Auto white balance & contrast; match one shot's look to another | — |
| **Object Tracker** | 10.6 | Drag a title/effect/shape mask onto Viewer → track button; or Video Inspector "Tracker" section | Analyzes movement of a face/object (ML detection for faces & objects; **Machine Learning** or **Point Cloud** analysis methods) and drives position/scale (and rotation) of the attached element. Multiple trackers per clip; offset; trackers can be shared between effects ("Tracker" pop-up). | Apple silicon faster |
| **Smart Conform** | 10.4.1 | Modify > Smart Conform (after changing project to vertical/square) or Spatial Conform | Analyzes each clip to find subject and keyframes Fill-mode position to keep subject in frame when reformatting aspect ratio. | — |
| **Cinematic mode editing** | 10.6.2 (iPhone 13+); 12.4 Final Cut Camera clips (macOS 27) | Video Inspector "Cinematic" effect + Viewer focus points | Uses the depth map recorded alongside video; change focus subject (click), track focus (double-click), change f-stop / depth-of-field amount, focus keyframes appear in timeline row. | — |
| **Voice Isolation** | 10.6.2 | Audio Inspector › Audio Enhancements | ML separation of speech from background; Amount %. | Apple silicon recommended |
| **Duplicate Detection** | 10.4? | View > Show Duplicate Ranges | Flags reused media ranges. | — |
| **Enhance Light and Color** | 10.8 | Effects Browser (Color) / Enhancements pop-up | One-click ML exposure, contrast, color correction; Amount slider. | — |
| **Smooth Slo-Mo** | 10.8 | Retime > Video Quality > Machine Learning | ML frame interpolation for high-quality slow motion. | Apple silicon |
| **Magnetic Mask** | 11.0 | Effects Browser › Masks; Magnetic Mask Editor | Click/brush subject → analyze forward/backward to produce a per-frame matte (no green screen). Add/Subtract brushes, refine edges, combine with color corrections or use as compositing matte. | Apple silicon recommended |
| **Transcribe to Captions** | 11.0 | Edit > Captions > Transcribe to Captions (or Timeline Index) | On-device LLM transcribes dialogue-role audio into a caption role (choose role/language). Captions auto-split into timed segments. | Apple silicon + macOS 15 |
| **Image Playground** | 11.1 | Window/File menu → Image Playground | Generates stylized images (Animation, Illustration, Sketch styles) from text prompts / Photos people via Apple Intelligence; adds to Browser. | macOS 15.2+, M1+ |
| **Transcript Search** | 12.0 | Browser search field (transcript mode) | Index of all speech; search exact phrase or natural language meaning; results are ranges you can mark/edit directly. | Apple silicon |
| **Visual Search** | 12.0 | Browser search field (visual mode) | Natural-language search of visual content ("person riding bicycle at sunset"); returns ranges. | Apple silicon |
| **Beat Detection** | 12.0 | On music clip; Beat Grid in timeline | ML (Logic Pro model) detects bars & beats; snapping to beats. | — |
| **Generate Captions** | 12.3 | Captions menu | Creates customizable **subtitles** (styled, positioned, open-caption style) from speech. | Apple silicon, US English |
| **Auto Mask** | 12.3 | Color/effect masks | Recognizes objects (people, sky, etc.) and isolates them for correction/enhancement without manual tracking. | — |
| **Match Color (new tool)** | 12.3 | Color | Matches color across cameras, lighting, and cinematic styles (reference-based). | — |
| **Edit Detection** | 12.3 | Browser/timeline clip | Scene-cut detection splits a rendered video at shot changes. | — |
| **Montage Maker / Auto Crop** | iPad 3.0 (Jan 2026) | FCP for iPad | AI assembles a first-pass edit from strongest moments, adjusts pacing, cuts to music; Auto Crop converts horizontal → vertical. | iPad only (Mac equivalents: Smart Conform) |

---

## 19. Captions & subtitles

| Aspect | Detail |
|---|---|
| Formats | **CEA-608** (broadcast closed captions, roll-up/pop-on/paint-on, 4 channels CC1–CC4, 32 char limits), **iTT** (iTunes Timed Text, for Apple TV/iTunes; positions top/bottom), **SRT** (SubRip, simple text; formatting bold/italic/underline/color, position), **Subtitles** (12.3, styled open subtitles via Generate Captions). |
| Caption roles | Each format+language creates a caption role/subrole (e.g., "iTT English"). Only one caption role visible at a time in Viewer. |
| Captions in timeline | Displayed in a **captions lane** above the primary storyline (purple bars), connected to clips; move with their clips. |
| Add caption | Edit > Captions > Add Caption (Opt-C) — creates at playhead; **Caption Editor** (Ctrl-Shift-C) for inline edit with formatting; Inspector shows Text, Formatting (bold/italic/underline, color, background), Placement, Language, Display Style (CEA-608 pop-on/roll-up/paint-on), validation. |
| **Transcribe to Captions** (11.0) | Auto transcription from dialogue role → iTT/SRT/CEA-608. |
| **Generate Captions → Subtitles** (12.3) | Subtitles with custom fonts/positions; convert existing closed captions to subtitles; Select All Subtitles; edit multiple subtitles' position/rotation/scale/alignment at once in Inspector. |
| Import/Export | Import SRT/iTT/SCC; Export captions file (File > Export Captions) per role; Share: embed captions in movie (iTT/608 in QuickTime) or as sidecar; burn-in via "Burn in captions" option in Export File. |
| Duplicate/convert | Edit > Captions > Duplicate Captions to New Language / Duplicate as (format) to convert between formats. |
| Validation | Timeline Index shows errors (overlaps, too many chars, too short); red highlight. |
| Extract | Extract Captions from embedded clip captions to timeline captions. |

---

## 20. 360° VR, Spatial video, HDR (summary)

| Topic | Points |
|---|---|
| 360° projects | Equirectangular projects (Monoscopic or Stereoscopic: Over/Under, Side by Side); 360 viewer; Reorient (Tilt/Pan/Roll); 360 Patch; 360 titles/transitions/generators; add non-360 clip into 360 project with "360° Transform" (place flat images in sphere); export with 360 metadata; Tiny Planet effect in non-360 project with reorient; headset playback with VR headset via SteamVR (older) *(verify current)*. |
| Spatial video (11.0) | iPhone 15 Pro/16 and Vision Pro spatial (MV-HEVC) import; Spatial projects; stereoscopic viewing modes in Viewer (Left/Right/Both/Anaglyph/Difference); **convergence/depth** adjustments; titles placed in depth; export MV-HEVC spatial for Vision Pro (Apple silicon). |
| HDR | Library Wide Gamut HDR + project Rec.2020 PQ/HLG; HDR tools; tone mapping to SDR; scopes in nits; export HEVC 10-bit HDR or ProRes with HDR metadata (mastering display, MaxCLL/MaxFALL via Compressor? *(verify)*); Dolby Vision 8.4 metadata for iPhone HDR clips preserved on share. |

---

## 21. Multicam editing

| Step | Detail |
|---|---|
| Create | Select clips in Browser → File > New > Multicam Clip (or right-click). **Automatic settings**: angle assembly by **Camera Angle** / **Camera Name** / **Clips** (each clip own angle); angle clip ordering by **Timecode** / **Content Created**; angle synchronization by **Timecode** / **Content Created** / **Start of First Clip** / **First Marker on the Angle**; **Use audio for synchronization** checkbox. Custom: video format, resolution, rate, audio, rendering codec. Up to 64 angles; mixed formats/rates. Originals auto-hidden (11.0). |
| Angle Viewer (Shift-Cmd-7) | Grid of 2, 4, 9, or 16 angles per bank; banks paged; overlays show angle names & timecode; active video angle outlined **blue**, active audio angle **green**, both = yellow. Settings: Display (Timecode, Angle names), show angle viewer layout. |
| Switching modes (Angle Viewer top-left icons) | **Enable Audio/Video Switching** (yellow), **Video-only** (blue), **Audio-only** (green). |
| Live cutting | During playback click angle (or press 1–9 = cut & switch with current mode; Opt-1…9 = cut/switch video only; Shift-Opt-1…9 = audio only *(verify)*; Opt-click in viewer = switch without cut). Each cut creates **through edit** in multicam clip. |
| Switch angle | Select clip segment → Option-click angle or Clip > Active Video Angle / Active Audio Angle; Ctrl-Shift-Left/Right *(verify)* previous/next angle. |
| Angle Editor | Double-click multicam clip (or Open in Angle Editor): shows all angles stacked like tracks with Monitoring (speaker icon), Sync to Monitoring Angle (sync by audio interactively), add angle, rename, reorder, set video/audio monitoring angle; edit within angle (color correct per angle, applies to all instances). |
| Trimming | Roll edits between angles ("through edit" roll keeps sync). |
| Effects | Apply color correction in Angle Editor to affect all uses; in timeline only for that segment. |
| Optimize | Settings > Playback "Create optimized media for multicam clips"; proxy playback for many angles. |
| Reveal source (11.1) | Reveal multicam angle's source clip in Browser. |
| Angle switch latency fix | 12.4. |
| Collapse | Clip > Collapse Multicam Clip? / "Break Apart" turns active angles into regular clips. |
| Live Multicam (iPad) | Record up to 4 iPhones/iPads via Final Cut Camera, then auto-creates multicam on iPad; can bring to Mac. |

---

## 22. Share / Export

### 22.1 Share destinations (File > Share; Cmd-E = default destination)

| Destination | Notes |
|---|---|
| **Export File** (default) | Master/deliverable file (see 22.2). |
| **Apple Devices 720p / 1080p / 4K** | H.264/HEVC presets compatible with iPhone/iPad/Apple TV; option to add to Apple TV/Music library. |
| **Apple ProRes / Master File** (= Export File preset) | |
| **YouTube & Facebook** | H.264/HEVC preset; direct upload removed in later versions? FCP signs in for YouTube upload *(verify; recent versions export a file "for YouTube & Facebook")*. |
| **Save Current Frame** | Image formats: JPEG, PNG, TIFF, Photoshop, DPX, OpenEXR, HEIF, BMP; option scale to frame. Send frame to **Pixelmator Pro** (12.3). |
| **Export Image Sequence** | DPX, TIFF, PNG, JPEG, OpenEXR... |
| **Photos** (11.0) | Direct export to Photos library. |
| **Compressor settings** | Any Compressor preset added as destination (requires Compressor). |
| **Bundle** | Multiple destinations in one share (e.g., master + YouTube + captions). |
| **Send to Compressor** | File > Send to Compressor: opens the project in Compressor for batch encoding with custom settings, HLS, IMF, iTunes Store package, MXF, multi-pass. Also supports roles & captions. |
| **Export XML** (Shift-Opt-Cmd-E? *(verify)*) | FCPXML (1.14 in 12.0) as `.fcpxmld` bundle or `.fcpxml`; metadata view selection; for third-party (DaVinci Resolve, Premiere via XtoCC, Logic via X2Pro, AAF via X2Pro). |
| **Export Captions** | Per caption role. |
| **DVD/Blu-ray** | Removed in 10.8. |

Share is a background task; batch share multiple projects (12.3 fixed crash). Shared items badge appears on project ("Shared" history in Info inspector Share pane).

### 22.2 Export File settings

| Tab | Settings |
|---|---|
| **Info** | Title, Description, Creator, Tags (written as metadata) |
| **Settings › Format** | **Apple Devices**, **Computer**, **Web Hosting**, **Video and Audio**, **Video Only**, **Audio Only**, **Master File**?, **MXF** (since 10.4.?/11.0), **360° / Spatial** |
| Video codec | **H.264**, **HEVC 8-bit**, **HEVC 10-bit** (HDR), **Apple ProRes 422 Proxy / LT / 422 / HQ / 4444 / 4444 XQ**, **Uncompressed 8-bit 4:2:2 / 10-bit 4:2:2**, **Source – (render codec)**; for MXF: ProRes / Uncompressed / AVC-Intra? |
| Resolution | Project resolution or scaled (e.g., 3840×2160, 1920×1080, 1280×720) |
| Color Space | Matches project; HDR→SDR conversion option (Rec.709) for HDR projects; "HDR Rec.2020 PQ/HLG" output |
| Audio file format (Audio only) | AAC, AIFF, CAF, MP3, WAV |
| **Action** | Save only; **Open with QuickTime Player**; **Open with TV**; **Open with Compressor**; Add to Music playlist?; **Open with Photos** |
| **Roles as** (Roles tab) | **QuickTime Movie** (mixdown), **Multitrack QuickTime Movie** (each audio role = separate track stem, plus video role tracks), **Separate Files** (one file per role/stem, e.g., Dialogue.wav, Music.wav, Effects.wav, Video.mov). Per-role output channel config (Mono, Stereo, Surround). Enable/disable roles; save as role preset. Captions role inclusion (embed iTT/608) or burn-in. |
| Include chapter markers | Chapter markers become QuickTime/MP4 chapters. |
| **Allow export segmentation** | Parallelize encoding across segments (11.x; 11.1.1 fixed frame rate issue). |
| Quality/Compress | "Faster encode (single pass)" vs "Better quality (multi-pass)" for H.264/HEVC; Data rate (Automatic/Custom kbps). |
| Summary | File size estimate, duration, format summary. |
| Range | Exports the range selection if one is set in the project, else entire project. |

### 22.3 Compressor (companion app)

| Feature | Detail |
|---|---|
| Presets | Apple Devices, Web Sharing (YouTube/Vimeo etc. as file), Broadcast (ProRes, MXF OP1a: AVC-Intra, XDCAM HD422, DNxHD? via plug-in), Audio formats, Image sequences, HLS (HTTP Live Streaming) multi-bitrate, iTunes Store Package, IMF (Interoperable Master Format), AV1? *(verify)*, HEVC HDR with Dolby Vision metadata. |
| Settings Inspector | Video: codec, frame size, crop/pad, frame rate (retiming/frame controls, optical flow conversion), field order, color space/HDR metadata (mastering display, MaxCLL); Audio: channels, layout, sample rate, loudness normalization (EBU R128 / ATSC A/85); Filters (watermark, timecode overlay, text, gamma correction, color...). |
| Distributed encoding | Share computers; batch; watch folders; droplets. |
| Integration | Send to Compressor from FCP (roles, captions passthrough); Compressor settings as FCP Share destinations; 4.10 (Mar 2025) with FCP 11.1. |

---

## 23. Final Cut Pro for iPad — differences

Versions: 1.0 (May 2023) → 2.0 (May 2024: **Live Multicam**, external project storage, new effects) → 2.1/2.2 (Enhance Light and Color, Image Playground, etc.) → **3.0 (Jan 2026 w/ Creator Studio subscription-only)**: Montage Maker, Auto Crop, Transcript Search, Visual Search, Beat Detection.

| Area | iPad behavior | vs Mac |
|---|---|---|
| Organization | **Projects** only with per-project media; no Libraries/Events/Keyword collections; browser of project media + Photos/Files sources. | Mac has full library DB. |
| Timeline | Magnetic timeline (primary storyline, connected clips, connected storylines) optimized for touch; **jog wheel** for scrubbing/frame-accurate navigation, moving clips/playhead, and trimming (spin to move frames; tap to place edit). | |
| Live Drawing | Apple Pencil draws/writes animated strokes directly on video (pens, markers, pencils) — playback reveals strokes over time; drawings become clips. | Not on Mac (drawings import as clips). |
| Pencil hover | Skim timeline/browser with Pencil hover (M2 iPad Pro+). | |
| Pro camera mode | Built-in camera capture with manual controls (exposure, focus, WB), ProRes recording. | |
| **Live Multicam** | Connect up to **4** iPhones/iPads running **Final Cut Camera** app; preview all feeds, control each remote camera's exposure/focus/WB/zoom, record simultaneously; footage transferred & auto-synced into a multicam clip. | Mac edits the resulting multicam after import. |
| Scene Removal Mask | Removes background behind subject without green screen (precursor to Magnetic Mask). | |
| Auto Crop / Montage Maker | 3.0 AI features. | |
| Effects | Subset of Mac effects, titles, transitions, Logic soundtracks (Live Loops-style generated soundtracks), Voice Isolation, Enhance Light and Color. | No 360, no Motion templates authoring (Motion is Mac-only), limited third-party plug-ins, no Compressor. |
| Keyboard | Magic Keyboard shortcuts mostly mirror Mac. | |
| Interop | iPad projects export to Mac FCP (File > Import > Final Cut Pro for iPad Project); one-way. 12.4 fixed crash importing iPad projects. | |
| Storage | Projects on internal or external drives (2.0+). | |
| Licensing | Subscription (now via Creator Studio). | Mac: purchase or subscription. |

---

## 24. Essential keyboard shortcuts

### 24.1 Application, windows, workspaces

| Action | Shortcut |
|---|---|
| Settings | Cmd-, |
| Command Editor (customize keys) | Opt-Cmd-K |
| Import Media | Cmd-I |
| New Project | Cmd-N |
| New Event | Opt-N |
| Keyword Editor | Cmd-K |
| Background Tasks | Cmd-9 |
| Undo / Redo | Cmd-Z / Shift-Cmd-Z |
| Libraries sidebar | Cmd-` |
| Photos and Audio sidebar | Shift-Cmd-1 |
| Titles and Generators sidebar | Opt-Cmd-1 |
| Go to Browser / Timeline / Viewer (focus) | Cmd-1 / Cmd-2 / Cmd-3 |
| Show/hide Browser | Ctrl-Cmd-1 |
| Show/hide Timeline | Ctrl-Cmd-2 |
| Event Viewer | Ctrl-Cmd-3 |
| Inspector | Cmd-4 |
| Effects Browser | Cmd-5 |
| Transitions Browser | Ctrl-Cmd-5 |
| Color Inspector | Cmd-6 |
| Comparison Viewer | Ctrl-Cmd-6 |
| Video Scopes | Cmd-7 |
| Angle Viewer | Shift-Cmd-7 |
| Audio Enhancements | Cmd-8 |
| Audio Meters | Shift-Cmd-8 |
| Timeline Index | Shift-Cmd-2 |
| Default workspace | Cmd-0 |
| Organize / Color & Effects workspaces | Ctrl-Shift-1 / Ctrl-Shift-2 *(verify)* |
| Full-screen viewer | Shift-Cmd-F |
| A/V Output toggle | Cmd-F12 |
| Record Voiceover | Opt-Shift-Cmd-8 |
| Toggle Browser filmstrip/list | Opt-Cmd-2 |
| Filter / Find | Cmd-F |
| Share to default destination | Cmd-E |

### 24.2 Playback & navigation

| Action | Shortcut |
|---|---|
| Play/Pause | Space |
| Play reverse | Shift-Space |
| J / K / L shuttle | J reverse (repeat for 2×,4×,8×…), K stop, L forward; K+J / K+L = slow-motion jog; **half-speed** (11.0 shortcut) |
| Play selection | / |
| Play around playhead (pre/post roll) | Shift-? |
| Play from playhead to end / from start | Opt-Space? / Shift-Ctrl-O? *(verify)* |
| Previous / next frame | Left / Right arrow |
| 10 frames back / forward | Shift-Left / Shift-Right |
| Previous / next edit | Up / Down arrow, or ; / ' |
| Go to start / end of project | Home / End (Fn-Left/Right) |
| Go to range start / end | Shift-I / Shift-O |
| Move playhead by timecode | Ctrl-P (then type) |
| Previous / next marker | Ctrl-; / Ctrl-' |
| Previous / next keyframe | Opt-; / Opt-' |
| Loop playback | Cmd-L |
| Skimming / Audio skimming / Clip skimming | S / Shift-S / Opt-Cmd-S |
| Snapping | N |
| Solo | Opt-S |
| Zoom timeline in / out / fit | Cmd-= / Cmd-− / Shift-Z |
| Zoom viewer to fit | Shift-Z (Viewer focused) |
| Back / forward in timeline history | Cmd-[ / Cmd-] |

### 24.3 Marking, rating, keywords

| Action | Shortcut |
|---|---|
| Set In / Out | I / O |
| Clear In / Out / Selection | Opt-I / Opt-O / Opt-X |
| Select clip range (mark clip) | X |
| Select clip under playhead | C |
| Favorite | F |
| Reject | Delete (Browser) |
| Unrate | U |
| Keyword shortcuts 1–9 / remove all | Ctrl-1…9 / Ctrl-0 |
| Show All / Hide Rejected / Favorites / Rejected / No ratings | Ctrl-C / Ctrl-H / Ctrl-F / Ctrl-Delete / Ctrl-X |
| Add marker / modify | M / Opt-M |
| Delete markers in selection | Ctrl-Shift-M |
| Add To-Do / Chapter marker | via marker window *(no default key)* |

### 24.4 Editing

| Action | Shortcut |
|---|---|
| Connect / Backtimed connect | Q / Shift-Q |
| Insert | W |
| Append | E |
| Overwrite / Backtimed overwrite | D / Shift-D |
| Replace / Replace from start | Shift-R / Opt-R |
| All / Video / Audio source mode | Shift-1 / Shift-2 / Shift-3 |
| Insert gap | Opt-W |
| Insert placeholder | Opt-Cmd-W |
| Blade at playhead / Blade all | Cmd-B / Shift-Cmd-B |
| Trim start / end to playhead | Opt-[ / Opt-] |
| Trim to selection | Opt-\ |
| Extend edit | Shift-X |
| Select left / right / both edges | [ / ] / \ |
| Nudge 1 frame / 10 frames | , . / Shift-, Shift-. |
| Change duration | Ctrl-D |
| Precision Editor | Ctrl-E |
| Delete (ripple) / Replace with gap | Delete / Shift-Delete |
| Copy / Cut / Paste / Paste as connected | Cmd-C / Cmd-X / Cmd-V / Opt-V |
| Paste effects / Paste attributes | Opt-Cmd-V / Shift-Cmd-V |
| Remove effects / attributes | Opt-Cmd-X / Shift-Cmd-X |
| Duplicate | Cmd-D |
| Enable/disable clip | V |
| Create storyline | Cmd-G |
| New compound clip | Opt-G |
| Break apart clip items | Shift-Cmd-G |
| Synchronize clips | Opt-Cmd-G |
| Create audition / Open audition | Cmd-Y / Y |
| Next / previous audition pick | Ctrl-Right / Ctrl-Left |
| Lift from storyline / Overwrite to primary | Opt-Cmd-Up / Opt-Cmd-Down |
| Expand audio / Expand audio components | Ctrl-S / Ctrl-Opt-S |
| Detach audio | Ctrl-Shift-S |
| Add default transition | Cmd-T |
| Basic title / lower third | Ctrl-T / Shift-Ctrl-T |
| Freeze frame | Opt-F |
| Reveal in Browser / Finder | Shift-F / Shift-Cmd-R |
| Select all / Deselect all | Cmd-A / Shift-Cmd-A |
| Tools: Select/Trim/Position/Range/Blade/Zoom/Hand | A / T / P / R / B / Z / H |
| Render selection / render all | Ctrl-R / Ctrl-Shift-R |
| Clip appearance presets | Ctrl-Opt-1 … Ctrl-Opt-6 |
| Increase / decrease clip height | Shift-Cmd-= / Shift-Cmd-− *(verify)* |
| Assign roles: Dialogue / Music / Effects / Video / Titles | Ctrl-Opt-D / Ctrl-Opt-M / Ctrl-Opt-E / Ctrl-Opt-V / Ctrl-Opt-T |

### 24.5 Effects, color, audio, retime, multicam

| Action | Shortcut |
|---|---|
| Transform / Crop / Distort onscreen | Shift-T / Shift-C / Opt-D |
| Video animation / Audio animation | Ctrl-V / Ctrl-A |
| Add keyframe (animation editor) | Opt-K |
| Balance color | Opt-Cmd-B |
| Match color | Opt-Cmd-M |
| Add Color Board | Opt-E *(verify)* |
| Color Board panes Color / Saturation / Exposure | Ctrl-Cmd-C / Ctrl-Cmd-S / Ctrl-Cmd-E |
| Volume up / down 1 dB | Ctrl-= / Ctrl-− |
| Auto enhance audio | Opt-Cmd-A |
| Match audio | Shift-Cmd-M |
| Retime editor | Cmd-R |
| Normal speed / Hold / Blade speed | Shift-N / Shift-H / Shift-B |
| Custom speed | Ctrl-Opt-R |
| Reset speed | Opt-Cmd-R |
| Multicam cut & switch angle 1–9 | 1 … 9 |
| Video-only / audio-only switch | Opt-1…9 / Shift-Opt-1…9 *(verify)* |
| Add caption / Caption editor | Opt-C / Ctrl-Shift-C |

---

## 25. Design takeaways for editcut

| FCP concept | Why it matters / implementation idea |
|---|---|
| Magnetic primary storyline + connection points | Trackless model: timeline = ordered list of primary items, each with child connected items anchored at an offset; ripple is default; "Position tool" offers track-style override. |
| Range-based metadata | Keywords, ratings, markers, transcripts all attached to *source* ranges, not whole clips → enables search-driven editing (Transcript/Visual Search). |
| Roles instead of tracks | Organize/mix/export by semantic tag; audio lanes are a *view* of roles. Stem export falls out naturally. |
| Non-destructive parents | Compound/multicam parents live in Browser; timeline instances reference them. |
| Background tasks | All heavy work (transcode, analysis, render, share) is queued and cancellable; UI never blocks. |
| Proxy switching at view level | Media resolution choice is a playback setting, not a project setting. |
| Inspector-driven parameters with uniform keyframe/reset affordances | Same widget grammar for every effect; effects stack order = render order; masks attachable to any effect. |
| Enhancement one-clicks | Balance color / Auto audio / Enhance light & color / Voice isolation — ML features exposed as a single checkbox + Amount slider. |
| Two-up trim feedback and Precision Editor | Visual feedback of in/out frames during trims is critical for perceived precision. |
| Interchange | FCPXML (versioned schema 1.0–1.14) is the canonical exchange format; editcut could import/export FCPXML for compatibility. |

*End of reference.*
