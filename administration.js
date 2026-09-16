const A$ = id => document.getElementById(id);
const aNorm = v => String(v ?? '').trim().toLowerCase();
let adminRole = '';
let teachers = [];
let currentPeriod = null;

function showBox(id, text, type='success') {
  const box = A$(id); if (!box) return;
  box.textContent = text; box.className = `status-message show ${type}`;
}

async function loadRole() {
  const { data, error } = await supabaseClient.rpc('pacsa_get_my_admin_role');
  if (error) throw error;
  adminRole = aNorm(data);
  A$('myRoleBadge').textContent = adminRole === 'super_admin' ? 'Super Admin' : 'Admin';
  if (adminRole !== 'super_admin') {
    document.querySelectorAll('#createAdminBtn,#assignPrincipalBtn,#removePrincipalBtn,#saveAssessmentBtn').forEach(b => b.disabled = true);
    throw new Error('Only the Super Admin can use Administration Control.');
  }
}

async function loadAdmins() {
  const { data, error } = await supabaseClient.from('admins').select('id,fullname,email,role,status').order('id');
  if (error) throw error;
  A$('adminsTableBody').innerHTML = (data || []).map(a => `
    <tr><td><strong>${a.fullname || 'Administrator'}</strong></td><td>${a.email || '--'}</td><td>${a.role === 'super_admin' ? 'Super Admin' : 'Admin'}</td><td>${a.status || 'active'}</td></tr>
  `).join('') || '<tr><td colspan="4">No administrators found.</td></tr>';
}

async function loadTeachers() {
  const { data, error } = await supabaseClient.from('Teachers').select('teacher_id,first_name,last_name,email,role').order('first_name');
  if (error) throw error;
  teachers = data || [];
  A$('principalTeacher').innerHTML = '<option value="">Select teacher</option>' + teachers.map(t => {
    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.teacher_id;
    const label = aNorm(t.role) === 'principal' ? `${name} — Principal` : name;
    return `<option value="${t.teacher_id}">${label}</option>`;
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

async function createAdmin() {
  const fullname = A$('adminFullname').value.trim();
  const email = A$('adminEmail').value.trim().toLowerCase();
  if (!fullname || !email) return showBox('adminMessage','Enter the administrator name and email.','error');
  const button = A$('createAdminBtn'); button.disabled = true; button.textContent = 'Creating...';
  try {
    const { data, error } = await supabaseClient.functions.invoke('create-admin-user',{body:{fullname,email}});
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    showBox('adminMessage', data?.email_sent ? 'Administrator created. Login details were emailed.' : 'Administrator created. Copy the temporary password below.');
    A$('adminCredentials').classList.add('show');
    A$('adminCredentials').textContent = `Admin: ${fullname}\nEmail: ${email}\nTemporary Password: ${data?.temporary_password || '--'}\nExpires: ${data?.temporary_password_expires_at || '--'}\nLogin: ${location.origin}/admin-login.html`;
    A$('adminFullname').value=''; A$('adminEmail').value=''; await loadAdmins();
  } catch(e) { showBox('adminMessage', e?.message || 'Could not create administrator.','error'); }
  finally { button.disabled=false; button.textContent='Create Admin'; }
}

async function setPrincipal(makePrincipal) {
  const teacherId = A$('principalTeacher').value;
  if (!teacherId) return showBox('principalMessage','Select a teacher first.','error');
  try {
    if (makePrincipal) {
      const { data: classRoles, error: roleError } = await supabaseClient.from('class_teacher_assignments').select('id').eq('teacher_id',teacherId).limit(1);
      if (roleError) throw roleError;
      if ((classRoles || []).length) throw new Error('This teacher is currently a class teacher. Remove that assignment before making the teacher Principal.');
    }
    const { error } = await supabaseClient.from('Teachers').update({role: makePrincipal ? 'principal' : 'teacher'}).eq('teacher_id',teacherId);
    if (error) throw error;
    showBox('principalMessage', makePrincipal ? 'Principal role assigned successfully.' : 'Principal role removed. The account is now a normal teacher.');
    await loadTeachers(); A$('principalTeacher').value = teacherId;
  } catch(e) { showBox('principalMessage', e?.message || 'Could not update the role.','error'); }
}

async function saveAssessment() {
  if (!currentPeriod) return showBox('assessmentMessage','Set the current session and term first.','error');
  const stage = A$('assessmentStage').value;
  const payload = {
    session: currentPeriod.session,
    term: currentPeriod.term,
    current_stage: stage,
    ca_open: stage === 'ca',
    exam_open: stage === 'exam',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabaseClient.from('assessment_periods').upsert(payload,{onConflict:'session,term'});
  if (error) return showBox('assessmentMessage',error.message,'error');
  showBox('assessmentMessage', stage === 'ca' ? 'Continuous Assessment entry is now open.' : stage === 'exam' ? 'Examination entry is now open. Existing C.A totals will carry forward automatically.' : 'Result entry is now closed.');
}

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await window.adminAuthReady; if (!admin) return;
  A$('menuBtn')?.addEventListener('click',()=>A$('sidebar')?.classList.toggle('active'));
  A$('createAdminBtn')?.addEventListener('click',createAdmin);
  A$('assignPrincipalBtn')?.addEventListener('click',()=>setPrincipal(true));
  A$('removePrincipalBtn')?.addEventListener('click',()=>setPrincipal(false));
  A$('saveAssessmentBtn')?.addEventListener('click',saveAssessment);
  try { await loadRole(); await Promise.all([loadAdmins(),loadTeachers(),loadAssessment()]); }
  catch(e) { alert(e?.message || 'Could not load Administration Control.'); }
});
