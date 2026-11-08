# Tài liệu kỹ thuật — HEVC & HM-18.0 Web Analyzer

Tài liệu về thuật toán HEVC, cách hiện thực trong HM-18.0 và kiến trúc phần mềm:

| # | Tài liệu | Loại | Nội dung |
| :---: | :--- | :--- | :--- |
| **01** | [`01_HM_NAMING_CONVENTIONS.md`](./01_HM_NAMING_CONVENTIONS.md) | Tra cứu | Ký pháp Hungary, từ điển biến số và các hàm lõi trong HM |
| **02** | [`02_HEVC_BLOCK_BASED_HYBRID_FLOW.md`](./02_HEVC_BLOCK_BASED_HYBRID_FLOW.md) | Giải thích | Mô hình mã hóa lai theo khối: CTU → CU → PU → TU và vòng lặp phản hồi |
| **05** | [`05_HEVC_WEBAPP_UX_UI_RULES.md`](./05_HEVC_WEBAPP_UX_UI_RULES.md) | Tra cứu | Design tokens, thông số hình học component và bảng màu ngữ nghĩa codec |
| **08** | [`08_HM_ENCODER_ARCHITECTURE.md`](./08_HM_ENCODER_ARCHITECTURE.md) | Giải thích | Phân cấp class encoder, cơ chế RDO và cây gọi hàm chi tiết |

---

## 🧭 Lộ trình đọc

* **Tra cứu ký hiệu và biến số HM:** [`01_HM_NAMING_CONVENTIONS.md`](./01_HM_NAMING_CONVENTIONS.md)
* **Nghiên cứu thuật toán nén HEVC:** [`02_HEVC_BLOCK_BASED_HYBRID_FLOW.md`](./02_HEVC_BLOCK_BASED_HYBRID_FLOW.md) → [`08_HM_ENCODER_ARCHITECTURE.md`](./08_HM_ENCODER_ARCHITECTURE.md)
* **Quy chuẩn thiết kế giao diện:** [`05_HEVC_WEBAPP_UX_UI_RULES.md`](./05_HEVC_WEBAPP_UX_UI_RULES.md)
