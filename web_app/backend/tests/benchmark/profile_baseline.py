import argparse
import json
import os
import resource
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

TRACE_TIERS = {
    "small": {
        "fixture_path": FIXTURES_DIR / "small" / "trace.jsonl",
        "bench_job_id": "bench_small",
        "description": "Small trace (~59 KB)",
    },
    "medium": {
        "fixture_path": FIXTURES_DIR / "medium" / "trace.jsonl",
        "bench_job_id": "bench_medium",
        "description": "Medium trace (~6.1 MB)",
    },
    "large": {
        "fixture_path": FIXTURES_DIR / "large" / "trace.jsonl",
        "bench_job_id": "bench_large",
        "description": "Large trace (~27 MB)",
    },
}

def _run_single_cold_parse(tier_name: str) -> dict:
    """Worker function executed in an isolated subprocess to measure true cold load."""
    from app.storage.trace_reader import trace_reader

    tier = TRACE_TIERS[tier_name]
    trace_file = Path(tier["fixture_path"]).resolve()
    if not trace_file.exists():
        return {"error": f"Fixture file {trace_file} does not exist"}

    file_size_bytes = trace_file.stat().st_size
    rss_before_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    t0 = time.perf_counter()
    all_events = trace_reader.read_all(trace_file)
    t1 = time.perf_counter()

    rss_after_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    event_count = len(all_events)
    parse_time_ms = (t1 - t0) * 1000.0

    # Measure warm queries in the same process after cache is primed
    warm_latencies_us = []
    for _ in range(50):
        qt0 = time.perf_counter()
        _ = trace_reader.find_one(
            trace_file,
            lambda e: e.get("ctu_x") == 0 and e.get("ctu_y") == 0,
            event_filter="CTU_PARTITION",
            ctu_x=0,
            ctu_y=0,
        )
        qt1 = time.perf_counter()
        warm_latencies_us.append((qt1 - qt0) * 1_000_000.0)

    median_warm_us = statistics.median(warm_latencies_us)
    p95_warm_us = sorted(warm_latencies_us)[int(len(warm_latencies_us) * 0.95)]

    return {
        "tier": tier_name,
        "file_size_bytes": file_size_bytes,
        "event_count": event_count,
        "parse_time_ms": parse_time_ms,
        "rss_before_mb": rss_before_kb / 1024.0,
        "rss_after_mb": rss_after_kb / 1024.0,
        "rss_delta_mb": (rss_after_kb - rss_before_kb) / 1024.0,
        "warm_median_us": median_warm_us,
        "warm_p95_us": p95_warm_us,
    }

def _run_single_endpoint_request(tier_name: str) -> dict:
    """Worker function executed in an isolated subprocess to measure HTTP serialization."""
    from starlette.testclient import TestClient
    from app.main import app
    from app.core.config import settings

    tier = TRACE_TIERS[tier_name]
    job_id = tier["bench_job_id"]
    fixture_path = Path(tier["fixture_path"]).resolve()

    # Ensure bench session exists
    session_dir = (settings.SESSIONS_DIR / job_id).resolve()
    session_dir.mkdir(parents=True, exist_ok=True)
    target_trace = session_dir / "trace.jsonl"
    if not target_trace.exists() or target_trace.stat().st_size != fixture_path.stat().st_size:
        shutil.copyfile(fixture_path, target_trace)

    client = TestClient(app)
    endpoint = f"/api/v1/checkpoints/{job_id}/CP_01_PARTITION?ctu_x=0&ctu_y=0"

    t0 = time.perf_counter()
    response = client.get(endpoint, headers={"Accept-Encoding": "gzip"})
    t1 = time.perf_counter()

    roundtrip_ms = (t1 - t0) * 1000.0
    payload_bytes = len(response.content)

    # Measure CU 360 inspector without heavy matrices
    inspect_nomat_ep = f"/api/v1/checkpoints/{job_id}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0&include_matrices=false"
    t_nomat0 = time.perf_counter()
    resp_nomat = client.get(inspect_nomat_ep, headers={"Accept-Encoding": "gzip"})
    t_nomat1 = time.perf_counter()
    nomat_ms = (t_nomat1 - t_nomat0) * 1000.0

    # Measure CU 360 inspector with heavy matrices
    inspect_mat_ep = f"/api/v1/checkpoints/{job_id}/cu-inspect?ctu_x=0&ctu_y=0&cu_x=0&cu_y=0&include_matrices=true"
    t_mat0 = time.perf_counter()
    resp_mat = client.get(inspect_mat_ep, headers={"Accept-Encoding": "gzip"})
    t_mat1 = time.perf_counter()
    mat_ms = (t_mat1 - t_mat0) * 1000.0

    return {
        "tier": tier_name,
        "status_code": response.status_code,
        "roundtrip_ms": roundtrip_ms,
        "payload_bytes": payload_bytes,
        "content_encoding": response.headers.get("content-encoding", "none"),
        "cu_inspect_nomat_ms": nomat_ms,
        "cu_inspect_nomat_bytes": len(resp_nomat.content),
        "cu_inspect_mat_ms": mat_ms,
        "cu_inspect_mat_bytes": len(resp_mat.content),
    }

def run_isolated_subprocess(target_func: str, tier_name: str) -> dict:
    """Executes a target benchmark task inside a fresh Python subprocess."""
    script = f"""
import sys, json
sys.path.insert(0, {repr(str(BACKEND_DIR))})
from tests.benchmark.profile_baseline import {target_func}
res = {target_func}({repr(tier_name)})
print(json.dumps(res))
"""
    proc = subprocess.run(
        [sys.executable, "-c", script],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Subprocess failed:\n{proc.stderr}")

    stdout = proc.stdout.strip()
    lines = [line for line in stdout.splitlines() if line.strip().startswith("{")]
    if not lines:
        raise RuntimeError(f"No JSON returned from subprocess:\n{stdout}")
    return json.loads(lines[-1])

def profile_tier(tier_name: str, tier_info: dict, repetitions: int = 5) -> dict:
    print(f"\n>>> Benchmarking Tier: {tier_name.upper()} ({tier_info['description']})")

    cold_runs = []
    endpoint_runs = []

    for i in range(repetitions):
        res = run_isolated_subprocess("_run_single_cold_parse", tier_name)
        cold_runs.append(res)
        print(f"  [Cold Parse {i+1}/{repetitions}] {res['parse_time_ms']:.2f} ms | Events: {res['event_count']:,} | Peak RSS Delta: {res['rss_delta_mb']:.1f} MB | Warm CTU: {res['warm_median_us']:.1f} µs")

    for i in range(repetitions):
        ep = run_isolated_subprocess("_run_single_endpoint_request", tier_name)
        endpoint_runs.append(ep)
        print(f"  [HTTP Endpoint {i+1}/{repetitions}] Status: {ep['status_code']} | Roundtrip: {ep['roundtrip_ms']:.2f} ms | Payload: {ep['payload_bytes']:,} B | Encoding: {ep.get('content_encoding')}")

    cold_times = [r["parse_time_ms"] for r in cold_runs]
    rss_deltas = [r["rss_delta_mb"] for r in cold_runs]
    warm_medians = [r["warm_median_us"] for r in cold_runs]
    warm_p95s = [r["warm_p95_us"] for r in cold_runs]
    ep_times = [r["roundtrip_ms"] for r in endpoint_runs]

    sorted_cold = sorted(cold_times)
    sorted_ep = sorted(ep_times)

    summary = {
        "tier": tier_name,
        "file_size_bytes": cold_runs[0]["file_size_bytes"],
        "event_count": cold_runs[0]["event_count"],
        "payload_bytes": endpoint_runs[0]["payload_bytes"],
        "content_encoding": endpoint_runs[0].get("content_encoding"),
        "cold_parse_ms": {
            "median": statistics.median(cold_times),
            "p95": sorted_cold[int(len(sorted_cold) * 0.95)],
            "min": min(cold_times),
            "max": max(cold_times),
        },
        "rss_delta_mb": {
            "median": statistics.median(rss_deltas),
            "max": max(rss_deltas),
        },
        "warm_query_us": {
            "median": statistics.median(warm_medians),
            "p95": statistics.median(warm_p95s),
        },
        "endpoint_roundtrip_ms": {
            "median": statistics.median(ep_times),
            "p95": sorted_ep[int(len(sorted_ep) * 0.95)],
            "min": min(ep_times),
            "max": max(ep_times),
        },
    }
    return summary

def main():
    parser = argparse.ArgumentParser(description="Performance Profiler for HEVC Telemetry Backend")
    parser.add_argument("--runs", type=int, default=5, help="Number of repetitions per tier")
    parser.add_argument("--output", type=str, default=None, help="JSON file path to save benchmark results")
    args = parser.parse_args()

    results = {}
    for tier_name, tier_info in TRACE_TIERS.items():
        results[tier_name] = profile_tier(tier_name, tier_info, repetitions=args.runs)

    print("\n" + "=" * 95)
    print("PERFORMANCE PROFILING SUMMARY (HM-18.0 TELEMETRY)")
    print("=" * 95)
    print(f"{'Tier':<8} | {'Size':<10} | {'Events':<9} | {'Cold Parse (ms)':<16} | {'RSS Delta':<10} | {'Warm CTU (µs)':<14} | {'HTTP Latency (ms)':<17}")
    print(f"{'':<8} | {'':<10} | {'':<9} | {'Median / P95':<16} | {'Peak MB':<10} | {'Median / P95':<14} | {'Median / P95':<17}")
    print("-" * 95)

    for tier_name, res in results.items():
        size_str = f"{res['file_size_bytes'] / 1024:.1f} KB" if res['file_size_bytes'] < 1024*1024 else f"{res['file_size_bytes'] / (1024*1024):.1f} MB"
        events_str = f"{res['event_count']:,}"
        cold_str = f"{res['cold_parse_ms']['median']:.1f} / {res['cold_parse_ms']['p95']:.1f}"
        rss_str = f"{res['rss_delta_mb']['median']:.1f} MB"
        warm_str = f"{res['warm_query_us']['median']:.1f} / {res['warm_query_us']['p95']:.1f}"
        http_str = f"{res['endpoint_roundtrip_ms']['median']:.1f} / {res['endpoint_roundtrip_ms']['p95']:.1f}"

        print(f"{tier_name.capitalize():<8} | {size_str:<10} | {events_str:<9} | {cold_str:<16} | {rss_str:<10} | {warm_str:<14} | {http_str:<17}")

    print("=" * 95)

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"\n[OK] Results saved to: {out_path}")

if __name__ == "__main__":
    main()
