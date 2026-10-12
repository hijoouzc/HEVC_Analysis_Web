# Technical Specification of Identifier Conventions and Hungarian Notation in HEVC Reference Software (HM-16.0)

> [!NOTE]
> **IEEE Standard Technical Specification**  
> Document Identifier: `IEEE-HEVC-SPEC-01` • Status: Approved Specification  
> Base Standard: ITU-T Recommendation H.265 | ISO/IEC 23008-2 (HEVC)  
> Implementation Reference: Joint Collaborative Team on Video Coding (JCT-VC) HM-16.0 Test Model  
> Master Index: [HEVC Documentation System](./README.md)

---

## 📑 Contents
- [I. Introduction](#i-introduction)
- [II. Scope and Function Prefixes](#ii-scope-and-function-prefixes)
- [III. Data Type Prefixes According to Hungarian Notation](#iii-data-type-prefixes-according-to-hungarian-notation)
  - [A. Primitive and Pointer Data Types](#a-primitive-and-pointer-data-types)
  - [B. Compound Identifier Decoding Logic](#b-compound-identifier-decoding-logic)
- [IV. Video Coding Acronyms and Technical Nomenclature](#iv-video-coding-acronyms-and-technical-nomenclature)
- [V. Key Data Structures and Variables in HM-16.0](#v-key-data-structures-and-variables-in-hm-160)
  - [A. CU and CTU Data Representation in `TComDataCU`](#a-cu-and-ctu-data-representation-in-tcomdatacu)
  - [B. RDO Optimization and Search Variables in `TEncCu` and `TEncSearch`](#b-rdo-optimization-and-search-variables-in-tenccu-and-tencsearch)
- [VI. Core Execution Functions in HM Encoder Pipeline](#vi-core-execution-functions-in-hm-encoder-pipeline)
- [References](#references)

---

## I. Introduction

The Joint Collaborative Team on Video Coding (JCT-VC) established strict coding guidelines for the reference implementation of High Efficiency Video Coding (HEVC), known as the HEVC Test Model (HM) [1], [2]. To ensure rigorous maintainability, cross-platform portability, and architectural transparency across thousands of source files, HM adopts a modified version of Hungarian notation coupled with standardized scope and type prefixes.

This document serves as the formal IEEE-style specification for naming conventions, variable decoding logic, data structures, and core execution routines in the HM-16.0 reference software.

---

## II. Scope and Function Prefixes

In the HM reference software, variable and function names immediately signal their scope, accessibility, memory lifetime, and structural ownership via standardized prefixes.

### TABLE I
### SCOPE AND FUNCTION IDENTIFIER PREFIXES IN HM REFERENCE SOFTWARE

| Prefix | Scope / Role | C++ Language Semantic | Source Code Example |
| :---: | :--- | :--- | :--- |
| `x...` | **eXtension / eXecute** | Private/protected member helper function | [`xCompressCU`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L531), [`xCheckBestMode`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L1826) |
| `m_` | **Member Variable** | Class instance attribute | `m_puhDepth`, `m_dTotalCost`, `m_cMv` |
| `g_` | **Global Variable / Table** | Global lookup table or constant array | `g_aucConvertToBit`, `g_auiZscanToRaster` |
| `r` | **Reference Argument** | C++ reference parameter pass-by-reference (`&`) | `rpcBestCU`, `ruiBits`, `rcDistParam` |
| `c` | **Class / Complex Instance** | Direct struct/class instance (value object) | `cMv` ([`TComMv`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibCommon/TComMv.h)), `cMvField` |
| `a` | **Array Structure** | Static array or contiguous member buffer | `m_acCUMvField`, `aacAMVPInfo` |

---

## III. Data Type Prefixes According to Hungarian Notation

Variable data types are embedded directly into identifier names through precise Hungarian notations, preventing unintended type conversions and bit-depth overflows in fixed-point arithmetic routines.

### A. Primitive and Pointer Data Types

### TABLE II
### DATA TYPE PREFIXES IN HM C++ IMPLEMENTATION

| Prefix | Underlying C++ Type | Mathematical Range / Specification | Representative Identifiers |
| :---: | :--- | :--- | :--- |
| `b` | `Bool` / `bool` | Boolean logic domain: $\{0, 1\}$ | `bBoundary`, `bSubBranch`, `bIsLosslessMode` |
| `i` | `Int` / `int` | Signed 32-bit integer: $[-2^{31}, 2^{31}-1]$ | `iPartIdx`, `iQP`, `iRoiWidth`, `iGOPid` |
| `ui` | `UInt` / `uint32_t` | Unsigned 32-bit integer: $[0, 2^{32}-1]$ | `uiDepth`, `uiPartUnitIdx`, `uiBits`, `uiDistortion` |
| `h` | `SChar` / `int8_t` | Signed 8-bit character: $[-128, 127]$ | `m_phQP` |
| `uh` | `UChar` / `uint8_t` | Unsigned 8-bit character: $[0, 255]$ | `uhDepth`, `uhNextDepth`, `m_puhDepth` |
| `d` | `Double` / `double` | 64-bit IEEE 754 floating point | `dTotalCost`, `dSplitCost`, `dLambda` |
| `e` | `enum` | Discrete enumerated type | `ePartSize`, `eRefPicList`, `eSliceType` |
| `p` | `*` | Single-level pointer (1D memory reference) | `pcCU`, `m_phQP`, `m_puhDepth` |
| `pp` | `**` | Double pointer (2D array / depth buffer) | `m_ppcBestCU`, `m_ppcOrigYuv`, `m_ppcTempCU` |
| `ppp` | `***` | Triple pointer (3D context buffer) | `m_pppcRDSbacCoder` |

### B. Compound Identifier Decoding Logic

In HM software, complex identifiers are systematically formed by compounding prefixes from left to right:
$$\text{Identifier} = \text{Prefix}_{\text{PassMode}} + \text{Prefix}_{\text{PointerLevel}} + \text{Prefix}_{\text{Type}} + \text{SemanticName} \tag{1}$$

1. **`rpcBestCU`**:
   * `r`: Pass-by-reference (`&`)
   * `p`: Pointer (`*`)
   * `c`: Class instance (`TComDataCU`)
   * `BestCU`: Semantic representation of the optimal CU candidate
   * *Signature:* `TComDataCU*& rpcBestCU`
2. **`m_ppcBestCU`**:
   * `m_`: Class member variable
   * `pp`: Double pointer (`**`)
   * `c`: Class instance
   * *Signature:* `TComDataCU** m_ppcBestCU` (indexed by depth $d \in [0, 3]$)
3. **`m_puhDepth`**:
   * `m_`: Class member variable
   * `p`: Single pointer (`*`)
   * `uh`: Unsigned 8-bit byte (`UChar`)
   * *Signature:* `UChar* m_puhDepth` (depth map across all $4 \times 4$ units)
4. **`m_pePartSize`**:
   * `m_`: Class member variable
   * `p`: Single pointer (`*`)
   * `e`: Enum type (`PartSize`)
   * *Signature:* `PartSize* m_pePartSize`

---

## IV. Video Coding Acronyms and Technical Nomenclature

### TABLE III
### VIDEO CODING ACRONYMS AND FORMAL DEFINITIONS (ITU-T H.265 / IEEE)

| Acronym | Formal Nomenclature | Technical Definition According to Standard [1] |
| :--- | :--- | :--- |
| **CTU / CTB** | **Coding Tree Unit / Block** | The fundamental root coding grid in HEVC, nominally spanning $64 \times 64$ luma samples and two $32 \times 32$ chroma samples (4:2:0 format). |
| **CU / CB** | **Coding Unit / Block** | The recursive multi-size leaf node of the CTU quadtree ($64\times 64 \rightarrow 8\times 8$), serving as the decision level for Intra vs. Inter prediction mode. |
| **PU / PB** | **Prediction Unit / Block** | The unit that carries prediction parameters (Intra angular direction, motion vectors, reference indices). Supports $2N\times 2N$ and $N\times N$. |
| **TU / TB** | **Transform Unit / Block** | The spatial block subjected to integer core transform (DCT-II / DST-VII) and quantization. Governed by the Residual Quadtree (RQT). |
| **RDO** | **Rate-Distortion Optimization** | The Lagrangian optimization metric formulating mode and partition selection: $J = D + \lambda \cdot R$. |
| **RQT** | **Residual Quadtree** | The recursive quadtree structure dividing CU residual blocks into variable-sized transform units ($32\times 32 \to 4\times 4$). |
| **SMP / AMP** | **Symmetric / Asymmetric Motion Partitions** | Partition subdivisions for Inter prediction: SMP ($2N\times N, N\times 2N$) and AMP ($2N\times nU, 2N\times nD, nL\times 2N, nR\times 2N$). |
| **MV / MVP** | **Motion Vector / Predictor** | Spatial two-dimensional vector $(dx, dy)$ representing displacement from current picture to reference picture, and its candidate predictor. |
| **AMVP** | **Advanced Motion Vector Prediction** | Competitive vector prediction scheme deriving an optimal 2-candidate motion vector list from spatial and temporal neighbors. |
| **Merge / Skip** | **Merge / Skip Mode** | Direct motion inference from adjacent blocks. Skip mode suppresses all transform residual transmission ($\text{CBF} = 0$). |
| **CBF** | **Coded Block Flag** | Binary syntax flag signaling whether a transform block contains non-zero quantized transform coefficients. |
| **QP / dQP** | **Quantization Parameter / delta QP** | Scalar quantization control parameter ($QP \in [0, 51]$) / CU-level adaptive quantization offset. |
| **Pel** | **Picture Element** | Discrete pixel intensity sample in the spatial domain. |
| **ROI** | **Region of Interest** | Spatial bounding box designated for targeted encoding, instrumentation, or visualization. |
| **CABAC** | **Context-Adaptive Binary Arithmetic Coding** | Normative entropy coding engine in HEVC delivering optimal lossless symbol compression based on adaptive probability state models. |
| **Orig / Pred / Resi / Reco** | **Original / Prediction / Residual / Reconstruction** | The four canonical image sample states: pristine input ($S$), synthesized predictor ($P$), difference ($R = S - P$), and local reconstruction ($\hat{S} = P + \hat{R}$). |

---

## V. Key Data Structures and Variables in HM-16.0

### A. CU and CTU Data Representation in `TComDataCU`
The [`TComDataCU`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibCommon/TComDataCU.h#L64) class serves as the comprehensive in-memory model storing coding parameters for an entire CTU and its recursive subdivisions:
* `m_puhDepth`: 1D array mapping recursive quadtree depth ($d \in [0, 3]$) for each $4\times 4$ base partition.
* `m_pePartSize`: Array of partition structure enums (`SIZE_2Nx2N`, `SIZE_2NxN`, `SIZE_Nx2N`, `SIZE_NxN`, AMP).
* `m_pePredMode`: Array of prediction modes (`MODE_INTER`, `MODE_INTRA`).
* `m_puhTrIdx`: Transform depth hierarchy index within the Residual Quadtree.
* `m_puhCbf[3]`: Coded Block Flags for color components ($Y, Cb, Cr$).
* `m_phQP`: Array storing effective quantization parameters.
* `m_pcTrCoeff[3]`: 1D serialized buffers containing quantized 2D transform coefficients.
* `m_acCUMvField[2]`: Motion vector fields and reference picture indices for reference lists $L_0$ and $L_1$.
* `m_ctuRsAddr`: Raster-scan address of the current CTU within the slice segment.
* `m_absZIdxInCtu`: Z-scan (Morton order) index of the sub-CU within the parent CTU.
* `m_uiCUPelX`, `m_uiCUPelY`: Spatial coordinates of the top-left pixel relative to the picture boundary.
* `m_pbMergeFlag` / `m_puhMergeIndex`: Flag and selected index ($0 \dots 4$) for spatial/temporal Merge candidates.
* `m_skipFlag`: Syntax flag indicating activation of zero-residual Skip mode.

### B. RDO Optimization and Search Variables in `TEncCu` and `TEncSearch`
The encoding optimization engine in [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h#L73) and [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h#L88) governs recursive exploration:
* `rpcBestCU` / `rpcTempCU`: Dual instance pointers tracking the global minimum candidate (`Best`) versus trial state (`Temp`).
* `uiDepth`: Current depth level in recursive exploration ($0 \le \text{uiDepth} \le D_{\max}$).
* `uhNextDepth`: Child depth parameter ($\text{uiDepth} + 1$).
* `uiPartUnitIdx`: Quadrant index in quadtree subdivision ($0$: Top-Left, $1$: Top-Right, $2$: Bottom-Left, $3$: Bottom-Right).
* `bBoundary`: Picture boundary violation flag forcing quadtree split without mode evaluation.
* `bSubBranch`: Logical gate controlling continued recursive tree expansion.
* `iPartIdx`: Partition block index within multi-PU prediction configurations.
* `dTotalCost`: Cumulative Lagrangian cost evaluated via:
  $$J = D + \lambda \cdot R \tag{2}$$
* `uiTotalDistortion`: Sum of squared differences (SSD) or sum of absolute differences (SAD) distortion metric.
* `uiTotalBits`: Rate consumption measured in exact fractional bins and coded syntax bits.
* `m_pppcRDSbacCoder`: Multi-tier context buffer maintaining CABAC probability model states during trial evaluations.
* `m_ppcOrigYuv`, `m_ppcPredYuvTemp`, `m_ppcResiYuvTemp`, `m_ppcRecoYuvTemp`: Depth-indexed pixel buffers storing original, prediction, residual, and reconstructed planes.

---

## VI. Core Execution Functions in HM Encoder Pipeline

### TABLE IV
### CORE EXECUTION FUNCTIONS IN THE HM ENCODER PIPELINE

| Function Identifier | Host Class | Source Definition | Primary Technical Mandate |
| :--- | :--- | :--- | :--- |
| [`compressCtu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L238) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:238` | Root entry point for CTU processing; initializes depth 0 buffers and evaluates picture boundary safety (`bBoundary`). |
| [`xCompressCU`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L531) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:531` | Depth-first recursive quadtree engine testing non-split modes against 4 sub-CU partitioned candidates. |
| [`xCheckBestMode`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L1826) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:1826` | Compares candidate RD cost ($J_{\text{temp}} < J_{\text{best}}$); performs zero-copy pointer and buffer swaps upon finding superior candidates. |
| [`xCheckRDCostMerge2Nx2N`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L716) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:716` | Evaluates $2N\times 2N$ Merge and Skip candidates early to establish tight upper-bound thresholds ($J_{\text{best}}$). |
| [`xCheckRDCostInter`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L1635) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:1635` | Evaluates Inter prediction candidates across symmetric (2Nx2N, 2NxN, Nx2N) and asymmetric (AMP) partitions. |
| [`xCheckRDCostIntra`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.cpp#L1695) | [`TEncCu`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncCu.h) | `TEncCu.cpp:1695` | Coordinates 35-mode Intra prediction search for $2N\times 2N$ and $N\times N$ configurations. |
| [`predInterSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.cpp#L3057) | [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h) | `TEncSearch.cpp:3057` | Iterates over prediction blocks to execute integer and sub-pixel motion estimation against reference frames in DPB. |
| [`estIntraPredLumaQT`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.cpp#L2204) | [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h) | `TEncSearch.cpp:2204` | Two-pass Intra search: Phase 1 fast SATD screening across 35 modes; Phase 2 full RDO evaluation over Top-K and MPM lists. |
| [`encodeResAndCalcRdInterCU`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.cpp#L4720) | [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h) | `TEncSearch.cpp:4720` | Executes residual transform, quantization, CABAC entropy encoding, and distortion calculation for Inter blocks. |
| [`xEstimateInterResidualQT`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.cpp#L4838) | [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h) | `TEncSearch.cpp:4838` | Recursively evaluates Residual Quadtree (RQT) transform splits to determine optimal transform block size. |
| [`xRecurIntraCodingLumaQT`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.cpp#L1431) | [`TEncSearch`](file:///home/hoinguyen/Documents/Video_Compression/HEVC_reference_software/source/Lib/TLibEncoder/TEncSearch.h) | `TEncSearch.cpp:1431` | Recursively transforms, quantizes, and reconstructs Intra luma transform blocks in closed-loop order. |

---

## References

* [1] G. J. Sullivan, J.-R. Ohm, W.-J. Han, and T. Wiegand, "Overview of the High Efficiency Video Coding (HEVC) Standard," *IEEE Transactions on Circuits and Systems for Video Technology*, vol. 22, no. 12, pp. 1649–1668, Dec. 2012.
* [2] *High Efficiency Video Coding (HEVC) Reference Software HM-16.0*, Joint Collaborative Team on Video Coding (JCT-VC) of ITU-T SG 16 WP 3 and ISO/IEC JTC 1/SC 29/WG 11, 2014.
* [3] I.-K. Kim et al., "High Efficiency Video Coding (HEVC) Test Model 16 (HM 16) Encoder Description," Joint Collaborative Team on Video Coding (JCT-VC), document JCTVC-S1002, Strasbourg, France, Oct. 2014.
* [4] V. Sze, M. Budagavi, and G. J. Sullivan, Eds., *High Efficiency Video Coding (HEVC): Algorithms and Architectures*, Springer, 2014.
