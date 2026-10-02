import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Reproduction harness: require a disposable fixture and a separate Pi profile.
assert.ok(process.argv[2], 'pass the disposable audit fixture root');
const root=await realpath(process.argv[2]);
assert.equal(path.dirname(root), '/private/tmp');
assert.match(path.basename(root), /^pi-perimeter-audit-[a-zA-Z0-9-]+$/);
assert.equal(process.env.PI_CODING_AGENT_DIR, path.join(root,'agent'));
assert.equal(process.env.HOME, path.join(root,'home'));
for(const name of ['workspace','agent','peer']) assert.equal(await realpath(path.join(root,name)),path.join(root,name));
const sdk=await import(pathToFileURL(path.join(root,'peer/node_modules/@earendil-works/pi-coding-agent/dist/index.js')).href);
const peer=JSON.parse(await readFile(path.join(root,'peer/node_modules/@earendil-works/pi-coding-agent/package.json'),'utf8'));
assert.equal(peer.version,'1.0.0');
const cwd=path.join(root,'workspace'),agentDir=path.join(root,'agent'),entry=path.join(agentDir,'npm/node_modules/pi-perimeter/src/index.ts');
const helper=existsSync(path.join(agentDir,'npm/node_modules/pi-perimeter/native/build-manifest.json'));
const passed=[];const note=(name)=>{passed.push(name);console.log(JSON.stringify({check:name,status:'PASS'}));};
await writeFile(path.join(root,'outside.txt'),'synthetic outside\n');
await writeFile(path.join(cwd,'ordinary.txt'),'synthetic ordinary\n');
const {session}=await sdk.createAgentSession({cwd,agentDir,sessionManager:sdk.SessionManager.inMemory(cwd)});
try {
 await session.bindExtensions({mode:'rpc'});
 const loaded=session.resourceLoader.getExtensions();
 assert.deepEqual(loaded.errors,[]);
 assert.ok(loaded.extensions.some(e=>e.path===entry));note('real Pi 1.0.0 loader and session readiness');
 for(const name of ['read','write','edit','grep','find','ls','bash'])assert.equal(session.getAllTools().find(t=>t.name===name)?.sourceInfo?.path,entry);
 note('seven tool owners match installed extension');
 const gate=async(name,args,id)=>await session.agent.beforeToolCall({toolCall:{type:'toolCall',id,name,arguments:args},args});
 const execute=async(name,args,id)=>{assert.equal(await gate(name,args,id),undefined);const tool=session.agent.state.tools.find(t=>t.name===name);assert.ok(tool,`${name} active`);return await tool.execute(id,args,new AbortController().signal);};
 const text=result=>result.content.map(v=>v.type==='text'?v.text:'').join('\n');
 assert.match(text(await execute('read',{path:'ordinary.txt'},'ordinary-read')),/synthetic ordinary/);note('ordinary read through gate and executor');
 assert.match((await gate('read',{path:'.env'},'secret-read'))?.reason??'',/SECRET_RESOURCE/);note('synthetic secret denied');
 const external=await gate('read',{path:path.join(root,'outside.txt')},'external-read');assert.equal(external?.block,true);assert.match(external.reason,/approval required/);note('external read refused without approval UI');
 for(const name of ['audit_unknown','codemode','mcp__audit__tool'])assert.match((await gate(name,{},'unknown-'+name))?.reason??'',/not integrated/);note('unknown, codemode and MCP tools blocked');
 await execute('write',{path:'ordinary.txt',content:'synthetic written\n'},'ordinary-write');assert.equal(await readFile(path.join(cwd,'ordinary.txt'),'utf8'),'synthetic written\n');note('existing-file write through gate and executor');
 await execute('edit',{path:'ordinary.txt',edits:[{oldText:'written',newText:'edited'}]},'ordinary-edit');assert.equal(await readFile(path.join(cwd,'ordinary.txt'),'utf8'),'synthetic edited\n');note('existing-file edit through gate and executor');
 for(const [name,args] of [['ls',{path:cwd}],['find',{path:cwd,pattern:'*'}],['grep',{path:cwd,pattern:'synthetic'}]]){const result=text(await execute(name,args,'search-'+name));assert.ok(!result.includes('SYNTHETIC_ONLY'));}
 note('controlled listing, finding and grep');
 const controlled=session.agent.state.tools.find(t=>t.name==='write');let refused=false;
 try{const result=await controlled.execute('unbound-write',{path:path.join(cwd,'ordinary.txt'),content:'MUST_NOT_WRITE'},new AbortController().signal);refused=result.isError===true||/without a gate-issued authorization/.test(text(result));}catch(error){refused=/without a gate-issued authorization/.test(String(error));}
 assert.equal(refused,true);assert.equal(await readFile(path.join(cwd,'ordinary.txt'),'utf8'),'synthetic edited\n');note('direct tool invocation without gate binding refused');
 const shellArgs={command:'printf PI1_MODEL_SHELL'};
 if(!helper){assert.match((await gate('bash',shellArgs,'shell-missing'))?.reason??'',/HELPER_MISSING/);note('missing native helper fails closed');}
 else{
  const output=text(await execute('bash',shellArgs,'shell-contained'));assert.match(output,/PI1_MODEL_SHELL/);assert.match(output,/contained run finished/);assert.match(output,/network closed/);note('model shell contained with closed networking');
  for(const excludeFromContext of [false,true]){const handled=await session.extensionRunner.emitUserBash({type:'user_bash',command:'printf PI1_USER_SHELL',cwd,excludeFromContext});assert.ok(handled?.result);const user=handled.result;assert.match(user.output,/PI1_USER_SHELL/);assert.match(user.output,/contained run finished/);assert.match(user.output,/network closed/);}note('user ! and !! hooks return contained replacement results');
  const args={command:'printf synthetic-exported > ordinary.txt'};await execute('bash',args,'shell-export');assert.equal(await readFile(path.join(cwd,'ordinary.txt'),'utf8'),'synthetic-exported');note('contained shell changes exported to synthetic workspace');
 }
 console.log(JSON.stringify({peer:peer.version,helper,passed:passed.length,status:'PASS'}));
}finally{session.dispose();}
