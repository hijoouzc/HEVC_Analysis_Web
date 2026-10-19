import os
import time
import asyncio
import shutil
from pathlib import Path
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import EncoderExecutionError
from app.core.config import settings

class HMEncoderRunner:
    """Executes the reference HM C++ encoder with isolated ROI environment, concurrency guards, and output paths"""
    
    def __init__(self, encoder_bin: Path | None = None, cfg_path: Path | None = None, max_concurrent: int = 2):
        self.encoder_bin = encoder_bin or settings.ENCODER_BIN
        self.cfg_path = cfg_path or settings.DEFAULT_CFG
        self._max_concurrent = max_concurrent
        self._semaphore: asyncio.Semaphore | None = None
        
    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._max_concurrent)
        return self._semaphore

    async def run_encode(
        self,
        yuv_input: Path,
        session_dir: Path,
        frame_meta: FrameMetadata,
        roi: ROICoordinates,
        cfg_path: Path | None = None,
        frames: int | None = None
    ) -> Path:
        effective_cfg = cfg_path or self.cfg_path
        effective_frames = frames if (frames is not None and frames > 0) else settings.DEFAULT_FRAMES

        if not self.encoder_bin.exists():
            raise EncoderExecutionError(f"Encoder binary not found at: {self.encoder_bin}")
        if not effective_cfg.exists():
            raise EncoderExecutionError(f"Config file not found at: {effective_cfg}")
            
        trace_output = session_dir / "trace.jsonl"
        if trace_output.exists():
            trace_output.unlink()
            
        env = os.environ.copy()
        is_all_ctus = getattr(roi, "all_ctus", False) or roi.ctu_x < 0 or roi.ctu_y < 0
        env["VISUAL_CTU_X"] = "-1" if is_all_ctus else str(roi.ctu_x)
        env["VISUAL_CTU_Y"] = "-1" if is_all_ctus else str(roi.ctu_y)
        env["VISUAL_CU_SIZE"] = str(roi.cu_size)
        env["VISUAL_DUMP_EXIT"] = "0"
        env["VISUAL_OUTPUT_DIR"] = str(session_dir)
        
        recon_output = session_dir / "recon.yuv"
        bitstream_output = session_dir / "str.bin"
        cmd = [
            str(self.encoder_bin),
            "-c", str(effective_cfg),
            "-i", str(yuv_input),
            "-o", str(recon_output),
            "-b", str(bitstream_output),
            "-wdt", str(frame_meta.aligned_width),
            "-hgt", str(frame_meta.aligned_height),
            "-fr", str(settings.DEFAULT_FPS),
            "-f", str(effective_frames)
        ]
        
        sem = self._get_semaphore()
        async with sem:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(settings.PROJECT_ROOT),
                env=env
            )
            
            try:
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120.0)
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                raise EncoderExecutionError("HM reference encoder process timed out after 120 seconds.", -1)
        
        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace") if stderr else f"HM Encoder process exited with code {proc.returncode}."
            raise EncoderExecutionError(err_msg, proc.returncode)

        if trace_output.exists() and trace_output.stat().st_size > 0:
            return trace_output
            
        err_msg = stderr.decode(errors="replace") if stderr else "HM Encoder did not generate trace data."
        raise EncoderExecutionError(err_msg, proc.returncode or -1)

hm_runner = HMEncoderRunner()
