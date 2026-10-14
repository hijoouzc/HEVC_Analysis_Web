# HEVC Analysis Tool - Web Application

This directory contains the fullstack web application that interfaces with the instrumented HM-18.0 reference encoder.

## Structure

- **`backend/`**: FastAPI (Python 3.12 / 3.14) REST API server.
  - Manages asynchronous encoding jobs (HTTP 202 + polling) and isolated workspace sessions.
  - Converts user image uploads to raw YUV420p via FFmpeg with ITU-R BT.709 colorimetry.
  - Dispatches `TAppEncoder` with target ROI configuration and trace pipes.
  - Parses JSONL trace streams into strongly-typed Pydantic domain models across all 9 checkpoints:
    - Frame & GOP temporal structures (`CP_00_FRAME_GOP`)
    - Partition trees (`CP_01_PARTITION`, `partitions`)
    - Intra reference samples & MDIS filtering (`CP_02_INTRA_REF`)
    - 35 Intra candidate searches & angular evaluations (`CP_03_INTRA_SEARCH`, `intra-pipeline`)
    - Inter search & motion vectors (`CP_04_INTER_SEARCH`)
    - Mathematical reconstruction validation (`CP_05_RECON`)
    - 2D Transform & RDOQ Quantization matrices (`CP_06_TRANSFORM`, `CP_07_QUANT`)
    - Deblocking Filter & SAO in-loop filtering (`CP_07_LOOP_FILTER`)
    - CABAC entropy syntax elements & context model states (`CP_08_CABAC`)
  - Provides **39 integration and unit tests** (`pytest`, 100% passed).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Apple macOS Tahoe design language with zero rounded corners on video frames, CTUs, and matrix cells (pixel-accurate).
  - Built with **Persistent DOM Shells** across all viewports to completely eliminate layout shifts (zero CLS).
  - **Stage 0 (GOP Reference)**: Inter-frame reference structures, POC, slice types (I, P, B), and L0/L1 reference lists.
  - **Stage 1 (CTU Grid)**: High-performance SVG multi-layer renderer for 64×64 CTU boundaries and picture boundary forced split handling.
  - **Stage 2 (Intra Prediction Flow)**: 5-stage sequential stepper: Boundary & MDIS, RMD Funnel, Candidates & MPM, Full RDO 6-Stage Domain Strip, and Chroma Winner with CABAC syntax.
  - **Stage 3 (Inter Search)**: Reference picture matching, motion vectors (MV), and SAD/cost inspection.
  - **Stage 4 (Transform & Quant)**: 2D DCT-II and 2D DST-VII frequency spectrum inspection.
  - **Stage 5 (Reconstruction)**: Standard ITU-R BT.709 colorimetry with 4-way synchronized matrix inspection ($S, P, R, S'$).
  - **Stage 6 (In-Loop Filtering)**: Boundary cross-section plots, Deblocking Filter ($Bs \in \{0,1,2\}$) and SAO Edge/Band offsets.
  - **Stage 7 (CABAC Entropy)**: Context models, binary arithmetic coder state machine, and MPS/LPS intervals.
  - **Stage 8 (RDO Simulator)**: In-browser HM `xCompressCU` simulation with live QP & $\lambda$ sliders, persistent candidate table, and Draw.io export.
  - **Stage 9 (4-Way Comparison)**: Full picture comparison with interactive Split Wipe slider and residual gain boosters.
  - **Unified Analysis Inspector**: Collapsible right-hand inspector panel serving as the single source of truth for all spatial, block, coding, and line buffer telemetry.
  - Provides **458 automated tests** (`npm test`) and zero-warning linting (`oxlint`).

## Development

To run both services together, use the root launcher:
```bash
./run_tool.sh
```

Or run them individually:

### Backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --port 8000 --reload
```

### Frontend:
```bash
cd frontend
npm install
npm run lint
npm test
npm run dev
```

