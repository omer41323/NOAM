const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {zipSync,unzipSync,strToU8,strFromU8}=require('fflate');
const {validateState}=require('../public/sync-merge');
test('backup keeps child goal source names as text and file bytes unchanged',()=>{
 const state={tasks:[],notes:[],events:[],parentSessions:[],children:Array.from({length:9},(_,i)=>({id:String(i+1),name:'ילד '+(i+1)})),childGoals:[{id:'goal-1',child:'1',branches:[],source:{child:'שם מהמסמך'}}]};
 const file=new Uint8Array([0,255,23,42]);
 const archive=zipSync({'manifest.json':strToU8(JSON.stringify({format:'yom-tov-backup-v1',state,files:[{id:'f',child:'1',name:'מסמך.bin',path:'files/0'}]})),'files/0':file});
 const restored=unzipSync(archive),manifest=JSON.parse(strFromU8(restored['manifest.json']));
 assert.doesNotThrow(()=>validateState(manifest.state));assert.deepEqual(restored['files/0'],file);
});
test('actual local migration backup passes validation when present',t=>{
 const filename=path.resolve(__dirname,'../private/browser-backup-2026-10-31.zip');
 if(!fs.existsSync(filename)){t.skip('Private backup is deliberately excluded from Git');return;}
 const entries=unzipSync(fs.readFileSync(filename));const manifest=JSON.parse(strFromU8(entries['manifest.json']));
 assert.doesNotThrow(()=>validateState(manifest.state));assert.equal(manifest.state.children.length,9);assert.equal(manifest.state.childGoals.length,26);
 for(const f of manifest.files)assert.equal(entries[f.path].length,f.size);
});

