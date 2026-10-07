import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {buildRoutes,generateOpenApi} from 'file:///E:/covert-workstation-integration-saul-20261006/node/src/openapi.ts';
const workspace=await mkdtemp(path.join(os.tmpdir(),'covert-project-contracts-'));
try {
 const routes=await buildRoutes(workspace,'0.1.0');
 const doc=generateOpenApi(routes,{title:'AIDE Arch Daemon API',version:'0.1.0'});
 const bytes=JSON.stringify(doc,null,2)+'\n';
 await writeFile('E:/covert-workstation-integration-saul-20261006/common/openapi.json',bytes,'utf8');
 console.log(JSON.stringify({documentedRoutes:routes.length,bytes:Buffer.byteLength(bytes),fixtureStorage:'C:'}));
} finally {await rm(workspace,{recursive:true,force:true});}
