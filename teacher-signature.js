const SIG_BUCKET='teacher-signatures';
const SIG_MAX=2*1024*1024;
const SIG_TYPES=['image/jpeg','image/png','image/webp'];
let currentSignaturePath='';

function sigExt(file){return file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';}
function sigMsg(text,bad=false){const el=document.getElementById('signatureMsg');if(!el)return;el.textContent=text;el.className=`msg ${bad?'bad':'ok'}`;}

async function waitForTeacherProfile(){
  for(let i=0;i<100;i++){
    if(typeof pageState!=='undefined'&&pageState.teacher&&pageState.user)return true;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('Teacher profile could not be loaded.');
}

async function fetchSignaturePath(){
  const {data,error}=await supabaseClient
    .from('Teachers')
    .select('signature_path')
    .eq('auth_user_id',pageState.user.id)
    .maybeSingle();
  if(error)throw error;
  currentSignaturePath=data?.signature_path||'';
}

async function showTeacherSignature(){
  const img=document.getElementById('signaturePreview');
  if(!img)return;
  await fetchSignaturePath();
  if(!currentSignaturePath){img.removeAttribute('src');img.classList.add('empty');return;}
  const {data,error}=await supabaseClient.storage.from(SIG_BUCKET).createSignedUrl(currentSignaturePath,3600);
  if(error){sigMsg('Could not load saved signature.',true);return;}
  img.src=data?.signedUrl||'';img.classList.remove('empty');
}

async function uploadTeacherSignature(file){
  if(!SIG_TYPES.includes(file.type))return sigMsg('Choose a JPG, PNG or WebP image.',true);
  if(file.size>SIG_MAX)return sigMsg('Signature image must be 2 MB or smaller.',true);

  const button=document.getElementById('uploadSignatureBtn');
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Uploading...';}
  try{
    const path=`${pageState.user.id}/signature.${sigExt(file)}`;
    const {error:uploadError}=await supabaseClient.storage.from(SIG_BUCKET).upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
    if(uploadError)throw uploadError;
    const {data:updated,error:updateError}=await supabaseClient.rpc('pacsa_update_my_teacher_signature',{p_path:path});
    if(updateError)throw updateError;
    if(!updated)throw new Error('Could not save the signature to your teacher profile.');
    currentSignaturePath=path;
    sigMsg('Signature saved. PACSA will place it automatically on results you enter.');
    await showTeacherSignature();
  }catch(error){sigMsg(error?.message||'Could not upload signature.',true);}
  finally{if(button){button.disabled=false;button.textContent=old||'Upload Signature';}const input=document.getElementById('signatureInput');if(input)input.value='';}
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await waitForTeacherProfile();
    await showTeacherSignature();
    const input=document.getElementById('signatureInput');
    document.getElementById('uploadSignatureBtn')?.addEventListener('click',()=>input?.click());
    input?.addEventListener('change',()=>{const file=input.files?.[0];if(file)uploadTeacherSignature(file);});
  }catch(error){sigMsg(error?.message||'Could not prepare signature upload.',true);}
});
