# Video Editor Knowledge Base (editcut)

Reference material on professional and consumer video editors, compiled Oct 2026 to inform the design of **editcut**. Items marked *(verify)* are uncertain — confirm in the real app before copying behavior exactly.

| File | Covers | Current version researched |
|---|---|---|
| [premiere-pro-part1-interface-editing.md](premiere-pro-part1-interface-editing.md) | Workspaces, every panel & monitor button, timeline header controls, tools, all menus, editing concepts (3/4-point, trims, multicam, proxies, render bars, speed, media mgmt, collaboration), shortcuts, editcut data-model notes | Premiere (Pro) 25.0 → 26.5 |
| [premiere-pro-part2-effects-color-audio-export.md](premiere-pro-part2-effects-color-audio-export.md) | Effect Controls, keyframes, blend modes, full video effect & transition lists, Lumetri + scopes, Essential Sound & mixers, graphics/captions/AI, export & Media Encoder, shortcuts, preferences | 25.0 → 26.3 |
| [davinci-resolve.md](davinci-resolve.md) | Free vs Studio, project settings/color mgmt, Media/Cut/Edit/Fusion/Color/Fairlight/Deliver/Photo pages, ~45 Neural Engine AI features, multicam/proxies/cache, shortcuts | Resolve 21.1 |
| [final-cut-pro.md](final-cut-pro.md) | Library/Event/Project model, roles & keywords, browser/viewer/magnetic timeline, tools & edit commands, inspector, color, audio, AI/ML, captions, multicam, share/export, iPad, shortcuts | FCP 12.4 |
| [capcut-filmora.md](capcut-filmora.md) | Pricing, UI layout, every toolbar button & property-panel tab, AI feature tables, keyframes/masks/chroma, export, shortcuts, CapCut vs Filmora, 27 consumer-UX patterns | CapCut 2026, Filmora 15.7 |

## Quick paradigm comparison

| Concept | Premiere | Resolve | Final Cut Pro | CapCut / Filmora |
|---|---|---|---|---|
| Timeline model | Track-based | Track-based (+ Cut page dual timeline) | Magnetic, trackless (primary storyline + connected clips) | Track-based with magnetic main track |
| Core edit keys | I/O, `,` insert, `.` overwrite, Q/W ripple trim | I/O, F9 insert, F10 overwrite, F12 place on top | I/O, Q connect, W insert, E append, D overwrite | Split (Cmd/Ctrl+B), Q/W delete left/right |
| Color | Lumetri panel | Node-based Color page | Color Board / wheels / curves | Adjust tab (HSL, curves, wheels) |
| Audio | Essential Sound + mixers | Fairlight page | Audio inspector, roles | Property panel + AI cleanup |
| Compositing | Effects + adjustment layers | Fusion (nodes) | Effects + Motion templates | Overlay tracks, masks |
| Organizing | Bins, metadata | Bins, smart bins | Keywords, ratings, smart collections, roles | Flat media pool |

## Cross-cutting lessons for editcut
See the closing "editcut" sections in each file. Recurring themes: J/K/L transport and I/O marking are universal; ripple-by-default (magnetic) wins for beginners while pro users want track targeting/sync lock; non-destructive effect stacks with keyframes on every parameter; proxies + render cache for performance; transcript/caption workflows and AI cleanup (voice isolation, background removal, auto-reframe) are now table stakes.
