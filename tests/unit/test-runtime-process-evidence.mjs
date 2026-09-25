import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeProcessResources } from '../../scripts/qualification/runtime-process-evidence.mjs';

test('runtime resource evidence separates runtime executable name matches from other processes', () => {
  const result = summarizeProcessResources([
    { pid: 40, name: 'llama-server.exe', parent_pid: 10, working_set_bytes: 900, private_bytes: 800 },
    { pid: 30, name: 'browser.exe', parent_pid: 1, working_set_bytes: 700, private_bytes: 600 },
    { pid: 50, name: 'UNSLOTH.EXE', parent_pid: 10, working_set_bytes: 500, private_bytes: 400 },
    { pid: 60, name: 'codex.exe', parent_pid: 1, working_set_bytes: 300, private_bytes: 200 }
  ]);

  assert.equal(result.sampled_process_count, 4);
  assert.equal(result.total_private_bytes, 2000);
  assert.equal(result.runtime_name_match_private_bytes, 1200);
  assert.equal(result.non_runtime_private_bytes, 800);
  assert.deepEqual(result.runtime_name_matches.map(process => process.pid), [40, 50]);
  assert.deepEqual(result.largest_non_runtime_processes.map(process => process.pid), [30, 60]);
  assert.deepEqual(Object.keys(result.largest_non_runtime_processes[0]).sort(), [
    'name', 'parent_pid', 'pid', 'private_bytes', 'working_set_bytes'
  ]);
});

test('runtime resource evidence excludes the sampler and caps non-runtime details', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    pid: index + 1,
    name: `worker-${index}.exe`,
    parent_pid: 1,
    working_set_bytes: index + 1,
    private_bytes: index + 1,
    command_line: 'must not be projected',
    executable_path: 'must not be projected'
  }));
  const result = summarizeProcessResources(rows, { excludedPids: [12] });

  assert.equal(result.sampled_process_count, 11);
  assert.equal(result.non_runtime_private_bytes, 66);
  assert.equal(result.largest_non_runtime_processes.length, 8);
  assert.equal(result.largest_non_runtime_processes[0].pid, 11);
  assert.equal(JSON.stringify(result).includes('command_line'), false);
  assert.equal(JSON.stringify(result).includes('executable_path'), false);
});

test('runtime resource evidence rejects invalid memory fields instead of fabricating zeros', () => {
  assert.throws(() => summarizeProcessResources([
    { pid: 1, name: 'x.exe', parent_pid: 0, working_set_bytes: -1, private_bytes: 0 }
  ]), /working set must be a non-negative safe integer/);
});
