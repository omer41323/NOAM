const {test}=require('node:test');
const assert=require('node:assert/strict');
const rows=[{username:'owner',email:'owner@example.test',workspace_id:'one',auth_user_id:'owner-id',is_owner:true},{username:'member',email:'member@example.test',workspace_id:'one',auth_user_id:null,is_owner:false},{username:'outsider',email:'outside@example.test',workspace_id:'two',auth_user_id:null,is_owner:false}];
async function harness({actor='owner-id',allowed=true,login=true}={}){
 const {createHandler}=await import('../supabase/functions/account-access/handler.mjs');
 const accounts=structuredClone(rows),created=[];
 const admin={from(){let matches=accounts;return {
  select(){return this},eq(k,v){matches=matches.filter(r=>r[k]===v);return this},is(k,v){matches=matches.filter(r=>r[k]===v);return this},
  async maybeSingle(){return {data:matches[0]||null}},update(v){this.values=v;return this},
  then(resolve){if(this.values)matches.forEach(r=>Object.assign(r,this.values));resolve({data:matches});}
 }},async rpc(){return {data:allowed}},auth:{
  async getUser(token){return token==='valid'?{data:{user:{id:actor,email_confirmed_at:'2026-01-01'}}}:{error:Error('invalid')};},
  admin:{async createUser(input){created.push(input);return {data:{user:{id:'created-id'}}};}}
 }};
 let authCalls=0;
 const handler=createHandler({admin,passwordClient:()=>({auth:{async signInWithPassword(){authCalls++;return login?{data:{user:{id:actor},session:{access_token:'access',refresh_token:'refresh'}}}:{error:Error('invalid')};}}})});
 const call=(body,token)=>handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
 return {call,created,accounts,authCalls:()=>authCalls};
}
test('password login issues a session only for the mapped auth identity',async()=>{
 const h=await harness();const r=await h.call({action:'login',username:' OWNER ',password:'test-password'});
 assert.equal(r.status,200);assert.equal((await r.json()).session.access_token,'access');
 const mismatch=await harness({actor:'different-id'});
 assert.equal((await mismatch.call({action:'login',username:'owner',password:'test-password'})).status,401);
});
test('unknown username and wrong password do not reveal email or account existence',async()=>{
 const h=await harness({login:false});
 const a=await h.call({action:'login',username:'owner',password:'wrong'});
 const b=await h.call({action:'login',username:'unknown',password:'wrong'});
 assert.equal(a.status,401);assert.deepEqual(await a.json(),await b.json());
});
test('rate limit prevents password verification and fails closed',async()=>{
 const h=await harness({allowed:false});
 assert.equal((await h.call({action:'login',username:'owner',password:'test'})).status,429);assert.equal(h.authCalls(),0);
});
test('provision rejects anonymous, forged, non-owner and different-workspace requests',async()=>{
 const body={action:'provision',username:'member',password:'a-long-test-password'};
 const h=await harness();
 assert.equal((await h.call(body)).status,401);assert.equal((await h.call(body,'forged')).status,401);
 assert.equal((await h.call({...body,username:'outsider'},'valid')).status,403);
 const member=await harness({actor:'member-id'});member.accounts[1].auth_user_id='member-id';
 assert.equal((await member.call(body,'valid')).status,403);assert.equal(h.created.length,0);assert.equal(member.created.length,0);
});
test('owner can initialize only a preapproved member, without overwriting an existing account',async()=>{
 const h=await harness();const body={action:'provision',username:'member',password:'a-long-test-password'};
 assert.equal((await h.call({...body,password:'short'},'valid')).status,400);
 assert.equal((await h.call(body,'valid')).status,200);
 assert.equal(h.created[0].email,'member@example.test');assert.equal(h.created[0].email_confirm,true);
 assert.equal(h.accounts[1].auth_user_id,'created-id');
 assert.equal((await h.call(body,'valid')).status,409);assert.equal(h.created.length,1);
});
test('profile contains username and pending accounts but no email addresses',async()=>{
 const h=await harness();const r=await h.call({action:'profile'},'valid');
 assert.deepEqual(await r.json(),{username:'owner',pending:['member']});
});
