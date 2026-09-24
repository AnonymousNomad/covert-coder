#!/usr/bin/env python3
"""Loopback-only, lease-gated local runtime measurement runner.

This runner sends inference requests only. It does not install, start, stop,
load, unload, or configure a runtime. Use one backend at a time.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import http.client
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

REPETITIONS = 5
OUTPUT_TOKENS = 128
TEMPERATURE = 0
TOP_P = 1
SEED = 42
IDLE_SAMPLE_SECONDS = 10
SAMPLE_INTERVAL_SECONDS = 1

THROUGHPUT_PROMPT = (
    "You are checking a local runtime. Summarize the numbered records by stating "
    "the count, the first and last record numbers, and whether every record says READY. "
    "Do not infer values that are not present. Records follow:\n"
    + "\n".join(
        f"record {i:03d}: READY; worker={i % 6}; queue={i % 4}"
        for i in range(128)
    )
)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "schedule_rehearsal",
        "description": "Record a harmless local-runtime rehearsal in the response.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "date": {"type": "string", "format": "date"},
                "remote": {"type": "boolean"},
            },
            "required": ["title", "date", "remote"],
            "additionalProperties": False,
        },
    },
}

TOOL_PROMPT = (
    "Call schedule_rehearsal exactly once with title Runtime Lab, date "
    "2026-10-02, and remote false. Do not add any other fields."
)

OUTPUT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "runtime_lab_result",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "minimum": {"type": "integer"},
                "maximum": {"type": "integer"},
                "status": {"type": "string", "enum": ["ok", "needs_review"]},
            },
            "required": ["minimum", "maximum", "status"],
            "additionalProperties": False,
        },
    },
}

OUTPUT_PROMPT = (
    "Given the integers 7, 2, and 9, return minimum 2, maximum 9, and status ok. "
    "Return only the schema object."
)


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def loopback_url(value: str, label: str) -> Any:
    parsed = urlsplit(value)
    if parsed.scheme != "http" or not parsed.hostname or not parsed.port:
        fail(f"{label} must be an explicit http://loopback:port URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        fail(f"{label} must not contain credentials, a query, or a fragment")
    try:
        address = ipaddress_address(parsed.hostname)
    except ValueError:
        fail(f"{label} must use a literal loopback IP, not a hostname")
    if not address.is_loopback:
        fail(f"{label} must use a loopback IP")
    return parsed


def ipaddress_address(address: str) -> Any:
    import ipaddress

    return ipaddress.ip_address(address)


def windows_ownership_snapshot(target_ports: list[int]) -> dict[str, Any]:
    if os.name != "nt":
        fail("The current process-ownership preflight is implemented for Windows only")
    powershell = shutil.which("powershell.exe")
    if not powershell:
        fail("PowerShell is required for the Windows process/port ownership preflight")
    port_values = ", ".join(str(port) for port in target_ports)
    script = rf"""
$ErrorActionPreference = 'Stop'
$names = @('llama-server.exe','ollama.exe','llmster.exe','lm studio.exe','lms.exe','unsloth.exe')
$ports = @({port_values}, 8097, 8104, 11434, 1234, 8888, 8000)
$processes = @(Get-CimInstance Win32_Process |
  Where-Object {{ $names -contains $_.Name.ToLowerInvariant() }} |
  Select-Object @{{Name='pid';Expression={{[int]$_.ProcessId}}}}, @{{Name='name';Expression={{$_.Name}}}})
$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object {{ $ports -contains $_.LocalPort }} |
  Select-Object @{{Name='address';Expression={{$_.LocalAddress}}}}, @{{Name='port';Expression={{[int]$_.LocalPort}}}}, @{{Name='pid';Expression={{[int]$_.OwningProcess}}}})
[ordered]@{{processes=$processes;listeners=$listeners}} | ConvertTo-Json -Compress -Depth 4
"""
    result = subprocess.run(
        [powershell, "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    if result.returncode != 0:
        fail("Windows ownership preflight failed; refusing to send requests")
    try:
        snapshot = json.loads(result.stdout)
    except json.JSONDecodeError:
        fail("Windows ownership preflight returned invalid JSON")
    if not isinstance(snapshot, dict):
        fail("Windows ownership preflight returned an invalid shape")
    return snapshot


def verify_lease(lease: dict[str, Any]) -> tuple[Any, Path, list[int]]:
    if lease.get("exclusive_resource_clearance") is not True:
        fail("Lease does not declare exclusive resource clearance")
    if lease.get("owner") not in ("covert", "user"):
        fail("Foreign runtime leases are connect-only and cannot be benchmarked")
    required = (
        "backend_id",
        "backend_version",
        "runtime_engine",
        "engine_version",
        "model_id",
        "load_state",
        "artifact_path",
        "artifact_sha256",
        "runtime_pids",
        "lease_id",
    )
    missing = [key for key in required if not lease.get(key)]
    if missing:
        fail(f"Lease is missing required fields: {', '.join(missing)}")
    pids = lease["runtime_pids"]
    if not isinstance(pids, list) or not pids or any(
        not isinstance(pid, int) or pid <= 0 for pid in pids
    ):
        fail("runtime_pids must contain the verified backend process PID set")
    if lease.get("load_state") != "loaded":
        fail("The model must already be loaded before the idle sample and warm-up")
    expected = str(lease["artifact_sha256"]).lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        fail("artifact_sha256 must be a 64-character SHA-256 value")
    artifact = Path(lease["artifact_path"]).expanduser().resolve(strict=True)
    if not artifact.is_file():
        fail("artifact_path must refer to a file")
    actual = sha256_file(artifact)
    if actual != expected:
        fail(f"Artifact hash mismatch: expected {expected}, got {actual}")
    endpoint = loopback_url(str(lease.get("endpoint", "")), "endpoint")
    if endpoint.port in (8097, 8104):
        fail("Ports reserved by adjacent runtime lanes cannot be used by this bake-off")
    metrics_url = lease.get("metrics_url")
    metrics_endpoint = None
    if metrics_url:
        metrics_endpoint = loopback_url(str(metrics_url), "metrics_url")
        if metrics_endpoint.port in (8097, 8104):
            fail("Metrics ports reserved by adjacent runtime lanes cannot be used by this bake-off")
    target_ports = [endpoint.port]
    if metrics_endpoint:
        target_ports.append(metrics_endpoint.port)
    snapshot = windows_ownership_snapshot(target_ports)
    owned = set(pids)
    processes = snapshot.get("processes") or []
    listeners = snapshot.get("listeners") or []
    if isinstance(processes, dict):
        processes = [processes]
    if isinstance(listeners, dict):
        listeners = [listeners]
    foreign_processes = [
        item for item in processes if int(item.get("pid", -1)) not in owned
    ]
    foreign_listeners = [
        item for item in listeners if int(item.get("pid", -1)) not in owned
    ]
    if foreign_processes or foreign_listeners:
        fail(
            "Foreign runtime process/listener detected; no requests sent. "
            f"processes={foreign_processes}, listeners={foreign_listeners}"
        )
    for label, local_endpoint in (("endpoint", endpoint), ("metrics", metrics_endpoint)):
        if local_endpoint is None:
            continue
        target_listeners = [
            item for item in listeners
            if int(item.get("port", -1)) == local_endpoint.port
        ]
        if not target_listeners:
            fail(f"The declared {label} port has no listener owned by the lease PID set")
        if any(item.get("address") not in ("127.0.0.1", "::1") for item in target_listeners):
            fail(f"The declared {label} endpoint is not bound exclusively to loopback")
    return endpoint, artifact, pids


def local_api_key(lease: dict[str, Any]) -> str | None:
    variable = lease.get("api_key_environment_variable")
    if not variable:
        return None
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", str(variable)):
        fail("api_key_environment_variable must be an environment variable name")
    value = os.environ.get(str(variable))
    if not value:
        fail("The named local API key environment variable is unset")
    return value


def get_local(parsed: Any, path: str, timeout: float = 10.0) -> tuple[int, bytes]:
    connection = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=timeout)
    try:
        connection.request("GET", path, headers={"Accept": "text/plain"})
        response = connection.getresponse()
        return response.status, response.read()
    finally:
        connection.close()


def metrics_snapshot(metrics_url: str | None) -> dict[str, float] | None:
    if not metrics_url:
        return None
    parsed = loopback_url(metrics_url, "metrics_url")
    status, body = get_local(parsed, parsed.path or "/metrics")
    if status != 200:
        return None
    names = (
        "llamacpp:prompt_tokens_total",
        "llamacpp:prompt_seconds_total",
        "llamacpp:tokens_predicted_total",
        "llamacpp:tokens_predicted_seconds_total",
    )
    values: dict[str, float] = {}
    for line in body.decode("utf-8", errors="replace").splitlines():
        for name in names:
            match = re.match(rf"^{re.escape(name)}(?:\{{[^}}]*\}})?\s+([-+0-9.eE]+)$", line)
            if match:
                values[name] = float(match.group(1))
    return values


def metrics_delta(before: dict[str, float] | None, after: dict[str, float] | None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "prompt_tokens": None,
        "prompt_seconds": None,
        "prompt_tokens_per_second": None,
        "generation_tokens": None,
        "generation_seconds": None,
        "generation_tokens_per_second": None,
        "source": "unavailable",
    }
    if before is None or after is None:
        return result
    names = (
        "llamacpp:prompt_tokens_total",
        "llamacpp:prompt_seconds_total",
        "llamacpp:tokens_predicted_total",
        "llamacpp:tokens_predicted_seconds_total",
    )
    if any(name not in before or name not in after for name in names):
        return result
    pt = after.get("llamacpp:prompt_tokens_total", 0) - before.get("llamacpp:prompt_tokens_total", 0)
    ps = after.get("llamacpp:prompt_seconds_total", 0) - before.get("llamacpp:prompt_seconds_total", 0)
    gt = after.get("llamacpp:tokens_predicted_total", 0) - before.get("llamacpp:tokens_predicted_total", 0)
    gs = after.get("llamacpp:tokens_predicted_seconds_total", 0) - before.get("llamacpp:tokens_predicted_seconds_total", 0)
    result.update(
        prompt_tokens=pt,
        prompt_seconds=ps,
        prompt_tokens_per_second=pt / ps if ps > 0 else None,
        generation_tokens=gt,
        generation_seconds=gs,
        generation_tokens_per_second=gt / gs if gs > 0 else None,
        source="llama.cpp Prometheus counters",
    )
    return result


def post_stream(endpoint: Any, payload: dict[str, Any], api_key: str | None) -> dict[str, Any]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    path = (endpoint.path.rstrip("/") if endpoint.path else "") + "/v1/chat/completions"
    connection = http.client.HTTPConnection(endpoint.hostname, endpoint.port, timeout=600)
    start = time.perf_counter()
    first_delta: float | None = None
    content: list[str] = []
    calls: dict[int, dict[str, Any]] = {}
    usage: dict[str, Any] = {}
    finish_reason = None
    try:
        headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        connection.request(
            "POST",
            path,
            body=body,
            headers=headers,
        )
        response = connection.getresponse()
        if response.status != 200:
            detail = response.read(4096).decode("utf-8", errors="replace")
            if api_key:
                detail = detail.replace(api_key, "[REDACTED]")
            fail(f"HTTP {response.status} from local endpoint: {detail}")
        for raw_line in response:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                fail("Invalid JSON in the local SSE stream")
            if isinstance(chunk.get("usage"), dict):
                usage.update(chunk["usage"])
            choices = chunk.get("choices") or []
            if not choices:
                continue
            choice = choices[0]
            delta = choice.get("delta") or {}
            if delta.get("content") is not None:
                if first_delta is None and delta.get("content"):
                    first_delta = time.perf_counter() - start
                content.append(str(delta.get("content")))
            for call_delta in delta.get("tool_calls") or []:
                index = int(call_delta.get("index", 0))
                slot = calls.setdefault(index, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                if call_delta.get("id"):
                    slot["id"] += str(call_delta["id"])
                function = call_delta.get("function") or {}
                slot["function"]["name"] += str(function.get("name") or "")
                slot["function"]["arguments"] += str(function.get("arguments") or "")
                if first_delta is None and (function.get("name") or function.get("arguments")):
                    first_delta = time.perf_counter() - start
            if choice.get("finish_reason") is not None:
                finish_reason = choice["finish_reason"]
        elapsed = time.perf_counter() - start
    finally:
        connection.close()
    return {
        "content": "".join(content),
        "tool_calls": [calls[key] for key in sorted(calls)],
        "usage": usage,
        "finish_reason": finish_reason,
        "total_latency_seconds": elapsed,
        "time_to_first_delta_seconds": first_delta,
    }


def base_payload(lease: dict[str, Any], user_text: str, max_tokens: int = OUTPUT_TOKENS) -> dict[str, Any]:
    return {
        "model": lease["model_id"],
        "messages": [{"role": "user", "content": user_text}],
        "temperature": TEMPERATURE,
        "top_p": TOP_P,
        "seed": SEED,
        "max_tokens": max_tokens,
        "stream": True,
        "stream_options": {"include_usage": True},
    }


def parse_json_document(text: str) -> tuple[Any | None, bool, bool]:
    left = text.lstrip()
    try:
        value, end = json.JSONDecoder().raw_decode(left)
    except (TypeError, json.JSONDecodeError):
        return None, False, False
    trailing_content = bool(left[end:].strip())
    return value, not trailing_content, trailing_content


def parse_object(text: str) -> dict[str, Any] | None:
    value, complete_json, _ = parse_json_document(text)
    return value if complete_json and isinstance(value, dict) else None


def tool_result(result: dict[str, Any]) -> dict[str, Any]:
    calls = result["tool_calls"]
    valid = False
    decoded: dict[str, Any] | None = None
    name = None
    arguments_json_valid = False
    arguments_trailing_content = False
    argument_types_valid = False
    no_wrapper_prose = not bool(result["content"].strip())
    if len(calls) == 1:
        call = calls[0]
        name = call["function"]["name"]
        parsed, complete_json, arguments_trailing_content = parse_json_document(
            call["function"]["arguments"]
        )
        decoded = parsed if isinstance(parsed, dict) else None
        arguments_json_valid = complete_json and decoded is not None
        argument_types_valid = (
            decoded is not None
            and set(decoded) == {"title", "date", "remote"}
            and isinstance(decoded.get("title"), str)
            and isinstance(decoded.get("date"), str)
            and type(decoded.get("remote")) is bool
        )
        valid = (
            name == "schedule_rehearsal"
            and arguments_json_valid
            and argument_types_valid
            and decoded == {"title": "Runtime Lab", "date": "2026-10-02", "remote": False}
            and result["finish_reason"] == "tool_calls"
            and no_wrapper_prose
        )
    raw_trace = None
    repair_event = None
    raw_class = "BACKEND FAILED" if not valid else "APPARATUS INVALID"
    if raw_trace is not None:
        raw_class = "MODEL OUTPUT VALID" if valid else "BACKEND FAILED"
    if repair_event is not None:
        raw_class = "BACKEND REPAIRED" if valid else "BACKEND FAILED"
    return {
        "api_tool_call_valid": valid,
        "function_name": name,
        "arguments": decoded,
        "arguments_json_valid": arguments_json_valid,
        "arguments_trailing_content": arguments_trailing_content,
        "argument_types_and_keys_valid": argument_types_valid,
        "no_wrapper_prose": no_wrapper_prose,
        "finish_reason": result["finish_reason"],
        "raw_output_class": raw_class,
        "raw_output_class_note": "OpenAI-compatible stream does not expose a pre-parser trace or repair event",
    }


def structured_result(result: dict[str, Any]) -> dict[str, Any]:
    parsed, json_valid, trailing_prose = parse_json_document(result["content"])
    value = parsed if isinstance(parsed, dict) else None
    required = {"minimum", "maximum", "status"}
    missing_fields = sorted(required - set(value)) if value is not None else sorted(required)
    extra_fields = sorted(set(value) - required) if value is not None else []
    invalid_type_fields = []
    if value is not None:
        if type(value.get("minimum")) is not int:
            invalid_type_fields.append("minimum")
        if type(value.get("maximum")) is not int:
            invalid_type_fields.append("maximum")
        if not isinstance(value.get("status"), str):
            invalid_type_fields.append("status")
    invalid_enum = value is not None and "status" in value and value["status"] not in ("ok", "needs_review")
    schema_valid = (
        json_valid
        and value is not None
        and not missing_fields
        and not extra_fields
        and not invalid_type_fields
        and not invalid_enum
    )
    expected_values_valid = schema_valid and value == {
        "minimum": 2,
        "maximum": 9,
        "status": "ok",
    }
    return {
        "json_valid": json_valid,
        "schema_valid": schema_valid,
        "missing_fields": missing_fields,
        "extra_fields": extra_fields,
        "invalid_type_fields": invalid_type_fields,
        "invalid_enum": invalid_enum,
        "trailing_prose": trailing_prose,
        "expected_values_valid": expected_values_valid,
        "client_retry_count": 0,
        "client_retry_required_for_schema_compliance": not schema_valid,
        "client_retry_required_for_expected_values": not expected_values_valid,
        "backend_internal_retry_observable": False,
        "value": value,
    }


def windows_commit() -> dict[str, int] | None:
    if os.name != "nt":
        return None

    class PerformanceInformation(ctypes.Structure):
        _fields_ = [
            ("cb", ctypes.c_ulong),
            ("CommitTotal", ctypes.c_size_t),
            ("CommitLimit", ctypes.c_size_t),
            ("CommitPeak", ctypes.c_size_t),
            ("PhysicalTotal", ctypes.c_size_t),
            ("PhysicalAvailable", ctypes.c_size_t),
            ("SystemCache", ctypes.c_size_t),
            ("KernelTotal", ctypes.c_size_t),
            ("KernelPaged", ctypes.c_size_t),
            ("KernelNonpaged", ctypes.c_size_t),
            ("PageSize", ctypes.c_size_t),
            ("HandleCount", ctypes.c_ulong),
            ("ProcessCount", ctypes.c_ulong),
            ("ThreadCount", ctypes.c_ulong),
        ]

    info = PerformanceInformation()
    info.cb = ctypes.sizeof(info)
    try:
        if not ctypes.WinDLL("psapi").GetPerformanceInfo(ctypes.byref(info), info.cb):
            return None
    except (AttributeError, OSError):
        return None
    return {
        "committed_bytes": int(info.CommitTotal * info.PageSize),
        "commit_limit_bytes": int(info.CommitLimit * info.PageSize),
        "available_physical_bytes": int(info.PhysicalAvailable * info.PageSize),
    }


def gpu_snapshot() -> dict[str, int] | None:
    executable = shutil.which("nvidia-smi")
    if not executable:
        return None
    try:
        result = subprocess.run(
            [executable, "--query-gpu=utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        first = result.stdout.strip().splitlines()[0].split(",")
        return {
            "utilization_percent": int(first[0].strip()),
            "used_vram_mib": int(first[1].strip()),
            "total_vram_mib": int(first[2].strip()),
        }
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def gpu_process_vram_mib(pids: list[int]) -> int | None:
    executable = shutil.which("nvidia-smi")
    if not executable:
        return None
    try:
        result = subprocess.run(
            [executable, "--query-compute-apps=pid,used_memory",
             "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        wanted = set(pids)
        values = []
        for line in result.stdout.strip().splitlines():
            fields = [part.strip() for part in line.split(",")]
            if len(fields) == 2 and int(fields[0]) in wanted:
                values.append(int(fields[1]))
        return sum(values) if values else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


class ResourceSampler:
    def __init__(self, pids: list[int]) -> None:
        self.pids = pids
        self.samples: list[dict[str, Any]] = []
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, name="runtime-lab-sampler", daemon=True)
        self.psutil = None
        try:
            import psutil

            self.psutil = psutil
        except ImportError:
            pass

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.thread.join(timeout=8)

    def _sample(self) -> dict[str, Any]:
        row: dict[str, Any] = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "windows_commit": windows_commit(),
            "gpu": gpu_snapshot(),
            "runtime_vram_mib": gpu_process_vram_mib(self.pids),
            "runtime_rss_bytes": None,
            "runtime_private_bytes": None,
            "runtime_cpu_percent": None,
            "system_cpu_percent": None,
            "system_available_ram_bytes": None,
            "sampler": "psutil" if self.psutil else "system-only",
        }
        if self.psutil:
            try:
                row["system_available_ram_bytes"] = int(self.psutil.virtual_memory().available)
                row["system_cpu_percent"] = float(self.psutil.cpu_percent(interval=None))
                group = {}
                for pid in self.pids:
                    try:
                        root = self.psutil.Process(pid)
                        group[pid] = root
                        for child in root.children(recursive=True):
                            group[child.pid] = child
                    except self.psutil.Error:
                        continue
                rss = 0
                private_values = []
                cpu = 0.0
                for process in group.values():
                    try:
                        memory = process.memory_info()
                        rss += int(memory.rss)
                        try:
                            full_memory = process.memory_full_info()
                        except self.psutil.Error:
                            full_memory = memory
                        private_value = getattr(full_memory, "uss", None)
                        if private_value is None:
                            private_value = getattr(memory, "private", None)
                        if private_value is not None:
                            private_values.append(int(private_value))
                        cpu += float(process.cpu_percent(interval=None))
                    except self.psutil.Error:
                        continue
                row.update(
                    runtime_rss_bytes=rss,
                    runtime_private_bytes=sum(private_values) if private_values else None,
                    runtime_cpu_percent=cpu,
                )
            except self.psutil.Error:
                pass
        return row

    def _run(self) -> None:
        while not self.stop_event.is_set():
            try:
                self.samples.append(self._sample())
            except Exception:
                self.samples.append({"timestamp_utc": datetime.now(timezone.utc).isoformat(), "sample_error": True})
            self.stop_event.wait(SAMPLE_INTERVAL_SECONDS)


def run_case(
    endpoint: Any,
    lease: dict[str, Any],
    case: str,
    repetition: int,
    api_key: str | None,
) -> dict[str, Any]:
    payload = base_payload(lease, THROUGHPUT_PROMPT)
    expected_metrics = None
    if case == "tool_call":
        payload = base_payload(lease, TOOL_PROMPT)
        payload["tools"] = [TOOL_SCHEMA]
        payload["tool_choice"] = {"type": "function", "function": {"name": "schedule_rehearsal"}}
    elif case == "structured_output":
        payload = base_payload(lease, OUTPUT_PROMPT)
        payload["response_format"] = OUTPUT_SCHEMA
    elif case != "throughput":
        fail(f"Unknown case: {case}")
    before = metrics_snapshot(lease.get("metrics_url"))
    started = datetime.now(timezone.utc).isoformat()
    try:
        result = post_stream(endpoint, payload, api_key)
        request_error = None
    except Exception as exc:
        result = None
        request_error = f"{type(exc).__name__}: {exc}"
    after = metrics_snapshot(lease.get("metrics_url"))
    if result is None:
        return {
            "case": case,
            "repetition": repetition,
            "started_at_utc": started,
            "request_success": False,
            "error": request_error,
            "native_metrics": metrics_delta(before, after),
        }
    expected_metrics = metrics_delta(before, after)
    usage = result["usage"]
    completion_tokens = usage.get("completion_tokens")
    generation_rate = None
    if isinstance(completion_tokens, (int, float)) and result["total_latency_seconds"] > (result["time_to_first_delta_seconds"] or 0):
        generation_rate = completion_tokens / (
            result["total_latency_seconds"] - (result["time_to_first_delta_seconds"] or 0)
        )
    row = {
        "case": case,
        "repetition": repetition,
        "started_at_utc": started,
        "request_success": True,
        "total_latency_seconds": result["total_latency_seconds"],
        "time_to_first_delta_seconds": result["time_to_first_delta_seconds"],
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": completion_tokens,
        "generation_tokens_per_second_api_estimate": generation_rate,
        "finish_reason": result["finish_reason"],
        "native_metrics": expected_metrics,
    }
    if case == "tool_call":
        row["tool_validation"] = tool_result(result)
    elif case == "structured_output":
        row["structured_validation"] = structured_result(result)
    return row


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for case in ("throughput", "tool_call", "structured_output"):
        measured = [
            row for row in rows
            if row.get("case") == case and not row.get("warmup", False)
        ]
        successful = [row for row in measured if row.get("request_success")]
        latencies = [float(row["total_latency_seconds"]) for row in successful]
        summary[case] = {
            "attempts": len(measured),
            "successes": len(successful),
            "failures": sum(not row.get("request_success") for row in measured),
            "latency_mean_seconds": statistics.mean(latencies) if latencies else None,
            "latency_median_seconds": statistics.median(latencies) if latencies else None,
            "latency_stdev_seconds": statistics.stdev(latencies) if len(latencies) > 1 else None,
            "latency_min_seconds": min(latencies) if latencies else None,
            "latency_max_seconds": max(latencies) if latencies else None,
        }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lease", required=True, help="JSON lease for one explicitly owned local runtime")
    parser.add_argument("--output", required=True, help="Output JSON file; must not contain secrets")
    args = parser.parse_args()

    lease_path = Path(args.lease).expanduser().resolve(strict=True)
    lease = json.loads(lease_path.read_text(encoding="utf-8"))
    endpoint, artifact, pids = verify_lease(lease)
    api_key = local_api_key(lease)
    sampler = ResourceSampler(pids)
    sampler.start()
    time.sleep(IDLE_SAMPLE_SECONDS)
    rows: list[dict[str, Any]] = []
    warmup = run_case(endpoint, lease, "throughput", 0, api_key)
    warmup["warmup"] = True
    rows.append(warmup)
    for case in ("throughput", "tool_call", "structured_output"):
        for repetition in range(1, REPETITIONS + 1):
            rows.append(run_case(endpoint, lease, case, repetition, api_key))
    sampler.stop()

    report = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "lease": {
            key: lease.get(key)
            for key in (
                "lease_id", "owner", "backend_id", "backend_version",
                "runtime_engine", "engine_version", "endpoint", "model_id", "load_state",
                "api_key_environment_variable",
                "artifact_sha256", "runtime_pids", "context", "gpu_offload",
                "cpu_threads", "kv_profile",
            )
        },
        "artifact_path": str(artifact),
        "settings": {
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "seed": SEED,
            "output_tokens": OUTPUT_TOKENS,
            "repetitions": REPETITIONS,
            "idle_sample_seconds": IDLE_SAMPLE_SECONDS,
        },
        "prompt_text": THROUGHPUT_PROMPT,
        "tool_prompt": TOOL_PROMPT,
        "tool_schema": TOOL_SCHEMA,
        "structured_output_prompt": OUTPUT_PROMPT,
        "structured_output_schema": OUTPUT_SCHEMA,
        "rows": rows,
        "summary": summarize(rows),
        "resource_samples": sampler.samples,
        "limitations": [
            "The portable API stream does not provide a raw pre-parser tool trace.",
            "Generation rate is an API-level estimate unless native metrics are present.",
            "This runner does not perform backend lifecycle or crash-recovery tests.",
            "Windows process names and listener ownership are checked; lease ownership is operator-attested.",
            "nvidia-smi device VRAM is whole-device usage; process VRAM may be unavailable under WDDM.",
        ],
    }
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {output_path}")
    print(json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted; runtime was not stopped.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"Refusing/failed: {exc}", file=sys.stderr)
        raise SystemExit(2)
