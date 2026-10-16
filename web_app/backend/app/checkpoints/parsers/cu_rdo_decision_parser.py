from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import CuRdoDecisionCheckpoint, BranchRdoDetail

class CuRdoDecisionParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return "CP_01_CU_QUADTREE_RDO"
        
    @property
    def event_name(self) -> str:
        return "CU_RDO_DECISION"
        
    def parse_event(self, raw_data: dict[str, Any]) -> CuRdoDecisionCheckpoint:
        nosplit_raw = raw_data.get("nosplit")
        split_raw = raw_data.get("split")
        nosplit = None
        split = None
        if isinstance(nosplit_raw, dict):
            nosplit = BranchRdoDetail(
                cost=float(nosplit_raw.get("cost", raw_data.get("cost_nosplit", 0.0))),
                dist=int(nosplit_raw.get("dist", 0)),
                bits=int(nosplit_raw.get("bits", 0)),
                qp=int(nosplit_raw.get("qp", -1)),
                mode=nosplit_raw.get("mode")
            )
        if isinstance(split_raw, dict):
            split = BranchRdoDetail(
                cost=float(split_raw.get("cost", raw_data.get("cost_split", 0.0))),
                dist=int(split_raw.get("dist", 0)),
                bits=int(split_raw.get("bits", 0)),
                qp=int(split_raw.get("qp", -1))
            )

        return CuRdoDecisionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            cu_x=raw_data.get("cu_x", 0),
            cu_y=raw_data.get("cu_y", 0),
            cu_size=raw_data.get("cu_size", 64),
            depth=raw_data.get("depth", 0),
            cost_nosplit=float(raw_data.get("cost_nosplit", 0.0)),
            cost_split=float(raw_data.get("cost_split", 0.0)),
            split_decision=bool(raw_data.get("split_decision", False)),
            best_mode=int(raw_data.get("best_mode", -1)),
            stage=raw_data.get("stage", "CP_01_CU_QUADTREE_RDO"),
            split_evaluated=bool(raw_data.get("split_evaluated", True)),
            winner_cost=float(raw_data.get("winner_cost", raw_data.get("cost_split" if raw_data.get("split_decision") else "cost_nosplit", 0.0))),
            nosplit=nosplit,
            split=split
        )

cu_rdo_decision_parser = CuRdoDecisionParser()
