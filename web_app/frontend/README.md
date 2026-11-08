# HEVC Video Analyzer — Frontend (`React 19` + `Vite`)

Giao diện phân tích vi kiến trúc bộ mã hóa **ITU-T H.265 / HM-18.0**, tuân thủ hệ thiết kế **Apple macOS Tahoe (`applecn`)** và hiển thị ma trận điểm ảnh rời rạc chính xác theo chuẩn ITU-R BT.709.

> * **Quy chuẩn giao diện & Design Tokens:** [`../../docs/HEVC_WEBAPP_UX_UI_RULES.md`](../../docs/HEVC_WEBAPP_UX_UI_RULES.md) & [`../../.agents/rules/ui-apple-tahoe-standard.md`](../../.agents/rules/ui-apple-tahoe-standard.md)
> * **Đồng bộ tọa độ & 5 bước Guided Flow:** [`../../.agents/skills/hevc-guided-flow-sync/SKILL.md`](../../.agents/skills/hevc-guided-flow-sync/SKILL.md)

---

## 1. Cấu trúc Thư mục Stages (`src/components/stages/`)

```text
src/components/stages/
├── cp00_frame_gop/          # GopReferenceVisualizer (Cấu trúc GOP, POC & danh sách tham chiếu L0/L1)
├── cp01_partition/          # Step1FrameTree, QuadTreeVisualizer, CtuSpatialMiniMap
├── cp02_intra_search/       # IntraPredictionFlow, IntraStudioVisualizer, ReferencePixelStrip
├── cp03_inter_search/       # InterPredictionVisualizer (Vector chuyển động MV/MVD & AMVP)
├── cp04_transform_quant/    # TransformQuantVisualizer, TuTreeCallStack, FrequencyHeatmap
├── cp05_recon_picture/      # ReconPictureVisualizer, FourPictureComparison, PixelMatrixCanvas
├── cp06_inloop_filter/      # InLoopFilterVisualizer (Biên lọc Deblocking bS & bù mẫu SAO)
├── cp07_cabac_entropy/      # CabacEntropyVisualizer, BacIntervalStudio, BinarizationTreeViewer
└── rdo_simulator/           # RdoQuadtreeSimulator, TComDataCUMemoryPanel, PartitionCanvas
```

---

## 2. Cơ chế Truy vấn & Bộ đệm theo Phạm vi (`useAnalysisSession`)

1. **Job Scope (`fetchJobCheckpoints`):** Tải 1 lần cho mỗi phiên mã hóa (`CP_00_FRAME_GOP`, `partitions`).
2. **CTU Scope (`fetchCtuCheckpoints`):** Tải khi đổi CTU mục tiêu (`CP_01_PARTITION`, `CP_04_TRANSFORM_RQT`, `CP_05_RECON_PICTURE`, `CP_06_INLOOP_FILTER`, `CP_07_CABAC_ENTROPY`, `rdo-decisions`).
3. **CU Scope (`fetchCuCheckpoints`):** Tải khi chọn một khối CU cụ thể (`CP_02_INTRA_REF`, `CP_03_INTRA_SEARCH`, `CP_03_INTER_SEARCH`), tích hợp `AbortController` hủy request cũ và bộ đệm LRU trong RAM.

---

## 3. Lệnh Phát triển & Kiểm thử

```bash
npm install          # Cài đặt dependencies
npm run dev          # Chạy Vite dev server tại http://localhost:5173 (proxy API sang :8000)
npx oxlint           # Kiểm tra lint (yêu cầu 0 warnings, 0 errors)
npm test             # Chạy toàn bộ các bộ kiểm thử tự động trong tests/suites/
npm run build        # Build bản phân phối vào dist/
```
