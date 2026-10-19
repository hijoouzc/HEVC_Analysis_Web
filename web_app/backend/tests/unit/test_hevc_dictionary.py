import pytest
from app.domain.hevc_spec_dictionary import (
    get_spec_dictionary,
    get_spec_element,
    get_elements_by_subsystem,
    get_elements_by_status,
    AvailabilityStatus,
)

def test_hevc_spec_dictionary_coverage():
    dic = get_spec_dictionary()
    assert len(dic) >= 15

    subsystems = {elem.subsystem for elem in dic.values()}
    assert "SPS" in subsystems
    assert "PPS" in subsystems
    assert "SliceHeader" in subsystems
    assert "CU" in subsystems
    assert "PU" in subsystems
    assert "TU" in subsystems
    assert "Deblocking" in subsystems
    assert "SAO" in subsystems
    assert "CABAC" in subsystems

def test_hevc_spec_element_fields():
    elem = get_spec_element("pic_width_in_luma_samples")
    assert elem is not None
    assert elem.name == "pic_width_in_luma_samples"
    assert elem.subsystem == "SPS"
    assert elem.descriptor == "ue(v)"
    assert elem.hm_class == "TComSPS"
    assert elem.hm_member == "m_picWidthInLumaSamples"
    assert elem.hm_method == "getPicWidthInLumaSamples()"
    assert elem.status == AvailabilityStatus.IN_TRACE
    assert elem.trace_event == "SEQUENCE_METADATA"

def test_hevc_spec_cabac_and_cu_depth_distinction():
    # Verify m_puhDepth is classified as CU depth, distinct from split_cu_flag
    depth_elem = get_spec_element("m_puhDepth")
    assert depth_elem is not None
    assert depth_elem.hm_class == "TComDataCU"
    assert depth_elem.hm_member == "m_puhDepth"

    split_elem = get_spec_element("split_cu_flag")
    assert split_elem is not None
    assert split_elem.descriptor == "ae(v)"
    assert split_elem.status == AvailabilityStatus.DERIVED_VALUE
    assert "7.3.8.4" in split_elem.standard_section

    # Verify Intra PU syntax elements adhere to Section 7.3.8.5
    prev_intra = get_spec_element("prev_intra_luma_pred_flag")
    assert prev_intra is not None
    assert "7.3.8.5" in prev_intra.standard_section

    chroma_elem = get_spec_element("intra_chroma_pred_mode")
    assert chroma_elem is not None
    assert "7.3.8.5" in chroma_elem.standard_section
    assert "Table 8-3" in chroma_elem.description

    # Verify split_transform_flag status is DERIVED_VALUE
    split_tu = get_spec_element("split_transform_flag")
    assert split_tu is not None
    assert split_tu.status == AvailabilityStatus.DERIVED_VALUE

    # Verify CABAC elements
    cabac_elem = get_spec_element("cabac_bin")
    assert cabac_elem is not None
    assert cabac_elem.status == AvailabilityStatus.IN_TRACE
    assert cabac_elem.trace_event == "CABAC_BIN"

def test_hevc_spec_api_endpoints(client):
    # Full dictionary
    res = client.get("/api/v1/hevc-spec/dictionary")
    assert res.status_code == 200
    data = res.json()
    assert "pic_width_in_luma_samples" in data
    assert "split_cu_flag" in data

    # Filter by subsystem
    res_sps = client.get("/api/v1/hevc-spec/dictionary?subsystem=SPS")
    assert res_sps.status_code == 200
    sps_data = res_sps.json()
    assert all(e["subsystem"] == "SPS" for e in sps_data.values())

    # Filter by status
    res_status = client.get("/api/v1/hevc-spec/dictionary?status=IN_TRACE")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert all(e["status"] == "IN_TRACE" for e in status_data.values())

    # Element detail
    res_elem = client.get("/api/v1/hevc-spec/elements/pic_width_in_luma_samples")
    assert res_elem.status_code == 200
    assert res_elem.json()["name"] == "pic_width_in_luma_samples"

    # Element not found
    res_404 = client.get("/api/v1/hevc-spec/elements/unknown_fake_syntax")
    assert res_404.status_code == 404

    # Subsystems list
    res_sub = client.get("/api/v1/hevc-spec/subsystems")
    assert res_sub.status_code == 200
    subs = res_sub.json()
    assert "SPS" in subs
    assert "CABAC" in subs
