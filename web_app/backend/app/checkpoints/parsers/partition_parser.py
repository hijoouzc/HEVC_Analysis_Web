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

            # HM C++ VisualDumper always emits absolute frame coordinates:
            # x = cu->getCUPelX() + rasterPelX, y = cu->getCUPelY() + rasterPelY
            if raw_x >= ctu_origin_x:
                abs_x = raw_x
                rel_x = raw_x - ctu_origin_x
            else:
                abs_x = ctu_origin_x + raw_x
                rel_x = raw_x

            if raw_y >= ctu_origin_y:
                abs_y = raw_y
                rel_y = raw_y - ctu_origin_y
            else:
                abs_y = ctu_origin_y + raw_y
                rel_y = raw_y

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
        
        ctu_actual_bits = raw_data.get("actual_bits_ctu", raw_data.get("ctu_actual_bits"))
        ctu_rs_addr = raw_data.get("ctu_rs_addr")

        return CTUPartitionCheckpoint(
            poc=raw_data.get("poc", 0),
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_size=cu_size,
            nodes=normalized_nodes,
            ctu_actual_bits=int(ctu_actual_bits) if ctu_actual_bits is not None else None,
            ctu_rs_addr=int(ctu_rs_addr) if ctu_rs_addr is not None else None,
            total_nodes=len(normalized_nodes),
            leaf_nodes=len(leaf_nodes),
            max_depth=max_depth,
            split_count=split_count
        )

partition_parser = PartitionParser()
