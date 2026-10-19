from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.enums import StageEnum
from app.domain.models.checkpoint import CabacBinCheckpoint

class CabacBinParser(BaseCheckpointParser):
    """CP_07_CABAC_ENTROPY: Parses CABAC syntax element, bin values, state index, and MPS/LPS"""
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_07_CABAC_ENTROPY.value

    @property
    def event_name(self) -> str:
        return "CABAC_BIN"

    def parse_event(self, raw_data: dict[str, Any]) -> CabacBinCheckpoint:
        return CabacBinCheckpoint(
            syntax_element=raw_data.get("syntax_element", ""),
            bin=int(raw_data.get("bin", 0)),
            ctx_idx=int(raw_data.get("ctx_idx", 0)),
            p_state_idx=int(raw_data.get("p_state_idx", 0)),
            val_mps=int(raw_data.get("val_mps", 0)),
            bits=int(raw_data.get("bits", 1))
        )

cabac_bin_parser = CabacBinParser()
