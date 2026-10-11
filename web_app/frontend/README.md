# HEVC Video Analyzer - Frontend

Modern, high-performance web interface built with **React 19** and **Vite** for deep microarchitectural inspection and mathematical visualization of ITU-T H.265 / HEVC video encoding decisions.

Implemented strictly following **Apple macOS Tahoe (applecn)** design language and **ITU-R pixel-accurate standards** (100% discrete pixel fidelity, zero rounded corners on picture frames, CTU/CU blocks, and matrix cells).

---

## Workspace Tabs (7-Stage Pipeline)

The application organizes the analysis process into 7 dedicated, distraction-free stages:

1. **1. CTU Grid (`MACRO`)**:
   - Multi-layer high-performance SVG/Canvas renderer displaying 64×64 Coding Tree Units across the entire frame.
   - Picture boundary handling: Forced Split detection, valid pixel sample extent, and out-of-bounds cross-hatching.
   - Interactive leaf CU selection with instantaneous deselect support (<0.1ms reticle response).
   - Toggles: Original image vs Partition Map, Outline vs Depth coloring, 64×64 Grid ON/OFF, Boundary ON/OFF, and HM-16.0 `compressCtu` C++ source code inspector.

2. **2. YCbCr Planes (`YUV_VIEW`)**:
   - Real-time planar decomposition into Luma ($Y$), Chroma Cb ($U$), and Chroma Cr ($V$) under 4:2:0 subsampling.
   - Color visualization modes: Composite RGB, Channel Tint, Grayscale, and Turbo Heatmap.
   - Direct crosshair pixel readout across all 3 color planes.

3. **3. CU QuadTree (`CP_01`)**:
   - Hierarchical tree visualization of recursive QuadTree splits ($64\times 64 \rightarrow 32\times 32 \rightarrow 16\times 16 \rightarrow 8\times 8$, Depth 0–3) in Morton Z-scan order.
   - Node depth levels, split flags (`split_cu_flag`), coordinates, and direct jump to intra prediction analysis.

4. **4. RDO Simulator (`RDO_SIM`)**:
   - Pure in-browser simulation of HM Reference Software `TEncCu::xCompressCU`.
   - Rate-Distortion Optimization formula: $J = D + \lambda \cdot R$ with dynamic $\lambda = 0.57 \times 2^{(QP-12)/3}$ and $Q_{\text{step}} = 2^{(QP-4)/6}$.
   - Interactive timeline stepper (First, Prev, Play/Pause, Next, Last) with configurable playback speed (ms).
   - Live parameter sliders with variable readouts: **QP Slider** with real-time **$\lambda$ multiplier badge**, and **Speed Slider** (150–1500ms).
   - Non-Split vs Split RDO decision cards comparing SSD distortion, bit-rate estimates, and Lagrangian costs.
   - Ground-truth synchronization with HM-16.0 encoder trace checkpoints.
   - One-click Draw.io XML export and C++ source code modal.

5. **5. Intra Prediction (`INTRA_PIPE`)**:
   - 35 Intra candidate modes with RDO cost curves and Most Probable Modes (MPMs).
   - 360° interactive Angular Compass with displacement vectors ($A \cdot d$).
   - 4N+1 perimeter reference samples with Mode-Dependent Intra Smoothing (MDIS 3-tap $[1, 2, 1]/4$) and boundary filtering.
   - 4-stage pipeline stepper: Reference Samples, Angular Projection, Spatial Synthesis, and Residual Generation.

6. **6. Transform & Quant (`CP_06_07`)**:
   - 2D DCT-II and 2D DST-VII frequency spectrum inspection for $4\times 4$ to $32\times 32$ transform blocks.
   - Quantization scaling matrices, QP shift levels, energy compaction ratio, DC harmonic energy, and Coded Block Flags (CBF).

7. **7. Reconstruction (`RECON_VIEW`)**:
   - **Overview Mode**: Side-by-side comparison of Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$) with an interactive draggable Split Wipe slider and residual error gain boosters ($1\times, 2\times, 4\times, 8\times$).
   - **Synchronized 4-Way Mode**: Synchronized crosshair pixel inspector across Original, Prediction, Residual, and Reconstruction matrices with 2×2 Grid and 4-Column layouts across $Y$, $Cb$, $Cr$ channels.

---

## Unified Analysis Inspector (Right Panel)

Acts as the **Single Source of Truth** for all spatial, block, coding, and sequence telemetry:
- **Target Geometry**: Raster index, CTU coordinates $(x, y)$, sample bounds, leaf CU count, picture boundary state, and action button (Analyze / Re-Analyze CTU).
- **Active Coding Unit**: Depth level, block dimension, QuadTree hierarchy, selected Intra Mode, mode category, and RDO cost $J$.
- **Neighbor Line Buffers**: Spatial availability of surrounding blocks A (Left), B (Above), C (Above-Right), and D (Above-Left) adhering to ITU-T H.265 Section 6.4.1.
- **Sequence Telemetry**: Source file, resolution, CTU grid dimensions, colorimetry (YCbCr 4:2:0 BT.709), and encoder version (HM-16.0).
- Toggle visibility anytime via the header button or keyboard shortcut `I`.

---

## Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `1` – `7` | Switch directly between Stages 1 through 7 |
| `I` / `i` | Toggle Unified Analysis Inspector panel |
| `D` / `d` | Toggle Dark / Light theme |
| `Space` | Toggle auto-play / pause timeline animation |
| `ArrowLeft` / `ArrowRight` | Step backward / forward through modes or simulation |
| `Escape` | Stop playback animation |

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
# Run ultra-fast linter (oxlint)
npm run lint

# Run automated QuadTree & RDO test suite (187 tests)
npm test
```

---

## Configuration

If the FastAPI backend is hosted on a custom host or port, configure the backend endpoint via `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```
