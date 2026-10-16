# AGENTS.md — Workspace Guidelines for HEVC Reference Software & Web Analyzer

Welcome to the **HEVC Reference Software (HM-18.0) & Web Flow Analyzer** repository. This document defines project-wide rules, available specialized skills, architecture conventions, and test verification standards for all AI pair programming agents.

---

## 1. Project Directory Structure

```text
HEVC_reference_software/
├── .agents/                          # Customization root (Skills & Rules)
│   ├── skills/                       # Specialized domain skills
│   │   ├── hevc-pixel-accurate-design/       # 100% pixel fidelity & BT.709 colorimetry
│   │   ├── hevc-hm18-telemetry-pipeline/     # HM C++ VisualDumper hooks & trace streaming
│   │   ├── hevc-intra-prediction-analysis/   # 35 modes, 4N+1 ref samples, MDIS, 3 MPMs
│   │   ├── hevc-guided-flow-sync/            # 5-step guided journey & bidirectional sync
│   │   └── hevc-rdo-decision-engine/         # J = D + λ*R, recursive QuadTree, integer DCT
│   └── rules/                        # Project-wide constraints & standards
│       ├── hevc-codec-standards.md           # ITU-T H.265 standard & Hungarian notation
│       ├── ui-apple-tahoe-standard.md        # macOS Tahoe HIG, anti-jitter, 100% English
│       ├── react-performance-canvas.md       # 60 FPS canvas rendering & zero-allocation
│       └── zero-regression-test-integrity.md # Test gates (Vitest, Pytest, Oxlint)
├── agent -> .agents                  # Root symlink for `./agent` convention
├── source/                           # HM-18.0 C++ reference software source code
│   └── Lib/TLibCommon/VisualDumper.* # Telemetry hook singleton
├── tools/                            # Standalone probe CLI & visualizer tools
├── docs/                             # In-depth IEEE & engineering documentation
└── web_app/
    ├── backend/                      # Python 3.12+ FastAPI telemetry & session server
    └── frontend/                     # React 19 + Vite high-performance web analyzer
```

---

## 2. Active Skills Quick Reference

When approaching specialized tasks in this repository, consult and follow the corresponding skill:

1. **`hevc-pixel-accurate-design`** ([`SKILL.md`](file:///.agents/skills/hevc-pixel-accurate-design/SKILL.md)):
   - Enforce discrete sample rendering (`imageSmoothingEnabled = false`), ITU-R BT.709 color matrices, signed residual heatmaps, and zero browser blurring.
2. **`hevc-hm18-telemetry-pipeline`** ([`SKILL.md`](file:///.agents/skills/hevc-hm18-telemetry-pipeline/SKILL.md)):
   - C++ `VisualDumper` hooks (`CP_00` to `CP_07`), `trace.jsonl` streaming, asynchronous job submission, and `TAppEncoderIntraProbe` CLI usage.
3. **`hevc-intra-prediction-analysis`** ([`SKILL.md`](file:///.agents/skills/hevc-intra-prediction-analysis/SKILL.md)):
   - $4N+1$ perimeter samples, MDIS 3-tap filtering, 35 intra modes (Planar, DC, 33 Angular with 1/32-pel math), 3 MPM derivation, and 4:2:0 chroma modes.
4. **`hevc-guided-flow-sync`** ([`SKILL.md`](file:///.agents/skills/hevc-guided-flow-sync/SKILL.md)):
   - Single Source of Truth `(ctuX, ctuY, cu, channel, mode)`, 5-step Guided Journey, cross-tab bidirectional sync, and coordinate overflow safety on channel switch.
5. **`hevc-rdo-decision-engine`** ([`SKILL.md`](file:///.agents/skills/hevc-rdo-decision-engine/SKILL.md)):
   - Lagrangian cost $J = D + \lambda \cdot R$, QuadTree recursion ($J_{\text{split}}$ vs $J_{\text{nosplit}}$), Integer Core Transforms (ICT DCT-II / DST-VII), and zero-allocation client simulation.

---

## 3. Core Development Rules

All agent actions must respect the rules in `.agents/rules/`:
- **Strict English UI**: 100% of web app labels, button texts, tooltips, and badges must be in English.
- **Apple macOS Tahoe HIG**: 24px default button height, 0.5px solid borders, zero hover layout jitter, tabular numbers.
- **Canvas Rendering for Blocks $\ge 16\times 16$**: Never spawn 4,096 DOM nodes for large blocks; use direct canvas buffer rendering.
- **Zero-Allocation in Loops**: Reuse static typed arrays (`Int16Array`, `Float32Array`) in simulation loops.
- **100% Green Quality Gate**:
  - `npm test -- --run` in `web_app/frontend` (all 17 test suites must pass).
  - `./venv/bin/pytest tests/` in `web_app/backend` (all 47 tests must pass).
  - `npx oxlint` in `web_app/frontend` (0 warnings, 0 errors).
