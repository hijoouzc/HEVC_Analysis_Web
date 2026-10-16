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
  - Provides **48 integration and unit tests** (`pytest`, 100% passed).

- **`frontend/`**: React 19 + Vite modern web interface.
  - Apple macOS Tahoe design language with zero rounded corners on video frames, CTUs, and matrix cells (pixel-accurate).
  - Built with **Persistent DOM Shells** across all viewports to completely eliminate layout shifts (zero CLS).
  - **Dual-Mode Orchestration**:
    - **5-Step Guided Journey** (Sequential HM `xCompressCU` lifecycle):
      - Step 1: `Frame & CU Partition` (Transport bar for sequential CTU playback, Split CU inspection)
      - Step 2: `Intra Prediction` (35 modes, 4N+1 perimeter, MDIS 3-tap filtering, RMD SATD funnel, 3 MPMs)
      - Step 3: `Transform & Quantization` (RQT QuadTree, 2D core DCT/DST, quantization sparsity, QP/$Q_{\text{step}}$)
      - Step 4: `Reconstruction` (Picture buffer pre/post-filter, mathematical verification $S' = \text{Clip3}(0, 255, P + R')$)
      - Step 5: `RDO Decision` (Lagrangian cost $J_{\text{nosplit}}$ vs $J_{\text{split}}$, actual CTU bits, RDO simulator)
    - **9-Tab Expert Checkpoints**:
      - `0. Frame & GOP` (`CP_00`), `1. CU QuadTree` (`CP_01`), `2. Intra Search` (`CP_02`), `3. Inter Search` (`CP_03`), `4. Transform & Quant` (`CP_04`), `5. Recon Picture` (`CP_05`), `6. In-Loop Filter` (`CP_06`), `7. CABAC Entropy` (`CP_07`), `8. RDO Simulator` (`RDO_SIM`).
  - **Unified Analysis Inspector**: Collapsible right-hand inspector panel serving as the single source of truth for all spatial, block, coding, and line buffer telemetry.
  - Provides **18 comprehensive test suites** (`npm test`, 100% passed) and zero-warning linting (`oxlint`).

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

