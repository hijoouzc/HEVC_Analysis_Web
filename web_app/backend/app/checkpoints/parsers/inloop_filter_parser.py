from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import DeblockingEdgeCheckpoint, SaoDecisionCheckpoint

class DeblockingEdgeParser(BaseCheckpointParser):
    """CP_06_INLOOP_FILTER: Parses boundary strength (bS) and pre/post deblocking filter samples"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_06_INLOOP_FILTER.value

    @property
    def event_name(self) -> str:
        return "DEBLOCKING_EDGE"

    def parse_event(self, raw_data: dict[str, Any]) -> DeblockingEdgeCheckpoint:
        return DeblockingEdgeCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            edge_x=raw_data.get("edge_x", 0),
            edge_y=raw_data.get("edge_y", 0),
            dir=raw_data.get("dir", 0),
            bs=raw_data.get("bs", 0),
            beta=raw_data.get("beta", 0),
            tc=raw_data.get("tc", 0),
            p_before=raw_data.get("p_before", []),
            q_before=raw_data.get("q_before", []),
            p_after=raw_data.get("p_after", []),
            q_after=raw_data.get("q_after", [])
        )

class SaoDecisionParser(BaseCheckpointParser):
    """CP_06_INLOOP_FILTER: Parses Sample Adaptive Offset (SAO) mode and offsets for Y, U, and V"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_06_INLOOP_FILTER.value

    @property
    def event_name(self) -> str:
        return "SAO_DECISION"

    def parse_event(self, raw_data: dict[str, Any]) -> SaoDecisionCheckpoint:
        return SaoDecisionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            sao_mode=raw_data.get("sao_mode", 0),
            offset_y=raw_data.get("offset_y", []),
            offset_u=raw_data.get("offset_u", []),
            offset_v=raw_data.get("offset_v", [])
        )

deblocking_edge_parser = DeblockingEdgeParser()
sao_decision_parser = SaoDecisionParser()
