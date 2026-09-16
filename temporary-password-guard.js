/* PACSA temporary-password guard.
   Blocks portal use until a temporary password is changed. */
(function(){
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const validate=password=>{
    const value=String(password??'');
    if(value.length<8)return 'Password must contain at least 8 characters.';
    if(!/[A-Z]/.test(value))return 'Password must include at least one uppercase letter.';
    if(!/[a-z]/.test(value))return 'Password must include at least one lowercase letter.';
    if(!/[0-9]/.test(value))return 'Password must include at least one number.';
    if(!/[^A-Za-z0-9]/.test(value))return 'Password must include at least one special character.';
    return '';
  };

  function ensureStyles(){
    if(document.getElementById('pacsaTempPasswordStyles'))return;
    const style=document.createElement('style');
    style.id='pacsaTempPasswordStyles';
    style.textContent=`
      .pacsa-temp-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit}
      .pacsa-temp-card{width:min(500px,100%);background:#fff;border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.3);overflow:hidden}
      .pacsa-temp-head{background:linear-gradient(135deg,#4C1D95,#7C3AED);color:#fff;padding:24px}.pacsa-temp-head h2{margin:0 0 7px}.pacsa-temp-head p{margin:0;opacity:.9;line-height:1.5;font-size:14px}
      .pacsa-temp-body{padding:24px}.pacsa-temp-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:11px;padding:12px;margin-bottom:16px;font-size:13px;line-height:1.5}
      .pacsa-temp-field{margin-bottom:14px}.pacsa-temp-field label{display:block;font-weight:700;font-size:13px;margin-bottom:7px}.pacsa-temp-field input{width:100%;padding:13px;border:1px solid #d1d5db;border-radius:10px;font:inherit}
      .pacsa-temp-msg{display:none;padding:11px 12px;border-radius:10px;margin-bottom:14px;font-size:13px}.pacsa-temp-msg.show{display:block}.pacsa-temp-msg.error{background:#fee2e2;color:#b91c1c}.pacsa-temp-msg.success{background:#dcfce7;color:#166534}
      .pacsa-temp-actions{display:flex;gap:10px;justify-content:flex-end}.pacsa-temp-actions button{border:0;border-radius:10px;padding:11px 15px;font:inherit;font-weight:800;cursor:pointer}.pacsa-temp-save{background:#5B21B6;color:#fff}.pacsa-temp-save:disabled{opacity:.6}.pacsa-temp-signout{background:#f3f4f6;color:#374151}
      @media(max-width:520px){.pacsa-temp-body,.pacsa-temp-head{padding:19px}.pacsa-temp-actions{flex-direction:column-reverse}.pacsa-temp-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  let activePromise=null;
  async function ensure(user,options={}){
    if(!user?.user_metadata?.temporary_password)return true;
    if(activePromise)return activePromise;
    const expiresAt=user.user_metadata?.temporary_password_expires_at;
    if(expiresAt){
      const expiry=new Date(expiresAt).getTime();
      if(Number.isFinite(expiry)&&Date.now()>expiry){
        alert('This temporary password has expired. Ask the Super Admin/Admin to create a new temporary password.');
        try{await supabaseClient.auth.signOut();}catch{}
        return false;
      }
    }

    ensureStyles();
    activePromise=new Promise(resolve=>{
      const overlay=document.createElement('div');overlay.className='pacsa-temp-overlay';
      const role=esc(options.role||user.user_metadata?.role||'PACSA');
      overlay.innerHTML=`<div class="pacsa-temp-card" role="dialog" aria-modal="true"><div class="pacsa-temp-head"><h2>Create Your Own Password</h2><p>You are signed in with a temporary ${role} password. Change it before continuing.</p></div><div class="pacsa-temp-body"><div class="pacsa-temp-note">Temporary passwords are for first access only. Your new password must be at least 8 characters and include uppercase, lowercase, a number and a special character.</div><div id="pacsaTempMsg" class="pacsa-temp-msg"></div><div class="pacsa-temp-field"><label for="pacsaTempNew">New Password</label><input id="pacsaTempNew" type="password" autocomplete="new-password"></div><div class="pacsa-temp-field"><label for="pacsaTempConfirm">Confirm Password</label><input id="pacsaTempConfirm" type="password" autocomplete="new-password"></div><div class="pacsa-temp-actions"><button type="button" class="pacsa-temp-signout" id="pacsaTempSignout">Sign Out</button><button type="button" class="pacsa-temp-save" id="pacsaTempSave">Change Password</button></div></div></div>`;
      document.body.appendChild(overlay);
      const msg=overlay.querySelector('#pacsaTempMsg');const show=(text,type='error')=>{msg.textContent=text;msg.className=`pacsa-temp-msg show ${type}`;};
      overlay.querySelector('#pacsaTempSignout').onclick=async()=>{try{await supabaseClient.auth.signOut();}catch{}overlay.remove();activePromise=null;resolve(false)};
      overlay.querySelector('#pacsaTempSave').onclick=async event=>{const button=event.currentTarget;const password=overlay.querySelector('#pacsaTempNew').value;const confirmPassword=overlay.querySelector('#pacsaTempConfirm').value;const problem=validate(password);if(problem)return show(problem);if(password!==confirmPassword)return show('Passwords do not match.');button.disabled=true;button.textContent='Updating...';try{const {error}=await supabaseClient.auth.updateUser({password,data:{temporary_password:false,temporary_password_expires_at:null,password_changed_at:new Date().toISOString()}});if(error)throw error;show('Password changed successfully.','success');setTimeout(()=>{overlay.remove();activePromise=null;resolve(true)},650)}catch(error){show(error?.message||'Could not change password.');button.disabled=false;button.textContent='Change Password'}};
    });
    return activePromise;
  }

  async function autoCheck(){
    try{
      if(typeof supabaseClient==='undefined')return;
      const {data}=await supabaseClient.auth.getSession();const user=data?.session?.user;if(user?.user_metadata?.temporary_password)await ensure(user,{role:user.user_metadata?.role||'PACSA'});
    }catch(error){console.warn('Temporary password check:',error)}
  }

  window.PACSA_TEMP_PASSWORD={ensure,validate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(autoCheck,150));else setTimeout(autoCheck,150);
  if(typeof supabaseClient!=='undefined')supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user?.user_metadata?.temporary_password)setTimeout(()=>ensure(session.user,{role:session.user.user_metadata?.role||'PACSA'}),50)});
})();
