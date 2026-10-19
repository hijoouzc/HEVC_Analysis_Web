import pytest
from app.services.analysis_service import analysis_service
from app.engine.mock_runner import MockEncoderRunner

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_list_checkpoint_stages(client):
    res = client.get("/api/v1/checkpoints/stages")
    assert res.status_code == 200
    stages = res.json()
    assert isinstance(stages, list)
    stage_ids = [s["stage_id"] for s in stages]
    assert "CP_01_PARTITION" in stage_ids
    assert "CP_02_INTRA_REF" in stage_ids
    assert "CP_03_INTRA_SEARCH" in stage_ids
    assert "CP_06_TRANSFORM" in stage_ids
    assert "CP_07_QUANT" in stage_ids

def test_legacy_upload_compatibility(client, dummy_png_bytes, sample_trace_file, monkeypatch):
    mock_runner = MockEncoderRunner(fixture_path=sample_trace_file)
    monkeypatch.setattr(analysis_service, "encoder_runner", mock_runner)
    
    files = {"file": ("test.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0"}
    
    res = client.post("/upload", files=files, data=data)
    assert res.status_code == 200
    json_data = res.json()
    
    assert json_data["status"] == "success"
    assert len(json_data["data"]) == 35
    assert json_data["width"] == 128
    assert json_data["height"] == 128
    assert json_data["ctu_x"] == 0
    assert json_data["ctu_y"] == 0
    assert "best_mode" in json_data
    assert "best_cost" in json_data
    assert "ref_samples" in json_data
    assert json_data["ref_samples"] is not None
    assert "ref_unfilt_top" in json_data["ref_samples"]


def test_modern_job_and_checkpoint_api(client, dummy_png_bytes, sample_trace_file, monkeypatch):
    mock_runner = MockEncoderRunner(fixture_path=sample_trace_file)
    monkeypatch.setattr(analysis_service, "encoder_runner", mock_runner)
    
    # 1. Submit Job
    files = {"file": ("test.png", dummy_png_bytes, "image/png")}
    data = {"ctu_x": "0", "ctu_y": "0", "cu_size": "8"}
    
    submit_res = client.post("/api/v1/jobs/submit", files=files, data=data)
    assert submit_res.status_code == 202
    job_info = submit_res.json()
    job_id = job_info["job_id"]
    assert job_id is not None
    
    # 2. Check Job Status
    get_res = client.get(f"/api/v1/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["job_id"] == job_id
    
    # 3. Check CP_02_INTRA_REF
    ref_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_02_INTRA_REF")
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "ref_unfilt_top" in ref_data
    assert "ref_filt_top" in ref_data
    assert len(ref_data["ref_unfilt_top"]) == 17
    
    # 4. Get Checkpoint Summary (Lightweight)
    sum_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_modes"] == 35
    assert "best_mode" in summary
    assert "best_cost" in summary
    
    # 5. Lazy-load modes (Full vs filtered)
    modes_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH")
    assert modes_res.status_code == 200
    modes_list = modes_res.json()
    assert len(modes_list) == 35
    # Verify enriched metadata
    assert "direction_name" in modes_list[0]
    assert "category" in modes_list[0]
    assert "rank" in modes_list[0]
    
    single_mode_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH?mode=0")
    assert single_mode_res.status_code == 200
    single_list = single_mode_res.json()
    assert len(single_list) == 1
    assert single_list[0]["mode"] == 0
    assert single_list[0]["direction_name"] == "Planar"
    
    # 6. Compare mode 0 vs mode 1
    cmp_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTRA_SEARCH/compare?mode_a=0&mode_b=1")
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["mode_a"] == 0
    assert cmp_data["mode_b"] == 1
    assert "pixel_sad_diff" in cmp_data
    assert len(cmp_data["pixel_diff_matrix"]) == 64

    # 7. Check CP_01_PARTITION
    part_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_01_PARTITION")
    assert part_res.status_code == 200
    part_data = part_res.json()
    assert "nodes" in part_data
    assert part_data["total_nodes"] == 5
    assert part_data["max_depth"] == 1
    assert part_data["cu_size"] == 64
    assert part_data["nodes"][0]["split"] is True

    # 8. Check CP_06_TRANSFORM
    tr_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_TRANSFORM?component=Y")
    assert tr_res.status_code == 200
    tr_list = tr_res.json()
    assert len(tr_list) >= 1
    tr_item = tr_list[0]
    assert len(tr_item["resi_matrix"]) == 64
    assert len(tr_item["dct_coeff"]) == 64
    assert "energy_compaction_ratio" in tr_item
    assert tr_item["component"] == "Y"

    # CP_06_TRANSFORM without component parameter returns all components
    tr_all_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_TRANSFORM")
    assert tr_all_res.status_code == 200
    assert len(tr_all_res.json()) >= len(tr_list)


    # 9. Check CP_07_QUANT
    q_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_07_QUANT?component=Y")
    assert q_res.status_code == 200
    q_list = q_res.json()
    assert len(q_list) >= 1
    q_item = q_list[0]
    assert len(q_item["quant_coeff"]) == 64
    assert "sparsity_ratio" in q_item
    assert q_item["sparsity_ratio"] >= 0.0

    # 10. Check Image endpoints
    orig_img_res = client.get(f"/api/v1/jobs/{job_id}/images/original")
    assert orig_img_res.status_code == 200
    assert orig_img_res.headers["content-type"] == "image/png"

    recon_img_res = client.get(f"/api/v1/jobs/{job_id}/images/reconstructed")
    assert recon_img_res.status_code == 200
    assert recon_img_res.headers["content-type"] == "image/png"

    y_plane_res = client.get(f"/api/v1/jobs/{job_id}/images/y")
    assert y_plane_res.status_code == 200
    assert y_plane_res.headers["content-type"] == "image/png"

    res_img_res = client.get(f"/api/v1/jobs/{job_id}/images/residual")
    assert res_img_res.status_code == 200
    assert res_img_res.headers["content-type"] == "image/png"

    # 11. Check CP_03_INTRA_SEARCH Pipeline Endpoint
    pipe_res = client.get(f"/api/v1/checkpoints/{job_id}/intra-pipeline")
    assert pipe_res.status_code == 200
    pipe_data = pipe_res.json()
    assert pipe_data["cu_size"] == 8
    assert "data_source" in pipe_data
    assert "is_fallback" in pipe_data
    assert len(pipe_data["step1_reference"]["ref_unfilt_top"]) == 17
    assert len(pipe_data["step2_rmd"]) == 35
    assert pipe_data["step3_candidates"]["k_threshold"] == 8
    assert len(pipe_data["step3_candidates"]["mpm_modes"]) == 3
    assert len(pipe_data["step4_rdo"]) >= 8
    assert len(pipe_data["step5_chroma"]) == 5
    assert pipe_data["winner_mode"] == pipe_data["best_luma_mode"]

    # 12. Check New Standard 8-Checkpoint Endpoints
    gop_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_00_FRAME_GOP")
    assert gop_res.status_code == 200
    assert isinstance(gop_res.json(), list)

    inter_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_03_INTER_SEARCH")
    assert inter_res.status_code == 200
    assert isinstance(inter_res.json(), list)

    rqt_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_04_TRANSFORM_RQT")
    assert rqt_res.status_code == 200
    assert isinstance(rqt_res.json(), list)

    recon_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_05_RECON_PICTURE")
    assert recon_res.status_code == 200
    assert isinstance(recon_res.json(), list)

    inloop_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_06_INLOOP_FILTER")
    assert inloop_res.status_code == 200
    assert "edges" in inloop_res.json()

    cabac_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_07_CABAC_ENTROPY")
    assert cabac_res.status_code == 200
    assert "bins" in cabac_res.json()

    # 13. Check CP_02_INTRA_SEARCH aliases
    intra_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_02_INTRA_SEARCH")
    assert intra_res.status_code == 200
    assert len(intra_res.json()) == 35

    intra_pipe_res = client.get(f"/api/v1/checkpoints/{job_id}/CP_02_INTRA_SEARCH/pipeline")
    assert intra_pipe_res.status_code == 200
    assert "step1_reference" in intra_pipe_res.json()

    # 14. Check Real HM RDO decisions endpoint
    rdo_dec_res = client.get(f"/api/v1/checkpoints/{job_id}/rdo-decisions")
    assert rdo_dec_res.status_code == 200
    assert isinstance(rdo_dec_res.json(), list)

def test_submit_job_full_frame_and_inter_profile(client, dummy_png_bytes, sample_trace_file, monkeypatch):
    mock_runner = MockEncoderRunner(fixture_path=sample_trace_file)
    monkeypatch.setattr(analysis_service, "encoder_runner", mock_runner)
    
    files = {"file": ("test_multi.png", dummy_png_bytes, "image/png")}
    data = {
        "ctu_x": "-1",
        "ctu_y": "-1",
        "all_ctus": "true",
        "profile": "low_delay_p",
        "frames": "3"
    }
    submit_res = client.post("/api/v1/jobs/submit", files=files, data=data)
    assert submit_res.status_code == 202
    job_info = submit_res.json()
    assert job_info["job_id"] is not None
    assert job_info["roi"]["all_ctus"] is True
    assert job_info["roi"]["ctu_x"] == -1
    assert job_info["roi"]["ctu_y"] == -1
    assert job_info["profile"] == "low_delay_p"
    assert job_info["frames"] == 3
