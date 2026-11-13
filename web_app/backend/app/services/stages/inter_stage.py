from app.domain.models.checkpoint import InterSearchCheckpoint
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.inter_search_parser import inter_search_parser
from app.services.stages.base import BaseStageService

class InterStageService(BaseStageService):
    """CP_03_INTER_SEARCH: Inter-prediction motion estimation, MV/MVP candidates, and uni/bi-pred search"""

    def get_inter_search_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        poc: int | None = None
    ) -> list[InterSearchCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_events = self.reader.read_all(
            trace_path,
            event_filter="INTER_SEARCH",
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            predicate=(lambda e: e.get("poc", 0) == poc) if poc is not None else None,
        )
        return [inter_search_parser.parse_event(e) for e in raw_events]
