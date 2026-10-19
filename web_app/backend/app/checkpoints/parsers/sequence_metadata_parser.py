from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import HevcSequenceMetadata, SpsMetadata, PpsMetadata

class SequenceMetadataParser(BaseCheckpointParser):
    """CP_00_FRAME_GOP: Parses SPS and PPS sequence parameter set metadata from HM-18.0"""

    @property
    def stage_id(self) -> str:
        return StageEnum.CP_00_FRAME_GOP.value

    @property
    def event_name(self) -> str:
        return "SEQUENCE_METADATA"

    def parse_event(self, raw_data: dict[str, Any]) -> HevcSequenceMetadata:
        sps_raw = raw_data.get("sps", {})
        pps_raw = raw_data.get("pps", {})
        return HevcSequenceMetadata(
            event=raw_data.get("event", "SEQUENCE_METADATA"),
            stage=raw_data.get("stage", "CP_00_FRAME_GOP"),
            sps=SpsMetadata(**sps_raw),
            pps=PpsMetadata(**pps_raw)
        )

sequence_metadata_parser = SequenceMetadataParser()
