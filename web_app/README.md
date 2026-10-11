# HEVC Analysis Tool - Web Application

This directory contains the fullstack web application that interfaces with the instrumented HM-16.0 reference encoder.

## Structure

- **`backend/`**: FastAPI (Python 3.12) REST API server.
  - Manages asynchronous encoding jobs (HTTP 202 + polling) and isolated workspace sessions.
  - Converts user image uploads to raw YUV420p via FFmpeg with BT.709 colorimetry.
  - Dispatches `TAppEncoder` with target ROI configuration.
  - Parses JSONL trace streams into strongly-typed Pydantic domain models:
    - Partition trees (`CP_01_PARTITION`, `partitions`)
    - Intra reference samples & MDIS filtering (`CP_02_INTRA_REF`)
    - 35 Intra candidate searches & angular evaluations (`CP_03_INTRA_SEARCH`)
    - 2D Transform & RDOQ Quantization matrices (`CP_06_TRANSFORM`, `CP_07_QUANT`)
  - Provides **29 integration and unit tests** (`pytest`).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Apple macOS Tahoe design language with zero rounded corners on video frames, CTUs, and matrix cells (pixel-accurate).
  - **Stage 1 (CTU Grid)**: High-performance SVG multi-layer renderer for 64×64 CTU boundaries and picture boundary forced split handling.
  - **Stage 2 (YCbCr Planes)**: Planar decomposition (Y, U, V channels with Composite RGB, Tint, Grayscale, and Turbo Heatmap).
  - **Stage 3 (CU QuadTree)**: Recursive QuadTree treeview in Z-scan order (Depth 0–3).
  - **Stage 4 (RDO Simulator)**: In-browser HM `xCompressCU` simulation with live QP & $\lambda$ sliders, call stack breadcrumbs, and Draw.io export.
  - **Stage 5 (Intra Prediction)**: 35 modes, 360° Angular Compass, 4N+1 perimeter reference samples, and 3 MPM candidates.
  - **Stage 6 (Transform & Quant)**: 2D DCT-II and 2D DST-VII frequency spectrum inspection.
  - **Stage 7 (Reconstruction)**: Overview Split Wipe slider and Synchronized 4-Way crosshair pixel inspection.
  - **Unified Analysis Inspector**: Collapsible right-hand inspector panel serving as the single source of truth for all spatial, block, coding, and line buffer telemetry.
  - Provides **187 automated unit tests** (`npm test`) and linting (`oxlint`).

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
