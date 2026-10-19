from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import FrameGopCheckpoint

class FrameGopParser(BaseCheckpointParser):
    """CP_00_FRAME_GOP: Parses Frame POC, slice type, and L0/L1 reference lists"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_00_FRAME_GOP.value

    @property
    def event_name(self) -> str:
        return "FRAME_GOP"

    def parse_event(self, raw_data: dict[str, Any]) -> FrameGopCheckpoint:
        return FrameGopCheckpoint(
            poc=raw_data.get("poc", 0),
            slice_type=raw_data.get("slice_type", "I"),
            qp=raw_data.get("qp", 22),
            temporal_id=raw_data.get("temporal_id", 0),
            ref_l0=raw_data.get("ref_l0", []),
            ref_l1=raw_data.get("ref_l1", [])
        )

frame_gop_parser = FrameGopParser()
