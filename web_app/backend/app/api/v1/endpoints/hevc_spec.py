from fastapi import APIRouter, HTTPException, Query
from app.domain.hevc_spec_dictionary import (
    get_spec_dictionary,
    get_spec_element,
    get_elements_by_subsystem,
    get_elements_by_status,
    AvailabilityStatus,
    HevcSpecElement,
)

router = APIRouter()

@router.get("/dictionary", response_model=dict[str, HevcSpecElement])
async def get_full_dictionary(
    status: AvailabilityStatus | None = Query(None, description="Optional availability status filter"),
    subsystem: str | None = Query(None, description="Optional subsystem filter (SPS, PPS, CU, etc.)")
):
    """Returns the comprehensive ITU-T H.265 / HM-18.0 specification dictionary"""
    if status is not None:
        elements = get_elements_by_status(status)
        return {e.name: e for e in elements}
    if subsystem is not None:
        elements = get_elements_by_subsystem(subsystem)
        return {e.name: e for e in elements}
    return get_spec_dictionary()

@router.get("/elements/{element_name}", response_model=HevcSpecElement)
async def get_element_detail(element_name: str):
    """Retrieves full specification and HM mapping for a specific syntax element or variable"""
    elem = get_spec_element(element_name)
    if elem is None:
        raise HTTPException(status_code=404, detail=f"Element '{element_name}' not found in specification dictionary.")
    return elem

@router.get("/subsystems", response_model=list[str])
async def list_subsystems():
    """Lists all HEVC functional subsystems registered in the dictionary"""
    all_elems = get_spec_dictionary().values()
    return sorted(list({e.subsystem for e in all_elems}))
