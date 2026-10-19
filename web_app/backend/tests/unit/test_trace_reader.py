import pytest
from app.storage.trace_reader import TraceReader

def test_trace_reader_stream(sample_trace_file):
    all_events = list(TraceReader.stream_events(sample_trace_file))
    assert len(all_events) == 38
    
    intra_search_events = list(TraceReader.stream_events(sample_trace_file, event_filter="RDO_INTRA_SEARCH"))
    assert len(intra_search_events) == 35
    assert all(e["event"] == "RDO_INTRA_SEARCH" for e in intra_search_events)
    
    ref_events = list(TraceReader.stream_events(sample_trace_file, event_filter="INTRA_REF_SAMPLES"))
    assert len(ref_events) == 1
    
    part_events = list(TraceReader.stream_events(sample_trace_file, event_filter="CTU_PARTITION"))
    assert len(part_events) == 1
    
    tq_events = list(TraceReader.stream_events(sample_trace_file, event_filter="TRANSFORM_QUANT"))
    assert len(tq_events) == 1

def test_trace_reader_read_all_with_limit(sample_trace_file):
    events = TraceReader.read_all(sample_trace_file, limit=5)
    assert len(events) == 5

def test_trace_reader_count_events(sample_trace_file):
    counts = TraceReader.count_events(sample_trace_file)
    assert counts.get("RDO_INTRA_SEARCH") == 35
    assert counts.get("INTRA_REF_SAMPLES") == 1
    assert counts.get("CTU_PARTITION") == 1
    assert counts.get("TRANSFORM_QUANT") == 1

def test_trace_reader_find_one(sample_trace_file):
    event = TraceReader.find_one(sample_trace_file, lambda e: e.get("mode") == 0)
    assert event is not None
    assert event["mode"] == 0
    assert "cost" in event
    assert "pred_data" in event

def test_trace_reader_caching(sample_trace_file):
    TraceReader.clear_cache()
    # First call populates cache
    events_1 = TraceReader.read_all(sample_trace_file, event_filter="RDO_INTRA_SEARCH")
    assert len(events_1) == 35
    
    # Second call uses cache
    events_2 = TraceReader.read_all(sample_trace_file, event_filter="RDO_INTRA_SEARCH")
    assert len(events_2) == 35
    assert events_1 == events_2
    
    # Cache clear resets
    TraceReader.clear_cache()
    assert len(TraceReader._cache) == 0

def test_trace_reader_has_event(sample_trace_file):
    assert TraceReader.has_event(sample_trace_file, "RDO_INTRA_SEARCH") is True
    assert TraceReader.has_event(sample_trace_file, "CTU_PARTITION") is True
    assert TraceReader.has_event(sample_trace_file, "NON_EXISTENT_EVENT") is False

def test_trace_reader_ctu_indexing(sample_trace_file):
    events_ctu00 = TraceReader.read_all(
        sample_trace_file,
        event_filter="RDO_INTRA_SEARCH",
        ctu_x=0,
        ctu_y=0
    )
    assert len(events_ctu00) == 35

    events_ctu99 = TraceReader.read_all(
        sample_trace_file,
        event_filter="RDO_INTRA_SEARCH",
        ctu_x=99,
        ctu_y=99
    )
    assert len(events_ctu99) == 0

def test_trace_reader_cache_stats(sample_trace_file):
    TraceReader.clear_cache()
    stats = TraceReader.get_cache_stats()
    assert stats["cached_files"] == 0
    assert stats["total_events"] == 0
    assert stats["json_parser"] in ("orjson", "json")

    TraceReader.read_all(sample_trace_file)
    stats2 = TraceReader.get_cache_stats()
    assert stats2["cached_files"] == 1
    assert stats2["total_events"] == 38

    TraceReader.clear_cache()
    stats3 = TraceReader.get_cache_stats()
    assert stats3["cached_files"] == 0
    assert stats3["total_events"] == 0

