# Kiến trúc Encoder HEVC trong Mã nguồn HM-18.0

> * **Thuộc bộ tài liệu:** [HEVC Documentation System](./README.md) · **Xem thêm:** [Luồng Mã Hóa Xử Lý Theo Khối](./HEVC_BLOCK_BASED_HYBRID_FLOW.md)

---

## 1. Phân cấp Dữ liệu Chuẩn HEVC (Data Hierarchy)

| Cấp bậc | Tên gọi | Kích thước chuẩn | Vai trò kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Sequence / GOP** | Video Sequence / Group of Pictures | Độ phân giải gốc / 1..16 frames | Chuỗi khung hình định nghĩa bởi VPS/SPS; GOP điều phối thứ tự mã hóa theo POC. |
| **Picture / Slice** | Khung hình / Lát cắt / Tile | $W \times H$ / Tập hợp CTU | Một ảnh YUV (`TComPic`); Slice là đơn vị đóng gói NAL độc lập, Tile là phân hoạch không gian. |
| **CTU** | Coding Tree Unit | $64\times 64$ (mặc định) | Gốc của cây tứ phân (Quadtree), gồm 1 CTB Luma và 2 CTB Chroma (4:2:0). |
| **CU** | Coding Unit | $64\times 64 \to 8\times 8$ | Nút lá quyết định chế độ mã hóa (`MODE_INTRA`, `MODE_INTER`, Skip/Merge, PCM). |
| **PU** | Prediction Unit | $64\times 64 \to 4\times 4$ | Đơn vị mang tham số dự đoán: hướng góc Intra ($2N\times 2N, N\times N$) hoặc vector chuyển động Inter (SMP/AMP). |
| **TU** | Transform Unit | $32\times 32 \to 4\times 4$ | Đơn vị biến đổi DCT-II / DST-VII và lượng tử hóa phần dư theo cây **RQT** (Residual Quadtree). |

---

## 2. Phân cấp Kiến trúc Class C++ trong HM (`TLibEncoder` & `TLibCommon`)

| Lớp (Class) | File Header / Source | Trách nhiệm chính |
| :--- | :--- | :--- |
| **`TAppEncTop`** | [TAppEncTop.h](../source/App/TAppEncoder/TAppEncTop.h) · [.cpp](../source/App/TAppEncoder/TAppEncTop.cpp) | Đọc cấu hình `.cfg`, đọc luồng `.yuv`, gọi `TEncTop`, ghi bitstream `.bin`. |
| **`TEncTop`** | [TEncTop.h](../source/Lib/TLibEncoder/TEncTop.h) · [.cpp](../source/Lib/TLibEncoder/TEncTop.cpp) | Khởi tạo VPS/SPS/PPS, quản lý picture pool (`m_cListPic`), Pre-analyzer và Rate Control. |
| **`TEncGOP`** | [TEncGOP.h](../source/Lib/TLibEncoder/TEncGOP.h) · [.cpp](../source/Lib/TLibEncoder/TEncGOP.cpp) | Điều phối vòng lặp frame trong GOP theo POC, gọi lọc vòng DBF/SAO, đóng gói NAL units, tính PSNR. |
| **`TEncSlice`** | [TEncSlice.h](../source/Lib/TLibEncoder/TEncSlice.h) · [.cpp](../source/Lib/TLibEncoder/TEncSlice.cpp) | Duyệt vòng lặp CTU trong Slice theo thứ tự Tile Scan (`compressSlice` và `encodeSlice`). |
| **`TEncCu`** | [TEncCu.h](../source/Lib/TLibEncoder/TEncCu.h) · [.cpp](../source/Lib/TLibEncoder/TEncCu.cpp) | Đệ quy Quadtree CU (`xCompressCU`), điều phối thử nghiệm RDO (Merge, Inter, Intra, Split) và ghi CABAC (`xEncodeCU`). |
| **`TEncSearch`** | [TEncSearch.h](../source/Lib/TLibEncoder/TEncSearch.h) · [.cpp](../source/Lib/TLibEncoder/TEncSearch.cpp) | Ước lượng chuyển động Inter (`predInterSearch`), tìm kiếm 35 mode Intra (`estIntraPredLumaQT`), đệ quy cây biến đổi RQT. |
| **`TComPrediction`** | [TComPrediction.h](../source/Lib/TLibCommon/TComPrediction.h) · [.cpp](../source/Lib/TLibCommon/TComPrediction.cpp) | Lọc mẫu biên tham chiếu, nội suy góc Intra (`predIntraAng`), bù chuyển động 8-tap luma / 4-tap chroma (`motionCompensation`). |
| **`TComTrQuant`** | [TComTrQuant.h](../source/Lib/TLibCommon/TComTrQuant.h) · [.cpp](../source/Lib/TLibCommon/TComTrQuant.cpp) | Biến đổi thuận/ngược DCT-II & $4\times 4$ DST-VII (`xT`/`xIT`), lượng tử hóa/giải lượng tử (`xQuant`/`xDeQuant`), RDOQ. |
| **`TComLoopFilter`** | [TComLoopFilter.h](../source/Lib/TLibCommon/TComLoopFilter.h) · [.cpp](../source/Lib/TLibCommon/TComLoopFilter.cpp) | Tính cường độ biên $Bs \in \{0, 1, 2\}$ và lọc khử khối biên TU/PU (`loopFilterPic`). |
| **`TEncSampleAdaptiveOffset`** | [TEncSampleAdaptiveOffset.h](../source/Lib/TLibEncoder/TEncSampleAdaptiveOffset.h) · [.cpp](../source/Lib/TLibEncoder/TEncSampleAdaptiveOffset.cpp) | Thống kê và tối ưu RDO cho bộ lọc bù mẫu thích ứng SAO (Edge Offset / Band Offset) trên từng CTU (`SAOProcess`). |
| **`TEncSbac` / `TComRdCost`** | [TEncSbac.h](../source/Lib/TLibEncoder/TEncSbac.h) · [TComRdCost.h](../source/Lib/TLibCommon/TComRdCost.h) | Mã hóa số học nhị phân CABAC, đếm bit thử nghiệm và tính hàm chi phí Lagrange $J = D + \lambda \cdot R$ (SAD, SATD, SSE). |

---

## 3. Cơ chế RDO và Quản lý Bộ đệm Trạng thái

Tại mỗi độ sâu đệ quy `uiDepth` ($0 \le \text{uiDepth} \le 3$), `TEncCu` tối ưu hàm mục tiêu $J = D + \lambda \cdot R$:

1. **Đối sánh `rpcTempCU` và `rpcBestCU`:**
   - `rpcTempCU`: Lưu trạng thái và chi phí của ứng viên đang thử nghiệm.
   - `rpcBestCU`: Lưu cấu hình có chi phí $J$ nhỏ nhất tính đến thời điểm hiện tại.
   - `xCheckBestMode()`: Nếu $J(\text{rpcTempCU}) < J(\text{rpcBestCU})$, hoán đổi con trỏ/sao chép dữ liệu từ `TempCU` sang `BestCU`.
2. **Bộ đệm ngữ cảnh CABAC (`m_pppcRDSbacCoder` & `m_pcRDGoOnSbacCoder`):**
   - `CI_CURR_BEST`: Trạng thái xác suất CABAC đầu khối CU hiện tại.
   - `CI_TEMP_BEST`: Trạng thái CABAC tạm thời sau khi thử nghiệm một ứng viên.
   - `CI_NEXT_BEST`: Trạng thái CABAC của ứng viên chiến thắng để truyền tiếp sang khối kế tiếp.

---

## 4. Sơ đồ Cây Gọi Hàm Toàn Diện (Complete Call Tree)

```text
[encmain.cpp] main()
 └── [TAppEncTop.cpp] cTAppEncTop.encode()
      └── [TEncTop.cpp] m_cTEncTop.encode(pcPicYuvOrg, ...)
           ├── xGetNewPicBuffer() & pcPicYuvOrg->copyToPic(pcPicCurr->getPicYuvOrg())
           └── [TEncGOP.cpp] m_cGOPEncoder.compressGOP(...)
                ├── xInitGOP()
                └── FOR EACH PICTURE IN GOP (iGOPid = 0 .. m_iGopSize - 1):
                     ├── m_pcSliceEncoder->initEncSlice(pcPic, ...)
                     │
                     │=== [PHA 1: NÉN THỬ NGHIỆM RDO QUADTREE (TRIAL COMPRESSION)] ===
                     ├── [TEncSlice.cpp] m_pcSliceEncoder->precompressSlice(pcPic)
                     ├── [TEncSlice.cpp] m_pcSliceEncoder->compressSlice(pcPic, ...)
                     │    └── FOR EACH CTU IN SLICE (ctuTsAddr -> ctuRsAddr):
                     │         ├── [TEncCu.cpp] m_pcCuEncoder->compressCtu(pCtu)
                     │         │    └── xCompressCU(rpcBestCU, rpcTempCU, uiDepth = 0)
                     │         │         ├── [1] INTER SEARCH (P/B Slice):
                     │         │         │    ├── xCheckRDCostMerge2Nx2N() [Merge / Skip]
                     │         │         │    └── xCheckRDCostInter(2Nx2N, 2NxN, Nx2N, AMP)
                     │         │         │         ├── [TEncSearch.cpp] predInterSearch() [AMVP -> TZSearch IME -> 1/2 & 1/4-pel FME -> BiPred]
                     │         │         │         ├── [TEncSearch.cpp] encodeResAndCalcRdInterCU() -> xEstimateResidualQT() [RQT TU]
                     │         │         │         └── xCheckBestMode()
                     │         │         ├── [2] INTRA SEARCH:
                     │         │         │    └── xCheckRDCostIntra(SIZE_2Nx2N / SIZE_NxN)
                     │         │         │         ├── [TEncSearch.cpp] estIntraPredLumaQT()
                     │         │         │         │    ├── initIntraPatternChType() [4N+1 ref samples & MDIS filter]
                     │         │         │         │    ├── 35-Mode RMD Pass: predIntraAng() + Hadamard SATD
                     │         │         │         │    ├── MPM Derivation (3 modes từ khối Left A & Above B)
                     │         │         │         │    └── Full RDO Pass: xRecurIntraCodingLumaQT() [DCT/DST -> Quant -> IQ/IT -> SSE + lambda*R]
                     │         │         │         ├── [TEncSearch.cpp] estIntraPredChromaQT()
                     │         │         │         └── xCheckBestMode()
                     │         │         ├── [3] PCM CHECK: xCheckIntraPCM()
                     │         │         ├── [4] QUADTREE SPLIT (nếu uiDepth < MaxDepth):
                     │         │         │    ├── FOR uiPartUnitIdx = 0..3: xCompressCU(pcSubBestCU, pcSubTempCU, uiDepth + 1)
                     │         │         │    ├── encodeSplitFlag()
                     │         │         │    └── xCheckBestMode() [So sánh J(Non-Split) vs J(4 Sub-CUs)]
                     │         │         └── rpcBestCU->copyToPic(uiDepth) & xCopyYuv2Pic()
                     │         └── [TEncCu.cpp] m_pcCuEncoder->encodeCtu(pCtu) [Cập nhật CABAC & đếm bit thực tế]
                     │
                     │=== [PHA 2: LỌC VÒNG TRÊN KHUNG HÌNH TÁI TẠO (IN-LOOP FILTERING)] ===
                     ├── [TComLoopFilter.cpp] m_pcLoopFilter->loopFilterPic(pcPic) [Deblocking: Bs=0..2, lọc biên dọc -> ngang]
                     ├── [TEncSampleAdaptiveOffset.cpp] m_pcSAO->SAOProcess(pcPic, ...) [SAO: thống kê EO/BO, tối ưu RDO, cộng bù mẫu]
                     │
                     │=== [PHA 3: MÃ HÓA ENTROPY CHÍNH THỨC & ĐÓNG GÓI BITSTREAM] ===
                     ├── xWriteParameterSets() & m_pcEntropyCoder->encodeSliceHeader(pcSlice)
                     ├── [TEncSlice.cpp] m_pcSliceEncoder->encodeSlice(pcPic, &substreamsOut, ...)
                     │    └── FOR EACH CTU IN SLICE:
                     │         ├── m_pcEntropyCoder->encodeSAOBlkParam()
                     │         └── [TEncCu.cpp] m_pcCuEncoder->encodeCtu(pCtu) -> xEncodeCU(pcCU, 0, 0)
                     │              └── Ghi CABAC: split_cu_flag, skip_flag, pred_mode, part_size, pred_info, coeff (RQT)
                     └── xAttachSliceDataToNalUnit() -> pcPic->compressMotion() -> xCalculateAddPSNRs()
```
