from app.domain.models.checkpoint import CabacEntropyFullResponse
from app.domain.exceptions import JobNotFoundError
from app.checkpoints.parsers.cabac_bin_parser import cabac_bin_parser
from app.services.stages.base import BaseStageService

class CabacStageService(BaseStageService):
    """CP_07_CABAC_ENTROPY: Context adaptive binary arithmetic coding, binarization and bit breakdown"""

    def get_cabac_entropy_data(
        self,
        job_id: str,
        limit: int = 500
    ) -> CabacEntropyFullResponse:
        trace_path = self.storage.get_trace_path(job_id)
        if not trace_path.exists():
            raise JobNotFoundError(job_id)
        raw_bins = self.reader.read_all(trace_path, event_filter="CABAC_BIN")
        
        bins = []
        breakdown: dict[str, int] = {}
        total_bits = 0
        prev_cumulative = None
        for b in raw_bins:
            elem = b.get("syntax_element", "other")
            if "cumulative_bits" in b:
                bit_count = int(b.get("bits", 1))
            else:
                curr_bits = int(b.get("bits", 1))
                if prev_cumulative is not None and curr_bits >= prev_cumulative:
                    bit_count = curr_bits - prev_cumulative
                else:
                    bit_count = 1
                prev_cumulative = curr_bits
            total_bits += bit_count
            breakdown[elem] = breakdown.get(elem, 0) + bit_count
            if len(bins) < limit:
                bins.append(cabac_bin_parser.parse_event(b))

        return CabacEntropyFullResponse(
            bins=bins,
            total_bins=len(raw_bins),
            total_bits=total_bits,
            syntax_breakdown=breakdown
        )
