from app.domain.models.checkpoint import (
    CTUPartitionCheckpoint,
    CuRdoDecisionCheckpoint,
    CUInspectionResponse,
    CUInspectionSpatial,
    CUInspectionIntra,
    CUInspectionInter,
    CUInspectionTransform,
    CUInspectionMatrices,
)
from app.domain.exceptions import JobNotFoundError, InvalidInputError
from app.domain.constants import INTRA_PRED_MODES
from app.domain.enums import JobStatus
from app.checkpoints.parsers.partition_parser import partition_parser
from app.checkpoints.parsers.cu_rdo_decision_parser import cu_rdo_decision_parser
from app.services.stages.base import BaseStageService

class PartitionStageService(BaseStageService):
    """CP_01_PARTITION & CU QuadTree RDO: Partition trees, split decisions, and 360-degree CU glass-box inspection"""

    def get_partition_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        poc: int | None = None,
    ) -> CTUPartitionCheckpoint:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        target_cu, target_x, target_y = self.resolve_target_roi(job_id, None, ctu_x, ctu_y)
        raw_part = None
        if target_x is not None and target_y is not None:
            raw_part = self.reader.find_one(
                trace_path,
                lambda e: e.get("ctu_x") == target_x and e.get("ctu_y") == target_y and (poc is None or e.get("poc", 0) == poc),
                event_filter="CTU_PARTITION",
                ctu_x=target_x,
                ctu_y=target_y,
            )
            # CRITICAL FIX: If target_x and target_y were specified but not found, DO NOT fall back to arbitrary CTU (0,0)
            if not raw_part:
                return CTUPartitionCheckpoint(cu_size=64, nodes=[], ctu_x=target_x, ctu_y=target_y, poc=poc or 0)
        else:
            # Fallback only when caller did not request any specific CTU coordinate
            raw_part = self.reader.find_one(
                trace_path,
                lambda e: poc is None or e.get("poc", 0) == poc,
                event_filter="CTU_PARTITION",
            )

        if not raw_part:
            return CTUPartitionCheckpoint(cu_size=64, nodes=[], ctu_x=target_x or 0, ctu_y=target_y or 0, poc=poc or 0)

        parsed = partition_parser.parse_event(raw_part)
        if target_x is not None and (parsed.ctu_x is None or parsed.ctu_x == 0):
            parsed.ctu_x = target_x
        if target_y is not None and (parsed.ctu_y is None or parsed.ctu_y == 0):
            parsed.ctu_y = target_y

        # Merge CTU_ACTUAL_BITS if available
        try:
            actual_bits_ev = self.reader.find_one(
                trace_path,
                lambda e: e.get("ctu_x") == parsed.ctu_x and e.get("ctu_y") == parsed.ctu_y and (poc is None or e.get("poc", 0) == poc),
                event_filter="CTU_ACTUAL_BITS",
                ctu_x=parsed.ctu_x,
                ctu_y=parsed.ctu_y,
            )
            if actual_bits_ev:
                parsed.ctu_actual_bits = int(actual_bits_ev.get("actual_bits_ctu", 0))
                if actual_bits_ev.get("ctu_rs_addr") is not None:
                    parsed.ctu_rs_addr = int(actual_bits_ev["ctu_rs_addr"])
        except Exception:
            pass

        return parsed

    def get_all_partitions(self, job_id: str) -> list[CTUPartitionCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        raw_parts = self.reader.read_all(trace_path, event_filter="CTU_PARTITION")
        try:
            ctu_bits_events = self.reader.read_all(trace_path, event_filter="CTU_ACTUAL_BITS")
            bits_map = {f"{e.get('ctu_x')}_{e.get('ctu_y')}": e for e in ctu_bits_events}
        except Exception:
            bits_map = {}

        results = []
        for p in raw_parts:
            part = partition_parser.parse_event(p)
            key = f"{part.ctu_x}_{part.ctu_y}"
            if key in bits_map:
                ev = bits_map[key]
                part.ctu_actual_bits = int(ev.get("actual_bits_ctu", 0))
                if ev.get("ctu_rs_addr") is not None:
                    part.ctu_rs_addr = int(ev["ctu_rs_addr"])
            results.append(part)
        return results

    def get_cu_rdo_decisions(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
        cu_x: int | None = None,
        cu_y: int | None = None,
        cu_size: int | None = None
    ) -> list[CuRdoDecisionCheckpoint]:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        raw_events = self.reader.read_all(trace_path, event_filter="CU_RDO_DECISION", ctu_x=ctu_x, ctu_y=ctu_y)
        if ctu_x is not None:
            raw_events = [e for e in raw_events if e.get("ctu_x") == ctu_x]
        if ctu_y is not None:
            raw_events = [e for e in raw_events if e.get("ctu_y") == ctu_y]
        if cu_x is not None:
            raw_events = [e for e in raw_events if e.get("cu_x") == cu_x]
        if cu_y is not None:
            raw_events = [e for e in raw_events if e.get("cu_y") == cu_y]
        if cu_size is not None:
            raw_events = [e for e in raw_events if e.get("cu_size") == cu_size]

        return [cu_rdo_decision_parser.parse_event(e) for e in raw_events]

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
        """
        Gathers multi-stage glass-box telemetry for an arbitrary CU coordinate:
        spatial quadtree node, RDO decision, intra/inter prediction, transform/quant, and matrices.
        """
        # 1. Strictly validate non-negative coordinates
        if ctu_x < 0 or ctu_y < 0 or cu_x < 0 or cu_y < 0 or poc < 0:
            raise InvalidInputError("Coordinates and POC must be non-negative integers.")

        # 2. Check if job is actively running/pending
        if self.job_mgr:
            job = self.job_mgr.get_job_sync(job_id) if hasattr(self.job_mgr, "get_job_sync") else None
            if job and job.status in (JobStatus.PENDING, JobStatus.RUNNING):
                return CUInspectionResponse(
                    is_available=False,
                    status="NOT_ENCODED_YET",
                    job_id=job_id,
                    poc=poc,
                )

        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)

        # 3. Validate against picture boundary if sequence metadata is present
        seq_ev = self.reader.find_one(trace_path, lambda _: True, event_filter="SEQUENCE_METADATA")
        if seq_ev and "sps" in seq_ev:
            pic_w = seq_ev["sps"].get("pic_width_in_luma_samples", 0)
            pic_h = seq_ev["sps"].get("pic_height_in_luma_samples", 0)
            if (pic_w > 0 and cu_x >= pic_w) or (pic_h > 0 and cu_y >= pic_h):
                raise InvalidInputError(
                    f"Coordinate ({cu_x}, {cu_y}) exceeds picture dimensions ({pic_w}x{pic_h})."
                )

        # 4. Fetch CTU partition data matching (ctu_x, ctu_y, poc)
        partition_data = self.get_partition_data(job_id, ctu_x=ctu_x, ctu_y=ctu_y, poc=poc)
        if not partition_data or not partition_data.nodes:
            return CUInspectionResponse(
                is_available=False,
                status="NOT_FOUND_IN_TREE",
                job_id=job_id,
                poc=poc,
            )

        # 5. Find leaf node covering (cu_x, cu_y)
        target_node = None
        for node in partition_data.nodes:
            if not node.split:
                if node.x <= cu_x < (node.x + node.width) and node.y <= cu_y < (node.y + node.height):
                    target_node = node
                    break

        if target_node is None:
            return CUInspectionResponse(
                is_available=False,
                status="NOT_FOUND_IN_TREE",
                job_id=job_id,
                poc=poc,
            )

        # 6. Build Spatial model
        spatial = CUInspectionSpatial(
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_x=target_node.x,
            cu_y=target_node.y,
            cu_size=target_node.width,
            depth=target_node.depth,
            split=target_node.split,
            mode=target_node.mode or "INTRA",
            part_size=target_node.part_size,
            cu_transquant_bypass_flag=target_node.cu_transquant_bypass_flag or False,
            qp=target_node.qp or 32,
            cost=target_node.cost or 0.0,
        )

        # 7. RDO Decision
        rdo = None
        rdo_events = self.reader.read_all(
            trace_path,
            event_filter="CU_RDO_DECISION",
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            predicate=lambda e: (
                e.get("poc", 0) == poc and
                e.get("cu_x") == target_node.x and
                e.get("cu_y") == target_node.y and
                e.get("cu_size") == target_node.width
            ),
        )
        if rdo_events:
            rdo = cu_rdo_decision_parser.parse_event(rdo_events[0])

        # 8. Intra Prediction
        intra = None
        if (target_node.mode or "").upper() == "INTRA":
            # In HM, RDO_INTRA_SEARCH and INTRA_REF_SAMPLES emit PU coordinates (pu_x, pu_y)
            intra_ev = self.reader.find_one(
                trace_path,
                lambda e: (
                    e.get("poc", 0) == poc and
                    target_node.x <= e.get("pu_x", e.get("cu_x", -1)) < target_node.x + target_node.width and
                    target_node.y <= e.get("pu_y", e.get("cu_y", -1)) < target_node.y + target_node.height and
                    (e.get("is_winner") or e.get("mode") == target_node.intra_dir)
                ),
                event_filter="RDO_INTRA_SEARCH",
                ctu_x=ctu_x,
                ctu_y=ctu_y,
            )
            dir_name = INTRA_PRED_MODES.get(target_node.intra_dir, "Unknown") if target_node.intra_dir is not None else None

            ref_ev = self.reader.find_one(
                trace_path,
                lambda e: (
                    e.get("poc", 0) == poc and
                    target_node.x <= e.get("pu_x", e.get("cu_x", -1)) < target_node.x + target_node.width and
                    target_node.y <= e.get("pu_y", e.get("cu_y", -1)) < target_node.y + target_node.height
                ),
                event_filter="INTRA_REF_SAMPLES",
                ctu_x=ctu_x,
                ctu_y=ctu_y,
            )
            strong_smooth = bool(ref_ev.get("strong_smoothing") or ref_ev.get("strong_smoothing_eligible")) if ref_ev else False

            winner_c = target_node.cost
            if intra_ev:
                winner_c = float(intra_ev.get("cost_rdo", intra_ev.get("cost", target_node.cost or 0.0)))

            intra = CUInspectionIntra(
                intra_dir=target_node.intra_dir,
                direction_name=dir_name,
                is_mpm=bool(intra_ev.get("is_mpm")) if intra_ev else False,
                strong_smoothing=strong_smooth,
                winner_cost=winner_c,
                distortion=float(intra_ev.get("dist", intra_ev.get("sse", 0))) if intra_ev else None,
                bits=float(intra_ev.get("bits", 0)) if intra_ev else None,
            )

        # 9. Inter Prediction
        inter = None
        if (target_node.mode or "").upper() in ("INTER", "SKIP"):
            # In HM, INTER_SEARCH emits PU coordinates (pu_x, pu_y)
            inter_ev = self.reader.find_one(
                trace_path,
                lambda e: (
                    e.get("poc", 0) == poc and
                    target_node.x <= e.get("pu_x", e.get("cu_x", -1)) < target_node.x + target_node.width and
                    target_node.y <= e.get("pu_y", e.get("cu_y", -1)) < target_node.y + target_node.height
                ),
                event_filter="INTER_SEARCH",
                ctu_x=ctu_x,
                ctu_y=ctu_y,
            )
            if inter_ev:
                mv_l0 = inter_ev.get("mv_l0")
                if mv_l0 is None:
                    if "mv_x" in inter_ev and "mv_y" in inter_ev:
                        mv_l0 = [int(inter_ev["mv_x"]), int(inter_ev["mv_y"])]
                    else:
                        mv_l0 = []

                mvd_l0 = inter_ev.get("mvd_l0")
                if mvd_l0 is None:
                    if "mvd_x" in inter_ev and "mvd_y" in inter_ev:
                        mvd_l0 = [int(inter_ev["mvd_x"]), int(inter_ev["mvd_y"])]
                    else:
                        mvd_l0 = []

                mv_l1 = inter_ev.get("mv_l1")
                if mv_l1 is None:
                    if "mv_x_l1" in inter_ev and "mv_y_l1" in inter_ev:
                        mv_l1 = [int(inter_ev["mv_x_l1"]), int(inter_ev["mv_y_l1"])]
                    else:
                        mv_l1 = []

                ref_idx_l0 = inter_ev.get("ref_idx_l0", inter_ev.get("ref_idx", -1))
                ref_idx_l1 = inter_ev.get("ref_idx_l1", -1)

                inter = CUInspectionInter(
                    is_skipped=(target_node.mode or "").upper() == "SKIP",
                    mv_l0=mv_l0,
                    ref_idx_l0=ref_idx_l0,
                    mv_l1=mv_l1,
                    ref_idx_l1=ref_idx_l1,
                    mvd_l0=mvd_l0,
                )

        # 10. Transform & Quantization (collect all TUs in CU for RQT tree support)
        transform = None
        transforms: list[CUInspectionTransform] = []
        matrices = None

        tq_events = self.reader.read_all(
            trace_path,
            event_filter="TRANSFORM_QUANT",
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            predicate=lambda e: (
                e.get("poc", 0) == poc and
                target_node.x <= e.get("tu_x", e.get("cu_x", -1)) < target_node.x + target_node.width and
                target_node.y <= e.get("tu_y", e.get("cu_y", -1)) < target_node.y + target_node.height
            ),
        )

        primary_tq_ev = None
        for ev in tq_events:
            sig_count = ev.get("sig_coeff_count", 0)
            comp_name = str(ev.get("component", "Y"))
            tu_m = CUInspectionTransform(
                tu_x=int(ev.get("tu_x", ev.get("cu_x", target_node.x))),
                tu_y=int(ev.get("tu_y", ev.get("cu_y", target_node.y))),
                width=int(ev.get("width", ev.get("cu_size", target_node.width))),
                height=int(ev.get("height", ev.get("cu_size", target_node.height))),
                component=comp_name,
                tu_depth=ev.get("tu_depth", 0),
                is_dst=bool(ev.get("is_dst")),
                is_transform_skip=bool(ev.get("is_transform_skip")),
                cbf=bool(ev.get("cbf", sig_count > 0)),
                sig_coeff_count=sig_count,
                energy_compaction_ratio=float(ev.get("energy_compaction_ratio", 0.0)),
                qp=int(ev.get("qp", target_node.qp or 32)),
            )
            transforms.append(tu_m)
            # Pick primary luma TU (component Y) for backward-compatible singular transform
            if primary_tq_ev is None and comp_name in ("Y", "0"):
                primary_tq_ev = ev
                transform = tu_m

        if transform is None and transforms:
            transform = transforms[0]
            primary_tq_ev = tq_events[0]

        if primary_tq_ev and include_matrices:
            matrices = CUInspectionMatrices(
                residual=primary_tq_ev.get("residual", primary_tq_ev.get("resi_matrix", [])),
                transform_coeff=primary_tq_ev.get("transform_coeff", primary_tq_ev.get("dct_coeff", [])),
                quant_coeff=primary_tq_ev.get("quant_coeff", []),
                dequant_coeff=primary_tq_ev.get("dequant_coeff", []),
            )

        return CUInspectionResponse(
            is_available=True,
            status="FOUND",
            job_id=job_id,
            poc=poc,
            spatial=spatial,
            rdo=rdo,
            intra=intra,
            inter=inter,
            transform=transform,
            transforms=transforms,
            matrices=matrices,
        )
