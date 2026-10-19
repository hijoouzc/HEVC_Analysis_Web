from app.domain.models.checkpoint import FrameGopCheckpoint, HevcSequenceMetadata
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.frame_gop_parser import frame_gop_parser
from app.checkpoints.parsers.sequence_metadata_parser import sequence_metadata_parser
from app.services.stages.base import BaseStageService

class GopStageService(BaseStageService):
    """CP_00_FRAME_GOP: Query and extraction service for Sequence Parameters, Frame Order, and GOP hierarchy"""

    def get_frame_gop_data(self, job_id: str) -> list[FrameGopCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_events = self.reader.read_all(trace_path, event_filter="FRAME_GOP")
        return [frame_gop_parser.parse_event(e) for e in raw_events]

    def get_sequence_metadata(self, job_id: str) -> HevcSequenceMetadata | None:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_event = self.reader.find_one(trace_path, lambda _: True, event_filter="SEQUENCE_METADATA")
        if not raw_event:
            return None
        return sequence_metadata_parser.parse_event(raw_event)
