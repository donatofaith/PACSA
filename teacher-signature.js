const SIG_BUCKET='teacher-signatures';
const SIG_MAX=2*1024*1024;
const SIG_TYPES=['image/jpeg','image/png','image/webp'];
let currentSignaturePath='';
let signatureCanvas=null;
let signatureCtx=null;
let drawing=false;
let hasDrawing=false;

function sigMsg(text,bad=false){
  const el=document.getElementById('signatureMsg');
  if(!el)return;
  el.textContent=text;
  el.className=`msg ${bad?'bad':'ok'}`;
}

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
  if(!currentSignaturePath){
    img.removeAttribute('src');
    img.classList.add('empty');
    return;
  }
  const {data,error}=await supabaseClient.storage
    .from(SIG_BUCKET)
    .createSignedUrl(currentSignaturePath,3600);
  if(error){
    sigMsg('Could not load saved signature.',true);
    return;
  }
  img.src=(data?.signedUrl||'')+`&v=${Date.now()}`;
  img.classList.remove('empty');
}

function activateSignatureMethod(method){
  const draw=method==='draw';
  document.getElementById('drawSignaturePanel')?.classList.toggle('hidden-signature-method',!draw);
  document.getElementById('uploadSignaturePanel')?.classList.toggle('hidden-signature-method',draw);
  document.getElementById('drawSignatureTab')?.classList.toggle('active',draw);
  document.getElementById('uploadSignatureTab')?.classList.toggle('active',!draw);
}

function setupSignatureCanvas(){
  signatureCanvas=document.getElementById('signatureCanvas');
  if(!signatureCanvas)return;
  signatureCtx=signatureCanvas.getContext('2d',{willReadFrequently:true});
  signatureCtx.lineCap='round';
  signatureCtx.lineJoin='round';
  signatureCtx.strokeStyle='#111827';
  signatureCtx.lineWidth=6;

  const pointFromEvent=e=>{
    const rect=signatureCanvas.getBoundingClientRect();
    const clientX=e.touches?.[0]?.clientX ?? e.clientX;
    const clientY=e.touches?.[0]?.clientY ?? e.clientY;
    return {
      x:(clientX-rect.left)*(signatureCanvas.width/rect.width),
      y:(clientY-rect.top)*(signatureCanvas.height/rect.height)
    };
  };

  const start=e=>{
    e.preventDefault();
    drawing=true;
    const p=pointFromEvent(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(p.x,p.y);
  };
  const move=e=>{
    if(!drawing)return;
    e.preventDefault();
    const p=pointFromEvent(e);
    signatureCtx.lineTo(p.x,p.y);
    signatureCtx.stroke();
    hasDrawing=true;
  };
  const end=e=>{
    if(!drawing)return;
    e.preventDefault();
    drawing=false;
    signatureCtx.closePath();
  };

  signatureCanvas.addEventListener('pointerdown',start);
  signatureCanvas.addEventListener('pointermove',move);
  window.addEventListener('pointerup',end);
  signatureCanvas.addEventListener('touchstart',start,{passive:false});
  signatureCanvas.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',end,{passive:false});
}

function clearSignatureCanvas(){
  if(!signatureCanvas||!signatureCtx)return;
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
  hasDrawing=false;
  sigMsg('');
}

function canvasToBlob(canvas,type='image/png',quality=1){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare signature image.')),type,quality);
  });
}

function cropTransparentCanvas(source,padding=24){
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const {width,height}=source;
  const data=ctx.getImageData(0,0,width,height).data;
  let minX=width,minY=height,maxX=-1,maxY=-1;

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const a=data[(y*width+x)*4+3];
      if(a>20){
        if(x<minX)minX=x;
        if(x>maxX)maxX=x;
        if(y<minY)minY=y;
        if(y>maxY)maxY=y;
      }
    }
  }

  if(maxX<minX||maxY<minY)return null;

  minX=Math.max(0,minX-padding);
  minY=Math.max(0,minY-padding);
  maxX=Math.min(width-1,maxX+padding);
  maxY=Math.min(height-1,maxY+padding);

  const out=document.createElement('canvas');
  out.width=maxX-minX+1;
  out.height=maxY-minY+1;
  out.getContext('2d').drawImage(source,minX,minY,out.width,out.height,0,0,out.width,out.height);
  return out;
}

async function imageFileToCleanSignature(file){
  if(!SIG_TYPES.includes(file.type))throw new Error('Choose a JPG, PNG or WebP image.');
  if(file.size>SIG_MAX)throw new Error('Signature image must be 2 MB or smaller.');

  const bitmap=await createImageBitmap(file);
  const maxSide=1600;
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();

  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const d=img.data;

  // Remove light paper/background while preserving dark ink.
  // Alpha becomes stronger as pixels become darker.
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const luminance=0.2126*r+0.7152*g+0.0722*b;
    const chroma=Math.max(r,g,b)-Math.min(r,g,b);

    // Very light, low-chroma pixels are treated as paper/background.
    if(luminance>218 && chroma<38){
      d[i+3]=0;
      continue;
    }

    // Fade lighter pixels progressively instead of creating a harsh edge.
    const darkness=Math.max(0,Math.min(1,(235-luminance)/120));
    const alpha=Math.round(255*Math.pow(darkness,0.72));

    if(alpha<22){
      d[i+3]=0;
    }else{
      // Normalize visible ink toward dark neutral so shadows/book colors disappear.
      const ink=Math.max(0,Math.min(70,Math.round(luminance*0.28)));
      d[i]=ink;
      d[i+1]=ink;
      d[i+2]=ink;
      d[i+3]=alpha;
    }
  }
  ctx.putImageData(img,0,0);

  const cropped=cropTransparentCanvas(canvas,28);
  if(!cropped)throw new Error('PACSA could not detect a signature in that photo. Try a darker signature on plain light paper.');

  // Place on a standardized transparent canvas so report sizing is consistent.
  const out=document.createElement('canvas');
  out.width=900;
  out.height=300;
  const octx=out.getContext('2d');
  const fit=Math.min(820/cropped.width,230/cropped.height,1.8);
  const w=cropped.width*fit;
  const h=cropped.height*fit;
  octx.drawImage(cropped,(out.width-w)/2,(out.height-h)/2,w,h);

  return out;
}

async function saveSignatureCanvas(canvas,sourceLabel='Signature'){
  const buttonIds=['saveDrawnSignatureBtn','uploadSignatureBtn'];
  const buttons=buttonIds.map(id=>document.getElementById(id)).filter(Boolean);
  const originals=buttons.map(b=>b.textContent);
  buttons.forEach(b=>{b.disabled=true;});

  try{
    sigMsg('Cleaning and saving signature...');
    const cropped=cropTransparentCanvas(canvas,24) || canvas;
    const blob=await canvasToBlob(cropped,'image/png');
    const path=`${pageState.user.id}/signature-${Date.now()}.png`;
    const previous=currentSignaturePath;

    const {error:uploadError}=await supabaseClient.storage
      .from(SIG_BUCKET)
      .upload(path,blob,{
        upsert:false,
        contentType:'image/png',
        cacheControl:'3600'
      });
    if(uploadError)throw uploadError;

    const {data:updated,error:updateError}=await supabaseClient
      .rpc('pacsa_update_my_teacher_signature',{p_path:path});
    if(updateError)throw updateError;
    if(!updated)throw new Error('Could not save the signature to your teacher profile.');

    currentSignaturePath=path;

    if(previous && previous!==path){
      // Best-effort cleanup only; failure should not undo the newly saved signature.
      await supabaseClient.storage.from(SIG_BUCKET).remove([previous]);
    }

    sigMsg(`${sourceLabel} saved. Existing and future PACSA report sheets will use this clean signature automatically.`);
    await showTeacherSignature();
  }finally{
    buttons.forEach((b,i)=>{b.disabled=false;b.textContent=originals[i];});
    const input=document.getElementById('signatureInput');
    if(input)input.value='';
  }
}

async function saveDrawnSignature(){
  if(!hasDrawing)return sigMsg('Draw your signature first.',true);
  try{
    await saveSignatureCanvas(signatureCanvas,'Drawn signature');
  }catch(error){
    sigMsg(error?.message||'Could not save drawn signature.',true);
  }
}

async function uploadTeacherSignature(file){
  try{
    sigMsg('Removing background and cropping signature...');
    const cleaned=await imageFileToCleanSignature(file);
    await saveSignatureCanvas(cleaned,'Cleaned signature');
  }catch(error){
    sigMsg(error?.message||'Could not process signature photo.',true);
    const input=document.getElementById('signatureInput');
    if(input)input.value='';
  }
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await waitForTeacherProfile();
    setupSignatureCanvas();
    await showTeacherSignature();

    const input=document.getElementById('signatureInput');

    document.getElementById('drawSignatureTab')?.addEventListener('click',()=>activateSignatureMethod('draw'));
    document.getElementById('uploadSignatureTab')?.addEventListener('click',()=>activateSignatureMethod('upload'));
    document.getElementById('clearSignatureBtn')?.addEventListener('click',clearSignatureCanvas);
    document.getElementById('saveDrawnSignatureBtn')?.addEventListener('click',saveDrawnSignature);
    document.getElementById('uploadSignatureBtn')?.addEventListener('click',()=>input?.click());
    input?.addEventListener('change',()=>{
      const file=input.files?.[0];
      if(file)uploadTeacherSignature(file);
    });
  }catch(error){
    sigMsg(error?.message||'Could not prepare signature tools.',true);
  }
});