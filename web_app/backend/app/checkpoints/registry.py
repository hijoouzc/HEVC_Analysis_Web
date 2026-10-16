from app.checkpoints.base_parser import BaseCheckpointParser
from app.checkpoints.parsers.intra_search_parser import intra_search_parser
from app.checkpoints.parsers.intra_ref_parser import intra_ref_parser
from app.checkpoints.parsers.partition_parser import partition_parser
from app.checkpoints.parsers.cu_rdo_decision_parser import cu_rdo_decision_parser
from app.checkpoints.parsers.transform_parser import transform_parser, quant_parser

class CheckpointRegistry:
    def __init__(self):
        self._parsers_by_stage: dict[str, BaseCheckpointParser] = {}
        self._parsers_by_event: dict[str, BaseCheckpointParser] = {}
        self._descriptions: dict[str, tuple[str, str]] = {} # stage_id -> (Name, Description)
        
        # Sprint 3: Partitioning & RDO Decisions
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
        
        # Sprint 2: Intra Reference & Prediction Search
        self.register(
            intra_ref_parser,
            name="Intra Reference Sample Preparation & Filtering",
            description="Extracts 4N+1 neighbor reference samples before and after MDIS 3-tap / Strong Intra Smoothing."
        )
        self.register(
            intra_search_parser,
            name="Intra Prediction Mode Search",
            description="Evaluates all 35 directional, planar, and DC intra prediction candidates and calculates RD cost."
        )
        
        # Sprint 3: Transform & Quantization
        self.register(
            transform_parser,
            name="Residual 2D Transform (DCT/DST)",
            description="Transforms spatial residual matrix into 2D frequency coefficients and evaluates energy compaction."
        )
        self.register(
            quant_parser,
            name="Forward Quantization (QCoeff)",
            description="Applies scalar quantization with QP scaling, analyzing high-frequency zeroing and sparsity ratio."
        )

        # Standard 8 Checkpoint Suite Descriptions
        self._descriptions.update({
            "CP_00_FRAME_GOP": (
                "Frame & GOP Reference Hierarchy",
                "Analyzes Picture Order Count (POC), temporal layers, and DPB Reference Picture Lists L0/L1."
            ),
            "CP_02_INTRA_SEARCH": (
                "Intra Spatial Prediction Search",
                "Evaluates all 35 directional, planar, and DC intra prediction candidates with 5-stage RDO pipeline."
            ),
            "CP_03_INTER_SEARCH": (
                "Inter Prediction & Motion Estimation",
                "Evaluates Motion Estimation (ME/MC), motion vectors (MV/MVD), and AMVP candidate lists."
            ),
            "CP_04_TRANSFORM_RQT": (
                "Residual Transform & RQT Hierarchy",
                "Transforms spatial residual matrix into 2D frequency spectrum (DCT-II / DST-VII) and quantization levels."
            ),
            "CP_05_RECON_PICTURE": (
                "Reconstructed Picture Buffer (S')",
                "Inspects discrete reconstructed picture planar samples (m_cPicYuvRec) pre-in-loop filter."
            ),
            "CP_06_INLOOP_FILTER": (
                "In-Loop Deblocking & SAO Filtering",
                "Applies boundary strength (bS) deblocking filter and Sample Adaptive Offset (SAO) corrections."
            ),
            "CP_07_CABAC_ENTROPY": (
                "CABAC Context Modeling & Entropy Coding",
                "Encodes syntax elements into binary arithmetic bitstream using 63-state FSM context models."
            ),
        })

    def register(self, parser: BaseCheckpointParser, name: str, description: str):
        self._parsers_by_stage[parser.stage_id] = parser
        self._parsers_by_event[parser.event_name] = parser
        self._descriptions[parser.stage_id] = (name, description)

    def get_by_stage(self, stage_id: str) -> BaseCheckpointParser | None:
        return self._parsers_by_stage.get(stage_id)

    def get_by_event(self, event_name: str) -> BaseCheckpointParser | None:
        return self._parsers_by_event.get(event_name)

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
