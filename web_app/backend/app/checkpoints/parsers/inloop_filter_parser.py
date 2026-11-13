from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import DeblockingEdgeCheckpoint, SaoDecisionCheckpoint

# HM-18.0 TEncSampleAdaptiveOffset SAOType -> UI sao_mode (0: Off, 1: BO, 2..5: EO 0/90/135/45)
_HM_SAO_TYPE_TO_MODE: dict[int, int] = {
    -1: 0,
    0: 2,
    1: 3,
    2: 4,
    3: 5,
    4: 1,
}


class DeblockingEdgeParser(BaseCheckpointParser):
    """CP_06_INLOOP_FILTER: Parses boundary strength (bS) and pre/post deblocking filter samples"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_06_INLOOP_FILTER.value

    @property
    def event_name(self) -> str:
        return "DEBLOCKING_EDGE"

    def parse_event(self, raw_data: dict[str, Any]) -> DeblockingEdgeCheckpoint:
        edge_dir = raw_data.get("dir", raw_data.get("edge_type", 0))
        bs_val = raw_data.get("bs", raw_data.get("bS", 0))
        p_before = raw_data.get("p_before", raw_data.get("p_samples", []))
        q_before = raw_data.get("q_before", raw_data.get("q_samples", []))
        return DeblockingEdgeCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            edge_x=raw_data.get("edge_x", 0),
            edge_y=raw_data.get("edge_y", 0),
            dir=int(edge_dir) if edge_dir is not None else 0,
            bs=int(bs_val) if bs_val is not None else 0,
            beta=raw_data.get("beta", 0),
            tc=raw_data.get("tc", 0),
            p_before=p_before,
            q_before=q_before,
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
        if "sao_mode" in raw_data and raw_data["sao_mode"] is not None:
            sao_mode = int(raw_data["sao_mode"])
        elif "sao_type_y" in raw_data and raw_data["sao_type_y"] is not None:
            sao_mode = _HM_SAO_TYPE_TO_MODE.get(int(raw_data["sao_type_y"]), 0)
        else:
            sao_mode = 0

        return SaoDecisionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            sao_mode=sao_mode,
            offset_y=raw_data.get("offset_y", raw_data.get("offsets_y", [])),
            offset_u=raw_data.get("offset_u", raw_data.get("offsets_u", [])),
            offset_v=raw_data.get("offset_v", raw_data.get("offsets_v", []))
        )

deblocking_edge_parser = DeblockingEdgeParser()
sao_decision_parser = SaoDecisionParser()
