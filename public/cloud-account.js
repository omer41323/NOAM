/* Passwords are sent over HTTPS to Supabase and never stored by this application. */
window.CloudAccounts={
  async request(body,authenticated=false){
    const headers={'Content-Type':'application/json',apikey:CLOUD_CONFIG.key};
    if(authenticated){
      const {data:{session}}=await Cloud.client.auth.getSession();
      if(!session)throw Error('יש להתחבר מחדש.');
      headers.Authorization='Bearer '+session.access_token;
    }
    const response=await fetch(CLOUD_CONFIG.url+'/functions/v1/account-access',{method:'POST',headers,body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'לא ניתן להתחבר כרגע.');
    return data;
  },
  async login(username,password){
    const {session}=await this.request({action:'login',username,password});
    const {error}=await Cloud.client.auth.setSession(session);if(error)throw Error('הכניסה לא הושלמה. נסו שוב.');
  },
  passwordFields(prefix){return `<label class="field">סיסמה חדשה<input id="${prefix}-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required dir="ltr"><small>לפחות 12 תווים; אפשר להשתמש במשפט שקל לזכור.</small></label><label class="field">שוב אותה סיסמה<input id="${prefix}-confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required dir="ltr"></label>`;},
  async open(){
    modal('החשבון שלי','<p role="status">טוען את הגדרות החשבון…</p>');
    let profile;
    try{profile=await this.request({action:'profile'},true);}
    catch(e){document.querySelector('#modal-content p').textContent=e.message;return;}
    this.profile=profile;
    // Names come from the restricted account table; still escape before rendering.
    const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    modal('החשבון שלי',`<div class="account-settings"><p>שם המשתמש שלך: <b dir="ltr">${safe(profile.username)}</b></p><p class="hint">הגדירו כאן סיסמה כדי להיכנס מכל מכשיר.</p><form id="own-password-form">${this.passwordFields('own')}<button class="btn" type="submit">שמירת הסיסמה שלי</button><p id="own-password-message" role="status"></p></form>${profile.pending.length?`<section class="account-setup"><h3>הפעלת החשבון של נועם</h3><p class="hint">אחרי שמירת הסיסמה אפשר להיכנס עם שם המשתמש הזה מכל מכשיר.</p><form id="member-password-form"><label class="field">שם משתמש<select id="member-username">${profile.pending.map(name=>`<option value="${safe(name)}">${safe(name)}</option>`).join('')}</select></label>${this.passwordFields('member')}<button class="btn" type="submit">הפעלת החשבון</button><p id="member-password-message" role="status"></p></form></section>`:''}<p class="hint">אם שכחתם סיסמה, פנו למנהל המערכת. אין צורך בקישור למייל.</p></div>`);
    document.getElementById('own-password-form').onsubmit=e=>{e.preventDefault();this.savePassword('own');};
    const memberForm=document.getElementById('member-password-form');
    if(memberForm)memberForm.onsubmit=e=>{e.preventDefault();this.savePassword('member');};
  },
  async savePassword(kind){
    const form=document.getElementById(kind==='own'?'own-password-form':'member-password-form');
    const status=document.getElementById(kind+'-password-message');
    const password=document.getElementById(kind+'-password').value;
    if(password!==document.getElementById(kind+'-confirm').value){status.textContent='הסיסמאות אינן זהות.';return;}
    if(password.length<12||password.length>128){status.textContent='בחרו סיסמה באורך 12–128 תווים.';return;}
    const button=form.querySelector('button');button.disabled=true;Cloud.fileBusy++;status.textContent='שומר…';
    try{
      if(kind==='own'){
        const {error}=await Cloud.client.auth.updateUser({password});
        if(error)throw Error(error.code==='same_password'?'זו כבר הסיסמה הנוכחית.':error.code==='weak_password'?'בחרו סיסמה חזקה יותר.':'הסיסמה לא נשמרה. נסו שוב או התחברו מחדש.');
        status.textContent='הסיסמה נשמרה. שם המשתמש שלך: '+this.profile.username;
      }else{
        const username=document.getElementById('member-username').value;
        await this.request({action:'provision',username,password},true);
        status.textContent='החשבון '+username+' פעיל. אפשר להיכנס עם הסיסמה שהגדרת.';
        button.hidden=true;
      }
      form.querySelectorAll('input[type=password]').forEach(input=>{input.value='';});
    }catch(e){status.textContent=e.message||'השמירה לא הושלמה.';}
    finally{button.disabled=false;Cloud.fileBusy--;}
  }
};
