from app.domain.models.checkpoint import InLoopFilterFullResponse
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.inloop_filter_parser import deblocking_edge_parser, sao_decision_parser
from app.services.stages.base import BaseStageService

class FilterStageService(BaseStageService):
    """CP_06_INLOOP_FILTER: Deblocking Filter boundary strengths and SAO edge/band offsets"""

    def get_inloop_filter_data(
        self,
        job_id: str,
        ctu_x: int | None = None,
        ctu_y: int | None = None
    ) -> InLoopFilterFullResponse:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_edges = self.reader.read_all(trace_path, event_filter="DEBLOCKING_EDGE", ctu_x=ctu_x, ctu_y=ctu_y)
        raw_sao = self.reader.read_all(trace_path, event_filter="SAO_DECISION", ctu_x=ctu_x, ctu_y=ctu_y)
        if ctu_x is not None:
            raw_edges = [e for e in raw_edges if e.get("ctu_x") == ctu_x]
            raw_sao = [s for s in raw_sao if s.get("ctu_x") == ctu_x]
        if ctu_y is not None:
            raw_edges = [e for e in raw_edges if e.get("ctu_y") == ctu_y]
            raw_sao = [s for s in raw_sao if s.get("ctu_y") == ctu_y]

        edges = [deblocking_edge_parser.parse_event(e) for e in raw_edges]
        sao_res = sao_decision_parser.parse_event(raw_sao[0]) if raw_sao else None

        bs2 = sum(1 for ed in edges if ed.bs == 2)
        bs1 = sum(1 for ed in edges if ed.bs == 1)

        return InLoopFilterFullResponse(
            poc=edges[0].poc if edges else 0,
            ctu_x=ctu_x or 0,
            ctu_y=ctu_y or 0,
            edges=edges,
            sao=sao_res,
            total_edges=len(edges),
            bs2_edges=bs2,
            bs1_edges=bs1
        )
