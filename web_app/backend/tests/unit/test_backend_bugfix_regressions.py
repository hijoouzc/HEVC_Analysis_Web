"""Regression tests covering real HM-18.0 telemetry schemas, caching, colorimetry, job persistence, and HTTP validation."""

import asyncio
import json
from pathlib import Path
from PIL import Image
import pytest

from app.api.v1.endpoints import jobs as jobs_endpoint
from app.checkpoints.parsers.inloop_filter_parser import (
    deblocking_edge_parser,
    sao_decision_parser,
)
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.checkpoints.parsers.intra_search_parser import build_intra_pipeline_data
from app.checkpoints.registry import checkpoint_registry
from app.domain.exceptions import InvalidInputError
from app.domain.models.checkpoint import IntraModeData
from app.domain.models.roi import FrameMetadata, ROICoordinates
from app.engine.image_processor import image_processor
from app.services import job_manager as job_manager_mod
from app.services.job_manager import JobManager
from app.services.stages.filter_stage import FilterStageService
from app.services.stages.intra_stage import IntraStageService
from app.storage.session_manager import SessionManager
from app.storage.trace_reader import TraceReader


# ---------------------------------------------------------------------------
# 1. Real HM-18.0 In-Loop Filter Schemas (DEBLOCKING_EDGE & SAO_DECISION)
# ---------------------------------------------------------------------------
def test_deblocking_and_sao_parsers_real_hm_keys():
    """DeblockingEdgeParser and SaoDecisionParser handle real VisualDumper C++ keys."""
    dbf_ver = deblocking_edge_parser.parse_event({
        "event": "DEBLOCKING_EDGE",
        "poc": 1,
        "ctu_x": 0,
        "ctu_y": 0,
        "edge_type": 0,
        "bS": 2,
        "edge_x": 8,
        "edge_y": 0,
        "tc": 2,
        "beta": 6,
        "p_samples": [100, 102, 104, 105],
        "q_samples": [110, 112, 114, 116],
    })
    assert dbf_ver.poc == 1
    assert dbf_ver.dir == 0
    assert dbf_ver.bs == 2
    assert dbf_ver.p_before == [100, 102, 104, 105]
    assert dbf_ver.q_before == [110, 112, 114, 116]

    sao_bo = sao_decision_parser.parse_event({
        "event": "SAO_DECISION",
        "poc": 0,
        "ctu_x": 0,
        "ctu_y": 0,
        "sao_type_y": 4,
        "offsets_y": [1, 2, -1, 0],
        "offsets_u": [0, 1, 0, 0],
        "offsets_v": [-1, 0, 0, 1],
    })
    assert sao_bo.sao_mode == 1  # HM type 4 -> Band Offset (1)
    assert sao_bo.offset_y == [1, 2, -1, 0]
    assert sao_bo.offset_u == [0, 1, 0, 0]
    assert sao_bo.offset_v == [-1, 0, 0, 1]

    assert sao_decision_parser.parse_event({"sao_type_y": -1}).sao_mode == 0
    assert sao_decision_parser.parse_event({"sao_type_y": 2}).sao_mode == 4


def test_filter_stage_parses_real_medium_fixture(tmp_path, monkeypatch):
    """FilterStageService reads real medium/trace.jsonl DBF & SAO events cleanly."""
    fixture_trace = (
        Path(__file__).resolve().parents[1] / "benchmark" / "fixtures" / "medium" / "trace.jsonl"
    )
    if not fixture_trace.exists():
        pytest.skip("medium benchmark trace fixture not found")

    sm = SessionManager(base_sessions_dir=tmp_path)
    monkeypatch.setattr(job_manager_mod, "session_manager", sm)
    jm = JobManager()
    reader = TraceReader()
    svc = FilterStageService(sm, reader, checkpoint_registry, jm)

    job_id = sm.create_session("filter_real_fixture", run_cleanup=False)
    sm.get_trace_path(job_id).write_text(fixture_trace.read_text(encoding="utf-8"), encoding="utf-8")

    resp = svc.get_inloop_filter_data(job_id)
    assert resp.total_edges > 0
    assert resp.bs2_edges > 0
    assert any(edge.p_before and edge.q_before for edge in resp.edges)
    assert resp.sao is not None


# ---------------------------------------------------------------------------
# 2. Real INTRA_MPM_DERIVATION, INTRA_TU_PRED & Geometric Neighbor Lookup
# ---------------------------------------------------------------------------
def test_build_intra_pipeline_real_cpp_mpm_and_tu_pred_keys():
    """Pipeline builder uses mpm0/mpm1/mpm2, top_k, candidates, and TU pred `mode`."""
    modes = [
        IntraModeData(
            mode=m,
            direction_name="Planar" if m == 0 else ("DC" if m == 1 else f"Angular {m}"),
            cost=100.0 + m,
            sad=40,
            satd=50,
            bits=2,
            cu_size=8,
            pred_data=[42] * 64,
        )
        for m in range(35)
    ]
    ref_cp = intra_ref_parser.parse_event({
        "cu_size": 8,
        "ref_unfilt_top": [100] * 17,
        "ref_unfilt_left": [100] * 16,
        "ref_filt_top": [100] * 17,
        "ref_filt_left": [100] * 16,
    })

    pipeline = build_intra_pipeline_data(
        modes=modes,
        ref_checkpoint=ref_cp,
        cu_size=8,
        ctu_x=0,
        ctu_y=0,
        cu_x=8,
        cu_y=8,
        mpm_raw_event={
            "event": "INTRA_MPM_DERIVATION",
            "mpm0": 10,
            "mpm1": 0,
            "mpm2": 1,
            "top_k": [10, 26],
            "candidates": [10, 26, 0, 1],
            "left_available": True,
            "above_available": True,
            "left_mode": 18,
            "above_mode": 26,
        },
        full_rdo_events=[
            {
                "event": "INTRA_FULL_RDO",
                "mode": 10,
                "trial_id": 7,
                "cost_rdo": 95.0,
                "sse": 200,
                "bits": 3.0,
                "qp": 32,
                "is_winner": True,
            }
        ],
        tu_pred_events=[
            {
                "event": "INTRA_TU_PRED",
                "trial_id": 7,
                "mode": 10,
                "tu_x": 8,
                "tu_y": 8,
                "tu_width": 8,
                "tu_height": 8,
                "pred_data": [77] * 64,
            }
        ],
    )

    assert pipeline.step3_candidates.mpm_modes == [10, 0, 1]
    assert pipeline.step3_candidates.top_k_modes == [10, 26]
    assert pipeline.step3_candidates.candidate_modes == [10, 26, 0, 1]
    assert pipeline.step3_candidates.derivation.left_mode == 18
    assert pipeline.step3_candidates.derivation.above_mode == 26
    assert pipeline.winner_mode == 10
    winner_rdo = next(c for c in pipeline.step4_rdo if c.mode == 10)
    assert winner_rdo.pred_data[0] == 77


def test_intra_stage_geometric_neighbors_single_pu_and_strict_ctu(tmp_path, monkeypatch):
    """IntraStageService looks up exact geometric Left/Above neighbors and avoids CTU leakage."""
    sm = SessionManager(base_sessions_dir=tmp_path)
    monkeypatch.setattr(job_manager_mod, "session_manager", sm)
    jm = JobManager()
    reader = TraceReader()
    svc = IntraStageService(sm, reader, checkpoint_registry, jm)

    job_id = sm.create_session("intra_geo_test", run_cleanup=False)
    events = [
        # Partition tree for CTU (0, 0) providing geometric Left (0, 8 -> mode 18) & Above (8, 0 -> mode 26)
        {
            "event": "CTU_PARTITION",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "ctu_size": 64,
            "nodes": [
                {"x": 0, "y": 0, "width": 8, "height": 8, "depth": 3, "split": False, "mode": "INTRA", "intra_dir": 5},
                {"x": 8, "y": 0, "width": 8, "height": 8, "depth": 3, "split": False, "mode": "INTRA", "intra_dir": 26},
                {"x": 0, "y": 8, "width": 8, "height": 8, "depth": 3, "split": False, "mode": "INTRA", "intra_dir": 18},
                {"x": 8, "y": 8, "width": 8, "height": 8, "depth": 3, "split": False, "mode": "INTRA", "intra_dir": 10},
            ],
        },
        # (0, 0) 8x8 winner
        {"event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 0, "cu_size": 8, "mode": 5, "cost": 50.0, "is_winner": True},
        # Above neighbor of (8, 8): (8, 0) covers x=[8..16), y=[0..8) -> covers (8, 7)!
        {"event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 8, "pu_y": 0, "cu_size": 8, "mode": 26, "cost": 60.0, "is_winner": True},
        # Left neighbor of (8, 8): (0, 8) covers x=[0..8), y=[8..16) -> covers (7, 8)!
        {"event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 0, "pu_y": 8, "cu_size": 8, "mode": 18, "cost": 55.0, "is_winner": True},
        # Target PU (8, 8) with two candidates
        {"event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 8, "pu_y": 8, "cu_size": 8, "mode": 10, "cost": 40.0, "is_winner": True},
        {"event": "RDO_INTRA_SEARCH", "poc": 0, "ctu_x": 0, "ctu_y": 0, "pu_x": 8, "pu_y": 8, "cu_size": 8, "mode": 0, "cost": 45.0, "is_winner": False},
        {
            "event": "INTRA_REF_SAMPLES",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "pu_x": 8,
            "pu_y": 8,
            "cu_size": 8,
            "ref_unfilt_top": [100] * 17,
            "ref_unfilt_left": [100] * 16,
            "ref_filt_top": [100] * 17,
            "ref_filt_left": [100] * 16,
        },
    ]
    sm.get_trace_path(job_id).write_text("\n".join(json.dumps(e) for e in events) + "\n", encoding="utf-8")

    # Pipeline for PU (8, 8) picks exact Left (0, 8 -> mode 18) and Above (8, 0 -> mode 26)
    pipeline = svc.get_intra_pipeline_data(job_id, cu_size=8, ctu_x=0, ctu_y=0, cu_x=8, cu_y=8)
    assert pipeline.step3_candidates.derivation.left_mode == 18
    assert pipeline.step3_candidates.derivation.above_mode == 26
    assert pipeline.winner_mode == 10

    # get_intra_search_data without cu_x/cu_y should NOT mix multiple PUs into one list
    single_pu_modes = svc.get_intra_search_data(job_id, cu_size=8, ctu_x=0, ctu_y=0)
    assert len(single_pu_modes) == 1
    assert single_pu_modes[0].mode == 5

    # Explicit non-existent CTU must NOT silently fall back to CTU (0, 0)
    assert svc.get_intra_search_data(job_id, ctu_x=9, ctu_y=9) == []
    assert svc.get_intra_ref_data(job_id, ctu_x=9, ctu_y=9).ref_unfilt_top == []
    missing_pipeline = svc.get_intra_pipeline_data(job_id, ctu_x=9, ctu_y=9)
    assert missing_pipeline.ctu_x == 9
    assert missing_pipeline.ctu_y == 9
    assert missing_pipeline.step2_rmd == []
    assert missing_pipeline.step4_rdo == []


# ---------------------------------------------------------------------------
# 3. TraceReader Cached Partial CTU Filtering (ctu_x-only & ctu_y-only)
# ---------------------------------------------------------------------------
def test_trace_reader_cached_partial_ctu_filter(tmp_path):
    """Cached TraceReader honors ctu_x-only and ctu_y-only queries and skips malformed lines."""
    trace_file = tmp_path / "trace.jsonl"
    lines = [
        json.dumps({"event": "CU_RDO_DECISION", "ctu_x": 0, "ctu_y": 0, "val": "c00"}),
        "{malformed json line",
        json.dumps({"event": "CU_RDO_DECISION", "ctu_x": 1, "ctu_y": 0, "val": "c10"}),
        json.dumps({"event": "CU_RDO_DECISION", "ctu_x": 0, "ctu_y": 1, "val": "c01"}),
    ]
    trace_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    reader = TraceReader()
    all_events = reader.read_all(trace_file)
    assert len(all_events) == 3

    only_x1 = reader.read_all(trace_file, ctu_x=1)
    assert [e["val"] for e in only_x1] == ["c10"]

    only_y1 = reader.read_all(trace_file, ctu_y=1)
    assert [e["val"] for e in only_y1] == ["c01"]

    found_x1 = reader.find_one(trace_file, lambda e: True, ctu_x=1)
    assert found_x1 is not None and found_x1["val"] == "c10"


# ---------------------------------------------------------------------------
# 4. ImageProcessor BT.709 Colorimetry & Real HM Prediction Blitting
# ---------------------------------------------------------------------------
def test_image_processor_bt709_planes_and_hm_prediction(tmp_path):
    """Fallback planes use full-range BT.709 and prediction.png renders real HM samples."""
    input_img = tmp_path / "input.png"
    recon_png = tmp_path / "recon.png"
    pred_png = tmp_path / "pred.png"
    Image.new("RGB", (64, 64), (200, 100, 50)).save(input_img)
    Image.new("RGB", (64, 64), (10, 10, 10)).save(recon_png)

    y_png = tmp_path / "plane_y.png"
    u_png = tmp_path / "plane_u.png"
    v_png = tmp_path / "plane_v.png"
    image_processor.generate_fallback_plane(input_img, y_png, "y", 64, 64)
    image_processor.generate_fallback_plane(input_img, u_png, "u", 64, 64)
    image_processor.generate_fallback_plane(input_img, v_png, "v", 64, 64)

    # Full-range BT.709 for RGB(200, 100, 50): Y≈118, Cb≈92, Cr≈180 (BT.601 would give Y=124)
    with Image.open(y_png) as y_img:
        assert abs(y_img.getpixel((0, 0)) - 118) <= 1
    with Image.open(u_png) as u_img:
        assert abs(u_img.getpixel((0, 0)) - 92) <= 1
    with Image.open(v_png) as v_img:
        assert abs(v_img.getpixel((0, 0)) - 180) <= 1

    # Real HM INTRA_FULL_RDO + INTRA_TU_PRED samples (42 on 8x8 at (0,0))
    trace_file = tmp_path / "trace.jsonl"
    trace_events = [
        {"event": "INTRA_FULL_RDO", "poc": 0, "trial_id": 5, "mode": 10, "is_winner": True},
        {"event": "INTRA_TU_PRED", "poc": 0, "trial_id": 5, "tu_x": 0, "tu_y": 0, "tu_width": 8, "tu_height": 8, "pred_data": [42] * 64},
    ]
    trace_file.write_text("\n".join(json.dumps(e) for e in trace_events) + "\n", encoding="utf-8")

    image_processor.generate_prediction_image(input_img, recon_png, pred_png, 64, 64, trace_path=trace_file)
    with Image.open(pred_png) as pred_img:
        assert pred_img.getpixel((0, 0)) == (42, 42, 42)
        assert pred_img.getpixel((7, 7)) == (42, 42, 42)
        assert pred_img.getpixel((32, 32)) == (128, 128, 128)


# ---------------------------------------------------------------------------
# 5. JobManager Disk Persistence Recovery
# ---------------------------------------------------------------------------
def test_job_manager_disk_recovery_after_restart(tmp_path, monkeypatch):
    """JobManager recovers persisted JobInfo from disk when memory cache is empty."""
    sm = SessionManager(base_sessions_dir=tmp_path)
    monkeypatch.setattr(job_manager_mod, "session_manager", sm)
    jm1 = JobManager()
    job_id = sm.create_session("persist01", run_cleanup=False)

    async def _run():
        created = await jm1.create_job(
            roi=ROICoordinates(ctu_x=0, ctu_y=0, cu_size=8),
            frame=FrameMetadata(width=64, height=64, aligned_width=64, aligned_height=64, max_ctu_x=0, max_ctu_y=0),
            job_id=job_id,
            profile="all_intra",
            frames=1,
        )
        assert created.job_id == job_id

        jm2 = JobManager()
        recovered = await jm2.get_job(job_id)
        assert recovered.job_id == job_id
        assert recovered.frame.width == 64

        with pytest.raises(InvalidInputError):
            await jm2.get_job("bad$id")

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# 6. HTTP API Validation, Error Status Codes, and `poc` Query Parameter
# ---------------------------------------------------------------------------
def test_http_validation_413_422_and_poc_query_param(client, dummy_png_bytes, monkeypatch):
    """Endpoints return proper 413/422 codes (not 500/400) and forward `poc` filtering."""
    # bad job_id -> 422 (previously 500 on /images/original and 400 on checkpoints)
    assert client.get("/api/v1/jobs/bad$id/images/original").status_code == 422
    assert client.get("/api/v1/jobs/bad$id").status_code == 422

    # Invalid scale_mode / profile -> 422
    res_scale = client.post(
        "/api/v1/jobs/submit",
        files={"file": ("ok.png", dummy_png_bytes, "image/png")},
        data={"scale_mode": "invalid_mode"},
    )
    assert res_scale.status_code == 422

    res_prof = client.post(
        "/api/v1/jobs/submit",
        files={"file": ("ok.png", dummy_png_bytes, "image/png")},
        data={"profile": "invalid_profile"},
    )
    assert res_prof.status_code == 422

    # Oversized upload must preserve 413 instead of being masked as 400
    monkeypatch.setattr(jobs_endpoint.read_and_validate_upload_file, "__defaults__", (32,))
    res_big = client.post(
        "/api/v1/jobs/submit",
        files={"file": ("big.png", dummy_png_bytes, "image/png")},
    )
    assert res_big.status_code == 413

    # Multi-POC checkpoint trace + Query parameter bounds
    sm = jobs_endpoint.session_manager
    jm = jobs_endpoint.job_manager
    job_id = sm.create_session("http_poc_test", run_cleanup=False)
    try:
        sm.get_input_image_path(job_id).write_bytes(dummy_png_bytes)
        asyncio.run(jm.create_job(
            roi=ROICoordinates(ctu_x=0, ctu_y=0, cu_size=8),
            frame=FrameMetadata(width=64, height=64, aligned_width=64, aligned_height=64, max_ctu_x=0, max_ctu_y=0),
            job_id=job_id,
        ))
        trace_lines = [
            json.dumps({"event": "DEBLOCKING_EDGE", "poc": 0, "ctu_x": 0, "ctu_y": 0, "edge_type": 0, "bS": 1, "p_samples": [1], "q_samples": [2]}),
            json.dumps({"event": "DEBLOCKING_EDGE", "poc": 1, "ctu_x": 0, "ctu_y": 0, "edge_type": 0, "bS": 2, "p_samples": [3], "q_samples": [4]}),
            json.dumps({"event": "SAO_DECISION", "poc": 1, "ctu_x": 0, "ctu_y": 0, "sao_type_y": 4, "offsets_y": [1, 0, 0, 0]}),
        ]
        sm.get_trace_path(job_id).write_text("\n".join(trace_lines) + "\n", encoding="utf-8")

        assert client.get(f"/api/v1/jobs/{job_id}/images/residual?gain=999").status_code == 422
        assert client.get(f"/api/v1/checkpoints/{job_id}/CP_07_CABAC_ENTROPY?limit=999999").status_code == 422

        flt_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_INLOOP_FILTER?poc=1")
        assert flt_res.status_code == 200
        body = flt_res.json()
        assert body["total_edges"] == 1
        assert body["bs2_edges"] == 1
        assert body["edges"][0]["poc"] == 1
        assert body["sao"]["sao_mode"] == 1
        assert body["sao"]["offset_y"] == [1, 0, 0, 0]
    finally:
        sm.cleanup_session(job_id)
