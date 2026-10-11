# HEVC Trace-Driven Intra Analysis & Visualization Tool
> **Interactive Data-Flow & Microarchitectural Inspection Platform for ITU-T H.265 / ISO/IEC 23008-2 HEVC (HM-16.0)**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.141-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite_8-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![HEVC HM](https://img.shields.io/badge/HM_Reference-HM--16.0_C++-00599C.svg?logo=cplusplus&logoColor=white)](https://hevc.hhi.fraunhofer.de)
[![Standard](https://img.shields.io/badge/Standard-ITU--T_H.265_|_ISO/IEC_23008--2-E11D48.svg)](https://www.itu.int/rec/T-REC-H.265)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)

---

## Overview

The **HEVC Trace-Driven Intra Analysis & Visualization Tool** is a research and educational platform that bridges the gap between high-level video coding theory and low-level C++ reference implementations (**HM-16.0**).

Instead of viewing video compression as a black box, this tool instruments the reference software at runtime to capture the exact microarchitectural decisions, mathematical matrices, and spatial predictions inside Coding Tree Units (CTUs), Coding Units (CUs), Prediction Units (PUs), and Transform Units (TUs).

Designed with **Apple macOS Tahoe (applecn)** aesthetics and **ITU-R pixel-accurate standards** (100% discrete pixel fidelity, strictly rectangular $90^\circ$ corners on frames, CTUs, CUs, and matrix cells).

---

## Key Features (7-Stage Pipeline)

### 1. Interactive Full-Frame CTU Grid Navigator (`Stage 1: CTU Grid`)
- **Hierarchical QuadTree Map**: Visualizes the recursive QuadTree partitioning across the entire frame ($64\times 64 \rightarrow 32\times 32 \rightarrow 16\times 16 \rightarrow 8\times 8$).
- **Picture Boundary Handling**: Validates sample bounds, forced splits, and out-of-bounds cross-hatch shading.
- **Dual Viewport Switcher**: Toggle between the pristine original image (100% natural colors) and the partition map overlay.
- **Direct Spatial Selection**: Click directly on any CTU in the frame to lock focus and inspect block parameters.
- **C++ HM Source Code Inspector**: Modal viewer for `TEncSlice::compressSlice` and `xCompressCU` boundary checking.

### 2. YCbCr Planar Decomposition Viewer (`Stage 2: YCbCr Planes`)
- **Tri-Plane Color Space**: Real-time extraction and visualization of Luma ($Y$), Chroma Cb ($U$), and Chroma Cr ($V$) components under 4:2:0 subsampling.
- **Color Schemes**: Inspect planar values in Composite RGB, Monochrome, Channel Tint, or Turbo Heatmap color schemes.
- **Direct Pixel Inspector**: Inspect synchronized Y, U, and V pixel intensity values at any coordinate.

### 3. Hierarchical CU QuadTree Visualizer (`Stage 3: CU QuadTree`)
- **Z-Scan QuadTree Treeview**: Interactive SVG view of recursive splits and node coordinates within the active CTU in Morton Z-scan order.
- **CU Inspector**: Mode decisions, depth levels (0–3), `split_cu_flag`, and direct navigation into Intra Prediction.

### 4. Interactive RDO Simulator (`Stage 4: RDO Simulator`)
- **HM xCompressCU In-Browser Simulator**: Pure JavaScript simulation of HEVC QuadTree partitioning and Rate-Distortion Optimization ($J = D + \lambda \cdot R$).
- **Live Variable Controls**: Interactive **QP Slider** (10–51) with dynamic **$\lambda$ multiplier badge** ($\lambda = 0.57 \times 2^{(QP-12)/3}$) and **Speed Slider** (150–1500ms).
- **Step-by-Step Call Stack**: Visual call stack breadcrumbs, active node evaluations, and RDO decision cards comparing Non-Split vs Split costs.
- **Draw.io XML Export**: One-click generation and clipboard copy of professional hierarchical XML trees.

### 5. Deep Intra Prediction Analysis (`Stage 5: Intra Prediction`)
- **35 HEVC Intra Prediction Modes**: Full inspection of Planar (Mode 0), DC (Mode 1), and 33 Angular Directions (Modes 2–34) + 3 MPM candidates.
- **Interactive Angular Compass**: 360° directional visualizer displaying intra prediction angles and displacement vectors ($A \cdot d$).
- **Reference Sample Filtering**: Complete visibility into unfiltered vs filtered reference samples (MDIS 3-tap $[1, 2, 1]/4$).
- **4-Stage Pipeline Stepper**: Inspect Reference Samples, Angular Projection, Spatial Synthesis, and Residual Generation.

### 6. 2D Transform & RDOQ Quantization Engine (`Stage 6: Transform & Quant`)
- **2D DCT-II & 2D DST-VII**: Exact mathematical core transforms for $4\times 4$ intra luma (DST-VII) and $8\times 8$ to $32\times 32$ transform blocks (DCT-II).
- **Frequency Spectrum & Sparsity**: Energy compaction ratio, DC harmonic energy, zero sparsity ratio, and Coded Block Flags (CBF).

### 7. Reconstruction & Residual Inspection (`Stage 7: Reconstruction`)
- **Overview Mode**: Compare Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$) with an interactive draggable Split Wipe slider and residual error gain boosters ($1\times, 2\times, 4\times, 8\times$).
- **Synchronized 4-Way Mode**: Synchronized crosshair pixel inspector across Original, Prediction, Residual, and Reconstruction matrices with 2×2 Grid and 4-Column layouts across $Y$, $Cb$, $Cr$ channels.

### 8. Unified Analysis Inspector (Right Panel)
- **Single Source of Truth**: Replaced fragmented HUD bars with a unified Apple Photos/Inspector-style panel.
- Displays Target CTU Geometry, Active CU Block Dimensions & Depth, Selected Intra Mode & Category, RDO Cost $J$, Neighbor Line Buffers (A, B, C, D availability per ITU-T H.265 Section 6.4.1), and Sequence Telemetry.
- Built-in CTU re-analysis button and automatic desynchronization guards.

---

## Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `1` – `7` | Switch directly between Stages 1 through 7 |
| `I` / `i` | Toggle Unified Analysis Inspector panel |
| `D` / `d` | Toggle Dark / Light theme |
| `Space` | Toggle auto-play / pause timeline animation |
| `ArrowLeft` / `ArrowRight` | Step backward / forward through modes or simulation |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend                      │
│   (Apple Minimalist Design, Zero Clutter, Responsive Canvas)     │
└───────────────────────────────▲──────────────────────────────────┘
                                │ HTTP / REST JSON (Async Job & Checkpoints)
┌───────────────────────────────▼──────────────────────────────────┐
│                     FastAPI Python Backend                       │
│  • Job Manager & Session Isolation (UUID Workspace)              │
│  • Checkpoint Parsing Pipeline (Partitions, Intra, Transforms)   │
│  • FFmpeg Native YUV420p Color Conversion & Scaling Adapter       │
└───────────────────────────────▲──────────────────────────────────┘
                                │ Subprocess Execution + Trace Pipes
┌───────────────────────────────▼──────────────────────────────────┐
│                 HM-16.0 Reference Software (C++)                 │
│  • VisualDumper Instrumentation Hooks in TEncCu, TEncSearch,      │
│    and TComTrQuant                                               │
│  • Emits per-CU structured JSONL traces at encode time           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (One-Click Launch)

A unified startup script is provided to automate environment initialization, dependency installation, encoder detection/auto-compilation, and service startup:

```bash
# Clone the repository
git clone https://github.com/hijoouzc/HEVC_Analysis_Web.git
cd HEVC_Analysis_Web

# Run the unified launcher
./run_tool.sh
```

Access the application in your browser:
- **Web Application**: `http://localhost:5173`
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## Manual Setup & Build Guide

### Prerequisites
- **Linux** (Ubuntu 20.04/22.04/24.04 recommended) or macOS
- **GCC / G++ 11+** with C++11/C++14 support
- **CMake 3.16+** and `make`
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** (Node 22 recommended) and `npm`
- **FFmpeg** (installed and available in `PATH`)

### 1. Build HM-16.0 Encoder with Visual Instrumentation
```bash
# Build optimized Release binary (recommended)
make TAppEncoder-r -j$(nproc)

# Or build Debug binary:
make TAppEncoder-d -j$(nproc)
```

### 2. Backend Setup
```bash
cd web_app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run automated test suite (29 tests)
pytest -v

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd web_app/frontend

# Install dependencies
npm install

# Run linter
npm run lint

# Run automated test suite (187 tests)
npm test

# Start development server
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Project Structure

```
HEVC_reference_software/
├── bin/                          # Compiled HM executables (TAppEncoder, etc.)
├── build/                        # Build files and Makefiles
├── cfg/                          # HM encoder configuration profiles
├── doc/                          # HM reference software documentation
├── source/                       # HM-16.0 C++ Source Code
│   ├── App/                      # Application wrappers (TAppEncoder, TAppDecoder)
│   └── Lib/                      # Core libraries (TLibCommon, TLibEncoder, TLibDecoder)
│       ├── TLibCommon/
│       │   ├── VisualDumper.h    # C++ Visual Instrumentation Header
│       │   ├── VisualDumper.cpp  # Trace serialization engine
│       │   └── TComTrQuant.cpp   # Transform & Quantization dumper hook
│       └── TLibEncoder/
│           ├── TEncCu.cpp        # QuadTree partition dumper hook
│           └── TEncSearch.cpp    # Intra prediction search & reference hooks
├── web_app/                      # Fullstack Analysis Platform
│   ├── backend/                  # FastAPI Application
│   │   ├── app/                  # Application core, API routers, parsers, engine
│   │   ├── tests/                # Unit & Integration test suite (29 tests)
│   │   └── requirements.txt      # Python dependencies
│   └── frontend/                 # React 19 + Vite Application
│       ├── src/
│       │   ├── components/       # 7-stage Viewports, FullFrameViewer, RDO Simulator, Apple UI
│       │   ├── hooks/            # Session management, caching, async polling
│       │   └── utils/            # HEVC Color utilities, RDO simulator, draw.io generator
│       └── package.json          # Node dependencies
├── workspace/                    # Transient encoding sessions & workspace
├── run_tool.sh                   # Unified launcher script
└── README.md                     # Project documentation
```

---

## License

This software package is distributed under the **BSD 3-Clause License**. See the `LICENSE` file for details.
