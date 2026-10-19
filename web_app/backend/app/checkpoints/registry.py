from app.checkpoints.base_parser import BaseCheckpointParser
from app.checkpoints.parsers.intra_search_parser import intra_search_parser
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.checkpoints.parsers.partition_parser import partition_parser
from app.checkpoints.parsers.cu_rdo_decision_parser import cu_rdo_decision_parser
from app.checkpoints.parsers.transform_parser import transform_parser, quant_parser
from app.checkpoints.parsers.sequence_metadata_parser import sequence_metadata_parser
from app.checkpoints.parsers.extended_parsers import (
    frame_gop_parser,
    inter_search_parser,
    recon_picture_parser,
    deblocking_edge_parser,
    sao_decision_parser,
    cabac_bin_parser,
)

class CheckpointRegistry:
    def __init__(self):
        self._parsers_by_stage: dict[str, BaseCheckpointParser] = {}
        self._parsers_by_event: dict[str, list[BaseCheckpointParser]] = {}
        self._descriptions: dict[str, tuple[str, str]] = {} # stage_id -> (Name, Description)

        # CP_00: Sequence Parameters & GOP Structure
        self.register(
            sequence_metadata_parser,
            name="Sequence & Picture Parameter Sets (SPS/PPS)",
            description="Exposes SPS and PPS configuration structures directly from HM-18.0 TComSPS and TComPPS."
        )
        self.register(
            frame_gop_parser,
            name="Frame & GOP Reference Hierarchy",
            description="Analyzes Picture Order Count (POC), temporal layers, and DPB Reference Picture Lists L0/L1."
        )

        # CP_01: Partitioning & RDO Decisions
        self.register(
            partition_parser,
            name="CTU QuadTree Partitioning",
            description="Recursively partitions 64x64 CTU into Coding Units (CUs) across depths 0-3 with Z-scan order."
        )
        self.register(
            cu_rdo_decision_parser,
            name="CU Rate-Distortion Optimization Decision",
            description="HM-18.0 xCheckBestMode decision comparing costNoSplit vs costSplit at each CU QuadTree node."
        )

        # CP_02: Intra Prediction & References
        self.register(
            intra_ref_parser,
            name="Intra Reference Sample Preparation & Filtering",
            description="Extracts 4N+1 neighbor reference samples before and after MDIS 3-tap / Strong Intra Smoothing."
        )
        self.register(
            intra_search_parser,
            name="Intra Prediction Mode Search",
            description="Evaluates all 35 directional, planar, and DC intra prediction candidates with 5-stage RDO pipeline."
        )
        self._parsers_by_stage["CP_02_INTRA_SEARCH"] = intra_search_parser
        self._descriptions["CP_02_INTRA_SEARCH"] = (
            "Intra Spatial Prediction Search",
            "Evaluates all 35 directional, planar, and DC intra prediction candidates with 5-stage RDO pipeline."
        )

        # CP_03: Inter Prediction & Motion Estimation
        self.register(
            inter_search_parser,
            name="Inter Prediction & Motion Estimation",
            description="Evaluates Motion Estimation (ME/MC), motion vectors (MV/MVD), and AMVP candidate lists."
        )

        # CP_04 & CP_06: Transform & Quantization (RQT)
        self.register(
            transform_parser,
            name="Residual 2D Transform (DCT/DST)",
            description="Transforms spatial residual matrix into 2D frequency spectrum (DCT-II / DST-VII) and evaluates energy compaction."
        )
        self.register(
            quant_parser,
            name="Forward Quantization (QCoeff)",
            description="Applies scalar quantization with QP scaling, analyzing high-frequency zeroing and sparsity ratio."
        )
        self._parsers_by_stage["CP_04_TRANSFORM_RQT"] = transform_parser
        self._descriptions["CP_04_TRANSFORM_RQT"] = (
            "Residual Transform & RQT Hierarchy",
            "Transforms spatial residual matrix into 2D frequency spectrum (DCT-II / DST-VII) and quantization levels."
        )

        # CP_05: Reconstructed Picture Buffer
        self.register(
            recon_picture_parser,
            name="Reconstructed Picture Buffer (S')",
            description="Inspects discrete reconstructed picture planar samples (m_cPicYuvRec) pre-in-loop filter."
        )

        # CP_06: In-Loop Filtering (Deblocking & SAO)
        self.register(
            deblocking_edge_parser,
            name="In-Loop Deblocking & SAO Filtering",
            description="Applies boundary strength (bS) deblocking filter and Sample Adaptive Offset (SAO) corrections."
        )
        self.register(
            sao_decision_parser,
            name="Sample Adaptive Offset (SAO)",
            description="Performs Edge Offset (EO) and Band Offset (BO) statistical compensation across CTU samples."
        )

        # CP_07: CABAC Entropy Coding
        self.register(
            cabac_bin_parser,
            name="CABAC Context Modeling & Entropy Coding",
            description="Encodes syntax elements into binary arithmetic bitstream using 63-state FSM context models."
        )

    def register(
        self,
        parser: BaseCheckpointParser,
        name: str,
        description: str,
        stage_id_override: str | None = None
    ) -> None:
        target_stage = stage_id_override or parser.stage_id
        self._parsers_by_stage[target_stage] = parser

        if parser.event_name not in self._parsers_by_event:
            self._parsers_by_event[parser.event_name] = []
        if parser not in self._parsers_by_event[parser.event_name]:
            self._parsers_by_event[parser.event_name].append(parser)

        self._descriptions[target_stage] = (name, description)

    def get_by_stage(self, stage_id: str) -> BaseCheckpointParser | None:
        return self._parsers_by_stage.get(stage_id)

    def get_by_event(self, event_name: str, stage_id: str | None = None) -> BaseCheckpointParser | None:
        parsers = self._parsers_by_event.get(event_name, [])
        if not parsers:
            return None
        if stage_id:
            for p in parsers:
                if p.stage_id == stage_id:
                    return p
        return parsers[0]

    def get_all_by_event(self, event_name: str) -> list[BaseCheckpointParser]:
        return list(self._parsers_by_event.get(event_name, []))

    def get_metadata(self, stage_id: str) -> tuple[str, str]:
        return self._descriptions.get(stage_id, (stage_id, ""))

    def list_available_stages(self) -> list[dict[str, str]]:
        return [
            {
                "stage_id": stage_id,
                "name": self._descriptions[stage_id][0],
                "description": self._descriptions[stage_id][1]
            }
            for stage_id in self._descriptions
        ]

checkpoint_registry = CheckpointRegistry()
