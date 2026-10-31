/* Shared browser/QA builder. Real OOXML DOCX; content never leaves this device. */
function buildTreatmentDocument(data,lib){
  const {Document,Paragraph,TextRun,AlignmentType}=lib;
  const run=(text,bold=false)=>new TextRun({text,font:'Arial',size:24,sizeComplexScript:24,rightToLeft:true,bold,boldComplexScript:bold,color:'000000'});
  const p=(text,options={})=>new Paragraph({bidirectional:true,alignment:AlignmentType.START,spacing:{after:140,line:320},children:[run(text,options.bold)],...options});
  const heading=text=>p(text,{alignment:AlignmentType.CENTER,keepNext:true,spacing:{before:280,after:120},bold:true});
  const body=text=>String(text).replace(/\r\n?/g,'\n').split('\n').map(line=>p(line||' ',{widowControl:true}));
  const date=data.meetingDate.split('-').reverse().join('.');
  return new Document({creator:'נועם זינגר',title:'תיעוד טיפול פרטני',description:'תיעוד טיפול מתוך יומן המפגשים',styles:{default:{document:{run:{font:'Arial',size:24,sizeComplexScript:24,color:'000000'},paragraph:{bidirectional:true}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:[
    p('תיעוד טיפול פרטני',{style:'Title',alignment:AlignmentType.CENTER,keepNext:true,spacing:{after:320},children:[new TextRun({text:'תיעוד טיפול פרטני',font:'Arial',size:32,sizeComplexScript:32,bold:true,boldComplexScript:true,rightToLeft:true,color:'000000'})]}),
    p('שם הילד: '+data.childName,{keepNext:true,bold:true}),
    new Paragraph({bidirectional:true,alignment:AlignmentType.START,keepNext:true,spacing:{after:140},children:[run('תאריך: '),new TextRun({text:date,font:'Arial',size:24,rightToLeft:false}),run('    שעה: '),new TextRun({text:data.meetingTime+(data.meetingEnd?'–'+data.meetingEnd:''),font:'Arial',size:24,rightToLeft:false})]}),
    p('המטפל ומקצועו: נועם זינגר עו"ס',{keepNext:true}),
    heading('סביבת הטיפול'),p(data.environment,{alignment:AlignmentType.CENTER}),
    heading('אמצעי טיפול + חיבור למטרות'),...body(data.methods),
    heading('מהלך וסיכום הטיפול'),...body(data.summary)
  ]}]});
}
if(typeof module!=='undefined')module.exports={buildTreatmentDocument};

