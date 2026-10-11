from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import CTUPartitionCheckpoint, CUPartitionNode
from app.domain.enums import StageEnum

class PartitionParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_01_PARTITION.value
        
    @property
    def event_name(self) -> str:
        return "CTU_PARTITION"
        
    def parse_event(self, raw_data: dict[str, Any]) -> CTUPartitionCheckpoint:
        raw_nodes = raw_data.get("nodes", [])
        ctu_x = raw_data.get("ctu_x", 0)
        ctu_y = raw_data.get("ctu_y", 0)
        cu_size = raw_data.get("cu_size", 64)
        ctu_origin_x = ctu_x * cu_size
        ctu_origin_y = ctu_y * cu_size

        normalized_nodes = []
        for n in raw_nodes:
            node_dict = dict(n)
            raw_x = node_dict.get("x", 0)
            raw_y = node_dict.get("y", 0)

            # Heuristic-free canonical resolution:
            # If coordinate is already >= origin, it is absolute frame pixel
            # Otherwise if coordinate is < cu_size and origin > 0, it is relative
            if raw_x >= ctu_origin_x and raw_x < (ctu_origin_x + cu_size * 2):
                abs_x = raw_x
                rel_x = raw_x - ctu_origin_x
            elif raw_x < cu_size and ctu_origin_x > 0:
                abs_x = ctu_origin_x + raw_x
                rel_x = raw_x
            else:
                abs_x = raw_x
                rel_x = raw_x % cu_size if cu_size > 0 else 0

            if raw_y >= ctu_origin_y and raw_y < (ctu_origin_y + cu_size * 2):
                abs_y = raw_y
                rel_y = raw_y - ctu_origin_y
            elif raw_y < cu_size and ctu_origin_y > 0:
                abs_y = ctu_origin_y + raw_y
                rel_y = raw_y
            else:
                abs_y = raw_y
                rel_y = raw_y % cu_size if cu_size > 0 else 0

            node_dict["abs_x"] = abs_x
            node_dict["abs_y"] = abs_y
            node_dict["rel_x"] = rel_x
            node_dict["rel_y"] = rel_y
            node_dict["x"] = abs_x
            node_dict["y"] = abs_y

            normalized_nodes.append(CUPartitionNode(**node_dict))
        
        leaf_nodes = [n for n in normalized_nodes if not n.split]
        max_depth = max([n.depth for n in normalized_nodes], default=0)
        split_count = sum(1 for n in normalized_nodes if n.split)
        
        return CTUPartitionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_size=cu_size,
            nodes=normalized_nodes,
            total_nodes=len(normalized_nodes),
            leaf_nodes=len(leaf_nodes),
            max_depth=max_depth,
            split_count=split_count
        )

partition_parser = PartitionParser()
