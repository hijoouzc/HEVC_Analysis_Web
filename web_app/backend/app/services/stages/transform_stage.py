from app.domain.models.checkpoint import TransformQuantCheckpoint
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.transform_parser import transform_quant_parser
from app.services.stages.base import BaseStageService

class TransformStageService(BaseStageService):
    """CP_04_TRANSFORM_RQT: Transform tree, residual scaling, and quantization matrices"""

    def get_transform_quant_data(
        self,
        job_id: str,
        comp: str | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        cu_size: int | None = None,
        intra_mode: int | None = None
    ) -> list[TransformQuantCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
            
        raw_events = self.reader.read_all(trace_path, event_filter="TRANSFORM_QUANT", ctu_x=ctu_x, ctu_y=ctu_y)
        # Pre-filter dictionaries to avoid unnecessary Pydantic model instantiations
        if ctu_x is not None:
            raw_events = [e for e in raw_events if e.get("ctu_x") == ctu_x]
        if ctu_y is not None:
            raw_events = [e for e in raw_events if e.get("ctu_y") == ctu_y]
        if cu_x is not None:
            raw_events = [e for e in raw_events if (e.get("cu_x") == cu_x or e.get("pu_x") == cu_x)]
        if cu_y is not None:
            raw_events = [e for e in raw_events if (e.get("cu_y") == cu_y or e.get("pu_y") == cu_y)]
        if cu_size is not None:
            raw_events = [e for e in raw_events if (e.get("cu_width") == cu_size or e.get("cu_size") == cu_size or e.get("tu_size") == cu_size or e.get("width") == cu_size)]
        if intra_mode is not None:
            raw_events = [e for e in raw_events if e.get("intra_mode") == intra_mode]
        if comp and comp.strip():
            target_comp = comp.strip().upper()
            raw_events = [e for e in raw_events if (e.get("component") or e.get("comp") or "Y").upper() == target_comp]

        return [transform_quant_parser.parse_event(e) for e in raw_events]
