// Calendar occurrences are projected into the tracker. Only user edits are stored.
let parentFilter='',parentStatus='all',parentPeriod='all';
const parentLabels={planned:'מתוכננת',done:'התקיימה',cancelled:'בוטלה'};
const parentVisibleCounts={};
function parentSessions(){
 const saved=state.parentSessions||[],used=new Set();
 const events=calendarEvents('0001-01-01','9999-12-31').filter(e=>e.kind==='parent'&&e.child);
 const rows=events.map(e=>{
  const record=saved.find(s=>s.eventId===e.id&&s.child===e.child);
  if(record)used.add(record.id);
  return {id:'parent-calendar-'+e.id+'-'+e.child,status:'planned',participants:'',points:[],agreements:'',nextDate:'',followUpDone:false,...record,
   eventId:e.id,child:e.child,date:e.date,time:e.time,end:e.end,topic:record?.topic||e.title,calendarLinked:true};
 });
 for(const record of saved){
  if(used.has(record.id))continue;
  if(!record.eventId){rows.push({...record,points:record.points||[]});continue}
  const event=calendarEventById(record.eventId);
  rows.push({...record,points:record.points||[],calendarDetached:Boolean(event),calendarRemoved:!event,status:record.status==='done'?'done':'cancelled'});
 }
 return rows;
}
function parentSessionById(id){return parentSessions().find(s=>s.id===id)}
function storeParentSession(value){
 const {calendarLinked,calendarDetached,calendarRemoved,...record}=value;
 const existing=state.parentSessions.find(s=>s.id===record.id);
 if(existing)Object.assign(existing,record);else state.parentSessions.push(record);
 save();
}
function setParentStatus(id,status){const s=parentSessionById(id);if(!s)return;storeParentSession({...s,status});render();toast(status==='done'?'ההדרכה סומנה כהתקיימה':'הסטטוס עודכן')}
function completeFollowUp(id,done){const s=parentSessionById(id);if(!s)return;storeParentSession({...s,followUpDone:done});render();toast(done?'המעקב סומן כבוצע':'המעקב חזר לרשימה')}
function parentDate(date){return new Date(date+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric'})}
function parentSort(a,b){
 const aFuture=a.date>=today,bFuture=b.date>=today;
 if(aFuture!==bFuture)return aFuture?-1:1;
 const key=s=>s.date+(s.time||'00:00');return aFuture?key(a).localeCompare(key(b)):key(b).localeCompare(key(a));
}
function parentsPage(){
 const sessions=parentSessions(),filtered=sessions.filter(s=>(!parentFilter||s.child===parentFilter)&&(parentStatus==='all'||s.status===parentStatus)&&(parentPeriod==='all'||(parentPeriod==='past'?s.date<today:s.date>=today)));
 return heading('מעקב הדרכות הורים','כל ההדרכות מהיומן, עם מקום לסיכום ולהמשך עבודה.','<button class="btn" onclick="parentForm()">＋ הדרכה חדשה</button>')+
 `<div class="stats parent-stats">${[[sessions.filter(s=>s.status==='planned').length,'הדרכות מתוכננות'],[sessions.filter(s=>s.status==='done').length,'הדרכות שהתקיימו'],[sessions.filter(s=>s.nextDate&&s.nextDate<=today&&s.status!=='cancelled'&&!s.followUpDone).length,'מעקבים שהגיע זמנם']].map(([n,l])=>`<div class="stat"><div><small>${l}</small><b>${n}</b></div><span class="stat-icon">◎</span></div>`).join('')}</div>
 <div class="panel"><div class="filters"><label>ילד <select aria-label="סינון לפי ילד" onchange="parentFilter=this.value;render()">${childOptions(parentFilter).replace('כללי','כל הילדים')}</select></label><label>תקופה <select aria-label="סינון לפי תקופה" onchange="parentPeriod=this.value;render()">${[['all','כל השנה'],['upcoming','מהיום והלאה'],['past','מפגשים קודמים']].map(([v,l])=>`<option value="${v}" ${v===parentPeriod?'selected':''}>${l}</option>`).join('')}</select></label><div class="tabs">${[['all','הכול'],...Object.entries(parentLabels)].map(([id,l])=>`<button class="tab ${parentStatus===id?'active':''}" onclick="parentStatus='${id}';render()">${l}</button>`).join('')}</div></div>${parentRows(filtered,'parents')}</div>`;
}
function parentRows(sessions,scope='child'){
 if(!sessions.length)return '<div class="empty">אין הדרכות להצגה. הדרכות הורים המשויכות לילד ביומן יופיעו כאן אוטומטית.</div>';
 const sorted=sessions.slice().sort(parentSort),limit=parentVisibleCounts[scope]||8;
 return sorted.slice(0,limit).map(s=>`<article class="note parent-session" data-parent-id="${esc(s.id)}"><div class="panel-title"><div><a class="badge purple" href="#child-${s.child}">${esc(systemChildName(s.child))}</a> <span class="badge ${s.status==='done'?'green':''}">${parentLabels[s.status]}</span> ${s.calendarLinked?'<span class="badge">מהיומן</span>':''}<small class="parent-date">${parentDate(s.date)}${s.time?` · <span dir="ltr">${esc(s.time)}${s.end?'–'+esc(s.end):''}</span>`:''}</small></div></div><h3>${esc(s.topic)}</h3>${s.calendarRemoved?'<p class="hint">השיבוץ בוטל ביומן; התיעוד נשמר.</p>':s.calendarDetached?'<p class="hint">השיבוץ ביומן השתנה; התיעוד נשמר אצל הילד המקורי.</p>':''}${s.participants?`<p class="hint">משתתפים: ${esc(s.participants)}</p>`:''}${s.points?.length?pointsMarkup(s.points):'<p class="hint">טרם נוסף סיכום הדרכה.</p>'}${s.agreements?`<div class="next-step"><b>סיכומים להמשך</b><p>${esc(s.agreements)}</p></div>`:''}<div class="parent-row-actions">${s.status==='planned'?`<button class="btn light" onclick="setParentStatus('${s.id}','done')">✓ סימון כהתקיימה</button>`:''}<button class="text-link" onclick="parentForm('${s.child}','${s.id}')">${s.points?.length?'עריכת הסיכום':'תיעוד סיכום'}</button>${s.calendarLinked?`<button class="text-link" onclick="calendarDetail('${s.eventId}')">המפגש ביומן</button>`:''}</div>${s.nextDate?`<div class="follow-up"><span class="badge ${!s.followUpDone&&s.nextDate<=today?'warm':''}">מעקב: ${fmt(s.nextDate)}</span><label><input type="checkbox" ${s.followUpDone?'checked':''} onchange="completeFollowUp('${s.id}',this.checked)"> המעקב בוצע</label></div>`:''}</article>`).join('')+
 (sorted.length>limit?`<div class="parent-more"><span class="hint">מוצגות ${Math.min(limit,sorted.length)} מתוך ${sorted.length} הדרכות</span><button class="btn secondary" onclick="parentVisibleCounts['${scope}']=${limit+12};render()">הצגת הדרכות נוספות</button></div>`:'');
}
function parentForm(child='',id='',eventId=''){
 const all=parentSessions(),s=all.find(s=>s.id===id)||all.find(s=>eventId&&s.eventId===eventId&&s.child===child),linked=s?.calendarLinked;
 const childField=linked?`<label class="field">ילד — מהיומן<input readonly value="${esc(systemChildName(s.child))}"><input type="hidden" name="child" value="${s.child}"></label>`:`<label class="field">ילד<select name="child" required>${childOptions(s?.child||child).replace('כללי','בחירת ילד')}</select></label>`;
 modal(s?'תיעוד הדרכת הורים':'הדרכת הורים חדשה',`<form id="parent-form"><div class="form-grid">${childField}<label class="field">סטטוס<select name="status">${Object.entries(parentLabels).map(([v,l])=>`<option value="${v}" ${s?.status===v?'selected':''} ${v==='planned'&&(s?.calendarRemoved||s?.calendarDetached)?'disabled':''}>${l}</option>`).join('')}</select></label><label class="field">תאריך ההדרכה<input type="date" name="date" required ${linked?'readonly':''} value="${s?.date||today}"></label><label class="field">שעה<input type="time" name="time" ${linked?'readonly':''} value="${s?.time||''}"></label></div>${linked?'<p class="hint">הילד והמועד מתעדכנים מהיומן. לשינוי שלהם אפשר לערוך את השיבוץ ביומן.</p>':''}<label class="field">נושא ההדרכה<input name="topic" required maxlength="180" value="${esc(s?.topic||'')}" placeholder="למשל: שגרת אחר הצהריים"></label><label class="field">משתתפים — אופציונלי<input name="participants" maxlength="180" value="${esc(s?.participants||'')}"></label><label class="field">סיכום בנקודות — כל נקודה בשורה<textarea name="points" maxlength="5000" placeholder="מה עלה במפגש?">${esc(s?.points?.join('\n')||'')}</textarea></label><label class="field">מה סוכם להמשך?<textarea name="agreements" maxlength="3000">${esc(s?.agreements||'')}</textarea></label><label class="field">תאריך מעקב הבא — אופציונלי<input type="date" name="nextDate" value="${s?.nextDate||''}"></label><p id="parent-error" class="warning" role="alert"></p><div class="actions"><button class="btn" type="submit" name="action" value="done">התקיימה — שמירת סיכום</button><button class="btn secondary" type="submit" name="action" value="save">שמירה</button></div></form>`);
 $('#parent-form').onsubmit=e=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  if(!f.topic.trim()){$('#parent-error').textContent='יש למלא נושא להדרכה.';return}
  if(f.nextDate&&f.nextDate<f.date){$('#parent-error').textContent='תאריך המעקב צריך להיות ביום ההדרכה או אחריו.';return}
  storeParentSession({...s,...f,id:s?.id||uid(),eventId:s?.eventId||'',status:e.submitter?.value==='done'?'done':f.status,topic:f.topic.trim(),points:pointLines(f.points),followUpDone:s?.nextDate===f.nextDate?Boolean(s?.followUpDone):false});
  $('#modal').close();render();toast('הדרכת ההורים נשמרה בכרטיס הילד ובמעקב');
 };
}
function parentFromCalendar(id){const e=calendarEventById(id);if(!e||e.kind!=='parent'||!e.child)return;parentForm(e.child,'',id)}
function parentCalendarStatus(event){const s=state.parentSessions.find(s=>s.eventId===event.id&&s.child===event.child);return s?.status||'planned'}
function eventKindOptions(value){return [['general','פעילות כללית'],['parent','הדרכת הורים'],['treatment','טיפול פרטני'],['guidance','הדרכה / פגישת צוות'],['admin','רישום / זמן מנהלי'],['team','ישב״צ'],['alternative','חלופה']].map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}

