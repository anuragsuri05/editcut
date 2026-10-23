# Adobe Premiere Pro / Adobe Premiere (desktop) — Part 1: Interface, Panels, Menus & Editing Concepts

> Knowledge-base reference for the **editcut** project. Goal: document precisely what each Premiere control **does** and **how it behaves**, so behaviors can be studied, matched, or deliberately diverged from.
>
> Scope: Premiere Pro 2025 (v25.x, the "redesign" generation starting October 2024) through **Adobe Premiere 26.5.x** (September/October 2026). Earlier behavior (v22–v24) is noted where it still matters or where the redesign changed it.
>
> Sources: Adobe Premiere user guide (helpx.adobe.com), Adobe release notes / "What's new" pages, Adobe Community announcements, Larry Jordan, Newsshooter, Puget Systems, ProVideo Coalition, plus long-standing documented behavior of the application. Where a detail is from memory of established behavior rather than a 2026 source it is still stated plainly; where a detail is uncertain or version-dependent it is flagged with **(verify)**.
>
> Conventions: shortcuts are given as **Win / Mac**. `Ctrl` = `Cmd` on Mac, `Alt` = `Opt` on Mac unless noted. "Default keyboard layout" = the "Adobe Premiere Pro Default" shortcut set.

---

## Table of contents

- [0. Product & version timeline (2024–2026)](#0-product--version-timeline-20242026)
- [1. Workspaces](#1-workspaces)
- [2. Panel system: frames, docking, grouping, floating](#2-panel-system-frames-docking-grouping-floating)
- [3. Project panel](#3-project-panel)
- [4. Source Monitor](#4-source-monitor)
- [5. Program Monitor](#5-program-monitor)
- [6. Reference Monitor](#6-reference-monitor)
- [7. Timeline panel](#7-timeline-panel)
- [8. Tools panel (every tool)](#8-tools-panel-every-tool)
- [9. Effect Controls panel](#9-effect-controls-panel)
- [10. Properties panel (25.0+)](#10-properties-panel-250)
- [11. Essential Graphics / Graphics Templates](#11-essential-graphics--graphics-templates)
- [12. Lumetri Color & Lumetri Scopes; Color Mode (beta)](#12-lumetri-color--lumetri-scopes-color-mode-beta)
- [13. Essential Sound panel](#13-essential-sound-panel)
- [14. Audio Track Mixer](#14-audio-track-mixer)
- [15. Audio Clip Mixer](#15-audio-clip-mixer)
- [16. Audio Meters](#16-audio-meters)
- [17. Effects panel](#17-effects-panel)
- [18. Media Browser](#18-media-browser)
- [19. Libraries panel](#19-libraries-panel)
- [20. Markers panel](#20-markers-panel)
- [21. History panel](#21-history-panel)
- [22. Info panel](#22-info-panel)
- [23. Metadata panel](#23-metadata-panel)
- [24. Events panel](#24-events-panel)
- [25. Text panel (Transcript / Captions / Graphics) & Paper Edit](#25-text-panel-transcript--captions--graphics--paper-edit)
- [26. Search panel (Media Intelligence)](#26-search-panel-media-intelligence)
- [27. Sequence Index panel (26.2+)](#27-sequence-index-panel-262)
- [28. Productions panel](#28-productions-panel)
- [29. Frame.io panel, Adobe Stock panel, Firefly Boards](#29-frameio-panel-adobe-stock-panel-firefly-boards)
- [30. Legacy Title, Capture, Workspaces panel, Progress, Review/Comments, Timecode, Tools-adjacent minor panels](#30-legacy-title-capture-and-other-minor-panels)
- [31. Top menus: File](#31-file-menu)
- [32. Edit menu](#32-edit-menu)
- [33. Clip menu](#33-clip-menu)
- [34. Sequence menu](#34-sequence-menu)
- [35. Markers menu](#35-markers-menu)
- [36. Graphics and Titles menu](#36-graphics-and-titles-menu)
- [37. View menu](#37-view-menu)
- [38. Window menu](#38-window-menu)
- [39. Help menu (and Premiere Pro/app menu on Mac)](#39-help-menu-and-app-menu)
- [40. Editing concepts (sequences, 3/4-point editing, trimming, nesting, multicam, proxies, rendering, synthetics, speed, project management, collaboration)](#40-editing-concepts)
- [41. Default keyboard shortcut reference](#41-default-keyboard-shortcut-reference)
- [42. Behavior notes & implementation hints for editcut](#42-behavior-notes--implementation-hints-for-editcut)

---

## 0. Product & version timeline (2024–2026)

Adobe moved to a calendar-year major version scheme: **v24 = 2024**, **v25 = 2025** (shipped Oct 2024 at Adobe MAX), **v26 = 2026** (shipped Jan 2026). In **v25.6 (Oct 2025)** Adobe **dropped "Pro"** — the desktop app is now branded **"Adobe Premiere"** (alongside "Premiere on iPhone"). Help URLs moved from `/premiere-pro/` to `/premiere/desktop/`. Menus and behavior described below are otherwise continuous with Premiere Pro.

| Version | Date | Headline changes (UI/editing relevant) |
|---|---|---|
| **25.0** | Oct 2024 | **Visual redesign** (Spectrum-based UI, new typography, rounded controls, two dark themes + light + high-contrast theme; new default label colors — editors complained they were low-contrast; a "Classic" label color set can be restored in Preferences). **Properties panel** (context-aware, multi-clip editing). **New color management** system (input/output color spaces, tone mapping, wide-gamut working space). Essential Graphics' "Edit" functionality folded into Properties (template browsing remained in a separate panel). New "Edit"/"Vertical" workspaces, faster ProRes export, Generative Extend previewed in beta. |
| 25.1 | Dec 2024 | Rounded clip corners on timeline, UI refinements, performance. |
| **25.2** | Apr 2025 | **Generative Extend** (Firefly) GA — extend a clip head/tail by up to ~2 s video (audio up to ~10 s) with Firefly, 4K support. **Media Intelligence / Search panel** (natural-language search of visuals, spoken words, metadata; processed on-device). **Caption Translation** (27+ languages). Color management overhaul finalized; **dynamic audio waveforms** that redraw as gain changes. |
| 25.3 | Jun 2025 | Maintenance/format support **(verify specifics)**. |
| **25.4** | Aug 2025 | **Multi-transitions** (apply/manage transitions on many edit points at once), **live waveform during drag/trim**, Graphics preferences for default fonts (text, subtitles, closed captions), CEA-708 wide import fix. |
| **25.5** | Sep 2025 | **90+ new GPU-accelerated effects & transitions** (Film Impact library integrated into Premiere), Effect Controls improvements. |
| **25.6** | Oct 2025 | **Renamed "Adobe Premiere"**. AI search extended to **sound search** ("find the sound of a door slamming"). **Bulk bleep / mute** of words across the timeline from the transcript. **Adobe Stock panel** (search, license, import). New native **Frame.io panel** (Frame.io V4). Send media from **Firefly** web / **Firefly Boards** (File menu). Open projects from **Premiere on iPhone**. Nikon N-RAW. Minimum OpenCL 2.0. 25.6.x became an LTS line (25.6.6 in Jun 2026). |
| **26.0** | Jan 2026 | **Object Mask** (AI: click a person/object → mask + track). **Redesigned shape masks** (Rectangle/Ellipse/Pen with Bézier handles, new on-screen controls). **On-clip transition handles** (adjust transition duration/alignment directly in timeline). **Interactive audio fades** (fade handles on clips). Easier relinking, naming/organization improvements, GPU-accelerated thumbnail generation. **OpenTimelineIO (OTIO)** import/export. Native **Windows on ARM**. Frame.io V4 integration, Stock in-app import. Nikon R3D NE. |
| 26.0.1 / 26.0.2 | Feb / Mar 2026 | Fix releases. |
| **26.2** | Apr 2026 | **Sequence Index panel** (spreadsheet-like searchable list of everything in a sequence, filterable). **Global Mute** (Program Monitor button that mutes all sequence audio without touching track/clip state). **Marker search** by name/comment/color. Source Monitor shows **audio waveforms during video playback**. Improved **offline media relinking** (path tracking across drives/platforms). **Content Credentials** in Export settings. Object Mask **Sharp/Smooth** edge modes. Film Impact Channel Blur, Gradient, Noise effects; 3D Spinback, Slide transitions. **Color Mode** enters **public beta** (NAB 2026). |
| **26.3** | Jun 2026 | Firefly Boards → **import as a ready-to-edit sequence**. **Single-word captions** (one word at a time, social style). **Shape Dissolve** transition. **Magnify** effect. Faster Object Mask tracking + mask restore across systems. Faster workspace switching. **Preference: automatic track creation** when editing into a sequence. Faster Production upgrades. Adobe Stock **preview-then-license** (cart icon on unlicensed previews in Project panel; licensed assets replace previews). Search panel thumbnail-size slider. GPU/OS minimum alerts (Windows 10 being phased out; Win 11 24H2+). |
| **26.5** | Sep 2026 | **Generative Media Tool** (generate video clips and sound effects from prompts, Firefly or partner models, directly into the timeline as editable clips). **Paper Edit** (select transcript sentences in the Text panel → preview → build a new sequence). Generative Extend expanded (360p–4K UHD, any aspect ratio, interlaced, non-square pixels). Match Source now matches **audio channels and sample rate** with downmix/warnings. Object Mask Sharpness slider and more detected objects. Lens Flare, Twirl, Mosaic updates. Sony FX5 (XAVC/XOCN, 32-bit float audio), ARRI ALEXA 35 Xtreme (ARRICORE), ProRes RAW improvements, NVIDIA Blackwell 4:2:2 decode. |
| 26.5.1 / 26.5.2 | Sep–Oct 2026 | Fixes (generation-credit transparency, Effect Controls arrow-key value bug, NAS saving for shared Productions). |

**Theme / appearance (25.0+)**: Preferences > Appearance: *Darkest*, *Dark*, *Light*, plus a *High Contrast* mode; brightness slider of the pre-25 UI replaced by theme choice; "Label colors" set selectable (new default vs Classic). Interactive control highlight and focus-indicator colors follow the theme.

---

## 1. Workspaces

A **workspace** is a saved arrangement of panels (which panels are open, their frame layout, sizes, grouping, and floating windows). Workspaces are switched from:

- **Window > Workspaces > [name]**
- The **Workspaces menu** button in the header bar (top-right; in 25.x a dropdown labelled with the current workspace name next to the "Quick Export" and full-screen buttons). Pre-25 versions showed a row of workspace tabs in the header, configurable with "Edit Workspaces".
- Shortcuts **Alt+Shift+1 … Alt+Shift+9** (Win) / **Opt+Shift+1 …** (Mac) for the first nine workspaces in the order set in *Edit Workspaces*.

### 1.1 Header bar (top of window, 22.0+ "new import/export" design)

| Element | What it does |
|---|---|
| **Home** (house icon) | Opens the Home screen (recent projects, New Project, Open Project, Open Premiere Rush/iPhone project, learn content). |
| **Import** / **Edit** / **Export** mode tabs | *Import mode* = full-screen media browser to pick media and create a sequence; *Edit mode* = the normal workspace UI; *Export mode* = the full-page export settings (destinations: Media File, YouTube, Vimeo, TikTok, X, Facebook, Behance, Frame.io etc.). Introduced 22.0. In 25.x the header still has these; some builds hide Import mode by default **(verify)**. |
| Project / Production name | Shows current project title (centered). |
| **Workspaces** dropdown | Switch, reset, save workspaces. |
| **Quick Export** (up-arrow-box icon) | Exports active sequence with a chosen preset (Match Source – Adaptive High/Medium/Low bitrate, H.264, etc.) without opening Export mode. |
| **Full Screen Video** (diagonal arrows) | Maximizes the program video to full screen. |
| **Progress** dashboard | Shows background tasks (render, auto-transcription, proxy, media intelligence indexing). |
| Share / Collaborate | (Team Projects/Frame.io review shortcuts, depending on version). |

### 1.2 Built-in workspaces

Names and composition as of 25.x/26.x (Adobe has renamed/merged some over time). All of these are just panel layouts; any panel can be opened in any workspace.

| Workspace | Purpose & main panels |
|---|---|
| **Learning** | Large Learn panel (in-app tutorials) + Project, Program, Timeline. Learn panel removed/deprecated in later 24/25 builds in favor of Home "Learn" content **(verify)**. |
| **Assembly** | Big Project panel (often icon/freeform view) + Source Monitor for logging/selecting; Program and Timeline smaller. For organizing and rough cut. |
| **Editing** | The default general-purpose layout: Project/Media Browser/Libraries/Info/Effects/Markers/History group bottom-left, Source + Program top, Timeline bottom-right, Tools + Audio Meters thin columns. (In 25.0 Adobe added a new default **"Edit"** layout that includes the **Properties** panel; legacy "Editing" kept.) |
| **Edit (25.0+)** / **Vertical** | 25.0 introduced streamlined layouts; *Vertical* is designed for 9:16 social edits (tall Program Monitor). **(verify exact names per build)** |
| **Color** | Lumetri Color panel right, Lumetri Scopes left/top, Program Monitor, Timeline; Source monitor often replaced by Scopes. |
| **Effects** | Effects panel + Effect Controls prominent, Program Monitor, Timeline. |
| **Audio** | Essential Sound panel, Audio Track Mixer (in Source frame), Audio Clip Mixer, Audio Meters, Effect Controls. |
| **Graphics** (renamed **Captions and Graphics** in 22.x) | Text panel (Transcript/Captions/Graphics tabs), Essential Graphics (Browse/Edit) → in 25.x Properties + Graphics Templates, Program Monitor. |
| **Libraries** | Creative Cloud Libraries panel enlarged for browsing Stock/library assets. |
| **Metalogging** | Project panel in list view with many metadata columns + Metadata panel for logging. |
| **Production** | Productions panel + Project panel for multi-project Productions workflows. |
| **Review** | Review/Comments panel (Frame.io) + Program monitor. (Added with Frame.io integration, 23.x+.) |
| **All Panels** | Opens essentially every panel stacked in groups — useful for discovering panels. |
| **Captions** (older) | Pre-22 workspace for the old captions workflow. |
| **Color (Legacy) / Editing (CS5.5) / Audio (Legacy)** | Legacy layouts for long-time users, appear in some versions. |

### 1.3 Workspace commands

| Command | Behavior |
|---|---|
| **Window > Workspaces > Reset to Saved Layout** (Alt+Shift+0 / Opt+Shift+0) | Restores current workspace to its last saved arrangement. Panel layout changes are otherwise **auto-kept** in the current workspace (the workspace "remembers" modifications until reset). |
| **Save Changes to this Workspace** | Overwrites the saved layout with the current arrangement. |
| **Save as New Workspace…** | Prompts for a name; adds to list. |
| **Edit Workspaces…** | Dialog with list split into *Bar* (shown in header/dropdown top part), *Overflow Menu*, and *Do Not Show*. Drag to reorder (order = shortcut numbering). Delete custom workspaces. |
| **Import Workspace from Projects** (toggle) | When on, opening a project also loads the workspace saved inside that project. |
| **Show Workspace Tabs / Show Workspaces menu** | (Version-dependent) tabs vs dropdown. |

Workspace files are XML stored in the user profile (`Documents/Adobe/Premiere Pro/<ver>/Profile-<user>/Layouts`). Each custom workspace stores the panel tree (frames, sizes, groups, panel IDs, floating windows with screen positions).

---

## 2. Panel system: frames, docking, grouping, floating

Premiere's UI is a single application window composed of **frames** (rectangular regions) containing **panel groups** (tab stacks). Every panel lives in a group; a group shows one panel at a time via tabs.

### 2.1 Docking behaviors

Drag a panel by its **tab** (or a group by its **grip** — the dotted area at left of tab row in older versions). While dragging, **drop zones** highlight:

| Drop zone | Result |
|---|---|
| **Center** of a group (or its tab bar) | **Grouping**: panel becomes another tab in that group. |
| **Top / bottom / left / right edge** of a group (trapezoid highlight) | **Docking**: the target frame splits; the panel gets its own new frame adjacent to the target. |
| Outside the app window / Ctrl-drag (Win) / Cmd-drag (Mac) | **Floating** window (Undock Panel). |

- **Resize**: drag the divider (gutter) between frames; cursor changes to a double arrow. Dragging at the intersection of dividers resizes in two dimensions.
- **Maximize a panel**: hover and press **`** (grave/backtick) — toggles the panel under the cursor to fill the application frame. **Shift+`** maximizes to full screen (no app chrome) on Win. Also *Panel menu > Maximize Panel*. Double-click a tab also maximizes (preference-dependent).
- **Panel menu** (hamburger ≡ icon on each tab): Close Panel, Undock Panel, Close Other Panels in Group, Panel Group Settings (*Close Panel Group, Undock Panel Group, Maximize Panel Group, Stacked Panel Group, Solo Panels in Stack, Small Tabs*), plus panel-specific items.
- **Stacked panel groups**: panels in a group shown vertically as collapsible headers instead of tabs (accordion). *Solo Panels in Stack* opens only one at a time.
- **Tabs overflow**: when too many tabs, a **»** chevron menu lists hidden panels.
- **Active panel**: has a blue (theme accent) outline; keyboard shortcuts are panel-context sensitive (e.g. **J/K/L** apply to the focused monitor; **Shift+1…9** focus panels: Shift+1 Project, Shift+2 Source Monitor, Shift+3 Timeline, Shift+4 Program Monitor, Shift+5 Effect Controls, Shift+6 Audio Track Mixer, Shift+7 Effects, Shift+8 Media Browser, Shift+9 Audio Clip Mixer).
- **Multiple instances**: Some panels can have multiple instances (Timeline panels — one per open sequence, either tabbed or docked side-by-side; Project panel — each bin can open in its own panel; Lumetri Scopes in later versions only one; Source Monitor one, but with a clip dropdown).
- **Lock panels in place** (Window > Workspaces > Lock workspace, 2021+) prevents accidental rearrangement.

### 2.2 Panel focus and shortcut scoping

Many shortcuts are **panel-specific** (defined per-panel in Keyboard Shortcuts dialog's "Panels" filter: Project panel, Timeline panel, Program Monitor, Source Monitor, Trim Monitor, Multi-Camera Monitor, Audio Track Mixer, Effect Controls, Essential Graphics, Captions, Text, etc.). An application-level shortcut runs regardless of focus unless a panel shortcut overrides it.

---

## 3. Project panel

The **Project panel** is the media library of a project (`.prproj`). It contains **project items**: clips (master clips), subclips, sequences, multicam source sequences, bins, search bins, synthetic items (Bars and Tone, Black Video, Color Matte, Transparent Video, Universal Counting Leader, Adjustment Layer, HD Bars and Tone), graphics, captions items, offline files, nested sequences, merged clips.

### 3.1 Layout

| Area | Contents |
|---|---|
| **Tab** | "Project: <ProjectName>" (each opened bin panel shows "Bin: <name>"). |
| **Preview area** (optional; Panel menu > Preview Area) | Thumbnail poster frame player with scrub bar, info (type, dimensions, frame rate, duration, usage count), and a *Set Poster Frame* button. |
| **Breadcrumb / Path** | Shows current bin path when navigating into a bin in the same panel. |
| **Search field** | Filters visible items by text (match against Name, Label, Media Type, any visible column — and *Find* settings). Magnifier dropdown chooses searching *All*, *Visible Metadata*, *Transcript* (in versions with transcripts). In 25.2+ the "Search" panel with Media Intelligence is separate (see §26). |
| **Filter icons** | Filter by bin content / unused (version-dependent "Filter bin content"). |
| **Create New Search Bin** (folder-with-magnifier icon) | Creates a **Search Bin** from the current search text — a dynamic bin that always shows items matching its query. |
| **Items list** | List / Icon / Freeform view (see below). |
| **Bottom bar** | Read-only toggle (lock icon — project/bin locked for Team Projects/Productions), **List View**, **Icon View**, **Freeform View** buttons, **zoom slider** (thumbnail/icon size), **Sort Icons** menu (icon view), **Automate to Sequence**, **Find** (magnifier, opens Find dialog), **New Bin**, **New Item** (dropdown: Sequence, Shared Project, Offline File, Adjustment Layer, Bars and Tone, Black Video, Color Matte, HD Bars and Tone, Universal Counting Leader, Transparent Video, Captions/Legacy items), **Clear** (trash: delete selected items). |

### 3.2 Views

| View | Description & behavior |
|---|---|
| **List View** (Ctrl+Page Up) | Rows with metadata columns; disclosure triangles expand bins inline. Sort by clicking column header (toggle asc/desc). Columns resizable/reorderable by drag. Thumbnails optionally shown (Panel menu > Thumbnails). Label color chip column. |
| **Icon View** (Ctrl+Page Down) | Grid of thumbnails (Hover Scrub: moving mouse across a thumbnail scrubs the clip; click thumbnail then J/K/L to play inside the thumbnail; a mini scrub bar appears when selected). Shows name, duration, badges (usage count, has-audio, offline). Order can be user-arranged (drag) and the order is used by *Automate to Sequence* "Sort Order". *Sort Icons* menu: User Order, Name, Label, Media Type, Frame Rate, Media Duration, etc. |
| **Freeform View** (introduced 14.x / 2020) | Canvas where clips can be placed freely (storyboard style), resized, stacked in groups; "Arrange", "Align to Grid", "Reset to Grid", "Save View", "Load View" from the Panel menu; clip size small/medium/large; show names/labels/durations toggles. Layout saved per bin. Used to storyboard and build sequences by selecting clips in visual order. |

### 3.3 Bins

- **New Bin**: Ctrl+B / Cmd+B (Project panel focused) or bottom-bar folder icon. Dropping items onto the New Bin button creates a bin containing them ("New Bin from Selection").
- Bins open in place (double-click), in a new tab, or floating, according to **Preferences > General > Bins**: separate behaviors for *Double-click*, *+Ctrl*, *+Alt*: "Open in new window", "Open in place", "Open new tab".
- Bins can nest arbitrarily deep.
- Deleting a bin deletes contents from project (not disk) — confirm if items are used in sequences.
- **Search bins**: dynamic, created from a query (Name, Label, Comments, Log Note, Description, Scene, Shot, Transcript, "All metadata" etc.). Contents update automatically. Can be renamed/edited (Edit Search Bin).
- **Team project / Production lock** indicators per bin.
- **Label colors**: right-click > Label > (Violet, Iris, Caribbean, Lavender, Cerulean, Forest, Rose, Mango, Purple, Blue, Teal, Magenta, Tan, Green, Brown, Yellow — 16 labels; renamable in Preferences > Labels). "Select Label Group" selects all items sharing the label. Defaults assigned by type in Preferences > Labels (Video, Audio, Bin, Sequence, Movie, Still, Multicam, Adjustment Layer, Caption, Nested Sequence…). 25.0 changed default palette; Classic palette restorable.

### 3.4 Metadata display (List View columns)

Panel menu > **Metadata Display…** opens a dialog listing schemas (Premiere Pro Project Metadata, Dublin Core, Basic, Rights Management, Dynamic Media, EXIF, IPTC, …) with checkboxes. You can also create **custom properties** (name, type: Integer, Real, Text, Boolean) in a custom schema set. Common **Premiere Pro Project Metadata** columns:

| Column | Meaning |
|---|---|
| Name | Project item name (rename does not rename file on disk). |
| Label | Color label. |
| Frame Rate | Interpreted fps. |
| Media Start / Media End / Media Duration | Timecode of source media. |
| Video In Point / Video Out Point / Video Duration | Current In/Out marks on the master clip (editable in-cell). |
| Audio In / Out / Duration | Same for audio. |
| Video Info / Audio Info | Frame size, PAR; channels, sample rate, bit depth. |
| Video Usage / Audio Usage | Number of times used in sequences; disclosure lists sequences & timecodes. |
| Tape Name, Description, Comment, Log Note, Scene, Shot, Client, Good (checkbox), Capture Settings, Status, Offline Properties | Logging fields. |
| File Path, Media Type, Capture Settings | File info. |
| Subclip Start/End | For subclips. |
| Proxy | Attached / Not attached. |
| Captions | Has captions. |
| Color Space / Color Space Override (25.x) | Detected input color space & override. |
| Transcript (Text-Based Editing) | Transcript status. |

Click a cell to edit (In/Out timecode editable by typing or scrubbing). Column order persists per bin/view.

### 3.5 Project panel context menu (right-click on items) — main entries

Cut / Copy / Paste / Clear; Duplicate; Rename; New Bin from Selection; New Sequence From Clip; Replace Footage…; Link Media… / Make Offline… / Edit Offline…; Proxy > (Create Proxies…, Attach Proxies…, Reconnect Full Resolution Media…); Speed/Duration…; Audio Gain…; Disable Masterclip Effects; Label >; Make Subclip / Edit Subclip…; Open in Source Monitor; Open in Timeline (for sequences); Set to Poster Frame / Clear Poster Frame; Edit Original (Ctrl+E — opens source in its native app); Edit in Adobe Audition / Photoshop; Export Media…; Align to Grid / Reset to Grid (freeform); Modify > (Audio Channels…, Interpret Footage…, Timecode…); Properties (file info, data rate graph); Reveal in Finder/Explorer; Reveal in Adobe Bridge; Create Multi-Camera Source Sequence…; Merge Clips…; Create Transcription (or "Transcribe" in Text panel); Scene Edit Detection (as of 22.x on sequence clips only); Sequence Settings (on sequences); Override color space (25.x: Modify > Color Space / "Color" section in Interpret Footage); Hide/Unhide (Team Projects).

### 3.6 Import into the project

- **File > Import** (Ctrl+I), drag from OS / Media Browser, double-click empty Project panel area (opens Import dialog), Import mode (header), **Ingest** settings (copy/transcode/proxy on import — see §40.13).
- Importing a folder creates a bin with the folder's name (preserving structure).
- Image sequences: "Image Sequence" checkbox in Import dialog (numbered stills → one clip at the default still frame rate setting / Preferences > Timeline > Indeterminate Media Timebase).
- PSD import dialog: Merge All Layers, Merged Layers, Individual Layers, Sequence (creates a sequence with each layer on a track); Footage dimensions: Document Size / Layer Size.
- AE comps via Dynamic Link, Premiere projects (import sequences from another .prproj), XML (FCP7), EDL, AAF, OTIO (26.0+).

### 3.7 Automate to Sequence

Button at bottom of Project panel (or Clip > Automate to Sequence). Takes selected items (or whole bin) into the active sequence.

| Option | Choices / meaning |
|---|---|
| Ordering | **Sort Order** (order in bin view) or **Selection Order** (order clicked). |
| Placement | **Sequentially** or **At Unnumbered Markers** (each clip placed at next unnumbered sequence marker). |
| Method | **Insert Edit** or **Overwrite Edit**. |
| Clip Overlap | N frames/seconds — overlapping by transition length when default transitions applied. |
| Still Clip Duration | Use In/Out range, or N frames per still. |
| Apply Default Audio Transition / Apply Default Video Transition | Insert defaults between clips. |
| Ignore Audio / Ignore Video | Place only one type. |

Placement starts at the playhead in the active sequence on targeted tracks.

---

## 4. Source Monitor

The **Source Monitor** plays individual project items (master clips, subclips, sequences opened as source, multicam source sequences) for viewing, marking In/Out, and editing into the sequence.

### 4.1 Opening clips

- Double-click a clip in the Project panel, drag it into the monitor, or right-click and choose "Open in Source Monitor". Pressing **Enter** on a selected Project item also opens it. **Shift+2** focuses the Source Monitor.
- Double-click a clip in the timeline → loads the *timeline instance* into the Source Monitor (title shows "<Sequence>: <Clip> : <timecode>"); edits to In/Out then trim that timeline clip (you are editing the instance, not the master).
- **Source dropdown** (clip name in tab): lists recently loaded clips; *Close*, *Close All*.
- Sequences can be loaded into the Source Monitor (drag a sequence from the Project panel into it, or right-click > Open in Source Monitor) to edit portions of one sequence into another (by default editing a sequence from Source inserts it as a **nest** unless the Timeline's "Insert and overwrite sequences as nests or individual clips" toggle is off).

### 4.2 Display area

- **Overlays** (Settings > Overlays; Overlay Settings: timecode, clip name, markers, edit point indicator, Source/Program in/out positions, opacity, text size, Safe Margins).
- **Time ruler / mini timeline** under the image: time ruler, **playhead** (blue), **In/Out marked range** (shaded), **markers** on ruler, **zoom scroll bar** (navigator bar under ruler — drag ends to zoom the ruler in time).
- **Current Time display** (left, blue timecode) — click to type timecode, scrub with drag. Typing `+30` moves 30 frames forward, `-1:00` back one second, etc.
- **Duration display** (right) — shows In-to-Out duration (or full clip if no marks).
- **Zoom level** dropdown (Fit, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 400%). Above Fit, scroll bars appear and you can pan with the Hand tool.
- **Playback Resolution** dropdown: Full, 1/2, 1/4, 1/8, 1/16 (available options depend on media/sequence; 1/16 for very high-res).
- **Settings** (wrench icon) menu — see §5.5 (shared with Program Monitor).
- **Drag Video Only** (film icon) and **Drag Audio Only** (waveform icon) handles under the image: drag these to the timeline to edit only video or only audio. Hover shows "Drag Video Only"/"Drag Audio Only". In 23.x+ they appear when hovering the bottom of the monitor.
- **Audio waveform display** (Settings > Audio Waveform, or when clip has only audio). 26.2+: waveform shown during video playback as an overlay strip.

### 4.3 Source Monitor button bar (default buttons)

| Button | Shortcut | Behavior |
|---|---|---|
| **Add Marker** | M | Adds a clip marker at playhead on the master clip (persists to every future instance edited afterward). Press M twice to open Marker dialog. |
| **Mark In** | I | Sets source In at playhead. |
| **Mark Out** | O | Sets source Out at playhead. |
| **Go to In** | Shift+I | Moves playhead to In. |
| **Step Back 1 Frame** | Left Arrow | Moves back one frame. Shift+Left moves 5 frames. |
| **Play-Stop Toggle** | Space | Plays/stops. |
| **Step Forward 1 Frame** | Right Arrow | One frame forward. |
| **Go to Out** | Shift+O | Moves playhead to Out. |
| **Insert** | , (comma) | Insert edit marked source into sequence at sequence In (or playhead) on patched/targeted tracks, rippling later material. |
| **Overwrite** | . (period) | Overwrite edit — replaces material in sequence, no ripple. |
| **Export Frame** | Ctrl+Shift+E | Saves current frame as still (dialog: name, format DPX/JPEG/PNG/TIFF/OpenEXR/GIF/Targa, path, *Import into project* checkbox). |

### 4.4 Source Monitor Button Editor (+ icon) extra buttons

Source Monitor's button editor (click **+** at the right of the bar) offers extra buttons. Drag them into the bar, drag them out to remove, and click "Reset Layout" to restore the defaults. The set differs slightly by build. The usual Source extras are:

| Extra button | Shortcut | Behavior |
|---|---|---|
| Clear In | Ctrl+Shift+I / Opt+I | Removes the In mark. |
| Clear Out | Ctrl+Shift+O / Opt+O | Removes the Out mark. |
| Go to Previous Marker | Ctrl+Shift+M / Cmd+Shift+M | Jumps to the previous clip marker. |
| Go to Next Marker | Shift+M | Jumps to the next clip marker. |
| Play In to Out | Ctrl+Shift+Space / Opt+K | Plays only the marked range. |
| Loop Playback | Ctrl+L | Toggles looping of Play / Play In to Out. |
| Play Around | Shift+K | Plays from preroll before the playhead to postroll after it, then returns to the start point. |
| Safe Margins | — | Toggles the action-safe and title-safe guides. |
| Shuttle Left / Shuttle Right | J / L | Reverse / forward shuttle. |
| Toggle Proxies | — | Switches between proxy and full-res playback (global). |
| Toggle Multi-Camera View | Shift+0 | For multicam source sequences. |
| Show/Hide Captions | — | Shows caption display. |
| Toggle VR Video Display | — | Equirectangular to viewer projection. |
| Output / Composite Video | — | Chooses which channel to view (Composite, Alpha, …). |
| Drop/Non-drop toggle | — | Not a button. Set it with Ctrl-click on the timecode. |

The Program-only buttons are Mark Clip, Go to Previous/Next Edit, Lift, Extract, Comparison View, Global FX Mute and Global Mute (26.2). They are not available in the Source Monitor's editor.

### 4.5 Source-specific behaviors

- **Source timecode** shown, not sequence time.
- **Gang Source and Program monitors** (Program/Source Settings menu "Gang to Program Monitor" / "Gang Source and Program"): moves playheads together.
- **Merged clips / multicam** show special views (Multi-Camera view in Source shows angles of a multicam source).
- **Master clip effects**: applying an effect in the Effect Controls when a clip is loaded in Source Monitor applies it to the master clip (red underline/badge "fx" on all instances). Clear via "Remove Effects" on master.
- **Timeline "Source Patcher"** reflects which source tracks the loaded clip has (V1, A1, A2…).
- Source Monitor can show the **Transcript** sync via Text panel (clicking transcript text moves Source playhead; selecting text sets In/Out — "Insert"/"Overwrite" buttons in Text panel's source transcript view).


---

## 5. Program Monitor

The **Program Monitor** plays the **active sequence**, which is the sequence whose Timeline tab was most recently focused. It is also the canvas for direct manipulation (Motion transforms, masks, text and shapes, crop, Object Mask), and it hosts the Trim Monitor, Multi-Camera view and Comparison View.

### 5.1 Display area

- **Sequence dropdown** in the tab lets you switch between open sequences or close one.
- **Current time** (left, sequence timecode). Click to type a time or drag to scrub. Relative entry works: `+30` moves 30 frames forward, `-1.00` moves back one second.
- **Duration** (right) shows the sequence In-to-Out duration when In/Out are set, otherwise the sequence length.
- **Zoom level**: Fit, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 400%. Above Fit, scroll bars appear and you can pan with the Hand tool (H) or by holding the middle mouse button.
- **Playback Resolution**: Full, 1/2, 1/4, 1/8, 1/16. The available options depend on the sequence frame size; 1/8 and 1/16 appear only for large frames. This setting applies while playing. A separate **Paused Resolution** setting (in the Settings menu) controls the quality of the still frame shown when stopped.
- **Mini time ruler** shows the playhead, sequence In/Out shading, sequence markers and a navigator zoom bar.
- **Direct manipulation**: select a clip in the timeline, then click "Motion" in Effect Controls or double-click the image. A bounding box appears with corner/edge handles for scale, an anchor-point crosshair, and a rotate cursor just outside the corners. Graphic layers, mask paths, Crop and Object Mask controls also draw on-screen handles here.
- **Overlays**: timecode, clip name, markers, Frame.io comments, safe margins, edit-point indicators, Source/Program In/Out, captions.
- **Safe Margins**: by default Action Safe is 10% and Title Safe is 20%. Both are adjustable in Overlay Settings, which can also add a 4:3 center-cut guide and custom margins.
- **Transparency Grid** (Settings menu) shows a checkerboard where the composite is transparent, instead of black.

### 5.2 Program Monitor button bar (default buttons, 25.x/26.x)

| Button | Shortcut (Win / Mac) | Behavior |
|---|---|---|
| **Add Marker** | M | With nothing selected in the timeline, adds a **sequence marker** at the playhead. With clips selected in the Timeline, adds a **clip marker** to the selected clip(s). Pressing M twice (or double-clicking a marker) opens the Marker dialog. |
| **Mark In** | I | Sets the sequence In point. |
| **Mark Out** | O | Sets the sequence Out point. |
| **Go to In** | Shift+I | Moves the playhead to In. |
| **Step Back 1 Frame** | Left | Shift+Left steps 5 frames. |
| **Play-Stop Toggle** | Space | |
| **Step Forward 1 Frame** | Right | Shift+Right steps 5 frames. |
| **Go to Out** | Shift+O | |
| **Lift** | ; | Removes the In-to-Out range on **targeted** tracks and **leaves a gap**. Does nothing if no In/Out is set. |
| **Extract** | ' | Removes the In-to-Out range on targeted tracks and **closes the gap**, rippling later material on all sync-locked tracks. |
| **Export Frame** | Ctrl+Shift+E / Shift+E | Saves the current composite frame as a still at sequence resolution. The dialog sets name, format (JPEG, PNG, TIFF, DPX, OpenEXR, GIF, Targa, BMP on Win), path, and an "Import into project" checkbox. |
| **Comparison View** | — | Splits the Program Monitor into a reference frame and the current frame (§5.4). |
| **Global Mute** (26.2+) | — | Audio icon. Mutes all sequence audio playback without changing track mute/solo or clip enable state. |

Insert and Overwrite are Source Monitor buttons, not Program Monitor buttons.

### 5.3 Program Monitor Button Editor (+): available buttons

| Button | Shortcut (Win / Mac) | Behavior |
|---|---|---|
| **Mark Clip** | X | Sets sequence In/Out to the boundaries of the clip under the playhead on the topmost targeted track that has a clip there. |
| **Mark Selection** | / | Sets In/Out around the total extent of the selected clips. |
| Clear In | Ctrl+Shift+I / Opt+I | |
| Clear Out | Ctrl+Shift+O / Opt+O | |
| **Clear In and Out** | Ctrl+Shift+X / Opt+X | |
| **Go to Previous Edit Point** | Up | Previous cut on **targeted** tracks. Shift+Up uses any track. |
| **Go to Next Edit Point** | Down | Next cut on targeted tracks. Shift+Down uses any track. |
| Go to Previous Marker | Ctrl+Shift+M / Cmd+Shift+M | |
| Go to Next Marker | Shift+M | |
| **Play In to Out** | Ctrl+Shift+Space / Opt+K | Plays the In-to-Out range, then stops. |
| **Play Around** | Shift+K | Plays from the preroll before the playhead to the postroll after it, then parks at the original position. Preroll/postroll durations are set in Preferences > Playback (default 2 s / 2 s). |
| **Loop Playback** | Ctrl+L | Loops Play or Play In to Out. |
| Shuttle Left / Shuttle Right | J / L | Each extra tap doubles speed (1×, 2×, 4×, 8×). K+J or K+L held plays at slow speed. Holding K and tapping J or L steps one frame. |
| **Lift** / **Extract** | ; / ' | |
| **Safe Margins** | — | Toggles guides. |
| **Export Frame** | Ctrl+Shift+E / Shift+E | |
| **Toggle Proxies** | — | Global switch: plays attached proxies instead of full-res media. Export uses full-res unless "Use Proxies" is ticked in Export settings. |
| **Toggle Multi-Camera View** | Shift+0 | Turns the Program Monitor into the multicam view. |
| **Multi-Camera Record On/Off** | 0 | Arms angle switching during playback. |
| **Toggle VR Video Display** | — | Viewer projection for equirectangular VR sequences. |
| **Global FX Mute** | — | Disables all video effects for playback only, to compare or improve performance. Export is unaffected. |
| **Show Rulers** / **Show Guides** / **Snap in Program Monitor** | (Guides: Ctrl+; / Cmd+;, Snap: Ctrl+Shift+; / Cmd+Shift+;) | Rulers along the monitor edges; drag from a ruler to create a guide. Snap makes graphics snap to guides, frame edges and center. Guide templates can be saved/loaded from View > Guide Templates. |
| **Lock Guides** | — | |
| **Show Captions Display** | — | Caption overlay toggle. |
| **Transmit On/Off** | — | Mercury Transmit output to an external monitor or I/O device (Preferences > Playback). |
| **Comparison View** | — | |
| **Global Mute** (26.2+) | — | |

The exact list varies by build; the Button Editor itself is the authority. Each monitor (Source, Program, Trim) has its own button layout, saved with the workspace.

### 5.4 Comparison View

Open it with the two-rectangle button or Settings > Comparison View. The Program Monitor shows a **Reference** image and the **Current** image.

| Control | Behavior |
|---|---|
| **Shot / Frame comparison** toggle | *Shot comparison*: the reference is a frame from another point in the sequence. Choose it with the separate reference playhead on the mini ruler, or with the previous/next-edit arrows under the reference image. *Frame comparison*: compares the current frame with itself before and after effects (useful while grading). |
| **Side by Side** | The two images sit next to each other. |
| **Vertical Split** / **Horizontal Split** | One image with a draggable divider; each side shows one version. |
| **Swap Sides** | Swaps reference and current. |
| Reference timecode | Shows/sets the reference position. |
| **Done** | Exits Comparison View. |

Lumetri **Color Match** ("Apply Match") uses the Comparison View reference frame as its target.

### 5.5 Settings (wrench) menu: Program and Source monitors

| Item | Behavior |
|---|---|
| **Composite Video** | Normal view. |
| **Alpha** | Shows the alpha channel as grayscale. |
| **All Scopes, Vectorscope, YC Waveform, RGB Parade, YUV Parade, and combined layouts** | Legacy scopes drawn inside the monitor. The Lumetri Scopes panel replaces these. |
| **Multi-Camera** | Multicam display (Program). |
| **Comparison View** | |
| **Display First Field / Second Field / Both Fields** | For interlaced material. |
| **Playback Resolution** submenu | Full, 1/2, 1/4, 1/8, 1/16. |
| **Paused Resolution** submenu | Same values, applied when stopped. |
| **High Quality Playback** | Disables the speed-oriented downsampling of stills and high-res frames during playback. Better image, heavier load. |
| **Show Captions Display** / **Captions Display Settings** | Caption overlay and its format/stream. |
| **Show Markers** | Marker overlays on the image. |
| **Show Dropped Frame Indicator** | A small light in the corner of the monitor. It is green while playback keeps up and turns yellow when frames drop; hover it to see the count. It resets on the next play. |
| **Time Ruler Numbers** | Numbers on the mini time ruler. |
| **Overlays** / **Overlay Settings…** | Master overlay toggle and options: which items show, during-playback visibility, opacity, text size, safe-margin values. |
| **Safe Margins** | |
| **Transparency Grid** | Checkerboard for transparent areas. |
| **Show Audio Time Units** | Displays time in audio samples instead of frames, for sub-frame audio work. |
| **Loop** | Loop playback. |
| **Gang Source and Program** | Moves the Source and Program playheads together. |
| **Show Transport Controls** | Shows or hides the button bar. |
| **Audio Waveform** (Source) | Shows the clip's waveform instead of the image. |
| **VR Video** > Enable / Settings | Projection settings for VR. |
| **Enable Transmit** | Turns on Mercury Transmit output. |
| **Display Color Management** | Uses the OS display profile so the image is accurate on calibrated, non-Rec.709 displays. Requires GPU acceleration. In 25.x it lives in Preferences > Color / Display. |

### 5.6 Drag-to-edit overlay on the Program Monitor

When you drag a clip from the Project panel or Source Monitor **onto the Program Monitor**, a translucent overlay offers drop zones:

| Zone | Edit performed |
|---|---|
| **Insert** | Inserts at the playhead on patched tracks, rippling later material. |
| **Overwrite** (center, largest) | Overwrites at the playhead. |
| **Overlay** | Places the clip on the first empty track above existing material at the playhead, without moving anything. |
| **Replace** | Replaces the clip under the playhead with the dragged clip, keeping the original clip's timeline duration and attributes. The source frame at the Source Monitor playhead is lined up with the sequence playhead (frame-accurate sync replace). |
| **Append** | Adds the clip at the end of the sequence. |

Related commands: Clip > Replace With Clip > From Source Monitor; From Source Monitor, Match Frame; From Bin. **Alt-drag (Win) / Opt-drag (Mac)** from the Project panel onto a timeline clip replaces the clip's media while keeping its effects, duration and position.

### 5.7 Trim Monitor (the Program Monitor in Trim mode)

You enter it by double-clicking an edit point with the Selection, Ripple or Rolling tool, or by selecting an edit and pressing **Shift+T** (Sequence > Trim Edit). The monitor splits into the **outgoing (A) clip on the left** and the **incoming (B) clip on the right**.

| Control | Behavior |
|---|---|
| Out Shift counter (left) / In Shift counter (right) | Frames trimmed on each side during this session. |
| **Trim Backward Many** | Trims by the Large Trim Offset (Preferences > Trim, default 5 frames). Shortcut Ctrl+Shift+Left / Opt+Shift+Left. |
| **Trim Backward** | One frame. Ctrl+Left / Opt+Left. |
| **Apply Default Transitions to Selection** | Ctrl+D / Cmd+D. |
| **Trim Forward** | Ctrl+Right / Opt+Right. |
| **Trim Forward Many** | Ctrl+Shift+Right / Opt+Shift+Right. |
| Play Edit | Space plays around the edit. |
| **Loop** | Loops playback around the edit, so you can trim while it repeats. |
| Dragging in the images | Dragging in the left image trims the A side's Out point; dragging in the right image trims the B side's In point; dragging between them rolls the edit. The cursor shows which trim will happen. |
| **Toggle Trim Type** | Ctrl+T on both platforms (Mac uses the Control key) **(verify)**. Cycles the selected edit through Regular trim, Ripple and Roll. |

Dynamic trimming: in Trim mode, J/K/L shuttles **apply the trim live** while playing. Press K to stop and commit (see §40.6).

### 5.8 Multi-Camera view

See §40.10. The Program Monitor shows the angle grid on the left and the program output on the right. Clicking an angle during playback records a cut to that angle.

---

## 6. Reference Monitor

**Window > Reference Monitor** opens a second program-type monitor that shows the active sequence at its own playhead.

- Panel menu: **Gang to Program Monitor** (playhead follows Program), plus Composite/Alpha/legacy scopes, zoom and playback resolution.
- It has a reduced transport: step, go to previous/next edit, play.
- Only one instance can be open. It is largely superseded by **Comparison View** and the Lumetri Scopes panel, but still ships.

---

## 7. Timeline panel

The Timeline shows one **sequence** per tab. Several sequences can be open as tabs, and dragging a tab into another frame gives side-by-side Timeline panels. The **active sequence** feeds the Program Monitor.

### 7.1 Anatomy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Sequence tab(s) ≡                                                              │
│ [00:00:12:05]  [Nest][Snap][Linked][Marker][Display settings][Captions]        │
│                                          │ time ruler / In-Out / render bar    │
│ src│ V3 │🔒│⇉│ 👁 │ Video 3              │ clips                               │
│ V1 │ V2 │🔒│⇉│ 👁 │                      │                                     │
│    │ V1 │🔒│⇉│ 👁 │                      │                                     │
│────┼────┼──┼─┼────┼──── V/A divider ──── │─────────────────────────────────────│
│ A1 │ A1 │🔒│⇉│ M S 🎙                    │                                     │
│ A2 │ A2 │🔒│⇉│ M S 🎙                    │                                     │
│    │ Mix                          0.0    │                                     │
│ C1 (caption track sits above V tracks)   │                                     │
│ ─────────── horizontal zoom/scroll bar ─────────────────────────────────────── │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Track headers** (left), **time ruler** (top), **playhead** (current-time indicator), **clip area**, **horizontal zoom/scroll bar** (bottom; drag its ends to zoom), and **separate vertical scroll bars** for the video area and the audio area.
- The **V/A divider** is draggable. Video tracks stack upward from it and audio tracks stack downward.
- The **Mix track** (master) sits below the audio tracks and shows master volume keyframes when expanded.
- **Caption tracks** (C1, C2, …) sit above the video tracks, one per caption stream (2021+).

### 7.2 Header controls above the track headers

| Control | Shortcut | Behavior |
|---|---|---|
| **Playhead Position** (blue timecode) | — | Current time. Type to jump, drag to scrub. Ctrl-click (Cmd-click) cycles the display format between timecode, frames and feet+frames. The default format is set in Sequence Settings > Display Format. |
| **Insert and overwrite sequences as nests or individual clips** | — | **On (default)**: editing a sequence from the Source Monitor or Project panel creates one **nested sequence clip**. **Off**: edits the source sequence's **individual clips**, with their cuts and effects. |
| **Snap in Timeline** (magnet) | S | Clip edges, playhead, markers, In/Out and keyframes attract each other during drags and trims. A snap shows a vertical line with arrow tips. S can be pressed in the middle of a drag to toggle snapping for that drag. |
| **Linked Selection** (chain) | — | **On**: clicking a linked clip also selects its linked partners (video + audio + captions). **Off**: selects only the clicked item; links stay intact. Alt/Opt-click overrides it for one click. Ctrl+L / Cmd+L is the separate Link/Unlink command. |
| **Add Marker** | M | Same as the Program Monitor button (sequence marker with no selection, clip marker on selected clips). |
| **Timeline Display Settings** (wrench) | — | §7.4. |
| **Caption track options** (CC icon) | — | Show/hide caption tracks and choose which caption track displays in the Program Monitor. |
| **Panel menu (≡ on the tab)** | — | Close, Undock, Work Area Bar, Show Audio Time Units, Rectified Audio Waveforms, Logarithmic Waveform Scaling, Time Ruler Numbers, Multi-Camera Audio Follows Video, Multi-Camera Selection Follows Playhead, and more. |

### 7.3 Time ruler area

- **Time ruler**: click or drag to move the playhead. Audio scrubbing is on by default (Preferences > Audio > "Play audio while scrubbing"; **Shift+S** toggles it).
- **Sequence In/Out**: a lighter shaded range with brackets on the ruler. Drag the In or Out handle to adjust it, or drag the middle to move the whole range.
- **Work Area bar**: hidden since CC 2015. Panel menu > Work Area Bar brings it back. It was the old render/export range; In/Out now does that job.
- **Render bar** (just under the ruler): green, yellow, red or nothing (see §40.12).
- **Sequence markers** sit on the ruler. Drag to move, double-click to edit, Alt/Opt-click to delete (or right-click > Clear Selected Marker).

### 7.4 Timeline Display Settings (wrench) menu

| Setting | Behavior |
|---|---|
| **Show Video Thumbnails** | Toggles thumbnails. The style (Video Head Thumbnail, Video Head and Tail Thumbnails, Continuous Video Thumbnails) is set in the same menu or on the video track header's right-click menu. |
| **Show Video Keyframes** | Shows the rubber band and keyframes on video clips. Opacity is the default property; the clip's fx badge menu chooses another. |
| **Show Video Names** | Clip names on video clips. |
| **Show Audio Waveforms** | |
| **Show Audio Keyframes** | Volume rubber band and keyframes on audio clips. |
| **Show Audio Names** | |
| **Show Clip Markers** | |
| **Show Duplicate Frame Markers** | A colored stripe along the clip's top edge when frames from the same source appear more than once in the sequence. The stripe color matches the clip label, and up to 10 colors are used. |
| **Show Through Edits** | Shows a "bowtie" icon on edit points where both sides are continuous in the source (typically a razor cut). Right-click > Join Through Edits merges them. |
| **Show Effect Badges** | The fx badge: gray = no effects; yellow = an intrinsic effect (Motion, Opacity, Time Remapping, Volume) was changed; purple = a non-intrinsic effect is applied; green = both; a red underline = master-clip effect. |
| **Minimize All Tracks / Expand All Tracks** | Track heights. |
| **Save Preset / Manage Presets** | Saves track-height layouts as presets that can be assigned shortcuts. |
| **Customize Video Header / Customize Audio Header** | Opens a Button Editor for track-header buttons (§7.6–7.7). |
| **Rectified Audio Waveforms** | Draws waveforms upward from the bottom edge instead of centered. |
| **Logarithmic Waveform Scaling** | Scales the waveform so quiet passages are visible. |
| **Dynamic waveforms** (25.2+) | Waveforms redraw in real time when clip gain or volume changes. |
| **A/V display mode** (26.x) | A layout option for showing audio and video tracks, reported in 26.x community notes **(verify)**. |

25.1 added **rounded clip corners** as a visual change. It is not a setting.

### 7.5 Track header: the left columns (source patching and targeting)

From left to right in each track row:

| Column | Description |
|---|---|
| **Source patch indicator** (leftmost; shows V1, A1, A2… only while a clip is loaded in the Source Monitor) | Each source channel of the loaded clip. Drag it, or click in the patch column of another track, to choose which sequence track **receives** that channel on Insert/Overwrite. Click it to toggle that source channel on or off. An off channel is not edited in. The patch layout is remembered per number of source channels. |
| **Track targeting** (the track name box, highlighted when targeted) | Targeting decides which tracks are affected by **Lift/Extract**, **Paste** (pastes to the lowest targeted track at the playhead), **Go to Previous/Next Edit**, **Match Frame**, **Add Edit** (Ctrl+K), **Mark Clip** (X), **Ripple Trim Previous/Next Edit to Playhead** (Q/W) and copy/paste of keyframes. Click to toggle. Commands like "Toggle Target V1" can be assigned shortcuts. Since CS6, **patching** (where source goes) and **targeting** (where commands act) are separate: Insert/Overwrite follow the source patching. |
| **Toggle Sync Lock** | **On (default)**: the track takes part in ripple operations. An insert, extract or ripple delete on another track **shifts this track's content too**, keeping sync. **Off**: the track is not shifted by ripple edits made on other tracks. It is still changed if it is itself the edit target. |
| **Toggle Track Lock** (padlock) | Clips on a locked track can't be selected or changed, and the track shows diagonal stripes. Ripple edits skip it, which can break sync. |
| **Track name** | Right-click > Rename. The name is visible when the track is tall enough. |

Shift-click on Sync Lock, Track Lock, Track Output, Mute or Solo applies the toggle to **all tracks of that type** (all video or all audio).

### 7.6 Track header: video track buttons

| Button | Behavior |
|---|---|
| **Toggle Track Output** (eye) | Hides the track from playback and export. Shift-click toggles all video tracks. |
| Optional buttons (Customize Video Header) | Add-Remove Keyframe, Go to Previous/Next Keyframe, Show Keyframes dropdown (Clip Keyframes, Track Keyframes, Opacity, …), Toggle Sync Lock, Toggle Track Lock, Track Name. |

### 7.7 Track header: audio track buttons

| Button | Behavior |
|---|---|
| **Mute Track (M)** | Silences the track. Shift-click mutes/unmutes all audio tracks. |
| **Solo Track (S)** | Plays only soloed tracks; several soloed tracks play together. Shift-click solos all. |
| **Voice-over Record** (mic) | Right-click it for **Voice-Over Record Settings**: name, input device, channel mapping, countdown sound cues, preroll/postroll. Clicking the mic shows a countdown in the Program Monitor, then records onto that track at the playhead as an overwrite until you click again or press Space. The file is saved to the project's Captured Audio scratch location and imported into the project. |
| **Track volume** (knob, when expanded) | The same track-level volume as the Audio Track Mixer fader. |
| **Show Keyframes** dropdown (when expanded) | Clip Keyframes; Track Keyframes (Volume, Mute, Panner Balance…); Track Panner. |
| **Add-Remove Keyframe**, **Go to Previous/Next Keyframe** | Keyframe navigation on the track's rubber band. |
| **Track Meter** (optional) | A small level meter in the header. |

The **Mix** track header holds the master volume knob and keyframe controls.

### 7.8 Track sizing and management

- **Expand a track**: double-click an empty part of its header, drag the track boundary in the header area, or Alt+scroll (Win) / Opt+scroll (Mac) over the header.
- Shortcuts: **Expand All Tracks** Shift+=, **Minimize All Tracks** Shift+-, **Increase/Decrease Video Track Heights** Ctrl+= / Ctrl+- (Cmd on Mac), **Increase/Decrease Audio Track Heights** Alt+= / Alt+- (Opt on Mac).
- **Add tracks**: right-click a header > Add Track or Add Tracks…. The dialog sets the number of video tracks and their placement (Before First Track, After Target Track, After Last Track), the number of audio tracks with their type (Standard, Mono, 5.1, Adaptive) and placement, and **audio submix** tracks. Dragging a clip into the empty space above the top video track or below the last audio track creates a new track. 26.3 added a preference to turn this automatic track creation off.
- **Delete tracks**: right-click > Delete Track or Delete Tracks… (with an "All Empty Tracks" option).
- **Zoom the timeline**: `=` zoom in, `-` zoom out, `\` toggles between fitting the whole sequence and the previous zoom, Alt+scroll (Win) / Opt+scroll (Mac), trackpad pinch.
- **Scroll**: the mouse wheel scrolls horizontally or vertically depending on Preferences > Timeline > Timeline Mouse Scrolling. Home/End go to the sequence start/end.
- **Auto-scroll during playback**: Preferences > Timeline > Timeline Playback Auto-Scrolling: No Scroll, Page Scroll (default), Smooth Scroll.

### 7.9 Clips on the timeline: visual states

| Visual | Meaning |
|---|---|
| Clip color | The clip's label color. Defaults per type come from Preferences > Labels (video, audio, nested sequence, adjustment layer, graphics, etc.). |
| **Red out-of-sync numbers** | When linked audio and video are moved out of sync, both parts show a red box with the frame offset (e.g. "+12", "-12"). Right-click the number > **Move into Sync** (moves the clip) or **Slip into Sync** (slips its contents). |
| **fx badge** | Effects state (see §7.4 colors). |
| **Bowtie on an edit** | Through edit. |
| **Diagonal stripes on a track** | Track locked. |
| **Red/pink clip with "Media Offline"** | Media is offline. The Program Monitor shows a "Media Offline" frame. |
| **[50%] after the name** | Speed is not 100%. |
| **Speed rubber band** | Shown when Time Remapping > Speed is displayed. |
| **Duplicate frame stripe** | Repeated source frames. |
| **Transition rectangle** | A transition spanning the cut. 26.0 adds **on-clip transition handles** for dragging duration and alignment directly. |
| **Fade handles on audio clips** (26.0) | Interactive audio fades: drag the handle at a clip's top corner inward to create a fade-in or fade-out **(verify exact handle behavior)**. |
| **Keyframe diamonds** | On the rubber band. Linear, Bezier/auto-Bezier and hold keyframes use different icons. |
| **Dimmed clip** | Disabled (Clip > Enable is off). It produces no output. |
| **Generative Extend region** | Frames added by Generative Extend are marked on the clip as AI-generated **(verify visual)**. |

### 7.10 Clip interaction with the mouse (Selection tool)

| Action | Result |
|---|---|
| Click | Selects the clip, plus its linked partners if Linked Selection is on. |
| Shift-click | Adds to or removes from the selection. |
| Alt/Opt-click | Selects only the clicked track item of a linked group. |
| Drag a marquee in empty space | Selects every clip it touches. |
| Drag a clip | Moves it as an **overwrite**: it replaces whatever is underneath on the destination tracks and leaves a gap where it was. |
| Drag, then press **Ctrl/Cmd** before dropping | **Insert** drop: material at the destination ripples right on sync-locked tracks. The original position is left as a gap. |
| **Ctrl+Alt-drag (Win) / Cmd+Opt-drag (Mac)** | **Extract and insert** (rearrange/"swap"): lifts the clip out, closes the gap where it was, and inserts it at the drop point. |
| **Alt/Opt-drag** a selected clip | Duplicates the clip at the drop point. |
| Drag a clip's edge | **Regular trim**. A Selection-tool edge trim cannot push into an adjacent clip; it stops at the neighbor. The cursor is a red bracket. |
| Ctrl/Cmd while trimming an edge | **Ripple trim** (yellow bracket): later material moves. |
| Double-click a clip | Opens that timeline instance in the Source Monitor. A **nested sequence** opens in its own Timeline tab instead. |
| Click a gap, press Delete/Backspace, or right-click > **Ripple Delete** | Closes the gap. It is refused with a warning if closing it would make clips on sync-locked tracks overlap. |
| Right-click a clip | Context menu: Cut, Copy, Paste Attributes, Remove Attributes, Clear, Ripple Delete, Edit Original, Edit Clip in Adobe Audition, Replace With After Effects Composition, Replace With Clip, Render and Replace, Restore Unrendered, Enable, Unlink/Link, Group/Ungroup, Synchronize, Merge Clips, Nest, Make Subclip, Multi-Camera, Label, Speed/Duration, Scene Edit Detection, Audio Gain, Audio Channels, Frame Hold Options / Add Frame Hold / Insert Frame Hold Segment, Field Options, Time Interpolation (Frame Sampling / Frame Blending / Optical Flow), Scale to Frame Size, Set to Frame Size, Adjustment Layer, Link Media, Make Offline, Rename, Reveal in Project, Reveal in Explorer/Finder, Properties, Show Clip Keyframes, Generative Extend (25.2+). |

### 7.11 Edit-point selection and keyboard trimming

- Clicking an edit point with the Selection tool selects one side (the Out of the left clip or the In of the right clip), shown as a red bracket. The Ripple and Rolling tools select with their own types.
- **Shift+T**: Trim Edit (opens the Trim Monitor for the selected edit).
- **Toggle Trim Type**: Ctrl+T **(verify)**, cycling Regular → Ripple → Roll on the selected edit.
- **E**: Extend Selected Edit to Playhead. Moves the selected edit point(s) to the playhead, as a roll or trim depending on the selection type.
- **Q**: Ripple Trim Previous Edit to Playhead. Removes from the previous edit on the targeted tracks up to the playhead, and closes the gap.
- **W**: Ripple Trim Next Edit to Playhead. Removes from the playhead to the next edit, and closes the gap.
- **Ctrl+Alt+Q / Ctrl+Alt+W** (Opt+Q / Opt+W on Mac): the same trims without the ripple (they leave a gap).
- **Nudge**: Alt+Left/Right (Win) or Cmd+Left/Right (Mac) moves selected clips 1 frame; add Shift for 5 frames. Alt+Up/Down (Win) or Opt+Up/Down (Mac) **(verify Mac)** moves selected clips up or down one track.
- **Slip selected clip**: Ctrl+Alt+Left/Right (Win) or Opt+Cmd+Left/Right (Mac), 1 frame; add Shift for 5 frames.
- **Slide selected clip**: Alt+, / Alt+. (Opt on Mac), 1 frame; add Shift for 5 frames.
- **Trim by numbers**: with an edit or clip selected, type `+5` or `-10` on the numeric keypad and press Enter. This trims, or moves the selection, by that many frames.
- **Add Edit**: Ctrl+K / Cmd+K cuts all **targeted** tracks at the playhead. **Ctrl+Shift+K / Cmd+Shift+K** cuts all tracks.
- **D**: Select Clip at Playhead (on targeted tracks). **Ctrl+Shift+A / Cmd+Shift+A**: Deselect All.

### 7.12 Timeline behaviors worth noting

- **Snapping targets**: clip edges, the playhead, markers, In/Out and keyframes. A snap shows a vertical line with triangles.
- **Overwrite is the default drop.** Pressing Ctrl/Cmd during the drag turns it into an insert; small arrows on every sync-locked track show the ripple.
- **Insert with Sync Lock**: an insert adds empty time on **every** sync-locked track at the edit point. A clip on another sync-locked track that spans the insert point is **split**, and its second half moves right, leaving a gap. Turn Sync Lock off on a track (e.g. a music bed) to protect it.
- **Ripple limits**: a ripple trim or ripple delete is refused (stop cursor or warning) if it would make clips on a sync-locked track overlap.
- **Playhead after an edit**: after an Insert or Overwrite from the Source Monitor, the playhead moves to the end of the newly edited clip, ready for the next edit.
- **Paste** goes to the playhead on the **lowest targeted track**. **Paste Insert** (Ctrl+Shift+V / Cmd+Shift+V) ripples.
- **Mixed frame rates**: clips conform to the sequence timebase using the clip's Time Interpolation setting (Frame Sampling by default; Frame Blending or Optical Flow if chosen).
- **Clip mismatch warning**: dragging a clip into an **empty** sequence with different settings asks **Change sequence settings** (match the clip) or **Keep existing settings**. Dragging a clip onto the **New Item** button creates a sequence that matches the clip.
- **Default media scaling** (Preferences > Media): None, **Scale to Frame Size** (rasterizes the source at sequence size, which loses quality if scaled up later), or **Set to Frame Size** (keeps full resolution and sets the Scale % so it fits).
- **Default durations** (Preferences > Timeline): video transition 1 s, audio transition 1 s, still image 5 s (each settable in seconds or frames).
- Other Timeline preferences: Display out-of-sync indicators for unlinked clips; Snap playhead in Timeline when Snap is enabled; Display clip mismatch warning dialog; Fit Clip dialog opens for edit range mismatches; Set focus on the Timeline when performing Insert/Overwrite edits; Default audio tracks (Use File, Mono, Stereo, 5.1, Adaptive) per media type; automatic track creation (26.3).
- **Fit Clip dialog**: appears when the source In-Out duration differs from the sequence In-Out duration in a four-point edit. Choices: **Change Clip Speed (Fit to Fill)**, Ignore Source In Point, Ignore Source Out Point, Ignore Sequence In Point, Ignore Sequence Out Point. "Always use this choice" can be ticked.

---

## 8. Tools panel (every tool)

The Tools panel is a thin vertical or horizontal strip. Tools that share a slot are grouped: a small triangle on the icon means **click and hold** (or right-click) to open the flyout. Pressing a tool's shortcut again cycles through grouped tools in some groups. Holding a tool shortcut **temporarily** switches to that tool and returns to the previous one when you release it (spring-loaded tools, CC 2015.3+).

| Tool | Shortcut | Group | What it does |
|---|---|---|---|
| **Selection** | V | — | Select, move, trim (regular trim at edges; Ctrl/Cmd for ripple). Default tool. |
| **Track Select Forward** | A | Track Select | Click on a track: selects that clip and **every clip to its right on all tracks**. Shift-click: only **that track** from the clicked point forward. Used to push everything downstream to make room. |
| **Track Select Backward** | Shift+A | Track Select | Mirror image: selects the clicked clip and everything to its **left** (all tracks; Shift-click for one track). |
| **Ripple Edit** | B | Edit tools | Drag an edit point: trims that side and **shifts all later material** by the same amount on sync-locked tracks. No gap and no overwrite. Yellow bracket cursor. Program Monitor shows a two-up of the out and in frames during the drag. |
| **Rolling Edit** | N | Edit tools | Drag an edit point: moves the cut, extending one clip and shortening the other by the same amount. Total sequence duration doesn't change. Needs handles on the clip being extended. Double-bracket cursor. |
| **Rate Stretch** | R | Edit tools | Drag a clip's edge: changes its **speed** so the clip's content fits the new duration (no frames added or lost). The speed percentage is shown in the clip name. Doesn't ripple; acts like a regular trim. |
| **Remix** | — | Edit tools (22.3+) | On a music clip with Remix enabled, drag the end to retime the song to a target duration. Premiere (Sensei) rearranges beats and sections and shows zig-zag seams at the cut points. Settings in Essential Sound > Duration > Remix (Segments, Variations). |
| **Generative Extend** (25.2+) | — | Edit tools | Drag a clip's head or tail beyond the end of its media. Firefly generates new frames (up to about 2 s of video; audio ambience/room tone up to about 10 s; it does not generate speech or music). The extended section is a separate generated media file attached to the clip and carries Content Credentials. Needs sign-in and network; the result can be regenerated or replaced. |
| **Razor** | C | — | Click a clip to cut it at that point (creates a through edit). Shift-click cuts **all tracks** at that point, except locked ones. With snapping on, the razor snaps to the playhead. |
| **Slip** | Y | Slip/Slide | Drag a clip: changes its In and Out points together by the same amount, so **which frames show** changes while its position and duration stay put. Program Monitor shows a four-up view: previous clip's out frame, the slipped clip's new In and Out, and the next clip's in frame (with timecodes and frame offset). |
| **Slide** | U | Slip/Slide | Drag a clip: **moves it** along the timeline while keeping its In/Out. The neighbors absorb the move: the previous clip's Out and next clip's In are rolled. Total duration unchanged. Program Monitor shows the four-up view. |
| **Pen** | P | Pen/shape | Draws vector **shape layers** in the Program Monitor (click = corner point, drag = Bézier) as a graphic clip. In the timeline it creates and adjusts keyframes on rubber bands: Ctrl/Cmd-click a rubber band adds a keyframe; drag keyframes or line segments; Shift-click to multi-select. |
| **Rectangle** | — | Pen/shape | Drag in Program Monitor to create a rectangle shape layer (Shift constrains to square, Alt/Opt from center). |
| **Ellipse** | — | Pen/shape | Ellipse shape layer. Shift constrains to circle. |
| **Polygon** | — | Pen/shape | Polygon shape layer. The number of sides is set in the shape's properties (Properties panel) after drawing. |
| **Hand** | H | Hand/Zoom | Drag to scroll the timeline view; in the Program Monitor, pans a zoomed image. |
| **Zoom** | Z | Hand/Zoom | Click to zoom the timeline in at that point; Alt/Opt-click to zoom out; drag a marquee to zoom to that range. |
| **Type** | T | Type | Click in the Program Monitor to create a point text layer (a graphic clip on the top empty track at the playhead), or drag to create a paragraph (area) text box. Typing edits text; Esc ends editing. |
| **Vertical Type** | — | Type | Same, vertical text direction (for CJK etc.). |

**Older/removed tools**: the Track Select tools were a single tool before CC 2015; there is no standalone "Gradient" or "Crop" tool (crop is an effect).

Shift-click on an edit point with the Ripple or Rolling tool adds another edit point to the selection, so you can trim several tracks at once (asymmetric trimming: select one in-side and one out-side to trim in opposite directions).

---

## 9. Effect Controls panel

Shows all effects on **one selected clip** (the clip selected in the Timeline, or the clip loaded in the Source Monitor for master-clip effects, or a selected transition).

### 9.1 Layout

| Area | Contents |
|---|---|
| Header | Source name ("Master * clip" tab vs "Sequence * clip" tab when both have effects — click the tab to switch between master clip effects and instance effects). |
| **Video** section | **Intrinsic (fixed) effects**: **Motion** (Position, Scale, Scale Width, Uniform Scale checkbox, Rotation, Anchor Point, Anti-flicker Filter), **Opacity** (Opacity %, Blend Mode, mask creation: ellipse, 4-point polygon, free-draw Bézier, and in 26.0 Object Mask), **Time Remapping** (Speed). Then **standard effects** applied by the user in stacking order (top to bottom = processed first). |
| **Audio** section | Intrinsic: **Volume** (Bypass, Level dB), **Channel Volume** (per-channel), **Panner** (Balance). Then standard audio effects. |
| **Mini timeline** (right) | Time ruler (clip time), playhead, keyframes for each property, **clip In/Out boundaries** (gray area outside). Toggle with "Show/Hide Timeline View" (chevron button). The panel menu option **Pin to Clip** makes the view show only the clip's duration; off shows the sequence time around it. |
| Bottom | Current time display, **Filter properties** button (show only keyframed or changed properties), zoom slider, **Play Only the Audio for This Clip** and **Loop Audio Playback** buttons. |

### 9.2 Per-effect controls

| Control | Behavior |
|---|---|
| **Disclosure triangle** | Expand/collapse. |
| **fx toggle** ("Toggle the effect on or off") | Bypass. Turning off Motion's fx disables all its transforms. |
| **Effect name** | Click to select; selecting Motion/Opacity masks/Crop etc. shows on-screen handles in the Program Monitor. |
| **Mask tools** (ellipse, 4-point polygon, free-draw Bézier pen, Object Mask icon 26.0+) | Create a mask that limits the effect to the area. |
| **Reset Effect** (circular arrow) | Resets all its properties. |
| **Stopwatch** ("Toggle animation") | Turns keyframing on for a property and adds a keyframe at the playhead. Clicking it off **deletes all keyframes** for that property (with a confirmation). |
| **Keyframe navigator** (◀ ◆ ▶) | Go to previous keyframe, Add/Remove keyframe at playhead, go to next keyframe. |
| **Value** (blue scrub-able number) | Drag horizontally to change (Shift = 10× faster, Ctrl/Cmd = finer), click to type. Math allowed in some builds. |
| **Value graph and Velocity graph** | Expand a property's triangle to see value/velocity graphs for Bézier editing. |
| **Reset Parameter** | Resets one property. |
| **Effect context menu** | Cut/Copy/Paste, Clear, Select All, Rename (effect instance), Save Preset…, Reset. |

### 9.3 Keyframes in Effect Controls

- **Interpolation (temporal)**: right-click a keyframe > Temporal Interpolation: Linear, Bezier, Auto Bezier, Continuous Bezier, **Hold**, **Ease In**, **Ease Out**. Spatial Interpolation (Position): Linear, Bezier, Auto Bezier, Continuous Bezier.
- **Icons**: diamond = linear; hourglass = Bezier-family; half-square = hold; and so on.
- Selecting: click; Shift-click/marquee for many; Ctrl/Cmd-click to toggle.
- Drag to move in time. Copy (Ctrl/Cmd+C) and paste at the playhead; pasting keeps the keyframes' relative timing.
- Hold **Shift** while dragging a keyframe in Effect Controls to snap it to the playhead or other keyframes.
- **Go to previous/next keyframe**: use the navigator arrows. The commands have no default shortcut and can be assigned in Keyboard Shortcuts.

### 9.4 Panel menu items

Pin to Clip; Show Timeline View; Show Audio Time Units; Loop audio; Effects Enabled; Remove Effects (choose which: Motion, Opacity, Time Remap, Volume, all others); Save Preset… (dialog: name, type — **Scale** (keyframes scale proportionally to clip duration), **Anchor to In Point**, **Anchor to Out Point**; description).

### 9.5 Effect stacking order

Video processing order is: standard effects (top to bottom) → Motion → Opacity → (Time Remapping occurs first in time). This is why a Drop Shadow added as a standard effect is **not** rotated with Motion: Motion happens after. To transform before an effect, use the **Transform** effect instead of Motion (it also has its own shutter angle for motion blur). Drag effects to reorder.

### 9.6 25.x/26.x changes

- 25.0: a new **Properties** panel duplicates key controls in a simpler layout (§10); Effect Controls remains for full keyframing.
- 25.5: Effect Controls improvements alongside the new effects library (larger, more organized controls; some new effects expose curve/point widgets) **(verify specifics)**.
- 26.0: **redesigned mask controls** (Bézier handles on rectangle/ellipse, on-screen feather/expansion handles) and **Object Mask** (click the subject, track forward/backward/bidirectional; 26.2 Sharp/Smooth edges; 26.5 Sharpness slider).
- 26.5.1 fixed an issue where arrow-key value changes didn't stick.

---

## 10. Properties panel (25.0+)

A **context-aware** panel (Window > Properties) introduced in 25.0 that shows the most-used controls for **whatever is selected**: video clip, audio clip, graphic/text layer, multiple clips, or nothing (sequence).

| Selection | Sections shown |
|---|---|
| **Video clip** | **Transform** (Position, Scale, Rotation, Opacity, Anchor), **Crop**, **Color** quick adjustments (Auto, basic sliders, link to Lumetri), **Speed** (speed %, reverse, retime), **Quick Actions** (one-click actions such as Auto Reframe and Auto Color; the exact set varies by build **(verify)**), shortcuts to open Effect Controls / Lumetri / Essential Sound. |
| **Audio clip** | Volume / gain, **Enhance Speech** toggle and mix amount, audio type tagging (Dialogue, Music, SFX, Ambience) with key Essential Sound controls, fades **(verify)**. |
| **Text / graphic** | Everything from the old Essential Graphics **Edit** tab: layer list, Align & Transform, Text (font, size, tracking, leading, alignment, faux styles), Appearance (fill, stroke(s), background, shadow(s), mask with text), Responsive Design (pin to, time), Styles (Track/Text Styles), Master Style. |
| **Multiple clips** | Common properties are editable at once. Changing a value applies to all selected clips (first time this was possible in Premiere without Paste Attributes). Mixed values show as "—". |
| **Nothing selected** | Sequence info / settings shortcuts, captions styles **(verify)**. |

Properties edits are the same parameters as Effect Controls; keyframes created in one show in the other. The panel has **keyframe toggles** for main properties. Not in all default workspaces in 25.0: add via Window > Properties or reset workspace.

---

## 11. Essential Graphics / Graphics Templates

### 11.1 History

- **CC 2017.1 (11.1)** introduced the **Essential Graphics panel**, replacing the Legacy Titler for most work. It had two tabs: **Browse** (Motion Graphics templates `.mogrt` from local templates folder, Libraries, Adobe Stock) and **Edit** (layers and properties of the selected graphic clip).
- **22.x** moved Browse into a separate **Essential Graphics > Browse** with a new look, and graphics editing tightly integrated with captions styling ("Captions and Graphics" workspace).
- **25.0** folded the **Edit** functionality into the **Properties panel**. Template browsing is in the **Graphics Templates** panel (Window > Graphics Templates; also Essential Graphics where present depending on build) **(verify panel naming per build)**.

### 11.2 Graphics model

- A **graphic clip** (pink/rose label by default) is a container with **layers**: Text, Shape (rectangle/ellipse/polygon/pen path), Clip (image or video layer added via "New Layer > From File"), grouped layers.
- Layers are listed top-to-bottom (top drawn on top). Each layer has its own transform (Position, Scale, Rotation, Anchor, Opacity) in the **Vector Motion** effect visible in Effect Controls, plus text/shape effects.
- **Responsive Design – Position**: pin a layer's edges to another layer or the video frame so it follows (e.g., a lower-third box that grows with its text). **Responsive Design – Time**: Intro/Outro durations protected from stretching when the clip is trimmed (keyframes within intro/outro stay fixed), and optional **Roll** (scrolling credits: start/end off screen, preroll, postroll, ease in/out).
- **Master Text Styles / Track Styles**: save a style from a text layer; applying it links layers; updating the style updates all linked text. **Master Graphics**: right-click a graphic in the timeline > Upgrade to Master Graphic → appears in Project panel; edits propagate to all instances.
- **Export As Motion Graphics Template** (Graphics and Titles menu / right-click) creates a .mogrt with editable "properties" exposed via the Edit tab's master properties.
- **Motion Graphics templates (.mogrt)** from After Effects expose controls (text, color, checkbox, slider, dropdown, point, media replacement) and render via AE engine.

### 11.3 Text properties

Font family/style, size, **Font Size Slider**, alignment (left/center/right, justify last line left/center/right/all), **Tracking**, **Kerning**, **Leading**, **Baseline Shift**, **Tsume**, **Tab Width**, faux bold/italic, all caps, small caps, superscript/subscript, underline, **Text direction (LTR/RTL)**, **auto-size/paragraph box**, **Appearance**: Fill (solid, gradient — linear/radial — added in 2023), **Stroke** (multiple strokes, inner/outer/center, line join), **Background** (with opacity, size, corner radius), **Shadow** (multiple, color, opacity, angle, distance, size, blur), **Mask with Text** (layer becomes a matte, invert option).

### 11.4 Shape properties

Fill, stroke(s), shadow(s), corner radius for rectangles, number of sides (polygon), Bézier path editing via Pen tool, mask with shape.

---

## 12. Lumetri Color & Lumetri Scopes; Color Mode (beta)

### 12.1 Lumetri Color panel

Applies/edits a **Lumetri Color** effect on the selected clip (creates one if absent). Multiple Lumetri instances allowed (choose via dropdown at top, or "Add Lumetri Color effect"). Sections (each with a section enable checkbox):

| Section | Controls |
|---|---|
| **Basic Correction** | Input LUT (pre-25; replaced by **color management** settings in 25.0 — Input LUT still available **(verify)**), **Auto** tone (Sensei), **White Balance**: WB Selector (eyedropper), Temperature, Tint; **Tone**: Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Reset, **Saturation**; 24.x added **Color** sub-group and **Vibrance**. 25.x: "HDR White" when working in HDR. |
| **Creative** | Look (preset Lumetri looks/LUTs browse), Intensity; **Adjustments**: Faded Film, Sharpen, Vibrance, Saturation; **Shadow Tint** and **Highlight Tint** wheels; **Tint Balance**. |
| **Curves** | **RGB Curves** (master/red/green/blue; HDR range option) and **Hue Saturation Curves**: Hue vs Sat, Hue vs Hue, Hue vs Luma, Luma vs Sat, Sat vs Sat (each with eyedropper to add 3 points at sampled color). |
| **Color Wheels & Match** | **Comparison View** button, **Apply Match** (Sensei color match to reference; "Face Detection" option), Shadows/Midtones/Highlights wheels each with a luma slider, **Hue Rotation vs Classic** wheel mode (24.x), "Wheels: lift/gamma/gain"-like behavior. |
| **HSL Secondary** | **Key**: Set color eyedropper / add / remove color eyedroppers, H/S/L range sliders with softness; **Color/Gray**, Color/Black, Black/White mask preview checkbox, Invert; **Refine**: Denoise, Blur; **Correction**: wheel (single or three-way), Temperature, Tint, Contrast, Sharpen, Saturation. |
| **Vignette** | Amount, Midpoint, Roundness, Feather. |

Panel menu: High Dynamic Range (older), Look library management, Lumetri presets. Lumetri on an **adjustment layer** grades everything below.

### 12.2 Color management (25.0+)

Sequence-level color settings (Sequence Settings > Color / "Color Management" in Sequence settings panel): **Working color space** (Rec.709, Rec.2100 PQ/HLG, Wide Gamut), **Output color space**, **Tone mapping** (auto tone map of HDR/log media when going to SDR), **Saturation** for auto tone mapping, **Auto Detect Log Camera Media** (applies camera log→working conversion automatically, introduced 24.1). Per-clip **Color Space Override** in Interpret Footage / Modify. Preset sequence "Direct Rec.709 (SDR)" vs "Wide Gamut" for log/raw workflows. Lumetri sliders adapt range to HDR working space.

### 12.3 Lumetri Scopes panel

Right-click the panel (or wrench) to choose scopes; several can display at once.

| Scope | Shows |
|---|---|
| **Vectorscope YUV** | Chroma distribution (hue = angle, saturation = distance), target boxes for 75%/100% primaries, **skin tone line**. Zoom/2x/5x/10x options. |
| **Vectorscope HLS** | Hue/saturation/lightness display. |
| **Histogram** | Distribution of tonal values per channel (vertical histogram in Lumetri). |
| **Parade (RGB)** | R, G, B waveforms side by side; also YUV / RGB-White / YUV-White parade types. |
| **Waveform (RGB / Luma / YC / YC no Chroma)** | Brightness vs horizontal position (IRE 0–100, or nits for HDR). |
| Options | **Clamp Signal**, **8/10/float/HDR** bit depth display, **Color Space** (Rec.601, Rec.709, Rec.2020, Rec.2100 PQ/HLG, Automatic), brightness (Dimmed/Normal/Bright), presets (save scope layouts). |

### 12.4 Color Mode (public beta, April 2026 / 26.2+)

Announced at NAB 2026 and developed in a private beta with hundreds of editors. A **dedicated full-screen color grading environment** inside Premiere (comparable in spirit to Resolve's Color page) designed to make grading approachable and efficient: large viewer, clip strip/timeline thumbnails for shot navigation, node-less layered adjustments built on the Lumetri engine, integrated scopes, shot matching and comparison, and quick navigation between shots. Adobe listed upcoming refinements such as **HSL keying for masked isolations**; general availability was planned for later in 2026. Enable via the Beta/Settings menu in 26.2+ builds **(verify exact entry point and panel layout; feature in flux)**.


---

## 13. Essential Sound panel

A task-based audio panel (CC 2017.1+). You **tag** selected audio clips with an **audio type**, and the panel shows simplified controls that drive standard audio effects under the hood (those effects then appear in Effect Controls, and are editable there).

### 13.1 Top of panel

- **Browse** tab: presets (e.g., "Balanced Male Voice", "Podcast Voice"), and **Edit** tab: controls for the selection.
- **Audio type buttons** (when untagged clip selected): **Dialogue**, **Music**, **SFX**, **Ambience**. Tagging sets clip type; **Clear Audio Type** removes tag and its effects.
- **Preset** dropdown + Save preset.
- **Clip Volume** (bottom): Level slider (clip gain/volume), **Mute** checkbox.

### 13.2 Dialogue

| Group | Controls & behavior |
|---|---|
| **Loudness** | **Auto-Match** button: analyzes the clip(s) and sets a gain to reach the target loudness (Auto-Match normalizes dialogue to about -23 LUFS integrated by default; the target is configurable in recent builds **(verify location)**). Shows resulting LUFS. |
| **Enhance Speech** (23.x+, AI) | Toggle + **Mix amount** slider; Sensei model removes noise/reverb to make dialogue sound studio-recorded; processed in background (badge on clip). Settings: Dialogue type (Male/Female/…) earlier; now auto. 24.x moved it out of beta. |
| **Repair** | **Reduce Noise**, **Reduce Rumble**, **DeHum** (50/60 Hz), **DeEss**, **Reduce Reverb** — each checkbox + amount slider. |
| **Clarity** | **Dynamics** (compression amount), **EQ** presets (Subtle, Podcast Voice, Background Voice, Telephone, Radio, etc.) + amount, **Enhance** (Low/High tone for male/female voice). |
| **Creative** | **Reverb** presets (Auditorium, Large Reflective Room, Outside Ambience…) + amount. |
| **Volume** | Clip volume level, mute. |

### 13.3 Music

| Group | Controls |
|---|---|
| Loudness | Auto-Match (target loudness for music, e.g. -25 LUFS). |
| **Duration** | **Method**: *Stretch* (time-stretch to target duration within a range) or **Remix** (Sensei restructures the song to a **Target Duration**; advanced: Segments (max cut seams), Variations). Clip shows zig-zag seams at remix cuts. |
| **Ducking** | Duck against: Dialogue / SFX / Ambience / Untagged clips; **Sensitivity**, **Reduce By** (dB), **Fades** (duration ms), **Fade position**; **Generate Keyframes** button writes volume keyframes on the music clip that dip under the chosen content. 24.x added **Auto-Duck** improvements. |
| Volume | Level, mute. |

### 13.4 SFX

Loudness Auto-Match; **Creative > Reverb**; **Pan** (Position slider for stereo placement); Volume.

### 13.5 Ambience

Loudness Auto-Match; **Creative > Reverb**; **Stereo Width**; **Ducking** (same as music); Volume.

### 13.6 AI audio additions (2023–2026)

- **Audio Category Tagging** (23.x): automatically identifies and tags clips as Dialogue/Music/SFX/Ambience with badge icons on timeline clips; clicking a badge opens the relevant Essential Sound controls.
- **Interactive fade handles** (24.x for audio clips "fade handles" — and 26.0 "interactive audio fades").
- **Bulk bleep/mute** (25.6): from the transcript, find words (e.g., profanity or sensitive info) and apply bleep or mute across the timeline in one action.
- **Sound search** (25.6): Search panel finds sounds by description.
- **Generative Media Tool** (26.5): generate sound effects into the timeline from prompts.

---

## 14. Audio Track Mixer

Window > Audio Track Mixer (Shift+6). A **track-level** mixing console for the active sequence (one channel strip per audio track, submix, and Master). Changes affect the **track**, not clips. Track automation is stored as **track keyframes**.

### 14.1 Channel strip (top to bottom)

| Control | Behavior |
|---|---|
| **Effects & Sends area** (collapsible, show via triangle at top-left "Show/Hide Effects and Sends") | Up to **5 track effect slots** (insert effects, pre-fader by default; right-click for Pre/Post-fader) and **5 send slots** (to submix tracks; pre/post-fader; send level knob). Select effect from slot dropdown; double-click to open its UI; bypass toggle; parameter knob for chosen parameter. |
| **Input / Output assignment** | Track output dropdown: Master or a Submix track. (Input is for VO recording track settings.) |
| **Pan / Balance knob** | Stereo pan for mono tracks; balance for stereo tracks. On 5.1 master, a 5.1 panner tray appears (puck + Center %, LFE volume). Drag the knob, or click its value and type a number (-100 = full left, 100 = full right). |
| **Automation mode** dropdown | **Off** (ignores track keyframes), **Read** (default; plays track keyframes), **Latch** (writes when you touch a control, holds last value after release until stop), **Touch** (writes while touching, returns to previous recorded value after release at "Automatch Time" rate — Preferences > Audio > Automatch Time default 1 s), **Write** (writes all values from playback start, overwriting existing keyframes, then switches to Touch after stop if "Switch to Touch after Write" checked in panel menu). |
| **Mute (M) / Solo (S) / Enable Track for Recording (mic)** | Same as timeline headers. |
| **Fader** | Track volume in dB (-∞ to +6 dB). |
| **Meter** | Per-track VU (peak + peak hold). Panel menu: **Meter Input(s) Only** (for recording). |
| **Track name** | Editable. |

Master strip: master fader + meters (stereo/5.1/multichannel per sequence master setting).

### 14.2 Panel menu & bottom

Transport: Go to In/Out, Play, Loop, **Record** (writes automation or VO), current time / duration. Panel menu: Show/Hide Tracks…, Show Audio Time Units, Loop, Meter Input(s) Only, Switch to Touch after Write, **Audio Plug-in Manager** (VST3/AU), Show Effects and Sends. Window > Audio Track Mixer lists the sequence; multiple Audio Track Mixer panels can be open, one per sequence.

### 14.3 Submix tracks

Created via Add Tracks dialog (Audio Submix tracks). Submix receives audio via track outputs or sends, has its own effects/fader, and routes to Master. Shown in timeline as tracks without clips (darker header).

---

## 15. Audio Clip Mixer

Window > Audio Clip Mixer (Shift+9). Same visual layout as the Track Mixer but each strip controls the **clip under the playhead on that track** (clip-level volume & pan). Adjustments write **clip keyframes** (Volume level, Panner balance) when **Write Keyframes** button (bottom of each strip, keyframe icon) is enabled during playback; otherwise sets the static value at the current clip. Mute/Solo here are track-level (mirroring headers). No effects/sends slots, no automation modes. Strip shows "—" when no clip under playhead. Useful for riding dialogue levels on clips.

---

## 16. Audio Meters

Window > Audio Meters. Vertical (or horizontal) master meters for the sequence master output (or Source Monitor when it's active).

- dB scale (0 to -∞; range set by right-click: 120, 96, 72, 60, 48, 24 dB; **Dynamic Peaks** vs **Static Peaks**; Show Valleys; Show Color Gradient; Solo buttons per channel).
- **Peak indicators** at top turn red on clipping (> 0 dBFS); click to reset.
- 2023+: **Loudness meter** options (LUFS) through Loudness Radar effect / "Loudness Meter" effect on Master **(verify)**.

---

## 17. Effects panel

Window > Effects (Shift+7). Tree of bins:

| Bin | Contents |
|---|---|
| **Presets** | Built-in effect presets (Bevel Edges, Blurs/Fast blur in/out, Convolution Kernel presets, Lens Distortion removal presets for GoPro/DJI, Mosaics, PiPs (picture-in-picture at 25% positions), Solarizes, Twirls) + user presets. |
| **Lumetri Presets** | Cinematic, Filmstock, Monochrome, SpeedLooks, Technical LUTs. |
| **Audio Effects** | Amplitude & Compression (Dynamics, Dynamics Processing, Multiband Compressor, Hard Limiter, Single-band Compressor, Tube-modeled Compressor, Channel Mixer, Amplify), Delay & Echo (Analog Delay, Delay, Multitap Delay), Filter & EQ (Parametric Equalizer, Graphic Equalizer 10/20/30 bands, FFT Filter, Notch Filter, Simple Parametric EQ, Simple Notch, Highpass, Lowpass, Bandpass, Scientific Filter), Modulation (Chorus/Flanger, Flanger, Phaser), Noise Reduction/Restoration (DeNoise, DeHummer, DeReverb, Automatic Click Remover, Adaptive Noise Reduction, DeEsser), Reverb (Convolution Reverb, Studio Reverb, Surround Reverb), Special (Distortion, Loudness Radar, Mastering, Vocal Enhancer, Bass, Balance, Channel Volume, Fill Left/Right, Swap Channels, Invert), Stereo Imagery (Stereo Expander), Time & Pitch (Pitch Shifter), Volume/Gain; plus VST3/AU third-party. |
| **Audio Transitions** | Crossfade: **Constant Gain**, **Constant Power** (default), **Exponential Fade**. |
| **Video Effects** | Categories: Adjust (Auto Color/Contrast/Levels (obsolete), Extract, Levels, Lighting Effects, ProcAmp, Channel Mixer…), Blur & Sharpen (Gaussian Blur, Directional Blur, Camera Blur, Unsharp Mask, Sharpen, Reduce Interlace Flicker), Channel (Invert, Set Matte, Blend, Calculations…), Color Correction (Lumetri Color, Brightness & Contrast, Change Color, Change to Color, Color Balance (HLS), Tint, Leave Color, Video Limiter, ASC CDL), Distort (Transform, Corner Pin, Crop, Lens Distortion, Magnify (26.3 new version), Mirror, Offset, Spherize, Turbulent Displace, Twirl (26.5 updated), Warp Stabilizer, Rolling Shutter Repair, Wave Warp), Generate (4-Color Gradient, Cell Pattern, Checkerboard, Circle, Ellipse, Eyedropper Fill, Grid, Lens Flare (26.5 updated), Lightning, Paint Bucket, Ramp, Write-on), Image Control (Black & White, Color Pass, Color Replace, Gamma Correction), Immersive Video (VR effects), Keying (Ultra Key, Track Matte Key, Luma Key, Color Key, Alpha Adjust, Image Matte Key…), Noise & Grain (Noise, Median, Dust & Scratches), Perspective (Basic 3D, Drop Shadow, Bevel Alpha/Edges), Stylize (Alpha Glow, Brush Strokes, Color Emboss, Find Edges, Mosaic (26.5 softness), Posterize, Replicate, Roughen Edges, Strobe Light, Texturize, Threshold), Time (Echo, Posterize Time), Transform (Auto Reframe, Crop, Horizontal/Vertical Flip, Edge Feather), Transition (Block Dissolve, Gradient Wipe, Linear Wipe, Radial Wipe, Venetian Blinds), Utility (Cineon Converter), Video (Simple Text, Timecode, Clip Name, SDR Conform), **Obsolete** (legacy effects for old projects). **25.5+ added 90+ GPU effects** (from Film Impact): e.g., glows, blurs, light leaks, distortions, glitch, chromatic aberration, **Channel Blur, Gradient, Noise** (26.2), **Magnify** (26.3). |
| **Video Transitions** | 3D Motion (Cube Spin, Flip Over), Dissolve (**Cross Dissolve** default, Additive Dissolve, Dip to Black, Dip to White, Film Dissolve, Morph Cut, Non-Additive Dissolve), Immersive Video, Iris (Box, Cross, Diamond, Round), Page Peel (Page Turn, Page Peel), Slide (Band Slide, Center Split, Push, Slide, Split, Whip), Wipe (many: Band Wipe, Barn Doors, Checker Wipe, Clock Wipe, Gradient Wipe, Inset, Paint Splatter, Pinwheel, Radial Wipe, Random Blocks, Spiral Boxes, Venetian Blinds, Wedge Wipe, Zig-Zag Blocks…), Zoom (Cross Zoom). **25.5+ Film Impact transitions** (zoom, spin, glitch, light leaks, blur, push, etc.), **3D Spinback, Slide** (26.2), **Shape Dissolve** (26.3). |

**Search box** filters across all bins. **Filter buttons** at top: **Accelerated Effects** (GPU — icon), **32-bit Color** (high bit depth), **YUV Effects** (process in YUV without conversion). Each effect shows these badges. **New Custom Bin** (folder) for favorites. Right-click > Set Selected as Default Transition (blue outline marks default video and audio transition).

**Applying**: drag onto clip(s) (or multiple selected clips), double-click with clips selected (applies to all selected) — or drag to Effect Controls. Transitions: drag onto edit point — placement: **Center at Cut**, **Start at Cut**, **End at Cut** (depending on drop position, and on handle availability; if insufficient media, transition uses frame repeat — shown with diagonal stripes on transition). **Ctrl+D** default video transition, **Ctrl+Shift+D** default audio transition, **Shift+D** both (applied to selected edit points/clips or at playhead on targeted tracks). 25.4 **Multi-transitions**: apply/edit transitions on many cuts at once.

---

## 18. Media Browser

Window > Media Browser (Shift+8). File browser specialized for media: shows drives, **Favorites**, **Local Drives**, **Network Drives**, **Creative Cloud** (Team Projects versions), recent dirs.

- **Card/camera structure awareness**: shows XDCAM, P2, AVCHD, Canon XF, RED, ARRI, Sony XAVC folders as clips (spanned clips merged) instead of raw files.
- **Files of type** filter, **View as** (Directory / camera type such as AVCHD, Canon XF, P2, XDCAM-HD…), forward/back navigation, path menu.
- List/Icon views with hover scrub; thumbnails slider.
- **Preview in Source Monitor** by single-click/double-click without importing (temporary). Right-click > **Import**, **Open in Source Monitor**, **Reveal in Finder/Explorer**, **Add to Favorites**.
- **Ingest** checkbox + settings wrench at top: when on, importing triggers copy/transcode/proxy jobs in Adobe Media Encoder per Ingest Settings (§40.13).
- Edit from Media Browser → Source Monitor → Insert works (clip imported automatically on edit).

---

## 19. Libraries panel

Window > Libraries. Creative Cloud Libraries (shared with Photoshop, Illustrator, AE, Express): colors, color themes, character styles, graphics, images, **Looks** (Lumetri), **Motion Graphics templates**, videos, audio, brushes. Search Adobe Stock inside (older builds; 25.6 moved Stock to its own panel). Drag assets into Project/timeline (downloads/links). Library items can be shared/followed by collaborators; linked assets update (Photoshop graphic updated in PS refreshes in Premiere).

---

## 20. Markers panel

Window > Markers. Lists markers of the **clip in the Source Monitor** or the **active sequence** (whichever monitor/timeline is focused).

- Columns/cards: color swatch, name, In, Out, Duration, comments, marker type.
- **Filter by color** buttons (8 marker colors: Green, Red, Purple, Orange, Yellow, White, Blue, Cyan; color names are customizable in later builds), **Search** (26.2: improved search by name, comment, or color across clip/sequence).
- Click a marker → playhead jumps; edit name/comments inline; delete.
- Toggle between showing the active sequence's markers and the Source clip's markers follows panel focus; sorting by time.

### Marker types (Marker dialog: double-click marker or M twice)

| Field | Description |
|---|---|
| Name | Text label. |
| Duration | 0 = point marker; >0 = range marker (drag right edge of marker with Alt to extend or set Duration). |
| Comments | Free text (shown as tooltip and in overlays). |
| Color | 8 colors. |
| **Marker Options** | **Comment Marker** (default), **Chapter Marker** (exports as chapter points in MP4/H.264, QuickTime, DVD/Blu-ray via Encore — legacy), **Segmentation Marker** (broadcast segmentation for some formats), **Web Link** (URL + Frame Target for QuickTime/FLV interactive), **Flash Cue Point** (legacy: Name/Value pairs, Event/Navigation). |
| Prev/Next | Navigate markers in the dialog. |

Markers on clips move with the clip; sequence markers ripple with **Ripple Sequence Markers** (Markers menu toggle) during ripple edits. Markers can be exported (File > Export > Markers… as CSV/HTML) and imported via XML/FCPXML. Markers from Frame.io comments sync as markers (23.x+).

---

## 21. History panel

Window > History. A list of **states** (one per undoable action) for the session.

- Click a state to revert to it (later states grayed; doing a new action discards them).
- **Step Backward / Step Forward** (panel menu) = Undo/Redo (Ctrl+Z / Ctrl+Shift+Z).
- **Delete** button (trash) removes the selected state **and all states after it**; Panel menu **Clear History** removes all states (cannot be undone).
- **History States** setting (Panel menu > Settings): number of states kept (default 32; up to 100).
- History is not saved with project (cleared on close).

---

## 22. Info panel

Window > Info. Shows information about the **selected item** and the **sequence**: for a clip — Name, Type, Start, End, Duration (In/Out), Video frame size/PAR, Audio sample rate/channels, Tape name; for the sequence — current playhead timecode, **per-track timecode of the clip under the playhead** on each video/audio track (Video 1: clip start/end etc.). Useful during trims to read exact deltas (shows "Selection Duration" when trimming). Also shows info for transitions and gaps.

---

## 23. Metadata panel

Window > Metadata. Displays/edits metadata of the selected project item in three sections:

| Section | Contents |
|---|---|
| **Clip** | **Premiere Pro project-level clip metadata** (stored in project, not file): Name, Label, Media Type, Frame Rate, Media Start, Video In/Out, Description, Scene, Shot, Log Note, Good, Comment, etc. |
| **File** | **XMP metadata** stored in the file (or sidecar .xmp): Dublin Core, Basic, Rights Management, Dynamic Media (Audio track info, Scene, Shot location, Tape name, Log comment), EXIF, IPTC, camera raw, etc. Writing to file can be disabled (Preferences > Media > "Write XMP ID to files on import", "Enable clip and XMP metadata linking"). |
| **Speech Analysis / Transcript** (older; replaced by Text panel transcript in 2021) | |

Panel menu > **Metadata Display** chooses which schemas/properties appear (same dialog as Project panel column chooser). Linking: Preferences > Media > **Enable clip and XMP metadata linking** so certain clip fields write to XMP.

---

## 24. Events panel

Window > Events. Log of **warnings, errors, and info** messages from Premiere, plug-ins, Dynamic Link, Media Encoder (e.g., "File importer detected an inconsistency", missing codecs, GPU errors, script messages). Select an event → **Details** for full text; **Clear All**. An Events indicator lights up (yellow/red badge) in the app status area when new events arrive.

---

## 25. Text panel (Transcript / Captions / Graphics) & Paper Edit

Window > Text (introduced 2021, Speech to Text). Tabs:

### 25.1 Transcript tab

- **Transcribe** a sequence (or source clip): language selection (~18+ languages, plus Auto-detect in later versions), **Speaker labeling** (Sensei identifies speakers; rename "Speaker 1" → name), audio analysis option: transcribe only Mix / specific track, **Auto-transcribe** imported clips (Preferences > Transcription: auto-transcribe video clips on import, language). Transcription runs on-device since 22.x.
- **Text-Based Editing** (23.4, May 2023): the sequence's transcript is shown as editable text; **selecting words highlights the corresponding range in the timeline**; **Delete** on selected text **ripple deletes** that range in the sequence (Extract); rearranging by cutting and pasting transcript text is supported in later builds **(verify)**; **Insert/Overwrite** from Source transcript into sequence at playhead; a search box (find, with next/previous); **Pauses** detection ("…" markers; "Delete pauses" for all pauses longer than threshold); **Filler words** detection ("um", "uh" — highlight and delete all filler words, 24.x); transcript sync: text highlight follows playhead.
- Panel menu: Export to text file, Re-transcribe sequence, Speaker settings, **Show pauses**, **Show filler words**, Transcription settings, **Static transcript** vs live.
- **Bulk bleep/mute** (25.6): select/search words → apply bleep or mute to all occurrences.
- **Paper Edit** (26.5): in the Text panel, select sentences/lines of dialogue from one or more source transcripts, preview the selection, then **create a new sequence** from them (a rough cut assembled in transcript order).

### 25.2 Captions tab

- **Create captions** from transcript: dialog with **Caption preset** (Subtitle default, or saved style), **Format** (Subtitle, CEA-608, CEA-708, Teletext, Australian OP-47, EBU subtitle (Open captions), etc.), **Stream**, **Style** (Track Style), **Maximum length in characters** (e.g., 42), **Minimum duration** (seconds), **Gap between captions** (frames), **Lines**: Single / Double, **Single-word captions** (26.3: one word at a time for social) **(verify where the option lives)**.
- Caption list: each caption block with In/Out timecode and text; edit text inline, split/merge captions (buttons), add new caption; search/replace in captions.
- Captions live on **caption tracks** in the timeline; caption items can be trimmed/moved like clips; linked with A/V clips (2021+) so they move/trim together.
- Styling: in Properties panel (25.x) or Essential Graphics (older) — font, size, color, background box, position (9-zone alignment grid), **Track Style** applies to all captions on track.
- **Caption Translation** (25.2): translate captions into 27+ languages, creating new caption tracks per language.
- Import SRT/SCC/MCC/XML/STL caption files; **Export**: sidecar (.srt, .scc, .mcc, .xml, .stl, .txt) or **burn-in** in Export settings Captions section; or **embed** into supporting formats (QuickTime/MXF 608/708).
- Preferences > Graphics (25.4): default fonts for text, subtitles, closed captions (closed caption list shows monospace fonts by default for compatibility).

### 25.3 Graphics tab (23.x+)

Lists all graphics/text layers in the sequence as text; edit text in a list ("find & replace" across lower-thirds) and jump to each; useful for spell-checking titles **(verify current tab name)**.

---

## 26. Search panel (Media Intelligence)

Introduced **25.2**. Window > Search (or via Project panel search). **Natural-language search** over the project's media: describe imagery ("a person riding a bike at sunset"), spoken words (via transcripts), or metadata (camera, date, location, shot type). Analysis (**Media Intelligence**) runs **locally on device** after import (progress in Progress panel); can be disabled in Preferences. Results show clips with matching **moments** (in/out ranges highlighted); click to load in Source Monitor at that point; drag result to timeline.

- 25.6: **sound search** (find specific sounds by description).
- 26.2: marker search by name, comment, or color.
- 26.3: **thumbnail size slider** (enlarges thumbnails, waveforms, transcript text in results).
- Filters: media type, visual/spoken/metadata scopes **(verify UI names)**.

---

## 27. Sequence Index panel (26.2+)

Window > Sequence Index. A **spreadsheet-style, searchable list of every item in a sequence** (clips, graphics, captions, transitions, effects, markers) with columns such as track, name, In/Out (sequence & source), duration, speed, effects, status. Click a row to jump the playhead/select the item. **Filter** (funnel icon) to limit display (e.g., show only **offline clips**, **muted tracks**, specific track types). Designed for navigating complex sequences and QC.

---

## 28. Productions panel

**Productions** (introduced 14.0, 2020) let large jobs be split into many smaller projects that share a common folder and media.

- File > New > **Production…** creates a folder (production) containing projects; **Productions panel** (Window > Productions) shows the production's projects and folders (mirrors disk). Add/Remove/Rename projects; create folders; open projects (multiple projects can be open at once).
- **Project locking**: when you open a project in a shared production, it's locked for you; other users see a lock (read-only). Unlock by closing or toggling the lock button (Project panel bottom-left). Lock status icons show who has it.
- **Cross-project referencing**: using a clip from another project in the production **references** it rather than duplicating media (master clip remains in source project); Premiere tracks references.
- **Production settings**: scratch disks for the production (shared preview/proxy location), Production Settings dialog.
- Moving projects in Productions panel moves files on disk.
- Shared storage (NAS/SAN) recommended; 26.5.1 fixed NAS saving issues; 26.3 faster production upgrades.

---

## 29. Frame.io panel, Adobe Stock panel, Firefly Boards

### 29.1 Frame.io

- **23.x**: Frame.io built in (Window > Review with Frame.io / **Comments** panel): upload sequence/clip for review, comments appear in panel and as **markers** on timeline, reply/resolve.
- **25.6**: newly designed native **Frame.io panel** for **Frame.io V4**: browse projects/folders/assets, view, **import media** from Frame.io directly; share/upload.
- **26.0**: Frame.io V4 integration across review; 26.x/NAB 2026 **Frame.io Drive** (mount Frame.io storage like a drive) introduced alongside **(verify Premiere surface)**.

### 29.2 Adobe Stock panel (25.6+)

Search, preview, **license**, and import Adobe Stock videos, images, music, templates (hundreds of millions of assets). 26.3: **preview first** — unlicensed previews can be edited into sequences; a **cart icon** marks previewed assets in the Project panel; licensing from inside Premiere moves the licensed asset into an **Adobe Stock bin** and automatically replaces timeline previews.

### 29.3 Firefly / generative

- **Generative Extend** (25.2 GA): drag a clip edge past the end of media with the **Generative Extend tool** (in the Tools panel edit group, 25.x) — Firefly generates extra frames (video ~up to 2 s, audio ambience up to 10 s, no speech/music generated). Results flagged with Content Credentials. 26.5 expanded supported formats (360p–4K UHD, any aspect ratio, interlaced, non-square pixels).
- **Firefly Boards** (25.6): open from File menu for moodboards/storyboards; send media to Premiere; 26.3 import Boards media as a **ready-to-edit sequence** (clips placed in selection order).
- **Generative Media Tool** (26.5): generate **video clips and sound effects** from prompts using Firefly or partner models (Adobe has offered partner models such as Google Veo, Kling, Runway, Luma via Firefly **(verify model list)**), optionally using frames from your footage as visual references; results land in the timeline as editable clips. Uses generative credits (26.5.1 improved credit transparency).
- **Content Credentials** (26.2): Export settings section to attach provenance info (creator, linked social accounts, gen-AI usage preferences).

---

## 30. Legacy Title, Capture, and other minor panels

### 30.1 Legacy Title (Titler)

File > New > Legacy Title (deprecated in 2017.1, hidden later; **removed in 2023 (v23.x)** for new creation; old legacy titles in projects **convert to Source Graphics** automatically on open (2023+) **(verify version — Adobe announced removal and conversion around 22.x/23.0)**. The old Titler had: Title Designer canvas with safe areas, Title Tools (Selection, Rotation, Type, Vertical Type, Area Type, Path Type, Pen, Rectangle, Rounded Rectangle, Ellipse, Arc, Wedge, Line…), Title Actions (align/center/distribute), Title Styles library, Title Properties (font, kerning, leading, fill — Solid/Linear/Radial/4-Color Gradient/Bevel/Eliminate/Ghost, sheen, texture, strokes inner/outer, shadow), Roll/Crawl Options (Still, Roll, Crawl Left/Right; Start/End off screen; preroll, ease-in, ease-out, postroll), Templates.

### 30.2 Capture panel

File > Capture (F5). Captures from **tape devices** (DV/HDV over FireWire, or via third-party SDI cards): device control (play, stop, rewind, FF, shuttle, jog), Logging tab (Setup: audio/video/both, Log clips to bin, Clip data: Tape name, Clip name, Description, Scene, Shot/Take, Log note; Timecode: Set In/Out, Log Clip, **Capture In/Out**, **Tape**, **Scene detect**, **Handles**), Settings tab (Capture format: DV/HDV, capture locations, Device control settings, preroll, timecode offset). **Batch Capture** (File > Batch Capture, F6) captures logged offline clips. Legacy feature; still present for tape users.

### 30.3 Other panels (Window menu)

| Panel | Purpose |
|---|---|
| **Progress** | Background tasks (auto-transcribe, proxies via AME, media intelligence, Enhance Speech, Generative Extend, renders). |
| **Timecode** (Window > Timecode) | Large floating timecode display (customizable: sequence/source/clip name, size, offset, track timecode) — useful for second monitors (2019+). |
| **Workspaces** | Older builds had a Workspaces panel/bar. |
| **Learn** | In-app tutorials (Learning workspace); retired in later builds **(verify)**. |
| **Comments** (Frame.io) | Review comments. |
| **Captions** (old 2021 captions panel) | Replaced by Text panel. |
| **Tools** | §8. |
| **Extensions** (Window > Extensions / UXP Plugins in 25.x) | Third-party CEP/UXP panels (e.g., Frame.io legacy, Adobe Stock, plug-in panels). 25.x introduced **UXP** plugin support for Premiere **(verify GA version)**. |
| **Lumetri Scopes**, **Lumetri Color** | §12. |
| **Audio Meters** | §16. |
| **Essential Graphics / Graphics Templates** | §11. |
| **Program/Source/Reference Monitor** | §4–6. |
| **Sequence Index** | §27 (26.2). |
| **Search** | §26 (25.2). |
| **Properties** | §10 (25.0). |
| **Adobe Stock**, **Frame.io** | §29 (25.6). |


---

## 31. File menu

Shortcuts Win / Mac. Items differ slightly by version; this reflects 24.x–26.x.

| Item | Shortcut | What it does |
|---|---|---|
| **New > Project…** | Ctrl+Alt+N / Cmd+Opt+N | Opens the New Project screen (22.0+ Import-mode style: name, location, media to import, "Create new sequence" option). Project Settings available later via File > Project Settings. |
| **New > Production…** | — | Creates a Production folder (§28). |
| **New > Team Project…** | — | Cloud-hosted collaborative project (legacy Team Projects; being superseded by Productions + Frame.io; Adobe has announced Team Projects end of life for new creation **(verify date)**). |
| **New > Sequence…** | Ctrl+N / Cmd+N | New Sequence dialog (§40.1). |
| **New > Sequence From Clip** | — | Sequence matching selected clip's settings, containing it. |
| **New > Bin** | Ctrl+B / Cmd+B | New bin in Project panel. |
| **New > Search Bin** | — | Search bin from current search criteria. |
| **New > Shared Project…** | — | (Shared Projects, pre-Productions collaboration) project file referencing another's sequences in shared storage, with lock. |
| **New > Linked Team Project** | — | Team project link item. |
| **New > Offline File…** | — | Placeholder clip with given settings for media not yet available. |
| **New > Adjustment Layer…** | — | Creates an adjustment layer item (§40.16). |
| **New > Legacy Title** | — | Hidden/removed in newer builds (§30.1). |
| **New > Photoshop File…** | — | Creates a blank PSD at sequence size, opens in Photoshop, imports into project. |
| **New > Bars and Tone / HD Bars and Tone / Black Video / Captions… / Color Matte / Universal Counting Leader / Transparent Video** | — | Synthetic items (§40.16). |
| **Open Project…** | Ctrl+O / Cmd+O | Opens a .prproj. Other formats (FCP XML, AAF, EDL, OTIO, other projects' sequences) come in through File > Import. |
| **Open Production…** | — | Opens a production folder. |
| **Open Team Project…** | — | |
| **Open Recent** | — | Recent projects list. |
| **Convert Premiere Clip / Rush / iPhone project** | — | Opens projects from Premiere Rush/Premiere on iPhone (25.6+: projects started on iPhone can be sent/opened on desktop). |
| **Firefly Boards** (25.6+) | — | Opens Firefly Boards (web) for ideation; send media back. |
| **Close** | Ctrl+W / Cmd+W | Closes the active panel (e.g., a Timeline tab, Source clip). |
| **Close Project** | Ctrl+Shift+W / Cmd+Shift+W | Closes the current project. |
| **Close All Projects** | — | |
| **Close All Other Projects** | — | (multiple open projects) |
| **Refresh All Projects** | — | Reloads projects (Productions/shared). |
| **Save** | Ctrl+S / Cmd+S | Saves project. |
| **Save As…** | Ctrl+Shift+S / Cmd+Shift+S | Saves under new name; continue working in the new file. |
| **Save a Copy…** | Ctrl+Alt+S / Cmd+Opt+S | Saves a copy; continue working in the original. |
| **Save All** | — | Saves all open projects. |
| **Revert** | — | Reverts to last saved version. |
| **Sync Settings** | — | Upload/download preferences, workspaces, keyboard shortcuts, presets via Creative Cloud. |
| **Capture…** | F5 | Tape capture panel (§30.2). |
| **Batch Capture…** | F6 | Capture logged offline clips. |
| **Link Media…** | — | Relinks offline clips (§40.20). |
| **Make Offline…** | — | Disconnects media from selected items (option: keep media files, or delete media files) (§40.20). |
| **Adobe Dynamic Link > Replace with After Effects Composition / New After Effects Composition… / Import After Effects Composition…** | — | Dynamic Link round-trips with After Effects. |
| **Import from Media Browser** | Ctrl+Alt+I / Cmd+Opt+I | Imports selected Media Browser items. |
| **Import…** | Ctrl+I / Cmd+I | Import dialog. |
| **Import Recent File** | — | |
| **Export > Media…** | Ctrl+M / Cmd+M | Opens **Export mode** (22.0+) for the selected sequence/clip: destinations, Preset, Format, file name/location, Video/Audio/Multiplexer/Captions/Effects (overlays: Lumetri Look, SDR Conform, Image overlay, Name overlay, Timecode overlay, Time Tuner, Video Limiter, Loudness Normalization), Metadata, General (Import into project, Use previews, Use proxies, Render at Maximum Depth, Use Maximum Render Quality, Set Start Timecode, Render alpha channel only, Time Interpolation), **Content Credentials** (26.2). Range: Entire Source, Source In/Out, Work Area, Custom. **Send to Media Encoder** for queuing. |
| **Export > Motion Graphics Template…** | — | Exports selected graphic clip as .mogrt (to Local templates folder, Local drive, or Libraries). |
| **Export > Tape (DV/HDV)… / Tape (Serial Device)…** | — | Print to tape. |
| **Export > EDL…** | — | CMX3600 EDL (one video track + up to 4 audio channels per EDL; options: title, start TC, include video levels, audio levels, use source file names, audio processing mapping). |
| **Export > OMF…** | — | Audio interchange: Encapsulate/Separate audio, handles, sample rate/bit depth for audio post. |
| **Export > Markers…** | — | Exports markers (CSV, HTML). |
| **Export > Selection as Premiere Project…** | — | Exports selected sequences/items as a new trimmed project (like Project Manager subset). |
| **Export > AAF…** | — | Avid/Pro Tools interchange (mixdown video, breakout to mono, embed audio, handles). |
| **Export > Avid Log Exchange…** | — | ALE metadata. |
| **Export > Final Cut Pro XML…** | — | FCP7 XML (also read by Resolve, etc.). |
| **Export > OpenTimelineIO** (26.0+) | — | OTIO interchange export (import via File > Import). |
| **Export > Captions…** | — | Sidecar caption files (SRT, SCC, MCC, XML, STL, DFXP, plain text). |
| **Get Properties for > File… / Selection…** | — | Properties dialog: file path, type, size, frame size, frame rate, codecs, data rate graph (Data Rate Analysis), audio info. |
| **Project Settings > General / Scratch Disks / Ingest Settings** | — | §40.13 (General: Video Rendering & Playback renderer (Mercury Playback Engine GPU Acceleration (CUDA/OpenCL/Metal) or Software Only), Video/Audio display format, Capture format, Preview cache, Color settings (25.x moved project color mgmt here: HDR graphics white, etc.), Display format; Scratch Disks: Captured Video/Audio, Video Previews, Audio Previews, Project Auto Save, CC Libraries Downloads, Motion Graphics Template Media; Ingest Settings: Copy/Transcode/Create Proxies/Copy and Create Proxies with presets & destinations). |
| **Production Settings** | — | Scratch disks for productions. |
| **Project Manager…** | — | Consolidate & transcode (§40.21). |
| **Exit / Quit** | Ctrl+Q / Cmd+Q | Mac: in Premiere menu. |

---

## 32. Edit menu

| Item | Shortcut (Win / Mac) | What it does |
|---|---|---|
| **Undo** | Ctrl+Z / Cmd+Z | Undo last action (label names the action). |
| **Redo** | Ctrl+Shift+Z / Cmd+Shift+Z | |
| **Cut** | Ctrl+X / Cmd+X | Removes selected clips (leaves gap) to clipboard. |
| **Copy** | Ctrl+C / Cmd+C | |
| **Paste** | Ctrl+V / Cmd+V | Pastes at playhead on lowest targeted track (overwrite). In Effect Controls, pastes effects/keyframes. |
| **Paste Insert** | Ctrl+Shift+V / Cmd+Shift+V | Inserts clipboard at playhead (ripples). |
| **Paste Attributes…** | Ctrl+Alt+V / Cmd+Opt+V | Dialog: choose which attributes from the copied clip to apply to selected clips: Video (Motion, Opacity, Time Remapping, each effect individually), Audio (Volume, Channel Volume, Panner, effects), **Scale Attribute Times** (stretch keyframes to target clip duration). |
| **Remove Attributes…** | — | Dialog: choose attributes/effects to remove from selected clips (resets intrinsic attributes). |
| **Clear** | Delete / Forward Delete | Deletes selected clips (gap left) or Project items. |
| **Ripple Delete** | Shift+Delete / Shift+Forward Delete | Deletes selected clips and closes the gap. |
| **Duplicate** | Ctrl+Shift+/ / Cmd+Shift+/ | Duplicates selected Project items (e.g., sequence copy). |
| **Select All** | Ctrl+A / Cmd+A | |
| **Select All Matching** | — | Selects all clips in the timeline from the same source as the selected one **(verify availability)**. |
| **Deselect All** | Ctrl+Shift+A / Cmd+Shift+A | |
| **Find…** | Ctrl+F / Cmd+F | Project panel Find dialog (column, operator contains/exactly matches/begins with/ends with, Match Any/All, case sensitivity; up to 2 conditions). With the Timeline focused, Find searches the sequence's clips by name and other fields and selects the matches. |
| **Find Faces** | — | Older face-detection search (removed). |
| **Label > [color] / Select Label Group** | — | Set label, select all items with same label. |
| **Edit Original** | Ctrl+E / Cmd+E | Opens source in associated app. |
| **Edit in Adobe Audition > Clip / Sequence…** | — | Round-trip a clip (renders a copy WAV "Audio Extracted" and replaces it) or send sequence to Audition multitrack session (with video, OMF-like). |
| **Edit in Adobe Photoshop** | — | Open still in Photoshop; updates on save. |
| **Keyboard Shortcuts…** | Ctrl+Alt+K / Cmd+Opt+K | Visual keyboard layout editor (§41). |
| **Preferences** (Win; Mac: Premiere > Settings) | — | Categories: General, Appearance, Audio, Audio Hardware, Auto Save, Capture, Collaboration, Color (25.x), Control Surface, Graphics, Labels, Media, Media Cache, Memory, Playback, Sync Settings, Timeline, Transcription (Text), Trim, Beta/Labs **(verify list per build)**. |

Key **Preferences** worth knowing:

| Category | Notable settings |
|---|---|
| General | At startup show Home; Bins double-click behavior; Display event indicator; Show tool tips; Show "What's new"; Show clip mismatch warning (moved to Timeline in newer). |
| Appearance | Theme (25.x Darkest/Dark/Light), High contrast; interactive control/focus colors; UI scale (via OS). |
| Audio | Automatch Time; 5.1 Mixdown type; Play audio while scrubbing; Maintain pitch while shuttling; Mute input during timeline recording; Automatic audio waveform generation; Default audio tracks per media type (newer: Timeline); Audio Plug-in Manager; Large volume adjustment (dB); Track Keyframes: Linear Keyframe Thinning, Minimum Time Interval Thinning. |
| Audio Hardware | Device class (ASIO/MME/CoreAudio), Default Input/Output, Master Clock, Latency/buffer size, Sample Rate, Output Mapping. |
| Auto Save | Automatically save projects (interval minutes, max versions), **Save backup project to Creative Cloud**, Auto Save also saves the current project(s). |
| Collaboration | Team Projects/Frame.io: share cursor/locking. |
| Graphics (25.4+) | Default fonts for text/subtitles/closed captions, text engine (South Asian & Middle Eastern) etc. |
| Labels | Label colors & names; default labels per item type; palette (25.x new vs Classic). |
| Media | Indeterminate Media Timebase (default fps for image sequences); Timecode: Use Media Source / Start at 00:00:00:00; Frame Count start; Default Media Scaling; Write XMP ID; Enable clip and XMP metadata linking; Include captions on import; Allow duplicate media during project import; Growing files: Automatically refresh growing files, interval. |
| Media Cache | Location, auto-delete old cache files (older than N days / when exceeding N GB), Clean (remove unused). |
| Memory | RAM reserved for other apps; Optimize rendering for Performance/Memory. |
| Playback | Preroll/Postroll; Step forward/back many frames (the Shift+arrow amount, default 5); Pause Media Encoder queue during playback; Video device / Mercury Transmit (enable, devices, disable video output when in background); Audio device; **Enable Mercury Transmit**. |
| Timeline | Default durations; auto-scroll; mouse scrolling; snap playhead; clip mismatch warning; Fit clip dialog; out-of-sync indicators; set focus on timeline after insert/overwrite; **automatic track creation (26.3)**. |
| Trim | Large Trim Offset (frames, default 5; audio units), Allow Selection tool to choose Roll and Ripple trims without modifier key. |
| Transcription | Auto-transcribe imported clips, language. |

---

## 33. Clip menu

| Item | Shortcut | What it does |
|---|---|---|
| **Rename…** | — | Rename selected clip (timeline instance name or project item). |
| **Make Subclip…** | Ctrl+U / Cmd+U | From Source Monitor In/Out (or selected timeline clip), creates a **subclip** item: name, Start/End timecodes, "Restrict Trims To Subclip Boundaries" checkbox (§40.15). |
| **Edit Subclip…** | — | Change subclip start/end or convert to master clip ("Convert to Master Clip"). |
| **Edit Offline…** | — | Edit offline file properties (tape name, timecode, description). |
| **Source Settings…** | — | Format-specific source settings (RED/ARRI/Sony RAW/Canon RAW: ISO, white balance, color science, debayer quality; also Camera RAW for stills). |
| **Modify > Audio Channels…** | Shift+G | Clip channel format (Mono/Stereo/5.1/Adaptive), number of audio clips, mapping of media source channels to clip channels (e.g., split dual-mono into separate mono clips, combine). For master clips (affects future edits), and in recent builds timeline clips too. |
| **Modify > Interpret Footage…** | — | §40.17: Frame Rate (use file / assume this rate), Pixel Aspect Ratio (use file / conform to), Field Order, Alpha Channel (ignore, invert, premultiplied), VR Properties, **Color Space Override / Color Management** (25.x: input color space, log, LUT, HDR). |
| **Modify > Timecode…** | — | Set clip timecode (file TC / alternate: start TC, time display format, tape name). |
| **Video Options > Frame Hold Options…** | — | Hold on: Source Timecode / Sequence Timecode / In Point / Out Point / Marker 0; Hold Filters (freeze effect animation); Deinterlace. |
| **Video Options > Add Frame Hold** | — | Splits the clip at the playhead and freezes the frame for the remainder of the clip. |
| **Video Options > Insert Frame Hold Segment** | — | Splits at the playhead, inserts a 2-second freeze-frame segment of the playhead frame, and ripples the rest of the clip later. |
| **Video Options > Field Options…** | — | Reverse field dominance; processing: None, Interlace consecutive frames, Always deinterlace, Flicker removal. |
| **Video Options > Time Interpolation** | — | Frame Sampling (repeat/drop frames), Frame Blending (crossfades frames), **Optical Flow** (motion-estimated interpolated frames; can cause artifacts). Applies to speed changes and frame rate conversion. |
| **Video Options > Scale to Frame Size / Set to Frame Size** | — | §7.12 / §40.17. |
| **Audio Options > Audio Gain…** | G | Dialog: **Set Gain to** (dB), **Adjust Gain by** (dB, cumulative), **Normalize Max Peak to** (dB; each clip separately), **Normalize All Peaks to** (dB; as a group), shows Peak Amplitude. Gain is pre-volume (before Volume effect). |
| **Audio Options > Breakout to Mono** | — | Creates mono master clips per channel in Project panel. |
| **Audio Options > Render and Replace** | — | Renders audio clip effects into new file. |
| **Audio Options > Extract Audio** | — | Creates new audio-only files (.wav) from selected clips' audio. |
| **Analyze Content…** | — | Older: face detection / speech analysis (removed). |
| **Speed/Duration…** | Ctrl+R / Cmd+R | §40.18. |
| **Scene Edit Detection…** | — | §40.19 (on timeline clips). |
| **Remove Effects…** | — | Same dialog as Remove Attributes. |
| **Generative Extend** (25.2+) | — | Extend clip with Firefly (also via tool). |
| **Capture Settings / Insert / Overwrite** | — | **Insert** (,) and **Overwrite** (.) from Source Monitor. |
| **Replace Footage…** | Ctrl+H / Cmd+H | Replaces the media file behind the selected Project item; all instances update. Option: "Rename clip to file name". |
| **Replace With Clip > From Source Monitor** | — | Replace selected timeline clip with Source Monitor clip, starting at Source In (or playhead). |
| **Replace With Clip > From Source Monitor, Match Frame** | — | Replace using frame sync: the frame at Source playhead aligns to the frame at sequence playhead. |
| **Replace With Clip > From Bin** | — | Replace with selected Project item (starting at its In). |
| **Render and Replace…** | — | §40.12: render selected clips to new media file (format: Match source / preset; include effects or source only; handles) and replace in timeline. Useful for Dynamic Link comps, heavy effects. |
| **Restore Unrendered** | — | Reverts render-and-replaced clips to original. |
| **Restore Unrendered Content** | — | For AE comps. |
| **Proxy > Create Proxies… / Attach Proxies… / Reconnect Full Resolution Media…** | — | §40.13. |
| **Enable** | Shift+E / Cmd+Shift+E | Toggles clip enabled (disabled clips are dimmed, produce no output). |
| **Unlink / Link** | Ctrl+L / Cmd+L | Link or unlink selected video/audio clips. Up to 1 video + up to 16 audio clips can be linked. |
| **Group / Ungroup** | Ctrl+G / Cmd+G, Ctrl+Shift+G / Cmd+Shift+G | Group clips so they select/move/trim together (trim of a group's outer edges); group members can still be Alt-clicked individually. |
| **Synchronize…** | — | Aligns selected timeline clips by: Clip Start, Clip End, Timecode (with an "Ignore Hours" option), Clip Marker (numbered/named), **Audio** (waveform analysis; "Track Channel" choice) — moves clips so they sync. |
| **Merge Clips…** | — | Creates a **merged clip** (one video + up to 16 audio sources) in Project panel, synchronized by In point, Timecode, Clip Marker, or Audio; options: Remove audio from AV clip; Use audio timecode. |
| **Nest…** | — | Replaces selected timeline clips with a nested sequence containing them (name dialog) (§40.9). |
| **Create Multi-Camera Source Sequence…** | — | §40.10. |
| **Multi-Camera > Enable / Flatten / [angle list] / Camera N** | — | Switch angle of selected multicam clip; Enable toggles multicam; **Flatten** replaces multicam clips with the active angle's clip. |
| **Label** | — | |
| **Make Offline / Link Media** | — | Same as File equivalents for timeline selections. |
| **Edit Clip in Adobe Audition** | — | |
| **Replace With After Effects Composition** | — | Convert selected clips into a new AE comp via Dynamic Link; clips replaced by the comp. |
| **Auto Reframe Sequence…** | (Sequence menu) | §40.19b. |

---

## 34. Sequence menu

| Item | Shortcut (Win / Mac) | What it does |
|---|---|---|
| **Sequence Settings…** | — | §40.1. After creation, **Editing Mode and Timebase are locked** (grayed out); frame size, pixel aspect, fields, display format, audio display format, preview settings and max bit depth/render quality stay editable. |
| **Render Effects In to Out** | Enter / Return | Renders preview files for the **red**-bar sections between sequence In/Out (or the whole sequence if none) (§40.12). |
| **Render In to Out** | — | Renders preview files for **all** red **and yellow** sections in the range, so they all turn green. |
| **Render Selection** | — | Renders preview files for the selected clips' ranges. |
| **Render Audio** | — | Renders audio previews (conformed audio with effects) for In-Out. |
| **Delete Render Files** | — | Deletes all preview files of this sequence (confirm). |
| **Delete Render Files In to Out** | — | Deletes previews for In-Out range. |
| **Match Frame** | F | Loads the master clip of the clip under the playhead (topmost targeted track) into the Source Monitor, **at the same frame**, with In/Out matching the timeline clip's in/out. |
| **Reverse Match Frame** | Shift+R | From Source Monitor frame, finds that frame in the active sequence and moves the playhead there. |
| **Add Edit** | Ctrl+K / Cmd+K | Cut targeted tracks at playhead. |
| **Add Edit to All Tracks** | Ctrl+Shift+K / Cmd+Shift+K | Cut all tracks at playhead. |
| **Trim Edit** | Shift+T | Selects nearest edit on targeted tracks and opens Trim mode. |
| **Extend Selected Edit to Playhead** | E | |
| **Apply Video Transition** | Ctrl+D / Cmd+D | Default video transition at the selected edit(s) or edit nearest playhead on targeted tracks. |
| **Apply Audio Transition** | Ctrl+Shift+D / Cmd+Shift+D | Default audio crossfade. |
| **Apply Default Transitions to Selection** | Shift+D | Both, on selected clips' ends. |
| **Lift** | ; | |
| **Extract** | ' | |
| **Zoom In / Zoom Out** | = / - | Timeline zoom. |
| **Go to Gap > Next in Sequence / Previous in Sequence / Next in Track / Previous in Track** | — (assignable) | Jump playhead to gaps. |
| **Close Gap** | — | Closes all gaps in the sequence (between In/Out or entire) by rippling, respecting sync locks. |
| **Snap in Timeline** | S | |
| **Normalize Mix Track…** | — | Applies gain to master track to reach a target peak dB. |
| **Make Subsequence** | Shift+U | Creates a new sequence from the In/Out range of targeted tracks (clips copied, not nested). |
| **Auto Reframe Sequence…** | — | §40.19b. |
| **Simplify Sequence…** (23.x+) | — | Creates a cleaned copy of the sequence: removes inactive (disabled) clips, empty tracks, gaps; with options such as moving clips down to the lowest available track and keeping markers **(verify option list)**. |
| **Add Tracks… / Delete Tracks…** | — | Dialogs (§7.8). |
| **Captions > Add New Caption Track / Delete / Transcribe/ Create captions / Upgrade (old caption format)** | — | |
| **Scene Edit Detection** | — | (on Clip menu in some builds). |
| **Generate…/ Generative Media** (26.5) | — | Generative Media Tool entry **(verify menu location)**. |

---

## 35. Markers menu

| Item | Shortcut | What it does |
|---|---|---|
| **Mark In / Mark Out** | I / O | |
| **Mark Clip** | X | |
| **Mark Selection** | / | |
| **Mark Split > Video In / Video Out / Audio In / Audio Out** | — | Split (separate audio/video) In/Out points in Source Monitor for split edits (J/L cuts) — e.g., video In later than audio In. Clip shows separate shaded ranges. |
| **Go to In / Go to Out** | Shift+I / Shift+O | |
| **Go to Split > Video In/Out, Audio In/Out** | — | |
| **Clear In / Clear Out / Clear In and Out** | Ctrl+Shift+I / Ctrl+Shift+O / Ctrl+Shift+X (Mac Opt+I / Opt+O / Opt+X) | |
| **Add Marker** | M | |
| **Go to Next Marker / Go to Previous Marker** | Shift+M / Ctrl+Shift+M (Cmd+Shift+M) | |
| **Clear Selected Marker** | Ctrl+Alt+M / Opt+M | Removes marker at playhead/selected. |
| **Clear Markers** (all) | Ctrl+Alt+Shift+M / Opt+Cmd+M | Removes all markers of the active monitor's item. |
| **Edit Marker…** | — | Opens Marker dialog for marker at playhead. |
| **Add Chapter Marker…** | — | Marker dialog preset to Chapter. |
| **Add Flash Cue Marker…** | — | Legacy. |
| **Ripple Sequence Markers** (toggle) | — | When on, sequence markers move with ripple edits (insert, ripple delete, ripple trim) after the edit point. |
| **Copy Paste including Sequence Markers** (toggle) | — | When on, copying a range of clips includes sequence markers in that range; pasting adds them. |

---

## 36. Graphics and Titles menu

(Named "Graphics" in 2017–2023; renamed **Graphics and Titles** in 23.x.)

| Item | What it does |
|---|---|
| **Install Motion Graphics Template…** | Installs a .mogrt into local templates folder. |
| **New Layer > Text** (Ctrl+T / Cmd+T) | New text layer in selected graphic (or new graphic clip at playhead). |
| **New Layer > Vertical Text** | |
| **New Layer > Rectangle** (Ctrl+Alt+R / Cmd+Opt+R) | New rectangle shape layer. |
| **New Layer > Ellipse** (Ctrl+Alt+E / Cmd+Opt+E) | |
| **New Layer > Polygon** | |
| **New Layer > From File…** | Adds image/video as a layer inside graphic. |
| **Align to Video Frame > Left/Center/Right/Top/Center/Bottom** | Aligns selected layer to the frame. |
| **Align > (multiple layers)** / **Distribute** | Align/distribute selected layers relative to each other. |
| **Arrange > Bring to Front / Bring Forward / Send Backward / Send to Back** | Layer order. |
| **Select > Next Layer / Previous Layer** | Layer selection navigation. |
| **Upgrade to Master Graphic** | §11.2. |
| **Export As Motion Graphics Template…** | §11.2. |
| **Replace Fonts in Projects…** | Lists fonts used across project graphics; replace one font with another everywhere (also missing fonts). |
| **Upgrade Caption to Graphic** | Converts caption items into graphic clips (open captions → styled graphics). |
| **Upgrade Legacy Titles to Source Graphics** | Converts old titles (in 2023+ automatic). |

---

## 37. View menu

| Item | Shortcut | What it does |
|---|---|---|
| **Playback Resolution > Full/1/2/1/4/1/8/1/16** | — | Active monitor. |
| **Paused Resolution > …** | — | |
| **High Quality Playback** | — | |
| **Display Mode > Composite Video / Alpha / Multi-Camera / Comparison View / scopes** | — | |
| **Magnification > Fit / %** | — | Monitor zoom. |
| **Show Rulers** | — | Program Monitor rulers. |
| **Show Guides** | Ctrl+; / Cmd+; | |
| **Lock Guides** | Ctrl+Alt+; / Cmd+Opt+; | |
| **Add Guide…** | — | Dialog: position (px or %), orientation, color. |
| **Clear Guides** | — | |
| **Snap in Program Monitor** | Ctrl+Shift+; / Cmd+Shift+; | |
| **Guide Templates > Save Guides / Manage Guides / [saved templates e.g., Social media safe areas]** | — | Guide presets (Adobe ships e.g. vertical social UI overlays). |
| **Show Dropped Frame Indicator**, **Overlays**, **Safe Margins**, **Transparency Grid** **(verify)** | — | Monitor display toggles in some builds mirrored here. |

---

## 38. Window menu

| Item | What it does |
|---|---|
| **Workspaces > [list] / Reset to Saved Layout (Alt+Shift+0) / Save Changes / Save as New Workspace / Edit Workspaces / Import Workspace from Projects / Lock workspace** | §1. |
| **Extensions / UXP Plugins** | Third-party panels. |
| **Find Extensions on Exchange** | Opens Adobe Exchange. |
| **Maximize Frame** (Shift+`) / **Maximize panel** (`) | |
| Panel list (checked when open): **Audio Clip Effect Editor** (old), **Audio Clip Mixer** (Shift+9), **Audio Meters**, **Audio Track Effect Editor**, **Audio Track Mixer** (Shift+6), **Capture**, **Comments** (Frame.io), **Effect Controls** (Shift+5), **Effects** (Shift+7), **Essential Graphics / Graphics Templates**, **Essential Sound**, **Events**, **History**, **Info**, **Learn**, **Libraries**, **Lumetri Color**, **Lumetri Scopes**, **Markers**, **Media Browser** (Shift+8), **Metadata**, **Productions**, **Program Monitor** (Shift+4) [sequence list], **Progress**, **Project** (Shift+1) [list of open projects/bins], **Properties** (25.0+), **Reference Monitor**, **Review with Frame.io / Frame.io** (25.6), **Adobe Stock** (25.6), **Search** (25.2), **Sequence Index** (26.2), **Source Monitor** (Shift+2) [clip list], **Text**, **Timecode**, **Timelines** (Shift+3) [sequence list], **Tools**, **Workspaces** | Opening a closed panel puts it in its last/default location (often floating). |

---

## 39. Help menu and app menu

**Help**: Premiere Help (opens helpx), Premiere Tutorials / Learn, Keyboard (shortcuts reference), Release Notes / What's New, **Updates…** (Creative Cloud), **Provide Feedback** (Adobe Community/UserVoice), **System Compatibility Report** (GPU/driver/OS check with fixes; 26.3 added GPU/OS minimum alerts), **GPU / Diagnostics** (26.5 "faster access to diagnostic info" **(verify name)**), **Manage My Account**, **Sign In/Sign Out**, **About Premiere**, **Legal Notices**, **Show Log Files**, **Beta features / Labs** toggles in some builds.

**Mac app menu "Adobe Premiere"**: About, **Settings (Preferences)** submenu (Cmd+, opens General), Keyboard Shortcuts, Services, Hide, Quit (Cmd+Q).


---

## 40. Editing concepts

### 40.1 Sequences and Sequence Settings

A **sequence** is a timeline: a container of tracks and clips with fixed playback settings. A project can hold any number of sequences; sequences can be nested in each other.

**New Sequence dialog** (File > New > Sequence, Ctrl+N) has four tabs:

#### Sequence Presets tab

Preset groups (folders) by format: **ARRI**, **AVC-Intra**, **AVCHD**, **Canon XF**, **Digital SLR**, **DNxHD/DNxHR**, **DV - 24P/NTSC/PAL**, **DVCPRO50/HD**, **HDV**, **Mobile & Devices**, **RED R3D**, **Social Media** (Vertical 9:16, Square 1:1, 4:5 etc. — 2021+), **VR**, **XDCAM EX/HD/HD422**, **XAVC**, plus **Custom** user presets. Selecting a preset shows its description (editing mode, timebase, frame size, PAR, fields, audio settings). Best practice: drag a clip onto New Item to auto-match instead.

#### Settings tab

| Setting | Meaning / options |
|---|---|
| **Editing Mode** | Determines preview file formats and allowed frame sizes/rates: ARRI Cinema, AVC-Intra, Canon XF, Digital SLR, DNxHR/DNxHD, DV 24p/NTSC/PAL, DVCPROHD, HDV, RED Cinema, XDCAM, XAVC, **Custom** (any size/rate), etc. Locked after creation. |
| **Timebase** | Frame rate of the sequence: 10, 12, 12.5, 15, 23.976, 24, 25, 29.97 (DF/NDF), 30, 48, 50, 59.94, 60, 100, 119.88, 120 (Custom allows others). Locked after creation. |
| **Video: Frame Size** | Horizontal × Vertical pixels. Custom mode allows up to 16,384 × 16,384 in current versions **(verify; older versions capped lower)**. The resulting frame aspect is shown. |
| **Pixel Aspect Ratio** | Square Pixels (1.0), D1/DV NTSC (0.9091), D1/DV NTSC Widescreen 16:9 (1.2121), D1/DV PAL (1.0940), D1/DV PAL Widescreen (1.4587), Anamorphic 2:1 (2.0), HD Anamorphic 1080 (1.333), DVCPRO HD (1.5). |
| **Fields** | No Fields (Progressive Scan), Upper Field First, Lower Field First. |
| **Display Format (video)** | 30 fps Drop-Frame Timecode, 30 fps Non Drop-Frame, Frames, Feet + Frames 16mm/35mm (options depend on timebase). |
| **Working Color Space** (pre-25 "Working Color Space" / 25.x Color tab) | Rec.709, Rec.2100 HLG, Rec.2100 PQ; 25.x Wide Gamut options; tone mapping. |
| **Audio: Sample Rate** | 32000, 44100, **48000** (default), 88200, 96000 Hz. |
| **Audio: Display Format** | Audio Samples or Milliseconds (when audio time units shown). |
| **Video Previews: Preview File Format** | Depends on editing mode: e.g., I-Frame Only MPEG, **QuickTime**, **Apple ProRes 422 (and variants: Proxy/LT/HQ/4444/4444 XQ)**, **GoPro CineForm**, **DNxHR/DNxHD**, Microsoft AVI (Win). |
| **Codec** | e.g., ProRes 422, ProRes 422 HQ, CineForm, DNxHR LB/SQ/HQ/HQX/444. |
| **Preview Width / Height** | Preview render resolution (can be lower than sequence for faster renders; "Reset" restores). |
| **Maximum Bit Depth** | When checked, effects are rendered at highest available depth (32-bit float for 32-bit effects) during previews/playback (more accurate, slower). |
| **Maximum Render Quality** | Uses higher-quality scaling (Lanczos/bicubic-style) when resizing frames; matters for scaled-down/up footage; more memory. On GPU-accelerated renderer, MRQ is effectively always on for GPU scaling. |
| **Composite in Linear Color** (GPU) | Blending done in linear light (affects cross dissolves/opacity blending appearance). |
| **Save Preset…** | Saves settings as a custom preset (name, description). |

#### Tracks tab

- **Video: number of tracks** (default 3).
- **Audio: Mix** (master track type): Stereo, 5.1, Multichannel (N channels), Mono.
- Audio tracks list: per-track name, **Track Type** (Standard, Mono, 5.1, Adaptive) and Pan/Balance; **Add/Remove** tracks. Submix tracks can also be defined.
- **Save Preset** includes track setup.

#### VR Video tab

Projection (Equirectangular), Layout (Monoscopic, Stereoscopic Over/Under, Side by Side), Captured view horizontal/vertical degrees.

#### Behaviors

- After creation, open **Sequence > Sequence Settings…** to edit allowed fields. Changing frame size doesn't rescale existing clips (they keep their scale values).
- **Preview files are invalidated** when changing settings that affect rendering.
- **Social / vertical**: 25.x workspace "Vertical"/Auto Reframe supports 9:16, 4:5, 1:1.

### 40.2 Source/Program edit model: three-point editing

Premiere uses the classic **three-point editing** model: of the four possible marks (Source In, Source Out, Sequence In, Sequence Out), you set **three** and Premiere computes the fourth.

| Marks set | Behavior |
|---|---|
| Source In + Source Out + Sequence In | Clip range placed starting at Sequence In. |
| Source In + Source Out + Sequence Out | Placed so it **ends** at Sequence Out ("backtiming"). |
| Source In + Sequence In + Sequence Out | Duration taken from sequence range; source Out computed. |
| Source Out + Sequence In + Sequence Out | Source In computed backwards. |
| Fewer than three marks | Defaults: no source In = clip start; no source Out = clip end; no sequence In = **playhead position**; no sequence Out = determined by source duration. |
| **Four marks (four-point edit)** | If durations match, edit proceeds. If not, the **Fit Clip** dialog asks: **Change Clip Speed (Fit to Fill)**, Ignore Source In, Ignore Source Out, Ignore Sequence In, Ignore Sequence Out. |

**Sequence In/Out take precedence over playhead.** Edits go to **source-patched tracks** (§7.5). After an edit, sequence In/Out are cleared and the playhead moves to the end of the new clip.

**Edit methods**: Source Monitor buttons, , and . keys, dragging from Source/Project to timeline (drag position determines placement; Ctrl for insert), dragging onto Program Monitor overlay (§5.6), **Drag Video Only / Drag Audio Only** icons, **Automate to Sequence**, Text panel transcript Insert/Overwrite, Paper Edit (26.5).

### 40.3 Insert vs Overwrite

| | **Insert** (,) | **Overwrite** (.) |
|---|---|---|
| Effect on existing material | Pushes all material after the edit point to the right by the clip duration (ripple) on **all sync-locked tracks**, splitting clips that span the edit point. | Replaces whatever occupies the range on the patched tracks. Nothing shifts. |
| Sequence duration | Increases by clip duration. | Unchanged unless editing past the end. |
| Sync | Maintained across sync-locked tracks; non-sync-locked tracks don't move (can go out of sync). | Unaffected. |
| Typical use | Adding a shot in the middle of a story. | B-roll over A-roll, replacing shots. |

Related: **Overlay** (top empty track), **Replace** (same duration, attributes kept), **Fit to Fill** (speed change to fit), **Append** (end), **Insert after current clip** (Program overlay).

### 40.4 Lift vs Extract; Ripple Delete

| Operation | Result |
|---|---|
| **Lift** (;) | Remove **sequence In-Out range** on **targeted** tracks; **gap remains**. |
| **Extract** (') | Removes the range on targeted tracks and **closes the gap**. Every other sync-locked track is shifted left by the same duration, which means material inside that range on those tracks is **also removed**, keeping everything after the edit in sync. |
| **Clear** (Delete) | Remove **selected clips**; gap remains. |
| **Ripple Delete** (Shift+Delete, or Delete on a selected gap) | Remove selected clips and close the gap. Only possible if no clip on other sync-locked tracks would collide; otherwise Premiere only closes as far as possible / refuses. |
| **Close Gap** (Sequence menu) | Closes all gaps. |
| **Delete gaps from transcript** (Text panel) | Ripple deletes pauses. |

> Note on Extract: In Premiere, extract with sync lock on other tracks shifts those tracks left by the extracted duration; any material from those tracks lying inside the extracted range is **removed** (cut out) so everything after stays in sync. Turn sync lock off on tracks you want untouched (they then go out of sync relative to the rest).

### 40.5 Trimming types

| Trim | Tool / method | What changes | Sequence duration |
|---|---|---|---|
| **Regular (Trim In/Out)** | Selection tool on clip edge (red bracket) | One clip's In or Out; leaves/consumes a gap; cannot overwrite neighbor | Changes only if at end |
| **Ripple** | Ripple Edit tool (B), Ctrl+Selection, Q/W keys | One clip's edge, and everything after shifts | Changes |
| **Roll** | Rolling Edit tool (N), E (extend) | Out of A and In of B together (cut point moves) | Unchanged |
| **Slip** | Slip tool (Y), Ctrl+Alt+arrows | Clip's In and Out together (content shifts within fixed slot) | Unchanged |
| **Slide** | Slide tool (U), Alt+,/. | Clip position moves; neighbors' adjacent edges roll | Unchanged |
| **Rate Stretch** | Rate Stretch tool (R) | Clip duration via speed change | Changes (like regular trim) |
| **Asymmetric trim** | Select edits on multiple tracks with different sides (Shift-click with ripple tool) | Mixed ripple directions | Depends |

Trim handles: you can only extend a clip into media that exists beyond its current In/Out (**handles**). Generative Extend (25.2+) can synthesize extra frames beyond the media end.

**Trim Preferences**: Large Trim Offset (default 5 frames; audio offset in ms/samples), "Allow Selection tool to choose Roll and Ripple trims without modifier key" (when on, the Selection tool shows ripple/roll cursors depending on hover position at an edit).

### 40.6 Trim Mode & dynamic trimming

- **Trim mode** (Program Monitor becomes Trim Monitor, §5.7): entered by double-clicking an edit point, or **Shift+T**. Selected edit point type (in/out/roll/ripple) determines the trim.
- **Keyboard trim**: Ctrl+Left/Right (1 frame), Ctrl+Shift+Left/Right (Large Trim Offset), or numeric `+n`/`-n` Enter.
- **Dynamic trimming**: while in Trim mode, use **J/K/L** — playback runs and the edit point **moves with playback**; press **K** to stop; the edit point is set where you stop (in real-time). **Loop** toggles loop playback around the edit for review.
- **Playing the edit**: Space = Play Around the edit with preroll/postroll.
- **Multi-track trimming**: Shift-click additional edit points (on other tracks) before trimming; all trim together; linked A/V edits trim together unless Alt-clicked.
- **Exit Trim mode** by clicking elsewhere / moving playhead / pressing Esc.

### 40.7 J-cuts and L-cuts (split edits)

A **split edit** is where audio and video of a shot start or end at different times:

- **J-cut**: incoming clip's **audio starts before** its video (audio leads) — on timeline looks like a "J".
- **L-cut**: outgoing clip's **audio continues after** the video cuts to the next shot — "L".

Ways to make them in Premiere:
1. **Alt/Opt-drag** (or use Rolling Edit tool with Alt held) on the **video-only or audio-only** edit point of linked clips to roll just one component.
2. Turn **Linked Selection off**, then roll the video edit with the Rolling tool (N).
3. Use **Mark Split** (Markers > Mark Split > Video In/Audio In…) in the Source Monitor before editing so the clip is edited with offset A/V ins.
4. Select only the audio edit (Alt-click) and press **E** at a playhead position (extend edit).

### 40.8 Linked / unlinked clips; groups; merged clips

- **Linked clips**: video + audio from the same master (or linked manually with Clip > Link). Selected/moved/trimmed together (when Linked Selection on). Names shown; out-of-sync numbers appear when moved apart.
- **Unlink** (Ctrl+L) makes them independent. Premiere still knows they came from the same source, so out-of-sync numbers keep showing when they drift, as long as Preferences > Timeline > "Display out of sync indicators for unlinked clips" is on.
- **Link** requires items on different tracks; can link one video with many audio clips.
- **Grouping** (Ctrl+G) is different: groups any clips (including multiple video clips) to move/trim them together; effects cannot be applied to a group as a unit (applied to each).
- **Merged clips** (Clip > Merge Clips) create a single master clip from separate video and audio (dual-system sound), synchronized; edits like a normal A/V clip.
- **Synchronize** aligns already-placed clips (timecode, markers, audio waveform).
- Clip **captions** link to A/V too (2021+).

### 40.9 Nesting

- **Nest** (right-click > Nest… or Clip > Nest): selected clips are moved into a **new sequence** (named "Nested Sequence 01" by default), and a single clip of that sequence replaces them in the timeline. The nested sequence item appears in the Project panel (green label by default).
- **Dragging a sequence** into another sequence also creates a nest (when the "Insert/overwrite sequences as nests" toggle is on).
- **Nest behavior**: Effects applied to the nest clip affect the whole composite. Editing inside the nest (double-click to open) updates all instances. Nested sequence clip duration is limited to the nested sequence's length (can't extend beyond its end; adding content inside the nest doesn't automatically lengthen instances already trimmed).
- **Nests and audio**: the nested clip's audio becomes a single clip whose channel count matches the nested sequence's master (e.g., stereo, or multichannel/adaptive).
- **Open a nested sequence**: double-click the nest clip. **Reveal Nested Sequence** (Ctrl+Shift+F / Cmd+Shift+F **(verify)**) opens the nest in its own Timeline at the frame matching the playhead. **Match Frame (F)** on a nest clip loads the nested sequence into the Source Monitor at the matching frame. **Reveal in Project** selects the nested sequence item in the Project panel.
- Nesting is used for: applying one effect across multiple clips, grouping complex composites, picture-in-picture building, multicam (multicam source sequences are a special nest), reframing (Auto Reframe nests clips).

### 40.10 Multi-camera editing

1. **Create Multi-Camera Source Sequence…** (select clips in Project panel → right-click): dialog:
   - **Name**: Use video clip name / audio clip name / custom.
   - **Synchronize Point**: **In Points**, **Out Points**, **Timecode** (with "Ignore Hours", "Create single multi-camera source sequence" for multiple sync groups), **Clip Marker**, **Audio** (waveform analysis; choose Track Channel).
   - **Sequence Preset**: Automatic (matches first clip) or a preset.
   - **Audio**: Sequence Settings — **Camera 1**, **All Cameras** (5.1/Adaptive with all channels), **Switch Audio** (audio follows video angle), **Audio Channels Preset**: Automatic, Mono, Stereo, 5.1, Adaptive.
   - **Camera Names**: Enumerate angles / use track names / use clip names.
   - **Processed Clips**: Move source clips to Processed Clips bin.
   - "Create Multi-Camera Source Sequence" makes a special sequence item (multicam icon) where each angle is on its own video track.
2. **Edit**: create a sequence from it (right-click > New Sequence From Clip) or edit it into an existing sequence. The multicam clip in the timeline is a **nested multicam clip** (with "MC1", angle name).
3. **Program Monitor** → **Toggle Multi-Camera View** (Shift+0). Left: grid of angles (2×2, 3×3, 4×4 depending on count — Settings > Multi-Camera > "Edit Cameras" to reorder/enable angles); right: program.
4. **Live switching**: play the sequence (Space); press **1–9** (numbers top row) or click angles to cut — Premiere records cuts as edit points on the multicam clip (if **Multi-Camera Record On/Off** toggle enabled, key 0). Stop playback → cuts appear.
5. **Refine**: use Rolling Edit to move cuts; select a segment and press a number (or Clip > Multi-Camera > Camera N) to **switch angle**; Ctrl+click an angle in multicam view switches the angle of the segment under playhead without adding an edit (**verify**).
6. **Audio follows video** option (Timeline panel menu: Multi-Camera Audio Follows Video) when using Switch Audio.
7. **Effects** on the angle vs on the nest: applied to the multicam clip, effects stay with the clip segment (not angle) — to grade an angle, open the multicam source sequence and apply to the clip on that angle's track.
8. **Flatten** (right-click > Multi-Camera > Flatten): replaces multicam segments with the actual source clips of the active angle (keeps edits; effects preserved).
9. **Selection follows playhead** option helps when switching angles.
10. Multicam view settings (Program Monitor wrench > Multi-Camera / Edit Cameras): camera order, enabled angles, angle name overlays, mono/color display.

### 40.11 Subclips

- Created from the Source Monitor In/Out (Clip > Make Subclip / Ctrl+U, or Ctrl-drag from Source Monitor to Project panel, or in timeline right-click > Make Subclip).
- A subclip is a **reference to a portion of the master clip** — no new media. Has its own name, In/Out, markers (shared with master), and can have **Restrict Trims To Subclip Boundaries** (if checked, timeline instances cannot be trimmed beyond subclip start/end; unchecked allows extending into master media).
- **Edit Subclip** dialog changes boundaries or **Convert to Master Clip**.
- Subclips relink with master: making the master offline makes subclips offline.
- Useful for organizing selects/logging. Project Manager consolidation treats subclips by their ranges.

### 40.12 Rendering, render bars, preview files, Render & Replace

#### Render bar colors (under the timeline ruler)

| Color | Meaning |
|---|---|
| **None (no bar)** | Section is native/simple and should play in real time with no rendering (e.g., cuts of supported codecs at sequence settings). Some versions show nothing for "no render required". |
| **Yellow** | Unrendered but **likely to play in real time** without rendering (Mercury Playback Engine GPU-accelerated effects, supported codecs). Rendering optional. |
| **Red** | Unrendered and **probably needs rendering** to play in real time at full frame rate (non-accelerated effects, unsupported codec/resolution mismatches, heavy effects). |
| **Green** | **Rendered** — a preview file exists for the section; playback uses it. |
| (Audio) | Audio render bar segments appear when audio previews are rendered (separate thin bar in older versions). |

- Rendered previews are stored in the **Video Previews** scratch disk (Project Settings > Scratch Disks) in the sequence's **Preview File Format** (Sequence Settings > Video Previews).
- **Render Effects In to Out** (Enter): renders red sections in range. **Render In to Out**: renders red and yellow. **Render Selection**: selected clips only. **Render Audio**: audio previews.
- Changing a clip invalidates (red/yellow returns) only that section. **Undo restores** previews if files still exist (preview files are kept until deleted, so undoing an effect change turns bars green again).
- **Use Previews** in Export: reuses preview files for export (faster, quality depends on preview codec — e.g., ProRes 422 HQ previews are near-lossless).
- **Delete Render Files** / **Delete Render Files In to Out** remove previews.
- **Smart rendering**: exporting in the same codec as the previews/source (e.g., ProRes, DNx, XDCAM, some H.264 not) re-wraps unchanged frames without re-encoding.

#### Render and Replace

Clip > **Render and Replace…** (for selected timeline clips — often Dynamic Link AE comps, heavy clips, or nested):

| Option | Meaning |
|---|---|
| **Source**: Sequence (inherits sequence settings) / Clip (inherits clip settings) | Size/fps of the rendered file. |
| **Format / Preset** | e.g., QuickTime ProRes 422 HQ, DNxHR, CineForm, with alpha options. |
| **File location** | Same as project / custom. |
| **Include Video Effects** | Bakes clip effects into the render (otherwise only source). |
| **Handles** | Extra frames rendered before/after for trims. |

The clip is replaced by the rendered media file (new master clip in project, original kept). **Restore Unrendered** reverts to the original (e.g., AE comp).

### 40.13 Proxies & Ingest settings

**Ingest Settings** (File > Project Settings > Ingest Settings, or wrench next to Ingest in Media Browser / New Project screen):

| Ingest option | Behavior |
|---|---|
| **Copy** | Copies media to Primary Destination (e.g., a project media folder) on import, with optional MD5 verification; Premiere links to the copy. |
| **Transcode** | Transcodes media to a preset (e.g., ProRes 422, DNxHR) in Primary Destination; links to transcoded files. |
| **Create Proxies** | Creates lower-res proxy files (preset, Proxy Destination) via **Adobe Media Encoder** in background; attaches them automatically. |
| **Copy and Create Proxies** | Both. |

Presets: Adobe-provided ingest presets (e.g., "Apple ProRes Low Resolution Proxy", "H.264 Low Resolution Proxy", "CineForm Low Resolution Proxy", "GoPro CineForm", "DNxHR LB"), plus custom presets created in Media Encoder (with "Create ingest preset" in AME "Create proxy preset").

**Proxy workflow**:
1. **Create Proxies…** (right-click clips > Proxy > Create Proxies): Format (H.264, QuickTime/ProRes, CineForm, DNxHR), Preset (resolution 1024×540, 1280×720, etc.), Add Ingest Preset, Destination (next to original media in a Proxy folder, or custom); AME queues jobs (Premiere auto-starts AME).
2. **Attach Proxies…** to manually attach existing proxy files (matched by name; same duration; audio channels must match).
3. **Toggle Proxies** button in Program/Source Monitor switches playback between proxy and full res (global setting). Enable proxy button via Button Editor.
4. **Reconnect Full Resolution Media…** relinks the high-res behind a proxy.
5. Proxy aspect ratio may differ (e.g., proxy at 1/4 size): Premiere scales proxy to full-res frame size so effects/positions remain valid.
6. **Export** uses full-resolution media unless "Use Proxies" is checked in export settings.
7. Project panel **Proxy** column shows "Attached".
8. Preferences > Media has the "Enable proxies" switch (the same global state as the Toggle Proxies button).

### 40.14 Playback resolution vs proxies vs previews

| Mechanism | What it does |
|---|---|
| **Playback Resolution** (1/2, 1/4…) | Decodes/renders at reduced resolution on the fly (no files). |
| **Paused Resolution** | Same for paused frames. |
| **Proxies** | Separate low-res, edit-friendly files replace high-res during editing. |
| **Previews (render)** | Pre-rendered files of the composite for sections of a sequence. |
| **Ingest transcode** | Premiere has no separate "optimized media" concept like Resolve; Ingest > Transcode (or Project Manager) creates edit-friendly mezzanine files that fully replace the originals. |

### 40.16 Synthetic media (File > New / Project panel New Item)

All synthetic items are created at chosen width/height/timebase/PAR (dialog prefilled with active sequence settings).

| Item | Description |
|---|---|
| **Bars and Tone** | SMPTE color bars plus a 1 kHz reference tone (level adjustable with Audio Gain) **(verify default dBFS)**. Placed at the head of a master for calibration. |
| **HD Bars and Tone** | ARIB/SMPTE HD color bars (75%/100% patches, PLUGE) plus a 1 kHz tone **(verify default dBFS)**. |
| **Black Video** | Solid black clip (duration = still default duration). Fully opaque. Useful as a filler/fade base. |
| **Color Matte** | Solid color clip (color picker + name). Change color later by double-clicking in Project panel. |
| **Transparent Video** | Clip with **no pixels** (fully transparent); exists to host effects that generate their own output (e.g., Timecode effect, Lightning, Grid, Write-on) on a track. |
| **Universal Counting Leader** | Countdown leader (8-to-2) with settings: Wipe Color, Background Color, Line Color, Target Color, Numeral Color, **Cue Blip on Out** (frame before end), **Cue Blip on 2** (2-pop), **Cue Blip at all Second Starts**. 11 seconds long by default. Double-click to edit. |
| **Adjustment Layer** | Transparent clip; effects applied to it affect **all tracks below it** within its duration (respecting its Opacity/blend mode and masks). Can be trimmed/keyframed like a clip. Label: purple-ish by default. Used for global grading, look application, transitions effects, track-wide blurs. |
| **Offline File** | Placeholder clip that will be relinked later. |
| **Captions** (older New > Captions) | Caption item with format (CEA-608/708, Teletext, Open Subtitles…), frame size, timebase. |
| **Photoshop File** | New PSD. |
| **Shared Project / Sequence** | |

### 40.17 Interpret Footage & Modify Clip

**Interpret Footage** (Clip > Modify > Interpret Footage, or right-click in Project panel) affects **master clips** and **all instances**:

| Section | Options |
|---|---|
| **Frame Rate** | **Use Frame Rate from File** or **Assume this frame rate:** (e.g., interpret 59.94p footage as 23.976 → slow motion that plays 40% speed; duration changes). "Remove 24p DV pulldown" for 24pa DV. |
| **Pixel Aspect Ratio** | **Use Pixel Aspect Ratio from File** or **Conform to:** list (Square, D1/DV NTSC, PAL, widescreen, anamorphic 2:1, HD Anamorphic 1080 (1.333), DVCPRO HD (1.5)…). |
| **Field Order** | Use from file / Conform to: No Fields (Progressive), Upper First, Lower First. |
| **Alpha Channel** | Premultiply Alpha (interpret straight vs premultiplied), **Ignore Alpha Channel**, **Invert Alpha Channel**. |
| **VR Properties** | Conform to: None / Equirectangular; Layout (Monoscopic, Stereoscopic O/U, S/S); captured view. |
| **Color Management (25.x)** | **Color Space Override** (e.g., interpret as Rec.709, Rec.2100 HLG/PQ, camera log spaces like S-Log3/S-Gamut3.Cine, LogC3/4, V-Log, C-Log2/3, F-Log, N-Log), **Input LUT** (legacy), **Log/raw handling**, **Max Content Light Level / HDR graphics white** **(verify fields)**. Pre-25: "Color Space Override" + "Input LUT" fields (since 22.x). |

**Modify > Audio Channels** (Shift+G): Clip Channel Format (Mono, Stereo, 5.1, Adaptive), Number of audio clips, channel mapping matrix (which media source channel feeds which clip channel; checkbox grid), Preset (Use File, Mono, Stereo, 5.1, Adaptive). Common use: split a 2-channel recording into two mono clips (e.g., lav + boom), or make a stereo mic act as dual mono.

**Modify > Timecode**: Timecode Source: File timecode or Alternate timecode (set start TC, Time Display format, Tape Name, "Reset to Original"). Used to align footage TC for multicam.

### 40.18 Speed/Duration, reverse, time remapping, frame hold

#### Speed/Duration dialog (Ctrl+R)

| Field | Behavior |
|---|---|
| **Speed** (%) | 100% = normal; below 100 = slow motion; above 100 = fast. The dialog accepts roughly 0.01% to 10,000% **(verify limits)**. |
| **Duration** | Linked with speed via **chain link** toggle: when linked, changing speed changes duration (and vice versa); when unlinked, change one independently (changing duration without speed = trims). |
| **Reverse Speed** | Plays backward (shows "-100%"). |
| **Maintain Audio Pitch** | Time-stretch audio keeping pitch (pitch-preserving algorithm). |
| **Ripple Edit, Shifting Trailing Clips** | When on, duration changes push/pull later clips; when off, a slowed clip that would overlap is **cut short** (it stops at the next clip), leaving content truncated; sped-up leaves a gap. |
| **Time Interpolation** | Frame Sampling / Frame Blending / Optical Flow (same as Clip > Video Options). |

Applies to multiple selected clips at once (each clip's speed set; with ripple, clips stay contiguous).

#### Rate Stretch tool (R)

Drag clip edge to set duration; speed derived.

#### Time Remapping (variable speed, keyframed)

- In the timeline clip's fx badge menu, choose **Time Remapping > Speed**; the rubber band now represents speed (100% at mid-height).
- **Ctrl/Cmd-click** the speed rubber band with the Selection or Pen tool to add speed keyframes. Drag the band between two keyframes up or down to change that segment's speed. The clip's duration changes accordingly. Time remapping **does not ripple**: speeding up leaves a gap; slowing down lengthens the clip only into empty space and does not overwrite the next clip, so the remaining content is cut off at the neighbor **(verify)**.
- **Speed ramps**: a speed keyframe has two halves. Drag one half away from the other to create a **gradual ramp** between the two speeds; a Bézier handle appears on the ramp to set its easing. **Alt/Opt-drag** moves the whole keyframe without splitting it.
- **Reverse segment**: Ctrl+drag a keyframe to the right creates a reverse playback segment (forward/backward/forward "boomerang"); shown with "<<<" marks.
- **Freeze frame**: Ctrl+Alt+drag (Cmd+Opt) a keyframe creates a **hold** segment (stair-step markers).
- Time remapping applies to **video** only — audio is unlinked behaviorally (linked audio does not follow; Premiere warns / audio stays at 100%).
- The Time Remapping > Speed property is also shown and keyframable in Effect Controls. Once a clip has time-remapping keyframes, **Speed/Duration** is unavailable for it **(verify)**; remove the keyframes (turn off the stopwatch) to use the dialog again.
- Enable/disable time remap via Effect Controls fx toggle.

#### Frame hold

- **Add Frame Hold**: splits at playhead, holds that frame till clip end.
- **Insert Frame Hold Segment**: inserts 2-second hold at playhead, ripple.
- **Frame Hold Options**: whole-clip hold at In point / Out point / Marker 0 / source or sequence timecode; **Hold Filters** (effects stop animating); **Deinterlace**.
- **Export Frame** + import is the old-school way.

### 40.19 Scene Edit Detection

Right-click a clip in a sequence > **Scene Edit Detection…** (or Clip menu). Uses Sensei to find camera cuts in a flattened (pre-edited) video:

| Option | Result |
|---|---|
| **Apply a cut at each detected cut point** | Adds through edits in the timeline clip at each detected scene change. |
| **Create a Subclip bin for each detected cut point** | Makes subclips for every scene in a new bin. |
| **Generate markers at each detected cut point** | Adds clip markers. |

Runs as a background task; works on clips (not nests); later builds can run on multiple clips. Useful for re-editing finished videos, archival content, or color grading a flattened export shot-by-shot.

#### 40.19b Auto Reframe

**Sequence > Auto Reframe Sequence…** (or apply the **Auto Reframe** effect to a clip):

| Option | Meaning |
|---|---|
| **Target Aspect Ratio** | Square 1:1, Vertical 4:5, Vertical 9:16, Horizontal 16:9, Custom. |
| **Motion Tracking** | **Slower Motion** (smooth, for static/slow content), **Default**, **Faster Motion** (follows fast action). |
| **Clip Nesting** | **Nest clips** (each clip nested to preserve applied effects/motion) or **Don't Nest Clips** (apply directly). |

Creates a **new sequence** (duplicated, name with aspect suffix) at the new frame size, and applies **Auto Reframe** effect with keyframed Position (tracked subject). The Auto Reframe effect has **Reframe Offset**, **Reframe Rotation**, **Reframe Scale**, **Motion Preset**, **Generate Keyframes** (convert to Motion keyframes for manual edits — then effect replaced), **Analyze**. Graphics/captions are not reframed (repositioned manually).

### 40.20 Media management: Replace Footage, Make Offline, Link Media

| Command | What it does |
|---|---|
| **Replace Footage…** (Project panel right-click, Ctrl+H / Cmd+H) | Replaces the file behind a master clip; every instance updates. Option: **Rename clip to file name**. Instances keep the same frame offsets from the media start, so the replacement should have the same length and frame rate to line up. |
| **Make Offline…** | Disconnects clips from media. Dialog: **Media Files Remain on Disk** or **Media Files Are Deleted**. Clips show as offline (red frames, "Media Offline"). Useful before relinking to new media or for archiving. |
| **Link Media…** | **Link Media dialog**: lists offline clips with Clip Name, File Name, File Path, Media Start, Tape Name, Description, Scene, Shot, Log Note, Video In/Out, Media Frame Rate, **Matching options** (match by file properties: File Name, File Extension, Media Start, Tape Name, Description, Scene, Shot, Media ID, Clip Name (checkboxes)), **Align Timecode**, **Relink others automatically** (checked: once one file found, others in same folder relinked), **Use Media Browser to locate files** (uses Media Browser-style locate dialog instead of OS dialog). Buttons: **Locate**, **Search** (searches path), **Offline**, **Offline All**, **Cancel**, **OK**. Locate dialog: **Display Only Exact Name Matches**, **Search** button (recursive search from folder), last path / file path shown for comparison, **Align Timecode / Preserve Interpret Footage / Relink Others Automatically / Display Only Exact Name Matches / Match file properties / Validate Frame Rate**. 26.2 improved auto-reconnection (path tracking across drives and Mac/Win platforms). |
| **Edit Offline…** | Edits offline placeholder metadata. |
| **Attach Proxies / Reconnect Full Resolution** | §40.13. |

**Media Offline** behavior: clips stay in sequence with all edits/effects; Program shows red "Media Offline" frame with localization text; render bars invalid. Opening a project with missing media triggers the **Link Media** dialog automatically.

### 40.21 Project Manager (Consolidate and Transcode)

File > **Project Manager…**:

| Option | Behavior |
|---|---|
| **Sequence** | Checkbox list of sequences to include (nested sequences included automatically). |
| **Resulting Project**: **Collect Files and Copy to New Location** | Copies only media used in selected sequences (or entire files) to a destination folder + new project. |
| **Resulting Project**: **Consolidate and Transcode** | Transcodes used media into a new format. Source: **Sequences** (transcodes each clip's used portion plus handles) or **Individual clips**. Format/Preset from Media Encoder presets (e.g., ProRes 422, DNxHR HQ, CineForm). |
| **Options**: **Exclude Unused Clips** | Only clips used in selected sequences. |
| **Include Handles** | N frames before/after each used portion (when trimming). |
| **Include Audio Conform Files** | Copy conformed audio cache (avoid re-conforming). |
| **Convert Image Sequences to Clips** | Image sequences become a single video file. |
| **Include Preview Files** | Copy rendered previews (only with Collect & Copy). |
| **Rename Media Files to Match Clip Names** | Renames copied files to project clip names. |
| **Convert After Effects Compositions to Clips** | Renders Dynamic Link comps to media. |
| **Preserve Alpha** | Preserve alpha when transcoding (choose alpha-capable codec). |
| **Destination Path** + **Disk Space** | Shows original project size vs resulting estimated size ("Calculate"). |

Notes: trimming (with handles) applies to most formats; some long-GOP or raw formats copy whole files. Sequences pointing to subclips/merged clips/multicam are handled (multicam sources included). Project Manager **does not** include media used only in bins (if Exclude Unused Clips on).

### 40.22 Productions, Team Projects, Shared Projects, Frame.io

| System | Description |
|---|---|
| **Productions** (14.0+) | Folder-based multi-project framework on shared storage; project locking; cross-project references; shared scratch disks (§28). Recommended for large/feature/episodic. |
| **Team Projects** (CC 2017+) | Cloud-hosted projects (Creative Cloud) — collaborators **share changes** (blue arrow) and **get changes** (download); version history ("Team Projects auto-saves" and "Revert to version"), conflict resolution (keep mine / keep theirs), Team Project Media Management (media stays local; collaborators relink or use proxies). Adobe has de-emphasized Team Projects in favor of Productions + Frame.io **(verify end-of-life status in 2025–2026)**. |
| **Shared Projects** (Premiere 2018) | On local shared storage, project files referencing another project's items with lock-based editing; superseded by Productions. |
| **Frame.io** (23.x integrated; 25.6 native panel; 26.0 V4) | Review and approval: upload sequences, frame-accurate comments become markers, camera-to-cloud ingest, Frame.io Drive (2026). |
| **Premiere on iPhone** (2025) | Mobile app; projects transfer to desktop (25.6+). |

### 40.23 Other editing concepts quick list

| Concept | Premiere behavior |
|---|---|
| **Match Frame (F) / Reverse Match Frame (Shift+R)** | §34. |
| **Gaps** | Selectable timeline objects; Delete ripples. **Go to Gap** commands. |
| **Through edits** | Razor cuts with continuous source; Join Through Edits. |
| **Snapping to playhead during trims** | With Snap on. |
| **Edit point selection with keyboard** | Up/Down arrows move between edits; **Shift+T** opens Trim mode at the nearest edit on targeted tracks. |
| **Swap edit** | Ctrl+Alt (Cmd+Opt) drag a clip onto another position — extract & insert. |
| **Overwrite edit from timeline drag** | Default. |
| **Paste Attributes** | Copy effects/intrinsics between clips. |
| **Effect presets** | Saved in Effects > Presets; drag onto clips. |
| **Master clip effects** | Apply in Source Monitor (applies to every instance). |
| **Morph Cut** | Video transition that smooths jump cuts in interviews (analysis in background; "Analyzing in background" banner). |
| **Warp Stabilizer** | Stabilization effect (analysis); requires clip be same size as sequence or nested (it refuses on speed-changed clips — "Warp Stabilizer requires clip dimensions to match sequence" — nest to fix). |
| **Audio Gain vs Volume** | Gain = clip-level pre-effect (dialog G); Volume = effect property keyframable; Track volume = mixer. |
| **Keyframe rubber bands on clips** | Ctrl/Cmd-click with Selection tool adds keyframe (Pen tool not required). |
| **Ripple Sequence Markers** | Markers menu toggle. |
| **Sequence nesting levels for export** | Export a nested sequence directly. |
| **Work area / In-Out export** | Export range uses sequence In/Out. |
| **Generative Extend** | Extend clip beyond media (§29.3). |
| **Object Mask** | 26.0+ (Effect Controls masks). |
| **Paper Edit** | 26.5+ (§25.1). |
| **OTIO** | 26.0 interchange. |


---

## 41. Default keyboard shortcut reference

**Edit > Keyboard Shortcuts…** (Ctrl+Alt+K / Cmd+Opt+K) opens a visual keyboard: purple keys = application shortcuts, green keys = panel-specific shortcuts, purple/green striped = both. The dialog has a command list (search, filter by Application or a specific panel), drag-to-assign, conflicts warning, presets (Adobe Premiere Pro Default, Avid Media Composer, Final Cut Pro 7, custom), "Save As", "Copy to Clipboard" (Win) to export a list. Shortcuts listed as Win / Mac.

### 41.1 Transport & navigation

| Command | Win | Mac |
|---|---|---|
| Play/Stop | Space | Space |
| Shuttle left / stop / right | J / K / L | J / K / L |
| Step back / forward 1 frame | Left / Right | Left / Right |
| Step back / forward 5 frames | Shift+Left / Shift+Right | Shift+Left / Shift+Right |
| Play In to Out | Ctrl+Shift+Space | Opt+K |
| Play Around | Shift+K | Shift+K |
| Loop | Ctrl+L | Cmd+L |
| Go to sequence start / end | Home / End | Home / End |
| Go to previous / next edit point (targeted) | Up / Down | Up / Down |
| Go to previous / next edit point (any track) | Shift+Up / Shift+Down | Shift+Up / Shift+Down |
| Go to In / Out | Shift+I / Shift+O | Shift+I / Shift+O |
| Go to next / previous marker | Shift+M / Ctrl+Shift+M | Shift+M / Cmd+Shift+M |
| Toggle audio scrubbing | Shift+S | Shift+S |
| Toggle full screen | Ctrl+` | Ctrl+` |
| Maximize panel under cursor | ` | ` |

### 41.2 Marking

| Command | Win | Mac |
|---|---|---|
| Mark In / Out | I / O | I / O |
| Mark Clip | X | X |
| Mark Selection | / | / |
| Clear In / Out / both | Ctrl+Shift+I / Ctrl+Shift+O / Ctrl+Shift+X | Opt+I / Opt+O / Opt+X |
| Add Marker | M | M |
| Clear Selected Marker | Ctrl+Alt+M | Opt+M |
| Clear All Markers | Ctrl+Alt+Shift+M | Opt+Cmd+M |

### 41.3 Editing

| Command | Win | Mac |
|---|---|---|
| Insert | , | , |
| Overwrite | . | . |
| Lift | ; | ; |
| Extract | ' | ' |
| Add Edit (targeted) | Ctrl+K | Cmd+K |
| Add Edit to All Tracks | Ctrl+Shift+K | Cmd+Shift+K |
| Ripple Delete | Shift+Delete | Shift+Forward Delete (fn+Shift+Delete) |
| Clear | Delete / Backspace | Delete |
| Ripple Trim Previous / Next Edit to Playhead | Q / W | Q / W |
| Trim Previous / Next Edit to Playhead | Ctrl+Alt+Q / Ctrl+Alt+W | Opt+Q / Opt+W |
| Extend Selected Edit to Playhead | E | E |
| Trim Edit | Shift+T | Shift+T |
| Select Clip at Playhead | D | D |
| Match Frame / Reverse Match Frame | F / Shift+R | F / Shift+R |
| Make Subsequence | Shift+U | Shift+U |
| Make Subclip | Ctrl+U | Cmd+U |
| Link / Unlink | Ctrl+L | Cmd+L |
| Group / Ungroup | Ctrl+G / Ctrl+Shift+G | Cmd+G / Cmd+Shift+G |
| Enable/Disable clip | Shift+E | Cmd+Shift+E |
| Speed/Duration | Ctrl+R | Cmd+R |
| Audio Gain | G | G |
| Audio Channels | Shift+G | Shift+G |
| Apply Video / Audio / Both default transitions | Ctrl+D / Ctrl+Shift+D / Shift+D | Cmd+D / Cmd+Shift+D / Shift+D |
| Nudge clip 1 frame left/right | Alt+Left / Alt+Right | Cmd+Left / Cmd+Right |
| Nudge clip 5 frames | Alt+Shift+Left/Right | Cmd+Shift+Left/Right |
| Move clip up/down a track | Alt+Up / Alt+Down | Opt+Up / Opt+Down **(verify Mac)** |
| Slip clip 1 frame | Ctrl+Alt+Left/Right | Opt+Cmd+Left/Right |
| Slide clip 1 frame | Alt+, / Alt+. | Opt+, / Opt+. |
| Paste Insert | Ctrl+Shift+V | Cmd+Shift+V |
| Paste Attributes | Ctrl+Alt+V | Cmd+Opt+V |
| Export Frame | Ctrl+Shift+E | Shift+E |
| Render Effects In to Out | Enter | Return |
| Snap toggle | S | S |
| Zoom in / out | = / - | = / - |
| Zoom to sequence | \ | \ |
| Multicam view | Shift+0 | Shift+0 |
| Cut to camera 1–9 | 1–9 | 1–9 |

### 41.4 Tools

| Tool | Key |
|---|---|
| Selection | V |
| Track Select Forward / Backward | A / Shift+A |
| Ripple Edit | B |
| Rolling Edit | N |
| Rate Stretch | R |
| Razor | C |
| Slip | Y |
| Slide | U |
| Pen | P |
| Hand | H |
| Zoom | Z |
| Type | T |

### 41.5 Panels & app

| Command | Win | Mac |
|---|---|---|
| Project / Source / Timeline / Program / Effect Controls / Audio Track Mixer / Effects / Media Browser / Audio Clip Mixer | Shift+1 … Shift+9 | Shift+1 … Shift+9 |
| Reset workspace | Alt+Shift+0 | Opt+Shift+0 |
| Workspaces 1–9 | Alt+Shift+1…9 | Opt+Shift+1…9 |
| New Project | Ctrl+Alt+N | Cmd+Opt+N |
| New Sequence | Ctrl+N | Cmd+N |
| New Bin | Ctrl+B | Cmd+B |
| Import | Ctrl+I | Cmd+I |
| Export Media | Ctrl+M | Cmd+M |
| Save / Save As / Save a Copy | Ctrl+S / Ctrl+Shift+S / Ctrl+Alt+S | Cmd+S / Cmd+Shift+S / Cmd+Opt+S |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z | Cmd+Z / Cmd+Shift+Z |
| Keyboard Shortcuts | Ctrl+Alt+K | Cmd+Opt+K |
| New text layer | Ctrl+T | Cmd+T |
| New rectangle / ellipse layer | Ctrl+Alt+R / Ctrl+Alt+E | Cmd+Opt+R / Cmd+Opt+E |
| Show Guides / Snap in Program Monitor | Ctrl+; / Ctrl+Shift+; | Cmd+; / Cmd+Shift+; |
| List / Icon view (Project panel) | Ctrl+Page Up / Ctrl+Page Down | Cmd+Page Up / Cmd+Page Down |

---

## 42. Behavior notes & implementation hints for editcut

These are the Premiere behaviors that most shape how an NLE "feels". Each is something editcut should either replicate or consciously change.

### 42.1 Data model implied by Premiere

| Premiere concept | Implied model |
|---|---|
| Project item vs timeline clip | A **master clip** (media reference + interpretation + master effects + markers + In/Out marks) is separate from **track items** (instances: source in/out, sequence start/end, speed, effects, keyframes, enabled, label, link group). Subclips are master-clip references with bounds. |
| Sequence | Settings (timebase, frame size, PAR, fields, audio rate, master channel layout, preview format, color settings), ordered video tracks, ordered audio tracks (with channel type), caption tracks, markers, In/Out, playhead, and per-track state (target, sync lock, lock, output/mute/solo, height, name). |
| Linking | Link groups of track items (1 video + up to 16 audio, plus captions). Linking is separate from **grouping**. |
| Source patching vs targeting | Two separate per-track states: a source→destination map for edits, and a target flag for commands. |
| Nesting | A sequence can be a clip source, so the model is a DAG (no cycles). Render the nested sequence as a single media source. |
| Effects | An ordered stack per clip: intrinsic Motion/Opacity/Time Remap (fixed positions) and Volume/Channel Volume/Panner, plus user effects. Each parameter is either static or a keyframe list with temporal (and for position, spatial) interpolation. |
| Markers | On master clips (and shown on instances), on sequences, and with type, duration, color, name, comment. |
| Time | Rational frame rates (24000/1001 etc.), drop-frame vs non-drop display, audio sample-accurate positions ("audio time units"). |

### 42.2 Critical interaction behaviors

1. **Three-point editing defaults**: missing sequence In = playhead; after an edit, the playhead jumps to the edit's end and sequence In/Out clear.
2. **Overwrite is the default drag**; a modifier key during the drag turns it into an insert, and the ripple arrows preview it.
3. **Sync lock semantics**: inserts and extracts shift every sync-locked track, splitting spanning clips; ripple operations refuse to cause overlaps.
4. **Trim cursors are context-sensitive** (trim/ripple/roll by tool, modifier and hover position), and edits on several tracks can be trimmed asymmetrically.
5. **Snapping** includes the playhead, edges, markers, In/Out and keyframes, and can be toggled mid-drag.
6. **J/K/L** shuttle with speed doubling, K-combo slow-mo and K-tap frame stepping. Dynamic trimming reuses J/K/L.
7. **Linked selection** is a toggle, and Alt/Opt-click overrides it per click. Out-of-sync offsets are shown as red numbers with fix-up actions.
8. **Render bar** colors reflect real-time feasibility per segment; previews are cached files keyed by segment content, so undo can bring back a green bar.
9. **Panel-scoped shortcuts** depend on focus; the active panel is outlined.
10. **Workspaces** are serializable panel trees, the current one auto-saves changes, and "reset to saved layout" restores it.
11. **Context-aware Properties panel** (25.0) supports multi-selection editing with mixed-value display, which is a good pattern for editcut.
12. **Transcript-driven editing** (text selection maps to a timeline range; delete = extract; Paper Edit builds sequences) is now table stakes in 2026 editors.
13. **Non-destructive AI features** (Generative Extend, Enhance Speech, Object Mask, Auto Reframe, Scene Edit Detection) run as background jobs with progress UI. Results attach to clips as new media or effect data and can be reverted.

### 42.3 Pain points editors cite (opportunities)

- 25.0's low-contrast default label colors (fixed by restoring the "Classic" palette). Keep timeline colors high-contrast and customizable.
- Sync-lock and targeting confusion for beginners (two separate concepts that both look like "track toggles"). Consider clearer visualization.
- Speed changes vs time remapping not combinable in one simple UI, and time remapping not rippling.
- Render/preview invalidation surprises (any tweak turns segments red again).
- Nested sequences can't grow automatically when their content gets longer.
- Media relinking was historically painful (26.2 added path tracking). Store relative paths and content hashes.

---

## Sources

- Adobe, Premiere desktop release notes: https://helpx.adobe.com/premiere-pro/kb/fixed-issues.html (also localized mirrors under helpx.adobe.com/*/premiere/desktop/whats-new/release-notes.html)
- Adobe, Premiere Pro feature summary (October 2024 / v25.0): https://helpx.adobe.com/premiere-pro/using/whats-new/2025.html
- Adobe, Premiere Pro feature summary (August 2025 / 25.4): https://helpx.adobe.com/tw/premiere-pro/using/whats-new/2025-4.html
- Adobe, Premiere Pro feature summary (September 2025 / 25.5): https://helpx.adobe.com/premiere-pro/using/whats-new/2025-5.html
- Adobe, Color mode in Premiere (beta): https://helpx.adobe.com/premiere/desktop/correct-color/color-mode-fundamentals/color-mode-basics.html
- Adobe Community, What's new in Adobe Premiere 26.5 (September 2026): https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187
- Adobe Community, Welcome to Adobe Premiere 26.0: https://community.adobe.com/announcements-727/welcome-to-adobe-premiere-26-0-1552341
- Larry Jordan, New Features in Adobe Premiere 26.2: https://larryjordan.com/articles/new-features-in-adobe-premiere-26-2/
- Larry Jordan, New Features in Adobe Premiere 26.3: https://larryjordan.com/articles/new-features-in-adobe-premiere-26-3/
- Larry Jordan, New Features in Adobe Premiere 25.6: https://larryjordan.com/?p=170472
- Larry Jordan, The new Properties panel in Adobe Premiere Pro 25.0: https://larryjordan.com/articles/the-new-properties-panel-in-adobe-premiere-pro-25-0/
- Newsshooter, What's new in Adobe Premiere 26.0: https://www.newsshooter.com/2026/01/20/whats-new-in-adobe-premiere-pro-26-0/
- Puget Systems, What's New in Version 25.2: https://www.pugetsystems.com/blog/2025/04/07/adobe-premiere-pro-and-after-effects-whats-new-in-version-25-2/
- Photutorial, The new Premiere Pro UI has users divided: https://photutorial.com/the-new-premiere-pro-ui-has-users-divided-is-adobes-friendly-design-going-too-far
- NewscastStudio / CineD / No Film School, NAB 2026 Color Mode coverage: https://www.newscaststudio.com/2026/04/16/adobe-introduces-color-grading-environment-in-premiere-expands-firefly-video-tools/
- VideoHelp version history: https://videohelp.com/software/Adobe-Premiere-Pro/version-history

> Note on accuracy: helpx.adobe.com pages returned HTTP 403 to automated fetching during research, so version-feature details come from search snippets of those pages plus the secondary sources above. Long-standing UI behavior (panels, menus, tools, shortcuts) is from established Premiere documentation and practice. Items marked **(verify)** should be checked against a running 26.x build before being relied on for exact parity.
