# HEVC Analysis Tool - Web Application

This directory contains the fullstack web application that interfaces with the instrumented HM-18.0 reference encoder.

## Structure

- **`backend/`**: FastAPI (Python 3.12 / 3.14) REST API server.
  - Manages asynchronous encoding jobs (HTTP 202 + polling) and isolated workspace sessions.
  - Converts user image uploads to raw YUV420p via FFmpeg with ITU-R BT.709 colorimetry.
  - Dispatches `TAppEncoder` with target ROI configuration and trace pipes.
  - Parses JSONL trace streams into strongly-typed Pydantic domain models across all checkpoints:
    - Frame & GOP temporal structures (`CP_00_FRAME_GOP`)
    - Partition trees (`CP_01_PARTITION`, `partitions`)
    - Intra reference samples & MDIS filtering (`CP_02_INTRA_REF`)
    - 35 Intra candidate searches & angular evaluations (`CP_03_INTRA_SEARCH`, `intra-pipeline`)
    - Inter search & motion vectors (`CP_03_INTER_SEARCH`)
    - Residual Transform & RQT hierarchy (`CP_04_TRANSFORM_RQT`)
    - Reconstructed picture buffer pre-in-loop filtering (`CP_05_RECON_PICTURE`)
    - Deblocking Filter & SAO in-loop filtering (`CP_06_INLOOP_FILTER`)
    - CABAC entropy syntax elements & context model states (`CP_07_CABAC_ENTROPY`)
  - Provides **39 integration and unit tests** (`pytest`, 100% passed).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Apple macOS Tahoe design language with zero rounded corners on video frames, CTUs, and matrix cells (pixel-accurate).
  - Built with **Persistent DOM Shells** across all viewports to completely eliminate layout shifts (zero CLS).
  - **Stage 0 (0. Frame & GOP, `CP_00`)**: Inter-frame reference structures, POC, slice types (I, P, B), and L0/L1 reference lists.
  - **Stage 1 (1. CU QuadTree, `CP_01`)**: High-performance SVG multi-layer renderer for 64×64 CTU boundaries and picture boundary forced split handling.
  - **Stage 2 (2. Intra Search, `CP_02`)**: 5-stage sequential stepper: Boundary & MDIS, RMD Funnel, Candidates & MPM, Full RDO 6-Stage Domain Strip, and Chroma Winner with CABAC syntax.
  - **Stage 3 (3. Inter Search, `CP_03`)**: Reference picture matching, motion vectors (MV, MVD), and SAD/cost inspection.
  - **Stage 4 (4. Transform RQT, `CP_04`)**: 2D DCT-II and 2D DST-VII frequency spectrum inspection and energy compaction.
  - **Stage 5 (5. Recon Picture, `CP_05`)**: Reconstructed picture buffer before in-loop filtering with Full-Frame Split Wipe Slider comparison against source ($S$) and discrete CU planar inspection ($Y, Cb, Cr$) with sample verification $S' = \text{Clip}(P + R')$.
  - **Stage 6 (6. In-Loop Filter, `CP_06`)**: Boundary cross-section plots, Deblocking Filter ($bS \in \{0,1,2\}$) and SAO Edge/Band offsets.
  - **Stage 7 (7. CABAC Entropy, `CP_07`)**: Context models, binary arithmetic coder state machine, and MPS/LPS intervals.
  - **Stage 8 (8. RDO Simulator, `RDO_SIM`)**: In-browser HM `xCompressCU` simulation with live QP & $\lambda$ sliders, persistent candidate table, and Draw.io export.
  - **Unified Analysis Inspector**: Collapsible right-hand inspector panel serving as the single source of truth for all spatial, block, coding, and line buffer telemetry.
  - Provides **458 automated tests** across 8 test suites (`npm test`) and zero-warning linting (`oxlint`).

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

