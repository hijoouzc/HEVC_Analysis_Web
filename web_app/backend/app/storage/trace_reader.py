import json
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Iterator, Callable, Any

class TraceReader:
    """Memory-efficient, LRU-cached reader for HEVC trace.jsonl files conforming to HM data-locality standards"""
    
    _MAX_CACHE_SIZE: int = 24
    _cache: OrderedDict[str, tuple[float, list[dict[str, Any]], dict[str, list[dict[str, Any]]]]] = OrderedDict()
    _lock = threading.Lock()

    @classmethod
    def _get_cached_data(cls, trace_file: Path) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]] | None:
        if not trace_file.exists():
            return None
        try:
            mtime = trace_file.stat().st_mtime
        except OSError:
            return None
            
        file_key = str(trace_file.resolve())
        with cls._lock:
            if file_key in cls._cache:
                cached_mtime, all_events, by_type = cls._cache[file_key]
                if cached_mtime == mtime:
                    cls._cache.move_to_end(file_key)
                    return all_events, by_type
                else:
                    del cls._cache[file_key]

        # Parse trace file once into memory
        all_events: list[dict[str, Any]] = []
        by_type: dict[str, list[dict[str, Any]]] = {}
        try:
            with open(trace_file, "r", encoding="utf-8") as f:
                for line in f:
                    line_str = line.strip()
                    if not line_str:
                        continue
                    try:
                        obj = json.loads(line_str)
                        all_events.append(obj)
                        ev = obj.get("event", "UNKNOWN")
                        if ev not in by_type:
                            by_type[ev] = []
                        by_type[ev].append(obj)
                    except json.JSONDecodeError:
                        continue
        except OSError:
            return None

        with cls._lock:
            cls._cache[file_key] = (mtime, all_events, by_type)
            if len(cls._cache) > cls._MAX_CACHE_SIZE:
                cls._cache.popitem(last=False)
                
        return all_events, by_type

    @classmethod
    def clear_cache(cls) -> None:
        """Clears the trace memory cache (useful for testing and memory maintenance)"""
        with cls._lock:
            cls._cache.clear()

    @classmethod
    def stream_events(cls, trace_file: Path, event_filter: str | None = None) -> Iterator[dict[str, Any]]:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            all_events, by_type = cached
            if event_filter is not None:
                for ev in by_type.get(event_filter, []):
                    yield ev
            else:
                for ev in all_events:
                    yield ev
            return

        if not trace_file.exists():
            return
            
        with open(trace_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    obj = json.loads(line_str)
                    if event_filter is None or obj.get("event") == event_filter:
                        yield obj
                except json.JSONDecodeError:
                    continue

    @classmethod
    def read_all(
        cls,
        trace_file: Path,
        event_filter: str | None = None,
        limit: int | None = None,
        predicate: Callable[[dict[str, Any]], bool] | None = None
    ) -> list[dict[str, Any]]:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            all_events, by_type = cached
            candidate_list = by_type.get(event_filter, []) if event_filter is not None else all_events
            if predicate is None:
                return candidate_list[:limit] if limit is not None else list(candidate_list)
            
            results = []
            for event in candidate_list:
                if predicate(event):
                    results.append(event)
                    if limit is not None and len(results) >= limit:
                        break
            return results

        results = []
        for event in cls.stream_events(trace_file, event_filter):
            if predicate is not None and not predicate(event):
                continue
            results.append(event)
            if limit is not None and len(results) >= limit:
                break
        return results

    @classmethod
    def count_events(cls, trace_file: Path) -> dict[str, int]:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            _, by_type = cached
            return {k: len(v) for k, v in by_type.items()}

        counts: dict[str, int] = {}
        if not trace_file.exists():
            return counts
            
        with open(trace_file, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    obj = json.loads(line_str)
                    ev = obj.get("event", "UNKNOWN")
                    counts[ev] = counts.get(ev, 0) + 1
                except json.JSONDecodeError:
                    continue
        return counts

    @classmethod
    def find_one(cls, trace_file: Path, predicate: Callable[[dict[str, Any]], bool]) -> dict[str, Any] | None:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            for event in cached[0]:
                if predicate(event):
                    return event
            return None

        for event in cls.stream_events(trace_file):
            if predicate(event):
                return event
        return None

trace_reader = TraceReader()

