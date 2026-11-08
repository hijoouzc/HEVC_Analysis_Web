# Quy Ước Đặt Tên và Ký Pháp Hungary trong Mã Nguồn HM-18.0

> Quy tắc giải mã tiền tố biến, hàm, từ viết tắt và các cấu trúc dữ liệu cốt lõi trong phần mềm tham chiếu **JCT-VC HM-18.0**. Xem thêm ánh xạ cú pháp chuẩn H.265 tại [`HEVC_SPEC_MAPPING_REFERENCE.md`](../../docs/HEVC_SPEC_MAPPING_REFERENCE.md).

---

## 1. Tiền tố Phạm vi và Hàm (Scope & Function Prefixes)

| Tiền tố | Ý nghĩa | Ngữ nghĩa C++ | Ví dụ trong HM-18.0 |
| :---: | :--- | :--- | :--- |
| `x...` | **eXtension / eXecute** | Hàm thành viên `private` / `protected` nội bộ | [`xCompressCU`](../source/Lib/TLibEncoder/TEncCu.cpp#L531), [`xCheckBestMode`](../source/Lib/TLibEncoder/TEncCu.cpp#L1826) |
| `m_` | **Member Variable** | Biến thành viên của class | `m_puhDepth`, `m_dTotalCost`, `m_cMv` |
| `g_` | **Global Table** | Bảng hằng số / tra cứu toàn cục (`TComRom.cpp`) | `g_aucConvertToBit`, `g_auiZscanToRaster` |
| `r` | **Reference Argument** | Tham số truyền tham chiếu (`&`) | `rpcBestCU`, `ruiBits`, `rcDistParam` |
| `c` | **Class Instance** | Thực thể struct/class trực tiếp (value object) | `cMv` ([`TComMv`](../source/Lib/TLibCommon/TComMv.h)), `cMvField` |
| `a` | **Array Structure** | Mảng tĩnh hoặc buffer liên tục | `m_acCUMvField`, `aacAMVPInfo` |

---

## 2. Tiền tố Kiểu Dữ liệu theo Ký pháp Hungary (Data Type Prefixes)

| Tiền tố | Kiểu C++ | Miền giá trị / Ý nghĩa | Ví dụ |
| :---: | :--- | :--- | :--- |
| `b` | `Bool` / `bool` | Logic $\{0, 1\}$ | `bBoundary`, `bSubBranch`, `bIsLosslessMode` |
| `i` | `Int` / `int` | Số nguyên có dấu 32-bit | `iPartIdx`, `iQP`, `iGOPid` |
| `ui` | `UInt` / `uint32_t` | Số nguyên không dấu 32-bit | `uiDepth`, `uiPartUnitIdx`, `uiBits`, `uiDistortion` |
| `h` / `uh` | `SChar` / `UChar` | Số nguyên 8-bit có dấu / không dấu | `m_phQP`, `uhDepth`, `m_puhDepth` |
| `d` | `Double` | Số thực dấu phẩy động 64-bit | `dTotalCost`, `dSplitCost`, `dLambda` |
| `e` | `enum` | Kiểu liệt kê rời rạc | `ePartSize`, `eRefPicList`, `eSliceType` |
| `p` / `pp` / `ppp` | `*` / `**` / `***` | Con trỏ cấp 1 / cấp 2 / cấp 3 | `pcCU`, `m_ppcBestCU`, `m_pppcRDSbacCoder` |

### Quy tắc ghép tiền tố (từ trái sang phải)
$$\text{Identifier} = \text{Prefix}_{\text{Scope/PassMode}} + \text{Prefix}_{\text{PointerLevel}} + \text{Prefix}_{\text{Type}} + \text{SemanticName}$$
- **`rpcBestCU`** (`TComDataCU*&`): `r` (tham chiếu `&`) + `p` (con trỏ `*`) + `c` (class `TComDataCU`).
- **`m_ppcBestCU`** (`TComDataCU**`): `m_` (member) + `pp` (mảng con trỏ theo `uiDepth`) + `c` (class).
- **`m_puhDepth`** (`UChar*`): `m_` (member) + `p` (mảng 1D 256 phần tử) + `uh` (`UChar`).
- **`m_pePartSize`** (`PartSize*`): `m_` (member) + `p` (mảng 1D) + `e` (`enum PartSize`).

---

## 3. Từ điển Thuật ngữ Viết tắt Chuẩn HEVC

| Viết tắt | Tên đầy đủ | Định nghĩa kỹ thuật |
| :--- | :--- | :--- |
| **CTU / CTB** | Coding Tree Unit / Block | Khối gốc của cây mã hóa (mặc định $64\times 64$ Luma + hai khối $32\times 32$ Chroma 4:2:0). |
| **CU / CB** | Coding Unit / Block | Nút lá của cây tứ phân CTU ($64\times 64 \to 8\times 8$), quyết định chế độ Intra / Inter / Skip. |
| **PU / PB** | Prediction Unit / Block | Đơn vị mang thông số dự đoán ($2N\times 2N, N\times N$, SMP, AMP). |
| **TU / TB** | Transform Unit / Block | Đơn vị biến đổi DCT-II / DST-VII và lượng tử hóa theo cây phần dư **RQT** ($32\times 32 \to 4\times 4$). |
| **RDO / RDOQ** | Rate-Distortion Optimization | Tối ưu hóa chi phí Lagrange $J = D + \lambda \cdot R$ (chọn mode và làm tròn hệ số lượng tử). |
| **MPM / RMD** | Most Probable Modes / Rough Mode Decision | 3 chế độ Intra khả dĩ nhất từ khối lân cận A, B / Bước lọc nhanh 35 mode bằng Hadamard SATD. |
| **AMVP / Merge** | Advanced Motion Vector Prediction | Dự đoán vector chuyển động cạnh tranh (2 ứng viên) / Kế thừa trực tiếp thông tin chuyển động (5 ứng viên). |
| **CBF** | Coded Block Flag | Cờ báo hiệu khối TU có chứa ít nhất một hệ số lượng tử khác 0 hay không. |
| **Pel** | Picture Element | Giá trị mẫu điểm ảnh rời rạc (`Short` 16-bit trong HM để hỗ trợ cả 8-bit và 10-bit). |

---

## 4. Biến Thành viên Trọng yếu trong `TComDataCU`, `TEncCu` và `TEncSearch`

### A. Mảng 1D theo đơn vị phân hoạch $4\times 4$ Z-Scan trong [`TComDataCU`](../source/Lib/TLibCommon/TComDataCU.h#L64)
- `m_puhDepth`: Độ sâu chia cây tứ phân CU ($d \in [0, 3]$).
- `m_pePartSize` / `m_pePredMode`: Kích thước phân vùng (`SIZE_2Nx2N`...) và chế độ dự đoán (`MODE_INTRA`, `MODE_INTER`).
- `m_puhIntraDir[2]`: Hướng dự đoán Intra cho kênh Luma (`[0]`, `0..34`) và Chroma (`[1]`).
- `m_puhTrIdx` / `m_puhCbf[3]`: Độ sâu chia cây biến đổi RQT và cờ Coded Block Flag cho 3 kênh $(Y, Cb, Cr)$.
- `m_phQP` / `m_pcTrCoeff[3]`: Tham số lượng tử hóa $QP$ và bộ đệm hệ số biến đổi lượng tử hóa.
- `m_acCUMvField[2]` / `m_pbMergeFlag` / `m_puhMergeIndex` / `m_skipFlag`: Trường vector chuyển động ($L_0, L_1$) và các cờ Merge/Skip.
- `m_ctuRsAddr` / `m_absZIdxInCtu` / `m_uiCUPelX`, `m_uiCUPelY`: Địa chỉ CTU theo Raster Scan, chỉ số Morton Z-scan trong CTU và tọa độ pixel góc trên-trái.

### B. Biến Điều khiển RDO trong [`TEncCu`](../source/Lib/TLibEncoder/TEncCu.h#L73) & [`TEncSearch`](../source/Lib/TLibEncoder/TEncSearch.h#L88)
- `rpcBestCU`, `rpcTempCU`: Cặp con trỏ CU lưu ứng viên tốt nhất và ứng viên đang thử nghiệm tại mỗi độ sâu `uiDepth`.
- `uiPartUnitIdx`: Chỉ số góc phần tư trong phép chia Quadtree ($0$: Top-Left, $1$: Top-Right, $2$: Bottom-Left, $3$: Bottom-Right).
- `bBoundary`: Cờ báo khối CU vượt biên khung hình, bắt buộc chia tiếp Quadtree mà không thử mode.
- `dTotalCost`, `uiTotalDistortion`, `uiTotalBits`: Tổng chi phí $J$, độ méo dạng $D$ và số bit $R$ của khối CU.
- `m_ppcOrigYuv`, `m_ppcPredYuvTemp`, `m_ppcResiYuvTemp`, `m_ppcRecoYuvTemp`: Các mảng buffer điểm ảnh 2D theo từng độ sâu `uiDepth`.
