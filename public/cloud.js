/* Authentication is followed by RLS-authorized data loading. No private seeds in this bundle. */
const Cloud = window.Cloud = {
  client: null, row: null, user: null, base: null, pending: null,
  busy: false, blocked: false, loaded: false, timer: null, fileBusy: 0,
  key() { return 'yom-tov-cloud-pending:' + this.user.id + ':' + this.row.id; },
  status(text, mode='saved') {
    const el=document.getElementById('cloud-status');if(el){el.dataset.state=mode;el.textContent=text;}
  },
  persist() {
    if(!this.pending)return;
    localStorage.setItem(this.key(),JSON.stringify({base:this.base,pending:this.pending,revision:this.row.revision}));
  },
  save(data) {
    this.pending=structuredClone(data);
    try{this.persist();this.status('שינויים ממתינים לשמירה','pending');}
    catch{this.status('אין מקום לגיבוי מקומי · יש להשאיר את הדף פתוח','error');}
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),350);
  },
  async read() {
    const {data,error}=await this.client.from('workspaces').select('id,payload,revision,updated_at').eq('id',this.row.id).single();
    if(error)throw error;return data;
  },
  async flush() {
    if(this.busy||this.blocked||!this.pending||!this.loaded)return;
    this.busy=true;this.status('שומר בענן…','pending');
    try {
      // CAS prevents one device from overwriting a newer workspace revision.
      while(this.pending&&!this.blocked){
        const snapshot=structuredClone(this.pending);
        const {data,error}=await this.client.from('workspaces').update({payload:snapshot,revision:this.row.revision+1}).eq('id',this.row.id).eq('revision',this.row.revision).select('id,payload,revision,updated_at').maybeSingle();
        if(error)throw error;
        if(!data){
          const remote=await this.read();
          const merged=SyncMerge.merge(this.base,this.pending,remote.payload);
          this.base=structuredClone(remote.payload);this.row=remote;
          this.pending=merged.value;this.persist();
          if(merged.conflicts.length){this.blocked=true;this.conflictCount=merged.conflicts.length;this.status('יש שינויים מקבילים · לחצו לבחירה','conflict');break;}
          window.replaceCloudState(merged.value);continue;
        }
        this.row=data;this.base=structuredClone(snapshot);
        if(JSON.stringify(snapshot)===JSON.stringify(this.pending)){this.pending=null;localStorage.removeItem(this.key());}
        else this.persist();
      }
      if(!this.pending)this.status('✓ נשמר בענן');
    }catch(error){this.status(navigator.onLine?'השמירה לא הושלמה · לחצו לניסיון נוסף':'אין חיבור · השינויים ממתינים','error');}
    finally{this.busy=false;}
  },
  async refresh() {
    if(!this.loaded||this.busy||this.blocked)return;
    if(this.pending){await this.flush();return;}
    this.busy=true;
    try{
      const remote=await this.read();
      // An edit may have happened while the request was in flight.
      if(this.pending)return;
      if(remote.revision!==this.row.revision){
        // Do not replace a form being edited; the next save will merge against this base.
        if(document.querySelector('#modal[open]'))return;
        this.row=remote;this.base=structuredClone(remote.payload);window.replaceCloudState(remote.payload);
      }
      this.status('✓ נשמר בענן');
    }catch{this.status('לא ניתן לבדוק עדכונים · לחצו לניסיון נוסף','error');}
    finally{this.busy=false;}
  },
  showSync() {
    if(!this.blocked){this.flush();this.refresh();return;}
    modal('שינויים משני מכשירים',`<p class="sync-conflict">אותו פריט נערך גם במכשיר אחר. אף גרסה לא נדרסה. אפשר להוריד גיבוי של העריכה המקומית לפני הבחירה.</p><div class="actions"><button class="btn secondary" onclick="Cloud.exportPending()">גיבוי השינויים שלי</button><button class="btn" onclick="Cloud.resolve('local')">שמירת השינויים שלי</button><button class="text-link" onclick="Cloud.resolve('remote')">טעינת הגרסה שבענן</button></div>`);
  },
  exportPending(){this.download(new Blob([JSON.stringify({format:'yom-tov-state-v1',state:this.pending})],{type:'application/json'}),'yom-tov-pending.json');},
  async resolve(choice){
    if(choice==='remote'){this.exportPending();const remote=await this.read();this.row=remote;this.base=structuredClone(remote.payload);this.pending=null;localStorage.removeItem(this.key());window.replaceCloudState(remote.payload);}
    this.blocked=false;document.getElementById('modal').close();await this.flush();if(!this.pending)this.status('✓ נשמר בענן');
  },
  async fileList(child) {
    let query=this.client.from('child_files').select('*').eq('workspace_id',this.row.id);
    if(child)query=query.eq('child',child);
    const {data,error}=await query.order('added',{ascending:false});if(error)throw error;
    return data.map(f=>({...f,noteId:f.note_id}));
  },
  async fileGet(id) {
    const {data:f,error}=await this.client.from('child_files').select('*').eq('workspace_id',this.row.id).eq('id',id).single();if(error)throw error;
    const {data:blob,error:downloadError}=await this.client.storage.from('child-files').download(f.storage_path);if(downloadError)throw downloadError;
    return {...f,noteId:f.note_id,blob};
  },
  async filePut(file) {
    if(!/^[a-zA-Z0-9_@.:-]+$/.test(file.id)||!/^[1-9]$/.test(file.child)||file.blob.size>20*1024*1024)throw Error('קובץ לא תקין');
    this.fileBusy++;
    const storage_path=this.row.id+'/'+crypto.randomUUID();
    try{
      const {error:uploadError}=await this.client.storage.from('child-files').upload(storage_path,file.blob,{contentType:file.type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;
      const {error}=await this.client.from('child_files').upsert({workspace_id:this.row.id,id:file.id,child:file.child,name:file.name,size:file.blob.size,type:file.type||'',storage_path,added:file.added,note_id:file.noteId||null},{onConflict:'workspace_id,id'});
      if(error){await this.client.storage.from('child-files').remove([storage_path]);throw error;}
      // Older object versions remain private, so a racing replacement never deletes another upload.
    }finally{this.fileBusy--;}
  },
  async fileDelete(id) {
    this.fileBusy++;
    try {
      const {data:f,error:readError}=await this.client.from('child_files').select('storage_path').eq('workspace_id',this.row.id).eq('id',id).single();if(readError)throw readError;
      const {error}=await this.client.from('child_files').delete().eq('workspace_id',this.row.id).eq('id',id).eq('storage_path',f.storage_path);if(error)throw error;
      // Retain the private object for recovery; it is no longer listed in the app.
    }finally{this.fileBusy--;}
  },
  async fileOperation(mode,operation) {
    const jobs=[];
    const table={put:f=>{jobs.push(()=>this.filePut(f));},get:id=>{jobs.push(()=>this.fileGet(id));},delete:id=>{jobs.push(()=>this.fileDelete(id));},getAll:()=>{jobs.push(()=>this.fileList());},index:()=>({getAll:child=>{jobs.push(()=>this.fileList(child));}}),clear:()=>{throw Error('איפוס ענן אינו זמין');}};
    operation(table);let result;for(const job of jobs)result=await job();return result;
  },
  download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);},
  backupForm(){modal('גיבוי והעברת נתונים',`<p class="backup-help">אפשר להוריד גיבוי מלא עם הקבצים, או לייבא גיבוי מהדמו הישן. הייבוא מוסיף פריטים חסרים בלבד ושומר את הפריטים שכבר בענן. הקובץ מכיל מידע אישי — שמרו אותו במקום פרטי.</p><div class="actions"><button class="btn" id="backup-export" onclick="Cloud.exportBackup()">הורדת גיבוי מלא</button></div><label class="field">ייבוא קובץ גיבוי<input type="file" id="backup-input" accept=".zip,.json"></label><button class="btn secondary" id="backup-import" onclick="Cloud.importBackup()">בדיקת הגיבוי לייבוא</button><p id="backup-status" role="status"></p>`);},
  async exportBackup(){
    const status=document.getElementById('backup-status');try{
      status.textContent='מכין גיבוי…';document.getElementById('backup-export').disabled=true;
      const files=await this.fileList();const entries={};const metadata=[];let bytes=0;
      for(let i=0;i<files.length;i++){const f=await this.fileGet(files[i].id);bytes+=f.blob.size;if(bytes>250*1024*1024)throw Error('הגיבוי גדול מדי לייצוא אחד. הורידו קבצים בנפרד.');const path='files/'+i;entries[path]=new Uint8Array(await f.blob.arrayBuffer());const {blob,...meta}=f;metadata.push({...meta,path});status.textContent=`מכין קובץ ${i+1} מתוך ${files.length}…`;}
      entries['manifest.json']=CloudVendor.strToU8(JSON.stringify({format:'yom-tov-backup-v1',state:window.getCloudState(),files:metadata,exportedAt:new Date().toISOString()}));
      this.download(new Blob([CloudVendor.zipSync(entries,{level:0})],{type:'application/zip'}),'yom-tov-backup-'+new Date().toISOString().slice(0,10)+'.zip');status.textContent='הגיבוי מוכן להורדה';
    }catch(e){status.textContent=e.message||'הגיבוי לא הושלם';}finally{document.getElementById('backup-export').disabled=false;}
  },
  async importBackup(){
    const status=document.getElementById('backup-status'),file=document.getElementById('backup-input').files[0];if(!file){status.textContent='בחרו קובץ גיבוי';return;}
    try{
      if(file.size>250*1024*1024)throw Error('הגיבוי גדול מדי');
      let manifest,entries={};
      if(file.name.endsWith('.zip')){let expanded=0;entries=CloudVendor.unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{expanded+=f.originalSize;if(expanded>300*1024*1024)throw Error('הגיבוי גדול מדי');return true;}});manifest=JSON.parse(CloudVendor.strFromU8(entries['manifest.json']));}
      else manifest=JSON.parse(await file.text());
      if(!['yom-tov-backup-v1','yom-tov-state-v1'].includes(manifest.format))throw Error('פורמט הגיבוי אינו נתמך');
      SyncMerge.validateState(manifest.state);
      for(const f of manifest.files||[]){if(!/^[a-zA-Z0-9_@.:-]+$/.test(f.id)||!/^[1-9]$/.test(f.child)||!entries[f.path]||entries[f.path].length>20*1024*1024||typeof f.name!=='string')throw Error('קובץ מצורף לא תקין');}
      this.importDraft={manifest,entries};
      const count=manifest.state.tasks.length+manifest.state.notes.length+manifest.state.childGoals.length;
      status.textContent=`נמצאו ${count} משימות, רישומים ומטרות ו־${(manifest.files||[]).length} קבצים. פריטים בעלי מזהה שכבר קיים יישארו כפי שהם בענן.`;
      const button=document.getElementById('backup-import');button.textContent='אישור והוספת פריטים חסרים';button.onclick=()=>this.commitImport();
    }catch(e){status.textContent=e.message||'לא ניתן לקרוא את הגיבוי';}
  },
  async commitImport(){
    const status=document.getElementById('backup-status'),button=document.getElementById('backup-import');button.disabled=true;
    try{
      if(this.blocked)throw Error('יש לפתור תחילה את השינויים המקבילים');
      const {manifest,entries}=this.importDraft,merged=structuredClone(window.getCloudState());
      for(const key of ['tasks','notes','events','childGoals','parentSessions','children']){const ids=new Set(merged[key].map(x=>x.id));for(const item of manifest.state[key])if(!ids.has(item.id)){merged[key].push(item);ids.add(item.id);}}
      merged.cancelledOccurrences=[...new Set([...(merged.cancelledOccurrences||[]),...(manifest.state.cancelledOccurrences||[])])];
      window.replaceCloudState(merged);this.save(merged);await this.flush();if(this.pending)throw Error('הנתונים ממתינים לשמירה בענן. נסו שוב כשהחיבור תקין.');
      const existing=new Set((await this.fileList()).map(f=>f.id));
      let added=0;for(const f of manifest.files||[]){if(existing.has(f.id))continue;await this.filePut({...f,blob:new Blob([entries[f.path]],{type:f.type})});added++;status.textContent=`נשמרו ${added} קבצים…`;}
      status.textContent='הייבוא הושלם ונשמר בענן';this.importDraft=null;button.hidden=true;render();
    }catch(e){status.textContent=e.message||'הייבוא לא הושלם. אפשר לנסות שוב ללא כפילויות.';button.disabled=false;}
  },
  async logout(){
    await this.flush();if(this.pending||this.fileBusy){toast('יש שינויים או קבצים שעדיין לא נשמרו. המתינו לשמירה לפני יציאה.');return;}
    const {error}=await this.client.auth.signOut({scope:'local'});if(error){toast('היציאה לא הושלמה. נסו שוב.');return;}location.reload();
  }
};

(async function bootstrapCloud(){
  const auth=document.getElementById('auth-screen'),message=document.getElementById('auth-message');
  const fail=text=>{message.textContent=text;};
  if(!window.CLOUD_CONFIG?.url||!window.CloudVendor){fail('חיבור הענן עדיין אינו מוגדר.');return;}
  Cloud.client=CloudVendor.createClient(CLOUD_CONFIG.url,CLOUD_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
  document.getElementById('auth-form').onsubmit=async event=>{
    event.preventDefault();const button=document.getElementById('auth-submit');button.disabled=true;fail('נכנס למרחב העבודה…');
    try{await CloudAccounts.login(document.getElementById('auth-username').value,document.getElementById('auth-password').value);document.getElementById('auth-password').value='';}
    catch(error){fail(error.message||'לא ניתן להתחבר כרגע. בדקו את החיבור ונסו שוב.');}finally{button.disabled=false;}
  };
  async function enter(session){
    if(!session||Cloud.loaded||Cloud.entering)return;Cloud.entering=true;
    try{
      Cloud.user=session.user;
      const {data,error}=await Cloud.client.from('workspaces').select('id,payload,revision,updated_at').limit(1).maybeSingle();
      if(error)throw error;
      if(!data){fail('החשבון מחובר, אבל עדיין אין לו הרשאה למרחב העבודה.');document.getElementById('auth-switch').hidden=false;return;}
      SyncMerge.validateState(data.payload);Cloud.row=data;Cloud.base=structuredClone(data.payload);
      let initial=data.payload;
      try{const cached=JSON.parse(localStorage.getItem(Cloud.key())||'null');if(cached?.pending){SyncMerge.validateState(cached.pending);const merged=SyncMerge.merge(cached.base,cached.pending,data.payload);Cloud.pending=merged.value;Cloud.blocked=merged.conflicts.length>0;initial=merged.value;Cloud.persist();}}catch{fail('לא ניתן לטעון שינויים מקומיים. הגרסה בענן זמינה.');}
      window.initialCloudState=initial;
      // Classic scripts intentionally load only after the authorized state is ready.
      for(const name of ['design','extensions','vendor/docx','treatment-document','treatment','noam-calendar','parent-tracking','child-goals-data','child-goals','app'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=name+'.js';script.onload=resolve;script.onerror=reject;document.body.append(script);});
      Cloud.loaded=true;auth.classList.add('cloud-hidden');document.getElementById('workspace-shell').classList.remove('cloud-hidden');
      Cloud.status(Cloud.blocked?'יש שינויים מקבילים · לחצו לבחירה':'✓ נשמר בענן',Cloud.blocked?'conflict':'saved');
      await Cloud.flush();
      setInterval(()=>Cloud.refresh(),15000);
    }catch{fail('לא ניתן לטעון את הנתונים מהענן. בדקו חיבור ורעננו את הדף.');document.getElementById('auth-switch').hidden=false;}
    finally{Cloud.entering=false;}
  }
  document.getElementById('auth-switch').onclick=async()=>{await Cloud.client.auth.signOut({scope:'local'});location.reload();};
  const {data:{session}}=await Cloud.client.auth.getSession();await enter(session);
  Cloud.client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN')setTimeout(()=>enter(session),0);if(event==='SIGNED_OUT'&&Cloud.loaded)location.reload();});
  window.addEventListener('online',()=>Cloud.refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)Cloud.refresh();});
  window.addEventListener('beforeunload',e=>{if(Cloud.pending||Cloud.fileBusy){e.preventDefault();e.returnValue='';}});
})();

