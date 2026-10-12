import pytest
from pathlib import Path
from app.checkpoints.parsers.intra_search_parser import (
    derive_mpm,
    get_allowed_chroma_modes,
    get_top_k_threshold,
    build_intra_pipeline_data,
    intra_search_parser
)
from app.storage.trace_reader import TraceReader
from app.domain.models.checkpoint import (
    IntraRefCheckpoint,
    IntraPipelineFullResponse
)

# =============================================================================
# 1. Ground Truth Test: MPM Derivation (H.265 Section 8.4.2 & HM TComDataCU)
# =============================================================================
def test_mpm_derivation_equal_non_angular():
    """When Left == Above and modes are Planar(0) or DC(1) -> [0, 1, 26]"""
    # Planar == Planar
    mpms_planar, rule = derive_mpm(0, 0)
    assert mpms_planar == [0, 1, 26], f"Expected [0, 1, 26], got {mpms_planar}"
    assert "Non-Angular" in rule

    # DC == DC
    mpms_dc, rule = derive_mpm(1, 1)
    assert mpms_dc == [0, 1, 26], f"Expected [0, 1, 26], got {mpms_dc}"

def test_mpm_derivation_equal_angular():
    """
    When Left == Above and mode A > 1 (Angular):
    cand0 = A
    cand1 = ((A + 29) % 32) + 2
    cand2 = ((A - 1) % 32) + 2
    """
    # Mode 2 (Diagonal Bottom-Left)
    mpms_2, rule = derive_mpm(2, 2)
    expected_2 = [2, ((2 + 29) % 32) + 2, ((2 - 1) % 32) + 2] # [2, 33, 3]
    assert mpms_2 == expected_2, f"Expected {expected_2}, got {mpms_2}"
    assert mpms_2 == [2, 33, 3]
    assert "Angular" in rule

    # Mode 26 (Vertical)
    mpms_26, rule = derive_mpm(26, 26)
    expected_26 = [26, ((26 + 29) % 32) + 2, ((26 - 1) % 32) + 2] # [26, 25, 27]
    assert mpms_26 == expected_26, f"Expected {expected_26}, got {mpms_26}"
    assert mpms_26 == [26, 25, 27]

    # Mode 10 (Horizontal)
    mpms_10, rule = derive_mpm(10, 10)
    expected_10 = [10, ((10 + 29) % 32) + 2, ((10 - 1) % 32) + 2] # [10, 9, 11]
    assert mpms_10 == expected_10, f"Expected {expected_10}, got {mpms_10}"
    assert mpms_10 == [10, 9, 11]

def test_mpm_derivation_different_both_non_planar():
    """When Left != Above and neither is Planar(0) -> [Left, Above, Planar(0)]"""
    mpms, rule = derive_mpm(10, 26)
    assert mpms == [10, 26, 0]
    assert "Both Non-Planar" in rule

def test_mpm_derivation_different_one_planar():
    """When Left != Above and one is Planar(0): cand2 = Ver(26) if (A+B)<2 else DC(1)"""
    # Planar(0) and Vertical(26): sum=26 >= 2 -> cand2 is DC(1)
    mpms_ver, rule = derive_mpm(0, 26)
    assert mpms_ver == [0, 26, 1]

    # Planar(0) and DC(1): sum=1 < 2 -> cand2 is Ver(26)
    mpms_dc, rule = derive_mpm(0, 1)
    assert mpms_dc == [0, 1, 26]

def test_mpm_derivation_unspecified_fallback():
    """Unavailable or out-of-range neighbors default to DC(1) -> [0, 1, 26]"""
    mpms_none, _ = derive_mpm(None, None)
    assert mpms_none == [0, 1, 26]

    mpms_invalid, _ = derive_mpm(-1, 99)
    assert mpms_invalid == [0, 1, 26]


# =============================================================================
# 2. Ground Truth Test: Allowed Chroma Modes (H.265 Section 8.4.3 & HM getAllowedChromaDir)
# =============================================================================
def test_allowed_chroma_modes_no_duplicate():
    """When Luma mode is not in [0, 26, 10, 1], base modes remain unchanged + DM_CHROMA"""
    chroma_cands = get_allowed_chroma_modes(luma_mode=18)
    modes = [c["mode"] for c in chroma_cands]
    assert modes == [0, 26, 10, 1, 18] # [Planar, Ver, Hor, DC, DM_CHROMA]
    assert chroma_cands[4]["is_dm"] is True
    assert "DM_CHROMA" in chroma_cands[4]["name"]

def test_allowed_chroma_modes_substitute_duplicates():
    """When Luma mode matches a base mode, the duplicate is replaced by Angular 34"""
    # Luma is Planar (0): replaces index 0
    chroma_0 = get_allowed_chroma_modes(luma_mode=0)
    modes_0 = [c["mode"] for c in chroma_0]
    assert modes_0 == [34, 26, 10, 1, 0]

    # Luma is Vertical (26): replaces index 1
    chroma_26 = get_allowed_chroma_modes(luma_mode=26)
    modes_26 = [c["mode"] for c in chroma_26]
    assert modes_26 == [0, 34, 10, 1, 26]

    # Luma is Horizontal (10): replaces index 2
    chroma_10 = get_allowed_chroma_modes(luma_mode=10)
    modes_10 = [c["mode"] for c in chroma_10]
    assert modes_10 == [0, 26, 34, 1, 10]

    # Luma is DC (1): replaces index 3
    chroma_1 = get_allowed_chroma_modes(luma_mode=1)
    modes_1 = [c["mode"] for c in chroma_1]
    assert modes_1 == [0, 26, 10, 34, 1]


# =============================================================================
# 3. Ground Truth Test: Top K Thresholds (HM g_aucIntraModeNumFast_UseMPM)
# =============================================================================
def test_top_k_thresholds():
    assert get_top_k_threshold(4) == 8
    assert get_top_k_threshold(8) == 8
    assert get_top_k_threshold(16) == 3
    assert get_top_k_threshold(32) == 3
    assert get_top_k_threshold(64) == 3


# =============================================================================
# 4. End-to-End Pipeline Data Construction from Sample Trace
# =============================================================================
def test_build_intra_pipeline_data_from_trace(sample_trace_file):
    raw_modes = TraceReader.read_all(sample_trace_file, event_filter="RDO_INTRA_SEARCH")
    assert len(raw_modes) == 35, "Sample trace must contain exactly 35 RDO_INTRA_SEARCH modes"

    parsed_modes = [intra_search_parser.parse_event(m) for m in raw_modes]

    dummy_ref = IntraRefCheckpoint(
        poc=0, ctu_x=0, ctu_y=0, cu_size=8,
        ref_unfilt_top=[128]*17, ref_unfilt_left=[128]*17,
        ref_filt_top=[128]*17, ref_filt_left=[128]*17,
        luma_ref_count=17
    )

    pipeline_resp = build_intra_pipeline_data(
        modes=parsed_modes,
        ref_checkpoint=dummy_ref,
        cu_size=8,
        ctu_x=0,
        ctu_y=0,
        poc=0,
        left_mode=0,
        above_mode=26
    )

    assert isinstance(pipeline_resp, IntraPipelineFullResponse)
    assert pipeline_resp.cu_size == 8

    # Step 1: Reference
    assert len(pipeline_resp.step1_reference.ref_unfilt_top) == 17

    # Step 2: RMD (35 modes)
    assert len(pipeline_resp.step2_rmd) == 35
    top_k_selected = [m for m in pipeline_resp.step2_rmd if m.selected_in_rmd]
    assert len(top_k_selected) == 8, "CU size 8x8 must select exactly 8 modes in RMD"

    # Step 3: Candidates & MPM
    assert pipeline_resp.step3_candidates.k_threshold == 8
    assert pipeline_resp.step3_candidates.mpm_modes == [0, 26, 1]
    assert len(pipeline_resp.step3_candidates.candidate_modes) >= 8
    # Ensure MPMs are included in candidates
    for mpm in [0, 26, 1]:
        assert mpm in pipeline_resp.step3_candidates.candidate_modes

    # Step 4: Full RDO candidate details
    assert len(pipeline_resp.step4_rdo) == len(pipeline_resp.step3_candidates.candidate_modes)
    for cand in pipeline_resp.step4_rdo:
        assert len(cand.reconstructed_data) == 64 # 8x8 block
        assert cand.rank_rdo >= 1

    # Step 5: Chroma & Winner
    assert len(pipeline_resp.step5_chroma) == 5
    assert pipeline_resp.winner_mode == pipeline_resp.best_luma_mode
    assert pipeline_resp.winner_cost == pipeline_resp.best_luma_cost
