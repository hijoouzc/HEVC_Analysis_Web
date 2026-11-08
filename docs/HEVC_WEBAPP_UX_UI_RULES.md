# Quy Chuẩn Thiết Kế Giao Diện Web App UX/UI (Apple HIG & Design Tokens)

> * **Nguồn triển khai thực tế (Single Source of Truth):** [`web_app/frontend/src/index.css`](../web_app/frontend/src/index.css) và [`web_app/frontend/src/components/apple/`](../web_app/frontend/src/components/apple/index.jsx).
> * **Quy tắc bắt buộc cho agent:** [`.agents/rules/ui-apple-tahoe-standard.md`](../.agents/rules/ui-apple-tahoe-standard.md).
> * **Liên quan:** [README](./README.md) · [Kiến trúc encoder HM](./HM_ENCODER_ARCHITECTURE.md)

---

## 1. Bảng Màu Hệ Thống & Ngữ Nghĩa HEVC (`applecn` macOS 26 Tahoe)

| Vai trò ngữ nghĩa HEVC | Apple System Token | RGB | HEX | Light Tint |
| :--- | :--- | :--- | :---: | :---: |
| **Depth 0 ($64\times 64$ CTU Root)** | `system-cyan` | `rgb(0, 192, 232)` | `#00C0E8` | `#E0F8FF` |
| **Depth 1 ($32\times 32$) / Winner Mode** | `system-green` | `rgb(52, 199, 89)` | `#34C759` | `#E8F8EE` |
| **Depth 2 ($16\times 16$) / Active Playing** | `system-orange` | `rgb(255, 141, 40)` | `#FF8D28` | `#FFF3E8` |
| **Depth 3 ($8\times 8$) / Error / Danger** | `system-red` | `rgb(255, 56, 60)` | `#FF383C` | `#FEECEB` |
| **Intra Prediction (Modes 0..34)** | `system-purple` | `rgb(203, 48, 224)` | `#CB30E0` | `#F9EAFB` |
| **Primary CTA / Inter Uni-Pred (L0)** | `system-blue` | `rgb(0, 122, 255)` | `#007AFF` | `#E5F2FF` |
| **Inter Bi-Pred (L0 + L1)** | `system-mint` | `rgb(0, 200, 179)` | `#00C8B3` | `#E6F9F7` |
| **IPCM Lossless / Warning** | `system-yellow` | `rgb(255, 204, 0)` | `#FFCC00` | `#FFF9DB` |
| **Skip / Merge Mode / Disabled** | `system-gray` | `rgb(142, 142, 147)` | `#8E8E93` | `#F2F2F7` |

---

## 2. Surface, Label & Elevation Tokens

| Token | Giá trị CSS (Light Mode) | Vai trò hiển thị |
| :--- | :--- | :--- |
| `--label` / `--label-2` / `--label-3` | `rgb(0 0 0 / 0.85)` / `0.50` / `0.26` | Văn bản chính / Nhãn phụ & đơn vị / Giá trị 0 trong ma trận |
| `--fill` / `--fill-2` / `--fill-3` | `rgb(120 120 128 / 0.20)` / `0.16` / `0.12` | Rãnh slider / Nền control khi hover / Rãnh segmented control |
| `--separator` / `--separator-opaque` | `rgb(0 0 0 / 0.10)` / `rgb(230 230 230)` | Đường kẻ chia mảnh `0.5px` / Đường phân cách tương phản cao |
| `--background-1` / `--background-2` | `#FFFFFF` / `#F2F2F7` | Bề mặt thẻ Card / Nền gom nhóm & vùng đệm |
| `--corner-sm`..`--corner-2xl` | `4px`, `5px`, `6px`, `8px`, `10px` | Thang bo góc chuẩn AppKit (tuyệt đối `0px` cho canvas ảnh/pixel) |
| `--ease-standard` | `cubic-bezier(0.04, 0.04, 0.12, 0.96)` | Đường cong chuyển động chuẩn (`100ms` press, `210ms` hover) |

---

## 3. Quy Cách Hình Học Core Components (`src/components/apple/`)

| Component | Kích thước & Hình học chuẩn |
| :--- | :--- |
| **`Button`** | 5 cỡ chiều cao: `mini` (`16px`, r=`4px`), `small` (`20px`, r=`5px`), `regular` (`24px`, r=`6px`), `large` (`28px`, capsule), `xl` (`36px`, capsule). Variants: `filled`, `tinted`, `gray`, `bordered`, `plain`, `destructive`. |
| **`SegmentedControl`** | Cao `24px` (`small`), `28px` (`regular`), `32px` (`large`); rãnh `--fill-3` bo `6px`, inset `2px`; pill đang chọn nền `#FFFFFF` đổ bóng `--shadow-segment`. |
| **`Slider`** | Rãnh cao `4px` bo tròn capsule; núm kéo tròn `18px` nền trắng có viền mảnh `0.5px`. |
| **`Input` / `Select`** | Cao `26px`–`28px`, bo góc `6px`, viền `0.5px solid var(--separator)`, font `ui-monospace` (`tabular-nums`) cho thông số số học. |
| **`Card`** | Bo góc `10px` (`--card-radius`), viền `0.5px solid var(--separator)`, padding `16px`, shadow `0 3px 9px rgb(0 0 0 / 0.08)`. |

```jsx
import {
  Button, SegmentedControl, Slider, Select,
  Checkbox, Card, Badge, Input, Toggle, Tabs, Tooltip, Modal
} from './components/apple';
```
