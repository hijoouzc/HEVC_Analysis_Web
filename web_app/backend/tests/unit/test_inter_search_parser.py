import pytest
from app.checkpoints.parsers.inter_search_parser import inter_search_parser

def test_inter_search_parser_unipred():
    raw_data = {
        "poc": 1,
        "ctu_x": 0,
        "ctu_y": 0,
        "cu_x": 0,
        "cu_y": 0,
        "cu_size": 16,
        "depth": 2,
        "pu_idx": 0,
        "pu_x": 0,
        "pu_y": 0,
        "pu_w": 16,
        "pu_h": 16,
        "ref_list": 0,
        "ref_idx": 0,
        "mvp_idx": 0,
        "mv_x": 12,
        "mv_y": -4,
        "mvd_x": 2,
        "mvd_y": 0,
        "cost": 1500.25,
        "dist": 300,
        "bits": 45
    }
    parsed = inter_search_parser.parse_event(raw_data)
    assert parsed.ref_list == 0
    assert parsed.ref_idx == 0
    assert parsed.mv_x == 12
    assert parsed.mv_y == -4
    assert parsed.ref_idx_l1 is None

def test_inter_search_parser_bipred():
    raw_data = {
        "poc": 2,
        "ctu_x": 0,
        "ctu_y": 0,
        "cu_x": 0,
        "cu_y": 0,
        "cu_size": 32,
        "depth": 1,
        "pu_idx": 0,
        "pu_x": 0,
        "pu_y": 0,
        "pu_w": 32,
        "pu_h": 32,
        "ref_list": 2,
        "ref_idx": 0,
        "mvp_idx": 0,
        "mv_x": 8,
        "mv_y": 4,
        "mvd_x": 0,
        "mvd_y": 0,
        "ref_idx_l1": 1,
        "mvp_idx_l1": 1,
        "mv_x_l1": -8,
        "mv_y_l1": -4,
        "mvd_x_l1": 0,
        "mvd_y_l1": 0,
        "cost": 2100.5,
        "dist": 400,
        "bits": 80
    }
    parsed = inter_search_parser.parse_event(raw_data)
    assert parsed.ref_list == 2
    assert parsed.ref_idx == 0
    assert parsed.mv_x == 8
    assert parsed.ref_idx_l1 == 1
    assert parsed.mv_x_l1 == -8
    assert parsed.mv_y_l1 == -4
