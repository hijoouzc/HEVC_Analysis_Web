import pytest
from pathlib import Path
from app.checkpoints.parsers.intra_search_parser import (
    derive_mpm,
    get_allowed_chroma_modes,
    get_top_k_threshold,
    build_intra_pipeline_data,
    assemble_pu_pred,
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


def test_build_intra_pipeline_with_real_cpp_events(sample_trace_file):
    """Verifies that real C++ HM telemetry replaces synthetic calculations."""
    raw_modes = TraceReader.read_all(sample_trace_file, event_filter="RDO_INTRA_SEARCH")
    parsed_modes = [intra_search_parser.parse_event(m) for m in raw_modes]

    dummy_ref = IntraRefCheckpoint(
        poc=0, ctu_x=0, ctu_y=0, cu_size=8,
        ref_unfilt_top=[128]*17, ref_unfilt_left=[128]*17,
        ref_filt_top=[128]*17, ref_filt_left=[128]*17,
        luma_ref_count=17
    )

    mpm_raw = {
        "mpm_modes": [0, 1, 26],
        "left_mode": 0,
        "above_mode": 1,
        "candidate_modes": [0, 1, 26, 2, 3, 4, 5, 6],
        "top_k_modes": [0, 1, 26, 2, 3, 4, 5, 6]
    }

    full_rdo_raw = [
        {
            "mode": 0,
            "rank_rdo": 1,
            "cost_rdo": 1270.37,
            "sse": 512,
            "bits": 132.0,
            "is_winner": True,
            "reconstructed_data": [140] * 64,
            "reconstructed_resi": [12] * 64
        }
    ]

    chroma_raw = {
        "best_luma_mode": 0,
        "best_chroma_mode": 36,
        "best_chroma_cost": 459.3,
        "best_chroma_dist": 218,
        "candidates": [
            {"mode": 0, "cost": 465.0, "dist": 218, "bits": 43.0, "rank": 1},
            {"mode": 36, "cost": 459.3, "dist": 218, "bits": 42.0, "rank": 2}
        ],
        "reco_u": [99] * 16,
        "reco_v": [110] * 16
    }

    resp = build_intra_pipeline_data(
        modes=parsed_modes,
        ref_checkpoint=dummy_ref,
        cu_size=8,
        ctu_x=0,
        ctu_y=0,
        poc=0,
        mpm_raw_event=mpm_raw,
        full_rdo_events=full_rdo_raw,
        chroma_raw_event=chroma_raw
    )

    # Step 3: MPM derived from C++
    assert resp.step3_candidates.mpm_modes == [0, 1, 26]
    assert resp.step3_candidates.candidate_modes == [0, 1, 26, 2, 3, 4, 5, 6]
    assert "HM C++ Derived" in resp.step3_candidates.derivation.derivation_rule

    # Step 4: True Full RDO from C++ (No synthetic math!)
    assert len(resp.step4_rdo) == 1
    assert resp.step4_rdo[0].cost_rdo == 1270.37
    assert resp.step4_rdo[0].sse == 512
    assert resp.step4_rdo[0].bits == 132.0
    assert resp.step4_rdo[0].reconstructed_data == [140] * 64
    assert resp.step4_rdo[0].reconstructed_resi == [12] * 64

    # Step 5: True Chroma search from C++
    assert resp.best_chroma_mode == 36
    assert len(resp.step5_chroma) == 2
    assert resp.step5_chroma[0].cost == 465.0
    assert resp.step5_chroma[0].dist == 218
    assert resp.step5_chroma[0].bits == 43.0
    assert resp.reco_u == [99] * 16
    assert resp.reco_v == [110] * 16

def test_all_pu_sizes_pipeline_support():
    """Verifies that all HEVC PU block sizes (64, 32, 16, 8, 4) conform to HM-18.0 standards"""
    for sz in [64, 32, 16, 8, 4]:
        expected_k = 8 if sz <= 8 else 3
        assert get_top_k_threshold(sz) == expected_k

        ref_len = 2 * sz + 1
        num_pix = sz * sz
        dummy_ref = IntraRefCheckpoint(
            poc=0, ctu_x=0, ctu_y=0, cu_size=sz,
            ref_unfilt_top=[128] * ref_len,
            ref_unfilt_left=[128] * ref_len,
            ref_filt_top=[128] * ref_len,
            ref_filt_left=[128] * ref_len
        )
        sample_modes = [
            intra_search_parser.parse_event({
                "event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0,
                "pu_size": sz, "cu_size": sz, "mode": m, "cost": 100.0 + m,
                "org_data": [128] * num_pix, "pred_data": [128] * num_pix, "resi_data": [0] * num_pix,
                "ref_top": [128] * ref_len, "ref_left": [128] * ref_len, "b_use_filter": False
            })
            for m in range(35)
        ]
        resp = build_intra_pipeline_data(
            modes=sample_modes,
            ref_checkpoint=dummy_ref,
            cu_size=sz,
            ctu_x=0,
            ctu_y=0,
            poc=0
        )
        assert resp.cu_size == sz
        assert resp.step3_candidates.k_threshold == expected_k
        assert len(resp.step2_rmd) == 35
        assert len(resp.step1_reference.ref_unfilt_top) == ref_len

def test_assemble_pu_pred_single_tu():
    """Single TU matching full PU size (8x8) -> 64 samples perfectly aligned"""
    tu_events = [{
        "tu_x": 0, "tu_y": 0, "tu_width": 8, "tu_height": 8,
        "pred_data": list(range(64))
    }]
    assembled = assemble_pu_pred(0, 0, 8, tu_events)
    assert assembled is not None
    assert len(assembled) == 64
    assert assembled == list(range(64))

def test_assemble_pu_pred_split_four_tus():
    """8x8 PU partitioned into four 4x4 TUs in quadtree layout"""
    # TL: (0, 0), TR: (4, 0), BL: (0, 4), BR: (4, 4)
    tu_tl = {"tu_x": 16, "tu_y": 32, "tu_width": 4, "tu_height": 4, "pred_data": [1] * 16}
    tu_tr = {"tu_x": 20, "tu_y": 32, "tu_width": 4, "tu_height": 4, "pred_data": [2] * 16}
    tu_bl = {"tu_x": 16, "tu_y": 36, "tu_width": 4, "tu_height": 4, "pred_data": [3] * 16}
    tu_br = {"tu_x": 20, "tu_y": 36, "tu_width": 4, "tu_height": 4, "pred_data": [4] * 16}

    assembled = assemble_pu_pred(16, 32, 8, [tu_tl, tu_tr, tu_bl, tu_br])
    assert assembled is not None
    assert len(assembled) == 64
    # Check row 0: first 4 elements are 1, next 4 are 2
    assert assembled[0:4] == [1, 1, 1, 1]
    assert assembled[4:8] == [2, 2, 2, 2]
    # Check row 4: first 4 elements are 3, next 4 are 4
    assert assembled[32:36] == [3, 3, 3, 3]
    assert assembled[36:40] == [4, 4, 4, 4]

def test_assemble_pu_pred_incomplete_or_invalid():
    """Incomplete coverage, wrong dimensions, or out of bounds returns None"""
    # Only 3 TUs for 8x8 (missing BR)
    tu_tl = {"tu_x": 0, "tu_y": 0, "tu_width": 4, "tu_height": 4, "pred_data": [1] * 16}
    tu_tr = {"tu_x": 4, "tu_y": 0, "tu_width": 4, "tu_height": 4, "pred_data": [2] * 16}
    tu_bl = {"tu_x": 0, "tu_y": 4, "tu_width": 4, "tu_height": 4, "pred_data": [3] * 16}
    assert assemble_pu_pred(0, 0, 8, [tu_tl, tu_tr, tu_bl]) is None

    # Overlapping TUs
    tu_overlap = {"tu_x": 0, "tu_y": 0, "tu_width": 4, "tu_height": 4, "pred_data": [5] * 16}
    assert assemble_pu_pred(0, 0, 8, [tu_tl, tu_overlap, tu_tr, tu_bl]) is None

    # Empty list
    assert assemble_pu_pred(0, 0, 8, []) is None

def test_intra_pipeline_tu_pred_assembly_and_winner():
    """Verify that tu_pred_events are matched by trial_id, assembled, and winner is min(cost_rdo)"""
    dummy_ref = IntraRefCheckpoint(
        poc=0, ctu_x=0, ctu_y=0, cu_size=8,
        ref_unfilt_top=[128] * 17, ref_unfilt_left=[128] * 17,
        ref_filt_top=[128] * 17, ref_filt_left=[128] * 17
    )
    modes = [
        intra_search_parser.parse_event({
            "event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0,
            "pu_size": 8, "cu_size": 8, "mode": m, "cost": 1000.0 + m,
            "org_data": [128] * 64, "pred_data": [128] * 64, "resi_data": [0] * 64,
            "ref_top": [128] * 17, "ref_left": [128] * 17, "b_use_filter": False
        })
        for m in range(35)
    ]
    # Two full RDO candidate events: candidate 1 (mode 0, cost 500), candidate 2 (mode 26, cost 350 -> true winner)
    full_rdo_events = [
        {
            "event": "INTRA_FULL_RDO", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 0, "pu_size": 8,
            "mode": 0, "cand_rank": 1, "qp": 32, "trial_id": 101, "cost_rdo": 500.0,
            "sse": 400, "bits": 31.25, "rdo_rate_est": 31.25, "is_winner": True
        },
        {
            "event": "INTRA_FULL_RDO", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 0, "pu_size": 8,
            "mode": 26, "cand_rank": 2, "qp": 32, "trial_id": 102, "cost_rdo": 350.0,
            "sse": 250, "bits": 31.25, "rdo_rate_est": 31.25, "is_winner": True
        }
    ]
    tu_pred_events = [
        {
            "event": "INTRA_TU_PRED", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 0, "pu_size": 8,
            "cand_rank": 1, "cand_mode": 0, "qp": 32, "trial_id": 101,
            "tu_x": 0, "tu_y": 0, "tu_width": 8, "tu_height": 8, "tu_depth": 0,
            "pred_data": [77] * 64
        },
        {
            "event": "INTRA_TU_PRED", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 0, "pu_size": 8,
            "cand_rank": 2, "cand_mode": 26, "qp": 32, "trial_id": 102,
            "tu_x": 0, "tu_y": 0, "tu_width": 8, "tu_height": 8, "tu_depth": 0,
            "pred_data": [88] * 64
        }
    ]

    resp = build_intra_pipeline_data(
        modes=modes,
        ref_checkpoint=dummy_ref,
        cu_size=8,
        ctu_x=0,
        ctu_y=0,
        poc=0,
        full_rdo_events=full_rdo_events,
        tu_pred_events=tu_pred_events
    )

    assert len(resp.step4_rdo) == 2
    cand1 = resp.step4_rdo[0]
    cand2 = resp.step4_rdo[1]

    assert cand1.mode == 0
    assert cand1.trial_id == 101
    assert cand1.pred_data == [77] * 64
    assert cand1.is_winner is False

    assert cand2.mode == 26
    assert cand2.trial_id == 102
    assert cand2.pred_data == [88] * 64
    assert cand2.is_winner is True  # True group winner because 350.0 < 500.0

    assert resp.winner_mode == 26
    assert resp.winner_cost == 350.0


