# 📚 Tài Liệu Kỹ Thuật Toàn Diện Về Chuẩn Nén HEVC & Bộ Mã Hóa HM

> [!NOTE]
> Thư mục này chứa toàn bộ tài liệu kiến trúc, toán học nén video, quy chuẩn mã nguồn và hướng dẫn phát triển hệ thống công cụ phân tích **HEVC Video Analyzer** dựa trên phần mềm tham chiếu **HM-18.0 (HEVC Test Model)**.

---

## 📑 Danh Mục Hồ Sơ Kỹ Thuật (Documentation Roadmap)

Tất cả các tài liệu được đồng bộ hóa theo quy chuẩn chuẩn mực quốc tế (ITU-T H.265 / ISO/IEC 23008-2) và liên kết trực tiếp tới các dòng mã nguồn trong `HEVC_reference_software`:

| STT | Tên tài liệu | Chủ đề & Phạm vi | Trạng thái đồng bộ |
| :---: | :--- | :--- | :---: |
| **01** | [`01_HM_NAMING_CONVENTIONS.md`](./01_HM_NAMING_CONVENTIONS.md) | Quy ước định danh, ký pháp Hungary, từ điển biến số & hàm lõi trong HM | ✅ Đã đồng bộ chuẩn xác |
| **02** | [`02_HEVC_BLOCK_BASED_HYBRID_FLOW.md`](./02_HEVC_BLOCK_BASED_HYBRID_FLOW.md) | Kiến trúc mã hóa lai khối: CTU $\to$ CU $\to$ PU $\to$ TU và các vòng lặp phản hồi | ✅ Đã đồng bộ chuẩn xác |
| **03** | [`03_HEVC_INTRA_PREDICTION_DEEP_DIVE.md`](./03_HEVC_INTRA_PREDICTION_DEEP_DIVE.md) | Giải thuật chuyên sâu Intra Prediction: 4N+1 ref samples, MDIS filter, 35 modes & 3 MPM | ✅ Đã đồng bộ chuẩn xác |
| **04** | [`04_HEVC_DATA_FLOW_ANALYSIS_TOOL.md`](./04_HEVC_DATA_FLOW_ANALYSIS_TOOL.md) | Kiến trúc công cụ phân tích luồng dữ liệu & giải pháp cắm hook C++ (`VisualDumper`) | ✅ Đã đồng bộ chuẩn xác |
| **05** | [`05_HEVC_WEBAPP_UX_UI_RULES.md`](./05_HEVC_WEBAPP_UX_UI_RULES.md) | Quy chuẩn thiết kế giao diện: hiển thị Pixel-Accurate, BT.709 Luma, bố cục Dual-Mode (5 bước Guided Flow & 9 tab Expert Checkpoints) | ✅ Đã đồng bộ chuẩn xác |
| **06** | [`06_HM_STYLE_GUIDE_FOR_WEB_APP.md`](./06_HM_STYLE_GUIDE_FOR_WEB_APP.md) | Cẩm nang kiến trúc và phong cách tích hợp thuật toán HM vào ứng dụng Web | ✅ Đã đồng bộ chuẩn xác |
| **07** | [`07_WEB_APP_FULL_SYSTEM_ARCHITECTURE.md`](./07_WEB_APP_FULL_SYSTEM_ARCHITECTURE.md) | Kiến trúc toàn diện Web App: FastAPI Backend, Checkpoint Pipeline & React 19 Frontend | ✅ Đã đồng bộ chuẩn xác |
| **08** | [`HM_encoder_architecture.md`](../HM_encoder_architecture.md) | Kiến trúc phân cấp encoder HEVC chuẩn, phân tích RDO & luồng xử lý gọi hàm chi tiết | ✅ Đã đồng bộ chuẩn xác |

---

## 🧭 Hướng Dẫn Sử Dụng
* **Tra cứu ký hiệu và biến số HM:** Bắt đầu từ file `01_HM_NAMING_CONVENTIONS.md`.
* **Nghiên cứu thuật toán nén:** Đọc tuần tự `02_HEVC_BLOCK_BASED_HYBRID_FLOW.md` $\to$ `03_HEVC_INTRA_PREDICTION_DEEP_DIVE.md`.
* **Phát triển và mở rộng Web App:** Tham khảo `04` $\to$ `05` $\to$ `06` $\to$ `07`.

