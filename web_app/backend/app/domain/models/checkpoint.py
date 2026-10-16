from pydantic import BaseModel, Field, ConfigDict
from typing import Any

class BaseCheckpointEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    poc: int = Field(default=0)
    ctu_x: int = Field(default=0)
    ctu_y: int = Field(default=0)
    cu_size: int = Field(default=8)
    event: str = Field(...)

# ==========================================
# CP_01_PARTITION Models
# ==========================================
class CUPartitionNode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    depth: int
    x: int
    y: int
    width: int
    height: int
    split: bool
    mode: str | None = None          # INTRA, INTER, SKIP
    intra_dir: int | None = None     # Mode index 0-34 if INTRA
    qp: int | None = None
    cost: float | None = None
    abs_x: int | None = None
    abs_y: int | None = None
    rel_x: int | None = None
    rel_y: int | None = None

class CTUPartitionCheckpoint(BaseModel):
    """CP_01_PARTITION: Quadtree partition of the CTU into CUs"""
    model_config = ConfigDict(extra="ignore")
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 64
    event: str = "CTU_PARTITION"
    nodes: list[CUPartitionNode] = Field(default_factory=list)
    ctu_actual_bits: int | None = None
    ctu_rs_addr: int | None = None
    
    # Computed QuadTree statistics
    total_nodes: int = 0
    leaf_nodes: int = 0
    max_depth: int = 0
    split_count: int = 0

# ==========================================
# CP_02_INTRA_REF Models
# ==========================================
class IntraRefCheckpoint(BaseModel):
    """CP_02_INTRA_REF: Raw vs Filtered reference sample arrays (4N+1)"""
    model_config = ConfigDict(extra="ignore")
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
    pu_x: int | None = None
    pu_y: int | None = None
    cu_x: int | None = None
    cu_y: int | None = None
    event: str = "INTRA_REF_SAMPLES"
    strong_smoothing: bool = False
    
    # Luma Unfiltered vs Filtered 1D arrays (2N + 1 each)
    ref_unfilt_top: list[int] = Field(default_factory=list)
    ref_unfilt_left: list[int] = Field(default_factory=list)
    ref_filt_top: list[int] = Field(default_factory=list)
    ref_filt_left: list[int] = Field(default_factory=list)
    
    # Chroma Unfiltered vs Filtered 1D arrays
    ref_unfilt_top_u: list[int] = Field(default_factory=list)
    ref_unfilt_left_u: list[int] = Field(default_factory=list)
    ref_unfilt_top_v: list[int] = Field(default_factory=list)
    ref_unfilt_left_v: list[int] = Field(default_factory=list)
    ref_filt_top_u: list[int] = Field(default_factory=list)
    ref_filt_left_u: list[int] = Field(default_factory=list)
    ref_filt_top_v: list[int] = Field(default_factory=list)
    ref_filt_left_v: list[int] = Field(default_factory=list)
    
    # Derived statistics
    luma_ref_count: int = 0
    filter_applied: bool = True
    max_filter_diff: int = 0
    avg_filter_diff: float = 0.0

# ==========================================
# CP_03_INTRA_SEARCH Models
# ==========================================
class IntraModeData(BaseModel):
    """CP_03_INTRA_SEARCH: A single tested intra prediction mode"""
    model_config = ConfigDict(extra="ignore")
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
    pu_x: int | None = None
    pu_y: int | None = None
    cu_x: int | None = None
    cu_y: int | None = None
    event: str = "RDO_INTRA_SEARCH"
    mode: int
    cost: float
    b_use_filter: bool = False
    qp: int | None = None
    trial_id: int | None = None
    
    # HEVC Angular metadata
    category: str = "ANGULAR"        # PLANAR, DC, ANGULAR
    direction_name: str = ""         # e.g. "Planar", "DC", "Horizontal", "Vertical"
    angle_offset: int = 0            # standard intraPredAngle: -32 .. +32
    rank: int = 0                    # 1 = best mode
    cost_delta: float = 0.0          # cost - best_cost
    
    # Luma 1D arrays (row-major N x N)
    org_data: list[int] = Field(default_factory=list)
    pred_data: list[int] = Field(default_factory=list)
    resi_data: list[int] = Field(default_factory=list)
    ref_top: list[int] = Field(default_factory=list)
    ref_left: list[int] = Field(default_factory=list)
    
    # Chroma 1D arrays
    org_u: list[int] = Field(default_factory=list)
    org_v: list[int] = Field(default_factory=list)
    pred_u: list[int] = Field(default_factory=list)
    pred_v: list[int] = Field(default_factory=list)
    resi_u: list[int] = Field(default_factory=list)
    resi_v: list[int] = Field(default_factory=list)
    ref_top_u: list[int] = Field(default_factory=list)
    ref_left_u: list[int] = Field(default_factory=list)
    ref_top_v: list[int] = Field(default_factory=list)
    ref_left_v: list[int] = Field(default_factory=list)

class IntraSearchSummary(BaseModel):
    best_mode: int
    best_cost: float
    total_modes: int
    modes: list[int]
    min_cost: float
    max_cost: float
    cu_size: int
    ctu_x: int
    ctu_y: int

class IntraComparisonResult(BaseModel):
    """Detailed differential comparison between two Intra prediction candidate modes"""
    mode_a: int
    mode_b: int
    direction_a: str
    direction_b: str
    cost_a: float
    cost_b: float
    cost_difference: float           # cost_b - cost_a
    better_mode: int
    pixel_sad_diff: int              # sum(|pred_a - pred_b|)
    pixel_diff_matrix: list[int]     # pred_a - pred_b (signed)
    resi_diff_matrix: list[int] = Field(default_factory=list) # resi_a - resi_b
    sse_a: int = 0                   # sum(resi_a^2)
    sse_b: int = 0                   # sum(resi_b^2)
    sse_diff: int = 0                # sse_b - sse_a
    cu_size: int

# ==========================================
# CP_06_TRANSFORM & CP_07_QUANT Models
# ==========================================
class TransformQuantCheckpoint(BaseModel):
    """CP_06_TRANSFORM & CP_07_QUANT: Residual, DCT coefficients, and Quantized coefficients"""
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    tu_x: int = 0
    tu_y: int = 0
    width: int = 8
    height: int = 8
    cu_size: int = 8
    event: str = "TRANSFORM_QUANT"
    component: str = "Y"             # Y, Cb, Cr
    qp: int = 32
    
    # 2D matrices serialized as row-major flat lists
    resi_matrix: list[int] = Field(default_factory=list)
    dct_coeff: list[int] = Field(default_factory=list)
    quant_coeff: list[int] = Field(default_factory=list)
    sig_coeff_count: int = 0
    
    # Derived frequency & compression analysis
    dc_coeff: int = 0
    energy_compaction_ratio: float = 0.0  # (DC^2 / Total Energy)
    sparsity_ratio: float = 0.0           # zero_coeffs / total_coeffs

    # Frequency & Transform Domain flags
    is_dst: bool = False
    is_transform_skip: bool = False
    tu_depth: int = 0
    cu_x: int | None = None
    cu_y: int | None = None
    cu_depth: int | None = None
    intra_mode: int | None = None
    pred_mode: str = "INTRA"
    dequant_coeff: list[int] = Field(default_factory=list)
    reco_resi: list[int] = Field(default_factory=list)

# ==========================================
# Intra Prediction Pipeline Models (CP_03 Expanded)
# ==========================================
class RmdModeItem(BaseModel):
    """A mode evaluated during Rough Mode Decision (RMD) phase"""
    mode: int
    category: str                    # PLANAR, DC, ANGULAR
    direction_name: str
    angle_offset: int
    cost: float                      # SATD + lambda_had * mode_bits
    rank: int                        # 1 to 35
    selected_in_rmd: bool = False    # True if within top K candidates
    is_mpm: bool = False             # True if in 3 MPMs
    mpm_index: int | None = None     # 0, 1, 2 or None

class MpmDerivationInfo(BaseModel):
    """Most Probable Modes (MPM) derivation metadata adhering to H.265 Section 8.4.2"""
    left_mode: int | None = None
    above_mode: int | None = None
    mpm_modes: list[int] = Field(default_factory=list) # exactly 3 modes
    derivation_rule: str = ""

class CandidateSelectionStep(BaseModel):
    """Candidate pruning result: Top K from RMD + 3 MPMs"""
    k_threshold: int = 8             # 8 for 4x4/8x8, 3 for 16x16/32x32/64x64
    top_k_modes: list[int] = Field(default_factory=list)
    mpm_modes: list[int] = Field(default_factory=list)
    candidate_modes: list[int] = Field(default_factory=list) # Unified ordered candidates for Full RDO
    derivation: MpmDerivationInfo | None = None

class RdoCandidateDetail(BaseModel):
    """Full RDO evaluation for a candidate mode"""
    mode: int
    direction_name: str
    is_mpm: bool = False
    rank_rdo: int = 1
    cost_rdo: float = 0.0            # True J_RDO = SSE + lambda * bits
    sse: int = 0
    distortion: float = 0.0
    bits: float = 0.0
    rdo_rate_est: float = 0.0        # Rate estimate (J - D)/lambda
    qp: int | None = None
    trial_id: int | None = None
    tu_split: bool = False
    pred_data: list[int] = Field(default_factory=list) # Discrete Luma Y prediction matrix
    reconstructed_data: list[int] = Field(default_factory=list)
    reconstructed_resi: list[int] = Field(default_factory=list)
    data_source: str = "HM_TRACE"    # "HM_TRACE" or "FALLBACK_DERIVED"
    is_fallback: bool = False
    is_winner: bool = False

class ChromaCandidateInfo(BaseModel):
    """Allowed chroma mode candidate according to HM getAllowedChromaDir"""
    mode: int
    name: str                        # Planar, Vertical, Horizontal, DC, DM_CHROMA, or Angular 34
    is_dm: bool = False
    cost: float = 0.0
    dist: int = 0
    bits: float = 0.0
    rank: int = 1
    data_source: str = "HM_TRACE"    # "HM_TRACE" or "FALLBACK_DERIVED"
    is_fallback: bool = False

class IntraPipelineFullResponse(BaseModel):
    """Complete 5-Stage Intra Prediction & RDO Search Pipeline Response"""
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
    cu_x: int | None = None
    cu_y: int | None = None
    data_source: str = "HM_TRACE"    # "HM_TRACE" or "FALLBACK_DERIVED"
    is_fallback: bool = False
    best_luma_mode: int = 0
    best_luma_cost: float = 0.0
    best_chroma_mode: int = 0
    winner_mode: int = 0
    winner_cost: float = 0.0
    winner_direction: str = ""
    reco_u: list[int] = Field(default_factory=list)
    reco_v: list[int] = Field(default_factory=list)
    step1_reference: IntraRefCheckpoint
    step2_rmd: list[RmdModeItem] = Field(default_factory=list)
    step3_candidates: CandidateSelectionStep
    step4_rdo: list[RdoCandidateDetail] = Field(default_factory=list)
    step5_chroma: list[ChromaCandidateInfo] = Field(default_factory=list)

# ==========================================
# CU_RDO_DECISION Checkpoint Model (HM xCheckBestMode)
# ==========================================
class BranchRdoDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cost: float = 0.0
    dist: int = 0
    bits: int = 0
    qp: int = -1
    mode: int | None = None

class CuRdoDecisionCheckpoint(BaseModel):
    """HM-18.0 Ground Truth RDO decision at a specific CU node: costNoSplit vs costSplit"""
    model_config = ConfigDict(extra="ignore")
    event: str = "CU_RDO_DECISION"
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_x: int = 0
    cu_y: int = 0
    cu_size: int = 64
    depth: int = 0
    cost_nosplit: float = 0.0
    cost_split: float = 0.0
    split_decision: bool = False
    best_mode: int = -1
    stage: str = "CP_01_CU_QUADTREE_RDO"
    split_evaluated: bool = True
    winner_cost: float = 0.0
    nosplit: BranchRdoDetail | None = None
    split: BranchRdoDetail | None = None

class CheckpointSummaryResponse(BaseModel):
    stage_id: str
    name: str
    description: str
    count: int
    summary_data: dict[str, Any] = Field(default_factory=dict)

# ==========================================
# CP_00_FRAME_GOP Models
# ==========================================
class FrameGopCheckpoint(BaseModel):
    poc: int = 0
    slice_type: str = "I"
    qp: int = 22
    temporal_id: int = 0
    ref_l0: list[int] = Field(default_factory=list)
    ref_l1: list[int] = Field(default_factory=list)

# ==========================================
# CP_03_INTER_SEARCH Models
# ==========================================
class InterSearchCheckpoint(BaseModel):
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_x: int = 0
    cu_y: int = 0
    cu_size: int = 16
    depth: int = 0
    pu_idx: int = 0
    pu_x: int = 0
    pu_y: int = 0
    pu_w: int = 16
    pu_h: int = 16
    ref_list: int = 0
    ref_idx: int = 0
    mvp_idx: int = 0
    mv_x: int = 0
    mv_y: int = 0
    mvd_x: int = 0
    mvd_y: int = 0
    cost: float = 0.0
    dist: int = 0
    bits: int = 0

# ==========================================
# CP_05_RECON_PICTURE Models
# ==========================================
class ReconPictureCheckpoint(BaseModel):
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_x: int = 0
    cu_y: int = 0
    cu_w: int = 16
    cu_h: int = 16
    reco_y: list[int] = Field(default_factory=list)
    reco_u: list[int] = Field(default_factory=list)
    reco_v: list[int] = Field(default_factory=list)

# ==========================================
# CP_06_INLOOP_FILTER Models
# ==========================================
class DeblockingEdgeCheckpoint(BaseModel):
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    edge_x: int = 0
    edge_y: int = 0
    dir: int = 0                     # 0: vertical, 1: horizontal
    bs: int = 0                      # Boundary strength (0, 1, 2)
    beta: int = 0
    tc: int = 0
    p_before: list[int] = Field(default_factory=list)
    q_before: list[int] = Field(default_factory=list)
    p_after: list[int] = Field(default_factory=list)
    q_after: list[int] = Field(default_factory=list)

class SaoDecisionCheckpoint(BaseModel):
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    sao_mode: int = 0                 # 0: None, 1: BO, 2-5: EO, Merge
    offset_y: list[int] = Field(default_factory=list)
    offset_u: list[int] = Field(default_factory=list)
    offset_v: list[int] = Field(default_factory=list)

class InLoopFilterFullResponse(BaseModel):
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    edges: list[DeblockingEdgeCheckpoint] = Field(default_factory=list)
    sao: SaoDecisionCheckpoint | None = None
    total_edges: int = 0
    bs2_edges: int = 0
    bs1_edges: int = 0

# ==========================================
# CP_07_CABAC_ENTROPY Models
# ==========================================
class CabacBinCheckpoint(BaseModel):
    syntax_element: str
    bin: int
    ctx_idx: int
    p_state_idx: int
    val_mps: int
    bits: int = 1

class CabacEntropyFullResponse(BaseModel):
    bins: list[CabacBinCheckpoint] = Field(default_factory=list)
    total_bins: int = 0
    total_bits: int = 0
    syntax_breakdown: dict[str, int] = Field(default_factory=dict)

