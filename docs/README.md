# Tài liệu kỹ thuật — HEVC & HM-18.0 Web Analyzer

Tài liệu về thuật toán HEVC, cách hiện thực trong HM-18.0 và kiến trúc phần mềm:

| Tài liệu | Loại | Nội dung |
| :--- | :--- | :--- |
| [`HM_NAMING_CONVENTIONS.md`](./HM_NAMING_CONVENTIONS.md) | Tra cứu | Ký pháp Hungary, từ điển biến số và các hàm lõi trong HM |
| [`HEVC_BLOCK_BASED_HYBRID_FLOW.md`](./HEVC_BLOCK_BASED_HYBRID_FLOW.md) | Giải thích | Mô hình mã hóa lai theo khối: CTU → CU → PU → TU và vòng lặp phản hồi |
| [`HM_ENCODER_ARCHITECTURE.md`](./HM_ENCODER_ARCHITECTURE.md) | Giải thích | Phân cấp class encoder, cơ chế RDO và cây gọi hàm chi tiết |
| [`HEVC_WEBAPP_UX_UI_RULES.md`](./HEVC_WEBAPP_UX_UI_RULES.md) | Tra cứu | Design tokens, thông số hình học component và bảng màu ngữ nghĩa codec |

---

## 🧭 Lộ trình đọc

* **Tra cứu ký hiệu và biến số HM:** [`HM_NAMING_CONVENTIONS.md`](./HM_NAMING_CONVENTIONS.md)
* **Nghiên cứu thuật toán nén HEVC:** [`HEVC_BLOCK_BASED_HYBRID_FLOW.md`](./HEVC_BLOCK_BASED_HYBRID_FLOW.md) → [`HM_ENCODER_ARCHITECTURE.md`](./HM_ENCODER_ARCHITECTURE.md)
* **Quy chuẩn thiết kế giao diện:** [`HEVC_WEBAPP_UX_UI_RULES.md`](./HEVC_WEBAPP_UX_UI_RULES.md)
