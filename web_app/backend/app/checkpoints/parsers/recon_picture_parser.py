from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import ReconPictureCheckpoint

class ReconPictureParser(BaseCheckpointParser):
    """CP_05_RECON_PICTURE: Parses reconstructed Y, U, and V pixel planes for each block"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_05_RECON_PICTURE.value

    @property
    def event_name(self) -> str:
        return "RECON_PICTURE"

    def parse_event(self, raw_data: dict[str, Any]) -> ReconPictureCheckpoint:
        return ReconPictureCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=raw_data.get("ctu_x", 0),
            ctu_y=raw_data.get("ctu_y", 0),
            cu_x=raw_data.get("cu_x", 0),
            cu_y=raw_data.get("cu_y", 0),
            cu_w=raw_data.get("cu_size", raw_data.get("cu_w", 16)),
            cu_h=raw_data.get("cu_size", raw_data.get("cu_h", 16)),
            reco_y=raw_data.get("reco_y", []),
            reco_u=raw_data.get("reco_u", []),
            reco_v=raw_data.get("reco_v", [])
        )

recon_picture_parser = ReconPictureParser()
