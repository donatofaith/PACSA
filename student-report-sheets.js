const SHEET_SIG_BUCKET='teacher-signatures';
const S$=id=>document.getElementById(id);
const sEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const sigCache=new Map();

function sOrdinal(n){n=Number(n);if(!Number.isFinite(n)||n<1)return '--';const h=n%100;if(h>=11&&h<=13)return `${n}th`;return `${n}${n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;}
function sNormalize(value){return String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function isSeniorClass(className){const value=sNormalize(className);if(/\b(jss|junior)\b/.test(value))return false;return /\b(ss|sss|senior)\b/.test(value);}
function schoolLevel(className){return isSeniorClass(className)?'Senior':'Junior';}
function termNumber(term){const value=sNormalize(term);if(value.includes('third'))return 3;if(value.includes('second'))return 2;return 1;}
function reportGrade(score,className){const n=Number(score)||0;if(!isSeniorClass(className)){if(n>=70)return 'A';if(n>=60)return 'B';if(n>=50)return 'C';if(n>=45)return 'D';if(n>=40)return 'E';return 'F';}if(n>=80)return 'A1';if(n>=75)return 'B2';if(n>=70)return 'B3';if(n>=65)return 'C4';if(n>=60)return 'C5';if(n>=50)return 'C6';if(n>=45)return 'D7';if(n>=40)return 'E8';return 'F9';}
function gradingKey(className){return isSeniorClass(className)?'A1: 80–100 EXCELLENT, B2: 75–79 VERY GOOD, B3: 70–74 GOOD, C4: 65–69 CREDIT, C5: 60–64 CREDIT, C6: 50–59 CREDIT, D7: 45–49 PASS, E8: 40–44 PASS, F9: 0–39 FAIL':'A: 70–100 EXCELLENT, B: 60–69 VERY GOOD, C: 50–59 GOOD, D: 45–49 FAIR, E: 40–44 PASS, F: 0–39 FAIL';}
function schoolHead(){return `<div class="sheet-school"><div class="sheet-school-top"><img src="images/PACSA LOGO.png" alt="PACSA"><div><h2>Pastors’ Children Secondary Academy</h2><h3>A.K.A PACSA INTERNATIONAL SCHOOL</h3><p>AN INSTITUTION FOR LEVITES AND NAZARITES</p><p>LANE 18, ORI-OKE AGBARA ANU, ELEBU, OLUYOLE EXTENSION, IBADAN, OYO STATE, NIGERIA</p><p>MAIL: pastorchildrenacademy@gmail.com</p></div></div></div>`;}
async function waitForStudent(){for(let i=0;i<120;i++){if(typeof student!=='undefined'&&student)return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Student report session could not be loaded.');}
async function signedSig(path){if(!path)return '';if(sigCache.has(path))return sigCache.get(path);const {data}=await supabaseClient.storage.from(SHEET_SIG_BUCKET).createSignedUrl(path,3600);const url=data?.signedUrl||'';sigCache.set(path,url);return url;}
async function sigHtml(path){const url=await signedSig(path);return url?`<img class="sheet-sign" src="${sEsc(url)}" alt="Signature">`:'--';}
async function reportMeta(session,term,cls){const {data}=await supabaseClient.rpc('pacsa_get_my_report_meta',{p_session:session,p_term:term,p_class:cls});return Array.isArray(data)?data[0]:(data||{});}
function printSheet(id,mode){const el=S$(id);if(!el)return;document.querySelectorAll('.official-sheet').forEach(x=>x.classList.remove('print-target'));el.classList.add('print-target');document.body.classList.add(mode);const cleanup=()=>{document.body.classList.remove(mode);el.classList.remove('print-target');window.removeEventListener('afterprint',cleanup)};window.addEventListener('afterprint',cleanup);window.print();}

async function renderMidtermSheet(){
  const {data,error}=await supabaseClient.rpc('pacsa_get_my_midterm_report');
  let host=S$('officialMidtermSheet');
  if(!host){host=document.createElement('section');host.id='officialMidtermSheet';host.className='official-sheet';document.querySelector('.filter-card')?.before(host);}
  if(error){host.innerHTML=`<div class="official-sheet-inner"><p>Could not load Mid-Term Performance Report Sheet: ${sEsc(error.message)}</p></div>`;return;}
  const all=data||[];
  if(!all.length){host.innerHTML=`<div class="official-sheet-inner">${schoolHead()}<div class="sheet-title">Mid-Term Performance Report Sheet</div><p class="sheet-empty">No published Mid-Term result is available yet.</p></div>`;return;}
  const latest=all[0];
  const rows=all.filter(r=>r.session===latest.session&&r.term===latest.term&&r.class===latest.class);
  const meta=await reportMeta(latest.session,latest.term,latest.class);
  const marks=rows.reduce((a,r)=>a+(Number(r.total_ca)||0),0), obtainable=rows.length*30, percent=obtainable?(marks/obtainable*100):0;
  const body=[];
  for(const r of rows){body.push(`<tr><td>${sEsc(r.subject)}</td><td>${sEsc(r.first_ca??'-')}</td><td>${sEsc(r.second_ca??'-')}</td><td><strong>${sEsc(r.total_ca??0)}</strong></td><td>${sOrdinal(r.subject_position)}</td><td>${sEsc(r.remark||'-')}</td><td>${await sigHtml(r.teacher_signature_path)}</td></tr>`)}
  host.innerHTML=`<div class="official-sheet-inner">${schoolHead()}<div class="sheet-title">${schoolLevel(latest.class)} School Mid-Term Performance Report Sheet</div><table class="sheet-info"><tr><td><b>NAME:</b> ${sEsc(getStudentName())}</td><td><b>CLASS:</b> ${sEsc(latest.class)}</td><td><b>AGE:</b> ${sEsc(meta?.age??'--')}</td><td><b>SESSION:</b> ${sEsc(latest.session)}</td><td><b>TERM:</b> ${sEsc(latest.term)}</td></tr><tr><td colspan="3"></td><td><b>NO. IN CLASS:</b> ${sEsc(meta?.number_in_class??'--')}</td><td><b>POSITION:</b> ${sOrdinal(meta?.class_position)}</td></tr></table><table class="sheet-table"><thead><tr><th>Subject</th><th>1st Test<br>(10)</th><th>2nd Test<br>(20)</th><th>Total<br>(30)</th><th>Position</th><th>Remarks</th><th>Signature</th></tr></thead><tbody>${body.join('')}</tbody></table><table class="sheet-summary"><tr><td>SUBJECTS OFFERED: ${rows.length}</td><td>MARKS OBTAINABLE: ${obtainable}</td><td>MARKS OBTAINED: ${marks}</td><td>% OF MARK: ${percent.toFixed(1)}%</td></tr></table><table class="sheet-comments"><tr><td>Class Teacher’s Comment</td><td>${sEsc(meta?.midterm_teacher_remark||'--')}</td></tr><tr><td>Principal’s Comment</td><td>${sEsc(meta?.midterm_principal_remark||'--')}</td></tr></table><table class="sheet-key"><tr><td>KEY</td><td>A: 30 EXCELLENT, B: 23–29 VERY GOOD, C: 15–22 GOOD, D: 10–14 FAIR, F: 0–9 POOR</td></tr></table><div class="sheet-actions"><button class="sheet-print-btn" id="printMidtermBtn" type="button">Print Mid-Term Report</button></div></div>`;
  S$('printMidtermBtn')?.addEventListener('click',()=>printSheet('officialMidtermSheet','print-midterm'));
}

async function renderFinalSheet(){
  const session=S$('sessionFilter')?.value||S$('reportSession')?.textContent?.trim();
  const term=S$('termFilter')?.value||S$('reportTerm')?.textContent?.trim();
  const cls=S$('classFilter')?.value||S$('reportStudentClass')?.textContent?.trim();
  let host=S$('officialFinalSheet');
  if(!host){host=document.createElement('section');host.id='officialFinalSheet';host.className='official-sheet';document.querySelector('.report-wrapper')?.after(host);}
  if(!session||!term||!cls||session==='--'||term==='--'||cls==='--'){host.innerHTML=`<div class="official-sheet-inner">${schoolHead()}<div class="sheet-title">Performance Report Sheet</div><p class="sheet-empty">Select a published final report above.</p></div>`;return;}
  const [{data:rows,error},meta]=await Promise.all([supabaseClient.rpc('pacsa_get_my_final_report_rows',{p_session:session,p_term:term,p_class:cls}),reportMeta(session,term,cls)]);
  if(error){host.innerHTML=`<div class="official-sheet-inner"><p>Could not load final report: ${sEsc(error.message)}</p></div>`;return;}
  const list=rows||[];
  const level=schoolLevel(cls);
  if(!list.length){host.innerHTML=`<div class="official-sheet-inner">${schoolHead()}<div class="sheet-title">${level} School Performance Report Sheet</div><p class="sheet-empty">No published Examination report is available yet.</p></div>`;return;}
  const selectedTerm=termNumber(term);
  const headers=['<th>Subject</th>','<th>Test<br>(30)</th>','<th>Exam<br>(70)</th>','<th>Total<br>(100)</th>','<th>Class Avg</th>'];
  if(selectedTerm>=2)headers.push('<th>1st Term<br>Total</th>');
  if(selectedTerm>=3)headers.push('<th>2nd Term<br>Total</th>');
  if(selectedTerm>=2)headers.push('<th>Final Avg</th>');
  headers.push('<th>Grade</th>','<th>Remarks</th>','<th>Sign</th>');
  const marks=list.reduce((a,r)=>a+(Number(r.total)||0),0), obtainable=list.length*100, percent=obtainable?marks/obtainable*100:0;
  const body=[];
  for(const r of list){
    const cells=[`<td>${sEsc(r.subject)}</td>`,`<td>${sEsc(r.ca??'-')}</td>`,`<td>${sEsc(r.exam??'-')}</td>`,`<td><strong>${sEsc(r.total??'-')}</strong></td>`,`<td>${sEsc(r.class_average??'-')}</td>`];
    if(selectedTerm>=2)cells.push(`<td>${sEsc(r.first_term_total??'-')}</td>`);
    if(selectedTerm>=3)cells.push(`<td>${sEsc(r.second_term_total??'-')}</td>`);
    if(selectedTerm>=2)cells.push(`<td>${sEsc(r.final_average??'-')}</td>`);
    cells.push(`<td>${sEsc(reportGrade(r.total,cls))}</td>`,`<td>${sEsc(r.remark||'-')}</td>`,`<td>${await sigHtml(r.teacher_signature_path)}</td>`);
    body.push(`<tr>${cells.join('')}</tr>`);
  }
  const next=meta?.next_term_begins?new Date(meta.next_term_begins+'T00:00:00').toLocaleDateString():'--';
  host.innerHTML=`<div class="official-sheet-inner">${schoolHead()}<div class="sheet-title">${level} School Performance Report Sheet</div><table class="sheet-info"><tr><td><b>NAME:</b> ${sEsc(getStudentName())}</td><td><b>CLASS:</b> ${sEsc(cls)}</td><td><b>AGE:</b> ${sEsc(meta?.age??'--')}</td><td><b>SESSION:</b> ${sEsc(session)}</td><td><b>TERM:</b> ${sEsc(term)}</td><td><b>NEXT TERM BEGINS:</b> ${sEsc(next)}</td></tr><tr><td colspan="3"></td><td><b>NO. IN CLASS:</b> ${sEsc(meta?.number_in_class??'--')}</td><td><b>POSITION:</b> ${sOrdinal(meta?.class_position)}</td><td></td></tr></table><table class="sheet-table"><thead><tr>${headers.join('')}</tr></thead><tbody>${body.length?body.join(''):`<tr><td colspan="${headers.length}" class="sheet-empty">No published result found.</td></tr>`}</tbody></table><table class="sheet-summary"><tr><td>SUBJECTS OFFERED: ${list.length}</td><td>MARKS OBTAINABLE: ${obtainable}</td><td>MARKS OBTAINED: ${marks}</td><td>% OF MARK: ${percent.toFixed(1)}%</td></tr></table><table class="sheet-comments"><tr><td>Class Teacher’s Comment</td><td>${sEsc(meta?.exam_teacher_remark||'--')}</td></tr><tr><td>Principal’s Comment</td><td>${sEsc(meta?.exam_principal_remark||'--')}</td></tr></table><table class="sheet-key"><tr><td>KEY</td><td>${gradingKey(cls)}</td></tr></table><div class="sheet-actions"><button class="sheet-print-btn" id="printOfficialFinalBtn" type="button">Print Final Report</button></div></div>`;
  S$('printOfficialFinalBtn')?.addEventListener('click',()=>printSheet('officialFinalSheet','print-final'));
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{await waitForStudent();await renderMidtermSheet();setTimeout(renderFinalSheet,500);['sessionFilter','classFilter','termFilter'].forEach(id=>S$(id)?.addEventListener('change',()=>setTimeout(renderFinalSheet,250)));const term=S$('reportTerm');if(term)new MutationObserver(()=>setTimeout(renderFinalSheet,200)).observe(term,{childList:true,characterData:true,subtree:true});}catch(error){console.error('Official report sheets:',error);}
});
