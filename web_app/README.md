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
    - Verified CU RDO Decisions & CTU Actual Bits (`CU_RDO_DECISION`, `CTU_ACTUAL_BITS`)
  - Provides **76 integration and unit tests** (`pytest`, 100% passed).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Apple macOS Tahoe design language with zero rounded corners on video frames, CTUs, and matrix cells (pixel-accurate).
  - Built with **Persistent DOM Shells** across all viewports to completely eliminate layout shifts (zero CLS).
  - **5-Step Guided Journey** (Sequential HM `xCompressCU` lifecycle):
    - Step 1: `01 Partition` (Incremental CTU playback transport bar, Split CU vs Leaf CU inspection, decoupled playhead, CTU Spatial Mini-Map)
    - Step 2: `02 Prediction` (35 intra modes, 4N+1 perimeter, MDIS 3-tap filtering, RMD SATD funnel, 3 MPMs, real HM-18.0 bit-exact prediction matrix)
    - Step 3: `03 Residual & TU` (RQT QuadTree decomposition, TU call stack stepper, 2D core DCT-II/DST-VII, quantization sparsity, QP/$Q_{\text{step}}$)
    - Step 4: `04 Reconstruction` (Picture buffer pre/post-filter, mathematical verification $S' = \text{Clip3}(0, 255, P + R')$, 4-Picture comparison across $Y, Cb, Cr$)
    - Step 5: `05 RD Decision` (Lagrangian cost $J_{\text{nosplit}}$ vs $J_{\text{split}}$ with verified provenance, actual CTU bits, interactive RDO simulator)
    - **Streamlined Apple UI**: Single-line stepper chips bar, global Channel switcher (`Y`, `Cb`, `Cr` via `C`), Matrix Values toggle (`V`), and zero clutter.
  - **Feature-First Vertical Stages (`components/stages/`)**: Granular checkpoints (`CP_00` to `CP_07`, `RDO_SIM`) encapsulated as modular feature stages (`cp00_frame_gop` through `cp07_cabac_entropy`, `rdo_simulator`).
  - **Scoped Query & Caching Architecture**: Hierarchical fetching (`fetchJobCheckpoints`, `fetchCtuCheckpoints`, `fetchCuCheckpoints`), `AbortController` cancellation, and in-memory LRU cache.
  - **Modular Apple Design System**: 10 single-responsibility primitives in `components/apple/` with backward-compatible barrel export.
  - **Unified Analysis Inspector**: Collapsible right-hand inspector panel serving as the single source of truth for all spatial, block, coding, and line buffer telemetry.
  - Provides **19 comprehensive test suites** (`npm test`, 100% passed) and zero-warning linting (`oxlint` across 137 files).

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

