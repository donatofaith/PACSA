const CA$ = id => document.getElementById(id);
const caEsc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const caNorm = v => String(v ?? '').trim().toLowerCase();

function caPerformance(score) {
  const n = Number(score) || 0;
  if (n === 30) return 'Excellent';
  if (n >= 23) return 'Very Good';
  if (n >= 15) return 'Good';
  return 'Fair';
}

async function loadStudentCAView() {
  const body = CA$('caResultsTable');
  if (!body) return;

  const { data, error } = await supabaseClient.rpc('pacsa_get_my_ca_results');
  if (error) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">Could not load C.A results.</td></tr>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">No published Continuous Assessment result is available yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${caEsc(r.subject || '-')}</td>
      <td>${caEsc(r.first_ca ?? '-')} / 10</td>
      <td>${caEsc(r.second_ca ?? '-')} / 20</td>
      <td><strong>${caEsc(r.ca ?? 0)} / 30</strong></td>
      <td><span class="ca-performance">${caEsc(caPerformance(r.ca))}</span></td>
      <td>${caEsc(r.term || '-')}<br><small>${caEsc(r.session || '')}</small></td>
    </tr>
  `).join('');
}

async function syncPublishedRemarks() {
  const teacherBox = CA$('reportTeacherRemark');
  const principalBox = CA$('reportPrincipalRemark');
  if (!teacherBox || !principalBox) return;

  const studentId = CA$('reportStudentId')?.textContent?.trim();
  const className = CA$('reportStudentClass')?.textContent?.trim();
  const term = CA$('reportTerm')?.textContent?.trim();
  const session = CA$('reportSession')?.textContent?.trim();

  if (!studentId || studentId === '--' || !term || term === '--' || !session || session === '--') {
    teacherBox.textContent = '--';
    principalBox.textContent = '--';
    return;
  }

  const { data, error } = await supabaseClient
    .from('student_reports')
    .select('teacher_remark,remark,principal_remark,status')
    .eq('student_id', studentId)
    .eq('class', className)
    .eq('term', term)
    .eq('session', session)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return;
  teacherBox.textContent = data.teacher_remark || data.remark || 'No Class Teacher remark provided.';
  principalBox.textContent = data.principal_remark || 'No Principal remark provided.';

  const legacy = CA$('reportRemark');
  if (legacy) legacy.closest('.remark-display')?.classList.add('hidden-legacy-remark');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadStudentCAView, 500);
  setTimeout(syncPublishedRemarks, 700);

  ['sessionFilter','classFilter','termFilter'].forEach(id => {
    CA$(id)?.addEventListener('change', () => setTimeout(syncPublishedRemarks, 350));
  });

  const termNode = CA$('reportTerm');
  if (termNode) {
    new MutationObserver(() => setTimeout(syncPublishedRemarks, 100))
      .observe(termNode, { childList:true, characterData:true, subtree:true });
  }
});
