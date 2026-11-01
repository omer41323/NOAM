const allowedOrigins = new Set(['https://noam-workday.vercel.app', 'http://127.0.0.1:4174']);
const invalidLogin = 'שם המשתמש או הסיסמה אינם נכונים.';
export function createHandler({admin, passwordClient}) {
  return async request => {
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
    if(origin && allowedOrigins.has(origin)) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
    const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    if(origin && !allowedOrigins.has(origin)) return reply(403,{error:'הבקשה אינה מורשית.'});
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(request.method!=='POST') return reply(405,{error:'בקשה לא תקינה.'});
    try {
      if(Number(request.headers.get('content-length')||0)>4096) return reply(413,{error:'בקשה גדולה מדי.'});
      const raw=await request.text();
      if(raw.length>4096) return reply(413,{error:'בקשה גדולה מדי.'});
      let body; try {body=JSON.parse(raw);} catch {return reply(400,{error:'בקשה לא תקינה.'});}
      if(!body || typeof body!=='object') return reply(400,{error:'בקשה לא תקינה.'});
      if(body.action==='login') {
        const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
        if(!/^[a-z0-9_]{3,30}$/.test(username)||typeof body.password!=='string'||!body.password||body.password.length>128) return reply(401,{error:invalidLogin});
        const {data:account,error:lookupError}=await admin.from('login_accounts').select('*').eq('username',username).maybeSingle();
        if(lookupError) throw lookupError;
        // Unknown names share a bucket, so anonymous traffic cannot grow this table.
        const {data:allowed,error:rateError}=await admin.rpc('consume_login_attempt',{p_key:account?username:'__unknown__'});
        if(rateError) throw rateError;
        if(!allowed) return reply(429,{error:'היו מספר ניסיונות כניסה. נסו שוב בעוד עשר דקות.'});
        const {data,error}=await passwordClient().auth.signInWithPassword({email:account?.email||'unknown@invalid.example',password:body.password});
        if(error||!account?.auth_user_id||data?.user?.id!==account.auth_user_id||!data.session) return reply(401,{error:invalidLogin});
        return reply(200,{session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
      }
      if(!['profile','provision'].includes(body.action)) return reply(400,{error:'בקשה לא תקינה.'});
      const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if(!token) return reply(401,{error:'יש להתחבר מחדש.'});
      const {data:{user}={},error:authError}=await admin.auth.getUser(token);
      if(authError||!user?.id||!user.email_confirmed_at) return reply(401,{error:'יש להתחבר מחדש.'});
      const {data:actor,error:actorError}=await admin.from('login_accounts').select('*').eq('auth_user_id',user.id).maybeSingle();
      if(actorError) throw actorError;
      if(!actor) return reply(403,{error:'אין הרשאה לניהול החשבון.'});
      if(body.action==='profile') {
        let pending=[];
        if(actor.is_owner){
          const {data,error}=await admin.from('login_accounts').select('username').eq('workspace_id',actor.workspace_id).eq('is_owner',false).is('auth_user_id',null);
          if(error) throw error;pending=data;
        }
        return reply(200,{username:actor.username,pending:pending.map(x=>x.username)});
      }
      if(!actor.is_owner) return reply(403,{error:'רק מנהל המרחב יכול להפעיל חשבון.'});
      if(typeof body.password!=='string'||body.password.length<12||body.password.length>128) return reply(400,{error:'בחרו סיסמה באורך 12–128 תווים.'});
      const {data:target,error:targetError}=await admin.from('login_accounts').select('*').eq('username',body.username).eq('workspace_id',actor.workspace_id).eq('is_owner',false).maybeSingle();
      if(targetError) throw targetError;
      if(!target) return reply(403,{error:'החשבון לא הוגדר מראש במרחב הזה.'});
      if(target.auth_user_id) return reply(409,{error:'החשבון כבר פעיל. אפשר לשנות סיסמה מתוך החשבון שלו.'});
      // Only an authenticated owner may initialize a pre-approved member.
      // Email confirmation stays enabled globally. No public signup or role editing.
      const {data,error}=await admin.auth.admin.createUser({email:target.email,password:body.password,email_confirm:true});
      if(error||!data.user?.id) return reply(409,{error:'לא ניתן להפעיל את החשבון. ייתכן שהוא כבר נוצר; יש לפנות למנהל המערכת.'});
      const {error:saveError}=await admin.from('login_accounts').update({auth_user_id:data.user.id}).eq('username',target.username).is('auth_user_id',null);
      if(saveError) throw saveError;
      return reply(200,{ok:true,username:target.username});
    } catch {
      // Never log bodies, passwords, tokens or raw provider errors.
      return reply(503,{error:'השירות אינו זמין כרגע. נסו שוב בעוד רגע.'});
    }
  };
}
