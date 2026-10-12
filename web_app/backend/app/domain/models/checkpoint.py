from pydantic import BaseModel, Field
from typing import Any

class BaseCheckpointEvent(BaseModel):
    poc: int = Field(default=0)
    ctu_x: int = Field(default=0)
    ctu_y: int = Field(default=0)
    cu_size: int = Field(default=8)
    event: str = Field(...)

# ==========================================
# CP_01_PARTITION Models
# ==========================================
class CUPartitionNode(BaseModel):
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
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 64
    event: str = "CTU_PARTITION"
    nodes: list[CUPartitionNode] = Field(default_factory=list)
    
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
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
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
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
    event: str = "RDO_INTRA_SEARCH"
    mode: int
    cost: float
    b_use_filter: bool = False
    
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
    tu_split: bool = False
    reconstructed_data: list[int] = Field(default_factory=list)
    reconstructed_resi: list[int] = Field(default_factory=list)

class ChromaCandidateInfo(BaseModel):
    """Allowed chroma mode candidate according to HM getAllowedChromaDir"""
    mode: int
    name: str                        # Planar, Vertical, Horizontal, DC, DM_CHROMA, or Angular 34
    is_dm: bool = False
    cost: float = 0.0
    rank: int = 1

class IntraPipelineFullResponse(BaseModel):
    """Complete 5-Stage Intra Prediction & RDO Search Pipeline Response"""
    poc: int = 0
    ctu_x: int = 0
    ctu_y: int = 0
    cu_size: int = 8
    best_luma_mode: int = 0
    best_luma_cost: float = 0.0
    best_chroma_mode: int = 0
    winner_mode: int = 0
    winner_cost: float = 0.0
    winner_direction: str = ""
    step1_reference: IntraRefCheckpoint
    step2_rmd: list[RmdModeItem] = Field(default_factory=list)
    step3_candidates: CandidateSelectionStep
    step4_rdo: list[RdoCandidateDetail] = Field(default_factory=list)
    step5_chroma: list[ChromaCandidateInfo] = Field(default_factory=list)

class CheckpointSummaryResponse(BaseModel):
    stage_id: str
    name: str
    description: str
    count: int
    summary_data: dict[str, Any] = Field(default_factory=dict)
