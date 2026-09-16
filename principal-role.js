(async function () {
  try {
    const { data, error } = await supabaseClient.rpc('pacsa_get_my_teacher_role');
    if (error || String(data || '').toLowerCase() !== 'principal') return;

    const nav = document.querySelector('.nav');
    if (nav && !document.getElementById('principalReportsLink')) {
      const link = document.createElement('a');
      link.id = 'principalReportsLink';
      link.href = 'principal-reports.html';
      link.innerHTML = '✅ Report Approval';
      const profile = [...nav.querySelectorAll('a')].find(a => a.getAttribute('href') === 'teacher-profile.html');
      nav.insertBefore(link, profile || null);
      if (location.pathname.endsWith('principal-reports.html')) link.classList.add('active');
    }
  } catch (error) {
    console.warn('Principal role check failed:', error);
  }
})();
