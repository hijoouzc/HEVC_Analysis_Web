import json
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.storage.session_manager import session_manager
from app.storage.trace_reader import trace_reader
from app.services.job_manager import job_manager
from app.domain.enums import JobStatus
from app.domain.models.job import JobInfo
from app.domain.models.roi import ROICoordinates, FrameMetadata

MOCK_TRACE_DATA = [
    {
        "event": "SEQUENCE_METADATA",
        "stage": "CP_00_FRAME_GOP",
        "sps": {
            "pic_width_in_luma_samples": 416,
            "pic_height_in_luma_samples": 240,
            "max_cu_width": 64,
            "max_cu_height": 64,
        },
        "pps": {
            "pic_init_qp_minus26": 0,
        }
    },
    {
        "event": "CTU_PARTITION",
        "stage": "CP_01_CU_QUADTREE_RDO",
        "poc": 0,
        "ctu_x": 0,
        "ctu_y": 0,
        "nodes": [
            {
                "depth": 0,
                "x": 0,
                "y": 0,
                "width": 64,
                "height": 64,
                "split": False,
                "mode": "INTRA",
                "part_size": 0,
                "cu_transquant_bypass_flag": False,
                "intra_dir": 1,
                "qp": 32,
                "cost": 2500.5
            }
        ]
    },
    {
        "event": "RDO_INTRA_SEARCH",
        "stage": "CP_02_INTRA_SEARCH",
        "poc": 0,
        "ctu_x": 0,
        "ctu_y": 0,
        "pu_x": 0,
        "pu_y": 0,
        "pu_size": 64,
        "mode": 1,
        "is_winner": True,
        "is_mpm": True,
        "cost": 2500.5,
        "cost_rdo": 2500.5,
        "dist": 1200,
        "bits": 45
    },
    {
        "event": "TRANSFORM_QUANT",
        "stage": "CP_04_TRANSFORM_RQT",
        "poc": 0,
        "ctu_x": 0,
        "ctu_y": 0,
        "cu_x": 0,
        "cu_y": 0,
        "component": "Y",
        "tu_depth": 0,
        "qp": 32,
        "cbf": True,
        "sig_coeff_count": 8,
        "energy_compaction_ratio": 0.85,
        "residual": [1, 2, 3, 4],
        "transform_coeff": [10, 0, 0, 0],
        "quant_coeff": [2, 0, 0, 0],
        "dequant_coeff": [8, 0, 0, 0]
    }
]

@pytest.fixture
def mock_session_with_trace():
    job_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(job_id)
    trace_path = session_dir / "trace.jsonl"
    with open(trace_path, "w", encoding="utf-8") as f:
        for ev in MOCK_TRACE_DATA:
            f.write(json.dumps(ev) + "\n")
    trace_reader.clear_cache()
    yield job_id
    session_manager.cleanup_session(job_id)

def test_cu_inspector_found_without_matrices(client, mock_session_with_trace):
    res = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=16&cu_y=16&include_matrices=false"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_available"] is True
    assert data["status"] == "FOUND"
    assert data["job_id"] == mock_session_with_trace
    
    # Spatial
    spatial = data["spatial"]
    assert spatial["cu_x"] == 0
    assert spatial["cu_y"] == 0
    assert spatial["cu_size"] == 64
    assert spatial["depth"] == 0
    assert spatial["mode"] == "INTRA"
    assert spatial["part_size"] == 0

    # Intra
    intra = data["intra"]
    assert intra is not None
    assert intra["intra_dir"] == 1
    assert intra["direction_name"] == "DC"
    assert intra["is_mpm"] is True
    assert intra["winner_cost"] == 2500.5

    # Transform
    transform = data["transform"]
    assert transform is not None
    assert transform["cbf"] is True
    assert transform["sig_coeff_count"] == 8

    # Matrices should be omitted by default
    assert data["matrices"] is None

def test_cu_inspector_found_with_matrices(client, mock_session_with_trace):
    res = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0&include_matrices=true"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["matrices"] is not None
    assert len(data["matrices"]["quant_coeff"]) == 4
    assert data["matrices"]["quant_coeff"][0] == 2

def test_cu_inspector_negative_coordinates(client, mock_session_with_trace):
    res = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=-1&ctu_y=0&cu_x=0&cu_y=0"
    )
    assert res.status_code == 422
    assert "non-negative" in res.json()["detail"].lower()

def test_cu_inspector_out_of_bounds_coordinates(client, mock_session_with_trace):
    res = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=500&cu_y=0"
    )
    assert res.status_code == 422
    assert "exceeds picture dimensions" in res.json()["detail"].lower()

def test_cu_inspector_not_found_in_tree(client, mock_session_with_trace):
    # CTU (5, 5) exists within picture bounds but has no partition event in this trace
    res = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=5&ctu_y=2&cu_x=320&cu_y=128"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_available"] is False
    assert data["status"] == "NOT_FOUND_IN_TREE"

def test_cu_inspector_running_job(client):
    # Register an active running job in job_manager
    running_job_id = "running_inspect_test"
    job = JobInfo(
        job_id=running_job_id,
        status=JobStatus.RUNNING,
        roi=ROICoordinates(ctu_x=0, ctu_y=0, cu_size=64),
        frame=FrameMetadata(width=128, height=128, aligned_width=128, aligned_height=128, max_ctu_x=1, max_ctu_y=1)
    )
    job_manager._jobs[running_job_id] = job
    try:
        res = client.get(
            f"/api/v1/checkpoints/{running_job_id}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0"
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_available"] is False
        assert data["status"] == "NOT_ENCODED_YET"
    finally:
        job_manager._jobs.pop(running_job_id, None)

def test_cu_inspector_job_not_found(client):
    res = client.get(
        "/api/v1/checkpoints/non_existent_1234/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0"
    )
    assert res.status_code == 404

def test_cu_inspector_poc_filtering(client, mock_session_with_trace):
    # Query with default poc=0 -> FOUND
    res0 = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0&poc=0"
    )
    assert res0.status_code == 200
    assert res0.json()["status"] == "FOUND"
    assert res0.json()["poc"] == 0

    # Query with poc=1 -> NOT_FOUND_IN_TREE because only poc=0 exists in trace
    res1 = client.get(
        f"/api/v1/checkpoints/{mock_session_with_trace}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0&poc=1"
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "NOT_FOUND_IN_TREE"
    assert res1.json()["poc"] == 1

def test_partition_stage_no_fallback_on_missing_ctu(mock_session_with_trace):
    from app.services.analysis_service import analysis_service
    # Request CTU (1, 0) which is absent from mock trace
    part = analysis_service.get_partition_data(mock_session_with_trace, ctu_x=1, ctu_y=0)
    # Must strictly NOT fall back to CTU (0,0)
    assert part.nodes == []
    assert part.ctu_x == 1
    assert part.ctu_y == 0

def test_cu_inspector_sub_block_coordinates_and_multi_tu(client):
    # Create a specialized session with a sub-CU and multiple TUs in RQT
    job_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(job_id)
    trace_path = session_dir / "trace.jsonl"
    events = [
        {
            "event": "SEQUENCE_METADATA",
            "stage": "CP_00_FRAME_GOP",
            "sps": {"pic_width_in_luma_samples": 416, "pic_height_in_luma_samples": 240, "max_cu_width": 64, "max_cu_height": 64},
            "pps": {"pic_init_qp_minus26": 0}
        },
        {
            "event": "CTU_PARTITION",
            "stage": "CP_01_CU_QUADTREE_RDO",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "nodes": [
                {"depth": 0, "x": 0, "y": 0, "width": 64, "height": 64, "split": True},
                {"depth": 1, "x": 0, "y": 0, "width": 32, "height": 32, "split": False, "mode": "INTRA", "part_size": 0, "intra_dir": 10, "qp": 30, "cost": 100.0},
                {"depth": 1, "x": 32, "y": 0, "width": 32, "height": 32, "split": False, "mode": "INTER", "part_size": 0, "qp": 28, "cost": 80.0},
                {"depth": 1, "x": 0, "y": 32, "width": 32, "height": 32, "split": False, "mode": "INTRA", "part_size": 0, "intra_dir": 26, "qp": 32, "cost": 120.0},
                {"depth": 1, "x": 32, "y": 32, "width": 32, "height": 32, "split": False, "mode": "SKIP", "part_size": 0, "qp": 32, "cost": 50.0},
            ]
        },
        # INTER_SEARCH with CTU origin for cu_x/cu_y (0,0) and actual PU coords (32,0)
        {
            "event": "INTER_SEARCH",
            "stage": "CP_03_INTER_SEARCH",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "cu_x": 0,
            "cu_y": 0,
            "pu_x": 32,
            "pu_y": 0,
            "mv_l0": [4, -2],
            "ref_idx_l0": 0,
        },
        # TRANSFORM_QUANT 1: sub-TU 1 at (32, 0)
        {
            "event": "TRANSFORM_QUANT",
            "stage": "CP_04_TRANSFORM_RQT",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "cu_x": 0,
            "cu_y": 0,
            "tu_x": 32,
            "tu_y": 0,
            "width": 16,
            "height": 16,
            "component": "Y",
            "tu_depth": 2,
            "qp": 28,
            "cbf": True,
            "sig_coeff_count": 5,
            "residual": [1, 2],
        },
        # TRANSFORM_QUANT 2: sub-TU 2 at (48, 0)
        {
            "event": "TRANSFORM_QUANT",
            "stage": "CP_04_TRANSFORM_RQT",
            "poc": 0,
            "ctu_x": 0,
            "ctu_y": 0,
            "cu_x": 0,
            "cu_y": 0,
            "tu_x": 48,
            "tu_y": 0,
            "width": 16,
            "height": 16,
            "component": "Y",
            "tu_depth": 2,
            "qp": 28,
            "cbf": True,
            "sig_coeff_count": 3,
            "residual": [3, 4],
        }
    ]
    with open(trace_path, "w", encoding="utf-8") as f:
        for ev in events:
            f.write(json.dumps(ev) + "\n")
    trace_reader.clear_cache()
    try:
        # Inspect sub-CU at (32, 0)
        res = client.get(
            f"/api/v1/checkpoints/{job_id}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=32&cu_y=0&poc=0&include_matrices=true"
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "FOUND"
        assert data["spatial"]["cu_x"] == 32
        assert data["spatial"]["cu_y"] == 0
        assert data["spatial"]["cu_size"] == 32
        assert data["spatial"]["mode"] == "INTER"

        # Inter PU correctly matched by pu_x=32, pu_y=0
        assert data["inter"] is not None
        assert data["inter"]["mv_l0"] == [4, -2]
        assert data["inter"]["ref_idx_l0"] == 0

        # Transform and multi-TU RQT list
        assert data["transform"] is not None
        assert data["transform"]["tu_x"] == 32
        assert len(data["transforms"]) == 2
        assert data["transforms"][0]["tu_x"] == 32
        assert data["transforms"][1]["tu_x"] == 48
    finally:
        session_manager.cleanup_session(job_id)
