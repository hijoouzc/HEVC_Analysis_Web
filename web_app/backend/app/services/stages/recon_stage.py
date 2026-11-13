from app.domain.models.checkpoint import ReconPictureCheckpoint
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.recon_picture_parser import recon_picture_parser
from app.services.stages.base import BaseStageService

class ReconStageService(BaseStageService):
    """CP_05_RECON_PICTURE: Picture reconstruction, pred/resi/recon comparison"""

    def get_recon_picture_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        poc: int | None = None
    ) -> list[ReconPictureCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_events = self.reader.read_all(
            trace_path,
            event_filter="RECON_PICTURE",
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            predicate=(lambda e: e.get("poc", 0) == poc) if poc is not None else None,
        )
        return [recon_picture_parser.parse_event(e) for e in raw_events]
