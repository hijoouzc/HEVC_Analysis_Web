from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import InterSearchCheckpoint

class InterSearchParser(BaseCheckpointParser):
    """CP_03_INTER_SEARCH: Parses Motion Vector (MV), MVD, and reference picture decisions"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_03_INTER_SEARCH.value

    @property
    def event_name(self) -> str:
        return "INTER_SEARCH"

    def parse_event(self, raw_data: dict[str, Any]) -> InterSearchCheckpoint:
        return InterSearchCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            cu_x=raw_data.get("cu_x", 0),
            cu_y=raw_data.get("cu_y", 0),
            cu_size=raw_data.get("cu_size", 16),
            depth=raw_data.get("depth", 0),
            pu_idx=raw_data.get("pu_idx", 0),
            pu_x=raw_data.get("pu_x", 0),
            pu_y=raw_data.get("pu_y", 0),
            pu_w=raw_data.get("pu_w", 16),
            pu_h=raw_data.get("pu_h", 16),
            ref_list=raw_data.get("ref_list", 0),
            ref_idx=raw_data.get("ref_idx", 0),
            mvp_idx=raw_data.get("mvp_idx", 0),
            mv_x=raw_data.get("mv_x", 0),
            mv_y=raw_data.get("mv_y", 0),
            mvd_x=raw_data.get("mvd_x", 0),
            mvd_y=raw_data.get("mvd_y", 0),
            ref_idx_l1=raw_data.get("ref_idx_l1"),
            mvp_idx_l1=raw_data.get("mvp_idx_l1"),
            mv_x_l1=raw_data.get("mv_x_l1"),
            mv_y_l1=raw_data.get("mv_y_l1"),
            mvd_x_l1=raw_data.get("mvd_x_l1"),
            mvd_y_l1=raw_data.get("mvd_y_l1"),
            cost=float(raw_data.get("cost", 0.0)),
            dist=int(raw_data.get("dist", 0)),
            bits=int(raw_data.get("bits", 0))
        )

inter_search_parser = InterSearchParser()
