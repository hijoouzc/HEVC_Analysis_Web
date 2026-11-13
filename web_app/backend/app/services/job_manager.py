import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from app.domain.models.job import JobInfo, get_utc_now_iso
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.enums import JobStatus
from app.domain.exceptions import JobNotFoundError, InvalidInputError
from app.storage.session_manager import session_manager, validate_job_id

logger = logging.getLogger(__name__)


class JobManager:
    """Manages life-cycle, status, and metadata of analysis jobs with bounded memory + disk persistence"""

    _MAX_JOBS: int = 100
    _PRUNE_TARGET: int = 50
    _META_FILENAME: str = "job_meta.json"

    def __init__(self):
        self._jobs: dict[str, JobInfo] = {}
        self._lock = asyncio.Lock()

    def _persist_job_sync(self, job: JobInfo) -> None:
        try:
            session_dir = session_manager.get_session_dir(job.job_id)
        except (JobNotFoundError, InvalidInputError):
            return
        meta_path = session_dir / self._META_FILENAME
        fd, tmp_name = tempfile.mkstemp(prefix=".job_meta_", suffix=".json", dir=str(session_dir))
        os.close(fd)
        tmp_path = Path(tmp_name)
        try:
            tmp_path.write_text(job.model_dump_json(), encoding="utf-8")
            os.replace(tmp_path, meta_path)
        except Exception as exc:
            logger.warning("Failed to persist job metadata for %s: %s", job.job_id, exc)
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass

    def _load_job_from_disk_sync(self, job_id: str) -> JobInfo | None:
        validate_job_id(job_id)
        session_dir = (session_manager.base_dir / job_id).resolve()
        if not session_dir.is_relative_to(session_manager.base_dir) or not session_dir.exists():
            return None
        meta_path = session_dir / self._META_FILENAME
        if not meta_path.exists():
            return None
        try:
            raw = json.loads(meta_path.read_text(encoding="utf-8"))
            return JobInfo(**raw)
        except Exception as exc:
            logger.warning("Failed to load persisted job metadata for %s: %s", job_id, exc)
            return None

    async def create_job(
        self,
        roi: ROICoordinates,
        frame: FrameMetadata,
        job_id: str | None = None,
        profile: str = "all_intra",
        frames: int = 1
    ) -> JobInfo:
        to_cleanup: list[str] = []
        async with self._lock:
            # Memory guard: Auto-prune oldest completed/failed jobs if limit is reached
            if len(self._jobs) >= self._MAX_JOBS:
                removable = [
                    jid for jid, j in self._jobs.items()
                    if j.status in (JobStatus.COMPLETED, JobStatus.FAILED)
                ]
                to_delete = removable[:(len(self._jobs) - self._PRUNE_TARGET)]
                for jid in to_delete:
                    del self._jobs[jid]
                    to_cleanup.append(jid)

            job_id = await asyncio.to_thread(session_manager.create_session, job_id, True)
            job = JobInfo(
                job_id=job_id,
                status=JobStatus.PENDING,
                roi=roi,
                frame=frame,
                profile=profile,
                frames=frames
            )
            self._jobs[job_id] = job
            await asyncio.to_thread(self._persist_job_sync, job)

        for jid in to_cleanup:
            await asyncio.to_thread(session_manager.cleanup_session, jid)
        return job

    async def get_job(self, job_id: str) -> JobInfo:
        validate_job_id(job_id)
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                return job
        disk_job = await asyncio.to_thread(self._load_job_from_disk_sync, job_id)
        if disk_job is None:
            raise JobNotFoundError(job_id)
        async with self._lock:
            self._jobs[job_id] = disk_job
        return disk_job

    def get_job_sync(self, job_id: str) -> JobInfo | None:
        """Non-blocking synchronous job lookup for stage services"""
        job = self._jobs.get(job_id)
        if job is not None:
            return job
        try:
            disk_job = self._load_job_from_disk_sync(job_id)
            if disk_job is not None:
                self._jobs[job_id] = disk_job
            return disk_job
        except InvalidInputError:
            return None

    async def update_status(self, job_id: str, status: JobStatus, error_message: str | None = None):
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise JobNotFoundError(job_id)
            job.status = status
            job.updated_at = get_utc_now_iso()
            if error_message:
                job.error_message = error_message
            await asyncio.to_thread(self._persist_job_sync, job)

    async def set_result(self, job_id: str, best_mode: int, best_cost: float, stages: list[str]):
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise JobNotFoundError(job_id)
            job.status = JobStatus.COMPLETED
            job.best_mode = best_mode
            job.best_cost = best_cost
            job.stages_available = stages
            job.updated_at = get_utc_now_iso()
            await asyncio.to_thread(self._persist_job_sync, job)

    async def list_jobs(self) -> list[JobInfo]:
        async with self._lock:
            return list(self._jobs.values())

job_manager = JobManager()
