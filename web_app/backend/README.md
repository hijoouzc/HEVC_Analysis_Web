# HEVC Analysis Tool - Backend API

FastAPI-powered REST API backend that interfaces with the instrumented HM-16.0 reference encoder (`TAppEncoder`), manages transient workspace sessions, and streams structured trace checkpoints for intra prediction analysis.

---

## Prerequisites
- **Python**: 3.10+ (Python 3.12 recommended)
- **FFmpeg**: Required for raw YUV420p video frame conversion
- **Compiled HM Encoder**: `TAppEncoder` executable in `bin/` (build with `make TAppEncoder-r -j$(nproc)` at root)

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
All **29 integration and unit tests** should pass.

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
  - `reconstructed`: Post-encoding reconstructed PNG frame.
  - `residual?gain={1|2|4|8}`: Amplified residual difference image.
  - `y`, `u`, `v`: Individual YUV planar channel images (BT.709 colorimetry).

### Checkpoints:
- `GET /api/v1/checkpoints/{job_id}/partitions`: All CTU QuadTree partition trees across the frame grid.
- `GET /api/v1/checkpoints/{job_id}/CP_01_PARTITION?ctu_x={x}&ctu_y={y}`: Specific CTU recursive QuadTree partition structure.
- `GET /api/v1/checkpoints/{job_id}/CP_02_INTRA_REF?cu_size={size}&ctu_x={x}&ctu_y={y}`: 4N+1 perimeter reference samples (filtered and unfiltered).
- `GET /api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH?cu_size={size}&ctu_x={x}&ctu_y={y}`: 35 intra candidate modes with RDO costs, prediction matrices, and residual data.
- `GET /api/v1/checkpoints/{job_id}/CP_06_TRANSFORM?ctu_x={x}&ctu_y={y}`: 2D DCT-II / 2D DST-VII frequency spectrum matrices.
- `GET /api/v1/checkpoints/{job_id}/CP_07_QUANT?ctu_x={x}&ctu_y={y}`: Quantized transform coefficients, QP shift levels, and sparsity ratios.
