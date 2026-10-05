import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const output=await mkdtemp(path.join(os.tmpdir(),'jizura-components-'));
const transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('mcp/server.mjs')],env:{...process.env,JIZURA_OUTPUT_DIR:output},stderr:'pipe'});transport.stderr?.on('data',b=>process.stderr.write(b));
const client=new Client({name:'custom-components-test',version:'1'});
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});assert.ok(!r.isError,JSON.stringify(r));return r;};const json=r=>JSON.parse(r.content[0].text);
const save=async(session,kind,filename)=>{const {id:job}=json(await call('export_start',{session,kind,filename}));for(let n=0;n<100;n++){const result=json(await call('job_status',{job}));if(result.status!=='running'){assert.equal(result.status,'completed',JSON.stringify(result));return result.path;}await new Promise(r=>setTimeout(r,100));}throw Error('Export timeout');};
try{
 await client.connect(transport);const {session}=json(await call('session_create'));
 const spec=json(await call('custom_effect_spec',{session}));assert.ok(spec.groups.includes('decor')&&spec.groups.includes('mediaEnter'));
 const components=[spec.example,{version:1,id:'custom_sway',group:'hold',name:'独自スイング',nameEn:'Custom sway',tags:['pop'],base:'still',params:{amount:8},labels:{amount:{ja:'揺れ幅',en:'Sway amount'}},motion:{rotation:{value:0,amplitude:{param:'amount',default:8},cycles:2}}}];
 await call('custom_effect_validate',{session,components});assert.equal(json(await call('custom_effect_list',{session})).length,0);
 const bad=structuredClone(components);bad[0].program.nodes[0].x='fetch("secret")';assert.equal((await client.callTool({name:'custom_effect_import',arguments:{session,components:bad}})).isError,true);
 await call('custom_effect_import',{session,components});assert.equal(json(await call('custom_effect_list',{session})).length,2);
 await call('theme_set',{session,themes:['cute']});const candidates=json(await call('theme_candidates',{session}));assert.ok(candidates.lyrics.decor.includes(spec.example.id));
 await call('project_edit',{session,changes:[{path:['lyrics'],value:'[00:00]プレビュー|ルビ'},{path:['durationOverride'],value:3}]});
 const before=json(await call('project_get',{session}));const preview=await call('custom_effect_preview',{session,id:spec.example.id,time:.3,width:320});assert.equal(preview.content[1].type,'image');assert.deepEqual(json(await call('project_get',{session})),before);
 const payload={format:'jizura-cut-effects',version:1,kind:'lyrics',native:{},components,details:{layout:'center',enter:'pop',hold:'custom_sway',exit:'shrink',decor:[{id:spec.example.id,radius:.2}]}};
 const favorite=json(await call('favorite_save',{session,name:'Standard + custom',payload})).favorite;
 await call('favorite_apply',{session,id:favorite.id,layer:'lyrics',index:0});const state=json(await call('project_get',{session}));assert.equal(state.cuts.lyrics[0].hold,'custom_sway');assert.equal(state.cuts.lyrics[0].enter,'pop');
 await call('cut_update',{session,layer:'lyrics',index:0,patch:{details:{...state.project.lyricCutOptions['0:0'].details,holdP:{amount:22}}}});
 assert.equal(json(await call('project_get',{session})).cuts.lyrics[0].holdP.amount,22);
 const file=await save(session,'favorites','custom-components.jizuraichifav'),fresh=json(await call('session_create')).session;
 await call('asset_import',{session:fresh,kind:'favorites',path:file,mode:'replace'});assert.deepEqual(json(await call('custom_effect_list',{session:fresh})),components);
 const loaded=json(await call('favorite_list',{session:fresh}));assert.equal(loaded[0].payload.details.hold,'custom_sway');assert.equal((await call('custom_effect_preview',{session:fresh,id:'custom_sway',time:1})).content[1].type,'image');
 const project=await save(session,'project','custom-project.jizuraichi');await call('asset_import',{session:fresh,kind:'project',path:project});assert.equal(json(await call('project_get',{session:fresh})).cuts.lyrics[0].holdP.amount,22);
 await call('session_close',{session});await call('session_close',{session:fresh});console.log('PASS MCP custom components author/import/preview/export:',output);
}finally{await client.close();await transport.close();}
