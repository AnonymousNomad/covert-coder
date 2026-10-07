import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProviderDeps } from '../../node/src/services/runtime-providers.ts';

test('noninteractive readiness execution closes unused stdin so EOF-dependent probes can finish',async()=>{
 const deps=createDefaultProviderDeps();
 const result=await deps.execBounded(process.execPath,['-e',"process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('READINESS_EOF'));"],3000);
 assert.equal(result.code,0);assert.equal(result.stdout,'READINESS_EOF');
});

test('noninteractive readiness refuses missing executables', async () => {
 await assert.rejects(createDefaultProviderDeps().execBounded(process.execPath + '.covert-missing-readiness-exe', [], 3000), { code: 'ENOENT' });
});
test('noninteractive readiness refuses a nonzero exit and retains diagnostic stderr', async () => {
 await assert.rejects(createDefaultProviderDeps().execBounded(process.execPath, ['-e', "process.stderr.write('PROBE_REFUSAL');process.exit(7);"], 3000), /exited 7: PROBE_REFUSAL/);
});
test('noninteractive readiness retains its timeout refusal', async () => {
 await assert.rejects(createDefaultProviderDeps().execBounded(process.execPath, ['-e', 'setInterval(()=>{},1000);'], 250), /deadline exceeded after 250 ms/);
});
test('noninteractive readiness bounds captured output and refuses overflow', async () => {
 await assert.rejects(createDefaultProviderDeps().execBounded(process.execPath, ['-e', 'process.stdout.write(Buffer.alloc(1024*1024+1,97));setInterval(()=>{},1000);'], 3000), /output exceeded 1 MiB/);
});
test('noninteractive readiness deadline does not wait for descendant-held output pipes', async () => {
 const started = performance.now();
 const parent = "const {spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},3000);'],{stdio:['ignore',process.stdout,process.stderr]});setInterval(()=>{},1000);";
 await assert.rejects(createDefaultProviderDeps().execBounded(process.execPath, ['-e', parent], 500), /exited|deadline/);
 assert.ok(performance.now() - started < 1500, 'readiness refusal exceeded its deadline while descendant retained output');
});
