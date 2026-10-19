# HEVC Video Analyzer - Frontend

Modern, high-performance web interface built with **React 19** and **Vite** for deep microarchitectural inspection and mathematical visualization of ITU-T H.265 / HEVC video encoding decisions.

Implemented strictly following **Apple macOS Tahoe (applecn)** design language and **ITU-R pixel-accurate standards** (100% discrete pixel fidelity, zero rounded corners on picture frames, CTU/CU blocks, and matrix cells).

---

## Architecture: HM-18.0 Aligned 5-Step Guided Flow

The frontend architecture strictly mirrors the recursive encoding lifecycle of **ITU-T H.265 / HM-18.0** (`TEncCu::xCompressCU`). Instead of disjointed view modes, the application guides users through 5 focused steps with persistent DOM shells that eliminate layout shifts (Zero CLS):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              HEVC Video Analyzer Frontend                              │
├───────────────────┬───────────────────┬───────────────────┬───────────────────┬────────┤
│ 01 Partition      │ 02 Prediction     │ 03 Residual & TU  │ 04 Reconstruction │ 05 RDO │
├───────────────────┼───────────────────┼───────────────────┼───────────────────┼────────┤
│ • Frame GOP       │ • 4N+1 Reference  │ • Residual Matrix │ • Recon Buffer    │ • CABAC│
│ • QuadTree Split  │ • MDIS 3-Tap Filt │ • 2D DCT-II /     │ • DBF Boundary    │ • RDO  │
│ • Incremental     │ • 35 Intra Modes  │   DST-VII Core    │   Filter (bS)     │   Sim  │
│   Trace Playback  │ • RMD Funnel      │ • RQT Decomposition│ • SAO Corrections │ • Bits │
│ • CTU Mini-Map    │ • Real HM Matrix  │ • Quantization    │ • 4-Way Compare   │   Prov │
└───────────────────┴───────────────────┴───────────────────┴───────────────────┴────────┘
```

---

## 5-Step Guided Flow Breakdown

1. **01 Partition (Frame & CU Partition)**:
   - Frame picture viewer with CTU raster overlay and Z-scan traversal order.
   - Compact spatial mini-map (`CtuSpatialMiniMap`) with real-time viewport tracking.
   - Incremental CTU Playback Bar (`useHmTracePlayback`) supporting Play, Pause, Scrubbing, and Speed multipliers ($0.5\times, 1.0\times, 2.0\times$).
   - Interactive QuadTree partitioning tree with depth-level filtering ($64\times 64 \to 8\times 8$).
   - Parent / Intermediate CU node inspection (`SPLIT CU` vs `LEAF CU`) with decoupled playback state.

2. **02 Prediction (Intra & Inter Prediction)**:
   - $4N+1$ perimeter reference samples ($2N$ Above, $2N$ Left, $1$ Above-Left) with boundary availability markers ($A, B, C, D$).
   - Mode-Dependent Intra Smoothing (MDIS) 3-tap $[1, 2, 1]/4$ filter inspection.
   - 35 standard prediction modes (Planar, DC, and 33 Angular modes with 1/32-pel accuracy).
   - Real HM-18.0 bit-exact prediction matrix captured directly from C++ `predIntraAng()`.
   - Motion Vector (MV, MVD) search window, SAD/Lagrangian costs, and AMVP candidate lists.

3. **03 Residual & TU (Transform & Quantization)**:
   - Residual QuadTree (RQT) decomposition tree and interactive TU Call Stack (`TuTreeCallStack`).
   - Forward 2D Core Transforms: Integer DCT-II ($4\times 4$ to $32\times 32$) and DST-VII ($4\times 4$ Luma intra).
   - Quantization scaling matrices, QP shift levels, energy compaction ratio, and quantized transform coefficients.

4. **04 Reconstruction (Reconstruction & In-Loop Filtering)**:
   - Exact mathematical reconstruction verification: $S' = \text{Clip3}(0, 255, P + R')$.
   - 4-Picture Comparison across $Y$, $Cb$, $Cr$ channels ($S$, $P$, $R$, $S'$).
   - Dual before/after comparison slider against pristine source pixels with residual error gain boosters ($1\times, 2\times, 4\times, 8\times$).
   - Deblocking Filter (DBF) boundary filter strength ($bS \in \{0, 1, 2\}$) and Sample Adaptive Offset (SAO Edge & Band offsets).

5. **05 RD Decision (Rate-Distortion Optimization & Bitstream)**:
   - Rate-Distortion Optimization: $J = D + \lambda \cdot R$ with verified split vs. non-split decisions.
   - Binary arithmetic encoding state engine: context models, syntax element bins, context index (`ctxIdx`), and FSM probability state transitions (`pStateIdx: 0..62`).
   - Real CTU bit consumption telemetry (`CTU_ACTUAL_BITS`) measured directly after `encodeCtu()`.
   - Interactive RDO QuadTree Sandbox Simulator with live QP and $\lambda$ adjustment.

- **Unified Bar Controls**:
  - Global Channel switcher (`Y`, `Cb`, `Cr` via key `C` or chip).
  - Matrix numerical cell values toggle (`showValues` via key `V`).
  - Zero-clutter, clean minimalist interface without repetitive badges or redundant ribbons.

---

## Feature-First Vertical Stage Organization

Microarchitectural stage components are organized in `src/components/stages/`:

```
src/components/stages/
├── cp00_frame_gop/          # GopReferenceVisualizer (GOP temporal structure & reference lists)
├── cp01_partition/          # QuadTreeVisualizer, CtuSpatialMiniMap, CtuNavigationOverlay
├── cp02_intra_search/       # IntraPredictionFlow, IntraStudioVisualizer, ReferencePixelStrip
├── cp03_inter_search/       # InterPredictionVisualizer (Motion vectors & AMVP lists)
├── cp04_transform_quant/    # TransformQuantVisualizer, TuTreeCallStack, FrequencyHeatmap
├── cp05_recon_picture/      # ReconPictureVisualizer, FourPictureComparison, PixelMatrixCanvas
├── cp06_inloop_filter/      # InLoopFilterVisualizer (DBF boundary profiles & SAO offsets)
├── cp07_cabac_entropy/      # CabacEntropyVisualizer (CABAC state machine & bin tracing)
└── rdo_simulator/           # RdoQuadtreeSimulator, PixelMicroscope, CandidateModesTable
```

---

## Modular Apple Design System (`components/apple/`)

The design system is split into 10 single-responsibility modules:
- `AppleCard.jsx`: Glass-morphism containers, headers, action slots.
- `AppleButton.jsx`: Clean push-button variants (`primary`, `secondary`, `danger`, `ghost`).
- `SegmentedControl.jsx`: Smooth sliding segment toggles.
- `AppleBadge.jsx`: Micro status indicators and semantic badges.
- `AppleSlider.jsx`: Precise tactile scrubbers.
- `AppleToggle.jsx`: Accessible boolean switch controls.
- `AppleSelect.jsx`: Native dropdown select wrappers.
- `AppleTabs.jsx`: Tab navigation components.
- `AppleTooltip.jsx`: Floating micro-tooltips.
- `AppleModal.jsx`: Portaled dialog overlays.
- `index.jsx`: Barrel file preserving all 39 named exports with zero consumer breakages.

---

## Scoped Query & Caching Model (`useAnalysisSession`)

Network traffic is optimized via three distinct query scopes:
1. **Job Scope** (`fetchJobCheckpoints`): Retrieves global session metadata (`CP_00_FRAME_GOP`, `partitions`). Executed once per encode job.
2. **CTU Scope** (`fetchCtuCheckpoints`): Retrieves CTU-wide analysis data (`CP_01_PARTITION`, `CP_04_TRANSFORM_RQT`, `CP_05_RECON_PICTURE`, `CP_06_INLOOP_FILTER`, `CP_07_CABAC_ENTROPY`, `rdo-decisions`) only when the target CTU changes.
3. **CU Scope** (`fetchCuCheckpoints`): Retrieves leaf CU predictions (`CP_02_INTRA_REF`, `CP_03_INTRA_SEARCH`, `CP_03_INTER_SEARCH`) only when a CU node is clicked.
4. **AbortController Request Cancellation**: Active intra pipeline fetches are automatically cancelled when the user rapidly navigates between CUs.
5. **In-Memory LRU Cache**: Instantaneous cache hits eliminate repeated network fetches for previously inspected blocks.

---

## Unified Analysis Inspector (Right Panel)

Acts as the **Single Source of Truth** for all spatial, block, coding, and sequence telemetry:
- **Target Geometry**: Raster index, CTU coordinates $(x, y)$, sample bounds, leaf CU count, picture boundary state, and action button (Analyze / Re-Analyze CTU).
- **Active Coding Unit**: Depth level, block dimension, QuadTree hierarchy, selected Intra Mode, mode category, and RDO cost $J$.
- **Neighbor Line Buffers**: Spatial availability of surrounding blocks A (Left), B (Above), C (Above-Right), and D (Above-Left) adhering to ITU-T H.265 Section 6.4.1.
- **Sequence Telemetry**: Source file, resolution, CTU grid dimensions, colorimetry (YCbCr 4:2:0 BT.709), and encoder version (HM-18.0).
- Toggle visibility anytime via the header button or keyboard shortcut `I`.

---

## Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `1` – `5` | Switch directly between Guided Steps 1 through 5 |
| `C` / `c` | Cycle Active Channel (`Y` $\to$ `Cb` $\to$ `Cr` $\to$ `Y`) in Guided Flow |
| `V` / `v` | Toggle Matrix Cell Values overlay (`showValues`) in Guided Flow |
| `I` / `i` | Toggle Unified Analysis Inspector panel |
| `D` / `d` | Toggle Dark / Light theme |
| `Space` | Toggle CTU auto-play / pause timeline animation |
| `ArrowLeft` / `ArrowRight` | Step backward / forward through CTUs or modes |
| `Escape` | Deselect active pixel / stop animation |

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (Node 22 recommended)
- **npm**: v9.0.0 or higher

### Installation
```bash
cd web_app/frontend
npm install
```

### Development Server
```bash
# Starts Vite dev server on http://localhost:5173
npm run dev
```
API requests to `/upload`, `/health`, and `/api` are automatically proxied to the FastAPI backend (`http://localhost:8000`) via `vite.config.js`.

### Production Build
```bash
# Build optimized production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

### Code Quality & Testing
```bash
# Run ultra-fast linter (oxlint: 0 warnings, 0 errors across 137 files)
npx oxlint

# Run automated test suites (19 test suites, 100% passed)
npm test
```

---

## Configuration

If the FastAPI backend is hosted on a custom host or port, configure the backend endpoint via `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```
