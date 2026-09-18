(async function () {
  try {
    let role = '';

    // Prefer the teacher row already loaded by the portal.
    for (let i = 0; i < 100; i++) {
      if (typeof pageState !== 'undefined' && pageState.teacher) {
        role = String(pageState.teacher.role || '').trim().toLowerCase();
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Fallback to the secured role helper if needed.
    if (!role) {
      const { data, error } = await supabaseClient.rpc('pacsa_get_my_teacher_role');
      if (!error) role = String(data || '').trim().toLowerCase();
    }

    if (role !== 'principal') return;

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

    // Make the role visible on the dashboard/profile when elements exist.
    const badge = document.getElementById('principalRoleBadge');
    if (badge) {
      badge.textContent = 'Principal';
      badge.classList.remove('hidden');
    }
  } catch (error) {
    console.warn('Principal role check failed:', error);
  }
})();
