# Adobe Premiere (Pro) Reference, Part 2: Effects, Color, Audio, Graphics, Export, Shortcuts, Preferences

> Knowledge base for **editcut**, a custom video editor. It covers Premiere Pro v25.x (2025) and Premiere v26.x (2026). Adobe dropped "Pro" from the name with 26.0, so the app is now just "Adobe Premiere".
> Compiled October 2026 from helpx.adobe.com, Adobe release notes and blog, CineD, Newsshooter, ProVideoCoalition, Larry Jordan, Puget Systems, and working knowledge of the app.
> Each entry focuses on **what the control does**: the parameter, its units and range, the default, and the math or behavior behind it. Implementation notes for editcut are marked **[editcut]**.

---

## 0. Version timeline (2025–2026) – what changed where

| Version | Date | Key additions relevant to this doc |
|---|---|---|
| 25.0 | Oct 2024 | New Properties panel (context-sensitive), new Effect Controls/UI refresh, ProRes RAW, new color-management engine preview |
| 25.1 | Dec 2024 | Color-managed workflow improvements, bug fixes |
| 25.2 | Apr 2025 | **Generative Extend** (Firefly; up to 2 s of video, up to 10 s of audio, 4K), **Media Intelligence + Search panel**, **Caption Translation** (27 languages), **color-managed Lumetri** (auto log/raw → SDR/HDR tone mapping, ACEScct wide-gamut pipeline), dynamic waveforms, colored sequence labels |
| 25.3 | Jun 2025 | Performance work, ProRes RAW on Windows Intel/AMD GPUs, ProRes RAW → Log conversion, rendering fixes |
| 25.4 | Aug 2025 | Maintenance/performance |
| 25.5 | Sep 2025 | **Film Impact library built in**: 90+ GPU-accelerated effects, transitions and text animations, with "Surprise Me" variations. Waveforms, keyframes and markers stay visible while dragging/trimming. Multi-fade adjust across selected clips. Default fonts for text/captions. Track mute/solo shortcuts that follow targeting. Sequence color tabs. 10-bit 4:2:2 H.264/HEVC hardware decode on NVIDIA Blackwell. ARRIRAW HDE. Reworked MKV support. 16-bit PNG import |
| 25.6 | late 2025 | Native Nikon N-RAW and more camera support |
| 26.0 | Jan 2026 | Renamed **Adobe Premiere**. **AI Object Mask** (hover+click select, auto-track). **Redesigned shape masks** (Rectangle/Ellipse/Pen, about 20x faster tracking, new on-canvas controls). **On-clip transition handles**. Interactive audio fades. OTIO import/export. R3D NE. Firefly Boards → Premiere. Adobe Stock panel. GPU thumbnails. Native Windows-on-ARM. macOS 14+ minimum |
| 26.0.1 / 26.0.2 | Feb/Mar 2026 | Fixes, including object-mask data through AME |
| 26.2 | Apr 2026 | Global Mute, marker search, **Content Credentials in Export settings**, Sequence Index panel, Object Mask **Sharp/Smooth** edge quality |
| NAB 2026 | Apr 2026 | **Color Mode (beta)**: dedicated 32-bit GPU grading environment with Color Monitor, Clip Grid, Color Controls, Comparison View and Video Scopes |
| 26.3 | Jun 23 2026 | **Single-word captions**, **Shape Dissolve** transition, **Magnify** effect, new GPU effects **Channel Blur, Gradient, Noise**, transitions **3D Spinback, 3D Slide**, A/V Display Mode toggle, Marker Search, Global Audio Mute, faster Object Mask + Restore Mask Data, Firefly Boards → auto sequence, auto-add-tracks timeline preference, Stock licensing in-app |
| Creative Agent (beta) | Jun 18 2026 | Window > Assistant. Conversational AI organizes bins, transcribes, builds stringouts/rough cuts. Every action goes to the undo stack. Modes: "Always ask" / "Auto approve" |
| 26.3.2 | Aug 2026 | Bug fixes (MKV import crash) |

---

## 1. Effect Controls panel

### 1.0 Panel anatomy
- **Left side:** a tree of the effects on the selected clip. Each effect has an **fx toggle** (bypass), a disclosure triangle, and a **Reset** button. Each parameter has a **stopwatch** (Toggle Animation), a value field (scrubby: drag to change, Cmd/Ctrl+drag for fine, Shift+drag for coarse), and a **Reset Parameter** button. Mask controls appear under an effect when it supports masks: Ellipse, 4-point/Rectangle, Pen, and since 26.0 the Object Mask.
- **Right side:** a mini timeline covering the clip's duration, or the full sequence if you uncheck **Pin to Clip** in the panel menu. It holds the playhead, keyframe diamonds, and the clip in/out ("gray" areas beyond clip boundaries).
- **Keyframe navigator:** ◀ ◆ ▶ (Go to previous, Add/Remove, Go to next) for each parameter.
- **Panel menu:** Pin to Clip, Show/Hide Timeline View, Show Audio Time Units, Loop Audio Playback, Effect Enabled, Remove Effects, Save Preset.
- **Order of operations:** effects are processed top to bottom. **Intrinsic (fixed) effects** (Motion, Opacity, Time Remapping) render *after* the standard effects by default. So applying a **Transform** effect gives different results than Motion (for example, Transform has its own shutter-angle motion blur, and Motion's scale happens after effects such as Drop Shadow). You can reorder standard effects by dragging; intrinsic effects can't be reordered.
- **Copy/paste effects:** Cmd/Ctrl+C on a clip, then **Paste Attributes** (Cmd+Opt+V / Ctrl+Alt+V) brings up a dialog with checkboxes for Motion, Opacity, Time Remap, Volume, Channel Volume, Panner and each effect, plus a "Scale attribute times" option. **Remove Attributes** does the reverse.
- **Presets:** right-click an effect and choose Save Preset (.prfpset). Types: **Scale** (keyframes scale proportionally to clip length), **Anchor to In Point**, **Anchor to Out Point**.

### 1.1 Motion (intrinsic, video)

| Parameter | Units / range | Default | What it does |
|---|---|---|---|
| **Position** | X, Y in sequence pixels (floats) | center of the frame (e.g. 960, 540 for 1920×1080) | Places the clip's **Anchor Point** at this sequence coordinate. Origin (0,0) is the top-left of the frame. It can be animated spatially; the motion path appears in the Program Monitor with **spatial interpolation** (Bezier handles on the path). |
| **Scale** | % (0–10000) | 100 | Uniform scale about the Anchor Point. If **Uniform Scale** is unchecked, this becomes **Scale Height**. |
| **Scale Width** | % | 100 | Active only when Uniform Scale is unchecked; scales X independently. |
| **Uniform Scale** | checkbox | on | Locks X/Y scale together. |
| **Rotation** | degrees. Values beyond 360 display as revolutions, e.g. `1x45.0°` | 0 | Rotates about the Anchor Point. Positive = clockwise. |
| **Anchor Point** | X, Y in **clip/layer pixel space** | center of the source frame (e.g. 1920,1080 for a 3840×2160 clip) | The pivot for scale and rotation, and the point placed at Position. Changing the anchor alone moves the image the opposite way. To pivot without moving, change both. |
| **Anti-flicker Filter** | 0.00–1.00 | 0 | Applies a vertical blur (temporal-ish) to reduce interline twitter and flicker on fine horizontal detail (interlaced output or high-frequency stills with motion). Higher = softer. |
| *(Crop)* | Left/Top/Right/Bottom % | 0 | Motion has no crop parameter. Cropping uses the **Crop** effect (Transform category), and the 25.x Properties panel shows a quick Crop control that adds and drives that effect. |

Other Motion behavior:
- Clicking the **Motion** name selects the clip in the Program Monitor and shows its bounding box and handles: drag to move, corners to scale, outside corners to rotate. The crosshair is the anchor.
- **Set to Frame Size** sets Scale so the clip fits the frame (non-destructive, a parameter change). **Scale to Frame Size** is legacy and rasterizes at sequence resolution, which loses detail if you scale up later.
- **Default Media Scaling** (Preferences > Media): None / Scale to frame size / Set to frame size.
- **Motion vs. Transform effect:** Transform (Distort/Transform category) has Position, Anchor, Uniform Scale, Scale, Skew, Skew Axis, Rotation, Opacity, **Use Composition's Shutter Angle**, **Shutter Angle** (0–360) for real motion blur, and **Sampling** (Bilinear/Bicubic).

**[editcut]** Transform order per pixel: translate(−anchor) → scale(sx, sy) → rotate(θ) → translate(position). Sample the source with bilinear filtering; use higher quality when "Maximum Render Quality" is on (bicubic/Lanczos for downscales).

### 1.2 Opacity (intrinsic, video)

| Parameter | Range | Default | Meaning |
|---|---|---|---|
| **Opacity** | 0–100 % | 100 | Multiplies the clip's alpha. A layer composites over lower tracks with result = blend(src, dst) · α + dst · (1−α). |
| **Blend Mode** | dropdown (list below) | Normal | How the layer's color combines with the composite of the tracks beneath it. |
| **Masks** | Ellipse / 4-point polygon (Rectangle in 26.x) / Free-draw Bezier (Pen) / Object Mask (26.0+) | none | Restrict opacity to a region. |

#### Mask parameters (identical on Opacity and on any effect that supports masks)

| Control | Meaning |
|---|---|
| **Mask Path** | Animatable shape. **Track Mask** buttons: ◀◀ track backward 1 frame, ◀ track backward, ▶ track forward, ▶▶ track forward 1 frame. **Tracking method** (wrench): **Position**; **Position & Rotation**; **Position, Scale & Rotation**. Plus a Preview option. 26.0 rewrote the tracker, about 20x faster. |
| **Mask Feather** | 0–n px (default 10). Gaussian-like softening of the mask edge. On canvas there's a dashed outer guide and a feather handle. |
| **Mask Opacity** | 0–100 % (default 100). Strength of the mask. |
| **Mask Expansion** | ±px (default 0). Grows (positive) or shrinks (negative) the mask boundary, like a morphological dilate/erode. |
| **Inverted** | checkbox. Flips the inside and outside of the mask. |
| **Multiple masks** | Every mask on an effect is evaluated, and their union is used: the effect applies inside any mask. To subtract, turn on **Inverted** for a mask, or use a second effect instance. Masks are listed as "Mask (1)", "Mask (2)" and so on, and each can be renamed. |
| **Object Mask (26.0+)** | Hover to highlight the AI-detected subject, click to create a mask. Add/subtract with brush refinements. **Edge quality** Sharp/Smooth (26.2). Track the whole clip. 26.3 added **Restore Mask Data**, which regenerates mask data if the project moves machines and the cache is missing. |
| **Pen mask** | Click to add corner points, drag to create Bezier handles. Alt/Opt-click a vertex to toggle corner/smooth. Cmd/Ctrl-click a segment to add a vertex. Close the path by clicking the first point. 26.0 adds curve-based editing and a per-vertex feather UI. |

#### Blend modes (complete list, in Premiere's grouped order)

| Group | Mode | Formula / behavior (a = layer, b = below, 0–1) |
|---|---|---|
| Normal | **Normal** | a |
| | **Dissolve** | Random pixel dither based on opacity (no partial transparency) |
| Darken | **Darken** | min(a, b) per channel |
| | **Multiply** | a·b |
| | **Color Burn** | 1 − (1−b)/a |
| | **Linear Burn** | a + b − 1 |
| | **Darker Color** | Whole-pixel choice: the pixel with the lower luminance |
| Lighten | **Lighten** | max(a, b) |
| | **Screen** | 1 − (1−a)(1−b) |
| | **Color Dodge** | b / (1−a) |
| | **Linear Dodge (Add)** | a + b |
| | **Lighter Color** | Whole-pixel choice: the pixel with the higher luminance |
| Contrast | **Overlay** | b<0.5 ? 2ab : 1−2(1−a)(1−b) |
| | **Soft Light** | Gentle overlay (Pegtop/W3C formula) |
| | **Hard Light** | Overlay with a and b swapped (keyed on a) |
| | **Vivid Light** | Color burn/dodge depending on a |
| | **Linear Light** | b + 2a − 1 |
| | **Pin Light** | Darken if a<0.5, otherwise Lighten |
| | **Hard Mix** | Threshold of Vivid Light → 0 or 1 per channel |
| Inversion | **Difference** | \|a − b\| |
| | **Exclusion** | a + b − 2ab |
| Cancellation | **Subtract** | b − a |
| | **Divide** | b / a |
| Component | **Hue** | Hue of a, saturation + luminosity of b |
| | **Saturation** | Saturation of a |
| | **Color** | Hue + saturation of a, luminosity of b |
| | **Luminosity** | Luminosity of a, hue + saturation of b |

(The Blend effect has its own short list: Crossfade, Color Only, Tint Only, Darken Only, Lighten Only. Film Impact effects since 25.5 add their own "custom blend modes" inside their effects.)

**[editcut]** Blend in linear or display-referred space? Premiere blends in the sequence working space. With the 25.x color management and "Linear compositing" (Sequence settings > Color: Composite in linear color), it blends in linear light, which gives more realistic cross dissolves and glows.

### 1.3 Time Remapping (intrinsic)
- **Speed** parameter, as a % of normal speed, keyframed on a **rubber band** in the timeline (clip > Show Clip Keyframes > Time Remapping > Speed) or in Effect Controls.
- **Workflow:** Cmd/Ctrl-click the rubber band to add a speed keyframe. Drag the band segment up or down to change the speed of that segment (the clip lengthens or shortens and ripples). **Split** the keyframe by dragging its halves apart to create a **speed ramp** (gradual transition). The ramp's curve is Bezier and can be adjusted with the blue handle. **Alt/Opt-drag** a keyframe to move the source frame without changing timing. Shift-drag moves the keyframe.
- **Reverse:** Cmd/Ctrl-drag a keyframe right to create a reverse segment (plays backward, then forward with "<<" markers, a palindrome).
- **Freeze (hold):** Cmd/Ctrl+Alt/Opt-drag creates a hold segment (a still frame).
- Time Remapping can't coexist with Speed/Duration changes on the same clip; Speed/Duration is disabled once remap keyframes exist.
- **Clip > Speed/Duration** (Cmd/Ctrl+R): Speed %, Duration, **Reverse Speed**, **Maintain Audio Pitch**, **Ripple Edit, Shifting Trailing Clips**, **Time Interpolation**: **Frame Sampling** (duplicates/drops frames), **Frame Blending** (crossfades adjacent frames), **Optical Flow** (motion-estimated interpolated frames, which can create warping artifacts).
- **Rate Stretch tool (R):** drag a clip edge to change speed so it fills a duration.
- **Frame Hold:** Clip > Video Options > **Frame Hold Options** (Hold on: Source Timecode / Sequence Timecode / In Point / Out Point / Playhead, plus Hold Filters), **Add Frame Hold**, **Insert Frame Hold Segment**.

### 1.4 Audio intrinsic effects

| Effect | Parameters | What they do |
|---|---|---|
| **Volume** | **Bypass** (checkbox), **Level** (dB, −∞ to +15 dB; default 0) | Clip-level gain applied **before** track effects. Keyframable. The clip rubber band in the timeline shows Volume:Level by default. |
| **Channel Volume** | **Left**, **Right** (dB, −∞ to +6) and Bypass | Per-channel gain for stereo or multichannel clips. |
| **Panner** | **Balance** (−100 L … +100 R) | Clip-level stereo balance. Track panning is separate (in the Track Mixer). Available on mono clips in a stereo track. |

- **Clip gain** (Audio Gain dialog, G) is applied before Volume. **Clip Volume** is a keyframable effect. **Track volume** comes after both. Order: source → Audio Gain → clip effects (Volume, Channel Volume, Panner and any clip-applied effects in order) → track effects (pre-fader inserts) → track fader → track pan → (post-fader inserts/sends) → submix/master.
- Volume keyframes: Cmd/Ctrl-click the rubber band to add. A pen-tool drag with Shift constrains. Interactive fades (26.0): drag the fade handles at the clip's top corners to create fade-in/out without keyframes, as in Resolve.

### 1.5 Keyframes

#### Temporal interpolation (right-click a keyframe > Temporal Interpolation)

| Type | Icon | Behavior |
|---|---|---|
| **Linear** | diamond ◆ | Constant rate of change between keyframes. Velocity jumps abruptly at the key. |
| **Bezier** | hourglass | Manual, independent in/out handles (velocity + influence). Handles can be broken. |
| **Auto Bezier** | circle ● | Automatically smooth rate through the key. Handles are computed, and the key converts to Continuous Bezier if you drag a handle. |
| **Continuous Bezier** | hourglass (rounded) | Smooth through the key. Handles stay linked (equal angle) but you adjust them manually. |
| **Hold** | square-ish/half | Value stays constant until the next key, a step function. Within Hold, the incoming side stays linear. |
| **Ease In** | right half-curve | Slows down entering the key: the incoming velocity is set to 0 with about 33% influence. It converts the key to Bezier. |
| **Ease Out** | left half-curve | Accelerates out of the key gradually. |

- **Spatial interpolation** (for Position, Anchor Point, and mask vertices): **Linear**, **Bezier**, **Auto Bezier** or **Continuous Bezier**. It shapes the motion path drawn in the Program Monitor. New Position keys default to Auto Bezier spatial, which gives curved paths. Right-click > Spatial Interpolation > Linear makes the path straight.
- **Keyframe navigation:** Effect Controls has **Go to Previous Keyframe** ◀ and **Go to Next Keyframe** ▶ arrows on each parameter row. These commands have no default keyboard shortcut. Assign them in Keyboard Shortcuts (search for "keyframe"). Shift-dragging the playhead snaps it to keyframes, and with snapping on the CTI snaps to keyframes in Effect Controls. In the Timeline, Up/Down arrows go to edit points, not keyframes.
- **Interpolation shortcuts:** right-click a keyframe for Temporal Interpolation or Spatial Interpolation. The submenu choices are Linear, Bezier, Auto Bezier, Continuous Bezier, Hold, Ease In and Ease Out. There are no default key bindings for these.
- **Adding keyframes:** turn on the stopwatch (this creates a key at the CTI), then change values at a new time to auto-create keys. Use the ◆ button to add or remove. Cmd/Ctrl-click a rubber band in the timeline. The Pen tool (P) also works.
- **Selecting and moving:** marquee-select in Effect Controls. Shift-click to add to the selection. Drag to retime, with Shift to snap. **Alt/Opt-drag** to duplicate (copy-paste works too). Select a group and Alt-drag the outer keyframe to scale timing proportionally.
- **Graph editing:** twirl open a parameter to reveal its **Value graph** (and a **Velocity graph** for temporal). Drag Bezier handles to shape the ease. For Position, the separate velocity graph shows speed in px/sec. The 25.x/26.x Effect Controls UI keeps both graphs. No separate "Graph Editor" panel exists the way it does in AE; the timeline's clip rubber bands also accept Bezier handles (right-click > Bezier).
- **Last-frame keyframing fix (25.5):** you can now set keyframes on the last frame of a clip in Effect Controls.

**[editcut]** Model each keyframe as `{t, value, inInterp, outInterp, inTangent{speed,influence}, outTangent{speed,influence}, spatialIn/Out tangents}`. Evaluate with a cubic Bezier in (time, value) space. AE/Premiere express handles as velocity (units/sec) and influence (% of the segment duration, 0.1–100, default 33.33).


---

## 2. Video Effects (Effects panel > Video Effects)

Effects panel bins: **Presets, Lumetri Presets, Audio Effects, Audio Transitions, Video Effects, Video Transitions** (and Film Impact categories since 25.5). Filter icons at the top of the panel: **Accelerated Effects** (GPU/Mercury Playback Engine), **32-bit color** (high bit-depth float processing), **YUV effects** (processed natively in YUV without RGB conversion). The search field filters by name. **[editcut]** Tag each effect with gpu / 32bpc / yuv capabilities the same way.

Note: the category list below matches Premiere 24.x–26.x. Adobe moves legacy effects into **Obsolete** over time; the effects marked (Obsolete) live there in current builds.

### 2.1 Adjust
| Effect | What it does |
|---|---|
| **Extract** | Removes colors to make a grayscale/black-and-white image based on a luminance range (Black Input Level, White Input Level, Softness, Invert). |
| **Levels** | Classic input/output levels per RGB/R/G/B: input black/white, output black/white, gamma. |
| **Lighting Effects** | Up to 5 lights (Spotlight/Omni/Directional) with color, intensity, focus, center, angle, ambient, surface gloss/material, exposure, and a bump layer (texture channel/height). |
| **ProcAmp** | Broadcast-style Brightness, Contrast, Hue, Saturation, plus a Split Screen option. GPU, YUV. |
| **Convolution Kernel** | A 3×3 matrix (M11–M33), Offset and Scale for custom blur/sharpen/emboss kernels. |
| Auto Color / Auto Contrast / Auto Levels (Obsolete) | Automatic per-frame color, contrast and levels with temporal smoothing, scene detect, black/white clip %, and blend with original. |
| Shadow/Highlight (Obsolete) | Lifts shadows and recovers highlights with auto amounts, temporal smoothing, and tonal width/radius controls. |

### 2.2 Blur & Sharpen
| Effect | What it does |
|---|---|
| **Gaussian Blur** | Blurriness (0–n), Blur Dimensions (Horizontal and Vertical / Horizontal / Vertical), **Repeat Edge Pixels** (stops edge darkening; quality improved in 26.3). GPU, 32-bit. |
| **Directional Blur** | Motion-style blur along a Direction angle by Blur Length. |
| **Compound Blur** | Blurs based on the luminance of a Blur Layer track (map). Max Blur, Invert Blur, Stretch Map to Fit. |
| **Camera Blur** (Obsolete) | Out-of-focus simulation (% blur). |
| **Channel Blur** | Separate R/G/B/Alpha blurriness. Re-introduced as a **new GPU effect in 26.3**. |
| **Sharpen** | Sharpen Amount (simple contrast at edges). |
| **Unsharp Mask** | Amount, Radius, Threshold. Classic USM: original + amount·(original − blurred), applied where the difference exceeds the threshold. |
| **Reduce Interlace Flicker** | Vertical softening to reduce interline flicker. |
| **Fast Blur** (Obsolete) | Replaced by Gaussian Blur. |

### 2.3 Channel
| Effect | What it does |
|---|---|
| **Arithmetic** | Per-channel operations (And, Or, Xor, Add, Subtract, Difference, Min, Max, Block Above/Below, Slice, Multiply, Screen) with constant R/G/B values. |
| **Blend** | Blends with another track (Crossfade / Color Only / Tint Only / Darken Only / Lighten Only) with a "Blend With Original" %. |
| **Calculations** | Combines channels of this layer and a second layer with a blend mode, plus Preserve Transparency. |
| **Compound Arithmetic** | Math between this layer and a second layer (Copy, Add, Subtract, Multiply, Difference, And, Or, Xor, Lighten, Darken, Min, Max, Screen, Overlay, Hard Light) with Clip Result Values. |
| **Invert** | Inverts a chosen channel set: RGB, R, G, B, HLS, Hue, Lightness, Saturation, YIQ, Luminance, In-phase/Quadrature chroma, Alpha. Blend With Original. |
| **Set Matte** | Takes a channel from another layer (or this one) as this layer's alpha: Use For Matte (R/G/B/A/Luminance/Hue/Lightness/Saturation/Full/Off), Invert, Stretch to Fit, Composite Matte with Original, Premultiply Matte Layer. |
| **Solid Composite** | Composites the layer over a solid color with Source Opacity, Color, Opacity and Blend Mode. |

### 2.4 Color Correction
| Effect | What it does |
|---|---|
| **Lumetri Color** | The main grading effect (see Section 4). GPU, 32-bit. |
| **ASC CDL** | American Society of Cinematographers Color Decision List: Slope, Offset, Power per R/G/B, plus Saturation. out = (in·slope + offset)^power. |
| **Brightness & Contrast** | Simple brightness/contrast with slider-only control. |
| **Change Color** | Changes the hue/lightness/saturation of a selected color range (View: corrected layer/color correction mask; Hue Transform, Lightness Transform, Saturation Transform; Color To Change; Matching Tolerance, Matching Softness; Match colors using RGB/Hue/Chroma; Invert Color Correction Mask). |
| **Change to Color** | Replaces From color with To color, with Change (Hue / Hue & Lightness / Hue, Lightness & Saturation), Change By (Setting to color / Transforming to color), Tolerance (H/L/S), Softness, View Correction Matte. |
| **Channel Mixer** | Each output channel = weighted sum of R, G, B plus a constant (Red-Red, Red-Green, Red-Blue, Red-Const, and so on). Monochrome option. |
| **Color Balance** | Shadow/Midtone/Highlight R/G/B balance plus Preserve Luminosity. |
| **Color Balance (HLS)** | Hue, Lightness, Saturation offsets. |
| **Leave Color** | Desaturates everything except a chosen color (Amount to Decolor, Color to Leave, Tolerance, Edge Softness, Match colors RGB/Hue). |
| **Tint** | Maps black to "Map Black To" color and white to "Map White To" color, with Amount to Tint. Duotone. |
| **Video Limiter** | Clamps signal to broadcast-legal range: Clip Level (signal-range presets such as 0–100 IRE / 7.5–100 / −20–120), Clip Method (Luma / Chroma / Smart Limit / Luma and Chroma), Compression Before Clipping (3%, 5%, 10%, 20%), Gamut Warning + color, Reduction Axis/Method. |
| **Broadcast Colors** (Obsolete) | Older legal-range clamp (NTSC/PAL, Reduce Luminance/Saturation, Make Unsafe Transparent/Key Out Safe). |
| Three-Way Color Corrector, Fast Color Corrector, Luma Corrector, Luma Curve, RGB Color Corrector, RGB Curves (all Obsolete) | Legacy primary/secondary correctors replaced by Lumetri. Three-Way had Shadow/Midtone/Highlight wheels, Input/Output levels, a Secondary Color Correction key, Auto Black/Contrast/White and Tonal Range Definition. |

### 2.5 Distort
| Effect | What it does |
|---|---|
| **Corner Pin** | Moves the 4 corners (Upper Left/Right, Lower Left/Right). A perspective (homography) warp for screen replacement. |
| **Lens Distortion** | Curvature (− barrel / + pincushion), Vertical/Horizontal Decentering, Vertical/Horizontal Prism FX, Fill Color, Fill Alpha. Also used to remove GoPro fisheye (presets exist). |
| **Magnify** | Circular/square magnifier: Shape, Center, Magnification, Link (none/size to magnification/size & feather), Size, Feather, Opacity, Scaling (Standard/Soft/Scatter), Blending Mode, Resize Layer. **26.3 added a new Magnify** with customizable lens, zoom, position, edge softness and styling for callouts. |
| **Mirror** | Reflects the image across a line (Reflection Center, Reflection Angle). |
| **Offset** | Wraps/scrolls the image (Shift Center To, Blend With Original). Seamless pans. |
| **Rolling Shutter Repair** | Rolling Shutter Rate (%), Scan Direction (top→bottom etc.), Advanced: Method (Warp / Pixel Motion), Detailed Analysis, Pixel Motion Detail. |
| **Spherize** | Bulges the image (Radius, Center of Sphere). |
| **Transform** | Position, Anchor, Scale (uniform/height/width), Skew, Skew Axis, Rotation, Opacity, Shutter Angle (motion blur), Sampling. Renders in effect order, unlike Motion. |
| **Turbulent Displace** | Fractal noise displacement: Displacement type (Turbulent, Bulge, Twist, Vertical/Horizontal, Cross…), Amount, Size, Offset, Complexity, Evolution, Evolution Options (Cycle), Pinning, Resize Layer, Antialiasing. |
| **Twirl** | Angle and Twirl Radius around a Twirl Center. |
| **Warp Stabilizer** | Analyzes and stabilizes. **Stabilization:** Result (Smooth Motion / No Motion), Smoothness % (default 50), Method (Position / Position, Scale, Rotation / Perspective / Subspace Warp), Preserve Scale. **Borders:** Framing (Stabilize Only / Stabilize, Crop / Stabilize, Crop, Auto-scale [default] / Stabilize, Synthesize Edges), Auto-scale Maximum Scale, Action-Safe Margin, Additional Scale. **Advanced:** Detailed Analysis, Rolling Shutter Ripple (Automatic/Enhanced), Crop Less ↔ Smooth More, Synthesis Input Range, Synthesis Edge Feather/Cropping, Hide Warning Banner, Show Tracks, Track Point Size, Objects (Subspace). Clip speed must not change after analysis, and nested sequences are required if the clip size differs from the sequence. |
| **Wave Warp** | Wave Type (Sine, Square, Triangle, Sawtooth, Circle, Semicircle, Uncircle, Noise, Smooth Noise), Height, Width, Direction, Speed, Pinning, Phase, Antialiasing. |
| **Bend** (Obsolete) | Horizontal/vertical bending waves. |

### 2.6 Generate
| Effect | What it does |
|---|---|
| **4-Color Gradient** | Four points with colors, Blend, Jitter, Opacity, Blending Mode. |
| **Cell Pattern** | Procedural cellular noise (Bubbles, Crystals, Plates, Static, Tubular, etc.) with Contrast, Overflow, Disperse, Size, Offset, Tiling, Evolution. |
| **Checkerboard** | Anchor, Size From (Corner Point/Width Slider/Width & Height), feather, color, opacity, blend. |
| **Circle** | Center, Radius, Edge (None/Edge Radius/Thickness/Thickness*Radius/Thickness & Feather*Radius), Feather, Invert, Color, Opacity, Blend. |
| **Ellipse** | Center, Width, Height, Thickness, Softness, Inside/Outside Color, Composite on Original. |
| **Eyedropper Fill** | Samples a color from a point (Sample Point, Sample Radius, Average Pixel Color: Skip Empty/All/All Premultiplied/Including Alpha) and fills the layer. |
| **Grid** | Grid lines (Anchor, Size From, Border, Feather, Invert Grid, Color, Opacity, Blend). |
| **Lens Flare** | Flare Center, Flare Brightness, Lens Type (50–300mm Zoom / 35mm Prime / 105mm Prime), Blend With Original. |
| **Lightning** | Start/End Point, Segments, Amplitude, Detail Level/Amplitude, Branching, Rebranching, Branch Angle/Seg Length/Segments/Width, Speed, Stability, Fixed Endpoint, Width, Width Variation, Core Width, Outside/Inside Color, Pull Force/Direction, Random Seed, Blending Mode, Simulation. |
| **Paint Bucket** | Flood-fills from a Fill Point with Tolerance, Fill Selector (Color & Alpha/Straight Color/Transparency/Opacity/Alpha Channel), Stroke (Antialias/Feather/Spread/Choke/Stroke), Color, Opacity, Blend. |
| **Ramp** | Linear or Radial gradient between Start/End points and colors, Ramp Scatter, Blend With Original. **26.3 adds a new GPU "Gradient" effect** (multi-stop, faster). |
| **Write-on** | Animates a painted brush stroke (Brush Position, Color, Size, Hardness, Opacity, Stroke Length, Brush Spacing, Paint Time Properties, Brush Time Properties, Paint Style: On Original/Transparent/Reveal Original). |
| **Noise** (26.3, new GPU) | Procedural noise generator (complements Noise & Grain > Noise). |

### 2.7 Image Control
| Effect | What it does |
|---|---|
| **Black & White** | Instant grayscale (no parameters). |
| **Color Pass** | Keeps one color, desaturates the rest (Similarity, Reverse). |
| **Color Replace** | Replaces Target Color with Replace Color within Similarity, Solid Colors option. |
| **Gamma Correction** | Gamma value (1–28, 10 = neutral). |
| **Color Balance (RGB)** | Red/Green/Blue % multipliers. |

### 2.8 Immersive Video (VR, for 180°/360° equirectangular footage; all GPU)
| Effect | What it does |
|---|---|
| **VR Blur** | Seam-aware blur on spherical footage. |
| **VR Chromatic Aberrations** | RGB fringing, seam-aware. |
| **VR Color Gradients** | Gradient overlay with points and colors, seam-aware. |
| **VR De-Noise** | Noise reduction that respects the wrap seam. |
| **VR Digital Glitch** | Glitch distortions without seam breaks. |
| **VR Fractal Noise** | Fractal noise on the sphere. |
| **VR Glow** | Glow without seam artifacts. |
| **VR Plane to Sphere** | Projects flat graphics/titles correctly onto the 360 sphere (no distortion). |
| **VR Projection** | Changes the projection/layout (stereo/mono, rotate, expand/contract) and converts 180↔360. |
| **VR Rotate Sphere** | Re-orients the horizon: Tilt (X), Pan (Y), Roll (Z). |
| **VR Sharpen** | Seam-aware sharpening. |
Each has Frame Layout (Monoscopic / Stereoscopic Over-Under / Side-by-Side), Auto-detect VR properties, and Horizontal/Vertical FOV.

### 2.9 Keying
| Effect | What it does |
|---|---|
| **Alpha Adjust** | Opacity, Ignore Alpha, Invert Alpha, Mask Only. |
| **Color Key** | Simple key on a Key Color with Color Tolerance, Edge Thin, Edge Feather. |
| **Image Matte Key** (Obsolete in new builds) | Uses an external still as matte (Alpha/Luma, Reverse). |
| **Luma Key** | Keys by brightness (Threshold, Cutoff). |
| **Track Matte Key** | Uses another video track as matte: Matte (track), Composite Using (Matte Alpha/Matte Luma), Reverse. Since 22.x it follows the matte track's transforms. |
| **Ultra Key** | Main chroma keyer (GPU, 32-bit). See the table below. |
| **Difference Matte** (Obsolete) | Keys by comparing against a clean plate. |
| **Remove Matte** | Removes fringes from premultiplied black/white matte (Matte Type: White/Black). |
| Blue Screen Key, Chroma Key, Non Red Key, RGB Difference Key, Garbage Mattes (4/8/16-point) (Obsolete) | Legacy keyers and garbage mattes. Use Opacity masks instead of garbage mattes. |

#### Ultra Key parameters (exact)
| Group | Parameter | Range / default | Function |
|---|---|---|---|
| — | **Output** | Composite / Alpha Channel / Color Channel / Status | View mode. Alpha Channel shows the matte (white = opaque). Status shows a threshold view of partial transparency. |
| — | **Setting** | Default / Relaxed / Aggressive / Custom | Presets for the Matte Generation values. |
| — | **Key Color** | eyedropper | The screen color to remove (usually green/blue). |
| Matte Generation | **Transparency** | 0–100 (def 45) | Transparency of the source keyed over the background. Higher = more transparent in partially keyed areas. |
| | **Highlight** | 0–100 (def 10) | Increases opacity of bright areas of the source (recovers shiny or bright subject parts). |
| | **Shadow** | 0–100 (def 50) | Increases opacity of dark areas (recovers shadows/dark subject parts). |
| | **Tolerance** | 0–100 (def 50) | Filters out colors close to the key color. Raise it to remove more screen, lower it to protect subject colors near the key (prevents spill-adjacent artifacts). |
| | **Pedestal** | 0–100 (def 10) | Filters noise in the alpha (usually from the grain of the screen). Raises the black floor of the matte. |
| Matte Cleanup | **Choke** | 0–100 (def 0) | Shrinks the alpha matte edge inward (erode). |
| | **Soften** | 0–100 (def 0) | Blurs the matte edge (box blur). |
| | **Contrast** | 0–100 (def 0) | Adjusts the contrast of the alpha channel (crushes gray into black/white). |
| | **Mid Point** | 0–100 (def 50) | Balance point for the Contrast operation. |
| Spill Suppression | **Desaturate** | 0–50 (def 25) | Desaturates the spill color near the edge. |
| | **Range** | 0–100 (def 50) | How much spill to correct. |
| | **Spill** | 0–100 (def 50) | Amount of spill compensation (shifts toward the complement). |
| | **Luma** | 0–100 (def 50) | Restores original luminance after spill removal. |
| Color Correction | **Saturation** | 0–200 (def 100) | Foreground saturation. |
| | **Hue** | −180–180 | Foreground hue rotation. |
| | **Luminance** | 0–200 (def 100) | Foreground brightness. |

**[editcut]** The Ultra Key model: compute the chroma distance from the key color in YUV/UV space. Alpha = smoothstep(tolerance-based inner/outer) × highlight/shadow weighting by luma. Then morphological choke, blur soften, contrast curve around midpoint. Spill: clamp the key channel (G' = min(G, (R+B)/2)-style) blended by spill/range, re-add luma.

### 2.10 Noise & Grain
| Effect | What it does |
|---|---|
| **Dust & Scratches** | Median-based cleanup (Radius, Threshold, Operate on Alpha). |
| **Median (Legacy)** | Median filter (Radius), painterly look. |
| **Noise** | Amount of Noise %, Noise Type (Use Color Noise), Clipping (Clip Result Values). |
| **Noise Alpha** | Adds noise to alpha: Uniform/Squared Random/Animation, Amount, Original Alpha (Add/Clamp/Scale/Edges), Overflow, Random Seed, Noise Options (Animate). |
| **Noise HLS / Noise HLS Auto** | Hue/Lightness/Saturation noise with Grain Size, Phase/Speed (Auto animates). |

### 2.11 Perspective
| Effect | What it does |
|---|---|
| **Basic 3D** | Swivel (Y), Tilt (X), Distance to Image (Z), Specular Highlight, Preview (Draw Wireframe). |
| **Bevel Alpha** | Bevel on the alpha edge (Edge Thickness, Light Angle, Light Color, Light Intensity). |
| **Bevel Edges** | Bevels the rectangular layer edges (thickness, light angle/color/intensity). |
| **Drop Shadow** | Shadow Color, Opacity, Direction, Distance, Softness, Shadow Only. Effect-order dependent (put it after Transform effects). |
| **Radial Shadow** | Shadow cast from a point light source (Light Source, Projection Distance, Softness, Render: Regular/Glass Edge, Color Influence, Shadow Only, Resize Layer). |

### 2.12 Stylize
| Effect | What it does |
|---|---|
| **Alpha Glow** | Glow around the alpha edges (Glow, Brightness, Start/End Color, Fade Out). |
| **Brush Strokes** | Painterly strokes (Stroke Angle, Brush Size, Stroke Length, Density, Randomness, Surface: Paint on Original/Transparent/White/Black). |
| **Color Emboss** | Emboss preserving color (Direction, Relief, Contrast, Blend). |
| **Emboss** | Gray emboss. |
| **Find Edges** | Edge detection (Invert, Blend With Original). |
| **Mosaic** | Pixelation into blocks (Horizontal/Vertical Blocks, Sharp Colors). Common for face blur together with a mask + tracking. |
| **Posterize** | Levels per channel (2–255). |
| **Replicate** | Tiles the image Count×Count. |
| **Roughen Edges** | Fractal edge erosion (Edge Type, Edge Color, Border, Edge Sharpness, Fractal Influence, Scale, Stretch, Offset, Complexity, Evolution). |
| **Solarize** | Inverts tones above a Threshold. |
| **Strobe Light** | Flashes: Strobe Color, Blend With Original, Strobe Duration/Period (sec), Random Strobe Probability, Strobe (Operates on Color Only/Makes Layer Transparent), Strobe Operator (Copy/Add/Subtract/Multiply/Difference/…). |
| **Texturize** | Uses another track's texture (Light Direction, Texture Contrast, Texture Placement: Tile/Center/Stretch). |
| **Threshold** | Pure black-and-white at a Level. |

### 2.13 Time
| Effect | What it does |
|---|---|
| **Echo** | Composites time-offset copies: Echo Time (sec, negative = previous frames), Number of Echoes, Starting Intensity, Decay, Echo Operator (Add, Maximum, Minimum, Screen, Composite in Back/Front, Blend). |
| **Posterize Time** | Locks the effective frame rate (e.g. 12 fps for a stop-motion look). |

### 2.14 Transform
| Effect | What it does |
|---|---|
| **Auto Reframe** | AI (Sensei) reframes to a new aspect while tracking the subject: Motion Preset (Slower Motion / Default / Faster Motion), Reframe Offset, Reframe Scale, Reframe Rotation, Generate Keyframes. Applied by Sequence > Auto Reframe Sequence, which creates a new sequence with a target aspect (Square 1:1, Vertical 9:16, 4:5, Horizontal 16:9, Custom) and Clip Nesting options. |
| **Crop** | Left/Top/Right/Bottom %, Zoom (scale to fill), Edge Feather. |
| **Edge Feather** | Feathers the rectangular frame edges by Amount. |
| **Horizontal Flip / Vertical Flip** | Mirrors the image. |
| Camera View / Horizontal Hold / Vertical Hold (Obsolete) | Legacy 3D camera view and TV hold/roll effects. |

### 2.15 Transition (effects used as keyframeable transitions)
| Effect | What it does |
|---|---|
| **Block Dissolve** | Transition Completion %, Block Width/Height, Feather, Soft Edges. |
| **Gradient Wipe** | Wipes based on the luminance of a Gradient Layer (Transition Completion, Softness, Invert, Gradient Placement). |
| **Linear Wipe** | Transition Completion, Wipe Angle, Feather. Often used as a quick reveal. |
| **Radial Wipe** | Clock-like wipe: Start Angle, Wipe Center, Wipe (Clockwise/CCW/Both), Feather. |
| **Venetian Blinds** | Stripe wipe: Direction, Width, Feather. |

### 2.16 Utility
| Effect | What it does |
|---|---|
| **Cineon Converter** | Converts 10-bit log Cineon/DPX to linear/video: Conversion Type (Log to Linear / Linear to Log / Log to Log), 10-bit Black Point, Internal Black Point, 10-bit White Point, Internal White Point, Gamma, Highlight Rolloff. |

### 2.17 Video
| Effect | What it does |
|---|---|
| **Clip Name** | Burns in the clip name (Position, Alignment, Size, Opacity, Display: Sequence Clip Name / Project Item Name / File Name, Source Track). |
| **Metadata & Timecode Burn-in** (newer builds) | Burns metadata/timecode text overlays. |
| **SDR Conform** | Tone-maps HDR to SDR (Brightness, Contrast, Soft Knee) for HLG/PQ to Rec.709 deliveries. |
| **Simple Text** | Basic text (legacy). |
| **Timecode** | Timecode burn-in: Position, Size, Opacity, Field Symbol, Format (SMPTE/Frames/Feet+Frames 16/35mm), Timecode Source (Clip/Media/Generate), Time Display (fps), Offset, Starting Timecode, Label Text. |

### 2.18 Obsolete (kept for project compatibility)
Auto Color, Auto Contrast, Auto Levels, Bend, Blue Screen Key, Broadcast Colors, Camera Blur, Camera View, Chroma Key, Color Balance (RGB—in some builds), Difference Matte, Fast Blur, Fast Color Corrector, Garbage Mattes (4/8/16-point), Horizontal/Vertical Hold, Image Matte Key, Luma Corrector, Luma Curve, Non Red Key, RGB Color Corrector, RGB Curves, RGB Difference Key, Shadow/Highlight, Spherize (some builds), Three-Way Color Corrector, Tiles, and others. They still render, but some aren't GPU-accelerated.

### 2.19 Film Impact library (built into Premiere 25.5+, all GPU, real-time)
Adobe acquired Film Impact in 2025. The library ships 90+ effects, transitions and motion/text animations. In the Effects panel they sit under four categories: **Essential, Lights & Blurs, Motion, Tools** (video effects), plus matching transition bins. Each has a **"Surprise Me!"** button that randomizes parameters into variations, and many have built-in curve editors, color pickers and custom blend modes. The Film Impact Dashboard is at Window > Extensions. Exact names may appear with or without the old "Impact" prefix.

| Category | Representative items (from Film Impact's catalog and Adobe docs) |
|---|---|
| Essential | Vignette (shaped), Grain/Noise, Chromatic Aberration (RGB split), Channel shifts for mixed lighting, Color Ramp / Gradient, Frame/Border, Long Shadow, Mosaic, Solarize, Glitch, VHS Damage |
| Lights & Blurs | Glow, Light Leaks, Chroma Leaks, Flare, Flash, Light Sweep, Rays (volumetric), Halation, Glints/Sparkle, Bokeh / Lens Blur, Zoom Blur, Radial Blur, Directional Blur, Blur Dissolve, Blur to Color |
| Motion | Camera Shake (realistic handheld shake; memory fix in 26.3), Wiggle, Grow, Pop, Sweep, Spin, Roll, Stretch, Text animators (typewriter, 2D→3D extrusion of titles with depth and shadows) |
| Tools | Utility helpers: Clone/Copy Machine, Mirror/Kaleido, Shape tools, Alpha tools, Long-shadow, Grid/Guide |
| Transitions | Push, Slide, Split, Stretch, Spin, Roll, Zoom Blur, Directional Blur, Blur to Color, Flash, Light Leaks, Glow, Rays, Lens Blur, Glitch, VHS Damage, Earthquake, Chaos, Kaleido, Copy Machine, Mosaic, Solarize, Burn (Alpha/Chroma/White), Clock Wipe, Linear Wipe, Plateau Wipe, Stripes, Shape Flow, Wave, Glass, Luma Fade, 3D Blinds, 3D Block, 3D Cube, 3D Flip, 3D Roll, 3D Spin, **3D Spinback** and **3D Slide** (26.3) |

### 2.20 2025–2026 additions summary
| Release | New effects / GPU |
|---|---|
| 25.0–25.2 | Lumetri color-space-aware; GPU acceleration expanded; Properties panel quick controls (Transform, Crop, Opacity, Lumetri basics, Audio) |
| 25.5 | Film Impact 90+ GPU effects/transitions/animations |
| 26.0 | AI **Object Mask** (available on any effect's mask list plus Opacity), redesigned shape masks, on-clip transition handles |
| 26.2 | Object Mask Sharp/Smooth edge quality |
| 26.3 | **Magnify** (new), **Channel Blur, Gradient, Noise** (new GPU effects), **Shape Dissolve** transition, **3D Spinback, 3D Slide** transitions |

### 2.21 Applying effects (behaviors)
- Drag onto a clip, double-click with the clip selected, or drag onto a selection of clips (applies to all). Drag onto an **adjustment layer** (File > New > Adjustment Layer) to affect everything beneath it on lower tracks.
- **Master clip effects:** apply in the Source Monitor/Effect Controls to the master clip. It then affects every instance of that clip in all sequences, shown as a red-underlined fx badge.
- **fx badge colors** on timeline clips: gray = no effects changed. Yellow = an intrinsic effect (Motion/Opacity/Time Remap/Volume) was modified. Purple = a non-intrinsic effect was applied. Green = intrinsic modified *and* a standard effect applied. A red underline = master clip effect present.
- **Render bar colors** (timeline top): **Red** = needs rendering to play in real time; **Yellow** = probably plays in real time (GPU effects); **Green** = render preview file exists; none = native playback.
- **Effect enable toggle:** the fx button per effect, plus a global **Global FX Mute** button in the Program Monitor (button editor) that disables all effects for playback.

---

## 3. Video Transitions

### 3.1 Built-in video transitions by category
| Category | Transitions (and what they do) |
|---|---|
| **3D Motion** | **Cube Spin** (A and B are faces of a rotating cube), **Flip Over** (A flips to reveal B; Bands, Fill Color options). |
| **Dissolve** | **Additive Dissolve** (adds the colors of A and B, so it brightens), **Cross Dissolve** (linear opacity A→B, the default), **Dip to Black**, **Dip to White**, **Film Dissolve** (dissolve in linear gamma, more film-like), **Morph Cut** (AI face/flow interpolation to hide jump cuts in talking heads; analyzes in the background), **Non-Additive Dissolve** (brighter pixels of B appear first), **Shape Dissolve** (26.3: geometric shape-based blend with shape/motion/timing controls). |
| **Iris** | **Iris Box**, **Iris Cross**, **Iris Diamond**, **Iris Round**: B appears through a growing shape. Center adjustable, plus Border Width, Border Color, Anti-aliasing quality. |
| **Page Peel** | **Page Peel** (A curls off the page), **Page Turn** (A turns over like a page, showing a mirror image). |
| **Slide** | **Band Slide** (bands slide in), **Center Split** (A splits into 4 and slides out), **Push** (B pushes A off screen), **Slide** (B slides over A), **Split** (A splits in two to reveal B), **Whip** (fast blur slide, the old "Whip" from 2020+). |
| **Wipe** | **Band Wipe**, **Barn Doors**, **Checker Wipe**, **CheckerBoard**, **Clock Wipe**, **Gradient Wipe** (uses an image as the luminance map; Softness), **Inset**, **Paint Splatter**, **Pinwheel**, **Radial Wipe**, **Random Blocks**, **Random Wipe**, **Spiral Boxes**, **Venetian Blinds**, **Wedge Wipe**, **Wipe**, **Zig-Zag Blocks**. |
| **Zoom** | **Cross Zoom** (A zooms in, B zooms out from the same point). |
| **Immersive Video** (GPU, seam-aware) | **VR Chroma Leaks**, **VR Gradient Wipe**, **VR Iris Wipe**, **VR Light Leaks**, **VR Light Rays**, **VR Mobius Zoom**, **VR Random Blocks**, **VR Spherical Blur**. |
| **Film Impact transitions** (25.5+) | See 2.19 (Push, Glitch, Kaleido, Earthquake, Chaos, VHS Damage, Light Leaks, Zoom Blur, 3D series, etc.). |

Legacy transitions removed or merged in older versions (3D Motion: Center Peel, Curtain, Doors, Fold Up, Spin, Spin Away, Swing In/Out, Tumble Away; Stretch category; Map category; Special Effect) no longer appear in current builds.

### 3.2 Transition options (Effect Controls when a transition is selected)
| Option | Meaning |
|---|---|
| **Duration** | Timecode length. The default is set in Preferences > Timeline: **Video Transition Default Duration** (1.00 sec, or frames), **Audio Transition Default Duration** (1.00 sec). |
| **Alignment** | **Center at Cut** (straddles the edit and uses handles from both clips), **Start at Cut** (all on clip B's head, uses B's head handles), **End at Cut** (all on clip A's tail), **Custom Start** (after manual dragging). |
| **A/B preview + Show Actual Sources** | Thumbnails of A and B. Show Actual Sources displays the real frames. |
| **Start / End sliders** | % completion at the start and end (e.g. start a wipe at 20%). |
| **Direction selectors** | Arrow triangles around the thumbnail (for wipes, push, slide). |
| **Reverse** | Plays the transition backward. |
| **Border Width / Border Color** | For wipes and iris transitions. |
| **Anti-aliasing Quality** | Off / Low / Medium / High. |
| **Custom…** | Transition-specific options (e.g. bands count, Gradient Wipe image). |
| **Timeline view in Effect Controls** | Shows A (top track), the transition, and B (bottom track). Drag the edit line (roll), the transition edge, or the clips (slip within handles). |

### 3.3 Applying transitions
- **Default video transition:** Cross Dissolve. Right-click a transition in the Effects panel and choose **Set Selected as Default Transition** (blue outline).
| Command | macOS | Windows | Behavior |
|---|---|---|---|
| Apply Video Transition | **Cmd+D** | **Ctrl+D** | Adds the default video transition at the edit point nearest the playhead, on targeted video tracks. With a clip selected, it goes on that clip's nearest edge. |
| Apply Audio Transition | **Cmd+Shift+D** | **Ctrl+Shift+D** | Adds the default audio transition (Constant Power) at the nearest edit on targeted audio tracks. |
| Apply Default Transitions to Selection | **Shift+D** | **Shift+D** | Adds default video and audio transitions to both ends of every selected clip, at every edit between them and at single-sided ends. |
- **Handles:** a transition needs unused media beyond the edit. Without handles, Premiere warns "Insufficient media. This transition will contain repeated frames" and freezes the last/first frame (shown as diagonal hatch on the transition).
- **Single-sided transition:** apply to a clip end with no adjacent clip (e.g. Dip to Black for a fade out); it transitions from or to transparency.
- **Replace:** drag a new transition onto an existing one (keeps duration and alignment).
- **Change duration:** drag the transition edge in the timeline, double-click it for the duration dialog, or right-click > Set Transition Duration.
- **On-clip transition handles (26.0+):** hover over a clip end to reveal handles that add or adjust transitions directly on the clip.
- **Copy/paste transitions:** select the transition, Cmd/Ctrl+C, then select edit points or clips and paste.
- **Audio transitions** (Section 5.8): Constant Gain, Constant Power (default), Exponential Fade.


---

## 4. Lumetri Color, Scopes, Color Management

### 4.0 Architecture
- **Lumetri Color panel** (Window > Lumetri Color; **Color workspace**) is a UI for the **Lumetri Color effect** on the selected clip, at the playhead clip on the topmost targeted track. Each clip can hold **multiple Lumetri instances**. The dropdown at the top of the panel picks which instance to edit, and "Add Lumetri Color Effect" creates a new one (rename via the Effect Controls panel). Each instance is one effect node with the sections processed in this fixed order:
  **Basic Correction → Creative → Curves → Color Wheels & Match → HSL Secondary → Vignette.**
- Each section has an enable **checkbox** (bypass), a **Reset**, and the panel menu offers Show/Hide sections and **Export .cube / .look** (bake the current grade to a LUT).
- Lumetri is GPU-accelerated and 32-bit float.
- **Comparison/before-after:** Program Monitor > Comparison View (split, side-by-side, horizontal/vertical) and the fx bypass toggle on Lumetri.
- **Properties panel (25.x)** shows a compact Lumetri section (Auto, Temp, Tint, Exposure, Contrast, Saturation and Look) for quick fixes.

### 4.1 Basic Correction
| Control | Range / default | What it does |
|---|---|---|
| **Input LUT** | dropdown: None, built-in camera LUTs (ARRI, Canon, Panasonic, RED, Sony, etc.), Browse… | Technical conversion LUT applied first (e.g. Log → Rec.709). In 25.x color-managed workflows it's mostly replaced by **automatic input color-space tone mapping** (log/raw recognized from metadata), but it's still available for custom LUTs. |
| **Color space/tone mapping (25.x)** | per-clip override via Interpret Footage / Clip > Modify > Color; Sequence > Settings > Color | Lumetri in 25.2+ is **color-space aware**: controls behave consistently whether footage is log, raw, Rec.709 or HDR, because grading happens in the sequence working space and tone mapping to the output space happens after. |
| **HDR White / HDR Specular** | shown when the sequence is HDR (Rec.2100 HLG/PQ) | HDR White sets the reference white nits level that the sliders scale to (e.g. 100–10,000). HDR Specular controls the brightest speculars. |
| **Auto** (formerly Auto Tone) | button | **Adobe Sensei** analyzes the frame and sets Exposure, Contrast, Highlights, Shadows, Whites, Blacks and Saturation (it doesn't set WB). Values can then be tweaked. |
| **Reset** | button | Zeroes the Basic section. |
| **White Balance Selector** | eyedropper | Click a neutral (white/gray) area; Temperature and Tint are computed to neutralize it. |
| **Temperature** | −100 to +100 (0) | Blue ↔ yellow/orange axis. Positive = warmer. |
| **Tint** | −100 to +100 (0) | Green ↔ magenta axis. Positive = magenta. |
| **Saturation** | 0–200 (100) | Uniform saturation multiplier. 0 = monochrome. |
| **Exposure** | −5.0 to +5.0 (0) | Brightness in stops-like units; a multiplicative gain biased toward highlights, affecting the whole range. |
| **Contrast** | −100 to +100 (0) | Expands or compresses tones around midgray (S-curve). Mostly affects the mids, with soft rolloff. |
| **Highlights** | −100 to +100 (0) | Recovers (negative) or brightens (positive) bright areas. Smart rolloff recovers highlight detail. |
| **Shadows** | −100 to +100 (0) | Lifts (positive) or deepens (negative) dark areas without touching blacks much. |
| **Whites** | −100 to +100 (0) | Sets the white clipping point (the top of the waveform). |
| **Blacks** | −100 to +100 (0) | Sets the black point (the bottom of the waveform). |

Grouped in the panel as: **Color** (WB selector, Temp, Tint, Saturation) and **Light** (Exposure, Contrast, Highlights, Shadows, Whites, Blacks). Older builds (pre-2023) had "Tone" naming.

### 4.2 Creative
| Control | Range / default | What it does |
|---|---|---|
| **Look** | dropdown + Browse (.cube/.look/.itx) | Applies a **creative LUT** (e.g. SL Blue/Gold presets, Kodak/Fuji film emulations, Cinespace). A preview thumbnail lets you click arrows to cycle and click the image to apply. |
| **Intensity** | 0–200 (100) | Mix of the Look: 0 = off, 100 = full LUT, above 100 extrapolates. |
| **Faded Film** | 0–100 (0) | Lifts blacks and compresses dynamic range for a matte, washed-out film look (raises the toe of the curve). |
| **Sharpen** | −100 to +100 (0) | Edge definition. Positive sharpens, negative softens. |
| **Vibrance** | −100 to +100 (0) | Smart saturation: boosts low-saturated colors more and protects skin tones and already-saturated colors. |
| **Saturation** | 0–200 (100) | Uniform saturation (in addition to Basic). |
| **Shadow Tint** | color wheel | Adds a color cast to the shadows (split toning). The center = no tint. |
| **Highlight Tint** | color wheel | Adds a color cast to the highlights. |
| **Tint Balance** | −100 to +100 (0) | Biases the split-tone crossover toward shadow (negative) or highlight (positive) tint. |

### 4.3 Curves
**RGB Curves**
| Control | What it does |
|---|---|
| **Master (white) curve** | Luma/RGB master tone curve. Click to add points (up to about 16), drag, Cmd/Ctrl-click or double-click to delete. Double-click the empty area to reset. |
| **Red / Green / Blue** channel curves | Per-channel tone curves. |
| **HDR Range** slider | (HDR sequences only) Sets the max nits mapped by the curve graph. |

**Hue Saturation Curves** (each has an eyedropper that samples a color from the Program Monitor and creates 3 control points: the center at the sampled hue plus 2 bounds; 2D graph; double-click to reset)
| Curve | X axis | Y axis | Use |
|---|---|---|---|
| **Hue vs Saturation** | Hue | Saturation change | Desaturate a particular color (e.g. reduce greens). |
| **Hue vs Hue** | Hue | Hue shift | Shift one hue to another (e.g. orange → teal). |
| **Hue vs Luma** | Hue | Luma change | Darken or brighten a particular hue (e.g. darken a blue sky). |
| **Luma vs Saturation** | Luma | Saturation change | Desaturate shadows or highlights (classic: remove color from crushed blacks). |
| **Saturation vs Saturation** | Input saturation | Saturation change | Compress or expand saturation (boost the dull, tame the overly saturated). |

### 4.4 Color Wheels & Match
| Control | What it does |
|---|---|
| **Comparison View** | Toggles the Program Monitor into a comparison: a **reference frame** (scrub with a slider or timecode to any frame in the sequence) next to the **current frame**. Layouts: Side by Side, Vertical Split, Horizontal Split. Shot or Frame. |
| **Apply Match** | **Color Match** (Sensei): analyzes the reference and current frames and sets the **Color Wheels** (and Saturation) to match the reference's color and light. |
| **Face Detection** | checkbox (on by default). When faces are found in both frames, the match prioritizes skin tones. Slower. |
| **Shadows / Midtones / Highlights wheels** | Three wheels (Lift/Gamma/Gain-style). Drag the center puck to shift hue/sat in that tonal range. Double-click to reset. |
| **Luminance slider** per wheel | Vertical slider beside each wheel (−100…+100): brightens or darkens that tonal range. |
| **Hollow vs filled wheel** | Wheel icon fills when it has been modified. |
| (HDR / sequence) | Wheels adapt to HDR ranges in HDR sequences. |

### 4.5 HSL Secondary
**Key** (qualify a range of color)
| Control | What it does |
|---|---|
| **Set color** eyedropper | Samples a color to start the key (Cmd/Ctrl-click = 5×5 average). |
| **+ / − eyedroppers** | Add to or remove from the selected color range. |
| **Color presets** | Swatches for quick selection (red, yellow, green, cyan, blue, magenta, and a skin-tone preset). |
| **H / S / L sliders** | Each has range handles (top triangles = hard range) and softness/feather handles (bottom triangles = falloff). Drag the middle to offset. Uncheck a channel to ignore it (e.g. key by luma only). |
| **Color/Gray toggle (Show Mask)** | Preview: Color/Gray (selected in color, rest gray), Color/Black, White/Black (pure matte). |
| **Invert Mask** | Selects everything except the key. |
| **Reset** | Clears the key. |

**Refine**
| Control | Range | What it does |
|---|---|---|
| **Denoise** | 0–100 | Smooths noise or chatter in the key matte (temporal-ish smoothing of edges). |
| **Blur** | 0–100 | Softens the matte (Gaussian). |

**Correction** (applied only inside the key)
| Control | What it does |
|---|---|
| **Wheel(s)** | Toggle between a single **Midtone** wheel or **three wheels** (Shadows/Midtones/Highlights) for the selection. |
| **Temperature / Tint** | WB shift for the selection. |
| **Contrast** | Contrast within the selection. |
| **Sharpen** | Sharpening within the selection. |
| **Saturation** | Saturation within the selection (0–200). |

**[editcut]** HSL key → soft mask m(x) = f_H·f_S·f_L, where each is a trapezoid (hard range plus feather) in HSL space (hue is circular). Then refine: blur (Gaussian), denoise (median/temporal). Then color correction lerp(orig, corrected, m).

### 4.6 Vignette
| Control | Range / default | What it does |
|---|---|---|
| **Amount** | −5.0 to +5.0 (0) | Negative darkens the edges, positive lightens them. |
| **Midpoint** | 0–100 (50) | Size of the unaffected center area. Lower = the vignette reaches further toward the center. |
| **Roundness** | −100 to +100 (0) | Negative = more rectangular (follows frame aspect), positive = more circular. |
| **Feather** | 0–100 (50) | Edge softness. 0 = hard edge. |
The vignette is relative to the clip frame, not the sequence. For sequence-wide vignettes, put it on an adjustment layer.

### 4.7 Lumetri Scopes panel (Window > Lumetri Scopes)
Right-click (or the wrench icon) to choose scopes, which can be combined in a layout.

| Scope | Variants / options | What it shows |
|---|---|---|
| **Vectorscope YUV** | Rec.601 / Rec.709 / Rec.2020 targets, **75% / 100% targets**, Skin tone line (I-line), Brightness | Chroma (U/V) plotted as angle = hue and distance from center = saturation. Targets for R, Mg, B, Cy, G, Yl. |
| **Vectorscope HLS** | | Hue, Saturation, Lightness view (hue around the circle, saturation as radius) with a more intuitive display. |
| **Histogram** | | Count of pixels per luma/RGB level; vertical orientation in Premiere with levels on the Y axis. Shows clipping. |
| **Parade** | **RGB**, **YUV**, **RGB-White**, **YUV-White** | Side-by-side waveforms per channel. Balance/neutrality check. |
| **Waveform** | **RGB** (overlaid), **Luma**, **YC** (luma + chroma), **YC no Chroma** | X = image position (left to right), Y = signal level (0–100 IRE or nits in HDR). |
| **Settings** | **Colorspace**: Automatic / Rec.601 / Rec.709 / Rec.2020 / Rec.2100 HLG / Rec.2100 PQ. **Scale**: 8-bit (0–255), Float (0–1), 10-bit, HDR (nits). **Brightness**: Dimmed / Normal / Bright. **Clamp signal**. **Presets**. | |

### 4.8 Color management & HDR (25.x / 26.x)
| Setting | Location | Meaning |
|---|---|---|
| **Color Management mode / Working color space** | Sequence > Sequence Settings > Color (25.x consolidated "Color Settings") | Choose: **Direct Rec.709 (SDR)**, **Rec.2100 HLG**, **Rec.2100 PQ**, or **Wide Gamut (ACEScct / "Wide Gamut" scene-referred)**. Since 25.2, color-managed workflows auto-convert log/raw to the working space. |
| **Output color space** | Sequence settings | Rec.709 (SDR), Rec.2100 HLG, Rec.2100 PQ (HDR) for export. |
| **Auto Tone Map Media** | Sequence settings > Color | Automatically tone maps media from a wider-gamut or HDR source into the sequence space (HDR→SDR and log→display). Uncheck it for manual LUT workflows. |
| **Tone mapping method** | Sequence settings (25.x) | Method choices for tone mapping (e.g. Adobe defaults vs Clip). |
| **Gamut compression** | Sequence settings | Compresses out-of-gamut colors smoothly rather than clipping. |
| **Linear compositing** ("Composite in linear color") | Sequence settings | Blends, dissolves and opacity happen in linear light. |
| **3D LUT Interpolation** | Sequence settings | Trilinear (faster) / Tetrahedral (higher quality). |
| **HDR graphics white (nits)** | Sequence settings | Reference white level for graphics and titles in HDR (e.g. 100, 203, 300 nits). |
| **Clip color space override** | Project panel > Modify > Interpret Footage > Color Management: **Color Space Override**, **Input LUT**, **Preserve RGB**, Log detection ("Use Media Color Space" / override to Log/RAW specific spaces e.g. ARRI LogC3/4, Sony S-Log3/S-Gamut3.Cine, Canon Log 2/3, RED Log3G10, Panasonic V-Log, Apple Log, DJI D-Log) | Overrides auto-detected color space. |
| **RAW source settings** | Source Settings (Effect Controls > Master) | Per-format RAW decode (ISO, WB, debayer quality, etc.). |
| **Display Color Management** | Preferences > Color (23.x+; in older builds Preferences > General). **Enable Display Color Management** requires GPU acceleration. | Uses the OS display profile so the viewer is accurate on a P3 / wide-gamut screen. |
| **Viewer Gamma** | Preferences / Program Monitor | QuickTime 1.96 / Broadcast 2.4 / Web 2.2 (macOS display compensation). |
| **Extended Dynamic Range Monitor** | Preferences (HDR displays) | Shows HDR on an XDR-capable display. |

**HDR grading notes:** the Lumetri HDR checkbox per section (older builds) enables an expanded range. Scopes switch to nits (HDR scale). Export HDR requires a supporting codec (HEVC Main10, ProRes 422 HQ/4444, DNxHR HQX/444, AV1 10-bit) and HDR metadata (Mastering Display Color Volume, MaxCLL, MaxFALL, in the Export Video tab "HDR graphics" / "Include HDR10 metadata").

### 4.9 LUTs in Premiere
- **Formats:** .cube (1D/3D), .look (Adobe SpeedGrade), .3dl (some), .itx.
- **Where applied:** Basic Correction **Input LUT** (technical), Creative **Look** (creative), Interpret Footage **Input LUT** (clip-level, for all instances), Export **Effects > Lumetri Look/LUT** (output transform at export).
- **Custom LUT folder:** place .cube files in `/Library/Application Support/Adobe/Common/LUTs/Creative` or `/Technical` (macOS) or `C:\Program Files\Adobe\Common\LUTs\Creative|Technical` (Windows), so they appear in the dropdowns without browsing.
- **Export LUT:** Lumetri panel menu > Export .cube / .look bakes the current Lumetri instance.
- Premiere processes 3D LUTs in 32-bit float with trilinear or tetrahedral interpolation, chosen in the sequence setting.

### 4.10 Adjustment layers for grading
- **File > New > Adjustment Layer** (or the Project panel New Item button). It's a transparent clip the size of the sequence. Effects on it apply to the composite of all tracks **below** it.
- Typical stack: per-clip Lumetri (balance/match) → an adjustment layer above with Lumetri for the scene look → a top-track adjustment layer for the overall film look, vignette, grain or LUT.
- Opacity on the adjustment layer = mix of the effect. Blend modes apply. Masks on an adjustment layer's Lumetri/Opacity restrict the area.
- Motion on an adjustment layer transforms everything below (e.g. a camera shake on all layers).
- **[editcut]** Implement it as a compositing node: render the stack below it → apply its effects → lerp with the input by opacity/mask.

### 4.11 Color Mode (beta, NAB 2026)
A dedicated grading environment separate from the Lumetri panel. It's 32-bit, GPU-accelerated (NVIDIA RTX-optimized), and has its own workspace: **Color Monitor**, **Clip Grid** (thumbnails of every shot for shot-to-shot navigation and matching), **Color Controls**, **Comparison View** and **Video Scopes**. It won NAB 2026 Best Software. It's still beta as of late 2026, so its parameters may change.

### 4.12 Other color-related features
- **Color Match** (Sensei): Section 4.4.
- **Auto (Auto Tone):** Section 4.1.
- **Lumetri Presets** bin in Effects: Cinematic, Filmstocks, Speedlooks (camera-specific Log presets), Technical (LUTs, Legal Range).
- **Broadcast-safe** output: Video Limiter effect or the Export Effects tab **Video Limiter**.
- **Remove Color / Interpret Footage Alpha:** Ignore Alpha, Invert Alpha, Premultiplied/Straight interpretation.
- **Media color space display**: Project panel column "Color Space" (25.x).


---

## 5. Audio

### 5.0 Audio signal flow (per clip, per track, to the master)
```
Source channels → [Modify > Audio Channels mapping] → Audio Gain (clip, G)
  → Clip effects (Volume, Channel Volume, Panner + any applied clip effects, in Effect Controls order;
     Essential Sound applies its chain as clip effects)
  → Track: Pre-fader inserts (effects 1–5) → Pre-fader sends
  → Track fader (Volume) + Track Pan/Balance → Post-fader inserts → Post-fader sends
  → Track output (Master or a Submix) → Submix inserts/fader → Master inserts → Master fader → Output/Export
```
Defaults: track inserts are pre-fader. Sends default to post-fader (toggle per send).

### 5.1 Essential Sound panel (Window > Essential Sound; Audio workspace)
**Workflow:** select clips → assign a **type** (tag) → use the type-specific controls. Tagging stores a preset chain as clip effects (visible in Effect Controls as Essential Sound effects). Presets per type (e.g. Dialogue: Balanced Female/Male Voice, Podcast Voice, Make it sound like phone/radio/outdoor, Clean up noisy dialogue). **Auto-tagging (24.x+)**: Sensei auto-detects clip type, shown as interactive **audio category badges** on timeline clips. Clicking a badge opens the relevant Essential Sound tab.

**Common: Clip Volume** (at the bottom of every type): **Level** (dB slider; adds to the clip Volume) and **Mute**.

#### Dialogue
| Group | Control | Range | Function |
|---|---|---|---|
| **Loudness** | **Auto-Match** | button | Analyzes integrated loudness and applies a clip gain so the clip hits the standard dialogue target (−23 LUFS by default, ITU BS.1770/EBU R128). Shows the result in LUFS. A **Reset** button. |
| **Enhance (AI) / Enhance Speech** | toggle + **Mix Amount** (0–10) | | Adobe's AI speech enhancement (from Adobe Podcast) rebuilds the voice to sound studio-recorded and removes noise and reverb. Processing runs in the background; **Mix Amount** blends enhanced vs original (lower = more natural). Clip-level, and works best on dialogue in supported languages. |
| **Repair** | **Reduce Noise** | 0–10 | Broadband noise reduction (Adaptive denoiser) for hiss/hum/background. |
| | **Reduce Rumble** | 0–10 | Low-frequency rumble reduction (sub-80 Hz high-pass/dynamic). |
| | **DeHum** | 0–10 + **50 Hz / 60 Hz** | Removes electrical hum and its harmonics at the selected mains frequency. |
| | **DeEss** | 0–10 | Reduces harsh sibilance ("s" sounds) around 4–10 kHz. |
| | **Reduce Reverb** | 0–10 | Dereverberation: reduces room echo. |
| **Clarity** | **Dynamics** | 0–10 | Compression/expansion for consistent level (narrows dynamic range; more = more compressed and gated). |
| | **EQ** | presets + Amount 0–10 | EQ presets: Subtle Voice Clarity, Background Voice, Podcast Voice, Vocal Presence, Bass Boost, Low-cut, Telephone, Tame Brightness, etc. |
| | **Enhance Speech** (legacy Clarity) | **Male / Female** voice-type selector | Tunes the clarity EQ for low or high pitched voices. |
| **Creative** | **Reverb** | presets + Amount | Adds room ambience (Auditorium, Large Reflective Room, Outside Club, Warm Room, Warm Voice Booth, Heavy Reverb, Light Reverb, Thick Reverb...). |

#### Music
| Group | Control | Function |
|---|---|---|
| **Loudness** | Auto-Match | Matches music to a lower default target (approx −25 LUFS) so it sits under dialogue. |
| **Duration** | Method: **Stretch** or **Remix** + **Target Duration** | **Stretch**: time-stretches the clip (changes speed while preserving pitch), which suits small adjustments only. **Remix**: Sensei reassembles the musical segments to hit the target length (see 5.10). |
| **Ducking** | **Duck against**: Dialogue / Music / SFX / Ambience / Untagged clips (multi-select icons) | Automatically creates volume keyframes on music where the selected types play. |
| | **Sensitivity** | 0–10 threshold. How easily the ducking triggers (more = more ducks). |
| | **Reduce By** | dB depth of the duck (e.g. −18 dB default). |
| | **Fades** | Fade length in ms/sec for duck ramps (also called Fade Duration). |
| | **Fade Position** | Outside/Inside: whether ramps occur before the dialogue starts or overlap it (newer builds). |
| | **Generate Keyframes** | Writes the Volume keyframes. Re-generate after edits. |

#### SFX
| Group | Control | Function |
|---|---|---|
| **Loudness** | Auto-Match | Matches to an SFX target. |
| **Creative** | Reverb (presets, Amount) | Room ambience. |
| **Pan** | Position (L–R) | Positions the effect in the stereo field. |

#### Ambience
| Group | Control | Function |
|---|---|---|
| **Loudness** | Auto-Match | |
| **Creative** | Reverb (presets, Amount) | |
| **Stereo Width** | 0–10 | Widens or narrows the stereo image. |
| **Ducking** | Same as Music | Ambience can duck under dialogue. |

### 5.2 Enhance Speech (standalone details)
- Available in Essential Sound > Dialogue (24.x+, originally beta 2023). It's AI from the Adobe Podcast "Enhance" model, processed locally (no upload) in current versions.
- **Mix Amount** default about 7 (0–10). Enhanced audio is cached as a new rendered file. The clip shows a processing indicator while it runs.
- It works on any language (trained mostly on English). It can strip intentional ambience; lower the Mix to retain some room.

### 5.3 Audio Track Mixer (Window > Audio Track Mixer)
Per-track channel strip (top to bottom):
| Element | Function |
|---|---|
| **Effects & Sends area** (show/hide via the disclosure triangle at the left) | **5 effect insert slots** (dropdown of audio effects; right-click > Pre-Fader / Post-Fader; bypass; double-click to edit) and **5 send slots** (create a send to a new or existing **submix**; per-send level knob, mute, pre/post-fader toggle). |
| **Automation Mode** dropdown | Off / Read / Latch / Touch / Write (below). |
| **Pan / Balance knob** | −100 L … +100 R for stereo/mono tracks. 5.1 tracks have a **5.1 panner** square (drag puck, center %, LFE knob). |
| **Mute (M)**, **Solo (S)**, **Enable Track for Recording (microphone)** | Solo isolates a track. Record arms voice-over. |
| **Volume fader** | −∞ to +6 dB (track gain, keyframable as track keyframes). |
| **VU/peak meter** | Per-channel meters with clip indicators. |
| **Track name & Output assignment** | Route to Master or a Submix. |
| Input selector | Audio input device channel for recording. |

**Automation modes** (track automation is written as **track keyframes**, Volume/Pan/Mute and effect params, viewable via Show Track Keyframes)
| Mode | During playback | When you stop touching | Notes |
|---|---|---|---|
| **Off** | Ignores existing track automation (plays the fader's current static value). Doesn't record. | — | Automation is preserved but not played. |
| **Read** (default) | Plays existing automation. Moving the fader changes the value temporarily but **doesn't record**. | Snaps back to the automation. | Safe mode. |
| **Latch** | Plays automation until you touch a control, then **writes** from that point. | **Keeps writing the last value** until playback stops (latches). | For moves that should hold. |
| **Touch** | Plays automation until touched, then writes. | **Returns** to existing automation at the **Automatch Time** rate (Preferences > Audio, default 1 sec). | For short rides. |
| **Write** | **Writes from playback start** for all writable controls, overwriting existing automation whether or not you touch them. | Keeps writing. | Preference "Switch to Touch after Write" changes the mode after a pass. Also "Minimum Time Interval" / "Linear keyframe thinning" (Preferences > Audio) thin the keyframes. |

### 5.4 Audio Clip Mixer (Window > Audio Clip Mixer)
- Shows one strip per track, but controls the **clip** under the playhead on that track: clip Volume (writes **clip** keyframes), clip Pan/Balance, Mute, Solo, and a **Write Keyframes** toggle (the keyframe/pen icon) per strip.
- Faders range from −∞ to +15 dB, the clip Volume maximum. Meters show the clip signal before track processing.
- Use it for per-clip leveling in real time during playback. Use the Track Mixer for overall track rides.
- Right-click a strip > **Show Channel Volumes** for per-channel faders.

### 5.5 Audio effects list (Effects > Audio Effects)
| Category | Effects (one-line function) |
|---|---|
| **Amplitude & Compression** | **Amplify** (gain per channel, link). **Channel Mixer** (route L/R into new L/R by %). **DeEsser** (sibilance compressor, Broadband/Multiband, threshold, center freq, bandwidth). **Dynamics** (AutoGate, Compressor, Expander, Limiter modules, Soft Clip). **Dynamics Processing** (graph-based dynamics with level detector, gain processor, broadband/multiband). **Hard Limiter** (Maximum Amplitude, Input Boost, Look-ahead, Release, Link Channels). **Multiband Compressor** (4 bands, threshold/gain/ratio/attack/release per band, crossovers, output gain, limiter, Brickwall). **Single-band Compressor** (threshold, ratio, attack, release, output gain). **Tube-modeled Compressor** (warm compression). **Channel Volume** and **Volume** (also intrinsic). |
| **Delay & Echo** | **Analog Delay** (tape/tube/analog modes, Dry/Wet, Delay ms, Feedback, Trash, Spread). **Delay** (simple single delay). **Multitap Delay** (up to 4 taps with feedback and filters). |
| **Filter & EQ** | **Bandpass**, **FFT Filter** (draw a frequency curve), **Graphic Equalizer (10 Bands / 20 Bands / 30 Bands)**, **Highpass**, **Lowpass**, **Notch Filter** (up to 6 notches, for hum), **Parametric Equalizer** (5 bands + HP/LP shelves, Q, gain; the main EQ), **Scientific Filter** (Bessel/Butterworth/Chebyshev/Elliptical), **Simple Parametric EQ**, **Simple Notch Filter**, **Bass**, **Treble**. |
| **Modulation** | **Chorus/Flanger** (voices, delay, rate, depth), **Flanger**, **Phaser**. |
| **Noise Reduction/Restoration** | **Adaptive Noise Reduction** (learns noise automatically), **Automatic Click Remover** (threshold, complexity), **DeHummer** (50/60 Hz notch + harmonics, presets), **DeNoise** (single amount + Gain, Processing Focus, Output Noise Only), **DeReverb** (Amount, Processing Focus, Gain). |
| **Reverb** | **Convolution Reverb** (impulse responses: rooms, halls, custom IR file; Mix, room size, damping LF/HF, pre-delay). **Studio Reverb** (algorithmic: Room size, Decay, Early reflections, Width, High/Low freq cut, Damping, Diffusion, Dry/Wet). **Surround Reverb** (5.1). |
| **Special** | **Distortion** (curve-based waveshaping), **Guitar Suite** (compressor/distortion/amp/filter chain), **Loudness Radar** (a measurement-only meter: ITU BS.1770 loudness, LRA, true peak; target −23 / −24 / −16 LUFS), **Mastering** (EQ, reverb, exciter, widener, loudness maximizer), **Vocal Enhancer** (Male/Female/Music modes), **Binauralizer – Ambisonics** and **Panner – Ambisonics** (for VR ambisonic audio), **Fill Left with Right**, **Fill Right with Left**, **Invert** (phase), **Swap Channels**. |
| **Stereo Imagery** | **Stereo Expander** (Center Channel Pan, Stereo Expand). **Balance** (stereo balance) is uncategorized in some builds. |
| **Time & Pitch** | **Pitch Shifter** (Semi-tones, Cents, Ratio, Formant Preserve, Precision, Splicing frequency, overlapping). |
| **Obsolete** | Legacy (Lowpass/Highpass older versions, Spectral NoiseReduction, MultibandCompressor (Legacy), Chorus (Legacy), Reverb (Legacy), Pitch Shifter (Legacy), DeClicker, DeCrackler, Dynamics (Legacy), EQ (Legacy)…). |
| **VST/AU** | Third-party VST3 and Audio Units (macOS) are scanned via Preferences > Audio > Audio Plug-in Manager (Scan for plug-ins, enable/disable). |

Each audio effect has a **Custom Setup** "Edit…" button that opens its full UI, a **Bypass**, **Presets**, and parameters that are keyframeable. Effects can be applied to clips (Effect Controls), tracks (Track Mixer inserts), submixes, and master.

### 5.6 Audio transitions (Effects > Audio Transitions > Crossfade)
| Transition | Curve | Use |
|---|---|---|
| **Constant Power** (default) | Equal-power: A ∝ cos(πt/2), B ∝ sin(πt/2). Sum power stays constant. | Smooth, natural crossfade between clips with similar levels (like a film dissolve). |
| **Constant Gain** | Linear amplitude (A = 1−t, B = t). | Can sound like a dip in the middle for uncorrelated material and abrupt at ends. Used for correlated material. |
| **Exponential Fade** | Logarithmic/exponential curve (fast drop at start, slow at end; or vice versa). | Fades to or from silence. The smoothest at the bottom. |
- Default audio transition duration is set in Preferences > Timeline (1 sec default; in seconds or frames).
- **Shortcut:** Cmd/Ctrl+Shift+D. Interactive fades (26.0): drag the fade handles on the clip.
- **[editcut]** Constant Power at the midpoint: each gain = 0.707 (−3 dB). Constant Gain: 0.5 (−6 dB).

### 5.7 Audio Gain / Normalize (Clip > Audio Options > Audio Gain, **G**)
| Option | Function |
|---|---|
| **Set Gain to** | Sets absolute clip gain (dB). |
| **Adjust Gain by** | Relative dB change (cumulative). |
| **Normalize Max Peak to** | Sets gain so the loudest peak of the *selected clips as a group* reaches X dBFS (maintains the relative levels). |
| **Normalize All Peaks to** | Normalizes **each** clip individually so its peak hits X dBFS. |
| **Peak Amplitude** | Readout of the analyzed peak. |
- Gain is non-destructive and is applied before the Volume effect. Keyboard nudges: **]** / **[** = increase/decrease clip volume by 1 dB (Shift+] / Shift+[ by the "Large Volume Adjustment" amount, 6 dB default).
- **Audio Channels** (Clip > Modify > Audio Channels): Clip Channel Format (Mono / Stereo / 5.1 / Adaptive), Number of Audio Clips, channel → track mapping, per-channel enable. Default interpretation: Preferences > Timeline/Audio > Default Audio Tracks (Use File, Mono, Stereo, 5.1, Adaptive).
- **Render and Replace / Breakout to Mono / Extract Audio** (Clip > Audio Options).
- **Loudness**: measure with the Loudness Radar effect, match with Essential Sound Auto-Match, and enforce at export with Effects > Loudness Normalization (Section 7).

### 5.8 Track types
| Type | Channels | Notes |
|---|---|---|
| **Standard** (default since CC) | Mono and stereo clips can coexist | Stereo pan/balance. Mono clips are panned. |
| **Mono** | 1 | Only mono clips. Pan to a stereo master. |
| **5.1** | 6 (L, R, C, LFE, Ls, Rs) | Only 5.1 clips. 5.1 panner. |
| **Adaptive** | 1–32 channels, mapped to output channels | Flexible multichannel routing (e.g. for multi-mic recordings, stems). Output channel mapping in the track header. |
| **Submix** (Stereo / 5.1 / Adaptive / Mono) | — | Bus tracks. They receive outputs/sends from other tracks, have inserts and a fader, and output to Master or another submix. They hold no clips. Created via Sequence > Add Tracks (Audio Submix Tracks) or by creating a send. |
| **Master** | Stereo / 5.1 / Multichannel (up to 32) / Mono | Set at sequence creation (Sequence Settings > Tracks > Master). Multichannel enables stem export. |

### 5.9 Audio meters, monitoring, recording
- **Audio Meters** panel: dB scale (−60 to 0 dBFS default; right-click to change range: 24/48/60/72/96/120 dB, Dynamic Peaks, Static Peaks, Show Valleys, Show Color Gradient, Show Solo Buttons). For LUFS metering, put the **Loudness Radar** effect on the Master track.
- **Voice-over record:** arm a track (mic icon) → Voice-over Record button in the track header. Preferences > Audio > Voice-over record: Countdown, Pre-roll/Post-roll, Mute Input during timeline recording, Preroll beeps.
- **Scrubbing:** Preferences > Audio > Play audio while scrubbing; Maintain pitch while shuttling.
- **Global audio mute** (26.2/26.3): one-click mute all.
- **Track mute/solo shortcuts** based on targeting (25.5).

### 5.10 Remix (music retiming)
- **Remix Tool** (in the Rate Stretch tool group, **R** cycles) or Essential Sound > Music > Duration > **Remix**.
- Drag the music clip's end to the desired length. Sensei analyzes beats/structure and rebuilds it into a new length with seamless cuts (shown as **zigzag lines** at remix points). Duration snaps to about the nearest musical match (±5 s tolerance).
- Parameters (Essential Sound > Duration > Customize): **Target Duration**, **Segments** (Shorter ↔ Longer: prefer short or long musical segments), **Variations** (Less ↔ More: how much the arrangement can change, as in Harmonics vs Timbre emphasis).
- Remixed clips can't be edited inside. Duration can be re-targeted any time. It's non-destructive.

### 5.11 Other audio AI and tools
- **Auto Ducking** (5.1 Music Ducking).
- **Auto audio category tagging** (24.x).
- **Generative Extend for audio** (25.2+): extends **ambient/room tone, SFX** up to about 10 s (not music or dialogue).
- **Audio waveforms**: dynamic waveforms that scale with volume changes (25.2, "Dynamic waveforms"), visible during drags (25.5). Rectified or non-rectified display is set in the Timeline wrench menu > **Rectified Audio Waveforms**.
- **Interactive fades** (26.0).
- **Send to Adobe Audition** (Edit > Edit in Adobe Audition > Clip/Sequence).
- **Multichannel export / stems** (Section 7).

---

## 6. Graphics, Titles, Captions, Text-Based Editing, AI Features

### 6.1 Type tool and graphic layers
- **Type tool (T)**: click in the Program Monitor for **point text** (auto-width), or drag a box for **paragraph/area text** (wraps inside the box). This creates a **graphic clip** on the topmost free video track at the playhead (default duration from Preferences > Timeline > Still Image Default Duration, 5 s). Each new text layer while the graphic is selected is added **inside the same graphic clip** as a layer.
- **Vertical Type tool** exists in the Type tool group.
- **Shape tools (Rectangle, Ellipse, Polygon in 22+; Pen tool for custom shapes)**: the Pen tool (P) in the Program Monitor draws a vector shape layer when no clip with a mask is selected.
- **Graphic clip = container** of layers (text, shape, clip/image layers, groups). Layers render top-down as listed in Essential Graphics/Properties. Graphic clips also get the standard Motion/Opacity intrinsics plus a per-layer **Vector Motion** parameter group in Effect Controls (for vector-quality scaling without rasterizing).
- **Text Effect Controls**: Text layers show "Text (layer name)" → Source Text (keyframeable as discrete text changes), Transform (Position, Scale, Rotation, Opacity, Anchor Point), Appearance.

### 6.2 Essential Graphics panel → Properties panel (25.x)
In 25.0 Adobe introduced the **Properties panel**, a context-sensitive panel that consolidates Essential Graphics' "Edit" tab, quick Transform/Crop/Opacity, Lumetri basics, audio level/Essential Sound basics, and caption styling. The Essential Graphics panel remains for **Browse** (templates) and legacy editing.

| Section | Controls | Function |
|---|---|---|
| **Layers list** | New Layer (Text, Vertical Text, Rectangle, Ellipse, From File), visibility eye, lock, reorder, group | Layer stack of the graphic. |
| **Responsive Design – Position** | **Pin To** (Video Frame or another layer), pin edges (top/left/right/bottom/center diagram) | The pinned layer follows changes in the parent's size/position (e.g. a background box that resizes with text). |
| **Responsive Design – Time** | **Intro duration** and **Outro duration** (timecode handles in the timeline/Effect Controls), **Roll** (for credits: Start/End Off Screen, Preroll, Postroll, Ease In, Ease Out) | Keyframes in the intro/outro regions are preserved when the graphic clip's length changes; only the middle stretches. Roll turns the graphic into scrolling credits. |
| **Align and Transform** | Align (left/center/right, top/middle/bottom, to selection or video frame), Distribute, Position X/Y, Anchor Point, Scale (linked W/H), Rotation, Opacity | Layer transform. |
| **Master Styles / Text Styles** | Create/apply a **Text Style** (project item), Push to/sync | Reusable font/size/fill/stroke/shadow style that updates all instances. |
| **Text** | Font family, Style (weight), Size, Alignment (left/center/right + justify last line left/center/right + justify all), Tracking, Kerning, Leading, Baseline Shift, Tsume, **Faux Bold**, **Faux Italic**, **All Caps**, **Small Caps**, Superscript, Subscript, Underline, Tab widths, **Text direction LTR/RTL**, Font size auto-scale (for responsive). | Typography. Character-level formatting by selecting characters. Since 25.5 there are **default fonts** for text and captions. |
| **Appearance – Fill** | Solid color / Linear gradient / Radial gradient (gradient editor with stops and opacity) | Text/shape fill. |
| **Appearance – Stroke** | Multiple strokes (+), color, width, **Stroke style** (Outer / Center / Inner), Line join (Miter/Round/Bevel), Miter limit | Text outlines. Multiple strokes stack. |
| **Appearance – Background** | Color, Opacity, **Size** (padding), **Corner Radius** | A box behind the text that auto-sizes to the text (a lower-third bar). |
| **Appearance – Shadow** | Multiple shadows (+): Color, Opacity, Angle, Distance, Size, Blur | Drop shadows. |
| **Mask with Text** | checkbox (+ Invert) | The text layer becomes a mask: it cuts through to reveal underlying content (knockout text), or inverted to cut a hole. Also applies to shapes ("Mask with Shape"). |
| **Shape properties** | Fill, Stroke, Shadow, Mask with Shape, rectangle corner radius, path editing | Vector shapes. There's no Background option for shapes. |
| **Graphics/image layer** | From File: image/video inserted as a layer | |

### 6.3 Motion Graphics Templates (.mogrt)
- **Packages** created in After Effects (Essential Properties) or Premiere (Graphics > Export As Motion Graphics Template), saved to the Local Templates Folder, a Library (CC Libraries) or a drive.
- **Browse** tab (Essential Graphics panel; in 25.x+ also in the **Graphics templates** panel): local templates, Adobe Stock (free and paid), Libraries. Filters for Premiere-made and AE-made templates. AE-made .mogrts render through an embedded After Effects engine, so AE doesn't need to be installed, but they're heavier to play back than Premiere-made templates, which are native graphic layers.
- **Edit controls exposed by the template author**: text fields, checkboxes, sliders, angle, color, point, dropdown menus, **Media Replacement** (drop video/image), font properties, group/collapse, plus **Responsive Design** in AE templates (protected regions in time).
- **Spreadsheet-driven / Data-driven MOGRTs**: a CSV/TSV is linked to text fields. Drag the CSV onto the template to generate multiple instances (e.g. infographics, charts). Changing the CSV updates them.
- **Install**: Graphics > Install Motion Graphics Template.
- **Replace**: Alt/Opt-drag a .mogrt onto an existing graphic clip to replace it, keeping its duration.
- **Upgrade to Master Graphic** (Graphics > Upgrade to Master Graphic): converts an instance into a project item so editing it updates every instance.
- Since 25.5: **Film Impact text/graphic animations** (grow, pop, sweep, 2D→3D titles) are effects applied to graphic clips.

### 6.4 Speech to Text & Transcript-based editing (Text panel)
- **Text panel** tabs: **Transcript**, **Captions**, **Graphics** (list of text graphics in the sequence for search/replace).
- **Transcribe**: Auto-transcribe on import (Preferences > Transcription: "Automatically transcribe clips on import", language) or the "Transcribe sequence/clip" button. Options: **Language** (18+ languages; English, Spanish, German, French, Japanese, Portuguese, Korean, Chinese (Simplified/Traditional), Italian, Russian, Dutch, Hindi, Swedish, Norwegian, Danish, Turkish… downloadable language packs), **Audio analysis** (Audio on Track N / Mix / Clips tagged as dialogue), **Recognize when different speakers are talking** (speaker diarization), **Transcribe only from In to Out**. It runs locally on device.
- **Transcript tab features**: word-level timing (the playhead highlights the current word; click a word to jump), **Speakers** (rename "Speaker 1" etc., Edit speakers), **search** with find/replace, **pauses** shown as `[...]`, **filler word detection** ("um", "uh" and custom filler words), **Delete pauses** / **Delete filler words** (all or one by one, ripple delete in the timeline), **Extract** and **Lift** selected text, **Insert/Overwrite** from the Source transcript into the timeline (**text-based editing**: edit in the source clip's transcript, choose Insert/Overwrite, and the corresponding media lands on the timeline), **Export transcript** (.txt / CSV), **Import transcript** (.prtranscript), Edit/correct words (correcting words doesn't change the audio).
- **Filter Censored Words** (26.x): marks or bleeps profanity in captions/transcripts.
- **Ellipsis "…" options**: Show pauses (min length), Show filler words, Show speaker labels, Sync scroll with playhead.

### 6.5 Captions
- **Caption tracks**: captions live on dedicated **caption tracks** above the video tracks. Each caption track has a **format** (Subtitle, CEA-608, CEA-708, Teletext, Australian OP-47, EBU subtitle, Open Subtitling), a **stream** (608: CC1–CC4; 708: Service 1–6), and a **language**. Toggle the visibility of caption tracks with the CC button on the track header; the Program Monitor shows the active track (Settings > Closed Captions Display).
- **Create captions**: Text panel > Captions > **Create captions from transcript**. Options: **Caption Preset** (Subtitle default/Custom), **Format**, **Stream**, **Style** (Track Style), **Maximum length in characters** (e.g. 42), **Minimum duration in seconds**, **Gap between captions (frames)**, **Lines**: Single / Double, **Single-word captions** (26.3: one word per caption with per-word timing, for social), **Sequence In/Out only**.
- **Manual captions**: + button / Add New Caption Segment at the playhead. Split, merge captions. Change times in the panel or by trimming in the timeline.
- **Caption styling** (Properties/Essential Graphics when a caption is selected): font, size, fill, stroke, background (color, opacity), shadow, alignment, **position** (9-zone **region** grid + X/Y offsets), text box width. Save as a **Track Style** (applies to all captions on the track) or a **Caption Style** project item.
- **Translate captions** (25.2+): Text panel > Translate captions; 27 target languages; creates a new caption track per language. It works on Premiere-created or imported SRT captions.
- **Import formats**: **SRT** (SubRip), **SCC** (Scenarist, 608), **MCC** (MacCaption, 608/708), **DFXP/TTML (.xml)**, **EBU STL (.stl)**, and **WebVTT (.vtt)**. Most are imported directly as caption tracks.
- **Export** (Export settings > Captions, or File > Export > Captions): **Burn captions into video** (open captions, styling preserved, single-word style preserved since 26.3), **Create sidecar file** (format: SRT, SCC, MCC, DFXP/XML, STL, **WebVTT**, .txt; frame rate for SCC), **Embed in output file** (QuickTime/MXF 608/708 embedded, e.g. in H.264 MP4 as CEA-608, ProRes MOV).
- **Upgrade legacy captions** (pre-2021 open captions on video tracks) via "Upgrade captions to caption tracks".

### 6.6 Generative Extend (Firefly, 25.2+)
- **Tool**: Generative Extend tool (in the toolbar, shared slot with the Ripple/Rolling tools in 25.x). **Drag a clip edge** beyond its media to generate new frames.
- **Video**: up to **2 seconds** of AI-generated frames at the head or tail (continues the motion/camera, fills a gap, holds on a reaction). Supports **up to 4K** (25.2), common aspect ratios such as 16:9 and 9:16, and common progressive frame rates. Generation is SDR only. It takes the clip context into account (preceding frames).
- **Audio**: extends **ambient sound / room tone / SFX** up to **10 seconds** (no speech or music generation; music is skipped).
- Generated media is labeled with **Content Credentials** (C2PA) and an "AI-generated" badge on the clip. Generation happens in the cloud with Firefly (credit consumption under generative credit plans; some features free during promotional periods). It requires sign-in and age/region eligibility.
- Generated frames are saved as new media in the project's media folder.

### 6.7 Media Intelligence & Search panel (25.2+)
- **Media Intelligence**: an on-device AI analysis of footage that recognizes **objects, locations, people (generic), camera angles/shot types (close-up, wide), activities, visual descriptions**, plus metadata (date, camera, file info) and **spoken words** (transcript).
- **Search panel** (Window > Search): **natural-language queries** ("person running on a beach at sunset") return matching clips **and time ranges within clips**. Toggle **Visual**, **Speech/Transcript**, **Metadata** search. Thumbnails and transcript snippets (26.3 adds a slider to enlarge thumbnails, waveforms and transcript text). Results can be dragged into the timeline or Source Monitor.
- Analysis runs locally. Adobe says no user content is used for training. It can be enabled or disabled per project.

### 6.8 Other AI / automation features
| Feature | Where | What it does |
|---|---|---|
| **Auto Reframe** | Sequence > Auto Reframe Sequence, or Auto Reframe effect | Creates an aspect-converted sequence (1:1, 4:5, 9:16, 16:9, custom). AI tracks the subject and keyframes the position. Motion presets (Slower/Default/Faster). Clip nesting option. |
| **Morph Cut** | Video Transitions > Dissolve | Hides jump cuts in talking-head interviews by face tracking + optical-flow interpolation between the two frames. Analysis happens in the background. |
| **Scene Edit Detection** | Right-click a clip > Scene Edit Detection | Detects cuts in flattened/edited video. Options: **Apply a cut at each detected cut point**, **Create a subclip master clip for each detected cut point** (into a bin), **Generate markers at each detected cut point**. |
| **Color Match** | Lumetri > Color Wheels & Match | Sensei-based match to a reference frame, with optional face detection. |
| **Auto (Auto Tone)** | Lumetri > Basic | Sensei auto exposure, contrast and tone. |
| **Auto Ducking** | Essential Sound | Section 5. |
| **Remix** | Essential Sound / Remix tool | Section 5.10. |
| **Enhance Speech** | Essential Sound | Section 5.2. |
| **Speech to Text / Captions / Translation** | Text panel | Sections 6.4–6.5. |
| **Audio category auto-tagging** | Timeline badges | Section 5. |
| **Object Mask** (26.0+) | Mask tools (Opacity and any effect) | One-click AI subject selection with automatic tracking; Sharp/Smooth edges; Restore Mask Data. |
| **Generative Extend** | Tool | Section 6.6. |
| **Media Intelligence / Search** | Search panel | Section 6.7. |
| **Firefly Boards → Premiere** (26.0/26.3) | File/Import | Imports Firefly Boards media. 26.3 creates a ready sequence in selection order. |
| **Creative Agent (beta, Jun 2026)** | Window > Assistant | Conversational AI that organizes footage, builds bins, transcribes, creates stringouts and rough cuts. Actions are undoable. "Always ask" / "Auto approve" modes. Daily free credits in beta. |
| **Content Credentials** (26.2 export) | Export settings | Embeds C2PA provenance metadata. |


---

## 7. Export

### 7.1 Export mode (workspace header)
- The header bar at the top of the window has **Home | Import | Edit | Export** (Import mode was added in 22.x and kept through 25.x; some 26.x layouts hide Import by default). There's also a **Quick Export** button (the box-with-arrow icon at top right), the workspace menu, and progress/notification icons.
- **Export mode** (**Cmd+M / Ctrl+M** from the timeline) opens on the active sequence or the selected Project item. Its layout: **left = Destinations**, **center = Settings**, **right = Preview** (with range and scaling), **bottom = Estimated file size + "Send to Media Encoder" + "Export"**.

### 7.2 Destinations (left column)
Multiple destinations can be enabled at once (each has its own settings and output, rendered in one pass).
| Destination | Notes |
|---|---|
| **Media File** | Local file (default). |
| **Adobe Stock** | Contributor upload (in some builds). |
| **Behance** | Publish to Behance. |
| **Facebook** | Page/profile, title, description, privacy. |
| **FTP** | Server, port, path, credentials, retries. |
| **TikTok** | Upload/Drafts (added 2022). |
| **X (Twitter)** | Upload with caption. |
| **Vimeo** | Title, description, tags, privacy. |
| **YouTube** | Channel, title, description, tags, **Privacy** (Public/Unlisted/Private), Playlist, thumbnail (frame/custom image), Captions upload, Made for kids. |
| **Frame.io** | Uploads for review through the Frame.io panel and V4 integration. In 26.x, launching from Premiere signs in automatically. |
Sign-in is via Creative Cloud. Publish settings include "Delete local file after upload".

### 7.3 Settings column (per destination)
**Top fields**
| Field | Meaning |
|---|---|
| **Preset** | Choose a preset: Match Source – Adaptive High/Medium/Low Bitrate, YouTube 1080p/4K, Vimeo, Social presets (Vertical 9:16, Square), Broadcast, ProRes, etc. **More presets…** opens the Preset Manager (import/export .epr). **Save preset**. |
| **Format** | H.264, HEVC (H.265), QuickTime, MXF OP1a, DNxHR/DNxHD MXF OP1a, AV1 (newer builds, hardware-accelerated on supported GPUs), MPEG-2, AVI, AIFF, WAV, MP3, AAC Audio, Animated GIF, GIF, JPEG, PNG, TIFF, DPX, OpenEXR, Targa, BMP, JPEG 2000 MXF OP1a, AS-10, AS-11, P2 Movie, Wraptor DCP, MPEG-4, 3GPP, Windows Media (Windows only). |
| **File Name / Location** | Output path (click to edit). |
| **Match Source** toggle | Locks frame size, rate, field order, aspect and profile to the sequence. |

**Video section (H.264/HEVC example)**
| Setting | Options | Meaning |
|---|---|---|
| **Frame Size / Width / Height** | link toggle, values | Output resolution. Scaling to a different aspect follows the **Scaling** choice in Preview. |
| **Frame Rate** | 23.976, 24, 25, 29.97, 30, 50, 59.94, 60, custom | Output rate (conversion uses Time Interpolation). |
| **Field Order** | Progressive / Upper First / Lower First | Interlace. |
| **Aspect** | Square Pixels (1.0), D1/DV NTSC (0.9091), D1/DV NTSC Widescreen 16:9 (1.2121), D1/DV PAL (1.0940), D1/DV PAL Widescreen (1.4587), Anamorphic 2:1 (2.0), HD Anamorphic 1080 (1.333), DVCPRO HD (1.5) | Pixel aspect ratio. |
| **TV Standard** | NTSC / PAL | For rate defaults. |
| **Performance** (Encoding Settings) | **Hardware Encoding** / **Software Encoding** | Hardware: Intel Quick Sync, NVIDIA NVENC, AMD AMF, Apple VideoToolbox. Much faster; supports CBR/VBR 1-pass only. Software: MainConcept x264-class quality, supports 2-pass. |
| **Profile** | H.264: Baseline / Main / High (High 10, High 4:2:2 in newer builds). HEVC: Main / Main10 / Main 4:2:2 10 / Main 4:4:4 | Codec feature set (bit depth, chroma). Main10 is required for 10-bit HDR. |
| **Level** | H.264: 3.0…5.2 (6.0–6.2 newer). HEVC: 3.0…6.2, Main/High tier | Caps resolution, frame rate and bitrate for decoder compatibility (e.g. 4K60 needs 5.2/H.264 or 5.1+ HEVC). |
| **Render at Maximum Depth** | checkbox | Processes effects at 32-bit before quantizing (less banding, slower). |
| **Bit Depth** | 8-bit / 10-bit (HEVC, ProRes) | Output bit depth. |
| **Color space / HDR** | Rec.709, Rec.2100 HLG, Rec.2100 PQ; **Include HDR10 Metadata** (Mastering Display Color Volume primaries, min/max luminance, **MaxCLL**, **MaxFALL**) | HDR signaling. Follows the sequence's output color space in 25.x. |
| **Bitrate Encoding** | **CBR** (constant), **VBR, 1 pass**, **VBR, 2 pass** | CBR = fixed bitrate (streaming/broadcast compatibility, wasteful on simple scenes). VBR 1-pass = varies around the target in one analysis pass. VBR 2-pass = the first pass analyzes complexity, the second allocates bits (best quality per MB, about 2x time, software only). |
| **Target Bitrate [Mbps]** | number | Average bitrate (VBR) or constant bitrate (CBR). |
| **Maximum Bitrate [Mbps]** | number (VBR) | Peak cap for VBR complexity spikes. |
| **Quality** (hardware/HEVC) | **Constant Quality (CRF-like)** option in newer builds for hardware encoders | Quality-based rate control. |
| **Key Frame Distance** (Advanced) | frames | GOP length (I-frame interval). Default auto (about 1–2 s). |
| **Time Interpolation** (General) | Frame Sampling / Frame Blending / Optical Flow | How frame-rate conversion synthesizes frames. |
| **Use Maximum Render Quality** | checkbox | High-quality scaling (Lanczos/bicubic with better filtering) when output size ≠ sequence size, and for scaled media. Higher memory and time. Use it when downscaling (e.g. 4K → 1080) or upscaling. Not needed if no scaling. |

**ProRes/DNx (QuickTime/MXF) video codec settings**
| Codec family | Variants |
|---|---|
| Apple ProRes | 422 Proxy, 422 LT, 422, 422 HQ, 4444, 4444 XQ (alpha supported in 4444/4444 XQ: "Include Alpha" / Depth: 8bpc / 16bpc + alpha). Windows encode supported since 2019. |
| Avid DNxHR | LB, SQ, HQ, HQX (10-bit), 444 (10/12-bit). DNxHD with fixed bitrates per resolution/rate (e.g. 1080p 36/115/175/175x Mbps). |
| GoPro CineForm | Quality levels (Low…Film Scan 3). Alpha. YUV 10-bit / RGB 12-bit. |
| Others | Animation (RLE), Uncompressed 8-bit/10-bit 4:2:2 (v210), PNG (alpha), None. |

**Audio section**
| Setting | Options |
|---|---|
| **Audio Format** | AAC / Dolby Digital (AC-3) / MPEG (MP3 for some containers) / PCM (for MOV/MXF/WAV) |
| **Audio Codec** | AAC, HE-AAC (in some builds), PCM, Dolby Digital |
| **Sample Rate** | 32000, 44100, **48000 Hz (default)**, 96000 |
| **Channels** | Mono / **Stereo** / 5.1 / (for MOV/MXF: multichannel up to 32, with **Audio Channel Configuration** mapping output channels to sequence master channels or submix stems) |
| **Audio Quality** | Low / Medium / High |
| **Bitrate [kbps]** | 128 / 160 / 192 / 256 / **320** |
| **Precedence** | Bitrate / Sample Rate |
| **Sample Size** (PCM) | 16-bit / 24-bit / 32-bit float |
| **Audio Channel Configuration** (MOV/MXF) | Output Channels (Stereo, 5.1, 8, 16, 32), per-channel source mapping (e.g. separate DME stems from submixes) |

**Multiplexer section** (H.264/HEVC)
| Setting | Meaning |
|---|---|
| **Multiplexing** | **MP4** (default container), **3GPP**, **None** (raw .264 elementary stream + separate audio). |
| **Stream Compatibility** | Standard / iPod / PSP (legacy constraints). |
| **Fast Start / Optimize** | MP4 "moov atom" placed at the start for streaming (implicit in Premiere's MP4 output). |

**Captions section**
| Setting | Options |
|---|---|
| **Export Options** | None / **Create Sidecar File** / **Burn Captions Into Video** / **Embed in Output File** (MOV, MXF, MP4 608/708) |
| **File Format** (sidecar) | SubRip (.srt), Scenarist (.scc), MacCaption (.mcc), W3C/SMPTE/EBU Timed Text (.xml/.dfxp), EBU N19 (.stl), WebVTT (.vtt), Plain text (.txt) |
| **Frame Rate** (SCC/MCC) | 29.97 etc. |
| **Include SRT styling** | Keeps basic styling tags in SRT. |
| **Which track** | Active caption track (or a per-track choice when several exist). |

**Effects section (applied at export, after the sequence render)**
| Effect | Parameters | Purpose |
|---|---|---|
| **Lumetri Look/LUT** | Applied toggle, Look (built-in or Select… a .cube/.look) | A final output LUT (e.g. client delivery transform). |
| **SDR Conform** | Brightness, Contrast, Soft Knee | Tone-maps HDR → SDR during export. |
| **Image Overlay** | Applied image (PNG with alpha), **Position** (9 presets), Offset X/Y, Size %, Opacity | Watermark or logo bug. |
| **Name Overlay** | Prefix, Suffix, Format (File name / Sequence name), Position, Offset, Size, Opacity | Burns the filename for review copies. |
| **Timecode Overlay** | Position, Offset, Size, Opacity, **Time Source** (Media File / Sequence / Generate), Timecode format (Starting TC) | Burned-in timecode for review. |
| **Time Tuner** | **Target Duration** (±10% of source), **Duration Change** readout | Changes the overall duration slightly by subtly adding or removing frames at low-motion points (no speed change audible), e.g. to hit an exact 30 s spot. Audio is adjusted to stay in sync. |
| **Video Limiter** | **Signal Min** / **Signal Max** (e.g. 0–100 %, 7.5–100), **Reduction Method**: Luma / Chroma / Smart Limit / Luma and Chroma | Broadcast-legal clamp on the final output. |
| **Loudness Normalization** | **Loudness Standard**: ITU BS.1770-3 / ITU BS.1770-2 / ATSC A/85 / EBU R128 / Custom. **Tolerance** (LU, e.g. 2). **Target Loudness** (e.g. −23 LUFS EBU, −24 LKFS ATSC, −16/−14 LUFS for web). **Max True Peak Level** (dBTP, e.g. −2/−1). Normalizes integrated program loudness. | Two-pass analysis plus gain/limiting so the output meets the loudness spec. |
| **Content Credentials** (26.2+) | Attach C2PA provenance info (author, AI usage, tools used). | Provenance. |

**Metadata section**
| Setting | Meaning |
|---|---|
| **Export Options** | Create Sidecar File (.xmp) / Embed in Output File / Sidecar and Embed / None |
| **Include source XMP / Include markers / Rights / Templates** | Metadata Export dialog with templates (Keep All, etc.) and field-level control. |
| **Include markers** | Sequence markers as XMP markers (e.g. YouTube chapters). |

**General section**
| Setting | Meaning |
|---|---|
| **Import into project** | Imports the exported file. |
| **Use Previews** | Uses the rendered preview files (Sequence > Render) instead of re-rendering effects. **Fast**, but only useful if the preview codec is high quality (e.g. ProRes 422 HQ previews). Otherwise quality drops. |
| **Use Proxies** | Exports from proxy media (rough/review only). |
| **Set Start Timecode** | Custom output TC. |
| **Render Alpha Channel Only** | Outputs only the alpha as grayscale. |
| **Time Interpolation** | Frame Sampling / Frame Blending / Optical Flow. |

**Preview column**
| Setting | Meaning |
|---|---|
| **Range** | Entire Source / **Source In/Out** / **Work Area** / **Custom** (scrub handles). |
| **Scaling** | **Scale to Fit** (letterbox/pillarbox), **Scale to Fill** (crop), **Stretch to Fill** (distort). |
| **Estimated file size** | From bitrate × duration. |

### 7.4 Quick Export
- The icon at the top right of the header. Exports the active sequence (In/Out respected) in one click with: **File Name & Location**, **Preset**: **Match Source – High bitrate** (default), Match Source – Medium bitrate, Match Source – Low bitrate, or H.264 presets (e.g. YouTube 1080p Full HD, 4K, TikTok/Instagram presets) and recently used presets. Estimated size shown.

### 7.5 Adobe Media Encoder (AME)
- **Send to Media Encoder** (from Export mode) or File > Export > Media… > Queue. It encodes in the background while you keep editing.
- **Queue** panel: multiple outputs per source, drag presets onto items, start/pause/stop, **Parallel Encoding** (multiple at once), **Auto-encode watch folders**, **Preset Browser** (system and user presets, preset groups), **Encoding** panel (progress, preview), **Watch Folders** (auto-transcode files dropped in a folder), **Media Browser**.
- **AME preferences**: start queue automatically after N minutes, Output file name increments, Enable GPU rendering (Mercury Playback Engine – Metal/CUDA/OpenCL), import sequences natively (without Premiere running).
- AME reads Premiere sequences via Dynamic Link (or natively). It honors In/Out ranges, previews, proxies, and Effects-tab settings.

### 7.6 Smart rendering
- When the **export codec and settings match** the source or preview codec (e.g. ProRes, DNxHD/HR, XDCAM HD, AVC-Intra, GoPro CineForm, and some long-GOP formats), **unmodified segments are copied without re-encoding** (no generation loss, much faster).
- To benefit: set the **Sequence Settings > Video Previews > Preview File Format/Codec** to match the export (e.g. QuickTime ProRes 422 HQ), render previews (Return), and check **Use Previews** at export. Effects-modified segments re-encode or use the previews.
- 2024+ supports smart rendering for some H.264/HEVC long-GOP export in certain conditions (matching source parameters).

### 7.7 Render settings
| Command | Shortcut | What it does |
|---|---|---|
| **Render Effects In to Out** | Return/Enter | Renders preview files for red-bar segments between In/Out. |
| **Render In to Out** | — | Renders all segments (red and yellow). |
| **Render Selection** | — | Renders the selected clips. |
| **Render Audio** | — | Renders audio previews (for heavy audio effects). Preference: Render audio when rendering video. |
| **Render and Replace** | Clip > Render and Replace | Renders a clip (with or without effects) to a new media file (flatten); **Restore Unrendered** reverts. |
| **Delete Render Files / Delete Render Files In to Out** | Sequence menu | Clears previews. |
| **Sequence Settings > Video Previews** | Preview File Format (I-Frame Only MPEG, QuickTime, DNxHR/DNxHD MXF, GoPro CineForm, Apple ProRes variants), Codec, Width/Height, **Maximum Bit Depth**, **Maximum Render Quality** | Quality and format of preview renders. |
| **Composite in Linear Color** | Sequence Settings | Linear-light compositing. |
| **Renderer** | File > Project Settings > General > Video Rendering and Playback | **Mercury Playback Engine GPU Acceleration (Metal / CUDA / OpenCL)** vs **Software Only**. |

### 7.8 Export Frame
- **Export Frame** button (camera icon) in the Program/Source monitors, or **Shift+E** (macOS) / **Shift+Ctrl+E** (Windows). On macOS, Shift+Cmd+E is Enable clip, so the two are swapped relative to Windows.
- Dialog: **Name**, **Format** (JPEG, PNG, TIFF, Targa, DPX, OpenEXR, BMP, GIF), **Path** (Browse), **Import into Project** checkbox. It exports at sequence resolution with the effects applied. Captions included if enabled (26.3 fix).

### 7.9 Other export paths
- **File > Export > Final Cut Pro XML / AAF / EDL / OMF / OpenTimelineIO (.otio, 26.0) / Captions / Markers / Selection as Premiere Project / Media**.
- **AAF** (to Avid/Pro Tools): Mixdown video, Breakout to mono, Embed audio, Sample rate, Bits, Handle frames, Render audio clip effects.
- **OMF**: Encapsulate / Separate audio, Handles, Include Pan, Render audio clip effects.
- **EDL**: CMX3600, 32 char names, audio/video tracks, include transitions, effect info.
- **Export as Motion Graphics Template**.
- **Productions/Team Projects/Frame.io review**.


---

## 8. Keyboard Shortcuts (default "Adobe Premiere Pro Default" layout)

Customize: **Premiere > Keyboard Shortcuts** (macOS, **Cmd+Opt+K**) / **Edit > Keyboard Shortcuts** (Windows, **Ctrl+Alt+K**). There's a visual keyboard, presets (Avid Media Composer, Final Cut Pro 7), panel-specific shortcuts, and conflict warnings. Shortcuts are saved as .kys.
Some keys are **panel-specific**: the same key does different things in the Timeline, Source/Program monitors, Project panel, Effect Controls, etc.

### 8.1 Playback & navigation
| Action | macOS | Windows |
|---|---|---|
| Play/Stop toggle | Space | Space |
| Play reverse / **J** (press repeatedly for 2x, 4x, 8x) | J | J |
| Stop | K | K |
| Play forward (repeat for faster) | L | L |
| Frame back / forward while holding K | K+J / K+L (hold K, tap J/L); hold K + J/L = slow-motion shuttle | same |
| Slow reverse / slow forward | Shift+J / Shift+L (each press steps speed by 10%) | same |
| Step back / forward 1 frame | ← / → | ← / → |
| Step back / forward 5 frames ("many") | Shift+← / Shift+→ | Shift+← / Shift+→ |
| Go to previous / next edit point (targeted tracks) | ↑ / ↓ | ↑ / ↓ |
| Go to previous / next edit point on any track | Shift+↑ / Shift+↓ | Shift+↑ / Shift+↓ |
| Go to sequence start / end | Home / End (fn+← / fn+→) | Home / End |
| Go to In / Out point | Shift+I / Shift+O | Shift+I / Shift+O |
| Play In to Out | Opt+K | Ctrl+Shift+Space |
| Play In to Out with pre-roll/post-roll | Shift+Space | Shift+Space |
| Play around (pre/post-roll) | Shift+K | Shift+K |
| Loop playback toggle | Ctrl+L | — |
| Go to next / previous marker | Shift+M / Cmd+Shift+M | Shift+M / Ctrl+Shift+M |
| Match Frame (open timeline frame in Source) | F | F |
| Reverse Match Frame | Shift+R | Shift+R |
| Shuttle/Scrub the CTI | drag the timeline ruler; Shift-drag snaps | same |

### 8.2 Marking
| Action | macOS | Windows |
|---|---|---|
| Mark In / Mark Out | I / O | I / O |
| Clear In / Clear Out | Opt+I / Opt+O | Ctrl+Shift+I / Ctrl+Shift+O |
| Clear In and Out | Opt+X | Ctrl+Shift+X |
| Mark Clip (In/Out around the clip under the playhead on targeted tracks) | X | X |
| Mark Selection | / | / |
| Add Marker | M | M |
| Clear current marker / all markers | Opt+M / Opt+Cmd+M | Ctrl+Alt+M / Ctrl+Alt+Shift+M |
| Edit marker (open marker dialog) | M twice (press M on an existing marker) | same |

### 8.3 Editing (three-point and timeline)
| Action | macOS | Windows |
|---|---|---|
| **Insert** (from Source to Timeline at playhead/In, shifts later clips) | **,** (comma) | **,** |
| **Overwrite** | **.** (period) | **.** |
| **Lift** (remove In→Out, leave a gap) | **;** | **;** |
| **Extract** (remove In→Out, close the gap / ripple) | **'** (apostrophe) | **'** |
| **Ripple Trim Previous Edit to Playhead** | **Q** | **Q** |
| **Ripple Trim Next Edit to Playhead** | **W** | **W** |
| Trim Previous Edit to Playhead (no ripple) | Opt+Q | Ctrl+Alt+Q |
| Trim Next Edit to Playhead (no ripple) | Opt+W | Ctrl+Alt+W |
| **Add Edit** (cut targeted tracks at the playhead) | **Cmd+K** | **Ctrl+K** |
| Add Edit to All Tracks | Cmd+Shift+K | Ctrl+Shift+K |
| **Ripple Delete** | **Shift+Forward Delete** (Shift+fn+Delete on laptop keyboards) | **Shift+Delete** |
| Clear (delete, leave a gap) | Delete / Forward Delete | Delete / Backspace |
| Extend Selected Edit to Playhead | E | E |
| Apply Video Transition | Cmd+D | Ctrl+D |
| Apply Audio Transition | Cmd+Shift+D | Ctrl+Shift+D |
| Apply Default Transitions to Selection | Shift+D | Shift+D |
| Link / Unlink | Cmd+L | Ctrl+L |
| Group / Ungroup | Cmd+G / Cmd+Shift+G | Ctrl+G / Ctrl+Shift+G |
| Enable/Disable clip | Shift+Cmd+E | Shift+E |
| Speed/Duration | Cmd+R | Ctrl+R |
| Audio Gain | G | G |
| Nest | — (right-click > Nest) | — |
| Paste Attributes | Opt+Cmd+V | Ctrl+Alt+V |
| Paste Insert | Cmd+Shift+V | Ctrl+Shift+V |
| Copy / Cut / Paste / Duplicate | Cmd+C / Cmd+X / Cmd+V / Cmd+Shift+/ (duplicate in Project) | Ctrl+C / X / V / Ctrl+Shift+/ |
| Undo / Redo | Cmd+Z / Cmd+Shift+Z | Ctrl+Z / Ctrl+Shift+Z |
| Select All / Deselect All | Cmd+A / Cmd+Shift+A | Ctrl+A / Ctrl+Shift+A |
| Nudge clip selection left / right 1 frame | Cmd+← / Cmd+→ | Alt+← / Alt+→ |
| Nudge clip selection 5 frames | Shift+Cmd+← / → | Alt+Shift+← / → |
| Nudge clip selection up / down a track | Opt+↑ / Opt+↓ | Alt+↑ / Alt+↓ |
| Slip clip selection left / right 1 frame | Opt+Cmd+← / → | Ctrl+Alt+← / → |
| Slide clip selection left / right 1 frame | Opt+, / Opt+. | Alt+, / Alt+. |
| Trim backward / forward (in trim mode, selected edit) | Opt+← / Opt+→ | Ctrl+← / Ctrl+→ |
| Trim backward / forward by 5 frames | Opt+Shift+← / → | Ctrl+Shift+← / → |
| Toggle trim type (Regular → Ripple → Roll) | Ctrl+T | Shift+T |
| Select nearest edit point (trim) on targeted tracks | T | T |
| Toggle Snap | S | S |
| Toggle Linked Selection | — (timeline button) | — |
| Toggle audio during scrubbing | Shift+S | Shift+S |
| Toggle all video track targets / audio | — | — |
| Drag-and-drop modifiers | **Cmd-drag** = insert (shift tracks), **Opt-drag** = duplicate, **Shift-drag** = move to another track keeping time, **Opt-click** = select only video or only audio of a linked clip | Ctrl / Alt / Shift same roles |

### 8.4 Tools
| Tool | Key |
|---|---|
| Selection | V |
| Track Select Forward / Backward | A / Shift+A |
| Ripple Edit | B |
| Rolling Edit | N |
| Rate Stretch (and Remix tool in same group) | R |
| Razor | C |
| Slip | Y |
| Slide | U |
| Pen | P |
| Rectangle / Ellipse / Polygon tools | (same group as Pen; no default key) |
| Hand | H |
| Zoom | Z |
| Type | T (in Program Monitor context) |
| Generative Extend | (toolbar; no default key) |

### 8.5 Timeline view
| Action | macOS | Windows |
|---|---|---|
| Zoom in / out | = / − | = / − |
| Zoom to sequence (fit) | \ | \ |
| Expand / minimize all tracks | Shift+= / Shift+− | Shift+= / Shift+− |
| Increase / decrease video track heights | Cmd+= / Cmd+− | Ctrl+= / Ctrl+− |
| Increase / decrease audio track heights | Opt+= / Opt+− | Alt+= / Alt+− |
| Toggle multi-camera view | Shift+0 | Shift+0 |
| Render Effects In to Out | Return | Enter |
| Render In to Out | — (menu) | — |
| Maximize/restore panel under cursor | ` (backquote) | ` |
| Maximize panel (full screen) | Ctrl+` | Ctrl+` |
| Increase / decrease clip volume (1 dB) | ] / [ | ] / [ |
| Increase / decrease clip volume (large, 6 dB) | Shift+] / Shift+[ | Shift+] / Shift+[ |
| Export Frame | Shift+E | Shift+Ctrl+E |

### 8.6 Panels & workspaces
| Panel | macOS | Windows |
|---|---|---|
| Project | Shift+1 | Shift+1 |
| Source Monitor | Shift+2 | Shift+2 |
| Timeline | Shift+3 | Shift+3 |
| Program Monitor | Shift+4 | Shift+4 |
| Effect Controls | Shift+5 | Shift+5 |
| Audio Track Mixer | Shift+6 | Shift+6 |
| Effects | Shift+7 | Shift+7 |
| Media Browser | Shift+8 | Shift+8 |
| Audio Clip Mixer | Shift+9 | Shift+9 |
| Workspaces 1–9 | Opt+Shift+1…9 | Alt+Shift+1…9 |
| Reset to saved layout | Opt+Shift+0 | Alt+Shift+0 |

### 8.7 File / project
| Action | macOS | Windows |
|---|---|---|
| New Project | Opt+Cmd+N | Ctrl+Alt+N |
| New Sequence | Cmd+N | Ctrl+N |
| New Bin | Cmd+B (Project panel) | Ctrl+B |
| Import | Cmd+I | Ctrl+I |
| Open Project | Cmd+O | Ctrl+O |
| Save / Save As / Save a Copy | Cmd+S / Cmd+Shift+S / Opt+Cmd+S | Ctrl+S / Ctrl+Shift+S / Ctrl+Alt+S |
| Close Project | Cmd+Shift+W | Ctrl+Shift+W |
| Export Media (Export mode) | Cmd+M | Ctrl+M |
| Keyboard Shortcuts | Cmd+Opt+K | Ctrl+Alt+K |
| Find (Project) | Cmd+F | Ctrl+F |
| Rename | Return (Project) | Enter |
| Make Subclip | Cmd+U | Ctrl+U |
| Quit | Cmd+Q | Ctrl+Q |

**Note.** Defaults for the less common commands (slip/slide, nudge, trim, track heights) can vary between builds and keyboard languages, so check them in the Keyboard Shortcuts editor. The core set is stable across all 2020–2026 versions: J/K/L, I/O/X, comma/period, ;/', Q/W, Cmd/Ctrl+K, Shift+Delete, V/A/B/N/R/C/Y/U/P/H/Z, =/−/\, S, M, F, Shift+1–9, Cmd/Ctrl+D, Shift+D, Cmd/Ctrl+L, Cmd/Ctrl+R, G, Cmd/Ctrl+M.

**[editcut]** Mirror this core set exactly. Pros will expect J/K/L shuttle with acceleration, Q/W ripple trim to playhead, Cmd+K add edit, and Shift+Delete ripple delete.

---

## 9. Preferences (Premiere > Settings… on macOS / Edit > Preferences on Windows)

### 9.1 General
| Setting | Meaning |
|---|---|
| At startup | Show Home / Open most recent project. |
| When opening a project | Show Open Project dialog. |
| Show "What's New" on update | |
| Show event indicator | Pop-up for warnings/errors. |
| Bins: Double-click / + Cmd/Ctrl / + Opt/Alt | Open in new window / Open in place / Open new tab. |
| Project Locking | **Enable Project Locking** (for shared storage; others open read-only). |
| Display out of sync indicators for unlinked clips | Red A/V offset badges. |
| Render audio when rendering video | |
| Display Tool Tips | |
| **Enable Display Color Management** (older builds; moved to Color) | |
| Show clip mismatch warning dialog | Prompt to change sequence settings to match the first clip. |
| Fit clip dialog opens to edit range mismatches | |
| Hover scrub in Project panel (thumbnails) | Also in Project panel: Shift+H toggles. |

### 9.2 Appearance
| Setting | Meaning |
|---|---|
| **Brightness** | UI gray level (dark to light). |
| **Interactive Controls** / **Focus Indicators** | Brightness of blue highlights. |
| **Theme** (25.x): Darkest / Dark / Light / Lightest | UI themes added in 25.0's Spectrum UI refresh. |
| **UI scale / Text size** (25.x) | Larger fonts for accessibility. |

### 9.3 Audio
| Setting | Meaning |
|---|---|
| **Automatch Time** | Seconds for Touch-mode automation to return to existing values (default 1 s). |
| **5.1 Mixdown Type** | Front Only / Front + Rear / Front + LFE / Front + Rear + LFE (folding 5.1 to stereo). |
| Play audio while scrubbing | |
| Maintain pitch while shuttling | Pitch-corrected J/L shuttle. |
| Mute input during timeline recording | |
| **Large volume adjustment** | dB step for Shift+[ / ] (default 6 dB). |
| Timeline Record Options: Countdown sound cues, Pre-roll/Post-roll | Voice-over recording. |
| **Automation Keyframe Optimization**: Linear keyframe thinning, Minimum time interval (ms) | Reduces keyframe density when writing automation. |
| Switch to Touch after Write | |
| **Audio Plug-In Manager** | Scan for VST3/AU, enable/disable, Load on startup. |
| Default Audio Tracks (some builds in Timeline) | Mono / Stereo / 5.1 / Adaptive media: Use File / Mono / Stereo / 5.1 / Adaptive. |

### 9.4 Audio Hardware
| Setting | Meaning |
|---|---|
| **Device Class** | macOS: CoreAudio. Windows: MME / ASIO / WASAPI. |
| **Default Input / Default Output** | Device selection. |
| **Master Clock** | Clock source. |
| **Latency** (ms) / **I/O Buffer Size** (samples) | Lower = less monitoring delay, more CPU. |
| **Sample Rate** | Hardware rate (e.g. 48000). |
| **Settings… / Output Mapping** | Map Premiere's output channels to device channels (Map Output for: Adobe Desktop Audio / DV / Adobe Mercury Transmit). |

### 9.5 Auto Save
| Setting | Default | Meaning |
|---|---|---|
| **Automatically save projects** | on | |
| **Automatic save every N minutes** | 15 | |
| **Maximum project versions** | 20 | Rolling backup count in the Auto-Save folder. |
| **Save backup project to Creative Cloud** | off | Backup to CC files. |
| **Auto Save also saves the current project(s)** | off | Overwrites the working file too (rather than only creating copies). |

### 9.6 Collaboration
| Setting | Meaning |
|---|---|
| Team Projects: show conflict notifications, auto-sync options | Legacy Team Projects (deprecated in favor of Productions/Frame.io). |
| Frame.io review comments display | Show Frame.io comments as markers. |
| Share for Review | Default review settings. |

### 9.7 Color (23.x+)
| Setting | Meaning |
|---|---|
| **Enable Display Color Management** | ICC-profile-aware display (GPU required). |
| **Extended Dynamic Range Monitor** | Show HDR on EDR/XDR displays. |
| **Viewer gamma (macOS)** | QuickTime 1.96 / Broadcast 2.4 / Web 2.2. |
| **HDR graphics white (nits)** / log & raw defaults | Defaults for new sequences and media interpretation. |
| **Auto-detect log video color space** | Uses camera metadata. |
| **3D LUT interpolation** default | Trilinear / Tetrahedral. |

### 9.8 Graphics
| Setting | Meaning |
|---|---|
| **Text Engine** | Unicode **South Asian and Middle Eastern** (complex scripts) vs **Latin**. |
| **Default Font** (25.5) | Default for new text and captions. |
| Missing fonts sync from Adobe Fonts | Auto-activate missing fonts. |
| Ellipse/Rectangle tools and Type tool defaults | |
| **Default Motion Graphics Templates folder** | Location for local .mogrt. |

### 9.9 Labels
| Setting | Meaning |
|---|---|
| **Label Colors** | 16 named colors (Violet, Iris, Caribbean, Lavender, Cerulean, Forest, Rose, Mango, Purple, Blue, Teal, Magenta, Tan, Green, Brown, Yellow), editable names/colors. |
| **Label Defaults** | Defaults per item type: Bin, Sequence, Video, Audio, Movie (A/V), Still, Dynamic Link, Caption, Adjustment Layer, Graphics, Multicam, Nest, etc. |
| 25.2: colored sequence labels / 25.5 sequence color tabs | Timeline tabs show label colors. |

### 9.10 Media
| Setting | Meaning |
|---|---|
| **Timecode** | Use Media Source / Start at 00:00:00:00. |
| **Frame Count** | Start at 0 / 1 / Timecode Conversion. |
| **Default Media Scaling** | None / Scale to Frame Size / Set to Frame Size. |
| **Indeterminate Media Timebase** | Frame rate for image sequences (e.g. 23.976, 29.97). |
| Write XMP ID to files on import / Enable clip and XMP metadata linking | Metadata handling. |
| Include captions on import | Embedded captions. |
| **Allow duplicate media during project import** | |
| **Automatically hide dependent clips** | |
| **Enable hardware-accelerated decoding** (H.264/HEVC; Intel/NVIDIA/AMD/Apple) | GPU decode for long-GOP. |
| **Enable hardware-accelerated encoding** (in Export/AME) | |
| **Growing Files**: Automatically refresh growing files every N seconds | For ingest workflows. |
| **Transcribe on import** | Auto-transcribe new clips in a chosen language (also under Transcription preferences). |
| **Media Intelligence** (25.2+) | Enable/disable analysis. |

### 9.11 Media Cache
| Setting | Meaning |
|---|---|
| **Media Cache Files location** | Where .cfa (conformed audio), .pek (peak files), and accelerated files are written. Default: ~/Library/Application Support/Adobe/Common (mac) or %AppData%\Adobe\Common (Win). |
| **Media Cache Database location** | Database files. |
| **Save Media Cache files next to originals when possible** | |
| **Remove Media Cache Files**: Delete Unused / Delete (all) | Purges the cache. |
| **Media Cache Management**: Do not delete cache files automatically / Automatically delete cache files older than N days / Automatically delete oldest cache files when cache exceeds N GB | |

### 9.12 Memory
| Setting | Meaning |
|---|---|
| **Installed RAM** / **RAM reserved for other applications** / **Amount of RAM available for Adobe apps** | Shared pool for Premiere, AE, AME, Audition. |
| **Optimize rendering for**: Performance / Memory | Memory mode reduces parallel frames when RAM is low. |

### 9.13 Playback
| Setting | Meaning |
|---|---|
| **Audio Device** | Adobe Desktop Audio (or Mercury Transmit). |
| **Video Device**: **Mercury Transmit** (enable; send to external monitor via AJA, Blackmagic, Bluefish, or an extra display: Adobe Monitor N; Disable video output when Premiere is in background; per-device setup) | External preview. |
| **Pre-roll / Post-roll** | Seconds for Play Around (default 2 s / 2 s). |
| **Forward/Backward step (frames)** | Step size for Shift+← / → (default 5 frames). |
| **Pause Media Encoder queue during playback** | |
| **Enable Mercury Transmit** | |
| **Video playback: High quality vs Draft** (from monitor settings) | |
| Disable video output when in background | |
| Scrubbing and preroll options | |

### 9.14 Sync Settings
Sync preferences, workspaces and keyboard shortcuts across machines via Creative Cloud.

### 9.15 Timeline
| Setting | Default | Meaning |
|---|---|---|
| **Video Transition Default Duration** | 1.00 s (30 frames @29.97) | |
| **Audio Transition Default Duration** | 1.00 s | |
| **Still Image Default Duration** | 5.00 s | For images and graphics. |
| **Timeline Playback Auto-Scrolling** | Page Scroll / No Scroll / Smooth Scroll | Timeline follows the playhead. |
| **Timeline Mouse Scrolling** | Vertical / Horizontal | Mouse wheel behavior. |
| **Set focus on the Timeline when performing Insert/Overwrite edits** | | |
| **Snap playhead in Timeline when Snap is enabled** | on | |
| **Show "Out of Sync" indicators for unlinked clips** | | |
| **Rectified audio waveforms** | | |
| **Do not allow automatic track creation** (26.3) | | Controls whether Premiere adds tracks automatically on edits. |
| **Insert/Overwrite** edits to **targeted** tracks or source patching | | |
| **Clip spacing** / **Show transition handles** (26.0 on-clip transitions) | | |
| **Play after edit** / **Auto-patching** | | |

### 9.16 Trim
| Setting | Default | Meaning |
|---|---|---|
| **Large Trim Offset** | 5 frames (video), 100 audio units/ms | Step size for the "trim by many" buttons in the Trim Monitor and the Shift+arrow trim shortcuts. |
| **Allow Selection tool to choose Roll and Ripple trims without modifier key** | off | When on, the Selection tool chooses ripple/roll contextually by position on the edit. |
| Audio Large Trim Offset | | |

### 9.17 Transcription / Captions
- Auto-transcribe on import (language), speaker labeling, filler words list, default caption style.

### 9.18 Project Settings (not Preferences, but key) – File > Project Settings
| Tab | Settings |
|---|---|
| **General** | **Video Rendering and Playback: Renderer** (Mercury Playback Engine GPU Acceleration – Metal / CUDA / OpenCL, or Software Only). Display Format (Video Timecode / Feet+Frames / Frames). Audio Display Format (Audio Samples / Milliseconds). Capture format (DV/HDV). Action and Title Safe Areas (%). |
| **Scratch Disks** | Captured Video, Captured Audio, Video Previews, Audio Previews, Project Auto Save, CC Libraries Downloads, Motion Graphics Template Media (Same as Project / Documents / Custom). |
| **Ingest Settings** | Ingest: Copy / Transcode / Create Proxies / Copy and Create Proxies, with presets and destination. |
| **Color** (25.x) | Project color management defaults (working space, auto-detect log, etc.). |


---

## 10. Implementation checklist for editcut (derived from the above)

1. **Effect graph per clip**: ordered effect list → intrinsic Motion → Opacity (with masks and blend) → track composite. Adjustment layers act as compositing nodes over the stack below.
2. **Parameter model**: typed params (scalar, 2D point, angle, color, checkbox, enum, layer reference, curve, LUT path, mask path). Each has default/min/max/soft-range, keyframes with temporal and spatial interpolation, and a GPU/32bpc/YUV capability flag per effect.
3. **Masks**: Bezier path + feather + expansion + opacity + invert, multiple masks per effect, a tracker (position/rotation/scale), and optionally an ML segmentation mask (Object Mask analogue).
4. **Color pipeline**: input transform (log/raw detection or LUT) → working space (Rec.709 or scene-linear/ACEScct) → Lumetri-style ops in this order: Basic → Creative LUT → Curves → Wheels → HSL secondary → Vignette → output transform/tone map → display transform. Scopes computed from the output buffer (waveform, parade, vectorscope, histogram).
5. **Audio graph**: clip gain → clip effects → track inserts (pre/post) → fader/pan → sends → submix → master. Automation modes Off/Read/Latch/Touch/Write. Crossfade curves (equal power default). Loudness metering (BS.1770 LUFS, true peak).
6. **Text/graphics**: layer-based graphic clip with responsive pinning and intro/outro time protection. Captions as a separate track type with SRT/VTT/SCC import and export, burn-in or sidecar.
7. **Export**: presets (H.264/HEVC/ProRes/DNxHR/AV1), CBR/VBR1/VBR2, hardware vs software encoder, max-render-quality scaling, use-previews/smart-render passthrough, export-time effects (LUT, overlays, timecode burn, limiter, loudness normalization), frame export.
8. **Shortcuts**: copy Premiere's core set by default and offer a remappable keymap with Premiere/FCP/Avid presets.

---

## Sources
- Adobe Premiere desktop release notes and What's New pages (helpx.adobe.com/premiere-pro/kb/fixed-issues.html; helpx.adobe.com/premiere-pro/using/whats-new/2025-2.html, 2025-5.html)
- Adobe blog, "Introducing new AI-powered features … Premiere Pro and After Effects 25.2" (Apr 2025)
- CineD: "Premiere Pro 25.5 adds 90+ built-in effects, transitions and animations"; "Premiere Pro and After Effects 25.2 introduced AI Generative Extend, Media Intelligence…"
- Newsshooter: "What's new in Adobe Premiere Pro 26.0" (Jan 2026); "Adobe acquires Film Impact" (Sep 2025)
- ProVideoCoalition: "New AI and masking tools in Premiere…" (26.0)
- Larry Jordan: "New Features in Adobe Premiere 26.3" (Jun 2026)
- Adobe Community: "Adobe since NAB 2026 – what editors should know"; "What's new in Adobe Premiere 26.3 (June 2026)"
- Puget Systems: "Premiere Pro and After Effects – What's New in Version 25.2?"
- Adobe Learn: "Add effects to video clips" (Film Impact categories)
- Working knowledge of Premiere Pro UI, Effects panel, Lumetri, Essential Sound, Export mode and default keyboard layout (2020–2026)
