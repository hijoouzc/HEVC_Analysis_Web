from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

class AvailabilityStatus(str, Enum):
    """
    Operational availability of standard HEVC elements in telemetry and reference architecture:
    - IN_TRACE: Serialized directly in JSONL telemetry events.
    - IN_HM_NEEDS_EXPORT: Maintained in HM-18.0 C++ memory structures, exportable via dumper.
    - TEST_INSTRUMENT_ONLY: Ephemeral trial data capturable during live search (non-winner modes).
    - DERIVED_VALUE: Derived or computed mathematically from primary telemetry fields.
    """
    IN_TRACE = "IN_TRACE"
    IN_HM_NEEDS_EXPORT = "IN_HM_NEEDS_EXPORT"
    TEST_INSTRUMENT_ONLY = "TEST_INSTRUMENT_ONLY"
    DERIVED_VALUE = "DERIVED_VALUE"


class HevcSpecElement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(..., description="Standard ITU-T H.265 syntax element or data field name")
    subsystem: str = Field(..., description="Functional HEVC subsystem (SPS, PPS, SliceHeader, CU, PU, TU, Inter, Deblocking, SAO, CABAC)")
    standard_section: str = Field(..., description="ITU-T H.265 (HEVC) specification section reference")
    descriptor: str = Field(..., description="ITU-T H.265 parsing descriptor: u(v), ue(v), se(v), ae(v), or 'derived'")
    hm_class: str = Field(..., description="Primary HM-18.0 C++ reference class")
    hm_member: str = Field(..., description="Internal HM-18.0 C++ member variable")
    hm_method: str = Field(..., description="Standard HM-18.0 C++ getter or accessor method")
    status: AvailabilityStatus = Field(..., description="Live availability status")
    trace_event: str | None = Field(default=None, description="Associated telemetry event in trace.jsonl if available")
    description: str = Field(..., description="Detailed technical specification and explanation")


HEVC_SPEC_DICTIONARY: dict[str, HevcSpecElement] = {
    # ==========================================
    # Sequence Parameter Set (SPS) - Section 7.3.2.2
    # ==========================================
    "pic_width_in_luma_samples": HevcSpecElement(
        name="pic_width_in_luma_samples",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_picWidthInLumaSamples",
        hm_method="getPicWidthInLumaSamples()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the width of each decoded picture in units of luma samples."
    ),
    "pic_height_in_luma_samples": HevcSpecElement(
        name="pic_height_in_luma_samples",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_picHeightInLumaSamples",
        hm_method="getPicHeightInLumaSamples()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the height of each decoded picture in units of luma samples."
    ),
    "chroma_format_idc": HevcSpecElement(
        name="chroma_format_idc",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_chromaFormatIdc",
        hm_method="getChromaFormatIdc()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the chroma sampling relative to luma sampling (0=monochrome, 1=4:2:0, 2=4:2:2, 3=4:4:4)."
    ),
    "bit_depth_luma": HevcSpecElement(
        name="bit_depth_luma",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_bitDepths.recon[CHANNEL_TYPE_LUMA]",
        hm_method="getBitDepth(CHANNEL_TYPE_LUMA)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Bit depth of the samples of the luma array (BitDepth_Y = 8 + bit_depth_luma_minus8)."
    ),
    "log2_min_luma_coding_block_size": HevcSpecElement(
        name="log2_min_luma_coding_block_size",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_log2MinCodingBlockSize",
        hm_method="getLog2MinCodingBlockSize()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the minimum luma coding block size MinCbLog2SizeY."
    ),
    "log2_diff_max_min_luma_coding_block_size": HevcSpecElement(
        name="log2_diff_max_min_luma_coding_block_size",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_log2DiffMaxMinCodingBlockSize",
        hm_method="getLog2DiffMaxMinCodingBlockSize()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the difference between maximum and minimum luma coding block size."
    ),
    "quadtree_tu_log2_min_size": HevcSpecElement(
        name="quadtree_tu_log2_min_size",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_uiQuadtreeTULog2MinSize",
        hm_method="getQuadtreeTULog2MinSize()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Minimum transform block size MinTbLog2SizeY."
    ),
    "quadtree_tu_log2_max_size": HevcSpecElement(
        name="quadtree_tu_log2_max_size",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="ue(v)",
        hm_class="TComSPS",
        hm_member="m_uiQuadtreeTULog2MaxSize",
        hm_method="getQuadtreeTULog2MaxSize()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Maximum transform block size MaxTbLog2SizeY."
    ),
    "sample_adaptive_offset_enabled_flag": HevcSpecElement(
        name="sample_adaptive_offset_enabled_flag",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="u(1)",
        hm_class="TComSPS",
        hm_member="m_bUseSAO",
        hm_method="getUseSAO()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies whether sample adaptive offset is applied to reconstructed picture after deblocking."
    ),
    "strong_intra_smoothing_enabled_flag": HevcSpecElement(
        name="strong_intra_smoothing_enabled_flag",
        subsystem="SPS",
        standard_section="7.3.2.2 / 7.4.3.2",
        descriptor="u(1)",
        hm_class="TComSPS",
        hm_member="m_useStrongIntraSmoothing",
        hm_method="getUseStrongIntraSmoothing()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies whether strong intra smoothing is enabled for 32x32 intra prediction blocks."
    ),

    # ==========================================
    # Picture Parameter Set (PPS) - Section 7.3.2.3
    # ==========================================
    "init_qp_minus26": HevcSpecElement(
        name="init_qp_minus26",
        subsystem="PPS",
        standard_section="7.3.2.3 / 7.4.3.3",
        descriptor="se(v)",
        hm_class="TComPPS",
        hm_member="m_picInitQPMinus26",
        hm_method="getPicInitQPMinus26()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies the initial luma quantization parameter SliceQp_Y minus 26 for each slice."
    ),
    "transquant_bypass_enabled_flag": HevcSpecElement(
        name="transquant_bypass_enabled_flag",
        subsystem="PPS",
        standard_section="7.3.2.3 / 7.4.3.3",
        descriptor="u(1)",
        hm_class="TComPPS",
        hm_member="m_TransquantBypassEnabledFlag",
        hm_method="getTransquantBypassEnabledFlag()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Indicates whether cu_transquant_bypass_flag may be present in coding units."
    ),
    "cu_qp_delta_enabled_flag": HevcSpecElement(
        name="cu_qp_delta_enabled_flag",
        subsystem="PPS",
        standard_section="7.3.2.3 / 7.4.3.3",
        descriptor="u(1)",
        hm_class="TComPPS",
        hm_member="m_useDQP",
        hm_method="getUseDQP()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies whether diff_cu_qp_delta_depth syntax is present in picture parameter set."
    ),
    "diff_cu_qp_delta_depth": HevcSpecElement(
        name="diff_cu_qp_delta_depth",
        subsystem="PPS",
        standard_section="7.3.2.3 / 7.4.3.3",
        descriptor="ue(v)",
        hm_class="TComPPS",
        hm_member="m_uiMaxCuDQPDepth",
        hm_method="getMaxCuDQPDepth()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SEQUENCE_METADATA",
        description="Specifies maximum coding quadtree depth at which cu_qp_delta is signaled."
    ),

    # ==========================================
    # Slice Header - Section 7.3.6
    # ==========================================
    "slice_type": HevcSpecElement(
        name="slice_type",
        subsystem="SliceHeader",
        standard_section="7.3.6.1 / 7.4.7.1",
        descriptor="ue(v)",
        hm_class="TComSlice",
        hm_member="m_eSliceType",
        hm_method="getSliceType()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="FRAME_GOP",
        description="Specifies the coding type of the slice: 0=B (Bi-predictive), 1=P (Predictive), 2=I (Intra)."
    ),
    "slice_qp_delta": HevcSpecElement(
        name="slice_qp_delta",
        subsystem="SliceHeader",
        standard_section="7.3.6.1 / 7.4.7.1",
        descriptor="se(v)",
        hm_class="TComSlice",
        hm_member="m_iSliceQpDelta",
        hm_method="getSliceQpDelta()",
        status=AvailabilityStatus.IN_HM_NEEDS_EXPORT,
        trace_event=None,
        description="Specifies initial value of Qp_Y to be used for the coding blocks in the slice until modified by cu_qp_delta."
    ),

    # ==========================================
    # Coding Quadtree & Coding Unit (CU) - Section 7.3.8.5
    # ==========================================
    "m_puhDepth": HevcSpecElement(
        name="m_puhDepth",
        subsystem="CU",
        standard_section="Section 8.1 / HM TComDataCU",
        descriptor="derived",
        hm_class="TComDataCU",
        hm_member="m_puhDepth",
        hm_method="getDepth(absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CTU_PARTITION",
        description="Internal HM array storing the quadtree depth (0..3) for each 4x4 raster partition unit."
    ),
    "split_cu_flag": HevcSpecElement(
        name="split_cu_flag",
        subsystem="CU",
        standard_section="7.3.8.4 / 7.4.9.4",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_puhDepth",
        hm_method="getDepth(absPartIdx) > currentDepth",
        status=AvailabilityStatus.DERIVED_VALUE,
        trace_event="CTU_PARTITION",
        description="Coding quadtree syntax element specifying whether a coding unit is split into four smaller coding units of equal size."
    ),
    "cu_transquant_bypass_flag": HevcSpecElement(
        name="cu_transquant_bypass_flag",
        subsystem="CU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_CUTransquantBypass",
        hm_method="getCUTransquantBypass(absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CTU_PARTITION",
        description="Specifies whether transform, quantization, and in-loop filtering processes are completely bypassed."
    ),
    "skip_flag": HevcSpecElement(
        name="skip_flag",
        subsystem="CU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_skipFlag",
        hm_method="isSkipped(absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CTU_PARTITION",
        description="Specifies whether current CU is encoded in SKIP mode (zero motion vector difference, zero residual)."
    ),
    "pred_mode_flag": HevcSpecElement(
        name="pred_mode_flag",
        subsystem="CU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_pePredMode",
        hm_method="getPredictionMode(absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CTU_PARTITION",
        description="Specifies whether current coding unit is predicted using inter prediction (0) or intra prediction (1)."
    ),
    "part_mode": HevcSpecElement(
        name="part_mode",
        subsystem="CU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_pePartSize",
        hm_method="getPartitionSize(absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CTU_PARTITION",
        description="Specifies partitioning mode of the coding unit: 2Nx2N, 2NxN, Nx2N, NxN, 2NxnU, 2NxnD, nLx2N, nRx2N."
    ),

    # ==========================================
    # Coding Unit (CU) / PU - Intra Prediction - Section 7.3.8.5
    # ==========================================
    "prev_intra_luma_pred_flag": HevcSpecElement(
        name="prev_intra_luma_pred_flag",
        subsystem="PU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_puhIntraDir[CHANNEL_TYPE_LUMA]",
        hm_method="getIntraDir(CHANNEL_TYPE_LUMA, absPartIdx)",
        status=AvailabilityStatus.DERIVED_VALUE,
        trace_event="RDO_INTRA_SEARCH",
        description="Specifies whether the luma intra prediction mode is inferred from Most Probable Modes (MPM)."
    ),
    "mpm_idx": HevcSpecElement(
        name="mpm_idx",
        subsystem="PU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_puhIntraDir",
        hm_method="getIntraDir(CHANNEL_TYPE_LUMA, absPartIdx)",
        status=AvailabilityStatus.DERIVED_VALUE,
        trace_event="INTRA_MPM_DERIVATION",
        description="Specifies which of the 3 most probable modes is used for luma intra prediction."
    ),
    "intra_chroma_pred_mode": HevcSpecElement(
        name="intra_chroma_pred_mode",
        subsystem="PU",
        standard_section="7.3.8.5 / 7.4.9.5",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_puhIntraDir[CHANNEL_TYPE_CHROMA]",
        hm_method="getIntraDir(CHANNEL_TYPE_CHROMA, absPartIdx)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="INTRA_CHROMA_SEARCH",
        description="Specifies chroma intra prediction mode. In ITU-T H.265 Table 8-3, syntax values are 0 (Planar), 1 (Vertical), 2 (Horizontal), 3 (DC), and 4 (DM - derived from luma mode). In HM-18.0 internal representation, these are mapped to angular indices: Planar (0), DC (1), Hor (10), Ver (26), DM (36)."
    ),

    # ==========================================
    # Transform Tree & Residual Coding - Section 7.3.8.8 / 7.3.8.11
    # ==========================================
    "split_transform_flag": HevcSpecElement(
        name="split_transform_flag",
        subsystem="TU",
        standard_section="7.3.8.8 / 7.4.9.8",
        descriptor="ae(v)",
        hm_class="TComTU",
        hm_member="rTu.GetSplitMode()",
        hm_method="rTu.GetSplitMode()",
        status=AvailabilityStatus.DERIVED_VALUE,
        trace_event="TRANSFORM_QUANT",
        description="Syntax element specifying whether a transform block is split into smaller transform blocks. In raw trace, individual TU blocks are dumped with tu_depth; the split_transform_flag itself is derived from the TU quadtree hierarchy in HM C++."
    ),
    "cbf": HevcSpecElement(
        name="cbf",
        subsystem="TU",
        standard_section="7.3.8.8 / 7.4.9.8",
        descriptor="ae(v)",
        hm_class="TComDataCU",
        hm_member="m_puhCbf",
        hm_method="getCbf(absPartIdx, compID, trDepth)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="TRANSFORM_QUANT",
        description="Coded block flag indicating presence of one or more non-zero transform coefficient levels in the transform block."
    ),
    "transform_skip_flag": HevcSpecElement(
        name="transform_skip_flag",
        subsystem="TU",
        standard_section="7.3.8.8 / 7.4.9.8",
        descriptor="ae(v)",
        hm_class="TComTU",
        hm_member="rTu.isTransformSkip()",
        hm_method="rTu.isTransformSkip()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="TRANSFORM_QUANT",
        description="Specifies whether 2D transform is bypassed for 4x4 transform blocks in Intra or Inter mode."
    ),

    # ==========================================
    # In-Loop Filtering (DBF & SAO) - Section 8.7
    # ==========================================
    "boundary_strength": HevcSpecElement(
        name="boundary_strength",
        subsystem="Deblocking",
        standard_section="8.7.2.4",
        descriptor="derived",
        hm_class="TComLoopFilter",
        hm_member="bS",
        hm_method="xEdgeFilterLuma(...) / xEdgeFilterChroma(...)",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="DEBLOCKING_EDGE",
        description="Deblocking Boundary Strength bS in {0, 1, 2} determining strength of low-pass deblocking filter across 8x8 sample grids."
    ),
    "sao_type_idx": HevcSpecElement(
        name="sao_type_idx",
        subsystem="SAO",
        standard_section="7.3.8.3 / 8.7.3",
        descriptor="ae(v)",
        hm_class="TComSampleAdaptiveOffset",
        hm_member="saoType",
        hm_method="SAOBlkParam",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="SAO_DECISION",
        description="Specifies sample adaptive offset mode: 0=Disabled, 1=Band Offset (BO), 2=Edge Offset (EO)."
    ),

    # ==========================================
    # CABAC Entropy Engine - Section 9.3
    # ==========================================
    "cabac_bin": HevcSpecElement(
        name="cabac_bin",
        subsystem="CABAC",
        standard_section="9.3.2 / 9.3.3",
        descriptor="ae(v)",
        hm_class="TEncBinCABAC",
        hm_member="m_uiRange / m_uiValue",
        hm_method="encodeBin / encodeBinEP",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CABAC_BIN",
        description="Telemetry event emitted during encoder binarization, recording syntax name, bin value, context model state index, valMPS, and written bit count."
    ),
    "context_model_state": HevcSpecElement(
        name="context_model_state",
        subsystem="CABAC",
        standard_section="9.3.2 / HM ContextModel",
        descriptor="derived",
        hm_class="ContextModel",
        hm_member="m_ucState",
        hm_method="getState() / getMps()",
        status=AvailabilityStatus.IN_TRACE,
        trace_event="CABAC_BIN",
        description="7-bit context model state representing 6-bit transition state index pStateIdx (0..63) and 1-bit Most Probable Symbol (valMPS)."
    ),
}

def get_spec_dictionary() -> dict[str, HevcSpecElement]:
    """Returns the complete ITU-T H.265 / HM-18.0 specification dictionary"""
    return HEVC_SPEC_DICTIONARY

def get_spec_element(element_name: str) -> HevcSpecElement | None:
    """Finds an element by name (case-insensitive)"""
    key = element_name.lower().strip()
    for name, element in HEVC_SPEC_DICTIONARY.items():
        if name.lower() == key:
            return element
    return None

def get_elements_by_subsystem(subsystem: str) -> list[HevcSpecElement]:
    """Filters elements by functional HEVC subsystem"""
    key = subsystem.lower().strip()
    return [elem for elem in HEVC_SPEC_DICTIONARY.values() if elem.subsystem.lower() == key]

def get_elements_by_status(status: AvailabilityStatus) -> list[HevcSpecElement]:
    """Filters elements by operational availability status"""
    return [elem for elem in HEVC_SPEC_DICTIONARY.values() if elem.status == status]
