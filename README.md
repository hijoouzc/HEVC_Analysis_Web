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

## Key Features (10-Stage Inspection Pipeline)

The platform organizes microarchitectural inspection into 10 specialized stages with **Persistent DOM Shells** (fixed/min-height containers) guaranteeing **zero layout shift (CLS)** and immediate responsiveness:

### 0. GOP & Inter-Frame Temporal Structure (`Stage 0: GOP Reference`, `CP_00`)
- **Temporal Layer Hierarchy**: Visualizes GOP structures, Picture Order Count (POC), slice types (I, P, B), and temporal ID levels.
- **Reference Picture Lists**: Detailed breakdown of L0 and L1 active reference frames and QP modulation.

### 1. Interactive Full-Frame CTU Grid Navigator (`Stage 1: CTU Grid`, `CP_01`)
- **Hierarchical QuadTree Map**: Visualizes the recursive QuadTree partitioning across the entire frame ($64\times 64 \rightarrow 32\times 32 \rightarrow 16\times 16 \rightarrow 8\times 8$).
- **Picture Boundary Handling**: Validates sample bounds, forced splits, and out-of-bounds cross-hatch shading.
- **Direct Spatial Selection**: Click directly on any CTU in the frame to lock focus and inspect block parameters with a persistent inspector HUD (`min-height: 430px`).
- **C++ HM Source Code Inspector**: Modal viewer for `TEncSlice::compressSlice` and `xCompressCU` boundary checking.

### 2. Deep Intra Prediction Flow (`Stage 2: Intra Prediction`, `CP_02` / `CP_03`)
- **5-Stage Sequential Stepper** (`min-height: 560px`):
  - **Step 1: Reference Boundary & MDIS**: 4N+1 perimeter reference samples, 3-tap $[1, 2, 1]/4$ smoothing filter, and boundary padding.
  - **Step 2: RMD Funnel**: 35-mode fast Hadamard cost funnel with Top K pruning and fixed list height (`380px`).
  - **Step 3: MPM Derivation**: Most Probable Modes derivation from Left and Above spatial neighbors with Planar/DC/Vertical fallback rules.
  - **Step 4: Full RDO & 6-Stage Domain Strip**: Visual domain strip ($S \to P \to R \to C \to Q \to S'$) with Lagrangian cost $J = D + \lambda \cdot R$.
  - **Step 5: Chroma Search & Winner Commitment**: Cb/Cr planar matrices, DM_CHROMA mode, Mode 34 replacement rule, and CABAC syntax elements.

### 3. Inter Search & Motion Estimation (`Stage 3: Inter Search`, `CP_04`)
- **Block Matching & Motion Vectors**: Visualizes Motion Vectors (MV), integer/sub-pel search windows, and SAD/Lagrangian costs.

### 4. 2D Transform & RDOQ Quantization Engine (`Stage 4: Transform & Quant`, `CP_06` / `CP_07`)
- **2D DCT-II & 2D DST-VII**: Exact mathematical core transforms for $4\times 4$ intra luma (DST-VII) and $8\times 8$ to $32\times 32$ transform blocks (DCT-II).
- **Frequency Spectrum & Sparsity**: Energy compaction ratio, DC harmonic energy, zero sparsity ratio, and Coded Block Flags (CBF).

### 5. Reconstruction Picture Buffer (`Stage 5: Reconstruction`, `CP_05`)
- **ITU-R BT.709 Colorimetry**: Strict mathematical color conversion (BT.709 YUV $\to$ RGB) with 4-Way synchronized matrix inspection.
- **Discrete Planar Inspection**: Independent exploration of Luma ($Y$), Chroma Cb ($U$), and Chroma Cr ($V$) with mathematical verification: $S' = \text{Clip}(P + R')$.

### 6. In-Loop Filtering (`Stage 6: In-Loop Filtering`, `CP_07`)
- **Deblocking Filter (DBF)**: Boundary filter strength ($Bs \in \{0, 1, 2\}$) and cross-section pixel plot (`min-height: 190px`).
- **Sample Adaptive Offset (SAO)**: Edge offset and Band offset sample correction.

### 7. CABAC Entropy Coding (`Stage 7: CABAC Entropy`, `CP_08`)
- **Binary Arithmetic Coding**: Context models, MPS/LPS state transitions, Range and Offset probability intervals.

### 8. Interactive RDO Simulator (`Stage 8: RDO Simulator`)
- **HM xCompressCU In-Browser Simulator**: Pure JavaScript simulation of HEVC QuadTree partitioning and Rate-Distortion Optimization ($J = D + \lambda \cdot R$).
- **Live Variable Controls**: Interactive **QP Slider** (10–51) with dynamic **$\lambda$ multiplier badge** ($\lambda = 0.57 \times 2^{(QP-12)/3}$) and **Speed Slider** (150–1500ms).
- **Persistent DOM Containers**: Candidate Modes Table (`min-height: 210px`) and 192×192px Pixel Microscope matrix cards with zero layout flickering.
- **Draw.io XML Export**: One-click generation and clipboard copy of professional hierarchical XML trees.

### 9. 4-Way Comparison (`Stage 9: 4-Way Comparison`)
- **Split Wipe Comparison**: Compare Original ($S$), Prediction ($P$), Residual ($R = S - P$), and Reconstructed ($S' = P + R'$) with an interactive draggable Split Wipe slider and residual error gain boosters ($1\times, 2\times, 4\times, 8\times$).

---

### Unified Analysis Inspector (Right Panel)
- **Single Source of Truth**: Replaced fragmented HUD bars with a unified Apple Photos/Inspector-style panel.
- Displays Target CTU Geometry, Active CU Block Dimensions & Depth, Selected Intra Mode & Category, RDO Cost $J$, Neighbor Line Buffers (A, B, C, D availability per ITU-T H.265 Section 6.4.1), and Sequence Telemetry.
- Built-in CTU re-analysis button and automatic desynchronization guards.

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

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React 19 + Vite Frontend                      │
│   (Apple Minimalist Design, Zero CLS, Responsive Pixel Canvas)   │
└───────────────────────────────▲──────────────────────────────────┘
                                │ HTTP / REST JSON (Async Job & CP_00..08)
┌───────────────────────────────▼──────────────────────────────────┐
│                     FastAPI Python Backend                       │
│  • Job Manager & Session Isolation (UUID Workspace)              │
│  • Checkpoint Parsing Pipeline (CP_00 to CP_08 Checkpoints)      │
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

# Run automated test suite (39 tests)
pytest -v

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd web_app/frontend

# Install dependencies
npm install

# Run ultra-fast linter (oxlint: 0 warnings, 0 errors across 59 files)
npm run lint

# Run automated test suite (458 tests across 8 suites)
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
│   │   ├── tests/                # Unit & Integration test suite (39 tests)
│   │   └── requirements.txt      # Python dependencies
│   └── frontend/                 # React 19 + Vite Application
│       ├── src/
│       │   ├── components/       # 10-stage Viewports, FullFrameViewer, RDO Simulator, Apple UI
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
