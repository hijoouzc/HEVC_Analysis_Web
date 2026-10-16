import pytest
from app.checkpoints.parsers.cu_rdo_decision_parser import cu_rdo_decision_parser
from app.domain.models.checkpoint import CuRdoDecisionCheckpoint

def test_cu_rdo_decision_parser():
    raw_event = {
        "event": "CU_RDO_DECISION",
        "stage": "CP_01_CU_QUADTREE_RDO",
        "poc": 0,
        "ctu_x": 0,
        "ctu_y": 0,
        "cu_x": 0,
        "cu_y": 0,
        "cu_size": 32,
        "depth": 1,
        "cost_nosplit": 1420.5,
        "cost_split": 1180.2,
        "split_decision": True,
        "best_mode": 1
    }
    
    parsed = cu_rdo_decision_parser.parse_event(raw_event)
    assert isinstance(parsed, CuRdoDecisionCheckpoint)
    assert parsed.event == "CU_RDO_DECISION"
    assert parsed.cu_x == 0
    assert parsed.cu_y == 0
    assert parsed.cu_size == 32
    assert parsed.depth == 1
    assert parsed.cost_nosplit == 1420.5
    assert parsed.cost_split == 1180.2
    assert parsed.split_decision is True
    assert parsed.best_mode == 1
