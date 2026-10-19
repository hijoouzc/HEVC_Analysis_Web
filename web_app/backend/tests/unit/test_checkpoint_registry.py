import pytest
from app.checkpoints.registry import checkpoint_registry
from app.checkpoints.parsers.transform_parser import transform_parser, quant_parser
from app.checkpoints.parsers.extended_parsers import (
    frame_gop_parser,
    inter_search_parser,
    recon_picture_parser,
    deblocking_edge_parser,
    sao_decision_parser,
    cabac_bin_parser,
)

def test_registry_multi_parser_event_mapping():
    # Both transform_parser and quant_parser handle TRANSFORM_QUANT
    parsers = checkpoint_registry.get_all_by_event("TRANSFORM_QUANT")
    assert len(parsers) >= 2
    assert transform_parser in parsers
    assert quant_parser in parsers

    # get_by_stage returns the correct parser without overwriting
    p_trans = checkpoint_registry.get_by_stage("CP_06_TRANSFORM")
    p_quant = checkpoint_registry.get_by_stage("CP_07_QUANT")
    assert p_trans is transform_parser
    assert p_quant is quant_parser

    # get_by_event with stage_id disambiguation
    assert checkpoint_registry.get_by_event("TRANSFORM_QUANT", stage_id="CP_06_TRANSFORM") is transform_parser
    assert checkpoint_registry.get_by_event("TRANSFORM_QUANT", stage_id="CP_07_QUANT") is quant_parser

def test_registry_standard_stages():
    stages = checkpoint_registry.list_available_stages()
    stage_ids = {s["stage_id"] for s in stages}
    expected = {
        "CP_00_FRAME_GOP",
        "CP_01_PARTITION",
        "CP_01_CU_QUADTREE_RDO",
        "CP_02_INTRA_REF",
        "CP_02_INTRA_SEARCH",
        "CP_03_INTER_SEARCH",
        "CP_04_TRANSFORM_RQT",
        "CP_06_TRANSFORM",
        "CP_07_QUANT",
        "CP_05_RECON_PICTURE",
        "CP_06_INLOOP_FILTER",
        "CP_07_CABAC_ENTROPY",
    }
    for exp in expected:
        assert exp in stage_ids, f"Expected {exp} to be registered in CheckpointRegistry"

def test_extended_parsers_unit():
    # Frame GOP
    gop = frame_gop_parser.parse_event({"poc": 1, "slice_type": "P", "qp": 27})
    assert gop.poc == 1 and gop.slice_type == "P" and gop.qp == 27

    # Inter Search
    inter = inter_search_parser.parse_event({"poc": 1, "mv_x": 4, "mv_y": -2, "cost": 12.5})
    assert inter.mv_x == 4 and inter.mv_y == -2 and inter.cost == 12.5

    # Recon Picture
    recon = recon_picture_parser.parse_event({"poc": 0, "reco_y": [128, 130]})
    assert recon.reco_y == [128, 130]

    # Deblocking Edge
    edge = deblocking_edge_parser.parse_event({"poc": 0, "bs": 2, "dir": 1})
    assert edge.bs == 2 and edge.dir == 1

    # SAO Decision
    sao = sao_decision_parser.parse_event({"poc": 0, "sao_mode": 1, "offset_y": [1, -1, 0, 2]})
    assert sao.sao_mode == 1 and sao.offset_y == [1, -1, 0, 2]

    # CABAC Bin
    cabac = cabac_bin_parser.parse_event({"syntax_element": "split_cu_flag", "bin": 1, "bits": 1})
    assert cabac.syntax_element == "split_cu_flag" and cabac.bin == 1
