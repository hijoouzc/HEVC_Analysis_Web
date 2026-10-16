from typing import Any
from app.checkpoints.base_parser import BaseCheckpointParser
from app.domain.models.checkpoint import (
    IntraModeData,
    IntraSearchSummary,
    IntraRefCheckpoint,
    RmdModeItem,
    MpmDerivationInfo,
    CandidateSelectionStep,
    RdoCandidateDetail,
    ChromaCandidateInfo,
    IntraPipelineFullResponse,
    TransformQuantCheckpoint
)
from app.domain.enums import StageEnum

ANG_TABLE = [0, 2, 5, 9, 13, 17, 21, 26, 32]

def get_intra_mode_hevc_info(mode: int) -> tuple[str, str, int]:
    """
    Computes standard HEVC Intra Direction Name, Category, and IntraPredAngle offset.
    According to ITU-T H.265 / HM TComPrediction.cpp
    """
    if mode == 0:
        return "PLANAR", "Planar", 0
    elif mode == 1:
        return "DC", "DC", 0
    elif mode == 10:
        return "ANGULAR", "Horizontal", 0
    elif mode == 26:
        return "ANGULAR", "Vertical", 0
    elif mode == 2:
        return "ANGULAR", "Diagonal Bottom-Left (45°)", 32
    elif mode == 18:
        return "ANGULAR", "Diagonal Top-Left (45°)", -32
    elif mode == 34:
        return "ANGULAR", "Diagonal Top-Right (45°)", 32
        
    is_ver = (mode >= 18)
    angle_mode = (mode - 26) if is_ver else (10 - mode)
    abs_angle_mode = abs(angle_mode)
    sign = -1 if angle_mode < 0 else 1
    abs_ang = ANG_TABLE[abs_angle_mode] if abs_angle_mode < len(ANG_TABLE) else 0
    angle_offset = sign * abs_ang
    
    base_name = "Vertical" if is_ver else "Horizontal"
    dir_name = f"{base_name} ({'+' if angle_offset > 0 else ''}{angle_offset}/32)"
    return "ANGULAR", dir_name, angle_offset

class IntraSearchParser(BaseCheckpointParser):
    @property
    def stage_id(self) -> str:
        return StageEnum.CP_03_INTRA_SEARCH.value
        
    @property
    def event_name(self) -> str:
        return "RDO_INTRA_SEARCH"
        
    def parse_event(self, raw_data: dict[str, Any]) -> IntraModeData:
        mode = raw_data.get("mode", 0)
        category, dir_name, angle_offset = get_intra_mode_hevc_info(mode)
        
        # Merge parsed metadata
        data_copy = dict(raw_data)
        data_copy["category"] = category
        data_copy["direction_name"] = dir_name
        data_copy["angle_offset"] = angle_offset
        data_copy["b_use_filter"] = raw_data.get("b_use_filter", False)
        if "cu_x" not in data_copy and "pu_x" in data_copy:
            data_copy["cu_x"] = data_copy["pu_x"]
        if "cu_y" not in data_copy and "pu_y" in data_copy:
            data_copy["cu_y"] = data_copy["pu_y"]
        if "pu_x" not in data_copy and "cu_x" in data_copy:
            data_copy["pu_x"] = data_copy["cu_x"]
        if "pu_y" not in data_copy and "cu_y" in data_copy:
            data_copy["pu_y"] = data_copy["cu_y"]
        
        return IntraModeData(**data_copy)

    def enrich_and_rank(self, modes: list[IntraModeData]) -> list[IntraModeData]:
        if not modes:
            return []
            
        sorted_modes = sorted(modes, key=lambda m: m.cost)
        best_cost = sorted_modes[0].cost
        
        # Assign rank and cost_delta
        for idx, m in enumerate(sorted_modes, start=1):
            m.rank = idx
            m.cost_delta = round(m.cost - best_cost, 4)
            
        # Return in original mode order (mode 0..34)
        return sorted(sorted_modes, key=lambda m: m.mode)
        
    def compute_summary(self, modes_data: list[IntraModeData]) -> IntraSearchSummary:
        if not modes_data:
            return IntraSearchSummary(
                best_mode=0,
                best_cost=0.0,
                total_modes=0,
                modes=[],
                min_cost=0.0,
                max_cost=0.0,
                cu_size=8,
                ctu_x=0,
                ctu_y=0
            )
            
        best_item = min(modes_data, key=lambda m: m.cost)
        max_item = max(modes_data, key=lambda m: m.cost)
        
        return IntraSearchSummary(
            best_mode=best_item.mode,
            best_cost=round(best_item.cost, 4),
            total_modes=len(modes_data),
            modes=[m.mode for m in modes_data],
            min_cost=round(best_item.cost, 4),
            max_cost=round(max_item.cost, 4),
            cu_size=best_item.cu_size,
            ctu_x=best_item.ctu_x,
            ctu_y=best_item.ctu_y
        )

def get_top_k_threshold(cu_size: int) -> int:
    """
    Candidate pool size for Rough Mode Decision (RMD).
    Ground Truth: HM-18.0 g_aucIntraModeNumFast_UseMPM table:
    - 4x4: 8
    - 8x8: 8
    - 16x16: 3
    - 32x32: 3
    - 64x64: 3
    """
    return 8 if cu_size <= 8 else 3

def derive_mpm(left_mode: int | None = None, above_mode: int | None = None) -> tuple[list[int], str]:
    """
    Derives 3 Most Probable Modes (MPM) strictly adhering to:
    - ITU-T H.265 Section 8.4.2
    - HM-18.0 TComDataCU::getIntraDirPredictor
    """
    PLANAR_IDX = 0
    DC_IDX = 1
    VER_IDX = 26
    
    # If PU neighbor is unavailable or non-intra, HM defaults to DC_IDX (1)
    left = left_mode if (left_mode is not None and 0 <= left_mode <= 34) else DC_IDX
    above = above_mode if (above_mode is not None and 0 <= above_mode <= 34) else DC_IDX
    
    if left == above:
        if left > 1: # Angular mode
            cand0 = left
            cand1 = ((left + 29) % 32) + 2
            cand2 = ((left - 1) % 32) + 2
            rule = f"Left == Above ({left}): Angular -> [{cand0}, {cand1}, {cand2}]"
        else: # Non-angular mode (Planar or DC)
            cand0 = PLANAR_IDX
            cand1 = DC_IDX
            cand2 = VER_IDX
            rule = f"Left == Above ({left}): Non-Angular -> [Planar(0), DC(1), Vertical(26)]"
    else:
        cand0 = left
        cand1 = above
        if left != PLANAR_IDX and above != PLANAR_IDX:
            cand2 = PLANAR_IDX
            rule = f"Left ({left}) != Above ({above}): Both Non-Planar -> [{cand0}, {cand1}, Planar(0)]"
        else:
            cand2 = VER_IDX if (left + above) < 2 else DC_IDX
            cand2_name = "Vertical(26)" if (left + above) < 2 else "DC(1)"
            rule = f"Left ({left}) != Above ({above}): One Planar -> [{cand0}, {cand1}, {cand2_name}]"
            
    return [cand0, cand1, cand2], rule

def get_allowed_chroma_modes(luma_mode: int) -> list[dict[str, Any]]:
    """
    Generates 5 Chroma candidates strictly adhering to:
    - ITU-T H.265 Section 8.4.3
    - HM-18.0 TComDataCU::getAllowedChromaDir
    """
    base_modes = [0, 26, 10, 1] # [Planar, Vertical, Horizontal, DC]
    names = {0: "Planar", 26: "Vertical", 10: "Horizontal", 1: "DC", 34: "Angular 34 (45° Top-Right)"}
    
    modes = list(base_modes)
    for i in range(len(modes)):
        if luma_mode == modes[i]:
            modes[i] = 34 # Substitute duplicate with mode 34
            break
            
    candidates = []
    for idx, m in enumerate(modes):
        name = names.get(m, f"Angular {m}")
        candidates.append({
            "mode": m,
            "name": name,
            "is_dm": False,
            "rank": idx + 1,
            "cost": 0.0
        })
        
    # DM_CHROMA inherits luma mode
    luma_name = get_intra_mode_hevc_info(luma_mode)[1]
    candidates.append({
        "mode": luma_mode,
        "name": f"DM_CHROMA ({luma_name})",
        "is_dm": True,
        "rank": 5,
        "cost": 0.0
    })
    return candidates

def assemble_pu_pred(
    pu_x: int,
    pu_y: int,
    pu_size: int,
    tu_events: list[dict[str, Any]]
) -> list[int] | None:
    """
    Assembles TU prediction tiles into a complete PU prediction matrix (pu_size x pu_size).
    Returns None if geometric tiling is incomplete, overlapping, or out of bounds.
    """
    if not tu_events:
        return None

    ref_pu_x = tu_events[0].get("pu_x", pu_x)
    ref_pu_y = tu_events[0].get("pu_y", pu_y)

    pu_pred = [0] * (pu_size * pu_size)
    covered = [False] * (pu_size * pu_size)
    total_area = 0

    for tu in tu_events:
        tx = tu.get("tu_x", ref_pu_x) - ref_pu_x
        ty = tu.get("tu_y", ref_pu_y) - ref_pu_y
        tw = tu.get("tu_width", pu_size)
        th = tu.get("tu_height", pu_size)
        p_data = tu.get("pred_data", [])

        if len(p_data) != tw * th:
            return None
        if tx < 0 or ty < 0 or tx + tw > pu_size or ty + th > pu_size:
            return None

        for row in range(th):
            for col in range(tw):
                idx = (ty + row) * pu_size + (tx + col)
                if covered[idx]:
                    return None  # Overlap detected
                covered[idx] = True
                pu_pred[idx] = p_data[row * tw + col]

        total_area += tw * th

    if total_area == pu_size * pu_size and all(covered):
        return pu_pred
    return None

def build_intra_pipeline_data(
    modes: list[IntraModeData],
    ref_checkpoint: IntraRefCheckpoint,
    cu_size: int = 8,
    ctu_x: int = 0,
    ctu_y: int = 0,
    poc: int = 0,
    cu_x: int | None = None,
    cu_y: int | None = None,
    left_mode: int | None = None,
    above_mode: int | None = None,
    transform_events: list[TransformQuantCheckpoint] | None = None,
    mpm_raw_event: dict[str, Any] | None = None,
    full_rdo_events: list[dict[str, Any]] | None = None,
    chroma_raw_event: dict[str, Any] | None = None,
    tu_pred_events: list[dict[str, Any]] | None = None
) -> IntraPipelineFullResponse:
    """
    Constructs the complete 5-stage Intra Prediction & RDO Search Pipeline data:
    Step 1: Reference boundary initialization & filter
    Step 2: Rough Mode Decision (RMD) 35-mode evaluation & ranking
    Step 3: Top K selection + MPM derivation (H.265 Section 8.4.2)
    Step 4: Full RDO candidate evaluation & local reconstruction
    Step 5: Chroma candidate evaluation & winner commitment
    """
    if not modes:
        return IntraPipelineFullResponse(
            poc=poc,
            ctu_x=ctu_x,
            ctu_y=ctu_y,
            cu_size=cu_size,
            step1_reference=ref_checkpoint,
            step3_candidates=CandidateSelectionStep(k_threshold=get_top_k_threshold(cu_size))
        )

    # 1. MPM Derivation
    if mpm_raw_event and "mpm_modes" in mpm_raw_event:
        mpm_modes = mpm_raw_event["mpm_modes"]
        left_m = mpm_raw_event.get("left_mode", left_mode)
        above_m = mpm_raw_event.get("above_mode", above_mode)
        mpm_rule = f"HM C++ Derived: Left={left_m}, Above={above_m} -> {mpm_modes}"
        mpm_info = MpmDerivationInfo(
            left_mode=left_m if (left_m is not None and left_m >= 0) else None,
            above_mode=above_m if (above_m is not None and above_m >= 0) else None,
            mpm_modes=mpm_modes,
            derivation_rule=mpm_rule
        )
    else:
        mpm_modes, mpm_rule = derive_mpm(left_mode, above_mode)
        mpm_info = MpmDerivationInfo(
            left_mode=left_mode,
            above_mode=above_mode,
            mpm_modes=mpm_modes,
            derivation_rule=mpm_rule
        )

    # 2. RMD Ranking & Candidate Selection
    k_threshold = get_top_k_threshold(cu_size)
    sorted_by_cost = sorted(modes, key=lambda m: m.cost)
    top_k_set = {m.mode for m in sorted_by_cost[:k_threshold]}
    mpm_set = set(mpm_modes)

    rmd_items: list[RmdModeItem] = []
    for rank_idx, m in enumerate(sorted_by_cost, start=1):
        is_mpm = m.mode in mpm_set
        mpm_idx = mpm_modes.index(m.mode) if is_mpm else None
        rmd_items.append(RmdModeItem(
            mode=m.mode,
            category=m.category,
            direction_name=m.direction_name,
            angle_offset=m.angle_offset,
            cost=round(m.cost, 4),
            rank=rank_idx,
            selected_in_rmd=(m.mode in top_k_set),
            is_mpm=is_mpm,
            mpm_index=mpm_idx
        ))

    # Keep in original mode index order for tabular/funnel reference
    rmd_items_ordered = sorted(rmd_items, key=lambda x: x.mode)

    # 3. Construct unified candidate list (Top K + MPMs)
    if mpm_raw_event and "candidate_modes" in mpm_raw_event:
        candidate_list = mpm_raw_event["candidate_modes"]
        top_k_modes = mpm_raw_event.get("top_k_modes", [m.mode for m in sorted_by_cost[:k_threshold]])
    else:
        candidate_list = [m.mode for m in sorted_by_cost[:k_threshold]]
        for mpm in mpm_modes:
            if mpm not in candidate_list:
                candidate_list.append(mpm)
        top_k_modes = [m.mode for m in sorted_by_cost[:k_threshold]]

    candidate_step = CandidateSelectionStep(
        k_threshold=k_threshold,
        top_k_modes=top_k_modes,
        mpm_modes=mpm_modes,
        candidate_modes=candidate_list,
        derivation=mpm_info
    )

    # 4. Full RDO Candidates Details & Prediction Assembly
    mode_map = {m.mode: m for m in modes}
    rdo_details: list[RdoCandidateDetail] = []
    best_luma_mode = sorted_by_cost[0].mode
    best_luma_cost = sorted_by_cost[0].cost

    # Index TU prediction events by trial_id and composite tuple
    tu_by_trial: dict[int, list[dict[str, Any]]] = {}
    tu_by_tuple: dict[tuple[int, int, int], list[dict[str, Any]]] = {}

    if tu_pred_events:
        for tue in tu_pred_events:
            tid = tue.get("trial_id", 0)
            if tid and tid > 0:
                tu_by_trial.setdefault(tid, []).append(tue)
            cr = int(tue.get("cand_rank", 0))
            cm = int(tue.get("cand_mode", 0))
            qp = int(tue.get("qp", 0))
            tu_by_tuple.setdefault((cr, cm, qp), []).append(tue)

    if full_rdo_events:
        # Determine the true minimum cost candidate across full_rdo_events
        min_cost = float("inf")
        min_cand_idx = -1
        for idx, rdo_item in enumerate(full_rdo_events):
            cost = float(rdo_item.get("cost_rdo", float("inf")))
            if cost < min_cost:
                min_cost = cost
                min_cand_idx = idx

        for idx, rdo_item in enumerate(full_rdo_events):
            c_mode = rdo_item.get("mode", 0)
            m_data = mode_map.get(c_mode)
            dir_name = m_data.direction_name if m_data else get_intra_mode_hevc_info(c_mode)[1]
            rdo_cost = float(rdo_item.get("cost_rdo", 0.0))
            rdo_sse = int(rdo_item.get("sse", 0))
            rdo_bits = float(rdo_item.get("bits", 0.0))
            rdo_rate_est = float(rdo_item.get("rdo_rate_est", rdo_bits))
            cand_rank = int(rdo_item.get("cand_rank", rdo_item.get("rank_rdo", idx + 1)))
            qp = rdo_item.get("qp")
            trial_id = rdo_item.get("trial_id")

            is_winner = (idx == min_cand_idx)
            if is_winner:
                best_luma_mode = c_mode
                best_luma_cost = rdo_cost

            # Retrieve TU predictions and assemble PU prediction matrix
            matched_tus: list[dict[str, Any]] = []
            if trial_id and trial_id in tu_by_trial:
                matched_tus = tu_by_trial[trial_id]
            elif (cand_rank, c_mode, qp or 0) in tu_by_tuple:
                matched_tus = tu_by_tuple[(cand_rank, c_mode, qp or 0)]

            pred_data = assemble_pu_pred(cu_x or 0, cu_y or 0, cu_size, matched_tus) if matched_tus else []

            rdo_details.append(RdoCandidateDetail(
                mode=c_mode,
                direction_name=dir_name,
                is_mpm=(c_mode in mpm_set),
                rank_rdo=cand_rank,
                cost_rdo=round(rdo_cost, 4),
                sse=rdo_sse,
                distortion=float(rdo_sse),
                bits=round(rdo_bits, 1),
                rdo_rate_est=round(rdo_rate_est, 1),
                qp=qp,
                trial_id=trial_id,
                tu_split=(len(matched_tus) > 1),
                pred_data=pred_data or [],
                reconstructed_data=rdo_item.get("reconstructed_data", []),
                reconstructed_resi=rdo_item.get("reconstructed_resi", []),
                data_source="HM_TRACE",
                is_fallback=False,
                is_winner=is_winner
            ))
    else:
        for rdo_rank, cand_mode in enumerate(candidate_list, start=1):
            m_data = mode_map.get(cand_mode)
            if not m_data:
                continue

            # Compute Reconstructed samples: Clip3(0, 255, Pred + Resi)
            pred = m_data.pred_data or []
            resi = m_data.resi_data or []
            org = m_data.org_data or []
            reco = [max(0, min(255, p + r)) for p, r in zip(pred, resi)]
            reco_resi = resi

            # Compute SSE Distortion
            sse = sum((o - rec) ** 2 for o, rec in zip(org, reco)) if org and reco else 0
            bits_est = round(max(0.0, (m_data.cost - sse) / 0.85), 1)

            is_winner = (cand_mode == best_luma_mode)
            rdo_details.append(RdoCandidateDetail(
                mode=cand_mode,
                direction_name=m_data.direction_name,
                is_mpm=(cand_mode in mpm_set),
                rank_rdo=rdo_rank,
                cost_rdo=round(m_data.cost, 4),
                sse=sse,
                distortion=float(sse),
                bits=bits_est,
                rdo_rate_est=bits_est,
                tu_split=False,
                pred_data=pred,
                reconstructed_data=reco,
                reconstructed_resi=reco_resi,
                data_source="FALLBACK_DERIVED",
                is_fallback=True,
                is_winner=is_winner
            ))

    # 5. Chroma Candidates & Final Winner
    reco_u: list[int] = []
    reco_v: list[int] = []
    best_chroma_mode = best_luma_mode
    chroma_items: list[ChromaCandidateInfo] = []

    if chroma_raw_event and "candidates" in chroma_raw_event:
        best_chroma_mode = chroma_raw_event.get("best_chroma_mode", best_luma_mode)
        if "best_luma_mode" in chroma_raw_event:
            best_luma_mode = chroma_raw_event["best_luma_mode"]
            if best_luma_mode in mode_map:
                best_luma_cost = mode_map[best_luma_mode].cost
        reco_u = chroma_raw_event.get("reco_u", [])
        reco_v = chroma_raw_event.get("reco_v", [])
        for c in chroma_raw_event.get("candidates", []):
            c_mode = c.get("mode", 0)
            is_dm = (c_mode == best_luma_mode or c.get("is_dm", False))
            c_name = f"DM_CHROMA ({get_intra_mode_hevc_info(best_luma_mode)[1]})" if is_dm else get_intra_mode_hevc_info(c_mode)[1]
            chroma_items.append(ChromaCandidateInfo(
                mode=c_mode,
                name=c_name,
                is_dm=is_dm,
                cost=round(float(c.get("cost", 0.0)), 4),
                dist=int(c.get("dist", 0)),
                bits=round(float(c.get("bits", 0.0)), 1),
                rank=int(c.get("rank", 1)),
                data_source="HM_TRACE",
                is_fallback=False
            ))
    else:
        chroma_raw = get_allowed_chroma_modes(best_luma_mode)
        for c in chroma_raw:
            chroma_items.append(ChromaCandidateInfo(
                mode=c["mode"],
                name=c["name"],
                is_dm=c["is_dm"],
                cost=c["cost"],
                rank=c["rank"],
                data_source="FALLBACK_DERIVED",
                is_fallback=True
            ))

    winner_name = mode_map.get(best_luma_mode).direction_name if best_luma_mode in mode_map else get_intra_mode_hevc_info(best_luma_mode)[1]
    is_pipeline_fallback = not bool(full_rdo_events)

    return IntraPipelineFullResponse(
        poc=poc,
        ctu_x=ctu_x,
        ctu_y=ctu_y,
        cu_size=cu_size,
        cu_x=cu_x,
        cu_y=cu_y,
        data_source="FALLBACK_DERIVED" if is_pipeline_fallback else "HM_TRACE",
        is_fallback=is_pipeline_fallback,
        best_luma_mode=best_luma_mode,
        best_luma_cost=round(best_luma_cost, 4),
        best_chroma_mode=best_chroma_mode,
        winner_mode=best_luma_mode,
        winner_cost=round(best_luma_cost, 4),
        winner_direction=winner_name,
        reco_u=reco_u,
        reco_v=reco_v,
        step1_reference=ref_checkpoint,
        step2_rmd=rmd_items_ordered,
        step3_candidates=candidate_step,
        step4_rdo=rdo_details,
        step5_chroma=chroma_items
    )

intra_search_parser = IntraSearchParser()
