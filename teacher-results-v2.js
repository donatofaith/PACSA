const R$ = id => document.getElementById(id);
let assessmentControl = null;
let teacherResults = [];
let resultEditingId = null;

const caRating = score => {
  const n = Number(score) || 0;
  if (n === 30) return 'A — Excellent';
  if (n >= 23) return 'B — Very Good';
  if (n >= 15) return 'C — Good';
  if (n >= 10) return 'D — Fair';
  return 'F — Poor';
};

const caGrade = score => {
  const n = Number(score) || 0;
  if (n === 30) return 'A';
  if (n >= 23) return 'B';
  if (n >= 15) return 'C';
  if (n >= 10) return 'D';
  return 'F';
};

const finalGrade = score => {
  const n = Number(score) || 0;
  if (n >= 80) return 'A1';
  if (n >= 75) return 'B2';
  if (n >= 70) return 'B3';
  if (n >= 65) return 'C4';
  if (n >= 60) return 'C5';
  if (n >= 50) return 'C6';
  if (n >= 45) return 'D7';
  if (n >= 40) return 'E8';
  return 'F9';
};

function waitForTeacherState() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (typeof pageState !== 'undefined' && pageState.teacher) {
        clearInterval(timer); resolve(true);
      } else if (attempts > 100) {
        clearInterval(timer); reject(new Error('Teacher session could not be loaded.'));
      }
    }, 50);
  });
}

async function getCurrentPeriodAndStage() {
  const { data: period, error } = await supabaseClient
    .from('sessions_terms')
    .select('session,term')
    .eq('is_current', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!period) throw new Error('No current academic session/term has been configured.');

  const { data: control, error: controlError } = await supabaseClient
    .from('assessment_periods')
    .select('*')
    .eq('session', period.session)
    .eq('term', period.term)
    .maybeSingle();
  if (controlError) throw controlError;

  assessmentControl = control || {
    session: period.session,
    term: period.term,
    current_stage: 'ca',
    ca_open: true,
    exam_open: false
  };

  pageState.session = period.session;
  R$('resultTerm').value = period.term;
  R$('resultTerm').disabled = true;
  updateStageUI();
}

function updateStageUI() {
  const stage = assessmentControl?.current_stage || 'closed';
  const banner = R$('assessmentStageBanner');
  const first = R$('resultFirstCA');
  const second = R$('resultSecondCA');
  const exam = R$('resultExam');
  const submit = R$('submitResultBtn');

  const show = (id, visible) => { const el = R$(id); if (el) el.style.display = visible ? '' : 'none'; };

  if (stage === 'ca') {
    banner.textContent = `Mid-Term Test is open — ${assessmentControl.session}, ${assessmentControl.term}. Enter 1st Test /10 and 2nd Test /20.`;
    R$('entryTitle').textContent = 'Enter Mid-Term Test';
    R$('entryHelp').textContent = 'Total /30 and Mid-Term grade/remark are calculated automatically. No examination fields are shown during Mid-Term entry.';
    first.disabled = false; second.disabled = false; exam.disabled = true; exam.value = '';
    show('firstCaField', true);
    show('secondCaField', true);
    show('caTotalField', true);
    show('examField', false);
    show('finalTotalField', false);
    show('gradeField', true);
    if (R$('resultGradeLabel')) R$('resultGradeLabel').textContent = 'Mid-Term Grade / Remark';
    submit.disabled = false; submit.textContent = 'Save Mid-Term Result';
  } else if (stage === 'exam') {
    banner.textContent = `Examination is open — ${assessmentControl.session}, ${assessmentControl.term}. Existing Test /30 totals are carried forward automatically.`;
    R$('entryTitle').textContent = 'Enter Examination Result';
    R$('entryHelp').textContent = 'Mid-Term scores are locked and carried forward. Enter only the Examination score /70.';
    first.disabled = true; second.disabled = true; exam.disabled = false;
    show('firstCaField', true);
    show('secondCaField', true);
    show('caTotalField', true);
    show('examField', true);
    show('finalTotalField', true);
    show('gradeField', true);
    if (R$('resultGradeLabel')) R$('resultGradeLabel').textContent = 'Final Grade / Remark';
    submit.disabled = false; submit.textContent = 'Save Examination Result';
  } else {
    banner.textContent = 'Result entry is currently closed by the school administrator.';
    R$('entryHelp').textContent = 'You can review existing results, but no new score can be entered until an assessment stage is opened.';
    first.disabled = true; second.disabled = true; exam.disabled = true; submit.disabled = true;
    show('firstCaField', true);
    show('secondCaField', true);
    show('caTotalField', true);
    show('examField', false);
    show('finalTotalField', false);
    show('gradeField', true);
  }
  calculateResultPreview();
}

function populateAssignments() {
  R$('resultAssignment').innerHTML = '<option value="">Select Class & Subject</option>' +
    pageState.assignments.map((a,i) => `<option value="${i}">${tEsc(a.class)} — ${tEsc(a.subject)}</option>`).join('');
}

function fillStudents() {
  const a = pageState.assignments[Number(R$('resultAssignment').value)];
  if (!a) {
    R$('resultStudent').innerHTML = '<option value="">Select Student</option>';
    return;
  }
  const registeredIds = pageState.studentSubjects
    .filter(r => tNorm(r.class) === tNorm(a.class) && tNorm(r.subject) === tNorm(a.subject) && tNorm(r.session) === tNorm(pageState.session))
    .map(r => String(r.student_id));
  let rows = pageState.students.filter(s => tNorm(s.class) === tNorm(a.class));
  if (registeredIds.length) rows = rows.filter(s => registeredIds.includes(String(s.student_id)));
  R$('resultStudent').innerHTML = '<option value="">Select Student</option>' +
    rows.map(s => `<option value="${tEsc(s.student_id)}">${tEsc(s.student_id)} - ${tEsc(tName(s))}</option>`).join('');
}

async function loadExistingForSelection() {
  const a = pageState.assignments[Number(R$('resultAssignment').value)];
  const student = R$('resultStudent').value;
  const term = R$('resultTerm').value;
  if (!a || !student || !term) return;

  const { data, error } = await supabaseClient
    .from('results')
    .select('*')
    .eq('student_id', student)
    .eq('class', a.class)
    .eq('subject', a.subject)
    .eq('term', term)
    .eq('session', pageState.session)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return showResultMessage(error.message, true);

  resultEditingId = data?.id || null;
  R$('resultFirstCA').value = data?.first_ca ?? '';
  R$('resultSecondCA').value = data?.second_ca ?? '';
  R$('resultCA').value = data?.ca ?? '';
  R$('resultExam').value = data?.exam ?? '';

  if (assessmentControl.current_stage === 'exam' && (!data || data.ca === null || data.ca === undefined)) {
    showResultMessage('No Mid-Term Test result exists for this student and subject yet. Examination score cannot be entered until the Test /30 is completed.', true);
    R$('resultExam').disabled = true;
    R$('submitResultBtn').disabled = true;
  } else {
    R$('resultExam').disabled = assessmentControl.current_stage !== 'exam';
    R$('submitResultBtn').disabled = assessmentControl.current_stage === 'closed';
    showResultMessage('', false);
  }
  calculateResultPreview();
}

function calculateResultPreview() {
  const first = Number(R$('resultFirstCA').value) || 0;
  const second = Number(R$('resultSecondCA').value) || 0;
  const ca = first + second;
  const exam = Number(R$('resultExam').value) || 0;
  R$('resultCA').value = ca;
  if (assessmentControl?.current_stage === 'exam') {
    const total = ca + exam;
    R$('resultTotal').value = total;
    R$('resultGrade').value = finalGrade(total);
  } else {
    R$('resultTotal').value = '';
    R$('resultGrade').value = caRating(ca);
  }
}

function showResultMessage(text, error=false) {
  const msg = R$('resultMessage'); if (!msg) return;
  msg.textContent = text; msg.className = `msg ${error ? 'bad' : 'ok'}`;
}

async function saveTeacherResultV2() {
  const a = pageState.assignments[Number(R$('resultAssignment').value)];
  const student = R$('resultStudent').value;
  const term = R$('resultTerm').value;
  if (!a || !student || !term) return showResultMessage('Select class/subject and student.', true);

  const stage = assessmentControl.current_stage;
  if (stage === 'closed') return showResultMessage('Result entry is currently closed.', true);

  const first = Number(R$('resultFirstCA').value);
  const second = Number(R$('resultSecondCA').value);
  const exam = Number(R$('resultExam').value);
  const teacherId = pageState.teacher?.teacher_id || null;

  let payload;
  if (stage === 'ca') {
    if (!Number.isFinite(first) || first < 0 || first > 10) return showResultMessage('1st Test must be between 0 and 10.', true);
    if (!Number.isFinite(second) || second < 0 || second > 20) return showResultMessage('2nd Test must be between 0 and 20.', true);
    const ca = first + second;
    payload = {
      student_id: student, subject: a.subject, class: a.class, term, session: pageState.session,
      first_ca: first, second_ca: second, ca, assessment_stage: 'ca',
      ca_status: 'published', ca_published_at: new Date().toISOString(),
      total: ca, grade: caGrade(ca), teacher_id: teacherId
    };
  } else {
    if (!resultEditingId) return showResultMessage('Mid-Term Test must be entered before Examination.', true);
    if (!Number.isFinite(exam) || exam < 0 || exam > 70) return showResultMessage('Examination score must be between 0 and 70.', true);
    const ca = (Number(R$('resultFirstCA').value)||0) + (Number(R$('resultSecondCA').value)||0);
    const total = ca + exam;
    payload = {
      exam, ca, total, grade: finalGrade(total), assessment_stage: 'exam', status: 'pending', teacher_id: teacherId
    };
  }

  const button = R$('submitResultBtn'); button.disabled = true; const old = button.textContent; button.textContent = 'Saving...';
  try {
    let response;
    if (resultEditingId) response = await supabaseClient.from('results').update(payload).eq('id', resultEditingId);
    else response = await supabaseClient.from('results').insert(payload);
    if (response.error) throw response.error;

    if (stage === 'exam') {
      await supabaseClient.from('student_reports').update({ status: 'draft', published_at: null, principal_remark: null, principal_teacher_id: null, principal_reviewed_at: null })
        .eq('student_id',student).eq('class',a.class).eq('term',term).eq('session',pageState.session);
    }
    showResultMessage(stage === 'ca' ? 'Mid-Term Test result saved and is now available on the student Mid-Term Performance Report Sheet.' : 'Examination score saved. The complete report will go through Class Teacher and Principal review.');
    await loadTeacherResultsV2();
  } catch(e) { showResultMessage(e?.message || 'Could not save result.', true); }
  finally { button.disabled = false; button.textContent = old; updateStageUI(); }
}

async function loadTeacherResultsV2() {
  const { data, error } = await supabaseClient.from('results').select('*').order('id',{ascending:false});
  if (error) throw error;
  teacherResults = (data || []).filter(r => pageState.assignments.some(a => tNorm(a.class)===tNorm(r.class) && tNorm(a.subject)===tNorm(r.subject)))
    .map(r => ({...r, studentName:tName(pageState.students.find(s=>String(s.student_id)===String(r.student_id)))||r.student_id}));
  populateFilters(); renderTeacherResultsV2();
}

function populateFilters() {
  const vals = key => [...new Set(teacherResults.map(r=>r[key]).filter(Boolean))].sort();
  R$('resultClassFilter').innerHTML='<option value="">All Classes</option>'+vals('class').map(v=>`<option>${tEsc(v)}</option>`).join('');
  R$('resultSubjectFilter').innerHTML='<option value="">All Subjects</option>'+vals('subject').map(v=>`<option>${tEsc(v)}</option>`).join('');
}

function filteredRows() {
  const search=tNorm(R$('resultSearch').value), cls=tNorm(R$('resultClassFilter').value), sub=tNorm(R$('resultSubjectFilter').value), term=tNorm(R$('resultTermFilter').value), stage=tNorm(R$('resultStageFilter').value);
  return teacherResults.filter(r => {
    const hay=tNorm([r.student_id,r.studentName,r.class,r.subject].join(' '));
    return (!search||hay.includes(search))&&(!cls||tNorm(r.class)===cls)&&(!sub||tNorm(r.subject)===sub)&&(!term||tNorm(r.term)===term)&&(!stage||tNorm(r.assessment_stage||'ca')===stage);
  });
}

function renderTeacherResultsV2() {
  const rows=filteredRows();
  R$('resultsTable').innerHTML = rows.length ? rows.map(r => {
    const ca = Number(r.ca ?? 0); const total = r.assessment_stage === 'exam' ? Number(r.total ?? ca+(Number(r.exam)||0)) : ca;
    const label = r.assessment_stage === 'exam' ? (r.grade || finalGrade(total)) : caRating(ca);
    return `<tr><td>${tEsc(r.student_id)}<br><small>${tEsc(r.studentName)}</small></td><td>${tEsc(r.class)}</td><td>${tEsc(r.subject)}</td><td>${r.first_ca ?? '-'}</td><td>${r.second_ca ?? '-'}</td><td><strong>${ca}</strong></td><td>${r.assessment_stage==='exam' ? (r.exam ?? '-') : '-'}</td><td>${r.assessment_stage==='exam' ? `<strong>${total}</strong>` : '-'}</td><td>${tEsc(label)}</td><td>${tEsc(r.term)}</td><td>${r.assessment_stage==='exam'?'Exam':'Mid-Term'}</td><td><button class="btn light" type="button" onclick="editResultV2(${Number(r.id)})">Open</button></td></tr>`;
  }).join('') : '<tr><td colspan="12">No result matches this filter.</td></tr>';
}

window.editResultV2 = async id => {
  const r=teacherResults.find(x=>Number(x.id)===Number(id)); if(!r)return;
  R$('resultEntryPanel').classList.remove('hidden');
  const idx=pageState.assignments.findIndex(a=>tNorm(a.class)===tNorm(r.class)&&tNorm(a.subject)===tNorm(r.subject));
  R$('resultAssignment').value=idx; fillStudents(); R$('resultStudent').value=r.student_id; R$('resultTerm').value=r.term;
  await loadExistingForSelection(); R$('resultEntryPanel').scrollIntoView({behavior:'smooth',block:'start'});
};

async function initResultV2() {
  await waitForTeacherState();
  await getCurrentPeriodAndStage();
  populateAssignments();
  R$('addResultBtn').addEventListener('click',()=>R$('resultEntryPanel').classList.toggle('hidden'));
  R$('resultAssignment').addEventListener('change',()=>{fillStudents();resultEditingId=null;});
  R$('resultStudent').addEventListener('change',loadExistingForSelection);
  R$('resultTerm').addEventListener('change',loadExistingForSelection);
  const scoreLimits={resultFirstCA:10,resultSecondCA:20,resultExam:70};
  Object.entries(scoreLimits).forEach(([id,max])=>{
    const input=R$(id);
    input?.addEventListener('input',()=>{
      if(input.value==='')return calculateResultPreview();
      let value=Number(input.value);
      if(!Number.isFinite(value))value=0;
      value=Math.max(0,Math.min(max,value));
      if(Number(input.value)!==value)input.value=String(value);
      calculateResultPreview();
    });
    input?.addEventListener('blur',()=>{
      if(input.value==='')return;
      let value=Number(input.value);
      if(!Number.isFinite(value))value=0;
      input.value=String(Math.max(0,Math.min(max,value)));
      calculateResultPreview();
    });
  });
  R$('submitResultBtn').addEventListener('click',saveTeacherResultV2);
  ['resultSearch','resultClassFilter','resultSubjectFilter','resultTermFilter','resultStageFilter'].forEach(id=>R$(id).addEventListener('input',renderTeacherResultsV2));
  R$('clearResultFilters').addEventListener('click',()=>{['resultSearch','resultClassFilter','resultSubjectFilter','resultTermFilter','resultStageFilter'].forEach(id=>R$(id).value='');renderTeacherResultsV2();});
  await loadTeacherResultsV2();
}

initResultV2().catch(e=>{console.error(e);showResultMessage(e?.message||'Could not load result entry.',true);});
