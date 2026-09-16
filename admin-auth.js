/* PACSA shared Admin authentication + portal access helpers */
const PACSA_ADMIN_LOGIN=new URL('admin-login.html',window.location.href).href;
const PACSA_ADMIN_SESSION_KEY='pacsa_admin_login_verified';
const PACSA_ADMIN_MAX_SESSION_MS=4*60*60*1000;
document.documentElement.style.visibility='hidden';
window.currentAdmin=null;

const adminNorm=value=>String(value??'').trim().toLowerCase();
const adminEsc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const titleCase=value=>{const t=String(value||'');return t.charAt(0).toUpperCase()+t.slice(1)};

function clearAdminStorage(){localStorage.removeItem('admin');sessionStorage.removeItem(PACSA_ADMIN_SESSION_KEY)}
function getAdminSessionMarker(){try{return JSON.parse(sessionStorage.getItem(PACSA_ADMIN_SESSION_KEY)||'null')}catch{return null}}
function hasFreshAdminLogin(userId){const m=getAdminSessionMarker();if(!m||m.userId!==userId||!Number.isFinite(Number(m.verifiedAt)))return false;const age=Date.now()-Number(m.verifiedAt);return age>=0&&age<=PACSA_ADMIN_MAX_SESSION_MS}
async function getFunctionErrorMessage(error){let message=error?.message||'Unknown error';try{const response=error?.context;if(response?.clone){const payload=await response.clone().json();message=payload?.error||payload?.message||message}}catch{}return message}
async function getCurrentAdmin(){const {data,error}=await supabaseClient.rpc('pacsa_get_my_admin');if(error)throw error;return Array.isArray(data)?data[0]:data}

async function loadTempPasswordGuard(){
  if(window.PACSA_TEMP_PASSWORD)return;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='temporary-password-guard.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
}

function scopeAdminNotifications(){
  const dashboard=window.location.pathname.endsWith('admin-dashboard.html')||window.location.pathname.endsWith('/');
  if(!dashboard)document.querySelectorAll('.notification-btn').forEach(button=>button.remove());
}

window.adminLogout=async function(){try{await supabaseClient.auth.signOut()}catch(error){console.error('Admin logout:',error)}finally{clearAdminStorage();window.location.replace(PACSA_ADMIN_LOGIN)}};

window.adminAuthReady=(async function(){
  try{
    const {data:sessionData,error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError)throw sessionError;
    const user=sessionData?.session?.user;
    if(!user){clearAdminStorage();window.location.replace(PACSA_ADMIN_LOGIN);return null}
    if(!hasFreshAdminLogin(user.id)){clearAdminStorage();try{await supabaseClient.auth.signOut()}catch{}window.location.replace(PACSA_ADMIN_LOGIN);return null}

    const admin=await getCurrentAdmin();
    if(!admin){await supabaseClient.auth.signOut();clearAdminStorage();window.location.replace(PACSA_ADMIN_LOGIN);return null}
    if(adminNorm(admin.status||'active')!=='active'){await supabaseClient.auth.signOut();clearAdminStorage();alert('This Admin account is inactive.');window.location.replace(PACSA_ADMIN_LOGIN);return null}

    window.currentAdmin=admin;
    localStorage.setItem('admin',JSON.stringify(admin));
    document.querySelectorAll('.admin-info strong,.admin-name').forEach(el=>el.textContent=admin.fullname||'Administrator');
    scopeAdminNotifications();

    try{
      await loadTempPasswordGuard();
      const allowed=await window.PACSA_TEMP_PASSWORD?.ensure(user,{role:'Admin'});
      if(allowed===false){clearAdminStorage();window.location.replace(PACSA_ADMIN_LOGIN);return null}
    }catch(error){console.warn('Temporary password guard:',error)}

    document.querySelectorAll('#logoutBtn,#sidebarLogoutBtn,.logout-link').forEach(button=>{button.onclick=async event=>{event.preventDefault();if(confirm('Are you sure you want to logout?'))await window.adminLogout()}});
    document.documentElement.style.visibility='visible';
    return admin;
  }catch(error){
    console.error('Admin authorization error:',error);clearAdminStorage();try{await supabaseClient.auth.signOut()}catch{}window.location.replace(PACSA_ADMIN_LOGIN);return null;
  }
})();

supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session){clearAdminStorage();if(!window.location.pathname.endsWith('admin-login.html'))window.location.replace(PACSA_ADMIN_LOGIN)}});

/* Portal access modal used on Students and Teachers management pages. */
function ensurePortalAccessCard(){
  if(document.getElementById('portalAccessModal'))return;
  const style=document.createElement('style');
  style.textContent=`.portal-access-modal{position:fixed;inset:0;background:rgba(15,23,42,.62);display:none;align-items:center;justify-content:center;padding:20px;z-index:99999}.portal-access-modal.show{display:flex}.portal-access-card{width:min(560px,100%);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.28);font-family:inherit}.portal-access-head{background:linear-gradient(135deg,#4C1D95,#7C3AED);color:#fff;padding:24px}.portal-access-head span{display:inline-flex;background:rgba(255,255,255,.16);padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px}.portal-access-head h2{margin:0}.portal-access-body{padding:24px}.portal-access-note{color:#4B5563;line-height:1.55}.portal-access-details{border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;background:#F9FAFB}.portal-access-row{display:grid;grid-template-columns:145px 1fr;gap:12px;padding:14px 16px;border-bottom:1px solid #E5E7EB}.portal-access-row:last-child{border-bottom:0}.portal-access-row span{color:#6B7280;font-size:13px;font-weight:700}.portal-access-row strong,.portal-access-row a{color:#111827;font-size:14px;word-break:break-word}.portal-access-row a{color:#5B21B6;font-weight:700}.portal-access-password{font-family:monospace;background:#FEF3C7;padding:4px 7px;border-radius:7px;color:#92400E!important}.portal-access-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px;flex-wrap:wrap}.portal-access-actions button{border:0;border-radius:11px;padding:11px 16px;font:inherit;font-weight:800;cursor:pointer}.portal-copy-btn{background:#EDE9FE;color:#5B21B6}.portal-close-btn{background:#5B21B6;color:#fff}@media(max-width:560px){.portal-access-row{grid-template-columns:1fr;gap:5px}}`;
  document.head.appendChild(style);
  const modal=document.createElement('div');modal.id='portalAccessModal';modal.className='portal-access-modal';
  modal.innerHTML=`<div class="portal-access-card" role="dialog" aria-modal="true"><div class="portal-access-head"><span id="portalAccessType">Portal Access</span><h2 id="portalAccessTitle">PACSA Portal Access</h2></div><div class="portal-access-body"><p class="portal-access-note" id="portalAccessNote"></p><div class="portal-access-details"><div class="portal-access-row"><span>Name</span><strong id="portalAccessName">--</strong></div><div class="portal-access-row"><span>ID</span><strong id="portalAccessId">--</strong></div><div class="portal-access-row"><span>Email</span><strong id="portalAccessEmail">--</strong></div><div class="portal-access-row" id="portalPasswordRow"><span>Temporary Password</span><strong class="portal-access-password" id="portalAccessPassword">--</strong></div><div class="portal-access-row"><span>Login</span><a id="portalAccessLogin" href="#" target="_blank" rel="noopener">Open login page</a></div></div><div class="portal-access-actions"><button type="button" class="portal-copy-btn" id="copyPortalAccessBtn">Copy Details</button><button type="button" class="portal-close-btn" id="closePortalAccessBtn">OK</button></div></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('closePortalAccessBtn').onclick=()=>modal.classList.remove('show');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('show')};
}

function getTemporaryPasswordFromMessage(message){return String(message||'').match(/TEMPORARY PASSWORD:\s*([^\n]+)/i)?.[1]?.trim()||''}
function showPortalAccessCard(data,context){
  ensurePortalAccessCard();const role=context.role;const roleTitle=titleCase(role);const loginUrl=new URL(role==='student'?'student-login.html':'teacher-login.html',window.location.origin).href;const password=data?.temporary_password||getTemporaryPasswordFromMessage(data?.message);const invited=Boolean(data?.invited)&&!password;const copyText=[`PACSA ${roleTitle} Portal`,'',`${roleTitle} Name: ${context.name||'--'}`,`${roleTitle} ID: ${context.recordId||'--'}`,`Email: ${context.email||'--'}`,password?`Temporary Password: ${password}`:'Password: Set through email invitation link',`Login: ${loginUrl}`].join('\n');
  document.getElementById('portalAccessType').textContent=password?'Temporary Login Created':'Portal Invitation Sent';document.getElementById('portalAccessTitle').textContent=`PACSA ${roleTitle} Portal`;document.getElementById('portalAccessNote').textContent=data?.email_sent?'Login details were emailed successfully. The temporary password expires in 24 hours.':(data?.message||`Portal access created for ${context.email}.`);document.getElementById('portalAccessName').textContent=context.name||'--';document.getElementById('portalAccessId').textContent=context.recordId||'--';document.getElementById('portalAccessEmail').textContent=context.email||'--';document.getElementById('portalAccessPassword').textContent=password||'Set through email link';document.getElementById('portalPasswordRow').style.display=invited?'none':'grid';const login=document.getElementById('portalAccessLogin');login.href=loginUrl;login.textContent=loginUrl;const copyButton=document.getElementById('copyPortalAccessBtn');copyButton.textContent='Copy Details';copyButton.onclick=async()=>{try{await navigator.clipboard.writeText(copyText);copyButton.textContent='Copied'}catch{prompt('Copy these Portal access details:',copyText)}};document.getElementById('portalAccessModal').classList.add('show');
}

async function sendPortalInvitation(role,recordId,email,name,button){
  if(!email||email==='-'){alert(`Add a valid email to this ${role} record before creating Portal access.`);return}
  if(!confirm(`Create ${role} Portal access for ${name||email}?`))return;
  const oldText=button?.textContent||'🔐';if(button){button.disabled=true;button.textContent='…'}
  try{const {data,error}=await supabaseClient.functions.invoke('create-portal-user',{body:{role,record_id:recordId,email}});if(error)throw new Error(await getFunctionErrorMessage(error));if(data?.error)throw new Error(data.error);showPortalAccessCard(data||{},{role,recordId,email,name})}catch(error){console.error('Portal invitation error:',error);alert('Could not create Portal access: '+(error?.message||'Unknown error'))}finally{if(button){button.disabled=false;button.textContent=oldText}}
}

function addPortalButtonsToRows(){
  const path=window.location.pathname;const studentPage=path.endsWith('students.html');const teacherPage=path.endsWith('teachers.html');if(!studentPage&&!teacherPage)return;const body=document.getElementById(studentPage?'studentsTableBody':'teachersTableBody');if(!body)return;
  body.querySelectorAll('tr').forEach(row=>{if(row.querySelector('.portal-access-btn'))return;const cells=row.querySelectorAll('td');if(cells.length<2)return;const name=cells[0]?.querySelector('strong')?.textContent?.trim()||'';const email=cells[0]?.querySelector('.teacher-name-info span')?.textContent?.trim()||'';const recordId=cells[1]?.textContent?.trim()||'';const actions=row.querySelector('.table-action-buttons');if(!actions||!recordId)return;const button=document.createElement('button');button.type='button';button.className='table-btn portal-access-btn';button.title='Create / Send Portal Access';button.textContent='🔐';button.style.background='#EDE9FE';button.style.color='#5B21B6';button.onclick=()=>sendPortalInvitation(studentPage?'student':'teacher',recordId,email,name,button);actions.appendChild(button)});
}

document.addEventListener('DOMContentLoaded',()=>{scopeAdminNotifications();addPortalButtonsToRows();const target=document.getElementById(window.location.pathname.endsWith('students.html')?'studentsTableBody':'teachersTableBody');if(target)new MutationObserver(addPortalButtonsToRows).observe(target,{childList:true,subtree:true})});
