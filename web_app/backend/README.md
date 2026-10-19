# HEVC Analysis Tool - Backend API

FastAPI-powered REST API backend that interfaces with the instrumented HM-18.0 reference encoder (`TAppEncoder`), manages transient workspace sessions, and streams structured trace checkpoints for full microarchitectural video coding analysis.

---

## Prerequisites
- **Python**: 3.10+ (Python 3.12 / 3.14 compatible)
- **FFmpeg**: Required for raw YUV420p video frame conversion (BT.709 colorimetry)
- **Compiled HM-18.0 Encoder**: `TAppEncoder` executable in `bin/` (build with `cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j$(nproc)` at root)

---

## Setup & Running

### 1. Create Virtual Environment & Install Dependencies
```bash
cd web_app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
pytest -v
```
All **76 integration and unit tests** should pass (100% success rate, including real encoder execution tests).

### 3. Start Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Endpoints

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Core Endpoints:
- `POST /api/v1/jobs/submit`: Submits an asynchronous encoding job (HTTP 202 Accepted), returning a `job_id`.
- `GET /api/v1/jobs/{job_id}`: Polls execution status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), frame dimensions, and best mode telemetry.
- `POST /upload`: Synchronous upload endpoint fallback; encodes target CTU and returns candidate search results.
- `GET /health`: Health status and HM encoder binary path detection.

### Image Streaming:
- `GET /api/v1/jobs/{job_id}/images/{image_type}`:
  - `original`: Pristine PNG frame.
  - `reconstructed`: Post-encoding reconstructed PNG frame (ITU-R BT.709 color-accurate).
  - `residual?gain={1|2|4|8}`: Amplified residual difference image.
  - `y`, `u`, `v`: Individual YUV planar channel images (BT.709 colorimetry).

### Checkpoints (CP_00 to CP_07 & Provenance):
- `GET /api/v1/checkpoints/{job_id}/CP_00_FRAME_GOP`: Frame GOP structure, POC, slice types (I/P/B), temporal layers, and L0/L1 reference picture lists.
- `GET /api/v1/checkpoints/{job_id}/partitions`: All CTU QuadTree partition trees across the full frame grid.
- `GET /api/v1/checkpoints/{job_id}/CP_01_PARTITION?ctu_x={x}&ctu_y={y}`: Specific CTU recursive QuadTree partition structure and split flags.
- `GET /api/v1/checkpoints/{job_id}/CP_02_INTRA_REF?cu_size={size}&ctu_x={x}&ctu_y={y}`: 4N+1 perimeter reference samples (filtered and unfiltered with MDIS 3-tap $[1, 2, 1]/4$).
- `GET /api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH?cu_size={size}&ctu_x={x}&ctu_y={y}`: 35 intra candidate modes with RDO costs, bit-exact prediction matrices, and residual data.
- `GET /api/v1/checkpoints/{job_id}/intra-pipeline?cu_size={size}&ctu_x={x}&ctu_y={y}`: Composite 5-stage intra search data (Boundary Init, RMD Funnel, Candidates & MPMs, Full RDO 6-Stage Domain Strip, Chroma Winner).
- `GET /api/v1/checkpoints/{job_id}/CP_03_INTER_SEARCH?ctu_x={x}&ctu_y={y}`: Inter prediction motion vectors (MV, MVD), reference frames, and motion search costs.
- `GET /api/v1/checkpoints/{job_id}/CP_04_TRANSFORM_RQT?ctu_x={x}&ctu_y={y}`: 2D DCT-II / 2D DST-VII frequency spectrum matrices, RQT hierarchy, and energy compaction metrics.
- `GET /api/v1/checkpoints/{job_id}/CP_05_RECON_PICTURE?ctu_x={x}&ctu_y={y}`: Reconstructed picture buffer across Y, Cb, and Cr channels pre-in-loop filtering with mathematical sample validation ($S' = \text{Clip}(P + R')$).
- `GET /api/v1/checkpoints/{job_id}/CP_06_INLOOP_FILTER?ctu_x={x}&ctu_y={y}`: Deblocking Filter (DBF) edge profiles ($bS \in \{0, 1, 2\}$) and SAO decision offsets (Edge and Band offsets).
- `GET /api/v1/checkpoints/{job_id}/CP_07_CABAC_ENTROPY?limit={n}`: Bitstream syntax element bins, context index (`ctxIdx`), FSM probability state transitions (`pStateIdx: 0..62`), and MPS/LPS intervals.
- `GET /api/v1/checkpoints/{job_id}/cu_rdo_decision?ctu_x={x}&ctu_y={y}`: Verified CU RDO decision provenance (`cost_nosplit`, `cost_split`, `split_decision`, QP, lambda) and CTU actual bit count.

