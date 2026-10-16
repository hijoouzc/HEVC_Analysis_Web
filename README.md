# HEVC Trace-Driven Intra Analysis & Visualization Tool
> **Interactive Data-Flow & Microarchitectural Inspection Platform for ITU-T H.265 / ISO/IEC 23008-2 HEVC (HM-18.0)**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.141-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite_8-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![HEVC HM](https://img.shields.io/badge/HM_Reference-HM--18.0_C++-00599C.svg?logo=cplusplus&logoColor=white)](https://hevc.hhi.fraunhofer.de)
[![Standard](https://img.shields.io/badge/Standard-ITU--T_H.265_|_ISO/IEC_23008--2-E11D48.svg)](https://www.itu.int/rec/T-REC-H.265)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)

---

## Overview

The **HEVC Trace-Driven Intra Analysis & Visualization Tool** is a research and educational platform that bridges the gap between high-level video coding theory and low-level C++ reference implementations (**HM-18.0**).

Instead of viewing video compression as a black box, this tool instruments the reference software at runtime to capture the exact microarchitectural decisions, mathematical matrices, and spatial predictions inside Coding Tree Units (CTUs), Coding Units (CUs), Prediction Units (PUs), and Transform Units (TUs).

Designed with **Apple macOS Tahoe (applecn)** aesthetics and **ITU-R pixel-accurate standards** (100% discrete pixel fidelity, strictly rectangular $90^\circ$ corners on frames, CTUs, CUs, and matrix cells).

---

## Dual-Mode Architecture

The platform features a seamless dual-mode architecture tailored for both structured pedagogical walkthroughs and deep-dive microarchitectural telemetry:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HEVC Video Analyzer                             │
├───────────────────────────────────┬────────────────────────────────────┤
│  Mode 1: 5-Step Guided Journey    │  Mode 2: 9-Tab Expert Telemetry    │
│  (Sequential HM xCompressCU Flow) │  (Granular VisualDumper Checkpoints)│
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. Frame & CU Partition           │  0. Frame & GOP (CP_00)            │
│ 2. Intra Prediction               │  1. CU QuadTree (CP_01)            │
│ 3. Transform & Quantization       │  2. Intra Search (CP_02)           │
│ 4. Reconstruction                 │  3. Inter Search (CP_03)           │
│ 5. RDO Decision                   │  4. Transform & Quant (CP_04)      │
│                                   │  5. Recon Picture (CP_05)          │
│                                   │  6. In-Loop Filter (CP_06)         │
│                                   │  7. CABAC Entropy (CP_07)          │
│                                   │  8. RDO Simulator (RDO_SIM)        │
└───────────────────────────────────┴────────────────────────────────────┘
         (Press 'M' key to toggle between Guided and Expert modes)
```

---

## Key Features

### 1. 5-Step Guided Journey (`Guided Flow`)
Organized chronologically following the exact encoder decision lifecycle inside HM `TEncCu::xCompressCU`:
- **Step 1: Frame & CU Partition**:
  - **Incremental Trace Playback**: Full-frame CTU transport bar (`Start Encode`, `Prev/Next CTU`, `Prev/Next CU`, `Reset`, and speed controls `0.5s`, `1.0s`, `2.0s`).
  - **Split CU vs Leaf CU Inspection**: Seamless inspection of parent split nodes ($64\times 64$, $32\times 32$) vs final leaf coding units.
  - **Playhead Decoupling**: Inspecting any CU node preserves the playback state without altering the current CTU playhead.
- **Step 2: Intra Prediction**:
  - **4N+1 Perimeter & MDIS**: Reconstructs top, left, and corner reference samples with Mode Dependent Intra Smoothing (3-tap $[1, 2, 1]/4$ filter).
  - **35 Prediction Modes**: Planar (0), DC (1), and 33 Angular modes (2–34) with exact $1/32$-pel projection rays.
  - **RMD Funnel & 3 MPMs**: Rough Mode Decision SATD pre-screening and Most Probable Mode derivation from spatial neighbors.
- **Step 3: Transform & Quantization**:
  - **RQT Hierarchy & Call Stack**: Interactive Transform Unit tree visualization with execution call stack stepper.
  - **2D Core Transforms**: Exact integer DCT-II for $8\times 8$–$32\times 32$ and DST-VII for $4\times 4$ luma intra blocks.
  - **Quantization & Sparsity**: Quantized levels $Q(u, v)$, $QP$ / $Q_{\text{step}}$ indicators, and energy compaction metrics.
- **Step 4: Reconstruction**:
  - **Picture Buffer & 4-Way Comparison**: Original ($S$), Prediction ($P$), Residual ($R$), and Reconstruction ($S'$).
  - **Mathematical Verification**: Confirms $S' = \text{Clip3}(0, 255, P + R')$.
  - **In-Loop Filtering**: Deblocking Filter (boundary strength $bS \in \{0, 1, 2\}$) and Sample Adaptive Offset (SAO Edge/Band offsets).
- **Step 5: RDO Decision**:
  - **Lagrangian Cost Comparison**: Benchmarks Best No-Split Cost ($J_{\text{nosplit}}$) vs Best Split Cost ($J_{\text{split}}$) with verified HM provenance.
  - **Actual CTU Bits**: Displays ground-truth bitstream output measured directly after `encodeCtu()`.
  - **Interactive RDO Simulator**: Sandbox simulation with live $QP$ slider, $\lambda$ multiplier, and Draw.io export.

### 2. 9-Tab Expert Telemetry Checkpoints (`Expert Mode`)
Provides unconstrained, deep-dive access to all raw telemetry streams:
- `CP_00 Frame & GOP`: Temporal GOP hierarchy, POC, slice types (I, P, B), and L0/L1 reference lists.
- `CP_01 CU QuadTree`: Multi-layer SVG/Canvas partition map with boundary forced-split detection.
- `CP_02 Intra Search`: 5-phase intra search stepper, candidate leaderboard, and chroma modes.
- `CP_03 Inter Search`: Motion vector estimation (MV, MVD), search windows, and AMVP candidates.
- `CP_04 Transform & Quant`: Tri-matrix comparison (Residual $R$, DCT Spectrum $C$, Quantized $Q$).
- `CP_05 Recon Picture`: Full-frame before/after split slider and discrete CU planar inspection ($Y, Cb, Cr$).
- `CP_06 In-Loop Filter`: Boundary edge profiles ($\beta, t_C$) and SAO classification offsets.
- `CP_07 CABAC Entropy`: Context modeling (`ctxIdx`), state transitions (`pStateIdx`), and bitrate allocation.
- `RDO_SIM`: Standalone in-browser HM `xCompressCU` QuadTree simulator.

---

### 3. Real HM-18.0 Prediction & Verified RDO Telemetry
- **Bit-Exact Prediction Capture**: VisualDumper hooks capture `INTRA_TU_PRED` immediately after `predIntraAng()`, eliminating heuristic approximations.
- **Pre-Split Incumbent Preservation**: Records incumbent non-split cost before split search recursion to avoid overwrites.
- **Best-Split Accumulator**: Dedicated tracking ensures `cost_split` reliably reflects the true optimal split decision across multi-QP evaluations.
- **CTU Actual Bitstream Metric**: Anchors total bits to `TEncSlice::compressSlice` post-`encodeCtu()`.

---

### Unified Analysis Inspector (Right Panel)
- **Single Source of Truth**: Unified panel displaying target CTU coordinates, CU dimensions, QuadTree depth, selected Intra mode, RDO cost $J$, line buffer availability ($A, B, C, D$), and sequence telemetry.
- Toggle visibility anytime via the header button or keyboard shortcut `I`.

---

## Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `M` / `m` | Toggle View Mode (Guided Journey vs Expert Checkpoints) |
| `1` – `5` | Switch between Steps 1 through 5 (in Guided Journey mode) |
| `0` – `8` | Switch directly between Stages 0 through 8 (in Expert mode) |
| `I` / `i` | Toggle Unified Analysis Inspector panel |
| `D` / `d` | Toggle Dark / Light theme |
| `Space` | Toggle playback / pause timeline animation |
| `ArrowLeft` / `ArrowRight` | Step backward / forward through modes or CTUs |
| `Escape` | Deselect active pixel / dismiss overlays |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend                      │
│   (Apple Minimalist Design, Zero CLS, Responsive Pixel Canvas)   │
└───────────────────────────────▲──────────────────────────────────┘
                                │ HTTP / REST JSON (Async Job & CP_00..07, RDO_SIM)
┌───────────────────────────────▼──────────────────────────────────┐
│                     FastAPI Python Backend                       │
│  • Job Manager & Session Isolation (UUID Workspace)              │
│  • Checkpoint Parsing Pipeline (CP_00 to CP_07 Checkpoints)      │
│  • FFmpeg Native YUV420p Color Conversion & Scaling Adapter       │
└───────────────────────────────▲──────────────────────────────────┘
                                │ Subprocess Execution + Trace Pipes
┌───────────────────────────────▼──────────────────────────────────┐
│                 HM-18.0 Reference Software (C++)                 │
│  • VisualDumper Instrumentation Hooks across TLibCommon and      │
│    TLibEncoder (TEncCu, TEncSearch, TComTrQuant, TComLoopFilter) │
│  • Emits structured JSONL microarchitectural traces at encode    │
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
- **GCC / G++ 11+** with C++17 support
- **CMake 3.16+**
- **Python 3.10+** (Python 3.12 / 3.14 recommended)
- **Node.js 18+** (Node 22 recommended) and `npm`
- **FFmpeg** (installed and available in `PATH`)

### 1. Build HM-18.0 Encoder with Visual Instrumentation
The visual trace hooks are enabled by default (`ENABLE_VISUAL_DUMP=ON`).

```bash
# Configure and build Release binary with CMake
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
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

# Run automated test suite (48 tests)
pytest -v

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd web_app/frontend

# Install dependencies
npm install

# Run ultra-fast linter (oxlint: 0 warnings, 0 errors across 84+ files)
npm run lint

# Run automated test suite (816 tests across 18 comprehensive test suites)
npm test

# Start development server
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Project Structure

```
HEVC_reference_software/
├── bin/                          # Compiled HM executables (TAppEncoder, etc.)
├── build/                        # CMake build directory
├── cfg/                          # HM encoder configuration profiles
├── doc/                          # HM reference software documentation
├── docs/                         # Technical & architectural specifications
├── source/                       # HM-18.0 C++ Source Code
│   ├── App/                      # Application wrappers (TAppEncoder, TAppDecoder)
│   └── Lib/                      # Core libraries (TLibCommon, TLibEncoder, TLibDecoder)
│       ├── TLibCommon/
│       │   ├── VisualDumper.h    # C++ Visual Instrumentation Header
│       │   ├── VisualDumper.cpp  # Trace serialization engine
│       │   ├── TComTrQuant.cpp   # Transform & Quantization dumper hook
│       │   └── TComLoopFilter.cpp# Deblocking filter dumper hook
│       └── TLibEncoder/
│           ├── TEncCu.cpp        # QuadTree partition dumper hook
│           ├── TEncSearch.cpp    # Intra/Inter prediction search hooks
│           ├── TEncGOP.cpp       # Frame GOP structure dumper hook
│           ├── TEncSampleAdaptiveOffset.cpp # SAO dumper hook
│           └── TEncSbac.cpp      # CABAC entropy dumper hook
├── tools/                        # Intra probe CLI tools and standalone visualizer
│   ├── README_intra_probe.md
│   ├── intra_probe_main.cpp
│   └── intra_probe_visualize.py
├── web_app/                      # Fullstack Analysis Platform
│   ├── backend/                  # FastAPI Application
│   │   ├── app/                  # Application core, API routers, parsers, engine
│   │   ├── tests/                # Unit & Integration test suite (48 tests)
│   │   └── requirements.txt      # Python dependencies
│   └── frontend/                 # React 19 + Vite Application
│       ├── src/
│       │   ├── components/       # 9-stage Viewports, FullFrameViewer, RDO Simulator, Apple UI
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
