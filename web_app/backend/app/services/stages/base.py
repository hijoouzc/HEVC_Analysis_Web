from pathlib import Path
from typing import Callable
from app.storage.session_manager import session_manager, SessionManager
from app.storage.trace_reader import trace_reader, TraceReader
from app.checkpoints.registry import checkpoint_registry, CheckpointRegistry
from app.services.job_manager import job_manager, JobManager

class BaseStageService:
    """Base helper providing shared ROI resolution and predicate building for stage services"""

    def __init__(
        self,
        storage: SessionManager | None = None,
        reader: TraceReader | None = None,
        registry: CheckpointRegistry | None = None,
        job_mgr: JobManager | None = None
    ):
        self.storage = storage or session_manager
        self.reader = reader or trace_reader
        self.registry = registry or checkpoint_registry
        self.job_mgr = job_mgr or job_manager

    def resolve_target_roi(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ) -> tuple[int | None, int | None, int | None]:
        """Resolve ROI parameters from explicit args or fallback to the job's recorded ROI."""
        target_cu, target_x, target_y = cu_size, ctu_x, ctu_y
        if target_cu is None or target_x is None or target_y is None:
            job = self.job_mgr._jobs.get(job_id)
            if job and job.roi:
                if target_cu is None and job.roi.cu_size > 0:
                    target_cu = job.roi.cu_size
                if target_x is None:
                    target_x = job.roi.ctu_x
                if target_y is None:
                    target_y = job.roi.ctu_y
        return target_cu, target_x, target_y

    @staticmethod
    def build_roi_predicate(
        event_name: str | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
    ) -> Callable[[dict], bool]:
        """Create a predicate function to filter trace events by event name and ROI coordinates."""
        def predicate(e: dict) -> bool:
            if event_name is not None and e.get("event") != event_name:
                return False
            if cu_size is not None:
                e_size = e.get("cu_size") if e.get("cu_size") is not None else e.get("pu_size")
                if e_size != cu_size:
                    return False
            if ctu_x is not None and e.get("ctu_x") != ctu_x:
                return False
            if ctu_y is not None and e.get("ctu_y") != ctu_y:
                return False
            if cu_x is not None:
                e_x = e.get("cu_x") if e.get("cu_x") is not None else e.get("pu_x")
                if e_x is not None and e_x != cu_x:
                    return False
            if cu_y is not None:
                e_y = e.get("cu_y") if e.get("cu_y") is not None else e.get("pu_y")
                if e_y is not None and e_y != cu_y:
                    return False
            return True
        return predicate
