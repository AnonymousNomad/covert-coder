import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResidentPresentation,ResidentAutonomyPolicy,evaluateResidentInitiative } from '../../common/platform/resident-policy.ts';
const policy={schema:'covert.resident-autonomy-policy.v1',policy_id:'operator.dogfood',resident_id:'covert.resident.cipher',profile_name:'Personal',proactivity:'FULL_COMPANION',default_effect_policy:'ALLOW_IF_ALREADY_GRANTED',capabilities:{'workspace.write':{policy:'ALLOW_IF_GRANTED',scope_refs:['project:approved']}},cannot_self_grant:true};
test('personal high initiative and public conservative defaults use one policy type without minting grants',()=>{
 const high=ResidentAutonomyPolicy.parse(policy);
 assert.equal(evaluateResidentInitiative(high,'workspace.write'),'REQUEST_CANONICAL_AUTHORITY');
 const conservative=ResidentAutonomyPolicy.parse({...policy,proactivity:'CRITICAL_ONLY',default_effect_policy:'ASK',capabilities:{}});
 assert.equal(evaluateResidentInitiative(conservative,'workspace.write'),'ASK_OPERATOR');
});
test('DENY restricts even an otherwise eligible canonical capability',()=>{
 const deny=ResidentAutonomyPolicy.parse({...policy,capabilities:{'workspace.write':{policy:'DENY'}}});
 assert.equal(evaluateResidentInitiative(deny,'workspace.write'),'DENY');
});
test('personality, avatar, voice and permission fields cannot silently broaden autonomy',()=>{
 assert.throws(()=>ResidentAutonomyPolicy.parse({...policy,cannot_self_grant:false}));
 assert.throws(()=>ResidentAutonomyPolicy.parse({...policy,grants:['workspace.write']}));
 assert.throws(()=>ResidentAutonomyPolicy.parse({...policy,personality:'unrestricted'}));
});
test('four chassis share one logical Resident; preferences do not activate capture or alter permissions',()=>{
 for(const family of ['Scout','Rook','Mutt','Tinker']){
  const presentation=ResidentPresentation.parse({schema:'covert.resident-presentation.v1',resident_id:'covert.resident.cipher',mode:'BUDDY',chassis:family,personality_ref:'persona:developers-special',voice_ref:null,voice_mode:'DISABLED'});
  assert.equal(presentation.resident_id,policy.resident_id);assert.equal('grants' in presentation,false);
 }
 assert.throws(()=>ResidentPresentation.parse({schema:'covert.resident-presentation.v1',resident_id:'second.assistant',mode:'BUDDY',chassis:'Scout',personality_ref:null,voice_ref:null,voice_mode:'DISABLED'}));
});
test('unknown capability and credential/Authority control requests are refused as initiative',()=>{
 assert.equal(evaluateResidentInitiative(ResidentAutonomyPolicy.parse(policy),'unknown.operation'),'DENY');
 assert.equal(evaluateResidentInitiative(ResidentAutonomyPolicy.parse(policy),'authority.grant'),'DENY');
});
