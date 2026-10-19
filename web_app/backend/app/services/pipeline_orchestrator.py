import asyncio
from pathlib import Path
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.models.job import JobInfo, LegacyAnalysisResponse
from app.domain.enums import JobStatus, StageEnum
from app.domain.exceptions import EncoderExecutionError
from app.engine.interfaces import IEncoderRunner, IVideoProcessor
from app.engine.ffmpeg_adapter import ffmpeg_adapter
from app.engine.hm_runner import hm_runner
from app.engine.image_processor import image_processor, ImageProcessor
from app.storage.session_manager import session_manager, SessionManager
from app.storage.trace_reader import trace_reader, TraceReader
from app.checkpoints.registry import checkpoint_registry, CheckpointRegistry
from app.checkpoints.parsers.intra_search_parser import intra_search_parser
from app.core.config import settings
from app.services.job_manager import job_manager, JobManager as JobManagerClass
from app.services.stages.intra_stage import IntraStageService

class PipelineOrchestrator:
    """Orchestrates HEVC video preprocessing, HM encoder execution, and stage discovery (analogous to TEncTop)."""

    def __init__(
        self,
        video_processor: IVideoProcessor | None = None,
        encoder_runner: IEncoderRunner | None = None,
        storage: SessionManager | None = None,
        reader: TraceReader | None = None,
        registry: CheckpointRegistry | None = None,
        job_mgr: JobManagerClass | None = None,
        img_processor: ImageProcessor | None = None,
        intra_stage: IntraStageService | None = None,
    ):
        self.video_processor = video_processor or ffmpeg_adapter
        self.encoder_runner = encoder_runner or hm_runner
        self.storage = storage or session_manager
        self.reader = reader or trace_reader
        self.registry = registry or checkpoint_registry
        self.job_mgr = job_mgr or job_manager
        self.image_processor = img_processor or image_processor
        self.intra_stage = intra_stage or IntraStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @staticmethod
    def compute_frame_dimensions(orig_w: int, orig_h: int, scale_mode: str) -> tuple[int, int]:
        """Compute aligned width & height conforming to HEVC 8-pixel alignment and scale_mode."""
        if scale_mode == "fast":
            target_max_w, target_max_h = 640, 360
            if orig_w > target_max_w or orig_h > target_max_h:
                scale = min(target_max_w / orig_w, target_max_h / orig_h)
                calc_w = max(64, int(orig_w * scale))
                calc_h = max(64, int(orig_h * scale))
            else:
                calc_w, calc_h = orig_w, orig_h
        else:
            calc_w, calc_h = orig_w, orig_h

        calc_w = max(64, round(calc_w / 8) * 8)
        calc_h = max(64, round(calc_h / 8) * 8)
        return calc_w, calc_h

    async def execute_analysis_pipeline(
        self,
        job_id: str,
        input_image_path: Path,
        roi: ROICoordinates,
        scale_mode: str = "native",
        profile: str = "all_intra",
        frames: int = 1
    ) -> JobInfo:
        session_dir = self.storage.get_session_dir(job_id)
        yuv_output = self.storage.get_yuv_path(job_id)
        
        try:
            await self.job_mgr.update_status(job_id, JobStatus.RUNNING)
            
            # 1. Convert & Crop with FFmpeg (multi-frame if frames > 1)
            frame_meta = await self.video_processor.process_image_to_yuv(
                input_image=input_image_path,
                output_yuv=yuv_output,
                roi=roi,
                scale_mode=scale_mode,
                frames=frames
            )
            
            # 2. Run Encoder with requested profile configuration and frame count
            cfg_path = settings.get_cfg_for_profile(profile)
            trace_path = await self.encoder_runner.run_encode(
                yuv_input=yuv_output,
                session_dir=session_dir,
                frame_meta=frame_meta,
                roi=roi,
                cfg_path=cfg_path,
                frames=frames
            )
            
            # 3. Read trace events matching target cu_size
            target_cu_size = roi.cu_size if roi.cu_size > 0 else 8
            raw_modes = self.reader.read_all(
                trace_path,
                event_filter="RDO_INTRA_SEARCH",
                limit=35,
                predicate=lambda e: e.get("cu_size") == target_cu_size
            )
            if not raw_modes:
                raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35)
                
            if raw_modes:
                parsed_modes = [intra_search_parser.parse_event(m) for m in raw_modes]
                summary = intra_search_parser.compute_summary(parsed_modes)
                best_mode = summary.best_mode
                best_cost = summary.best_cost
            else:
                # In inter prediction or when intra events are not present, verify at least some trace data exists
                has_any_event = (
                    self.reader.has_event(trace_path, "INTER_SEARCH") or
                    self.reader.has_event(trace_path, "CTU_PARTITION") or
                    self.reader.has_event(trace_path, "FRAME_GOP")
                )
                if not has_any_event:
                    raise EncoderExecutionError("No trace events were captured from encoder.")
                best_mode = 0
                best_cost = 0.0
            
            # Check and register all available stages dynamically with O(1) checks
            stages = []
            if self.reader.has_event(trace_path, "FRAME_GOP"):
                stages.append(StageEnum.CP_00_FRAME_GOP.value)
            if self.reader.has_event(trace_path, "CTU_PARTITION"):
                stages.append(StageEnum.CP_01_PARTITION.value)
            if self.reader.has_event(trace_path, "INTRA_REF_SAMPLES"):
                stages.append(StageEnum.CP_02_INTRA_REF.value)
            stages.append(StageEnum.CP_02_INTRA_SEARCH.value)
            stages.append(StageEnum.CP_03_INTRA_SEARCH.value)
            if self.reader.has_event(trace_path, "INTER_SEARCH"):
                stages.append(StageEnum.CP_03_INTER_SEARCH.value)
            if self.reader.has_event(trace_path, "TRANSFORM_QUANT"):
                stages.append(StageEnum.CP_04_TRANSFORM_RQT.value)
                stages.append(StageEnum.CP_06_TRANSFORM.value)
                stages.append(StageEnum.CP_07_QUANT.value)
            if self.reader.has_event(trace_path, "RECON_PICTURE"):
                stages.append(StageEnum.CP_05_RECON_PICTURE.value)
            if self.reader.has_event(trace_path, "DEBLOCKING_EDGE") or self.reader.has_event(trace_path, "SAO_DECISION"):
                stages.append(StageEnum.CP_06_INLOOP_FILTER.value)
            if self.reader.has_event(trace_path, "CABAC_BIN"):
                stages.append(StageEnum.CP_07_CABAC_ENTROPY.value)
                
            await self.job_mgr.set_result(
                job_id=job_id,
                best_mode=best_mode,
                best_cost=best_cost,
                stages=stages
            )
            
            return await self.job_mgr.get_job(job_id)
            
        except Exception as e:
            await self.job_mgr.update_status(job_id, JobStatus.FAILED, error_message=str(e))
            raise

    async def run_synchronous_analysis(
        self,
        image_bytes: bytes,
        ctu_x: int = 0,
        ctu_y: int = 0,
        cu_size: int = 8,
        scale_mode: str = "native"
    ) -> LegacyAnalysisResponse:
        """Backward-compatible endpoint for synchronous analysis execution"""
        job_id = self.storage.create_session()
        input_image = self.storage.get_input_image_path(job_id)
        
        await asyncio.to_thread(self.image_processor.write_file_bytes, input_image, image_bytes)
            
        roi = ROICoordinates(ctu_x=ctu_x, ctu_y=ctu_y, cu_size=cu_size)
        
        orig_w, orig_h = await asyncio.to_thread(self.image_processor.read_image_dims, input_image)
            
        calc_w, calc_h = self.compute_frame_dimensions(orig_w, orig_h, scale_mode)
        num_ctu_w = (calc_w + 63) // 64
        num_ctu_h = (calc_h + 63) // 64

        frame_meta = FrameMetadata(
            width=calc_w,
            height=calc_h,
            aligned_width=calc_w,
            aligned_height=calc_h,
            max_ctu_x=max(0, num_ctu_w - 1),
            max_ctu_y=max(0, num_ctu_h - 1),
            ctu_size=64
        )
        
        await self.job_mgr.create_job(roi=roi, frame=frame_meta, job_id=job_id)
        job_info = await self.execute_analysis_pipeline(job_id, input_image, roi, scale_mode=scale_mode)
        
        # Retrieve raw modes for legacy format
        trace_path = self.storage.get_trace_path(job_id)
        target_cu_size = roi.cu_size if roi.cu_size > 0 else 8
        raw_modes = self.reader.read_all(
            trace_path,
            event_filter="RDO_INTRA_SEARCH",
            limit=35,
            predicate=lambda e: (e.get("cu_size") or e.get("pu_size")) == target_cu_size
        )
        if not raw_modes:
            raw_modes = self.reader.read_all(trace_path, event_filter="RDO_INTRA_SEARCH", limit=35)
        
        # Retrieve intra ref data if available
        ref_checkpoint = None
        try:
            ref_checkpoint = self.intra_stage.get_intra_ref_data(job_id, cu_size=target_cu_size, ctu_x=roi.ctu_x, ctu_y=roi.ctu_y)
        except Exception:
            pass
        
        return LegacyAnalysisResponse(
            status="success",
            job_id=job_id,
            data=raw_modes,
            width=job_info.frame.width,
            height=job_info.frame.height,
            ctu_x=job_info.roi.ctu_x,
            ctu_y=job_info.roi.ctu_y,
            best_mode=job_info.best_mode or 0,
            best_cost=job_info.best_cost or 0.0,
            ref_samples=ref_checkpoint.model_dump() if ref_checkpoint else None
        )

pipeline_orchestrator = PipelineOrchestrator()
