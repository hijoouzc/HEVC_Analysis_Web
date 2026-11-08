# HEVC Trace-Driven Analysis & Visualization Tool (HM-18.0)

Nền tảng nghiên cứu/giảng dạy chạy bộ mã hóa tham chiếu **HM-18.0** đã gắn hook (`VisualDumper`), thu trace JSONL tại các điểm quyết định (CTU → CU → PU → TU) và trực quan hóa trên trình duyệt.

## Kiến trúc

```text
┌───────────────────────────────┐
│ React 19 + Vite (frontend)    │  5-step Guided Flow: Partition → Prediction →
└──────────────▲────────────────┘  Residual & TU → Reconstruction → RD Decision
               │ REST / JSON
┌──────────────▼────────────────┐
│ FastAPI (backend)             │  Job manager, FFmpeg YUV adapter,
└──────────────▲────────────────┘  trace parser (CP_00 … CP_07)
               │ subprocess + trace.jsonl
┌──────────────▼────────────────┐
│ HM-18.0 TAppEncoder (C++)     │  VisualDumper hooks trong TLibCommon / TLibEncoder
└───────────────────────────────┘
```

Chi tiết: [`docs/08_HM_ENCODER_ARCHITECTURE.md`](docs/08_HM_ENCODER_ARCHITECTURE.md).

## Khởi động nhanh

```bash
./run_tool.sh
```

Script tự cài dependency, build encoder nếu chưa có và chạy cả hai dịch vụ:

- Web: `http://localhost:5173`
- API docs (Swagger): `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## Cài đặt thủ công

**Yêu cầu:** Linux hoặc macOS, GCC/G++ hỗ trợ C++17, CMake ≥ 3.16, Python ≥ 3.10, Node.js ≥ 18, FFmpeg trong `PATH`.

```bash
# 1. Build HM-18.0 có hook (ENABLE_VISUAL_DUMP=ON mặc định)
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

2. Backend: xem [`web_app/backend/README.md`](web_app/backend/README.md).
3. Frontend: xem [`web_app/frontend/README.md`](web_app/frontend/README.md).

## Cấu trúc thư mục

```text
HEVC_reference_software/
├── source/                 # Mã nguồn HM-18.0
│   └── Lib/TLibCommon/VisualDumper.{h,cpp}   # Bộ ghi trace
├── cfg/                    # Cấu hình encoder HM
├── bin/                    # Binary sau khi build
├── doc/                    # Tài liệu gốc của HM (upstream)
├── docs/                   # Tài liệu kỹ thuật của dự án (xem docs/README.md)
├── web_app/
│   ├── backend/            # FastAPI
│   └── frontend/           # React 19 + Vite
├── workspace/              # Session encode tạm thời (tự sinh)
├── .agents/                # Rules & skills cho AI agent (xem AGENTS.md)
└── run_tool.sh             # Launcher
```

## Tài liệu

| Chủ đề | Vị trí |
| :--- | :--- |
| Thuật toán HEVC, kiến trúc HM, kiến trúc hệ thống | [`docs/README.md`](docs/README.md) |
| Tính năng giao diện, phím tắt, design system | [`web_app/frontend/README.md`](web_app/frontend/README.md) |
| API và checkpoint endpoint | [`web_app/backend/README.md`](web_app/backend/README.md) |
| Quy tắc phát triển cho agent | [`AGENTS.md`](AGENTS.md) |

## License

BSD 3-Clause — xem [`COPYING`](COPYING).
