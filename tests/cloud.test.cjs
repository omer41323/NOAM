const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {merge,validateState}=require('../public/sync-merge.js');
const root=path.resolve(__dirname,'../public');
const minimal=()=>({tasks:[],events:[],notes:[],parentSessions:[],childGoals:[],children:Array.from({length:9},(_,i)=>({id:String(i+1),name:'ילד '+(i+1)}))});
test('two devices add different tasks without data loss',()=>{
 const base=minimal(),local=structuredClone(base),remote=structuredClone(base);
 local.tasks.push({id:'a',title:'local'});remote.tasks.push({id:'b',title:'remote'});
 const result=merge(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.equal(result.value.tasks.length,2);
});
test('separate edits on one record merge, same-field edits require choice',()=>{
 const base={tasks:[{id:'a',title:'A',status:'open'}]};
 const r=merge(base,{tasks:[{id:'a',title:'B',status:'open'}]},{tasks:[{id:'a',title:'A',status:'done'}]});
 assert.deepEqual(r.value.tasks,[{id:'a',title:'B',status:'done'}]);assert.deepEqual(r.conflicts,[]);
 assert.deepEqual(merge(base,{tasks:[{id:'a',title:'B',status:'open'}]},{tasks:[{id:'a',title:'C',status:'open'}]}).conflicts,['/tasks/a/title']);
});
test('delete vs edit is never silently discarded',()=>{
 const r=merge({tasks:[{id:'a',title:'A'}]},{tasks:[]},{tasks:[{id:'a',title:'B'}]});assert.equal(r.conflicts.length,1);
});
test('backup rejects IDs that could enter an inline handler',()=>{
 const data=minimal();data.tasks.push({id:"a');alert(1)//"});assert.throws(()=>validateState(data));assert.doesNotThrow(()=>validateState(minimal()));
});
test('public app contains no imported clinical goals or child names',()=>{
 const all=fs.readdirSync(root).filter(f=>/\.(js|html)$/.test(f)).map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'noam-calendar.js'),'utf8')+';this.names=NOAM_CHILD_NAMES',context);
 assert.equal(context.names.length,9);assert.ok(context.names.every((name,i)=>name==='ילד '+(i+1)));
 assert.equal(all.includes('מטרות ילדים.docx'),false);
 assert.equal(fs.readFileSync(path.join(root,'child-goals-data.js'),'utf8').includes('const IMPORTED_CHILD_GOALS=[]'),true);
});
test('calendar and parent tracking preserve annual A/B schedule with generic public labels',()=>{
 const context=vm.createContext({console,Date,Set,Map,structuredClone});
 vm.runInContext(`const state=${JSON.stringify({...minimal(),cancelledOccurrences:[],noamScheduleVersion:1,noamChildNameVersion:2})};const today='2026-10-31';const shift=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};function systemChildName(id){return 'ילד '+id}`,context);
 vm.runInContext(fs.readFileSync(path.join(root,'noam-calendar.js'),'utf8'),context);
 const results=vm.runInContext(`({all:calendarEvents('2026-10-05','2027-08-11').length,parents:calendarEvents('2026-10-05','2027-08-11').filter(e=>e.kind==='parent').length,a:calendarEvents('2026-11-02','2026-11-02').find(e=>e.templateId==='noam-6'),b:calendarEvents('2026-11-09','2026-11-09').find(e=>e.templateId==='noam-6')})`,context);
 assert.equal(results.all,1147);assert.equal(results.parents,202);assert.equal(results.a.child,'5');assert.equal(results.b.child,'9');assert.equal(results.a.time,'13:30');
});
function cloudHarness(){
 const dom={getElementById:id=>({dataset:{},classList:{add(){},remove(){}},textContent:'',hidden:false}),querySelector:()=>null,addEventListener(){}};
 const context=vm.createContext({window:{},document:dom,structuredClone,setTimeout,clearTimeout,setInterval:()=>{},navigator:{onLine:true},localStorage:{setItem(){},removeItem(){}},console,SyncMerge:require('../public/sync-merge.js')});
 vm.runInContext(fs.readFileSync(path.join(root,'cloud.js'),'utf8'),context);
 const cloud=context.window.Cloud;cloud.loaded=true;cloud.user={id:'test'};cloud.row={id:'workspace',revision:1};cloud.base=minimal();cloud.status=()=>{};context.window.replaceCloudState=()=>{};
 return cloud;
}
test('failed cloud save preserves pending changes for retry',async()=>{
 const cloud=cloudHarness();cloud.pending={...minimal(),tasks:[{id:'a',title:'pending'}]};
 cloud.client={from:()=>({update:()=>({eq(){return this},select(){return this},maybeSingle:async()=>({error:new Error('network')})})})};
 await cloud.flush();assert.equal(cloud.pending.tasks[0].title,'pending');assert.equal(cloud.busy,false);
});
test('CAS conflict re-reads remote, merges disjoint edits, then saves both',async()=>{
 const cloud=cloudHarness();cloud.pending={...minimal(),tasks:[{id:'a',title:'local'}]};let calls=0,stored;
 cloud.read=async()=>({id:'workspace',revision:2,payload:{...minimal(),notes:[{id:'n',text:'remote'}]}});
 cloud.client={from:()=>({update:payload=>({eq(){return this},select(){return this},maybeSingle:async()=>{calls++;if(calls===1)return {data:null};stored=payload;return {data:{id:'workspace',...payload}};}})})};
 await cloud.flush();assert.equal(calls,2);assert.equal(stored.payload.tasks.length,1);assert.equal(stored.payload.notes.length,1);assert.equal(stored.revision,3);assert.equal(cloud.pending,null);
});

