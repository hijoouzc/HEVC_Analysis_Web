import logging
from app.domain.models.checkpoint import (
    IntraModeData,
    IntraSearchSummary,
    IntraRefCheckpoint,
    IntraComparisonResult,
    IntraPipelineFullResponse,
)
from app.domain.exceptions import JobNotFoundError, InvalidInputError
from app.checkpoints.parsers.intra_search_parser import intra_search_parser, build_intra_pipeline_data
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.services.stages.base import BaseStageService
from app.services.stages.partition_stage import PartitionStageService
from app.services.stages.transform_stage import TransformStageService

logger = logging.getLogger(__name__)


def _select_single_pu_events(raw_modes: list[dict], cu_x: int | None, cu_y: int | None) -> list[dict]:
    """Ensure 35-mode list comes from a single PU when cu_x/cu_y weren't specified."""
    if not raw_modes or (cu_x is not None and cu_y is not None):
        return raw_modes[:35]
    first = raw_modes[0]
    first_poc = first.get("poc", 0)
    first_ctu_x = first.get("ctu_x")
    first_ctu_y = first.get("ctu_y")
    first_px = first.get("pu_x", first.get("cu_x"))
    first_py = first.get("pu_y", first.get("cu_y"))
    filtered = [
        e for e in raw_modes
        if e.get("poc", 0) == first_poc
        and e.get("ctu_x") == first_ctu_x
        and e.get("ctu_y") == first_ctu_y
        and e.get("pu_x", e.get("cu_x")) == first_px
        and e.get("pu_y", e.get("cu_y")) == first_py
    ]
    return filtered[:35]


class IntraStageService(BaseStageService):
    """CP_02_INTRA_SEARCH & CP_02_INTRA_REF: Intra-prediction reference filtering, rough search, and MPM/Full RDO"""

    def __init__(
        self,
        storage=None,
        reader=None,
        registry=None,
        job_mgr=None,
        partition_service: PartitionStageService | None = None,
        transform_service: TransformStageService | None = None
    ):
        super().__init__(storage, reader, registry, job_mgr)
        self.partition_service = partition_service or PartitionStageService(storage, reader, registry, job_mgr)
        self.transform_service = transform_service or TransformStageService(storage, reader, registry, job_mgr)

    @staticmethod
    def _build_fallback_ref_checkpoint(raw_mode: dict) -> IntraRefCheckpoint:
        """Construct IntraRefCheckpoint from RDO_INTRA_SEARCH event when INTRA_REF_SAMPLES is absent."""
        ref_top = raw_mode.get("ref_top", [])
        ref_left = raw_mode.get("ref_left", [])
        ref_top_u = raw_mode.get("ref_top_u", [])
        ref_left_u = raw_mode.get("ref_left_u", [])
        ref_top_v = raw_mode.get("ref_top_v", [])
        ref_left_v = raw_mode.get("ref_left_v", [])
        return IntraRefCheckpoint(
            poc=raw_mode.get("poc", 0),
            ctu_x=raw_mode.get("ctu_x", 0),
            ctu_y=raw_mode.get("ctu_y", 0),
            cu_size=raw_mode.get("cu_size", 8),
            ref_unfilt_top=ref_top,
            ref_unfilt_left=ref_left,
            ref_filt_top=ref_top,
            ref_filt_left=ref_left,
            ref_unfilt_top_u=ref_top_u,
            ref_unfilt_left_u=ref_left_u,
            ref_unfilt_top_v=ref_top_v,
            ref_unfilt_left_v=ref_left_v,
            ref_filt_top_u=ref_top_u,
            ref_filt_left_u=ref_left_u,
            ref_filt_top_v=ref_top_v,
            ref_filt_left_v=ref_left_v,
            luma_ref_count=len(ref_top)
        )

    def get_intra_search_data(
        self,
        job_id: str,
        mode: int | None = None,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        poc: int | None = None
    ) -> list[IntraModeData]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        target_cu, target_x, target_y = self.resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)
        if target_cu is None or target_cu <= 0:
            target_cu = 8
        if target_x is not None and target_x < 0:
            target_x = None
        if target_y is not None and target_y < 0:
            target_y = None
        predicate = self.build_roi_predicate(
            cu_size=target_cu,
            ctu_x=target_x,
            ctu_y=target_y,
            cu_x=cu_x,
            cu_y=cu_y,
            poc=poc,
        )

        # Read matching events (avoid slicing at 35 before disambiguating PU)
        read_limit = 35 if (cu_x is not None and cu_y is not None) else 500
        raw_modes = self.reader.read_all(
            trace_path,
            event_filter="RDO_INTRA_SEARCH",
            limit=read_limit,
            predicate=predicate,
            ctu_x=target_x,
            ctu_y=target_y
        )
        explicit_roi_requested = (ctu_x is not None or ctu_y is not None or cu_x is not None or cu_y is not None)
        if not raw_modes and not explicit_roi_requested:
            raw_modes = self.reader.read_all(
                trace_path,
                event_filter="RDO_INTRA_SEARCH",
                limit=read_limit,
                predicate=(lambda e: e.get("poc", 0) == poc) if poc is not None else None,
            )

        raw_modes = _select_single_pu_events(raw_modes, cu_x, cu_y)
        parsed = [intra_search_parser.parse_event(m) for m in raw_modes]
        ranked = intra_search_parser.enrich_and_rank(parsed)

        if mode is not None:
            return [m for m in ranked if m.mode == mode]
        return ranked

    def get_intra_search_summary(self, job_id: str, poc: int | None = None) -> IntraSearchSummary:
        modes = self.get_intra_search_data(job_id, poc=poc)
        return intra_search_parser.compute_summary(modes)

    def get_intra_ref_data(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        poc: int | None = None
    ) -> IntraRefCheckpoint:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        target_cu, target_x, target_y = self.resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)
        if target_cu is None or target_cu <= 0:
            target_cu = 8
        if target_x is not None and target_x < 0:
            target_x = None
        if target_y is not None and target_y < 0:
            target_y = None

        explicit_ctu_requested = (ctu_x is not None or ctu_y is not None)
        ref_pred = self.build_roi_predicate(
            cu_size=target_cu,
            ctu_x=target_x,
            ctu_y=target_y,
            cu_x=cu_x,
            cu_y=cu_y,
            poc=poc,
        )

        # Pass event_filter + ctu_x/ctu_y to use O(1) TraceReader index
        raw_ref = self.reader.find_one(
            trace_path,
            ref_pred,
            event_filter="INTRA_REF_SAMPLES",
            ctu_x=target_x,
            ctu_y=target_y,
        )
        if not raw_ref and (cu_x is not None or cu_y is not None):
            ref_pred_no_pos = self.build_roi_predicate(
                cu_size=target_cu,
                ctu_x=target_x,
                ctu_y=target_y,
                poc=poc,
            )
            raw_ref = self.reader.find_one(
                trace_path,
                ref_pred_no_pos,
                event_filter="INTRA_REF_SAMPLES",
                ctu_x=target_x,
                ctu_y=target_y,
            )
        if not raw_ref and not explicit_ctu_requested:
            raw_ref = self.reader.find_one(
                trace_path,
                (lambda e: e.get("poc", 0) == poc) if poc is not None else (lambda _: True),
                event_filter="INTRA_REF_SAMPLES",
            )

        if not raw_ref:
            rdo_pred = self.build_roi_predicate(
                cu_size=target_cu,
                ctu_x=target_x,
                ctu_y=target_y,
                cu_x=cu_x,
                cu_y=cu_y,
                poc=poc,
            )
            raw_mode = self.reader.find_one(
                trace_path,
                rdo_pred,
                event_filter="RDO_INTRA_SEARCH",
                ctu_x=target_x,
                ctu_y=target_y,
            )
            if not raw_mode and not explicit_ctu_requested:
                raw_mode = self.reader.find_one(
                    trace_path,
                    (lambda e: e.get("poc", 0) == poc) if poc is not None else (lambda _: True),
                    event_filter="RDO_INTRA_SEARCH",
                )
            if not raw_mode:
                if explicit_ctu_requested:
                    return IntraRefCheckpoint(
                        poc=poc or 0,
                        ctu_x=target_x or 0,
                        ctu_y=target_y or 0,
                        cu_size=target_cu,
                        filter_applied=False,
                    )
                raise JobNotFoundError(job_id)
            return self._build_fallback_ref_checkpoint(raw_mode)

        return intra_ref_parser.parse_event(raw_ref)

    def compare_intra_modes(
        self,
        job_id: str,
        mode_a: int,
        mode_b: int,
        cu_size: int | None = None
    ) -> IntraComparisonResult:
        modes = self.get_intra_search_data(job_id, cu_size=cu_size)
        m_a = next((m for m in modes if m.mode == mode_a), None)
        m_b = next((m for m in modes if m.mode == mode_b), None)
        
        if not m_a:
            raise InvalidInputError(f"Mode {mode_a} not found in job {job_id}")
        if not m_b:
            raise InvalidInputError(f"Mode {mode_b} not found in job {job_id}")
            
        diff_matrix = [pa - pb for pa, pb in zip(m_a.pred_data, m_b.pred_data)]
        sad_diff = sum(abs(d) for d in diff_matrix)
        cost_diff = round(m_b.cost - m_a.cost, 4)
        better_mode = m_a.mode if m_a.cost <= m_b.cost else m_b.mode
        
        # Residual and SSE comparison
        resi_diff = [ra - rb for ra, rb in zip(m_a.resi_data, m_b.resi_data)] if m_a.resi_data and m_b.resi_data else []
        sse_a = sum(ra * ra for ra in m_a.resi_data) if m_a.resi_data else 0
        sse_b = sum(rb * rb for rb in m_b.resi_data) if m_b.resi_data else 0
        sse_diff = sse_b - sse_a
        
        return IntraComparisonResult(
            mode_a=m_a.mode,
            mode_b=m_b.mode,
            direction_a=m_a.direction_name,
            direction_b=m_b.direction_name,
            cost_a=m_a.cost,
            cost_b=m_b.cost,
            cost_difference=cost_diff,
            better_mode=better_mode,
            pixel_sad_diff=sad_diff,
            pixel_diff_matrix=diff_matrix,
            resi_diff_matrix=resi_diff,
            sse_a=sse_a,
            sse_b=sse_b,
            sse_diff=sse_diff,
            cu_size=m_a.cu_size
        )

    def get_intra_pipeline_data(
        self,
        job_id: str,
        cu_size: int | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        poc: int | None = None
    ) -> IntraPipelineFullResponse:
        modes = self.get_intra_search_data(
            job_id,
            cu_size=cu_size,
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_x=cu_x,
            cu_y=cu_y,
            poc=poc
        )
        ref_checkpoint = self.get_intra_ref_data(
            job_id,
            cu_size=cu_size,
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_x=cu_x,
            cu_y=cu_y,
            poc=poc
        )

        target_cu, target_x, target_y = self.resolve_target_roi(job_id, cu_size, ctu_x, ctu_y)
        if target_x is not None and target_x < 0:
            target_x = None
        if target_y is not None and target_y < 0:
            target_y = None
        active_cu_size = target_cu or (modes[0].cu_size if modes else 8)
        active_ctu_x = target_x if target_x is not None else (modes[0].ctu_x if modes else 0)
        active_ctu_y = target_y if target_y is not None else (modes[0].ctu_y if modes else 0)
        active_poc = poc if poc is not None else (modes[0].poc if modes else 0)

        # Disambiguate PU within CTU so multiple PUs of same size don't mix
        target_pu_x = cu_x
        target_pu_y = cu_y
        if target_pu_x is None and modes and modes[0].pu_x is not None:
            target_pu_x = modes[0].pu_x
        if target_pu_y is None and modes and modes[0].pu_y is not None:
            target_pu_y = modes[0].pu_y

        # Spatial neighbor Intra modes for fallback MPM derivation (H.265 Section 8.4.2)
        left_mode, above_mode = None, None
        try:
            part = self.partition_service.get_partition_data(
                job_id, ctu_x=active_ctu_x, ctu_y=active_ctu_y, poc=active_poc
            )
            ref_x = target_pu_x if target_pu_x is not None else active_ctu_x * 64
            ref_y = target_pu_y if target_pu_y is not None else active_ctu_y * 64
            left_px, left_py = ref_x - 1, ref_y
            above_px, above_py = ref_x, ref_y - 1
            for node in part.nodes:
                if node.split or node.mode != "INTRA" or node.intra_dir is None:
                    continue
                if left_px >= 0 and node.x <= left_px < node.x + node.width and node.y <= left_py < node.y + node.height:
                    left_mode = node.intra_dir
                if above_py >= 0 and node.x <= above_px < node.x + node.width and node.y <= above_py < node.y + node.height:
                    above_mode = node.intra_dir
        except Exception as exc:
            logger.debug("Partition neighbor lookup failed for job %s: %s", job_id, exc)

        transform_events = []
        try:
            transform_events = self.transform_service.get_transform_quant_data(
                job_id,
                comp="Y",
                ctu_x=active_ctu_x,
                ctu_y=active_ctu_y,
                cu_x=target_pu_x,
                cu_y=target_pu_y,
                cu_size=active_cu_size,
                poc=active_poc
            )
        except Exception as exc:
            logger.debug("Transform lookup failed for job %s: %s", job_id, exc)

        mpm_raw_event = None
        full_rdo_events = []
        tu_pred_events = []
        chroma_raw_event = None
        explicit_ctu_requested = (ctu_x is not None or ctu_y is not None)
        try:
            trace_path = self.storage.get_trace_path(job_id)
            if trace_path.exists():
                def _matches_pu_event(ev: dict) -> bool:
                    if ev.get("poc", 0) != active_poc:
                        return False
                    if ctu_x is not None and ev.get("ctu_x") != active_ctu_x:
                        return False
                    if ctu_y is not None and ev.get("ctu_y") != active_ctu_y:
                        return False
                    if cu_size is not None and ev.get("pu_size", ev.get("cu_size")) != active_cu_size:
                        return False
                    if target_pu_x is not None and ev.get("pu_x", ev.get("cu_x")) != target_pu_x:
                        return False
                    if target_pu_y is not None and ev.get("pu_y", ev.get("cu_y")) != target_pu_y:
                        return False
                    return True

                all_mpm = self.reader.read_all(trace_path, event_filter="INTRA_MPM_DERIVATION", ctu_x=active_ctu_x, ctu_y=active_ctu_y)
                if not all_mpm and not explicit_ctu_requested:
                    all_mpm = self.reader.read_all(trace_path, event_filter="INTRA_MPM_DERIVATION")
                for e in all_mpm:
                    if _matches_pu_event(e):
                        mpm_raw_event = e
                        if target_pu_x is None:
                            target_pu_x = e.get("pu_x", e.get("cu_x"))
                        if target_pu_y is None:
                            target_pu_y = e.get("pu_y", e.get("cu_y"))
                        break

                all_rdo = self.reader.read_all(trace_path, event_filter="INTRA_FULL_RDO", ctu_x=active_ctu_x, ctu_y=active_ctu_y)
                if not all_rdo and not explicit_ctu_requested:
                    all_rdo = self.reader.read_all(trace_path, event_filter="INTRA_FULL_RDO")
                for e in all_rdo:
                    if _matches_pu_event(e):
                        if target_pu_x is None:
                            target_pu_x = e.get("pu_x", e.get("cu_x"))
                        if target_pu_y is None:
                            target_pu_y = e.get("pu_y", e.get("cu_y"))
                        full_rdo_events.append(e)

                all_tu_pred = self.reader.read_all(trace_path, event_filter="INTRA_TU_PRED", ctu_x=active_ctu_x, ctu_y=active_ctu_y)
                if not all_tu_pred and not explicit_ctu_requested:
                    all_tu_pred = self.reader.read_all(trace_path, event_filter="INTRA_TU_PRED")
                for e in all_tu_pred:
                    if _matches_pu_event(e):
                        tu_pred_events.append(e)

                all_chroma = self.reader.read_all(trace_path, event_filter="INTRA_CHROMA_SEARCH", ctu_x=active_ctu_x, ctu_y=active_ctu_y)
                if not all_chroma and not explicit_ctu_requested:
                    all_chroma = self.reader.read_all(trace_path, event_filter="INTRA_CHROMA_SEARCH")
                for e in all_chroma:
                    if _matches_pu_event(e):
                        chroma_raw_event = e
                        break
                if not chroma_raw_event and active_cu_size == 4:
                    # In HEVC 4:2:0, chroma is not split below 4x4; 4x4 PUs share the 8x8 CU's chroma evaluation
                    for e in all_chroma:
                        if (e.get("poc", 0) == active_poc) and \
                           (ctu_x is None or e.get("ctu_x") == active_ctu_x) and \
                           (ctu_y is None or e.get("ctu_y") == active_ctu_y) and \
                           (e.get("pu_size", e.get("cu_size")) == 8):
                            chroma_raw_event = e
                            break
        except Exception as exc:
            logger.warning("Failed to assemble extended intra pipeline events for job %s: %s", job_id, exc)

        return build_intra_pipeline_data(
            modes=modes,
            ref_checkpoint=ref_checkpoint,
            cu_size=active_cu_size,
            ctu_x=active_ctu_x,
            ctu_y=active_ctu_y,
            poc=active_poc,
            left_mode=left_mode,
            above_mode=above_mode,
            transform_events=transform_events,
            mpm_raw_event=mpm_raw_event,
            full_rdo_events=full_rdo_events if full_rdo_events else None,
            chroma_raw_event=chroma_raw_event,
            cu_x=target_pu_x,
            cu_y=target_pu_y,
            tu_pred_events=tu_pred_events if tu_pred_events else None
        )
