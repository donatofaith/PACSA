/* PACSA Class Teacher notifications */
(function(){
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const timeAgo=value=>{const d=new Date(value||0);const s=Math.floor((Date.now()-d.getTime())/1000);if(!Number.isFinite(s)||s<60)return'Just now';const m=Math.floor(s/60);if(m<60)return`${m} min ago`;const h=Math.floor(m/60);if(h<24)return`${h} hour${h===1?'':'s'} ago`;const days=Math.floor(h/24);return days<7?`${days} day${days===1?'':'s'} ago`:d.toLocaleDateString()};

  function styles(){
    if(document.getElementById('teacherNoticeStyles'))return;
    const s=document.createElement('style');s.id='teacherNoticeStyles';s.textContent=`
      .teacher-notice-btn{position:relative;width:42px;height:42px;border:0;border-radius:11px;background:#F3E8FF;color:#5B21B6;font-size:19px;cursor:pointer;display:grid;place-items:center;margin-left:auto;margin-right:12px}
      .teacher-notice-count{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#DC2626;color:#fff;border:2px solid #fff;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center}
      .teacher-notice-panel{position:fixed;right:24px;top:82px;width:min(390px,calc(100vw - 32px));max-height:520px;overflow:auto;background:#fff;border:1px solid #E5E7EB;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.18);z-index:9999;display:none;padding:14px}.teacher-notice-panel.show{display:block}
      .teacher-notice-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 4px 10px}.teacher-notice-head h3{margin:0;font-size:16px}.teacher-notice-head a{font-size:12px;font-weight:800;color:#5B21B6;text-decoration:none}
      .teacher-notice-item{display:block;padding:12px;border-top:1px solid #F1F5F9;text-decoration:none;border-radius:10px}.teacher-notice-item:hover{background:#FAF7FF}.teacher-notice-item strong{display:block;color:#111827;font-size:14px}.teacher-notice-item span{display:block;color:#64748B;font-size:12px;line-height:1.45;margin-top:3px}.teacher-notice-unread{background:#FAF5FF}.teacher-notice-empty{padding:18px 8px;color:#64748B;font-size:13px}
      @media(max-width:900px){.teacher-notice-btn{margin-left:auto;margin-right:8px}.teacher-notice-panel{top:76px;right:12px;left:12px;width:auto}.topbar{gap:8px}.topbar>.logout{padding:10px}}
      @media(max-width:560px){.teacher-notice-btn{width:39px;height:39px}.teacher-notice-panel{right:8px;left:8px}.top-left p{display:none}}
    `;document.head.appendChild(s);
  }

  async function isClassTeacher(){
    const {data:session}=await supabaseClient.auth.getSession();const uid=session?.session?.user?.id;if(!uid)return false;
    const {data:teacher,error}=await supabaseClient.from('Teachers').select('teacher_id').eq('auth_user_id',uid).maybeSingle();if(error||!teacher)return false;
    const {data:rows,error:assignmentError}=await supabaseClient.from('class_teacher_assignments').select('id').eq('teacher_id',teacher.teacher_id).limit(1);return !assignmentError&&(rows||[]).length>0;
  }

  async function loadNotices(){
    const {data,error}=await supabaseClient.rpc('pacsa_get_my_teacher_notifications',{p_limit:25});
    if(error){console.warn('Class teacher notifications:',error);return[]}
    return data||[];
  }

  function render(panel,button,notices){
    const unread=notices.filter(n=>!n.is_read);const count=button.querySelector('.teacher-notice-count');
    if(unread.length){count.style.display='flex';count.textContent=String(Math.min(unread.length,99))}else count.style.display='none';
    panel.innerHTML=`<div class="teacher-notice-head"><h3>Class Notifications</h3><a href="teacher-class.html">Open My Class</a></div>${notices.length?notices.map(n=>`<a href="teacher-class.html" class="teacher-notice-item ${n.is_read?'':'teacher-notice-unread'}"><strong>${esc(n.title||'Student result updated')}</strong><span>${esc(n.message||'A result was entered for your class.')} ${n.term?`• ${esc(n.term)}`:''} • ${esc(timeAgo(n.created_at))}</span></a>`).join(''):'<div class="teacher-notice-empty">No new result notifications for your class.</div>'}`;
  }

  async function init(){
    try{
      if(!(await isClassTeacher()))return;
      styles();
      const topbar=document.querySelector('.topbar');if(!topbar||document.getElementById('teacherNoticeBtn'))return;
      const button=document.createElement('button');button.type='button';button.id='teacherNoticeBtn';button.className='teacher-notice-btn';button.setAttribute('aria-label','Class notifications');button.innerHTML='🔔<span class="teacher-notice-count"></span>';
      const teacherBox=topbar.querySelector('.top-teacher');topbar.insertBefore(button,teacherBox||topbar.querySelector('.logout'));
      const panel=document.createElement('div');panel.id='teacherNoticePanel';panel.className='teacher-notice-panel';document.body.appendChild(panel);
      let notices=await loadNotices();render(panel,button,notices);
      button.onclick=async event=>{event.stopPropagation();panel.classList.toggle('show');if(panel.classList.contains('show')){await supabaseClient.rpc('pacsa_mark_my_teacher_notifications_read');notices=notices.map(n=>({...n,is_read:true}));render(panel,button,notices)}};
      document.addEventListener('click',event=>{if(panel.classList.contains('show')&&!panel.contains(event.target)&&!button.contains(event.target))panel.classList.remove('show')});
      setInterval(async()=>{notices=await loadNotices();render(panel,button,notices)},60000);
    }catch(error){console.warn('Teacher notification setup:',error)}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,700));else setTimeout(init,700);
})();
