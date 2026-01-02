# Cross-Hatch Filter: Design Document

**Status: DEFERRED** — Revisit when ready. Focus on creating art with existing tools first.

## What Is Cross-Hatching?

Cross-hatching is a classical drawing technique where artists convey **form and tone** using layers of parallel lines:

1. **First layer**: parallel lines in one direction (e.g., 45°)
2. **Second layer**: lines at a different angle (e.g., -30°) over darker areas
3. **Third layer**: another angle (e.g., 75°) for even darker areas
4. **Additional layers**: progressively denser for deepest shadows

The result: form emerges from line density, not filled gradients. Franklin Booth mastered this—his pen-and-ink work mimics wood engravings through pure parallel stroke accumulation.

Key insight: **lighter areas = fewer/no lines, darker areas = more overlapping line layers at varying angles**.

---

## Goal

Transform a photograph into a cross-hatched illustration that:
- Preserves object shapes/edges
- Represents tonal values through hatching density
- Produces clean, vector-friendly output (SVG ideal for printing/scaling)

---

## Existing Solutions (Don't Reinvent the Wheel!)

### 1. Plotterfun (Browser-based, MIT License)
**https://mitxela.com/plotterfun/** | **https://git.mitxela.com/plotterfun**

A collection of browser-based algorithms for converting images to vector art. Runs entirely in JavaScript using Web Workers. Already includes:
- **linedraw.js** - Port of LingDong's linedraw with contours + hatching
- **Squiggle** - Continuous line based on brightness
- **StippleGen** - Weighted voronoi stippling
- **Halftone, Waves, Peano curves** - Various artistic fills

**Why this is promising:**
- Pure JavaScript, runs in browser
- Outputs SVG directly
- Already handles hatching via linedraw.js
- MIT licensed, can adapt/integrate
- Includes route optimization for pen plotters

**Consideration:** Could embed or fork the linedraw.js algorithm.

---

### 2. linedraw.py (Python, MIT License)
**https://github.com/LingDong-/linedraw**

Python library that converts images to vectorized line drawings. Features:
- Contour extraction (edges)
- Hatching for tonal areas
- Perlin noise for sketchy style
- Outputs polyline-only SVG with optimized stroke order
- Options: `--hatch_size`, `--no_contour`, `--no_hatch`

**Why this matters:**
- The algorithm is proven and produces good results
- Already ported to JavaScript in plotterfun
- Uses OpenCV (optional) for better performance

**Consideration:** Use the plotterfun JS port rather than calling Python.

---

### 3. p5.brush (JavaScript, MIT License)
**https://github.com/acamposuribe/p5.brush**

p5.js library with natural brush textures. Includes a **hatching system**:
- `brush.hatch(dist, angle, options)` - Set hatching parameters
- `brush.setHatch(brushName, color, weight)` - Configure hatch style
- `brush.hatchArray(polygons)` - Apply hatching to polygon arrays
- Supports varying line density, randomness, gradients

**Why this is interesting:**
- Designed for artists, natural-looking output
- Can hatch arbitrary polygons
- Requires p5.js (not currently in drawKISS)

**Consideration:** Would require adding p5.js dependency. Good for generative art but may be overkill.

---

## Recommended Approach: Adapt Plotterfun's linedraw.js

**Rationale:**
1. Already JavaScript, runs in browser
2. Proven hatching algorithm (ported from LingDong's Python)
3. MIT licensed, can extract/adapt
4. Outputs SVG (our desired vector format)
5. No new dependencies (pure JS + optional OpenCV)

**Integration Plan:**

### Phase 1: Quick Raster Preview
Add a `crosshatch` filter to existing `ImageProcessorService` using simplified algorithm:
- Tone quantization
- Per-level hatching overlay
- Fast preview for parameter tuning

### Phase 2: SVG Export
Port/adapt linedraw.js from plotterfun:
- Add as new service or module
- User adjusts parameters in UI
- "Export Hatched SVG" button generates vector file
- Download or save to storage

---

## Algorithm Overview (from linedraw)

1. **Preprocess**: Grayscale, blur for noise reduction
2. **Contour Detection**: Canny edge detection → trace contours
3. **Contour Simplification**: Douglas-Peucker to reduce points
4. **Hatching**:
   - Divide image into patches (e.g., 16x16 px)
   - Calculate average brightness per patch
   - Draw parallel lines with density based on darkness
   - Alternate angles for different tone levels
5. **Route Optimization**: Nearest-neighbor to minimize pen travel
6. **SVG Output**: Polylines with stroke-only paths

---

## Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| hatch_size | 4-32 | Patch size for hatching (smaller = finer detail) |
| contour_simplify | 0-3 | Level of contour simplification |
| line_spacing | 2-8 | Base spacing between hatch lines |
| angle_steps | 2-4 | Number of different angles for cross-hatching |
| show_contours | bool | Include edge contours in output |
| show_hatching | bool | Include hatching in output |

---

## Open Questions

1. **Integration UI**: New screen? Part of Edit? Export dialog?

2. **Preview performance**: linedraw can be slow for large images. Show low-res preview, generate full-res on export?

3. **Hatching style**: linedraw uses fixed angles. Should we add form-following hatching (advanced, follows surface curves)?

4. **Color output**: Black lines on white, or user-configurable ink/paper colors?

---

## Complexity Assessment: Integrating Plotterfun's linedraw.js

### Code Structure (3 files)

| File | Lines | Purpose |
|------|-------|---------|
| `linedraw.js` | ~230 | Main algorithm: contour detection + hatching |
| `helpers.js` | ~230 | Utilities: pixel processing, Perlin noise, path sorting |
| `main.htm` | ~260 | UI: file loading, worker management, SVG rendering |

**Total: ~720 lines** of JavaScript to understand/adapt.

---

### Algorithm Breakdown

**1. Edge Detection (Sobel Filter)** — ~30 lines
- Custom implementation, no OpenCV dependency
- Pure JS pixel manipulation
- Outputs binary edge map

**2. Contour Tracing** — ~80 lines
- `getdotsH/V` → find edge pixels horizontally/vertically
- `connectdotsH/V` → link pixels into polylines
- Basic nearest-neighbor linking (not OpenCV findContours)

**3. Hatching** — ~50 lines
- Scans image in 4 directions based on darkness:
  - Horizontal lines (medium darkness, p ≤ 144)
  - Denser horizontal (darker areas, p ≤ 64)
  - Diagonal lines (darkest areas, p ≤ 16)
- Perlin noise added for sketchy effect

**4. Route Optimization** — ~30 lines
- Nearest-neighbor TSP to minimize pen travel
- Simple greedy algorithm

**5. Output**
- Generates SVG path string (`M x,y L x,y L...`)
- Posted via Web Worker message

---

### Integration Complexity: **MEDIUM**

#### What's Easy
- **No dependencies**: Pure JS, no OpenCV needed
- **Self-contained**: Algorithm doesn't need external state
- **Clean output**: Generates SVG path string directly
- **Web Worker compatible**: Already designed for async processing

#### What Needs Adaptation

| Challenge | Notes |
|-----------|-------|
| Worker pattern | Plotterfun declares UI via `postMessage`; need to extract algorithm into Angular service |
| Canvas/Mat bridge | Plotterfun uses ImageData; drawKISS uses OpenCV Mat — need conversion |
| UI binding | Plotterfun builds sliders dynamically; need Angular component with reactive forms |
| SVG export | New feature for drawKISS — download button generating SVG file |

---

### Estimated Work

| Task | Effort |
|------|--------|
| Extract algorithm from worker pattern | 2-3 hours |
| Create Angular service wrapper | 2-3 hours |
| Build UI component (sliders, preview) | 4-5 hours |
| Integrate with existing edit workflow | 2-3 hours |
| Add SVG export/download | 1-2 hours |
| Testing & tuning | 2-3 hours |

**Total: ~15-20 hours** (2-3 days focused work)

---

### Alternative Approaches

**Option A: Full Integration (recommended)**
Port linedraw.js completely, wrap in Angular service, add new "Vectorize" screen.

**Option B: Simplified MVP**
Port just `hatch2()` function (~50 lines), skip contour detection, use existing OpenCV Canny.
Effort: ~8 hours.

**Option C: External Link**
Add button linking to https://mitxela.com/plotterfun/ — user processes there, downloads SVG.
Effort: 30 minutes. Poor UX but zero complexity.

**Option D: Iframe Embed**
Embed plotterfun in a modal/panel. Keeps user in app but no deep integration.
Effort: 2 hours.

---

## Known Issues to Fix During Port

| Issue | Description | Fix | Effort |
|-------|-------------|-----|--------|
| [#22](https://github.com/mitxela/plotterfun/issues/22) | Bright/high-key images produce blank output. Autocontrast thresholds too aggressive. | Adjust autocontrast, expose min/max brightness sliders | ~1 hour |
| [#21](https://github.com/mitxela/plotterfun/issues/21) | Perlin noise pushes paths outside canvas bounds. Other programs reject the SVG. | Clamp coords: `Math.max(0, Math.min(x, width))` | ~15 min |

---

## Integration Options

### Option 1: Full TypeScript Port
Convert linedraw.js + helpers.js to TypeScript, wrap in Angular service.

| Task | AI-Assisted | Human Only |
|------|-------------|------------|
| Port linedraw.js to TS (types, ES modules) | 1-2 hrs | 3-4 hrs |
| Port helpers.js utilities to TS (only needed parts) | 0.5-1 hr | 2-3 hrs |
| Remove Web Worker pattern, wrap in Angular service | 0.5 hr | 1-2 hrs |
| Fix issues #21, #22 | 0.5 hr | 1.5 hrs |
| Testing & integration | 1-2 hrs | 1-2 hrs |

**Total AI-Assisted: ~4-6 hours** | **Human Only: ~8-12 hours**

---

### Option 2: Keep Vanilla JS + Web Worker (Recommended)
Use original JS files as-is, communicate via Web Worker postMessage pattern.

| Task | AI-Assisted | Human Only |
|------|-------------|------------|
| Copy linedraw.js + helpers.js to assets | 0.25 hr | 0.25 hr |
| Create Angular service for worker communication | 0.5 hr | 1-2 hrs |
| Create .d.ts type declarations (optional) | 0.5 hr | 1 hr |
| Fix issues #21, #22 in JS files | 0.5 hr | 1.5 hrs |
| Testing & integration | 1 hr | 1-2 hrs |

**Total AI-Assisted: ~2-3 hours** | **Human Only: ~4-6 hours**

**Why this is cleaner:**
- Code already runs as Web Worker — no refactoring needed
- Heavy processing stays off main thread (no UI freeze)
- Easy to update if upstream plotterfun improves
- Minimal Angular boilerplate

---

### Option 3: Vanilla JS with `allowJs`
Set `allowJs: true` in tsconfig.json, import JS directly into Angular components.

| Task | AI-Assisted | Human Only |
|------|-------------|------------|
| Enable allowJs in tsconfig | 0.1 hr | 0.1 hr |
| Refactor JS to ES modules (remove worker pattern) | 1 hr | 2-3 hrs |
| Create .d.ts type declarations | 0.5 hr | 1 hr |
| Create Angular service wrapper | 0.5 hr | 1 hr |
| Fix issues #21, #22 | 0.5 hr | 1.5 hrs |
| Testing & integration | 1 hr | 1-2 hrs |

**Total AI-Assisted: ~3-4 hours** | **Human Only: ~6-9 hours**

---

## Next Steps (when ready)

1. **Decide approach**: Full port vs. MVP vs. external
2. **If porting**: Extract `linedraw.js` + `helpers.js` into `frontend/src/lib/linedraw/`
3. **Create service**: `LinedrawService` wrapping the algorithm
4. **Build UI**: New component or extend Edit screen
5. **Add SVG export**: Download button + file generation

---

## References

- Plotterfun live demo: https://mitxela.com/plotterfun/
- Plotterfun source: https://git.mitxela.com/plotterfun
- LingDong linedraw (Python original): https://github.com/LingDong-/linedraw
- p5.brush hatching: https://github.com/acamposuribe/p5.brush
- Franklin Booth technique: parallel line accumulation
- Research: "Color2Hatch" (Springer 2021)

