import re
import shutil
import uuid
from pathlib import Path
from app.core.config import settings
from app.domain.exceptions import JobNotFoundError, InvalidInputError

JOB_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

def validate_job_id(job_id: str) -> str:
    if not job_id or not isinstance(job_id, str) or not JOB_ID_REGEX.match(job_id):
        raise InvalidInputError(f"Invalid job identifier: '{job_id}'")
    return job_id

class SessionManager:
    def __init__(self, base_sessions_dir: Path | None = None):
        self.base_dir = (base_sessions_dir or settings.SESSIONS_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
    def create_session(self, job_id: str | None = None) -> str:
        if job_id is not None:
            job_id = validate_job_id(job_id)
        else:
            job_id = uuid.uuid4().hex[:12]
        session_dir = (self.base_dir / job_id).resolve()
        if not session_dir.is_relative_to(self.base_dir):
            raise InvalidInputError(f"Security restriction: Session path escape attempt detected.")
        session_dir.mkdir(parents=True, exist_ok=True)
        # Safely prune stale sessions to avoid disk leaks
        try:
            self.cleanup_old_sessions(max_age_hours=24, max_keep=30)
        except Exception:
            pass
        return job_id
        
    def get_session_dir(self, job_id: str) -> Path:
        validate_job_id(job_id)
        session_dir = (self.base_dir / job_id).resolve()
        if not session_dir.is_relative_to(self.base_dir):
            raise InvalidInputError(f"Security restriction: Session path escape attempt detected.")
        if not session_dir.exists():
            raise JobNotFoundError(job_id)
        return session_dir
        
    def get_input_image_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "input_image.png"
        
    def get_yuv_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "input.yuv"
        
    def get_trace_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "trace.jsonl"
        
    def get_meta_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "meta.json"

    def get_recon_yuv_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "recon.yuv"

    def get_recon_image_path(self, job_id: str) -> Path:
        return self.get_session_dir(job_id) / "recon.png"
        
    def cleanup_session(self, job_id: str) -> None:
        try:
            validate_job_id(job_id)
            session_dir = (self.base_dir / job_id).resolve()
            if session_dir.is_relative_to(self.base_dir) and session_dir.exists():
                shutil.rmtree(session_dir, ignore_errors=True)
        except Exception:
            pass

    def cleanup_old_sessions(self, max_age_hours: int = 24, max_keep: int = 50) -> int:
        """
        Prunes session directories older than max_age_hours or exceeding max_keep limit.
        Safely ignores files currently in use or deletion errors.
        Returns the number of deleted sessions.
        """
        import time
        if not self.base_dir.exists():
            return 0

        now = time.time()
        max_age_seconds = max_age_hours * 3600

        dirs = []
        for p in self.base_dir.iterdir():
            if p.is_dir():
                try:
                    dirs.append((p.stat().st_mtime, p))
                except OSError:
                    continue

        # Sort newest to oldest
        dirs.sort(key=lambda x: x[0], reverse=True)

        deleted = 0
        for idx, (mtime, p) in enumerate(dirs):
            age = now - mtime
            if idx >= max_keep or age > max_age_seconds:
                try:
                    shutil.rmtree(p, ignore_errors=True)
                    deleted += 1
                except OSError:
                    pass

        return deleted

session_manager = SessionManager()
