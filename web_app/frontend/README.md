# HEVC Video Analyzer - Frontend

Modern, high-performance web interface built with **React 19** and **Vite** for deep microarchitectural inspection and mathematical visualization of ITU-T H.265 / HEVC video encoding decisions.

Implemented strictly following **Apple macOS Tahoe (applecn)** design language and **ITU-R pixel-accurate standards** (100% discrete pixel fidelity, zero rounded corners on picture frames, CTU/CU blocks, and matrix cells).

---

## Workspace Tabs (10-Stage Pipeline)

The application organizes the analysis process into 10 dedicated, distraction-free stages with **Persistent DOM Shells** (fixed/min-height containers) that completely eliminate layout shift (CLS):

0. **0. GOP Reference (`CP_00_FRAME_GOP`)**:
   - Inter-frame reference structures, Picture Order Count (POC), slice types (I, P, B), and temporal layers.
   - Reference picture lists L0 and L1 visualization.

1. **1. CTU Grid (`CP_01_PARTITION`)**:
   - Multi-layer high-performance SVG/Canvas renderer displaying 64×64 Coding Tree Units across the entire frame.
   - Picture boundary handling: Forced Split detection, valid pixel sample extent, and out-of-bounds cross-hatching.
   - Interactive leaf CU selection with instantaneous deselect support (<0.1ms reticle response) and persistent inspector shell (`min-height: 430px`).
   - Toggles: Original image vs Partition Map, Outline vs Depth coloring, 64×64 Grid ON/OFF, Boundary ON/OFF, and HM-18.0 `compressCtu` C++ source code inspector.

2. **2. Intra Prediction Flow (`CP_02` / `CP_03`)**:
   - Deep 5-stage sequential pipeline stepper with persistent card height (`min-height: 560px`):
     - **Step 1: Boundary & MDIS**: 4N+1 perimeter reference samples, 3-tap $[1, 2, 1]/4$ smoothing filter, reference padding, and availability lines.
     - **Step 2: RMD Funnel**: 35-mode fast Hadamard cost funnel with Top K pruning and fixed list height (`380px`).
     - **Step 3: Candidates & MPM**: Most Probable Modes derivation from Left and Above neighbors with Planar/DC/Vertical fallback rules.
     - **Step 4: Full RDO**: 6-Stage Domain Strip ($S \to P \to R \to C \to Q \to S'$) with exact Lagrangian cost ($J = D + \lambda \cdot R$).
     - **Step 5: Chroma Search**: Cb/Cr planar matrices, DM_CHROMA mode, Mode 34 replacement rule, and CABAC syntax elements.

3. **3. Inter Search & Motion Estimation (`CP_04_INTER_SEARCH`)**:
   - Reference frame block matching, Motion Vector (MV) search window, SAD/Lagrangian costs, and sub-pixel interpolation.

4. **4. Transform & Quant (`CP_06` / `CP_07`)**:
   - 2D DCT-II and 2D DST-VII frequency spectrum inspection for $4\times 4$ to $32\times 32$ transform blocks.
   - Quantization scaling matrices, QP shift levels, energy compaction ratio, DC harmonic energy, and Coded Block Flags (CBF).

5. **5. Reconstruction (`CP_05_RECON`)**:
   - Standard ITU-R BT.709 mathematical colorimetry with 4-Way synchronized matrix inspection (Original $S$, Prediction $P$, Residual $R$, Reconstruction $S'$).
   - Discrete planar components Y, Cb, Cr with mathematical sample verification: $S' = \text{Clip}(P + R')$.
   - Persistent synchronized sample readout HUD (`min-height: 88px`).

6. **6. In-Loop Filtering (`CP_07_LOOP_FILTER`)**:
   - Deblocking Filter (DBF) boundary strength ($Bs \in \{0, 1, 2\}$) and boundary cross-section plots (`min-height: 190px`).
   - Sample Adaptive Offset (SAO) Edge and Band offset classification.

7. **7. CABAC Entropy Coding (`CP_08_CABAC`)**:
   - Binary arithmetic encoding state engine: context models, MPS/LPS transitions, Range and Offset intervals.

8. **8. RDO Simulator (`RDO_SIM`)**:
   - Pure in-browser simulation of HM Reference Software `TEncCu::xCompressCU`.
   - Rate-Distortion Optimization formula: $J = D + \lambda \cdot R$ with dynamic $\lambda = 0.57 \times 2^{(QP-12)/3}$ and $Q_{\text{step}} = 2^{(QP-4)/6}$.
   - Persistent Candidate Modes Table (`min-height: 210px`) and 192×192px Pixel Microscope matrix cards (standby state during split nodes, zero layout jumps).
   - Non-Split vs Split RDO decision cards comparing SSD distortion, bit-rate estimates, and Lagrangian costs.
   - One-click Draw.io XML export and HM-18.0 C++ source code modal.

9. **9. 4-Way Comparison (`FOUR_WAY_VIEW`)**:
   - Comprehensive side-by-side comparison of Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$) with an interactive draggable Split Wipe slider and residual error gain boosters ($1\times, 2\times, 4\times, 8\times$).

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
| `0` – `9` | Switch directly between Stages 0 through 9 |
| `I` / `i` | Toggle Unified Analysis Inspector panel |
| `D` / `d` | Toggle Dark / Light theme |
| `Space` | Toggle auto-play / pause timeline animation |
| `ArrowLeft` / `ArrowRight` | Step backward / forward through modes or simulation |
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
# Run ultra-fast linter (oxlint: 0 warnings, 0 errors across 59 files)
npm run lint

# Run automated test suites (458 tests across 8 suites)
npm test
```

---

## Configuration

If the FastAPI backend is hosted on a custom host or port, configure the backend endpoint via `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```
