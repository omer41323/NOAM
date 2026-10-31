const NOAM_CHILD_NAMES=['ילד 1','ילד 2','ילד 3','ילד 4','ילד 5','ילד 6','ילד 7','ילד 8','ילד 9'];
const NOAM_WEEK=[
 [1,'08:00','09:00','פ.ע רב״ע / טיפול פרטני ילד 2','','alternative','בשבועות שיש הדרכת הורים ילד 4'],
 [1,'09:00','10:00','הדרכת הורים ילד 4 / טיפול פרטני ילד 2','','alternative','כולל הפסקה ורישום'],
 [1,'10:00','11:00','טיפול פרטני ילד 6','6','treatment','כולל הפסקה ורישום'],
 [1,'11:00','12:00','הדרכה מקצועית','','guidance',''],
 [1,'12:00','13:00','טיפול פרטני ילד 4','4','treatment','כולל הפסקה ורישום'],
 [1,'13:00','13:45','טיפול פרטני ילד 9','9','treatment',''],
 [1,'13:45','14:30','הדרכת הורים ילד 5 / ילד 9','','alternative',''],
 [1,'14:30','15:00','רישום והפסקה','','admin',''],
 [2,'08:00','09:00','הדרכה מנהלת אשכול','','guidance',''],
 [2,'09:00','10:00','הדרכת הורים ילד 1 / ילד 8','','alternative','כולל הפסקה ורישום'],
 [2,'10:00','11:00','טיפול פרטני ילד 3','3','treatment','כולל הפסקה ורישום'],
 [2,'11:00','12:00','פורום עמיתים / טיפול פרטני ילד 5','','alternative','כולל הפסקה ורישום'],
 [2,'12:00','13:00','טיפול פרטני ילד 7','7','treatment','כולל הפסקה ורישום'],
 [2,'13:00','13:45','טיפול פרטני ילד 8','8','treatment',''],
 [2,'13:45','14:30','הדרכת הורים ילד 7 / ילד 6','','alternative',''],
 [2,'14:30','15:00','הפסקה ורישום','','admin',''],
 [3,'08:00','08:45','טיפול פרטני ילד 1','1','treatment',''],
 [3,'08:45','09:30','הדרכת הורים ילד 2 / ילד 3','','alternative',''],
 [3,'09:30','10:00','הפסקה ורישום חצי שעה','','admin',''],
 [3,'10:00','11:00','טיפול פרטני ילד 5','5','treatment',''],
 [3,'11:00','12:00','זמן רכזות','','admin',''],
 [3,'12:00','13:00','פ.ע גננת','','guidance',''],
 [3,'13:00','14:00','פ.ע מנחת התנהגות / פ.ע קלינאית תקשורת','','alternative','כולל הפסקה ורישום'],
 [3,'14:00','15:00','ישב״צ — ישיבת צוות','','team','']
].map(([day,time,end,title,child,kind,details],index)=>({templateId:'noam-'+index,day,time,end,title,child,kind,details}));
NOAM_WEEK.push(
 {templateId:'noam-parent-break-mon',day:1,time:'09:45',end:'10:00',title:'הפסקה ורישום',child:'',kind:'admin',details:'',cycleOnly:1},
 {templateId:'noam-parent-break-tue',day:2,time:'09:45',end:'10:00',title:'הפסקה ורישום',child:'',kind:'admin',details:''}
);
// The supplied annual workbook anchors week A on 5 October 2026.
// Stable template IDs preserve existing single-date edits and cancellations.
const NOAM_YEAR={start:'2026-10-05',end:'2027-08-11',anchor:'2026-10-04'};
const NOAM_CYCLE={
 'noam-0':[['פ.ע רב״ע','','guidance'],['טיפול פרטני ילד 2','2','treatment']],
 'noam-1':[['טיפול פרטני ילד 2','2','treatment'],['הדרכת הורים ילד 4','4','parent']],
 'noam-6':[['הדרכת הורים ילד 5','5','parent'],['הדרכת הורים ילד 9','9','parent']],
 'noam-9':[['הדרכת הורים ילד 1','1','parent'],['הדרכת הורים ילד 8','8','parent']],
 'noam-11':[['פורום עמיתים','','guidance'],['טיפול פרטני ילד 5','5','treatment']],
 'noam-14':[['הדרכת הורים ילד 7','7','parent'],['הדרכת הורים ילד 6','6','parent']],
 'noam-17':[['הדרכת הורים ילד 2','2','parent'],['הדרכת הורים ילד 3','3','parent']],
 'noam-22':[['פ.ע מנחת התנהגות','','guidance'],['פ.ע קלינאית תקשורת','','guidance']]
};
function noamWeekIndex(date){return Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(NOAM_YEAR.anchor+'T00:00:00Z'))/604800000)}
function noamWeekCycle(date){return ((noamWeekIndex(date)%2)+2)%2}
function noamWeekLabel(date){return noamWeekCycle(date)===0?'שבוע א׳':'שבוע ב׳'}
function noamSlot(template,date){
 const cycle=noamWeekCycle(date),choice=NOAM_CYCLE[template.templateId]?.[cycle];
 const slot={...template,...(choice?{title:choice[0],child:choice[1],kind:choice[2]}:{}),cycle};
 if(slot.child)slot.title=(slot.kind==='parent'?'הדרכת הורים ':'טיפול פרטני ')+systemChildName(slot.child);
 if(template.templateId==='noam-0')slot.details=cycle===1?'בשבוע של הדרכת הורי ילד 4':'';
 // Guidance times come from the workbook; adjacent slots make room for them.
 if(slot.kind==='parent'){
  slot.details='';
  if(slot.time==='09:00')slot.end='09:45';
  if(slot.time==='13:45'){slot.time='13:30';slot.end='14:15'}
  if(slot.day===3){slot.time='08:30';slot.end='09:15'}
 }
 if(['noam-5','noam-13'].includes(slot.templateId))slot.end='13:30';
 if(['noam-7','noam-15'].includes(slot.templateId))slot.time='14:15';
 if(slot.templateId==='noam-16')slot.end='08:30';
 if(slot.templateId==='noam-18'){slot.time='09:15';slot.title='הפסקה ורישום'}
 return slot;
}
function initializeNoamSchedule(){
 if(state.noamScheduleVersion!==1){
  state.children=NOAM_CHILD_NAMES.map((name,i)=>({id:String(i+1),name}));
  const sampleTitles={s1:'פתיחת יום ותכנון',s2:'פעילות קבוצתית',s3:'מפגש אישי',s4:'סיכום יום',s5:'מפגש מעקב'};
  const samples=state.events.filter(e=>sampleTitles[e.id]===e.title);state.archivedDemoEvents=[...(state.archivedDemoEvents||[]),...samples];state.events=state.events.filter(e=>!samples.includes(e));
  state.cancelledOccurrences??=[];state.noamScheduleVersion=1;
  
 }
 state.cancelledOccurrences??=[];
 if(state.noamChildNameVersion!==2){
  const child=state.children?.find(c=>String(c.id)==='1');if(child)child.name=NOAM_CHILD_NAMES[0];
  state.noamChildNameVersion=2;
  
 }
}
function calendarEvents(from=shift(today,-366),to=shift(today,366)){
 const result=state.events.filter(e=>e.date>=from&&e.date<=to),overrides=new Set(result.map(e=>e.id)),cancelled=new Set(state.cancelledOccurrences||[]);
 const first=from>NOAM_YEAR.start?from:NOAM_YEAR.start,last=to<NOAM_YEAR.end?to:NOAM_YEAR.end;
 for(let date=first;date<=last;date=shift(date,1)){const day=new Date(date+'T12:00:00').getDay();for(const t of NOAM_WEEK.filter(t=>t.day===day&&(t.cycleOnly===undefined||t.cycleOnly===noamWeekCycle(date)))){const id=t.templateId+'@'+date;if(!overrides.has(id)&&!cancelled.has(id))result.push({...noamSlot(t,date),id,date,recurring:true})}}
 return result.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function calendarEventById(id){const own=state.events.find(e=>e.id===id);if(own)return own;const date=id.split('@')[1];if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return undefined;return calendarEvents(date,date).find(e=>e.id===id)}
let calendarFullWeek=false,calendarMobileDay=1;
function calendarGoTo(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;week=shift(date,-new Date(date+'T12:00:00').getDay());render()}
function calendarChooseCycle(cycle){week=shift(week,(cycle-noamWeekCycle(week))*7);render()}
function calendarGoToMonth(date){if(!date)return;const first=date<NOAM_YEAR.start?NOAM_YEAR.start:date;const day=new Date(first+'T12:00:00').getDay();calendarGoTo(shift(first,(8-day)%7))}
function annualCalendarControls(){
 const active=week<=NOAM_YEAR.end&&shift(week,6)>=NOAM_YEAR.start;
 const months=Array.from({length:11},(_,i)=>{const d=new Date(2026,9+i,1,12);return {value:dateKey(d),label:d.toLocaleDateString('he-IL',{month:'long',year:'numeric'})}});
 return `<div class="annual-calendar-bar"><div><span class="eyebrow">התכנון השנתי · 2026–2027</span><p>5 באוקטובר 2026 — 11 באוגוסט 2027</p></div><label>מעבר לחודש<select aria-label="מעבר לחודש" onchange="calendarGoToMonth(this.value)"><option value="">בחירת חודש</option>${months.map(m=>`<option value="${m.value}" ${shift(week,1).slice(0,7)===m.value.slice(0,7)?'selected':''}>${m.label}</option>`).join('')}</select></label><label>מעבר לתאריך<input type="date" aria-label="מעבר לתאריך" value="${week}" onchange="calendarGoTo(this.value)"></label></div><div class="cycle-switch" role="group" aria-label="בחירת שבוע במחזור"><button class="tab ${active&&noamWeekCycle(week)===0?'active':''}" aria-pressed="${active&&noamWeekCycle(week)===0}" onclick="calendarChooseCycle(0)">שבוע א׳</button><button class="tab ${active&&noamWeekCycle(week)===1?'active':''}" aria-pressed="${active&&noamWeekCycle(week)===1}" onclick="calendarChooseCycle(1)">שבוע ב׳</button><span class="hint">${active?'החלופות מתחלפות אוטומטית בכל שבוע':'מחוץ לטווח התכנון השנתי — מוצגים שיבוצים אישיים בלבד'}</span></div>`;
}
function calendarPage(){const days=calendarFullWeek?[0,1,2,3,4,5,6]:[1,2,3],events=calendarEvents(week,shift(week,6));if(!days.includes(calendarMobileDay))calendarMobileDay=days[0];
 const minutes=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);
 const start=Math.min(480,...events.map(e=>Math.floor(minutes(e.time)/15)*15)),end=Math.max(900,...events.map(e=>Math.ceil(minutes(e.end)/15)*15));
 return heading('היומן של נועם','שבוע א׳ ושבוע ב׳ · שיבוצי נועם וישיבת צוות','<button class="btn" onclick="eventForm()">＋ שיבוץ חדש</button>')+annualCalendarControls()+`<div class="week-nav"><button class="btn secondary" aria-label="שבוע קודם" onclick="week=shift(week,-7);render()">→</button><b>${fmt(week)} – ${fmt(shift(week,6))}</b><button class="btn secondary" aria-label="שבוע הבא" onclick="week=shift(week,7);render()">←</button><button class="text-link" onclick="week=shift(today,-new Date(today+'T12:00:00').getDay());render()">השבוע</button><button class="text-link" onclick="calendarFullWeek=!calendarFullWeek;render()">${calendarFullWeek?'ימי העבודה בלבד':'כל השבוע'}</button></div><div class="calendar-legend"><span><i class="legend-noam"></i>נועם</span><span><i class="legend-team"></i>ישב״צ</span><span class="hint">לחיצה על שיבוץ מאפשרת שינוי לאותו יום או תיעוד טיפול.</span></div><div class="calendar-mobile-days">${days.map(day=>`<button class="tab ${day===calendarMobileDay?'active':''}" onclick="calendarMobileDay=${day};render()">${new Date(shift(week,day)+'T12:00:00').toLocaleDateString('he-IL',{weekday:'short'})} ${new Date(shift(week,day)+'T12:00:00').getDate()}</button>`).join('')}</div><div class="panel noam-calendar"><div class="noam-grid" style="--day-count:${days.length};--calendar-height:${(end-start)*1.8}px"><div class="hours-column"><div class="noam-day-head">שעה</div><div class="time-track">${Array.from({length:(end-start)/30+1},(_,i)=>{const m=start+i*30;return `<span style="top:${(m-start)*1.8}px">${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}</span>`}).join('')}</div></div>${days.map(day=>{const date=shift(week,day);return `<section class="noam-day ${calendarMobileDay===day?'mobile-selected':''}"><div class="noam-day-head ${date===today?'is-today':''}"><b>${new Date(date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long'})}</b><small>${fmt(date)}</small></div><div class="day-track">${events.filter(e=>e.date===date).map(e=>`<button class="noam-slot ${minutes(e.end)-minutes(e.time)<=15?'compact-slot':''} ${e.kind==='team'?'team-slot':''} ${!e.recurring&&!e.templateId?'custom-slot':''}" style="top:${(minutes(e.time)-start)*1.8}px;height:${Math.max(26,(minutes(e.end)-minutes(e.time))*1.8-3)}px" onclick="calendarDetail('${e.id}')"><span class="slot-time" dir="ltr">${e.time}–${e.end}</span><b>${esc(e.title)}</b>${e.details?`<small>${esc(e.details)}</small>`:''}${e.kind==='parent'&&parentCalendarStatus(e)!=='planned'?`<span class="slot-alternative">${parentLabels[parentCalendarStatus(e)]}</span>`:''}${e.kind==='alternative'?'<span class="slot-alternative">חלופה לבחירה</span>':''}</button>`).join('')}</div></section>`}).join('')}</div></div><p class="hint">המערכת מתחלפת מדי שבוע לפי המחזור השנתי שבקובץ. שיבוצים קבועים מופיעים בשני השבועות. טווחים מסומנים כוללים הפסקה ורישום.</p>`;
}
function calendarDetail(id){const e=calendarEventById(id);if(!e)return;modal(esc(e.title),`<div class="task-meta">${e.kind==='parent'?`<span class="badge green">${parentLabels[parentCalendarStatus(e)]}</span>`:''}<span class="badge">${fmt(e.date)}</span>${e.templateId?`<span class="badge purple">${noamWeekLabel(e.date)}</span>`:''}<span class="badge" dir="ltr">${e.time}–${e.end}</span>${e.child?`<span class="badge purple">${esc(systemChildName(e.child))}</span>`:''}</div>${e.details?`<p>${esc(e.details)}</p>`:''}${e.kind==='alternative'?'<p class="hint">זהו זמן משותף לכמה חלופות בתמונה. בעריכת השיבוץ אפשר לבחור את הפעילות ואת הילד למפגש הזה.</p>':''}<p class="hint">${e.templateId?'שינוי או ביטול כאן חלים על התאריך הזה בלבד. מחזור שבוע א׳ ושבוע ב׳ נשאר כפי שהוא.':'שיבוץ אישי ביומן.'}</p><div class="actions"><button class="btn" onclick="eventForm('${e.id}')">עריכת השיבוץ</button>${e.child&&e.kind==='parent'?`<button class="btn secondary" onclick="parentFromCalendar('${e.id}')">תיעוד הדרכת הורים</button>`:e.child?`<button class="btn secondary" onclick="meetingForm('${e.child}','','${e.id}')">תיעוד טיפול ו־Word</button>`:''}</div>`)}
function childCalendarEvent(id,child){const e=calendarEventById(id);return e?.child===child?e:undefined}

