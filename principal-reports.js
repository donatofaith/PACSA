const P$ = id => document.getElementById(id);
const pNorm = v => String(v ?? '').trim().toLowerCase();
const pEsc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
let principalReports = [];
let principalStudents = [];
let selectedPrincipalReport = null;

function waitForPrincipalTeacher() {
  return new Promise((resolve,reject)=>{
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if (typeof pageState !== 'undefined' && pageState.teacher) { clearInterval(timer); resolve(true); }
      else if (tries>100) { clearInterval(timer); reject(new Error('Teacher session could not be loaded.')); }
    },50);
  });
}

function studentName(id) {
  const s=principalStudents.find(x=>String(x.student_id)===String(id));
  return s ? `${s.first_name||''} ${s.last_name||''}`.trim() || id : id;
}

async function verifyPrincipal() {
  const { data, error } = await supabaseClient.rpc('pacsa_get_my_teacher_role');
  if (error) throw error;
  if (pNorm(data) !== 'principal') {
    location.replace('teacher-dashboard.html');
    throw new Error('Principal access is required.');
  }
}

async function loadPrincipalReports() {
  const [{data: reports,error},{data: students,error:studentError}] = await Promise.all([
    supabaseClient.rpc('pacsa_principal_get_reports'),
    supabaseClient.from('students').select('student_id,first_name,last_name,class')
  ]);
  if (error) throw error;
  if (studentError) throw studentError;
  principalReports = reports || [];
  principalStudents = students || [];
  renderPrincipalReports();
}

function filteredPrincipalReports() {
  const search=pNorm(P$('reportSearch')?.value), status=pNorm(P$('reportStatus')?.value);
  return principalReports.filter(r=>{
    const hay=pNorm([r.student_id,studentName(r.student_id),r.class,r.term,r.session].join(' '));
    return (!search||hay.includes(search))&&(!status||pNorm(r.status)===status);
  });
}

function renderPrincipalReports() {
  const rows=filteredPrincipalReports();
  P$('principalReportsTable').innerHTML = rows.length ? rows.map((r,i)=>`
    <tr>
      <td><strong>${pEsc(studentName(r.student_id))}</strong><br><small>${pEsc(r.student_id)}</small></td>
      <td>${pEsc(r.class)}</td><td>${pEsc(r.term)}</td><td>${pEsc(r.session)}</td>
      <td>${r.teacher_remark ? 'Added' : '<span style="color:#b91c1c">Missing</span>'}</td>
      <td><span class="status-pill">${pEsc(r.status)}</span></td>
      <td><button class="btn light" type="button" onclick="openPrincipalReport(${i})">Review</button></td>
    </tr>`).join('') : '<tr><td colspan="7">No submitted reports match this view.</td></tr>';
}

window.openPrincipalReport = async index => {
  const rows=filteredPrincipalReports();
  const report=rows[index]; if(!report)return;
  selectedPrincipalReport=report;
  P$('principalReviewPanel').classList.remove('hidden');
  P$('reviewStudent').textContent=studentName(report.student_id);
  P$('reviewMeta').textContent=`${report.student_id} • ${report.class} • ${report.term} • ${report.session}`;
  P$('teacherRemark').textContent=report.teacher_remark || 'No Class Teacher remark was submitted.';
  P$('principalRemark').value=report.principal_remark || '';
  P$('principalMessage').textContent='';
  const {data,error}=await supabaseClient.rpc('pacsa_principal_get_report_results',{
    p_student_id:report.student_id,p_class:report.class,p_term:report.term,p_session:report.session
  });
  if(error){P$('principalMessage').textContent=error.message;return;}
  P$('principalResultBody').innerHTML=(data||[]).map(r=>`<tr><td>${pEsc(r.subject)}</td><td>${r.first_ca??'-'}</td><td>${r.second_ca??'-'}</td><td>${r.ca??'-'}</td><td>${r.exam??'-'}</td><td><strong>${r.total??'-'}</strong></td><td>${pEsc(r.grade||'-')}</td></tr>`).join('')||'<tr><td colspan="7">No examination results found.</td></tr>';
  const pending=pNorm(report.status)==='pending';
  P$('publishReportBtn').style.display=pending?'inline-flex':'none';
  P$('returnReportBtn').style.display=pending?'inline-flex':'none';
  P$('principalReviewPanel').scrollIntoView({behavior:'smooth',block:'start'});
};

async function publishSelected() {
  if(!selectedPrincipalReport)return;
  const remark=P$('principalRemark').value.trim();
  if(!remark){P$('principalMessage').textContent='Enter the Principal remark before publishing.';return;}
  const b=P$('publishReportBtn');b.disabled=true;b.textContent='Publishing...';
  try{
    const r=selectedPrincipalReport;
    const {data,error}=await supabaseClient.rpc('pacsa_principal_publish_report',{
      p_student_id:r.student_id,p_class:r.class,p_term:r.term,p_session:r.session,p_principal_remark:remark
    });
    if(error||!data)throw error||new Error('Report was not published.');
    P$('principalMessage').textContent='Report approved and published successfully.';
    await loadPrincipalReports();
  }catch(e){P$('principalMessage').textContent=e?.message||'Could not publish report.';}
  finally{b.disabled=false;b.textContent='Approve & Publish';}
}

async function returnSelected() {
  if(!selectedPrincipalReport)return;
  const reason=P$('principalRemark').value.trim();
  if(!reason){P$('principalMessage').textContent='Enter the reason/remark before returning the report.';return;}
  const r=selectedPrincipalReport;
  const {data,error}=await supabaseClient.rpc('pacsa_principal_return_report',{
    p_student_id:r.student_id,p_class:r.class,p_term:r.term,p_session:r.session,p_reason:reason
  });
  if(error||!data){P$('principalMessage').textContent=error?.message||'Could not return report.';return;}
  P$('principalMessage').textContent='Report returned to the Class Teacher.';
  await loadPrincipalReports();
}

(async()=>{
  try{
    await waitForPrincipalTeacher(); await verifyPrincipal();
    P$('reportSearch').addEventListener('input',renderPrincipalReports);
    P$('reportStatus').addEventListener('change',renderPrincipalReports);
    P$('refreshBtn').addEventListener('click',loadPrincipalReports);
    P$('closeReviewBtn').addEventListener('click',()=>P$('principalReviewPanel').classList.add('hidden'));
    P$('publishReportBtn').addEventListener('click',publishSelected);
    P$('returnReportBtn').addEventListener('click',returnSelected);
    await loadPrincipalReports();
  }catch(e){console.error(e);alert(e?.message||'Could not load Principal Report Approval.');}
})();
