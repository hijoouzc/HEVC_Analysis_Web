# 05. Quy Chuẩn Thiết Kế Giao Diện Web App UX/UI (Apple HIG & Design Tokens)

> [!NOTE]
> Design token và thông số component cho giao diện **HEVC Video Analyzer**, dựa trên hệ thiết kế [STiXzoOR/applecn](https://github.com/STiXzoOR/applecn) (Apple HIG, macOS 26 Tahoe).
>
> * **Nguồn triển khai thực tế:** [`web_app/frontend/src/index.css`](../web_app/frontend/src/index.css) và [`components/apple/`](../web_app/frontend/src/components/apple/). Khi tài liệu và code khác nhau, **code là chuẩn**.
> * **Quy tắc bắt buộc cho agent:** [`.agents/rules/ui-apple-tahoe-standard.md`](../.agents/rules/ui-apple-tahoe-standard.md).
> * **Liên quan:** [README](./README.md) · [08. Kiến trúc encoder HM](./08_HM_ENCODER_ARCHITECTURE.md)

---

## 2. Official Apple Design Tokens (Measured from `applecn`)

Giá trị lấy từ `docs/research/apple-design-system-reference.md` và `packages/ui/src/styles/tokens.css` của repo [applecn](https://github.com/STiXzoOR/applecn).

### 2.1. System Colors (Light Mode)

| Role | Apple System Color | RGB Value | HEX | Application in HEVC Analyzer |
| :--- | :--- | :--- | :---: | :--- |
| **System Blue** | `system-blue` | `rgb(0, 122, 255)` / `rgb(0, 136, 255)` | `#007AFF` | Primary CTA, Inter Uni-Pred (L0), QP Accent |
| **System Green** | `system-green` | `rgb(52, 199, 89)` | `#34C759` | Depth 1 ($32\times 32$), Winner Mode, Best Cost |
| **System Orange** | `system-orange` | `rgb(255, 141, 40)` | `#FF8D28` | Depth 2 ($16\times 16$), Active Playing indicator |
| **System Red** | `system-red` | `rgb(255, 56, 60)` | `#FF383C` | Depth 3 ($8\times 8$), Destructive, Error states |
| **System Purple** | `system-purple` | `rgb(203, 48, 224)` | `#CB30E0` | Intra Spatial Prediction (0..34) |
| **System Cyan** | `system-cyan` | `rgb(0, 192, 232)` | `#00C0E8` | Depth 0 ($64\times 64$ CTU Root) |
| **System Mint** | `system-mint` | `rgb(0, 200, 179)` | `#00C8B3` | Inter Bi-Pred (L0 + L1) |
| **System Yellow** | `system-yellow` | `rgb(255, 204, 0)` | `#FFCC00` | IPCM Lossless Blocks, Desync Warning |
| **System Gray** | `system-gray` | `rgb(142, 142, 147)` | `#8E8E93` | Skip / Merge Mode, Disabled states |

### 2.2. System Grays & Semantic Labels (Light Mode)

| Token | CSS Value | Visual Role |
| :--- | :--- | :--- |
| `--label` | `rgb(0 0 0 / 0.85)` | Primary text, titles, prominent numbers |
| `--label-2` | `rgb(0 0 0 / 0.50)` | Secondary labels, units, column headers |
| `--label-3` | `rgb(0 0 0 / 0.26)` | Tertiary text, zero values in residual matrices |
| `--label-4` | `rgb(0 0 0 / 0.10)` | Quaternary text, faint watermarks |
| `--placeholder` | `rgb(0 0 0 / 0.50)` | Input field placeholder text |
| `--fill` | `rgb(120 120 128 / 0.20)` | Slider track, progress bars |
| `--fill-2` | `rgb(120 120 128 / 0.16)` | Hovered control backgrounds |
| `--fill-3` | `rgb(118 118 128 / 0.12)` | Segmented control track, subtle inset panels |
| `--fill-4` | `rgb(116 116 128 / 0.08)` | Table row striping, subtle accents |
| `--separator` | `rgb(0 0 0 / 0.10)` | Hairline dividers, card outlines |
| `--separator-opaque` | `rgb(230 230 230)` | High-contrast opaque divider lines |
| `--background-1` | `rgb(255 255 255)` | Pure white window & card surfaces |
| `--background-2` | `rgb(242 242 247)` | Canvas backdrop, grouped background |
| `--background-3` | `rgb(255 255 255)` | Inset controls, text fields |

### 2.3. Elevation Shadows & Radii Ladder

```css
/* Source: applecn packages/ui/src/styles/tokens.css */
:root {
  /* Radii Ladder (macOS AppKit Tahoe) */
  --corner-sm: 4px;
  --corner-md: 5px;
  --corner-lg: 6px;       /* Control standard (buttons, segmented, inputs) */
  --corner-xl: 8px;       /* Groups, steppers */
  --corner-2xl: 10px;     /* Cards, dialogs, popovers */
  --corner-3xl: 12px;     /* Floating sheets */
  --corner-4xl: 16px;     /* Large sheets */
  --card-radius: 10px;

  /* Elevation Shadows (Official Apple Curves) */
  --shadow-thumb: 0 3px 8px rgb(0 0 0 / 0.15), 0 3px 1px rgb(0 0 0 / 0.06);
  --shadow-segment: 0 3px 8px rgb(0 0 0 / 0.12), 0 3px 1px rgb(0 0 0 / 0.04);
  --shadow-control: inset 0 0 0.5px 0 rgb(0 0 0 / 0.15), 1px 1px 1px 0 rgb(0 0 0 / 0.1);
  --shadow-card-small: 0 3px 9px rgb(0 0 0 / 0.08);
  --shadow-card-medium: 0 3px 20px rgb(0 0 0 / 0.08);
  --shadow-dialog: inset 0 0 0 1px rgb(255 255 255 / 0.2), 0 8px 40px rgb(0 0 0 / 0.25);
  --focus-ring: 0 0 0 4px rgba(0, 122, 255, 0.60);

  /* Motion Standards */
  --ease-standard: cubic-bezier(0.04, 0.04, 0.12, 0.96);
  --duration-press: 100ms;
  --duration-hover: 210ms;
  --duration-overlay: 300ms;
}
```

---

## 3. Core Component Specifications (Deconstructed from `applecn`)

### 3.1. Apple Push Buttons (`packages/ui/src/components/button.tsx`)

Every Apple button belongs to one of the 5 measured sizes and styles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      APPLE BUTTON GEOMETRY                             │
├─────────┬────────┬────────┬───────────┬───────────┬────────────────────┤
│ Size    │ Height │ Radius │ Padding X │ Font Size │ Usage Context      │
├─────────┼────────┼────────┼───────────┼───────────┼────────────────────┤
│ Mini    │ 16px   │ 4px    │ 9px       │ 9pt (12px)│ Dense micro-actions│
│ Small   │ 20px   │ 5px    │ 11px      │ 11pt(14px)│ Table cell buttons │
│ Regular │ 24px   │ 6px    │ 12px      │ 13pt(16px)│ Standard controls  │
│ Large   │ 28px   │ Capsule│ 14px      │ 13pt(16px)│ Primary toolbar CTA│
│ XL      │ 36px   │ Capsule│ 18px      │ 13pt(16px)│ Welcome screen CTA │
└─────────┴────────┴────────┴───────────┴───────────┴────────────────────┘
```

#### Exact CSS Implementation:
```css
/* Base Button */
.apple-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid transparent;
  outline: none;
  user-select: none;
  cursor: pointer;
  transition: background-color 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96),
              transform 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96),
              opacity 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96);
}

.apple-btn:focus-visible {
  box-shadow: var(--focus-ring);
}

.apple-btn:active:not(:disabled) {
  transform: scale(0.97);
  opacity: 0.85;
}

.apple-btn:disabled {
  opacity: 0.40;
  pointer-events: none;
  cursor: not-allowed;
}

/* Height Sizes */
.apple-btn-mini    { height: 16px; border-radius: 4px; padding: 0 9px;  font-size: 11px; }
.apple-btn-small   { height: 20px; border-radius: 5px; padding: 0 11px; font-size: 12px; }
.apple-btn-regular { height: 24px; border-radius: 6px; padding: 0 12px; font-size: 13px; }
.apple-btn-large   { height: 28px; border-radius: 9999px; padding: 0 14px; font-size: 13px; }
.apple-btn-xl      { height: 36px; border-radius: 9999px; padding: 0 18px; font-size: 14px; }

/* Variants */
.apple-btn-filled {
  background-color: var(--system-blue);
  color: #FFFFFF;
  box-shadow: var(--shadow-control);
}
.apple-btn-filled:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--system-blue), black 8%);
}

.apple-btn-tinted {
  background-color: rgba(0, 122, 255, 0.15);
  color: var(--system-blue);
}
.apple-btn-tinted:hover:not(:disabled) {
  background-color: rgba(0, 122, 255, 0.22);
}

.apple-btn-gray {
  background-color: var(--fill-3);
  color: var(--label);
}
.apple-btn-gray:hover:not(:disabled) {
  background-color: var(--fill-2);
}

.apple-btn-bordered {
  background-color: var(--background-1);
  color: var(--label);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-control);
}
.apple-btn-bordered:hover:not(:disabled) {
  background-color: var(--fill-4);
}

.apple-btn-destructive {
  background-color: rgba(255, 56, 60, 0.15);
  color: var(--system-red);
}
.apple-btn-destructive:hover:not(:disabled) {
  background-color: rgba(255, 56, 60, 0.22);
}
```

---

### 3.2. Apple Segmented Control (`packages/ui/src/components/segmented-control.tsx`)

A single-choice tab switcher with an animated or sliding pill.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     APPLE SEGMENTED CONTROL                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  [  1. CTU Grid  ]   2. YCbCr Planes   3. CU QuadTree   4. RDO   │  │
│  │   (active pill)                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Dimensions & Structure:
* **Height:** `24px` (macOS AppKit) or `32px` (Web/TV).
* **Track Inset:** `2px`.
* **Track Radius:** `6px` (`--segmented-radius`).
* **Track Background:** `var(--fill-3)` (`rgba(118, 118, 128, 0.12)`).
* **Active Indicator:**
  * Background: Pure white `#FFFFFF`.
  * Radius: `calc(var(--segmented-radius) - var(--segmented-inset))` = `4px`.
  * Shadow: `var(--shadow-segment)` = `0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)`.
  * Font weight: `600`.
* **Item Label:**
  * Font: `13px`, `font-weight: 500`.
  * Text color: `var(--label)` (`rgba(0,0,0,0.85)`).

#### Exact CSS Implementation:
```css
.apple-segmented-track {
  position: relative;
  display: inline-flex;
  height: 28px;
  width: auto;
  align-items: stretch;
  border-radius: 6px;
  background-color: var(--fill-3);
  padding: 2px;
  gap: 2px;
  user-select: none;
}

.apple-segmented-item {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: var(--label);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  transition: color 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96),
              background-color 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96);
}

.apple-segmented-item:hover:not(.active) {
  color: #000000;
  background-color: rgba(255, 255, 255, 0.35);
}

.apple-segmented-item.active {
  background-color: #FFFFFF;
  color: #000000;
  font-weight: 600;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04);
}

.apple-segmented-item:focus-visible {
  box-shadow: var(--focus-ring);
}
```

---

### 3.3. Apple Precision Slider (`packages/ui/src/components/slider.tsx`)

Used for QP ($10 \dots 51$), Speed ($150 \dots 1500\text{ms}$), Split-Wipe ($0 \dots 100\%$), and Residual Gain ($1 \dots 16\times$).

#### Dimensions & Tokens:
* **Track Height:** `4px` (macOS) / `5px` (Web player).
* **Track Radius:** `9999px` (Full capsule).
* **Track Background:** `var(--fill)` (`rgba(120, 120, 128, 0.20)`).
* **Progress Fill:** `var(--primary)` (`#007AFF`).
* **Knob (Thumb):**
  * Dimensions: `20px` width $\times$ `16px` height (macOS oval) or `14px` circle.
  * Background: Pure white `#FFFFFF`.
  * Shadow: `var(--shadow-thumb)` = `0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)`.
  * Active Dragging: `transform: scale(1.10)`.

#### Exact CSS Implementation:
```css
.apple-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 9999px;
  background: var(--fill);
  outline: none;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.apple-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #FFFFFF;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 3px 1px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 100ms cubic-bezier(0.04, 0.04, 0.12, 0.96);
}

.apple-slider::-webkit-slider-thumb:hover {
  transform: scale(1.05);
}

.apple-slider:active::-webkit-slider-thumb {
  transform: scale(1.12);
}

.apple-slider:focus-visible {
  box-shadow: var(--focus-ring);
}
```

---

### 3.4. Apple Text Fields & Inputs (`packages/ui/src/components/input.tsx`)

#### Dimensions & Tokens:
* **Height:** `24px` (macOS AppKit) or `28px` (compact pro-tool).
* **Radius:** `6px` (`--corner-lg`).
* **Border:** `0.5px solid var(--separator)` (`rgba(0, 0, 0, 0.1)`).
* **Background:** `var(--background-3)` (`#FFFFFF`).
* **Shadow:** `var(--shadow-control)` = `inset 0 0 0.5px 0 rgba(0,0,0,0.15), 1px 1px 1px 0 rgba(0,0,0,0.05)`.
* **Focus Ring:** `0 0 0 4px rgba(0, 122, 255, 0.60)`.
* **Font:** `JetBrains Mono` / `SF Mono` for numerical coordinates and QPs (`12px`).

#### Exact CSS Implementation:
```css
.apple-input {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--label);
  background-color: var(--background-3);
  border: 0.5px solid var(--separator);
  border-radius: 6px;
  box-shadow: var(--shadow-control);
  outline: none;
  transition: box-shadow 210ms cubic-bezier(0.04, 0.04, 0.12, 0.96),
              border-color 210ms cubic-bezier(0.04, 0.04, 0.12, 0.96);
}

.apple-input:focus {
  border-color: var(--system-blue);
  box-shadow: var(--focus-ring);
}

.apple-input::placeholder {
  color: var(--placeholder);
}

.apple-input:disabled {
  opacity: 0.40;
  cursor: not-allowed;
}
```

---

### 3.5. Apple Cards & Group Boxes (`packages/ui/src/components/card.tsx`)

#### Dimensions & Tokens:
* **Corner Radius:** `10px` (`--card-radius`).
* **Background:** `var(--card)` (`#FFFFFF`).
* **Border:** `0.5px solid var(--separator)` (`rgba(0, 0, 0, 0.1)`).
* **Padding:** `16px` (`p-4`).
* **Shadow:** `var(--shadow-card-small)` = `0 3px 9px rgba(0, 0, 0, 0.08)`.

#### Exact CSS Implementation:
```css
.apple-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-radius: var(--card-radius);
  background-color: var(--card);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card-small);
  padding: 16px;
  color: var(--label);
}

.apple-card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 0.5px solid var(--separator);
  padding-bottom: 8px;
}

.apple-card-title {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  color: var(--label);
  letter-spacing: -0.01em;
}

.apple-card-description {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--label-2);
}
```

---

## 4. HEVC Codec Semantic Color Spectrum (Exact Measured Values)

| Element | Apple System Token | Exact HEX | Light Background Tint | Visual Purpose |
| :--- | :--- | :---: | :---: | :--- |
| **Depth 0 ($64\times 64$)** | `system-cyan` | `#00C0E8` | `#E0F8FF` | CTU Root, flat backgrounds, sky, grass |
| **Depth 1 ($32\times 32$)** | `system-green` | `#34C759` | `#E8F8EE` | Moderate spatial gradients |
| **Depth 2 ($16\times 16$)** | `system-orange` | `#FF8D28` | `#FFF3E8` | Edge contours, moving object boundaries |
| **Depth 3 ($8\times 8$)** | `system-red` | `#FF383C` | `#FEECEB` | High-frequency details, sharp contrasts |
| **Intra Prediction** | `system-purple` | `#CB30E0` | `#F9EAFB` | Spatial prediction angles (0..34) |
| **Inter Uni-Pred** | `system-blue` | `#007AFF` | `#E5F2FF` | Forward motion reference (L0) |
| **Inter Bi-Pred** | `system-mint` | `#00C8B3` | `#E6F9F7` | Dual motion vectors (L0 + L1) |
| **Skip / Merge** | `system-gray` | `#8E8E93` | `#F2F2F7` | Zero residual, inherited motion |

---

## 8. Reusable Apple Component Module Reference

The front-end exports all authentic Apple components directly from [`src/components/apple`](../web_app/frontend/src/components/apple/index.jsx):

```jsx
import {
  Button,            // variants: 'filled' | 'tinted' | 'gray' | 'bordered' | 'plain' | 'destructive'
                     // sizes: 'mini' (16px) | 'small' (20px) | 'regular' (24px) | 'large' (28px) | 'xl' (36px)
  SegmentedControl,  // sizes: 'small' (24px) | 'regular' (28px) | 'large' (32px), sliding pill shadow
  Slider,            // 4px track, 18px thumb, optional label & readout badge
  Select,            // native macOS chevron picker
  Checkbox,          // 16px rounded square (4px corners) with System Blue fill
  Card,              // radius 10px, border 0.5px, card header support
  Badge,             // status pill tag with tinted system colors
  Input,             // 26px/28px height, focus ring 4px
} from './components/apple';
```

Use these components across all views to guarantee pixel-perfect adherence to Apple's Human Interface Guidelines.

