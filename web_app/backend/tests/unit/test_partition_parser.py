import pytest
from app.checkpoints.parsers.partition_parser import partition_parser
from app.storage.trace_reader import TraceReader

def test_partition_parser_from_fixture(sample_trace_file):
    part_event = TraceReader.find_one(sample_trace_file, lambda e: e.get("event") == "CTU_PARTITION")
    assert part_event is not None
    
    checkpoint = partition_parser.parse_event(part_event)
    assert checkpoint.cu_size == 64
    assert checkpoint.total_nodes == 5
    assert checkpoint.leaf_nodes == 4
    assert checkpoint.split_count == 1
    assert checkpoint.max_depth == 1
    
    # Check leaf node properties
    first_leaf = checkpoint.nodes[1]
    assert first_leaf.split is False
    assert first_leaf.width == 32
    assert first_leaf.mode == "INTRA"
    assert first_leaf.intra_dir == 0
    assert first_leaf.qp == 32
    assert first_leaf.abs_x == 0
    assert first_leaf.abs_y == 0
    assert first_leaf.rel_x == 0
    assert first_leaf.rel_y == 0

def test_partition_parser_relative_offset_resolution():
    raw_event = {
        "poc": 0,
        "ctu_x": 2,
        "ctu_y": 1,
        "cu_size": 64,
        "event": "CTU_PARTITION",
        "nodes": [
            {"depth": 1, "x": 32, "y": 32, "width": 32, "height": 32, "split": False}
        ]
    }
    checkpoint = partition_parser.parse_event(raw_event)
    leaf = checkpoint.nodes[0]
    # ctu_x=2 -> origin_x = 128; leaf relative x=32 -> abs_x = 160
    assert leaf.abs_x == 160
    assert leaf.rel_x == 32
    # ctu_y=1 -> origin_y = 64; leaf relative y=32 -> abs_y = 96
    assert leaf.abs_y == 96
    assert leaf.rel_y == 32
