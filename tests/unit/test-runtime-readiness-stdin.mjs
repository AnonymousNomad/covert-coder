import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProviderDeps } from '../../node/src/services/runtime-providers.ts';

test('noninteractive readiness execution closes unused stdin so EOF-dependent probes can finish',async()=>{
 const deps=createDefaultProviderDeps();
 const result=await deps.execBounded(process.execPath,['-e',"process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('READINESS_EOF'));"],3000);
 assert.equal(result.code,0);assert.equal(result.stdout,'READINESS_EOF');
});
