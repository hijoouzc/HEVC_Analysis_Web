import json
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.checkpoints.parsers.sequence_metadata_parser import sequence_metadata_parser
from app.domain.models.checkpoint import HevcSequenceMetadata
from app.storage.session_manager import session_manager
from app.storage.trace_reader import trace_reader

SAMPLE_RAW_SEQUENCE_METADATA = {
    "event": "SEQUENCE_METADATA",
    "stage": "CP_00_FRAME_GOP",
    "sps": {
        "sps_id": 0,
        "pic_width_in_luma_samples": 416,
        "pic_height_in_luma_samples": 240,
        "max_cu_width": 64,
        "max_cu_height": 64,
        "max_total_cu_depth": 4,
        "log2_min_coding_block_size": 3,
        "log2_diff_max_min_coding_block_size": 3,
        "quadtree_tu_log2_min_size": 2,
        "quadtree_tu_log2_max_size": 5,
        "quadtree_tu_max_depth_intra": 3,
        "quadtree_tu_max_depth_inter": 3,
        "chroma_format_idc": 1,
        "bit_depth_luma": 8,
        "bit_depth_chroma": 8,
        "use_sao": True,
        "use_strong_intra_smoothing": True,
        "use_amp": True,
    },
    "pps": {
        "pps_id": 0,
        "sps_id": 0,
        "pic_init_qp_minus26": 0,
        "constrained_intra_pred_flag": False,
        "transquant_bypass_enabled_flag": False,
        "use_transform_skip": True,
        "use_dqp": False,
        "max_cu_dqp_depth": 0,
        "loop_filter_across_slices_enabled_flag": True,
        "deblocking_filter_control_present_flag": False,
    },
}

def test_sequence_metadata_parser():
    parsed = sequence_metadata_parser.parse_event(SAMPLE_RAW_SEQUENCE_METADATA)
    assert isinstance(parsed, HevcSequenceMetadata)
    assert parsed.event == "SEQUENCE_METADATA"
    assert parsed.stage == "CP_00_FRAME_GOP"

    # SPS verification
    assert parsed.sps.sps_id == 0
    assert parsed.sps.pic_width_in_luma_samples == 416
    assert parsed.sps.pic_height_in_luma_samples == 240
    assert parsed.sps.max_cu_width == 64
    assert parsed.sps.max_total_cu_depth == 4
    assert parsed.sps.quadtree_tu_log2_max_size == 5
    assert parsed.sps.chroma_format_idc == 1
    assert parsed.sps.use_sao is True
    assert parsed.sps.use_strong_intra_smoothing is True
    assert parsed.sps.use_amp is True

    # PPS verification
    assert parsed.pps.pps_id == 0
    assert parsed.pps.sps_id == 0
    assert parsed.pps.pic_init_qp_minus26 == 0
    assert parsed.pps.use_transform_skip is True
    assert parsed.pps.transquant_bypass_enabled_flag is False

def test_sequence_metadata_endpoint_success(client):
    job_id = session_manager.create_session()
    try:
        session_dir = session_manager.get_session_dir(job_id)
        trace_file = session_dir / "trace.jsonl"
        with open(trace_file, "w", encoding="utf-8") as f:
            f.write(json.dumps(SAMPLE_RAW_SEQUENCE_METADATA) + "\n")

        trace_reader.clear_cache()
        response = client.get(f"/api/v1/checkpoints/{job_id}/sequence-metadata")
        assert response.status_code == 200
        data = response.json()
        assert data["event"] == "SEQUENCE_METADATA"
        assert data["sps"]["pic_width_in_luma_samples"] == 416
        assert data["pps"]["pps_id"] == 0
    finally:
        session_manager.cleanup_session(job_id)

def test_sequence_metadata_endpoint_not_found(client):
    job_id = session_manager.create_session()
    try:
        session_dir = session_manager.get_session_dir(job_id)
        trace_file = session_dir / "trace.jsonl"
        # Write dummy event with no SEQUENCE_METADATA
        with open(trace_file, "w", encoding="utf-8") as f:
            f.write('{"event": "OTHER_EVENT"}\n')

        trace_reader.clear_cache()
        response = client.get(f"/api/v1/checkpoints/{job_id}/sequence-metadata")
        assert response.status_code == 404
        assert "Sequence metadata not found" in response.json()["detail"]
    finally:
        session_manager.cleanup_session(job_id)

def test_sequence_metadata_endpoint_invalid_job(client):
    response = client.get("/api/v1/checkpoints/non_existent_job_123/sequence-metadata")
    assert response.status_code == 404
