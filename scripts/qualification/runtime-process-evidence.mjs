const DEFAULT_RUNTIME_NAMES = new Set(['unsloth.exe', 'llama-server.exe']);

function nonNegativeSafeInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return number;
}

/**
 * Project a Windows process snapshot into bounded, non-secret resource evidence.
 * Runtime classification here is by executable name; ownership is recorded separately by Runtime Broker.
 * Paths, command lines, environment variables, and window titles are omitted.
 */
export function summarizeProcessResources(processRows, { runtimeNames = DEFAULT_RUNTIME_NAMES, excludedPids = [] } = {}) {
  const rows = Array.isArray(processRows) ? processRows : processRows == null ? [] : [processRows];
  const runtimeNameSet = new Set([...runtimeNames].map(name => String(name).toLowerCase()));
  const excluded = new Set(excludedPids.map(pid => nonNegativeSafeInteger(pid, 'excluded pid')));
  const processes = rows.map(row => {
    if (!row || typeof row !== 'object') throw new TypeError('process row must be an object');
    return {
      pid: nonNegativeSafeInteger(row.pid, 'pid'),
      name: String(row.name ?? ''),
      parent_pid: nonNegativeSafeInteger(row.parent_pid, 'parent pid'),
      working_set_bytes: nonNegativeSafeInteger(row.working_set_bytes, 'working set'),
      private_bytes: nonNegativeSafeInteger(row.private_bytes, 'private bytes')
    };
  }).filter(process => !excluded.has(process.pid));
  const runtimeNameMatches = processes.filter(process => runtimeNameSet.has(process.name.toLowerCase()));
  const nonRuntimeProcesses = processes.filter(process => !runtimeNameSet.has(process.name.toLowerCase()));
  const sum = list => list.reduce((total, process) => total + process.private_bytes, 0);

  return {
    sampled_process_count: processes.length,
    total_private_bytes: sum(processes),
    runtime_name_match_private_bytes: sum(runtimeNameMatches),
    non_runtime_private_bytes: sum(nonRuntimeProcesses),
    runtime_name_matches: runtimeNameMatches,
    largest_non_runtime_processes: nonRuntimeProcesses
      .sort((left, right) => right.private_bytes - left.private_bytes || left.pid - right.pid)
      .slice(0, 8)
  };
}
