import gc
import json
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Iterator, Callable, Any

try:
    import orjson

    def _parse_bytes(b: bytes) -> Any:
        return orjson.loads(b)

    def _parse_str(s: str) -> Any:
        return orjson.loads(s)

    HAS_ORJSON = True
except ImportError:
    HAS_ORJSON = False

    def _parse_bytes(b: bytes) -> Any:
        return json.loads(b.decode("utf-8"))

    def _parse_str(s: str) -> Any:
        return json.loads(s)


class TraceReader:
    """
    Memory-efficient, LRU-cached reader for HEVC trace.jsonl files conforming to HM data-locality standards.
    Optimized with fast JSON parsing (orjson when available), binary streaming, and bounded memory cache.
    """

    _MAX_CACHE_FILES: int = 8
    _MAX_TOTAL_EVENTS: int = 150_000
    _total_cached_events: int = 0
    _file_event_counts: dict[str, int] = {}

    _cache: OrderedDict[
        str,
        tuple[
            float,
            list[dict[str, Any]],
            dict[str, list[dict[str, Any]]],
            dict[tuple[str, int, int], list[dict[str, Any]]],
        ],
    ] = OrderedDict()
    _lock = threading.Lock()
    _file_locks: dict[str, threading.Lock] = {}

    @classmethod
    def _get_cached_data(
        cls, trace_file: Path
    ) -> (
        tuple[
            list[dict[str, Any]],
            dict[str, list[dict[str, Any]]],
            dict[tuple[str, int, int], list[dict[str, Any]]],
        ]
        | None
    ):
        if not trace_file.exists():
            return None
        try:
            mtime = trace_file.stat().st_mtime
        except OSError:
            return None

        file_key = str(trace_file.resolve())
        with cls._lock:
            if file_key in cls._cache:
                cached_mtime, all_events, by_type, by_type_ctu = cls._cache[file_key]
                if cached_mtime == mtime:
                    cls._cache.move_to_end(file_key)
                    return all_events, by_type, by_type_ctu
                else:
                    # Invalidate stale entry
                    del cls._cache[file_key]
                    evicted_count = cls._file_event_counts.pop(file_key, 0)
                    cls._total_cached_events -= evicted_count

            if file_key not in cls._file_locks:
                cls._file_locks[file_key] = threading.Lock()
            file_lock = cls._file_locks[file_key]

        with file_lock:
            # Double check under file_lock to ensure only one thread loads the file
            with cls._lock:
                if file_key in cls._cache:
                    cached_mtime, all_events, by_type, by_type_ctu = cls._cache[file_key]
                    if cached_mtime == mtime:
                        cls._cache.move_to_end(file_key)
                        return all_events, by_type, by_type_ctu

            # Parse trace file into memory with O(1) multi-level indexing
            all_events: list[dict[str, Any]] = []
            by_type: dict[str, list[dict[str, Any]]] = {}
            by_type_ctu: dict[tuple[str, int, int], list[dict[str, Any]]] = {}
            try:
                with open(trace_file, "rb") as f:
                    for line in f:
                        line_bytes = line.strip()
                        if not line_bytes:
                            continue
                        try:
                            obj = _parse_bytes(line_bytes)
                            all_events.append(obj)
                            ev = obj.get("event", "UNKNOWN")
                            if ev not in by_type:
                                by_type[ev] = []
                            by_type[ev].append(obj)

                            cx = obj.get("ctu_x")
                            cy = obj.get("ctu_y")
                            if cx is not None and cy is not None:
                                try:
                                    ctu_key = (ev, int(cx), int(cy))
                                    if ctu_key not in by_type_ctu:
                                        by_type_ctu[ctu_key] = []
                                    by_type_ctu[ctu_key].append(obj)
                                except (ValueError, TypeError):
                                    pass
                        except Exception:
                            continue
            except OSError:
                return None

            evicted = False
            with cls._lock:
                cls._cache[file_key] = (mtime, all_events, by_type, by_type_ctu)
                cls._file_event_counts[file_key] = len(all_events)
                cls._total_cached_events += len(all_events)

                # Memory-bounded cache eviction
                while len(cls._cache) > cls._MAX_CACHE_FILES or (
                    cls._total_cached_events > cls._MAX_TOTAL_EVENTS
                    and len(cls._cache) > 1
                ):
                    old_key, _ = cls._cache.popitem(last=False)
                    cls._file_locks.pop(old_key, None)
                    evicted_count = cls._file_event_counts.pop(old_key, 0)
                    cls._total_cached_events -= evicted_count
                    evicted = True

            if evicted:
                gc.collect()

            return all_events, by_type, by_type_ctu

    @classmethod
    def clear_cache(cls) -> None:
        """Clears the trace memory cache and invokes garbage collection"""
        with cls._lock:
            cls._cache.clear()
            cls._file_locks.clear()
            cls._file_event_counts.clear()
            cls._total_cached_events = 0
        gc.collect()

    @classmethod
    def get_cache_stats(cls) -> dict[str, Any]:
        """Returns live statistics of the trace memory cache"""
        with cls._lock:
            return {
                "cached_files": len(cls._cache),
                "total_events": cls._total_cached_events,
                "max_cache_files": cls._MAX_CACHE_FILES,
                "max_total_events": cls._MAX_TOTAL_EVENTS,
                "json_parser": "orjson" if HAS_ORJSON else "json",
            }

    @classmethod
    def has_event(cls, trace_file: Path, event_name: str) -> bool:
        """O(1) check if a specific event type exists in the trace file"""
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            return event_name in cached[1]

        # Fallback to streaming check
        for _ in cls.stream_events(trace_file, event_filter=event_name):
            return True
        return False

    @classmethod
    def stream_events(
        cls, trace_file: Path, event_filter: str | None = None
    ) -> Iterator[dict[str, Any]]:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            all_events, by_type, _ = cached
            if event_filter is not None:
                for ev in by_type.get(event_filter, []):
                    yield ev
            else:
                for ev in all_events:
                    yield ev
            return

        if not trace_file.exists():
            return

        try:
            with open(trace_file, "rb") as f:
                for line in f:
                    line_bytes = line.strip()
                    if not line_bytes:
                        continue
                    try:
                        obj = _parse_bytes(line_bytes)
                        if event_filter is None or obj.get("event") == event_filter:
                            yield obj
                    except Exception:
                        continue
        except OSError:
            return

    @classmethod
    def read_all(
        cls,
        trace_file: Path,
        event_filter: str | None = None,
        limit: int | None = None,
        predicate: Callable[[dict[str, Any]], bool] | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ) -> list[dict[str, Any]]:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            all_events, by_type, by_type_ctu = cached
            if event_filter is not None and ctu_x is not None and ctu_y is not None:
                candidate_list = by_type_ctu.get((event_filter, ctu_x, ctu_y), [])
            elif event_filter is not None:
                candidate_list = by_type.get(event_filter, [])
            else:
                candidate_list = all_events

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
            if ctu_x is not None and event.get("ctu_x") != ctu_x:
                continue
            if ctu_y is not None and event.get("ctu_y") != ctu_y:
                continue
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
            _, by_type, _ = cached
            return {k: len(v) for k, v in by_type.items()}

        counts: dict[str, int] = {}
        if not trace_file.exists():
            return counts

        try:
            with open(trace_file, "rb") as f:
                for line in f:
                    line_bytes = line.strip()
                    if not line_bytes:
                        continue
                    try:
                        obj = _parse_bytes(line_bytes)
                        ev = obj.get("event", "UNKNOWN")
                        counts[ev] = counts.get(ev, 0) + 1
                    except Exception:
                        continue
        except OSError:
            return counts
        return counts

    @classmethod
    def find_one(
        cls,
        trace_file: Path,
        predicate: Callable[[dict[str, Any]], bool],
        event_filter: str | None = None,
        ctu_x: int | None = None,
        ctu_y: int | None = None,
    ) -> dict[str, Any] | None:
        cached = cls._get_cached_data(trace_file)
        if cached is not None:
            all_events, by_type, by_type_ctu = cached
            if event_filter is not None and ctu_x is not None and ctu_y is not None:
                candidates = by_type_ctu.get((event_filter, ctu_x, ctu_y), [])
            elif event_filter is not None:
                candidates = by_type.get(event_filter, [])
            else:
                candidates = all_events

            for event in candidates:
                if predicate(event):
                    return event
            return None

        for event in cls.stream_events(trace_file, event_filter=event_filter):
            if ctu_x is not None and event.get("ctu_x") != ctu_x:
                continue
            if ctu_y is not None and event.get("ctu_y") != ctu_y:
                continue
            if predicate(event):
                return event
        return None


trace_reader = TraceReader()
