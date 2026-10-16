import shutil
import uuid
from pathlib import Path
from app.core.config import settings
from app.domain.exceptions import JobNotFoundError

class SessionManager:
    def __init__(self, base_sessions_dir: Path | None = None):
        self.base_dir = (base_sessions_dir or settings.SESSIONS_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
    def create_session(self, job_id: str | None = None) -> str:
        job_id = job_id or uuid.uuid4().hex[:12]
        session_dir = self.base_dir / job_id
        session_dir.mkdir(parents=True, exist_ok=True)
        # Safely prune stale sessions to avoid disk leaks
        try:
            self.cleanup_old_sessions(max_age_hours=24, max_keep=30)
        except Exception:
            pass
        return job_id
        
    def get_session_dir(self, job_id: str) -> Path:
        session_dir = self.base_dir / job_id
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
        session_dir = self.base_dir / job_id
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)

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
