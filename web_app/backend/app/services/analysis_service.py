from pathlib import Path
from app.domain.models.roi import ROICoordinates
from app.domain.models.job import JobInfo, LegacyAnalysisResponse
from app.domain.models.checkpoint import (
    IntraModeData,
    IntraSearchSummary,
    IntraRefCheckpoint,
    IntraComparisonResult,
    CTUPartitionCheckpoint,
    TransformQuantCheckpoint,
    IntraPipelineFullResponse,
    FrameGopCheckpoint,
    InterSearchCheckpoint,
    ReconPictureCheckpoint,
    InLoopFilterFullResponse,
    CabacEntropyFullResponse,
    CuRdoDecisionCheckpoint,
    HevcSequenceMetadata,
    CUInspectionResponse
)
from app.engine.interfaces import IEncoderRunner, IVideoProcessor
from app.engine.ffmpeg_adapter import ffmpeg_adapter
from app.engine.hm_runner import hm_runner
from app.storage.session_manager import session_manager, SessionManager
from app.storage.trace_reader import trace_reader, TraceReader
from app.checkpoints.registry import checkpoint_registry, CheckpointRegistry
from app.services.job_manager import job_manager, JobManager as JobManagerClass
from app.services.stages.base import BaseStageService
from app.services.stages.gop_stage import GopStageService
from app.services.stages.partition_stage import PartitionStageService
from app.services.stages.intra_stage import IntraStageService
from app.services.stages.inter_stage import InterStageService
from app.services.stages.transform_stage import TransformStageService
from app.services.stages.recon_stage import ReconStageService
from app.services.stages.filter_stage import FilterStageService
from app.services.stages.cabac_stage import CabacStageService
from app.services.pipeline_orchestrator import PipelineOrchestrator

class AnalysisService:
    """
    Facade service orchestrating HEVC video processing, HM encoder execution,
    and checkpoint analysis across modularized stage services.
    Conforms strictly to reference software HM-18.0 pipeline decomposition.
    """
    
    def __init__(
        self,
        video_processor: IVideoProcessor | None = None,
        encoder_runner: IEncoderRunner | None = None,
        storage: SessionManager | None = None,
        reader: TraceReader | None = None,
        registry: CheckpointRegistry | None = None,
        job_mgr: JobManagerClass | None = None
    ):
        self.video_processor = video_processor or ffmpeg_adapter
        self.encoder_runner = encoder_runner or hm_runner
        self.storage = storage or session_manager
        self.reader = reader or trace_reader
        self.registry = registry or checkpoint_registry
        self.job_mgr = job_mgr or job_manager

    @property
    def _gop_stage(self) -> GopStageService:
        return GopStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _partition_stage(self) -> PartitionStageService:
        return PartitionStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _transform_stage(self) -> TransformStageService:
        return TransformStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _intra_stage(self) -> IntraStageService:
        return IntraStageService(
            self.storage, self.reader, self.registry, self.job_mgr,
            partition_service=self._partition_stage,
            transform_service=self._transform_stage
        )

    @property
    def _inter_stage(self) -> InterStageService:
        return InterStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _recon_stage(self) -> ReconStageService:
        return ReconStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _filter_stage(self) -> FilterStageService:
        return FilterStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _cabac_stage(self) -> CabacStageService:
        return CabacStageService(self.storage, self.reader, self.registry, self.job_mgr)

    @property
    def _orchestrator(self) -> PipelineOrchestrator:
        return PipelineOrchestrator(
            video_processor=self.video_processor,
            encoder_runner=self.encoder_runner,
            storage=self.storage,
            reader=self.reader,
            registry=self.registry,
            job_mgr=self.job_mgr,
            intra_stage=self._intra_stage
        )

    @staticmethod
    def compute_frame_dimensions(orig_w: int, orig_h: int, scale_mode: str) -> tuple[int, int]:
        return PipelineOrchestrator.compute_frame_dimensions(orig_w, orig_h, scale_mode)

    def _resolve_target_roi(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ) -> tuple[int | None, int | None, int | None]:
        base = BaseStageService(self.storage, self.reader, self.registry, self.job_mgr)
        return base.resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)

    @staticmethod
    def _build_roi_predicate(
        event_name: str | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
    ):
        return BaseStageService.build_roi_predicate(event_name, cu_size, ctu_x, ctu_y, cu_x, cu_y)

    @staticmethod
    def _build_fallback_ref_checkpoint(raw_mode: dict) -> IntraRefCheckpoint:
        return IntraStageService._build_fallback_ref_checkpoint(raw_mode)

    async def execute_analysis_pipeline(
        self,
        job_id: str,
        input_image_path: Path,
        roi: ROICoordinates,
        scale_mode: str = "native",
        profile: str = "all_intra",
        frames: int = 1
    ) -> JobInfo:
        return await self._orchestrator.execute_analysis_pipeline(
            job_id, input_image_path, roi, scale_mode=scale_mode, profile=profile, frames=frames
        )

    async def run_synchronous_analysis(
        self,
        image_bytes: bytes,
        ctu_x: int = 0,
        ctu_y: int = 0,
        cu_size: int = 8,
        scale_mode: str = "native"
    ) -> LegacyAnalysisResponse:
        return await self._orchestrator.run_synchronous_analysis(
            image_bytes, ctu_x=ctu_x, ctu_y=ctu_y, cu_size=cu_size, scale_mode=scale_mode
        )

    # Stage CP_00: Frame & GOP
    def get_sequence_metadata(self, job_id: str) -> HevcSequenceMetadata | None:
        return self._gop_stage.get_sequence_metadata(job_id)

    def get_frame_gop_data(self, job_id: str) -> list[FrameGopCheckpoint]:
        return self._gop_stage.get_frame_gop_data(job_id)

    # Stage CP_01: Partition QuadTree & RDO
    def get_partition_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        poc: int | None = None,
    ) -> CTUPartitionCheckpoint:
        return self._partition_stage.get_partition_data(job_id, ctu_x=ctu_x, ctu_y=ctu_y, poc=poc)

    def get_all_partitions(self, job_id: str) -> list[CTUPartitionCheckpoint]:
        return self._partition_stage.get_all_partitions(job_id)

    def get_rdo_decisions(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        cu_size: int | None = None
    ) -> list[CuRdoDecisionCheckpoint]:
        return self._partition_stage.get_cu_rdo_decisions(
            job_id, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y, cu_size=cu_size
        )

    def get_cu_inspection_data(
        self,
        job_id: str,
        ctu_x: int,
        ctu_y: int,
        cu_x: int,
        cu_y: int,
        poc: int = 0,
        include_matrices: bool = False,
    ) -> CUInspectionResponse:
        return self._partition_stage.get_cu_inspection_data(
            job_id, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y, poc=poc, include_matrices=include_matrices
        )

    # Stage CP_02: Intra Search & Reference Samples
    def get_intra_search_data(
        self,
        job_id: str,
        mode: int | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None
    ) -> list[IntraModeData]:
        return self._intra_stage.get_intra_search_data(
            job_id, mode=mode, cu_size=cu_size, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y
        )

    def get_intra_search_summary(self, job_id: str) -> IntraSearchSummary:
        return self._intra_stage.get_intra_search_summary(job_id)

    def get_intra_ref_data(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None
    ) -> IntraRefCheckpoint:
        return self._intra_stage.get_intra_ref_data(
            job_id, cu_size=cu_size, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y
        )

    def compare_intra_modes(
        self,
        job_id: str,
        mode_a: int,
        mode_b: int,
        cu_size: int | None = None
    ) -> IntraComparisonResult:
        return self._intra_stage.compare_intra_modes(job_id, mode_a=mode_a, mode_b=mode_b, cu_size=cu_size)

    def get_intra_pipeline_data(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None
    ) -> IntraPipelineFullResponse:
        return self._intra_stage.get_intra_pipeline_data(
            job_id, cu_size=cu_size, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y
        )

    # Stage CP_03: Inter Search
    def get_inter_search_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> list[InterSearchCheckpoint]:
        return self._inter_stage.get_inter_search_data(job_id, ctu_x=ctu_x, ctu_y=ctu_y)

    # Stage CP_04: Transform & Quant
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
        return self._transform_stage.get_transform_quant_data(
            job_id, comp=comp, ctu_x=ctu_x, ctu_y=ctu_y, cu_x=cu_x, cu_y=cu_y, cu_size=cu_size, intra_mode=intra_mode
        )

    # Stage CP_05: Reconstruction Picture
    def get_recon_picture_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> list[ReconPictureCheckpoint]:
        return self._recon_stage.get_recon_picture_data(job_id, ctu_x=ctu_x, ctu_y=ctu_y)

    # Stage CP_06: In-Loop Filtering
    def get_inloop_filter_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> InLoopFilterFullResponse:
        return self._filter_stage.get_inloop_filter_data(job_id, ctu_x=ctu_x, ctu_y=ctu_y)

    # Stage CP_07: CABAC Entropy
    def get_cabac_entropy_data(
        self,
        job_id: str,
        limit: int = 500
    ) -> CabacEntropyFullResponse:
        return self._cabac_stage.get_cabac_entropy_data(job_id, limit=limit)


analysis_service = AnalysisService()
