const A$ = id => document.getElementById(id);
const aNorm = v => String(v ?? '').trim().toLowerCase();
const aEsc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
let adminRole = '';
let teachers = [];
let currentPeriod = null;

function showBox(id, text, type='success') {
  const box = A$(id); if (!box) return;
  box.textContent = text; box.className = `status-message show ${type}`;
}
function clearBox(id){const box=A$(id);if(!box)return;box.textContent='';box.className='status-message';}
function formatTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():'--';}

async function invokeAdminFunction(body){
  const {data,error}=await supabaseClient.functions.invoke('create-admin-user',{body});
  if(error){
    let message=error.message||'Could not complete the administrator action.';
    try{const response=error.context;if(response?.clone){const payload=await response.clone().json();message=payload?.error||payload?.message||message;}}catch{}
    throw new Error(message);
  }
  if(!data?.ok) throw new Error(data?.error||'Could not complete the administrator action.');
  return data;
}

async function loadRole() {
  const { data, error } = await supabaseClient.rpc('pacsa_get_my_admin_role');
  if (error) throw error;
  adminRole = aNorm(data);
  A$('myRoleBadge').textContent = adminRole === 'super_admin' ? 'Super Admin' : 'Admin';
  if (adminRole !== 'super_admin') {
    document.querySelectorAll('#createAdminBtn,#assignPrincipalBtn,#removePrincipalBtn,#saveAssessmentBtn,#refreshAdminsBtn,#refreshAuditBtn').forEach(b => b.disabled = true);
    throw new Error('Only the Super Admin can use Administration Control.');
  }
}

async function loadAdmins() {
  const { data, error } = await supabaseClient.from('admins').select('id,fullname,email,role,status,auth_user_id').order('id');
  if (error) throw error;
  const rows=data||[];
  A$('adminsTableBody').innerHTML = rows.length ? rows.map(a => {
    const protectedAdmin=aNorm(a.role)==='super_admin';
    const inactive=aNorm(a.status)==='inactive';
    const actions=protectedAdmin
      ? '<span class="protected-label">Protected</span>'
      : `<div class="admin-actions">
          <button class="mini-btn ${inactive?'ok':'warn'}" type="button" data-status-admin="${aEsc(a.id)}" data-next-status="${inactive?'active':'inactive'}">${inactive?'Activate':'Deactivate'}</button>
          <button class="mini-btn danger" type="button" data-delete-admin="${aEsc(a.id)}" data-admin-name="${aEsc(a.fullname||a.email||'Administrator')}">Delete</button>
        </div>`;
    return `<tr><td><strong>${aEsc(a.fullname||'Administrator')}</strong></td><td>${aEsc(a.email||'--')}</td><td>${protectedAdmin?'Super Admin':'Admin'}</td><td>${aEsc(a.status||'active')}</td><td>${actions}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="empty-inline">No administrators found.</td></tr>';

  document.querySelectorAll('[data-delete-admin]').forEach(button=>button.addEventListener('click',()=>deleteAdmin(button.dataset.deleteAdmin,button.dataset.adminName)));
  document.querySelectorAll('[data-status-admin]').forEach(button=>button.addEventListener('click',()=>setAdminStatus(button.dataset.statusAdmin,button.dataset.nextStatus)));
}

async function deleteAdmin(adminId,name){
  const confirmed=confirm(`Delete ${name}? This removes the Admin login and Admin record. This cannot be undone.`);
  if(!confirmed)return;
  clearBox('adminListMessage');
  try{
    const data=await invokeAdminFunction({action:'delete',admin_id:adminId});
    showBox('adminListMessage',data.message||'Administrator deleted successfully.','success');
    await Promise.all([loadAdmins(),loadAuditLog()]);
  }catch(e){showBox('adminListMessage',e?.message||'Could not delete administrator.','error');}
}

async function setAdminStatus(adminId,status){
  clearBox('adminListMessage');
  try{
    const data=await invokeAdminFunction({action:'set_status',admin_id:adminId,status});
    showBox('adminListMessage',data.message||'Administrator status updated.','success');
    await Promise.all([loadAdmins(),loadAuditLog()]);
  }catch(e){showBox('adminListMessage',e?.message||'Could not update administrator status.','error');}
}

async function loadTeachers() {
  const { data, error } = await supabaseClient.from('Teachers').select('teacher_id,first_name,last_name,email,role').order('first_name');
  if (error) throw error;
  teachers = data || [];
  A$('principalTeacher').innerHTML = '<option value="">Select teacher</option>' + teachers.map(t => {
    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.teacher_id;
    const label = aNorm(t.role) === 'principal' ? `${name} — Principal` : name;
    return `<option value="${aEsc(t.teacher_id)}">${aEsc(label)}</option>`;
  }).join('');
}

async function loadAssessment() {
  const { data: period, error } = await supabaseClient.from('sessions_terms').select('session,term').eq('is_current', true).limit(1).maybeSingle();
  if (error) throw error;
  currentPeriod = period;
  if (!period) {
    A$('academicPeriod').value = 'No current session/term configured';
    A$('saveAssessmentBtn').disabled = true;
    return;
  }
  A$('academicPeriod').value = `${period.session} — ${period.term}`;
  const { data } = await supabaseClient.from('assessment_periods').select('*').eq('session', period.session).eq('term', period.term).maybeSingle();
  if (data?.current_stage) A$('assessmentStage').value = data.current_stage;
}

async function loadAuditLog(){
  const body=A$('auditTableBody');if(!body)return;
  const {data,error}=await supabaseClient.from('audit_logs').select('id,actor_role,action,entity_type,entity_id,created_at').order('created_at',{ascending:false}).limit(30);
  if(error){body.innerHTML=`<tr><td colspan="5" class="empty-inline">${aEsc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).length?(data||[]).map(row=>`<tr><td>${aEsc(formatTime(row.created_at))}</td><td>${aEsc(row.actor_role||'system')}</td><td>${aEsc(String(row.action||'').replaceAll('_',' '))}</td><td>${aEsc(row.entity_type||'--')}</td><td>${aEsc(row.entity_id||'--')}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-inline">No security activity recorded yet.</td></tr>';
}

async function createAdmin() {
  const fullname = A$('adminFullname').value.trim();
  const email = A$('adminEmail').value.trim().toLowerCase();
  clearBox('adminMessage');
  A$('adminCredentials').className='credentials-box';
  A$('adminCredentials').textContent='';
  if (!fullname || !email) return showBox('adminMessage','Enter the administrator name and email.','error');
  const button = A$('createAdminBtn'); button.disabled = true; button.textContent = 'Creating...';
  try {
    const data = await invokeAdminFunction({action:'create',fullname,email});
    showBox('adminMessage', data?.email_sent ? 'Administrator created. Login details were emailed.' : 'Administrator created. Email could not be sent, so copy the temporary password below.');
    A$('adminCredentials').classList.add('show');
    A$('adminCredentials').textContent = `Admin: ${fullname}\nEmail: ${email}\nTemporary Password: ${data?.temporary_password || '--'}\nExpires: ${data?.temporary_password_expires_at || '--'}\nLogin: ${location.origin}/admin-login.html`;
    A$('adminFullname').value=''; A$('adminEmail').value='';
    await Promise.all([loadAdmins(),loadAuditLog()]);
  } catch(e) {
    A$('adminCredentials').className='credentials-box';
    A$('adminCredentials').textContent='';
    showBox('adminMessage', e?.message || 'Could not create administrator.','error');
  }
  finally { button.disabled=false; button.textContent='Create Admin'; }
}

async function setPrincipal(makePrincipal) {
  const teacherId = A$('principalTeacher').value;
  clearBox('principalMessage');
  if (!teacherId) return showBox('principalMessage','Select a teacher first.','error');
  try {
    const { data, error } = await supabaseClient.rpc('pacsa_superadmin_set_teacher_role', {p_teacher_id: teacherId,p_role: makePrincipal ? 'principal' : 'teacher'});
    if (error) throw error;
    if (!data) throw new Error('Teacher role was not changed.');
    showBox('principalMessage', makePrincipal ? 'Principal role assigned successfully.' : 'Principal role removed. The account is now a normal teacher.');
    await Promise.all([loadTeachers(),loadAuditLog()]); A$('principalTeacher').value = teacherId;
  } catch(e) { showBox('principalMessage', e?.message || 'Could not update the role.','error'); }
}

async function saveAssessment() {
  clearBox('assessmentMessage');
  if (!currentPeriod) return showBox('assessmentMessage','Set the current session and term first.','error');
  const stage = A$('assessmentStage').value;
  const { data, error } = await supabaseClient.rpc('pacsa_superadmin_set_assessment_stage', {p_session: currentPeriod.session,p_term: currentPeriod.term,p_stage: stage});
  if (error || !data) return showBox('assessmentMessage', error?.message || 'Could not save assessment stage.','error');
  showBox('assessmentMessage', stage === 'ca' ? 'Continuous Assessment entry is now open.' : stage === 'exam' ? 'Examination entry is now open. Existing C.A totals will carry forward automatically.' : 'Result entry is now closed.');
  await loadAuditLog();
}

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await window.adminAuthReady; if (!admin) return;
  A$('menuBtn')?.addEventListener('click',()=>A$('sidebar')?.classList.toggle('active'));
  A$('createAdminBtn')?.addEventListener('click',createAdmin);
  A$('assignPrincipalBtn')?.addEventListener('click',()=>setPrincipal(true));
  A$('removePrincipalBtn')?.addEventListener('click',()=>setPrincipal(false));
  A$('saveAssessmentBtn')?.addEventListener('click',saveAssessment);
  A$('refreshAdminsBtn')?.addEventListener('click',loadAdmins);
  A$('refreshAuditBtn')?.addEventListener('click',loadAuditLog);
  try { await loadRole(); await Promise.all([loadAdmins(),loadTeachers(),loadAssessment(),loadAuditLog()]); }
  catch(e) { showBox('adminListMessage',e?.message || 'Could not load Administration Control.','error'); }
});
