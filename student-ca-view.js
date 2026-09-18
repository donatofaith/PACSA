const CA$ = id => document.getElementById(id);
const caEsc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function caPerformance(score) {
  const n = Number(score) || 0;
  if (n === 30) return 'A — Excellent';
  if (n >= 23) return 'B — Very Good';
  if (n >= 15) return 'C — Good';
  if (n >= 10) return 'D — Fair';
  return 'F — Poor';
}

async function loadStudentCAView() {
  const body = CA$('caResultsTable');
  if (!body) return;

  const { data, error } = await supabaseClient.rpc('pacsa_get_my_ca_results');

  if (error) {
    console.error('Mid-Term result load:', error);
    body.innerHTML = `<tr><td colspan="6" class="empty-row">Could not load Mid-Term results: ${caEsc(error.message)}</td></tr>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">No published Mid-Term result is available yet.</td></tr>';
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

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadStudentCAView, 350);
});
